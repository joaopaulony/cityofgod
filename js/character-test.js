// Optional controls to exercise real gameplay on the main map, never a new scene.
if(new URLSearchParams(location.search).get('characterTest')==='1'){
 const panel=document.createElement('aside');panel.id='character-test';
 panel.style.cssText='position:fixed;top:14px;left:14px;z-index:50;padding:12px;background:#10212eed;color:#fff;border-radius:8px;font:13px system-ui;max-width:315px';
 panel.innerHTML='<b>Teste de personagens · mapa principal</b><div id="character-buttons"></div><pre id="character-status" style="white-space:pre-wrap;margin:8px 0 0"></pre>';
 document.body.append(panel);
 const log=panel.querySelector('pre');let message='';
 const button=(name,fn)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='margin:5px 4px 0 0;padding:5px';b.onclick=()=>{try{fn();}catch(e){message=String(e);}};panel.querySelector('div').append(b);};
 const key=k=>input.pressed.add(k);
 const hold=(k,ms=1600)=>{input.keys.add(k);setTimeout(()=>input.keys.delete(k),ms);};
 const aim=()=>{const p=proj(player.x+Math.cos(player.face)*6,player.y+Math.sin(player.face)*6,1.4);input.mx=p.x*RS;input.my=p.y*RS;};
 button('Andar',()=>{hold('w');});
 button('Correr',()=>{hold('shift');hold('w');});
 button('Mirar',()=>{aim();input.rmb=!input.rmb;});
 button('Atirar',()=>{aim();player.wantShot=true;});
 button('Recarregar',()=>key('r'));
 button('Agachar C',()=>key('c'));
 button('Saltar Espaço',()=>key(' '));
 button('Girar câmera',()=>hold('q',1000));
 button('Aproximar',()=>{zi=5;cam.tzoom=ZOOMS[zi];});
 button('Reunir NPCs',()=>{
  let i=0;
  for(const n of npcs){
   let found=false;
   for(let r=1.5;r<6&&!found;r+=.5)for(let k=0;k<12;k++){
    const a=k*Math.PI/6+i,x=player.x+Math.cos(a)*r,y=player.y+Math.sin(a)*r,q=collide(x,y,.28,0);
    if(Math.hypot(q[0]-x,q[1]-y)>.03||pondVal(x,y)<=1.02)continue;
    Object.assign(n,{x,y,home:[x-1,y-1,2,2],goal:null,timer:0});found=true;break;
   }
   i++;
  }
 });
 button('Ir a muro baixo',async()=>{
  const {planLowVault}=await import('./character-actions.mjs');
  for(const s of world.segs){
   if(s.house||s.kind!=='fence'||s.h>1.55||s.h<.45)continue;
   const dx=s.x2-s.x1,dy=s.y2-s.y1,l=Math.hypot(dx,dy);if(l<1)continue;
   const nx=-dy/l,ny=dx/l;
   for(const sign of [-1,1]){
    const a={x:(s.x1+s.x2)/2+nx*.75*sign,y:(s.y1+s.y2)/2+ny*.75*sign,face:Math.atan2(-ny*sign,-nx*sign)};
    const clear=(x,y,ignore)=>{
     if(pondVal(x,y)<=1.02)return false;
     if(world.circles.some(c=>Math.hypot(x-c.x,y-c.y)<.28+c.r))return false;
     return !world.segs.some(other=>{if(other===ignore)return false;const ex=other.x2-other.x1,ey=other.y2-other.y1,ll=ex*ex+ey*ey,u=clamp(((x-other.x1)*ex+(y-other.y1)*ey)/ll,0,1);return Math.hypot(x-other.x1-ex*u,y-other.y1-ey*u)<.37;});
    };
    if(!planLowVault(a,world.segs,clear))continue;
    Object.assign(player,a,{jump:null,traversal:null,actionZ:0,crouching:false});
    cam.x=cam.tx=a.x;cam.y=cam.ty=a.y;message='Muro real do mapa: aperte Espaço para transpor.';return;
   }
  }
  message='Nenhum muro baixo com aterrissagem livre neste setor. Explore a cidade.';
 });
 setInterval(()=>{
  const c=window.cityCharacters;
  log.textContent=(c?`${c.status} · ${c.frames} quadros\n`+c.telemetry().map(a=>`${a.name}: ${a.clip} · z ${a.z.toFixed(2)}`).join('\n'):'Preparando WebGL…')+`\nPosição ${player.x.toFixed(2)}, ${player.y.toFixed(2)}\nMunição ${player.ammo}/${player.reserve}`+(message?'\n'+message:'')+(c?.errors.length?'\n'+c.errors.join('\n'):'');
 },150);
}
