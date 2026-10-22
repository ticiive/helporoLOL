/**
 * Ponte com o cliente do LoL (via comando Rust `champ_select`).
 * Converte a sessão da seleção de campeões no formato de Draft do motor.
 */
import { invoke } from "@tauri-apps/api/core";
import { BOTS, JUNGLERS, SUPPORTS, TOPS } from "../engine/champions";
import { ROLES, type Role, type Team } from "../engine/engine";
import type { Catalog } from "./ddragon";
import { OWNER, type Game } from "./stats";

export const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Raw = { status: "offline" } | { status: "idle" } | { status: "active"; session: Session };
interface Cell { cellId: number; championId: number; championPickIntent?: number; assignedPosition?: string }
interface Action { type: string; championId: number; completed: boolean; actorCellId: number }
interface Session { localPlayerCellId: number; myTeam: Cell[]; theirTeam: Cell[]; actions?: Action[][]; bans?: { myTeamBans?: number[]; theirTeamBans?: number[] } }

export interface LiveDraft { ally: Team; enemy: Team; bans: string[]; myHover: string | null; myRole: Role | null }
export type LiveState = { status: "offline" | "idle" } | { status: "active"; draft: LiveDraft };

const POS: Record<string, Role> = { top: "top", jungle: "jg", middle: "mid", bottom: "adc", utility: "sup" };
const empty = (): Team => ({ top: null, jg: null, mid: null, adc: null, sup: null });

/** Adivinha a rota de cada inimigo quando o cliente não informa (ranqueada esconde). */
export function assignRoles(names: string[]): Team {
  const t = empty();
  const left = [...names];
  const take = (role: Role, set: Set<string>) => {
    if (t[role]) return;
    const i = left.findIndex((n) => set.has(n));
    if (i >= 0) t[role] = left.splice(i, 1)[0];
  };
  take("sup", SUPPORTS); take("adc", BOTS); take("jg", JUNGLERS); take("top", TOPS);
  for (const r of ROLES) if (!t[r] && left.length) t[r] = left.shift()!;
  return t;
}

export async function readChampSelect(cat: Catalog): Promise<LiveState> {
  const raw = await invoke<Raw>("champ_select");
  if (raw.status !== "active") return { status: raw.status };
  const s = raw.session;
  const nameOf = (id?: number) => (id && id > 0 ? cat.byKey.get(id)?.name ?? null : null);
  const ally = empty();
  let myHover: string | null = null, myRole: Role | null = null;
  const unplaced: string[] = [];
  for (const c of s.myTeam) {
    const name = nameOf(c.championId) ?? nameOf(c.championPickIntent);
    const role = POS[c.assignedPosition ?? ""];
    if (c.cellId === s.localPlayerCellId) { myHover = name; myRole = role ?? null; continue; }
    if (!name) continue;
    if (role && !ally[role]) ally[role] = name; else unplaced.push(name);
  }
  const mine: Role = myRole ?? "sup";
  for (const r of ROLES) if (r !== mine && !ally[r] && unplaced.length) ally[r] = unplaced.shift()!;
  ally[mine] = null; // esse slot é o seu

  const enemyNames = s.theirTeam.map((c) => nameOf(c.championId)).filter(Boolean) as string[];
  const enemyHasPos = s.theirTeam.some((c) => POS[c.assignedPosition ?? ""]);
  let enemy = empty();
  if (enemyHasPos) s.theirTeam.forEach((c) => { const r = POS[c.assignedPosition ?? ""], n = nameOf(c.championId); if (r && n) enemy[r] = n; });
  else enemy = assignRoles(enemyNames);

  const banIds = new Set<number>([...(s.bans?.myTeamBans ?? []), ...(s.bans?.theirTeamBans ?? [])]);
  (s.actions ?? []).flat().forEach((a) => { if (a.type === "ban" && a.completed && a.championId > 0) banIds.add(a.championId); });
  const bans = [...banIds].map((id) => nameOf(id)).filter(Boolean) as string[];

  return { status: "active", draft: { ally, enemy, bans, myHover, myRole } };
}

// ---------- histórico pessoal ----------
interface HistGame { gameId: number; gameCreation: number; queueId: number; participants?: { championId: number; stats?: { win?: boolean }; timeline?: { lane?: string; role?: string } }[] }
const RANKED = new Set([420, 440]); // solo/duo e flex

function roleOf(lane?: string, role?: string, champ?: string): Role | null {
  switch ((lane || "").toUpperCase()) {
    case "TOP": return "top";
    case "JUNGLE": return "jg";
    case "MID": case "MIDDLE": return "mid";
    case "BOTTOM": case "BOT": {
      const r = (role || "").toUpperCase();
      if (r.includes("SUPPORT")) return "sup";
      if (r.includes("CARRY")) return "adc";
      return champ && SUPPORTS.has(champ) ? "sup" : "adc";
    }
  }
  return null;
}

export interface Account { gameName: string; tagLine: string; isOwner: boolean }

/** Lê a conta logada e as partidas ranqueadas recentes do próprio cliente. */
export async function readHistory(cat: Catalog): Promise<{ account: Account; games: Game[] } | null> {
  const sum = await invoke<{ gameName?: string; tagLine?: string } | null>("current_summoner");
  if (!sum) return null;
  const account: Account = {
    gameName: sum.gameName ?? "", tagLine: sum.tagLine ?? "",
    isOwner: (sum.gameName ?? "").toLowerCase() === OWNER.gameName && (sum.tagLine ?? "").toLowerCase() === OWNER.tagLine,
  };
  const games: Game[] = [];
  for (const [beg, end] of [[0, 99], [100, 199]]) {
    const h = await invoke<{ games?: { games?: HistGame[] } } | null>("match_history", { beg, end });
    const list = h?.games?.games ?? [];
    for (const g of list) {
      const p = g.participants?.[0];
      if (!p || !RANKED.has(g.queueId)) continue;
      const champ = cat.byKey.get(p.championId)?.name;
      if (!champ) continue;
      games.push({ id: g.gameId, t: g.gameCreation, champ, role: roleOf(p.timeline?.lane, p.timeline?.role, champ), win: !!p.stats?.win });
    }
    if (list.length < 90) break;
  }
  return { account, games };
}
