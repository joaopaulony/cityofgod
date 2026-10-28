import {CAS_DEFAULT,CAS_KEY,normalizeCAS,readCAS,writeCAS} from './cas-profile.mjs';

export const ROSTER_KEY='cityofgod.cas.roster.v1';
export const MAX_CHARACTERS=3;
const cleanId=id=>typeof id==='string'&&/^character-[a-z0-9-]{1,50}$/.test(id)?id:null;
const candidate=(profile,id)=>({id,profile:normalizeCAS(profile)});
export function normalizeRoster(raw,fallback=null){
 const entries=[];
 if(raw&&Array.isArray(raw.characters)){
  for(const item of raw.characters){
   const id=cleanId(item?.id);
   if(id&&!entries.some(x=>x.id===id)&&entries.length<MAX_CHARACTERS)entries.push(candidate(item.profile,id));
  }
 }
 if(!entries.length&&fallback)entries.push(candidate(fallback,'character-legacy'));
 let activeId=cleanId(raw?.activeId);
 if(!entries.some(x=>x.id===activeId))activeId=entries[0]?.id||null;
 return {schema:1,activeId,characters:entries};
}
export function readRoster(storage){
 let raw=null,legacy=null;
 try{raw=JSON.parse(storage.getItem(ROSTER_KEY)||'null');}catch{}
 try{legacy=readCAS(storage);}catch{}
 const roster=normalizeRoster(raw,legacy);
 // A save from another game session might have updated only the legacy key.
 // Prefer the canonical active CAS profile for the selected local character.
 if(legacy&&roster.activeId){
  const active=roster.characters.find(x=>x.id===roster.activeId);
  if(active)active.profile=legacy;
 }
 return roster;
}
function newId(roster){
 for(let n=0;n<1000;n++){
  const id='character-'+Date.now().toString(36)+'-'+n.toString(36);
  if(!roster.characters.some(x=>x.id===id))return id;
 }
 throw Error('Limite de identificadores atingido');
}
export function addCharacter(roster,profile=CAS_DEFAULT){
 const clean=normalizeRoster(roster);
 if(clean.characters.length>=MAX_CHARACTERS)throw Error('Máximo de três personagens neste navegador.');
 const id=newId(clean);
 clean.characters.push(candidate(profile,id));
 clean.activeId=id;
 return clean;
}
export function updateCharacter(roster,profile){
 const clean=normalizeRoster(roster);
 if(!clean.activeId)return addCharacter(clean,profile);
 const entry=clean.characters.find(x=>x.id===clean.activeId);
 if(!entry)throw Error('Personagem selecionado não encontrado');
 entry.profile=normalizeCAS(profile);
 return clean;
}
export function selectCharacter(roster,id){
 const clean=normalizeRoster(roster);
 if(!clean.characters.some(x=>x.id===id))throw Error('Personagem selecionado não encontrado');
 clean.activeId=id;
 return clean;
}
export function deleteCharacter(roster,id){
 const clean=normalizeRoster(roster);
 clean.characters=clean.characters.filter(x=>x.id!==id);
 if(clean.activeId===id)clean.activeId=clean.characters[0]?.id||null;
 return clean;
}
export function activeCharacter(roster){
 const item=normalizeRoster(roster);
 return item.characters.find(x=>x.id===item.activeId)?.profile||null;
}
export function persistRoster(storage,roster){
 const clean=normalizeRoster(roster);
 // The v1 save is the compatibility source for the current runtime.
 const active=clean.characters.find(x=>x.id===clean.activeId);
 if(!active)throw Error('Nenhum personagem selecionado');
 writeCAS(storage,active.profile);
 storage.setItem(ROSTER_KEY,JSON.stringify(clean));
 return clean;
}
