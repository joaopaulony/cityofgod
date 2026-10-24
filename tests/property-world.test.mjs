import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {carCollision} from '../js/vehicle-collision.mjs';
const require=createRequire(import.meta.url),A=require('../js/architecture-plan.js'),Street=require('../js/street-layout.js');
const read=name=>readFileSync(new URL('../js/'+name,import.meta.url),'utf8');
function fixture(rotation=0,floors=4,kind='office'){
 const ctx=vm.createContext({console,Math,URLSearchParams,CityArchitecture:A,CityStreetLayout:Street,world:{seed:42,segs:[],upperSegs:[],circles:[],version:1},PARAPET:.2,PITCH:.5,houseStyle:()=>({plaster:'#eee',roofCol:'#b56b43'}),mulberry:()=>()=>.5,clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),MAP:500});
 vm.runInContext(read('houses.js')+read('multistorey.js')+read('architecture-world.js')+read('interiors.js'),ctx);
 vm.runInContext(`const H=addHouse({x0:100,y0:100,x1:120,y1:116,h:${floors*3},nFloors:${floors},roofKind:'flat',open:{S:{door:[9]}}});H.miaKind=${JSON.stringify(kind)};H.doorPt=[109.5,116];H.doorN=[0,1];H.front=[109.5,118];addBox({x:101,y:101,w:1,d:1,h:1,house:H});const keep=addBox({x:90,y:90,w:.5,d:.5,h:1});const old=H.segs.slice();orientHouseToRoad(H,${rotation});remodelProperty(H);globalThis.result={H,keep,old,world,boxes,updateHouseStairs};`,ctx);
 const collision=read('world.js').slice(read('world.js').indexOf('const COLL_CELL'));
 vm.runInContext(collision+'\nglobalThis.collide=collide;',ctx);return ctx;
}
test('rotated remodel replaces old walls/furniture and shares footprints with car collision',()=>{
 const ctx=fixture(.37),{H,world,boxes,old,keep}=ctx.result,A=H.architecture;
 assert.ok(boxes.includes(keep));assert.ok(old.every(s=>!world.segs.includes(s)));assert.equal(A.levels.length,4);
 for(const r of A.levels[0].rooms){const p=A.toWorld((r.x0+r.x1)/2,(r.y0+r.y1)/2),local=A.toLocal(...p);assert.ok(Math.abs(local[0]-(r.x0+r.x1)/2)<1e-8);assert.equal(H.contains(...p),true);}
 const [x,y]=A.toWorld(A.levels[0].entry[0],A.levels[0].entry[1]+.35);
 assert.equal(H.contains(x,y),false);assert.equal(carCollision(world,{x,y,angle:0,length:.25,width:.25},{mapSize:500,houses:[H]}),null);
 const inside=A.toWorld(2,2);assert.equal(carCollision(world,{x:inside[0],y:inside[1],angle:0,length:.25,width:.25},{mapSize:500,houses:[H]})?.kind,'house');
});
test('doors and upper floors use the real colliders rather than obsolete enclosing rectangles',()=>{
 const ctx=fixture(),{H}=ctx.result,A=H.architecture;
 const door=A.levels[0].segments.find(s=>s.ext&&s.door),p=[(door.x1+door.x2)/2+door.nx*.12,(door.y1+door.y2)/2+door.ny*.12];
 const closed=ctx.collide(...p,.28,0);assert.ok(Math.hypot(closed[0]-p[0],closed[1]-p[1])>.1);door.doorAnim.open=1;
 const open=ctx.collide(...p,.28,0);assert.ok(Math.hypot(open[0]-p[0],open[1]-p[1])<.001);
 for(let floor=1;floor<4;floor++){assert.ok(A.levels[floor].segments.length);assert.ok(ctx.result.world.upperSegs.some(s=>s.floor===floor));}
});
test('stairs stay aligned and F reaches every floor, then descends to the previous one',()=>{
 const ctx=fixture(.23),{H,updateHouseStairs}=ctx.result,A=H.architecture;
 const p={x:0,y:0,floor:0,floorZ:0};
 for(let floor=0;floor<3;floor++){
  const s=A.levels[floor].stair,next=A.levels[floor+1].stair;assert.deepEqual(s.top,next.top);assert.deepEqual(s.bottom,next.bottom);
  [p.x,p.y]=s.bottom;assert.equal(updateHouseStairs(p,.01,true),true);assert.equal(p.stairTravel.to,floor+1);updateHouseStairs(p,1.6,false);assert.equal(p.floor,floor+1);assert.equal(p.floorZ,(floor+1)*H.floorHeight);
 }
 [p.x,p.y]=A.levels[3].stair.top;assert.equal(updateHouseStairs(p,.01,true),true);updateHouseStairs(p,1.6,false);assert.equal(p.floor,2);
});

test('player operates exterior doors and sash windows from either side, with persistent manual targets',()=>{
 const ctx=fixture(.3),{H}=ctx.result,level=H.architecture.levels[0],st={};
 for(const kind of ['door','window']){
  const s=level.segments.find(s=>s.ext&&s[kind]),key=kind+'Anim';
  for(const side of [-1,1]){
   const p={x:(s.x1+s.x2)/2+s.nx*.65*side,y:(s.y1+s.y2)/2+s.ny*.65*side,floor:0};
   assert.equal(ctx.findHouseInteraction(p)?.kind,kind);
   assert.equal(ctx.useHouseInteraction(p,st,0),true);assert.equal(s[key].target,1);
   ctx.updateHouseOpenings(.2,[p],true);assert.ok(s[key].open>0&&s[key].open<1,'smooth intermediate animation');
   for(let i=0;i<60;i++)ctx.updateHouseOpenings(.1,[p],true);
   assert.equal(s[key].open,1,'night and proximity must not undo player choice');
   ctx.useHouseInteraction(p,st,1);for(let i=0;i<60;i++)ctx.updateHouseOpenings(.1,[p],false);
   assert.equal(s[key].open,0,'player can close while still beside opening');
  }
 }
});

test('balcony has a traversable door, floor membership, and rails that stop the player',()=>{
 const ctx=fixture(.31),{H}=ctx.result,A=H.architecture,r=.28;
 for(let floor=1;floor<4;floor++){
  const l=A.levels[floor],b=l.outdoor[0],cx=(b.x0+b.x1)/2;
  const door=l.segments.find(s=>s.door&&s.ext);assert.ok(door);
  door.doorAnim.open=1;
  for(let y=b.y0-.5;y<=b.y1-.5;y+=.08){const p=A.toWorld(cx,y),next=ctx.collide(...p,r,floor);assert.ok(Math.hypot(next[0]-p[0],next[1]-p[1])<.001,'clear balcony route');assert.ok(H.contains(...p,floor));}
  const p=A.toWorld(cx,b.y1-.12),next=ctx.collide(...p,r,floor),local=A.toLocal(...next);
  assert.ok(local[1]<=b.y1-r-.07,'front rail stops player');
  const side=A.toWorld(b.x0+.1,b.y1-.6),push=A.toLocal(...ctx.collide(...side,r,floor));assert.ok(push[0]>=b.x0+r+.07,'side rail stops player');
 }
 const mansion=fixture(-.48,2,'mansion'),MH=mansion.result.H,A2=MH.architecture,l=A2.levels[1],b=l.outdoor.find(r=>r.rear),hall=l.rooms.find(r=>r.id==='hall'),cx=(hall.x0+hall.x1)/2;
 for(const s of l.segments)if(s.door)s.doorAnim.open=1;
 for(let y=.6;y>b.y0+.5;y-=.08){const p=A2.toWorld(cx,y),q=mansion.collide(...p,.28,1);assert.ok(Math.hypot(q[0]-p[0],q[1]-p[1])<.001,'rear loggia reachable through hall');assert.ok(MH.contains(...p,1));}
 const p=A2.toWorld(cx,b.y0+.1),q=A2.toLocal(...mansion.collide(...p,.28,1));assert.ok(q[1]>=b.y0+.35,'rear guardrail prevents walking off');
});
