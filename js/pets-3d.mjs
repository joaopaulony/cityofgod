import * as T from 'three';
import {buildPet} from './pet-model.mjs';
import {petBreed} from './pet-catalog.mjs';
import {hasQuaterniusPet,loadQuaterniusPet,quaterniusReady,createQuaterniusPet,quaterniusLoadingStatus} from './quaternius-pet.mjs';
import {createPetController} from './pet-behavior.mjs';
import {mountPetUI} from './pet-ui.mjs';
export function createPets(scene,bridge){
 const controller=createPetController({
  player:bridge.player,houses:()=>bridge.houses,owned:H=>!!window.CityHome?.owned(H),key:H=>window.CityHome.key(H),nav:window.CityHomeNav,
  storage:window.localStorage,notify:text=>window.CityUI?.notify(text),collide:bridge.collide,
  move:bridge.movePet||((ox,oy,x,y,r,floor)=>bridge.collide(x,y,r,floor)),stairs:bridge.petStairs,driving:bridge.driving,
  water:(x,y)=>bridge.pondVal(x,y)>1.02||bridge.onRoad(x,y)
 });
 const models=new Map(),photos=new Map(),portraitJobs=new Set(),modelErrors=new Map();
 let photoRenderer=null,ui;
 function tryUpgrade(pet,model){
  if(!hasQuaterniusPet(pet.breed)||model.quaternius||model.pending||modelErrors.has(pet.breed))return;
  model.pending=true;
  loadQuaterniusPet(pet.breed).then(()=>{
   if(models.get(pet.id)!==model)return;
   const upgraded=createQuaterniusPet(pet.breed,pet.color);
   if(!upgraded)throw Error('Não foi possível clonar pet: '+pet.breed);
   upgraded.lastClock=pet.clock;scene.add(upgraded.root);
   model.root.removeFromParent();model.dispose();
   models.set(pet.id,upgraded);
  }).catch(err=>{model.pending=false;modelErrors.set(pet.breed,String(err?.message||err));console.warn('Pet 3D fallback:',pet.breed,err);});
 }
 const api={controller,actors:controller.pets,get status(){return controller.status;},get uiOpen(){return !!ui?.active;},
  tick:dt=>{controller.tick(dt);},
  render(){
   for(const pet of controller.pets){
    let model=models.get(pet.id);
    if(!model){model=quaterniusReady(pet.breed)?createQuaterniusPet(pet.breed,pet.color):null;
      model ||= buildPet(pet.breed,pet.color);
      models.set(pet.id,model);scene.add(model.root);
    }
    const H=pet.homeHouse,inHouse=H&&(H.contains?H.contains(pet.x,pet.y,pet.floor):pet.x>H.x0&&pet.x<H.x1&&pet.y>H.y0&&pet.y<H.y1);
    model.root.visible=pet.visible&&Math.hypot(pet.x-bridge.cam.x,pet.y-bridge.cam.y)<65&&(!inHouse||H.inside&&pet.floor===(bridge.player.floor||0)||!!pet.stairTravel&&H.inside);
    if(model.root.visible)tryUpgrade(pet,model);
    model.root.position.set(pet.x,pet.floorZ||0,pet.y);model.root.rotation.y=-pet.face;
    if(model.root.visible)model.animate(pet,Math.max(0,Math.min(.08,pet.clock-(model.lastClock??pet.clock))));
    model.lastClock=pet.clock;
   }
  },
  portrait(breed,color){
   if(hasQuaterniusPet(breed)&&!quaterniusReady(breed)&&!portraitJobs.has(breed)){
    portraitJobs.add(breed);
    loadQuaterniusPet(breed).then(()=>{
     for(const key of [...photos.keys()])if(key.startsWith(breed+':'))photos.delete(key);
     ui?.refreshImages?.();
    }).catch(err=>{
     modelErrors.set(breed,String(err?.message||err));console.warn('Falha ao carregar pet:',breed,err);
    });
   }
   const key=breed+':'+color;if(photos.has(key))return photos.get(key);
   if(!photoRenderer){photoRenderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});photoRenderer.setSize(300,200,false);photoRenderer.setClearColor(0,0);}
   const world=new T.Scene(),model=(quaterniusReady(breed)?createQuaterniusPet(breed,color):null)||buildPet(breed,color);
   world.add(model.root);
   world.add(new T.HemisphereLight(0xffffff,0xa3b1a1,2.4));const sun=new T.DirectionalLight(0xffedcf,3);sun.position.set(2,4,3);world.add(sun);
   const bounds=new T.Box3().setFromObject(model.root),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),span=Math.max(size.x,size.y*1.5,size.z*1.6)*.80;
   const camera=new T.OrthographicCamera(-span*1.5,span*1.5,span,-span,.01,20);camera.position.copy(center).add(new T.Vector3(span*2.6,span*1.3,span*2.8));camera.lookAt(center);
   photoRenderer.render(world,camera);const url=photoRenderer.domElement.toDataURL('image/png');model.dispose();photos.set(key,url);return url;
  },
  releaseControls(){bridge.releaseControls?.();bridge.player.wantShot=false;bridge.player.aiming=false;},
  otherModal:()=>!!(window.CityHomeUI?.active||window.cityCharacterEditorOpen||window.CityUI?.phoneOpen||window.CityUI?.wheelOpen),
  notify:text=>window.CityUI?.notify(text),open:()=>ui.open(),close:()=>ui.close(),
  adopt:(...args)=>controller.adopt(...args),command:(...args)=>controller.command(...args),
  get importedModels(){return [...models.entries()].filter(([,m])=>m.quaternius).map(([id,m])=>({id,breed:m.breed.id,animation:m.currentAnimation}));},
  get modelErrors(){return [...modelErrors.entries()].map(([breed,message])=>({breed,message}));},
  get quaterniusStatus(){return quaterniusLoadingStatus();}
 };
 ui=mountPetUI(api);window.CityPets=api;return api;
}
