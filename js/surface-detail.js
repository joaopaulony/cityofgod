// City of God — realistic, tile-aware enrichment of EXISTING texture pixels.
// No new texture assets, meshes, decals or render passes. Executed once per source image.
// Deterministic recipes add masonry, aggregate, weathering and ground microstructure.
// Reuses original color/roughness maps; normal maps remain valid and untouched.
(function(root){
 'use strict';
 const RECIPES={
  'ground-lawn':['blade','tuft','clover','thatch','dryTip','seed','soilPin','leaf','moss','dapple','wisps','roots'],
  'ground-weeds':['blade','tuft','thatch','dryTip','seed','soilPin','leaf','moss','wisps','roots','straw','spore'],
  'ground-dirt':['pebble','grit','clay','hairline','erosion','root','pore','dryPatch','silt','mud','drag','stain'],
  'ground-sand':['grain','pebble','silt','ripple','shell','salt','wash','dryPatch','mica','footScuff','dune','dust'],
  'ground-sidewalk':['joint','aggregate','pore','hairline','chip','trowel','efflorescence','watermark','scuff','stain','gutterDust','edgeWear'],
  'ground-sidewalk-pink':['joint','aggregate','pore','hairline','chip','trowel','efflorescence','watermark','scuff','stain','gutterDust','edgeWear'],
  'ground-concrete-worn':['joint','aggregate','pore','hairline','chip','trowel','efflorescence','watermark','scuff','stain','gutterDust','edgeWear'],
  'roof-flat':['tarJoint','grit','patch','watermark','pore','hairline','moss','sand','scuff','flake','sediment','weather'],
  plaster:['stucco','pore','trowel','hairline','paintChip','watermark','efflorescence','rainStreak','dust','stain','lime','weather'],
  stone:['brickJoint','claySpeck','mortar','brickChip','efflorescence','soot','watermark','pore','brickVariation','flaking','weather','hairline'],
  concrete:['aggregate','pore','trowel','hairline','efflorescence','rustStain','scuff','patch','drip','watermark','weather','chips'],
  tile:['joint','glaze','pore','hairline','chip','groutDark','speckle','scuff','watermark','ceramic','edgeWear','weather'],
  wood:['grain','knot','fiber','scratch','saw','edgeWear','watermark','weather','splinter','pore','stain','dryPatch'],
  roof:['shingle','grit','weather','moss','rainStreak','flake','chip','watermark','rustStain','sand','seam','pore']
 };
 // 14 ORIGINAL materials x 12 distinct material-specific baked effects = 168 recipes.
 const cache=new Map(),stats={materialEffects:0,stamps:0,materials:[],processed:0};
 const hash=text=>{let v=2166136261;for(let i=0;i<text.length;i++)v=Math.imul(v^text.charCodeAt(i),16777619);return v>>>0;};
 const random=seed=>()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
 const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const circle=(g,x,y,r,fill)=>{g.fillStyle=fill;g.beginPath();g.ellipse(x,y,Math.max(.28,r),Math.max(.25,r*.65),0,0,Math.PI*2);g.fill();};
 const path=(g,points,width,color)=>{g.strokeStyle=color;g.lineWidth=width;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();};
 const ink=(dark,alpha)=>dark?'rgba(31,29,27,'+alpha+')':'rgba(246,236,218,'+alpha+')';
 function draw(g,key,type,r,w,h){
  const unit=Math.min(w,h)/512;
  const x=r()*w,y=r()*h,z=unit*(1+5*r()),dark=r()>.43;
  const shadow=ink(true,.07+.10*r()),shine=ink(false,.05+.09*r()),edge=dark?shadow:shine;
  const lw=(.4+r()*.9)*unit;
  if(['grain','grit','clay','silt','aggregate','claySpeck','speckle','mica','sand','stucco','pore','soilPin','seed','spore'].includes(type)){
   for(let i=0;i<14;i++){const px=(x+(r()-.5)*w*.23+w)%w,py=(y+(r()-.5)*h*.23+h)%h;
    circle(g,px,py,unit*(.35+r()*1.6),r()>.55?shadow:shine);}return;
  }
  if(['blade','tuft','thatch','dryTip','wisps','straw','roots','root','splinter','fiber'].includes(type)){
   const count=type==='tuft'?13:7;
   for(let i=0;i<count;i++){const px=x+(r()-.5)*z*7,py=y+(r()-.5)*z*4,dx=(r()-.5)*z*4,dy=-(1+r()*2)*z;
    path(g,[[px,py],[px+dx*.6,py+dy*.7],[px+dx,py+dy]],Math.max(.5,unit*.55),r()>.5?shadow:shine);}return;
  }
  if(['hairline','erosion','crack','tarJoint','seam','joint','brickJoint','mortar','groutDark','shingle'].includes(type)){
   if(type==='brickJoint'||type==='mortar'||type==='shingle'||type==='joint'||type==='seam'||type==='groutDark'){
    const nx=type==='brickJoint'||type==='mortar'?8:type==='shingle'?7:5;
    const ny=type==='brickJoint'||type==='mortar'?15:type==='shingle'?10:6;
    const sy=h/ny,sx=w/nx,gap=Math.max(.7,unit*(type==='mortar'?2:1.0));
    const color=type==='brickJoint'||type==='mortar'?'rgba(31,24,19,.22)':'rgba(27,26,24,.12)';
    g.strokeStyle=color;g.lineWidth=gap;g.beginPath();
    for(let yy=0;yy<=ny;yy++){g.moveTo(0,yy*sy);g.lineTo(w,yy*sy);}
    for(let yy=0;yy<ny;yy++)for(let xx=0;xx<=nx;xx++){const shift=(yy%2)*sx*.5,px=(xx*sx+shift)%w;g.moveTo(px,yy*sy);g.lineTo(px,(yy+1)*sy);}
    g.stroke();return;
   }
   let points=[[x,y]];for(let j=1;j<=6;j++)points.push([x+j*z*2,y+(r()-.5)*z*2+j*z*.65]);
   path(g,points,lw,shadow);path(g,points.map(([a,b])=>[a,b+unit]),lw*.45,shine);return;
  }
  if(['rainStreak','drip','watermark','wash','rustStain','stain','soot','lime','weather','efflorescence','mud','sediment','gutterDust','dust','dryPatch','dapple'].includes(type)){
   const length=z*(2+r()*7),width=z*(1+r()*4);
   if(type==='rainStreak'||type==='drip'||type==='rustStain'){
    for(let j=0;j<4;j++)path(g,[[x+j*z,y],[x+j*z+(r()-.5)*z,y+length]],unit*(.4+r()),type==='rustStain'?'rgba(116,69,43,.14)':shadow);
   }else{
    g.fillStyle=(type==='rustStain'?'rgba(127,78,43,.10)':r()>.45?shadow:shine);
    g.beginPath();g.ellipse(x,y,width,length*.38,r()*Math.PI,0,Math.PI*2);g.fill();
   }return;
  }
  if(['knot','wood','grain','saw','scratch','trowel','scuff','drag','footScuff','ripple','dune','ceramic','glaze','brickVariation'].includes(type)){
   const horizontal=type!=='grain'&&type!=='wood'&&type!=='knot';
   for(let k=0;k<4;k++){
    const xx=x+(r()-.5)*z*3,yy=y+(r()-.5)*z*3;
    const pts=horizontal?[[xx,yy],[xx+z*5,yy+z*.5],[xx+z*10,yy]]:
       [[xx,yy],[xx+z*.4,yy+z*4],[xx-z*.5,yy+z*9]];
    path(g,pts,Math.max(.45,unit*.55),k%2?shadow:shine);
   }if(type==='knot'){g.strokeStyle=shadow;g.lineWidth=unit;g.beginPath();g.ellipse(x,y,z*2,z*.85,0,0,Math.PI*2);g.stroke();}return;
  }
  if(['leaf','clover','shell','pebble','chip','brickChip','paintChip','flake','chips','patch','edgeWear','salt'].includes(type)){
   g.fillStyle=r()>.4?shadow:shine;g.beginPath();
   if(type==='leaf'||type==='clover')g.ellipse(x,y,z*.85,z*.35,r()*Math.PI,0,Math.PI*2);
   else if(type==='pebble'||type==='shell')g.ellipse(x,y,z*.4,z*.26,r()*Math.PI,0,Math.PI*2);
   else {g.moveTo(x,y);for(let k=0;k<5;k++){const a=k*Math.PI*2/5;g.lineTo(x+Math.cos(a)*z*(.4+r()),y+Math.sin(a)*z*(.3+r()));}}
   g.closePath();g.fill();return;
  }
  // Explicit feature even if a new recipe is introduced, never silently skip.
  circle(g,x,y,z*.4,edge);
 }
 function enrich(image,key,channel='color'){
  const names=RECIPES[key];if(!image||!names||channel==='normal')return image;
  const w=image.width||image.naturalWidth,h=image.height||image.naturalHeight;
  if(!w||!h)return image;
  const id=key+':'+channel+':'+w+'x'+h;
  if(cache.has(id))return cache.get(id);
  const c=canvas(w,h),g=c.getContext('2d',{willReadFrequently:false});g.drawImage(image,0,0,w,h);
  let stamped=0;
  for(let i=0;i<names.length;i++){
   const type=names[i],r=random(hash(key+':'+type));
   // Each entry yields repeated but deterministic material marks baked into its existing texels.
   const repeats=['joint','brickJoint','mortar','shingle','seam','groutDark'].includes(type)?1:7;
   g.save();g.lineCap='round';g.lineJoin='round';
   // Roughness maps remain grayscale; the alpha contribution remains small.
   g.globalAlpha=channel==='roughness'?.3:.9;
   for(let j=0;j<repeats;j++){draw(g,key,type,r,w,h);stamped++;}
   g.restore();
  }
  cache.set(id,c);stats.materialEffects+=names.length;stats.stamps+=stamped;stats.processed++;
  if(!stats.materials.includes(key))stats.materials.push(key);
  return c;
 }
 root.CitySurfaceDetails={enrich,recipes:RECIPES,stats,clear:()=>cache.clear()};
})(typeof window==='object'?window:globalThis);
