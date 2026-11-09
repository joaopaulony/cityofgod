# City of God — vida urbana e moradia (novembro de 2026)

## Diretriz
Esta entrega aproveita somente recursos do jogo que já existem: NPCs, prédios, interiores, inventário, emprego, GPS e animações. **Nenhum modelo ou animação nova foi incluído.** Os minigames de basquete, pesca e academia foram removidos, inclusive suas interfaces, recompensas e contadores.

## Campanha inicial
1. Um novo começo — caminhar 20 metros (R$ 40).
2. Seu primeiro contato — abrir o celular (R$ 30).
3. Hora de trabalhar — conseguir um emprego existente (R$ 75).
4. Primeiro salário — concluir um turno de trabalho (R$ 100).
5. Um teto para chamar de seu — alugar ou comprar uma moradia física (R$ 100).
6. Conhecendo os vizinhos — conversar com um NPC (R$ 80).
7. Cuide de você — usar alimento ou bebida da mochila (R$ 60).
8. A cidade precisa de você — resolver um acontecimento narrativo (R$ 150).

Recompensas únicas totalizam R$ 635. Tecla J abre missões e acontecimentos; **não existe mais aba Lazer**. Dados ficam no salvamento local.

## Apartamentos e aluguel
- Edifícios residenciais já existentes, com apartamentos definidos por andar, apresentam **aluguel e compra** na portaria (F). O CasaCerta permite abrir o painel de apartamentos ao se aproximar do prédio.
- Não são criados prédios, cômodos ou personagens adicionais. Usamos os andares reais do sistema imobiliário anterior (um apartamento por andar nos prédios atuais).
- Preço do aluguel por período de **7 dias do calendário do jogo**: conjuntos populares a partir de R$ 160, condomínios a partir de R$ 200, edifícios de padrão maior a partir de R$ 270; andares superiores acrescentam valores.
- O primeiro período é pago no ato do contrato. A chave vale apenas para o prédio e o andar alugados; portaria continua pública e outros andares permanecem restritos.
- Pagamento automático pela carteira CityLife; se o saldo for insuficiente, há pendência. O CasaCerta permite quitar atrasos, antecipar aluguel, mudar o pagamento automático e encerrar o contrato.
- **Três parcelas em atraso** causam perda de acesso; não ocorre expulsão enquanto o personagem está dentro de sua unidade, evitando bloqueá-lo atrás de portas.
- A entrega voluntária exige ausência de pendências e que o personagem saia do apartamento.
- O inquilino pode comprar o apartamento alugado se quitar os atrasos e pagar o valor de venda. A propriedade então fica permanente, sem renovação de aluguel.
- O editor de casa confere acesso ao andar, sem permitir decorar apartamentos alheios.
- Contrato, vencimento, pendências e permissões são persistidos localmente; o vínculo com a residência principal e o andar também é salvo.
- Antigas casas alugadas continuam reconhecidas para não prejudicar saves anteriores; **novos contratos se concentram nos apartamentos**.

## Economia da moradia
A cobrança do aluguel é separada das contas de água, luz e manutenção. O consumo é acumulado por dia de jogo: R$ 6 para moradia alugada; R$ 14 para residência própria; terrenos acrescentam R$ 10 por dia cada. As contas de consumo são pagas pelo CasaCerta.

## Sistemas existentes preservados
- Empregos e turnos reais: ainda são os controladores existentes.
- GPS: pode traçar rota até a portaria de um apartamento alugado.
- Vida social: ações com NPCs existentes e memória de conversas.
- Acontecimentos: 12 encontros narrativos curtos, sem novos cenários ou animações. As escolhas produzem dinheiro e reputação, mas não atividades físicas inéditas.
- Inventário: uso real de alimentos e bebidas atende à missão de autocuidado.
- Nova partida: salva backup e reinicia progresso, incluindo relacionamentos sociais.

## Limitações
Os apartamentos seguem o layout que já existe nos prédios do jogo, sem subdivisão extra por andar. O aluguel é single-player e local ao navegador; não há sincronização de contratos entre jogadores.

## Testes
- node --test tests/*.test.*
- npm run build:site
- tests/city-adventures.test.cjs: campanhas, inventário, reset e aluguel real.
- tests/city-rentals.test.cjs: contratos, acesso por andar, persistência, pagamentos, atraso, despejo e compra.
- tests/city-sim.test.cjs: economia, serviços e vínculo imobiliário.

Teste manual recomendado: iniciar partida, obter emprego, chegar à portaria, alugar com F, entrar no andar correspondente, testar acesso a outros andares, usar CasaCerta para pagar ou encerrar contrato e depois salvar e retomar.
