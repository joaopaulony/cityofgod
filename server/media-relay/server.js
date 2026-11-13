// Lightweight media state relay. Never proxies video/audio; clients stream directly
// from YouTube and broadcasters. Room codes are invite secrets, not accounts.
import {createServer} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {randomUUID} from 'node:crypto';
const PORT=Number(process.env.PORT||8787);
const ALLOWED=new Set((process.env.MEDIA_ALLOWED_ORIGINS||
 'https://cityofgod-red.vercel.app,https://cityofgod.vercel.app,https://cityofgod-ei2zx1uam-joaopaulonys-projects.vercel.app,http://localhost:4322,http://127.0.0.1:4322').split(',').map(s=>s.trim()).filter(Boolean));
const rooms=new Map(),TTL=1000*60*60*6;
const validateId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{12,100}$/.test(s);
const safeScreen=s=>typeof s==='string'&&s.length<220&&/^[a-zA-Z0-9_:\-|.]+$/.test(s);
const safeRoom=s=>typeof s==='string'&&s.length<230&&/^[a-zA-Z0-9_:\-|.]+$/.test(s);
const videoID=s=>s===null||typeof s==='string'&&/^[a-zA-Z0-9_-]{11}$/.test(s);
const tx=(ws,data)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
const http=createServer((req,res)=>{res.writeHead(req.url==='/health'?200:404,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:req.url==='/health',service:'cityofgod-media-relay',rooms:rooms.size}));});
const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false,clientTracking:true});
const room=(id)=>{let r=rooms.get(id);if(!r){r={clients:new Set(),tvs:new Map(),radios:new Map(),at:Date.now()};rooms.set(id,r);}r.at=Date.now();return r;};
const broadcast=(r,data,except)=>{for(const client of r.clients)if(client!==except)tx(client,data);};
http.on('upgrade',(req,socket,head)=>{
 const origin=req.headers.origin||'';
 const u=new URL(req.url,'http://localhost');
 const id=u.searchParams.get('room');
 if(!ALLOWED.has(origin)||u.pathname!=='/ws'||!validateId(id)){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
 let r=room(id);
 if(r.clients.size>=48){socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>{ws.roomId=id;ws.peerId=randomUUID();ws.tokens=12;ws.lastRefill=Date.now();ws.isAlive=true;r.clients.add(ws);wss.emit('connection',ws,req);});
});
wss.on('connection',ws=>{
 const r=room(ws.roomId);
 tx(ws,{type:'snapshot',tvs:[...r.tvs.values()],radios:[...r.radios.values()],peers:r.clients.size});
 broadcast(r,{type:'peers',count:r.clients.size},ws);
 ws.on('pong',()=>{ws.isAlive=true;});
 ws.on('message',bytes=>{
  try{
   const now=Date.now();
   ws.tokens=Math.min(12,ws.tokens+(now-ws.lastRefill)/700);
   ws.lastRefill=now;if(ws.tokens<1)return;ws.tokens--;
   const obj=JSON.parse(String(bytes));if(!obj||typeof obj!=='object')return;
   if(obj.type==='tv'){
    if(!safeScreen(obj.screen)||!safeRoom(obj.room)||!videoID(obj.video))return;
    const state={type:'tv',screen:obj.screen,room:obj.room,video:obj.video,playing:!!obj.playing,at:now,revision:randomUUID()};
    r.tvs.set(obj.screen,state);
    if(r.tvs.size>150)r.tvs.delete(r.tvs.keys().next().value);
    broadcast(r,state,ws);
    tx(ws,{type:'ack',screen:state.screen,revision:state.revision,at:now});
   }else if(obj.type==='radio'){
    if(!safeScreen(obj.vehicle)||typeof obj.station!=='string'||!/^[-\w]{1,40}$/.test(obj.station))return;
    if(!Number.isFinite(obj.x)||!Number.isFinite(obj.y)||Math.abs(obj.x)>500000||Math.abs(obj.y)>500000)return;
    const state={type:'radio',vehicle:obj.vehicle,station:obj.station,playing:!!obj.playing,x:obj.x,y:obj.y,at:now};
    r.radios.set(obj.vehicle,state);
    if(r.radios.size>100)r.radios.delete(r.radios.keys().next().value);
    broadcast(r,state,ws);
   }else if(obj.type==='ping')tx(ws,{type:'pong',at:now});
  }catch{}
 });
 ws.on('close',()=>{r.clients.delete(ws);broadcast(r,{type:'peers',count:r.clients.size});r.at=Date.now();});
 ws.on('error',()=>{});
});
setInterval(()=>{
 const now=Date.now();
 for(const [id,r] of rooms){
  for(const [key,tv] of r.tvs)if(now-tv.at>TTL)r.tvs.delete(key);
  for(const [key,radio] of r.radios)if(now-radio.at>60000)r.radios.delete(key);
  if(!r.clients.size&&now-r.at>TTL)rooms.delete(id);
 }
 for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}
},30000).unref();
http.listen(PORT,'0.0.0.0',()=>console.log('City media relay listening',PORT));
export {http,wss,rooms};
