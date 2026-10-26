// City Home skeletal overlay for Mixamo-like rigs.
// Uses the procedural joint target hierarchy only during home interactions.
// The existing AnimationMixer and locomotion clips remain authoritative otherwise.
import * as THREE from 'three';

const LINKS=[
 ['Hips','pelvis','chest'],['Spine','pelvis','chest'],['Spine1','chest','neck'],
 ['Spine2','chest','neck'],['Neck','neck','head'],['Head','neck','head'],
 ['LeftShoulder','chest','shL'],['LeftArm','shL','elbL'],['LeftForeArm','elbL','handL'],
 ['RightShoulder','chest','shR'],['RightArm','shR','elbR'],['RightForeArm','elbR','handR'],
 ['LeftUpLeg','hipL','kneeL'],['LeftLeg','kneeL','ankL'],['LeftFoot','ankL','toeL'],
 ['RightUpLeg','hipR','kneeR'],['RightLeg','kneeR','ankR'],['RightFoot','ankR','toeR']
];
const required=['Hips','LeftArm','RightArm','LeftUpLeg','RightUpLeg'];
export function createHomeBoneRig(root){
 const byName=new Map();
 root.updateMatrixWorld(true);
 root.traverse(o=>{if(o.isBone){
  const n=o.name.replace(/^mixamorig(?::)?/,'');
  byName.set(n,o);
 }});
 const missing=required.filter(n=>!byName.has(n));
 if(missing.length)return {ready:false,missing,apply:()=>false};
 const entries=[];
 for(const [boneName,from,to] of LINKS){
  const bone=byName.get(boneName);if(!bone)continue;
  const p=bone.getWorldPosition(new THREE.Vector3());
  const child=bone.children.find(c=>c.isBone);
  const v=child?child.getWorldPosition(new THREE.Vector3()):p.clone().add(new THREE.Vector3(0,.1,0));
  const dir=v.sub(p);
  if(dir.lengthSq()<1e-8)continue;
  entries.push({bone,child:child||null,from,to,bindDirection:dir.normalize()});
 }
 const hip=byName.get('Hips');
 const point=new THREE.Vector3(),parentWorld=new THREE.Quaternion(),rootWorld=new THREE.Quaternion();
 const direction=new THREE.Vector3(),actual=new THREE.Vector3(),delta=new THREE.Quaternion();
 const boneWorld=new THREE.Quaternion(),local=new THREE.Quaternion(),target=new THREE.Vector3(),
  childPosition=new THREE.Vector3(),bonePosition=new THREE.Vector3();
 const originalHip=hip.position.clone();
 let active=false;
 function apply(a){
  const J=a?.J,home=a?.homeAction;
  if(!home||!J?.pelvis){active=false;return false;}
  // Origin coordinates are shared with the canvas skeleton: X,Z,Y in Three.
  // The scripted action starts and ends standing, keeping post-action reset smooth.
  const norm=Math.min(1,Math.max(0,(home.t||0)/Math.max(.1,home.duration)));
  const ease=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
  const weight=Math.min(ease(norm/.15),ease((1-norm)/.12));
  if(weight<=0){active=false;return false;}
  active=true;root.updateMatrixWorld(true);
  // The Mixamo idle action is evaluated first each frame. Overlay the pelvis
  // translation from the physical socket in the model's own local space.
  const desired=point.set(J.pelvis[0],(a.floorZ||0)+(a.actionZ||0)+J.pelvis[2],J.pelvis[1]);
  target.copy(desired);
  // Convert world-space socket into the Hips' immediate parent only once.
  hip.parent.worldToLocal(target);
  hip.position.lerp(target,weight);
  root.getWorldQuaternion(rootWorld);
  for(const e of entries){
   const from=J[e.from],to=J[e.to];if(!from||!to)continue;
   direction.set(to[0]-from[0],to[2]-from[2],to[1]-from[1]);
   if(direction.lengthSq()<1e-8)continue;
   direction.normalize();
   // Measure the live MIXAMO bone segment *after* its parent was modified.
   // A saved world bind rotation cannot be applied independently on every
   // spine joint: it cancels the parent's tilt and leaves the actor upright.
   if(e.child){
    e.bone.getWorldPosition(bonePosition);
    e.child.getWorldPosition(childPosition);
    actual.subVectors(childPosition,bonePosition);
   }else actual.copy(e.bindDirection).applyQuaternion(rootWorld);
   if(actual.lengthSq()<1e-8)continue;
   actual.normalize();
   delta.setFromUnitVectors(actual,direction);
   e.bone.getWorldQuaternion(boneWorld);
   boneWorld.premultiply(delta);
   e.bone.parent.getWorldQuaternion(parentWorld);
   local.copy(parentWorld).invert().multiply(boneWorld);
   if(Number.isFinite(local.x+local.y+local.z+local.w))e.bone.quaternion.slerp(local,weight);
   e.bone.updateMatrixWorld(true);
  }
  return true;
 }
 return {ready:true,missing:[],bones:entries.length,apply,get active(){return active;}};
}
