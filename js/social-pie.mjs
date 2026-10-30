import {SOCIAL_TREE,pieOptions,pieLayout,actionUnavailable} from './social-pie-model.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function installSocialPie(api){
 const css=document.createElement('style');css.textContent=`
 #social-pie{position:fixed;inset:0;max-width:none;max-height:none;width:100vw;height:100dvh;margin:0;padding:0;border:0;overflow:hidden;background:transparent;color:#275e85;font:600 13px 'Segoe UI',system-ui;outline:none}#social-pie::backdrop{background:transparent}
 #social-pie .pie-fan{position:absolute;transform:translate(-50%,-50%);pointer-events:none}#social-pie button{font:inherit;cursor:pointer;pointer-events:auto}#social-pie button:focus-visible{outline:3px solid #79c846;outline-offset:4px}#social-pie .pie-pill{position:absolute;transform:translate(-50%,-50%);min-height:37px;padding:7px 15px;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid #d3e3ee;border-bottom:3px solid #b5cbdc;border-radius:30px;color:#29618b;background:linear-gradient(#fff 45%,#edf4fa);box-shadow:0 3px 8px #0c2d4d26;text-align:center;line-height:1.25;transition:background .12s,box-shadow .12s;animation:pie-bloom .16s ease-out both}#social-pie .pie-pill:hover:not([aria-disabled="true"]){background:linear-gradient(#fafff4,#edfbdc);border-color:#99c955;box-shadow:0 0 0 2px #b5e176,0 4px 10px #1d4e3926;color:#467a28}#social-pie .pie-pill[aria-disabled="true"]{color:#8097a8;background:#eef3f6e8;cursor:default;box-shadow:0 2px 5px #0001}#social-pie .pie-icon{font-size:22px;line-height:1;flex-shrink:0}#social-pie .pie-branch-arrow{font-size:15px;color:#91a8b9;margin-left:auto}
 #social-pie .pie-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:172px;display:grid;justify-items:center;gap:7px;text-align:center;pointer-events:auto}#social-pie .pie-center strong{color:white;font-size:14px;text-shadow:0 1px 5px #123b62,0 1px 10px #123b62;background:#183b595c;border-radius:15px;padding:4px 10px}#social-pie .pie-back{border:1px solid #d6e4ef;border-bottom:3px solid #b5cbdc;border-radius:22px;padding:8px 15px;background:linear-gradient(white,#edf3f8);color:#427191;min-height:36px}#social-pie .pie-close{position:absolute;right:22px;top:22px;width:35px;height:35px;border:2px solid white;background:#edf6fc;color:#457395;border-radius:50%;font-size:20px;box-shadow:0 3px 10px #17385233}#social-pie .pie-hint{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 40px);padding:8px 15px;background:#17334aca;color:white;border-radius:20px;text-align:center;font-size:11px;font-weight:500;pointer-events:none}#social-pie .pie-fan.compact .pie-center{top:23px;width:230px}#social-pie .pie-fan.compact .pie-center strong{font-size:12px}#social-pie .pie-fan.compact .pie-back{padding:5px 15px;min-height:28px;font-size:12px}#social-pie .pie-fan.compact .pie-pill{font-size:11px;padding:7px 9px;min-height:42px}#social-pie .pie-fan.compact .pie-icon{font-size:18px}
 #social-conversation{position:fixed;top:22px;left:50%;transform:translateX(-50%);z-index:65;width:min(360px,calc(100vw - 36px));padding:12px 18px;background:linear-gradient(#fff,#edf5fb);border:2px solid white;border-radius:17px;box-shadow:0 5px 20px #173a5930;color:#426c8c;font:600 12px 'Segoe UI',system-ui;pointer-events:none}#social-conversation[hidden],#social-feedback[hidden]{display:none}#social-conversation .conversation-heading{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px}#social-conversation .conversation-heading span{font-size:10px;color:#6d9545}#social-conversation .conversation-bars{display:flex;gap:10px}#social-conversation .conversation-track{flex:1;background:#dce7ef;border-radius:6px;height:6px;position:relative;overflow:hidden}#social-conversation .conversation-track i{position:absolute;height:100%;border-radius:6px;background:#85c743}#social-conversation .conversation-track.romantic i{background:#e38fbc}#social-conversation .conversation-track.negative i{background:#de8a82}#social-feedback{position:fixed;bottom:35px;left:50%;transform:translateX(-50%);z-index:65;width:max-content;max-width:min(510px,calc(100vw - 32px));padding:12px 20px;background:#fffffff5;border:2px solid #fff;border-radius:18px;box-shadow:0 5px 20px #173a5930;color:#427191;font:600 13px/1.5 'Segoe UI',system-ui;pointer-events:none}
 @keyframes pie-bloom{from{opacity:0;margin-top:7px}to{opacity:1;margin-top:0}}@media(prefers-reduced-motion:reduce){#social-pie .pie-pill{animation:none;transition:none}}`;
 document.head.append(css);
 const layer=document.createElement('dialog');layer.id='social-pie';layer.setAttribute('aria-label','Leque de interações sociais');document.body.append(layer);
 const status=document.createElement('aside');status.id='social-conversation';status.hidden=true;status.setAttribute('aria-label','Conversa em andamento');document.body.append(status);
 const feedback=document.createElement('div');feedback.id='social-feedback';feedback.setAttribute('role','status');feedback.hidden=true;document.body.append(feedback);
 let id=null,branch='root',trail=[],point=null,previousFocus=null,expiry=0,signature='',layout=null;
 function context(){return {...api.context?.(id),inRange:api.nearby().some(n=>n.lookId===id),blocked:api.blocked()};}
 function bars(){const sim=api.sim();if(!id||!sim?.people.has(id))return;const p=sim.people.get(id),r=sim.relation('player',id);status.hidden=false;status.innerHTML=`<div class="conversation-heading"><strong>${esc(p.name)}</strong><span>${esc(sim.label(r))}</span></div><div class="conversation-bars">${[r.friend,r.romance].map((v,i)=>`<div class="conversation-track ${i?'romantic':''} ${v<0?'negative':''}" role="meter" aria-label="${i?'Romance':'Amizade'}" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="${Math.round(v)}"><i style="left:${v<0?50+v/2:50}%;width:${Math.abs(v)/2}%"></i></div>`).join('')}</div>`;}
 function position(){
  const anchor=api.anchor?.(id)||point;
  if(!anchor)return false;
  layout=pieLayout(innerWidth,innerHeight,anchor,pieOptions(branch).length);
  const fan=layer.querySelector('.pie-fan');if(fan){fan.classList.toggle('compact',layout.compact);Object.assign(fan.style,{left:layout.x+'px',top:layout.y+'px',width:layout.width+'px',height:layout.height+'px'});}
  return true;
 }
 function render(focus=true){
  const sim=api.sim(),person=sim?.people.get(id);if(!person)return close();
  const previous=layer.contains(document.activeElement)?{...document.activeElement.dataset}:null;
  const ctx=context(),options=pieOptions(branch);layout=pieLayout(innerWidth,innerHeight,api.anchor?.(id)||point,options.length);
  const hint=!ctx.inRange?'Aproxime-se do personagem para conversar.':ctx.blocked?'Pare e guarde a arma para conversar.':sim.time<sim.relation('player',id).cooldown?'Aguarde a resposta…':'Escolha um assunto · Esc ou clique fora para fechar';
  layer.innerHTML=`<button class="pie-close" data-close aria-label="Fechar conversa">×</button><div class="pie-fan ${layout.compact?'compact':''}" role="group" aria-label="${esc(SOCIAL_TREE[branch].label)}"><div class="pie-center"><strong>${esc(person.name)}</strong><button class="pie-back" data-back aria-label="${trail.length?'Voltar à categoria anterior':'Fechar conversa'}">${trail.length?'‹ ':''}${esc(SOCIAL_TREE[branch].label)}${trail.length?'':' ×'}</button></div>${options.map((o,i)=>{const reason=o.branch?'':actionUnavailable(sim,id,o.id,ctx),words=o.label.split(' '),icon=o.branch?o.icon:words.shift(),label=o.branch?o.label:words.join(' '),slot=layout.slots[i];return `<button class="pie-pill" style="left:calc(50% + ${slot.x}px);top:calc(50% + ${slot.y}px);width:${layout.buttonWidth}px;animation-delay:${i*16}ms" data-${o.branch?'branch':'action'}="${esc(o.id)}" ${o.branch?'aria-haspopup="menu"':''} ${reason?'aria-disabled="true"':''} data-reason="${esc(reason)}" aria-label="${esc(label+(reason?'. Bloqueado: '+reason:''))}" title="${esc(reason||label)}"><span class="pie-icon" aria-hidden="true">${reason?'🔒':icon}</span><span>${esc(label)}${o.branch?'…':''}</span>${o.branch?'<span class="pie-branch-arrow" aria-hidden="true">›</span>':''}</button>`;}).join('')}</div><p class="pie-hint" role="status">${esc(hint)}</p>`;
  position();bars();if(focus)(layer.querySelector('.pie-pill:not([aria-disabled="true"])')||layer.querySelector('.pie-back'))?.focus({preventScroll:true});
  else if(previous){const key=['branch','action','back','close'].find(k=>k in previous);if(key)layer.querySelector(`[data-${key}${previous[key]?`="${previous[key]}"`:''}]`)?.focus({preventScroll:true});}
 }
 function open(target,anchor){
  if(layer.open||!api.sim()?.people.has(target)||document.querySelector('dialog[open]'))return false;
  id=target;point=anchor||api.anchor?.(id)||{x:innerWidth/2,y:innerHeight/2};branch='root';trail=[];previousFocus=document.activeElement;api.release();feedback.hidden=true;signature='';render(false);layer.showModal();layer.querySelector('.pie-pill')?.focus({preventScroll:true});return true;
 }
 function close(){if(layer.open)layer.close();}
 layer.addEventListener('close',()=>{api.release();api.sim()?.save();expiry=performance.now()+6500;previousFocus?.focus?.({preventScroll:true});});
 layer.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button){if(event.target===layer)close();return;}
  if(button.dataset.reason){layer.querySelector('.pie-hint').textContent=button.dataset.reason;return;}
  if(button.hasAttribute('data-close'))return close();
  if(button.hasAttribute('data-back')){if(!trail.length)return close();branch=trail.pop();return render();}
  if(button.dataset.branch){trail.push(branch);branch=button.dataset.branch;return render();}
  if(button.dataset.action){const result=api.act(id,button.dataset.action);if(result.ok){bars();feedback.textContent=result.text;feedback.hidden=false;close();}else{const hint=layer.querySelector('.pie-hint');hint.textContent=result.text;}}
 });
 for(const event of ['mouseover','focusin'])layer.addEventListener(event,e=>{const reason=e.target.closest('[data-reason]')?.dataset.reason;if(reason)layer.querySelector('.pie-hint').textContent=reason;});
 layer.addEventListener('keydown',event=>{
  event.stopPropagation();
  if(event.key==='Escape'){event.preventDefault();if(trail.length){branch=trail.pop();render();}else close();}
  else if(event.key==='Backspace'){event.preventDefault();if(trail.length){branch=trail.pop();render();}}
  else if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const buttons=[...layer.querySelectorAll('.pie-pill:not([aria-disabled="true"])')],index=buttons.indexOf(document.activeElement),step=event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1;buttons[(index+step+buttons.length)%buttons.length]?.focus();}
  else if(!['Tab','Enter',' '].includes(event.key))event.preventDefault();
 });
 layer.addEventListener('cancel',event=>{event.preventDefault();if(trail.length){branch=trail.pop();render();}else close();});
 window.addEventListener('resize',()=>{if(layer.open)render(false);});
 return {open,close,get active(){return layer.open;},get target(){return layer.open?id:null;},update(){
  if(layer.open){if(api.available&&!api.available(id)){close();return;}api.release();position();// assinatura só do que muda as opções: CityLife inteiro (relógio, posições) mudava a cada quadro, refazia o leque sem
   // parar (a animação de entrada nunca terminava e as categorias ficavam invisíveis) e serializava o objeto todo por quadro
   const sim=api.sim(),{cityLife,...ctx}=context(),r=sim.relation('player',id),state=JSON.stringify([ctx,Math.floor(cityLife?.funds??-1),sim.time<r.cooldown,r.friend,r.trust,r.intimacy,r.hostility,r.romance,r.dating,r.hurt,r.blockedUntil>sim.time,r.romanceBoundaryUntil>sim.time,r.memories.length]);if(state!==signature){signature=state;render(false);}}
  else if(!status.hidden&&performance.now()>expiry){status.hidden=true;feedback.hidden=true;}
 }};
}
