'use strict';
// Browser-rendered City Home evidence: 12 synchronized Canvas/WebGL captures.
// Visual acceptance still requires human review of PNGs; numeric tests are gates.
const {chromium}=require('playwright'),fs=require('node:fs');
const assert=require('node:assert/strict');
const OUT='artifacts/city-home-animation';
const variants=[
 {kind:'sofa',phase:'sit',times:[.3,1.4,2.6,4.8]},
 {kind:'bed',phase:'sleep',times:[.4,2.4,5,8.6]},
 {kind:'stove',phase:'cook',times:[.8,2.5,4.2,6.9]}
];
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html?seed=3250&quality=performance',
   {waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.cityCharacters&&['ready','partial','failed'].includes(window.cityCharacters.status),
   null,{timeout:120000});
  const info=await page.evaluate(()=>({
   status:cityCharacters.status,ready:cityCharacters.ready,
   models:cityCharacters.models?.length,errors:cityCharacters.errors,
   webgl:!!window.cityVehicles?.scene&&!!window.cityVehicles?.renderer
  }));
  assert.ok(info.ready&&info.webgl,'WebGL Mixamo must be ready: '+JSON.stringify(info));
  fs.mkdirSync(OUT,{recursive:true});
  const frames=[];
  for(const {kind,phase,times} of variants){
   const setup=await page.evaluate(({kind})=>{
    window.__manual=true;
    const bridge=window.cityVehicleBridge,player=bridge.player;
    // Prefer a real, walkable furnished house; never stage a character on
    // a socket outside the walls (the old screenshot's false-negative).
    let H=null,item=null,stand=null;
    for(const house of bridge.houses.filter(h=>h.architecture?.levels?.[0]?.furniture?.some(f=>f.kind===kind))){
     house.furnishOnPurchase?.();
     for(const fixture of bridge.boxes.filter(b=>b.kind===kind&&b.house===house&&!(b.floor||0))){
      const side=kind==='bed'?fixture.w/2+.56:0;
      const front=kind==='chair'?-1:1,c=Math.cos(fixture.rot||0),s=Math.sin(fixture.rot||0);
      const v=kind==='bed'?0:front*(fixture.d/2+(kind==='stove'?.34:.52));
      const x=fixture.x+side*c-v*s,y=fixture.y+side*s+v*c;
      if(!house.contains?.(x,y))continue;
      const p=house.architecture.toLocal(x,y);
      if(!CityHomeNav.inside(house,0,p[0],p[1])||CityHomeNav.furnitureBlocked(house,0,p[0],p[1],null))continue;
      H=house;item=fixture;stand={x,y};break;
     }
     if(H)break;
    }
    if(!item)return {error:'No legally accessible '+kind+' furniture socket in generated houses'};
    // A player may only see the architectural cutaway in a property they own.
    // Grant the test browser an ephemeral owned fixture; production ownership
    // and purchase mechanics remain unchanged.
    CityRealty.owned[CityRealty.id(H)]={id:CityRealty.id(H),testFixture:true};
    window.__cityHomeQA={H,item};
    player.x=stand.x;player.y=stand.y;
    player.face=kind==='bed'?Math.atan2(item.y-player.y,item.x-player.x):
      kind==='sofa'?item.rot+Math.PI/2:item.rot-Math.PI/2;
    player.armed=false;player.aiming=false;player.speed=0;player.running=false;
    player.floor=item.floor||0;player.floorZ=player.floor*(H.floorHeight||3);
    player.homeAction=null;
    cam.x=cam.tx=player.x;cam.y=cam.ty=player.y;
    cam.zoom=cam.tzoom=Math.max(46,Math.min(62,cam.zoom));
    for(let i=0;i<12;i++)tick(.016);
    return {houseInside:!!H.inside,contains:H.contains?.(player.x,player.y)??null,
      fixture:{id:item.id,x:item.x,y:item.y,w:item.w,d:item.d,h:item.h,rot:item.rot,floor:item.floor||0},
      player:{x:player.x,y:player.y},furniture3d:window.cityVehicles?.props3d?.furniture??null,
      architecture3d:window.cityVehicles?.architecture3d?.properties??null};
   },{kind});
   if(!setup.error){
    await page.screenshot({path:OUT+'/'+phase+'-staged.png'});
    fs.writeFileSync(OUT+'/'+phase+'-setup.json',JSON.stringify(setup,null,2));
   }
   assert.ok(!setup.error,JSON.stringify(setup));
   assert.equal(setup.houseInside,true,'Player and furniture must be inside visible house: '+JSON.stringify(setup));
   assert.ok(setup.furniture3d>0,'3D furniture not rendered: '+JSON.stringify(setup));
   for(let i=0;i<times.length;i++){
    const report=await page.evaluate(({kind,phase,time})=>{
     const player=cityVehicleBridge.player;
     const {H,item}=window.__cityHomeQA;
     player.homeAction={kind:phase,item:{...item},socket:{u:kind==='bed'?item.w/2+.56:0,v:1},
      t:time,duration:CityHomePerformance.duration(phase)};
     player.speed=0;player.running=false;
     // Warm architecture/props and bones for several renders before capturing.
     for(let i=0;i<4;i++)tick(.016);
     const J=player.J,rendered=cityCharacters.homeTelemetry?.(player);
     const loc=([x,y])=>{
      const dx=x-item.x,dy=y-item.y,c=Math.cos(item.rot||0),s=Math.sin(item.rot||0);
      return [dx*c+dy*s,-dx*s+dy*c];
     };
     const hipLocal=loc(J.pelvis),renderedLocal=rendered?.hips?loc(rendered.hips):null;
     const handLocal=['L','R'].map(s=>loc(J['hand'+s]));
     const feet=['L','R'].map(s=>J['ank'+s]);
     const modelError=rendered?.hips?Math.hypot(
      rendered.hips[0]-J.pelvis[0],rendered.hips[1]-J.pelvis[1],
      rendered.hips[2]-J.pelvis[2]-(player.floorZ||0)):null;
     return {kind,phase,t:time,houseInside:!!H.inside,furniture3d:cityVehicles.props3d?.furniture??0,
      character:cityCharacters.telemetry().find(x=>x.name==='Jogador'),
      rendered,modelError,hip:J.pelvis,head:J.head,hands:[J.handL,J.handR],
      feet,hipLocal,renderedLocal,handLocal,finite:Object.values(J).filter(Array.isArray)
       .every(arr=>arr.every(Number.isFinite)),
      fixture:{x:item.x,y:item.y,w:item.w,d:item.d,h:item.h,rot:item.rot}};
    },{kind,phase,time:times[i]});
    frames.push(report);
    await page.screenshot({path:OUT+'/'+phase+'-'+String(i+1).padStart(2,'0')+'.png'});
    fs.writeFileSync(OUT+'/report.partial.json',JSON.stringify({status:info,frames},null,2));
    assert.ok(report.finite&&report.character?.visible&&report.rendered?.ready,
      'Real WebGL character missing: '+JSON.stringify(report));
    assert.ok(report.houseInside&&report.furniture3d>0,
      'The roof/furniture visibility context is invalid: '+JSON.stringify(report));
    assert.ok(report.rendered.hips?.every(Number.isFinite),'No rendered hip evidence: '+JSON.stringify(report));
    if(i===2){
     const halfW=setup.fixture.w/2,halfD=setup.fixture.d/2;
     if(phase==='sit'){
      assert.ok(Math.abs(report.hipLocal[0])<halfW-.05&&
       Math.abs(report.hipLocal[1])<halfD-.02&&report.hip[2]>.35&&report.hip[2]<.58,
       'Pelvis is not aligned to seat: '+JSON.stringify(report));
      assert.ok(report.feet.every(f=>Math.hypot(f[0]-report.hip[0],f[1]-report.hip[1])<.88),
       'Feet are too distant to form natural seated legs: '+JSON.stringify(report));
     }else if(phase==='sleep'){
      assert.ok(Math.abs(report.hipLocal[0])<halfW&&Math.abs(report.hipLocal[1])<halfD&&
       report.head[2]>.58&&report.head[2]<.95,
       'Character is not reclining above mattress: '+JSON.stringify(report));
     }else{
      assert.ok(report.hipLocal[1]>halfD+.23&&report.hipLocal[1]<halfD+.7,
       'Character is standing on the stove instead of in front: '+JSON.stringify(report));
      assert.ok(report.hands.every(h=>h[2]>.72&&h[2]<1.28),
       'Hands are too far above/below stove: '+JSON.stringify(report));
     }
    }
   }
   await page.evaluate(()=>{cityVehicleBridge.player.homeAction=null;tick(.016);});
  }
  if(errors.length)throw Error('Browser JavaScript errors: '+JSON.stringify(errors));
  fs.writeFileSync(OUT+'/report.json',JSON.stringify({status:info,frames,
   note:'Geometric pass is not a visual quality grade. Review all 12 PNG frames.'},null,2));
  console.log('CITY HOME WEBGL 12-frame visual evidence recorded; manual visual judgment still required');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
