# City of God — Shar Pei e Benny Rottweiler

## Modelos e créditos

**Shar Pei:** “Free Shar Pei Animated Dog” de Artsiom Savelyeu (@artsiom), CC BY 4.0.
https://sketchfab.com/3d-models/free-shar-pei-animated-dog-ed151fd59a894b3290d9eee3f716f0bf
Modelo GLB redimensionado/otimizado na distribuição original da aplicação
https://github.com/Dhruvisgoat/jlkjsdf-af/tree/main/public/models/Town1
A licença, autor e título também estão registrados nos metadados do próprio GLB.
Atribuição: © Artsiom Savelyeu, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
O modelo conserva os três clipes reais: `standing_idle`, `walking_cycle`, `sitting_idle`.

**Benny, the Rottweiler:** de umask007, CC BY-SA 3.0.
https://opengameart.org/content/benny-the-rottweiler
Fonte FBX animada incluída por um projeto Unity que credita o mesmo asset:
https://github.com/mengvf/Nintendoggos/blob/master/Assets/Models/benny.fbx
A fonte Blender original foi publicada em 2013 sob CC BY-SA 3.0; o asset
possui seis clipes `dogArmature|attack`, `attack2`, `die`, `flinch`,
`idle` e `run`. Não existe caminhada/sentada original: no jogo a
animação de corrida é desacelerada para caminhada, e parado substitui sentar.
Atribuições de fotografias utilizadas pelo autor do modelo original:
https://en.wikipedia.org/wiki/File:Rottweiler-Head.jpg
https://commons.wikimedia.org/wiki/File:Rottweiler.jpg
Licença: https://creativecommons.org/licenses/by-sa/3.0/
**Mantenha atribuição e termos ShareAlike para redistribuição/adaptações
deste modelo e das imagens nele derivadas.**

## Mudanças no catálogo
O painel F8 apresenta **14 animais**: os 12 originais Quaternius CC0
mais os dois cães acima. Os seis modelos procedurais, incluindo os três
gatos, Yorkshire, Lulu e Rottweiler antigo, não aparecem mais nem são
criados pelo renderizador. O arquivo original do código procedural
permanece apenas para histórico técnico, não sendo utilizado em produção.

Os pets antigos já adotados ficam em backup no armazenamento local em
`cityofgod.retired-pets-backup.v1`; não podem mais ser adotados ou
renderizados após a atualização. Novos pets continuam limitados a seis
por imóvel com movimento, comandos, abertura de portas e persistência
mantidos no navegador.

## QA
Galeria real dos dois cães em `tools/real-dogs-review.html`.
Capturas e relatório Chrome são produzidos por `tools/capture-real-dogs.cjs`,
e carregados como artifact no workflow `Import licensed Benny and test dogs`.

O FBX do Benny vem de fonte externa licenciada, conferida por SHA do blob
Git `769a045bef1c8de49231389a4482fa36027093fc`, baixada pela
workflow para a branch antes do teste. Não publicar a `main` até a
comparação visual/rig atingir o padrão esperado.
