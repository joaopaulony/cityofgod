import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PET_BREEDS,petBreed,validPetRow} from '../js/pet-catalog.mjs';
import {QUATERNIUS_MODELS,clipForAction,isAnimatedBreed} from '../js/pet-animated.mjs';

test('All 12 authentic Quaternius animal models join the six original pets',()=>{
 assert.equal(PET_BREEDS.length,18);
 const newBreeds=PET_BREEDS.filter(b=>b.model);
 assert.equal(newBreeds.length,12);
 assert.deepEqual(new Set(newBreeds.map(b=>b.model)),new Set(QUATERNIUS_MODELS));
 assert.equal(PET_BREEDS.filter(b=>!b.model).length,6);
 for(const b of newBreeds){
  assert.ok(isAnimatedBreed(b.id));assert.equal(b.colors.length,3);
  assert.ok(b.targetHeight>.25&&b.targetHeight<2);
  assert.ok(validPetRow({id:'abc',breed:b.id,color:'original',name:b.name,home:'home:1'}));
 }
 assert.equal(isAnimatedBreed('yorkshire'),false);
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
test('All original six pets retain their names, IDs and saved coat IDs',()=>{
 for(const name of ['yorkshire','rottweiler','pomeranian','fluffycat','slimcat','siamese']){
  const b=petBreed(name);assert.ok(b&&!b.model&&b.colors.length===3);
 }
});
