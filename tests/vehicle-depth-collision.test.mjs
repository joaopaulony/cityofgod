import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {carCollision,sweepCar,carFootprint} from '../js/vehicle-collision.mjs';
const base={length:4.5,width:1.8,angle:0};
const empty=()=>({segs:[],circles:[],mapSize:160});
const car=(x,y,angle=0)=>({...base,x,y,angle});
const options=(extra={})=>({houses:[],boxes:[],mapSize:160,...extra});
test('house wall exactly, no invisible 1.5m house padding',()=>{
 const H={x0:10,y0:10,x1:15,y1:15};
 const world=empty(),o=options({houses:[H]});
 assert.equal(carCollision(world,car(7,12),o),null,'30cm clear visually');
 assert.equal(carCollision(world,car(7.80,12),o)?.kind,'house');
 assert.equal(carCollision(world,car(7,16.7),o),null,'corner clear');
});
test('whole fenced yard is driveable until actual fence or wall',()=>{
 const w=empty();w.yards=[[5,5,22,22]];
 const fence={x1:10,y1:8,x2:10,y2:20,kind:'fence',h:1.28};
 w.segs.push(fence);
 assert.equal(carCollision(w,car(6,12),options()),null);
 assert.equal(carCollision(w,car(7.85,12),options())?.kind,'fence');
 assert.equal(carCollision(w,car(14,12),options()),null,
  'yard zone is not a wall');
});
test('vehicle bumper and side clearance use rotated body, not large circle',()=>{
 const w=empty();
 w.circles.push({x:10,y:10,r:.28,kind:'tree'});
 assert.equal(carCollision(w,car(7.4,10),options()),null);
 assert.equal(carCollision(w,car(7.52,10),options())?.kind,'tree');
 assert.equal(carCollision(w,car(10,7.5),options()),null);
 assert.equal(carCollision(w,car(10,8.85),options())?.kind,'tree');
 assert.equal(carCollision(w,car(7.4,10,Math.PI/2),options()),null);
 assert.equal(carCollision(w,car(8.85,10,Math.PI/2),options())?.kind,'tree');
});
test('soft bushes, painted tufts and curbs are not phantom walls',()=>{
 const w=empty();w.circles=[
  {x:10,y:10,r:1.8,soft:true,kind:'bush'},
  {x:12,y:10,r:.1,kind:'vehicle'}];
 w.yards=[[4,4,20,20]];
 assert.equal(carCollision(w,car(10,10),options()),null);
});
test('lamps, stones and solid street bins have tight contact',()=>{
 const w=empty();w.circles=[
  {x:10,y:10,r:.12,kind:'lamp'},
  {x:20,y:20,r:.4,kind:'rock'}];
 const bin={x:30,y:30,w:.6,d:.6,h:1,rot:0};
 const o=options({boxes:[bin]});
 assert.equal(carCollision(w,car(7.52,10),o),null);
 assert.equal(carCollision(w,car(7.66,10),o)?.kind,'lamp');
 assert.equal(carCollision(w,car(17.2,20),o),null);
 assert.equal(carCollision(w,car(17.7,20),o)?.kind,'rock');
 assert.equal(carCollision(w,car(27.35,30),o),null);
 assert.equal(carCollision(w,car(27.48,30),o)?.kind,'object');
});
test('swept footprint halts at first obstacle, no tunnelling through wall',()=>{
 const world=empty();world.segs.push({
  x1:11,y1:8,x2:11,y2:12,kind:'fence',h:1.28
 });
 const result=sweepCar(world,car(5,10),car(17,10),options());
 assert.equal(result.impact?.kind,'fence');
 assert.ok(result.position.x>5);
 assert.ok(result.position.x<8.8);
 assert.equal(carCollision(world,{...base,...result.position},options()),null);
});
test('turning near corner only blocks on polygon contact',()=>{
 const w=empty(),H={x0:11,y0:11,x1:16,y1:16};
 assert.equal(carCollision(w,car(7.5,8),options({houses:[H]})),null);
 assert.equal(carCollision(w,car(10,10,Math.PI/4),options({houses:[H]}))?.kind,'house');
 const poly=carFootprint(0,0,Math.PI/2,4,2);
 assert.ok(Math.abs(poly[0][1]-2)<1e-8);
});
test('water, map limits, doors and collision independence per GLB dimensions',()=>{
 const w=empty();w.segs.push({x1:20,y1:10,x2:20,y2:15,door:true,
  doorAnim:{open:1}});
 const o=options({isWater:(x,y)=>x>29&&x<31});
 assert.equal(carCollision(w,car(17.7,12),o),null);
 assert.equal(carCollision(w,car(30,12),o)?.kind,'water');
 assert.equal(carCollision(w,car(1,12),o)?.kind,'map');
 for(const length of [3.7,4.4,4.7,5.3]){
  assert.equal(carCollision(w,{...car(10,10),length},o),null);
 }
});
test('WebGL scene includes depth proxies for all user screenshot cases',()=>{
 const code=fs.readFileSync(new URL('../js/vehicle-occlusion.mjs',import.meta.url),'utf8');
 const runtime=fs.readFileSync(new URL('../js/vehicle-webgl.mjs',import.meta.url),'utf8');
 assert.match(code,/bridge\.world\.lamps/);
 assert.match(code,/p\.type==='tree'/);
 assert.match(code,/p\.type==='bush'/);
 assert.match(code,/bridge\.actors/);
 assert.match(code,/kind==='fence'/);
 assert.match(runtime,/occlusionScene\?\.updateActors/);
 assert.match(runtime,/sweepCar/);
 assert.doesNotMatch(runtime,/world\.blocked\(px,py/);
});
