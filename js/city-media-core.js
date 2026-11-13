// City of God media core — browser/Node compatible pure helpers.
'use strict';
(function(root,factory){
 const API=factory();if(typeof module==='object'&&module.exports)module.exports=API;
 root.CityMediaCore=API;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const STATIONS=Object.freeze([
  {id:'mix',name:'Rádio Mix FM · São Paulo',genre:'Hits / Pop',url:'https://playerservices.streamtheworld.com/api/livestream-redirect/MIXFM_SAOPAULOAAC.aac'},
  {id:'antena1',name:'Antena 1 · Porto Alegre',genre:'Adulta / Flashback',url:'https://antenaone.crossradio.com.br/stream/1'},
  {id:'jovempanbh',name:'Jovem Pan FM · Belo Horizonte',genre:'Pop / Rock',url:'https://8062.brasilstream.com.br/stream?origem=task_site'},
  {id:'sertaneja',name:'Sertaneja 106.7',genre:'Sertanejo',url:'https://sc4s.cdn.upx.com:8067/stream'},
  {id:'fmodia',name:'FM O Dia · Rio',genre:'Pagode / Samba',url:'https://wz7.servidoresbrasil.com:8274/stream'},
  {id:'novidades80',name:'80 Hits Brasil',genre:'Anos 80 / MPB',url:'https://stm5.painelcast.com:7662/stream'},
  {id:'rock98',name:'98 Rock · BH',genre:'Rock',url:'https://8185.brasilstream.com.br/stream'}
 ]);
 const youtubeId=input=>{
  if(typeof input!=='string'||input.length>2048)return null;
  let u;try{u=new URL(input.trim());}catch{return null;}
  if(u.protocol!=='https:'&&u.protocol!=='http:')return null;
  const host=u.hostname.toLowerCase().replace(/^www\./,'').replace(/^m\./,'');
  let id=null;
  if(host==='youtu.be')id=u.pathname.split('/')[1];
  else if(['youtube.com','youtube-nocookie.com','music.youtube.com'].includes(host)){
   if(u.pathname==='/watch')id=u.searchParams.get('v');
   else if(/^\/(embed|shorts|live)\//.test(u.pathname))id=u.pathname.split('/')[2];
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(id||'')?id:null;
 };
 const cleanWS=value=>{
  if(typeof value!=='string')return '';
  try{const u=new URL(value);return ['wss:','ws:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}
 };
 const roomAt=(house,floor,x,y,roomsFn)=>{
  const level=Number.isInteger(floor)?floor:0;
  let room=null;
  try{room=roomsFn?.(house,level,x,y)||null;}catch{}
  return String(level)+':'+(room?.id||'open-floor');
 };
 const roomRef=(house,room,idFn)=>{
  const homeKey=idFn?.(house)||('house:'+Math.round(house.x0)+':'+Math.round(house.y0));
  return homeKey+'|'+room;
 };
 const inside=(house,player,floor)=>{
  if(!house||!player||Math.round(player.floor||0)!==Math.round(floor||0))return false;
  if(typeof house.contains==='function'){
   try{return !!house.contains(player.x,player.y,player.floor||0);}catch{return false;}
  }
  return player.x>house.x0&&player.x<house.x1&&player.y>house.y0&&player.y<house.y1;
 };
 const canHear=(house,player,room,roomsFn)=>{
  if(!inside(house,player,Number(room.split(':')[0])))return false;
  return room===roomAt(house,player.floor||0,player.x,player.y,roomsFn);
 };
 const screenId=(item,house,houseKey)=>{
  const id=String(item.homeId||item.id||('xy:'+Math.round(item.x*10)+':'+Math.round(item.y*10)+':'+(item.floor||0)));
  return String(houseKey)+':screen:'+id.slice(0,150);
 };
 const safeState=record=>{
  if(!record||typeof record!=='object'||typeof record.screen!=='string'||record.screen.length>220||typeof record.room!=='string'||record.room.length>230)return null;
  const video=record.video===null?null:youtubeId('https://youtube.com/watch?v='+String(record.video||''));
  if(record.video!==null&&!video)return null;
  const at=Number(record.at);
  return {screen:record.screen,room:record.room,video,playing:!!record.playing,
   at:Number.isFinite(at)&&at>0?Math.min(at,4102444800000):Date.now()};
 };
 return {STATIONS,youtubeId,roomAt,roomRef,screenId,inside,canHear,safeState,cleanWS};
});
