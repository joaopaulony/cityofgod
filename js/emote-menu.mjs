// emote-menu.mjs — menu de gestos do jogador (tecla T): todos os emotes de cas-studio.mjs, agrupados. Clicar (ou o
// número do atalho) toca o gesto; mexer-se, sacar a arma ou entrar no carro interrompe. Esc fecha.
import {CAS_EMOTES,EMOTE_GROUPS} from './cas-studio.mjs';

const ICON={wave:'👋',yes:'👍',no:'🙅',cheer:'🙌',talk:'💬',phone:'📱',fold:'🙎',call:'📣',dance:'💃',sit:'🪑',sit_talk:'🗨️',eat:'🥤',pickup:'📦',interact:'🖐️',open:'🧰',lean:'🧍',push:'🫸',torch:'🔦',lantern:'🏮',
 kneel:'🔧',plant:'🌱',harvest:'🧺',water:'💧',chop:'🪓',punch:'👊',cross:'🥊',hook:'🤜',kick:'🦵',roll:'🤸',throw:'🤾',zombie:'🧟',scratch:'🧟‍♂️',spell:'✨'};

export function installEmoteMenu(system,bridge){
 if(document.getElementById('city-emotes'))return;
 const style=document.createElement('style');
 style.textContent=`#city-emotes{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:40;width:min(720px,calc(100vw - 32px));max-height:min(70vh,560px);overflow:auto;
 background:rgba(14,17,20,.94);border:1px solid #3c4248;border-radius:14px;box-shadow:0 18px 50px #000a;padding:14px 16px 10px;color:#eee;font:13px system-ui,Segoe UI,sans-serif}
 #city-emotes[hidden]{display:none}#city-emotes header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}#city-emotes h2{margin:0;font-size:15px;letter-spacing:.06em}
 #city-emotes small{color:#9aa3ab}#city-emotes h3{margin:10px 0 6px;font-size:11px;color:#c7975d;letter-spacing:.12em;text-transform:uppercase}
 #city-emotes .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px}
 #city-emotes button{display:flex;gap:7px;align-items:center;background:#1e2429;border:1px solid #333b42;border-radius:9px;color:#eee;padding:7px 9px;font:inherit;cursor:pointer;text-align:left}
 #city-emotes button:hover,#city-emotes button:focus-visible{background:#2b343b;border-color:#c7975d;outline:none}#city-emotes .ic{font-size:17px}#city-emotes .msg{min-height:16px;color:#e6aa62;margin-top:8px}`;
 const panel=document.createElement('section');panel.id='city-emotes';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Gestos');
 const groups=Object.entries(EMOTE_GROUPS).map(([g,label])=>{
  const items=Object.entries(CAS_EMOTES).filter(([,e])=>e.group===g);
  return `<h3>${label}</h3><div class="grid">${items.map(([id,e])=>`<button type="button" data-emote="${id}"><span class="ic" aria-hidden="true">${ICON[id]||'•'}</span>${e.label}${e.loop?' ↻':''}</button>`).join('')}</div>`;
 }).join('');
 panel.innerHTML=`<header><h2>GESTOS</h2><small>T abre/fecha · ↻ continua até você se mexer</small></header>${groups}<div class="msg" role="status"></div>`;
 document.head.append(style);document.body.append(panel);
 const msg=panel.querySelector('.msg');
 const open=v=>{panel.hidden=!v;if(v){msg.textContent='';panel.querySelector('button')?.focus({preventScroll:true});}else document.getElementById('view')?.focus?.({preventScroll:true});};
 system.emoteMenu={open:()=>open(true),close:()=>open(false),get active(){return !panel.hidden;}};
 panel.addEventListener('click',e=>{
  const b=e.target.closest('[data-emote]');if(!b)return;
  if(system.playEmote(b.dataset.emote))open(false);
  else msg.textContent=bridge.driving?.()?'Saia do veículo para fazer gestos.':bridge.player?.armed?'Guarde a arma para fazer gestos.':'Pare de andar para fazer o gesto.';
 });
 window.addEventListener('keydown',e=>{
  const t=e.target,typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable);
  if(typing||document.querySelector('dialog[open]'))return;
  if(e.key==='Escape'&&!panel.hidden){open(false);e.preventDefault();return;}
  if((e.key==='t'||e.key==='T')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
   if(window.CityFront?.blocked)return;
   open(panel.hidden);e.preventDefault();
  }
 });
}
