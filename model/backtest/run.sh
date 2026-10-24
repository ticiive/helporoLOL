#!/usr/bin/env bash
# Backtest da recomendação de sup: calcula lane e scaling só com os primeiros 80% das partidas
# e testa a nota do draft nas 20% mais recentes (que o cálculo não viu).
# Uso: bash model/backtest/run.sh   (precisa de model/data/matches.jsonl.gz; roda da raiz do repo)
set -e
OUT=model/backtest/out; mkdir -p "$OUT"
CUT=$(python3 -c "
import gzip,json; ts=sorted(json.loads(l)['t'] for l in gzip.open('model/data/matches.jsonl.gz','rt')); print(ts[int(len(ts)*.8)])")
(cd model && HELPORO_OUT=backtest/out HELPORO_UNTIL=$CUT python3 lane.py && HELPORO_OUT=backtest/out HELPORO_UNTIL=$CUT python3 scaling.py)
python3 model/backtest/prep.py "$CUT" "$OUT/test.json"
npx -y tsx@4.19.2 model/backtest/score_picks.ts "$OUT"
python3 model/backtest/report.py "$OUT/bt_rows.json"
