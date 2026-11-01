import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRebornUpperBodyMotion,rebornMotionType,REBORN_MOTION_PRESETS,REBORN_UPPER_BODY_BONES} from '../js/cas-reborn-upperbody.mjs';

const makeRig=()=>{
 const root=new THREE.Group();
 const torso=new THREE.Bone();torso.name='Spine02';torso.position.y=1.3;root.add(torso);
 const parts=[torso];
 for(const [side,sign] of [['Left',-1],['Right',1]]){
  const shoulder=new THREE.Bone();shoulder.name=side+'Shoulder';shoulder.position.set(sign*.16,.12,0);
  const arm=new THREE.Bone();arm.name=side+'Arm';arm.position.set(sign*.13,-.06,0);
  const forearm=new THREE.Bone();forearm.name=side+'ForeArm';forearm.position.set(sign*.025,-.28,0);
  const hand=new THREE.Bone();hand.name=side+'Hand';hand.position.set(0,-.23,0);
  torso.add(shoulder);shoulder.add(arm);arm.add(forearm);forearm.add(hand);
  parts.push(shoulder,arm,forearm,hand);
 }
 root.updateMatrixWorld(true);
 return {root,parts};
};
const runPose=(layer,mode,t,dur=1)=>{
 layer.restore();
 layer.update(1/30,{clip:mode,time:t,duration:dur});
};
test('motion identifies locomotion only; cannot override combat or gestures',()=>{
 for(const name of ['rifle_walk','crouch','cas_wave','drive','home_cook','rifle_run'])assert.equal(rebornMotionType(name),'off');
 for(const name of ['jump_start','jump_air','jump_land'])assert.equal(rebornMotionType(name),'jump');
 assert.equal(rebornMotionType('run'),'run');assert.equal(rebornMotionType('idle'),'idle');
 assert.ok(REBORN_UPPER_BODY_BONES.includes('LeftHand'));
 assert.ok(REBORN_MOTION_PRESETS.run.elbow>REBORN_MOTION_PRESETS.walk.elbow);
});
test('rejects rigs lacking wrists or elbows',()=>{
 const root=new THREE.Group();assert.throws(()=>createRebornUpperBodyMotion(root),/articulações superiores ausentes/);
});
test('arms, elbows and wrists ALL rotate during walking, in opposite phases',()=>{
 const {root}=makeRig(),layer=createRebornUpperBodyMotion(root);
 const landmarks=['LeftArm','RightArm','LeftForeArm','RightForeArm','LeftHand','RightHand'];
 for(let i=0;i<60;i++)runPose(layer,'walk',i/60,1);
 layer.restore();const before=landmarks.map(n=>root.getObjectByName(n).quaternion.clone());
 layer.update(1/60,{clip:'walk',time:.25,duration:1});
 const q1=landmarks.map(n=>root.getObjectByName(n).quaternion.clone());
 layer.restore();layer.update(1/60,{clip:'walk',time:.75,duration:1});
 const q2=landmarks.map(n=>root.getObjectByName(n).quaternion.clone());
 for(let i=0;i<landmarks.length;i++)assert.ok(q1[i].angleTo(q2[i])>.025,landmarks[i]+' must animate at the joint');
 for(let i=0;i<landmarks.length;i++)assert.ok(q1[i].angleTo(before[i])<.72,landmarks[i]+' must not twist >41 degrees');
 const left=root.getObjectByName('LeftArm').quaternion;
 const right=root.getObjectByName('RightArm').quaternion;
 assert.ok(left.x*right.x<0,'arms should counter-swing');
});
test('restore prevents additive accumulation across 500 frames and clip changes',()=>{
 const {root,parts}=makeRig(),layer=createRebornUpperBodyMotion(root);
 const bind=new Map(parts.map(x=>[x,x.quaternion.clone()]));
 for(let n=0;n<500;n++){layer.restore();layer.update(1/60,{clip:n%3===0?'run':'walk',time:n/30,duration:1});}
 layer.restore();
 for(const [b,q] of bind)assert.ok(b.quaternion.angleTo(q)<.00001,'rest must survive loops on '+b.name);
 assert.equal(layer.getTelemetry().updated,500);
});
test('non-locomotion gesture returns to rest, staying finite',()=>{
 const {root}=makeRig(),layer=createRebornUpperBodyMotion(root);
 for(let i=0;i<90;i++)runPose(layer,'run',i/50,1);
 const high=layer.getTelemetry().armSwing;
 for(let i=0;i<120;i++)runPose(layer,'home_cook',0,1);
 const low=layer.getTelemetry().armSwing;
 assert.ok(high>.2);
 assert.ok(low<.001,'upper-body corrections should yield to other actions: '+low);
 const wrist=root.getObjectByName('RightHand').quaternion;
 assert.ok(Number.isFinite(wrist.x)&&Number.isFinite(wrist.w),'no NaN quaternions');
});
