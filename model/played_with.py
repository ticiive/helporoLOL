"""Você já jogou com (ou contra) um jogador nesta temporada? Cruza as listas de partidas das duas contas.

Uso: RIOT_API_KEY=... python model/played_with.py "ticiive#lett" "n entrosa lerdão#cold" out/busca.json
"""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error

KEY = os.environ["RIOT_API_KEY"]
REG = "https://americas.api.riotgames.com"
SEASON = 1767830400  # 08/01/2026, início da temporada 2026
QUEUE = {420: "Ranqueada solo/duo", 440: "Ranqueada flex", 400: "Normal", 430: "Normal", 450: "ARAM", 490: "Normal (rápida)", 1700: "Arena", 1900: "URF"}
ROLE = {"TOP": "top", "JUNGLE": "jungle", "MIDDLE": "mid", "BOTTOM": "ADC", "UTILITY": "sup"}


def get(url):
    for _ in range(8):
        req = urllib.request.Request(url, headers={"X-Riot-Token": KEY, "User-Agent": "helporoLOL-busca"})
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


def puuid(riot_id):
    name, tag = riot_id.rsplit("#", 1)
    acc = get(f"{REG}/riot/account/v1/accounts/by-riot-id/{urllib.parse.quote(name.strip())}/{urllib.parse.quote(tag.strip())}")
    return acc["puuid"] if acc else None


def match_ids(p):
    out, start = [], 0
    while True:
        page = get(f"{REG}/lol/match/v5/matches/by-puuid/{p}/ids?startTime={SEASON}&start={start}&count=100") or []
        out += page
        if len(page) < 100:
            return out
        start += 100


def main():
    me_id, other_id, path = sys.argv[1], sys.argv[2], sys.argv[3]
    res = {"at": int(time.time() * 1000), "me": me_id, "other": other_id, "games": []}
    a, b = puuid(me_id), puuid(other_id)
    if not a or not b:
        res["error"] = f"Conta não encontrada: {other_id if a else me_id}"
    else:
        ma, mb = match_ids(a), match_ids(b)
        res["mine"], res["theirs"] = len(ma), len(mb)
        for mid in sorted(set(ma) & set(mb), reverse=True):
            m = get(f"{REG}/lol/match/v5/matches/{mid}")
            if not m:
                continue
            info = m["info"]
            pa = next(p for p in info["participants"] if p["puuid"] == a)
            pb = next(p for p in info["participants"] if p["puuid"] == b)
            res["games"].append({
                "id": mid, "t": info.get("gameCreation"), "queue": QUEUE.get(info.get("queueId"), f"fila {info.get('queueId')}"),
                "sameTeam": pa["teamId"] == pb["teamId"], "win": bool(pa.get("win")),
                "me": {"champ": pa["championName"], "role": ROLE.get(pa.get("teamPosition") or "", ""), "kda": f"{pa['kills']}/{pa['deaths']}/{pa['assists']}"},
                "them": {"champ": pb["championName"], "role": ROLE.get(pb.get("teamPosition") or "", ""), "kda": f"{pb['kills']}/{pb['deaths']}/{pb['assists']}"},
            })
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as fh:
        json.dump(res, fh, ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in res.items() if k != "games"}, ensure_ascii=False), len(res["games"]), "partidas juntos")


if __name__ == "__main__":
    main()
