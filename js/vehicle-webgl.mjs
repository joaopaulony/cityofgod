// Veiculo GLB REAL: Three.js/WebGL em todo frame. Nunca tira screenshots,
// nao gera sprites, nao usa drawImage para carroceria e nao usa Blender.
import * as THREE from 'three';
import {loadVehicleGLB,vehicleAssetCacheStats} from './vehicle-asset-cache.mjs';
import {CAR_SPEC,stepCar,cameraLead} from './vehicle-physics.mjs';
import {carCollision,sweepCar} from './vehicle-collision.mjs';
import {createWorldOccluders} from './vehicle-occlusion.mjs';
import {VEHICLE_MODELS,CIVIL_PACK_EXPECTED,POLICE_SUV_EXPECTED,VEHICLE_DIRECTORY,getVehicleById} from './vehicle-catalog.mjs';
import {createWheelRig,stepWheelRig,resetWheelRig} from './vehicle-wheels.mjs';
import {createCharacterSystem} from './character-webgl.mjs';
import {createVegetation} from './vegetation-3d.mjs';
import {createProps} from './props-3d.mjs';
import {createPets} from './pets-3d.mjs';
import {createHouse3D} from './house-3d.mjs';
import {createArchitecture3D} from './architecture-3d.mjs';
import {createAmbience} from './ambience-3d.mjs';
import {createBirds} from './birds-3d.mjs';
import {createLandmarks} from './landmarks-3d.mjs';
import {createAirport3D} from './airport-3d.mjs';
import {createGas3D} from './gas-3d.mjs';
import {createParked3D} from './parked-3d.mjs';
import {VehicleFleet,streetModel} from './vehicle-fleet.mjs';
import {syncCivicFleetParking} from './civic-fleet.mjs';
import {createVehicleEffects} from './vehicle-effects.mjs';
import {createVehicleLights} from './vehicle-lights.mjs';
import {createVehicleDamage,damageTier,registerCrash,collisionPanel,engineEfficiency,repairVehicleDamage} from './vehicle-damage.mjs';
import {createVehicleDeformation} from './vehicle-deformation.mjs';
import {createVehicleDamageEffects} from './vehicle-damage-effects.mjs';

const bridge=window.cityVehicleBridge;
if(!bridge)throw Error('Missing City of God live 3D vehicle bridge');
const canvas=document.querySelector('#vehicle3d');
const state={x:0,y:0,angle:0,speed:0,steer:0,distance:0};
// tanque (0–1): ~12 km com o tanque cheio; abastece parado ao lado de uma bomba, motor desligado, segurando B
const fuel={level:.58,pump:null,gallons:0,cost:0,msg:'',msgT:0};
const TANK_GAL=13.2,RANGE_M=12000;
const modelId=new URLSearchParams(location.search).get('vehicleModel')||'sedan';
const fleet=new VehicleFleet();let activeKey=null,activePaint=null,claiming=false;
let vehicleFX=null,damageFX=null,lighting=null,lightingClock=0,deformation=null;
let damage=createVehicleDamage();
let activeModel=getVehicleById(modelId)||VEHICLE_MODELS[0],wheelRig=null,
 loadingSerial=0;
const system={
 ready:false,driver:false,engineOn:false,headlights:false,highBeams:false,
 signal:'off',emergencyLights:false,braking:false,
 model:activeModel.name,modelId:activeModel.id,status:'loading',car:state,
 source:'assets/vehicles/live/'+activeModel.file,shadows:0,
 catalog:VEHICLE_MODELS,pendingCivilModels:CIVIL_PACK_EXPECTED,pendingPoliceSUV:POLICE_SUV_EXPECTED,
 fleetDirectory:VEHICLE_DIRECTORY,
 wheelStatus:'loading',available:VEHICLE_MODELS.length
};
window.cityVehicles=system;
// Comprimento do modelo ativo: usado pela colisão de pedestres e pelos tiros (caixa orientada).
Object.defineProperty(system,'carLength',{get:()=>activeModel.length,enumerable:true});
system.fuel=fuel;
system.damage=damage;
system.getDamageStatus=()=>({integrity:damage.integrity,tier:damageTier(damage),impacts:damage.impacts,front:damage.front,rear:damage.rear,left:damage.left,right:damage.right});
system.repairVehicle=()=>{if(!system.driver)return false;repairVehicleDamage(damage);deformation?.apply(damage);system.damage=damage;return true;};
system.captureCheckpoint=()=>system.driver?{key:activeKey,modelId:activeModel.id,angle:state.angle,fuel:fuel.level,col:activePaint,engineOn:system.engineOn,headlights:system.headlights,highBeams:system.highBeams,
 signal:system.signal,emergencyLights:system.emergencyLights,
  damage:{integrity:damage.integrity,impacts:damage.impacts,front:damage.front,rear:damage.rear,left:damage.left,right:damage.right}}:null;
system.restoreCheckpoint=async(saved,point)=>{
 if(!system.ready||!getVehicleById(saved.modelId)||!await selectModel(saved.modelId))return false;
 activeKey=saved.key;activePaint=saved.col;fleet.taken.add(activeKey);
 for(const b of bridge.boxes)if(b.kind==='parkedcar'&&fleet.hideOriginal(b)){b.fleetHidden=true;b.solid=false;}
 if(activePaint)parked3d?.paintActive(model,{col:activePaint,modelId:saved.modelId});
 Object.assign(state,{x:point.x,y:point.y,angle:saved.angle,speed:0,steer:0,slip:0});
 damage=createVehicleDamage(saved.damage);system.damage=damage;deformation?.apply(damage);
 fuel.level=saved.fuel;system.driver=true;system.engineOn=saved.engineOn&&engineEfficiency(damage)>0;system.headlights=saved.headlights;
 system.highBeams=!!saved.highBeams;system.signal=saved.signal||'off';system.emergencyLights=!!saved.emergencyLights;
 Object.assign(bridge.player,{x:point.x,y:point.y,floor:0,floorZ:0});
 system.collider.x=point.x;system.collider.y=point.y;bridge.world.version++;return true;
};
let renderer=null,model=null,scene=null,viewCamera=null,body=null,
 shadowGround=null,occluders=[],roofOccluders=new Map(),occlusionScene=null;
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
 // centro: a câmera (o jogador a pé ou o carro); as árvores 3D precisam das casas em volta da vista
 const w=bridge.world,open=!!w.open,cx=bridge.cam.x,cy=bridge.cam.y;
 if(!force&&(!open||(w.version===occlusionSync.version&&
   Math.hypot(cx-occlusionSync.x,cy-occlusionSync.y)<25)))return;
 Object.assign(occlusionSync,{version:w.version,x:cx,y:cy});
 const near=(x,y)=>!open||Math.hypot(x-cx,y-cy)<OCC_RADIUS;
 const want=new Set(bridge.houses.filter(H=>!H.architecture&&near((H.x0+H.x1)/2,(H.y0+H.y1)/2)));
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
 // árvores e arbustos 3D têm profundidade própria: sem os troncos/esferas de oclusão das árvores 2D
 const plant=o=>window.VEG3D&&(o.type==='tree'||o.type==='bush');
 const in3d=!!window.VEG3D;
 const view={...bridge,
  world:{...w,lamps:in3d?[]:(w.lamps||[]).filter(o=>near(o.x,o.y)),
   trafficSignals:in3d?[]:(w.trafficSignals||[]).filter(o=>near(o.x,o.y)),
   props:(w.props||[]).filter(o=>o.type!=='tuft'&&!plant(o)&&near(o.x,o.y)),
   segs:(w.segs||[]).filter(s=>s.kind==='fence'&&(!in3d||s.chain)&&near(s.x1,s.y1))},
  // carro estacionado com modelo GLB (parked-3d.mjs) já tem profundidade própria: sem caixa de oclusão por cima
  boxes:(bridge.boxes||[]).filter(b=>near(b.x,b.y)&&!bridge.props3d?.(b)&&!(in3d&&b.kind==='parkedcar')),
  urbanBins:in3d?[]:(bridge.urbanBins||[]).filter(b=>near(b.x,b.y))};
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
  for(const [key,side] of Object.entries(H.sides||{})){
   const a=side.a,b=[a[0]+side.dir[0]*side.len,
                      a[1]+side.dir[1]*side.len];
   // A empena nao e retangulo ate a cumeeira: as laterais reais
   // terminam em H.h e a parte triangular e desenhada por f.gable.
   // Antes side.Hc enchia com uma parede QUADRADA invisivel acima das
   // telhas, cortando carros em linhas verticais artificiais.
   const h=H.roofKind==='flat'?(side.Hc||H.h):H.h;
   // vão das portas aberto: a folha 3D gira p/ dentro da casa (house-3d.mjs)
   const gaps=window.VEG3D&&!H.facadeFn?(H.segs||[]).filter(s=>s.ext&&s.door&&s.side===key).map(s=>[s.idx+.1,s.idx+.9]).sort((p,q)=>p[0]-q[0]):[];
   const P=u=>[a[0]+side.dir[0]*u,a[1]+side.dir[1]*u];
   const quad=(u0,u1,z0,z1)=>{if(u1-u0<.01)return;const A=P(u0),B=P(u1);face([[A[0],A[1],z0],[B[0],B[1],z0],[B[0],B[1],z1],[A[0],A[1],z1]],walls);};
   let u=0;for(const [g0,g1] of gaps){quad(u,g0,0,h);quad(g0,g1,2.12,h);u=g1;}
   quad(u,side.len,0,h);
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
   mesh.castShadow=!!window.VEG3D;   // a casa faz sombra de verdade, que anda com o sol (env.js)
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
 system.wheelStatus=wheelRig.complete?(wheelRig.wheels.size+' rodas articuladas'):
  wheelRig.wheels.size+' rodas reconhecidas (mínimo 4)';
 deformation=createVehicleDeformation(THREE,root,config);
 deformation.apply(damage);
 model=root;
 system.meshes=0;root.traverse(o=>{if(o.isMesh)system.meshes++;});
 system.sourceSize=dim.toArray();
 system.bodyWidth=config.width||Math.max(1.25,Math.min(2.9,Math.min(dim.x,dim.z)*scale));
 system.bodyHeight=dim.y*scale;
 system.model=config.name;system.modelId=config.id;
 system.source='assets/vehicles/live/'+config.file;
}
function lightFlags(){
 return {headlights:system.headlights,highBeams:system.highBeams,
  braking:system.braking,reversing:state.speed<-.2,signal:system.signal,
  emergencyLights:system.emergencyLights};
}
function createLamp(){
 lighting=createVehicleLights(THREE,body,activeModel,
  {width:system.bodyWidth,height:system.bodyHeight,root:model});
 system.lightState=lighting.apply(lightFlags(),lightingClock);
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
 vehicleFX=createVehicleEffects(THREE,scene);
 damageFX=createVehicleDamageEffects(THREE,scene);
 const hemi=new THREE.HemisphereLight(0xf8ead9,0x343c32,1.95);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffe0b7,2.7);
 sun.position.set(-11,18,15);
 sun.castShadow=true;
 // a sombra cobre a vista inteira (árvores 3D), não só o carro
 const sm=renderer.capabilities.maxTextureSize>=8192?4096:2048;   // sombras nítidas na vista inteira, bordas suaves (PCF com raio)
 sun.shadow.mapSize.set(sm,sm);sun.shadow.normalBias=.04;sun.shadow.radius=2.5;sun.shadow.blurSamples=12;
 sun.shadow.camera.left=-12;sun.shadow.camera.right=12;
 sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;
 sun.shadow.camera.near=.1;sun.shadow.camera.far=60;
 sun.shadow.bias=-.0003;scene.add(sun);
 scene.userData.sun=sun;system.scene=scene;system.renderer=renderer;   // p/ depuração no console
 const bounce=new THREE.DirectionalLight(0xa8b9df,.62);
 bounce.position.set(7,9,-8);scene.add(bounce);
 scene.userData.lights=[[hemi,1.95],[sun,2.7],[bounce,.62]];
 // Material ShadowMaterial só mostra sombra real do carro; solo e todo o
 // mapa continuam exatamente como foram desenhados.
 shadowGround=new THREE.Mesh(
  new THREE.PlaneGeometry(12,12),
  new THREE.ShadowMaterial({opacity:.33,transparent:true,depthWrite:false}));
 shadowGround.rotation.x=-Math.PI/2;
 shadowGround.position.y=.008;
 shadowGround.receiveShadow=true;scene.add(shadowGround);
 viewCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,260);
 makeOccluders();
 createCharacterSystem(scene,bridge);
 createPets(scene,bridge);
 // árvores, palmeiras e arbustos 3D (vegetation-3d.mjs); se falhar, o jogo volta às árvores 2D
 if(window.VEG3D!==false){
  try{vegetation=createVegetation(THREE,scene,bridge);system.vegetation=vegetation.state;}
  catch(error){console.error('Vegetação 3D falhou',error);window.VEG3D=false;}
  // objetos da rua, móveis, postes, semáforos e meio-fio (props-3d.mjs)
  try{props3d=createProps(THREE,scene,bridge);system.props3d=props3d.state;
   system.furnitureThumbnail=(kind,color)=>props3d.thumbnail(kind,color);}
  catch(error){console.error('Objetos 3D falharam',error);}
  // janelas, portas, cercas, sebes, toldos e degraus (house-3d.mjs)
  try{house3d=createHouse3D(THREE,scene,bridge,{seeThrough:m=>vegetation?vegetation.seeThrough(m):m});system.house3d=house3d.state;}
  catch(error){console.error('Casas 3D falharam',error);}
  // sol/lua pelas horas, céu, vento, neve (ambience-3d.mjs) e pássaros (birds-3d.mjs)
  try{const [[hemi],[sun],[bounce]]=scene.userData.lights;ambience=createAmbience(THREE,scene,bridge,{hemi,sun,bounce,ground:vegetation?.ground});system.ambience=ambience.state;}
  catch(error){console.error('Ambiente 3D falhou',error);}
  try{birds=createBirds(THREE,scene,bridge,{car:()=>system.driver?{x:state.x,y:state.y,speed:state.speed}:null});system.birds=birds.state;}
  catch(error){console.error('Pássaros 3D falharam',error);}
  // marcos de Los Angeles: letreiro na serra (landmarks-3d.mjs)
  try{landmarks=createLandmarks(THREE,scene,bridge);system.landmarks=landmarks.state;}
  catch(error){console.error('Marcos 3D falharam',error);}
  // aeroporto: aviões, torre, prédio-símbolo, luzes da pista e cerca de ferro (airport-3d.mjs)
  try{airport3d=createAirport3D(THREE,scene,bridge);system.airport3d=airport3d.state;}
  catch(error){console.error('Aeroporto 3D falhou',error);}
  // postos de gasolina: cobertura, bombas, loja e totem (gas-3d.mjs)
  try{gas3d=createGas3D(THREE,scene,bridge);system.gas3d=gas3d.state;}
  catch(error){console.error('Postos 3D falharam',error);}
  // carros estacionados com os modelos GLB (parked-3d.mjs)
  try{parked3d=createParked3D(THREE,scene,bridge);system.parked3d=parked3d.state;}
  catch(error){console.error('Carros estacionados 3D falharam',error);}
 }
 architecture3d=createArchitecture3D(THREE,scene,bridge,{seeThrough:m=>vegetation?vegetation.seeThrough(m):m});
 window.CityFront?.applySettings();
}
system.applyQuality=value=>{
 if(!renderer)return;
 renderer.setPixelRatio(value==='high'?1.5:Math.min(devicePixelRatio||1,value==='low'?.65:1));
 renderer.shadowMap.enabled=value!=='low';system.quality=value;system.pixelRatio=renderer.getPixelRatio();
};
let vegetation=null,props3d=null,house3d=null,architecture3d=null,ambience=null,birds=null,landmarks=null,airport3d=null,gas3d=null,parked3d=null;
function setCamera(){
 const c=bridge.cam,w=c.W,h=c.H;
 if(!w||!h)return;
 const pixelRatio=renderer.getPixelRatio();
 const wantedW=Math.round(w*pixelRatio),wantedH=Math.round(h*pixelRatio);
 if(canvas.width!==wantedW||canvas.height!==wantedH)
  renderer.setSize(w,h,false);
 // Canvas 2D world x/y -> Three x/z, world height -> Three Y.
 // Câmera isometrica exatamente igual a proj(): TILT=.5 e HZ=.866.
 const distance=90,elev=Math.asin(c.tilt||.5),plane=Math.cos(elev)*distance;
 const a=c.ang;
 viewCamera.position.set(c.x+Math.sin(a)*plane,Math.sin(elev)*distance,
  c.y+Math.cos(a)*plane);
 viewCamera.lookAt(c.x,0,c.y);
 viewCamera.left=-w/(2*c.zoom);viewCamera.right=w/(2*c.zoom);
 viewCamera.top=h/(2*c.zoom);viewCamera.bottom=-h/(2*c.zoom);
 viewCamera.updateProjectionMatrix();
 // sol na mesma direção das sombras pintadas do jogo 2D (SUN em core.js), centrado na vista
 const sun=scene.userData.sun,S=window.SUN_DIR||[-.55,-.75,.9],ext=Math.min(60,Math.hypot(w/(2*c.zoom),h/(2*c.zoom)/(c.tilt||.5))+18);
 sun.position.set(c.x+S[0]*60,S[2]*60,c.y+S[1]*60);
 sun.target.position.set(c.x,0,c.y);sun.target.updateMatrixWorld();
 const sc=sun.shadow.camera;
 if(Math.abs(sc.right-ext)>.5){sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext;sc.far=160;sc.updateProjectionMatrix();}
}
function moveCar(dt){
 const c=bridge;
 if(!system.driver)return;
 const p=bridge.player;
 const inControl={
  forward:system.engineOn&&fuel.level>0&&c.down('w'),
  reverse:system.engineOn&&fuel.level>0&&c.down('s'),
  left:c.down('a'),right:c.down('d'),
  handbrake:c.down(' '),engineOn:system.engineOn
 };
 // Ônibus, veículos pesados e carros civis têm eixos e aceleração próprios.
 const efficiency=engineEfficiency(damage);
 if(!efficiency&&system.engineOn){system.engineOn=false;fuel.msg='Motor destruído — veículo precisa de reparo';fuel.msgT=4;}
 const spec={...CAR_SPEC,...(activeModel.physics||{}),
  engineAccel:((activeModel.physics?.engineAccel)||CAR_SPEC.engineAccel)*efficiency,
  maxForward:((activeModel.physics?.maxForward)||CAR_SPEC.maxForward)*Math.max(.08,efficiency),
  reverseAccel:CAR_SPEC.reverseAccel*Math.max(.12,efficiency),
  length:activeModel.length,
  wheelbase:activeModel.wheelbase||Math.min(CAR_SPEC.wheelbase,activeModel.length*.65)};
 const old={...state},next=stepCar(state,inControl,dt,spec);
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
  const panel=collisionPanel({...old,length:activeModel.length,width:system.bodyWidth},collision.impact);
  const crash=registerCrash(damage,collision.impact,old.speed,lightingClock,panel,activeModel.length/4.7);
  if(crash){
   system.damage=damage;
   deformation?.apply(damage);
   damageFX?.crash(collision.position.x,collision.position.y,Math.abs(old.speed));
   fuel.msg='Impacto '+Math.round(Math.abs(old.speed)*3.6)+' km/h · Integridade '+Math.round(damage.integrity*100)+'%';
   fuel.msgT=3;
   const obstacle=collision.impact.object;
   if(obstacle?.kind==='parkedcar'&&!obstacle.fleetHidden){
    obstacle.damage=createVehicleDamage(obstacle.damage);
    registerCrash(obstacle.damage,{kind:'object'},Math.abs(old.speed)*.8,lightingClock,
      panel==='front'?'rear':panel==='rear'?'front':panel,Math.max(.7,(obstacle.w||4.7)/4.7));
    bridge.world.version++;
   }
  }
 }
 // A ré NÃO é freio: luz vermelha só ao desacelerar ou usar o freio de mão.
 system.braking=c.down(' ')||(c.down('s')&&old.speed>.2)||(c.down('w')&&old.speed<-.2);
 // consumo: distância rodada + marcha lenta; tanque vazio apaga o motor
 if(system.engineOn){
  fuel.level=Math.max(0,fuel.level-Math.hypot(state.x-old.x,state.y-old.y)/RANGE_M-dt/5400);
  if(fuel.level<=0){system.engineOn=false;fuel.msg='Pane seca — empurre até um posto ou chame ajuda';fuel.msgT=4;}
 }
 const signedTravel=(state.x-old.x)*Math.cos(old.angle)+
   (state.y-old.y)*Math.sin(old.angle);
 stepWheelRig(wheelRig,signedTravel,state.steer);
 system.collider.x=state.x;system.collider.y=state.y;
 p.x=state.x;p.y=state.y;p.speed=0;p.wantShot=false;p.aiming=false;
 p.running=false;p.aimHold=0;
 const lead=cameraLead(state);
 c.cam.tx=lead.x;c.cam.ty=lead.y;
}
function parkAndExit(pos){
 if(!system.driver||!activeKey)return false;
 const p=bridge.player;p.x=pos.x;p.y=pos.y;
 const parked=fleet.park(activeKey,{x:state.x,y:state.y,rot:state.angle,w:activeModel.length,d:system.bodyWidth,h:1.5,modelId:activeModel.id,col:activePaint,fuel:fuel.level,
  headlights:system.headlights,highBeams:system.highBeams,
  hazardLights:system.signal==='hazard',emergencyLights:system.emergencyLights,
  damage:{integrity:damage.integrity,impacts:damage.impacts,front:damage.front,rear:damage.rear,left:damage.left,right:damage.right}});
 parked.draw=bridge.drawParkedCar;const saved=bridge.addBox(parked);fleet.saved.set(activeKey,saved);
 system.driver=false;system.braking=false;system.engineOn=false;system.headlights=false;
 system.highBeams=false;system.signal='off';system.emergencyLights=false;activeKey=null;
 system.collider.x=-10000;system.collider.y=-10000;state.speed=0;state.steer=0;state.slip=0;state.drifting=false;bridge.world.version++;
 return 'Saiu do veículo';
}
system.exitAt=parkAndExit;
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
    return parkAndExit({x,y});
   }
  }
  return 'Não há espaço para sair';
 }
 const parked=fleet.nearest(bridge.boxes,p.x,p.y);if(!parked||claiming)return false;
 claiming=true;
 selectModel(streetModel(parked)).then(ok=>{
  if(!ok)return;
  parked3d?.paintActive(model,parked);
  activeKey=fleet.claim(parked);activePaint=parked.col;fuel.level=parked.fuel??.45;
  damage=createVehicleDamage(parked.damage);system.damage=damage;deformation?.apply(damage);
  Object.assign(state,{x:parked.x,y:parked.y,angle:parked.rot||0,speed:0,steer:0,slip:0});
  system.collider.x=state.x;system.collider.y=state.y;
  system.driver=true;system.engineOn=engineEfficiency(damage)>0;
  system.headlights=!!parked.headlights;system.highBeams=!!parked.highBeams;
  system.signal=parked.hazardLights?'hazard':'off';system.emergencyLights=!!parked.emergencyLights;
  p.x=state.x;p.y=state.y;bridge.world.version++;
 }).finally(()=>{claiming=false;});
 return 'Entrando no veículo…';
}
// abastecer: carro parado do lado de uma ilha, motor desligado, segurando B (galões e valor na bomba)
function refuel(dt){
 fuel.msgT=Math.max(0,fuel.msgT-dt);
 const near=system.driver&&Math.abs(state.speed)<.4?bridge.gasPumpNear?.(state.x,state.y,3.6):null;
 if(!near){if(fuel.pump&&fuel.gallons>0){fuel.msg='Abastecido: '+fuel.gallons.toFixed(2)+' gal · US$ '+fuel.cost.toFixed(2);fuel.msgT=3.5;}fuel.pump=null;fuel.gallons=0;fuel.cost=0;system.fueling=false;return;}
 if(fuel.pump!==near.pump){fuel.pump=near.pump;fuel.gallons=0;fuel.cost=0;}
 fuel.station=near.st;
 system.fueling=!system.engineOn&&bridge.down('b')&&fuel.level<1;
 if(system.fueling){const add=Math.min(1-fuel.level,dt*.11);fuel.level+=add;fuel.gallons+=add*TANK_GAL;fuel.cost=fuel.gallons*near.st.prices[0][1];}
}
function drawFuel(g,x,y){
 // medidor: E — F com ponteiro, bomba e alerta de reserva
 const low=fuel.level<.15;
 g.fillStyle='rgba(255,255,255,.08)';g.beginPath();g.roundRect(x,y,120,22,6);g.fill();
 g.fillStyle=low?'#e8823a':'#8fd27c';g.beginPath();g.roundRect(x+22,y+8,88*fuel.level,6,3);g.fill();
 g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1;for(let k=0;k<=4;k++){g.beginPath();g.moveTo(x+22+k*22,y+5);g.lineTo(x+22+k*22,y+8);g.stroke();}
 g.font='bold 10px system-ui';g.fillStyle='#d0d4d1';g.fillText('E',x+14,y+15);g.fillText('F',x+112,y+15);
 g.fillStyle=low?'#e8823a':'#d0d4d1';g.fillRect(x+3,y+6,6,10);g.fillRect(x+9,y+8,2,5);
}
function drawPanel(g,w,h){
 if(!system.ready)return;
 const near=!!fleet.nearest(bridge.boxes,bridge.player.x,bridge.player.y);
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
  g.fillText('F sair · X motor · L/I faróis · J/K setas · U alerta · O giroflex',x+10,y+56);
  drawFuel(g,x+232,y+40);
  const health=Math.max(0,damage.integrity),tier=damageTier(damage);
  g.fillStyle=health>.56?'#90daa5':health>.24?'#f7ae60':'#f45f61';
  g.fillRect(x+225,y+6,119*health,4);
  g.font='bold 10px system-ui';g.fillText('CARRO '+Math.round(health*100)+'%',x+220,y+18);
  if(tier==='critical'||tier==='destroyed'){
   g.fillStyle='#ff9b91';g.fillText(tier==='destroyed'?'MOTOR DANIFICADO':'MOTOR EM PANE',x+220,y+7);
  }
  // bomba ao lado: instrução ou leitura da bomba (galões e valor), mensagem de fim de abastecimento/pane
  let tip=null;
  if(fuel.pump){const s=fuel.station;tip=system.engineOn?'Posto '+s.brand.name+' — X desliga o motor para abastecer':fuel.level>=1?'Tanque cheio  ·  '+fuel.gallons.toFixed(2)+' gal  ·  US$ '+fuel.cost.toFixed(2):(system.fueling?'Abastecendo… ':'Segure B para abastecer  ·  ')+fuel.gallons.toFixed(2)+' gal  ·  US$ '+fuel.cost.toFixed(2)+'  ('+s.prices[0][0]+' US$ '+s.prices[0][1].toFixed(2)+'/gal)';}
  else if(fuel.msgT>0)tip=fuel.msg;
  else if(fuel.level<.15)tip='Combustível na reserva — procure um posto';
  if(tip){g.font='bold 13px system-ui';const tw=g.measureText(tip).width+28;g.fillStyle='rgba(13,17,20,.88)';g.beginPath();g.roundRect(w/2-tw/2,y-38,tw,28,8);g.fill();g.fillStyle=fuel.pump?'#f4dc9a':'#f2b27a';g.textAlign='center';g.fillText(tip,w/2,y-19);g.textAlign='left';}
 }else{
  g.font='bold 12px system-ui';g.textAlign='center';
  g.fillStyle='#f4dc9a';
  g.fillText('F entrar neste veículo · Espaço: drift ao dirigir',w/2,h-132);
 }
 g.restore();
}
function engineSound(){
 if((window.CityFront?.effectsVolume??1)<=0)return;
 const Context=window.AudioContext||window.webkitAudioContext;
 if(!Context)return;
 try{
  const a=new Context(),o=a.createOscillator(),gain=a.createGain();
  o.type='sawtooth';o.frequency.value=220;
  gain.gain.setValueAtTime(.025*(window.CityFront?.effectsVolume??1),a.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001,a.currentTime+.22);
  o.connect(gain);gain.connect(a.destination);o.start();o.stop(a.currentTime+.23);
  o.onended=()=>a.close();
 }catch(error){console.warn('Horn unavailable',error);}
}
system.update=dt=>{
 if(!system.ready)return;
 const stationFleet=syncCivicFleetParking(bridge.boxes,VEHICLE_MODELS,fleet);
 if(stationFleet.activated||stationFleet.hidden)bridge.world.version++;
 refuel(dt);
 if(bridge.hit('x')&&system.driver){
  if(engineEfficiency(damage)<=0){fuel.msg='Motor destruído: necessário reparar';fuel.msgT=3;}
  else system.engineOn=!system.engineOn;
 }
 if(bridge.hit('l')&&system.driver)system.headlights=!system.headlights;
 if(bridge.hit('i')&&system.driver){system.highBeams=!system.highBeams;if(system.highBeams)system.headlights=true;}
 if(bridge.hit('j')&&system.driver)system.signal=system.signal==='left'?'off':'left';
 if(bridge.hit('k')&&system.driver)system.signal=system.signal==='right'?'off':'right';
 if(bridge.hit('u')&&system.driver)system.signal=system.signal==='hazard'?'off':'hazard';
 if(bridge.hit('o')&&system.driver&&lighting?.beacon!=='none')system.emergencyLights=!system.emergencyLights;
 if(bridge.hit('h')&&system.driver)engineSound();
 lightingClock+=Math.max(0,Math.min(.1,dt||0));
 for(const b of bridge.boxes)if(b.kind==='parkedcar'&&fleet.hideOriginal(b)){b.fleetHidden=true;b.solid=false;}
 moveCar(dt);
 vehicleFX?.update(dt,state,system.driver,activeModel.length);
 damageFX?.update(dt);
 if(system.driver&&damage.integrity<=.56){
  const intensity=Math.min(1,(.62-damage.integrity)/.57);
  damageFX?.smoke('driver',state.x+Math.cos(state.angle)*activeModel.length*.31,
   state.y+Math.sin(state.angle)*activeModel.length*.31,intensity,dt,
   Math.max(.7,system.bodyHeight*.72));
 }
};
system.interact=interact;
system.drawHUD=drawPanel;
system.prompt=()=>{const b=system.ready&&!system.driver&&fleet.nearest(bridge.boxes,bridge.player.x,bridge.player.y);return b?'F — entrar no '+getVehicleById(streetModel(b)).name:null;};
system.render=()=>{
 // Não executar uma cena 3D pesada enquanto o GLB inicial é decodificado.
 // Além de aliviar a GPU, isso libera o carregamento no navegador.
 if(!renderer||!system.ready)return;
 const c=bridge.cam;
 setCamera();
 if(body){body.visible=!!activeKey;body.position.set(state.x,0,state.y);
 body.rotation.set(system.driver?-state.steer*Math.min(.1,Math.abs(state.speed)*.004):0,-state.angle,0);}
 system.lightState=lighting?.apply(lightFlags(),lightingClock)||null;
 // noite: as luzes da cena acompanham o escurecimento do jogo 2D
 if(ambience)ambience.update(viewCamera);   // sol/luar na direção do astro, céu do horário, vento e neve
 else{
  const night=bridge.world.night?.15:1;
  for(const [l,k] of scene.userData.lights)l.intensity=k*night;
  scene.userData.lights[0][0].color.setHex(bridge.world.night?0x8090c0:0xf8ead9);
  scene.userData.sun.castShadow=!bridge.world.night;   // sem sombra do sol à noite
 }
 if(vegetation){
  // vazado em volta de quem a câmera segue: o jogador a pé (1 m de altura) ou o carro
  const p=bridge.player,occupied=bridge.houses.find(H=>H.architecture&&H.inside),indoorRadius=occupied?Math.min(12,Math.hypot(occupied.x1-occupied.x0,occupied.y1-occupied.y0)*.52):1.7;
  const target=system.driver?{x:state.x,y:state.y,z:.8,r:3.2}:p&&{x:p.x,y:p.y,z:.95+(p.floorZ||0),r:indoorRadius};
  vegetation.update(performance.now()/1000,viewCamera,renderer,target);shadowGround.visible=false;
 }
 props3d?.update(performance.now()/1000,bridge.gameTime||0);
 window.CityPets?.render();
 architecture3d?.update();
 house3d?.update(performance.now()/1000);
 birds?.update();
 landmarks?.update();
 airport3d?.update();
 gas3d?.update();
 parked3d?.update();
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
 
 renderer.render(scene,viewCamera);
 system.frames=(system.frames||0)+1;
 system.lastScreenPosition={
  // GLB em tempo real usa exatamente a mesma projecao ortografica.
  x:c.W/2+(c.cos*(state.x-c.x)-c.sin*(state.y-c.y))*c.zoom,
  y:c.H/2+(c.sin*(state.x-c.x)+c.cos*(state.y-c.y))*(c.tilt||.5)*c.zoom
 };
};
system.collider={x:-10000,y:-10000,r:.55,kind:'vehicle',h:1.4};bridge.world.circles.push(system.collider);
async function selectModel(id){
 const choice=getVehicleById(id);
 if(!choice||system.driver)return false;
 const serial=++loadingSerial;
 system.ready=false;system.status='loading';system.wheelStatus='loading';
 system.error=null;
 try{
  const gltf=await loadVehicleGLB(choice);
  if(serial!==loadingSerial)return false;
  if(body){
   deformation?.dispose();deformation=null;
   scene.remove(body);
   // Luzes auxiliares são exclusivas do veículo anterior; o GLB é compartilhado.
   lighting?.dispose();lighting=null;
  }
  activeModel=choice;
  // Clone em cache: cada seleção recebe malhas e pivôs intactos.
  damage=createVehicleDamage();system.damage=damage;
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
// Auditoria GPU e contagem real dos triângulos de cada GLB.
system.assetMetrics=null;
system.getPerformanceMetrics=()=>({
 activeModel:system.modelId,
 gpu:{geometries:renderer?.info.memory.geometries||0,
      textures:renderer?.info.memory.textures||0},
 frame:{triangles:renderer?.info.render.triangles||0,
        drawCalls:renderer?.info.render.calls||0,
        lines:renderer?.info.render.lines||0},
 parked:{...system.parked3d},
 integrity:damage.integrity,damageTier:damageTier(damage),damageImpacts:damage.impacts,
 cache:vehicleAssetCacheStats(),
 assetCatalog:system.assetMetrics?.summary||null,
 activeAsset:system.assetMetrics?.models?.find(m=>m.id===system.modelId)||null
});
window.cityVehicleMetrics=()=>system.getPerformanceMetrics();
fetch('assets/vehicles/metrics.json').then(r=>{
 if(!r.ok)throw Error('Vehicle metrics unavailable');
 return r.json();
}).then(data=>{system.assetMetrics=data;}).catch(err=>
 console.info('GLB audit metrics unavailable',err.message));
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
system.deliverVehicle=async id=>{
 if(system.driver||claiming||!await selectModel(id))return false;
 const q=nearestSafeParking();if(!isFree(q.x,q.y,q.angle))return false;
 const key='owned:'+id,prior=fleet.saved.get(key);if(prior){prior.fleetHidden=true;prior.solid=false;}
 const b=fleet.park(key,{x:q.x,y:q.y,rot:q.angle,w:activeModel.length,d:system.bodyWidth,h:1.5,modelId:id,col:'#c3c6c9',fuel:.65});
 b.draw=bridge.drawParkedCar;const saved=bridge.addBox(b);fleet.saved.set(key,saved);bridge.world.version++;return true;
};
system.nextModel=()=>selectModel(VEHICLE_MODELS[
 (VEHICLE_MODELS.findIndex(x=>x.id===activeModel.id)+1)%VEHICLE_MODELS.length].id);
(async()=>{
 try{
  // Começa o download do sedã enquanto o mundo 3D é montado, sem bloquear
  // a inicialização síncrona de iluminação, vegetação e arquitetura.
  loadVehicleGLB(activeModel).catch(()=>{});
  initRenderer();
  await selectModel(activeModel.id);
 }
 catch(error){system.status='failed';system.error=String(error);console.error(error);}
})();
