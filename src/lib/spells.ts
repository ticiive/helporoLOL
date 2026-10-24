/** Nomes (em português) e recargas das habilidades de cada campeão, pelo Data Dragon. Fica em cache por versão. */
import type { Catalog } from "./ddragon";
import { norm } from "./ddragon";

const CDN = "https://ddragon.leagueoflegends.com";
export interface Spell { name: string; cd: number[] }
export type Kit = { P: string; Q: Spell; W: Spell; E: Spell; R: Spell };
const mem = new Map<string, Kit>();

export async function loadKits(cat: Catalog, names: string[]): Promise<Map<string, Kit>> {
  const out = new Map<string, Kit>();
  await Promise.all(names.map(async (n) => {
    const c = cat.byName.get(norm(n)); if (!c || !cat.version) return;
    const k = `${cat.version}:${c.id}`;
    let kit = mem.get(k);
    if (!kit) {
      try { const s = localStorage.getItem(`helporo.kit.${k}`); if (s) kit = JSON.parse(s); } catch { /* sem storage */ }
    }
    if (!kit) {
      try {
        const j = await (await fetch(`${CDN}/cdn/${cat.version}/data/pt_BR/champion/${c.id}.json`)).json();
        const d = j.data[c.id];
        const sp = (i: number): Spell => ({ name: d.spells[i].name, cd: d.spells[i].cooldown });
        kit = { P: d.passive.name, Q: sp(0), W: sp(1), E: sp(2), R: sp(3) };
        try { localStorage.setItem(`helporo.kit.${k}`, JSON.stringify(kit)); } catch { /* cheio */ }
      } catch { return; }
    }
    mem.set(k, kit); out.set(n, kit);
  }));
  return out;
}
