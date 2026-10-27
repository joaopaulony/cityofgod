import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {petBreed} from './pet-catalog.mjs';
import {buildPet} from './pet-model.mjs';

// The CC0 Quaternius pack ships skeletal glTF 2.0 files with embedded buffers.
// Cache a shared source per species; clone the skeleton for each actor. No
// animation or rendering state is shared across different adopted animals.
const promises=new Map();
const MODEL_ROOT='assets/pets/quaternius/';
export const QUATERNIUS_MODELS=Object.freeze([
 'Alpaca','Bull','Cow','Deer','Donkey','Fox','Horse','Horse_White','Husky','ShibaInu','Stag','Wolf'
]);
export const isAnimatedBreed=id=>!!petBreed(id)?.model;

export function clipForAction(action,clips){
 const names=new Set(clips.map(c=>typeof c==='string'?c:c.name));
 const one=(...options)=>options.find(n=>names.has(n))||'Idle';
 switch(action){
  case 'walk': return one('Walk','Idle');
  case 'run': return one('Gallop','Walk','Idle');
  case 'sniff':return one('Eating','Idle_Headlow','Idle_2_HeadLow','Idle');
  case 'sleep':return one('Idle_2_HeadLow','Idle_Headlow','Idle_2','Idle');
  case 'sit':case 'wait':return one('Idle_2','Idle');
  default:return one('Idle','Idle_2');
 }
}
export function loadAnimalAsset(model){
 if(!QUATERNIUS_MODELS.includes(model))return Promise.reject(new Error('Unknown animal: '+model));
 if(!promises.has(model)){
  const url=new URL('../assets/pets/quaternius/'+model+'.gltf',import.meta.url).href;
  const loader=new GLTFLoader();
  const loading=loader.loadAsync(url).then(gltf=>{
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
function tintClonedMaterials(object,colorId){
 if(colorId==='original')return [];
 const multiplier=colorId==='warm'?new T.Color('#f4dbc8'):new T.Color('#d1dce8');
 const cloned=[];
 object.traverse(child=>{
  if(!child.isMesh)return;
  const one=m=>{
   if(!m||!m.color)return m;
   const copy=m.clone();
   // Preserve facial details and contrast. Tint is intentionally subtle.
   const lightness=copy.color.r+copy.color.g+copy.color.b;
   if(lightness>.21){copy.color.lerp(copy.color.clone().multiply(multiplier),.35);}
   cloned.push(copy);return copy;
  };
  child.material=Array.isArray(child.material)?child.material.map(one):one(child.material);
 });
 return cloned;
}
export function createAnimatedPet(id,colorId='original'){
 const breed=petBreed(id);if(!breed?.model)throw Error('Not a Quaternius breed: '+id);
 const root=new T.Group();root.name='Pet:'+id;
 // While the GLTF arrives, show a lightweight existing quadruped instead of
 // an invisible purchased animal. Existing procedural pets never change.
 const fallbackId=breed.species==='dog'?'pomeranian':breed.species==='wild'?'slimcat':'rottweiler';
 const fallbackColor=fallbackId==='pomeranian'?'orange':fallbackId==='slimcat'?'grey':'tan';
 const fallback=buildPet(fallbackId,fallbackColor);
 fallback.root.scale.setScalar(breed.targetHeight/.65);
 root.add(fallback.root);
 let mixer=null,clipName='',clips=[],actionRef=null,animal=null,disposed=false,materials=[],error=null;
 const ready=loadAnimalAsset(breed.model).then(gltf=>{
  if(disposed)return false;
  const instance=cloneSkeleton(gltf.scene);
  const bounds=new T.Box3().setFromObject(instance),size=bounds.getSize(new T.Vector3());
  if(!Number.isFinite(size.y)||size.y<=.1||size.y>100)throw Error('Invalid GLTF dimensions: '+breed.model);
  const scale=breed.targetHeight/size.y;
  // GLTF models face +Z; City of God pets face +X before root.rotation.y=-pet.face.
  instance.rotation.y=Math.PI/2;
  instance.scale.setScalar(scale);
  instance.position.set(-(bounds.min.x+bounds.max.x)*.5*scale,-bounds.min.y*scale,
    -(bounds.min.z+bounds.max.z)*.5*scale);
  instance.traverse(o=>{if(o.isMesh||o.isSkinnedMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  materials=tintClonedMaterials(instance,colorId);
  root.remove(fallback.root);fallback.dispose();
  animal=instance;root.add(animal);clips=gltf.animations;
  mixer=new T.AnimationMixer(instance);
  actionRef=mixer.clipAction(clips.find(c=>c.name==='Idle')||clips[0]);
  clipName=actionRef.getClip().name;actionRef.play();
  root.userData.assetStatus='ready';
  root.userData.clipNames=clips.map(c=>c.name);
  root.userData.scale=scale;
  return true;
 }).catch(e=>{
  error=e;root.userData.assetStatus='fallback';root.userData.assetError=String(e);
  return false;
 });
 root.userData.assetStatus='loading';
 function animate(pet,dt=1/60){
  if(!mixer){fallback.animate(pet,dt);return;}
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
  if(!animal)fallback.dispose();
  root.removeFromParent();
 }
 return {root,breed,colors:breed.colors.find(c=>c.id===colorId)||breed.colors[0],ready,animate,dispose,
  get loaded(){return !!mixer;},get clip(){return clipName;},get error(){return error;}};
}
