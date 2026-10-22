/**
 * Lista completa de campeões (patch 16.21), usada só quando o Data Dragon não carrega
 * (sem internet, ou na prévia). No app com internet, a lista vem sempre da Riot e
 * campeões novos aparecem sozinhos.
 * Formato: Nome|id numérico|tags|dificuldade (0 = sem dado)|alcance (0 = sem dado)
 */
const RAW = `Aatrox|266|Fighter|4|175
Ahri|103|Mage+Assassin|5|550
Akali|84|Assassin|7|125
Akshan|166|Marksman+Assassin|0|500
Alistar|12|Tank+Support|7|125
Ambessa|799|Fighter+Assassin|10|125
Amumu|32|Tank+Support|3|125
Anivia|34|Mage|10|600
Annie|1|Mage+Support|6|625
Aphelios|523|Marksman|10|550
Ashe|22|Marksman+Support|4|600
Aurelion Sol|136|Mage|7|550
Aurora|893|Mage+Assassin|5|550
Azir|268|Mage+Marksman|9|525
Bard|432|Support+Mage|9|500
Bel'Veth|200|Fighter|10|150
Blitzcrank|53|Tank+Support|4|125
Brand|63|Mage+Support|4|550
Braum|201|Tank+Support|3|125
Briar|233|Fighter+Assassin|3|125
Caitlyn|51|Marksman|6|650
Camille|164|Fighter+Assassin|4|125
Cassiopeia|69|Mage|10|550
Cho'Gath|31|Tank+Mage|5|125
Corki|42|Marksman+Mage|6|550
Darius|122|Fighter+Tank|2|175
Diana|131|Fighter+Assassin|4|150
Draven|119|Marksman|8|550
Dr. Mundo|36|Tank+Fighter|5|125
Ekko|245|Assassin+Mage|8|125
Elise|60|Assassin+Mage|9|550
Evelynn|28|Assassin+Mage|10|125
Ezreal|81|Marksman+Mage|7|550
Fiddlesticks|9|Mage+Support|9|480
Fiora|114|Fighter+Assassin|3|150
Fizz|105|Assassin+Fighter|6|175
Galio|3|Tank+Mage|5|150
Gangplank|41|Fighter|9|125
Garen|86|Fighter+Tank|5|175
Gnar|150|Fighter+Tank|8|175
Gragas|79|Fighter+Mage|5|125
Graves|104|Marksman|3|425
Gwen|887|Fighter|5|150
Hecarim|120|Fighter+Tank|6|175
Heimerdinger|74|Mage+Support|8|550
Hwei|910|Mage+Support|9|550
Illaoi|420|Fighter+Tank|4|125
Irelia|39|Fighter+Assassin|5|200
Ivern|427|Support+Mage|7|475
Janna|40|Support+Mage|7|550
Jarvan IV|59|Fighter+Tank|5|175
Jax|24|Fighter|5|125
Jayce|126|Fighter+Marksman|7|125
Jhin|202|Marksman+Mage|6|550
Jinx|222|Marksman|6|525
Kai'Sa|145|Marksman+Mage|6|525
Kalista|429|Marksman|7|525
Karma|43|Mage+Support|5|525
Karthus|30|Mage|7|450
Kassadin|38|Assassin+Mage|8|150
Katarina|55|Assassin+Mage|8|125
Kayle|10|Marksman+Mage|7|175
Kayn|141|Fighter+Assassin|8|175
Kennen|85|Mage|4|550
Kha'Zix|121|Assassin|6|125
Kindred|203|Marksman|4|500
Kled|240|Fighter|7|125
Kog'Maw|96|Marksman+Mage|6|500
K'Sante|897|Tank+Fighter|9|150
LeBlanc|7|Assassin+Mage|9|525
Lee Sin|64|Fighter+Assassin|6|125
Leona|89|Tank+Support|4|125
Lillia|876|Fighter+Mage|8|325
Lissandra|127|Mage|6|550
Locke|805|Assassin+Mage|5|125
Lucian|236|Marksman+Assassin|6|500
Lulu|117|Support+Mage|5|550
Lux|99|Mage+Support|5|550
Malphite|54|Tank+Mage|2|125
Malzahar|90|Mage|6|500
Maokai|57|Tank+Support|3|125
Master Yi|11|Fighter+Assassin|4|175
Mel|800|Mage+Support|5|550
Milio|902|Support+Mage|5|525
Miss Fortune|21|Marksman+Mage|1|550
Wukong|62|Fighter+Tank|3|175
Mordekaiser|82|Fighter+Mage|4|175
Morgana|25|Support+Mage|1|450
Naafiri|950|Assassin+Fighter|2|125
Nami|267|Support+Mage|5|550
Nasus|75|Fighter+Tank|0|0
Nautilus|111|Tank+Support|0|0
Neeko|518|Mage+Support|0|0
Nidalee|76|Assassin+Mage|0|0
Nilah|895|Fighter+Assassin|0|0
Nocturne|56|Fighter+Assassin|0|0
Nunu & Willump|20|Tank+Mage|0|0
Olaf|2|Fighter+Tank|0|0
Orianna|61|Mage+Support|0|0
Ornn|516|Tank|0|0
Pantheon|80|Fighter+Assassin|0|0
Poppy|78|Tank+Fighter|0|0
Pyke|555|Support+Assassin|0|0
Qiyana|246|Assassin|0|0
Quinn|133|Marksman+Assassin|0|0
Rakan|497|Support|0|0
Rammus|33|Tank|0|0
Rek'Sai|421|Fighter+Tank|0|0
Rell|526|Tank+Support|0|0
Renata Glasc|888|Support+Mage|0|0
Renekton|58|Fighter+Tank|0|0
Rengar|107|Assassin+Fighter|0|0
Riven|92|Fighter+Assassin|0|0
Rumble|68|Fighter+Mage|0|0
Ryze|13|Mage|0|0
Samira|360|Marksman+Assassin|0|0
Sejuani|113|Tank|0|0
Senna|235|Support+Marksman|0|0
Seraphine|147|Support+Mage|0|0
Sett|875|Fighter+Tank|0|0
Shaco|35|Assassin|0|0
Shen|98|Tank|0|0
Shyvana|102|Fighter+Tank|0|0
Singed|27|Tank+Mage|0|0
Sion|14|Tank+Fighter|0|0
Sivir|15|Marksman|0|0
Skarner|72|Tank+Fighter|0|0
Smolder|901|Marksman+Mage|0|0
Sona|37|Support+Mage|0|0
Soraka|16|Support+Mage|0|0
Swain|50|Mage+Support|0|0
Sylas|517|Mage+Assassin|0|0
Syndra|134|Mage|0|0
Tahm Kench|223|Tank+Support|0|0
Taliyah|163|Mage+Support|0|0
Talon|91|Assassin|0|0
Taric|44|Support+Tank|0|0
Teemo|17|Marksman+Mage|0|0
Thresh|412|Support+Tank|0|0
Tristana|18|Marksman+Assassin|0|0
Trundle|48|Fighter+Tank|0|0
Tryndamere|23|Fighter+Assassin|0|0
Twisted Fate|4|Mage+Marksman|0|0
Twitch|29|Marksman+Assassin|0|0
Udyr|77|Fighter+Tank|0|0
Urgot|6|Fighter+Tank|0|0
Varus|110|Marksman+Mage|0|0
Vayne|67|Marksman+Assassin|0|0
Veigar|45|Mage|0|0
Vel'Koz|161|Mage+Support|0|0
Vex|711|Mage|0|0
Vi|254|Fighter+Assassin|0|0
Viego|234|Fighter+Assassin|0|0
Viktor|112|Mage|0|0
Vladimir|8|Mage+Fighter|0|0
Volibear|106|Fighter+Tank|0|0
Warwick|19|Fighter+Tank|0|0
Xayah|498|Marksman|0|0
Xerath|101|Mage+Support|0|0
Xin Zhao|5|Fighter+Tank|0|0
Yasuo|157|Fighter+Assassin|0|0
Yone|777|Fighter+Assassin|0|0
Yorick|83|Fighter+Tank|0|0
Yunara|804|Marksman|0|0
Yuumi|350|Support+Mage|0|0
Zaahen|904|Fighter|0|0
Zac|154|Tank+Fighter|0|0
Zed|238|Assassin|0|0
Zeri|221|Marksman|0|0
Ziggs|115|Mage|0|0
Zilean|26|Support+Mage|0|0
Zoe|142|Mage|0|0
Zyra|143|Mage+Support|0|0`;

export interface RosterRow { name: string; key: number; tags: string[]; diff: number; range: number }
export const ROSTER: RosterRow[] = RAW.split("\n").map((l) => {
  const [name, key, tags, diff, range] = l.split("|");
  return { name, key: +key, tags: tags.split("+"), diff: +diff, range: +range };
});
