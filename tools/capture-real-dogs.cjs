'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const out='artifacts/real-dogs';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:[
   '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
   '--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1360,height:920},deviceScaleFactor:1});
 let page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const report={renderer:[],adoption:null,errors};
 try{
  await page.goto('http://127.0.0.1:4322/tools/real-dogs-review.html',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.realDogsReady,undefined,{timeout:180000});
  for(const action of ['idle','walk','run']){
   const states=await page.evaluate(a=>window.reviewRealDogs(a),action);
   assert.equal(states.length,2);
   for(const state of states){
    assert.equal(state.loaded,true,state.breed+' did not load: '+state.error);
    assert.equal(state.status,'ready');
    const expected=state.breed==='sharpei'?(action==='idle'?'standing_idle':action==='run'?'walking_cycle':'walking_cycle'):
      (action==='idle'?'dogArmature|idle':'dogArmature|run');
    if(action==='run'&&state.breed==='sharpei')assert.equal(state.clip,'walking_cycle');
    else assert.equal(state.clip,expected);
    assert.ok(state.size.every(n=>Number.isFinite(n)&&n>0));
    assert.ok(state.size[1]<2.5,'Wrong scale: '+state.breed);
   }
   report.renderer.push({action,states});
   await page.screenshot({path:out+'/dois-caes-'+action+'.png',fullPage:true});
  }
  // Release the gallery's WebGL resources before opening the large city.
  await page.close({runBeforeUnload:false});
  page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
    // An actual live-game test, not just a standalone glTF gallery.
  // The GitHub runner can reclaim the preview's dev server during GPU work.
  // Restart the local file server once if it was reclaimed between scenes.
  try{await page.goto('http://127.0.0.1:4322/?seed=123',{waitUntil:'commit',timeout:90000});}
  catch(e){
   const {spawn}=require('node:child_process');
   const server=spawn(process.execPath,['tools/serve.mjs'],
     {cwd:process.cwd(),detached:true,stdio:'ignore'});
   server.unref();
   await new Promise(r=>setTimeout(r,1800));
   await page.goto('http://127.0.0.1:4322/?seed=123',{waitUntil:'commit',timeout:90000});
  }
  try{
   await page.waitForFunction(()=>window.CityPets&&window.__game?.houses?.some(H=>H.architecture),
     undefined,{timeout:90000});
  }catch(err){
   report.cityLoad=await page.evaluate(()=>({
     href:location.href,title:document.title,
     stage:document.readyState,
     cityPets:!!window.CityPets,characters:!!window.cityCharacters,
     charactersReady:window.cityCharacters?.ready||false,
     game:!!window.__game,
     body:document.body?.innerText?.slice(0,700)||''
   })).catch(e=>({error:String(e)}));
   fs.writeFileSync(out+'/browser-debug.json',JSON.stringify(report,null,2));
   await page.screenshot({path:out+'/city-load-debug.png'}).catch(()=>{});
   throw err;
  }
  const home=await page.evaluate(()=>{
   const H=__game.houses.find(H=>H.architecture&&CityRealty.residential(H));
   if(!H)throw Error('No residential home in live map');
   CityLife.credit(1000000,'Teste isolado');const buy=CityRealty.buy(H);if(!buy.ok)throw Error(buy.text);
   const g=CityHomeNav.grid(H,0);let found=null;
   const entry={x:H.doorPt[0]-H.doorN[0]*.8,y:H.doorPt[1]-H.doorN[1]*.8};
   for(let id=0;id<g.valid.length;id++)if(g.valid[id]){
    const q=H.architecture.toWorld(g.x0+(id%g.nx)*g.step,g.y0+Math.floor(id/g.nx)*g.step);
    const p=cityVehicleBridge.collide(...q,.28,0);
    if(Math.hypot(p[0]-q[0],p[1]-q[1])<.01&&CityHomeNav.route(H,{x:q[0],y:q[1]},entry,0)){
     found=q;break;
    }
   }
   if(!found)throw Error('No navigable floor for adoption');
   Object.assign(__game.player,{x:found[0],y:found[1],floor:0,floorZ:0,armed:false});
   Object.assign(__game.cam,{x:found[0],tx:found[0],y:found[1],ty:found[1],zoom:170,tzoom:170});
   return {house:CityHome.key(H),position:found};
  });
  await page.locator('#city-pets-entry').click();
  await page.waitForSelector('#city-pets[open]');
  assert.equal(await page.locator('[data-pet-adopt]').count(),14,'Only imported 3D pets remain');
  await page.locator('[data-pet-adopt="sharpei"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('img[data-pet-preview="sharpei:original"]')?.src.startsWith('data:image/png'),undefined,{timeout:100000});
  await page.screenshot({path:out+'/catalogo-18-pets.png'});
  await page.locator('[data-pet-adopt="sharpei"]').click();
  await page.locator('[data-pet-adopt="benny"]').click();
  assert.equal(await page.evaluate(()=>CityPets.controller.count),2);
  await page.locator('[data-pet-close]').click();
  await page.waitForFunction(()=>{
   const pets=window.CityPets?.actors||[];
   if(pets.length!==2)return false;
   const roots=[];
   window.cityVehicles?.scene?.traverse(o=>{if(o.name?.startsWith('Pet:'))roots.push(o);});
   return roots.some(o=>o.name==='Pet:sharpei'&&o.userData.assetStatus==='ready')&&
     roots.some(o=>o.name==='Pet:benny'&&o.userData.assetStatus==='ready');
  },undefined,{timeout:90000});
  await page.waitForTimeout(500);
  await page.screenshot({path:out+'/sharpei-benny-em-casa.png'});
  const state=await page.evaluate(()=>{
   const roots=[];cityVehicles.scene.traverse(o=>{if(o.name?.startsWith('Pet:'))roots.push(o);});
   return {pets:CityPets.controller.rows.map(p=>({breed:p.breed,name:p.name,color:p.color})),
    models:roots.map(o=>({name:o.name,status:o.userData.assetStatus,
      clips:o.userData.clipNames?.length,scale:o.userData.scale}))};
  });
  report.adoption={home,...state};
  // Release the heavy WebGL scene and reopen in the same browser context:
  // localStorage persists while navigation is no longer blocked by GPU work.
  fs.writeFileSync(out+'/browser-report.partial.json',JSON.stringify(report,null,2));
  await page.close({runBeforeUnload:false});
  const restored=await context.newPage();
  restored.on('pageerror',e=>errors.push(e.message));
  await restored.goto('http://127.0.0.1:4322/?seed=123',{waitUntil:'commit',timeout:120000});
  await restored.waitForFunction(()=>window.CityPets?.controller.count===2,undefined,{timeout:120000});
  report.persistence=await restored.evaluate(()=>({
    count:CityPets.controller.count,
    breeds:CityPets.controller.rows.map(p=>p.breed),
    storageRows:JSON.parse(localStorage.getItem('cityofgod.house-pets.v1')||'{}').pets?.length||0
  }));
  assert.deepEqual(report.persistence.breeds,['sharpei','benny']);
  assert.equal(report.persistence.storageRows,2);
  assert.deepEqual(errors,[],'Runtime console errors');
  fs.writeFileSync(out+'/browser-report.json',JSON.stringify({...report,notes:'Captures from real Chrome WebGL; never an AI mockup.'},null,2));
  console.log('REAL DOGS CHROME PASS: Shar Pei and Benny, real animations/adoption and reload, screenshots saved');
 }finally{await browser.close();}
})().catch(e=>{fs.writeFileSync(out+'/browser-error.json',JSON.stringify({error:String(e),stack:e.stack},null,2));console.error(e);process.exitCode=1;});
