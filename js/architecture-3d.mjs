import {makeKit} from './kit-3d.mjs';
import {propertyMaterials,metricUVs} from './architecture-materials.mjs';

// A streamed property is one exterior batch, one roof batch and a cutaway
// interior built only for its occupied floor. The exact same plan drives physics.
export function createArchitecture3D(THREE,scene,bridge,opts={}){
 const Kit=makeKit(THREE),entries=new Map(),builds=new Map();
 const state=window.cityArchitecture3D={ready:true,properties:0,meshes:0,triangles:0,pending:0,buildMs:0,errors:[],revision:1};
 const mats=propertyMaterials(THREE,opts.seeThrough);
 // Interior cutaway already exposes the player. Keep its floor, rails and
 // doors opaque instead of applying the vegetation's broad dither circle.
 const innerMats=Object.fromEntries(Object.entries(mats).map(([k,m])=>[k,m.clone()]));
 const palettes=[['#e8dec9','#8c9f9c'],['#d0dfd8','#f0e8d8'],['#edc8b5','#788c8b'],['#e5e1d7','#697b86'],['#d6d7bc','#b39168'],['#decfba','#806954']];
 function groups(kit,parent,materials=mats){
  for(const [name,geometry] of Object.entries(kit.done())){const mesh=new THREE.Mesh(metricUVs(THREE,geometry),materials[name]||materials.trim);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);}
 }
 const span=(k,a,b,lo,hi,width,color,set='wall')=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);if(L<.001||hi<=lo)return;
  const geo=new THREE.BoxGeometry(L,hi-lo,width);geo.rotateY(-Math.atan2(dy,dx));geo.translate((a[0]+b[0])/2,(lo+hi)/2,(a[1]+b[1])/2);k.raw(geo,color,set);
 };
 function quad(k,points,color,set='roof',uvScale=1){
  const position=[],uv=[];for(let i=1;i<points.length-1;i++)for(const v of [points[0],points[i],points[i+1]]){position.push(...v);uv.push(v[0]/uvScale,(v[2]+v[1])/uvScale);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();k.raw(g,color,set);
 }
 function buildWall(k,w,z,h,color,cut,doors,glass,style={},windows=[]){
  const dx=w.b[0]-w.a[0],dy=w.b[1]-w.a[1],L=Math.hypot(dx,dy),point=t=>[w.a[0]+dx*t/L,w.a[1]+dy*t/L];
  const box=(u0,u1,z0,z1,width,col,set)=>span(k,point(u0),point(u1),z+z0,z+z1,width,col,set);
  let cursor=0;
  for(const o of w.openings){
   const u=o.at-o.width/2,v=o.at+o.width/2,sill=o.sill||0,top=sill+o.height;
   box(cursor,u,0,h,.18,color,'wall');box(u,v,0,Math.min(sill,h),.18,color,'wall');box(u,v,top,h,.18,color,'wall');
   const trim='#f2ece0',zt=Math.min(top,h);
   if(sill<h){box(u-.045,u+.045,sill,zt,.24,trim,'trim');box(v-.045,v+.045,sill,zt,.24,trim,'trim');}
   if(top<h+.01)box(u-.08,v+.08,top,top+.07,.26,trim,'trim');
   if(o.kind==='window'&&top<=h+.01){
    box(u,v,sill,sill+.04,.29,trim,'trim');
    box(u+.05,v-.05,sill+o.height*.5,top-.05,.035,'#b6ccd2','glass');
    box(u,v,sill+o.height*.5-.025,sill+o.height*.5+.025,.09,trim,'trim');
    windows.push({opening:o,point:point(u),baseY:z+sill,angle:-Math.atan2(dy,dx)});
    if(w.ext&&!cut&&style.shutters){for(const [a,b] of [[u-.23,u-.07],[v+.07,v+.23]]){box(a,b,sill,top,.10,style.shutters,'wood');for(let y=sill+.08;y<top;y+=.13)box(a,b,y,y+.025,.13,'#566b60','trim');}}
    if(w.ext&&!cut&&style.bars){for(let x=u+.12;x<v-.04;x+=.17)box(x,x+.018,sill,top,.14,'#48504c','metal');box(u,v,sill+.45,sill+.47,.14,'#48504c','metal');}
    const sillFront=point(o.at);const nx=w.normal[0],ny=w.normal[1];
    span(k,[point(u)[0]+nx*.08,point(u)[1]+ny*.08],[point(v)[0]+nx*.08,point(v)[1]+ny*.08],z+sill-.07,z+sill,.3,'#c7c1b4','trim');
   }
   if(o.kind==='door'&&doors){const p=point(u),leaf=new THREE.Group();leaf.position.set(p[0],z,p[1]);leaf.rotation.y=-Math.atan2(dy,dx);
    const dk=Kit(),dh=Math.min(o.height,h);if(o.style==='glazed'){dk.box(0,0,-.03,.09,dh,.03,'#e8e1d2',0,'trim');dk.box(o.width-.09,0,-.03,o.width,dh,.03,'#e8e1d2',0,'trim');for(const yy of [0,dh-.1])dk.box(0,yy,-.03,o.width,yy+.1,.03,'#e8e1d2',0,'trim');dk.box(.09,.1,-.014,o.width-.09,dh-.1,.014,'#bdd4d8',0,'glass');}
    else dk.box(0,0,-.025,o.width,dh,.025,w.ext?'#657b74':'#c3ab89',.008,'wood');
    if(o.style==='roller')for(let y=.1;y<dh;y+=.19)dk.box(.04,y,-.04,o.width-.04,y+.025,.04,'#73817e',0,'metal');
    else if(dh>1&&o.style!=='glazed')for(const yy of [.32,1.15])dk.box(.1,yy,-.04,o.width-.1,Math.min(yy+.55,dh-.08),.04,'#b4a188',.008,'trim');
    dk.sph(o.width-.13,Math.min(1,dh*.65),.06,.035,'#c0a15d',1,'metal');groups(dk,leaf,cut?innerMats:mats);doors.push({object:leaf,opening:o,base:leaf.rotation.y,baseY:z});
   }
   cursor=v;
  }
  box(cursor,L,0,h,.18,color,'wall');
  box(0,L,0,.11,.205,cut?'#b9ac96':'#b7ab94','trim');
  if(style.stone){let start=0;for(const o of w.openings.filter(o=>o.kind==='door')){box(start,o.at-o.width/2,0,Math.min(h,.55),.215,'#e8e1d3','stone');start=o.at+o.width/2;}box(start,L,0,Math.min(h,.55),.215,'#e8e1d3','stone');}
  if(!cut){box(0,L,h-.10,h,.24,'#f0e9da','trim');}
  if(!cut&&style.rural)for(let y=.25;y<h-.15;y+=.26)box(0,L,y,y+.018,.192,'#b9a68b','trim');
 }
 const sashMatrix=new THREE.Object3D();
 function installSashes(windows,parent,glass,frameMaterial=mats.trim){
  if(!windows.length)return null;
  const k=Kit();k.box(.04,.05,-.024,.96,.95,.024,'#c1d6db',0,'glass');
  for(const x of [0,.95])k.box(x,0,-.05,x+.05,1,.05,'#eee8dc',0,'trim');
  for(const y of [0,.92])k.box(0,y,-.05,1,y+.08,.05,'#eee8dc',0,'trim');
  k.box(.4,.07,.05,.6,.10,.09,'#ad9a73',0,'trim');
  const meshes=[];for(const [name,g] of Object.entries(k.done())){
   const mesh=new THREE.InstancedMesh(g,name==='glass'?glass:frameMaterial,windows.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;parent.add(mesh);meshes.push(mesh);
  }
  const batch={windows,meshes,last:[]};updateSashes(batch);return batch;
 }
 function updateSashes(batch){
  if(!batch)return;let changed=false;
  batch.windows.forEach((w,i)=>{const o=w.opening,open=o.segment?.windowAnim?.open||0;if(batch.last[i]===open)return;batch.last[i]=open;changed=true;
   sashMatrix.position.set(w.point[0],w.baseY+open*o.height*.46,w.point[1]);sashMatrix.rotation.set(0,w.angle,0);sashMatrix.scale.set(o.width,o.height*.51,1);sashMatrix.updateMatrix();for(const mesh of batch.meshes)mesh.setMatrixAt(i,sashMatrix.matrix);
  });if(changed)for(const mesh of batch.meshes)mesh.instanceMatrix.needsUpdate=true;
 }
 function balcony(k,r,z,color){
  k.box(r.x0-.06,z-.18,r.y0,r.x1+.06,z-.04,r.y1+.06,'#d4d1c7',0,'concrete');
  k.box(r.x0,z-.04,r.y0,r.x1,z,r.y1,'#e6ded0',0,'tile');
  const edges=[[[r.x0,r.y0],[r.x0,r.y1]],[[r.x0,r.rear?r.y0:r.y1],[r.x1,r.rear?r.y0:r.y1]],[[r.x1,r.y1],[r.x1,r.y0]]];
  for(const [a,b] of edges){span(k,a,b,z+.98,z+1.04,.065,color,'metal');span(k,a,b,z+.12,z+.16,.04,color,'metal');
   const len=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(len/.14);for(let i=0;i<=steps;i++){const x=a[0]+(b[0]-a[0])*i/steps,y=a[1]+(b[1]-a[1])*i/steps;k.box(x-.012,z+.12,y-.012,x+.012,z+1,y+.012,color,0,'metal');}
  }
 }
 function roofServices(k,A,last,base){
  const hall=last.rooms.find(r=>r.id==='hall'),x=(hall.x0+hall.x1)/2,y=hall.y0+1.1,z=A.levels.length*A.floorHeight+.15;
  // Service pad, ribbed polyethylene reservoir, fitted lid and plumbing.
  // Its radius is bounded by the service wing, never floating on pitched tiles.
  const radius=Math.min(.64,(hall.x1-hall.x0)*.36),tankColor=A.palette%2?'#738c93':'#447b9b';
  k.box(x-radius-.12,z,hall.y0+.3,x+radius+.12,z+.16,hall.y0+1.9,base,0,'concrete');
  k.cyl(x,z+.16,y,radius*.87,z+1.22,tankColor,20,radius,'trim');
  for(const dz of [.25,.48,.72,.96])k.cyl(x,z+dz,y,radius*(.88+dz*.09)+.02,z+dz+.035,tankColor,20,undefined,'trim');
  k.cyl(x,z+1.22,y,radius*1.03,z+1.31,'#365f72',20,radius*.85,'trim');
  k.cyl(x,z+1.31,y,.13,z+1.35,'#365f72',12,undefined,'trim');
  k.cyl(x+radius+.08,z+.14,y,.035,z+1.07,'#d1d4cd',8,undefined,'trim');
  k.cylX(x+radius*.8,x+radius+.08,z+1.07,y,.035,'#d1d4cd',8,'trim');
  k.cyl(x-radius-.07,z+.12,y,.025,z+.4,'#d1d4cd',8,undefined,'trim');
  // Vent flue has a weather cap; commercial HVAC is a detailed machine.
  const vx=hall.x0+.25,vy=hall.y1-.65;k.cyl(vx,z,vy,.07,z+.65,'#9b9f98',10,undefined,'metal');k.cyl(vx,z+.62,vy,.16,z+.68,'#b0b5ac',12,.08,'metal');
  if(['office','airport','shop','deco'].includes(A.kind)){
   const r=last.rooms.find(r=>r.id==='rear-right'),cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2;
   // Low plinth with metal louvers, twin fans and a folded sheet-metal cap.
   k.box(cx-.7,z,cy-.45,cx+.7,z+.14,cy+.45,'#b9b8b0',0,'concrete');
   k.box(cx-.65,z+.14,cy-.4,cx+.65,z+.72,cy+.4,'#a4aaa6',.035,'metal');
   for(let yy=z+.24;yy<z+.67;yy+=.075)k.box(cx-.59,yy,cy+.405,cx+.59,yy+.025,cy+.43,'#4f5b59',0,'metal');
   for(const xx of [cx-.33,cx+.33]){k.cyl(xx,z+.73,cy,.23,z+.76,'#35403e',16,undefined,'metal');for(let d=-.16;d<=.16;d+=.08)k.box(xx+d-.012,z+.76,cy-.18,xx+d+.012,z+.78,cy+.18,'#adb3ae',0,'metal');}
  }
 }
 function roofWing(k,r,z,color,flat=false,gabled=false){
  const x0=r.x0-.16,x1=r.x1+.16,y0=r.y0-.16,y1=r.y1+.16;
  if(flat){k.box(x0,z,y0,x1,z+.14,y1,'#c7c8bf',0,'concrete');for(const [a,b] of [[[x0,y0],[x1,y0]],[[x1,y0],[x1,y1]],[[x1,y1],[x0,y1]],[[x0,y1],[x0,y0]]]){span(k,a,b,z+.12,z+.40,.15,'#d7d1c4','wall');span(k,a,b,z+.40,z+.45,.22,'#e8e2d6','concrete');}return;}
  const w=x1-x0,d=y1-y0,rise=Math.min(1.65,Math.min(w,d)*.4),inset=Math.min(w,d)*.45,along=w>=d;
  const end=gabled?0:inset,A=[x0,z,y0],B=[x1,z,y0],C=[x1,z,y1],D=[x0,z,y1],P=along?[x0+end,z+rise,(y0+y1)/2]:[(x0+x1)/2,z+rise,y0+end],Q=along?[x1-end,z+rise,(y0+y1)/2]:[(x0+x1)/2,z+rise,y1-end];
  for(const face of along?[[A,B,Q,P],[B,C,Q],[C,D,P,Q],[D,A,P]]:[[A,B,P],[B,C,Q,P],[C,D,Q],[D,A,P,Q]])quad(k,face,gabled&&face.length===3?'#e1d7c4':color,gabled&&face.length===3?'wall':'roof',1.5);
  for(const [a,b] of [[[x0,y0],[x1,y0]],[[x1,y0],[x1,y1]],[[x1,y1],[x0,y1]],[[x0,y1],[x0,y0]]])span(k,a,b,z-.07,z+.03,.11,'#e8dfcd','trim');
  // Fascia, soffit and gutters finish every eave; downpipes meet the ground.
  k.box(x0,z-.10,y0,x1,z-.075,y1,'#e1d9c8',0,'wood');
  for(const y of [y0,y1]){k.cylX(x0,x1,z-.015,y,.045,'#acb1a9',8,'metal');k.cyl(x0+.06,.08,y,.034,z,'#c4c8bd',8,undefined,'metal');}
  const ridge=new THREE.CylinderGeometry(.065,.065,Math.hypot(Q[0]-P[0],Q[2]-P[2])+.05,8);ridge.rotateZ(Math.PI/2);if(!along)ridge.rotateY(Math.PI/2);ridge.translate((P[0]+Q[0])/2,z+rise+.025,(P[2]+Q[2])/2);k.raw(ridge,color,'roof');
 }
 function wings(level){const hall=level.rooms.find(r=>r.id==='hall'),left=level.rooms.filter(r=>r.x1<=hall.x0+.01),right=level.rooms.filter(r=>r.x0>=hall.x1-.01);return[left,right,[hall]].map(list=>({x0:Math.min(...list.map(r=>r.x0)),y0:Math.min(...list.map(r=>r.y0)),x1:Math.max(...list.map(r=>r.x1)),y1:Math.max(...list.map(r=>r.y1))}));}
 function sign(H,e){
  const A=H.architecture,level=A.levels[0],r=level.rooms.find(r=>r.id==='front-left'),commercial=['shop','office','warehouse','airport','deco'].includes(A.kind);if(!commercial)return;
  const c=document.createElement('canvas');c.width=512;c.height=96;const g=c.getContext('2d');g.fillStyle=['#36554f','#314854','#795b46'][A.palette%3];g.fillRect(0,0,512,96);g.fillStyle='#faf2df';g.font='600 42px sans-serif';g.textAlign='center';g.textBaseline='middle';
  const label=A.kind==='shop'?(['CAFÉ PALM','MERCADO LOCAL','STUDIO MIAMI'][A.palette%3]):A.kind==='airport'?'AEROPORTO':A.kind==='warehouse'?'DADE SUPPLY':A.kind==='office'?(H.bName||'BISCAYNE OFFICES'):(H.hotelName||'PALM COURT');g.fillText(label,256,49,480);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;e.textures.push(tex);const material=new THREE.MeshStandardMaterial({map:tex,roughness:.8});e.materials.push(material);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(r.x1-r.x0-.3,5),.75),material);mesh.position.set((r.x0+r.x1)/2,2.65,r.y1+.12);e.exterior.add(mesh);
  // Slatted shop shade: real depth, alternating canvas stripes.
  if(A.kind==='shop'){const kit=Kit(),x0=r.x0+.2,x1=r.x1-.2;for(let x=x0,i=0;x<x1;x+=.38,i++)kit.box(x,2.42,r.y1,Math.min(x+.37,x1),2.49,Math.min(r.y1+.65,A.depth),i%2?'#eee7d5':'#698a81',0,'trim');groups(kit,e.exterior);}
 }
 function* build(H){
  const A=H.architecture,root=new THREE.Group(),exterior=new THREE.Group(),roof=new THREE.Group();root.add(exterior,roof);const p=A.toWorld(0,0);root.position.set(p[0],0,p[1]);root.rotation.y=-A.angle;
  const e={root,exterior,roof,interior:null,cutKey:null,doors:[],windows:[],materials:[],textures:[],H};
  const glass=mats.glass.clone();e.materials.push(glass);e.glass=glass;
  const materialSet={...mats,glass};const wallKit=Kit(),roofKit=Kit(),base=A.kind==='mansion'?'#eee8d9':H.style?.plaster||palettes[A.palette][0],accent=palettes[A.palette][1];
  for(const level of A.levels){
   if(level.floor&&level.setback>A.levels[level.floor-1].setback){const prev=A.levels[level.floor-1];
    for(const r of prev.rooms)wallKit.box(r.x0-.06,level.z-.12,r.y0-.06,r.x1+.06,level.z-.01,r.y1+.06,'#c9cbc2',0,'concrete');
    for(const w of prev.walls)if(w.ext){span(wallKit,w.a,w.b,level.z,level.z+.3,.15,base,'wall');span(wallKit,w.a,w.b,level.z+.3,level.z+.35,.23,'#e7e0d2','concrete');}
   }
   for(const w of level.walls)if(w.ext)buildWall(wallKit,w,level.z,A.floorHeight,base,false,e.doors,glass,{shutters:H.style?.shutters,bars:H.style?.bars,rural:A.kind==='rural',stone:level.floor===0&&['mansion','office','deco','shop'].includes(A.kind)},e.windows);
   for(const r of wings(level)){wallKit.box(r.x0-.08,level.z-.08,r.y0-.08,r.x1+.08,level.z+.02,r.y1+.08,level.floor?'#d5cbb8':'#b1a58d',0,'trim');}
   for(const r of level.outdoor)balcony(wallKit,r,level.z,accent);
   yield;
  }
  const last=A.levels.at(-1),flat=['office','shop','airport','deco','projects'].includes(A.kind)||A.kind==='house'&&A.palette===3;
  for(const [i,r] of wings(last).entries())roofWing(roofKit,r,A.levels.length*A.floorHeight,H.style?.roofCol||'#ae7153',flat||i===2||A.family==='garden-wing'&&i===1&&A.kind!=='warehouse',A.family==='cross-gable'||A.kind==='warehouse');
  if(A.kind==='deco'){const r=last.rooms.find(r=>r.id==='front-left'),cx=(r.x0+r.x1)/2,z=A.levels.length*A.floorHeight;for(let i=0;i<3;i++)roofKit.box(cx-1.4+i*.3,z+.2,r.y1-.1,cx+1.4-i*.3,z+.55+i*.26,r.y1+.08,i===2?accent:base,0,'trim');}
  roofServices(roofKit,A,last,base);
  // Entry recess stays inside the original envelope and is fully walkable.
  const hall=A.levels[0].rooms.find(r=>r.id==='hall'),x0=hall.x0+.08,x1=hall.x1-.08,y0=hall.y1,y1=A.depth-.05;
  wallKit.box(x0,-.08,y0,x1,0,y1,'#c8bfa9',0,'tile');
  if(y1-y0>.4){wallKit.box(x0,2.45,y0,x1,2.56,y1,'#d9cbb3',0,'wood');for(const x of [x0+.07,x1-.07])wallKit.box(x-.045,0,y1-.06,x+.045,2.45,y1+.03,accent,0,'trim');}
  groups(wallKit,exterior,materialSet);groups(roofKit,roof,materialSet);
  for(const d of e.doors)exterior.add(d.object);
  e.sashes=installSashes(e.windows,exterior,glass);
  sign(H,e);scene.add(root);return e;
 }
 function disposeGroup(g){if(!g)return;g.traverse(o=>{if(o.isMesh)o.geometry.dispose();});g.removeFromParent();}
 function interior(e,floor,key){
  disposeGroup(e.interior);e.interior=new THREE.Group();e.root.add(e.interior);e.cutKey=key;e.innerDoors=[];e.innerWindows=[];
  const A=e.H.architecture,level=A.levels[floor],kit=Kit();if(!level)return;
  const ca=bridge.cam.ang,Acos=Math.cos(A.angle),Asin=Math.sin(A.angle),camera=[Math.sin(ca)*Acos+Math.cos(ca)*Asin,-Math.sin(ca)*Asin+Math.cos(ca)*Acos];
  for(const r of level.rooms){const wet=['bathroom','kitchen','laundry','loading'].includes(r.use),use=wet?'tile':'wood';
   const slab=(x0,y0,x1,y1)=>{if(x1-x0>.01&&y1-y0>.01)kit.box(x0,level.z-.07,y0,x1,level.z-.005,y1,wet?'#deded1':A.palette%2?'#c0a582':'#d4bea0',0,use);};
   if(r.id==='hall'&&floor>0&&level.stair){const s=level.stair,x0=Math.max(r.x0,s.x-.51),x1=Math.min(r.x1,s.x+.51),y0=s.y-1.45,y1=s.y+1.45;slab(r.x0,r.y0,x0,r.y1);slab(x1,r.y0,r.x1,r.y1);slab(x0,r.y0,x1,y0);slab(x0,y1,x1,r.y1);}else slab(r.x0,r.y0,r.x1,r.y1);
  }
  for(const r of level.outdoor)balcony(kit,r,level.z,palettes[A.palette][1]);
  for(const w of level.walls){const facing=w.normal[0]*camera[0]+w.normal[1]*camera[1],h=w.ext?(facing>0?.55:A.floorHeight):.75;buildWall(kit,w,level.z,h,w.ext?'#e7e0d2':'#e5ddcc',true,e.innerDoors,e.glass,{},e.innerWindows);}
  const flight=base=>{const s=base.stair;for(let i=0;i<15;i++){const y=s.y+1.35-i*.18,z=base.z+(i+1)*A.floorHeight/15;kit.box(s.x-.45,base.z,y-.18,s.x+.45,z,y,'#b39b77',0,'wood');}for(const x of [s.x-.48,s.x+.48])for(let i=0;i<8;i++){const y=s.y+1.3-i*.36,z=base.z+i*A.floorHeight/8;kit.box(x-.02,z,y-.02,x+.02,z+.9,y+.02,'#ded3bf',0,'trim');}};
  if(level.stair&&floor<A.levels.length-1)flight(level);if(floor>0&&level.stair)flight(A.levels[floor-1]);
  groups(kit,e.interior,{...innerMats,glass:e.glass});for(const d of e.innerDoors)e.interior.add(d.object);e.innerSashes=installSashes(e.innerWindows,e.interior,e.glass,innerMats.trim);
 }
 function update(){
  const t0=performance.now(),c=bridge.cam,seen=new Set(),R=Math.min(135,Math.max(65,Math.hypot(c.W/(2*c.zoom),c.H/(2*c.zoom*(c.tilt||.5)))+22));let built=0,pending=0;
  const nearby=bridge.houses.filter(H=>H.architecture&&Math.hypot((H.x0+H.x1)/2-c.x,(H.y0+H.y1)/2-c.y)<R).sort((a,b)=>Math.hypot(a.x0-c.x,a.y0-c.y)-Math.hypot(b.x0-c.x,b.y0-c.y));
  for(const H of nearby){seen.add(H);let e=entries.get(H);if(!e){if(built||performance.now()-t0>8){pending++;continue;}try{
   let job=builds.get(H);if(!job){job=build(H);builds.set(H,job);}const progress=job.next();built++;
   if(!progress.done){pending++;continue;}e=progress.value;entries.set(H,e);builds.delete(H);
  }catch(error){builds.delete(H);state.errors.push(String(error));console.error('Architecture 3D',error);continue;}}
   const A=H.architecture,isInside=H.inside,floor=Math.min(A.levels.length-1,bridge.player.stairTravel?.to??bridge.player.floor??0);
   e.exterior.visible=e.roof.visible=!isInside;
   if(isInside){const key=floor+':'+Math.sign(Math.sin(c.ang-A.angle))+':'+Math.sign(Math.cos(c.ang-A.angle));if(e.cutKey!==key)interior(e,floor,key);e.interior.visible=true;}else if(e.interior)e.interior.visible=false;
   for(const d of [...e.doors,...(e.innerDoors||[])]){const open=d.opening.segment?.doorAnim?.open||0;if(d.opening.style==='roller')d.object.position.y=d.baseY+open*d.opening.height;else d.object.rotation.y=d.base+open*1.3;}
   updateSashes(e.sashes);if(e.interior?.visible)updateSashes(e.innerSashes);
   e.glass.emissive.set(bridge.world.night&&H.lightOn?'#dfba79':'#000000');e.glass.emissiveIntensity=.55;
  }
  for(const [H,e] of entries)if(!seen.has(H)){disposeGroup(e.root);for(const m of e.materials)m.dispose();for(const t of e.textures)t.dispose();entries.delete(H);}
  for(const [H,job] of builds)if(!seen.has(H)){job.return();builds.delete(H);}
  let meshes=0,triangles=0;for(const e of entries.values())e.root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
  Object.assign(state,{properties:entries.size,meshes,triangles,pending,buildMs:+(performance.now()-t0).toFixed(2)});
 }
 return{state,update};
}
