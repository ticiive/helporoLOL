# helporoLOL

Assistente de draft (meu próprio Porofessor). Lê a seleção de campeões e o meu histórico de partidas direto do cliente do LoL e sugere o pick explicando a nota: no sup, com dados de matchup de Soraka, Sona, Nami, Janna, Lulu e Milio; no fill, pelos campeões que eu já joguei naquela rota.

## O que o app faz

O app tem quatro abas.

- **Draft:** lê a seleção do cliente e sugere bans, picks e runas.
  - **Recomendação em cards, só por dados.** Cada campeão da rota ganha um tier (S a D) naquele draft, três barras (Matchup, Sinergia e Comp) e tags como "Bom contra Senna", "Fraco contra Lux (ADC)", "Bom com Caitlyn", "Responde ao CC deles" e "Seguro de blind".
  - Aparecem o melhor do seu pool e, sempre, opções de fora do pool em tier S. O botão "+ Criar pool" monta o pool por rota.
  - **Sugestão de ban e risco do blind**, considerando quem já foi banido.
  - **Runas, feitiços e itens do Mestre+ BR**, com exportação pro cliente: a página de runas e o conjunto de itens da loja.
- **Coach:** o plano da partida.
  - A condição de vitória, a força do time por minuto e dicas da fase de rotas, do meio e do fim do jogo, específicas do draft.
  - As dicas falam da habilidade que pesa de cada inimigo, com o nome em português e a recarga no nível 1 ("respeite o E (Encanto) de Ahri"), do gank do jungle inimigo, dos níveis 2 e 6, da visão e do roam.
  - Usa os tempos da temporada 2026: minions 0:30, campos 0:55, scuttle 2:55, dragão 5:00, vastilarvas 8:00, Arauto 15:00 e Barão 20:00.
- **Ao vivo** no celular, em qualquer rede (até no 4G): o botão 📱 do app mostra um QR que abre ticiive.github.io/helporoLOL com o canal secreto do seu PC. O app publica a partida nesse canal (ntfy.sh, sem conta, sem nomes de jogador) e a página lê de lá. Também dá pra abrir pela rede de casa em `http://helporo.local:7777`.
  - As dicas da fase em que a partida está e a próxima coisa da linha do tempo, com contagem regressiva.
  - Os timers de objetivo, pelos eventos da partida.
  - O próximo item da build e quanto falta de ouro.
  - Os timers manuais de feitiço e ult, que você toca quando vê.
- **Pós-jogo:** lê a timeline das suas partidas no cliente.
  - Onde e como cada morte aconteceu: zona do mapa, quem matou, se tinha aliado perto e se foi antes de objetivo.
  - O ouro da lane aos 10 e aos 15, as wards (de controle, limpas e antes de cada objetivo) e a comparação com a média Mestre+ do campeão.
  - Um "Treine isto" com o padrão das suas últimas 10 partidas e o replay do minimapa.

## Como a recomendação é calculada (e testada)

A nota de cada campeão tem quatro partes:

| Parte | De onde vem |
|---|---|
| Matchup | Contra o oponente da rota. No sup, é sup contra sup (coleta Mestre+/D1 BR junto com o op.gg) e contra o ADC inimigo (coleta). Cada confronto é centrado na média dos candidatos, então só conta quem vai melhor que os outros. |
| Sinergia | Com o parceiro (sup e ADC, mid ou top e jungle). |
| Comp | O que falta no seu time e o que o time inimigo exige (CC em cadeia, dive, tanques, escalar junto). |
| Meta | Winrate no Mestre+/D1 BR. |

Os pesos (matchup 1, sinergia 0,8, comp 0,4, meta 1,4) foram calibrados num teste com cerca de 24 mil escolhas reais de sup que o cálculo não viu: os dados de lane vêm das partidas mais antigas, e o teste usa as 20% mais recentes. Nesse teste, o tier S ganhou 51,4% e o tier D, 46,3%. Pra repetir o teste: `bash model/backtest/run.sh`.

O ranking antigo (com a regra da main, o histórico pessoal e os pesos ajustáveis) continua no app, recolhido em "Ranking detalhado".

## Estrutura

```
src/engine/draftScore.ts  recomendação por dados (cards, tier, tags, pesos do backtest)
src/engine/coach.ts       dicas por fase; coachData.ts = habilidades que pesam, tempos 2026, defesas dos sups
src/engine/gameplan.ts    curva de força por duração, foco, lutas, pick e split
src/engine/lanedata.ts    lane do sup (coleta Mestre+ BR): contra sup, contra ADC, com ADC, blind e ban
src/engine/botlane.ts     tabelas do op.gg (sup x sup, ADC + sup)
src/engine/engine.ts      ranking antigo (regra da main, histórico pessoal)
src/lib/review.ts         revisão pós-jogo pela timeline do cliente
src/lib/spells.ts         nomes e recargas das habilidades (Data Dragon, pt_BR)
src/lib/lcu.ts            seleção, histórico e partidas pela API local do cliente
src-tauri/src/lcu.rs      API local do cliente (seleção, runas, itens, partidas e timelines)
src-tauri/src/live.rs     página ao vivo na rede de casa (porta 7777): /players, /events, /coach
model/                    coleta (Riot API), treino, builds, lane, scaling, médias e backtest
```

## Como baixar e instalar (Windows)

1. Abra a página da última versão: **[github.com/ticiive/helporoLOL/releases/latest](https://github.com/ticiive/helporoLOL/releases/latest)**
2. Em **Assets**, baixe o arquivo que termina em **`_x64-setup.exe`** (ex.: `helporoLOL_0.1.0_x64-setup.exe`).
3. Abra o arquivo baixado. Como o app não tem assinatura de código paga, o Windows mostra "O Windows protegeu o computador": clique em **Mais informações → Executar assim mesmo**.
4. Siga o instalador (não precisa de administrador; instala só pro seu usuário).
5. Se aparecer um aviso do **WebView2**, aceite: é o componente da Microsoft que desenha a janela do app (o Windows 10 e 11 normalmente já têm).

**Usando:** abra o helporoLOL antes de entrar na fila. Quando a seleção de campeões começar, o draft preenche sozinho e a sugestão aparece no meio. O histórico das suas partidas sincroniza sozinho enquanto o app estiver aberto.

**Firewall:** na primeira vez o Windows pergunta se o helporoLOL pode usar a rede. Marque **Redes privadas** e permita; é isso que deixa o timer abrir no Mac ou no celular.

**Atualizar:** baixe o `_x64-setup.exe` da versão nova no mesmo link e instale por cima; suas configurações e histórico ficam.

### Publicar uma versão nova (pra mim)

O instalador é gerado pelo GitHub Actions quando eu crio uma tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Acompanhe em [Actions → Build do app (Windows)](https://github.com/ticiive/helporoLOL/actions/workflows/release.yml). Em uns 10 a 15 minutos a versão aparece em [Releases](https://github.com/ticiive/helporoLOL/releases). Na próxima, troque o número (v0.1.1, v0.2.0…) e atualize `version` em `package.json` e `src-tauri/tauri.conf.json`.

## Versão web (GitHub Pages)

**[ticiive.github.io/helporoLOL](https://ticiive.github.io/helporoLOL/)**: o draft em modo manual, com ícones e o motor de sugestão, mas sem ler o cliente nem o histórico (isso só o app faz).

Pra funcionar, o Pages precisa estar ligado uma vez: em **[Settings → Pages](https://github.com/ticiive/helporoLOL/settings/pages)**, em **Build and deployment → Source**, escolha **GitHub Actions**. Depois, em [Actions → Publicar no GitHub Pages](https://github.com/ticiive/helporoLOL/actions/workflows/pages.yml), clique em **Run workflow** (ou faça qualquer push na main).

## Desenvolver (Windows)

Precisa de [Node 20+](https://nodejs.org), [Rust](https://rustup.rs) e as [Build Tools do Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/) com "Desenvolvimento para desktop com C++" (o instalador do Rust oferece).

Pra mexer só na interface, em qualquer sistema (inclusive Mac), basta Node: `npm install` e `npm run dev`, depois abra `http://localhost:1420`.

```bash
npm install
npm run tauri dev      # abre o app com recarregamento automático
npm run tauri build    # instalador em src-tauri/target/release/bundle/nsis
```

## Próximos passos

- Script de atualização dos dados (Lolalytics agora; API da Riot depois, com partidas Mestre+ BR)
- Rotas do inimigo: hoje são adivinhadas pelos campeões e bans, porque a ranqueada esconde
- Builds e runas pro pick sugerido

helporoLOL não é endossado pela Riot Games e não reflete as opiniões da Riot Games ou de qualquer pessoa oficialmente envolvida na produção ou gerenciamento das propriedades da Riot Games. Riot Games e todas as propriedades associadas são marcas registradas da Riot Games, Inc.
