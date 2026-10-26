// Indoor navigation for City Home. Pure A* in architectural local coordinates.
'use strict';
const CityHomeNav=(()=>{
 const SQRT2=Math.SQRT2,GRID=.55,ACTOR_RADIUS=.24;
 const toLocal=(H,x,y)=>H.architecture?.toLocal?.(x,y)||[x-H.x0,y-H.y0];
 const toWorld=(H,x,y)=>H.architecture?.toWorld?.(x,y)||[x+H.x0,y+H.y0];
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function inside(H,f,x,y){
   const rooms=H.architecture?.levels?.[f]?.rooms;
   if(rooms?.length){
     if(rooms.some(r=>x>r.x0+ACTOR_RADIUS&&x<r.x1-ACTOR_RADIUS&&y>r.y0+ACTOR_RADIUS&&y<r.y1-ACTOR_RADIUS))
       return true;
     // At a doorway the architectural wall occupies the same region as
     // room clearance. Add a narrow explicit traversable portal corridor;
     // other wall segments remain impassable.
     for(const w of H.architecture.levels[f].walls||[]){
       const dx=w.b[0]-w.a[0],dy=w.b[1]-w.a[1],length=Math.hypot(dx,dy)||1,
         along=((x-w.a[0])*dx+(y-w.a[1])*dy)/length,
         perpendicular=Math.abs((x-w.a[0])*dy-(y-w.a[1])*dx)/length;
       if(perpendicular>GRID*.64)continue;
       if((w.openings||[]).some(o=>o.kind==='door'&&
         Math.abs(along-o.at)<Math.max(.15,o.width/2-ACTOR_RADIUS*.4)))return true;
     }
     return false;
   }
   const a=toLocal(H,H.x0,H.y0),b=toLocal(H,H.x1,H.y1);
   return x>Math.min(a[0],b[0])+ACTOR_RADIUS&&x<Math.max(a[0],b[0])-ACTOR_RADIUS&&y>Math.min(a[1],b[1])+ACTOR_RADIUS&&y<Math.max(a[1],b[1])-ACTOR_RADIUS;
 }
 function furnitureBlocked(H,f,x,y,ignoreId){
   for(const o of CityHome.placed(H)){
     if(o.floor!==f||o.id===ignoreId||o.solid===false||['rug','mirror','tv','screen','plant','bookstack','lampdesk'].includes(o.kind))continue;
     const center=toLocal(H,o.x,o.y);
     // World orientation can differ from architectural local rotation:
     // derive projected direction explicitly to preserve rotated houses.
     const forward=toLocal(H,o.x+Math.cos(o.rot),o.y+Math.sin(o.rot));
     const vx=forward[0]-center[0],vy=forward[1]-center[1],len=Math.hypot(vx,vy)||1;
     const ux=vx/len,uy=vy/len,dx=x-center[0],dy=y-center[1];
     if(Math.abs(dx*ux+dy*uy)<o.w/2+ACTOR_RADIUS &&
        Math.abs(-dx*uy+dy*ux)<o.d/2+ACTOR_RADIUS)return true;
   }
   return false;
 }
 function crossing(a,b,c,d){
   const ux=b[0]-a[0],uy=b[1]-a[1],vx=d[0]-c[0],vy=d[1]-c[1],den=ux*vy-uy*vx;
   if(Math.abs(den)<1e-9)return null;
   const px=c[0]-a[0],py=c[1]-a[1],t=(px*vy-py*vx)/den,u=(px*uy-py*ux)/den;
   return t>1e-4&&t<1-1e-4&&u>=-1e-4&&u<=1+1e-4?u:null;
 }
 function doorway(H,f,a,b){
   for(const wall of H.architecture?.levels?.[f]?.walls||[]){
     const u=crossing(a,b,wall.a,wall.b);
     if(u===null)continue;
     const len=Math.hypot(wall.b[0]-wall.a[0],wall.b[1]-wall.a[1]);
     const at=u*len;
     if(!(wall.openings||[]).some(o=>o.kind==='door'&&Math.abs(at-o.at)<=o.width/2-ACTOR_RADIUS*.6))return false;
   }
   return true;
 }
 function grid(H,f,ignoreId){
   const rooms=H.architecture?.levels?.[f]?.rooms;
   const x0=rooms?.length?Math.min(...rooms.map(r=>r.x0)):0;
   const x1=rooms?.length?Math.max(...rooms.map(r=>r.x1)):Math.max(8,H.x1-H.x0);
   const y0=rooms?.length?Math.min(...rooms.map(r=>r.y0)):0;
   const y1=rooms?.length?Math.max(...rooms.map(r=>r.y1)):Math.max(8,H.y1-H.y0);
   const step=GRID,nx=Math.ceil((x1-x0)/step)+1,ny=Math.ceil((y1-y0)/step)+1;
   if(nx*ny>14000||nx*ny<4)return null;
   const valid=new Uint8Array(nx*ny);
   for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
     const u=x0+x*step,v=y0+y*step;
     if(inside(H,f,u,v)&&!furnitureBlocked(H,f,u,v,ignoreId))valid[y*nx+x]=1;
   }
   return {x0,y0,step,nx,ny,valid};
 }
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 function route(H,start,target,f=0,ignoreId=null){
   const g=grid(H,f,ignoreId);if(!g)return null;
   const ix=p=>[Math.round((p[0]-g.x0)/g.step),Math.round((p[1]-g.y0)/g.step)];
   const idx=(x,y)=>y*g.nx+x,point=id=>[g.x0+(id%g.nx)*g.step,g.y0+Math.floor(id/g.nx)*g.step];
   function closest(p){
     const [gx,gy]=ix(p),limit=6;let best=-1,d=Infinity;
     for(let oy=-limit;oy<=limit;oy++)for(let ox=-limit;ox<=limit;ox++){
       const x=gx+ox,y=gy+oy;if(x<0||y<0||x>=g.nx||y>=g.ny)continue;
       const k=idx(x,y);if(!g.valid[k])continue;
       const r=dist(point(k),p);
       if(r<d){d=r;best=k;}
     }
     return best;
   }
   const localStart=toLocal(H,start.x,start.y),localGoal=toLocal(H,target.x,target.y);
   const sid=closest(localStart),eid=closest(localGoal);
   if(sid<0||eid<0||dist(point(eid),localGoal)>3.5)return null;
   const n=g.nx*g.ny,cost=new Float64Array(n).fill(Infinity),previous=new Int32Array(n).fill(-1),closed=new Uint8Array(n);
   const heap=[],heur=id=>dist(point(id),point(eid));
   const push=(priority,id)=>{let i=heap.length;heap.push([priority,id]);while(i>0){const p=(i-1)>>1;if(heap[p][0]<=priority)break;heap[i]=heap[p];i=p;}heap[i]=[priority,id];};
   const pop=()=>{const top=heap[0][1],last=heap.pop();if(heap.length){let i=0;while(true){let j=i*2+1;if(j>=heap.length)break;if(j+1<heap.length&&heap[j+1][0]<heap[j][0])j++;if(last[0]<=heap[j][0])break;heap[i]=heap[j];i=j;}heap[i]=last;}return top;};
   cost[sid]=0;push(heur(sid),sid);
   let visited=0;const DIR=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
   while(heap.length&&visited<n){
     const id=pop();if(closed[id])continue;closed[id]=1;visited++;
     if(id===eid)break;
     const x=id%g.nx,y=(id/g.nx)|0,p=point(id);
     for(const [dx,dy] of DIR){
       const xx=x+dx,yy=y+dy;
       if(xx<0||yy<0||xx>=g.nx||yy>=g.ny)continue;
       const next=idx(xx,yy);if(!g.valid[next]||closed[next])continue;
       // No corner-cutting through two diagonally touching furniture pieces.
       if(dx&&dy&&(!g.valid[idx(x+dx,y)]||!g.valid[idx(x,y+dy)]))continue;
       const q=point(next);if(!doorway(H,f,p,q))continue;
       const c=cost[id]+(dx&&dy?SQRT2:1)*g.step;
       if(c+1e-7<cost[next]){cost[next]=c;previous[next]=id;push(c+heur(next),next);}
     }
   }
   if(!Number.isFinite(cost[eid]))return null;
   const ids=[];let cursor=eid;
   for(let i=0;i<=n&&cursor>=0;i++){ids.push(cursor);if(cursor===sid)break;cursor=previous[cursor];}
   if(ids.at(-1)!==sid)return null;
   ids.reverse();
   // Remove collinear nodes; we keep doorway crossing points intact.
   const points=ids.map(point).filter((p,i,all)=>i===0||i===all.length-1||
       Math.abs((p[0]-all[i-1][0])*(all[i+1][1]-p[1])-(p[1]-all[i-1][1])*(all[i+1][0]-p[0]))>.00001)
     .map(p=>toWorld(H,p[0],p[1]));
   return {points:points.map(([x,y])=>({x,y})),distance:cost[eid],visited,cells:n,goal:toWorld(H,...point(eid))};
 }
 function approach(H,p,item){
   const f=item.floor||0,ang=item.rot||0,c=Math.cos(ang),s=Math.sin(ang);
   const offsets=[
     [0,item.d/2+.62],[0,-item.d/2-.62],
     [item.w/2+.62,0],[-item.w/2-.62,0],
     [.25,item.d/2+.58],[-.25,item.d/2+.58]];
   let best=null;
   for(const [u,v] of offsets){
     const x=item.x+u*c-v*s,y=item.y+u*s+v*c;
     const attempt=route(H,p,{x,y},f,null);
     if(!attempt)continue;
     const current={...attempt,stand:{x,y},face:Math.atan2(item.y-y,item.x-x)};
     if(!best||current.distance<best.distance)best=current;
   }
   return best;
 }
 return {route,approach,grid,doorway,inside,furnitureBlocked,version:'1.0'};
})();
window.CityHomeNav=CityHomeNav;
