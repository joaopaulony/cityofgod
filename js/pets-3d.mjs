import * as T from 'three';
import {createAnimatedPet,isAnimatedBreed} from './pet-animated.mjs';
import {petBreed} from './pet-catalog.mjs';
import {createPetController} from './pet-behavior.mjs';
import {mountPetUI} from './pet-ui.mjs';
export function createPets(scene,bridge){
 const controller=createPetController({
  player:bridge.player,houses:()=>bridge.houses,owned:H=>!!window.CityHome?.owned(H),key:H=>window.CityHome.key(H),nav:window.CityHomeNav,
  storage:window.localStorage,notify:text=>window.CityUI?.notify(text),collide:bridge.collide,
  move:bridge.movePet||((ox,oy,x,y,r,floor)=>bridge.collide(x,y,r,floor)),stairs:bridge.petStairs,driving:bridge.driving,
  water:(x,y)=>bridge.pondVal(x,y)>1.02||bridge.onRoad(x,y)
 });
 const models=new Map(),photos=new Map();let photoRenderer=null,ui;
 const api={controller,actors:controller.pets,get status(){return controller.status;},get uiOpen(){return !!ui?.active;},
  tick:dt=>{controller.tick(dt);},
  render(){
   for(const pet of controller.pets){
    let model=models.get(pet.id);
    if(!model){model=createAnimatedPet(pet.breed,pet.color);models.set(pet.id,model);scene.add(model.root);}
    const H=pet.homeHouse,inHouse=H&&(H.contains?H.contains(pet.x,pet.y,pet.floor):pet.x>H.x0&&pet.x<H.x1&&pet.y>H.y0&&pet.y<H.y1);
    model.root.visible=pet.visible&&Math.hypot(pet.x-bridge.cam.x,pet.y-bridge.cam.y)<65&&(!inHouse||H.inside&&pet.floor===(bridge.player.floor||0)||!!pet.stairTravel&&H.inside);
    model.root.position.set(pet.x,pet.floorZ||0,pet.y);model.root.rotation.y=-pet.face;
    if(model.root.visible)model.animate(pet,Math.max(0,Math.min(.08,pet.clock-(model.lastClock??pet.clock))));
    model.lastClock=pet.clock;
   }
  },
  portrait(breed,color){
   const key=breed+':'+color;
   if(photos.has(key))return photos.get(key);
   const capture=model=>{
    if(!photoRenderer){photoRenderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
     photoRenderer.setSize(300,200,false);photoRenderer.setClearColor(0,0);}
    const world=new T.Scene();world.add(model.root);
    world.add(new T.HemisphereLight(0xffffff,0xa3b1a1,2.4));
    const sun=new T.DirectionalLight(0xffedcf,3);sun.position.set(2,4,3);world.add(sun);
    model.animate({clock:1,phase:0,speed:0,action:'idle'},.032);
    const bounds=new T.Box3().setFromObject(model.root),center=bounds.getCenter(new T.Vector3()),
      size=bounds.getSize(new T.Vector3()),span=Math.max(size.x,size.y*1.5,size.z*1.6)*.8;
    const camera=new T.OrthographicCamera(-span*1.5,span*1.5,span,-span,.01,20);
    camera.position.copy(center).add(new T.Vector3(span*2.6,span*1.3,span*2.8));camera.lookAt(center);
    photoRenderer.render(world,camera);const url=photoRenderer.domElement.toDataURL('image/png');
    model.dispose();return url;
   };
   if(isAnimatedBreed(breed)){
    const animal=petBreed(breed);
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#e8ede3"/>'+
     '<text x="150" y="94" text-anchor="middle" font-size="35">🐾</text><text x="150" y="122" text-anchor="middle" fill="#476556" font-family="Arial" font-size="15">'+
     animal.name+'</text><text x="150" y="145" text-anchor="middle" fill="#7b8e83" font-size="12">Carregando 3D...</text></svg>';
    const placeholder='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    photos.set(key,placeholder);
    const model=createAnimatedPet(breed,color);
    model.ready.then(()=>{
      try{
       const url=capture(model);
       photos.set(key,url);
       window.dispatchEvent(new CustomEvent('city-pet-portrait-ready',{detail:{breed,color,url}}));
      }catch(err){console.warn('Pet portrait',breed,err);model.dispose();}
    });
    return placeholder;
   }
   throw Error('O catálogo só contém modelos 3D importados');
  },
  releaseControls(){bridge.releaseControls?.();bridge.player.wantShot=false;bridge.player.aiming=false;},
  otherModal:()=>!!(window.CityHomeUI?.active||window.cityCharacterEditorOpen||window.CityUI?.phoneOpen||window.CityUI?.wheelOpen),
  notify:text=>window.CityUI?.notify(text),open:()=>ui.open(),close:()=>ui.close(),
  adopt:(...args)=>controller.adopt(...args),command:(...args)=>controller.command(...args)
 };
 ui=mountPetUI(api);window.CityPets=api;return api;
}
