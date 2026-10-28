# City of God — produção de duas bases com Higgsfield

Objetivo: trocar os modelos procedurais por dois personagens 3D **adultos**, low-poly semi-realistas, mantendo a referência visual enviada pelo usuário como inspiração estilística (sem copiar malhas nem texturas de outro jogo).

**Estado:** especificação/validação preparadas. **Não houve geração na conta Higgsfield**, pois ela não expôs ferramenta de geração 3D autenticada nesta sessão.

## Base masculina — prompt Higgsfield

Production-ready, full-body adult male base character for a modern urban life simulation game. Semi-realistic stylized character design, appealing carefully modeled face, natural expressive eyes with eyelids, nose, lips, ears, jaw and cheekbones; real adult anatomy, natural average-athletic build, five fingers on each hand, clean bald scalp, warm tan skin with subtle PBR shading. Modest matte charcoal boxer briefs, bare feet. Standing symmetric A-pose for rigging, front-facing orthographic camera, entire body visible head to toe against clean white backdrop. Professional game-ready 3D mesh, clean deformation-friendly geometry, target 12k-20k triangles, 1024 PBR texture, humanoid skeletal rig, separately named material regions Skin, Shirt, Pants, Hair. Real GLB mesh — not a 2D image, sprite, video or billboard.

## Base feminina — prompt Higgsfield

Production-ready, full-body adult female base character for a modern urban life simulation game. Exact same semi-realistic stylized art direction as the male base, appealing carefully modeled face, natural expressive eyes with eyelids, nose, lips, ears, jaw and cheekbones; real adult anatomy, natural healthy proportions, five fingers on each hand, clean bald scalp, warm tan skin with subtle PBR shading. Modest coral sports-style bra and matching shorts, bare feet. Standing symmetric A-pose for rigging, front-facing orthographic camera, entire body visible head to toe against clean white backdrop. Professional game-ready 3D mesh, clean deformation-friendly geometry, target 12k-20k triangles, 1024 PBR texture, humanoid skeletal rig, separately named material regions Skin, Shirt, Pants, Hair. Real GLB mesh — not a 2D image, sprite, video or billboard.

## Excluir

Child, teenager, nude, hypersexualized anatomy, exaggerated anatomy, chibi, anime, detached or floating limbs, missing or extra fingers, hair, accessories, shoes, weapons, scenery, text, image plane, unrigged static model, high-poly scans.

## Integração

1. Criar uma imagem de referência A-pose **individual** para cada corpo; não enviar a dupla lado a lado para image-to-3D.
2. Com a conta Higgsfield autenticada, consultar catálogo e custos com higgsfield model get image_to_3d e higgsfield preset list animation-action --query idle --json.
3. Usar image_to_3d, com should_texture=true, enable_rigging=true, enable_animation=true, pose_mode=a-pose e um animation_action_id válido conforme catálogo atual; não inventar IDs.
4. Obter e combinar clipes Idle, Walk e Run no mínimo, usando 3d_rigging quando necessário. Recomenda-se Crouch, Jump, Vault, RifleAim, RifleFire e RifleReload. A exportação só com Idle **não serve** para o CAS atual.
5. Rodar o verificador offline: node tools/validate-higgsfield-cas.mjs caminho/male.glb e caminho/female.glb.
6. Se não houver os ossos Mixamo compatíveis, configurar rig=generic e implementar retargeting adicional para armas/IK antes do release.
7. Inspecionar animações, materiais, escalas, sombras, editabilidade e FPS no navegador. Somente depois substituir os modelos em assets/characters/cas e atualizar manifest.json.

**Não substituir a main sem os dois GLBs reais, validação visual, teste de rig e confirmação de licença comercial.**

Fonte oficial: https://github.com/higgsfield-ai/skills/blob/main/higgsfield-websites/references/game-3d-animation.md
