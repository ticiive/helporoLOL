import { LANE, META, MU, SUPS, SUP_KEYS, type SupKey } from "./data";
import type { Stats } from "../lib/stats";

export const ROLES = ["top", "jg", "mid", "adc", "sup"] as const;
export type Role = (typeof ROLES)[number];
export type Team = Record<Role, string | null>;
/** ally[myRole] fica vazio: é o seu slot */
export interface Draft { ally: Team; enemy: Team; bans: string[] }

export const FACTORS = [
  ["lane", "Lane"], ["dados", "Dados"], ["comp", "Comp"], ["adc", "Seu ADC"], ["meta", "Meta"], ["voce", "Você"], ["blind", "Blind"],
] as const;
export type Factor = (typeof FACTORS)[number][0];
export type Weights = Record<Factor, number>;
export const DEFAULT_WEIGHTS: Weights = { lane: 1, dados: 1, comp: 1, adc: 1, meta: 0.6, voce: 1, blind: 1 };

export interface Settings {
  weights: Weights;
  /** campeões que você aceita jogar em cada rota, além dos que já têm jogos seus nela */
  pool: Record<Role, string[]>;
  /** "quero treinar": bônus mesmo com histórico ruim */
  focus: string[];
  /** correções de lane: chave `${sup}|${inimigo}` */
  lane: Record<string, number>;
}
export const DEFAULT_POOL: Record<Role, string[]> = { top: [], jg: [], mid: [], adc: [], sup: SUP_KEYS.map((k) => SUPS[k]) };

export interface Result {
  name: string; sup: SupKey | null; score: number; f: Record<Factor, number>; why: [number, string][];
  games: number; status: "ok" | "banned" | "picked";
}

type Flags = (name: string | null) => string;
const SUP_BY_NAME = Object.fromEntries(SUP_KEYS.map((k) => [SUPS[k], k])) as Record<string, SupKey>;

// ---- tabelas específicas dos 6 sups principais (ajuste aqui) ----
const S = (soraka: number, sona: number, nami: number, janna: number, lulu: number, milio: number) => ({ soraka, sona, nami, janna, lulu, milio });
const THREAT: Record<string, [Record<SupKey, number>, string]> = {
  D: [S(-1.2, -0.8, 0.6, 1.2, 1, 0.4), "dive"],
  X: [S(-1.2, -1.2, -0.3, 0.3, 1.2, 0), "assassinos/burst"],
  H: [S(-0.6, -0.6, -0.2, 0.2, 0, 0.6), "pick/hook no mapa"],
  K: [S(1, 0, -0.3, 0.3, 0, 0.6), "poke"],
  W: [S(0.3, 0.8, 0.3, 0.4, 0, 0.3), "teamfight AoE"],
  N: [S(0, 0, -0.8, 0, 0, 0), "spell shield"],
};
const MELEE3 = S(0, 0.6, 0.6, 0.8, 0.4, 0.3);
const GAP_LABEL: Record<string, string> = {
  nofront: "seu time sem frontline", front2: "frontline forte no seu time", noeng: "seu time sem engage", eng2: "muito engage no seu time",
  split: "split pusher (ult global)", aoe2: "AoE no seu time pra combar", noap: "seu time sem dano mágico", noad: "seu time sem dano físico",
};
const GAP: Record<string, Record<SupKey, number>> = {
  nofront: S(-1.5, -1, 0, 0.5, 0.5, 0), front2: S(0.8, 0, 0, 0, 0, 0.4), noeng: S(0, -0.3, 1.2, -0.4, 0, 0),
  eng2: S(0, 0.4, 0.6, -0.3, 0.2, 0.2), split: S(0.7, 0, 0, 0, 0, 0), aoe2: S(0, 0.8, 0.2, 0, 0, 0), noap: S(0.3, 0.4, 0.3, 0.2, 0.3, 0.2), noad: S(0, 0, 0, 0, 0, 0),
};
const SYN = { Y: S(1, 0.5, 0, 0.5, 1.5, 1), G: S(-0.5, -1, 1.5, -0.3, 0, 0.5) };
const ENEMY_ADC = { G: S(-1, -1.5, 0.5, 0, 0, 0), K: S(0.5, -0.3, 0, 0, 0, 0) };
const TIER: Record<string, number> = { "S+": 1, S: 0.6, "A+": 0.3, A: 0, B: -0.4, C: -0.8 };
const COMMON = ["Thresh","Lulu","Nami","Nautilus","Milio","Janna","Leona","Blitzcrank","Karma","Seraphine","Lux","Pyke","Rell","Senna","Yuumi","Soraka","Alistar","Braum","Rakan","Bard","Zyra","Xerath","Morgana","Brand"];

// ---- regras genéricas por características, pra qualquer outro campeão ----
const has = (f: string, c: string) => f.includes(c);
const squishy = (f: string) => !has(f, "F") && !has(f, "R");
function genericThreat(t: string, f: string): number {
  switch (t) {
    case "D": return (has(f, "R") ? 0.6 : 0) + (has(f, "C") ? 0.4 : 0) + (has(f, "F") ? 0.3 : 0) - (has(f, "P") && squishy(f) && !has(f, "C") ? 0.6 : 0);
    case "X": return (has(f, "R") ? 0.5 : 0) + (has(f, "F") ? 0.4 : 0) - (squishy(f) ? 0.6 : 0);
    case "H": return (has(f, "R") ? 0.3 : 0) - (squishy(f) ? 0.3 : 0);
    case "K": return (has(f, "E") ? 0.4 : 0) - (has(f, "M") && !has(f, "E") ? 0.3 : 0);
    case "W": return has(f, "E") || has(f, "W") ? 0.3 : 0;
    case "N": return has(f, "H") ? -0.4 : 0;
  }
  return 0;
}
function genericGap(g: string, f: string): number {
  switch (g) {
    case "nofront": return has(f, "F") ? 1.2 : 0;
    case "noeng": return has(f, "E") ? 1 : 0;
    case "noap": return has(f, "P") ? 0.8 : 0;
    case "noad": return has(f, "A") && !has(f, "P") ? 0.8 : 0;
    case "split": return has(f, "S") ? -0.3 : 0;
    case "aoe2": return has(f, "W") ? 0.3 : 0;
  }
  return 0;
}

export const laneKey = (k: SupKey, enemy: string) => `${k}|${enemy}`;
export const laneValue = (s: Settings, k: SupKey, enemy: string) => s.lane[laneKey(k, enemy)] ?? LANE[k][enemy] ?? 0;
export const laneDefault = (k: SupKey, enemy: string) => LANE[k][enemy] ?? 0;

function dataPts(k: SupKey, enemy: string) {
  const m = MU[k][enemy];
  if (!m) return null;
  const d = ((m.wr - 50) * m.n) / (m.n + 800); // puxa pro 50% quando a amostra é pequena
  return { pts: d * 0.7, ...m };
}
function volatility(s: Settings, k: SupKey) {
  const list = COMMON.filter((e) => e !== SUPS[k]);
  return list.reduce((a, e) => a + Math.max(0, -(laneValue(s, k, e) + (dataPts(k, e)?.pts ?? 0))), 0) / list.length;
}

export interface Profile { n: number; ad: number; ap: number; F: number; E: number; R: number; C: number; K: number; DX: number; W: number; S: number; H: number; N: number; M: number }
export function profile(list: string[], flags: Flags): Profile {
  const hf = (n: string, c: string) => flags(n).includes(c);
  const cnt = (c: string) => list.filter((n) => hf(n, c)).length;
  let ad = 0, ap = 0;
  list.forEach((n) => { const a = hf(n, "A"), p = hf(n, "P"); if (a && p) { ad += 0.5; ap += 0.5; } else if (a) ad++; else if (p) ap++; });
  return { n: list.length, ad, ap, F: cnt("F"), E: cnt("E"), R: cnt("R"), C: cnt("C"), K: cnt("K"), DX: list.filter((n) => /[DX]/.test(flags(n))).length, W: cnt("W"), S: cnt("S"), H: cnt("H"), N: cnt("N"), M: cnt("M") };
}

/** Risco de counter: quanto do time inimigo ainda está escondido, com peso no seu oponente direto. */
export function blindRisk(d: Draft, myRole: Role) {
  const e = d.enemy;
  const direct = myRole === "sup" || myRole === "adc" ? (e.sup ? 0 : 0.45) + (e.adc ? 0 : 0.25) : (e[myRole] ? 0 : 0.6);
  const rest = ROLES.filter((r) => r !== myRole && !(myRole === "sup" || myRole === "adc" ? r === "sup" || r === "adc" : false) && !e[r]).length;
  return Math.min(1, direct + rest * 0.1);
}

/** Desempenho pessoal: winrate puxado pro 50% com pouca amostra + conforto pelo número de jogos. */
function personal(stats: Stats, name: string, role: Role) {
  const c = stats[name];
  if (!c) return { g: 0, wr: null as number | null, pts: 0 };
  const r = c.byRole[role];
  const w = r ? r.w : c.w, l = r ? r.l : c.l, g = w + l;
  const shrunk = (w + 0.5 * 15) / (g + 15);
  const pts = (shrunk - 0.5) * 100 * 0.3 + Math.min(2.5, Math.log(1 + g) * 0.6);
  return { g, wr: g ? w / g : null, pts };
}

export function candidates(role: Role, s: Settings, stats: Stats): string[] {
  const fromStats = Object.entries(stats).filter(([, c]) => { const r = c.byRole[role]; return r && r.w + r.l >= (role === "sup" ? 5 : 2); }).map(([n]) => n);
  return [...new Set([...s.pool[role], ...fromStats])];
}

export function decide(d: Draft, s: Settings, flags: Flags, stats: Stats, myRole: Role): Result[] {
  const { ally: A, enemy: E } = d;
  const hf = (n: string | null, c: string) => !!n && flags(n).includes(c);
  const taken = new Set([...ROLES.map((r) => A[r]), ...ROLES.map((r) => E[r])].filter(Boolean) as string[]);
  const allies = ROLES.filter((r) => r !== myRole).map((r) => A[r]).filter(Boolean) as string[];
  const enemies = ROLES.map((r) => E[r]).filter(Boolean) as string[];
  const enemyNonSup = (["top", "jg", "mid", "adc"] as Role[]).map((r) => E[r]).filter(Boolean) as string[];
  const pa = profile(allies, flags);
  const es = E.sup, ea = E.adc;
  const unk = blindRisk(d, myRole);
  const isSup = myRole === "sup";

  const gaps: string[] = [];
  if (pa.n >= 3 && pa.F === 0) gaps.push("nofront");
  if (pa.F >= 2) gaps.push("front2");
  if (pa.n >= 3 && pa.E === 0) gaps.push("noeng");
  if (pa.E >= 2) gaps.push("eng2");
  if (pa.S) gaps.push("split");
  if (pa.W >= 2) gaps.push("aoe2");
  if (pa.n >= 3 && pa.ap < 0.6) gaps.push("noap");
  if (pa.n >= 3 && pa.ad < 0.6) gaps.push("noad");

  return candidates(myRole, s, stats).map((name): Result => {
    const k = isSup ? SUP_BY_NAME[name] ?? null : null;
    const fl = flags(name);
    const f: Record<Factor, number> = { lane: 0, dados: 0, comp: 0, adc: 0, meta: 0, voce: 0, blind: 0 };
    const why: [number, string][] = [];
    const add = (fac: Factor, v: number, txt: string, min = 0.5) => { f[fac] += v; if (Math.abs(v) >= min) why.push([v, txt]); };

    // lane e dados: só pros 6 sups com tabela
    if (k && es) {
      const v = laneValue(s, k, es);
      add("lane", v, `lane vs ${es} ${v <= -2 ? "muito difícil" : v < 0 ? "difícil" : v >= 2 ? "muito fácil" : "favorável"}`, 1);
      const dp = dataPts(k, es);
      if (dp) add("dados", dp.pts, `${dp.wr.toFixed(1)}% vs ${es} (${dp.n.toLocaleString("pt-BR")} jogos)`, 0.3);
    }
    if (k && ea) {
      if (hf(ea, "G")) add("lane", ENEMY_ADC.G[k], `${ea} agressivo na lane`);
      if (hf(ea, "K")) add("lane", ENEMY_ADC.K[k], `${ea} de poke`);
    }

    for (const [t, [w, label]] of Object.entries(THREAT)) {
      const pool = t === "H" ? enemyNonSup : enemies;
      const c = Math.min(3, pool.filter((n) => hf(n, t)).length);
      if (c) add("comp", (k ? w[k] : genericThreat(t, fl)) * c, `inimigo com ${label}${c > 1 ? ` (${c})` : ""}`);
    }
    if (k && enemies.filter((n) => hf(n, "M")).length >= 3) add("comp", MELEE3[k], "muitos melee no inimigo");
    gaps.forEach((g) => add("comp", k ? GAP[g][k] : genericGap(g, fl), GAP_LABEL[g]));

    if (isSup && A.adc) {
      if (hf(A.adc, "Y")) add("adc", k ? SYN.Y[k] : has(fl, "R") ? 0.8 : 0, `${A.adc} hipercarry`);
      if (hf(A.adc, "G")) add("adc", k ? SYN.G[k] : has(fl, "E") || has(fl, "G") ? 0.8 : -0.3, `${A.adc} quer lane agressiva`);
    }
    if (k) { const m = META[k]; add("meta", (TIER[m.tier] ?? 0) + (m.wr - 52) * 0.5, `meta: tier ${m.tier}, ${m.wr}% WR`); }

    const p = personal(stats, name, myRole);
    f.voce = p.pts;
    if (p.g) why.push([p.wr! >= 0.5 ? Math.max(0.6, p.pts) : Math.min(-0.6, (p.wr! - 0.5) * 30), `seu histórico: ${Math.round(p.wr! * 100)}% em ${p.g} jogos`]);
    else why.push([-0.6, "sem jogos seus nessa rota"]);
    if (s.focus.includes(name)) { f.voce += 1.5; why.push([1.5, "você quer treinar"]); }

    if (unk > 0) {
      const v = k ? volatility(s, k) : squishy(fl) ? 0.45 : 0.3;
      f.blind = -unk * v * 5;
      if (f.blind <= -0.6) why.push([f.blind, "arriscado sem ver o oponente direto"]);
      else if (unk >= 0.45 && v < 0.35) why.push([0.6, "seguro de blind"]);
    }

    const score = (Object.keys(f) as Factor[]).reduce((a, x) => a + f[x] * s.weights[x], 0);
    const status = d.bans.includes(name) ? "banned" : taken.has(name) ? "picked" : "ok";
    return { name, sup: k, score, f, why, games: p.g, status };
  }).sort((a, b) => Number(a.status !== "ok") - Number(b.status !== "ok") || b.score - a.score);
}
