import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
const source=resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Usage: node tools/import-tomb.mjs PATH_TO_EXTRACTED_MOD');
let mods=join(source,'mods');
try{await readdir(mods);}catch{const dirs=await readdir(source,{withFileTypes:true});mods=join(source,dirs.find(d=>d.isDirectory()).name,'mods');}
const out=resolve('assets/characters/tomb');await mkdir(out,{recursive:true});
THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}};
const models=[];
function cutClothingEdges(geometry,height){
 const attributes=geometry.attributes,names=Object.keys(attributes).filter(n=>n!=='color');
 const vertex=i=>Object.fromEntries(names.map(name=>[name,Array.from(attributes[name].array.slice(i*attributes[name].itemSize,(i+1)*attributes[name].itemSize))]));
 const blend=(a,b,t)=>{
  const v={};for(const name of names)if(!['skinIndex','skinWeight'].includes(name))v[name]=a[name].map((x,k)=>x+(b[name][k]-x)*t);
  const weights=new Map();for(const [p,w] of [[a,1-t],[b,t]])for(let k=0;k<4;k++)weights.set(p.skinIndex[k],(weights.get(p.skinIndex[k])||0)+p.skinWeight[k]*w);
  const top=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((s,p)=>s+p[1],0)||1;
  while(top.length<4)top.push([0,0]);v.skinIndex=top.map(p=>p[0]);v.skinWeight=top.map(p=>p[1]/sum);return v;
 };
 const planes=[...[.095,.57,.805,.875,.90,.935].map(y=>[1,y*height]),[0,.25*height],[0,-.25*height],[0,.065*height],[0,-.065*height],[2,-.012]];
 const output=Object.fromEntries(names.map(n=>[n,[]]));
 for(let i=0;i<attributes.position.count;i+=3){
  let pieces=[[vertex(i),vertex(i+1),vertex(i+2)]];
  for(const [axis,value] of planes){
   const next=[];
   for(const polygon of pieces){
    const distances=polygon.map(v=>v.position[axis]-value);
    if(distances.every(d=>d>=-1e-8)||distances.every(d=>d<=1e-8)){next.push(polygon);continue;}
    for(const sign of [-1,1]){
     const clipped=[];
     for(let k=0;k<polygon.length;k++){
      const a=polygon[k],b=polygon[(k+1)%polygon.length],da=distances[k]*sign,db=distances[(k+1)%polygon.length]*sign;
      if(da>=0)clipped.push(a);if((da>=0)!==(db>=0))clipped.push(blend(a,b,da/(da-db)));
     }
     if(clipped.length>=3)next.push(clipped);
    }
   }
   pieces=next;
  }
  for(const polygon of pieces)for(let k=1;k<polygon.length-1;k++)for(const v of [polygon[0],polygon[k],polygon[k+1]])for(const name of names)output[name].push(...v[name]);
 }
 const result=new THREE.BufferGeometry();
 for(const name of names)result.setAttribute(name,new THREE.BufferAttribute(new attributes[name].array.constructor(output[name]),attributes[name].itemSize,attributes[name].normalized));
 result.normalizeNormals();return result;
}
for(const sex of ['Male','Female']){
 const path=join(mods,"Tomb's Player Body",'42.0/media/models_X/Skinned',sex+'Body.fbx');
 const bytes=await readFile(path),root=new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 root.updateMatrixWorld(true);let triangles=0,bones=0;
 const bbox=new THREE.Box3().setFromObject(root),height=bbox.max.y-bbox.min.y;
 root.traverse(o=>{
  if(!o.isSkinnedMesh)return;
  // Tomb includes optional skirt deformation panels in the body FBX. They
  // are not trousers and must not be painted solid in this casual outfit.
  const original=o.geometry,keep=[],si=original.attributes.skinIndex,sw=original.attributes.skinWeight;
  for(let i=0;i<original.attributes.position.count;i+=3){
   let skirtWeight=0;
   for(let v=0;v<3;v++)for(let k=0;k<4;k++)if(o.skeleton.bones[si.array[(i+v)*4+k]].name.includes('Dress'))skirtWeight+=sw.array[(i+v)*4+k];
   const skirt=skirtWeight/3>.5;
   if(!skirt)keep.push(i,i+1,i+2);
  }
  const filtered=new THREE.BufferGeometry();
  for(const [name,a] of Object.entries(original.attributes)){
   const data=new a.array.constructor(keep.length*a.itemSize);
   for(let i=0;i<keep.length;i++)for(let k=0;k<a.itemSize;k++)data[i*a.itemSize+k]=a.array[keep[i]*a.itemSize+k];
   filtered.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize,a.normalized));
  }
  o.geometry=filtered;
  o.normalizeSkinWeights();o.geometry=cutClothingEdges(o.geometry,height);const geo=o.geometry,p=geo.attributes.position;geo.clearGroups();
  // PZ FBXs carry black vertex colours that its skin shader ignores.
  // Standard glTF materials multiply them, which would black out the body.
  geo.deleteAttribute('color');
  const materials=[new THREE.MeshStandardMaterial({name:'TombSkin',roughness:.9}),new THREE.MeshStandardMaterial({name:'CityShirt',color:0xd9d9d2,roughness:1}),new THREE.MeshStandardMaterial({name:'CityTrousers',color:0x32475a,roughness:1}),new THREE.MeshStandardMaterial({name:'CityShoes',color:0x24262a,roughness:1}),new THREE.MeshStandardMaterial({name:'CityHair',color:0x2e211b,roughness:1})];
  let start=0,previous=-1;
  for(let i=0;i<p.count;i+=3){
   let x=0,y=0,z=0;for(let k=0;k<3;k++){x+=p.getX(i+k)/3;y+=p.getY(i+k)/3;z+=p.getZ(i+k)/3;}
   const yy=y/height,xx=Math.abs(x)/height;
   let material=0;
   if(yy<.095)material=3;
   else if(yy<.57)material=2;
   else if(yy<.805&&xx<.25)material=1;
   const hairline=z>-.012?.935:xx>.065?.90:.875;
   if(yy>hairline)material=4;
   if(material!==previous){if(previous>=0)geo.addGroup(start,i-start,previous);start=i;previous=material;}
  }
  if(previous>=0)geo.addGroup(start,p.count-start,previous);
  // FBX is non-indexed. Sort triangles by material so clothing regions cost
  // five draw calls rather than hundreds of alternating face groups.
  const buckets=materials.map(()=>[]);
  for(const group of geo.groups)for(let i=group.start;i<group.start+group.count;i++)buckets[group.materialIndex].push(i);
  const order=buckets.flat();
  for(const [name,attribute] of Object.entries(geo.attributes)){
   const array=new attribute.array.constructor(attribute.array.length);
   for(let i=0;i<order.length;i++)for(let k=0;k<attribute.itemSize;k++)array[i*attribute.itemSize+k]=attribute.array[order[i]*attribute.itemSize+k];
   geo.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));
  }
  geo.clearGroups();let offset=0;
  buckets.forEach((bucket,i)=>{if(bucket.length)geo.addGroup(offset,bucket.length,i);offset+=bucket.length;});
  o.geometry=mergeVertices(geo,1e-5);
  o.material=materials;triangles+=p.count/3;bones=o.skeleton.bones.length;
 });
 root.scale.setScalar(1.76/height);root.updateMatrixWorld(true);
 const file=sex.toLowerCase()+'.glb';
 const glb=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false});
 await writeFile(join(out,file),Buffer.from(glb));
 models.push({sex:sex.toLowerCase(),file,bytes:glb.byteLength,triangles,bones,sha256:createHash('sha256').update(bytes).digest('hex')});
 console.log(sex,triangles,'triangles',glb.byteLength,'bytes');
}
const textures=join(out,'textures');await mkdir(textures,{recursive:true});
const skins=[];
for(const sex of ['Male','Female'])for(let n=1;n<=5;n++){
 const file=`${sex}Body0${n}.png`;
 await copyFile(join(mods,"Tomb's Player Body - Textures",'common/media/textures/Body',file),join(textures,file));
 skins.push({sex:sex.toLowerCase(),tone:n,file:'textures/'+file});
}
const faces=[];
const faceRoot=join(mods,"Tomb's Player Body - Customisation",'common/media/textures/Faces');
for(const dir of await readdir(faceRoot,{withFileTypes:true})){
 if(!dir.isDirectory())continue;
 for(const file of await readdir(join(faceRoot,dir.name))){
  if(!/^(Male|Female)0[1-5]\.png$/.test(file))continue;
  const output=`${dir.name}-${file}`;await copyFile(join(faceRoot,dir.name,file),join(textures,output));
  faces.push({name:dir.name,sex:file.startsWith('Male')?'male':'female',tone:Number(file.match(/0(\d)/)[1]),file:'textures/'+output});
 }
}
const manifest={provider:'tomb',source:'https://steamcommunity.com/sharedfiles/filedetails/?id=3429790870',permission:'User confirmed author permission via WhatsApp audio, 2026-10-24.',version:'B42 models from user-supplied package',models,skins,faces,clothing:'Original City of God material regions on Tomb body; no vanilla game clothing or animations copied.'};
await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(join(out,'CREDITS.txt'),"Tomb's Player Body Overhaul — Tomb\nhttps://steamcommunity.com/sharedfiles/filedetails/?id=3429790870\nBodies and skin/face textures supplied by user with confirmed author permission for City of God.\nConversion, material-based casual outfits, hair treatment and procedural animation adapter: City of God.\nNo Project Zomboid vanilla assets or animations included.\n");
