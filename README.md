# helporoLOL

Assistente de draft (meu próprio Porofessor). Lê a seleção de campeões e o meu histórico de partidas direto do cliente do LoL e sugere o pick explicando a nota: no sup, com dados de matchup de Soraka, Sona, Nami, Janna, Lulu e Milio; no fill, pelos campeões que eu já joguei naquela rota.

## Como a sugestão é calculada

Cada sup recebe uma nota pela soma de sete fatores, cada um com peso ajustável no app:

| Fator | O que mede |
|---|---|
| Lane | O 2v2 contra o sup inimigo (minha leitura dos kits, que eu corrijo no app) e o ADC inimigo agressivo ou de poke |
| Dados | Winrate de jogo contra o sup inimigo (Lolalytics), puxado pro 50% quando a amostra é pequena |
| Comp | Ameaças do time inimigo (dive, assassinos, hooks, poke, AoE) e o que falta no meu time (frontline, engage, dano mágico) |
| Seu ADC | Sinergia com hipercarry ou ADC de lane agressiva |
| Meta | Tier e winrate da patch |
| Você | Meu histórico com o campeão naquela rota (winrate puxado pro 50% com poucos jogos + conforto pelo volume), lido do cliente e atualizado sozinho; ★ dá bônus pra quem eu quero treinar |
| Blind | Penalidade quando o bot inimigo ainda não apareceu, proporcional a quantos counters fortes cada sup tem |

Lane e Dados são separados de propósito: Soraka tem 52% de winrate de jogo contra Nautilus, mas a lane é muito difícil.

## Timer manual (Mac ou celular)

Com o helporoLOL aberto no PC, abra no Mac ou no celular (mesma rede Wi-Fi) o endereço que aparece no topo do app, tipo `http://192.168.0.10:7777`. Na primeira vez o Windows pergunta se libera o acesso na rede: aceite em **redes privadas**.

A página mostra os inimigos da partida com três quadrados: ult e os dois feitiços. Os campeões e feitiços vêm da API local da partida, mas os timers são manuais: você toca quando vê o feitiço sendo usado. Tempos base, sem runa nem item. Pra testar fora de partida: `http://IP:7777/?demo`.

## Estrutura

```
src/engine/champions.ts   características de cada campeão (flags)
src/engine/data.ts        snapshot do Lolalytics + tabela de lane
src/engine/engine.ts      motor de decisão (pesos ficam no topo do arquivo)
src/lib/ddragon.ts        ícones e lista de campeões (Data Dragon, CDN oficial da Riot)
src/lib/lcu.ts            converte a sessão do cliente em draft e lê o histórico
src/lib/stats.ts          base da temporada + partidas guardadas por conta
src-tauri/src/lcu.rs      lê a API local do cliente (porta e senha do processo ou do lockfile)
src-tauri/src/live.rs     serve a página do timer na rede de casa (porta 7777)
src-tauri/assets/timer.html  a página do timer
```

## Instalar (Windows)

Não precisa instalar nada pra gerar o app: crie uma tag e o GitHub Actions monta o instalador na aba **Releases**.

```bash
git tag v0.1.0 && git push origin v0.1.0
```

Baixe o `helporoLOL_x.x.x_x64-setup.exe` e rode. Como o app não tem assinatura de código paga, o Windows SmartScreen avisa na primeira vez: clique em **Mais informações → Executar assim mesmo**. Depois é só abrir o helporoLOL antes de entrar na fila; quando a seleção começar, o draft preenche sozinho.

## Desenvolver (Windows)

Precisa de Node 20+, Rust (https://rustup.rs) e as Build Tools do Visual Studio com "Desenvolvimento para desktop com C++" (o instalador do Rust oferece).

```bash
npm install
npm run tauri dev      # abre o app com recarregamento automático
npm run tauri build    # instalador em src-tauri/target/release/bundle/nsis
```

## Próximos passos

- Script de atualização dos dados (Lolalytics agora; API da Riot depois, com partidas Mestre+ BR)
- Rotas do inimigo: hoje são adivinhadas pelos campeões, porque a ranqueada esconde
- Builds e runas pro pick sugerido

helporoLOL não é endossado pela Riot Games e não reflete as opiniões da Riot Games ou de qualquer pessoa oficialmente envolvida na produção ou gerenciamento das propriedades da Riot Games. Riot Games e todas as propriedades associadas são marcas registradas da Riot Games, Inc.
