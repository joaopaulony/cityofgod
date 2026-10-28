const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1360,height:920}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 fs.mkdirSync('artifacts/pets',{recursive:true});
 await page.goto('http://127.0.0.1:4322/?seed=123');
 await page.locator('[data-front-action="new"]').click();
 await page.waitForFunction(()=>window.CityPets&&window.cityCharacters?.ready,null,{timeout:60000});
 const setup=await page.evaluate(()=>{
  const H=__game.houses.find(H=>H.architecture&&CityRealty.residential(H));
  if(!H)throw Error('No real residential test house');
  // Isolated headless context: fixture funds never touch the user's browser save.
  CityLife.credit(1000000,'Teste local isolado');const purchase=CityRealty.buy(H);if(!purchase.ok)throw Error(purchase.text);
  const g=CityHomeNav.grid(H,0);let found=null;
  const entry={x:H.doorPt[0]-H.doorN[0]*.8,y:H.doorPt[1]-H.doorN[1]*.8};
  for(let id=0;id<g.valid.length;id++)if(g.valid[id]){
   const q=H.architecture.toWorld(g.x0+(id%g.nx)*g.step,g.y0+Math.floor(id/g.nx)*g.step),p=cityVehicleBridge.collide(...q,.28,0);
   if(Math.hypot(p[0]-q[0],p[1]-q[1])<.01&&CityHomeNav.route(H,{x:q[0],y:q[1]},entry,0)){found=q;break;}
  }
  if(!found)throw Error('No safe interior position');
  Object.assign(__game.player,{x:found[0],y:found[1],floor:0,floorZ:0,armed:false});
  Object.assign(__game.cam,{x:found[0],tx:found[0],y:found[1],ty:found[1],zoom:180,tzoom:180});
  return {home:CityHome.key(H),position:found};
 });
 await page.locator('#city-pets-entry').click();await page.waitForSelector('#city-pets[open]');
 assert.equal(await page.locator('[data-pet-adopt]').count(),14);
 await page.screenshot({path:'artifacts/pets/painel-no-jogo.png'});
 for(const id of ['sharpei','benny','shibainu','husky','fox','wolf']){
  await page.locator(`[data-pet-adopt="${id}"]`).click();
 }
 assert.equal(await page.evaluate(()=>CityPets.controller.count),6);
 await page.locator('[data-pet-close]').click();
 await page.waitForTimeout(2000);
 await page.screenshot({path:'artifacts/pets/pets-em-casa.png'});
 const before=await page.evaluate(()=>CityPets.status);
 await page.keyboard.press('F8');await page.waitForSelector('#city-pets[open]');
 await page.locator('[data-pet-command="follow"][data-pet-id="all"]').click();
 assert.equal(await page.locator('#city-pets').evaluate(e=>e.open),false);
 assert.ok((await page.evaluate(()=>CityPets.status)).every(p=>p.mode==='follow'));
 const walk=await page.evaluate(()=>{
  window.cityCharacterEditorOpen=true;CityPets.command('all','wait');
  const pet=CityPets.controller.pets[0],player=__game.player,H=CityPets.controller.home;
  CityPets.command(pet.id,'follow');
  const [dx,dy]=H.doorPt,[nx,ny]=H.doorN,inside={x:dx-nx*.8,y:dy-ny*.8};
  const planned=CityHomeNav.route(H,player,inside,0);if(!planned)throw Error('Owner cannot reach the real front door '+JSON.stringify({localPlayer:H.architecture.toLocal(player.x,player.y),localGoal:H.architecture.toLocal(inside.x,inside.y),rooms:H.architecture.levels[0].rooms.map(r=>({id:r.id,x0:r.x0,y0:r.y0,x1:r.x1,y1:r.y1})),walls:H.architecture.levels[0].walls.map(w=>({a:w.a,b:w.b,openings:w.openings.map(o=>({kind:o.kind,at:o.at,width:o.width}))})),items:CityHome.placed(H).map(o=>({kind:o.kind,p:H.architecture.toLocal(o.x,o.y),w:o.w,d:o.d,solid:o.solid}))}));
  const points=[...planned.points,inside,{x:dx,y:dy},{x:dx+nx*1.2,y:dy+ny*1.2},{x:dx+nx*3,y:dy+ny*3}];
  const tick=()=>{updateHouseOpenings(.05,[player,...CityPets.actors],false);CityPets.tick(.05);};
  for(const goal of points)for(let i=0;i<260;i++){
   const x=goal.x-player.x,y=goal.y-player.y,d=Math.hypot(x,y);if(d<.12)break;
   const amount=Math.min(.07,d),q=cityVehicleBridge.movePet(player.x,player.y,player.x+x/d*amount,player.y+y/d*amount,.28,0);
   player.x=q[0];player.y=q[1];tick();
  }
  for(let i=0;i<1000&&Math.hypot(pet.x-player.x,pet.y-player.y)>1.3;i++)tick();
  const result={distance:Math.hypot(pet.x-player.x,pet.y-player.y),petInside:H.contains(pet.x,pet.y,0),ownerInside:H.contains(player.x,player.y,0),status:pet.status};
  Object.assign(__game.cam,{x:player.x,tx:player.x,y:player.y,ty:player.y});window.cityCharacterEditorOpen=false;
  return result;
 });
 assert.equal(walk.ownerInside,false,JSON.stringify(walk));assert.equal(walk.petInside,false,JSON.stringify(walk));assert.ok(walk.distance<1.5,JSON.stringify(walk));
 await page.waitForTimeout(500);await page.screenshot({path:'artifacts/pets/passeio-com-dono.png'});
 await page.reload();await page.locator('[data-front-action="continue"]').click();await page.waitForFunction(()=>window.CityPets?.controller.count===6&&window.CityFront?.phase==='playing',null,{timeout:60000});
 assert.equal(await page.evaluate(()=>CityPets.controller.rows.length),6);
 await page.keyboard.press('F8');await page.waitForSelector('#city-pets[open]');await page.keyboard.press('Escape');
 assert.equal(await page.locator('#city-pets').evaluate(e=>e.open),false);
 assert.deepEqual(errors,[]);
 const report={setup,before,walk,errors,checks:['fourteen real 3D catalog cards','adopt six through UI','render pets inside a real home','call all through UI','walk through real doors and follow outdoors','reload persistence','F8 and Escape']};
 fs.writeFileSync('artifacts/pets/browser-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
