import {paintGangFacade} from './gang-graffiti.mjs';
import {makeKit} from './kit-3d.mjs';
import {propertyMaterials,metricUVs} from './architecture-materials.mjs';

// A streamed property is one exterior batch, one roof batch and a cutaway
// interior built only for its occupied floor. The exact same plan drives physics.
export function createArchitecture3D(THREE,scene,bridge,opts={}){
 const Kit=makeKit(THREE),entries=new Map(),builds=new Map();
 const state=window.cityArchitecture3D={ready:true,properties:0,meshes:0,triangles:0,pending:0,buildMs:0,errors:[],revision:1};
 const mats=propertyMaterials(THREE,opts.seeThrough);
 const civicLights=Array.from({length:4},()=>new THREE.PointLight(0xf0f4e9,0,24,2));
 // Pooled lighting: only the current occupied floor consumes dynamic lights.
 // Decorative ceiling fixtures use cheap BasicMaterial and no shadow maps.
 const homePointLights=Array.from({length:4},()=>new THREE.PointLight(0xffe1b5,0,9,1.55));
 const homeAmbient=new THREE.HemisphereLight(0xffe7c8,0x526477,0);
 scene.add(homeAmbient);scene.userData.homeLights=homePointLights;
 state.interiorFixtures=0;state.lightsActive=0;state.powered=false;
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
   if(top<h+.01)box(u-.08,v+.08,top-.012,top+.07,.26,trim,'trim');
   if(o.kind==='window'&&top<=h+.01){
    box(u-.012,v+.012,sill-.006,sill+.04,.29,trim,'trim');
    box(u+.05,v-.05,sill+o.height*.5,top-.05,.035,'#b6ccd2','glass');
    box(u,v,sill+o.height*.5-.025,sill+o.height*.5+.025,.09,trim,'trim');
    windows.push({opening:o,point:point(u),baseY:z+sill,angle:-Math.atan2(dy,dx)});
    if(style.commercial){
     const nx=w.normal[0],ny=w.normal[1];
     for(const at of [u-.12,v+.12]){const a=point(at);span(k,[a[0]+nx*.03,a[1]+ny*.03],[a[0]+nx*.30,a[1]+ny*.30],z+.1,z+h-.1,.055,style.commercial,'metal');}
     const a=point(u-.17),b=point(v+.17);span(k,[a[0]+nx*.17,a[1]+ny*.17],[b[0]+nx*.17,b[1]+ny*.17],z+top+.12,z+top+.19,.37,'#d9ded8','concrete');
    }
    if(w.ext&&!cut&&style.shutters){for(const [a,b] of [[u-.23,u-.07],[v+.07,v+.23]]){box(a,b,sill,top,.10,style.shutters,'wood');for(let y=sill+.08;y<top;y+=.13)box(a,b,y,y+.025,.13,'#566b60','trim');}}
    if(w.ext&&!cut&&style.bars){for(let x=u+.12;x<v-.04;x+=.17)box(x,x+.018,sill,top,.14,'#48504c','metal');box(u,v,sill+.45,sill+.47,.14,'#48504c','metal');}
    const sillFront=point(o.at);const nx=w.normal[0],ny=w.normal[1];
    span(k,[point(u)[0]+nx*.08,point(u)[1]+ny*.08],[point(v)[0]+nx*.08,point(v)[1]+ny*.08],z+sill-.07,z+sill-.008,.3,'#c7c1b4','trim');
   }
   if(o.kind==='door'&&doors){const p=point(u),leaf=new THREE.Group();leaf.position.set(p[0],z,p[1]);leaf.rotation.y=-Math.atan2(dy,dx);
    const dk=Kit(),dh=Math.min(o.height,h);if(o.style==='glazed'){dk.box(0,0,-.03,.09,dh,.03,'#e8e1d2',0,'trim');dk.box(o.width-.09,0,-.03,o.width,dh,.03,'#e8e1d2',0,'trim');for(const yy of [0,dh-.1])dk.box(0,yy,-.03,o.width,yy+.1,.03,'#e8e1d2',0,'trim');dk.box(.09,.1,-.014,o.width-.09,dh-.1,.014,'#bdd4d8',0,'glass');}
    else if(o.style==='bars'){for(let x=.03;x<o.width;x+=.13)dk.box(x,0,-.025,x+.025,dh,.025,'#46545b',0,'metal');for(const y of [.08,1,dh-.08])dk.box(0,y,-.03,o.width,y+.045,.03,'#46545b',0,'metal');}
    else dk.box(0,0,-.025,o.width,dh,.025,w.ext?'#657b74':'#c3ab89',.008,'wood');
    if(o.style==='roller')for(let y=.1;y<dh;y+=.19)dk.box(.04,y,-.04,o.width-.04,y+.025,.04,'#73817e',0,'metal');
    else if(dh>1&&o.style!=='glazed'&&o.style!=='bars')for(const yy of [.32,1.15])dk.box(.1,yy,-.04,o.width-.1,Math.min(yy+.55,dh-.08),.04,'#b4a188',.008,'trim');
    dk.sph(o.width-.13,Math.min(1,dh*.65),.06,.035,'#c0a15d',1,'metal');groups(dk,leaf,cut?innerMats:mats);doors.push({object:leaf,opening:o,base:leaf.rotation.y,baseY:z});
   }
   cursor=v;
  }
  box(cursor,L,0,h,.18,color,'wall');
  // rodapé contínuo, mas aberto no vão do portão da garagem
  {let start=0;for(const o of w.openings.filter(o=>o.kind==='garage')){box(start,o.at-o.width/2,0,.11,.205,cut?'#b9ac96':'#b7ab94','trim');start=o.at+o.width/2;}box(start,L,0,.11,.205,cut?'#b9ac96':'#b7ab94','trim');}
  if(style.stone){let start=0;for(const o of w.openings.filter(o=>o.kind==='door'||o.kind==='garage')){box(start,o.at-o.width/2,0,Math.min(h,.55),.215,'#e8e1d3','stone');start=o.at+o.width/2;}box(start,L,0,Math.min(h,.55),.215,'#e8e1d3','stone');}
  if(!cut){box(0,L,h-.10,h+.012,.24,'#f0e9da','trim');}   // acabamento do topo 1,2 cm acima da parede: as duas faces de cima não ficam no mesmo plano
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
   // plantas orgânicas não têm 'rear-right': usa o maior cômodo do último andar
   const r=last.rooms.find(r=>r.id==='rear-right')||last.rooms.reduce((a,b)=>(b.x1-b.x0)*(b.y1-b.y0)>(a.x1-a.x0)*(a.y1-a.y0)?b:a),cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2;
   // Low plinth with metal louvers, twin fans and a folded sheet-metal cap.
   k.box(cx-.7,z,cy-.45,cx+.7,z+.14,cy+.45,'#b9b8b0',0,'concrete');
   k.box(cx-.65,z+.14,cy-.4,cx+.65,z+.72,cy+.4,'#a4aaa6',.035,'metal');
   for(let yy=z+.24;yy<z+.67;yy+=.075)k.box(cx-.59,yy,cy+.405,cx+.59,yy+.025,cy+.43,'#4f5b59',0,'metal');
   for(const xx of [cx-.33,cx+.33]){k.cyl(xx,z+.73,cy,.23,z+.76,'#35403e',16,undefined,'metal');for(let d=-.16;d<=.16;d+=.08)k.box(xx+d-.012,z+.76,cy-.18,xx+d+.012,z+.78,cy+.18,'#adb3ae',0,'metal');}
  }
 }
 function roofWing(k,r,z,color,flat=false,gabled=false,gableColor='#e1d7c4'){
  const x0=r.x0-.16,x1=r.x1+.16,y0=r.y0-.16,y1=r.y1+.16;
  if(flat){k.box(x0,z,y0,x1,z+.14,y1,'#c7c8bf',0,'concrete');for(const [a,b] of [[[x0,y0],[x1,y0]],[[x1,y0],[x1,y1]],[[x1,y1],[x0,y1]],[[x0,y1],[x0,y0]]]){span(k,a,b,z+.12,z+.40,.15,'#d7d1c4','wall');span(k,a,b,z+.40,z+.45,.22,'#e8e2d6','concrete');}return;}
  const w=x1-x0,d=y1-y0,rise=Math.min(1.65,Math.min(w,d)*.4),inset=Math.min(w,d)*.45,along=w>=d;
  const end=gabled?0:inset,A=[x0,z,y0],B=[x1,z,y0],C=[x1,z,y1],D=[x0,z,y1],P=along?[x0+end,z+rise,(y0+y1)/2]:[(x0+x1)/2,z+rise,y0+end],Q=along?[x1-end,z+rise,(y0+y1)/2]:[(x0+x1)/2,z+rise,y1-end];
  for(const face of along?[[A,B,Q,P],[B,C,Q],[C,D,P,Q],[D,A,P]]:[[A,B,P],[B,C,Q,P],[C,D,Q],[D,A,P,Q]])quad(k,face,gabled&&face.length===3?gableColor:color,gabled&&face.length===3?'wall':'roof',1.5);
  for(const [a,b] of [[[x0,y0],[x1,y0]],[[x1,y0],[x1,y1]],[[x1,y1],[x0,y1]],[[x0,y1],[x0,y0]]])span(k,a,b,z-.07,z+.03,.11,'#e8dfcd','trim');
  // Fascia, soffit and gutters finish every eave; downpipes meet the ground.
  k.box(x0,z-.10,y0,x1,z-.075,y1,'#e1d9c8',0,'wood');
  for(const y of [y0,y1]){k.cylX(x0,x1,z-.015,y,.045,'#acb1a9',8,'metal');k.cyl(x0+.06,.08,y,.034,z,'#c4c8bd',8,undefined,'metal');}
  const ridge=new THREE.CylinderGeometry(.065,.065,Math.hypot(Q[0]-P[0],Q[2]-P[2])+.05,8);ridge.rotateZ(Math.PI/2);if(!along)ridge.rotateY(Math.PI/2);ridge.translate((P[0]+Q[0])/2,z+rise+.025,(P[2]+Q[2])/2);k.raw(ridge,color,'roof');
 }
 // Garagem anexa (garages.js): ala do mesmo plano, com as mesmas paredes, rodapé, frisos, venezianas e grade da
 // casa, telhado de duas águas com a empena virada p/ a rua (calha, testeira e cumeeira iguais), portão
 // basculante seccionado, arandelas, e por dentro estante, bancada de ferramentas e luminária.
 function buildGarage(wk,rk,e,H,base,accent,flat){
  const g=H.garage,A=H.architecture,{x0,x1,y0,y1,h,cu}=g,dw=g.doorW,dh=g.doorH,mansion=A.kind==='mansion',outerL=g.side==='L';
  const style={shutters:H.style?.shutters,bars:H.style?.bars,stone:mansion};
  const front={a:[x0,y1],b:[x1,y1],normal:[0,1],ext:true,openings:[{kind:'garage',at:cu-x0,width:dw,height:dh}]};
  const back={a:[x1,y0],b:[x0,y0],normal:[0,-1],ext:true,openings:[]};
  const outer=outerL?{a:[x0,y0],b:[x0,y1],normal:[-1,0],ext:true,openings:[{kind:'window',at:(y1-y0)*.5,width:.95,sill:1.3,height:.7}]}
   :{a:[x1,y1],b:[x1,y0],normal:[1,0],ext:true,openings:[{kind:'window',at:(y1-y0)*.5,width:.95,sill:1.3,height:.7}]};
  const inner=outerL?{a:[x1,y1],b:[x1,y0],normal:[1,0],ext:true,openings:[]}:{a:[x0,y0],b:[x0,y1],normal:[-1,0],ext:true,openings:[]};
  for(const w of [front,back,outer,inner])buildWall(wk,w,0,h,base,false,null,e.glass,style,e.windows);
  // soleira de concreto rente ao portão e friso de topo como o da casa
  wk.box(cu-dw/2-.05,-.02,y1-.12,cu+dw/2+.05,.03,y1+.16,'#c9c3b6',0,'concrete');
  // telhado: duas águas, empena (na cor da casa) sobre o portão; laje com platibanda quando a casa é de laje
  roofWing(rk,{x0,y0,x1,y1},h,H.style?.roofCol||'#ae7153',flat,true,base);
  // arandelas dos dois lados do portão (vidro acende à noite junto com as janelas)
  for(const sx of [cu-dw/2-.38,cu+dw/2+.38]){wk.box(sx-.08,1.95,y1+.09,sx+.08,2.25,y1+.13,'#2f3336',.01,'metal');wk.box(sx-.06,1.98,y1+.13,sx+.06,2.2,y1+.21,'#f3dfb0',.01,'glass');wk.box(sx-.08,2.2,y1+.09,sx+.08,2.25,y1+.23,'#2f3336',0,'metal');}
  // número da casa
  wk.box(cu+dw/2+.2,1.5,y1+.09,cu+dw/2+.55,1.62,y1+.11,'#e9e3d4',0,'trim');
  /* Garagem privada vazia: sem armários ou equipamentos construídos para não proprietários.
  // dentro: estante de aço com caixas, bancada com ferramentas, luminária tubular, régua de tomadas
  const ix0=x0+.18,ix1=x1-.18,iy0=y0+.18;
  const sx0=outerL?ix0:ix1-.48,sx1=sx0+.48;
  for(const yy of [.02,.62,1.22,1.82])wk.box(sx0,yy,iy0+.4,sx1,yy+.035,iy0+2.2,'#7f868c',0,'metal');
  for(const xx of [sx0,sx1-.04])for(const zz of [iy0+.4,iy0+2.16])wk.box(xx,0,zz,xx+.04,1.9,zz+.04,'#5f666b',0,'metal');
  const R=(q=>()=>(q=(q*16807)%2147483647)/2147483647)(Math.abs(H.seed|0)%2147483646+1);
  for(const yy of [.055,.655,1.255])for(let zz=iy0+.5;zz<iy0+2.05;zz+=.42)if(R()<.8){const bh=.2+R()*.3;wk.box(sx0+.04,yy,zz,sx1-.04,yy+bh,zz+.34,['#b58b5c','#a67c4f','#c39b6b','#3c6fa8','#c23b33'][(R()*5)|0],.006,'wood');}
  const bx0=outerL?ix1-.6:ix0,bx1=bx0+.6;
  wk.box(bx0,.88,y0+.25,bx1,.93,y0+1.95,'#8a6748',.008,'wood');for(const zz of [y0+.3,y0+1.85])for(const xx of [bx0+.04,bx1-.08])wk.box(xx,0,zz,xx+.04,.88,zz+.04,'#4b5156',0,'metal');
  wk.box(outerL?ix1-.03:ix0,1.1,y0+.25,outerL?ix1:ix0+.03,1.9,y0+1.95,'#c9b38f',0,'wood');   // painel perfurado de ferramentas
  for(let zz=y0+.4;zz<y0+1.9;zz+=.28)wk.box(outerL?ix1-.07:ix0+.03,1.3+R()*.35,zz,outerL?ix1-.03:ix0+.07,1.55+R()*.2,zz+.05,'#3a3f44',0,'metal');
  wk.box(cu-.6,h-.12,(y0+y1)/2-.06,cu+.6,h-.06,(y0+y1)/2+.06,'#f4f1e8',0,'glass');
  */
  // portão: quatro seções com almofadas em relevo; a de cima com visores em algumas casas; pivô no alto (basculante)
  const door=new THREE.Group();door.position.set(cu,dh,y1-.05);
  const dk=Kit(),col=A.palette%3===0?accent:'#f1ede4',secs=4,sh=dh/secs,cols=Math.max(4,Math.round(dw/.62)),pw=dw/cols,lites=(H.seed>>3)%2===0;
  for(let i=0;i<secs;i++){const yb=-dh+i*sh;
   dk.box(-dw/2,yb+.006,-.025,dw/2,yb+sh-.006,.018,col,.006,'trim');
   for(let c=0;c<cols;c++){const xa=-dw/2+c*pw+.06,xb2=-dw/2+(c+1)*pw-.06;
    if(i===secs-1&&lites)dk.box(xa,yb+.1,.012,xb2,yb+sh-.1,.024,'#a9c2cb',0,'glass');
    else dk.box(xa,yb+.09,.018,xb2,yb+sh-.09,.03,col,.01,'trim');}
  }
  dk.box(-dw/2,-dh,-.03,dw/2,-dh+.04,.03,'#26292b',0,'metal');
  dk.box(-.18,-dh+.32,.018,.18,-dh+.36,.05,'#9aa0a3',.008,'metal');
  for(const sx of [-dw/2-.03,dw/2-.012])dk.box(sx,-dh,-.4,sx+.042,0,-.03,'#8c9296',0,'metal');
  groups(dk,door);e.exterior.add(door);e.garageDoor={object:door,g};
 }
 function wings(level){if(level.masses)return level.masses.map(m=>({...m}));const hall=level.rooms.find(r=>r.id==='hall'),left=level.rooms.filter(r=>r.x1<=hall.x0+.01),right=level.rooms.filter(r=>r.x0>=hall.x1-.01);return[left,right,[hall]].map(list=>({x0:Math.min(...list.map(r=>r.x0)),y0:Math.min(...list.map(r=>r.y0)),x1:Math.max(...list.map(r=>r.x1)),y1:Math.max(...list.map(r=>r.y1))}));}
 function sign(H,e){
  const A=H.architecture,level=A.levels[0],r=level.rooms.find(r=>r.id==='front-left'),commercial=H.civic||['shop','office','warehouse','airport','deco'].includes(A.kind);if(!commercial)return;
  const c=document.createElement('canvas');c.width=512;c.height=96;const g=c.getContext('2d');g.fillStyle=['#36554f','#314854','#795b46'][A.palette%3];g.fillRect(0,0,512,96);g.fillStyle='#faf2df';g.font='600 42px sans-serif';g.textAlign='center';g.textBaseline='middle';
  const label=H.civic?H.bName:A.kind==='shop'?(['CAFÉ PALM','MERCADO LOCAL','STUDIO MIAMI'][A.palette%3]):A.kind==='airport'?'AEROPORTO':A.kind==='warehouse'?'DADE SUPPLY':A.kind==='office'?(H.bName||'BISCAYNE OFFICES'):(H.hotelName||'PALM COURT');g.fillText(label,256,49,480);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;e.textures.push(tex);const material=new THREE.MeshStandardMaterial({map:tex,roughness:.8});e.materials.push(material);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(r.x1-r.x0-.3,5),.75),material);mesh.position.set((r.x0+r.x1)/2,2.65,r.y1+.12);e.exterior.add(mesh);
 }
 function* build(H){
  const A=H.architecture,root=new THREE.Group(),exterior=new THREE.Group(),roof=new THREE.Group();root.add(exterior,roof);const p=A.toWorld(0,0);root.position.set(p[0],0,p[1]);root.rotation.y=-A.angle;
  const e={root,exterior,roof,interior:null,cutKey:null,doors:[],windows:[],materials:[],textures:[],
   roomFixtures:[],lampMaterials:[],H};
  const glass=mats.glass.clone();opts.seeThrough?.(glass);e.materials.push(glass);e.glass=glass;
  const materialSet={...mats,glass};const wallKit=Kit(),roofKit=Kit(),base=A.kind==='mansion'?'#eee8d9':A.kind==='office'?['#d8e0dc','#d1dbdf','#ddd9d0'][A.palette%3]:H.style?.plaster||palettes[A.palette][0],accent=palettes[A.palette][1];
  for(const level of A.levels){
   if(level.floor&&(level.setback>A.levels[level.floor-1].setback||level.wingRecess>A.levels[level.floor-1].wingRecess)){const prev=A.levels[level.floor-1];
    for(const r of prev.rooms)wallKit.box(r.x0-.06,level.z-.12,r.y0-.06,r.x1+.06,level.z-.01,r.y1+.06,'#c9cbc2',0,'concrete');
    for(const w of prev.walls)if(w.ext){span(wallKit,w.a,w.b,level.z,level.z+.3,.15,base,'wall');span(wallKit,w.a,w.b,level.z+.3,level.z+.35,.23,'#e7e0d2','concrete');}
   }
   for(const w of level.walls)if(w.ext)buildWall(wallKit,w,level.z,A.floorHeight,A.kind==='office'&&w.rooms.includes('hall')?'#718c8b':base,false,e.doors,glass,{shutters:A.kind==='office'?null:H.style?.shutters,bars:H.style?.bars,rural:A.kind==='rural',commercial:A.kind==='office'?'#6d8586':null,stone:level.floor===0&&['mansion','office','deco','shop'].includes(A.kind)},e.windows);
   for(const r of wings(level)){wallKit.box(r.x0-.08,level.z-.08,r.y0-.08,r.x1+.08,level.z+.02,r.y1+.08,level.floor?'#d5cbb8':'#b1a58d',0,'trim');}
   for(const r of level.outdoor)balcony(wallKit,r,level.z,accent);
   yield;
  }
  const last=A.levels.at(-1),flat=H.civic||['office','shop','airport','deco','projects'].includes(A.kind)||A.kind==='house'&&A.palette===3;
  const organic=A.family==='organic';   // gerador novo: massa principal com quatro águas, anexos (L, cozinha avançada) com empena
  for(const [i,r] of wings(last).entries())roofWing(roofKit,r,A.levels.length*A.floorHeight,H.style?.roofCol||'#ae7153',flat||!organic&&(i===2||A.family==='garden-wing'&&i===1&&A.kind!=='warehouse'),organic?i>0:A.family==='cross-gable'||A.kind==='warehouse');
  if(A.kind==='deco'){const r=last.rooms.find(r=>r.id==='front-left')||last.rooms.filter(r=>r.id!=='hall').sort((a,b)=>b.y1-a.y1)[0],cx=(r.x0+r.x1)/2,z=A.levels.length*A.floorHeight;for(let i=0;i<3;i++)roofKit.box(cx-1.4+i*.3,z+.2,r.y1-.1,cx+1.4-i*.3,z+.55+i*.26,r.y1+.08,i===2?accent:base,0,'trim');}
  roofServices(roofKit,A,last,base);
  if(H.civic){
   const cx=A.levels[0].entry[0],front=A.depth,grand=A.kind==='cityhall';
   // sem pórtico, marquise ou colunas na entrada (pedido do jogador); a prefeitura mantém o coroamento no telhado
   if(grand){roofKit.box(cx-6,H.h,4,cx+6,H.h+.65,12,base,0,'stone');roofKit.box(cx-6.2,H.h+.65,3.8,cx+6.2,H.h+.82,12.2,'#ece5d4',0,'concrete');}
   if(A.kind==='hospital'){wallKit.box(2,2,front+.13,4,2.5,front+.25,'#d64e4e',0,'trim');wallKit.box(2.75,1.25,front+.13,3.25,3.25,front+.25,'#d64e4e',0,'trim');}
   if(A.kind==='school')for(let x=2;x<A.width-2;x+=3)wallKit.box(x,3.1,front+.1,x+2.5,3.45,front+.22,x%2?'#587fa4':'#e2b55f',0,'trim');
  }
  if(H.garage)buildGarage(wallKit,roofKit,e,H,base,accent,flat);
  // Entry recess stays inside the original envelope and is fully walkable.
  const hall=A.levels[0].rooms.find(r=>r.id==='hall'),x0=hall.x0+.08,x1=hall.x1-.08,y0=hall.y1,y1=A.depth-.05;
  wallKit.box(x0,-.08,y0,x1,0,y1,'#c8bfa9',0,'tile');
  // sem forro de madeira nem postes quadrados no recuo da porta (pedido do jogador)
  groups(wallKit,exterior,materialSet);groups(roofKit,roof,materialSet);
  paintGangFacade(THREE,H,A,exterior);
  for(const d of e.doors)exterior.add(d.object);
  e.sashes=installSashes(e.windows,exterior,glass);
  sign(H,e);scene.add(root);return e;
 }
 function disposeGroup(g){if(!g)return;g.traverse(o=>{if(o.isMesh)o.geometry.dispose();});g.removeFromParent();}
 // Hospital City of God: piso vinílico por setor e faixa teal + rodapé nas paredes (interrompidos em portas e janelas)
 const HOSPITAL_FLOOR={trauma:'#cfe0dd',surgery:'#cde3e0',icu:'#d2e1e4',reception:'#e4e1d6',cafe:'#e8dfcd',lounge:'#e3dccd',circulation:'#d2dcd8',
  bathroom:'#dfe6e6',pharmacy:'#e5e7e0',lab:'#dce5e9',xray:'#d8dee7',maternity:'#f0e3e6',recovery:'#e1ebe6',ward:'#e1ebe6',nurses:'#dde6e1',office:'#e6e1d6',clinic:'#e0e9e6'};
 // Delegacia Central: cinza-azulado com faixa azul-marinho; piso de granitina por setor
 const POLICE_FLOOR={holding:'#bfc3c4',interrogation:'#c9ccce',evidence:'#cfd1cf',lobby:'#d9d6cc',bullpen:'#c8cdd2',records:'#d2d0c8',dispatch:'#bfc6cf',
  briefing:'#cdd1d6',armory:'#b9bcbb',lockers:'#cfd3d4',chief:'#a88a6a',break:'#ddd6c8',office:'#cdd2d6',bathroom:'#dfe3e3',circulation:'#c9ced1'};
 const CIVIC_STYLE={hospital:{floor:{...HOSPITAL_FLOOR,default:'#dfe6e2'},wall:['#e9f1ee','#e2eeea'],band:'#3f8f8a',base:'#8fb0aa'},
  police:{floor:{...POLICE_FLOOR,default:'#cdd2d6'},wall:['#e6e9ee','#dde3ea'],band:'#24406b',base:'#4f5d70'},
  depot:{floor:{dispatch:'#dfe2e4',storehouse:'#9ea4a8',office:'#d7d2c8',lockers:'#d6dadc',bathroom:'#e1e5e6',circulation:'#d9dde0',default:'#dfe3e6'},wall:['#f1efe9','#ebe8e1'],band:'#e1a100',base:'#3b4045'},
  dealer:{floor:{showroom:'#eceff1',workshop:'#8f969c',sales:'#d7d2c8',lounge:'#e2ddd2',bathroom:'#e1e5e6',circulation:'#d9dde0',default:'#dfe3e6'},wall:['#f4f5f6','#eceeef'],band:'#2b3036',base:'#2b3036'}};
 function civicBand(kit,w,z,h,style){
  const dx=w.b[0]-w.a[0],dy=w.b[1]-w.a[1],L=Math.hypot(dx,dy);if(L<.3)return;
  const P=t=>[w.a[0]+dx*t/L,w.a[1]+dy*t/L],seg=(t0,t1)=>{if(t1-t0<.08)return;
   span(kit,P(t0),P(t1),z+.84,z+Math.min(h,.98),.205,style.band,'trim');span(kit,P(t0),P(t1),z,z+.11,.205,style.base,'trim');};
  let s=0;for(const o of [...w.openings].sort((a,b)=>a.at-b.at)){const a=o.at-o.width/2-.06,b=o.at+o.width/2+.06;seg(s,Math.max(s,a));s=Math.max(s,b);}seg(s,L);
 }
 // caixa (planta) do lance, p/ o vão do piso
 const stairBox=(s,pad=0)=>{const ax=s.axis==='x',hu=1.38+pad,hv=(s.w||.92)/2+.05+pad;return ax?[s.x-hu,s.y-hv,s.x+hu,s.y+hv]:[s.x-hv,s.y-hu,s.x+hv,s.y+hu];};
 function interior(e,floor,key){
  for(const m of e.lampMaterials||[])m.dispose();
  disposeGroup(e.interior);e.interior=new THREE.Group();e.root.add(e.interior);e.cutKey=key;
  e.innerDoors=[];e.innerWindows=[];e.roomFixtures=[];e.lampMaterials=[];
  const A=e.H.architecture,level=A.levels[floor],kit=Kit();if(!level)return;
  const custom=typeof CityHomePlus!=='undefined'&&window.CityHome?.owned(e.H);
  const ca=bridge.cam.ang,Acos=Math.cos(A.angle),Asin=Math.sin(A.angle),camera=[Math.sin(ca)*Acos+Math.cos(ca)*Asin,-Math.sin(ca)*Asin+Math.cos(ca)*Acos];
  for(const r of level.rooms){const wet=['bathroom','kitchen','laundry','loading'].includes(r.use),use=wet?'tile':'wood';
   const finish=custom?CityHomePlus.surface(e.H,floor,r.id):null;
   const slab=(x0,y0,x1,y1)=>{if(x1-x0>.01&&y1-y0>.01)kit.box(x0,level.z-.07,y0,x1,level.z-.005,y1,
     finish?.floor|| (CIVIC_STYLE[A.kind]?CIVIC_STYLE[A.kind].floor[r.use]||CIVIC_STYLE[A.kind].floor.default:e.H.civic?'#d9e0dc':wet?'#deded1':A.palette%2?'#c0a582':'#d4bea0'),
     0,finish?.material|| (e.H.civic?'tile':use));};
   const hole=floor>0&&A.levels[floor-1]?.stair?stairBox(A.levels[floor-1].stair,.01):null;
   if(hole&&hole[0]<r.x1&&hole[2]>r.x0&&hole[1]<r.y1&&hole[3]>r.y0){const x0=Math.max(r.x0,hole[0]),x1=Math.min(r.x1,hole[2]),y0=Math.max(r.y0,hole[1]),y1=Math.min(r.y1,hole[3]);slab(r.x0,r.y0,x0,r.y1);slab(x1,r.y0,r.x1,r.y1);slab(x0,r.y0,x1,y0);slab(x0,y1,x1,r.y1);}
   else slab(r.x0,r.y0,r.x1,r.y1);
  }
  for(const r of level.outdoor)balcony(kit,r,level.z,palettes[A.palette][1]);
  for(const w of level.walls){
    const facing=w.normal[0]*camera[0]+w.normal[1]*camera[1],h=w.ext?(facing>0?.55:A.floorHeight):.75;
    const roomId=(w.rooms||[]).find(id=>level.rooms.some(r=>r.id===id))||level.rooms[0]?.id;
    const color=custom&&roomId?CityHomePlus.surface(e.H,floor,roomId)?.wall:null;
    buildWall(kit,w,level.z,h,color||(CIVIC_STYLE[A.kind]?CIVIC_STYLE[A.kind].wall[w.ext?0:1]:w.ext?'#e7e0d2':'#e5ddcc'),true,e.innerDoors,e.glass,{},e.innerWindows);
    if(CIVIC_STYLE[A.kind]&&h>.7)civicBand(kit,w,level.z,Math.min(h,1.05),CIVIC_STYLE[A.kind]);
  }
  // escada: degraus de madeira com bocel e espelho claro, vigas laterais inclinadas, montantes de metal, corrimão
  // inclinado com pilaretes no pé e no topo; no andar de cima, guarda-corpo em volta do vão (aberto só no topo)
  const beam=(a,b,w,h,color,set,round=false)=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=Math.hypot(dx,dy,dz);if(L<.01)return;
   const g=round?new THREE.CylinderGeometry(w,w,L,10).rotateX(Math.PI/2):new THREE.BoxGeometry(w,h,L);
   g.applyMatrix4(new THREE.Matrix4().lookAt(new THREE.Vector3(b[0],b[1],b[2]),new THREE.Vector3(a[0],a[1],a[2]),new THREE.Vector3(0,1,0)));
   g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);kit.raw(g,color,set);};
  const WOOD='#b88a5c',RISER='#efe9de',STEEL='#2f3439',RAIL='#5a3c28';
  // pt(s,u,v): ponto da planta a u m ao longo do lance (+u = pé) e v m de lado; caixas alinhadas pelos dois cantos
  const pt=(s,u,v)=>s.axis==='x'?[s.x+u,s.y+v]:[s.x+v,s.y+u];
  const sbox=(s,u0,u1,v0,v1,y0,y1,color,r,set)=>{const a=pt(s,u0,v0),b=pt(s,u1,v1);kit.box(Math.min(a[0],b[0]),y0,Math.min(a[1],b[1]),Math.max(a[0],b[0]),y1,Math.max(a[1],b[1]),color,r,set);};
  const flight=base=>{const s=base.stair,dir=s.dir||1,n=15,H=A.floorHeight,du=2.7/n,rise=H/n,hw=(s.w||.92)/2,ub=1.35*dir,U=i=>ub-dir*i*du;
   for(let i=0;i<n;i++){const a=U(i),b=U(i+1),z=base.z+(i+1)*rise;
    sbox(s,a+.025*dir,b,-hw+.03,hw-.03,z-.045,z,WOOD,.008,'wood');                                    // piso do degrau com bocel
    sbox(s,a,a-.025*dir,-hw+.05,hw-.05,z-rise,z-.045,RISER,0,'trim');}                               // espelho
   for(const v of [-hw+.02,hw-.02]){const P0=pt(s,ub+dir*.04,v),P1=pt(s,U(n),v);beam([P0[0],base.z-.02,P0[1]],[P1[0],base.z+H-.05,P1[1]],.06,.3,STEEL,'metal');   // viga lateral
    for(let i=1;i<n;i+=2){const z=base.z+(i+1)*rise,m=(U(i)+U(i+1))/2;sbox(s,m-.012,m+.012,v-.012,v+.012,z,z+.88,STEEL,0,'metal');}   // montantes
    const R0=pt(s,U(0),v),R1=pt(s,U(n),v);beam([R0[0],base.z+rise+.92,R0[1]],[R1[0],base.z+H+.92,R1[1]],.028,0,RAIL,'wood',true);   // corrimão
    sbox(s,ub-.045,ub+.045,v-.045,v+.045,base.z,base.z+1.02,RAIL,.01,'wood');const N=pt(s,ub,v);kit.sph(N[0],base.z+1.05,N[1],.05,RAIL,1,'wood');   // pilarete do pé
   }};
  // guarda-corpo do vão: laterais e a borda de baixo; aberto onde o lance chega
  const guard=below=>{const s=below.stair,w=(s.w||.92)/2+.05,ub=1.38*s.dir,ut=-1.38*s.dir,z=level.z;
   const rail=(a,b)=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]),k=Math.max(1,Math.round(L/.45));for(let i=0;i<=k;i++){const x=a[0]+(b[0]-a[0])*i/k,y=a[1]+(b[1]-a[1])*i/k;kit.box(x-.012,z,y-.012,x+.012,z+1,y+.012,STEEL,0,'metal');}
    beam([a[0],z+1,a[1]],[b[0],z+1,b[1]],.03,0,RAIL,'wood',true);beam([a[0],z+.5,a[1]],[b[0],z+.5,b[1]],.015,0,STEEL,'metal',true);
    kit.box(Math.min(a[0],b[0])-.03,z,Math.min(a[1],b[1])-.03,Math.max(a[0],b[0])+.03,z+.1,Math.max(a[1],b[1])+.03,RISER,0,'trim');};
   rail(pt(s,ub,-w),pt(s,ut,-w));rail(pt(s,ub,w),pt(s,ut,w));rail(pt(s,ub,-w),pt(s,ub,w));};
  if(level.stair&&floor<A.levels.length-1)flight(level);if(floor>0&&A.levels[floor-1]?.stair){flight(A.levels[floor-1]);guard(A.levels[floor-1]);}
  groups(kit,e.interior,{...innerMats,glass:e.glass});for(const d of e.innerDoors)e.interior.add(d.object);e.innerSashes=installSashes(e.innerWindows,e.interior,e.glass,innerMats.trim);
  // Procedural, real 3D ceiling lamps for EVERY residential room. No external assets,
  // no opaque ceiling plane that would hide the player in the cutaway view.
  if(!e.H.civic)for(const room of level.rooms){
    if(room.x1-room.x0<1||room.y1-room.y0<1)continue;
    const cx=(room.x0+room.x1)/2,cy=(room.y0+room.y1)/2;
    const root=new THREE.Group();
    root.position.set(cx,level.z+A.floorHeight-.12,cy);
    const metal=new THREE.MeshStandardMaterial({color:0x847d73,metalness:.55,roughness:.48});
    const diffuser=new THREE.MeshBasicMaterial({color:0xffe8bb,toneMapped:false});
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.019,.019,.28,8),metal);
    stem.position.y=-.12;root.add(stem);
    const shade=new THREE.Mesh(new THREE.CylinderGeometry(.17,.235,.15,14),metal);
    shade.position.y=-.29;root.add(shade);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),diffuser);
    bulb.position.y=-.385;bulb.scale.y=.57;root.add(bulb);
    e.interior.add(root);e.lampMaterials.push(metal,diffuser);
    e.roomFixtures.push({root,bulb,roomId:room.id,floor,px:cx,py:cy,
      world:e.H.architecture.toWorld(cx,cy)});
  }
 }
 let statsDirty=true;
 function update(){
  const t0=performance.now(),c=bridge.cam,seen=new Set(),R=Math.min(135,Math.max(65,Math.hypot(c.W/(2*c.zoom),c.H/(2*c.zoom*(c.tilt||.5)))+22));let built=0,pending=0;
  const nearby=bridge.houses.filter(H=>H.architecture&&Math.hypot((H.x0+H.x1)/2-c.x,(H.y0+H.y1)/2-c.y)<R).sort((a,b)=>Math.hypot(a.x0-c.x,a.y0-c.y)-Math.hypot(b.x0-c.x,b.y0-c.y));
  for(const H of nearby){seen.add(H);let e=entries.get(H);if(!e){if(built||performance.now()-t0>8){pending++;continue;}try{
   let job=builds.get(H);if(!job){job=build(H);builds.set(H,job);}const progress=job.next();built++;
   if(!progress.done){pending++;continue;}e=progress.value;entries.set(H,e);builds.delete(H);statsDirty=true;
  }catch(error){builds.delete(H);state.errors.push(String(error));console.error('Architecture 3D',error);continue;}}
   const A=H.architecture,isInside=H.inside,floor=Math.min(A.levels.length-1,bridge.player.stairTravel?.to??bridge.player.floor??0);
   e.exterior.visible=e.roof.visible=!isInside;
   if(isInside){const key=floor+':'+Math.sign(Math.sin(c.ang-A.angle))+':'+Math.sign(Math.cos(c.ang-A.angle))+':'+(H.homeFinishVersion||0)+':'+(A.stairRev||0);if(e.cutKey!==key)interior(e,floor,key);e.interior.visible=true;}else if(e.interior)e.interior.visible=false;
   for(const d of [...e.doors,...(e.innerDoors||[])]){const open=d.opening.segment?.doorAnim?.open||0;if(d.opening.style==='roller')d.object.position.y=d.baseY+open*d.opening.height;else d.object.rotation.y=d.base+open*1.3;}
   if(e.garageDoor){const o=e.garageDoor.g.seg?.doorAnim?.open||0,d=e.garageDoor.object;d.rotation.x=o*1.5;d.position.z=e.garageDoor.g.y1-.05-o*.18;}
   updateSashes(e.sashes);if(e.interior?.visible)updateSashes(e.innerSashes);
   e.glass.emissive.set(bridge.world.night&&H.lightOn?'#dfba79':'#000000');e.glass.emissiveIntensity=.55;
   e.glass.envMapIntensity=bridge.world.night?.10:.75;
  }
  const far=H=>Math.hypot((H.x0+H.x1)/2-c.x,(H.y0+H.y1)/2-c.y)>R+40;
  for(const [H,e] of entries)if(!seen.has(H)&&(far(H)||!bridge.houses.includes(H))){statsDirty=true;disposeGroup(e.root);for(const m of e.materials)m.dispose();for(const m of e.lampMaterials)m.dispose();for(const t of e.textures)t.dispose();entries.delete(H);}
  for(const [H,job] of builds)if(!seen.has(H)&&far(H)){job.return();builds.delete(H);}
  // Electrical circuit is shared with the physical wall switch and F7 controls.
  // Base ceiling fixtures are present automatically; paid upgrades change color
  // and brightness. Only 4 nearest fixtures use PointLights to bound GPU cost.
  const playerHome=bridge.houses.find(H=>H.inside&&H.architecture&&!H.civic);
  const powered=!!playerHome&&(window.CityHomePlus&&window.CityHome?.owned(playerHome)?
    CityHomePlus.powerOn(playerHome):playerHome.lightOn!==false);
  const occupiedEntry=playerHome&&entries.get(playerHome);
  const fixtures=occupiedEntry?.interior?.visible?occupiedEntry.roomFixtures:[];
  const options=playerHome&&window.CityHomePlus?.data?.(playerHome).lights||[];
  const level=playerHome?.architecture?.levels?.[bridge.player.floor||0];
  const candidates=[];
  for(const f of fixtures){
    const custom=options.find(l=>l.floor===f.floor&&l.roomId===f.roomId);
    const mode=custom?.mode||'warm',color=window.CityHomePlus?.color?.[mode]||'#ffe4b5';
    f.bulb.material.color.set(powered?color:'#55565b');
    if(powered){
      const d=Math.hypot(bridge.player.x-f.world[0],bridge.player.y-f.world[1]);
      candidates.push({f,custom,color,d});
    }
  }
  candidates.sort((a,b)=>a.d-b.d);
  const nearest=candidates.slice(0,homePointLights.length);
  homePointLights.forEach((L,i)=>{
    const o=nearest[i];
    if(!o){if(L.parent)scene.remove(L);L.intensity=0;return;}
    if(!L.parent)scene.add(L);
    L.color.set(o.color);
    L.position.set(o.f.world[0],(level?.z||0)+playerHome.architecture.floorHeight-.65,o.f.world[1]);
    L.intensity=(bridge.world.night?22:10)*(o.custom?.intensity||1);
  });
  homeAmbient.intensity=powered?(bridge.world.night?1.1:.42):0;
  for(const [name,mat] of Object.entries(innerMats))if(name!=='glass'&&mat.emissive){
    mat.emissive.set(powered?'#3c3228':'#000000');
    mat.emissiveIntensity=powered?.24:0;
  }
  state.interiorFixtures=fixtures.length;
  state.lightsActive=nearest.length;
  state.powered=powered;
  const occupied=bridge.houses.find(H=>H.civic&&H.inside&&H.lightOn),lit=occupied?.architecture.levels[bridge.player.floor||0];
  civicLights.forEach((light,i)=>{light.intensity=lit?(bridge.world.night?75:35):0;if(lit&&lit.rooms[i]){if(!light.parent)scene.add(light);const room=lit.rooms[i],p=occupied.architecture.toWorld((room.x0+room.x1)/2,(room.y0+room.y1)/2);light.position.set(p[0],lit.z+2.8,p[1]);}else scene.remove(light);});
  if(statsDirty){statsDirty=false;let meshes=0,triangles=0;for(const e of entries.values())e.root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});Object.assign(state,{meshes,triangles});}
  Object.assign(state,{properties:entries.size,pending,buildMs:+(performance.now()-t0).toFixed(2)});
 }
 return{state,update};
}
