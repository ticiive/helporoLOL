"""
Lane do sup medida em ouro (e winrate): como cada sup se sai contra o sup inimigo, contra o ADC inimigo
e junto de cada ADC. Ouro da dupla aos 15 min tem bem menos ruído que a vitória, então mede a lane com menos jogos.

Entradas: data/matches.jsonl.gz (todas) e data/gold.jsonl.gz (timelines; só partidas com sup do modelo).
Gera out/lane.json:
  {"sup": {sup: {"n", "gd", "vsSup": {campeão: [ouro, jogos, wr]}, "vsAdc": {...}, "withAdc": {...}}},
   "check": {...}}   ouro = diferença de ouro da dupla do bot aos 15 min, puxada pra média do sup se tiver pouca amostra.
Uso: python model/lane.py
"""
import gzip, json, os, random
from collections import defaultdict
from pathlib import Path
from train import display

ROOT = Path(__file__).parent
DATA = Path(os.environ.get("HELPORO_DATA", ROOT / "data"))
OUT = Path(os.environ.get("HELPORO_OUT", ROOT / "out"))
# só partidas antes desse horário (ms): usado pra validar em jogos que o cálculo não viu
UNTIL = int(os.environ.get("HELPORO_UNTIL", "0") or 0)
K_GOLD, K_WR = 30, 60  # jogos "virtuais" puxando pra média do sup


def bot(team):
    by = {p["r"]: p for p in team["picks"]}
    return by.get("UTILITY"), by.get("BOTTOM")


def main():
    gold = {}
    gf = DATA / "gold.jsonl.gz"
    if gf.exists():
        with gzip.open(gf, "rt") as f:
            for line in f:
                r = json.loads(line); gold[r["id"]] = r["g"]
    # acumula: [soma ouro, jogos com ouro, vitórias, jogos]
    acc = defaultdict(lambda: [0.0, 0, 0, 0])
    base = defaultdict(lambda: [0.0, 0, 0, 0])
    halves = defaultdict(lambda: [[0.0, 0], [0.0, 0]])  # confiabilidade: metade par/ímpar
    gd_win = [[0, 0], [0, 0]]  # ouro à frente aos 15 -> vitória?
    with gzip.open(DATA / "matches.jsonl.gz", "rt") as f:
        for line in f:
            m = json.loads(line)
            if UNTIL and m["t"] >= UNTIL:
                continue
            g = gold.get(m["id"])
            h = hash(m["id"]) & 1
            for ti, team in enumerate(m["teams"]):
                enemy = m["teams"][1 - ti]
                ms, ma = bot(team); es, ea = bot(enemy)
                if not (ms and ma and es and ea):
                    continue
                S = display(ms["c"])
                gd = None
                if g and all(str(p.get("id", 0)) in g for p in (ms, ma, es, ea)):
                    gd = (g[str(ms["id"])][3] + g[str(ma["id"])][3]) - (g[str(es["id"])][3] + g[str(ea["id"])][3])
                    gd_win[int(gd > 0)][0] += int(team["win"]); gd_win[int(gd > 0)][1] += 1
                for key in ((S, "vsSup", display(es["c"])), (S, "vsAdc", display(ea["c"])), (S, "withAdc", display(ma["c"]))):
                    a = acc[key]; a[2] += int(team["win"]); a[3] += 1
                    if gd is not None:
                        a[0] += gd; a[1] += 1
                        hh = halves[key][h]; hh[0] += gd; hh[1] += 1
                b = base[S]; b[2] += int(team["win"]); b[3] += 1
                if gd is not None:
                    b[0] += gd; b[1] += 1
    out = {}
    for S, b in base.items():
        if b[3] < 100:
            continue
        gd0 = b[0] / b[1] if b[1] else 0.0
        wr0 = b[2] / b[3]
        out[S] = {"n": b[3], "ng": b[1], "gd": round(gd0), "wr": round(100 * wr0, 1), "vsSup": {}, "vsAdc": {}, "withAdc": {}}
    for (S, kind, C), a in acc.items():
        if S not in out or a[3] < 15:
            continue
        o = out[S]
        gd0 = o["gd"]; wr0 = o["wr"] / 100
        gdv = round((a[0] + K_GOLD * gd0) / (a[1] + K_GOLD)) if a[1] else None
        wrv = round(100 * (a[2] + K_WR * wr0) / (a[3] + K_WR), 1)
        o[kind][C] = [gdv, a[1], wrv, a[3]]  # ouro aos 15 (ou None), jogos com ouro, winrate, jogos
    # checagens: ouro aos 15 prevê vitória? e o efeito do matchup se repete entre as duas metades dos dados?
    xs, ys = [], []
    for key, (h0, h1) in halves.items():
        if h0[1] >= 25 and h1[1] >= 25:
            xs.append(h0[0] / h0[1]); ys.append(h1[0] / h1[1])
    def corr(x, y):
        n = len(x)
        if n < 5: return None
        mx, my = sum(x) / n, sum(y) / n
        sx = sum((a - mx) ** 2 for a in x) ** 0.5; sy = sum((b - my) ** 2 for b in y) ** 0.5
        return round(sum((a - mx) * (b - my) for a, b in zip(x, y)) / (sx * sy), 3) if sx and sy else None
    check = {"partidas_com_ouro": len(gold),
             "wr_quando_a_frente_aos_15": round(100 * gd_win[1][0] / gd_win[1][1], 1) if gd_win[1][1] else None,
             "wr_quando_atras_aos_15": round(100 * gd_win[0][0] / gd_win[0][1], 1) if gd_win[0][1] else None,
             "matchups_testados": len(xs), "repete_entre_metades": corr(xs, ys)}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "lane.json").write_text(json.dumps({"sup": out, "check": check}, ensure_ascii=False))
    print("lane:", len(out), "sups ·", json.dumps(check, ensure_ascii=False))


if __name__ == "__main__":
    main()
