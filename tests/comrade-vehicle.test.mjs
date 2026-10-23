import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {VEHICLE_MODELS,CIVIL_PACK_EXPECTED} from '../js/vehicle-catalog.mjs';
import {classifyWheelName,createWheelRig,stepWheelRig,resetWheelRig} from '../js/vehicle-wheels.mjs';
function node(role){
 return {isObject3D:true,name:'wheel_'+role,
  rotation:{x:0,y:0,z:0,order:'XYZ',
   set(x,y,z,o){Object.assign(this,{x,y,z,order:o});}}};
}
function rig(){
 const nodes=['fl','fr','rl','rr'].map(node);
 const root={traverse(fn){for(const n of nodes)fn(n)}};
 const THREE={Box3:class{setFromObject(){return this}get min(){return {y:-.3}}get max(){return {y:.3}}}};
 return {rig:createWheelRig(root,THREE),nodes};
}
test('independent wheel roles are recognised but not body geometry',()=>{
 for(const role of ['fl','fr','rl','rr'])assert.equal(classifyWheelName('wheel_'+role),role);
 assert.equal(classifyWheelName('body'),null);
 assert.equal(classifyWheelName('wheelbase'),null);
});
test('front rims and tires steer; all four wheels roll by distance/radius',()=>{
 const {rig:w,nodes}=rig();
 assert.equal(w.complete,true);
 assert.deepEqual(w.metadata.map(x=>x.role),['fl','fr','rl','rr']);
 stepWheelRig(w,1.2,.32);
 for(const n of nodes)assert.ok(Math.abs(n.rotation.x-4)<.000001,n.name);
 for(const n of nodes.slice(0,2))assert.equal(n.rotation.y,-.32);
 for(const n of nodes.slice(2))assert.equal(n.rotation.y,0);
 stepWheelRig(w,-.6,-.15);
 for(const n of nodes)assert.ok(Math.abs(n.rotation.x-2)<.000001);
 assert.equal(nodes[0].rotation.y,.15);
 resetWheelRig(w);
 for(const n of nodes){assert.equal(n.rotation.x,0);assert.equal(n.rotation.y,0);}
});
test('all ten authentic Comrade models registered with 4 wheel pivots',()=>{
 assert.equal(VEHICLE_MODELS.length,11);
 assert.equal(VEHICLE_MODELS.filter(x=>x.source==='passenger').length,10);
 assert.equal(new Set(VEHICLE_MODELS.map(x=>x.id)).size,11);
 assert.equal(CIVIL_PACK_EXPECTED.length,10);
 for(const car of VEHICLE_MODELS){
  assert.ok(car.length>3&&car.length<6);
  assert.ok(['-Z','+Z'].includes(car.front));
  const path=new URL('../assets/vehicles/live/'+car.file,import.meta.url);
  if(existsSync(path)){
   const raw=readFileSync(path);
   assert.equal(raw.toString('ascii',0,4),'glTF',car.id);
   if(car.source==='passenger'){
    const count=raw.readUInt32LE(12);
    const json=JSON.parse(raw.subarray(20,20+count).toString('utf8'));
    const names=new Set(json.nodes.map(x=>x.name));
    for(const part of ['wheel_fl','wheel_fr','wheel_rl','wheel_rr'])
     assert.ok(names.has(part),car.id+' missing '+part);
   }
  }
 }
});
test('WebGL runtime does not generate spritesheets, uses garage and wheel rigs',()=>{
 const src=readFileSync(new URL('../js/vehicle-webgl.mjs',import.meta.url),'utf8');
 assert.match(src,/selectModel\(id\)/);
 assert.match(src,/createWheelRig\(root,THREE\)/);
 assert.match(src,/stepWheelRig\(wheelRig,/);
 assert.match(src,/renderer\.render\(scene,viewCamera\)/);
 assert.doesNotMatch(src,/\.drawImage\(|\.toDataURL\(|bakeAtlas\(/);
});
