# Nano Banana no City of God — geração das imagens do jogo

Ferramenta fora do navegador: o jogo nunca carrega este código nem recebe a chave. A API é paga por imagem, então cada asset gera **uma única chamada**, sem repetição automática, com no máximo **8 imagens por execução**.

## Como funciona

- `style.mjs`: a bíblia de estilo, repetida em todo prompt. Define o visual semi-realista de uma cidade ensolarada inspirada em Miami, a câmera do jogo (de cima, a 30°), a paleta de `js/visual-palette.js`, as regras técnicas de cada tipo de imagem e as proibições.
- `catalog.mjs`: a lista de imagens que o jogo precisa, com descrição, escala real (metros por imagem), tamanho final e cores de cada uma.
  - Chão: asfalto, calçada, gramado, mato, terra, areia, piso de praça, folhagem de cerca viva.
  - Paredes: reboco, reboco gasto, bloco, tijolo.
  - Telhados: barro, asfáltica, zinco, laje.
  - Fachadas: escritório, condomínio, art déco.
  - Vegetação: coqueiro, palmeira imperial, hibisco, cróton.
- `prompts.mjs`: monta o prompt completo, valida as opções e estima o custo (tabela oficial de preços).
- `postprocess.mjs`: deixa cada imagem pronta para o jogo, sem custo e no próprio computador.
  - Texturas: tira as manchas grandes de luz e emenda as bordas, para repetir sem costura.
  - Sprites: recorta o fundo magenta e tira o halo rosado.
  - Por fim, reduz ao tamanho do jogo em WebP.
- `generate-assets.mjs`: roda tudo e grava em `assets/generated/<execução>/<asset>/` os arquivos `original.png`, `asset.png` (processado), `<asset>.webp` (pronto para o jogo) e `prompt.txt`, mais um `summary.json` por execução.

Itens marcados com `tint` saem neutros e claros, e o jogo pinta por cima com as cores da paleta. Assim, uma textura de reboco serve para todas as casas.

## Rodar pelo GitHub Actions (a chave fica no Secret `GEMINI_API_KEY`)

Teste grátis, que só gera os prompts:

    gh workflow run gemini-assets.yml -f assets=ground-asphalt,ground-lawn -f confirm_spend=false

Geração paga:

    gh workflow run gemini-assets.yml -f assets=ground-asphalt,ground-lawn -f size=2K -f confirm_spend=true

Referências de estilo (até 3, já commitadas em `assets/references/`) e pedido extra:

    gh workflow run gemini-assets.yml -f assets=roof-clay -f references=assets/references/miami-1.png -f details="telhas mais desbotadas" -f confirm_spend=true

Baixar o resultado:

    gh run list --workflow gemini-assets.yml --limit 3
    gh run download <id> -n gemini-<id>

Também dá para rodar pela página **Actions > Gemini Nano Banana - Gerar imagens do jogo > Run workflow**.

## Custo (Nano Banana 2.1, tabela oficial de out/2026)

| Resolução | Preço por imagem |
| --- | --- |
| 1K | US$ 0,034 |
| 2K | US$ 0,050 |

O teste grátis mostra a estimativa antes de gastar. Uma rodada com o catálogo inteiro (23 imagens) em 2K custa cerca de US$ 1,16.

## Rodar localmente

Precisa do Node.js 22 ou superior. A chave fica numa variável de ambiente e nunca no código.

    cd tools/gemini
    npm install
    npm test
    node generate-assets.mjs --assets ground-asphalt --dry-run true
