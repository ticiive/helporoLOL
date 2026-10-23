import { LANE, META, MU, SUPS, SUP_KEYS, SYN_ADC, type SupKey } from "./data";
import type { Stats } from "../lib/stats";
import { YUUMI_SYN } from "./snapshot";
import { BOTS, JUNGLERS, MIDS, SUPPORTS, TOPS } from "./champions";

export const ROLES = ["top", "jg", "mid", "adc", "sup"] as const;
export type Role = (typeof ROLES)[number];
export type Team = Record<Role, string | null>;
/** ally[myRole] fica vazio: é o seu slot */
export interface Draft { ally: Team; enemy: Team; bans: string[] }

export const FACTORS = [
  ["lane", "Lane"], ["dados", "Dados"], ["comp", "Comp"], ["adc", "Seu ADC"], ["meta", "Meta"], ["voce", "Você"], ["blind", "Blind"], ["modelo", "Modelo"], ["counter", "Counter"], ["sinergia", "Sinergia"],
] as const;
export type Factor = (typeof FACTORS)[number][0];
export type Weights = Record<Factor, number>;
export const DEFAULT_WEIGHTS: Weights = { lane: 1, dados: 1, comp: 1, adc: 1, meta: 0.6, voce: 1, blind: 1, modelo: 1, counter: 1, sinergia: 1 };

export interface Settings {
  weights: Weights;
  /** campeões que você aceita jogar em cada rota, além dos que já têm jogos seus nela */
  pool: Record<Role, string[]>;
  /** "quero treinar": bônus mesmo com histórico ruim */
  focus: string[];
  /** sua main: escolhida sempre que o jogo for jogável com ela */
  main: string;
  /** quanto o draft pode pesar contra a main antes de trocar (0 = troca fácil, 5 = só em desastre) */
  mainTolerance: number;
  /** bloqueio: com qualquer um desses no inimigo, a main nunca é sugerida */
  mainAvoid: string[];
  /** alerta: pesa contra a main e soma com o resto do draft, mas sozinho não bloqueia */
  mainWarn: string[];
  /** reservas em ordem de preferência, testadas com a mesma regra quando a main é evitada */
  backups: string[];
  /** sup (e de preferência ADC) inimigo tem que estar revelado pra sugerir a main */
  mainNoBlind: boolean;
  /** campeões que você não quer que apareçam (por rota) */
  exclude?: Partial<Record<Role, string[]>>;
  /** correções de lane: chave `${sup}|${inimigo}` */
  lane: Record<string, number>;
}
export const DEFAULT_POOL: Record<Role, string[]> = { top: [], jg: [], mid: [], adc: [], sup: SUP_KEYS.map((k) => SUPS[k]) };

export interface Result {
  name: string; sup: SupKey | null; score: number; f: Record<Factor, number>; why: [number, string][];
  games: number; status: "ok" | "banned" | "picked";
  /** só no resultado da main: quanto o draft pesa contra ela (lane, dados, comp, ADC, metade do blind) */
  situation?: number;
}
export interface Decision { results: Result[]; main: { name: string; situation: number; kept: boolean } | null }

type Flags = (name: string | null) => string;
/** Dados extras do campeão (Data Dragon): tags oficiais, dificuldade 1-10 e se é ranged. */
export interface ChampInfo { tags: string[]; diff: number; ranged: boolean }
type Info = (name: string) => ChampInfo | null;
const ROLE_LIST: Record<Role, Set<string>> = { top: TOPS, jg: JUNGLERS, mid: MIDS, adc: BOTS, sup: SUPPORTS };
const SUP_BY_NAME = Object.fromEntries(SUP_KEYS.map((k) => [SUPS[k], k])) as Record<string, SupKey>;

// ---- tabelas específicas dos 6 sups principais (ajuste aqui) ----
const S = (soraka: number, sona: number, nami: number, janna: number, lulu: number, milio: number) => ({ soraka, sona, nami, janna, lulu, milio });
const THREAT: Record<string, [Record<SupKey, number>, string]> = {
  D: [S(-1.2, -0.8, 0.6, 1.2, 1, 0.4), "dive"],
  X: [S(-1.2, -1.2, -0.3, 0.3, 1.2, 0), "assassinos/burst"],
  H: [S(-0.6, -0.6, -0.2, 0.2, 0, 0.6), "pick/hook no mapa"],
  K: [S(1, 0, -0.3, 0.3, 0, 0.6), "poke de desgaste"],
  // magos de artilharia (Xerath, Vel'Koz, Lux, Ziggs...) matam de longe quem não tem mobilidade
  L: [S(-0.5, -0.4, -0.1, 0, 0, 0.1), "mago de artilharia"],
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

/** Jogos seus numa rota, somando todos os campeões. */
export function roleGames(stats: Stats, role: Role) {
  return Object.values(stats).reduce((a, c) => a + (c.byRole[role] ? c.byRole[role]!.w + c.byRole[role]!.l : 0), 0);
}

/** Candidatos: seu pool manual + seus campeões na rota; numa rota com poucos jogos seus, entram também os campeões comuns da rota. */
export function candidates(role: Role, s: Settings, stats: Stats): string[] {
  // O histórico do cliente às vezes marca a rota errado (sup que roda pro mid vira "mid").
  // Campeão fora da lista normal da rota só entra se você jogou ele ali de verdade:
  // 4+ jogos e pelo menos 4% dos seus jogos com ele naquela rota.
  const fromStats = Object.entries(stats).filter(([n, c]) => {
    const r = c.byRole[role];
    if (!r) return false;
    const g = r.w + r.l, total = c.w + c.l;
    if (role === "sup") return g >= 5;
    if (ROLE_LIST[role].has(n)) return g >= 1;
    return g >= 4 && g / Math.max(total, 1) >= 0.04;
  }).map(([n]) => n);
  const explore = roleGames(stats, role) < 40 ? [...ROLE_LIST[role]] : [];
  const hidden = new Set(s.exclude?.[role] ?? []);
  return [...new Set([...s.pool[role], ...fromStats, ...explore])].filter((n) => !hidden.has(n));
}

/** O quanto um campeão se parece com os que você joga (características, tags oficiais e alcance). */
export function similarity(name: string, flags: Flags, info: Info, stats: Stats) {
  const tok = (n: string) => { const i = info(n); return new Set([...flags(n).replace(/[GSH]/g, ""), ...(i?.tags ?? []), i ? (i.ranged ? "rng" : "mel") : ""].filter(Boolean)); };
  const a = tok(name);
  const sims = Object.entries(stats).filter(([n, c]) => n !== name && c.w + c.l >= 3).map(([n, c]) => {
    const b = tok(n); const inter = [...a].filter((x) => b.has(x)).length;
    return { n, j: inter / (a.size + b.size - inter || 1), g: c.w + c.l };
  }).sort((x, y) => y.j - x.j).slice(0, 3);
  if (!sims.length) return { sim: 0.3, like: null as string | null };
  const wsum = sims.reduce((t, x) => t + Math.min(x.g, 30), 0);
  return { sim: sims.reduce((t, x) => t + x.j * Math.min(x.g, 30), 0) / wsum, like: sims[0].n };
}

/** model: logit centrado de cada sup vindo do modelo treinado; conf: 0..1, quanto confiar nele */
/** Winrate de cada campeão contra o oponente da rota, dos dados Mestre+: counters[rota][inimigo] = [[campeão, wr, jogos]] */
export type Counters = Record<string, Record<string, [string, number, number][]>>;
/** Parceiro de sinergia de cada rota: sup<->adc, mid/top -> jungle, jungle -> mid */
export const PARTNER: Record<Role, Role> = { sup: "adc", adc: "sup", mid: "jg", top: "jg", jg: "mid" };

export function decide(d: Draft, s: Settings, flags: Flags, stats: Stats, myRole: Role, info: Info = () => null, model: Record<string, number> | null = null, conf = 0, counters: Counters | null = null, synergies: Counters | null = null): Decision {
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

  const cands = candidates(myRole, s, stats);
  if (s.main && myRole === "sup" && !cands.includes(s.main)) cands.push(s.main);
  const results = cands.map((name): Result => {
    const k = isSup ? SUP_BY_NAME[name] ?? null : null;
    const fl = flags(name);
    const f: Record<Factor, number> = { lane: 0, dados: 0, comp: 0, adc: 0, meta: 0, voce: 0, blind: 0, modelo: 0, counter: 0, sinergia: 0 };
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
      const pool = t === "H" || t === "L" ? enemyNonSup : enemies;
      // artilharia não conta como "poke de desgaste" (esse é o que a cura anula)
      const c = Math.min(3, pool.filter((n) => hf(n, t) && !(t === "K" && hf(n, "L"))).length);
      if (c) add("comp", (k ? w[k] : genericThreat(t, fl)) * c, `inimigo com ${label}${c > 1 ? ` (${c})` : ""}`);
    }
    if (k && enemies.filter((n) => hf(n, "M")).length >= 3) add("comp", MELEE3[k], "muitos melee no inimigo");
    gaps.forEach((g) => add("comp", k ? GAP[g][k] : genericGap(g, fl), GAP_LABEL[g]));

    if (isSup && A.adc) {
      const syn = k ? SYN_ADC[k][A.adc] : undefined;
      if (syn && k) {
        // dado real da dupla, comparado com o winrate médio do sup
        const d = ((syn.wr - META[k].wr) * syn.n) / (syn.n + 800);
        add("adc", d * 0.5, `com ${A.adc}: ${syn.wr.toFixed(1)}% juntos (${syn.n.toLocaleString("pt-BR")} jogos)`, 0.3);
      } else {
        if (hf(A.adc, "Y")) add("adc", k ? SYN.Y[k] : has(fl, "R") ? 0.8 : 0, `${A.adc} hipercarry`);
        if (hf(A.adc, "G")) add("adc", k ? SYN.G[k] : has(fl, "E") || has(fl, "G") ? 0.8 : -0.3, `${A.adc} quer lane agressiva`);
      }
      // Nilah amplifica cura e escudo que recebe: ótima com encantador de cura
      if (k && A.adc === "Nilah") add("adc", ({ soraka: 1.5, sona: 0.8, nami: 0.8, janna: 0.5, lulu: 0.5, milio: 1 } as Record<SupKey, number>)[k], "Nilah amplifica a sua cura");
      // ADC que mergulha (Kai'Sa, Samira...) sai do alcance de quem só cura de trás
      if (k && hf(A.adc, "D")) add("adc", ({ soraka: -0.8, sona: -0.4, nami: 0.3, janna: 0, lulu: 0.5, milio: 0.3 } as Record<SupKey, number>)[k], `${A.adc} mergulha e sai do seu alcance`);
    }
    if (k) { const m = META[k]; add("meta", (TIER[m.tier] ?? 0) + (m.wr - 52) * 0.5, `meta: tier ${m.tier}, ${m.wr}% WR`); }

    const p = personal(stats, name, myRole);
    f.voce = p.pts;
    if (p.g) why.push([p.wr! >= 0.5 ? Math.max(0.6, p.pts) : Math.min(-0.6, (p.wr! - 0.5) * 30), `seu histórico: ${Math.round(p.wr! * 100)}% em ${p.g} jogos`]);
    // Pouca experiência com o campeão na rota: pesa o quanto ele lembra os seus e se é fácil de pegar
    if (p.g < 5) {
      const fam = p.g / 5, sm = similarity(name, flags, info, stats), diff = info(name)?.diff ?? 5;
      const simPts = (sm.sim - 0.35) * 6 * (1 - fam), easyPts = (5 - diff) * 0.35 * (1 - fam);
      f.voce += simPts + easyPts;
      if (sm.like && sm.sim >= 0.45) why.push([Math.max(0.6, simPts), `parecido com ${sm.like}, que você joga`]);
      else if (simPts <= -0.6) why.push([simPts, "estilo bem diferente do que você joga"]);
      if (diff <= 4) why.push([Math.max(0.6, easyPts), `fácil de pegar (dificuldade ${diff}/10)`]);
      else if (diff >= 7) why.push([Math.min(-0.6, easyPts), `difícil de aprender (dificuldade ${diff}/10)`]);
    }
    if (s.focus.includes(name)) { f.voce += 1.5; why.push([1.5, "você quer treinar"]); }

    if (unk > 0) {
      const v = k ? volatility(s, k) : squishy(fl) ? 0.45 : 0.3;
      f.blind = -unk * v * 5;
      if (f.blind <= -0.6) why.push([f.blind, "arriscado sem ver o oponente direto"]);
      else if (unk >= 0.45 && v < 0.35) why.push([0.6, "seguro de blind"]);
    }

    if (isSup && model && conf > 0 && model[name] !== undefined) {
      // 1 unidade de logit perto de 50% ~ 25 pontos de winrate; a escala aqui deixa ~6 pontos ~ 1 ponto de nota
      const v = model[name] * 4 * conf;
      add("modelo", v, `modelo (Mestre+): ${v > 0 ? "+" : ""}${(model[name] * 25).toFixed(1)} pts de winrate`, 0.4);
    }
    // counter do oponente direto (fora do sup, que já tem a tabela de lane e os matchups)
    const opp = myRole === "sup" ? null : E[myRole];
    const row = opp && counters ? counters[myRole]?.[opp]?.find((x) => x[0] === name) : undefined;
    if (row) {
      const [, cwr, n] = row;
      const v = ((cwr - 50) * n) / (n + 100) * 0.35;
      add("counter", v, `${cwr >= 53 ? "strong counter: " : ""}${cwr.toFixed(1)}% vs ${opp} (${n} jogos Mestre+)`, 0.4);
    }
    // sinergia com o parceiro (dados Mestre+); no sup, os 6 com tabela do op.gg já usam o fator "Seu ADC"
    const partner = A[PARTNER[myRole]];
    const coveredByAdc = isSup && !!k && !!partner && !!SYN_ADC[k][partner];
    const srow = partner && synergies && !coveredByAdc ? synergies[myRole]?.[partner]?.find((x) => x[0] === name) : undefined;
    if (srow) {
      const [, swr, n] = srow;
      const v = ((swr - 50) * n) / (n + 100) * 0.35;
      add("sinergia", v, `sinergia com ${partner}: ${swr.toFixed(1)}% juntos (${n} jogos Mestre+)`, 0.4);
    }
    const score = (Object.keys(f) as Factor[]).reduce((a, x) => a + f[x] * (s.weights[x] ?? 1), 0);
    const status = d.bans.includes(name) ? "banned" : taken.has(name) ? "picked" : "ok";
    // winrate de jogo bom não salva uma lane que você sabe que é ruim
    const dadosSit = f.lane <= -1.5 ? Math.min(0, f.dados) : f.dados;
    const situation = (f.lane < 0 ? 2 : 1.5) * f.lane * s.weights.lane + dadosSit * s.weights.dados + f.comp * s.weights.comp + f.adc * s.weights.adc + 0.5 * f.blind * s.weights.blind + f.modelo * (s.weights.modelo ?? 1);
    return { name, sup: k, score, f, why, games: p.g, status, situation };
  }).sort((a, b) => Number(a.status !== "ok") - Number(b.status !== "ok") || b.score - a.score);

  // Regra da main: ela é o pick sempre que o draft não pesar demais contra ela.
  const main = myRole === "sup" ? results.find((r) => r.name === s.main && r.status === "ok") : undefined;
  if (!main) return { results, main: null };
  const blocked = enemies.filter((n) => s.mainAvoid.includes(n));
  const warned = enemies.filter((n) => s.mainWarn.includes(n) && !s.mainAvoid.includes(n));
  if (warned.length) { main.situation! -= 1.2 * warned.length; main.why.push([-1.2 * warned.length, `alerta pra ${main.name}: ${warned.join(", ")}`]); }
  if (blocked.length) main.why.push([-5, `${blocked.join(", ")}: você não joga ${main.name} contra`]);
  const isBlind = !E.sup;
  if (s.mainNoBlind && isBlind) main.why.push([-5, `não dá pra blindar ${main.name}: espere o sup inimigo aparecer`]);
  const kept = !blocked.length && !(s.mainNoBlind && isBlind) && main.situation! >= -s.mainTolerance;
  let ordered = kept ? [main, ...results.filter((r) => r !== main)] : results;
  if (kept) main.why.push([3, results[0] === main ? `${main.name} é sua main e encaixa bem` : `jogável de ${main.name}: sua main fica`]);
  else {
    // Main fora: a primeira reserva jogável na sua ordem de preferência; se nenhuma for, a maior nota
    // em blind, a reserva também precisa aguentar o risco inteiro de counter, não só metade
    const fits = (r: Result) => r.situation! + (isBlind ? 0.5 * r.f.blind * s.weights.blind : 0) >= -s.mainTolerance;
    const backup = s.backups.map((n) => results.find((r) => r.name === n && r.status === "ok")).find((r) => r && fits(r));
    if (backup) { ordered = [backup, ...results.filter((r) => r !== backup)]; backup.why.push([2.5, `${backup.name} é sua próxima opção e é jogável aqui`]); }
    const worst = main.why.filter((w) => w[0] < 0).sort((a, b) => a[0] - b[0]).slice(0, 2).map((w) => w[1]).join("; ");
    ordered[0].why.push([2, `${main.name} evitada: ${worst || "draft ruim pra ela"}`]);
  }
  return { results: ordered, main: { name: main.name, situation: main.situation!, kept } };
}


// ---------- opções sinalizadas: sempre um counter e uma sinergia ----------
export interface Special { name: string; wr: number; n: number; tag: string; inPool: boolean }

/**
 * Escolhe uma opção "strong counter" do oponente direto e uma de "sinergia" com o parceiro.
 * Prefere campeão do seu pool (e diz se é main seu); se nenhum serve, mostra o melhor de fora.
 */
export function specialPicks(results: Result[], d: Draft, myRole: Role, stats: Stats, flags: Flags, info: Info,
  counters: Counters | null, synergies: Counters | null, hidden: string[] = []): { counter: Special | null; synergy: Special | null; opp: string | null; partner: string | null } {
  const taken = new Set([...ROLES.map((r) => d.ally[r]), ...ROLES.map((r) => d.enemy[r]), ...d.bans, ...hidden].filter(Boolean) as string[]);
  const roleGames = (n: string) => { const c = stats[n]?.byRole[myRole]; return c ? c.w + c.l : 0; };
  // "seu pool" = campeões que você joga nessa rota (os sugeridos só por exploração não contam)
  const pool = new Set(results.filter((r) => r.status === "ok" && roleGames(r.name) >= 3).map((r) => r.name));
  const tagFor = (n: string, kind: string) => {
    const g = roleGames(n);
    if (g >= 20) return `${kind} · main seu (${g} jogos)`;
    if (pool.has(n)) return `${kind} · no seu pool`;
    const sm = similarity(n, flags, info, stats);
    return `${kind} · fora do seu pool${sm.like && sm.sim >= 0.45 ? `, parecido com ${sm.like}` : ""}`;
  };
  const pick = (rows: [string, number, number][] | undefined, kind: string, min = 52): Special | null => {
    const ok = (rows ?? []).filter(([n, w, g]) => w >= min && g >= 25 && !taken.has(n));
    const best = ok.find(([n]) => pool.has(n)) ?? ok[0];
    return best ? { name: best[0], wr: best[1], n: best[2], tag: tagFor(best[0], kind), inPool: pool.has(best[0]) } : null;
  };
  const opp = d.enemy[myRole], partner = d.ally[PARTNER[myRole]];
  let counter = opp ? pick(counters?.[myRole]?.[opp], "strong counter") : null;
  let synergy = partner ? pick(synergies?.[myRole]?.[partner], "sinergia perfeita") : null;
  // no sup, enquanto não há dados Mestre+ da dupla, usa as tabelas do op.gg/Lolalytics dos seus sups
  if (myRole === "sup") {
    if (!counter && opp) {
      const rows = SUP_KEYS.map((k) => [SUPS[k], MU[k][opp]?.wr ?? 0, MU[k][opp]?.n ?? 0] as [string, number, number]).sort((a, b) => b[1] - a[1]);
      counter = pick(rows, "strong counter", 52.5);
    }
    if (!synergy && partner) {
      // dupla acima da média do próprio sup (+1 ponto), mostrando o winrate real
      const rows = SUP_KEYS.filter((k) => SYN_ADC[k][partner] && SYN_ADC[k][partner].wr - META[k].wr >= 1)
        .sort((a, b) => (SYN_ADC[b][partner].wr - META[b].wr) - (SYN_ADC[a][partner].wr - META[a].wr))
        .map((k) => [SUPS[k], SYN_ADC[k][partner].wr, SYN_ADC[k][partner].n] as [string, number, number]);
      // Yuumi (snapshot op.gg): dupla acima da média dela (~48,5%)
      const yu = Object.fromEntries(YUUMI_SYN.split(",").map((x) => { const [n, w, g] = x.split(":"); return [n, [+w, +g]]; })) as Record<string, [number, number]>;
      if (yu[partner] && yu[partner][0] - 48.5 >= 1.5) rows.push(["Yuumi", yu[partner][0], yu[partner][1]]);
      synergy = pick(rows, "sinergia perfeita", 0);
    }
  }
  return { counter, synergy, opp, partner };
}
