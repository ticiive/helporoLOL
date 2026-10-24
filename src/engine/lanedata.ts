/**
 * Dados próprios da lane do sup (Mestre+/D1 BR, model/lane.py): sup contra sup, contra ADC e com ADC,
 * em winrate e ouro aos 15. Também dá o pickrate de cada sup, base do blind e da sugestão de ban.
 */
import { LANE_SNAP, type LaneData, type LaneRow } from "./lanesnap";
import { norm } from "../lib/ddragon";
import { SUPVS, SUP_BASE } from "./botlane";

let D: LaneData = LANE_SNAP;
let byNorm = new Map<string, string>();
const reindex = () => { byNorm = new Map(Object.keys(D.sup).map((k) => [norm(k), k])); };
reindex();
export function setLaneData(d: LaneData | null) { if (d?.sup && Object.keys(d.sup).length > 20) { D = d; reindex(); } }
const key = (n: string) => byNorm.get(norm(n)) ?? n;

export interface LaneStat { wr: number; n: number; gd: number | null; ng: number; base: number; baseGd: number }
function row(sup: string, kind: "vsSup" | "vsAdc" | "withAdc", c: string): LaneStat | null {
  const s = D.sup[key(sup)]; if (!s) return null;
  const r: LaneRow | undefined = s[kind][key(c)] ?? s[kind][c];
  return r ? { gd: r[0], ng: r[1], wr: r[2], n: r[3], base: s.wr, baseGd: s.gd } : null;
}
export const ownVsSup = (sup: string, c: string) => row(sup, "vsSup", c);
export const ownVsAdc = (sup: string, c: string) => row(sup, "vsAdc", c);
export const ownWithAdc = (sup: string, c: string) => row(sup, "withAdc", c);
export const laneCheck = () => D.check;

/** Fração dos jogos de sup em que cada campeão aparece. Vem do op.gg: a nossa coleta prioriza os seus sups e distorceria. */
export function supPickRates(): Map<string, number> {
  const games = Object.entries(SUPVS).map(([c, m]) => [c, Object.values(m).reduce((a, r) => a + r[1], 0)] as [string, number]);
  const tot = games.reduce((a, [, n]) => a + n, 0) || 1;
  return new Map(games.map(([c, n]) => [c, n / tot]));
}

/** Quanto a main ganha ou perde contra um sup (pontos de winrate vs a média dela), juntando a nossa coleta e o op.gg. */
export function mainDelta(main: string, c: string) {
  const o = ownVsSup(main, c);
  const g = SUPVS[main]?.[c];
  const no = o ? o.n : 0, ng = g ? g[1] * 0.5 : 0; // op.gg (Esmeralda+) vale meio jogo
  const dO = o ? o.wr - o.base : 0, dG = g ? g[0] - (SUP_BASE[main] ?? 50) : 0;
  const n = no + ng;
  return { d: n ? (dO * no + dG * ng) / (n + 200) : 0, n: Math.round(no + (g ? g[1] : 0)) };
}

/** Quanto um sup inimigo machuca a sua main: 1 = bloqueado ou bem ruim, 0,5 = ruim, 0 = ok. */
function harm(main: string, c: string, avoid: string[]) {
  if (avoid.some((a) => norm(a) === norm(c))) return 1;
  const { d } = mainDelta(main, c);
  return d <= -2 ? 1 : d <= -1 ? 0.5 : 0;
}

/**
 * Chance de o sup inimigo escondido ser um que pune a sua main, considerando quem já foi banido ou pickado
 * (eles não podem mais vir). É o que decide se dá pra blindar.
 */
export function blindDanger(main: string, avoid: string[], gone: string[]) {
  const pr = supPickRates();
  const out = new Set(gone.map(norm));
  let tot = 0, bad = 0;
  const worst: [string, number][] = [];
  for (const [c, p] of pr) {
    if (norm(c) === norm(main) || out.has(norm(c))) continue;
    const h = harm(main, c, avoid);
    tot += p; bad += p * h;
    if (h > 0) worst.push([c, p * h]);
  }
  worst.sort((a, b) => b[1] - a[1]);
  return { risk: tot ? bad / tot : 0, likely: worst.slice(0, 3).map(([c]) => c) };
}

/** Sugestão de ban pro sup: quem mais tira da sua main, pesado por quanto aparece. */
export function supBans(main: string, avoid: string[], gone: string[], n = 3) {
  const pr = supPickRates();
  const out = new Set(gone.map(norm));
  const rows: { name: string; why: string; score: number }[] = [];
  for (const [c, p] of pr) {
    if (norm(c) === norm(main) || out.has(norm(c))) continue;
    const blocked = avoid.some((a) => norm(a) === norm(c));
    const md = mainDelta(main, c);
    const loss = Math.max(0, -md.d);
    const score = p * (blocked ? 4 : loss);
    if (score <= 0) continue;
    rows.push({ name: c, score, why: blocked ? `você não joga ${main} contra · aparece em ${(p * 100).toFixed(0)}% dos jogos`
      : `${main} perde ~${loss.toFixed(1)} pts contra (${md.n.toLocaleString("pt-BR")} jogos) · aparece em ${(p * 100).toFixed(0)}%` });
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, n);
}

/** Winrate de um sup contra outro, juntando a coleta (Mestre+/D1 BR) e o op.gg (meio peso). */
export function combinedVsSup(me: string, opp: string) {
  const o = ownVsSup(me, opp), g = SUPVS[me]?.[opp];
  const no = o ? o.n : 0, ng = g ? g[1] * 0.5 : 0;
  if (!no && !ng) return null;
  const wr = ((o ? o.wr * no : 0) + (g ? g[0] * ng : 0)) / (no + ng);
  return { wr, n: no + (g ? g[1] : 0), own: no };
}
const shrink = (d: number, n: number, k: number) => (d * n) / (n + k);
/** Os melhores sups contra um sup inimigo (as duas fontes juntas). */
export function bestVsSup(opp: string, skip: Set<string>, n = 4) {
  const names = new Set([...Object.keys(SUPVS), ...Object.keys(D.sup)]);
  return [...names].filter((s) => !skip.has(s) && norm(s) !== norm(opp)).map((s) => ({ name: s, ...combinedVsSup(s, opp)! }))
    .filter((x) => x.wr && x.n >= 150).sort((a, b) => shrink(b.wr - 50, b.n, 300) - shrink(a.wr - 50, a.n, 300)).slice(0, n);
}
/** Os melhores sups contra o ADC inimigo (só a coleta tem esse dado). */
export function bestVsAdc(adc: string, skip: Set<string>, n = 4) {
  return Object.keys(D.sup).filter((s) => !skip.has(s)).map((s) => ({ name: s, r: ownVsAdc(s, adc) }))
    .filter((x) => x.r && x.r.n >= 40).map((x) => ({ name: x.name, wr: x.r!.wr, n: x.r!.n, d: x.r!.wr - x.r!.base, gd: x.r!.gd !== null && x.r!.ng >= 30 ? x.r!.gd! - x.r!.baseGd : null }))
    .sort((a, b) => shrink(b.d, b.n, 150) - shrink(a.d, a.n, 150)).slice(0, n);
}
