/**
 * Plano de jogo: a partir dos dois times, quando o seu time é mais forte (curva por duração de jogo,
 * dados Mestre+ BR), em volta de quem jogar e o que evitar (lutas, pickoff, split, dive).
 */
import { ROLES, ccThreat, type Role, type Team } from "./engine";
import { SCALING } from "./scaling";
import { norm } from "../lib/ddragon";

export type Scaling = typeof SCALING;
export type Phase = "early" | "mid" | "late";
export const PHASES: [Phase, string][] = [["early", "Early (0-14 min)"], ["mid", "Meio (14-25 min)"], ["late", "Late (25+ min)"]];
type Flags = (n: string | null) => string;
export interface Plan {
  curve: number[]; // vantagem do seu time por faixa de duração, em pontos de winrate somados
  labels: string[];
  verdict: { kind: "cedo" | "tarde" | "meio"; title: string; text: string };
  focus: { name: string; role: Role; why: string } | null;
  threat: string | null;
  tips: { t: string; kind: "do" | "avoid"; phase: Phase }[];
}

const RN: Record<Role, string> = { top: "top", jg: "jungle", mid: "mid", adc: "ADC", sup: "sup" };
// faixa de duração -> momento do jogo, pra quem pensa em itens e não em minutos (aproximado)
const MOMENT = ["até 22 min (1 item)", "22-26 min (1-2 itens)", "26-30 min (2-3 itens)", "30-34 min (3 itens)", "34+ min (4+ itens)"];

export function gamePlan(ally: Team, enemy: Team, myRole: Role, flags: Flags, sc: Scaling = SCALING): Plan | null {
  const byNorm = new Map(Object.entries(sc.champs).map(([k, v]) => [norm(k), v]));
  const curveOf = (n: string | null) => (n ? byNorm.get(norm(n))?.wr.map((w) => w - 50) : undefined);
  const A = ROLES.map((r) => [r, ally[r]] as const).filter(([, n]) => n) as [Role, string][];
  const E = ROLES.map((r) => [r, enemy[r]] as const).filter(([, n]) => n) as [Role, string][];
  if (A.length < 3 || E.length < 3) return null;
  const sum = (list: [Role, string][]) => sc.bins.slice(0, -1).map((_, b) => list.reduce((a, [, n]) => a + (curveOf(n)?.[b] ?? 0), 0));
  const ca = sum(A), ce = sum(E);
  const curve = ca.map((v, i) => +(v - ce[i]).toFixed(1));
  const early = (curve[0] + curve[1]) / 2, late = (curve[3] + curve[4]) / 2;
  const peak = curve.indexOf(Math.max(...curve));
  // virada que se mantém até o fim (não conta cruzamento passageiro)
  const cross = curve.findIndex((_, i) => i > 0 && curve[i - 1] <= 0 && curve.slice(i).every((x) => x > 0));
  const fall = curve.findIndex((_, i) => i > 0 && curve[i - 1] >= 0 && curve.slice(i).every((x) => x < 0));

  let verdict: Plan["verdict"];
  if (late - early >= 3) verdict = { kind: "tarde", title: "Seu time escala", text: cross > 0
    ? `Vocês ficam na frente a partir de ${MOMENT[cross]}. Até lá, farme, jogue seguro e troque objetivo em vez de lutar.`
    : `A vantagem cresce com o tempo (melhor momento: ${MOMENT[peak]}). Não precisa forçar cedo; evite jogar o jogo fora antes disso.` };
  else if (early - late >= 3) verdict = { kind: "cedo", title: "Jogo pra ganhar cedo", text: fall > 0
    ? `Vocês são mais fortes cedo e perdem a vantagem por volta de ${MOMENT[fall]}. Force drag, arauto e torres e tente fechar antes disso.`
    : `O seu time é mais forte no começo (melhor momento: ${MOMENT[peak]}). Jogue agressivo e converta em objetivo cedo.` };
  else verdict = { kind: "meio", title: "Equilibrado no tempo", text: `Nenhum lado escala muito mais. O jogo decide em luta e objetivo; o melhor momento de vocês é ${MOMENT[peak]}.` };

  // em volta de quem jogar: quem mais ganha no momento forte do seu time (você fora)
  const gain = (n: string) => { const c = curveOf(n); return c ? (verdict.kind === "tarde" ? c[4] - c[0] : verdict.kind === "cedo" ? c[0] - c[4] : c[peak]) : -99; };
  const others = A.filter(([r]) => r !== myRole);
  const best = others.sort((x, y) => gain(y[1]) - gain(x[1]) + (y[0] === "adc" ? 0.5 : 0) - (x[0] === "adc" ? 0.5 : 0))[0];
  let focus: Plan["focus"] = null;
  if (best && gain(best[1]) > -99) {
    const c = curveOf(best[1])!;
    focus = { name: best[1], role: best[0], why: verdict.kind === "tarde" ? `é quem mais escala no seu time (${(c[0] + 50).toFixed(0)}% cedo → ${(c[4] + 50).toFixed(0)}% tarde): proteja e deixe farmar`
      : verdict.kind === "cedo" ? `é quem mais pesa cedo (${(c[0] + 50).toFixed(0)}% antes dos 22 min): jogue junto e ajude a abrir vantagem`
      : `é o mais forte do seu time no melhor momento de vocês` };
  }
  // o inimigo que mais escala: punir cedo
  let threat: string | null = null;
  const eLate = E.map(([r, n]) => { const c = curveOf(n); return { r, n, g: c ? c[4] - c[0] : 0, c }; }).sort((x, y) => y.g - x.g)[0];
  if (eLate && eLate.g >= 6 && eLate.c) threat = `${eLate.n} (${RN[eLate.r]}) escala muito (${(eLate.c[0] + 50).toFixed(0)}% → ${(eLate.c[4] + 50).toFixed(0)}%): puna cedo, visão e pressão do lado dele.`;

  const hf = (n: string, c: string) => flags(n).includes(c);
  const names = (list: [Role, string][], re: RegExp) => list.filter(([, n]) => re.test(flags(n))).map(([, n]) => n);
  const tips: Plan["tips"] = [];
  const tfA = names(A, /[WE]/), tfE = names(E, /[WE]/);
  if (tfA.length - tfE.length >= 2) tips.push({ phase: "mid", kind: "do", t: `Vocês ganham luta 5x5 (${tfA.join(", ")}): agrupe e lute em objetivo.` });
  if (tfE.length - tfA.length >= 2) tips.push({ phase: "mid", kind: "avoid", t: `Evite luta 5x5 de frente: eles têm mais AoE e engage (${tfE.join(", ")}). Lute em corredor só com vantagem.` });
  const pickE = names(E, /H/), pickA = names(A, /H/);
  if (pickE.length >= 2) tips.push({ phase: "mid", kind: "avoid", t: `Cuidado com pickoff (${pickE.join(", ")}): não ande sozinha, ward em dupla e respeite névoa.` });
  if (pickA.length >= 2) tips.push({ phase: "mid", kind: "do", t: `Seu time tem pick (${pickA.join(", ")}): jogue com visão pra caçar quem andar sozinho.` });
  const splitA = names(A, /S/), splitE = names(E, /S/);
  if (splitA.length) tips.push({ phase: "late", kind: "do", t: `${splitA.join(", ")} faz split: segure o mid e os objetivos do lado oposto enquanto ele pressiona.` });
  if (splitE.length) tips.push({ phase: "late", kind: "avoid", t: `${splitE.join(", ")} vai dar split: um responde o lado, o resto não corre atrás.` });
  const dive = names(E, /[DX]/);
  if (dive.length >= 2) tips.push({ phase: "late", kind: "avoid", t: `Eles mergulham (${dive.join(", ")}): fique perto do ${myRole === "sup" ? "seu ADC" : "time"} e guarde o peel pra eles.` });
  const cc = ccThreat(E.map(([, n]) => n), flags);
  if (cc.level === 2) tips.push({ phase: "early", kind: "avoid", t: `CC em cadeia (${cc.who.join(", ")}): tomar um é morte; não fique na frente da wave sem visão.` });
  if (E.filter(([, n]) => hf(n, "K") || hf(n, "L")).length >= 2) tips.push({ phase: "mid", kind: "avoid", t: "Eles têm muito poke: não fique trocando na frente de objetivo; entre de uma vez ou não entre." });
  // early: lane e jungle
  const jg = (t: Team) => t.jg ? { n: t.jg, c: curveOf(t.jg) } : null;
  const ej = jg(enemy), aj = jg(ally);
  if (ej?.c && ej.c[0] >= 2) tips.push({ phase: "early", kind: "avoid", t: `${ej.n} é forte cedo (${(ej.c[0] + 50).toFixed(0)}% antes dos 22 min): espere gank cedo; ward no rio e no tribush perto dos 3 min e não force sem visão.` });
  if (aj?.c && aj.c[0] >= 2) tips.push({ phase: "early", kind: "do", t: `O seu ${aj.n} é forte cedo: dê prioridade de rota pra ele chegar no rio no primeiro drag/arauto.` });
  const eBot = [enemy.sup, enemy.adc].filter(Boolean) as string[];
  const engage = eBot.filter((n) => /[EH]/.test(flags(n)));
  if (myRole === "sup" || myRole === "adc") {
    if (engage.length) tips.push({ phase: "early", kind: "avoid", t: `Bot deles tem engage/hook (${engage.join(", ")}): fique atrás dos minions e jogue em volta dos cooldowns que você viu eles usarem.` });
    else if (eBot.some((n) => /[KL]/.test(flags(n)))) tips.push({ phase: "early", kind: "avoid", t: `Bot deles é de poke (${eBot.join(", ")}): não troque dano à toa; segure sustain pra quando eles errarem a skill.` });
  }
  if (verdict.kind === "cedo") tips.push({ phase: "early", kind: "do", t: "É o momento de vocês: jogue a lane pra frente e puxe o jungle pras jogadas." });
  if (verdict.kind === "tarde") tips.push({ phase: "early", kind: "do", t: "Lane é pra sobreviver e farmar, não pra ganhar: troque só quando for de graça." });
  if (verdict.kind === "tarde") tips.push({ phase: "late", kind: "do", t: "Agora é o momento de vocês: agrupe em volta do carry e force barão/alma com visão." });
  if (verdict.kind === "cedo") tips.push({ phase: "late", kind: "avoid", t: "O tempo joga contra: evite luta aberta; feche com objetivo e jogue por pick." });
  return { curve, labels: ["<22", "22-26", "26-30", "30-34", "34+"], verdict, focus, threat, tips };
}
