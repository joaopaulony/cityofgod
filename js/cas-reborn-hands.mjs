import * as THREE from 'three';

// This extends the 24-bone, mesh-free CAS with real THREE.Bone joints.
// No old characters or hidden meshes are restored. The joints are rendered by
// SkeletonHelper and are independent of future mesh skinning/animation exports.
export const REBORN_DIGITS=Object.freeze(['Thumb','Index','Middle','Ring','Pinky']);
export const REBORN_HAND_SEGMENTS=Object.freeze(['0','1','2','3','End']);
export const REBORN_HAND_BONE_COUNT=2*(1+REBORN_DIGITS.length*REBORN_HAND_SEGMENTS.length);
const v=()=>new THREE.Vector3();
const clamp=(a,min,max)=>Math.max(min,Math.min(max,a));

function joint(name,position,parent){
 const b=new THREE.Bone();b.name=name;b.position.copy(position);parent.add(b);return b;
}
function basis(root,side){
 const hand=root.getObjectByName(side+'Hand');
 const fore=root.getObjectByName(side+'ForeArm');
 const torso=root.getObjectByName('Spine02')||root.getObjectByName('Spine');
 if(!hand?.isBone||!fore?.isBone||!torso?.isBone)
  throw Error('CAS Reborn: incomplete hand rig '+side+'Hand/ForeArm/Spine');
 root.updateMatrixWorld(true);
 const wristW=hand.getWorldPosition(v()),foreW=fore.getWorldPosition(v()),torsoW=torso.getWorldPosition(v());
 const alongW=wristW.clone().sub(foreW);
 if(alongW.lengthSq()<.001)throw Error('CAS Reborn: invalid forearm length '+side);
 alongW.normalize();
 // Radial direction comes from shoulder/torso, NOT a hard-coded left/right
 // axis: the source male and female A-poses use distinct wrist quaternions.
 const outsideW=wristW.clone().sub(torsoW);
 outsideW.addScaledVector(alongW,-outsideW.dot(alongW));
 if(outsideW.lengthSq()<.00001){
  outsideW.set(side==='Left'?1:-1,0,0);
  outsideW.addScaledVector(alongW,-outsideW.dot(alongW));
 }
 outsideW.normalize();
 // Positive character-forward is the palm curl direction, projected onto
 // the plane normal to the forearm; no inverse-mesh or fake lines involved.
 const palmW=new THREE.Vector3(0,0,1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
 palmW.addScaledVector(alongW,-palmW.dot(alongW));
 if(palmW.lengthSq()<.00001)palmW.crossVectors(alongW,outsideW);
 palmW.normalize();
 const inv=hand.getWorldQuaternion(new THREE.Quaternion()).invert();
 const along=alongW.applyQuaternion(inv).normalize();
 const outside=outsideW.applyQuaternion(inv).normalize();
 const towardPalm=palmW.applyQuaternion(inv).normalize();
 const bend=along.clone().cross(towardPalm).normalize();
 if(bend.lengthSq()<.5)throw Error('CAS Reborn: invalid flexion axis '+side);
 // Lengths are relative to the source wrist-to-forearm span, working with
 // both centimeters in Meshy GLBs and meters in our synthetic rig tests.
 const forearmUnits=hand.position.length();
 if(forearmUnits<.03)throw Error('CAS Reborn: unexpectedly short wrist '+side);
 return {hand,along,outside,towardPalm,bend,length:forearmUnits};
}

/** Create exactly 52 joints (2 palms, 50 finger bones/tips) on a CLONED rig.
 * Idempotent: opening the studio again cannot duplicate any joints.
 */
export function installRebornHandBones(root){
 const installed=root.userData.rebornHandRig;
 if(installed)return installed;
 const present=root.getObjectByName('LeftHandPalm')||root.getObjectByName('RightHandPalm');
 if(present)throw Error('CAS Reborn: partial hand hierarchy, refusing duplicate rig');
 const hands={};
 for(const side of ['Left','Right']){
  const {hand,along,outside,towardPalm,bend,length}=basis(root,side);
  const scale=length,wide=length*.265;
  const palm=joint(side+'HandPalm',along.clone().multiplyScalar(scale*.105),hand);
  const fingers={};
  // Lateral order is radial thumb -> little finger. Lengths use natural
  // adult hand proportions; metacarpals fan out from a common palm.
  const layout={
   Thumb:{across:-.91,base:.010,splay:-.29,length:.78},
   Index:{across:-.46,base:.094,splay:-.12,length:.96},
   Middle:{across:-.12,base:.123,splay:-.025,length:1.05},
   Ring:{across:.245,base:.106,splay:.085,length:.96},
   Pinky:{across:.55,base:.071,splay:.19,length:.78}
  };
  for(const digit of REBORN_DIGITS){
   const spec=layout[digit],name=side+'Hand'+digit,parts=[];
   const base=outside.clone().multiplyScalar(wide*spec.across)
     .addScaledVector(along,scale*spec.base)
     .addScaledVector(towardPalm,digit==='Thumb'?scale*.014:0);
   parts.push(joint(name+'0',base,palm));
   const metacarpal=along.clone().multiplyScalar(scale*(digit==='Thumb'?.052:.105)*spec.length)
     .addScaledVector(outside,scale*spec.splay*.055);
   parts.push(joint(name+'1',metacarpal,parts[0]));
   parts.push(joint(name+'2',along.clone().multiplyScalar(scale*.086*spec.length),parts[1]));
   parts.push(joint(name+'3',along.clone().multiplyScalar(scale*.061*spec.length),parts[2]));
   parts.push(joint(name+'End',along.clone().multiplyScalar(scale*.041*spec.length),parts[3]));
   fingers[digit]={parts,bend:bend.clone(),normal:towardPalm.clone(),splay:spec.splay};
  }
  hands[side]={palm,fingers,hand};
 }
 root.updateMatrixWorld(true);
 const installedRig={hands,addedBones:REBORN_HAND_BONE_COUNT};
 // Store per CLONE, never on the source GLTF shared by multiple actors.
 root.userData.rebornHandRig=installedRig;
 return installedRig;
}

export function createRebornHandMotion(root){
 const {hands,addedBones}=installRebornHandBones(root);
 const current={};
 const angle=new THREE.Quaternion();
 let frames=0,mode='idle',lastFlex={Left:0,Right:0};
 for(const side of ['Left','Right'])
  for(const digit of REBORN_DIGITS)current[side+digit]=.12;
 function targetFlex(clip,side,digit,phase){
  const i=REBORN_DIGITS.indexOf(digit);
  const opposite=side==='Left'?0:Math.PI;
  const wave=Math.sin(phase+opposite+i*.27);
  let flex=.16;
  if(clip==='walk')flex=.20+.17*Math.max(0,wave);
  else if(clip==='run')flex=.51+.13*Math.max(0,wave);
  else if(clip==='idle')flex=.11+.045*Math.sin(phase*.64+i*.47);
  else if(/^jump_(start|air|land)$/.test(clip))flex=clip==='jump_air'?.13:.32;
  else if(clip==='cas_wave')flex=side==='Right'?.04:.18;
  else if(clip==='cas_phone')flex=side==='Right'?.50:.14;
  else if(clip==='cas_cheer')flex=.80;
  else if(clip==='cas_dance')flex=.19+.23*(.5+.5*Math.sin(phase*2+opposite+i*.3));
  else if(clip==='cas_stretch')flex=.025;
  else if(/rifle|armed|fire|reload|grip/.test(clip))flex=.71;
  else if(clip==='cas_sit')flex=.12;
  if(digit==='Thumb')flex*=.68;
  if(digit==='Pinky')flex*=1.08;
  return clamp(flex,0,.92);
 }
 function update(dt,{clip='idle',phase=0,time=0}={}){
  mode=clip;
  const fade=1-Math.exp(-Math.max(0,Math.min(.1,Number(dt)||0))*14);
  for(const side of ['Left','Right']){
   let aggregate=0;
   for(const digit of REBORN_DIGITS){
    const f=hands[side].fingers[digit],key=side+digit;
    const target=targetFlex(clip,side,digit,Number.isFinite(phase)?phase:time);
    current[key]+=(target-current[key])*fade;
    const curl=current[key];
    aggregate+=curl;
    // [0] is metacarpal/splay, [1..3] are independently animated
    // phalanges. The tip endpoint tracks the distal phalanx.
    f.parts[0].quaternion.setFromAxisAngle(f.normal,f.splay*.23*(1-curl));
    const multipliers=digit==='Thumb'?[.50,.40,.32]:[.63,.83,.53];
    for(let j=1;j<=3;j++){
     angle.setFromAxisAngle(f.bend,clamp(curl*multipliers[j-1],0,.87));
     f.parts[j].quaternion.copy(angle);
    }
    f.parts[4].quaternion.identity();
   }
   lastFlex[side]=aggregate/REBORN_DIGITS.length;
  }
  root.updateMatrixWorld(true);
  frames++;
 }
 return {update,getTelemetry:()=>({mode,frames,addedBones,flex:{...lastFlex}}),hands};
}
