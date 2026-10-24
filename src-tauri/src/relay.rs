//! Coach ao vivo pela internet: o app publica o estado da partida num canal secreto do ntfy.sh
//! (serviço público de mensagens, sem conta) e a página do GitHub Pages lê esse canal. Funciona em
//! qualquer rede (4G inclusive). Não manda nome de jogador: só campeão, time, nível, feitiços,
//! itens, tempo de partida, objetivos e o coach. Publica só quando algo muda (e um sinal a cada 60 s),
//! pra ficar dentro do limite do serviço gratuito (a página extrapola o relógio entre uma mensagem e outra).

use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::path::PathBuf;
use std::thread;
use std::time::{Duration, Instant};

use crate::live;

const SERVER: &str = "https://ntfy.sh";
pub const PAGE: &str = "https://ticiive.github.io/helporoLOL/";

fn topic_file() -> PathBuf {
    let base = std::env::var("APPDATA").or_else(|_| std::env::var("HOME")).unwrap_or_else(|_| ".".into());
    PathBuf::from(base).join("helporolol").join("relay.txt")
}

/// Canal secreto deste PC (criado na primeira vez e guardado): quem não tem o link não acha.
pub fn topic() -> String {
    let f = topic_file();
    if let Ok(t) = std::fs::read_to_string(&f) {
        let t = t.trim().to_string();
        if t.len() >= 20 {
            return t;
        }
    }
    let mut id = String::from("helporo-");
    for _ in 0..2 {
        let mut h = RandomState::new().build_hasher();
        h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        id.push_str(&format!("{:016x}", h.finish()));
    }
    if let Some(dir) = f.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(&f, &id);
    id
}

pub fn page_url() -> String {
    format!("{PAGE}#t={}", topic())
}

fn publish(topic: &str, body: &str) {
    let Ok(client) = reqwest::blocking::Client::builder().timeout(Duration::from_secs(6)).build() else { return };
    let _ = client.post(format!("{SERVER}/{topic}")).body(body.to_string()).send();
}

/// Estado da partida sem nomes: o "me" marca você; o time de quem matou o objetivo vai no lugar do nome.
fn game_state() -> Option<(serde_json::Value, String)> {
    let p = live::players();
    if p.get("inGame").and_then(|v| v.as_bool()) != Some(true) {
        return None;
    }
    let me = p.get("me").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
    let list = p.get("players").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let team_of = |name: &str| {
        list.iter()
            .find(|x| x.get("riotId").and_then(|r| r.as_str()).map(|r| r.eq_ignore_ascii_case(name)).unwrap_or(false))
            .and_then(|x| x.get("team").cloned())
    };
    let players: Vec<_> = list
        .iter()
        .map(|x| {
            let is_me = x.get("riotId").and_then(|r| r.as_str()).map(|r| r.to_lowercase() == me).unwrap_or(false);
            serde_json::json!({
                "me": is_me, "champ": x.get("champ"), "team": x.get("team"), "level": x.get("level"),
                "spell1": x.get("spell1"), "spell2": x.get("spell2"), "items": x.get("items"),
            })
        })
        .collect();
    let ev = live::events();
    let events: Vec<_> = ev
        .get("events")
        .and_then(|e| e.as_array())
        .map(|a| {
            a.iter()
                .map(|e| {
                    let killer = e.get("killer").and_then(|k| k.as_str()).unwrap_or("");
                    serde_json::json!({ "name": e.get("name"), "time": e.get("time"), "dragon": e.get("dragon"), "team": team_of(killer) })
                })
                .collect()
        })
        .unwrap_or_default();
    let gold = ev.pointer("/me/gold").cloned();
    // assinatura: só o que muda o que a página mostra (campeões, níveis, itens, eventos)
    let sig = format!(
        "{}|{}",
        players.iter().map(|x| format!("{}{}", x["champ"], x["items"])).collect::<Vec<_>>().join(","),
        events.len()
    );
    let state = serde_json::json!({ "k": "game", "t": p.get("gameTime"), "players": players, "events": events, "gold": gold });
    Some((state, sig))
}

pub fn start() {
    thread::spawn(|| {
        let topic = topic();
        let mut last_sig = String::new();
        let mut last_pub = Instant::now() - Duration::from_secs(3600);
        let mut last_coach = String::new();
        let mut in_game = false;
        loop {
            // coach: publica quando muda (montado pelo app na seleção)
            let coach = live::COACH.lock().map(|g| g.clone()).unwrap_or_default();
            if !coach.is_empty() && coach != last_coach && coach.len() < 4000 {
                publish(&topic, &coach);
                last_coach = coach;
            }
            match game_state() {
                Some((state, sig)) => {
                    // no máximo 1 mensagem a cada 30 s (+ sinal a cada 90 s): ~60 por partida, dentro do limite gratuito
                    let changed = sig != last_sig && last_pub.elapsed() >= Duration::from_secs(30);
                    if !in_game || changed || last_pub.elapsed() >= Duration::from_secs(90) {
                        let body = state.to_string();
                        if body.len() < 4000 {
                            publish(&topic, &body);
                        }
                        last_sig = sig;
                        last_pub = Instant::now();
                        if !in_game {
                            // partida começou: manda o coach de novo junto
                            if !last_coach.is_empty() {
                                publish(&topic, &last_coach);
                            }
                        }
                        in_game = true;
                    }
                }
                None => {
                    if in_game {
                        publish(&topic, r#"{"k":"end"}"#);
                        in_game = false;
                    }
                }
            }
            thread::sleep(Duration::from_secs(5));
        }
    });
}

#[tauri::command]
pub fn relay_url() -> String {
    page_url()
}
