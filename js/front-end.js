// Title, genuine runtime loading, pause and local continuity. No online endpoints.
(function(){
 'use strict';
 const S=window.CityFrontState,root=document.getElementById('city-front'),MENU_ASSETS='assets/menu/v1/';
 const tips=['Entre em uma residência sua e use F7 para decorar.','F8 abre os pets. Chame um companheiro para passear pela cidade.','J abre as missões e acontecimentos da cidade.','P abre o celular. M mostra o mapa da cidade.','Aproxime-se de um veículo e pressione F para entrar.','Use Q e E para girar a câmera e a roda do mouse para aproximar.'];
 const memory=new Map(),fallback={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k),key:i=>[...memory.keys()][i],get length(){return memory.size;}};
 let storage;try{storage=window.localStorage;}catch{storage=fallback;}
 // Captura o progresso ANTES de criar a vitrine. Os módulos da cidade podem persistir dados ao inicializar.
 const hadProgressOnEntry=S.hasProgress(storage);
 let settings=S.settings(S.read(storage,S.SETTINGS));
 if(!S.read(storage,S.SETTINGS))settings.reducedMotion=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 // uma vez só: placa de vídeo fraca começa no perfil leve (Qualidade 3D "Desempenho" e contorno "Desempenho");
 // o jogador pode mudar depois em Vídeo e a escolha dele fica
 if(!settings.perfTuned){
  try{const gl=document.createElement('canvas').getContext('webgl2'),e=gl?.getExtension('WEBGL_debug_renderer_info'),name=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER);
   if(!gl||S.weakGPU(name)){settings.quality='low';settings.inkQuality='performance';}
   gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
  settings.perfTuned=true;try{storage.setItem(S.SETTINGS,JSON.stringify(settings));}catch{}
 }
 let phase='title',parent='title',tab='video',runtime=false,started=false,game=null,pending=null,frameReady=false,loadingError=null,rotation=null,music=null,startKind='new',casIntroShown=false;
 // vitrine: no menu inicial o jogo carrega em silêncio por trás e, pronto, a cidade viva aparece no fundo (drone em game.js)
 let quiet=false,quietReady=false,live=false,previewError='',menuLoadQueued=false,entering=false;
 let load={art:0,code:0,world:0,vehicle:0,characters:0,frame:0},status='Preparando a cidade',savingError='',audio=null,restoring=Promise.resolve(),musicConnected=false;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const blocked=()=>phase!=='playing';
 function sound(){
  // motor de som do jogo (js/city-audio.js): trilha bossa/lo-fi generativa e sons da interface
  if(window.CityAudio){window.CityAudio.unlock();updateVolume();return;}
  try{
   if(!audio){
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
    audio=new Context();const count=Math.floor(audio.sampleRate*12),buffer=audio.createBuffer(1,count,audio.sampleRate),data=buffer.getChannelData(0);
    const chords=[[130.81,164.81,196],[110,138.59,164.81],[116.54,146.83,174.61],[98,123.47,146.83]];
    for(let i=0;i<count;i++){
     const t=i/audio.sampleRate,chord=chords[Math.floor(t/3)%4],beat=(t%.75)/.75,edge=Math.min(1,t/.12,(12-t)/.12);
     data[i]=edge*(Math.sin(t*Math.PI*chord[0])*.055+chord.reduce((v,f,j)=>v+Math.sin(2*Math.PI*f*t)*Math.exp(-beat*5)*(j===0?.08:.045),0));
    }
    music=audio.createGain();music.gain.value=0;const source=audio.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(music);source.start();
   }
   audio.resume().catch(()=>{});updateVolume();
  }catch{}
 }
 function updateVolume(){
  const audible=!document.hidden&&phase!=='playing'&&phase!=='pause'&&parent!=='pause';
  if(window.CityAudio){window.CityAudio.menuMusic(audible);return;}
  if(!music||!audio)return;
  music.gain.cancelScheduledValues(audio.currentTime);
  music.gain.setValueAtTime(audible?settings.master*settings.music:0,audio.currentTime);
  if(audible&&!musicConnected){music.connect(audio.destination);musicConnected=true;}
  else if(!audible&&musicConnected){music.disconnect();musicConnected=false;}
 }
 function clickSound(){
  if(window.CityAudio){sound();window.CityAudio.ui('click');return;}
  sound();if(!audio||settings.effects*settings.master===0)return;
  const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
  oscillator.type='sine';oscillator.frequency.setValueAtTime(440,now);oscillator.frequency.exponentialRampToValueAtTime(280,now+.045);
  gain.gain.setValueAtTime(settings.master*settings.effects*.035,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.07);
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(now+.075);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
 }
 // aparência da interface: claro, escuro ou seguindo o sistema; HUD discreta (só o essencial) ou completa
 const darkQuery=window.matchMedia?.('(prefers-color-scheme: dark)');
 function applyTheme(){
  const html=document.documentElement,theme=settings.theme==='auto'?(darkQuery?.matches?'dark':'light'):settings.theme;
  html.dataset.uiTheme=theme;html.dataset.hud=settings.hud;
  window.dispatchEvent(new CustomEvent('city-ui-theme',{detail:{theme,hud:settings.hud}}));
 }
 darkQuery?.addEventListener?.('change',()=>{if(settings.theme==='auto')applyTheme();});
 function applySettings(){
  applyTheme();
  document.documentElement.style.setProperty('--city-brightness',String(settings.brightness));
  document.body.classList.toggle('front-reduced-motion',settings.reducedMotion);updateVolume();
  window.cityVehicles?.applyQuality?.(settings.quality);
  window.cityVehicles?.applyInk?.(settings);   // URBAN INK — CARTOON ou estilo original (urban-ink.mjs)
  window.dispatchEvent(new CustomEvent('city-front-settings',{detail:{...settings}}));
 }
 function release(){game?.release?.();window.cityVehicleBridge?.releaseControls?.();if(window.__game?.player){window.__game.player.wantShot=false;window.__game.player.aiming=false;}}
 function inert(){for(const el of document.body.children)if(el!==root&&!['SCRIPT','TEMPLATE','STYLE'].includes(el.tagName))el.inert=blocked();}
 function change(next){phase=next;document.body.classList.toggle('front-open',blocked());document.body.classList.toggle('city-modal',!!(window.CityUI?.phoneOpen||window.CityUI?.wheelOpen));root.hidden=!blocked();root.setAttribute('aria-busy',String(next==='loading'));inert();release();updateVolume();if(next==='title')queueMenuWorld();}
 function queueMenuWorld(){
  if(menuLoadQueued||runtime||phase!=='title')return;
  menuLoadQueued=true;setTimeout(()=>{menuLoadQueued=false;if(phase==='title'&&!runtime)start(hadProgressOnEntry,{quiet:true});},80);
 }
 function otherModal(){return !!(window.CityDesk?.open||window.CityCommerce?.open||window.CityPets?.uiOpen||window.CityHomeUI?.active||window.CityRealty?.dialogOpen||window.CityStreetFood?.open||window.CityBus?.uiOpen||window.CityUI?.phoneOpen||window.CityUI?.wheelOpen||window.cityCharacterEditorOpen||game?.mapOpen?.()||window.cityCharacters?.socialPie?.active||document.querySelector('dialog:modal'));}   // leque social e diálogos modais (diário Y) tratam o próprio Esc
 function progress(){return Math.round(load.art*10+load.code*55+load.world*10+load.vehicle*10+load.characters*10+load.frame*5);}
 const back=()=>'<button class="front-back" data-front-action="back">← Voltar</button>';
 const top=()=>`<div class="front-top"><span>CITY OF GOD · ${parent==='pause'||phase==='pause'?'JOGO PAUSADO':'VIDA URBANA'} <span class="front-beta-mini">BETA · EM DESENVOLVIMENTO</span></span><button data-front-action="sound" aria-label="Ativar ou silenciar a música do menu">${settings.music===0?'SOM DESLIGADO':'♫ ÁUDIO'}</button></div>`;
 function panel(title,content){return `<section class="front-panel">${back()}<h1 tabindex="-1">${title}</h1>${content}</section>`;}
 function setting(key,label,help,type='range'){
  if(Array.isArray(type))return `<div class="front-setting"><div><label for="front-${key}">${label}</label><small>${help}</small></div><div class="front-choice" role="radiogroup" aria-label="${label}">${type.map(([value,text])=>`<button type="button" role="radio" aria-checked="${settings[key]===value}" data-front-choice="${key}" data-value="${value}">${text}</button>`).join('')}</div></div>`;
  if(type==='select')return `<div class="front-setting"><div><label for="front-${key}">${label}</label><small>${help}</small></div><select id="front-${key}" data-front-setting="${key}">${[['low','Desempenho'],['balanced','Equilibrada'],['high','Alta']].map(([value,text])=>`<option value="${value}" ${settings[key]===value?'selected':''}>${text}</option>`).join('')}</select></div>`;
  if(type==='checkbox')return `<div class="front-setting"><div><label for="front-${key}">${label}</label><small>${help}</small></div><input id="front-${key}" data-front-setting="${key}" type="checkbox" ${settings[key]?'checked':''}></div>`;
  const listen=type==='audio'?`<button type="button" class="front-listen" data-front-preview="${key}" aria-label="Ouvir ${label}">▶ Ouvir</button>`:'';
  return `<div class="front-setting"><div><label for="front-${key}">${label}</label><small>${help}</small></div><div class="front-range">${listen}<input id="front-${key}" data-front-setting="${key}" type="range" min="${key==='brightness'?75:0}" max="${key==='brightness'?130:100}" value="${Math.round(settings[key]*100)}"><output class="front-value" for="front-${key}" data-setting-output="${key}">${Math.round(settings[key]*100)}%</output></div></div>`;
 }
 function render(){
  let content='';
  if(phase==='title'||phase==='pause'){
   const pause=phase==='pause',canContinue=started||hadProgressOnEntry;
   content=`<main class="front-main"><img class="front-logo" src="${MENU_ASSETS}logo.webp" alt="City of God"><nav class="front-nav" aria-label="${pause?'Menu de pausa':'Menu inicial'}"><button data-front-action="continue" ${canContinue?'':'disabled'}>Continuar</button>${pause?'<button data-front-action="map">Mapa da cidade</button>':'<button data-front-action="new">Novo jogo</button>'}<button data-front-action="multiplayer">Multiplayer <small>EM BREVE</small></button><button data-front-action="settings">Configurações</button><button data-front-action="credits">Créditos</button>${pause?'<button data-front-action="title">Voltar ao início</button>':''}</nav></main>`;
  }else if(phase==='multiplayer')content=panel('Multiplayer',`<span class="front-coming">EM BREVE</span><h2>A cidade também vai ser ponto de encontro.</h2><p>Estamos preparando a opção de conectar você a outros jogadores para compartilhar a cidade.</p><p>Nesta versão, a partida e o progresso são locais. Ainda não há servidores, salas ou conexão online disponíveis.</p><div class="front-actions"><button class="front-action primary" data-front-action="back">Voltar ao menu</button></div>`);
  else if(phase==='settings'){
   const tabs=[['video','Vídeo'],['audio','Áudio'],['controls','Controles'],['interface','Interface']];
   let fields=tab==='video'?setting('quality','Qualidade 3D','Desempenho: 75% da resolução, sem sombras · Equilibrada: resolução da tela, sombras · Alta: imagem 1,5× mais nítida, sombras finas. Se a placa de vídeo não der conta, a resolução baixa sozinha e volta quando sobrar folga.','select')+setting('brightness','Brilho','Ajusta a imagem da cidade sem alterar a arte do menu.')+
     setting('ink','URBAN INK — CARTOON','Estilo gráfico da cidade: contorno preto, luz em faixas e cores chapadas. Desligado volta ao estilo original, para comparar. Personagens não mudam.','checkbox')+
     (settings.ink?setting('inkOutline','Contorno','Força do traço preto nas silhuetas e quinas.')+setting('inkThickness','Espessura do traço','De bem fino (menos de 1 px) a 2 px. O traço fica mais leve sozinho quando a câmera se afasta.')+
      setting('inkToon','Toon','Quanto a luz é separada em faixas chapadas (0 = luz suave original).')+setting('inkSaturation','Saturação','Cores mais vivas.')+setting('inkContrast','Contraste','Separação entre luz e sombra.')+
      setting('inkGround','Chão no estilo Urban Ink','Ligado: chão chapado com traço no meio-fio e calçada. Desligado: o chão original, com as texturas de antes.','checkbox')+
      setting('inkQuality','Qualidade do contorno','Desempenho: só as silhuetas, sem suavização. Equilibrada: suavização 4×, copas e quinas. Qualidade: também as bordas de tábuas e azulejos.',[['performance','Desempenho'],['balanced','Equilibrada'],['quality','Qualidade']]):''):
    tab==='audio'?setting('master','Volume geral','Todos os sons do jogo de uma vez.','audio')+setting('music','Música','Trilha do menu e o baile funk que toca ao longe na favela.','audio')+setting('ambient','Ambiente','Trânsito, vento, pássaros, grilos, cães e sirenes ao redor.','audio')+setting('effects','Efeitos','Tiros, batidas, motor e buzina do carro, passos e golpes.','audio')+setting('voices','Vozes','Conversas e gritos das pessoas na rua.','audio')+setting('interface','Interface','Cliques do menu, do celular e avisos.','audio')+
     `<div class="front-actions"><button type="button" class="front-action" data-front-audio="mute">${settings.master>0?'Silenciar tudo':'Reativar o som'}</button><button type="button" class="front-action" data-front-audio="reset">Restaurar padrão</button></div>`:
    tab==='interface'?setting('theme','Aparência','Claro: vidro leve e texto escuro. Escuro: vidro fumê e texto claro. Automático segue o tema do sistema.',[['light','Claro'],['dark','Escuro'],['auto','Automático']])+
     setting('hud','HUD','Discreta mostra só o essencial (minimapa, hora, dinheiro e necessidades que estão baixas). Completa mostra todas as barras sempre.',[['minimal','Discreta'],['full','Completa']])+
     setting('reducedMotion','Reduzir movimento','Desativa o movimento de fundo e transições do menu e deixa o tremor da câmera bem mais fraco.','checkbox')+
     setting('cameraFollow','Câmera acompanha a direção','Dirigindo, a câmera gira devagar para trás do carro (nunca em ré). A pé ela fica fixa e segue você, como no Zomboid. Girar na mão (Q/E) pausa por 4 s.','checkbox')+
     setting('cameraShake','Tremor da câmera','Batidas, tiros e dano. 0% desliga.'):
    `<div class="front-controls">${[['Andar','W A S D'],['Correr','Shift'],['Interagir / veículo','F'],['Mapa','M'],['Celular','P'],['Mochila','I'],['Câmera','Q / E'],['Zoom','Roda do mouse'],['Agachar','C'],['Saltar','Espaço'],['Decorar casa','F7'],['Pets','F8'],['Pausar / continuar','Esc']].map(([label,key])=>`<div><span>${label}</span><kbd>${key}</kbd></div>`).join('')}</div><p>Os atalhos exibidos correspondem aos controles atuais do jogo.</p>`;
   content=panel('Configurações',`<div class="front-tabs" role="tablist" aria-label="Categoria de configurações">${tabs.map(([id,label])=>`<button id="front-tab-${id}" role="tab" aria-selected="${tab===id}" aria-controls="front-setting-panel" data-front-tab="${id}">${label}</button>`).join('')}</div><div id="front-setting-panel" role="tabpanel" aria-labelledby="front-tab-${tab}">${fields}</div><p id="front-settings-message" role="status">As alterações são aplicadas agora e salvas neste navegador.</p>`);
  }else if(phase==='credits')content=panel('Créditos','<span class="front-eyebrow">CITY OF GOD</span><p>Uma cidade para dirigir, explorar, construir uma casa e viver o cotidiano.</p><h2>Identidade e abertura</h2><p>O logo original surge sobre uma imagem provisória até o mapa carregar. Depois, a câmera aérea observa a cidade real atrás dos botões. A abertura indica BETA e jogo em desenvolvimento.</p><h2>Animais</h2><p>Quaternius — modelos CC0.<br>Shar Pei — Artsiom Savelyeu, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> · <a href="https://sketchfab.com/3d-models/free-shar-pei-animated-dog-ed151fd59a894b3290d9eee3f716f0bf" target="_blank" rel="noopener">Fonte ↗</a><br>Benny, the Rottweiler — umask007, <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a> · <a href="https://opengameart.org/content/benny-the-rottweiler" target="_blank" rel="noopener">Fonte ↗</a></p><h2>Modelos e recursos</h2><p><a href="vehicle-credits.html" target="_blank" rel="noopener">Créditos dos veículos 3D ↗</a><br><a href="character-credits.html" target="_blank" rel="noopener">Créditos dos personagens ↗</a></p>');
  else if(phase==='new-confirm')content=panel('Começar de novo?',`<p>Um novo jogo substitui o progresso local atual: dinheiro, inventário, casas, veículos e pets.</p><p>Antes de substituir, vamos guardar uma cópia do progresso neste navegador. Suas configurações serão mantidas.</p><div class="front-actions"><button class="front-action" data-front-action="back">Manter meu progresso</button><button class="front-action primary" data-front-action="confirm-new">Iniciar novo jogo</button></div><p id="front-confirm-error" class="front-error" role="alert"></p>`);
  else if(phase==='loading')content=`<section class="front-loading"><span class="front-eyebrow">MODO LOCAL</span><h1>A cidade está ganhando vida.</h1><div class="front-meter" role="progressbar" aria-label="Carregamento do jogo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress()}"><span style="width:${progress()}%"></span></div><div class="front-load-status"><span id="front-load-label" role="status">${esc(status)}</span><span id="front-percent">${progress()}%</span></div><p class="front-tip" id="front-tip">${tips[0]}</p></section>`;
  else if(phase==='error')content=panel('A cidade ainda não abriu.',`<p class="front-error" role="alert">${esc(loadingError||'Não foi possível completar o carregamento.')}</p><p>Seu progresso salvo foi preservado. Verifique a conexão e tente carregar novamente.</p><div class="front-actions"><button class="front-action primary" data-front-action="retry">Tentar novamente</button><button class="front-action" data-front-action="title">Menu inicial</button></div>`);
  root.innerHTML=`<div id="front-backdrop" aria-hidden="true"><img class="front-preview-art" src="${MENU_ASSETS}avenida-noturna.webp" alt=""><div class="front-preview-brand"><img class="front-preview-logo" src="${MENU_ASSETS}logo.webp" alt=""><span class="front-beta-chip">BETA</span><p>JOGO EM DESENVOLVIMENTO</p><small>Preparando a cidade viva...</small></div></div>${top()}${content}<footer class="front-foot">${phase==='loading'?'<span>Preparando os recursos da cidade</span>':`<span><kbd>${phase==='title'?'↑ ↓':'ESC'}</kbd>${phase==='title'?'Escolher · Enter confirmar':'Voltar'}</span>`}<span data-front-status>${phase==='loading'?'CARREGAMENTO REAL':savingError||(phase==='title'?(live?'CIDADE VIVA · MODO LOCAL':previewError?'PRÉVIA INDISPONÍVEL · VOCÊ AINDA PODE JOGAR':'PREPARANDO CIDADE VIVA · MODO LOCAL'):'MODO LOCAL · MULTIPLAYER EM BREVE')}</span></footer>`;
  if(phase==='title'||phase==='pause')root.querySelector('.front-nav button:not(:disabled)')?.focus();
  else if(phase!=='loading')root.querySelector('h1')?.focus();
 }
 function open(page){if(page==='settings'||page==='credits'||page==='multiplayer'||page==='new-confirm')parent=phase==='pause'?'pause':phase==='title'?'title':parent;change(page);render();}
 function backPage(){if(phase==='pause')enter();else if(phase!=='loading'){change(parent==='pause'&&started?'pause':'title');render();}}
 function checkpoint(){
  if(!started||!game)return;
  savingError='';
  // A subsystem failure must not prevent the independent position checkpoint.
  try{const point=S.checkpoint(game.capture?.());if(point)storage.setItem(S.SAVE,JSON.stringify(point));}catch{savingError='Não foi possível salvar neste navegador';}
  try{game.save?.();}catch{savingError='Parte do progresso não pôde ser salva neste navegador';}
 }
 function resumeSession(active){try{if(active)sessionStorage.setItem('cityofgod.front.resume','1');else sessionStorage.removeItem('cityofgod.front.resume');}catch{}}
 function finishEnter(){
  clearInterval(rotation);quiet=false;parent='title';change('playing');started=true;resumeSession(true);release();
  document.getElementById('view')?.focus();checkpoint();
  if(!casIntroShown&&window.cityCharacters?.provider==='cas'){
   casIntroShown=true;let saved=false;try{saved=!!storage.getItem('cityofgod.cas.v1');}catch{}
   if(!saved)window.cityCharacters.openCreator?.();
  }
 }
 function enter(){
  if(entering)return;
  // O drone pode estar no centro, longe do save: preparar antes de devolver o controle.
  if(game?.needsPlayerSector?.()){
   entering=true;status='Voltando à região do personagem';load.world=0;
   live=false;document.body.classList.remove('front-live');change('loading');render();paintProgress();
   Promise.resolve(game.preparePlay?.()).then(()=>{
    entering=false;load.world=1;finishEnter();
   }).catch(error=>{entering=false;fail(error?.message||'Não foi possível preparar a região salva.');});
   return;
  }
  finishEnter();
 }
 function fail(message){clearInterval(rotation);if(quiet&&phase!=='loading'){quiet=false;quietReady=false;live=false;document.body.classList.remove('front-live');previewError=String(message||'Falha ao preparar a cidade');render();return;} // falha da vitrine não substitui a tela inicial nem perde o save
  loadingError=message;change('error');render();}
 function paintProgress(){
  const percent=progress(),meter=root.querySelector('[role=progressbar]');if(!meter)return;
  meter.setAttribute('aria-valuenow',String(percent));meter.querySelector('span').style.width=percent+'%';root.querySelector('#front-percent').textContent=percent+'%';root.querySelector('#front-load-label').textContent=status;
 }
 function sessionIntent(value){try{sessionStorage.setItem('cityofgod.front.intent',value);return true;}catch{return false;}}
 function newGame(){
  // vitrine carregando/carregada sem progresso salvo: o jogo novo já é este
  if(runtime&&quiet&&startKind==='new'){quiet=false;if(quietReady)enter();else{change('loading');render();paintProgress();}return;}
  if(runtime){if(!sessionIntent('new')){root.querySelector('#front-confirm-error').textContent='O navegador não permitiu preparar a nova partida. O progresso atual foi mantido.';return;}location.reload();return;}
  try{if(S.hasProgress(storage))S.backupAndReset(storage);}catch{const el=root.querySelector('#front-confirm-error');if(el)el.textContent='Não foi possível guardar a cópia de segurança. O progresso atual foi mantido.';return;}
  start(false);
 }
 async function start(continuing,opts={}){
  if(started&&runtime){enter();return;}
  // vitrine já carregando o mesmo tipo de partida: só mostra o progresso (ou entra, se já terminou)
  if(runtime&&quiet&&startKind===(continuing?'continue':'new')){quiet=false;if(quietReady)enter();else{change('loading');render();paintProgress();}return;}
  if(runtime){if(sessionIntent(continuing?'continue':'new'))location.reload();return;}
  startKind=continuing?'continue':'new';
  pending=continuing?S.checkpoint(S.read(storage,S.SAVE)):null;
  if(pending){
   const url=new URL(location.href),local=url.searchParams.has('seed')||url.searchParams.has('scene');
   if(pending.mode==='local'&&(!local||Number(url.searchParams.get('seed'))!==pending.seed)){if(opts.quiet){pending=null;previewError='O save usa outro mapa; clique em Continuar para carregá-lo.';render();return;}url.searchParams.delete('scene');url.searchParams.set('seed',String(pending.seed));if(sessionIntent('continue')){location.assign(url.href);return;}}
   if(pending.mode==='open'&&local){if(opts.quiet){pending=null;previewError='O save usa outro mapa; clique em Continuar para carregá-lo.';render();return;}url.searchParams.delete('seed');url.searchParams.delete('scene');if(sessionIntent('continue')){location.assign(url.href);return;}}
  }
  quiet=!!opts.quiet;quietReady=false;
  runtime=true;frameReady=false;load={art:1,code:0,world:0,vehicle:0,characters:0,frame:0};status='Preparando os sistemas da cidade';if(!quiet){change('loading');render();}
  const scripts=[...document.getElementById('city-runtime').content.querySelectorAll('script[src]')];
  // Download in parallel; classic globals still execute in dependency order.
  for(const source of scripts){const link=document.createElement('link');link.rel=source.type==='module'?'modulepreload':'preload';if(source.type!=='module')link.as='script';link.href=source.src;document.head.append(link);}
  let slide=0;rotation=setInterval(()=>{
   if(phase!=='loading')return;
   const tip=root.querySelector('#front-tip');if(tip)tip.textContent=tips[++slide%tips.length];
  },6500);
  try{
   for(const [i,source] of scripts.entries()){
    status=source.src.includes('game.js')?'Construindo a cidade':'Carregando os sistemas do jogo';paintProgress();
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=source.src;script.async=false;if(source.type)script.type=source.type;const timeout=source.type==='module'?90000:45000;
     const timer=setTimeout(()=>reject(Error('O arquivo '+source.src.split('/').pop()+' demorou mais que '+Math.round(timeout/1000)+' segundos. Verifique a conexão e tente novamente.')),timeout);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);reject(Error('Não foi possível carregar os arquivos do jogo.'));};document.body.append(script);});
    if(phase==='error')return;load.code=(i+1)/scripts.length;paintProgress();inert();
   }
   if(new URLSearchParams(location.search).has('scene')){const script=document.createElement('script');script.src='js/debug.js';document.body.append(script);}
   await restoring;
   const begin=performance.now();
   await new Promise((resolve,reject)=>{
    const poll=()=>{
     if(phase==='error'){reject(Error(loadingError));return;}
     const vehicle=window.cityVehicles,characters=window.cityCharacters;
     if(vehicle?.status==='failed'||characters?.status==='failed'){reject(Error('Não foi possível carregar os modelos 3D. Tente novamente.'));return;}
     load.world=game?1:0;load.vehicle=vehicle?.ready?1:0;load.characters=characters?.ready||characters?.status==='disabled'?1:0;load.frame=frameReady&&load.vehicle&&load.characters?1:0;
     status=!game?'Preparando a cidade':!load.vehicle?'Carregando veículos e cenários':!load.characters?'Carregando personagens':'Preparando o primeiro quadro';paintProgress();
     if(Object.values(load).every(v=>v===1)){resolve();return;}
     if(performance.now()-begin>60000){reject(Error('O carregamento demorou mais que o esperado. Verifique a conexão e tente novamente.'));return;}
     requestAnimationFrame(poll);
    };poll();
   });
   if(pending?.vehicle&&await window.cityVehicles?.restoreCheckpoint?.(pending.vehicle,pending)===false)throw Error('Não foi possível restaurar seu veículo. O salvamento foi preservado.');
   pending=null;
   if(quiet&&phase!=='loading'){quietReady=true;render();return;}   // vitrine pronta: o mundo segue vivo atrás da tela de título
   enter();
  }catch(error){fail(error.message||'Não foi possível carregar a cidade.');}
 }
 const api={get phase(){return phase;},get blocked(){return blocked()||document.hidden;},get loading(){return phase==='loading'||(quiet&&!quietReady&&!!game);},get settings(){return {...settings};},get effectsVolume(){return settings.effects*settings.master;},applySettings,
  attachGame(value){game=value;restoring=Promise.resolve(pending?game.restore?.(pending):true).then(ok=>{if(ok===false)throw Error('Não foi possível restaurar sua posição. O salvamento foi preservado.');load.world=1;});restoring.catch(()=>{});applySettings();},markFrame(){if(window.cityVehicles?.ready&&(window.cityCharacters?.ready||window.cityCharacters?.status==='disabled'))frameReady=true;},
  // primeiro quadro completo da cidade: a ilustração some e o fundo do menu vira o jogo rodando
  markLive(){if(!live&&!entering&&frameReady&&game&&game.previewReady?.()!==false){live=true;document.body.classList.add('front-live');const el=root.querySelector('[data-front-status]');if(el)el.textContent='CIDADE VIVA · BETA';}},
  get showcase(){return phase!=='playing'&&phase!=='loading'&&!!game&&!(quiet&&!quietReady);},
  pause(){if(phase==='playing'&&!otherModal()){parent='pause';checkpoint();open('pause');}},save:checkpoint};
 window.CityFront=api;
 root.addEventListener('pointermove',()=>document.body.classList.remove('front-keyboard'));
 root.addEventListener('click',e=>{
  const item=e.target.closest('[data-front-action]');if(!item)return;clickSound();const action=item.dataset.frontAction;
  if(action==='continue')start(true);else if(action==='new'){if(hadProgressOnEntry||started)open('new-confirm');else newGame();}
  else if(action==='confirm-new'){resumeSession(false);newGame();}else if(action==='back')backPage();else if(action==='title'){checkpoint();resumeSession(false);parent='title';open('title');}
  else if(action==='retry'){if(sessionIntent(startKind==='new'?'retry-new':'continue'))location.reload();}
  else if(action==='map'){enter();game?.openMap?.();}else if(action==='sound'){settings.music=settings.music===0?.35:0;persistSettings();render();}
  else open(action);
 });
 // áudio: ouvir cada canal, silenciar tudo e restaurar o padrão
 root.addEventListener('click',e=>{
  const pv=e.target.closest('[data-front-preview]');if(pv){window.CityAudio?.preview?.(pv.dataset.frontPreview);return;}
  const a=e.target.closest('[data-front-audio]');if(!a)return;
  if(a.dataset.frontAudio==='mute'){if(settings.master>0){root.dataset.lastMaster=settings.master;settings.master=0;}else settings.master=Number(root.dataset.lastMaster)||S.defaults.master;}
  else for(const k of ['master','music','ambient','effects','voices','interface'])settings[k]=S.defaults[k];
  persistSettings();render();root.querySelector(`[data-front-audio="${a.dataset.frontAudio}"]`)?.focus();clickSound();
 });
 root.addEventListener('click',e=>{const item=e.target.closest('[data-front-tab]');if(item){clickSound();tab=item.dataset.frontTab;render();root.querySelector('#front-tab-'+tab)?.focus();}});
 function persistSettings(){settings=S.settings(settings);try{storage.setItem(S.SETTINGS,JSON.stringify(settings));}catch{const el=root.querySelector('#front-settings-message');if(el)el.textContent='As alterações foram aplicadas, mas o navegador não permitiu salvá-las.';}applySettings();}
 root.addEventListener('input',e=>{const key=e.target.dataset.frontSetting;if(!key||key==='quality')return;settings[key]=e.target.type==='checkbox'?e.target.checked:Number(e.target.value)/100;const out=root.querySelector(`[data-setting-output="${key}"]`);if(out)out.textContent=Math.round(settings[key]*100)+'%';persistSettings();if(key==='ink'){render();root.querySelector('#front-ink')?.focus();}});
 root.addEventListener('change',e=>{if(e.target.dataset.frontSetting==='quality'){settings.quality=e.target.value;persistSettings();}});
 root.addEventListener('click',e=>{const b=e.target.closest('[data-front-choice]');if(!b)return;const key=b.dataset.frontChoice;settings[key]=b.dataset.value;
  for(const x of root.querySelectorAll('[data-front-choice="'+key+'"]'))x.setAttribute('aria-checked',String(x===b));clickSound();persistSettings();});
 window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(['ArrowDown','ArrowUp','Tab','Enter','Escape'].includes(e.key))document.body.classList.add('front-keyboard');
  if(!blocked()){if(e.key==='Escape'&&!otherModal()&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();clickSound();api.pause();}return;}
  e.stopImmediatePropagation();
  if(e.key==='Escape'){e.preventDefault();if(phase!=='loading')backPage();return;}
  if(e.key==='Tab'){
   const targets=[...root.querySelectorAll('button:not(:disabled),a,input,select')],i=targets.indexOf(document.activeElement);
   if(!targets.length){e.preventDefault();return;}
   if(e.shiftKey&&(i<=0)||!e.shiftKey&&(i<0||i===targets.length-1)){e.preventDefault();targets[e.shiftKey?targets.length-1:0].focus();}return;
  }
  if(['ArrowDown','ArrowUp'].includes(e.key)&&document.activeElement?.closest('.front-nav')){
   e.preventDefault();const buttons=[...root.querySelectorAll('.front-nav button:not(:disabled)')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();clickSound();
  }else if(['ArrowRight','ArrowLeft'].includes(e.key)&&document.activeElement?.matches('[role=tab]')){
   e.preventDefault();const buttons=[...root.querySelectorAll('[role=tab]')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowRight'?1:buttons.length-1))%buttons.length]?.click();
  }
 },true);
 window.addEventListener('keyup',e=>{if(blocked())e.stopImmediatePropagation();},true);
 window.addEventListener('error',e=>{if(phase==='loading'&&e.error)fail('Ocorreu um erro ao preparar a cidade. Tente carregar novamente.');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){checkpoint();release();}updateVolume();});
 window.addEventListener('blur',()=>{checkpoint();release();});
 window.addEventListener('pagehide',()=>{checkpoint();audio?.suspend().catch(()=>{});});
 window.addEventListener('pageshow',()=>{release();updateVolume();if(audio?.state==='suspended')audio.resume().catch(()=>{});});
 setInterval(()=>{if(phase==='playing'&&!document.hidden)checkpoint();},3000);
 new MutationObserver(()=>inert()).observe(document.body,{childList:true});
 document.body.classList.add('front-keyboard');change('title');applySettings();render();
 let intent=null;try{intent=sessionStorage.getItem('cityofgod.front.intent');sessionStorage.removeItem('cityofgod.front.intent');}catch{}
 if(intent==='new'){try{if(S.hasProgress(storage))S.backupAndReset(storage);start(false);}catch{fail('Não foi possível guardar a cópia de segurança do progresso.');}}
 else if(intent==='continue')start(true);
 else if(intent==='retry-new')start(false);
 else {let resumed=false;try{if(sessionStorage.getItem('cityofgod.front.resume')==='1'&&S.checkpoint(S.read(storage,S.SAVE))){resumed=true;start(true);}}catch{}
  // menu inicial: começa a carregar a cidade por trás (partida salva, se houver) p/ o fundo virar o jogo ao vivo
  if(!resumed)queueMenuWorld();}
})();
