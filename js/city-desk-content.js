// city-desk-content.js — conteúdo do trabalho remoto: 12 briefs de programação, 12 chamados de suporte, 12 briefings
// de design e 12 situações de transmissão (os 48 modelos do plano), clientes NPC e formatos do CityLive.
// Só dados e funções escritas aqui (nunca código do jogador): os testes do CodeLab rodam estas funções.
(function(root){
 'use strict';
 const CLIENTS=[
  {id:'lanch',name:'Lanchonete do Zé',sector:'Alimentação',mono:'LZ'},{id:'clin',name:'Clínica Bem-Estar',sector:'Saúde',mono:'CB'},
  {id:'luar',name:'Loja Luar',sector:'Varejo',mono:'LL'},{id:'merc',name:'Mercadinho Esperança',sector:'Varejo',mono:'ME'},
  {id:'auto',name:'Auto Center Bairro',sector:'Veículos',mono:'AC'},{id:'cafe',name:'Café da Esquina',sector:'Alimentação',mono:'CE'},
  {id:'barb',name:'Barbearia Navalha',sector:'Serviços',mono:'BN'},{id:'imob',name:'CasaCerta Imóveis',sector:'Imóveis',mono:'CC'},
  {id:'ong',name:'ONG Mãos do Bairro',sector:'Comunidade',mono:'MB'},{id:'rest',name:'Restaurante Sabor da Vila',sector:'Alimentação',mono:'SV'},
  {id:'escola',name:'Escola Municipal Aurora',sector:'Educação',mono:'EA'},{id:'logi',name:'Central Logística City',sector:'Logística',mono:'CL'},
  {id:'oficina',name:'Oficina Mecânica 24h',sector:'Veículos',mono:'O24'},{id:'art',name:'Ateliê Raízes',sector:'Artesanato',mono:'AR'},
  {id:'acad',name:'Academia Força Total',sector:'Saúde',mono:'FT'},{id:'cont',name:'Escritório Contábil Prisma',sector:'Serviços',mono:'CP'}];

 // ---------- PROGRAMADOR (CodeLab): sequência, depuração, regras e interface ----------
 const PROGRAMMER=[
  {id:'PR01',title:'Organizar a fila de pedidos da lanchonete',mech:'sequence',minLevel:1,
   brief:'O sistema cobra antes de conferir os itens e às vezes manda pedidos vazios para a cozinha. Monte o fluxo na ordem certa.',
   steps:['Receber pedido','Validar itens','Calcular total','Cobrar','Enviar à cozinha','Avisar cliente'],decoys:['Imprimir cardápio'],
   constraints:[['Receber pedido','Validar itens'],['Validar itens','Calcular total'],['Calcular total','Cobrar'],['Cobrar','Enviar à cozinha'],['Enviar à cozinha','Avisar cliente']]},
  {id:'PR02',title:'Validar horário de consulta médica',mech:'rules',minLevel:1,
   brief:'A clínica atende das 8h às 18h (a última consulta começa às 17h) e só agenda em horário livre. Agendar fora disso deve ser recusado.',
   fields:{hora:'Hora pedida (0–23)',livre:'Horário livre?'},actions:['agendar','recusar'],
   palette:[{field:'hora',op:'>=',value:8},{field:'hora',op:'<',value:18},{field:'hora',op:'<',value:12},{field:'hora',op:'>',value:18},{field:'livre',op:'==',value:true},{field:'livre',op:'==',value:false}],
   cases:[{name:'9h livre',input:{hora:9,livre:true},expect:'agendar'},{name:'7h livre',input:{hora:7,livre:true},expect:'recusar'},{name:'18h livre',input:{hora:18,livre:true},expect:'recusar'},
    {name:'10h ocupado',input:{hora:10,livre:false},expect:'recusar'},{name:'17h livre',input:{hora:17,livre:true},expect:'agendar'}],ideal:3},
  {id:'PR03',title:'Corrigir botão de compra que duplica pedido',mech:'debug',minLevel:1,
   brief:'Quando o cliente clica duas vezes em “Comprar”, a loja cria dois pedidos. Cada clique leva o mesmo código de requisição.',
   code:['ao clicar(requisicao):','  criarPedido(requisicao)','  // ← clique repetido cria outro pedido'],
   options:[{label:'Desabilitar o botão só na tela',why:'Um segundo clique que chegue antes da tela atualizar ainda passa.',fn:i=>i.clicks.length},
    {label:'Registrar o código da requisição e ignorar repetidos',why:'Idempotência: o mesmo código nunca cria dois pedidos.',fn:i=>new Set(i.clicks).size},
    {label:'Esperar 1 segundo antes de gravar',why:'Atrasa, mas os dois cliques continuam gravando.',fn:i=>i.clicks.length}],
   cases:[{name:'1 clique',input:{clicks:['a']},expect:1},{name:'2 cliques iguais',input:{clicks:['a','a']},expect:1},{name:'2 compras diferentes',input:{clicks:['a','b']},expect:2},{name:'3 cliques, 2 compras',input:{clicks:['a','a','b']},expect:2}]},
  {id:'PR04',title:'Implantar alerta de estoque baixo',mech:'rules',minLevel:1,
   brief:'O mercadinho quer um aviso quando a quantidade chegar ao mínimo de 5 unidades ou ficar abaixo disso.',
   fields:{qtd:'Quantidade em estoque'},actions:['alertar','ok'],
   palette:[{field:'qtd',op:'<',value:5},{field:'qtd',op:'<=',value:5},{field:'qtd',op:'>',value:5},{field:'qtd',op:'==',value:0}],
   cases:[{name:'0 unidades',input:{qtd:0},expect:'alertar'},{name:'5 unidades',input:{qtd:5},expect:'alertar'},{name:'6 unidades',input:{qtd:6},expect:'ok'},{name:'3 unidades',input:{qtd:3},expect:'alertar'},{name:'12 unidades',input:{qtd:12},expect:'ok'}],ideal:1},
  {id:'PR05',title:'Consertar filtro de veículos por preço',mech:'debug',minLevel:1,
   brief:'Na concessionária, “até R$ 30 mil” esconde o carro de exatamente R$ 30 mil e a lista sai fora de ordem.',
   code:['filtrar(carros, max):','  return carros.filter(c => c.preco < max)'],
   options:[{label:'Trocar “<” por “<=”',why:'Inclui o preço exato, mas não ordena.',fn:i=>i.cars.filter(p=>p<=i.max)},
    {label:'Usar “<=” e ordenar do mais barato ao mais caro',why:'Inclui o limite e entrega a lista na ordem esperada.',fn:i=>i.cars.filter(p=>p<=i.max).sort((a,b)=>a-b)},
    {label:'Ordenar do mais caro ao mais barato, sem filtro',why:'Mostra carros acima do orçamento.',fn:i=>i.cars.slice().sort((a,b)=>b-a)}],
   cases:[{name:'Limite exato',input:{cars:[30,45,20],max:30},expect:[20,30]},{name:'Todos cabem',input:{cars:[12,9,15],max:20},expect:[9,12,15]},{name:'Nenhum cabe',input:{cars:[40,50],max:30},expect:[]}]},
  {id:'PR06',title:'Criar vitrine para o café do bairro',mech:'ui',minLevel:1,
   brief:'Página simples: nome do café, cardápio, horário e onde fica. O café não vende online, então nada de carrinho.',
   components:[['titulo','Título'],['cardapio','Lista de produtos'],['horario','Horário'],['mapa','Mapa/endereço'],['carrinho','Carrinho de compras'],['busca','Busca'],['banner','Banner promocional'],['chat','Chat ao vivo']],
   data:[['nome','Nome do café'],['produtos','Produtos e preços'],['horario','Horário de funcionamento'],['endereco','Endereço']],
   spec:{required:[{component:'titulo',bind:'nome',label:'título com o nome'},{component:'cardapio',bind:'produtos',label:'cardápio com os produtos'},{component:'horario',bind:'horario',label:'horário'},{component:'mapa',bind:'endereco',label:'mapa com o endereço'}],forbidden:[{component:'carrinho',label:'carrinho (não há venda online)'}],max:5}},
  {id:'PR07',title:'Cadastrar serviços da barbearia',mech:'rules',minLevel:2,
   brief:'O formulário deve aceitar só serviços com preço positivo e duração entre 15 e 120 minutos.',
   fields:{preco:'Preço (R$)',duracao:'Duração (min)'},actions:['aceitar','rejeitar'],
   palette:[{field:'preco',op:'>',value:0},{field:'preco',op:'>=',value:0},{field:'duracao',op:'>=',value:15},{field:'duracao',op:'<=',value:120},{field:'duracao',op:'<',value:15}],
   cases:[{name:'Corte 45 min R$ 55',input:{preco:55,duracao:45},expect:'aceitar'},{name:'Preço zero',input:{preco:0,duracao:30},expect:'rejeitar'},{name:'10 min',input:{preco:20,duracao:10},expect:'rejeitar'},{name:'150 min',input:{preco:200,duracao:150},expect:'rejeitar'},{name:'120 min',input:{preco:150,duracao:120},expect:'aceitar'}],ideal:3},
  {id:'PR08',title:'Conferir total de vendas diárias',mech:'debug',minLevel:2,
   brief:'O relatório do restaurante soma pedidos cancelados no faturamento do dia.',
   code:['totalDoDia(pedidos):','  return soma(pedidos.valor)'],
   options:[{label:'Somar todos os pedidos',why:'Inclui cancelados.',fn:i=>i.orders.reduce((s,o)=>s+o.v,0)},
    {label:'Somar só os pedidos não cancelados',why:'Faturamento real do dia.',fn:i=>i.orders.filter(o=>!o.cancel).reduce((s,o)=>s+o.v,0)},
    {label:'Contar a quantidade de pedidos',why:'Quantidade não é faturamento.',fn:i=>i.orders.length}],
   cases:[{name:'Sem cancelados',input:{orders:[{v:30},{v:20}]},expect:50},{name:'Um cancelado',input:{orders:[{v:30},{v:20,cancel:true},{v:10}]},expect:40},{name:'Todos cancelados',input:{orders:[{v:30,cancel:true}]},expect:0}]},
  {id:'PR09',title:'Validar código promocional',mech:'rules',minLevel:2,
   brief:'O cupom BAIRRO10 só vale em compras a partir de R$ 50. Qualquer outro código é recusado.',
   fields:{codigo:'Código digitado',total:'Total da compra (R$)'},actions:['aplicar','recusar'],
   palette:[{field:'codigo',op:'==',value:'BAIRRO10'},{field:'codigo',op:'!=',value:'BAIRRO10'},{field:'total',op:'>=',value:50},{field:'total',op:'>',value:50},{field:'total',op:'<',value:50}],
   cases:[{name:'Cupom, R$ 80',input:{codigo:'BAIRRO10',total:80},expect:'aplicar'},{name:'Cupom, R$ 50',input:{codigo:'BAIRRO10',total:50},expect:'aplicar'},{name:'Cupom, R$ 30',input:{codigo:'BAIRRO10',total:30},expect:'recusar'},{name:'Outro código',input:{codigo:'GRATIS',total:90},expect:'recusar'}],ideal:2},
  {id:'PR10',title:'Corrigir cadastro duplicado de cliente',mech:'debug',minLevel:2,
   brief:'A academia tem a mesma pessoa cadastrada duas vezes: “Ana@Mail.com” e “ana@mail.com ”.',
   code:['salvar(email):','  if (!cadastrados.has(email)) cadastrados.add(email)'],
   options:[{label:'Comparar o e-mail exatamente como veio',why:'Maiúsculas e espaços criam duplicados.',fn:i=>new Set(i.emails).size},
    {label:'Normalizar (minúsculas, sem espaços) antes de comparar',why:'A chave única passa a ser o e-mail normalizado.',fn:i=>new Set(i.emails.map(e=>e.trim().toLowerCase())).size},
    {label:'Salvar todos e limpar depois',why:'O duplicado continua entrando.',fn:i=>i.emails.length}],
   cases:[{name:'Mesmo e-mail com maiúsculas',input:{emails:['Ana@Mail.com','ana@mail.com ']},expect:1},{name:'Pessoas diferentes',input:{emails:['ana@mail.com','bia@mail.com']},expect:2},{name:'Três cadastros, dois iguais',input:{emails:['a@x.com',' A@X.com','b@x.com']},expect:2}]},
  {id:'PR11',title:'Organizar status de entrega de encomenda',mech:'sequence',minLevel:2,
   brief:'A Central Logística quer a linha do tempo da encomenda sem pular etapas. “Cancelado” não faz parte do caminho normal.',
   steps:['Pedido criado','Pago','Separado','Postado','Em trânsito','Entregue'],decoys:['Cancelado'],
   constraints:[['Pedido criado','Pago'],['Pago','Separado'],['Separado','Postado'],['Postado','Em trânsito'],['Em trânsito','Entregue']]},
  {id:'PR12',title:'Ajustar permissões de página privada',mech:'rules',minLevel:3,
   brief:'A página do escritório só pode ser aberta pelo administrador ou pelo próprio dono do documento.',
   fields:{papel:'Papel do usuário',dono:'É o dono do documento?'},actions:['permitir','negar'],
   palette:[{field:'papel',op:'==',value:'admin'},{field:'papel',op:'==',value:'visitante'},{field:'dono',op:'==',value:true},{field:'dono',op:'==',value:false}],
   cases:[{name:'Admin',input:{papel:'admin',dono:false},expect:'permitir'},{name:'Visitante dono',input:{papel:'visitante',dono:true},expect:'permitir'},{name:'Visitante qualquer',input:{papel:'visitante',dono:false},expect:'negar'},{name:'Editor sem posse',input:{papel:'editor',dono:false},expect:'negar'}],ideal:2,combineHint:'ou'}];

 // ---------- SUPORTE (HelpDesk City): ferramentas simuladas e chamados com causa raiz ----------
 const TOOLS={link:'Estado da rede (cabo)',wifi:'Teste de Wi-Fi',ping:'Ping externo',dns:'Resolução de nomes (DNS)',router:'Painel do roteador',printq:'Fila de impressão',
  proc:'Processos em execução',disk:'Espaço em disco',account:'Conta do usuário',mail:'Serviço de e-mail',version:'Versão do aplicativo',backup:'Destino do backup',display:'Entrada do monitor',hw:'Inspeção física (relato do usuário)'};
 const NORMAL={link:'Link ativo · 1 Gbps',wifi:'Conectado · sinal 82%',ping:'Resposta em 18 ms',dns:'Nomes resolvidos pelo DNS da empresa',router:'Roteador online · WAN ok',printq:'Fila vazia · impressora pronta',
  proc:'Uso de CPU 12% · memória 40%',disk:'Livre: 210 GB',account:'Conta ativa',mail:'Sincronizado há 1 min',version:'Versão compatível',backup:'Destino acessível',display:'Sinal na entrada HDMI 1',hw:'Nada de anormal relatado'};
 const ACTIONS={reconnect:'Reconectar o cabo de rede',fixdns:'Corrigir o DNS configurado',restartrouter:'Reiniciar o roteador (autorizado)',resumeq:'Retomar a fila de impressão',
  killproc:'Encerrar o processo que consome a máquina',cleantemp:'Limpar arquivos temporários',requestunlock:'Encaminhar desbloqueio ao administrador',syncmail:'Tirar o e-mail do modo offline',
  updateapp:'Atualizar o aplicativo (pacote permitido)',fixbackup:'Corrigir o destino do backup',switchinput:'Trocar a entrada do monitor',escalate:'Escalar para atendimento presencial',
  reinstall:'Reinstalar o sistema operacional',driver:'Instalar driver sem diagnóstico',factory:'Restaurar padrão de fábrica do roteador',deleteuser:'Apagar a pasta do usuário'};
 const HARM=['reinstall','driver','factory','deleteuser'];
 const SUPPORT=[
  {id:'TI01',title:'Internet cabeada não conecta',symptom:'“Meu computador mostra a rede com um X vermelho desde cedo.”',minLevel:1,priority:'P3',sla:20,
   out:{link:'SEM LINK · cabo desconectado na porta 2',ping:'Falha: rede indisponível',hw:'Usuário confirma: o cabo azul está solto atrás da mesa'},evidence:['link','hw'],
   causes:['Cabo de rede desconectado','DNS incorreto','Roteador fora do ar','Placa de rede queimada'],cause:'Cabo de rede desconectado',action:'reconnect',verify:'link',harmful:HARM,prevention:'Prender o cabo com abraçadeira'},
  {id:'TI02',title:'Site não abre, mas a rede funciona',symptom:'“O e-mail funciona, mas nenhum site abre pelo nome.”',minLevel:1,priority:'P3',sla:25,
   out:{dns:'ERRO: servidor DNS 10.0.0.99 não responde',ping:'Resposta em 20 ms (por IP)'},evidence:['dns','ping'],
   causes:['DNS incorreto','Cabo desconectado','Disco cheio','Conta bloqueada'],cause:'DNS incorreto',action:'fixdns',verify:'dns',harmful:HARM,prevention:'Usar o DNS distribuído pelo roteador'},
  {id:'TI03',title:'Wi-Fi conectado sem acesso externo',symptom:'“Todo mundo no escritório está sem internet, mas o Wi-Fi aparece conectado.”',minLevel:1,priority:'P2',sla:25,
   out:{wifi:'Conectado · sinal 90%',ping:'Falha: sem resposta da internet',router:'WAN desconectada há 40 min · reinício autorizado pelo cliente'},evidence:['ping','router'],
   causes:['Roteador sem conexão externa','DNS incorreto','Wi-Fi fraco','Antivírus bloqueando'],cause:'Roteador sem conexão externa',action:'restartrouter',verify:'ping',harmful:HARM,prevention:'Avisar a operadora se cair de novo'},
  {id:'TI04',title:'Impressora aparece offline',symptom:'“A impressora da recepção diz offline e acumula documentos.”',minLevel:1,priority:'P3',sla:20,
   out:{printq:'Fila PAUSADA · 7 documentos aguardando'},evidence:['printq'],
   causes:['Fila de impressão pausada','Sem papel','Cabo de energia solto','Driver corrompido'],cause:'Fila de impressão pausada',action:'resumeq',verify:'printq',harmful:HARM,prevention:'Não pausar a fila ao trocar o papel'},
  {id:'TI05',title:'Computador extremamente lento',symptom:'“Tudo trava, até para abrir uma pasta.”',minLevel:2,priority:'P3',sla:25,
   out:{proc:'CPU 98% · “AtualizadorFantasma.exe” usando 91%',disk:'Livre: 180 GB'},evidence:['proc'],
   causes:['Processo consumindo a CPU','Disco cheio','Pouca memória instalada','Vírus no monitor'],cause:'Processo consumindo a CPU',action:'killproc',verify:'proc',harmful:HARM,prevention:'Desativar o atualizador na inicialização'},
  {id:'TI06',title:'Disco cheio impede atualização',symptom:'“A atualização falha dizendo que não há espaço.”',minLevel:2,priority:'P3',sla:25,
   out:{disk:'Livre: 300 MB · temporários ocupando 64 GB',version:'Atualização pendente: requer 4 GB'},evidence:['disk','version'],
   causes:['Disco cheio de temporários','Versão incompatível','Conta sem permissão','Rede lenta'],cause:'Disco cheio de temporários',action:'cleantemp',verify:'disk',harmful:HARM,prevention:'Agendar limpeza mensal'},
  {id:'TI07',title:'Usuário não acessa o aplicativo',symptom:'“Minha senha não entra mais no sistema do financeiro.”',minLevel:2,priority:'P2',sla:20,
   out:{account:'BLOQUEADA por política após 5 tentativas · desbloqueio exige o administrador'},evidence:['account'],
   causes:['Conta bloqueada pela política','Aplicativo desatualizado','DNS incorreto','Teclado com defeito'],cause:'Conta bloqueada pela política',action:'requestunlock',verify:'account',harmful:HARM,prevention:'Orientar o uso do gerenciador de senhas'},
  {id:'TI08',title:'E-mail não sincroniza',symptom:'“Não chegam e-mails novos desde ontem.”',minLevel:2,priority:'P3',sla:20,
   out:{mail:'Modo OFFLINE ativado manualmente',ping:'Resposta em 22 ms'},evidence:['mail'],
   causes:['E-mail em modo offline','Caixa cheia no servidor','Cabo desconectado','Conta bloqueada'],cause:'E-mail em modo offline',action:'syncmail',verify:'mail',harmful:HARM,prevention:'Explicar onde fica o botão de modo offline'},
  {id:'TI09',title:'Aplicativo fecha sozinho',symptom:'“O programa de notas fiscais fecha logo depois de abrir.”',minLevel:3,priority:'P2',sla:30,
   out:{version:'Versão 2.1 · incompatível com o sistema (requer 2.4)',proc:'Encerrado com erro 0xC0000135'},evidence:['version','proc'],
   causes:['Versão incompatível do aplicativo','Disco cheio','Vírus','Monitor desconectado'],cause:'Versão incompatível do aplicativo',action:'updateapp',verify:'version',harmful:HARM,prevention:'Ativar atualizações do aplicativo'},
  {id:'TI10',title:'Backup não completa',symptom:'“O backup noturno sempre termina com erro.”',minLevel:3,priority:'P2',sla:30,
   out:{backup:'Destino \\\\NAS-ANTIGO indisponível (desligado em março)',disk:'Livre: 140 GB'},evidence:['backup'],
   causes:['Destino do backup indisponível','Disco local cheio','Conta bloqueada','Roteador fora do ar'],cause:'Destino do backup indisponível',action:'fixbackup',verify:'backup',harmful:HARM,prevention:'Revisar o destino ao trocar equipamentos'},
  {id:'TI11',title:'Monitor sem imagem',symptom:'“Liguei tudo e a tela diz ‘sem sinal’.”',minLevel:1,priority:'P3',sla:15,
   out:{display:'Entrada selecionada: HDMI 2 · sinal presente em HDMI 1',hw:'Usuário confirma: computador ligado e cabo no HDMI 1'},evidence:['display','hw'],
   causes:['Entrada do monitor errada','Placa de vídeo queimada','Cabo de energia solto','Driver de vídeo'],cause:'Entrada do monitor errada',action:'switchinput',verify:'display',harmful:HARM,prevention:'Travar a entrada no menu do monitor'},
  {id:'TI12',title:'Chamado exige troca de peça',symptom:'“O computador apita três vezes e não liga.”',minLevel:3,priority:'P2',sla:20,
   out:{hw:'Três bipes longos na inicialização · cheiro de queimado relatado',link:'Sem informação (máquina desligada)'},evidence:['hw'],
   causes:['Defeito físico de memória/placa','DNS incorreto','Fila de impressão','Disco cheio'],cause:'Defeito físico de memória/placa',action:'escalate',verify:'hw',harmful:HARM,prevention:'Registrar o patrimônio para a visita técnica'}];

 // ---------- DESIGNER (Brand Studio): briefings com checklist objetivo ----------
 const DESIGNER=[
  {id:'DG01',title:'Logo da cafeteria do bairro',product:'Logo',minLevel:1,ratio:'square',texts:['Café da Esquina'],shapes:['cup'],colors:['#5b3a29','#e8c39e'],small:48},
  {id:'DG02',title:'Banner de abertura do mercadinho',product:'Banner horizontal',minLevel:1,ratio:'banner',texts:['Mercadinho Esperança','Inauguração'],shapes:[],colors:['#2d8a66','#f2c14e']},
  {id:'DG03',title:'Marca de streamer iniciante',product:'Monograma + avatar',minLevel:1,ratio:'square',texts:['RX'],shapes:['circle'],colors:['#6c4bd8','#f5f1e8'],small:48},
  {id:'DG04',title:'Promoção da concessionária',product:'Peça quadrada',minLevel:2,ratio:'square',texts:['Feirão','Auto Center'],shapes:['badge'],colors:['#c94a42','#1d2427']},
  {id:'DG05',title:'Cartão de corretor',product:'Cartão profissional',minLevel:1,ratio:'card',texts:['Corretor de Imóveis','CasaCerta'],shapes:['house'],colors:['#21313a','#d8973a']},
  {id:'DG06',title:'Identidade da barbearia',product:'Paleta + logo',minLevel:2,ratio:'square',texts:['Navalha'],shapes:['scissors'],colors:['#1d2427','#c9a24a'],small:48},
  {id:'DG07',title:'Cartaz de evento cultural',product:'Cartaz vertical',minLevel:2,ratio:'portrait',texts:['Sarau na Praça','Sábado 19h'],shapes:['star'],colors:['#7a2e5a','#f2c14e']},
  {id:'DG08',title:'Selo de loja confiável',product:'Símbolo + slogan',minLevel:2,ratio:'square',texts:['Loja Verificada'],shapes:['shield'],colors:['#2d8a66','#f5f1e8'],small:48},
  {id:'DG09',title:'Miniatura de tutorial de tecnologia',product:'Thumbnail CityLive',minLevel:2,ratio:'landscape',texts:['Monte seu PC'],shapes:['bolt'],colors:['#1c3d6e','#f2c14e']},
  {id:'DG10',title:'Etiqueta de produto artesanal',product:'Etiqueta digital',minLevel:3,ratio:'card',texts:['Ateliê Raízes','Feito à mão'],shapes:['leaf'],colors:['#6b7d3a','#f5f1e8']},
  {id:'DG11',title:'Campanha para a ONG do bairro',product:'Post de campanha',minLevel:3,ratio:'square',texts:['Doe alimentos','Mãos do Bairro'],shapes:['heart'],colors:['#c94a42','#f5f1e8']},
  {id:'DG12',title:'Rebranding do restaurante',product:'Logo + aplicação',minLevel:3,ratio:'landscape',texts:['Sabor da Vila'],shapes:['ring','leaf'],colors:['#7a3b2c','#e9c46a']}];

 // ---------- STREAMER (CityLive): formatos e situações com efeitos previsíveis ----------
 const FORMATS=[
  {id:'chat',name:'Conversa com a comunidade',minLevel:1,base:{retention:4,trust:4}},{id:'diary',name:'Diário da cidade',minLevel:1,base:{trust:6,hype:-2}},
  {id:'gameplay',name:'Gameplay fictício',minLevel:2,base:{hype:8,fatigue:4}},{id:'decor',name:'Dicas de decoração',minLevel:2,base:{retention:6}},
  {id:'tech',name:'Tecnologia e tutoriais',minLevel:2,base:{trust:8}},{id:'interview',name:'Entrevista com morador',minLevel:3,base:{hype:6,trust:4}},
  {id:'shop',name:'Publicidade da sua loja',minLevel:3,base:{hype:4,trust:-2}},{id:'charity',name:'Transmissão beneficente',minLevel:4,base:{trust:10}}];
 const e=(a,r,t,h,f=0,extra={})=>({audience:a,retention:r,trust:t,hype:h,fatigue:f,...extra});
 const STREAM=[
  {id:'ST01',text:'O chat pede para mudar de assunto agora.',options:[{label:'Manter o tema e explicar por quê',fx:e(0,4,6,-2)},{label:'Mudar na hora sem explicar',fx:e(4,-4,-3,4)},{label:'Fazer enquete para decidir',fx:e(2,6,4,3)}]},
  {id:'ST02',text:'Um comentário agressivo ofende outro espectador.',options:[{label:'Moderar e lembrar as regras',fx:e(0,3,8,0)},{label:'Responder no mesmo tom',fx:e(6,-6,-10,8)},{label:'Ignorar',fx:e(0,-3,-4,0)}]},
  {id:'ST03',text:'Perguntam por que o computador fica lento ao abrir muitos programas.',options:[{label:'Explicar memória e processos em uso',fx:e(2,5,8,2)},{label:'Dizer que é vírus com certeza',fx:e(0,-2,-8,2)},{label:'Mudar de assunto',fx:e(0,-4,-2,0)}]},
  {id:'ST04',text:'A audiência começa a cair.',options:[{label:'Propor uma atividade nova',fx:e(4,6,2,6,4)},{label:'Abrir perguntas e respostas',fx:e(2,5,4,2)},{label:'Encerrar com antecedência combinada',fx:e(-4,2,4,-4,-6,{wrap:true})}]},
  {id:'ST05',text:'Uma marca oferece patrocínio de um produto que você não usaria.',options:[{label:'Recusar com transparência',fx:e(0,2,8,0)},{label:'Aceitar e anunciar como se fosse ótimo',fx:e(2,0,-12,4,0,{sponsor:{value:60,aligned:false}})},{label:'Pedir uma marca compatível com o canal',fx:e(0,2,4,2,0,{sponsor:{value:45,aligned:true}})}]},
  {id:'ST06',text:'Alguém pede o endereço de um vizinho que apareceu em outra live.',options:[{label:'Negar e proteger a privacidade',fx:e(0,2,10,0)},{label:'Dar uma pista do bairro',fx:e(4,0,-14,6)},{label:'Fazer piada e seguir',fx:e(0,0,-4,2)}]},
  {id:'ST07',text:'A conexão simulada começa a travar.',options:[{label:'Reduzir a qualidade e avisar o chat',fx:e(0,4,4,0)},{label:'Pausar 2 minutos para testar a rede',fx:e(-2,2,6,-2,-4)},{label:'Fingir que está tudo bem',fx:e(-4,-8,-6,0)}]},
  {id:'ST08',text:'Uma “notícia” da cidade explode no chat.',options:[{label:'Checar a fonte antes de comentar',fx:e(0,3,8,0)},{label:'Repercutir sem verificar',fx:e(8,0,-10,10)},{label:'Dizer que vai apurar e voltar depois',fx:e(0,2,5,1)}]},
  {id:'ST09',text:'A enquete dá um resultado inesperado.',options:[{label:'Cumprir o que o chat escolheu',fx:e(2,6,6,4)},{label:'Ignorar o resultado',fx:e(0,-6,-8,-2)},{label:'Negociar uma versão viável',fx:e(1,4,4,2)}]},
  {id:'ST10',text:'Um espectador reclama de um serviço que você citou.',options:[{label:'Ouvir e prometer verificar',fx:e(0,3,6,0)},{label:'Inventar uma solução na hora',fx:e(0,0,-8,2)},{label:'Banir o espectador',fx:e(-2,-2,-6,0)}]},
  {id:'ST11',text:'O convidado perde o interesse na conversa.',options:[{label:'Mudar para um assunto que ele domina',fx:e(2,5,4,3)},{label:'Encerrar a entrevista educadamente',fx:e(-2,2,4,-2,-4)},{label:'Insistir no mesmo assunto',fx:e(-2,-6,-2,-2)}]},
  {id:'ST12',text:'A meta de audiência foi batida!',options:[{label:'Agradecer e cumprir a promessa viável',fx:e(4,6,8,6)},{label:'Prometer algo impossível para a próxima',fx:e(6,0,-8,8)},{label:'Encerrar sem comentar',fx:e(0,-4,-2,-4)}]}];

 // briefings que citam uma empresa específica vêm sempre dela (os genéricos sorteiam o cliente)
 const OWNER={PR01:'lanch',PR02:'clin',PR03:'luar',PR04:'merc',PR05:'auto',PR06:'cafe',PR07:'barb',PR09:'luar',PR11:'logi',DG01:'cafe',DG02:'merc',DG04:'auto',DG05:'imob',DG06:'barb',DG10:'art',DG11:'ong',DG12:'rest'};
 for(const t of [...PROGRAMMER,...DESIGNER])if(OWNER[t.id])t.client=OWNER[t.id];
 const api={CLIENTS,PROGRAMMER,SUPPORT,TOOLS,NORMAL,ACTIONS,HARM,DESIGNER,FORMATS,STREAM};
 root.CityDeskContent=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
