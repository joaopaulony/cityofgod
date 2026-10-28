// City of God — strict GLB quality gate, engine-independent and executable in Node.
// A source model is never approved because a generation job merely completed.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export function inspectGLB(bytes,{maxTriangles=12000,maxBytes=12_000_000}={}){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 const failures=[];
 if(b.byteLength<28||b.byteLength>maxBytes)failures.push('size outside 28..'+maxBytes+' bytes');
 const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.byteLength<28||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==b.byteLength)
  return {approved:false,failures:[...failures,'invalid GLB v2 header']};
 let doc=null,offset=12;
 while(offset+8<=b.byteLength){
  const size=view.getUint32(offset,true),kind=view.getUint32(offset+4,true);
  if(size<0||offset+8+size>b.byteLength)return {approved:false,failures:[...failures,'invalid chunk length']};
  if(kind===0x4e4f534a){
   try{doc=JSON.parse(new TextDecoder().decode(b.subarray(offset+8,offset+8+size)));}catch{failures.push('invalid GLB JSON');}
  }
  offset+=size+8;
 }
 if(!doc)return {approved:false,failures:[...failures,'missing JSON chunk']};
 let triangles=0,skinnedNodes=0,materialCount=doc.materials?.length||0;
 for(const mesh of doc.meshes||[])for(const p of mesh.primitives||[]){
  const n=doc.accessors?.[p.indices??p.attributes?.POSITION]?.count||0;
  triangles+=p.mode==null||p.mode===4?Math.floor(n/3):p.mode===5||p.mode===6?Math.max(0,n-2):0;
 }
 for(const node of doc.nodes||[])if(node.mesh!=null&&node.skin!=null)skinnedNodes++;
 const jointIds=new Set((doc.skins||[]).flatMap(s=>s.joints||[]));
 const jointNames=[...jointIds].map(i=>doc.nodes?.[i]?.name||'');
 const handJoints=jointNames.filter(n=>/thumb|index|middle|ring|pinky|little|finger/i.test(n));
 const eachHand={left:handJoints.filter(n=>/left|(^|[^a-z])l[_. -]?/i.test(n)).length,right:handJoints.filter(n=>/right|(^|[^a-z])r[_. -]?/i.test(n)).length};
 const clips=(doc.animations||[]).map(c=>c.name||'Unnamed');
 if(triangles===0||triangles>maxTriangles)failures.push('triangles '+triangles+' exceed budget of '+maxTriangles+' or absent');
 if(!skinnedNodes)failures.push('no skinned mesh nodes');
 if(jointIds.size<55)failures.push('insufficient bones '+jointIds.size+' (target >=55)');
 if(eachHand.left<10||eachHand.right<10)failures.push('insufficient articulated finger joints L'+eachHand.left+'/R'+eachHand.right+' (>=10 each)');
 if(!clips.length)failures.push('no skeletal animation clips');
 if(materialCount>12)failures.push('excessive materials '+materialCount);
 return {approved:failures.length===0,triangles,bytes:b.byteLength,skins:doc.skins?.length||0,skinnedNodes,bones:jointIds.size,fingers:eachHand,materials:materialCount,clips,failures};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const files=process.argv.slice(2);
 if(!files.length){console.error('Usage: node tools/validate-realistic-glb.mjs male.glb female.glb');process.exitCode=2;}
 for(const file of files){
  const info=inspectGLB(await readFile(file));
  console.log(JSON.stringify({file,...info},null,2));
  if(!info.approved)process.exitCode=1;
 }
}
