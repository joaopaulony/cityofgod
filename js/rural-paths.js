// Acesso de fazenda/campo: solo pisado e cascalho, sem piso urbano.
// A textura do terreno sob o caminho continua procedural, sem PNG.
'use strict';
function ruralAccessProfile(H){
 const a=H.walk?.[0],b=H.walk?.[1];if(!a||!b)return null;
 const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 if(length<.3)return null;
 return {a,b,length,tx:dx/length,ty:dy/length,
   nx:-dy/length,ny:dx/length,width:1.75,seed:H.seed||1};
}
function paintRuralAccess(g,M,H){
 const p=ruralAccessProfile(H);if(!p)return;
 const rnd=mulberry(p.seed+38551),N=Math.max(12,Math.ceil(p.length*4));
 const points=[];for(let i=0;i<=N;i++){
   const t=i/N,lat=Math.sin(t*7+p.seed*.17)*.11+
     Math.sin(t*14+p.seed*.03)*.035;
   points.push({x:p.a[0]+p.tx*p.length*t+p.nx*lat,
    y:p.a[1]+p.ty*p.length*t+p.ny*lat,
    t,width:(1.60+Math.sin(t*14+p.seed)*.12)*
      (.66+.34*Math.sin(Math.PI*Math.min(1,.10+t*.85)))});
 }
 function strip(extra,col){
   g.fillStyle=col;g.beginPath();
   points.forEach((q,i)=>{
     const x=M(q.x+p.nx*(q.width+extra)),y=M(q.y+p.ny*(q.width+extra));
     i?g.lineTo(x,y):g.moveTo(x,y);
   });
   for(let i=points.length-1;i>=0;i--){
     const q=points[i];
     g.lineTo(M(q.x-p.nx*(q.width+extra)),M(q.y-p.ny*(q.width+extra)));
   }
   g.closePath();g.fill();
 }
 g.save();g.lineJoin='round';g.lineCap='round';
 strip(.35,'rgba(80,68,46,.32)'); // soil-to-grass feather
 strip(.20,'#665039');strip(.09,'#80664b');
 strip(-.10,'#987755'); // pale, compacted gravel/dirt center
 // Parallel tyre/pedestrian-worn bands, grounded in exactly the same path.
 for(const off of [-.53,.53]){
  g.strokeStyle='rgba(77,56,39,.32)';g.lineWidth=M(.17);
  g.beginPath();points.forEach((q,i)=>{
   const x=M(q.x+p.nx*off),y=M(q.y+p.ny*off);
   i?g.lineTo(x,y):g.moveTo(x,y);
  });g.stroke();
 }
 const count=Math.floor(p.length*56);
 for(let i=0;i<count;i++){
   const t=.03+rnd()*.94,idx=Math.min(N,Math.floor(t*N)),
    q=points[idx],off=(rnd()-.5)*q.width*1.9;
   const x=M(q.x+p.nx*off),y=M(q.y+p.ny*off);
   const size=M(.012+rnd()*.047)*(rnd()>.82?1.6:1);
   const color=rnd()<.25?'#d3be98':rnd()<.52?'#4e4a43':
     rnd()<.75?'#aaa38a':'#6b6e5c';
   g.fillStyle='rgba(35,26,19,.25)';g.beginPath();
   g.ellipse(x+size*.2,y+size*.18,size*1.05,size*.57,rnd()*3,0,TAU);g.fill();
   g.fillStyle=color;g.beginPath();
   g.ellipse(x,y,size,size*(.4+rnd()*.34),rnd()*3,0,TAU);g.fill();
 }
 // Break up the grass edge with tiny organic tufts, no straight walkway joints.
 for(let i=0;i<Math.floor(p.length*8);i++){
   const t=rnd(),q=points[Math.floor(t*N)],side=rnd()<.5?-1:1,
    off=side*(q.width+.07+rnd()*.31);
   g.strokeStyle=rnd()<.5?'#48612e':'#849247';g.lineWidth=Math.max(.7,M(.014));
   const x=M(q.x+p.nx*off),y=M(q.y+p.ny*off);
   g.beginPath();g.moveTo(x,y);g.lineTo(x+M((rnd()-.5)*.06),y-M(.08+rnd()*.1));g.stroke();
 }
 g.restore();
}
