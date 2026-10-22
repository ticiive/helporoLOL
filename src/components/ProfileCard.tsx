import type { Profile } from "../engine/engine";

type Row = [string, keyof Profile, string];

function Pips({ v }: { v: number }) {
  return <div className="pips">{[0, 1, 2].map((i) => <i key={i} className={i < v ? "on" : ""} />)}</div>;
}

export function ProfileCard({ title, p, side }: { title: string; p: Profile; side: "a" | "e" }) {
  const rows: Row[] = side === "a"
    ? [["Frontline", "F", p.n >= 3 && p.F === 0 ? "falta" : ""], ["Engage", "E", p.n >= 3 && p.E === 0 ? "falta" : ""], ["CC", "C", ""], ["Poke", "K", ""], ["Dive / burst", "DX", ""], ["Teamfight", "W", ""], ["Peel", "R", p.n >= 3 && p.R === 0 ? "você é o peel" : ""]]
    : [["Dive / burst", "DX", p.DX >= 2 ? "ameaça" : ""], ["Pick / hook", "H", p.H >= 1 ? "ameaça" : ""], ["Poke", "K", p.K >= 2 ? "ameaça" : ""], ["Engage", "E", p.E >= 2 ? "ameaça" : ""], ["Frontline", "F", ""], ["Teamfight", "W", p.W >= 2 ? "ameaça" : ""], ["Spell shield", "N", p.N ? "atenção" : ""]];
  const total = p.ad + p.ap;
  const adPct = total ? Math.round((p.ad / total) * 100) : 0;
  return (
    <div className={`sect ${side}`}>
      <h2>{title}</h2>
      <div className="prof">
        {total ? (
          <div className="prow"><span>Dano</span><div className="dmg"><div className="ad" style={{ width: `${adPct}%` }} /><div className="ap" style={{ width: `${100 - adPct}%` }} /></div><span className="note">{adPct}% físico</span></div>
        ) : <div className="note">Sem campeões ainda.</div>}
        {rows.map(([l, k, flag]) => (
          <div key={l} className="prow"><span>{l}</span><Pips v={p[k]} />{flag ? <span className={`flag ${side === "a" ? "lack" : "thr"}`}>{flag}</span> : <span />}</div>
        ))}
      </div>
    </div>
  );
}
