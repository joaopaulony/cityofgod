# Desempenho durante a direção

O perfil inicial identificou consultas de geometria das ruas para milhares de caixas e círculos distantes em cada subpasso da colisão do carro. O descarte por distância agora acontece antes dessas consultas. Os testes preservam contato com paredes, cercas, árvores, postes e outros carros, incluindo movimento varrido sem atravessar obstáculos.

A geração de vegetação e lixo agora devolve o controle por quantidade de tentativas, inclusive quando todas são rejeitadas. A pintura da base do setor trabalha em duas linhas por etapa, mantendo os mesmos pixels. A limpeza e reindexação final recebem uma etapa própria. Durante a direção, a pintura detalhada do chão e o streaming respeitam parcelas menores do quadro; as bases e ruas vetoriais continuam visíveis enquanto os detalhes terminam de carregar. A qualidade 3D escolhida pelo jogador permanece a mesma.

## Comparação reproduzível

`tools/profile-driving.cjs` usa Playwright/Edge em 1280 × 800, configuração padrão equilibrada, semente de terreno fixa `123456` e o mesmo percurso de 240 quadros na cidade real. Serve arquivos da revisão escolhida por `CITY_BASELINE_REF` para a medição anterior. Os modelos, física, renderização e streaming continuam ativos; a posição segue uma trajetória controlada para repetir o trabalho. O perfil de CPU ajuda a identificar os custos; os números são comparações neste ambiente de teste, não uma garantia de FPS em outro computador.

| Medida | Antes (`ab55c5e`) | Depois |
| --- | ---: | ---: |
| Intervalo médio entre quadros | 29,11 ms | 17,94 ms |
| Percentil 95 do intervalo | 50,0 ms | 33,3 ms |
| CPU média da atualização do veículo | 5,52 ms | 1,42 ms |
| CPU média do streaming | 4,02 ms | 1,56 ms |
| Maior etapa de streaming observada | 37,1 ms | 13,8 ms |

Depois da medição, o teste conclui a geração dos mesmos oito setores e calcula SHA-256 das casas, vegetação e caixas. As duas versões produziram `940ba016cdafe421bf6faebd8180bd9bc041785f2726f36c7b029554a506ef9d`. A distribuição do trabalho mudou; o conteúdo gerado foi preservado.

Relatórios completos: `artifacts/performance/driving-before.json` e `driving-after.json`. Nenhum erro JavaScript foi observado nos dois percursos.

Para repetir, com o servidor local iniciado e Playwright disponível:

```powershell
$env:CITY_PROFILE_NAME='driving-before'
$env:CITY_BASELINE_REF='ab55c5e'
node tools/profile-driving.cjs
Remove-Item Env:CITY_BASELINE_REF
$env:CITY_PROFILE_NAME='driving-after'
node tools/profile-driving.cjs
```
