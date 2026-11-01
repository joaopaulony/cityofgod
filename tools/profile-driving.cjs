// Repeatable live-engine route for relative CPU/frame comparisons (not a hardware FPS claim).
const {chromium}=require('playwright'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Fix the legacy terrain seed without switching the game into its local test map.
 // A Git baseline serves only these reviewed runtime files from the chosen revision.
 const baseline=process.env.CITY_BASELINE_REF;
 if(baseline&&!/^[a-f0-9]{7,40}$/.test(baseline))throw Error('Use an explicit commit SHA for the baseline');
 const files=new Set(['world.js','game.js','openworld.js','terrain.js','vehicle-webgl.bundle.js']);
 await page.route('**/js/*',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1);
  if(!files.has(name)||(!baseline&&name!=='world.js'))return route.continue();
  let source=baseline?execFileSync('git',['show',baseline+':js/'+name],{encoding:'utf8',maxBuffer:8*1024*1024}):await(await route.fetch()).text();
  if(name==='world.js')source=source.replace(/const SEED = [^\n]+/,'const SEED = 123456;');
  await route.fulfill({status:200,contentType:'text/javascript',body:source});
 });
 await page.goto(process.env.CITY_TEST_URL||'http://127.0.0.1:4323/');
 await page.locator('[data-front-action="new"]').click();
 await page.waitForFunction(()=>window.CityFront?.phase==='playing',null,{timeout:120000});
 await page.evaluate(async()=>{
  owTeleport(2000,1600);
  const roads=world.roads.filter(r=>r.pts.length>12).sort((a,b)=>b.pts.length-a.pts.length),r=roads[0];
  if(!r)throw Error('Missing profiling route');
  const pts=r.pts.map(p=>({x:p.x,y:p.y}));window.__route=pts;
  await cityVehicles.restoreCheckpoint({key:'profile:sedan',modelId:'sedan',angle:0,fuel:1,engineOn:true,headlights:false},pts[0]);
  Object.assign(cam,{x:pts[0].x,y:pts[0].y,tx:pts[0].x,ty:pts[0].y});
 });
 await page.waitForTimeout(3000);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});await cdp.send('Profiler.start');
 const report=await page.evaluate(async()=>{
  const samples={},frames=[],route=window.__route,stats={};
  function wrap(owner,key,label){const original=owner[key];if(typeof original!=='function')return;owner[key]=function(...args){const t=performance.now();try{return original.apply(this,args);}finally{(samples[label]||=[]).push(performance.now()-t);}};}
  for(const name of ['tick','render','drawGround','drawHUD','owStep','owFinish','warmIdle'])wrap(window,name,name);
  wrap(world,'streamTick','stream');wrap(cityVehicles,'render','webgl');wrap(cityVehicles,'update','vehiclePhysics');
  let index=0,along=0,count=0,last=performance.now();const original=cityVehicles.update;
  cityVehicles.update=function(dt){
   along+=.55;while(index<route.length-2&&along>Math.hypot(route[index+1].x-route[index].x,route[index+1].y-route[index].y)){along-=Math.hypot(route[index+1].x-route[index].x,route[index+1].y-route[index].y);index++;}
   const a=route[index],b=route[index+1],d=Math.max(.001,Math.hypot(b.x-a.x,b.y-a.y)),u=Math.min(1,along/d);
   Object.assign(this.car,{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,angle:Math.atan2(b.y-a.y,b.x-a.x),speed:10});original.call(this,dt);
  };
  await new Promise(resolve=>{function sample(now){frames.push(now-last);last=now;if(++count>=240)resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});
  function summary(values){const s=values.slice().sort((a,b)=>a-b);return{count:s.length,mean:+(s.reduce((a,b)=>a+b,0)/s.length).toFixed(2),p95:+s[Math.floor(s.length*.95)].toFixed(2),max:+s.at(-1).toFixed(2)};}
  for(const [key,values]of Object.entries(samples))stats[key]=summary(values);
  return{frames:summary(frames),stats,route:{start:route[0],end:route[index],points:route.length},world:{houses:houses.length,boxes:boxes.length,circles:world.circles.length,segs:world.segs.length,sectors:openWorld.sectors.size}};
 });
 const {profile}=await cdp.send('Profiler.stop'),nodes=new Map(profile.nodes.map(n=>[n.id,n])),hot=new Map();
 profile.samples.forEach((id,i)=>{const f=nodes.get(id).callFrame;if(!/\/js\//.test(f.url))return;const key=f.functionName+' '+f.url.split('/').at(-1)+':'+(f.lineNumber+1);hot.set(key,(hot.get(key)||0)+(profile.timeDeltas[i]||0));});
 report.hot=[...hot].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([name,us])=>({name,ms:Math.round(us/1000)}));report.errors=errors;report.seed=123456;report.baseline=baseline||null;
 // Finish the same destination sectors and compare generated contents, independent
 // of how much background generation fits inside the measured 240 frames.
 report.generated=await page.evaluate(async()=>{
  CityFront.pause();await world.prepareResume(2100,1590);
  const rows=owWanted(2100,1590).map(([,i,j])=>OW.sectors.get(i+','+j)).sort((a,b)=>a.key.localeCompare(b.key)).map(S=>[S.key,(S.own.houses||[]).map(H=>[H.seed,H.x0,H.y0,H.x1,H.y1]),(S.own.props||[]).map(p=>[p.type,p.x,p.y]),(S.own.boxes||[]).map(b=>[b.kind,b.x,b.y,b.w,b.d])]);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows)));
  return{sectors:rows.length,digest:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')};
 });
 fs.mkdirSync('artifacts/performance',{recursive:true});fs.writeFileSync('artifacts/performance/'+(process.env.CITY_PROFILE_NAME||'driving')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
