// City of God — personagens 3D do autor (assets/npcs) com as animações Mixamo (andar, correr, rifle, agachar,
// pular, escalar). O jogador escolhe o visual no CAS (bases principais e todos os looks dos NPCs); na rua aparecem
// só alguns moradores e integrantes de gangue (estilo The Sims: poucos por vez), cada um com nome e sobrenome.
// Polícia, bombeiros, socorristas, operários e motoboy não passeiam: só surgem em ocorrências (system.occurrence).
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {chooseCharacterClip,planLowVault,stepTraversal,pointSegmentDistance} from './character-actions.mjs';
import {CAS_DEFAULT,normalizeCAS,readCAS} from './cas-profile.mjs';
import {installCASCreator} from './cas-creator.mjs';
import {createCASEmoteClips,CAS_EMOTES} from './cas-studio.mjs';
import {loadRoster,DEFAULT_LOOK,STREET_ROLES,groupLabel} from './npc-roster.mjs';

const STREET_MAX=4;                 // moradores/gangue andando ao mesmo tempo perto do jogador
const SPAWN_MIN=26,SPAWN_MAX=58,DESPAWN=95;
const OCCURRENCE={police:{group:'policia',count:2,label:'Polícia a caminho'},fire:{group:'bombeiros',count:3,label:'Bombeiros a caminho'},
 medical:{group:'socorristas',count:2,label:'Socorristas a caminho'},works:{group:'operarios',count:2,label:'Obra na via'},delivery:{group:'motoboy',count:1,label:'Entrega'}};

export function createCharacterSystem(scene,bridge){
 const entries=new Map(),loader=new GLTFLoader(),tmp=new THREE.Vector3(),npcs=[],occurrences=[];
 let roster=null,spawnT=0,shots=[];
 const system={
  status:'loading',ready:false,enabled:true,provider:'cas',errors:[],frames:0,models:[],
  casWarnings:[],casProfile:CAS_DEFAULT,populationCount:0,streetCrownEnabled:false,streetModelId:null,looks:{}
 };
 window.cityCharacters=system;
 const clear=(x,y,ignore,r=.28)=>{
  if(x<.5||y<.5||x>bridge.mapSize-.5||y>bridge.mapSize-.5)return false;
  if(bridge.pondVal(x,y)<=1.02&&!bridge.onRoad(x,y))return false;
  for(const s of bridge.world.segs)
   if(s!==ignore&&!(s.door&&s.doorAnim?.open>=.72)&&pointSegmentDistance(x,y,s)<r+.08)return false;
  for(const c of bridge.world.circles)
   if(Math.hypot(x-c.x,y-c.y)<r+(c.r||0))return false;
  const q=bridge.collide(x,y,r,0);
  return (ignore&&pointSegmentDistance(x,y,ignore)<r+.09)||Math.hypot(q[0]-x,q[1]-y)<.025;
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
 system.has=a=>entries.has(a);

 // ---------- rifle (o mesmo do tempo dos personagens Mixamo): segue a mão direita, apoio na esquerda ----------
 function makeRifle(){
  const group=new THREE.Group(),metal=new THREE.MeshStandardMaterial({color:0x303238,metalness:.65,roughness:.55}),polymer=new THREE.MeshStandardMaterial({color:0x202327,roughness:.9});
  const part=(w,h,d,x,y,z,mat=polymer)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh;};
  part(.055,.12,.19,0,-.02,.06);part(.065,.09,.30,0,.015,.31,metal);part(.055,.08,.23,0,0,.57);
  part(.025,.025,.25,0,.01,.805,metal);part(.03,.035,.045,0,.01,.92,metal);part(.04,.10,.04,0,-.065,.24);
  const mag=part(.045,.16,.07,0,-.10,.38,metal);mag.rotation.x=-.2;group.userData.mag=mag;
  part(.02,.035,.04,0,.075,.30,metal);return group;
 }
 // plaquinha com nome e sobrenome sobre a cabeça (aparece de perto)
 function nameTag(text,sub){
  const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');
  g.font='700 46px system-ui,Segoe UI,sans-serif';const w=Math.min(500,g.measureText(text).width+48);
  g.fillStyle='rgba(12,14,18,.72)';g.beginPath();g.roundRect((512-w)/2,8,w,74,22);g.fill();
  g.fillStyle='#f6f1e6';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,46);
  if(sub){g.font='600 26px system-ui,Segoe UI,sans-serif';g.fillStyle='rgba(246,241,230,.85)';g.fillText(sub,256,104);}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true}));s.scale.set(1.5,.375,1);s.renderOrder=10;s.visible=false;return s;
 }

 async function mount(a,id,{tag=false}={}){
  const item=await roster.load(id);
  const root=cloneSkeleton(item.gltf.scene),mixer=new THREE.AnimationMixer(root);
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  const spec={...item.spec,clips:{...item.spec.clips}},actions=new Map();
  for(const clip of [...item.gltf.animations,...createCASEmoteClips(root)]){
   actions.set(clip.name,mixer.clipAction(clip));
   if(clip.name.startsWith('cas_')){const meta=CAS_EMOTES[clip.name.slice(4)];if(meta)spec.clips[clip.name]={name:clip.name,duration:clip.duration,loop:meta.loop,speed:0};}
  }
  const gun=makeRifle(),muzzle=new THREE.Object3D();muzzle.position.set(0,.01,.94);gun.add(muzzle);gun.visible=false;
  scene.add(root);scene.add(gun);
  const entry={root,mixer,actions,spec,id,clip:null,action:null,emote:null,gun,muzzle,grip:new THREE.Vector3(),support:new THREE.Vector3(),
   right:root.getObjectByName('mixamorigRightHand'),left:root.getObjectByName('mixamorigLeftHand'),tag:tag?nameTag(spec.name,groupLabel(spec.group)):null};
  if(entry.tag){entry.tag.position.set(0,spec.height+.35,0);root.add(entry.tag);}
  const previous=entries.get(a);if(previous)dispose(previous);
  entries.set(a,entry);a.name=a===bridge.player?a.name:spec.name;
  return entry;
 }
 function dispose(e){
  e.mixer.stopAllAction();scene.remove(e.root);scene.remove(e.gun);
  if(e.tag){e.tag.material.map.dispose();e.tag.material.dispose();}
 }

 // ---------- população: poucos moradores na rua ----------
 const districtAt=(x,y)=>bridge.world.districtFn?bridge.world.districtFn(x,y):-1;
 const GANG_TURF=new Set([4,5]);   // favela e conjuntos (COG.D.FAVELA / GHETTO)
 function sidewalkSpot(){
  const roads=bridge.roads||[],p=bridge.player;if(!roads.length)return null;
  for(let k=0;k<30;k++){
   const rd=roads[(Math.random()*roads.length)|0];if(!rd.pts||rd.pts.length<4||rd.cls==='highway')continue;
   const q=rd.pts[(Math.random()*rd.pts.length)|0],s=Math.random()<.5?1:-1,off=(bridge.ROAD_W||3.5)+(rd.off||0)+1;
   const x=q.x+q.nx*s*off,y=q.y+q.ny*s*off,d=Math.hypot(x-p.x,y-p.y);
   if(d<SPAWN_MIN||d>SPAWN_MAX||!clear(x,y,null,.35))continue;
   return {x,y,face:Math.atan2(q.ty,q.tx)+(Math.random()<.5?0:Math.PI)};
  }
  return null;
 }
 async function spawnStreet(){
  const spot=sidewalkSpot();if(!spot)return;
  const turf=GANG_TURF.has(districtAt(spot.x,spot.y));
  const busy=new Set(npcs.map(n=>n.lookId));
  const pool=roster.list().filter(c=>STREET_ROLES.includes(c.role)&&(c.role!=='gang'||turf)&&!busy.has(c.id));
  if(!pool.length)return;
  const c=pool[(Math.random()*pool.length)|0];
  const n={x:spot.x,y:spot.y,face:spot.face,speed:0,lookId:c.id,kind:'street',walk:.9+Math.random()*.6,pause:0,armed:false,reloadT:-1,recoilT:9,aiming:false,aimHold:0,moveA:spot.face};
  npcs.push(n);
  try{await mount(n,c.id,{tag:true});}catch(error){npcs.splice(npcs.indexOf(n),1);system.errors.push(String(error.message||error));}
 }
 function remove(n){const e=entries.get(n);if(e)dispose(e);entries.delete(n);const i=npcs.indexOf(n);if(i>=0)npcs.splice(i,1);}
 // anda pela calçada; parado de vez em quando; desvia virando quando algo bloqueia
 function walkNPC(n,dt){
  if(n.target){
   const dx=n.target.x-n.x,dy=n.target.y-n.y,d=Math.hypot(dx,dy);
   if(d<1.2){n.speed=0;n.face=n.lookAt!=null?n.lookAt:n.face;if(n.leaving){remove(n);}return;}
   n.face=Math.atan2(dy,dx);
  } else {
   if(n.pause>0){n.pause-=dt;n.speed=0;return;}
   if(Math.random()<dt*.04){n.pause=2+Math.random()*4;return;}
  }
  const v=n.run?3.6:n.walk,nx=n.x+Math.cos(n.face)*v*dt,ny=n.y+Math.sin(n.face)*v*dt;
  if(clear(nx,ny,null,.3)){n.x=nx;n.y=ny;n.speed=v;n.moveA=n.face;n.running=!!n.run;}
  else{n.face+=Math.PI*(.5+Math.random());n.speed=0;}
 }

 // ---------- ocorrências: serviços aparecem, vão até o local, ficam e vão embora ----------
 system.occurrence=async(kind,x,y,{duration=45}={})=>{
  const spec=OCCURRENCE[kind];if(!spec||!roster)return false;
  if(occurrences.some(o=>o.kind===kind&&Math.hypot(o.x-x,o.y-y)<40))return false;
  const occ={kind,x,y,until:performance.now()+duration*1000,units:[]};occurrences.push(occ);
  const pool=roster.list().filter(c=>c.group===spec.group);
  for(let k=0;k<spec.count&&pool.length;k++){
   const c=pool[k%pool.length],a=Math.random()*Math.PI*2;let sx=x+Math.cos(a)*32,sy=y+Math.sin(a)*32;
   for(let t=0;t<12&&!clear(sx,sy,null,.35);t++){const b=Math.random()*Math.PI*2;sx=x+Math.cos(b)*(24+t*2);sy=y+Math.sin(b)*(24+t*2);}
   const n={x:sx,y:sy,face:Math.atan2(y-sy,x-sx),speed:0,lookId:c.id,kind:'service',walk:1.4,run:kind!=='works'&&kind!=='delivery',target:{x:x+Math.cos(a)*(2+k*1.4),y:y+Math.sin(a)*(2+k*1.4)},lookAt:Math.atan2(-Math.sin(a),-Math.cos(a)),
    armed:kind==='police',reloadT:-1,recoilT:9,aiming:false,aimHold:0,moveA:0};
   npcs.push(n);occ.units.push(n);
   try{await mount(n,c.id,{tag:true});}catch(error){remove(n);}
  }
  system.lastOccurrence={kind,label:spec.label,x,y};
  return true;
 };
 // tiros perto do jogador chamam a polícia (3 disparos em 10 s)
 system.report=(event,x,y)=>{
  if(event!=='shot')return;
  const now=performance.now();shots=shots.filter(t=>now-t<10000);shots.push(now);
  if(shots.length>=3&&!occurrences.some(o=>o.kind==='police')){shots=[];setTimeout(()=>system.occurrence('police',x,y),6000);}
 };

 system.update=dt=>{
  const p=bridge.player,now=performance.now();
  if(roster&&system.ready){
   // gatos pingados: completa até STREET_MAX, tira quem ficou longe
   spawnT-=dt;
   const street=npcs.filter(n=>n.kind==='street');
   for(const n of street)if(Math.hypot(n.x-p.x,n.y-p.y)>DESPAWN)remove(n);
   if(spawnT<=0&&street.length<STREET_MAX){spawnT=3+Math.random()*5;void spawnStreet();}
   for(const o of [...occurrences])if(now>o.until){
    occurrences.splice(occurrences.indexOf(o),1);
    for(const n of o.units){n.leaving=true;n.run=false;const a=Math.random()*Math.PI*2;n.target={x:o.x+Math.cos(a)*70,y:o.y+Math.sin(a)*70};}
   }
   for(const n of [...npcs]){if(entries.has(n))walkNPC(n,dt);if(n.leaving&&Math.hypot(n.x-p.x,n.y-p.y)>DESPAWN)remove(n);}
   system.populationCount=npcs.length;
  }
  for(const [a,e] of entries){
   if(e.emote&&(performance.now()>e.emote.end||a.speed>.12||a.armed||a.jump||a.homeAction||bridge.driving()))e.emote=null;
   const requested=e.emote?'cas_'+e.emote.id:chooseCharacterClip(a);
   const clip=e.spec.clips[requested]?requested:(a.speed>.16?'walk':'idle');
   const info=e.spec.clips[clip],next=e.actions.get(info?.name);
   if(next&&e.clip!==clip){
    next.reset().setEffectiveWeight(1).play();
    next.setLoop(info.loop?THREE.LoopRepeat:THREE.LoopOnce,info.loop?Infinity:1);next.clampWhenFinished=!info.loop;
    if(e.action&&next!==e.action)next.crossFadeFrom(e.action,clip.endsWith('fire')?.04:.14,false);
    e.clip=clip;e.action=next;
   }
   if(clip.endsWith('fire')&&a.recoilT<(e.lastRecoil??9))e.action.reset().play();
   e.lastRecoil=a.recoilT;
   // dirigindo: o corpo some (como antes), nada de cabeça atravessando o teto do carro
   e.root.visible=!(a===p&&bridge.driving())&&Math.hypot(a.x-bridge.cam.x,a.y-bridge.cam.y)<70;
   if(e.root.visible&&e.action){
    const speed=info?.speed||0;
    if(speed>.1)e.action.setEffectiveTimeScale(THREE.MathUtils.clamp((a.speed||0)/speed,.5,2));
    e.mixer.update(Math.min(.06,Math.max(0,dt)));
    e.root.position.set(a.x,(a.floorZ||0)+(a.actionZ||0),a.y);
    e.root.rotation.y=Math.PI/2-a.face;
    if(a===p){const pr=system.casProfile;e.root.scale.set(pr.build,pr.height,pr.build);}
    e.root.updateMatrixWorld(true);
    if(e.tag)e.tag.visible=Math.hypot(a.x-p.x,a.y-p.y)<9;
   }
   e.gun.visible=e.root.visible&&!!a.armed&&!a.traversal;
   if(e.gun.visible&&e.right&&e.left){
    e.right.getWorldPosition(e.grip);e.left.getWorldPosition(e.support);
    const direction=a.reloadT>=0?e.support.clone().sub(e.grip).normalize():new THREE.Vector3(Math.cos(a.face),0,Math.sin(a.face));
    e.gun.position.copy(e.grip).addScaledVector(direction,-.24);
    e.gun.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
    e.gun.userData.mag.visible=a.magState!=='out';e.gun.updateMatrixWorld(true);
   }
   a.characterClip=a.homeAction?'home_'+a.homeAction.kind:clip;
  }
  system.frames++;
 };
 system.muzzle=a=>{const e=entries.get(a);if(!e||!e.gun.visible)return null;e.muzzle.getWorldPosition(tmp);return [tmp.x,tmp.z,tmp.y];};
 system.telemetry=()=>[...entries].map(([a,e])=>({name:a===bridge.player?(system.casProfile.name+' ('+e.spec.name+')'):e.spec.name,look:e.id,role:e.spec.role,clip:e.clip,x:a.x,y:a.y,visible:e.root.visible,triangles:e.spec.triangles,bones:e.spec.bones}));
 system.appearances=()=>null;
 system.getAppearance=a=>a===bridge.player?{...system.casProfile}:null;
 const lookFor=(id,sex)=>roster?.characters.get(id)?.sex===sex?id:DEFAULT_LOOK[sex];
 system.applyCAS=async values=>{
  const next=normalizeCAS({...system.casProfile,...values});
  next.look=lookFor(next.look,next.sex);
  if(roster&&entries.get(bridge.player)?.id!==next.look)await mount(bridge.player,next.look);
  system.casProfile=next;system.streetModelId=next.look;
  bridge.player.name=next.name;
  system.update(0);return next;
 };
 system.setBody=async(a,sex)=>a===bridge.player?system.applyCAS({sex}):null;
 system.setStreetModel=id=>{const c=roster?.characters.get(id);if(!c||c.sex!==system.casProfile.sex)return false;void system.applyCAS({look:id});return true;};
 system.loadLook=id=>roster.load(id);
 system.setAppearance=async(a,changes)=>a===bridge.player?system.applyCAS(changes):null;
 system.playEmote=id=>{
  const entry=entries.get(bridge.player),a=bridge.player;
  if(!entry||!CAS_EMOTES[id]||a.armed||a.speed>.12||bridge.driving()||a.homeAction)return false;
  entry.emote={id,end:performance.now()+CAS_EMOTES[id].duration*1000};
  entry.clip=null;return true;
 };
 async function init(){
  try{
   try{system.casProfile=normalizeCAS(readCAS(localStorage)||CAS_DEFAULT);}catch{}
   roster=await loadRoster(loader);
   system.roster=roster;system.streetCrownEnabled=true;   // o CAS usa o seletor de visual
   system.looks=Object.fromEntries([...roster.characters.values()].map(c=>[c.id,{id:c.id,label:c.name+' · '+groupLabel(c.group),sex:c.sex,role:c.role}]));
   system.models=[...roster.characters.values()].map(c=>({id:c.id,name:c.name,role:c.role,triangles:c.triangles,bytes:c.bytes}));
   await system.applyCAS(system.casProfile);
   system.ready=true;system.status='ready';
  }catch(error){
   system.status='failed';system.errors.push('Personagens: '+String(error.message||error));console.error('Personagens 3D',error);
  }
  try{installCASCreator(system,bridge,null,{styles:[],warnings:[],set:async()=>{},release:()=>{}});}
  catch(error){system.errors.push('CAS: '+String(error.message||error));}
 }
 void init();
 return system;
}
