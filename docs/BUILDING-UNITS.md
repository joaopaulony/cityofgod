# City of God — apartamentos independentes, salas e lojas

## Implementação
Edifícios de condomínio, conjuntos residenciais e art déco recebem térreo comum e dois apartamentos por andar, esquerdo e direito. Cada unidade tem sala, cozinha, banheiro, quarto, divisórias e porta própria. Torres de escritório recebem duas salas comerciais por piso superior. Lojas são propriedades comerciais independentes.

Na entrada, no corredor do elevador ou junto à porta, a tecla F abre o painel. Compra de unidades e mobiliário, escolha de cores, revenda de móveis, controle de portas e abertura/fechamento local de lojas ficam salvos sob identificador próprio por unidade. O elevador leva o personagem ao andar escolhido e interpola a altura durante a viagem. O editor antigo F7 continua restrito às casas, evitando modificar os apartamentos vizinhos.

## Privacidade
O corte isométrico mantém teto sólido e paredes altas nas unidades alheias, mesmo quando o jogador visita o hall ou a própria unidade. Mobília 3D e Canvas2D só aparece na unidade que o jogador possui e ocupa. Entradas privadas não se abrem automaticamente sem propriedade. Os demais sistemas civis/públicos e casas antigas mantêm comportamento existente.

## Limitação de multiplayer
Este repositório contém um frontend estático e não contém sistema autenticado de posse, online/presença ou servidor autoritativo. As compras e os móveis neste pacote estão no localStorage do próprio navegador e NÃO constituem garantia de exclusividade mundial. O painel não inventa donos, presença online nem quem está dentro de apartamentos de outros jogadores: informa que esses dados não estão sincronizados.

Para operação MMORPG real ainda é necessário backend autenticado com compra atômica, restrição de posse por unidade, dinheiro validado no servidor, presença com TTL/heartbeat, autorização server-side de entrada/móveis e testes concorrentes multiusuário. A abertura/fechamento comercial local não executa vendas automáticas.

## Liberação
Manter em revisão antes de unir à main. Não confundir esta branch com as outras PRs em rascunho do calendário e animações domésticas. Validar CI e capturas visuais antes de produção.
