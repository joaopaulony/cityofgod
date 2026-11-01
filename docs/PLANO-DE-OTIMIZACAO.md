# Plano de otimização — City of God (navegador)

Análise feita em 01/11/2026 com o jogo rodando no navegador (painel do Claude, ~1090×854, qualidade
"Equilibrada", RTX 2060 6 GB). Objetivo: rodar liso em PCs fracos **sem perder qualidade**, **sem chão
cinza carregando** e com uma base que aguente o jogo crescer (mais gráficos, mais sistemas).

---

## 1. Resumo

O jogo é ambicioso e já tem boas bases (instancing, grade de colisão, chão com Web Worker, geração do mapa
em fatias com orçamento por quadro). Os problemas de desempenho vêm de **poucas causas estruturais**, e
quase todas **pioram conforme o mundo e os sistemas crescem**:

1. **O chão é pintado pixel a pixel na CPU** (blocos de 16 m a 56 px/m). Dirigindo, a pintura não acompanha
   — é o "mapa cinza". Também ocupa ~315 MB de imagens.
2. **Consultas que varrem o mundo inteiro** (todas as paredes/objetos) a cada quadro — NPCs (corrigido nesta
   análise), colisão do carro e outras. Custam mais a cada setor carregado.
3. **Reconstruções globais**: a cada setor que termina/sai, colisão, estradas e as camadas 3D são refeitas
   inteiras; as camadas 3D também se refazem a cada ~14–16 m que a câmera anda.
4. **Assets pesados**: texturas 2048×2048 em PNG/JPEG sem compressão de GPU — ~663 MB de memória de vídeo e
   71 MB de download.
5. **168 shaders** compilados na hora em que aparecem → travadas de 100–700 ms ao entrar em áreas novas.

---

## 2. O que foi medido

Rota fixa: carro andando reto a velocidade constante; medidor de tempo por sistema dentro do jogo.

| Cenário | Quadros/s | 95% dos quadros abaixo de | Pior quadro | Travadas > 50 ms |
|---|---|---|---|---|
| Parado, área vazia | 60 | 16,8 ms | 17 ms | 0 |
| Dirigindo 79 km/h, área vazia | 60 | 16,8 ms | 33 ms | 0 |
| Dirigindo 72 km/h, bairro | 56 | 33 ms | 167 ms | 2 |
| **Parado no centro (antes da correção dos NPCs)** | **38** | 50 ms | 50 ms | 3 |
| Dirigindo 79 km/h, centro | 40 | 50 ms | 333 ms | 19 |
| A pé no centro, 8 NPCs (**depois da correção**) | **59** | 16,8 ms | — | 0 |

**Chão incompleto na tela (centro):**

| Velocidade | Quadros com algum bloco de chão sem a pintura final | Pior momento |
|---|---|---|
| 50 km/h | 50% | 69% da tela |
| 100 km/h | 97% | 100% da tela (trava de 717 ms) |

**Custo médio da CPU por quadro (centro, dirigindo):** jogo inteiro 22 ms (o limite p/ 60 qps é 16,7 ms),
sendo: fechar setor 12 ms quando acontece, descarregar setor 6 ms, render 3D 9 ms (picos de 300 ms no 1º
desenho de coisas novas), personagens 4,7 ms (antes da correção), desenho 2D 3,3 ms, pintura do chão 1–4 ms.

**Memória e download:**

| Item | Valor |
|---|---|
| Texturas na placa de vídeo | ~663 MB (26 de 2048², 13 de 1024²) |
| Imagens do chão (canvas) | ~315 MB (102 blocos de 900×900 px) |
| Memória do JavaScript | 107 MB → 686 MB numa sessão de ~10 min (crescendo) |
| Download da sessão | 71 MB, sendo 64,6 MB de modelos GLB |
| Desenhos por quadro / triângulos | 112–222 chamadas, 410–556 mil triângulos |
| Shaders diferentes | 168 |

Para um PC fraco (4 núcleos, 8 GB de RAM, vídeo integrado ou 2 GB): a CPU é ~2–3× mais lenta → os
22 ms viram 45–65 ms (15–20 qps), e 660 MB de texturas + 315 MB de chão estouram a memória de vídeo.

---

## 3. Diagnóstico por área

### A. Chão pintado na CPU → "mapa cinza" (maior problema visível)
`terrain.js` calcula cada pixel do chão (mistura de materiais, ruído, detalhes) em blocos de 16 m a
56 px/m (896×896 px). Mesmo com Worker para a versão rápida e orçamento por quadro, a pintura não acompanha
um carro a 50 km/h. Também obriga a ter **dois canvases** (2D por baixo, WebGL por cima) e efeitos de tela
cheia em 2D (noite, céu, luzes), que custam caro em vídeo integrado.

### B. Varreduras do mundo inteiro (escala mal)
- **NPCs** (`character-webgl.mjs` `clear`): cada passo testava as ~11 mil paredes e ~5 mil obstáculos,
  até 7× por NPC por quadro (~1,3 ms por NPC). **Corrigido**: usa a célula da grade de colisão
  (`collNear` em `world.js`). Laço dos NPCs: ~10 ms → **0,08 ms** com 8 NPCs.
- **Colisão do carro** (`vehicle-collision.mjs`): percorre todas as casas, cercas, caixas e círculos,
  várias vezes por quadro (o carro do jogador e as viaturas da IA).
- Outros: `clearConversation` (personagens), varredura de `boxes` a cada quadro em `vehicle-webgl.mjs`,
  `civic-fleet.mjs` e `parked-3d.mjs`.

### C. Reconstruções globais
- **Fim/saída de setor** (`openworld.js` `owFinish`/`owUnload`): refaz os índices de colisão e de ocupação de
  **todos** os setores, as estradas, e incrementa `world.version` — o que faz casas, objetos e vegetação 3D
  se reconstruírem.
- **Camadas 3D** (`house-3d`, `props-3d`, `vegetation-3d`): reconstroem tudo ao redor da câmera quando ela
  anda 14–16 m, quando o número de caixas muda (estacionar um carro, por exemplo) ou com `world.version`.
  Picos medidos: casas 30 ms, objetos 16 ms, vegetação 8 ms, arquitetura 14 ms.

### D. Assets e memória de vídeo
- Carros: cada modelo tem 4 texturas 2048² + 1 de 1024² em PNG/JPEG (~90 MB de VRAM por modelo).
- NPCs: 2048² por personagem (alguns com 3 mapas) — 2,3 a 6,9 MB de download cada.
- Só 2 arquivos usam compressão (meshopt / WebP). Nenhum usa **KTX2** (textura comprimida que fica
  comprimida na placa: ~4–8× menos memória).

### E. Shaders e primeira aparição
168 programas de shader. Cada material novo é compilado quando aparece pela primeira vez (e cada textura é
enviada à placa nesse momento) → travadas de 100–700 ms ao entrar no centro ou ver um modelo novo.

### F. Memória do JavaScript crescendo
107 → 686 MB numa sessão. Parte é conteúdo carregado, mas o crescimento contínuo indica objetos que não são
liberados (setores/blocos de chão/modelos descartados ainda referenciados) — precisa de investigação com
"heap snapshot".

### G. Tudo na thread principal
Geração do mapa, IA, física, animação e montagem 3D dividem a mesma thread. Já existe `js/worldgen/worker.js`
(geração em Worker usada só na demonstração `?demo=stream`) — é a base para tirar a geração da thread principal.

---

## 4. Plano de ação

Legenda — Impacto: ★★★ alto · Esforço: P (horas–1 dia), M (dias), G (1–3 semanas)

### Fase 0 — Fundação (fazer primeiro; vale para todo sistema novo)

| # | Ação | Impacto | Esforço |
|---|---|---|---|
| 0.1 | **Painel de desempenho (F3)**: qps, tempo por sistema (já existe `cityVehicles.layerMs` e `cityCharacters.updateMs`), chamadas de desenho, triângulos, VRAM, memória. | ★★★ | P |
| 0.2 | **Teste de desempenho automático**: rota fixa (como a desta análise) que gera um relatório; rodar antes de cada entrega para pegar regressões. | ★★★ | M |
| 0.3 | **Orçamentos por sistema** (contrato para tudo que for adicionado): ver seção 5. | ★★★ | P |
| 0.4 | **Presets por hardware** com detecção automática (núcleos, memória, GPU via WebGL) + ajuste fino no menu. | ★★ | P |

### Fase 1 — Ganhos rápidos

| # | Ação | Impacto | Esforço |
|---|---|---|---|
| 1.1 | ✅ NPCs usam a grade de colisão (feito nesta análise). | ★★★ | — |
| 1.2 | ✅ **Colisão do carro e das viaturas pela grade** (`collQuery`): uma consulta por quadro; teste prova resultado idêntico. | ★★★ | — |
| 1.3 | ✅ **Aquecimento da GPU**: carros e NPCs carregados entram em `__gpuWarm`; com folga no quadro, `compileAsync` + 1 textura por quadro. Falta: armas, pets e camadas procedurais. | ★★★ | — |
| 1.4 | **Unificar materiais** (mesmo shader com parâmetros diferentes; atlas de cores) → menos programas e menos chamadas. | ★★ | M |
| 1.5 | ✅ **Qualidade única** (menu): Desempenho 75% sem sombra · Equilibrada 100% sombra 2048 · Alta 150% sombra 4096. O sistema antigo de `city-driving.js` agora delega. | ★★ | — |
| 1.6 | ✅ **Resolução dinâmica**: só quando o gargalo é a GPU; passos de 10%, volta com folga de 3 s; piso 50% / 70% / 100% (alta nunca abaixo da tela). | ★★★ | — |
| 1.7 | ✅ **Camadas 3D**: só reconstroem se o item novo estiver perto da câmera; arquitetura sem contagem de malhas por quadro e com 40 m de folga antes de desmontar. | ★★ | — |

### Fase 2 — Assets leves sem perder qualidade

| # | Ação | Impacto | Esforço |
|---|---|---|---|
| 2.1 | **Pipeline de assets** (`npm run assets:optimize` com gltf-transform): redimensionar, **KTX2/Basis** para texturas, **meshopt** para malhas, remover dados não usados. Rodar em todo GLB novo. | ★★★ | M |
| 2.2 | **Resolução de textura por uso**: na câmera isométrica um carro ocupa ~100–200 px na tela → 1024² é visualmente igual a 2048². Jogador e close-ups podem manter 2048. | ★★★ | P |
| 2.3 | **Texturas por nível de qualidade** (KTX2 já traz as versões menores; baixa usa 512–1024). | ★★ | P |
| 2.4 | **Cache local** (Service Worker / Cache API): a 2ª visita abre quase instantânea, sem baixar 70 MB de novo. | ★★ | P |
| 2.5 | **Carregamento por prioridade**: só o que está perto; NPCs e carros por demanda com versão leve enquanto o modelo completo chega. | ★★ | M |

Estimativa: download de ~71 MB → ~12–18 MB e texturas na placa de ~660 MB → ~120–180 MB, sem diferença visível
na distância da câmera do jogo.

### Fase 3 — Chão na GPU (acaba com o mapa cinza)

| # | Ação | Impacto | Esforço |
|---|---|---|---|
| 3.1 | **Terreno como malha 3D com shader de mistura** (splat): o Worker gera só um **mapa de materiais** pequeno por setor (1–2 px/m: qual material em cada ponto + distância de ruas); a placa de vídeo pinta na hora com **texturas que se repetem** (asfalto, calçada, grama, terra, areia — dá para gerar no ComfyUI). | ★★★ | G |
| 3.2 | **Faixas, meio-fio, poças e marcas** como decalques 3D (instanced) por cima, nítidos de perto. | ★★ | M |
| 3.3 | **Uma só tela (WebGL)**: noite, céu, luzes dos postes e brilhos viram efeitos 3D/shader em vez de pinturas 2D de tela cheia. Remove o segundo canvas. | ★★★ | G |

Resultado esperado: o chão aparece **no mesmo quadro** em que a área entra na tela, em qualquer velocidade;
nitidez maior de perto (texturas de verdade em vez de 56 px/m); memória do chão de ~315 MB → ~20–40 MB.
Até a 3.1 ficar pronta, paliativo: pintar primeiro a versão rápida de toda a área à frente do carro e
aumentar a antecipação pela velocidade.

### Fase 4 — Arquitetura para crescer

| # | Ação | Impacto | Esforço |
|---|---|---|---|
| 4.1 | **Atualização por setor, não global**: índices de colisão/ocupação e camadas 3D recebem "setor entrou / setor saiu" e mexem só nele. Fim do `world.version` global. | ★★★ | M |
| 4.2 | **Camadas 3D por célula**: cada setor monta seus grupos instanciados uma vez; andar só liga/desliga células — sem reconstrução a cada 14 m. | ★★★ | M |
| 4.3 | **Geração do mapa em Worker** (aproveitando `js/worldgen/worker.js`): o Worker devolve dados prontos; a thread principal só instancia em fatias. | ★★★ | G |
| 4.4 | **Agendador com orçamento por quadro**: cada sistema declara prioridade e frequência (IA longe a 5–10 Hz, perto a 30 Hz; animação longe a cada 2–4 quadros; nada fora da tela). Novos sistemas entram nele. | ★★★ | M |
| 4.5 | **LOD de personagens** (malha leve e animação reduzida longe; impostor/sprite bem longe) e **HLOD de prédios** (setor distante vira uma malha só). | ★★ | M |
| 4.6 | **Memória sob controle**: investigar o crescimento do heap (snapshots), pools para objetos temporários, limite de cache por preset (setores, blocos, modelos) com descarte do menos usado. | ★★ | M |

---

## 5. Orçamentos (meta por preset)

| Preset | Alvo | CPU por quadro | Chamadas de desenho | Triângulos | Texturas na GPU | Sombras |
|---|---|---|---|---|---|---|
| Baixa (PC fraco) | 30 qps estável | ≤ 25 ms | ≤ 150 | ≤ 250 mil | ≤ 256 MB | sem / 1024 |
| Média | 60 qps | ≤ 12 ms | ≤ 250 | ≤ 500 mil | ≤ 512 MB | 2048 |
| Alta | 60 qps | ≤ 12 ms | ≤ 400 | ≤ 900 mil | ≤ 1 GB | 4096 |

Por sistema (preset Média): personagens ≤ 2 ms, trânsito/IA ≤ 1,5 ms, física ≤ 1 ms, montagem 3D ≤ 2 ms,
geração do mapa ≤ 2 ms (fatiada), áudio ≤ 0,5 ms. **Regra para sistemas novos**: entrar no agendador,
declarar orçamento e nunca varrer listas globais do mundo por quadro (sempre grade espacial).

Por asset: NPC ≤ 1,5 MB e ≤ 15 mil triângulos, 1 textura 1024² KTX2; carro ≤ 2 MB, texturas 1024² KTX2;
objeto pequeno ≤ 200 KB.

---

## 6. Ordem recomendada

1. **0.1 e 0.2** (medir sempre) → **1.2, 1.3, 1.5, 1.6, 1.7** (ganhos rápidos, risco baixo).
2. **2.1–2.3** (assets) — maior ganho para PCs fracos e para o download.
3. **4.1 e 4.2** (fim das reconstruções globais) — remove as travadas ao dirigir.
4. **3.1–3.3** (chão na GPU) — acaba com o mapa cinza e libera os efeitos 2D.
5. **4.3–4.6** conforme novos sistemas forem entrando.

## 7. Resultados da Fase 1 (mesma rota, centro, RTX 2060, Equilibrada)

| Cenário | Antes | Depois |
|---|---|---|
| A pé no centro (7–8 NPCs) | 38 qps | 59,8 qps, 0 travadas |
| Dirigindo 79 km/h no centro | 39,7 qps · 99% < 83 ms · pior 333 ms · 19 travadas > 50 ms | 52 qps · 99% < 50 ms · pior 183 ms · 7 travadas > 50 ms |

O que sobrou nas travadas (próximas fases):
- **Fora do JavaScript** (167–433 ms com o jogo gastando 13–52 ms): envio das imagens grandes do chão à placa e coleta de lixo → Fase 3 (chão na GPU) e 4.6 (memória).
- **Reindexação global da colisão** (13–21 ms) e das camadas ao descarregar setor → Fase 4.1.
- **NPC novo** refaz o retarget de todas as animações ao carregar (CPU) → guardar o retarget por esqueleto.
- **Programas de shader** subindo (168 → 239) e **chamadas de desenho** (até 327): cada prédio clona materiais → 1.4 (unificar materiais), ainda pendente.
- **Memória do JavaScript** continua crescendo (805 MB) → 4.6.

## 8. Feito durante a análise

- NPCs consultam só a vizinhança na grade de colisão (`collNear`): centro a pé de 38 → 59 qps.
- Medidores leves por camada/sistema: `cityVehicles.layerMs` (camadas 3D e desenho) e
  `cityCharacters.updateMs` (social, IA, NPCs, animação) — base do painel F3.
