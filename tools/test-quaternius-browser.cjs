'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
let browser;
(async()=>{
 fs.mkdirSync('artifacts/quaternius',{recursive:true});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1480,height:1190},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',e=>{if(e.type()==='error')errors.push('console: '+e.text());});
 await page.goto('http://127.0.0.1:4322/tools/quaternius-review.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.petQuaterniusReady||window.petQuaterniusErrors?.length,{timeout:120000});
 const loaded=await page.evaluate(()=>({ready:petQuaterniusReady,errors:petQuaterniusErrors}));
 assert.equal(loaded.ready,true,JSON.stringify(loaded));
 const snapshots={};
 for(const [action,file] of [['idle','gallery-idle'],['walk','gallery-walk'],['run','gallery-gallop'],['eat','gallery-eating']]){
  const info=await page.evaluate(action=>window.reviewQuaternius(action),action);
  assert.equal(info.length,12);
  for(const i of info){assert.ok(i.boneCount>5,i.id+' is not skinned');assert.ok(i.size.every(Number.isFinite),i.id+' has invalid bounds');}
  snapshots[action]=info;
  await page.screenshot({path:'artifacts/quaternius/'+file+'.png',fullPage:true});
 }
 assert.ok(snapshots.walk.every(a=>a.animation==='Walk'));
 assert.ok(snapshots.run.every(a=>a.animation==='Gallop'));
 assert.ok(snapshots.eat.every(a=>a.animation==='Eating'));
 await page.goto('http://127.0.0.1:4322/?seed=123',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.CityPets&&window.cityCharacters?.ready,null,{timeout:120000});
 const setup=await page.evaluate(()=>{
  const H=__game.houses.find(H=>H.architecture&&CityRealty.residential(H));
  if(!H)throw Error('No test home');
  CityLife.credit(1000000,'Teste de pets 3D isolado');
  if(!CityRealty.buy(H).ok)throw Error('Failed to buy home');
  const grid=CityHomeNav.grid(H,0);let found=null;
  const doorway={x:H.doorPt[0]-H.doorN[0]*.8,y:H.doorPt[1]-H.doorN[1]*.8};
  for(let j=0;j<grid.valid.length;j++)if(grid.valid[j]){
   const q=H.architecture.toWorld(grid.x0+(j%grid.nx)*grid.step,grid.y0+Math.floor(j/grid.nx)*grid.step);
   if(Math.hypot(...cityVehicleBridge.collide(q[0],q[1],.28,0).map((v,k)=>v-q[k]))<.01&&
      CityHomeNav.route(H,{x:q[0],y:q[1]},doorway,0)){found=q;break;}
  }
  if(!found)throw Error('No safe room');
  Object.assign(__game.player,{x:found[0],y:found[1],floor:0,floorZ:0,armed:false});
  Object.assign(__game.cam,{x:found[0],tx:found[0],y:found[1],ty:found[1],zoom:160,tzoom:160});
  return {home:CityHome.key(H),position:found};
 });
 await page.locator('#city-pets-entry').click();
 await page.waitForSelector('#city-pets[open]');
 assert.equal(await page.locator('[data-pet-adopt]').count(),18);
 await page.screenshot({path:'artifacts/quaternius/in-game-catalog.png',fullPage:true});
 for(const id of ['shibainu','husky','fox']){
  await page.locator('[data-pet-adopt="'+id+'"]').click();
 }
 assert.equal(await page.evaluate(()=>CityPets.controller.count),3);
 await page.locator('[data-pet-close]').click();
 await page.waitForFunction(()=>window.CityPets?.importedModels?.length>=3,{timeout:90000});
 const imports=await page.evaluate(()=>({
  imported:CityPets.importedModels,errors:CityPets.modelErrors,status:CityPets.quaterniusStatus
 }));
 assert.equal(imports.errors.length,0,JSON.stringify(imports));
 assert.deepEqual(imports.imported.map(m=>m.breed).sort(),['fox','husky','shibainu']);
 await page.screenshot({path:'artifacts/quaternius/in-game-3-pets.png',fullPage:true});
 await page.reload();await page.waitForFunction(()=>window.CityPets?.controller.count===3,{timeout:90000});
 assert.equal(await page.evaluate(()=>CityPets.controller.rows.length),3);
 fs.writeFileSync('artifacts/quaternius/report.json',JSON.stringify({setup,snapshots,imports,errors,
  checks:['12 animated glTF models rendered','idle/walk/gallop/eating on every rig',
   '18 catalog choices','adoption into a real home','3 imported pets in Three.js','save survives reload']},null,2));
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('Quaternius pets Chrome QA PASS: 12 rigs + 3 adopted pets + 6 screenshots');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
