// CAS profile is deliberately engine-independent so it can be tested in Node.
export const CAS_KEY='cityofgod.cas.skeleton.v2';
export const CAS_DEFAULT=Object.freeze({
 version:1,name:'Alex',age:24,sex:'male',height:1,build:1,background:'bairro',style:'casual',
 // peças modulares (js/modular-characters.mjs): '' = peça padrão do sexo; cores '' = cor original da peça
 head:'',body:'',legs:'',feet:'',acc:'',tints:Object.freeze({}),
 skin:'#b98059',hair:'',hairStyle:'none',top:'',bottom:'',shoes:'',
 outfit:'casual',accessory:'none',accessoryColor:'#25282a',faceWidth:0,jaw:0,nose:0,eyes:0,cheeks:0,look:''
});
export const CAS_COLORS=Object.freeze({
 skin:['#f3d5bd','#e6bc98','#d2a47c','#b98059','#94603f','#6e4430','#4a2d20'],
 hair:['#1c1716','#3a2619','#5c3b22','#8a5a32','#b8874f','#dcc28c','#8f8f8f','#e9e4dc','#8e2b22','#5b2d6e'],
 top:['#1f2329','#e8e4dc','#2e4a6b','#6b2c2c','#a23b2f','#2f5d3a','#c2a36b','#8a5a8a','#d98a2b'],
 bottom:['#1f2329','#3a3f47','#2e4a6b','#4a6a8a','#6b6b3a','#c2a36b'],
 shoes:['#1f2329','#e8e4dc','#a23b2f','#2e4a6b','#6b4a2c']
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
 // visual pronto escolhido no CAS: id de um personagem de assets/characters/modular/roster.json
 result.look=/^[a-z0-9][a-z0-9-]{1,40}$/.test(String(input.look||''))?String(input.look):'';
 result.hairStyle=/^hair-(?:0[1-9]|1[0-9]|2[01])$/.test(String(input.hairStyle||''))?input.hairStyle:'none';
 for(const key of ['skin','hair','top','bottom','shoes','accessoryColor'])if(COLOR.test(input[key]||''))result[key]=input[key].toLowerCase();
  else if(key!=='skin'&&key!=='accessoryColor'&&input[key]==='')result[key]='';   // '' = cor original da peça
 // peças (ids de assets/characters/modular/manifest.json; validados contra o manifesto no jogo)
 for(const key of ['head','body','legs','feet','acc'])result[key]=/^[a-z0-9_]{1,40}$/.test(String(input[key]||''))?String(input[key]):'';
 // cores por parte da roupa: {encaixe:{material:'#rrggbb'}} (validado contra a peça no jogo)
 result.tints={};
 if(input.tints&&typeof input.tints==='object'&&!Array.isArray(input.tints))for(const slot of ['head','body','legs','feet','acc']){
  const t=input.tints[slot];if(!t||typeof t!=='object'||Array.isArray(t))continue;
  for(const [name,color] of Object.entries(t).slice(0,12))if(/^[A-Za-z0-9_ .-]{1,40}$/.test(name)&&COLOR.test(color||''))(result.tints[slot]||(result.tints[slot]={}))[name]=String(color).toLowerCase();
 }
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
