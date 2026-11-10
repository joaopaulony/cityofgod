const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=file=>fs.readFileSync(file,'utf8');

test('title and loading use a code-only brand and no illustrated background assets',()=>{
 const html=read('index.html'),front=read('js/front-end.js'),css=read('css/front-end.css');
 assert.equal(html.includes('rel="preload" as="image"'),false);
 assert.equal(html.includes('<img class="front-logo"'),false);
 for(const legacy of ['logo.webp','bairro-entardecer','avenida-noturna','cotidiano-em-casa','#front-art','#front-next'])
   assert.equal(front.includes(legacy),false,'legacy illustrated menu: '+legacy);
 assert.ok(html.includes('class="front-wordmark"'));
 assert.ok(front.includes('class="front-loading-wordmark"'));
 assert.ok(css.includes('#front-backdrop::before'));
 assert.ok(css.includes('body.front-live #front-backdrop{opacity:0'));
 assert.ok(css.includes('body.front-open.front-live>canvas{visibility:visible'));
});

test('quiet title warmup uses original progress snapshot, not data created by preview',()=>{
 const front=read('js/front-end.js');
 for(const required of [
  'const hadProgressOnEntry=S.hasProgress(storage)',
  "canContinue=started||hadProgressOnEntry",
  "if(hadProgressOnEntry||started)open('new-confirm')",
  'start(hadProgressOnEntry,{quiet:true})',
  "if(next==='title')queueMenuWorld()",
  "if(quiet&&phase!=='loading'){quietReady=true",
  'markLive()'
 ])assert.ok(front.includes(required),'missing safe menu feature: '+required);
});

test('menu actor is from the real scene and camera returns on game start',()=>{
 const game=read('js/game.js');
 for(const required of [
  'const actor=menuExtra&&!menuExtra.dead?menuExtra:player',
  'window.cityCharacters.spawnExtra(p.x,p.y',
  'window.cityCharacters?.removeExtra?.(menuExtra)',
  'cam.tx=x-ox;cam.ty=y-oy',
  'cam.tx=player.x;cam.ty=player.y',
  'if(drone.saved)droneEnd()',
  'frontFrameDebt>=1/30',
  'h.clearRect(0,0,hudC.width,hudC.height)'
 ])assert.ok(game.includes(required),'missing live character support: '+required);
});
