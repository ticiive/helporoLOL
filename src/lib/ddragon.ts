/**
 * Data Dragon: CDN oficial da Riot com ícones e dados dos campeões, liberado pra ferramentas de fã.
 * https://developer.riotgames.com/docs/lol#data-dragon
 */
import { CH, fallbackFlags } from "../engine/champions";

export interface Champ { name: string; id: string; key: number; tags: string[]; flags: string }
export interface Catalog { version: string; byName: Map<string, Champ>; byKey: Map<number, Champ>; list: Champ[] }

const CDN = "https://ddragon.leagueoflegends.com";
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");

export async function loadCatalog(): Promise<Catalog> {
  const versions: string[] = await fetch(`${CDN}/api/versions.json`).then((r) => r.json());
  const version = versions[0];
  const json = await fetch(`${CDN}/cdn/${version}/data/en_US/champion.json`).then((r) => r.json());
  const list: Champ[] = Object.values(json.data as Record<string, { id: string; key: string; name: string; tags: string[] }>).map((c) => ({
    name: c.name, id: c.id, key: +c.key, tags: c.tags, flags: CH[c.name] ?? fallbackFlags(c.tags),
  }));
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { version, list, byName: new Map(list.map((c) => [norm(c.name), c])), byKey: new Map(list.map((c) => [c.key, c])) };
}

/** Catálogo mínimo, sem ícones, pra quando não houver internet. */
export function offlineCatalog(): Catalog {
  const list: Champ[] = Object.keys(CH).sort().map((name, i) => ({ name, id: name.replace(/[^A-Za-z]/g, ""), key: -1 - i, tags: [], flags: CH[name] }));
  return { version: "", list, byName: new Map(list.map((c) => [norm(c.name), c])), byKey: new Map() };
}

export const iconUrl = (cat: Catalog, c: Champ) => (cat.version && c.key > 0 ? `${CDN}/cdn/${cat.version}/img/champion/${c.id}.png` : "");
