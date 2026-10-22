'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({
  channel:'chrome',headless:true,
  args:['--no-sandbox','--enable-webgl','--use-gl=angle',
   '--use-angle=swiftshader','--enable-unsafe-swiftshader']
 });
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[],notices=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('console',msg=>{
   if(msg.type()==='warning'||msg.type()==='error')
    notices.push(msg.text());
  });
  await page.goto('http://127.0.0.1:8765/index.html?quality=performance&seed=3250&nativeDebug=1',
   {waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>{
   const sys=window.vehicleNative3D;
   return sys&&sys.states.size===5&&
    Array.from(sys.states.values()).every(x=>x==='ready'||x==='fallback');
  },null,{timeout:120000});
  const status=await page.evaluate(()=>{
   const sys=window.vehicleNative3D;
   return {
    statuses:[...sys.states],
    geometry:[...sys.geometryInfo],
    models:sys.loadedModels.slice(),
    proceduralCars:vehicleSystem.cars.length,
    nativeCars:vehicleSystem.cars.filter(x=>
     !!vehicleHybrid.atlases.get(x.model)?.nativeGLB).length
   };
  });
  console.log('Native GLB status:',JSON.stringify(status));
  fs.mkdirSync('artifacts',{recursive:true});
  const image=await page.evaluate(()=>{
   const SIZE=384,keys=window.vehicleNative3D.models.map(x=>x.id),
    gallery=document.createElement('canvas');
   gallery.width=SIZE*4;gallery.height=SIZE*keys.length;
   const ctx=gallery.getContext('2d');
   ctx.fillStyle='#67696b';ctx.fillRect(0,0,gallery.width,gallery.height);
   for(let i=0;i<keys.length;i++){
    const atlas=vehicleHybrid.atlases.get(keys[i]);
    if(!atlas?.nativeGLB)continue;
    for(let j=0;j<4;j++){
     const frame=j*4+2,x=(frame%4)*SIZE,y=Math.floor(frame/4)*SIZE;
     ctx.drawImage(atlas.images.body,x,y,SIZE,SIZE,j*SIZE,i*SIZE,SIZE,SIZE);
    }
   }
   return gallery.toDataURL('image/png').split(',')[1];
  });
  const candidatePng=await page.evaluate(()=>{
   const c=window.vehicleNative3D.opalaVariantGallery;
   return c?.toDataURL('image/png').split(',')[1];
  });
  if(!candidatePng)throw Error('Missing Opala variation comparison');
  fs.writeFileSync('artifacts/native-glb-opala-five-variants.png',
   Buffer.from(candidatePng,'base64'));
  fs.writeFileSync('artifacts/native-glb-cars-5-models-4-angles.png',
   Buffer.from(image,'base64'));
  await page.screenshot({path:'artifacts/native-glb-cityofgod-game.png'});
  if(errors.length||status.models.length!==5||status.nativeCars<5){
   throw Error('Native GLB browser render failed: '+JSON.stringify({
    errors,notices,status
   }));
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

// The latest native build must be reviewed with this gallery before release.
