/**
 * Ponte com o cliente do LoL (via comando Rust `champ_select`).
 * Converte a sessão da seleção de campeões no formato de Draft do motor.
 */
import { invoke } from "@tauri-apps/api/core";
import { BOTS, JUNGLERS, MIDS, SUPPORTS, TOPS } from "../engine/champions";
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

const SETS: [Role, Set<string>][] = [["top", TOPS], ["jg", JUNGLERS], ["mid", MIDS], ["adc", BOTS], ["sup", SUPPORTS]];
const rolesOf = (n: string | null) => (n ? SETS.filter(([, set]) => set.has(n)).map(([r]) => r) : []);

/**
 * Adivinha a rota de cada inimigo (a ranqueada esconde). Pontua cada combinação possível:
 * +2 se o campeão costuma ir naquela rota, +1 se o jogador baniu um campeão daquela rota
 * (quem bane costuma banir o que encontraria na própria lane).
 */
export function assignRoles(players: { name: string | null; ban?: string | null }[]): Team {
  const t = empty();
  const ps = players.filter((p) => p.name || p.ban).slice(0, 5);
  const score = (p: { name: string | null; ban?: string | null }, r: Role) =>
    (rolesOf(p.name).includes(r) ? 2 : 0) + (rolesOf(p.ban ?? null).includes(r) ? 1 : 0);
  let ties: Role[][] = [], bestScore = -1;
  const perm = (left: Role[], acc: Role[]) => {
    if (acc.length === ps.length) {
      const sc = acc.reduce((a, r, i) => a + score(ps[i], r), 0);
      if (sc > bestScore) { bestScore = sc; ties = [acc]; } else if (sc === bestScore) ties.push(acc);
      return;
    }
    left.forEach((r, i) => perm([...left.slice(0, i), ...left.slice(i + 1)], [...acc, r]));
  };
  perm([...ROLES], []);
  // Empate em quem é o sup (ex.: Lux e Senna sem o mid aparecer): não chuta, deixa o sup em aberto
  // pra regra de blind valer, e põe os campeões nas outras rotas.
  const supOf = (a: Role[]) => ps[a.indexOf("sup")]?.name ?? null;
  const supSure = ties.every((a) => supOf(a) === supOf(ties[0]));
  const best = supSure ? ties[0] : ties.find((a) => !supOf(a)) ?? ties[0];
  ps.forEach((p, i) => { if (p.name) t[best[i]] = p.name; });
  if (!supSure) t.sup = null;
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

  // ban de cada jogador inimigo, pelo dono da ação de ban
  const banBy = new Map<number, number>();
  (s.actions ?? []).flat().forEach((a) => { if (a.type === "ban" && a.completed && a.championId > 0) banBy.set(a.actorCellId, a.championId); });
  const enemyHasPos = s.theirTeam.some((c) => POS[c.assignedPosition ?? ""]);
  let enemy = empty();
  if (enemyHasPos) s.theirTeam.forEach((c) => { const r = POS[c.assignedPosition ?? ""], n = nameOf(c.championId); if (r && n) enemy[r] = n; });
  else enemy = assignRoles(s.theirTeam.map((c) => ({ name: nameOf(c.championId), ban: nameOf(banBy.get(c.cellId)) })));

  const banIds = new Set<number>([...(s.bans?.myTeamBans ?? []), ...(s.bans?.theirTeamBans ?? [])]);
  (s.actions ?? []).flat().forEach((a) => { if (a.type === "ban" && a.completed && a.championId > 0) banIds.add(a.championId); });
  const bans = [...banIds].map((id) => nameOf(id)).filter(Boolean) as string[];

  return { status: "active", draft: { ally, enemy, bans, myHover, myRole } };
}

// ---------- histórico pessoal ----------
interface HistGame {
  gameId: number; gameCreation: number; queueId: number;
  participants?: { championId: number; spell1Id?: number; spell2Id?: number; stats?: { win?: boolean } & Record<string, unknown>; timeline?: { lane?: string; role?: string } }[];
}
// Item de sup (linha do World Atlas) e Smite: dizem a rota com certeza, melhor que a lane do cliente
const SUP_ITEMS = new Set([3865, 3866, 3867, 3869, 3870, 3871, 3876, 3877]);
const SMITE = 11;
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
      const items = [0, 1, 2, 3, 4, 5, 6].map((i) => Number(p.stats?.[`item${i}`] ?? 0));
      const supItem = items.some((i) => SUP_ITEMS.has(i)), anyItem = items.some((i) => i > 0);
      let role: Role | null = supItem ? "sup" : p.spell1Id === SMITE || p.spell2Id === SMITE ? "jg" : roleOf(p.timeline?.lane, p.timeline?.role, champ);
      // o cliente disse "sup" mas não tinha item de sup: era o carry do bot (ou o mid, se a lane for mid)
      if (role === "sup" && !supItem && anyItem) role = (p.timeline?.lane ?? "").toUpperCase().startsWith("MID") ? "mid" : "adc";
      // o cliente disse outra rota mas tinha item de sup: era sup (ex.: sup que rodou pro mid)
      games.push({ id: g.gameId, t: g.gameCreation, champ, role, win: !!p.stats?.win });
    }
    if (list.length < 90) break;
  }
  return { account, games };
}
