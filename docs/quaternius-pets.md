# City of God — pets animados Quaternius

Esta documentação descreve os **12 modelos originais Quaternius**. O novo catálogo de revisão substitui os seis modelos procedurais por **Benny, o Rottweiler** em FBX, totalizando 13 pets com rig quando o arquivo importado for validado. A chegada do Shar Pei depende de download autenticado no Sketchfab.

Os 12 animais Quaternius são: Alpaca, Touro, Vaca, Cervo, Burro, Raposa, Cavalo, Cavalo branco, Husky Siberiano, Shiba Inu, Cervo de chifres e Lobo.

Consulte [Substituição dos animais procedurais](./retire-procedural-pets.md) para atribuição, limitações e migração.

### Animações
Os 12 arquivos glTF contêm esqueleto e clipes `Idle`, `Idle_2`,
`Walk`, `Gallop`, `Eating`, além de ataque, reação e morte.
O jogo usa **AnimationMixer** com blend de ~0,22s entre as ações:
- parado: Idle
- caminhar: Walk
- correr: Gallop
- farejar: Eating
- esperar/sentar: Idle_2 (pose de descanso; **o pacote não contém Sit**)
- dormir: Idle_2_HeadLow ou Idle_Headlow (**não é animação de deitar**).

Não inventar clipes de sentar ou dormir: quando necessário, criar
essas animações separadamente por edição artística do rig.

### Renderização e desempenho
O loader usa cache de cada glTF e clona os esqueletos individualmente
com SkeletonUtils, normaliza a altura dos animais à escala do jogador,
corrige a orientação e preserva o avatar procedural enquanto o asset é
carregado. Os três tons disponíveis nos modelos novos são original,
quente e frio. Modelos antigos e saves de pets anteriores são preservados.
A prévia do F8 é produzida de forma assíncrona para não travar o painel.
Não são feitos 18 contextos WebGL: o teste visual dos novos modelos
usa um único renderer, reutilizado entre cards.

### Testes e screenshots
- `node --test tests/quaternius-pets.test.mjs tests/pets.test.mjs`
- `npm run build:site`
- `tools/quaternius-review.html`: galeria 3D com os 12 animais originais.
- `tools/capture-quaternius.cjs`: capturas de idle, caminhada e corrida,
  catálogo F8 e adoção real de Shiba Inu + Husky no mapa.
- `artifacts/quaternius/`: capturas e relatório do Chrome quando QA executar.

O limite existente de seis animais por casa e a lógica de seguir,
retornar, esperar, passar pelas portas e salvar no navegador permanecem.
A plataforma ainda não oferece sincronização multiplayer autoritativa.
