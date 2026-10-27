"""Wards de um jogador numa partida (tipo e minuto), pra achar no vídeo. Uso: python model/wards.py out.json BR1_123 "nome#tag" ..."""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error
KEY = os.environ["RIOT_API_KEY"]; REG = "https://americas.api.riotgames.com"
def get(url):
    for _ in range(8):
        req = urllib.request.Request(url, headers={"X-Riot-Token": KEY, "User-Agent": "helporoLOL-wards"})
        try:
            with urllib.request.urlopen(req, timeout=25) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500: time.sleep(int(e.headers.get("Retry-After") or 5) + 1); continue
            raise
out = {}
outp, args = sys.argv[1], sys.argv[2:]
for i in range(0, len(args), 2):
    mid, rid = args[i], args[i + 1]
    name, tag = rid.rsplit("#", 1)
    p = get(f"{REG}/riot/account/v1/accounts/by-riot-id/{urllib.parse.quote(name)}/{urllib.parse.quote(tag)}")["puuid"]
    m = get(f"{REG}/lol/match/v5/matches/{mid}"); t = get(f"{REG}/lol/match/v5/matches/{mid}/timeline")
    me = next(x for x in m["info"]["participants"] if x["puuid"] == p); pid = me["participantId"]
    champs = {x["participantId"]: (x["championName"], x["teamId"], x.get("teamPosition")) for x in m["info"]["participants"]}
    ev = []
    for f in t["info"]["frames"]:
        for e in f.get("events", []):
            if e["type"] == "WARD_PLACED" and e.get("creatorId") == pid: ev.append(["ward", e["timestamp"] // 1000, e.get("wardType")])
            elif e["type"] == "WARD_KILL" and e.get("killerId") == pid: ev.append(["limpou", e["timestamp"] // 1000, e.get("wardType")])
            elif e["type"] == "ITEM_PURCHASED" and e.get("participantId") == pid: ev.append(["comprou", e["timestamp"] // 1000, e.get("itemId")])
            elif e["type"] == "ITEM_UNDO" and e.get("participantId") == pid: ev.append(["desfez", e["timestamp"] // 1000, e.get("beforeId")])
    out[mid] = {"who": rid, "team": me["teamId"], "champ": me["championName"], "champs": champs,
                "stats": {k: me.get(k) for k in ("wardsPlaced", "wardsKilled", "visionWardsBoughtInGame", "visionScore", "detectorWardsPlaced")},
                "events": ev}
json.dump(out, open(outp, "w"), ensure_ascii=False, indent=0)
print(json.dumps({k: v["stats"] for k, v in out.items()}))
