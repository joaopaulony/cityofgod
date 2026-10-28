# CITY OF GOD — Personagens 3D realistas (beta restrito)

Data: 2026-10-28. Branch: `feat/realistic-gta-humans-20261028`. A `main` ainda mantém o reset humano (apenas ossos).

## Origem e decisão artística
- Os modelos Higgsfield / Meshy de 2026-10-28 foram **REPROVADOS**: cerca de 13 mil triângulos, 24 ossos e sem ossos individuais nos dedos.
- A substituição foi gerada com [Ara 3D Gen](https://github.com/olatunde85/3d-gen), código MIT e dados MakeHuman CC0 conforme licença do projeto. **Não** atribuir os novos modelos ao Higgsfield.
- Estilo-alvo: aparência de pessoas adultas naturais e urbanas, sem proporções Disney/Pixar, sem copiar personagens de GTA.

## GLBs disponíveis
| Campo | male.glb | female.glb |
|---|---:|---:|
| Triângulos após simplificação | 9.638 | 9.618 |
| Ossos da armature | 69 | 69 |
| Ossos de dedos (esquerda / direita) | 20 / 20 | 20 / 20 |
| Clipes originais | Idle, Walk, Run, Jump | Idle, Walk, Run, Jump |
| Tamanho | 4.754.552 bytes | 4.125.352 bytes |

Estes são **dados automáticos** do verificador. Não constituem aprovação visual ou prova de deformação natural de mãos, rosto ou roupas em todos os quadros.

## Integração e segurança
- Somente a URL `/?humansbeta=1` tenta ativar as malhas. O site normal mantém a regra de reset humano.
- `assets/characters/realistic/manifest.json` só autoriza os dois GLBs listados.
- `js/cas-realistic.mjs` valida malhas skinned, peso de vértices, juntas de dedos, polígonos, materiais e os clipes reais.
- O CAS permite avaliar o modelo masculino e feminino, giro e troca de animação. Rosto, cabelo e roupas modulares **não** possuem ainda editores 3D adequados para as novas bases; sliders existentes não devem ser apresentados como morphs funcionais.
- População procedural beta inicial de até 10 NPCs com perfis determinísticos; reutilização das duas bases, paletas de peças identificáveis, altura e caminhada. Dois rostos-base ainda repetem; geração de faces realmente distintas permanece pendente.
- NPCs ficam ocultos e sem custo de skinning além de 35 unidades do jogador; **isso não é LOD de geometria verdadeiro**. Benchmark real de FPS em dispositivo móvel ainda é necessário.

## Comandos e evidências
```bash
npm ci
node tools/validate-realistic-glb.mjs assets/characters/realistic/male.glb assets/characters/realistic/female.glb
python3 tools/check-rig-only.py
npm run build:site
# Em CI, após instalação do Playwright:
node tests/realistic-beta-browser.mjs
```

Fluxos de validação:
- [Geração e importação Ara](https://github.com/joaopaulony/cityofgod/actions/workflows/ara-human-export.yml)
- [Regressão estática](https://github.com/joaopaulony/cityofgod/actions/workflows/realistic-beta-regression.yml)
- [CAS e NPCs no Chromium](https://github.com/joaopaulony/cityofgod/actions/workflows/realistic-human-browser.yml)

## Critérios para integrar à main
1. Todas as verificações de GLB, npm build e browser devem passar.
2. Conferir capturas frontal/lateral/costas de ambos, especialmente olhos, mãos, braços, roupa e pé no chão; sem aprovação automatizada de nota visual 9/10 baseada apenas em ossos.
3. Testar Idle, Walk, Run, Jump e crossfades, mãos visíveis, 10 NPCs, entrada/saída do carro, oclusão e sombras.
4. Comprovar performance real com hardware identificado: alvo de 60 FPS desktop e 30 FPS móvel.
5. Só então abrir e fundir PR de produção sem trazer modelos humanos antigos.

**Status da geração:** dois GLBs válidos estruturalmente, disponíveis em beta; aprovação visual e fluxo completo do jogo ainda em avaliação.
