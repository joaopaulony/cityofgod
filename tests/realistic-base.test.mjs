import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import sharp from 'sharp';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {baseProfile,cloneBase,tintBase,releaseBase} from '../js/base-body-editor.mjs';
const base=new URL('../assets/characters/realistic-base/',import.meta.url);
test('base profile validates saved values',()=>{
 assert.deepEqual(baseProfile(null),{body:'male',tone:0});
 assert.deepEqual(baseProfile({body:'invalid',tone:99}),{body:'male',tone:4});
});
test('both human bases have bounded animated geometry, valid skinning and isolated skin colors',async()=>{
 const manifest=JSON.parse(await readFile(new URL('manifest.json',base)));
 for(const spec of manifest.models){
  const bytes=await readFile(new URL(spec.file,base));
  const g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assert.ok(spec.triangles<35000);assert.ok(bytes.length<4500000);
  for(const m of Object.values(spec.materials))for(const key of ['map','normalMap','alphaMap'])if(m[key]){
   const meta=await sharp(await readFile(new URL(m[key],base))).metadata();assert.ok(meta.width<=1024&&meta.height<=1024);
  }
  const meshes=[];g.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
  for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight,idx=mesh.geometry.attributes.skinIndex;
   for(let i=0;i<w.count;i++){let sum=0;for(let j=0;j<4;j++){sum+=w.getComponent(i,j);assert.ok(idx.getComponent(i,j)<mesh.skeleton.bones.length);}assert.ok(Math.abs(sum-1)<.001);}
  }
  const mixer=new T.AnimationMixer(g.scene);
  for(const clip of g.animations)for(const fraction of [.1,.5,.9]){
   mixer.stopAllAction();mixer.clipAction(clip).play();mixer.setTime(clip.duration*fraction);g.scene.updateMatrixWorld(true);
   for(const mesh of meshes){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=31){const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.length()<5,spec.id+' '+clip.name+' unbounded vertex');}}
  }
  mixer.stopAllAction();mixer.clipAction(g.animations.find(c=>c.name==='idle')).play();mixer.setTime(.1);g.scene.updateMatrixWorld(true);
  for(const side of ['Left','Right']){const hand=g.scene.getObjectByName('mixamorig'+side+'Hand').getWorldPosition(new T.Vector3());assert.ok(Math.abs(hand.x)>.13,'idle arms must stay outside torso');assert.ok(hand.y>.5&&hand.y<1.3);}
  const a=cloneBase(g.scene),b=cloneBase(g.scene);tintBase(a,4);
  const am=a.getObjectsByProperty('isMesh',true),bm=b.getObjectsByProperty('isMesh',true);
  for(let i=0;i<am.length;i++){const aa=[am[i].material].flat(),bb=[bm[i].material].flat();for(let j=0;j<aa.length;j++){assert.notEqual(aa[j],bb[j]);assert.equal(bb[j].color.getHex(),0xffffff);if(!/_Std_Skin_/.test(aa[j].name))assert.equal(aa[j].color.getHex(),0xffffff);}}
  releaseBase(a);releaseBase(b);
 }
});
