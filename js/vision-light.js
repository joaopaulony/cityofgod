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
function wallOccluders(x,y,radius,floor=0){
  const ret=[];
  for(const H of houses){
    if(H.x1<x-radius||H.x0>x+radius||H.y1<y-radius||H.y0>y+radius)continue;
    // Todas as paredes bloqueiam o halo, internas ou externas.
    // Aberturas sao analisadas separadamente no sistema de visao.
    if(floor===1&&H.upper){
      for(const s of H.segs)if(s.ext)ret.push(s);
      for(const s of H.upper.walls)
        if(!s.door||!s.doorAnim||s.doorAnim.open<.72)ret.push(s);
    }else for(const s of H.segs){
      if(!s.ext&&s.door&&s.doorAnim?.open>=.72)continue;
      ret.push(s);
    }
  }
  return ret;
}
function lightVisibilityPolygon(x,y,radius,floor=0){
  const obstacles=wallOccluders(x,y,radius,floor);
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
function clipLightPolygon(ctx,worldPoints,z=0){
  ctx.beginPath();
  worldPoints.forEach(([x,y],i)=>{
    const p=proj(x,y,z);
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
// Feixe angular sempre nasce do lado de fora da fachada: nada de halos de 360°
 // graus desenhados na parede nem de luz que atravesse o interior.
function exteriorLightCone(x,y,radius,nx,ny,spread=Math.PI*.36,floor=0){
  const angle=Math.atan2(ny,nx),segments=30;
  const obstacles=wallOccluders(x,y,radius,floor);
  const points=[[x,y]];
  for(let i=0;i<=segments;i++){
    const a=angle-spread+i*(2*spread/segments);
    const dx=Math.cos(a),dy=Math.sin(a);
    let dist=radius;
    for(const s of obstacles)
      dist=Math.min(dist,raySegmentDistance(x,y,dx,dy,s,dist));
    points.push([x+dx*dist,y+dy*dist]);
  }
  return points;
}
// Desenha com cobertura em planta projetada: protege fachadas (quads verticais)
// E todas as aguas do telhado (poligonos inclinados), mesmo nas quinas.
function paintBuildingLightMask(ctx){
  for(const H of houses){
    const cx=(H.x0+H.x1)*.5,cy=(H.y0+H.y1)*.5;
    const p=proj(cx,cy,0),margin=cam.zoom*(Math.hypot(H.x1-H.x0,H.y1-H.y0)+3);
    if(p.x<-margin||p.x>cam.W+margin||p.y<-margin||p.y>cam.H+margin)continue;
    const polygon=pts=>{
      // Preenchimento independente. Um path global tinha faces com winding
      // oposto, cuja area sobreposta podia se anular e expor o telhado.
      ctx.beginPath();
      pts.forEach((q,i)=>{const v=proj(...q);
        if(!i)ctx.moveTo(v.x,v.y);else ctx.lineTo(v.x,v.y);
      });
      ctx.closePath();
      ctx.fill();
    };
    const z=H.inside?.51:H.h;
    for(const side of Object.values(H.sides)){
      const ex=side.a[0]+side.dir[0]*side.len;
      const ey=side.a[1]+side.dir[1]*side.len;
      polygon([[side.a[0],side.a[1],0],[ex,ey,0],
        [ex,ey,z],[side.a[0],side.a[1],z]]);
    }
    if(!H.inside){
      const roof=H.roofGeom||(H.roofGeom=buildRoofGeom(H));
      if(roof.flat){
        polygon([[H.x0,H.y0,H.h],[H.x1,H.y0,H.h],
          [H.x1,H.y1,H.h],[H.x0,H.y1,H.h]]);
      }else for(const face of roof.faces)polygon(face.p);
    }
  }
}
// A oclusao de fachada e telhado evita que o shader 2D do chao volte a
// iluminar a parede quando a iluminacao final e composta sobre a cena.
function protectBuildingSurfaces(ctx,ambientColor){
  ctx.save();
  ctx.globalCompositeOperation='destination-out';
  ctx.fillStyle='#fff';
  paintBuildingLightMask(ctx);
  if(ambientColor){
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle=ambientColor;
    paintBuildingLightMask(ctx);
  }
  ctx.restore();
}
// Feixe de atmosfera: tres laminas translúcidas sobrepostas com queda suave.
// Desenhado ANTES da geometria das casas para ser escondido por ela.
function drawLampBeam(g,l,t){
  const x=l.x+l.ax*1.1,y=l.y+l.ay*1.1,radius=5.1;
  const foot=proj(x,y,0),head=proj(x,y,4.03);
  const pad=cam.zoom*radius;
  if(foot.x<-pad||foot.x>cam.W+pad||
    foot.y<-pad||foot.y>cam.H+pad)return;
  const points=lightVisibilityFor(l,x,y,radius);
  const profile=[
    {scale:1,opacity:.060},
    {scale:.68,opacity:.075},
    {scale:.38,opacity:.085}
  ];
  g.save();
  g.globalCompositeOperation='screen';
  // Raios discretos convergem na luminaria, abrindo em faixas de luz no solo.
  for(const pass of profile){
    const bottom=points.map(([xx,yy])=>proj(x+(xx-x)*pass.scale,
      y+(yy-y)*pass.scale,0));
    const grad=g.createLinearGradient(head.x,head.y,foot.x,foot.y);
    grad.addColorStop(0,'rgba(255,237,192,'+(pass.opacity*1.85)+')');
    grad.addColorStop(.48,'rgba(255,216,150,'+pass.opacity+')');
    grad.addColorStop(1,'rgba(255,202,127,0)');
    for(let i=0;i<bottom.length;i++){
      const a=bottom[i],b=bottom[(i+1)%bottom.length];
      g.fillStyle=grad;g.beginPath();g.moveTo(head.x,head.y);
      g.lineTo(a.x,a.y);g.lineTo(b.x,b.y);g.closePath();g.fill();
    }
  }
  g.restore();
}
