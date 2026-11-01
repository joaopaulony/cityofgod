import * as THREE from 'three';

/** Player-only procedural blendshapes built on cloned geometry; NPC caches remain untouched. */
export const FACE_KEYS=['faceWidth','jaw','nose','eyes','cheeks'];
const MAX_MORPHS=10;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(Number(v))?Number(v):0));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const faceCache=new WeakMap();
const accessoryCache=new WeakMap();
export function setupFaceMorphs(root){
 if(faceCache.has(root))return faceCache.get(root);
 const edited=[];
 root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!/body/i.test(mesh.name))return;
  const old=mesh.geometry,positions=old.attributes.position;
  if(!positions||positions.count<1000)return;
  old.computeBoundingBox();
  const bb=old.boundingBox,h=bb.max.y-bb.min.y;
  if(h<30)return; // Mixamo source units; do not distort a differently-rigged GLB.
  const geometry=old.clone();
  const morphs=[],ids=[];
  for(const key of FACE_KEYS)for(const sign of [1,-1]){
   const delta=new Float32Array(positions.count*3);
   for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const v=(y-bb.min.y)/h,ax=Math.abs(x)/h,fz=z/h;
    const inHead=smooth(.848,.89,v)*(1-smooth(.98,1,v))*(1-smooth(.047,.06,ax));
    const front=smooth(.018,.054,fz), leftRight=x<0?-1:1;
    let dx=0,dy=0,dz=0;
    if(key==='faceWidth'){
     const band=inHead*(1-smooth(.94,.975,v));
     dx=x*.18*band;
    }else if(key==='jaw'){
     const band=inHead*(1-smooth(.905,.94,v))*smooth(.865,.89,v);
     dx=x*.24*band;dy=-h*.012*band;
    }else if(key==='nose'){
     const band=inHead*smooth(.91,.934,v)*(1-smooth(.956,.973,v))*(1-smooth(.009,.022,ax))*front;
     dz=h*.020*band;
    }else if(key==='eyes'){
     const band=inHead*smooth(.925,.945,v)*(1-smooth(.961,.977,v))*smooth(.008,.014,ax)*(1-smooth(.028,.041,ax))*front;
     dx=leftRight*h*.011*band;dy=h*.002*band;
    }else if(key==='cheeks'){
     const band=inHead*smooth(.887,.916,v)*(1-smooth(.949,.97,v))*smooth(.012,.022,ax)*(1-smooth(.042,.055,ax))*front;
     dx=leftRight*h*.012*band;dz=h*.009*band;
    }
    const k=i*3;delta[k]=sign*dx;delta[k+1]=sign*dy;delta[k+2]=sign*dz;
   }
   const a=new THREE.Float32BufferAttribute(delta,3);
   a.name='CAS_'+key+(sign===1?'_plus':'_minus');
   morphs.push(a);ids.push(a.name);
  }
  geometry.morphTargetsRelative=true;
  geometry.morphAttributes.position=morphs;
  mesh.geometry=geometry;
  mesh.updateMorphTargets();
  edited.push({mesh,original:old,geometry,ids});
 });
 const result={meshes:edited,morphs:edited.length?FACE_KEYS:[]};
 faceCache.set(root,result);
 return result;
}
export function applyFaceMorphs(root,profile){
 const entry=setupFaceMorphs(root);
 for(const {mesh} of entry.meshes)for(let i=0;i<FACE_KEYS.length;i++){
  const value=clamp(profile[FACE_KEYS[i]],-1,1);
  mesh.morphTargetInfluences[i*2]=Math.max(0,value);
  mesh.morphTargetInfluences[i*2+1]=Math.max(0,-value);
 }
 return entry;
}
const rgb=hex=>new THREE.Color(/^#[0-9a-fA-F]{6}$/.test(hex||'')?hex:'#dddddd');
export const OUTFITS=Object.freeze({
 casual:{label:'Casual',top:'#49647a',bottom:'#29394f',shoes:'#e9e6e0'},
 street:{label:'Streetwear',top:'#1b1d22',bottom:'#343339',shoes:'#d0b18a'},
 sport:{label:'Esportivo',top:'#b54839',bottom:'#242a2f',shoes:'#ffffff'},
 social:{label:'Social',top:'#e2d6c8',bottom:'#171b21',shoes:'#2c2828'}
});
export function outfitPalette(key){return OUTFITS[key]||OUTFITS.casual;}
export function applyWardrobe(root,profile){
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const n=mesh.name.toLowerCase();
  const key=/shirt|hood|jacket|blouse|coat|shirt|top/.test(n)?'top':/pants|trouser|jean|short|skirt/.test(n)?'bottom':/sneaker|shoe|boot/.test(n)?'shoes':null;
  if(!key)return;
  for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(!mat?.color)continue;
   if(!mat.userData.casOriginal)mat.userData.casOriginal={map:mat.map,color:mat.color.clone(),roughness:mat.roughness};
   // Clothing has its own mesh; blanking its baked albedo is safe and enables true garment recolor.
   mat.map=null;mat.color.copy(rgb(profile[key]));
   mat.roughness=key==='shoes'?.76:.96;
   mat.needsUpdate=true;
  }
 });
}
function createAccessory(type,colour){
 const g=new THREE.Group();g.name='CASAccessory_'+type;
 const fabric=new THREE.MeshStandardMaterial({color:colour,roughness:.92,side:THREE.DoubleSide});
 const metal=new THREE.MeshStandardMaterial({color:'#25282a',metalness:.5,roughness:.3});
 function add(geom,mat,x,y,z){const part=new THREE.Mesh(geom,mat);part.position.set(x,y,z);part.castShadow=true;g.add(part);return part;}
 if(type==='glasses'){
  for(const x of [-.042,.042]){const rim=add(new THREE.TorusGeometry(.035,.006,8,24),metal,x,0,.01);rim.scale.y=.72;}
  add(new THREE.BoxGeometry(.026,.006,.009),metal,0,.003,.02);
  for(const x of [-.085,.085])add(new THREE.BoxGeometry(.05,.006,.006),metal,x,0,-.012);
 }else if(type==='cap'){
  const crown=add(new THREE.SphereGeometry(.11,18,10,0,Math.PI*2,0,Math.PI*.52),fabric,0,0,0);
  crown.scale.set(1,.55,1.07);
  const brim=add(new THREE.CylinderGeometry(.085,.115,.018,24,1,false,0,Math.PI),fabric,0,.007,.105);
  brim.rotation.y=Math.PI;
 }else if(type==='beanie'){
  const cap=add(new THREE.SphereGeometry(.115,18,12,0,Math.PI*2,0,Math.PI*.58),fabric,0,.015,0);
  cap.scale.y=.73;
  add(new THREE.TorusGeometry(.112,.018,8,24),fabric,0,-.015,0).rotation.x=Math.PI/2;
 }
 return g;
}
export function applyAccessories(root,profile){
 let state=accessoryCache.get(root);
 if(!state){state={group:null,key:null};accessoryCache.set(root,state);}
 const type=['none','glasses','cap','beanie'].includes(profile.accessory)?profile.accessory:'none';
 const key=type+'|'+profile.accessoryColor;
 if(state.key===key)return;
 state.group?.parent?.remove(state.group);
 state.group?.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();mesh.material.dispose();}});
 state.group=null;state.key=key;
 if(type==='none')return;
 const head=root.getObjectByName('mixamorigHead')||root.getObjectByName('Head');
 if(!head)return;
 root.updateMatrixWorld(true);
 const s=head.getWorldScale(new THREE.Vector3());
 const w=head.getWorldPosition(new THREE.Vector3());
 const orientation=head.getWorldQuaternion(new THREE.Quaternion());
 const isGlasses=type==='glasses';
 const eyeHeight=isGlasses?.085:.21;
 const front=isGlasses?.13:.018;
 const target=w.clone().add(new THREE.Vector3(0,eyeHeight,front));
 const group=createAccessory(type,profile.accessoryColor);
 head.add(group);group.position.copy(head.worldToLocal(target));
 group.quaternion.copy(orientation).invert();
 group.scale.set(1/Math.abs(s.x||1),1/Math.abs(s.y||1),1/Math.abs(s.z||1));
 state.group=group;
}
export function applyCASVisual(root,profile){
 applyFaceMorphs(root,profile);
 applyWardrobe(root,profile);
 applyAccessories(root,profile);
}
export function releaseCASVisual(root){
 const state=faceCache.get(root);
 if(state){for(const {mesh,original,geometry} of state.meshes){mesh.geometry=original;geometry.dispose();mesh.updateMorphTargets();}faceCache.delete(root);}
 const accessories=accessoryCache.get(root);
 if(accessories){accessories.group?.parent?.remove(accessories.group);accessories.group?.traverse(obj=>{if(obj.isMesh){obj.geometry.dispose();obj.material?.dispose();}});accessoryCache.delete(root);}
}

/** Named, skeletal animation clips: actual Three.js quaternion tracks, not AI videos. */
export const CAS_EMOTES=Object.freeze({
 wave:{label:'Acenar',duration:2.4,loop:false},
 phone:{label:'Usar celular',duration:3.4,loop:false},
 dance:{label:'Dançar',duration:4,loop:true},
 cheer:{label:'Comemorar',duration:2.7,loop:false},
 stretch:{label:'Alongar',duration:3.2,loop:false},
 sit:{label:'Sentar',duration:3,loop:false}
});
const ease=(t)=>Math.sin(Math.PI*t);
export function createCASEmoteClips(root){
 const clips=[];
 const bones={};
 root.traverse(o=>{if(o.isBone)bones[o.name.replace('mixamorig','')]=o;});
 if(!bones.LeftArm||!bones.RightArm||!bones.LeftForeArm)return clips;
 const times=[0,.12,.25,.40,.55,.70,.83,1];
 for(const [name,spec] of Object.entries(CAS_EMOTES)){
  const tracks=[];
  const keys={
   wave:['RightArm','RightForeArm','RightHand','Spine2'],
   phone:['RightArm','RightForeArm','RightHand','Head'],
   dance:['LeftArm','LeftForeArm','RightArm','RightForeArm','Spine','Spine2','Head'],
   cheer:['LeftArm','RightArm','LeftForeArm','RightForeArm','Spine2'],
   stretch:['LeftArm','RightArm','Spine','Spine2'],
   sit:['LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','Spine']
  }[name];
  for(const part of keys){
   const bone=bones[part];if(!bone)continue;
   const q0=bone.quaternion.clone(),values=[];
   for(const t of times){
    const e=ease(t),swing=Math.sin(t*Math.PI*6)*e,twist=Math.sin(t*Math.PI*4)*e;
    let x=0,y=0,z=0;
    if(name==='wave'){
     if(part==='RightArm')z=-1.22*e;
     if(part==='RightForeArm')z=-.55*e+.23*swing;
     if(part==='RightHand')z=.24*swing;
     if(part==='Spine2')y=-.09*e;
    }else if(name==='phone'){
     if(part==='RightArm'){z=-.57*e;x=-.30*e;}
     if(part==='RightForeArm'){x=-1.4*e;z=-.22*e;}
     if(part==='RightHand')x=.15*e;
     if(part==='Head')y=.07*e;
    }else if(name==='dance'){
     const side=part.startsWith('Left')?1:-1;
     if(part.includes('Arm')&&!part.includes('Fore')){z=side*(.48+.25*twist)*e;x=.35*e;}
     if(part.includes('ForeArm'))x=-.55*e+.25*swing;
     if(part==='Spine'||part==='Spine2')y=.2*twist;
     if(part==='Head')z=.12*twist;
    }else if(name==='cheer'){
     if(part.includes('Arm')&&!part.includes('Fore'))z=part.startsWith('Left')?1.5*e:-1.5*e;
     if(part.includes('ForeArm'))x=-.3*e;
     if(part==='Spine2')x=-.12*e;
    }else if(name==='stretch'){
     if(part.includes('Arm'))z=part.startsWith('Left')?1.65*e:-1.65*e;
     if(part==='Spine'||part==='Spine2')x=-.1*e;
    }else if(name==='sit'){
     if(part.includes('UpLeg'))x=-1.28*e;
     if(part==='LeftLeg'||part==='RightLeg')x=1.2*e;
     if(part==='Spine')x=.11*e;
    }
    const q=q0.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,'XYZ')));
    values.push(q.x,q.y,q.z,q.w);
   }
   tracks.push(new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion',times.map(t=>t*spec.duration),values));
  }
  if(tracks.length)clips.push(new THREE.AnimationClip('cas_'+name,spec.duration,tracks));
 }
 return clips;
}
