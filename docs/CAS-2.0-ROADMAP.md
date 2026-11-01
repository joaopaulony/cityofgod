# City of God — CAS 2.0 | Plano e Julgador
Atualizado: 28/10/2026. A referência enviada orienta o layout, mas a marca e as artes são originais.

## Implementado na main
- CAS fullscreen: oficina 3D, giro e zoom, navegação responsiva, cinco seções (identidade, corpo, cabelo, roupas e estilo).
- Duas bases reais Mixamo (David e Megan) e 22 clipes do catálogo em cada uma. São ativos preexistentes; não foram gerados pelo Higgsfield.
- Substituição no ator jogável do modelo, do mixer e dos clipes; nome, idade, sexo, altura, porte, origem e estilo persistidos localmente.
- 21 cabelos do ZIP licenciado instalados durante o build. Escala corrigida para armature Mixamo; cabelo original oculto ao equipar o novo, restaurado ao remover.
- Recolorir funciona somente em materiais separáveis; os atlas texturizados de roupa/pele não são alterados para evitar corrupção da aparência.

## Roadmap e entregáveis
**Fase 1 — Base funcional:** CAS 3D, gênero corporal, identidade, 21 cabelos, smartphone. Aceite: sem crash, salvar/reabrir, girar/zoom, alternar bases e penteados.
**Fase 2 — Arte dos avatares:** dois modelos autorais adultos A-pose, PBR, 8–20 mil triângulos, textura 1K/2K, boas UVs, rig compatível, roupas modularizadas. Aceite: avaliação visual de frente, perfil e costas, sem clipping grave.
**Fase 3 — Animações e ações:** Idle, Walk, Run, Sit, Sleep, Eat, Phone, Dance, Interact, além das animações de combate/veículos; retarget para um rig consistente. Aceite: transições suaves, sem foot sliding ou ossos quebrados.
**Fase 4 — Editor avançado:** blendshapes reais de rosto (olhos/nariz/mandíbula), barba, roupas em camadas, acessórios, edição das cores por material e thumbnails. Aceite: edição reversível sem atravessar cabeça/corpo.
**Fase 5 — Integração e publicação:** perfis salvos em conta quando houver autenticação, reuso em NPCs, LOD, FPS e memória medidos, testes de movimento/veículos/interiores. Aceite: gameplay completo sem regressão.

## Higgsfield
No workspace autenticado nesta execução, o conector mostrou plano free com 10 créditos. Uma malha Tripo custa 5 créditos e um rigging Meshy com animação foi cotado em 8 créditos. Não foi feita geração paga, pois até um personagem mesh+rig excederia o saldo informado. Antes de gerar atores finais, selecionar o workspace da assinatura paga e verificar as cotas.
Fluxo: concept art adulta em pose A com vistas ortográficas → modelo 3D → PBR + retopologia → rigging humanoide → retarget → checagem GLB em Three.js → catálogo do game com atribuições e licenças.

## Julgamento — nota acima de 9 obrigatória em CADA eixo
1. Visual: screenshots de corpo inteiro e três ângulos, materiais/pele/roupa sem defeitos.
2. Rig e animação: Idle, Walk, Run, ações cotidianas, sem clipping.
3. UX: save/load, teclado, mouse, toque, responsividade e 21 penteados.
4. Performance: FPS, GPU/memória e tempo de abertura em desktop e celular reais.
5. Integração: avatar salvo no mundo, carros, interiores, armas e NPCs.
6. Código: testes, build, sem exceções e caminhos de assets validados.
Sem medições de FPS em dispositivos reais e inspeção da cidade completa, nota 9+ não pode ser declarada.

## Comandos
npm ci
npm run test:cas
npm run build:site
npm start
