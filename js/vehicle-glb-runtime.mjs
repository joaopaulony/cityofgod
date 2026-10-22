// Converte GLB originais para quadros 2D no navegador (Three.js/WebGL).
// NENHUM Blender e necessario. O mundo continua sendo Canvas 2D.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {NATIVE_CAR_MODELS} from './vehicle-model-catalog.mjs';

const SIZE=384, DIRECTIONS=16, REFERENCE_ZOOM=68;
const states=new Map();
const loadedModels=[];
const geometryInfo=new Map();
window.vehicleNative3D={states,loadedModels,geometryInfo,models:NATIVE_CAR_MODELS,
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
const ELEVATION=Math.asin(.5); // ground depth projects with TILT=sin(elevation)
camera.position.set(0,Math.tan(ELEVATION)*15,15);
camera.lookAt(0,0,0);
camera.updateProjectionMatrix();
const loader=new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

function normalizedCar(gltf,model){
 const root=gltf.scene;
 root.updateMatrixWorld(true);
 const measure=node=>{
  const b=new THREE.Box3().setFromObject(node),
   center=new THREE.Vector3(),size=new THREE.Vector3();
  b.getCenter(center);b.getSize(size);
  return {name:node.name||'',type:node.type,children:node.children.length,
   center:center.toArray().map(x=>+x.toFixed(2)),
   size:size.toArray().map(x=>+x.toFixed(2))};
 };
 const groups=[...root.children];
 if(groups.length===1&&groups[0].children.length>1)
  groups.push(...groups[0].children.slice(0,22));
 geometryInfo.set(model.id,{
  root:measure(root),
  groups:groups.slice(0,24).map(measure)
 });
 const raw=new THREE.Box3().setFromObject(root);
 if(raw.isEmpty())throw Error('No vehicle mesh');
 const span=new THREE.Vector3();raw.getSize(span);
 if(!(span.x>0&&span.y>0&&span.z>0))throw Error('Invalid car bounds');
 // Center and scale inside independent parent groups. Any subsequent yaw
 // rotates about the TRUE center, rather than rotating the offset geometry.
 const centered=new THREE.Group();
 centered.position.set(-(raw.min.x+raw.max.x)/2,
                        -raw.min.y,
                       -(raw.min.z+raw.max.z)/2);
 centered.add(root);
 const scaled=new THREE.Group();
 const sourceLen=Math.max(span.x,span.z),
  vehicle=CAR_MODELS.find(x=>x.id===model.id);
 scaled.scale.setScalar((vehicle?.len||4.6)/sourceLen);
 scaled.add(centered);
 const orient=new THREE.Group();
 orient.rotation.y={
  '+X':0,'-X':Math.PI,
  '+Z':Math.PI/2,'-Z':-Math.PI/2
 }[model.frontAxis]??0;
 orient.add(scaled);
 const body=new THREE.Group();
 body.add(orient);
 const dims=new THREE.Vector3();
 new THREE.Box3().setFromObject(body).getSize(dims);
 return {body,height:dims.y,longSide:Math.max(dims.x,dims.z)};
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
   // The Three.js Y rotation must be NEGATIVE so positive Canvas yaw
   // moves the car nose clockwise/downwards, not counterclockwise.
   car.body.rotation.y=-frame*2*Math.PI/DIRECTIONS;
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
  const definition=CAR_MODELS.find(x=>x.id===model.id);
  if(definition)definition.name=model.title;
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
