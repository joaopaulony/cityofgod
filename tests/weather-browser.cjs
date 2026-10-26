'use strict';
// Live outdoor rain, indoor precipitation exclusion, and no whitening of agents.
// Captures real Canvas2D + Three.js frames; no synthetic render or still asset.
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const OUT='artifacts/weather-calendar';fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html?seed=3250&quality=performance',
   {waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.cityVehicles?.scene&&window.cityVehicles?.renderer&&
   window.cityVehicles?.ambience&&window.CityCalendar&&window.CityShelter,undefined,{timeout:120000});
  const setup=await page.evaluate(()=>{
   window.__manual=true;
   const bridge=window.cityVehicleBridge;
   const H=bridge.houses.find(h=>h.architecture?.levels?.[0]?.rooms?.length&&h.front);
   if(!H)return {error:'No streamed architectural building'};
   const room=H.architecture.levels[0].rooms.find(r=>r.use==='living')||H.architecture.levels[0].rooms[0];
   const inside=H.architecture.toWorld((room.x0+room.x1)/2,(room.y0+room.y1)/2);
   const outdoor=Array.from({length:14},(_,i)=>{
    const mul=8+i*3;
    return [H.front[0]+(H.doorN?.[0]||0)*mul,H.front[1]+(H.doorN?.[1]||1)*mul];
   }).find(p=>!CityShelter.isSheltered(...p))||[H.front[0]+18,H.front[1]+18];
   CityRealty.owned[CityRealty.id(H)]={id:CityRealty.id(H),qaFixture:true};
   window.__weatherQA={house:H,inside,outdoor};
   return {inside,outdoor,roofRegion:CityShelter.isSheltered(...inside),
    outdoorRegion:CityShelter.isSheltered(...outdoor),room:room.id};
  });
  assert.ok(!setup.error,JSON.stringify(setup));
  assert.equal(setup.roofRegion,true,'Rooms must be sheltered');
  assert.equal(setup.outdoorRegion,false,'Outdoor staging must be exposed');
  const report=[];
  const frames=[
   {name:'snow-outdoors',date:[2028,12,25,13],weather:'snow',inside:false},
   {name:'snow-indoors',date:[2028,12,25,13],weather:'snow',inside:true},
   {name:'rain-outdoors',date:[2028,7,20,13],weather:'rain',inside:false},
   {name:'rain-indoors',date:[2028,7,20,13],weather:'rain',inside:true},
   {name:'storm-outdoors',date:[2028,7,20,13],weather:'storm',inside:false},
   {name:'spring-outdoors',date:[2028,4,8,13],weather:'breeze',inside:false}
  ];
  for(const f of frames){
   const info=await page.evaluate(({f})=>{
    const p=cityVehicleBridge.player,P=window.__weatherQA,
     pos=f.inside?P.inside:P.outdoor;
    p.x=pos[0];p.y=pos[1];p.floor=p.floorZ=0;p.speed=0;
    cam.x=cam.tx=pos[0];cam.y=cam.ty=pos[1];
    cam.zoom=cam.tzoom=56;
    CityCalendar.setDate(...f.date,0);envSetWeather(f.weather);
    envTick(12,CityCalendar.get().timestamp);
    if(f.weather==='snow')ENV.snowCover=.85;
    if(f.weather==='rain'||f.weather==='storm')ENV.wetness=.7;
    for(let i=0;i<4;i++)tick(.016);
    render();cityVehicles.render();
    const scene=cityVehicles.scene;
    let agentsWhitened=0,birdsWhitened=0,roofMaterials=0;
    scene.traverse(o=>{
      if(o.isSkinnedMesh&&o.material?.userData?.snowP)agentsWhitened++;
      if(o.isInstancedMesh&&o.material?.userData?.snowP)birdsWhitened++;
      if(o.userData?.weatherOutdoorSurface)roofMaterials++;
    });
    // Verify actual particle geometry avoids interiors, not just the CPU mask.
    let rainInside=0,snowInside=0,rainParticleCount=0,snowParticleCount=0;
    scene.traverse(o=>{
      const arr=o.geometry?.attributes?.position?.array;
      if(o.isLineSegments&&arr?.length===1500*6&&o.visible){
       rainParticleCount=1500;
       for(let i=0;i<1500;i++){
        const j=i*6;
        if(arr[j+1]>=0&&CityShelter.isSheltered(arr[j],arr[j+2]))rainInside++;
       }
      }
      if(o.isPoints&&arr?.length===2600*3&&o.visible){
       snowParticleCount=2600;
       for(let i=0;i<2600;i++){
        const j=i*3;
        if(arr[j+1]>=0&&CityShelter.isSheltered(arr[j],arr[j+2]))snowInside++;
       }
      }
    });
    const view=document.getElementById('view'),webgl=document.getElementById('vehicle3d');
    const c=document.createElement('canvas');c.width=view.width;c.height=view.height;
    const ctx=c.getContext('2d',{alpha:false});
    ctx.drawImage(view,0,0,c.width,c.height);ctx.drawImage(webgl,0,0,c.width,c.height);
    return {phase:f.name,date:CityCalendar.get().iso,season:CityCalendar.get().season,
     weather:envWeather().name,rain:ENV.rain,snow:ENV.snow,wetness:ENV.wetness,
     sheltered:CityShelter.isSheltered(p.x,p.y),agentsWhitened,birdsWhitened,
     roofMaterials,rainInside,snowInside,rainParticleCount,snowParticleCount,
     ambient:{...cityVehicles.ambience},png:c.toDataURL('image/png').split(',')[1]};
   },{f});
   const {png,...data}=info;fs.writeFileSync(OUT+'/'+f.name+'.png',Buffer.from(png,'base64'));
   report.push(data);fs.writeFileSync(OUT+'/report.partial.json',JSON.stringify({setup,report,errors},null,2));
  }
  const failures=[];
  const fail=(rule,condition)=>{if(!condition)failures.push(rule);};
  for(const f of report){
   fail(f.phase+' sky/roof shelter',f.sheltered===f.phase.endsWith('indoors'));
   fail(f.phase+' people remain original material',f.agentsWhitened===0);
   fail(f.phase+' birds remain original material',f.birdsWhitened===0);
   fail(f.phase+' no rain enters indoors',f.rainInside===0);
   fail(f.phase+' no snow enters indoors',f.snowInside===0);
  }
  fail('Rain exists as real WebGL geometry',report[2].rain>.5&&report[2].rainParticleCount>0);
  fail('Snow exists as real WebGL particles',report[0].snow>.5&&report[0].snowParticleCount>0);
  fail('Season updates from real year calendar',report[0].season==='inverno'&&report[2].season==='verão'&&report[5].season==='primavera');
  fs.writeFileSync(OUT+'/report.json',JSON.stringify({setup,report,errors,failures,
   note:'Passing quantitative checks does not replace visual inspection.'},null,2));
  if(errors.length||failures.length)throw Error(JSON.stringify({errors,failures}));
  console.log('WEATHER LIVE CHROME: 6 frames, roof masks, rain and snow, no agent material whitening');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
