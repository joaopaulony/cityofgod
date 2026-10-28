# City of God — direção de abertura aprovada

## Aprovação

O nome permanece **City of God**. A identidade mistura o clima tropical e o neon de Vice City com o calor dos bairros de San Andreas. A vida urbana é o tema principal, equilibrado com casas, cotidiano e pets. A proposta ilustrada `artifacts/menu-source/v1/conceito-aprovado.png` foi aprovada pelo usuário nesta conversa.

**Estado desta etapa:** identidade aprovada e implementada. A tela inicial usa a logo separada e três fundos otimizados. Menu, carregamento real, pausa, configurações, créditos e o aviso de multiplayer estão conectados ao jogo.

## Identidade

- Logo em letras compactas de grande peso, marfim, contorno muito escuro, `OF` coral e silhuetas de palmeiras/prédios.
- Ilustração com contornos desenhados, sombras de cor e detalhes urbanos; consistência de personagens entre as cenas.
- Entardecer coral e âmbar, sombras azul-petróleo; ciano e magenta discretos nas cenas noturnas.
- Menus verticais, textos claros, opção selecionada em dourado e seta. Evitar cartões arredondados e linguagem de aplicativo.
- Logo, botões, dicas e indicador de progresso separados dos fundos. As artes de produção não contêm interface ou textos.

## Assets preparados

| Arquivo em `assets/menu/v1/` | Uso |
| --- | --- |
| `logo.webp` | Logo com transparência real |
| `bairro-entardecer.webp` | Fundo principal; espaço mais escuro à esquerda para a interface |
| `avenida-noturna.webp` | Arte de loading: carros, bairro e encontro na rua |
| `cotidiano-em-casa.webp` | Arte de loading: cozinha, casa, Yorkshire e Siamês |
| `manifest.json` | Dimensões, tamanho dos arquivos e finalidade |

Os PNGs originais ficam em `artifacts/menu-source/v1/`. Geração feita com a ferramenta integrada `image_gen`; prompts em `artifacts/menu-source/v1/prompts.json`. `tools/prepare-menu-assets.cjs` somente converte o formato e valida a transparência, sem redesenhar as artes.

## Fluxo implementado

1. **Abertura:** a identidade aparece diretamente no título, com movimento de fundo discreto que pode ser desativado. A cidade ainda não é instanciada; não existe uma animação obrigatória atrasando a entrada.
2. **Menu inicial:** Continuar, Novo jogo, Configurações e Créditos. Continuar só fica disponível quando existir um estado recuperável. Novo jogo deve ter um fluxo explícito que preserve ou confirme a substituição do progresso existente.
3. **Loading:** ilustrações alternam durante o carregamento e dicas descrevem mecânicas existentes. O indicador considera ilustrações, scripts, mundo, veículo, personagens e o primeiro quadro válido. Não usa um relógio para inventar porcentagem e não prolonga artificialmente a espera para exibir todas as artes.
4. **Entrada na cidade:** liberar controles apenas após um primeiro quadro válido. Suavizar a saída da música de menu e a entrada dos sons do jogo.
5. **Pausa por Esc:** Continuar, Mapa, Configurações e Voltar ao menu inicial. Pausar a simulação e liberar corretamente o teclado/mouse ao fechar.

6. **Multiplayer — em breve:** abre uma apresentação da futura conexão entre jogadores. A tela informa explicitamente que a versão atual é local e que não há servidores, salas ou conexão online. Nenhum endpoint ou formulário de login fictício é utilizado.

## Configurações conectadas

- Vídeo: resolução 3D/sombras em Desempenho, Equilibrada e Alta, além de brilho aplicado aos dois canvases da cidade.
- Áudio: volume geral, trilha original sintetizada do menu, sons de interface e buzina. O áudio só inicia após interação do usuário.
- Controles: lista dos atalhos reais; não apresenta remapeamento sem suporte.
- Interface: redução de movimento do fundo e das transições; respeita também `prefers-reduced-motion`.
- Acesso por mouse e teclado, foco visível e layouts adaptáveis a telas menores.

Não exibir controles decorativos que não alterem o funcionamento do jogo.

## Expansão do conjunto de artes

Para chegar às seis cenas sugeridas no planejamento, completar com chegada pelo aeroporto, uma avenida em circulação e decoração/vida na varanda. Manter os mesmos personagens, o veículo coerente com o catálogo e atividades presentes no jogo. Preparar recortes para diferentes proporções sem cortar o assunto principal ou sacrificar a leitura da interface.

## Continuidade e proteção do progresso

`cityofgod.front.save.v1` guarda mapa, posição, andar e relógio, aproveitando os saves existentes de economia, imóveis, móveis e pets. Ao dirigir, guarda também o veículo ativo, sua direção, combustível, pintura, motor e faróis; a retomada mantém o carro parado para evitar movimento durante o loading. Há gravação a cada três segundos, ao perder o foco, ocultar a aba, pausar, voltar ao título e sair da página. Transições de escada preservam o último checkpoint estável.

Trocar de aba congela a simulação sem abrir o menu. A sessão da mesma aba retoma automaticamente após recarregamento ou descarte pelo navegador; voltar ao título explicitamente encerra essa retomada automática. A região salva termina de gerar antes de validar colisões e recuperar o andar. Falhas de restauração preservam o checkpoint, e falhas no salvamento de outros sistemas não impedem a gravação independente da posição. A música do menu cancela automações de volume e desconecta seu canal durante a partida e a pausa; ocultar a aba também a silencia.

Continuar reconhece também um save legado válido de `cityofgod.life.v1`. Quando necessário, recupera o mapa local pela semente. Novo jogo pede confirmação se já existir progresso, preserva configurações e escreve/verifica `cityofgod.front.backup.v1` antes de remover saves antigos. A substituição acontece antes de instanciar os sistemas para impedir que listeners da partida anterior regravem dados sobre a nova.

Falhas e arquivos que não respondem apresentam uma tela com nova tentativa. Tentar novamente uma continuação não inicia silenciosamente uma nova partida. O carregamento mantém entrada de teclado e mouse bloqueada até os sistemas e o primeiro quadro estarem prontos.

## Verificação

- `node --test tests/front-end.test.cjs`: validação, continuidade, reset com backup, scripts sob demanda e assets.
- `tools/test-front-browser.cjs`: título sem instanciar a cidade, multiplayer, configurações, carregamento real, pausa, mapa, retorno ao título, continuação após reload, confirmação de novo jogo, tela móvel e falha/repetição sem perder save legado. Usa Playwright e Edge em um contexto isolado.
- `tools/test-session-browser.cjs`: eventos de ocultação e foco, retomada após reload, região distante, continuação explícita, checkpoint dirigindo, falha de subsistema e desconexão real do áudio. `CITY_TEST_URL` seleciona a versão a validar em ambos os testes de navegador.
- `artifacts/front-end/`: screenshots reais e relatório do teste no navegador.
