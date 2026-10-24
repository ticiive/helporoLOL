"""
Médias Mestre+/D1 BR de cada campeão em cada rota, por minuto de jogo: base da revisão pós-jogo.
Gera out/bench.json: {rota: {campeão: {"n": jogos, métrica: [média, desvio]}}}
Métricas: mortes/10min, participação em abates, visão/min, CS/min, dano/min, cura+escudo em aliados/min,
ouro e CS aos 15 (quando há timeline).
"""
import gzip, json, os
from collections import defaultdict
from pathlib import Path
from train import display

ROOT = Path(__file__).parent
DATA = Path(os.environ.get("HELPORO_DATA", ROOT / "data"))
OUT = Path(os.environ.get("HELPORO_OUT", ROOT / "out"))
ROLE = {"TOP": "top", "JUNGLE": "jg", "MIDDLE": "mid", "BOTTOM": "adc", "UTILITY": "sup"}


def metrics(p, team_kills, minutes, g):
    s = p["s"]
    out = {"d10": 10 * s["d"] / minutes, "kp": (s["k"] + s["a"]) / max(1, team_kills),
           "vs": s["vs"] / minutes, "cs": s["cs"] / minutes, "dmg": s["dmg"] / minutes, "hs": s["hs"] / minutes,
           "cw": s.get("cw", 0) / minutes * 10}
    if g and str(p.get("id", 0)) in g:
        v = g[str(p["id"])]
        out["g15"] = v[3]; out["cs15"] = v[4]
    return out


def main():
    gold = {}
    gf = DATA / "gold.jsonl.gz"
    if gf.exists():
        with gzip.open(gf, "rt") as f:
            for line in f:
                r = json.loads(line); gold[r["id"]] = r["g"]
    acc = defaultdict(lambda: defaultdict(list))
    with gzip.open(DATA / "matches.jsonl.gz", "rt") as f:
        for line in f:
            m = json.loads(line)
            minutes = max(1.0, m["d"] / 60)
            if minutes < 15:
                continue
            g = gold.get(m["id"])
            for t in m["teams"]:
                tk = sum(p.get("s", {}).get("k", 0) for p in t["picks"])
                for p in t["picks"]:
                    if "s" not in p or p["r"] not in ROLE:
                        continue
                    for k, v in metrics(p, tk, minutes, g).items():
                        acc[(ROLE[p["r"]], display(p["c"]))][k].append(v)
    out = defaultdict(dict)
    for (role, c), ms in acc.items():
        n = len(ms["d10"])
        if n < 30:
            continue
        row = {"n": n}
        for k, vs in ms.items():
            if len(vs) < 20:
                continue
            mu = sum(vs) / len(vs)
            sd = (sum((x - mu) ** 2 for x in vs) / len(vs)) ** 0.5
            row[k] = [round(mu, 3), round(sd, 3)]
        out[role][c] = row
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "bench.json").write_text(json.dumps(out, ensure_ascii=False))
    print("bench:", {r: len(v) for r, v in out.items()})


if __name__ == "__main__":
    main()
