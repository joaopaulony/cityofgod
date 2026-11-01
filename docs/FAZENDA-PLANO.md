# Fazenda do jogador — plano

Objetivo: quem quiser pode viver do campo dentro do City of God. O jogador compra um sítio, cultiva, cria animais,
transforma a produção em produtos de maior valor e vende pela caixa da cooperativa, que passa todo fim de tarde e paga
o preço justo. Tudo no mesmo mundo aberto, no mesmo relógio e na mesma economia (CityLife) do resto do jogo.

Princípios
- **Realista e legível**: plantas crescem por estágios visíveis; animais 3D andam, comem e descansam no cercado;
  construções de madeira, metal e alvenaria com proporções de fazenda de verdade.
- **Ritmo de jogo, não planilha**: cada dia de jogo (24 min reais na velocidade padrão do relógio) avança a fazenda.
  Regar, alimentar, colher e vender são ações curtas com F, perto do que se quer fazer.
- **Sem punição pesada**: planta sem água só para de crescer (não morre); animal sem ração só não produz.
- **Desempenho**: tudo instanciado (um desenho por tipo de planta/estágio), animais só animados perto da câmera,
  atualização diária barata (dados, não 3D).

---

## 1. Terra
- Os **sítios** (casas de campo geradas nos bairros rurais e de fazenda) passam a ser vendidos como **Sítio** com
  **terreno de 52 × 46 m** incluído (preço da casa + terra).
- Ao comprar: o terreno é **cercado** (cerca de madeira com porteira no acesso), a mata de dentro é limpa e o
  terreno ganha zonas fixas: **lavoura**, **5 lotes de construção** (pátios de terra batida) e a **caixa da cooperativa**
  junto à porteira. Zonas que caem em rua, água ou outra casa ficam desativadas.
- O terreno é salvo pela posição da casa; volta igual ao recarregar o setor (a geração do mapa não replanta árvores
  dentro de um terreno de sítio).
- Futuro: comprar **terreno vizinho** (ampliação), aplainar, caminhos, pomar.

## 2. Lavoura
- Canteiros de 1 × 1 m. Com F: **arar** → **plantar** (semente escolhida no app) → **regar** (todo dia) → **colher**.
  Shift+F faz a mesma ação num quadrado 3 × 3.
- Culturas iniciais (dias para colher · rende · rebrota):
  | Cultura | Dias | Colheita | Rebrota | Semente | Venda (unid.) |
  |---|---|---|---|---|---|
  | Alface | 3 | 1 pé | não | R$ 4 | R$ 14 |
  | Cenoura | 4 | 2 | não | R$ 5 | R$ 9 |
  | Milho | 6 | 2 espigas | não | R$ 6 | R$ 11 |
  | Tomate | 6 | 3 | a cada 3 dias | R$ 9 | R$ 8 |
  | Morango | 5 | 3 | a cada 2 dias | R$ 12 | R$ 9 |
  | Abóbora | 8 | 1 | não | R$ 10 | R$ 58 |
- Estágios 3D: terra arada (sulcos), broto, muda, planta adulta, planta com fruto/legume maduro.
- **Qualidade** (★ a ★★★): dias regados sem falhar até a colheita. ★★ vale 25% a mais, ★★★ vale 50% a mais.
- **Caixa d'água com irrigação** (construção): rega a lavoura sozinha todo dia.

## 3. Animais
| Animal | Construção | Produz | Frequência | Compra | Ração/dia |
|---|---|---|---|---|---|
| Galinha | Galinheiro (até 8) | Ovo | 1/dia | R$ 60 | 1 |
| Vaca | Curral (até 4) | Leite | 1/dia | R$ 1.400 | 3 |
| Alpaca | Aprisco (até 4) | Lã | a cada 3 dias | R$ 1.800 | 2 |
- Ração fica no **silo** (comprada no app ou feita do milho no galpão). Com silo cheio, os comedouros são abastecidos
  sozinhos de manhã; sem silo, F no comedouro alimenta usando a ração do estoque.
- Animal alimentado produz no dia seguinte; os produtos aparecem no ninho/ordenha da construção → F coleta.
- 3D: vacas e alpacas são os modelos animados do jogo (andar, pastar, descansar) passeando no cercado;
  galinhas são modelos próprios ciscando no terreiro.
- Futuro: filhotes e reprodução, afeição (carinho diário aumenta qualidade), porcos, abelhas (mel), cavalos.

## 4. Construções (5 lotes)
| Construção | Para quê | Preço |
|---|---|---|
| Galinheiro | casa das galinhas + terreiro telado | R$ 4.500 |
| Curral | cercado com abrigo coberto e cocho | R$ 9.000 |
| Aprisco | abrigo de madeira para alpacas | R$ 8.000 |
| Silo | guarda até 300 de ração; alimenta sozinho | R$ 6.500 |
| Galpão | máquinas de beneficiamento + depósito | R$ 12.000 |
| Caixa d'água | irrigação automática da lavoura | R$ 5.000 |
- Galpão de madeira com telhado em arco e portão largo; silo de chapa corrugada com cúpula e escada;
  galinheiro elevado com rampa e tela; curral de tábuas com telhado sobre esteios; caixa d'água sobre torre.
- Futuro: estufa (cultivo o ano todo/culturas especiais), estábulo de cavalos, moinho, celeiro maior, casa reformada.

## 5. Produtos derivados (galpão)
F no galpão processa tudo que dá; fica pronto no dia seguinte (coletar com F).
| Entrada | Produto | Venda |
|---|---|---|
| 1 leite | Queijo | R$ 95 (leite R$ 38) |
| 3 tomates ou 3 morangos | Conserva / Geleia | R$ 52 |
| 2 milhos | Fubá | R$ 34 |
| 2 milhos | 5 de ração (vai p/ o silo) | — |
| 1 lã | Novelo | R$ 140 (lã R$ 85) |
| 6 ovos | Caixa de ovos caipira | R$ 46 (ovo R$ 6) |

## 6. Venda — caixa da cooperativa
- Caixa de madeira junto à porteira. F deposita tudo o que é vendável do estoque da fazenda.
- **Todo dia às 19h** a picape da **Cooperativa Agro City** para na porteira, o coletor vai até a caixa, carrega e
  paga na hora (notificação + extrato no app). Se o jogador estiver longe, a coleta acontece do mesmo jeito.
- **Preço justo**: preço base × qualidade × mercado do dia (±10%, mostrado no app de manhã).

## 7. App Fazenda (celular)
Visão geral (dia, lavoura, animais, avisos), Estoque, Loja (sementes, animais, ração), Construir (5 lotes),
Semente na mão, Caixa e extrato, Mercado do dia. GPS até o sítio.

## 8. Dados e integração
- `js/farm.mjs` (no pacote 3D, como os empregos): regras, 3D, animais, caixa e app.
- Salvamento: `localStorage cityofgod.farm.v1` (por sítio, pela posição da casa).
- Compra pelo CasaCerta (`city-realty.js`): nome "Sítio" e preço com terra.
- Mundo aberto: `world.farmLots` (a limpeza do setor não planta mata dentro do terreno; objetos `farm` não entram
  na coleta do setor).
- Interação: `CityFarm.prompt/interact` antes dos empregos e veículos (game.js).

## 9. Fases
1. **Fase 1 (esta entrega)**: estrada de terra realista; sítio com terreno cercado; lavoura completa (6 culturas,
   qualidade, irrigação); galinheiro/curral/aprisco com animais 3D e produção; silo; galpão com beneficiamento;
   caixa da cooperativa com coletor; app Fazenda.
2. **Fase 2**: filhotes e reprodução; afeição; estufa; mais culturas (feijão, mandioca, café, cana); pomar.
3. **Fase 3**: ampliação de terreno; trator e implementos (arar/plantar várias linhas dirigindo); contratos com o
   mercado da cidade e restaurantes; feira livre no centro.
4. **Fase 4 (multiplayer)**: visitar e ajudar no sítio de amigos; mercado entre jogadores.
