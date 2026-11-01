const {chromium}=require('playwright');
const sharp=require('sharp');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1100,height:820}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:4322/tools/domestic-review.html');
 try{await page.waitForFunction(()=>window.reviewReady,{timeout:30000});}catch(e){console.log(errors);throw e;}
 fs.mkdirSync('artifacts/domestic-review',{recursive:true});
 for(const kind of ['sit','sleep','drink','cook','fridge'])for(const angle of ['front','side']){
  await page.evaluate(({kind,angle})=>window.reviewPose(kind,1.7,angle),{kind,angle});
  await page.screenshot({path:`artifacts/domestic-review/${kind}-${angle}.png`});
 }
 await page.evaluate(()=>window.reviewPose('fridge',.8,'front'));
 await page.screenshot({path:'artifacts/domestic-review/fridge-grip.png'});
 console.log(JSON.stringify({errors,screenshots:11}));await browser.close();
 const shots=['sit-side','sleep-front','drink-side','cook-side','fridge-grip','fridge-front'];
 const cells=await Promise.all(shots.map(async(name,i)=>({input:await sharp(`artifacts/domestic-review/${name}.png`).resize(660,492).toBuffer(),left:(i%2)*660,top:Math.floor(i/2)*492})));
 await sharp({create:{width:1320,height:1476,channels:3,background:'#e9edf0'}}).composite(cells).png().toFile('artifacts/domestic-review/poses-revisadas.png');
})().catch(e=>{console.error(e);process.exitCode=1});
