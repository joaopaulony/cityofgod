import * as T from 'three';
import {PET_BREEDS} from '../js/pet-catalog.mjs';
import {createAnimatedPet} from '../js/pet-animated.mjs';
const ids=['sharpei','benny'],items=[],renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(620,385,false);renderer.setPixelRatio(1);renderer.setClearColor('#e9ece4');
const world=new T.Scene();world.add(new T.HemisphereLight(0xffffff,0x8b9f8c,2.5));
const sun=new T.DirectionalLight(0xffe8c3,3);sun.position.set(3,7,4);world.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(12,12),new T.MeshStandardMaterial({color:'#e5eadf',roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.01;world.add(ground);
for(const id of ids){
 const breed=PET_BREEDS.find(b=>b.id===id);
 if(!breed)throw Error('New licensed dog missing: '+id);
 const card=document.createElement('article');card.innerHTML='<img alt="'+breed.name+'"><h2>'+breed.name+'</h2><p>Modelo 3D real · esqueleto e clipes de animação</p>';
 document.querySelector('main').append(card);
 const model=createAnimatedPet(id,'original');await model.ready;
 const b=new T.Box3().setFromObject(model.root),center=b.getCenter(new T.Vector3()),size=b.getSize(new T.Vector3());
 const span=Math.max(size.x,size.y*1.3,size.z,1);
 const camera=new T.OrthographicCamera(-span*1.1,span*1.1,span*.7,-span*.7,.01,90);
 camera.position.copy(center).add(new T.Vector3(span*2.4,span*1.15,span*2.6));camera.lookAt(center);
 items.push({breed,model,card,camera});
}
window.reviewRealDogs=(mode='idle')=>{
 const result=[];
 for(const item of items){
  world.add(item.model.root);
  for(let k=0;k<22;k++)item.model.animate({action:mode,clock:k*.075,phase:k*.6,
    speed:mode==='run'?2.3:mode==='walk'?.65:0},.075);
  renderer.render(world,item.camera);
  item.card.querySelector('img').src=renderer.domElement.toDataURL('image/png');
  result.push({breed:item.breed.id,status:item.model.root.userData.assetStatus,
    loaded:item.model.loaded,clip:item.model.clip,error:String(item.model.error||''),
    clips:item.model.root.userData.clipNames||[],size:new T.Box3().setFromObject(item.model.root).getSize(new T.Vector3()).toArray()});
  world.remove(item.model.root);
 }
 return result;
};
window.realDogsStates=window.reviewRealDogs('idle');
window.realDogsReady=true;
