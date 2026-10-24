/**
 * Base do coach: a habilidade que mais pesa de cada campeão comum (a que prende, puxa ou mergulha),
 * os tempos da temporada 2026 e as ferramentas de defesa dos sups. Fatos estáveis do jogo; o nome da
 * habilidade em português vem do Data Dragon na hora.
 *
 * Tipos: hook (puxão em linha), engage (entra em você), cc (stun/root/charm a distância),
 * pick (pega quem anda sozinho), dive (mergulha na backline), supp (supressão), poke (desgaste de longe).
 */
export type Threat = "hook" | "engage" | "cc" | "pick" | "dive" | "supp" | "poke";
export type Key = "Q" | "W" | "E" | "R" | "P";
const RAW = `
Thresh:Q:hook,Blitzcrank:Q:hook,Nautilus:Q:hook,Pyke:Q:hook,Leona:E:engage,Rell:W:engage,Alistar:W:engage,Rakan:W:engage,
Morgana:Q:cc,Lux:Q:cc,Zyra:E:cc,Xerath:E:cc,Vel'Koz:E:cc,Brand:Q:cc,Karma:W:cc,Neeko:E:cc,Seraphine:E:cc,Senna:W:cc,Bard:Q:cc,
Braum:R:engage,Janna:Q:cc,Lulu:W:cc,Nami:Q:cc,Sona:R:cc,Soraka:E:cc,Taric:E:cc,Zilean:Q:cc,Maokai:W:engage,Poppy:E:engage,
Tahm Kench:W:pick,Camille:E:engage,Pantheon:W:engage,Swain:E:cc,Shaco:W:pick,Mel:E:cc,Galio:E:engage,Shen:E:engage,Sett:E:engage,
Renata Glasc:R:cc,
Lee Sin:Q:pick,Elise:E:pick,Jarvan IV:E:engage,Vi:R:supp,Nocturne:R:dive,Rengar:P:dive,Amumu:Q:engage,Sejuani:R:engage,Zac:E:engage,
Hecarim:E:engage,Warwick:R:supp,Kha'Zix:Q:dive,Evelynn:W:pick,Xin Zhao:E:engage,Rek'Sai:E:dive,Wukong:R:engage,Lillia:R:cc,
Skarner:R:supp,Diana:R:engage,Nidalee:Q:poke,Fiddlesticks:R:engage,Nunu & Willump:W:engage,Rammus:E:engage,Briar:Q:dive,Kayn:Q:dive,
Viego:P:dive,Graves:E:dive,Ivern:Q:cc,Kindred:R:dive,Master Yi:Q:dive,Volibear:Q:engage,Udyr:E:engage,Ekko:W:cc,Gragas:E:engage,
Ahri:E:pick,Syndra:E:cc,Orianna:R:engage,Annie:R:engage,Veigar:E:cc,Twisted Fate:W:pick,Malzahar:R:supp,Lissandra:R:engage,
Sylas:E:engage,Zoe:E:pick,LeBlanc:E:pick,Vex:R:dive,Taliyah:E:cc,Zed:R:dive,Talon:Q:dive,Katarina:R:dive,Fizz:R:pick,Akali:R:dive,
Qiyana:R:engage,Yasuo:Q:engage,Yone:R:engage,Cassiopeia:R:cc,Anivia:Q:cc,Viktor:W:cc,Ryze:W:cc,Kassadin:R:dive,Hwei:E:cc,Aurora:E:cc,
Azir:R:engage,Corki:R:poke,Ziggs:Q:poke,Locke:R:dive,Naafiri:Q:dive,Akshan:R:pick,Smolder:R:poke,
Ashe:R:pick,Jhin:W:pick,Varus:R:engage,Caitlyn:W:cc,Xayah:E:cc,Samira:R:dive,Jinx:E:cc,Draven:E:cc,Kalista:R:engage,Tristana:W:dive,
Lucian:E:dive,Kai'Sa:R:dive,Nilah:E:dive,Ezreal:Q:poke,Miss Fortune:R:poke,Aphelios:R:poke,Zeri:R:dive,Yunara:R:dive,Sivir:R:engage,
Malphite:R:engage,Ornn:R:engage,Sion:R:engage,Kennen:R:engage,Renekton:W:cc,Darius:E:pick,Garen:Q:pick,Jax:E:cc,Riven:W:cc,
Irelia:E:cc,Gnar:R:engage,K'Sante:W:engage,Urgot:R:supp,Mordekaiser:R:pick,Cho'Gath:Q:cc,Aatrox:Q:cc,Illaoi:E:pick,Kled:R:engage,
Gwen:Q:dive,Fiora:R:dive,Tryndamere:R:dive,Ambessa:R:engage,Zaahen:R:engage`;
export const THREAT: Record<string, { key: Key; type: Threat }> = Object.fromEntries(
  RAW.replace(/\n/g, "").split(",").filter(Boolean).map((x) => { const [n, k, t] = x.split(":"); return [n.trim(), { key: k as Key, type: t as Threat }]; }));

/** Ferramenta de defesa de cada sup: o que guardar quando o inimigo entra. */
export const DEFENSE: Record<string, { key: Key; use: string }> = {
  Soraka: { key: "E", use: "silencia quem entrar: guarde pra quando ele pular em vocês" },
  Janna: { key: "Q", use: "levanta quem entrar; o R afasta todo mundo de uma vez" },
  Lulu: { key: "W", use: "transforma quem mergulhar no seu ADC" },
  Nami: { key: "Q", use: "a bolha prende quem vier; jogue onde ele vai cair, não onde ele está" },
  Sona: { key: "R", use: "atordoa quem entrar; com E você foge junto do ADC" },
  Milio: { key: "R", use: "tira o CC do seu time e cura: segure pro CC deles" },
  Morgana: { key: "E", use: "o escudo bloqueia o CC: jogue no seu ADC quando o engage vier" },
  Braum: { key: "E", use: "o escudo bloqueia projéteis: fique na frente do ADC" },
  Taric: { key: "R", use: "deixa o time invulnerável: use quando eles entrarem com tudo" },
  Rakan: { key: "W", use: "levanta quem entrar no seu ADC" },
  Thresh: { key: "W", use: "a lanterna salva o ADC: jogue quando ele for pego" },
  Alistar: { key: "W", use: "afasta quem mergulhar no seu ADC" },
  Leona: { key: "Q", use: "atordoa quem entrar no seu ADC" },
  Nautilus: { key: "R", use: "levanta quem mergulhar" },
  Karma: { key: "E", use: "escudo e velocidade: com R antes, o time todo foge" },
  Yuumi: { key: "R", use: "prende quem entrar no seu ADC" },
  "Renata Glasc": { key: "W", use: "salva o aliado que ia morrer" },
  Zilean: { key: "R", use: "revive o aliado: guarde pro carry" },
  Seraphine: { key: "R", use: "encanta quem entrar" },
};

/** Sups que ganham muito no nível 2 (all-in) e no 6. */
export const LVL2 = new Set(["Leona", "Nautilus", "Blitzcrank", "Thresh", "Rell", "Pyke", "Alistar", "Rakan", "Pantheon", "Camille", "Poppy", "Draven", "Lucian", "Samira", "Kalista", "Nilah", "Tristana"]);
export const LVL6 = new Set(["Leona", "Nautilus", "Sona", "Nami", "Seraphine", "Brand", "Zyra", "Malphite", "Amumu", "Rell", "Alistar", "Rakan", "Pyke", "Ashe", "Varus", "Samira", "Kalista"]);
/** Junglers que gankam cedo (rota de 3 campos e gank no nível 3) e os que preferem farmar. */
export const EARLY_JG = new Set(["Lee Sin", "Elise", "Jarvan IV", "Xin Zhao", "Rek'Sai", "Nidalee", "Shaco", "Vi", "Rengar", "Pantheon", "Wukong", "Sejuani", "Zac", "Jax", "Briar", "Naafiri", "Qiyana", "Kha'Zix", "Rammus", "Volibear", "Warwick", "Ivern"]);
export const FARM_JG = new Set(["Karthus", "Master Yi", "Shyvana", "Lillia", "Bel'Veth", "Kindred", "Fiddlesticks", "Taliyah", "Graves", "Viego", "Hecarim", "Diana", "Ekko", "Kayn", "Nocturne", "Udyr", "Evelynn", "Gragas", "Amumu", "Skarner", "Nunu & Willump", "Zyra", "Brand"]);

/** Tempos da temporada 2026 (minions aos 0:30; campos e objetivos 35 s mais cedo que em 2025; Atakhan removido). */
export const T = {
  minions: 30, camps: 55, scuttle: 2 * 60 + 55, gank3: [2 * 60 + 15, 2 * 60 + 45] as [number, number], fullClear: [2 * 60 + 50, 3 * 60 + 15] as [number, number],
  drake: 5 * 60, drakeRespawn: 5 * 60, grubs: 8 * 60, grubsEnd: 14 * 60 + 45, herald: 15 * 60, heraldEnd: 19 * 60 + 45, baron: 20 * 60, baronRespawn: 6 * 60, elderRespawn: 6 * 60,
  leaveBot: 14 * 60, setup: 60, // ward e grupo 60-90 s antes de cada objetivo
};
export const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
