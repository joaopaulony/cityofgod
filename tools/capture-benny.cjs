'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const out='artifacts/benny';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1360,height:940},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const report={model:{},states:[],adoption:{},errors};
 try{
  await page.goto('http://127.0.0.1:4322/tools/pets-review.html',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.petReviewReady,undefined,{timeout:180000});
  const info=await page.evaluate(()=>({
   available:window.petReview?.breeds,
   errors:window.petReview?.errors,
   model:window.petReview?.items.find(x=>x.breed.id==='benny')?.model.root.userData
  }));
  report.model=info;
  assert.equal(info.available.length,13,'Only 13 licensed animals should appear in review');
  assert.deepEqual(info.errors,[],'No missing 3D assets');
  assert.equal(info.model.assetStatus,'ready','Benny must load a real FBX rig');
  for(const action of ['idle','walk','run']){
   const states=await page.evaluate(action=>window.reviewPets(action,1.2),action);
   const benny=states.find(s=>s.id==='benny');
   assert.ok(benny?.loaded,'Missing animated Benny in '+action);
   assert.equal(benny?.status,'ready');
   assert.ok(benny?.clip?.toLowerCase().includes(action==='idle'?'idle':'run'),
    'Expected original Benny FBX clip for '+action+', got '+benny?.clip);
   assert.ok(benny.dimensions.every(x=>Number.isFinite(x)&&x>0));
   report.states.push({action,benny});
   await page.screenshot({path:path.join(out,'benny-'+action+'.png'),fullPage:true});
  }
  await page.goto('http://127.0.0.1:4322/?seed=123',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.CityPets&&window.cityCharacters?.ready,undefined,{timeout:120000});
  await page.evaluate(()=>{
   const H=__game.houses.find(H=>H.architecture&&CityRealty.residential(H));
   if(!H)throw Error('No house for Benny adoption');
   CityLife.credit(1000000,'Teste exclusivo');
   const bought=CityRealty.buy(H);if(!bought.ok)throw Error(bought.text);
   const g=CityHomeNav.grid(H,0);
   const entry={x:H.doorPt[0]-H.doorN[0]*.8,y:H.doorPt[1]-H.doorN[1]*.8};
   let spot=null;
   for(let i=0;i<g.valid.length;i++)if(g.valid[i]){
    const q=H.architecture.toWorld(g.x0+(i%g.nx)*g.step,g.y0+Math.floor(i/g.nx)*g.step);
    const n=cityVehicleBridge.collide(...q,.28,0);
    if(Math.hypot(n[0]-q[0],n[1]-q[1])<.01&&CityHomeNav.route(H,{x:q[0],y:q[1]},entry,0)){
      spot=q;break;
    }
   }
   if(!spot)throw Error('No accessible floor');
   Object.assign(__game.player,{x:spot[0],y:spot[1],floor:0,floorZ:0,armed:false});
   Object.assign(__game.cam,{x:spot[0],tx:spot[0],y:spot[1],ty:spot[1],zoom:170,tzoom:170});
  });
  await page.locator('#city-pets-entry').click();
  await page.waitForSelector('#city-pets[open]');
  assert.equal(await page.locator('[data-pet-adopt]').count(),13);
  await page.locator('[data-pet-adopt="benny"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>
   document.querySelector('img[data-pet-preview="benny:original"]')?.src.startsWith('data:image/png'),undefined,{timeout:120000});
  await page.screenshot({path:path.join(out,'catalogo-benny.png')});
  await page.locator('[data-pet-adopt="benny"]').click();
  assert.equal(await page.evaluate(()=>CityPets.controller.count),1);
  await page.locator('[data-pet-close]').click();
  await page.waitForFunction(()=>{
    const roots=[];cityVehicles.scene.traverse(o=>{if(o.name?.startsWith('Pet:'))roots.push(o);});
    return roots.some(o=>o.name==='Pet:benny'&&o.userData.assetStatus==='ready');
  },undefined,{timeout:120000});
  await page.waitForTimeout(700);
  await page.screenshot({path:path.join(out,'benny-no-jogo.png')});
  report.adoption=await page.evaluate(()=>{
    const roots=[];cityVehicles.scene.traverse(o=>{if(o.name?.startsWith('Pet:'))roots.push(o);});
    return {pets:CityPets.controller.rows.map(p=>p.breed),root:roots.filter(o=>o.name==='Pet:benny')
     .map(o=>({status:o.userData.assetStatus,clips:o.userData.clipNames?.length,height:o.userData.scale}))};
  });
  assert.deepEqual(report.adoption.pets,['benny']);
  assert.equal(report.adoption.root[0]?.status,'ready');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('BENNY WEBGL PASS: original FBX model, idle/run animation, F8 adoption and screenshots');
 }catch(e){
  fs.writeFileSync(path.join(out,'error.json'),JSON.stringify({message:String(e),stack:e.stack,report},null,2));
  throw e;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
