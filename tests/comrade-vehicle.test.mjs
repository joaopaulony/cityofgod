import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {VEHICLE_MODELS,CIVIL_PACK_EXPECTED} from '../js/vehicle-catalog.mjs';
import {classifyWheelName,createWheelRig,stepWheelRig,resetWheelRig} from '../js/vehicle-wheels.mjs';
function quat(x=0,y=0,z=0,w=1){
 return {x,y,z,w,set(x,y,z,w){Object.assign(this,{x,y,z,w});}};
}
function wheel(name,children=[],q=quat()){
 return {isObject3D:true,name,quaternion:q,children};
}
const Box=class{setFromObject(){return this}get min(){return {y:-.33}}get max(){return {y:.33}}};
const THREE={Box3:Box};
const rootOf=nodes=>({traverse(fn){nodes.forEach(fn)}});
function rollRig(forward='-Z'){
 const nodes=['fl','fr','rl','rr'].map(r=>wheel('wheel_'+r));
 return {nodes,rig:createWheelRig(rootOf(nodes),THREE,{forward})};
}
const near=(a,b,epsilon=1e-9)=>assert.ok(Math.abs(a-b)<epsilon,a+' vs '+b);
const snapshot=n=>[n.quaternion.x,n.quaternion.y,n.quaternion.z,n.quaternion.w];
const axisTilt=q=>2*(q.x*q.y+q.w*q.z);
test('strict wheel classification rejects generic rims mistaken for RR',()=>{
 for(const role of ['fl','fr','rl','rr'])
  assert.equal(classifyWheelName('wheel_'+role),role);
 for(const name of ['Rim1.004_11','Rim2.001_19','RimInside.003_34',
  'Tyre_14','Disc.002_17','wheelbase','body']){
  assert.equal(classifyWheelName(name),null,name);
 }
});
test('real Comrade wheels rotate in reverse direction and maintain upright wheel-plane',()=>{
 const {rig,nodes}=rollRig();
 assert.equal(rig.complete,true);
 stepWheelRig(rig,1.32,.32);
 const before=nodes.map(n=>snapshot(n));
 for(const w of rig.wheels.values())near(w.spin,-2);
 for(const n of nodes)assert.ok(Math.abs(axisTilt(n.quaternion))<.01,n.name);
 stepWheelRig(rig,-.66,-.15);
 for(const w of rig.wheels.values())near(w.spin,-1);
 for(const n of nodes)assert.ok(Math.abs(axisTilt(n.quaternion))<.01,n.name);
 assert.notDeepEqual(before,nodes.map(n=>snapshot(n)));
 resetWheelRig(rig);
 for(const n of nodes)assert.deepEqual(snapshot(n),[0,0,0,1]);
});
test('Silvia original four corner groups animate, including actual RR_36',()=>{
 const original=quat(-.0043439301,-.2163960305,.0195942015,.9760993574);
 const groups=['FL_15','RL_22','FR_29','RR_36'].map((name,i)=>{
  const n=wheel(name,['Cal.001_9','Disc.001_10','Rim1.004_11',
   'Rim2.004_12','RimInside_13','Tyre_14'].map(x=>wheel(x)),
   i===0?original:quat());
  return n;
 });
 // Reproduce the actual GLB traversal order: FL children before RR group.
 const traversal=[];
 for(const g of groups){traversal.push(g,...g.children);}
 const rig=createWheelRig(rootOf(traversal),THREE,{forward:'+Z'});
 assert.equal(rig.complete,true);
 assert.equal(rig.wheels.size,4);
 assert.equal(rig.wheels.get('rr').node.name,'RR_36');
 for(const w of rig.wheels.values())assert.equal(w.spinning.length,5);
 const baseline=groups.map(g=>snapshot(g));
 const originalPart=quat(.63108646925,0,0,.7757124907);
 groups[0].children[1].quaternion=originalPart;
 // Capture that the original disc quaternion is not reset by the animation.
 const rig2=createWheelRig(rootOf(traversal),THREE,{forward:'+Z'});
 resetWheelRig(rig2);
 near(rig2.wheels.get('fl').node.quaternion.y,original.y,1e-8);
 assert.deepEqual(snapshot(groups[0].children[1]),snapshot(originalPart));
 stepWheelRig(rig2,1.32,.25);
 const fl=rig2.wheels.get('fl'),rr=rig2.wheels.get('rr');
 assert.ok(fl.spin>0&&rr.spin>0);
 assert.notDeepEqual(snapshot(rr.spinning.find(p=>/^tyre/i.test(p.node.name)).node),[0,0,0,1],
  'Rear-right tyre must actually rotate');
 for(const g of groups){
  const tyre=g.children.find(n=>n.name.startsWith('Tyre'));
  const rim=g.children.find(n=>n.name.startsWith('Rim1'));
  const brake=g.children.find(n=>n.name.startsWith('Cal'));
  assert.notDeepEqual(snapshot(tyre),[0,0,0,1]);
  assert.notDeepEqual(snapshot(rim),[0,0,0,1]);
  assert.deepEqual(snapshot(brake),[0,0,0,1]);
  assert.ok(Math.abs(axisTilt(g.quaternion))<.15,'wheel must stay upright: '+g.name);
 }
 resetWheelRig(rig2);
 for(let i=0;i<groups.length;i++)assert.deepEqual(snapshot(groups[i]),baseline[i]);
 assert.deepEqual(snapshot(groups[0].children[1]),snapshot(originalPart));
});
test('all ten original passenger GLB files are present and have four separate wheel nodes',()=>{
 assert.equal(VEHICLE_MODELS.length,11);
 assert.equal(VEHICLE_MODELS.filter(x=>x.source==='passenger').length,10);
 assert.equal(CIVIL_PACK_EXPECTED.length,10);
 for(const car of VEHICLE_MODELS){
  assert.ok(car.length>3&&car.length<6);
  const path=new URL('../assets/vehicles/live/'+car.file,import.meta.url);
  assert.ok(existsSync(path),car.id+' original GLB missing');
  const raw=readFileSync(path);
  assert.equal(raw.toString('ascii',0,4),'glTF',car.id);
  const jsonLength=raw.readUInt32LE(12);
  const json=JSON.parse(raw.subarray(20,20+jsonLength).toString('utf8'));
  const names=new Set((json.nodes||[]).map(x=>x.name));
  if(car.source==='passenger')
   for(const slot of ['fl','fr','rl','rr'])
    assert.ok(names.has('wheel_'+slot),car.id+' missing wheel_'+slot);
  else
   for(const id of ['FL_15','FR_29','RL_22','RR_36'])
    assert.ok(names.has(id),'Silvia missing '+id);
 }
});
test('source module uses actual GLB WebGL and no pre-render',()=>{
 const src=readFileSync(new URL('../js/vehicle-webgl.mjs',import.meta.url),'utf8');
 assert.match(src,/createWheelRig\(root,THREE,\{forward:config\.front\}\)/);
 assert.match(src,/stepWheelRig\(wheelRig,/);
 assert.match(src,/renderer\.render\(scene,viewCamera\)/);
 assert.doesNotMatch(src,/\.drawImage\(|\.toDataURL\(|bakeAtlas\(/);
});
