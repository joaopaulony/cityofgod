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

### Chão mais leve no modo Urban Ink

O chão tem duas camadas: o chão da GPU (`ground-gpu.js`, desenhado na hora) e, por cima, blocos de 16×16 m pintados
pixel a pixel pela CPU (`terrain.js`). No modo Urban Ink:

* **Sem fotos do chão:** as 7 texturas fotográficas do chão não são baixadas (nem pelo chão 2D nem pelo da GPU) e o
  chão não é mais jogado fora e repintado quando elas chegam. Só baixam se o estilo original for ligado.
* **Já nasce no estilo salvo:** o chão não é pintado no estilo original para ser descartado logo em seguida.
* **Meia resolução:** blocos a 28 px/m (cores chapadas não precisam de 56): ¼ dos pixels e da memória.
* **Sem piso escondido:** o piso 2D debaixo das casas 3D (coberto pelo piso 3D) não é pintado.
* **Chão da GPU só quando aparece:** com todos os blocos da vista prontos, ele não é desenhado.

| Chão | Original | Urban Ink |
|---|---|---|
| Pintar 1 bloco | 260–420 ms | ~100 ms |
| Memória por bloco | 3,1 MB | 0,8 MB |
| Chão da tela pronto após teleporte | ~7,7 s | ~3,5–3,9 s |
| Fotos do chão baixadas | 7 | 0 |
| Chão da GPU com a vista pronta | todo quadro | 0 quadros (100 de 100 pulados) |

Com o jogo parado, o quadro continua dominado pelo desenho 3D: 24,4 ms no original contra 26,7 ms no Urban Ink (o
passe do traço). O ganho do chão aparece ao entrar no jogo, ao teleportar e ao andar/dirigir para áreas novas.

### Sombra do sol em cadência

O passe de sombra redesenha ~300 objetos por quadro (mais da metade de todos os desenhos) e custava ~4,3 ms — o
tamanho do mapa não importa (2048 ou 1024 dão o mesmo tempo). No Urban Ink, a pé, a sombra é refeita **um quadro sim,
um não** (qualidade "Desempenho": 1 a cada 3). O mapa guardado continua preso ao mundo, então casas, árvores e postes
não mudam; só o que se move atrasa 1 quadro (centímetros a pé). Dirigindo, volta a ser todo quadro.

| Mesma cena, mesmo instante | Original | Urban Ink (equilibrada) |
|---|---|---|
| Quadro (média) | 24,8 ms (densidade 0,7) | **23,0 ms** (densidade 0,9) |
| Quadro com espera da GPU | 28,6 ms | **27,1 ms** |
| Draw calls por quadro (média) | 450 | **283** |
| Programas de shader | 89 | 89 |

O Urban Ink ficou mais leve que o original mesmo desenhando com mais resolução (a resolução dinâmica baixou o original
para 0,7 e manteve o Urban Ink em 0,9).

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
