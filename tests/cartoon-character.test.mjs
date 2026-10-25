import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildCartoon,normalizeLook,npcLook} from '../js/cartoon-character.mjs';
test('cartoon input validates stored profiles and keeps NPCs deterministic',()=>{
 const a=normalizeLook({skin:'url(bad)',style:'unknown',shape:99,face:0,name:'X'.repeat(100)});
 assert.equal(a.shape,1);assert.equal(a.face,.85);assert.equal(a.name.length,24);assert.match(a.skin,/^#[a-f\d]{6}$/);assert.equal(a.style,'long');assert.deepEqual(npcLook(4),npcLook(4));
});
test('original cartoon meshes deform with every existing animation and dispose on replacement',async()=>{
 const b=await readFile(new URL('../assets/characters/mixamo/david.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const {group,triangles}=buildCartoon(gltf.scene,{});assert.ok(triangles<60000);assert.ok(group.children.length<=10);
 const mixer=new T.AnimationMixer(gltf.scene);
 for(const clip of gltf.animations){
  mixer.stopAllAction();mixer.clipAction(clip).play();mixer.setTime(clip.duration*.4);gltf.scene.updateMatrixWorld(true);
  for(const mesh of group.children){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=37){const p=new T.Vector3();mesh.getVertexPosition(i,p);assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.length()<5,clip.name+' malformed deformation');}}
 }
 mixer.stopAllAction();let disposed=0;group.children.forEach(m=>m.geometry.addEventListener('dispose',()=>disposed++));buildCartoon(gltf.scene,npcLook(2));assert.ok(disposed>0);assert.equal(group.parent,null);
});
