# Bases humanas VTR3D — teste local

Prévia: http://127.0.0.1:4322/index.html?characters=realistic-base&characterTest=1

O provedor `realistic-base` usa os arquivos fornecidos pelo usuário. O padrão continua Mixamo até aprovação visual. Botão Personagem: corpo, cinco tonalidades, giro, prévia de animações e aplicação persistida localmente. Lucas e Ana usam as mesmas bases com materiais independentes. Não é um editor completo de anatomia, roupas ou cabelo.

## Conversão

`tools/import-realistic-base.mjs` recebe os FBX masculino (Unity/unity.Fbx) e feminino (Unreal/Female_Body.Fbx), nesta ordem. Precisa dos JSON e texturas adjacentes. Converte BMP/JPEG para WebP até 1024px, remove câmeras, luzes, dummies, morphs e camadas oculares de shader proprietário. Ajusta A-pose para T-pose e transfere as animações David/Mixamo a 24 amostras/s, incluindo ossos de torção. Originais permanecem em Downloads.

| Modelo | Triângulos | Grupos de material | GLB + texturas |
|---|---:|---:|---:|
| Masculino | 30.395 | 10 | 4,84 MiB |
| Feminino | 32.718 | 13 | 4,68 MiB |

Total solicitado pelo provedor: aproximadamente 9,52 MiB, além do manifesto. Geometria/texturas compartilhadas entre instâncias, materiais e esqueletos independentes. Esses números são tamanho transferido, não memória GPU nem benchmark de FPS. David tinha 47.866 triângulos, mas as bases ainda exigem redução de materiais e LOD para multidões/mobile. Não houve teste em celular físico.

## Verificação

- 138 testes passaram e `npm run build:site` passou.
- Teste novo percorre todas as animações em três instantes, valida pesos/índices de skinning, limites de geometria, braços fora do tronco no idle, texturas e isolamento de cor.
- Inspeção visual no navegador: masculino/feminino, idle, caminhada, mira, alteração de pele e os três atores no mapa. Corpo e tonalidade persistem após recarregar; sem erros de console nessa inspeção.
- A correção A-pose/T-pose resolveu braços inicialmente presos atrás do corpo; remoção de eye-occlusion resolveu olhos brancos.
- Aprovação apenas como base técnica de teste. Sem cabelo, roupas finais, expressões faciais ou ajuste individual de contato das mãos/arma para cada corpo. Não atribuir nota artística automática.

## Origem e publicação

Autor identificado: VTR3D. Referências: https://www.cgtrader.com/free-3d-models/character/woman/realistic-human-female-body-rigged-gameready e https://www.renderhub.com/vtr3d/realistic-male-female-base-bodies-game-ready-rigged-optimize . Os arquivos locais não incluem comprovante de licença. Manter o registro de aquisição e os termos aplicáveis antes de publicar os binários num repositório público; uso integrado no jogo e redistribuição de arquivos-fonte são coisas distintas. Nenhum novo deploy ou push foi feito nesta avaliação.
