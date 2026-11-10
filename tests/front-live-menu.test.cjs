const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=file=>fs.readFileSync(file,'utf8');
test('logo original, apresentação BETA e uma única imagem até o mapa real',()=>{
 const html=read('index.html'),front=read('js/front-end.js'),css=read('css/front-end.css');
 assert.ok(html.includes('src="assets/menu/v1/logo.webp"'));
 assert.ok(front.includes('class="front-logo"'));
 assert.ok(front.includes('class="front-preview-art"'));
 assert.ok(front.includes('avenida-noturna.webp'));
 assert.ok(front.includes('class="front-preview-logo"'));
 assert.ok(front.includes('class="front-beta-chip">BETA'));
 assert.ok(front.includes('JOGO EM DESENVOLVIMENTO'));
 assert.ok(css.includes('body.front-live #front-backdrop{opacity:0'));
 assert.ok(css.includes('body.front-open.front-live>canvas{visibility:visible'));
 assert.equal(front.includes('class="front-wordmark"'),false);
 assert.equal(front.includes('class="front-loading-wordmark"'),false);
});
test('o pré-carregamento preserva saves e espera a região do jogador ao retornar',()=>{
 const front=read('js/front-end.js');
 for(const required of [
  'const hadProgressOnEntry=S.hasProgress(storage)',
  "canContinue=started||hadProgressOnEntry",
  "if(hadProgressOnEntry||started)open('new-confirm')",
  'start(hadProgressOnEntry,{quiet:true})',
  "if(quiet&&phase!=='loading'){quietReady=true",
  'game?.needsPlayerSector?.()','game.preparePlay?.()','game.previewReady?.()!==false','markLive()'
 ])assert.ok(front.includes(required),'missing: '+required);
});
test('o drone visita vias reais do centro sem criar personagem figurante',()=>{
 const game=read('js/game.js');
 for(const required of [
  'OW.geo?.anchors?.downtown','OW.cw?.roads||[]','const sceneX=drone.x+orbitX',
  'cam.ttilt=compact?.81:.84','cam.tzoom=compact?15:18','dronePreviewReady()',
  'preparePlayerRegion','cam.x=cam.tx=player.x;cam.y=cam.ty=player.y',
  'if(drone.saved)droneEnd()','frontFrameDebt>=1/30'
 ])assert.ok(game.includes(required),'missing: '+required);
 assert.equal(game.includes('menuExtra'),false);
 assert.equal(game.includes('ensureMenuExtra'),false);
 assert.ok(game.includes('async function preparePlay()'));
});
