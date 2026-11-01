'use strict';
const fs=require('fs');
function glbJson(file){
 const buf=fs.readFileSync(file);
 if(buf.toString('utf8',0,4)!=='glTF')throw new Error('Not a GLB '+file);
 const n=buf.readUInt32LE(12);
 return JSON.parse(buf.toString('utf8',20,20+n));
}
for(const fn of process.argv.slice(2)){
 const glb=glbJson(fn);
 const nodes=glb.nodes||[],accessors=glb.accessors||[],meshes=glb.meshes||[];
 function printTree(index,level=0){
  if(level>3)return;
  const n=nodes[index],name=n.name||'';
  const info={name,idx:index,mesh:n.mesh,rot:n.rotation,translation:n.translation,scale:n.scale};
  if(n.mesh!=null){
   const mesh=meshes[n.mesh];info.meshName=mesh.name;
   info.primitiveBoxes=mesh.primitives?.map(p=>{
    const b=accessors[p.attributes?.POSITION];
    return {min:b?.min,max:b?.max};
   });
  }
  console.log('LEVEL',level,JSON.stringify(info));
  for(const child of n.children||[])printTree(child,level+1);
 }
 console.log('FILE',fn,'nodes',nodes.length);
 const matches=[];
 for(let i=0;i<nodes.length;i++)
  if(/^(FL|FR|RL|RR)[_.0-9]*$/i.test(nodes[i].name||'')||/^wheel_(fl|fr|rl|rr)$/i.test(nodes[i].name||'')){
   matches.push(i);
   printTree(i);
  }
 console.log('GROUP_COUNT',matches.length);
}