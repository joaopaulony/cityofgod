// Contextual interaction menu for domestic objects. Does not replace F for vehicles.
'use strict';
const CityClickInteractions=(()=>{
 let menu=null;
 const actions={
  bed:[['Dormir','sleep']],mattress:[['Dormir','sleep']],
  sofa:[['Sentar','sit']],couch:[['Sentar','sit']],sectional:[['Sentar','sit']],chair:[['Sentar','sit']],
  tv:[['Assistir','watch'],['Ligar / desligar','power']],
  screen:[['Usar monitor','watch'],['Ligar / desligar','power']],
  desk:[['Trabalhar','work']],studentdesk:[['Estudar','work']],
  shower:[['Tomar banho','wash']],toilet:[['Usar banheiro','toilet']],
  stove:[['Cozinhar','cook']],fridge:[['Abrir geladeira','fridge']],
  sink:[['Beber água','drink']],microwave:[['Comer','eat']],
  cabinet:[['Abrir / fechar','open']],wardrobe:[['Abrir / fechar','open']],
  switch:[['Ligar / desligar luzes','switch']],
  door:[['Abrir / fechar porta','door']],window:[['Abrir / fechar janela','window']]
 };
 const labels={tv:'Televisão',screen:'Monitor',switch:'Interruptor',door:'Porta',window:'Janela'};
 const close=()=>{if(menu){menu.remove();menu=null;}};
 function candidates(p){
  const items=[];
  for(const H of window.__game?.houses||[]){
   // A player can stand on a threshold while the target object is inside.
   // Do not gate selection on contains(): range and property access are checked separately.
   if(p.x<H.x0-5||p.x>H.x1+5||p.y<H.y0-5||p.y>H.y1+5)continue;
   for(const b of H.interactables||[])if(actions[b.kind]&&(b.floor||0)===(p.floor||0))
    items.push({obj:b,kind:b.kind,house:H});
   for(const b of H.switches||[])if((b.floor||0)===(p.floor||0))
    items.push({obj:b,kind:'switch',house:H});
   const floor=p.floor||0;
   for(const seg of H.architecture?.levels?.[floor]?.segments||[])if(seg.door||seg.window)
    items.push({obj:{x:(seg.x1+seg.x2)/2,y:(seg.y1+seg.y2)/2,seg},kind:seg.door?'door':'window',house:H});
   for(const seg of H.segs||[])if(floor===0&&!seg.ext&&seg.door)
    items.push({obj:{x:(seg.x1+seg.x2)/2,y:(seg.y1+seg.y2)/2,seg},kind:'door',house:H});
  }
  return items;
 }
 function findAt(e){
  const G=window.__game,p=G?.player,v=document.getElementById('view');
  if(!p||!v||typeof proj!=='function')return null;
  const rect=v.getBoundingClientRect(),x=(e.clientX-rect.left)*v.width/rect.width,y=(e.clientY-rect.top)*v.height/rect.height;
  let best=null,dist=36*Math.max(v.width/rect.width,v.height/rect.height);
  for(const it of candidates(p)){
   if(Math.hypot(it.obj.x-p.x,it.obj.y-p.y)>2.6)continue;
   const q=proj(it.obj.x,it.obj.y,(it.obj.z||0)+Math.min(it.obj.h||1,1)*.5+(p.floor||0)*0);
   const d=Math.hypot(q.x-x,q.y-y);
   if(d<dist){dist=d;best=it;}
  }
  return best;
 }
 function execute(it,action){
  close();
  const G=window.__game,p=G?.player;
  if(!G||!p||Math.hypot(p.x-it.obj.x,p.y-it.obj.y)>2.8)return;
  const floor=it.obj.floor??it.obj.seg?.floor??p.floor??0,unit=it.obj.seg?it.obj.seg.unit:it.obj.unit;
  if(window.CityRealty&&!CityRealty.canUse(it.house,floor,unit)){
   window.CityUI?.notify?.('Imóvel privado · acesso restrito');return;
  }
  let msg='';
  if(action==='power'&&['tv','screen'].includes(it.kind)){
   it.obj.screenOn=!it.obj.screenOn;
   if(it.kind==='tv')it.house.tvOn=it.obj.screenOn;
   msg=it.obj.screenOn?'Tela ligada':'Tela desligada';
  }else if(it.obj.homeId&&window.CityHomePlus&&action!=='open'){
   const result=CityHomePlus.activity(it.house,it.obj.homeId,{action});
   msg=result.text;
   if(result.ok&&['watch','work'].includes(action))it.obj.screenOn=true;
  }else if(action==='switch'){
   if(window.CityHomePlus&&window.CityHome?.owned(it.house))msg=CityHomePlus.togglePower(it.house).text;
   else{it.house.lightOn=!it.house.lightOn;msg=it.house.lightOn?'Luzes acesas':'Luzes apagadas';}
  }else if(['door','window'].includes(action)){
   const key=action==='door'?'doorAnim':'windowAnim';
   const a=it.obj.seg[key]||(it.obj.seg[key]={open:0,target:0});
   a.manual=true;a.target=a.target>.5?0:1;msg=(action==='door'?'Porta':'Janela')+(a.target?' aberta':' fechada');
  }else if(action==='open'){it.obj.open=!it.obj.open;msg=it.obj.open?'Móvel aberto':'Móvel fechado';}
  else if(action==='watch'&&it.kind==='tv'){it.house.tvOn=!it.house.tvOn;it.obj.screenOn=it.house.tvOn;msg=it.house.tvOn?'Televisão ligada':'Televisão desligada';}
  else if(typeof useHouseInteraction==='function'){
   useHouseInteraction(p,G.st,performance.now()/1000,it);msg=G.st._interactionMessage;
  }
  if(msg)window.CityUI?.notify?.(msg);
 }
 function open(it,e){
  close();const el=document.createElement('div');el.id='city-context-menu';el.setAttribute('role','menu');
  const name=document.createElement('div');name.className='city-context-title';name.textContent=labels[it.kind]||window.CityHome?.catalog?.[it.kind]?.name||it.kind;el.appendChild(name);
  for(const [label,action] of actions[it.kind]||[]){
   const btn=document.createElement('button');btn.type='button';btn.textContent=label;
   btn.addEventListener('click',ev=>{ev.stopPropagation();execute(it,action);});el.appendChild(btn);
  }
  document.body.appendChild(el);menu=el;
  el.style.left=Math.max(8,Math.min(e.clientX,window.innerWidth-el.offsetWidth-8))+'px';
  el.style.top=Math.max(8,Math.min(e.clientY,window.innerHeight-el.offsetHeight-8))+'px';
 }
 function onPointer(e){
  if(e.button!==0||window.CityUI?.blocksGameInput?.()||window.CityHomeUI?.active||
   document.body.classList.contains('front-open')||window.cityVehicles?.driver)return;
  const it=findAt(e);
  if(!it){close();return;}
  e.preventDefault();e.stopImmediatePropagation();
  if(window.__game){window.__game.player.wantShot=false;window.__game.input.lmb=false;}
  open(it,e);
 }
 function mount(){
  const v=document.getElementById('view');if(!v||v.dataset.contextBound)return;
  v.dataset.contextBound='1';v.addEventListener('pointerdown',onPointer,true);
  document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target)&&e.target!==v)close();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();},true);
 }
 // Animated procedural programming: no external video bandwidth, copyrights or autoplay.
 // Rendered at the real position of each powered TV/monitor, only while visible indoors.
 function drawScreens(ctx,t){
  const G=window.__game,p=G?.player;if(!p||!ctx||typeof proj!=='function')return;
  if(document.body.classList.contains('front-open'))return;
  for(const H of G.houses||[]){
   if(!H.contains?.(p.x,p.y,p.floor||0))continue;
   for(const b of H.interactables||[]){
    if(!['tv','screen'].includes(b.kind)||(b.floor||0)!==(p.floor||0)||
     !(b.screenOn||b.kind==='tv'&&H.tvOn)||Math.hypot(b.x-p.x,b.y-p.y)>18)continue;
    if(window.CityHomePlus&&window.CityHome?.owned(H)&&!CityHomePlus.powerOn(H))continue;
    const q=proj(b.x,b.y,(b.z||0)+(b.h||.8)*.68);
    const width=Math.max(10,Math.min(90,(b.w||1)*G.cam.zoom*.55)),height=width*.52;
    if(q.x<0||q.y<0||q.x>ctx.canvas.width||q.y>ctx.canvas.height)continue;
    ctx.save();ctx.translate(q.x,q.y);ctx.rotate(-(b.rot||0)*.08);
    ctx.fillStyle='#091320';ctx.fillRect(-width/2,-height/2,width,height);
    ctx.save();ctx.beginPath();ctx.rect(-width/2+2,-height/2+2,width-4,height-4);ctx.clip();
    const phase=t*.8+(b.x+b.y)*.1;
    ctx.fillStyle='#193f5b';ctx.fillRect(-width/2,-height/2,width,height);
    const band=(Math.sin(phase)*.5+.5)*width;
    ctx.fillStyle='#2bb4c5';ctx.fillRect(-width/2+band-width*.55,-height*.22,width*.55,height*.45);
    ctx.fillStyle='#f5ae61';ctx.fillRect(-width/2+((t*18)% (width*1.5))-width*.25,height*.1,width*.36,height*.15);
    ctx.fillStyle='#c6f7fc';ctx.fillRect(-width*.37,-height*.36,width*.22,2);
    ctx.fillStyle='#ebf3ff';ctx.fillRect(-width*.36,height*.32,width*.4,2);
    ctx.restore();ctx.restore();
   }
  }
 }
 return {mount,close,drawScreens,findAt};
})();
window.CityClickInteractions=CityClickInteractions;
