# CITY OF GOD — POPULAÇÃO PROCEDURAL REBORN (BETA)
Atualizado em 28/10/2026.

## Situação real do projeto
O game.js original instancia dois NPCs fixos ("Lucas" e "Ana"). Para não arriscar a estabilidade dos jogadores, a população extra fica disponível **somente** com `?casreborn=1&crowdbeta=1`. No computador o alvo experimental são 12 moradores extras e no modo móvel/dispositivo com poucos núcleos são 6, além dos dois personagens originais.

## O que foi implementado
- `js/npc-population.js`: gerador determinístico por seed e ID, com nomes, corpo masculino/feminino, faixa de idade adulta, altura, volume, paletas de pele/camisa/calça/calçado, variação de caminhada, papel social e acessórios. A semente é estável; novos NPCs gerados com o mesmo ID conservam a aparência.
- `js/game.js`: cria moradores em pontos próximos às casas já existentes, sob o mesmo sistema de movimento/colisão usado pelos NPCs atuais; inclui apenas quando as duas flags estiverem ligadas.
- `js/cas-npc-visual.mjs`: preserva as duas malhas e seus esqueletos, usando uma máscara de vértices baseada nos pesos de skinning para colorir aproximadamente corpo, parte superior, inferior e calçados. Cada NPC ganha sua instância de material/uniformes e acessórios leves (boné, gorro, óculos), reutilizando a textura e geometria comuns.
- `js/character-webgl.mjs`: troca visualmente os residentes do beta pelas duas bases 3D novas. Usa animações nativas e correção de braços já implementadas. LOD simples: personagens do lote são ocultados do render fora de 38 unidades de câmera. Preserva fallback antigo se falhar.
- `tests/npc-population.test.mjs`: valida 120 residentes variados, identidade determinística, limite de geração e variações visuais.
- `tests/npc-population-browser.html` + Playwright: galeria real com 8 moradores e skinning dos dois corpos; testa GLSL, paletas, screenshot e console sem erro.

## O que ainda NÃO está pronto
- **Rostos individuais:** Reborn atual tem apenas um rosto masculino e um feminino; formatos faciais de NPC ainda se repetem. Precisamos de morph targets no mesmo rig ou malhas de cabeças compatíveis.
- **Cortes de roupas:** cores são shader region-based sobre roupas baked em uma só malha. Não representa modelagens independentes de calças, jaquetas, vestidos, saias etc. Precisamos de guarda-roupas skinned por slot.
- **Cabelos variados:** o catálogo de cabelos atualmente não possui styles instalados; boné/gorro/óculos são variações provisórias.
- **Densidade urbana de produção:** este beta contém 6–12 NPCs extras fixos; ainda não possui streaming/pooled NPCs por quarteirão, trajetos complexos por calçada, calendários, trabalho, economia própria ou spawn/residência persistida em banco.
- **Performance:** testes de 8 personagens no browser são apenas um smoke test, não garantem 30/60 FPS com carros/interiores/occlusion em aparelhos reais. Regras futuras: 30 FPS móvel, 60 FPS desktop, LOD/distance, frame staggering, pooling, profiler antes de aumentar 12 para 50+ visíveis.
- **Sincronização entre contas:** sem backend de NPC persistente; semente determinística no cliente permite que cada cliente obtenha a mesma aparência a partir do mesmo ID, mas estado/navegação não são sincronizados.

## Etapas para alcançar variedade real The Sims 4-like
1. Criar **3–4 cabeças originais adicionais por corpo** ou parametric face morphs sobre a base, com atributos/rig faciais testados.
2. Criar no Artlist **conceitos** de pelo menos 12 cortes de cabelo, 15 peças de roupa e 10 acessórios, com vistas frente/perfil/costas; aprovar alinhamento de estilo.
3. Usar Higgsfield para gerar peças 3D prioritárias, depois Blender para UV/retopologia/skin weights e correção de clipping. Não confundir vídeos de animação com arquivos skeletal 3D.
4. Conectar guarda-roupa compartilhado CAS e NPCs; personagem usa conjuntos por contexto (bairro, profissão, clima, hora, comportamento).
5. Implementar população por quarteirão com LOD de três estágios, pooling e IA de rotina; medir FPS.
6. Aprovar em desktop e celular com capturas, perfis distintos e notas >= 9 antes de liberar como padrão.

## Links
- Beta opcional: https://cityofgod-red.vercel.app/?casreborn=1&crowdbeta=1
- Estável: https://cityofgod-red.vercel.app/
- Galeria automatizada: tests/npc-population-browser.html (somente ambiente local/testes, não disponível na produção)
- Workflow: .github/workflows/cas-browser-qa.yml
