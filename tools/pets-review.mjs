import * as T from 'three';
import {PET_BREEDS} from '../js/pet-catalog.mjs';
import {createAnimatedPet} from '../js/pet-animated.mjs';
const breeds=PET_BREEDS.filter(b=>b.model),items=[],errors=[];
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(470,300,false);renderer.setPixelRatio(1);renderer.setClearColor('#e6ebe0');
const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0x9ba88e,2.5));
const sun=new T.DirectionalLight(0xffefdc,3);sun.position.set(3,7,4);scene.add(sun);
const floor=new T.Mesh(new T.PlaneGeometry(15,15),new T.MeshStandardMaterial({color:'#e7ece0',roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.012;scene.add(floor);
for(const b of breeds){
 const card=document.createElement('article');
 card.innerHTML='<img alt="'+b.name+'"><div><h2>'+b.name+'</h2><p>'+b.label+' · Modelo glTF animado</p></div>';
 document.querySelector('main').append(card);
 const model=createAnimatedPet(b.id,'original');await model.ready;
 if(!model.loaded)errors.push({breed:b.id,error:String(model.error)});
 const root=model.root;
 const bbox=new T.Box3().setFromObject(root),center=bbox.getCenter(new T.Vector3()),size=bbox.getSize(new T.Vector3());
 const span=Math.max(size.x*1.15,size.y*1.3,size.z*1.3,.5);
 const camera=new T.OrthographicCamera(-span*.9,span*.9,span*.58,-span*.58,.01,80);
 camera.position.copy(center).add(new T.Vector3(span*1.75,span*.8,span*1.9));camera.lookAt(center);
 items.push({breed:b,model,card,camera,bounds:size.toArray()});
}
window.reviewPets=(action='idle',time=1.3)=>{
 const output=[];
 for(const item of items){
  item.model.root.position.set(0,0,0);
  scene.add(item.model.root);
  for(let i=0;i<15;i++)item.model.animate({action,clock:time+i*.07,phase:(time+i*.07)*8,
   speed:action==='run'?2.1:action==='walk'?.9:0},.075);
  renderer.render(scene,item.camera);
  item.card.querySelector('img').src=renderer.domElement.toDataURL('image/png');
  output.push({id:item.breed.id,model:item.breed.model,loaded:item.model.loaded,clip:item.model.clip,
   status:item.model.root.userData.assetStatus,dimensions:item.bounds});
  scene.remove(item.model.root);
 }
 return output;
};
window.reviewPets('idle',1.3);
window.petReview={breeds:breeds.map(b=>b.id),items,errors};
window.petReviewReady=true;