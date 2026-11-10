// QA visual real: npm start; node tools/test-front-live-browser.cjs
// Requer playwright instalado e Chrome/Edge.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.CITY_TEST_URL||'http://127.0.0.1:4322';
const launchOptions={headless:true};
const edge=process.platform==='win32'
 ?path.join(process.env['PROGRAMFILES(X86)']||'C:\\Program Files (x86)','Microsoft','Edge','Application','msedge.exe'):null;
if(process.env.CHROME_PATH)launchOptions.executablePath=process.env.CHROME_PATH;
else if(edge&&fs.existsSync(edge))launchOptions.executablePath=edge;
(async()=>{
 const browser=await chromium.launch(launchOptions);
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-front-action="new"]').waitFor();
  assert.equal(await page.evaluate(()=>CityFront.phase),'title');
  assert.equal(await page.locator('#front-backdrop .front-beta-chip').textContent(),'BETA');
  assert.ok(await page.locator('#front-backdrop .front-preview-art').count());
  assert.ok(await page.locator('#front-backdrop .front-preview-logo').count());
  assert.equal(await page.locator('#city-front .front-wordmark').count(),0);
  fs.mkdirSync('artifacts/front-end-live',{recursive:true});
  await page.screenshot({path:'artifacts/front-end-live/apresentacao-beta.png'});
  await page.waitForFunction(()=>document.body.classList.contains('front-live')&&
   window.__game&&window.CityFront.phase==='title',null,{timeout:120000});
  await page.waitForTimeout(1400);
  const state=await page.evaluate(()=>({
   clock:__game.st.clock,phase:CityFront.phase,
   view:{x:__game.cam.x,y:__game.cam.y,tilt:__game.cam.tilt,zoom:__game.cam.zoom},
   player:{x:__game.player.x,y:__game.player.y},open:__game.world.open,
   save:localStorage.getItem('cityofgod.front.save.v1'),
   logo:document.querySelector('#city-front .front-logo')?.getAttribute('src')
  }));
  assert.equal(state.phase,'title');
  assert.equal(state.logo,'assets/menu/v1/logo.webp');
  assert.ok(state.view.tilt>.70,'câmera aérea');
  assert.ok(state.view.zoom<25,'zoom afastado');
  if(state.open)assert.ok(await page.evaluate(()=>{
   const a=openWorld,c=__game.cam;
   return a.sectors.get(Math.floor(c.x/a.SP)+','+Math.floor(c.y/a.SP))?.state==='done';
  }),'setor visível carregado');
  assert.equal(state.save,null,'a prévia não cria checkpoint');
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>__game.st.clock),state.clock,'relógio congelado');
  await page.screenshot({path:'artifacts/front-end-live/drone-cidade-viva.png'});
  await page.locator('[data-front-action="new"]').click();
  await page.waitForFunction(()=>CityFront.phase==='playing',null,{timeout:120000});
  const after=await page.evaluate(()=>({x:__game.cam.x,y:__game.cam.y,px:__game.player.x,py:__game.player.y}));
  assert.ok(Math.hypot(after.x-after.px,after.y-after.py)<2,'câmera devolvida ao personagem');
  assert.ok(await page.locator('#city-front').isHidden());
  assert.equal(errors.length,0,errors.join(' | '));
  await page.screenshot({path:'artifacts/front-end-live/jogo-normal.png'});
  console.log(JSON.stringify({success:true,state,after,errors},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
