/**
 * Características de cada campeão, no estilo do que o Porofessor mostra.
 *
 * A dano físico · P dano mágico · F frontline · E engage · D dive · X burst/assassino
 * K poke · C CC pesado · H hook/pick · S split · Y hipercarry · G lane agressiva
 * W teamfight AoE · M melee · R peel/encantador · L mago de longo alcance · N spell shield
 *
 * Campeão que não estiver aqui ganha flags a partir das tags da Riot (ver fallbackFlags).
 */
export const CH: Record<string, string> = {"Aatrox":"AFMD","Ahri":"PXH","Akali":"PXM","Akshan":"AX","Alistar":"FECMR","Ambessa":"AMD","Amumu":"PFMECW","Anivia":"PKCW","Annie":"PXCW","Aphelios":"AYW","Ashe":"ACH","Aurelion Sol":"PKW","Aurora":"PX","Azir":"PK","Bard":"PCHR","Bel'Veth":"AMD","Blitzcrank":"HCEMG","Brand":"PKLW","Braum":"FMRC","Briar":"AMDX","Caitlyn":"AKG","Camille":"AMDS","Cassiopeia":"P","Cho'Gath":"PFMC","Corki":"APK","Darius":"AFM","Diana":"PMDXW","Dr. Mundo":"AFM","Draven":"AG","Ekko":"PXM","Elise":"PXH","Evelynn":"PXM","Ezreal":"AK","Fiddlesticks":"PWE","Fiora":"AMS","Fizz":"PXM","Galio":"PFMEW","Gangplank":"AK","Garen":"AFM","Gnar":"AFW","Gragas":"PFMEW","Graves":"A","Gwen":"PMS","Hecarim":"AMDE","Heimerdinger":"PK","Hwei":"PKL","Illaoi":"AFM","Irelia":"AMDS","Ivern":"PR","Janna":"PR","Jarvan IV":"AFMDEW","Jax":"AMS","Jayce":"AK","Jhin":"AKH","Jinx":"AY","K'Sante":"AFMC","Kai'Sa":"AYD","Kalista":"AG","Karma":"PKR","Karthus":"PW","Kassadin":"PXM","Katarina":"PXMW","Kayle":"PY","Kayn":"AMXD","Kennen":"PWE","Kha'Zix":"AMX","Kindred":"A","Kled":"AMD","Kog'Maw":"AY","LeBlanc":"PXH","Lee Sin":"AMD","Leona":"FMECG","Lillia":"PW","Lissandra":"PEC","Lucian":"AG","Lulu":"PR","Lux":"PKHL","Malphite":"PFMEW","Malzahar":"PCN","Maokai":"PFMC","Master Yi":"AMYS","Mel":"PKL","Milio":"PR","Miss Fortune":"AWG","Mordekaiser":"PFM","Morgana":"PHN","Nami":"PRCG","Nasus":"AFMS","Nautilus":"FMECGH","Neeko":"PWEH","Nidalee":"PKX","Nilah":"AMG","Nocturne":"AMDN","Nunu & Willump":"PFMC","Olaf":"AMD","Orianna":"PWK","Ornn":"FMEC","Pantheon":"AMD","Poppy":"FMC","Pyke":"AMXHG","Qiyana":"AMX","Quinn":"AS","Rakan":"PECG","Rammus":"FMC","Rek'Sai":"AMD","Rell":"FMECG","Renata Glasc":"PR","Renekton":"AFMD","Rengar":"AMX","Riven":"AMD","Rumble":"PWM","Ryze":"P","Samira":"AGD","Sejuani":"FMEC","Senna":"AKR","Seraphine":"PKWR","Sett":"AFM","Shaco":"AXM","Shen":"FMS","Shyvana":"PFM","Singed":"PFM","Sion":"AFMEC","Sivir":"AN","Skarner":"FMEC","Smolder":"AY","Sona":"PRW","Soraka":"PR","Swain":"PFKL","Sylas":"PMD","Syndra":"PXK","Tahm Kench":"PFMR","Taliyah":"PK","Talon":"AMX","Taric":"FMR","Teemo":"PK","Thresh":"HCMRG","Tristana":"AGD","Trundle":"AMS","Tryndamere":"AMS","Twisted Fate":"PH","Twitch":"AY","Udyr":"AFMS","Urgot":"AFM","Varus":"AK","Vayne":"AY","Veigar":"PC","Vel'Koz":"PKL","Vex":"PX","Vi":"AMDE","Viego":"AMD","Viktor":"PK","Vladimir":"P","Volibear":"AFMD","Warwick":"AMD","Wukong":"AMDEW","Xayah":"AY","Xerath":"PKL","Xin Zhao":"AMD","Yasuo":"AMW","Yone":"AMDW","Yorick":"AS","Yunara":"AY","Yuumi":"PR","Zac":"PFMEW","Zed":"AMX","Zeri":"AY","Ziggs":"PK","Zilean":"PR","Zoe":"PKX","Zyra":"PKLC"};

/** Flags aproximadas a partir das tags oficiais (Tank, Fighter, Assassin, Mage, Marksman, Support). */
export function fallbackFlags(tags: string[]): string {
  let f = "";
  if (tags.includes("Tank")) f += "FM";
  if (tags.includes("Fighter")) f += "AM";
  if (tags.includes("Assassin")) f += "X";
  if (tags.includes("Mage")) f += "P";
  if (tags.includes("Marksman")) f += "A";
  if (tags.includes("Support")) f += "R";
  return [...new Set(f)].join("");
}

/** Junglers comuns, usados pra adivinhar a rota do inimigo quando o cliente não informa. */
export const JUNGLERS = new Set(["Amumu","Bel'Veth","Briar","Diana","Ekko","Elise","Evelynn","Fiddlesticks","Gragas","Graves","Hecarim","Ivern","Jarvan IV","Karthus","Kayn","Kha'Zix","Kindred","Lee Sin","Lillia","Master Yi","Nidalee","Nocturne","Nunu & Willump","Olaf","Rammus","Rek'Sai","Rengar","Sejuani","Shaco","Shyvana","Skarner","Taliyah","Udyr","Vi","Viego","Volibear","Warwick","Wukong","Xin Zhao","Zac"]);
export const SUPPORTS = new Set(["Alistar","Bard","Blitzcrank","Brand","Braum","Janna","Karma","Leona","Lulu","Lux","Milio","Morgana","Nami","Nautilus","Pyke","Rakan","Rell","Renata Glasc","Senna","Seraphine","Sona","Soraka","Swain","Tahm Kench","Taric","Thresh","Vel'Koz","Xerath","Yuumi","Zilean","Zyra","Maokai","Poppy","Neeko","Pantheon","Camille","Shaco","Mel"]);
export const BOTS = new Set(["Aphelios","Ashe","Caitlyn","Corki","Draven","Ezreal","Jhin","Jinx","Kai'Sa","Kalista","Kog'Maw","Lucian","Miss Fortune","Nilah","Samira","Sivir","Smolder","Tristana","Twitch","Varus","Vayne","Xayah","Yunara","Zeri","Ziggs","Seraphine","Hwei","Swain"]);
export const MIDS = new Set(["Ahri","Akali","Akshan","Anivia","Annie","Aurelion Sol","Aurora","Azir","Cassiopeia","Corki","Diana","Ekko","Fizz","Galio","Hwei","Irelia","Kassadin","Katarina","LeBlanc","Lissandra","Lux","Malzahar","Mel","Naafiri","Neeko","Orianna","Qiyana","Ryze","Seraphine","Smolder","Swain","Sylas","Syndra","Taliyah","Talon","Twisted Fate","Veigar","Vex","Viktor","Vladimir","Xerath","Yasuo","Yone","Zed","Ziggs","Zoe","Karma","Annie"]);
export const TOPS = new Set(["Aatrox","Ambessa","Camille","Cho'Gath","Darius","Dr. Mundo","Fiora","Gangplank","Garen","Gnar","Gwen","Illaoi","Irelia","Jax","Jayce","K'Sante","Kayle","Kennen","Kled","Malphite","Mordekaiser","Nasus","Olaf","Ornn","Pantheon","Poppy","Quinn","Renekton","Riven","Rumble","Sett","Shen","Singed","Sion","Teemo","Trundle","Tryndamere","Urgot","Vladimir","Volibear","Yorick","Yone"]);

export const TAG_TEXT: Record<string, string> = { F: "front", E: "engage", D: "dive", X: "burst", K: "poke", H: "pick", Y: "hiper", G: "agressivo", R: "peel" };
