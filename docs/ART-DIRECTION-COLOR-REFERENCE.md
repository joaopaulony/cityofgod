# Direção de arte oficial — Cidade Ilustrada (v1)

**Referência visual:** imagem isométrica enviada pelo criador em 23/10/2026, contendo casa com interior visível, loja de conveniência 24/7, veículos, vegetação urbana e asfalto. Esta referência representa **cores, iluminação e atmosfera**, e não autoriza a reprodução dos sprites, prédios ou conteúdo da imagem.

## Paleta de aprovação
| Uso | Âncora RGB | Intenção |
| --- | --- | --- |
| Asfalto | `#393536` | Carvão quente e suave, com remendos mais escuros |
| Calçadas | `#c5b6a5` | Pedra clara, levemente bege, iluminada pelo sol |
| Grama | `#52782e` | Verde vivo, natural, sem fluorescência |
| Sol na grama | `#789c3d` | Amarelo-esverdeado vibrante |
| Folhagem na sombra | `#192b19` | Verde profundo, preservando o volume das folhas |
| Folhagem iluminada | `#a3bc65` | Verde-amarelo quente e brilhante |
| Paredes rebocadas | `#dcc3a9` | Bege quente em paredes externas |
| Paredes frias | `#bec4b8` | Contraste mineral cinza esverdeado |
| Telhas de cerâmica | `#a6543e` | Terracota, não vermelho neon |
| Sombra de telhados | `#523d3b` | Marrom-carvão |
| Contornos | `#201b1b` | Sombra tinta, mais profunda |
| Luz solar | `#ffe3b2` | Dourado quente de manhã / tarde |

O código-fonte autorizado é `js/visual-palette.js` (`VISUAL_REFERENCE`). 
`terrain.js`, `world.js` e `archi.js` consomem essa paleta diretamente.
A interface usa filtros CSS discretos nas camadas `#view` (Canvas 2D) e `#vehicle3d` (Three.js). Não alterar máscaras WebGL, física, modelos GLB, PNGs, texturas procedurais nem contagens de folhas.

## Regras do juiz visual
- A paleta central deve continuar disponível, com **o mesmo ID**, e os tons de cada grupo devem respeitar contraste e luminosidade entre claro/escuro.
- A malha de terreno continua procedural; apenas a mistura de cores muda.
- Cada árvore mantém formas, seis tons de folhas e geometria — sem substituição de assets.
- Arquitetura mantém a textura gerada (rachaduras, argamassa, sombreamento), alterando somente as tintas.
- As camadas Canvas 2D e GLB têm grading coordenado, sem re-render em sprite.
- O juiz de `tests/visual-quality-judge.cjs` recebe métricas extraídas do navegador pelo `tests/vegetation-browser.cjs`. 
- Executar `node --test tests/reference-palette.test.cjs` antes de mudar qualquer cor e revisar a captura `artifacts/cityofgod-official-daylight-palette.png` no CI.

## Limites
A referência é uma ilustração muito detalhada. Um ajuste cromático não cria novos móveis, fachadas, personagens, veículos ou texturas; o objetivo deste PR é apenas a **identidade de cor** e contraste.
