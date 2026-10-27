import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createDomesticRig} from '../js/domestic-rig.mjs';

function pose(kind,t=1.5){
 const ctx=vm.createContext({console,Math,URLSearchParams,location:{search:''},VISUAL_REFERENCE:{anchors:{outline:'#000'}},window:{},addEventListener(){}});
 vm.runInContext(readFileSync('js/core.js','utf8')+'\n'+readFileSync('js/skeleton.js','utf8'),ctx);
 return vm.runInContext(`(()=>{const a=makeActor({armed:false,clock:1,homeAction:{kind:${JSON.stringify(kind)},t:${t},duration:6,surface:.48}});a.pose=animate(a,0);a.J=solveSkeleton(a,a.pose);return a;})()`,ctx);
}
test('domestic poses lie flat, bend seated knees, and raise the drinking hand',()=>{
 const sleep=pose('sleep').J,sit=pose('sit').J,drink=pose('drink').J,cook=pose('cook').J;
 assert.ok(Math.abs(sleep.head[2]-sleep.ankL[2])<.2);
 assert.ok(Math.abs(sleep.head[0]-sleep.ankL[0])>1.4);
 assert.ok(sit.kneeL[0]-sit.hipL[0]>.4);
 assert.ok(sit.kneeL[2]-sit.ankL[2]>.3);
 assert.ok(drink.handR[2]>cook.handR[2]+.2);
 for(const kind of ['sit','sleep','drink','cook','fridge','wash'])
  for(const p of Object.values(pose(kind).J))if(Array.isArray(p))assert.ok(p.every(Number.isFinite),kind);
});
test('real Mixamo bones follow domestic IK and restore their previous transforms',async()=>{
 const data=readFileSync('assets/characters/mixamo/david.glb');
 const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 const root=gltf.scene,rig=createDomesticRig(root),a=pose('sleep');
 const bones=[];root.traverse(b=>{if(b.isBone)bones.push([b,b.position.clone(),b.quaternion.clone()]);});
 rig.update(a);root.updateMatrixWorld(true);
 const pelvis=root.getObjectByName('mixamorigHips').getWorldPosition(new THREE.Vector3());
 assert.ok(Math.abs(pelvis.y-a.J.pelvis[2])<.001);
 for(const [b,p] of bones)if(b.name!=='mixamorigHips')assert.ok(b.position.distanceTo(p)<1e-8,b.name+' must retain its anatomical offset');
 root.traverse(m=>{if(m.isSkinnedMesh){m.skeleton.update();const p=new THREE.Vector3();for(let i=0;i<m.geometry.attributes.position.count;i+=101){m.getVertexPosition(i,p);assert.ok(p.toArray().every(Number.isFinite));}}});
 rig.restore();
 for(const [b,p,q] of bones){assert.ok(b.position.distanceTo(p)<1e-8);assert.ok(b.quaternion.angleTo(q)<1e-6);}
});
test('all activities preserve connected limbs through entry, hold and exit',async()=>{
 const data=readFileSync('assets/characters/mixamo/david.glb');
 const {scene:root}=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 const rig=createDomesticRig(root),bone=n=>root.getObjectByName('mixamorig'+n);
 const lengths={};
 for(const side of ['Left','Right'])for(const [from,to] of [['Arm','ForeArm'],['ForeArm','Hand'],['UpLeg','Leg'],['Leg','Foot']])
  lengths[side+from]=bone(side+from).getWorldPosition(new THREE.Vector3()).distanceTo(bone(side+to).getWorldPosition(new THREE.Vector3()));
 for(const kind of ['sit','sleep','drink','cook','fridge'])for(const t of [0,.3,.7,1.7,3.5,5.8]){
  const a=pose(kind,t);root.rotation.y=Math.PI/2-a.face;root.updateMatrixWorld(true);rig.update(a);
  for(const side of ['Left','Right'])for(const [from,to] of [['Arm','ForeArm'],['ForeArm','Hand'],['UpLeg','Leg'],['Leg','Foot']]){
   const length=bone(side+from).getWorldPosition(new THREE.Vector3()).distanceTo(bone(side+to).getWorldPosition(new THREE.Vector3()));
   assert.ok(Math.abs(length-lengths[side+from])<1e-6,`${kind} ${t}: ${side}${from} stretched`);
  }
  rig.restore();
 }
});
