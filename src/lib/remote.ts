/** Suas partidas pela API da Riot, sem o cliente do LoL: o GitHub Actions (model/my_matches.py) baixa e publica na branch "me". */
import type { Catalog } from "./ddragon";
import type { Game } from "./stats";

const ME = "https://raw.githubusercontent.com/ticiive/helporoLOL/me/me";

interface Row { id: number; t: number; championId: number; role: Game["role"]; win: boolean; min: number; s: Game["s"] }

export async function remoteGames(cat: Catalog): Promise<{ games: Game[]; at: number } | null> {
  try {
    const r = await fetch(`${ME}/index.json`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { at: number; games: Row[] };
    const games = j.games.map((g) => ({ id: g.id, t: g.t, champ: cat.byKey.get(g.championId)?.name ?? `#${g.championId}`, role: g.role, win: g.win, min: g.min, s: g.s }) as Game);
    return { games, at: j.at };
  } catch { return null; }
}

export async function remoteMatch(id: number): Promise<{ game: unknown; timeline: unknown } | null> {
  try { const r = await fetch(`${ME}/${id}.json`, { cache: "force-cache" }); return r.ok ? await r.json() : null; } catch { return null; }
}
