// CityDistricts — district names, deterministic street addresses and gang territories.
// Pure gameplay metadata: seeded by world geometry; no per-frame allocation or procedural RNG drift.
'use strict';
(function(G){
 const COG=G.COG=G.COG||{};
 const palettes=[
  {name:'Verde Norte',tag:'VN',color:'#19bc79',outline:'#0a6349',symbol:'♠',motto:'RAÍZES DO BAIRRO',
   art:['VERDE NORTE','VN • 24','RAÍZES','LA CALLE','SIEMPRE VERDE']},
  {name:'Violet Kings',tag:'VK',color:'#9862ec',outline:'#50318a',symbol:'◆',motto:'KINGDOM OF THE BLOCK',
   art:['VIOLET KINGS','VK / 07','PURPLE BLOCK','KINGS ONLY','REYES DE NOCHE']},
  {name:'Sol de Cobre',tag:'SC',color:'#ed9b42',outline:'#854719',symbol:'☀',motto:'CALLES DE COBRE',
   art:['SOL DE COBRE','SC • 13','EL SOL','NO OLVIDES','COBRE VIVO']},
  {name:'Red Harbor',tag:'RH',color:'#e65c59',outline:'#752e35',symbol:'★',motto:'HARBOR BORN',
   art:['RED HARBOR','RH 18','OUR BLOCK','PUERTO ROJO','STAY TRUE']},
  {name:'Azure Saints',tag:'AS',color:'#51a6ee',outline:'#275c9a',symbol:'✦',motto:'BLOCK PRIDE',
   art:['AZURE SAINTS','AS / 9','SKYLINE','THE SAINTS','BLUE STREETS']},
  {name:'Golden Coyotes',tag:'GC',color:'#d7c053',outline:'#816320',symbol:'✹',motto:'NUNCA SOLÓS',
   art:['GOLDEN COYOTES','GC / 5','EL BARRIO','COYOTES','ORO Y CALLE']}
 ];
 const names={
  FAVELA:['Las Colinas','Barrio Esperanza','El Mirador','Santa Cruz Heights','Villa del Sol','Altos del Río','Las Flores'],
  GHETTO:['South Docks','Cypress Courts','East Marlow','Vista Verde','Oakland Terrace','Westside Row'],
  TOWN:['Cypress Bay','Santa Isla','Marina Hollow','Vista Paloma'],
  DOWNTOWN:['Downtown Bellavista'],URBAN:['Westwood','Palma Vista'],INDUSTRIAL:['Portside Works'],PORT:['Port Bellavista']
 };
 const roadBanks={
  latin:['Calle del Sol','Calle Esperanza','Calle Las Flores','Calle San Miguel','Calle de la Palma','Calle Los Olivos',
    'Calle del Mercado','Calle Rivera','Calle Veracruz','Calle Santa Rosa','Calle Cielo Azul','Calle Alameda'],
  us:['Oak Street','Sunset Drive','Cypress Road','Pacific Avenue','Maple Street','Willow Lane','Liberty Street',
    'Bayview Road','Franklin Street','Jackson Avenue','Riverside Drive','Palm Boulevard','Kingsway'],
  common:['Bayside Avenue','Harbor Road','Monroe Street','Marina Boulevard','Westbridge Avenue','Ocean View Drive',
    'Pier Street','Orchard Lane','Union Avenue','Market Street','Pioneer Way']
 };
 const hash=(a,b,c=0)=>{let n=Math.imul(Math.round(a)||0,73856093)^Math.imul(Math.round(b)||0,19349663)^Math.imul(c|0,83492791);n=Math.imul(n^(n>>>15),2246822519);return (n^(n>>>13))>>>0;};
 const at=(geo,x,y)=>{
  const D=COG.D,d=geo.districtAt(x,y),areas=geo.neighborhoods||[];
  let candidate=null,best=Infinity;
  for(const n of areas){
   if(n.d!==d)continue;
   const r=Math.max(1,n.r),nd=Math.hypot(x-n.x,y-n.y)/r;
   if(nd<best){best=nd;candidate=n;}
  }
  return candidate||{name:(COG.D_NAMES||[])[d]||'Zona rural',type:'area',d,x,y,r:1};
 };
 const gangAt=(geo,x,y)=>{
  const d=geo.districtAt(x,y);
  if(d!==COG.D.FAVELA && d!==COG.D.GHETTO)return null;
  const area=at(geo,x,y);
  return area.gang||null;
 };
 function register(geo){
  const D=COG.D,A=geo.anchors,areas=[];
  let gi=0;
  const add=(type,list,d,labels)=>list.forEach((anchor,i)=>{
   if(!anchor)return;
   const name=labels[i]||type+' '+(i+1),gang=(d===D.FAVELA||d===D.GHETTO)
     ?Object.freeze({...palettes[gi++%palettes.length],id:'crew:'+type+':'+i,neighborhood:name,index:gi-1}):null;
   const obj={id:type+':'+i,type,name,x:anchor.x,y:anchor.y,r:anchor.r||170,d,gang};
   areas.push(obj);anchor.districtName=name;anchor.gang=gang;
  });
  // Sequence matters: the first two territories are green and purple.
  const poor=[...A.favelas.map((a,i)=>({a,i,type:'favela'})),...A.ghettos.map((a,i)=>({a,i,type:'ghetto'}))];
  poor.forEach((entry,j)=>add(entry.type,[entry.a],entry.type==='favela'?D.FAVELA:D.GHETTO,[names[entry.type.toUpperCase()][entry.i]||'Barrio '+(j+1)]));
  add('town',A.towns,D.TOWN,names.TOWN);
  add('downtown',[A.downtown],D.DOWNTOWN,names.DOWNTOWN);
  add('urban',[A.urban],D.URBAN,names.URBAN);
  add('industrial',A.industrial,D.INDUSTRIAL,names.INDUSTRIAL);
  add('port',[A.port],D.PORT,names.PORT);
  geo.neighborhoods=areas;geo.neighborhoodAt=(x,y)=>at(geo,x,y);
  geo.gangAt=(x,y)=>gangAt(geo,x,y);
  geo.gangs=areas.filter(a=>a.gang).map(a=>a.gang);
 }
 function street(geo,road,index=0){
  if(!road.pts?.length)return '';
  const points=road.pts,middle=points[Math.floor(points.length/2)],area=at(geo,middle[0],middle[1]);
  const endA=points[0],endB=points[points.length-1],dx=endB[0]-endA[0],dy=endB[1]-endA[1];
  const dir=Math.abs(dx)>Math.abs(dy)?1:2;
  const coordinate=dir===1?middle[1]:middle[0];
  const bucket=Math.round(coordinate/55);
  const pool=area.d===COG.D.FAVELA||area.d===COG.D.GHETTO?roadBanks.latin:area.type==='town'?roadBanks.us:roadBanks.common;
  const seed=hash(bucket,area.x+area.y,geo.seed+dir*997);
  if(road.cls==='highway')return 'Freeway '+(10+seed%90);
  if(road.cls==='rail')return 'Linha Ferroviária';
  const pick=pool[seed%pool.length];
  return road.cls==='avenue'&&!/Avenue|Boulevard|Calle/.test(pick)?pick.replace(/Street|Road|Drive|Lane|Way/g,'Avenue'):pick;
 }
 const segDist=(px,py,ax,ay,bx,by)=>{
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(px-ax-t*dx,py-ay-t*dy);
 };
 function roadNear(roads,x,y){
  let best=1e6,rd=null;
  for(const road of roads||[]){
   if(!road.pts?.length||road.cls==='rail')continue;
   const points=road.pts;
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],p1=Array.isArray(a)?a:[a.x,a.y],p2=Array.isArray(b)?b:[b.x,b.y];
    const d=segDist(x,y,p1[0],p1[1],p2[0],p2[1]);
    if(d<best){best=d;rd=road;}
   }
  }
  return best<55?rd:null;
 }
 function location(geo,roads,x,y){
  const hood=at(geo,x,y),streetRoad=roadNear(roads,x,y);
  return {neighborhood:hood.name,street:streetRoad?.streetName||streetRoad?.name||'',gang:gangAt(geo,x,y)};
 }
 // Cached map painting. The territory mask follows actual zoning, not circular markers.
 function overlay(g,world,S,scale){
  const geo=world.geo;if(!geo?.gangs?.length)return;
  g.save();
  const step=geo.C;
  const region=geo.neighborhoods.filter(n=>n.gang);
  for(const n of region){
   const side=Math.ceil(n.r*1.25/step);
   g.fillStyle=n.gang.color;g.globalAlpha=.13;
   for(let j=-side;j<=side;j++)for(let i=-side;i<=side;i++){
    const x=Math.floor(n.x/step)*step+i*step,y=Math.floor(n.y/step)*step+j*step;
    const gang=gangAt(geo,x+step/2,y+step/2);
    if(gang?.id!==n.gang.id)continue;
    const p=S(x,y),a=Math.max(step*scale,0.3);
    g.fillRect(p[0],p[1],a+.35,a+.35);
   }
   g.globalAlpha=.72;
   const [cx,cy]=S(n.x,n.y);
   g.strokeStyle=n.gang.color;g.lineWidth=1.7;g.setLineDash([5,6]);
   g.beginPath();g.ellipse(cx,cy,n.r*scale,n.r*scale,0,0,Math.PI*2);g.stroke();g.setLineDash([]);
  }
  g.restore();
 }
 function mapLabels(g,world,S,scale,dpr=1){
  const geo=world.geo;if(!geo)return;
  g.save();g.textAlign='center';g.textBaseline='middle';
  const areas=geo.neighborhoods||[];
  for(const a of areas){
   const [x,y]=S(a.x,a.y);
   if(x<-160||y<-30||x>g.canvas.width+160||y>g.canvas.height+30)continue;
   const size=Math.max(10,Math.min(16,a.gang?12:13))*dpr;
   g.font='800 '+size+'px system-ui';g.lineWidth=3.7*dpr;g.strokeStyle='#0c1625db';
   g.strokeText(a.name.toUpperCase(),x,y);g.fillStyle=a.gang?'#f3f9fe':'#f3f9ff';
   g.fillText(a.name.toUpperCase(),x,y);
   if(a.gang){
    g.font='700 '+(10*dpr)+'px system-ui';g.strokeText('● '+a.gang.name,x,y+15*dpr);
    g.fillStyle=a.gang.color;g.fillText('● '+a.gang.name,x,y+15*dpr);
   }
  }
  if(scale>=.22){
   let shown=0;const occupied=[];
   for(const rd of world.roads||[]){
    if(!rd.streetName||rd.cls==='rail'||rd.pts.length<2)continue;
    const a=rd.pts[0],b=rd.pts[rd.pts.length-1],m=rd.pts[Math.floor(rd.pts.length/2)],p=S(m[0],m[1]);
    if(p[0]<65||p[0]>g.canvas.width-65||p[1]<85||p[1]>g.canvas.height-52)continue;
    if(occupied.some(o=>Math.hypot(o[0]-p[0],o[1]-p[1])<100))continue;
    occupied.push(p);shown++;if(shown>45)break;
    const angle=Math.atan2(b[1]-a[1],b[0]-a[0]),flip=Math.cos(angle)<0?angle+Math.PI:angle;
    g.save();g.translate(p[0],p[1]);g.rotate(flip);g.font='700 10px system-ui';
    g.strokeStyle='#eff8ff';g.lineWidth=2.5;g.strokeText(rd.streetName,0,0);
    g.fillStyle='#354960';g.fillText(rd.streetName,0,0);g.restore();
   }
  }
  g.restore();
 }
 COG.decorateNeighborhoods=register;
 COG.streetNameForRoad=street;
 COG.locationAt=location;
 COG.drawTerritoryOverlay=overlay;
 COG.drawLocationLabels=mapLabels;
 COG.hashDistrict=hash;
})(typeof globalThis!=='undefined'?globalThis:this);
