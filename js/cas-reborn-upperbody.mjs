import * as THREE from 'three';
import {createRebornHandMotion} from './cas-reborn-hands.mjs';

// Secondary anatomical motion for the original 24-joint Reborn rigs. Meshy exports contain
// a pelvis/torso gait but the arms, elbows and wrists are weakly animated.
// All corrections are applied AFTER AnimationMixer.update(), in the actor's
// forward (local +Z) coordinate system, never as accumulating Euler angles.
export const REBORN_MOTION_PRESETS=Object.freeze({
 idle:{arm:.038,elbow:.016,wrist:.025,shoulder:.014,torso:.009},
 walk:{arm:.265,elbow:.105,wrist:.095,shoulder:.047,torso:.038},
 run:{arm:.335,elbow:.190,wrist:.115,shoulder:.075,torso:.052},
 jump:{arm:.065,elbow:.085,wrist:.060,shoulder:.018,torso:0},
 off:{arm:0,elbow:0,wrist:0,shoulder:0,torso:0}
});
export const REBORN_UPPER_BODY_BONES=Object.freeze([
 'LeftShoulder','LeftArm','LeftForeArm','LeftHand',
 'RightShoulder','RightArm','RightForeArm','RightHand'
]);
export function rebornMotionType(clip){
 if(clip==='walk')return 'walk';
 if(clip==='run')return 'run';
 if(clip==='idle')return 'idle';
 if(/^jump_(start|air|land)$/.test(clip))return 'jump';
 return 'off'; // Never interfere with combat, vehicles, sitting or emotes.
}
const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
const finite=n=>Number.isFinite(n)?n:0;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const TAU=Math.PI*2;

/**
 * Add subtle complementary, phase-locked shoulder / elbow / wrist motion.
 *
 * The underlying GLBs have 24 bones and no finger skin weights. We attach
 * a 52-bone palm/digit extension at runtime and animate every finger joint.
 * This is a functional bone rig, not a skinned human mesh.
 *
 * The returned layer owns no mixer actions and does not edit glTF clips.
 * Disable the layer when using non-Reborn characters. Playback/preview must
 * call update immediately after its mixer update while the rig is visible.
 */
export function createRebornUpperBodyMotion(root){
 const fingers=createRebornHandMotion(root);
 const missing=REBORN_UPPER_BODY_BONES.filter(name=>!root.getObjectByName(name)?.isBone);
 if(missing.length)throw Error('CAS Reborn: articulações superiores ausentes: '+missing.join(', '));
 const bones=Object.fromEntries(REBORN_UPPER_BODY_BONES.map(name=>[name,root.getObjectByName(name)]));
 const torso=root.getObjectByName('Spine02');
 if(!torso?.isBone)throw Error('CAS Reborn: Spine02 ausente');
 // Reused allocations: no objects created every animation frame.
 const rootQ=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),q=new THREE.Quaternion(),axis=new THREE.Vector3(),axisWorld=new THREE.Vector3();
 let current={...REBORN_MOTION_PRESETS.off},phase=0,mode='off',updated=0,handDynamics=0;
 const tracked=[torso,...REBORN_UPPER_BODY_BONES.map(name=>bones[name])];
 const before=tracked.map(()=>new THREE.Quaternion());
 let hasOverlay=false;
 // Two-bone soft IK keeps run hands near the ribs instead of letting
 // a generated clip fling a straight arm through the belly or off to the side.
 const start=new THREE.Vector3(),elbow=new THREE.Vector3(),wrist=new THREE.Vector3();
 const goal=new THREE.Vector3(),elbowGoal=new THREE.Vector3(),pole=new THREE.Vector3();
 const reach=new THREE.Vector3(),local=new THREE.Vector3(),delta=new THREE.Quaternion(),rot=new THREE.Quaternion();
 const targetDir=new THREE.Vector3(),sourceDir=new THREE.Vector3();
 const aim=(joint,child,dest,weight)=>{
  joint.updateWorldMatrix(true,false);child.updateWorldMatrix(true,false);
  joint.getWorldPosition(start);child.getWorldPosition(elbow);
  sourceDir.subVectors(elbow,start).normalize();
  targetDir.subVectors(dest,start).normalize();
  if(sourceDir.lengthSq()<.9||targetDir.lengthSq()<.9)return;
  delta.setFromUnitVectors(sourceDir,targetDir);
  // Limit each correction to a physically manageable range.
  rot.identity().slerp(delta,clamp(weight,0,.82));
  joint.parent.getWorldQuaternion(parentQ);
  const localRot=parentQ.clone().invert().multiply(rot).multiply(parentQ);
  joint.quaternion.premultiply(localRot).normalize();
  joint.updateMatrixWorld(true);
 };
 const guide=(side,sign,wave)=>{
  const upper=bones[side+'Arm'],fore=bones[side+'ForeArm'],hand=bones[side+'Hand'];
  root.updateMatrixWorld(true);
  upper.getWorldPosition(start);fore.getWorldPosition(elbow);hand.getWorldPosition(wrist);
  const length1=start.distanceTo(elbow),length2=elbow.distanceTo(wrist);
  if(length1<.06||length2<.06)return;
  // y controls elbow bend. z uses contralateral phase, never random jitter.
  const running=mode==='run',weight=(running?.72:.36);
  local.copy(start);root.worldToLocal(local);
  local.x+=sign*(running?.09:.045);
  local.y-=running?.175:.415;
  local.z+=(running?.08:.025)+sign*wave*(running?.19:.145);
  goal.copy(local);root.localToWorld(goal);
  reach.subVectors(goal,start);
  const distance=clamp(reach.length(),Math.abs(length1-length2)+.002,length1+length2-.008);
  reach.normalize();goal.copy(start).addScaledVector(reach,distance);
  // Elbow pole: softly to the outside and just behind the torso.
  root.getWorldQuaternion(rootQ);
  pole.set(sign*.18,-.12,-1).applyQuaternion(rootQ);
  pole.addScaledVector(reach,-pole.dot(reach));
  if(pole.lengthSq()<1e-6)pole.set(sign,0,0);
  pole.normalize();
  const along=(length1*length1-length2*length2+distance*distance)/(2*distance);
  const offset=Math.sqrt(Math.max(0,length1*length1-along*along));
  elbowGoal.copy(start).addScaledVector(reach,along).addScaledVector(pole,offset);
  aim(upper,fore,elbowGoal,weight);
  aim(fore,hand,goal,weight);
 };
 const rotate=(bone,worldRelativeAxis,angle)=>{
  if(Math.abs(angle)<1e-7)return;
  // Convert character-local axis to parent-local axis, including turn + pose.
  root.updateWorldMatrix(true,false);
  root.getWorldQuaternion(rootQ);
  bone.parent.updateWorldMatrix(true,false);
  bone.parent.getWorldQuaternion(parentQ);
  axisWorld.copy(worldRelativeAxis).applyQuaternion(rootQ);
  axis.copy(axisWorld).applyQuaternion(parentQ.invert()).normalize();
  q.setFromAxisAngle(axis,clamp(angle,-.48,.48));
  bone.quaternion.premultiply(q).normalize();
  bone.updateMatrixWorld(true);
 };
 const bend=(side,sign,wave,follow,cycle,breath)=>{
  const shoulder=bones[side+'Shoulder'],upper=bones[side+'Arm'],forearm=bones[side+'ForeArm'],hand=bones[side+'Hand'];
  const arm=-sign*current.arm*wave;
  // Shoulder counter-rotation offsets the gait: avoids arms pinned to torso.
  rotate(shoulder,Z,sign*current.shoulder*(.55+.45*follow));
  rotate(upper,X,arm);
  // Elbow direction must be symmetric in character space. Release reaches
  // behind the body; recovery flexes as that hand swings in front.
  rotate(forearm,X,-current.elbow*(.35+.30*follow+.70*Math.max(0,-sign*wave)));
  // Wrist lags the forearm and gently rolls. Hand is not a rigid forearm rod.
  rotate(hand,X,current.wrist*(-.4*sign*wave+.28*follow)+current.wrist*.15*breath);
  rotate(hand,Y,sign*current.wrist*.27*Math.sin(cycle-.55));
  handDynamics+=Math.abs(current.wrist*wave);
 };
 return {
  // Called before mixer.update(), so clips missing a joint cannot inherit the
  // last frame's procedural wrist/shoulder offsets. Also safe when idle or off.
  restore(){
   if(!hasOverlay)return;
   tracked.forEach((bone,i)=>bone.quaternion.copy(before[i]));
   hasOverlay=false;
   root.updateMatrixWorld(true);
  },
  update(dt,{clip='idle',time=null,duration=null}={}){
   tracked.forEach((bone,i)=>before[i].copy(bone.quaternion));
   hasOverlay=true;
   mode=rebornMotionType(clip);
   const preset=REBORN_MOTION_PRESETS[mode];
   const step=clamp(finite(dt),0,.075);
   // Smooth mode changes. Do not add offsets repeatedly if no mixer frame.
   const damping=1-Math.exp(-step*12);
   for(const k of ['arm','elbow','wrist','shoulder','torso'])current[k]+=(preset[k]-current[k])*damping;
   const cycleDuration=mode==='walk'?Math.max(.35,finite(duration)||1.03):mode==='run'?Math.max(.35,finite(duration)||.7):1.8;
   if(mode==='walk'||mode==='run'){
    // Synchronize secondary motion to the authored footfall cycle, preventing
    // slipping/out-of-phase shoulders after animation cross-fades.
    if(Number.isFinite(time))phase=(time/cycleDuration%1)*TAU;
    else phase=(phase+TAU*step/cycleDuration)%TAU;
   }else phase=(phase+step*(mode==='idle'?2.1:3))%TAU;
   const wave=Math.sin(phase),follow=Math.cos(phase-.28),breath=Math.sin(phase*.48);
   // Fingers follow gait and action-specific grip targets on every frame,
   // including when no shoulder motion is allowed (gestures, weapons, home).
   fingers.update(step,{clip,phase,time});
   if(current.arm+current.elbow+current.wrist+current.shoulder+current.torso<.00001)return;
   rotate(torso,Y,-current.torso*wave);
   bend('Left',1,wave,follow,phase,breath);
   bend('Right',-1,wave,follow,phase+Math.PI,breath);
   if((mode==='run'||mode==='walk')&&current.arm>.04){
    guide('Left',1,wave);
    guide('Right',-1,wave);
    // The two-bone guide controls where the hands travel; a small additional
    // elbow flex keeps the forearm alive through the recovery part of the gait.
    rotate(bones.LeftForeArm,X,-current.elbow*.55*Math.cos(phase+.42));
    rotate(bones.RightForeArm,X,-current.elbow*.55*Math.cos(phase-.42));
   }
   updated++;
  },
  getTelemetry(){
   return {mode,phase,updated,armSwing:current.arm,elbowFlex:current.elbow,wristMotion:current.wrist,handDynamics,fingers:fingers.getTelemetry()};
  }
 };
}
