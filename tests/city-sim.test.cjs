const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function boot(old={}){
 const store=new Map(Object.entries(old));
 const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 const window={addEventListener(){},dispatchEvent(){},cityVehicles:{driver:false}};
 const ctx=vm.createContext({window,localStorage:storage,Event:class{constructor(type){this.type=type;}}});
 vm.runInContext(fs.readFileSync('js/city-life.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync('js/city-sim.js','utf8'),ctx);
 const st={player:{x:100,y:100,armed:true,ammo:30,reserve:90,magState:'in',reloadT:-1},hp:.9,food:.8,water:.8,clock:700};
 const life=window.CityLife,sim=window.CitySim;
 life.init(st);sim.init(st);
 return {life,sim,st,store};
}
test('CitySim career pays exactly once per real-time cooldown',()=>{
 const {life,sim,st}=boot();
 assert.equal(sim.applyJob('courier').ok,true);
 const initial=life.funds,energy=st.needs.energy;
 assert.equal(sim.work().ok,true);
 assert.equal(life.funds,initial+sim.JOBS.courier.pay);
 assert.ok(st.needs.energy<energy);
 assert.equal(sim.work().ok,false);
 assert.equal(life.funds,initial+sim.JOBS.courier.pay);
});
test('home rental, service delivery and wallet are integrated atomically',()=>{
 const {life,sim,st}=boot();
 assert.equal(sim.rentApartment().ok,true);
 assert.equal(life.funds,90);
 assert.equal(sim.data.home.name.includes('virtual'),true);
 const burgers=life.inventory.burger;
 assert.equal(sim.service('pizza').ok,true);
 assert.equal(life.funds,58);
 assert.equal(life.inventory.burger,burgers+1);
 assert.equal(sim.service('adopt').ok,false);
});
test('business management is transactional and cannot collect before cooldown',()=>{
 const {life,sim}=boot();
 life.credit(2000,'saldo de teste');
 assert.equal(sim.buyBusiness('cafe').ok,true);
 assert.equal(sim.buyBusiness('cafe').ok,false);
 assert.equal(sim.manage('cafe','hire').ok,true);
 assert.equal(sim.manage('cafe','toggle').ok,true);
 assert.equal(sim.manage('cafe','collect').ok,false);
 assert.equal(sim.data.businesses.cafe.staff,1);
});
test('vehicle ownership and customization persist across reload',()=>{
 const {life,sim,store}=boot();
 life.credit(2600,'teste concessionária');
 assert.equal(sim.buyCar('compact').ok,true);
 assert.equal(sim.buyCar('compact').ok,false);
 assert.equal(sim.theme('rose','pink'),true);
 const next=boot(Object.fromEntries(store));
 assert.ok(next.sim.data.cars.includes('compact'));
 assert.equal(next.sim.data.themes.wallpaper,'rose');
 assert.equal(next.sim.data.themes.caseColor,'pink');
});
test('social feed is stored locally and user input is bounded',()=>{
 const {sim,store}=boot();
 assert.equal(sim.post('Olá mundo',null).ok,true);
 assert.equal(sim.post('    ',null).ok,false);
 assert.equal(sim.data.posts.length,1);
 const id=String(sim.data.posts[0].id);
 assert.equal(sim.like(id).ok,true);
 const next=boot(Object.fromEntries(store));
 assert.equal(next.sim.data.posts[0].likes,1);
});
test('new UI modules parse and load in page order',()=>{
 for(const file of ['js/city-sim.js','js/city-apps.js','js/city-ui.js','js/city-life.js','js/game.js','js/hud.js','js/core.js']){
   assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(file,'utf8'),{filename:file}));
 }
 const html=fs.readFileSync('index.html','utf8');
 const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 for(const src of ['js/city-life.js','js/city-sim.js','js/city-apps.js','js/city-ui.js'])
   assert.ok(scripts.includes(src),'index must load '+src);
 assert.ok(scripts.indexOf('js/city-life.js')<scripts.indexOf('js/city-sim.js'));
 assert.ok(scripts.indexOf('js/city-sim.js')<scripts.indexOf('js/city-ui.js'));
});
