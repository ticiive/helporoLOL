import { FACTORS, laneDefault, laneValue, type Result, type Settings } from "../engine/engine";
import { SUPS, SUP_COLOR, type SupKey } from "../engine/data";
import { Icon } from "./ChampInput";
import { norm, type Catalog } from "../lib/ddragon";

interface Props { results: Result[]; risk: number; enemySup: string | null; settings: Settings; cat: Catalog; onLane: (k: SupKey, v: number | null) => void }

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

export function ResultPanel({ results, risk, enemySup, settings, cat, onLane }: Props) {
  const top = results[0];
  if (!top || top.status !== "ok") return <p className="empty">Nenhum campeão do seu pool está disponível.</p>;
  const pos = top.why.filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 4);
  const neg = top.why.filter((x) => x[0] < 0).sort((a, b) => a[0] - b[0]).slice(0, 3);
  const champ = cat.byName.get(norm(SUPS[top.k])) ?? null;
  return (
    <div className="result">
      <div className="pick" style={{ ["--c" as string]: SUP_COLOR[top.k] }}>
        <Icon cat={cat} champ={champ} size={76} ring={SUP_COLOR[top.k]} />
        <div>
          <div className="n">{SUPS[top.k]}</div>
          <div className="s">{risk >= 0.45 ? "Pick mais seguro com o que dá pra ver" : "Melhor encaixe pra esse draft"} · nota {top.score > 0 ? "+" : ""}{top.score.toFixed(1)}</div>
        </div>
      </div>
      <div className="why">
        {pos.map((x) => <div key={x[1]} className="p">{x[1]}</div>)}
        {neg.map((x) => <div key={x[1]} className="m">{x[1]}</div>)}
      </div>
      <div className="lbl">De onde vem a nota</div>
      <div className="bars">{FACTORS.map(([id, l]) => <Bar key={id} label={l} v={top.f[id] * settings.weights[id]} />)}</div>
      <div className="lbl">Ranking{enemySup ? ` · sua lane vs ${enemySup} (clica pra corrigir)` : ""}</div>
      <div className="alts">
        {results.map((r) => {
          const c = cat.byName.get(norm(SUPS[r.k])) ?? null;
          const lv = enemySup ? laneValue(settings, r.k, enemySup) : 0;
          const mod = enemySup ? settings.lane[`${r.k}|${enemySup}`] !== undefined : false;
          return (
            <div key={r.k} className={`alt ${r.status !== "ok" ? "out" : ""}`} style={{ ["--c" as string]: SUP_COLOR[r.k] }}>
              <Icon cat={cat} champ={c} size={26} ring={SUP_COLOR[r.k]} />
              <b>{SUPS[r.k]}</b>
              {enemySup && r.status === "ok" ? (
                <div className="lane" title={`Sua lane de ${SUPS[r.k]} vs ${enemySup}`}>
                  {[-2, -1, 0, 1, 2].map((n) => (
                    <button key={n} data-v={n} aria-pressed={n === lv} className={n === lv && mod ? "mod" : ""}
                      onClick={() => onLane(r.k, n === laneDefault(r.k, enemySup) ? null : n)}>{n > 0 ? "+" : ""}{n}</button>
                  ))}
                </div>
              ) : <span />}
              <span className="sc">{r.status === "banned" ? "banida" : r.status === "picked" ? "pickada" : r.status === "out" ? "fora" : `${r.score > 0 ? "+" : ""}${r.score.toFixed(1)}`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
