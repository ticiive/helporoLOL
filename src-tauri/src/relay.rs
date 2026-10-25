//! Coach ao vivo pela internet: o app publica o estado da partida num canal secreto do ntfy.sh
//! (serviço público de mensagens, sem conta) e a página do GitHub Pages lê esse canal. Funciona em
//! qualquer rede (4G inclusive). Não manda nome de jogador: só campeão, time, nível, feitiços,
//! itens, tempo de partida, objetivos e o coach. Publica só quando algo muda (e um sinal a cada 60 s),
//! pra ficar dentro do limite do serviço gratuito (a página extrapola o relógio entre uma mensagem e outra).

use std::thread;
use std::time::{Duration, Instant};

use crate::live;

const SERVER: &str = "https://ntfy.sh";
pub const PAGE: &str = "https://ticiive.github.io/helporoLOL/";

/// Canal fixo do helporoLOL: a página do GitHub Pages já sabe qual é, então é só abrir o link.
pub const TOPIC: &str = "helporo-efea0ba1cb0ca5b393f6a2ee";

pub fn topic() -> String {
    TOPIC.to_string()
}

pub fn page_url() -> String {
    PAGE.to_string()
}

fn publish(topic: &str, body: &str) {
    let Ok(client) = reqwest::blocking::Client::builder().timeout(Duration::from_secs(6)).build() else { return };
    let _ = client.post(format!("{SERVER}/{topic}")).body(body.to_string()).send();
}

/// Estado da partida sem nomes: o "me" marca você; o time de quem matou o objetivo vai no lugar do nome.
fn game_state() -> Option<(serde_json::Value, String, usize)> {
    let p = live::players();
    if p.get("inGame").and_then(|v| v.as_bool()) != Some(true) {
        return None;
    }
    let me = p.get("me").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
    let list = p.get("players").and_then(|v| v.as_array()).cloned().unwrap_or_default();
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
    let all: Vec<serde_json::Value> = ev.get("events").and_then(|e| e.as_array()).cloned().unwrap_or_default();
    // objetivos sempre; abates só os 24 mais recentes (a página fala cada um uma vez só)
    let is_kill = |e: &serde_json::Value| matches!(e.get("name").and_then(|n| n.as_str()), Some("ChampionKill" | "Multikill" | "Ace" | "FirstBlood"));
    let kills_from = all.iter().filter(|e| is_kill(e)).count().saturating_sub(24);
    let mut seen_k = 0;
    let events: Vec<_> = all
        .iter()
        .filter(|e| if is_kill(e) { seen_k += 1; seen_k > kills_from } else { true })
        .map(|e| {
            // sem nome de jogador: só campeão, time e se foi você
            serde_json::json!({ "name": e.get("name"), "time": e.get("time"), "dragon": e.get("dragon"), "team": e.get("team"),
                "kc": e.get("kc"), "vc": e.get("vc"), "vteam": e.get("vteam"), "meK": e.get("meK"), "meV": e.get("meV"), "meA": e.get("meA"),
                "streak": e.get("streak"), "acing": e.get("acing"), "stolen": e.get("stolen") })
        })
        .collect();
    // eventos que valem aviso na hora (objetivo, ace, multi, você matou/morreu/ajudou)
    let urgent = all
        .iter()
        .filter(|e| {
            let n = e.get("name").and_then(|n| n.as_str()).unwrap_or("");
            let mine = ["meK", "meV", "meA"].iter().any(|k| e.get(*k).and_then(|v| v.as_bool()) == Some(true));
            matches!(n, "DragonKill" | "HeraldKill" | "BaronKill" | "HordeKill" | "InhibKilled" | "Ace" | "Multikill" | "FirstBlood") || (n == "ChampionKill" && mine)
        })
        .count();
    let gold = ev.pointer("/me/gold").cloned();
    // assinatura: só o que muda o que a página mostra (campeões, níveis, itens, eventos)
    let sig = format!(
        "{}|{}|{}",
        players.iter().map(|x| format!("{}{}", x["champ"], x["items"])).collect::<Vec<_>>().join(","),
        all.len(),
        urgent
    );
    let state = serde_json::json!({ "k": "game", "t": p.get("gameTime"), "players": players, "events": events, "gold": gold });
    Some((state, sig, urgent))
}

pub fn start() {
    thread::spawn(|| {
        let topic = topic();
        let mut last_sig = String::new();
        let mut last_pub = Instant::now() - Duration::from_secs(3600);
        let mut last_coach = String::new();
        let mut in_game = false;
        let mut last_urgent = 0usize;
        loop {
            // coach: publica quando muda (montado pelo app na seleção)
            let coach = live::COACH.lock().map(|g| g.clone()).unwrap_or_default();
            if !coach.is_empty() && coach != last_coach && coach.len() < 4000 {
                publish(&topic, &coach);
                last_coach = coach;
            }
            match game_state() {
                Some((state, sig, urgent)) => {
                    // aviso na hora pra objetivo, ace e abate seu (pelo menos 10 s entre um e outro);
                    // o resto no máximo a cada 40 s, com sinal a cada 120 s: ~60-80 mensagens por partida
                    let hurry = urgent > last_urgent && last_pub.elapsed() >= Duration::from_secs(10);
                    let changed = sig != last_sig && last_pub.elapsed() >= Duration::from_secs(40);
                    if !in_game || hurry || changed || last_pub.elapsed() >= Duration::from_secs(120) {
                        last_urgent = urgent;
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
                        last_urgent = 0;
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
