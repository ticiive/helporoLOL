"""Suas últimas ranqueadas pela API da Riot, no formato da API local do cliente (o que a revisão já lê).
Sem nome dos outros jogadores. Uso: RIOT_API_KEY=... python model/my_matches.py ticiive lett out/me 20"""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error

KEY = os.environ["RIOT_API_KEY"]
REG = "https://americas.api.riotgames.com"
RANKED = {420, 440}


def get(url, tries=6):
    for _ in range(tries):
        req = urllib.request.Request(url, headers={"X-Riot-Token": KEY})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                wait = int(e.headers.get("Retry-After") or 10) + 1
                print(f"  {e.code}, esperando {wait}s", flush=True)
                time.sleep(wait)
                continue
            if e.code == 404:
                return None
            raise
    raise RuntimeError(f"falhou: {url}")


POS = {"TOP": ("TOP", "SOLO"), "JUNGLE": ("JUNGLE", "NONE"), "MIDDLE": ("MIDDLE", "SOLO"),
       "BOTTOM": ("BOTTOM", "DUO_CARRY"), "UTILITY": ("BOTTOM", "DUO_SUPPORT")}
SKIP = {"participantId", "championId", "teamId", "summoner1Id", "summoner2Id", "profileIcon", "summonerLevel"}


def convert_game(m, puuid):
    info = m["info"]
    parts, ids = [], []
    for p in info["participants"]:
        pid = p["participantId"]
        stats = {k: v for k, v in p.items() if isinstance(v, (int, float, bool)) and k not in SKIP}
        ch = p.get("challenges") or {}
        if "effectiveHealAndShielding" in ch:
            stats["effectiveHealAndShielding"] = ch["effectiveHealAndShielding"]
        stats["win"] = bool(p.get("win"))
        lane, role = POS.get(p.get("teamPosition") or p.get("individualPosition") or "", ("NONE", "NONE"))
        parts.append({"participantId": pid, "championId": p["championId"], "teamId": p["teamId"],
                      "spell1Id": p.get("summoner1Id"), "spell2Id": p.get("summoner2Id"),
                      "timeline": {"lane": lane, "role": role}, "stats": stats})
        mine = p.get("puuid") == puuid
        ids.append({"participantId": pid, "player": {"gameName": p.get("riotIdGameName", "") if mine else f"p{pid}"}})
    dur = info.get("gameDuration", 0)
    if dur > 100000:
        dur //= 1000
    return {"gameId": info["gameId"], "gameCreation": info.get("gameCreation"), "gameDuration": dur,
            "queueId": info.get("queueId"), "participants": parts, "participantIdentities": ids}


KEEP = {"CHAMPION_KILL", "ELITE_MONSTER_KILL", "BUILDING_KILL"}
DROP = {"victimDamageDealt", "victimDamageReceived", "shutdownBounty", "bounty", "realTimestamp"}


def convert_timeline(t, me_pid):
    frames = []
    for f in t["info"]["frames"]:
        pf = {k: {"position": v.get("position", {"x": 0, "y": 0}), "totalGold": v.get("totalGold"), "level": v.get("level")}
              for k, v in f.get("participantFrames", {}).items()}
        ev = []
        for e in f.get("events", []):
            ty = e.get("type")
            if ty in KEEP or (ty == "WARD_PLACED" and e.get("creatorId") == me_pid) or (ty == "WARD_KILL" and e.get("killerId") == me_pid):
                ev.append({k: v for k, v in e.items() if k not in DROP})
        frames.append({"timestamp": f.get("timestamp"), "participantFrames": pf, "events": ev})
    return {"frames": frames}


ROLE = {"TOP": "top", "JUNGLE": "jg", "MIDDLE": "mid", "BOTTOM": "adc", "UTILITY": "sup"}


def main():
    name, tag, out = sys.argv[1], sys.argv[2], sys.argv[3]
    n = int(sys.argv[4]) if len(sys.argv) > 4 else 20
    os.makedirs(out, exist_ok=True)
    acc = get(f"{REG}/riot/account/v1/accounts/by-riot-id/{urllib.parse.quote(name)}/{urllib.parse.quote(tag)}")
    puuid = acc["puuid"]
    ids = get(f"{REG}/lol/match/v5/matches/by-puuid/{puuid}/ids?type=ranked&start=0&count={n}") or []
    idx_path = os.path.join(out, "index.json")
    old = {}
    if os.path.exists(idx_path):
        old = {str(g["id"]): g for g in json.load(open(idx_path)).get("games", [])}
    games = []
    for mid in ids:
        gid = mid.split("_")[-1]
        fpath = os.path.join(out, f"{gid}.json")
        if gid in old and os.path.exists(fpath):
            games.append(old[gid])
            continue
        m = get(f"{REG}/lol/match/v5/matches/{mid}")
        t = get(f"{REG}/lol/match/v5/matches/{mid}/timeline")
        if not m or not t or m["info"].get("queueId") not in RANKED:
            continue
        game = convert_game(m, puuid)
        me = next(p for p in m["info"]["participants"] if p.get("puuid") == puuid)
        with open(fpath, "w") as fh:
            json.dump({"game": game, "timeline": convert_timeline(t, me["participantId"])}, fh, separators=(",", ":"))
        games.append({"id": int(gid), "t": game["gameCreation"], "championId": me["championId"],
                      "role": ROLE.get(me.get("teamPosition") or ""), "win": bool(me.get("win")), "min": game["gameDuration"] / 60,
                      "s": {"k": me["kills"], "d": me["deaths"], "a": me["assists"],
                            "cs": me["totalMinionsKilled"] + me["neutralMinionsKilled"], "vs": me["visionScore"],
                            "cw": me.get("visionWardsBoughtInGame", 0), "dmg": me["totalDamageDealtToChampions"]}})
        print(f"  {gid} ok", flush=True)
    with open(idx_path, "w") as fh:
        json.dump({"at": int(time.time() * 1000), "account": f"{name}#{tag}", "games": games}, fh, separators=(",", ":"))
    keep = {f"{g['id']}.json" for g in games} | {"index.json"}
    for f in os.listdir(out):
        if f not in keep:
            os.remove(os.path.join(out, f))
    print(f"{len(games)} partidas")


if __name__ == "__main__":
    main()
