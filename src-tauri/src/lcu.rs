//! Leitura da seleção de campeões pela API local do cliente do LoL (LCU).
//!
//! O cliente expõe um servidor HTTPS em 127.0.0.1 com porta e senha que mudam
//! a cada abertura. Elas aparecem nos argumentos do processo `LeagueClientUx`
//! e também no arquivo `lockfile` da pasta de instalação.

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ChampSelect {
    /// Cliente fechado ou credenciais não encontradas
    Offline,
    /// Cliente aberto, mas fora da seleção de campeões
    Idle,
    /// Sessão da seleção, como o cliente devolve
    Active { session: serde_json::Value },
}

struct Creds {
    port: String,
    password: String,
}

/// Linha de comando dos processos em execução.
#[cfg(windows)]
fn process_list() -> Option<String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000; // não pisca janela de console
    let out = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    Some(String::from_utf8_lossy(&out.stdout).into_owned())
}

#[cfg(not(windows))]
fn process_list() -> Option<String> {
    let out = Command::new("ps").args(["-A", "-o", "args="]).output().ok()?;
    Some(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Lê porta e senha dos argumentos do processo `LeagueClientUx`.
fn creds_from_process() -> Option<Creds> {
    let text = process_list()?;
    let line = text.lines().find(|l| l.contains("LeagueClientUx") && l.contains("--app-port="))?;
    let arg = |key: &str| {
        line.split_whitespace()
            .find_map(|a| a.trim_matches('"').strip_prefix(key).map(|v| v.trim_matches('"').to_string()))
    };
    Some(Creds { port: arg("--app-port=")?, password: arg("--remoting-auth-token=")? })
}

/// Lê o lockfile (formato nome:pid:porta:senha:protocolo).
fn creds_from_lockfile() -> Option<Creds> {
    let paths = [
        "C:\\Riot Games\\League of Legends\\lockfile",
        "D:\\Riot Games\\League of Legends\\lockfile",
        "/Applications/League of Legends.app/Contents/LoL/lockfile",
    ];
    for p in paths {
        if let Ok(s) = std::fs::read_to_string(p) {
            let parts: Vec<&str> = s.trim().split(':').collect();
            if parts.len() >= 5 {
                return Some(Creds { port: parts[2].to_string(), password: parts[3].to_string() });
            }
        }
    }
    None
}

#[tauri::command]
pub async fn champ_select() -> Result<ChampSelect, String> {
    let Some(c) = creds_from_process().or_else(creds_from_lockfile) else {
        return Ok(ChampSelect::Offline);
    };
    // O certificado do cliente é autoassinado; a conexão é só local (127.0.0.1)
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;
    let auth = STANDARD.encode(format!("riot:{}", c.password));
    let url = format!("https://127.0.0.1:{}/lol-champ-select/v1/session", c.port);
    let res = match client.get(&url).header("Authorization", format!("Basic {auth}")).send().await {
        Ok(r) => r,
        Err(_) => return Ok(ChampSelect::Offline),
    };
    if !res.status().is_success() {
        return Ok(ChampSelect::Idle);
    }
    let session = res.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
    Ok(ChampSelect::Active { session })
}
