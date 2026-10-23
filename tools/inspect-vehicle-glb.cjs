'use strict';
const fs=require('node:fs');
function read(file){
 const b=fs.readFileSync(file);
 if(b.toString('ascii',0,4)!=='glTF')throw Error('Invalid GLB '+file);
 const length=b.readUInt32LE(12),kind=b.toString('ascii',16,20);
 if(kind!=='JSON')throw Error('No JSON chunk '+file);
 const d=JSON.parse(b.subarray(20,20+length).toString('utf8'));
 return {file,bytes:b.length,author:d.asset?.copyright,
  nodes:(d.nodes||[]).map((n,i)=>({i,name:n.name,mesh:n.mesh,
   children:n.children?.length||0,translation:n.translation,
   rotation:n.rotation})),
  meshes:(d.meshes||[]).map((m,i)=>({i,name:m.name,
   primitives:m.primitives?.length,
   materials:m.primitives?.map(p=>d.materials?.[p.material]?.name||'none')})),
  materials:d.materials?.map(m=>m.name),skins:d.skins?.length||0};
}
for(const file of process.argv.slice(2)){
 const d=read(file);console.log('INSPECT',JSON.stringify(d).slice(0,24000));
}
