/**
 * Data Dragon: CDN oficial da Riot com ícones e dados dos campeões, liberado pra ferramentas de fã.
 * https://developer.riotgames.com/docs/lol#data-dragon
 */
import { CH, fallbackFlags } from "../engine/champions";
import { ROSTER } from "../engine/roster";

export interface Champ { name: string; id: string; key: number; tags: string[]; flags: string; diff: number; ranged: boolean }
export interface Catalog { version: string; byName: Map<string, Champ>; byKey: Map<number, Champ>; list: Champ[] }

const CDN = "https://ddragon.leagueoflegends.com";
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");

export async function loadCatalog(): Promise<Catalog> {
  const versions: string[] = await fetch(`${CDN}/api/versions.json`).then((r) => r.json());
  const version = versions[0];
  const json = await fetch(`${CDN}/cdn/${version}/data/en_US/champion.json`).then((r) => r.json());
  const list: Champ[] = Object.values(json.data as Record<string, { id: string; key: string; name: string; tags: string[]; info: { difficulty: number }; stats: { attackrange: number } }>).map((c) => ({
    name: c.name, id: c.id, key: +c.key, tags: c.tags, flags: CH[c.name] ?? fallbackFlags(c.tags),
    diff: c.info?.difficulty ?? 5, ranged: (c.stats?.attackrange ?? 0) > 300,
  }));
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { version, list, byName: new Map(list.map((c) => [norm(c.name), c])), byKey: new Map(list.map((c) => [c.key, c])) };
}

/** Catálogo embutido (todos os campeões, sem ícones), pra quando o Data Dragon não carregar. */
export function offlineCatalog(): Catalog {
  const list: Champ[] = ROSTER.map((r) => {
    const flags = CH[r.name] ?? fallbackFlags(r.tags);
    return { name: r.name, id: r.name.replace(/[^A-Za-z]/g, ""), key: r.key, tags: r.tags, flags, diff: r.diff || 5, ranged: r.range ? r.range > 300 : !flags.includes("M") };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { version: "", list, byName: new Map(list.map((c) => [norm(c.name), c])), byKey: new Map(list.map((c) => [c.key, c])) };
}

export const iconUrl = (cat: Catalog, c: Champ) => (cat.version && c.key > 0 ? `${CDN}/cdn/${cat.version}/img/champion/${c.id}.png` : "");
