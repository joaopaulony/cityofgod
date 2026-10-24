import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import * as THREE from 'three';
import sharp from 'sharp';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

// Original FBX files stay outside the distributable game assets.
const [davidPath,meganPath]=process.argv.slice(2);
if(!davidPath)throw Error('Usage: node tools/import-mixamo.mjs DAVID_FBX [MEGAN_FBX]');
const out=resolve('assets/characters/mixamo');await mkdir(join(out,'textures'),{recursive:true});
THREE.TextureLoader.prototype.load=function(url){const texture=new THREE.Texture();texture.userData.sourceURL=url;return texture;};
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const canonical=name=>name.replace(/^mixamorig\d*:?/,'mixamorig');
async function parse(path){const b=await readFile(path);return new FBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const sourceClips=new Map();
for(const folder of ['','locomotion','rifle8'])for(const file of await readdir(join('.mixamo-source',folder)))if(file.endsWith('.fbx')){
 const root=await parse(join('.mixamo-source',folder,file));let clip=root.animations.find(c=>c.duration>.1);
 // The source continues by stepping sideways and hiding. Keep only the vault.
 if(file==='vault.fbx')clip=THREE.AnimationUtils.subclip(clip,'vault',5,52,30);
 let height=0;root.traverse(o=>{if(/Hips$/.test(o.name))height=o.position.y;});
 if(clip)sourceClips.set((folder?folder+'/':'')+file.slice(0,-4),{clip,height});
}
const mapping={idle:'locomotion/idle',walk:'locomotion/walking',run:'locomotion/running',rifle_idle:'rifle8/idle',rifle_aim:'rifle8/idle aiming',rifle_walk:'rifle8/walk forward',rifle_run:'rifle8/run forward',rifle_walk_back:'rifle8/walk backward',rifle_strafe_left:'rifle8/walk left',rifle_strafe_right:'rifle8/walk right',rifle_fire:'firing rifle',rifle_reload:'reloading',jump_start:'rifle8/jump up',jump_air:'rifle8/jump loop',jump_land:'rifle8/jump down',vault_low:'vault',crouch:'rifle8/idle crouching',crouch_walk:'rifle8/walk crouching forward',rifle_crouch_aim:'rifle8/idle crouching aiming',rifle_crouch_walk:'rifle8/walk crouching forward',rifle_crouch_fire:'firing rifle',rifle_crouch_reload:'reloading'};
const models=[];
for(const [id,path] of [['david',davidPath],['megan',meganPath]]){
 if(!path)continue;
 const root=await parse(path);root.updateMatrixWorld(true);
 let triangles=0,bones=0;const materials={},processed=new Map();
 const meshes=[];root.traverse(o=>{o.name=canonical(o.name);if(o.isSkinnedMesh)meshes.push(o);});
 for(const mesh of meshes){
  mesh.normalizeSkinWeights();mesh.geometry.deleteAttribute('color');mesh.geometry=mergeVertices(mesh.geometry,1e-5);
  triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;bones=Math.max(bones,mesh.skeleton.bones.length);
  const convert=async material=>{
   if(processed.has(material))return processed.get(material);
   const name=id+'_'+material.name.replace(/[^a-zA-Z0-9_]/g,'_'),maps={};
   for(const [key,texture] of [['map',material.map],['normalMap',material.normalMap]])if(texture?.userData.sourceURL){
    const bytes=Buffer.from(await (await fetch(texture.userData.sourceURL)).arrayBuffer());
    const file='textures/'+name+'_'+key+'.webp';
    await sharp(bytes).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).webp({quality:key==='map'?92:95}).toFile(join(out,file));maps[key]=file;
   }
   const next=new THREE.MeshStandardMaterial({name,color:0xffffff,roughness:.83,metalness:0,side:THREE.DoubleSide});
   materials[name]={...maps,alphaTest:/hair|eyelash/i.test(material.name+mesh.name)?.45:0};
   processed.set(material,next);return next;
  };
  mesh.material=Array.isArray(mesh.material)?await Promise.all(mesh.material.map(convert)):await convert(mesh.material);
 }
 const hip=root.getObjectByName('mixamorigHips');if(!hip)throw Error('Missing Mixamo hips: '+id);
 const clips={},animations=[];
 for(const [key,sourceName] of Object.entries(mapping)){
  const source=sourceClips.get(sourceName);if(!source)throw Error('Missing animation '+sourceName);
  const tracks=[],sourceTracks=source.clip.tracks.slice();
  const crouchCombat=/rifle_crouch_(fire|reload)/.test(key),unarmedCrouch=/^crouch/.test(key);
  const lowerBody=t=>/Hips.position|(?:Left|Right)(?:UpLeg|Leg|Foot|ToeBase)\./.test(t.name);
  const arm=t=>/(?:Left|Right)(?:Shoulder|Arm|ForeArm|Hand)/.test(t.name);
  if(crouchCombat){
   const lower=sourceClips.get('rifle8/idle crouching');
   for(let i=sourceTracks.length-1;i>=0;i--)if(lowerBody(sourceTracks[i]))sourceTracks.splice(i,1);
   for(const t of lower.clip.tracks.filter(lowerBody)){
    const copy=t.clone();for(let i=0;i<copy.times.length;i++)copy.times[i]*=source.clip.duration/lower.clip.duration;sourceTracks.push(copy);
   }
  }
  if(unarmedCrouch){
   const upper=sourceClips.get('locomotion/idle');
   for(let i=sourceTracks.length-1;i>=0;i--)if(arm(sourceTracks[i]))sourceTracks.splice(i,1);
   for(const t of upper.clip.tracks.filter(arm)){
    const copy=t.clone();for(let i=0;i<copy.times.length;i++)copy.times[i]*=source.clip.duration/upper.clip.duration;sourceTracks.push(copy);
   }
  }
  let speed=0;
  for(const original of sourceTracks){
   const track=original.clone();track.name=canonical(track.name);
   const node=track.name.slice(0,track.name.lastIndexOf('.'));if(!root.getObjectByName(node))continue;
   if(track.name.endsWith('.position')){
    if(node!=='mixamorigHips')continue;
    const ratio=hip.position.y/(crouchCombat?sourceClips.get('rifle8/idle crouching').height:source.height);
    const last=track.values.length-3;speed=Math.hypot(track.values[last]-track.values[0],track.values[last+2]-track.values[2])*.01*ratio/source.clip.duration;
    for(let i=0;i<track.values.length;i+=3){track.values[i]=hip.position.x;track.values[i+2]=hip.position.z;track.values[i+1]*=ratio;}
    if(key.startsWith('jump')||key==='vault_low')for(let i=1;i<track.values.length;i+=3)track.values[i]=hip.position.y;
   }
   tracks.push(track);
  }
  const clip=new THREE.AnimationClip(key,source.clip.duration,tracks).optimize();animations.push(clip);
  clips[key]={name:key,duration:clip.duration,speed,loop:key==='jump_air'||!(/fire|reload|jump|vault/.test(key)),source:sourceName,layered:crouchCombat||unarmedCrouch};
 }
 const container=new THREE.Group();container.name=id;container.scale.setScalar(.01);container.add(root);
 const binary=await new GLTFExporter().parseAsync(container,{binary:true,animations,onlyVisible:false});
 await writeFile(join(out,id+'.glb'),Buffer.from(binary));
 models.push({id,file:id+'.glb',bytes:binary.byteLength,triangles,bones,materials,clips});
 console.log(id,JSON.stringify({bytes:binary.byteLength,triangles,bones,animations:animations.length}));
}
await writeFile(join(out,'manifest.json'),JSON.stringify({provider:'mixamo',models,notes:'Native Mixamo clips; crouched combat overlays the original shooting/reload upper body on the crouched legs. World translation and jump height are controlled by game collision.'},null,2));
