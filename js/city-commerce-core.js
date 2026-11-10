// city-commerce-core.js — regras puras da loja online (CityWeb Marketplace / CitySeller): catálogo, estantes, atacado,
// estoque por lote, anúncios, pedidos com reserva (escrow), embalagem, frete congelado, postagem, rastreio e demanda NPC.
// Sem DOM: testável em Node (tests/city-commerce.test.cjs). Orquestração e telas em js/city-commerce.js.
(function(root){
 'use strict';
 const DAY=1440,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // ---------- configuração (recalibrada pelos preços de varejo já existentes no CityLife) ----------
 const CONFIG={
  brandFee:80,commission:.05,maxListings:[0,8,20,50,80,120],maxActiveOrders:[0,5,8,12,16,20],
  wholesale:.6,                     // atacado = 60% do varejo do CityLife
  shipDays:1,deliverDays:1,pickWindowDays:2,
  freight:{pickup:{name:'Retirada na Central',base:0,band:0},standard:{name:'Padrão',base:8,band:2},fast:{name:'Rápido',base:15,band:3}},
  freightMax:40,bandMeters:250,
  boxes:{P:{cap:4,cost:2},M:{cap:12,cost:5},G:{cap:30,cost:10}},tape:1,label:1,
  shelf:{qf_shelf_small3:4,qf_shelf_small1:4,qf_shelf_small2:4,qf_shelf_1:6,qf_shelf_2:12,shelf:14,qf_shelf_large:24,cabinet:8,qf_bookshelf:10},
  npcOrdersPerDay:[0,3,4,6,8,10],levelReq:[[0,0],[0,0],[10,0],[40,65],[120,70],[400,80]]
 };
 // ---------- catálogo: só itens que já existem e têm efeito real (MVP do plano) ----------
 const CATALOG={
  'LIFE-WATER':{name:'Água mineral',source:'water',retail:8,uve:1,band:[8,11],cat:'Bebidas'},
  'LIFE-SODA':{name:'Refrigerante',source:'soda',retail:12,uve:1,band:[12,16],cat:'Bebidas'},
  'LIFE-SANDWICH':{name:'Sanduíche',source:'sandwich',retail:18,uve:1,band:[18,23],cat:'Alimentação'},
  'LIFE-BURGER':{name:'Hambúrguer',source:'burger',retail:28,uve:1,band:[28,35],cat:'Alimentação'},
  'LIFE-SNACK':{name:'Salgadinho',source:'snack',retail:10,uve:1,band:[10,14],cat:'Alimentação'},
  'LIFE-COFFEE':{name:'Café',source:'coffee',retail:9,uve:1,band:[9,13],cat:'Bebidas'},
  'LIFE-FIRSTAID':{name:'Kit primeiros socorros',source:'firstaid',retail:55,uve:2,band:[55,70],cat:'Saúde'},
  'LIFE-SOAP':{name:'Kit de higiene',source:'soap',retail:16,uve:1,band:[16,22],cat:'Saúde'}};
 const SUPPLIERS=[
  {id:'atacadao',name:'Atacadão Central (NPC)',skus:['LIFE-WATER','LIFE-SODA','LIFE-SNACK','LIFE-COFFEE'],minQty:6,days:1},
  {id:'distrib',name:'Distribuidora Sabor (NPC)',skus:['LIFE-SANDWICH','LIFE-BURGER','LIFE-SNACK'],minQty:5,days:1},
  {id:'farma',name:'FarmaBairro Atacado (NPC)',skus:['LIFE-FIRSTAID','LIFE-SOAP','LIFE-WATER'],minQty:4,days:2}];
 // lojas NPC do marketplace (vendem ao jogador; rotuladas como NPC)
 const NPC_SHOPS=[
  {id:'npc-mercadinho',name:'Mercadinho Esperança',slug:'mercadinho-esperanca',mono:'ME',colors:['#2d8a66','#f2c14e'],emblem:'rounded',rating:4.6,skus:{'LIFE-WATER':9,'LIFE-SODA':13,'LIFE-SNACK':11,'LIFE-SANDWICH':20}},
  {id:'npc-farma',name:'FarmaBairro',slug:'farmabairro',mono:'FB',colors:['#1c6e8c','#f5f1e8'],emblem:'shield',rating:4.8,skus:{'LIFE-FIRSTAID':62,'LIFE-SOAP':18,'LIFE-WATER':10}},
  {id:'npc-cafe',name:'Café da Esquina',slug:'cafe-da-esquina',mono:'CE',colors:['#5b3a29','#e8c39e'],emblem:'circle',rating:4.7,skus:{'LIFE-COFFEE':11,'LIFE-SANDWICH':21,'LIFE-BURGER':31}}];
 const RESERVED=['admin','oficial','cityweb','correios','banco','nexobank','cityseller','suporte','prefeitura','policia'];

 const day=c=>Math.floor((Number(c)||0)/DAY);
 function rng(seed){let s=seed>>>0||1;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
 const hash=(...p)=>{let h=2166136261;for(const c of p.join('|')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
 const slugify=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30);
 const R=(ok,code,text,data)=>({ok,code,text,data});

 function newState(){return {schemaVersion:1,shop:null,shipments:[],lots:[],listings:[],orders:[],packages:[],purchases:[],ledger:[],supplies:{P:0,M:0,G:0,tape:0,label:0},seq:0,lastDemandDay:-1,reviews:[]};}
 function sanitize(raw){const s=newState();if(!raw||raw.schemaVersion!==1)return s;
  for(const k of Object.keys(s))if(raw[k]!==undefined)s[k]=raw[k];
  for(const k of ['shipments','lots','listings','orders','packages','purchases','ledger','reviews'])if(!Array.isArray(s[k]))s[k]=[];
  s.lots=s.lots.filter(l=>CATALOG[l.sku]&&l.qty>=0);return s;}
 const nextId=(s,p)=>p+'-'+(++s.seq).toString(36).padStart(4,'0');
 const levelOf=shop=>{let lv=1;for(let i=2;i<CONFIG.levelReq.length;i++)if((shop.delivered||0)>=CONFIG.levelReq[i][0]&&(shop.reputation||0)>=CONFIG.levelReq[i][1])lv=i;return lv;};

 // ---------- loja e marca ----------
 function validateBrand(b,taken=[]){
  const name=String(b?.name||'').replace(/[<>&"'`]/g,'').trim(),slug=slugify(b?.slug||name);
  if(name.length<3||name.length>30)return R(false,'NAME','O nome precisa ter de 3 a 30 caracteres.');
  if(slug.length<3)return R(false,'SLUG','Endereço curto inválido.');
  if(RESERVED.some(w=>slug===w||slug.startsWith(w+'-')))return R(false,'RESERVED','Esse endereço é reservado para canais oficiais.');
  if(taken.includes(slug))return R(false,'TAKEN','Já existe uma loja com esse endereço.');
  return R(true,'OK','',{name,slug,slogan:String(b.slogan||'').replace(/[<>&"'`]/g,'').slice(0,100),emblem:String(b.emblem||'circle'),mono:String(b.mono||name.split(/\s+/).map(w=>w[0]).join('')).replace(/[^A-Za-zÀ-ÿ0-9]/g,'').slice(0,3).toUpperCase(),
   colors:(Array.isArray(b.colors)?b.colors:[]).filter(c=>/^#[0-9a-f]{6}$/i.test(c)).slice(0,3),font:['sans','serif','display','mono'].includes(b.font)?b.font:'sans',style:['urbano','elegante','criativo'].includes(b.style)?b.style:'urbano',category:String(b.category||'Variedades').slice(0,24)});
 }
 function createShop(s,brand,addressKey,debit,clock){
  if(s.shop)return R(false,'EXISTS','Você já tem uma loja.');
  if(!addressKey)return R(false,'ADDRESS','Abra a loja dentro de um imóvel seu (comprado ou alugado).');
  const v=validateBrand(brand,NPC_SHOPS.map(x=>x.slug));if(!v.ok)return v;
  const txn='brand-fee';if(s.ledger.some(t=>t.id===txn))return R(false,'ALREADY_APPLIED','Taxa já paga.');
  if(!debit(CONFIG.brandFee,'CitySeller · registro da marca'))return R(false,'FUNDS','Saldo insuficiente para a taxa de R$ '+CONFIG.brandFee+'.');
  s.ledger.push({id:txn,kind:'brand_fee',amount:-CONFIG.brandFee,clock});
  s.shop={id:'shop-'+v.data.slug,brand:v.data,status:'open',addressKey,level:1,reputation:70,delivered:0,createdClock:clock};
  return R(true,'OK','Loja aberta! Compre mercadoria, guarde nas estantes e publique anúncios.');
 }

 // ---------- atacado e recebimento ----------
 function buyWholesale(s,supplierId,lines,debit,clock){
  const sup=SUPPLIERS.find(x=>x.id===supplierId);if(!s.shop)return R(false,'NOSHOP','Abra sua loja primeiro.');if(!sup)return R(false,'SUP','Fornecedor inválido.');
  const items=lines.filter(l=>sup.skus.includes(l.sku)&&Number.isInteger(l.qty)&&l.qty>0);if(!items.length)return R(false,'EMPTY','Escolha quantidades.');
  for(const l of items)if(l.qty<sup.minQty)return R(false,'MIN','Pedido mínimo: '+sup.minQty+' unidades por produto.');
  const cost=items.reduce((t,l)=>t+Math.round(CATALOG[l.sku].retail*CONFIG.wholesale*l.qty),0);
  const id=nextId(s,'rem');
  if(!debit(cost,'Atacado · '+sup.name))return R(false,'FUNDS','Saldo insuficiente (R$ '+cost+').');
  s.ledger.push({id:id+':cost',kind:'wholesale',amount:-cost,clock});
  s.shipments.push({id,supplier:sup.id,lines:items.map(l=>({sku:l.sku,qty:l.qty})),cost,status:'in_transit',arriveClock:clock+sup.days*DAY,clock});
  return R(true,'OK','Remessa '+id.toUpperCase()+' a caminho: chega em '+sup.days+' dia(s) de jogo no seu endereço.',{id,cost});
 }
 function tickShipments(s,clock){const out=[];for(const sh of s.shipments)if(sh.status==='in_transit'&&clock>=sh.arriveClock){sh.status='arrived';out.push(sh);}return out;}
 // conferir no endereço: vira mercadoria recebida, ainda fora da estante (não vendável)
 function receiveShipment(s,id,atAddress){
  const sh=s.shipments.find(x=>x.id===id);if(!sh)return R(false,'NF','Remessa não encontrada.');
  if(sh.status==='received')return R(false,'ALREADY_APPLIED','Remessa já conferida.');
  if(sh.status!=='arrived')return R(false,'TRANSIT','A remessa ainda está em trânsito.');
  if(!atAddress)return R(false,'AWAY','Confira a remessa no endereço da loja.');
  sh.status='received';for(const l of sh.lines)s.lots.push({id:nextId(s,'lot'),sku:l.sku,qty:l.qty,shelf:null,reserved:0,shipment:sh.id});
  return R(true,'OK','Remessa conferida. Agora guarde as unidades nas estantes.');
 }
 // ---------- estantes ----------
 const shelfCap=kind=>CONFIG.shelf[kind]||0;
 const shelfUsed=(s,shelfId)=>s.lots.filter(l=>l.shelf===shelfId).reduce((t,l)=>t+l.qty*CATALOG[l.sku].uve,0);
 function deposit(s,lotId,qty,shelf){
  const lot=s.lots.find(l=>l.id===lotId);if(!lot||lot.shelf)return R(false,'LOT','Escolha uma mercadoria recebida e ainda não guardada.');
  if(!shelf||!shelfCap(shelf.kind))return R(false,'SHELF','Esse móvel não guarda estoque.');
  qty=Math.min(qty|0,lot.qty);if(qty<1)return R(false,'QTY','Quantidade inválida.');
  const free=shelfCap(shelf.kind)-shelfUsed(s,shelf.id),fit=Math.min(qty,Math.floor(free/CATALOG[lot.sku].uve));
  if(fit<1)return R(false,'FULL','Estante cheia ('+shelfCap(shelf.kind)+' UVE).');
  const stored={id:nextId(s,'lot'),sku:lot.sku,qty:fit,shelf:shelf.id,reserved:0,shipment:lot.shipment};
  lot.qty-=fit;if(!lot.qty)s.lots.splice(s.lots.indexOf(lot),1);s.lots.push(stored);
  return R(true,'OK',fit+' × '+CATALOG[lot.sku].name+' guardados na estante.'+(fit<qty?' Faltou espaço para '+(qty-fit)+'.':''));
 }
 const available=(s,sku)=>s.lots.filter(l=>l.shelf&&l.sku===sku).reduce((t,l)=>t+l.qty-l.reserved,0);
 // ---------- anúncios ----------
 function upsertListing(s,sku,qty,price){
  if(!s.shop)return R(false,'NOSHOP','Abra sua loja primeiro.');const c=CATALOG[sku];if(!c)return R(false,'SKU','Produto inválido.');
  const lv=levelOf(s.shop);let l=s.listings.find(x=>x.sku===sku);
  if(!l&&s.listings.filter(x=>x.status!=='hidden').length>=CONFIG.maxListings[lv])return R(false,'MAX','Limite de anúncios do seu nível.');
  price=Math.round(clamp(+price||c.band[0],c.retail*.6,c.retail*2.5));qty=Math.max(0,qty|0);
  if(qty>available(s,sku))return R(false,'STOCK','Só dá para anunciar o que está guardado nas estantes ('+available(s,sku)+' disponíveis).');
  if(!l){l={id:nextId(s,'anu'),sku,qty,price,status:qty?'active':'out_of_stock'};s.listings.push(l);}else Object.assign(l,{qty,price,status:qty?'active':'out_of_stock'});
  return R(true,'OK','Anúncio publicado: '+c.name+' · R$ '+price+' · '+qty+' un.');
 }
 // reserva de estoque do pedido (lote por lote, mais antigo primeiro)
 function reserve(s,sku,qty){
  if(available(s,sku)<qty)return false;let need=qty;
  for(const l of s.lots.filter(x=>x.shelf&&x.sku===sku))if(need>0){const t=Math.min(need,l.qty-l.reserved);l.reserved+=t;need-=t;}
  return true;
 }
 const unreserve=(s,sku,qty)=>{let n=qty;for(const l of s.lots.filter(x=>x.shelf&&x.sku===sku))if(n>0){const t=Math.min(n,l.reserved);l.reserved-=t;n-=t;}};
 // ---------- frete e caixa ----------
 function freight(mode,distance){const f=CONFIG.freight[mode]||CONFIG.freight.standard;if(!f.base&&!f.band)return 0;return Math.min(CONFIG.freightMax,f.base+Math.ceil(Math.max(0,distance)/CONFIG.bandMeters)*f.band);}
 function boxFor(lines){const vol=lines.reduce((t,l)=>t+CATALOG[l.sku].uve*l.qty,0);const order=['P','M','G'],volumes=[];let left=vol;
  while(left>0){const b=order.find(k=>CONFIG.boxes[k].cap>=left)||'G';volumes.push(b);left-=CONFIG.boxes[b].cap;}return {vol,volumes};}
 // ---------- pedidos de NPC (demanda limitada e com semente por loja/dia) ----------
 function npcDemand(s,clock,buyers){
  if(!s.shop||s.shop.status!=='open')return [];const d=day(clock);if(s.lastDemandDay>=d)return [];s.lastDemandDay=d;
  const lv=levelOf(s.shop),Rn=rng(hash('demand',s.shop.id,d)),active=s.orders.filter(o=>['paid_reserved','picking','packed','labeled'].includes(o.status)).length;
  const room=CONFIG.maxActiveOrders[lv]-active,out=[];
  const want=Math.min(room,Math.floor(Rn()*(CONFIG.npcOrdersPerDay[lv]+1)));
  for(let i=0;i<want;i++){
   const ls=s.listings.filter(l=>l.status==='active'&&l.qty>0&&available(s,l.sku)>0);if(!ls.length)break;
   const l=ls[(Rn()*ls.length)|0],c=CATALOG[l.sku],priceRatio=l.price/c.retail;
   // preço acima da faixa espanta o comprador; reputação ajuda
   if(Rn()>clamp(1.35-priceRatio*.55+(s.shop.reputation-70)/200,.05,.95))continue;
   const qty=Math.min(1+((Rn()*3)|0),l.qty,available(s,l.sku));if(qty<1||!reserve(s,l.sku,qty))continue;
   l.qty-=qty;if(!l.qty)l.status='out_of_stock';
   const buyer=buyers[(Rn()*buyers.length)|0],ship=freight('standard',300+Rn()*1200);
   const o={id:nextId(s,'ped'),buyer,npc:true,lines:[{sku:l.sku,qty,unit:l.price}],escrow:l.price*qty,freight:ship,status:'paid_reserved',clock,dueClock:clock+CONFIG.pickWindowDays*DAY,tracking:null,events:[{st:'paid_reserved',clock}]};
   s.orders.push(o);out.push(o);
  }
  return out;
 }
 const ORDER_FLOW={paid_reserved:['picking','canceled_refunded'],picking:['packed','canceled_refunded'],packed:['labeled'],labeled:['accepted_at_hub'],accepted_at_hub:['in_transit'],in_transit:['delivered'],delivered:['payout_released'],payout_released:[],canceled_refunded:[]};
 function step(o,to,clock){if(o.status===to)return R(false,'ALREADY_APPLIED','Já aplicado.');if(!(ORDER_FLOW[o.status]||[]).includes(to))return R(false,'INVALID','Etapa inválida ('+o.status+' → '+to+').');o.status=to;o.events.push({st:to,clock});return R(true,'OK','');}
 // separar na estante: precisa estar perto da estante que guarda o item
 function pick(s,orderId,shelfId,clock){
  const o=s.orders.find(x=>x.id===orderId);if(!o)return R(false,'NF','Pedido não encontrado.');if(o.status!=='paid_reserved')return R(false,'STATE','Pedido não está aguardando separação.');
  for(const ln of o.lines)if(!s.lots.some(l=>l.shelf===shelfId&&l.sku===ln.sku&&l.reserved>=1))return R(false,'SHELF','Esta estante não guarda '+CATALOG[ln.sku].name+'. Procure a estante certa.');
  for(const ln of o.lines){let n=ln.qty;for(const l of s.lots.filter(x=>x.shelf&&x.sku===ln.sku))if(n>0){const t=Math.min(n,l.reserved);l.reserved-=t;l.qty-=t;n-=t;}}
  s.lots=s.lots.filter(l=>l.qty>0);
  return step(o,'picking',clock).ok?R(true,'OK','Itens do pedido '+o.id.toUpperCase()+' separados. Agora embale na mesa.'):R(false,'STATE','');
 }
 // embalar e etiquetar na mesa: caixa automática pelo volume, consome material (compra o que faltar)
 function pack(s,orderId,debit,clock){
  const o=s.orders.find(x=>x.id===orderId);if(!o||o.status!=='picking')return R(false,'STATE','Separe os itens na estante antes de embalar.');
  const b=boxFor(o.lines),need={P:0,M:0,G:0};for(const v of b.volumes)need[v]++;
  let buy=0;for(const k of ['P','M','G'])buy+=Math.max(0,need[k]-s.supplies[k])*CONFIG.boxes[k].cost;
  const n=b.volumes.length;buy+=Math.max(0,n-s.supplies.tape)*CONFIG.tape+Math.max(0,n-s.supplies.label)*CONFIG.label;
  if(buy&&!debit(buy,'Material de embalagem'))return R(false,'FUNDS','Saldo insuficiente para o material (R$ '+buy+').');
  for(const k of ['P','M','G'])s.supplies[k]=Math.max(0,s.supplies[k]-need[k]);s.supplies.tape=Math.max(0,s.supplies.tape-n);s.supplies.label=Math.max(0,s.supplies.label-n);
  if(buy)s.ledger.push({id:o.id+':pack',kind:'packaging',amount:-buy,clock});
  step(o,'packed',clock);o.tracking='CGD-'+(100000+s.seq*7%900000).toString().slice(-6)+o.id.slice(-3).toUpperCase();
  s.packages.push({id:nextId(s,'pac'),orderId:o.id,volumes:b.volumes,tracking:o.tracking,status:'labeled'});step(o,'labeled',clock);
  return R(true,'OK','Pedido embalado ('+b.volumes.join(' + ')+') e etiquetado: '+o.tracking+'. Leve à Central Logística City.',{cost:buy});
 }
 // postar no guichê da Central Logística (presença física validada pela interface)
 function post(s,atHub,clock){
  if(!atHub)return R(false,'AWAY','Vá até a Central Logística City para postar.');
  const pk=s.packages.filter(p=>p.status==='labeled');if(!pk.length)return R(false,'NONE','Nenhum pacote etiquetado para postar.');
  for(const p of pk){const o=s.orders.find(x=>x.id===p.orderId);p.status='accepted_at_hub';step(o,'accepted_at_hub',clock);step(o,'in_transit',clock);o.deliverClock=clock+CONFIG.deliverDays*DAY;}
  return R(true,'OK',pk.length+' pacote(s) postado(s). Comprovante emitido; acompanhe o rastreio no CitySeller.');
 }
 // entrega e liberação do pagamento (uma vez por pedido)
 function tickDeliveries(s,clock,credit){
  const out=[];
  for(const o of s.orders){
   if(o.status==='in_transit'&&clock>=o.deliverClock)step(o,'delivered',clock);
   if(o.status==='delivered'){
    const id=o.id+':payout';if(s.ledger.some(t=>t.id===id)){o.status='payout_released';continue;}
    const net=Math.round(o.escrow*(1-CONFIG.commission));
    s.ledger.push({id,kind:'payout',amount:net,clock});
    if(!credit(net,'CitySeller · pedido '+o.id.toUpperCase())){s.ledger.pop();continue;}
    step(o,'payout_released',clock);s.shop.delivered=(s.shop.delivered||0)+1;
    const onTime=(o.events.find(e=>e.st==='accepted_at_hub')?.clock??clock)<=o.dueClock;
    s.shop.reputation=clamp(s.shop.reputation+(onTime?1.5:-3),0,100);s.shop.level=levelOf(s.shop);
    s.reviews.push({orderId:o.id,stars:onTime?5:3,clock});out.push({order:o,net});
   }
   // prazo de separação estourado: estorna o comprador e devolve o estoque reservado
   if(o.status==='paid_reserved'&&clock>o.dueClock){for(const ln of o.lines)unreserve(s,ln.sku,ln.qty);step(o,'canceled_refunded',clock);s.shop.reputation=clamp(s.shop.reputation-5,0,100);out.push({order:o,canceled:true});}
  }
  return out;
 }
 // ---------- comprador (jogador) nas lojas NPC ----------
 function checkout(s,shopId,cart,mode,distance,debit,clock){
  const shop=NPC_SHOPS.find(x=>x.id===shopId);if(!shop)return R(false,'SHOP','Loja indisponível.');
  const lines=cart.filter(l=>shop.skus[l.sku]&&Number.isInteger(l.qty)&&l.qty>0&&l.qty<=20).map(l=>({sku:l.sku,qty:l.qty,unit:shop.skus[l.sku]}));
  if(!lines.length)return R(false,'EMPTY','Carrinho vazio.');
  const sub=lines.reduce((t,l)=>t+l.unit*l.qty,0),ship=freight(mode,distance),total=sub+ship,id=nextId(s,'cmp');
  if(!debit(total,'Compra · '+shop.name))return R(false,'FUNDS','Saldo insuficiente (R$ '+total+').');
  s.purchases.push({id,shop:shop.id,shopName:shop.name,lines,sub,freight:ship,total,mode,status:'in_transit',clock,deliverClock:clock+(mode==='fast'?.5:1)*DAY,events:[{st:'paid',clock}]});
  return R(true,'OK','Pedido '+id.toUpperCase()+' pago (R$ '+total+'). '+(mode==='pickup'?'Retire na Central Logística quando chegar.':'Entrega no seu endereço em até '+(mode==='fast'?'meio dia':'1 dia')+' de jogo.'),{id,total});
 }
 // chega: vai para a mochila se couber; senão fica para retirada (nunca some)
 function tickPurchases(s,clock,{canAdd,addItem,home}){
  const out=[];
  for(const p of s.purchases){
   if(p.status==='in_transit'&&clock>=p.deliverClock){p.status=p.mode==='pickup'||!home?'pickup_ready':'out_for_delivery';p.events.push({st:p.status,clock});}
   if(p.status==='out_for_delivery'){
    if(p.lines.every(l=>canAdd(CATALOG[l.sku].source))){for(const l of p.lines)addItem(CATALOG[l.sku].source,l.qty);p.status='delivered';p.events.push({st:'delivered',clock});out.push(p);}
    else{p.status='pickup_ready';p.events.push({st:'pickup_ready',clock});}
   }
  }
  return out;
 }
 function claim(s,atHub,{canAdd,addItem}){
  if(!atHub)return R(false,'AWAY','Retire na Central Logística City.');let n=0;
  for(const p of s.purchases.filter(x=>x.status==='pickup_ready'))if(p.lines.every(l=>canAdd(CATALOG[l.sku].source))){for(const l of p.lines)addItem(CATALOG[l.sku].source,l.qty);p.status='delivered';n++;}
  return n?R(true,'OK',n+' encomenda(s) retirada(s). Itens na mochila.'):R(false,'NONE','Nenhuma encomenda para retirar.');
 }

 const api={DAY,CONFIG,CATALOG,SUPPLIERS,NPC_SHOPS,RESERVED,day,newState,sanitize,slugify,levelOf,validateBrand,createShop,buyWholesale,tickShipments,receiveShipment,
  shelfCap,shelfUsed,deposit,available,upsertListing,reserve,unreserve,freight,boxFor,npcDemand,step,pick,pack,post,tickDeliveries,checkout,tickPurchases,claim};
 root.CityCommerceCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
