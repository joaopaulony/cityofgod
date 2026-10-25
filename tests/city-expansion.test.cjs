// Regression checks: economy, bank, property data, GPS and client modules.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function boot(){
  const store=new Map();
  const document={addEventListener(){},getElementById(){return null;}};
  const window={addEventListener(){},dispatchEvent(){},cityVehicles:{driver:false}};
  const Event=class{constructor(type){this.type=type;}};
  const ctx=vm.createContext({window,document,localStorage:{
    getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)
  },Event,setTimeout(){},clearTimeout(){},Date,Math,Number});
  for(const f of ['js/city-life.js','js/city-sim.js','js/city-realty.js','js/city-gps.js','js/city-camera.js','js/city-driving.js','js/city-apps.js','js/city-extras.js'])
    vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
  const life=window.CityLife,sim=window.CitySim,extras=window.CityExtras,realty=window.CityRealty;
  const state={player:{x:10,y:10,armed:true,ammo:30,reserve:90,reloadT:-1},hp:.9,food:.7,water:.6,clock:800};
  life.init(state);sim.init(state);extras.bonus();
  return {life,sim,extras,realty,state,store,window,ctx};
}
test('new modules compile and script dependency ordering works',()=>{
 for(const f of ['js/city-realty.js','js/city-gps.js','js/city-camera.js','js/city-driving.js','js/city-extras.js','js/city-ui.js','js/hud.js','js/game.js'])
   assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(f,'utf8'),{filename:f}));
 const page=fs.readFileSync('index.html','utf8');
 const idx=part=>page.indexOf('src="'+part+'"');
 assert.ok(idx('js/city-apps.js')<idx('js/city-extras.js'));
 assert.ok(idx('js/city-extras.js')<idx('js/city-ui.js'));
 assert.ok(idx('js/city-realty.js')<idx('js/game.js'));
 assert.ok(page.includes('css/city-expansion.css'));
});
test('test bonus is awarded only once per profile',()=>{
 const {extras,life}=boot();
 assert.equal(life.funds,250250);
 extras.bonus();assert.equal(life.funds,250250);
});
test('NexoBank transfers atomically, invests and redeems',()=>{
 const {extras,life}=boot();
 let r=extras.bankMove('deposit',10000);
 assert.equal(r.ok,true);assert.equal(extras.bank.balance,10000);
 assert.equal(life.funds,240250);
 assert.equal(extras.bankMove('invest',7000).ok,true);
 assert.equal(extras.bank.balance,3000);
 assert.equal(extras.bank.savings,7000);
 assert.equal(extras.bankMove('redeem',2500).ok,true);
 assert.equal(extras.bank.balance,5500);
 assert.equal(extras.bankMove('withdraw',1500).ok,true);
 assert.equal(life.funds,241750);
 assert.equal(extras.bankMove('withdraw',999999).ok,false);
});
test('calculator parses arithmetic and refuses executable code',()=>{
 const {extras}=boot();
 assert.equal(extras.parseCalculation('12*(2+3)/4'),15);
 assert.equal(extras.parseCalculation('17-4*3'),5);
 assert.throws(()=>extras.parseCalculation('window.alert(1)'));
 assert.throws(()=>extras.parseCalculation('1/0'));
});
test('ownership records are derived from actual world doors',()=>{
 const {realty,life,ctx}=boot();
 const home={x0:9,y0:9,x1:17,y1:18,doorPt:[13,17],front:[13,19],miaKind:'bungalow',furnishOnPurchase(){this.furnished=true}};
 ctx.houses=[home];ctx.world={};ctx.CityRealty=realty; // global lexical use in vm
 realty.init();
 assert.equal(realty.residential(home),true);
 assert.equal(realty.nearby({x:13,y:18}),home);
 const before=life.funds,r=realty.buy(home);
 assert.equal(r.ok,true);assert.equal(home.furnished,true);
 assert.ok(realty.isOwned(home));assert.equal(life.funds,before-realty.price(home));
 assert.equal(realty.buy(home).ok,false);
});
test('gas station POI only receives a GPS route when a road network exists',()=>{
 const {window,ctx}=boot();
 ctx.world={open:false,roads:[],gasStations:[{brand:{name:'PACIFIC FUEL'},pumps:[{x:31,y:47}]}]};
 ctx.CityRealty={owned:{}};
 const pois=window.CityGPS.pois();
 assert.equal(pois[0].type,'gas');assert.equal(pois[0].x,31);
 // The old straight-line fallback was intentionally removed.
 assert.equal(window.CityGPS.set(pois[0]),false);
 assert.equal(window.CityGPS.target,null);
 // Give this fixture a connected street and a player position.
 vm.runInContext(fs.readFileSync('js/city-road-routing.js','utf8'),ctx);
 ctx.world.roads=[{cls:'street',pts:[[0,47],[90,47]]}];
 window.cityVehicleBridge={player:{x:20,y:47}};
 assert.equal(window.CityGPS.set(pois[0]),true);
 assert.equal(window.CityGPS.target.name,'Posto PACIFIC FUEL');
 assert.ok(window.CityGPS.route.points.length>=2);
});
