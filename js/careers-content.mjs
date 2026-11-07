// careers-content.mjs — conteúdo das aulas (perguntas) e dos atendimentos (casos) de cada profissão.
// Pergunta: [enunciado, [opções], índice da certa]. Caso: pedido do cliente + passos do minigame.
// Passos: {type:'choice', q, options, answer} · {type:'timing', label, zone:[a,b], speed} · {type:'sequence', label, keys}
export const QUIZ={
 medic:[
  ['Qual exame avalia o ritmo elétrico do coração?',['Eletrocardiograma','Hemograma','Raio-X de tórax','Ultrassom de abdome'],0],
  ['Febre, tosse com catarro e dor ao respirar sugerem:',['Pneumonia','Enxaqueca','Gastrite','Rinite alérgica'],0],
  ['A pressão arterial normal de um adulto é próxima de:',['12 por 8','18 por 11','9 por 4','15 por 10'],0],
  ['Antes de prescrever um antibiótico, o médico deve perguntar sobre:',['Alergias a medicamentos','Time de futebol','Signo','Cor favorita'],0],
  ['Num corte com sangramento forte, o primeiro passo é:',['Comprimir o local','Lavar com água quente','Esperar parar sozinho','Dar analgésico'],0],
  ['Insulina é usada no tratamento de:',['Diabetes','Asma','Catapora','Conjuntivite'],0],
 ],
 vet:[
  ['Qual vacina protege cães contra a raiva?',['Antirrábica','V10 apenas','Gripe canina','Vermífugo'],0],
  ['A temperatura normal de um cão adulto fica em torno de:',['38 a 39 °C','35 °C','41 a 42 °C','36,5 °C'],0],
  ['Vômito, diarreia com sangue e filhote sem vacina sugerem:',['Parvovirose','Otite','Dermatite','Tártaro'],0],
  ['Qual alimento é tóxico para cães?',['Chocolate','Arroz cozido','Cenoura','Frango cozido'],0],
  ['Coceira na orelha e cabeça inclinada costumam indicar:',['Otite','Fratura','Cinomose','Cálculo renal'],0],
  ['A vermifugação de filhotes começa por volta de:',['15 dias de vida','1 ano','5 anos','Nunca é necessária'],0],
 ],
 lawyer:[
  ['O prazo para arrependimento de compra feita pela internet (CDC) é de:',['7 dias','30 dias','1 dia','90 dias'],0],
  ['Quem trabalha com carteira assinada tem direito a férias de:',['30 dias por ano','10 dias por ano','Não tem férias','60 dias'],0],
  ['A lei maior do país, que todas as outras devem respeitar, é a:',['Constituição Federal','Lei do Inquilinato','CLT','Código de Trânsito'],0],
  ['Ninguém será considerado culpado até o trânsito em julgado — esse é o princípio da:',['Presunção de inocência','Anterioridade','Publicidade','Legalidade tributária'],0],
  ['Cobrança de dívida já paga dá direito a receber de volta:',['O dobro do valor cobrado','Nada','A metade','Um pedido de desculpas apenas'],0],
  ['Contrato de aluguel é regido principalmente pela:',['Lei do Inquilinato','CLT','Código Penal','Lei Eleitoral'],0],
 ],
 mechanic:[
  ['Luz de óleo acesa no painel significa:',['Pressão de óleo baixa: parar o motor','Pneu murcho','Farol queimado','Tanque cheio'],0],
  ['Pedal de freio "esponjoso" geralmente indica:',['Ar no sistema de freio','Bateria fraca','Velas gastas','Correia nova'],0],
  ['A correia dentada sincroniza:',['Virabrequim e comando de válvulas','Rodas e volante','Rádio e alto-falantes','Faróis e lanternas'],0],
  ['Carro que "falha" e perde força pode ter:',['Velas ou bobina com defeito','Calota solta','Tapete sujo','Retrovisor quebrado'],0],
  ['Para medir a carga da bateria usamos o:',['Multímetro','Calibrador de pneus','Torquímetro','Paquímetro'],0],
  ['Barulho metálico ao frear indica:',['Pastilhas gastas','Óleo novo','Pneu calibrado','Filtro de ar limpo'],0],
 ],
 chef:[
  ['A temperatura segura para conservar alimentos na geladeira é até:',['5 °C','15 °C','25 °C','0 °C sempre'],0],
  ['Os molhos-mãe da cozinha clássica incluem o:',['Bechamel','Ketchup','Shoyu','Barbecue'],0],
  ['"Al dente" é o ponto da massa:',['Cozida, mas firme ao morder','Crua','Desmanchando','Frita'],0],
  ['Para evitar contaminação cruzada, carne crua e salada devem usar:',['Tábuas diferentes','A mesma tábua','A mesma faca sem lavar','Pano de prato'],0],
  ['Selar a carne serve para:',['Dourar a superfície e criar sabor','Deixá-la crua por dentro sempre','Tirar o sal','Congelar'],0],
  ['Brigadeiro leva:',['Leite condensado, chocolate e manteiga','Farinha e fermento','Ovo e queijo','Arroz e feijão'],0],
 ],
 barber:[
  ['O degradê (fade) é feito diminuindo o comprimento:',['De cima para baixo, gradualmente','Só no topo','Aleatoriamente','Apenas na franja'],0],
  ['A toalha quente antes da barba serve para:',['Abrir os poros e amolecer os pelos','Secar a pele','Tingir a barba','Pentear'],0],
  ['A navalha deve ser usada:',['A favor do pelo na primeira passada','Contra o pelo sempre','Sem espuma','Em pele seca'],0],
  ['O pente nº 0 na máquina deixa o cabelo com cerca de:',['0,5 a 1 mm','12 mm','2 cm','5 cm'],0],
  ['Para higienizar a máquina entre clientes, usa-se:',['Álcool 70% ou spray desinfetante','Água da torneira','Perfume','Nada'],0],
  ['Pele que forma "bolinhas" após barbear sugere:',['Foliculite / pelos encravados','Caspa','Queda de cabelo','Calvície'],0],
 ],
};
const ch=(q,options,answer)=>({type:'choice',q,options,answer});
const tm=(label,zone=[.42,.58],speed=1)=>({type:'timing',label,zone,speed});
const sq=(label,keys)=>({type:'sequence',label,keys});
// cada caso: pedido (o que o cliente diz) e os passos do atendimento
export const CASES={
 vet:[
  {ask:'Meu cachorro está vomitando e não quer comer há dois dias.',steps:[ch('Diagnóstico mais provável (filhote sem vacina, diarreia com sangue):',['Parvovirose','Otite','Fratura','Alergia de pele'],0),tm('Aplicar o soro na veia: pare na faixa verde'),sq('Curativo do acesso venoso',['W','A','S','D'])]},
  {ask:'Ele vive coçando a orelha e balançando a cabeça.',steps:[ch('O que o exame com otoscópio mostra?',['Otite com secreção','Pulgas no rabo','Dente quebrado','Olho seco'],0),sq('Limpar o ouvido e aplicar o remédio',['A','D','W','S']),tm('Dose certa de gotas: pare na faixa verde',[.45,.6])]},
  {ask:'Tá na hora das vacinas dele, doutor(a).',steps:[ch('Quais vacinas para um cão adulto?',['V10 e antirrábica','Só vermífugo','Vacina de gripe humana','Nenhuma'],0),tm('Aplicação subcutânea: pare na faixa verde',[.4,.55],1.2),ch('Próximo reforço:',['Daqui a 1 ano','Amanhã','Daqui a 10 anos','Nunca'],0)]},
  {ask:'Ele mancou depois de pular do sofá e chora quando encosta na pata.',steps:[ch('Primeiro passo:',['Palpar e pedir raio-X','Dar banho','Cortar as unhas','Mandar embora'],0),sq('Imobilizar a pata com tala',['S','W','D','A','S']),tm('Ajustar a atadura: firme, sem apertar',[.46,.6])]},
  {ask:'Comeu um pedaço grande de chocolate há meia hora!',steps:[ch('Conduta de emergência:',['Induzir o vômito e carvão ativado','Dar mais chocolate','Esperar uma semana','Dar leite'],0),tm('Dose do carvão ativado pelo peso',[.5,.63],1.3),sq('Monitorar coração e respiração',['W','W','D','A'])]},
 ],
 medic:[
  {ask:'Estou com febre, tosse com catarro e dor ao respirar.',steps:[ch('Hipótese diagnóstica:',['Pneumonia','Enxaqueca','Gastrite','Unha encravada'],0),tm('Ausculta: pare quando ouvir o estertor (faixa verde)'),ch('Conduta:',['Raio-X e antibiótico','Só repouso e mais nada','Cirurgia imediata','Colírio'],0)]},
  {ask:'Tenho dor de cabeça forte e tontura há uns dias.',steps:[tm('Aferir a pressão: pare o ponteiro em 12 por 8',[.44,.56],1.2),ch('A pressão está 17 por 11. Conduta:',['Tratar hipertensão e acompanhar','Ignorar','Dar café','Mandar correr'],0),sq('Prescrição e orientações',['W','D','S'])]},
  {ask:'Cortei a mão com uma faca na cozinha, não para de sangrar.',steps:[ch('Primeiro passo:',['Comprimir e limpar o ferimento','Lavar com álcool puro e esfregar','Deixar aberto','Pomada e pronto'],0),sq('Sutura: ponto a ponto',['A','D','A','D','S']),tm('Anestesia local na dose certa',[.42,.55])]},
  {ask:'Sinto muita sede, urino toda hora e emagreci sem motivo.',steps:[ch('Exame que confirma a suspeita:',['Glicemia em jejum','Raio-X do pé','Audiometria','Teste de visão'],0),tm('Leitura do glicosímetro: pare na faixa',[.5,.62],1.1),ch('Tratamento inicial:',['Dieta, exercício e medicação','Doce todo dia','Antialérgico','Nada'],0)]},
  {ask:'Meu filho está com manchas vermelhas e febre baixa.',steps:[ch('Hipótese mais comum com bolhas que coçam:',['Catapora','Fratura','Apendicite','Rinite'],0),ch('Orientação:',['Repouso, antitérmico, evitar coçar','Antibiótico forte','Internar na UTI','Pomada de cortisona sem avaliar'],0),tm('Dose do antitérmico pelo peso')]},
 ],
 lawyer:[
  {ask:'Comprei um celular pela internet e veio quebrado. A loja não quer trocar.',steps:[ch('Área do direito:',['Direito do Consumidor','Direito Penal','Direito Eleitoral','Direito Marítimo'],0),ch('Melhor argumento:',['Vício do produto: troca, conserto ou devolução','A loja manda e pronto','Comprar outro','Não há o que fazer'],0),tm('Audiência: fale no momento certo (faixa verde)')]},
  {ask:'Fui demitido sem justa causa e não recebi nada.',steps:[ch('Direitos devidos:',['Aviso prévio, férias, 13º e multa do FGTS','Nada','Só o último salário','Apenas um bônus'],0),sq('Montar a reclamação trabalhista',['W','A','D','S']),tm('Acordo na audiência: pare na faixa verde',[.48,.6])]},
  {ask:'O dono do apartamento quer me despejar sem aviso.',steps:[ch('Lei aplicável:',['Lei do Inquilinato','Código de Trânsito','CLT','Lei de Licitações'],0),ch('Argumento:',['Exigir notificação e prazo legal','Sair correndo','Trocar a fechadura dele','Não pagar nada'],0),tm('Negociação: pare na faixa verde')]},
  {ask:'Estão me cobrando uma dívida que eu já paguei.',steps:[ch('Direito do cliente:',['Repetição em dobro do indébito','Pagar de novo','Nada a fazer','Prisão do cobrador'],0),sq('Juntar comprovantes no processo',['D','D','W','S']),ch('Pedido extra:',['Danos morais pela cobrança abusiva','Pedir desculpas ao banco','Abrir mão do valor','Mudar de cidade'],0)]},
  {ask:'Bateram no meu carro e o motorista fugiu, tenho a placa.',steps:[ch('Primeira providência:',['Boletim de ocorrência','Esperar ele voltar','Bater no carro dele','Nada'],0),ch('Ação cabível:',['Indenização por danos materiais','Processo eleitoral','Usucapião','Divórcio'],0),tm('Sustentação oral: pare na faixa verde',[.45,.57],1.15)]},
 ],
 mechanic:[
  {ask:'O carro faz barulho de metal quando eu freio.',steps:[ch('Diagnóstico:',['Pastilhas de freio gastas','Óleo novo','Rádio quebrado','Pneu cheio'],0),sq('Trocar as pastilhas',['S','A','D','W','S']),tm('Torque da roda: pare na faixa verde',[.47,.6])]},
  {ask:'Acendeu a luz do óleo e o motor está batendo.',steps:[ch('Primeira verificação:',['Nível e pressão do óleo','Calibragem dos pneus','Palhetas','Farol'],0),sq('Trocar óleo e filtro',['D','S','W','A']),tm('Completar o nível certo na vareta',[.5,.62],1.1)]},
  {ask:'Ele falha e perde força na subida.',steps:[ch('Causa provável:',['Velas ou bobina com defeito','Tapete sujo','Calota solta','Buzina fraca'],0),sq('Trocar as velas',['W','W','S','D']),tm('Aperto da vela: pare na faixa verde',[.44,.56],1.2)]},
  {ask:'De manhã o carro não pega, só faz "tec tec".',steps:[ch('Teste:',['Medir a bateria com multímetro','Trocar o volante','Lavar o motor','Nada'],0),tm('Leitura do multímetro: pare em 12,6 V',[.52,.64]),sq('Trocar a bateria',['A','S','D','W'])]},
  {ask:'O volante treme acima de 80 km/h.',steps:[ch('Serviço indicado:',['Balanceamento e alinhamento','Troca de óleo','Troca do rádio','Lavagem'],0),tm('Peso do balanceamento: pare na faixa',[.46,.58],1.25),sq('Alinhar a direção',['A','D','A','D'])]},
 ],
 chef:[
  {ask:'Um prato executivo: arroz, feijão, bife e salada, por favor.',steps:[ch('Ponto do bife pedido "ao ponto":',['Rosado por dentro','Cru e frio','Torrado','Cozido em água'],0),tm('Selar o bife: tire na faixa dourada'),sq('Montar o prato',['A','S','D','W'])]},
  {ask:'Quero uma massa ao sugo bem caprichada.',steps:[ch('Ponto ideal da massa:',['Al dente','Desmanchando','Crua','Frita'],0),tm('Escorrer no tempo certo',[.45,.58],1.15),sq('Finalizar: molho, manjericão e queijo',['D','W','S'])]},
  {ask:'Uma moqueca para dois, sem pimenta.',steps:[ch('Base da moqueca baiana:',['Azeite de dendê e leite de coco','Shoyu e gengibre','Creme de leite e ketchup','Maionese'],0),sq('Montar as camadas na panela de barro',['S','D','D','A','W']),tm('Fogo baixo: pare na faixa verde',[.4,.52])]},
  {ask:'Tem sobremesa? Quero um petit gâteau.',steps:[ch('Segredo do petit gâteau:',['Assar pouco: casca firme, centro cremoso','Assar 1 hora','Fritar','Congelar cru'],0),tm('Tirar do forno no ponto exato',[.48,.58],1.3),sq('Empratar com sorvete e calda',['W','A','D'])]},
  {ask:'Uma feijoada completa!',steps:[ch('Acompanhamentos tradicionais:',['Arroz, couve, farofa e laranja','Batata frita e ketchup','Sushi','Pão de alho'],0),sq('Servir na ordem certa',['A','S','D','W','S']),tm('Ponto do torresmo: pare na faixa verde',[.44,.57],1.2)]},
 ],
 barber:[
  {ask:'Quero um degradê bem baixinho dos lados, em cima com volume.',steps:[ch('Corte pedido:',['Low fade com topo texturizado','Raspar tudo','Franja longa','Corte de cuia'],0),tm('Passar a máquina no 0: pare na faixa',[.45,.57],1.1),tm('Esfumar a transição: pare na faixa',[.47,.58],1.25)]},
  {ask:'Só a barba, bem alinhada, com toalha quente.',steps:[sq('Toalha quente, espuma e navalha',['W','S','W','S']),ch('Primeira passada da navalha:',['A favor do pelo','Contra o pelo','Sem espuma','Em pele seca'],0),tm('Desenhar a linha da barba',[.46,.58],1.2)]},
  {ask:'Corte social, pra uma entrevista de emprego amanhã.',steps:[ch('Estilo indicado:',['Social clássico com risca lateral','Moicano colorido','Raspado com desenhos','Black power gigante'],0),tm('Tesoura no comprimento certo'),sq('Finalizar com pomada e pente',['D','A','W'])]},
  {ask:'Quero aquele navalhado com risquinho na lateral.',steps:[tm('Máquina na lateral: pare na faixa',[.44,.56],1.15),sq('Desenhar o risco com a navalha',['A','A','D','S','W']),ch('Higiene depois do corte:',['Álcool 70% na máquina','Assoprar a lâmina','Nada','Água fria'],0)]},
  {ask:'Corta só as pontinhas e acerta a franja, por favor.',steps:[ch('Técnica para tirar pouco comprimento:',['Corte com tesoura nas pontas','Máquina 0','Navalha no topo','Raspar a nuca'],0),tm('Altura da franja',[.48,.6],1.2),sq('Escova e finalização',['S','W','D'])]},
 ],
};
// nomes de clientes que contam o problema (o NPC também fala)
export const GREET={vet:'Doutor(a), preciso de ajuda com meu cachorro.',medic:'Bom dia, doutor(a).',lawyer:'Bom dia, doutor(a). Preciso de um advogado.',mechanic:'Opa, mestre! Dá uma olhada no meu carro?',chef:'Boa noite! Mesa pra um, por favor.',barber:'E aí! Tem horário pra agora?'};
