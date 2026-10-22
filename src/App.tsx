import { useEffect, useMemo, useState } from "react";
import { ChampInput, Icon } from "./components/ChampInput";
import { ResultPanel } from "./components/ResultPanel";
import { ProfileCard } from "./components/ProfileCard";
import { DEFAULT_WEIGHTS, FACTORS, ROLES, blindRisk, decide, laneKey, profile, type Draft, type Role, type Settings, type Team } from "./engine/engine";
import { PATCH, SUPS, SUP_COLOR, SUP_KEYS, type SupKey } from "./engine/data";
import { loadCatalog, norm, offlineCatalog, type Catalog } from "./lib/ddragon";
import { inTauri, readChampSelect, type LiveState } from "./lib/lcu";

const RN: Record<Role, string> = { top: "Top", jg: "Jungle", mid: "Mid", adc: "ADC", sup: "Sup" };
const empty = (): Team => ({ top: null, jg: null, mid: null, adc: null, sup: null });
const EXAMPLE: Draft = {
  ally: { top: "Ornn", jg: "Sejuani", mid: "Orianna", adc: "Jinx", sup: null },
  enemy: { top: "Camille", jg: "Nocturne", mid: "Zed", adc: "Draven", sup: "Nautilus" },
  bans: ["Lulu"],
};

function useStored<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); return s ? { ...init, ...JSON.parse(s) } : init; } catch { return init; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* sem storage */ } }, [key, v]);
  return [v, setV] as const;
}

export default function App() {
  const [cat, setCat] = useState<Catalog>(offlineCatalog);
  const [catErr, setCatErr] = useState(false);
  const [draft, setDraft] = useState<Draft>(EXAMPLE);
  const [settings, setSettings] = useStored<Settings>("helporo.settings", { weights: DEFAULT_WEIGHTS, pool: SUP_KEYS, lane: {} });
  const [follow, setFollow] = useStored("helporo.follow", { on: true });
  const [live, setLive] = useState<LiveState | null>(null);
  const [banText, setBanText] = useState("");

  useEffect(() => { loadCatalog().then(setCat).catch(() => setCatErr(true)); }, []);

  // Lê o cliente a cada 1,5 s quando estiver rodando como app
  useEffect(() => {
    if (!inTauri()) return;
    let alive = true;
    const tick = async () => {
      try { const s = await readChampSelect(cat); if (alive) setLive(s); } catch { if (alive) setLive({ status: "offline" }); }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(id); };
  }, [cat]);

  const following = follow.on && live?.status === "active";
  useEffect(() => {
    if (following && live?.status === "active") setDraft({ ally: live.draft.ally, enemy: live.draft.enemy, bans: live.draft.bans });
  }, [following, live]);

  const flags = useMemo(() => (n: string | null) => (n ? cat.byName.get(norm(n))?.flags ?? "" : ""), [cat]);
  const results = useMemo(() => decide(draft, settings, flags), [draft, settings, flags]);
  const risk = blindRisk(draft);
  const allies = (["top", "jg", "mid", "adc"] as Role[]).map((r) => draft.ally[r]).filter(Boolean) as string[];
  const enemies = ROLES.map((r) => draft.enemy[r]).filter(Boolean) as string[];
  const top = results[0]?.status === "ok" ? results[0] : null;

  const setSlot = (side: "ally" | "enemy", r: Role, v: string | null) => setDraft((d) => ({ ...d, [side]: { ...d[side], [r]: v } }));
  const setLane = (k: SupKey, v: number | null) => setSettings((s) => {
    const lane = { ...s.lane }; const key = laneKey(k, draft.enemy.sup!);
    if (v === null) delete lane[key]; else lane[key] = v;
    return { ...s, lane };
  });

  const liveLabel = !inTauri() ? null
    : live?.status === "active" ? (following ? "Seguindo a seleção do cliente" : "Seleção detectada (pausado)")
    : live?.status === "idle" ? "Cliente aberto, fora da seleção" : "Cliente do LoL fechado";

  return (
    <div className="wrap">
      <header>
        <div>
          <h1>helporo<span>LOL</span></h1>
          <p className="hint">{inTauri() ? "Abre a seleção no cliente e o draft preenche sozinho. Dá pra editar à mão desligando o modo seguir." : "Preenche os campeões do draft; a sugestão atualiza na hora."}</p>
        </div>
        <div className="tools">
          {liveLabel && <span className={`pill ${live?.status === "active" ? "ok" : ""}`}>{liveLabel}</span>}
          {inTauri() && <button className="ghost" onClick={() => setFollow({ on: !follow.on })}>{follow.on ? "Pausar seguir" : "Seguir cliente"}</button>}
          <button className="ghost" disabled={following} onClick={() => setDraft(EXAMPLE)}>Exemplo</button>
          <button className="ghost" disabled={following} onClick={() => setDraft({ ally: empty(), enemy: empty(), bans: [] })}>Limpar</button>
        </div>
      </header>

      <section className="board">
        <div className="team ally">
          <h2>Meu time</h2>
          {ROLES.map((r) => r === "sup" ? (
            <div key={r} className="slot me">
              <Icon cat={cat} champ={top ? cat.byName.get(norm(SUPS[top.k])) ?? null : null} ring="var(--gold)" />
              <div className="slot-body"><label>Sup (você){live?.status === "active" && live.draft.myHover ? <span className="fl">hover: {live.draft.myHover}</span> : null}</label>
                <div className="mine" style={top ? { color: SUP_COLOR[top.k] } : undefined}>{top ? SUPS[top.k] : "A definir"}</div></div>
            </div>
          ) : <ChampInput key={r} id={`a-${r}`} side="a" label={RN[r]} cat={cat} value={draft.ally[r]} disabled={following} onChange={(v) => setSlot("ally", r, v)} />)}
        </div>

        <div className="mid">
          <div className="status">
            <span className={`pill ${risk >= 0.45 ? "warn" : "ok"}`}>{!draft.enemy.sup && !draft.enemy.adc ? "Blind: bot inimigo escondido" : !draft.enemy.sup ? "Sup inimigo escondido" : `Sup inimigo: ${draft.enemy.sup}`}</span>
            <span className="pill">Risco de counter {Math.round(risk * 100)}%</span>
          </div>
          <ResultPanel results={results} risk={risk} enemySup={draft.enemy.sup} settings={settings} cat={cat} onLane={setLane} />
        </div>

        <div className="team enemy">
          <h2>Time inimigo</h2>
          {ROLES.map((r) => <ChampInput key={r} id={`e-${r}`} side="e" label={RN[r]} cat={cat} value={draft.enemy[r]} disabled={following} onChange={(v) => setSlot("enemy", r, v)} />)}
          <div className="bans">
            <div className="lbl">Banidos</div>
            <div className="banrow">
              {draft.bans.map((b) => (
                <button key={b} className="ban" title={`Tirar ${b}`} disabled={following} onClick={() => setDraft((d) => ({ ...d, bans: d.bans.filter((x) => x !== b) }))}>
                  <Icon cat={cat} champ={cat.byName.get(norm(b)) ?? null} size={30} ring="var(--dim)" />
                </button>
              ))}
              {!following && (
                <input className="banin" list="champ-list" placeholder="+ ban" value={banText} onChange={(e) => {
                  const c = cat.byName.get(norm(e.target.value));
                  if (c) { setDraft((d) => ({ ...d, bans: d.bans.includes(c.name) ? d.bans : [...d.bans, c.name] })); setBanText(""); } else setBanText(e.target.value);
                }} />
              )}
            </div>
            <datalist id="champ-list">{cat.list.map((c) => <option key={c.name} value={c.name} />)}</datalist>
          </div>
        </div>
      </section>

      <section className="comps">
        <ProfileCard title="Perfil do meu time" p={profile(allies, flags)} side="a" />
        <ProfileCard title="Perfil do inimigo" p={profile(enemies, flags)} side="e" />
      </section>

      <section className="settings">
        <div className="sect">
          <h2>Peso de cada fator</h2>
          <div className="prof">
            {FACTORS.map(([id, l]) => (
              <div key={id} className="sl">
                <label htmlFor={`w-${id}`}>{l}</label>
                <input type="range" id={`w-${id}`} min={0} max={2} step={0.1} value={settings.weights[id]}
                  onChange={(e) => setSettings((s) => ({ ...s, weights: { ...s.weights, [id]: +e.target.value } }))} />
                <output>{settings.weights[id].toFixed(1)}</output>
              </div>
            ))}
            <p className="note">Lane = 2v2 (sua leitura + a minha). Dados = winrate de jogo vs o sup inimigo, corrigido pela amostra. Comp = ameaças do inimigo e o que falta no seu time.</p>
          </div>
        </div>
        <div className="sect">
          <h2>Pool e dados</h2>
          <div className="pool">
            {SUP_KEYS.map((k) => {
              const on = settings.pool.includes(k);
              return (
                <button key={k} aria-pressed={on} style={{ ["--c" as string]: SUP_COLOR[k] }}
                  onClick={() => setSettings((s) => ({ ...s, pool: on ? s.pool.filter((x) => x !== k) : [...s.pool, k] }))}>
                  <Icon cat={cat} champ={cat.byName.get(norm(SUPS[k])) ?? null} size={22} ring={on ? SUP_COLOR[k] : "var(--line)"} /> {SUPS[k]}
                </button>
              );
            })}
          </div>
          <p className="note">Matchups e meta: Lolalytics, patch {PATCH}, Esmeralda+. Ícones: Data Dragon {cat.version || "(offline)"}.</p>
          {catErr && <p className="note warnTxt">Sem internet pra carregar os ícones; usando iniciais.</p>}
          <p className="note">Correções de lane salvas: {Object.keys(settings.lane).length}. {Object.keys(settings.lane).length > 0 && <button className="link" onClick={() => setSettings((s) => ({ ...s, lane: {} }))}>apagar</button>}</p>
        </div>
      </section>
    </div>
  );
}
