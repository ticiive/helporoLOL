import { useEffect, useState } from "react";
import type { Review } from "../lib/review";
import type { Reason } from "../lib/reasons";

/** Os motivos da partida, com "foi isso / não foi isso" e uma nota em cada um, e o relatório pra colar no chat. */
type Fb = { v: Record<string, 1 | -1>; n: Record<string, string>; extra: string };
const key = (id: number) => `helporo.fb.${id}`;
const load = (id: number): Fb => { try { return { v: {}, n: {}, extra: "", ...JSON.parse(localStorage.getItem(key(id)) || "{}") }; } catch { return { v: {}, n: {}, extra: "" }; } };
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function report(rev: Review, fb: Fb) {
  const line = (r: Reason) => `- [${fb.v[r.id] === 1 ? "foi isso" : fb.v[r.id] === -1 ? "NÃO foi isso" : "sem marcar"}] ${r.good ? "(+) " : ""}${r.title}: ${r.detail}${fb.n[r.id] ? `\n  nota: ${fb.n[r.id]}` : ""}`;
  const time = rev.reasons.filter((r) => r.scope === "time"), me = rev.reasons.filter((r) => r.scope === "voce");
  return [
    `helporoLOL, revisão da partida ${rev.gameId}`,
    `${rev.champ} ${rev.role ?? ""} · ${rev.win ? "vitória" : "derrota"} · ${Math.round(rev.min)} min · ${rev.k}/${rev.d}/${rev.a} · KP ${Math.round(rev.kp * 100)}%`,
    "", "Time:", ...(time.length ? time.map(line) : ["- (nenhum motivo)"]),
    "", "Você:", ...(me.length ? me.map(line) : ["- (nenhum motivo)"]),
    "", "Mortes:", ...rev.deaths.map((d) => `- ${mmss(d.t)} ${d.where}: ${d.killer}${d.with.length ? " + " + d.with.join(", ") : ""}, ${d.alliesNear ? d.alliesNear + " aliado(s) perto" : "sozinha"}${d.objective ? ", antes do " + d.objective : ""}`),
    "", `O que mais aconteceu: ${fb.extra || "(vazio)"}`,
  ].join("\n");
}

export function Reasons({ rev }: { rev: Review }) {
  const [fb, setFb] = useState<Fb>(() => load(rev.gameId));
  const [copied, setCopied] = useState("");
  useEffect(() => setFb(load(rev.gameId)), [rev.gameId]);
  const save = (f: Fb) => { setFb(f); try { localStorage.setItem(key(rev.gameId), JSON.stringify(f)); } catch { /* cheio */ } };
  const vote = (id: string, v: 1 | -1) => { const nv = { ...fb.v }; if (nv[id] === v) delete nv[id]; else nv[id] = v; save({ ...fb, v: nv }); };
  const copy = async () => {
    const txt = report(rev, fb);
    try { await navigator.clipboard.writeText(txt); setCopied("Copiado. Cola no chat do Claude que ele ajusta as regras."); }
    catch { setCopied(""); window.prompt?.("Copie o relatório:", txt); }
  };
  const list = (scope: "time" | "voce") => rev.reasons.filter((r) => r.scope === scope);
  const block = (title: string, rs: Reason[]) => rs.length > 0 && (<>
    <div className="lbl" style={{ marginTop: 10 }}>{title}</div>
    <ul className="reasons">{rs.map((r) => (
      <li key={r.id} className={r.good ? "good" : "bad"}>
        <div className="rhead"><b>{r.good ? "✓" : "✗"} {r.title}</b>{r.t !== undefined && <small> · {mmss(r.t)}</small>}
          <span className="vote">
            <button className={fb.v[r.id] === 1 ? "on" : ""} onClick={() => vote(r.id, 1)} title="Foi isso">👍</button>
            <button className={fb.v[r.id] === -1 ? "on" : ""} onClick={() => vote(r.id, -1)} title="Não foi isso">👎</button>
          </span></div>
        <p>{r.detail}</p>
        {fb.v[r.id] !== undefined && <input className="rnote" placeholder={fb.v[r.id] === -1 ? "O que foi, então?" : "Algo a acrescentar?"} value={fb.n[r.id] ?? ""} onChange={(e) => save({ ...fb, n: { ...fb.n, [r.id]: e.target.value } })} />}
      </li>))}</ul>
  </>);
  const bad = rev.reasons.filter((r) => !r.good).length;
  return (
    <div className="reasonbox">
      <p className="note">{rev.reasons.length ? `${bad} motivo(s) contra e ${rev.reasons.length - bad} a favor, do mais pesado pro mais leve. Marque 👍 se foi isso e 👎 se não foi.` : "Não achei nada fora do comum nesta partida."}</p>
      {block(rev.win ? "Por que vocês ganharam" : "Por que vocês perderam", list("time"))}
      {block("Você", list("voce"))}
      <div className="lbl" style={{ marginTop: 10 }}>O que mais aconteceu que eu não vi?</div>
      <textarea className="rnote" rows={2} placeholder="Ex.: o ADC foi afk, o jungle nunca veio bot, a gente brigou no chat…" value={fb.extra} onChange={(e) => save({ ...fb, extra: e.target.value })} />
      <div className="brow"><button onClick={copy}>📋 Copiar relatório</button>{copied && <small className="note">{copied}</small>}</div>
    </div>
  );
}
