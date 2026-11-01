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
 const brake=controls.handbrake?1:0,driftKey=controls.drift?1:0;
 const left=controls.left?1:0,right=controls.right?1:0;
 const targetSteer=(right-left)*steerLimit(car.speed,spec);
 car.steer=approach(car.steer,targetSteer,spec.steeringRate*step*steerLimit(car.speed,spec));
 let speed=car.speed;
 // freio de mão (espaço): trava as rodas — o carro para de verdade, arrastando os pneus, quase sem esterçar.
 // drift (Shift + volante em velocidade): solta a traseira; depois, acelerador + volante mantêm o carro de lado
 // (contra-esterço controla o ângulo); sem acelerador ou com o volante reto ele volta a ter aderência
 const steering=Math.abs(car.steer)>.04,fast=Math.abs(car.speed)>6;
 car.locked=!!brake&&Math.abs(car.speed)>1.2;
 if(driftKey&&!brake&&fast&&steering)car.driftT=.55;
 else if(car.drifting&&gas&&Math.abs(car.steer)>.03&&Math.abs(car.speed)>5)car.driftT=Math.max(car.driftT||0,.22);
 car.driftT=Math.max(0,(car.driftT||0)-step);
 const inDrift=car.driftT>0;
 if(brake){
  speed=approach(speed,0,spec.brakeAccel*1.45*step);   // rodas travadas: freia forte, sem drift
  car.driftT=0;
 }else if(driftKey&&inDrift&&!gas){
  speed=approach(speed,0,spec.brakeAccel*.22*step);   // jogando a traseira sem acelerar: perde velocidade aos poucos
 }else if(inDrift&&gas&&!reverse&&speed>0){
  // de lado o motor empurra menos e o atrito lateral come velocidade, mas devagar: o drift não morre
  speed+=spec.engineAccel*.7*step-Math.abs(car.slip||0)*2.4*step;
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
 // Modelo bicicleta: virar durante a re inverte corretamente a trajetoria. No drift o nariz gira mais (a traseira
 // escorrega) e a direção do movimento só alcança o nariz devagar — o ângulo entre os dois é o slip.
 let heading=normalizeAngle(car.angle+(car.slip||0));   // direção do movimento antes de girar o nariz
 // contra-esterço (volante p/ o lado em que a traseira escorrega) endireita sem o reforço do drift
 const counter=inDrift&&Math.sign(car.steer)===Math.sign(car.slip||0)&&Math.abs(car.slip||0)>.05;
 const yaw=car.speed/spec.wheelbase*Math.tan(car.steer)*(car.locked?.25:inDrift&&!counter?1.75+(gas?.45:0):counter?.7:1);   // travado: pneus arrastando quase não viram
 car.angle=normalizeAngle(car.angle+yaw*step);
 const grip=inDrift?1.4:9,gap=normalizeAngle(car.angle-heading);
 heading=normalizeAngle(heading+Math.sign(gap)*Math.min(Math.abs(gap),grip*step));
 let slip=normalizeAngle(heading-car.angle);
 if(Math.abs(slip)>.96)slip=Math.sign(slip)*.96;   // no máximo ~55° de lado
 if(!inDrift&&Math.abs(slip)<1e-3)slip=0;
 car.slip=slip;
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
