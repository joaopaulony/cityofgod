import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {installRebornHandBones,createRebornHandMotion,REBORN_HAND_BONE_COUNT,REBORN_DIGITS} from '../js/cas-reborn-hands.mjs';

function makeRig({female=false}={}){
 const root=new THREE.Group();root.scale.setScalar(.01);
 const spine=new THREE.Bone();spine.name='Spine02';spine.position.set(0,115,0);root.add(spine);
 const lengths=female?[20,21]:[24,25];
 for(const [side,sign] of [['Left',1],['Right',-1]]){
  const shoulder=new THREE.Bone();shoulder.name=side+'Shoulder';shoulder.position.set(sign*13,14,0);
  const arm=new THREE.Bone();arm.name=side+'Arm';arm.position.set(sign*8,-2,0);
  const fore=new THREE.Bone();fore.name=side+'ForeArm';fore.position.set(sign*6,-lengths[0],0);
  const hand=new THREE.Bone();hand.name=side+'Hand';hand.position.set(sign*7,-lengths[1],1);
  spine.add(shoulder);shoulder.add(arm);arm.add(fore);fore.add(hand);
 }
 root.updateMatrixWorld(true);return root;
}
const count=root=>{let bones=0,meshes=0;root.traverse(n=>{if(n.isBone)bones++;if(n.isMesh)meshes++});return {bones,meshes};};
function step(layer,clip,frames=60){
 for(let i=0;i<frames;i++)layer.update(1/60,{clip,phase:Math.PI*2*i/60,time:i/60});
}
test('Adds palms and five full finger trees on BOTH wrists, without human meshes',()=>{
 const root=makeRig(),before=count(root);
 const rig=installRebornHandBones(root),after=count(root);
 assert.equal(after.bones-before.bones,REBORN_HAND_BONE_COUNT);
 assert.equal(after.meshes,0);
 assert.equal(rig.addedBones,52);
 for(const side of ['Left','Right']){
  const palm=root.getObjectByName(side+'HandPalm');
  assert.equal(palm.parent.name,side+'Hand');
  for(const digit of REBORN_DIGITS){
   const joints=['0','1','2','3','End'].map(s=>root.getObjectByName(side+'Hand'+digit+s));
   assert.ok(joints.every(b=>b?.isBone),side+digit+' must have five joints');
   assert.equal(joints[0].parent,palm);
   for(let n=1;n<joints.length;n++)assert.equal(joints[n].parent,joints[n-1]);
   assert.ok(joints[4].getWorldPosition(new THREE.Vector3()).distanceTo(palm.getWorldPosition(new THREE.Vector3()))>.04);
  }
 }
});
test('Idempotent installation does not duplicate bones or mutate source skeleton',()=>{
 const root=makeRig();
 const first=installRebornHandBones(root),n=count(root).bones;
 const second=installRebornHandBones(root);
 assert.equal(first,second);assert.equal(count(root).bones,n);
 assert.throws(()=>installRebornHandBones(new THREE.Group()),/incomplete hand rig/);
});
test('Each finger knuckle, middle and distal joint bends during animation',()=>{
 const root=makeRig(),layer=createRebornHandMotion(root);
 step(layer,'idle',40);
 const fingerNames=['LeftHandIndex1','LeftHandIndex2','LeftHandIndex3','RightHandThumb1','RightHandRing2','RightHandPinky3'];
 const idle=fingerNames.map(n=>root.getObjectByName(n).quaternion.clone());
 step(layer,'run',95);
 for(let i=0;i<fingerNames.length;i++){
  const bone=root.getObjectByName(fingerNames[i]);
  assert.ok(idle[i].angleTo(bone.quaternion)>.03,fingerNames[i]+' must flex and not remain rigid');
  assert.ok(bone.quaternion.toArray().every(Number.isFinite),'finite finger quaternion');
 }
 assert.ok(layer.getTelemetry().flex.Left>.45);
 assert.ok(layer.getTelemetry().flex.Right>.45);
});
test('Wave opens right hand and cheer closes both fists independently',()=>{
 const root=makeRig(),layer=createRebornHandMotion(root);
 step(layer,'cas_wave',95);
 const wave=layer.getTelemetry();
 assert.ok(wave.flex.Right<wave.flex.Left);
 step(layer,'cas_cheer',95);
 const cheer=layer.getTelemetry();
 assert.ok(cheer.flex.Left>.65&&cheer.flex.Right>.65);
 step(layer,'cas_stretch',100);
 const stretch=layer.getTelemetry();
 assert.ok(stretch.flex.Left<.08&&stretch.flex.Right<.08);
});
test('Animation never accumulates infinite twists or drops any finger bones over 1500 frames',()=>{
 const root=makeRig({female:true}),layer=createRebornHandMotion(root);
 const boneBefore=count(root).bones;
 for(let i=0;i<1500;i++){
  const clip=['walk','run','idle','jump_air','cas_wave','cas_phone'][Math.floor(i/40)%6];
  layer.update(1/60,{clip,phase:i*.11,time:i*.016});
 }
 assert.equal(count(root).bones,boneBefore);
 for(const side of ['Left','Right'])for(const digit of REBORN_DIGITS)for(const suffix of ['0','1','2','3','End']){
  const bone=root.getObjectByName(side+'Hand'+digit+suffix);
  assert.ok(bone.quaternion.toArray().every(Number.isFinite),bone.name+' quaternion must stay finite');
  assert.ok(bone.quaternion.angleTo(new THREE.Quaternion())<=1.3,bone.name+' exceeds natural bend');
 }
 assert.equal(layer.getTelemetry().frames,1500);
});
