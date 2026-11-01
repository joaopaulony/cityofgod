import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeGLB} from './audit-vehicle-assets.mjs';
import {POLICE_SUV_EXPECTED,POLICE_SUV_SOURCE} from '../js/vehicle-catalog.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),input=process.argv[2];
if(!input)throw Error('Usage: npm run import:police-suv -- path/to/police-suv-2k-webp.glb');
const bytes=await readFile(resolve(input));
const hash=createHash('sha256').update(bytes).digest('hex');
if(hash!=='b746fcdea8c73e03f6b927197b36c55ba536459d5e3e22e675469a4b305f8f7a')
 throw Error('Unexpected or unapproved SUV binary SHA-256: '+hash);
const audit=analyzeGLB(bytes,POLICE_SUV_EXPECTED.file);
if(audit.triangles!==9040||audit.drawCalls!==11)throw Error('Wrong geometry: '+JSON.stringify(audit));
const count=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+count).toString('utf8'));
const asset=gltf.asset?.extras||{};
if(asset.cityOfGodModelId!=='police-suv'||asset.wheelCount!==4||
 !/mk2design/.test(asset.author||'')||!/^CC-BY-4.0/.test(asset.license||''))
 throw Error('Model author, role or license invalid');
if(!gltf.extensionsRequired?.includes('EXT_texture_webp'))
 throw Error('Must use verified 2K WebP source');
const nodes=gltf.nodes||[];
for(const [name,steers] of [['Wheel_FL',true],['Wheel_FR',true],['Wheel_RL',false],['Wheel_RR',false]]){
 const node=nodes.find(n=>n.name===name);
 if(!node||node.extras?.wheelSteers!==steers||node.extras?.steeringAxis!=='y'||
 node.extras?.wheelRadiusMeters<.3||node.extras?.wheelRadiusMeters>.5)
 throw Error('Invalid wheel rig '+name);
}
for(const [side,name] of Object.entries(POLICE_SUV_EXPECTED.beaconNativeMeshes)){
 const node=nodes.find(n=>n.name===name);
 if(!node||node.extras?.beaconLens!==side||!Number.isInteger(node.mesh))
 throw Error('Original '+side+' siren lens missing');
}
if(gltf.images?.length!==5||gltf.images.some(i=>i.mimeType!=='image/webp'))
 throw Error('Expected 5 source WebP textures');
const path=join(root,'js/vehicle-catalog.mjs'),catalog=await readFile(path,'utf8'),
 a=catalog.indexOf('// POLICE_SUV_ASSET_START'),b=catalog.indexOf('// POLICE_SUV_ASSET_END');
if(a<0||b<a)throw Error('Activation markers missing');
if(!catalog.slice(a,b).includes('"police-suv"')){
 const updated=catalog.slice(0,a+'// POLICE_SUV_ASSET_START'.length)+'\n '+
 JSON.stringify(POLICE_SUV_EXPECTED)+',\n '+catalog.slice(b);
 await mkdir(join(root,'assets/vehicles/live'),{recursive:true});
 await copyFile(resolve(input),join(root,'assets/vehicles/live',POLICE_SUV_EXPECTED.file));
 await writeFile(join(root,'assets/vehicles/live/POLICE-SUV-CREDITS.txt'),
  'Lowpoly Generic SUV Police by mk2design\n'+POLICE_SUV_SOURCE+
  '\nCC BY 4.0: https://creativecommons.org/licenses/by/4.0/\n'+
  'City of God: reduced to 2K WebP, added wheel metadata, original beacon mesh lighting and removed fake flat shadow.\n');
 await writeFile(path,updated);
}
console.log('PASS: approved police SUV, 9040 triangles, 4 original wheels and 2 exact native siren lenses');
