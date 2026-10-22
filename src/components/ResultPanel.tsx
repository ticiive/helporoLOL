import { FACTORS, laneDefault, laneValue, type Result, type Settings } from "../engine/engine";
import { SUP_COLOR, type SupKey } from "../engine/data";
import { Icon } from "./ChampInput";
import { norm, type Catalog } from "../lib/ddragon";

interface Props { results: Result[]; risk: number; enemySup: string | null; settings: Settings; cat: Catalog; onLane: (k: SupKey, v: number | null) => void }

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

export function ResultPanel({ results, risk, enemySup, settings, cat, onLane }: Props) {
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
        {results.slice(0, 8).map((r) => {
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
