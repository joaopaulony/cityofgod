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
    if(!summary.includes('9/9'))throw Error('Canopy pixel-coverage test failed: '+summary);
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
      // O novo mapa deve ter QUATRO vezes a área, sem exceder dimensões
      // problemáticas (>4096px) de Canvas 2D em muitos dispositivos móveis.
      // O chão detalhado é pintado em blocos (terrain.js); world.ground é a
      // visão geral do mapa inteiro em world.groundPPM px/m.
      const ground=world.ground;
      const worldState={
        map:MAP,area:MAP*MAP,expectedArea:80*80*4,
        groundPixels:[ground.width,ground.height],
        groundScale:world.groundPPM,chunkPixels:CSZ,chunksPerSide:MAP/CH,shadowPixels:world.groundCtx.canvas.width,houses:houses.length,cars:boxes.filter(b=>b.kind==='car').length,
        roads:world.roads.length,roadFields:world.roadD.length
      };
      // A nova borda precisa ser alcançável e o clamp de colisão deve
      // parar corretamente fora do mapa ampliado.
      const edge=collide(MAP-0.65,MAP-0.65,0.25);
      const beyond=collide(MAP+10,MAP+10,0.25);
      worldState.edge=edge;worldState.clamped=beyond;
      return {trees:trees.length,visibleAmongFirstSeven:good,
        clusterCount:focus.n,focus:{x:focus.t.x,y:focus.t.y},
        canvasWidth:document.querySelector('#view').width,...worldState};
    });
    await game.screenshot({path:'artifacts/cityofgod-game-smoke.png',fullPage:true});
    // Flora/fauna no jogo integrado, nao apenas num sprite isolado.
    const ecology=await game.evaluate(()=>{
      const blossoms=ecosystem.flowers,bugs=ecosystem.butterflies,
        squirrels=ecosystem.squirrels;
      const types=new Set(blossoms.map(f=>f.kind));
      const patches=chunkItems((blossoms[0].x/CH)|0,(blossoms[0].y/CH)|0);
      const patchesCount=patches.filter(it=>it.t==='wildflower').length;
      const first=bugs[0],phase=first.phase;
      ecosystemTick(.05,player,2);
      const moved=first.phase>phase;
      let opaque=0;
      for(const sp of ecosystem.sprites){
        const px=sp.img.getContext('2d').getImageData(0,0,sp.img.width,sp.img.height).data;
        for(let j=3;j<px.length;j+=4)if(px[j]>160)opaque++;
      }
      // Prepara uma amostra visual num trecho com flores e fauna.
      const focus=squirrels[0]||blossoms[0];
      player.x=focus.x+2;player.y=focus.y+1;
      cam.x=cam.tx=focus.x;cam.y=cam.ty=focus.y;
      render();
      return {blossoms:blossoms.length,types:types.size,
        bugs:bugs.length,squirrels:squirrels.length,
        patchesCount,moved,opaque};
    });
    await game.screenshot({path:'artifacts/cityofgod-living-meadow.png',fullPage:true});
    console.log('Living ecosystem:',JSON.stringify(ecology));
    if(ecology.blossoms<100||ecology.types<6||ecology.bugs<30||
      ecology.squirrels<8||!ecology.moved||ecology.opaque<800)
      throw Error('Wildlife, meadow or sprites missing: '+JSON.stringify(ecology));

    // Testa também o render padrão, além do modo performance. Canvas maior
    // deve continuar abaixo de 4096px e conter pixels realmente pintados.
    const normal=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
    const normalErrors=[];
    normal.on('pageerror',e=>normalErrors.push(e.message));
    await normal.goto('http://127.0.0.1:8765/index.html?seed=3250',
      {waitUntil:'domcontentloaded',timeout:120000});
    await normal.waitForFunction(()=>typeof world!=='undefined' &&
      world.ground && world.props.some(p=>p.type==='tree'),
      null,{timeout:120000});
    const normalStats=await normal.evaluate(()=>{
      const c=world.ground,g=c.getContext('2d',{willReadFrequently:true});
      const data=g.getImageData(Math.floor(c.width*.49),Math.floor(c.height*.49),8,8).data;
      let painted=0;
      for(let i=3;i<data.length;i+=4)if(data[i]>0)painted++;
      return {map:MAP,width:c.width,height:c.height,ppm:world.groundPPM,shadowPpm:PPM,shadowWidth:world.groundCtx.canvas.width,chunkPixels:CSZ,painted};
    });
    console.log('Normal quality:',JSON.stringify(normalStats));
    await normal.screenshot({path:'artifacts/cityofgod-map-normal.png',fullPage:true});
    if(normalErrors.length || normalStats.map!==160 || normalStats.shadowPpm!==24 ||
       normalStats.shadowWidth!==3840 || normalStats.width!==160*normalStats.ppm ||
       normalStats.height!==160*normalStats.ppm || normalStats.chunkPixels>4096 ||
       normalStats.painted<32)
      throw Error('Normal quality large-map failed: '+JSON.stringify({normalErrors,normalStats}));
    console.log('Game smoke:',JSON.stringify(live));
    if(gameErrors.length)throw Error('Game JavaScript errors: '+gameErrors.join('; '));
    if(live.trees<3||live.visibleAmongFirstSeven<Math.min(3,live.trees)||live.clusterCount<3)
      throw Error('Trees remain invisible in real game runtime: '+JSON.stringify(live));
    if(live.map!==160 || live.area!==live.expectedArea || live.groundPixels[0]!==160*live.groundScale ||
       live.groundPixels[0]>4096 || live.groundPixels[1]>4096 ||
       live.chunkPixels>4096 || !Number.isInteger(live.chunksPerSide) || live.shadowPixels>4096 ||
       live.houses<12 || live.cars<6 || live.roads<2 || live.roadFields!==160*160*4 ||
       live.clamped.some(v=>v>159.5))
      throw Error('Expanded map geometry or content invalid: '+JSON.stringify(live));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
