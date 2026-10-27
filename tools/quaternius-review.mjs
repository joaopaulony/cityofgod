import * as T from 'three';
import {PET_BREEDS} from '../js/pet-catalog.mjs';
import {loadQuaterniusPet,createQuaterniusPet} from '../js/quaternius-pet.mjs';
const breeds=PET_BREEDS.filter(b=>b.asset),names=document.getElementById('labels');
for(const b of breeds){const div=document.createElement('div');div.innerHTML='<span>'+b.name+'</span>';names.append(div);}
const renderer=new T.WebGLRenderer({canvas:document.getElementById('stage'),antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1440,1050,false);renderer.setPixelRatio(1);
renderer.setScissorTest(true);renderer.autoClear=true;
const entries=[];
window.petQuaterniusReady=false;
window.petQuaterniusErrors=[];
for(let i=0;i<breeds.length;i++){
 const b=breeds[i];
 try{
  await loadQuaterniusPet(b.id);
  const model=createQuaterniusPet(b.id,'natural');
  if(!model)throw Error('Model was not cloned');
  const scene=new T.Scene();scene.background=new T.Color('#f6f7ee');
  scene.add(new T.HemisphereLight(0xffffff,0xa6b5a3,2.5));
  const sun=new T.DirectionalLight(0xffead4,3.3);sun.position.set(2,4,4);scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(6,6),new T.MeshStandardMaterial({color:'#e3e9dc',roughness:.95}));
  floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);scene.add(model.root);
  const box=new T.Box3().setFromObject(model.root),center=box.getCenter(new T.Vector3()),s=box.getSize(new T.Vector3());
  const span=Math.max(.38,s.x*1.4,s.z*1.25,s.y*.95);
  const camera=new T.OrthographicCamera(-span,span,span*.67,-span*.67,.01,35);
  camera.position.set(span*1.8,span*1.1,span*1.7).add(center);
  camera.lookAt(center);
  entries.push({id:b.id,model,scene,camera,slot:i});
 }catch(e){window.petQuaterniusErrors.push({id:b.id,error:String(e)});}
 document.getElementById('load').textContent=(i+1)+'/12 modelos carregados';
}
window.reviewQuaternius=(action='idle')=>{
 for(const e of entries){
  const {model,scene,camera,slot}=e;
  const speed=action==='run'?2.1:action==='walk'?.8:0;
  const before=model.currentAnimation;
  for(let j=0;j<13;j++)model.animate({action,speed,clock:j*.04},.04);
  const x=(slot%4)*360,y=1050-(Math.floor(slot/4)+1)*350;
  renderer.setViewport(x,y,360,350);renderer.setScissor(x,y,360,350);
  renderer.render(scene,camera);
 }
 return entries.map(e=>({id:e.id,animation:e.model.currentAnimation,
  size:new T.Box3().setFromObject(e.model.root).getSize(new T.Vector3()).toArray(),
  boneCount:(()=>{let n=0;e.model.root.traverse(o=>{if(o.isBone)n++});return n;})()}));
};
window.reviewQuaternius('idle');
window.petQuaterniusReady=entries.length===12&&window.petQuaterniusErrors.length===0;
