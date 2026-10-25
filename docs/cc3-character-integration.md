# City of God — Character Creator 3+ (Female / Male)

## Integração segura

O adaptador CC_Base e as animações por IK estão implementados no código, mas desativados por padrão até a conversão e verificação das duas malhas 3D. O jogo permanece com seus modelos originais.

Os ZIPs contêm Blender/blender.Fbx, blender.json e texturas, mas não arquivos .blend. Cada FBX possui somente uma AnimationStack com curvas de 1–2 quadros-chave. Corrida, luta e interações não estão prontos nesses arquivos; o adaptador usa as poses e o sistema IK já existentes no City of God.

## Como converter no Windows

Instale Blender 4.x. Abra PowerShell na raiz da sua cópia do repositório e execute, adaptando os caminhos:

    & "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" --background --python tools/convert_cc3_bodies.py -- --female-zip "C:\Users\SEU_USUARIO\Downloads\Blender female.zip" --male-zip "C:\Users\SEU_USUARIO\Downloads\Blender Male.zip" --out "assets/characters/cc3"

O script gera female.glb, male.glb e manifest.json em assets/characters/cc3. Ele elimina centenas de morph targets da versão FBX, preserva o skinning e reduz imagens BMP de alta resolução. O script pode exigir bastante RAM porque os FBX descompactados somam aproximadamente 450 MB e contêm centenas de morph targets.

Em um servidor local, teste:
- http://localhost:4321/?characters=cc3
- http://localhost:4321/?characters=cc3&sex=female

Observe dedos, joelhos, ombros, pescoço, pés no solo, curvas da movimentação, mira e recarga. Não temos confirmação de qualidade visual até renderizar esses arquivos.

## Animação

js/cc3-rig.mjs traduz os joint targets do skeleton.js em rotações de ossos CC_Base, suavizando as transições. Utiliza estados existentes de idle, walk, run, crouch, jump, vault, aim, firing e reload. Isso é animação procedural do jogo, não clipes de captura de movimento retargetados; um refinamento futuro pode incluir clips de animação licenciados e cuidados adicionais com foot IK, mãos e expressão facial.

## Desempenho e licença

Nunca coloque os FBX e BMP originais no carregamento do navegador. Comprima as texturas e vise GLBs abaixo de 25 MB. Quando o manifesto ou GLBs não estão presentes, o modo CC3 tenta restaurar o provider Mixamo existente.

A identificação RL_CC3_Plus no JSON indica a origem técnica, não demonstra direitos para distribuição. Os pacotes recebidos não incluíam uma licença explícita. Confira no site original as permissões do modelo específico, sobretudo o uso em jogos web e a disponibilidade dos arquivos compilados aos navegadores. Não publique esses modelos ou derivados no GitHub público até verificar a autorização.

A integração é opt-in; o default do jogo não muda.