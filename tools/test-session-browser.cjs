const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.CITY_TEST_URL||'http://127.0.0.1:4323';
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext(),page=await context.newPage(),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const Native=window.AudioContext;
  window.__audioGains=[];
  window.AudioContext=class extends Native{createGain(){const node=super.createGain(),connect=node.connect.bind(node),disconnect=node.disconnect.bind(node);node.connections=0;node.connect=(...args)=>{node.connections++;return connect(...args);};node.disconnect=(...args)=>{node.connections=0;return disconnect(...args);};window.__audioGains.push(node);return node;}};
 });
 async function ready(){await page.waitForFunction(()=>['playing','error'].includes(window.CityFront?.phase),null,{timeout:120000});assert.equal(await page.evaluate(()=>CityFront.phase),'playing',await page.locator('#city-front').textContent());}
 async function point(){return page.evaluate(()=>({x:__game.player.x,y:__game.player.y}));}
 async function same(expected){const actual=await point();assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<.15,JSON.stringify({actual,expected}));}
 await page.goto(base+'/');await page.locator('[data-front-action="new"]').click();await ready();
 assert.equal(await page.evaluate(()=>__audioGains[0].connections),0);checks.push('menu music is silent and disconnected during gameplay');
 // Move to a real, collision-free point in the current city; hide immediately, before autosave.
 const moved=await page.evaluate(()=>{const p=__game.player;for(let d=3;d<30;d+=2)for(let a=0;a<Math.PI*2;a+=.4){const x=p.x+Math.cos(a)*d,y=p.y+Math.sin(a)*d;if(!world.blocked(x,y,.4)&&pondVal(x,y)>1.1){Object.assign(p,{x,y});return{x,y};}}throw Error('No free point');});
 await page.evaluate(()=>{window.__testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__testHidden});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('blur'));});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cityofgod.front.save.v1')));
 assert.ok(Math.hypot(saved.x-moved.x,saved.y-moved.y)<.01);const clock=await page.evaluate(()=>__game.st.clock);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__game.st.clock),clock);
 await page.evaluate(()=>{window.__testHidden=false;document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
 assert.equal(await page.evaluate(()=>CityFront.phase),'playing');await same(moved);checks.push('switching tabs saves immediately, freezes background simulation and retains the game');
 await page.reload();await ready();await same(moved);checks.push('reload automatically resumes the same tab at its latest position');
 const distant=await page.evaluate(()=>{owTeleport(2000,1600);const p=__game.player;for(const r of world.roads)for(const q of r.pts){if(Math.hypot(q.x-p.x,q.y-p.y)<200&&!world.blocked(q.x,q.y,.4)&&pondVal(q.x,q.y)>1.1){Object.assign(p,{x:q.x,y:q.y});CityFront.save();return{x:p.x,y:p.y};}}throw Error('No distant street');});
 await page.reload();await ready();await same(distant);checks.push('a distant saved city sector loads before position restoration');
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>__audioGains[0]?.connections||0),0);await page.locator('[data-front-action="title"]').click();
 // Explicitly leaving the game still opens the initial menu on a later visit.
 await page.reload();await page.locator('[data-front-action="continue"]').waitFor();await page.locator('[data-front-action="continue"]').click();await ready();await same(distant);checks.push('explicit title and Continue preserve position');
 // Restore the actual imported vehicle, then persist it through a complete runtime reload.
 await page.evaluate(async()=>{const p=__game.player;const ok=await cityVehicles.restoreCheckpoint({key:'resume-test:sedan',modelId:'sedan',angle:1.25,fuel:.37,engineOn:true,headlights:true,col:'#123456'},p);if(!ok)throw Error('Vehicle restore failed');CityFront.save();});
 const driving=await point();await page.reload();await ready();await same(driving);
 assert.deepEqual(await page.evaluate(()=>({driver:cityVehicles.driver,model:cityVehicles.modelId,fuel:Math.round(cityVehicles.fuel.level*100),angle:cityVehicles.car.angle,headlights:cityVehicles.headlights})),{driver:true,model:'sedan',fuel:37,angle:1.25,headlights:true});
 checks.push('driving checkpoint restores position, vehicle, direction, fuel and headlights');
 // A failed subsystem save cannot suppress the position checkpoint.
 const independent=await page.evaluate(()=>{CitySim.save=()=>{throw Error('test unavailable subsystem');};__game.player.x+=.1;CityFront.save();return {x:__game.player.x,saved:JSON.parse(localStorage.getItem('cityofgod.front.save.v1')).x};});
 assert.equal(independent.saved,independent.x);checks.push('position is saved even if another subsystem fails');
 assert.deepEqual(errors,[]);fs.mkdirSync('artifacts/front-end',{recursive:true});fs.writeFileSync('artifacts/front-end/session-check.json',JSON.stringify({base,checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
