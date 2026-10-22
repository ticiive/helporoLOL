import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChampInput, Icon } from "./components/ChampInput";
import { ResultPanel } from "./components/ResultPanel";
import { ProfileCard } from "./components/ProfileCard";
import { DEFAULT_POOL, DEFAULT_WEIGHTS, FACTORS, ROLES, blindRisk, candidates, decide, laneKey, profile, type Draft, type Role, type Settings, type Team } from "./engine/engine";
import { PATCH, type SupKey } from "./engine/data";
import { loadCatalog, norm, offlineCatalog, type Catalog } from "./lib/ddragon";
import { inTauri, readChampSelect, readHistory, type Account, type LiveState } from "./lib/lcu";
import { buildStats, loadGames, mergeGames, overall, saveGames, type Game } from "./lib/stats";

const RN: Record<Role, string> = { top: "Top", jg: "Jungle", mid: "Mid", adc: "ADC", sup: "Sup" };
const empty = (): Team => ({ top: null, jg: null, mid: null, adc: null, sup: null });
const EXAMPLE: Draft = {
  ally: { top: "Ornn", jg: "Sejuani", mid: "Orianna", adc: "Jinx", sup: null },
  enemy: { top: "Camille", jg: "Nocturne", mid: "Zed", adc: "Draven", sup: "Nautilus" },
  bans: ["Lulu"],
};
const OWNER_ACC = "ticiive#lett";
const SYNC_MS = 10 * 60 * 1000;

function useStored<T extends object>(key: string, init: T) {
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); return s ? { ...init, ...JSON.parse(s) } : init; } catch { return init; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* sem storage */ } }, [key, v]);
  return [v, setV] as const;
}

export default function App() {
  const [cat, setCat] = useState<Catalog>(offlineCatalog);
  const [catErr, setCatErr] = useState(false);
  const [draft, setDraft] = useState<Draft>(EXAMPLE);
  const [settings, setSettings] = useStored<Settings>("helporo.settings2", { weights: DEFAULT_WEIGHTS, pool: DEFAULT_POOL, focus: ["Nami"], lane: {} });
  const [ui, setUi] = useStored("helporo.ui", { follow: true, role: "sup" as Role });
  const [live, setLive] = useState<LiveState | null>(null);
  const [banText, setBanText] = useState("");
  const [poolText, setPoolText] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const accKey = account ? `${account.gameName}#${account.tagLine}` : OWNER_ACC;
  const [games, setGames] = useState<Game[]>(() => loadGames(OWNER_ACC));
  const [sync, setSync] = useState<{ at: number; added: number } | null>(null);

  useEffect(() => { loadCatalog().then(setCat).catch(() => setCatErr(true)); }, []);

  // Seleção de campeões: lê o cliente a cada 1,5 s
  useEffect(() => {
    if (!inTauri()) return;
    let alive = true;
    const tick = async () => { try { const s = await readChampSelect(cat); if (alive) setLive(s); } catch { if (alive) setLive({ status: "offline" }); } };
    tick();
    const id = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(id); };
  }, [cat]);

  // Histórico pessoal: ao abrir, a cada 10 min e quando uma seleção termina (a partida vai entrar no histórico)
  const syncHistory = useCallback(async () => {
    if (!inTauri() || cat.byKey.size === 0) return;
    try {
      const h = await readHistory(cat);
      if (!h) return;
      const acc = `${h.account.gameName}#${h.account.tagLine}`;
      setAccount(h.account);
      const [merged, added] = mergeGames(loadGames(acc), h.games);
      saveGames(acc, merged);
      setGames(merged);
      setSync({ at: Date.now(), added });
    } catch { /* cliente fechado ou ocupado: tenta de novo depois */ }
  }, [cat]);
  useEffect(() => { syncHistory(); const id = setInterval(syncHistory, SYNC_MS); return () => clearInterval(id); }, [syncHistory]);
  const prevLive = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevLive.current === "active" && live?.status !== "active") setTimeout(syncHistory, 60_000);
    prevLive.current = live?.status;
  }, [live, syncHistory]);

  const following = ui.follow && live?.status === "active";
  const myRole: Role = following && live?.status === "active" && live.draft.myRole ? live.draft.myRole : ui.role;
  useEffect(() => {
    if (following && live?.status === "active") setDraft({ ally: live.draft.ally, enemy: live.draft.enemy, bans: live.draft.bans });
  }, [following, live]);

  const isOwner = account ? account.isOwner : true;
  const stats = useMemo(() => buildStats(games, isOwner), [games, isOwner]);
  const tot = overall(stats);
  const flags = useMemo(() => (n: string | null) => (n ? cat.byName.get(norm(n))?.flags ?? "" : ""), [cat]);
  const draftForMe = useMemo(() => ({ ...draft, ally: { ...draft.ally, [myRole]: null } }), [draft, myRole]);
  const results = useMemo(() => decide(draftForMe, settings, flags, stats, myRole), [draftForMe, settings, flags, stats, myRole]);
  const risk = blindRisk(draftForMe, myRole);
  const allies = ROLES.filter((r) => r !== myRole).map((r) => draftForMe.ally[r]).filter(Boolean) as string[];
  const enemies = ROLES.map((r) => draft.enemy[r]).filter(Boolean) as string[];
  const top = results[0]?.status === "ok" ? results[0] : null;
  const rolePool = candidates(myRole, settings, stats);

  const setSlot = (side: "ally" | "enemy", r: Role, v: string | null) => setDraft((d) => ({ ...d, [side]: { ...d[side], [r]: v } }));
  const setLane = (k: SupKey, v: number | null) => setSettings((s) => {
    const lane = { ...s.lane }; const key = laneKey(k, draft.enemy.sup!);
    if (v === null) delete lane[key]; else lane[key] = v;
    return { ...s, lane };
  });
  const statOf = (n: string) => { const c = stats[n]?.byRole[myRole]; return c && c.w + c.l ? `${Math.round((c.w / (c.w + c.l)) * 100)}% · ${c.w + c.l}j` : "sem jogos"; };

  const liveLabel = !inTauri() ? null
    : live?.status === "active" ? (following ? "Seguindo a seleção do cliente" : "Seleção detectada (pausado)")
    : live?.status === "idle" ? "Cliente aberto, fora da seleção" : "Cliente do LoL fechado";

  return (
    <div className="wrap">
      <header>
        <div>
          <h1>helporo<span>LOL</span></h1>
          <p className="hint">{inTauri() ? "Abre a seleção no cliente e o draft preenche sozinho, inclusive sua rota. Pausando o modo seguir, dá pra editar à mão." : "Prévia sem o cliente: preenche o draft e escolhe sua rota."}</p>
        </div>
        <div className="tools">
          {liveLabel && <span className={`pill ${live?.status === "active" ? "ok" : ""}`}>{liveLabel}</span>}
          {inTauri() && <button className="ghost" onClick={() => setUi({ ...ui, follow: !ui.follow })}>{ui.follow ? "Pausar seguir" : "Seguir cliente"}</button>}
          <button className="ghost" disabled={following} onClick={() => setDraft(EXAMPLE)}>Exemplo</button>
          <button className="ghost" disabled={following} onClick={() => setDraft({ ally: empty(), enemy: empty(), bans: [] })}>Limpar</button>
        </div>
      </header>

      <div className="roles" role="group" aria-label="Sua rota">
        <span className="lbl">Sua rota</span>
        {ROLES.map((r) => (
          <button key={r} aria-pressed={myRole === r} disabled={following && live?.status === "active" && !!live.draft.myRole} onClick={() => setUi({ ...ui, role: r })}>{RN[r]}</button>
        ))}
        {myRole !== "sup" && <span className="note fillnote">Fill: sugestão pelos seus campeões nessa rota e pela comp.</span>}
      </div>

      <section className="board">
        <div className="team ally">
          <h2>Meu time</h2>
          {ROLES.map((r) => r === myRole ? (
            <div key={r} className="slot me">
              <Icon cat={cat} champ={top ? cat.byName.get(norm(top.name)) ?? null : null} ring="var(--gold)" />
              <div className="slot-body"><label>{RN[r]} (você){live?.status === "active" && live.draft.myHover ? <span className="fl">hover: {live.draft.myHover}</span> : null}</label>
                <div className="mine">{top ? top.name : "A definir"}</div></div>
            </div>
          ) : <ChampInput key={r} id={`a-${r}`} side="a" label={RN[r]} cat={cat} value={draft.ally[r]} disabled={following} onChange={(v) => setSlot("ally", r, v)} />)}
        </div>

        <div className="mid">
          <div className="status">
            <span className={`pill ${risk >= 0.45 ? "warn" : "ok"}`}>{risk >= 0.45 ? "Blind: oponente direto escondido" : "Oponente direto revelado"}</span>
            <span className="pill">Risco de counter {Math.round(risk * 100)}%</span>
          </div>
          <ResultPanel results={results} risk={risk} enemySup={myRole === "sup" ? draft.enemy.sup : null} settings={settings} cat={cat} onLane={setLane} />
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
          </div>
        </div>
      </section>
      <datalist id="champ-list">{cat.list.map((c) => <option key={c.name} value={c.name} />)}</datalist>

      <section className="comps">
        <ProfileCard title="Perfil do meu time" p={profile(allies, flags)} side="a" />
        <ProfileCard title="Perfil do inimigo" p={profile(enemies, flags)} side="e" />
      </section>

      <section className="settings">
        <div className="sect">
          <h2>Pool de {RN[myRole]}</h2>
          <div className="poolgrid">
            {rolePool.map((n) => {
              const manual = settings.pool[myRole].includes(n), focus = settings.focus.includes(n);
              return (
                <div key={n} className="pchip">
                  <Icon cat={cat} champ={cat.byName.get(norm(n)) ?? null} size={28} />
                  <span className="pn">{n}<small>{statOf(n)}</small></span>
                  <button className={`star ${focus ? "on" : ""}`} aria-pressed={focus} title="Quero treinar (bônus mesmo com histórico ruim)"
                    onClick={() => setSettings((s) => ({ ...s, focus: focus ? s.focus.filter((x) => x !== n) : [...s.focus, n] }))}>★</button>
                  {manual && <button className="x" title="Tirar do pool" onClick={() => setSettings((s) => ({ ...s, pool: { ...s.pool, [myRole]: s.pool[myRole].filter((x) => x !== n) } }))}>×</button>}
                </div>
              );
            })}
          </div>
          <input className="banin wide" list="champ-list" placeholder="+ adicionar campeão a essa rota" value={poolText} onChange={(e) => {
            const c = cat.byName.get(norm(e.target.value));
            if (c) { setSettings((s) => ({ ...s, pool: { ...s.pool, [myRole]: s.pool[myRole].includes(c.name) ? s.pool[myRole] : [...s.pool[myRole], c.name] } })); setPoolText(""); } else setPoolText(e.target.value);
          }} />
          <p className="note">Entram automaticamente os campeões com jogos seus nessa rota. ★ = quero treinar.</p>
        </div>
        <div className="sect">
          <h2>Seu histórico</h2>
          <p className="big-stat">{tot.w}V {tot.l}D <span>{Math.round(tot.wr * 100)}%</span></p>
          <p className="note">
            {account ? `Conta no cliente: ${accKey}.` : inTauri() ? "Abra o cliente do LoL pra sincronizar." : "Prévia: usando a base da temporada."}
            {account && !account.isOwner ? " Conta diferente da ticiive#lett: usando só os jogos dessa conta." : " Base da temporada até 22/10 + partidas ranqueadas lidas do cliente."}
          </p>
          <p className="note">{sync ? `Sincronizado às ${new Date(sync.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${sync.added ? `, ${sync.added} partida(s) nova(s)` : ""}. ` : ""}{games.length} partidas do cliente guardadas.</p>
          {inTauri() && <button className="ghost" onClick={syncHistory}>Sincronizar agora</button>}
          <h2 style={{ marginTop: 16 }}>Peso de cada fator</h2>
          <div className="prof">
            {FACTORS.map(([id, l]) => (
              <div key={id} className="sl">
                <label htmlFor={`w-${id}`}>{l}</label>
                <input type="range" id={`w-${id}`} min={0} max={2} step={0.1} value={settings.weights[id]}
                  onChange={(e) => setSettings((s) => ({ ...s, weights: { ...s.weights, [id]: +e.target.value } }))} />
                <output>{settings.weights[id].toFixed(1)}</output>
              </div>
            ))}
          </div>
          <p className="note">Matchups e meta de sup: Lolalytics, patch {PATCH}, Esmeralda+. Ícones: Data Dragon {cat.version || "(offline)"}.{catErr ? " Sem internet: usando iniciais." : ""}</p>
          <p className="note">Correções de lane salvas: {Object.keys(settings.lane).length}. {Object.keys(settings.lane).length > 0 && <button className="link" onClick={() => setSettings((s) => ({ ...s, lane: {} }))}>apagar</button>}</p>
        </div>
      </section>
    </div>
  );
}
