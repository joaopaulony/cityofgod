// Run with the generator's tsx: tsx tools/export-characters.ts PATH_TO_3D_GEN
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const gen=resolve(process.argv[2]||'../character-tools/3d-gen');
const load=(file:string)=>import(pathToFileURL(join(gen,file)).href);
const {nodeLibrary}=await load('scripts/node-assets.ts');
const {DEFAULT_PARAMS,PRESETS}=await load('src/core/params.ts');
const {buildHuman,textureFiles}=await load('src/core/human.ts');
const {triangleCount}=await load('src/core/mesh.ts');
const {CLIPS,clipById}=await load('src/core/anim/clips/index.ts');
const {DEFAULT_EXPORT,planExport,runExport}=await load('src/export/index.ts');
const sharp=createRequire(join(gen,'package.json'))('sharp');
// In-place vault: game collision decides trajectory/height, never the clip.
const vault={id:'vault_low',name:'Vault low wall',duration:1.1,loop:false,category:'Actions',sample:(t:number)=>{
 const u=Math.max(0,Math.min(1,t/1.1)),w=Math.sin(u*Math.PI);
 return {bones:{Spine:[25*w,0,0],Spine1:[12*w,0,0],Head:[-15*w,0,0],LeftArm:[85*w,0,12*w],RightArm:[85*w,0,12*w],LeftForeArm:[30*w,0,0],RightForeArm:[30*w,0,0],LeftUpLeg:[80*w,0,18*w],RightUpLeg:[35*w,0,10*w],LeftLeg:[-100*w,0,0],RightLeg:[-75*w,0,0]},root:{y:0}};
}};
const crouchWalk={id:'crouch_walk',name:'Crouch walk',duration:1.2,loop:true,category:'Locomotion',sample:(t:number)=>{
 const s=clipById.get('crouch').sample(t),a=Math.sin(t/1.2*Math.PI*2);
 s.bones.LeftUpLeg[0]+=12*a;s.bones.RightUpLeg[0]-=12*a;
 s.bones.LeftLeg[0]-=15*a;s.bones.RightLeg[0]+=15*a;
 return s;
}};
const crouchVariant=(source:string,id:string,name:string)=>{
 const original=clipById.get(source);
 return {...original,id,name,sample:(t:number)=>{
  const upper=original.sample(t),lower=clipById.get('rifle_crouch_aim').sample(t);
  const arms=Object.fromEntries(Object.entries(upper.bones).filter(([name])=>!/(UpLeg|Leg|Foot|Toe)/.test(name)));
  return {...upper,bones:{...lower.bones,...arms},root:lower.root};
 }};
};
const crouchFire=crouchVariant('rifle_fire','rifle_crouch_fire','Crouch rifle fire');
const crouchReload=crouchVariant('rifle_reload','rifle_crouch_reload','Crouch rifle reload');
for(const c of [vault,crouchWalk,crouchFire,crouchReload]){CLIPS.push(c);clipById.set(c.id,c);}
const common=['idle','walk','run','walk_back','strafe_left','strafe_right','crouch','crouch_walk','jump_start','jump_air','jump_land','vault_low','wave'];
const rifle=['rifle_idle','rifle_aim','rifle_fire','rifle_reload','rifle_walk','rifle_walk_back','rifle_strafe_left','rifle_strafe_right','rifle_run','rifle_crouch_aim','rifle_crouch_walk','rifle_crouch_fire','rifle_crouch_reload'];
const out=resolve('assets/characters');await mkdir(out,{recursive:true});
const lib=await nodeLibrary(join(gen,'public/assets'));const manifest:any={generator:'olatunde85/3d-gen',revision:'8aa993d7141b6f37e5d16f611264e6f1ab520f30',models:[]};
for(const [id,preset,armed] of [['player','Athletic man',true],['lucas','Athletic man',false],['ana','Athletic woman',false]] as const){
 const params={...DEFAULT_PARAMS,...PRESETS[preset],name:id,age:.5,detail:'low',faceBones:false,faceShapes:false,weapon:armed?'rifle':'none'};
 const ch=await buildHuman(lib,params);
 for(const name of textureFiles(ch.mesh)){
  const data=await lib.texture(name);const image=sharp(data);const meta=await image.metadata();
  if((meta.width||0)>1024||(meta.height||0)>1024){
   const small=image.resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true});
   lib.registerTexture(name,await (name.endsWith('.png')?small.png():small.jpeg({quality:85})).toBuffer());
  }
 }
 const ids=armed?[...common,...rifle]:common;
 if(ids.some(id=>!clipById.has(id)))throw Error('Missing requested clip');
 const file=await runExport(lib,ch,planExport(ch,{...DEFAULT_EXPORT,format:'glb',clips:ids}));
 await writeFile(join(out,file.name),file.data);
 const muzzleZ=ch.weapon?Math.max(...ch.weapon.parts.flatMap((p:any)=>Array.from(p.mesh.positions).filter((_:any,i:number)=>i%3===2))):0;
 const spec={id,file:file.name,bytes:file.data.length,triangles:triangleCount(ch.mesh),bones:ch.rig.bones.length,params,clips:Object.fromEntries(ids.map(id=>[id,{name:clipById.get(id).name,duration:clipById.get(id).duration,loop:clipById.get(id).loop}])),weaponRotation:ch.weapon?.rot,muzzle:ch.weapon?[0,.06,muzzleZ]:undefined};
 manifest.models.push(spec);console.log(id,spec.bytes,spec.triangles,spec.bones);
}
await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(join(out,'LICENSE.txt'),'Ara 3D Gen code: MIT, https://github.com/olatunde85/3d-gen\nMakeHuman character assets: CC0 1.0, Data Collection AB, Joel Palmius, Jonas Hauquier.\nWalk, Run and Strafe motion: CMU Graphics Lab Motion Capture Database (NSF EIA-0196217). Commercial and non-commercial products allowed; motion data may not be resold alone.\nCity of God: custom low vault and crouch walk clips; 1024px maximum textures.\n');
