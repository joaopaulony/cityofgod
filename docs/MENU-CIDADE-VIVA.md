# City of God — abertura BETA e sobrevoo da cidade real

## Tela de apresentação
- Logo original: assets/menu/v1/logo.webp, sem substituição tipográfica.
- Até a prévia estar pronta, uma única imagem existente: assets/menu/v1/avenida-noturna.webp; não há carrossel.
- A imagem exibe o logo em tamanho grande, o selo BETA e JOGO EM DESENVOLVIMENTO.
- A indicação BETA também aparece no topo do menu depois que o mapa entra.
- Quando o setor urbano estiver pronto e o WebGL inicializado, a imagem desaparece por transição CSS.

## Câmera de drone
- Observa a cidade em OW.geo.anchors.downtown e pontos próximos de OW.cw.roads.
- Zoom afastado, ângulo quase vertical, deslocamento suave e giro lento.
- Nunca centraliza o personagem. Não cria figurantes nem altera a localização salva.
- O streaming acompanha drone.x e drone.y, não a posição do personagem.
- A revelação depende de previewReady(), que confirma a geração do setor.
- Vitrine limitada a aproximadamente 30 FPS e relógio de gameplay congelado.

## Entrar na partida
- O save não é sobrescrito enquanto o usuário permanece no menu.
- Se o jogador estiver salvo longe do drone, needsPlayerSector() identifica o cenário ausente.
- preparePlay() aguarda o carregamento da região salva antes de liberar os controles.
- Depois do carregamento, a câmera retorna imediatamente ao personagem sem atravessar regiões vazias.
- HUD, celular, CAS, economia e opções do jogo seguem sem alterações.

## Verificação
- Teste de regressão: node --test tests/front-live-menu.test.cjs
- Servidor local: npm start
- Teste visual opcional com Playwright: node tools/test-front-live-browser.cjs
- Prints do teste: artifacts/front-end-live/apresentacao-beta.png, drone-cidade-viva.png e jogo-normal.png.
- Também conferir Continuar, Novo Jogo, pausa, configurações e viewport de celular.

## Limitações
- O mapa só pode aparecer depois de carregar scripts, WebGL e os setores necessários; até lá, a imagem BETA permanece.
- Build e testes de Node não validam por si só o resultado visual no navegador.