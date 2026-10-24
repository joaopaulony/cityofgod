# City of God — piloto isométrico

Piloto de MMORPG isométrico (câmera 3/4) no navegador, feito só com **Canvas 2D**: sem WebGL, sem engine e sem imagens. Tudo é desenhado por código, no estilo Project Zomboid / GTA2 (formas chapadas de 2–3 tons com contorno de tinta).

![gameplay](gameplay.gif)

## Como rodar

```bash
python -m http.server 4321
```

Abra `http://localhost:4321`. Use `?seed=1234` na URL para repetir um mapa.

## Controles

| Ação | Tecla |
| --- | --- |
| Andar / correr | WASD / Shift |
| Atirar / mirar | Clique / botão direito |
| Recarregar | R |
| Girar câmera | Q / E (ou arrastar com o botão do meio) |
| Zoom | Roda do mouse |
| Mapa completo (roda = zoom, arrastar = mover) | M |
| Dia / noite | N |
| Novo mapa | G |
| Chat | Enter |

## Como funciona

- **Personagem:** esqueleto 3D invisível com IK de 2 ossos em braços e pernas, pintado em 2D. Animações por poses-chave com antecipação e recuperação (tiro, recuo, recarga com troca de carregador).
- **Mapa procedural:** gerado por semente — ruas curvas, terreno por ruído, florestas por densidade, lago, trilhas, e casas e postes posicionados ao longo das ruas.
- **Desempenho:** chão, árvores, arbustos e pedras são pintados uma vez em canvas fora da tela; a cada quadro só o personagem, os tiros e o balanço do vento são animados.
- **Câmera estilo Zomboid:** segue o jogador, avança na direção da mira e gira em 90°. Paredes são cortadas ao entrar nas casas e telhados ficam translúcidos quando o jogador está atrás.

## Mundo grande (padrão)

Abrir `index.html` sem parâmetros carrega o **mundo fixo de 4 × 3,6 km** (~9,2 km² de terra cercada de mar, semente oficial `20261024`): baía com o centro, bairros, três favelas, um conjunto, indústria, porto, duas cidades do interior, fazendas, serra florestal, um rio e **um aeroporto internacional**, ligados por rodovias e ruas orgânicas.

O jogo começa com o personagem **desembarcando no saguão do aeroporto**, como um passageiro chegando de viagem: terminal com check-in, bancos e esteira de bagagem, avião no pátio e um carro na frente para seguir até a cidade.

- O mapa é gerado em **setores de 256 m** em volta do jogador (raio de 230 m), em passos curtos por quadro; setores distantes são descarregados. Cada setor tem semente própria e sai igual em qualquer ordem.
- Casas, móveis, cercas, árvores, postes e lixo vêm dos mesmos geradores do mapa local; o terreno ganhou lavouras, pisos urbanos, cais, areia de praia e pistas de pouso.
- `atlas.html` mostra o mapa inteiro (`?demo=stream` mostra o streaming). No console, `owTeleport(x, y)` leva o jogador a qualquer ponto.
- `?seed=N` (ou a tecla **G**) abre o **mapa local de teste** de 160 m, usado pelos testes e pelas cenas de depuração.

## Arquivos

- `js/core.js` — câmera, projeção isométrica, entrada e pincéis
- `js/world.js` — gerador do mapa, chão, vegetação e colisão
- `js/houses.js` — casas, móveis e cercas
- `js/skeleton.js` — esqueleto, IK e animação
- `js/character.js` — pintura do personagem e retrato
- `js/hud.js` — HUD (retrato, barras, minimapa, hotbar, mira)
- `js/worldmap.js` — minimapa nítido (vias e prédios vetoriais) e mapa completo na tecla M
- `js/game.js` — laço principal, tiro, partículas e iluminação noturna
- `js/debug.js` — cenas de teste (`?scene=...`), carregado só para inspeção
- `js/worldgen/` — geografia, vias, marcos e streaming do mundo grande; `atlas-paint.js` pinta o mapa usado pelo atlas e pelo jogo
- `js/openworld.js` — liga o mundo grande ao jogo (setores, campos do terreno, descarga)


## Estado dos veículos

Os veículos, arquivos de arte e sistemas de direção foram retirados do protótipo. O restante do mapa permanece intacto. Uma nova implementação poderá ser planejada do zero.
