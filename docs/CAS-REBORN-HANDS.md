# CAS Reborn — mãos e dedos articulados (28/10/2026)

## Objetivo e identidade

Manter a visualização do **esqueleto** do CAS exatamente como a base aprovada: sem corpos, faces, roupas e texturas dos personagens antigos. Ampliar o esqueleto das mãos com juntas reais e fazer cada dedo participar das animações.

## Implementação

- Os arquivos originais \`assets/characters/rigs/reborn/*.rig.glb\` são preservados: eles têm 24 ossos e não possuem pesos de malha humana.
- O arquivo \`js/cas-reborn-hands.mjs\` cria em cada clone uma palma, cinco metacarpos e quatro pontos por dedo. Resultam **52 novos ossos**: duas palmas e dez cadeias de cinco articulações/endpoints.
- Dedos: polegar, indicador, médio, anelar e mínimo. Cada falange é um \`THREE.Bone\` com nome próprio, hierarquia pai/filho e quaternion animável. A geometria continua vazia.
- A posição é calculada a partir dos eixos reais do antebraço e do punho da base **masculina ou feminina**. O comprimento é proporcional à distância entre antebraço e punho, evitando assumir que todos os GLBs usem a mesma unidade.
- O \`SkeletonHelper\` é instanciado **depois** dos dedos para exibir todo o esqueleto no editor.
- \`js/cas-reborn-upperbody.mjs\` coordena movimento de braço, cotovelo, punho e falanges com passos e transições. A extensão da mão tem poses para Idle, Walk, Run, Jump, acenar, celular, comemorar, dançar, alongar e pegadas.
- \`js/character-webgl.mjs\` instancia o mesmo esqueleto completo na cena do jogo, ainda invisível por escolha do reset de humanos. Telemetria reflete os ossos adicionados.

## Qualidade

- \`node --test tests/cas-reborn-hands.test.mjs\`: dez dedos, cadeia completa, flexão das falanges, diferença entre abrir/fechar, poses, idempotência e estabilidade de 1.500 quadros.
- \`npm run test:cas\`, \`npm run test:rig-archive\`, \`npm run build:site\`.
- Chromium \`tests/cas-reborn-browser.mjs\`: validação das 50 articulações de dedos no \`SkeletonHelper\` da prévia masculina e feminina, capturas em desktop e celular.

## O que isto ainda não é

É um **esqueleto articulado para CAS e animações**, não uma malha de mãos com skinning. Adicionar somente ossos a um GLB que já tenha mãos rígidas não faz os dedos dessa malha se deformarem. Quando for introduzida uma malha humana definitiva, será necessário ajustar a topologia das mãos e vincular os vértices às falanges por pesos reais para obter dedos visíveis e naturais. 
