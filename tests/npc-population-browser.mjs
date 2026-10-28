import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1360,height:780},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,600))});
try{
 await mkdir('artifacts/cas-qa',{recursive:true});
 await page.goto('http://127.0.0.1:4322/tests/npc-population-browser.html',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.__populationReady===true,null,{timeout:65000});
 const report=await page.evaluate(()=>({report:window.__populationReport,error:window.__populationError}));
 console.log('NPC_POPULATION',JSON.stringify(report));
 assert.equal(report.error,undefined);
 assert.equal(report.report.residentCount,8);
 assert.deepEqual([...report.report.models].sort(),['female','male']);
 assert.equal(report.report.colors.length,8);
 assert.equal(report.report.meshMasks,8,'eight skinned meshes with different palette attributes');
 assert.equal(report.report.materials,8);
 await page.waitForTimeout(600);
 await page.screenshot({path:'artifacts/cas-qa/npc-population-reborn.png'});
 assert.deepEqual(errors,[]);
 console.log('NPC_POPULATION_QA_PASS',JSON.stringify({residents:8,colorPairs:8,styles:8,errors:0}));
}catch(e){console.error('NPC_POPULATION_ERRORS',errors);await page.screenshot({path:'artifacts/cas-qa/npc-population-failure.png'}).catch(()=>{});throw e;}
finally{await browser.close();}
