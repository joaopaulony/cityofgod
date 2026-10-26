// Small in-game monthly calendar, with extensible public holiday/event hooks.
(function(root){
 'use strict';
 let panel=null,visible=false,offset=0;
 const names=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
 function render(){
  if(!panel)return;
  const c=root.CityCalendar?.get();if(!c)return;
  const d=new Date(Date.UTC(c.year,c.month-1+offset,1)),year=d.getUTCFullYear(),month=d.getUTCMonth()+1;
  const start=d.getUTCDay(),days=new Date(Date.UTC(year,month,0)).getUTCDate();
  let html='<div class="city-calendar-bar"><strong>CALENDÁRIO · '+names[month-1].toUpperCase()+' '+year+'</strong><button data-cal="-1" aria-label="Mês anterior">‹</button><button data-cal="1" aria-label="Próximo mês">›</button><button data-cal="today">Hoje</button><button data-cal="close" aria-label="Fechar calendário">×</button></div>';
  html+='<p>'+c.weekdayName+' · '+String(c.day).padStart(2,'0')+'/'+String(c.month).padStart(2,'0')+'/'+c.year+' · '+c.season+' · '+(root.envWeather?.().name||'Tempo')+'</p>';
  html+='<div class="city-calendar-days">';
  for(const wd of ['D','S','T','Q','Q','S','S'])html+='<b>'+wd+'</b>';
  for(let i=0;i<start;i++)html+='<i></i>';
  for(let i=1;i<=days;i++){
   const events=c&&root.CityCalendar.eventsFor(month,i),today=year===c.year&&month===c.month&&i===c.day;
   html+='<span class="'+(today?'today ':'')+(events.length?'event':'')+'" title="'+events.map(x=>x.label).join(', ')+'">'+i+(events.length?' •':'')+'</span>';
  }
  html+='</div><small>• Datas especiais · Tecla J fecha/abre · Dia do jogo: 24 minutos reais</small>';
  panel.innerHTML=html;
 }
 function toggle(force){visible=typeof force==='boolean'?force:!visible;
  if(!panel)mount();panel.hidden=!visible;if(visible){offset=0;render();}return visible;}
 function mount(){
  if(panel)return;
  panel=document.createElement('section');panel.id='city-calendar-panel';panel.hidden=true;
  panel.setAttribute('aria-label','Calendário do jogo');document.body.append(panel);
  panel.addEventListener('click',e=>{const action=e.target?.dataset?.cal;
   if(action==='close')toggle(false);else if(action==='today'){offset=0;render();}
   else if(action==='-1'||action==='1'){offset=Math.max(-120,Math.min(120,offset+Number(action)));render();}});
  root.CityCalendar?.on('day',()=>{if(visible)render();});
 }
 root.CityCalendarUI={mount,render,toggle,get visible(){return visible;}};
})(globalThis);
