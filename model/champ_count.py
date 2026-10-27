"""Quantas partidas de solo/duo você jogou com cada campeão desde uma data (pra conferir rankings de sites).

Uso: RIOT_API_KEY=... python model/champ_count.py "ticiive#lett" 2026-09-24 out/conta.json
"""
import collections, datetime, json, os, sys, time, urllib.parse, urllib.request, urllib.error

KEY = os.environ["RIOT_API_KEY"]
REG = "https://americas.api.riotgames.com"


def get(url):
    for _ in range(8):
        req = urllib.request.Request(url, headers={"X-Riot-Token": KEY, "User-Agent": "helporoLOL-conta"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                time.sleep(int(e.headers.get("Retry-After") or 5) + 1)
                continue
            if e.code == 404:
                return None
            raise
    raise RuntimeError(url)


def main():
    rid, since, path = sys.argv[1], sys.argv[2], sys.argv[3]
    name, tag = rid.rsplit("#", 1)
    p = get(f"{REG}/riot/account/v1/accounts/by-riot-id/{urllib.parse.quote(name)}/{urllib.parse.quote(tag)}")["puuid"]
    t0 = int(datetime.datetime.fromisoformat(since).replace(tzinfo=datetime.timezone.utc).timestamp())
    ids, start = [], 0
    while True:
        page = get(f"{REG}/lol/match/v5/matches/by-puuid/{p}/ids?queue=420&startTime={t0}&start={start}&count=100") or []
        ids += page
        if len(page) < 100:
            break
        start += 100
    games = []
    for mid in ids:
        m = get(f"{REG}/lol/match/v5/matches/{mid}")
        if not m:
            continue
        me = next(x for x in m["info"]["participants"] if x["puuid"] == p)
        games.append({"t": m["info"]["gameCreation"], "patch": ".".join(m["info"]["gameVersion"].split(".")[:2]),
                      "champ": me["championName"], "win": bool(me["win"]), "min": round(m["info"]["gameDuration"] / 60, 1)})
    by = collections.defaultdict(lambda: collections.Counter())
    for g in games:
        by[g["patch"]][g["champ"]] += 1
    res = {"since": since, "total": len(games), "byPatch": {k: dict(v.most_common()) for k, v in sorted(by.items())}, "games": games}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(res, fh, ensure_ascii=False, indent=1)
    print(json.dumps(res["byPatch"], ensure_ascii=False))


if __name__ == "__main__":
    main()
