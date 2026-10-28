import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {CAS_DEFAULT,CAS_KEY,normalizeCAS,readCAS,writeCAS} from './cas-profile.mjs';
import {applyCASStyle,casCapabilities} from './cas-assets.mjs';

export function installCASCreator(system,bridge,bases){
 const dialog=document.createElement('dialog');
 dialog.id='city-cas-dialog';
 dialog.setAttribute('aria-label','Criar personagem City of God');
 dialog.style.cssText='border:1px solid #5d7381;border-radius:18px;background:#111b24;color:#f4eee8;padding:0;width:min(980px,96vw);max-height:94vh;overflow:auto;font:14px system-ui;box-shadow:0 25px 85px #000a';
 dialog.innerHTML=
  '<div style="padding:20px 24px 14px;border-bottom:1px solid #ffffff20"><div style="font-size:11px;letter-spacing:.23em;color:#c7a975">CITY OF GOD · CRIADOR DE PERSONAGENS</div>'+
  '<h2 style="margin:8px 0 3px;font-size:26px">Crie sua identidade</h2><p style="margin:0;color:#b7c5cf">CAS · Edição 3D · Duas bases humanas · Preparado para modelos Higgsfield GLB</p></div>'+
  '<div style="display:grid;grid-template-columns: minmax(240px,1.1fr) minmax(260px,1fr);gap:18px;padding:20px 24px" id="cas-layout">'+
  '<div style="min-width:0"><canvas id="cas-preview" width="420" height="530" aria-label="Pré-visualização 3D giratória do personagem" style="display:block;position:static;inset:auto;width:100%;height:auto;aspect-ratio:420 / 530;border-radius:12px;touch-action:none;cursor:grab;background:#253342"></canvas>'+
  '<p style="color:#9babb7;font-size:12px;text-align:center">Arraste para girar · Prévia 3D animada</p>'+
  '<p id="cas-source" style="font-size:12px;color:#c7a975"></p></div>'+
  '<form id="cas-form" style="min-width:0;display:grid;align-content:start;gap:13px">'+
  '<label style="display:grid;gap:5px">Nome do personagem<input type="text" name="name" maxlength="24" required style="padding:10px;background:#22313e;color:#fff;border:1px solid #5d7381;border-radius:7px"></label>'+
  '<fieldset style="border:1px solid #4a6170;border-radius:9px;padding:12px"><legend>Base do personagem</legend>'+
  '<label style="display:inline-block;margin-right:18px"><input type="radio" name="sex" value="male" checked> Masculina</label>'+
  '<label style="display:inline-block"><input type="radio" name="sex" value="female"> Feminina</label></fieldset>'+
  '<fieldset style="border:1px solid #4a6170;border-radius:9px;padding:12px;display:grid;gap:10px"><legend>Corpo</legend>'+
  '<label>Altura <output id="cas-height-out">100%</output><input type="range" name="height" min=".90" max="1.10" step=".01" value="1" style="width:100%"></label>'+
  '<label>Constituição física <output id="cas-build-out">100%</output><input type="range" name="build" min=".86" max="1.14" step=".01" value="1" style="width:100%"></label></fieldset>'+
  '<fieldset style="border:1px solid #4a6170;border-radius:9px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px"><legend>Aparência e roupas</legend>'+
  '<label>Cor da pele <input type="color" name="skin" value="#c98d68"></label>'+
  '<label>Cor do cabelo <input type="color" name="hair" value="#30231e"></label>'+
  '<label>Roupa superior <input type="color" name="top" value="#49647a"></label>'+
  '<label>Calça <input type="color" name="bottom" value="#29394f"></label>'+
  '<p id="cas-capabilities" style="grid-column:1/-1;color:#aebfc8;font-size:12px;margin:0"></p></fieldset>'+
  '<div id="cas-message" role="status" style="font-size:12px;color:#e3c88c"></div>'+
  '<div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" id="cas-cancel" style="padding:10px 14px;background:#36444f;border:0;border-radius:8px;color:#fff;cursor:pointer">Cancelar</button>'+
  '<button type="submit" id="cas-save" style="padding:10px 16px;background:#d4a56d;border:0;border-radius:8px;color:#211a17;font-weight:700;cursor:pointer">Salvar personagem</button></div></form></div>';
 const style=document.createElement('style');
 style.textContent='@media(max-width:690px){#cas-layout{grid-template-columns:1fr!important}#cas-preview{max-height:40vh!important;object-fit:contain}}';
 const button=document.createElement('button');
 button.id='city-cas-open';
 button.textContent='Criar personagem';
 button.style.cssText='position:fixed;top:16px;left:calc(50% - 82px);z-index:40;padding:9px 13px;border-radius:8px;border:1px solid #b49269;background:#17232c;color:#f5e7d5;cursor:pointer';
 document.head.append(style);document.body.append(dialog,button);
 const form=dialog.querySelector('#cas-form'),canvas=dialog.querySelector('#cas-preview'),message=dialog.querySelector('#cas-message');
 let renderer;
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setSize(420,530,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
 }catch(error){
  message.textContent='Prévia 3D indisponível neste navegador: '+String(error.message||error);
  button.disabled=true;system.casWarnings.push('Editor sem WebGL');
  return;
 }
 const scene=new THREE.Scene();scene.background=new THREE.Color('#253342');
 scene.add(new THREE.HemisphereLight(0xfff5ea,0x556474,2.5));
 const light=new THREE.DirectionalLight(0xffffff,2.4);light.position.set(2,4,5);scene.add(light);
 const backlight=new THREE.DirectionalLight(0xc5d9e4,1.1);backlight.position.set(-3,3,-3);scene.add(backlight);
 const camera=new THREE.PerspectiveCamera(34,420/530,.01,40);
 camera.position.set(0,1.1,3.8);camera.lookAt(0,.95,0);
 let root=null,mixer=null,rotation=0,previewSex=null,last=performance.now(),drag=null;
 const currentSex=()=>form.querySelector('input[name=sex]:checked').value;
 const values=()=>normalizeCAS(Object.fromEntries(new FormData(form)));
 function disposePreview(){
  if(!root)return;
  mixer?.stopAllAction();scene.remove(root);
  root.traverse(o=>{if(o.isMesh)for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();});
  root=null;mixer=null;
 }
 function refreshModel(){
  disposePreview();previewSex=currentSex();
  const item=bases.get(previewSex);if(!item)return;
  root=cloneSkeleton(item.gltf.scene);
  root.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=true;}});
  scene.add(root);
  const box=new THREE.Box3().setFromObject(root),height=box.max.y-box.min.y;
  if(Number.isFinite(height)&&height>.01){
   const scale=1.75/height;
   root.scale.multiplyScalar(scale);
   root.position.y=-box.min.y*scale;
  }
  root.userData.casOriginalScale=root.scale.clone();
  mixer=new THREE.AnimationMixer(root);
  const clip=item.spec.clips?.idle?.name;
  const idle=item.gltf.animations.find(c=>c.name===clip)||item.gltf.animations[0];
  if(idle)mixer.clipAction(idle).play();
  const available=casCapabilities(item.spec);
  const unavailable=[];
  for(const slot of ['skin','hair','top','bottom']){
   const enabled=available[slot];form.elements[slot].disabled=!enabled;
   form.elements[slot].parentElement.style.opacity=enabled?'1':'.5';
   if(!enabled)unavailable.push({skin:'pele',hair:'cabelo',top:'camiseta',bottom:'calça'}[slot]);
  }
  dialog.querySelector('#cas-source').textContent='Base '+(previewSex==='male'?'masculina':'feminina')+' · '+item.origin+' · '+(item.spec.triangles||0).toLocaleString('pt-BR')+' triângulos';
  dialog.querySelector('#cas-capabilities').textContent=unavailable.length?'Ainda não editáveis neste modelo: '+unavailable.join(', ')+'. O Higgsfield precisará exportar essas regiões como materiais separados.':'Todas as cores estão disponíveis neste modelo.';
  refreshAppearance();
 }
 function refreshAppearance(){
  const profile=values();if(root){applyCASStyle(root,profile,bases.get(previewSex).spec);root.rotation.y=rotation;}
  dialog.querySelector('#cas-height-out').textContent=Math.round(profile.height*100)+'%';
  dialog.querySelector('#cas-build-out').textContent=Math.round(profile.build*100)+'%';
 }
 function open(){
  const profile=system.casProfile||readCAS(localStorage)||CAS_DEFAULT;
  for(const [key,value] of Object.entries(profile)){
   if(key==='sex'){const radio=form.querySelector('input[name=sex][value='+value+']');if(radio)radio.checked=true;}
   else if(form.elements[key])form.elements[key].value=value;
  }
  rotation=0;message.textContent='';
  window.cityCharacterEditorOpen=true;window.dispatchEvent(new Event('blur'));
  dialog.showModal();refreshModel();
 }
 button.addEventListener('click',open);
 form.addEventListener('input',event=>{
  if(event.target.name==='sex')refreshModel();else refreshAppearance();
 });
 let saving=false;
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(saving)return;saving=true;
  dialog.querySelector('#cas-save').disabled=true;message.textContent='Aplicando aparência no jogo…';
  try{
   const next=values();
   await system.applyCAS(next);
   try{writeCAS(localStorage,next);message.textContent='Personagem salvo.';}
   catch{message.textContent='Aplicado, mas não foi possível salvar no armazenamento deste navegador.';}
   dialog.close();
  }catch(error){message.textContent='Não foi possível aplicar o modelo: '+String(error.message||error);}
  finally{saving=false;dialog.querySelector('#cas-save').disabled=false;}
 });
 dialog.querySelector('#cas-cancel').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{window.cityCharacterEditorOpen=false;drag=null;});
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,angle:rotation};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;rotation=drag.angle+(e.clientX-drag.x)*.012;refreshAppearance();});
 canvas.addEventListener('pointerup',()=>{drag=null;});
 canvas.addEventListener('pointercancel',()=>{drag=null;});
 function animate(time){
  const dt=Math.min(.06,(time-last)/1000);last=time;
  if(dialog.open&&root){mixer?.update(dt);renderer.render(scene,camera);}
  requestAnimationFrame(animate);
 }requestAnimationFrame(animate);
 system.openCreator=open;
 system.casStorageKey=CAS_KEY;
}
