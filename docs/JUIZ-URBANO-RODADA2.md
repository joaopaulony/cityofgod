# Juiz urbano — segunda rodada

## Alterações
- Lotes alinhados a trechos aproximadamente retos da via: fachadas com porta para a rua, perímetro verificado em amostragem densa contra todas as vias; curvas muito fechadas ficam sem imóveis em vez de receber prédios atravessados.
- Acessos e pátios limitados pela distância do meio-fio em vários pontos da largura da fachada.
- Palmeiras verificadas pelo volume da copa em relação às paredes, não apenas pelo tronco.
- Postes e hidrantes ficam na borda da calçada próxima ao asfalto, não na faixa verde.
- Remoção dos objetos decorativos de rocha e de seus colisores na geração procedural.
- Limpeza de segmentos de colisão de caixas descartadas; os carros só consideram cercas reais, boxes sólidos e árvores/postes fora da pista.
- Pintura das faixas executada numa única camada; supressão junto aos cruzamentos e travessias.
- Otimização: pintura do chão só enfileira imóveis próximos de cada bloco e interiores de altos edifícios limitam desenho ao térreo.

## Juiz e testes
Execute `node --test tests/street-layout.test.cjs tests/urban-regression.test.cjs`.
O workflow `Juiz urbano` valida sintaxe e regressões em alterações na main.
Inspecione console `OW.stats.layout` para ver os resultados do último setor.
Testes de geometria não validam FPS nem sprites no navegador; teste manual os setores e a entrada em casas.
