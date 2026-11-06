// City of God — personagens 3D modulares (Quaternius, CC0: cabeça/tronco/pernas/pés trocáveis e cores) com ~120
// animações (Universal Animation Library 1 e 2, pack modular e rifle Mixamo). O jogador monta o visual no CAS; na rua aparecem
// só alguns moradores e integrantes de gangue (estilo The Sims: poucos por vez), cada um com nome e sobrenome.
// Polícia, bombeiros, socorristas, operários e motoboy não passeiam: só surgem em ocorrências (system.occurrence).
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {chooseCharacterClip,planLowVault,stepTraversal,pointSegmentDistance} from './character-actions.mjs';
import {CAS_DEFAULT,normalizeCAS,readCAS} from './cas-profile.mjs';
import {installCASCreator} from './cas-creator.mjs';
import {CAS_EMOTES,emoteClipSpecs,emoteDuration} from './cas-studio.mjs';
import {normalizeLook,lookKey} from './modular-characters.mjs';
import {installEmoteMenu} from './emote-menu.mjs';
import {loadRoster,DEFAULT_LOOK,STREET_ROLES,groupLabel} from './npc-roster.mjs';
import {createSocialSim,SOCIAL_ACTIONS} from './social-sim.mjs';
import {installSocialUI} from './social-ui.mjs';
import {installSocialPie} from './social-pie.mjs';
import {pickSocialActor} from './social-picking.mjs';
import {createSocialActivities} from './social-activities.mjs';
import {createSocialAutonomy,installSocialIncoming} from './social-autonomy.mjs';
import {makeCombatClips,splitClip} from './procedural-anim.mjs';
import {createBlood} from './blood-fx.mjs';
import {createNPCAI} from './npc-ai.mjs';
import {createStreetLife,regionOf,pickStreetLook} from './npc-street-life.mjs';

const STREET_MAX=8;                 // moradores/gangue andando ao mesmo tempo perto do jogador (12 nas quebradas)
const SPAWN_MIN=26,SPAWN_MAX=58,DESPAWN=95;
const OCCURRENCE={police:{group:'policia',count:2,label:'Polícia a caminho'},investigation:{group:'policia',count:2,label:'Investigação em andamento'},fire:{group:'bombeiros',count:3,label:'Bombeiros a caminho'},
 medical:{group:'socorristas',count:2,label:'Socorristas a caminho'},works:{group:'operarios',count:2,label:'Obra na via'},delivery:{group:'motoboy',count:1,label:'Entrega'}};

// ---------- ações sob demanda ----------
// ~120 clipes por sexo (+ metades @upper/@lower p/ atirar andando): cada personagem só cria as ações que toca de fato.
// Apelidos: o socorrista ajoelhado e quem carrega caixa usam clipes reais da biblioteca no lugar dos procedurais.
const CLIP_ALIAS=Object.freeze({kneel_aid:'fixing_kneeling','carry@upper':'walk_carry@upper'});
// ações domésticas (city-home*.js → player.homeAction.kind) → clipe da biblioteca
const HOME_CLIP=Object.freeze({cook:'interact',stove:'interact',wash:'interact',use:'interact',fridge:'chest_open',eat:'consume',drink:'consume',dinner:'sitting_talking',watch:'sitting_idle',toilet:'sitting_idle',chair:'sitting_idle'});
const COMBAT=new WeakMap(),HALVES=new WeakMap();
function halves(clip){if(!HALVES.has(clip))HALVES.set(clip,splitClip(clip));return HALVES.get(clip);}
function lazyActions(mixer,clips,extra){
 const byName=new Map(clips.map(c=>[c.name,c]));for(const c of extra)if(!byName.has(c.name))byName.set(c.name,c);
 const made=new Map();
 const resolve=n=>{
  n=CLIP_ALIAS[n]||n;if(byName.has(n))return byName.get(n);
  const m=n.match(/^(.+)@(upper|lower)$/),base=m&&byName.get(m[1]);
  return base?halves(base)[m[2]==='upper'?0:1]:null;
 };
 return {has:n=>!!resolve(n),get(n){if(!made.has(n)){const c=resolve(n);if(!c)return undefined;made.set(n,mixer.clipAction(c));}return made.get(n);}};
}

export function createCharacterSystem(scene,bridge,{camera=null,canvas=null}={}){
 const entries=new Map(),loader=new GLTFLoader(),tmp=new THREE.Vector3(),npcs=[],occurrences=[];
 let roster=null,spawnT=0,shots=[];
 const system={
  status:'loading',ready:false,enabled:true,provider:'cas',errors:[],frames:0,models:[],
  casWarnings:[],casProfile:CAS_DEFAULT,populationCount:0,streetCrownEnabled:false,streetModelId:null,looks:{}
 };
 window.cityCharacters=system;
 let social=null,socialClock=0;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const clearConversation=n=>{
  const p=bridge.player,dx=n.x-p.x,dy=n.y-p.y;
  for(const s of bridge.world.segs){
   if(s.door&&s.doorAnim?.open>=.72)continue;
   const sx=s.x2-s.x1,sy=s.y2-s.y1,den=dx*sy-dy*sx;if(Math.abs(den)<1e-8)continue;
   const qx=s.x1-p.x,qy=s.y1-p.y,t=(qx*sy-qy*sx)/den,u=(qx*dy-qy*dx)/den;
   if(t>0&&t<1&&u>=0&&u<=1)return false;
  }return true;
 };
 const nearby=()=>npcs.filter(n=>entries.has(n)&&!n.leaving&&!n.dead&&distance(n,bridge.player)<4&&(n.floorZ||0)===(bridge.player.floorZ||0)&&clearConversation(n)).sort((a,b)=>distance(a,bridge.player)-distance(b,bridge.player));
 const sociallyBlocked=()=>bridge.driving()||bridge.player.armed||bridge.player.speed>.2;
 const activities=createSocialActivities({sim:()=>social,actors:()=>npcs,player:()=>bridge.player,homes:()=>bridge.houses||[],home:()=>window.CityHome,visitors:()=>window.CityHomeVisitors,kitchen:()=>window.CityHomeKitchen,notify:text=>window.CityUI?.notify?.(text)});
 const socialAPI={sim:()=>social,nearby,blocked:sociallyBlocked,context:id=>({...activities.context(id),cityLife:window.CityLife}),release:()=>{bridge.releaseControls?.();bridge.player.wantShot=false;bridge.player.aiming=false;},act:(id,action)=>{
  const n=nearby().find(n=>n.lookId===id);
  if(!n||sociallyBlocked())return {ok:false,text:'Aproxime-se a pé, pare e guarde a arma para conversar.'};
  const result=social.interact('player',id,action,socialAPI.context(id));
  if(result.investigation)dispatchInvestigation(result.investigation);
  if(result.event&&result.accepted){const activity=activities.start(result.event,n);if(!activity.ok){social.finishEvent(result.event.id,'interrupted');result.text+=' '+activity.text;}else result.text+=' '+activity.text;}
  if(result.ok){n.socialUntil=social.time+7;n.speed=0;n.face=Math.atan2(bridge.player.y-n.y,bridge.player.x-n.x);bridge.player.face=n.face+Math.PI; say(bridge.player,result.line,'💬');say(n,result.text,result.reaction);
   const emote=result.reaction==='😄'?'cheer':action==='greet'?'wave':null;if(emote)for(const a of [bridge.player,n]){const e=entries.get(a);if(e&&!a.armed)e.emote={id:emote,end:performance.now()+2500};}
  }
  return result;
 }};
 function dispatchInvestigation(record){system.lastInvestigation=record;void system.occurrence('investigation',bridge.player.x,bridge.player.y,{duration:75});window.CityUI?.notify?.('Denúncia registrada. A polícia iniciou diligências; nenhuma conclusão foi tomada.');}
 system.fileCrimeReport=()=>{
  const officer=[...(social?.people?.values()||[])].find(person=>person.group==='policia');
  if(!officer)return {ok:false,text:'O canal da polícia não está disponível.'};
  const result=social.interact('player',officer.id,'reportCrime',{channel:'phone'});
  if(result.investigation)dispatchInvestigation(result.investigation);
  return result;
 };
 system.socialActivities=activities;
 const socialUI=installSocialUI(socialAPI);
 const screenPoint=new THREE.Vector3(),raycaster=new THREE.Raycaster();
 const socialPie=installSocialPie({...socialAPI,
  available:id=>npcs.some(n=>n.lookId===id&&!n.leaving&&entries.has(n)&&entries.get(n).root.visible),
  anchor:id=>{const n=npcs.find(n=>n.lookId===id),e=n&&entries.get(n);if(!camera||!e)return null;screenPoint.set(n.x,(n.floorZ||0)+e.spec.height*.7,n.y).project(camera);const rect=canvas.getBoundingClientRect();return {x:rect.left+(screenPoint.x+1)*rect.width/2,y:rect.top+(1-screenPoint.y)*rect.height/2};}
 });
 system.socialPie=socialPie;
 const incoming=installSocialIncoming();
 const initiative=createSocialAutonomy({sim:()=>social,actors:()=>npcs,player:()=>bridge.player,
  blocked:()=>!system.ready||system.socialInputBlocked||sociallyBlocked()||!!bridge.player.homeAction||!!bridge.player.jump||!!bridge.player.traversal||!!bridge.player.stairTravel||window.CityFront?.blocked||window.CityUI?.blocksGameInput?.()||bridge.canPickSocial?.()===false||!!document.querySelector('dialog[open]'),
  eligible:n=>n.kind==='street'&&!n.leaving&&!n.armed&&!activities.has(n)&&entries.get(n)?.root.visible&&(n.floorZ||0)===(bridge.player.floorZ||0)&&clearConversation(n),
  canTalk:n=>nearby().includes(n),speak:(n,line)=>say(n,line,'💬'),offer:data=>incoming.show(data),dismiss:()=>incoming.hide(),
  reply:(n,action)=>socialAPI.act(n.lookId,action),choose:n=>socialPie.open(n.lookId)
 });
 system.socialInitiative=initiative;
 // conversa aberta (e meio segundo depois de fechar): o clique que fecha a roda/diálogo não vira soco
 let socialSeen=-1e9;
 Object.defineProperty(system,'socialInputBlocked',{get:()=>{if(socialUI.active||socialPie.active)socialSeen=performance.now();return performance.now()-socialSeen<450;}});
 // Capture before the 2D view sees mousedown, so choosing a person cannot fire a shot.
 window.addEventListener('mousedown',event=>{
  if(event.button!==0||event.target?.id!=='view'||!social||!camera||bridge.driving()||bridge.player.aiming||bridge.canPickSocial?.()===false||window.CityFront?.blocked||window.CityUI?.blocksGameInput?.()||document.querySelector('dialog[open]'))return;
  const npc=pickSocialActor(raycaster,npcs.filter(n=>!n.dead),entries,camera,canvas.getBoundingClientRect(),event.clientX,event.clientY);
  if(!npc)return;
  // clicar numa pessoa é p/ interagir: sem mirar (botão direito) nunca vira soco/tiro, mesmo se a roda não abrir
  const opened=clearConversation(npc)&&socialPie.open(npc.lookId,{x:event.clientX,y:event.clientY});
  event.preventDefault();event.stopImmediatePropagation();bridge.releaseControls?.();bridge.player.wantShot=false;
  if(!opened)say(npc,'Agora não, tô ocupado.','💬');
 },true);
 // balão de fala do tamanho do texto e com tamanho fixo NA TELA (texto ~22 px em qualquer zoom): o canvas é desenhado
 // em 2× e a escala do sprite é refeita a cada quadro a partir da câmera ortográfica (bubbleScale)
 const BUBBLE_FONT=44,BUBBLE_PAD=24,BUBBLE_MAX=560,BUBBLE_LINE=54,BUBBLE_TAIL=20;
 function say(actor,text,icon='💬'){
  const e=entries.get(actor);if(!e)return;
  if(actor!==bridge.player&&distance(actor,bridge.player)<24)window.CityAudio?.babble(actor.x,actor.y,roster?.characters.get(actor.lookId)?.sex==='female');
  if(e.bubble){e.root.remove(e.bubble);e.bubble.material.map.dispose();e.bubble.material.dispose();}
  const c=document.createElement('canvas'),g=c.getContext('2d'),font='650 '+BUBBLE_FONT+'px system-ui,Segoe UI,sans-serif';g.font=font;
  let line='',lines=[];
  for(const word of (icon+' '+text).split(' ')){if(line&&g.measureText(line+' '+word).width>BUBBLE_MAX){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);
  if(lines.length>3){lines=lines.slice(0,3);lines[2]=lines[2].replace(/s*S*$/,'')+' …';}
  const w=Math.ceil(Math.max(...lines.map(s=>g.measureText(s).width)))+BUBBLE_PAD*2,h=lines.length*BUBBLE_LINE+BUBBLE_PAD*2-10;
  c.width=w;c.height=h+BUBBLE_TAIL;g.font=font;
  g.fillStyle='rgba(16,24,28,.28)';g.beginPath();g.roundRect(3,6,w-6,h-6,26);g.fill();   // sombra
  g.fillStyle='#f6fbf5';g.beginPath();g.roundRect(2,2,w-6,h-6,26);g.fill();
  g.beginPath();g.moveTo(w/2-16,h-6);g.lineTo(w/2,h+BUBBLE_TAIL-2);g.lineTo(w/2+16,h-6);g.fill();
  g.fillStyle='#14282e';g.textAlign='center';g.textBaseline='middle';
  lines.forEach((s,i)=>g.fillText(s,w/2-2,BUBBLE_PAD+BUBBLE_LINE/2-4+i*BUBBLE_LINE));
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  e.bubble=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false}));e.bubble.center.set(.5,0);e.bubble.userData.px=[c.width/2,c.height/2];
  e.bubble.position.set(0,e.spec.height+.25,0);e.bubble.renderOrder=12;e.bubbleUntil=social.time+6;e.root.add(e.bubble);bubbleScale(e);
 }
 // metros por pixel da câmera ortográfica (sem câmera: 1 cm por pixel)
 function bubbleScale(e){
  const b=e.bubble;if(!b)return;
  const px=canvas?.clientHeight||innerHeight,m=camera&&camera.isOrthographicCamera?(camera.top-camera.bottom)/(camera.zoom||1)/px:.01,s=e.root.scale.y||1;
  b.scale.set(b.userData.px[0]*m/s,b.userData.px[1]*m/s,1);
 }
 const clear=(x,y,ignore,r=.28)=>{
  if(x<.5||y<.5||x>bridge.mapSize-.5||y>bridge.mapSize-.5)return false;
  if(bridge.pondVal(x,y)<=1.02&&!bridge.onRoad(x,y))return false;
  // só a célula da grade de colisão (world.js collNear): antes varria as ~11 mil paredes do mundo, 7 vezes por NPC por quadro
  const near=bridge.collNear?bridge.collNear(x,y):{segs:bridge.world.segs,circles:bridge.world.circles,dyn:[]};
  for(const s of near.segs)
   if(s!==ignore&&!(s.door&&s.doorAnim?.open>=.72)&&pointSegmentDistance(x,y,s)<r+.08)return false;
  for(const c of near.circles)
   if(Math.hypot(x-c.x,y-c.y)<r+(c.r||0))return false;
  for(const c of near.dyn)
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

 // ---------- armas do inventário (assets/weapons, js/weapons.js): GLB com origem na empunhadura, cano em +Z ----------
 // Cada personagem tem um grupo "gun"; quando a arma (ou os acessórios) muda, o conteúdo é trocado. Acessórios entram
 // nos nós do modelo (muzzle/rail/under) na escala da arma; com silenciador a boca do cano vai p/ a ponta dele.
 const weaponLoader=new GLTFLoader(),weaponCache=new Map();let weaponMeta=null;
 const loadWeaponModel=id=>{if(!weaponCache.has(id))weaponCache.set(id,weaponLoader.loadAsync('assets/weapons/models/'+id+'.glb').then(g=>{g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.material.transparent=false;o.material.opacity=1;}});return g.scene;}));return weaponCache.get(id);};
 const loadWeaponMeta=()=>weaponMeta||(weaponMeta=fetch('assets/weapons/models.json').then(r=>r.json()).catch(()=>({items:{}})));
 async function dressGun(e,id,mods){
  const key=id+'|'+mods.join(),token=e.gunKey=key;
  const [model,meta]=await Promise.all([loadWeaponModel(id),loadWeaponMeta()]);
  const accs=await Promise.all(mods.map(m=>loadWeaponModel(m).then(s=>[m,s]).catch(()=>null)));
  if(e.gunKey!==token)return;
  for(const c of [...e.gun.children])if(c!==e.muzzle)e.gun.remove(c);
  const body=model.clone(true);e.gun.add(body);
  const node=n=>{const o=body.getObjectByName(n);return o?o.position.clone():null;};
  const muzzle=node('muzzle')||new THREE.Vector3(0,0,.5),scale=meta.items?.[id]?.scale||1;
  e.muzzle.position.copy(muzzle);e.gun.userData.mag=null;
  for(const a of accs){if(!a)continue;const [m,scene]=a,acc=window.CityWeapons?.accessories[m],at=acc&&node(acc.mount);if(!at)continue;
   const o=scene.clone(true);o.position.copy(at);o.scale.setScalar(scale);e.gun.add(o);
   if(acc.mount==='muzzle')e.muzzle.position.set(at.x,at.y,at.z+(meta.items?.[m]?.length||0)*scale);}
 }
 function syncGun(e,a){
  const id=a.weaponId||(a.armed?'rifle_ar_2':null),mods=a.weaponId==='bat_1'?[]:a.weaponMods||[],key=id?id+'|'+mods.join():'';
  if(key===e.gunWant)return;e.gunWant=key;
  if(id)dressGun(e,id,mods).catch(error=>system.errors.push('arma '+id+': '+(error.message||error)));
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

 async function mount(a,what,{tag=false}={}){
  const item=await roster.load(what);
  const root=cloneSkeleton(item.gltf.scene),mixer=new THREE.AnimationMixer(root);
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  const spec={...item.spec,clips:{...item.spec.clips}};
  Object.assign(spec.clips,emoteClipSpecs(spec.clips));
  // ações de casa com clipe próprio (em laço enquanto durar): home_<tipo>
  for(const [kind,clip] of Object.entries(HOME_CLIP))if(spec.clips[clip])spec.clips['home_'+kind]={...spec.clips[clip],loop:true,speed:0};
  // golpes/mortes/pistola em uma mão procedurais (procedural-anim.mjs): um conjunto por sexo (mesmo esqueleto)
  const anims=item.gltf.animations;
  if(!COMBAT.has(anims))COMBAT.set(anims,makeCombatClips(root,spec.height).filter(c=>!CLIP_ALIAS[c.name]));
  const actions=lazyActions(mixer,anims,COMBAT.get(anims));
  const gun=new THREE.Group(),muzzle=new THREE.Object3D();muzzle.position.set(0,.01,.7);gun.add(muzzle);gun.visible=false;
  root.userData.noSnow=gun.userData.noSnow=true;   // neve pousada (ambience-3d.mjs) não cobre gente nem o que ela carrega
  scene.add(root);scene.add(gun);
  const entry={root,mixer,actions,spec,id:item.key,clip:null,action:null,emote:null,gun,muzzle,grip:new THREE.Vector3(),support:new THREE.Vector3(),
   right:root.getObjectByName('mixamorigRightHand'),left:root.getObjectByName('mixamorigLeftHand'),fore:root.getObjectByName('mixamorigRightForeArm'),palm:root.getObjectByName('mixamorigRightHandMiddle1'),tag:tag?nameTag(spec.name,groupLabel(spec.group)):null};
  if(entry.tag){entry.tag.position.set(0,spec.height+.35,0);root.add(entry.tag);}
  const previous=entries.get(a);if(previous)dispose(previous);
  entries.set(a,entry);a.name=a===bridge.player?a.name:spec.name;
  return entry;
 }
 function dispose(e){
  e.mixer.stopAllAction();scene.remove(e.root);scene.remove(e.gun);
  if(e.tag){e.tag.material.map.dispose();e.tag.material.dispose();}
  if(e.bubble){e.bubble.material.map.dispose();e.bubble.material.dispose();}
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
   const dir=Math.random()<.5?1:-1,i=rd.pts.indexOf(q);
   // rota na calçada: a rua, o lado (s) e o sentido (dir) em que a pessoa caminha (walkSidewalk)
   return {x,y,face:Math.atan2(q.ty*dir,q.tx*dir),route:{rd,i,s,dir,off}};
  }
  return null;
 }
 async function spawnStreet(){
  const spot=sidewalkSpot();if(!spot)return;
  // quem aparece depende da região (npc-street-life.mjs): favela com gangue, centro com motoboys, porto com operários
  const busy=new Set(npcs.map(n=>n.lookId)),c=pickStreetLook(roster,regionOf(districtAt,spot.x,spot.y),busy);
  if(!c)return;
  const n={x:spot.x,y:spot.y,face:spot.face,speed:0,lookId:c.id,kind:'street',walk:.9+Math.random()*.6,pause:0,armed:false,reloadT:-1,recoilT:9,aiming:false,aimHold:0,moveA:spot.face,route:spot.route};
  // gangue carrega pistola ou submetralhadora (guardada até sacar); quem não é de gangue não tem arma
  n.weaponId=window.CityWeapons?.npcWeapon(c.role)||null;if(c.role==='gang')n.gang=c.group;
  npcs.push(n);
  try{await mount(n,c.id,{tag:true});}catch(error){npcs.splice(npcs.indexOf(n),1);system.errors.push(String(error.message||error));}
 }
 function remove(n){if(activities.has(n))activities.stop(n,'interrupted');const e=entries.get(n);if(e)dispose(e);entries.delete(n);const i=npcs.indexOf(n);if(i>=0)npcs.splice(i,1);}
 // Phone invitations use the same relationship checks and physical activity controller.
 system.inviteContact=async(id,action)=>{
  if(!social||!SOCIAL_ACTIONS[action]?.event||!roster?.characters.has(id))return {ok:false,text:'Convite indisponível.'};
  if(!social.relation('player',id).phone)return {ok:false,text:'Troquem números de telefone primeiro.'};
  if(bridge.driving())return {ok:false,text:'Estacione e saia do veículo para combinar o passeio.'};
  const c=roster.characters.get(id),context={...activities.context(id),channel:'phone',busy:!['civil','gang','player'].includes(c.role)};
  const result=social.interact('player',id,action,context);if(!result.ok||!result.accepted)return result;
  let n=npcs.find(n=>n.lookId===id&&!n.leaving);
  if(!n){
   let spot=null;for(let k=0;k<30;k++){const candidate=sidewalkSpot();if(candidate&&distance(candidate,bridge.player)<34){spot=candidate;break;}}
   if(!spot){social.finishEvent(result.event.id,'interrupted');return {ok:false,text:'O convite foi aceito, mas a pessoa não encontrou uma chegada segura nesta região. Tente perto das ruas da cidade.'};}
   const streets=npcs.filter(n=>n.kind==='street');
   if(streets.length>=STREET_MAX){const far=streets.filter(n=>!activities.has(n)&&distance(n,bridge.player)>18).sort((a,b)=>distance(b,bridge.player)-distance(a,bridge.player))[0];if(!far){social.finishEvent(result.event.id,'interrupted');return {ok:false,text:'Há muitos encontros acontecendo por perto. Tente o convite em um momento mais tranquilo.'};}remove(far);}
   n={x:spot.x,y:spot.y,face:spot.face,speed:0,lookId:id,kind:'street',walk:1.8,pause:0,armed:false,reloadT:-1,recoilT:9,aiming:false,aimHold:0,moveA:spot.face};npcs.push(n);
   try{await mount(n,id,{tag:true});}catch{remove(n);social.finishEvent(result.event.id,'interrupted');return {ok:false,text:'Não foi possível preparar a chegada do convidado.'};}
  }
  const started=activities.start(result.event,n);if(!started.ok){social.finishEvent(result.event.id,'interrupted');return {ok:false,text:started.text};}
  social.save();return {...result,text:result.text+' '+started.text};
 };
 // anda pela calçada; parado de vez em quando; desvia virando quando algo bloqueia
 function walkNPC(n,dt){
  if(n.stagger>0){n.stagger-=dt;n.speed=0;return;}   // cambaleando depois de apanhar
  if(social&&n.socialUntil>social.time){n.speed=0;n.running=false;return;}
  // Quem precisa de companhia procura alguém próximo; rivais preservam distância.
  if(social&&!n.target&&!n.leaving){
   const other=npcs.filter(b=>b!==n&&b.lookId!==n.lookId&&!b.target&&entries.has(b)&&distance(n,b)<18).sort((a,b)=>distance(n,a)-distance(n,b))[0];
   if(other){const r=social.relation(n.lookId,other.lookId),d=distance(n,other);
    if(r.friend<-25&&d<4){n.face=Math.atan2(n.y-other.y,n.x-other.x);n.pause=0;}
    else if(r.friend>=-25&&social.need(n.lookId)<60&&d>2.4){n.face=Math.atan2(other.y-n.y,other.x-n.x);n.pause=0;}
   }
  }
  if(n.target){
   const dx=n.target.x-n.x,dy=n.target.y-n.y,d=Math.hypot(dx,dy);
   if(d<1.2){n.speed=0;n.face=n.lookAt!=null?n.lookAt:n.face;if(n.leaving){remove(n);}return;}
   n.face=Math.atan2(dy,dx);
  } else if(n.route){walkSidewalk(n,dt);return;}
  else {
   if(n.pause>0){n.pause-=dt;n.speed=0;return;}
   if(Math.random()<dt*.04){n.pause=2+Math.random()*4;return;}
  }
  stepToward(n,n.face,n.run?3.6:n.walk,dt);
 }
 // passo com desvio: tenta a direção pedida e, se bloqueada, ângulos crescentes p/ cada lado (sem girar ao acaso
 // de cara na parede); devolve se andou
 function stepToward(n,face,v,dt,{keepOffRoad=false}={}){
  for(const da of [0,.35,-.35,.7,-.7,1.1,-1.1]){
   const a=face+da,nx=n.x+Math.cos(a)*v*dt,ny=n.y+Math.sin(a)*v*dt;
   if(!clear(nx,ny,null,.3))continue;
   if(keepOffRoad&&bridge.roadDist&&bridge.roadDist(nx,ny)<(bridge.ROAD_W||3.5)+.15)continue;   // não pisa no asfalto fora da faixa
   if(crowded(n,nx,ny))continue;
   n.x=nx;n.y=ny;n.speed=v;n.face=a;n.moveA=a;n.running=!!n.run;return true;
  }
  n.speed=0;return false;
 }
 // outra pessoa (ou o jogador) logo à frente: abre espaço
 function crowded(n,x,y){
  const p=bridge.player;if(Math.hypot(p.x-x,p.y-y)<.7&&Math.hypot(p.x-x,p.y-y)<Math.hypot(p.x-n.x,p.y-n.y))return true;
  for(const o of npcs)if(o!==n&&!o.dead&&Math.hypot(o.x-x,o.y-y)<.65&&Math.hypot(o.x-x,o.y-y)<Math.hypot(o.x-n.x,o.y-n.y))return true;
  return false;
 }
 // ---------- calçada: segue a rua pelo meio da calçada; no fim da quadra volta ou atravessa na esquina ----------
 const sideOf=(r,i)=>{const q=r.rd.pts[i];return {x:q.x+q.nx*r.s*r.off,y:q.y+q.ny*r.s*r.off,q};};
 function walkSidewalk(n,dt){
  const r=n.route,pts=r.rd.pts;
  if(n.pause>0){n.pause-=dt;n.speed=0;return;}
  // atravessando: vai reto até a calçada do outro lado; com semáforo, só no boneco verde; sem, só sem carro perto
  if(r.cross){
   if(!r.cross.go){
    const sig=(bridge.world.trafficSignals||[]).find(s=>Math.hypot(s.x-n.x,s.y-n.y)<14),car=window.cityVehicles?.driver?window.cityVehicles.car:null;
    const walk=sig&&typeof bridge.trafficPhase==='function'?bridge.trafficPhase(bridge.gameTime).pedestrian==='walk':true;
    const carNear=car&&Math.hypot(car.x-n.x,car.y-n.y)<18&&Math.abs(car.speed||0)>.5;
    n.speed=0;n.face=Math.atan2(r.cross.y-n.y,r.cross.x-n.x);
    if(walk&&!carNear)r.cross.go=true;else return;
   }
   const dx=r.cross.x-n.x,dy=r.cross.y-n.y,d=Math.hypot(dx,dy);
   if(d<.4){r.s=-r.s;r.dir=-r.dir;r.cross=null;return;}
   stepToward(n,Math.atan2(dy,dx),Math.max(n.walk,1.3),dt);return;
  }
  // próximo ponto da calçada uns 2 m adiante no sentido da caminhada
  let j=r.i;while(j+r.dir>=0&&j+r.dir<pts.length&&Math.hypot(pts[j].x-pts[r.i].x,pts[j].y-pts[r.i].y)<2)j+=r.dir;
  const atEnd=j+r.dir<0||j+r.dir>=pts.length,t=sideOf(r,j),dx=t.x-n.x,dy=t.y-n.y,d=Math.hypot(dx,dy);
  if(d<.6){
   r.i=j;
   if(atEnd){
    // esquina: metade das vezes atravessa (na faixa, que fica na esquina), senão dá meia-volta; às vezes para um pouco
    if(Math.random()<.5){const q=pts[j],o=r.off;r.cross={x:q.x-q.nx*r.s*o,y:q.y-q.ny*r.s*o,go:false};}
    else{r.dir=-r.dir;if(Math.random()<.4)n.pause=1+Math.random()*3;}
   }else if(Math.random()<.015)n.pause=1.5+Math.random()*3;
   return;
  }
  if(!stepToward(n,Math.atan2(dy,dx),n.walk,dt,{keepOffRoad:true})){
   n.blocked=(n.blocked||0)+dt;
   if(n.blocked>1.2){n.blocked=0;r.dir=-r.dir;n.pause=.5+Math.random();}   // calçada bloqueada: volta
  }else n.blocked=0;
 }

 // ---------- ocorrências: serviços aparecem, vão até o local, ficam e vão embora ----------
 // victim: socorristas ajoelham junto ao corpo e reanimam; chase: polícia persegue o jogador procurado
 system.occurrence=async(kind,x,y,{duration=45,victim=null,chase=false,count=0}={})=>{
  const spec=OCCURRENCE[kind];if(!spec||!roster)return false;
  if(victim?occurrences.some(o=>o.victim===victim):occurrences.some(o=>o.kind===kind&&!!o.chase===chase&&Math.hypot(o.x-x,o.y-y)<40))return false;
  const occ={kind,x,y,until:performance.now()+duration*1000,units:[],victim,chase};occurrences.push(occ);
  if(victim?.dead)victim.dead.medic=true;
  const pool=roster.list().filter(c=>c.group===spec.group);
  for(let k=0;k<(count||spec.count)&&pool.length;k++){
   const c=pool[k%pool.length],a=Math.random()*Math.PI*2;let sx=x+Math.cos(a)*32,sy=y+Math.sin(a)*32;
   for(let t=0;t<12&&!clear(sx,sy,null,.35);t++){const b=Math.random()*Math.PI*2;sx=x+Math.cos(b)*(24+t*2);sy=y+Math.sin(b)*(24+t*2);}
   const n={x:sx,y:sy,face:Math.atan2(y-sy,x-sx),speed:0,lookId:c.id,kind:'service',walk:1.4,run:kind!=='works'&&kind!=='delivery',target:{x:x+Math.cos(a)*(2+k*1.4),y:y+Math.sin(a)*(2+k*1.4)},lookAt:Math.atan2(-Math.sin(a),-Math.cos(a)),
    armed:kind==='police',reloadT:-1,recoilT:9,aiming:false,aimHold:0,moveA:0};
   // polícia na ocorrência: fuzil estilo AR (nada de AK)
   if(kind==='police'){n.weaponId=window.CityWeapons?.npcWeapon('police',{long:true})||null;n.cop=true;n.mag=30;n.hp=130;if(chase){n.chase=true;n.target=null;}}
   if(victim){n.aid=victim;n.aidSide=k%2?1:-1;n.target=null;}
   npcs.push(n);occ.units.push(n);
   try{await mount(n,c.id,{tag:true});}catch(error){remove(n);}
  }
  system.lastOccurrence={kind,label:spec.label,x,y};
  return true;
 };
 // tiros do jogador espantam quem está perto; 3 disparos em 10 s (ou ferir/matar alguém) = procurado pela polícia
 system.report=(event,x,y)=>{
  if(event!=='shot')return;
  panic(x,y,{x,y},30);ai.shot();
  const now=performance.now();shots=shots.filter(t=>now-t<10000);shots.push(now);
  if(shots.length>=3){shots=[];ai.crime('shots');}
 };
 // linha de visão pelo raycast do mundo (paredes, muros, árvores)
 // margin: o alvo é um carro (o raio bate na lataria antes do centro)
 const sight=(ax,ay,bx,by,margin=0)=>{const d=Math.hypot(bx-ax,by-ay);if(d<.5+margin)return true;if(!bridge.raycast)return d<25;return bridge.raycast(ax,ay,(bx-ax)/d,(by-ay)/d,d).t>=d-.6-margin;};
 // personagem novo na rua (serviços, gangue): entra na lista já e ganha o modelo 3D quando carregar
 async function addNPC(c,props){
  const n={speed:0,lookId:c.id,kind:'service',walk:1.3,armed:false,reloadT:-1,recoilT:9,aiming:false,aimHold:0,moveA:props.face||0,...props};
  npcs.push(n);
  try{await mount(n,c.id,{tag:true});}catch(error){remove(n);return null;}
  return npcs.includes(n)?n:null;
 }
 // IA da rua (npc-ai.mjs): polícia de viatura, ambulâncias, gangues e combate
 const ai=createNPCAI(THREE,scene,{bridge,system,npcs,entries,roster:()=>roster,addNPC,remove,stepToward,walkNPC,clear,say,panic,sight,sidewalkSpot});
 // encontros e conversas entre NPCs na rua
 const streetLife=createStreetLife({npcs,entries,bridge,distance,say,stepToward,activities,social:()=>social});
 system.streetLife=streetLife;
 system.clearWanted=ai.clearWanted;
 system.npcList=()=>npcs;   // depuração no console
 system.say=(n,text,icon)=>say(n,text,icon);
 system.spawnExtra=async(x,y,{face=0,floor=0}={})=>{
  const pool=roster?.list().filter(c=>c.role==='civil')||[];if(!pool.length)return null;
  const c=pool[(Math.random()*pool.length)|0];
  return addNPC(c,{x,y,face,kind:'extra',walk:1.2,floor,floorZ:floor*3.3,socialUntil:1e12,lookAt:face});
 };
 system.releaseExtra=(n,target,run=false)=>{if(!n)return;n.socialUntil=0;n.target=target;n.run=run;n.leaving=!!target?.leave;};
 system.removeExtra=n=>{if(n&&npcs.includes(n))remove(n);};
 system.playerDown=()=>ai.clearWanted(null);

 system.update=dt=>{
  const p=bridge.player,now=performance.now();
  // tempo de cada parte neste quadro (ms): system.updateMs, lido pelo medidor de desempenho
  const um=system.updateMs||(system.updateMs={});let ut=now;const lap=k=>{const t=performance.now();um[k]=t-ut;ut=t;};
  if(social){
   social.tick(dt);socialUI.update(dt);socialPie.update();initiative.update(dt);if(system.socialInputBlocked){bridge.releaseControls?.();p.wantShot=false;p.aiming=false;}
   if(socialPie.active){const n=npcs.find(n=>n.lookId===socialPie.target);if(n){n.socialUntil=social.time+.5;n.speed=0;}}
   socialClock-=dt;
   if(socialClock<=0){socialClock=7+Math.random()*5;
    const a=npcs.find(n=>entries.has(n)&&!n.dead&&!n.target&&!n.socialApproaching&&!activities.has(n)&&!(n.socialUntil>social.time));
    const b=a&&npcs.find(n=>n!==a&&n.lookId!==a.lookId&&entries.has(n)&&!n.dead&&!n.target&&!n.socialApproaching&&!activities.has(n)&&!(n.socialUntil>social.time)&&distance(a,n)<5);
    if(a&&b){const action=social.suggest(a.lookId,b.lookId);
     const result=social.interact(a.lookId,b.lookId,action);if(result.ok){a.socialUntil=b.socialUntil=social.time+6;a.face=Math.atan2(b.y-a.y,b.x-a.x);b.face=a.face+Math.PI;say(a,result.line,result.reaction);say(b,result.text,result.reaction);}}
   }
  }
  if(roster&&system.ready){
   // gatos pingados: completa até STREET_MAX, tira quem ficou longe
   spawnT-=dt;
   const street=npcs.filter(n=>n.kind==='street'&&!n.dead);
   lap('social+spawn');runOver(dt);lap('runOver');
   for(const n of street)if(!activities.has(n)&&Math.hypot(n.x-p.x,n.y-p.y)>DESPAWN)remove(n);
   if(spawnT<=0&&street.length<(GANG_TURF.has(districtAt(p.x,p.y))?12:STREET_MAX)){spawnT=1.2+Math.random()*2.2;void spawnStreet();}
   streetLife.tick(dt);lap('streetLife');
   for(const o of [...occurrences])if(now>o.until){
    occurrences.splice(occurrences.indexOf(o),1);
    for(const n of o.units){if(n.dead)continue;n.leaving=true;n.run=false;n.chase=false;n.aid=null;n.aiding=false;n.aiming=false;n.aimHold=0;const a=Math.random()*Math.PI*2;n.target={x:o.x+Math.cos(a)*70,y:o.y+Math.sin(a)*70};}
   }
   lap('occurrences');ai.tick(dt);lap('ai');
   for(const n of [...npcs]){if(entries.has(n)){
    if(n.dead){deadTick(n,dt);continue;}
    const visit=window.CityHomeVisitors?.has(n)&&window.CityHomeVisitors.tick(dt,n,(x,y,nx,ny)=>bridge.movePet?bridge.movePet(x,y,nx,ny,.28,n.floor||0):bridge.collide(nx,ny,.28,n.floor||0));
    const controlled=activities.tick(n,dt);if(!visit&&!controlled)if(!ai.tickNPC(n,dt)&&!streetLife.control(n,dt))walkNPC(n,dt);
    // ferido sangrando deixa rastro de pingos
    if(n.hp<100&&n.speed>.1){n.dripD=(n.dripD||0)+n.speed*dt;if(n.dripD>(n.hp<50?.35:.8)){n.dripD=0;blood.drip(n.x+(Math.random()-.5)*.2,n.y+(Math.random()-.5)*.2,.04+Math.random()*.05,n.floorZ||0);}}
   }if(n.leaving&&Math.hypot(n.x-p.x,n.y-p.y)>DESPAWN)remove(n);}
   system.populationCount=npcs.length;lap('npcs');
  }
  for(const [a,e] of entries){
   if(e.bubble&&social.time>e.bubbleUntil){e.root.remove(e.bubble);e.bubble.material.map.dispose();e.bubble.material.dispose();e.bubble=null;}
   else if(e.bubble)bubbleScale(e);
   if(e.emote&&(performance.now()>e.emote.end||a.speed>.12||a.armed||a.jump||a.homeAction||bridge.driving()))e.emote=null;
   const want=pickClips(a,e);
   const clip=actionName(e,want.base)?want.base:(a.speed>.16?'walk':'idle');
   const info=e.spec.clips[clip],upName=want.upper?actionName(e,want.upper,'upper'):null;
   const baseName=(upName&&actionName(e,clip,'lower'))||actionName(e,clip),next=e.actions.get(baseName);
   if(next&&e.baseName!==baseName){
    const loop=info?info.loop:clip==='kneel_aid',sameClip=e.clip===clip&&e.action;
    next.reset().setEffectiveWeight(1).play();
    next.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);next.clampWhenFinished=!loop;
    if(sameClip)next.time=e.action.time;   // mesma locomoção, só trocou p/ a metade de baixo (ou voltou): sem tropeço
    if(e.action&&next!==e.action)next.crossFadeFrom(e.action,clip.endsWith('fire')?.04:a.dead?.1:/^death_/.test(e.clip||'')?1.2:.14,false);
    e.clip=clip;e.baseName=baseName;e.action=next;
   }
   // camada de cima (braços/tronco): tiro, recarga, soco, taco e pistola por cima das pernas
   if(upName!==e.upName){
    const up=upName?e.actions.get(upName):null;
    if(e.up&&e.up!==up)e.up.fadeOut(.12);
    if(up){
     const once=/fire|swing|punch|reload/.test(upName);
     up.reset().setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);up.clampWhenFinished=once;
     up.setEffectiveTimeScale(upName.includes('reload')?up.getClip().duration/2.05:1);   // recarga dura o mesmo que a do jogo
     up.setEffectiveWeight(1).fadeIn(upName.includes('fire')?.03:.1).play();
    }
    e.up=up;e.upName=upName;
   }
   if(/fire/.test(upName||clip)&&a.recoilT<(e.lastRecoil??9))(upName?e.up:e.action).reset().play();   // tiro novo: recuo de novo
   e.lastRecoil=a.recoilT;
   // dirigindo: o corpo some (como antes), nada de cabeça atravessando o teto do carro
   e.root.visible=!(a===p&&bridge.driving())&&Math.hypot(a.x-bridge.cam.x,a.y-bridge.cam.y)<70;
   if(e.root.visible&&e.action){
    const speed=info?.speed||0;
    if(speed>.1)e.action.setEffectiveTimeScale(THREE.MathUtils.clamp((a.speed||0)/speed,.5,3.5));
    e.mixer.update(Math.min(.06,Math.max(0,dt)));
    e.root.position.set(a.x,(a.floorZ||0)+(a.actionZ||0),a.y);
    e.root.rotation.y=Math.PI/2-a.face;
    e.root.rotation.x=0;
    if(a.homeAction?.kind==='rest'&&a.homeAction.item){const bed=a.homeAction.item,angle=(bed.rot||0)+(bed.d>bed.w?Math.PI/2:0),half=e.spec.height*.45;e.root.rotation.set(-Math.PI/2,Math.PI/2-angle,0,'YXZ');e.root.position.set(bed.x+Math.cos(angle)*half,(a.floorZ||0)+(bed.h||.7)+.16,bed.y+Math.sin(angle)*half);}
    if(a===p){const pr=system.casProfile;e.root.scale.set(pr.build,pr.height,pr.build);}
    e.root.updateMatrixWorld(true);
    if(e.tag)e.tag.visible=!a.dead&&a.homeAction?.kind!=='rest'&&Math.hypot(a.x-p.x,a.y-p.y)<9;
   }
   if(a.armed)syncGun(e,a);
   e.gun.visible=e.root.visible&&!!a.armed&&!a.traversal&&!a.carry&&e.gun.children.length>1;
   carryProp(a,e);
   if(e.gun.visible&&e.right&&e.left){
    e.right.getWorldPosition(e.grip);e.left.getWorldPosition(e.support);
    const cat=window.CityWeapons?.list[a.weaponId]?.cat;
    if(cat==='melee'){
     // taco: na mão direita; a direção segue o arco do golpe (ou fica apoiado no ombro) no referencial do personagem
     e.gun.position.copy(e.grip);if(e.palm)e.gun.position.lerp(e.palm.getWorldPosition(PALM),.55);   // no meio da palma
     e.gun.quaternion.setFromUnitVectors(Z,batDir(a,tmp));
    }else{
     // uma mão (pistola/revólver): na direção do antebraço; duas mãos: p/ frente (ou p/ a mão de apoio na recarga)
     const one=cat==='pistol'||cat==='revolver';
     if(one&&e.fore)e.fore.getWorldPosition(tmp);
     const direction=one&&e.fore?e.grip.clone().sub(tmp).normalize():a.reloadT>=0?e.support.clone().sub(e.grip).normalize():new THREE.Vector3(Math.cos(a.face),0,Math.sin(a.face));
     // origem do modelo = empunhadura: na palma (um pouco à frente do punho e abaixo)
     e.gun.position.copy(e.grip).addScaledVector(direction,one?.06:.045);e.gun.position.y-=one?.02:.035;
     e.gun.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
    }
    if(e.gun.userData.mag)e.gun.userData.mag.visible=a.magState!=='out';e.gun.updateMatrixWorld(true);
   }
   a.characterClip=a.homeAction?'home_'+a.homeAction.kind:clip;
  }
  lap('animation');blood.update(dt);lap('blood');
  system.frames++;
 };
 // ---------- animação: o que cada personagem toca (base = corpo todo ou pernas; upper = braços por cima) ----------
 const ONE_HAND=new Set(['pistol','revolver']);
 function actionName(e,key,half){
  if(key.includes('@')||!half&&e.actions.has(key))return e.actions.has(key)?key:null;   // procedurais (death_*, punch@upper...) e nomes diretos
  const info=e.spec.clips[key],n=(info?info.name:key)+(half?'@'+half:'');
  return e.actions.has(n)?n:null;
 }
 function pickClips(a,e){
  if(a.dead)return {base:a.dead.kind==='car'?'death_car':'death_shot'};
  if(a.carry&&!a.traversal)return {base:chooseCharacterClip({...a,armed:false,reloadT:-1,recoilT:9}),upper:'carry@upper'};   // pacote/saco/bandeja nos braços
  if(a.aiding)return {base:'kneel_aid'};   // socorrista reanimando
  if(a.homeAction&&a.homeAction.kind==='sit')return {base:'cas_sit'};
  if(a.homeAction&&e.spec.clips['home_'+a.homeAction.kind])return {base:'home_'+a.homeAction.kind};
  if(e.emote)return {base:'cas_'+e.emote.id};
  const cat=a.weaponId?window.CityWeapons?.list[a.weaponId]?.cat:null,busy=a.traversal||a.jump;
  const melee=a.meleeT>=0&&!busy?(a.meleeKind==='bat'?'bat_swing@upper':'punch@upper'):null;
  // mãos livres, taco e pistola: pernas da locomoção desarmada + braços por cima
  if(!a.armed||cat==='melee'||ONE_HAND.has(cat)){
   const legs=chooseCharacterClip({...a,armed:false,reloadT:-1,recoilT:9});
   let upper=melee;
   if(!upper&&a.armed&&!busy){
    if(cat==='melee')upper='bat_idle@upper';
    else upper=a.reloadT>=0?'pistol_reload@upper':a.recoilT<.2?'pistol_fire@upper':a.aiming||a.aimHold>0?'pistol_aim@upper':'pistol_idle@upper';
   }
   return {base:legs,upper};
  }
  // fuzil/SMG: atirando ou recarregando em movimento → pernas andando/correndo/agachadas + braços do tiro/recarga
  if(a.speed>.12&&!busy&&(a.reloadT>=0||a.recoilT<.16))
   return {base:chooseCharacterClip({...a,reloadT:-1,recoilT:9}),upper:a.reloadT>=0?(a.crouching?'rifle_crouch_reload':'rifle_reload'):(a.crouching?'rifle_crouch_fire':'rifle_fire')};
  return {base:chooseCharacterClip(a)};
 }
 // taco: [esquerda, cima, frente] por instante do golpe (bat_swing@upper dura .55 s, acerta em .15)
 const Z=new THREE.Vector3(0,0,1),PALM=new THREE.Vector3(),BAT_REST=[-.25,.8,-.55],BAT_KEYS=[[0,BAT_REST],[.14,[-.15,.05,1]],[.27,[.95,.1,.3]],[.55,BAT_REST]];
 function batDir(a,out){
  let v=BAT_REST;
  if(a.meleeT>=0&&a.meleeKind==='bat'){
   const i=Math.max(0,BAT_KEYS.findIndex(k=>k[0]>a.meleeT)-1),[t0,p]=BAT_KEYS[i],[t1,q]=BAT_KEYS[Math.min(i+1,BAT_KEYS.length-1)],u=t1>t0?Math.min(1,(a.meleeT-t0)/(t1-t0)):0;
   v=p.map((x,j)=>x+(q[j]-x)*u);
  }
  // personagem olhando p/ face: frente (cos,_,sin), esquerda (sin,_,-cos) em three
  const c=Math.cos(a.face),s=Math.sin(a.face);
  return out.set(v[0]*s+v[2]*c,v[1],-v[0]*c+v[2]*s).normalize();
 }

 // ---------- combate: hitbox, sangue, mortes (tiro e atropelamento), soco e taco ----------
 // Hitbox: cilindro de raio HIT_R em volta da pessoa. Vida 100; ferido foge correndo de quem atacou; morto cai (clipe
 // procedural), sangra (poça cresce embaixo do corpo) e some depois de 60 s; socorristas vêm até o corpo.
 const HIT_R=.32,blood=createBlood(THREE,scene);
 system.blood=blood.state;
 system.shoot=(ox,oy,dx,dy,maxT,damage,from)=>{
  let best=null,bt=maxT;
  for(const n of npcs){
   if(n===from||n.dead||!entries.get(n)?.root.visible||ai.friendly(from,n))continue;   // fogo amigo não pega (polícia×colegas/socorristas, mesma facção)
   const fx=n.x-ox,fy=n.y-oy,t=fx*dx+fy*dy;if(t<=0||t>=bt)continue;
   const px=fx-dx*t,py=fy-dy*t;if(px*px+py*py>HIT_R*HIT_R)continue;
   best=n;bt=t;
  }
  if(!best)return null;
  const x=ox+dx*bt,y=oy+dy*bt,z=(best.floorZ||0)+(entries.get(best).spec.height||1.7)*.62;
  hurt(best,damage,{kind:'shot',dx,dy,from,x,y,z});
  return {x,y,z,t:bt,npc:best};
 };
 system.melee=(a,{range=1.1,damage=10,kind='punch'}={})=>{
  const fx=Math.cos(a.face),fy=Math.sin(a.face);let hit=null;
  for(const n of npcs){
   if(n===a||n.dead||!entries.has(n))continue;
   const dx=n.x-a.x,dy=n.y-a.y,d=Math.hypot(dx,dy);
   if(d>range+HIT_R||d<.01||(dx*fx+dy*fy)/d<.5)continue;
   if(!hit||d<hit.d)hit={n,d};
  }
  if(!hit)return null;
  const n=hit.n,h=entries.get(n).spec.height||1.7;
  hurt(n,damage,{kind,dx:fx,dy:fy,from:a,x:n.x-fx*.2,y:n.y-fy*.2,z:(n.floorZ||0)+h*.82});
  if(!n.dead){const nx=n.x+fx*.35,ny=n.y+fy*.35;if(clear(nx,ny,null,.28)){n.x=nx;n.y=ny;}n.stagger=kind==='bat'?.6:.35;}
  return n;
 };
 function hurt(n,damage,hit){
  n.hp=(n.hp??100)-damage;
  const f=n.floorZ||0,dx=hit.dx||0,dy=hit.dy||0,sp=hit.kind==='car'?hit.speed||8:0;
  if(hit.kind==='car'){
   // atropelamento: jato forte p/ frente do carro, pedaços acima de ~32 km/h e respingo grande no asfalto
   blood.spray(hit.x,hit.y,hit.z,dx,dy,46+sp*3|0,f,{power:1+sp/9,chunks:sp>9?5+(sp|0):0,spread:1.9});
   blood.splat(hit.x+dx*.6,hit.y+dy*.6,.7+sp*.04,f);tireBlood=Math.max(tireBlood,4+sp*.2);
  }else if(hit.kind==='punch')blood.spray(hit.x,hit.y,hit.z,dx,dy,6,f,{power:.7});
  else{
   // tiro/taco: entrada (volta p/ quem atacou), saída (jato p/ trás da vítima) e respingo no chão atrás dela
   blood.spray(hit.x,hit.y,hit.z,dx,dy,damage>35?34:24,f,{power:1.35});
   blood.spray(hit.x,hit.y,hit.z,-dx,-dy,7,f,{power:.6});
   blood.splat(hit.x+dx*(1+Math.random()*.8),hit.y+dy*(1+Math.random()*.8),.3+Math.random()*.25,f);
  }
  if(n.hp>0)ai.onHurt(n,hit);
  if(n.hp<=0)return kill(n,hit);
  if(n.kind==='street')flee(n,hit.from);
  if(entries.has(n)&&social)say(n,hit.kind==='punch'?'Ei! Tá maluco?':'Socorro!','😱');
 }
 // jogador ferido (polícia): sangue saindo dele
 system.bleed=(a,from)=>{const d=from?Math.atan2(a.y-from.y,a.x-from.x):0;blood.spray(a.x,a.y,(a.floorZ||0)+1.2,Math.cos(d),Math.sin(d),18,a.floorZ||0,{power:1.2});blood.drip(a.x,a.y,.12,a.floorZ||0);};
 function kill(n,hit){
  if(activities.has(n))activities.stop(n,'interrupted');
  n.hp=0;n.speed=0;n.target=null;n.route=null;n.armed=false;n.aiming=false;n.aimHold=0;n.reloadT=-1;n.stagger=0;
  n.dead={kind:hit.kind==='car'?'car':'shot',t:0,vx:0,vy:0,pool:false,sp:hit.speed||0};
  if(hit.kind==='car'){n.face=Math.atan2(hit.dy,hit.dx);n.dead.vx=hit.dx*hit.speed*.7;n.dead.vy=hit.dy*hit.speed*.7;}
  else if(hit.from)n.face=Math.atan2(hit.from.y-n.y,hit.from.x-n.x);   // cai de costas, longe de quem atacou
  ai.onKill(n,hit);   // procurado, vingança da gangue; a ambulância é chamada pela IA
  const e=entries.get(n);if(e?.bubble){e.root.remove(e.bubble);e.bubble.material.map.dispose();e.bubble.material.dispose();e.bubble=null;}
  panic(n.x,n.y,hit.from||n,25);
  system.lastDeath={kind:n.dead.kind,name:n.name,x:n.x,y:n.y};
  setTimeout(()=>window.CityAudio?.thump(n.x,n.y,'fall'),hit.kind==='car'?700:450);
  if(hit.kind==='car')window.CityAudio?.thump(n.x,n.y,'bat');
 }
 function deadTick(n,dt){
  const d=n.dead;d.t+=dt;n.speed=0;
  const fly=d.kind==='car'?Math.min(.75,.4+d.sp*.03):0;   // quanto mais rápido, mais alto e mais longe
  if(d.vx||d.vy){   // atropelado: é jogado e se arrasta até parar (para em parede), deixando um rastro de sangue
   const nx=n.x+d.vx*dt,ny=n.y+d.vy*dt;if(clear(nx,ny,null,.2)){n.x=nx;n.y=ny;}else{d.vx=d.vy=0;blood.splat(n.x,n.y,.5,n.floorZ||0);}
   const k=Math.exp(-dt*(d.t<fly?1.1:4));d.vx*=k;d.vy*=k;if(Math.hypot(d.vx,d.vy)<.05)d.vx=d.vy=0;
   if(d.t>fly*.8){d.smear=(d.smear||0)+Math.hypot(d.vx,d.vy)*dt;if(d.smear>.22){d.smear=0;blood.drip(n.x,n.y,.12+Math.random()*.12,n.floorZ||0);}}
  }
  n.actionZ=fly&&d.t<fly?Math.sin(d.t/fly*Math.PI)*(.45+d.sp*.06):0;
  if(!d.pool&&d.t>.9){
   // poça embaixo do tronco: de costas o tronco fica atrás dos pés; de bruços, à frente
   d.pool=true;const s=d.kind==='car'?.75:-.85;
   blood.pool(n.x+Math.cos(n.face)*s,n.y+Math.sin(n.face)*s,1+Math.random()*.35,14,n.floorZ||0);
   blood.pool(n.x+Math.cos(n.face)*s*1.6,n.y+Math.sin(n.face)*s*1.6,.45+Math.random()*.2,8,n.floorZ||0);   // cabeça
  }
  // socorristas ajoelhados: a reanimação conta 55 s; sem socorro o corpo some em 2 min
  if(ai.deadTick(n,dt))return;
  if(d.t>(d.medic?300:120))remove(n);
 }
 // gente na rua foge (correndo) de quem atacou; serviços (polícia etc.) ficam
 function flee(n,from){
  if(!from||n.dead||n.kind!=='street')return;
  if(activities.has(n))activities.stop(n,'interrupted');
  const a=Math.atan2(n.y-from.y,n.x-from.x)+(Math.random()-.5)*.6;
  n.route=null;n.run=true;n.leaving=true;n.pause=0;n.socialUntil=0;n.target={x:n.x+Math.cos(a)*45,y:n.y+Math.sin(a)*45};
 }
 let screamAt=0;
 function panic(x,y,from,r){
  let loud=null;
  for(const n of npcs)if(!n.dead&&!n.leaving&&Math.hypot(n.x-x,n.y-y)<r){flee(n,from);if(n.kind==='street'&&(!loud||distance(n,bridge.player)<distance(loud,bridge.player)))loud=n;}
  if(loud&&performance.now()-screamAt>1200){screamAt=performance.now();window.CityAudio?.scream(loud.x,loud.y,roster?.characters.get(loud.lookId)?.sex==='female');}
 }
 // atropelamento: o carro do jogador acima de ~16 km/h derruba; devagar só empurra (e a pessoa sai correndo)
 let tireBlood=0,tireD=0;
 function runOver(dt){
  const V=window.cityVehicles,c=V?.driver?V.car:null;if(!c)return;
  const sp=Math.abs(c.speed||0);
  const ca=Math.cos(c.angle),sa=Math.sin(c.angle),hl=(V.carLength||4.6)/2+.2,hw=(V.bodyWidth||1.9)/2+.2,dir=Math.sign(c.speed||1);
  // pneus sujos de sangue: marcas atrás das rodas por alguns segundos depois de atropelar
  if(tireBlood>0){
   tireBlood-=dt;tireD+=sp*dt;
   if(tireD>.3){tireD=0;const r=hl-.9;for(const s of [-1,1])blood.drip(c.x-ca*r-sa*s*(hw-.45),c.y-sa*r+ca*s*(hw-.45),.07+Math.min(.08,tireBlood*.02),0);}
  }
  if(sp<1)return;
  for(const n of npcs){
   if(n.dead||!entries.has(n)||(n.floorZ||0)>.5)continue;
   const dx=n.x-c.x,dy=n.y-c.y,lx=dx*ca+dy*sa,ly=-dx*sa+dy*ca;
   if(Math.abs(lx)>hl||Math.abs(ly)>hw)continue;
   if(sp>4.5){hurt(n,999,{kind:'car',dx:ca*dir,dy:sa*dir,speed:sp,x:n.x,y:n.y,z:(n.floorZ||0)+.9,from:bridge.player});continue;}
   const side=Math.sign(ly)||1,push=hw-Math.abs(ly)+.05;n.x-=sa*side*push;n.y+=ca*side*push;
   n.stagger=.4;flee(n,c);
  }
 }
 // objeto carregado (empregos): caixa de papelão, saco de lixo ou bandeja — entre as mãos, à frente do peito
 const CARRY_V=new THREE.Vector3(),CARRY_W=new THREE.Vector3();
 function carryMesh(kind){
  const g=new THREE.Group(),M=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.8,...o}),add=(geo,m,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  if(kind==='package'){add(new THREE.BoxGeometry(.46,.32,.36),M(0xb98a52));add(new THREE.BoxGeometry(.47,.04,.08),M(0xd9c79a),0,.15,0);add(new THREE.BoxGeometry(.2,.005,.14),M(0xffffff),.08,.162,.05);}
  else if(kind==='bag'){const s=add(new THREE.SphereGeometry(.24,12,10),M(0x15171a,{roughness:.35}));s.scale.set(1,.85,1);add(new THREE.ConeGeometry(.07,.14,8),M(0x15171a,{roughness:.35}),0,.24,0);}
  else{add(new THREE.BoxGeometry(.42,.025,.3),M(0x6d4c41));add(new THREE.CylinderGeometry(.04,.035,.11,12),M(0xf5f5f5),-.08,.07,0);add(new THREE.CylinderGeometry(.1,.1,.02,16),M(0xf5f5f5),.09,.025,0);add(new THREE.BoxGeometry(.12,.05,.09),M(0xe0a96d),.09,.06,0);}
  return g;
 }
 function carryProp(a,e){
  if(!a.carry||!e.root.visible||!e.right||!e.left){if(e.carry)e.carry.visible=false;return;}
  if(!e.carry||e.carryKind!==a.carry){if(e.carry)scene.remove(e.carry);e.carry=carryMesh(a.carry);e.carryKind=a.carry;e.carry.userData.noSnow=true;scene.add(e.carry);}
  e.right.getWorldPosition(CARRY_V);e.left.getWorldPosition(CARRY_W);
  e.carry.visible=true;e.carry.position.copy(CARRY_V).add(CARRY_W).multiplyScalar(.5);e.carry.position.y+=a.carry==='tray'?.02:.05;e.carry.rotation.y=e.root.rotation.y;
 }
 system.muzzle=a=>{const e=entries.get(a);if(!e||!e.gun.visible)return null;e.muzzle.getWorldPosition(tmp);return [tmp.x,tmp.z,tmp.y];};
 system.telemetry=()=>[...entries].map(([a,e])=>({name:a===bridge.player?(system.casProfile.name+' ('+e.spec.name+')'):e.spec.name,look:e.id,role:e.spec.role,clip:e.clip,upper:e.upName||null,x:a.x,y:a.y,visible:e.root.visible,triangles:e.spec.triangles,bones:e.spec.bones}));
 system.appearances=()=>null;
 system.getAppearance=a=>a===bridge.player?{...system.casProfile}:null;
 // visual do jogador = perfil do CAS (peças + cores); "visuais prontos" = os dos personagens do elenco
 const lookOfProfile=p=>normalizeLook(p,roster?.manifest);
 system.lookOf=id=>{const c=roster?.characters.get(id);return c?{...c.look}:null;};
 system.applyCAS=async values=>{
  const next=normalizeCAS({...system.casProfile,...values});
  if(values?.look&&roster?.characters.has(values.look)){const l=roster.characters.get(values.look).look;if(l.sex===next.sex)Object.assign(next,{head:l.head,body:l.body,legs:l.legs,feet:l.feet,acc:l.acc,skin:l.skin,hair:l.hair,top:l.top,bottom:l.bottom,shoes:l.shoes});}
  const look={...lookOfProfile(next),name:next.name};
  if(roster&&entries.get(bridge.player)?.id!==lookKey(look))await mount(bridge.player,look);
  system.casProfile=next;system.streetModelId=next.look;system.playerLook=look;
  bridge.player.name=next.name;
  system.update(0);return next;
 };
 system.setBody=async(a,sex)=>a===bridge.player?system.applyCAS({sex}):null;
 system.setStreetModel=id=>{const c=roster?.characters.get(id);if(!c||c.sex!==system.casProfile.sex)return false;void system.applyCAS({look:id});return true;};
 system.loadLook=what=>roster.load(typeof what==='string'?what:{...lookOfProfile(what),name:what.name});
 system.setAppearance=async(a,changes)=>a===bridge.player?system.applyCAS(changes):null;
 system.emotes=CAS_EMOTES;
 system.playEmote=id=>{
  const entry=entries.get(bridge.player),a=bridge.player;
  if(!entry||!CAS_EMOTES[id]||!entry.spec.clips['cas_'+id]||a.armed||a.speed>.12||bridge.driving()||a.homeAction)return false;
  entry.emote={id,end:performance.now()+emoteDuration(id,entry.spec.clips)*1000};
  entry.clip=null;entry.baseName=null;return true;
 };
 system.stopEmote=()=>{const e=entries.get(bridge.player);if(e)e.emote=null;};
 async function init(){
  try{
   try{system.casProfile=normalizeCAS(readCAS(localStorage)||CAS_DEFAULT);}catch{}
   roster=await loadRoster(loader);
   let storage=null;try{storage=window.localStorage;}catch{}
   social=createSocialSim(roster.list(),{storage});system.social=social;
   window.addEventListener('pagehide',()=>social.save());
   system.roster=roster;system.streetCrownEnabled=true;   // o CAS usa o seletor de visual
   system.looks=Object.fromEntries([...roster.characters.values()].map(c=>[c.id,{id:c.id,label:c.name+' · '+groupLabel(c.group),sex:c.sex,role:c.role}]));
   system.models=[...roster.characters.values()].map(c=>({id:c.id,name:c.name,role:c.role,triangles:c.triangles,bytes:c.bytes}));
   await system.applyCAS(system.casProfile);
   system.ready=true;system.status='ready';
  }catch(error){
   system.status='failed';system.errors.push('Personagens: '+String(error.message||error));console.error('Personagens 3D',error);
  }
  try{installCASCreator(system,bridge,null,{styles:[],warnings:[],set:async()=>{},release:()=>{}});installEmoteMenu(system,bridge);}
  catch(error){system.errors.push('CAS: '+String(error.message||error));}
 }
 void init();
 return system;
}
