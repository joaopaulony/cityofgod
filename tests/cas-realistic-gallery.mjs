import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir('artifacts/cas-qa',{recursive:true});
 await page.goto('http://127.0.0.1:4322/tests/cas-realistic-smoke.html',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.__testReady||window.__testError,null,{timeout:45000});
 const result=await page.evaluate(()=>({error:window.__testError,quality:window.fakeSystem?.realisticQuality}));
 console.log('REALISTIC_GALLERY',JSON.stringify(result));
 assert.ok(!result.error,result.error);
 assert.equal(Object.keys(result.quality||{}).length,2);
 for(const sex of ['male','female']){
  const info=result.quality[sex];
  assert.ok(info?.ok,sex+' failed quality: '+JSON.stringify(info));
  assert.ok(info.weightedFingerVertices?.left>=10&&info.weightedFingerVertices?.right>=10);
  if(sex==='female'){
   await page.locator('[data-cas-tab="body"]').click();
   await page.locator('input[name="sex"][value="female"]').check();
  }
  await page.waitForFunction(()=>document.querySelector('#cas-preview-source')?.textContent.includes('GLB REALISTA'),null,{timeout:45000});
  for(const clip of ['idle','walk','run','jump_air']){
   await page.locator('[data-cas-tab="animations"]').click();
   await page.locator('select[name="previewAction"]').selectOption(clip);
   await page.waitForTimeout(150);
  }
  await page.locator('[data-cas-tab="identity"]').click();
  await page.screenshot({path:'artifacts/cas-qa/realistic-gallery-'+sex+'.png'});
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(220);
 await page.screenshot({path:'artifacts/cas-qa/realistic-gallery-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('REALISTIC_GALLERY_PASS');
}catch(e){
 console.error('GALLERY_DIAGNOSTICS',JSON.stringify(await page.evaluate(()=>({ready:window.__testReady,error:window.__testError,source:document.querySelector('#cas-preview-source')?.textContent})).catch(()=>null)));
 console.error('GALLERY_PAGE_ERRORS',errors);
 await page.screenshot({path:'artifacts/cas-qa/realistic-gallery-error.png'}).catch(()=>{});
 throw e;
}finally{await browser.close();}