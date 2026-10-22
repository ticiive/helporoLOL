/**
 * Estatísticas pessoais.
 *
 * Base: temporada 2026 até 22/10/2026 (op.gg, ranqueadas), por campeão.
 * Depois disso, o app lê o histórico do próprio cliente do LoL e soma cada partida
 * ranqueada nova (guardada por gameId, então nada conta duas vezes). Quanto mais
 * você joga com o app aberto, mais o histórico cresce.
 */
import type { Role } from "../engine/engine";
import { BOTS, JUNGLERS, MIDS, SUPPORTS } from "../engine/champions";

export const OWNER = { gameName: "ticiive", tagLine: "lett" };
export const SEED_UNTIL = Date.UTC(2026, 9, 22, 13, 0); // 22/10/2026 10h (Brasília)

/** [vitórias, derrotas] na temporada 2026 até SEED_UNTIL */
const SEED: Record<string, [number, number]> = {
  Soraka: [57, 45], Bard: [26, 37], Sona: [11, 6], Nami: [8, 7], Malzahar: [6, 5], Lulu: [4, 3], Janna: [2, 4], Yuumi: [1, 5],
  Karma: [3, 2], Seraphine: [2, 2], Lux: [1, 3], Orianna: [1, 3], Blitzcrank: [2, 0], Milio: [1, 1], Ivern: [0, 2], Amumu: [0, 2],
  Xerath: [0, 2], Rakan: [1, 0], Maokai: [1, 0], Senna: [1, 0], Neeko: [1, 0], Ahri: [1, 0], Ziggs: [1, 0], Pyke: [1, 0],
  Morgana: [1, 0], Poppy: [0, 1], Nautilus: [0, 1], Syndra: [0, 1], Veigar: [0, 1], Heimerdinger: [0, 1], Qiyana: [0, 1],
};

/** Rotas que eu já sei que joguei fora do padrão (a base do op.gg não separa por rota). */
const SEED_ROLE: Record<string, Role> = { Lux: "mid" };

/** Rota padrão do campeão, quando não há partidas do cliente pra dividir a base. */
function seedRole(name: string): Role {
  if (SEED_ROLE[name]) return SEED_ROLE[name];
  if (SUPPORTS.has(name)) return "sup";
  if (JUNGLERS.has(name)) return "jg";
  if (MIDS.has(name)) return "mid";
  if (BOTS.has(name)) return "adc";
  return "mid";
}

export interface Game { id: number; t: number; champ: string; role: Role | null; win: boolean }
export interface ChampStat { w: number; l: number; byRole: Partial<Record<Role, { w: number; l: number }>> }
export type Stats = Record<string, ChampStat>;

/** Jogos guardados por conta (nome#tag), pra não misturar smurfs. */
const key = (acc: string) => `helporo.games.${acc.toLowerCase()}`;
export function loadGames(acc: string): Game[] { try { return JSON.parse(localStorage.getItem(key(acc)) || "[]"); } catch { return []; } }
export function saveGames(acc: string, g: Game[]) { try { localStorage.setItem(key(acc), JSON.stringify(g)); } catch { /* sem storage */ } }

/** Junta jogos novos aos já guardados, sem repetir. Retorna quantos entraram. */
export function mergeGames(old: Game[], fresh: Game[]): [Game[], number] {
  const ids = new Set(old.map((g) => g.id));
  const add = fresh.filter((g) => !ids.has(g.id));
  return [[...old, ...add].sort((a, b) => b.t - a.t), add.length];
}

export function buildStats(games: Game[], useSeed: boolean): Stats {
  const s: Stats = {};
  const put = (champ: string, role: Role | null, w: number, l: number) => {
    const c = (s[champ] ??= { w: 0, l: 0, byRole: {} });
    c.w += w; c.l += l;
    if (role) { const r = (c.byRole[role] ??= { w: 0, l: 0 }); r.w += w; r.l += l; }
  };
  if (useSeed) {
    // Divide a base entre as rotas na mesma proporção das partidas do cliente anteriores à base
    // (ex.: se 20% das suas Sorakas lidas do cliente foram mid, 20% da base vai pro mid).
    const before = games.filter((g) => g.t <= SEED_UNTIL && g.role);
    for (const [n, [w, l]] of Object.entries(SEED)) {
      const mine = before.filter((g) => g.champ === n);
      if (!mine.length) { put(n, seedRole(n), w, l); continue; }
      const byRole = new Map<Role, number>();
      mine.forEach((g) => byRole.set(g.role!, (byRole.get(g.role!) ?? 0) + 1));
      let rw = w, rl = l;
      const entries = [...byRole.entries()].sort((a, b) => b[1] - a[1]);
      entries.forEach(([role, c], i) => {
        const last = i === entries.length - 1;
        const pw = last ? rw : Math.round((w * c) / mine.length), pl = last ? rl : Math.round((l * c) / mine.length);
        put(n, role, pw, pl); rw -= pw; rl -= pl;
      });
    }
  }
  for (const g of games) if (!useSeed || g.t > SEED_UNTIL) put(g.champ, g.role, g.win ? 1 : 0, g.win ? 0 : 1);
  return s;
}

export function overall(s: Stats) {
  let w = 0, l = 0;
  Object.values(s).forEach((c) => { w += c.w; l += c.l; });
  return { w, l, wr: w + l ? w / (w + l) : 0.5 };
}
