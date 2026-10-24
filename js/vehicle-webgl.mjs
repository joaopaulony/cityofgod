// Veiculo GLB REAL: Three.js/WebGL em todo frame. Nunca tira screenshots,
// nao gera sprites, nao usa drawImage para carroceria e nao usa Blender.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {CAR_SPEC,stepCar,cameraLead} from './vehicle-physics.mjs';
import {carCollision,sweepCar} from './vehicle-collision.mjs';
import {createWorldOccluders} from './vehicle-occlusion.mjs';
import {VEHICLE_MODELS,CIVIL_PACK_EXPECTED,getVehicleById} from './vehicle-catalog.mjs';
import {createWheelRig,stepWheelRig,resetWheelRig} from './vehicle-wheels.mjs';
import {createCharacterSystem} from './character-webgl.mjs';

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
// Comprimento do modelo ativo: usado pela colisão de pedestres e pelos tiros (caixa orientada).
Object.defineProperty(system,'carLength',{get:()=>activeModel.length,enumerable:true});
let renderer=null,model=null,scene=null,viewCamera=null,body=null,
 shadowGround=null,lampL=null,lampR=null,occluders=[],roofOccluders=new Map(),occlusionScene=null;
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
function hitbox(x=state.x,y=state.y,angle=state.angle){
 return {x,y,angle,length:activeModel.length,
  width:system.bodyWidth||1.85};
}
function collisionOptions(){
 return {houses:bridge.houses,boxes:bridge.boxes,
  mapSize:bridge.mapSize,ignoreCircle:system.collider,
  isWater:(x,y)=>bridge.pondVal(x,y)<1.03};
}
function isFree(x,y,a){
 return !carCollision(bridge.world,hitbox(x,y,a),collisionOptions());
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
 system.collider={x:state.x,y:state.y,r:.55,kind:'vehicle',h:1.4};
 bridge.world.circles.push(system.collider);
}
let occlusionMaterial=null;
const occlusionSync={version:-1,x:0,y:0};
function makeOccluders(){
 // A profundidade vem da geometria REAL de cada fachada e da água do telhado.
 // Não usar caixas fechadas: seus topos quadrados ocultavam carros junto
 // aos beirais e criavam quadrados invisíveis ao girar a câmera.
 occlusionMaterial=new THREE.MeshBasicMaterial({
  colorWrite:false,depthWrite:true,depthTest:true,side:THREE.DoubleSide
 });
 syncOccluders(true);
}
// Mundo grande: as casas e objetos entram e saem por setor. Os oclusores são remontados
// em volta do carro quando o mundo muda (world.version) ou o carro anda 25 m.
const OCC_RADIUS=90;
function syncOccluders(force){
 const w=bridge.world,open=!!w.open,cx=bridge.cam.x,cy=bridge.cam.y;
 if(!force&&(!open||(w.version===occlusionSync.version&&
   Math.hypot(cx-occlusionSync.x,cy-occlusionSync.y)<25)))return;
 Object.assign(occlusionSync,{version:w.version,x:cx,y:cy});
 const near=(x,y)=>!open||Math.hypot(x-cx,y-cy)<OCC_RADIUS;
 const want=new Set(bridge.houses.filter(H=>near((H.x0+H.x1)/2,(H.y0+H.y1)/2)));
 for(let i=occluders.length-1;i>=0;i--){
  const o=occluders[i];
  if(want.has(o.userData.house))continue;
  scene.remove(o);o.geometry.dispose();occluders.splice(i,1);
 }
 for(const [H,m] of roofOccluders){
  if(want.has(H))continue;
  scene.remove(m);m.geometry.dispose();roofOccluders.delete(H);
 }
 const have=new Set(occluders.map(o=>o.userData.house));
 for(const H of roofOccluders.keys())have.add(H);
 for(const H of want)if(!have.has(H))addHouseOccluder(H);
 system.houseOccluders=occluders.length;
 // Os outros objetos possuem profundidade propria: nao usar a cerca
 // como um bloco solido, pois isso corta o capo atraves das ripas.
 occlusionScene?.dispose?.();
 const view=!open?bridge:{...bridge,
  world:{...w,lamps:(w.lamps||[]).filter(o=>near(o.x,o.y)),
   trafficSignals:(w.trafficSignals||[]).filter(o=>near(o.x,o.y)),
   props:(w.props||[]).filter(o=>o.type!=='tuft'&&near(o.x,o.y)),
   segs:(w.segs||[]).filter(s=>s.kind==='fence'&&near(s.x1,s.y1))},
  boxes:(bridge.boxes||[]).filter(b=>near(b.x,b.y)),
  urbanBins:(bridge.urbanBins||[]).filter(b=>near(b.x,b.y))};
 occlusionScene=createWorldOccluders(scene,THREE,view,occlusionMaterial);
 system.occlusionStats=occlusionScene.state;
}
function addHouseOccluder(H){
 const invisible=occlusionMaterial;
 const face=(vertices,output)=>{
  const p=vertices.map(([x,y,z])=>[x,z,y]);
  for(let i=1;i<p.length-1;i++)
   for(const v of [p[0],p[i],p[i+1]])output.push(...v);
 };
 {
  const w=H.x1-H.x0,d=H.y1-H.y0;
  if(w<=0||d<=0)return;
  const walls=[],slopes=[];
  // Separate wall and roof depth. When a vehicle is behind the tiles
  // only the roof fades; masonry stays opaque and solid in every angle.
  for(const side of Object.values(H.sides||{})){
   const a=side.a,b=[a[0]+side.dir[0]*side.len,
                      a[1]+side.dir[1]*side.len];
   // A empena nao e retangulo ate a cumeeira: as laterais reais
   // terminam em H.h e a parte triangular e desenhada por f.gable.
   // Antes side.Hc enchia com uma parede QUADRADA invisivel acima das
   // telhas, cortando carros em linhas verticais artificiais.
   const h=H.roofKind==='flat'?(side.Hc||H.h):H.h;
   face([[a[0],a[1],0],[b[0],b[1],0],
     [b[0],b[1],h],[a[0],a[1],h]],walls);
  }
  const roof=H.roofGeom||(H.roofGeom=bridge.buildRoofGeom(H));
  if(roof.flat)
   face((H.corners||[[H.x0,H.y0],[H.x1,H.y0],[H.x1,H.y1],[H.x0,H.y1]]).map(p=>[p[0],p[1],H.h]),slopes);
  else for(const f of roof.faces)
   face(f.p,f.gable?walls:slopes);
  const make=(vertices)=>{
   if(!vertices.length)return null;
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   const mesh=new THREE.Mesh(geometry,invisible);
   mesh.userData.house=H;mesh.frustumCulled=false;
   scene.add(mesh);return mesh;
  };
  const wallMesh=make(walls),roofMesh=make(slopes);
  if(wallMesh)occluders.push(wallMesh);
  if(roofMesh)roofOccluders.set(H,roofMesh);
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
 system.bodyWidth=Math.max(1.25,Math.min(2.6,
   dim.x*(config.length/Math.max(dim.z,dim.x))));
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
 renderer.toneMappingExposure=1.38;
 renderer.setClearColor(0x000000,0);
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFShadowMap;
 scene=new THREE.Scene();
 scene.add(new THREE.HemisphereLight(0xf8ead9,0x343c32,1.95));
 const sun=new THREE.DirectionalLight(0xffe0b7,2.7);
 sun.position.set(-11,18,15);
 sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);
 sun.shadow.camera.left=-12;sun.shadow.camera.right=12;
 sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;
 sun.shadow.camera.near=.1;sun.shadow.camera.far=60;
 sun.shadow.bias=-.0003;scene.add(sun);
 scene.userData.sun=sun;
 const bounce=new THREE.DirectionalLight(0xa8b9df,.62);
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
 createCharacterSystem(scene,bridge);
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
 const distance=40,elev=Math.asin(c.tilt||.5),plane=Math.cos(elev)*distance;
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
 const collision=sweepCar(bridge.world,{...old,...hitbox()},
  {...next,...hitbox(next.x,next.y,next.angle)},collisionOptions());
 if(!collision.impact){
  Object.assign(state,next);
  system.lastImpact=null;
 }else{
  // Parar na ULTIMA posicao valida, nao teletransportar para antes do frame.
  const last=collision.position;
  Object.assign(state,next,{x:last.x,y:last.y,angle:last.angle,speed:0});
  system.lastImpact=collision.impact.kind;
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
    state.speed=0;state.steer=0; // sem velocidade guardada: evita tranco ao voltar ao carro
    return 'Saiu do veículo';
   }
  }
  return 'Não há espaço para sair';
 }
 if(Math.hypot(p.x-state.x,p.y-state.y)>3.3)return false;
 system.driver=true;system.engineOn=true;p.x=state.x;p.y=state.y;
 state.speed=0;state.steer=0;
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
 if(!renderer)return;
 const c=bridge.cam;
 setCamera();
 if(body){body.position.set(state.x,0,state.y);
 body.rotation.y=-state.angle;}
 // O pivô do GLB aponta para +X; Three Y positivo gira ao contrario
 // do yaw positivo em coordenadas x/y do jogo.
 shadowGround.position.x=state.x;shadowGround.position.z=state.y;
 syncOccluders(false);
 // Nunca esconder telhados porque o condutor está dentro de um imóvel.
 // Só a superfície escolhida pela lente de visão fica sem oclusão.
 const reveal=system.driver||window.cityCharacters?.has(bridge.player)?bridge.visionBlocker:null;
 for(const o of occluders)o.visible=(system.driver||!o.userData.house.inside)&&o.userData.house!==reveal;
 for(const [H,mesh] of roofOccluders)
  mesh.visible=(system.driver||!H.inside)&&H!==reveal;
 occlusionScene?.updateActors(system.driver,bridge.player);
 if(lampL&&lampR){
  lampL.intensity=lampR.intensity=system.headlights?12:0;
 }
 renderer.render(scene,viewCamera);
 system.frames=(system.frames||0)+1;
 system.lastScreenPosition={
  // GLB em tempo real usa exatamente a mesma projecao ortografica.
  x:c.W/2+(c.cos*(state.x-c.x)-c.sin*(state.y-c.y))*c.zoom,
  y:c.H/2+(c.sin*(state.x-c.x)+c.cos*(state.y-c.y))*(c.tilt||.5)*c.zoom
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
 ([role,w])=>{
   const tyre=w.spinning.find(x=>/^(tyre|tire)/i.test(x.node.name))?.node||w.node;
   const quat=new THREE.Quaternion();
   tyre.getWorldQuaternion(quat);
   const axle=new THREE.Vector3(1,0,0).applyQuaternion(quat);
   const isSpinning=n=>{
     const q=n.quaternion;
     return [q.x,q.y,q.z,q.w];
   };
   return {role,name:w.node.name,steer:w.steer,spin:w.spin,
    radius:w.radius,nodeYaw:w.node.rotation.y,
    rollingNodes:w.spinning.length,tyreOrientation:isSpinning(tyre),
    tyreAxisVertical:Math.abs(axle.y),
    allParts:w.spinning.map(p=>({name:p.node.name,
      quaternion:isSpinning(p.node)}))};
  }):[];

system.selectModel=selectModel;
system.nextModel=()=>selectModel(VEHICLE_MODELS[
 (VEHICLE_MODELS.findIndex(x=>x.id===activeModel.id)+1)%VEHICLE_MODELS.length].id);
(async()=>{
 try{initRenderer();await selectModel(activeModel.id);}
 catch(error){system.status='failed';system.error=String(error);console.error(error);}
})();
