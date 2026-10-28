import {validateCASManifest} from './cas-profile.mjs';
const NAMES={
 idle:['idle','standing','breathing'],
 walk:['walk','walking','walkcycle'],
 run:['run','running','jog'],
 crouch:['crouch','crouchidle'],
 crouch_walk:['crouchwalk','crouchwalking'],
 jump_start:['jumpstart'],jump_air:['jump','jumpair'],jump_land:['jumpland'],
 vault_low:['vault','vaultlow'],rifle_idle:['rifleidle'],
 rifle_aim:['rifleaim','aim'],rifle_walk:['riflewalk'],rifle_run:['riflerun'],
 rifle_fire:['riflefire','shoot'],rifle_reload:['riflereload','reload']
};
function canon(value){return String(value).toLowerCase().replace(/[^a-z0-9]/g,'');}
export function matchCASClips(animations,overrides={}){
 const all=new Map(animations.map(clip=>[canon(clip.name),clip]));
 const out={};
 for(const [key,aliases] of Object.entries(NAMES)){
  const override=overrides[key];
  const configured=typeof override==='string'?override:override?.name;
  const selected=configured?all.get(canon(configured)):aliases.map(name=>all.get(name)).find(Boolean);
  if(!selected)continue;
  const loop=!(key.includes('fire')||key.includes('reload')||['jump_start','jump_land','vault_low'].includes(key));
  out[key]={name:selected.name,duration:selected.duration||1,loop,speed:key==='walk'?1.6:key==='run'?4.2:0};
 }
 return out;
}
export function casCapabilities(spec){
 return Object.fromEntries(['skin','hair','top','bottom'].map(k=>[k,(spec.materialSlots?.[k]||[]).length>0]));
}
export function applyCASStyle(root,profile,spec){
 const slots=spec.materialSlots||{};
 const materialGroups=new Map();
 for(const key of ['skin','hair','top','bottom'])for(const name of slots[key]||[])materialGroups.set(name,key);
 root.traverse(node=>{
  if(!node.isMesh)return;
  for(const mat of Array.isArray(node.material)?node.material:[node.material]){
   const group=materialGroups.get(mat.name);
   if(group&&mat.color){mat.color.set(profile[group]);mat.needsUpdate=true;}
  }
 });
 const scale=root.userData.casOriginalScale||(root.userData.casOriginalScale=root.scale.clone());
 root.scale.set(scale.x*profile.build,scale.y*profile.height,scale.z*profile.build);
}
function countGeometry(gltf){
 let triangles=0,bones=0,skins=0;
 gltf.scene.traverse(node=>{
  if(node.isMesh)triangles+=node.geometry?.index?node.geometry.index.count/3:(node.geometry?.attributes?.position?.count||0)/3;
  if(node.isBone)bones++;
  if(node.isSkinnedMesh)skins++;
 });
 return {triangles:Math.round(triangles),bones,skins};
}
// The models array may stay empty until the first Higgsfield export is approved.
// Every failed import keeps the proven local Mixamo male/female base.
export async function loadCASAssets(loader,mixamoAssets){
 const bases=new Map([
  ['male',{...mixamoAssets.get('david'),spec:{...mixamoAssets.get('david').spec,sex:'male',rig:'mixamo',
   materialSlots:{skin:[],hair:['david_Ch28_hair'],top:[],bottom:[]}},origin:'base provisória'}],
  ['female',{...mixamoAssets.get('megan'),spec:{...mixamoAssets.get('megan').spec,sex:'female',rig:'mixamo',
   materialSlots:{skin:[],hair:['megan_Ch22_hair'],top:[],bottom:[]}},origin:'base provisória'}]
 ]);
 const warnings=[];
 try{
  const response=await fetch('assets/characters/cas/manifest.json',{cache:'no-store'});
  if(!response.ok)throw Error('manifest HTTP '+response.status);
  const models=validateCASManifest(await response.json());
  for(const model of models){
   try{
    const gltf=await loader.loadAsync('assets/characters/cas/'+model.file);
    const metrics=countGeometry(gltf);
    const clips=matchCASClips(gltf.animations||[],model.clips);
    if(!metrics.skins||!metrics.bones)throw Error('modelo sem skinning/rig');
    if(!clips.idle||!clips.walk||!clips.run)throw Error('faltam animações idle, walk ou run');
    if(metrics.triangles>60000)throw Error('malha acima do limite provisório de 60 mil triângulos');
    if(model.rig==='mixamo'&&!gltf.scene.getObjectByName('mixamorigRightHand'))
     throw Error('rig declarado Mixamo sem os ossos esperados');
    bases.set(model.sex,{gltf,origin:'GLB personalizado',spec:{
     id:model.sex,sex:model.sex,rig:model.rig,triangles:metrics.triangles,bones:metrics.bones,
     clips,materialSlots:model.materialSlots
    }});
   }catch(error){warnings.push(model.sex+': '+String(error.message||error));}
  }
 }catch(error){warnings.push('Cadastro CAS: '+String(error.message||error));}
 return {bases,warnings};
}
