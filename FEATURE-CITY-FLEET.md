# Frota urbana e instituições — 25/10/2026

- Recorte de visibilidade circular: diâmetro de 85% da menor dimensão da tela, incluindo vidros externos.
- F permite pegar carros estacionados da cidade e sair deles. Modelo, cor, combustível e posição permanecem na sessão, inclusive ao descarregar setores. Não há persistência da frota após recarregar a página.
- Direção com derrapagem por freio de mão (Espaço), fumaça e marcas de pneus; L controla faróis e H buzina. Silvia deixa de ser o carro automático inicial.
- Os modelos atuais têm carroceria única: portas, capô e porta-malas ainda precisam ser separados no asset para animação articulada.
- Hospital, delegacia, batalhão, prefeitura e escola têm plantas próprias, mobiliário, escadas e estacionamentos. Vagas reservadas aguardam os veículos de serviço futuros. Serviços e missões dessas instituições não foram implementados nesta entrega.
- Mais terrenos à venda são reservados antes da ocupação residencial; identificação estável evita duplicação no streaming.
- Mantidos o mapa exclusivo e GPS A* recebidos da main. Instituições aparecem como destinos sem duplicação dos antigos marcadores.

Validação: build:site concluída; 134 testes aprovados. Conferência anterior no navegador confirmou hospital/escola/delegacia e entrada, direção, faróis, saída e reentrada no mesmo carro. Última revisão visual após integração foi bloqueada pelo limite de uso da aprovação automática; fumaça em drift e acabamento final da prefeitura/batalhão ainda precisam de revisão visual. Testes de física cobrem derrapagem e recuperação de aderência. Não foi atribuído selo de qualidade visual ou benchmark de celular.
