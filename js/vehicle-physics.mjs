// Cinematica original de veiculos, inspirada no ritmo de Project Zomboid.
// Unidades: metros, segundos, radianos, m/s. Sem sprites ou pre-render.
export const CAR_SPEC=Object.freeze({
 length:4.47,width:1.9,wheelbase:2.52,
 maxForward:36,maxReverse:8,
 engineAccel:7.2,reverseAccel:3.2,brakeAccel:10.5,
 rollingDrag:0.65,airDrag:0.009,
 steeringLow:0.56,steeringHigh:0.18,steeringRate:3.9
});
export function approach(x,target,step){
 return x<target?Math.min(x+step,target):Math.max(x-step,target);
}
export function normalizeAngle(x){
 return Math.atan2(Math.sin(x),Math.cos(x));
}
export function steerLimit(speed,spec=CAR_SPEC){
 return spec.steeringHigh+(spec.steeringLow-spec.steeringHigh)*
   Math.max(0,1-Math.abs(speed)/15);
}
export function stepCar(state,controls,dt,spec=CAR_SPEC){
 const step=Math.min(Math.max(dt,0),.05);
 if(!step)return {...state};
 const car={...state};
 const gas=controls.engineOn&&controls.forward?1:0,
  reverse=controls.engineOn&&controls.reverse?1:0;
 const brake=controls.handbrake?1:0;
 const left=controls.left?1:0,right=controls.right?1:0;
 const targetSteer=(right-left)*steerLimit(car.speed,spec);
 car.steer=approach(car.steer,targetSteer,spec.steeringRate*step*steerLimit(car.speed,spec));
 let speed=car.speed;
 if(brake){
  speed=approach(speed,0,spec.brakeAccel*(Math.abs(car.steer)>.04&&Math.abs(speed)>6?.38:1.35)*step);
 }else if(gas&&!reverse){
  speed=speed<-.08
    ?approach(speed,0,spec.brakeAccel*step)
    :speed+spec.engineAccel*step;
 }else if(reverse&&!gas){
  speed=speed>.08
    ?approach(speed,0,spec.brakeAccel*step)
    :speed-spec.reverseAccel*step;
 }else{
  const drag=(spec.rollingDrag+spec.airDrag*speed*speed)*step;
  speed=approach(speed,0,drag);
 }
 if(!controls.engineOn)speed=approach(speed,0,(spec.rollingDrag*2+spec.airDrag*speed*speed)*step);
 car.speed=Math.max(-spec.maxReverse,Math.min(spec.maxForward,speed));
 // Modelo bicicleta: virar durante a re inverte corretamente a trajetoria.
 const drifting=brake&&Math.abs(car.speed)>6&&Math.abs(car.steer)>.04;
 const headingDelta=car.speed/spec.wheelbase*Math.tan(car.steer)*step*(drifting?1.35:1);
 car.angle=normalizeAngle(car.angle+headingDelta);
 const slipTarget=drifting?-Math.sign(car.steer)*Math.min(.65,Math.abs(car.speed)*.025):0;
 car.slip=approach(car.slip||0,slipTarget,step*(drifting?1.8:1.3));
 car.drifting=Math.abs(car.slip)>.12&&Math.abs(car.speed)>4;
 car.x+=Math.cos(car.angle+car.slip)*car.speed*step;
 car.y+=Math.sin(car.angle+car.slip)*car.speed*step;
 car.distance=(car.distance||0)+Math.abs(car.speed*step);
 return car;
}
export function cameraLead(car){
 const look=Math.min(6,Math.abs(car.speed)*.27);
 const s=Math.sign(car.speed)||1;
 return {x:car.x+Math.cos(car.angle)*look*s,y:car.y+Math.sin(car.angle)*look*s};
}
