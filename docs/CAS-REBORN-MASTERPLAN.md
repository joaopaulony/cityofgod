# CITY OF GOD — CAS REBORN
## Masterplan técnico e orçamento — 28/10/2026

**Status:** planejamento, sem consumo de créditos ou substituição dos modelos ativos nesta etapa.
**Escopo:** reconstruir a camada de personagens; preservar mapa, física, carros, casas, economia, inventário e outras funções atuais.
**Estética escolhida:** *City of God – Urban Life Stylized 3D*. Semi-realismo estilizado inspirado na legibilidade de The Sims 4, com identidade urbana original, sem copiar assets ou personagens protegidos.

### 1. Inventário da main (baseline de migração)
- Personagens jogáveis: David/Megan (Mixamo); 22 identificadores principais de animação no catálogo para Idle/Walk/Run, armas, salto, vault e crouch. CAS criado em `js/cas-creator.mjs` e aplicado em `js/character-webgl.mjs`.
- Rotinas domésticas em `js/city-home-routine.js`: sentar, dormir, cozinhar, comer, assistir TV, trabalhar, lavar, banheiro, beber, geladeira.
- 6 emotes em `js/cas-studio.mjs`, mas movimentos procedurais ainda exigem polimento visual.
- Veículos: atualmente os atores podem ficar invisíveis enquanto dirigem; nova camada precisa exibir corpo no assento e animações de entrar/sair.
- Protótipos Artlist Marcos e Lívia foram gerados em GLB **estático**, sem skeleton, skinning ou clipes. Não podem substituir diretamente atores animados.
- Os 21 cabelos antigos devem ser revisados e aprovados individualmente, não importados automaticamente por conveniência.

### 2. Especificação artística
- Formato próprio: proporção humana estilizada, silhueta legível vista isométrica, braços/mãos faciais não caricaturais, paleta de roupas urbana brasileira/internacional.
- Malhas neutras em **A-pose** com mãos/separação de dedos, sem sapatos, cabelo ou roupa fundidos ao corpo. Base vestida por uma camada interna neutra.
- Corpo masculino e feminino como duas malhas separadas com **contrato único de nomes de ossos, eixos e joints**; proporções e bind poses independentes com retarget validado.
- Tom de pele e cor dos olhos por materiais separados; expressões faciais com 15–25 blendshapes supervisionados por artista; peso corporal por shape keys + peso de skinning, não apenas escala XY.
- Roupas em meshes dedicados por slot `top/outerwear/bottom/fullbody/shoes`. Cabelos e acessórios seguem sockets; roupas flexíveis precisam de transferência de peso para rig comum e anti-clipping.

### 3. Esqueleto e pipeline canônico
1. Gerar referências frontais, perfil e costas (Artlist conceito 2D); conferir pose, anatomia e consistência dos ângulos.
2. Gerar duas bases 3D Higgsfield Tripo detalhadas com PBR; inspecionar medidas, simetria, qualidade de textura e topologia.
3. Retopologia/UV/limpeza no Blender: target 8–15 mil tris para corpo, mãos articuladas, material slots estáveis.
4. Rigging Meshy via Higgsfield com clipe-piloto Idle, medir bone hierarchy; escolher **um esquema canônico** (nomes e convenções), retarget para masculino e feminino e testes de deformação.
5. Repositório de animações com IDs semânticos; AnimationMixer e crossfade com máquina de estados e inércia simples. Animations são assets de skeleton, não vídeos MP4.
6. Testar roupa modular em Walk, Run, Sit, Drive, Crouch e Jump. Separar o mesh do personagem do catálogo de roupas; só guardar IDs e cores no save.
7. Novo CAS carregado via feature flag / rota de teste. Só substituir a versão atual quando os gates passarem.

### 4. Catálogo inicial-alvo — 70 ações distintas
| Grupo | Meta | Conteúdos prioritários |
| --- | ---: | --- |
| Rua / locomoção | 16 | 2x idle, walk, jog, sprint, backpedal, sidestep L/R, turn, jump takeoff/inair/land, vault, crouch, crouch walk, fall/get up |
| Casa / cotidiano | 18 | walk-to-furniture, sit transition/idle/stand, lie down/sleep/wake, eat, drink, cook, fridge, toilet, shower, handwash, watch TV, desk/work, open door, pick up |
| Veículos | 12 | approach/door, driver enter, seat idle, hold wheel, steer L/R, gear shift, glance mirrors, exit, passenger enter/idle/exit |
| Combate e reações | 12 | rifle idle/walk/run/aim/fire/reload, crouched aim/fire, hit reaction, fall, stand, vault/cover |
| Social | 12 | wave, greeting, greet other, phone call, phone text, talk, listen, cheer, dance, laugh, angry, shrug |
Não são 70 novos gastos: reaproveitar/retarget clipes atuais compatíveis; Higgsfield tem 678 ações no catálogo, porém dirigir/cooking específicos não foram encontrados no catálogo consultado e precisarão Blender/IK.
Cada transição de casa/carro deve encaixar o root transform ao ponto de interação e desconsiderar movimento automático enquanto a ação roda.
Padrão: root motion **controlado pelo jogo**; usar in-place quando disponível, foot IK no chão, look-at limitado, mão IK no volante e nos objetos, crossfades de entrada/saída.

### 5. Performance e entrega
- Meta corpo 8–15k tris, com roupas 15–25k, prioritariamente um atlas 1K do corpo e 1K para as roupas principais; 2K só em prévia de estúdio, se necessário.
- NPCs com LOD ~3–8k e 1–3k tris, cabelo simplificado, skinning limitado a ossos necessários, animações menos frequentes para NPCs distantes.
- Malha e acessórios carregados sob demanda, cache de malhas e texturas compartilhadas entre NPCs; apenas ossos/ações independentes por ator.
- Comprimir GLB e texturas, definir orçamento aproximado de 2–5 MB transferidos por personagem principal no traje inicial (a confirmar após medir).
- Meta 60 FPS desktop / 30 FPS celular intermediário, sujeita a profiling real em mapa com vários NPCs e carros. Medir draw calls, VRAM, frame time e downloads.

### 6. Orçamento com consulta real aos conectores
**Saldos consultados:** Higgsfield Plus 1.010 créditos; Artlist AI Suite 16500 13.725 créditos.
**Cotações unitárias do Higgsfield:** Tripo padrão 5, Tripo detalhado PBR 12,5; Meshy rig sem animação 5, Meshy com **um** clipe 8.
**Cotações Artlist:** Tripo 3D médio 600 por peça; Hunyuan 3D médio 1.575; Meshy 3D médio 3.600; conceito Flux 2.0 Pro 80 por imagem; Nano Banana Pro 160 por imagem.

**Envelope Higgsfield proposto (máximo operacional inicial de 450):**
- 2 corpos Tripo detalhados: 25
- 2 testes de rigging+Idle: 16
- Até 40 exportações/iterações de animação cotadas como Rig+clip: 320
- Até 10 reiterações de clipes: 80
- **Subtotal ilustrativo:** 441, com **569 créditos restantes** se cada operação mantiver o preço cotado.
A compatibilidade entre exportações e rig deve ser provada no piloto; **não gastar 40×8 sem provar primeiro que os clipes podem ser retargetados**. Ajustes extras de malha poderão mudar o orçamento. Os 70 movimentos não precisam de 70 chamadas.

**Envelope Artlist proposto (máximo operacional inicial de 10.000):**
- 4 imagens de conceito Flux Pro: 4×80 = 320
- 12 roupas/cabelos/acessórios em Tripo médio: 12×600 = 7.200
- 4 tentativas de correção de 3D: 4×600 = 2.400
- **Subtotal ilustrativo:** 9.920, com 3.805 créditos restantes.
A saída Tripo pode ser um mesh 3D estático. Roupas geradas **não possuem automaticamente pesos de rig nem encaixe corporal**; usar Blender para modelar ajustes, retopologia, separação e weight transfer. Nem toda geração deve ser usada, apenas itens aprovados.

**Protocolo de gastos:** piloto 1 body + 1 rig + 1 walk + 1 camiseta, verificar fluxo completo antes de nova geração. Não gerar simultaneamente dezenas de itens. Reservar recursos para correções e variação.

### 7. Gates de aceitação (todos > 9/10)
- Arte: proporções, rosto, roupa e cabelo com nota >= 9,1 por três ângulos e sob luz do jogo; reprovar mesh fundida, clipping, textura estourada.
- Rig: ombros, joelhos, pés, pulsos e dedos sem deformações; nomes e bind pose conformes, em ambos os corpos.
- Animação: walk/run/jump, entrar/sair carro, sentar/dormir/cozinhar, idle/combat e gestos sem foot sliding, com transições e cancelamentos seguros.
- CAS: edição do rosto e corpo realmente visível, guarda-roupa por mesh, 21+ penteados somente se aprovados individualmente, interface desktop/mobile.
- Performance: profiling com 1 ator, 15 NPCs e carros; metas de FPS em hardware identificado; zero GLBs sem rig como substitutos.
- Integração: veículos, portas, paredes/occlusion, casa, combate, save/load e NPCs mantendo funcionalidade, zero exceções.
- Fallback: até todos os gates passarem o CAS antigo permanece funcional. Versão nova vive em feature flag; não apagar saves e backups.

### 8. Fases de entrega e reprovação
**Etapa A — Style bible:** vista frontal, perfil, costas, paleta, PBR e proporções. Gate visual >=9,1.
**Etapa B — Base e rig:** primeira base neutra rigada e clipe Walk testado; depois o segundo corpo. Gate rig/animação >=9,1.
**Etapa C — Roupas pilotadas:** camiseta, calça, tênis e cabelo adaptados aos 2 rigs; cenas de Walk/Jump/Sit. Gate de clipping >=9,1.
**Etapa D — Animação completa:** agrupar clipes por rua, casa, carro, combate, social com retarget; hooks com contextos do mapa e dos props. Gate de gameplay >=9,1.
**Etapa E — CAS novo:** rosto, corpo, cabelo e roupas modulares, escolha e previews, identidade/perfil, mobile. Gate UX >=9,1.
**Etapa F — QA/release:** testes automatizados, performance, comparação, migração do save e deploy controlado; somente então desligar o sistema legado.

## Regra principal
**Não trocar um GLB estático por "novo personagem jogável" e não gerar vídeo achando que é animação GLB.** A identidade do personagem inclui mesh, rig, material, bone map, skin weights, sockets, clips e desempenho.
