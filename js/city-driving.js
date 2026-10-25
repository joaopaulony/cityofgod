// CityDriving: substitui somente interface e busca de saída, mantendo o sistema GLB original.
'use strict';
const CityDriving=(()=>{
 let patched=null;const qualityKey='cityofgod.graphics.quality.v1';let lastQuality='';
 function setQuality(q){
   if(!['high','balanced','economy'].includes(q))return false;
   lastQuality=q;try{localStorage.setItem(qualityKey,q);}catch(_){}
   const v=window.cityVehicles;
   if(!v?.renderer)return true;
   const ratio=q==='economy'?1:q==='balanced'?1.25:1.5;
   v.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,ratio));
   if(v.scene?.userData?.lights){
     const sun=v.scene.userData.lights[1]?.[0];
     if(sun?.shadow?.mapSize){
       const sz=q==='economy'?1024:q==='balanced'?2048:4096;
       if(sun.shadow.mapSize.x!==sz){sun.shadow.mapSize.set(sz,sz);sun.shadow.map?.dispose?.();sun.shadow.map=null;sun.shadow.needsUpdate=true;}
     }
   }
   return true;
 }
 function safePosition(v){
   const b=window.cityVehicleBridge,p=b?.player,car=v.car;if(!b||!p||!car)return null;
   const r=Math.max(1.6,(v.carLength||4.4)*.33);
   const around=[r+0.3,r+0.9,r+1.6,r+2.3,r+3.2,r+4.5,r+6.5];
   const normal=car.angle+Math.PI/2;
   for(const d of around){
     for(let j=0;j<24;j++){
       const angle=normal + (j%2?-1:1)*Math.ceil(j/2)*Math.PI/12;
       const x=car.x+Math.cos(angle)*d,y=car.y+Math.sin(angle)*d;
       if(b.pondVal(x,y)<=1.12)continue;
       // O collider do próprio carro não invalida os pontos ao redor.
       const q=b.collide(x,y,.24,0);
       if(Math.hypot(q[0]-x,q[1]-y)>.14)continue;
       if(b.world.blocked(x,y,.23) && d<2.5)continue;
       return {x,y};
     }
   }
   return null;
 }
 function draw(g,w,h,v){
   if(!v.driver)return;
   const W=Math.min(550,Math.max(300,w*.49)),H=w<600?114:151,x=w/2-W/2,y=h-H-15;
   const car=v.car||{},speed=Math.max(0,Math.round(Math.abs(car.speed||0)*3.6)),gear=car.speed<-.4?'R':car.speed>.4?'D':'N';
   const level=Math.max(0,Math.min(1,v.fuel?.level||0));
   const compact=w<680;
   g.save();g.shadowColor='#0009';g.shadowBlur=22;g.fillStyle='rgba(6,15,25,.93)';
   g.strokeStyle='#6e899f';g.lineWidth=1.6;g.beginPath();g.roundRect(x,y,W,H,22);g.fill();g.stroke();
   g.shadowBlur=0;
   const grad=g.createLinearGradient(x,y,x+W,y+H);grad.addColorStop(0,'#243a51');grad.addColorStop(.55,'#0c1829');grad.addColorStop(1,'#061321');
   g.fillStyle=grad;g.beginPath();g.roundRect(x+5,y+5,W-10,H-10,18);g.fill();
   g.textAlign='center';g.textBaseline='middle';
   function dial(cx,cy,r,frac,title,baseColor,maxVal){
     const start=Math.PI*.78,end=Math.PI*2.22;
     g.strokeStyle='#ffffff26';g.lineWidth=8;g.beginPath();g.arc(cx,cy,r,start,end);g.stroke();
     const glow=g.createLinearGradient(cx-r,cy-r,cx+r,cy+r);glow.addColorStop(0,'#4fcaff');glow.addColorStop(1,baseColor);
     g.strokeStyle=glow;g.lineWidth=8;g.lineCap='round';g.beginPath();g.arc(cx,cy,r,start,start+(end-start)*Math.min(1,frac));g.stroke();
     for(let k=0;k<=10;k++){
       const a=start+(end-start)*k/10,inn=r-13,out=r-7;
       g.strokeStyle='#c6dceb90';g.lineWidth=1;g.beginPath();
       g.moveTo(cx+Math.cos(a)*inn,cy+Math.sin(a)*inn);g.lineTo(cx+Math.cos(a)*out,cy+Math.sin(a)*out);g.stroke();
     }
     g.fillStyle='#8daaba';g.font='bold 9px system-ui';g.fillText(title,cx,cy+r*.55);
     const a=start+(end-start)*Math.min(1,frac);
     g.strokeStyle='#e9f7ff';g.lineWidth=2;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a)*(r-18),cy+Math.sin(a)*(r-18));g.stroke();
     g.fillStyle='#e8faff';g.beginPath();g.arc(cx,cy,3,0,Math.PI*2);g.fill();
   }
   if(!compact){
     const rad=46,centerY=y+H/2+1;
     dial(x+79,centerY,rad,Math.min(1,speed/240),'km/h','#1983ea',240);
     dial(x+W-79,centerY,rad,Math.min(1,(speed/35+(!v.engineOn?0:1))/8),'RPM x1000','#5e9cdd',8);
   }
   g.fillStyle='#e6f9ff';g.shadowColor='#53ccff';g.shadowBlur=8;
   g.font='800 '+(compact?36:44)+'px "Segoe UI",system-ui';
   g.fillText(String(speed).padStart(2,'0'),x+W/2,y+(compact?49:63));
   g.shadowBlur=0;g.font='600 11px system-ui';g.fillStyle='#93c7e7';
   g.fillText('KM/H',x+W/2,y+(compact?69:86));
   g.font='800 13px system-ui';g.fillStyle=gear==='R'?'#eea8a8':'#e7d4a1';
   g.fillText(gear,x+W/2,y+(compact?86:105));
   const fuelY=y+H-20,barW=compact?W*.67:W*.38,barX=x+W/2-barW/2;
   g.fillStyle='#102c3d';g.beginPath();g.roundRect(barX,fuelY,barW,7,4);g.fill();
   g.fillStyle=level<.15?'#f16e66':'#4be6bc';g.beginPath();g.roundRect(barX,fuelY,barW*level,7,4);g.fill();
   g.font='600 10px system-ui';g.fillStyle='#c9e0ef';
   g.textAlign='right';g.fillText('E',barX-7,fuelY+3);g.textAlign='left';g.fillText('F',barX+barW+8,fuelY+3);
   g.fillStyle=v.engineOn?'#69eabc':'#ff7f75';g.font='700 10px system-ui';g.textAlign='center';
   g.fillText(v.engineOn?'● MOTOR':'○ MOTOR',x+W/2,y+12);
   if(v.headlights){g.fillStyle='#b8e8ff';g.fillText('☼ FARÓIS',x+W-55,y+17);}
   g.fillStyle='#a9beca';g.font='10px system-ui';
   g.textAlign='right';g.fillText('F sair · X motor · L faróis · H buzina',x+W-15,y+H-8);
   g.restore();
 }
 function install(){
   const v=window.cityVehicles;if(!v || v===patched)return !!v;
   patched=v;
   const original=v.interact;
   v.interact=function(){
     if(!v.driver)return original();
     const pos=safePosition(v);
     if(!pos)return 'Saída bloqueada: nenhum ponto seguro ao redor do carro';
     const p=window.cityVehicleBridge.player;p.x=pos.x;p.y=pos.y;
     v.driver=false;v.braking=false;v.car.speed=0;v.car.steer=0;
     return 'Você saiu do veículo';
   };
   v.drawHUD=(g,w,h)=>draw(g,w,h,v);
   try{lastQuality=localStorage.getItem(qualityKey)||'balanced';}catch(_){lastQuality='balanced';}
   if(lastQuality!=='high')setQuality(lastQuality);
   return true;
 }
 return {install,setQuality,get quality(){return lastQuality||'high'}};
})();
window.CityDriving=CityDriving;