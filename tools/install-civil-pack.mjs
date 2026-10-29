// Install only verified, individually exported CC BY civil-service GLBs.
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {CIVIL_PACK_EXPECTED,CIVIL_PACK_AUTHOR,CIVIL_PACK_SOURCE} from '../js/vehicle-catalog.mjs';
import {analyzeGLB} from './audit-vehicle-assets.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),input=process.argv[2];
if(!input||input==='--help'){
 console.log('Usage: npm run import:civil -- /path/to/ten/separate/glbs');
 console.log('Required files: '+CIVIL_PACK_EXPECTED.map(v=>v.file).join(', '));
 process.exit(input?0:1);
}
const dir=resolve(input),verified=[];
for(const cfg of CIVIL_PACK_EXPECTED){
 const path=join(dir,cfg.file);
 let bytes;
 try{bytes=await readFile(path);}catch{throw Error('Missing '+path+' — export this model separately from your licensed Sketchfab pack.');}
 if(bytes.length>50*1024*1024)throw Error('GLB over 50MB: '+cfg.file);
 const audit=analyzeGLB(bytes,cfg.file);
 if(audit.triangles<150||audit.drawCalls<1)throw Error('Missing geometry: '+cfg.file);
 verified.push({id:cfg.id,file:cfg.file,bytes:bytes.length,triangles:audit.triangles,
  drawCalls:audit.drawCalls,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const path=join(root,'js/vehicle-catalog.mjs'),catalog=await readFile(path,'utf8');
const start='// CIVIL_PACK_ASSETS_START',end='// CIVIL_PACK_ASSETS_END';
const a=catalog.indexOf(start),b=catalog.indexOf(end,a+start.length);
if(a<0||b<0)throw Error('Catalog import markers not found');
const entries=CIVIL_PACK_EXPECTED.map(v=>JSON.stringify(v)+',').join('\n ');
const updated=catalog.slice(0,a+start.length)+'\n '+entries+'\n '+catalog.slice(b);
const out=join(root,'assets/vehicles/live');await mkdir(out,{recursive:true});
for(const cfg of CIVIL_PACK_EXPECTED)await copyFile(join(dir,cfg.file),join(out,cfg.file));
await writeFile(join(out,'COMRADE1280-CIVIL-ATTRIBUTION.txt'),
 'Generic civil service vehicles pack by '+CIVIL_PACK_AUTHOR+'\n'+CIVIL_PACK_SOURCE+
 '\nCC BY 4.0: https://creativecommons.org/licenses/by/4.0/\n'+
 'City of God modifications: individual GLB export, scale and vehicle lighting.\n');
await writeFile(join(root,'assets/vehicles/civil-import-manifest.json'),
 JSON.stringify({source:CIVIL_PACK_SOURCE,author:CIVIL_PACK_AUTHOR,
 license:'CC BY 4.0',models:verified},null,2)+'\n');
await writeFile(path,updated);
console.log('Activated '+verified.length+' genuine GLBs after geometry validation:');
for(const v of verified)console.log(v.id+': '+v.triangles+' triangles; '+v.bytes+' bytes');
console.log('Validate scales, wheel pivots, headlamp positions and all test suites before production.');
