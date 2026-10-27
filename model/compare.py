"""Compara o seu jogo de sup com o de outro jogador, partida a partida (API da Riot: estatísticas + timeline).

Uso: RIOT_API_KEY=... python model/compare.py "ticiive#lett" "misa#sona" out/compara.json 40
Métricas por partida (só as de solo/duo jogando de sup), depois a média de cada uma pros dois.
"""
import json, math, os, statistics, sys, time, urllib.parse, urllib.request, urllib.error

KEY = os.environ["RIOT_API_KEY"]
REG = "https://americas.api.riotgames.com"


def get(url):
    for _ in range(8):
        req = urllib.request.Request(url, headers={"X-Riot-Token": KEY, "User-Agent": "helporoLOL-compara"})
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                time.sleep(int(e.headers.get("Retry-After") or 5) + 1)
                continue
            if e.code == 404:
                return None
            raise
    raise RuntimeError(url)


def puuid(rid):
    name, tag = rid.rsplit("#", 1)
    a = get(f"{REG}/riot/account/v1/accounts/by-riot-id/{urllib.parse.quote(name)}/{urllib.parse.quote(tag)}")
    return a["puuid"] if a else None


def dist(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def bot_lane(p, blue):
    # faixa do bot (do lado de baixo/direita do mapa) incluindo o rio bot e tribush
    return p["x"] - p["y"] > 4500


def game_metrics(m, t, me_puuid):
    info = m["info"]
    P = info["participants"]
    me = next(p for p in P if p["puuid"] == me_puuid)
    if me.get("teamPosition") != "UTILITY":
        return None
    mins = info["gameDuration"] / 60
    mid, team = me["participantId"], me["teamId"]
    adc = next((p for p in P if p["teamId"] == team and p.get("teamPosition") == "BOTTOM"), None)
    opp_sup = next((p for p in P if p["teamId"] != team and p.get("teamPosition") == "UTILITY"), None)
    opp_adc = next((p for p in P if p["teamId"] != team and p.get("teamPosition") == "BOTTOM"), None)
    ch = me.get("challenges") or {}
    team_k = sum(p["kills"] for p in P if p["teamId"] == team) or 1
    frames = t["info"]["frames"]

    def pf(i, pid):
        return frames[min(i, len(frames) - 1)]["participantFrames"][str(pid)]

    # ouro/nível/xp da dupla do bot aos 10 e 15
    def duo_gold(i, ps):
        return sum(pf(i, p["participantId"])["totalGold"] for p in ps if p)
    g15 = duo_gold(15, [me, adc]) - duo_gold(15, [opp_sup, opp_adc]) if len(frames) > 15 and adc and opp_adc and opp_sup else None
    lv10 = pf(10, mid)["level"] - pf(10, opp_sup["participantId"])["level"] if opp_sup and len(frames) > 10 else None
    # tempo longe do bot entre 3 e 14 min (roam) e distância média do ADC depois dos 14
    away = sum(1 for i in range(3, min(14, len(frames))) if not bot_lane(pf(i, mid)["position"], team == 100))
    near_adc = [dist(pf(i, mid)["position"], pf(i, adc["participantId"])["position"]) for i in range(15, len(frames))] if adc else []
    # eventos
    kills, objs, wards = [], [], []
    for f in frames:
        for e in f.get("events", []):
            if e["type"] == "CHAMPION_KILL":
                kills.append(e)
            elif e["type"] == "ELITE_MONSTER_KILL":
                objs.append(e)
            elif e["type"] == "WARD_PLACED" and e.get("creatorId") == mid:
                wards.append(e["timestamp"] / 1000)
    my_deaths = [k for k in kills if k["victimId"] == mid]
    early_deaths = sum(1 for k in my_deaths if k["timestamp"] < 14 * 60000)
    # lutas (3+ abates com até 15 s de intervalo): primeira morte foi sua? você estava viva no fim?
    ks = sorted(kills, key=lambda k: k["timestamp"])
    fights, first_me, died_in = 0, 0, 0
    i = 0
    while i < len(ks):
        j = i
        while j + 1 < len(ks) and ks[j + 1]["timestamp"] - ks[j]["timestamp"] <= 15000:
            j += 1
        grp = ks[i:j + 1]
        if len(grp) >= 3:
            involved = any(k["victimId"] == mid or k["killerId"] == mid or mid in k.get("assistingParticipantIds", []) for k in grp)
            if involved:
                fights += 1
                first_me += grp[0]["victimId"] == mid
                died_in += any(k["victimId"] == mid for k in grp)
        i = j + 1
    # presença em objetivo: perto (2500) do lugar no minuto do abate do dragão/barão/arauto/vastilarvas
    pres = []
    for o in objs:
        if o.get("killerTeamId") != team or "position" not in o:
            continue
        i = int(o["timestamp"] / 60000)
        pres.append(dist(pf(i, mid)["position"], o["position"]) < 3000)
    # wards nos 90 s antes de cada objetivo (de qualquer time)
    setup = [sum(1 for w in wards if 0 <= o["timestamp"] / 1000 - w <= 90) for o in objs]
    hs = ch.get("effectiveHealAndShielding")
    return {
        "id": m["metadata"]["matchId"], "champ": me["championName"], "win": me["win"], "min": round(mins, 1),
        "kda": (me["kills"] + me["assists"]) / max(1, me["deaths"]), "d10": 10 * me["deaths"] / mins,
        "earlyDeaths": early_deaths, "deadPct": me.get("totalTimeSpentDead", 0) / (mins * 60),
        "kp": (me["kills"] + me["assists"]) / team_k, "vs": me["visionScore"] / mins,
        "cw10": 10 * me.get("visionWardsBoughtInGame", 0) / mins, "wardsKilled10": 10 * me.get("wardsKilled", 0) / mins,
        "dmg": me["totalDamageDealtToChampions"] / mins, "hs": hs / mins if hs is not None else None,
        "ccTime": me.get("timeCCingOthers", 0) / mins, "taken": me["totalDamageTaken"] / mins,
        "duoGold15": g15, "lvl10": lv10, "roamMin": away, "adcDist": statistics.mean(near_adc) if near_adc else None,
        "fights": fights, "firstDeathPct": first_me / fights if fights else None, "diedInFightPct": died_in / fights if fights else None,
        "objPresence": sum(pres) / len(pres) if pres else None, "objSetupWards": statistics.mean(setup) if setup else None,
        "spells": [me.get(f"spell{i}Casts", 0) / mins for i in range(1, 5)],
        "ultPerMin": me.get("spell4Casts", 0) / mins, "items": [me.get(f"item{i}") for i in range(6)],
        "summs": [me.get("summoner1Id"), me.get("summoner2Id")],
        "soloKills": ch.get("soloKills"), "saveAlly": ch.get("saveAllyFromDeath"), "pickKill": ch.get("pickKillWithAlly"),
        "stealthWards": ch.get("stealthWardsPlaced"), "controlWardTime": ch.get("controlWardTimeCoverageInRiverOrEnemyHalf"),
        "laneMinionsFirst10": ch.get("laneMinionsFirst10Minutes"), "maxLevelLead": ch.get("maxLevelLeadLaneOpponent"),
        "enemyJungleWards": ch.get("wardTakedownsBefore20M"), "immobilize": ch.get("enemyChampionImmobilizations"),
    }


def player(rid, n):
    p = puuid(rid)
    ids = get(f"{REG}/lol/match/v5/matches/by-puuid/{p}/ids?queue=420&start=0&count=100") or []
    out = []
    for mid in ids:
        if len(out) >= n:
            break
        m = get(f"{REG}/lol/match/v5/matches/{mid}")
        if not m or m["info"]["gameDuration"] < 15 * 60:
            continue
        me = next(x for x in m["info"]["participants"] if x["puuid"] == p)
        if me.get("teamPosition") != "UTILITY":
            continue
        t = get(f"{REG}/lol/match/v5/matches/{mid}/timeline")
        if not t:
            continue
        g = game_metrics(m, t, p)
        if g:
            out.append(g)
    return out


def avg(games):
    keys = [k for k, v in games[0].items() if isinstance(v, (int, float)) and not isinstance(v, bool)] if games else []
    res = {"n": len(games), "wr": sum(g["win"] for g in games) / len(games) if games else None}
    for k in keys:
        vals = [g[k] for g in games if g.get(k) is not None]
        if vals:
            res[k] = round(statistics.mean(vals), 3)
    champs = {}
    for g in games:
        c = champs.setdefault(g["champ"], [0, 0])
        c[0] += 1
        c[1] += g["win"]
    res["champs"] = dict(sorted(champs.items(), key=lambda kv: -kv[1][0]))
    res["ultPerMin"] = round(statistics.mean(g["ultPerMin"] for g in games), 3) if games else None
    return res


def main():
    a, b, path = sys.argv[1], sys.argv[2], sys.argv[3]
    n = int(sys.argv[4]) if len(sys.argv) > 4 else 40
    ga, gb = player(a, n), player(b, n)
    res = {"at": int(time.time() * 1000), "a": a, "b": b, "avgA": avg(ga), "avgB": avg(gb), "gamesA": ga, "gamesB": gb}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(res, fh, ensure_ascii=False, indent=1)
    print(json.dumps({"A": res["avgA"], "B": res["avgB"]}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
