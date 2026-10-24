import type { Game } from "../lib/stats";
import type { Bench } from "../lib/builds";

/**
 * Revisão da última partida: compara com a média Mestre+/D1 BR do mesmo campeão na mesma rota
 * e escolhe UM foco pro próximo jogo (a métrica mais abaixo da média).
 */
const METRICS: { k: string; label: string; better: 1 | -1; of: (g: Game) => number | null; fmt: (v: number) => string; focus: string; roles?: string[] }[] = [
  { k: "d10", label: "Mortes a cada 10 min", better: -1, of: (g) => (g.s && g.min ? (10 * g.s.d) / g.min : null), fmt: (v) => v.toFixed(1),
    focus: "morrer menos: ward antes de avançar, respeite a névoa e saia da lane quando o jungle deles sumir do mapa" },
  { k: "vs", label: "Visão por minuto", better: 1, of: (g) => (g.s && g.min ? g.s.vs / g.min : null), fmt: (v) => v.toFixed(2),
    focus: "visão: use a lente, troque o trinket na hora certa e ward antes de cada objetivo" },
  { k: "cw", label: "Controles a cada 10 min", better: 1, of: (g) => (g.s && g.min ? (10 * g.s.cw) / g.min : null), fmt: (v) => v.toFixed(1),
    focus: "comprar ward de controle a cada volta pra base, principalmente antes de drag e arauto" },
  { k: "cs", label: "CS por minuto", better: 1, of: (g) => (g.s && g.min ? g.s.cs / g.min : null), fmt: (v) => v.toFixed(1), roles: ["top", "jg", "mid", "adc"],
    focus: "farm: não perca wave andando sem motivo e pegue os campos/waves do lado antes de agrupar" },
  { k: "dmg", label: "Dano em campeões por min", better: 1, of: (g) => (g.s && g.min ? g.s.dmg / g.min : null), fmt: (v) => Math.round(v).toString(),
    focus: "participar mais das lutas com dano, sem ficar de fora esperando" },
];

export function PostGame({ games, bench }: { games: Game[]; bench: Bench | null }) {
  const last = [...games].filter((g) => g.s && g.min && g.min >= 15).sort((a, b) => b.t - a.t)[0];
  if (!last) return null;
  const ref = last.role ? bench?.[last.role]?.[last.champ] : undefined;
  const rows = METRICS.filter((m) => !m.roles || (last.role && m.roles.includes(last.role))).map((m) => {
    const v = m.of(last);
    const b = ref?.[m.k] as [number, number] | undefined;
    const z = v !== null && b && b[1] > 0 ? ((v - b[0]) / b[1]) * m.better : null;
    return { m, v, b, z };
  });
  const worst = rows.filter((r) => r.z !== null).sort((a, b) => a.z! - b.z!)[0];
  const when = new Date(last.t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <section className="plan postgame">
      <h2>Revisão da última partida</h2>
      <p className="note">{last.champ} {last.role ?? ""} · {last.win ? "vitória" : "derrota"} · {Math.round(last.min!)} min · {when} · {last.s!.k}/{last.s!.d}/{last.s!.a}</p>
      <div className="pg">
        {rows.map(({ m, v, b, z }) => (
          <div key={m.k} className={`pgm ${z === null ? "" : z >= 0.3 ? "good" : z <= -0.5 ? "bad" : ""}`}>
            <span>{m.label}</span>
            <b>{v === null ? "-" : m.fmt(v)}</b>
            <small>{b ? `média Mestre+: ${m.fmt(b[0])}` : "sem média ainda"}</small>
          </div>
        ))}
      </div>
      {worst && worst.z! < -0.3
        ? <div className="verdict tarde"><b>Foco pro próximo jogo:</b> {worst.m.focus}.</div>
        : ref ? <div className="verdict"><b>Na média ou acima em tudo.</b> Segue o plano.</div>
        : <p className="note">A média Mestre+ de {last.champ} aparece depois que a coleta juntar partidas com estatísticas (próximas rodadas).</p>}
    </section>
  );
}
