// Loja online: ciclo completo do lojista e do comprador, sem dinheiro infinito nem item duplicado.
const {test}=require('node:test'),assert=require('node:assert/strict');
const K=require('../js/city-commerce-core.js'),DAY=K.DAY;
const bank=(start=2000)=>{let f=start;return {debit:(v)=>{if(f<v)return false;f-=v;return true;},credit:(v)=>{f+=v;return true;},get funds(){return f;}};};
const shelf={id:'home#1:item-7',kind:'qf_shelf_2'};

function openShop(){const s=K.newState(),b=bank();assert.ok(K.createShop(s,{name:'Sol da Cidade',colors:['#21313a','#e2af6c']},'seed:prop#1-0',b.debit,0).ok);return {s,b};}

test('marca: nome, endereço curto reservado/duplicado e taxa cobrada uma vez',()=>{
 assert.equal(K.validateBrand({name:'Banco'}).code,'RESERVED');
 assert.equal(K.validateBrand({name:'Mercadinho Esperança'},K.NPC_SHOPS.map(x=>x.slug)).code,'TAKEN');
 assert.equal(K.createShop(K.newState(),{name:'Loja'},null,()=>true,0).code,'ADDRESS');
 const {s,b}=openShop();assert.equal(b.funds,2000-K.CONFIG.brandFee);assert.equal(K.createShop(s,{name:'Outra'},'x',b.debit,0).code,'EXISTS');
 assert.ok(!/[<>]/.test(K.validateBrand({name:'<b>Loja</b> Boa'}).data.name));
});

test('atacado → trânsito → conferir no endereço → estante; só vende o que está guardado',()=>{
 const {s,b}=openShop();
 assert.equal(K.buyWholesale(s,'atacadao',[{sku:'LIFE-WATER',qty:2}],b.debit,0).code,'MIN');
 const r=K.buyWholesale(s,'atacadao',[{sku:'LIFE-WATER',qty:10}],b.debit,100);assert.ok(r.ok);
 assert.equal(K.upsertListing(s,'LIFE-WATER',5,10).code,'STOCK','em trânsito não pode anunciar');
 assert.equal(K.receiveShipment(s,r.data.id,true).code,'TRANSIT');
 K.tickShipments(s,100+DAY);assert.equal(K.receiveShipment(s,r.data.id,false).code,'AWAY');
 assert.ok(K.receiveShipment(s,r.data.id,true).ok);assert.equal(K.receiveShipment(s,r.data.id,true).code,'ALREADY_APPLIED');
 assert.equal(K.available(s,'LIFE-WATER'),0,'recebido ainda não é vendável');
 const lot=s.lots[0];assert.ok(K.deposit(s,lot.id,10,shelf).ok);assert.equal(K.available(s,'LIFE-WATER'),10);
 assert.ok(K.upsertListing(s,'LIFE-WATER',10,10).ok);assert.equal(K.upsertListing(s,'LIFE-WATER',11,10).code,'STOCK');
});

test('estante tem capacidade em UVE',()=>{
 const {s,b}=openShop();const r=K.buyWholesale(s,'atacadao',[{sku:'LIFE-SODA',qty:20}],b.debit,0);K.tickShipments(s,DAY);K.receiveShipment(s,r.data.id,true);
 const res=K.deposit(s,s.lots[0].id,20,{id:'small',kind:'qf_shelf_small3'});assert.ok(res.ok&&/Faltou espaço para 16/.test(res.text));
 assert.equal(K.deposit(s,s.lots.find(l=>!l.shelf).id,5,{id:'small',kind:'qf_shelf_small3'}).code,'FULL');
});

test('pedido NPC: reserva, separa na estante certa, embala, posta, entrega e paga uma vez',()=>{
 const {s,b}=openShop();const r=K.buyWholesale(s,'atacadao',[{sku:'LIFE-WATER',qty:10}],b.debit,0);K.tickShipments(s,DAY);K.receiveShipment(s,r.data.id,true);
 K.deposit(s,s.lots[0].id,10,shelf);K.upsertListing(s,'LIFE-WATER',10,9);
 let orders=[];for(let d=2;d<30&&!orders.length;d++)orders=K.npcDemand(s,d*DAY,[{id:'npc-1',name:'Ana (NPC)'}]);
 assert.ok(orders.length>0,'algum NPC compra em alguns dias');
 assert.equal(K.npcDemand(s,orders[0].clock+10,[{id:'n'}]).length,0,'uma rodada de demanda por dia');
 const o=orders[0],before=K.available(s,'LIFE-WATER');
 assert.equal(K.pick(s,o.id,'outra-estante',o.clock).code,'SHELF');
 assert.ok(K.pick(s,o.id,shelf.id,o.clock).ok);assert.equal(K.available(s,'LIFE-WATER'),before,'separar não muda o disponível (já estava reservado)');
 assert.equal(K.post(s,true,o.clock).code,'NONE','sem embalar não posta');
 const funds0=b.funds;assert.ok(K.pack(s,o.id,b.debit,o.clock).ok);assert.ok(b.funds<funds0,'material de embalagem cobrado');
 assert.equal(K.post(s,false,o.clock).code,'AWAY');assert.ok(K.post(s,true,o.clock+30).ok);
 const f1=b.funds;K.tickDeliveries(s,o.clock+30+DAY,b.credit);const gain=b.funds-f1;
 assert.equal(gain,Math.round(o.escrow*(1-K.CONFIG.commission)));
 K.tickDeliveries(s,o.clock+30+2*DAY,b.credit);assert.equal(b.funds-f1,gain,'pagamento único');
 assert.equal(o.status,'payout_released');assert.equal(s.shop.delivered,1);
});

test('pedido não separado no prazo é estornado e o estoque volta',()=>{
 const {s,b}=openShop();const r=K.buyWholesale(s,'distrib',[{sku:'LIFE-SNACK',qty:8}],b.debit,0);K.tickShipments(s,DAY);K.receiveShipment(s,r.data.id,true);
 K.deposit(s,s.lots[0].id,8,shelf);K.upsertListing(s,'LIFE-SNACK',8,10);
 let orders=[];for(let d=2;d<40&&!orders.length;d++)orders=K.npcDemand(s,d*DAY,[{id:'n'}]);
 const o=orders[0],q=o.lines[0].qty,av=K.available(s,'LIFE-SNACK');
 K.tickDeliveries(s,o.dueClock+1,b.credit);assert.equal(o.status,'canceled_refunded');assert.equal(K.available(s,'LIFE-SNACK'),av+q);
});

test('comprador: frete congelado, entrega na mochila ou retirada sem sumir',()=>{
 const s=K.newState(),b=bank(500),inv={};const canAdd=()=>true,addItem=(id,q)=>{inv[id]=(inv[id]||0)+q;};
 assert.equal(K.freight('pickup',5000),0);assert.ok(K.freight('fast',800)>K.freight('standard',800));assert.ok(K.freight('fast',99999)<=K.CONFIG.freightMax);
 const r=K.checkout(s,'npc-farma',[{sku:'LIFE-SOAP',qty:2}],'standard',600,b.debit,0);assert.ok(r.ok);
 K.tickPurchases(s,DAY,{canAdd,addItem,home:true});assert.equal(inv.soap,2);
 K.checkout(s,'npc-cafe',[{sku:'LIFE-COFFEE',qty:1}],'standard',600,b.debit,0);
 K.tickPurchases(s,DAY,{canAdd:()=>false,addItem,home:true});assert.equal(s.purchases[1].status,'pickup_ready','mochila cheia: fica para retirada');
 assert.equal(K.claim(s,false,{canAdd,addItem}).code,'AWAY');assert.ok(K.claim(s,true,{canAdd,addItem}).ok);assert.equal(inv.coffee,1);
 assert.equal(K.checkout(s,'npc-cafe',[{sku:'LIFE-WATER',qty:1}],'standard',1,b.debit,0).code,'EMPTY','loja não vende esse item');
});
