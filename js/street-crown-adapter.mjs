import * as THREE from 'three';
import {normalizeRebornClip} from './cas-reborn.mjs';

// Six original Street Crown GLBs from the user-owned HTML. No cars or
// unapproved legacy City of God humans are loaded from this folder.
export const STREET_CROWN_DIR='assets/street-crown/';
export const STREET_CROWN_MODELS=Object.freeze({
 hero:{id:'hero',label:'Protagonista',sex:'male',role:'player'},
 partner:{id:'partner',label:'Parceira',sex:'female',role:'player'},
 ped_man:{id:'ped_man',label:'Pedestre masculino',sex:'male',role:'npc'},
 ped_woman:{id:'ped_woman',label:'Pedestre feminino',sex:'female',role:'npc'},
 thug:{id:'thug',label:'Integrante da gangue',sex:'male',role:'npc'},
 boss:{id:'boss',label:'Chefe da gangue',sex:'male',role:'npc'}
});
const REQUIRED=['Hips','Spine','Head','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftLeg','RightLeg'];
export const STREET_CROWN_DEFAULT=Object.freeze({male:'hero',female:'partner'});
export function streetModelForSex(id,sex){
 return STREET_CROWN_MODELS[id]?.sex===sex?id:STREET_CROWN_DEFAULT[sex]||'hero';
}
export function inspectStreetCrown(gltf,{maxTriangles=4500}={}){
 const errors=[];let meshes=0,skins=0,triangles=0,materials=new Set(),boneNames=new Set(),weights=false;
 gltf.scene.traverse(x=>{
  if(x.isBone)boneNames.add(x.name);
  if(!x.isMesh)return;
  meshes++;
  if(x.isSkinnedMesh){
   skins++;
   const idx=x.geometry.attributes.skinIndex,weight=x.geometry.attributes.skinWeight;
   if(idx&&weight&&idx.count===weight.count)weights=true;
   else errors.push('SkinnedMesh missing JOINTS_0 or WEIGHTS_0');
  } else errors.push('Model contains unskinned human geometry');
  triangles+=Math.floor((x.geometry.index?.count||x.geometry.attributes.position?.count||0)/3);
  for(const mat of Array.isArray(x.material)?x.material:[x.material])if(mat)materials.add(mat);
 });
 for(const name of REQUIRED)if(!boneNames.has(name))errors.push('Missing bone '+name);
 if(meshes===0||skins===0||!weights)errors.push('No skinned weighted human geometry');
 if(triangles===0||triangles>maxTriangles)errors.push('Triangle budget '+triangles+'/'+maxTriangles);
 if(boneNames.size!==24)errors.push('Expected 24 source joints, got '+boneNames.size);
 if(materials.size>6)errors.push('Too many materials '+materials.size);
 return {ok:errors.length===0,triangles,meshes,skins,bones:boneNames.size,materials:materials.size,sourceFingerWeights:false,errors};
}

/** Reuse the user's existing skinned geometry but drive it using the City
 * of God Reborn motion library. Bone names are compatible; rest quaternions
 * differ, so motions MUST be rebased for each individual character.
 * The extra 52 procedural finger joints are added on a cloned instance
 * by createRebornUpperBodyMotion, after rigged geometry has been cloned.
 */
export async function loadStreetCrownAssets(loader,reborn,{base=STREET_CROWN_DIR}={}){
 if(!reborn?.get('male')||!reborn?.get('female'))throw Error('Reborn motion library required');
 const models=new Map();
 for(const spec of Object.values(STREET_CROWN_MODELS)){
  const gltf=await loader.loadAsync(base+spec.id+'.glb');
  const qa=inspectStreetCrown(gltf);
  if(!qa.ok)throw Error(spec.id+' rejected: '+qa.errors.join('; '));
  const template=reborn.get(spec.sex);
  const idle=gltf.animations?.[0]?.clone()||template.gltf.animations[0].clone();
  idle.name='idle';
  const clips=[idle];
  for(const name of ['walk','run','jump_air']){
   const source=template.gltf.animations.find(x=>x.name===name);
   if(!source)throw Error('Reborn motion '+name+' unavailable');
   clips.push(normalizeRebornClip(source,template.gltf.scene,gltf.scene,name,{inPlace:true}));
  }
  for(const name of ['jump_start','jump_land']){
   const copy=clips.find(x=>x.name==='jump_air').clone();
   copy.name=name;clips.push(copy);
  }
  const semantics=Object.fromEntries(clips.map(clip=>[clip.name,{
   name:clip.name,duration:clip.duration,
   loop:!['jump_start','jump_land'].includes(clip.name),
   speed:clip.name==='walk'?1.6:clip.name==='run'?4.2:0
  }]));
  models.set(spec.id,{gltf:{...gltf,animations:clips},spec:{
   ...spec,rig:'city-of-god-reborn-76-runtime',
   bones:24,triangles:qa.triangles,clips:semantics,
   source:'Street Crown user-supplied GLB'
  },quality:qa});
 }
 return models;
}
