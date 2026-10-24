# Relatório do modelo

Amostras por sup: {'Lulu': 13419, 'Milio': 7687, 'Janna': 10669, 'Nami': 5597, 'Sona': 4331, 'Soraka': 3208}

## Qualidade (jogos mais recentes, que o modelo não viu)

- Perda do modelo: 0.6926 (só a média do sup: 0.6936; menor é melhor)
- AUC: 0.526 (0,5 = chute; num jogo com tanto acaso, 0,55 a 0,60 já é bom)
- Só o draft (sem a diferença de elo, que o app não sabe na seleção) é o que vale acima. Com o elo: AUC 0.545.
- O app só usa o modelo quando o draft sozinho bate a média do sup.

## Inimigos do bot que mais mudam o jogo de cada sup

Efeito em pontos de winrate quando o campeão é o sup ou o ADC inimigo, em relação à média.

- **Soraka**, piores: Sona -4.6, Annie -4.6, Bard -4.4, Seraphine -4.3, Nami -4.0, Katarina -3.8, Thresh -3.7, Morgana -3.4
  melhores: Ezreal +4.2, Vayne +3.7, Kai'Sa +3.3, Smolder +3.0, Xayah +2.2, Kog'Maw +2.1, Yunara +2.0, Camille +2.0
- **Sona**, piores: Thresh -2.7, Blitzcrank -1.9, Senna -1.7, Leona -1.4, Lux -1.4, Taric -1.4, Pyke -1.3, Karma -1.3
  melhores: Malzahar +3.0, Ezreal +2.9, Kai'Sa +2.8, Karthus +2.2, Miss Fortune +2.1, Cassiopeia +2.0, Aurelion Sol +1.9, Vayne +1.9
- **Nami**, piores: Gragas -4.6, Sona -4.3, Katarina -3.9, Seraphine -3.7, Amumu -3.6, Thresh -3.5, Galio -3.5, Alistar -3.4
  melhores: Ezreal +4.0, Vayne +3.5, Kai'Sa +2.9, Smolder +2.8, Xayah +2.0, Kog'Maw +1.9, Yunara +1.8, Jhin +1.6
- **Janna**, piores: Sona -2.7, Gragas -2.6, Leona -2.6, Alistar -2.5, Thresh -2.1, Braum -2.0, Fiddlesticks -2.0, Rell -2.0
  melhores: Ezreal +4.4, Kai'Sa +2.8, Mel +2.2, Jhin +2.1, Samira +2.0, Ziggs +2.0, Varus +1.9, Miss Fortune +1.9
- **Lulu**, piores: Nami -4.0, Thresh -3.9, Rakan -3.6, Seraphine -3.2, Sona -3.1, Karma -3.0, Lulu -2.7, Blitzcrank -2.6
  melhores: Kai'Sa +4.6, Ezreal +3.7, Vayne +3.0, Yone +2.4, Smolder +2.3, Akshan +2.3, Shaco +2.2, Pantheon +2.0
- **Milio**, piores: Sona -3.5, Lulu -2.6, Zilean -2.2, Renata Glasc -2.1, Soraka -2.1, Fiddlesticks -2.1, Nami -2.1, Ivern -2.1
  melhores: Ezreal +5.6, Varus +3.2, Kai'Sa +3.1, Jhin +2.9, Vayne +2.8, Caitlyn +2.7, Corki +2.2, Smolder +2.2

## Seu ADC: melhores e piores duplas

- **Soraka**: piores Kai'Sa -4.3, Vayne -3.5, Ezreal -3.3, Miss Fortune -2.9, Smolder -2.8 · melhores Zoe +3.2, Lux +2.6, Zyra +2.5, Hwei +2.5, Syndra +2.5
- **Sona**: piores Ezreal -4.4, Vayne -3.1, Miss Fortune -2.9, Smolder -2.4, Aphelios -2.3 · melhores Zoe +1.6, Katarina +1.4, Veigar +1.2, Tahm Kench +1.1, Syndra +0.9
- **Nami**: piores Ezreal -2.7, Vayne -1.8, Kai'Sa -1.5, Malzahar -1.3, Smolder -1.2 · melhores Seraphine +2.9, Katarina +2.5, Zoe +2.2, Yasuo +1.9, Hwei +1.6
- **Janna**: piores Ezreal -4.0, Vayne -2.4, Miss Fortune -1.9, Kai'Sa -1.9, Smolder -1.8 · melhores Katarina +1.7, Yasuo +1.3, Tahm Kench +1.0, Veigar +0.9, Zoe +0.7
- **Lulu**: piores Ezreal -3.6, Miss Fortune -2.4, Aurelion Sol -1.6, Malzahar -1.4, Brand -1.4 · melhores Twitch +1.3, Jinx +1.3, Katarina +0.8, Zoe +0.7, Yasuo +0.7
- **Milio**: piores Ezreal -3.4, Vayne -2.2, Kai'Sa -2.1, Smolder -1.6, Miss Fortune -1.5 · melhores Veigar +0.7, Yasuo +0.7, Tristana +0.6, Zoe +0.6, Kalista +0.6

## Tags que o modelo inventou

Cada dimensão é um traço que o modelo achou útil e que as tags manuais não cobrem. Os campeões nas pontas mostram o que ele significa; dê um nome.

- **Tag 1**: de um lado Jax, Katarina, Ekko, Irelia, Lee Sin, Vayne, Rakan, Lux; do outro Hecarim, Zac, Lulu, Thresh, Caitlyn, Kha'Zix, Graves, Locke
  peso pra cada sup (inimigo): Soraka +0.00, Sona -0.00, Nami +0.00, Janna +0.00, Lulu +0.00, Milio +0.00
- **Tag 2**: de um lado Yunara, Locke, Yone, Karma, Seraphine, Kayn, Hecarim, Nautilus; do outro Zed, Akali, Jinx, Caitlyn, Irelia, Viego, Sett, Ahri
  peso pra cada sup (inimigo): Soraka +0.00, Sona +0.00, Nami +0.00, Janna -0.00, Lulu +0.00, Milio +0.00
- **Tag 3**: de um lado Zed, Quinn, Jhin, Aatrox, Amumu, Lulu, Gangplank, Janna; do outro Lee Sin, Jinx, Sylas, Jayce, Caitlyn, Riven, Nami, Sona
  peso pra cada sup (inimigo): Soraka +0.00, Sona +0.00, Nami -0.00, Janna -0.00, Lulu -0.00, Milio -0.00
- **Tag 4**: de um lado Kha'Zix, Sivir, Ambessa, Master Yi, Ashe, Elise, Kayle, Vladimir; do outro Kayn, Caitlyn, Yasuo, Katarina, Sion, Sona, Hecarim, Alistar
  peso pra cada sup (inimigo): Soraka -0.00, Sona -0.00, Nami +0.00, Janna +0.00, Lulu -0.00, Milio -0.00

## Campeões que ficam perigosos com elo alto (o efeito Pyke)

Quanto maior, mais o campeão inimigo melhora conforme o jogador sobe de elo.

Vel'Koz +0.00, Vex +0.00, Hwei +0.00, Malzahar +0.00, Poppy +0.00, Akshan +0.00, Ahri +0.00, Braum +0.00, Aurelion Sol +0.00, Skarner +0.00, Viego +0.00, Viktor +0.00, Nunu & Willump +0.00, Gwen +0.00, Aatrox +0.00

Sensibilidade de cada sup a isso: Soraka -0.00, Sona -0.00, Nami +0.00, Janna -0.00, Lulu +0.00, Milio +0.00
