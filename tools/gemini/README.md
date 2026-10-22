# Nano Banana no City of God — geracao de assets

Esta ferramenta opera fora do navegador e NUNCA embute a chave no JavaScript do jogo. A API e paga por uso: cada execucao gera, no maximo, **UMA imagem**, sem repeticao automatica. Utiliza o SDK oficial Google Gen AI (@google/genai) e, por padrao, o modelo gemini-nano-banana-2.1.

## Primeira execucao pelo GitHub Actions

1. Em GitHub > Settings > Secrets and variables > Actions, crie o segredo GEMINI_API_KEY com a chave do MESMO projeto do Google que recebeu creditos.
2. Abra Actions > **Gemini Nano Banana - Generate game asset** > **Run workflow**.
3. Selecione o tipo (car, character, prop, building), o nome, a descricao, a direcao e o modelo.
4. Deixe **confirm_spend = false** na primeira execucao: e um TESTE GRATIS, sem chamada ao Gemini. Gera o prompt e o manifesto, mas nao imagem.
5. Para gerar uma imagem de verdade, execute novamente com **confirm_spend = true**. Isso consome creditos.
6. Ao terminar, abra a execucao > Artifacts > gemini-...-review e baixe o ZIP com asset.png, original, prompt.txt e manifest.json.
7. Se marcar **create_pr = true**, o workflow tenta abrir um PR com os arquivos gerados, SEM alterar o jogo diretamente. A configuracao de Actions do repositorio precisa permitir criacao de PR por GitHub Actions. Caso contrario, use o ZIP para revisar.

Nenhuma chamada paga ocorre durante push ou pull request: esses eventos rodam apenas testes gratuitos.

## Quando a imagem sai, mas o GitHub diz que falhou

Se o log mostrar **"GitHub Actions is not permitted to create or approve pull requests"**, a geração pode ter terminado corretamente. Abra a execução em **Actions**, desça até **Artifacts** e baixe o arquivo **gemini-<id>-review**. Extraia **asset.png**. Esse erro não exige outra geração nem outra cobrança.

O PR é só uma conveniência, e não é necessário para baixar a imagem. O workflow agora não invalida uma imagem gerada com sucesso caso a abertura opcional de PR seja recusada. Ele mostra o caminho do ZIP e uma alternativa manual no resumo da execução.

Para permitir PRs automáticos: **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**, caso sua conta permita alterar essa opção. Se estiver desabilitada ou bloqueada, deixe **create_pr = false**, pois o PNG continuará disponível no ZIP.

## Como usar uma imagem de referencia

Suba sua imagem PNG/JPG/WebP para a pasta **assets/references/** do repositorio.

Exemplo: assets/references/daytona-roxo.png

No campo reference_path do workflow, informe esse caminho exato. O script aceita SOMENTE caminhos dentro da pasta, imagem de no maximo 10 MB. Nao e possivel passar links externos.

Para uma spritesheet do mesmo carro em oito direcoes, rode manualmente a geracao em cada direcao sempre com a MESMA referencia. Compare manualmente silhueta, entre-eixos, espessura das rodas, proporcoes e alinhamento. O Nano Banana NAO garante pixels identicos em direcoes diferentes.

## Como rodar localmente

Precisa de Node.js 22 ou superior. No terminal, dentro da pasta do projeto:

    cd tools/gemini
    npm install
    npm test

No PowerShell, defina a chave como variavel de ambiente NA SUA SESSAO (nao dentro do codigo):

    $env:GEMINI_API_KEY="SUA_CHAVE"

Teste gratuito, sem uso da chave:

    node generate-assets.mjs --type car --name daytona-roxo --direction front-left --dry-run true

Geracao paga com referencia:

    node generate-assets.mjs --type car --name daytona-roxo --direction front-left --reference assets/references/daytona-roxo.png --size 1K --ratio 1:1

Opcoes opcionais:
- --details "carro roxo com aerofolio alto e branco, pneus de espessura real"
- --model gemini-3.1-flash-image
- --cutout true (opcional, exige fundo verde de chroma key)

## Saidas

    assets/
      references/
        daytona-roxo.png
      generated/
        car/
          daytona-roxo-<id-da-execucao>/
            asset.png
            original.png (ou original.jpg/webp)
            prompt.txt
            manifest.json

As imagens geradas sao propostas de arte. A revisao e a integracao ao renderer Canvas 2D devem acontecer APOS aprovar o visual. O script NAO substitui a geometria Canvas automaticamente.

## Custo e seguranca

- A cobranca ocorre na conta Google vinculada a chave quando confirm_spend = true, ou ao rodar localmente sem --dry-run.
- Padrao 1K, uma chamada, sem lotes nem retries.
- Se pedir cutout, a geracao solicita fundo verde e o script tenta remover o verde. Se as bordas nao forem verdes o suficiente, o processo falha de forma segura.
- Configure um limite de gastos em https://aistudio.google.com/spend
- Consulte precos oficiais em https://ai.google.dev/gemini-api/docs/pricing
- Nunca compartilhe a chave, inclua em commits ou coloque a chave no JavaScript executado pelo navegador.
- A chave continua guardada apenas como GitHub Actions Secret; o script nao grava nem exibe sua chave.

## Lamborghini Diablo V2: prompts de producao antes de gastar

O pacote de direcao de arte e inventario esta em [assets/vehicles/diablo/PRODUCTION-V2.md](../../assets/vehicles/diablo/PRODUCTION-V2.md). Sao **136 especificacoes** distribuidas em 8 vistas, 32 overlays de luzes, 64 keyframes de pecas e 32 mascaras locais. Nao sao 136 geracoes pagas.

Para exportar gratuitamente o CSV, manifest e todos os prompts por direcao:

```bash
cd tools/gemini
npm run prompts:diablo
```

O workflow de testes gratuitos publica tambem um ZIP chamado **diablo-production-prompts-v2** em Artifacts. O lote V1 nao deve ser considerado artisticamente aprovado: primeiro checar e corrigir direcoes frontal/traseira, cor roxa e partes transparentes dos pneus.

