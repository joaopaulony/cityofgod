import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createTombRig} from '../js/tomb-rig.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ctx=vm.createContext({Math,URLSearchParams,location:{search:''},VISUAL_REFERENCE:{anchors:{outline:'#111'}}});
const core=read('js/core.js').split('// ---- entrada ----')[0];
const body=read('js/character.js').split('const PAL')[0];
vm.runInContext(core+read('js/skeleton.js')+body+'\nglobalThis.api={makeActor,animate,solveSkeleton};',ctx);
const manifest=JSON.parse(read('assets/characters/tomb/manifest.json'));
test('actual Tomb bodies, ten faces and five skin tones are packaged',()=>{
 assert.equal(manifest.provider,'tomb');assert.equal(manifest.models.length,2);
 assert.equal(new Set(manifest.faces.map(f=>f.name)).size,10);
 assert.equal(manifest.faces.length,50);assert.equal(manifest.skins.length,10);
 for(const model of manifest.models){assert.ok(model.triangles<10000);assert.equal(model.sha256.length,64);}
});
for(const model of manifest.models)test(`${model.sex} native skeleton follows game IK through aim, reload and crouch without exploding`,async()=>{
 const b=readFileSync(new URL('../assets/characters/tomb/'+model.file,import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const root=gltf.scene,rig=createTombRig(root);
 assert.ok(rig.bones>=19);
 const a=ctx.api.makeActor({x:2,y:3,face:.7,clock:1,armed:true});
 root.position.set(a.x,0,a.y);root.rotation.y=Math.PI/2-a.face;
 for(const state of [{aiming:true,aimV:1},{reloadT:.8},{reloadT:-1,crouching:true},{crouching:false,armed:false,speed:1.7,walkW:1,phase:.3}]){
  Object.assign(a,state);a.J=ctx.api.solveSkeleton(a,ctx.api.animate(a,.016));root.updateMatrixWorld(true);rig.update(a);
  const hand=root.getObjectByName('Bip01_R_Hand').getWorldPosition(new THREE.Vector3());
  assert.ok(hand.distanceTo(new THREE.Vector3(a.J.handR[0],a.J.handR[2],a.J.handR[1]))<.001);
  root.traverse(o=>{
   if(!o.isSkinnedMesh)return;o.skeleton.update();
   assert.ok(o.geometry.groups.length<=5);assert.equal(o.geometry.attributes.color,undefined);
   for(let i=0;i<o.geometry.attributes.position.count;i+=23){
    const p=new THREE.Vector3().fromBufferAttribute(o.geometry.attributes.position,i);
    o.applyBoneTransform(i,p);o.localToWorld(p);
    assert.ok(p.toArray().every(Number.isFinite),'non-finite vertex');
    assert.ok(Math.abs(p.x-a.x)<2&&Math.abs(p.z-a.y)<2&&p.y>-.4&&p.y<2.3,'deformed vertex '+p.toArray());
   }
  });
 }
});
