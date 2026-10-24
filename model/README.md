# Modelo de escolha de sup

Responde: **nesse draft, qual a chance de vitória com cada sup?** O app usa isso pra decidir quando trocar a Soraka.

## Decisões (22/10/2026)

1. **Objetivo**: vitória.
2. **Picks**: Soraka, Sona e Nami comparadas só com jogos de mains delas; Janna, Lulu e Milio com todos os jogadores.
3. **O que o modelo enxerga**: os dez campeões e o elo de cada jogador. Cada campeão entra como um conjunto de tags (as do app, mais os traços abaixo) e como tags que o próprio modelo aprende.
4. **Dados**: ranqueada solo do BR, Mestre+ e Diamante 1. O histórico pessoal ajusta por cima, no app, com peso proporcional ao número de jogos.
5. **Exceção**: no Pyke vale a regra da Leticia (bloqueio), porque a qualidade do Pyke inimigo só se sabe depois do draft.

Traços descritos pela Leticia: entra na backline sem janela pro silence (J4, Rengar, Nocturne...), sup de engage, mago de artilharia (a testar), ADC que precisa de lane agressiva (Draven, Kai'Sa, Samira, Lucian), ADC que amplifica cura (Nilah). Ficam em `tags.py`.

## Peças

| Arquivo | O que faz |
|---|---|
| `collect.py` | baixa partidas pela API da Riot; retomável e dentro do limite da chave |
| `tags.py` | tags de cada campeão (lê as do app + os traços acima) |
| `train.py` | treina e gera `out/model.json` e `out/report.md` |
| `fake_data.py` | partidas falsas com efeitos plantados, pra testar sem a API |

O que o modelo soma pra chegar na chance de vitória: base de cada sup, força geral de cada campeão, tags × sup (aliados, inimigos, dupla inimiga do bot, seu ADC), **tags aprendidas** (4 dimensões que o modelo inventa e que o relatório mostra pra você dar nome) e **sensibilidade a elo** (quanto um campeão inimigo fica mais perigoso com o elo do jogador, o efeito "Pyke bom").

A força da regularização é escolhida sozinha pelos jogos mais recentes. A qualidade é medida em jogos que o modelo não viu; num jogo com tanto acaso, AUC de 0,55 a 0,60 já é bom.

## Rodando

No GitHub: o workflow **Coletar partidas e treinar o modelo** roda todo dia e pode ser disparado à mão. Ele precisa do segredo `RIOT_API_KEY`. Os dados e o modelo ficam na branch `data`, e o relatório aparece no resumo de cada rodada.

Local (teste sem API):

```bash
pip install numpy
python model/fake_data.py 20000 4
HELPORO_DATA=model/data_fake python model/train.py
```

## Lane em ouro, sup contra ADC e revisão pós-jogo (v0.4)

- `collect.py` agora guarda as estatísticas finais de cada jogador e, nas partidas com um dos sups do modelo,
  baixa a timeline (ouro, CS e XP aos 10 e 15 min) em `data/gold.jsonl.gz`. Quando sobra tempo na rodada,
  preenche a timeline das partidas antigas. Ele usa o limite real da chave (cabeçalho `X-App-Rate-Limit`).
- `lane.py` gera `out/lane.json`: cada sup contra o sup inimigo, contra o ADC inimigo e junto de cada ADC,
  em winrate e em diferença de ouro da dupla aos 15 min (mede a lane com menos ruído que a vitória).
  Também checa se o ouro aos 15 prevê a vitória e se o efeito do matchup se repete entre metades dos dados.
- `bench.py` gera `out/bench.json`: médias Mestre+/D1 BR por campeão e rota (mortes, visão, controles, CS, dano),
  usadas na revisão pós-jogo do app.
