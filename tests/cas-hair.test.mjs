import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCASHairCatalog} from '../js/cas-hair.mjs';
import {normalizeCAS} from '../js/cas-profile.mjs';

test('CAS hair catalog accepts 21 unique licensed GLB filenames',()=>{
 const styles=Array.from({length:21},(_,i)=>{
  const id='hair-'+String(i+1).padStart(2,'0');
  return {id,file:id+'.glb',label:'Cabelo '+(i+1),triangles:10000};
 });
 const result=validateCASHairCatalog({schema:1,styles});
 assert.equal(result.length,21);
 assert.equal(result[0].id,'hair-01');
 assert.equal(result.at(-1).id,'hair-21');
});
test('CAS hair catalog prevents duplicate and traversal files',()=>{
 assert.throws(()=>validateCASHairCatalog({schema:1,styles:[{id:'hair-01',file:'../../secret.glb'}]}));
 assert.throws(()=>validateCASHairCatalog({schema:1,styles:[{id:'hair-01',file:'hair-01.glb'},{id:'hair-01',file:'hair-01.glb'}]}));
});
test('CAS profile persists approved hair IDs and rejects invalid values',()=>{
 assert.equal(normalizeCAS({hairStyle:'hair-18'}).hairStyle,'hair-18');
 assert.equal(normalizeCAS({hairStyle:'../../secret'}).hairStyle,'none');
 assert.equal(normalizeCAS({}).hairStyle,'none');
});
