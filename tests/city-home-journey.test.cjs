const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function fixture(withDoor=true){
 const H={x0:0,y0:0,x1:14,y1:12,_architectureFurnished:true,architecture:{
   toLocal:(x,y)=>[x,y],toWorld:(x,y)=>[x,y],levels:[{entry:[2,6],z:0,
    rooms:[{id:'left',x0:0,y0:0,x1:6,y1:12,use:'living'},{id:'right',x0:6,y0:0,x1:14,y1:12,use:'bedroom'}],
    walls:[{a:[6,0],b:[6,12],openings:withDoor?[{kind:'door',at:6,width:1.7}]:[]}]}]},
  seed:1};
 const sofa={id:'sofa',kind:'sofa',x:10,y:7.4,w:2,d:1,h:.8,rot:0,floor:0,status:'placed',solid:true};
 const table={id:'table',kind:'table',x:3.4,y:4.1,w:1.8,d:1.4,h:.8,rot:0,floor:0,status:'placed',solid:true};
 const furniture=[sofa,table],events=[],player={x:2,y:8,face:0,floor:0,speed:0,phase:0,armed:true};
 const mem=new Map(),window={};
 const ctx=vm.createContext({window,world:{version:1},console,Math,Date,performance:{now:()=>1000},
   localStorage:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)}});
 window.window=window;window.__game={player,food:.5,needs:{energy:.5}};
 window.cityVehicleBridge={player,actors:[player]};window.CityUI={notify:t=>events.push(t)};
 ctx.CityHome={owned:()=>true,placed:()=>furniture,find:(_,id)=>furniture.find(i=>i.id===id),
    key:()=> 'fixture',catalog:{sofa:{name:'Sofá'}}};
 window.CityHome=ctx.CityHome;
 ctx.CityLife={funds:1000,state:window.__game,debit(v){if(this.funds<v)return false;this.funds-=v;return true;},
  credit(v){this.funds+=v;return true;},money:v=>'R$ '+v,save(){}};
 ctx.Event=class{};
 vm.runInContext(read('js/city-home-nav.js'),ctx);
 vm.runInContext(read('js/city-home-kitchen.js'),ctx);
 let completed=0;
 window.CityHomePlus={data:()=>({guestMode:'friends',guests:['Lucas']}),completeActivity(){completed++;return {ok:true,text:'Concluído'};}};
 vm.runInContext(read('js/city-home-routine.js'),ctx);
 vm.runInContext(read('js/city-home-visitors.js'),ctx);
 return {ctx,H,player,sofa,table,furniture,events,window,completed:()=>completed};
}
test('A* traverses the actual opening between rooms, not through walls',()=>{
 const f=fixture();
 const nav=f.window.CityHomeNav;
 const route=nav.route(f.H,{x:2,y:8},{x:11,y:8});
 assert.ok(route&&route.points.length>=3,'expected a connected path through the door');
 let crosses=0;
 for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i];
   if((a.x-6)*(b.x-6)>0||Math.abs(a.x-b.x)<1e-7)continue;
   const t=(6-a.x)/(b.x-a.x),y=a.y+(b.y-a.y)*t;
   if(t>=0&&t<=1){crosses++;assert.ok(Math.abs(y-6)<.9,'crossed wall outside the doorway at y='+y);}
 }
 assert.ok(crosses>0,'did not cross partition');
 assert.equal(fixture(false).window.CityHomeNav.route(fixture(false).H,{x:2,y:8},{x:11,y:8}),null);
});
test('interior approach respects furniture collision and chooses an adjacent stand point',()=>{
 const f=fixture(),nav=f.window.CityHomeNav;
 const result=nav.approach(f.H,f.player,f.sofa);
 assert.ok(result,'sofa should be accessible from hall');
 assert.ok(Math.hypot(result.stand.x-f.sofa.x,result.stand.y-f.sofa.y)>.7);
 assert.ok(result.distance>0&&result.cells<14000);
 assert.ok(result.points.length>=2);
});
test('guided character walks, then receives the reward only after completing animation',()=>{
 const f=fixture();
 const result=f.window.CityHomeRoutine.start(f.H,f.sofa,'sit');
 assert.equal(result.ok,true,result.text);
 assert.equal(f.completed(),0);
 assert.equal(f.player.armed,false);
 for(let i=0;i<500&&f.window.CityHomeRoutine.active;i++)
   f.window.CityHomeRoutine.tick(.05,f.player,(x,y)=>[x,y],false);
 assert.equal(f.completed(),1,'action must finish exactly once');
 assert.equal(f.window.CityHomeRoutine.active,false);
 assert.equal(f.player.armed,true,'weapon state restored after interaction');
 assert.ok(Math.hypot(f.player.x-f.sofa.x,f.player.y-f.sofa.y)<2.6);
});
test('manual movement cancels autopilot without granting rewards',()=>{
 const f=fixture();
 assert.equal(f.window.CityHomeRoutine.start(f.H,f.sofa,'sleep').ok,true);
 f.window.CityHomeRoutine.tick(.05,f.player,(x,y)=>[x,y],true);
 assert.equal(f.window.CityHomeRoutine.active,false);
 assert.equal(f.completed(),0);
 assert.equal(f.player.armed,true);
});
test('groceries are paid, cooking consumes once, and meals require a portion',()=>{
 const f=fixture(),k=f.window.CityHomeKitchen;
 const original=JSON.stringify(k.pantry(f.H).stock);
 assert.equal(k.prepare(f.H,'omelette').ok,true);
 assert.equal(JSON.stringify(k.pantry(f.H).stock),original,'preparation must not spend ingredients');
 assert.equal(k.cook(f.H,'omelette').ok,true);
 assert.equal(k.pantry(f.H).portions,1);
 assert.equal(k.cook(f.H,'omelette').ok,false,'second omelette requires groceries');
 assert.equal(k.eat(f.H).ok,true);
 assert.equal(k.eat(f.H).ok,false,'cannot eat the same portion twice');
 assert.equal(f.ctx.CityLife.funds,1000);
 assert.equal(k.bundle(f.H,'breakfast').ok,true);
 assert.equal(f.ctx.CityLife.funds,955);
 assert.equal(k.cook(f.H,'omelette').ok,true);
});
test('local NPC visits follow a walkable route and clean up the actor state',()=>{
 const f=fixture();
 const guest={name:'Lucas',x:55,y:55,face:1,floor:0,floorZ:0,armed:false,speed:0,phase:0};
 f.window.cityVehicleBridge.actors.push(guest);
 const start=f.window.CityHomeVisitors.invite(f.H,'Lucas');
 assert.equal(start.ok,true,start.text);
 for(let i=0;i<650&&f.window.CityHomeVisitors.active.includes('Lucas');i++)
   f.window.CityHomeVisitors.tick(.075,guest,(x,y,nx,ny)=>[nx,ny]);
 assert.equal(f.window.CityHomeVisitors.active.length,0);
 assert.equal(guest.x,55);assert.equal(guest.y,55);
 assert.equal(guest.homeAction,null);
});
test('PBR upgrades reuse shared indoor materials and keep cheaper city shaders',()=>{
 const props=read('js/props-3d.mjs');
 assert.match(props,/new THREE\.MeshStandardMaterial\(\{vertexColors:true,roughness:\.92/);
 assert.match(props,/normalMap:wovenNormal/);
 assert.match(props,/const indoorMaterial=/);
 assert.match(props,/def\?\.dims\?indoorMaterial\(name\):matBody/);
 assert.match(props,/new THREE\.MeshLambertMaterial\(\{ vertexColors: true \}/);
 assert.match(props,/photoCache\.size>72/);
 assert.match(read('js/city-home-plus.js'),/completeActivity\(H,id,kind/);
});
test('all runtime scripts load before game and explicit abort is wired',()=>{
 const html=read('index.html'),code=read('js/game.js');
 const deps=['js/city-home.js','js/city-home-nav.js','js/city-home-kitchen.js',
  'js/city-home-plus.js','js/city-home-routine.js','js/city-home-visitors.js','js/city-home-ui.js','js/game.js'];
 const spots=deps.map(d=>html.indexOf('src="'+d+'"'));
 assert.ok(spots.every((n,i)=>n>=0&&(!i||n>spots[i-1])),spots.join(','));
 assert.match(code,/CityHomeRoutine\?\.tick/);
 assert.match(code,/CityHomeVisitors\?\.tick/);
 assert.match(code,/manualHomeInput/);
 assert.match(read('js/city-home-ui.js'),/\['use','recipe','eat','npcvisit'\]/);
});

test('realty drafts never sell a property or mutate the wallet',()=>{
 const f=fixture();f.ctx.houses=[f.H];f.ctx.CityRealty={price:()=>30000};
 vm.runInContext(read('js/city-home-plus.js'),f.ctx);
 const realty=f.window.CityHomePlus,initial=f.ctx.CityLife.funds;
 const listing=realty.listing(f.H,'sale',30000);
 assert.equal(listing.ok,true,listing.text);
 assert.equal(realty.data(f.H).listing.status,'draft');
 assert.equal(realty.data(f.H).listing.price,30000);
 assert.equal(realty.listing(f.H,'sale',500000).ok,false);
 assert.equal(realty.listing(f.H,'rent',250).ok,true);
 assert.equal(realty.withdrawListing(f.H).ok,true);
 assert.equal(realty.data(f.H).listing,null);
 assert.equal(f.ctx.CityLife.funds,initial);
 assert.equal(f.window.CityHome.owned(f.H),true);
});
