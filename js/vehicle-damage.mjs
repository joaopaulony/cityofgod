// Vehicle integrity and collision responses; pure deterministic gameplay state.
// HEALTH 1 = pristine; 0 = destroyed. All units: meters and m/s.
export const DAMAGE_LIMITS=Object.freeze({minor:.84,smoke:.56,smokeVisual:.72,critical:.24,disabled:.08,minimumSpeed:2.4,cooldown:.6});
export function createVehicleDamage(raw){
 const integrity=Number.isFinite(raw?.integrity)?Math.max(0,Math.min(1,raw.integrity)):1;
 return {integrity,impacts:Math.max(0,Math.min(999,Math.floor(raw?.impacts||0))),
  front:Math.max(0,Math.min(1,raw?.front||0)),rear:Math.max(0,Math.min(1,raw?.rear||0)),
  left:Math.max(0,Math.min(1,raw?.left||0)),right:Math.max(0,Math.min(1,raw?.right||0)),
  lastImpactTime:-Infinity,lastImpact:null};
}
export function damageTier(damage){
 const h=damage?.integrity??1;
 return h<=DAMAGE_LIMITS.disabled?'destroyed':h<=DAMAGE_LIMITS.critical?'critical':
  h<=DAMAGE_LIMITS.smokeVisual?'smoking':h<=DAMAGE_LIMITS.minor?'dented':'healthy';
}
export function engineEfficiency(damage){
 const h=damage?.integrity??1;
 if(h<=DAMAGE_LIMITS.disabled)return 0;
 if(h<=DAMAGE_LIMITS.critical)return .26;
 if(h<=DAMAGE_LIMITS.smoke)return .48+.52*(h-DAMAGE_LIMITS.critical)/(DAMAGE_LIMITS.smoke-DAMAGE_LIMITS.critical);
 return 1;
}
export function collisionPanel(car,impact){
 const ob=impact?.object;
 // The contact direction is in the vehicle-local axis; crashes in reverse
 // deform the trunk rather than always crumpling the front bumper.
 if(ob&&Number.isFinite(ob.x)&&Number.isFinite(ob.y)){
  const dx=ob.x-car.x,dy=ob.y-car.y,c=Math.cos(car.angle),s=Math.sin(car.angle);
  const front=dx*c+dy*s,side=-dx*s+dy*c;
  const f=front/(Math.max(1,car.length)/2),l=side/(Math.max(1,car.width)/2);
  if(Math.abs(l)>Math.abs(f)*1.18)return l>0?'left':'right';
  return f>=0?'front':'rear';
 }
 return car.speed>=0?'front':'rear';
}
export function registerCrash(damage,impact,speed,time=0,panel='front',mass=1){
 if(!impact||!damage)return null;
 const velocity=Math.abs(speed);
 if(velocity<DAMAGE_LIMITS.minimumSpeed||time-damage.lastImpactTime<DAMAGE_LIMITS.cooldown)return null;
 if(!Number.isFinite(velocity)||!Number.isFinite(time))return null;
 const obstacle={water:.35,map:.45,tree:1.12,house:1.1,fence:.7,object:.94}[impact.kind]||.95;
 // Impulse scales non-linearly; heavy trucks are harder to wreck.
 const lost=Math.max(.018,Math.min(.62,Math.pow(Math.max(0,velocity-2),1.35)*.0074*obstacle/
   Math.max(.65,Math.min(2.3,mass))));
 const before=damage.integrity;
 damage.integrity=Math.max(0,before-lost);
 damage.impacts++;
 damage.lastImpactTime=time;
 const location=['front','rear','left','right'].includes(panel)?panel:'front';
 damage[location]=Math.min(1,damage[location]+lost*1.9+.025);
 damage.lastImpact={kind:impact.kind,panel:location,at:time,speed:velocity,lost:before-damage.integrity};
 return damage.lastImpact;
}
export function repairVehicleDamage(damage){
 Object.assign(damage,createVehicleDamage());
 return damage;
}
