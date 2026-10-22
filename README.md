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

A página mostra os inimigos da partida com três quadrados: ult e os dois feitiços. Os campeões, os feitiços e o tempo de partida vêm da API local da partida; os timers são manuais: você toca quando vê o feitiço sendo usado, e embaixo aparece o horário da partida em que ele volta, pra mandar no chat. Feitiços com tempo base; ult com o nível atual e uma aceleração média estimada pelo tempo de jogo (sem ler item nem runa). Pra testar fora de partida: `http://IP:7777/?demo`.

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
