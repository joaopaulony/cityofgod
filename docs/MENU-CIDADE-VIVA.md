# City of God — Menu inicial com cidade viva

Atualizado em 10/11/2026, sobre a versão main que recebeu o commit `446799f`.

## Objetivo

O menu principal deve mostrar a cidade e os personagens **reais do jogo** no próprio motor (Canvas 2D + Three.js/WebGL), sem um carrossel de wallpapers PNG/WebP. O personagem fica em evidência à direita, enquanto a coluna de botões permanece à esquerda.

Não são criados modelos, personagens ou animações novos. O figurante opcional é gerado a partir do elenco 3D já existente.

## Mudanças

- `index.html`: removidas as referências de preload dos wallpapers e o logo antigo da marcação inicial. O título é composto por HTML e CSS.
- `css/front-end.css`: a marca do menu usa tipografia local (sem download de fonte); **antes de o jogo estar pronto**, uma composição CSS com silhueta arquitetônica evita tela vazia. Depois do primeiro quadro 3D completo, essa composição desaparece, deixando somente o mundo real e os controles do menu sobre ele.
- `js/front-end.js`: carrega os scripts do jogo no fundo enquanto o menu inicial continua interativo. O progresso original é capturado antes dessa preparação, evitando que dados temporários de subsistemas sejam confundidos com uma partida já jogada. Quando o motor fica pronto, utiliza o mesmo ambiente para iniciar/continuar, sem recarregamento redundante.
- `js/game.js`: substituída a apresentação aérea que se afastava do jogador por câmera cinematográfica mantendo personagem no campo de visão. Quando o save está em veículo/interior, um civil existente do jogo serve de figurante temporário; ele não é salvo e é removido ao começar a jogar. Durante a apresentação, o relógio, os pagamentos de aluguel, fome/sede e checkpoint de partida não avançam. Renderização da vitrine limitada a 30 FPS depois de preparada.

## HUD preservada do commit original

O sistema `css/ui-theme.css` continua sendo a camada visual final. `js/hud.js` passou a desenhar minimapa circular, estado de necessidades conforme o modo discreto/completo, relógio e saldo compactos. `js/hud-dock.js` compõe atalhos em botões redondos. As preferências claro, escuro, automático e HUD discreta/completa continuam salvas em `cityofgod.front.settings.v1`.

### O que NÃO foi alterado

- Nenhuma malha do CAS, veículo ou imóvel foi substituída.
- Nenhuma animação inédita foi introduzida.
- Não foram modificados os dados de aluguel, salário, universidade e economia.
- Nenhuma imagem estática adicional foi criada para o menu.
- Não foi adicionado servidor multiplayer.

## Como verificar

1. Na pasta do repositório, rode `npm start` e abra `http://127.0.0.1:4322`.
2. Observe a tela inicial: não deve ter wallpapers. A marca é textual; enquanto o jogo prepara os modelos, há apenas uma cenografia CSS temporária.
3. Assim que os recursos reais estiverem prontos, as ruas e um personagem devem surgir **atrás dos botões**. O menu continua clicável.
4. Verifique no navegador as configurações Interface > Aparência e HUD; as escolhas devem permanecer após reiniciar.
5. Use **Novo jogo** em uma instalação sem save; não deve aparecer confirmação de apagar um progresso que não existia.
6. Teste **Continuar** com uma partida salva, inclusive se o jogador estava dentro de apartamento ou veículo.
7. Deixe o menu aberto e observe o relógio do jogo: ele deve permanecer congelado.
8. Comece ou continue a partida: o personagem volta à câmera normal e o figurante temporário desaparece.
9. Pause e volte ao título; depois entre novamente. Dinheiro e posição não devem mudar enquanto o jogo está pausado.
10. Repita em uma janela menor ou celular: o menu deve manter foco/teclado e os componentes devem continuar legíveis.

## Testes

```powershell
npm start
# Em outro terminal:
node --test tests/front-live-menu.test.cjs
node tools/test-front-live-browser.cjs
```

O teste de navegador usa Playwright e Chrome/Edge instalado. Gera capturas em `artifacts/front-end-live/`. Para executá-lo, Playwright precisa estar disponível no ambiente de desenvolvimento.

## Limitações e atenção

O navegador **não consegue exibir o motor completo antes de baixar e inicializar os scripts, modelos e setores do mundo**. O primeiro momento é uma composição simples feita em CSS — não uma foto — e será substituída assim que os recursos ficarem prontos. A troca nunca deve interromper Novo jogo, Continuar ou Configurações.

Em um ambiente sem WebGL, com falha de download ou com incompatibilidade entre um save de mapa local e a URL atual, a prévia 3D pode não aparecer. O menu deve continuar acessível para carregar a partida real. A validação visual completa ainda precisa ser feita com o navegador real, pois os testes automatizados de Node não comprovam iluminação, enquadramento e taxa de quadros.
