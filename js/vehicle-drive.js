
'use strict';
// Car handling, headlights, ignition, horn, dynamic road grip and audio.
const vehicleSystem={cars:[],driver:null,audio:null};
function vehicleCreate(x,y,rot,col,index=0){
 const model=CAR_MODELS[index%CAR_MODELS.length];
 const b=addBox({kind:'car',x,y,rot,w:model.len,d:model.w,h:1.25,z:0,
  top:col,side:col,solid:false,model:model.id,
  seed:(world.seed+index*1009)|0,speed:0,steer:0,
  engine:false,headlights:false,indicator:0,hazards:false,
  reverse:false,brake:false,odometer:0,rpm:0,occupied:false});
 vehicleSystem.cars.push(b);return b;
}
function vehicleCanOccupy(b,x,y,ang){
 const m=carModel(b),co=Math.cos(ang),si=Math.sin(ang);
 for(const [u,v] of [[0,0],[m.len*.42,m.w*.39],
    [m.len*.42,-m.w*.39],[-m.len*.42,m.w*.39],
    [-m.len*.42,-m.w*.39],[m.len*.28,0],[-m.len*.28,0]]){
  const px=x+u*co-v*si,py=y+u*si+v*co;
  if(px<1.5||py<1.5||px>MAP-1.5||py>MAP-1.5||
     pondVal(px,py)<1.06)return false;
  for(const H of houses){
   if(px>H.x0-.24&&px<H.x1+.24&&py>H.y0-.24&&py<H.y1+.24)return false;
  }
  for(const p of world.props){
   if((p.type==='tree'||p.type==='rock')&&
       Math.hypot(px-p.x,py-p.y)<(p.type==='tree'?.47:.32))return false;
  }
  for(const other of boxes){
   if(other===b||(other.house&&!other.exteriorFixture))continue;
   if(other.kind==='car'){
    const dx=px-other.x,dy=py-other.y,
      c=Math.cos(other.rot),s=Math.sin(other.rot),
      along=dx*c+dy*s,side=-dx*s+dy*c;
    if(Math.abs(along)<other.w*.49+.18&&Math.abs(side)<other.d*.50+.18)
      return false;
   }else if(other.solid!==false&&Math.hypot(px-other.x,py-other.y)<
     Math.min(other.w,other.d)*.52+.24)return false;
  }
 }
 return true;
}
function vehicleAudioInit(){
 if(vehicleSystem.audio)return vehicleSystem.audio;
 const Context=window.AudioContext||window.webkitAudioContext;
 if(!Context)return null;
 try{
  const ctx=new Context(),gain=ctx.createGain(),
   low=ctx.createOscillator(),high=ctx.createOscillator(),
   filter=ctx.createBiquadFilter(),v1=ctx.createGain(),v2=ctx.createGain();
  low.type='sawtooth';high.type='triangle';
  filter.type='lowpass';filter.frequency.value=500;
  v1.gain.value=.11;v2.gain.value=.045;gain.gain.value=0;
  low.connect(v1).connect(filter);
  high.connect(v2).connect(filter);
  filter.connect(gain).connect(ctx.destination);
  low.start();high.start();
  vehicleSystem.audio={ctx,gain,low,high,filter};
  return vehicleSystem.audio;
 }catch(err){console.warn('Vehicle Web Audio unavailable',err);return null;}
}
function vehicleHorn(){
 const a=vehicleAudioInit();if(!a)return;
 a.ctx.resume().catch(()=>{});
 const t=a.ctx.currentTime;
 for(const hz of [335,448]){
  const osc=a.ctx.createOscillator(),gain=a.ctx.createGain();
  osc.type='square';osc.frequency.value=hz;
  gain.gain.setValueAtTime(.0001,t);
  gain.gain.exponentialRampToValueAtTime(.056,t+.02);
  gain.gain.exponentialRampToValueAtTime(.0001,t+.34);
  osc.connect(gain).connect(a.ctx.destination);
  osc.start(t);osc.stop(t+.36);
 }
}
function vehicleSound(){
 const a=vehicleSystem.audio;if(!a)return;
 const b=vehicleSystem.driver,enabled=!!(b&&b.engine),
  t=a.ctx.currentTime,sp=enabled?Math.abs(b.speed):0,
  rpm=enabled?Math.max(680,b.rpm||780):150;
 a.gain.gain.setTargetAtTime(enabled?.047+sp*.0017:0,t,.08);
 a.low.frequency.setTargetAtTime(rpm/23,t,.06);
 a.high.frequency.setTargetAtTime(rpm/11.6,t,.08);
 a.filter.frequency.setTargetAtTime(260+sp*40,t,.12);
}
function vehicleNear(player){
 let target=null,dist=3.35;
 for(const b of vehicleSystem.cars){
  if(b.occupied)continue;
  const d=Math.hypot(b.x-player.x,b.y-player.y);
  if(d<dist){dist=d;target=b;}
 }
 return target;
}
function vehicleExitClear(b,x,y){
 if(x<1||y<1||x>MAP-1||y>MAP-1||pondVal(x,y)<1.06)return false;
 for(const H of houses)if(x>H.x0-.35&&x<H.x1+.35&&
   y>H.y0-.35&&y<H.y1+.35)return false;
 for(const Y of world.yards)if(x>Y[0]-.2&&x<Y[2]+.2&&
   y>Y[1]-.2&&y<Y[3]+.2)return false;
 for(const other of boxes){
  if(other===b||other.house&&!other.exteriorFixture)continue;
  if(Math.hypot(other.x-x,other.y-y)<
    Math.max(other.w,other.d)*.52+.26)return false;
 }
 return true;
}
function vehicleInteraction(player){
 const sys=vehicleSystem;
 if(sys.driver){
  const b=sys.driver,m=carModel(b),
   exit=carPoint(b,-.32,m.w*.5+1.05,0);
  if(!vehicleExitClear(b,exit[0],exit[1]))
   return 'Porta bloqueada: manobre antes de sair';
  player.x=exit[0];player.y=exit[1];player.face=b.rot;
  b.occupied=false;b.engine=false;b.brake=true;b.speed=0;
  sys.driver=null;vehicleSound();
  return 'Saiu do '+m.name;
 }
 const b=vehicleNear(player);if(!b)return null;
 sys.driver=b;b.occupied=true;b.engine=true;b.rpm=800;
 player.aimHold=0;player.wantShot=false;b.speed=0;
 b.headlights=!!world.night;
 const audio=vehicleAudioInit();if(audio)audio.ctx.resume().catch(()=>{});
 return 'Entrou no '+carModel(b).name+' — W acelera, S freia, A/D viram';
}
function vehicleUpdate(dt,player){
 const sys=vehicleSystem,b=sys.driver;
 if(!b){vehicleSound();return;}
 const m=carModel(b),
  forward=input.down('w')||input.down('arrowup'),
  reverse=input.down('s')||input.down('arrowdown'),
  left=input.down('a')||input.down('arrowleft'),
  right=input.down('d')||input.down('arrowright'),
  handbrake=input.down(' '),
  road=roadDist(b.x,b.y)<ROAD_W+.18,
  grip=road?1:.62,acc=m.acc*(road?1:.50);
 if(input.hit('x'))b.engine=!b.engine;
 if(input.hit('l'))b.headlights=!b.headlights;
 if(input.hit('z')){b.indicator=b.indicator===1?0:1;b.hazards=false;}
 if(input.hit('c')){b.indicator=b.indicator===-1?0:-1;b.hazards=false;}
 if(input.hit('b')){b.hazards=!b.hazards;b.indicator=0;}
 if(input.hit('h'))vehicleHorn();
 const steerTarget=(left?1:0)-(right?1:0);
 b.steer=lerp(b.steer,steerTarget,1-Math.exp(-dt*6));
 let accel=0;
 if(b.engine){
  if(forward)accel+=acc;
  if(reverse)accel-=b.speed>1?acc*2.0:acc*.68;
 }
 const drag=.45+Math.abs(b.speed)*.034+(handbrake?12:0)+(!road?1.4:0);
 b.speed+=accel*dt;
 b.speed-=b.speed*Math.min(.95,drag*dt);
 b.speed=clamp(b.speed,-m.max*.38,m.max);
 if(!b.engine)b.speed*=Math.exp(-dt*2.3);
 if(Math.abs(b.speed)<.028&&!forward&&!reverse)b.speed=0;
 const steering=b.steer*(b.speed/Math.max(2.5,m.len*.73))*grip,
  nextRot=b.rot+clamp(steering*dt,-.14,.14),
  nx=b.x+Math.cos(nextRot)*b.speed*dt,
  ny=b.y+Math.sin(nextRot)*b.speed*dt;
 b.brake=reverse||handbrake;b.reverse=b.speed<-.13;
 if(vehicleCanOccupy(b,nx,ny,nextRot)){
  b.x=nx;b.y=ny;b.rot=nextRot;b.odometer+=b.speed*dt;
 }else{b.speed=0;b.brake=true;}
 const pedal=forward||reverse;
 b.rpm=b.engine?clamp(800+Math.abs(b.speed)*160+(pedal?1120:0),680,5700):0;
 const seat=carPoint(b,.12,m.w*.22,0);
 player.x=seat[0];player.y=seat[1];player.face=b.rot;
 player.speed=0;player.running=false;player.aiming=false;
 player.wantShot=false;player.flash=0;
 vehicleSound();
}
function vehicleDrivingHUD(ctx,W,H){
 const b=vehicleSystem.driver;if(!b)return;
 const m=carModel(b),speed=Math.round(Math.abs(b.speed)*3.6),
   width=312,height=98,x=Math.max(24,W-width-24),y=H-287;
 ctx.save();ctx.fillStyle='rgba(13,17,19,.91)';
 ctx.strokeStyle='rgba(183,181,165,.54)';ctx.lineWidth=1;
 ctx.beginPath();ctx.roundRect(x,y,width,height,11);ctx.fill();ctx.stroke();
 ctx.textAlign='left';ctx.textBaseline='middle';
 ctx.fillStyle='#dfd4bc';ctx.font='600 13px system-ui';ctx.fillText(m.name,x+15,y+20);
 ctx.fillStyle='#f5f1e7';ctx.font='bold 30px system-ui';ctx.fillText(String(speed),x+14,y+52);
 ctx.font='12px system-ui';ctx.fillStyle='#a7b1af';ctx.fillText('km/h',x+69,y+53);
 ctx.font='600 11px system-ui';ctx.fillStyle=b.engine?'#b6d49a':'#df9a7d';
 ctx.fillText(b.engine?'MOTOR LIGADO':'MOTOR DESLIGADO',x+149,y+22);
 ctx.fillStyle=b.headlights?'#f4dea3':'#90999d';
 ctx.fillText('FARÓIS '+(b.headlights?'ON':'OFF'),x+149,y+41);
 ctx.fillStyle=b.hazards?'#f8b65e':'#b8c0bf';
 ctx.fillText(b.hazards?'PISCA ALERTA':
  b.indicator?'SETA '+(b.indicator===1?'ESQ':'DIR'):'SETAS OFF',x+149,y+61);
 ctx.fillStyle='#c5c3b8';ctx.font='10px system-ui';
 ctx.fillText('F sair · X motor · L faróis · Z/C setas · H buzina · B alerta',x+13,y+height-10);
 ctx.restore();
}
