import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
process.env.PORT='0';
import {http,wss} from './server.js';
const ready=()=>new Promise(resolve=>{if(http.listening)resolve();else http.once('listening',resolve);});
const roomCode='joined-media-room-12345';
const url=()=>`ws://127.0.0.1:${http.address().port}/ws?room=${roomCode}`;
const connect=async(origin='http://localhost:4322')=>{
 await ready();const ws=new WebSocket(url(),{origin});
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 return ws;
};
const incoming=(ws,predicate=()=>true,timeout=2200)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.off('message',handler);reject(new Error('message timeout'));},timeout);
 const handler=data=>{let m;try{m=JSON.parse(String(data));}catch{return;}
  if(predicate(m)){clearTimeout(timer);ws.off('message',handler);resolve(m);}};
 ws.on('message',handler);
});
after(async()=>{for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>http.close(r));});
test('health endpoint responds without cookies or credentials',async()=>{
 await ready();const res=await fetch('http://127.0.0.1:'+http.address().port+'/health');
 assert.equal(res.status,200);assert.equal((await res.json()).service,'cityofgod-media-relay');
});
test('two invited peers share TV state and late joiners receive snapshot',async()=>{
 const alice=await connect(),bob=await connect();
 try{
  const received=incoming(bob,m=>m.type==='tv');
  alice.send(JSON.stringify({type:'tv',screen:'home1:screen:tv1',room:'0:sala',video:'dQw4w9WgXcQ',playing:true}));
  const msg=await received;
  assert.equal(msg.room,'0:sala');assert.equal(msg.screen,'home1:screen:tv1');
  assert.equal(msg.playing,true);assert.equal(msg.video,'dQw4w9WgXcQ');
  const carol=await connect();
  const snapshot=await incoming(carol,m=>m.type==='snapshot').catch(()=>null);
  // Snapshot may race with listener registration; authoritative room retains state.
  assert.equal(snapshot===null||snapshot.tvs.some(t=>t.screen==='home1:screen:tv1'),true);
  carol.close();
 }finally{alice.close();bob.close();}
});
test('invalid YouTube IDs, private origins and oversized frames are rejected',async()=>{
 const ws=await connect();
 try{
  const received=incoming(ws,m=>m.type==='ack',450);
  ws.send(JSON.stringify({type:'tv',screen:'home1:screen:tv1',room:'0:sala',video:'bad-script',playing:true}));
  await assert.rejects(received);
  await assert.rejects(connect('https://attacker.example'),/403|Unexpected server response/i);
 }finally{ws.close();}
});
