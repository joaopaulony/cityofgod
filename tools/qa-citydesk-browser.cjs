'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {performance}=require('node:perf_hooks');
const HOST=process.env.CITY_TEST_URL||'http://127.0.0.1:4322',OUT='artifacts/qa-home-office';
fs.mkdirSync(OUT,{recursive:true});
const report={when:new Date().toISOString(),url:HOST,steps:[],errors:[],consoleErrors:[],screenshots:[]};
let browser,page;
const step=async(name,fn)=>{
 const t=performance.now();
 try{const detail=await fn();report.steps.push({name,result:'PASS',ms:Math.round(performance.now()-t),detail});console.log('QA_PASS '+name+' '+JSON.stringify(detail||{}));return true;}
 catch(e){report.steps.push({name,result:'FAIL',ms:Math.round(performance.now()-t),error:String(e.message||e)});console.log('QA_FAIL '+name+' '+String(e.stack||e));return false;}
};
const shot=async(name)=>{try{const p=OUT+'/'+name+'.png';await page.screenshot({path:p,timeout:12000,animations:'disabled'});report.screenshots.push(p);}catch(e){report.errors.push('screenshot '+name+': '+e.message)}};
(async()=>{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 await step('01 Abrir menu BETA',async()=>{
  await page.goto(HOST+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('[data-front-action="new"]').waitFor({timeout:30000});
  await shot('01-menu');
  const q=await page.evaluate(()=>({phase:window.CityFront?.phase,beta:document.querySelector('.front-beta-chip')?.textContent,logo:document.querySelector('#front-backdrop .front-preview-logo')?.getAttribute('src')}));
  assert.equal(q.phase,'title');assert.equal(q.beta,'BETA');return q;
 });
 const ready=await step('02 Começar partida e carregar 3D',async()=>{
  await page.locator('[data-front-action="new"]').click({timeout:15000});
  await page.waitForFunction(()=>window.CityFront?.phase==='playing'&&window.__game&&window.CityDesk?.state,null,{timeout:150000});
  await page.waitForTimeout(1400);
  if(await page.locator('#city-cas-dialog[open]').count()){
   await shot('02-cas-inicial');
   await page.locator('#cas-save').click({timeout:30000});
   await page.waitForFunction(()=>!document.querySelector('#city-cas-dialog')?.open,null,{timeout:45000});
  }
  await shot('02-gameplay');
  return page.evaluate(()=>({phase:CityFront.phase,player:{x:__game.player.x,y:__game.player.y},houses:houses.length,characters:!!window.cityCharacters?.ready,work3D:!!window.CityWork3D}));
 });
 if(!ready)return;
 const home=await step('03 Preparar imóvel e escrivaninha de teste em memória',async()=>{
  const q=await page.evaluate(()=>{
   window.cityCharacters?.closeCreator?.();window.CityUI?.togglePhone?.(false);
   const p=__game.player;
   const choices=houses.filter(h=>h.architecture&&h.contains&&h.doorPt&&h.architecture.toWorld&&!h.civic&&!h.terminal&&!h.brick&&h.architecture.levels?.[0]?.rooms?.length&&!CityRealty.multi(h));
   choices.sort((a,b)=>Math.hypot(a.doorPt[0]-p.x,a.doorPt[1]-p.y)-Math.hypot(b.doorPt[0]-p.x,b.doorPt[1]-p.y));
   let err='';
   for(const h of choices.slice(0,32)){
    try{
     CityRealty.claim(h,{name:'Imóvel QA'});
     CityHome.sync(h);
     for(const room of h.architecture.levels[0].rooms){
      if(room.x1-room.x0<2||room.y1-room.y0<2||room.use==='circulation')continue;
      const [x,y]=h.architecture.toWorld((room.x0+room.x1)/2,(room.y0+room.y1)/2);
      const data=CityHome.saved[CityHome.key(h)];if(!data)continue;
      data.items=data.items.filter(i=>i.id!=='browser-qa-desk');
      data.items.push({id:'browser-qa-desk',kind:'desk',status:'placed',x,y,z:0,rot:0,w:1.3,d:.7,h:.76,floor:0});
      p.x=x+.3;p.y=y+.1;p.floor=0;p.speed=0;
      const st=CityDesk.stationAt(p);
      if(st)return {ok:true,house:CityRealty.id(h),desk:st.id};
     }
    }catch(e){err=String(e)}
   }
   return {ok:false,options:choices.length,err};
  });
  assert.ok(q.ok,JSON.stringify(q));return q;
 });
 if(!home)return;
 await step('04 Abrir CityDesk com personagem sentado',async()=>{
  assert.equal(await page.evaluate(()=>CityDesk.show('home')),true);
  await page.locator('#city-desk .cd-window').waitFor();
  await shot('03-homeoffice');
  const q=await page.evaluate(()=>({opened:CityDesk.open,pose:__game.player.homeAction?.kind,screen:CityDesk.screenInfo()?.kind,nav:[...document.querySelectorAll('#city-desk .cd-nav button')].map(x=>x.innerText.trim())}));
  assert.ok(q.pose?.startsWith('desk_'));for(const n of ['CodeLab','HelpDesk','Brand Studio','CityLive','CitySeller','Marketplace'])assert.ok(q.nav.some(x=>x.includes(n)),n);return q;
 });
 for(const [app,name] of [['contracts','04-contratos'],['code','05-programador'],['help','06-suporte'],['brand','07-designer'],['live','08-streamer'],['seller','09-cityseller'],['market','10-marketplace']]){
  await step('05 Navegar '+app,async()=>{
   assert.equal(await page.evaluate(id=>CityDesk.show(id),app),true);
   await page.waitForTimeout(200);await shot(name);
   const q=await page.evaluate(()=>({title:document.querySelector('#city-desk .cd-main h2')?.innerText,count:document.querySelectorAll('#city-desk .cd-main button').length,text:document.querySelector('#city-desk .cd-main')?.innerText.slice(0,200)}));
   assert.ok(q.text?.length>20);return q;
  });
 }
 await step('05b Abrir uma loja pela UI do CitySeller',async()=>{
  assert.equal(await page.evaluate(()=>CityDesk.show('seller')),true);
  await page.locator('#city-desk [data-in="bname"]').fill('Loja QA Bairro');
  const before=await page.evaluate(()=>CityLife.funds);
  await page.locator('#city-desk [data-do="c:create"]').click();
  const after=await page.evaluate(()=>({shop:CityCommerce.state.shop?.brand?.name,money:CityLife.funds,save:!!localStorage.getItem('cityofgod.commerce.v1')}));
  assert.equal(after.shop,'Loja QA Bairro',JSON.stringify(after));assert.ok(after.money<before);assert.ok(after.save);
  await shot('11-loja-criada');return {before,after};
 });
 const contract=await step('06 Aceitar contrato no menu',async()=>{
  assert.equal(await page.evaluate(()=>CityDesk.show('contracts')),true);
  await page.locator('#city-desk [data-do^="accept:"]').first().click({timeout:15000});
  await shot('11-contrato');
  const q=await page.evaluate(()=>({contracts:CityDesk.state.contracts.map(x=>({career:x.career,id:x.id,status:x.state}))}));
  assert.ok(q.contracts.length>0);return q;
 });
 if(contract){
  await step('07 Trabalho automático, escala do tempo e animação',async()=>{
   const q=await page.evaluate(()=>{
    const c=CityDesk.state.contracts.find(x=>x.career==='programmer');if(!c)return {error:'no programmer'};
    CityDesk.startAuto(c);return {working:CityDesk.working,scale:CityTimeScale,pose:__game.player.homeAction?.kind,kind:CityDesk.screenInfo()?.kind};
   });
   assert.equal(q.working,true,JSON.stringify(q));assert.equal(q.scale,10);
   await page.waitForTimeout(1200);await shot('12-trabalho-automatico');
   const after=await page.evaluate(()=>{CityDesk.stopAuto('Fim QA');return {working:CityDesk.working,scale:CityTimeScale,pose:__game.player.homeAction?.kind}});
   assert.equal(after.working,false);assert.equal(after.scale,1);return {q,after};
  });
 }
 await step('08 Compras no marketplace e dinheiro',async()=>{
  assert.equal(await page.evaluate(()=>CityDesk.show('market')),true);
  await page.locator('#city-desk [data-do="m:view:npc-mercadinho"]').click();
  await page.locator('#city-desk [data-do="m:inc:LIFE-WATER"]').click();
  await shot('13-carrinho-marketplace');
  const before=await page.evaluate(()=>CityLife.funds);
  await page.locator('#city-desk [data-do="m:checkout:npc-mercadinho"]').click();
  const q=await page.evaluate(()=>({sku:'LIFE-WATER',before:0,after:CityLife.funds,purchases:CityCommerce.state.purchases.length,save:!!localStorage.getItem('cityofgod.commerce.v1')}));
  q.before=before;
  assert.ok(q.after<before,JSON.stringify(q));assert.ok(q.purchases>=1);assert.ok(q.save);return q;
 });
 await step('09 Salvamento local das profissões e do comércio',async()=>{
  const q=await page.evaluate(()=>{CityDesk.save();return {desk:!!localStorage.getItem('cityofgod.remote-work.v1'),commerce:!!localStorage.getItem('cityofgod.commerce.v1'),balance:CityLife.funds}});
  assert.ok(q.desk&&q.commerce);return q;
 });
 await step('10 Layout 1440x900',async()=>{
  await page.evaluate(()=>CityDesk.show('home'));
  const q=await page.evaluate(()=>{const r=document.querySelector('#city-desk .cd-window').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight}});
  assert.ok(q.x>=-1&&q.y>=-1&&q.x+q.w<=q.vw+1&&q.y+q.h<=q.vh+1,JSON.stringify(q));return q;
 });
 await step('11 Layout 800x680',async()=>{
  await page.setViewportSize({width:800,height:680});await page.waitForTimeout(200);
  await shot('13-view-compacta');
  const q=await page.evaluate(()=>{const r=document.querySelector('#city-desk .cd-window').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight}});
  assert.ok(q.x>=-1&&q.x+q.w<=q.vw+1,JSON.stringify(q));return q;
 });
})().catch(e=>{report.errors.push('FATAL '+String(e.stack||e));console.log('QA_FATAL '+String(e.stack||e));process.exitCode=1;}).finally(async()=>{
 report.summary={passed:report.steps.filter(x=>x.result==='PASS').length,failed:report.steps.filter(x=>x.result==='FAIL').length,errors:report.errors.length,consoleErrors:report.consoleErrors.length};
 fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));
 console.log('QA_FINAL_REPORT '+JSON.stringify(report));
 await browser?.close().catch(()=>{});
 if(report.summary.failed||report.summary.errors)process.exitCode=1;
});
