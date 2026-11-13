const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function room({deskY=4,front=[0,-1],itemKind='desk'}={}){
 const saved=new Map(),localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
 const H={seed:7,x0:0,x1:12,y0:0,y1:12,lightOn:true,inside:true,_architectureFurnished:true,
  architecture:{toWorld:(x,y)=>[x,y],toLocal:(x,y)=>[x,y],floorHeight:3,
   levels:[{z:0,rooms:[{id:'room',use:'living',x0:0,x1:12,y0:0,y1:12}],walls:[]}]},
  contains:(x,y,f)=>f===0&&x>0&&x<12&&y>0&&y<12};
 const item={id:'furniture',kind:itemKind,status:'placed',x:4,y:deskY,rot:0,w:1.3,d:.7,h:.76,
   floor:0,z:0,faceW:front,along:1.3,depth:.7,solid:true};
 const player={x:4.3,y:5.6,floor:0,floorZ:0,face:0,armed:false,speed:0,phase:0};
 const ctx=vm.createContext({window:{},CityLife:{},console,Math,Date,performance:{now:()=>1e3},
  localStorage,Event:class{constructor(type){this.type=type}},world:{version:1},houses:[H]});
 ctx.window.__game={player,st:{clock:0}};
 ctx.window.CityUI={notify(){}};
 ctx.window.CityHome={placed:()=>[item],find:(_,id)=>id===item.id?item:null,
  owned:()=>true,key:()=> 'seed:owned-property',catalog:{desk:{name:'Escrivaninha'},shower:{name:'Box de banho'}}};
 ctx.CityHome=ctx.window.CityHome;
 ctx.window.CityDeskCore={newState:()=>({}),sanitizeState:x=>x||{}};
 ctx.window.CityDeskContent={};
 vm.runInContext(read('js/city-home-nav.js'),ctx);
 vm.runInContext(read('js/city-home-routine.js'),ctx);
 vm.runInContext(read('js/city-desk.js'),ctx);
 return {ctx,H,item,player,window:ctx.window,storage:saved};
}
test('desk uses the SAME faceW orientation as the real instanced 3D mesh; exit stays inside',()=>{
 const f=room(),initial={x:f.player.x,y:f.player.y};
 const seat=f.window.CityDesk.sitDown('desk_code',{H:f.H,desk:f.item,floor:0});
 assert.ok(seat);
 assert.ok(seat.seat.y<f.item.y,'chair should follow -Y facing, not +Y rot');
 assert.ok(Math.abs(f.player.y-seat.seat.y)<1e-6);
 assert.ok(f.H.contains(f.player.x,f.player.y,0));
 assert.equal(f.player.homeAction.deskWork,true);
 f.window.CityDesk.standUp();
 assert.equal(f.player.homeAction,null);
 assert.ok(f.H.contains(f.player.x,f.player.y,0),'exited the building');
 assert.ok(Math.hypot(f.player.x-initial.x,f.player.y-initial.y)<.01,'did not restore safe approach');
});
test('desk facing a wall refuses the pose instead of teleporting outside',()=>{
 const f=room({deskY:.42});
 const before={x:f.player.x,y:f.player.y};
 assert.equal(f.window.CityDesk.sitDown('desk_code',{H:f.H,desk:f.item,floor:0}),null);
 assert.deepEqual({x:f.player.x,y:f.player.y},before);
 assert.equal(f.player.homeAction,undefined);
});
test('shower moves the actor INSIDE the enclosure during the effect and restores a safe spot on completion',()=>{
 const f=room({itemKind:'shower',deskY:6,front:[0,1]});
 f.item.x=6;f.item.y=6;f.item.w=.9;f.item.d=.9;f.item.h=1.95;
 f.player.x=2;f.player.y=2;
 let paid=0;f.window.CityHomePlus={completeActivity(){paid++;return {ok:true,text:'Banho concluído'}}};
 const started=f.window.CityHomeRoutine.start(f.H,f.item,'wash');
 assert.equal(started.ok,true,started.text);
 let entered=false,insidePose=false;
 for(let i=0;i<330&&(f.window.CityHomeRoutine.active);i++){
  f.window.CityHomeRoutine.tick(.08,f.player,(x,y)=>[x,y],false);
  if(f.window.CityHomeRoutine.stage==='pose'){
   entered=true;
   if(Math.hypot(f.player.x-f.item.x,f.player.y-f.item.y)<.2)insidePose=true;
  }
 }
 assert.ok(entered,'character did not reach shower');
 assert.ok(insidePose,'character never entered the enclosure');
 assert.equal(paid,1,'hygiene reward exactly once');
 assert.equal(f.player.homeAction,null);
 assert.ok(f.H.contains(f.player.x,f.player.y,0),'shower pushed player out of home');
 assert.ok(f.window.CityHomeNav.safeSpot(f.H,f.item,f.player.x,f.player.y),'exited onto an obstacle');
});
test('manual cancellation returns a bathing character to a safe interior point, not outside the wall',()=>{
 const f=room({itemKind:'shower',deskY:6,front:[0,1]});
 f.item.x=6;f.item.y=6;f.item.w=.9;f.item.d=.9;f.item.h=1.95;
 f.player.x=2;f.player.y=2;
 assert.equal(f.window.CityHomeRoutine.start(f.H,f.item,'wash').ok,true);
 let entered=false;
 for(let i=0;i<240;i++){
  f.window.CityHomeRoutine.tick(.08,f.player,(x,y)=>[x,y],false);
  if(f.window.CityHomeRoutine.stage==='pose'){entered=true;break;}
 }
 assert.ok(entered,'shower pose never started');
 f.window.CityHomeRoutine.tick(.8,f.player,(x,y)=>[x,y],false);
 f.window.CityHomeRoutine.tick(.08,f.player,(x,y)=>[x,y],true);
 assert.equal(f.window.CityHomeRoutine.active,false);
 assert.ok(f.window.CityHomeNav.safeSpot(f.H,f.item,f.player.x,f.player.y),'cancelled outside or on colliding furniture');
});
test('domestic action family is routed and managed through the same safe lifecycle',()=>{
 const src=read('js/city-home-routine.js'),clips=read('js/character-webgl.mjs');
 for(const k of ['sit','sleep','cook','eat','watch','work','wash','toilet','drink','fridge'])
  assert.ok(src.includes(k),'missing activity '+k);
 for(const k of ['desk_code','desk_design','desk_help','desk_stream'])
  assert.ok(clips.includes(k),'missing home-office clip '+k);
 assert.ok(src.includes('CityHomeNav?.exitSpot'),'all managed poses must use validated exits');
});
test('physical light switch shares persisted state with F7 and visible ceiling lights',()=>{
 const f=room();f.ctx.window.CityHomePlus=null;
 f.ctx.CityLife={funds:10000,credit(){},debit(){return true;},money:v=>'R$'+v};
 vm.runInContext(read('js/city-home-plus.js'),f.ctx);
 const home=f.ctx.window.CityHomePlus;
 assert.equal(home.powerOn(f.H),true);
 const d=home.togglePower(f.H);assert.equal(d.ok,true);
 assert.equal(home.data(f.H).power,false);assert.equal(f.H.lightOn,false);
 assert.equal(home.powerOn(f.H),false);
 assert.equal(home.togglePower(f.H).ok,true);assert.equal(f.H.lightOn,true);
 assert.ok(f.storage.has('cityofgod.home-plus.v1'));
 const arch=read('js/architecture-3d.mjs');
 assert.ok(arch.includes('e.roomFixtures.push('));
 assert.ok(arch.includes('homePointLights'));
 assert.ok(arch.includes('CityHomePlus.powerOn(playerHome)'));
 assert.ok(read('js/interiors.js').includes('CityHomePlus.togglePower(H)'));
});
test('shower uses lightweight procedural falling water, steam and no generated assets',()=>{
 const source=read('js/work-3d.mjs');
 assert.match(source,/const dropCount=\d+/);
 assert.ok(source.includes('new THREE.LineSegments'));
 assert.ok(source.includes('vaporGeo'));
 assert.ok(source.includes("action?.kind==='wash'"));
 assert.ok(source.includes('shower:showerWater.visible'));
});

for(const [kind,furniture] of [
 ['sit','sofa'],['sleep','bed'],['toilet','toilet'],['cook','stove'],
 ['eat','fridge'],['watch','tv'],['work','desk'],['drink','sink'],
 ['fridge','fridge'],['wash','shower']
]){
 test('domestic interaction '+kind+' completes once and exits inside with no collision',()=>{
  const f=room({itemKind:furniture,deskY:6,front:[0,1]});
  f.item.x=6;f.item.y=6;f.item.w=furniture==='bed'?1.65:.85;
  f.item.d=furniture==='bed'?2:.85;f.item.h=furniture==='shower'?1.95:.85;
  f.player.x=2;f.player.y=2;
  let calls=0;f.window.CityHomePlus={completeActivity(){calls++;return {ok:true,text:'Atividade concluída'}}};
  const r=f.window.CityHomeRoutine.start(f.H,f.item,kind);
  assert.equal(r.ok,true,r.text);
  const continuous=['sit','sleep','watch','work','wash','toilet'].includes(kind);
  for(let i=0;i<360;i++){
   if(!f.window.CityHomeRoutine.active)break;
   f.window.CityHomeRoutine.tick(.08,f.player,(x,y)=>[x,y],false);
  }
  if(continuous){
   assert.equal(f.window.CityHomeRoutine.stage,'pose',kind+' should remain in pose');
   assert.equal(f.window.CityHomeRoutine.active,true,kind+' must not end automatically');
   assert.equal(calls,0,'no early reward while '+kind+' continues');
   assert.equal(f.player.homeAction?.kind,kind);
   f.window.CityHomeRoutine.tick(.08,f.player,(x,y)=>[x,y],true); // player presses WASD
  }
  assert.equal(f.window.CityHomeRoutine.active,false,'activity did not end');
  assert.equal(calls,1,'activity reward should trigger exactly once');
  assert.equal(f.player.homeAction,null,'pose did not reset');
  assert.ok(f.window.CityHomeNav.safeSpot(f.H,f.item,f.player.x,f.player.y),
    'character finished '+kind+' in a wall, outdoors or inside furniture');
 });
}

test('all seated poses face the actual +Z front of the 3D furniture even in rotated homes',()=>{
 for(const kind of ['chair','sofa','couch','toilet']){
  const f=room({itemKind:kind,deskY:6,front:[-1,0]});
  f.item.x=6;f.item.y=6;f.item.w=1.2;f.item.d=.75;f.item.h=.8;
  f.player.x=3;f.player.y=3;
  const result=f.window.CityHomeRoutine.start(f.H,f.item,kind==='toilet'?'toilet':'sit');
  assert.equal(result.ok,true,kind+': '+result.text);
  let pose=false;
  for(let i=0;i<300&&f.window.CityHomeRoutine.active;i++){
   f.window.CityHomeRoutine.tick(.08,f.player,(x,y)=>[x,y],false);
   if(f.window.CityHomeRoutine.stage==='pose'){
    pose=true;
    const expected=Math.atan2(0,-1); // actual +Z front: [-1,0], not the reversed sofa back
    for(let j=0;j<25;j++)f.window.CityHomeRoutine.tick(.08,f.player,(x,y)=>[x,y],false);
    assert.ok(Math.abs(f.player.face-expected)<.5,kind+': face '+f.player.face);
    break;
   }
  }
  assert.ok(pose,kind+' did not start pose');
  f.window.CityHomeRoutine.cancel('',true);
  assert.ok(f.H.contains(f.player.x,f.player.y,0),kind+' exited into an exterior wall');
 }
});

test('sofa and bathroom poses follow the real model front at every quarter-turn',()=>{
 const options=[
  {facing:[1,0],rot:0},{facing:[0,1],rot:Math.PI/2},
  {facing:[-1,0],rot:Math.PI},{facing:[0,-1],rot:Math.PI*1.5},
 ];
 for(const kind of ['sofa','couch','sectional','toilet','qf_couch_medium2','qf_bathroom_toilet']){
  for(const {facing,rot} of options){
   const f=room({itemKind:kind,deskY:6,front:facing});
   f.item.x=6;f.item.y=6;f.item.rot=rot;
   f.item.w=kind.includes('couch')||['sofa','couch','sectional'].includes(kind)?2.05:.7;
   f.item.d=kind==='sectional'?.9:.75;f.item.h=.8;
   f.player.x=3;f.player.y=3;
   const command=kind.includes('toilet')?'toilet':'sit';
   const started=f.window.CityHomeRoutine.start(f.H,f.item,command);
   assert.equal(started.ok,true,kind+' orientation '+rot+': '+started.text);
   let entered=false;
   for(let i=0;i<320&&f.window.CityHomeRoutine.active;i++){
    f.window.CityHomeRoutine.tick(.08,f.player,(x,y)=>[x,y],false);
    if(f.window.CityHomeRoutine.stage==='pose'){
     entered=true;
     for(let j=0;j<20;j++)f.window.CityHomeRoutine.tick(.08,f.player,(x,y)=>[x,y],false);
     const expected=Math.atan2(facing[1],facing[0]);
     const diff=Math.atan2(Math.sin(f.player.face-expected),Math.cos(f.player.face-expected));
     assert.ok(Math.abs(diff)<.12,kind+' at '+rot+' facing '+f.player.face+' expected '+expected);
     assert.ok(f.player.homeAction?.kind===command);
     break;
    }
   }
   assert.ok(entered,kind+' did not reach the seat at '+rot);
   f.window.CityHomeRoutine.cancel('',true);
   assert.ok(f.window.CityHomeNav.safeSpot(f.H,f.item,f.player.x,f.player.y),
    'exited into furniture or outside at '+rot);
  }
 }
});
test('Quaternius seats and beds use matching interaction family and safe navigation',()=>{
 const home=read('js/city-home-plus.js'),nav=read('js/city-home-nav.js'),
  model=read('js/character-webgl.mjs');
 assert.match(home,/\^qf_couch_/);
 assert.match(home,/\^qf_chair_/);
 assert.match(home,/\^qf_bed_/);
 assert.match(home,/\^qf_bathroom_toilet/);
 assert.match(nav,/\^qf_\(chair_\|couch_/);
 assert.match(model,/\['rest','sleep'\]/);
 assert.match(model,/CityHomeNav\?\.facing\?\.\(bed\)/);
 assert.match(read('js/city-home-routine.js'),/CityHomeNav\?\.exitSpot/);
});
