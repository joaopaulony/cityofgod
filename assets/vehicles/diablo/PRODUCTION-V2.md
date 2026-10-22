# Pacote de producao Lamborghini Diablo V2 — City of God

**Estado:** especificacao pronta; imagens existentes V1 **nao aprovadas artisticamente**. Este pacote nao faz geracao paga e nao altera os carros do jogo por conta propria.

## Objetivo aprovado
Diablo roxa **limpa, conservada, sem manchas**, no estilo isometrico realista 2D de sobrevivencia urbana que ja aprovamos como direcao. Manter a MESMA carroceria, rodas de cinco furos, asas, vidros, frente, traseira e pintura em todas as 8 vistas.

**Primeira regra:** nao produzir 8 desenhos independentes achando que a IA manterá a geometria. Cada vista depende de uma referencia-mestra aprovada; a geracao deve ser revisada em comparacao direta e as diferencas corrigidas antes de qualquer integracao.

## Inventario completo, por prioridade

| Etapa | Entregas | Arquivos de especificacao | Metodo preferido |
|---|---|---:|---|
| **P0** | 8 vistas-base fechadas | 8 | Referencia mestra + geracao ou edicao dirigida por camera |
| **P1** | Farol, freio, setas esquerda/direita em 8 direcoes | 32 | Sobreposicoes Canvas 2D ou diferenca de pixels, nao redesenhar o carro todo |
| **P1** | Mascara pintura, rodas, vidros e sombra em 8 vistas | 32 | Segmentacao/canvas LOCAL. **Nao pagar por essas mascaras.** |
| **P2** | Porta esquerda, porta direita, capo dianteiro, tampa do motor traseiro | 64 | Meio-aberto e aberto para cada uma das 8 direcoes, editando a vista aprovada |

**136 especificacoes no total** (nao 136 imagens geradas ou chamadas de API). Animacoes fluidas serao montadas no jogo a partir de keyframes/camadas aprovadas; nao basta trocar uma imagem chapada por outra.

As 8 vistas usam exatamente estes IDs: **front-left, front, front-right, right, rear-right, rear, rear-left, left**.

## Regras de rejeicao: olhando de perto

1. **Frente e traseira:** frente usa capô em cunha, farois escamoteaveis fechados, pisca ambar e para-choque frontal; traseira usa QUATRO lanternas redondas, grelha do motor, escapamento e asa. Se as lanternas vermelhas aparecem na frente, **REPROVAR**.
2. **Cor unica:** mesmo roxo do master (aproximadamente #704080), deixando apenas mudancas pequenas de iluminacao. Nunca uma vista lilas clara e a outra vinho/azulada. Comparar amostras de portas, teto e capo.
3. **Rodas:** pneus inteiros, pretos, com espessura, sem pixel alpha abrindo buraco no pneu ou aro; contato com o solo e oclusao pelo para-lama.
4. **Perspectiva:** nenhuma vista diagonal pode repetir imagem da frente com farois traseiros adicionados; nariz deve apontar nas direcoes corretas.
5. **Recorte:** todos PNGs 768 x 512 RGBA; bordas transparentes, ausencia de halo verde e manchas, sombra preta separada. Mesma ancoragem no solo, para nao saltar ao girar o carro.
6. **Acabamento:** capô e porta-malas fechados nas vistas-base, tinta polida e limpa, sem sujeira, descascado, arranhoes ou vidros amarelos.
7. **Aprovacao:** screenshots de jogo em zoom real, comparacao lado a lado 8 vistas, animacoes ao girar e pintura alterada sem contaminar rodas/vidros. **Pontuacao automatica so verifica contratos tecnicos**, nao semelhança artistica.

## Prompts: como obter TODOS os 136 arquivos de texto

O gerador funciona inteiramente offline e nao usa GEMINI_API_KEY:

```bash
node tools/gemini/export-diablo-production.mjs
```

Saida padrao:

```text
artifacts/diablo-production-prompts-v2/
  asset-manifest.json
  asset-checklist.csv
  prompt-index.md
  PRODUCTION-README.md
  prompts/
    base/                         (8 .txt)
    lighting/                     (32 .txt)
    moving/                       (64 .txt)
    mask/                         (32 .txt)
```

No GitHub, tambem e possivel baixar esse pacote sem instalar nada: **Actions > Gemini Nano Banana - Generate game asset > execucao de validacao > Artifacts > diablo-production-prompts-v2**.

### IDs para a base
```text
base__front-left
base__front
base__front-right
base__right
base__rear-right
base__rear
base__rear-left
base__left
```

Exemplo para ver o prompt exato do carro visto pela traseira:

```bash
node tools/gemini/export-diablo-production.mjs --print base__rear
```

Exemplo para porta esquerda completamente aberta do angulo dianteiro esquerdo:

```bash
node tools/gemini/export-diablo-production.mjs --print door-left__open__front-left
```

No pacote, cada tarefa tem: ID, direcao, componente, estado, dependencia, metodo sugerido, destino esperado e pontos de controle visual.

## Gasto e integracao com Gemini

- **Nao** existe acionamento automatico dessas 136 tarefas; cada prompt e uma especificacao.
- Os arquivos P0 que a IA gerar devem ser comparados com a referencia e corrigidos antes de pagar pelas animacoes P2.
- Para luzes e mascaras, preferir codigo Canvas 2D e processamento local, evitando novas chamadas.
- Usar o workflow manual existente para UMA imagem de cada vez, com a imagem de referencia e a confirmacao de gasto. O runner atual generico ainda nao assume que 136 prompts estejam aprovados.
- NUNCA atribuir status de aprovado com base somente na resposta 200 da API, na existencia do PNG ou em nota 100/100 de testes tecnicos.
- Os sprites usados hoje no City of God seguem disponiveis ate que haja substituicao visual efetivamente validada.

## Frota apos a Diablo
Depois de validar o piloto (incluindo cor, rodas, dobradicas e animacoes), adaptar o catalogo ao Ford Mustang GT, Ford Ranger Raptor 4x4, Mercedes-AMG G63 e Chevrolet Opala Coupe 2 portas, todos limpos. Nao copiar a geometria da Diablo para veiculos de formatos diferentes.
