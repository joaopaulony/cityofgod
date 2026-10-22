// vision-light.js — visibilidade por aberturas e iluminacao com oclusao de paredes.
// Raycasting 2D no plano do chao, cacheado por fonte fixa. Sem dependencias.
'use strict';
const LIGHT_RAYS=72;
function cross2(ax,ay,bx,by){return ax*by-ay*bx;}
function raySegmentDistance(x,y,dx,dy,s,maxDist){
  const vx=s.x2-s.x1,vy=s.y2-s.y1,
    det=cross2(dx,dy,vx,vy);
  if(Math.abs(det)<1e-9)return maxDist;
  const rx=s.x1-x,ry=s.y1-y,
    t=cross2(rx,ry,vx,vy)/det,u=cross2(rx,ry,dx,dy)/det;
  return t>1e-4&&t<maxDist&&u>=-1e-5&&u<=1+1e-5?t:maxDist;
}
function wallOccluders(x,y,radius){
  const ret=[];
  for(const H of houses){
    if(H.x1<x-radius||H.x0>x+radius||H.y1<y-radius||H.y0>y+radius)continue;
    // Todas as paredes bloqueiam o halo, internas ou externas.
    // Aberturas sao analisadas separadamente no sistema de visao.
    for(const s of H.segs)ret.push(s);
  }
  return ret;
}
function lightVisibilityPolygon(x,y,radius){
  const obstacles=wallOccluders(x,y,radius);
  const result=[];
  for(let i=0;i<LIGHT_RAYS;i++){
    const a=i*TAU/LIGHT_RAYS,dx=Math.cos(a),dy=Math.sin(a);
    let dist=radius;
    for(const s of obstacles)dist=Math.min(dist,raySegmentDistance(x,y,dx,dy,s,dist));
    result.push([x+dx*dist,y+dy*dist]);
  }
  return result;
}
function lightIsVisible(x,y,targetX,targetY,ignore){
  const dx=targetX-x,dy=targetY-y,r=Math.hypot(dx,dy);
  if(r<1e-4)return true;
  const segs=wallOccluders(x,y,r+.3);
  for(const s of segs){
    if(ignore===s)continue;
    if(raySegmentDistance(x,y,dx/r,dy/r,s,r-.04)<r-.04)return false;
  }
  return true;
}
function houseVisibleOpenings(H,x,y){
  if(x>H.x0&&x<H.x1&&y>H.y0&&y<H.y1)return [];
  const result=[];
  for(const s of H.segs){
    if(!s.ext||(!s.window&&!s.door))continue;
    const mx=(s.x1+s.x2)*.5,my=(s.y1+s.y2)*.5,
      d=Math.hypot(mx-x,my-y);
    if(d>8.5||d<.22)continue;
    const outward=(x-mx)*s.nx+(y-my)*s.ny;
    if(outward<.35)continue;
    if(s.door&&(!s.doorAnim||s.doorAnim.open<.58))continue;
    if(!lightIsVisible(x,y,mx,my,s))continue;
    result.push(s);
  }
  return result;
}
function clipLightPolygon(ctx,worldPoints){
  ctx.beginPath();
  worldPoints.forEach(([x,y],i)=>{
    const p=proj(x,y,0);
    if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
  });
  ctx.closePath();
  ctx.clip();
}
// Oclusao de lampadas de rua no solo: o poligono e cacheado no mundo,
// reprojetado com a camera, e limita tanto a iluminacao quanto o brilho.
function lightVisibilityFor(source,x,y,radius){
  if(!source._vis||source._visX!==x||source._visY!==y||
    source._visRadius!==radius){
    source._vis=lightVisibilityPolygon(x,y,radius);
    source._visX=x;source._visY=y;source._visRadius=radius;
  }
  return source._vis;
}
function drawLampBeam(g,l,t){
  const x=l.x+l.ax*1.1,y=l.y+l.ay*1.1;
  const foot=proj(x,y,0),head=proj(x,y,3.9);
  if(foot.x<-cam.zoom*5||foot.x>cam.W+cam.zoom*5||
    foot.y<-cam.zoom*5||foot.y>cam.H+cam.zoom*5)return;
  const radius=2.8,points=lightVisibilityFor(l,x,y,radius);
  const gradient=g.createLinearGradient(head.x,head.y,foot.x,foot.y);
  gradient.addColorStop(0,'rgba(255,222,157,.095)');
  gradient.addColorStop(.5,'rgba(255,193,104,.035)');
  gradient.addColorStop(1,'rgba(255,167,85,.008)');
  g.save();
  // O feixe e desenhado atras da arquitetura; casas depois o cobrem.
  g.beginPath();
  g.moveTo(head.x-cam.zoom*.12,head.y);
  for(const a of [-.65,-.32,0,.32,.65]){
    const ox=Math.cos(a)*radius,oy=Math.sin(a)*radius*.65,
      p=proj(x+ox,y+oy,0);
    g.lineTo(p.x,p.y);
  }
  g.lineTo(head.x+cam.zoom*.12,head.y);g.closePath();
  g.fillStyle=gradient;g.fill();
  g.restore();
}
