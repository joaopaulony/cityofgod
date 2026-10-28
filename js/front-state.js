(function(root){
 'use strict';
 const SETTINGS='cityofgod.front.settings.v1',SAVE='cityofgod.front.save.v1',BACKUP='cityofgod.front.backup.v1';
 const defaults={quality:'balanced',brightness:1,music:.35,effects:.8,master:.75,reducedMotion:false};
 const cap=(v,a,b,f)=>Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):f;
 function settings(raw){return {...defaults,quality:['low','balanced','high'].includes(raw?.quality)?raw.quality:defaults.quality,
  brightness:cap(raw?.brightness,.75,1.3,1),music:cap(raw?.music,0,1,.35),effects:cap(raw?.effects,0,1,.8),master:cap(raw?.master,0,1,.75),reducedMotion:typeof raw?.reducedMotion==='boolean'?raw.reducedMotion:false};}
 function checkpoint(raw){
  if(raw?.version!==1||!['open','local'].includes(raw.mode)||![raw.x,raw.y,raw.seed,raw.clock].every(Number.isFinite)||raw.x<.5||raw.y<.5||raw.seed<0||raw.clock<0||!Number.isInteger(raw.floor)||raw.floor<0||raw.floor>19)return null;
  return {version:1,mode:raw.mode,seed:raw.seed,x:raw.x,y:raw.y,floor:raw.floor,clock:raw.clock,at:Number.isFinite(raw.at)?raw.at:0};
 }
 function read(storage,key,fallback=null){try{return JSON.parse(storage.getItem(key))??fallback;}catch{return fallback;}}
 function hasProgress(storage){const life=read(storage,'cityofgod.life.v1');return !!checkpoint(read(storage,SAVE))||!!(life?.v===1&&Number.isFinite(life.funds));}
 function backupAndReset(storage){
  const rows={};
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith('cityofgod.')&&key!==SETTINGS&&key!==BACKUP)rows[key]=storage.getItem(key);}
  // Write and verify the backup before removing any existing progress.
  const backup=JSON.stringify({version:1,at:Date.now(),rows});storage.setItem(BACKUP,backup);
  if(storage.getItem(BACKUP)!==backup)throw Error('Não foi possível preservar uma cópia do progresso');
  for(const key of Object.keys(rows))storage.removeItem(key);
  return Object.keys(rows).length;
 }
 const api={SETTINGS,SAVE,BACKUP,defaults,settings,checkpoint,read,hasProgress,backupAndReset};
 root.CityFrontState=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
