// city-ui.js — celular local, mercado, inventário e roda de equipamentos.
'use strict';
const CityUI = (() => {
  const wheelItems = [
    { id: 'unarmed', icon: 'wheel-hand', name: 'Mãos livres' },
    { id: 'rifle', icon: 'weapons', name: 'Fuzil' },
    { id: null, icon: 'wheel-pistol', name: 'Pistola' },
    { id: null, icon: 'wheel-smg', name: 'SMG' },
    { id: null, icon: 'wheel-shotgun', name: 'Escopeta' },
    { id: null, icon: 'wheel-sniper', name: 'Precisão' },
    { id: null, icon: 'wheel-grenade', name: 'Arremessáveis' },
    { id: null, icon: 'wheel-tools', name: 'Ferramentas' }
  ];
  const quickItems = ['water','sandwich','burger','firstaid','coffee'];
  const appNames = { home: 'Início', status: 'Necessidades', bag: 'Mochila', market: 'Mercadinho', contacts: 'Contatos', sms: 'Mensagens', wallet: 'Carteira', notes: 'Anotações', help: 'Ajuda', ...CityApps.names };
  const contacts = { lucas: { name: 'Lucas', reply: 'O movimento da cidade está tranquilo. Precisando de alguma coisa, me avisa!' }, ana: { name: 'Ana', reply: 'Oi! Estou por aqui. Se cuida e não esquece de comer e beber água.' } };
  const labels = { hp:'Vida', food:'Fome', water:'Sede', stamina:'Fôlego', energy:'Energia', hygiene:'Higiene', bladder:'Banheiro' };
  let app = 'home', phoneOpen = false, wheelOpen = false, wheelChoice = 1, selectedContact = 'lucas', mounted = false;
  let toastTimer, currentSt, messages = [], notes = '', shownClock = '';
  function syncSocialContacts(){
    for(const [id,c] of Object.entries(contacts))if(c.roleplay)delete contacts[id];
    for(const p of window.cityCharacters?.social?.contacts()||[])if(p.phone)contacts[p.id]={name:p.name,roleplay:true,mood:p.mood,number:p.number};
    if(!contacts[selectedContact])selectedContact='lucas';
  }
  const $ = id => document.getElementById(id);
  const safe = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const percent = value => Math.max(0, Math.min(100, Math.round(value * 100)));
  const localRead = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; } };
  const localWrite = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  const minsToTime = clock => { const m = ((Math.floor(clock) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2,'0') + ':' + String(m % 60).padStart(2,'0'); };
  const blocked = () => phoneOpen || wheelOpen || !!window.CityFront?.blocked || !!window.CityAdmin?.active;
  function syncClock(clock){
    if(!phoneOpen)return;
    const time=minsToTime(clock);if(time===shownClock)return;shownClock=time;
    const status=$('city-phone-time'),hero=document.querySelector('.city-phone-hero-time');
    if(status)status.textContent=time;if(hero)hero.textContent=time;
  }
  function releaseControls() {
    if (typeof input !== 'undefined') { input.keys.clear(); input.pressed.clear(); input.lmb = false; input.rmb = false; }
    if (currentSt?.player) { currentSt.player.wantShot = false; currentSt.player.aiming = false; }
  }
  function setModal() { document.body.classList.toggle('city-modal', blocked()); }
  function updatePhoneTheme(){
    const phone=$('city-phone'); if(!phone)return;
    phone.className='city-wallpaper-'+CitySim.data.themes.wallpaper+' city-case-'+CitySim.data.themes.caseColor;
  }
  function notify(message) {
    const el = $('city-toast');
    const inWorld=typeof hud !== 'undefined' && !(typeof wmap !== 'undefined' && wmap.open)
      && !phoneOpen && !window.CityHomeUI?.active;
    if (inWorld || !el) {
      if (typeof hud !== 'undefined') { hud.msg = message; hud.msgT = 2.4; }
      el?.classList.remove('show');clearTimeout(toastTimer);return;
    }
    if (typeof hud !== 'undefined') hud.msgT = 0;
    el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2900);
  }
  function togglePhone(force) {
    if (!mounted) return;
    const next = typeof force === 'boolean' ? force : !phoneOpen;
    if(next&&window.CityHomeUI?.active)return;
    if (next && typeof wmap !== 'undefined' && wmap.open) { notify('Feche o mapa antes de abrir o celular'); return; }
    if(next)window.CityRealty?.close?.();
    if (next) { closeWheel(false); releaseControls(); app = 'home'; }
    phoneOpen = next;
    $('city-phone-layer').hidden = !phoneOpen;
    setModal();
    if (phoneOpen) { updatePhoneTheme(); render(); $('city-phone-close')?.focus(); }
    else { if (document.activeElement && $('city-phone-layer').contains(document.activeElement)) document.activeElement.blur(); releaseControls(); }
  }
  function openWheel(yes) {
    if (!mounted || (yes && (phoneOpen || (typeof wmap !== 'undefined' && wmap.open)))) return;
    wheelOpen = yes;
    wheelChoice = Math.max(0, wheelItems.findIndex(it => it.id === CityLife.equipped));
    $('city-wheel-layer').hidden = !yes;
    setModal();
    releaseControls();
    if (yes) renderWheel();
  }
  function closeWheel(select = true) {
    if (!wheelOpen) return;
    if (select) chooseWheel(wheelChoice);
    wheelOpen = false;
    $('city-wheel-layer').hidden = true;
    setModal();
    releaseControls();
  }
  function chooseWheel(i) {
    const item = wheelItems[i];
    if (!item) return;
    if (!item.id) { notify(item.name + ' ainda não está disponível'); return; }
    if (CityLife.equip(item.id)) notify(item.id === 'unarmed' ? 'Mãos livres' : item.name + ' equipado');
  }
  function renderWheel() {
    const panel = $('city-wheel');
    if (!panel) return;
    const item = wheelItems[wheelChoice];
    panel.innerHTML = wheelItems.map((entry, i) => {
      const a = -Math.PI / 2 + i * Math.PI / 4;
      const left = 50 + 37 * Math.cos(a), top = 50 + 37 * Math.sin(a);
      return `<button type="button" class="city-wheel-slot ${wheelChoice === i ? 'active' : ''} ${!entry.id ? 'locked' : ''}" style="left:${left}%;top:${top}%" data-wheel="${i}" aria-label="${safe(entry.name)}">
        <span class="wheel-icon">${icon(entry.icon)}</span><span>${safe(entry.name)}</span></button>`;
    }).join('') + `<div class="wheel-center"><b>${safe(item.name)}</b><span>${item.id === 'rifle' && currentSt ? currentSt.player.ammo + '/' + currentSt.player.reserve + ' balas' : item.id ? 'Disponível' : 'Indisponível'}</span></div>`;
  }
  const btn = (action, label, extra = '') => `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
  const icon = id => `<svg class="city-svg-icon" aria-hidden="true" viewBox="0 0 24 24"><use href="assets/ui/city-icons.svg#${id}"></use></svg>`;
  const appBtn = (id, unused, title) => `<button type="button" class="city-app" data-app="${id}"><span class="city-app-icon">${icon(id)}</span>${title}</button>`;
  function renderNeeds() {
    const st = currentSt;
    return [['hp', st.hp], ['food', st.food], ['water', st.water], ['stamina',st.needs.stamina], ['energy',st.needs.energy], ['hygiene',st.needs.hygiene], ['bladder',1-st.needs.bladder]].map(([key, value]) => {
      const pct = percent(value), color = pct < 20 ? 'danger' : pct < 45 ? 'warning' : '';
      return `<div class="city-panel"><div class="city-row"><strong>${labels[key]}</strong><span>${pct}%</span></div>
        <div class="city-track"><span class="city-fill ${color}" style="width:${pct}%"></span></div></div>`;
    }).join('');
  }
  function renderBag() {
    return `<p class="city-help">Itens da mochila. Consumir altera suas necessidades de verdade. Atalhos: 1–5.</p>` +
      Object.entries(CityLife.items).map(([id, it]) => `<div class="city-panel city-row">
      <div><strong>${it.icon} ${safe(it.name)}</strong><small>${safe(it.detail)} · Em estoque: ${CityLife.inventory[id] || 0}</small></div>
      ${btn('use:'+id,'Usar',!(CityLife.inventory[id] > 0) ? 'disabled' : '')}</div>`).join('');
  }
  function renderMarket() {
    return `<p class="city-help">Loja de teste: pedidos entram imediatamente no inventário. Integração com caixas, entregadores e NPCs virá depois.</p>
    <div class="city-panel"><div class="city-row"><b>Saldo</b><b>${CityLife.money(CityLife.funds)}</b></div></div>` +
      Object.entries(CityLife.items).map(([id, it]) => `<div class="city-panel city-row">
      <div><strong>${it.icon} ${safe(it.name)}</strong><small>${safe(it.detail)}</small></div>
      ${btn('buy:'+id,CityLife.money(it.price),CityLife.funds < it.price ? 'disabled' : '')}</div>`).join('');
  }
  function renderWallet() {
    return `<div class="city-panel"><small>Saldo na carteira (salvo neste navegador)</small><div class="city-balance">${CityLife.money(CityLife.funds)}</div></div>
      <div class="city-phone-label">Últimas movimentações</div>` +
      (CityLife.history.length ? CityLife.history.map(t => `<div class="city-log"><span>${safe(t.text)}<small> · ${minsToTime(t.time || 0)}</small></span><b>${t.delta ? CityLife.money(t.delta) : '—'}</b></div>`).join('') :
      '<p class="city-help">Sem compras registradas.</p>');
  }
  function renderMessages() {
    const entries = messages.filter(x => x.contact === selectedContact).slice(-18);
    const who = contacts[selectedContact].name;
    return `<div class="city-phone-label">Conversa com ${who} (NPC local)</div>
      <div class="city-panel" role="log" aria-label="Histórico de mensagens">${entries.length ? entries.map(m =>
        `<div class="city-message ${m.sender === 'me' ? 'sent' : ''}"><strong>${m.sender === 'me' ? 'Você' : who}:</strong> ${safe(m.text)}</div>`).join('') :
        '<p>Envie uma mensagem para começar.</p>'}</div>
      <form id="city-sms-form" class="city-form"><input id="city-sms-input" maxlength="160" autocomplete="off" placeholder="Mensagem para ${who}…" aria-label="Mensagem"><button class="city-primary" type="submit">Enviar</button></form>`+
      (contacts[selectedContact].roleplay?'<div class="city-panel"><h3>Combinar um programa</h3>'+[['inviteWalk','🚶 Passear'],['inviteCoffee','☕ Café'],['inviteDate','🌹 Encontro'],['inviteDinner','🍽 Jantar em casa'],['inviteSleep','🌙 Passar a noite']].map(([action,label])=>{const reason=window.cityCharacters.social.unavailable('player',selectedContact,action,window.cityCharacters.socialActivities?.context(selectedContact));const locked=reason&&!reason.includes('Espere a outra pessoa');return '<button class="city-action" data-action="invite-npc:'+selectedContact+':'+action+'" '+(locked?'disabled':'')+' title="'+safe(reason)+'" aria-label="'+safe(label+(locked?'. Bloqueado: '+reason:''))+'">'+(locked?'🔒 ':'')+label+'</button>';}).join('')+'</div>':'');
  }
  function render() {
    if (!phoneOpen || !mounted) return;
    syncSocialContacts();
    const screen = $('city-phone-screen');
    const title = appNames[app] || 'Início';
    $('city-phone-title').textContent = title;
    $('city-phone-time').textContent = minsToTime(currentSt.clock);
    shownClock=minsToTime(currentSt.clock);
    let html = '';
    if (app === 'home') {
      html = `<div class="city-home-hero"><span class="city-hero-eyebrow">SEU MUNDO, SEU RITMO</span><strong>City of God</strong><span>Descubra a cidade. Construa sua história.</span><div class="city-hero-stats"><span>☀️ <span class="city-phone-hero-time">${minsToTime(currentSt.clock)}</span></span><b>${CityLife.money(CityLife.funds)}</b></div></div>
        <div class="city-phone-label">Aplicativos</div><div class="city-app-grid">
        ${appBtn('status','❤️','Status')}
        ${appBtn('bag','🎒','Mochila')}
        ${appBtn('market','🏪','Mercado')}
        ${appBtn('contacts','👥','Contatos')}
        ${appBtn('sms','💬','Mensagens')}
        ${appBtn('wallet','👛','Carteira')}
        ${appBtn('bank','💳','NexoBank')}
        ${appBtn('notes','📝','Notas')}
        ${appBtn('map','🗺️','Mapa')}
        ${appBtn('camera','📷','Câmera')}
        ${appBtn('social','📸','CitySocial')}
        ${appBtn('dating','💕','CityMatch')}
        ${appBtn('calculator','🧮','Calculadora')}
        ${appBtn('gps','📍','GPS')}
        ${appBtn('jobs','💼','Carreiras')}
        ${appBtn('taxi','🚕','CityTaxi')}
        ${appBtn('business','🏪','Negócios')}
        ${appBtn('services','🛎️','Serviços')}
        ${appBtn('properties','🏠','Imóveis')}
        ${appBtn('cars','🚗','Carros')}
        ${appBtn('browser','🌍','CityWeb')}
        ${appBtn('calls','📞','Ligações')}
        ${appBtn('settings','🎨','Aparência')}
        ${appBtn('graphics','🎮','Gráficos')}
        ${appBtn('help','⚙️','Ajuda')}
        </div>
        <div class="city-home-dock"><button data-app="calls">${icon('calls')}<small>Ligações</small></button><button data-app="sms">${icon('sms')}<small>Mensagens</small></button><button data-app="camera">${icon('camera')}<small>Câmera</small></button><button data-app="browser">${icon('browser')}<small>Internet</small></button></div>`;
    } else if (app === 'status') html = renderNeeds() + '<p class="city-help">Geladeiras, pias, camas, chuveiros e vasos sanitários das casas agora ajudam a manter o personagem.</p>';
    else if (app === 'bag') html = renderBag();
    else if (app === 'market') html = renderMarket();
    else if (app === 'wallet') html = renderWallet();
    else if (app === 'contacts') html = '<p class="city-help">Contatos dos NPCs locais (não é chat online).</p>' +
      Object.entries(contacts).map(([id,c]) => `<div class="city-panel city-row"><strong>👤 ${safe(c.name)}${c.roleplay?'<small> · '+safe(c.mood)+' · '+safe(c.number)+'</small>':''}</strong>${btn('contact:'+id,'Conversar')}</div>`).join('')+'<p class="city-help">Novos contatos aparecem quando vocês trocam números pelo leque social.</p>';
    else if (app === 'sms') html = renderMessages();
    else if (app === 'notes') html = `<p class="city-help">Notas privadas salvas no navegador.</p><textarea id="city-notes" maxlength="1000" aria-label="Anotações"></textarea><p class="city-help">Salvamento automático.</p>`;
    else if (app === 'help') html = `<div class="city-panel"><h3>Controles</h3><p>P: celular · TAB ou U: roda de equipamentos · I: mochila · M: mapa. Role o mouse para aproximar a câmera do personagem.</p>
      <p>1–5: consumo rápido · F: interagir · Shift+F: ação alternativa quando porta e escada estão próximas · F7: decorar uma casa própria · R: recarregar o fuzil.</p><p>Clique ou toque nos botões de acesso da tela.</p>
      <p>Compras, empregos, imóveis, chamadas de NPCs e publicações são simulações locais salvas no navegador, ainda sem servidor multiplayer.</p></div>`;
    else if (CityApps.names[app]) html = CityApps.render(app);
    screen.innerHTML = html;
    if (app === 'notes') { $('city-notes').value = notes; $('city-notes').addEventListener('input', e => { notes = e.target.value; localWrite('cityofgod.phone.notes.v1',notes); }); }
    if (app === 'sms') $('city-sms-form')?.addEventListener('submit', sendMessage);
    if(CityApps.names[app]) CityApps.afterRender(app);
  }
  async function sendMessage(e) {
    e.preventDefault();
    const field = $('city-sms-input'), text = field?.value.trim();
    if (!text) return;
    syncSocialContacts();
    const recipient=selectedContact,social=window.cityCharacters?.social,intent=contacts[recipient].roleplay?social.messageIntent(text):null;
    let result;
    try{result=contacts[recipient].roleplay?(intent?.startsWith('invite')?await window.cityCharacters.inviteContact(recipient,intent):social.message(recipient,text)):{ok:true,text:contacts[recipient].reply};}catch{notify('Não foi possível entregar a mensagem.');return;}
    if(!result.ok){notify(result.text);return;}
    messages.push({ contact: recipient, sender: 'me', text });
    messages.push({ contact: recipient, sender: 'npc', text:result.text });
    messages = messages.slice(-60);
    localWrite('cityofgod.phone.sms.v1',JSON.stringify(messages));
    render();
    notify('Mensagem respondida por ' + contacts[recipient].name + ' (NPC)');
  }
  function setApp(next) {
    if (next === 'map') {
      togglePhone(false);
      if (typeof wmap !== 'undefined' && !wmap.open) wmapToggle();
      return;
    }
    if (!appNames[next]) return;
    app = next; render();
  }
  function onAction(action) {
    if(action.startsWith('invite-npc:')){
      const [,id,kind]=action.split(':');
      window.cityCharacters?.inviteContact?.(id,kind).then(result=>{notify(result.text);if(result.ok){messages.push({contact:id,sender:'me',text:result.line||'Quer combinar um programa juntos?'},{contact:id,sender:'npc',text:result.text});messages=messages.slice(-60);localWrite('cityofgod.phone.sms.v1',JSON.stringify(messages));}render();}).catch(()=>notify('Não foi possível combinar o convite.'));
      return;
    }
    if (action === 'phone') return togglePhone();
    if (action === 'wheel') return openWheel(!wheelOpen);
    if (action === 'bag') { togglePhone(true); setApp('bag'); return; }
    if (action === 'close') return togglePhone(false);
    if (action === 'home') return setApp('home');
    if (action === 'back') return setApp('home');
    if (action.startsWith('contact:')) {
      const id=action.slice(8); if (!contacts[id]) return;
      selectedContact=id; return setApp('sms');
    }
    if (action.startsWith('use:')) { const r=CityLife.use(action.slice(4)); notify(r.text); render(); return; }
    if (action.startsWith('buy:')) { const r=CityLife.buy(action.slice(4)); notify(r.text); render(); }
  }
  function mount() {
    if (mounted || !window.CityLife) return;
    currentSt = CityLife.state;
    if (!currentSt) return;
    notes = localRead('cityofgod.phone.notes.v1','');
    try { const parsed=JSON.parse(localRead('cityofgod.phone.sms.v1','[]')); if (Array.isArray(parsed)) messages=parsed.filter(x => x && typeof x.contact==='string' && ['npc','me'].includes(x.sender) && typeof x.text === 'string').slice(-60); } catch (_) {}
    const root=document.createElement('div'); root.id='city-ui-root';
    root.innerHTML = `
      <div id="city-controls" aria-label="Ações do personagem">
        <button type="button" data-action="phone" aria-label="Abrir celular"><b>${icon('phone')}</b>P · Celular</button>
      </div>
      <div id="city-toast" role="status" aria-live="polite"></div>
      <div id="city-phone-layer" hidden>
        <div id="city-phone" role="dialog" aria-modal="true" aria-label="Celular CityOS">
          <div class="city-dynamic-island" aria-hidden="true"><span class="city-camera-lens"></span></div>
          <div class="city-phone-status"><span id="city-phone-time">17:40</span><span>•••  ◕  ▰▰▰</span></div>
          <div class="city-phone-top"><button data-action="back" aria-label="Voltar">‹</button>
            <strong id="city-phone-title">Início</strong><button id="city-phone-close" data-action="close" aria-label="Fechar celular">✕</button></div>
          <div class="city-phone-screen" id="city-phone-screen"></div>
          <div class="city-phone-footer"><button data-action="home" aria-label="Tela inicial">⌂ Início</button><small>CityOS <span class="city-online-dot"></span></small><button data-action="close">Fechar</button></div>
          <div class="city-home-indicator" role="presentation"></div>
        </div>
      </div>
      <div id="city-wheel-layer" hidden><div id="city-wheel" role="dialog" aria-modal="true" aria-label="Roda de equipamentos"></div></div>`;
    document.body.appendChild(root);
    // Um único handler para não recriar listeners ao navegar entre aplicativos.
    root.addEventListener('click', e => {
      const wheel = e.target.closest('[data-wheel]');
      if (wheel) { wheelChoice = Number(wheel.dataset.wheel); chooseWheel(wheelChoice); closeWheel(false); return; }
      const appBtn = e.target.closest('[data-app]');
      if (appBtn) return setApp(appBtn.dataset.app);
      const action = e.target.closest('[data-action]');
      if (action?.dataset.action.startsWith('sim:')) {
        CityApps.action(action.dataset.action).then(result=>{
          if(result?.text) notify(result.text);
          if(phoneOpen) { updatePhoneTheme(); render(); }
        }).catch(()=>notify('Não foi possível concluir a ação'));
        return;
      }
      if (action) onAction(action.dataset.action);
    });
    $('city-wheel-layer').addEventListener('pointermove', e => {
      if (!wheelOpen) return;
      const r=$('city-wheel').getBoundingClientRect(), dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height/2);
      if (Math.hypot(dx,dy) < r.width*.17) return;
      const sel=(Math.round((Math.atan2(dy,dx)+Math.PI/2)/(Math.PI/4))+8)%8;
      if (sel!==wheelChoice) { wheelChoice=sel; renderWheel(); }
    });
    $('city-wheel-layer').addEventListener('pointerdown', e => {
      if (e.target === $('city-wheel-layer')) closeWheel(false);
    });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', e => {
      if ((e.key.toLowerCase()==='tab' || e.key.toLowerCase()==='u') && wheelOpen) { e.preventDefault(); closeWheel(true); }
    });
    window.addEventListener('blur', () => { if (wheelOpen) closeWheel(false); });
    window.addEventListener('city-life-change', () => { if(phoneOpen && ['status','bag','market','wallet','home','jobs','business','properties','cars'].includes(app)) render(); });
    window.addEventListener('city-sim-change', () => { if(phoneOpen && app!=='social') {updatePhoneTheme();render();} });
    mounted = true;
    updatePhoneTheme();
  }
  function onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (window.cityCharacterEditorOpen) return;
    const isTyping = ['INPUT','TEXTAREA'].includes(document.activeElement?.tagName);
    if (key === 'escape') {
      if (phoneOpen) { e.preventDefault(); togglePhone(false); }
      else if (wheelOpen) { e.preventDefault(); closeWheel(false); }
      return;
    }
    if (isTyping) return;
    if (key === 'p') { e.preventDefault(); togglePhone(); }
    else if (key === 'i') { e.preventDefault(); if (!phoneOpen) togglePhone(true); if (phoneOpen) setApp('bag'); }
    else if ((key === 'tab' || key === 'u') && !e.repeat) {
      e.preventDefault();
      if(!phoneOpen && !wmap.open)openWheel(true);
    }
    else if (/^[1-5]$/.test(key) && !blocked() && !(typeof wmap!=='undefined' && wmap.open)) {
      const r=CityLife.use(quickItems[Number(key)-1]); notify(r.text);
    }
  }
  const api = { mount, notify, togglePhone, openWheel, closeWheel, refreshPhone:render, goApp:setApp, updatePhoneTheme,syncClock, get phoneOpen(){return phoneOpen;}, get wheelOpen(){return wheelOpen;}, blocksGameInput:blocked, quickItems };
  return api;
})();
window.CityUI = CityUI;
