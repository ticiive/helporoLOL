# Relatório do modelo

Amostras por sup: {'Lulu': 19566, 'Milio': 12117, 'Janna': 14966, 'Nami': 8335, 'Sona': 6103, 'Soraka': 4551}

## Qualidade (jogos mais recentes, que o modelo não viu)

- Perda do modelo: 0.6909 (só a média do sup: 0.6927; menor é melhor)
- AUC: 0.534 (0,5 = chute; num jogo com tanto acaso, 0,55 a 0,60 já é bom)
- Só o draft (sem a diferença de elo, que o app não sabe na seleção) é o que vale acima. Com o elo: AUC 0.629.
- O app só usa o modelo quando o draft sozinho bate a média do sup.

## Inimigos do bot que mais mudam o jogo de cada sup

Efeito em pontos de winrate quando o campeão é o sup ou o ADC inimigo, em relação à média.

- **Soraka**, piores: Katarina -4.9, Sona -4.4, Annie -4.2, Fiddlesticks -4.2, Seraphine -3.9, Nami -3.5, Sylas -3.3, Bard -3.3
  melhores: Ezreal +4.7, Smolder +3.7, Vayne +3.6, Kai'Sa +2.9, Varus +2.6, Xayah +2.4, Yunara +2.4, Kog'Maw +2.3
- **Sona**, piores: Thresh -2.4, Sona -2.3, Lulu -1.8, Seraphine -1.8, Soraka -1.7, Taric -1.7, Alistar -1.7, Leona -1.7
  melhores: Ezreal +3.8, Kai'Sa +3.4, Samira +2.5, Smolder +2.4, Vayne +2.4, Malzahar +2.3, Miss Fortune +2.2, Caitlyn +1.8
- **Nami**, piores: Katarina -4.4, Thresh -4.2, Amumu -4.1, Leona -4.0, Sona -3.8, Galio -3.7, Alistar -3.7, Blitzcrank -3.5
  melhores: Ezreal +4.3, Kai'Sa +3.2, Smolder +2.8, Vayne +2.7, Varus +2.3, Samira +2.0, Caitlyn +2.0, Corki +2.0
- **Janna**, piores: Sona -2.8, Thresh -2.7, Leona -2.5, Lulu -2.2, Nami -2.2, Soraka -2.1, Alistar -2.0, Rakan -1.9
  melhores: Ezreal +4.1, Kai'Sa +3.0, Smolder +2.0, Varus +2.0, Samira +2.0, Vayne +2.0, Jhin +1.8, Mel +1.7
- **Lulu**, piores: Rakan -3.2, Nami -3.0, Seraphine -2.4, Thresh -2.4, Leona -2.3, Sona -2.3, Karma -2.2, Lulu -2.1
  melhores: Kai'Sa +3.4, Ezreal +3.1, Yone +2.7, Smolder +2.2, Vayne +2.2, Camille +1.8, Akshan +1.7, Pantheon +1.7
- **Milio**, piores: Sona -2.8, Thresh -2.3, Nami -2.3, Lulu -2.2, Fiddlesticks -2.1, Soraka -2.0, Katarina -1.9, Janna -1.7
  melhores: Ezreal +5.1, Kai'Sa +3.1, Varus +3.0, Smolder +2.7, Vayne +2.7, Corki +2.4, Jhin +2.4, Caitlyn +2.3

## Seu ADC: melhores e piores duplas

- **Soraka**: piores Kai'Sa -4.1, Ezreal -3.5, Smolder -3.1, Vayne -3.0, Miss Fortune -2.1 · melhores Katarina +2.4, Hwei +2.1, Syndra +1.9, Zyra +1.9, Lux +1.8
- **Sona**: piores Ezreal -3.6, Miss Fortune -2.3, Smolder -2.2, Vayne -2.2, Ashe -1.6 · melhores Katarina +1.8, Seraphine +1.5, Syndra +1.3, Hwei +1.1, Veigar +0.7
- **Nami**: piores Ezreal -2.9, Smolder -2.2, Kai'Sa -2.1, Vayne -2.1, Miss Fortune -1.4 · melhores Katarina +2.9, Seraphine +2.5, Hwei +2.2, Swain +1.8, Syndra +1.7
- **Janna**: piores Ezreal -3.7, Smolder -2.2, Kai'Sa -2.1, Vayne -2.1, Varus -1.7 · melhores Katarina +1.6, Yasuo +1.0, Veigar +0.7, Hwei +0.5, Jinx +0.5
- **Lulu**: piores Ezreal -3.4, Malzahar -1.8, Miss Fortune -1.7, Mel -1.4, Varus -1.3 · melhores Jinx +1.5, Twitch +0.9, Katarina +0.9, Yasuo +0.6, Veigar +0.6
- **Milio**: piores Ezreal -3.3, Smolder -2.0, Vayne -1.9, Kai'Sa -1.9, Malzahar -1.5 · melhores Tristana +0.9, Katarina +0.8, Veigar +0.8, Hwei +0.7, Jinx +0.6

## Tags que o modelo inventou

Cada dimensão é um traço que o modelo achou útil e que as tags manuais não cobrem. Os campeões nas pontas mostram o que ele significa; dê um nome.

- **Tag 1**: de um lado Caitlyn, Jinx, Tristana, Ekko, Master Yi, Zac, Malphite, Hecarim; do outro Ahri, Ezreal, Seraphine, Yasuo, Hwei, Darius, Ashe, Graves
  peso pra cada sup (inimigo): Soraka +0.00, Sona -0.00, Nami -0.00, Janna -0.00, Lulu +0.00, Milio -0.00
- **Tag 2**: de um lado Fizz, Graves, Riven, Corki, Varus, Master Yi, Lulu, K'Sante; do outro Zed, Jhin, Locke, Karma, Hecarim, Yasuo, Malphite, Gangplank
  peso pra cada sup (inimigo): Soraka -0.00, Sona +0.00, Nami +0.00, Janna -0.00, Lulu +0.00, Milio -0.00
- **Tag 3**: de um lado Amumu, Akali, Jayce, Fizz, Nami, Kassadin, Fiora, Alistar; do outro Karma, Talon, Kayle, Lee Sin, Ahri, Yunara, Kai'Sa, Master Yi
  peso pra cada sup (inimigo): Soraka +0.00, Sona -0.00, Nami +0.00, Janna -0.00, Lulu +0.00, Milio +0.00
- **Tag 4**: de um lado Lucian, Sivir, Kayle, Brand, Ambessa, Kassadin, Yuumi, Nasus; do outro Jinx, Karma, Yunara, Sion, Milio, Karthus, Vladimir, Yasuo
  peso pra cada sup (inimigo): Soraka -0.00, Sona +0.00, Nami +0.00, Janna +0.00, Lulu +0.00, Milio -0.00

## Campeões que ficam perigosos com elo alto (o efeito Pyke)

Quanto maior, mais o campeão inimigo melhora conforme o jogador sobe de elo.

Fizz +0.00, Nautilus +0.00, Naafiri +0.00, Jinx +0.00, Graves +0.00, Renekton +0.00, Nidalee +0.00, Yone +0.00, Rell +0.00, Zyra +0.00, Jax +0.00, Singed +0.00, Viego +0.00, Vi +0.00, Kha'Zix +0.00

Sensibilidade de cada sup a isso: Soraka -0.00, Sona +0.00, Nami -0.00, Janna +0.00, Lulu +0.00, Milio -0.00
