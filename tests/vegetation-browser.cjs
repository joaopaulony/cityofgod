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

    // Regressao dos esquilos: tamanho ~10x menor, animacoes em pixel art
    // realmente diferentes, corrida de fuga e subida progressiva no tronco.
    const squirrelCheck=await game.evaluate(()=>{
      const spriteSet=ecosystem.squirrelSprites;
      const a=spriteSet[0].idle[1].img,b=spriteSet[0].idle[4].img;
      const aa=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
      const bb=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
      let changed=0,solid=0;
      for(let i=0;i<aa.length;i+=4){
        if(aa[i]!==bb[i]||aa[i+1]!==bb[i+1]||
          aa[i+2]!==bb[i+2]||aa[i+3]!==bb[i+3])changed++;
        if(aa[i+3]>180)solid++;
      }
      const pxWidth=ecosystem.squirrelSprites[0].idle[0].img.width*
        cam.zoom/SQUIRREL_SCALE_DIVISOR;
      const oldWidth=37*cam.zoom/40;
      const nearTrees=world.props.filter(p=>p.type==='tree'&&
        Math.hypot(p.x-world.spawn[0],p.y-world.spawn[1])<24).length;
      const nearSpawn=ecosystem.squirrels.filter(s=>
        Math.hypot(s.homeX-world.spawn[0],s.homeY-world.spawn[1])<24).length;
      // Procura area livre de pelo menos 2m para corrida previsivel.
      let running=null;
      for(const s of ecosystem.squirrels){
        for(const direction of [0,Math.PI/2,Math.PI,-Math.PI/2]){
          const dx=Math.cos(direction),dy=Math.sin(direction);
          if([.4,.8,1.2,1.8,2.4].every(d=>ecoFree(s.x+dx*d,s.y+dy*d))){
            running={s,dx,dy};break;
          }
        }
        if(running)break;
      }
      let sprint=0;
      if(running){
        const {s,dx,dy}=running,startX=s.x,startY=s.y;
        s.mode='flee';s.timer=2;s.panic=2;s.move=1;s.z=.035;
        s.goalX=s.x+dx*2.4;s.goalY=s.y+dy*2.4;
        player.x=s.x-dx*10;player.y=s.y-dy*10;
        ecosystemTick(.2,player,12);
        sprint=Math.hypot(s.x-startX,s.y-startY);
      }
      const climbing=ecosystem.squirrels[1];
      climbing.mode='climb';climbing.z=.03;
      climbing.goalZ=climbing.tree.sp.trunkH+.55;
      climbing.x=climbing.tree.x;climbing.y=climbing.tree.y;
      const z0=climbing.z;
      player.x=climbing.x+20;player.y=climbing.y+20;
      ecosystemTick(.22,player,13);
      const rise=climbing.z-z0;
      // Galeria automatizada: repouso, respiracao, corrida e escalada.
      const gallery=document.createElement('canvas'),ctx=gallery.getContext('2d');
      gallery.width=600;gallery.height=180;gallery.id='squirrel-pixel-gallery';
      gallery.style.cssText='position:fixed;top:0;left:0;z-index:99999;background:#718059';
      const poses=['idle','run','climb'];
      for(let kind=0;kind<3;kind++)
        for(let pose=0;pose<3;pose++){
          const sp=spriteSet[kind][poses[pose]][pose===0?1:3];
          ctx.imageSmoothingEnabled=false;
          ctx.drawImage(sp.img,kind*200+pose*65+5,24,sp.img.width*3,sp.img.height*3);
        }
      document.body.append(gallery);
      return {kinds:spriteSet.length,frames:spriteSet[0].idle.length,
        changePixels:changed,opaque:solid,pxWidth,oldWidth,
        sizeRatio:oldWidth/pxWidth,nearTrees,nearSpawn,
        totalSquirrels:ecosystem.squirrels.length,sprint,rise};
    });
    await game.screenshot({path:'artifacts/squirrel-pixel-gallery.png',fullPage:true});
    console.log('Tiny animated squirrels:',JSON.stringify(squirrelCheck));
    if(squirrelCheck.kinds!==3||squirrelCheck.frames!==6||
       squirrelCheck.opaque<50||squirrelCheck.changePixels<12||
       squirrelCheck.sizeRatio<4.5||squirrelCheck.sizeRatio>7.5||
       squirrelCheck.totalSquirrels<50||
       (squirrelCheck.nearTrees>=3&&squirrelCheck.nearSpawn<2)||
       squirrelCheck.sprint<.75||
       squirrelCheck.rise<.3)
      throw Error('Small animated squirrel regression: '+JSON.stringify(squirrelCheck));
    await game.evaluate(()=>{
      document.querySelector('#squirrel-pixel-gallery')?.remove();
      const s=ecosystem.squirrels[0];
      window.__manual=true;
      player.x=s.x+8;player.y=s.y+8;
      cam.x=cam.tx=s.x;cam.y=cam.ty=s.y;
      render();
    });
    await game.screenshot({path:'artifacts/squirrel-visible-in-world.png',fullPage:true});

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
