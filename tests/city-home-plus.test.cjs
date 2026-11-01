const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function fixture(owner=true){
 const memory=new Map(),store={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 const H={x0:0,y0:0,x1:18,y1:16,_architectureFurnished:true,interactables:[],seed:32,
   contains:(x,y)=>x>=0&&y>=0&&x<=18&&y<=16,
   architecture:{width:18,depth:16,toLocal:(x,y)=>[x,y],toWorld:(x,y)=>[x,y],
    levels:[{z:0,rooms:[{id:'living',x0:0,y0:0,x1:18,y1:16,use:'living'}],walls:[],segments:[]}]}};
 const houses=[H],boxes=[],world={seed:84,segs:[],upperSegs:[],open:false,version:0};
 const player={x:2,y:2,floor:0},game={player,food:.6,water:.8,hp:.8,clock:3000,needs:{}};
 const context=vm.createContext({window:{dispatchEvent(){},__game:game},houses,boxes,world,
  localStorage:store,Math,Date,Event:class{},console,performance:{now:()=>1000}});
 context.CityRealty={id:()=> 'house01',price:()=>30000,isOwned:()=>owner};
 context.CityLife={funds:75000,money:v=>'R$ '+v,debit(v){if(this.funds<v)return false;this.funds-=v;return true;},
    credit(v){this.funds+=v;return true;},interior(){},save(){}};
 context.CitySim={game};
 context.addBox=r=>{boxes.push(r);if(r.solid!==false)world.segs.push({sourceBox:r});return r;};
 context.addBox({house:H,kind:'table',x:8,y:8,z:0,rot:0,w:2,d:1.5,h:.8,solid:true,floor:0});
 context.addBox({house:H,kind:'sofa',x:12,y:9,z:0,rot:0,w:2,d:1,h:.8,solid:true,floor:0});
 vm.runInContext(read('js/city-home.js'),context);
 context.CityHome=context.window.CityHome;context.CityHome.sync(H);
 vm.runInContext(read('js/city-home-plus.js'),context);
 return {H,houses,boxes,ctx:context,core:context.CityHome,plus:context.window.CityHomePlus,game};
}
test('all new modules compile and dependency order is correct',()=>{
 for(const f of ['js/city-home.js','js/city-home-plus.js','js/city-home-plus-ui.js','js/city-home-ui.js','js/skeleton.js'])
   assert.doesNotThrow(()=>new vm.Script(read(f),{filename:f}));
 const html=read('index.html');
 assert.ok(html.indexOf('js/city-home.js')<html.indexOf('js/city-home-plus.js'));
 assert.ok(html.indexOf('js/city-home-plus-ui.js')<html.indexOf('js/city-home-ui.js'));
 assert.match(read('js/architecture-3d.mjs'),/CityHomePlus\.surface/);
});
test('renovation costs money and persists by room without repainting other homes',()=>{
 const {H,ctx,plus}=fixture();assert.equal(plus.surface(H,0,'living'),null);
 const before=ctx.CityLife.funds;
 const changed=plus.decorate(H,0,'living','sage','both');
 assert.equal(changed.ok,true);assert.ok(ctx.CityLife.funds<before);
 assert.equal(plus.surface(H,0,'living').wall,'#9dbea9');
 assert.equal(plus.decorate(H,0,'missing','sage').ok,false);
 assert.equal(plus.decorate(H,0,'living','wrong').ok,false);
 assert.equal(plus.decorate(H,0,'living','sage','both').ok,true);
 assert.equal(ctx.CityLife.funds,before- Math.round(190*1.5*288/18));
});
test('lights obey ownership and fixture budgets',()=>{
 const {H,plus,ctx}=fixture();
 assert.equal(plus.installLight(H,0,'living').ok,true);
 assert.equal(plus.data(H).lights.length,1);
 const id=plus.data(H).lights[0].id;
 assert.equal(plus.light(H,id,'cyan').ok,true);
 assert.equal(plus.data(H).lights[0].mode,'cyan');
 assert.equal(plus.light(H,id,'bright').ok,true);
 assert.equal(plus.togglePower(H).ok,true);
 assert.equal(plus.data(H).power,false);
 assert.equal(plus.light(H,id,'remove').ok,true);
 assert.equal(plus.data(H).lights.length,0);
 const no=fixture(false);
 assert.equal(no.plus.installLight(no.H,0,'living').ok,false);
 assert.equal(no.plus.decorate(no.H,0,'living','sage').ok,false);
});
test('small objects can be mounted on an existing table, never minted by a layout',()=>{
 const {H,core}=fixture();
 const result=core.buy(H,'plant','#728e77');
 assert.equal(result.ok,true);
 const item=core.inventory(H).find(x=>x.kind==='plant');
 const table=core.placed(H).find(x=>x.kind==='table');
 assert.equal(core.mountOn(H,item.id,table.id).ok,true);
 assert.equal(core.find(H,item.id).supportId,table.id);
 assert.equal(core.find(H,item.id).z,table.h);
 const outside=core.buy(H,'lampdesk','#ffdb9e');assert.equal(outside.ok,true);
 const lamp=core.inventory(H).find(x=>x.kind==='lampdesk');
 assert.equal(core.mountOn(H,lamp.id,table.id).ok,true);
 assert.equal(core.store(H,table.id).ok,true);
 assert.equal(core.find(H,item.id).status,'stored');
 assert.equal(core.find(H,lamp.id).status,'stored');
});
test('saved plans restore owned layouts without adding new items',()=>{
 const {H,core,plus,ctx}=fixture();
 const original=core.placed(H)[0],before=ctx.CityLife.funds;
 assert.equal(plus.capture(H,'Projeto original').ok,true);
 assert.equal(core.move(H,original.id,{x:14,y:12,rot:.3}).ok,true);
 const count=core.placed(H).length;
 const applied=plus.apply(H,0);
 assert.equal(applied.ok,true,applied.text);
 assert.equal(core.find(H,original.id).x,original.x);
 assert.equal(core.placed(H).length,count);
 assert.equal(ctx.CityLife.funds,before);
});
test('local guest list is explicit non-authoritative preference and upkeep is priced',()=>{
 const {H,ctx,plus}=fixture();
 assert.equal(plus.invite(H,'Maria').ok,true);
 assert.deepEqual(Array.from(plus.data(H).guests),['Maria']);
 assert.equal(plus.setGuestMode(H,'friends').ok,true);
 assert.equal(plus.data(H).guestMode,'friends');
 assert.equal(plus.removeGuest(H,'Maria').ok,true);
 plus.data(H).condition=60;
 const before=ctx.CityLife.funds;
 assert.equal(plus.repair(H,'clean').ok,true);
 assert.equal(plus.data(H).condition,76);
 assert.equal(ctx.CityLife.funds,before-90);
});
test('basic domestic actions use existing needs and trigger short procedural poses',()=>{
 const {H,core,plus,game}=fixture();
 const sofa=core.placed(H).find(x=>x.kind==='sofa');
 game.player.x=sofa.x;game.player.y=sofa.y;
 assert.equal(plus.activity(H,sofa.id).ok,true);
 assert.equal(game.player.homeAction.kind,'sit');
 assert.ok(game.player.homeAction.duration<10);
 const sk=read('js/skeleton.js');
 assert.match(sk,/a\.homeAction/);
});
