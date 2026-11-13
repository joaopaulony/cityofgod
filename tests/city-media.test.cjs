const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const C=require('../js/city-media-core.js');
const read=name=>fs.readFileSync('js/'+name,'utf8');
test('YouTube parser accepts links, shorts and mobile, rejecting other sites',()=>{
 for(const u of [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ?t=40',
  'https://m.youtube.com/shorts/dQw4w9WgXcQ',
  'https://www.youtube.com/live/dQw4w9WgXcQ',
  'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
 ])assert.equal(C.youtubeId(u),'dQw4w9WgXcQ');
 for(const u of ['https://youtube.com.evil.io/watch?v=dQw4w9WgXcQ','javascript:alert(1)','https://youtu.be/invalid','https://www.youtube.com/watch?v=%3Cscript%3E'])
  assert.equal(C.youtubeId(u),null);
});
test('Only valid media room and WebSocket URLs are accepted',()=>{
 assert.equal(C.cleanWS('wss://city-media.example.org/ws'),'wss://city-media.example.org/ws');
 assert.equal(C.cleanWS('javascript:alert(1)'),'');
 assert.equal(C.cleanWS('https://evil.example.com'),'');
 assert.equal(C.cleanWS('wss://user:pass@example.com/'),'');
});
test('Room-aware sound is restricted to correct house, room and floor',()=>{
 const H={x0:0,x1:12,y0:0,y1:15,contains(x,y){return x>0&&x<12&&y>0&&y<15;}};
 const roomFn=(h,f,x,y)=>({id:x<6?'sala':'cozinha'});
 const listen={x:4,y:5,floor:0},otherRoom={x:9,y:5,floor:0},up={x:4,y:5,floor:1},outside={x:24,y:5,floor:0};
 assert.equal(C.roomAt(H,0,3,3,roomFn),'0:sala');
 assert.equal(C.roomAt(H,0,9,3,roomFn),'0:cozinha');
 assert.equal(C.canHear(H,listen,'0:sala',roomFn),true);
 for(const p of [otherRoom,up,outside])assert.equal(C.canHear(H,p,'0:sala',roomFn),false);
 const irregular={...H,contains(x,y){return x<4&&y<10;}};
 assert.equal(C.canHear(irregular,{x:5,y:4,floor:0},'0:sala',roomFn),false);
});
test('Screen keys are deterministic and stable between clients',()=>{
 const H={x0:3,y0:5};
 const item={kind:'tv',homeId:'tv:abc',id:'itemX',x:7,y:8,floor:0};
 assert.equal(C.screenId(item,H,'seed:house1'),'seed:house1:screen:tv:abc');
 assert.equal(C.screenId({...item},H,'seed:house1'),C.screenId(item,H,'seed:house1'));
});
test('Remote TV snapshots reject malformed video IDs and invalid data',()=>{
 assert.equal(C.safeState({screen:'A',room:'0:sala',video:'abc',at:10}),null);
 assert.equal(C.safeState({screen:'A',room:'0:sala',video:null,playing:false,at:10}).playing,false);
 assert.equal(C.safeState({screen:'A',room:'0:sala',video:'dQw4w9WgXcQ',playing:true,at:123}).video,'dQw4w9WgXcQ');
});
test('Real HTTPS stations are editable and car radio is wired into game',()=>{
 assert.ok(C.STATIONS.length>=5);
 assert.ok(C.STATIONS.every(r=>r.url.startsWith('https://')&&r.name&&r.id));
 assert.match(read('city-media.js'),/new Audio\(\)/);
 assert.match(read('city-media.js'),/audio\.play\(\)/);
 assert.match(read('city-media.js'),/YT\.Player/);
 assert.match(read('city-media.js'),/BroadcastChannel/);
 assert.match(read('city-media.js'),/syncNearbyRadio/);
 assert.match(read('city-media.js'),/broadcastRadio\(false\)/);
 assert.match(read('vehicle-webgl.mjs'),/mediaVehicleId/);
 assert.match(read('interiors.js'),/CityMedia\?\.openTV/);
 assert.match(read('city-home-plus.js'),/CityMedia\.openTV/);
 assert.match(read('game.js'),/CityMedia\?\.tick/);
 assert.match(read('game.js'),/CityMedia\?\.dialogOpen/);
 assert.match(read('city-media.js'),/screenEl\.style\.transform='matrix\('/);
 assert.match(read('city-media.js'),/Number\.isFinite\(m\.at\)\?m\.at:Date\.now\(\)/);
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/js\/city-media-core\.js/);
 assert.match(html,/js\/city-media\.js/);
});
