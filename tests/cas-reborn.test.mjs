import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {REBORN_FILES,normalizeRebornClip,validateRebornGLTF} from '../js/cas-reborn.mjs';

function pose(name,angle=0){
 const root=new THREE.Group(),bone=new THREE.Bone();
 bone.name=name;bone.quaternion.setFromEuler(new THREE.Euler(angle,0,0));
 root.add(bone);
 return {root,bone};
}
test('Reborn enumerates two skinned bodies and three animations',()=>{
 assert.deepEqual(Object.keys(REBORN_FILES),['male','female','walk','run','jump']);
});
test('corrects animation tracks relative to each distinct bind-pose (no neck snapping)',()=>{
 const from=pose('Head',.6),to=pose('Head',0);
 const animated=new THREE.Quaternion().setFromEuler(new THREE.Euler(.9,0,0));
 const original=new THREE.AnimationClip('external-walk',1,[
  new THREE.QuaternionKeyframeTrack('Head.quaternion',[0,1],[...animated.toArray(),...animated.toArray()])
 ]);
 const result=normalizeRebornClip(original,from.root,to.root,'walk');
 assert.equal(result.name,'walk');
 const q=new THREE.Quaternion().fromArray(result.tracks[0].values,0);
 const expected=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,0,0));
 assert.ok(Math.abs(q.dot(expected))>.999,'Bind pose quaternion must be cancelled');
 assert.equal(original.name,'external-walk','Original clip must not be modified');
 assert.ok(Math.abs(original.tracks[0].values[0]-animated.x)<1e-5);
});
test('converts root translation to in-place while preserving vertical hip bounce',()=>{
 const from=pose('Hips'),to=pose('Hips');
 from.bone.position.set(.6,1.2,.4);to.bone.position.set(0,1.15,0);
 const src=new THREE.AnimationClip('walk',1,[new THREE.VectorKeyframeTrack('Hips.position',[0,1],[1,1.4,2,3,1.5,5])]);
 const result=normalizeRebornClip(src,from.root,to.root,'walk',{inPlace:true});
 assert.deepEqual(Array.from(result.tracks[0].values).map(x=>Math.round(x*100)),[0,135,0,0,145,0]);
});
test('rejects unrigged 3D statues as player avatars',()=>{
 assert.throws(()=>validateRebornGLTF({scene:new THREE.Group(),animations:[]},'statue'),/sem modelo e animação/);
});
