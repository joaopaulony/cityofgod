import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {CAS_DEFAULT,CAS_COLORS,normalizeCAS} from './cas-profile.mjs';
import {MAX_CHARACTERS,readRoster,activeCharacter,addCharacter,updateCharacter,selectCharacter,deleteCharacter,persistRoster} from './cas-roster.mjs';
import {CAS_EMOTES} from './cas-studio.mjs';
import {PART_LABEL,HEAD_HINT,FANTASY,normalizeLook,paintLook,paintable,primaryCloth} from './modular-characters.mjs';

// City of God CAS: provador 3D claro. O personagem é montado com as peças modulares da Quaternius (cabeça com cabelo,
// tronco, pernas, calçados e acessório); cada parte de cada roupa pode mudar de cor. A prévia só remonta o boneco
// quando uma peça muda — cores são repintadas na hora. O sistema de personagens (character-webgl.mjs) aplica o perfil.
const ANIM_GROUPS=[
 ['Andar e correr',/^(idle|idle_ual|q_idle_neutral|walk|walk_ual|walk_formal|walk_carry|run|jog|sprint|q_run_(back|left|right)|crouch|crouch_walk|jump_|ninja_jump|slide|climb_up|vault_low|roll|q_roll|driving|swim)/],
 ['Armas',/^(rifle_|pistol_|q_gun|q_idle_gun|q_run_shoot)/],
 ['Luta',/^(punch|melee|q_punch|q_kick|hit_|q_hitreceive|death|q_death)/],
];
// fora do CAS: animações de fantasia/medievais (espada, escudo, magia) e a pose de referência
const HIDDEN_ANIM=/^(sword|shield|idle_shield|spell|a_t_pose)/;
const ANIM_LABEL={idle:'Parado',walk:'Andar',run:'Correr',sprint:'Disparada',jog:'Trote',crouch:'Agachado',crouch_walk:'Andar agachado',jump_air:'Pulo',jump_start:'Impulso do pulo',jump_land:'Aterrissar',
 walk_formal:'Andar formal',walk_carry:'Andar carregando',idle_ual:'Parado 2',walk_ual:'Andar 2',q_idle_neutral:'Parado neutro',q_run_back:'Correr de costas',q_run_left:'Correr p/ esquerda',q_run_right:'Correr p/ direita',
 vault_low:'Pular muro',climb_up_1m:'Escalar',roll:'Rolamento',q_roll:'Rolamento 2',swim_fwd:'Nadar',swim_idle:'Boiar',driving:'Dirigir',slide:'Deslizar',slide_start:'Começar a deslizar',slide_exit:'Sair do deslize',
 ninja_jump_start:'Salto (impulso)',ninja_jump_idle:'Salto (no ar)',ninja_jump_land:'Salto (aterrissar)',
 rifle_idle:'Fuzil parado',rifle_aim:'Fuzil mirando',rifle_walk:'Fuzil andando',rifle_run:'Fuzil correndo',rifle_fire:'Fuzil atirando',rifle_reload:'Recarregar fuzil',rifle_walk_back:'Fuzil de costas',rifle_strafe_left:'Fuzil p/ esquerda',rifle_strafe_right:'Fuzil p/ direita',
 rifle_crouch_aim:'Fuzil agachado',rifle_crouch_walk:'Fuzil agachado andando',rifle_crouch_fire:'Fuzil agachado atirando',rifle_crouch_reload:'Recarregar agachado',
 pistol_idle:'Pistola parado',pistol_shoot:'Pistola atirando',pistol_reload:'Recarregar pistola',pistol_aim_neutral:'Pistola mirando',pistol_aim_up:'Pistola mirando p/ cima',pistol_aim_down:'Pistola mirando p/ baixo',
 q_gun_shoot:'Atirar',q_idle_gun:'Arma parado',q_idle_gun_pointing:'Apontar arma',q_idle_gun_shoot:'Atirar parado',q_run_shoot:'Correr atirando',
 punch_jab:'Jab',punch_cross:'Direto',melee_hook:'Gancho',melee_hook_rec:'Recuo do gancho',q_punch_left:'Soco esquerdo',q_punch_right:'Soco direito',q_kick_left:'Chute esquerdo',q_kick_right:'Chute direito',
 hit_chest:'Golpe no peito',hit_head:'Golpe na cabeça',hit_knockback:'Arremessado',q_hitreceive:'Apanhar',q_hitreceive_2:'Apanhar 2',death01:'Morte',q_death:'Morte 2',
 lay_to_idle:'Levantar do chão',interact:'Mexer em algo',q_interact:'Mexer 2',q_wave:'Acenar',zombie_walk_fwd:'Andar de zumbi',sitting_enter:'Sentar',sitting_exit:'Levantar',overhand_throw:'Arremessar'};
const SLOT_TITLE={head:'Cabeça',body:'Parte de cima',legs:'Parte de baixo',feet:'Calçados',acc:'Acessório'};
const QUICK=['#1f2329','#e8e4dc','#8f8f8f','#2e4a6b','#4a6a8a','#6b2c2c','#a23b2f','#2f5d3a','#c2a36b','#d98a2b','#8a5a8a','#3a2619'];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export function installCASCreator(system,bridge){
 const dialog=document.createElement('dialog');
 dialog.id='city-cas-dialog';
 dialog.setAttribute('aria-label','City of God — criador de personagem');
 dialog.innerHTML=`<div class="cas-shell">
 <div class="cas-stage"><canvas id="cas-preview" aria-label="Prévia 3D do personagem" tabindex="0"></canvas>
  <div class="cas-brand"><small>CITY OF GOD</small><strong>Meu personagem</strong></div>
  <span class="cas-loading" id="cas-loading" role="status">Preparando o provador…</span>
  <div class="cas-views"><button type="button" data-view="0">Frente</button><button type="button" data-view="1.5708">Perfil</button><button type="button" data-view="3.1416">Costas</button><button type="button" data-view="reset" aria-label="Centralizar">⟲</button></div>
  <span class="cas-source" id="cas-preview-source"></span></div>
 <form id="cas-form" class="cas-panel" autocomplete="off">
  <div class="cas-top"><input type="text" name="name" maxlength="24" required aria-label="Nome do personagem"><button type="button" class="cas-icon" id="cas-close" aria-label="Voltar ao jogo">✕</button></div>
  <div class="cas-slots"><select name="rosterSlot" aria-label="Personagem salvo"></select><button type="button" id="cas-new-character">+ Novo</button><button type="button" id="cas-delete-character">Excluir</button></div>
  <nav class="cas-tabs" aria-label="Personalização"><button type="button" data-cas-tab="body">Corpo</button><button type="button" data-cas-tab="head">Cabeça</button><button type="button" data-cas-tab="clothes">Roupas</button><button type="button" data-cas-tab="anims">Animações</button></nav>
  <div class="cas-body">
   <section class="cas-section" data-cas-section="body"></section>
   <section class="cas-section" data-cas-section="head" hidden></section>
   <section class="cas-section" data-cas-section="clothes" hidden></section>
   <section class="cas-section" data-cas-section="anims" hidden></section>
  </div>
  <footer class="cas-footer"><span class="cas-status" role="status" id="cas-message"></span><button type="button" id="cas-random">Sortear</button><button type="submit" class="cas-save" id="cas-save">Salvar</button></footer>
 </form></div>`;
 const button=document.createElement('button');
 button.type='button';button.id='city-cas-open';button.textContent='Meu personagem';
 document.body.append(dialog,button);
 const $=s=>dialog.querySelector(s),form=$('#cas-form'),canvas=$('#cas-preview'),status=$('#cas-message'),loading=$('#cas-loading'),source=$('#cas-preview-source');
 const sec=id=>$('[data-cas-section='+id+']');
 const manifest=()=>system.roster?.manifest||null;
 const safeStorage=()=>{try{return localStorage;}catch{return {getItem:()=>null,setItem(){throw Error('Armazenamento do navegador indisponível');}};}};
 let roster=null,draft={...CAS_DEFAULT},tab='body',renderer,scene,camera,world,previewRoot=null,mixer=null,activeMotion=null,modelAnimations=[],lastTime=0,active=false,loadingVersion=0,partsKey='',spin=0,zoom=4.6,drag=null,lastW=0,lastH=0,anim='idle';

 // ---------- dados do rascunho ----------
 const look=()=>normalizeLook(draft,manifest());
 const parts=(slot,sex=draft.sex)=>(manifest()?.[sex]?.parts||[]).filter(p=>p.slot===slot&&!FANTASY[sex].has(p.id));
 const labelOf=(id,sex=draft.sex)=>PART_LABEL[sex]?.[id]||id.replace(/_/g,' ');
 function setDraft(next,{parts:partsChanged=false}={}){
  const l=normalizeLook({...draft,...next},manifest());
  draft=normalizeCAS({...draft,...next,head:l.head,body:l.body,legs:l.legs,feet:l.feet,acc:l.acc,tints:l.tints});
  if(partsChanged)void refreshPreview();else repaint();
 }
 // cor que a parte mostra agora (escolhida, atalho da cor principal ou a original da peça)
 function colorOf(slot,mat,primary){
  const t=draft.tints?.[slot]?.[mat.name];if(t)return t;
  const short={body:'top',legs:'bottom',feet:'shoes'}[slot];
  if(short&&primary&&draft[short])return draft[short];
  return mat.color;
 }

 // ---------- seções ----------
 function swatches(field,list,{original=false}={}){
  const cur=draft[field]||'';
  return `<div class="cas-swatches">${original?`<button type="button" class="cas-swatch cas-original" data-set="${field}" data-color="" aria-pressed="${!cur}" title="Cor original" aria-label="Cor original"></button>`:''}${
   list.map(c=>`<button type="button" class="cas-swatch" style="background:${c}" data-set="${field}" data-color="${c}" aria-pressed="${cur===c}" aria-label="Cor ${c}"></button>`).join('')
  }<label class="cas-custom" title="Outra cor"><input type="color" data-set="${field}" value="${cur||'#808080'}" aria-label="Outra cor"></label></div>`;
 }
 function cards(slot){
  const list=parts(slot),cur=draft[slot]||look()[slot],none=slot==='acc';
  if(!list.length&&none)return '<p class="cas-note">Nenhum acessório para este corpo.</p>';
  return `<div class="cas-cards">${none?`<button type="button" class="cas-card" data-part="${slot}" data-id="" aria-pressed="${!cur}"><b>Nenhum</b></button>`:''}${
   list.map(p=>`<button type="button" class="cas-card" data-part="${slot}" data-id="${p.id}" aria-pressed="${cur===p.id}"><b>${esc(labelOf(p.id))}</b>${slot==='head'&&HEAD_HINT[draft.sex]?.[p.id]?`<small>${esc(HEAD_HINT[draft.sex][p.id])}</small>`:''}</button>`).join('')}</div>`;
 }
 function paints(slot){
  const l=look(),id=l[slot];if(!id)return '';
  const mats=paintable(manifest(),draft.sex,slot,id);if(!mats.length)return '';
  const part=manifest()[draft.sex].parts.find(p=>p.slot===slot&&p.id===id),primary=primaryCloth(part,draft.sex);
  return `<div class="cas-paints">${mats.map((m,i)=>{
   const c=colorOf(slot,m,m.name===primary),changed=!!draft.tints?.[slot]?.[m.name]||(m.name===primary&&!!draft[{body:'top',legs:'bottom',feet:'shoes'}[slot]]);
   const label=slot==='head'?(m.role==='metal'?'Metal / brilho':i===0?'Chapéu / capacete':'Detalhe '+i):(i===0?'Cor principal':'Detalhe '+i);
   return `<div class="cas-paint"><label class="cas-dot" style="background:${c}" title="Escolher cor"><input type="color" data-paint="${slot}" data-mat="${esc(m.name)}" value="${c}" aria-label="${label}"></label><span>${label}</span>
    <span class="cas-mini">${QUICK.slice(0,6).map(q=>`<button type="button" style="background:${q}" data-paint="${slot}" data-mat="${esc(m.name)}" data-color="${q}" aria-label="${label}: ${q}"></button>`).join('')}</span>
    <button type="button" class="cas-reset" data-reset="${slot}" data-mat="${esc(m.name)}" ${changed?'':'disabled'} title="Voltar à cor original" aria-label="Voltar à cor original">↺</button></div>`;
  }).join('')}</div>`;
 }
 function render(){
  const presets=Object.values(system.looks||{}).filter(s=>s.sex===draft.sex);
  sec('body').innerHTML=`
   <div class="cas-group"><div class="cas-label">Corpo</div><div class="cas-seg"><label><input type="radio" name="sex" value="male" ${draft.sex==='male'?'checked':''}> Masculino</label><label><input type="radio" name="sex" value="female" ${draft.sex==='female'?'checked':''}> Feminino</label></div>
    <div class="cas-label">Altura <output>${Math.round(draft.height*100)}%</output></div><input type="range" name="height" min="0.90" max="1.10" step="0.01" value="${draft.height}">
    <div class="cas-label">Porte <output>${Math.round(draft.build*100)}%</output></div><input type="range" name="build" min="0.86" max="1.14" step="0.01" value="${draft.build}"></div>
   <div class="cas-group"><div class="cas-label">Tom de pele</div>${swatches('skin',CAS_COLORS.skin)}</div>
   <div class="cas-group"><div class="cas-label">Começar de um visual pronto</div><select name="preset"><option value="">Escolher…</option>${presets.map(p=>`<option value="${p.id}">${esc(p.label)}</option>`).join('')}</select><p class="cas-note">Moradores, gangues e serviços da cidade. Depois troque o que quiser.</p></div>`;
  const headPaints=paints('head');
  sec('head').innerHTML=`
   <div class="cas-group"><div class="cas-label">Rosto e cabelo</div>${cards('head')}</div>
   <div class="cas-group"><div class="cas-label">Cor do cabelo</div>${swatches('hair',CAS_COLORS.hair,{original:true})}<p class="cas-note">Pinta também sobrancelhas, barba e bigode.</p></div>
   ${headPaints?`<div class="cas-group"><div class="cas-label">Chapéu e acessórios da cabeça</div>${headPaints}</div>`:''}`;
  sec('clothes').innerHTML=['body','legs','feet','acc'].map(slot=>`<div class="cas-group"><div class="cas-label">${SLOT_TITLE[slot]}</div>${cards(slot)}${paints(slot)}</div>`).join('');
  renderAnims();
  form.elements.name.value=draft.name;
  for(const b of dialog.querySelectorAll('[data-cas-tab]'))b.setAttribute('aria-pressed',String(b.dataset.casTab===tab));
  for(const s of dialog.querySelectorAll('[data-cas-section]'))s.hidden=s.dataset.casSection!==tab;
 }
 function renderAnims(){
  const names=modelAnimations.map(c=>c.name).filter(n=>!HIDDEN_ANIM.test(n)),used=new Set(),groups=[];
  groups.push(['Gestos',Object.entries(CAS_EMOTES).filter(([,e])=>names.includes(e.clip)).map(([id,e])=>{used.add(e.clip);return ['cas_'+id,e.label];})]);
  for(const [label,re] of ANIM_GROUPS)groups.push([label,names.filter(n=>!used.has(n)&&re.test(n)).map(n=>{used.add(n);return [n,ANIM_LABEL[n]||n.replace(/^q_/,'').replace(/_/g,' ')];})]);
  groups.push(['Outras',names.filter(n=>!used.has(n)).map(n=>[n,ANIM_LABEL[n]||n.replace(/^q_/,'').replace(/_/g,' ')])]);
  sec('anims').innerHTML=modelAnimations.length?groups.filter(g=>g[1].length).map(([label,list])=>`<div class="cas-group"><div class="cas-label">${label} <output>${list.length}</output></div><div class="cas-anims">${
   list.map(([v,t])=>`<button type="button" data-anim="${v}" aria-pressed="${v===anim}">${esc(t)}</button>`).join('')}</div></div>`).join('')+'<p class="cas-note">Os gestos ficam no jogo pela tecla T.</p>':'<p class="cas-note">Carregando animações…</p>';
 }
 function refreshSlots(){
  const sel=form.elements.rosterSlot;sel.replaceChildren();
  for(const c of roster?.characters||[])sel.append(new Option(c.profile.name+' · '+(c.profile.sex==='female'?'Feminino':'Masculino'),c.id));
  sel.value=roster?.activeId||'';
  $('#cas-new-character').disabled=(roster?.characters?.length||0)>=MAX_CHARACTERS;
  $('#cas-delete-character').disabled=(roster?.characters?.length||0)<=1;
 }
 function loadProfile(profile){draft=normalizeCAS(profile);const l=look();draft={...draft,head:l.head,body:l.body,legs:l.legs,feet:l.feet,acc:l.acc,tints:l.tints};render();void refreshPreview(true);}

 // ---------- prévia 3D ----------
 function studio(){
  scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff','#c9ced3',2.1));
  const key=new THREE.DirectionalLight('#fff7ee',2.4);key.position.set(-2.5,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-2,right:2,top:3,bottom:-1,near:1,far:15});key.shadow.radius=4;scene.add(key);
  const rim=new THREE.DirectionalLight('#dfe9ff',1.2);rim.position.set(3,3,-4);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(1.6,64),new THREE.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const disc=new THREE.Mesh(new THREE.RingGeometry(1.15,1.18,96),new THREE.MeshBasicMaterial({color:'#d3d8dc'}));disc.rotation.x=-Math.PI/2;disc.position.y=.002;scene.add(disc);
  camera=new THREE.PerspectiveCamera(30,1,.05,40);camera.position.set(0,1.25,zoom);
  world=new THREE.Group();scene.add(world);
 }
 function setupRenderer(){
  if(renderer)return;
  try{
   renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   renderer.setClearColor(0x000000,0);studio();
  }catch(error){status.textContent='Prévia 3D indisponível: '+String(error.message||error);loading.textContent='Prévia 3D indisponível';}
 }
 function setClip(){
  if(!mixer)return;
  const want=anim.startsWith('cas_')?CAS_EMOTES[anim.slice(4)]?.clip:anim;
  const motion=modelAnimations.find(c=>c.name===want)||modelAnimations.find(c=>c.name==='idle');
  if(!motion)return;
  const next=mixer.clipAction(motion),prev=activeMotion;if(prev===next)return;
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(THREE.LoopRepeat,Infinity).play();
  if(prev)next.crossFadeFrom(prev,.2,true);activeMotion=next;
 }
 // só as peças definem o boneco (cache do roster); as cores são pintadas por cima em materiais próprios da prévia
 async function refreshPreview(force=false){
  if(!renderer||!system.loadLook)return;
  const l=look(),key=[l.sex,l.head,l.body,l.legs,l.feet,l.acc].join('|');
  if(!force&&key===partsKey){repaint();return;}
  const version=++loadingVersion;partsKey=key;loading.hidden=false;loading.textContent='Vestindo…';
  try{
   const {gltf,spec}=await system.loadLook({sex:l.sex,head:l.head,body:l.body,legs:l.legs,feet:l.feet,acc:l.acc});
   if(version!==loadingVersion)return;
   const time=activeMotion?.time||0;
   if(previewRoot)world.remove(previewRoot);
   const root=cloneSkeleton(gltf.scene);
   root.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;o.castShadow=true;
    const own=m=>{const c=m.clone();c.userData={casOwn:true,base:m.userData.base??m.color.getHex()};return c;};
    o.material=Array.isArray(o.material)?o.material.map(own):own(o.material);});
   root.userData.casBase=root.scale.clone();world.add(root);previewRoot=root;
   const same=modelAnimations===gltf.animations;
   mixer?.stopAllAction();mixer=new THREE.AnimationMixer(root);activeMotion=null;modelAnimations=gltf.animations||[];
   setClip();if(activeMotion)activeMotion.time=time;
   if(!same)renderAnims();
   source.textContent=(spec.sex==='female'?'FEMININO':'MASCULINO')+' · '+Math.round(spec.triangles/100)/10+' MIL TRIÂNGULOS';
   loading.hidden=true;repaint();
  }catch(error){loading.textContent='Não foi possível vestir: '+String(error.message||error);}
 }
 function repaint(){
  if(!previewRoot)return;
  paintLook(previewRoot,look(),manifest());
  const b=previewRoot.userData.casBase;previewRoot.scale.set(b.x*draft.build,b.y*draft.height,b.z*draft.build);
 }
 function resize(){
  if(!renderer||!dialog.open)return;
  const {width,height}=canvas.getBoundingClientRect(),w=Math.round(width),h=Math.round(height);
  if(w<10||h<10||(w===lastW&&h===lastH))return;lastW=w;lastH=h;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 }
 const camTo=new THREE.Vector3();
 function animate(t){
  if(!dialog.open){active=false;return;}
  if(renderer&&scene){
   const dt=Math.min(.05,Math.max(0,(t-lastTime)/1000));lastTime=t;mixer?.update(dt);
   world.rotation.y+=(spin-world.rotation.y)*Math.min(1,dt*10);
   const face=tab==='head';
   camera.position.lerp(camTo.set(0,face?1.62:1.15,face?Math.min(zoom,1.6):zoom),Math.min(1,dt*6));camera.lookAt(0,face?1.56:.92,0);
   resize();renderer.render(scene,camera);
  }
  requestAnimationFrame(animate);
 }

 // ---------- abrir / fechar / salvar ----------
 function open(){
  if(dialog.open)return;
  roster=readRoster(safeStorage());refreshSlots();
  tab='body';anim='idle';spin=0;zoom=4.6;partsKey='';
  status.textContent=manifest()?'Escolha peças e cores; a prévia muda na hora.':'Falha ao carregar os personagens: '+(system.errors?.[0]||'verifique assets/characters/modular');
  window.cityCharacterEditorOpen=true;window.dispatchEvent(new Event('blur'));
  dialog.showModal();setupRenderer();resize();
  loadProfile(activeCharacter(roster)||system.casProfile||CAS_DEFAULT);
  if(!active){active=true;lastTime=performance.now();requestAnimationFrame(animate);}
 }
 const close=()=>{if(dialog.open)dialog.close();};
 button.addEventListener('click',open);
 $('#cas-close').addEventListener('click',close);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('close',()=>{window.cityCharacterEditorOpen=false;drag=null;loadingVersion++;bridge?.input?.keys?.clear?.();});
 for(const b of dialog.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{if(b.dataset.view==='reset'){spin=0;zoom=4.6;}else spin=Number(b.dataset.view);});
 dialog.querySelector('.cas-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-cas-tab]');if(!b)return;tab=b.dataset.casTab;render();});
 // cliques: cartões de peça, amostras, cores das partes, animações
 form.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t||t.type==='submit')return;
  if(t.dataset.part){const slot=t.dataset.part,tints={...draft.tints};delete tints[slot];setDraft({[slot]:t.dataset.id,tints},{parts:true});render();return;}
  if(t.dataset.set&&t.dataset.color!=null){setDraft({[t.dataset.set]:t.dataset.color});render();return;}
  if(t.dataset.paint&&t.dataset.color){paint(t.dataset.paint,t.dataset.mat,t.dataset.color);render();return;}
  if(t.dataset.reset){unpaint(t.dataset.reset,t.dataset.mat);render();return;}
  if(t.dataset.anim){anim=t.dataset.anim;setClip();for(const b of form.querySelectorAll('[data-anim]'))b.setAttribute('aria-pressed',String(b===t));}
 });
 function paint(slot,mat,color){const tints=structuredClone(draft.tints||{});(tints[slot]||(tints[slot]={}))[mat]=color;setDraft({tints});}
 function unpaint(slot,mat){
  const tints=structuredClone(draft.tints||{});delete tints[slot]?.[mat];
  const part=manifest()[draft.sex].parts.find(p=>p.slot===slot&&p.id===look()[slot]),short={body:'top',legs:'bottom',feet:'shoes'}[slot];
  setDraft({tints,...(short&&primaryCloth(part,draft.sex)===mat?{[short]:''}:{})});
 }
 form.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.paint){paint(t.dataset.paint,t.dataset.mat,t.value);t.parentElement.style.background=t.value;return;}
  if(t.dataset.set){setDraft({[t.dataset.set]:t.value});return;}
  if(t.name==='height'||t.name==='build'){setDraft({[t.name]:Number(t.value)});t.previousElementSibling.querySelector('output').textContent=Math.round(t.value*100)+'%';return;}
  if(t.name==='name')draft={...draft,name:t.value};
 });
 form.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.paint||t.dataset.set){render();return;}
  if(t.name==='sex'){setDraft({sex:t.value,head:'',body:'',legs:'',feet:'',acc:'',tints:{}},{parts:true});render();return;}
  if(t.name==='preset'){const l=system.lookOf?.(t.value);if(!l)return;setDraft({head:l.head,body:l.body,legs:l.legs,feet:l.feet,acc:l.acc,skin:l.skin,hair:l.hair,top:l.top,bottom:l.bottom,shoes:l.shoes,tints:l.tints||{}},{parts:true});render();return;}
  if(t.name==='rosterSlot'){try{roster=selectCharacter(roster,t.value);loadProfile(activeCharacter(roster));refreshSlots();status.textContent='Personagem selecionado. Salve para usá-lo no jogo.';}catch(err){status.textContent=String(err.message||err);}}
 });
 $('#cas-random').addEventListener('click',()=>{
  const pick=a=>a[Math.floor(Math.random()*a.length)],next={tints:{}};
  for(const slot of ['head','body','legs','feet'])next[slot]=pick(parts(slot)).id;
  next.skin=pick(CAS_COLORS.skin);next.hair=Math.random()<.75?pick(CAS_COLORS.hair):'';
  for(const k of ['top','bottom','shoes'])next[k]=Math.random()<.6?pick(QUICK):'';
  setDraft(next,{parts:true});render();
 });
 $('#cas-new-character').addEventListener('click',()=>{
  try{roster=addCharacter(roster,{...CAS_DEFAULT,name:'Novo personagem',sex:draft.sex});refreshSlots();loadProfile(activeCharacter(roster));status.textContent='Novo personagem. Salve para confirmar.';}
  catch(err){status.textContent=String(err.message||err);}
 });
 $('#cas-delete-character').addEventListener('click',()=>{
  if((roster?.characters.length||0)<=1)return;
  const cur=roster.characters.find(x=>x.id===roster.activeId);
  if(!confirm('Excluir '+(cur?.profile.name||'personagem')+' deste navegador? A exclusão vale quando você salvar.'))return;
  roster=deleteCharacter(roster,roster.activeId);refreshSlots();loadProfile(activeCharacter(roster));status.textContent='Personagem excluído do rascunho. Salve para confirmar.';
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();const save=$('#cas-save');if(save.disabled)return;
  save.disabled=true;status.textContent='Salvando…';
  try{
   const selected=normalizeCAS({...draft,name:form.elements.name.value||draft.name,look:''});
   await system.applyCAS(selected);
   try{roster=updateCharacter(roster,selected);persistRoster(safeStorage(),roster);}catch{status.textContent='Visual aplicado, mas não foi possível gravar no navegador.';return;}
   status.textContent='Personagem salvo!';close();
  }catch(err){status.textContent='Falha ao aplicar: '+String(err.message||err);}
  finally{save.disabled=false;}
 });
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,angle:spin};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(drag)spin=drag.angle+(e.clientX-drag.x)*.012;});
 canvas.addEventListener('pointerup',()=>{drag=null;});
 canvas.addEventListener('pointercancel',()=>{drag=null;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(1.4,Math.min(6,zoom+Math.sign(e.deltaY)*.25));},{passive:false});
 window.addEventListener('resize',resize);
 system.openCreator=open;
 system.casStorageKey='cityofgod.cas.v1';
 system.casRosterKey='cityofgod.cas.roster.v1';
}
