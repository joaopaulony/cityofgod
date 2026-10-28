import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1350,height:800}});
const errors=[];
page.on('pageerror',e=>errors.push('JS: '+e.message));
page.on('requestfailed',r=>errors.push('Network: '+r.url()+' '+r.failure()?.errorText));
try{
 await mkdir('artifacts/cas-qa',{recursive:true});
 await page.goto('http://127.0.0.1:4322/tests/cas-browser-smoke.html?testReborn=1',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.__testReady===true,null,{timeout:60000});
 await page.locator('#city-cas-dialog[open]').waitFor({timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#cas-preview-source')?.textContent.includes('SOMENTE OSSOS'),null,{timeout:60000});
 console.log('CAS_REBORN_MALE',await page.locator('#cas-preview-source').innerText());
 const male=await page.evaluate(()=>window.fakeSystem?.handSkeletonStats);
 console.log('CAS_FINGER_RIG_MALE',JSON.stringify(male));
 assert.ok(male?.bones>=70,'CAS finger bones are absent: '+JSON.stringify(male));
 assert.equal(male.extendedFingers,50,'10 individual digit chains must be visible');
 assert.ok(male.helperBones>=70,'SkeletonHelper missed the newly added finger bones');
 await page.locator('[data-cas-tab=animations]').click();
 for(const id of ['idle','walk','run','jump_air']){
  await page.locator('select[name=previewAction]').selectOption(id);
  await page.waitForTimeout(180);
 }
 await page.screenshot({path:'artifacts/cas-qa/reborn-male-desktop.png'});
 await page.locator('[data-cas-tab=body]').click();
 await page.locator('input[name=sex][value=female]').check();
 await page.waitForFunction(()=>document.querySelector('#cas-preview-source')?.textContent.includes('SOMENTE OSSOS'),null,{timeout:60000});
 console.log('CAS_REBORN_FEMALE',await page.locator('#cas-preview-source').innerText());
 const female=await page.evaluate(()=>window.fakeSystem?.handSkeletonStats);
 console.log('CAS_FINGER_RIG_FEMALE',JSON.stringify(female));
 assert.ok(female?.bones>=70&&female.extendedFingers===50&&female.helperBones>=70,'female finger hierarchy incomplete');
 await page.screenshot({path:'artifacts/cas-qa/reborn-female-desktop.png'});
 await page.locator('[data-cas-tab=identity]').click();
 await page.locator('input[name=name]').fill('Luiza Reborn');
 await page.locator('#cas-save').click();
 await page.waitForFunction(()=>!document.querySelector('#city-cas-dialog').open,null,{timeout:30000});
 const profile=await page.evaluate(()=>window.fakeSystem?.casProfile);
 assert.equal(profile?.name,'Luiza Reborn');assert.equal(profile?.sex,'female');
 await page.locator('#city-cas-open').click();
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(350);
 const dims=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth}));
 assert.ok(dims.documentWidth<=dims.width+2,JSON.stringify(dims));
 await page.screenshot({path:'artifacts/cas-qa/reborn-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('CAS_REBORN_QA_PASS',JSON.stringify({characters:2,animations:4,persistence:true,display:'animated full hand/finger skeleton',mobile:dims}));
}catch(e){console.error('CAS_REBORN_ERRORS',JSON.stringify(errors));console.error(e.stack||String(e));await page.screenshot({path:'artifacts/cas-qa/reborn-failure.png',fullPage:true}).catch(()=>{});throw e;}
finally{await browser.close();}
