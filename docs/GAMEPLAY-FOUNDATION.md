# City of God — Gameplay Foundation

## Jogabilidade
- Inicie Novo jogo e crie seu personagem no CAS. O recém-chegado começa desarmado.
- Após desembarcar no aeroporto, caminhe para completar seu primeiro objetivo.
- Pressione J, clique no card do HUD ou acesse Vida na Cidade pelo celular (P).
- A campanha de chegada possui 8 objetivos, com recompensas únicas e progresso salvo localmente.
- Carreiras: no celular, candidate-se, use o GPS para ir ao emprego, pressione F para bater ponto e conclua as tarefas.
- Moradia: aproxime-se da porta de uma casa residencial disponível, pressione F e escolha Alugar por R$ 160. O quarto virtual antigo foi substituído por acesso à casa física e seus móveis; o app CasaCerta também exige proximidade da porta.
- Vida social: aproxime-se a pé de um NPC, pare, guarde a arma e clique para conversar.
- Acontecimentos: durante a exploração a pé, até 12 situações narrativas podem surgir com NPC próximo. Aproxime-se e pressione F; as escolhas afetam carteira e reputação. O aviso do HUD permite tentar traçar o GPS.
- Lazer: no painel J → Lazer, jogue basquete, pesque ou treine na academia. Clique Parar ou use Espaço durante os três desafios. Limite de três participações por atividade em cada dia de jogo. Venda os peixes capturados no painel.

## Implementação
- js/city-adventures.js: campanha, recompensas, eventos, lazer, painel e persistência.
- css/city-adventures.css: interface separada do HUD e do celular.
- js/game.js: integração do tick, prompt e interação com F; congela movimento enquanto o painel está aberto.
- js/city-ui.js: progresso ao abrir o celular.
- js/jobs.mjs: marca conclusão dos turnos; o bundle compilado js/vehicle-webgl.bundle.js foi reconstruído.
- js/city-adventures.js: observa as memórias do sistema social para validar a primeira conversa.
- js/city-realty.js + js/city-sim.js: aluguel com endereço e uso físico de imóvel.
- LocalStorage: cityofgod.adventures.v1. Nova partida faz backup, limpa a aventura e cog-social-v1.
- tests/city-adventures.test.cjs: testes de progresso, recompensas, reset, aluguel e catálogo de eventos.
- .github/workflows/rebuild-runtime.yml: recompilação do runtime 3D na nuvem.

## Limitações desta entrega
- Basquete, pesca e academia são minigames de interface acessíveis pelo painel, não há ainda objetos esportivos animados em 3D ou restrição à quadra, ao rio e à academia física.
- Os eventos usam NPCs já existentes e escolhas narrativas; não incluem novas animações, cenas exclusivas ou missões de busca com objetivos adicionais.
- Não há multiplayer nem sincronização de saves no servidor; carteira e progresso permanecem locais.
- Os empregos e cursos continuam sob seus controladores existentes, sem novo sistema de promoção por nível nesta etapa.

## Próximas melhorias
1. Pontos físicos de lazer (quadras, pesca, academia), animações e interação espacial.
2. Eventos com fases, caminhos alternativos e consequências persistentes nos NPCs.
3. Novas histórias, promoções de emprego e contratos.
4. Teste de uso com jogadores novos e métricas de retenção.
5. Persistência autoritativa quando o multiplayer estiver pronto.

## Validação
- Executar: node --test tests/*.test.*
- Executar: npm run build:site
- Roteiro manual: Novo jogo → aeroporto → celular → emprego → aluguel físico → social → J / lazer → evento F → salvar e continuar.
