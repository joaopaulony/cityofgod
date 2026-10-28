import {normalizeRebornClip} from './cas-reborn.mjs';

// The original 2026-10-28 reset remains the default. This loader only accepts
// new, explicitly approved, model-backed GLBs; never reactivates legacy humans.
export const REALISTIC_DIR='assets/characters/realistic/';
const MAX_TRIS=12000;
export function checkRealisticGltf(gltf){
 const errors=[];let triangles=0,skins=0,materials=new Set();
 const bones=new Set(),hands={left:0,right:0};
 gltf.scene.traverse(o=>{
  if(o.isSkinnedMesh){
   skins++;
   for(const b of o.skeleton?.bones||[])bones.add(b.name);
  }
  if(o.isMesh){
   const indexCount=o.geometry?.index?.count||o.geometry?.attributes?.position?.count||0;
   triangles+=Math.floor(indexCount/3);
   for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);
  }
 });
 for(const name of bones){
  if(!/thumb|index|middle|ring|pinky|little|finger/i.test(name))continue;
  if(/left|(^|[^a-z])l[_. -]?/i.test(name))hands.left++;
  if(/right|(^|[^a-z])r[_. -]?/i.test(name))hands.right++;
 }
 if(!skins)errors.push('missing SkinnedMesh');
 if(bones.size<55)errors.push('rig has only '+bones.size+' bones, requires >=55');
 if(hands.left<10||hands.right<10)errors.push('individual finger bones missing: '+JSON.stringify(hands));
 if(triangles===0||triangles>MAX_TRIS)errors.push('triangle budget exceeded: '+triangles+'/'+MAX_TRIS);
 if(materials.size>12)errors.push('materials count excessive: '+materials.size);
 return {ok:!errors.length,errors,triangles,bones:bones.size,hands,skins,materials:materials.size};
}
export async function loadApprovedHumans(loader,{base=REALISTIC_DIR}={}){
 const response=await fetch(base+'manifest.json',{cache:'no-store'});
 if(!response.ok)throw Error('Approved humans manifest: HTTP '+response.status);
 const data=await response.json();
 if(data.schema!==1||data.approved!==true||!Array.isArray(data.models)||data.models.length!==2)
  throw Error('Human models not yet approved');
 const result=new Map();
 for(const sex of ['male','female']){
  const model=data.models.find(m=>m.sex===sex);
  if(!model||!/^[a-z0-9-]+\.glb$/.test(model.file))throw Error('Invalid '+sex+' model declaration');
  const gltf=await loader.loadAsync(base+model.file);
  const quality=checkRealisticGltf(gltf);
  if(!quality.ok)throw Error(sex+' rejected: '+quality.errors.join('; '));
  if(!gltf.animations?.length)throw Error(sex+' model lacks motion clip');
  const animations=[];
  const modelClips=Array.isArray(model.animations)?model.animations:[];
  for(const entry of modelClips){
   if(!['idle','walk','run','jump_air'].includes(entry.name)||!/^[a-z0-9-]+\.glb$/.test(entry.file))throw Error('Invalid animation entry');
   let asset=entry.file===model.file?gltf:await loader.loadAsync(base+entry.file);
   if(!asset.animations?.length)throw Error('No clip in '+entry.file);
   const clip=normalizeRebornClip(asset.animations[0],asset.scene,gltf.scene,entry.name,{inPlace:true});
   animations.push(clip);
  }
  // Do not manufacture a run or idle from a Walk clip: stiff poses are a regression.
  for(const name of ['idle','walk','run'])if(!animations.some(c=>c.name===name))throw Error(sex+' missing '+name+' animation');
  const clips=Object.fromEntries(animations.map(clip=>[clip.name,{name:clip.name,duration:clip.duration,loop:clip.name!=='jump_air',speed:clip.name==='walk'?1.6:clip.name==='run'?4.0:0}]));
  result.set(sex,{gltf:{...gltf,animations},spec:{id:'gta-realistic-'+sex,sex,rig:'realistic',source:'Higgsfield/Meshy approved GLB',triangles:quality.triangles,bones:quality.bones,clips},quality});
 }
 return result;
}
