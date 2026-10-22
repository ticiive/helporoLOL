/**
 * Ponte com o cliente do LoL (via comando Rust `champ_select`).
 * Converte a sessão da seleção de campeões no formato de Draft do motor.
 */
import { invoke } from "@tauri-apps/api/core";
import { BOTS, JUNGLERS, SUPPORTS, TOPS } from "../engine/champions";
import { ROLES, type Role, type Team } from "../engine/engine";
import type { Catalog } from "./ddragon";

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
  for (const r of ROLES) if (r !== "sup" && !ally[r] && unplaced.length) ally[r] = unplaced.shift()!;
  ally.sup = null; // o slot de sup é o seu

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
