'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const out='artifacts/quaternius';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:[
   '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
   '--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1360,height:920},deviceScaleFactor:1});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const report={renderer:[],adoption:null,errors};
 try{
  await page.goto('http://127.0.0.1:4322/tools/quaternius-review.html',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.quaterniusReviewReady,undefined,{timeout:180000});
  for(const [action,expected] of [['idle','Idle'],['walk','Walk'],['run','Gallop']]){
   const states=await page.evaluate(a=>window.reviewQuaternius(a,2.1),action);
   assert.equal(states.length,12,'must show all imported Quaternius animals');
   for(const s of states){
    assert.equal(s.loaded,true,s.id+' failed to load');
    assert.equal(s.clip,expected,s.id+' animation mismatch');
    assert.ok(s.dimensions.every(x=>Number.isFinite(x)&&x>0),s.id+' invalid dimensions');
    assert.ok(s.dimensions[1]<2.5,s.id+' oversized 3D companion');
   }
   report.renderer.push({action,states});
   await page.screenshot({path:out+'/animais-'+action+'.png',fullPage:true});
  }
  // An actual live-game test, not just a standalone glTF gallery.
  await page.goto('http://127.0.0.1:4322/?seed=123',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.CityPets&&window.cityCharacters?.ready,undefined,{timeout:120000});
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
  assert.equal(await page.locator('[data-pet-adopt]').count(),13,'F8 shows all original + new animals');
  await page.locator('[data-pet-adopt="shibainu"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('img[data-pet-preview="shibainu:original"]')?.src.startsWith('data:image/png'),undefined,{timeout:100000});
  await page.screenshot({path:out+'/catalogo-18-pets.png'});
  await page.locator('[data-pet-adopt="shibainu"]').click();
  await page.locator('[data-pet-adopt="husky"]').click();
  assert.equal(await page.evaluate(()=>CityPets.controller.count),2);
  await page.locator('[data-pet-close]').click();
  await page.waitForFunction(()=>{
   const pets=window.CityPets?.actors||[];
   if(pets.length!==2)return false;
   const roots=[];
   window.cityVehicles?.scene?.traverse(o=>{if(o.name?.startsWith('Pet:'))roots.push(o);});
   return roots.some(o=>o.name==='Pet:shibainu'&&o.userData.assetStatus==='ready')&&
     roots.some(o=>o.name==='Pet:husky'&&o.userData.assetStatus==='ready');
  },undefined,{timeout:90000});
  await page.waitForTimeout(500);
  await page.screenshot({path:out+'/shiba-husky-em-casa.png'});
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
  assert.deepEqual(report.persistence.breeds,['shibainu','husky']);
  assert.equal(report.persistence.storageRows,2);
  assert.deepEqual(errors,[],'Runtime console errors');
  fs.writeFileSync(out+'/browser-report.json',JSON.stringify({...report,notes:'Captures from real Chrome WebGL; never an AI mockup.'},null,2));
  console.log('QUATERNIUS CHROME PASS: 12 models and 3 animations each; real F8 adopt and reload, screenshots saved');
 }finally{await browser.close();}
})().catch(e=>{fs.writeFileSync(out+'/browser-error.json',JSON.stringify({error:String(e),stack:e.stack},null,2));console.error(e);process.exitCode=1;});
