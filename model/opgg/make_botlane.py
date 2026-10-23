"""Gera src/engine/botlane.ts a partir das tabelas do op.gg (16.21, Esmeralda+) salvas aqui."""
import collections, json, pathlib, re
here = pathlib.Path(__file__).parent
def rows(f):
    out = {}
    for line in (here / f).read_text().splitlines():
        if not line.strip(): continue
        k, v = line.split("=", 1)
        out[k] = [(n.strip(), float(w), int(g)) for n, w, g in (x.split(":") for x in v.split(","))]
    return out
vs, da, ds = rows("sup_vs.txt"), rows("duo_adc.txt"), rows("duo_sup.txt")
# matchup sup x sup: junta as duas páginas (A vs B na página de A, 100 - B vs A na de B)
acc = collections.defaultdict(lambda: [0.0, 0])
for me, rs in vs.items():
    for opp, w, g in rs:
        a = acc[(me, opp)]; a[0] += w * g; a[1] += g
        b = acc[(opp, me)]; b[0] += (100 - w) * g; b[1] += g
champs = (here.parent.parent / "src/engine/champions.ts").read_text()
SUPPORTS = set(re.findall(r'"([^"]+)"', re.search(r"SUPPORTS = new Set\(\[(.*?)\]", champs).group(1)))
SUPVS = collections.defaultdict(dict)
for (me, opp), (s, g) in acc.items():
    if me == opp or g < 120 or me not in SUPPORTS: continue
    SUPVS[me][opp] = [round(s / g, 2), g // 2 if (opp in vs and me in vs) else g]
# dupla ADC + sup
acc2 = collections.defaultdict(lambda: [0.0, 0])
for adc, rs in da.items():
    for sup, w, g in rs: a = acc2[(adc, sup)]; a[0] += w * g; a[1] += g
for sup, rs in ds.items():
    for adc, w, g in rs: a = acc2[(adc, sup)]; a[0] += w * g; a[1] += g
DUO = collections.defaultdict(dict)
for (adc, sup), (s, g) in acc2.items():
    if g >= 200: DUO[adc][sup] = [round(s / g, 2), g]
# winrate base: ADC pela média das duplas; sup pela média dos matchups
def wmean(xs): t = sum(g for _, g in xs); return round(sum(w * g for w, g in xs) / t, 2) if t else 50
ADC_BASE = {a: wmean([(w, g) for w, g in m.values()]) for a, m in DUO.items()}
SUP_BASE = {s: wmean([(w, g) for w, g in m.values()]) for s, m in SUPVS.items()}
ts = f'''/**
 * Botlane (op.gg 16.21, Esmeralda+, gerado por model/opgg/make_botlane.py).
 * SUPVS[sup][supInimigo] = [winrate do sup, jogos]; DUO[adc][sup] = [winrate da dupla, jogos].
 * Provisório: quando o modelo Mestre+ gerar counters/sinergias, eles têm prioridade.
 */
export const SUPVS: Record<string, Record<string, [number, number]>> = {json.dumps(SUPVS, ensure_ascii=False, separators=(",", ":"))};
export const DUO: Record<string, Record<string, [number, number]>> = {json.dumps(DUO, ensure_ascii=False, separators=(",", ":"))};
export const ADC_BASE: Record<string, number> = {json.dumps(ADC_BASE, ensure_ascii=False, separators=(",", ":"))};
export const SUP_BASE: Record<string, number> = {json.dumps(SUP_BASE, ensure_ascii=False, separators=(",", ":"))};

/** Winrate do seu sup contra o sup inimigo. */
export function supVs(me: string, opp: string) {{ const r = SUPVS[me]?.[opp]; return r ? {{ wr: r[0], n: r[1] }} : null; }}
/** Dupla com o seu ADC: delta = quanto a dupla ganha além do esperado pelos dois separados. */
export function duo(adc: string, sup: string) {{
  const r = DUO[adc]?.[sup]; if (!r) return null;
  const exp = (SUP_BASE[sup] ?? 50) + (ADC_BASE[adc] ?? 50) - 50;
  return {{ wr: r[0], n: r[1], delta: +(r[0] - exp).toFixed(2) }};
}}
const shrink = (d: number, n: number, k: number) => (d * n) / (n + k);
/** Os melhores sups contra um sup inimigo (fora os que não dá pra pickar). */
export function bestVs(opp: string, skip: Set<string>, n = 3) {{
  return Object.keys(SUPVS).filter((s) => !skip.has(s)).map((s) => ({{ name: s, ...supVs(s, opp)! }})).filter((x) => x.wr && x.n >= 150)
    .sort((a, b) => shrink(b.wr - 50, b.n, 300) - shrink(a.wr - 50, a.n, 300)).slice(0, n);
}}
/** Os sups que mais rendem com o seu ADC. */
export function bestWith(adc: string, skip: Set<string>, n = 3) {{
  return Object.keys(DUO[adc] ?? {{}}).filter((s) => !skip.has(s)).map((s) => ({{ name: s, ...duo(adc, s)! }}))
    .sort((a, b) => shrink(b.delta, b.n, 500) - shrink(a.delta, a.n, 500)).slice(0, n);
}}
'''
(here.parent.parent / "src/engine/botlane.ts").write_text(ts)
print(len(SUPVS), "sups", len(DUO), "adcs")
print("vs Lux:", sorted(((SUPVS[s]["Lux"][0], s) for s in SUPVS if "Lux" in SUPVS[s]), reverse=True)[:6])
print("Cait base", ADC_BASE["Caitlyn"], {s: (v, round(v[0] - (SUP_BASE.get(s,50) + ADC_BASE["Caitlyn"] - 50), 2)) for s, v in DUO["Caitlyn"].items()})
print("vs Senna:", sorted(((SUPVS[s]["Senna"][0], s) for s in SUPVS if "Senna" in SUPVS[s]), reverse=True)[:6])
