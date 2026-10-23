'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,
  args:['--no-sandbox','--enable-webgl','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html?quality=performance&seed=3250',
   {waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.cityVehicles&&['ready','failed'].includes(window.cityVehicles.status),
   null,{timeout:120000});
  fs.mkdirSync('artifacts/vehicles',{recursive:true});
  const models=['silvia','compact','coupe','hatchback','minivan','offroad',
   'pickup','sedan','sport','suv','wagon'];
  const results=[];
  for(const id of models){
   const result=await page.evaluate(async id=>{
    const v=window.cityVehicles,prev=v.car;
    if(v.driver)v.driver=false;
    const ok=await v.selectModel(id);
    if(!ok)return {id,ok:false,status:v.status,error:v.error};
    const start={x:v.car.x,y:v.car.y,angle:v.car.angle};
    v.car.speed=0;v.car.steer=0;
    const before=v.getWheelTelemetry();
    // Verify physical steering at a standstill and real wheel rotation
    // through the game's physics; do not spoof rendered wheel angles.
    player.x=v.car.x+.3;player.y=v.car.y+.4;
    const entered=v.interact();
    input.keys.add('d');
    for(let i=0;i<4;i++)v.update(.05);
    input.keys.delete('d');
    const steered=v.getWheelTelemetry();
    input.keys.add('w');
    for(let i=0;i<10;i++)v.update(.05);
    input.keys.delete('w');
    const rolled=v.getWheelTelemetry();
    const distance=v.car.distance;
    v.driver=false;v.engineOn=false;
    Object.assign(v.car,{...start,speed:0,steer:0,distance:0});
    if(v.collider){v.collider.x=start.x;v.collider.y=start.y;}
    resetDebug();
    function resetDebug(){
     const c=window.cityVehicleBridge.cam;
     c.x=c.tx=start.x;c.y=c.ty=start.y;
     c.cos=Math.cos(c.ang);c.sin=Math.sin(c.ang);
     v.render();
    }
    return {id,ok,source:v.source,model:v.model,ready:v.ready,
      wheels:steered,rolled,distance,drawn:v.frames,
      wheelsBefore:before,entered};
   },id);
   results.push(result);
   await page.screenshot({path:'artifacts/vehicles/'+id+'.png'});
   console.log('MODEL QA',JSON.stringify(result));
   if(!result.ok||!result.ready||!result.source.endsWith('/'+id+'.glb')&&id!=='silvia'||
     result.wheels?.length!==4||result.rolled?.length!==4||
     !result.wheels.every(w=>Number.isFinite(w.radius)&&w.radius>.1)||
     !result.rolled.every(w=>Math.abs(w.spin)>.01)||
     !result.wheels.filter(w=>w.role[0]==='f').every(w=>Math.abs(w.steer)>.001)||
     result.wheels.filter(w=>w.role[0]==='r').some(w=>Math.abs(w.steer)>.001))
    throw Error('Vehicle model wheel validation FAILED: '+JSON.stringify(result));
  }
  if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));
  fs.writeFileSync('artifacts/vehicles/report.json',JSON.stringify(results,null,2));
  console.log('PASS',models.length,'REAL GLB models with animated rims and tires');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
