# City of God — pets animados Quaternius

O catálogo **F8** contém **18 companheiros**: Yorkshire, Rottweiler,
Lulu da Pomerânia, Gato felpudo, Gato esguio e Siamês (modelos procedurais
existentes), mais os 12 modelos Quaternius CC0:

1. Alpaca (Alpaca)
2. Touro (Bull)
3. Vaca (Cow)
4. Cervo (Deer)
5. Burro (Donkey)
6. Raposa (Fox)
7. Cavalo (Horse)
8. Cavalo branco (Horse_White)
9. Husky Siberiano (Husky)
10. Shiba Inu (ShibaInu)
11. Cervo de chifres (Stag)
12. Lobo (Wolf)

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
