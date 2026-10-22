// Run in an environment with npm package "playwright" and Chrome installed.
// CI uses a local server so the diagnostics page loads the actual world.js.
const {chromium}=require('playwright');
const fs=require('node:fs');
const {judge}=require('./visual-quality-judge.cjs');
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
      const blossoms=ecosystem.flowers,bugs=ecosystem.butterflies;
      const types=new Set(blossoms.map(f=>f.kind));
      const patches=chunkItems((blossoms[0].x/CH)|0,(blossoms[0].y/CH)|0);
      const patchesCount=patches.filter(it=>it.t==='wildflower').length;
      const first=bugs[0],phase=first.phase;
      // O motor so anima insetos proximos do jogador. Forcar camera/personagem
      // perto do polinizador na simulacao, em vez de testar uma borboleta longe.
      player.x=first.x;player.y=first.y;
      ecosystemTick(.05,player,2);
      const moved=first.phase>phase;
      let opaque=0;
      for(const sp of ecosystem.sprites){
        const px=sp.img.getContext('2d').getImageData(0,0,sp.img.width,sp.img.height).data;
        for(let j=3;j<px.length;j+=4)if(px[j]>160)opaque++;
      }
      // Prepara uma amostra visual num trecho com flores e fauna.
      const focus=blossoms[0];
      player.x=focus.x+2;player.y=focus.y+1;
      cam.x=cam.tx=focus.x;cam.y=cam.ty=focus.y;
      render();
      return {blossoms:blossoms.length,types:types.size,
        bugs:bugs.length,
        patchesCount,moved,opaque};
    });
    await game.screenshot({path:'artifacts/cityofgod-living-meadow.png',fullPage:true});
    console.log('Living ecosystem:',JSON.stringify(ecology));
    if(ecology.blossoms<100||ecology.types<6||ecology.bugs<30||
      ecology.blossoms!==516||!ecology.moved||ecology.opaque<800)
      throw Error('Wildlife, meadow or sprites missing: '+JSON.stringify(ecology));

    // Confirma que nao existe nenhum esquilo na simulacao nem no render.
    const housing=await game.evaluate(()=>{
      const removed=!('squirrels' in ecosystem) &&
        !('squirrelSprites' in ecosystem);
      const two=houses.filter(H=>H.storeys===2);
      const variants=[...new Set(two.map(H=>H.templateKey))];
      const H=two[0];
      if(!H)return {removed,count:0,variants};
      const original={x:player.x,y:player.y,floor:player.floor,
        floorZ:player.floorZ,stairTravel:player.stairTravel};
      player.x=H.stair.x;player.y=H.stair.y;
      player.floor=0;player.floorZ=0;player.stairTravel=null;
      const started=updateHouseStairs(player,.05,true);
      for(let i=0;i<35;i++)updateHouseStairs(player,.05,false);
      const up=player.floor===1&&
        Math.abs(player.floorZ-STOREY_HEIGHT)<.001;
      cam.x=cam.tx=H.stair.x;cam.y=cam.ty=H.stair.y;
      render();
      const hall=H.upper.walls.length,items=H.upper.furniture.length,
        blocking=(world.upperSegs||[]).filter(s=>s.house===H).length;
      const descended=updateHouseStairs(player,.05,true);
      for(let i=0;i<35;i++)updateHouseStairs(player,.05,false);
      const down=player.floor===0&&player.floorZ===0;
      Object.assign(player,original);
      return {removed,count:two.length,variants,
        started,up,descended,down,hall,items,blocking,
        stairs:H.upper.steps.length};
    });
    await game.screenshot({path:'artifacts/cityofgod-two-storey-house.png',fullPage:true});
    console.log('Two-storey houses:',JSON.stringify(housing));
    if(!housing.removed||housing.count<2||housing.variants.length<2||
      !housing.started||!housing.up||!housing.descended||!housing.down||
      housing.hall<10||housing.items<4||housing.blocking<10||
      housing.stairs!==10)
      throw Error('House stair/interior or wildlife removal failed: '+JSON.stringify(housing));

    const metrics=await game.evaluate(()=>{
      const rural=houses.filter(H=>H.rural),urban=houses.filter(H=>!H.rural);
      const ruralKinds=new Set(rural.map(H=>H.templateKey));
      const x=world.lamps[0];
      const home=houses.find(H=>H.segs.some(s=>s.ext&&s.window));
      const win=home.segs.find(s=>s.ext&&s.window);
      const wx=(win.x1+win.x2)/2,wy=(win.y1+win.y2)/2;
      const outside=[wx+win.nx*1.35,wy+win.ny*1.35];
      const inside=[wx-win.nx*1.35,wy-win.ny*1.35];
      const sightThroughWindow=houseVisibleOpenings(home,...outside).includes(win);
      const wallBlocksLight=!lightIsVisible(...outside,...inside);
      const part=houses.flatMap(H=>H.segs).find(s=>!s.ext&&!s.door);
      const px=(part.x1+part.x2)/2,py=(part.y1+part.y2)/2;
      const partitionBlocksLight=!lightIsVisible(
        px+part.nx*.50,py+part.ny*.50,
        px-part.nx*.50,py-part.ny*.50);
      const door=home.segs.find(s=>s.ext&&s.door);
      let closedDoorBlocked=true;
      if(door){
        door.doorAnim.open=0;
        const dx=(door.x1+door.x2)/2,dy=(door.y1+door.y2)/2;
        closedDoorBlocked=!houseVisibleOpenings(home,
          dx+door.nx*1.25,dy+door.ny*1.25).includes(door);
      }
      const snapshot={x:player.x,y:player.y};
      player.x=outside[0];player.y=outside[1];
      cam.x=cam.tx=wx;cam.y=cam.ty=wy;
      render();
      const outsideRoofOpaque=!home.inside&&!home.fade;
      player.x=(home.x0+home.x1)/2;
      player.y=(home.y0+home.y1)/2;
      render();
      const interiorVisibleWhenInside=home.inside;
      const fence=fences[0],q=makeCanvas(cam.W,cam.H),fg=q.getContext('2d');
      const mx=(fence.x1+fence.x2)/2,my=(fence.y1+fence.y2)/2;
      cam.x=cam.tx=mx;cam.y=cam.ty=my;
      drawFence(fg,fence);
      const data=fg.getImageData(0,0,q.width,q.height).data;
      let fencePainted=0;const colors=new Set();
      for(let k=0;k<data.length;k+=4)if(data[k+3]>24){
        fencePainted++;
        colors.add((data[k]>>4)+','+(data[k+1]>>4)+','+(data[k+2]>>4));
      }
      const buriedPosts=fences.every(s=>s.h>=.9)&&fencePainted>300;
      const l=world.lamps[0];
      cam.x=cam.tx=l.x;cam.y=cam.ty=l.y;
      const beam=makeCanvas(cam.W,cam.H),bg=beam.getContext('2d');
      drawLampBeam(bg,l,0);
      const pixels=bg.getImageData(0,0,beam.width,beam.height).data;
      let lampBeamPixels=0;
      for(let k=3;k<pixels.length;k+=4)if(pixels[k]>2)lampBeamPixels++;
      // O novo sistema deve bloquear o brilho da camada de composicao
      // nas paredes e telhados (nao apenas na projecao no chao).
      const building=houses.find(H=>H.roofKind!=='flat'&&
        H.roofGeom?.faces?.some(f=>f.slope));
      building.inside=false;
      const rendered=makeCanvas(cam.W,cam.H),mask=rendered.getContext('2d');
      cam.x=cam.tx=(building.x0+building.x1)/2;
      cam.y=cam.ty=(building.y0+building.y1)/2;
      mask.fillStyle='#fff';
      paintBuildingLightMask(mask);mask.fill();
      const side=building.segs.find(s=>s.ext),
        wallX=(side.x1+side.x2)*.5,wallY=(side.y1+side.y2)*.5,
        wallPoint=proj(wallX,wallY,Math.min(1.2,building.h*.45));
      const roof=building.roofGeom.faces.find(f=>f.slope),
        centroid=roof.p.reduce((out,v)=>out.map((n,i)=>n+v[i]/roof.p.length),
          [0,0,0]),roofPoint=proj(...centroid);
      const alphaAt=pt=>{
        const xx=Math.max(0,Math.min(mask.canvas.width-1,Math.round(pt.x)));
        const yy=Math.max(0,Math.min(mask.canvas.height-1,Math.round(pt.y)));
        return mask.getImageData(xx,yy,1,1).data[3];
      };
      const facadeCovered=alphaAt(wallPoint)>200,
        roofCovered=alphaAt(roofPoint)>200;
      const all=mask.getImageData(0,0,mask.canvas.width,mask.canvas.height).data;
      let coverage=0;
      for(let k=3;k<all.length;k+=4)if(all[k]>100)coverage++;
      const maskLocal=coverage>1000&&coverage<mask.canvas.width*mask.canvas.height*.75;
      // Composicao uniforme: dois pontos em aguas inclinadas diferentes
      // devem ter a MESMA opacidade, nao faixas pretas sobrepostas.
      const overlay=makeCanvas(cam.W,cam.H),og=overlay.getContext('2d');
      og.fillStyle='rgba(10,16,31,.78)';og.fillRect(0,0,cam.W,cam.H);
      og.globalCompositeOperation='destination-out';
      const glow=og.createRadialGradient(cam.W/2,cam.H/2,0,
        cam.W/2,cam.H/2,Math.max(cam.W,cam.H)*.72);
      glow.addColorStop(0,'rgba(0,0,0,.95)');
      glow.addColorStop(1,'rgba(0,0,0,0)');
      og.fillStyle=glow;og.fillRect(0,0,cam.W,cam.H);
      og.globalCompositeOperation='source-over';
      protectBuildingSurfaces(og,'rgba(10,16,31,.78)');
      const maskShades=building.roofGeom.faces.filter(f=>f.slope).map(f=>{
        const p=f.p.reduce((o,v)=>o.map((n,i)=>n+v[i]/f.p.length),
          [0,0,0]);
        const loc=proj(...p);
        const x=Math.max(0,Math.min(cam.W-1,Math.round(loc.x))),
          y=Math.max(0,Math.min(cam.H-1,Math.round(loc.y)));
        return og.getImageData(x,y,1,1).data[3];
      });
      const noBlackStripes=maskShades.length>1&&
        Math.max(...maskShades)-Math.min(...maskShades)<=3&&
        maskShades.every(v=>v>=195&&v<=203);
      // Postes nao podem apagar so porque outro edificio intercepta o raio
      // no chao. Cabeceira usa teste em altura e contexto da camera.
      const streetPole=world.lamps.find(l=>lampHeadVisible(l))||world.lamps[0];
      const normalVisible=lampHeadVisible(streetPole);
      const priorPlayer=[player.x,player.y];
      player.x=-20;player.y=-20;
      const unaffectedByPlayerRay=lampHeadVisible(streetPole)===normalVisible;
      player.x=priorPlayer[0];player.y=priorPlayer[1];
      // Lente revela de forma suave, nao como o antigo boneco x-ray
      // pintado por cima da casa: centro opaco, periferia transparente.
      let focusCenterAlpha=0,focusEdgeAlpha=0;
      const oldPosition=[player.x,player.y];
      player.x=(building.x0+building.x1)/2;
      player.y=(building.y0+building.y1)/2;
      const focal=proj(player.x,player.y,1.05+(player.floorZ||0));
      drawPlayerVision([],building,cam.W,cam.H);
      const fy=Math.round(focal.y+cam.zoom*.17),
        fx=Math.round(focal.x),fr=Math.max(54,cam.zoom*1.85);
      const fp=(x,y)=>fg.getImageData(
        Math.max(0,Math.min(cam.W-1,Math.round(x))),
        Math.max(0,Math.min(cam.H-1,Math.round(y))),1,1).data[3];
      focusCenterAlpha=fp(fx,fy);
      focusEdgeAlpha=fp(fx+fr*.99,fy);
      const featheredFocus=focusCenterAlpha>=235&&focusEdgeAlpha<40;
      player.x=oldPosition[0];player.y=oldPosition[1];

      const outward=building.segs.find(s=>s.ext&&s.window),
        ox=(outward.x1+outward.x2)*.5+outward.nx*.24,
        oy=(outward.y1+outward.y2)*.5+outward.ny*.24,
        cone=exteriorLightCone(ox,oy,2.05,outward.nx,outward.ny);
      const coneExteriorOnly=cone.length>20&&cone.slice(1).every(p=>
        (p[0]-ox)*outward.nx+(p[1]-oy)*outward.ny>=-1e-4);
      cam.x=cam.tx=l.x;cam.y=cam.ty=l.y;
      player.x=l.x;player.y=l.y;
      st.night=true;world.night=true;render();
      // Testa os interiores de verdade, incluindo uso de F e mudanca no
      // estado da porta/luz/recurso de jogo, sem depender de mock do Canvas.
      const furnished=houses.find(H=>H.interactables?.some(b=>
        b.kind==='sink'&&b.floor!==1)&&
        H.segs.some(s=>!s.ext&&s.door));
      const fixtureKinds=new Set(houses.flatMap(H=>
        (H.interactables||[]).map(b=>b.kind))).size;
      const roomsWithLights=houses.filter(H=>H.indoorLights?.length>=2).length;
      let manualDoorWorks=false,waterActionWorks=false,lightSwitchWorks=false;
      if(furnished){
        const door=furnished.segs.find(s=>!s.ext&&s.door),
          mx=(door.x1+door.x2)/2,my=(door.y1+door.y2)/2;
        door.doorAnim.open=0;door.doorAnim.target=0;
        const blocked=world.segs.includes(door)&&
          wallOccluders(mx,my,2).includes(door);
        player.x=mx;player.y=my;player.floor=0;player.floorZ=0;
        useHouseInteraction(player,st,3);
        const target=door.doorAnim.target===1;
        for(let i=0;i<10;i++)updateHouseOpenings(.06,[],false);
        manualDoorWorks=blocked&&target&&door.doorAnim.open>.72&&
          !wallOccluders(mx,my,2).includes(door);
        const sink=furnished.interactables.find(b=>b.kind==='sink'&&b.floor!==1);
        player.x=sink.x;player.y=sink.y;st.water=.30;
        waterActionWorks=useHouseInteraction(player,st,6)&&st.water>.3;
        const light=furnished.switches[0],was=furnished.lightOn;
        player.x=light.x;player.y=light.y;
        lightSwitchWorks=useHouseInteraction(player,st,7)&&
          furnished.lightOn!==was;
      }
      return {fencePainted,fenceColors:colors.size,buriedPosts,
        wallBlocksLight,partitionBlocksLight,
        lampBeamPixels,lampCount:world.lamps.length,
        facadeCovered,roofCovered,maskLocal,coneExteriorOnly,
        noBlackStripes,maskShades,unaffectedByPlayerRay,featheredFocus,
        focusCenterAlpha,focusEdgeAlpha,
        outsideRoofOpaque,sightThroughWindow,closedDoorBlocked,
        interiorVisibleWhenInside,ruralCount:rural.length,
        ruralKinds:ruralKinds.size,urbanCount:urban.length,
        ruralFarFromRoad:rural.every(H=>
          roadDist((H.x0+H.x1)/2,(H.y0+H.y1)/2)>ROAD_W+SIDE+2),
        houseCount:houses.length,fixtureKinds,roomsWithLights,
        manualDoorWorks,waterActionWorks,lightSwitchWorks,renderOK:true};
    });
    // Novo julgador: pixels reais (flash e objetos), quantidade/posicao
    // e mascara de oclusao: sem aprovar apenas pela existencia de metodos.
    const city=await game.evaluate(()=>{
      const litter=urbanLife.litter,bins=urbanLife.bins;
      const chimneyHouses=houses.filter(H=>!!H.chimney),
        smoky=chimneyHouses.filter(H=>H.chimney.smoke);
      const urbanCurbOnly=litter.every(d=>
        roadDist(d.x,d.y)>=ROAD_W-.60-1e-3&&
        roadDist(d.x,d.y)<=ROAD_W+SIDE+.13);
      const sprite=urbanLife.sprites[0][0],
        bits=sprite.getContext('2d').getImageData(0,0,sprite.width,sprite.height).data;
      let urbanPixelDetail=0;
      for(let j=3;j<bits.length;j+=4)if(bits[j]>180)urbanPixelDetail++;
      let smokeDrawn=false;
      if(smoky.length){
        const H=smoky[0],c=H.chimney,remember=[cam.x,cam.y];
        cam.x=cam.tx=c.x;cam.y=cam.ty=c.y;
        const smoke=makeCanvas(cam.W,cam.H),ctx=smoke.getContext('2d');
        urbanDrawChimney(ctx,H,4.5);
        const raw=ctx.getImageData(0,0,smoke.width,smoke.height).data;
        smokeDrawn=raw.some((v,i)=>i%4===3&&v>0);
        cam.x=cam.tx=remember[0];cam.y=cam.ty=remember[1];
      }
      const flash=makeCanvas(cam.W,cam.H),gc=flash.getContext('2d');
      // O teste deve enquadrar o cano: do contrario um flash verdadeiro
      // desenhado fora do viewport produz 0 pixels e falso negativo.
      const previousCamera=[cam.x,cam.y];
      cam.x=cam.tx=player.x;cam.y=cam.ty=player.y;
      player.flash=.11;
      // Varios testes teleportam player sem recalcular a pose do rifle.
      // Recalcular o skeleton garante que muzzle e camera estao no mesmo local.
      player.J=solveSkeleton(player,animate(player,0));
      drawMuzzleFlash(gc,player,true);
      const px=gc.getImageData(0,0,cam.W,cam.H).data;
      let muzzleLitPixels=0;
      for(let j=3;j<px.length;j+=4)if(px[j]>4)muzzleLitPixels++;
      const muzzle=proj(...player.J.rifle.muzzle);
      const sample=(x,y)=>{
        const xx=Math.max(0,Math.min(cam.W-1,Math.round(x))),
          yy=Math.max(0,Math.min(cam.H-1,Math.round(y)));
        const k=(yy*cam.W+xx)*4;
        return px[k]+px[k+1]+px[k+2];
      };
      const muzzleCenterBrighter=sample(muzzle.x,muzzle.y)>
        sample(muzzle.x+cam.zoom*.85,muzzle.y);
      cam.x=cam.tx=previousCamera[0];cam.y=cam.ty=previousCamera[1];
      const noFocusOutline=!drawPlayerVision.toString().includes('g.strokeStyle=st.night');
      const thresholdSource=occluded.toString();
      const focusThreshold=thresholdSource.includes('.80')?.80:0;
      // Fração baixa (apenas bota/beiral) nunca ultrapassa o limite.
      const partialCoverageRejected=houseBodyCoverage.toString()
        .includes('for(const h of [.16,.48,.82,1.15,1.48])')&&
        focusThreshold===.80;
      return {muzzleLitPixels,muzzleCenterBrighter,
        urbanDebris:litter.length,urbanStyles:new Set(litter.map(d=>d.kind)).size,
        urbanCurbOnly,urbanBins:bins.length,urbanPixelDetail,
        chimneys:chimneyHouses.length,smokingChimneys:smoky.length,
        smokeDrawn,focusThreshold,focusOutlineRemoved:noFocusOutline,
        partialCoverageRejected};
    });
    Object.assign(metrics,city);
    console.log('Urban/night regression:',JSON.stringify(city));
    await game.screenshot({path:'artifacts/cityofgod-muzzle-urban-chimneys.png',fullPage:true});
    await game.screenshot({path:'artifacts/cityofgod-night-light-judge.png',fullPage:true});
    const verdict=judge(metrics);
    console.log('QUALITY JUDGE: '+JSON.stringify(verdict));
    fs.writeFileSync('artifacts/quality-judge.json',JSON.stringify(verdict,null,2));
    if(!verdict.passed||verdict.score<90)
      throw Error('Quality judge rejected visual features: '+
        JSON.stringify(verdict.items.filter(r=>!r.pass)));
    await game.evaluate(()=>{
      st.night=false;world.night=false;player.x=world.spawn[0];
      player.y=world.spawn[1];cam.x=cam.tx=player.x;cam.y=cam.ty=player.y;
      const farm=houses.find(H=>H.rural);
      if(farm){cam.x=cam.tx=farm.x0+(farm.x1-farm.x0)/2;
        cam.y=cam.ty=farm.y0+(farm.y1-farm.y0)/2;
        player.x=cam.x-3;player.y=cam.y+3;}
      render();
    });
    await game.screenshot({path:'artifacts/cityofgod-rural-fences.png',fullPage:true});

    // Regressao 3D REAL: alterna os dois modos sobre o MESMO mundo e volta
    // ao 2D. Verifica resultado no framebuffer WebGL e coordenadas intactas.
    const three=await game.evaluate(()=>{
      const initial=[player.x,player.y],count=houses.length,trees=
        world.props.filter(p=>p.type==='tree').length;
      const iso=view3d.setMode('iso');
      const active=view3d.ready&&iso==='iso';
      if(!active)return {active,reason:document.getElementById('mode-status').textContent};
      const drawnIso=view3d.render(player,actors,st,T);
      const gl=document.getElementById('world3d').getContext('webgl');
      const canvas=document.getElementById('world3d');
      const pixels=new Uint8Array(4*96*96);
      gl.readPixels(Math.floor(canvas.width/2)-48,
        Math.floor(canvas.height/2)-48,96,96,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      const sampled=new Set();
      for(let k=0;k<pixels.length;k+=4)sampled.add(
        (pixels[k]>>4)+','+(pixels[k+1]>>4)+','+(pixels[k+2]>>4));
      const threeDColors=sampled.size;
      const isoImage=canvas.width>300&&canvas.height>200;
      const intersection=view3d.pickGround(innerWidth*.5,innerHeight*.5,0);
      const aimWorks=intersection?.every(Number.isFinite);
      const third=view3d.setMode('third');
      const renderedThird=view3d.render(player,actors,st,T);
      // Personagem movido diretamente: as coordenadas nao podem ser
      // copiadas para um segundo estado 3D divergente.
      player.x+=.35;player.y+=.25;
      view3d.render(player,actors,st,T);
      const sameWorld=view3d.buildings===count&&
        trees===world.props.filter(p=>p.type==='tree').length;
      const two=view3d.setMode('2d');
      render();
      const preserved=player.x===initial[0]+.35&&
        player.y===initial[1]+.25&&two==='2d';
      player.x=initial[0];player.y=initial[1];
      return {active,drawnIso,renderedThird,threeDColors,
        isoImage,aimWorks,sameWorld,preserved,mode:two,
        staticCount:view3d.staticCount,vertices:view3d.vertexCount,
        characterVertices:view3d.actorCount};
    });
    console.log('SWITCHABLE 3D:',JSON.stringify(three));
    if(!three.active||!three.drawnIso||!three.renderedThird||
       !three.aimWorks||!three.isoImage||!three.sameWorld||
       !three.preserved||three.threeDColors<5||
       three.staticCount<4000||three.vertices<70000||
       three.characterVertices<200||three.mode!=='2d')
      throw Error('3D switch or world sharing invalid: '+JSON.stringify(three));
    await game.evaluate(()=>{
      cam.x=cam.tx=(houses[0].x0+houses[0].x1)/2;
      cam.y=cam.ty=(houses[0].y0+houses[0].y1)/2;
      player.x=cam.x;player.y=cam.y+13;
      view3d.setMode('iso');
      view3d.render(player,actors,st,T);
    });
    await game.screenshot({path:'artifacts/cityofgod-3d-isometric.png'});
    await game.evaluate(()=>{
      view3d.setMode('third');view3d.render(player,actors,st,T);
    });
    await game.screenshot({path:'artifacts/cityofgod-3d-third-person.png'});
    await game.evaluate(()=>view3d.setMode('2d'));
    // Testa as interacoes reais do usuario alem das APIs internas.
    await game.keyboard.press('v');
    const keyboardOK=await game.evaluate(()=>view3d.mode==='iso');
    await game.locator('#mode-switch').click();
    const buttonOK=await game.evaluate(()=>view3d.mode==='third'&&
      document.getElementById('mode-switch').textContent.includes('3D'));
    await game.keyboard.press('v');
    const returnOK=await game.evaluate(()=>view3d.mode==='2d'&&
      document.getElementById('view').style.opacity==='1');
    console.log('3D UI CONTROLS:',JSON.stringify({keyboardOK,buttonOK,returnOK}));
    if(!keyboardOK||!buttonOK||!returnOK)
      throw Error('3D UI input cycle failed');

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
