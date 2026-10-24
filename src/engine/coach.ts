/**
 * Coach da partida: dicas da fase de rotas, do meio e do fim, específicas do draft. Usa a habilidade
 * que mais pesa de cada inimigo (com o nome em português e a recarga no nível 1), os tempos da
 * temporada 2026, os dados da lane (Mestre+ BR) e o plano de jogo (quem escala, lutas, pick, split).
 */
import { DEFENSE, EARLY_JG, FARM_JG, LVL2, LVL6, T, THREAT, mmss, type Key } from "./coachData";
import { ROLES, ccThreat, type Role, type Team } from "./engine";
import { gamePlan, type Scaling } from "./gameplan";
import { mainDelta } from "./lanedata";
import type { Kit } from "../lib/spells";

type Flags = (n: string | null) => string;
export interface Tip { t: string; kind: "do" | "avoid" | "info"; prio: number }
export interface Phase { key: "lane" | "mid" | "late"; label: string; tips: Tip[] }
export interface Timed { at: number; t: string }
export interface Coach { win: string; phases: Phase[]; timeline: Timed[]; threats: { champ: string; ability: string; type: string }[] }

const ROLE_PT: Record<Role, string> = { top: "top", jg: "jungle", mid: "mid", adc: "ADC", sup: "sup" };
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}` : xs[0] ?? "");

export function coach(o: { role: Role; me: string | null; ally: Team; enemy: Team; flags: Flags; scaling?: Scaling; kits: Map<string, Kit> }): Coach | null {
  const { role, me, ally, enemy, flags, kits } = o;
  const enemies = ROLES.map((r) => enemy[r]).filter(Boolean) as string[];
  if (enemies.length < 2) return null;
  const abil = (champ: string, key: Key) => {
    const k = kits.get(champ); if (!k) return key === "P" ? "passiva" : key;
    if (key === "P") return `passiva (${k.P})`;
    return `${key} (${k[key].name})`;
  };
  const cd1 = (champ: string, key: Key) => { const k = kits.get(champ); return k && key !== "P" ? k[key].cd[0] : null; };
  const threatOf = (c: string) => THREAT[c] ? { champ: c, ...THREAT[c], ability: abil(c, THREAT[c].key) } : null;
  const lane: Tip[] = [], mid: Tip[] = [], late: Tip[] = [];
  const timeline: Timed[] = [];
  const isBot = role === "sup" || role === "adc";
  const opp = isBot ? [enemy.sup, enemy.adc].filter(Boolean) as string[] : [enemy[role]].filter(Boolean) as string[];
  const def = me ? DEFENSE[me] : undefined;
  const myDef = me && def ? `${abil(me, def.key)}` : null;

  // ---------- fase de rotas ----------
  const lvl2E = opp.filter((c) => LVL2.has(c));
  const lvl2A = isBot ? [me, ally.adc, ally.sup].filter((c): c is string => !!c && LVL2.has(c)) : [];
  if (isBot && lvl2E.length) lane.push({ prio: 9, kind: "avoid", t: `Nível 2 deles é forte (${list(lvl2E)}). O 2 chega com a primeira wave + 1 minion melee da segunda (7 minions): se eles chegarem antes, recue pra trás da wave na hora.` });
  else if (isBot && lvl2A.length) lane.push({ prio: 7, kind: "do", t: `O nível 2 de vocês é forte (${list([...new Set(lvl2A)])}): ajude a empurrar a primeira wave e entre assim que chegar, antes deles.` });
  for (const c of role === "jg" ? [] : opp) {
    const th = threatOf(c); if (!th) continue;
    const cd = cd1(c, th.key);
    if (th.type === "hook") lane.push({ prio: 10, kind: "avoid", t: `${c}: fique atrás dos minions, fora da linha do ${th.ability}${cd ? ` (recarga de ${cd}s no nível 1)` : ""}. Quando ele errar, é a sua janela de troca.` });
    else if (th.type === "engage") lane.push({ prio: 9, kind: "avoid", t: `${c} entra com ${th.ability}: não fique na frente da wave quando ele estiver perto${myDef ? `; guarde o seu ${myDef}: ${def!.use}` : ""}.` });
    else if (th.type === "cc" || th.type === "pick") lane.push({ prio: 7, kind: "avoid", t: `${c} prende com ${th.ability}${cd ? ` (${cd}s no nível 1)` : ""}: ande de lado e use os minions de escudo; depois que gastar, vocês trocam.` });
    else if (th.type === "dive") lane.push({ prio: 6, kind: "avoid", t: isBot ? `${c} mergulha (${th.ability}): fique perto do seu ${role === "sup" ? "ADC" : "sup"} pra responderem juntos.` : `${c} mergulha (${th.ability}): quando ele tiver o ${th.key}, jogue perto da torre e com visão.` });
  }
  if (isBot && opp.some((c) => /[KL]/.test(flags(c))) && !opp.some((c) => THREAT[c]?.type === "hook" || THREAT[c]?.type === "engage"))
    lane.push({ prio: 6, kind: "avoid", t: `Bot deles é de poke (${list(opp)}): não fique parada no alcance e não gaste sustain antes deles errarem as skills.` });
  const six = opp.filter((c) => LVL6.has(c));
  if (six.length) lane.push({ prio: 6, kind: "avoid", t: `No nível 6, ${list(six.map((c) => `${c} (${abil(c, "R")})`))} ganha all-in: depois do 6 jogue mais pra trás e com visão.` });
  if (role === "sup" && me && enemy.sup) {
    const d = mainDelta(me, enemy.sup);
    if (d.n >= 300) lane.push({ prio: 5, kind: d.d >= 0 ? "do" : "info", t: `${me} contra ${enemy.sup}: ${d.d >= 1 ? "lane boa pra vocês, jogue pra frente" : d.d <= -1 ? "lane difícil, jogue pra empatar e não pra ganhar" : "lane equilibrada, quem errar menos ganha"} (${d.n.toLocaleString("pt-BR")} jogos).` });
  }
  // jungle inimigo
  const ej = enemy.jg;
  if (ej && role !== "jg") {
    const th = threatOf(ej);
    if (EARLY_JG.has(ej)) {
      lane.push({ prio: 9, kind: "avoid", t: `${ej} ganka cedo: o primeiro gank pode chegar entre ${mmss(T.gank3[0])} e ${mmss(T.gank3[1])} (campos nascem aos 0:55). Tenha visão no rio e no tribush antes disso${th ? ` e respeite o ${th.ability}` : ""}.` });
      timeline.push({ at: T.gank3[0] - 20, t: `${ej} pode gankar a partir de ${mmss(T.gank3[0])}: ward no rio/tribush agora.` });
    } else if (FARM_JG.has(ej)) lane.push({ prio: 5, kind: "info", t: `${ej} costuma farmar primeiro: o perigo cresce depois do full clear (${mmss(T.fullClear[0])}-${mmss(T.fullClear[1])}) e perto do dragão.` });
  }
  // visão e tempos (sup e quem mais ajuda nos objetivos)
  if (role === "sup") {
    lane.push({ prio: 8, kind: "do", t: "Primeira ward depois que a primeira wave chega: tribush (lado azul) ou arbusto do rio (lado vermelho). Nos primeiros 10 min, prefira as Faelights." });
    lane.push({ prio: 6, kind: "do", t: `Roam quando a wave bater na torre deles, quando o seu ADC voltar pra base ou quando o bot deles voltar. ${ally.mid && /[CEH]/.test(flags(ally.mid)) ? `O ${ally.mid} tem CC: é o melhor alvo de roam.` : "Vá onde o aliado tem CC pra completar o gank."}` });
    lane.push({ prio: 5, kind: "do", t: "A cada volta pra base, compre ward de controle e troque o trinket pra lente quando completar a missão do item." });
    late.push({ prio: 4, kind: "do", t: "Ward 60 s antes de cada objetivo nascer, limpe as wards deles com a lente e chegue junto com o time." });
  }
  if (role === "adc") lane.push({ prio: 6, kind: "do", t: "Farme sem passar do meio da lane quando o jungle deles não aparecer no mapa; empurre só com visão." });
  if (role === "mid") lane.push({ prio: 6, kind: "do", t: "Empurre a wave antes de rotacionar: o primeiro dragão nasce aos 5:00 e as vastilarvas aos 8:00." });
  if (role === "top") lane.push({ prio: 6, kind: "do", t: "Vastilarvas aos 8:00 do seu lado: tenha a wave empurrada perto disso pra ajudar o jungle." });
  if (role === "jg") {
    lane.push({ prio: 6, kind: "do", t: `Scuttle nasce aos ${mmss(T.scuttle)}: só disputa com prioridade das rotas do lado.` });
    if (ej) { const th = threatOf(ej); lane.push({ prio: 7, kind: EARLY_JG.has(ej) ? "avoid" : "do", t: EARLY_JG.has(ej) ? `${ej} é forte cedo${th ? ` (${th.ability})` : ""}: não divida a selva sem prioridade das rotas e espere ele aparecer pra fazer o lado oposto.` : `${ej} costuma farmar: dá pra gankar cedo ou invadir com prioridade das rotas.` }); }
    const gankable = (["top", "mid", "adc", "sup"] as Role[]).map((r) => enemy[r]).filter((c): c is string => !!c && !/[XDS]/.test(flags(c)) && !/N/.test(flags(c)));
    if (gankable.length) lane.push({ prio: 5, kind: "do", t: `Alvos de gank sem fuga: ${list(gankable.slice(0, 3))}. Gank com a wave do lado deles e com CC do aliado.` });
  }
  timeline.push(
    { at: 2 * 60 + 40, t: `Scuttle aos ${mmss(T.scuttle)}: ward no rio do lado do seu jungle.` },
    { at: T.drake - 75, t: "Dragão nasce aos 5:00: empurre a wave, ward de controle no rio/pit e chegue antes." },
    { at: T.grubs - 70, t: "Vastilarvas aos 8:00 no topo: se o seu jungle for, ajude com visão no rio top." },
    { at: T.leaveBot - 30, t: role === "sup" ? "Perto dos 14 min (ou depois da primeira torre): saia do bot e jogue com o jungle." : "Fim da fase de rotas: agrupe pros objetivos." },
    { at: T.herald - 75, t: "Arauto aos 15:00 (some 19:45): visão no rio top 60-90 s antes." },
    { at: T.baron - 90, t: "Barão nasce aos 20:00: visão em volta do pit 60-90 s antes, com o time." },
  );

  // ---------- meio e fim: plano (escala, lutas, pick, split) + ameaças ----------
  const plan = gamePlan({ ...ally, [role]: me }, enemy, role, flags, o.scaling);
  if (plan) {
    // as dicas de pickoff, dive e CC do plano são cobertas aqui com o nome da habilidade
    for (const t of plan.tips) {
      if (/^(Cuidado com pickoff|Eles mergulham|CC em cadeia)/.test(t.t)) continue;
      (t.phase === "late" ? late : t.phase === "mid" ? mid : lane).push({ prio: t.kind === "avoid" ? 6 : 5, kind: t.kind, t: t.t });
    }
    if (plan.focus) mid.push({ prio: 8, kind: "do", t: `Jogue em volta de ${plan.focus.name} (${ROLE_PT[plan.focus.role]}): ${plan.focus.why}.` });
    if (plan.threat) mid.push({ prio: 7, kind: "avoid", t: plan.threat });
  }
  const picks = enemies.filter((c) => !opp.includes(c)).map(threatOf).filter((x): x is NonNullable<ReturnType<typeof threatOf>> => !!x && (x.type === "pick" || x.type === "hook" || x.type === "cc" || x.type === "supp"));
  if (picks.length) mid.push({ prio: 9, kind: "avoid", t: `Na névoa, respeite ${list(picks.slice(0, 3).map((p) => `${p.ability} de ${p.champ}`))}: não entre sozinha pra wardar; deixe a frontline dar facecheck e ward logo atrás.` });
  const divers = enemies.map(threatOf).filter((x): x is NonNullable<ReturnType<typeof threatOf>> => !!x && (x.type === "dive" || x.type === "engage") && !opp.includes(x.champ));
  const carry = role === "sup" ? ally.adc ?? ally.mid : null;
  if (divers.length && carry) late.push({ prio: 8, kind: "avoid", t: `Nas lutas, ${list(divers.slice(0, 2).map((d) => `${d.champ} entra com ${d.ability}`))}: fique perto do seu carry (${carry})${myDef ? ` e guarde o ${myDef} pra quando eles pularem` : ""}.` });
  mid.push({ prio: 6, kind: "info", t: `Arauto aos 15:00 (some 19:45) e Barão aos 20:00. Visão 60-90 s antes de cada um.` });
  late.push({ prio: 5, kind: "info", t: "Barão volta 6 min depois de morto; o Ancião nasce depois do 4º dragão e volta a cada 6 min." });
  const cc = ccThreat(enemies, flags);
  if (cc.level === 2) late.push({ prio: 7, kind: "avoid", t: `CC em cadeia (${list(cc.who)}): uma skill pega e o resto encadeia. Lute pelos lados, nunca na frente do time.` });

  const pick = (xs: Tip[], n: number) => [...new Map(xs.map((x) => [x.t, x])).values()].sort((a, b) => b.prio - a.prio).slice(0, n);
  const win = plan ? `${plan.verdict.title}. ${plan.verdict.text}` : "";
  const threats = enemies.map(threatOf).filter(Boolean).map((x) => ({ champ: x!.champ, ability: x!.ability, type: x!.type }));
  return {
    win,
    phases: [{ key: "lane", label: "Fase de rotas (0-14 min)", tips: pick(lane, 6) }, { key: "mid", label: "Meio de jogo (14-25 min)", tips: pick(mid, 5) }, { key: "late", label: "Fim de jogo (25+ min)", tips: pick(late, 5) }],
    timeline: timeline.sort((a, b) => a.at - b.at), threats,
  };
}
