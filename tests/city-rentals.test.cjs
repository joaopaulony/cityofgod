const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function makeStorage(data=new Map()){
 return {data,getItem:key=>data.get(key)??null,setItem:(key,val)=>data.set(key,String(val)),removeItem:key=>data.delete(key)};
}
function boot(shared=makeStorage()){
 const H={x0:98,y0:98,x1:110,y1:108,doorPt:[101,100],miaKind:'poor',
  architecture:{kind:'projects',levels:[{floor:0,rooms:[{id:'hall',use:'circulation'}]},
   {floor:1,rooms:[{id:'room-1'}]},{floor:2,rooms:[{id:'room-2'}]}]},furnishOnPurchase(){this.furnished=true;},
  contains(x,y,f){return x>98&&x<110&&y>98&&y<108&&f>=0&&f<=2;}};
 const houses=[H],alerts=[];
 const document={addEventListener(){}};
 const window={addEventListener(){},dispatchEvent(){},CityUI:{notify:txt=>alerts.push(txt)},CityHome:{sync(){}},cityVehicles:{driver:false}};
 const context=vm.createContext({window,localStorage:shared,document,houses,Event:class{constructor(t){this.type=t;}}});
 for(const file of ['js/city-life.js','js/city-sim.js','js/city-realty.js'])
   vm.runInContext(fs.readFileSync(file,'utf8'),context);
 const st={player:{x:100,y:100,floor:0,armed:false,ammo:0,reserve:0,magState:'in'},hp:.9,food:.8,water:.8,clock:700};
 window.__game={player:st.player,st,houses};
 const life=window.CityLife,sim=window.CitySim,realty=window.CityRealty;
 life.init(st);sim.init(st);realty.init();
 return {shared,H,st,life,sim,realty,alerts};
}
test('unit selection, exclusive use and save/reload work for existing apartments',()=>{
 const data=makeStorage(),a=boot(data);
 assert.equal(a.realty.rentUnit(a.H,1).ok,true);
 assert.equal(a.life.funds,90);
 assert.equal(a.realty.canUse(a.H,1),true);
 assert.equal(a.realty.canUse(a.H,2),false);
 assert.equal(a.realty.rentUnit(a.H,2).ok,false);
 const b=boot(data);
 assert.equal(b.life.funds,90);
 assert.equal(b.sim.data.home.floor,1);
 assert.equal(b.sim.data.home.rental,true);
 assert.equal(b.realty.lease().rate,160);
 assert.equal(b.realty.canUse(b.H,1),true);
 assert.equal(b.realty.canUse(b.H,2),false);
});
test('manual prepay and automatic billing advance exactly one due period',()=>{
 const {H,st,life,realty}=boot();
 assert.equal(realty.rentUnit(H,1).ok,true);
 life.credit(200,'Salário de teste');
 assert.equal(realty.payRent().ok,true);
 assert.equal(realty.lease().nextDueDay,14);
 assert.equal(realty.toggleAutoPay().ok,true);
 assert.equal(realty.lease().autoPay,false);
 st.clock=14*1440;realty.tick(st.clock);
 assert.equal(realty.lease().arrears,160);
 realty.tick(st.clock);
 assert.equal(realty.lease().arrears,160);
 assert.equal(realty.toggleAutoPay().ok,true);
 assert.equal(realty.lease().autoPay,true);
 assert.equal(realty.payRent().ok,false,'saldo insuficiente mantém dívida');
 life.credit(200,'Salário de teste');
 assert.equal(realty.payRent().ok,true);
 assert.equal(realty.lease().arrears,0);
 st.clock=21*1440;realty.tick(st.clock);
 assert.equal(realty.lease().arrears,0);
 assert.equal(realty.lease().nextDueDay,28);
});
test('three unpaid periods cause eviction only after leaving the rented floor',()=>{
 const {H,st,life,realty,sim,alerts}=boot();
 assert.equal(realty.rentUnit(H,1).ok,true);
 st.player.floor=1;st.clock=22*1440;
 realty.tick(st.clock);
 assert.equal(realty.lease().arrears,480);
 assert.equal(realty.canUse(H,1),true,'não prende jogador dentro da casa');
 assert.equal(realty.terminateLease().ok,false,'não permite entregar chave de dentro');
 st.player.floor=0;realty.tick(st.clock);
 assert.equal(realty.lease(),null);
 assert.equal(realty.canUse(H,1),false);
 assert.equal(sim.data.home,null);
 assert.ok(alerts.some(x=>x.includes('três parcelas')));
 assert.equal(life.funds,90);
});
test('tenant can buy occupied unit and turn lease into ownership without losing access',()=>{
 const {H,st,life,realty,sim}=boot();
 assert.equal(realty.rentUnit(H,1).ok,true);
 life.credit(realty.unitPrice(H), 'Economias');
 assert.equal(realty.buyUnit(H,1).ok,true);
 assert.equal(realty.lease(),null);
 assert.equal(realty.canUse(H,1),true);
 assert.equal(sim.data.home.rental,false);
 assert.equal(sim.data.home.floor,1);
 const before=life.funds;
 st.clock=100*1440;realty.tick(st.clock);
 assert.equal(life.funds,before,'unidade própria não é cobrada como aluguel');
});
