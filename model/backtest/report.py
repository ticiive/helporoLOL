"""Quanto a nota do draft prevê vitória nas partidas de teste, e os pesos que a regressão logística sugere."""
import json, sys
import numpy as np
r = np.array(json.load(open(sys.argv[1]))); y = r[:, 0]; X = r[:, 1:5]; score = r[:, 5]; rank = r[:, 6]
def auc(y, p):
    o = np.argsort(p); rk = np.empty(len(p)); rk[o] = np.arange(len(p)); pos = y == 1; n1 = pos.sum(); n0 = len(y) - n1
    return (rk[pos].sum() - n1 * (n1 - 1) / 2) / (n1 * n0)
print(f"amostras {len(y)} · AUC da nota {auc(y, score):.4f}")
for j, nm in enumerate(["matchup", "sinergia", "comp", "meta"]):
    print(f"  AUC só {nm}: {auc(y, X[:, j]):.4f}")
tier = np.digitize(rank, [.08, .25, .55, .8])
for k, t in enumerate("SABCD"):
    print(f"  tier {t}: winrate {y[tier == k].mean() * 100:.1f}% ({(tier == k).sum()} escolhas)")
Xb = np.c_[np.ones(len(X)), X]; w = np.zeros(5)
for _ in range(3000):
    p = 1 / (1 + np.exp(-Xb @ w)); w -= 0.5 * (Xb.T @ (p - y) / len(y))
print("pesos sugeridos (relativos ao matchup):", (w[1:] / w[1]).round(2).tolist())
