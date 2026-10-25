import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {chooseCharacterClip,planLowVault,stepTraversal,pointSegmentDistance} from './character-actions.mjs';
import {createTombRig} from './tomb-rig.mjs';
import {createCC3Rig} from './cc3-rig.mjs';

export function createCharacterSystem(scene,bridge){
 const entries=new Map(),loader=new GLTFLoader(),tmp=new THREE.Vector3();
 const provider=new URLSearchParams(location.search).get('characters')||'mixamo';
 const system={status:'loading',ready:false,errors:[],frames:0,models:[],provider,enabled:provider!=='canvas'};
 window.cityCharacters=system;
 const clear=(x,y,ignore)=>{
  const r=.28;
  if(x<.5||y<.5||x>bridge.mapSize-.5||y>bridge.mapSize-.5)return false;
  if(bridge.pondVal(x,y)<=1.02&&!bridge.onRoad(x,y))return false;
  for(const s of bridge.world.segs)if(s!==ignore&&!(s.door&&s.doorAnim?.open>=.72)&&pointSegmentDistance(x,y,s)<r+.08)return false;
  for(const c of bridge.world.circles)if(Math.hypot(x-c.x,y-c.y)<r+(c.r||0))return false;
  const q=bridge.collide(x,y,r,0);
  // Near the selected fence only its push-out is ignored; all other obstacles
  // were checked above. At landing require the game's original collider too.
  return ignore&&pointSegmentDistance(x,y,ignore)<r+.09||Math.hypot(q[0]-x,q[1]-y)<.025;
 };
 system.move=dt=>{
  if(!system.enabled)return false;
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
   a.jump.t+=dt;const u=Math.min(1,a.jump.t/a.jump.duration);
   a.actionZ=.65*Math.sin(Math.PI*u);
   if(u>=1){a.jump=null;a.actionZ=0;}
  }
  return false;
 };
 system.has=a=>system.enabled&&entries.has(a);
 system.update=dt=>{
  if(!system.enabled)return;
  for(const [a,e] of entries){
   if(e.cc3Rig){
    e.root.visible=!(a===bridge.player&&bridge.driving())&&Math.hypot(a.x-bridge.cam.x,a.y-bridge.cam.y)<65;
    e.root.position.set(a.x,(a.floorZ||0)+(a.actionZ||0)+(e.cc3YOffset||0),a.y);
    const heading=Math.PI/2-a.face+(e.spec.facingOffset||0);
    const angleDelta=Math.atan2(Math.sin(heading-e.root.rotation.y),Math.cos(heading-e.root.rotation.y));
    e.root.rotation.y+=angleDelta*(1-Math.exp(-Math.min(.09,Math.max(0,dt))*14));
    if(e.root.visible)e.cc3Rig.update(a,dt);
    if(e.gun){
     e.gun.visible=e.root.visible&&a.armed&&!a.traversal;
     if(e.gun.visible&&a.J){
      const R=a.J.rifle,z=(a.floorZ||0)+(a.actionZ||0);
      e.gun.position.set(R.butt[0],R.butt[2]+z,R.butt[1]);
      const direction=new THREE.Vector3(R.muzzle[0]-R.butt[0],R.muzzle[2]-R.butt[2],R.muzzle[1]-R.butt[1]).normalize();
      e.gun.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
      e.gun.userData.mag.visible=a.magState==='in';
     }
    }
    a.characterClip=e.clip=chooseCharacterClip(a);
    continue;
   }
   if(e.tombRig){
    e.root.visible=!(a===bridge.player&&bridge.driving())&&Math.hypot(a.x-bridge.cam.x,a.y-bridge.cam.y)<65;
    e.root.position.set(a.x,(a.floorZ||0)+(a.actionZ||0),a.y);e.root.rotation.y=Math.PI/2-a.face;e.root.updateMatrixWorld(true);
    if(e.root.visible)e.tombRig.update(a);
    if(e.gun){
     e.gun.visible=e.root.visible&&a.armed;
     if(e.gun.visible&&a.J){
      const R=a.J.rifle,z=(a.floorZ||0)+(a.actionZ||0);
      e.gun.position.set(R.butt[0],R.butt[2]+z,R.butt[1]);
      const direction=new THREE.Vector3(R.muzzle[0]-R.butt[0],R.muzzle[2]-R.butt[2],R.muzzle[1]-R.butt[1]).normalize();
      e.gun.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
      e.gun.userData.mag.visible=a.magState==='in';
     }
    }
    a.characterClip=e.clip=chooseCharacterClip(a);continue;
   }
   const id=chooseCharacterClip(a),clip=e.spec.clips[id]?id:'idle';
   if(e.clip!==clip){
    const meta=e.spec.clips[clip],action=e.actions.get(meta.name);
    if(!action)continue;
    const timeScale=clip.includes('reload')?meta.duration/2.5:clip==='vault_low'?meta.duration/(a.traversal?.duration||1.1):['jump_start','jump_land'].includes(clip)?meta.duration/.18:1;
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(timeScale);
    action.setLoop(meta.loop?THREE.LoopRepeat:THREE.LoopOnce,meta.loop?Infinity:1);action.clampWhenFinished=!meta.loop;
    action.play();if(e.action)e.action.crossFadeTo(action,clip.endsWith('fire')?.04:.12,false);
    e.action=action;e.clip=clip;
   }
   if(clip.endsWith('fire')&&a.recoilT<e.lastRecoil)e.action.reset().play();
   e.lastRecoil=a.recoilT;
   e.root.visible=!(a===bridge.player&&bridge.driving())&&Math.hypot(a.x-bridge.cam.x,a.y-bridge.cam.y)<65;
   if(e.root.visible){
    const speed=e.spec.clips[clip].speed;
    if(speed>.1&&/walk|run/.test(clip))e.action.setEffectiveTimeScale(THREE.MathUtils.clamp(a.speed/speed,.5,2));
    e.mixer.update(dt);
    e.root.position.set(a.x,(a.floorZ||0)+(a.actionZ||0),a.y);
    // Generator faces +Z. Game face 0 points +X.
    e.root.rotation.y=Math.PI/2-a.face;
    e.root.updateMatrixWorld(true);
    if(e.mixamo){
     e.root.updateMatrixWorld(true);
     e.gun.visible=a.armed&&!a.traversal;
     if(a.armed){
      const right=e.root.getObjectByName('mixamorigRightHand'),left=e.root.getObjectByName('mixamorigLeftHand');
      right.getWorldPosition(e.grip);left.getWorldPosition(e.support);
      const direction=a.reloadT>=0?e.support.sub(e.grip).normalize():new THREE.Vector3(Math.cos(a.face),0,Math.sin(a.face));
      e.gun.position.copy(e.grip).addScaledVector(direction,-.24);
      e.gun.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
      e.gun.userData.mag.visible=a.magState==='in';e.gun.updateMatrixWorld(true);
     }
    }
   }
   if(e.mixamo&&!e.root.visible)e.gun.visible=false;
   a.characterClip=clip;
  }
  system.frames++;
 };
 system.muzzle=a=>{
  const e=entries.get(a);if(!system.enabled)return null;
  if(e?.tombRig&&a.armed&&a.J)return a.J.rifle.muzzle.map((v,i)=>v+(i===2?(a.floorZ||0)+(a.actionZ||0):0));
  if(!e?.muzzle)return null;
  e.muzzle.getWorldPosition(tmp);return [tmp.x,tmp.z,tmp.y];
 };
 system.telemetry=()=>[...entries].map(([a,e])=>({name:a.name||'Jogador',clip:e.clip,x:a.x,y:a.y,z:a.actionZ||0,visible:e.root.visible,triangles:e.spec.triangles,bones:e.spec.bones}));
 async function init(){
  if(!system.enabled){system.status='disabled';return;}
  if(provider==='tomb'){await initTomb();return;}
  if(provider==='cc3'){await initCC3();return;}
  if(provider==='mixamo'){await initMixamo();return;}
  try{
   const response=await fetch('assets/characters/manifest.json');if(!response.ok)throw Error('Character manifest '+response.status);
   const manifest=await response.json();
   const assets=new Map();
   // Load once per appearance; SkeletonUtils preserves independent animation.
   for(const spec of manifest.models){
    try{assets.set(spec.id,{spec,gltf:await loader.loadAsync('assets/characters/'+spec.file)});}
    catch(error){system.errors.push(spec.id+': '+String(error));}
   }
   for(const [i,a] of bridge.actors.entries()){
    const item=assets.get(i===0?'player':a.name==='Ana'?'ana':'lucas');if(!item)continue;
    const {spec,gltf}=item,root=cloneSkeleton(gltf.scene),mixer=new THREE.AnimationMixer(root);
    root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
    const actions=new Map(gltf.animations.map(c=>[c.name,mixer.clipAction(c)]));
    let muzzle=null;
    const socket=root.getObjectByName('WeaponR');
    if(socket&&spec.weaponRotation){
     const rotation=new THREE.Quaternion(...spec.weaponRotation);
     muzzle=new THREE.Object3D();muzzle.position.fromArray(spec.muzzle).applyQuaternion(rotation);socket.add(muzzle);
    }
    scene.add(root);entries.set(a,{root,mixer,actions,spec,muzzle,clip:null,action:null});
   }
   system.models=manifest.models.map(({id,bytes,triangles,bones})=>({id,bytes,triangles,bones}));
   system.ready=entries.has(bridge.player);system.status=system.errors.length?'partial':system.ready?'ready':'failed';
   system.update(0);
  }catch(error){system.status='failed';system.errors.push(String(error));console.error('Characters GLB',error);}
 }
 // The CC3 provider is opt-in (?characters=cc3) until locally converted
 // assets and the license are verified. Default Mixamo remains unchanged.
 async function initCC3(){
   try{
     const res=await fetch('assets/characters/cc3/manifest.json',{cache:'no-store'});
     if(!res.ok)throw Error('CC3 manifest '+res.status);
     const manifest=await res.json();
     if(!Array.isArray(manifest.models)||manifest.models.length<2)throw Error('CC3 male and female GLB exports not installed');
     const assets=new Map();
     for(const spec of manifest.models){
       if(!['male','female'].includes(spec.sex)||typeof spec.file!=='string'||!/^[a-z0-9_-]+\\.glb$/i.test(spec.file))
         throw Error('Invalid CC3 manifest entry');
       const gltf=await loader.loadAsync('assets/characters/cc3/'+spec.file);
       assets.set(spec.sex,{spec,gltf});
     }
     if(!assets.has('male')||!assets.has('female'))throw Error('CC3 exports incomplete');
     const requestedSex=new URLSearchParams(location.search).get('sex');
     function mount(a,sex){
       const {spec,gltf}=assets.get(sex),root=cloneSkeleton(gltf.scene);
       root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=true;}});
       root.updateMatrixWorld(true);
       // Fit CC4 FBX units into a human-height game actor, preserving bone hierarchy.
       const bound=new THREE.Box3().setFromObject(root),h=bound.max.y-bound.min.y;
       if(!Number.isFinite(h)||h<=.1)throw Error('CC3 invalid bounding box');
       const scale=(sex==='female'?1.70:1.79)/h;
       root.scale.setScalar(scale);
       const cc3YOffset=-bound.min.y*scale;
       scene.add(root);
       const cc3Rig=createCC3Rig(root);
       const gun=a===bridge.player?makeRifle():null;if(gun)scene.add(gun);
       const entry={root,cc3Rig,cc3YOffset,spec,gun,clip:'idle'};
       entries.set(a,entry);return entry;
     }
     for(const a of bridge.actors)mount(a,a===bridge.player&&requestedSex==='female'?'female':a.name==='Ana'?'female':'male');
     // Compatible with the character editor's sex switch. No public raw FBX is required.
     system.setBody=async(a,sex)=>{
       if(!['male','female'].includes(sex)||!assets.has(sex))return;
       const prior=entries.get(a);
       if(!prior||prior.spec.sex===sex)return;
       scene.remove(prior.root);
       if(prior.gun)scene.remove(prior.gun);
       entries.delete(a);
       mount(a,sex);
       system.update(0);
     };
     system.models=manifest.models.map(({sex,file,triangles,bones})=>({id:sex,file,triangles,bones}));
     system.availableBodies=['male','female'];
     system.ready=entries.has(bridge.player);
     system.status=system.ready?'ready':'failed';
     system.update(0);
   }catch(error){
     for(const e of entries.values()){scene.remove(e.root);if(e.gun)scene.remove(e.gun);}
     entries.clear();
     system.errors.push('CC3 unavailable: '+String(error.message||error));
     system.provider='mixamo';
     await initMixamo();
   }
 }
 const textureLoader=new THREE.TextureLoader(),images=new Map();
 async function initMixamo(){
  try{
   const response=await fetch('assets/characters/mixamo/manifest.json');if(!response.ok)throw Error('Mixamo manifest '+response.status);
   const manifest=await response.json(),assets=new Map();
   for(const spec of manifest.models){
    const gltf=await loader.loadAsync('assets/characters/mixamo/'+spec.file);
    const materialList=[];gltf.scene.traverse(o=>{if(o.isMesh)materialList.push(...(Array.isArray(o.material)?o.material:[o.material]));});
    for(const material of new Set(materialList)){
     const maps=spec.materials[material.name];if(!maps)continue;
     for(const key of ['map','normalMap'])if(maps[key]){
      const texture=await textureLoader.loadAsync('assets/characters/mixamo/'+maps[key]);texture.flipY=true;
      if(key==='map')texture.colorSpace=THREE.SRGBColorSpace;
      material[key]=texture;
     }
     material.alphaTest=maps.alphaTest;material.needsUpdate=true;
    }
    assets.set(spec.id,{spec,gltf});
   }
   for(const [i,a] of bridge.actors.entries()){
    const item=assets.get(a.name==='Ana'?'megan':'david');if(!item)continue;
    const {spec,gltf}=item,root=cloneSkeleton(gltf.scene),mixer=new THREE.AnimationMixer(root),rest=new Map();
    root.traverse(o=>{if(o.isBone)rest.set(o.name,o.quaternion.clone());if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
    const gun=makeRifle();scene.add(gun);const muzzle=new THREE.Object3D();muzzle.position.set(0,.01,.94);gun.add(muzzle);
    scene.add(root);entries.set(a,{root,mixer,spec,rest,mixamo:true,gun,muzzle,grip:new THREE.Vector3(),support:new THREE.Vector3(),actions:new Map(gltf.animations.map(c=>[c.name,mixer.clipAction(c)])),clip:null,action:null});
   }
   system.models=manifest.models;system.ready=entries.has(bridge.player);system.status=assets.has('megan')?'ready':'partial';
   if(!assets.has('megan'))system.errors.push('Megan: aguardando download; Ana continua com o corpo original.');
   system.update(0);
  }catch(error){system.status='failed';system.errors.push(String(error));console.error('Mixamo characters',error);}
 }
 const getImage=path=>{if(!images.has(path))images.set(path,textureLoader.loadAsync('assets/characters/tomb/'+path));return images.get(path);};
 let tombManifest,tombAssets;
 system.appearances=()=>tombManifest?{faces:tombManifest.faces.filter(f=>f.tone===1).map(f=>({name:f.name,sex:f.sex})),skins:5}:null;
 system.getAppearance=a=>{const e=entries.get(a);return e?.appearance?{...e.appearance,sex:e.spec.sex}:null;};
 system.setBody=async(a,sex)=>{
  const e=entries.get(a),item=tombAssets?.get(sex);if(!e||!item||e.spec.sex===sex)return;
  scene.remove(e.root);e.skinTexture?.dispose();e.maskTexture?.dispose();
  e.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
  const root=cloneSkeleton(item.gltf.scene);
  root.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=true;o.frustumCulled=false;}});
  scene.add(root);e.root=root;e.spec=item.spec;e.tombRig=createTombRig(root);e.skinTexture=null;
  e.appearance.face=sex==='female'?'Sophie':'Jake';await system.setAppearance(a,{});system.update(0);
 };
 system.setAppearance=async(a,changes)=>{
  const e=entries.get(a);if(!e?.tombRig)return;
  const appearance=e.appearance={...e.appearance,...changes},serial=e.appearanceSerial=(e.appearanceSerial||0)+1;
  const skin=tombManifest.skins.find(s=>s.sex===e.spec.sex&&s.tone===Number(appearance.tone));
  const face=tombManifest.faces.find(f=>f.sex===e.spec.sex&&f.tone===Number(appearance.tone)&&f.name===appearance.face);
  if(!skin)return;
  const [base,overlay]=await Promise.all([getImage(skin.file),face?getImage(face.file):null]);
  if(serial!==e.appearanceSerial)return;
  const canvas=document.createElement('canvas');canvas.width=base.image.width;canvas.height=base.image.height;
  const context=canvas.getContext('2d');context.drawImage(base.image,0,0);
  if(overlay)context.drawImage(overlay.image,0,0,canvas.width,canvas.height);
  const texture=new THREE.CanvasTexture(canvas);texture.flipY=true;texture.colorSpace=THREE.SRGBColorSpace;
  // The source body atlas masks helper surfaces (including skirt panels).
  // Keep that mask on our clothing materials too, otherwise they form curtains
  // between the legs when walking.
  const maskCanvas=document.createElement('canvas');maskCanvas.width=canvas.width;maskCanvas.height=canvas.height;
  const maskContext=maskCanvas.getContext('2d'),pixels=context.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<pixels.data.length;i+=4){const alpha=pixels.data[i+3];pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=alpha;pixels.data[i+3]=255;}
  maskContext.putImageData(pixels,0,0);
  const mask=new THREE.CanvasTexture(maskCanvas);mask.flipY=true;
  e.skinTexture?.dispose();e.maskTexture?.dispose();e.skinTexture=texture;e.maskTexture=mask;
  e.root.traverse(o=>{if(!o.isMesh)return;for(const mat of Array.isArray(o.material)?o.material:[o.material]){
   mat.alphaMap=mask;mat.alphaTest=.5;mat.needsUpdate=true;
   if(mat.name==='TombSkin'){mat.map=texture;mat.needsUpdate=true;}
   if(mat.name==='CityShirt')mat.color.set(appearance.shirt);
   if(mat.name==='CityTrousers')mat.color.set(appearance.trousers);
  }});
 };
 async function initTomb(){
  try{
   const response=await fetch('assets/characters/tomb/manifest.json');if(!response.ok)throw Error('Tomb manifest '+response.status);
   tombManifest=await response.json();const assets=tombAssets=new Map();
   for(const spec of tombManifest.models)assets.set(spec.sex,{spec,gltf:await loader.loadAsync('assets/characters/tomb/'+spec.file)});
   for(const [i,a] of bridge.actors.entries()){
    const {spec,gltf}=assets.get(a.name==='Ana'?'female':'male'),root=cloneSkeleton(gltf.scene);
    root.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=true;o.frustumCulled=false;}});
    scene.add(root);const tombRig=createTombRig(root);
    const gun=i===0?makeRifle():null;if(gun)scene.add(gun);
    entries.set(a,{root,tombRig,spec,gun,clip:'idle',appearance:{tone:1,face:a.name==='Ana'?'Sophie':i===0?'Jake':'Jason',shirt:i===0?'#e2ded0':i===1?'#a83e36':'#508a87',trousers:i===0?'#395c80':'#343b48'}});
    await system.setAppearance(a,{});
   }
   system.models=tombManifest.models;system.ready=true;system.status='ready';system.update(0);
  }catch(error){system.status='failed';system.errors.push(String(error));console.error('Tomb characters',error);}
 }
 function makeRifle(){
  const group=new THREE.Group(),metal=new THREE.MeshStandardMaterial({color:0x303238,metalness:.65,roughness:.55}),polymer=new THREE.MeshStandardMaterial({color:0x202327,roughness:.9});
  const part=(w,h,d,x,y,z,mat=polymer)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh;};
  part(.055,.12,.19,0,-.02,.06);part(.065,.09,.30,0,.015,.31,metal);part(.055,.08,.23,0,0,.57);
  part(.025,.025,.25,0,.01,.805,metal);part(.03,.035,.045,0,.01,.92,metal);part(.04,.10,.04,0,-.065,.24);
  const mag=part(.045,.16,.07,0,-.10,.38,metal);mag.rotation.x=-.2;group.userData.mag=mag;
  part(.02,.035,.04,0,.075,.30,metal);return group;
 }
 init();return system;
}
