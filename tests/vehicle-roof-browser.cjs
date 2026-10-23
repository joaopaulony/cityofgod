'use strict';
const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,
  args:['--no-sandbox','--enable-webgl','--use-gl=angle',
   '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html?seed=3250&quality=performance',
   {waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.cityVehicles&&
   ['ready','failed'].includes(window.cityVehicles.status),null,{timeout:120000});
  if(await page.evaluate(()=>cityVehicles.status)!=='ready')throw Error('GLB failed');
  await page.evaluate(()=>{window.__manual=true;});
  fs.mkdirSync('artifacts/vehicle-roof',{recursive:true});
  const houses=await page.evaluate(()=>{
   const hs=window.cityVehicleBridge.houses;
   return ['hip','gable'].map(kind=>{
    const H=hs.find(h=>h.roofKind===kind);
    return H?{kind,x0:H.x0,x1:H.x1,y0:H.y0,y1:H.y1}:null;
   }).filter(Boolean);
  });
  if(houses.length!==2)throw Error('Need hip and gable roof examples');
  const models=['silvia','compact','coupe','hatchback','minivan',
   'offroad','pickup','sedan','sport','suv','wagon'];
  const report=[];
  for(const id of models){
   const ok=await page.evaluate(id=>window.cityVehicles.selectModel(id),id);
   if(!ok)throw Error('Model failed '+id);
   const angles=id==='silvia'
    ?[Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4]:[Math.PI/4];
   for(const H of houses)for(let j=0;j<angles.length;j++){
    const row=await page.evaluate(({id,H,angle})=>{
     const v=window.cityVehicles,cam=window.cityVehicleBridge.cam;
     cam.ang=cam.tang=angle;cam.cos=Math.cos(angle);cam.sin=Math.sin(angle);
     cam.x=cam.tx=(H.x0+H.x1)/2;
     cam.y=cam.ty=(H.y0+H.y1)/2;
     // Vehicle in front of wall and along overhanging roof, including the
     // precise angle that used to create a hard perpendicular cut.
     // Foreground-facing car must remain visible in front of the roof.
     // Using the far wall made every screenshot show only the house,
     // which validated opacity but did not exercise real car visibility.
     const cx=(H.x0+H.x1)/2,cy=(H.y0+H.y1)/2,
      dist=Math.max(H.x1-H.x0,H.y1-H.y0)/2+v.car.length/2+.45;
     Object.assign(v.car,{
      x:cx+Math.sin(angle)*dist,y:cy+Math.cos(angle)*dist,
      angle:0,speed:0
     });
     v.render();tick(0);
     const found=window.cityVehicleBridge.houses.find(h=>
      h.roofKind===H.kind&&h.x0===H.x0&&h.y0===H.y0);
     return {id,kind:H.kind,angle,status:v.status,
      frames:v.frames,wallMeshes:v.houseOccluders,
      opaque:!found.fade,source:v.source};
    },{id,H,angle:angles[j]});
    report.push(row);
    console.log('ROOF QA',JSON.stringify(row));
    if(row.status!=='ready'||!row.opaque||!row.wallMeshes||
      row.frames<2||!row.source.endsWith('.glb'))
     throw Error('Unexpected see-through house or missing GLB: '+JSON.stringify(row));
    await page.screenshot({path:'artifacts/vehicle-roof/'+id+'-'+H.kind+'-'+j+'.png'});
   }
  }
  if(errors.length)throw Error('Browser JS errors: '+JSON.stringify(errors));
  fs.writeFileSync('artifacts/vehicle-roof/report.json',JSON.stringify(report,null,2));
  console.log('PASS 11 GLB cars, opaque hip+gable roofs, four camera orientations');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
