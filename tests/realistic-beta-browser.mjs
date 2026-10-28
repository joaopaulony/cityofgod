import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1360,height:800},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push('JS: '+e.message));
try{
 await mkdir('artifacts/cas-qa',{recursive:true});
 await page.goto('http://127.0.0.1:4322/?humansbeta=1',{waitUntil:'domcontentloaded',timeout:30000});
 // The real city boots ONLY when "Novo jogo" is selected on the title screen.
 await page.locator('[data-front-action="new"]').click({timeout:30000});
 await page.waitForFunction(()=>window.cityCharacters?.status&&window.cityCharacters.status!=='loading',null,{timeout:60000});
 const initial=await page.evaluate(()=>({front:document.querySelector('#city-front')?.innerText?.slice(0,240),characters:window.cityCharacters?.status,errors:window.cityCharacters?.errors}));
 console.log('CITY_BOOT',JSON.stringify(initial));
 const system=await page.evaluate(()=>({ready:window.cityCharacters.ready,status:window.cityCharacters.status,models:window.cityCharacters.models,humanModelsEnabled:window.cityCharacters.humanModelsEnabled,quality:window.cityCharacters.realisticQuality,populationCount:window.cityCharacters.populationCount,errors:window.cityCharacters.errors,warnings:window.cityCharacters.casWarnings}));
 console.log('REALISTIC_RUNTIME',JSON.stringify(system));
 assert.equal(system.humanModelsEnabled,true,'Approved human GLBs were not mounted: '+JSON.stringify(system));
 assert.equal(system.ready,true);
 assert.equal(system.populationCount>0,true,'Population missing');
 assert.ok(system.quality?.male?.triangles<=12000&&system.quality?.female?.triangles<=12000);
 for(const sex of ['male','female'])assert.ok(system.quality[sex].hands.left>=10&&system.quality[sex].hands.right>=10);
 await page.waitForFunction(()=>document.body.classList.contains('front-open')===false,null,{timeout:60000});
 await page.evaluate(()=>window.cityCharacters.openCreator());
 await page.locator('#city-cas-dialog[open]').waitFor({timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#cas-preview-source')?.textContent.includes('GLB REALISTA'),null,{timeout:90000});
 await page.screenshot({path:'artifacts/cas-qa/realistic-male-actual-game.png'});
 await page.locator('[data-cas-tab=animations]').click();
 for(const action of ['idle','walk','run','jump_air']){
  await page.locator('select[name=previewAction]').selectOption(action);
  await page.waitForTimeout(230);
 }
 await page.locator('[data-cas-tab=body]').click();
 await page.locator('input[name=sex][value=female]').check();
 await page.waitForFunction(()=>document.querySelector('#cas-preview-source')?.textContent.includes('GLB REALISTA'),null,{timeout:90000});
 await page.screenshot({path:'artifacts/cas-qa/realistic-female-actual-game.png'});
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(350);
 await page.screenshot({path:'artifacts/cas-qa/realistic-mobile-actual-game.png',fullPage:true});
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('REALISTIC_CAS_QA_PASS',JSON.stringify({characters:2,npcs:system.populationCount,animations:['idle','walk','run','jump_air'],fingers:true,triangles:system.quality,errors}));
}catch(e){
 console.error('REALISTIC_CAS_QA_ERRORS',JSON.stringify(errors));
 console.error(e.stack||String(e));
 await page.screenshot({path:'artifacts/cas-qa/realistic-failure.png',fullPage:true}).catch(()=>{});
 throw e;
}finally{await browser.close();}
