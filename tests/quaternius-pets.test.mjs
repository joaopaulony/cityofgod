import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PET_BREEDS,petBreed,validPetRow} from '../js/pet-catalog.mjs';
import {QUATERNIUS_MODELS,THIRD_PARTY_MODELS,clipForAction,isAnimatedBreed} from '../js/pet-animated.mjs';

test('All 12 authentic Quaternius animal models join the six original pets',()=>{
 assert.equal(PET_BREEDS.length,14);
 const newBreeds=PET_BREEDS.filter(b=>b.model);
 assert.equal(newBreeds.length,14);
 assert.deepEqual(new Set(newBreeds.map(b=>b.model)),new Set([...QUATERNIUS_MODELS,...THIRD_PARTY_MODELS]));
 assert.equal(PET_BREEDS.filter(b=>!b.model).length,0);
 for(const b of newBreeds){
  assert.ok(isAnimatedBreed(b.id));assert.equal(b.colors.length,3);
  assert.ok(b.targetHeight>.25&&b.targetHeight<2);
  assert.ok(validPetRow({id:'abc',breed:b.id,color:'original',name:b.name,home:'home:1'}));
 }
 assert.equal(isAnimatedBreed('yorkshire'),false);
 assert.equal(isAnimatedBreed('sharpei'),true);
 assert.equal(isAnimatedBreed('benny'),true);
});
test('Every shipped animal is skinned, self-contained and has locomotion, eating and idle clips',()=>{
 for(const model of QUATERNIUS_MODELS){
  const path='assets/pets/quaternius/'+model+'.gltf';
  const json=JSON.parse(fs.readFileSync(path,'utf8'));
  assert.equal(json.asset.version,'2.0',model);
  assert.ok(json.skins?.length>0,model+' requires skeletal mesh');
  assert.ok(json.meshes?.length>0,model+' mesh');
  assert.ok(json.buffers?.[0].uri.startsWith('data:application/octet-stream;base64,'),model+' embedded buffer');
  const names=json.animations.map(a=>a.name);
  for(const state of ['Idle','Walk','Gallop','Eating'])assert.ok(names.includes(state),model+': '+state);
  assert.ok(json.nodes.length>30,model+' skeleton nodes');
 }
});
test('Action map uses a real imported animation for all six pet states',()=>{
 for(const model of QUATERNIUS_MODELS){
  const clips=JSON.parse(fs.readFileSync('assets/pets/quaternius/'+model+'.gltf','utf8')).animations;
  for(const state of ['idle','walk','run','sniff','sleep','sit']){
   const clip=clipForAction(state,clips);
   assert.ok(clips.some(c=>c.name===clip),model+': '+state+' -> '+clip);
  }
  assert.equal(clipForAction('walk',clips),'Walk');
  assert.equal(clipForAction('run',clips),'Gallop');
  assert.equal(clipForAction('sniff',clips),'Eating');
 }
});
test('Original procedural pets are absent and Shar Pei is a complete rigged GLB',()=>{
 for(const name of ['yorkshire','rottweiler','pomeranian','fluffycat','slimcat','siamese'])
  assert.equal(petBreed(name),undefined);
 const blob=fs.readFileSync('assets/pets/thirdparty/sharpei.glb');
 assert.equal(blob.subarray(0,4).toString(),'glTF');
 const jsonLength=blob.readUInt32LE(12);
 const doc=JSON.parse(blob.subarray(20,20+jsonLength).toString('utf8'));
 assert.ok(doc.skins?.length>0);
 assert.deepEqual(doc.animations.map(x=>x.name),['sitting_idle','walking_cycle','standing_idle']);
});
test('Benny FBX retains the original six rig animations',()=>{
 const fbx=fs.readFileSync('assets/pets/thirdparty/benny.fbx');
 assert.equal(fbx.subarray(0,20).toString('ascii'),'Kaydara FBX Binary  ');
 assert.ok(fbx.length>1_000_000);
 for(const name of ['attack','attack2','die','flinch','idle','run'])
  assert.ok(fbx.includes(Buffer.from('dogArmature|'+name)),name+' missing');
});
test('Third party dogs map only to their real published animation clips',()=>{
 const shar=['sitting_idle','walking_cycle','standing_idle'];
 assert.equal(clipForAction('walk',shar),'walking_cycle');
 assert.equal(clipForAction('sit',shar),'sitting_idle');
 assert.equal(clipForAction('idle',shar),'standing_idle');
 const benny=['dogArmature|attack','dogArmature|attack2','dogArmature|die','dogArmature|flinch','dogArmature|idle','dogArmature|run'];
 assert.equal(clipForAction('walk',benny),'dogArmature|run');
 assert.equal(clipForAction('run',benny),'dogArmature|run');
 assert.equal(clipForAction('idle',benny),'dogArmature|idle');
});
