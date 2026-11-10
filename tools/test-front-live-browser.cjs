// QA visual real: npm start (porta 4322) e node tools/test-front-live-browser.cjs
// Requer Playwright e Chrome/Edge local. Usa o mapa e os modelos reais do jogo.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const base=process.env.CITY_TEST_URL||'http://127.0.0.1:4322';
const edge=process.platform==='win32'
 ? path.join(process.env['PROGRAMFILES(X86)']||'C:\\Program Files (x86)','Microsoft','Edge','Application','msedge.exe')
 : null;
const launchOptions={headless:true};
if(process.env.CHROME_PATH)launchOptions.executablePath=process.env.CHROME_PATH;
else if(edge&&fs.existsSync(edge))launchOptions.executablePath=edge;
(async()=>{
 const browser=await chromium.launch(launchOptions);
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'/?seed=123',{waitUntil:'domcontentloaded'});
  await page.locator('[data-front-action="new"]').waitFor();
  assert.equal(await page.evaluate(()=>CityFront.phase),'title');
  assert.equal(await page.locator('#city-front img').count(),0,'nenhuma imagem na tela de título');
  await page.waitForFunction(()=>document.body.classList.contains('front-live')
   &&window.__game?.player&&window.cityCharacters?.ready,
   null,{timeout:120000});
  await page.waitForTimeout(1800);
  const state=await page.evaluate(()=>({
   phase:CityFront.phase,
   frozen:__game.st.clock,
   player:proj(__game.player.x,__game.player.y,1),
   size:{w:cam.W,h:cam.H},
   previewModel:window.cityCharacters?.ready,
   checkpoint:localStorage.getItem('cityofgod.front.save.v1'),
   ui:document.querySelector('#city-front .front-wordmark')?.textContent,
   hidden:document.querySelector('#city-front')?.hidden
  }));
  assert.equal(state.phase,'title');
  assert.equal(state.hidden,false);
  assert.equal(state.previewModel,true);
  assert.equal(state.checkpoint,null,'vitrine não cria checkpoint de partida');
  assert.ok(state.player.x>state.size.w*.53&&state.player.x<state.size.w*.98,
   'jogador enquadrado na metade direita da tela: '+JSON.stringify(state));
  assert.ok(state.player.y>0&&state.player.y<state.size.h,'avatar aparece dentro da tela');
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>__game.st.clock),state.frozen,'relógio não progride no título');
  fs.mkdirSync('artifacts/front-end-live',{recursive:true});
  await page.screenshot({path:'artifacts/front-end-live/menu-real-com-personagem.png'});
  await page.locator('[data-front-action="new"]').click();
  await page.waitForFunction(()=>CityFront.phase==='playing',{timeout:20000});
  assert.equal(await page.evaluate(()=>document.querySelector('#city-front').hidden),true);
  assert.ok(errors.length===0,'Erros de JS: '+errors.join(' | '));
  await page.screenshot({path:'artifacts/front-end-live/jogo-apos-titulo.png'});
  console.log(JSON.stringify({success:true,state,errors,screenshots:[
   'artifacts/front-end-live/menu-real-com-personagem.png',
   'artifacts/front-end-live/jogo-apos-titulo.png'
  ]},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
