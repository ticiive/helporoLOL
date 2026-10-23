"""
Treina o modelo de escolha de sup a partir das partidas coletadas.

Pergunta que ele responde: nesse draft, qual a chance de vitória com cada sup?
Só numpy, sem framework, pra rodar leve no GitHub Actions.

O que entra na chance de vitória (z é o logit):
  base do sup                          b[s]
  força geral de cada campeão          a[c]   (aliado soma, inimigo subtrai)
  tags manuais × sup                   aliados, inimigos, dupla inimiga do bot, seu ADC
  tags aprendidas (embeddings)         e[c] ∈ R^k, cruzadas com cada sup  -> "tags novas"
  sensibilidade a elo                  q[c] × elo do jogador inimigo × g[s]  -> o efeito "Pyke bom"
  diferença de elo entre os times      beta

Filtro de mains: Soraka, Sona e Nami só contam jogos de quem é main delas.
Janna, Lulu e Milio contam todo mundo.

Uso: python model/train.py
"""
import gzip, json, os, re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

from tags import TAG_LIST, tags_of

ROOT = Path(__file__).parent
DATA = Path(os.environ.get("HELPORO_DATA", ROOT / "data"))
OUT = Path(os.environ.get("HELPORO_OUT", ROOT / "out"))
SUPS = ["Soraka", "Sona", "Nami", "Janna", "Lulu", "Milio"]
MAIN_ONLY = {"Soraka", "Sona", "Nami"}
ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]
K = 4  # número de tags aprendidas
TIER = {"DIAMOND1": 0.0, "MASTER": 1.0, "GRANDMASTER": 2.0, "CHALLENGER": 3.0}

# championName da API -> nome usado no app
SPECIAL = {"MonkeyKing": "Wukong", "Nunu": "Nunu & Willump", "Renata": "Renata Glasc"}
_roster = (Path(__file__).resolve().parents[1] / "src" / "engine" / "roster.ts").read_text()
_NAMES = re.findall(r"^([^|\n`]+)\|\d+\|", _roster, re.M)
_BY_NORM = {re.sub(r"[^a-z]", "", n.lower()): n for n in _NAMES}


def display(api_name: str) -> str:
    return SPECIAL.get(api_name) or _BY_NORM.get(re.sub(r"[^a-z]", "", api_name.lower()), api_name)


def elo_of(players: dict, puuid: str) -> float:
    p = players.get(puuid)
    if not p:
        return -0.5  # abaixo de Diamante 1 (ou fora do ladder)
    return TIER.get(p["tier"], 0.0) + min(p.get("lp", 0), 1500) / 1500


def load():
    players = json.loads((DATA / "players.json").read_text()) if (DATA / "players.json").exists() else {}
    matches = []
    with gzip.open(DATA / "matches.jsonl.gz", "rt") as f:
        for line in f:
            matches.append(json.loads(line))
    return players, matches


def build(players, matches):
    # quem é main de quem: partidas do jogador com o campeão dentro do que foi coletado
    plays = defaultdict(Counter)
    for m in matches:
        for t in m["teams"]:
            for p in t["picks"]:
                plays[p["p"]][display(p["c"])] += 1

    def is_main(puuid, champ):
        c = plays[puuid]
        n, tot = c[champ], sum(c.values())
        return n >= 8 and n / max(tot, 1) >= 0.3

    champs = sorted({display(p["c"]) for m in matches for t in m["teams"] for p in t["picks"]})
    lane = Counter(display(p["c"]) for m in matches for t in m["teams"] for p in t["picks"] if p["r"] in ("BOTTOM", "UTILITY"))
    adcs = Counter(display(p["c"]) for m in matches for t in m["teams"] for p in t["picks"] if p["r"] == "BOTTOM")
    cid = {c: i for i, c in enumerate(champs)}
    rows = []
    for m in matches:
        for side in (0, 1):
            me, op = m["teams"][side], m["teams"][1 - side]
            mine = {p["r"]: p for p in me["picks"]}
            theirs = {p["r"]: p for p in op["picks"]}
            if set(mine) != set(ROLES) or set(theirs) != set(ROLES):
                continue
            sup = display(mine["UTILITY"]["c"])
            if sup not in SUPS:
                continue
            if sup in MAIN_ONLY and not is_main(mine["UTILITY"]["p"], sup):
                continue
            rows.append({
                "s": SUPS.index(sup),
                "A": [cid[display(mine[r]["c"])] for r in ROLES[:4]],
                "E": [cid[display(theirs[r]["c"])] for r in ROLES],
                "eloA": [elo_of(players, mine[r]["p"]) for r in ROLES],
                "eloE": [elo_of(players, theirs[r]["p"]) for r in ROLES],
                "y": 1.0 if me["win"] else 0.0,
                "t": m["t"],
            })
    minimo = max(10, len(matches) // 500)
    return champs, rows, {c for c, n in lane.items() if n >= minimo}, {c for c, n in adcs.items() if n >= minimo}


class Model:
    def __init__(self, C, T, S, rng):
        r = lambda *s: rng.normal(0, 0.1, s)  # início não pode ser pequeno demais, senão os produtos não saem do zero
        self.p = {
            "b": np.zeros(S), "a": np.zeros(C), "beta": np.zeros(1),
            "WA": np.zeros((S, T)), "WE": np.zeros((S, T)), "WL": np.zeros((S, T)), "WD": np.zeros((S, T)),
            "e": r(C, K), "u": r(S, K), "v": r(S, K), "w": r(S, K),
            "q": rng.normal(0, 0.05, C), "g": np.ones(S),
        }
        # regularização L2 (tags aprendidas e efeitos por campeão precisam de mais freio)
        self.reg = {"b": 0, "a": 0.02, "beta": 0, "WA": 0.03, "WE": 0.03, "WL": 0.02, "WD": 0.02,
                    "e": 0.02, "u": 0.01, "v": 0.01, "w": 0.01, "q": 0.01, "g": 0.002}

    def forward(self, X):
        p = self.p
        s, A, E, L, D = X["s"], X["A"], X["E"], X["L"], X["D"]
        z = p["b"][s] + p["a"][A].sum(1) - p["a"][E].sum(1)
        z += (X["TA"] * p["WA"][s]).sum(1) + (X["TE"] * p["WE"][s]).sum(1)
        z += (X["TL"] * p["WL"][s]).sum(1) + (X["TD"] * p["WD"][s]).sum(1)
        SE, SA, SL = p["e"][E].sum(1), p["e"][A].sum(1), p["e"][L].sum(1)
        z += (p["u"][s] * SE).sum(1) + (p["v"][s] * SA).sum(1) + (p["w"][s] * SL).sum(1)
        QE = (p["q"][E] * X["eloE"]).sum(1)
        z += -p["g"][s] * QE + p["beta"][0] * X["eloDiff"]
        return z, (SE, SA, SL, QE)

    def grads(self, X, y, wt):
        p = self.p
        z, (SE, SA, SL, QE) = self.forward(X)
        pr = 1 / (1 + np.exp(-np.clip(z, -30, 30)))
        n = wt.sum()
        dz = (pr - y) * wt / n
        s, A, E, L, D = X["s"], X["A"], X["E"], X["L"], X["D"]
        g = {k: np.zeros_like(v) for k, v in p.items()}
        np.add.at(g["b"], s, dz)
        for j in range(A.shape[1]):
            np.add.at(g["a"], A[:, j], dz)
        for j in range(E.shape[1]):
            np.add.at(g["a"], E[:, j], -dz)
        for key, T in (("WA", X["TA"]), ("WE", X["TE"]), ("WL", X["TL"]), ("WD", X["TD"])):
            np.add.at(g[key], s, dz[:, None] * T)
        np.add.at(g["u"], s, dz[:, None] * SE)
        np.add.at(g["v"], s, dz[:, None] * SA)
        np.add.at(g["w"], s, dz[:, None] * SL)
        for idx, vec in ((E, p["u"][s]), (A, p["v"][s]), (L, p["w"][s])):
            for j in range(idx.shape[1]):
                np.add.at(g["e"], idx[:, j], dz[:, None] * vec)
        np.add.at(g["g"], s, -dz * QE)
        for j in range(E.shape[1]):
            np.add.at(g["q"], E[:, j], -dz * p["g"][s] * X["eloE"][:, j])
        g["beta"][0] = (dz * X["eloDiff"]).sum()
        loss = -(wt * (y * np.log(pr + 1e-9) + (1 - y) * np.log(1 - pr + 1e-9))).sum() / n
        for k in p:
            g[k] += self.reg[k] * p[k] * self.scale
        return loss, g

    scale = 1.0

    def fit(self, X, y, wt, epochs=800, lr=0.05, log=print):
        m = {k: np.zeros_like(v) for k, v in self.p.items()}
        v2 = {k: np.zeros_like(v) for k, v in self.p.items()}
        for it in range(1, epochs + 1):
            loss, g = self.grads(X, y, wt)
            for k in self.p:
                m[k] = 0.9 * m[k] + 0.1 * g[k]
                v2[k] = 0.999 * v2[k] + 0.001 * g[k] ** 2
                self.p[k] -= lr * (m[k] / (1 - 0.9 ** it)) / (np.sqrt(v2[k] / (1 - 0.999 ** it)) + 1e-8)
            if it % 100 == 0:
                log(f"  época {it}: perda {loss:.4f}")

    def predict(self, X):
        z, _ = self.forward(X)
        return 1 / (1 + np.exp(-np.clip(z, -30, 30)))


def arrays(rows, M):
    s = np.array([r["s"] for r in rows])
    A = np.array([r["A"] for r in rows])
    E = np.array([r["E"] for r in rows])
    eloA, eloE = np.array([r["eloA"] for r in rows]), np.array([r["eloE"] for r in rows])
    X = {"s": s, "A": A, "E": E, "L": E[:, 3:5], "D": A[:, 3:4], "eloE": eloE,
         "TA": M[A].sum(1), "TE": M[E].sum(1), "TL": M[E[:, 3:5]].sum(1), "TD": M[A[:, 3]],
         "eloDiff": eloA.mean(1) - eloE.mean(1)}
    return X, np.array([r["y"] for r in rows])


def auc(y, p):
    order = np.argsort(p)
    ranks = np.empty(len(p)); ranks[order] = np.arange(1, len(p) + 1)
    pos = y == 1
    npos, nneg = pos.sum(), (~pos).sum()
    return float((ranks[pos].sum() - npos * (npos + 1) / 2) / max(npos * nneg, 1))


def logloss(y, p):
    return float(-np.mean(y * np.log(p + 1e-9) + (1 - y) * np.log(1 - p + 1e-9)))


def main(epochs=800):
    players, matches = load()
    champs, rows, lane_set, adc_set = build(players, matches)
    OUT.mkdir(parents=True, exist_ok=True)
    counts = Counter(SUPS[r["s"]] for r in rows)
    print(f"partidas: {len(matches)} · amostras de sup: {len(rows)} · por sup: {dict(counts)}")
    if len(rows) < 200:
        (OUT / "report.md").write_text(f"# Modelo\n\nAinda poucas amostras ({len(rows)}). Deixe a coleta rodar mais dias.\n\nPor sup: {dict(counts)}\n")
        print("poucas amostras; treino adiado")
        return

    M = np.array([[1.0 if t in tags_of(c) else 0.0 for t in TAG_LIST] for c in champs])
    rows.sort(key=lambda r: r["t"])
    cut = int(len(rows) * 0.85)  # validação = jogos mais recentes
    Xtr, ytr = arrays(rows[:cut], M)
    Xva, yva = arrays(rows[cut:], M)
    # cada sup pesa igual, senão a Lulu (muito jogada) dominaria
    w_sup = {i: len(rows) / (len(SUPS) * max(counts[SUPS[i]], 1)) for i in range(len(SUPS))}
    wtr = np.array([w_sup[s] for s in Xtr["s"]])

    # escolhe a força da regularização pelos jogos mais recentes do treino (validação interna)
    def sub(X, idx):
        return {k: v[idx] for k, v in X.items()}
    ntr = len(ytr); icut = int(ntr * 0.85)
    i_in, i_out = np.arange(icut), np.arange(icut, ntr)
    best = None
    for scale in (0.3, 1.0, 3.0, 10.0, 30.0):
        m_ = Model(len(champs), len(TAG_LIST), len(SUPS), np.random.default_rng(7)); m_.scale = scale
        m_.fit(sub(Xtr, i_in), ytr[i_in], wtr[i_in], epochs=epochs, log=lambda *_: None)
        ll = logloss(ytr[i_out], m_.predict(sub(Xtr, i_out)))
        print(f"regularização x{scale}: perda na validação interna {ll:.4f}")
        if best is None or ll < best[0]:
            best = (ll, scale)
    model = Model(len(champs), len(TAG_LIST), len(SUPS), np.random.default_rng(7)); model.scale = best[1]
    print(f"usando regularização x{best[1]}")
    model.fit(Xtr, ytr, wtr, epochs=epochs)

    pva = model.predict(Xva)
    # No draft o app não sabe o elo dos times: a qualidade que importa é a do modelo sem a diferença de elo.
    # É ela que decide quanto o app confia no modelo (confidence() lê logloss_modelo e auc_modelo).
    Xn = dict(Xva); Xn["eloDiff"] = np.zeros_like(Xva["eloDiff"])
    pdr = model.predict(Xn)
    base = np.array([ytr[Xtr["s"] == s].mean() if (Xtr["s"] == s).any() else 0.5 for s in Xva["s"]])
    metrics = {"amostras_treino": int(cut), "amostras_validacao": int(len(rows) - cut),
               "logloss_modelo": logloss(yva, pdr), "logloss_so_media_do_sup": logloss(yva, base),
               "auc_modelo": auc(yva, pdr),
               "logloss_com_elo": logloss(yva, pva), "auc_com_elo": auc(yva, pva)}
    print(json.dumps(metrics, indent=1))

    p = {k: v.tolist() for k, v in model.p.items()}
    tag_idx = {c: [int(t) for t in np.nonzero(M[i])[0]] for i, c in enumerate(champs)}
    import datetime
    (OUT / "model.json").write_text(json.dumps({"champs": champs, "sups": SUPS, "tags": TAG_LIST, "tagIdx": tag_idx, "k": K, "params": p,
                                                "metrics": metrics, "trainedAt": datetime.datetime.utcnow().strftime("%Y-%m-%d")}))
    (OUT / "report.md").write_text(report(model, champs, counts, metrics, M, lane_set, adc_set))
    print("salvo em model/out/")


def report(model, champs, counts, metrics, M, lane_set, adc_set):
    P = model.p
    lines = ["# Relatório do modelo", "", f"Amostras por sup: {dict(counts)}", "",
             "## Qualidade (jogos mais recentes, que o modelo não viu)", "",
             f"- Perda do modelo: {metrics['logloss_modelo']:.4f} (só a média do sup: {metrics['logloss_so_media_do_sup']:.4f}; menor é melhor)",
             f"- AUC: {metrics['auc_modelo']:.3f} (0,5 = chute; num jogo com tanto acaso, 0,55 a 0,60 já é bom)",
             f"- Só o draft (sem a diferença de elo, que o app não sabe na seleção) é o que vale acima. Com o elo: AUC {metrics.get('auc_com_elo', 0):.3f}.",
             f"- O app só usa o modelo quando o draft sozinho bate a média do sup.", ""]
    # efeito de cada inimigo na dupla do bot, por sup, em pontos de winrate
    lines += ["## Inimigos do bot que mais mudam o jogo de cada sup", "",
              "Efeito em pontos de winrate quando o campeão é o sup ou o ADC inimigo, em relação à média.", ""]
    for si, s in enumerate(SUPS):
        eff = []
        for ci, c in enumerate(champs):
            if c not in lane_set:
                continue
            z = P["WL"][si] @ M[ci] + P["w"][si] @ P["e"][ci] + P["WE"][si] @ M[ci] + P["u"][si] @ P["e"][ci] - P["a"][ci]
            eff.append((z, c))
        eff.sort()
        fmt = lambda zc: f"{zc[1]} {25 * zc[0]:+.1f}"  # aprox.: 1 unidade de logit perto de 50% ≈ 25 pontos
        lines.append(f"- **{s}**, piores: " + ", ".join(fmt(x) for x in eff[:8]))
        lines.append(f"  melhores: " + ", ".join(fmt(x) for x in eff[::-1][:8]))
    lines += ["", "## Seu ADC: melhores e piores duplas", ""]
    for si, s in enumerate(SUPS):
        bots = sorted(((P["WD"][si] @ M[ci] + P["v"][si] @ P["e"][ci] + P["a"][ci], c) for ci, c in enumerate(champs) if c in adc_set))
        lines.append(f"- **{s}**: piores " + ", ".join(f"{c} {25*z:+.1f}" for z, c in bots[:5]) + " · melhores " + ", ".join(f"{c} {25*z:+.1f}" for z, c in bots[::-1][:5]))
    lines += ["", "## Tags que o modelo inventou", "",
              "Cada dimensão é um traço que o modelo achou útil e que as tags manuais não cobrem. Os campeões nas pontas mostram o que ele significa; dê um nome.", ""]
    for d in range(P["e"].shape[1]):
        order = np.argsort(P["e"][:, d])
        lines.append(f"- **Tag {d + 1}**: de um lado " + ", ".join(champs[i] for i in order[::-1][:8]) + "; do outro " + ", ".join(champs[i] for i in order[:8]))
        lines.append("  peso pra cada sup (inimigo): " + ", ".join(f"{s} {P['u'][si][d]:+.2f}" for si, s in enumerate(SUPS)))
    order = np.argsort(P["q"])[::-1]
    lines += ["", "## Campeões que ficam perigosos com elo alto (o efeito Pyke)", "",
              "Quanto maior, mais o campeão inimigo melhora conforme o jogador sobe de elo.", "",
              ", ".join(f"{champs[i]} {P['q'][i]:+.2f}" for i in order[:15]),
              "", "Sensibilidade de cada sup a isso: " + ", ".join(f"{s} {P['g'][si]:+.2f}" for si, s in enumerate(SUPS)), ""]
    return "\n".join(lines)


if __name__ == "__main__":
    main()
