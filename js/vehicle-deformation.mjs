// Non-destructive procedural crumple zones on actual GLB body meshes.
// Geometries are CLONED PER CAR before editing: no other vehicle in the
// texture/geometry cache can be damaged accidentally. Wheel/light meshes stay intact.
const BODY=/(body|hood|bonnet|bumper|fender|panel|door|trunk|boot|chassis|exterior|carpaint|shell)/i;
const EXCLUDE=/(wheel|tyre|tire|rim|glass|window|windshield|lamp|light|beacon|siren|mirror|seat|interior|dashboard|headlamp|tail|plate|number|police_gla)/i;
export function createVehicleDeformation(THREE,root,cfg){
 const parts=[];
 root.updateMatrixWorld(true);
 const inv=new THREE.Matrix4().copy(root.matrixWorld).invert();
 const matrix=new THREE.Matrix4(),vec=new THREE.Vector3();
 const list=[];
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isSkinnedMesh||!mesh.geometry?.attributes?.position)return;
  if(!BODY.test(mesh.name||'')||EXCLUDE.test(mesh.name||''))return;
  mesh.updateMatrixWorld(true);
  matrix.multiplyMatrices(inv,mesh.matrixWorld);
  list.push({mesh,matrix:matrix.clone()});
 });
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
 const raw=new Map();
 for(const {mesh,matrix:transform} of list){
  const attrib=mesh.geometry.attributes.position,coords=new Float32Array(attrib.count*3);
  for(let i=0;i<attrib.count;i++){
   vec.fromBufferAttribute(attrib,i).applyMatrix4(transform);
   minX=Math.min(minX,vec.x);maxX=Math.max(maxX,vec.x);
   minY=Math.min(minY,vec.y);maxY=Math.max(maxY,vec.y);
   minZ=Math.min(minZ,vec.z);maxZ=Math.max(maxZ,vec.z);
   coords.set([vec.x,vec.y,vec.z],i*3);
  }
  raw.set(mesh,coords);
 }
 if(!list.length)return {apply(){return 0;},dispose(){},meshes:0};
 const axis=maxZ-minZ>=maxX-minX?'z':'x';
 const forward=cfg?.front==='-Z'?-1:1;
 const majorMin=axis==='z'?minZ:minX,majorMax=axis==='z'?maxZ:maxX;
 const sideMin=axis==='z'?minX:minZ,sideMax=axis==='z'?maxX:maxZ;
 const length=Math.max(1,majorMax-majorMin),width=Math.max(.5,sideMax-sideMin);
 const center=(sideMin+sideMax)/2;
 const forwardEdge=forward===1?majorMax:majorMin,rearEdge=forward===1?majorMin:majorMax;
 const sideCenterY=minY+(maxY-minY)*.42;
 for(const {mesh,matrix:transform} of list){
  const old=mesh.geometry,geometry=old.clone(),before=new Float32Array(geometry.attributes.position.array),
   coordinates=raw.get(mesh),inverse=transform.clone().invert();
  mesh.geometry=geometry;
  parts.push({mesh,old,geometry,before,coordinates,inverse});
 }
 let cache='';
 function apply(damage){
  const {front=0,rear=0,left=0,right=0}=damage||{};
  const signature=[front,rear,left,right].map(n=>Number(n).toFixed(3)).join(':');
  if(signature===cache)return 0;cache=signature;
  let moved=0;
  for(const part of parts){
   const {geometry,before,coordinates,inverse}=part;
   const attr=geometry.attributes.position,buf=attr.array;
   for(let i=0;i<attr.count;i++){
    const j=i*3,wx=coordinates[j],wy=coordinates[j+1],wz=coordinates[j+2];
    const major=axis==='z'?wz:wx,side=axis==='z'?wx:wz;
    const towardFront=Math.max(0,1-Math.abs(major-forwardEdge)/(length*.26));
    const towardRear=Math.max(0,1-Math.abs(major-rearEdge)/(length*.23));
    const sideLeft=Math.max(0,1-Math.abs(side-sideMax)/(width*.34));
    const sideRight=Math.max(0,1-Math.abs(side-sideMin)/(width*.34));
    const height=Math.max(.1,1-Math.abs(wy-sideCenterY)/Math.max(.7,(maxY-minY)*.78));
    // Signed crumple changes are under 24 cm even for a completely destroyed car.
    const pushMajor=height*(Math.pow(towardRear,2)*rear*.22-
      Math.pow(towardFront,2)*front*.24)*forward;
    const pushSide=height*(Math.pow(sideRight,2)*right*.19-
      Math.pow(sideLeft,2)*left*.19);
    const oldWorld=vec.set(wx,wy,wz);
    if(axis==='z'){oldWorld.x+=pushSide;oldWorld.z+=pushMajor;}
    else{oldWorld.x+=pushMajor;oldWorld.z+=pushSide;}
    oldWorld.applyMatrix4(inverse);
    buf[j]=oldWorld.x;buf[j+1]=oldWorld.y;buf[j+2]=oldWorld.z;
    if(Math.abs(pushMajor)+Math.abs(pushSide)>.0005)moved++;
   }
   attr.needsUpdate=true;
   geometry.computeVertexNormals();
   geometry.computeBoundingSphere();
  }
  return moved;
 }
 function dispose(){
  for(const {mesh,geometry,old} of parts){mesh.geometry=old;geometry.dispose();}
 }
 return {apply,dispose,meshes:parts.length};
}
