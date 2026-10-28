import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {petBreed} from './pet-catalog.mjs';

// The CC0 Quaternius pack ships skeletal glTF 2.0 files with embedded buffers.
// Cache a shared source per species; clone the skeleton for each actor. No
// animation or rendering state is shared across different adopted animals.
const promises=new Map();
const EXTERNAL_MODELS=Object.freeze(['Benny']);
export const QUATERNIUS_MODELS=Object.freeze([
 'Alpaca','Bull','Cow','Deer','Donkey','Fox','Horse','Horse_White','Husky','ShibaInu','Stag','Wolf'
]);
export const isAnimatedBreed=id=>!!petBreed(id)?.model;

export function clipForAction(action,clips){
 const names=clips.map(c=>typeof c==='string'?c:c.name);
 const choose=(...options)=>{
  for(const token of options){const match=names.find(n=>n.toLowerCase()===token.toLowerCase()||n.toLowerCase().endsWith('|'+token.toLowerCase()));if(match)return match;}
  return names.find(n=>/idle$/i.test(n))||names[0]||null;
 };
 switch(action){
  case 'walk':return choose('Walk','run','Gallop','Idle');
  case 'run':return choose('Gallop','run','Walk','Idle');
  case 'sniff':return choose('Eating','Idle_Headlow','Idle_2_HeadLow','idle');
  case 'sleep':return choose('Idle_2_HeadLow','Idle_Headlow','Idle_2','idle');
  case 'sit':case 'wait':return choose('Idle_2','idle');
  default:return choose('Idle','Idle_2');
 }
}

export function loadAnimalAsset(model){
 if(!QUATERNIUS_MODELS.includes(model)&&!EXTERNAL_MODELS.includes(model))return Promise.reject(new Error('Unknown animal: '+model));
 if(!promises.has(model)){
  const imported=EXTERNAL_MODELS.includes(model);
  const url=new URL(imported?'../assets/pets/thirdparty/'+model+'.fbx':
    '../assets/pets/quaternius/'+model+'.gltf',import.meta.url).href;
  const loader=imported?new FBXLoader():new GLTFLoader();
  const loading=loader.loadAsync(url).then(result=>{
   const gltf=imported?{scene:result,animations:result.animations||[]}:result;
   if(!gltf.scene||!gltf.animations?.length){
    // getObjectByProperty isSkinnedMesh does not work on bare THREE.Object3D
    let rigged=false;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)rigged=true;});
    if(!rigged)throw Error('Missing animated skeleton: '+model);
   }
   return gltf;
  }).catch(err=>{promises.delete(model);throw err;});
  promises.set(model,loading);
 }
 return promises.get(model);
}
function tintClonedMaterials(object,colorId,model){
 if(colorId==='original'&&model!=='Benny')return [];
 const multiplier=colorId==='warm'?new T.Color('#f4dbc8'):
  colorId==='cool'?new T.Color('#d1dce8'):new T.Color('#ffffff');
 const originalBenny=Object.freeze({
  coat:'#242528',muzzle:'#af6b41',accents:'#ab7045',ears:'#282629'
 });
 const cloned=[],slots=[];
 object.traverse(child=>{
  if(!child.isMesh)return;
  const shade=m=>{
   if(!m?.color)return m;
   const copy=m.clone(),name=(m.name||'').toLowerCase();
   slots.push({mesh:child.name,material:m.name,color:'#'+m.color.getHexString()});
   if(model==='Benny'){
    // Unity-source FBX uses untextured material slots. Recreate the
    // characteristic black-and-tan coat rather than default white patches.
    let color=originalBenny.coat;
    if(/schnauze|mouth|muzzle/i.test(name))color=originalBenny.muzzle;
    if(/hair2|brow|patch/i.test(name))color=originalBenny.accents;
    if(/ear/i.test(name))color=originalBenny.ears;
    copy.color.set(color);
    copy.color.multiply(multiplier);
    copy.roughness=.92;
    copy.metalness=0;
   }else{
    if(copy.color.r+copy.color.g+copy.color.b>.21)
     copy.color.lerp(copy.color.clone().multiply(multiplier),.35);
   }
   cloned.push(copy);return copy;
  };
  child.material=Array.isArray(child.material)?child.material.map(shade):shade(child.material);
 });
 object.userData.materialSlots=slots;
 return cloned;
}

export function createAnimatedPet(id,colorId='original'){
 const breed=petBreed(id);if(!breed?.model)throw Error('Not a Quaternius breed: '+id);
 const root=new T.Group();root.name='Pet:'+id;
 // Show no imitation model while loading; never reintroduce the six
 // procedural animals the user explicitly removed from the game.
 root.userData.assetStatus='loading';
 let mixer=null,clipName='',clips=[],actionRef=null,animal=null,disposed=false,materials=[],error=null;
 const ready=loadAnimalAsset(breed.model).then(gltf=>{
  if(disposed)return false;
  const instance=cloneSkeleton(gltf.scene);
  const bounds=new T.Box3().setFromObject(instance),size=bounds.getSize(new T.Vector3());
  // FBX from Blender/Unity may use centimetres (100x glTF units).
  // Protect against invalid/hostile bounds without rejecting legitimate FBX.
  if(!Number.isFinite(size.y)||size.y<.01||size.y>100000||
    !size.toArray().every(Number.isFinite))throw Error('Invalid model dimensions: '+breed.model+': '+size.toArray());
  const scale=breed.targetHeight/size.y;
  // City of God pet forward is +X; the authored models face +Z.
  instance.rotation.y=Math.PI/2;
  instance.scale.setScalar(scale);
  instance.updateMatrixWorld(true);
  // Recalculate bounds AFTER rotation: offsets calculated in source axes
  // caused high-scale FBX animals to appear far away or under the ground.
  const oriented=new T.Box3().setFromObject(instance);
  instance.position.set(-(oriented.min.x+oriented.max.x)*.5,
    -oriented.min.y,-(oriented.min.z+oriented.max.z)*.5);
  instance.traverse(o=>{if(o.isMesh||o.isSkinnedMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  materials=tintClonedMaterials(instance,colorId,breed.model);

  animal=instance;root.add(animal);clips=gltf.animations;
  mixer=new T.AnimationMixer(instance);
  actionRef=mixer.clipAction(clips.find(c=>c.name==='Idle')||clips[0]);
  clipName=actionRef.getClip().name;actionRef.play();
  root.userData.assetStatus='ready';
  root.userData.clipNames=clips.map(c=>c.name);
  root.userData.scale=scale;
  root.userData.rawSize=size.toArray();
  root.userData.materialSlots=animal.userData.materialSlots||[];
  return true;
 }).catch(e=>{
  error=e;root.userData.assetStatus='fallback';root.userData.assetError=String(e);
  return false;
 });
 function animate(pet,dt=1/60){
  if(!mixer)return;
  const desired=clipForAction(pet.action,clips);
  if(desired!==clipName){
   const next=mixer.clipAction(clips.find(c=>c.name===desired));
   next.reset().setLoop(T.LoopRepeat,Infinity).play();
   if(actionRef&&actionRef!==next)actionRef.crossFadeTo(next,.22,false);
   actionRef=next;clipName=desired;
  }
  if(actionRef){
   actionRef.timeScale=pet.action==='walk'?Math.max(.65,Math.min(1.6,(pet.speed||.6)/.9)):
     pet.action==='run'?Math.max(.7,Math.min(1.7,(pet.speed||2)/2)):1;
  }
  mixer.update(Math.max(0,Math.min(.10,dt)));
  root.userData.currentClip=clipName;
 }
 function dispose(){
  disposed=true;mixer?.stopAllAction();if(animal)root.remove(animal);
  for(const m of materials)m.dispose();

  root.removeFromParent();
 }
 return {root,breed,colors:breed.colors.find(c=>c.id===colorId)||breed.colors[0],ready,animate,dispose,
  get loaded(){return !!mixer;},get clip(){return clipName;},get error(){return error;}};
}
