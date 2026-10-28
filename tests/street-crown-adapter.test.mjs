import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {inspectStreetCrown,streetModelForSex,STREET_CROWN_DEFAULT,STREET_CROWN_MODELS} from '../js/street-crown-adapter.mjs';
const named=['Hips','Spine','Head','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftLeg','RightLeg'];
function fake(valid=true){
 const root=new THREE.Group(),bones=[];
 for(let i=0;i<24;i++){
  const bone=new THREE.Bone();
  bone.name=named[i]||'Joint'+i;
  root.add(bone);bones.push(bone);
 }
 const geo=new THREE.BoxGeometry(.4,1.5,.25,1,1,1);
 if(valid){
  const count=geo.attributes.position.count;
  const joints=new Uint16Array(count*4),weights=new Float32Array(count*4);
  for(let i=0;i<count;i++)weights[i*4]=1;
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));
  geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 }
 const mesh=new THREE.SkinnedMesh(geo,new THREE.MeshStandardMaterial());
 root.add(mesh);
 mesh.bind(new THREE.Skeleton(bones));
 return {scene:root,animations:[]};
}
test('six original GLBs mapped to correct sex and no car',()=>{
 assert.deepEqual(Object.keys(STREET_CROWN_MODELS),['hero','partner','ped_man','ped_woman','thug','boss']);
 assert.equal(streetModelForSex('partner','male'),STREET_CROWN_DEFAULT.male);
 assert.equal(streetModelForSex('ped_woman','female'),'ped_woman');
 assert.equal(streetModelForSex('unknown','female'),STREET_CROWN_DEFAULT.female);
});
test('quality gate accepts a complete 24-bone weighted skinned human',()=>{
 const result=inspectStreetCrown(fake());
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.bones,24);
 assert.ok(result.triangles>0&&result.triangles<4500);
 assert.equal(result.sourceFingerWeights,false,'new finger bones must never be mistaken for bound geometry');
});
test('unweighted or unskinned humans are rejected',()=>{
 const result=inspectStreetCrown(fake(false));
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(t=>/missing JOINTS/.test(t)));
});
test('polygon limit is mandatory for browser NPCs',()=>{
 const result=inspectStreetCrown(fake(),{maxTriangles:1});
 assert.equal(result.ok,false);
 assert.ok(result.errors.some(t=>/Triangle budget/.test(t)));
});
