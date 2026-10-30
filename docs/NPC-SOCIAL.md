# Vida social dos personagens

A pé, **clique no personagem 3D** para abrir o leque de interações. Escolha a categoria, o assunto e a ação. Por exemplo: **Amigável → Conversa profunda → Ouvir e apoiar**. O mundo continua visível e o leque acompanha a posição do personagem na câmera. O alvo espera enquanto você escolhe. **Esc** volta um nível; na raiz, fecha. Clicar fora fecha o leque. Setas e Tab permitem navegar com teclado. O clique social é capturado antes do disparo; quando o jogador está mirando, o controle de combate continua tendo prioridade.

Para executar uma conversa, pare a até quatro metros, no mesmo andar, sem parede fechada entre os personagens, e guarde a arma. Opções indisponíveis mostram o motivo. Durante a seleção, os controles de movimento e combate são bloqueados. O menu é reposicionado nas bordas da tela e usa duas colunas em telas pequenas.

**Y** ou o botão **Vida social** abre o diário com pessoas próximas e vínculos já conhecidos, histórias, personalidade, interesses, amizade, romance, confiança e memórias.

## Progressão obrigatória e iniciativa dos NPCs

Todas as 98 interações têm um contrato de progressão em `js/social-rules.mjs`. `defineSocialActions` rejeita uma nova interação sem regra explícita ou com campos inválidos. Para acrescentar um diálogo, declare uma regra em `SOCIAL_RULES` ou um `gate(...)` válido no catálogo e mantenha os testes de limiar. Leque, diário, telefone, mensagens e decisões autônomas consultam a mesma validação do motor; uma ação bloqueada não altera relações nem cria memórias ou convites.

| Interação | Amizade | Confiança | Intimidade | Romance | Hostilidade máxima |
|---|---:|---:|---:|---:|---:|
| Iniciar flerte | 20 | 10 | 5 | — | 15 |
| Pedir beijo | 45 | 35 | 30 | 45 | 10 |
| Propor namoro | 60 | 50 | 45 | 70 | 5 |
| Convidar para encontro | 40 | 30 | 25 | 35 | 10 |
| Jantar ou visita em casa | 40 | 30 | 25 | — | 10 |
| Convidar para pernoitar | 60 | 55 | 50 | — | 5 |

Intimidade cresce por experiências positivas, sobretudo apoio e conversas pessoais; hostilidade cresce com ofensas e diminui com atitudes de reparação. Os valores são persistidos e estimados a partir de vínculos antigos na migração. Os limiares abrem a possibilidade de conversar, sem garantir aceitação: personalidade, humor e recusas anteriores continuam valendo.

Discussões leves e provocações podem iniciar uma rivalidade. Grosseria pede hostilidade 10; xingamentos, 25; humilhação, 50; intimidação, 65. Zombar de um sonho exige conhecê-lo e hostilidade 35. Expor um segredo exige uma confidência prévia, intimidade 30 e hostilidade 35. Desculpas exigem uma ofensa real, e retomar contato exige um afastamento. Encerrar namoro permanece disponível mesmo quando o relacionamento está ruim. O leque mostra cadeados e explica os valores faltantes ao focar ou selecionar uma opção bloqueada.

`js/social-autonomy.mjs` faz moradores e integrantes de gangue próximos iniciarem conversas com o jogador. Eles se aproximam com o movimento normal, respeitando paredes, distância e andar, e escolhem apresentação, assunto casual, memória, apoio, romance ou resolução de conflito conforme o vínculo. A escolha do jogador nunca é automática: o cartão oferece **Responder**, **Escolher assunto** e **Agora não**. A recusa educada não pune a relação.

Há intervalo global de 35 segundos após uma iniciativa e 120 segundos por NPC; a oferta expira após 15 segundos. NPCs reservados abordam menos. Menus, celular, direção, arma, salto e ações domésticas suspendem as abordagens. Passagens bloqueadas ou afastamento abortam a aproximação; o NPC não é teletransportado. Serviços continuam priorizando ocorrências.

Há **106 interações**: conversa casual, família, receios, sonhos, valores, segredos, passatempos, alegria, entusiasmo, humor, flerte, carinho, ciúmes, conflitos, xingamentos, crueldade, fofocas, reparação, facções, convites, contatos e situações clandestinas. Nenhum ramo do leque tem mais de oito opções. `social-content.mjs` contém os novos textos autorais, geralmente com três respostas por ação, combinados com contexto emocional e personalidade; a escolha evita repetir imediatamente a mesma variante.

## Rua, facções e investigações

No leque, **Facções, rua e polícia → Assuntos da rua** reúne perguntar pelo movimento clandestino, negociar um pacote fictício, pedir proteção comunitária, alertar sobre a presença de uma facção rival e sondar recrutamento. Compra só abre para integrantes das gangues, depois de amizade 25 e confiança 35, com até 45 de hostilidade, R$ 80 disponíveis e espaço na mochila. A cobrança usa a carteira normal; o pacote abstrato e sua quantidade ficam no salvamento social, sem receita, uso ou instrução do mundo real. A conversa de recrutamento não muda automaticamente a facção do jogador.

**Polícia e investigações** aparece no mesmo ramo, mas exige conversar com um NPC policial. Também há um atalho **Ligações → Polícia · denúncia confidencial** no celular, liberado quando existe uma pista concreta. Um relato só pode ser feito quando há um fato concreto não relatado — por enquanto, uma compra clandestina vivida pelo jogador. O policial cria um protocolo persistente com suspeito, pista e estado **Recebida · em apuração**. O jogo despacha uma ocorrência visual de diligências e mostra os protocolos e pacotes no diário **Vida social (Y)**. Uma denúncia nunca prende ou condena automaticamente. A mesma pista não pode ser denunciada duas vezes; perguntar por atualização exige ao menos um protocolo.

O registro fica em `cog-social-v1`, junto das relações, para sobreviver ao recarregamento. Os requisitos de grupo, saldo, capacidade da mochila e evidência são revalidados pelo motor central, então o diário e o leque mostram o mesmo motivo de bloqueio. O sistema não gera pistas inventadas nem acusa alguém sem o acontecimento que o jogador presenciou.

Alegria, raiva, mágoa e energia afetam respostas e aceitação; emoções diminuem gradualmente com o tempo de simulação. Gostos e personalidade alteram afinidade. Humor pode falhar com alguém irritado ou reservado. Crueldade deixa ressentimento e pode fechar a conversa por três minutos de simulação; reparação continua disponível, mas recupera confiança lentamente. Uma recusa romântica impede trocar de flerte para insistir durante 90 segundos. Zombar de um sonho afeta a próxima tentativa de conversar sobre ele. Espalhar segredos também prejudica o vínculo com outra pessoa do círculo do interlocutor. Repetição frequente diminui os ganhos mesmo alternando assuntos. Namoro continua exclusivo; pernoite nunca cria namoro ou intimidade automaticamente.

## Programas juntos

**Convites e encontros → Sair juntos** oferece passeio, café e encontro. O NPC acompanha o jogador a pé e guarda a lembrança ao concluir o tempo juntos. Rotas bloqueadas e separações interrompem o programa, sem teletransportar o acompanhante por obstáculos ou conceder o bônus de conclusão.

**Receber em casa** permite visita, jantar, noite com amigos e pernoite. É preciso ter uma residência própria com arquitetura carregada. A visita utiliza o sistema existente de chegada à entrada e navegação A* entre móveis. Cadeira/sofá e cama são reservados por convidado no térreo. Jantar exige uma porção preparada e consome a porção do convidado ao sentar, sem alimentar o jogador por engano. O pernoite coloca o modelo em repouso horizontal na cama. As durações são comprimidas: visitas/jantares, 90 segundos; noite com amigos, 120; pernoite, 180. Não há viagem externa ao restaurante nem passagem automática de uma noite inteira no calendário. Café e encontro são passeios acompanhados, sem compra automática de comida.

O leque permite terminar o passeio, cancelar com sinceridade ou dar um bolo, com consequências diferentes. NPCs em serviço recusam convites. Programas interrompidos por recarregamento não são registrados como concluídos.

## Celular e CitySocial

Trocar números e perfis depende de aceitação. Números fictícios da cidade aparecem nos Contatos, Mensagens e Ligações. O CitySocial mostra os perfis aceitos, publicações contextuais e ações de curtir/comentar que alteram os vínculos. Não há envio a pessoas reais nem a redes externas.

Mensagens livres reconhecem intenções específicas em português (desabafo, pedido de desculpas, carinho, piada, boa notícia e convite); não são um modelo de linguagem geral. Os botões de convite no SMS e frases como “Vamos jantar?” chamam o mesmo controlador físico do jogo. Se o NPC não estiver carregado, sua chegada é preparada numa calçada segura, respeitando o limite de pedestres. Falhas de chegada/navegação são informadas e interrompem o programa. O diário Y mostra os contatos, combinados e seus estados.

Last Kings e Novelis Crew começam com amizade -48 entre si; gangues e polícia, -38. Integrantes da mesma gangue começam com +28. A identidade do jogador é independente da roupa/modelo do CAS. Experiências alteram as relações individuais sem mudar automaticamente a facção inteira.

NPCs próximos conversam autonomamente, procuram companhia conforme a necessidade social cai e mantêm distância de rivais. Serviços continuam priorizando ocorrências. Os balões são sprites 3D sobre os personagens, com descarte de texturas ao terminar a fala ou remover o personagem. A população ativa conserva o limite existente de quatro pedestres.

As histórias dos 52 personagens estão em `js/npc-stories.mjs`; o motor testável em `js/social-sim.mjs`; o painel em `js/social-ui.mjs`; a integração com movimento e renderização em `js/character-webgl.mjs`. Relações, contatos, emoções, até 48 memórias por par e 40 programas são salvos localmente em `cog-social-v1`, preservando os vínculos anteriores. Não há chamadas de IA remota nem custos de API: a simulação usa regras e falas autorais. As biografias não implementam missões, empregos ou rotinas completas de The Sims.

O leque está em `js/social-pie.mjs`, sua árvore e geometria em `js/social-pie-model.mjs`, e a seleção da malha 3D em `js/social-picking.mjs`. A prévia `tests/social-pie.html` usa Aiko 3D com animação real e o mesmo picking, leque e motor social do jogo; os valores iniciais de relacionamento nessa página são demonstrativos.

Referência pesquisada: [Sims Community: Social Pie Menu](https://simscommunity.info/2023/03/03/first-look-at-the-new-social-pie-menu-coming-to-base-game/), sobre categorias e subcategorias por assunto. Interface e implementação próprias, sem reutilizar imagens ou código de The Sims.

Validação: `npm run test:social` e `npm run build`. Os testes de jornada/casa também verificam a integração de cozinha, navegação e convidados. `tests/social-phone.html` usa o celular real com dados e armazenamento isolados de demonstração.
