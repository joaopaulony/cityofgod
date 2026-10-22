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
| Dia / noite | N |
| Novo mapa | G |
| Chat | Enter |

## Como funciona

- **Personagem:** esqueleto 3D invisível com IK de 2 ossos em braços e pernas, pintado em 2D. Animações por poses-chave com antecipação e recuperação (tiro, recuo, recarga com troca de carregador).
- **Mapa procedural:** gerado por semente — ruas curvas, terreno por ruído, florestas por densidade, lago, trilhas, e casas e postes posicionados ao longo das ruas.
- **Desempenho:** chão, árvores, arbustos e pedras são pintados uma vez em canvas fora da tela; a cada quadro só o personagem, os tiros e o balanço do vento são animados.
- **Câmera estilo Zomboid:** segue o jogador, avança na direção da mira e gira em 90°. Paredes são cortadas ao entrar nas casas e telhados ficam translúcidos quando o jogador está atrás.

## Arquivos

- `js/core.js` — câmera, projeção isométrica, entrada e pincéis
- `js/world.js` — gerador do mapa, chão, vegetação e colisão
- `js/houses.js` — casas, móveis e cercas
- `js/skeleton.js` — esqueleto, IK e animação
- `js/character.js` — pintura do personagem e retrato
- `js/hud.js` — HUD (retrato, barras, minimapa, hotbar, mira)
- `js/game.js` — laço principal, tiro, partículas e iluminação noturna
- `js/debug.js` — cenas de teste (`?scene=...`), carregado só para inspeção


## Gerador de assets por IA (Gemini Nano Banana)

Existe agora um fluxo OPCIONAL, fora do jogo, para produzir imagens isometricas com o Google Gemini:

- Guia completo: [tools/gemini/README.md](tools/gemini/README.md)
- Geracao MANUAL em [GitHub Actions](../../actions/workflows/gemini-assets.yml)
- Referencias de imagem em [assets/references](assets/references)
- Sem chave no frontend, sem cobranca em push ou PR e sem publicacao automatica no jogo.
- Para testar SEM gastar creditos, execute o workflow com confirm_spend desmarcado. Para gerar uma imagem, marque confirm_spend (1 geracao paga por execucao).

O projeto está sem veículos nesta fase.
