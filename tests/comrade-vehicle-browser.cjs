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
   const roles=new Set((result.wheels||[]).map(w=>w.role));
   const wobble=(result.wheels||[]).concat(result.rolled||[])
     .filter(w=>!Number.isFinite(w.tyreAxisVertical)||w.tyreAxisVertical>.2);
   const moved=(result.rolled||[]).every(w=>{
     const initial=result.wheelsBefore?.find(x=>x.role===w.role);
     return initial&&Math.max(...w.tyreOrientation.map((v,i)=>
       Math.abs(v-initial.tyreOrientation[i])))>.001;
   });
   const silviaRims=id!=='silvia'||(result.rolled||[]).every(w=>{
     const initial=result.wheelsBefore?.find(x=>x.role===w.role);
     const tyre=w.allParts.find(x=>/^tyre/i.test(x.name));
     const rim=w.allParts.find(x=>/^rim/i.test(x.name));
     const cal=w.allParts.find(x=>/^cal/i.test(x.name));
     const oldTyre=initial?.allParts.find(x=>/^tyre/i.test(x.name));
     const oldRim=initial?.allParts.find(x=>/^rim/i.test(x.name));
     const movedPart=(one,two)=>one&&two&&one.quaternion.some((v,i)=>
       Math.abs(v-two.quaternion[i])>.001);
     return w.rollingNodes===5&&tyre&&rim&&!cal&&
       movedPart(tyre,oldTyre)&&movedPart(rim,oldRim);
   });
   if(!result.ok||!result.ready||
     (id!=='silvia'&&!result.source.endsWith('/'+id+'.glb'))||
     result.wheels?.length!==4||result.rolled?.length!==4||
     roles.size!==4||['fl','fr','rl','rr'].some(role=>!roles.has(role))||
     !result.wheels.every(w=>Number.isFinite(w.radius)&&w.radius>.1)||
     !result.rolled.every(w=>Math.abs(w.spin)>.01)||
     !result.wheels.filter(w=>w.role[0]==='f').every(w=>Math.abs(w.steer)>.001)||
     result.wheels.filter(w=>w.role[0]==='r').some(w=>Math.abs(w.steer)>.001)||
     wobble.length||!moved||!silviaRims||
     (id==='silvia'&&!result.rolled.some(w=>w.name==='RR_36')))
    throw Error('Vehicle GLB wheel axis, complete rims or steering FAILED: '+
     JSON.stringify({id,wobble,moved,silviaRims,result}));
  }
  // Four genuine WebGL camera orientations around house roofs.
  // Test that depth-only roof/facade meshes remain active as car moves
  // behind the same house from each side. Captures are QA only.
  const roof=await page.evaluate(async()=>{
   const v=window.cityVehicles;
   await v.selectModel('sedan');
   const H=window.cityVehicleBridge.houses.find(h=>!h.inside);
   if(!H)return {ok:false};
   const cx=(H.x0+H.x1)/2,cy=(H.y0+H.y1)/2;
   const cam=window.cityVehicleBridge.cam;
   const items=[];
   for(const angle of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4]){
    cam.ang=cam.tang=angle;cam.cos=Math.cos(angle);cam.sin=Math.sin(angle);
    cam.x=cam.tx=cx;cam.y=cam.ty=cy;
    v.car.x=cx-Math.sin(angle)*(Math.max(H.x1-H.x0,H.y1-H.y0)/2+1.8);
    v.car.y=cy-Math.cos(angle)*(Math.max(H.x1-H.x0,H.y1-H.y0)/2+1.8);
    v.render();
    items.push({angle,position:{x:v.car.x,y:v.car.y},frames:v.frames});
   }
   return {ok:v.houseOccluders>0,count:v.houseOccluders,items};
  });
  console.log('ROOF DEPTH QA',JSON.stringify(roof));
  if(!roof.ok||roof.items.length!==4)
   throw Error('WebGL roofs lack depth occlusion '+JSON.stringify(roof));
  // Teste direto das classes de objeto mostradas nos screenshots do usuario:
  // poste (hastes/braço), copas e troncos, arbustos, atores, cercas vazadas.
  const depth=await page.evaluate(()=>{
   const v=window.cityVehicles,w=window.cityVehicleBridge.world;
   const counts=v.occlusionStats||{};
   return {counts,lamps:w.lamps.length,
    trees:w.props.filter(p=>p.type==='tree').length,
    bushes:w.props.filter(p=>p.type==='bush').length,
    actors:window.cityVehicleBridge.actors.length,
    fences:w.segs.filter(s=>s.kind==='fence').length};
  });
  console.log('SCREENSHOT DEPTH QA',JSON.stringify(depth));
  if(depth.counts.lamps!==depth.lamps||depth.counts.trees!==depth.trees||
     depth.counts.bushes!==depth.bushes||depth.counts.actors!==depth.actors||
     depth.counts.fences!==depth.fences||
     depth.trees<1||depth.lamps<1||depth.actors<1||depth.fences<1)
   throw Error('Missing car depth proxy category: '+JSON.stringify(depth));
  if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));
  fs.writeFileSync('artifacts/vehicles/report.json',JSON.stringify(results,null,2));
  console.log('PASS',models.length,'REAL GLB models with animated rims and tires');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Release QA runs against the final local GLB bundle and roof-depth renderer.
