"""
Coletor de partidas ranqueadas Mestre+ (e Diamante 1) do BR pela API oficial da Riot.

Retomável: guarda o que já baixou em model/data/ e continua de onde parou.
Respeita o limite da chave (20 req/s e 100 req/2 min na chave de desenvolvimento e na pessoal).

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
        self.window = []  # horários das últimas requisições (janela de 2 min)

    def _wait(self):
        now = time.time()
        self.window = [t for t in self.window if now - t < 120]
        if len(self.window) >= 98:  # margem abaixo de 100/2min
            time.sleep(120 - (now - self.window[0]) + 0.2)
        if self.window and time.time() - self.window[-1] < 0.06:  # < 20/s
            time.sleep(0.06)
        self.window.append(time.time())

    def get(self, url: str, params: dict | None = None):
        if params:
            url += "?" + urllib.parse.urlencode(params)
        for attempt in range(6):
            self._wait()
            req = urllib.request.Request(url, headers={"X-Riot-Token": self.key, "User-Agent": "helporoLOL-model"})
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    return json.loads(r.read())
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    time.sleep(int(e.headers.get("Retry-After", "10")) + 1)
                    continue
                if e.code in (500, 502, 503, 504):
                    time.sleep(2 * (attempt + 1))
                    continue
                if e.code in (401, 403):
                    sys.exit("Chave da Riot inválida ou expirada (a de desenvolvimento dura 24h). Gere outra e atualize o segredo RIOT_API_KEY.")
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
            "r": pos, "c": p["championName"], "p": p["puuid"],
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
    DATA.mkdir(parents=True, exist_ok=True)

    # 1) ladder (renova a cada rodada: elo muda)
    players = ladder(riot, args.d1)
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
    order = sorted(players, key=lambda p: state["visited"].get(p, 0))  # quem foi visitado há mais tempo primeiro
    for i, puuid in enumerate(order):
        if time.time() > deadline - 600 or len(queue) > 20000:
            break
        ids = riot.get(f"{REGION}/lol/match/v5/matches/by-puuid/{puuid}/ids",
                       {"queue": QUEUE, "type": "ranked", "start": 0, "count": args.ids_per_player, "startTime": SEASON_START}) or []
        queue.update(x for x in ids if x not in seen)
        state["visited"][puuid] = int(time.time())
        if i % 50 == 0:
            state["queue"] = sorted(queue)
            save_json(DATA / "state.json", state)
            print(f"jogadores visitados {i}/{len(order)} · partidas na fila {len(queue)}", flush=True)
    state["queue"] = sorted(queue)
    save_json(DATA / "state.json", state)

    # 3) baixa as partidas da fila até acabar o tempo
    got = 0
    with gzip.open(mf, "at") as out:
        for mid in sorted(queue, reverse=True):  # mais recentes primeiro
            if time.time() > deadline:
                break
            m = riot.get(f"{REGION}/lol/match/v5/matches/{mid}")
            queue.discard(mid)
            row = compact(m) if m else None
            if row:
                out.write(json.dumps(row) + "\n")
                got += 1
            if got and got % 200 == 0:
                out.flush()
                state["queue"] = sorted(queue)
                save_json(DATA / "state.json", state)
                print(f"partidas novas: {got} · na fila: {len(queue)}", flush=True)
    state["queue"] = sorted(queue)
    save_json(DATA / "state.json", state)
    print(f"fim da rodada: {got} partidas novas, {len(seen) + got} no total, {len(queue)} na fila", flush=True)


if __name__ == "__main__":
    main()
