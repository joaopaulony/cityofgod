// Oclusores invisiveis da camada WebGL sobre os sprites 2D originais.
// Depth-only geometry deixa o GLB atras de postes, arvores e personagens
// quando necessario, sem rasterizar/screenshot do carro ou do cenario.
export function createWorldOccluders(scene,THREE,bridge,material){
 const groups=[],dynamic=[],buckets=new Map(),
  state={objects:0,actors:0,lamps:0,signals:0,bins:0,trees:0,bushes:0};
 const make=(geo,x,y,z,scale=null,live=false)=>{
  const m=live?new THREE.Mesh(geo,material):new THREE.Object3D();
  m.position.set(x,y,z);
  if(scale)m.scale.set(...scale);
  if(live){m.frustumCulled=false;scene.add(m);groups.push(m);}
  else {
   const key=geo.uuid;
   if(!buckets.has(key))buckets.set(key,{geo,objects:[]});
   buckets.get(key).objects.push(m);
  }
  state.objects++;
  return m;
 };
 const cube=new THREE.BoxGeometry(1,1,1);
 const cylinder=new THREE.CylinderGeometry(1,1,1,6);
 const sphere=new THREE.SphereGeometry(1,9,6);
 function beam(ax,ay,az,bx,by,bz,r=.055){
  const A=new THREE.Vector3(ax,ay,az),B=new THREE.Vector3(bx,by,bz);
  const dir=new THREE.Vector3().subVectors(B,A);
  const mesh=make(cylinder,(ax+bx)/2,(ay+by)/2,(az+bz)/2,
   [r,dir.length(),r]);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),
   dir.normalize());
  return mesh;
 }
 // Postes de rua: haste de 4,1m e braco de 1,1m, igual drawLamp().
 for(const l of bridge.world.lamps||[]){
  beam(l.x,0,l.y,l.x,4.1,l.y,.065);
  beam(l.x,4.1,l.y,l.x+l.ax*1.1,4.1,l.y+l.ay*1.1,.06);
  make(cube,l.x+l.ax*1.1,4.05,l.y+l.ay*1.1,[.24,.10,.20]);
  state.lamps++;
 }
 // Mesma geometria fisica do Canvas: poste em L transversal a rua,
 // cabeca suspensa ao centro da pista, e placa do pedestre na coluna.
 for(const l of bridge.world.trafficSignals||[]){
  const tx=l.x+l.ix*l.armSpan,tz=l.y+l.iy*l.armSpan;
  const face={x:-l.ax,y:-l.ay};
  beam(l.x,0,l.y,l.x,l.poleHeight,l.y,.073);
  beam(l.x,l.armHeight,l.y,tx,l.armHeight,tz,.061);
  beam(tx,l.armHeight,tz,tx,l.headHeight+.6,tz,.045);
  for(const fraction of [.53,1]){
   const hx=l.x+l.ix*l.armSpan*fraction,
    hz=l.y+l.iy*l.armSpan*fraction;
   beam(hx,l.armHeight,hz,hx,l.headHeight+.65,hz,.043);
   const head=make(cube,hx,l.headHeight,hz,[.48,1.21,.25]);
   head.rotation.y=Math.atan2(face.x,face.y);
  }
  const ped=make(cube,l.x,2.4,l.y,[.55,.68,.25]);
  ped.rotation.y=Math.atan2(-l.ix,-l.iy);
  state.signals++;
 }
 for(const b of bridge.urbanBins||[]){
  make(cube,b.x,.49,b.y,[.60,.98,.58]);
  state.bins++;
 }
 // Copas e troncos sao aproximacoes de profundidade; o sprite original
 // continua sendo desenhado pelo jogo e nunca vira uma textura 3D.
 for(const p of bridge.world.props||[]){
  if(p.type==='tree'){
   const ht=p.sp?.trunkH||2.8,r=p.sp?.r||1.6;
   make(cylinder,p.x,ht*.48,p.y,[.16,ht*.96,.16]);
   make(sphere,p.x,ht+r*.26,p.y,
    [Math.max(.7,r*.78),Math.max(.7,r*.70),Math.max(.7,r*.78)]);
   state.trees++;
  }else if(p.type==='bush'){
   const r=p.sp?.r||.6;
   make(sphere,p.x,.36+r*.28,p.y,[r*.8,Math.max(.35,r*.6),r*.8]);
   state.bushes++;
  }else if(p.type==='target'){
   make(cube,p.x,.88,p.y,[.58,1.76,.20]);
  }else if(p.type==='rock'){
   const r=p.sp?.r||.4;
   make(sphere,p.x,r*.55,p.y,[r*.86,r*.58,r*.8]);
  }
 }
 // Mobilia, ornamentos e lixeiras que ficam fora das fachadas.
 for(const b of bridge.boxes||[]){
  if((b.house&&!b.exteriorFixture)||b.floor===1)continue;
  if(b.h<.18||b.z>2.6)continue;
  const obj=make(cube,b.x,b.z+b.h/2,b.y,[b.w,b.h,b.d]);
  obj.rotation.y=-(b.rot||0);
 }
 // O sprite dos NPCs e player esta atras do canvas WebGL, mas deve ser
 // visivel quando fica entre a camera e o carro.
 const actors=(bridge.actors||[]).map(a=>{
  const torso=make(cube,a.x,1.04,a.y,[.4,1.08,.30],true);
  const head=make(sphere,a.x,1.70,a.y,[.19,.23,.19],true);
  dynamic.push({a,torso,head});
  state.actors++;
  return a;
 });
 function updateActors(driver,player){
  for(const entry of dynamic){
   const a=entry.a;
   const visible=!(driver&&a===player)&&Number.isFinite(a.x)&&
    Number.isFinite(a.y);
   entry.torso.visible=entry.head.visible=visible;
   if(!visible)continue;
   const elevation=a.floorZ||0;
   entry.torso.position.set(a.x,1.04+elevation,a.y);
   entry.head.position.set(a.x,1.70+elevation,a.y);
  }
 }
 // Painel de cerca: ripas com espacos reais + duas travessas finas,
 // nao parede continua (a parede continuava escondendo capos pela metade).
 const fenceSegments=(bridge.world.segs||[]).filter(s=>s.kind==='fence');
 if(fenceSegments.length){
  const pickets=[],rails=[];
  for(const s of fenceSegments){
   const dx=s.x2-s.x1,dy=s.y2-s.y1,len=Math.hypot(dx,dy);
   if(len<.01)continue;
   const ux=dx/len,uy=dy/len,angle=-Math.atan2(dy,dx);
   if(!s.rural){
    for(let i=0;i<4;i++){
     const t=(i+.5)/4;
     pickets.push([s.x1+dx*t,s.h*.52,s.y1+dy*t,
       .18,s.h-.08,.13,angle]);
    }
   }
   for(const z of s.rural?[.39,.89]:[.43,.94]){
    rails.push([(s.x1+s.x2)/2,z-.045,(s.y1+s.y2)/2,
      len,.075,.11,angle]);
   }
   // Hastes finas, sem quadraos opacos entre as ripas.
   for(const t of [0,1])
    pickets.push([s.x1+dx*t,s.h*.5,s.y1+dy*t,
      .11,s.h,.13,angle]);
  }
  for(const data of [pickets,rails]){
   const mesh=new THREE.InstancedMesh(cube,material,data.length);
   const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),
    quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(),
    axis=new THREE.Vector3(0,1,0);
   data.forEach(([x,y,z,w,h,d,angle],i)=>{
    position.set(x,y,z);scale.set(w,h,d);
    quaternion.setFromAxisAngle(axis,angle);
    matrix.compose(position,quaternion,scale);mesh.setMatrixAt(i,matrix);
   });
   mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;
   scene.add(mesh);groups.push(mesh);
  }
  state.fences=fenceSegments.length;
 }
 // Postes, copas, troncos e caixas usam 3 draw calls ao inves de
 // centenas; transformacoes estaticas no mundo original.
 for(const {geo,objects} of buckets.values()){
  const mesh=new THREE.InstancedMesh(geo,material,objects.length);
  objects.forEach((object,i)=>{
   object.updateMatrix();
   mesh.setMatrixAt(i,object.matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;
  mesh.frustumCulled=false;
  scene.add(mesh);groups.push(mesh);
 }
 // remove tudo da cena (o mundo grande remonta os oclusores em volta do carro)
 function dispose(){
  for(const m of groups){scene.remove(m);if(m.isInstancedMesh)m.dispose?.();}
  groups.length=0;dynamic.length=0;
 }
 return {state,updateActors,dispose};
}
