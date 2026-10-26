'use strict';
// Actual Chrome/WebGL smoke test for the City Home choreography.
// Capture frames; anatomical score is geometric only, human visual approval is separate.
const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,
  args:['--no-sandbox','--enable-webgl','--use-gl=angle',
   '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html?seed=3250&quality=performance&veg2d',
   {waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.cityCharacters&&['ready','partial','failed'].includes(window.cityCharacters.status),
   null,{timeout:120000});
  const info=await page.evaluate(()=>({
   status:window.cityCharacters.status,models:window.cityCharacters.models?.length,
   ready:window.cityCharacters.ready,errors:window.cityCharacters.errors
  }));
  if(!info.ready)throw Error('Mixamo unavailable in browser: '+JSON.stringify(info));
  fs.mkdirSync('artifacts/city-home-animation',{recursive:true});
  const report=[];
  for(const kind of ['sofa','bed','stove']){
   const phase=kind==='sofa'?'sit':kind==='bed'?'sleep':'cook';
   const result=await page.evaluate(({kind,phase})=>{
    window.__manual=true;
    const bridge=window.cityVehicleBridge,player=bridge.player;
    // Unowned residences intentionally have no live furniture; staging a model
    // from the exact generated architectural plan is a test-only setup.
    const H=bridge.houses.find(h=>h.architecture?.levels?.[0]?.furniture?.some(f=>f.kind===kind));
    if(!H)return {kind,error:'No residential plan includes this fixture'};
    H.furnishOnPurchase?.();
    const item=bridge.boxes.find(b=>b.kind===kind&&b.house===H&&(!b.floor));
    if(!item)return {kind,error:'Plan fixture failed to instantiate',house:H.templateKey};

    const side=kind==='bed'?1:0;
    player.x=item.x+(kind==='bed'?item.w/2+.52:0);
    player.y=item.y+(kind==='bed'?0:item.d/2+.53);
    player.face=kind==='sofa'?Math.PI/2:kind==='bed'?Math.PI: -Math.PI/2;
    player.armed=false;player.speed=0;player.running=false;player.floor=item.floor||0;
    player.floorZ=player.floor*(item.house.floorHeight||3);
    player.homeAction={kind:phase,item:{...item},socket:{u:side,v:1},
     t:phase==='sleep'?3.1:phase==='sit'?1.4:2.2,
     duration:CityHomePerformance.duration(phase)};
    cam.x=cam.tx=player.x;cam.y=cam.ty=player.y;
    tick(.05);
    const J=player.J,visible=window.cityCharacters?.telemetry()?.find(x=>x.name==='Jogador')||null;
    return {kind,phase,hip:J.pelvis[2],head:J.head[2],hands:[J.handL,J.handR],
      finite:[...Object.values(J)].filter(Array.isArray).every(arr=>arr.every(Number.isFinite)),
      visible,fixture:{x:item.x,y:item.y,h:item.h},clip:player.characterClip};
   },{kind,phase});
   console.log('CITY HOME CHOREOGRAPHY',JSON.stringify(result));
   if(result.error||!result.finite||!result.visible?.visible)throw Error('Choreography scene not valid: '+JSON.stringify(result));
   if(phase==='sit'&&!(result.hip>.3&&result.hip<.65))throw Error('Hips missed sofa '+JSON.stringify(result));
   if(phase==='sleep'&&!(result.head<1.05))throw Error('Head missed bed '+JSON.stringify(result));
   report.push(result);
   await page.screenshot({path:'artifacts/city-home-animation/'+phase+'.png'});
  }
  if(errors.length)throw Error('Browser JS errors: '+JSON.stringify(errors));
  fs.writeFileSync('artifacts/city-home-animation/report.json',JSON.stringify({status:info,frames:report},null,2));
  console.log('PASS browser skeleton smoke; screenshots require separate human inspection');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
