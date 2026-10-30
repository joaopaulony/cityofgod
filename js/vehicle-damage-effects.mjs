// Pooled, clearly visible vehicle smoke and collision sparks.
// Separate left/right hood emitters share one texture and bounded sprite pool.
// No shadow-casting lights or allocations in the frame update.
export function smokeIntensityForIntegrity(integrity){
 const h=typeof integrity==='number'?integrity:integrity?.integrity;
 if(!Number.isFinite(h)||h>.72)return 0;
 // Starts faint at 72%, turns distinctly grey under 50%, dense under 25%.
 return Math.min(1,Math.max(.12,(.78-h)/.62));
}
export function hoodSmokeEmitters(x,y,angle,length){
 const along=Math.max(0,Number(length)||4.7)*.29;
 const side=.27;
 const fx=x+Math.cos(angle)*along,fy=y+Math.sin(angle)*along;
 return [[fx-Math.sin(angle)*side,fy+Math.cos(angle)*side],
         [fx+Math.sin(angle)*side,fy-Math.cos(angle)*side]];
}
export function createVehicleDamageEffects(THREE,scene){
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=96;
 const ctx=canvas.getContext('2d');
 const grad=ctx.createRadialGradient(48,48,2,48,48,46);
 grad.addColorStop(0,'rgba(255,255,255,1)');
 grad.addColorStop(.32,'rgba(255,255,255,.91)');
 grad.addColorStop(.64,'rgba(255,255,255,.54)');
 grad.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=grad;ctx.fillRect(0,0,96,96);
 const texture=new THREE.CanvasTexture(canvas);
 const pool=Array.from({length:160},()=>{
  const material=new THREE.SpriteMaterial({
   map:texture,transparent:true,depthWrite:false,depthTest:true,
   color:0x96999f,opacity:0,blending:THREE.NormalBlending
  });
  const sprite=new THREE.Sprite(material);
  sprite.visible=false;
  sprite.frustumCulled=false;
  scene.add(sprite);
  return {sprite,t:0,duration:0,velocity:0,drift:0,smokeIntensity:0,spark:false};
 });
 const clocks=new Map();let index=0;
 function spawn(x,z,height,intensity=1,spark=false){
  const p=pool[index++%pool.length];
  p.t=0;p.spark=spark;
  p.smokeIntensity=intensity;
  p.duration=spark?.32:2.5+Math.random()*1.3;
  const light=THREE.MathUtils.lerp(0.70,0.35,intensity);
  p.sprite.material.color.setRGB(
   spark?1:light,spark?.48:light*1.015,spark?.14:light*1.04
  );
  p.sprite.material.opacity=spark?.93:(.55+.20*intensity);
  p.sprite.position.set(x+(Math.random()-.5)*.25,height,z+(Math.random()-.5)*.25);
  p.sprite.scale.setScalar(spark?.14:(.67+.33*intensity));
  p.velocity=spark?1.4:.31+Math.random()*.26;
  p.drift=(Math.random()-.5)*(spark?1.7:.43);
  p.sprite.visible=true;
 }
 function smoke(key,x,z,intensity,dt,height=1.15){
  if(!Number.isFinite(intensity)||intensity<=0||!Number.isFinite(dt)||dt<=0)return;
  const strength=Math.min(1,Math.max(0,intensity));
  // Each of the TWO hood outlets emits at 3–9 puffs/s, not a single faint puff.
  const period=Math.max(.11,.46-.34*strength);
  let elapsed=(clocks.get(key)||0)+Math.min(.35,dt);
  const count=Math.min(4,Math.floor(elapsed/period));
  elapsed-=count*period;
  if(clocks.size>200)clocks.clear();
  clocks.set(key,elapsed);
  for(let i=0;i<count;i++)spawn(x,z,height,strength);
 }
 function crash(x,z,speed=8){
  const count=Math.min(10,Math.max(2,Math.round(speed*.36)));
  for(let i=0;i<count;i++)spawn(x,z,.45,1,i%3===0);
 }
 function update(dt){
  dt=Math.min(.1,Math.max(0,Number(dt)||0));
  for(const p of pool){
   if(!p.sprite.visible)continue;
   p.t+=dt;
   if(p.t>=p.duration){p.sprite.visible=false;continue;}
   p.sprite.position.y+=p.velocity*dt;
   p.sprite.position.x+=p.drift*dt;
   p.sprite.position.z+=Math.sin(p.t*2+p.drift)*dt*.10;
   p.sprite.scale.addScalar((p.spark?.23:.85)*dt);
   p.sprite.material.opacity=(p.spark?.9:(.55+.20*p.smokeIntensity))*
    Math.pow(1-p.t/p.duration,1.16);
  }
 }
 function stats(){
  let visibleSmoke=0,visibleSparks=0;
  for(const p of pool)if(p.sprite.visible){if(p.spark)visibleSparks++;else visibleSmoke++;}
  return {visibleSmoke,visibleSparks,capacity:pool.length,emitters:clocks.size};
 }
 function dispose(){
  for(const p of pool){scene.remove(p.sprite);p.sprite.material.dispose();}
  texture.dispose();clocks.clear();
 }
 return {smoke,crash,update,stats,dispose};
}
