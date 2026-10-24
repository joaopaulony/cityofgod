# Personagens: estado do experimento

O usuário interrompeu a integração Ara 3D Gen em 24/10/2026 por incompatibilidade com a direção visual. Nenhum push foi feito.

Os modelos Ara estão desativados por padrão. O experimento preservado nesta branch pode ser ativado explicitamente com `?characters=ara&characterTest=1`. Após a importação autorizada descrita abaixo, o jogo normal nesta branch usa Tomb.

O pedido seguinte é implementar Tomb's Player Body Overhaul. O usuário confirmou que obteve todas as autorizações do autor, recebidas em áudio pelo WhatsApp. Essa confirmação foi aceita para prosseguir; não é necessário pedir novamente o comprovante da autorização.

O usuário forneceu a pasta `C:\Users\JyOr\Downloads\3429790870_Tomb__x27_s_Player_Body_Overhaul`. Os FBXs B42 masculino e feminino foram convertidos para GLB e incluídos em `assets/characters/tomb/`, com hashes dos FBXs originais no manifest. Foram importados cinco tons de pele por corpo e dez rostos (cinco por corpo, em cinco tons). As variantes DOLL e NUDE não são utilizadas.

Após testar, o usuário rejeitou também a aparência Tomb e pediu nova seleção de modelos. Canvas voltou a ser o padrão nesta branch. `?characters=tomb&characterTest=1` consulta o experimento Tomb, e `?characters=ara` consulta o experimento Ara. Com Tomb ativo, o editor no botão **Personagem** compara corpo, rosto, tom de pele, camiseta e calça. As mudanças de aparência deste teste ainda não são salvas entre sessões.

O pacote fornecido não contém roupas/cabelos ou animações completos de Zomboid. As roupas casuais e o cabelo deste teste são regiões de material próprias no corpo Tomb; cortes adicionais na malha deixam as bordas limpas. A adaptação final tem 7.226 triângulos no masculino e 7.654 no feminino; GLBs com 355.028 e 336.936 bytes, além das texturas carregadas conforme a aparência. Os materiais foram agrupados em cinco regiões e os vértices repetidos foram unidos. A máscara alfa do atlas foi preservada nas roupas, escondendo superfícies auxiliares que apareciam entre as pernas; somente painéis com peso majoritário nos ossos de saia são excluídos da roupa casual.

O esqueleto nativo Bip01 segue as juntas do IK original do jogo em tempo real: movimento, balanço dos braços, mira, recuo e eventos de recarga preservam o comportamento existente. Agachamento usa C; Espaço salta ou transpõe cerca/muro baixo (até 1,55 m, sem parede de casa e com trajeto/aterrissagem desimpedidos). Não é uma escalada geral de edifícios. Os NPCs mantêm sua IA anterior de passeio; não foi criada IA de combate.

Teste no mapa principal: `http://127.0.0.1:4322/index.html?characterTest=1`. Use **Reunir NPCs**, **Aproximar** e os botões das ações. O teste não cria um mapa substituto. Testes de malha/esqueleto e planejamento de travessia estão em `tests/tomb-characters.test.mjs` e `tests/character-actions.test.mjs`.

Para reproduzir a importação: `node tools/import-tomb.mjs CAMINHO_DA_PASTA_EXTRAIDA`, depois `npm run build`. Para servir esta worktree: `npm start` (porta 4322). Créditos do autor em `character-credits.html` e `assets/characters/tomb/CREDITS.txt`.

O código de carregamento GLB, sincronização de câmera e controle de animações está preservado para reutilização com a futura base de personagens.

## Validação da integração Tomb

`node --test tests/tomb-characters.test.mjs tests/character-actions.test.mjs`: oito testes passaram. A suíte completa teve 77 aprovações em 78; a falha preexistente `lamps, stones and solid street bins have tight contact` ainda espera que pedras decorativas bloqueiem carros, enquanto o código atual as ignora.

Verificação no navegador do build final: os três atores carregaram; troca de corpo masculino para feminino mostrou os cinco rostos femininos; rosto e tom de pele puderam ser alterados. Disparo reduziu munição de 30 para 29, recarga terminou em 30/89, agachamento ativou a postura correspondente. Travessia de cerca alterou a posição de (2704.50, 1529.75) para (2704.50, 1531.18) e terminou com altura zero. Salto livre mostrou `jump_start` / `jump_air` e altura positiva; câmera Q/E continuou girando. Não foi medido desempenho em aparelho móvel.

Acabamento ainda de teste: camiseta/calça/cabelo são tratamentos simples sobre a malha, sem armário completo, cabelos longos ou roupas volumosas. A animação da travessia é procedural e precisa de refinamento artístico. Nenhuma nota estética final foi atribuída.

## Base atual: Adobe Mixamo (24/10/2026)

A versão padrão desta branch agora usa David no jogador e em Lucas, e Megan em Ana. Modelos e materiais originais foram preservados; os experimentos Tomb/Ara permanecem opcionais pelos parâmetros anteriores. `?characters=canvas` permite comparar com os personagens antigos. O editor de aparência Tomb não é apresentado para Mixamo.

Arquivos em Downloads utilizados: `Ch28_nonPBR.fbx` (David), `Ch22_nonPBR.fbx` (Megan), `Basic Shooter Pack.zip`, `Locomotion Pack.zip`, `Rifle 8-Way Locomotion Pack.zip` e `Vault Over Box.fbx`. FBXs de trabalho ficam em `.mixamo-source/`, ignorada pelo Git. Extraia os pacotes de locomoção em `.mixamo-source/locomotion/` e `.mixamo-source/rifle8/`, o Basic Shooter diretamente em `.mixamo-source/`, e copie Vault Over Box como `.mixamo-source/vault.fbx`. Depois execute `node tools/import-mixamo.mjs CAMINHO_DAVID_FBX CAMINHO_MEGAN_FBX` e `npm run build`.

A importação normaliza nomes dos ossos, preserva proporções de cada personagem, mantém as roupas/texturas e converte centímetros para metros. O deslocamento horizontal dos clips é removido para a colisão do jogo controlar a posição. A altura do agachamento é preservada usando a altura de referência do esqueleto, e não a primeira pose agachada. Cada ator tem esqueleto e AnimationMixer independentes, compartilhando geometria e texturas. As texturas foram convertidas para WebP até 1024 px, mantendo diffuse e normal maps. David: 47.866 triângulos e GLB 3.810.992 bytes. Megan: 54.883 triângulos e GLB 3.707.268 bytes. Texturas dos dois: 2.153.996 bytes.

Há 22 estados por modelo: repouso, caminhada e corrida desarmados; repouso/mira/movimentos direcionais/disparo/recarga com rifle; agachamento parado/em movimento; disparo e recarga agachados; fases de salto e passagem de obstáculo. São clips nativos Mixamo. Combate agachado combina os braços da ação com as pernas agachadas; agachamento desarmado combina braços relaxados com a postura agachada. A passagem de obstáculo corta a parte final do clip que fazia o personagem se esconder. Saltos e travessias continuam sujeitos ao planejador de colisão existente, sem escalada de paredes altas. Ainda é necessário avaliar variações de altura dos obstáculos e acabamento das transições em uso prolongado.

Verificação: build concluído. Suíte geral: 79/80 testes passaram; permanece a falha preexistente de colisão carro/pedra em `vehicle-depth-collision.test.mjs`. Os testes novos validam os dois GLBs, texturas, pesos/esqueletos independentes, todos os clips, ausência de deslocamento horizontal acumulado, braços relaxados e agachamento real, incluindo recarga agachada.

No navegador do mapa principal: os três atores carregaram sem erros; NPCs caminham com braços naturais; disparo 30→29, recarga 29/90→30/89; postura agachada exibida; salto mostrou jump_start e altura positiva; travessia de cerca terminou de (2704.50, 1529.75) em (2704.50, 1531.18) com altura zero. Q/E continua disponível. Captura em `artifacts/mixamo-no-jogo.png`. Não foram feitos testes em aparelho móvel ou multidões. Nenhum commit/push desta integração foi realizado.
