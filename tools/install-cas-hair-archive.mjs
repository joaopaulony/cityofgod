// Install one ZIP of licensed hairstyle GLBs during build; no npm dependencies.
// Source: third_party/cityofgod_21_cabelos_glb.zip
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {inflateRawSync} from 'node:zlib';
const source=resolve('third_party/cityofgod_cas_corpo_feminino_21_cabelos.zip');
if(!existsSync(source)){
 console.log('CAS hair: optional 21-GLB archive not installed (character editor remains available).');
 process.exit(0);
}
const zip=readFileSync(source);
if(zip.length>30000000)throw Error('CAS hair: ZIP acima de 30 MB');
let end=-1;
for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--){
 if(zip.readUInt32LE(i)===0x06054b50){end=i;break;}
}
if(end<0)throw Error('CAS hair: ZIP sem diretório central');
const count=zip.readUInt16LE(end+10);
let cursor=zip.readUInt32LE(end+16);
const entries=new Map();
for(let i=0;i<count;i++){
 if(zip.readUInt32LE(cursor)!==0x02014b50)throw Error('CAS hair: diretório central inválido');
 const method=zip.readUInt16LE(cursor+10),packed=zip.readUInt32LE(cursor+20),
  unpacked=zip.readUInt32LE(cursor+24),nameLen=zip.readUInt16LE(cursor+28),
  extraLen=zip.readUInt16LE(cursor+30),commentLen=zip.readUInt16LE(cursor+32),
  local=zip.readUInt32LE(cursor+42),
  name=zip.subarray(cursor+46,cursor+46+nameLen).toString('utf8');
 cursor+=46+nameLen+extraLen+commentLen;
 if(!/^assets\/characters\/(?:hair\/(?:manifest\.json|hair-(?:0[1-9]|1[0-9]|2[01])\.glb)|cas\/(?:female-vincent\.glb|manifest\.json))$/.test(name))continue;
 if(local+30>zip.length||zip.readUInt32LE(local)!==0x04034b50)throw Error('CAS hair: cabeçalho ZIP inválido');
 const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);
 if(start+packed>zip.length||unpacked>5000000)throw Error('CAS hair: arquivo muito grande ou truncado');
 const part=zip.subarray(start,start+packed);
 const raw=method===0?part:method===8?inflateRawSync(part):null;
 if(!raw||raw.length!==unpacked)throw Error('CAS hair: método ZIP não suportado ou tamanho inválido');
 if(entries.has(name))throw Error('CAS hair: entrada duplicada');
 entries.set(name,raw);
}
const prefix='assets/characters/hair/';
const manifestRaw=entries.get(prefix+'manifest.json');
if(!manifestRaw)throw Error('CAS hair: manifesto ausente no ZIP');
const manifest=JSON.parse(manifestRaw.toString('utf8'));
if(manifest.schema!==1||!Array.isArray(manifest.styles)||manifest.styles.length!==21)throw Error('CAS hair: catálogo diferente de 21 penteados');
for(let i=1;i<=21;i++){
 const id='hair-'+String(i).padStart(2,'0');
 const file=id+'.glb';
 const item=manifest.styles.find(s=>s.id===id&&s.file===file);
 const data=entries.get(prefix+file);
 if(!item||!data||data.length<20||data.toString('ascii',0,4)!=='glTF'||data.readUInt32LE(8)!==data.length)
  throw Error('CAS hair: GLB ausente ou inválido: '+file);
}
const female=entries.get('assets/characters/cas/female-vincent.glb');
const bodyManifest=entries.get('assets/characters/cas/manifest.json');
if(!female||!bodyManifest||female.toString('ascii',0,4)!=='glTF'||female.readUInt32LE(8)!==female.length)
 throw Error('CAS body: GLB feminino ausente/inválido');
const models=JSON.parse(bodyManifest.toString('utf8')).models;
if(!models?.some(model=>model.sex==='female'&&model.file==='female-vincent.glb'))
 throw Error('CAS body: manifesto de base feminina inválido');
for(const [path,raw] of entries){
 const absolute=resolve(path);
 if(!absolute.startsWith(resolve('assets/characters')+'/'))throw Error('CAS: caminho inválido');
 mkdirSync(resolve(absolute,'..'),{recursive:true});
 writeFileSync(absolute,raw);
}
console.log('CAS: 1 corpo feminino + 21 cabelos GLB instalados e validados.');
