/**
 * Dados provisórios do op.gg (patch 16.21, Esmeralda+), pra usar enquanto o modelo próprio
 * ainda não tem partidas suficientes. Quando a branch "data" tiver builds Mestre+ de um campeão,
 * elas substituem estas.
 * Nomes em inglês; o app converte pra IDs com o Data Dragon (en_US).
 */
export interface SnapBuild {
  keystone: string; primaryTree: string; primary: string[]; secondaryTree: string; secondary: string[]; shards: string[];
  runeWinRate: number; runeGames: number; spells: string[]; boots: string; core: string[]; situational: string[];
}

const RES = ["Bone Plating", "Revitalize"];
export const SNAPSHOT: Record<string, Record<string, SnapBuild>> = {
  sup: {
    Soraka: { keystone: "Summon Aery", primaryTree: "Sorcery", primary: ["Manaflow Band", "Transcendence", "Scorch"], secondaryTree: "Resolve", secondary: ["Revitalize", "Bone Plating"], shards: ["Adaptive Force", "Adaptive Force", "Health Scaling"], runeWinRate: 51.77, runeGames: 9198, spells: ["Flash", "Heal"], boots: "Ionian Boots of Lucidity", core: ["Moonstone Renewer", "Redemption", "Dawncore"], situational: ["Locket of the Iron Solari", "Ardent Censer", "Mikael's Blessing", "Shurelya's Battlesong", "Dream Maker"] },
    Sona: { keystone: "Summon Aery", primaryTree: "Sorcery", primary: ["Manaflow Band", "Transcendence", "Celerity"], secondaryTree: "Resolve", secondary: RES, shards: ["Adaptive Force", "Adaptive Force", "Health Scaling"], runeWinRate: 51.44, runeGames: 27994, spells: ["Flash", "Heal"], boots: "Ionian Boots of Lucidity", core: ["Echoes of Helia", "Diadem of Songs", "Moonstone Renewer"], situational: ["Seraph's Embrace", "Staff of Flowing Water", "Dawncore", "Ardent Censer"] },
    Nami: { keystone: "Summon Aery", primaryTree: "Sorcery", primary: ["Manaflow Band", "Transcendence", "Scorch"], secondaryTree: "Resolve", secondary: ["Bone Plating", "Revitalize"], shards: ["Adaptive Force", "Adaptive Force", "Health Scaling"], runeWinRate: 50.96, runeGames: 127447, spells: ["Flash", "Heal"], boots: "Ionian Boots of Lucidity", core: ["Echoes of Helia", "Moonstone Renewer", "Ardent Censer"], situational: ["Redemption", "Mikael's Blessing", "Staff of Flowing Water", "Shurelya's Battlesong"] },
    Janna: { keystone: "Summon Aery", primaryTree: "Sorcery", primary: ["Manaflow Band", "Celerity", "Gathering Storm"], secondaryTree: "Resolve", secondary: ["Font of Life", "Revitalize"], shards: ["Adaptive Force", "Move Speed", "Health Scaling"], runeWinRate: 51.71, runeGames: 58947, spells: ["Flash", "Heal"], boots: "Boots of Swiftness", core: ["Moonstone Renewer", "Redemption", "Shurelya's Battlesong"], situational: ["Dawncore", "Mejai's Soulstealer", "Ardent Censer", "Mikael's Blessing", "Staff of Flowing Water"] },
    Lulu: { keystone: "Summon Aery", primaryTree: "Sorcery", primary: ["Manaflow Band", "Transcendence", "Scorch"], secondaryTree: "Resolve", secondary: ["Bone Plating", "Revitalize"], shards: ["Ability Haste", "Adaptive Force", "Health Scaling"], runeWinRate: 49.7, runeGames: 154268, spells: ["Flash", "Heal"], boots: "Ionian Boots of Lucidity", core: ["Ardent Censer", "Moonstone Renewer", "Shurelya's Battlesong"], situational: ["Redemption", "Locket of the Iron Solari", "Mikael's Blessing", "Knight's Vow"] },
    Milio: { keystone: "Summon Aery", primaryTree: "Sorcery", primary: ["Manaflow Band", "Transcendence", "Scorch"], secondaryTree: "Resolve", secondary: ["Bone Plating", "Revitalize"], shards: ["Adaptive Force", "Adaptive Force", "Health Scaling"], runeWinRate: 50.72, runeGames: 108769, spells: ["Flash", "Heal"], boots: "Ionian Boots of Lucidity", core: ["Echoes of Helia", "Moonstone Renewer", "Ardent Censer"], situational: ["Redemption", "Shurelya's Battlesong", "Dawncore", "Mikael's Blessing", "Locket of the Iron Solari"] },
    Yuumi: { keystone: "Summon Aery", primaryTree: "Sorcery", primary: ["Manaflow Band", "Transcendence", "Scorch"], secondaryTree: "Resolve", secondary: ["Font of Life", "Revitalize"], shards: ["Adaptive Force", "Ability Haste", "Health Scaling"], runeWinRate: 48.1, runeGames: 9966, spells: ["Exhaust", "Heal"], boots: "Ionian Boots of Lucidity", core: ["Mikael's Blessing", "Ardent Censer", "Moonstone Renewer"], situational: ["Knight's Vow", "Redemption", "Dawncore", "Echoes of Helia", "Shurelya's Battlesong"] },
    Bard: { keystone: "Electrocute", primaryTree: "Domination", primary: ["Cheap Shot", "Deep Ward", "Treasure Hunter"], secondaryTree: "Inspiration", secondary: ["Biscuit Delivery", "Cosmic Insight"], shards: ["Attack Speed", "Move Speed", "Health Scaling"], runeWinRate: 49.35, runeGames: 47923, spells: ["Flash", "Ignite"], boots: "Boots of Swiftness", core: ["Dead Man's Plate", "Locket of the Iron Solari", "Bandlepipes"], situational: ["Redemption", "Mikael's Blessing", "Shurelya's Battlesong"] },
    Karma: { keystone: "Summon Aery", primaryTree: "Sorcery", primary: ["Transcendence", "Scorch", "Gathering Storm"], secondaryTree: "Resolve", secondary: ["Font of Life", "Revitalize"], shards: ["Adaptive Force", "Ability Haste", "Health"], runeWinRate: 49.29, runeGames: 77709, spells: ["Flash", "Heal"], boots: "Ionian Boots of Lucidity", core: ["Echoes of Helia", "Moonstone Renewer", "Redemption"], situational: ["Shurelya's Battlesong", "Dawncore", "Mikael's Blessing", "Morellonomicon", "Ardent Censer"] },
  },
  mid: {
    Lux: { keystone: "Arcane Comet", primaryTree: "Sorcery", primary: ["Manaflow Band", "Transcendence", "Scorch"], secondaryTree: "Domination", secondary: ["Cheap Shot", "Ultimate Hunter"], shards: ["Adaptive Force", "Adaptive Force", "Health Scaling"], runeWinRate: 50.84, runeGames: 44777, spells: ["Flash", "Teleport"], boots: "Sorcerer's Shoes", core: ["Luden's Echo", "Stormsurge", "Shadowflame"], situational: ["Malignance", "Rabadon's Deathcap", "Zhonya's Hourglass", "Void Staff", "Mejai's Soulstealer"] },
    Malzahar: { keystone: "Deathfire Touch", primaryTree: "Sorcery", primary: ["Manaflow Band", "Transcendence", "Scorch"], secondaryTree: "Inspiration", secondary: ["Magical Footwear", "Cosmic Insight"], shards: ["Adaptive Force", "Adaptive Force", "Health Scaling"], runeWinRate: 47.89, runeGames: 971, spells: ["Flash", "Teleport"], boots: "Sorcerer's Shoes", core: ["Blackfire Torch", "Rylai's Crystal Scepter", "Liandry's Torment"], situational: ["Zhonya's Hourglass", "Shadowflame", "Rabadon's Deathcap", "Void Staff", "Morellonomicon"] },
  },
};

/** Sinergia da Yuumi com ADC (op.gg 16.21): o app trata como a tabela dos outros sups. */
export const YUUMI_SYN = "Zeri:50.20:3279,Twitch:50.54:1286,Tristana:50.45:1209,Lucian:51.15:1175,Ezreal:37.71:952,Kai'Sa:43.57:762,Sivir:48.07:753,Yunara:49.59:615,Jinx:43.63:573";

const SHARD_ID: Record<string, number> = { "Adaptive Force": 5008, "Attack Speed": 5005, "Ability Haste": 5007, "Move Speed": 5010, "Health Scaling": 5001, Health: 5011, Tenacity: 5013, Armor: 5002, "Magic Resist": 5003 };
export const shardId = (n: string) => SHARD_ID[n] ?? 5008;
