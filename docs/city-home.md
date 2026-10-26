# City Home — modo Decoração e Compra

O jogador deve entrar em uma casa comprada, abrir o modo Decoração com F7 ou pelo botão "Modo Decoração" e editar somente os interiores de imóveis próprios.

## Interface
- Loja Bellavista Home: móveis 3D do catálogo existente, pagos com a carteira do jogo.
- Estoque por imóvel: comprar entrega ao estoque; guardar remove do ambiente sem perder o item.
- Ambientes: clique para selecionar e arrastar, R = girar 45°, Shift+R = ajuste fino, Enter = confirmar, Delete = guardar, Esc = cancelar ou sair.
- Ctrl+Z = desfazer mudanças de decoração (não desfaz compras e vendas para evitar exploits).
- Scroll = zoom; botão direito + arrastar = mover câmera; Q/E = girar câmera.
- Grade de 0,5 m e prévia verde/vermelha validando portas, paredes, cômodos, andares e móveis existentes.
- Botão por andar (andar do jogador restaurado ao sair).

## Arquitetura

- js/city-home.js: catálogo, operações econômicas, persistência por imóvel, checagem de colisões e reconstrução dos segmentos.
- js/city-home-ui.js: interação, painel e câmera do editor.
- css/city-home.css: apresentação.
- js/city-realty.js: compra inicializa os móveis já instalados, sem cobrar por eles.
- js/props-3d.mjs: posicionamento manual não sofre o giro automático dos móveis antigos.

Os 21 tipos principais de móveis reutilizam o catálogo 3D instanciado já existente no jogo.

## Salvar e carregamento procedural

A primeira visita a imóvel comprado transforma os móveis interiores reconhecidos em patrimônio inicial, mantendo suas posições e cores. Cada imóvel tem uma chave derivada da semente do mundo e de sua porta. Os registros são versionados na chave local cityofgod.home-furniture.v1.

Ao descarregar e recriar um setor, a decoração é restaurada. Objetos 3D, segmentos de colisão, versão do mundo, interações e referências de ownership do setor são atualizados.

## Limites e segurança

Nesta versão, a propriedade, dinheiro e decoração são dados locais no navegador: NÃO existe sincronização entre contas ou dispositivos, proteção multiplayer ou autoridade server-side. Se o usuário limpar o armazenamento do navegador, perde os dados. Para multiplayer, a autorização de propriedade e operações monetárias devem migrar ao backend, com transações atômicas.

- Até 220 peças por casa.
- Compra/venda não podem ser desfeitas para evitar exploração da economia.
- Não altera interiores de prédios públicos ou casas de outros jogadores.
- Não gera novos modelos/GLBs: usa as geometrias já existentes.

## Testes

Executar node --test tests/city-home.test.cjs e a suíte do GitHub Actions. A validação de interface é principalmente estrutural; inspecionar seleção por mouse, andares, colisão e desempenho visualmente no navegador.

## Acabamento e encaixe de móveis — rodada de polimento

- A tolerância para encostar os móveis nas paredes agora é de aproximadamente 2,5 cm, e o afastamento entre móveis alinhados fica em aproximadamente 2,4 cm.
- O alinhamento magnético funciona no sistema de coordenadas da propriedade, inclusive em casas com rotação no mundo.
- As portas são verificadas pela localização das aberturas no plano arquitetônico, e não por um raio grande ao redor da parede.
- A aproximação é uma sugestão de posicionamento: nunca supera colisões reais ou autorização do proprietário.
- Móveis com superfície customizável ganharam cor no catálogo e são entregues na tonalidade escolhida. A escolha também é persistida no estoque da residência.
- As miniaturas usam o modelo 3D procedural real do mobiliário, fotografado de uma câmera ortográfica isolada, com luzes e fundo transparente.
- As imagens são geradas progressivamente, duas por quadro, com cache limitado e descarte das geometrias temporárias. Há fallback com ícones identificáveis quando WebGL não puder produzir uma prévia.
- A interface permite escolher uma paleta de seis tons ou abrir o seletor de cor personalizada antes de comprar. O preço permanece o mesmo para os acabamentos disponíveis.

## Testes desta rodada

Executar:
- node --test tests/city-home.test.cjs tests/city-home-polish.test.cjs
- npm run build:site

Os testes automatizados checam encaixe em casas rotacionadas, passagem de portas, cor e saldo após compra, persistência e ponte com o renderizador. Recomenda-se também conferir o aspecto das miniaturas, zoom e paredes dentro da casa em um navegador real.
