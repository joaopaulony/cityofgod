import * as THREE from 'three';

export const REBORN_DIR='assets/characters/rigs/reborn/';
export const REBORN_FILES=Object.freeze({male:'male.rig.glb',female:'female.rig.glb',walk:'walk.rig.glb',run:'run.rig.glb',jump:'jump.rig.glb'});
const humanoidBones=['Hips','Spine','Head','LeftArm','RightArm','LeftLeg','RightLeg'];
const semantics=Object.freeze({
 idle:{loop:true,speed:0},walk:{loop:true,speed:1.6},
 run:{loop:true,speed:4.2},jump_start:{loop:false,speed:0},
 jump_air:{loop:true,speed:0},jump_land:{loop:false,speed:0}
});

/**
 * The per-action Meshy exports each have their own bind pose. Reusing the
 * exported animation track *without* correcting relative local rest poses
 * hyper-extends necks, shoulders and hips. Remap each track into the
 * selected body rig's local bind-space. Never use Mixamo tracks on this rig.
 */
export function normalizeRebornClip(clip,sourceRoot,targetRoot,name,{inPlace=true}={}){
 if(!(clip instanceof THREE.AnimationClip))throw Error('Reborn: movimento sem AnimationClip');
 const result=clip.clone();result.name=name;
 const correction=new THREE.Quaternion(),a=new THREE.Quaternion(),b=new THREE.Quaternion();
 for(const track of result.tracks){
  const match=track.name.match(/^([^.]+)\.(quaternion|position|scale)$/);
  if(!match)continue;
  const [_,boneName,property]=match,from=sourceRoot.getObjectByName(boneName),to=targetRoot.getObjectByName(boneName);
  if(!from||!to)continue;
  if(property==='quaternion'){
   correction.copy(to.quaternion).multiply(b.copy(from.quaternion).invert());
   for(let i=0;i<track.values.length;i+=4){
    a.fromArray(track.values,i).premultiply(correction).normalize().toArray(track.values,i);
   }
  }else if(property==='position'){
   for(let i=0;i<track.values.length;i+=3){
    const x=track.values[i],y=track.values[i+1],z=track.values[i+2];
    track.values[i]=inPlace&&boneName==='Hips'?to.position.x:to.position.x+x-from.position.x;
    track.values[i+1]=to.position.y+y-from.position.y;
    track.values[i+2]=inPlace&&boneName==='Hips'?to.position.z:to.position.z+z-from.position.z;
   }
  }else if(property==='scale'){
   for(let i=0;i<track.values.length;i+=3){
    track.values[i]*=to.scale.x/(from.scale.x||1);
    track.values[i+1]*=to.scale.y/(from.scale.y||1);
    track.values[i+2]*=to.scale.z/(from.scale.z||1);
   }
  }
 }
 result.resetDuration();return result;
}
export function validateRebornGLTF(gltf,which){
 if(!gltf?.scene||!gltf.animations?.length)throw Error('Reborn '+which+': sem modelo e animação');
 const joints=[];gltf.scene.traverse(x=>{if(x.isBone)joints.push(x.name)});
 for(const name of humanoidBones)if(!joints.includes(name))throw Error('Reborn '+which+': faltando osso '+name);
 // This CAS reset intentionally has NO human meshes: only bones and clips.
 if(joints.length<20)throw Error('Reborn '+which+': esqueleto incompleto');
 let meshCount=0;gltf.scene.traverse(o=>{if(o.isMesh)meshCount++});
 if(meshCount)throw Error('Reborn '+which+': modelo humano não foi removido');
 return joints;
}
const clipMeta=(name,clip)=>{
 const options=semantics[name]||semantics.idle;
 return {name:clip.name,duration:clip.duration,loop:options.loop,speed:options.speed};
};
export async function loadRebornAssets(loader,{base=REBORN_DIR}={}){
 const bodies=new Map();
 const gltfEntries=await Promise.all(Object.entries(REBORN_FILES).map(async([id,file])=>{
  const gltf=await loader.loadAsync(base+file);
  validateRebornGLTF(gltf,id);
  return [id,gltf];
 }));
 const data=new Map(gltfEntries);
 for(const sex of ['male','female']){
  const gltf=data.get(sex);
  // Do not mutate GLTFLoader's shared bone tracks; clone before bind offsets.
  const animations=[];
  const idle=gltf.animations[0].clone();idle.name='idle';animations.push(idle);
  for(const id of ['walk','run','jump']){
   const source=data.get(id);
   const clip=normalizeRebornClip(source.animations[0],source.scene,gltf.scene,id==='jump'?'jump_air':id,{inPlace:true});
   animations.push(clip);
  }
  // Explicit tracks with distinct names for jump phases so state transitions
  // cannot attempt to cross-fade an animation into itself.
  for(const id of ['jump_start','jump_land']){
   const clone=animations.find(x=>x.name==='jump_air').clone();clone.name=id;animations.push(clone);
  }
  const clips=Object.fromEntries(animations.map(clip=>[clip.name,clipMeta(clip.name,clip)]));
  const spec={id:'reborn-'+sex,sex,rig:'meshy-24',clips,source:'Skeleton and animation archive (no human mesh)',triangles:null,bones:24};
  bodies.set(sex,{gltf:{...gltf,animations},spec});
 }
 return bodies;
}
