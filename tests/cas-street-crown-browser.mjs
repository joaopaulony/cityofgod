import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:850},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push('JS '+e.message));
page.on('requestfailed',r=>errors.push('NET '+r.url()+' '+r.failure()?.errorText));
try{
 await mkdir('artifacts/cas-qa',{recursive:true});
 await page.goto('http://127.0.0.1:4322/tests/cas-street-crown-smoke.html',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.__testReady===true||!!window.__testError,null,{timeout:85000});
 const info=await page.evaluate(()=>({error:window.__testError,ready:window.__testReady,models:window.fakeSystem?.streetCrownVariants?.size}));
 console.log('STREET_CROWN_BOOT',JSON.stringify(info));
 assert.ok(!info.error,info.error||'');
 assert.equal(info.models,6,'All six user-owned meshes must be loadable');
 await page.locator('#city-cas-dialog[open]').waitFor({timeout:30000});
 await page.locator('[data-cas-tab="body"]').click();
 assert.equal(await page.locator('#cas-street-model-row').isVisible(),true);
 const sexes=[['male',['hero','ped_man','thug','boss']],['female',['partner','ped_woman']]];
 for(const [sex,models] of sexes){
  await page.locator('input[name="sex"][value="'+sex+'"]').check();
  await page.waitForFunction(()=>document.querySelector('#cas-preview-source')?.textContent?.includes('STREET CROWN GLB + RIG'),null,{timeout:30000});
  for(const id of models){
   await page.locator('select[name="streetModel"]').selectOption(id);
   await page.waitForTimeout(350);
   const stats=await page.evaluate(()=>window.fakeSystem?.handSkeletonStats);
   assert.ok(stats?.bones===76&&stats?.extendedFingers===50&&stats?.helperBones===76,JSON.stringify({sex,id,stats}));
   await page.screenshot({path:'artifacts/cas-qa/street-'+id+'.png'});
  }
 }
 await page.locator('#cas-toggle-rig').click();
 assert.equal(await page.locator('#cas-toggle-rig').textContent(),'OCULTAR OSSOS');
 await page.locator('[data-cas-tab="animations"]').click();
 for(const clip of ['idle','walk','run','jump_air']){
  await page.locator('select[name="previewAction"]').selectOption(clip);
  await page.waitForTimeout(200);
 }
 await page.screenshot({path:'artifacts/cas-qa/street-76-bone-overlay.png'});
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(300);
 await page.screenshot({path:'artifacts/cas-qa/street-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('STREET_CROWN_6_MODELS_76_BONES_PASS');
}catch(e){
 console.error('STREET_CROWN_VISUAL_ERRORS',JSON.stringify(errors));
 console.error(e.stack||String(e));
 await page.screenshot({path:'artifacts/cas-qa/street-failed.png',fullPage:true}).catch(()=>{});
 throw e;
}finally{await browser.close();}
