// City of God — human reset. No skinned character geometry is ever loaded.
// The CAS retains transformable armatures, animations and profiles for future art.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {chooseCharacterClip,planLowVault,stepTraversal,pointSegmentDistance} from './character-actions.mjs';
import {CAS_DEFAULT,normalizeCAS,readCAS} from './cas-profile.mjs';
import {installCASCreator} from './cas-creator.mjs';
import {loadRebornAssets} from './cas-reborn.mjs';
import {createRebornUpperBodyMotion} from './cas-reborn-upperbody.mjs';
import {REBORN_HAND_BONE_COUNT} from './cas-reborn-hands.mjs';
import {createCASEmoteClips,CAS_EMOTES} from './cas-studio.mjs';

export function createCharacterSystem(scene,bridge){
 const entries=new Map();
 const loader=new GLTFLoader();
 let bodies=null;
 const system={
  status:'loading',ready:false,enabled:true,provider:'skeleton-only',humanModelsEnabled:false,
  errors:[],frames:0,models:[],availableBodies:['male','female'],
  rebornReady:false,casWarnings:[],casProfile:CAS_DEFAULT,populationCount:0
 };
 window.cityCharacters=system;
 const clear=(x,y,ignore)=>{
  const r=.28;
  if(x<.5||y<.5||x>bridge.mapSize-.5||y>bridge.mapSize-.5)return false;
  if(bridge.pondVal(x,y)<=1.02&&!bridge.onRoad(x,y))return false;
  for(const s of bridge.world.segs)
   if(s!==ignore&&!(s.door&&s.doorAnim?.open>=.72)&&pointSegmentDistance(x,y,s)<r+.08)return false;
  for(const c of bridge.world.circles)
   if(Math.hypot(x-c.x,y-c.y)<r+(c.r||0))return false;
  const q=bridge.collide(x,y,r,0);
  return (ignore&&pointSegmentDistance(x,y,ignore)<r+.09)||
   Math.hypot(q[0]-x,q[1]-y)<.025;
 };
 system.move=dt=>{
  const a=bridge.player;
  if(bridge.driving()){a.crouching=false;a.jump=null;a.traversal=null;a.actionZ=0;return false;}
  if(a.stairTravel){a.jump=null;a.actionZ=0;return false;}
  if(bridge.hit('c')&&!a.jump&&!a.traversal)a.crouching=!a.crouching;
  if(bridge.hit(' ')&&!a.jump&&!a.traversal&&a.reloadT<0){
   const vault=planLowVault(a,bridge.world.segs,clear);
   if(vault){a.traversal=vault;a.aiming=false;a.wantShot=false;a.aimHold=0;}
   else if(!a.crouching)a.jump={t:0,duration:.9};
  }
  if(stepTraversal(a,dt,clear)){a.speed=0;return true;}
  if(a.jump){
   a.jump.t+=dt;
   const u=Math.min(1,a.jump.t/a.jump.duration);
   a.actionZ=.65*Math.sin(Math.PI*u);
   if(u>=1){a.jump=null;a.actionZ=0;}
  }
  return false;
 };
 system.has=a=>a===bridge.player; // suppress any legacy Canvas fallback.
 function mount(a,sex){
  const item=bodies?.get(sex);
  if(!item)throw Error('Esqueleto '+sex+' indisponível');
  const root=cloneSkeleton(item.gltf.scene);
  let humanMeshes=0;root.traverse(x=>{if(x.isMesh)humanMeshes++});
  if(humanMeshes)throw Error('Modelo humano inesperado no arquivo de ossos');
  const mixer=new THREE.AnimationMixer(root);
  const spec={...item.spec,clips:{...item.spec.clips}};
  const all=[...item.gltf.animations,...createCASEmoteClips(root)];
  const actions=new Map();
  for(const clip of all){
   actions.set(clip.name,mixer.clipAction(clip));
   if(clip.name.startsWith('cas_')){
    const id=clip.name.slice(4),meta=CAS_EMOTES[id];
    if(meta)spec.clips[clip.name]={name:clip.name,duration:clip.duration,loop:meta.loop,speed:0};
   }
  }
  root.visible=false; // Bones animate internally; no human is drawn in world.
  scene.add(root);
  const entry={root,mixer,actions,spec,sex,clip:null,action:null,emote:null,
    lastRecoil:9,upper:createRebornUpperBodyMotion(root)};
  const previous=entries.get(a);
  if(previous){previous.mixer.stopAllAction();scene.remove(previous.root);}
  // The source GLBs are still the original 24-bone rigs; the cloned actor
  // has the same 52 real palm/finger bones as the studio SkeletonHelper.
  spec.bones=(item.spec.bones||24)+REBORN_HAND_BONE_COUNT;
  entries.set(a,entry);return entry;
 }
 system.update=dt=>{
  for(const [a,e] of entries){
   e.upper.restore();
   if(e.emote&&(performance.now()>e.emote.end||a.speed>.12||a.armed||a.jump||a.homeAction||bridge.driving()))e.emote=null;
   const requested=e.emote?'cas_'+e.emote.id:chooseCharacterClip(a);
   const clip=e.spec.clips[requested]?requested:(a.speed>.16?'walk':'idle');
   const info=e.spec.clips[clip],next=e.actions.get(info?.name);
   if(next&&e.clip!==clip){
    next.reset().setEffectiveWeight(1).play();
    next.setLoop(info.loop?THREE.LoopRepeat:THREE.LoopOnce,info.loop?Infinity:1);
    if(e.action&&next!==e.action)next.crossFadeFrom(e.action,.14,false);
    e.clip=clip;e.action=next;
   }
   if(e.action){
    const speed=info?.speed||0;
    if(speed>.1)e.action.setEffectiveTimeScale(THREE.MathUtils.clamp((a.speed||0)/speed,.5,2));
    e.mixer.update(Math.min(.06,Math.max(0,dt)));
    e.root.position.set(a.x,(a.floorZ||0)+(a.actionZ||0),a.y);
    e.root.rotation.y=Math.PI/2-a.face;
    e.root.updateMatrixWorld(true);
    e.upper.update(dt,{clip,time:e.action.time,duration:info?.duration});
   }
   a.characterClip=a.homeAction?'home_'+a.homeAction.kind:clip;
  }
  system.frames++;
 };
 system.muzzle=()=>null;
 system.telemetry=()=>[...entries].map(([a,e])=>({
  name:a.name||'Jogador',clip:e.clip,x:a.x,y:a.y,
  visible:false,meshes:0,bones:e.spec.bones
 }));
 system.appearances=()=>null;
 system.getAppearance=a=>a===bridge.player?{...system.casProfile}:null;
 system.applyCAS=async values=>{
  const next=normalizeCAS({...system.casProfile,...values});
  if(bodies&&entries.get(bridge.player)?.sex!==next.sex)mount(bridge.player,next.sex);
  system.casProfile=next;
  bridge.player.name=next.name;
  system.update(0);return next;
 };
 system.setBody=async(a,sex)=>a===bridge.player?system.applyCAS({sex}):null;
 system.setAppearance=async(a,changes)=>a===bridge.player?system.applyCAS(changes):null;
 system.playEmote=id=>{
  const entry=entries.get(bridge.player),a=bridge.player;
  if(!entry||!CAS_EMOTES[id]||a.armed||a.speed>.12||bridge.driving()||a.homeAction)return false;
  entry.emote={id,end:performance.now()+CAS_EMOTES[id].duration*1000};
  entry.clip=null;return true;
 };
 async function init(){
  try{
   try{system.casProfile=readCAS(localStorage)||CAS_DEFAULT;}catch{}
   bodies=await loadRebornAssets(loader);
   system.rebornReady=true;
   mount(bridge.player,system.casProfile.sex);
   system.ready=true;system.status='ready';
   system.models=[{id:'armature-male',bones:24+REBORN_HAND_BONE_COUNT,meshes:0},{id:'armature-female',bones:24+REBORN_HAND_BONE_COUNT,meshes:0}];
   system.rebornNotice='Esqueletos animados com palmas e dez dedos articulados. Nenhuma malha humana antiga.';
   await system.applyCAS(system.casProfile);
  }catch(error){
   system.status='partial';system.errors.push('Arquivos de animação: '+String(error.message||error));
   system.casWarnings.push('Esqueleto em reconstrução: '+String(error.message||error));
  }
  // The character editor must remain available even if an animation library is missing.
  try{installCASCreator(system,bridge,bodies,{styles:[],warnings:[],set:async()=>{},release:()=>{}});}
  catch(error){system.errors.push('CAS: '+String(error.message||error));}
 }
 void init();
 return system;
}
