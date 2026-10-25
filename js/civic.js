// Public campuses are planned globally before streaming, so adjacent sectors cannot occupy them.
(function(G){
 const C=G.COG;
 C.CIVIC_TYPES=[
  {kind:'hospital',name:'Hospital Geral',floors:3,color:'#e7eeeb',reserved:'AMBULÂNCIA',spaces:3},
  {kind:'police',name:'Delegacia Central',floors:2,color:'#cdd9e1',reserved:'VIATURA',spaces:3},
  {kind:'military',name:'Batalhão da Cidade',floors:2,color:'#bac3af',reserved:'EXÉRCITO',spaces:4},
  {kind:'cityhall',name:'Prefeitura Municipal',floors:3,color:'#f0e8d5',reserved:'SERVIÇO',spaces:2},
  {kind:'school',name:'Escola Municipal',floors:2,color:'#e8d6b4',reserved:'ESCOLAR',spaces:2}
 ];
 C.planCivicSites=function(cw,roadDist,water,reserved=[]){
  const sites=[],A=cw.geo.anchors;
  for(const [index,type] of C.CIVIC_TYPES.entries()){
   const landmark=cw.landmarks.find(l=>l.kind===type.kind),target=landmark||{x:A.urban.x+(index-2)*170,y:A.urban.y-300};
   const choices=[];
   for(const rd of cw.roads){if(['highway','rail'].includes(rd.cls))continue;
    for(let i=1;i<rd.pts.length;i+=3){const a=rd.pts[i-1],b=rd.pts[i];if(Math.abs(a[1]-b[1])>.05)continue;
     const x=a[0],y=a[1]-rd.w/2-3,bb=[x-27,y-64,x+27,y];choices.push({x,y,bb,score:Math.hypot(x-target.x,y-target.y)});
    }
   }
   choices.sort((a,b)=>a.score-b.score);
   const site=choices.find(q=>{
    const b=q.bb;if([...reserved,...sites.map(s=>s.bb)].some(r=>b[0]<r[2]+10&&b[2]>r[0]-10&&b[1]<r[3]+10&&b[3]>r[1]-10))return false;
    for(let y=b[1];y<=b[3];y+=4)for(let x=b[0];x<=b[2];x+=4)if(water(x,y)<1.4||roadDist(x,y)<6)return false;
    return true;
   });
   if(!site)throw Error('No accessible campus for '+type.kind);
   Object.assign(site,type,{id:'civic-'+type.kind});sites.push(site);
   if(landmark)Object.assign(landmark,{x:site.x,y:site.y-40,r:30});else cw.landmarks.push({name:type.name,kind:type.kind,x:site.x,y:site.y-40,r:30});
  }
  return sites;
 };
})(globalThis);

function civicPlaceSector(S){
 for(const site of world.civicSites||[]){
  const x=site.x,y=site.y-44;if(x<S.bounds[0]||x>=S.bounds[2]||y<S.bounds[1]||y>=S.bounds[3])continue;
  const H=addHouse({x0:x-19,y0:y-16,x1:x+19,y1:y+16,h:site.floors*3.3,nFloors:site.floors,floorHeight:3.3,seed:owSeed(S,site.id),roofKind:'flat',frontSide:'S',open:{S:{door:[19]}},civic:true,miaKind:site.kind,bName:site.name});
  H.style={...H.style,plaster:site.color};remodelProperty(H);H.walk=[H.doorPt,[H.doorPt[0],site.y+3]];
  const bb=[x-25,site.y-25,x+25,site.y+2];world.paved.push(bb);
  world.decals.push({kind:'civic-parking',bb,site,paint(g){
   g.fillStyle='#52595c';g.fillRect(bb[0],bb[1],50,27);g.strokeStyle='#e4dfcc';g.lineWidth=.1;
   for(const side of [-1,1])for(let i=0;i<6;i++){const sx=x+side*(6+i*3),sy=site.y-19;g.strokeRect(sx-1.3,sy,2.6,5.5);
    if(side<0&&i<site.spaces){g.fillStyle=site.kind==='hospital'?'#4e9ba0':'#607c9b';g.fillRect(sx-1.1,sy+.2,2.2,5.1);g.save();g.translate(sx,sy+2.8);g.rotate(-Math.PI/2);g.font='bold .55px sans-serif';g.textAlign='center';g.fillStyle='#fff';g.fillText(site.reserved,0,0);g.restore();}
   }
   g.fillStyle='#ddd8c9';g.fillRect(H.doorPt[0]-2,H.doorPt[1],4,site.y+2-H.doorPt[1]);
  }});
  // Dedicated bays remain empty for future emergency/service vehicles.
  for(let i=0;i<4;i++)miaCar(x+7+i*3,site.y-16,Math.PI/2);
  for(const dx of [-24,24]){world.lamps.push({x:x+dx,y:site.y-8,ax:0,ay:-1});}
  // Welcoming portico; city hall has a wider colonnade and a central raised crown.
  const portico=site.kind==='cityhall',width=portico?16:9;
  for(const dx of portico?[-8,-5,5,8]:[-4.5,4.5])addBox({x:H.doorPt[0]+dx,y:H.y1+3,w:.55,d:.55,h:portico?7:3.5,kind:'civic-column',top:site.color,side:site.color,house:H,exteriorFixture:true});
  addBox({x:H.doorPt[0],y:H.y1+1.8,w:width+1,d:4.5,h:.3,z:portico?7:3.5,kind:'civic-canopy',top:site.color,side:site.color,solid:false,house:H,exteriorFixture:true});
  if(portico)addBox({x,y:H.y0+6,w:12,d:8,h:1.1,z:H.h,kind:'civic-crown',top:'#d7cfb8',side:site.color,solid:false,house:H,exteriorFixture:true});
  owIndexOwnedLive(S);
 }
}
