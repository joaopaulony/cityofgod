# URBAN INK — CARTOON

Identidade visual cartoon 3D do mundo do City of God: luz em faixas, cores chapadas e um traço **fino e delicado**
(tingido pela cor de baixo, não preto chapado) que fica mais leve quando a câmera se afasta. Personagens humanos
não mudam. O estilo original continua disponível para comparação (Configurações → Vídeo → URBAN INK — CARTOON).

## Como funciona

| Parte | Arquivo | O quê |
|---|---|---|
| Sistema central | `js/urban-ink.mjs` | toon em faixas nos shaders de luz do Three (instalado uma vez, controlado por um uniform compartilhado), passe único de traço em tela cheia, saturação/contraste |
| Renderizador | `js/vehicle-webgl.mjs` | `urbanInk.render()` no lugar de `renderer.render()` quando ligado; luz do modo (menos céu, mais sol); `applyInk(settings)` |
| Pessoas | `js/character-webgl.mjs` | só `root.userData.inkHuman = true` — o modelo não muda; o passe zera o toon e o traço nelas |
| Chão 2D | `js/terrain.js` | sem textura fotográfica nem sujeira miúda no modo ink, paleta da referência, traço no meio-fio, calçada (placas) e água — também nos workers |
| Chão GPU | `js/ground-gpu.js` | mesmo traço e cor chapada |
| Menu | `js/front-end.js`, `js/front-state.js` | liga/desliga, contorno, espessura, toon, saturação, contraste, qualidade; salvo no `localStorage` |
| Filtros CSS | `index.html` | no modo ink a saturação vem do passe (sem empilhar filtros) |
| Capturas/medição | `tools/urban-ink-capture.js` | cenas fixas (`house`, `interior`, `dusk`, `night`, `noon`), `inkShot`, `inkBench` |

### Por que é leve

* A render target é de **8 bits já em cor de tela** e é tratada como saída final: o Three usa **os mesmos programas
  de shader** do estilo original (91 programas nos dois modos). Nada para compilar ao ligar/desligar, metade da
  memória de uma render target de ponto flutuante, sem passe de tone mapping.
* Nenhuma malha duplicada para contorno, nenhum material trocado: instancing, LOD e cache intactos.
* O traço é um único passe de tela cheia com 4 amostras de vizinhança (8 só na qualidade "Qualidade").
* Copas: só a silhueta externa (teste de cobertura), nunca folha por folha; respeita o pontilhado de vegetação vazada.

## Métricas (cena `house`, mesma câmera, 807×734, densidade 0,9)

| | Original | Ink — Equilibrada | Ink — Desempenho |
|---|---|---|---|
| Quadro (média) | 28,6 ms | 30,9 ms | 30,2 ms |
| Draw calls | 486 | 487 | 487 |
| Triângulos | 773 200 | 773 202 | 773 202 |
| Programas de shader | 91 | 91 | 91 |
| Geometrias / texturas | 453 / 207 | 453 / 207 | 453 / 207 |

Ambiente de teste lento (navegador embutido, ~35 fps no original); a diferença de quadro está perto do ruído da medição.
Repetir: carregar `tools/urban-ink-capture.js` no console e rodar `await inkScene('house'); await inkBench(120)`.

## Capturas (mesma cena e câmera)

`docs/screenshots/urban-ink/`: `rua-*`, `interior-*` (referência 1), `noite-*`, `fim-de-tarde-urban-ink`,
`neve-urban-ink`, `perto-urban-ink`.

## Limites conhecidos

* Pisos dos lotes (caminhos e garagens pintados por `houses.js`) ainda usam a textura fotográfica.
* Telhados mantêm a textura de telhas (só mais suave).
* O jogo não tem chuva; a neve foi conferida.
* Traço das copas desligado na qualidade "Desempenho".
