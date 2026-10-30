// npc-roster.mjs — os personagens do autor (assets/npcs, gerados por tools/rig-npcs.mjs) com as animações Mixamo de
// sempre (David p/ homens, Megan p/ mulheres): parado, andar, correr, rifle (mirar, atirar, recarregar, andar mirando),
// agachar, pular e escalar. Cada GLB já está no esqueleto Mixamo com as mesmas rotações de repouso das bibliotecas,
// então os clipes só precisam do ajuste de altura do quadril (retargetMixamo, abaixo).
import * as THREE from 'three';

export const NPC_DIR='assets/npcs/';
export const MIXAMO_LIBRARY=Object.freeze({male:'assets/characters/rigs/mixamo/david.rig.glb',female:'assets/characters/rigs/mixamo/megan.rig.glb'});
// papel no jogo: 'player' (bases principais), 'civil' e 'gang' andam pela rua; 'service' e 'worker' só em ocorrências
export const STREET_ROLES=Object.freeze(['civil','gang']);
export const DEFAULT_LOOK=Object.freeze({male:'miguel',female:'char-principal-base'});
const ONE_SHOT=new Set(['jump_start','jump_land','vault_low','rifle_fire','rifle_reload','rifle_crouch_fire','rifle_crouch_reload']);
const SPEED={walk:1.5,run:4.2,rifle_walk:1.4,rifle_run:3.9,rifle_walk_back:1.2,rifle_strafe_left:1.3,rifle_strafe_right:1.3,crouch_walk:.9,rifle_crouch_walk:.9};
const GROUP_LABEL={base:'Personagem principal','last-kings':'Last Kings','novelis-crew':"Noveli's Crew",urbano:'Morador',policia:'Polícia',bombeiros:'Bombeiros',socorristas:'Socorristas',operarios:'Operário',motoboy:'Motoboy'};
export const groupLabel=g=>GROUP_LABEL[g]||g;

// Repouso de cada osso: rotação/posição locais e rotação de mundo (relativa à Armature). No personagem vem do bind da
// malha (não muda depois que um clipe roda); na biblioteca Mixamo, dos próprios ossos (ela nunca é animada).
export function restPose(root,{fromBind=true}={}){
 root.updateMatrixWorld(true);
 let mesh=null;if(fromBind)root.traverse(o=>{if(o.isSkinnedMesh&&!mesh)mesh=o;});
 const hips=root.getObjectByName('mixamorigHips');if(!hips)return null;
 const toMesh=mesh?mesh.matrixWorld.clone().invert():new THREE.Matrix4(),armature=toMesh.clone().multiply(hips.parent.matrixWorld),armInv=armature.clone().invert();
 const worldM=new Map();
 if(mesh)mesh.skeleton.bones.forEach((b,k)=>worldM.set(b,mesh.bindMatrix.clone().multiply(mesh.skeleton.boneInverses[k].clone().invert())));
 const bones=[],out=new Map(),t=new THREE.Vector3(),s=new THREE.Vector3();
 hips.traverse(o=>{if(o.isBone)bones.push(o);});
 for(const b of bones){
  const w=worldM.get(b)||toMesh.clone().multiply(b.matrixWorld),pw=b===hips?armature:(worldM.get(b.parent)||toMesh.clone().multiply(b.parent.matrixWorld));
  const q=new THREE.Quaternion(),p=new THREE.Vector3(),wq=new THREE.Quaternion();
  pw.clone().invert().multiply(w).decompose(p,q,s);armInv.clone().multiply(w).decompose(t,wq,s);
  out.set(b.name,{bone:b,parent:b===hips?null:b.parent.name,q:q.normalize(),p,world:wq.normalize()});
 }
 return out;
}

// Retarget por variação: cada osso do personagem recebe a ROTAÇÃO QUE O OSSO DA BIBLIOTECA FEZ a partir do repouso dela
// (pose T), aplicada em cima do repouso do personagem (também pose T, na anatomia da malha):
//   mundo_personagem(t) = mundo_biblioteca(t) · mundo_biblioteca(repouso)⁻¹ · mundo_personagem(repouso)
// Assim a coluna, o pescoço e as clavículas mantêm a curvatura e as proporções da própria malha — antes as rotações
// locais do David/Megan eram copiadas como estavam e forçavam cada malha na postura do esqueleto genérico.
// Translações: só a do quadril, no lugar (sem andar pelo clipe), com a variação de altura na escala do personagem.
// Amortecimento (fração da rotação de cada osso em relação ao pai que passa p/ o personagem): a pose T do Mixamo tem
// as clavículas erguidas e o clipe as abaixa ~25° — passado inteiro, isso afunda e comprime ombro e peito; o braço
// continua na direção exata do clipe (mão e rifle no mesmo lugar). No parado, quadril, coluna, pescoço e cabeça só
// respiram e balançam de leve.
export const DAMP={all:{LeftShoulder:0.35,RightShoulder:0.35},idle:{Hips:0.35,Spine:0.35,Spine1:0.35,Spine2:0.35,Neck:0.35,Head:0.35}};
export function retargetMixamo(clip,sourceRoot,targetRoot,name=clip.name){
 const src=sourceRoot.userData.restPose||=restPose(sourceRoot,{fromBind:false}),dst=targetRoot.userData.restPose||=restPose(targetRoot);
 if(!src||!dst)return clip;
 const tracks={},hipsPos=clip.tracks.find(t=>t.name==='mixamorigHips.position');
 for(const t of clip.tracks){const m=t.name.match(/^(\w+)\.quaternion$/);if(m&&dst.has(m[1])&&src.has(m[1]))tracks[m[1]]=t.createInterpolant();}
 const times=[...new Set(clip.tracks.filter(t=>/\.quaternion$/.test(t.name)).flatMap(t=>[...t.times]))].sort((a,b)=>a-b);if(!times.length)times.push(0);
 const names=[...dst.keys()].filter(n=>src.has(n)),out=Object.fromEntries(names.map(n=>[n,new Float32Array(times.length*4)]));
 const ws=new Map(),wt=new Map(),dl=new Map(),de=new Map(),inv0=new Map(names.map(n=>[n,src.get(n).world.clone().invert()]));
 const damp=Object.assign({},DAMP.all,DAMP[clip.name]),I=new THREE.Quaternion();
 times.forEach((t,i)=>{
  for(const n of names){
   const S=src.get(n),D=dst.get(n),l=tracks[n]?new THREE.Quaternion().fromArray(tracks[n].evaluate(t)):S.q;
   const w=S.parent&&ws.has(S.parent)?ws.get(S.parent).clone().multiply(l):l.clone();ws.set(n,w);
   // variação de mundo do osso; nos ossos amortecidos, só uma fração da variação relativa ao pai
   const d=w.clone().multiply(inv0.get(n)),k=damp[n.replace('mixamorig','')];dl.set(n,d);
   let e=d;
   if(k!=null){const pd=S.parent&&dl.has(S.parent)?dl.get(S.parent):I,pe=S.parent&&de.has(S.parent)?de.get(S.parent):I;e=pe.clone().multiply(new THREE.Quaternion().slerp(pd.clone().invert().multiply(d),k));}
   de.set(n,e);
   const w2=e.clone().multiply(D.world);wt.set(n,w2);
   const q=D.parent&&wt.has(D.parent)?wt.get(D.parent).clone().invert().multiply(w2):w2.clone();q.normalize();
   const o=out[n];if(i&&q.x*o[i*4-4]+q.y*o[i*4-3]+q.z*o[i*4-2]+q.w*o[i*4-1]<0)q.set(-q.x,-q.y,-q.z,-q.w);q.toArray(o,i*4);
  }
 });
 const result=new THREE.AnimationClip(name,clip.duration,names.map(n=>new THREE.QuaternionKeyframeTrack(n+'.quaternion',times,out[n])));
 if(hipsPos){
  const S=src.get('mixamorigHips'),D=dst.get('mixamorigHips'),k=D.p.y/S.p.y,v=hipsPos.values.slice();
  for(let i=0;i<v.length;i+=3){v[i]=D.p.x;v[i+1]=D.p.y+(v[i+1]-S.p.y)*k;v[i+2]=D.p.z;}
  result.tracks.push(new THREE.VectorKeyframeTrack('mixamorigHips.position',hipsPos.times.slice(),v));
 }
 return result;
}

export function clipSemantics(clips){
 return Object.fromEntries(clips.map(c=>[c.name,{name:c.name,duration:c.duration,loop:!ONE_SHOT.has(c.name),speed:SPEED[c.name]||0}]));
}

export async function loadRoster(loader,{base=''}={}){
 const response=await fetch(base+NPC_DIR+'roster.json');
 if(!response.ok)throw Error('Roster dos personagens: '+response.status);
 const doc=await response.json();
 if(!Array.isArray(doc.characters)||!doc.characters.length)throw Error('Roster vazio');
 const libraries={};
 for(const sex of ['male','female']){
  const gltf=await loader.loadAsync(base+MIXAMO_LIBRARY[sex]);
  if(gltf.animations.length<10)throw Error('Biblioteca Mixamo '+sex+' incompleta');
  libraries[sex]=gltf;
 }
 const characters=new Map(doc.characters.map(c=>[c.id,c]));
 const cache=new Map();
 // carrega um personagem sob demanda (os 52 não ficam na memória ao mesmo tempo)
 async function load(id){
  const meta=characters.get(id);if(!meta)throw Error('Personagem desconhecido: '+id);
  if(!cache.has(id))cache.set(id,(async()=>{
   const gltf=await loader.loadAsync(base+NPC_DIR+meta.file),lib=libraries[meta.sex];
   let bones=0,meshes=0;gltf.scene.traverse(o=>{if(o.isBone)bones++;if(o.isSkinnedMesh){meshes++;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
   if(!meshes||!gltf.scene.getObjectByName('mixamorigHips'))throw Error(id+': GLB sem malha riggada no esqueleto Mixamo');
   const animations=lib.animations.map(c=>retargetMixamo(c,lib.scene,gltf.scene));
   return {gltf:{...gltf,animations},spec:{...meta,label:meta.name,bones,meshes,clips:clipSemantics(animations),rig:'mixamo'}};
  })());
  try{return await cache.get(id);}catch(error){cache.delete(id);throw error;}
 }
 const list=role=>[...characters.values()].filter(c=>!role||c.role===role);
 return {characters,load,list,libraries};
}
