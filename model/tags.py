"""
Tags dos campeões pro modelo.

1. As características do app (src/engine/champions.ts), lidas direto de lá pra não duplicar.
2. Os traços que a Leticia descreveu do jogo dela.
O modelo ainda aprende tags novas sozinho (embeddings); ver train.py.
"""
import re
from pathlib import Path

FLAG_NAMES = {
    "A": "dano_fisico", "P": "dano_magico", "F": "frontline", "E": "engage", "D": "dive", "X": "burst",
    "K": "poke", "C": "cc_pesado", "H": "hook_pick", "S": "split", "Y": "hipercarry", "G": "lane_agressiva",
    "W": "teamfight_aoe", "M": "melee", "R": "peel_encantador", "L": "artilharia", "N": "spell_shield",
}

# Traços da Leticia (conversa de 22/10/2026)
TRAITS = {
    # entra na backline sem dar janela pro silence da Soraka
    "entra_sem_janela": {"Jarvan IV", "Rengar", "Nocturne", "Vi", "Malphite", "Warwick", "Skarner", "Hecarim", "Zac",
                         "Kha'Zix", "Evelynn", "Fiddlesticks", "Kayn", "Qiyana", "Diana"},
    # sup de engage
    "sup_engage": {"Nautilus", "Leona", "Rell", "Pyke", "Thresh", "Rakan", "Alistar", "Blitzcrank", "Braum", "Maokai", "Poppy"},
    # ADC que precisa de sup agressivo na lane
    "adc_agressivo": {"Draven", "Kai'Sa", "Samira", "Lucian"},
    # ADC que amplifica cura recebida
    "amplifica_cura": {"Nilah"},
}

_TS = Path(__file__).resolve().parents[1] / "src" / "engine" / "champions.ts"


def _flags() -> dict[str, str]:
    text = _TS.read_text()
    m = re.search(r"export const CH: Record<string, string> = (\{.*?\});", text, re.S)
    return dict(re.findall(r'"([^"]+)":"([A-Z]*)"', m.group(1))) if m else {}


FLAGS = _flags()
TAG_LIST = list(FLAG_NAMES.values()) + list(TRAITS)


def tags_of(champ: str) -> list[str]:
    out = [FLAG_NAMES[c] for c in FLAGS.get(champ, "") if c in FLAG_NAMES]
    out += [t for t, s in TRAITS.items() if champ in s]
    return out
