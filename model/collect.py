"""
Coletor de partidas ranqueadas Mestre+ (e Diamante 1) do BR pela API oficial da Riot.

Retomável: guarda o que já baixou em model/data/ e continua de onde parou.
Respeita o limite da chave: começa em 20 req/s e 100 req/2 min (dev e pessoal) e passa a usar
o limite que a Riot informa em cada resposta (X-App-Rate-Limit), então uma chave maior coleta mais rápido.

Uso:
  RIOT_API_KEY=... python model/collect.py --hours 5
"""
import argparse, gzip, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

DATA = Path(__file__).parent / "data"
PLATFORM = "https://br1.api.riotgames.com"
REGION = "https://americas.api.riotgames.com"
QUEUE = 420  # ranqueada solo/duo
SEASON_START = 1767225600  # 01/01/2026, início da temporada 2026 (epoch, segundos)


class Riot:
    """Cliente simples com limite de taxa e retentativa em 429/5xx."""

    def __init__(self, key: str):
        self.key = key
        self.window = []  # horários das requisições recentes
        # limites da aplicação [(requisições, segundos)]; começa no da chave dev/pessoal e
        # se ajusta ao que a Riot manda no cabeçalho X-App-Rate-Limit (chave de produção é maior)
        self.limits = [(20, 1), (100, 120)]
        self.dead = False  # vira True quando a chave vence

    def _wait(self):
        span = max(w for _, w in self.limits)
        while True:
            now = time.time()
            self.window = [t for t in self.window if now - t < span]
            sleep = 0.0
            for n, w in self.limits:
                recent = [t for t in self.window if now - t < w]
                cap = max(1, int(n * 0.95))  # margem de 5%
                if len(recent) >= cap:
                    sleep = max(sleep, w - (now - recent[-cap]) + 0.05)
            if sleep <= 0:
                break
            time.sleep(sleep)
        self.window.append(time.time())

    def _learn(self, headers):
        h = headers.get("X-App-Rate-Limit") if headers else None
        if not h:
            return
        try:
            lim = [(int(a), int(b)) for a, b in (x.split(":") for x in h.split(","))]
        except ValueError:
            return
        if lim and lim != self.limits:
            print(f"limite da chave: {h}", flush=True)
            self.limits = lim

    def get(self, url: str, params: dict | None = None):
        if params:
            url += "?" + urllib.parse.urlencode(params)
        if self.dead:
            return None
        for attempt in range(6):
            self._wait()
            req = urllib.request.Request(url, headers={"X-Riot-Token": self.key, "User-Agent": "helporoLOL-model"})
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    self._learn(r.headers)
                    return json.loads(r.read())
            except urllib.error.HTTPError as e:
                self._learn(e.headers)
                if e.code == 429:
                    time.sleep(int(e.headers.get("Retry-After", "10")) + 1)
                    continue
                if e.code in (500, 502, 503, 504):
                    time.sleep(2 * (attempt + 1))
                    continue
                if e.code in (401, 403):
                    # chave venceu: para a coleta, mas salva o que juntou e deixa o treino rodar
                    if not self.dead:
                        print("Chave da Riot inválida ou expirada (a dev dura 24h). Parando a coleta; o treino roda com o que já tem.", flush=True)
                    self.dead = True
                    return None
                if e.code == 404:
                    return None
                raise
            except (urllib.error.URLError, TimeoutError):
                time.sleep(3 * (attempt + 1))
        return None


def load_json(p: Path, default):
    return json.loads(p.read_text()) if p.exists() else default


def save_json(p: Path, obj):
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj))
    tmp.replace(p)


def ladder(riot: Riot, with_d1: bool) -> dict:
    """puuid -> {tier, lp} dos jogadores Mestre+, e Diamante 1 se pedido."""
    players = {}
    for tier, path in [("CHALLENGER", "challengerleagues"), ("GRANDMASTER", "grandmasterleagues"), ("MASTER", "masterleagues")]:
        data = riot.get(f"{PLATFORM}/lol/league/v4/{path}/by-queue/RANKED_SOLO_5x5") or {}
        for e in data.get("entries", []):
            if e.get("puuid"):
                players[e["puuid"]] = {"tier": tier, "lp": e.get("leaguePoints", 0)}
    if with_d1:
        page = 1
        while True:
            rows = riot.get(f"{PLATFORM}/lol/league/v4/entries/RANKED_SOLO_5x5/DIAMOND/I", {"page": page}) or []
            if not rows:
                break
            for e in rows:
                if e.get("puuid"):
                    players.setdefault(e["puuid"], {"tier": "DIAMOND1", "lp": e.get("leaguePoints", 0)})
            page += 1
    return players


def compact(m: dict) -> dict | None:
    """Guarda só o que o modelo usa: campeão, rota, time, vitória e jogador."""
    info = m.get("info", {})
    if info.get("queueId") != QUEUE or info.get("gameDuration", 0) < 300:  # ignora remake
        return None
    teams = {100: [], 200: []}
    win = {}
    for p in info.get("participants", []):
        pos = p.get("teamPosition") or ""
        if not pos:
            return None
        perks = p.get("perks", {})
        styles = perks.get("styles", [])
        teams[p["teamId"]].append({
            "r": pos, "c": p["championName"], "p": p["puuid"], "id": p.get("participantId", 0),
            # estatísticas finais: base da revisão pós-jogo (comparar com a média Mestre+ do campeão)
            "s": {"k": p.get("kills", 0), "d": p.get("deaths", 0), "a": p.get("assists", 0),
                  "cs": p.get("totalMinionsKilled", 0) + p.get("neutralMinionsKilled", 0),
                  "vs": p.get("visionScore", 0), "w": p.get("wardsPlaced", 0), "cw": p.get("detectorWardsPlaced", 0),
                  "dmg": p.get("totalDamageDealtToChampions", 0), "tk": p.get("totalDamageTaken", 0),
                  "hs": p.get("totalHealsOnTeammates", 0) + p.get("totalDamageShieldedOnTeammates", 0),
                  "cc": p.get("timeCCingOthers", 0), "g": p.get("goldEarned", 0)},
            # itens finais, feitiços e runas: base das builds, runas e situacionais
            "it": [p.get(f"item{i}", 0) for i in range(7)],
            "sp": [p.get("summoner1Id", 0), p.get("summoner2Id", 0)],
            "ru": {
                "p": styles[0]["style"] if styles else 0,
                "s": styles[1]["style"] if len(styles) > 1 else 0,
                "k": [sel["perk"] for st in styles for sel in st.get("selections", [])],
                "f": [perks.get("statPerks", {}).get(x, 0) for x in ("offense", "flex", "defense")],
            },
        })
        win[p["teamId"]] = bool(p.get("win"))
    if len(teams[100]) != 5 or len(teams[200]) != 5:
        return None
    return {
        "id": m["metadata"]["matchId"],
        "v": ".".join(info.get("gameVersion", "0.0").split(".")[:2]),
        "t": info.get("gameStartTimestamp", 0),
        "d": info.get("gameDuration", 0),
        "teams": [{"win": win[100], "picks": teams[100]}, {"win": win[200], "picks": teams[200]}],
    }


MODEL_SUPS = {"Soraka", "Sona", "Nami", "Janna", "Lulu", "Milio"}
GOLD_AT = (10, 15)  # minutos em que guarda ouro, CS e XP de cada jogador (timeline)


def has_model_sup(row: dict) -> bool:
    return any(p["r"] == "UTILITY" and p["c"] in MODEL_SUPS for t in row["teams"] for p in t["picks"])


def lane_gold(tl: dict, mid: str) -> dict | None:
    """Ouro, CS e XP de cada participante aos 10 e 15 minutos: o quanto a lane rendeu, com bem menos ruído que a vitória."""
    frames = (tl or {}).get("info", {}).get("frames", [])
    if len(frames) <= max(GOLD_AT):
        return None
    g = {}
    for minute in GOLD_AT:
        for pid, pf in frames[minute].get("participantFrames", {}).items():
            g.setdefault(pid, []).extend([pf.get("totalGold", 0), pf.get("minionsKilled", 0) + pf.get("jungleMinionsKilled", 0), pf.get("xp", 0)])
    return {"id": mid, "g": g}  # g[pid] = [ouro10, cs10, xp10, ouro15, cs15, xp15]


def sup_mains(mf: Path, min_games: int = 5) -> set:
    """puuids com pelo menos min_games jogos de sup com um dos sups do modelo nas partidas já baixadas."""
    cnt = {}
    if mf.exists():
        with gzip.open(mf, "rt") as f:
            for line in f:
                for t in json.loads(line)["teams"]:
                    for p in t["picks"]:
                        if p["r"] == "UTILITY" and p["c"] in MODEL_SUPS:
                            cnt[p["p"]] = cnt.get(p["p"], 0) + 1
    return {p for p, n in cnt.items() if n >= min_games}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=float, default=5.0, help="tempo máximo desta rodada")
    ap.add_argument("--d1", action="store_true", help="incluir Diamante 1")
    ap.add_argument("--ids-per-player", type=int, default=100)
    args = ap.parse_args()
    key = os.environ.get("RIOT_API_KEY", "").strip()
    if not key:
        sys.exit("Defina RIOT_API_KEY.")
    riot = Riot(key)
    deadline = time.time() + args.hours * 3600
    # STOP_AT (ISO, UTC): horário em que a chave vence; a coleta nunca passa dele
    stop_at = os.environ.get("STOP_AT", "").strip()
    if stop_at:
        import datetime
        stop = datetime.datetime.fromisoformat(stop_at.replace("Z", "+00:00")).timestamp()
        if time.time() >= stop:
            print(f"Passou de STOP_AT ({stop_at}): sem coleta nesta rodada.", flush=True)
            return
        deadline = min(deadline, stop)
    DATA.mkdir(parents=True, exist_ok=True)

    # 1) ladder (renova a cada rodada: elo muda)
    players = ladder(riot, args.d1)
    if not players:  # chave vencida ou API fora: mantém o ladder da rodada anterior
        players = load_json(DATA / "players.json", {})
    else:
        save_json(DATA / "players.json", players)
    print(f"jogadores no ladder: {len(players)}", flush=True)

    # 2) ids de partidas, jogador por jogador; guarda quem já foi visitado
    state = load_json(DATA / "state.json", {"visited": {}, "queue": []})
    queue = set(state["queue"])
    seen = set()
    mf = DATA / "matches.jsonl.gz"
    if mf.exists():
        with gzip.open(mf, "rt") as f:
            for line in f:
                seen.add(json.loads(line)["id"])
    queue -= seen
    # jogadores que mais jogam os sups do modelo vêm primeiro, e as partidas deles também:
    # é o que mais aumenta a amostra de Soraka, Sona, Nami...
    mains = sup_mains(mf)
    prio = set(state.get("prio", [])) - seen
    print(f"mains dos sups do modelo: {len(mains)}", flush=True)
    order = sorted(players, key=lambda p: (p not in mains, state["visited"].get(p, 0)))
    for i, puuid in enumerate(order):
        is_main = puuid in mains
        if riot.dead or time.time() > deadline - 600 or (len(queue) > 20000 and not is_main):
            break
        ids = riot.get(f"{REGION}/lol/match/v5/matches/by-puuid/{puuid}/ids",
                       {"queue": QUEUE, "type": "ranked", "start": 0, "count": args.ids_per_player, "startTime": SEASON_START}) or []
        new_ids = [x for x in ids if x not in seen]
        queue.update(new_ids)
        if is_main:
            prio.update(new_ids)
        state["visited"][puuid] = int(time.time())
        if i % 50 == 0:
            state["queue"] = sorted(queue); state["prio"] = sorted(prio & queue)
            save_json(DATA / "state.json", state)
            print(f"jogadores visitados {i}/{len(order)} · partidas na fila {len(queue)}", flush=True)
    state["queue"] = sorted(queue)
    save_json(DATA / "state.json", state)

    # 3) baixa as partidas da fila até acabar o tempo; nas que têm um sup do modelo, baixa também a timeline
    gf = DATA / "gold.jsonl.gz"
    have_gold = set()
    if gf.exists():
        with gzip.open(gf, "rt") as f:
            for line in f:
                have_gold.add(json.loads(line)["id"])
    todo = []
    if mf.exists():
        with gzip.open(mf, "rt") as f:
            for line in f:
                r = json.loads(line)
                if r["id"] not in have_gold and has_model_sup(r):
                    todo.append((r["t"], r["id"]))
    # enquanto houver timeline antiga pendente, 30% da rodada fica pra ela
    stop3 = deadline - (0.3 * args.hours * 3600 if todo else 0)
    print(f"timelines antigas pendentes: {len(todo)}", flush=True)
    got = 0
    gold_out = gzip.open(gf, "at")
    with gzip.open(mf, "at") as out:
        # partidas dos mains primeiro; dentro de cada grupo, as mais recentes
        for mid in sorted(queue, key=lambda x: (x not in prio, -int(x.rsplit("_", 1)[-1]) if x.rsplit("_", 1)[-1].isdigit() else 0)):
            if riot.dead or time.time() > stop3:
                break
            m = riot.get(f"{REGION}/lol/match/v5/matches/{mid}")
            queue.discard(mid); prio.discard(mid)
            row = compact(m) if m else None
            if row:
                out.write(json.dumps(row) + "\n")
                got += 1
                if has_model_sup(row) and not riot.dead:
                    lg = lane_gold(riot.get(f"{REGION}/lol/match/v5/matches/{mid}/timeline"), mid)
                    if lg:
                        gold_out.write(json.dumps(lg) + "\n"); have_gold.add(mid)
            if got and got % 200 == 0:
                out.flush(); gold_out.flush()
                state["queue"] = sorted(queue)
                save_json(DATA / "state.json", state)
                print(f"partidas novas: {got} · na fila: {len(queue)}", flush=True)
    # 4) sobrou tempo: timeline das partidas antigas com sup do modelo (mais recentes primeiro)
    if not riot.dead and time.time() < deadline and todo:
        filled = 0
        for _, mid in sorted(todo, reverse=True):
            if mid in have_gold:
                continue
            if riot.dead or time.time() > deadline:
                break
            lg = lane_gold(riot.get(f"{REGION}/lol/match/v5/matches/{mid}/timeline"), mid)
            if lg:
                gold_out.write(json.dumps(lg) + "\n"); have_gold.add(mid); filled += 1
                if filled % 200 == 0:
                    gold_out.flush(); print(f"timelines antigas: {filled}/{len(todo)}", flush=True)
    gold_out.close()
    print(f"partidas com ouro aos 10/15: {len(have_gold)}", flush=True)
    state["queue"] = sorted(queue); state["prio"] = sorted(prio & queue)
    save_json(DATA / "state.json", state)
    print(f"fim da rodada: {got} partidas novas, {len(seen) + got} no total, {len(queue)} na fila", flush=True)


if __name__ == "__main__":
    main()
