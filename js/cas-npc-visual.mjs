import * as THREE from 'three';
import {applyAccessories} from './cas-studio.mjs';

// Beta: one Reborn skinned mesh contains skin and clothing in a shared texture.
// Vertex masks derived from rig weights let us tint broad regions while keeping
// the original fabric detail and without copying geometry per resident.
const zone=(name)=>{
 if(/(?:Foot|Toe)/i.test(name))return 3;
 if(/(?:Head|neck|Hand|ForeArm)/i.test(name))return 0;
 if(/(?:Shoulder|Spine|Arm)/i.test(name))return 1;
 if(/(?:UpLeg|Leg|Hips)/i.test(name))return 2;
 return 0;
};
export function setNPCRegions(mesh){
 const geometry=mesh?.geometry;
 if(!mesh?.isSkinnedMesh||!geometry?.attributes.skinIndex||!geometry?.attributes.skinWeight)return false;
 if(geometry.getAttribute('npcRegions'))return true;
 const ind=geometry.getAttribute('skinIndex'),weight=geometry.getAttribute('skinWeight');
 const values=new Float32Array(ind.count*4);
 for(let i=0;i<ind.count;i++){
  const indices=[ind.getX(i),ind.getY(i),ind.getZ(i),ind.getW(i)];
  const w=[weight.getX(i),weight.getY(i),weight.getZ(i),weight.getW(i)];
  for(let k=0;k<4;k++){
   const bone=mesh.skeleton.bones[indices[k]];
   if(bone&&w[k]>0)values[i*4+zone(bone.name)]+=w[k];
  }
  const sum=values[i*4]+values[i*4+1]+values[i*4+2]+values[i*4+3];
  if(sum<.0001)values[i*4]=1;
  else for(let k=0;k<4;k++)values[i*4+k]/=sum;
 }
 geometry.setAttribute('npcRegions',new THREE.Float32BufferAttribute(values,4));
 return true;
}
export function createNPCPaletteMaterial(material,profile){
 const result=material.clone();
 const uniforms={
  npcSkin:{value:new THREE.Color(profile.skin)},
  npcTop:{value:new THREE.Color(profile.top)},
  npcBottom:{value:new THREE.Color(profile.bottom)},
  npcShoes:{value:new THREE.Color(profile.shoes)},
 };
 result.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nattribute vec4 npcRegions;\nvarying vec4 vNPCRegions;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvNPCRegions=npcRegions;');
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>','#include <common>\nvarying vec4 vNPCRegions;\nuniform vec3 npcSkin;\nuniform vec3 npcTop;\nuniform vec3 npcBottom;\nuniform vec3 npcShoes;')
   .replace('#include <map_fragment>','#include <map_fragment>\nvec4 m=clamp(vNPCRegions,0.0,1.0);\nvec3 npcTint=(npcSkin*m.x+npcTop*m.y+npcBottom*m.z+npcShoes*m.w)/max(m.x+m.y+m.z+m.w,0.01);\nfloat baseLum=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));\nvec3 recolored=npcTint*(0.64+baseLum*1.28);\nfloat tintStrength=clamp(m.x*0.58+m.y*0.94+m.z*0.90+m.w*0.92,0.0,0.95);\ndiffuseColor.rgb=mix(diffuseColor.rgb,recolored,tintStrength);');
 };
 result.customProgramCacheKey=()=> 'CityPopulationMaterialV2';
 result.needsUpdate=true;
 return result;
}
export function applyNPCVisual(root,profile){
 if(!root||!profile)return {regionMeshes:0};
 let regionMeshes=0;
 root.traverse(node=>{
  if(!node.isSkinnedMesh||!setNPCRegions(node))return;
  node.material=Array.isArray(node.material)?
   node.material.map(mat=>createNPCPaletteMaterial(mat,profile)):
   createNPCPaletteMaterial(node.material,profile);
  node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;
  regionMeshes++;
 });
 if(profile.headwear!=='none'){
  applyAccessories(root,{accessory:profile.headwear,accessoryColor:profile.accent});
 }
 const width=Number(profile.build)||1,height=Number(profile.height)||1;
 root.userData.populationBaseScale=root.scale.clone();
 root.scale.set(root.scale.x*width,root.scale.y*height,root.scale.z*width);
 return {regionMeshes};
}
