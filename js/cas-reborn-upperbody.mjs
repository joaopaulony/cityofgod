import * as THREE from 'three';

// Secondary anatomical motion for the 24-joint Reborn rigs. Meshy exports contain
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
 * Rig limitation: 24-bone Meshy bodies have no finger joints or finger skin
 * weights. We can soften hands at the wrists, NOT independently flex fingers.
 *
 * The returned layer owns no mixer actions and does not edit glTF clips.
 * Disable the layer when using non-Reborn characters. Playback/preview must
 * call update immediately after its mixer update while the rig is visible.
 */
export function createRebornUpperBodyMotion(root){
 const missing=REBORN_UPPER_BODY_BONES.filter(name=>!root.getObjectByName(name)?.isBone);
 if(missing.length)throw Error('CAS Reborn: articulações superiores ausentes: '+missing.join(', '));
 const bones=Object.fromEntries(REBORN_UPPER_BODY_BONES.map(name=>[name,root.getObjectByName(name)]));
 const torso=root.getObjectByName('Spine02');
 if(!torso?.isBone)throw Error('CAS Reborn: Spine02 ausente');
 // Reused allocations: no objects created every animation frame.
 const rootQ=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),q=new THREE.Quaternion(),axis=new THREE.Vector3(),axisWorld=new THREE.Vector3();
 let current={...REBORN_MOTION_PRESETS.off},phase=0,mode='off',updated=0,handDynamics=0;
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
  rotate(forearm,X,-current.elbow*(.62+.38*follow)-current.elbow*.28*Math.max(0,-sign*wave));
  // Wrist lags the forearm and gently rolls. Hand is not a rigid forearm rod.
  rotate(hand,X,current.wrist*(-.4*sign*wave+.28*follow)+current.wrist*.15*breath);
  rotate(hand,Y,sign*current.wrist*.27*Math.sin(cycle-.55));
  handDynamics+=Math.abs(current.wrist*wave);
 };
 return {
  update(dt,{clip='idle',time=null,duration=null}={}){
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
   if(current.arm+current.elbow+current.wrist+current.shoulder+current.torso<.00001)return;
   rotate(torso,Y,-current.torso*wave);
   bend('Left',1,wave,follow,phase,breath);
   bend('Right',-1,wave,follow,phase+Math.PI,breath);
   updated++;
  },
  getTelemetry(){
   return {mode,phase,updated,armSwing:current.arm,elbowFlex:current.elbow,wristMotion:current.wrist,handDynamics};
  }
 };
}
