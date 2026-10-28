# CITY OF GOD — RESET COMPLETO DOS HUMANOS

Atualização: 28 de outubro de 2026.

## Estado aprovado

**Nenhum modelo humano é renderizado.** O jogador continua existindo como entidade lógica para preservar câmera, colisões, carros, armas, controles, inventário e interiores, porém seu corpo está invisível. A população humana (Lucas, Ana e NPCs procedurais) não é criada. A lógica de movimentação continua disponível.

**CAS preservado**: editor com etapas e até três perfis locais, seletores de aparência, save/load, giro e zoom, prévia de estrutura óssea animada e seleção de ações. Nenhuma peça de rosto, corpo, roupa, cabelo ou outro elemento humano é montada na prévia. O CAS é uma interface preparada para receber o próximo modelo aprovado.

**12 bibliotecas de rig somente** em `assets/characters/rigs/`:
- Novo Reborn: 2 esqueletos (masculino/feminino), mais 3 arquivos de Walk/Run/Jump, com Idle preservado;
- Legado Mixamo: David/Megan, ossos e 22 clips preservados para consulta;
- Legado inicial: player/Ana/Lucas, ossos e respectivas animações;
- Legado Tomb: masculino/feminino, ossos preservados.

Cada arquivo `.rig.glb` foi reconstruído contendo somente os nós do esqueleto, mapas de joints, matrizes de bind pose e dados de keyframe necessários. **Nenhum contém malhas, cabelo, material, imagem ou atlas de textura.**

## Remoções
Foram excluídos da `main` 100 arquivos, cerca de 40 MB:
- Corpos Reborn e antigos, modelos de NPC, corpos Tomb e demais human meshes;
- Texturas humanas, materiais de cabelo, fotografias de testes de personagens, previews Artlist;
- ZIP de 21 cabelos e corpo feminino;
- Scripts de geração/visualização dos NPCs procedurais e testes obsoletos;
- Manifestos de corpos;
- Workflows de reinstalação/geração de modelos e o instalador automático que os ressuscitava durante o build.

Outros sistemas do jogo (carros, cenário, animais, câmera, economia) não foram removidos.

## Segurança e reversibilidade
A versão anterior completa está preservada na branch:
`backup/human-models-before-cas-reset-2026-10-28`

Não recuperar modelos antigos automaticamente nem ativar NPCs enquanto o proprietário não aprovar uma nova direção artística. O histórico do Git também registra a exclusão.

## Validações
- `python3 tools/check-rig-only.py` verifica rig/clip, 0 malhas e 0 texturas humanas em cada release;
- `npm run build:site` com Playwright CAS testa abertura/edição/salvamento e prévia esquelética.
- No site publicado, URLs antigas de humanoides devem retornar HTTP 404; arquivos `.rig.glb` devem responder HTTP 200.

Esta entrega **não inclui nenhum humano finalizado**: apenas CAS, ossos e animações.
