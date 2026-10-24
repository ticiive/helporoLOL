import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Game } from "../lib/stats";
import type { Bench } from "../lib/builds";
import type { Catalog } from "../lib/ddragon";
import { inTauri } from "../lib/lcu";
import { analyze, pattern, type Review } from "../lib/review";
import { demoGame, demoTimeline } from "../lib/reviewDemo";
import { MiniMap } from "./MiniMap";

/** Métricas comparadas com a média Mestre+/D1 BR do mesmo campeão na mesma rota. */
const METRICS: { k: string; label: string; better: 1 | -1; of: (g: Game) => number | null; fmt: (v: number) => string; roles?: string[] }[] = [
  { k: "d10", label: "Mortes a cada 10 min", better: -1, of: (g) => (g.s && g.min ? (10 * g.s.d) / g.min : null), fmt: (v) => v.toFixed(1) },
  { k: "vs", label: "Visão por minuto", better: 1, of: (g) => (g.s && g.min ? g.s.vs / g.min : null), fmt: (v) => v.toFixed(2) },
  { k: "cw", label: "Controles a cada 10 min", better: 1, of: (g) => (g.s && g.min ? (10 * g.s.cw) / g.min : null), fmt: (v) => v.toFixed(1) },
  { k: "cs", label: "CS por minuto", better: 1, of: (g) => (g.s && g.min ? g.s.cs / g.min : null), fmt: (v) => v.toFixed(1), roles: ["top", "jg", "mid", "adc"] },
  { k: "dmg", label: "Dano em campeões por min", better: 1, of: (g) => (g.s && g.min ? g.s.dmg / g.min : null), fmt: (v) => Math.round(v).toString() },
];
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const cacheKey = (id: number) => `helporo.rev2.${id}`;
const fromCache = (id: number): Review | null => { try { return JSON.parse(localStorage.getItem(cacheKey(id)) || "null"); } catch { return null; } };
const toCache = (r: Review) => { try { localStorage.setItem(cacheKey(r.gameId), JSON.stringify(r)); } catch { /* cheio */ } };

async function loadReview(g: Game, cat: Catalog, me: { gameName?: string }, bench: Bench | null): Promise<Review | null> {
  const c = fromCache(g.id); if (c) return c;
  if (!inTauri()) return null;
  const [game, tl] = await Promise.all([invoke("match_game", { gameId: g.id }), invoke("match_timeline", { gameId: g.id })]);
  const r = analyze(game, tl, cat, { gameName: me.gameName, champ: g.champ }, bench, g.role);
  if (r) toCache(r);
  return r;
}

export function PostGame({ games, bench, cat, gameName }: { games: Game[]; bench: Bench | null; cat: Catalog; gameName?: string }) {
  const recent = [...games].filter((g) => g.min === undefined || g.min >= 15).sort((a, b) => b.t - a.t).slice(0, 10);
  const [sel, setSel] = useState<number | null>(null);
  const [rev, setRev] = useState<Review | null>(null);
  const [msg, setMsg] = useState("");
  const [pat, setPat] = useState<ReturnType<typeof pattern>>(null);
  const g = recent.find((x) => x.id === sel) ?? recent[0];
  const demo = !inTauri();

  useEffect(() => {
    setRev(null); setMsg("");
    if (demo) { setRev(analyze(demoGame(), demoTimeline(), cat, { gameName: "ticiive" }, bench, "sup")); return; }
    if (!g) return;
    setMsg("Lendo a partida no cliente…");
    loadReview(g, cat, { gameName }, bench).then((r) => { setRev(r); setMsg(r ? "" : "O cliente não devolveu a timeline dessa partida."); }).catch(() => setMsg("Abra o cliente do LoL pra ler a partida."));
  }, [g?.id, cat.version, bench, demo]);

  const analyzeAll = async () => {
    setMsg("Analisando as últimas partidas…");
    const out: Review[] = [];
    for (const x of recent) { try { const r = await loadReview(x, cat, { gameName }, bench); if (r) out.push(r); } catch { /* segue */ } }
    setPat(pattern(out)); setMsg(out.length ? "" : "Não deu pra ler as partidas (cliente fechado?).");
  };

  if (!g && !demo) return null;
  const ref = g?.role ? bench?.[g.role]?.[g.champ] : undefined;
  const rows = g ? METRICS.filter((m) => !m.roles || (g.role && m.roles.includes(g.role))).map((m) => {
    const v = m.of(g), b = ref?.[m.k] as [number, number] | undefined;
    return { m, v, b, z: v !== null && b && b[1] > 0 ? ((v - b[0]) / b[1]) * m.better : null };
  }) : [];

  return (
    <section className="plan postgame">
      <h2>Revisão pós-jogo</h2>
      {demo ? <p className="note">Prévia com uma partida de exemplo. No app, ele lê as suas partidas direto do cliente.</p> : (
        <div className="brow">
          <select value={g?.id} onChange={(e) => setSel(+e.target.value)} aria-label="Partida">
            {recent.map((x) => <option key={x.id} value={x.id}>{new Date(x.t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {x.champ} {x.role ?? ""} · {x.win ? "vitória" : "derrota"}</option>)}
          </select>
          <button className="ghost" onClick={analyzeAll}>Padrão das últimas {recent.length}</button>
        </div>
      )}
      {msg && <p className="note">{msg}</p>}
      {pat && <div className="train"><b>Nas últimas {pat.of} partidas:</b> o foco mais frequente foi <b>{pat.title}</b> ({pat.n} de {pat.of}). {Math.round(pat.isoPct * 100)}% das suas mortes foram sem ninguém do time por perto.</div>}
      {rev && (
        <div className="review">
          <div>
            {rev.focus && <div className="train"><b>Treine isto: {rev.focus.title}</b><p>{rev.focus.text}</p></div>}
            <div className="lbl" style={{ marginTop: 10 }}>Feedback desta partida</div>
            <p className="story">{rev.story || "Partida sem nada fora do comum."}</p>
            <p className="note">{rev.champ} · {rev.win ? "vitória" : "derrota"} · {Math.round(rev.min)} min · {rev.k}/{rev.d}/{rev.a} · KP {Math.round(rev.kp * 100)}%</p>
            {rev.deaths.length > 0 && (<>
              <div className="lbl">Suas mortes</div>
              <ul className="deaths">{rev.deaths.map((d) => (
                <li key={d.t}><b>{mmss(d.t)}</b> {d.where}: {d.killer}{d.with.length ? ` + ${d.with.join(", ")}` : ""} · {d.alliesNear ? `${d.alliesNear} aliado(s) perto` : "ninguém do seu time perto"}{d.objective ? ` · antes do ${d.objective}` : ""}</li>
              ))}</ul>
            </>)}
            {rows.length > 0 && (<>
              <div className="lbl" style={{ marginTop: 10 }}>Comparado com a média Mestre+</div>
              <div className="pg">{rows.map(({ m, v, b, z }) => (
                <div key={m.k} className={`pgm ${z === null ? "" : z >= 0.3 ? "good" : z <= -0.5 ? "bad" : ""}`}>
                  <span>{m.label}</span><b>{v === null ? "-" : m.fmt(v)}</b><small>{b ? `média Mestre+: ${m.fmt(b[0])}` : "sem média ainda"}</small>
                </div>
              ))}</div>
            </>)}
          </div>
          <MiniMap r={rev} cat={cat} />
        </div>
      )}
    </section>
  );
}
