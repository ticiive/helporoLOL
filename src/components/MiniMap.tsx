import { useEffect, useMemo, useState } from "react";
import type { Review, Pos } from "../lib/review";
import { iconUrl, norm, type Catalog } from "../lib/ddragon";

const MAXX = 14870, MAXY = 14980;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** Replay do minimapa: posição dos 10 a cada minuto (interpolada), abates marcados e as suas mortes em destaque. */
export function MiniMap({ r, cat }: { r: Review; cat: Catalog }) {
  const end = Math.max(60, (r.frames.length - 1) * 60);
  const [t, setT] = useState(r.deaths[0]?.t ?? 0);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setT((v) => { if (v >= end) { setPlay(false); return end; } return v + 6; }), 100); // 1 min a cada 1 s
    return () => clearInterval(id);
  }, [play, end]);
  const posAt = (pid: number): Pos | null => {
    const i = Math.floor(t / 60), a = r.frames[i]?.[pid], b = r.frames[i + 1]?.[pid];
    if (!a) return null; if (!b) return a;
    const w = t / 60 - i; return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
  };
  const me = r.players.find((p) => p.me);
  const recent = r.kills.filter((k) => k.t <= t && t - k.t < 20);
  const dead = new Set(recent.map((k) => k.victim));
  const map = cat.version ? `https://ddragon.leagueoflegends.com/cdn/${cat.version}/img/map/map11.png` : "";
  const ticks = useMemo(() => r.deaths.map((d) => d.t), [r]);
  const at = (p: Pos) => ({ left: `${(p.x / MAXX) * 100}%`, top: `${(1 - p.y / MAXY) * 100}%` });
  return (
    <div className="minimap">
      <div className="mm" style={map ? { backgroundImage: `url(${map})` } : undefined}>
        {recent.map((k, i) => <span key={i} className={`kx ${k.victim === me?.pid ? "mine" : r.players.find((p) => p.pid === k.victim)?.team === me?.team ? "ally" : "enemy"}`} style={at(k.pos)}>✕</span>)}
        {r.players.map((p) => {
          const pos = posAt(p.pid); if (!pos) return null;
          const c = cat.byName.get(norm(p.champ));
          return (
            <span key={p.pid} className={`mp ${p.team === me?.team ? "ally" : "enemy"} ${p.me ? "me" : ""} ${dead.has(p.pid) ? "dead" : ""}`} style={at(pos)} title={p.champ}>
              {c && cat.version ? <img src={iconUrl(cat, c)} alt="" /> : p.champ.slice(0, 2)}
            </span>
          );
        })}
      </div>
      <div className="mmctl">
        <button className="ghost" onClick={() => { if (t >= end) setT(0); setPlay(!play); }}>{play ? "Pausar" : "Play"}</button>
        <input type="range" min={0} max={end} step={1} value={t} onChange={(e) => { setPlay(false); setT(+e.target.value); }} aria-label="Tempo da partida" />
        <span className="clock">{mmss(t)}</span>
      </div>
      {ticks.length > 0 && (
        <div className="mmjump">
          <span className="note">Suas mortes:</span>
          {r.deaths.map((d) => <button key={d.t} className="link" onClick={() => { setPlay(false); setT(Math.max(0, d.t - 15)); }}>{mmss(d.t)} {d.where}</button>)}
        </div>
      )}
      <p className="note">Posições a cada minuto (o cliente só guarda isso), interpoladas entre um minuto e outro. ✕ = abate nos últimos 20 s; vermelho forte = a sua morte. O botão da morte volta 15 s pra você ver como chegou lá.</p>
    </div>
  );
}
