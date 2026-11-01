# CAS somente cabelos — City of God

O CAS apresenta uma única base feminina real extraída do pacote Sketchfab; a seleção de sexo, altura e outras bases permanece oculta até termos alternativas. O corpo original foi adaptado a um esqueleto Mixamo compatível com o jogo. O arquivo recebido no chat foi dividido em **21 GLBs independentes** a partir da coleção Sketchfab `FREE 21 Realtime Man Hairstyles Collection` de Vincent Freelance.

**Licenciamento:** confirme as condições oficiais de distribuição antes de publicar o pacote no GitHub, preserve o crédito ao autor. Os modelos originais não foram incluídos nesta branch (somente código); o ZIP de instalação foi fornecido separadamente no chat.

## Instalar

1. Fazer download do pacote entregue no chat: `cityofgod_cas_corpo_feminino_21_cabelos.zip`.
2. Enviar o **ZIP intacto**, sem extrair, para `third_party/cityofgod_21_cabelos_glb.zip` pela opção Upload files na branch de desenvolvimento.
3. Executar `npm run build:site`. O prebuild extrai e valida automaticamente os 21 GLBs de cabelo, a base feminina rigada e os catálogos em `assets/characters/hair/`, depois os copia para `dist`.
4. Abrir o jogo (CAS ativo por padrão), clicar em *Editar cabelos* e escolher o penteado e a cor.
5. Conferir encaixe, rotações, obstrução e FPS com o esqueleto invisível do jogador, durante caminhada/corrida.

## Segurança / desempenho

- Carregamento **lazy**: apenas o penteado escolhido é carregado.
- O cabelo é preso ao osso `mixamorigHead` e acompanha as animações.
- Seleção e cor são salvas em `cityofgod.cas.v1`.
- Cada material é clonado para não recolorir o cache compartilhado.
- Os nomes de arquivos são validados por regex; nenhuma URL arbitrária é aceita.
- Se catálogo/arquivo não existir, o jogo mantém os personagens e o CAS funcionais.
- A biblioteca pode ter penteados com mais de 30 mil triângulos; manter apenas um equipado.

O encaixe inicial é aproximado porque os cabelos são de outro modelo. Testar e ajustar pivôs, escalas e colisão em uma revisão visual antes de publicar em produção.

## Corpos removidos

Os arquivos procedurais `assets/characters/cas/male.glb` e `female.glb` foram removidos e o gerador `tools/generate-cas-bases.mjs` foi desativado/removido. O ator jogador usa um novo **corpo feminino derivado do arquivo enviado**, com rigging procedural por transferência de ossos, para animações e ponto de fixação do penteado. Se o pacote não estiver instalado, o jogo preserva somente o rig invisível de fallback. Os NPCs continuam com seus rigs/malhas de gameplay; apagá-los quebraria animações existentes. O CAS agora renderiza exclusivamente o penteado em uma prévia 3D independente.

**Não publicar produção sem instalar também o pacote binário de 21 cabelos.** Enquanto o catálogo vazio do GitHub não for substituído pelo manifest completo e pelos GLBs, o seletor fica bloqueado para evitar erros 404.

### Avisos de qualidade

A base extraída é **feminina**, não masculina; contém 33.019 triângulos e 14 clips herdados do rig procedimental do jogo. A distribuição de pesos foi aproximada automaticamente, portanto mãos, ombros e joelhos podem precisar de correção visual no Blender. A textura original é substituída por cores PBR simples para facilitar a personalização. O catálogo de 21 cabelos utiliza modelos sem rig próprio, anexados ao osso da cabeça; cabelos compridos poderão atravessar o corpo em movimento.
