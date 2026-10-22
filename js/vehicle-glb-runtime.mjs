// Converte GLB originais para quadros 2D no navegador (Three.js/WebGL).
// NENHUM Blender e necessario. O mundo continua sendo Canvas 2D.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {NATIVE_CAR_MODELS} from './vehicle-model-catalog.mjs';

const SIZE=384, DIRECTIONS=16, REFERENCE_ZOOM=68;
const states=new Map();
const loadedModels=[];
window.vehicleNative3D={states,loadedModels,models:NATIVE_CAR_MODELS,
  version:'glb-webgl-bake-1'};
const stage=document.createElement('canvas');
stage.width=SIZE;stage.height=SIZE;
const renderer=new THREE.WebGLRenderer({
 canvas:stage,antialias:true,alpha:true,premultipliedAlpha:true,
 preserveDrawingBuffer:true,powerPreference:'low-power'
});
renderer.setPixelRatio(1);
renderer.setSize(SIZE,SIZE,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.25;
renderer.setClearColor(0x000000,0);
const scene=new THREE.Scene();
scene.background=null;
scene.add(new THREE.HemisphereLight(0xe4eeff,0x3b3e44,2.15));
const keyLight=new THREE.DirectionalLight(0xfff3e4,3);
keyLight.position.set(-4,9,8);scene.add(keyLight);
const fillLight=new THREE.DirectionalLight(0xb4ccff,1.2);
fillLight.position.set(7,4,-5);scene.add(fillLight);
const camera=new THREE.OrthographicCamera(-1,1,1,-1,.05,80);
const ELEVATION=Math.atan2(Math.sqrt(1-.5*.5),.5); // camera ground TILT .5
camera.position.set(0,Math.tan(ELEVATION)*15,15);
camera.lookAt(0,0,0);
camera.updateProjectionMatrix();
const loader=new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

function normalizedCar(gltf,model){
 const root=gltf.scene;
 root.updateMatrixWorld(true);
 const raw=new THREE.Box3().setFromObject(root);
 if(raw.isEmpty())throw Error('No vehicle mesh');
 const span=new THREE.Vector3();raw.getSize(span);
 if(!(span.x>0&&span.y>0&&span.z>0))throw Error('Invalid car bounds');
 const body=new THREE.Group();
 body.add(root);
 // Normalize the longest horizontal extent to the game's real car length.
 // Keep geometry/materials/textures exactly as received from its creator.
 const sourceLen=Math.max(span.x,span.z),
  vehicle=CAR_MODELS.find(x=>x.id===model.id);
 const size=(vehicle?.len||4.6)/sourceLen;
 root.scale.setScalar(size);
 root.position.set(-raw.min.x*size-span.x*size/2,
                   -raw.min.y*size,
                   -raw.min.z*size-span.z*size/2);
 root.updateMatrixWorld(true);
 const front={
  '+X':0,'-X':Math.PI,
  '+Z':Math.PI/2,'-Z':-Math.PI/2
 }[model.frontAxis];
 // Assets can have different coordinate conventions; this offset is
 // explicitly calibrated per model, never guessed frame by frame.
 root.rotation.y=front??0;
 const normalizedBounds=new THREE.Box3().setFromObject(root);
 const dims=new THREE.Vector3();normalizedBounds.getSize(dims);
 const maxSide=Math.max(dims.x,dims.z);
 return {body,height:dims.y,longSide:maxSide};
}

async function bake(model){
 states.set(model.id,'loading');
 const url='assets/vehicles/native-glb/'+model.file;
 const gltf=await loader.loadAsync(url);
 const car=normalizedCar(gltf,model);
 scene.add(car.body);
 // Atlas with fixed frame dimensions and invariant world-ground pivot.
 const atlas=document.createElement('canvas');
 atlas.width=SIZE*4;atlas.height=SIZE*4;
 const ctx=atlas.getContext('2d',{alpha:true});
 if(!ctx)throw Error('No 2D atlas context');
 const orthoSpan=SIZE/REFERENCE_ZOOM;
 const aspect=SIZE/SIZE;
 camera.left=-orthoSpan/2*aspect;
 camera.right=orthoSpan/2*aspect;
 camera.top=orthoSpan/2;
 camera.bottom=-orthoSpan/2;
 camera.updateProjectionMatrix();
 try{
  for(let frame=0;frame<DIRECTIONS;frame++){
   // Positive Canvas yaw = clockwise screen movement at fixed camera.
   car.body.rotation.y=frame*2*Math.PI/DIRECTIONS;
   renderer.clear();
   renderer.render(scene,camera);
   ctx.drawImage(stage,(frame%4)*SIZE,Math.floor(frame/4)*SIZE);
  }
  const old=vehicleHybrid.atlases.get(model.id);
  vehicleHybrid.atlases.set(model.id,{
   config:{model:model.id,directions:DIRECTIONS,columns:4,rows:4,
    frameWidth:SIZE,frameHeight:SIZE,referenceZoom:REFERENCE_ZOOM,
    pivot:{x:SIZE/2,y:SIZE/2},angleOffset:0},
   images:{body:atlas},bakedShadow:false,nativeGLB:true
  });
  vehicleHybrid.states.set(model.id,'native-glb-ready');
  states.set(model.id,'ready');
  loadedModels.push(model.id);
  if(old&&old.images?.body&&old.images.body!==atlas)old.images.body=null;
 }finally{
  scene.remove(car.body);
  gltf.scene.traverse(obj=>{
   if(obj.isMesh&&obj.geometry)obj.geometry.dispose();
  });
 }
}

async function run(){
 try{
  await MeshoptDecoder.ready;
  for(const model of NATIVE_CAR_MODELS){
   try{
    await bake(model);
   }catch(err){
    states.set(model.id,'fallback');
    console.warn('Native GLB car: keeping Canvas 2D fallback',model.id,err);
   }
   // Yield to the main game between heavyweight rasterizations.
   await new Promise(resolve=>setTimeout(resolve,20));
  }
 }catch(err){
  console.warn('3D vehicle subsystem disabled; procedural cars preserved',err);
 }finally{renderer.dispose();}
}
if(new URLSearchParams(location.search).get('hybrid')!=='off')
 run();
