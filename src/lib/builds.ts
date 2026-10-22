/**
 * Runas, builds e counters calculados das partidas Mestre+ (model/builds.py),
 * baixados da branch "data". Nomes e ícones de runas e itens vêm do Data Dragon.
 */
import type { Counters } from "../engine/engine";

const RAW = "https://raw.githubusercontent.com/ticiive/helporoLOL/data/model/out";
const CDN = "https://ddragon.leagueoflegends.com";

export interface Situational { item: number; cond: string; quando: string; wr: number; jogos: number; ganho: number }
export interface Build {
  jogos: number; wr: number;
  runas: { primaria: number; secundaria: number; perks: number[]; fragmentos: number[]; jogos: number; wr: number };
  feiticos: number[]; botas: number | null; item_sup: number | null; core: number[]; situacionais: Situational[];
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
export const loadCounters = () => getJson<Counters>("counters.json");
export const loadSynergies = () => getJson<Counters>("synergies.json");

/** Nomes e ícones de runas, itens e feitiços (Data Dragon, em português). */
export interface Names { runes: Map<number, { name: string; icon: string }>; items: Map<number, string>; spells: Map<number, { name: string; img: string }>; version: string }
export async function loadNames(version: string): Promise<Names | null> {
  if (!version) return null;
  try {
    const base = `${CDN}/cdn/${version}/data/pt_BR`;
    const [runes, items, spells] = await Promise.all([`${base}/runesReforged.json`, `${base}/item.json`, `${base}/summoner.json`].map((u) => fetch(u).then((r) => r.json())));
    const rm = new Map<number, { name: string; icon: string }>();
    for (const style of runes as { id: number; name: string; icon: string; slots: { runes: { id: number; name: string; icon: string }[] }[] }[]) {
      rm.set(style.id, { name: style.name, icon: style.icon });
      style.slots.forEach((sl) => sl.runes.forEach((r) => rm.set(r.id, { name: r.name, icon: r.icon })));
    }
    const im = new Map<number, string>(Object.entries((items as { data: Record<string, { name: string }> }).data).map(([id, v]) => [+id, v.name]));
    const sm = new Map<number, { name: string; img: string }>(
      Object.values((spells as { data: Record<string, { key: string; name: string; image: { full: string } }> }).data).map((v) => [+v.key, { name: v.name, img: v.image.full }]),
    );
    return { runes: rm, items: im, spells: sm, version };
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
  if (f.filter((x) => /[CE]/.test(x)).length >= 3) c.add("cc");
  return c;
}
