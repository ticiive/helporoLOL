"""
Runas, build, itens situacionais e counters de cada campeão em cada rota,
calculados das partidas Mestre+ / Diamante 1 do BR que o coletor baixou.

Gera:
  out/builds.json    {rota: {campeão: {jogos, wr, runas, feiticos, botas, core, situacionais}}}
  out/counters.json  {rota: {inimigo: [[campeão, wr, jogos], ...]}}   (só a rota contra a mesma rota)
  out/synergies.json {rota: {parceiro: [[campeão, wr, jogos], ...]}}  (parceiro: sup<->adc, mid/top->jg, jg->mid)

Situacionais: item que aumenta o winrate do campeão quando o time inimigo tem certa característica
(muito dano mágico, muito físico, muita cura, assassinos, tanques), comparado com os jogos sem o item.
As descrições são nossas, geradas a partir dos dados.

Uso: python model/builds.py
"""
import gzip, json, os
from collections import Counter, defaultdict
from pathlib import Path

from tags import tags_of
from train import display

ROOT = Path(__file__).parent
DATA = Path(os.environ.get("HELPORO_DATA", ROOT / "data"))
OUT = Path(os.environ.get("HELPORO_OUT", ROOT / "out"))
ROLE = {"TOP": "top", "JUNGLE": "jg", "MIDDLE": "mid", "BOTTOM": "adc", "UTILITY": "sup"}
PARTNER = {"sup": "adc", "adc": "sup", "mid": "jg", "top": "jg", "jg": "mid"}
BOOTS = {3006, 3009, 3020, 3047, 3111, 3158, 3010, 2422, 3005}  # botas finais (e Sapatos do Ágil)
SKIP = {0, 2055, 3340, 3363, 3364, 2138, 2139, 2140}  # vazio, sentinela, lentes, elixires
SUP_LINE = {3865, 3866, 3867, 3869, 3870, 3871, 3876, 3877}
HEALERS = {"Soraka", "Yuumi", "Sona", "Nami", "Milio", "Aatrox", "Vladimir", "Dr. Mundo", "Warwick", "Sylas",
           "Fiddlesticks", "Swain", "Briar", "Olaf", "Illaoi", "Renekton", "Seraphine", "Senna", "Taric", "Bel'Veth"}

# condições do draft inimigo (texto mostrado no app)
CONDITIONS = {
    "magico": ("3+ campeões de dano mágico no inimigo", lambda E: sum("dano_magico" in tags_of(c) and "dano_fisico" not in tags_of(c) for c in E) >= 3),
    "fisico": ("3+ campeões de dano físico no inimigo", lambda E: sum("dano_fisico" in tags_of(c) and "dano_magico" not in tags_of(c) for c in E) >= 3),
    "cura": ("2+ campeões com muita cura no inimigo", lambda E: sum(c in HEALERS for c in E) >= 2),
    "assassinos": ("2+ assassinos ou divers no inimigo", lambda E: sum(("burst" in tags_of(c)) or ("dive" in tags_of(c)) for c in E) >= 2),
    "tanques": ("2+ tanques ou frontline no inimigo", lambda E: sum("frontline" in tags_of(c) for c in E) >= 2),
    "cc": ("3+ campeões com CC pesado no inimigo", lambda E: sum("cc_pesado" in tags_of(c) or "engage" in tags_of(c) for c in E) >= 3),
}


def wr(w, n):
    return round(100 * w / n, 1) if n else None


def main(min_games=40, min_counter=15):
    rows = []
    with gzip.open(DATA / "matches.jsonl.gz", "rt") as f:
        for line in f:
            rows.append(json.loads(line))
    per = defaultdict(list)       # (rota, campeão) -> [(pick, venceu, inimigos, oponente_da_rota)]
    duel = defaultdict(list)      # (rota, campeão) -> [(venceu, oponente_da_rota, parceiro)]
    for m in rows:
        for side in (0, 1):
            me, op = m["teams"][side], m["teams"][1 - side]
            enemies = [display(p["c"]) for p in op["picks"]]
            opp = {ROLE[p["r"]]: display(p["c"]) for p in op["picks"]}
            mine = {ROLE[p["r"]]: display(p["c"]) for p in me["picks"]}
            for p in me["picks"]:
                role, champ = ROLE[p["r"]], display(p["c"])
                # counters e sinergias só precisam de campeão, rota e resultado: valem pra todas as partidas
                duel[(role, champ)].append((me["win"], opp.get(role), mine.get(PARTNER[role])))
                if "it" in p:  # runas e itens: só partidas coletadas depois que passamos a guardar isso
                    per[(role, champ)].append((p, me["win"], enemies, opp.get(role)))

    builds = defaultdict(dict)
    counters = defaultdict(lambda: defaultdict(list))
    for (role, champ), games in per.items():
        n = len(games)
        if n < min_games:
            continue
        wins = sum(g[1] for g in games)
        # runas: página mais jogada entre as que têm winrate acima da média do campeão (ou a mais jogada)
        pages = defaultdict(lambda: [0, 0])
        for p, w, _, _ in games:
            ru = p["ru"]
            key = (ru["p"], ru["s"], tuple(ru["k"]), tuple(ru["f"]))
            pages[key][0] += 1; pages[key][1] += w
        ranked = sorted(pages.items(), key=lambda kv: -kv[1][0])
        base = wins / n
        best = next(((k, v) for k, v in ranked[:5] if v[0] >= max(10, n * 0.05) and v[1] / v[0] >= base), ranked[0])
        (ps, ss, keys, shards), (pn, pw) = best
        # feitiços
        spells = Counter(tuple(sorted(p["sp"])) for p, *_ in games).most_common(1)[0][0]
        # itens: botas e core (os 3 itens fechados mais comuns, sem botas e sem a linha de sup)
        items_in = [set(i for i in p["it"] if i not in SKIP) for p, *_ in games]
        boots = Counter(i for s in items_in for i in s if i in BOOTS).most_common(1)
        item_count = Counter(i for s in items_in for i in s if i not in BOOTS)
        sup_item = Counter(i for s in items_in for i in s if i in SUP_LINE).most_common(1)
        core = [i for i, c in item_count.most_common(12) if i not in SUP_LINE][:3]
        # situacionais: item que melhora o winrate numa condição do draft inimigo
        situ = []
        for cond, (text, test) in CONDITIONS.items():
            cg = [(s, w) for s, (p, w, E, _) in zip(items_in, games) if test(E)]
            if len(cg) < 30:
                continue
            for item, c in item_count.most_common(25):
                if item in core or item in SUP_LINE:
                    continue
                with_i = [w for s, w in cg if item in s]
                without = [w for s, w in cg if item not in s]
                if len(with_i) < 40 or len(without) < 40:
                    continue
                # puxa pro zero com amostra pequena: 15 jogos com +25 pts é ruído, não item situacional
                n = min(len(with_i), len(without))
                delta = 100 * (sum(with_i) / len(with_i) - sum(without) / len(without)) * n / (n + 80)
                if delta >= 2:
                    situ.append({"item": item, "cond": cond, "quando": text, "wr": wr(sum(with_i), len(with_i)), "jogos": len(with_i), "ganho": round(delta, 1)})
        situ.sort(key=lambda x: -x["ganho"])
        builds[role][champ] = {
            "jogos": n, "wr": wr(wins, n),
            "runas": {"primaria": ps, "secundaria": ss, "perks": list(keys), "fragmentos": list(shards), "jogos": pn, "wr": wr(pw, pn)},
            "feiticos": list(spells),
            "botas": boots[0][0] if boots else None,
            "item_sup": sup_item[0][0] if sup_item and role == "sup" else None,
            "core": core,
            "situacionais": situ[:6],
        }
    synergies = defaultdict(lambda: defaultdict(list))
    for (role, champ), games in duel.items():
        vs, wt = defaultdict(lambda: [0, 0]), defaultdict(lambda: [0, 0])
        for w, opp, partner in games:
            if opp:
                vs[opp][0] += 1; vs[opp][1] += w
            if partner:
                wt[partner][0] += 1; wt[partner][1] += w
        for opp, (g, w) in vs.items():
            if g >= min_counter:
                counters[role][opp].append([champ, wr(w, g), g])
        for partner, (g, w) in wt.items():
            if g >= min_counter:
                synergies[role][partner].append([champ, wr(w, g), g])
    for role in synergies:
        for partner in synergies[role]:
            synergies[role][partner].sort(key=lambda x: -x[1])
            synergies[role][partner] = synergies[role][partner][:40]
    for role in counters:
        for opp in counters[role]:
            counters[role][opp].sort(key=lambda x: -x[1])
            counters[role][opp] = counters[role][opp][:40]
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "builds.json").write_text(json.dumps(builds))
    (OUT / "counters.json").write_text(json.dumps(counters))
    (OUT / "synergies.json").write_text(json.dumps(synergies))
    total = sum(len(v) for v in builds.values())
    print(f"builds: {total} campeão+rota com {min_games}+ jogos · counters: {sum(len(v) for v in counters.values())} oponentes · sinergias: {sum(len(v) for v in synergies.values())} parceiros")


if __name__ == "__main__":
    main()
