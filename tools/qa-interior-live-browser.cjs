'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const ROOT='artifacts/qa-residential-interiors',HOST=process.env.CITY_TEST_URL||'http://127.0.0.1:4322';
fs.mkdirSync(ROOT,{recursive:true});
const report={when:new Date().toISOString(),steps:[],screenshots:[],warnings:[],errors:[]};
let page,browser;
async function check(name,fn){
 try{const detail=await fn();report.steps.push({name,result:'PASS',detail});console.log('HOME_PASS',name,JSON.stringify(detail||{}));return true;}
 catch(e){report.steps.push({name,result:'FAIL',error:String(e.stack||e).slice(0,4500)});console.log('HOME_FAIL',name,String(e.stack||e));return false;}
}
async function shot(name){
 const dest=ROOT+'/'+name+'.png';
 try{await page.screenshot({path:dest,timeout:18000,animations:'disabled'});report.screenshots.push(dest);}
 catch(e){
  report.warnings.push('Screenshot '+name+': '+String(e.message).slice(0,240));
  try{
   const data=await page.evaluate(()=>{
    const c=document.querySelector('#view');return c?.toDataURL('image/png')||null;
   });
   if(data?.startsWith('data:image/png;base64,')){
    fs.writeFileSync(dest,Buffer.from(data.split(',')[1],'base64'));report.screenshots.push(dest);
   }
  }catch(_){}
 }
}
(async()=>{
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(String(e)));
 const begun=await check('01 Nova partida, CAS e cenário',async()=>{
  await page.goto(HOST+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('[data-front-action="new"]').waitFor({timeout:35000});
  await page.evaluate(()=>document.querySelector('[data-front-action="new"]').click());
  await page.waitForFunction(()=>window.CityFront?.phase==='playing'&&window.CityHome?.catalog&&window.CityWork3D&&window.CityDesk,null,{timeout:150000});
  if(await page.locator('#city-cas-dialog[open]').count()){
   await page.evaluate(()=>document.querySelector('#cas-save').click());
   await page.waitForFunction(()=>!document.querySelector('#city-cas-dialog')?.open,null,{timeout:45000});
  }
  return page.evaluate(()=>({phase:CityFront.phase,furniture:CityHome.list.length,fx:!!CityWork3D}));
 });
 if(!begun)return;
 const prepared=await check('02 Propriedade real, escrivaninha contra parede e chuveiro',async()=>{
  const result=await page.evaluate(()=>{
   const C=CityHome,p=__game.player;
   const options=houses.filter(h=>h.architecture&&h.doorPt&&CityRealty.residential(h)&&!CityRealty.multi(h)&&h.architecture.levels?.[0]?.rooms?.length)
     .sort((a,b)=>Math.hypot(a.doorPt[0]-p.x,a.doorPt[1]-p.y)-Math.hypot(b.doorPt[0]-p.x,b.doorPt[1]-p.y));
   let last='';
   for(const H of options.slice(0,80))try{
    CityRealty.claim(H,{name:'Interiores QA'});
    H._architectureFurnished=true;C.sync(H);
    const data=C.saved[C.key(H)];if(!data)continue;
    data.items=[];C.refresh(H);
    const d=C.buy(H,'desk');if(!d.ok)continue;
    const sid=C.inventory(H).find(i=>i.kind==='desk').id;
    const rooms=H.architecture.levels[0].rooms.filter(r=>r.use!=='circulation'&&r.x1-r.x0>=3&&r.y1-r.y0>=3);
    rooms.sort((a,b)=>(b.x1-b.x0)*(b.y1-b.y0)-(a.x1-a.x0)*(a.y1-a.y0));
    let chosen=null;
    for(const room of rooms){
     for(let du=-.8;du<=.8;du+=.4)for(const gap of [.60,.8,1.1]){
      const [x,y]=H.architecture.toWorld((room.x0+room.x1)/2+du,room.y1-gap);
      p.x=H.architecture.toWorld(room.x0+.55,room.y0+.55)[0];p.y=H.architecture.toWorld(room.x0+.55,room.y0+.55)[1];p.floor=0;p.floorZ=0;
      if(!C.place(H,sid,{x,y,rot:0,floor:0}).ok)continue;
      const row=C.find(H,sid);row.faceW=[-Math.sin(H.architecture.angle||0),-Math.cos(H.architecture.angle||0)];
      row.faceW=[0,-1];row.along=row.w;row.depth=row.d;C.refresh(H);
      const face=CityHomeNav.facing(row);
      const seat={x:row.x+face.x*.6*(row.d/.62),y:row.y+face.y*.6*(row.d/.62)};
      const stand={x:row.x+face.x*1.45,y:row.y+face.y*1.45};
      if(CityHomeNav.safeSpot(H,row,seat.x,seat.y,row.id)&&CityHomeNav.safeSpot(H,row,stand.x,stand.y)){
       chosen={room,desk:row,stand,seat};break;
      }
      C.store(H,sid);
      break;
     }
     if(chosen)break;
    }
    if(!chosen)continue;
    const showerBuy=C.buy(H,'shower');if(!showerBuy.ok)continue;
    const showerId=C.inventory(H).find(i=>i.kind==='shower').id;
    let shower=null;
    const baths=H.architecture.levels[0].rooms.filter(r=>r.use==='bathroom');
    for(const room of [...baths,...rooms.filter(r=>r.id!==chosen.room.id),chosen.room]){
     if(!room||room.x1-room.x0<1.15||room.y1-room.y0<1.15)continue;
     for(let u=room.x0+.6;u<=room.x1-.6&&!shower;u+=.35)for(let v=room.y0+.6;v<=room.y1-.6;v+=.35){
      const [x,y]=H.architecture.toWorld(u,v);
      p.x=chosen.stand.x;p.y=chosen.stand.y;
      if(!C.place(H,showerId,{x,y,rot:0,floor:0}).ok)continue;
      shower={...C.find(H,showerId),room:room.id};break;
     }
     if(shower)break;
    }
    if(!shower)continue;
    Object.assign(p,{x:chosen.stand.x,y:chosen.stand.y,floor:0,floorZ:0,speed:0,homeAction:null});
    cam.x=cam.tx=p.x;cam.y=cam.ty=p.y;
    window.__qaHome={H,deskId:sid,showerId,stand:chosen.stand,seat:chosen.seat};
    return {ok:true,house:CityRealty.id(H),desk:{x:chosen.desk.x,y:chosen.desk.y,faceW:chosen.desk.faceW},shower:{x:shower.x,y:shower.y,room:shower.room},rooms:H.architecture.levels[0].rooms.length};
   }catch(e){last=String(e);}
   return {ok:false,candidates:options.length,last};
  });
  assert.ok(result.ok,JSON.stringify(result));return result;
 });
 if(!prepared)return;
 const d=await check('03 Sentar com direção do modelo e levantar dentro da casa',async()=>{
  const x=await page.evaluate(()=>{
   const q=window.__qaHome,p=__game.player,old={x:p.x,y:p.y},start=CityDesk.open('home');
   const seated={x:p.x,y:p.y,face:p.face,kind:p.homeAction?.kind};
   const desk=CityHome.find(q.H,q.deskId),f=CityHomeNav.facing(desk);
   const seatedOnFront=(p.x-desk.x)*f.x+(p.y-desk.y)*f.y>0;
   const interior=q.H.contains(p.x,p.y,0);
   CityDesk.close();
   const after={x:p.x,y:p.y,interior:q.H.contains(p.x,p.y,0),distance:Math.hypot(p.x-old.x,p.y-old.y)};
   return {start,seated,seatedOnFront,interior,after};
  });
  assert.equal(x.start,true,JSON.stringify(x));assert.equal(x.seatedOnFront,true,JSON.stringify(x));
  assert.equal(x.interior,true);assert.equal(x.after.interior,true);assert.ok(x.after.distance<.15);return x;
 });
 await check('04 Trabalhar nas quatro modalidades mantendo o mesmo assento',async()=>{
  const x=await page.evaluate(()=>{
   const H=__qaHome.H,p=__game.player,d=CityHome.find(H,__qaHome.deskId),st={H,desk:d,floor:0};
   const out=[];
   for(const kind of ['desk_code','desk_help','desk_design','desk_stream']){
    const started=CityDesk.sitDown(kind,st);
    out.push({kind,ok:!!started,inside:H.contains(p.x,p.y,0),back:started&&((p.x-d.x)*CityHomeNav.facing(d).x+(p.y-d.y)*CityHomeNav.facing(d).y)<0});
    CityDesk.standUp();
   }
   return out;
  });
  for(const z of x){assert.equal(z.ok,true,JSON.stringify(z));assert.equal(z.inside,true);assert.equal(z.back,false);}
  return x;
 });
 await check('05 Escurecer cidade, acender luminárias em todos os cômodos',async()=>{
  const a=await page.evaluate(()=>{
    const H=__qaHome.H,p=__game.player;
    Object.assign(p,{x:__qaHome.stand.x,y:__qaHome.stand.y,floor:0,floorZ:0});
    __game.st.clock=21*60+5;envTick(0,__game.st.clock);world.night=__game.st.night=ENV.night;
    CityHomePlus.powerOn(H);
    return {night:world.night,power:H.lightOn,rooms:H.architecture.levels[0].rooms.length};
  });
  await page.waitForTimeout(2400);
  await shot('01-casa-luzes-acesas');
  const b=await page.evaluate(()=>({...window.cityArchitecture3D,inside:__qaHome.H.inside}));
  assert.equal(a.night,true,JSON.stringify(a));assert.equal(b.powered,true,JSON.stringify(b));assert.ok(b.interiorFixtures>=2,JSON.stringify(b));assert.ok(b.lightsActive>=1);return {a,b};
 });
 await check('06 Interruptor desliga e religa iluminação interna e externa',async()=>{
  const q=await page.evaluate(()=>{
   const H=__qaHome.H,was=CityHomePlus.powerOn(H);
   const off=CityHomePlus.togglePower(H);
   const d=CityHomePlus.data(H).power,offWindow=H.lightOn;
   const on=CityHomePlus.togglePower(H);
   return {was,off:off.ok,d,offWindow,on:on.ok,again:H.lightOn,persisted:!!localStorage.getItem('cityofgod.home-plus.v1')};
  });
  assert.equal(q.was,true);assert.equal(q.off,true);assert.equal(q.d,false);assert.equal(q.offWindow,false);assert.equal(q.again,true);
  assert.equal(q.persisted,true);return q;
 });
 const wash=await check('07 Caminhar até box, entrar, ativar água e vapor',async()=>{
  const q=await page.evaluate(()=>{
   const H=__qaHome.H,p=__game.player,shower=CityHome.find(H,__qaHome.showerId),stand=CityHomeNav.exitSpot(H,shower,null);
   if(!stand)return {error:'no shower approach',x:shower.x,y:shower.y};
   Object.assign(p,{x:stand.x,y:stand.y,speed:0,floor:0,floorZ:0});
   const started=CityHomePlus.activity(H,shower.id);
   if(!started.ok)return {error:started.text,stand};
   let pose=false,inside=false;
   for(let i=0;i<260;i++){
    CityHomeRoutine.tick(.08,p,(x,y)=>[x,y],false);
    if(CityHomeRoutine.stage==='pose'){
     pose=true;
     for(let j=0;j<15;j++)CityHomeRoutine.tick(.08,p,(x,y)=>[x,y],false);
     inside=Math.hypot(p.x-shower.x,p.y-shower.y)<.2;
     CityWork3D.update(.15);break;
    }
   }
   return {started:started.ok,pose,inside,fx:CityWork3D.debug,player:{x:p.x,y:p.y},shower:{x:shower.x,y:shower.y}};
  });
  assert.equal(q.started,true,JSON.stringify(q));assert.equal(q.pose,true,JSON.stringify(q));assert.equal(q.inside,true,JSON.stringify(q));assert.equal(q.fx?.shower,true,JSON.stringify(q));assert.equal(q.fx?.steam,true);return q;
 });
 if(wash){await shot('02-banho-agua-vapor');}
 await check('08 Sair do banho, cancelar e permanecer dentro da residência',async()=>{
  const result=await page.evaluate(()=>{
   const H=__qaHome.H,p=__game.player,shower=CityHome.find(H,__qaHome.showerId);
   CityHomeRoutine.cancel('',true);CityWork3D.update(.1);
   return {position:{x:p.x,y:p.y},inHouse:H.contains(p.x,p.y,0),
    safe:CityHomeNav.safeSpot(H,shower,p.x,p.y),busy:CityHomeRoutine.active,fx:CityWork3D.debug};
  });
  assert.ok(result.inHouse&&result.safe&&!result.busy&&!result.fx.shower,JSON.stringify(result));
  return result;
 });
})().catch(e=>{report.errors.push(String(e.stack||e));console.log('HOME_FATAL',String(e.stack||e));process.exitCode=1;}).finally(async()=>{
 report.summary={pass:report.steps.filter(x=>x.result==='PASS').length,fail:report.steps.filter(x=>x.result==='FAIL').length,errors:report.errors.length};
 fs.writeFileSync(ROOT+'/report.json',JSON.stringify(report,null,2));
 console.log('HOME_RESULT',JSON.stringify(report.summary));
 await browser?.close().catch(()=>{});
 if(report.summary.fail||report.summary.errors)process.exitCode=1;
});
