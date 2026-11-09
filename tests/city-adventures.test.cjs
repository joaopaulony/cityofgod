const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function storage(){
 const data=new Map();
 return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),key:i=>[...data.keys()][i],get length(){return data.size;}};
}
function node(){
 return {hidden:false,textContent:'',innerHTML:'',addEventListener(){},focus(){},querySelector:()=>node(),classList:{add(){},remove(){}}};
}
function setup(){
 const localStorage=storage(),receipts=[];
 const document={createElement:node,body:{append(){},classList:{add(){},remove(){}}},addEventListener(){},activeElement:{tagName:'BODY'}};
 const game={player:{x:100,y:100,floor:0},st:{clock:1200},input:{keys:{clear(){}},pressed:{clear(){}}}};
 const window={__game:game,CityFront:{blocked:false},CityHomeUI:{active:false},CityRealty:{dialogOpen:false},cityVehicles:{driver:false},
  CitySim:{data:{job:null,home:null}},CityUI:{notify(){}},CityLife:{money:v=>'R$ '+v,credit:(v,reason)=>{receipts.push({v,reason});return true;}}};
 const ctx=vm.createContext({window,document,localStorage,performance:{now:()=>2000},requestAnimationFrame(){},Event:class{}});
 vm.runInContext(fs.readFileSync('js/city-adventures.js','utf8'),ctx);
 window.CityAdventures.mount();
 return {window,game,receipts,localStorage};
}
test('intro has eight goals and twelve meaningful neighborhood events',()=>{
 const {window}=setup(),api=window.CityAdventures;
 assert.equal(api.MISSIONS.length,8);
 assert.equal(api.EVENTS.length,12);
 assert.equal(new Set(api.EVENTS.map(e=>e.id)).size,12);
 assert.equal('LEISURE' in api,false,'minigames artificiais removidos');
 for(const e of api.EVENTS){assert.equal(e.choices.length,3);for(const c of e.choices){assert.equal(c.length,3);assert.ok(Number.isFinite(c[1]));assert.ok(Number.isFinite(c[2]));}}
});
test('an eight-step arrival campaign advances once, persists and pays once',()=>{
 const {window,game,receipts,localStorage}=setup(),api=window.CityAdventures;
 assert.equal(api.progress.step,0);
 for(let x=100;x<=122;x+=2){game.player.x=x;api.tick(.05);}
 assert.equal(api.progress.step,1);
 api.signal('phone');
 window.CitySim.data.job='courier';api.tick(.05);
 api.signal('job');
 window.CitySim.data.home={name:'Aluguel · Casa',x:122,y:100};api.tick(.05);
 api.signal('social');api.signal('needs');api.signal('event');
 assert.equal(api.progress.step,8);
 assert.equal(receipts.length,8);
 const balance=receipts.reduce((n,r)=>n+r.v,0);
 assert.equal(balance,635);
 for(let i=0;i<20;i++)api.tick(.05);
 assert.equal(receipts.length,8);
 assert.equal(JSON.parse(localStorage.getItem('cityofgod.adventures.v1')).step,8);
});
test('a new game backs up and clears social memories and adventure progress',()=>{
 const store=storage(),window={};
 const ctx=vm.createContext({window,localStorage:store});
 vm.runInContext(fs.readFileSync('js/front-state.js','utf8'),ctx);
 store.setItem('cityofgod.adventures.v1','{"step":4}');
 store.setItem('cog-social-v1','{"relations":[1]}');
 store.setItem('cityofgod.front.settings.v1','{"quality":"high"}');
 store.setItem('other-app','keep');
 const deleted=window.CityFrontState.backupAndReset(store);
 assert.equal(deleted,2);
 assert.equal(store.getItem('cityofgod.adventures.v1'),null);
 assert.equal(store.getItem('cog-social-v1'),null);
 assert.ok(store.getItem('cityofgod.front.backup.v1').includes('cog-social-v1'));
 assert.ok(store.getItem('cityofgod.front.settings.v1'));
 assert.equal(store.getItem('other-app'),'keep');
});
test('physical apartment rent, per-floor access and renewal work without new 3D assets',()=>{
 const localStorage=storage();
 const flat={x0:98,y0:98,x1:110,y1:108,doorPt:[101,100],miaKind:'poor',architecture:{kind:'projects',levels:[
  {floor:0,rooms:[{id:'hall',use:'circulation'}]},{floor:1,rooms:[{id:'bedroom'}]},{floor:2,rooms:[{id:'bedroom'}]}]},furnished:0,
  furnishOnPurchase(){this.furnished++;}};
 const houses=[flat],document={addEventListener(){}};
 const window={addEventListener(){},dispatchEvent(){},__game:null,CityUI:{notify(){}},CityHome:{sync(){}},cityVehicles:{driver:false}};
 const ctx=vm.createContext({window,localStorage,document,houses,Event:class{constructor(name){this.type=name;}}});
 for(const file of ['js/city-life.js','js/city-sim.js','js/city-realty.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
 const st={player:{x:100,y:100,floor:0,armed:true,ammo:30,reserve:90,magState:'in'},hp:.9,food:.7,water:.7,clock:500};
 window.__game={player:st.player,st};window.CityLife.init(st);window.CitySim.init(st);window.CityRealty.init();
 const r=window.CityRealty,life=window.CityLife,sim=window.CitySim;
 assert.equal(r.multi(flat),true);
 assert.equal(r.unitRent(flat,1),160);
 st.player.x=200;
 assert.equal(r.rentStarter().ok,false,'aluguel exige proximidade da portaria');
 st.player.x=100;
 assert.equal(r.rentUnit(flat,1).ok,true);
 assert.equal(life.funds,90);
 assert.equal(sim.data.home.floor,1);
 assert.equal(sim.data.home.name.includes('virtual'),false);
 assert.equal(r.canUse(flat,1),true);
 assert.equal(r.canUse(flat,2),false,'unidade vizinha continua fechada');
 assert.equal(r.rentUnit(flat,2).ok,false,'não pode manter dois aluguéis');
 assert.equal(flat.furnished,1);
 st.clock=8*1440;r.tick(st.clock);
 assert.equal(r.lease().arrears,160,'sem dinheiro, acumula uma parcela');
 r.tick(st.clock);
 assert.equal(r.lease().arrears,160,'tick repetido não cobra novamente');
 life.credit(160,'renda');assert.equal(r.payRent().ok,true);
 assert.equal(r.lease().arrears,0);
 life.credit(200,'renda');st.clock=15*1440;r.tick(st.clock);
 assert.equal(r.lease().arrears,0,'pagamento automático sem pendência');
 assert.equal(r.lease().nextDueDay,21);
 st.player.floor=1;assert.equal(r.terminateLease().ok,false,'não entrega chave dentro do apartamento');
 st.player.floor=0;assert.equal(r.terminateLease().ok,true);
 assert.equal(r.canUse(flat,1),false);
 assert.equal(sim.data.home,null);
});
