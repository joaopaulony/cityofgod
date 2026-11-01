// Public campuses are planned globally before streaming, so adjacent sectors cannot occupy them.
(function(G){
 const C=G.COG;
 C.CIVIC_TYPES=[
  {kind:'hospital',name:'Hospital City of God',floors:3,color:'#e7eeeb',reserved:'AMBULÂNCIA',spaces:3},
  {kind:'police',name:'Delegacia Central',floors:2,color:'#cdd9e1',reserved:'VIATURA',spaces:3},
  {kind:'military',name:'Batalhão da Cidade',floors:2,color:'#bac3af',reserved:'EXÉRCITO',spaces:4},
  {kind:'cityhall',name:'Prefeitura Municipal',floors:3,color:'#f0e8d5',reserved:'SERVIÇO',spaces:2},
  {kind:'school',name:'Escola Municipal',floors:2,color:'#e8d6b4',reserved:'ESCOLAR',spaces:2},
  // três concessionárias City Motors: centro, bairro residencial e a cidade vizinha
  // Central Logística: empregos de entregador, taxista e gari (frota no pátio)
  {kind:'depot',id:'civic-depot',name:'Central Logística City',floors:1,floorHeight:4.4,color:'#e8e4da',reserved:'FROTA',spaces:0,target:A=>({x:A.urban.x+180,y:A.urban.y+220})},
  {kind:'dealer',id:'civic-dealer-centro',name:'City Motors · Centro',floors:1,floorHeight:4.4,color:'#eef1f3',reserved:'TEST DRIVE',spaces:0,target:A=>({x:A.downtown.x+300,y:A.downtown.y+140})},
  {kind:'dealer',id:'civic-dealer-bairro',name:'City Motors · Zona Norte',floors:1,floorHeight:4.4,color:'#eef1f3',reserved:'TEST DRIVE',spaces:0,target:A=>({x:A.urban.x-420,y:A.urban.y-260})},
  {kind:'dealer',id:'civic-dealer-cidade',name:'City Motors · Litoral',floors:1,floorHeight:4.4,color:'#eef1f3',reserved:'TEST DRIVE',spaces:0,target:A=>A.towns?.[0]?{x:A.towns[0].x+60,y:A.towns[0].y+40}:{x:A.urban.x+520,y:A.urban.y+300}}
 ];
 C.planCivicSites=function(cw,roadDist,water,reserved=[]){
  const sites=[],A=cw.geo.anchors;
  for(const [index,type] of C.CIVIC_TYPES.entries()){
   const landmark=type.target?null:cw.landmarks.find(l=>l.kind===type.kind),target=type.target?type.target(A):landmark||{x:A.urban.x+(index-2)*170,y:A.urban.y-300};
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
   Object.assign(site,type,{id:type.id||'civic-'+type.kind});delete site.target;sites.push(site);
   if(landmark)Object.assign(landmark,{x:site.x,y:site.y-40,r:30});else cw.landmarks.push({name:type.name,kind:type.kind,x:site.x,y:site.y-40,r:30});
  }
  return sites;
 };
})(globalThis);

function civicPlaceSector(S){
 for(const site of world.civicSites||[]){
  const x=site.x,y=site.y-44;if(x<S.bounds[0]||x>=S.bounds[2]||y<S.bounds[1]||y>=S.bounds[3])continue;
  const fh=site.floorHeight||3.3;
  const H=addHouse({x0:x-23,y0:y-18,x1:x+23,y1:y+18,h:site.floors*fh,nFloors:site.floors,floorHeight:fh,seed:owSeed(S,site.id),roofKind:'flat',frontSide:'S',open:{S:{door:[19]}},civic:true,miaKind:site.kind,bName:site.name});
  H.style={...H.style,plaster:site.color};remodelProperty(H);H.walk=[H.doorPt,[H.doorPt[0],site.y+3]];
  const bb=[x-25,site.y-25,x+25,site.y+2];world.paved.push(bb);
  world.decals.push({kind:'civic-parking',bb,site,paint(g){
   g.fillStyle='#52595c';g.fillRect(bb[0],bb[1],50,27);g.strokeStyle='#e4dfcc';g.lineWidth=.1;
   for(const side of [-1,1])for(let i=0;i<6;i++){const sx=x+side*(6+i*3),sy=site.y-19;g.strokeRect(sx-1.3,sy,2.6,side<0?8.4:5.5);
    if(side<0&&(site.kind==='police'?(i===0||i===2||i===4):site.kind==='military'?i<site.spaces:i===0)){g.fillStyle=site.kind==='hospital'?'#4e9ba0':'#607c9b';g.fillRect(sx-1.1,sy+.2,2.2,7.9);g.save();g.translate(sx,sy+2.8);g.rotate(-Math.PI/2);g.font='bold .55px sans-serif';g.textAlign='center';g.fillStyle='#fff';g.fillText(site.reserved,0,0);g.restore();}
   }
   g.fillStyle='#ddd8c9';g.fillRect(H.doorPt[0]-2,H.doorPt[1],4,site.y+2-H.doorPt[1]);
  }});
  // The reserved left-side bays are persistent parking spaces belonging to
  // this procedurally placed campus. Start invisible/inert until the actual
  // licensed GLB is present; vehicle-webgl activates them once loaded.
  // Keys are stable across streamed sector unload/reload.
  const civicFleetBays={police:3,hospital:1,cityhall:1,school:1};
  const sizes={police:[5.6,2.55,1.85],hospital:[7.25,2.8,2.65],
    cityhall:[5.8,2.65,2.4],school:[8.25,2.85,3.0]};
  const count=civicFleetBays[site.kind]||0;
  for(let i=0;i<count;i++){
   const dims=sizes[site.kind];
   addBox({x:x-6-i*6,y:site.y-16.25,rot:Math.PI/2,
    w:dims[0],d:dims[1],h:dims[2],kind:'parkedcar',
    civicFleetBay:true,civicKind:site.kind,civicSiteId:site.id,civicBayIndex:i,
    vehicleKey:'civic:'+site.id+':'+i,modelId:null,
    fleetHidden:true,solid:true,street:true,
    col:'#f0f0f0',top:'#f0f0f0',side:'#f0f0f0',draw:drawParkedCar});
  }
  // The opposite row stays available for regular civilian parking.
  if(site.kind==='depot'){
   // frota da empresa no pátio (exposição; o veículo do turno é entregue na vaga de saída)
   const FLEET=[['minivan','#f4f4f2'],['minivan','#f4f4f2'],['minivan','#f4f4f2'],['sedan','#f1c40f'],['sedan','#f1c40f'],['pickup','#2e7d32'],['pickup','#2e7d32'],['minivan','#f4f4f2']];
   for(let i=0;i<8;i++){const [m,c]=FLEET[i],sx=i<4?x+7+i*3.2:x-8-(i-4)*3.2,b=addBox({x:sx,y:site.y-15.5,w:4.8,d:1.95,h:1.6,rot:Math.PI/2,kind:'parkedcar',modelId:m,col:c,top:c,side:c,display:true,solid:true,street:true,draw:drawParkedCar});b.vehicleKey='depot:'+i;}
   site.delivery={x:x+18,y:site.y-5,angle:Math.PI};
  }else if(site.kind==='dealer'){
   // pátio de seminovos: carros de verdade em exposição (não dá p/ entrar), virados p/ a rua; vaga de entrega do comprado
   const MODELS=['sedan','suv','hatchback','pickup','coupe','compact','wagon','offroad'],COLS=['#c0392b','#f2f2f0','#1d2b3a','#7f8c8d','#2c6e49','#e1b12c','#2f3640','#5d6d7e'];
   for(let i=0;i<8;i++){const sx=i<4?x+7+i*3.2:x-8-(i-4)*3.2,b=addBox({x:sx,y:site.y-15.5,w:4.6,d:1.9,h:1.5,rot:Math.PI/2,kind:'parkedcar',modelId:MODELS[i],col:COLS[i],top:COLS[i],side:COLS[i],display:true,solid:true,street:true,draw:drawParkedCar});b.vehicleKey='dealer:'+site.id+':'+i;}
   site.delivery={x:x+18,y:site.y-5,angle:Math.PI};
  }else for(let i=0;i<4;i++)miaCar(x+7+i*3,site.y-16,Math.PI/2);
  for(const dx of [-24,24]){world.lamps.push({x:x+dx,y:site.y-8,ax:0,ay:-1});}
  if(site.kind==='military'){
   const [x0,y0,x1,y1]=site.bb,gate=(px,py)=>py>y1-1&&Math.abs(px-H.doorPt[0])<4;
   for(const [a,b] of [[[x0,y0],[x1,y0]],[[x0,y0],[x0,y1]],[[x1,y0],[x1,y1]],[[x0,y1],[x1,y1]]])chainLine(...a,...b,gate,{h:2.3});
  }
  // Welcoming portico; city hall has a wider colonnade and a central raised crown.
  const portico=site.kind==='cityhall',width=portico?16:9;
  for(const dx of portico?[-8,-5,5,8]:[-4.5,4.5])addBox({x:H.doorPt[0]+dx,y:H.y1+3,w:.55,d:.55,h:portico?7:3.5,kind:'civic-column',top:site.color,side:site.color,house:H,exteriorFixture:true});
  addBox({x:H.doorPt[0],y:H.y1+1.8,w:width+1,d:4.5,h:.3,z:portico?7:3.5,kind:'civic-canopy',top:site.color,side:site.color,solid:false,house:H,exteriorFixture:true});
  if(portico)addBox({x,y:H.y0+6,w:12,d:8,h:1.1,z:H.h,kind:'civic-crown',top:'#d7cfb8',side:site.color,solid:false,house:H,exteriorFixture:true});
  owIndexOwnedLive(S);
 }
}
