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

/// GET num endpoint do cliente. `None` = cliente fechado; `Some(Err(status))` = resposta de erro.
async fn get(path: &str) -> Result<Option<Result<serde_json::Value, u16>>, String> {
    let Some(c) = creds_from_process().or_else(creds_from_lockfile) else {
        return Ok(None);
    };
    // O certificado do cliente é autoassinado; a conexão é só local (127.0.0.1)
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;
    let auth = STANDARD.encode(format!("riot:{}", c.password));
    let url = format!("https://127.0.0.1:{}{}", c.port, path);
    let res = match client.get(&url).header("Authorization", format!("Basic {auth}")).send().await {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };
    if !res.status().is_success() {
        return Ok(Some(Err(res.status().as_u16())));
    }
    Ok(Some(Ok(res.json::<serde_json::Value>().await.map_err(|e| e.to_string())?)))
}

#[tauri::command]
pub async fn champ_select() -> Result<ChampSelect, String> {
    Ok(match get("/lol-champ-select/v1/session").await? {
        None => ChampSelect::Offline,
        Some(Err(_)) => ChampSelect::Idle,
        Some(Ok(session)) => ChampSelect::Active { session },
    })
}

/// Conta logada no cliente (nome, tag, puuid). `null` se o cliente estiver fechado.
#[tauri::command]
pub async fn current_summoner() -> Result<Option<serde_json::Value>, String> {
    Ok(get("/lol-summoner/v1/current-summoner").await?.and_then(|r| r.ok()))
}

/// Histórico recente da conta logada (até ~100 partidas por chamada).
#[tauri::command]
pub async fn match_history(beg: u32, end: u32) -> Result<Option<serde_json::Value>, String> {
    let path = format!("/lol-match-history/v1/products/lol/current-summoner/matches?begIndex={beg}&endIndex={end}");
    Ok(get(&path).await?.and_then(|r| r.ok()))
}

/// Fase do cliente: "ChampSelect", "InProgress" (em partida), "Lobby", "None"...
#[tauri::command]
pub async fn gameflow_phase() -> Result<Option<String>, String> {
    Ok(get("/lol-gameflow/v1/gameflow-phase").await?.and_then(|r| r.ok()).and_then(|v| v.as_str().map(String::from)))
}

/// Requisição com método e corpo (usada pra criar a página de runas).
async fn send(method: reqwest::Method, path: &str, body: Option<serde_json::Value>) -> Result<Option<serde_json::Value>, String> {
    let Some(c) = creds_from_process().or_else(creds_from_lockfile) else {
        return Err("Cliente do LoL fechado".into());
    };
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;
    let auth = STANDARD.encode(format!("riot:{}", c.password));
    let mut req = client.request(method, format!("https://127.0.0.1:{}{}", c.port, path)).header("Authorization", format!("Basic {auth}"));
    if let Some(b) = body {
        req = req.json(&b);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("{}: {}", status.as_u16(), text));
    }
    Ok(serde_json::from_str(&text).ok())
}

/// Troca a página de runas atual pela recomendada (substitui a página atual se ela for editável).
#[tauri::command]
pub async fn set_rune_page(name: String, primary: i64, sub: i64, perks: Vec<i64>) -> Result<(), String> {
    if let Some(cur) = get("/lol-perks/v1/currentpage").await?.and_then(|r| r.ok()) {
        if cur.get("isDeletable").and_then(|v| v.as_bool()).unwrap_or(false) {
            if let Some(id) = cur.get("id").and_then(|v| v.as_i64()) {
                let _ = send(reqwest::Method::DELETE, &format!("/lol-perks/v1/pages/{id}"), None).await;
            }
        }
    }
    let body = serde_json::json!({
        "name": name, "primaryStyleId": primary, "subStyleId": sub,
        "selectedPerkIds": perks, "current": true
    });
    send(reqwest::Method::POST, "/lol-perks/v1/pages", Some(body)).await.map(|_| ())
}

/// Cria (ou atualiza) um conjunto de itens no cliente pro campeão, que aparece na loja dentro da partida.
/// `blocks` já vem no formato do cliente: [{ "type": "...", "items": [{ "id": "3865", "count": 1 }] }].
#[tauri::command]
pub async fn set_item_set(title: String, champ_key: i64, blocks: serde_json::Value) -> Result<(), String> {
    let me = get("/lol-summoner/v1/current-summoner").await?.and_then(|r| r.ok()).ok_or("Cliente do LoL fechado")?;
    let sid = me.get("summonerId").and_then(|v| v.as_i64()).ok_or("sem summonerId")?;
    let path = format!("/lol-item-sets/v1/item-sets/{sid}/sets");
    let mut cur = get(&path).await?.and_then(|r| r.ok()).unwrap_or_else(|| serde_json::json!({ "itemSets": [] }));
    let uid = format!("helporo-{champ_key}");
    let set = serde_json::json!({
        "uid": uid, "title": title, "type": "custom", "map": "any", "mode": "any", "sortrank": 0,
        "startedFrom": "blank", "associatedChampions": [champ_key], "associatedMaps": [11],
        "preferredItemSlots": [], "blocks": blocks
    });
    let mut sets: Vec<serde_json::Value> = cur.get("itemSets").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    sets.retain(|s| s.get("uid").and_then(|u| u.as_str()) != Some(uid.as_str()));
    sets.push(set);
    cur["itemSets"] = serde_json::Value::Array(sets);
    if cur.get("accountId").is_none() {
        cur["accountId"] = me.get("accountId").cloned().unwrap_or(serde_json::json!(0));
    }
    send(reqwest::Method::PUT, &path, Some(cur)).await.map(|_| ())
}
