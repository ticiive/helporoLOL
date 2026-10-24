import { readFileSync, writeFileSync } from "fs";
import { draftCards } from "../../src/engine/draftScore.ts";
import { setLaneData } from "../../src/engine/lanedata.ts";
import { CH } from "../../src/engine/champions.ts";
const D = process.argv[2];
setLaneData(JSON.parse(readFileSync(`${D}/lane.json`, "utf8")));
const scaling = JSON.parse(readFileSync(`${D}/scaling.json`, "utf8"));
const test = JSON.parse(readFileSync(`${D}/test.json`, "utf8"));
const flags = (n: string | null) => (n ? CH[n] ?? "" : "");
const rows: number[][] = [];  // [vitória, matchup, sinergia, comp, meta, nota, posição no ranking]
let miss = 0;
for (const s of test) {
  const sup = s.ally.sup; if (!sup) continue;
  const ally = { top: s.ally.top ?? null, jg: s.ally.jg ?? null, mid: s.ally.mid ?? null, adc: s.ally.adc ?? null, sup: null };
  const enemy = { top: s.enemy.top ?? null, jg: s.enemy.jg ?? null, mid: s.enemy.mid ?? null, adc: s.enemy.adc ?? null, sup: s.enemy.sup ?? null };
  const cards = draftCards({ role: "sup", draft: { ally, enemy, bans: [] }, flags, counters: null, synergies: null, scaling, pool: [], stats: {} as any, exclude: [] });
  const i = cards.findIndex((c) => c.name === sup);
  if (i < 0) { miss++; continue; }
  const c = cards[i];
  rows.push([s.w ? 1 : 0, c.pts.matchup, c.pts.synergy, c.pts.comp, c.pts.meta, c.score, i / cards.length]);
}
writeFileSync(`${D}/bt_rows.json`, JSON.stringify(rows));
console.log("amostras", rows.length, "sem card", miss);
