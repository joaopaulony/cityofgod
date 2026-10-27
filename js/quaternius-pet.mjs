import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {petBreed} from './pet-catalog.mjs';

// Embedded-buffer glTF files from Quaternius Ultimate Animated Animals (CC0).
// Load at most two rigs concurrently. Gameplay and UI can safely share assets.
const loader=new GLTFLoader(),cache=new Map(),queue=[];
let active=0;
function drain(){
 while(active<2&&queue.length){
  const task=queue.shift();active++;
  loader.load(task.url,gltf=>{
   active--;
   if(!gltf?.scene||!gltf.animations?.length){
    cache.delete(task.name);task.reject(Error('Arquivo incompleto: '+task.name));
   }else{task.entry.gltf=gltf;task.entry.status='ready';task.resolve(task.entry);}
   drain();
  },undefined,e=>{active--;cache.delete(task.name);task.reject(e);drain();});
 }
}
export const hasQuaterniusPet=id=>!!petBreed(id)?.asset;
export const quaterniusReady=id=>{
 const b=petBreed(id);return !!b&&cache.get(b.asset)?.status==='ready';
};
export function loadQuaterniusPet(id){
 const breed=petBreed(id);if(!breed?.asset)return Promise.reject(Error('Modelo não encontrado: '+id));
 const name=breed.asset;
 if(cache.has(name))return cache.get(name).promise;
 const entry={status:'loading',promise:null,gltf:null};
 entry.promise=new Promise((resolve,reject)=>{
  queue.push({name,url:new URL('../assets/pets/quaternius/'+name+'.gltf',import.meta.url).href,
   entry,resolve,reject});
  drain();
 });
 cache.set(name,entry);return entry.promise;
}
export function quaterniusAnimationFor(action,clips=[],speed=0){
 const names=new Set(clips.map(c=>typeof c==='string'?c:c.name));
 const select={
  idle:['Idle'],walk:['Walk'],run:['Gallop','Walk'],
  sniff:['Idle_2_HeadLow','Idle_Headlow','Eating','Idle_2','Idle'],
  eat:['Eating','Idle'],sit:['Idle_2','Idle'],wait:['Idle_2','Idle'],
  sleep:['Idle_2_HeadLow','Idle_Headlow','Idle_2','Idle'],
  jump:['Gallop_Jump','Jump_ToIdle','Jump_toIdle','Gallop'],
  attack:['Attack','Attack_Headbutt','Attack_Kick','Idle']
 };
 const state=action==='idle'&&speed>1.5?'run':action==='idle'&&speed>.06?'walk':action;
 return (select[state]||select.idle).find(n=>names.has(n))||[...names][0]||null;
}
export function createQuaterniusPet(id,color='natural'){
 const breed=petBreed(id),entry=breed&&cache.get(breed.asset);
 if(!entry||entry.status!=='ready')return null;
 const scene=cloneSkinned(entry.gltf.scene);
 scene.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(scene);
 const scale=breed.assetHeight/Math.max(.001,box.max.y-box.min.y);
 const center=box.getCenter(new T.Vector3());
 const root=new T.Group();root.name='Quaternius Pet:'+id;
 const forward=new T.Group();forward.rotation.y=Math.PI/2;root.add(forward);
 const holder=new T.Group();holder.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
 holder.scale.setScalar(scale);forward.add(holder);holder.add(scene);
 const tint=new T.Color(color==='warm'?'#ffdfc0':color==='cool'?'#c8e0f5':'#ffffff');
 const materials=new Set();
 scene.traverse(o=>{
  if(!o.isMesh)return;
  o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;
  const copy=m=>{if(!m)return m;const n=m.clone();
   if(n.color)n.color.multiply(tint);materials.add(n);return n;};
  o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
 });
 const mixer=new T.AnimationMixer(scene),clips=entry.gltf.animations;
 const lookup=new Map(clips.map(c=>[c.name,c]));
 let running=null,runningName=null;
 const petModel={root,breed,colors:{id:color},quaternius:true,
  get currentAnimation(){return runningName;},get clipNames(){return clips.map(c=>c.name);},
  animate(pet,dt=1/60){
   const nextName=quaterniusAnimationFor(pet.action,clips,pet.speed||0);
   if(nextName&&nextName!==runningName){
    const action=mixer.clipAction(lookup.get(nextName));
    if(running)running.fadeOut(.18);
    action.enabled=true;action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(nextName.includes('HeadLow')||nextName.includes('Headlow')?.55:1);
    action.reset().fadeIn(.18).play();running=action;runningName=nextName;
   }
   mixer.update(Math.max(0,Math.min(.09,dt)));
  },
  dispose(){mixer.stopAllAction();mixer.uncacheRoot(scene);materials.forEach(m=>m.dispose());root.removeFromParent();}
 };
 petModel.animate({action:'idle',speed:0},0);
 return petModel;
}
export const quaterniusLoadingStatus=()=>({loaded:[...cache.entries()].filter(([,v])=>v.status==='ready').map(([k])=>k),active,queued:queue.length});
