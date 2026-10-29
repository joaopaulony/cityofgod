'use strict';
// Captures real City of God gameplay pixels, not generated illustrations.
// Place a licensed built-in sedan in a drivable scene, render pristine and damaged.
const {chromium}=require('playwright');
const fs=require('node:fs'),sharp=require('sharp');
const {mkdirSync}=fs;
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,
  args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
   '--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e.message)));
  page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text().slice(0,500));});
  await page.goto('http://127.0.0.1:8765/index.html?quality=performance&seed=3250',
   {waitUntil:'domcontentloaded',timeout:120000});
  await page.locator('[data-front-action="new"]').click({timeout:35000});
  await page.waitForFunction(()=>window.cityVehicles&&
   ['ready','failed'].includes(window.cityVehicles.status),null,{timeout:120000});
  const stats=await page.evaluate(async()=>{
   const v=window.cityVehicles,b=window.cityVehicleBridge;
   if(v.status!=='ready')throw Error('Car GLB failed: '+v.error);
   // Place it on the nearest generated road without inventing scenery.
   const p=b.player,rs=b.world.roads||[],pts=rs.flatMap(r=>r.pts||[]);
   const near=pts.filter(q=>Math.hypot(q.x-p.x,q.y-p.y)<85);
   near.sort((a,z)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(z.x-p.x,z.y-p.y));
   const chosen=near.find(q=>b.pondVal(q.x,q.y)>1.07)||null;
   const q=chosen||{x:p.x+1,y:p.y};
   v.driver=false;
   const car={key:'qa-car-damage-demo',modelId:'sedan',angle:.22,
    fuel:.8,engineOn:false,headlights:false,col:null};
   const ok=await v.restoreCheckpoint(car,{x:q.x,y:q.y});
   if(!ok)throw Error('Could not restore test sedan');
   const cam=b.cam;
   cam.x=cam.tx=q.x;cam.y=cam.ty=q.y;
   cam.ang=cam.tang=Math.PI/4;cam.cos=Math.cos(cam.ang);cam.sin=Math.sin(cam.ang);
   cam.zoom=cam.tzoom=62;
   v.driver=true;v.engineOn=false;
   v.render();
   return {ready:v.ready,car:v.modelId,position:[q.x,q.y],
    camera:cam.ang,status:v.getDamageStatus(),road:!!chosen};
  });
  if(!stats.ready||stats.status.integrity!==1)throw Error('Before screenshot car not intact '+JSON.stringify(stats));
  mkdirSync('docs/screenshots',{recursive:true});
  await page.waitForTimeout(1200);
  await page.screenshot({path:'docs/screenshots/vehicle-crash-before.png'});
  const damaged=await page.evaluate(async()=>{
   const v=window.cityVehicles,b=window.cityVehicleBridge;
   const p={x:v.car.x,y:v.car.y},angle=v.car.angle;
   v.driver=false;
   const ok=await v.restoreCheckpoint({key:'qa-car-damage-demo',
    modelId:'sedan',angle,fuel:.8,engineOn:false,headlights:false,
    damage:{integrity:.14,impacts:4,front:1,rear:.08,left:.62,right:.13}},p);
   if(!ok)throw Error('Damaged model reload failed');
   v.driver=true;v.engineOn=false;
   const cam=b.cam;
   cam.x=cam.tx=v.car.x;cam.y=cam.ty=v.car.y;
   cam.ang=cam.tang=Math.PI/4;cam.cos=Math.cos(cam.ang);cam.sin=Math.sin(cam.ang);
   cam.zoom=cam.tzoom=62;
   for(let i=0;i<38;i++)v.update(.07);
   v.render();
   return {status:v.getDamageStatus(),model:v.modelId,frames:v.frames};
  });
  if(damaged.status.integrity>.15||damaged.status.tier!=='critical')
   throw Error('Damage status mismatch: '+JSON.stringify(damaged));
  await page.waitForTimeout(380);
  await page.screenshot({path:'docs/screenshots/vehicle-crash-after.png'});
  const width=760,height=490,header=54;
  const bg=sharp({create:{width:width*2,height:height+header,channels:4,background:'#151f2a'}});
  const before=await sharp('docs/screenshots/vehicle-crash-before.png')
   .resize(width,height,{fit:'cover',position:'centre'}).toBuffer();
  const after=await sharp('docs/screenshots/vehicle-crash-after.png')
   .resize(width,height,{fit:'cover',position:'centre'}).toBuffer();
  const labels=Buffer.from('<svg width="1520" height="54"><rect width="1520" height="54" fill="#101926"/><text x="20" y="35" fill="#e7ecf5" font-size="24" font-family="sans-serif" font-weight="700">ANTES — sedan intacto · 100%</text><text x="780" y="35" fill="#ffb98d" font-size="24" font-family="sans-serif" font-weight="700">DEPOIS — dano crítico · 14%</text></svg>');
  await bg.composite([
   {input:labels,left:0,top:0},{input:before,left:0,top:header},
   {input:after,left:width,top:header}
  ]).png().toFile('docs/screenshots/vehicle-crash-comparison.png');
  const beforeStats=fs.statSync('docs/screenshots/vehicle-crash-before.png');
  const afterStats=fs.statSync('docs/screenshots/vehicle-crash-after.png');
  if(beforeStats.size<15000||afterStats.size<15000)
   throw Error('Suspiciously empty screenshot');
  console.log('REAL DAMAGE GAMEPLAY CAPTURE',JSON.stringify({stats,damaged,
   beforeBytes:beforeStats.size,afterBytes:afterStats.size,errors:errors.slice(0,10)}));
  if(errors.some(x=>/vehicle|damage|deformation|shader/i.test(x)))
   throw Error('Damage render error '+JSON.stringify(errors));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
