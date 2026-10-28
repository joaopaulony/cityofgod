# Cabelos modulares — City of God CAS

O arquivo recebido no chat foi dividido em **21 GLBs independentes** a partir da coleção Sketchfab `FREE 21 Realtime Man Hairstyles Collection` de Vincent Freelance.

**Licenciamento:** confirme as condições oficiais de distribuição antes de publicar o pacote no GitHub, preserve o crédito ao autor. Os modelos originais não foram incluídos nesta branch (somente código); o ZIP de instalação foi fornecido separadamente no chat.

## Instalar

1. Extrair o pacote fornecido pelo assistente: `cityofgod_21_cabelos_glb.zip`.
2. Copiar todos os arquivos em `assets/characters/hair/` para a mesma pasta do repositório (substituindo o `manifest.json` vazio).
3. Fazer build com `npm run build:site`. A pasta será publicada em `dist/assets/characters/hair/` pelo script existente.
4. Abrir o jogo (CAS ativo por padrão), clicar em *Criar personagem* e escolher o penteado e a cor.
5. Conferir encaixe, rotações, obstrução e FPS em ambos os sexos e durante caminhada/corrida.

## Segurança / desempenho

- Carregamento **lazy**: apenas o penteado escolhido é carregado.
- O cabelo é preso ao osso `mixamorigHead` e acompanha as animações.
- Seleção e cor são salvas em `cityofgod.cas.v1`.
- Cada material é clonado para não recolorir o cache compartilhado.
- Os nomes de arquivos são validados por regex; nenhuma URL arbitrária é aceita.
- Se catálogo/arquivo não existir, o jogo mantém os personagens e o CAS funcionais.
- A biblioteca pode ter penteados com mais de 30 mil triângulos; manter apenas um equipado.

O encaixe inicial é aproximado porque os cabelos são de outro modelo. Testar e ajustar pivôs, escalas e colisão em uma revisão visual antes de publicar em produção.
