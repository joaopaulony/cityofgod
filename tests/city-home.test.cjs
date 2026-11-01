const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture({owner=true,seed=900}={}){
 const mem=new Map(),store={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)};
 const world={seed,segs:[],upperSegs:[],version:0,open:false};
 const H={seed:17,doorPt:[5,10],x0:0,y0:0,x1:15,y1:12,_architectureFurnished:true,
  architecture:{width:15,depth:12,levels:[{z:0,rooms:[{id:'living',use:'living',x0:0,y0:0,x1:15,y1:12}],
    segments:[{door:true,x1:7,y1:12,x2:8,y2:12}]}],toLocal:(x,y)=>[x,y],toWorld:(x,y)=>[x,y]},
  interactables:[],contains:(x,y)=>x>0&&x<15&&y>0&&y<12};
 const houses=[H],boxes=[],own=new Map();if(owner)own.set(H,true);
 const context=vm.createContext({world,houses,boxes,localStorage:store,performance:{now:()=>1000},
  CityRealty:{id:()=> '5_10_15x12',isOwned:h=>!!own.get(h)},CityLife:{
   funds:30000,debit(v){if(this.funds<v)return false;this.funds-=v;return true;},
   credit(v){this.funds+=v;return true;},money:v=>'R$ '+v},
  console,Event:class{constructor(name){this.type=name}},window:{dispatchEvent(){}},Math,Date});
 context.window.window=context.window;context.window.CityRealty=context.CityRealty;
 context.addBox=b=>{boxes.push(b);if(b.solid!==false)world.segs.push({sourceBox:b});return b;};
 context.addBox({kind:'bed',x:10,y:8,w:2,d:2,h:.7,z:0,rot:0,floor:0,house:H,solid:true});
 context.addBox({kind:'sofa',x:3,y:3,w:2,d:1,h:.9,z:0,rot:0,floor:0,house:H,solid:true});
 vm.runInContext(fs.readFileSync('js/city-home.js','utf8'),context);
 return {core:context.window.CityHome,context,boxes,houses,H,own,mem};
}
const json=o=>JSON.parse(JSON.stringify(o));
test('an owned home starts with the exact furniture already in the house',()=>{
 const {core,H,boxes}=fixture();
 assert.equal(core.sync(H),true);
 assert.equal(core.placed(H).length,2);
 assert.equal(boxes.length,2);
 assert.deepEqual(core.placed(H).map(r=>r.kind).sort(),['bed','sofa']);
 assert.equal(core.sync(H),false);
 assert.equal(boxes.length,2);
});
test('no owner cannot edit, buy, move or build in another property',()=>{
 const {core,H,context}=fixture({owner:false});
 assert.equal(core.sync(H),false);
 assert.equal(core.buy(H,'chair').ok,false);
 assert.equal(core.move(H,'starter-0',{x:4,y:4}).ok,false);
 assert.equal(core.houseAt({x:4,y:4,floor:0}),null);
 assert.equal(context.CityLife.funds,30000);
});
test('dragged furniture updates collision source boxes and persistent record',()=>{
 const {core,H,boxes,context}=fixture();core.sync(H);
 const bed=core.placed(H).find(r=>r.kind==='bed');
 assert.equal(core.move(H,bed.id,{x:9,y:4,rot:Math.PI/4}).ok,true);
 assert.equal(core.find(H,bed.id).x,9);
 assert.equal(core.find(H,bed.id).rot,Math.PI/4);
 assert.equal(boxes.find(b=>b.homeId===bed.id).x,9);
 assert.equal(context.world.segs.length,2);
 assert.ok(context.world.segs.every(seg=>boxes.includes(seg.sourceBox)));
});
test('walls, overlapping furniture and doors reject placement without charging',()=>{
 const {core,H,context}=fixture();core.sync(H);
 assert.equal(core.buy(H,'chair').ok,true);
 const chair=core.inventory(H).find(r=>r.kind==='chair');
 assert.equal(core.place(H,chair.id,{x:-10,y:4,rot:0,floor:0}).ok,false);
 assert.equal(core.place(H,chair.id,{x:3,y:3,rot:0,floor:0}).ok,false);
 assert.equal(core.place(H,chair.id,{x:7.5,y:11.6,rot:0,floor:0}).ok,false);
 assert.equal(core.inventory(H).some(x=>x.id===chair.id),true);
 assert.equal(core.place(H,chair.id,{x:5,y:7,rot:0,floor:0}).ok,true);
 assert.equal(core.inventory(H).some(x=>x.id===chair.id),false);
});
test('store, restore and undo never duplicate or lose initial furniture',()=>{
 const {core,H,boxes}=fixture();core.sync(H);
 const bed=core.placed(H).find(x=>x.kind==='bed');
 assert.equal(core.store(H,bed.id).ok,true);
 assert.equal(core.placed(H).length,1);
 assert.equal(core.inventory(H).length,1);
 assert.equal(boxes.length,1);
 assert.equal(core.undo(H).ok,true);
 assert.equal(boxes.length,2);
 assert.equal(core.store(H,bed.id).ok,true);
 assert.equal(core.place(H,bed.id,{x:8,y:7,rot:0,floor:0}).ok,true);
 assert.equal(boxes.length,2);
});
test('buy/sell economy cannot be duplicated through undo',()=>{
 const {core,H,context}=fixture();core.sync(H);
 assert.equal(core.buy(H,'chair').ok,true);
 assert.equal(context.CityLife.funds,29820);
 assert.equal(core.undo(H).ok,false);
 const chair=core.inventory(H).find(x=>x.kind==='chair');
 assert.equal(core.sell(H,chair.id).ok,true);
 assert.equal(context.CityLife.funds,29910);
 assert.equal(core.undo(H).ok,false);
 assert.equal(core.sell(H,chair.id).ok,false);
 assert.equal(context.CityLife.funds,29910);
});
test('furniture position persists when the procedural sector unloads and recreates the same house',()=>{
 const {core,H,houses,boxes,context}=fixture();core.sync(H);
 const sofa=core.placed(H).find(x=>x.kind==='sofa');
 assert.equal(core.move(H,sofa.id,{x:6,y:4,rot:.3}).ok,true);
 boxes.length=0;context.world.segs.length=0;
 const newH={...H,interactables:[]};houses[0]=newH;context.CityRealty.isOwned=h=>h===newH;
 context.addBox({kind:'bed',x:10,y:8,w:2,d:2,h:.7,z:0,rot:0,floor:0,house:newH,solid:true});
 context.addBox({kind:'sofa',x:3,y:3,w:2,d:1,h:.9,z:0,rot:0,floor:0,house:newH,solid:true});
 assert.equal(core.sync(newH),true);
 assert.equal(boxes.length,2);
 assert.equal(boxes.find(x=>x.homeId===sofa.id).x,6);
 assert.equal(boxes.find(x=>x.homeId===sofa.id).rot,.3);
});
test('colors are validated; room objects use common renderers and WebGL invalidation',()=>{
 const {core,H,context}=fixture();core.sync(H);
 const id=core.placed(H)[0].id;
 assert.equal(core.recolor(H,id,'javascript:alert(1)').ok,false);
 assert.equal(core.recolor(H,id,'#8d8c7b').ok,true);
 assert.equal(core.find(H,id).top,'#8d8c7b');
 assert.ok(context.world.version>=2);
 const three=fs.readFileSync('js/props-3d.mjs','utf8');
 assert.match(three,/!b\.homeManaged/);
});
test('controls, CSS, entry-point and build scripts wire the editor without breaking input',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('js/city-realty.js')<html.indexOf('js/city-home.js'));
 assert.ok(html.indexOf('js/city-home.js')<html.indexOf('js/city-home-ui.js'));
 assert.match(html,/css\/city-home\.css/);
 const game=fs.readFileSync('js/game.js','utf8');
 assert.match(game,/CityHomeUI\?\.active/);
 assert.match(game,/CityHomeUI\?\.mount/);
 const ui=fs.readFileSync('js/city-home-ui.js','utf8');
 for(const k of ['mousedown','mousemove','mouseup','wheel','keydown','delete','escape','enter','undo','city-home-open'])
   assert.ok(ui.includes(k),'missing interaction '+k);
 const css=fs.readFileSync('css/city-home.css','utf8');
 assert.match(css,/body\.city-home-open #city-controls/);
});
