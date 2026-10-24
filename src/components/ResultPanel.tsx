import { FACTORS, laneDefault, laneValue, type Result, type Settings } from "../engine/engine";
import { META, MU, SUPS, SUP_COLOR, SUP_KEYS, SYN_ADC, type SupKey } from "../engine/data";
import { ADC_BASE, duo } from "../engine/botlane";
import { combinedVsSup, ownVsAdc } from "../engine/lanedata";
import { Icon } from "./ChampInput";
import { norm, type Catalog } from "../lib/ddragon";

interface Props { results: Result[]; risk: number; enemySup: string | null; enemyAdc?: string | null; myAdc?: string | null; settings: Settings; cat: Catalog; onLane: (k: SupKey, v: number | null) => void }

const KEY_OF = Object.fromEntries(SUP_KEYS.map((k) => [SUPS[k], k])) as Record<string, SupKey>;
/** "bom contra X" / "bom com X" de cada sup: tabela maior (Lolalytics) nos 6 sups, op.gg nos outros. */
export function botChips(name: string, es: string | null, adc: string | null, ea: string | null = null) {
  const out: { t: string; c: "good" | "bad" | "flat" }[] = [];
  const k = KEY_OF[name];
  if (es) {
    const m = combinedVsSup(name, es) ?? (k && MU[k][es] ? { wr: MU[k][es].wr, n: MU[k][es].n } : null);
    if (m && m.n >= 150) out.push({ t: `${m.wr >= 51.5 ? "bom" : m.wr <= 48.5 ? "ruim" : "neutro"} contra ${es} ${m.wr.toFixed(1)}%`, c: m.wr >= 51.5 ? "good" : m.wr <= 48.5 ? "bad" : "flat" });
  }
  if (ea) {
    const r = ownVsAdc(name, ea);
    if (r && r.n >= 40) { const d = r.wr - r.base; out.push({ t: `${d >= 1.5 ? "bom" : d <= -1.5 ? "ruim" : "neutro"} contra ${ea} (ADC) ${r.wr.toFixed(1)}%`, c: d >= 1.5 ? "good" : d <= -1.5 ? "bad" : "flat" }); }
  }
  if (adc) {
    const d = duo(adc, name) ?? (k && SYN_ADC[k][adc] ? { delta: SYN_ADC[k][adc].wr - (META[k].wr + (ADC_BASE[adc] ?? 50) - 50), wr: SYN_ADC[k][adc].wr, n: SYN_ADC[k][adc].n } : null);
    if (d && d.n >= 200) out.push({ t: `${d.delta >= 1 ? "bom" : d.delta <= -1 ? "ruim" : "neutro"} com ${adc} ${d.wr.toFixed(1)}% (${d.delta >= 0 ? "+" : ""}${d.delta.toFixed(1)})`, c: d.delta >= 1 ? "good" : d.delta <= -1 ? "bad" : "flat" });
  }
  return out;
}

const colorOf = (r: Result) => (r.sup ? SUP_COLOR[r.sup] : "var(--gold)");

function Bar({ label, v }: { label: string; v: number }) {
  const pct = Math.min(50, (Math.abs(v) / 4) * 50);
  const color = v > 0.05 ? "var(--good)" : v < -0.05 ? "var(--bad)" : "var(--muted)";
  return (
    <div className="bar">
      <span className="t">{label}</span>
      <div className="track"><div className="fill" style={v >= 0 ? { left: "50%", width: `${pct}%`, background: "var(--good)" } : { right: "50%", width: `${pct}%`, background: "var(--bad)" }} /></div>
      <span className="v" style={{ color }}>{v > 0 ? "+" : ""}{v.toFixed(1)}</span>
    </div>
  );
}

export function ResultPanel({ results, risk, enemySup, enemyAdc = null, myAdc = null, settings, cat, onLane }: Props) {
  const top = results[0];
  if (!top || top.status !== "ok") return <p className="empty">Nenhum campeão disponível pra essa rota. Adiciona opções no pool da rota, lá embaixo.</p>;
  const pos = top.why.filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 4);
  const neg = top.why.filter((x) => x[0] < 0).sort((a, b) => a[0] - b[0]).slice(0, 3);
  const anySup = results.some((r) => r.sup);
  return (
    <div className="result">
      <div className="pick" style={{ ["--c" as string]: colorOf(top) }}>
        <Icon cat={cat} champ={cat.byName.get(norm(top.name)) ?? null} size={76} ring={colorOf(top)} />
        <div>
          <div className="n">{top.name}</div>
          <div className="s">{risk >= 0.45 ? "Pick mais seguro com o que dá pra ver" : "Melhor encaixe pra esse draft"} · nota {top.score > 0 ? "+" : ""}{top.score.toFixed(1)}</div>
        </div>
      </div>
      <div className="why">
        {pos.map((x) => <div key={x[1]} className="p">{x[1]}</div>)}
        {neg.map((x) => <div key={x[1]} className="m">{x[1]}</div>)}
      </div>
      <div className="lbl">De onde vem a nota</div>
      <div className="bars">{FACTORS.map(([id, l]) => <Bar key={id} label={l} v={top.f[id] * settings.weights[id]} />)}</div>
      <div className="lbl">Ranking{enemySup && anySup ? ` · sua lane vs ${enemySup} (clica pra corrigir)` : ""}</div>
      <div className="alts">
        {results.slice(0, anySup ? 12 : 8).map((r) => {
          const lv = enemySup && r.sup ? laneValue(settings, r.sup, enemySup) : 0;
          const mod = enemySup && r.sup ? settings.lane[`${r.sup}|${enemySup}`] !== undefined : false;
          return (
            <div key={r.name} className={`alt ${r.status !== "ok" ? "out" : ""}`} style={{ ["--c" as string]: colorOf(r) }}>
              <Icon cat={cat} champ={cat.byName.get(norm(r.name)) ?? null} size={26} ring={colorOf(r)} />
              <b>{r.name}<small>{r.games ? ` ${r.games} jogos` : ""}</small></b>
              {enemySup && r.sup && r.status === "ok" ? (
                <div className="lane" title={`Sua lane de ${r.name} vs ${enemySup}`}>
                  {[-2, -1, 0, 1, 2].map((n) => (
                    <button key={n} data-v={n} aria-pressed={n === lv} className={n === lv && mod ? "mod" : ""}
                      onClick={() => onLane(r.sup!, n === laneDefault(r.sup!, enemySup) ? null : n)}>{n > 0 ? "+" : ""}{n}</button>
                  ))}
                </div>
              ) : <span />}
              <span className="sc">{r.status === "banned" ? "banido" : r.status === "picked" ? "pickado" : `${r.score > 0 ? "+" : ""}${r.score.toFixed(1)}`}</span>
              {anySup && (enemySup || myAdc || enemyAdc) && <div className="chips">{botChips(r.name, enemySup, myAdc, enemyAdc).map((c) => <span key={c.t} className={`chip ${c.c}`}>{c.t}</span>)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
