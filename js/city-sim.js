// CitySim — serviços locais de RPG urbano; saldo compartilhado com CityLife.
// Não depende de backend: contratos e posts são locais ao navegador.
'use strict';
const CitySim = (() => {
  const KEY = 'cityofgod.sim.v2';
  // vagas de emprego (o trabalho de verdade fica em js/jobs.mjs: bater o ponto no local e cumprir o turno)
  const JOBS = {
    courier: { title:'Entregador de encomendas', icon:'📦', pay:450, cost:.12, place:'Central Logística City', detail:'Entregas de van na porta dos clientes' },
    taxi:    { title:'Taxista', icon:'🚕', pay:420, cost:.12, place:'Central Logística City', detail:'Corridas com passageiros pela cidade' },
    garbage: { title:'Gari da coleta', icon:'🗑️', pay:400, cost:.15, place:'Central Logística City', detail:'Coleta de lixo com o caminhão' },
    mechanic:{ title:'Mecânico', icon:'🔧', pay:520, cost:.15, place:'Oficina City Motors', detail:'Consertos na oficina da concessionária' },
    barista: { title:'Atendente da lanchonete', icon:'☕', pay:320, cost:.10, place:'Lanchonete do Hospital City of God', detail:'Atendimento e preparo de pedidos' }
  };
  const BUSINESSES = {
    cafe:  { title:'Cafeteria', icon:'☕', price:550, income:110 },
    store: { title:'Loja de bairro', icon:'🛍️', price:950, income:165 },
    food:  { title:'Restaurante', icon:'🍝', price:1600, income:240 },
    vet:   { title:'Clínica veterinária', icon:'🐕', price:2100, income:290 }
  };
  // catálogo da concessionária City Motors (e do app do celular): preço, categoria, lugares e a descrição do vendedor
  const CARS = {
    compact:  { title:'Compacto', icon:'🚗', price:18900, cat:'Urbano', seats:4, text:'Econômico, fácil de estacionar e barato de manter. O primeiro carro ideal.' },
    hatchback:{ title:'Hatchback', icon:'🚙', price:24900, cat:'Urbano', seats:5, text:'Porta-malas prático, bom consumo e direção leve no trânsito da cidade.' },
    sedan:    { title:'Sedã', icon:'🚘', price:34900, cat:'Família', seats:5, text:'Confortável e silencioso, com espaço de sobra p/ a família e viagens.' },
    wagon:    { title:'Perua', icon:'🚙', price:37900, cat:'Família', seats:5, text:'O espaço de uma SUV com a dirigibilidade de um sedã. Leva tudo.' },
    minivan:  { title:'Minivan', icon:'🚐', price:42900, cat:'Família', seats:7, text:'Sete lugares, portas largas e muito conforto p/ quem precisa de espaço.' },
    pickup:   { title:'Picape', icon:'🛻', price:58900, cat:'Trabalho', seats:5, text:'Caçamba grande e motor forte. Encara obra, sítio e estrada de terra.' },
    suv:      { title:'SUV', icon:'🚙', price:69900, cat:'Utilitário', seats:5, text:'Posição de dirigir alta, robustez e segurança em qualquer bairro.' },
    offroad:  { title:'Off-road', icon:'🚙', price:79900, cat:'Aventura', seats:5, text:'Tração e suspensão p/ morro, lama e praia. Não tem caminho ruim.' },
    coupe:    { title:'Cupê', icon:'🏎️', price:89900, cat:'Esportivo', seats:2, text:'Linhas baixas, motor nervoso e muito estilo p/ chegar no baile.' },
    silvia:   { title:'Silvia S13', icon:'🏎️', price:109900, cat:'Esportivo', seats:4, text:'Clássico japonês de tração traseira, queridinho do drift.' },
    sport:    { title:'Esportivo', icon:'🏎️', price:189900, cat:'Superesportivo', seats:2, text:'O mais rápido da loja: aceleração brutal e velocidade máxima de pista.' }
  };
  const USED_RATE = .6;   // a concessionária paga 60% do preço de tabela no usado
  const SERVICES = {
    pizza: { title:'Delivery de comida', icon:'🍕', price:32, note:'Entrega instantânea para o inventário nesta versão' },
    cleaner:{ title:'Faxineiro(a)', icon:'🧹', price:90, note:'Melhora a higiene do personagem e o estado da casa virtual' },
    gardener:{ title:'Jardineiro(a)', icon:'🌿', price:75, note:'Melhora a conservação da propriedade virtual' },
    repair:{ title:'Consertador(a)', icon:'🛠️', price:120, note:'Restaura a conservação da propriedade virtual' },
    adopt: { title:'Adotar pet', icon:'🐾', price:150, note:'Registra um pet no celular (modelo 3D ainda não disponível)' }
  };
  const initial = () => ({ job:null, lastShift:0, businesses:{}, cars:[], home:null, ownedLots:[], maintenance:100, bills:0, lastBillDay:null, posts:[], pet:null, themes:{wallpaper:'ocean', caseColor:'graphite'} });
  let state=initial(), game=null, initialized=false;
  const cap = v => Math.max(0,Math.min(1, v));
  const money = n => CityLife.money(n);
  const ok = text => ({ok:true,text});
  const fail = text => ({ok:false,text});
  const emit = () => window.dispatchEvent(new Event('city-sim-change'));
  function save() {
    try {localStorage.setItem(KEY,JSON.stringify(state));} catch (_) {}
  }
  function transact(price,reason) {
    if (price >= 0) return CityLife.debit(price,reason);
    CityLife.credit(-price,reason);
    return true;
  }
  function commit(){save();emit();}
  function init(st) {
    game=st;
    if(initialized)return api;
    initialized=true;
    try{
      const s=JSON.parse(localStorage.getItem(KEY)||'null');
      if(s && typeof s==='object'){
        if(typeof s.job==='string' && JOBS[s.job])state.job=s.job;
        if(Number.isFinite(s.lastShift))state.lastShift=s.lastShift;
        for(const [k,v] of Object.entries(s.businesses||{}))if(BUSINESSES[k])
          state.businesses[k]={open:!!v.open,staff:Math.max(0,Math.min(3,Number(v.staff)||0)),lastCollect:Math.max(0,Number(v.lastCollect)||0)};
        if(Array.isArray(s.cars))state.cars=s.cars.filter(k=>CARS[k]);
        if(s.carColors&&typeof s.carColors==='object')state.carColors=Object.fromEntries(Object.entries(s.carColors).filter(([k,v])=>CARS[k]&&/^#[0-9a-f]{6}$/i.test(v)));
        if(s.home && Number.isFinite(s.home.x)&&Number.isFinite(s.home.y)&&typeof s.home.name==='string')state.home={name:s.home.name,x:s.home.x,y:s.home.y,price:Number(s.home.price)||0,
          propertyKey:typeof s.home.propertyKey==='string'?s.home.propertyKey:null,floor:Number.isInteger(s.home.floor)?s.home.floor:0,rental:!!s.home.rental};
        if(Array.isArray(s.ownedLots))state.ownedLots=s.ownedLots.filter(x=>x&&Number.isFinite(x.x)&&Number.isFinite(x.y)&&typeof x.name==='string').slice(0,15);
        if(Number.isFinite(s.maintenance))state.maintenance=Math.max(0,Math.min(100,s.maintenance));
        if(Number.isFinite(s.bills))state.bills=Math.max(0,Math.min(10000000,s.bills));
        if(s.lastBillDay===null||Number.isInteger(s.lastBillDay))state.lastBillDay=s.lastBillDay;
        if(Array.isArray(s.posts))state.posts=s.posts.filter(x=>typeof x?.text==='string').slice(-24);
        if(typeof s.pet==='string')state.pet=s.pet.slice(0,25);
        if(['ocean','rose','midnight','sunset'].includes(s.themes?.wallpaper))state.themes.wallpaper=s.themes.wallpaper;
        if(['graphite','silver','pink','blue'].includes(s.themes?.caseColor))state.themes.caseColor=s.themes.caseColor;
      }
    }catch(_){}
    if(state.lastBillDay===null)state.lastBillDay=Math.floor(st.clock/1440);
    window.addEventListener('pagehide',save);
    return api;
  }
  function applyJob(id){
    if(!JOBS[id])return fail('Vaga indisponível');
    if(typeof window!=='undefined'&&window.CityJobs?.shift)return fail('Termine o turno atual antes de trocar de emprego');
    state.job=id;commit();
    return ok('Entrevista aprovada! Contratado(a) como '+JOBS[id].title+'. Vá até '+JOBS[id].place+' e bata o ponto (F).');
  }
  function quitJob(){
    if(!state.job)return fail('Você não tem emprego');
    if(typeof window!=='undefined'&&window.CityJobs?.shift)window.CityJobs.abandon();
    const t=JOBS[state.job]?.title;state.job=null;commit();return ok('Você pediu demissão de '+t);
  }
  function work(){
    const job=JOBS[state.job];
    if(!job)return fail('Escolha um emprego primeiro');
    const remaining=state.lastShift+240000-Date.now();
    if(remaining>0)return fail('Próximo turno em '+Math.ceil(remaining/60000)+' min (tempo real)');
    if(game.needs.energy<.18)return fail('Descanse antes de trabalhar');
    game.needs.energy=cap(game.needs.energy-job.cost);
    game.food=cap(game.food-.035);
    game.water=cap(game.water-.06);
    state.lastShift=Date.now();
    transact(-job.pay,'Salário · '+job.title);
    CityLife.save();commit();
    return ok('Turno concluído · +'+money(job.pay));
  }
  function buyBusiness(id){
    const b=BUSINESSES[id];
    if(!b||state.businesses[id])return fail('Negócio indisponível ou já adquirido');
    if(!transact(b.price,'Aquisição: '+b.title))return fail('Saldo insuficiente');
    state.businesses[id]={open:false,staff:0,lastCollect:Date.now()};
    commit();return ok(b.title+' adquirido(a)! Abra no painel de negócios.');
  }
  function manage(id,action) {
    const b=BUSINESSES[id],v=state.businesses[id];
    if(!b||!v)return fail('Você ainda não possui esse negócio');
    if(action==='toggle'){ v.open=!v.open;v.lastCollect=Date.now();commit();return ok(b.title+' · '+(v.open?'aberto':'fechado')); }
    if(action==='hire'){if(v.staff>=3)return fail('Equipe completa');if(!transact(70,'Contratação · '+b.title))return fail('É preciso R$ 70 para contratar');v.staff++;commit();return ok('Funcionário contratado');}
    if(action==='fire'){if(v.staff===0)return fail('Não há funcionários');v.staff--;commit();return ok('Funcionário desligado');}
    if(action==='collect'){
      if(!v.open)return fail('Abra o estabelecimento antes');
      if(!v.staff)return fail('Contrate pelo menos um funcionário');
      const remain=300000-(Date.now()-v.lastCollect);
      if(remain>0)return fail('Próximo fechamento de caixa em '+Math.ceil(remain/60000)+' min');
      const gross=b.income*v.staff, costs=25*v.staff, profit=gross-costs;
      v.lastCollect=Date.now();
      transact(-profit,'Lucro líquido · '+b.title);commit();
      return ok('Caixa fechado · lucro líquido '+money(profit));
    }
    return fail('Ação desconhecida');
  }
  function buyCar(id, col) {
    const c=CARS[id];
    if(!c||state.cars.includes(id))return fail('Carro indisponível ou já comprado');
    if(!transact(c.price,'Compra do veículo: '+c.title))return fail('Saldo insuficiente');
    state.cars.push(id);if(col)(state.carColors||(state.carColors={}))[id]=col;commit();return ok(c.title+' comprado! Use Entregar veículo.');
  }
  // venda do usado p/ a concessionária: 60% da tabela; o carro some do mundo
  function sellCar(id) {
    const c=CARS[id];
    if(!c||!state.cars.includes(id))return fail('Este carro não é seu');
    const V=window.cityVehicles;
    if(V?.driver&&V.modelId===id)return fail('Saia do carro antes de vendê-lo');
    const value=Math.round(c.price*USED_RATE/100)*100;
    V?.removeOwned?.(id);
    state.cars=state.cars.filter(k=>k!==id);if(state.carColors)delete state.carColors[id];
    if(typeof CityLife!=='undefined')CityLife.credit(value,'Venda do veículo: '+c.title);
    commit();return ok(c.title+' vendido por '+money(value));
  }
  const usedPrice=id=>CARS[id]?Math.round(CARS[id].price*USED_RATE/100)*100:0;
  async function deliverCar(id,at){
    if(!state.cars.includes(id))return fail('Este carro não está na sua garagem');
    const vehicle=window.cityVehicles;
    if(!vehicle?.selectModel)return fail('Carregamento 3D do veículo indisponível');
    if(vehicle.driver)return fail('Saia do carro antes de chamar outro');
    if(vehicle.deliverVehicle){const delivered=await vehicle.deliverVehicle(id,{...(at||{}),col:state.carColors?.[id]});if(delivered&&at)return ok('Seu '+CARS[id].title+' está no pátio da concessionária');return delivered?ok('Seu '+CARS[id].title+' está próximo do personagem'):fail('Não há local livre para entregar o veículo');}
    const changed=await vehicle.selectModel(id);
    if(!changed)return fail('O modelo 3D não pôde ser carregado');
    // O módulo do carro expõe a mesma instância mutável de posição.
    const pos=vehicle.car, p=game.player;
    if(pos && p){
      let found=false;
      for(const dist of [4,6,8,10,13])for(let i=0;i<16;i++){
        const a=i*Math.PI/8, x=p.x+Math.cos(a)*dist,y=p.y+Math.sin(a)*dist;
        if(world.blocked(x,y,1.3)||typeof pondVal==='function'&&pondVal(x,y)<1.2)continue;
        pos.x=x;pos.y=y;pos.speed=0;pos.steer=0;found=true;break;
      }
      if(!found)return fail('Não há local livre para entregar o veículo perto de você');
    }
    return ok('Seu '+CARS[id].title+' está próximo do personagem');
  }
  function lotKey(lot){return Math.round(lot.sign[0])+'-'+Math.round(lot.sign[1]);}
  function nearbyLots(){
    if(typeof world==='undefined'||!Array.isArray(world.lotsForSale))return [];
    return world.lotsForSale
      .filter(x=>x&&x.sign&&Number.isFinite(x.price)&&!state.ownedLots.some(o=>o.key===lotKey(x))&&!window.CityLots?.buildOf(x.id))
      .sort((a,b)=>Math.hypot(a.sign[0]-game.player.x,a.sign[1]-game.player.y)-Math.hypot(b.sign[0]-game.player.x,b.sign[1]-game.player.y))
      .slice(0,5).map(lot=>({key:lotKey(lot),id:lot.id,price:lot.price,name:'Lote '+lotKey(lot),x:lot.sign[0],y:lot.sign[1],area:lot.area}));
  }
  function buyLot(key){
    const lot=nearbyLots().find(x=>x.key===key);
    if(!lot)return fail('Lote não disponível neste bairro. Aproxime-se de uma placa VENDE-SE.');
    if(!transact(lot.price,'Compra de terreno · '+lot.name))return fail('Saldo insuficiente');
    state.ownedLots.push(lot);commit();return ok(lot.name+' comprado. Terreno registrado como seu.');
  }
  function rentApartment(){
    if(state.home)return fail('Você já tem uma residência principal');
    return window.CityRealty?.rentNearbyApartment?.() || fail('Imobiliária não está disponível');
  }
  function setHome(key) {
    const lot=state.ownedLots.find(x=>x.key===key);
    if(!lot)return fail('Terreno não encontrado');
    state.home={name:lot.name,x:lot.x,y:lot.y,price:lot.price};
    commit();return ok('Mudança registrada para '+lot.name);
  }
  function payBills(){
    if(state.bills<=0)return fail('Nenhuma conta pendente');
    if(!transact(state.bills,'Contas de residência'))return fail('Saldo insuficiente');
    state.bills=0;commit();return ok('Contas quitadas');
  }
  function destinations(){
    if(typeof world==='undefined'||!world.open||typeof OW==='undefined'||!OW.geo)return [];
    const a=OW.geo.anchors;
    return [
      {id:'downtown',name:'Centro',icon:'🏙️',x:a.downtown.x,y:a.downtown.y,price:35},
      ...a.towns.map((o,i)=>({id:'town'+i,name:o.name,icon:'🏘️',x:o.x,y:o.y,price:45})),
      {id:'airport',name:'Aeroporto',icon:'✈️',x:world.spawn[0],y:world.spawn[1],price:55},
      {id:'port',name:'Porto',icon:'⚓',x:a.port.x,y:a.port.y,price:50},
      ...(state.home?[{id:'home',name:'Minha residência',icon:'🏡',x:state.home.x,y:state.home.y,price:25}]:[])
    ];
  }
  function travel(id){
    const d=destinations().find(x=>x.id===id);
    if(!d)return fail('Destino indisponível neste mapa');
    if(window.cityVehicles?.driver)return fail('Saia do carro para chamar um táxi');
    if(CityLife.funds<d.price)return fail('Saldo insuficiente para a corrida');
    // Carga do destino antes de escolher a posição válida; corridas são transições rápidas.
    if(typeof owTeleport!=='function')return fail('Transporte disponível apenas no mundo aberto');
    const prev={x:game.player.x,y:game.player.y};
    let found=null;
    try{
      owTeleport(d.x,d.y,70);
      for(const radius of [0,8,14,22,30,45,65]){
        for(let i=0;i<24;i++){
          const x=d.x+Math.cos(i*Math.PI/12)*radius,y=d.y+Math.sin(i*Math.PI/12)*radius;
          if(OW.geo.isLand && !OW.geo.isLand(x,y))continue;
          if(typeof pondVal==='function'&&pondVal(x,y)<1.18)continue;
          if(world.blocked(x,y,.5))continue;
          found={x,y};break;
        }
        if(found)break;
      }
      if(!found){owTeleport(prev.x,prev.y,70);return fail('Não encontramos um desembarque seguro neste destino');}
      owTeleport(found.x,found.y,70);
      if(!transact(d.price,'Táxi · '+d.name)){owTeleport(prev.x,prev.y,70);return fail('Pagamento não autorizado');}
      game.player.floor=0;game.player.floorZ=0;
      game.player.wantShot=false;
      return ok('Corrida concluída · '+d.name+'. Sem animação de táxi nesta versão.');
    }catch(error){
      try{owTeleport(prev.x,prev.y,70);}catch(_){}
      return fail('Não foi possível concluir a viagem');
    }
  }
  function service(id){
    const s=SERVICES[id];if(!s)return fail('Serviço não disponível');
    if(id==='adopt'&&state.pet)return fail('Você já adotou '+state.pet);
    if(CityLife.funds<s.price)return fail('Saldo insuficiente');
    if(id==='pizza'&&!CityLife.canAdd('burger'))return fail('Mochila cheia');
    if(!transact(s.price,'Serviço: '+s.title))return fail('Não foi possível pagar');
    if(id==='pizza')CityLife.addItem('burger',1);
    if(id==='cleaner'){game.needs.hygiene=cap(game.needs.hygiene+.25);state.maintenance=Math.min(100,state.maintenance+20);}
    if(id==='gardener')state.maintenance=Math.min(100,state.maintenance+15);
    if(id==='repair')state.maintenance=100;
    if(id==='adopt')state.pet='Companheiro de quatro patas';
    CityLife.save();commit();
    return ok(s.title+' contratado(a) · '+s.note);
  }
  function post(text,hasPhoto){
    const caption=String(text||'').trim().slice(0,180);
    if(!caption)return fail('Escreva uma legenda primeiro');
    const validPhoto=typeof hasPhoto==='string' && hasPhoto.length<70000
      && hasPhoto.startsWith('data:image/jpeg;base64,') && !/[^a-z0-9+/=]/i.test(hasPhoto.slice(23));
    state.posts.push({id:Date.now()+Math.random(),text:caption,photo:validPhoto?hasPhoto:null,time:Date.now(),likes:0});
    state.posts=state.posts.slice(-24);
    commit();return ok('Publicado no CitySocial deste navegador');
  }
  function like(id){
    const p=state.posts.find(p=>String(p.id)===id);
    if(!p)return fail('Post não encontrado');
    p.likes=p.likes?0:1;commit();
    return ok(p.likes?'Publicação curtida':'Curtida removida');
  }
  function theme(wallpaper,caseColor){
    if(!['ocean','rose','midnight','sunset'].includes(wallpaper)||!['graphite','silver','pink','blue'].includes(caseColor))return false;
    state.themes={wallpaper,caseColor};commit();return true;
  }
  function tick(){
    if(!initialized||!game)return;
    const day=Math.floor(game.clock/1440);
    if(day>state.lastBillDay){
      const due=Math.min(day-state.lastBillDay,5);
      if(state.home||state.ownedLots.length) state.bills+=due*(20+state.ownedLots.length*12);
      state.lastBillDay=day;commit();
    }
  }
  const api={init,save,work,applyJob,quitJob,buyBusiness,manage,buyCar,sellCar,usedPrice,deliverCar,get cars(){return [...state.cars];},get carColors(){return {...(state.carColors||{})};},nearbyLots,buyLot,rentApartment,setHome,payBills,destinations,travel,service,post,like,theme,tick,JOBS,BUSINESSES,CARS,SERVICES,
    get data(){return state;},get game(){return game;}};
  return api;
})();
window.CitySim=CitySim;
