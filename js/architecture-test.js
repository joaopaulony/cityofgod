// Review controls operate on real streamed properties; no separate demo scene.
'use strict';
if(new URLSearchParams(location.search).get('architectureTest')==='1'){
 const ui=document.createElement('aside');ui.style.cssText='position:fixed;left:14px;top:14px;z-index:80;width:290px;padding:14px;background:#162b30ee;color:#f2ebdc;border-radius:10px;font:13px system-ui';
 ui.innerHTML='<b>Revisão dos imóveis · mapa principal</b><div style="margin-top:8px"><label>Tipo de imóvel <select id="property-type"></select></label></div><div id="property-actions"></div><pre id="property-report" style="white-space:pre-wrap"></pre>';document.body.append(ui);
 const type=ui.querySelector('select'),report=ui.querySelector('pre'),actions=ui.querySelector('#property-actions');
 const labels={house:'Casa',bungalow:'Bangalô',poor:'Casa popular',mansion:'Mansão',rural:'Casa rural',shop:'Loja',office:'Escritórios',condo:'Condomínio',deco:'Hotel art déco',projects:'Habitação coletiva',warehouse:'Galpão',airport:'Aeroporto'};
 for(const [value,text] of Object.entries(labels)){const o=document.createElement('option');o.value=value;o.textContent=text;type.append(o);}
 let selected=null,index=0,message='',fps=0,frames=0,last=performance.now();
 function measureFrames(now){frames++;if(now-last>1500){fps=frames*1000/(now-last);frames=0;last=now;}requestAnimationFrame(measureFrames);}requestAnimationFrame(measureFrames);
 const button=(name,fn)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='margin:7px 5px 0 0;padding:5px 7px';b.onclick=async()=>{try{await fn();}catch(e){message=String(e);}};actions.append(b);};
 function reset(){Object.assign(player,{jump:null,traversal:null,actionZ:0,stairTravel:null,floor:0,floorZ:0,crouching:false});input.keys.clear();}
 function target(H,inside=false){reset();selected=H;const A=H.architecture,p=inside?A.toWorld(...A.levels[0].entry.map((v,i)=>v-(i===1?.8:0))):H.front;player.x=p[0];player.y=p[1];player.face=Math.atan2(-H.doorN[1],-H.doorN[0]);cam.tang=cam.ang=Math.atan2(H.doorN[0],H.doorN[1])-.55;cam.cos=Math.cos(cam.ang);cam.sin=Math.sin(cam.ang);
  window.cityPropertyReviewFocus=inside?null:{x:(H.x0+H.x1)/2-Math.sin(cam.ang)*H.h*.65,y:(H.y0+H.y1)/2-Math.cos(cam.ang)*H.h*.65};
  cam.x=cam.tx=window.cityPropertyReviewFocus?.x??player.x;cam.y=cam.ty=window.cityPropertyReviewFocus?.y??player.y;
  cam.tzoom=cam.zoom=inside?Math.min(68,(cam.W-320)/(A.width+5),(cam.H-80)/(A.depth*.55+7)):Math.min(58,(cam.W-360)/(Math.hypot(A.width,A.depth)+6),(cam.H-110)/(H.h*.9+A.depth*.6+6));message='';}
 addEventListener('keydown',e=>{if(['w','a','s','d'].includes(e.key.toLowerCase()))window.cityPropertyReviewFocus=null;});
 const select=()=>{const list=houses.filter(H=>H.architecture?.kind===type.value);if(!list.length){message='Não há este tipo carregado. Use Buscar no mapa.';return;}target(list[index++%list.length]);};
 button('Próximo imóvel',select);
 button('Buscar no mapa',async()=>{
  if(!world.open){select();return;}
  const wanted=type.value,zone={mansion:'mansion',office:'brickell',condo:'brickell',deco:'southbeach',projects:'projects',warehouse:'works',poor:'poor',bungalow:'bungalow',shop:'town',house:'town',rural:null,airport:'airport'}[wanted],candidates=[];
  if(wanted==='airport'){const a=OW.geo.anchors.airports[0];candidates.push([a.x,a.y+a.width/2+a.apron-12]);}
  else for(let y=250;y<OW.geo.H-200;y+=160)for(let x=200;x<OW.geo.W-200;x+=160){const d=OW.geo.districtAt(x,y);if(wanted==='rural'?[D_.FARM,D_.RURAL].includes(d):miaZone(x,y,d)===zone)candidates.push([x,y]);}
  candidates.sort((a,b)=>Math.hypot(a[0]-player.x,a[1]-player.y)-Math.hypot(b[0]-player.x,b[1]-player.y));
  message='Carregando setor real…';
  for(const [x,y] of candidates.slice(0,10)){owTeleport(x,y,130);const match=houses.find(H=>H.architecture?.kind===wanted);if(match){target(match);return;}await new Promise(resolve=>setTimeout(resolve,0));}
  message='Tipo não encontrado nos setores consultados.';
 });
 button('Ver fachada',()=>{if(selected)target(selected);});
 button('Entrar',()=>{if(selected)target(selected,true);});
 button('Subir escada',()=>{if(!selected?.stair){message='Imóvel térreo.';return;}const l=selected.architecture.levels[player.floor||0],p=l.stair.bottom;player.x=p[0];player.y=p[1];input.pressed.add('f');});
 button('Descer escada',()=>{if(!selected?.stair)return;const l=selected.architecture.levels[player.floor||0],p=l.stair.top;player.x=p[0];player.y=p[1];input.pressed.add('f');});
 button('Ir à sacada',()=>{if(!selected)return;const A=selected.architecture,l=A.levels[player.floor||1];if(!l?.outdoor.length){message='Este imóvel não tem sacada.';return;}const b=l.outdoor[0],p=A.toWorld((b.x0+b.x1)/2,b.y0+.7);player.floor=l.floor;player.floorZ=l.z;player.x=p[0];player.y=p[1];window.cityPropertyReviewFocus=null;message='Sacada: use WASD para caminhar; F abre ou fecha a porta.';});
 button('Testar janela',()=>{if(!selected)return;target(selected);const A=selected.architecture,w=A.levels[0].walls.find(w=>w.ext&&w.normal[1]>.5&&w.openings.some(o=>o.kind==='window')),o=w?.openings.find(o=>o.kind==='window');if(!o)return;const s=o.segment;player.x=(s.x1+s.x2)/2+s.nx*.65;player.y=(s.y1+s.y2)/2+s.ny*.65;window.cityPropertyReviewFocus=null;cam.tzoom=52;message='Janela selecionada: F abre/fecha a folha vertical.';});
 button('Interagir com F',()=>input.pressed.add('f'));
 button('Varanda dos fundos',()=>{if(!selected)return;const A=selected.architecture,l=A.levels[1],b=l?.outdoor.find(r=>r.rear);if(!b){message='Este imóvel não tem varanda nos fundos.';return;}const p=A.toWorld((b.x0+b.x1)/2,b.y1-.7);Object.assign(player,{x:p[0],y:p[1],floor:1,floorZ:l.z,stairTravel:null});window.cityPropertyReviewFocus=null;cam.tang=cam.ang=A.angle+Math.PI-.4;cam.cos=Math.cos(cam.ang);cam.sin=Math.sin(cam.ang);message='Varanda dos fundos conectada ao corredor por porta.';});
 button('Girar câmera',()=>{cam.tang+=Math.PI/2;});button('Dia / noite',()=>input.pressed.add('n'));
 button('Abrir portas internas',()=>{if(selected)for(const s of selected.architecture.levels[player.floor||0].segments)if(s.door&&!s.ext)s.doorAnim.target=1;});
 button('Revisar cômodos',()=>{if(!selected)return;const l=selected.architecture.levels[player.floor||0],room=l.rooms[(index++)%l.rooms.length],p=selected.architecture.toWorld((room.x0+room.x1)/2,(room.y0+room.y1)/2);player.x=p[0];player.y=p[1];});
 setInterval(()=>{const s=window.cityArchitecture3D,A=selected?.architecture;report.textContent=(selected?`${labels[A.kind]} · ${A.family}\n${A.levels.length} pavimento(s) · piso ${player.floor||0}\n${A.levels[player.floor||0]?.rooms.map(r=>r.use).join(', ')}\nPlanta: ${A.audit.passed?'válida':'REPROVADA'}\n`:'Selecione um imóvel do mapa.\n')+(s?`${s.properties} imóveis 3D · ${s.pending} aguardando\n${s.meshes} malhas · ${s.triangles} triângulos\nConstrução do quadro ${s.buildMs} ms\n${fps.toFixed(1)} FPS (navegador atual)\nErros: ${s.errors.length}\nVe?culo ${window.cityVehicles?.status} / ${window.cityVehicles?.frames||0} quadros\nSimula??o ${T.toFixed(2)} / manual ${!!window.__manual}`:'Preparando 3D…')+(globalThis.cityArchitectureErrors?.length?'\n'+globalThis.cityArchitectureErrors.join('\n'):'')+(message?'\n'+message:'');},300);
 type.value='airport';
 const openingReport=document.createElement('div');ui.append(openingReport);
 setInterval(()=>{const found=findHouseInteraction(player);if(!found?.obj.seg){openingReport.textContent='';return;}const s=found.obj.seg,a=s.doorAnim||s.windowAnim;openingReport.textContent=interactionPrompt(player)+' · movimento '+Math.round(a.open*100)+'%';},100);
}
