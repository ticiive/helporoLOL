import { LANE, META, MU, SUPS, SUP_KEYS, type SupKey } from "./data";

export const ROLES = ["top", "jg", "mid", "adc", "sup"] as const;
export type Role = (typeof ROLES)[number];
export type Team = Record<Role, string | null>;
export interface Draft { ally: Team; enemy: Team; bans: string[] }

export const FACTORS = [
  ["lane", "Lane"], ["dados", "Dados"], ["comp", "Comp"], ["adc", "Seu ADC"], ["meta", "Meta"], ["conf", "Conforto"], ["blind", "Blind"],
] as const;
export type Factor = (typeof FACTORS)[number][0];
export type Weights = Record<Factor, number>;
export const DEFAULT_WEIGHTS: Weights = { lane: 1, dados: 1, comp: 1, adc: 1, meta: 0.6, conf: 1, blind: 1 };

export interface Settings {
  weights: Weights;
  pool: SupKey[];
  /** correções de lane da usuária: chave `${sup}|${inimigo}` */
  lane: Record<string, number>;
}
export interface Result {
  k: SupKey; score: number; f: Record<Factor, number>; why: [number, string][];
  status: "ok" | "banned" | "picked" | "out";
}

type Flags = (name: string | null) => string;

// ---- pesos do modelo (ajuste aqui) ----
const COMFORT: Record<SupKey, number> = { soraka: 3, sona: 2, nami: 1.5, janna: 0, lulu: 0, milio: 0 };
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
const GAP: Record<string, [Record<SupKey, number>, string]> = {
  nofront: [S(-1.5, -1, 0, 0.5, 0.5, 0), "seu time sem frontline"],
  front2: [S(0.8, 0, 0, 0, 0, 0.4), "frontline forte no seu time"],
  noeng: [S(0, -0.3, 1.2, -0.4, 0, 0), "seu time sem engage"],
  eng2: [S(0, 0.4, 0.6, -0.3, 0.2, 0.2), "muito engage no seu time"],
  split: [S(0.7, 0, 0, 0, 0, 0), "split pusher (ult global)"],
  aoe2: [S(0, 0.8, 0.2, 0, 0, 0), "AoE no seu time pra combar"],
  noap: [S(0.3, 0.4, 0.3, 0.2, 0.3, 0.2), "seu time sem dano mágico"],
};
const SYN = { Y: S(1, 0.5, 0, 0.5, 1.5, 1), G: S(-0.5, -1, 1.5, -0.3, 0, 0.5) };
const ENEMY_ADC = { G: S(-1, -1.5, 0.5, 0, 0, 0), K: S(0.5, -0.3, 0, 0, 0, 0) };
const TIER: Record<string, number> = { "S+": 1, S: 0.6, "A+": 0.3, A: 0, B: -0.4, C: -0.8 };
const COMMON = ["Thresh","Lulu","Nami","Nautilus","Milio","Janna","Leona","Blitzcrank","Karma","Seraphine","Lux","Pyke","Rell","Senna","Yuumi","Soraka","Alistar","Braum","Rakan","Bard","Zyra","Xerath","Morgana","Brand"];

export const laneKey = (k: SupKey, enemy: string) => `${k}|${enemy}`;
export const laneValue = (s: Settings, k: SupKey, enemy: string) => s.lane[laneKey(k, enemy)] ?? LANE[k][enemy] ?? 0;
export const laneDefault = (k: SupKey, enemy: string) => LANE[k][enemy] ?? 0;

function dataPts(k: SupKey, enemy: string) {
  const m = MU[k][enemy];
  if (!m) return null;
  // puxa pro 50% quando a amostra é pequena
  const d = ((m.wr - 50) * m.n) / (m.n + 800);
  return { pts: d * 0.7, ...m };
}
/** O quanto cada sup sofre contra os sups mais jogados: base do risco de blind. */
function volatility(s: Settings, k: SupKey) {
  const list = COMMON.filter((e) => e !== SUPS[k]);
  return list.reduce((a, e) => a + Math.max(0, -(laneValue(s, k, e) + (dataPts(k, e)?.pts ?? 0))), 0) / list.length;
}

export interface Profile { n: number; ad: number; ap: number; F: number; E: number; R: number; C: number; K: number; DX: number; W: number; S: number; H: number; N: number; M: number }
export function profile(list: string[], flags: Flags): Profile {
  const has = (n: string, c: string) => flags(n).includes(c);
  const cnt = (c: string) => list.filter((n) => has(n, c)).length;
  let ad = 0, ap = 0;
  list.forEach((n) => { const a = has(n, "A"), p = has(n, "P"); if (a && p) { ad += 0.5; ap += 0.5; } else if (a) ad++; else if (p) ap++; });
  return { n: list.length, ad, ap, F: cnt("F"), E: cnt("E"), R: cnt("R"), C: cnt("C"), K: cnt("K"), DX: list.filter((n) => /[DX]/.test(flags(n))).length, W: cnt("W"), S: cnt("S"), H: cnt("H"), N: cnt("N"), M: cnt("M") };
}

export function blindRisk(d: Draft) {
  const e = d.enemy;
  return (e.sup ? 0 : 0.45) + (e.adc ? 0 : 0.25) + (["top", "jg", "mid"] as Role[]).filter((r) => !e[r]).length * 0.1;
}

export function decide(d: Draft, s: Settings, flags: Flags): Result[] {
  const { ally: A, enemy: E } = d;
  const has = (n: string | null, c: string) => !!n && flags(n).includes(c);
  const taken = new Set([...ROLES.map((r) => A[r]), ...ROLES.map((r) => E[r])].filter(Boolean) as string[]);
  const allies = (["top", "jg", "mid", "adc"] as Role[]).map((r) => A[r]).filter(Boolean) as string[];
  const enemies = ROLES.map((r) => E[r]).filter(Boolean) as string[];
  const enemyNonSup = (["top", "jg", "mid", "adc"] as Role[]).map((r) => E[r]).filter(Boolean) as string[];
  const pa = profile(allies, flags);
  const es = E.sup, ea = E.adc;
  const unk = blindRisk(d);

  const gaps: string[] = [];
  if (pa.n >= 3 && pa.F === 0) gaps.push("nofront");
  if (pa.F >= 2) gaps.push("front2");
  if (pa.n >= 3 && pa.E === 0) gaps.push("noeng");
  if (pa.E >= 2) gaps.push("eng2");
  if (pa.S) gaps.push("split");
  if (pa.W >= 2) gaps.push("aoe2");
  if (pa.n >= 3 && pa.ap < 0.6) gaps.push("noap");

  return SUP_KEYS.map((k): Result => {
    const f: Record<Factor, number> = { lane: 0, dados: 0, comp: 0, adc: 0, meta: 0, conf: COMFORT[k], blind: 0 };
    const why: [number, string][] = [];
    const add = (fac: Factor, v: number, txt: string, min = 0.5) => { f[fac] += v; if (Math.abs(v) >= min) why.push([v, txt]); };

    if (es) { const v = laneValue(s, k, es); add("lane", v, `lane vs ${es} ${v <= -2 ? "muito difícil" : v < 0 ? "difícil" : v >= 2 ? "muito fácil" : "favorável"}`, 1); }
    if (ea) {
      if (has(ea, "G")) add("lane", ENEMY_ADC.G[k], `${ea} agressivo na lane`);
      if (has(ea, "K")) add("lane", ENEMY_ADC.K[k], `${ea} de poke`);
    }
    if (es) { const dp = dataPts(k, es); if (dp) add("dados", dp.pts, `${dp.wr.toFixed(1)}% vs ${es} (${dp.n.toLocaleString("pt-BR")} jogos)`, 0.3); }

    for (const [t, [w, label]] of Object.entries(THREAT)) {
      const pool = t === "H" ? enemyNonSup : enemies;
      const c = Math.min(3, pool.filter((n) => has(n, t)).length);
      if (c) add("comp", w[k] * c, `inimigo com ${label}${c > 1 ? ` (${c})` : ""}`);
    }
    if (enemies.filter((n) => has(n, "M")).length >= 3) add("comp", MELEE3[k], "muitos melee no inimigo");
    gaps.forEach((g) => add("comp", GAP[g][0][k], GAP[g][1]));

    if (A.adc) {
      if (has(A.adc, "Y")) add("adc", SYN.Y[k], `${A.adc} hipercarry`);
      if (has(A.adc, "G")) add("adc", SYN.G[k], `${A.adc} quer lane agressiva`);
    }
    const m = META[k];
    add("meta", (TIER[m.tier] ?? 0) + (m.wr - 52) * 0.5, `meta: tier ${m.tier}, ${m.wr}% WR`);

    if (unk > 0) {
      const v = volatility(s, k);
      f.blind = -unk * v * 5;
      if (f.blind <= -0.6) why.push([f.blind, "arriscada sem ver o bot inimigo"]);
      else if (unk >= 0.45 && v < 0.35) why.push([0.6, "segura de blind"]);
    }
    if (COMFORT[k] >= 1.5) why.push([COMFORT[k], "champ de conforto"]);

    const score = (Object.keys(f) as Factor[]).reduce((a, x) => a + f[x] * s.weights[x], 0);
    const name = SUPS[k];
    const status = d.bans.includes(name) ? "banned" : taken.has(name) ? "picked" : !s.pool.includes(k) ? "out" : "ok";
    return { k, score, f, why, status };
  }).sort((a, b) => Number(a.status !== "ok") - Number(b.status !== "ok") || b.score - a.score);
}
