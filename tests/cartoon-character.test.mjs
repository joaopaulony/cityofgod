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
test('legacy Mixamo movements can still animate a mesh-free skeleton',async()=>{
 const b=await readFile(new URL('../assets/characters/rigs/mixamo/david.rig.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 let meshes=0,bones=0;gltf.scene.traverse(n=>{if(n.isMesh)meshes++;if(n.isBone)bones++;});
 assert.equal(meshes,0);assert.ok(bones>=20);assert.ok(gltf.animations.length>=20);
 const mixer=new T.AnimationMixer(gltf.scene);
 for(const clip of gltf.animations.slice(0,5)){
  mixer.stopAllAction();mixer.clipAction(clip).play();
  mixer.setTime(Math.min(clip.duration*.35,.25));
  gltf.scene.updateMatrixWorld(true);
 }
});
