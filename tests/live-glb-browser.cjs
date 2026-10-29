'use strict';
const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({
  channel:'chrome',headless:true,
  args:['--no-sandbox','--enable-webgl','--use-gl=angle',
   '--use-angle=swiftshader','--enable-unsafe-swiftshader']
 });
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{
   if(m.type()==='error'||m.type()==='warning')warnings.push(m.text());
  });
  await page.goto('http://127.0.0.1:8765/index.html?seed=3250&quality=performance',
   {waitUntil:'domcontentloaded',timeout:120000});
   await page.locator('[data-front-action="new"]').click({timeout:30000});
  try{
   await page.waitForFunction(()=>window.cityVehicles&&
    ['ready','failed'].includes(window.cityVehicles.status),null,{timeout:90000});
  }catch(e){
   const state=await page.evaluate(()=>({
    world:typeof world,bridge:!!window.cityVehicleBridge,
    vehicle:window.cityVehicles?.status,error:window.cityVehicles?.error,
    canvas:document.querySelector('#view')?.width,
    three:!!window.cityVehicles?.renderer,
    cache:window.cityVehicleMetrics?.()?.cache,
    glbRequests:performance.getEntriesByType('resource').filter(r=>/\.glb/.test(r.name))
      .map(r=>({name:r.name.split('/').pop(),duration:r.duration,bytes:r.transferSize})),
    frontLoading:window.CityFront?.loading
   })).catch(err=>({inspectError:String(err)}));
   throw Error('GLB boot diagnostics: '+JSON.stringify({state,errors,warnings,error:String(e)}));
  }
  const initial=await page.evaluate(()=>{
   const car=window.cityVehicles,bridge=window.cityVehicleBridge;
   return {status:car.status,error:car.error,frames:car.frames||0,
    sourceSize:car.sourceSize,mesh:car.meshes,driver:car.driver,
    x:car.car.x,y:car.car.y,camera:bridge.cam.ang};
  });
  if(initial.status!=='ready'||!initial.mesh)throw Error('GLB not loaded: '+
   JSON.stringify({initial,errors,warnings}));
  // O menu começa sem motorista: estacionar/entrar pelo fluxo real antes
  // de testar câmera e direção. A posição inicial do carro não é o spawn.
  const supplied=await page.evaluate(async()=>{
   const v=window.cityVehicles,ok=await v.deliverVehicle('silvia');
   const b=window.cityVehicleBridge.boxes.find(x=>
     x.kind==='parkedcar'&&x.vehicleKey==='owned:silvia'&&!x.fleetHidden);
   if(ok&&b){
    window.cityVehicleBridge.player.x=b.x;
    window.cityVehicleBridge.player.y=b.y;
   }
   return {ok,found:!!b,action:ok&&b?v.interact():null};
  });
  if(!supplied.ok||!supplied.found||!supplied.action)throw Error('Não foi possível entrar no carro de teste '+JSON.stringify(supplied));
  await page.waitForFunction(()=>window.cityVehicles?.driver===true,null,{timeout:30000});
  await page.evaluate(()=>{
   const v=window.cityVehicles,c=window.cityVehicleBridge.cam;
   c.x=c.tx=v.car.x;c.y=c.ty=v.car.y;
  });
  // O CAS pode pausar a simulação após o primeiro carregamento:
  // forçar quadros reais de WebGL para medir, sem depender do menu.
  await page.evaluate(()=>{for(let i=0;i<8;i++)window.cityVehicles.render();});
  const aligned=await page.evaluate(()=>{
   const car=window.cityVehicles,c=window.cityVehicleBridge.cam;
   const q=proj(car.car.x,car.car.y,0),s=car.lastScreenPosition;
   return {delta:Math.hypot(q.x-s.x,q.y-s.y),
    screenFromCenter:Math.hypot(s.x-c.W/2,s.y-c.H/2),
    viewW:c.W,viewH:c.H,
    webGLCanvas:document.querySelector('#vehicle3d').width,
    webGLType:document.querySelector('#vehicle3d').getContext('webgl2')?'webgl2':'webgl'};
  });
  if(aligned.delta>1.5||!aligned.webGLCanvas||aligned.screenFromCenter>315)
   throw Error('Live 3D camera misaligned: '+JSON.stringify(aligned));
  fs.mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/live-glb-silvia-isometric.png'});
  const before=await page.evaluate(()=>{
   window.__manual=true;
   const car=window.cityVehicles;
   player.x=car.car.x+.5;player.y=car.car.y+.4;
   return {enter:car.driver?'already driving':false,x:car.car.x,y:car.car.y,angle:car.car.angle};
  });
  await page.evaluate(()=>{
   input.keys.add('w');
   const v=window.cityVehicles;
   for(let i=0;i<18;i++)v.update(.05);
   input.keys.add('d');
   for(let i=0;i<22;i++)v.update(.05);
   input.keys.delete('w');input.keys.delete('d');
   for(let i=0;i<6;i++)v.render();
  });
  const moved=await page.evaluate(()=>{
   const c=window.cityVehicles, p=window.cityVehicleBridge.player;
   return {driver:c.driver,engine:c.engineOn,x:c.car.x,y:c.car.y,
    angle:c.car.angle,speed:c.car.speed,frames:c.frames,
    riderDistance:Math.hypot(p.x-c.car.x,p.y-c.car.y)};
  });
  console.log('GLB initial:',JSON.stringify(initial));
  console.log('GLB aligned:',JSON.stringify(aligned));
  console.log('GLB drive:',JSON.stringify({before,moved}));
  await page.screenshot({path:'artifacts/live-glb-silvia-driving.png'});
  if(!moved.driver||!moved.engine||moved.frames<6||
    !Number.isFinite(moved.x)||moved.riderDistance>.02||
    Math.hypot(moved.x-before.x,moved.y-before.y)<.1||
    Math.abs(moved.angle-before.angle)<.01)
   throw Error('Live 3D driving not working: '+JSON.stringify({before,moved,warnings,errors}));
  if(errors.length)throw Error('Browser JS errors: '+JSON.stringify(errors));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Final QA against the built local Three.js bundle and original GLB.

// Confirm browser QA against final live Three.js GLB bundle.
