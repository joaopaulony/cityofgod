// City of God · televisions with YouTube and real Brazilian car radio.
// Media is decoded by each browser; the optional relay synchronizes playback
// state, never retransmits copyrighted audio/video.
'use strict';
const CityMedia=(()=>{
 const C=window.CityMediaCore;
 const CONFIG='cityofgod.media.config.v1',STATE='cityofgod.media.tvs.v1';
 const stations=C.STATIONS;
 const tvs=new Map(),radios=new Map();
 const peers={connected:false,count:1,error:'',mode:'local'};
 let state={roomCode:'',relay:'',station:stations[0].id,radioOn:false,volume:.38};
 let started=false,dialog=null,radioUI=null,screenEl=null,radioAudio=null;
 let active=null,videoPlayer=null,videoReady=false,videoID=null,playerLoading=false;
 let connection=null,channel=null,lastRender=0,lastCar=false,radioVehicle=null;
 let visibleScreen=null;
 let expanded={open:false,screen:null,room:null,house:null,player:null,ready:false,video:null,lastSync:0};
 let remoteRadio=null,remoteStation=null,remoteOn=false,radioCurrent=null,lastSend=0;
 const notify=s=>window.CityUI?.notify?.(s);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const getPlayer=()=>window.__game?.player||null;
 const driver=()=>!!window.cityVehicles?.driver;
 const inMenu=()=>!!window.CityFront?.blocked||document.body.classList.contains('front-open');
 const houseKey=H=>window.CityHome?.key?.(H)||('house:'+H?.x0+':'+H?.y0);
 const getRoom=(H,p)=>C.roomAt(H,p.floor||0,p.x,p.y,window.CityHomePlus?.roomAt);
 const recordKey=(H,item)=>C.screenId(item,H,houseKey(H));
 const safeAudio=()=>{if(!radioAudio){radioAudio=new Audio();radioAudio.preload='none';radioAudio.crossOrigin='anonymous';radioAudio.addEventListener('error',()=>{if(radioAudio&&radioAudio.src)notify('Esta rádio está fora do ar. Troque de estação.');});}return radioAudio;};
 function load(){
  try{
   const a=JSON.parse(localStorage.getItem(CONFIG)||'{}');
   if(typeof a.station==='string'&&stations.some(s=>s.id===a.station))state.station=a.station;
   if(Number.isFinite(a.volume))state.volume=Math.min(1,Math.max(0,a.volume));
   state.radioOn=!!a.radioOn;
   if(typeof a.roomCode==='string'&&/^[a-zA-Z0-9_-]{12,100}$/.test(a.roomCode))state.roomCode=a.roomCode;
   state.relay=C.cleanWS(a.relay)||C.cleanWS(window.CITY_MEDIA_RELAY_URL)||'';
   const cached=JSON.parse(localStorage.getItem(STATE)||'{}');
   for(const item of Object.values(cached||{})){
    const clean=C.safeState(item);
    if(clean)tvs.set(clean.screen,clean);
   }
  }catch{}
  if(!state.roomCode){state.roomCode='solo-'+crypto.randomUUID().replaceAll('-','');persist();}
 }
 function persist(){
  try{localStorage.setItem(CONFIG,JSON.stringify(state));}catch{}
 }
 function saveTV(){
  try{const data=Object.fromEntries([...tvs].slice(-120));localStorage.setItem(STATE,JSON.stringify(data));}catch{}
 }
 const currentStation=()=>stations.find(s=>s.id===state.station)||stations[0];
 function ingest(m,fromServer=false){
  if(!m||typeof m!=='object')return;
  if(m.type==='snapshot'){
   peers.count=m.peers||1;
   for(const tv of m.tvs||[])ingest(tv,true);
   for(const radio of m.radios||[])ingest(radio,true);
   return;
  }
  if(m.type==='peers'){peers.count=m.count||1;renderRadio();return;}
  if(m.type==='tv'){
   const record=C.safeState(m);
   if(!record)return;
   const previous=tvs.get(record.screen);
   if(previous&&previous.at>record.at+1000)return;
   tvs.set(record.screen,record);saveTV();
   if(active?.screen===record.screen){
    syncVideo(record);
    if(dialog&&!dialog.hidden)syncDialog(); // enable "Assistir em tela grande" immediately after video starts
   }
   if(expanded.open&&expanded.screen===record.screen){
    if(!record.playing||!record.video)closeExpanded();else syncExpanded(record,true);
   }
   return;
  }
  if(m.type==='radio'&&typeof m.vehicle==='string'&&stations.some(s=>s.id===m.station)){
   if(m.playing)radios.set(m.vehicle,{...m,at:Number.isFinite(m.at)?m.at:Date.now()});else radios.delete(m.vehicle);return;
  }
 }
 function transmit(message){
  channel?.postMessage(message);
  if(connection?.readyState===WebSocket.OPEN)try{connection.send(JSON.stringify(message));}catch{}
 }
 function connect(){
  if(connection){try{connection.close();}catch{}connection=null;}
  peers.connected=false;peers.mode='local';peers.count=1;peers.error='';
  if(!state.relay){renderRadio();return;}
  try{
   const url=new URL(state.relay);
   url.pathname='/ws';url.searchParams.set('room',state.roomCode);
   const ws=new WebSocket(url);
   connection=ws;peers.mode='connecting';
   ws.addEventListener('open',()=>{if(connection!==ws)return;peers.connected=true;peers.mode='online';peers.error='';renderRadio();});
   ws.addEventListener('message',e=>{if(connection!==ws)return;try{ingest(JSON.parse(e.data),true);}catch{}});
   ws.addEventListener('close',()=>{if(connection!==ws)return;peers.connected=false;peers.mode='local';renderRadio();});
   ws.addEventListener('error',()=>{if(connection===ws)peers.error='Servidor de mídia indisponível';});
  }catch{peers.error='Endereço de servidor inválido';}
 }
 function resetChannel(){
  channel?.close();channel=null;
  if(typeof BroadcastChannel!=='undefined'){
   channel=new BroadcastChannel('cityofgod-media:'+state.roomCode);
   channel.onmessage=e=>ingest(e.data);
  }
  connect();
 }
 function setRoom(code,relay=state.relay){
  if(!/^[a-zA-Z0-9_-]{12,100}$/.test(code||''))return false;
  const ws=C.cleanWS(relay);
  if(relay&&!ws)return false;
  if(state.roomCode!==code){tvs.clear();radios.clear();saveTV();muteVideo(true);videoID=null;}
  state.roomCode=code;state.relay=ws;persist();resetChannel();return true;
 }
 function ensure(){
  if(started)return;started=true;load();
  document.body.insertAdjacentHTML('beforeend',`
    <div id="cog-tv-screen" aria-label="Tela da televisão do jogo"></div>
    <div id="cog-media-dialog" hidden role="dialog" aria-modal="true" aria-label="Central de mídia">
      <section class="cog-media-card"><button type="button" data-cm="close" class="cog-media-close" aria-label="Fechar">✕</button>
        <div class="cog-media-tag">CITY OF GOD · MÍDIA</div>
        <h2>📺 Televisão YouTube</h2><p id="cog-media-room"></p>
        <label>Link do YouTube<input id="cog-media-link" type="url" maxlength="2048" placeholder="https://www.youtube.com/watch?v=..." spellcheck="false"></label>
        <div class="cog-media-actions">
          <button data-cm="play">▶ Reproduzir</button><button data-cm="stop">■ Desligar</button>
          <button data-cm="audio">🔊 Ativar áudio</button><button data-cm="expand">▣ Assistir em tela grande</button>
        </div>
        <p id="cog-media-status" role="status">Cole um link e clique em Reproduzir.</p>
        <details><summary>Multiplayer · sala compartilhada</summary>
          <label>Código da sala<input id="cog-media-code" maxlength="100" autocomplete="off" spellcheck="false"></label>
          <label>Servidor WebSocket (opcional)<input id="cog-media-server" placeholder="wss://seu-servidor.railway.app" spellcheck="false"></label>
          <div class="cog-media-actions"><button data-cm="connect">Conectar sala</button><button data-cm="new-room">Criar código</button><button data-cm="copy-room">Copiar convite</button></div>
          <p id="cog-media-peers"></p><small>Na mesma sala, todos recebem o vídeo e o horário. O áudio só toca para quem está no cômodo. Sem servidor, sincroniza somente outras abas do mesmo navegador.</small>
        </details>
        <small>Vídeos podem bloquear incorporação, som automático ou reprodução em segundo plano por regras do YouTube e do navegador.</small>
      </section>
    </div>
    <button type="button" id="cog-tv-expand" data-cm="expand" hidden title="Assistir em uma janela maior">▣ Assistir em tela grande</button>
    <div id="cog-tv-viewer" hidden role="dialog" aria-label="Assistir televisão em tela ampliada">
      <section class="cog-tv-viewer-panel">
        <header class="cog-tv-viewer-header">
          <span class="cog-tv-viewer-mark">CITY OF GOD <small>TV AO VIVO NO CÔMODO</small></span>
          <span id="cog-tv-viewer-room"></span>
          <div class="cog-tv-viewer-tools">
            <button type="button" data-cm="viewer-audio" title="Habilitar som">🔊 Som</button>
            <button type="button" data-cm="viewer-fullscreen" title="Tela cheia">⛶</button>
            <button type="button" data-cm="viewer-close" title="Fechar janela">✕</button>
          </div>
        </header>
        <div id="cog-tv-large-screen" class="cog-tv-large-screen"><div id="cog-tv-large-mount"></div></div>
        <footer class="cog-tv-viewer-footer">
          <span id="cog-tv-viewer-status" role="status">Reprodução sincronizada com a televisão do cômodo</span>
          <button type="button" data-cm="viewer-close">Voltar ao jogo</button>
        </footer>
      </section>
    </div>
    <div id="cog-car-radio" hidden role="group" aria-label="Rádio retrô do veículo">
      <div class="cog-retro-topline"><span>CLASSIC CITY</span><span>AM / FM · STEREO</span></div>
      <div class="cog-retro-body">
        <div class="cog-retro-speaker" aria-hidden="true"><div class="cog-retro-speaker-disc"></div><span>HIGH FIDELITY</span></div>
        <div class="cog-retro-right">
          <div class="cog-retro-glass">
            <div class="cog-retro-frequency"><span>88</span><i></i><span>92</span><i></i><span>96</span><i></i><span>102</span><i></i><span>108</span><small>FM</small></div>
            <strong id="cog-radio-title">Rádio</strong>
            <span id="cog-radio-detail">Desligado</span>
          </div>
          <div class="cog-retro-controls">
            <button class="cog-retro-knob" data-cm="radio-toggle" title="Ligar / desligar" aria-label="Ligar ou desligar rádio">⏻</button>
            <button data-cm="prev" title="Sintonizar estação anterior" aria-label="Estação anterior">◀</button>
            <button data-cm="next" title="Sintonizar próxima estação" aria-label="Próxima estação">▶</button>
            <button data-cm="radio-list" title="Escolher emissora" aria-label="Lista de estações">LIST</button>
          </div>
        </div>
      </div>
    </div>
    <div id="cog-ambient-radio" hidden><button data-cm="ambient-toggle">📻 Ativar som</button><span id="cog-ambient-radio-label">Rádio de carro próximo</span></div>
    <div id="cog-radio-list" hidden role="dialog" aria-label="Emissoras brasileiras"><section class="cog-media-card">
      <button data-cm="radio-close" class="cog-media-close" aria-label="Fechar">✕</button>
      <h2>📻 Rádios brasileiras ao vivo</h2><p>Escolha a emissora. São transmissões reais pela internet, sujeitas à disponibilidade do servidor da rádio.</p>
      <div class="cog-station-list">${stations.map(s=>'<button data-station="'+esc(s.id)+'"><b>'+esc(s.name)+'</b><small>'+esc(s.genre)+'</small></button>').join('')}</div>
      <label>Volume do rádio <input id="cog-radio-volume" type="range" min="0" max="100" value="38"></label>
    </section></div>`);
  dialog=document.getElementById('cog-media-dialog');radioUI=document.getElementById('cog-car-radio');screenEl=document.getElementById('cog-tv-screen');
  document.getElementById('cog-media-code').value=state.roomCode;
  document.getElementById('cog-media-server').value=state.relay;
  document.getElementById('cog-radio-volume').value=Math.round(state.volume*100);
  document.addEventListener('click',e=>{
   const btn=e.target.closest?.('[data-cm]'),station=e.target.closest?.('[data-station]');
   if(station){selectStation(station.dataset.station);document.getElementById('cog-radio-list').hidden=true;return;}
   if(!btn)return;
   const cmd=btn.dataset.cm;
   if(cmd==='close'){dialog.hidden=true;return;}
   if(cmd==='viewer-close'){closeExpanded();return;}
   if(cmd==='viewer-audio'){enableExpandedAudio();return;}
   if(cmd==='viewer-fullscreen'){const panel=document.querySelector('.cog-tv-viewer-panel');if(document.fullscreenElement)document.exitFullscreen?.();else panel?.requestFullscreen?.().catch(()=>{});return;}
   if(cmd==='expand'){openExpanded();return;}
   if(cmd==='radio-close'){document.getElementById('cog-radio-list').hidden=true;return;}
   if(cmd==='radio-list'){document.getElementById('cog-radio-list').hidden=false;return;}
   if(cmd==='ambient-toggle'){remoteOn=!remoteOn;syncNearbyRadio(true);return;}
   if(cmd==='radio-toggle'){toggleRadio();return;}
   if(cmd==='next'||cmd==='prev'){const i=stations.findIndex(s=>s.id===state.station);selectStation(stations[(i+(cmd==='next'?1:stations.length-1))%stations.length].id);return;}
   if(cmd==='play'){const id=C.youtubeId(document.getElementById('cog-media-link').value);if(!id){setStatus('Link inválido. Use vídeo, Shorts ou youtu.be.');return;}playTV(id);return;}
   if(cmd==='stop'){stopTV();return;}
   if(cmd==='audio'){enableAudio();return;}
   if(cmd==='connect'){
    const code=document.getElementById('cog-media-code').value.trim();
    const relay=document.getElementById('cog-media-server').value.trim();
    setStatus(setRoom(code,relay)?'Sala de mídia configurada.':'Informe um código válido e URL ws(s) válida.');
    return;
   }
   if(cmd==='new-room'){document.getElementById('cog-media-code').value='city-'+crypto.randomUUID().replaceAll('-','');return;}
   if(cmd==='copy-room'){navigator.clipboard?.writeText(document.getElementById('cog-media-code').value);setStatus('Código copiado. Compartilhe com os outros jogadores.');}
  });
  document.getElementById('cog-radio-volume').addEventListener('input',e=>{state.volume=Number(e.target.value)/100;persist();syncRadioVolume();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&expanded.open){closeExpanded();e.preventDefault();e.stopImmediatePropagation?.();return;}if(e.key==='Escape'&&!dialog.hidden){dialog.hidden=true;}} ,true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){safeAudio().volume=0;try{videoPlayer?.mute?.();}catch{}}});
  radioUI.addEventListener('pointerdown',e=>e.stopPropagation());
  resetChannel();
 }
 function setStatus(text){const el=document.getElementById('cog-media-status');if(el)el.textContent=text;}

 // Everyone physically in this exact room can watch; editing remains owner-gated.
 const canWatch=sel=>{
  const p=getPlayer();
  return !!sel?.house&&!!p&&!driver()&&!inMenu()&&C.canHear(sel.house,p,sel.room,window.CityHomePlus?.roomAt);
 };
 const canEdit=sel=>!!sel&&(!window.CityRealty?.canUse||!!window.CityRealty.canUse(sel.house,sel.item.floor||0,sel.item.unit));
 const viewerStatus=msg=>{const e=document.getElementById('cog-tv-viewer-status');if(e)e.textContent=msg;};
 function closeExpanded(){
  if(!expanded.open)return;
  expanded.open=false;expanded.screen=null;expanded.house=null;expanded.room=null;expanded.video=null;expanded.lastSync=0;
  const shell=document.getElementById('cog-tv-viewer');if(shell)shell.hidden=true;
  try{expanded.player?.mute?.();expanded.player?.pauseVideo?.();}catch{}
  if(document.fullscreenElement?.closest?.('.cog-tv-viewer-panel'))document.exitFullscreen?.().catch(()=>{});
  const current=active&&tvs.get(active.screen);
  if(current?.playing&&current.video&&canWatch(active))syncVideo(current);
  else syncTVVolume();
 }
 function ensureExpandedPlayer(){
  if(expanded.player||expanded.loading)return;
  expanded.loading=true;
  youtubeAPI().then(YT=>{
   const mount=document.getElementById('cog-tv-large-mount');
   if(!mount)return;
   expanded.player=new YT.Player(mount,{width:960,height:540,
    playerVars:{playsinline:1,controls:0,autoplay:0,disablekb:1,rel:0,origin:location.origin},
    events:{
     onReady(){expanded.ready=true;expanded.player.mute();if(expanded.open)syncExpanded(tvs.get(expanded.screen),true);},
     onError(e){viewerStatus('O YouTube bloqueou este vídeo para incorporação (código '+e.data+').');}
    }});
  }).catch(()=>{expanded.loading=false;viewerStatus('Não foi possível carregar o YouTube.');});
 }
 function syncExpanded(record,force=false){
  if(!expanded.open)return;
  if(!canWatch({house:expanded.house,room:expanded.room})||!record?.playing||
     !record.video||record.screen!==expanded.screen){closeExpanded();return;}
  ensureExpandedPlayer();
  if(!expanded.ready)return;
  const now=Date.now();
  if(!force&&now-expanded.lastSync<4500)return;
  expanded.lastSync=now;
  const position=Math.max(0,Math.min(86400,(now-record.at)/1000));
  try{
   if(expanded.video!==record.video){
    expanded.video=record.video;
    expanded.player.loadVideoById({videoId:record.video,startSeconds:position});
   }else if(Math.abs((expanded.player.getCurrentTime?.()||0)-position)>2.7){
    expanded.player.seekTo(position,true);
   }
   if(expanded.player.getPlayerState?.()!==1)expanded.player.playVideo?.();
   if(document.hidden)expanded.player.mute?.();
   else{expanded.player.unMute?.();expanded.player.setVolume?.(64);}
  }catch{viewerStatus('Falha na sincronização. Feche e reabra a janela.');}
 }
 function openExpanded(){
  ensure();
  const sel=visibleScreen||active,record=sel&&tvs.get(sel.screen);
  if(!canWatch(sel)){notify('É necessário estar no mesmo cômodo da TV.');return false;}
  if(!record?.playing||!record.video){setStatus('Ligue um vídeo na TV antes de ampliar.');return false;}
  const shell=document.getElementById('cog-tv-viewer');
  if(!shell)return false;
  expanded.open=true;expanded.screen=sel.screen;expanded.house=sel.house;
  expanded.room=sel.room;expanded.video=null;expanded.lastSync=0;
  shell.hidden=false;dialog.hidden=true;
  const e=document.getElementById('cog-tv-viewer-room');
  if(e)e.textContent='Cômodo: '+sel.room.split(':').slice(1).join(':');
  viewerStatus('O mesmo vídeo e horário da TV; cada pessoa pode abrir sua própria janela.');
  syncTVVolume();
  syncExpanded(record,true);
  return true;
 }
 function enableExpandedAudio(){
  if(!expanded.open)return;
  syncExpanded(tvs.get(expanded.screen),true);
  try{expanded.player?.unMute?.();expanded.player?.setVolume?.(64);expanded.player?.playVideo?.();}catch{}
 }
 function syncDialog(){
  if(!active)return;
  const room=document.getElementById('cog-media-room');
  if(room)room.textContent='Cômodo: '+active.room+' · Aparelho '+active.screen.slice(-22);
  const record=tvs.get(active.screen);
  if(record?.video)document.getElementById('cog-media-link').value='https://www.youtube.com/watch?v='+record.video;
  const peer=document.getElementById('cog-media-peers');
  if(peer)peer.textContent=peers.connected?'🟢 Sala de mídia online · '+peers.count+' conexão(ões)':'⚪ Somente local · '+(peers.error||'Servidor não conectado');
  const editing=canEdit(active);
  document.getElementById('cog-media-link').readOnly=!editing;
  for(const name of ['play','stop'])dialog.querySelector('[data-cm="'+name+'"]').disabled=!editing;
  dialog.querySelector('[data-cm="expand"]').disabled=!record?.playing;
 }
 function openTV(H,item){
  ensure();
  if(!H||!item||!['tv','screen'].includes(item.kind))return {ok:false,text:'Televisão indisponível'};
  const p=getPlayer();
  if(!p||Math.hypot(p.x-item.x,p.y-item.y)>4.2)return {ok:false,text:'Aproxime-se da televisão'};
  const room=C.roomAt(H,item.floor||0,item.x,item.y,window.CityHomePlus?.roomAt);
  if(!C.canHear(H,p,room,window.CityHomePlus?.roomAt))return {ok:false,text:'Entre no cômodo da televisão'};
  const powered=!window.CityHomePlus||window.CityHomePlus.powerOn?.(H)!==false;
  if(!powered)return {ok:false,text:'Ligue a energia da residência'};
  active={house:H,item,screen:recordKey(H,item),room};
  dialog.hidden=false;syncDialog();
  const record=tvs.get(active.screen);if(record)syncVideo(record);
  return {ok:true,text:canEdit(active)?'Televisão pronta':'Assistir como visitante no cômodo'};
 }
 function allScreens(){
  const p=getPlayer();if(!p||driver())return [];
  const H=(typeof houses!=='undefined'?houses:[]).find(h=>h?.contains?.(p.x,p.y,p.floor||0)||p.x>h.x0&&p.x<h.x1&&p.y>h.y0&&p.y<h.y1);
  if(!H)return [];
  const items=(typeof boxes!=='undefined'?boxes:[]).filter(b=>b.house===H&&['tv','screen'].includes(b.kind)&&(b.floor||0)===(p.floor||0));
  return items.filter(i=>C.canHear(H,p,C.roomAt(H,i.floor||0,i.x,i.y,window.CityHomePlus?.roomAt),window.CityHomePlus?.roomAt))
    .map(item=>({house:H,item,screen:recordKey(H,item),room:C.roomAt(H,item.floor||0,item.x,item.y,window.CityHomePlus?.roomAt)}));
 }
 function playTV(id){
  if(!active||!canEdit(active))return;
  const record={type:'tv',screen:active.screen,room:active.room,video:id,playing:true,at:Date.now()};
  ingest(record);transmit(record);syncVideo(record,true);setStatus('Vídeo selecionado. Caso o navegador bloqueie, clique em Ativar áudio.');
 }
 function stopTV(){
  if(!active||!canEdit(active))return;
  const record={type:'tv',screen:active.screen,room:active.room,video:null,playing:false,at:Date.now()};
  ingest(record);transmit(record);muteVideo(true);setStatus('Televisão desligada.');
 }
 function youtubeAPI(){
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(window.__cityYTLoading)return window.__cityYTLoading;
  window.__cityYTLoading=new Promise((resolve,reject)=>{
   const old=window.onYouTubeIframeAPIReady;
   window.onYouTubeIframeAPIReady=()=>{try{old?.();}catch{}resolve(window.YT);};
   const tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';tag.async=true;
   tag.onerror=()=>reject(new Error('YouTube indisponível'));
   document.head.appendChild(tag);
  });
  return window.__cityYTLoading;
 }
 function ensurePlayer(){
  if(videoPlayer||playerLoading)return;
  playerLoading=true;
  youtubeAPI().then(YT=>{
   if(videoPlayer)return;
   const mount=document.createElement('div');mount.id='cog-tv-iframe';screenEl.replaceChildren(mount);
   videoPlayer=new YT.Player(mount,{width:256,height:144,playerVars:{playsinline:1,controls:0,autoplay:0,disablekb:1,rel:0,origin:location.origin},
    events:{onReady(){videoReady=true;videoPlayer.mute();const m=active&&tvs.get(active.screen);if(m)syncVideo(m);},
      onError(e){setStatus('Este vídeo não permite incorporação (código '+e.data+'). Escolha outro vídeo.');}}});
  }).catch(()=>{playerLoading=false;setStatus('Não foi possível carregar o YouTube.');});
 }
 function syncVideo(record,gesture=false){
  if(!record?.video||!record.playing){muteVideo(true);return;}
  ensurePlayer();
  if(!videoReady)return;
  const elapsed=Math.min(36000,Math.max(0,(Date.now()-record.at)/1000));
  const next=record.video;
  try{
   if(videoID!==next){videoID=next;videoPlayer.loadVideoById({videoId:next,startSeconds:elapsed});}
   else if(Math.abs((videoPlayer.getCurrentTime?.()||0)-elapsed)>3)videoPlayer.seekTo(elapsed,true);
   if(gesture||videoPlayer.getPlayerState?.()!==1)videoPlayer.playVideo();
   syncTVVolume();
  }catch{}
 }
 function muteVideo(pause=false){if(!videoReady)return;try{videoPlayer.mute();videoPlayer.setVolume(0);if(pause)videoPlayer.pauseVideo();}catch{}}
 function syncTVVolume(){
  if(!videoReady)return;
  const p=getPlayer();
  const ok=active&&p&&!inMenu()&&!driver()&&C.canHear(active.house,p,active.room,window.CityHomePlus?.roomAt);
  try{if(ok&&!document.hidden&&!expanded.open){videoPlayer.unMute();videoPlayer.setVolume(55);}
   else muteVideo(!expanded.open);}catch{}
 }
 function enableAudio(){
  if(!active)return;
  ensurePlayer();
  const m=tvs.get(active.screen);
  if(m){syncVideo(m,true);syncTVVolume();setStatus('Áudio ativado neste cômodo.');}
  else setStatus('Escolha um vídeo primeiro.');
 }
 function syncRadioVolume(){
  if(!radioAudio)return;
  const playing=driver()&&state.radioOn&&!document.hidden&&!inMenu();
  radioAudio.volume=playing?Math.min(.8,state.volume):0;
 }
 function selectStation(id){
  ensure();if(!stations.some(s=>s.id===id))return false;
  state.station=id;state.radioOn=true;persist();startRadio(true);broadcastRadio();renderRadio();
  return true;
 }
 function startRadio(userGesture=false){
  if(!driver()||!state.radioOn){if(radioAudio)radioAudio.pause();return;}
  const audio=safeAudio(),s=currentStation();
  if(radioCurrent!==s.id){radioCurrent=s.id;audio.pause();audio.removeAttribute('crossorigin');audio.src=s.url;audio.load();}
  syncRadioVolume();
  if(userGesture)audio.play().catch(()=>notify('Clique em 📻 para autorizar o áudio da rádio.'));
 }
 function toggleRadio(){
  ensure();
  if(!driver())return;
  state.radioOn=!state.radioOn;persist();
  if(state.radioOn)startRadio(true);else radioAudio?.pause();
  broadcastRadio();renderRadio();
 }
 function renderRadio(){
  if(!radioUI)return;
  const yes=driver()&&!inMenu();
  radioUI.hidden=!yes;
  if(!yes)return;
  const st=currentStation();
  document.getElementById('cog-radio-title').textContent=st.name;
  document.getElementById('cog-radio-detail').textContent=(state.radioOn?'● AO VIVO · ':'○ Desligado · ')+st.genre;
  radioUI.classList.toggle('cog-retro-on',!!state.radioOn);
  radioUI.querySelector('[data-cm="radio-toggle"]').setAttribute('aria-pressed',String(!!state.radioOn));
 }
 const vehicleKey=()=>String(window.cityVehicles?.mediaVehicleId||('player-car-'+state.roomCode.slice(-12))).replace(/[^-\w:.|]/g,'').slice(0,210);
 function broadcastRadio(playing=state.radioOn){
  const p=getPlayer(),vehicle=radioVehicle||vehicleKey();
  if(!p||!vehicle)return;
  const packet={type:'radio',vehicle,station:state.station,playing:!!playing,x:p.x,y:p.y};
  if(playing)radios.set(vehicle,{...packet,at:Date.now()});else radios.delete(vehicle);
  transmit(packet);
 }
 function syncNearbyRadio(gesture=false){
  const el=document.getElementById('cog-ambient-radio');
  if(!el)return;
  const p=getPlayer();
  const near=!driver()&&!inMenu()&&p?[...radios.values()].filter(r=>r.playing&&Date.now()-r.at<10500&&
   Math.hypot(r.x-p.x,r.y-p.y)<9&&stations.some(s=>s.id===r.station))
   .sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]:null;
  el.hidden=!near;
  if(!near){remoteRadio?.pause();return;}
  const station=stations.find(s=>s.id===near.station);
  document.getElementById('cog-ambient-radio-label').textContent=station.name;
  el.querySelector('button').textContent=remoteOn?'⏹ Silenciar':'📻 Ouvir';
  if(!remoteOn){remoteRadio?.pause();return;}
  if(!remoteRadio){remoteRadio=new Audio();remoteRadio.preload='none';}
  if(remoteStation!==station.id){
   remoteStation=station.id;remoteRadio.pause();remoteRadio.src=station.url;remoteRadio.load();
   // Station changes may need another click if autoplay is restricted.
   gesture=true;
  }
  const d=Math.hypot(near.x-p.x,near.y-p.y);
  remoteRadio.volume=document.hidden?0:Math.max(0,Math.min(.45,state.volume*.7*(1-d/10)));
  if(gesture)remoteRadio.play().catch(()=>{notify('O navegador bloqueou o áudio. Clique em Ouvir novamente.');});
 }

 function tick(){
  ensure();
  const now=performance.now();if(now-lastRender<180)return;lastRender=now;
  const driving=driver();
  if(driving!==lastCar){
   if(lastCar&&!driving&&radioVehicle)broadcastRadio(false);
   lastCar=driving;
   if(driving){radioVehicle=vehicleKey();startRadio(false);if(state.radioOn)broadcastRadio(true);notify('📻 Rádio do carro: clique em 📻 para ativar o som.');}
   else{radioAudio?.pause();radioCurrent=null;radioVehicle=null;}
   renderRadio();
  }
  if(driving&&state.radioOn){if(!radioAudio?.src)startRadio(false);syncRadioVolume();}
  const choices=allScreens();
  const shown=choices.find(b=>tvs.get(b.screen)?.playing)||null;
  visibleScreen=shown;
  const expandBtn=document.getElementById('cog-tv-expand');
  if(expandBtn)expandBtn.hidden=!shown||!canWatch(shown)||expanded.open;
  if(expanded.open)syncExpanded(tvs.get(expanded.screen));
  if(shown){
   const changed=active?.screen!==shown.screen;
   if(changed){active=shown;videoID=null;syncVideo(tvs.get(shown.screen));}
  }else{
   if(screenEl)screenEl.hidden=true;
   muteVideo(true);
   if(dialog.hidden)active=null;
  }
  if(now-lastSend>4000&&driving&&state.radioOn){
   lastSend=now;broadcastRadio(true);
  }
  syncNearbyRadio();
 }
 // Rendered after setCamera() and props3d.update() on each WebGL frame.
 // This is the authoritative visible 3D screen projection, not a 2D guess.
 function updateOverlay(){
  if(!screenEl)return;
  const shown=visibleScreen,record=shown&&tvs.get(shown.screen);
  if(!shown||!record?.playing){
   screenEl.hidden=true;return;
  }
  const face=window.cityVehicles?.mediaScreenPose?.(shown.item);
  if(!face){
   screenEl.hidden=true;
   // Hearing a TV depends on the room, not on whether the camera sees its face.
   syncTVVolume();
   return;
  }
  const wasHidden=screenEl.hidden;
  const W=640,H=360;
  const {tl,tr,bl}=face;
  const a=(tr.x-tl.x)/W,b=(tr.y-tl.y)/W;
  const c=(bl.x-tl.x)/H,d=(bl.y-tl.y)/H;
  // The 3D furniture is orthographically projected, so a CSS affine matrix
  // exactly maps the video to its real rectangular black display surface.
  screenEl.style.left=tl.x+'px';screenEl.style.top=tl.y+'px';
  screenEl.style.width=W+'px';screenEl.style.height=H+'px';
  screenEl.style.transform='matrix('+[a,b,c,d,0,0].map(v=>Number(v.toFixed(7))).join(',')+')';
  screenEl.hidden=false;
  if(wasHidden)syncVideo(record);
  syncTVVolume();
 }
 return {ensure,openTV,openExpanded,closeExpanded,tick,updateOverlay,selectStation,toggleRadio,setRoom,get STATIONS(){return stations;},get peers(){return {...peers};},
  get state(){return {...state};},get screens(){return [...tvs.values()]},get active(){return active},
  get radio(){return radioAudio;},get videoPlayer(){return videoPlayer;},get expandedOpen(){return expanded.open;},get expandedState(){return {open:expanded.open,screen:expanded.screen,room:expanded.room,ready:expanded.ready};},get dialogOpen(){return !!dialog&&!dialog.hidden;}};
})();
window.CityMedia=CityMedia;
