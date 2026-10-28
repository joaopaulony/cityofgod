import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {CAS_DEFAULT,CAS_KEY,normalizeCAS,readCAS,writeCAS} from './cas-profile.mjs';

// Hair-only CAS: no male/female meshes or body/face controls are shown.
// Keep an invisible gameplay skeleton to position animated head accessories.
export function installCASCreator(system,bridge,_unusedBases,hairSystem){
 const dialog=document.createElement('dialog');
 dialog.id='city-cas-dialog';
 dialog.setAttribute('aria-label','City of God: criador de cabelos');
 dialog.style.cssText='border:1px solid #5d7381;border-radius:18px;background:#111b24;color:#f4eee8;padding:0;width:min(780px,96vw);max-height:94vh;overflow:auto;font:14px system-ui;box-shadow:0 25px 85px #000a';
 dialog.innerHTML='<div style="padding:20px 24px 14px;border-bottom:1px solid #ffffff20"><div style="font-size:11px;letter-spacing:.23em;color:#c7a975">CITY OF GOD · CABELOS</div>'+
 '<h2 style="margin:8px 0 3px;font-size:26px">Escolha seu visual</h2><p style="margin:0;color:#b7c5cf">Base feminina recuperada do pacote original · personalize o cabelo.</p></div>'+
 '<div id="cas-layout" style="display:grid;grid-template-columns:minmax(240px,1fr) minmax(240px,.85fr);gap:18px;padding:20px 24px">'+
 '<div style="min-width:0"><canvas id="cas-preview" width="420" height="500" aria-label="Prévia tridimensional do corpo feminino e cabelo" style="display:block;position:static;inset:auto;width:100%;height:auto;aspect-ratio:420/500;border-radius:12px;touch-action:none;cursor:grab;background:#253342"></canvas>'+
 '<p style="color:#9babb7;font-size:12px;text-align:center">Arraste para girar o personagem</p><p id="cas-source" style="font-size:12px;color:#c7a975"></p></div>'+
 '<form id="cas-form" style="min-width:0;display:grid;align-content:start;gap:16px">'+
 '<label style="display:grid;gap:7px">Penteado<select name="hairStyle" style="padding:11px;background:#22313e;color:#fff;border:1px solid #5d7381;border-radius:7px"><option value="none">Sem cabelo</option></select></label>'+
 '<label style="display:grid;gap:7px">Cor do cabelo<input type="color" name="hair" value="#30231e" style="width:100%;height:46px;background:#22313e;border:1px solid #5d7381;border-radius:7px"></label>'+
 '<p id="cas-capabilities" style="font-size:12px;color:#aebfc8;margin:0"></p>'+
 '<div id="cas-message" role="status" style="font-size:12px;color:#e3c88c"></div>'+
 '<div style="display:flex;gap:10px;justify-content:flex-end">'+
 '<button type="button" id="cas-cancel" style="padding:10px 14px;background:#36444f;border:0;border-radius:8px;color:#fff;cursor:pointer">Cancelar</button>'+
 '<button type="submit" id="cas-save" style="padding:10px 16px;background:#d4a56d;border:0;border-radius:8px;color:#211a17;font-weight:700;cursor:pointer">Salvar cabelo</button></div></form></div>';
 const style=document.createElement('style');
 style.textContent='@media(max-width:690px){#cas-layout{grid-template-columns:1fr!important}#cas-preview{max-height:42vh!important;object-fit:contain}}';
 const button=document.createElement('button');
 button.id='city-cas-open';button.textContent='Editar cabelos';
 button.style.cssText='position:fixed;top:16px;left:calc(50% - 82px);z-index:40;padding:9px 13px;border-radius:8px;border:1px solid #b49269;background:#17232c;color:#f5e7d5;cursor:pointer';
 document.head.append(style);document.body.append(dialog,button);
 const form=dialog.querySelector('#cas-form'),canvas=dialog.querySelector('#cas-preview'),message=dialog.querySelector('#cas-message');
 const select=form.elements.hairStyle;
 for(const item of hairSystem?.styles||[]){
  const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.label;select.add(opt);
 }
 const hasHair=(hairSystem?.styles?.length||0)>0;
 if(!hasHair){
  select.disabled=true;
  dialog.querySelector('#cas-capabilities').textContent='O pacote de cabelos ainda não foi instalado no servidor. O editor será liberado quando os arquivos GLB forem publicados.';
 }else{
  dialog.querySelector('#cas-capabilities').textContent=hairSystem.styles.length+' penteados disponíveis · Base feminina com 21 cabelos.';
 }
 let renderer=null;
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setSize(420,500,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
 }catch(error){message.textContent='Prévia 3D não disponível: '+String(error.message||error);}
 const scene=new THREE.Scene();scene.background=new THREE.Color('#253342');
 scene.add(new THREE.HemisphereLight(0xffffff,0x526378,2.1));
 const light=new THREE.DirectionalLight(0xffffff,2.3);light.position.set(2,4,5);scene.add(light);
 const camera=new THREE.PerspectiveCamera(34,420/500,.01,20);
 camera.position.set(0,1.08,3.9);camera.lookAt(0,.96,0);
 const previewRoot=new THREE.Group();previewRoot.name='HairPreviewRoot';
 const head=new THREE.Object3D();head.name='Head';head.position.y=1.665;previewRoot.add(head);scene.add(previewRoot);
 const assetLoader=new GLTFLoader();
 assetLoader.load('assets/characters/cas/female-vincent.glb',gltf=>{
   // Keep the actual rigged mannequin in the preview, with head-mounted hair.
   const root=cloneSkeleton(gltf.scene);
   root.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.frustumCulled=false;}});
   previewRoot.add(root);
   previewRoot.remove(head);
   // Hair system looks for the Head bone recursively inside this group.
   if(dialog.open){lastPreviewKey='';updatePreview();}
 },undefined,error=>{
   dialog.querySelector('#cas-capabilities').textContent+=' · Falha ao abrir a base feminina: '+String(error.message||error);
 });
 let rotation=0,drag=null,lastPreviewKey='';
 const currentProfile=()=>normalizeCAS({...system.casProfile,hairStyle:select.value,hair:form.elements.hair.value});
 function updatePreview(){
  const profile=currentProfile();
  previewRoot.rotation.y=rotation;
  const key=profile.hairStyle+'|'+profile.hair;
  if(lastPreviewKey!==key){
   lastPreviewKey=key;
   void hairSystem?.set(previewRoot,profile.hairStyle,profile.hair);
  }
  const item=hairSystem?.styles?.find(x=>x.id===profile.hairStyle);
  dialog.querySelector('#cas-source').textContent=item?item.label+' · '+item.triangles.toLocaleString('pt-BR')+' triângulos':'Nenhum penteado selecionado';
 }
 function open(){
  const profile=system.casProfile||readCAS(localStorage)||CAS_DEFAULT;
  select.value=hairSystem?.styles?.some(x=>x.id===profile.hairStyle)?profile.hairStyle:'none';
  form.elements.hair.value=profile.hair;
  message.textContent='';rotation=0;lastPreviewKey='';
  window.cityCharacterEditorOpen=true;window.dispatchEvent(new Event('blur'));
  dialog.showModal();updatePreview();
 }
 button.addEventListener('click',open);
 form.addEventListener('input',updatePreview);
 let saving=false;
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(saving)return;saving=true;
  dialog.querySelector('#cas-save').disabled=true;
  message.textContent='Salvando penteado…';
  try{
   const next=currentProfile();
   await system.applyCAS(next);
   try{writeCAS(localStorage,next);}catch{message.textContent='Cabelo aplicado, mas não salvo neste navegador.';}
   dialog.close();
  }catch(error){message.textContent='Erro ao aplicar cabelo: '+String(error.message||error);}
  finally{saving=false;dialog.querySelector('#cas-save').disabled=false;}
 });
 dialog.querySelector('#cas-cancel').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{window.cityCharacterEditorOpen=false;drag=null;});
 canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,angle:rotation};canvas.setPointerCapture(event.pointerId);});
 canvas.addEventListener('pointermove',event=>{if(!drag)return;rotation=drag.angle+(event.clientX-drag.x)*.012;updatePreview();});
 canvas.addEventListener('pointerup',()=>{drag=null;});
 canvas.addEventListener('pointercancel',()=>{drag=null;});
 function animate(){
  if(dialog.open&&renderer)renderer.render(scene,camera);
  requestAnimationFrame(animate);
 }requestAnimationFrame(animate);
 system.openCreator=open;system.casStorageKey=CAS_KEY;
}
