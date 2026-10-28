import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--disable-dev-shm-usage',
 '--disable-background-timer-throttling']});
await mkdir('artifacts/cas-qa',{recursive:true});
async function visit(beta){
 const page=await browser.newPage({viewport:{width:1300,height:800},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push('JS: '+e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/WEBGL_debug_renderer_info/.test(m.text()))errors.push('Console: '+m.text().slice(0,220));});
 try{
  const url='http://127.0.0.1:4322/'+(beta?'?streetcrown=1':'');
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('[data-front-action="new"]').click({timeout:35000});
  // The full city takes longer to create than the isolated CAS gallery.
  await page.waitForFunction(()=>['ready','partial','disabled'].includes(window.cityCharacters?.status),null,{timeout:115000});
  const status=await page.evaluate(()=>({
   status:window.cityCharacters?.status,enabled:window.cityCharacters?.streetCrownEnabled,
   provider:window.cityCharacters?.provider,models:window.cityCharacters?.models,
   errors:window.cityCharacters?.errors,casWarnings:window.cityCharacters?.casWarnings,
   character:window.cityCharacters?.telemetry?.()[0],
   front:document.body.classList.contains('front-open'),
   canvas:!!document.querySelector('canvas')
  }));
  console.log('STREET_CROWN_WORLD_'+(beta?'BETA':'DEFAULT'),JSON.stringify(status));
  assert.equal(status.status,'ready',JSON.stringify(status.errors||status.casWarnings||[]));
  if(beta){
   assert.equal(status.enabled,true);
   assert.equal(status.models?.length,6);
   assert.ok(status.models.every(m=>m.triangles>0&&m.triangles<4500));
   assert.equal(status.character?.visible,true);
   assert.ok(status.character?.bones>=76);
   assert.equal(status.provider,'street-crown-reborn-beta');
   // Change the playable character mesh and verify it actually mounts in scene.
   const change=await page.evaluate(async()=>{
    const s=window.cityCharacters;
    await s.applyCAS({sex:'female',name:'Verificação da malha'});
    const changed=s.setStreetModel('ped_woman');
    s.update(1/30);
    return {changed,id:s.streetModelId,sex:s.casProfile.sex,
     actor:s.telemetry()?.[0],models:s.models.length};
   });
   console.log('STREET_CROWN_WORLD_SWAP',JSON.stringify(change));
   assert.ok(change.changed&&change.id==='ped_woman'&&change.sex==='female');
   assert.equal(change.actor.visible,true);
   await page.screenshot({path:'artifacts/cas-qa/street-world-beta.png'});
  }else{
   assert.equal(status.enabled,false,'Normal production game must preserve the 2026-10-28 human reset');
   assert.ok(status.models.every(m=>m.meshes===0));
   assert.equal(status.character?.visible,false);
  }
  assert.deepEqual(errors,[],JSON.stringify(errors));
  console.log('STREET_CROWN_WORLD_'+(beta?'BETA':'DEFAULT')+'_PASS');
 }catch(e){
  console.error('STREET_CROWN_WORLD_ERRORS',JSON.stringify(errors));
  console.error(e.stack||String(e));
  await page.screenshot({path:'artifacts/cas-qa/street-world-'+(beta?'beta':'default')+'-error.png'}).catch(()=>{});
  throw e;
 }finally{await page.close();}
}
try{
 await visit(true);
 await visit(false);
}finally{await browser.close();}
