import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {CAS_DEFAULT,CAS_COLORS,normalizeCAS} from './cas-profile.mjs';
import {MAX_CHARACTERS,readRoster,activeCharacter,addCharacter,updateCharacter,selectCharacter,deleteCharacter,persistRoster} from './cas-roster.mjs';
import {CAS_EMOTES,EMOTE_GROUPS} from './cas-studio.mjs';
import {PART_LABEL,HEAD_HINT,SLOT_LABEL,normalizeLook,lookKey,primaryCloth} from './modular-characters.mjs';

// City of God CAS: provador 3D em tela cheia. O personagem é montado com as peças modulares da Quaternius (cabeça com
// cabelo, tronco, pernas, calçados e acessório) e as cores de pele, cabelo e roupas; a prévia toca qualquer uma das
// ~120 animações do jogo. O sistema de personagens (character-webgl.mjs) aplica o perfil salvo.
const ANIM_GROUPS=[
 ['Locomoção',/^(idle|idle_ual|q_idle_neutral|walk|walk_ual|walk_formal|walk_carry|run|jog|sprint|q_run_(back|left|right)|crouch|crouch_walk|jump_|ninja_jump|slide|swim|climb_up|vault_low|roll|q_roll|driving)/],
 ['Armas',/^(rifle_|pistol_|q_gun|q_idle_gun|q_run_shoot)/],
 ['Luta',/^(punch|melee|q_punch|q_kick|hit_|q_hitreceive|death|q_death|sword|shield|idle_shield)/],
];
const ANIM_LABEL={idle:'Parado',walk:'Andar',run:'Correr',sprint:'Disparada',jog:'Trote',crouch:'Agachado',crouch_walk:'Andar agachado',jump_air:'Pulo (no ar)',jump_start:'Pulo (impulso)',jump_land:'Pulo (aterrissar)',
 walk_formal:'Andar formal',walk_carry:'Andar carregando',idle_ual:'Parado (alternativo)',walk_ual:'Andar (alternativo)',q_idle_neutral:'Parado neutro',q_run_back:'Correr de costas',q_run_left:'Correr p/ esquerda',q_run_right:'Correr p/ direita',
 vault_low:'Transpor muro',climb_up_1m:'Escalar 1 m',roll:'Rolamento',q_roll:'Rolamento 2',swim_fwd:'Nadar',swim_idle:'Boiar',driving:'Dirigir',slide:'Deslizar',rifle_idle:'Fuzil: parado',rifle_aim:'Fuzil: mirar',rifle_walk:'Fuzil: andar',rifle_run:'Fuzil: correr',rifle_fire:'Fuzil: atirar',rifle_reload:'Fuzil: recarregar',
 pistol_idle:'Pistola: parado',pistol_shoot:'Pistola: atirar',pistol_reload:'Pistola: recarregar',death01:'Morte',q_death:'Morte 2',hit_chest:'Golpe no peito',hit_head:'Golpe na cabeça',hit_knockback:'Arremessado'};

export function installCASCreator(system,bridge){
 const dialog=document.createElement('dialog');
 dialog.id='city-cas-dialog';
 dialog.setAttribute('aria-label','City of God — criador de personagem');
 const field=(name,label,extra='')=>'<label class="cas-field"><span>'+label+'</span><select name="'+name+'" '+extra+'></select></label>';
 const color=(name,label,original=true)=>'<label class="cas-field"><span>'+label+(original?' <small><label style="display:inline"><input type="checkbox" name="'+name+'Original"> cor original</label></small>':'')+'</span><input type="color" name="'+name+'"></label><div class="cas-colors" data-swatches="'+name+'"></div>';
 dialog.innerHTML=[
 '<div class="cas-shell">',
 '<header class="cas-header"><div class="cas-heading"><small>CITY OF GOD · URBAN LIFE STUDIO</small><strong>CRIAR <em>PERSONAGEM</em></strong></div><div class="cas-header-side"><span class="cas-session">PERSONAGEM MODULAR 3D</span><button class="cas-close" type="button" id="cas-close" aria-label="Voltar ao jogo">✕ &nbsp; VOLTAR</button></div></header>',
 '<nav class="cas-nav" aria-label="Categorias de personalização"><h2>PERSONALIZAÇÃO</h2>',
 '<button type="button" data-cas-tab="identity" aria-pressed="true">◈ &nbsp; Identidade</button>',
 '<button type="button" data-cas-tab="body" aria-pressed="false">◉ &nbsp; Corpo</button>',
 '<button type="button" data-cas-tab="hair" aria-pressed="false">✂ &nbsp; Cabeça e cabelo</button>',
 '<button type="button" data-cas-tab="clothes" aria-pressed="false">◧ &nbsp; Roupas</button>',
 '<button type="button" data-cas-tab="style" aria-pressed="false">★ &nbsp; Estilo</button>',
 '<button type="button" data-cas-tab="animations" aria-pressed="false">▶ &nbsp; Animações</button>',
 '<p class="cas-small">CRIE SUA IDENTIDADE<br>Combine cabeça, roupas e cores, salve e comece sua história.</p><div class="cas-nav-credit">PERSONAGENS E ANIMAÇÕES: QUATERNIUS (CC0)</div></nav>',
 '<div class="cas-stage"><canvas id="cas-preview" aria-label="Prévia 3D do personagem" tabindex="0"></canvas><div class="cas-stage-head"><span class="cas-stage-label">PRÉVIA EM TEMPO REAL</span><span class="cas-stage-live">● 3D</span></div><span class="cas-loading" id="cas-loading" role="status">Preparando estúdio 3D…</span><div class="cas-stage-tools"><button type="button" id="cas-view-front" aria-label="Ver de frente">FRENTE</button><button type="button" id="cas-view-side" aria-label="Ver de lado">PERFIL</button><button type="button" id="cas-view-back" aria-label="Ver de costas">COSTAS</button><button type="button" id="cas-random" aria-label="Visual aleatório">🎲 SORTEAR</button><button type="button" id="cas-view-reset" aria-label="Centralizar câmera">⟲</button></div><div class="cas-stage-caption"><span>↔ ARRASTE PARA GIRAR &nbsp; · &nbsp; RODA PARA ZOOM</span><span id="cas-preview-source">GLB / THREE.JS</span></div></div>',
 '<form id="cas-form" class="cas-controls"><section class="cas-section" data-cas-section="identity"><h2>Identidade</h2><p>Crie alguém para viver sua própria história na cidade.</p>',
 '<label class="cas-field"><span>Meu personagem</span><select name="rosterSlot" id="cas-roster-slot" aria-label="Personagem salvo"></select></label><div class="cas-roster-actions"><button type="button" id="cas-new-character">+ Novo personagem</button><button type="button" id="cas-delete-character">Excluir personagem</button></div>',
 '<label class="cas-field"><span>Nome</span><input type="text" name="name" minlength="1" maxlength="24" autocomplete="off" required></label>',
 '<label class="cas-field"><span>Idade <output data-cas-output="age">24</output></span><input type="range" name="age" min="18" max="80" step="1"></label>',
 '<label class="cas-field"><span>Onde cresceu</span><select name="background"><option value="bairro">Bairro popular</option><option value="centro">Centro urbano</option><option value="litoral">Litoral</option><option value="interior">Interior</option></select></label>',
 '<div class="cas-tip">Nome, idade e origem são gravados no perfil local.</div></section>',
 '<section class="cas-section" data-cas-section="body" hidden><h2>Corpo</h2><p>Escolha o corpo, comece de um visual pronto e ajuste proporções e pele.</p>',
 '<div class="cas-field"><span>Modelo corporal</span><div class="cas-segment"><label><input type="radio" name="sex" value="male"> Masculino</label><label><input type="radio" name="sex" value="female"> Feminino</label></div></div>',
 field('preset','Começar de um visual pronto','aria-label="Visual pronto"'),
 '<label class="cas-field"><span>Altura <output data-cas-output="height">100%</output></span><input type="range" name="height" min="0.90" max="1.10" step="0.01"></label>',
 '<label class="cas-field"><span>Constituição <output data-cas-output="build">100%</output></span><input type="range" name="build" min="0.86" max="1.14" step="0.01"></label>',
 color('skin','Tom de pele',false),
 '<div class="cas-tip">Os visuais prontos são os mesmos moradores, gangues e serviços da cidade; depois de escolher, troque qualquer peça.</div></section>',
 '<section class="cas-section" data-cas-section="hair" hidden><h2>Cabeça e cabelo</h2><p>Cada cabeça traz rosto, cabelo ou chapéu/capacete.</p>',
 field('head','Cabeça'),color('hair','Cor do cabelo'),
 '<div class="cas-tip" id="cas-head-note"></div></section>',
 '<section class="cas-section" data-cas-section="clothes" hidden><h2>Roupas</h2><p>Combine peças de personagens diferentes e escolha a cor principal de cada uma.</p>',
 field('body','Parte de cima'),color('top','Cor da parte de cima'),
 field('legs','Parte de baixo'),color('bottom','Cor da parte de baixo'),
 field('feet','Calçados'),color('shoes','Cor dos calçados'),
 field('acc','Acessório'),
 '<div class="cas-tip">"Cor original" mantém a pintura da peça. A cor escolhida tinge o tecido principal; detalhes (botões, logos, metal) ficam como estão.</div></section>',
 '<section class="cas-section" data-cas-section="style" hidden><h2>Estilo pessoal</h2><p>Um ponto de partida para a identidade visual.</p>',
 '<label class="cas-field"><span>Estilo</span><select name="style"><option value="casual">Casual</option><option value="esportivo">Esportivo</option><option value="urbano">Urbano</option><option value="social">Social</option></select></label>',
 '<div class="cas-tip">Estilo e origem ficam salvos para futuras roupas, traços, ocupações e progressão.</div></section>',
 '<section class="cas-section" data-cas-section="animations" hidden><h2>Estúdio de animação</h2><p id="cas-anim-count">Todas as animações do personagem.</p>',
 '<label class="cas-field"><span>Animação</span><select name="previewAction" size="12"></select></label>',
 '<div class="cas-tip">Gestos ficam disponíveis no jogo pelo menu <b>T</b>. Locomoção, armas e luta tocam sozinhas conforme você joga.</div></section></form>',
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
 const source=dialog.querySelector('#cas-preview-source');
 const el=name=>form.elements[name];
 const steps=['identity','body','hair','clothes','style','animations'];
 const rosterSelect=form.elements.rosterSlot;
 const buttons={prev:dialog.querySelector('#cas-prev-step'),next:dialog.querySelector('#cas-next-step'),save:dialog.querySelector('#cas-save')};
 const manifest=()=>system.roster?.manifest||null;
 let currentTab='identity',roster=null;
 let draft={...CAS_DEFAULT},renderer,scene,camera,world,previewRoot=null,mixer=null,activeMotion=null,modelAnimations=[],lastTime=0,active=false,loadingVersion=0,previewKey='',spin=0,zoom=3.55,drag=null,lastWidth=0,lastHeight=0;
 const safeStorage=()=>{try{return localStorage;}catch{return {getItem:()=>null,setItem(){throw Error('Armazenamento do navegador indisponível');}};}};
 let previewAnimation='idle';
 const COLOR_KEYS=['hair','top','bottom','shoes'];
 // amostras de cor
 for(const type of ['skin','hair','top','bottom','shoes']){
  const palette=dialog.querySelector('[data-swatches='+type+']');
  for(const c of CAS_COLORS[type]||[]){
   const sw=document.createElement('button');sw.type='button';sw.dataset.casColor=c;sw.dataset.casColorField=type;
   sw.style.backgroundColor=c;sw.title=c;sw.setAttribute('aria-label','Cor '+c);palette.append(sw);
  }
 }
 function fillParts(sex){
  const parts=manifest()?.[sex]?.parts||[],labels=PART_LABEL[sex]||{};
  for(const slot of ['head','body','legs','feet','acc']){
   const sel=el(slot),prev=sel.value;sel.replaceChildren();
   if(slot==='acc')sel.append(new Option('Nenhum',''));
   for(const p of parts.filter(p=>p.slot===slot)){
    const label=(labels[p.id]||p.id)+(slot==='head'&&HEAD_HINT[sex]?.[p.id]?' — '+HEAD_HINT[sex][p.id]:'');
    sel.append(new Option(label,p.id));
   }
   sel.value=prev;
  }
  const preset=el('preset');preset.replaceChildren(new Option('— manter o atual —',''));
  for(const spec of Object.values(system.looks||{}))if(spec.sex===sex)preset.append(new Option(spec.label,spec.id));
 }
 function visibleTab(name){
  if(!steps.includes(name))return;
  currentTab=name;
  buttons.prev.hidden=name==='identity';
  buttons.next.hidden=name==='animations';
  for(const b of dialog.querySelectorAll('[data-cas-tab]'))b.setAttribute('aria-pressed',String(b.dataset.casTab===name));
  for(const sec of dialog.querySelectorAll('[data-cas-section]'))sec.hidden=sec.dataset.casSection!==name;
 }
 function refreshRoster(){
  rosterSelect.replaceChildren();
  for(const c of roster?.characters||[])rosterSelect.append(new Option(c.profile.name+' · '+(c.profile.sex==='female'?'Feminino':'Masculino'),c.id));
  rosterSelect.value=roster?.activeId||'';
  dialog.querySelector('#cas-new-character').disabled=(roster?.characters?.length||0)>=MAX_CHARACTERS;
  dialog.querySelector('#cas-delete-character').disabled=(roster?.characters?.length||0)<=1;
 }
 function loadActive(){loadForm(activeCharacter(roster)||CAS_DEFAULT);refreshRoster();void refreshPreview(true);}
 // peças vazias viram as do visual normalizado (padrão do sexo), p/ os selects mostrarem o que está no corpo
 function withParts(profile){
  const look=normalizeLook(profile,manifest());
  return {...profile,head:look.head,body:look.body,legs:look.legs,feet:look.feet,acc:look.acc};
 }
 function loadForm(profile){
  draft=withParts(normalizeCAS(profile));
  fillParts(draft.sex);
  for(const key of ['name','age','height','build','skin','background','style','head','body','legs','feet','acc'])if(el(key))el(key).value=draft[key];
  for(const key of COLOR_KEYS){el(key+'Original').checked=!draft[key];el(key).value=draft[key]||defaultColor(key);el(key).disabled=!draft[key];}
  const sex=form.querySelector('input[name=sex][value='+draft.sex+']');if(sex)sex.checked=true;
  el('preset').value='';
  for(const key of ['age','height','build'])updateOutput(key);
  headNote();
 }
 // cor exibida quando "original": a do material principal da peça
 function defaultColor(key){
  const m=manifest()?.[draft.sex],slot={hair:'head',top:'body',bottom:'legs',shoes:'feet'}[key],part=m?.parts.find(p=>p.slot===slot&&p.id===draft[slot]);
  if(!part)return '#808080';
  if(key==='hair')return part.materials.find(x=>/^hair/i.test(x.name))?.color||'#3a2619';
  const name=primaryCloth(part,draft.sex);return part.materials.find(x=>x.name===name)?.color||'#808080';
 }
 function headNote(){const n=dialog.querySelector('#cas-head-note'),h=HEAD_HINT[draft.sex]?.[draft.head];n.textContent=h?'Esta cabeça vem com '+h+'. A cor do cabelo também pinta sobrancelhas e barba.':'';}
 function updateOutput(key){
  const out=dialog.querySelector('[data-cas-output='+key+']');if(!out)return;
  out.textContent=key==='age'?String(el(key).value):Math.round(Number(el(key).value)*100)+'%';
 }
 function currentDraft(){
  const data=Object.fromEntries(new FormData(form).entries());
  for(const key of COLOR_KEYS)data[key]=el(key+'Original').checked?'':el(key).value;
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
 function fillAnimations(){
  const sel=el('previewAction'),prev=sel.value||previewAnimation;sel.replaceChildren();
  const names=modelAnimations.map(c=>c.name),used=new Set();
  const group=(label,list)=>{if(!list.length)return;const g=document.createElement('optgroup');g.label=label+' ('+list.length+')';for(const [v,t] of list)g.append(new Option(t,v));sel.append(g);};
  group('Gestos',Object.entries(CAS_EMOTES).filter(([,e])=>names.includes(e.clip)).map(([id,e])=>{used.add(e.clip);return ['cas_'+id,(EMOTE_GROUPS[e.group]?EMOTE_GROUPS[e.group]+': ':'')+e.label];}));
  for(const [label,re] of ANIM_GROUPS)group(label,names.filter(n=>!used.has(n)&&re.test(n)).map(n=>{used.add(n);return [n,ANIM_LABEL[n]||n.replace(/^q_/,'').replace(/_/g,' ')];}));
  group('Outras',names.filter(n=>!used.has(n)).map(n=>[n,ANIM_LABEL[n]||n.replace(/^q_/,'').replace(/_/g,' ')]));
  sel.value=[...sel.options].some(o=>o.value===prev)?prev:'idle';
  dialog.querySelector('#cas-anim-count').textContent=modelAnimations.length+' animações reais no esqueleto do personagem (Universal Animation Library 1 e 2, pack modular e Mixamo).';
 }
 function setClip(){
  if(!mixer)return;
  const want=previewAnimation.startsWith('cas_')?CAS_EMOTES[previewAnimation.slice(4)]?.clip:previewAnimation;
  const motion=modelAnimations.find(c=>c.name===want)||modelAnimations.find(c=>c.name==='idle')||modelAnimations[0];
  if(!motion)return;
  const next=mixer.clipAction(motion),previous=activeMotion;
  if(previous===next)return;
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(THREE.LoopRepeat,Infinity).play();
  if(previous)next.crossFadeFrom(previous,.2,true);
  activeMotion=next;
 }
 // monta (ou reaproveita) o personagem da prévia com as peças e cores do rascunho
 async function refreshPreview(force=false){
  if(!renderer||!system.loadLook)return;
  const look=normalizeLook(draft,manifest()),key=lookKey(look);
  if(!force&&key===previewKey)return;
  const version=++loadingVersion;previewKey=key;
  loading.hidden=false;loading.textContent='Vestindo o personagem…';
  try{
   const {gltf,spec}=await system.loadLook(draft);
   if(version!==loadingVersion)return;
   const time=activeMotion?.time||0;
   if(previewRoot){world.remove(previewRoot);previewRoot=null;}
   const root=cloneSkeleton(gltf.scene);
   root.traverse(o=>{if(o.isMesh){o.frustumCulled=false;}});
   root.userData.casBaseScale=root.scale.clone();
   world.add(root);previewRoot=root;
   const sameSkeleton=mixer&&modelAnimations===gltf.animations;
   mixer?.stopAllAction();
   mixer=new THREE.AnimationMixer(root);activeMotion=null;
   modelAnimations=gltf.animations||[];
   if(!sameSkeleton)fillAnimations();
   setClip();if(activeMotion)activeMotion.time=time;
   source.textContent=(spec.sex==='female'?'FEMININO':'MASCULINO')+' · '+spec.bones+' OSSOS · '+Math.round(spec.triangles/100)/10+' MIL TRIÂNGULOS · '+modelAnimations.length+' ANIMAÇÕES';
   loading.hidden=true;syncPreview();
  }catch(error){loading.textContent='Prévia 3D: '+String(error.message||error);source.textContent='ERRO AO CARREGAR PERSONAGEM';status.textContent='A prévia não abriu: '+String(error.message||error);}
 }
 function syncPreview(){
  if(!previewRoot)return;
  const base=previewRoot.userData.casBaseScale||previewRoot.scale.clone();
  previewRoot.scale.set(base.x*draft.build,base.y*draft.height,base.z*draft.build);
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
   const facial=currentTab==='hair';
   camera.position.set(0,facial?1.55:1.16,facial?Math.min(zoom,2.05):zoom);
   camera.lookAt(0,facial?1.5:1.02,0);
   resize();renderer.render(scene,camera);
  }
  requestAnimationFrame(animate);
 }
 function open(){
  if(dialog.open)return;
  roster=readRoster(safeStorage());
  loadForm(activeCharacter(roster)||system.casProfile||CAS_DEFAULT);
  refreshRoster();
  visibleTab('identity');previewKey='';spin=0;zoom=3.55;previewAnimation='idle';
  status.textContent=manifest()?'Monte seu visual: '+(manifest().male.parts.length+manifest().female.parts.length)+' peças modulares e '+Object.keys(system.looks||{}).length+' visuais prontos.':'Falha ao carregar os personagens: '+(system.errors?.[0]||'verifique assets/characters/modular');
  window.cityCharacterEditorOpen=true;
  window.dispatchEvent(new Event('blur'));
  dialog.showModal();
  setupRenderer();resize();
  void refreshPreview(true);
  if(!active){active=true;lastTime=performance.now();requestAnimationFrame(animate);}
 }
 function close(){if(dialog.open)dialog.close();}
 button.addEventListener('click',open);
 dialog.querySelector('#cas-close').addEventListener('click',close);
 buttons.prev.addEventListener('click',()=>{const at=steps.indexOf(currentTab);visibleTab(steps[Math.max(0,at-1)]);});
 buttons.next.addEventListener('click',()=>{const at=steps.indexOf(currentTab);visibleTab(steps[Math.min(steps.length-1,at+1)]);});
 for(const [id,rotation] of [['cas-view-front',0],['cas-view-side',Math.PI/2],['cas-view-back',Math.PI],['cas-view-reset',0]]){
  dialog.querySelector('#'+id).addEventListener('click',()=>{spin=rotation;if(id==='cas-view-reset')zoom=3.55;});
 }
 // sorteia peças e cores (sem as peças de fantasia… a não ser que já estejam no corpo)
 dialog.querySelector('#cas-random').addEventListener('click',()=>{
  const m=manifest()?.[draft.sex];if(!m)return;
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const next={...currentDraft()};
  for(const slot of ['head','body','legs','feet'])next[slot]=pick(m.parts.filter(p=>p.slot===slot)).id;
  next.skin=pick(CAS_COLORS.skin);next.hair=Math.random()<.7?pick(CAS_COLORS.hair):'';
  for(const k of ['top','bottom','shoes'])next[k]=Math.random()<.6?pick(CAS_COLORS[k]):'';
  loadForm(next);void refreshPreview();
 });
 dialog.querySelector('#cas-new-character').addEventListener('click',()=>{
  try{roster=addCharacter(roster,{...CAS_DEFAULT,name:'Novo personagem',sex:draft.sex});loadActive();status.textContent='Novo personagem preparado. Salve para confirmar.';}
  catch(e){status.textContent=String(e.message||e);}
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
  const sw=e.target.closest('button[data-cas-color]');if(!sw)return;
  const color=sw.dataset.casColor,key=sw.dataset.casColorField;if(!el(key))return;
  if(el(key+'Original')){el(key+'Original').checked=false;el(key).disabled=false;}
  el(key).value=color;el(key).dispatchEvent(new Event('input',{bubbles:true}));
 });
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('close',()=>{window.cityCharacterEditorOpen=false;drag=null;loadingVersion++;bridge?.input?.keys?.clear?.();});
 dialog.querySelector('.cas-nav').addEventListener('click',event=>{const tab=event.target.closest('[data-cas-tab]');if(tab)visibleTab(tab.dataset.casTab);});
 const onChange=event=>{
  const name=event.target?.name||'';
  if(name==='previewAction'){previewAnimation=event.target.value;setClip();return;}
  if(name==='rosterSlot')return;
  if(name==='preset'){
   const look=system.lookOf?.(event.target.value);if(!look)return;
   loadForm({...currentDraft(),head:look.head,body:look.body,legs:look.legs,feet:look.feet,acc:look.acc,skin:look.skin,hair:look.hair,top:look.top,bottom:look.bottom,shoes:look.shoes});
   el('preset').value=event.target.value;void refreshPreview();return;
  }
  if(name.endsWith('Original')){const key=name.slice(0,-8);el(key).disabled=event.target.checked;if(event.target.checked)el(key).value=defaultColor(key);}
  const next=currentDraft(),sexChanged=next.sex!==draft.sex;
  if(sexChanged){for(const s of ['head','body','legs','feet','acc'])next[s]='';loadForm(next);void refreshPreview();return;}
  draft=withParts(next);
  if(['head','body','legs','feet'].includes(name)){for(const key of COLOR_KEYS)if(el(key+'Original').checked)el(key).value=defaultColor(key);headNote();}
  for(const key of ['age','height','build'])updateOutput(key);
  void refreshPreview();syncPreview();
 };
 form.addEventListener('input',onChange);
 form.addEventListener('change',event=>{if(event.target?.type==='checkbox'||event.target?.tagName==='SELECT')onChange(event);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();const save=dialog.querySelector('#cas-save');
  if(save.disabled)return;
  save.disabled=true;status.textContent='Aplicando visual e salvando perfil…';
  try{
   const selected=currentDraft();selected.look='';
   await system.applyCAS(selected);
   try{roster=updateCharacter(roster,selected);persistRoster(safeStorage(),roster);}catch{status.textContent='Visual aplicado, mas não foi possível gravar. Verifique permissões do navegador.';return;}
   status.textContent='Personagem salvo!';
   close();
  }catch(error){status.textContent='Falha ao aplicar: '+String(error.message||error);}
  finally{save.disabled=false;}
 });
 canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,angle:spin};canvas.setPointerCapture(event.pointerId);});
 canvas.addEventListener('pointermove',event=>{if(drag)spin=drag.angle+(event.clientX-drag.x)*.012;});
 canvas.addEventListener('pointerup',()=>{drag=null;});
 canvas.addEventListener('pointercancel',()=>{drag=null;});
 canvas.addEventListener('wheel',event=>{event.preventDefault();zoom=Math.max(1.6,Math.min(5,zoom+Math.sign(event.deltaY)*.22));},{passive:false});
 window.addEventListener('resize',resize);
 system.openCreator=open;
 system.casStorageKey='cityofgod.cas.v1';
 system.casRosterKey='cityofgod.cas.roster.v1';
}
