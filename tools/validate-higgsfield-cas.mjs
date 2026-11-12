#!/usr/bin/env node
// Offline preflight for Higgsfield GLB exports before registering them in CAS.
import {readFileSync} from 'node:fs';
import {basename} from 'node:path';
const file=process.argv[2];
if(!file){console.error('Uso: node tools/validate-higgsfield-cas.mjs caminho/modelo.glb');process.exit(2);}
const bytes=readFileSync(file);
if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)
 throw Error('Arquivo não é GLB v2 íntegro');
const chunkLen=bytes.readUInt32LE(12);
if(bytes.readUInt32LE(16)!==0x4e4f534a||20+chunkLen>bytes.length)throw Error('JSON GLB ausente');
const gltf=JSON.parse(bytes.subarray(20,20+chunkLen).toString('utf8'));
const primitives=(gltf.meshes||[]).flatMap(m=>m.primitives||[]);
const triangles=primitives.reduce((n,p)=>{
 const a=gltf.accessors?.[p.indices??p.attributes?.POSITION];
 return n+(a&&(!p.mode||p.mode===4)?Math.floor(a.count/3):0);
},0);
const skins=gltf.skins||[],joints=new Set(skins.flatMap(s=>s.joints||[]));
const weighted=primitives.filter(p=>p.attributes?.JOINTS_0!=null&&p.attributes?.WEIGHTS_0!=null).length;
const materials=(gltf.materials||[]).map(m=>m.name||'');
const clips=(gltf.animations||[]).map(c=>c.name||'');
const bones=(gltf.nodes||[]).map(n=>n.name||'');
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const has=arr=>clips.some(c=>arr.includes(normalize(c)));
const issues=[],warnings=[];
if(!skins.length||joints.size<15||!weighted)issues.push('Rigging, skinning ou ossos ausentes');
if(!has(['idle','standing','breathing']))issues.push('Idle ausente');
if(!has(['walk','walking','walkcycle']))issues.push('Walk ausente');
if(!has(['run','running','jog']))issues.push('Run ausente');
if(triangles>60000)issues.push('CAS rejeita modelos acima de 60000 triângulos');
else if(triangles>25000)warnings.push('Ultrapassou a meta low-poly de 25000 triângulos');
for(const name of ['Skin','Shirt','Pants'])if(!materials.includes(name))warnings.push('Material '+name+' não identificado');
const mixamo=['mixamorigHips','mixamorigLeftHand','mixamorigRightHand','mixamorigLeftUpLeg','mixamorigRightUpLeg'].every(n=>bones.includes(n));
if(!mixamo)warnings.push('Rig não é Mixamo: retargeting necessário para armas e ações domésticas');
console.log(JSON.stringify({file:basename(file),bytes:bytes.length,triangles,bones:joints.size,skins:skins.length,weightedPrimitives:weighted,materials,clips,rig:mixamo?'mixamo':'generic',issues,warnings,readyForCAS:issues.length===0},null,2));
if(issues.length)process.exitCode=1;
