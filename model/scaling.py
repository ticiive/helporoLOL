"""
Winrate de cada campeão por duração de jogo (Mestre+ / Diamante 1 do BR): quem ganha cedo e quem escala.
Base do "plano de jogo" do app (ganhar rápido ou farmar, em volta de quem jogar).

Gera out/scaling.json: {"bins": [limites em minutos], "champs": {campeão: {"n": jogos, "wr": [winrate por faixa]}}}
Cada faixa é puxada pro winrate geral do campeão quando tem pouca amostra.
Cuidado: jogo curto também é jogo de surrender, então a curva mistura "forte cedo" com "time que desiste".

Uso: python model/scaling.py [--ts ../src/engine/scaling.ts]
"""
import gzip, json, os, sys
from collections import defaultdict
from pathlib import Path
from train import display

ROOT = Path(__file__).parent
DATA = Path(os.environ.get("HELPORO_DATA", ROOT / "data"))
OUT = Path(os.environ.get("HELPORO_OUT", ROOT / "out"))
BINS = [0, 22, 26, 30, 34, 99]
K = 150  # jogos "virtuais" no winrate geral, por faixa


def main():
    acc = defaultdict(lambda: [[0, 0] for _ in range(len(BINS) - 1)])
    with gzip.open(DATA / "matches.jsonl.gz", "rt") as f:
        for line in f:
            m = json.loads(line)
            d = m["d"] / 60
            b = next(i for i in range(len(BINS) - 1) if BINS[i] <= d < BINS[i + 1])
            for t in m["teams"]:
                for p in t["picks"]:
                    a = acc[display(p["c"])][b]
                    a[0] += int(t["win"]); a[1] += 1
    champs = {}
    for c, bins in acc.items():
        n = sum(x[1] for x in bins)
        if n < 300:
            continue
        wr = sum(x[0] for x in bins) / n
        champs[c] = {"n": n, "wr": [round(100 * (w + K * wr) / (g + K), 1) for w, g in bins]}
    out = {"bins": BINS, "champs": champs}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "scaling.json").write_text(json.dumps(out, ensure_ascii=False))
    print(f"scaling: {len(champs)} campeões")
    if "--ts" in sys.argv:
        ts = Path(sys.argv[sys.argv.index("--ts") + 1])
        ts.write_text("/** Winrate por duração de jogo (gerado por model/scaling.py; o app troca pelo scaling.json da branch data quando houver). */\n"
                      f"export const SCALING: {{ bins: number[]; champs: Record<string, {{ n: number; wr: number[] }}> }} = {json.dumps(out, ensure_ascii=False, separators=(',', ':'))};\n")


if __name__ == "__main__":
    main()
