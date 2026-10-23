'use strict';
const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,
  args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html?seed=3250&quality=performance',
   {waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.cityVehicles&&
    ['ready','failed'].includes(window.cityVehicles.status),null,{timeout:120000});
  await page.evaluate(()=>{window.__manual=true;});
  fs.mkdirSync('artifacts/infrastructure',{recursive:true});
  const info=await page.evaluate(()=>{
    const signals=world.trafficSignals||[],farm=houses.find(h=>h.rural);
    return {lamps:world.lamps.length,signals:signals.length,
      main:signals.filter(s=>s.group==='main').length,
      branch:signals.filter(s=>s.group==='branch').length,
      rural:houses.filter(h=>h.rural).length,
      ruralPath:farm?.walk,car:window.cityVehicles.status};
  });
  console.log('WORLD INFRA',JSON.stringify(info));
  if(info.lamps<3||info.signals<2||info.main<1||info.branch<1||
    info.rural<1||!info.ruralPath||info.car!=='ready')
    throw Error('World infra missing '+JSON.stringify(info));
  const states=[];
  for(const [name,sec] of [['main-green',2],['main-yellow',22],
    ['all-red',24.5],['side-green',32],['side-yellow',43],['pedestrians-walk',49]]){
    const row=await page.evaluate(sec=>{
      const c=cam;
      c.x=c.tx=world.junction.x;c.y=c.ty=world.junction.y;
      T=sec;c.ang=c.tang=Math.PI/4;c.cos=Math.cos(c.ang);
      c.sin=Math.sin(c.ang);render();window.cityVehicles.render();
      return {main:trafficPhase(T).main,branch:trafficPhase(T).branch,
        states:world.trafficSignals.map(s=>signalState(s,T))};
    },sec);
    states.push({name,...row});
    console.log('SIGNAL PHASE',name,JSON.stringify(row));
    await page.screenshot({path:'artifacts/infrastructure/traffic-'+name+'.png'});
  }
  // Panoramas comprovam todos os quadrantes de camera, incluindo
  // frente e costas corretas dos tres focos e braco L orientado ao eixo.
  const approach=await page.evaluate(()=>{
    return world.trafficSignals.map(l=>{
      const g=trafficSignalGeometry(l);
      return {id:l.id,group:l.group,span:g.span,
        poleRoad:roadDist(l.x,l.y),
        tipRoad:roadDist(g.tip.x,g.tip.y),
        frontDot:g.face.x*l.ax+g.face.y*l.ay,
        perpendicular:l.ax*l.ix+l.ay*l.iy};
    });
  });
  console.log('APPROACH ALIGNMENT',JSON.stringify(approach));
  for(const a of approach){
    if(a.span<4||a.tipRoad>1.35||a.poleRoad<3.8||
       a.frontDot>-.99||Math.abs(a.perpendicular)>.015)
      throw Error('Road-facing head / overhead L alignment mismatch '+JSON.stringify(a));
  }
  for(let q=0;q<4;q++){
    await page.evaluate(q=>{
      cam.x=cam.tx=world.junction.x;cam.y=cam.ty=world.junction.y;
      cam.ang=cam.tang=Math.PI/4+q*Math.PI/2;
      cam.cos=Math.cos(cam.ang);cam.sin=Math.sin(cam.ang);
      T=49;render();window.cityVehicles.render();
    },q);
    await page.screenshot({path:'artifacts/infrastructure/gantry-camera-'+q+'.png'});
  }
  const protectedWalk=await page.evaluate(()=>{
    const p=trafficPhase(49);
    return p.main==='red'&&p.branch==='red'&&p.pedestrian==='walk'&&
      p.countdown>0;
  });
  if(!protectedWalk)throw Error('Pedestrian crossing not traffic-protected');
  for(const [kind,night] of [['day',false],['night',true]]){
    await page.evaluate(night=>{
      const l=world.lamps[0];
      cam.x=cam.tx=l.x;cam.y=cam.ty=l.y;
      st.night=night;render();window.cityVehicles.render();
    },night);
    await page.screenshot({path:'artifacts/infrastructure/streetlamp-'+kind+'.png'});
  }
  const farm=await page.evaluate(()=>{
    const H=houses.find(h=>h.rural);
    const v=window.cityVehicles;
    cam.x=cam.tx=(H.walk[0][0]+H.walk[1][0])/2;
    cam.y=cam.ty=(H.walk[0][1]+H.walk[1][1])/2;
    st.night=false;
    render();v.render();
    const c=document.createElement('canvas');c.width=640;c.height=480;
    const x=c.getContext('2d'),o=[H.walk[0],H.walk[1]],
      M=n=>n*34;
    x.translate(320-M((o[0][0]+o[1][0])/2),
      240-M((o[0][1]+o[1][1])/2));
    paintRuralAccess(x,M,H);
    return {kind:H.templateKey,walkLength:Math.hypot(
      o[0][0]-o[1][0],o[0][1]-o[1][1]),seed:H.seed,
      hasPath:!!ruralAccessProfile(H),
      painted:x.getImageData(0,0,640,480).data.reduce(
        (n,v,i)=>n+(i%4===3&&v>0?1:0),0)};
  });
  console.log('RURAL PATH',JSON.stringify(farm));
  if(farm.walkLength<1||farm.walkLength>13||farm.painted<1000)
    throw Error('Unpainted rural dirt/gravel access '+JSON.stringify(farm));
  await page.screenshot({path:'artifacts/infrastructure/farm-driveway.png'});
  await page.evaluate(()=>{
    const b=urbanLife.bins[0];if(!b)throw Error('No sidewalk bins in world');
    cam.x=cam.tx=b.x;cam.y=cam.ty=b.y;
    cam.zoom=cam.tzoom=ZOOMS[5];st.night=false;render();
    window.cityVehicles.render();
  });
  await page.screenshot({path:'artifacts/infrastructure/sidewalk-bin-detailed.png'});
  if(errors.length)throw Error('Browser errors '+JSON.stringify(errors));
  fs.writeFileSync('artifacts/infrastructure/report.json',
    JSON.stringify({info,states,farm},null,2));
  console.log('PASS traffic phases, daylight/night LED streetlamps and rural gravel path');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
