import * as THREE from 'three';
import {CC3_BONE_LINKS,inspectCC3Bones} from './cc3-mapping.mjs';

/**
 * CC3 (Reallusion) skeleton adapter.
 *
 * The world model is static bind pose. All locomotion comes from the game's
 * high-level IK (skeleton.js) including stride phase, aiming, crouch, jump,
 * vault and reload. We solve world-space bone orientation against its native
 * FBX rest pose, then express the result in parent space.
 *
 * No baked Mixamo bone tracks are applied to the CC3 skeleton, which avoids
 * Humanoid/Mixamo bone roll differences and deformation explosions.
 */
export function createCC3Rig(root,{smoothing=16}={}){
 const map=new Map();
 root.updateMatrixWorld(true);
 root.traverse(o=>{if(o.isBone)map.set(o.name,o);});
 const inspection=inspectCC3Bones(map.keys());
 if(!inspection.ok)throw new Error('CC3 incompatible skeleton: '+inspection.missing.join(', '));
 const rootBind=new THREE.Quaternion();
 root.getWorldQuaternion(rootBind);
 const rotateRoot=new THREE.Quaternion(),rootNow=new THREE.Quaternion();
 const tmpP=new THREE.Vector3(),tmpC=new THREE.Vector3(),desired=new THREE.Vector3();
 const restDir=new THREE.Vector3(),boneWorld=new THREE.Quaternion(),parentWorld=new THREE.Quaternion();
 const correction=new THREE.Quaternion(),q=new THREE.Quaternion(),restQuat=new THREE.Quaternion();
 const entries=[];
 const suffix={
   CC_Base_L_Hand:'CC_Base_L_Index1',CC_Base_R_Hand:'CC_Base_R_Index1',
   CC_Base_L_Foot:'CC_Base_L_ToeBase',CC_Base_R_Foot:'CC_Base_R_ToeBase',
   CC_Base_Head:'CC_Base_FacialBone',CC_Base_Spine02:'CC_Base_NeckTwist01'
 };
 for(const [name,from,to] of CC3_BONE_LINKS){
   const bone=map.get(name);if(!bone)continue;
   const next=suffix[name]?map.get(suffix[name]):bone.children.find(o=>o.isBone);
   const base=bone.getWorldPosition(new THREE.Vector3());
   const target=next?next.getWorldPosition(new THREE.Vector3()):base.clone().add(new THREE.Vector3(0,.1,0));
   let direction=target.sub(base);
   if(direction.lengthSq()<1e-8)direction.set(0,1,0);
   direction.normalize();
   entries.push({bone,from,to,direction,bindWorld:bone.getWorldQuaternion(new THREE.Quaternion()),
      // damping is done per joint, not by re-blending animation tracks each frame
      lastLocal:bone.quaternion.clone()});
 }
 const hip=map.get('CC_Base_Hip');
 const hipRest=hip.position.clone();
 const point=new THREE.Vector3(),other=new THREE.Vector3();
 const points=Object.create(null),z=(v)=>new THREE.Vector3(v[0],v[2],v[1]);
 function update(a,dt=1/60){
   if(!a.J)return;
   const J=a.J;
   for(const [name,coords] of Object.entries(J))
     if(Array.isArray(coords)&&coords.length===3)points[name]=z(coords);
   const blend=(key,a,b,t)=>{if(points[a]&&points[b])points[key]=points[a].clone().lerp(points[b],t);};
   blend('spine','pelvis','chest',.27);
   blend('headPivot','neck','head',.22);
   if(points.headPivot)points.headTop=points.headPivot.clone().add(new THREE.Vector3(0,.22,0));
   for(const side of ['L','R']){
     blend('clav'+side,'neck','sh'+side,.15);
     if(points['hand'+side]&&points['elb'+side]){
       points['finger'+side]=points['hand'+side].clone().add(
         points['hand'+side].clone().sub(points['elb'+side]).normalize().multiplyScalar(.11));
     }
   }
   root.getWorldQuaternion(rootNow);
   rotateRoot.copy(rootNow).multiply(rootBind.clone().invert());
   const smoothingFactor=1-Math.exp(-Math.min(Math.max(dt,0),.08)*smoothing);
   // CC3 imported in scaled meters; use vertical displacement in meter-equivalent
   // *local* bone units, never apply scale to vertices separately.
   if(hip&&points.pelvis){
     const leanHeight=Math.max(-.45,Math.min(.14,points.pelvis.y-(a.floorZ||0)-(a.actionZ||0)-.93));
     const vertical=hipRest.y+leanHeight/Math.max(.01,root.scale.y);
     hip.position.y+= (vertical-hip.position.y)*smoothingFactor;
   }
   for(const e of entries){
     const from=points[e.from],to=points[e.to];
     if(!from||!to)continue;
     desired.copy(to).sub(from);
     if(desired.lengthSq()<1e-8)continue;
     desired.normalize();
     restDir.copy(e.direction).applyQuaternion(rotateRoot);
     correction.setFromUnitVectors(restDir,desired);
     restQuat.copy(rotateRoot).multiply(e.bindWorld);
     boneWorld.copy(correction).multiply(restQuat);
     e.bone.parent.getWorldQuaternion(parentWorld);
     q.copy(parentWorld).invert().multiply(boneWorld);
     if(!Number.isFinite(q.x+q.y+q.z+q.w))continue;
     // Smooth acceleration and transitions from walk to run, crouch and aim.
     e.bone.quaternion.slerp(q,smoothingFactor);
     e.bone.updateMatrixWorld(true);
   }
 }
 return {update,bones:entries.length,inspection};
}
