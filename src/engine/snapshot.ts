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

/**
 * Counters do mid (op.gg 16.21, Esmeralda+): pra cada mid inimigo popular, quem ganha dele.
 * Winrate do counter = 100 - winrate do inimigo naquele matchup. Só matchups com 150+ jogos.
 */
const MID_RAW: Record<string, string> = {
  Ahri: "Lux:55.6:480,Akshan:54.0:300,Annie:53.9:234,Fizz:52.2:466,Lissandra:51.9:574,Mel:51.9:472,Aurora:51.9:347,Twisted Fate:51.8:598,Katarina:51.5:726,Vladimir:51.4:514",
  Yasuo: "Veigar:57.0:961,Pantheon:56.3:528,Lissandra:55.5:2330,Vladimir:55.5:1774,Annie:54.9:699,Vex:54.7:1355,Malzahar:54.5:1685,Yone:53.7:3608,Aurora:53.2:711,Viktor:52.5:2608,Malphite:52.0:448,Swain:52.0:300,Nasus:51.6:401,Talon:51.5:522",
  Yone: "Jayce:55.9:472,Annie:55.2:1010,Vex:54.8:1806,Aurora:53.6:1527,Malphite:52.9:558,LeBlanc:52.8:2671,Syndra:52.7:3462,Ahri:52.7:4729,Twisted Fate:52.6:2738,Lux:52.0:1908,Lissandra:51.8:2768,Katarina:51.7:3629,Akali:51.5:4139,Hwei:51.4:1853",
  Zed: "Nasus:55.0:1212,Gragas:54.4:322,Gwen:54.3:256,Malphite:54.3:1531,Akshan:53.3:975,Qiyana:53.0:1654,Vex:52.6:1386,Katarina:52.2:3520,Sylas:52.2:3709,Malzahar:52.2:2519,Xerath:52.0:1849,Ekko:52.0:2423,Diana:52.0:1869,Fizz:51.8:2829",
  Syndra: "Fizz:55.6:4209,Katarina:55.1:4045,Garen:54.9:299,Ekko:54.8:3432,Locke:53.4:5006,Gwen:53.2:316,Xerath:53.0:4133,LeBlanc:52.7:3720,Naafiri:52.6:466,Yasuo:52.2:4826,Kassadin:52.0:1951,Zed:52.0:4291,Aurelion Sol:51.7:1216",
  Viktor: "Locke:53.1:6356,Xerath:52.9:6030,Vel'Koz:52.7:926,Gragas:52.3:411,Talon:52.2:1396,Aurora:51.9:2264,Hwei:51.8:4070,Syndra:51.7:8778,Akali:51.7:5123,Fizz:51.6:3348,Ekko:51.4:3885,Swain:51.4:738",
  Akali: "Zoe:60.7:247,Lissandra:58.4:545,Twisted Fate:57.7:499,Vex:56.6:279,Kassadin:56.6:228,Talon:56.2:178,Taliyah:56.1:189,LeBlanc:55.8:464,Hwei:55.6:302,Lux:55.0:278,Vladimir:53.9:336,Zed:53.5:742,Galio:52.6:481,Orianna:52.6:323,Ahri:52.5:762,Malzahar:51.7:354",
  Sylas: "Gwen:64.5:152,Vex:58.4:850,Swain:57.2:367,Yasuo:55.7:2150,Lux:55.5:793,Talon:55.2:460,Taliyah:54.8:434,Hwei:54.5:839,Katarina:54.1:1530,Veigar:54.1:715,Aurora:53.9:712,Malzahar:53.8:967,Yone:53.3:2269,Galio:52.6:1145,Ekko:52.3:1391,Ahri:52.2:3183,Diana:52.2:918",
  Locke: "Vex:54.9:641,Akshan:54.3:494,Qiyana:54.0:604,Talon:53.7:443,Fizz:53.3:884,Akali:53.0:1607,Katarina:52.9:1317,LeBlanc:52.4:1042,Ekko:52.3:1058,Diana:52.2:782,Aurora:52.2:627,Ahri:52.0:1605,Kassadin:51.7:768,Galio:51.7:1348",
  Katarina: "Diana:56.7:1058,Garen:55.2:270,Vex:54.5:932,Cassiopeia:54.0:261,Ekko:53.3:1198,Lissandra:53.0:1552,Yasuo:52.8:2020,Vladimir:52.8:1226,Pantheon:52.2:293,Lux:52.2:910,Jayce:51.7:209,Aurelion Sol:51.6:368,Galio:51.4:1223",
  "Twisted Fate": "Kog'Maw:59.6:225,Diana:52.7:792,Aurora:52.6:1047,Hwei:51.3:1239,Katarina:51.3:1845",
  Lissandra: "Kog'Maw:58.5:342,Vex:54.8:1217,Gwen:53.6:263,Xerath:53.5:2272,Pantheon:52.8:284,Aurora:52.5:1226,Aurelion Sol:52.4:841,Anivia:52.3:919,Lux:52.1:1958,Twisted Fate:52.0:2388,Zoe:51.9:1178,Viktor:51.6:4301",
  LeBlanc: "Vex:56.3:2164,Pantheon:55.9:204,Naafiri:55.0:342,Diana:54.5:1070,Sion:54.4:180,Malzahar:53.9:1982,Akshan:53.1:720,Aurora:52.6:1014,Katarina:52.0:2133,Kassadin:51.9:1098,Lissandra:51.5:2278",
  Ekko: "Gragas:58.9:168,Aurora:52.2:665,Lux:51.6:957,Vex:51.3:763,Lissandra:51.1:1315",
  Fizz: "Yone:53.8:925,Zoe:53.2:372,Kassadin:53.2:438,Lissandra:53.1:883,Ekko:52.7:558,Azir:51.4:181,Lux:51.3:513",
  Orianna: "Ziggs:62.1:161,Kog'Maw:61.8:204,Swain:60.1:258,Ekko:60.0:1249,LeBlanc:57.6:1343,Aurelion Sol:57.1:422,Kassadin:56.5:667,Irelia:56.5:733,Hwei:56.4:1124,Fizz:56.2:1121,Syndra:56.2:2689,Zoe:56.2:783,Katarina:56.0:1440,Ahri:55.5:2580,Locke:55.3:1831,Xerath:55.0:1217",
};
export const SNAP_COUNTERS: Record<string, Record<string, [string, number, number][]>> = {
  mid: Object.fromEntries(Object.entries(MID_RAW).map(([k, v]) => [k, v.split(",").map((x) => { const [n, w, g] = x.split(":"); return [n, +w, +g] as [string, number, number]; })])),
};
