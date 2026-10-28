import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {CAS_DEFAULT,CAS_COLORS,normalizeCAS} from './cas-profile.mjs';
import {MAX_CHARACTERS,readRoster,activeCharacter,addCharacter,updateCharacter,selectCharacter,deleteCharacter,persistRoster} from './cas-roster.mjs';
import {createRebornUpperBodyMotion} from './cas-reborn-upperbody.mjs';
import {applyCASVisual,releaseCASVisual,createCASEmoteClips,CAS_EMOTES,outfitPalette} from './cas-studio.mjs';

// City of God CAS: an in-game, full-screen 3D dressing room.
// Animation and body meshes are actual licensed game GLBs, never flat video.
// The gameplay system remains authoritative for applying a saved appearance.
export function installCASCreator(system,bridge,_bases,hairSystem){
 const dialog=document.createElement('dialog');
 dialog.id='city-cas-dialog';
 dialog.setAttribute('aria-label','City of God — criador de personagem');
 dialog.innerHTML=[
 '<div class="cas-shell">',
 '<header class="cas-header"><div class="cas-heading"><small>CITY OF GOD · URBAN LIFE STUDIO</small><strong>CRIAR <em>PERSONAGEM</em></strong></div><div class="cas-header-side"><span class="cas-session">PERSONAGEM 3D · EDITOR LOCAL</span><button class="cas-close" type="button" id="cas-close" aria-label="Voltar ao jogo">✕ &nbsp; VOLTAR</button></div></header>',
 '<nav class="cas-nav" aria-label="Categorias de personalização"><h2>PERSONALIZAÇÃO</h2>',
 '<button type="button" data-cas-tab="identity" aria-pressed="true">◈ &nbsp; Identidade</button>',
 '<button type="button" data-cas-tab="body" aria-pressed="false">◉ &nbsp; Corpo</button>',
 '<button type="button" data-cas-tab="hair" aria-pressed="false">✂ &nbsp; Cabelo</button>',
 '<button type="button" data-cas-tab="face" aria-pressed="false">◍ &nbsp; Rosto</button>',
 '<button type="button" data-cas-tab="clothes" aria-pressed="false">◧ &nbsp; Roupas</button>',
 '<button type="button" data-cas-tab="style" aria-pressed="false">★ &nbsp; Estilo</button>',
 '<button type="button" data-cas-tab="animations" aria-pressed="false">▶ &nbsp; Animações</button>',
 '<button type="button" data-cas-tab="artlist" aria-pressed="false">◇ &nbsp; Modelos Artlist</button>',
 '<p class="cas-small">CRIE SUA IDENTIDADE<br>Escolha um corpo, personalize, salve e comece sua história.</p><div class="cas-nav-credit">CITY OF GOD REBORN · V1</div></nav>',
 '<div class="cas-stage"><canvas id="cas-preview" aria-label="Prévia 3D interativa do personagem" tabindex="0"></canvas><div class="cas-stage-head"><span class="cas-stage-label">PRÉVIA EM TEMPO REAL</span><span class="cas-stage-live">● 3D</span></div><span class="cas-loading" id="cas-loading" role="status">Preparando estúdio 3D…</span><div class="cas-stage-tools"><button type="button" id="cas-view-front" aria-label="Ver de frente">FRENTE</button><button type="button" id="cas-view-side" aria-label="Ver de lado">PERFIL</button><button type="button" id="cas-view-back" aria-label="Ver de costas">COSTAS</button><button type="button" id="cas-view-reset" aria-label="Centralizar câmera">⟲</button></div><div class="cas-stage-caption"><span>↔ ARRASTE PARA GIRAR &nbsp; · &nbsp; RODA PARA ZOOM</span><span id="cas-preview-source">GLB / THREE.JS</span></div></div>',
 '<form id="cas-form" class="cas-controls"><section class="cas-section" data-cas-section="identity"><h2>Identidade</h2><p>Crie alguém para viver sua própria história na cidade.</p>',
 '<label class="cas-field"><span>Meu personagem</span><select name="rosterSlot" id="cas-roster-slot" aria-label="Personagem salvo"></select></label><div class="cas-roster-actions"><button type="button" id="cas-new-character">+ Novo personagem</button><button type="button" id="cas-delete-character">Excluir personagem</button></div>',
 '<label class="cas-field"><span>Nome</span><input type="text" name="name" minlength="1" maxlength="24" autocomplete="off" required></label>',
 '<label class="cas-field"><span>Idade <output data-cas-output="age">24</output></span><input type="range" name="age" min="18" max="80" step="1"></label>',
 '<label class="cas-field"><span>Onde cresceu</span><select name="background"><option value="bairro">Bairro popular</option><option value="centro">Centro urbano</option><option value="litoral">Litoral</option><option value="interior">Interior</option></select></label>',
 '<div class="cas-tip">Nome, idade e origem são gravados no perfil local. Os efeitos da história e das habilidades serão implementados em uma etapa futura.</div></section>',
 '<section class="cas-section" data-cas-section="body" hidden><h2>Corpo e aparência</h2><p>Escolha a base 3D e ajuste as proporções gerais.</p>',
 '<div class="cas-field"><span>Modelo corporal</span><div class="cas-segment"><label><input type="radio" name="sex" value="male"> Masculino</label><label><input type="radio" name="sex" value="female"> Feminino</label></div></div>',
 '<label class="cas-field"><span>Altura <output data-cas-output="height">100%</output></span><input type="range" name="height" min="0.90" max="1.10" step="0.01"></label>',
 '<label class="cas-field"><span>Constituição <output data-cas-output="build">100%</output></span><input type="range" name="build" min="0.86" max="1.14" step="0.01"></label>',
 '<label class="cas-field"><span>Tom de pele</span><input type="color" name="skin"></label><div class="cas-colors" id="cas-skin-swatches"></div>',
 '<div class="cas-tip">Altura e porte alteram a escala geral. Os ajustes geométricos de nariz, olhos e mandíbula estão na seção Rosto, usando blendshapes procedurais.</div></section>',
 '<section class="cas-section" data-cas-section="face" hidden><h2>Escultura do rosto</h2><p>Morph targets reais, gerados sobre o rosto existente, sem modificar a malha compartilhada dos NPCs.</p>',
 ...[['faceWidth','Largura do rosto'],['jaw','Mandíbula'],['nose','Nariz'],['eyes','Olhos'],['cheeks','Maçãs do rosto']].map(([id,label])=>'<label class="cas-field"><span>'+label+' <output data-cas-output="'+id+'">0%</output></span><input name="'+id+'" type="range" min="-1" max="1" step="0.05" value="0"></label>'),
 '<div class="cas-tip">São deformações paramétricas discretas da malha 3D, não reconstrução anatômica por IA. Prefira mudanças suaves para preservar expressão e textura.</div></section>',
 '<section class="cas-section" data-cas-section="hair" hidden><h2>Cabelos</h2><p>Estilos GLB anexados ao osso da cabeça, quando instalados.</p>',
 '<label class="cas-field"><span>Penteado</span><select name="hairStyle"><option value="none">Sem cabelo adicional</option></select></label>',
 '<label class="cas-field"><span>Cor do cabelo</span><input type="color" name="hair"></label><div class="cas-colors" id="cas-hair-swatches"></div>',
 '<div class="cas-tip" id="cas-hair-note">Verificando catálogo de penteados…</div></section>',
 '<section class="cas-section" data-cas-section="clothes" hidden><h2>Roupas</h2><p>Paleta das peças do personagem.</p>',
 '<label class="cas-field"><span>Cor superior</span><input type="color" name="top"></label><div class="cas-colors" id="cas-top-swatches"></div>',
 '<label class="cas-field"><span>Cor inferior</span><input type="color" name="bottom"></label>',
 '<label class="cas-field"><span>Tênis / calçados</span><input type="color" name="shoes"></label>',
 '<label class="cas-field"><span>Look inicial</span><select name="outfit"><option value="casual">Casual</option><option value="street">Streetwear</option><option value="sport">Esportivo</option><option value="social">Social</option></select></label>',
 '<label class="cas-field"><span>Acessório 3D</span><select name="accessory"><option value="none">Nenhum</option><option value="glasses">Óculos</option><option value="cap">Boné</option><option value="beanie">Gorro</option></select></label>',
 '<label class="cas-field"><span>Cor do acessório</span><input type="color" name="accessoryColor"></label>',
 '<div class="cas-tip">As peças com malhas separadas são coloridas via materiais PBR. O corpo e a pele permanecem intactos; cortes de roupa realmente diferentes exigem novos GLBs modulares.</div></section>',
 '<section class="cas-section" data-cas-section="style" hidden><h2>Estilo pessoal</h2><p>Um ponto de partida para a identidade visual.</p>',
 '<label class="cas-field"><span>Estilo</span><select name="style"><option value="casual">Casual</option><option value="esportivo">Esportivo</option><option value="urbano">Urbano</option><option value="social">Social</option></select></label>',
 '<div class="cas-tip">Estilo e origem ficam salvos para futuras roupas, traços, ocupações e progressão. Não concedem vantagens de gameplay nesta versão.</div></section>',
 '<section class="cas-section" data-cas-section="animations" hidden><h2>Estúdio de animação</h2><p>Reproduza os 22 clipes existentes e seis gestos esqueléticos novos usando o mesmo personagem 3D.</p>',
 '<label class="cas-field"><span>Ação</span><select name="previewAction"><option value="idle">Parado</option><option value="walk">Caminhar</option><option value="run">Correr</option><option value="crouch">Agachar</option><option value="jump_air">Pular</option>',
 ...Object.entries(CAS_EMOTES).map(([id,entry])=>'<option value="cas_'+id+'">'+entry.label+'</option>'),
 '</select></label><div class="cas-tip">Estas animações são transformações de ossos em Three.js, não vídeos. Gestos ficam disponíveis no jogo pelo atalho F6.</div></section>',
 '<section class="cas-section" data-cas-section="artlist" hidden><h2>Novos personagens Artlist</h2><p>Modelos originais gerados e otimizados para avaliação visual antes do rigging e retarget das animações.</p>',
 '<label class="cas-field"><span>Modelo em exposição</span><select name="artlistModel"><option value="marcus">Marcos · masculino</option><option value="livia">Lívia · feminino</option></select></label>',
 '<button type="button" id="cas-view-artlist" class="cas-preview-model">Visualizar modelo 3D</button><button type="button" id="cas-back-rig" class="cas-preview-model">Voltar ao personagem animado</button>',
 '<div class="cas-tip">Aviso: os arquivos do Artlist são malhas estáticas, sem esqueleto. Esta aba NÃO substitui o avatar no jogo. A versão jogável continua usando o rig Mixamo até a aprovação técnica do novo rig.</div></section></form>',
 '<footer class="cas-footer"><span class="cas-status" role="status" id="cas-message">Seu personagem será salvo neste navegador.</span><div class="cas-actions"><button type="button" id="cas-prev-step">‹ Voltar</button><button type="button" id="cas-next-step">Próximo ›</button><button type="submit" form="cas-form" id="cas-save">SALVAR E JOGAR</button></div></footer>',
 '</div>'
 ].join('');
 const button=document.createElement('button');
 button.type='button';button.id='city-cas-open';button.textContent='◈ MEU PERSONAGEM';
 document.body.append(dialog,button);
 const form=dialog.querySelector('#cas-form');
 const canvas=dialog.querySelector('#cas-preview');
 const status=dialog.querySelector('#cas-message');
 const loading=dialog.querySelector('#cas-loading');
 const hairSelect=form.elements.hairStyle;
 const steps=['identity','body','face','hair','clothes','style','animations'];
 const rosterSelect=form.elements.rosterSlot;
 const buttons={prev:dialog.querySelector('#cas-prev-step'),next:dialog.querySelector('#cas-next-step'),save:dialog.querySelector('#cas-save')};
 let currentTab='identity',roster=null;
 // Only developers see the unrigged Artlist experiments, never players.
 if(!new URLSearchParams(location.search).has('caslab')){
  dialog.querySelector('[data-cas-tab="artlist"]')?.remove();
  dialog.querySelector('[data-cas-section="artlist"]')?.remove();
 }
 for(const type of ['skin','hair','top']){
  const palette=dialog.querySelector('#cas-'+type+'-swatches');
  for(const color of CAS_COLORS[type]||[]){
   const sw=document.createElement('button');sw.type='button';sw.dataset.casColor=color;sw.dataset.casColorField=type;
   sw.style.backgroundColor=color;sw.title=color;sw.setAttribute('aria-label','Escolher '+type+' '+color);
   palette.append(sw);
  }
 }
 for(const item of hairSystem?.styles||[]){
  const opt=document.createElement('option');opt.value=item.id;opt.textContent=item.label;hairSelect.append(opt);
 }
 const available=(hairSystem?.styles||[]).length;
 dialog.querySelector('#cas-hair-note').textContent=available
  ? available+' penteados instalados. Alguns precisam de ajuste fino de escala e alinhamento.'
  : 'O pacote GLB ainda não foi instalado. O personagem pode ser criado, mas os penteados adicionais ficam indisponíveis.';
 hairSelect.disabled=!available;
 let draft={...CAS_DEFAULT},renderer,scene,camera,world,previewRoot=null,mixer=null,rebornUpper=null,activeMotion=null,modelAnimations=[],lastTime=0,active=false,loadingVersion=0,previewSex=null,previewHairKey='',spin=0,zoom=3.55,drag=null,lastWidth=0,lastHeight=0;
 const gltfLoader=new GLTFLoader(),textureLoader=new THREE.TextureLoader();
 const previewCache=new Map();
 const assets={male:'david',female:'megan'};
 let manifestPromise=null;
 const source=dialog.querySelector('#cas-preview-source');
 const el=name=>form.elements[name];
 const safeStorage=()=>{try{return localStorage;}catch{return {getItem:()=>null,setItem(){throw Error('Armazenamento do navegador indisponível');}};}};
 let previewAnimation='idle',artlistMode=false;
 const artlistPaths={marcus:'assets/characters/artlist/marcus.glb.gz',livia:'assets/characters/artlist/livia.glb.gz'};
 const artlistCache=new Map();
 function visibleTab(name){
  if(!steps.includes(name)&&name!=='artlist')return;
  currentTab=name;
  buttons.prev.hidden=name==='identity';
  buttons.next.hidden=!steps.includes(name)||name==='animations';
  buttons.save.hidden=name==='artlist';
  if(name!=='artlist'&&artlistMode){artlistMode=false;previewSex=null;void setPreviewSex(draft.sex);}
  for(const button of dialog.querySelectorAll('[data-cas-tab]'))button.setAttribute('aria-pressed',String(button.dataset.casTab===name));
  for(const sec of dialog.querySelectorAll('[data-cas-section]'))sec.hidden=sec.dataset.casSection!==name;
  for(const tab of dialog.querySelectorAll('[data-cas-tab]')){
    if(tab.dataset.casTab===name)tab.scrollIntoView({block:'nearest',inline:'nearest'});
  }
 }
 function refreshRoster(){
  rosterSelect.replaceChildren();
  for(const c of roster?.characters||[]){
   const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.profile.name+' · '+(c.profile.sex==='female'?'Feminino':'Masculino');
   rosterSelect.append(opt);
  }
  rosterSelect.value=roster?.activeId||'';
  dialog.querySelector('#cas-new-character').disabled=(roster?.characters?.length||0)>=MAX_CHARACTERS;
  dialog.querySelector('#cas-delete-character').disabled=(roster?.characters?.length||0)<=1;
 }
 function loadActive(){
  const current=activeCharacter(roster)||CAS_DEFAULT;
  loadForm(current);
  refreshRoster();
  previewSex=null;
  void setPreviewSex(draft.sex);
 }
 function loadForm(profile){
  draft=normalizeCAS(profile);
  for(const key of ['name','age','height','build','skin','hair','top','bottom','shoes','hairStyle','background','style','outfit','accessory','accessoryColor','faceWidth','jaw','nose','eyes','cheeks']){
   if(el(key))el(key).value=draft[key];
  }
  const sex=form.querySelector('input[name=sex][value='+draft.sex+']');
  if(sex)sex.checked=true;
  for(const key of ['age','height','build',...['faceWidth','jaw','nose','eyes','cheeks']])updateOutput(key);
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
  // Original urban workshop signage. Painted/illuminated by Three.js,
  // not a screenshot or a flat pre-rendered character backdrop.
  const signCanvas=document.createElement('canvas');
  signCanvas.width=1024;signCanvas.height=280;
  const pen=signCanvas.getContext('2d');
  pen.fillStyle='#0c1215';pen.fillRect(0,0,1024,280);
  pen.strokeStyle='#c7975d';pen.lineWidth=8;pen.strokeRect(10,10,1004,260);
  pen.textAlign='center';
  pen.shadowColor='#e5a457';pen.shadowBlur=25;
  pen.fillStyle='#e6aa62';pen.font='900 130px Impact,Arial Black,sans-serif';
  pen.fillText('CITY OF GOD',512,155);
  pen.shadowBlur=0;
  pen.font='bold 37px Arial,sans-serif';pen.letterSpacing='8px';
  pen.fillStyle='#cfdfda';pen.fillText('OFICINA URBANA · ESTÚDIO',512,222);
  const neon=new THREE.CanvasTexture(signCanvas);
  neon.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.7,1.01),
   new THREE.MeshBasicMaterial({map:neon,transparent:false}));
  sign.position.set(0,2.25,-2.94);scene.add(sign);
  const tireMaterial=mat('#171a1b',.98),rimMaterial=mat('#565e5d',.48,.65);
  for(const [x,y,z] of [[1.24,.29,-1.82],[1.47,.27,-1.95]]){
   const tire=new THREE.Mesh(new THREE.TorusGeometry(.26,.105,12,24),tireMaterial);
   tire.position.set(x,y,z);tire.rotation.y=.17;tire.castShadow=true;scene.add(tire);
   const hub=new THREE.Mesh(new THREE.TorusGeometry(.135,.025,10,20),rimMaterial);
   hub.position.set(x,y,z+.074);scene.add(hub);
  }
  // A low-cost pool of light shapes the figure without expensive shadowmaps.
  const warmFill=new THREE.PointLight('#ffc17b',16,4);
  warmFill.position.set(-.9,2.4,.75);scene.add(warmFill);
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
    const rebornEntry=system.rebornReady?_bases?.get(sex):null;
    if(rebornEntry?.spec?.rig==='meshy-24')return rebornEntry;
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
  const clips=['idle','walk','run','crouch','jump_air'];
  const selected=clips.includes(previewAnimation)?previewAnimation:'cas_'+(previewAnimation.startsWith('cas_')?previewAnimation.slice(4):previewAnimation);
  const motion=modelAnimations.find(c=>c.name===selected)||modelAnimations.find(c=>/idle|stand|breath/i.test(c.name))||modelAnimations[0];
  if(motion&&mixer){const action=mixer.clipAction(motion);action.reset().play();action.setLoop(THREE.LoopRepeat,Infinity);activeMotion=action;}
 }
 async function setPreviewSex(sex){
  if(!renderer||previewSex===sex&&!artlistMode)return;
  artlistMode=false;
  const version=++loadingVersion;
  previewSex=sex;loading.hidden=false;loading.textContent='Carregando modelo '+(sex==='female'?'feminino':'masculino')+'…';
  try{
   const {gltf}=await getPreviewAsset(sex);
   if(version!==loadingVersion)return;
   if(previewRoot){hairSystem?.release(previewRoot);releaseCASVisual(previewRoot);world.remove(previewRoot);}
   const root=cloneSkeleton(gltf.scene);
   root.traverse(node=>{
    if(!node.isMesh)return;
    node.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone();
    node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;
   });
   // A freshly cloned skinned rig can have stale bone matrices in its first frame.
   // Measure the loaded GLTF source (with initialized bind pose), not its clone.
   const bounds=new THREE.Box3().setFromObject(gltf.scene);
   const height=bounds.max.y-bounds.min.y;
   if(!Number.isFinite(height)||height<.1)throw Error('Modelo 3D sem dimensões válidas');
   const factor=1.72/height;
   root.scale.multiplyScalar(factor);
   root.position.y-=bounds.min.y*factor;
   root.userData.casBaseScale=root.scale.clone();
   world.add(root);previewRoot=root;
   mixer=new THREE.AnimationMixer(root);
   rebornUpper=system.rebornReady?createRebornUpperBodyMotion(root):null;
   modelAnimations=[...(gltf.animations||[]),...createCASEmoteClips(root)];
   setClip();
   previewHairKey='';
   source.textContent=system.rebornReady?'CAS REBORN · '+(sex==='female'?'FEMININO':'MASCULINO')+' · '+modelAnimations.length+' MOVIMENTOS':'BASE 3D · '+(sex==='female'?'MEGAN':'DAVID')+' · '+modelAnimations.length+' ANIMAÇÕES';
   loading.hidden=true;
   syncPreview();
  }catch(error){loading.textContent='Falha na prévia: '+String(error.message||error);}
 }
 async function showArtlistModel(){
  if(!renderer)return;
  const name=el('artlistModel').value;
  if(!Object.hasOwn(artlistPaths,name))return;
  const version=++loadingVersion;
  loading.hidden=false;loading.textContent='Descompactando modelo 3D do Artlist…';
  try{
   if(!artlistCache.has(name))artlistCache.set(name,(async()=>{
    if(!('DecompressionStream' in window))throw Error('Navegador sem suporte à descompactação gzip');
    const response=await fetch(artlistPaths[name]);
    if(!response.ok)throw Error('Modelo indisponível: HTTP '+response.status);
    const stream=response.body.pipeThrough(new DecompressionStream('gzip'));
    const buffer=await new Response(stream).arrayBuffer();
    return gltfLoader.parseAsync(buffer,'assets/characters/artlist/');
   })().catch(error=>{artlistCache.delete(name);throw error;}));
   const gltf=await artlistCache.get(name);
   if(version!==loadingVersion||!dialog.open)return;
   if(previewRoot){hairSystem?.release(previewRoot);releaseCASVisual(previewRoot);world.remove(previewRoot);}
   mixer?.stopAllAction();mixer=null;rebornUpper=null;activeMotion=null;
   const root=gltf.scene.clone(true);
   const bounds=new THREE.Box3().setFromObject(root),h=bounds.max.y-bounds.min.y;
   if(!Number.isFinite(h)||h<.1)throw Error('Dimensões inválidas');
   const scale=1.72/h;
   root.scale.setScalar(scale);
   root.position.set(0,-bounds.min.y*scale,0);
   root.rotation.y=-Math.PI/2;
   world.add(root);previewRoot=root;previewSex=null;artlistMode=true;previewHairKey='';
   source.textContent='ARTLIST · TRIPO · MALHA SEM RIG';
   loading.hidden=true;
  }catch(error){loading.textContent='Não foi possível carregar o modelo: '+String(error.message||error);}
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
  if(artlistMode)return;
  // Preserve the imported GLB scale when changing character proportions.
  const initial=previewRoot.userData.casBaseScale||(previewRoot.userData.casBaseScale=previewRoot.scale.clone());
  previewRoot.scale.set(initial.x*draft.build,initial.y*draft.height,initial.z*draft.build);
  recolor(previewRoot,draft);
  applyCASVisual(previewRoot,draft);
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
   rebornUpper?.restore();
   mixer?.update(delta);
   if(rebornUpper&&activeMotion)rebornUpper.update(delta,{
    clip:activeMotion.getClip().name,time:activeMotion.time,duration:activeMotion.getClip().duration
   });
   world.rotation.y=spin;
   const facial=dialog.querySelector('[data-cas-tab=face][aria-pressed=true]')!=null;
   camera.position.set(0,facial?1.55:1.16,facial?Math.min(zoom,2.05):zoom);
   camera.lookAt(0,facial?1.51:1.02,0);
   resize();renderer.render(scene,camera);
  }
  requestAnimationFrame(animate);
 }
 function open(){
  if(dialog.open)return;
  roster=readRoster(safeStorage());
  loadForm(activeCharacter(roster)||system.casProfile||CAS_DEFAULT);
  refreshRoster();
  artlistMode=false;visibleTab('identity');previewSex=null;previewHairKey='';spin=0;zoom=3.55;previewAnimation='idle';el('previewAction').value='idle';
  status.textContent=system.rebornReady?'PRÉVIA REBORN (BETA) · Roupa e rosto avançados em desenvolvimento; o personagem usa esqueleto novo.':'Selecione suas características e salve para jogar. Os perfis são locais ao navegador.';
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
 buttons.prev.addEventListener('click',()=>{
  const at=steps.indexOf(currentTab);visibleTab(steps[Math.max(0,at-1)]);
 });
 buttons.next.addEventListener('click',()=>{
  const at=steps.indexOf(currentTab);visibleTab(steps[Math.min(steps.length-1,at+1)]);
 });
 for(const [id,rotation] of [['cas-view-front',0],['cas-view-side',Math.PI/2],['cas-view-back',Math.PI],['cas-view-reset',0]]){
  dialog.querySelector('#'+id).addEventListener('click',()=>{spin=rotation;if(id==='cas-view-reset')zoom=3.55;});
 }
 dialog.querySelector('#cas-new-character').addEventListener('click',()=>{
  try{
   roster=addCharacter(roster,{...CAS_DEFAULT,name:'Novo personagem',sex:draft.sex});
   loadActive();
   status.textContent='Novo personagem preparado. Salve para confirmar.';
  }catch(e){status.textContent=String(e.message||e);}
 });
 dialog.querySelector('#cas-delete-character').addEventListener('click',()=>{
  if((roster?.characters.length||0)<=1)return;
  const current=roster.characters.find(x=>x.id===roster.activeId);
  if(!confirm('Excluir '+(current?.profile.name||'personagem')+' deste navegador? A exclusão será aplicada quando você salvar.'))return;
  roster=deleteCharacter(roster,roster.activeId);loadActive();
  status.textContent='Personagem excluído do rascunho. Salve para confirmar.';
 });
 rosterSelect.addEventListener('change',()=>{try{roster=selectCharacter(roster,rosterSelect.value);loadActive();status.textContent='Personagem selecionado. Salve para ativá-lo no jogo.';}catch(e){status.textContent=String(e.message||e);}});
 dialog.addEventListener('click',e=>{
  const sw=e.target.closest('button[data-cas-color]');
  if(!sw)return;
  const color=sw.dataset.casColor,field=sw.dataset.casColorField;
  if(!el(field))return;
  el(field).value=color;el(field).dispatchEvent(new Event('input',{bubbles:true}));
 });
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('close',()=>{
  window.cityCharacterEditorOpen=false;drag=null;loadingVersion++;
  bridge?.input?.keys?.clear?.();
 });
 dialog.querySelector('.cas-nav').addEventListener('click',event=>{
  const tab=event.target.closest('[data-cas-tab]');if(tab)visibleTab(tab.dataset.casTab);
 });
 dialog.querySelector('#cas-view-artlist')?.addEventListener('click',()=>{void showArtlistModel();});
 dialog.querySelector('#cas-back-rig')?.addEventListener('click',()=>{artlistMode=false;previewSex=null;void setPreviewSex(draft.sex);});
 form.addEventListener('input',event=>{
  if(event.target?.name==='artlistModel'){if(artlistMode)void showArtlistModel();return;}
  if(event.target?.name==='previewAction'){previewAnimation=event.target.value;setClip();return;}
  const next=currentDraft(),sexChanged=next.sex!==draft.sex;
  if(el('outfit')&&event?.target?.name==='outfit'){Object.assign(next,outfitPalette(next.outfit));for(const x of ['top','bottom','shoes'])el(x).value=next[x];}
  draft=next;for(const key of ['age','height','build','faceWidth','jaw','nose','eyes','cheeks'])updateOutput(key);
  if(sexChanged){artlistMode=false;void setPreviewSex(draft.sex);}else syncPreview();
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();const save=dialog.querySelector('#cas-save');
  if(save.disabled)return;
  save.disabled=true;status.textContent='Aplicando modelo e salvando perfil…';
  try{
   const selected=currentDraft();
   await system.applyCAS(selected);
   try{roster=updateCharacter(roster,selected);persistRoster(safeStorage(),roster);}catch{status.textContent='Visual aplicado, mas não foi possível gravar. Verifique permissões do navegador.';return;}
   status.textContent='Personagem salvo!';
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
 system.casRosterKey='cityofgod.cas.roster.v1';
}
