// living-grass-3d.mjs — dense, natural grass rooted in the existing terrain.
// Three.js: ONE instanced draw call, no new textures, no per-blade animation loops.
// Biome sampling is shared with terrain.js. Wind + footsteps bend vertices on GPU.
const TAU=Math.PI*2;
const h32=(x,y,k=0)=>{let h=(Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(k|0,1274126177))|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
export const GRASS_BUDGET={low:4200,balanced:10600,high:17000};
export const GRASS_PALETTES={
 lawn:['#407e31','#4d963c','#68a349','#7dab55'],
 meadow:['#37692f','#478639','#68934a','#90a95a'],
 wild:['#43682e','#628441','#829b4b','#9ba65e'],
 dry:['#637839','#818949','#9c9b56','#ac9d67'],
 wet:['#386b3d','#4b8650','#6c9b50','#8cb161'],
 shade:['#315b37','#426c3a','#577e40','#718a4a']
};
// Four tapering, slightly bent ribbons in each clump, single reusable geometry.
function bladeGeometry(THREE){
 const positions=[],colors=[],indices=[];
 const lengths=[1,.86,.95,.72],rotations=[0,1.31,2.75,4.45];
 for(let b=0;b<4;b++){
  const a=rotations[b],c=Math.cos(a),s=Math.sin(a),h=lengths[b],width=.046+(b%2)*.016;
  const base=positions.length/3;
  for(let k=0;k<4;k++){
   const t=k/3,lean=t*t*(.085+(b%3)*.024),w=width*(1-.87*t);
   for(const side of [-1,1]){
    positions.push(c*lean-s*side*w,t*h,s*lean+c*side*w);
    const value=.57+.43*t;colors.push(value*(.95+b*.019),value*(1+.02*b),value*.75+.21);
   }
  }
  for(let k=0;k<3;k++){const i=base+k*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 return geo;
}
const VERT=`
attribute vec3 color;
attribute vec3 aTint;
uniform float uTime,uWind,uGust,uFoot,uRadius,uMax;
uniform vec2 uActor,uVelocity,uWindDir,uCam;
varying vec3 vColor;
varying float vDist;
void main(){
 vec4 world=instanceMatrix*vec4(position,1.0);
 vec2 worldXZ=world.xz;
 float t=clamp(position.y,0.0,1.0);
 float tip=t*t*(.65+.35*t);
 float wave=sin(uTime*1.8+worldXZ.x*.21+worldXZ.y*.15);
 float slow=sin(uTime*.72+worldXZ.x*.075-worldXZ.y*.093);
 float flutter=sin(uTime*5.1+worldXZ.x*1.19+worldXZ.y*1.37);
 vec2 sway=uWindDir*(wave*.095+slow*.16+flutter*.028)*uWind*(.75+.25*uGust)*tip;
 float d=length(worldXZ-uActor);
 float push=1.0-smoothstep(.20,uRadius,d);
 vec2 outward=normalize(worldXZ-uActor+vec2(.003,-.002));
 // Only moving actors bend grass. The base stays rooted, tips recover immediately.
 vec2 foot=(outward*.24+uVelocity*.13)*push*uFoot*tip;
 world.xz+=sway+foot;
 vColor=color*aTint;
 vDist=length(worldXZ-uCam);
 gl_Position=projectionMatrix*viewMatrix*modelMatrix*world;
}`;
const FRAG=`
uniform float uDay,uSnow,uMax;
varying vec3 vColor;
varying float vDist;
void main(){
 // Fade by stochastic dither: depth-sorted alpha cards are unnecessary.
 float fade=1.0-smoothstep(uMax*.77,uMax,vDist);
 float rand=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
 if(fade<rand)discard;
 vec3 tint=mix(vColor,vec3(.79,.83,.79),uSnow*.65);
 tint*=mix(.41,1.04,uDay);
 gl_FragColor=vec4(tint,.85); // Urban Ink vegetation class: no thick cartoon strokes.
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export function createLivingGrass(THREE,scene,bridge){
 const geo=bladeGeometry(THREE);
 const budget=GRASS_BUDGET[bridge?.quality?.()||'balanced']||GRASS_BUDGET.balanced;
 const settings={
  uTime:{value:0},uWind:{value:.5},uGust:{value:1},uFoot:{value:0},
  uRadius:{value:1.7},uMax:{value:42},uActor:{value:new THREE.Vector2(-9999,-9999)},
  uVelocity:{value:new THREE.Vector2()},uWindDir:{value:new THREE.Vector2(.87,.49)},
  uCam:{value:new THREE.Vector2()},uDay:{value:1},uSnow:{value:0}
 };
 const material=new THREE.ShaderMaterial({
  vertexShader:VERT,fragmentShader:FRAG,uniforms:settings,
  vertexColors:false,side:THREE.DoubleSide,depthWrite:true,depthTest:true,
  transparent:false,fog:false,clipping:false
 });
 let capacity=GRASS_BUDGET.high;
 const mesh=new THREE.InstancedMesh(geo,material,capacity);
 const shade=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);
 shade.setUsage(THREE.DynamicDrawUsage);geo.setAttribute('aTint',shade);
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.count=0;
 mesh.name='CityOfGodLivingGrass';mesh.renderOrder=0;scene.add(mesh);
 const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),pos=new THREE.Vector3(),scale=new THREE.Vector3(),tmpColor=new THREE.Color();
 const colors=Object.fromEntries(Object.entries(GRASS_PALETTES).map(([name,list])=>[name,list.map(c=>new THREE.Color(c))]));
 const state={active:0,capacity,drawCalls:1,trianglesPerClump:geo.index.count/3,
  bladesPerClump:4,patches:0,low:0,medium:0,tall:0,skipped:0,ms:0,wind:0,footstep:0,quality:'balanced',pending:false,center:[0,0],biomes:{}};
 let job=null,prev={x:null,y:null,t:0},lastRebuild=-Infinity,built={x:1e8,y:1e8,r:0,quality:''},count=0;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const palette=(kind,seed)=>{
  const col=colors[kind]||colors.meadow;
  const f=clamp(seed,0,.999),i=Math.min(col.length-2,Math.floor(f*(col.length-1))),v=f*(col.length-1)-i;
  return tmpColor.copy(col[i]).lerp(col[i+1],v);
 };
 const nextCell=(j)=>{
  const x=j.cx+j.ix*.99+.44,y=j.cy+j.iy*.99+.44;
  const r=Math.hypot(x-j.cx,y-j.cy);
  const rand=h32(Math.floor(x),Math.floor(y),217);
  if(r>j.radius || rand>.99){state.skipped++;return;}
  // Shared biome logic rejects roadways, beaches, water, concrete and fields.
  const sample=bridge.grassAt?.(x,y);
  if(!sample||sample.cover<.07){state.skipped++;return;}
  if(j.houses.some(H=>x>H.x0-.4&&x<H.x1+.4&&y>H.y0-.4&&y<H.y1+.4)
    ||j.paved.some(b=>x>b[0]-.2&&x<b[2]+.2&&y>b[1]-.2&&y<b[3]+.2)){
   state.skipped++;return;
  }
  const dScale=r<16?1:r<32?.6:.33;
  const max=sample.profile==='lawn'?4:sample.profile==='wild'?4:5;
  const probability=sample.cover*dScale;
  const n=Math.min(max,1+Math.floor(probability*max*1.25));
  for(let q=0;q<n&&j.list.length<j.budget;q++){
   const h=h32(Math.floor(x*13),Math.floor(y*11),q+1);
   if(h>probability && q>0)continue;
   const a=h32(Math.floor(x*9),Math.floor(y*9),q+41),b=h32(Math.floor(x*7),Math.floor(y*17),q+77);
   const xx=x+(a-.5)*.84,yy=y+(b-.5)*.84;
   if(j.houses.some(H=>xx>H.x0-.12&&xx<H.x1+.12&&yy>H.y0-.12&&yy<H.y1+.12)
     ||j.paved.some(t=>xx>t[0]&&xx<t[2]&&yy>t[1]&&yy<t[3]))continue;
   let height=sample.height*(.64+.65*h32(Math.floor(xx*100),Math.floor(yy*100),31));
   // Mature wild grass appears in islands; lawns remain short, not uniform.
   if(sample.profile==='wild'&&b>.83)height*=1.6;
   if(sample.profile==='wet'&&a>.78)height*=1.4;
   height=clamp(height,.09,1.75);
   const width=.82+.44*b,angle=h32(Math.floor(xx*100),Math.floor(yy*100),19)*TAU;
   const tint=palette(sample.profile,h32(Math.floor(xx*50),Math.floor(yy*50),47));
   tint.multiplyScalar(.78+.35*a);
   j.list.push({x:xx,y:yy,height,width,angle,profile:sample.profile,r:tint.r,g:tint.g,b:tint.b});
  }
 };
 function begin(x,y,r,quality,now){
  const step=.99,cx=Math.floor(x/6)*6,cy=Math.floor(y/6)*6;
  const half=Math.ceil(r/step),houses=(bridge.houses||[]).filter(H=>H.x1>cx-r-3&&H.x0<cx+r+3&&H.y1>cy-r-3&&H.y0<cy+r+3);
  const paved=(bridge.world.paved||[]).filter(b=>b[2]>cx-r&&b[0]<cx+r&&b[3]>cy-r&&b[1]<cy+r);
  const budget=GRASS_BUDGET[quality]||GRASS_BUDGET.balanced;
  job={cx,cy,radius:r,quality,budget,ix:-half,iy:-half,half,houses,paved,list:[],start:performance.now()};
  lastRebuild=now;state.pending=true;
 }
 function commit(){
  if(!job)return;
  let low=0,medium=0,tall=0;const biomes={};
  count=job.list.length;
  for(let i=0;i<count;i++){
   const p=job.list[i];
   pos.set(p.x,.018,p.y);quat.setFromAxisAngle(up,p.angle);
   scale.set(p.width,p.height,p.width);matrix.compose(pos,quat,scale);mesh.setMatrixAt(i,matrix);
   shade.setXYZ(i,p.r,p.g,p.b);
   if(p.height<.35)low++;else if(p.height<.78)medium++;else tall++;
   biomes[p.profile]=(biomes[p.profile]||0)+1;
  }
  mesh.count=count;
  if(count){mesh.instanceMatrix.needsUpdate=true;shade.needsUpdate=true;}
  Object.assign(state,{active:count,low,medium,tall,ms:+(performance.now()-job.start).toFixed(1),
   quality:job.quality,pending:false,center:[job.cx,job.cy],patches:job.houses.length,biomes});
  built={x:job.cx,y:job.cy,r:job.radius,quality:job.quality};
  job=null;
 }
 function processJob(){
  if(!job)return;
  const t0=performance.now();
  // Time budget: no long synchronous regeneration when streaming busy sectors.
  while(job&&performance.now()-t0<2.4){
   nextCell(job);
   job.ix++;
   if(job.ix>job.half){job.ix=-job.half;job.iy++;}
   if(job.iy>job.half ||job.list.length>=job.budget){commit();break;}
  }
 }
 function update(now,camera,quality='balanced'){
  if(!bridge?.cam)return;
  const c=bridge.cam,E=globalThis.ENV||{};
  const halfW=c.W/(c.zoom*2),halfH=c.H/(c.zoom*2*Math.max(.47,c.tilt));
  const r=clamp(Math.hypot(halfW,halfH)+19,24,82);
  const activeBudget=GRASS_BUDGET[quality]||GRASS_BUDGET.balanced;
  const tooFar=Math.hypot(c.x-built.x,c.y-built.y)>Math.max(8,built.r*.27);
  const needsRebuild=tooFar||quality!==built.quality||Math.abs(r-built.r)>9;
  if(needsRebuild &&(!job ||Math.hypot(c.x-job.cx,c.y-job.cy)>17 ||quality!==job.quality)&& now-lastRebuild>0.45)
   begin(c.x,c.y,r,quality,now);
  // A low preset must not keep thousands of high-preset instances while the job runs.
  if(mesh.count>activeBudget)mesh.count=activeBudget;
  if(job)processJob();
  settings.uTime.value=now;
  settings.uCam.value.set(c.x,c.y);
  settings.uMax.value=r;
  const dir=E.windDir||[1,0],speed=E.windNow??.35;
  settings.uWind.value=clamp(.24+speed*1.8,.14,2.4);
  settings.uGust.value=1+(E.gust||0)*.55;
  settings.uWindDir.value.set(dir[0],dir[1]);
  settings.uDay.value=clamp(E.day??1,0,1);
  settings.uSnow.value=clamp(E.snowCover||0,0,1);
  const p=bridge.player,px=p?.x,py=p?.y;
  if(Number.isFinite(px)&&Number.isFinite(py)){
   const dt=prev.t?clamp(now-prev.t,.015,.1):.016;
   let vx=prev.x===null?0:(px-prev.x)/dt,vy=prev.y===null?0:(py-prev.y)/dt;
   if(Math.hypot(vx,vy)>22){vx=vy=0;} // Teleport: don't flatten a huge track.
   const speed=Math.hypot(vx,vy);
   const inside=!!p.floor||!!p.floorZ||bridge.houses?.some(H=>H.inside);
   settings.uFoot.value=inside?0:clamp(speed/3.5,0,1);
   settings.uVelocity.value.set(clamp(vx/4,-1,1),clamp(vy/4,-1,1));
   settings.uActor.value.set(px,py);
   prev={x:px,y:py,t:now};
  }else settings.uFoot.value=0;
  Object.assign(state,{wind:+settings.uWind.value.toFixed(2),footstep:+settings.uFoot.value.toFixed(2)});
 }
 return {mesh,state,update,dispose(){scene.remove(mesh);geo.dispose();material.dispose();}};
}
