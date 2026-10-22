"""
Gera partidas falsas com efeitos plantados, só pra testar o pipeline sem a API.
Efeitos plantados: Soraka perde pra Pyke quando o Pyke tem elo alto; Soraka ganha com Nilah; Nami ganha contra Nautilus.
Uso: python model/fake_data.py  (escreve em model/data_fake/)
"""
import gzip, json, random
from pathlib import Path

OUT = Path(__file__).parent / "data_fake"
R = random.Random(1)
TOP = ["Garen", "Darius", "Ornn", "Camille", "Jax", "Fiora", "Malphite", "Sion"]
JG = ["Vi", "Lee Sin", "Graves", "Nocturne", "Jarvan IV", "Sejuani", "Kha'Zix", "Viego"]
MID = ["Ahri", "Xerath", "Zed", "Orianna", "Syndra", "Viktor", "Yasuo", "Lux"]
ADC = ["Jinx", "Kai'Sa", "Ezreal", "Jhin", "Caitlyn", "Nilah", "Draven", "Tristana"]
SUP = ["Soraka", "Sona", "Nami", "Janna", "Lulu", "Milio", "Pyke", "Nautilus", "Thresh", "Leona"]


def api(n):  # nome como a API manda
    return {"Kai'Sa": "Kaisa", "Lee Sin": "LeeSin", "Jarvan IV": "JarvanIV", "Kha'Zix": "Khazix"}.get(n, n)


def main(n=6000, mult=1.0):
    OUT.mkdir(exist_ok=True)
    players = {f"p{i}": {"tier": R.choice(["MASTER", "GRANDMASTER", "CHALLENGER", "DIAMOND1"]), "lp": R.randint(0, 900)} for i in range(400)}
    mains = {f"p{i}": SUP[i % 6] for i in range(60)}  # mains de cada sup
    with gzip.open(OUT / "matches.jsonl.gz", "wt") as f:
        for k in range(n):
            teams = []
            for side in range(2):
                sup_player = R.choice(list(mains)) if R.random() < 0.6 else f"p{R.randint(60, 399)}"
                sup = mains.get(sup_player) or R.choice(SUP)
                picks = [R.choice(TOP), R.choice(JG), R.choice(MID), R.choice(ADC), sup]
                pp = [f"p{R.randint(60, 399)}" for _ in range(4)] + [sup_player]
                teams.append({"picks": [{"r": r, "c": api(c), "p": p} for r, c, p in zip(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"], picks, pp)]})
            z = 0.0
            for me, op in ((0, 1), (1, 0)):
                s = teams[me]["picks"][4]["c"]
                esup = teams[op]["picks"][4]
                adc = teams[me]["picks"][3]["c"]
                sign = 1 if me == 0 else -1
                if s == "Soraka" and esup["c"] == "Pyke":
                    elo = {"DIAMOND1": 0, "MASTER": 1, "GRANDMASTER": 2, "CHALLENGER": 3}[players[esup["p"]]["tier"]]
                    z -= sign * 0.35 * elo * mult
                if s == "Soraka" and adc == "Nilah":
                    z += sign * 0.6 * mult
                if s == "Nami" and esup["c"] == "Nautilus":
                    z += sign * 0.5 * mult
            w0 = R.random() < 1 / (1 + pow(2.718, -z))
            teams[0]["win"], teams[1]["win"] = w0, not w0
            f.write(json.dumps({"id": f"BR1_{k}", "v": "16.21", "t": k, "d": 1800, "teams": teams}) + "\n")
    (OUT / "players.json").write_text(json.dumps(players))
    print("ok", n)


if __name__ == "__main__":
    import sys
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 6000, float(sys.argv[2]) if len(sys.argv) > 2 else 1.0)
