import * as T from 'three';
import {PET_BREEDS} from '../js/pet-catalog.mjs';
import {buildPet} from '../js/pet-model.mjs';
const items=[];
for(const breed of PET_BREEDS.filter(b=>!b.model)){
 const card=document.createElement('article');card.innerHTML=`<canvas></canvas><div><h2>${breed.name}</h2><p>${breed.colors.map(c=>c.name).join(' · ')}</p></div>`;document.querySelector('main').append(card);
 const renderer=new T.WebGLRenderer({canvas:card.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});renderer.setSize(410,265,false);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.setClearColor('#edf0e4');
 const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0x9ba88e,2.5));
 const sun=new T.DirectionalLight(0xffefd8,3);sun.position.set(2,3,2);sun.castShadow=true;scene.add(sun);
 const floor=new T.Mesh(new T.PlaneGeometry(6,6),new T.MeshStandardMaterial({color:0xe6eadc,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;scene.add(floor);
 const camera=new T.OrthographicCamera(-.94,.94,.61,-.61,.01,20);camera.position.set(1.9,1.1,2.1);camera.lookAt(0,.30,0);
 const model=buildPet(breed.id,breed.colors[0].id);scene.add(model.root);items.push({renderer,scene,camera,model,breed});
}
window.reviewPets=(action='idle',time=1.2,colorIndex=0)=>{
 for(const item of items){
  const color=item.breed.colors[colorIndex];
  if(item.model.colors.id!==color.id){item.model.dispose();item.model=buildPet(item.breed.id,color.id);item.scene.add(item.model.root);}
  item.model.animate({clock:time,phase:time*7,speed:action==='walk'?.7:action==='run'?2:0,action},0);
  item.renderer.render(item.scene,item.camera);
 }
 return items.map(i=>({breed:i.breed.id,bounds:new T.Box3().setFromObject(i.model.root).getSize(new T.Vector3()).toArray()}));
};
window.reviewPets();window.petReviewReady=true;
