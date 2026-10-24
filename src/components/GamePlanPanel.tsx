import { PHASES, type Plan } from "../engine/gameplan";

/** Plano de jogo: curva de força por duração, em volta de quem jogar e o que evitar. */
export function GamePlanPanel({ plan }: { plan: Plan | null }) {
  if (!plan) return <section className="plan"><h2>Plano de jogo</h2><p className="note">Aparece quando os dois times tiverem pelo menos 3 campeões.</p></section>;
  const max = Math.max(4, ...plan.curve.map(Math.abs));
  return (
    <section className="plan">
      <h2>Plano de jogo</h2>
      <div className={`verdict ${plan.verdict.kind}`}><b>{plan.verdict.title}.</b> {plan.verdict.text}</div>
      <div className="curve" aria-label="Vantagem do seu time por duração de jogo">
        {plan.curve.map((v, i) => (
          <div key={i} className="col" title={`${v > 0 ? "+" : ""}${v.toFixed(1)} pts`}>
            <div className="half up">{v > 0 && <div className="b good" style={{ height: `${(v / max) * 100}%` }} />}</div>
            <div className="half down">{v < 0 && <div className="b bad" style={{ height: `${(-v / max) * 100}%` }} />}</div>
            <span>{plan.labels[i]}</span>
          </div>
        ))}
        <p className="note">Força do seu time vs o inimigo por minuto de jogo (winrate por duração, Mestre+ BR). Verde: vocês na frente.</p>
      </div>
      <ul className="tips">
        {plan.focus && <li className="tip-do">Jogue em volta de <b>{plan.focus.name}</b> ({plan.focus.role}): {plan.focus.why}.</li>}
        {plan.threat && <li className="tip-avoid">{plan.threat}</li>}
      </ul>
      <div className="phases">
        {PHASES.map(([ph, label]) => {
          const list = plan.tips.filter((t) => t.phase === ph).slice(0, 3);
          return (
            <div key={ph} className="phase">
              <div className="lbl">{label}</div>
              {list.length ? <ul className="tips">{list.map((t) => <li key={t.t} className={`tip-${t.kind}`}>{t.t}</li>)}</ul> : <p className="note">Nada especial: jogo padrão.</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
