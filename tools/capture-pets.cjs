const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1320,height:950}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 fs.mkdirSync('artifacts/pets',{recursive:true});
 await page.goto('http://127.0.0.1:4322/tools/pets-review.html');await page.waitForFunction(()=>window.petReviewReady);
 await page.screenshot({path:'artifacts/pets/seis-companheiros.png',fullPage:true});
 await page.evaluate(()=>window.reviewPets('walk',.6,1));await page.screenshot({path:'artifacts/pets/caminhada-outras-cores.png',fullPage:true});
 await page.evaluate(()=>window.reviewPets('sit',1.2,2));await page.screenshot({path:'artifacts/pets/sentados-outras-cores.png',fullPage:true});
 console.log(JSON.stringify({errors}));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
