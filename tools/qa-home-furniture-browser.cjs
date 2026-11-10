'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.CITY_TEST_URL||'http://127.0.0.1:4322',folder='artifacts/qa-home-f7';
fs.mkdirSync(folder,{recursive:true});
const report={date:new Date().toISOString(),steps:[],errors:[]};let browser,page;
async function run(name,fn){
 try{const detail=await fn();report.steps.push({name,result:'PASS',detail});console.log('F7_PASS',name,JSON.stringify(detail||{}));return true;}
 catch(e){report.steps.push({name,result:'FAIL',error:String(e.stack||e).slice(0,1800)});console.log('F7_FAIL',name,String(e.stack||e));return false;}
}
(async()=>{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(String(e)));
 await run('01 Entrada, CAS e mundo 3D',async()=>{
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('[data-front-action="new"]').waitFor({timeout:45000});
  await page.evaluate(()=>document.querySelector('[data-front-action="new"]').click());
  await page.waitForFunction(()=>window.CityFront?.phase==='playing'&&window.CityHomeUI&&window.CityHome?.catalog,null,{timeout:150000});
  if(await page.locator('#city-cas-dialog[open]').count()){
   await page.evaluate(()=>document.querySelector('#cas-save').click());
   await page.waitForFunction(()=>!document.querySelector('#city-cas-dialog')?.open,null,{timeout:45000});
  }
  return page.evaluate(()=>({phase:CityFront.phase,catalog:Object.keys(CityHome.catalog).length,mode:world.open?'city':'local'}));
 });
 const setup=await run('02 Casa válida e estante Quaternius com espaço livre',async()=>{
  const info=await page.evaluate(()=>{
   const C=CityHome,p=__game.player;
   const candidates=houses.filter(h=>h.architecture&&h.doorPt&&CityRealty.residential(h)&&!CityRealty.multi(h)&&h.architecture.levels?.[0]?.rooms?.length);
   candidates.sort((a,b)=>Math.hypot(a.doorPt[0]-p.x,a.doorPt[1]-p.y)-Math.hypot(b.doorPt[0]-p.x,b.doorPt[1]-p.y));
   let last='';
   for(const h of candidates.slice(0,70)){
    try{
     CityRealty.claim(h,{name:'Casa de QA F7'});
     h._architectureFurnished=true;C.sync(h);
     const state=C.saved[C.key(h)];if(!state)continue;
     state.items=[];
     if(!C.buy(h,'qf_shelf_large').ok)continue;
     const item=C.inventory(h).at(-1);
     const rooms=h.architecture.levels[0].rooms.filter(r=>r.use!=='circulation'&&r.x1-r.x0>2.8&&r.y1-r.y0>2.8).sort((a,b)=>(b.x1-b.x0)*(b.y1-b.y0)-(a.x1-a.x0)*(a.y1-a.y0));
     for(const room of rooms){
      const positions=[];
      for(let u=room.x0+1.1;u<room.x1-1;u+=.45)for(let v=room.y0+1;v<room.y1-1;v+=.45)positions.push([u,v]);
      positions.sort((a,b)=>a[0]-b[0]); 
      for(const uv of positions){
       const [x,y]=h.architecture.toWorld(...uv);
       if(!C.check(h,{...item,status:'placed',x,y,rot:0,z:0,floor:0},item.id).ok)continue;
       if(!C.place(h,item.id,{x,y,rot:0,floor:0}).ok)continue;
       const placed=C.find(h,item.id);
       const attempts=[[.5,0],[-.5,0],[0,.5],[0,-.5],[.5,.5],[-.5,-.5]];
       let target;
       for(const [dx,dy] of attempts){
        const move={...placed,x:Math.round((placed.x+dx)*2)/2,y:Math.round((placed.y+dy)*2)/2,rot:0};
        if(C.check(h,move,placed.id).ok){target={x:move.x,y:move.y};break;}
       }
       if(!target){C.store(h,item.id);continue;}
       // Keep player inside owned room yet away from furniture collision target.
       let stand=null;
       for(const u of [room.x1-0.7,room.x0+.7,(room.x0+room.x1)/2]){
        for(const v of [room.y1-.7,room.y0+.7,(room.y0+room.y1)/2]){
         const [sx,sy]=h.architecture.toWorld(u,v);
         if(Math.hypot(sx-x,sy-y)>1.8&&Math.hypot(sx-target.x,sy-target.y)>1.5){stand={x:sx,y:sy};break;}
        }if(stand)break;
       }
       if(!stand){C.store(h,item.id);continue;}
       Object.assign(p,{x:stand.x,y:stand.y,floor:0,floorZ:0,speed:0});
       Object.assign(cam,{x:stand.x,y:stand.y,tx:stand.x,ty:stand.y});
       window.__qaF7={H:h,id:item.id,initial:{x:placed.x,y:placed.y},target};
       return {ok:true,property:CityRealty.id(h),kind:placed.kind,initial:{x:placed.x,y:placed.y},target,stand};
      }
     }
    }catch(e){last=String(e);}
   }
   return {ok:false,options:candidates.length,last};
  });
  assert.ok(info.ok,JSON.stringify(info));return info;
 });
 if(!setup)return;
 const opened=await run('03 F7 abre com uma casa real e a estante instalada',async()=>{
  await page.keyboard.press('F7');
  await page.waitForFunction(()=>CityHomeUI.active,null,{timeout:20000});
  await page.waitForTimeout(1250);
  const x=await page.evaluate(()=>{
   const item=CityHome.find(__qaF7.H,__qaF7.id);const p=proj(item.x,item.y,item.z+item.h*.65);
   return {active:CityHomeUI.active,saved:[item.x,item.y],onScreen:p.x>0&&p.y>0};
  });
  assert.equal(x.active,true);return x;
 });
 if(!opened)return;
 await run('04 Arraste via mouse: modelo 3D anda sem salvar antes do soltar',async()=>{
  const pos=await page.evaluate(()=>{
   const q=__qaF7,b=CityHome.find(q.H,q.id);
   // Keep the model left of the sidebar.
   const pp=proj(b.x,b.y,0);if(pp.x>850){
    const shift=(pp.x-600)/cam.zoom;
    cam.x+=cam.cos*shift;cam.tx+=cam.cos*shift;cam.y-=cam.sin*shift;cam.ty-=cam.sin*shift;
    cam.update(.16);
   }
   const start=proj(b.x,b.y,0),end=proj(q.target.x,q.target.y,0);
   return {start,end};
  });
  await page.waitForTimeout(250);
  await page.locator('#city-home-builder [data-home-action="tab"][data-value="edit"]').click();
  await page.locator('#city-home-builder [data-home-action="move"]').first().click();
  // Position comes from the actual camera after editor settle, not stale values.
  const p=await page.evaluate(()=>{
    const q=__qaF7;return {a:proj(q.initial.x,q.initial.y,0),b:proj(q.target.x,q.target.y,0)};
  });
  assert.ok(p.a.x<1040&&p.b.x<1040,JSON.stringify(p));
  await page.mouse.move(p.a.x,p.a.y);await page.mouse.down();
  await page.mouse.move(p.b.x,p.b.y,{steps:10});
  const mid=await page.evaluate(()=>{
    const q=__qaF7,b=boxes.find(v=>v.homeId===q.id&&v.house===q.H),saved=CityHome.find(q.H,q.id);
    return {draft:{x:CityHomeUI.draft?.x,y:CityHomeUI.draft?.y},preview:{x:b?.x,y:b?.y},saved:{x:saved.x,y:saved.y}};
  });
  assert.ok(Math.hypot(mid.preview.x-mid.saved.x,mid.preview.y-mid.saved.y)>.12,'3D preview must move before save '+JSON.stringify(mid));
  await page.mouse.up();await page.waitForTimeout(250);
  const end=await page.evaluate(()=>{
    const q=__qaF7,b=CityHome.find(q.H,q.id);
    return {x:b.x,y:b.y,initial:q.initial,draft:CityHomeUI.draft?{x:CityHomeUI.draft.x,y:CityHomeUI.draft.y}:null,
      status:document.querySelector('#city-home-status')?.textContent};
  });
  assert.ok(Math.hypot(end.x-end.initial.x,end.y-end.initial.y)>.12,'mouse release did not persist position '+JSON.stringify(end));
  return {before:mid,after:end};
 });
 await run('05 Rotação R e atualização da orientação',async()=>{
  await page.locator('#city-home-builder [data-home-action="move"]').first().click();
  const before=await page.evaluate(()=>CityHome.find(__qaF7.H,__qaF7.id).rot);
  await page.keyboard.press('r');
  const draft=await page.evaluate(()=>({rot:CityHomeUI.draft?.rot,previewRot:boxes.find(b=>b.homeId===__qaF7.id)?.rot}));
  assert.ok(Math.abs(draft.rot-before)>.4,JSON.stringify(draft));
  await page.keyboard.press('Escape'); 
  const after=await page.evaluate(()=>CityHome.find(__qaF7.H,__qaF7.id).rot);
  assert.ok(Math.abs(after-before)<.0001,'cancel may not change saved rotation');
  return {before,draft,after};
 });
 await run('06 Tela F7, inventário, cancelamento e saída',async()=>{
  // Software WebGL can stall screenshots even when mouse/3D model tests pass.
  // Keep image capture best-effort and never classify a GPU screenshot timeout as a gameplay failure.
  try{await page.locator('#city-home-builder').screenshot({path:folder+'/painel-f7.png',timeout:7000});}
  catch(e){console.log('F7_CAPTURE_WARNING',String(e.message||e).slice(0,280));}
  const info=await page.evaluate(()=>{
   const q=__qaF7,id=q.id,c=CityHome;
   return {placed:c.placed(q.H).filter(x=>x.id===id).length,original:c.find(q.H,id),panel:!!document.querySelector('#city-home-builder:not([hidden])'),
    items:c.list.length};
  });
  assert.equal(info.placed,1);assert.ok(info.items>=100);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!CityHomeUI.active,null,{timeout:15000});
  return {items:info.items,panel:info.panel,closed:true};
 });
})().catch(e=>{report.errors.push(String(e.stack||e));console.log('F7_FATAL',String(e.stack||e));process.exitCode=1})
.finally(async()=>{
 report.summary={passed:report.steps.filter(s=>s.result==='PASS').length,failed:report.steps.filter(s=>s.result==='FAIL').length,errors:report.errors.length};
 fs.writeFileSync(folder+'/report.json',JSON.stringify(report,null,2));
 console.log('F7_SUMMARY',JSON.stringify(report.summary));
 await browser?.close().catch(()=>{});
 if(report.summary.failed||report.summary.errors)process.exitCode=1;
});
