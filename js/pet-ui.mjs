import {PET_BREEDS,petBreed,petColor} from './pet-catalog.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountPetUI(api){
 const entry=document.createElement('button');entry.id='city-pets-entry';entry.type='button';entry.textContent='🐾 Pets · F8';entry.onclick=()=>open();document.body.append(entry);
 const dialog=document.createElement('dialog');dialog.id='city-pets';dialog.setAttribute('aria-labelledby','city-pets-title');document.body.append(dialog);
 const chosen=new Map(),names=new Map();let lastFocus=null;
 const release=()=>{api.releaseControls();};
 function render(){
  const scroll=dialog.scrollTop;
  const family=api.controller.rows.map(row=>{
   const breed=petBreed(row.breed),pet=api.controller.pets.find(p=>p.id===row.id);
   return `<article class="pet-family"><img src="${api.portrait(row.breed,row.color)}" alt="${esc(breed.name)}"><div><strong>${esc(row.name)}</strong><small>${esc(breed.name)} · ${esc(petColor(breed,row.color).name)}</small><p data-pet-status="${esc(row.id)}">${esc(pet?.status||'Em casa · fora desta região')}</p><div class="pet-commands">${[['follow','Chamar para passear'],['wait','Esperar aqui'],['home','Voltar para casa']].map(([cmd,label])=>`<button data-pet-command="${cmd}" data-pet-id="${esc(row.id)}" ${pet?.homeHouse?'':'disabled'}>${label}</button>`).join('')}</div></div></article>`;
  }).join('');
  dialog.innerHTML=`<header><div><span class="pet-eyebrow">CITY OF GOD · COMPANHEIROS</span><h1 id="city-pets-title">Uma casa com mais vida.</h1><p>Cães e gatos para dividir a rotina e explorar a cidade com você.</p></div><button class="pet-close" data-pet-close aria-label="Fechar painel de pets">✕</button></header>
  <section class="pet-family-section"><div class="pet-section-title"><h2>Sua família <span>${api.controller.count}</span></h2><div class="pet-commands"><button data-pet-command="follow" data-pet-id="all">🐾 Chamar todos</button><button data-pet-command="home" data-pet-id="all">Voltar para casa</button></div></div>${family||'<p class="pet-empty">Seu primeiro companheiro está logo abaixo. Entre em uma casa sua para recebê-lo.</p>'}</section>
  <div class="pet-section-title"><h2>Encontre seu companheiro</h2><small>Até seis pets por casa · sem custo no jogo</small></div>
  <section class="pet-catalog">${PET_BREEDS.map(b=>{
   const color=chosen.get(b.id)||b.colors[0].id;
   return `<article class="pet-card"><div class="pet-portrait"><img src="${api.portrait(b.id,color)}" alt="${esc(b.name)}"></div><div class="pet-card-content"><span class="pet-type">${b.label}</span><h3>${b.name}</h3><label>Pelagem<select data-pet-color="${b.id}">${b.colors.map(c=>`<option value="${c.id}" ${c.id===color?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label>Nome<input data-pet-name="${b.id}" maxlength="24" value="${esc(names.get(b.id)||b.names[0])}"></label><button class="pet-adopt" data-pet-adopt="${b.id}" ${api.controller.home?'':'disabled'}>Adicionar à família</button></div></article>`;
  }).join('')}</section><footer>F8 abre este painel. Os pets passeiam a pé, seguem portas e caminhos livres e esperam quando você entra em um veículo.</footer>`;
  dialog.scrollTop=scroll;
 }
 function open(){
  if(dialog.open)return;
  if(api.otherModal())return;
  lastFocus=document.activeElement;release();render();dialog.showModal();dialog.querySelector('[data-pet-close]').focus();
 }
 function close(){if(dialog.open)dialog.close();}
 dialog.addEventListener('close',()=>{release();lastFocus?.focus?.();});
 dialog.addEventListener('click',e=>{
  if(e.target===dialog&&e.offsetX>=dialog.clientWidth){close();return;}
  if(e.target.closest('[data-pet-close]')){close();return;}
  const adopt=e.target.closest('[data-pet-adopt]');
  if(adopt){const b=petBreed(adopt.dataset.petAdopt),r=api.controller.adopt(b.id,chosen.get(b.id)||b.colors[0].id,names.get(b.id)||b.names[0]);api.notify(r.text);render();return;}
  const command=e.target.closest('[data-pet-command]');
  if(command){const result=api.controller.command(command.dataset.petId,command.dataset.petCommand);api.notify(result.text);if(result.ok)close();}
 });
 dialog.addEventListener('input',e=>{if(e.target.dataset.petName)names.set(e.target.dataset.petName,e.target.value);});
 dialog.addEventListener('change',e=>{if(e.target.dataset.petColor){chosen.set(e.target.dataset.petColor,e.target.value);render();}});
 dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='F8'){e.preventDefault();close();}});
 window.addEventListener('keydown',e=>{
  if(e.key!=='F8'||e.repeat||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  e.preventDefault();e.stopImmediatePropagation();dialog.open?close():open();
 },true);
 return {open,close,get active(){return dialog.open;},refresh(){if(dialog.open)for(const pet of api.controller.pets){const el=dialog.querySelector(`[data-pet-status="${pet.id}"]`);if(el)el.textContent=pet.status;}}};
}
