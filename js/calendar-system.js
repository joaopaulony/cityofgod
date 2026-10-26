// Calendar shared by weather, NPC schedules, events and future economic systems.
(function(root){
 'use strict';
 const KEY='cityofgod.calendar.v1',ORIGIN=Date.UTC(2026,0,1),MINUTE=60000;
 const PT_MONTH=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
 const PT_DAY=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
 const hooks=new Map(),special=new Map();
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 let minutes=17*60+40,autosave=0;
 try{const saved=JSON.parse(root.localStorage?.getItem(KEY)||'null');
  if(saved&&saved.version===1&&Number.isFinite(saved.minutes)&&saved.minutes>=0)minutes=saved.minutes;
 }catch(_){}
 const get=()=>{
  const date=new Date(ORIGIN+Math.floor(minutes)*MINUTE);
  const y=date.getUTCFullYear(),m=date.getUTCMonth(),d=date.getUTCDate(),h=date.getUTCHours(),min=date.getUTCMinutes();
  const season=m>=2&&m<=4?'primavera':m>=5&&m<=7?'verão':m>=8&&m<=10?'outono':'inverno';
  const start=Date.UTC(y,0,1);
  return {year:y,month:m+1,day:d,weekday:date.getUTCDay(),weekdayName:PT_DAY[date.getUTCDay()],
   monthName:PT_MONTH[m],hour:h,minute:min,dayOfYear:Math.floor((Date.UTC(y,m,d)-start)/86400000)+1,
   season,iso:String(y)+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'),
   minutesOfDay:((minutes%1440)+1440)%1440,
   timestamp:minutes};
 };
 const emit=(type,payload)=>{for(const fn of hooks.get(type)||[])try{fn(payload);}catch(e){console.error('CityCalendar',e);}};
 function publish(before,after){
  if(before.iso!==after.iso){emit('day',after);emit('date',after);}
  if(before.month!==after.month||before.year!==after.year)emit('month',after);
  if(before.season!==after.season)emit('season',after);
  if(before.year!==after.year)emit('year',after);
 }
 function save(){try{root.localStorage?.setItem(KEY,JSON.stringify({version:1,minutes}));}catch(_){}}
 function setMinutes(value){if(!Number.isFinite(value)||value<0)throw Error('Invalid game calendar timestamp');
  const before=get();minutes=value;const after=get();publish(before,after);return after;}
 function advance(realSeconds){if(!Number.isFinite(realSeconds)||realSeconds<=0)return get();
  const next=setMinutes(minutes+Math.min(realSeconds,120)*1);
  if((autosave+=realSeconds)>=30){autosave=0;save();}
  return next;
 }
 function setDate(year,month,day,hour=12,minute=0){
  if(!Number.isInteger(year)||year<2026||year>2200||!Number.isInteger(month)||month<1||month>12||
     !Number.isInteger(day)||day<1||day>31||hour<0||hour>=24||minute<0||minute>=60)throw Error('Invalid game date');
  const utc=Date.UTC(year,month-1,day,hour,minute),d=new Date(utc);
  if(d.getUTCMonth()!==month-1||d.getUTCDate()!==day)throw Error('Invalid calendar day');
  const next=setMinutes((utc-ORIGIN)/MINUTE);save();return next;
 }
 function setTimeOfDay(time){if(!Number.isFinite(time))throw Error('Invalid hour');const v=clamp(time,0,1439.999);
  return setMinutes(Math.floor(minutes/1440)*1440+v);}
 function on(type,fn){if(typeof fn!=='function')throw Error('Listener must be function');
  if(!hooks.has(type))hooks.set(type,new Set());hooks.get(type).add(fn);return ()=>hooks.get(type)?.delete(fn);}
 function registerEvent(id,month,day,label){if(!id||month<1||month>12||day<1||day>31)return false;
  special.set(id,{id,month,day,label:String(label||id)});return true;}
 function eventsFor(month,day){return [...special.values()].filter(x=>x.month===month&&x.day===day);}
 for(const [id,m,d,name] of [['ano-novo',1,1,'Ano-Novo'],['carnaval',2,15,'Festival de verão'],['primavera',3,20,'Início da primavera'],['trabalho',5,1,'Dia do Trabalho'],['verao',6,21,'Início do verão'],['outono',9,22,'Início do outono'],['halloween',10,31,'Halloween'],['inverno',12,21,'Início do inverno'],['natal',12,25,'Natal']])registerEvent(id,m,d,name);
 const api={get,advance,setDate,setTimeOfDay,save,on,registerEvent,eventsFor,
  get minutesOfDay(){return get().minutesOfDay;},get season(){return get().season;},
  format(){const d=get();return String(d.day).padStart(2,'0')+'/'+String(d.month).padStart(2,'0')+'/'+d.year+' '+String(d.hour).padStart(2,'0')+':'+String(d.minute).padStart(2,'0');}};
 root.CityCalendar=api;
 root.addEventListener?.('pagehide',save);
 if(typeof module!=='undefined')module.exports=api;
})(globalThis);
