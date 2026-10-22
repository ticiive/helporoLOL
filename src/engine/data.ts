/**
 * Snapshot de dados do Lolalytics (patch 16.20, Esmeralda+, ranqueada solo, global).
 * mu = winrate do SEU sup contra cada sup inimigo, no formato "Inimigo:wr:jogos".
 * Pra atualizar, troque este arquivo (fase 2: script automático).
 */
export type SupKey = "soraka" | "sona" | "nami" | "janna" | "lulu" | "milio";
export interface MetaRow { tier: string; wr: number; pick: number; ban: number }
export interface Matchup { wr: number; n: number }

export const SUPS: Record<SupKey, string> = { soraka: "Soraka", sona: "Sona", nami: "Nami", janna: "Janna", lulu: "Lulu", milio: "Milio" };
export const SUP_KEYS = Object.keys(SUPS) as SupKey[];
export const SUP_COLOR: Record<SupKey, string> = { soraka: "#a6d36b", sona: "#86a6ff", nami: "#4fc7bd", janna: "#bfe3f0", lulu: "#c99bf2", milio: "#f2a65a" };

export const PATCH = "16.20";

export const META: Record<SupKey, MetaRow> = {
  janna: { tier: "S+", wr: 52.92, pick: 5.81, ban: 1.29 },
  nami: { tier: "S", wr: 52.43, pick: 9.10, ban: 1.16 },
  lulu: { tier: "A+", wr: 51.45, pick: 12.37, ban: 14.0 },
  milio: { tier: "A", wr: 52.12, pick: 6.88, ban: 4.61 },
  soraka: { tier: "A", wr: 52.26, pick: 4.89, ban: 2.32 },
  sona: { tier: "A", wr: 52.59, pick: 2.61, ban: 0.25 },
};

const RAW: Record<SupKey, string> = {
  soraka: "Janna:48.91:4770,Blitzcrank:49.44:5198,Nami:50.03:8784,Braum:50.04:2852,Sona:50.1:2467,Maokai:50.16:941,Senna:50.22:4233,Thresh:50.63:10001,Yuumi:50.64:4631,Rell:50.93:2195,Taric:51.11:855,Renata Glasc:51.25:1044,Rakan:51.35:2261,Milio:51.45:5516,Lulu:51.48:10104,Zilean:51.52:2302,Neeko:51.57:985,Leona:51.74:4799,Bard:51.99:2918,Seraphine:52.3:4855,Nautilus:52.47:6101,Alistar:52.62:2706,Vel'Koz:52.78:1927,Zyra:53.16:1930,Pyke:53.5:4602,Karma:54.6:5125,Brand:54.73:1840,Poppy:54.82:706,Morgana:54.99:2555,Lux:55.12:4394,Tahm Kench:55.28:1514,Pantheon:55.29:1899,Xerath:55.98:1631,Swain:56.03:1724,Camille:56.94:908,Shaco:59.07:794,Ashe:59.1:533,Mel:64.95:311",
  sona: "Alistar:48.64:1437,Blitzcrank:49.22:2318,Senna:49.33:2382,Thresh:49.9:4667,Vel'Koz:50.11:952,Rell:50.51:1170,Braum:50.77:1424,Leona:50.78:2444,Milio:51.09:3073,Nautilus:51.46:3278,Pyke:51.63:1718,Maokai:51.63:492,Tahm Kench:51.85:729,Rakan:51.91:1308,Neeko:51.94:516,Bard:52.14:1657,Lulu:52.24:5193,Janna:52.25:3248,Karma:52.31:2808,Nami:52.4:5013,Yuumi:52.55:2468,Soraka:52.56:2479,Zilean:52.64:1499,Renata Glasc:53.03:611,Lux:53.34:2139,Seraphine:54.18:3191,Swain:54.43:768,Zyra:54.72:901,Taric:55.29:454,Poppy:55.79:380,Brand:55.92:769,Pantheon:56.97:911,Camille:57.26:503,Morgana:57.32:1256,Shaco:58.72:390,Xerath:59.48:807,Ashe:63.49:241,Mel:67.39:184",
  nami: "Leona:49.34:7100,Blitzcrank:49.95:6431,Thresh:50.04:15111,Sona:50.17:3925,Braum:50.28:5036,Rell:50.62:3169,Alistar:50.91:3999,Vel'Koz:51.11:3021,Janna:51.3:8801,Milio:51.51:10119,Rakan:51.76:3605,Senna:51.79:6310,Nautilus:51.87:9077,Zilean:51.94:3608,Bard:52:4496,Renata Glasc:52.1:1883,Lulu:52.14:16470,Maokai:52.45:1365,Seraphine:52.54:8339,Soraka:52.56:7009,Poppy:52.94:1207,Yuumi:53.17:6197,Morgana:53.19:3625,Karma:53.24:8655,Brand:53.38:2349,Pyke:53.47:5255,Zyra:53.69:2902,Taric:53.95:1253,Tahm Kench:54.01:2220,Neeko:54.13:1539,Shaco:54.81:1029,Lux:54.84:6925,Xerath:54.89:2330,Pantheon:55.07:2655,Camille:56.8:1294,Swain:59.16:2625,Ashe:60.4:793,Mel:62.82:554",
  janna: "Blitzcrank:49.65:3547,Nami:50.16:6539,Sona:50.92:1948,Thresh:51:7621,Senna:51.51:2881,Rell:51.53:2150,Tahm Kench:51.57:1148,Seraphine:51.68:3417,Lulu:51.77:6988,Zilean:51.93:1818,Vel'Koz:51.94:1188,Nautilus:52.14:4526,Renata Glasc:52.24:894,Alistar:52.25:2490,Braum:52.36:2267,Zyra:52.68:1158,Milio:52.79:3874,Soraka:53.06:2953,Bard:53.18:2687,Leona:53.24:4059,Rakan:53.39:2006,Karma:53.59:3598,Neeko:53.69:799,Yuumi:53.83:2755,Pyke:53.86:2525,Brand:54.19:967,Maokai:54.29:722,Poppy:54.4:636,Lux:55:2720,Taric:55.11:626,Swain:55.98:1204,Shaco:56.62:461,Morgana:56.76:1568,Xerath:56.89:965,Pantheon:57.4:1359,Camille:61.02:649,Ashe:63.51:370",
  lulu: "Braum:48.16:5504,Thresh:48.35:17614,Leona:48.52:7778,Blitzcrank:48.8:8805,Rakan:49.33:4056,Rell:49.45:4273,Janna:50.13:7159,Vel'Koz:50.15:2915,Senna:50.18:6216,Soraka:50.31:6209,Alistar:50.33:4747,Zilean:50.36:3380,Taric:50.52:1259,Nami:50.63:12537,Pyke:50.65:5645,Sona:50.86:3246,Seraphine:50.99:8002,Bard:51.04:5237,Renata Glasc:51.39:2049,Nautilus:51.51:10966,Maokai:51.58:1361,Tahm Kench:51.98:2399,Zyra:51.99:2689,Brand:52.06:2311,Milio:52.09:10829,Yuumi:52.34:8944,Xerath:52.46:2783,Lux:52.82:6784,Poppy:52.85:1296,Karma:53.22:9194,Pantheon:53.42:3162,Neeko:53.45:1854,Ashe:54.71:806,Morgana:54.92:3605,Shaco:56.29:1176,Swain:56.5:2731,Camille:58.94:1610,Mel:60.09:446",
  milio: "Vel'Koz:45.32:267,Blitzcrank:45.59:816,Maokai:45.64:149,Soraka:48.37:643,Janna:48.56:799,Lulu:48.79:2187,Leona:48.87:839,Braum:48.92:646,Thresh:49.56:1709,Alistar:49.77:438,Rakan:50.13:395,Karma:50.58:860,Rell:51:351,Bard:51:451,Sona:51.06:331,Zyra:51.75:257,Seraphine:51.82:878,Nami:51.98:1341,Nautilus:52.05:903,Senna:52.12:589,Pyke:52.23:561,Yuumi:53.7:676,Tahm Kench:53.96:265,Morgana:53.99:476,Brand:54.13:218,Lux:54.15:735,Neeko:54.3:186,Pantheon:54.75:316,Zilean:55.19:366,Renata Glasc:55.38:195,Swain:55.63:293,Xerath:59.76:246",
};

export const MU: Record<SupKey, Record<string, Matchup>> = Object.fromEntries(
  SUP_KEYS.map((k) => [k, Object.fromEntries(RAW[k].split(",").map((s) => { const [n, w, g] = s.split(":"); return [n, { wr: +w, n: +g }]; }))]),
) as Record<SupKey, Record<string, Matchup>>;

/**
 * Lane 2v2: minha leitura dos kits, de -2 (muito difícil) a +2 (muito fácil).
 * É separado do winrate de jogo de propósito (ex.: Soraka tem 52% vs Nautilus, mas a lane é dura).
 * A usuária corrige no app; as correções ficam salvas localmente.
 */
export const LANE: Record<SupKey, Record<string, number>> = {
  soraka: { Nautilus: -2, Leona: -2, Blitzcrank: -2, Pyke: -2, Rell: -2, Thresh: -1, Alistar: -1, Rakan: -1, Janna: -1, Lux: -1, Morgana: -1, Brand: -1, Zyra: -1, Xerath: 1, "Vel'Koz": 1, Karma: 1, Sona: 1, Seraphine: 1, Yuumi: 1, Senna: 1 },
  sona: { Nautilus: -2, Leona: -2, Blitzcrank: -2, Pyke: -2, Thresh: -2, Alistar: -2, Rell: -1, Rakan: -1, Xerath: -2, "Vel'Koz": -1, Lux: -1, Brand: -2, Zyra: -2, Karma: -1, Yuumi: 1 },
  nami: { Leona: 1, Alistar: 1, Rakan: 1, Rell: 1, Blitzcrank: -1, Thresh: -1, Xerath: -2, "Vel'Koz": -1, Lux: -1, Morgana: -2, Brand: -1, Zyra: -1, Soraka: 1, Sona: 1, Yuumi: 1 },
  janna: { Leona: 1, Alistar: 2, Rakan: 2, Rell: 1, Blitzcrank: -1, Xerath: -1, "Vel'Koz": -1, Brand: -1, Zyra: -1 },
  lulu: { Thresh: -1, Braum: -1, Leona: -1, Xerath: -1, Brand: -1, Zyra: -1, Morgana: 1 },
  milio: { Blitzcrank: -1, "Vel'Koz": -1, Xerath: -1, Brand: -1, Zyra: -1, Leona: -1 },
};

/**
 * Sinergia com o ADC aliado: winrate do SEU sup jogando junto com cada ADC
 * (op.gg, patch 16.20/16.21, Esmeralda+, todos os servidores). "ADC:wr:jogos".
 * O motor compara com o winrate médio do sup e puxa pro meio quando há poucos jogos.
 */
const RAW_SYN: Record<SupKey, string> = {
  soraka: "Kai'Sa:48.04:993,Jinx:49.55:989,Jhin:52.30:977,Ezreal:49.23:776,Caitlyn:50.49:721,Aphelios:45.86:580,Yunara:47.27:531,Tristana:55.96:495,Miss Fortune:48.91:458,Smolder:50.72:418",
  sona: "Ezreal:49.68:6576,Kai'Sa:49.66:5977,Caitlyn:49.9:4908,Jhin:50.08:4780,Seraphine:53.93:3881,Jinx:51.42:3798,Miss Fortune:50.46:2931,Lucian:52.06:2789,Smolder:52.67:2601,Sivir:51.71:2398",
  nami: "Lucian:49.14:22521,Jinx:52.65:11183,Caitlyn:49.55:9710,Jhin:50.77:9576,Kai'Sa:51.41:9529,Yunara:49.26:8395,Tristana:53.55:7729,Ezreal:49.33:6823,Twitch:52.17:4269,Smolder:51.36:3614",
  janna: "Jhin:53.05:1297,Kai'Sa:52.44:1047,Jinx:53.29:1032,Caitlyn:49.64:834,Ezreal:47.48:813,Yunara:52.50:619,Miss Fortune:51.41:605,Aphelios:47.89:522,Tristana:50.39:514,Draven:53.49:501",
  lulu: "Jinx:52.19:13055,Yunara:51.14:10934,Kai'Sa:47.79:7014,Twitch:52.57:6487,Zeri:52.34:4232,Vayne:52.66:4195,Aphelios:48.89:4134,Kog'Maw:52.8:3977,Tristana:53.99:3764,Caitlyn:48.65:3011",
  milio: "Lucian:48.43:3640,Jinx:53.00:2070,Caitlyn:49.96:1145,Yunara:49.70:990,Aphelios:50.51:875,Kai'Sa:46.42:866,Twitch:52.70:647,Jhin:49.91:567,Tristana:51.03:535,Ashe:53.40:530",
};
export const SYN_ADC: Record<SupKey, Record<string, Matchup>> = Object.fromEntries(
  SUP_KEYS.map((k) => [k, Object.fromEntries(RAW_SYN[k].split(",").map((s) => { const [n, w, g] = s.split(":"); return [n, { wr: +w, n: +g }]; }))]),
) as Record<SupKey, Record<string, Matchup>>;
