// Run in an environment with npm package "playwright" and Chrome installed.
// CI uses a local server so the diagnostics page loads the actual world.js.
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8765/tests/vegetation-visual.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#state')?.textContent?.startsWith('Resultado:'),{timeout:120000});
    const summary=await page.locator('#state').innerText();
    const samples=await page.locator('#items article p').allInnerTexts();
    fs.mkdirSync('artifacts',{recursive:true});
    await page.screenshot({path:'artifacts/vegetation-raster.png',fullPage:true});
    console.log(summary);
    console.log(samples.join('\n'));
    if(errors.length)throw Error('Browser JavaScript errors: '+errors.join('; '));
    if(!summary.includes('6/6'))throw Error('Canopy pixel-coverage test failed: '+summary);
    // Confere o jogo de verdade, não apenas sprites isolados:
    const game=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
    const gameErrors=[];
    game.on('pageerror',e=>gameErrors.push(e.message));
    await game.goto('http://127.0.0.1:8765/index.html?seed=3250&quality=performance',
      {waitUntil:'domcontentloaded',timeout:120000});
    await game.waitForFunction(()=>typeof world!=='undefined' &&
      world.props.some(p=>p.type==='tree') && document.querySelector('#view')?.width>0,
      {timeout:120000});
    await game.waitForTimeout(1400);
    const live=await game.evaluate(()=>{
      const trees=world.props.filter(p=>p.type==='tree');
      let good=0;
      for(const p of trees.slice(0,7)){
        const sp=p.sp,c=sp.crown,g=c.getContext('2d');
        const px=g.getImageData(0,0,c.width,c.height).data;
        let n=0;for(let i=3;i<px.length;i+=4)if(px[i]>24)n++;
        if(n/(c.width*c.height)>.03)good++;
      }
      // Sem aproximar a câmera das árvores, a screenshot anterior fotografava
      // a área de spawn praticamente vazia, apesar de passar no teste.
      const choices=trees.filter(t=>t.x>7&&t.x<MAP-7&&t.y>7&&t.y<MAP-7);
      const ranked=choices.map(t=>({t,n:trees.reduce((v,q)=>
        v+(Math.hypot(q.x-t.x,q.y-t.y)<8?1:0),0)}));
      ranked.sort((a,b)=>b.n-a.n);
      const focus=(ranked[0]||{t:trees[0],n:1});
      window.__manual=true;
      player.x=focus.t.x+3.5;player.y=focus.t.y+1.5;
      cam.x=cam.tx=focus.t.x;cam.y=cam.ty=focus.t.y;
      render();
      return {trees:trees.length,visibleAmongFirstSeven:good,
        clusterCount:focus.n,focus:{x:focus.t.x,y:focus.t.y},
        canvasWidth:document.querySelector('#view').width};
    });
    await game.screenshot({path:'artifacts/cityofgod-game-smoke.png',fullPage:true});
    console.log('Game smoke:',JSON.stringify(live));
    if(gameErrors.length)throw Error('Game JavaScript errors: '+gameErrors.join('; '));
    if(live.trees<3||live.visibleAmongFirstSeven<Math.min(3,live.trees)||live.clusterCount<3)
      throw Error('Trees remain invisible in real game runtime: '+JSON.stringify(live));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
