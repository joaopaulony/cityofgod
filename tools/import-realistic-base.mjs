import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import * as T from 'three';
import sharp from 'sharp';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
globalThis.window={innerWidth:800,innerHeight:600};
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}};
T.TextureLoader.prototype.load=function(url){const t=new T.Texture();t.userData.sourceURL=url;return t;};
const out=resolve('assets/characters/realistic-base');await mkdir(join(out,'textures'),{recursive:true});
const manifest={provider:'realistic-base',author:'VTR3D',models:[]};
const sourceBytes=await readFile('assets/characters/mixamo/david.glb');
const source=await new GLTFLoader().parseAsync(sourceBytes.buffer.slice(sourceBytes.byteOffset,sourceBytes.byteOffset+sourceBytes.byteLength),'');
const sourceSpec=JSON.parse(await readFile('assets/characters/mixamo/manifest.json')).models.find(m=>m.id==='david');
const srcRest=new Map();source.scene.updateMatrixWorld(true);source.scene.traverse(b=>{if(b.isBone&&!srcRest.has(b.name))srcRest.set(b.name,b.getWorldQuaternion(new T.Quaternion()));});
const srcHip=source.scene.getObjectByName('mixamorigHips'),srcHipRest=srcHip.getWorldPosition(new T.Vector3());
function boneMapping(female){
 const map=female?{pelvis:'Hips',spine_01:'Spine',spine_02:'Spine1',spine_03:'Spine2',neck_01:'Neck',head:'Head'}:{CC_Base_Hip:'Hips',CC_Base_Waist:'Spine',CC_Base_Spine01:'Spine1',CC_Base_Spine02:'Spine2',CC_Base_NeckTwist01:'Neck',CC_Base_Head:'Head'};
 for(const [side,letter] of [['Left','L'],['Right','R']]){
  const parts=female?{clavicle:'Shoulder',upperarm:'Arm',lowerarm:'ForeArm',hand:'Hand',thigh:'UpLeg',calf:'Leg',foot:'Foot',ball:'ToeBase'}:{Clavicle:'Shoulder',Upperarm:'Arm',Forearm:'ForeArm',Hand:'Hand',Thigh:'UpLeg',Calf:'Leg',Foot:'Foot',ToeBase:'ToeBase'};
  for(const [a,b] of Object.entries(parts))map[female?a+'_'+letter.toLowerCase():'CC_Base_'+letter+'_'+a]=side+b;
  for(const [f,m] of [['Thumb','Thumb'],['Index','Index'],['Mid','Middle'],['Ring','Ring'],['Pinky','Pinky']])for(let i=1;i<=3;i++)map[female?(f==='Mid'?'middle':f.toLowerCase())+'_0'+i+'_'+letter.toLowerCase():'CC_Base_'+letter+'_'+f+i]=side+'Hand'+m+i;
 }return map;
}
function image(bytes){
 if(bytes.toString('ascii',0,2)!=='BM')return sharp(bytes);
 const off=bytes.readUInt32LE(10),w=bytes.readInt32LE(18),h0=bytes.readInt32LE(22),h=Math.abs(h0),bits=bytes.readUInt16LE(28),compression=bytes.readUInt32LE(30);
 if(![24,32].includes(bits)||compression!==0)throw Error('Unsupported BMP '+bits+'/'+compression);
 const stride=Math.ceil(w*bits/32)*4,data=Buffer.alloc(w*h*3);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=off+(h0>0?h-1-y:y)*stride+x*(bits/8),j=(y*w+x)*3;data[j]=bytes[i+2];data[j+1]=bytes[i+1];data[j+2]=bytes[i];}
 return sharp(data,{raw:{width:w,height:h,channels:3}});
}
for(const [idx,path] of process.argv.slice(2).entries()){
 const id=idx?'female':'male',dir=dirname(path),buffer=await readFile(path),root=new FBXLoader().parse(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
 const sidecar=JSON.parse(await readFile(path.replace(/\.fbx$/i,'.json'))),entry=Object.values(sidecar)[0],meta=Object.values(entry.Object)[0].Meshes;
 const remove=[];root.traverse(o=>{if(o.isCamera||o.isLight||(o.isMesh&&(!o.isSkinnedMesh||/eyeocclusion|tearline/i.test(o.name))))remove.push(o);});remove.forEach(o=>o.removeFromParent());
 // Bone names must be unique for glTF animation binding (FBX includes helpers).
 const map=boneMapping(!!idx),seen=new Map(),mapped=[];
 for(const side of ['L','R'])for(const [part,target] of [['Upperarm','Arm'],['Forearm','ForeArm'],['Thigh','UpLeg'],['Calf','Leg']])for(const n of ['01','02']){const key='CC_Base_'+side+'_'+part+'Twist'+n;map[idx?key.toLowerCase():key]=(side==='L'?'Left':'Right')+target;}
 if(idx)for(const [a,b] of [['upperarm','Arm'],['lowerarm','ForeArm'],['thigh','UpLeg'],['calf','Leg']])for(const side of ['l','r'])map[a+'_twist_01_'+side]=(side==='l'?'Left':'Right')+b;
 const sourceNames=new Map(),canonicalUsed=new Set();
 root.traverse(b=>{if(!b.isBone)return;const old=b.name,n=seen.get(old)||0;seen.set(old,n+1);if(!n&&map[old]){const srcName='mixamorig'+map[old];b.name=canonicalUsed.has(srcName)?old+'_driven':srcName;canonicalUsed.add(srcName);sourceNames.set(b,srcName);mapped.push(b);}else if(n)b.name=old+'_aux'+n;});
 root.scale.multiplyScalar(.01);root.updateMatrixWorld(true);
 const mats={},cache=new Map();let triangles=0,drawCalls=0,textureBytes=0;
 const meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 for(const mesh of meshes){
  mesh.geometry.morphAttributes={};mesh.morphTargetInfluences=[];mesh.morphTargetDictionary={};mesh.geometry.deleteAttribute('color');mesh.geometry=mergeVertices(mesh.geometry,1e-5);mesh.normalizeSkinWeights();
  triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;
  const convert=async m=>{
   if(cache.has(m))return cache.get(m);
   const materialInfo=meta[Object.keys(meta).find(k=>k.toLowerCase()===mesh.name.toLowerCase())]?.Materials?.[m.name],name=id+'_'+m.name,info={skin:/^Std_Skin_/.test(m.name)};
   for(const [key,role] of [['map','Base Color'],['normalMap','Normal'],['alphaMap','Opacity']]){
    const rel=materialInfo?.Textures?.[role]?.['Texture Path'];if(!rel)continue;
    const bytes=await readFile(resolve(dir,rel)),file='textures/'+name+'_'+key+'.webp';
    const output=await image(bytes).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).webp({quality:key==='map'?88:92}).toBuffer();
    await writeFile(join(out,file),output);textureBytes+=output.length;info[key]=file;
   }
   info.alphaTest=/lash|angled|occlusion|tear/i.test(m.name)? .35:0;
   const next=new T.MeshStandardMaterial({name,color:0xffffff,roughness:.8,side:info.alphaTest?T.DoubleSide:T.FrontSide});cache.set(m,next);mats[name]=info;return next;
  };
  mesh.material=Array.isArray(mesh.material)?await Promise.all(mesh.material.map(convert)):await convert(mesh.material);drawCalls+=Array.isArray(mesh.material)?mesh.material.length:1;
 }
 // Align the A-pose arms with the animation library's T-pose before measuring offsets.
 // Preserve inverse bind matrices: this is a pose adjustment, not a new skin bind.
 root.updateMatrixWorld(true);
 for(const side of ['Left','Right'])for(const [part,child] of [['Arm','ForeArm'],['ForeArm','Hand']]){
  const b=root.getObjectByName('mixamorig'+side+part),c=root.getObjectByName('mixamorig'+side+child);
  const sb=source.scene.getObjectByName('mixamorig'+side+part),sc=source.scene.getObjectByName('mixamorig'+side+child);
  const from=c.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize();
  const to=sc.getWorldPosition(new T.Vector3()).sub(sb.getWorldPosition(new T.Vector3())).normalize();
  const q=new T.Quaternion().setFromUnitVectors(from,to).multiply(b.getWorldQuaternion(new T.Quaternion()));
  b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);
 }
 root.updateMatrixWorld(true);const rest=mapped.map(b=>({b,q:b.quaternion.clone(),p:b.position.clone(),world:b.getWorldQuaternion(new T.Quaternion()),sourceName:sourceNames.get(b),src:source.scene.getObjectByName(sourceNames.get(b))}));
 const hip=root.getObjectByName('mixamorigHips'),hipWorld=hip.getWorldPosition(new T.Vector3()),hipLocal=hip.position.clone(),ratio=hipWorld.y/srcHipRest.y;
 const mixer=new T.AnimationMixer(source.scene),animations=[];
 for(const clip of source.animations){
  mixer.stopAllAction();mixer.clipAction(clip).play();const times=[],data=rest.map(()=>[]),positions=[],count=Math.ceil(clip.duration*24);
  for(let frame=0;frame<=count;frame++){
   const time=Math.min(frame/24,clip.duration);times.push(time);mixer.setTime(time);source.scene.updateMatrixWorld(true);
   for(const e of rest){e.b.quaternion.copy(e.q);e.b.position.copy(e.p);}root.updateMatrixWorld(true);
   const delta=srcHip.getWorldPosition(new T.Vector3()).sub(srcHipRest).multiplyScalar(ratio),desired=hipWorld.clone().add(delta);hip.parent.worldToLocal(desired);hip.position.copy(desired);root.updateMatrixWorld(true);
   for(const [i,e] of rest.entries()){
    if(e.src){const q=e.src.getWorldQuaternion(new T.Quaternion()).multiply(srcRest.get(e.sourceName).clone().invert()).multiply(e.world);const parent=e.b.parent.getWorldQuaternion(new T.Quaternion()).invert();e.b.quaternion.copy(parent.multiply(q));e.b.updateMatrixWorld(true);}
    data[i].push(...e.b.quaternion.toArray());
   }
   positions.push(...hip.position.toArray());
  }
  const tracks=rest.map((e,i)=>new T.QuaternionKeyframeTrack(e.b.name+'.quaternion',times,data[i]));tracks.push(new T.VectorKeyframeTrack(hip.name+'.position',times,positions));animations.push(new T.AnimationClip(clip.name,clip.duration,tracks));
 }
 mixer.stopAllAction();source.scene.updateMatrixWorld(true);
 for(const e of rest){e.b.quaternion.copy(e.q);e.b.position.copy(e.p);}hip.position.copy(hipLocal);root.updateMatrixWorld(true);
 const glb=await new GLTFExporter().parseAsync(root,{binary:true,animations,onlyVisible:true});await writeFile(join(out,id+'.glb'),Buffer.from(glb));
 const spec={id,file:id+'.glb',bytes:glb.byteLength,textureBytes,triangles,drawCalls,bones:seen.size,materials:mats,clips:sourceSpec.clips};manifest.models.push(spec);console.log(id,JSON.stringify({triangles,drawCalls,glb:glb.byteLength,textureBytes}));
}
await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
