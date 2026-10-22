'use strict';
// Renderer for user-approved AI art. Works in plain Canvas 2D: no shader,
// WebGL, runtime Gemini request or secret. Procedural carDraw is the fallback.
const VEHICLE_PAINTS=[
 {name:'Roxo',hex:'#704080'}, {name:'Vermelho',hex:'#b02c2c'},
 {name:'Preto',hex:'#333841'}, {name:'Branco',hex:'#d9dfde'},
 {name:'Amarelo',hex:'#dbbd36'}, {name:'Azul',hex:'#366fc3'},
 {name:'Verde',hex:'#407948'}, {name:'Prata',hex:'#9da5a8'}
];
const vehicleSpriteAtlas={
 ready:false,images:{},tints:new Map(),manifest:null,
 directions:['right','front-right','front','front-left',
             'left','rear-left','rear','rear-right'],
 base:'assets/vehicles/diablo/directions/'
};
function vehicleSpriteDirection(b){
 const a=(((b.rot+cam.ang)%TAU)+TAU)%TAU;
 return vehicleSpriteAtlas.directions[Math.round(a/(Math.PI/4))%8];
}
function vehicleSpriteColor(b){return b.paint||'#704080';}
function vehicleSpriteLoad(){
 // Missing/unfinished pilot should NOT affect the rest of the game.
 fetch('assets/vehicles/diablo/manifest.json',{cache:'no-store'}).then(r=>{
  if(!r.ok)throw Error('Sprite manifest not yet available');
  return r.json();
 }).then(meta=>{
  if(meta.id!=='diablo'||!Array.isArray(meta.directions))return;
  vehicleSpriteAtlas.ready=true;vehicleSpriteAtlas.manifest=meta;
  for(const direction of meta.directions){
   if(!vehicleSpriteAtlas.directions.includes(direction))continue;
   const image=new Image();image.decoding='async';
   image.onload=()=>{vehicleSpriteAtlas.images[direction]=image;};
   image.onerror=()=>{delete vehicleSpriteAtlas.images[direction];};
   image.src=vehicleSpriteAtlas.base+direction+'.png';
  }
 }).catch(()=>{});
}
function vehicleRgbToHsv(r,g,b){
 r/=255;g/=255;b/=255;
 const mx=Math.max(r,g,b),mn=Math.min(r,g,b),diff=mx-mn;
 let hue=0;
 if(diff){
  if(mx===r)hue=((g-b)/diff)%6;
  else if(mx===g)hue=(b-r)/diff+2;
  else hue=(r-g)/diff+4;
  hue=(hue/6+1)%1;
 }
 return [hue,mx===0?0:diff/mx,mx];
}
function vehicleHsvToRgb(h,s,v){
 const n=h*6,i=Math.floor(n),f=n-i,p=v*(1-s),q=v*(1-f*s),
  t=v*(1-(1-f)*s);
 const rgb=([[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]])[i%6];
 return rgb.map(x=>Math.round(Math.max(0,Math.min(1,x))*255));
}
function vehicleTintImage(image,color){
 const off=makeCanvas(image.naturalWidth,image.naturalHeight),ctx=off.getContext('2d');
 ctx.drawImage(image,0,0);
 if(color.toLowerCase()==='#704080')return off;
 const swatch=color.slice(1).match(/../g).map(x=>parseInt(x,16));
 const [h,s]=vehicleRgbToHsv(...swatch);
 const pic=ctx.getImageData(0,0,off.width,off.height),d=pic.data;
 for(let i=0;i<d.length;i+=4){
  if(d[i+3]<5)continue;
  const [originalHue,originalSat,v]=vehicleRgbToHsv(d[i],d[i+1],d[i+2]);
  // Purple/magenta car panels only. Gray wheels and blue glazing unaffected.
  const magenta=(originalHue>.70&&originalHue<.98)&&originalSat>.11 &&
   (d[i]>d[i+1]*1.08||d[i+2]>d[i+1]*1.08);
  if(!magenta)continue;
  const result=vehicleHsvToRgb(h,
   Math.min(.92,Math.max(.15,s*.85+originalSat*.19)),
   Math.min(1,v*(s<.20?1.18:1.08)));
  d[i]=result[0];d[i+1]=result[1];d[i+2]=result[2];
 }
 ctx.putImageData(pic,0,0);return off;
}
function vehicleSpriteImage(direction,color){
 const image=vehicleSpriteAtlas.images[direction];
 if(!image || !image.complete || !image.naturalWidth)return null;
 const key=direction+':'+color.toLowerCase();
 if(vehicleSpriteAtlas.tints.has(key))return vehicleSpriteAtlas.tints.get(key);
 const colored=vehicleTintImage(image,color);
 vehicleSpriteAtlas.tints.set(key,colored);
 if(vehicleSpriteAtlas.tints.size>45)
  vehicleSpriteAtlas.tints.delete(vehicleSpriteAtlas.tints.keys().next().value);
 return colored;
}
function vehicleDrawSprite(g,b,time){
 if(b.model!=='supercar'||!vehicleSpriteAtlas.ready)return false;
 const dir=vehicleSpriteDirection(b),image=vehicleSpriteImage(dir,vehicleSpriteColor(b));
 if(!image)return false;
 const anchor=proj(b.x,b.y,0),m=carModel(b);
 // Standardized 768x512 sprites share a fixed physical scale across views.
 const scale=cam.zoom*(m.len/4.68)*.208;
 const width=768*scale,height=512*scale;
 // Center of tire contact zone aligned around actual world car origin.
 const x=anchor.x-width*.50,y=anchor.y-height*.73;
 g.drawImage(image,x,y,width,height);
 vehicleDrawPartOverlays(g,b,m);
 vehicleDrawWheelMotion(g,b,m,dir,time);
 return true;
}
function vehicleDrawWheelMotion(g,b,m,dir,time){
 if(!b.odometer||Math.abs(b.speed||0)<.18)return;
 // Wheel highlights rotate with distance driven and remain subtle: original
 // thick realistic rubber/rims in the sprite are never replaced with discs.
 // For the pilot we only enhance the view from the trusted master sprite.
 if(dir!=='front-left')return;
 const anchor=proj(b.x,b.y,0),sc=cam.zoom*(m.len/4.68)*.208,
   bx=anchor.x-768*sc*.5,by=anchor.y-512*sc*.73;
 const centers=[[358,378,21],[614,278,21]];
 const theta=(b.odometer/m.wheel)%TAU;
 g.save();g.globalAlpha=.30;g.strokeStyle='#dee2df';
 g.lineWidth=Math.max(.7,cam.zoom*.018);
 for(const [cx,cy,r] of centers){
  const x=bx+cx*sc,y=by+cy*sc,rr=r*sc;
  for(let j=0;j<5;j++){
   const a=theta+TAU*j/5;
   g.beginPath();g.moveTo(x+Math.cos(a)*rr*.22,y+Math.sin(a)*rr*.22);
   g.lineTo(x+Math.cos(a)*rr*.86,y+Math.sin(a)*rr*.86);
   g.stroke();
  }
 }
 g.restore();
}
function vehicleDrawPartOverlays(g,b,m){
 const p=b.parts||{};
 const paint=vehicleSpriteColor(b);
 // Articulated physical overlays, anchored in actual projected car space.
 // Later per-part sprite sheets can replace these without changing state.
 const door=(side,amount)=>{
  if(amount<.015)return;
  const w=m.w/2,hingeU=m.cabF-.13,hingeV=side*w*.86,
    open=Math.sin(amount*1.06)*.96,
    rearU=hingeU-.94*Math.cos(amount*.9),
    rearV=hingeV+side*open;
  const vertices=[
   [hingeU,hingeV,.72],[rearU,rearV,.73],
   [rearU,rearV,1.10],[hingeU,hingeV,1.14]
  ];
  carFill(g,b,vertices,shadeHex(paint,side>0?1.07:.79),'#25232a');
  carLine(g,b,[vertices[0],vertices[3]],'rgba(246,237,222,.43)',.027);
  const win=[[hingeU,hingeV,1.14],[rearU,rearV,1.10],
   [rearU+.05,rearV,1.34],[hingeU-.03,hingeV,1.37]];
  carFill(g,b,win,'rgba(62,91,101,.85)','#202e35');
 };
 door(-1,p.left||0);door(1,p.right||0);
 const lift=(kind,amount)=>{
  if(amount<.015)return;
  const front=kind==='hood',w=m.w*.40,
    hinge=front?m.cabF+.29:m.cabB-.15,
    lip=front?m.len*.48:-m.len*.48,
    color=shadeHex(paint,front?1.12:.96);
  const raised=.70*Math.sin(amount*1.23);
  carFill(g,b,[[hinge,-w,front?m.hood:m.deck],
    [hinge,w,front?m.hood:m.deck],
    [lip,w,(front?m.hood:m.deck)+raised],
    [lip,-w,(front?m.hood:m.deck)+raised]],
    color,'#342839');
  for(const s of [-1,1])
   carLine(g,b,[[hinge,s*w,front?m.hood:m.deck],
     [lip,s*w,(front?m.hood:m.deck)+raised]],'#a38d9f',.025);
 };
 lift('hood',p.hood||0);
 lift('rear',p.rear||0);
}
vehicleSpriteLoad();
