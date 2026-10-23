// Veiculo GLB REAL: Three.js/WebGL em todo frame. Nunca tira screenshots,
// nao gera sprites, nao usa drawImage para carroceria e nao usa Blender.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {CAR_SPEC,stepCar,cameraLead} from './vehicle-physics.mjs';
import {VEHICLE_MODELS,CIVIL_PACK_EXPECTED,getVehicleById} from './vehicle-catalog.mjs';
import {createWheelRig,stepWheelRig,resetWheelRig} from './vehicle-wheels.mjs';

const bridge=window.cityVehicleBridge;
if(!bridge)throw Error('Missing City of God live 3D vehicle bridge');
const canvas=document.querySelector('#vehicle3d');
const state={x:0,y:0,angle:0,speed:0,steer:0,distance:0};
const modelId=new URLSearchParams(location.search).get('vehicleModel')||'silvia';
let activeModel=getVehicleById(modelId)||VEHICLE_MODELS[0],wheelRig=null,
 gltfLoader=null,loadingSerial=0;
const modelCache=new Map();
const system={
 ready:false,driver:false,engineOn:false,headlights:false,braking:false,
 model:activeModel.name,modelId:activeModel.id,status:'loading',car:state,
 source:'assets/vehicles/live/'+activeModel.file,shadows:0,
 catalog:VEHICLE_MODELS,pendingCivilModels:CIVIL_PACK_EXPECTED,
 wheelStatus:'loading',available:VEHICLE_MODELS.length
};
window.cityVehicles=system;
let renderer=null,model=null,scene=null,viewCamera=null,body=null,
 shadowGround=null,lampL=null,lampR=null,occluders=[];
const METERS=CAR_SPEC.length;

function nearestSafeParking(){
 const p=bridge.player;
 const around=[];
 for(const r of bridge.world.roads)
  for(let i=2;i<r.pts.length-2;i+=5){
   const q=r.pts[i],d=Math.hypot(q.x-p.x,q.y-p.y);
   if(d<22&&d>2.8)around.push({x:q.x,y:q.y,angle:Math.atan2(q.ty,q.tx),d});
  }
 around.sort((a,b)=>a.d-b.d);
 // Evita estacionar em quintais onde o carro fica preso em poucos metros.
 for(const q of around){
  const runway=[0,3,6,9,12].every(k=>isFree(
   q.x+Math.cos(q.angle)*k,q.y+Math.sin(q.angle)*k,q.angle));
  if(runway)return q;
 }
 for(const q of around)if(isFree(q.x,q.y,q.angle))return q;
 // O spawn original prioriza floresta, nao proximidade de estradas.
 // Garantir carro acessivel mesmo em seeds longe de ruas.
 for(const radius of [3.5,5,7,9,12]){
  for(let i=0;i<16;i++){
   const a=i*Math.PI/8,x=p.x+Math.cos(a)*radius,y=p.y+Math.sin(a)*radius;
   if(isFree(x,y,a))return {x,y,angle:a};
  }
 }
 return {x:p.x+3,y:p.y+2,angle:0};
}
function isFree(x,y,a){
 const w=CAR_SPEC.width*.44,l=activeModel.length*.43,
  vec=[[0,0],[l,w],[l,-w],[-l,w],[-l,-w]];
 for(const [u,v] of vec){
  const px=x+Math.cos(a)*u-Math.sin(a)*v,
   py=y+Math.sin(a)*u+Math.cos(a)*v;
  if(px<2||py<2||px>bridge.mapSize-2||py>bridge.mapSize-2)
   return false;
  if(bridge.world.blocked(px,py,.23))return false;
  if(bridge.pondVal(px,py)<1.12)return false;
  for(const c of bridge.world.circles)
   if(c!==system.collider&&Math.hypot(px-c.x,py-c.y)<c.r+.35)return false;
 }
 return true;
}
function setupCar(){
 const q=nearestSafeParking();
 Object.assign(state,q,{speed:0,steer:0,distance:0});
 // Piloto 3D: se o ponto de nascimento original ficar distante da via,
 // posiciona o personagem ao lado do carro para a demonstracao dirigir.
 const p=bridge.player;
 if(Math.hypot(p.x-q.x,p.y-q.y)>6){
  p.x=q.x-Math.sin(q.angle)*2.2;
  p.y=q.y+Math.cos(q.angle)*2.2;
  bridge.cam.x=bridge.cam.tx=p.x;
  bridge.cam.y=bridge.cam.ty=p.y;
 }
 system.position={...q};
 system.collider={x:state.x,y:state.y,r:1.05,kind:'vehicle',h:1.4};
 bridge.world.circles.push(system.collider);
}
function makeOccluders(){
 // A profundidade vem da geometria REAL de cada fachada e da água do telhado.
 // Não usar caixas fechadas: seus topos quadrados ocultavam carros junto
 // aos beirais e criavam quadrados invisíveis ao girar a câmera.
 const invisible=new THREE.MeshBasicMaterial({
  colorWrite:false,depthWrite:true,depthTest:true,side:THREE.DoubleSide
 });
 const face=(vertices,output)=>{
  const p=vertices.map(([x,y,z])=>[x,z,y]);
  for(let i=1;i<p.length-1;i++)
   for(const v of [p[0],p[i],p[i+1]])output.push(...v);
 };
 for(const H of bridge.houses){
  const w=H.x1-H.x0,d=H.y1-H.y0;
  if(w<=0||d<=0)continue;
  const verts=[];
  for(const side of Object.values(H.sides||{})){
   const a=side.a,b=[a[0]+side.dir[0]*side.len,
                      a[1]+side.dir[1]*side.len];
   const h=side.Hc||H.h;
   face([[a[0],a[1],0],[b[0],b[1],0],
     [b[0],b[1],h],[a[0],a[1],h]],verts);
  }
  const roof=H.roofGeom||(H.roofGeom=bridge.buildRoofGeom(H));
  if(roof.flat)
   face([[H.x0,H.y0,H.h],[H.x1,H.y0,H.h],
    [H.x1,H.y1,H.h],[H.x0,H.y1,H.h]],verts);
  else for(const f of roof.faces)face(f.p,verts);
  if(!verts.length)continue;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  const mesh=new THREE.Mesh(geometry,invisible);
  mesh.userData.house=H;mesh.frustumCulled=false;
  scene.add(mesh);occluders.push(mesh);
 }
 system.houseOccluders=occluders.length;
 // Cercas tambem tapam corretamente partes do veiculo quando estao a frente.
 // Um unico draw call instanciado em vez de milhares de meshes separados.
 const fenceSegments=bridge.world.segs.filter(q=>q.kind==='fence'&&q.h>0);
 if(fenceSegments.length){
  const fence3d=new THREE.InstancedMesh(
    new THREE.BoxGeometry(1,1,.13),invisible,fenceSegments.length);
  const yAxis=new THREE.Vector3(0,1,0),matrix=new THREE.Matrix4();
  for(let i=0;i<fenceSegments.length;i++){
   const q=fenceSegments[i],dx=q.x2-q.x1,dy=q.y2-q.y1,
    len=Math.hypot(dx,dy)||.01;
   matrix.compose(
    new THREE.Vector3((q.x1+q.x2)/2,q.h/2,(q.y1+q.y2)/2),
    new THREE.Quaternion().setFromAxisAngle(yAxis,-Math.atan2(dy,dx)),
    new THREE.Vector3(len,q.h,1));
   fence3d.setMatrixAt(i,matrix);
  }
  fence3d.instanceMatrix.needsUpdate=true;
  fence3d.frustumCulled=false;
  scene.add(fence3d);
  system.fenceOccluders=fenceSegments.length;
 }
}
function importModel(root,config=activeModel){
 // Normaliza tamanho/pivo mantendo todos os materiais e a geometria GLB.
 root.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(root);
 if(box.isEmpty())throw Error('GLB without geometry');
 const dim=new THREE.Vector3();box.getSize(dim);
 if(dim.y<.1||dim.x<.2||dim.z<.2)throw Error('Invalid GLB dimensions');
 const origin=new THREE.Vector3();box.getCenter(origin);
 const positioned=new THREE.Group();
 positioned.position.set(-origin.x,-box.min.y,-origin.z);
 positioned.add(root);
 const scaled=new THREE.Group();
 // S13 source is longitudinal along Z; source length 4.47 m.
 const scale=config.length/Math.max(dim.z,dim.x);
 scaled.scale.setScalar(scale);scaled.add(positioned);
 const aligned=new THREE.Group();
 // Frente original ao longo de +Z: girar para +X antes do yaw do carro.
 aligned.rotation.y=config.front==='+Z'?Math.PI/2:-Math.PI/2;
 aligned.add(scaled);
 body=new THREE.Group();body.add(aligned);scene.add(body);
 root.traverse(obj=>{
  if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}
 });
 wheelRig=createWheelRig(root,THREE,{forward:config.front});
 system.wheels=wheelRig.metadata;
 system.wheelStatus=wheelRig.complete?'4 rodas articuladas':
  wheelRig.wheels.size+' de 4 rodas identificadas';
 model=root;
 system.meshes=root.getObjectByProperty('isMesh',true)?1:0;
 system.sourceSize=dim.toArray();
 system.model=config.name;system.modelId=config.id;
 system.source='assets/vehicles/live/'+config.file;
}
function createLamp(){
 const mk=()=>new THREE.SpotLight(0xfff1c8,0,16,Math.PI/7,.45,1.2);
 lampL=mk();lampR=mk();
 const extent=activeModel.length*.38;
 for(const [light,side] of [[lampL,-1],[lampR,1]]){
  body.add(light);light.position.set(extent,.77,side*.63);
  light.target.position.set(extent+5,-.15,side*.85);body.add(light.target);
 }
}
function initRenderer(){
 renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,
  powerPreference:'high-performance',premultipliedAlpha:false});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.45;
 renderer.setClearColor(0x000000,0);
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene=new THREE.Scene();
 scene.add(new THREE.HemisphereLight(0xeaf3ff,0x343630,2));
 const sun=new THREE.DirectionalLight(0xffe8c3,2.8);
 sun.position.set(-11,18,15);
 sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);
 sun.shadow.camera.left=-12;sun.shadow.camera.right=12;
 sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;
 sun.shadow.camera.near=.1;sun.shadow.camera.far=60;
 sun.shadow.bias=-.0003;scene.add(sun);
 scene.userData.sun=sun;
 const bounce=new THREE.DirectionalLight(0x96b3ff,.65);
 bounce.position.set(7,9,-8);scene.add(bounce);
 // Material ShadowMaterial só mostra sombra real do carro; solo e todo o
 // mapa continuam exatamente como foram desenhados.
 shadowGround=new THREE.Mesh(
  new THREE.PlaneGeometry(12,12),
  new THREE.ShadowMaterial({opacity:.33,transparent:true,depthWrite:false}));
 shadowGround.rotation.x=-Math.PI/2;
 shadowGround.position.y=.008;
 shadowGround.receiveShadow=true;scene.add(shadowGround);
 viewCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,160);
 makeOccluders();
}
function setCamera(){
 const c=bridge.cam,w=c.W,h=c.H;
 if(!w||!h)return;
 const pixelRatio=Math.min(devicePixelRatio||1,1.5);
 const wantedW=Math.round(w*pixelRatio),wantedH=Math.round(h*pixelRatio);
 if(canvas.width!==wantedW||canvas.height!==wantedH)
  renderer.setSize(w,h,false);
 // Canvas 2D world x/y -> Three x/z, world height -> Three Y.
 // Câmera isometrica exatamente igual a proj(): TILT=.5 e HZ=.866.
 const distance=40,elev=Math.asin(.5),plane=Math.cos(elev)*distance;
 const a=c.ang;
 viewCamera.position.set(c.x+Math.sin(a)*plane,Math.sin(elev)*distance,
  c.y+Math.cos(a)*plane);
 viewCamera.lookAt(c.x,0,c.y);
 viewCamera.left=-w/(2*c.zoom);viewCamera.right=w/(2*c.zoom);
 viewCamera.top=h/(2*c.zoom);viewCamera.bottom=-h/(2*c.zoom);
 viewCamera.updateProjectionMatrix();
 scene.userData.sun.position.set(state.x-11,18,state.y+15);
 scene.userData.sun.target.position.set(state.x,0,state.y);
 scene.userData.sun.target.updateMatrixWorld();
}
function moveCar(dt){
 const c=bridge;
 if(!system.driver)return;
 const p=bridge.player;
 const inControl={
  forward:system.engineOn&&c.down('w'),
  reverse:system.engineOn&&c.down('s'),
  left:c.down('a'),right:c.down('d'),
  handbrake:c.down(' '),engineOn:system.engineOn
 };
 const old={...state},next=stepCar(state,inControl,dt,{...CAR_SPEC,length:activeModel.length,wheelbase:Math.min(CAR_SPEC.wheelbase,activeModel.length*.65)});
 if(isFree(next.x,next.y,next.angle)){
  Object.assign(state,next);
 }else{
  // Choque: desliga deslocamento mas mantém a orientação anterior.
  Object.assign(state,old,{speed:0});
 }
 system.braking=c.down('s')||c.down(' ');
 const signedTravel=(state.x-old.x)*Math.cos(old.angle)+
   (state.y-old.y)*Math.sin(old.angle);
 stepWheelRig(wheelRig,signedTravel,state.steer);
 system.collider.x=state.x;system.collider.y=state.y;
 p.x=state.x;p.y=state.y;p.speed=0;p.wantShot=false;p.aiming=false;
 p.running=false;p.aimHold=0;
 const lead=cameraLead(state);
 c.cam.tx=lead.x;c.cam.ty=lead.y;
}
function interact(){
 const p=bridge.player;
 if(!system.ready)return false;
 if(system.driver){
  const side=1.7;
  for(const sign of [1,-1]){
   const x=state.x-Math.sin(state.angle)*side*sign,
    y=state.y+Math.cos(state.angle)*side*sign;
   if(!bridge.world.blocked(x,y,.33)&&bridge.pondVal(x,y)>1.1){
    p.x=x;p.y=y;
    system.driver=false;system.braking=false;
    return 'Saiu do veículo';
   }
  }
  return 'Não há espaço para sair';
 }
 if(Math.hypot(p.x-state.x,p.y-state.y)>3.3)return false;
 system.driver=true;system.engineOn=true;p.x=state.x;p.y=state.y;
 return 'Entrou no '+activeModel.name+' — W/S acelerar, A/D esterçar, Espaço freio';
}
function drawPanel(g,w,h){
 if(!system.ready)return;
 const near=Math.hypot(bridge.player.x-state.x,bridge.player.y-state.y)<3.8;
 if(!system.driver&&!near)return;
 g.save();
 if(system.driver){
  const x=w/2-182,y=h-175;
  g.fillStyle='rgba(13,17,20,.9)';
  g.beginPath();g.roundRect(x,y,364,65,10);g.fill();
  g.fillStyle='#f2e9d4';g.font='bold 24px system-ui';
  g.fillText(String(Math.round(Math.abs(state.speed)*3.6)).padStart(2,'0'),
    x+20,y+35);
  g.font='12px system-ui';g.fillStyle='#9cb0b6';g.fillText('km/h',x+73,y+33);
  g.font='bold 17px system-ui';g.fillStyle='#dfc887';
  g.fillText(state.speed<-.2?'R':state.speed>.2?'D':'N',x+137,y+34);
  g.font='12px system-ui';g.fillStyle='#d0d4d1';
  g.fillText(system.engineOn?'MOTOR LIGADO':'MOTOR DESLIGADO',x+190,y+32);
  g.font='11px system-ui';g.fillStyle='#b8bcc1';
  g.fillText('F sair  ·  X motor  ·  L faróis  ·  H buzina',x+15,y+56);
 }else{
  g.font='bold 12px system-ui';g.textAlign='center';
  g.fillStyle='#f4dc9a';
  g.fillText('F entrar · V próximo carro ('+
   (VEHICLE_MODELS.findIndex(v=>v.id===activeModel.id)+1)+'/'+VEHICLE_MODELS.length+')',
   w/2,h-132);
 }
 g.restore();
}
function engineSound(){
 const Context=window.AudioContext||window.webkitAudioContext;
 if(!Context)return;
 try{
  const a=new Context(),o=a.createOscillator(),gain=a.createGain();
  o.type='sawtooth';o.frequency.value=220;
  gain.gain.setValueAtTime(.025,a.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001,a.currentTime+.22);
  o.connect(gain);gain.connect(a.destination);o.start();o.stop(a.currentTime+.23);
  o.onended=()=>a.close();
 }catch(error){console.warn('Horn unavailable',error);}
}
system.update=dt=>{
 if(!system.ready)return;
 if(bridge.hit('x')&&system.driver)system.engineOn=!system.engineOn;
 if(bridge.hit('l')&&system.driver)system.headlights=!system.headlights;
 if(bridge.hit('h')&&system.driver)engineSound();
 if(bridge.hit('v')&&!system.driver)system.nextModel();
 moveCar(dt);
};
system.interact=interact;
system.drawHUD=drawPanel;
system.prompt=()=>system.ready&&!system.driver&&
 Math.hypot(bridge.player.x-state.x,bridge.player.y-state.y)<3.3
 ?'F — entrar no '+activeModel.name:null;
system.render=()=>{
 if(!system.ready||!renderer)return;
 const c=bridge.cam;
 setCamera();
 body.position.set(state.x,0,state.y);
 body.rotation.y=-state.angle;
 // O pivô do GLB aponta para +X; Three Y positivo gira ao contrario
 // do yaw positivo em coordenadas x/y do jogo.
 shadowGround.position.x=state.x;shadowGround.position.z=state.y;
 for(const o of occluders)o.visible=!o.userData.house.inside;
 if(lampL&&lampR){
  lampL.intensity=lampR.intensity=system.headlights?12:0;
 }
 renderer.render(scene,viewCamera);
 system.frames=(system.frames||0)+1;
 system.lastScreenPosition={
  // GLB em tempo real usa exatamente a mesma projecao ortografica.
  x:c.W/2+(c.cos*(state.x-c.x)-c.sin*(state.y-c.y))*c.zoom,
  y:c.H/2+(c.sin*(state.x-c.x)+c.cos*(state.y-c.y))*.5*c.zoom
 };
};
setupCar();
async function selectModel(id){
 const choice=getVehicleById(id);
 if(!choice||system.driver)return false;
 const serial=++loadingSerial;
 system.ready=false;system.status='loading';system.wheelStatus='loading';
 system.error=null;
 try{
  if(!gltfLoader){
   await MeshoptDecoder.ready;
   gltfLoader=new GLTFLoader();gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }
  const url='assets/vehicles/live/'+choice.file;
  let gltf=modelCache.get(choice.id);
  if(!gltf){
   gltf=await gltfLoader.loadAsync(url);
   modelCache.set(choice.id,gltf);
  }
  if(serial!==loadingSerial)return false;
  if(body)scene.remove(body);
  activeModel=choice;
  // Clone em cache: cada seleção recebe malhas e pivôs intactos.
  importModel(gltf.scene.clone(true),choice);
  createLamp();resetWheelRig(wheelRig);
  state.speed=0;state.steer=0;state.distance=0;
  system.ready=true;system.status='ready';
  return true;
 }catch(error){
  system.status='failed';system.error=String(error?.message||error);
  console.error('Live GLB model failed',choice.id,error);
  return false;
 }
}
system.getWheelTelemetry=()=>wheelRig?Array.from(wheelRig.wheels).map(
 ([role,w])=>({role,steer:w.steer,spin:w.spin,radius:w.radius,
   nodeYaw:w.node.rotation.y,
   rollingNodes:w.spinning.length})):[];

system.selectModel=selectModel;
system.nextModel=()=>selectModel(VEHICLE_MODELS[
 (VEHICLE_MODELS.findIndex(x=>x.id===activeModel.id)+1)%VEHICLE_MODELS.length].id);
(async()=>{
 try{initRenderer();await selectModel(activeModel.id);}
 catch(error){system.status='failed';system.error=String(error);console.error(error);}
})();
