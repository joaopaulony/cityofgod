# Remodelação dos imóveis em 3D

## Direção e plano

Referência de linguagem: composição por cômodos, alas, telhados e corte de paredes do [modo Construção do The Sims 4](https://www.ea.com/pt-br/games/the-sims/the-sims-4/new-player-hub/build-mode), preservando as cores, jardins e identidade Miami do projeto. A geometria é criada no jogo; não utiliza modelos ou texturas extraídos do The Sims.

1. Uma planta determinística define cômodos, contorno, paredes, vãos e móveis. Desenho e colisão usam essa mesma fonte.
2. As residências têm sala, cozinha, quarto e banheiro; os sobrados separam áreas privadas no andar superior. Mansões acrescentam lavanderia e escritório. Apartamentos e unidades sobre lojas têm cozinha e sala próprias.
3. Lojas variam entre café, mercado e estúdio, com atendimento, estoque/apoio e banheiro. Escritórios têm recepção, salas de trabalho, reunião e sanitários. Galpões têm depósito, carga, escritório e sanitários; hotéis recebem recepção e acomodações; o aeroporto recebe terminal, atendimento e apoio.
4. Quatro famílias de implantação criam pátios, entradas recuadas e alas assimétricas. As dimensões e a semente variam a planta. Torres ganham recuos progressivos, lajes e varandas. Coberturas combinam quatro águas, duas águas e terraços.
5. Paredes, molduras, vãos de verdade, portas animadas, telhados, pisos e escadas são modelados em Three.js. Jardim, piscina, chafariz, pórticos e objetos existentes são reaproveitados.
6. Portas e móveis respeitam a circulação. Escadas permanecem alinhadas entre os pavimentos, com abertura na laje. F sobe ou desce no patamar; o enquadramento acompanha a altura.

## Organização

- `js/architecture-plan.js`: planejamento puro, sem DOM/Three; validação semântica e de acesso.
- `js/architecture-world.js`: instalação nos setores reais e substituição dos colisores/móveis antigos.
- `js/architecture-3d.mjs`: lotes próximos da câmera em grupos de geometria compartilhada por material; interior apenas do pavimento ocupado.
- `js/architecture-test.js`: revisão opcional por `?architectureTest=1`, navegando pelo mapa principal. Não cria uma cidade alternativa.
- `tests/property-plans.test.cjs`: circulação com o raio do jogador após mobiliar, banheiro, sobreposição, determinismo e variedade.
- `tests/property-world.test.mjs`: instalação real, rotação, passagem por portas, footprint de carros e escadas entre todos os andares.

## Critérios do julgador interno

A liberação exige nota **maior que 9/10**, nenhum defeito novo impeditivo, plantas válidas e inspeção visual real no navegador. A nota estética é uma avaliação interna, não uma medição objetiva nem uma nota dada por avaliador externo.

| Critério | Peso | Evidência exigida |
|---|---:|---|
| Volumetria e variedade | 2,5 | Contornos recuados, famílias distintas, telhados e volumes; amostras de casa, mansão, comércio e torre |
| Programa e circulação | 2,0 | Cômodos coerentes, instalações sanitárias, caminhos livres após mobiliar |
| Integração funcional | 2,0 | Portas, colisão, rotação, escadas, pavimento correto e corte do interior |
| Acabamento visual | 2,0 | Juntas de cobertura, aberturas, materiais, iluminação diurna/noturna e leitura interna |
| Custo e regressões | 1,5 | Geometria próxima da câmera, construção distribuída, console e testes; estabilidade na máquina de teste |

Não se deve atribuir nota por simples existência de funções no código. A revisão visual e os resultados dos testes precisam ser registrados antes da decisão de liberação.

## Limitações de escopo

O sistema gera imóveis e seus espaços; não implementa ainda compra/construção pelo jogador, empregos comerciais completos, elevadores ou edição livre no estilo Build Mode. A variação é procedural a partir de quatro famílias, não uma planta desenhada individualmente para cada lote. Foram previstos até doze pavimentos. O desempenho precisa de medição específica em aparelhos móveis; os números da revisão são do navegador neste computador.

## Pedido anterior de checkpoint

Em 24/10/2026 o usuário pediu pausar a remodelação e levar o estado à main, e depois pediu retomar. A publicação daquele checkpoint não foi concluída antes da retomada. Não representa aprovação estética acima de 9.

Já implementado: plantas compartilhadas entre desenho e colisão, cômodos mobiliados por uso, recuos e alas, paredes/telhados 3D, corte do interior, portas, escadas alinhadas e múltiplos pavimentos, variação de coberturas, letreiros, divisão da montagem das torres por pavimento e revisão no mapa principal. A auditoria semântica passou em 2.100 plantas, 6.450 pavimentos e 32.850 cômodos. Os testes novos de circulação, colisão e escadas passaram. A suíte geral teve 95/96 aprovações; a falha remanescente é a anterior de colisão carro/pedra.

Para retomar: conferir novamente os picos de montagem após a divisão por pavimento; terminar inspeção noturna e de todas as categorias; verificar acessos externos e cercas dos lotes reaproveitados; melhorar a silhueta das torres, cujos recuos atuais ainda são discretos e cuja repetição de janelas pode manter aparência de bloco. Não há nota estética final atribuída. As capturas atuais em artifacts/architecture são registros de inspeção, não aprovação final.

Branch de origem: codex/imoveis-organicos. Revisão local: http://127.0.0.1:4322/index.html?architectureTest=1.

## Revisão de varandas, aberturas e materiais — 24/10/2026

- Sacadas superiores são parte da planta: laje revestida, porta envidraçada, guarda-corpos em três lados e colisão no pavimento correto. Mansões também têm loggia acessível nos fundos; a varanda decorativa antiga foi substituída. Acesso pelo corredor, sem atravessar dormitórios.
- F abre/fecha portas externas e internas e janelas de guilhotina. A folha inferior sobe verticalmente até a superior, com interpolação; o alvo manual permanece mesmo quando o jogador fica perto ou chega a noite. Abertura de janela não elimina a colisão do peitoril nem implementa transposição pela janela.
- Seis materiais originais em WebP 512: reboco, pedra, concreto, madeira, piso e telha. Cada material tem cor, normal e rugosidade. UVs usam dois metros por repetição; mapas são compartilhados entre imóveis/pórticos. Pacote completo: aproximadamente 876 KB, sem chamadas à API paga. Gerador reproduzível: `tools/build-property-materials.mjs`.
- Coberturas têm beiral, testeira, forro, calha, descida, cumeeira e lajes com platibanda/arremate. Recuos das torres recebem cobertura acabada. A ala técnica plana sustenta uma caixa d'água cilíndrica com nervuras, tampa, base e tubos. Equipamentos comerciais têm grelhas, ventiladores e apoio. Pórticos reutilizados receberam superfície de concreto e juntas.
- Janelas móveis usam duas malhas instanciadas por imóvel, em vez de objetos de desenho separados por janela. O interior renderiza só o pavimento ocupado, com pisos/guarda-corpos opacos; o corte das paredes mantém a leitura do jogador.

### Verificação realizada

- 19 testes específicos aprovados: circulação das 12 tipologias, rotação, portas, alvo manual das aberturas, escadas, acesso e contenção das sacadas frontal/traseira, movimento real das matrizes 3D das janelas e liberação de geometria no streaming.
- Auditoria: 2.100 plantas, 6.450 pavimentos, 32.850 cômodos, zero inválidos. É uma auditoria semântica; não produz nota estética.
- No navegador: mansão, janela em estados intermediário/aberto/fechando, segundo piso, sacadas frontal/traseira, torre de dez pavimentos de dia/noite; nenhum erro gráfico observado. Há avisos antigos de geometria já não indexada e do juiz urbano.
- Na mansão carregada: aproximadamente 57–60 FPS. Na região de torres, cerca de 45 FPS em uma captura diurna, com quedas durante troca de setores. Não equivale a benchmark em celular ou garantia de FPS.
- Capturas em `artifacts/architecture/`; resultado completo dos testes em `tests-current.txt`. A suíte completa passou: 99/99. O teste antigo de pedra foi alinhado à regra já vigente na main (pedras decorativas não bloqueiam carros); a colisão de postes e lixeiras continua coberta.

### Integração e publicação

As otimizações de streaming da main (6810526) foram integradas na branch codex/imoveis-organicos, preservando a antecipação do terreno e os limites de reconstrução. O bundle foi recompilado depois da integração. O trabalho local de clima/dia-noite está sendo feito pelo Claude e não deve ser incluído nem sobrescrito nesta publicação, conforme orientação do usuário.

Torres receberam recuos assimétricos nas alas superiores, coberturas dos terraços, brises e janelas comerciais mais amplas. O vidro usa um mapa compartilhado de céu/horizonte, com intensidade diurna/noturna; não é reflexão dinâmica da cena. Inspeção do pacote estático no navegador: renderizador pronto, zero erros de console. Não foi atribuída nota estética acima de 9; a publicação solicitada entrega a revisão atual, sem afirmar atendimento integral da referência visual.

O deploy anterior da main no Vercel falhou com STATIC_BUILD_NO_OUT_DIR: esperava public, mas o build apenas gerava o bundle. vercel.json agora configura npm ci, npm run build:site e saída dist. tools/build-site.mjs copia o runtime, valida scripts e texturas, e exclui ferramentas/importações brutas. A pasta dist é gerada, não versionada. O workflow game-build.yml executa os 99 testes e o mesmo build estático em pushes à main e pull requests.

Verificação local: npm run build:site concluído; 99 testes aprovados. O resultado remoto deve ser conferido no deployment do SHA publicado, não inferido apenas do build local.
