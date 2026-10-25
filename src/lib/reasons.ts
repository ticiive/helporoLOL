/**
 * Por que a partida foi perdida (ou ganha): olha o jogo inteiro, não só as suas mortes.
 * Curva de ouro do time e onde a vantagem virou, qual lane perdeu e por quanto, quem do time inimigo
 * ficou forte, quais lutas decidiram (e quem morreu primeiro nelas), objetivos, mortes antes de objetivo,
 * gank no early, e os seus números (visão, KP, dano, CS, nível) comparados com a média Mestre+.
 * Tudo da API local do cliente: estatísticas dos 10 jogadores e a timeline minuto a minuto.
 */
import type { Catalog } from "./ddragon";
import type { Bench } from "./builds";
import { zoneOf, ZONE_LABEL } from "./review";

export interface Reason {
  id: string; scope: "time" | "voce"; good: boolean; weight: number;
  title: string; detail: string; t?: number; // t: minuto do jogo (s) pra pular no replay
}
type Role = "top" | "jg" | "mid" | "adc" | "sup";
const RN: Record<Role, string> = { top: "top", jg: "jungle", mid: "mid", adc: "ADC", sup: "sup" };
const SUP_ITEMS = new Set([3865, 3866, 3867, 3869, 3870, 3871, 3876, 3877]);
const OBJ: Record<string, string> = { DRAGON: "dragão", RIFTHERALD: "Arauto", BARON_NASHOR: "Barão", HORDE: "vastilarvas", ELDER_DRAGON: "Ancião" };
const br = (n: number, d = 1) => n.toFixed(d).replace(".", ",");
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const k1 = (n: number) => (Math.abs(n) >= 1000 ? `${br(n / 1000, 1)} mil` : `${Math.round(n)}`);
const sign = (n: number) => (n > 0 ? `+${k1(n)}` : `-${k1(-n)}`);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function reasons(game: any, tl: any, cat: Catalog, idMe: number, bench: Bench | null, myRoleHint: string | null): Reason[] {
  const parts: any[] = game.participants ?? [];
  const frames: any[] = tl.frames ?? [];
  const me = parts.find((p) => p.participantId === idMe);
  if (!me || frames.length < 5) return [];
  const myTeam = me.teamId, enemyTeam = myTeam === 100 ? 200 : 100;
  const name = (pid: number) => cat.byKey.get(parts.find((p) => p.participantId === pid)?.championId)?.name ?? `#${pid}`;
  const teamOf = (pid: number) => parts.find((p) => p.participantId === pid)?.teamId ?? 0;
  const won = !!me.stats?.win;
  const min = (game.gameDuration ?? (frames.length - 1) * 60) / 60;

  // rota de cada um: Smite = jungle, item de sup = sup, senão a lane do cliente
  const roleOf = (p: any): Role => {
    const items = [0, 1, 2, 3, 4, 5, 6].map((i) => Number(p.stats?.[`item${i}`] ?? 0));
    if (p.spell1Id === 11 || p.spell2Id === 11) return "jg";
    if (items.some((i) => SUP_ITEMS.has(i)) || /SUPPORT/.test(p.timeline?.role ?? "")) return "sup";
    const l = p.timeline?.lane ?? "";
    return l.startsWith("TOP") ? "top" : l.startsWith("MID") ? "mid" : l.startsWith("JUN") ? "jg" : "adc";
  };
  const role = new Map<number, Role>(parts.map((p) => [p.participantId, roleOf(p)]));
  const myRole = (myRoleHint as Role) ?? role.get(idMe)!;
  const opponent = (pid: number) => parts.find((p) => p.teamId !== teamOf(pid) && role.get(p.participantId) === role.get(pid))?.participantId;

  // ouro e nível por minuto
  const g = (pid: number, m: number) => frames[Math.min(m, frames.length - 1)]?.participantFrames?.[pid]?.totalGold as number | undefined;
  const lv = (pid: number, m: number) => frames[Math.min(m, frames.length - 1)]?.participantFrames?.[pid]?.level as number | undefined;
  const teamGold = (team: number, m: number) => parts.filter((p) => p.teamId === team).reduce((s, p) => s + (g(p.participantId, m) ?? 0), 0);
  const diff = frames.map((_, m) => teamGold(myTeam, m) - teamGold(enemyTeam, m));
  const hasGold = diff.some((x) => x !== 0);

  // eventos
  type K = { t: number; killer: number; victim: number; assists: number[]; pos: { x: number; y: number } };
  const kills: K[] = [], objs: { t: number; type: string; team: number }[] = [], towers: { t: number; team: number }[] = [];
  for (const f of frames) for (const e of f.events ?? []) {
    const t = (e.timestamp ?? 0) / 1000;
    if (e.type === "CHAMPION_KILL") kills.push({ t, killer: e.killerId, victim: e.victimId, assists: e.assistingParticipantIds ?? [], pos: e.position ?? { x: 7400, y: 7400 } });
    else if (e.type === "ELITE_MONSTER_KILL") objs.push({ t, type: e.monsterSubType === "ELDER_DRAGON" ? "ELDER_DRAGON" : e.monsterType, team: e.killerTeamId ?? teamOf(e.killerId) });
    else if (e.type === "BUILDING_KILL" && e.buildingType === "TOWER_BUILDING") towers.push({ t, team: e.teamId === myTeam ? enemyTeam : myTeam }); // teamId = dono da torre
  }
  const R: Reason[] = [];
  const push = (r: Reason) => R.push(r);

  // ---------- 1. curva de ouro: atrás desde cedo, vantagem jogada fora, virada ----------
  if (hasGold) {
    const at = (m: number) => diff[Math.min(m, diff.length - 1)];
    let maxI = 0, minI = 0;
    diff.forEach((v, i) => { if (v > diff[maxI]) maxI = i; if (v < diff[minI]) minI = i; });
    // maior queda em janela de 5 min
    let drop = 0, dropAt = 0;
    for (let i = 5; i < diff.length; i++) { const d = diff[i] - diff[i - 5]; if (d < drop) { drop = d; dropAt = i; } }
    let rise = 0, riseAt = 0;
    for (let i = 5; i < diff.length; i++) { const d = diff[i] - diff[i - 5]; if (d > rise) { rise = d; riseAt = i; } }
    if (!won && diff[maxI] >= 2500 && maxI >= 8) push({ id: "throw", scope: "time", good: false, weight: 10, t: (dropAt - 5) * 60,
      title: "Vantagem jogada fora", detail: `Vocês chegaram a ${sign(diff[maxI])} de ouro aos ${maxI} min e perderam. A maior virada foi entre ${dropAt - 5} e ${dropAt} min (${sign(drop)}).` });
    else if (!won && at(15) <= -2000) push({ id: "early", scope: "time", good: false, weight: 8, t: 10 * 60,
      title: "Jogo perdido cedo", detail: `Aos 15 min vocês já estavam ${sign(at(15))} de ouro${at(10) < -500 ? ` (${sign(at(10))} aos 10)` : ""}. O early decidiu: dá pra ver abaixo qual lane e quais lutas.` });
    else if (!won && Math.abs(at(15)) < 2000 && drop <= -2500) push({ id: "swing", scope: "time", good: false, weight: 8, t: (dropAt - 5) * 60,
      title: "Jogo equilibrado que virou num momento", detail: `Até os 15 estava parelho (${sign(at(15))}). Entre ${dropAt - 5} e ${dropAt} min vocês perderam ${k1(-drop)} de ouro, e não voltou mais.` });
    if (won && diff[minI] <= -2500 && minI >= 8) push({ id: "comeback", scope: "time", good: true, weight: 7, t: (riseAt - 5) * 60,
      title: "Virada", detail: `Vocês estiveram ${sign(diff[minI])} aos ${minI} min e viraram, principalmente entre ${riseAt - 5} e ${riseAt} min (${sign(rise)}).` });
    else if (won && at(15) >= 2000) push({ id: "earlywin", scope: "time", good: true, weight: 6, t: 10 * 60,
      title: "Early forte", detail: `Aos 15 min vocês estavam ${sign(at(15))} de ouro e converteram.` });
  }

  // ---------- 2. lanes aos 15: quem perdeu a lane e por quanto ----------
  const lanes = (["top", "mid", "adc", "sup", "jg"] as Role[]).map((r) => {
    const a = parts.find((p) => p.teamId === myTeam && role.get(p.participantId) === r)?.participantId;
    const b = a ? opponent(a) : undefined;
    if (!a || !b) return null;
    const d15 = (g(a, 15) ?? 0) - (g(b, 15) ?? 0), lv15 = (lv(a, 15) ?? 0) - (lv(b, 15) ?? 0);
    const kd = kills.filter((x) => x.t < 15 * 60 && x.killer === b && x.victim === a).length;
    return { r, a, b, d15, lv15, kd };
  }).filter(Boolean) as { r: Role; a: number; b: number; d15: number; lv15: number; kd: number }[];
  if (hasGold && frames.length > 15) {
    const bot = (x: { r: Role }) => x.r === "adc" || x.r === "sup";
    const botD = lanes.filter(bot).reduce((s, x) => s + x.d15, 0);
    const worst = [...lanes].filter((x) => !bot(x)).sort((x, y) => x.d15 - y.d15)[0];
    if (worst && worst.d15 <= -1200) push({ id: `lane-${worst.r}`, scope: "time", good: false, weight: worst.d15 <= -2500 ? 7 : 5, t: 8 * 60,
      title: `${RN[worst.r][0].toUpperCase() + RN[worst.r].slice(1)} perdeu a lane`, detail: `${name(worst.a)} chegou aos 15 min com ${sign(worst.d15)} de ouro contra ${name(worst.b)}${worst.lv15 <= -2 ? ` e ${-worst.lv15} níveis atrás` : ""}${worst.kd ? `, com ${worst.kd} morte(s) pra ele` : ""}.` });
    if (botD <= -1200) push({ id: "lane-bot", scope: myRole === "sup" || myRole === "adc" ? "voce" : "time", good: false, weight: botD <= -2500 ? 7 : 5, t: 6 * 60,
      title: "Bot perdeu a lane", detail: `A dupla do bot chegou aos 15 min com ${sign(botD)} de ouro contra ${lanes.filter(bot).map((x) => name(x.b)).join(" e ")}.` });
    if (botD >= 1200 && (myRole === "sup" || myRole === "adc")) push({ id: "lane-bot-good", scope: "voce", good: true, weight: 4, t: 6 * 60,
      title: "Bot ganhou a lane", detail: `Vocês chegaram aos 15 min com ${sign(botD)} de ouro no bot.` });
  }

  // ---------- 3. inimigo que carregou ----------
  const enemyStats = parts.filter((p) => p.teamId === enemyTeam).map((p) => ({ pid: p.participantId, k: p.stats?.kills ?? 0, d: p.stats?.deaths ?? 0, a: p.stats?.assists ?? 0 }));
  const carry = enemyStats.sort((x, y) => (y.k * 2 + y.a - y.d) - (x.k * 2 + x.a - x.d))[0];
  if (!won && carry && carry.k >= 8 && carry.k >= 2 * Math.max(1, carry.d)) {
    const fed = kills.filter((x) => x.killer === carry.pid && x.t < 15 * 60);
    const who = new Map<number, number>(); fed.forEach((x) => who.set(x.victim, (who.get(x.victim) ?? 0) + 1));
    const top = [...who.entries()].sort((a, b) => b[1] - a[1])[0];
    push({ id: "fed", scope: "time", good: false, weight: 7, t: fed[0]?.t,
      title: `${name(carry.pid)} carregou o time deles`, detail: `Terminou ${carry.k}/${carry.d}/${carry.a}${fed.length ? `; ${fed.length} abate(s) antes dos 15 min` : ""}${top ? `, ${top[1]} em cima do ${name(top[0])}` : ""}. Contra esse campeão: visão no lado dele e não lutar sem o seu carry inteiro.` });
  }

  // ---------- 4. lutas que decidiram ----------
  const fights: { t: number; end: number; ours: number; theirs: number; first: K; zone: string }[] = [];
  const sorted = [...kills].sort((a, b) => a.t - b.t);
  for (let i = 0; i < sorted.length;) {
    let j = i; while (j + 1 < sorted.length && sorted[j + 1].t - sorted[j].t <= 15) j++;
    const grp = sorted.slice(i, j + 1);
    if (grp.length >= 3) {
      const ours = grp.filter((x) => teamOf(x.killer) === myTeam).length;
      fights.push({ t: grp[0].t, end: grp[grp.length - 1].t, ours, theirs: grp.length - ours, first: grp[0], zone: ZONE_LABEL[zoneOf(grp[0].pos, myTeam)] });
    }
    i = j + 1;
  }
  const lost = fights.filter((f) => f.theirs - f.ours >= 2).sort((a, b) => (b.theirs - b.ours) - (a.theirs - a.ours) || b.t - a.t);
  const after = (f: { end: number }) => objs.find((o) => o.team === enemyTeam && o.t > f.end && o.t - f.end < 90);
  for (const f of lost.slice(0, 2)) {
    const ob = after(f), firstMine = teamOf(f.first.victim) === myTeam;
    push({ id: `fight-${Math.round(f.t)}`, scope: "time", good: false, weight: f.t > 20 * 60 ? 8 : 6, t: Math.max(0, f.t - 20),
      title: `Luta perdida aos ${mmss(f.t)} ${f.zone}`, detail: `${f.ours} x ${f.theirs} em abates.${firstMine ? ` A primeira morte foi de ${name(f.first.victim)}${f.first.victim === idMe ? " (você)" : ""}, então vocês lutaram com um a menos.` : ""}${ob ? ` Logo depois eles pegaram ${OBJ[ob.type] ?? ob.type}.` : ""}` });
  }
  const firstInLost = lost.filter((f) => f.first.victim === idMe).length;
  if (firstInLost >= 2) push({ id: "first-death", scope: "voce", good: false, weight: 7, t: lost.find((f) => f.first.victim === idMe)!.t - 20,
    title: "Você morreu primeiro nas lutas perdidas", detail: `Em ${firstInLost} das ${lost.length} lutas que o time perdeu, a primeira morte foi a sua. Sem você o time luta com um a menos e sem cura/peel: entre depois da frontline e fique fora do alcance do engage.` });
  const wonF = fights.filter((f) => f.ours - f.theirs >= 2);
  if (won && wonF.length) { const f = wonF.sort((a, b) => b.t - a.t)[0]; push({ id: "fight-won", scope: "time", good: true, weight: 5, t: f.t - 20, title: `Luta decisiva aos ${mmss(f.t)}`, detail: `${f.ours} x ${f.theirs} ${f.zone}.` }); }

  // ---------- 5. objetivos ----------
  const cnt = (team: number, type: string) => objs.filter((o) => o.team === team && o.type === type).length;
  const dE = cnt(enemyTeam, "DRAGON"), dA = cnt(myTeam, "DRAGON"), bE = cnt(enemyTeam, "BARON_NASHOR"), bA = cnt(myTeam, "BARON_NASHOR");
  const gE = cnt(enemyTeam, "HORDE"), gA = cnt(myTeam, "HORDE"), hE = cnt(enemyTeam, "RIFTHERALD"), tE = towers.filter((x) => x.team === enemyTeam).length, tA = towers.length - tE;
  if (!won && (dE - dA >= 2 || bE > bA || dE >= 4)) push({ id: "objs", scope: "time", good: false, weight: dE >= 4 || bE ? 7 : 5,
    title: dE >= 4 ? "Eles pegaram a alma do dragão" : bE > bA ? "Barão deles" : "Dragões pra eles", detail: `Dragões ${dA} x ${dE}, Barão ${bA} x ${bE}, vastilarvas ${gA} x ${gE}${hE ? ", Arauto pra eles" : ""}, torres ${tA} x ${tE}.` });
  if (won && (dA - dE >= 2 || bA > bE)) push({ id: "objs-good", scope: "time", good: true, weight: 4, title: "Controle de objetivos", detail: `Dragões ${dA} x ${dE}, Barão ${bA} x ${bE}, torres ${tA} x ${tE}.` });
  // mortes do time logo antes de objetivo entregue
  const conceded = objs.filter((o) => o.team === enemyTeam && o.type !== "HORDE").map((o) => ({ o, deaths: kills.filter((x) => teamOf(x.victim) === myTeam && x.t < o.t && o.t - x.t <= 60) }))
    .filter((x) => x.deaths.length >= 2 && !lost.slice(0, 2).some((f) => x.o.t > f.end && x.o.t - f.end < 90));
  if (conceded.length) { const c = conceded.sort((a, b) => b.deaths.length - a.deaths.length)[0]; push({ id: "obj-deaths", scope: "time", good: false, weight: 6, t: c.deaths[0].t - 15,
    title: `Mortes antes do ${OBJ[c.o.type] ?? c.o.type}`, detail: `Aos ${mmss(c.o.t)} eles fizeram ${OBJ[c.o.type] ?? c.o.type} logo depois de ${c.deaths.length} mortes de vocês (${c.deaths.map((x) => name(x.victim)).join(", ")}). Isso aconteceu ${conceded.length} vez(es) na partida.` }); }
  // pegos sozinhos no late
  const lateCatch = kills.filter((x) => teamOf(x.victim) === myTeam && x.t > 22 * 60 && !kills.some((y) => y !== x && Math.abs(y.t - x.t) <= 15));
  if (lateCatch.length >= 2) push({ id: "catches", scope: "time", good: false, weight: 5, t: lateCatch[0].t - 15,
    title: "Gente pega sozinha no late", detail: `${lateCatch.length} mortes isoladas depois dos 22 min (${[...new Set(lateCatch.map((x) => name(x.victim)))].join(", ")}). No late cada morte vira objetivo.` });

  // ---------- 6. você ----------
  const st = me.stats ?? {};
  const ref = bench?.[myRole]?.[name(idMe)] as any;
  const teamK = parts.filter((p) => p.teamId === myTeam).reduce((s, p) => s + (p.stats?.kills ?? 0), 0);
  const kp = teamK ? ((st.kills ?? 0) + (st.assists ?? 0)) / teamK : 0;
  const myDeaths = kills.filter((x) => x.victim === idMe);
  const d10 = (10 * (st.deaths ?? myDeaths.length)) / min;
  if (ref?.d10 && d10 > ref.d10[0] + 0.5 * ref.d10[1]) push({ id: "deaths", scope: "voce", good: false, weight: 6, t: myDeaths[0]?.t,
    title: "Mortes demais", detail: `${st.deaths ?? myDeaths.length} mortes (${br(d10, 1)} a cada 10 min; a média Mestre+ de ${name(idMe)} é ${br(ref.d10[0], 1)}).` });
  else if (!ref && (st.deaths ?? 0) >= 8) push({ id: "deaths", scope: "voce", good: false, weight: 6, t: myDeaths[0]?.t, title: "Mortes demais", detail: `${st.deaths} mortes na partida.` });
  const ej = parts.find((p) => p.teamId === enemyTeam && role.get(p.participantId) === "jg")?.participantId;
  const ganked = myDeaths.filter((x) => x.t < 14 * 60 && ej && (x.killer === ej || x.assists.includes(ej)));
  if (ganked.length >= 2) push({ id: "ganks", scope: "voce", good: false, weight: 6, t: ganked[0].t - 20,
    title: `O ${name(ej!)} te pegou no early`, detail: `${ganked.length} das suas mortes antes dos 14 min tiveram o jungle deles (${ganked.map((x) => mmss(x.t)).join(", ")}). Tenha visão no rio/tribush e recue quando ele sumir do mapa.` });
  if (kp >= 0.6) push({ id: "kp", scope: "voce", good: true, weight: 3, title: "Presente nas lutas", detail: `${Math.round(kp * 100)}% de participação em abates.` });
  else if (kp < 0.4 && teamK >= 12) push({ id: "kp", scope: "voce", good: false, weight: 4, title: "Fora das lutas", detail: `Só ${Math.round(kp * 100)}% de participação em abates: o time lutou várias vezes sem você.` });
  const vs = (st.visionScore ?? 0) / min;
  if (ref?.vs) { if (vs < ref.vs[0] * 0.85) push({ id: "vision", scope: "voce", good: false, weight: myRole === "sup" ? 5 : 3, title: "Visão abaixo da média", detail: `${br(vs, 2)} de visão por minuto; a média Mestre+ de ${name(idMe)} é ${br(ref.vs[0], 2)}.` });
    else if (vs > ref.vs[0] * 1.15) push({ id: "vision", scope: "voce", good: true, weight: 3, title: "Boa visão", detail: `${br(vs, 2)} por minuto (média Mestre+ ${br(ref.vs[0], 2)}).` }); }
  const cw = st.visionWardsBoughtInGame;
  if (myRole === "sup" && typeof cw === "number" && (10 * cw) / min < 0.7) push({ id: "control", scope: "voce", good: false, weight: 4, title: "Poucas wards de controle", detail: `${cw} na partida; o ideal no sup é comprar a cada volta (uns ${Math.round(min / 8)} numa partida de ${Math.round(min)} min).` });
  const myDmg = st.totalDamageDealtToChampions ?? 0, teamDmg = parts.filter((p) => p.teamId === myTeam).reduce((s, p) => s + (p.stats?.totalDamageDealtToChampions ?? 0), 0);
  // dano em campeões por minuto contra a média Mestre+/D1 BR do mesmo campeão na mesma rota
  const dpm = myDmg / min, share = teamDmg ? Math.round((100 * myDmg) / teamDmg) : null;
  const enchanter = myRole === "sup" && ["Soraka", "Sona", "Nami", "Janna", "Lulu", "Milio", "Yuumi", "Karma", "Seraphine", "Renata Glasc", "Taric"].includes(name(idMe));
  if (ref?.dmg && myDmg > 0) {
    const [m, sd] = ref.dmg, z = sd > 0 ? (dpm - m) / sd : 0, pct = Math.round((100 * (dpm - m)) / m);
    const base = `${Math.round(dpm)} de dano por minuto${share !== null ? ` (${share}% do time)` : ""}; a média Mestre+ de ${name(idMe)} ${RN[myRole]} é ${Math.round(m)}`;
    if (z <= -0.6) push({ id: "dmg", scope: "voce", good: false, weight: enchanter ? 2 : myRole === "mid" || myRole === "adc" ? 6 : 4,
      title: "Dano abaixo da média", detail: `${base} (${pct}%).${enchanter ? " Na sua champ o dano pesa menos que cura e peel, mas pouco dano costuma vir de pouco tempo vivo na luta ou de não usar a poke na lane." : " Veja se foi tempo morto, farm atrasado ou ficar longe das lutas."}` });
    else if (z >= 0.6) push({ id: "dmg", scope: "voce", good: true, weight: 3, title: "Dano acima da média", detail: `${base} (+${pct}%).` });
    else push({ id: "dmg", scope: "voce", good: true, weight: 1, title: "Dano dentro da média", detail: `${base}. Não foi o dano.` });
  } else if ((myRole === "mid" || myRole === "adc") && share !== null && share < 18) push({ id: "dmg", scope: "voce", good: false, weight: 4, title: "Pouco dano pra sua rota", detail: `${share}% do dano do time (sem média Mestre+ desse campeão ainda).` });
  const cs = (st.totalMinionsKilled ?? 0) + (st.neutralMinionsKilled ?? 0);
  if (myRole !== "sup" && ref?.cs && cs / min < ref.cs[0] - 0.8) push({ id: "cs", scope: "voce", good: false, weight: 4, title: "Farm baixo", detail: `${br(cs / min, 1)} CS/min; a média Mestre+ é ${br(ref.cs[0], 1)}.` });
  const opp = opponent(idMe);
  if (opp && frames.length > 10) { const dl = (lv(idMe, 10) ?? 0) - (lv(opp, 10) ?? 0); if (dl <= -2) push({ id: "level", scope: "voce", good: false, weight: 4, t: 8 * 60, title: "Atrás em nível", detail: `Aos 10 min você estava ${-dl} níveis atrás do ${name(opp)}. No sup isso costuma vir de mortes e de voltar pra base na hora errada.` }); }
  const heal = st.totalHealsOnTeammates ?? st.totalUnitsHealed ?? null;
  if (myRole === "sup" && typeof st.totalHealsOnTeammates === "number" && ref?.hs) { const hs = (st.totalHealsOnTeammates + (st.totalDamageShieldedOnTeammates ?? 0)) / min; if (hs > ref.hs[0] * 1.15) push({ id: "heal", scope: "voce", good: true, weight: 3, title: "Muita cura/escudo no time", detail: `${Math.round(hs)} por minuto (média Mestre+ ${Math.round(ref.hs[0])}).` }); }
  void heal;
  return R.sort((a, b) => b.weight - a.weight);
}
