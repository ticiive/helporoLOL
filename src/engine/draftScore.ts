/**
 * Recomendação só por dados (sem preferência pessoal): cada campeão da rota ganha nota em
 * Matchup (contra o oponente da rota; no sup também contra o ADC), Sinergia (com o parceiro),
 * Comp (o que falta no seu time e o que o time inimigo exige) e Meta (winrate Mestre+ BR).
 * Daí sai o tier do campeão NESTE draft (S a D) e as tags "bom contra / fraco contra / bom com".
 */
import { BOTS, JUNGLERS, MIDS, SUPPORTS, TOPS } from "./champions";
import { CC_ANSWER, PARTNER, ROLES, ccThreat, profile, type Counters, type Draft, type Role } from "./engine";
import { duo } from "./botlane";
import { mainDelta, ownVsAdc, ownWithAdc, supPickRates } from "./lanedata";
import { SCALING } from "./scaling";
import { norm } from "../lib/ddragon";
import type { Stats } from "../lib/stats";

type Flags = (n: string | null) => string;
export type Tier = "S" | "A" | "B" | "C" | "D";
export interface Tag { t: string; kind: "good" | "bad" | "info" }
export interface Card {
  name: string; tier: Tier; score: number;
  bars: { matchup: number; synergy: number; comp: number }; // 0-100
  pts: { matchup: number; synergy: number; comp: number; meta: number };
  tags: Tag[]; inPool: boolean; games: number;
}
const ROLE_SET: Record<Role, Set<string>> = { top: TOPS, jg: JUNGLERS, mid: MIDS, adc: BOTS, sup: SUPPORTS };
const shrink = (d: number, n: number, k: number) => (d * n) / (n + k);
const bar = (p: number) => Math.max(5, Math.min(95, Math.round(50 + p * 12)));

export function draftCards(o: {
  role: Role; draft: Draft; flags: Flags; counters: Counters | null; synergies: Counters | null;
  scaling?: typeof SCALING; pool: string[]; stats: Stats; exclude: string[]; main?: string; mainAvoid?: string[];
}): Card[] {
  const { role, draft, flags, counters, synergies, pool, stats } = o;
  const sc = o.scaling ?? SCALING;
  const curve = new Map(Object.entries(sc.champs).map(([k, v]) => [norm(k), v]));
  const cv = (n: string) => curve.get(norm(n));
  const overall = (n: string) => { const c = cv(n); return c ? c.wr.reduce((a, b) => a + b, 0) / c.wr.length : 50; };
  const A = draft.ally, E = draft.enemy;
  const taken = new Set([...ROLES.map((r) => A[r]), ...ROLES.map((r) => E[r]), ...draft.bans, ...o.exclude].filter(Boolean).map((x) => norm(x as string)));
  const allies = ROLES.filter((r) => r !== role).map((r) => A[r]).filter(Boolean) as string[];
  const enemies = ROLES.map((r) => E[r]).filter(Boolean) as string[];
  const pa = profile(allies, flags), pe = profile(enemies, flags);
  const cc = ccThreat(enemies, flags);
  const opp = E[role], partner = A[PARTNER[role]], ea = role === "sup" ? E.adc : null;
  // curva do time: o seu time escala ou ganha cedo? (sem você)
  const teamShift = (list: string[]) => list.reduce((a, n) => { const c = cv(n); return a + (c ? c.wr[4] - c.wr[0] : 0); }, 0);
  const lateNeed = teamShift(allies) - teamShift(enemies); // >0: vocês escalam melhor
  const gamesOf = (n: string) => { const c = stats[n]?.byRole[role]; return c ? c.w + c.l : 0; };
  const pr = role === "sup" ? supPickRates() : null;

  // 1ª passada: números crus de cada campeão
  interface Raw { name: string; fl: string; sup: number | null; adc: number | null; lane: number | null; blind: number | null; sy: number | null; c: ReturnType<typeof cv> }
  const raws: Raw[] = [];
  for (const name of ROLE_SET[role]) {
    if (taken.has(norm(name))) continue;
    const r: Raw = { name, fl: flags(name), sup: null, adc: null, lane: null, blind: null, sy: null, c: cv(name) };
    if (role === "sup") {
      if (E.sup) { const m = mainDelta(name, E.sup); if (m.n >= 100) r.sup = m.d; }
      else if (pr) {
        let s = 0, w = 0;
        for (const [c2, p] of pr) { if (taken.has(norm(c2)) || norm(c2) === norm(name)) continue; const m = mainDelta(name, c2); if (m.n >= 100) { s += p * m.d; w += p; } }
        if (w) r.blind = s / w;
      }
      if (ea) { const x = ownVsAdc(name, ea); if (x && x.n >= 40) r.adc = shrink(x.wr - x.base, x.n, 150); }
    } else if (opp && counters?.[role]?.[opp]) {
      const x = counters[role][opp].find((y) => y[0] === name);
      if (x) r.lane = shrink(x[1] - overall(name), x[2], 200);
    }
    if (partner) {
      if (role === "sup") {
        const du = duo(partner, name);
        if (du && du.n >= 200) r.sy = shrink(du.delta, du.n, 500);
        else { const w = ownWithAdc(name, partner); if (w && w.n >= 40) r.sy = shrink(w.wr - w.base, w.n, 150); }
      } else {
        const x = synergies?.[role]?.[partner]?.find((y) => y[0] === name);
        if (x && x[2] >= 30) r.sy = shrink(x[1] - overall(name), x[2], 200);
      }
    }
    if (!r.c && r.sup === null && r.adc === null && r.lane === null && r.sy === null) continue; // sem dado
    raws.push(r);
  }
  // 2ª passada: centra cada confronto na média dos candidatos. Se o oponente é fraco no meta,
  // todo mundo ganha dele; o que importa pra escolher é quem ganha MAIS que os outros.
  const center = (k: "sup" | "adc" | "lane" | "blind" | "sy") => {
    const v = raws.map((r) => r[k]).filter((x): x is number => x !== null);
    const m = v.length >= 4 ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    for (const r of raws) if (r[k] !== null) r[k] = r[k]! - m;
  };
  (["sup", "adc", "lane", "blind", "sy"] as const).forEach(center);

  const cards: Card[] = [];
  for (const r of raws) {
    const { name, fl, c } = r;
    const tags: Tag[] = [];
    let mu = 0;
    if (r.sup !== null) { mu += r.sup; if (r.sup >= 1) tags.push({ kind: "good", t: `Bom contra ${E.sup}` }); else if (r.sup <= -1) tags.push({ kind: "bad", t: `Fraco contra ${E.sup}` }); }
    if (r.blind !== null) { mu += r.blind; if (r.blind >= 0.6) tags.push({ kind: "good", t: "Seguro de blind" }); else if (r.blind <= -0.6) tags.push({ kind: "bad", t: "Arriscado de blind" }); }
    if (r.adc !== null) { mu += r.adc; if (r.adc >= 1) tags.push({ kind: "good", t: `Bom contra ${ea} (ADC)` }); else if (r.adc <= -1) tags.push({ kind: "bad", t: `Fraco contra ${ea} (ADC)` }); }
    if (r.lane !== null) { mu += r.lane; if (r.lane >= 1) tags.push({ kind: "good", t: `Bom contra ${opp}` }); else if (r.lane <= -1) tags.push({ kind: "bad", t: `Fraco contra ${opp}` }); }
    const sy = r.sy ?? 0;
    if (partner) { if (sy >= 0.8) tags.push({ kind: "good", t: `Bom com ${partner}` }); else if (sy <= -0.8) tags.push({ kind: "bad", t: `Fraco com ${partner}` }); }
    // Comp (o que o seu time precisa e o que o inimigo exige)
    let cp = 0;
    const add = (v: number, t: string) => { cp += v; tags.push({ kind: v >= 0 ? "good" : "bad", t }); };
    if (cc.level === 2 && role === "sup" && CC_ANSWER[name] !== undefined && Math.abs(CC_ANSWER[name]) >= 0.5) add(CC_ANSWER[name], CC_ANSWER[name] > 0 ? "Responde ao CC deles" : "Sem resposta ao CC deles");
    if (cc.level === 2 && fl.includes("N")) add(1, "Escudo contra o CC deles");
    if (pa.n >= 3) {
      if (pa.ap < 0.6 && fl.includes("P") && !fl.includes("A")) add(1, "Dano mágico que falta");
      if (pa.ad < 0.6 && fl.includes("A") && !fl.includes("P")) add(1, "Dano físico que falta");
      if (pa.F === 0 && fl.includes("F")) add(1, "Frontline que falta");
      if (pa.E === 0 && fl.includes("E")) add(0.7, "Engage que falta");
    }
    if (pe.DX >= 2 && fl.includes("R")) add(0.8, "Peel contra o dive deles");
    if (pe.F >= 3 && /[YK]/.test(fl) && !fl.includes("F")) add(0.5, "Bom contra tanques");
    if (c && enemies.length + allies.length >= 4) {
      const g = c.wr[4] - c.wr[0];
      if (lateNeed > 4 && g >= 3) add(0.8, "Escala junto com o time");
      if (lateNeed < -4 && g <= -3) add(0.8, "Forte cedo: pune o scaling deles");
      if (lateNeed < -4 && g >= 5) add(-0.6, "Escala, mas o jogo deles é mais longo");
    }
    const meta = c ? shrink(overall(name) - 50, c.n, 1500) : 0;
    if (meta >= 1.2) tags.push({ kind: "info", t: `Forte no meta (${overall(name).toFixed(1)}%)` });
    const games = gamesOf(name);
    const inPool = pool.includes(name) || games >= 3;
    tags.unshift({ kind: "info", t: games >= 20 ? `Seu main (${games} jogos)` : inPool ? "No seu pool" : "Fora do pool" });
    if (o.main && name === o.main && o.mainAvoid) {
      const bl = enemies.filter((e) => o.mainAvoid!.some((a) => norm(a) === norm(e)));
      if (bl.length) tags.push({ kind: "bad", t: `Sua regra: não joga contra ${bl.join(", ")}` });
    }
    const score = mu + 0.8 * sy + cp + 0.6 * meta;
    cards.push({ name, tier: "C", score, bars: { matchup: bar(mu), synergy: bar(sy), comp: bar(cp) }, pts: { matchup: mu, synergy: sy, comp: cp, meta }, tags, inPool, games });
  }
  cards.sort((a, b) => b.score - a.score);
  // tier relativo aos campeões da rota neste draft
  cards.forEach((cd, i) => { const q = i / Math.max(1, cards.length); cd.tier = q < 0.08 ? "S" : q < 0.25 ? "A" : q < 0.55 ? "B" : q < 0.8 ? "C" : "D"; });
  return cards;
}
