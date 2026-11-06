// Câmera seguindo o jogador a pé (camera-motion.js → followLead), simulada com o mesmo lerp do cam.update (core.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function load(settings={}){
 const ctx={window:{CityFront:{settings}},document:{querySelector:()=>null},Math,console};ctx.window.window=ctx.window;
 vm.createContext(ctx);vm.runInContext(readFileSync(new URL('../js/camera-motion.js',import.meta.url),'utf8'),ctx);
 return ctx.window.CameraMotion;
}
// anda com o jogador e a câmera (alvo = jogador + antecipação; câmera persegue com taxa 6/s)
function run(CM,{steps,vx=0,vy=0,opts={},from={x:0,y:0},cam=null}){
 const dt=1/60,p={...from},c=cam||{x:p.x,y:p.y};
 for(let i=0;i<steps;i++){p.x+=vx*dt;p.y+=vy*dt;const [ax,ay]=CM.followLead(p.x,p.y,dt,opts);const tx=p.x+ax,ty=p.y+ay,k=1-Math.exp(-dt*6);c.x+=(tx-c.x)*k;c.y+=(ty-c.y)*k;}
 return {p,c};
}
test('correndo: a câmera fica à frente do jogador (antes ficava 0,7 m atrás) e sem exagero',()=>{
 const CM=load(),{p,c}=run(CM,{steps:240,vx:4.2});
 const ahead=c.x-p.x;
 assert.ok(ahead>0.8&&ahead<1.6,'antecipação '+ahead.toFixed(2));
 assert.ok(Math.abs(c.y-p.y)<1e-6);
});
test('parou: volta ao centro devagar, sem tranco',()=>{
 const CM=load();let s=run(CM,{steps:240,vx:4.2});
 const before=s.c.x-s.p.x;
 const one=run(CM,{steps:6,from:s.p,cam:s.c});   // 0,1 s depois de parar
 assert.ok(one.c.x-one.p.x>before*0.6,'não pula de volta');
 const later=run(CM,{steps:240,from:one.p,cam:one.c});
 assert.ok(Math.abs(later.c.x-later.p.x)<0.05,'centralizado '+(later.c.x-later.p.x).toFixed(3));
});
test('dentro de casa a antecipação é curta; mirando ou com o acompanhamento desligado, nenhuma',()=>{
 const inside=run(load(),{steps:240,vx:4.2,opts:{indoors:true}});
 assert.ok(inside.c.x-inside.p.x<1.25,'casa '+(inside.c.x-inside.p.x).toFixed(2));
 for(const [CM,opts] of [[load(),{aiming:true}],[load({cameraFollow:false}),{}]]){
  const r=run(CM,{steps:240,vx:4.2,opts});
  assert.ok(r.c.x-r.p.x<-0.5,'sem antecipação a câmera só persegue');   // o atraso normal do lerp
 }
});
test('teleporte: zera a antecipação (nada de deslocamento gigante)',()=>{
 const CM=load();run(CM,{steps:120,vx:4.2});
 const [ax,ay]=CM.followLead(500,500,1/60,{});
 assert.deepEqual([ax,ay],[0,0]);
});
