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
