# Miami: onde parou (para retomar)

## Pedido
Refazer o mundo grande com Miami como referência e o realismo do Project Zomboid, tudo em Canvas 2D: prédios, mansões, casas pobres, hotéis, terreno, texturas, moitas e cercas de arame. Um juiz (subagente) avalia screenshots, e a entrega só acontece quando ele aprovar: média ≥ 7,5 e nenhuma cena abaixo de 6,5.

## Estado
Ainda não aprovado. Notas do juiz por rodada:

| Rodada | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Média | 5,9 | 6,1 | 6,3 | 6,4 | 6,6 | **6,7** |

Notas da rodada 6, por cena:

| Cena | Nota |
|---|---|
| brickell | 6,0 |
| brickell2 | 6,5 |
| southbeach | 7,5 |
| mansion | 6,0 |
| bungalow | 7,0 |
| projects | 7,5 |
| poor | 7,5 |
| beach | 6,0 |
| shore | 6,5 |

## Arquivos
- **`js/miami.js`**
  - Palmeiras: imperial e coqueiro.
  - Arbustos tropicais: hibisco, buganvília, uva-da-praia, cróton.
  - Alambrado: `chainLine`, `drawChainFence`.
- **`js/miami-facades.js`**
  - Fachadas por andar: deco, condo, office, projects, warehouse, shop.
  - Parâmetro `night`.
  - Os lados N e E são espelhados (`facadeMirror`).
- **`js/miami-city.js`**: ocupação por zona (`miaZone`).
  - `miaBuilding`: prédios.
  - `miaMansion`: mansão com pórtico, loggia, piscina, chafariz e entrada circular.
  - `miaHouse`: bangalô e casa pobre.
  - Praia: `miaBeach`.
  - Rua: `miaStreets`, `miaParking`, `miaCrosswalks`.
  - Ocupação de terreno livre: `miaClutter`.
  - Decalques de chão: `paintDecal` e os `paint*`.
  - Cache de desenho: `miaCached`, usado em cercas vivas, carros e torres de salva-vidas.
  - `miaBlocked` ignora o próprio lote, para os objetos caberem dentro dele.
- **Ganchos nos arquivos antigos**
  - `archi.js`
    - `H.facadeFn`.
    - Opções de janela: `S.bars`, `S.boarded`, `S.shutters`.
    - Luz suavizada nas casas Miami.
  - `houses.js`
    - `tex.ppm`.
    - `b.draw` em `drawBox`.
    - `s.chain` em `drawFence`.
    - Sombra de prédio alto.
  - `world.js`
    - `p.draw`.
    - `p.scale`.
    - `topDx` da palmeira.
  - `roofs.js`: itens de laje com `draw` e `flat`.
  - `terrain.js`
    - Etapa `decals` no `finishChunk`.
    - Espuma e cristas de onda.
    - Sem plantas aquáticas no mar.
    - Favela sem grade de cimento.
  - `openworld.js`
    - Chama `miaGenSector`; o gerador antigo de casas está desligado.
    - Roça à beira-mar vira praia ou restinga.
    - Palmeiras e arbustos tropicais.
  - `urban-life.js`: sem chaminés no mundo aberto.
  - `game.js`: palmeiras não soltam folhas (antes travava o loop).

## Rodada 7 (feita, ainda sem juiz)
Tudo da lista da rodada 6 foi implementado:

1. **Sargaço**: faixa contínua e irregular (`paintWrack`), conchas e gravetos maiores.
2. **Praia**
   - Até 16 grupos, espaçamento de 17 m, 5 a 10 conjuntos cada; caixas térmicas variadas e chinelos.
   - Gente em pé na água rasa e nadando em frente aos grupos (`drawWader`, kind `wader`).
3. **Brickell**
   - `miaParking` brickell 0,55; tampas de bueiro; fachada `office` com reflexo e persianas por andar.
   - Abrigos de ônibus com placa BUS e anúncio aceso (`drawBusStop`), bicicletários com bicicletas (`drawBikeRack`), ambos em `miaStreets`.
   - Marquise da portaria com testeira, nome do prédio e duas colunas (`drawMarquee`).
4. **Mansão**
   - Corrigido: a cerca viva da frente fechava as duas entradas de carro; agora abre na linha da cerca, com os pilares do portão nas pontas.
   - Vizinhança mais cheia: `miaClutter` põe palmeiras, maciços de cróton/hibisco/buganvília e cercas vivas baixas nos terrenos livres.
   - Para ver a fachada, gire a câmera em vez de procurar `frontSide` S/E: com `cam.ang = π/4 + k·π/2`, k=0 mostra S e E, k=3 mostra W e S. Ex.: mansão de frente W em 1641,2777, jogador em 1628,2780, k=3.

## Próximos passos
1. Nova rodada de screenshots e juiz (meta: média ≥ 7,5, nenhuma cena < 6,5).
2. Em Brickell as torres tapam a rua em quase todos os ângulos; escolher pontos de print em cruzamentos ou praças.

## Como testar e tirar prints
- Servidor: `preview_start` com o nome `piloto-iso` (porta 4321).
- Prints: o Edge headless não abre nesta máquina; use o painel do navegador visível (oculto, o jogo para de desenhar). O antigo `miashots.mjs` ficava no scratchpad da sessão.
  - Teleporte: `owTeleport(x, y)`.
  - Use `WAIT` de 45 a 70 s para o terreno detalhado terminar.
- Pontos usados:

| Cena | Ponto |
|---|---|
| brickell | 2040,2160 e 1990,2300 |
| southbeach | 2700,2700 |
| mansion | 1655,2770 |
| bungalow | 1200,1920 |
| projects | 1400,2220 |
| poor | 2640,1740 |
| beach | 2716,3092 |
| shore | 2698,3086 |

- Testes Node: todos passam (`node --test tests/*.test.*`, `tests/architecture.test.js`, `tests/vegetation.test.js`).
