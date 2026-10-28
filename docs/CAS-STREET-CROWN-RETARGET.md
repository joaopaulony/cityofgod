# Street Crown — personagens no rig de 76 ossos do City of God

Origem: HTML Street Crown fornecido pelo autor. Seis malhas GLB, texturizadas, de 2.199 a 3.800 triângulos, cada uma com 24 ossos de origem e pesos de skinning (JOINTS_0/WEIGHTS_0). Nenhum carro nem áudio foi importado.

## Progresso
- js/street-crown-adapter.mjs: valida os seis personagens e adapta os clipes do Reborn a cada esqueleto de origem, corrigindo as diferenças da pose de repouso.
- js/cas-reborn-hands.mjs e js/cas-reborn-upperbody.mjs: sobre o rig original de 24, inserem e animam mais 52 articulações nas mãos, chegando a 76.
- js/character-webgl.mjs e js/cas-creator.mjs: habilitação isolada pela URL com ?streetcrown=1; seis opções na aba Corpo, sobreposição opcional dos ossos e prévia de animação.
- O jogo normal, sem flag, mantém o reset de humanos como antes. Não há ativação de malhas antigas.

## Limitação importante
Os pesos das malhas existentes continuam associados aos 24 ossos de origem. Os 52 novos ossos do CAS animam, mas seus vértices ainda NÃO foram redistribuídos por falange. As mãos de malha seguem punho/antebraço, mas não dobram independentemente. Para um personagem definitivo com dedos reais, será obrigatório editar malha e pesos com correção da geometria de dedos.

## Transferência dos seis GLBs
Os arquivos foram extraídos com sucesso do HTML e entregues como ZIP na conversa. A integração GitHub não permitiu transferir os bytes binários diretamente. Por isso, nesta branch estão o código e testes, mas ainda faltam os seis arquivos sob assets/street-crown/.

Para importar o ZIP, extraia a pasta assets/street-crown/ na raiz da branch feat/street-crown-cas-retarget-20261028 e execute os seguintes comandos localmente:

    git add assets/street-crown
    git commit -m "assets: import original Street Crown GLBs"
    git push origin feat/street-crown-cas-retarget-20261028

Alternativa: rode python3 tools/extract-street-crown.py com o caminho do Street Crown HTML original.

## Quality gates
- npm run test:cas e npm run build:site
- npm run test:rig-archive
- CI Playwright testa seis modelos e 76 ossos ao importar os arquivos, obtém screenshots masculino/feminino e mobile.
- Visualização, deformação de mãos e performance precisam de inspeção antes de merge na main.

STATUS: código/teste estático preparado; arquivos ausentes na branch, testes reais de GLB pendentes; main intacta.
