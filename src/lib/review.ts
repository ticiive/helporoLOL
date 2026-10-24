/**
 * Revisão pós-jogo pela timeline do cliente: onde e como cada morte aconteceu (zona do mapa,
 * quem matou, se tinha aliado perto, se foi antes de objetivo), participação em abates e um foco
 * pra treinar. Tudo vem da API local do cliente (sem chave da Riot).
 */
import type { Catalog } from "./ddragon";
import type { Bench } from "./builds";

export interface Pos { x: number; y: number }
export interface Kill { t: number; killer: number; victim: number; assists: number[]; pos: Pos }
export interface Obj { t: number; type: string; team: number }
export interface Death { t: number; zone: Zone; where: string; killer: string; with: string[]; alliesNear: number; isolated: boolean; objective: string | null; early: boolean }
export interface Player { pid: number; champ: string; team: number; me: boolean }
export interface Review {
  gameId: number; champ: string; role: string | null; win: boolean; min: number;
  k: number; d: number; a: number; kp: number; teamKills: number;
  players: Player[]; frames: Record<number, Pos>[]; kills: Kill[]; objs: Obj[];
  deaths: Death[]; good: string[]; bad: string[];
  focus: { key: FocusKey; title: string; text: string } | null;
  story: string;
}
export type Zone = "baseAlly" | "baseEnemy" | "top" | "mid" | "bot" | "riverTop" | "riverBot" | "jungleAlly" | "jungleEnemy";
export type FocusKey = "mapa" | "objetivo" | "lane" | "luta" | "visao";

const MAXX = 14870, MAXY = 14980;
/** Zona do Summoner's Rift pela coordenada (azul embaixo à esquerda, vermelho em cima à direita). */
export function zoneOf(p: Pos, myTeam: number): Zone {
  const blue = myTeam === 100;
  const dBlue = Math.hypot(p.x, p.y), dRed = Math.hypot(MAXX - p.x, MAXY - p.y);
  if (dBlue < 4200) return blue ? "baseAlly" : "baseEnemy";
  if (dRed < 4200) return blue ? "baseEnemy" : "baseAlly";
  if (p.x < 2200 || p.y > 12800) return "top";
  if (p.y < 2200 || p.x > 12700) return "bot";
  if (Math.abs(p.x - p.y) < 1300) return "mid";
  const diag = p.x + p.y - (MAXX + MAXY) / 2; // 0 = linha do rio
  if (Math.abs(diag) < 1500) return p.x < p.y ? "riverTop" : "riverBot";
  const blueSide = diag < 0;
  return blueSide === blue ? "jungleAlly" : "jungleEnemy";
}
export const ZONE_LABEL: Record<Zone, string> = {
  baseAlly: "na sua base", baseEnemy: "na base deles", top: "na lane top", mid: "no mid", bot: "na lane bot",
  riverTop: "no rio top", riverBot: "no rio bot", jungleAlly: "na sua selva", jungleEnemy: "na selva inimiga",
};
const OBJ: Record<string, string> = { DRAGON: "Dragão", RIFTHERALD: "Arauto", BARON_NASHOR: "Barão", HORDE: "Vastilarvas", ATAKHAN: "Atakhan" };
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function analyze(game: any, tl: any, cat: Catalog, me: { gameName?: string; champ?: string }, bench: Bench | null, role: string | null): Review | null {
  const parts: any[] = game?.participants ?? [];
  const ids: any[] = game?.participantIdentities ?? [];
  if (!parts.length || !tl?.frames?.length) return null;
  const nameOf = (pid: number) => { const p = parts.find((x) => x.participantId === pid); return cat.byKey.get(p?.championId)?.name ?? `#${pid}`; };
  const gname = (me.gameName ?? "").toLowerCase();
  const idMe = ids.find((i) => (i.player?.gameName ?? i.player?.summonerName ?? "").toLowerCase() === gname)?.participantId
    ?? parts.find((p) => cat.byKey.get(p.championId)?.name === me.champ)?.participantId;
  const mine = parts.find((p) => p.participantId === idMe);
  if (!mine) return null;
  const myTeam = mine.teamId;
  const players: Player[] = parts.map((p) => ({ pid: p.participantId, champ: nameOf(p.participantId), team: p.teamId, me: p.participantId === idMe }));
  const allies = players.filter((p) => p.team === myTeam && !p.me).map((p) => p.pid);

  // posições a cada minuto e eventos
  const frames: Record<number, Pos>[] = tl.frames.map((f: any) => Object.fromEntries(Object.entries(f.participantFrames ?? {}).map(([k, v]: [string, any]) => [+k, { x: v.position?.x ?? 0, y: v.position?.y ?? 0 }])));
  const kills: Kill[] = [], objs: Obj[] = [], myWards: number[] = [];
  for (const f of tl.frames) for (const e of f.events ?? []) {
    const t = (e.timestamp ?? 0) / 1000;
    if (e.type === "CHAMPION_KILL") kills.push({ t, killer: e.killerId, victim: e.victimId, assists: e.assistingParticipantIds ?? [], pos: e.position ?? { x: 0, y: 0 } });
    else if (e.type === "ELITE_MONSTER_KILL") objs.push({ t, type: e.monsterType, team: parts.find((p) => p.participantId === e.killerId)?.teamId ?? 0 });
    else if (e.type === "WARD_PLACED" && e.creatorId === idMe) myWards.push(t);
  }
  const posAt = (pid: number, t: number): Pos | null => {
    const i = Math.floor(t / 60), a = frames[i]?.[pid], b = frames[i + 1]?.[pid];
    if (!a) return null; if (!b) return a;
    const w = t / 60 - i; return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
  };
  const deadAt = (pid: number, t: number) => kills.some((k) => k.victim === pid && t - k.t > 0 && t - k.t < 25);

  const st = mine.stats ?? {};
  const k = st.kills ?? 0, d = st.deaths ?? 0, a = st.assists ?? 0;
  // abates do time: pelas estatísticas finais (a timeline pode faltar evento); a timeline só se não tiver estatística
  const statKills = parts.filter((p) => p.teamId === myTeam).reduce((s, p) => s + (p.stats?.kills ?? 0), 0);
  const teamKills = Math.max(statKills, kills.filter((x) => players.find((p) => p.pid === x.killer)?.team === myTeam).length, k + a);
  const kp = teamKills ? (k + a) / teamKills : 0;
  const min = (game.gameDuration ?? (tl.frames.length - 1) * 60) / 60;

  const deaths: Death[] = kills.filter((x) => x.victim === idMe).map((x) => {
    const zone = zoneOf(x.pos, myTeam);
    const near = allies.filter((pid) => { if (deadAt(pid, x.t)) return false; const p = posAt(pid, x.t); return p && Math.hypot(p.x - x.pos.x, p.y - x.pos.y) < 2000; }).length;
    const o = objs.find((ob) => ob.t > x.t && ob.t - x.t < 90);
    return { t: x.t, zone, where: ZONE_LABEL[zone], killer: nameOf(x.killer), with: x.assists.map(nameOf), alliesNear: near,
      isolated: near === 0 && x.killer > 0, objective: o ? OBJ[o.type] ?? o.type : null, early: x.t < 14 * 60 };
  });

  // pontos fortes e fracos
  const good: string[] = [], bad: string[] = [];
  const ref = role && bench ? (bench[role]?.[mine ? nameOf(idMe) : ""] as any) : undefined;
  if (kp >= 0.55) good.push(`participação de abates alta (${a} assistências, ${Math.round(kp * 100)}% de KP)`);
  else if (kp < 0.4 && teamKills >= 10) bad.push(`participação de abates baixa (${Math.round(kp * 100)}% de KP): o time lutou sem você em boa parte das lutas`);
  const vsMin = (st.visionScore ?? 0) / min;
  if (ref?.vs) { if (vsMin >= ref.vs[0] * 1.1) good.push(`visão acima da média Mestre+ (${vsMin.toFixed(2)}/min vs ${ref.vs[0].toFixed(2)})`); else if (vsMin < ref.vs[0] * 0.85) bad.push(`visão abaixo da média Mestre+ (${vsMin.toFixed(2)}/min vs ${ref.vs[0].toFixed(2)})`); }
  const iso = deaths.filter((x) => x.isolated && /river|jungle/.test(x.zone));
  const objD = deaths.filter((x) => x.objective);
  const laneD = deaths.filter((x) => x.early && /bot|top|mid/.test(x.zone) && !x.isolated);
  const fightD = deaths.filter((x) => x.alliesNear >= 2 && x.with.length >= 2);

  const score: Record<FocusKey, number> = { mapa: iso.length * 2, objetivo: objD.length * 1.5, lane: laneD.length, luta: fightD.length, visao: bad.some((b) => b.startsWith("visão")) ? 1.5 : 0 };
  const top = (Object.entries(score) as [FocusKey, number][]).sort((x, y) => y[1] - x[1])[0];
  const focus = top && top[1] > 0 ? FOCUS[top[0]](deaths) : null;

  // texto no estilo de um coach: o que deu certo, onde morreu e por quê, e o que fazer
  const champ = nameOf(idMe);
  const parts1: string[] = [];
  if (good.length) parts1.push(`Você teve ${good.join(" e ")}.`);
  const key = (iso.length ? iso : objD.length ? objD : deaths).slice(0, 2);
  if (key.length) {
    const list = key.map((x) => `aos ${mmss(x.t)} ${x.where}${x.objective ? `, pouco antes do ${x.objective}` : ""}`).join(" e ");
    const whoL = [...new Set(key.flatMap((x) => [x.killer, ...x.with]))].slice(0, 3);
    const who = whoL.length > 1 ? `${whoL.slice(0, -1).join(", ")} e ${whoL[whoL.length - 1]}` : whoL[0] ?? "";
    parts1.push(`${d >= 4 ? "Mas suas mortes" : "Suas mortes"} (especialmente ${list}) ${key.every((x) => x.isolated) ? "vieram de avanços sem ninguém do seu time por perto" : key.some((x) => x.objective) ? "aconteceram na preparação do objetivo" : "aconteceram"}, contra ${who}.`);
  }
  if (bad.length) parts1.push(`Ponto a melhorar: ${bad.join("; ")}.`);
  if (focus && ROLE_TIP[role ?? ""]) parts1.push(ROLE_TIP[role ?? ""]!(focus.key));
  return { gameId: game.gameId, champ, role, win: !!st.win, min, k, d, a, kp, teamKills, players, frames, kills, objs, deaths, good, bad, focus, story: parts1.join(" ") };
}

/** Fecho da revisão pela sua rota: como o seu papel rende melhor, ligado ao foco. */
const ROLE_TIP: Record<string, ((f: FocusKey) => string) | undefined> = {
  sup: (f) => f === "mapa" || f === "objetivo"
    ? "Como sup de peel e cura, você rende atrás do time: na preparação de objetivo, deixe o jungle ou o top dar facecheck primeiro e ward em seguida."
    : "Como sup de peel e cura, o seu valor está em manter o carry vivo: posição atrás dele e cooldowns guardados pra quem entrar.",
  adc: () => "Como ADC, o seu dano depende de estar vivo no fim da luta: ande com o sup e entre depois do engage.",
  mid: () => "No mid, antes de rotacionar, empurre a wave e olhe onde está o jungle deles.",
  jg: () => "No jungle, planeje a rota pro objetivo com antecedência e chegue antes do time inimigo no rio.",
  top: () => "No top, use o teleporte ou a pressão do lado pra chegar nos objetivos sem entrar sozinho na névoa.",
};

const FOCUS: Record<FocusKey, (d: Death[]) => { key: FocusKey; title: string; text: string }> = {
  mapa: () => ({ key: "mapa", title: "Leitura de mapa", text: "Antes de entrar no rio ou na selva deles pra wardar, olhe o minimapa e espere a sua frontline ir junto. Se o engage ou o assassino deles está sem visão, não entre sozinha na névoa: deixe o jungle ou o top dar facecheck e ward logo atrás." }),
  objetivo: () => ({ key: "objetivo", title: "Preparação de objetivo", text: "Comece a preparar o objetivo uns 60 a 90 segundos antes, com o time: ward primeiro do seu lado do rio, limpe a deles com lente e só avance com alguém na frente." }),
  lane: () => ({ key: "lane", title: "Lane", text: "Na lane, respeite o nível e o tempo do jungle deles: recue quando o jungle sumir do mapa e não troque dano quando a wave está do lado deles." }),
  luta: () => ({ key: "luta", title: "Posicionamento em luta", text: "Nas lutas, fique atrás da sua frontline e do seu carry; guarde a sua ferramenta de peel pra quem entrar no seu time em vez de usar pra começar a luta." }),
  visao: () => ({ key: "visao", title: "Visão", text: "Compre controle a cada volta, troque pra lente quando tiver o item e ward antes de cada objetivo." }),
};

/** Padrão das últimas partidas: qual foco aparece mais. */
export function pattern(reviews: Review[]) {
  const c: Partial<Record<FocusKey, number>> = {};
  for (const r of reviews) if (r.focus) c[r.focus.key] = (c[r.focus.key] ?? 0) + 1;
  const top = (Object.entries(c) as [FocusKey, number][]).sort((a, b) => b[1] - a[1])[0];
  const iso = reviews.reduce((s, r) => s + r.deaths.filter((d) => d.isolated).length, 0), all = reviews.reduce((s, r) => s + r.deaths.length, 0);
  return top ? { key: top[0], n: top[1], of: reviews.length, title: FOCUS[top[0]]([]).title, isoPct: all ? iso / all : 0 } : null;
}
