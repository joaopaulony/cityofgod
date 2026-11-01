# Juiz visual — City of God (Miami)

O juiz é um subagente que só vê imagens e dá notas por critério, comparando com as referências em `assets/references/`. Ele não sabe como o código funciona e não tem motivo para ser gentil: a nota tem de refletir o que aparece na imagem.

Ele trabalha em dois estágios:

1. **Juiz de asset:** avalia cada imagem gerada pelo Nano Banana antes de ela entrar no jogo.
2. **Juiz de cena:** avalia prints do jogo, cena por cena, contra a referência daquela região.

**Meta do criador: nota de cena ≥ 9,5** em todas as cenas. O asset precisa de ≥ 9,0 para entrar no jogo.

## Escala (vale para todos os critérios)

| Nota | Significado |
| --- | --- |
| 10 | Mesma qualidade da referência na mesma escala; ninguém percebe diferença de acabamento. |
| 9,5 | Passaria como print do mesmo jogo da referência; só detalhes mínimos. |
| 9 | Mesmo estilo e quase mesma riqueza; 1 ou 2 falhas visíveis para quem procura. |
| 8 | Claramente o mesmo estilo, mas com falhas que um jogador nota (repetição, área vazia, cor fora). |
| 7 | Boa direção, execução incompleta: partes ainda com cara de protótipo. |
| 6 | Visual procedural/esquemático, cores chapadas, pouca textura. |
| ≤ 5 | Placeholder, erro técnico grave ou estilo diferente. |

Notas quebradas em 0,5. Toda nota abaixo de 9,5 precisa citar **o que exatamente** falta, com a posição na imagem.

## 1. Juiz de asset

| Critério | Peso | O que olhar |
| --- | --- | --- |
| Fidelidade ao estilo das referências | 25% | Luz dourada de fim de tarde, saturação, paleta (`tools/gemini/style.mjs`), "semi-realista" (nem foto nem desenho). |
| Material e detalhe | 25% | Material crível, riqueza de detalhe fino, desgaste e sujeira na medida certa. |
| Escala | 15% | Pedras, folhas, telhas e tijolos do tamanho certo para os metros da imagem (`meters` no catálogo). |
| Técnica | 25% | Textura sem costura e sem degradê de luz, ortográfica (sem perspectiva); sprite sem chão nem sombra, com recorte limpo e sem halo; nada de texto ou logo. |
| Leitura no jogo | 10% | Fica bom reduzido a 512 px e repetido várias vezes? Há algum "carimbo" que denuncia a repetição? |

Saída: nota final ponderada, notas por critério, lista de defeitos e veredito **aprovar / refazer**. Para refazer, o juiz sugere o ajuste exato do prompt (campo `details` do workflow ou a descrição no catálogo).

## 2. Juiz de cena

| Critério | Peso | O que olhar |
| --- | --- | --- |
| Cor e luz | 15% | Sol dourado, sombras longas e quentes, saturação e contraste da referência. |
| Texturas e materiais | 20% | Asfalto, calçada, reboco, telhados, grama e areia com textura real, sem cor chapada nem costura. |
| Arquitetura | 20% | Formas, telhados planos com ar-condicionado, art déco pastel, gueto sujo, como na referência da região. |
| Densidade e vida | 15% | Quantidade de detalhes por área: postes, fios, lixeiras, carros, gente, grafite, plantas. Nada de área vazia. |
| Vegetação | 10% | Coqueiros e arbustos parecidos com os da referência, em quantidade parecida. |
| Composição e leitura | 10% | Ruas, calçadas e lotes legíveis; nada esquisito de escala. |
| Acabamento técnico | 10% | Sem objetos flutuando, sem ordem de desenho errada, sem repetição óbvia, sem buracos. |

## Cenas e referências

Prints com zoom 34 e câmera em 45°, mais uma vista em outro ângulo, porque a câmera gira livre. Coordenadas no mundo grande (`owTeleport(x, y)`).

| Cena | Ponto | Referências |
| --- | --- | --- |
| South Beach (orla, art déco) | 2700, 2700 | 01, 19 |
| Praia | 2716, 3092 | 19, 01 |
| Centro (Brickell) | 2040, 2160 · 1990, 2300 | 18, 10 |
| Bairro de casas | 1200, 1920 | 06 |
| Conjunto (projects) | 1400, 2220 | 02, 03 |
| Favela | 2640, 1740 | 04, 20 |
| Mansões | 1628, 2780 (câmera 3) | 06, 18 |
| Porto | (a definir) | 08 |
| Indústria | (a definir) | 09 |
| Aeroporto (chegada) | ponto inicial do jogo | 15 |

## Como rodar o juiz

1. Capture os prints em resolução cheia e salve em uma pasta da sessão.
2. Chame um subagente com este arquivo, os prints e as referências da tabela. Peça notas por critério, defeitos com posição na imagem e as 3 mudanças que mais subiriam a nota.
3. Registre a rodada no fim deste arquivo: data, média, menor cena e o que mudou.

## Histórico

| Rodada | Data | Estágio | Média | Menor | Observação |
| --- | --- | --- | --- | --- | --- |
| 1 | 24/10/2026 | asset (8 texturas de chão) | 6,7 | 5,8 (gramado) | Só a areia passou (9,05). Fantasmas da emenda por transparência, carimbos, escala errada no gramado. |
| 2 | 24/10/2026 | asset (9 texturas de chão) | 8,0 | 6,7 (pavers) | Gramado 9,1 e areia 9,2 aprovados e instalados. Emenda por corte resolveu os fantasmas; sobram carimbos isolados. Pavers e calçadão passam a ser desenhados pelo jogo. |
| 3 | 24/10/2026 | asset (6 texturas × 2 variantes) | 8,2 | 6,9 (concreto v1) | Achado do juiz: o Gemini às vezes devolve a textura já repetida dentro da imagem; o pós passa a detectar e recortar um período. |
| 4 | 24/10/2026 | asset (5 candidatas) | 8,4 | 7,55 (mato) | Calçada cinza aprovada (9,05); a rosa é derivada dela recolorindo o pigmento. |
| 5 | 24/10/2026 | asset (concreto, mato, terra) | 9,0 | 8,1 (mato, antes do retoque final) | Terra 9,0; concreto 9,0 e mato 9,05 com retoque local nas coordenadas do juiz. Asfalto bloqueado pela API (copyright/recitation) nas versões uniformes; continua procedural. |
| 6 | 24/10/2026 | asset (8 paredes e telhados) | 7,8 | 6,9 (laje v1) | Tijolo, bloco, telha asfáltica e zinco ficam procedurais (o corte de emenda quebra padrão rígido; o jogo já tem geometria exata). |
| 7–10 | 24/10/2026 | asset (laje, manta, rebocos) | — | 7,4 (manta) | Laje suja aprovada (9,0) e instalada. Manta branca e os dois rebocos ficam procedurais (o jogo só usa a luz e sombra deles; o retoque não devolvia o grão). |
