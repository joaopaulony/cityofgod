# City of God — CAS 2, 3 e 4: Artlist, gestos e editor avançado
Data: 28/10/2026
Fonte: implementação e capturas na main, revisão disponível em [artefato visual](../artifacts/cas-stages-2-3-4.jpg).

## Etapa 2 — modelos novos gerados no Artlist
Artlist conectado (AI Suite 16500). Foram solicitadas **duas gerações Tripo H3.1 de 600 créditos cada**, masculino (Marcos) e feminino (Lívia).
Geração masculina: 01a18393-b80d-73bf-ab77-a2d3764bd466.
Geração feminina: 01a18394-e029-7df4-8708-c60d056a8876.
Os GLBs originais eram 41,7/44,9 MB, com aproximadamente 1,4–1,5 milhão de triângulos e **não incluem esqueleto nem animações**.
Foram simplificados e texturizados para variantes WEB em GLB com WebP e quantização; depois distribuídos gzip:
- `assets/characters/artlist/marcus.glb.gz`
- `assets/characters/artlist/livia.glb.gz`

No CAS, a aba **Modelos Artlist** abre os dois modelos em uma prévia 3D separada e de carregamento lazy via DecompressionStream, sem travar a abertura inicial.
**Não substituem o personagem jogável**. Só fazer isso depois de rigging, transferência de pesos/armature, retarget dos 22 clipes e revisão visual. O personagem animado mantém as bases existentes David/Megan.

## Etapa 3 — seis gestos esqueléticos novos
`js/cas-studio.mjs` cria clipes de quaternion associados aos ossos Mixamo: acenar, usar celular, dançar, comemorar, alongar e sentar.
- Preview: aba **Animações** seleciona clipes existentes (Idle, Walk, Run, Crouch, Jump) e os seis novos.
- Game: painel **Gestos · F6** chama `system.playEmote()` e usa o mesmo mixer do ator; cancela quando o ator volta a caminhar, entra em ação doméstica, saca arma ou dirige.
- São animações procedurais iniciais, não motion capture. Particularmente sentar não ajusta posição a cadeira; gestos não alteram ainda objeto (o celular não aparece na mão por esta etapa).

## Etapa 4 — edição avançada
A estrutura `js/cas-studio.mjs` implementa:
- Blendshapes geométricos procedurais e seguros para cinco parâmetros: largura do rosto, mandíbula, nariz, olhos e maçãs do rosto, com valores de -1 a +1 e material/geometry clones só para a malha do jogador.
- Quatro looks (casual, streetwear, esportivo, social), recoloração da peça superior/inferior e calçados sem pintar pele.
- Acessórios 3D geométricos: óculos, boné e gorro; os objetos seguem o osso Head.
- Persistência local de todos esses campos no perfil validado.
O resultado não equivale ainda aos blendshapes profissionais de um rosto customizado em Blender, nem a guarda-roupa com malhas intercambiáveis. A textura das roupas personalizadas é substituída pela cor PBR da peça, preservando a geometria; as roupas não mudam de molde.

## Validação
- `npm run test:cas`: 14 testes automatizados aprovados, incluindo sanidade geométrica, persistência, materiais e clipes.
- `npm run build:site`: compilação e cópia dos novos GLB comprimidos.
- Navegador Chromium headless isolado: carregou os dois modelos Artlist, cinco sliders, roupas/acessórios, animação `cas_wave`, retorno ao rig jogável e layout 390px sem overflow; sem erros ou requisições falhas.
- Imagens de revisão: `artifacts/cas-stages-2-3-4.jpg`.
- **Não verificado**: FPS real de dispositivos de jogadores, colisão e sessões de gameplay completo, transições de 28 animações no mapa, clipping em todos os cabelos/look/gestos.
- O rig dos Artlist segue pendente; por segurança, não é permitido trocar o jogador de produção por malhas sem skin.

## Julgador (provisório, nota de 0 a 10)
| Eixo | Nota de revisão | Motivo |
| --- | ---: | --- |
| Interface e catálogo | 9.1 | Rotação, zoom e prévia dos ativos Artlist em desktop/mobile |
| Modelos Artlist | 7.9 | Arte gerada e leve, porém sem rigging/expressões e proporções finais não auditadas |
| Animações | 7.7 | 6 gestos esqueléticos funcionais na prévia, não são mocap e faltam objetos para ações |
| Escultura facial e aparência | 8.1 | 5 deformações, 4 paletas, 3 acessórios; falta topologia facial artística e roupa modular |
| Desempenho | Sem nota | Navegador de teste não equivale a hardware do jogador |
| Integração total | Sem nota | Artlist ainda não é avatar jogável, nem validado com multiplayer |

**Critério de aprovação:** nota acima de 9 em todos os eixos antes de declarar a fase concluída como versão final, com inspeção em hardware real e ação no mundo.

## Próximo lote para 9+
1. Criar rig humanoide Mixamo nas duas novas malhas e transferir/validar os 22 clipes existentes; fazer comparação durante andar/correr/combate.
2. Segmentar topo, calças, sapatos e acessórios em malhas independentes; customização com thumbnails e objetos reais.
3. Retopologia facial com blendshapes autorais e UV específica para boca, olhos e pele; testar clipping com cabelos e gestos.
4. Medir FPS/VRAM com LOD em smartphone e desktop, validar save e alternância.
