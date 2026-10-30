// npc-roster.mjs — os personagens do autor (assets/npcs, gerados por tools/rig-npcs.mjs) com as animações Mixamo de
// sempre (David p/ homens, Megan p/ mulheres): parado, andar, correr, rifle (mirar, atirar, recarregar, andar mirando),
// agachar, pular e escalar. Cada GLB já está no esqueleto Mixamo com as mesmas rotações de repouso das bibliotecas,
// então os clipes só precisam do ajuste de altura do quadril (retargetMixamo, abaixo).

export const NPC_DIR='assets/npcs/';
export const MIXAMO_LIBRARY=Object.freeze({male:'assets/characters/rigs/mixamo/david.rig.glb',female:'assets/characters/rigs/mixamo/megan.rig.glb'});
// papel no jogo: 'player' (bases principais), 'civil' e 'gang' andam pela rua; 'service' e 'worker' só em ocorrências
export const STREET_ROLES=Object.freeze(['civil','gang']);
export const DEFAULT_LOOK=Object.freeze({male:'miguel',female:'char-principal-base'});
const ONE_SHOT=new Set(['jump_start','jump_land','vault_low','rifle_fire','rifle_reload','rifle_crouch_fire','rifle_crouch_reload']);
const SPEED={walk:1.5,run:4.2,rifle_walk:1.4,rifle_run:3.9,rifle_walk_back:1.2,rifle_strafe_left:1.3,rifle_strafe_right:1.3,crouch_walk:.9,rifle_crouch_walk:.9};
const GROUP_LABEL={base:'Personagem principal','last-kings':'Last Kings','novelis-crew':"Noveli's Crew",urbano:'Morador',policia:'Polícia',bombeiros:'Bombeiros',socorristas:'Socorristas',operarios:'Operário',motoboy:'Motoboy'};
export const groupLabel=g=>GROUP_LABEL[g]||g;

// As rotações dos clipes Mixamo são a pose final de cada osso e valem como estão: o repouso dos personagens é pose A
// (braços baixos), o que só reduz o quanto a malha precisa girar. Só o quadril muda: fica no lugar (sem andar pelo
// clipe) e na altura do quadril de cada personagem.
export function retargetMixamo(clip,sourceRoot,targetRoot,name=clip.name){
 const result=clip.clone();result.name=name;
 const from=sourceRoot.getObjectByName('mixamorigHips'),to=targetRoot.getObjectByName('mixamorigHips');
 result.tracks=result.tracks.filter(track=>{
  const m=track.name.match(/^([^.]+)\.(quaternion|position|scale)$/);if(!m)return false;
  if(m[2]==='scale')return false;
  if(m[2]==='position'){
   if(m[1]!=='mixamorigHips'||!from||!to)return false;
   const v=track.values;
   for(let i=0;i<v.length;i+=3){v[i]=to.position.x;v[i+1]=to.position.y+v[i+1]-from.position.y;v[i+2]=to.position.z;}
  }
  return !!targetRoot.getObjectByName(m[1]);
 });
 result.resetDuration();return result;
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
