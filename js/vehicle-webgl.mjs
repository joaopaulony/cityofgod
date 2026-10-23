// Veiculo GLB REAL: Three.js/WebGL em todo frame. Nunca tira screenshots,
// nao gera sprites, nao usa drawImage para carroceria e nao usa Blender.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {CAR_SPEC,stepCar,cameraLead,approach} from './vehicle-physics.mjs';

const bridge=window.cityVehicleBridge;
if(!bridge)throw Error('Missing City of God live 3D vehicle bridge');
const canvas=document.querySelector('#vehicle3d');
const state={x:0,y:0,angle:0,speed:0,steer:0,distance:0};
const system={
 ready:false,driver:false,engineOn:false,headlights:false,braking:false,
 model:'1992 Nissan Silvia S13',status:'loading',car:state,
 source:'assets/vehicles/live/nissan-silvia-s13.glb',shadows:0
};
window.cityVehicles=system;
let renderer=null,model=null,axles=[],scene=null,viewCamera=null,body=null,
 shadowGround=null,lampL=null,lampR=null,occluders=[];
const METERS=CAR_SPEC.length;
const objects=new Map();

function nearestSafeParking(){
 const p=bridge.player;
 const around=[];
 for(const r of bridge.world.roads)
  for(let i=2;i<r.pts.length-2;i+=5){
   const q=r.pts[i],d=Math.hypot(q.x-p.x,q.y-p.y);
   if(d<17&&d>2.8)around.push({x:q.x,y:q.y,angle:Math.atan2(q.ty,q.tx),d});
  }
 around.sort((a,b)=>a.d-b.d);
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
 const w=CAR_SPEC.width*.44,l=CAR_SPEC.length*.43,
  vec=[[0,0],[l,w],[l,-w],[-l,w],[-l,-w]];
 for(const [u,v] of vec){
  const px=x+Math.cos(a)*u-Math.sin(a)*v,
   py=y+Math.sin(a)*u+Math.cos(a)*v;
  if(px<2||py<2||px>bridge.world.mapSize-2||py>bridge.world.mapSize-2)
   return false;
  if(bridge.world.blocked(px,py,.23))return false;
  if(bridge.pondVal(px,py)<1.12)return false;
  for(const c of bridge.world.circles)
   if(Math.hypot(px-c.x,py-c.y)<c.r+.35)return false;
 }
 return true;
}
function setupCar(){
 const q=nearestSafeParking();
 Object.assign(state,q,{speed:0,steer:0,distance:0});
 system.position={...q};
}
function makeOccluders(){
 // Objetos de profundidade invisiveis: casas a frente do GLB o escondem.
 // A geometria continua desenhada no jogo existente.
 const invisible=new THREE.MeshBasicMaterial({
  colorWrite:false,depthWrite:true,depthTest:true,side:THREE.DoubleSide
 });
 for(const H of bridge.houses){
  const w=H.x1-H.x0,d=H.y1-H.y0;
  if(w<=0||d<=0)continue;
  const h=H.h+(H.roofKind==='flat'?.12:1.2);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),invisible);
  mesh.position.set((H.x0+H.x1)/2,h/2,(H.y0+H.y1)/2);
  mesh.userData.house=H;
  scene.add(mesh);occluders.push(mesh);
 }
}
function importModel(root){
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
 const scale=CAR_SPEC.length/Math.max(dim.z,dim.x);
 scaled.scale.setScalar(scale);scaled.add(positioned);
 const aligned=new THREE.Group();
 // Frente original ao longo de +Z: girar para +X antes do yaw do carro.
 aligned.rotation.y=Math.PI/2;
 aligned.add(scaled);
 body=new THREE.Group();body.add(aligned);scene.add(body);
 // Alguns arquivos contêm rodas como meshes independentes; animar se houver.
 root.traverse(obj=>{
  if(obj.isMesh){
   obj.castShadow=true;obj.receiveShadow=true;
   if(/wheel|tire|roda|pneu/i.test(obj.name))axles.push(obj);
  }
 });
 model=root;
 system.meshes=root.getObjectByProperty('isMesh',true)?1:0;
 system.sourceSize=dim.toArray();
}
function createLamp(){
 const mk=()=>new THREE.SpotLight(0xfff1c8,0,16,Math.PI/7,.45,1.2);
 lampL=mk();lampR=mk();
 for(const [light,side] of [[lampL,-1],[lampR,1]]){
  body.add(light);light.position.set(1.65,.77,side*.63);
  light.target.position.set(7,-.15,side*.85);body.add(light.target);
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
 const old={...state},next=stepCar(state,inControl,dt);
 if(isFree(next.x,next.y,next.angle)){
  Object.assign(state,next);
 }else{
  // Choque: desliga deslocamento mas mantém a orientação anterior.
  Object.assign(state,old,{speed:0});
 }
 system.braking=c.down('s')||c.down(' ');
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
 return 'Entrou no Silvia S13 — W/S aceleração, A/D direção, Espaço freio';
}
function drawPanel(g,w,h){
 if(!system.ready)return;
 const near=Math.hypot(bridge.player.x-state.x,bridge.player.y-state.y)<3.8;
 if(!system.driver&&!near)return;
 g.save();
 if(system.driver){
  const x=w/2-142,y=h-166;
  g.fillStyle='rgba(13,17,20,.9)';
  g.beginPath();g.roundRect(x,y,284,58,10);g.fill();
  g.fillStyle='#f2e9d4';g.font='bold 24px system-ui';
  g.fillText(String(Math.round(Math.abs(state.speed)*3.6)).padStart(2,'0'),
    x+12,y+34);
  g.font='12px system-ui';g.fillStyle='#9cb0b6';g.fillText('km/h',x+65,y+31);
  g.font='bold 17px system-ui';g.fillStyle='#dfc887';
  g.fillText(state.speed<-.2?'R':state.speed>.2?'D':'N',x+117,y+33);
  g.font='12px system-ui';g.fillStyle='#d0d4d1';
  g.fillText(system.engineOn?'MOTOR LIGADO':'MOTOR DESLIGADO',x+155,y+31);
  g.font='11px system-ui';g.fillStyle='#b8bcc1';
  g.fillText('F sair · X motor · L faróis · H buzina',x+8,y+52);
 }else{
  g.textAlign='center';g.font='bold 13px system-ui';
  g.fillStyle='#f6dfa8';g.fillText('F — entrar no Nissan Silvia S13',w/2,h-135);
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
 moveCar(dt);
};
system.interact=interact;
system.drawHUD=drawPanel;
system.prompt=()=>system.ready&&!system.driver&&
 Math.hypot(bridge.player.x-state.x,bridge.player.y-state.y)<3.3
 ?'F — entrar no Nissan Silvia S13':null;
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
 for(const wheel of axles){
  if(wheel.userData.vehicleSpinAxis)
   wheel.rotation[wheel.userData.vehicleSpinAxis]+=state.speed*.03;
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
(async()=>{
 try{
  initRenderer();
  await MeshoptDecoder.ready;
  const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf=await loader.loadAsync(system.source);
  importModel(gltf.scene);createLamp();
  system.ready=true;system.status='ready';
  console.log('City of God: original 3D GLB car live in WebGL',system.model);
 }catch(err){
  system.status='failed';system.error=String(err?.message||err);
  if(renderer)renderer.setClearColor(0x000000,0);
  console.error('Native GLB vehicle failed (no fake car substituted)',err);
 }
})();
