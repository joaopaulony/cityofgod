import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {CAS_DEFAULT,normalizeCAS,readCAS,writeCAS} from './cas-profile.mjs';

// City of God CAS: an in-game, full-screen 3D dressing room.
// Animation and body meshes are actual licensed game GLBs, never flat video.
// The gameplay system remains authoritative for applying a saved appearance.
export function installCASCreator(system,bridge,_bases,hairSystem){
 const dialog=document.createElement('dialog');
 dialog.id='city-cas-dialog';
 dialog.setAttribute('aria-label','City of God — criador de personagem');
 dialog.innerHTML=[
 '<div class="cas-shell">',
 '<header class="cas-header"><div class="cas-heading"><small>CITY OF GOD / VIDA URBANA</small><strong>CRIE SEU <em>PERSONAGEM</em></strong></div><button class="cas-close" type="button" id="cas-close" aria-label="Fechar editor">✕ &nbsp; VOLTAR</button></header>',
 '<nav class="cas-nav" aria-label="Categorias de personalização"><h2>PERSONALIZAÇÃO</h2>',
 '<button type="button" data-cas-tab="identity" aria-pressed="true">◈ &nbsp; Identidade</button>',
 '<button type="button" data-cas-tab="body" aria-pressed="false">◉ &nbsp; Corpo</button>',
 '<button type="button" data-cas-tab="hair" aria-pressed="false">✂ &nbsp; Cabelo</button>',
 '<button type="button" data-cas-tab="clothes" aria-pressed="false">◧ &nbsp; Roupas</button>',
 '<button type="button" data-cas-tab="style" aria-pressed="false">★ &nbsp; Estilo</button>',
 '<p class="cas-small">Personagem em 3D real. Arraste para girar. As animações são reproduzidas no próprio modelo.</p></nav>',
 '<div class="cas-stage"><canvas id="cas-preview" aria-label="Prévia 3D interativa do personagem" tabindex="0"></canvas><span class="cas-loading" id="cas-loading" role="status">Preparando estúdio 3D…</span><div class="cas-stage-caption"><span>↔ ARRASTE PARA GIRAR &nbsp; · &nbsp; RODA PARA ZOOM</span><span id="cas-preview-source">GLB / THREE.JS</span></div></div>',
 '<form id="cas-form" class="cas-controls"><section class="cas-section" data-cas-section="identity"><h2>Identidade</h2><p>Crie alguém para viver sua própria história na cidade.</p>',
 '<label class="cas-field"><span>Nome</span><input type="text" name="name" minlength="1" maxlength="24" autocomplete="off" required></label>',
 '<label class="cas-field"><span>Idade <output data-cas-output="age">24</output></span><input type="range" name="age" min="18" max="80" step="1"></label>',
 '<label class="cas-field"><span>Onde cresceu</span><select name="background"><option value="bairro">Bairro popular</option><option value="centro">Centro urbano</option><option value="litoral">Litoral</option><option value="interior">Interior</option></select></label>',
 '<div class="cas-tip">Nome, idade e origem são gravados no perfil local. Os efeitos da história e das habilidades serão implementados em uma etapa futura.</div></section>',
 '<section class="cas-section" data-cas-section="body" hidden><h2>Corpo e aparência</h2><p>Escolha a base 3D e ajuste as proporções gerais.</p>',
 '<div class="cas-field"><span>Modelo corporal</span><div class="cas-segment"><label><input type="radio" name="sex" value="male"> Masculino</label><label><input type="radio" name="sex" value="female"> Feminino</label></div></div>',
 '<label class="cas-field"><span>Altura <output data-cas-output="height">100%</output></span><input type="range" name="height" min="0.90" max="1.10" step="0.01"></label>',
 '<label class="cas-field"><span>Constituição <output data-cas-output="build">100%</output></span><input type="range" name="build" min="0.86" max="1.14" step="0.01"></label>',
 '<label class="cas-field"><span>Tom de pele</span><input type="color" name="skin"></label>',
 '<div class="cas-tip">Altura e porte alteram a escala da malha. Ajustes de nariz, olhos e mandíbula precisam de novos modelos com blendshapes; ainda não são simulados.</div></section>',
 '<section class="cas-section" data-cas-section="hair" hidden><h2>Cabelos</h2><p>Estilos GLB anexados ao osso da cabeça, quando instalados.</p>',
 '<label class="cas-field"><span>Penteado</span><select name="hairStyle"><option value="none">Sem cabelo adicional</option></select></label>',
 '<label class="cas-field"><span>Cor do cabelo</span><input type="color" name="hair"></label>',
 '<div class="cas-tip" id="cas-hair-note">Verificando catálogo de penteados…</div></section>',
 '<section class="cas-section" data-cas-section="clothes" hidden><h2>Roupas</h2><p>Paleta das peças do personagem.</p>',
 '<label class="cas-field"><span>Cor superior</span><input type="color" name="top"></label>',
 '<label class="cas-field"><span>Cor inferior</span><input type="color" name="bottom"></label>',
 '<div class="cas-tip">A recoloração separada depende de slots de material nas malhas GLB. Modelos com textura única preservam a aparência original para não pintar pele junto com a roupa.</div></section>',
 '<section class="cas-section" data-cas-section="style" hidden><h2>Estilo pessoal</h2><p>Um ponto de partida para a identidade visual.</p>',
 '<label class="cas-field"><span>Estilo</span><select name="style"><option value="casual">Casual</option><option value="esportivo">Esportivo</option><option value="urbano">Urbano</option><option value="social">Social</option></select></label>',
 '<div class="cas-tip">Estilo e origem ficam salvos para futuras roupas, traços, ocupações e progressão. Não concedem vantagens de gameplay nesta versão.</div></section></form>',
 '<footer class="cas-footer"><span class="cas-status" role="status" id="cas-message">O visual será salvo neste navegador.</span><div class="cas-actions"><button type="button" id="cas-cancel">Cancelar</button><button type="submit" form="cas-form" id="cas-save">Salvar personagem</button></div></footer>',
 '</div>'
 ].join('');
 const button=document.createElement('button');
 button.type='button';button.id='city-cas-open';button.textContent='Personalizar personagem';
 document.body.append(dialog,button);
 const form=dialog.querySelector('#cas-form');
 const canvas=dialog.querySelector('#cas-preview');
 const status=dialog.querySelector('#cas-message');
 const loading=dialog.querySelector('#cas-loading');
 const hairSelect=form.elements.hairStyle;
 for(const item of hairSystem?.styles||[]){
  const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.label;hairSelect.append(opt);
 }
 const available=(hairSystem?.styles||[]).length;
 dialog.querySelector('#cas-hair-note').textContent=available
  ? available+' penteados instalados. Alguns precisam de ajuste fino de escala e alinhamento.'
  : 'O pacote GLB ainda não foi instalado. O personagem pode ser criado, mas os penteados adicionais ficam indisponíveis.';
 hairSelect.disabled=!available;
 let draft={...CAS_DEFAULT},renderer,scene,camera,world,previewRoot=null,mixer=null,modelAnimations=[],lastTime=0,active=false,loadingVersion=0,previewSex=null,previewHairKey='',spin=0,zoom=3.55,drag=null,lastWidth=0,lastHeight=0;
 const gltfLoader=new GLTFLoader(),textureLoader=new THREE.TextureLoader();
 const previewCache=new Map();
 const assets={male:'david',female:'megan'};
 let manifestPromise=null;
 const source=dialog.querySelector('#cas-preview-source');
 const el=name=>form.elements[name];
 function visibleTab(name){
  for(const button of dialog.querySelectorAll('[data-cas-tab]'))button.setAttribute('aria-pressed',String(button.dataset.casTab===name));
  for(const sec of dialog.querySelectorAll('[data-cas-section]'))sec.hidden=sec.dataset.casSection!==name;
 }
 function loadForm(profile){
  draft=normalizeCAS(profile);
  for(const key of ['name','age','height','build','skin','hair','top','bottom','hairStyle','background','style']){
   if(el(key))el(key).value=draft[key];
  }
  const sex=form.querySelector('input[name=sex][value='+draft.sex+']');
  if(sex)sex.checked=true;
  for(const key of ['age','height','build'])updateOutput(key);
 }
 function updateOutput(key){
  const out=dialog.querySelector('[data-cas-output='+key+']');if(!out)return;
  out.textContent=key==='age'?String(el(key).value):Math.round(Number(el(key).value)*100)+'%';
 }
 function currentDraft(){
  const data=Object.fromEntries(new FormData(form).entries());
  return normalizeCAS({...draft,...data});
 }
 function garage(){
  scene=new THREE.Scene();scene.background=new THREE.Color('#161b1b');
  scene.fog=new THREE.Fog('#161b1b',9,17);
  const mat=(color,roughness=1,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  function box(w,h,d,x,y,z,material){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
   mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;
  }
  const cement=mat('#343a3a'),wall=mat('#272c2b'),steel=mat('#1a2020',.65,.5);
  box(12,.12,12,0,-.13,0,cement);
  box(12,5,.15,0,2,-3.15,wall);
  box(.15,5,12,-4.5,2,0,wall);
  for(let n=-5;n<=5;n++){box(.018,.007,11,n,-.063,0,steel);box(10,.007,.018,0,-.062,n,steel);}
  for(const x of [-3.8,3.8]){
   box(.09,3,.1,x,1.5,-2.9,steel);
   box(1.25,.05,.7,x,1.8,-2.65,steel);
   for(let y of [.45,1.25,2.05])box(1.22,.035,.6,x,y,-2.53,mat('#6a5140'));
  }
  box(3.2,1.6,.1,0,2.2,-3.04,mat('#2f3a3b'));
  for(let x of [-1.5,1.5])box(.06,1.55,.08,x,2.2,-2.94,steel);
  const light=new THREE.AmbientLight(0xffffff,.72);scene.add(light);
  const key=new THREE.DirectionalLight('#fbe9d1',2.7);key.position.set(-2,5,4);key.castShadow=false;scene.add(key);
  const blue=new THREE.PointLight('#71b2d7',50,6);blue.position.set(3,3,-1);scene.add(blue);
  const gold=new THREE.PointLight('#ffbc77',32,5);gold.position.set(-3,2,2);scene.add(gold);
  const fixture=mat('#d5e9dc',.2,.2);box(2,.03,.15,-2,4,-1.3,fixture);box(2,.03,.15,2,4,-1.3,fixture);
  scene.add(new THREE.GridHelper(11,11,0x51514a,0x484943));
  camera=new THREE.PerspectiveCamera(36,1,.05,30);
  camera.position.set(0,1.15,zoom);camera.lookAt(0,1.02,0);
  world=new THREE.Group();world.name='PreviewFigure';scene.add(world);
 }
 function setupRenderer(){
  if(renderer)return;
  try{
   renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:true,powerPreference:'high-performance'});
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
   renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderer.toneMapping=THREE.ACESFilmicToneMapping;
   renderer.toneMappingExposure=1.12;
   garage();
  }catch(error){
   status.textContent='WebGL não disponível para a prévia: '+String(error.message||error);
   loading.textContent='Prévia 3D indisponível';
  }
 }
 async function getPreviewAsset(sex){
  if(!previewCache.has(sex)){
   const promise=(async()=>{
    if(!manifestPromise)manifestPromise=fetch('assets/characters/mixamo/manifest.json').then(r=>{if(!r.ok)throw Error('Catálogo de personagens indisponível');return r.json();});
    const manifest=await manifestPromise, id=assets[sex],spec=manifest.models.find(x=>x.id===id);
    if(!spec)throw Error('Personagem '+id+' não encontrado');
    const gltf=await gltfLoader.loadAsync('assets/characters/mixamo/'+spec.file);
    const textures=new Map();
    for(const [matName,maps] of Object.entries(spec.materials||{})){
     const targets=[];
     gltf.scene.traverse(node=>{if(node.isMesh)for(const m of Array.isArray(node.material)?node.material:[node.material])if(m.name===matName)targets.push(m);});
     for(const kind of ['map','normalMap','alphaMap']){
      if(!maps[kind])continue;
      const url='assets/characters/mixamo/'+maps[kind];
      if(!textures.has(url))textures.set(url,textureLoader.loadAsync(url).catch(()=>null));
      const texture=await textures.get(url);
      if(!texture)continue;
      texture.flipY=true;
      if(kind==='map')texture.colorSpace=THREE.SRGBColorSpace;
      for(const m of targets){m[kind]=texture;m.needsUpdate=true;}
     }
     for(const m of targets){m.alphaTest=maps.alphaTest||0;m.needsUpdate=true;}
    }
    return {gltf,spec};
   })().catch(e=>{previewCache.delete(sex);throw e;});
   previewCache.set(sex,promise);
  }
  return previewCache.get(sex);
 }
 function setClip(){
  mixer?.stopAllAction();
  const idle=modelAnimations.find(c=>/idle|stand|breath/i.test(c.name))||modelAnimations[0];
  if(idle&&mixer){const action=mixer.clipAction(idle);action.reset().play();action.setLoop(THREE.LoopRepeat,Infinity);}
 }
 async function setPreviewSex(sex){
  if(!renderer||previewSex===sex)return;
  const version=++loadingVersion;
  previewSex=sex;loading.hidden=false;loading.textContent='Carregando modelo '+(sex==='female'?'feminino':'masculino')+'…';
  try{
   const {gltf}=await getPreviewAsset(sex);
   if(version!==loadingVersion)return;
   if(previewRoot){hairSystem?.release(previewRoot);world.remove(previewRoot);}
   const root=cloneSkeleton(gltf.scene);
   root.traverse(node=>{
    if(!node.isMesh)return;
    node.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone();
    node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;
   });
   const bounds=new THREE.Box3().setFromObject(root);
   const height=bounds.max.y-bounds.min.y;
   if(!Number.isFinite(height)||height<.1)throw Error('Modelo 3D sem dimensões válidas');
   const factor=1.72/height;
   root.scale.multiplyScalar(factor);
   root.position.y-=bounds.min.y*factor;
   root.userData.casBaseScale=root.scale.clone();
   world.add(root);previewRoot=root;
   mixer=new THREE.AnimationMixer(root);
   modelAnimations=gltf.animations||[];
   setClip();
   previewHairKey='';
   source.textContent='BASE 3D · '+(sex==='female'?'MEGAN':'DAVID')+' · '+modelAnimations.length+' ANIMAÇÕES';
   loading.hidden=true;
   syncPreview();
  }catch(error){loading.textContent='Falha na prévia: '+String(error.message||error);}
 }
 function recolor(root,profile){
  // Do not tint a single baked texture containing both skin and clothing.
  // Dedicated material slots in future exported GLBs can be recolored safely.
  root.traverse(node=>{
   if(!node.isMesh)return;
   for(const mat of Array.isArray(node.material)?node.material:[node.material]){
    const name=String(mat.name).toLowerCase();
    if(!mat.color)return;
    if(/(^|[_ -])hair([_ -]|$)/.test(name)&&!mat.map)mat.color.set(profile.hair);
    else if(/(?:shirt|top|upperbody)/.test(name)&&!/bodymap|skin/.test(name))mat.color.set(profile.top);
    else if(/(?:pants|trousers|bottom)/.test(name))mat.color.set(profile.bottom);
    else if(/(?:skin|skintone)/.test(name)&&!mat.map)mat.color.set(profile.skin);
   }
  });
 }
 function syncPreview(){
  if(!previewRoot)return;
  // Preserve the imported GLB scale when changing character proportions.
  const initial=previewRoot.userData.casBaseScale||(previewRoot.userData.casBaseScale=previewRoot.scale.clone());
  previewRoot.scale.set(initial.x*draft.build,initial.y*draft.height,initial.z*draft.build);
  recolor(previewRoot,draft);
  const key=draft.hairStyle+'|'+draft.hair;
  if(previewHairKey!==key){previewHairKey=key;void hairSystem?.set(previewRoot,draft.hairStyle,draft.hair);}
 }
 function resize(){
  if(!renderer||!dialog.open)return;
  const {width,height}=canvas.getBoundingClientRect();
  if(width<10||height<10)return;
  const w=Math.round(width),h=Math.round(height);
  if(lastWidth===w&&lastHeight===h)return;
  lastWidth=w;lastHeight=h;
  renderer.setSize(w,h,false);
  camera.aspect=width/height;camera.updateProjectionMatrix();
 }
 function animate(t){
  if(!dialog.open){active=false;return;}
  if(renderer&&scene){
   const delta=Math.min(.05,Math.max(0,(t-lastTime)/1000));lastTime=t;
   mixer?.update(delta);
   world.rotation.y=spin;
   camera.position.set(0,1.16,zoom);
   camera.lookAt(0,1.02,0);
   resize();renderer.render(scene,camera);
  }
  requestAnimationFrame(animate);
 }
 function open(){
  if(dialog.open)return;
  loadForm(system.casProfile||readCAS(localStorage)||CAS_DEFAULT);
  visibleTab('identity');previewSex=null;previewHairKey='';spin=0;zoom=3.55;
  status.textContent='Prévia local — salve para aplicar no mundo.';
  window.cityCharacterEditorOpen=true;
  window.dispatchEvent(new Event('blur'));
  dialog.showModal();
  setupRenderer();resize();
  void setPreviewSex(draft.sex);
  if(!active){active=true;lastTime=performance.now();requestAnimationFrame(animate);}
 }
 function close(){if(dialog.open)dialog.close();}
 button.addEventListener('click',open);
 dialog.querySelector('#cas-close').addEventListener('click',close);
 dialog.querySelector('#cas-cancel').addEventListener('click',close);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('close',()=>{
  window.cityCharacterEditorOpen=false;drag=null;loadingVersion++;
  bridge?.input?.keys?.clear?.();
 });
 dialog.querySelector('.cas-nav').addEventListener('click',event=>{
  const tab=event.target.closest('[data-cas-tab]');if(tab)visibleTab(tab.dataset.casTab);
 });
 form.addEventListener('input',()=>{
  const next=currentDraft(),sexChanged=next.sex!==draft.sex;
  draft=next;for(const key of ['age','height','build'])updateOutput(key);
  if(sexChanged)void setPreviewSex(draft.sex);else syncPreview();
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();const save=dialog.querySelector('#cas-save');
  if(save.disabled)return;
  save.disabled=true;status.textContent='Aplicando modelo e salvando perfil…';
  try{
   const selected=currentDraft();
   await system.applyCAS(selected);
   try{writeCAS(localStorage,selected);}catch{status.textContent='Visual aplicado, mas não foi possível gravar no navegador.';return;}
   close();
  }catch(error){status.textContent='Falha ao aplicar: '+String(error.message||error);}
  finally{save.disabled=false;}
 });
 canvas.addEventListener('pointerdown',event=>{
  drag={x:event.clientX,angle:spin};canvas.setPointerCapture(event.pointerId);
 });
 canvas.addEventListener('pointermove',event=>{if(drag)spin=drag.angle+(event.clientX-drag.x)*.012;});
 canvas.addEventListener('pointerup',()=>{drag=null;});
 canvas.addEventListener('pointercancel',()=>{drag=null;});
 canvas.addEventListener('wheel',event=>{event.preventDefault();zoom=Math.max(2.1,Math.min(5,zoom+Math.sign(event.deltaY)*.22));},{passive:false});
 window.addEventListener('resize',resize);
 system.openCreator=open;
 system.casStorageKey='cityofgod.cas.v1';
}
