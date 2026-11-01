// Mede os triângulos reais de TODOS os GLBs, sem depender de Chrome ou Blender.
// node tools/audit-vehicle-assets.mjs [caminho-do-json]
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {VEHICLE_MODELS} from '../js/vehicle-catalog.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function analyzeGLB(buffer,filename='unknown.glb'){
 const b=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer);
 if(b.toString('ascii',0,4)!=='glTF'||b.readUInt32LE(4)!==2||b.readUInt32LE(8)>b.length)
  throw Error('GLB invalido: '+filename);
 const jsonLength=b.readUInt32LE(12);
 if(b.toString('ascii',16,20)!=='JSON'||20+jsonLength>b.length)
  throw Error('JSON do GLB invalido: '+filename);
 const doc=JSON.parse(b.subarray(20,20+jsonLength).toString('utf8'));
 const meshes=doc.meshes||[], nodes=doc.nodes||[],accessors=doc.accessors||[];
 let triangles=0,drawCalls=0,vertices=0;
 // Número de primitivas realmente instanciadas por nós da cena GLB.
 for(const node of nodes){
  if(!Number.isInteger(node.mesh)||!meshes[node.mesh])continue;
  for(const p of meshes[node.mesh].primitives||[]){
   const count=(Number.isInteger(p.indices)?accessors[p.indices]?.count:
    accessors[p.attributes?.POSITION]?.count)||0;
   const mode=p.mode??4;
   const n=mode===4?Math.floor(count/3):mode===5||mode===6?Math.max(0,count-2):0;
   triangles+=n;drawCalls++;vertices+=accessors[p.attributes?.POSITION]?.count||0;
  }
 }
 let embeddedTextureBytes=0;
 for(const image of doc.images||[]){
  if(Number.isInteger(image.bufferView)) embeddedTextureBytes+=doc.bufferViews?.[image.bufferView]?.byteLength||0;
 }
 return {file:filename,bytes:b.length,triangles,drawCalls,vertices,
  meshes:meshes.length,nodes:nodes.length,materials:(doc.materials||[]).length,
  textures:(doc.textures||[]).length,images:(doc.images||[]).length,
  embeddedTextureBytes,skins:(doc.skins||[]).length};
}
export async function auditVehicleAssets(){
 const models=[];
 for(const cfg of VEHICLE_MODELS){
  const raw=await readFile(join(root,'assets/vehicles/live',cfg.file));
  models.push({id:cfg.id,name:cfg.name,...analyzeGLB(raw,cfg.file)});
 }
 return {version:1,generatedAt:new Date().toISOString(),
  summary:{models:models.length,bytes:models.reduce((n,m)=>n+m.bytes,0),
   trianglesAllUniqueModels:models.reduce((n,m)=>n+m.triangles,0),
   embeddedTextureBytes:models.reduce((n,m)=>n+m.embeddedTextureBytes,0)},
  models};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=process.argv[2];
 try{
  const result=await auditVehicleAssets();
  if(out)await writeFile(out,JSON.stringify(result,null,2)+'\n');
  else console.log(JSON.stringify(result,null,2));
 }catch(error){console.error(error);process.exitCode=1;}
}
