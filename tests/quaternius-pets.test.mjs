import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PET_BREEDS,petBreed} from '../js/pet-catalog.mjs';
import {quaterniusAnimationFor,hasQuaterniusPet} from '../js/quaternius-pet.mjs';
const dir='assets/pets/quaternius';
const ids=['Alpaca','Bull','Cow','Deer','Donkey','Fox','Horse','Horse_White','Husky','ShibaInu','Stag','Wolf'];
test('all 12 licensed Quaternius skinned glTF models are included locally',()=>{
 assert.equal(PET_BREEDS.length,18);
 assert.equal(new Set(PET_BREEDS.map(b=>b.id)).size,18);
 assert.equal(PET_BREEDS.filter(b=>b.asset).length,12);
 assert.equal(new Set(PET_BREEDS.filter(b=>b.asset).map(b=>b.asset)).size,12);
 for(const name of ids){
  const f=path.join(dir,name+'.gltf');
  assert.ok(fs.statSync(f).size>100000,name+' missing');
  const j=JSON.parse(fs.readFileSync(f,'utf8'));
  assert.equal(j.asset.version,'2.0');
  assert.ok(j.skins?.length>=1,name+' skeleton missing');
  assert.ok(j.meshes?.length>=1,name+' mesh missing');
  assert.ok(j.buffers?.[0]?.uri?.startsWith('data:application/octet-stream;base64,'),name+' must work offline');
  const clips=j.animations.map(x=>x.name);
  for(const required of ['Idle','Walk','Gallop','Eating'])assert.ok(clips.includes(required),name+' missing '+required);
  assert.ok(clips.length>=12);
  assert.ok(PET_BREEDS.some(b=>b.asset===name&&b.colors.length===3));
 }
 assert.match(fs.readFileSync(path.join(dir,'LICENSE.txt'),'utf8'),/CC0/);
});
test('quaternius animation map resolves idle, walking, gallop, sniffing and sleeping safely',()=>{
 const clips=['Idle','Idle_2','Idle_2_HeadLow','Walk','Gallop','Eating','Attack'];
 for(const [action,want] of [['idle','Idle'],['walk','Walk'],['run','Gallop'],
  ['sniff','Idle_2_HeadLow'],['sleep','Idle_2_HeadLow'],['eat','Eating'],['wait','Idle_2']]){
  assert.equal(quaterniusAnimationFor(action,clips),want);
 }
 assert.equal(quaterniusAnimationFor('idle',clips,2),'Gallop');
 assert.equal(quaterniusAnimationFor('walk',['Idle','Walk']), 'Walk');
 assert.equal(hasQuaterniusPet('shibainu'),true);
 assert.equal(hasQuaterniusPet('siamese'),false);
});
test('GLTFLoader decodes the actual animated rigs without broken bones',async()=>{
 const loader=new GLTFLoader();
 for(const name of ['ShibaInu','Horse','Wolf']){
  const gltf=await loader.parseAsync(fs.readFileSync(path.join(dir,name+'.gltf'),'utf8'),'');
  assert.ok(gltf.scene);
  assert.ok(gltf.animations.length>=12);
  let bones=0,meshes=0;
  gltf.scene.traverse(o=>{if(o.isBone)bones++;if(o.isSkinnedMesh)meshes++;});
  assert.ok(bones>5,name+' bones');
  assert.ok(meshes>0,name+' skinned geometry');
  const box=new T.Box3().setFromObject(gltf.scene);
  assert.ok(box.isEmpty()===false);
  assert.ok([box.max.y,box.min.y].every(Number.isFinite));
  const mixer=new T.AnimationMixer(gltf.scene);
  for(const label of ['Idle','Walk','Gallop']){
   const clip=gltf.animations.find(c=>c.name===label);
   const action=mixer.clipAction(clip);action.reset().play();
   mixer.update(.13);
   gltf.scene.updateMatrixWorld(true);
   gltf.scene.traverse(o=>{if(o.isBone)assert.ok(o.matrixWorld.elements.every(Number.isFinite),name+' invalid pose');});
   action.stop();
  }
  mixer.stopAllAction();
 }
});
