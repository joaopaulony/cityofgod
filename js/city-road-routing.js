// Road graph / A*: deterministic, car-drivable streets, geometric junction splitting.
// No roads/land terrain are invented. Rail tracks are excluded.
// Exposes a pure API for game and regression tests.
'use strict';
(function(root){
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const project=(x,y,a,b)=>{
   const dx=b[0]-a[0],dy=b[1]-a[1],dd=dx*dx+dy*dy;
   const t=dd?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/dd)):0;
   const px=a[0]+dx*t,py=a[1]+dy*t;
   return {t,x:px,y:py,d:Math.hypot(x-px,y-py)};
 };
 // Parameter of crossing between two finite line segments.
 const crossing=(a,b,c,d)=>{
   const ux=b[0]-a[0],uy=b[1]-a[1],vx=d[0]-c[0],vy=d[1]-c[1];
   const den=ux*vy-uy*vx;
   if(Math.abs(den)<1e-6)return null;
   const wx=c[0]-a[0],wy=c[1]-a[1],t=(wx*vy-wy*vx)/den,u=(wx*uy-wy*ux)/den;
   if(t<-.0001||t>1.0001||u<-.0001||u>1.0001)return null;
   return {t:Math.max(0,Math.min(1,t)),u:Math.max(0,Math.min(1,u)),x:a[0]+ux*t,y:a[1]+uy*t};
 };
 function build(roads,version){
   const segments=[],grid=new Map(),tile=56,cellKey=(x,y)=>x+':'+y;
   const addGrid=(id,s)=>{
     const ix=Math.floor(Math.min(s.a[0],s.b[0])/tile),jx=Math.floor(Math.min(s.a[1],s.b[1])/tile);
     const rx=Math.floor(Math.max(s.a[0],s.b[0])/tile),ry=Math.floor(Math.max(s.a[1],s.b[1])/tile);
     for(let x=ix;x<=rx;x++)for(let y=jx;y<=ry;y++){
       const k=cellKey(x,y);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(id);
     }
   };
   for(const [roadId,road] of (roads||[]).entries()){
     if(road.cls==='rail'||!road.pts?.length)continue;
     for(let i=1;i<road.pts.length;i++){
       const a=road.pts[i-1],b=road.pts[i];
       if(!Number.isFinite(a[0])||!Number.isFinite(b[0])||dist(a,b)<.0001)continue;
       const seg={id:segments.length,roadId,cls:road.cls,a,b,len:dist(a,b),splits:[{t:0,x:a[0],y:a[1]},{t:1,x:b[0],y:b[1]}]};
       const ix=Math.floor(Math.min(a[0],b[0])/tile),jx=Math.floor(Math.min(a[1],b[1])/tile);
       const rx=Math.floor(Math.max(a[0],b[0])/tile),ry=Math.floor(Math.max(a[1],b[1])/tile);
       const candidates=new Set();
       for(let x=ix;x<=rx;x++)for(let y=jx;y<=ry;y++)
         for(const other of grid.get(cellKey(x,y))||[])candidates.add(other);
       for(const id of candidates){
         const p=segments[id];
         if(p.roadId===roadId)continue;
         // Crossings of bridges / grade-separated highways need explicit ramps.
         // In particular do not connect city streets to expressways in the middle of a bridge.
         if((p.cls==='highway')!==(seg.cls==='highway'))continue;
         const cross=crossing(a,b,p.a,p.b);if(!cross)continue;
         seg.splits.push({t:cross.t,x:cross.x,y:cross.y});
         p.splits.push({t:cross.u,x:cross.x,y:cross.y});
       }
       segments.push(seg);addGrid(seg.id,seg);
     }
   }
   const nodes=[],index=new Map(),adj=[];
   const node=(x,y)=>{
     const key=Math.round(x*4)+','+Math.round(y*4);
     if(index.has(key))return index.get(key);
     const id=nodes.length;index.set(key,id);nodes.push([x,y]);adj.push([]);return id;
   };
   const weight={street:1,avenue:.93,highway:.83};
   const link=(a,b,cls,length)=>{
     if(a===b||length<.0001)return;
     const w=length*(weight[cls]||1);
     adj[a].push({to:b,w,length});adj[b].push({to:a,w,length});
   };
   for(const s of segments){
     s.splits.sort((a,b)=>a.t-b.t);
     const clean=[];
     for(const p of s.splits){
       if(clean.length&&Math.abs(clean[clean.length-1].t-p.t)<1e-5)continue;
       clean.push({...p,id:node(p.x,p.y)});
     }
     s.splits=clean;
     for(let j=1;j<clean.length;j++)link(clean[j-1].id,clean[j].id,s.cls,(clean[j].t-clean[j-1].t)*s.len);
   }
   // Road parts that nearly meet but differ by small procedural rounding are joined.
   // Only endpoints are considered; separate parallel roads remain separate.
   const endpointBuckets=new Map(),snapTol=2.25;
   for(const seg of segments){
     for(const p of [seg.splits[0],seg.splits[seg.splits.length-1]]){
       const gx=Math.round(p.x/5),gy=Math.round(p.y/5);
       for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)
        for(const q of endpointBuckets.get(cellKey(x,y))||[]){
         const d=dist([p.x,p.y],[q.x,q.y]);
         if(q.id!==p.id&&d<snapTol)link(p.id,q.id,'street',d);
        }
       const k=cellKey(gx,gy);if(!endpointBuckets.has(k))endpointBuckets.set(k,[]);
       endpointBuckets.get(k).push(p);
     }
   }
   const nearest=(x,y)=>{
     const gx=Math.floor(x/tile),gy=Math.floor(y/tile),candidates=new Set();
     for(let rad=0;rad<=5;rad++){
       for(let i=gx-rad;i<=gx+rad;i++)for(let j=gy-rad;j<=gy+rad;j++)
         for(const id of grid.get(cellKey(i,j))||[])candidates.add(id);
       if(candidates.size && rad>=1)break;
     }
     let found=null;
     for(const id of candidates){
       const s=segments[id],p=project(x,y,s.a,s.b);
       if(!found||p.d<found.d)found={...p,seg:s};
     }
     // Fallback when user selects a destination outside the network coverage.
     if(!found)for(const s of segments){const p=project(x,y,s.a,s.b);if(!found||p.d<found.d)found={...p,seg:s};}
     return found;
   };
   function route(from,to){
     const start=nearest(from.x,from.y),end=nearest(to.x,to.y);
     if(!start||!end)return null;
     if(start.d>180||end.d>220)return null;
     const n=nodes.length,sid=n,eid=n+1;
     const extra=new Map(),put=(a,b,w,len)=>{
       if(!extra.has(a))extra.set(a,[]);
       extra.get(a).push({to:b,w,length:len});
     };
     function hook(point,id){
       const s=point.seg,parts=s.splits;
       let a=parts[0],b=parts[parts.length-1];
       for(let j=1;j<parts.length;j++)
         if(point.t<=parts[j].t+.00001){a=parts[j-1];b=parts[j];break;}
       const pa=(point.t-a.t)*s.len,pb=(b.t-point.t)*s.len;
       const factor=weight[s.cls]||1;
       put(id,a.id,Math.max(0,pa)*factor,Math.max(0,pa));
       put(id,b.id,Math.max(0,pb)*factor,Math.max(0,pb));
       put(a.id,id,Math.max(0,pa)*factor,Math.max(0,pa));
       put(b.id,id,Math.max(0,pb)*factor,Math.max(0,pb));
     }
     hook(start,sid);hook(end,eid);
     if(start.seg===end.seg){
       const d=Math.abs(start.t-end.t)*start.seg.len;
       put(sid,eid,d*(weight[start.seg.cls]||1),d);
     }
     const point=id=>id===sid?[start.x,start.y]:id===eid?[end.x,end.y]:nodes[id];
     const costs=new Float64Array(n+2).fill(Infinity),prev=new Int32Array(n+2).fill(-1),closed=new Uint8Array(n+2);
     const heap=[];
     const push=(score,id)=>{let i=heap.length;heap.push([score,id]);while(i>0){const p=(i-1)>>1;if(heap[p][0]<=score)break;heap[i]=heap[p];i=p;}heap[i]=[score,id];};
     const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(last[0]<=heap[c][0])break;heap[i]=heap[c];i=c;}heap[i]=last;}return top[1];};
     const heuristic=id=>.83*dist(point(id),point(eid));
     costs[sid]=0;push(heuristic(sid),sid);
     while(heap.length){
       const id=pop();if(closed[id])continue;
       if(id===eid)break;closed[id]=1;
       const links=id<n?adj[id]:[];
       for(const edge of [...links,...(extra.get(id)||[])]){
         if(closed[edge.to])continue;
         const cost=costs[id]+edge.w;
         if(cost+1e-8<costs[edge.to]){costs[edge.to]=cost;prev[edge.to]=id;push(cost+heuristic(edge.to),edge.to);}
       }
     }
     if(!Number.isFinite(costs[eid]))return null;
     const ids=[];let cursor=eid;for(let k=0;cursor!==-1&&k<n+3;k++){ids.push(cursor);if(cursor===sid)break;cursor=prev[cursor];}
     if(ids[ids.length-1]!==sid)return null;
     ids.reverse();const points=ids.map(point);
     const length=points.slice(1).reduce((sum,p,i)=>sum+dist(p,points[i]),0);
     return {points,length,from:[start.x,start.y],to:[end.x,end.y],snapStart:start.d,snapEnd:end.d,segments:segments.length,nodes:n};
   }
   return {route,nearest,nodeCount:nodes.length,edgeCount:adj.reduce((v,x)=>v+x.length,0)/2,segmentCount:segments.length,version};
 }
 const api={build,project,crossing};
 root.CityRoadRouting=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
