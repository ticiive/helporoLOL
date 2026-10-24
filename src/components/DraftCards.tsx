import { useState } from "react";
import type { Card, Tier } from "../engine/draftScore";
import type { Role } from "../engine/engine";
import { BOTS, JUNGLERS, MIDS, SUPPORTS, TOPS } from "../engine/champions";
import { Icon } from "./ChampInput";
import { norm, type Catalog } from "../lib/ddragon";

const TIER_COLOR: Record<Tier, string> = { S: "#ff8a3d", A: "#c89b3c", B: "#4aa3ff", C: "#8a94a6", D: "#5b6372" };
const RN: Record<Role, string> = { top: "Top", jg: "Jungle", mid: "Mid", adc: "ADC", sup: "Sup" };
const ROLE_SET: Record<Role, Set<string>> = { top: TOPS, jg: JUNGLERS, mid: MIDS, adc: BOTS, sup: SUPPORTS };

function Bar({ label, v }: { label: string; v: number }) {
  const c = v >= 60 ? "var(--good)" : v <= 40 ? "var(--bad)" : "var(--muted)";
  return <div className="cbar"><span>{label}</span><div className="t"><div style={{ width: `${v}%`, background: c }} /></div></div>;
}

export function ChampCard({ c, cat, big, onPick }: { c: Card; cat: Catalog; big?: boolean; onPick?: (n: string) => void }) {
  return (
    <div className={`ccard ${big ? "big" : ""}`} style={{ ["--tc" as string]: TIER_COLOR[c.tier] }} onClick={() => onPick?.(c.name)} role={onPick ? "button" : undefined}>
      <div className="chead">
        <Icon cat={cat} champ={cat.byName.get(norm(c.name)) ?? null} size={big ? 64 : 48} ring={TIER_COLOR[c.tier]} />
        <div className="cn"><b>{c.name}</b><small title="Estimativa do backtest: quanto essa escolha muda a chance de vitória em relação a um pick médio nesse draft">{c.est >= 0 ? "+" : ""}{c.est.toFixed(1)} pts de winrate vs pick médio</small></div>
        <span className="tier">{c.tier}</span>
      </div>
      <p className="cwhy">{c.why}</p>
      <Bar label="Matchup" v={c.bars.matchup} />
      <Bar label="Sinergia" v={c.bars.synergy} />
      <Bar label="Comp" v={c.bars.comp} />
      <div className="ctags">{c.tags.map((t) => <span key={t.t} className={`chip ${t.kind === "good" ? "good" : t.kind === "bad" ? "bad" : ""}`}>{t.t}</span>)}</div>
    </div>
  );
}

/** Recomendação em cards: o melhor do seu pool em destaque, o resto do pool e opções de fora (sempre 1+ tier S). */
export function DraftCards({ cards, cat, role, onPool, onPick }: { cards: Card[]; cat: Catalog; role: Role; onPool: () => void; onPick?: (n: string) => void }) {
  const pool = cards.filter((c) => c.inPool);
  const out = cards.filter((c) => !c.inPool);
  const outS = out.filter((c) => c.tier === "S");
  const extra = (outS.length ? outS : out).slice(0, 3);
  const best = pool[0] ?? cards[0];
  if (!best) return <p className="note">Sem dados pra essa rota ainda.</p>;
  return (
    <div className="dcards">
      <div className="dhead">
        <span className="lbl">Recomendação · {RN[role]} · só por dados (Mestre+ BR e op.gg)</span>
        <button className="ghost" onClick={onPool}>+ Criar pool</button>
      </div>
      <ChampCard c={best} cat={cat} big onPick={onPick} />
      {pool.length > 1 && <><div className="lbl">Do seu pool</div><div className="cgrid">{pool.slice(1, 7).map((c) => <ChampCard key={c.name} c={c} cat={cat} onPick={onPick} />)}</div></>}
      {extra.length > 0 && <><div className="lbl">Fora do pool {outS.length ? "· tier S" : ""}</div><div className="cgrid">{extra.map((c) => <ChampCard key={c.name} c={c} cat={cat} onPick={onPick} />)}</div></>}
      {!pool.length && <p className="note">Você ainda não tem pool nessa rota: clique em "+ Criar pool" e escolha os campeões.</p>}
    </div>
  );
}

/** Editor de pool: escolhe a rota e marca os campeões dela. */
export function PoolEditor({ cat, pools, start, onChange, onClose }: { cat: Catalog; pools: Record<Role, string[]>; start: Role; onChange: (r: Role, list: string[]) => void; onClose: () => void }) {
  const [role, setRole] = useState<Role>(start);
  const [q, setQ] = useState("");
  const list = [...ROLE_SET[role]].filter((n) => !q || norm(n).includes(norm(q))).sort((a, b) => a.localeCompare(b));
  const mine = new Set(pools[role] ?? []);
  const toggle = (n: string) => onChange(role, mine.has(n) ? [...mine].filter((x) => x !== n) : [...mine, n]);
  return (
    <div className="modal" role="dialog" aria-label="Criar pool" onClick={onClose}>
      <div className="mbox" onClick={(e) => e.stopPropagation()}>
        <div className="dhead"><b>Pool de campeões</b><button className="ghost" onClick={onClose}>Pronto</button></div>
        <div className="roles">{(Object.keys(RN) as Role[]).map((r) => <button key={r} aria-pressed={r === role} onClick={() => setRole(r)}>{RN[r]} {pools[r]?.length ? `(${pools[r].length})` : ""}</button>)}</div>
        <input className="banin wide" placeholder="buscar campeão" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="note">Clique pra colocar ou tirar do pool de {RN[role]}. Selecionados: {mine.size}.</p>
        <div className="pickgrid">
          {list.map((n) => (
            <button key={n} className={`pick ${mine.has(n) ? "on" : ""}`} onClick={() => toggle(n)} title={n}>
              <Icon cat={cat} champ={cat.byName.get(norm(n)) ?? null} size={44} ring={mine.has(n) ? "var(--gold)" : "var(--line)"} />
              <span>{n}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
