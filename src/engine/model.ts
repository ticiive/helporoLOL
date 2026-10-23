/**
 * Modelo treinado (model/train.py), baixado da branch "data" do repo.
 * Calcula, pra cada sup, o logit da chance de vitória no draft atual.
 * Só comparamos sups entre si, então campeões ainda não escolhidos simplesmente não entram na conta.
 */
import type { Draft, Role } from "./engine";

export const MODEL_URL = "https://raw.githubusercontent.com/ticiive/helporoLOL/data/model/out/model.json";

export interface TrainedModel {
  champs: string[];
  sups: string[];
  tags: string[];
  tagIdx: Record<string, number[]>;
  params: Record<string, number[] | number[][]>;
  metrics: { amostras_treino: number; amostras_validacao: number; auc_modelo: number; logloss_modelo: number; logloss_so_media_do_sup: number };
  trainedAt?: string;
}

const ROLES_A: Role[] = ["top", "jg", "mid", "adc"];
const ROLES_E: Role[] = ["top", "jg", "mid", "adc", "sup"];

/** Confiança 0..1: só passa a pesar quando o modelo bate a média em jogos que não viu. */
export function confidence(m: TrainedModel) {
  const gain = m.metrics.logloss_so_media_do_sup - m.metrics.logloss_modelo;
  const n = m.metrics.amostras_treino;
  if (gain <= 0 || m.metrics.auc_modelo <= 0.51) return 0;
  return Math.min(1, n / 20000) * Math.min(1, gain / 0.004);
}

/** Logit centrado (média dos sups = 0) de cada sup do modelo, pro draft dado. */
export function predict(m: TrainedModel, d: Draft): Record<string, number> {
  const P = m.params as Record<string, number[] & number[][]>;
  const idx = new Map(m.champs.map((c, i) => [c, i]));
  const T = m.tags.length;
  const tagVec = (names: (string | null)[]) => {
    const v = new Array(T).fill(0);
    names.forEach((n) => { if (n) (m.tagIdx[n] ?? []).forEach((t) => (v[t] += 1)); });
    return v;
  };
  const ids = (names: (string | null)[]) => names.map((n) => (n ? idx.get(n) : undefined)).filter((i): i is number => i !== undefined);
  const A = ROLES_A.map((r) => d.ally[r]);
  const E = ROLES_E.map((r) => d.enemy[r]);
  const L = [d.enemy.adc, d.enemy.sup];
  const D = [d.ally.adc];
  const TA = tagVec(A), TE = tagVec(E), TL = tagVec(L), TD = tagVec(D);
  const iA = ids(A), iE = ids(E), iL = ids(L);
  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
  const sumEmb = (is: number[]) => { const k = (P.e[0] ?? []).length; const v = new Array(k).fill(0); is.forEach((i) => P.e[i].forEach((x, j) => (v[j] += x))); return v; };
  const SE = sumEmb(iE), SA = sumEmb(iA), SL = sumEmb(iL);
  const QE = iE.reduce((s, i) => s + P.q[i] * 1.0, 0); // elo do inimigo: típico de Mestre (1,0)
  const out: Record<string, number> = {};
  m.sups.forEach((name, s) => {
    out[name] = P.b[s] + dot(TA, P.WA[s]) + dot(TE, P.WE[s]) + dot(TL, P.WL[s]) + dot(TD, P.WD[s])
      + dot(P.u[s], SE) + dot(P.v[s], SA) + dot(P.w[s], SL) - P.g[s] * QE;
  });
  const mean = Object.values(out).reduce((a, b) => a + b, 0) / m.sups.length;
  for (const k of Object.keys(out)) out[k] -= mean;
  return out;
}

export async function loadModel(): Promise<TrainedModel | null> {
  try {
    const r = await fetch(MODEL_URL, { cache: "no-store" });
    if (!r.ok) return null;
    const m = (await r.json()) as TrainedModel;
    return m && m.params && m.champs && m.tagIdx && m.metrics && typeof m.metrics.auc_modelo === "number" ? m : null; // modelos antigos sem tagIdx são ignorados
  } catch {
    return null;
  }
}
