// Graffiti on world-space THREE planes; wall-space slots never intersect windows or doors.
// Five reusable painted tags per gang, textures cached and lazily created (no per-building canvas).
const atlas=new Map();
function artTexture(THREE,gang,variant){
 const key=gang.id+':'+variant;if(atlas.has(key))return atlas.get(key);
 const c=document.createElement('canvas');c.width=512;c.height=256;
 const g=c.getContext('2d');
 let seed=(variant+17)*1031+gang.name.length*911;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 const label=gang.art[variant%gang.art.length],base=gang.color;
 // Paint only shapes; transparent canvas leaves the original facade exposed.
 g.clearRect(0,0,512,256);g.lineJoin='round';g.textAlign='center';g.textBaseline='middle';
 for(let i=0;i<84;i++){
  const x=55+rnd()*410,y=31+rnd()*180,r=1+rnd()*7;
  g.globalAlpha=.14+rnd()*.3;g.fillStyle=i%3===0?'#fff':base;g.beginPath();g.ellipse(x,y,r,r*(.5+rnd()*.9),rnd()*4,0,Math.PI*2);g.fill();
 }
 g.globalAlpha=.9;
 for(let i=0;i<10;i++){
  const x=70+rnd()*375,y=100+rnd()*110;
  g.strokeStyle=base;g.globalAlpha=.18+rnd()*.22;g.lineWidth=2+rnd()*6;g.beginPath();
  g.moveTo(x,y);g.bezierCurveTo(x+4,y+25,x-8,y+45,x+2,y+60+rnd()*50);g.stroke();
 }
 g.globalAlpha=1;
 g.save();g.translate(255,118);g.rotate((rnd()-.5)*.14);
 const fs=label.length>14?38:label.length>10?48:label.length>7?62:78;
 g.font='1000 italic '+fs+'px Impact, "Arial Black",sans-serif';
 const width=Math.min(430,g.measureText(label).width+10);
 g.scale(Math.min(1,435/width),1);
 for(const [line,col,w] of [[9,'#12151b',16],[5,'#fff9dc',10],[0,base,5]]){
  g.lineWidth=w;g.strokeStyle=col;g.strokeText(label,0,line);
 }
 g.fillStyle=base;g.fillText(label,0,0);
 g.globalAlpha=.6;g.font='800 22px system-ui';g.fillStyle='#fff';g.fillText(gang.tag+'  /  '+gang.motto,0,66);
 g.restore();
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 tex.anisotropy=2;tex.generateMipmaps=true;tex.needsUpdate=true;
 const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.055,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide,toneMapped:false});
 const value={tex,mat};atlas.set(key,value);return value;
}
// Pure slot-finder. A margin is kept around every opening, independently of sill height.
export function freeWallSpans(wall,margin=.42,verticalBand=null){
 const dx=wall.b[0]-wall.a[0],dy=wall.b[1]-wall.a[1],L=Math.hypot(dx,dy);
 if(L<=margin*2)return [];
 const openings=(wall.openings||[]).filter(o=>
   !verticalBand || (((o.sill??0)+(o.height??2.2))>verticalBand[0] && (o.sill??0)<verticalBand[1])
 ).map(o=>[o.at-o.width/2-.38,o.at+o.width/2+.38]).sort((a,b)=>a[0]-b[0]);
 const spans=[];let cursor=margin;
 for(const [a,b] of openings){if(a-cursor>=2.4)spans.push([cursor,a]);cursor=Math.max(cursor,b);}
 if(L-margin-cursor>=2.4)spans.push([cursor,L-margin]);
 return spans;
}
export function paintGangFacade(THREE,H,architecture,parent){
 const geo=window.cityVehicleBridge?.geo || (typeof OW!=='undefined'?OW.geo:null);
 if(!geo?.gangAt || !architecture?.levels?.length)return 0;
 if(H.miaKind!=='projects'&&H.miaKind!=='poor'&&!H.poor)return 0;
 const gang=geo.gangAt((H.x0+H.x1)/2,(H.y0+H.y1)/2);
 if(!gang)return 0;
 const walls=architecture.levels[0]?.walls||[],seed=Math.abs((H.seed||0)|0);
 let count=0;
 for(let wi=0;wi<walls.length;wi++){
  const wall=walls[wi];if(!wall.ext||count>=2)continue;
  const dx=wall.b[0]-wall.a[0],dy=wall.b[1]-wall.a[1],L=Math.hypot(dx,dy);
  if(L<3)continue;
  // Primeiro uma peça grande entre aberturas. Se não couber, usar tag
  // baixa abaixo de janelas com peitoril elevado; portas seguem proibidas.
  const bands=[[.48,1.83],[.25,.79]];
  let best=null,band=null;
  for(const option of bands){
    const spans=freeWallSpans(wall,.42,option);
    const slot=spans.reduce((a,b)=>!a||b[1]-b[0]>a[1]-a[0]?b:a,null);
    if(slot&&slot[1]-slot[0]>=2.35){best=slot;band=option;break;}
  }
  if(!best)continue;
  // Favor the side facing the road and avoid carpet-bombing all four sides.
  if(wi>0 && (seed+wi)%3!==0)continue;
  const width=Math.min(3.9,best[1]-best[0]-.14);
  if(width<2.15)continue;
  const d=(best[0]+best[1])/2,mx=wall.a[0]+dx/L*d,my=wall.a[1]+dy/L*d;
  const normal=wall.normal||[dy/L,-dx/L];
  const variant=(seed+wi*17)%5,material=artTexture(THREE,gang,variant).mat;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,band[1]-band[0]),material);
  mesh.position.set(mx+normal[0]*.125,(band[0]+band[1])/2,my+normal[1]*.125);
  mesh.rotation.y=Math.atan2(normal[0],normal[1]);
  mesh.renderOrder=3;mesh.frustumCulled=true;mesh.castShadow=false;mesh.receiveShadow=false;
  mesh.userData.gangArt={gang:gang.id,variant,width,wall:wi};
  parent.add(mesh);count++;
 }
 return count;
}
