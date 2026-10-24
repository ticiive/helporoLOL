"""Partidas a partir do corte, no formato do app (nomes de exibição), pra testar a nota do draft."""
import gzip, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from train import display
R = {"TOP": "top", "JUNGLE": "jg", "MIDDLE": "mid", "BOTTOM": "adc", "UTILITY": "sup"}
cut, dest = int(sys.argv[1]), sys.argv[2]
out = []
for line in gzip.open(Path(__file__).resolve().parent.parent / "data/matches.jsonl.gz", "rt"):
    m = json.loads(line)
    if m["t"] < cut:
        continue
    T = [{R[p["r"]]: display(p["c"]) for p in t["picks"] if p["r"] in R} for t in m["teams"]]
    for i in (0, 1):
        out.append({"w": m["teams"][i]["win"], "ally": T[i], "enemy": T[1 - i], "t": m["t"]})
json.dump(out, open(dest, "w"))
print("amostras de teste", len(out))
