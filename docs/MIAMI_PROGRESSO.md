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

## Próximos passos (lista da rodada 6 do juiz, ainda não feita)
O patch da rodada 7 foi preparado e cancelado; precisa ser refeito:

1. **Sargaço**
   - Faixa contínua e irregular em vez de traços paralelos (`paintWrack`).
   - Conchas e gravetos maiores.
2. **Praia**
   - Grupos maiores e mais próximos: até 16 grupos, espaçamento de 17 m, 5 a 10 conjuntos cada.
   - Caixas térmicas variadas e chinelos.
   - Pessoas em pé na água.
3. **Brickell**
   - Mais carros: `miaParking`, brickell 0,55.
   - Tampas de bueiro, bicicletários, pontos de ônibus.
   - Fachada `office` variando por andar, com persianas.
   - Pódio ou marquise visível na portaria.
4. **Mansão**
   - Escolher uma posição de screenshot em que a fachada da frente apareça: `frontSide` S ou E.
   - Vizinhança menos vazia em volta do lote.
5. Depois: nova rodada de screenshots e juiz.

## Como testar e tirar prints
- Servidor: `preview_start` com o nome `piloto-iso` (porta 4321).
- Prints são feitos com `miashots.mjs` em um Chrome headless; o script ficava no scratchpad da sessão.
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
