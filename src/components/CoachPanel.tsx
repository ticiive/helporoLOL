import type { Coach } from "../engine/coach";
import type { Plan } from "../engine/gameplan";
import { mmss } from "../engine/coachData";
import { Icon } from "./ChampInput";
import { norm, type Catalog } from "../lib/ddragon";

const TYPE_PT: Record<string, string> = { hook: "puxão", engage: "engage", cc: "CC", pick: "pick", dive: "mergulho", supp: "supressão", poke: "poke" };

/** Coach da partida: condição de vitória, curva de força, dicas por fase, ameaças e linha do tempo. */
export function CoachPanel({ coach, plan, cat, champ }: { coach: Coach | null; plan: Plan | null; cat: Catalog; champ: string | null }) {
  if (!coach) return <section className="plan"><h2>Coach da partida</h2><p className="note">Aparece quando o time inimigo tiver pelo menos 2 campeões.</p></section>;
  const max = plan ? Math.max(4, ...plan.curve.map(Math.abs)) : 4;
  return (
    <section className="plan coach">
      <div className="dhead"><h2>Coach da partida{champ ? ` · ${champ}` : ""}</h2><span className="note">dicas pro seu draft · tempos da temporada 2026</span></div>
      {coach.win && <div className={`verdict ${plan?.verdict.kind ?? ""}`}><b>Condição de vitória:</b> {coach.win}</div>}
      <div className="coachgrid">
        <div className="phases">
          {coach.phases.map((p) => (
            <div key={p.key} className="phase">
              <div className="lbl">{p.label}</div>
              {p.tips.length ? <ul className="tips">{p.tips.map((t) => <li key={t.t} className={`tip-${t.kind === "info" ? "do" : t.kind}`}>{t.t}</li>)}</ul> : <p className="note">Jogo padrão.</p>}
            </div>
          ))}
        </div>
        <aside className="side">
          {plan && (
            <div className="curve" aria-label="Força do seu time por duração de jogo">
              {plan.curve.map((v, i) => (
                <div key={i} className="col" title={`${v > 0 ? "+" : ""}${v.toFixed(1)} pts`}>
                  <div className="half up">{v > 0 && <div className="b good" style={{ height: `${(v / max) * 100}%` }} />}</div>
                  <div className="half down">{v < 0 && <div className="b bad" style={{ height: `${(-v / max) * 100}%` }} />}</div>
                  <span>{plan.labels[i]}</span>
                </div>
              ))}
              <p className="note">Força do seu time por minuto (winrate por duração, Mestre+ BR). Verde: vocês na frente.</p>
            </div>
          )}
          {coach.threats.length > 0 && (<>
            <div className="lbl">Habilidades pra respeitar</div>
            <ul className="threats">{coach.threats.map((t) => (
              <li key={t.champ}><Icon cat={cat} champ={cat.byName.get(norm(t.champ)) ?? null} size={26} ring="var(--bad)" /><span><b>{t.champ}</b> {t.ability}</span><small>{TYPE_PT[t.type] ?? t.type}</small></li>
            ))}</ul>
          </>)}
          <div className="lbl">Linha do tempo</div>
          <ul className="tline">{coach.timeline.map((x) => <li key={x.at + x.t}><b>{mmss(x.at)}</b> {x.t}</li>)}</ul>
        </aside>
      </div>
    </section>
  );
}
