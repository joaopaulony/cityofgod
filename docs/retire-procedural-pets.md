# Substituição dos animais procedurais — City of God

## Pedido
Retirar do catálogo **Yorkshire, Rottweiler procedural, Lulu da Pomerânia, Gato felpudo, Gato esguio e Siamês**. Mantêm-se os 12 modelos reais/animados da Quaternius, que são uma entrega ainda isolada na PR #48. Benny substitui o Rottweiler procedural; **Shar Pei não deverá aparecer no catálogo até o arquivo original ser obtido legalmente**.

## Benny — Rottweiler
- Criador original: **umask007**, [Benny, the Rottweiler](https://opengameart.org/content/benny-the-rottweiler).
- Licença de origem: **Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0)**.
- Imagens de projeção originais: [Rottweiler Head](https://en.wikipedia.org/wiki/File:Rottweiler-Head.jpg) e [Rottweiler](https://commons.wikimedia.org/wiki/File:Rottweiler.jpg), conforme instruções do autor.
- Cópia FBX animada em repositório público que também cita umask007: [mengvf/Nintendoggos / Assets/Models/benny.fbx](https://github.com/mengvf/Nintendoggos/blob/master/Assets/Models/benny.fbx).
- Seis takes FBX documentados por `benny.fbx.meta`: `dogArmature|attack`, `attack2`, `flinch`, `die`, `run`, `idle`. **Não** possui animações separadas e verificadas de walk/sit/sleep, portanto slow-run/idle são aproximações quando necessário.
- As adaptações do modelo e materiais derivados devem observar a cláusula **ShareAlike 3.0**. A licença e créditos devem acompanhar o asset se for redistribuído.
- O workflow de importação baixa o FBX original atribuído para a *branch de revisão*, nunca para a `main`. O formato FBX é carregado com `FBXLoader`, sem inventar conversão GLB.

## Shar Pei — dependência pendente
- Criador: **Artsiom Savelyeu**, [Free Shar Pei Animated Dog](https://sketchfab.com/3d-models/free-shar-pei-animated-dog-ed151fd59a894b3290d9eee3f716f0bf).
- Licença **CC BY 4.0**, uso comercial permitido com atribuição.
- O download de arquivos Sketchfab pede **autenticação** e não fornece link público permanente para glTF. É necessário obter o ZIP de download oficial logado no Sketchfab e disponibilizá-lo ao projeto com a atribuição.
- **Não** colocar substitutos procedurais, nem exibir um Shar Pei de mentira na loja antes de importar o arquivo 3D verdadeiro.
- Depois do download: incorporar o glTF e texturas, mapear nomes dos clipes e ajustar escala/orientação/visual em Chrome antes de ativar a raça.

## Migração e estabilidade
- O backup `cityofgod.house-pets.retired-backup.v1` guarda os animais dos seis tipos antigos, sem exibi-los ou torná-los adotáveis. O limite por residência permanece seis.
- Os animais da Quaternius continuam funcionando como antes.
- Esta PR é etapa de revisão, não deve ir para produção enquanto Benny não passar testes de animação, tamanho e cor, o Shar Pei não estiver importado e o juiz visual não aprovar.
