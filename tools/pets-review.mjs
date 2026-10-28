import * as T from 'three';
import {PET_BREEDS} from '../js/pet-catalog.mjs';
import {createAnimatedPet} from '../js/pet-animated.mjs';

// Single renderer shared by the fourteen genuine 3D assets. No procedural
// Yorkshire, Rottweiler, Lulu or cats are created in this review.
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(420,265,false);renderer.setPixelRatio(1);
renderer.setClearColor('#edf0e4');
const scene=new T.Scene();
scene.add(new T.HemisphereLight(0xffffff,0x9ba88e,2.5));
const sun=new T.DirectionalLight(0xffefd8,3);sun.position.set(2,4,3);scene.add(sun);
const floor=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshStandardMaterial({color:'#e6eadc'}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.005;scene.add(floor);
const items=[];
for(const breed of PET_BREEDS){
 const card=document.createElement('article');
 card.innerHTML='<img alt="'+breed.name+'"><div><h2>'+breed.name+'</h2><p>'+
  breed.colors.map(c=>c.name).join(' · ')+'</p></div>';
 document.querySelector('main').append(card);
 const model=createAnimatedPet(breed.id,breed.colors[0].id);
 await model.ready;
 const bounds=new T.Box3().setFromObject(model.root),c=bounds.getCenter(new T.Vector3()),
       size=bounds.getSize(new T.Vector3()),span=Math.max(size.x,size.y*1.45,size.z*1.4,.5);
 const camera=new T.OrthographicCamera(-span*1.4,span*1.4,span*.9,-span*.9,.01,50);
 camera.position.copy(c).add(new T.Vector3(span*2.6,span*1.3,span*2.8));
 camera.lookAt(c);
 items.push({breed,model,camera,card});
}
window.reviewPets=async(action='idle',time=1.2,colorIndex=0)=>{
 const results=[];
 for(const item of items){
  const color=item.breed.colors[colorIndex]||item.breed.colors[0];
  if(item.model.colors.id!==color.id){
   item.model.dispose();item.model=createAnimatedPet(item.breed.id,color.id);
   await item.model.ready;
  }
  scene.add(item.model.root);
  for(let i=0;i<12;i++)item.model.animate(
   {clock:time+i*.06,phase:(time+i*.06)*7,speed:action==='walk'?.7:action==='run'?2:0,action},.07);
  renderer.render(scene,item.camera);
  item.card.querySelector('img').src=renderer.domElement.toDataURL('image/png');
  scene.remove(item.model.root);
  results.push({breed:item.breed.id,loaded:item.model.loaded,clip:item.model.clip});
 }
 return results;
};
window.petReviewResult=await window.reviewPets('idle');
window.petReviewReady=true;
