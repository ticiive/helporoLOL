//! Página de timer manual servida na rede de casa (http://IP-do-PC:7777).
//!
//! Ela só pré-preenche quem são os inimigos e quais feitiços eles levaram, lendo a
//! API local da partida (Live Client Data, 127.0.0.1:2999). Os timers são manuais:
//! você toca no quadrado quando VÊ o feitiço ou o ult sendo usado.

use std::thread;

pub const PORT: u16 = 7777;
const PAGE: &str = include_str!("../assets/timer.html");

fn live(path: &str) -> Option<serde_json::Value> {
    // O jogo usa certificado autoassinado e só escuta em 127.0.0.1
    let client = reqwest::blocking::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .ok()?;
    client.get(format!("https://127.0.0.1:2999/liveclientdata/{path}")).send().ok()?.json().ok()
}

/// Só o necessário pra montar a tela: campeão, time, nível e os dois feitiços.
fn players() -> serde_json::Value {
    let me = live("activeplayername").and_then(|v| v.as_str().map(String::from));
    let list = live("playerlist").and_then(|v| v.as_array().cloned());
    let Some(list) = list else { return serde_json::json!({ "inGame": false }) };
    let slim: Vec<_> = list
        .iter()
        .map(|p| {
            serde_json::json!({
                "riotId": p.get("riotId").or(p.get("summonerName")),
                "champ": p.get("rawChampionName"),
                "team": p.get("team"),
                "level": p.get("level"),
                "position": p.get("position"),
                "spell1": p.pointer("/summonerSpells/summonerSpellOne/rawDisplayName"),
                "spell2": p.pointer("/summonerSpells/summonerSpellTwo/rawDisplayName"),
            })
        })
        .collect();
    // tempo de partida em segundos, pra mostrar quando cada feitiço volta
    let game_time = live("gamestats").and_then(|g| g.get("gameTime").and_then(|t| t.as_f64()));
    serde_json::json!({ "inGame": true, "me": me, "gameTime": game_time, "players": slim })
}

/// IP da rede de casa (Wi-Fi/cabo). Pula VPNs como Radmin (26.x) e Hamachi (25.x), que outro
/// aparelho da casa não alcança, e prefere 192.168.x, depois 10.x e 172.16-31.x.
fn lan_ip() -> Option<String> {
    let mut best: Option<(u8, String)> = None;
    if let Ok(list) = local_ip_address::list_afinet_netifas() {
        for (_, ip) in list {
            let std::net::IpAddr::V4(v4) = ip else { continue };
            let o = v4.octets();
            let rank = match o {
                [192, 168, ..] => 0,
                [10, ..] => 1,
                [172, b, ..] if (16..=31).contains(&b) => 2,
                _ => continue, // loopback, VPN (25.x, 26.x), link-local etc.
            };
            if best.as_ref().map_or(true, |(r, _)| rank < *r) {
                best = Some((rank, v4.to_string()));
            }
        }
    }
    best.map(|(_, ip)| ip)
}

pub fn url() -> String {
    let ip = lan_ip()
        .or_else(|| local_ip_address::local_ip().ok().map(|i| i.to_string()))
        .unwrap_or_else(|| "IP-do-PC".into());
    format!("http://{ip}:{PORT}")
}

pub fn serve() {
    thread::spawn(|| {
        let Ok(server) = tiny_http::Server::http(("0.0.0.0", PORT)) else { return };
        let html = tiny_http::Header::from_bytes("Content-Type", "text/html; charset=utf-8").unwrap();
        let json = tiny_http::Header::from_bytes("Content-Type", "application/json").unwrap();
        for req in server.incoming_requests() {
            let res = match req.url() {
                "/players" => tiny_http::Response::from_string(players().to_string()).with_header(json.clone()),
                _ => tiny_http::Response::from_string(PAGE).with_header(html.clone()),
            };
            let _ = req.respond(res);
        }
    });
}

#[tauri::command]
pub fn timer_url() -> String {
    url()
}
