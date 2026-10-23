/**
 * Runas, builds e counters calculados das partidas Mestre+ (model/builds.py),
 * baixados da branch "data". Nomes e ícones de runas e itens vêm do Data Dragon.
 */
import { ccThreat, type Counters } from "../engine/engine";
import { SNAPSHOT, SNAP_COUNTERS, shardId } from "../engine/snapshot";

const RAW = "https://raw.githubusercontent.com/ticiive/helporoLOL/data/model/out";
const CDN = "https://ddragon.leagueoflegends.com";

export interface Situational { item: number; cond: string; quando: string; wr: number; jogos: number; ganho: number }
export interface Build {
  jogos: number; wr: number;
  runas: { primaria: number; secundaria: number; perks: number[]; fragmentos: number[]; jogos: number; wr: number };
  feiticos: number[]; botas: number | null; item_sup: number | null; core: number[]; situacionais: Situational[];
  /** de onde veio: dados Mestre+ próprios ou o snapshot provisório do op.gg */
  fonte?: "mestre" | "opgg"; extras?: number[];
}
export type Builds = Record<string, Record<string, Build>>;

async function getJson<T>(name: string): Promise<T | null> {
  const key = `helporo.${name}`;
  try {
    const r = await fetch(`${RAW}/${name}`, { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as T;
      try { localStorage.setItem(key, JSON.stringify(j)); } catch { /* cheio */ }
      return j;
    }
  } catch { /* offline */ }
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
export const loadBuilds = () => getJson<Builds>("builds.json");
/** Counters Mestre+ próprios; onde ainda não há dado, completa com o snapshot do op.gg. */
export const loadCounters = async () => {
  const own = (await getJson<Counters>("counters.json")) ?? {};
  const out: Counters = JSON.parse(JSON.stringify(SNAP_COUNTERS));
  // dado próprio só substitui o op.gg quando tem amostra de verdade (3+ campeões com 100+ jogos)
  for (const [role, m] of Object.entries(own)) { out[role] = out[role] ?? {}; for (const [opp, rows] of Object.entries(m)) { const ok = rows.filter((r) => r[2] >= MIN_N); if (ok.length >= 3) out[role][opp] = ok; } }
  return out;
};
const MIN_N = 100;
export const loadSynergies = async () => {
  const own = await getJson<Counters>("synergies.json");
  if (!own) return null;
  const out: Counters = {};
  for (const [role, m] of Object.entries(own)) { out[role] = {}; for (const [p, rows] of Object.entries(m)) { const ok = rows.filter((r) => r[2] >= MIN_N); if (ok.length) out[role][p] = ok; } }
  return out;
};

/** Nomes e ícones de runas, itens e feitiços (Data Dragon, em português). */
export interface Names {
  runes: Map<number, { name: string; icon: string }>; items: Map<number, string>; spells: Map<number, { name: string; img: string }>; version: string;
  /** nome em inglês -> id, pra converter o snapshot do op.gg */
  idOf: { rune: Map<string, number>; item: Map<string, number>; spell: Map<string, number> };
}
export async function loadNames(version: string): Promise<Names | null> {
  if (!version) return null;
  try {
    const base = `${CDN}/cdn/${version}/data/pt_BR`;
    const en = `${CDN}/cdn/${version}/data/en_US`;
    const [runes, items, spells, runesEn, itemsEn, spellsEn] = await Promise.all(
      [`${base}/runesReforged.json`, `${base}/item.json`, `${base}/summoner.json`, `${en}/runesReforged.json`, `${en}/item.json`, `${en}/summoner.json`].map((u) => fetch(u).then((r) => r.json())),
    );
    const low = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
    const runeId = new Map<string, number>();
    for (const st of runesEn as { id: number; name: string; slots: { runes: { id: number; name: string }[] }[] }[]) {
      runeId.set(low(st.name), st.id);
      st.slots.forEach((sl) => sl.runes.forEach((r) => runeId.set(low(r.name), r.id)));
    }
    const itemId = new Map<string, number>(Object.entries((itemsEn as { data: Record<string, { name: string }> }).data).map(([id, v]) => [low(v.name), +id]));
    const spellId = new Map<string, number>(Object.values((spellsEn as { data: Record<string, { key: string; name: string }> }).data).map((v) => [low(v.name), +v.key]));
    const rm = new Map<number, { name: string; icon: string }>();
    for (const style of runes as { id: number; name: string; icon: string; slots: { runes: { id: number; name: string; icon: string }[] }[] }[]) {
      rm.set(style.id, { name: style.name, icon: style.icon });
      style.slots.forEach((sl) => sl.runes.forEach((r) => rm.set(r.id, { name: r.name, icon: r.icon })));
    }
    const im = new Map<number, string>(Object.entries((items as { data: Record<string, { name: string }> }).data).map(([id, v]) => [+id, v.name]));
    const sm = new Map<number, { name: string; img: string }>(
      Object.values((spells as { data: Record<string, { key: string; name: string; image: { full: string } }> }).data).map((v) => [+v.key, { name: v.name, img: v.image.full }]),
    );
    return { runes: rm, items: im, spells: sm, version, idOf: { rune: runeId, item: itemId, spell: spellId } };
  } catch {
    return null;
  }
}
export const runeIcon = (icon: string) => `${CDN}/cdn/img/${icon}`;
export const itemIcon = (v: string, id: number) => `${CDN}/cdn/${v}/img/item/${id}.png`;
export const spellIcon = (v: string, img: string) => `${CDN}/cdn/${v}/img/spell/${img}`;

const SHARD: Record<number, string> = { 5008: "Força adaptativa", 5005: "Velocidade de ataque", 5007: "Aceleração de habilidade", 5002: "Armadura", 5003: "Resistência mágica", 5001: "Vida (escalável)", 5011: "Vida", 5010: "Velocidade de movimento", 5013: "Tenacidade e resistência a lentidão" };
export const shardName = (id: number) => SHARD[id] ?? `#${id}`;

// mesmas condições do builds.py, avaliadas no draft atual
const HEALERS = new Set(["Soraka", "Yuumi", "Sona", "Nami", "Milio", "Aatrox", "Vladimir", "Dr. Mundo", "Warwick", "Sylas", "Fiddlesticks", "Swain", "Briar", "Olaf", "Illaoi", "Renekton", "Seraphine", "Senna", "Taric", "Bel'Veth"]);
export function activeConditions(enemies: string[], flags: (n: string) => string): Set<string> {
  const f = enemies.map(flags);
  const c = new Set<string>();
  if (f.filter((x) => x.includes("P") && !x.includes("A")).length >= 3) c.add("magico");
  if (f.filter((x) => x.includes("A") && !x.includes("P")).length >= 3) c.add("fisico");
  if (enemies.filter((n) => HEALERS.has(n)).length >= 2) c.add("cura");
  if (f.filter((x) => /[XD]/.test(x)).length >= 2) c.add("assassinos");
  if (f.filter((x) => x.includes("F")).length >= 2) c.add("tanques");
  if (ccThreat(enemies, (n) => (n ? flags(n) : "")).level === 2) c.add("cc");
  return c;
}

/** Build do snapshot do op.gg convertida pra IDs (nomes que o Data Dragon não reconhece ficam de fora). */
export function snapshotBuild(champ: string, role: string, n: Names | null): Build | undefined {
  const sb = SNAPSHOT[role]?.[champ];
  if (!sb || !n) return undefined;
  const low = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
  const r = (x: string) => n.idOf.rune.get(low(x)) ?? 0;
  const it = (x: string) => n.idOf.item.get(low(x)) ?? 0;
  const perks = [sb.keystone, ...sb.primary, ...sb.secondary].map(r);
  return {
    jogos: sb.runeGames, wr: sb.runeWinRate, fonte: "opgg",
    runas: { primaria: r(sb.primaryTree), secundaria: r(sb.secondaryTree), perks, fragmentos: sb.shards.map(shardId), jogos: sb.runeGames, wr: sb.runeWinRate },
    feiticos: sb.spells.map((x) => n.idOf.spell.get(low(x)) ?? 0).filter(Boolean),
    botas: it(sb.boots) || null, item_sup: null,
    core: sb.core.map(it).filter(Boolean), situacionais: [], extras: sb.situational.map(it).filter(Boolean),
  };
}
