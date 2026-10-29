// CPU-bounded smoke and crash sparks using one sprite texture and a fixed pool.
// No PointLights, no shadows, no allocations during a normal frame.
export function createVehicleDamageEffects(THREE,scene){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
 const c=canvas.getContext('2d');
 const grad=c.createRadialGradient(32,32,1,32,32,31);
 grad.addColorStop(0,'rgba(255,255,255,.85)');
 grad.addColorStop(.3,'rgba(240,240,240,.55)');
 grad.addColorStop(1,'rgba(255,255,255,0)');
 c.fillStyle=grad;c.fillRect(0,0,64,64);
 const texture=new THREE.CanvasTexture(canvas);
 const pool=Array.from({length:76},()=>{const m=new THREE.Sprite(new THREE.SpriteMaterial({
  map:texture,transparent:true,depthWrite:false,depthTest:true,color:0x666666,opacity:0}));
  m.visible=false;scene.add(m);return {m,t:0,duration:0,velocity:0,drift:0,spark:false};});
 const clocks=new Map();let index=0;
 function spawn(x,z,h,spark=false){
  const p=pool[index++%pool.length];
  p.t=0;p.spark=spark;p.duration=spark?.33:2.3+Math.random()*.9;
  p.m.material.color.setHex(spark?0xff9a33:0x696969);
  p.m.material.opacity=spark?.9:.36;
  p.m.position.set(x+(Math.random()-.5)*.2,h,z+(Math.random()-.5)*.2);
  p.m.scale.setScalar(spark?.12:.4);
  p.velocity=spark?1.4:0.45+Math.random()*.32;
  p.drift=(Math.random()-.5)*(spark?1.7:.32);
  p.m.visible=true;
 }
 function smoke(key,x,z,intensity,dt,height=1.15){
  if(intensity<=0||dt<=0)return;
  const period=Math.max(.095,.62-.43*Math.min(1,intensity));
  let n=(clocks.get(key)||0)+Math.min(.35,dt);
  const spawns=Math.min(3,Math.floor(n/period));
  n-=spawns*period;clocks.set(key,n);
  for(let i=0;i<spawns;i++)spawn(x,z,height);
 }
 function crash(x,z,speed=8){
  const count=Math.min(10,Math.max(2,Math.round(speed*.36)));
  for(let i=0;i<count;i++)spawn(x,z,.45,i%3===0);
 }
 function update(dt){
  dt=Math.min(.1,Math.max(0,dt));
  for(const p of pool){
   if(!p.m.visible)continue;
   p.t+=dt;
   if(p.t>=p.duration){p.m.visible=false;continue;}
   p.m.position.y+=p.velocity*dt;
   p.m.position.x+=p.drift*dt;
   p.m.position.z+=Math.sin(p.t*2+p.drift)*dt*.08;
   p.m.scale.addScalar((p.spark?.2:.62)*dt);
   p.m.material.opacity=(p.spark?.9:.46)*Math.pow(1-p.t/p.duration,1.35);
  }
 }
 function dispose(){
  for(const p of pool){scene.remove(p.m);p.m.material.dispose();}
  texture.dispose();clocks.clear();
 }
 return {smoke,crash,update,dispose};
}
