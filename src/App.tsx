import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChampInput, Icon } from "./components/ChampInput";
import { ResultPanel } from "./components/ResultPanel";
import { ProfileCard } from "./components/ProfileCard";
import { DEFAULT_POOL, DEFAULT_WEIGHTS, FACTORS, ROLES, blindRisk, candidates, decide, laneKey, profile, type Draft, type Role, type Settings, type Team } from "./engine/engine";
import { PATCH, type SupKey } from "./engine/data";
import { loadCatalog, norm, offlineCatalog, type Catalog } from "./lib/ddragon";
import { inTauri, readChampSelect, readHistory, type Account, type LiveState } from "./lib/lcu";
import { invoke } from "@tauri-apps/api/core";
import { confidence, loadModel, predict, type TrainedModel } from "./engine/model";
import { checkUpdate, installUpdate, type Pending } from "./lib/updater";
import { loadBuilds, loadCounters, loadNames, loadSynergies, snapshotBuild, type Builds, type Names } from "./lib/builds";
import { BuildPanel } from "./components/BuildPanel";
import { specialPicks, type Counters } from "./engine/engine";
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
  const [draft, setDraft] = useState<Draft>(() => ({ ally: empty(), enemy: empty(), bans: [] }));
  const [settings, setSettings] = useStored<Settings>("helporo.settings7", { weights: DEFAULT_WEIGHTS, pool: DEFAULT_POOL, focus: [], lane: {}, backups: ["Sona", "Nami"], main: "Soraka", mainTolerance: 2, mainNoBlind: true, mainAvoid: ["Jarvan IV", "Rengar", "Nocturne", "Pyke"], mainWarn: ["Vi", "Malphite", "Warwick", "Skarner", "Hecarim", "Zac", "Kha'Zix", "Evelynn", "Fiddlesticks", "Kayn", "Qiyana", "Diana"] });
  const [ui, setUi] = useStored("helporo.ui", { follow: true, role: "sup" as Role });
  const [live, setLive] = useState<LiveState | null>(null);
  const [banText, setBanText] = useState("");
  const [poolText, setPoolText] = useState("");
  const [avoidText, setAvoidText] = useState("");
  const [warnText, setWarnText] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const accKey = account ? `${account.gameName}#${account.tagLine}` : OWNER_ACC;
  const [games, setGames] = useState<Game[]>(() => loadGames(OWNER_ACC));
  const [sync, setSync] = useState<{ at: number; added: number } | null>(null);

  useEffect(() => { loadCatalog().then(setCat).catch(() => setCatErr(true)); }, []);
  useEffect(() => { loadNames(cat.version).then((n) => n && setNames(n)); }, [cat.version]);
  const [timerUrl, setTimerUrl] = useState("");
  // modelo treinado: baixa ao abrir e de hora em hora (o treino roda uma vez por dia)
  const [trained, setTrained] = useState<TrainedModel | null>(() => { try { return JSON.parse(localStorage.getItem("helporo.model") || "null"); } catch { return null; } });
  useEffect(() => {
    const get = () => loadModel().then((m) => { if (m) { setTrained(m); try { localStorage.setItem("helporo.model", JSON.stringify(m)); } catch { /* cheio */ } } });
    get(); const id = setInterval(get, 60 * 60 * 1000); return () => clearInterval(id);
  }, []);
  // runas, builds e counters (dados Mestre+ da branch data) e nomes do Data Dragon
  const [builds, setBuilds] = useState<Builds | null>(null);
  const [counters, setCounters] = useState<Counters | null>(null);
  const [synergies, setSynergies] = useState<Counters | null>(null);
  const [names, setNames] = useState<Names | null>(null);
  useEffect(() => {
    const get = () => { loadBuilds().then(setBuilds); loadCounters().then(setCounters); loadSynergies().then(setSynergies); };
    get(); const id = setInterval(get, 60 * 60 * 1000); return () => clearInterval(id);
  }, []);
  // atualização do app
  const [update, setUpdate] = useState<Pending | null>(null);
  const [updating, setUpdating] = useState(false);
  useEffect(() => { if (inTauri()) checkUpdate().then(setUpdate); }, []);
  const [phase, setPhase] = useState<string | null>(null);
  useEffect(() => {
    if (!inTauri()) return;
    const tick = () => invoke<string | null>("gameflow_phase").then(setPhase).catch(() => setPhase(null));
    tick(); const id = setInterval(tick, 5000); return () => clearInterval(id);
  }, []);
  useEffect(() => { if (inTauri()) invoke<string>("timer_url").then(setTimerUrl).catch(() => {}); }, []);

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
  const info = useMemo(() => (n: string) => cat.byName.get(norm(n)) ?? null, [cat]);
  const conf = trained ? confidence(trained) : 0;
  const modelZ = useMemo(() => (trained && conf > 0 ? predict(trained, draftForMe) : null), [trained, conf, draftForMe]);
  const decision = useMemo(() => decide(draftForMe, settings, flags, stats, myRole, info, modelZ, conf, counters, synergies), [draftForMe, settings, flags, stats, myRole, info, modelZ, conf, counters, synergies]);
  const results = decision.results;
  const risk = blindRisk(draftForMe, myRole);
  const allies = ROLES.filter((r) => r !== myRole).map((r) => draftForMe.ally[r]).filter(Boolean) as string[];
  const enemies = ROLES.map((r) => draft.enemy[r]).filter(Boolean) as string[];
  const top = results[0]?.status === "ok" ? results[0] : null;
  // opções sinalizadas: um counter do oponente direto e uma sinergia com o parceiro, sempre
  const special = specialPicks(results, draftForMe, myRole, stats, flags, info, counters, synergies);
  const rolePool = candidates(myRole, settings, stats).filter((n) => settings.pool[myRole].includes(n) || (stats[n]?.byRole[myRole]?.w ?? 0) + (stats[n]?.byRole[myRole]?.l ?? 0) > 0);

  const setSlot = (side: "ally" | "enemy", r: Role, v: string | null) => setDraft((d) => ({ ...d, [side]: { ...d[side], [r]: v } }));
  const setLane = (k: SupKey, v: number | null) => setSettings((s) => {
    const lane = { ...s.lane }; const key = laneKey(k, draft.enemy.sup!);
    if (v === null) delete lane[key]; else lane[key] = v;
    return { ...s, lane };
  });
  const statOf = (n: string) => { const c = stats[n]?.byRole[myRole]; return c && c.w + c.l ? `${Math.round((c.w / (c.w + c.l)) * 100)}% · ${c.w + c.l}j` : "sem jogos"; };

  const liveLabel = !inTauri() ? null
    : live?.status === "active" ? (following ? "Seguindo a seleção do cliente" : "Seleção detectada (pausado)")
    : phase === "InProgress" ? "Em partida: mostrando o draft da seleção"
    : live?.status === "idle" ? "Cliente aberto, fora da seleção" : "Cliente do LoL fechado";

  return (
    <div className="wrap">
      <header>
        <div>
          <h1>helporo<span>LOL</span></h1>
          <p className="hint">{inTauri() ? "Abre a seleção no cliente e o draft preenche sozinho, inclusive sua rota. Pausando o modo seguir, dá pra editar à mão." : "Prévia sem o cliente: preenche o draft e escolhe sua rota."}</p>
        </div>
        <div className="tools">
          {timerUrl && <span className="pill" title="Abra no Mac ou no celular, na mesma rede Wi-Fi">Timer: {timerUrl}</span>}
          {liveLabel && <span className={`pill ${live?.status === "active" ? "ok" : ""}`}>{liveLabel}</span>}
          {inTauri() && <button className="ghost" onClick={() => setUi({ ...ui, follow: !ui.follow })}>{ui.follow ? "Pausar seguir" : "Seguir cliente"}</button>}
          <button className="ghost" disabled={following} onClick={() => setDraft(EXAMPLE)}>Exemplo</button>
          <button className="ghost" disabled={following} onClick={() => setDraft({ ally: empty(), enemy: empty(), bans: [] })}>Limpar</button>
        </div>
      </header>

      {update && (
        <div className="banner ok">
          <b>Versão {update.version} disponível.</b> {update.body ? `${update.body} ` : ""}
          <button className="ghost" disabled={updating} onClick={async () => { setUpdating(true); try { await installUpdate(update); } catch { setUpdating(false); } }}>
            {updating ? "Baixando…" : "Atualizar e reiniciar"}
          </button>
        </div>
      )}
      {!inTauri() && (
        <div className="banner">
          <b>Versão web, modo manual.</b> Ela não lê o cliente nem a partida: preencha o draft à mão. Pra seguir a seleção sozinho, use o app no Windows.
          Durante a partida, use o timer pelo endereço que o app mostra no topo (tipo <code>http://192.168.0.10:7777</code>).
        </div>
      )}
      {inTauri() && phase === "InProgress" && (
        <div className="banner">
          <b>Você está em partida.</b> O draft da seleção fica aqui. Pro timer de feitiços, abra no Mac ou no celular: <code>{timerUrl || "http://IP-do-PC:7777"}</code>
        </div>
      )}
      <div className="roles" role="group" aria-label="Sua rota">
        <span className="lbl">Sua rota</span>
        {ROLES.map((r) => (
          <button key={r} aria-pressed={myRole === r} disabled={following && live?.status === "active" && !!live.draft.myRole} onClick={() => setUi({ ...ui, role: r })}>{RN[r]}</button>
        ))}
        {myRole !== "sup" && <span className="note fillnote">Fill: pesa seus jogos na rota, a comp e, onde você tem poucos jogos, campeões fáceis e parecidos com os seus.</span>}
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
          <div className="specials">
            {([["counter", special.counter, special.opp ? `vs ${special.opp}` : "aparece quando o oponente da sua rota for revelado"],
               ["synergy", special.synergy, special.partner ? `com ${special.partner}` : "aparece quando o seu parceiro pickar"]] as const).map(([k, sp, ctx]) => (
              <div key={k} className={`special ${k}`}>
                <div className="lbl">{k === "counter" ? "Opção counter" : "Opção sinergia"} <span className="note">{ctx}</span></div>
                {sp ? (
                  <div className="alt">
                    <Icon cat={cat} champ={cat.byName.get(norm(sp.name)) ?? null} size={30} />
                    <b>{sp.name}<small> {sp.tag}</small></b>
                    <span />
                    <span className="sc">{sp.wr.toFixed(1)}% · {sp.n}j</span>
                  </div>
                ) : <p className="note">{(k === "counter" ? special.opp : special.partner) ? "Sem dados suficientes ainda pra essa dupla." : ""}</p>}
              </div>
            ))}
          </div>
          {top && <BuildPanel champ={top.name} role={myRole} build={builds?.[myRole]?.[top.name] ?? snapshotBuild(top.name, myRole, names)} names={names} enemies={ROLES.map((r) => draft.enemy[r]).filter(Boolean) as string[]} flags={(n) => flags(n)} />}
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
          <h2 style={{ marginTop: 16 }}>Modelo treinado</h2>
          <p className="note">
            {trained
              ? `Treinado em ${trained.trainedAt ?? "?"} com ${trained.metrics.amostras_treino.toLocaleString("pt-BR")} jogos de sup (Mestre+ e Diamante 1, BR). AUC ${trained.metrics.auc_modelo.toFixed(3)}. ${conf > 0 ? `Peso atual: ${Math.round(conf * 100)}% (cresce com mais partidas).` : "Ainda aprendendo: não entra na nota até bater a média em jogos que não viu."}`
              : "Ainda não tem modelo publicado. Ele aparece aqui sozinho depois da primeira rodada de treino no GitHub."}
          </p>
          <h2 style={{ marginTop: 16 }}>Main</h2>
          <div className="prof">
            <div className="sl">
              <label htmlFor="main-in">Champ</label>
              <input id="main-in" className="banin wide" list="champ-list" defaultValue={settings.main} onBlur={(e) => { const c = cat.byName.get(norm(e.target.value)); setSettings((s) => ({ ...s, main: c ? c.name : "" })); }} />
              <span />
            </div>
            <div className="sl">
              <label htmlFor="backups">Reservas</label>
              <input id="backups" className="banin wide" defaultValue={settings.backups.join(", ")} placeholder="ex: Sona, Nami"
                onBlur={(e) => setSettings((s) => ({ ...s, backups: e.target.value.split(",").map((x) => cat.byName.get(norm(x.trim()))?.name).filter(Boolean) as string[] }))} />
              <span />
            </div>
            <div className="sl">
              <label htmlFor="main-tol">Tolerância</label>
              <input type="range" id="main-tol" min={0} max={6} step={0.5} value={settings.mainTolerance} onChange={(e) => setSettings((s) => ({ ...s, mainTolerance: +e.target.value }))} />
              <output>{settings.mainTolerance.toFixed(1)}</output>
            </div>
            {([["mainAvoid", "Bloqueia a main", "var(--bad)", avoidText, setAvoidText], ["mainWarn", "Alerta (soma com o draft)", "var(--warn)", warnText, setWarnText]] as const).map(([key, label, color, text, setText]) => (
              <div key={key}>
                <div className="lbl">{label}</div>
                <div className="banrow">
                  {settings[key].map((n) => (
                    <button key={n} className="avoid" title={`Tirar ${n}`} onClick={() => setSettings((s) => ({ ...s, [key]: s[key].filter((x) => x !== n) }))}>
                      <Icon cat={cat} champ={cat.byName.get(norm(n)) ?? null} size={30} ring={color} /><span>{n}</span>
                    </button>
                  ))}
                  <input className="banin" list="champ-list" placeholder="+ campeão" value={text} onChange={(e) => {
                    const c = cat.byName.get(norm(e.target.value));
                    if (c) { setSettings((s) => ({ ...s, [key]: s[key].includes(c.name) ? s[key] : [...s[key], c.name] })); setText(""); } else setText(e.target.value);
                  }} />
                </div>
              </div>
            ))}
            <p className="note">
              No sup, a main é o pick sempre que o draft não pesar mais que a tolerância contra ela (lane com peso 1,5, dados, comp, seu ADC e metade do risco de blind).
              {decision.main ? ` Agora: ${decision.main.situation >= 0 ? "+" : ""}${decision.main.situation.toFixed(1)}, ${decision.main.kept ? "jogável" : "evitar"}.` : ""}
            </p>
          </div>
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
