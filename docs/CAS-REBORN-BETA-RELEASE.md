# City of God — CAS Reborn, versão de testes
Atualizado em 28/10/2026.

## Entrega na main
O CAS público usa a base David/Megan estável. Interface escura e dourada por categorias, 3 personagens locais, seleção do corpo, rosto, penteados, roupas, paletas e controles de rotação/zoom. Compatível com o save local anterior.

A versão opt-in https://cityofgod-red.vercel.app/?casreborn=1 carrega as DUAS NOVAS bases geradas por Higgsfield/Meshy com imagens de referência Artlist. Cada base tem 24 ossos, textura e Idle. Três GLBs adicionais incluem Walk, Run e Jump com os mesmos nomes de ossos. Os clipes são normalizados para as bind poses dos corpos selecionados pelo módulo js/cas-reborn.mjs. O pacote total está abaixo de 3,2 MB.

Os GLBs otimizados estão versionados em assets/characters/reborn. As fontes e suas origens estão em tools/cas-reborn-sources.json. O workflow cas-reborn-import.yml faz download, otimiza, valida e registra os binários. Os assets NÃO dependem mais de URLs transitórias para carregamento.

Em falha de download, a beta retorna ao sistema estável e avisa. No modo normal não carrega os novos ativos.

## Validação concluída
- 22 testes CAS com aprovação, mais regressões do jogo e build estático no GitHub.
- Chromium real: abre masculino/feminino, reproduz Idle/Walk/Run/Jump no editor, cria e recupera perfil, alterna corpo e verifica mobile sem erro JavaScript.
- Workflow browser QA aprovado: https://github.com/joaopaulony/cityofgod/actions/runs/40763585068
- Capturas de navegador no artefato: https://github.com/joaopaulony/cityofgod/actions/runs/40763585068/artifacts/12848802292
- URLs na Vercel verificadas, HTTP 200 nos arquivos 3D, scripts e CSS.

## Pendências antes de declarar CAS definitivo acima de 9
1. Novo avatar é uma malha única. Tecidos e pele ainda estão na mesma malha/atlas, não possuem roupas intercambiáveis com pesos e cor independente. Presets do perfil não equivalem a roupas 3D verdadeiramente novas no Reborn.
2. Retargeting direto dos clipes Mixamo anteriores causa deformações. Foi reprovado. Reborn usa apenas Idle/Walk/Run/Jump gerados para o rig novo e emotes simples. Crouch, rifle, cook, sleep, sit, drive e IK de móveis/volante precisam de adaptação.
3. Penteados e acessórios ainda precisam de avaliação por corpo/pose e correção de clipping. Morphs faciais reais ainda não estão disponíveis no modelo novo.
4. Não há persistência remota por conta. Os 3 espaços existentes são locais ao navegador; limpar armazenamento apaga os dados. Não afirmar multiplayer de avatar persistente.
5. Medir FPS e memória em celular intermediário, com 15 NPCs, carros, interiores, occlusion e ações antes de mudar o default.

## Resultado e estratégia
O MVP de criação LOCAL está funcional no jogo público com personagem estável. O Reborn é um beta operacional de rig e locomoção, não um produto aprovado. A substituição universal aguarda todos os requisitos acima de 9/10 com evidências em dispositivos reais.

## Saldo verificado depois deste lote
Higgsfield Plus: 890,5 créditos. Artlist AI Suite: 12.215 créditos.
