// CAS profile is deliberately engine-independent so it can be tested in Node.
export const CAS_KEY='cityofgod.cas.skeleton.v2';
export const CAS_DEFAULT=Object.freeze({
 version:1,name:'Alex',age:24,sex:'male',height:1,build:1,background:'bairro',style:'casual',
 skin:'#c98d68',hair:'#30231e',hairStyle:'none',top:'#49647a',bottom:'#29394f',shoes:'#e9e6e0',
 outfit:'casual',accessory:'none',accessoryColor:'#25282a',faceWidth:0,jaw:0,nose:0,eyes:0,cheeks:0
});
export const CAS_COLORS=Object.freeze({
 skin:['#edc6a4','#c98d68','#aa7050','#80533e','#4a3027'],
 hair:['#241916','#573a28','#a57642','#d1b178','#171b22'],
 top:['#49647a','#874942','#58705b','#d5bf95','#282e38'],
 bottom:['#29394f','#262629','#686254','#a6a4a0','#3c4c62']
});
const COLOR=/^#[0-9a-f]{6}$/i;
const clamp=(x,min,max,fallback)=>Number.isFinite(Number(x))?Math.max(min,Math.min(max,Number(x))):fallback;
export function normalizeCAS(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))input={};
 const result={...CAS_DEFAULT};
 result.name=String(input.name??result.name).replace(/[<>]/g,'').trim().slice(0,24)||CAS_DEFAULT.name;
 result.sex=input.sex==='female'?'female':'male';
 result.age=Math.round(clamp(input.age,18,80,24));
 result.background=['bairro','centro','litoral','interior'].includes(input.background)?input.background:'bairro';
 result.style=['casual','esportivo','urbano','social'].includes(input.style)?input.style:'casual';
 result.height=clamp(input.height,.90,1.10,1);
 result.build=clamp(input.build,.86,1.14,1);
 result.outfit=['casual','street','sport','social'].includes(input.outfit)?input.outfit:'casual';
 result.accessory=['none','glasses','cap','beanie'].includes(input.accessory)?input.accessory:'none';
 for(const key of ['faceWidth','jaw','nose','eyes','cheeks'])result[key]=clamp(input[key],-1,1,0);
 result.hairStyle=/^hair-(?:0[1-9]|1[0-9]|2[01])$/.test(String(input.hairStyle||''))?input.hairStyle:'none';
 for(const key of ['skin','hair','top','bottom','shoes','accessoryColor'])if(COLOR.test(input[key]||''))result[key]=input[key].toLowerCase();
 return result;
}
export function readCAS(storage){
 try{const stored=storage.getItem(CAS_KEY);return stored?normalizeCAS(JSON.parse(stored)):null;}catch{return null;}
}
export function writeCAS(storage,profile){storage.setItem(CAS_KEY,JSON.stringify(normalizeCAS(profile)));}
export function validateCASManifest(input){
 if(!input||input.schema!==1||!Array.isArray(input.models))throw Error('CAS: manifest schema 1 esperado');
 const sexes=new Set(),models=[];
 for(const model of input.models){
  if(!model||!['male','female'].includes(model.sex)||sexes.has(model.sex))throw Error('CAS: sexo duplicado/inválido');
  if(typeof model.file!=='string'||!/^[a-z0-9][a-z0-9_-]*\.glb$/i.test(model.file))throw Error('CAS: nome GLB inseguro');
  if(!['mixamo','generic'].includes(model.rig))throw Error('CAS: rig inválido');
  if(model.materialSlots!=null && (typeof model.materialSlots!=='object'||Array.isArray(model.materialSlots)))throw Error('CAS: materialSlots inválidos');
  const materialSlots={};
  for(const key of ['skin','hair','top','bottom']){
   const names=model.materialSlots?.[key]||[];
   if(!Array.isArray(names)||!names.every(n=>typeof n==='string'&&n.length>0&&n.length<100))throw Error('CAS: slot inválido');
   materialSlots[key]=names;
  }
  if(model.clips!=null && (typeof model.clips!=='object'||Array.isArray(model.clips)))throw Error('CAS: clipes inválidos');
  sexes.add(model.sex);
  models.push({sex:model.sex,file:model.file,rig:model.rig,materialSlots,clips:model.clips||{}});
 }
 return models;
}
