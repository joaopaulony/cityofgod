'use strict';
const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html?seed=3250&quality=performance',
   {waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.cityVehicles&&['ready','failed'].includes(window.cityVehicles.status),
   null,{timeout:120000});
  if((await page.evaluate(()=>cityVehicles.status))!=='ready')
   throw Error('GLB did not load');
  await page.evaluate(()=>{window.__manual=true;window.cityVehicles.engineOn=false;});
  const snapshot=await page.evaluate(()=>{
   const v=window.cityVehicles,b=window.cityVehicleBridge,c=b.cam;
   const H=b.houses.find(h=>h.roofKind==='hip'&&!h.inside)||
    b.houses.find(h=>h.roofKind==='gable'&&!h.inside);
   if(!H)throw Error('No pitched house in city world');
   return {kind:H.roofKind,bounds:[H.x0,H.y0,H.x1,H.y1],
    models:v.catalog.length};
  });
  fs.mkdirSync('artifacts/vehicle-roof',{recursive:true});
  const angles=[Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4];
  const positions=[];
  for(let i=0;i<angles.length;i++){
   const location=await page.evaluate(angle=>{
    const v=window.cityVehicles,b=window.cityVehicleBridge,c=b.cam;
    const H=b.houses.find(h=>h.roofKind==='hip'&&!h.inside)||
     b.houses.find(h=>h.roofKind==='gable'&&!h.inside);
    c.ang=c.tang=angle;c.cos=Math.cos(angle);c.sin=Math.sin(angle);
    c.x=c.tx=(H.x0+H.x1)/2;c.y=c.ty=(H.y0+H.y1)/2;
    const base={x:v.car.x,y:v.car.y,angle:v.car.angle};
    let point=null;
    for(let x=H.x0-7;x<=H.x1+7&&!point;x+=.85){
     for(let y=H.y0-7;y<=H.y1+7;y+=.85){
      if(x>H.x0&&x<H.x1&&y>H.y0&&y<H.y1)continue;
      Object.assign(v.car,{x,y,angle:0});
      v.prepareScene();
      if(H.vehicleRoofFade){point={x,y,angle,coverage:v.roofCutaways};break;}
     }
    }
    if(!point)Object.assign(v.car,base);
    else{
     v.render();
     tick(0);
    }
    return point;
   },angles[i]);
   if(!location)throw Error('No outside vehicle roof cutaway at '+angles[i]);
   positions.push(location);
   await page.screenshot({path:'artifacts/vehicle-roof/angle-'+i+'.png'});
  }
  const models=['silvia','compact','coupe','hatchback','minivan',
   'offroad','pickup','sedan','sport','suv','wagon'];
  const summary=[];
  for(const id of models){
   const result=await page.evaluate(async({id,point})=>{
    const v=window.cityVehicles,b=window.cityVehicleBridge,c=b.cam;
    const ok=await v.selectModel(id);
    if(!ok)return {id,ok:false,error:v.error};
    c.ang=c.tang=point.angle;
    c.cos=Math.cos(c.ang);c.sin=Math.sin(c.ang);
    const H=b.houses.find(h=>h.roofKind==='hip'&&!h.inside)||
     b.houses.find(h=>h.roofKind==='gable'&&!h.inside);
    // Different body lengths require different points behind the exact
    // same roof; reusing the Silvia's edge point generated false failures.
    let overlap=null;
    for(const offset of [0,.4,-.4,.8,-.8,1.2,-1.2,1.6,-1.6,
                          2,-2,2.6,-2.6]){
     for(const shift of [0,.4,-.4,.8,-.8,1.2,-1.2]){
      const x=point.x+offset,y=point.y+shift;
      if(x>H.x0&&x<H.x1&&y>H.y0&&y<H.y1)continue;
      Object.assign(v.car,{x,y,angle:0,speed:0});
      v.prepareScene();
      if(H.vehicleRoofFade){overlap={x,y};break;}
     }
     if(overlap)break;
    }
    tick(0);
    return {id,ok,overlap,roofFade:H.vehicleRoofFade,canvasFade:H.fade,
      count:v.roofCutaways,wallDepth:v.houseOccluders,
      model:v.model,frames:v.frames};
   },{id,point:positions[0]});
   summary.push(result);
   console.log('ROOF MODEL',JSON.stringify(result));
   await page.screenshot({path:'artifacts/vehicle-roof/'+id+'.png'});
   if(!result.ok||!result.overlap||!result.roofFade||!result.canvasFade||
      result.wallDepth<1||result.frames<2)
    throw Error('Roof GLB transparency not synchronized: '+JSON.stringify(result));
  }
  const restored=await page.evaluate(()=>{
   const v=window.cityVehicles,b=window.cityVehicleBridge;
   v.car.x=2;v.car.y=2;v.prepareScene();
   const H=b.houses.find(h=>h.roofKind==='hip'&&!h.inside)||
    b.houses.find(h=>h.roofKind==='gable'&&!h.inside);
   return {fade:H.vehicleRoofFade,cutaways:v.roofCutaways};
  });
  if(restored.fade)throw Error('House roof remains transparent away from vehicle');
  if(errors.length)throw Error('JS errors '+JSON.stringify(errors));
  fs.writeFileSync('artifacts/vehicle-roof/results.json',
   JSON.stringify({snapshot,positions,summary,restored},null,2));
  console.log('PASS 11 GLBs, 4 camera angles, roof cutaway & restoration');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
