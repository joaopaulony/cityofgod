// City of God: procedural, original, rigged low-poly realistic adult bases.
// Generates real GLB 2.0 models with skinned meshes and embedded animation clips.
// No external models, subscriptions or network calls are needed.
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const OUTPUT=resolve(process.cwd(),'assets/characters/cas');
const TAU=Math.PI*2;
const matColors={Skin:[.83,.60,.48,1],Hair:[.25,.18,.14,1],Shirt:[.89,.36,.40,1],Pants:[.14,.16,.23,1],EyeWhite:[.93,.88,.81,1],Iris:[.35,.47,.50,1],Pupil:[.065,.055,.052,1],Lips:[.71,.39,.38,1],Nails:[.78,.51,.46,1],Shadow:[.67,.42,.33,1]};
const round=x=>Math.round(x*1e6)/1e6;
const lerp=(a,b,t)=>a+(b-a)*t;
function vec(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function normalize(a){const l=Math.hypot(...a)||1;return a.map(x=>x/l);}
function qx(deg){const a=deg*Math.PI/360;return [Math.sin(a),0,0,Math.cos(a)];}
function qz(deg){const a=deg*Math.PI/360;return [0,0,Math.sin(a),Math.cos(a)];}
function qy(deg){const a=deg*Math.PI/360;return [0,Math.sin(a),0,Math.cos(a)];}
function makeModel(sex){
 const woman=sex==='female';
 const vertices=[],joints=[],weights=[],faces=[],faceMaterial=[];
 const materialNames=Object.keys(matColors),materialIndex=n=>materialNames.indexOf(n);
 const bones=[];const boneIndex=new Map();
 function bone(name,pos,parent=null){const i=bones.length;boneIndex.set(name,i);bones.push({name,pos,parent});return i;}
 const hips=bone('mixamorigHips',[0,.94,0]);
 const spine=bone('mixamorigSpine',[0,1.085,0],hips);
 const spine1=bone('mixamorigSpine1',[0,1.24,0],spine);
 const spine2=bone('mixamorigSpine2',[0,1.42,0],spine1);
 const neck=bone('mixamorigNeck',[0,1.555,.008],spine2);
 const head=bone('mixamorigHead',[0,1.665,.012],neck);
 bone('mixamorigHeadTop_End',[0,1.82,.013],head);
 for(const side of ['Left','Right']){
  const s=side==='Left'?-1:1;
  const shoulder=bone('mixamorig'+side+'Shoulder',[s*(woman?.183:.215),1.45,0],spine2);
  const arm=bone('mixamorig'+side+'Arm',[s*(woman?.250:.280),1.426,0],shoulder);
  const fore=bone('mixamorig'+side+'ForeArm',[s*(woman?.356:.404),1.205,.008],arm);
  const hand=bone('mixamorig'+side+'Hand',[s*(woman?.460:.520),.992,.018],fore);
  bone('mixamorig'+side+'HandMiddle1',[s*(woman?.537:.612),.930,.040],hand);
  const thigh=bone('mixamorig'+side+'UpLeg',[s*(woman?.120:.113),.895,0],hips);
  const shin=bone('mixamorig'+side+'Leg',[s*.135,.500,.015],thigh);
  const foot=bone('mixamorig'+side+'Foot',[s*.135,.107,.018],shin);
  bone('mixamorig'+side+'ToeBase',[s*.135,.072,.124],foot);
 }
 const at=name=>boneIndex.get('mixamorig'+name);
 function part(jointA,jointB=null,t=0){return {joints:[jointA,jointB??jointA,0,0],weights:[1-t,t,0,0]};}
 function pv(pos,skin){vertices.push(pos);joints.push(skin.joints);weights.push(skin.weights);return vertices.length-1;}
 function tri(a,b,c,mat){faces.push([a,b,c]);faceMaterial.push(materialIndex(mat));}
 function quad(a,b,c,d,mat){tri(a,b,c,mat);tri(a,c,d,mat);}
 function rings(profiles,material,seg=28,skinner=null){
  const grids=[];
  for(let r=0;r<profiles.length;r++){
   const p=profiles[r],ring=[];
   for(let k=0;k<seg;k++){
    const a=TAU*k/seg;
    let x=p.x+Math.cos(a)*p.rx,z=p.z+Math.sin(a)*p.rz;
    if(p.deform){[x,z]=p.deform(x,z,a);}
    ring.push(pv([x,p.y,z],skinner?skinner(p,k,profiles):part(spine1)));
   }grids.push(ring);
  }
  for(let r=0;r<grids.length-1;r++)for(let k=0;k<seg;k++){
   const n=(k+1)%seg;quad(grids[r][k],grids[r+1][k],grids[r+1][n],grids[r][n],material);
  }
  return grids;
 }
 function ellipsoid(cx,cy,cz,rx,ry,rz,material,joint,lat=11,lon=18){
  const start=vertices.length;
  for(let a=0;a<=lat;a++){
   const theta=Math.PI*a/lat;
   for(let b=0;b<=lon;b++){
    const phi=TAU*b/lon;
    const s=Math.sin(theta);
    pv([cx+rx*s*Math.cos(phi),cy+ry*Math.cos(theta),cz+rz*s*Math.sin(phi)],part(joint));
   }
  }
  for(let a=0;a<lat;a++)for(let b=0;b<lon;b++){
   const k=start+a*(lon+1)+b;
   quad(k,k+(lon+1),k+(lon+1)+1,k+1,material);
  }
 }
 // Smooth body torso with anatomical waist, pelvis, trapezius and shoulder transitions.
 const shoulder=woman?.205:.249,hipWidth=woman?.195:.19;
 const torso=[
  [.885,hipWidth,.126],[.93,hipWidth+.004,.128],[1.01,hipWidth-.012,.115],
  [1.09,woman?.159:.165,.109],[1.19,woman?.143:.178,.114],
  [1.29,woman?.165:.205,.122],[1.39,shoulder-.010,woman?.126:.132],
  [1.47,shoulder,.113],[1.525,.108,.080],[1.555,.061,.056]
 ].map(([y,rx,rz])=>({x:0,y,z:0,rx,rz}));
 rings(torso,'Skin',32,p=>{
  const y=p.y;let j1=hips,j2=spine,t=0;
  if(y<1.055){j1=hips;j2=spine;t=Math.max(0,Math.min(1,(y-.94)/.13));}
  else if(y<1.235){j1=spine;j2=spine1;t=(y-1.08)/.16;}
  else if(y<1.41){j1=spine1;j2=spine2;t=(y-1.24)/.18;}
  else {j1=spine2;j2=neck;t=Math.max(0,(y-1.42)/.15)*.25;}
  return part(j1,j2,Math.min(1,t));
 });
 // Collar and shoulder volumes; skin-toned breast contour for female torso.
 if(woman){
  for(const s of [-1,1])ellipsoid(s*.105,1.380,.078,.092,.070,.057,'Skin',spine2,13,20);
 }else{
  for(const s of [-1,1])ellipsoid(s*.111,1.382,.081,.117,.075,.047,'Skin',spine2,9,18);
 }
 rings([[1.515,.062,.064],[1.558,.052,.051],[1.615,.067,.057]].map(([y,rx,rz])=>({x:0,y,z:.009,rx,rz})),'Skin',22,()=>part(neck,head,.22));
 // Ellipsoid face is a continuous anatomical mesh: cheeks, forehead, jaw and chin.
 const H=1.695,faceBottom=1.548;
 const faceRings=[
  [1.551,.038,.038,.025],[1.572,.074,.070,.016],
  [1.602,.095,.079,.014],[1.635,.108,.086,.014],[1.675,.117,.091,.010],
  [1.719,.115,.089,.009],[1.757,.105,.083,.006],[1.798,.078,.065,0],[1.823,.018,.023,0]
 ].map(([y,rx,rz,z])=>({x:0,y,z,rx:woman?rx:rx*1.065,rz}));
 rings(faceRings,'Skin',36,()=>part(head));
 // Ears, bridge, nostril, brow ridge and round cheek highlights.
 for(const s of [-1,1]){
  ellipsoid(s*(woman?.113:.120),1.675,.003,.015,.032,.013,'Skin',head,9,13);
  ellipsoid(s*(woman?.111:.118),1.672,.015,.006,.020,.006,'Shadow',head,6,9);
  // Natural cheeks are part of the face surface (no separate bulging disks).
  ellipsoid(s*.052,1.707,.097,.027,.013,.008,'EyeWhite',head,11,18);
  ellipsoid(s*.052,1.707,.105,.011,.012,.004,'Iris',head,9,14);
  ellipsoid(s*.052,1.707,.109,.005,.008,.002,'Pupil',head,8,12);
  ellipsoid(s*.048,1.712,.112,.003,.003,.001,'EyeWhite',head,6,8);
  // Scaled curved eyebrows, thin and fully separate for recoloring.
  for(let i=0;i<7;i++){
   const t=i/6,x=s*(.024+t*.059),y=1.748+.007*Math.sin(t*Math.PI)-.007*t;
   ellipsoid(x,y,.095-(t*.009),.009,.0038,.004,'Hair',head,5,8);
  }
  ellipsoid(s*.019,1.649,.105,.017,.012,.011,'Skin',head,7,10);
 }
 ellipsoid(0,1.674,.095,.018,.038,.022,'Skin',head,11,16);
 ellipsoid(0,1.650,.118,.025,.012,.013,'Skin',head,9,13);
 // Subtle upper and lower lips, facial detail without textures.
 ellipsoid(0,1.611,.092,.031,.008,.008,'Lips',head,6,16);
 ellipsoid(0,1.600,.092,.028,.006,.006,'Lips',head,6,16);
 ellipsoid(0,1.603,.099,.025,.0015,.002,'Shadow',head,4,16);
 // Arms and legs are smooth swept tubes weighted into adjacent joints.
 function limb(a,b,startRadius,endRadius,mat,jointA,jointB,segments=18){
  const direction=normalize(vec(b,a));const up=Math.abs(direction[1])<.85?[0,1,0]:[0,0,1];
  const u=normalize(cross(direction,up)),v=normalize(cross(direction,u));
  const sections=7,ringsIdx=[];
  for(let i=0;i<sections;i++){
   const t=i/(sections-1),p=a.map((x,n)=>lerp(x,b[n],t)),rad=lerp(startRadius,endRadius,t)*(1+Math.sin(Math.PI*t)*.055);
   const circle=[];
   for(let k=0;k<segments;k++){
    const angle=TAU*k/segments,dist=rad*(1-(t===0||t===1?.08:0));
    const xyz=p.map((x,n)=>x+u[n]*Math.cos(angle)*dist+v[n]*Math.sin(angle)*dist);
    circle.push(pv(xyz,part(jointA,jointB,Math.max(0,Math.min(1,(t-.52)/.45)))));
   }ringsIdx.push(circle);
  }
  for(let i=0;i<sections-1;i++)for(let k=0;k<segments;k++){
   const n=(k+1)%segments;
   quad(ringsIdx[i][k],ringsIdx[i+1][k],ringsIdx[i+1][n],ringsIdx[i][n],mat);
  }
 }
 for(const side of ['Left','Right']){
  const s=side==='Left'?-1:1,armX=woman?.250:.280,elbowX=woman?.356:.404,handX=woman?.460:.520;
  const upper=at(side+'Arm'),lower=at(side+'ForeArm'),wrist=at(side+'Hand');
  ellipsoid(s*(armX-.010),1.428,0,woman?.070:.079,.067,.077,'Skin',upper,11,18);
  limb([s*(armX-.01),1.440,0],[s*elbowX,1.204,.008],woman?.065:.077,.049,'Skin',upper,lower);
  ellipsoid(s*elbowX,1.204,.008,.050,.052,.048,'Skin',lower,9,12);
  limb([s*elbowX,1.206,.008],[s*handX,.994,.020],woman?.049:.055,.032,'Skin',lower,wrist);
  ellipsoid(s*(handX+.017),.961,.028,.033,.053,.026,'Skin',wrist,10,14);
  ellipsoid(s*(handX+.038),.918,.035,.026,.024,.020,'Skin',wrist,8,13);
  ellipsoid(s*(handX-.015),.940,.074,.014,.030,.016,'Skin',wrist,8,10);
  const thigh=at(side+'UpLeg'),shin=at(side+'Leg'),foot=at(side+'Foot');
  limb([s*.12,.899,0],[s*.135,.502,.012],woman?.105:.105,woman?.076:.079,'Skin',thigh,shin,24);
  ellipsoid(s*.135,.500,.012,.078,.079,.080,'Skin',shin,9,15);
  limb([s*.135,.496,.012],[s*.134,.110,.023],.076,.044,'Skin',shin,foot,22);
  // Feet and toes are weighted to the ankle for convincing turns.
  ellipsoid(s*.135,.075,.068,.055,.065,.113,'Skin',foot,10,20);
  for(let t=0;t<4;t++)ellipsoid(s*(.104+t*.019),.036,.150,.014,.015,.023,'Skin',foot,7,10);
 }
 // Simple undergarments, close to the provided adult Sims-like reference.
 const pants=woman?'Shirt':'Pants';
 if(woman){
  // Strapless red bra with a smooth lower band and two fitted cups.
  rings([[1.342,.177,.125],[1.358,.182,.131]].map(([y,rx,rz])=>({y,x:0,z:0,rx,rz})),'Shirt',32,()=>part(spine2));
  for(const s of [-1,1])ellipsoid(s*.102,1.391,.130,.087,.054,.032,'Shirt',spine2,14,22);
  // Underwear sits at hip level and tapers to a central triangle.
  rings([[.781,.110,.104],[.829,.174,.121],[.875,.194,.126]].map(([y,rx,rz])=>({y,x:0,z:0,rx,rz})),'Shirt',28,()=>part(hips));
 }else{
  rings([[.724,.168,.110],[.765,.182,.118],[.827,.191,.126],[.879,.192,.126]].map(([y,rx,rz])=>({y,x:0,z:0,rx,rz})),'Pants',28,()=>part(hips));
  for(const s of [-1,1])rings([[.715,.099,.085],[.735,.101,.092],[.767,.107,.101]].map(([y,rx,rz])=>({y,x:s*.114,z:.005,rx,rz})),'Pants',18,()=>part(hips));
 }
 // Make winding consistent and compute smooth vertex normals.
 const normalAcc=vertices.map(()=>[0,0,0]);
 for(const f of faces){
  const n=cross(vec(vertices[f[1]],vertices[f[0]]),vec(vertices[f[2]],vertices[f[0]]));
  for(const i of f)for(let k=0;k<3;k++)normalAcc[i][k]+=n[k];
 }
 const normals=normalAcc.map(normalize);
 const parts=new Map();for(let i=0;i<faces.length;i++){
  const index=faceMaterial[i];if(!parts.has(index))parts.set(index,[]);
  parts.get(index).push(...faces[i]);
 }
 return {sex,woman,vertices,normals,joints,weights,bones,parts,materials:materialNames,triangles:faces.length};
}
function toGlb(model){
 const {vertices,normals,joints,weights,bones,parts,materials}=model;
 const gltf={asset:{version:'2.0',generator:'City of God CAS original low-poly realista v1'},scene:0,scenes:[{nodes:[0]}],nodes:[],meshes:[{name:model.sex+'-base',primitives:[]}],skins:[],materials:[],buffers:[{byteLength:0}],bufferViews:[],accessors:[],animations:[]};
 const bin=[];let offset=0;
 const align=(n=4)=>{while(offset%n){bin.push(Buffer.from([0]));offset++;}};
 const push=(data,target=null)=>{
  align(4);const view={buffer:0,byteOffset:offset,byteLength:data.length};
  if(target)view.target=target;
  gltf.bufferViews.push(view);bin.push(data);offset+=data.length;return gltf.bufferViews.length-1;
 };
 function acc(view,componentType,type,count,min=null,max=null){
  const item={bufferView:view,componentType,type,count};
  if(min)item.min=min;if(max)item.max=max;
  gltf.accessors.push(item);return gltf.accessors.length-1;
 }
 function floatAttr(rows,type,n){
  const f=new Float32Array(rows.flat()),b=Buffer.from(f.buffer);
  const v=push(b,34962);return acc(v,5126,type,rows.length,
   n===3?[Math.min(...rows.map(x=>x[0])),Math.min(...rows.map(x=>x[1])),Math.min(...rows.map(x=>x[2]))]:null,
   n===3?[Math.max(...rows.map(x=>x[0])),Math.max(...rows.map(x=>x[1])),Math.max(...rows.map(x=>x[2]))]:null);
 }
 const positions=floatAttr(vertices,'VEC3',3),ns=floatAttr(normals,'VEC3',0);
 const jointsBuffer=new Uint16Array(joints.flat()),jv=push(Buffer.from(jointsBuffer.buffer),34962),ji=acc(jv,5123,'VEC4',joints.length);
 const wi=floatAttr(weights,'VEC4',0);
 for(const name of materials){
  const rgba=matColors[name];
  gltf.materials.push({name,pbrMetallicRoughness:{baseColorFactor:rgba,metallicFactor:0,roughnessFactor:name==='EyeWhite'||name==='Iris'?.42:.82},doubleSided:true});
 }
 for(const [mat,indices] of parts){
  const arr=new Uint16Array(indices),iv=push(Buffer.from(arr.buffer),34963),idx=acc(iv,5123,'SCALAR',arr.length);
  gltf.meshes[0].primitives.push({attributes:{POSITION:positions,NORMAL:ns,JOINTS_0:ji,WEIGHTS_0:wi},indices:idx,material:mat});
 }
 // Skeleton root and mesh are siblings, both inside an enclosing container node.
 gltf.nodes.push({name:'CityCASRoot',children:[1,2]});
 gltf.nodes.push({name:'CityCASBody',mesh:0,skin:0});
 const jointIndices=[];
 for(let i=0;i<bones.length;i++){
  const bone=bones[i],parent=bone.parent;
  const origin=parent===null?[0,0,0]:bones[parent].pos;
  const p=vec(bone.pos,origin).map(round);
  const id=gltf.nodes.length;gltf.nodes.push({name:bone.name,translation:p,children:[]});jointIndices.push(id);
 }
 gltf.nodes[0].children=[1,jointIndices[0]];
 bones.forEach((b,i)=>{if(b.parent!==null)gltf.nodes[jointIndices[b.parent]].children.push(jointIndices[i]);});
 for(const id of jointIndices)if(!gltf.nodes[id].children.length)delete gltf.nodes[id].children;
 const ibm=[];
 for(const bone of bones){
  const [x,y,z]=bone.pos;ibm.push(1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1);
 }
 const iv=push(Buffer.from(new Float32Array(ibm).buffer)),ia=acc(iv,5126,'MAT4',bones.length);
 gltf.skins.push({name:'CityCASRig',joints:jointIndices,inverseBindMatrices:ia,skeleton:jointIndices[0]});
 // Looping clips bind to native joints. Three.js AnimationMixer will play them.
 const animations=[
  ['idle',2.7,0],['walk',1.02,1],['run',.68,1.65],
  ['crouch',2.1,0],['crouch_walk',1.2,.50],['rifle_idle',2.3,0],
  ['rifle_aim',2.2,0],['rifle_walk',1.14,.70],['rifle_run',.77,1.2],
  ['jump_start',.45,.25],['jump_air',.8,.1],['jump_land',.6,.25],
  ['rifle_fire',.4,.20],['rifle_reload',1.8,.1]
 ];
 const baseKeys=['Hips','Spine','Spine1','Spine2','Neck','Head',
  'LeftArm','RightArm','LeftForeArm','RightForeArm',
  'LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot'];
 for(const [name,duration,gait] of animations){
  const times=[0,duration/4,duration/2,3*duration/4,duration];
  const timeView=push(Buffer.from(new Float32Array(times).buffer));
  const timeAcc=acc(timeView,5126,'SCALAR',times.length,[0],[duration]);
  const clips={name,samplers:[],channels:[]};
  for(const key of baseKeys){
   const values=[];
   for(let k=0;k<times.length;k++){
    const phase=TAU*k/4,step=Math.sin(phase),run=/run/.test(name),walk=/walk/.test(name),crouch=/crouch/.test(name),aim=/rifle/.test(name);
    let deg=0;
    if(key==='LeftUpLeg')deg=step*27*gait;
    if(key==='RightUpLeg')deg=-step*27*gait;
    if(key==='LeftLeg')deg=Math.max(0,-step)*24*gait;
    if(key==='RightLeg')deg=Math.max(0,step)*24*gait;
    if(key==='LeftArm')deg=-step*21*gait+(aim?-17:0);
    if(key==='RightArm')deg=step*21*gait+(aim?-18:0);
    if(key==='LeftForeArm'||key==='RightForeArm')deg=-(aim?34:13)-(run?9:0);
    if(key==='Spine'||key==='Spine1')deg=Math.sin(phase)*1.5;
    if(key==='Head')deg=-Math.sin(phase)*1;
    if(key==='LeftFoot')deg=-Math.max(0,-step)*9*gait;
    if(key==='RightFoot')deg=-Math.max(0,step)*9*gait;
    if(crouch){if(key==='LeftUpLeg'||key==='RightUpLeg')deg-=27;
     if(key==='LeftLeg'||key==='RightLeg')deg+=52;
     if(key==='Spine1')deg+=13;}
    if(name==='jump_start'||name==='jump_land'){if(key.endsWith('UpLeg'))deg-=17;
     if(key.endsWith('Leg'))deg+=28;}
    if(name==='rifle_fire'&&key==='RightArm')deg-=Math.sin(Math.PI*k/4)*13;
    values.push(...qx(deg));
   }
   const v=push(Buffer.from(new Float32Array(values).buffer));
   const accessor=acc(v,5126,'VEC4',times.length);
   const joint=jointIndices[bones.findIndex(b=>b.name==='mixamorig'+key)];
   clips.samplers.push({input:timeAcc,output:accessor,interpolation:'LINEAR'});
   clips.channels.push({sampler:clips.samplers.length-1,target:{node:joint,path:'rotation'}});
  }
  gltf.animations.push(clips);
 }
 gltf.buffers[0].byteLength=offset;
 let js=Buffer.from(JSON.stringify(gltf),'utf8');const jspad=(4-js.length%4)%4;
 js=Buffer.concat([js,Buffer.alloc(jspad,0x20)]);
 align(4);const binary=Buffer.concat(bin),file=Buffer.alloc(12+8+js.length+8+binary.length);
 file.write('glTF',0);file.writeUInt32LE(2,4);file.writeUInt32LE(file.length,8);
 file.writeUInt32LE(js.length,12);file.write('JSON',16);js.copy(file,20);
 const pos=20+js.length;file.writeUInt32LE(binary.length,pos);file.write('BIN\0',pos+4,'binary');binary.copy(file,pos+8);
 return file;
}
await mkdir(OUTPUT,{recursive:true});
const manifest={schema:1,generatedBy:'tools/generate-cas-bases.mjs',models:[]};
for(const sex of ['male','female']){
 const model=makeModel(sex),data=toGlb(model),file=sex+'.glb';
 await writeFile(join(OUTPUT,file),data);
 manifest.models.push({sex,file,rig:'mixamo',materialSlots:{skin:['Skin'],hair:['Hair'],top:['Shirt'],bottom:['Pants']},
  description:'Base adulta low-poly realista procedural, rigada e animada; roupas íntimas iniciais, corpo e rosto originais',triangles:model.triangles,bytes:data.length});
 console.log('CAS GLB',file,model.triangles,'triângulos',model.bones.length,'ossos',data.length,'bytes');
}
await writeFile(join(OUTPUT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');