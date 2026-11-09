// CityDriving: substitui somente interface e busca de saída, mantendo o sistema GLB original.
'use strict';
const CityDriving=(()=>{
 let patched=null;const qualityKey='cityofgod.graphics.quality.v1';let lastQuality='';
 function setQuality(q){
   if(!['high','balanced','economy'].includes(q))return false;
   lastQuality=q;try{localStorage.setItem(qualityKey,q);}catch(_){}
   // uma qualidade só: a do menu (vehicle-webgl.mjs applyQuality); 'economy' = baixa
   window.cityVehicles?.applyQuality?.(q==='economy'?'low':q);
   return true;
 }
 // a parede (ou cerca/muro) cruza o caminho do carro até o ponto? (sair da garagem não pode atravessar p/ dentro de casa)
 const cross=(ax,ay,bx,by,s)=>{
   const d1=(bx-ax)*(s.y1-ay)-(by-ay)*(s.x1-ax),d2=(bx-ax)*(s.y2-ay)-(by-ay)*(s.x2-ax);
   const d3=(s.x2-s.x1)*(ay-s.y1)-(s.y2-s.y1)*(ax-s.x1),d4=(s.x2-s.x1)*(by-s.y1)-(s.y2-s.y1)*(bx-s.x1);
   return (d1>0)!==(d2>0)&&(d3>0)!==(d4>0);
 };
 function wallBetween(b,ax,ay,bx,by){
   for(const s of b.world.segs||[]){
     if(s.door&&s.doorAnim?.open>=.72||s.sourceBox?.fleetHidden)continue;
     if(Math.max(s.x1,s.x2)<Math.min(ax,bx)-.1||Math.min(s.x1,s.x2)>Math.max(ax,bx)+.1||Math.max(s.y1,s.y2)<Math.min(ay,by)-.1||Math.min(s.y1,s.y2)>Math.max(ay,by)+.1)continue;
     if(cross(ax,ay,bx,by,s))return true;
   }
   return false;
 }
 // Ponto de saída: livre de paredes, móveis e de qualquer carro (parado ou no trânsito) com 45 cm de folga — a
 // carroceria visível é maior que a caixa de colisão, com 24 cm o jogador saía "dentro" do carro ao lado — e sem
 // parede entre o carro e o ponto.
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
       // conta todo carro, inclusive o próprio (o ponto precisa ficar fora da carroceria dele também)
       const q=b.collide(x,y,.45,0);
       if(Math.hypot(q[0]-x,q[1]-y)>.05)continue;
       if(b.world.blocked(x,y,.3))continue;
       if(wallBetween(b,car.x,car.y,x,y))continue;
       return {x,y};
     }
   }
   return null;
 }
 // painel do carro: mostrador redondo sem moldura, fundo transparente (estilo velocímetro de corrida)
 // escala de giro 0–8 (x1000) em volta, arco verde→amarelo→vermelho, agulha vermelha, marcha grande no centro,
 // indicadores (motor, faróis, combustível), velocidade grande embaixo e arco de combustível à esquerda
 const GEARS=[0,7,14,22,31,42,60];
 function gearAndRpm(car,engineOn){
   const sp=Math.abs(car.speed||0);
   if(!engineOn)return {gear:'N',rpm:0};
   if(car.speed<-.4)return {gear:'R',rpm:1100+Math.min(1,sp/8)*2600};
   if(sp<.5)return {gear:'N',rpm:850};
   const gi=Math.max(1,GEARS.findIndex(v=>sp<v)),i=gi<0?GEARS.length-1:gi,lo=GEARS[i-1]||0,hi=GEARS[i]||60;
   return {gear:String(i),rpm:Math.min(7900,1100+(sp-lo)/(hi-lo)*4600)};
 }
 function draw(g,w,h,v){
   if(!v.driver)return;
   const car=v.car||{},speed=Math.max(0,Math.round(Math.abs(car.speed||0)*3.6));
   const level=Math.max(0,Math.min(1,v.fuel?.level||0)),{gear,rpm}=gearAndRpm(car,v.engineOn);
   const R=w<680?72:98,cx=w/2,cy=h-R-34;   // embaixo, no centro (o canto direito tem os botões do menu)
   const MAXK=8,RED=6.5,A0=Math.PI*.72,A1=Math.PI*2.28,ang=k=>A0+(A1-A0)*k/MAXK;
   const P=(a,r)=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r];
   g.save();g.textAlign='center';g.textBaseline='middle';
   // véu bem leve atrás (só para ler sobre o céu claro), sumindo nas bordas: sem moldura
   const veil=g.createRadialGradient(cx,cy,R*.2,cx,cy,R*1.12);veil.addColorStop(0,'rgba(8,12,18,.38)');veil.addColorStop(.75,'rgba(8,12,18,.22)');veil.addColorStop(1,'rgba(8,12,18,0)');
   g.fillStyle=veil;g.beginPath();g.arc(cx,cy,R*1.12,0,Math.PI*2);g.fill();
   // anel fino
   g.strokeStyle='rgba(235,240,245,.35)';g.lineWidth=1.2;g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.stroke();
   // traços da escala (finos a cada 0,25; maiores a cada 1)
   for(let k=0;k<=MAXK*4;k++){
     const v1=k/4,a=ang(v1),major=k%4===0,[x1,y1]=P(a,R-3),[x2,y2]=P(a,R-(major?11:6));
     g.strokeStyle=v1>=RED?'rgba(255,90,80,.9)':major?'rgba(240,244,248,.85)':'rgba(220,228,236,.4)';g.lineWidth=major?2:1;
     g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
   }
   // números
   g.fillStyle='rgba(240,244,248,.85)';g.font=`500 ${Math.round(R*.12)}px "Segoe UI",system-ui`;
   for(let k=0;k<=MAXK;k++){const [x1,y1]=P(ang(k),R*.78);g.fillText(String(k),x1,y1);}
   // arco de giro: verde → amarelo → vermelho até a rotação atual
   const kr=Math.max(0,Math.min(MAXK,rpm/1000)),arcR=R+5;
   if(kr>0){
     const steps=Math.max(2,Math.round(kr*8));
     for(let s=0;s<steps;s++){
       const a=ang(kr*s/steps),b=ang(kr*(s+1)/steps)+.004,t=(kr*(s+.5)/steps)/MAXK;
       g.strokeStyle=t<.55?'#5fe08a':t<.78?'#f2d34a':'#ff4d42';g.lineWidth=R*.055;
       g.beginPath();g.arc(cx,cy,arcR,a,b);g.stroke();
     }
   }
   // faixa vermelha (zona de corte) por dentro
   g.strokeStyle='rgba(255,70,60,.55)';g.lineWidth=3;g.beginPath();g.arc(cx,cy,R-14,ang(RED),ang(MAXK));g.stroke();
   // marcador de troca (losango) quando chega na zona vermelha
   const [mx,my]=P(ang(RED),R+16);
   g.save();g.translate(mx,my);g.rotate(Math.PI/4);g.fillStyle=kr>=RED-.3?'#ff4d42':'rgba(240,244,248,.18)';g.fillRect(-4,-4,8,8);g.restore();
   // agulha (vermelha, com brilho), da borda dos números até fora do anel
   const an=ang(kr),[nx1,ny1]=P(an,R*.62),[nx2,ny2]=P(an,R+9);
   g.shadowColor='#ff2a1f';g.shadowBlur=10;g.strokeStyle='#ff3b30';g.lineWidth=3;g.lineCap='round';
   g.beginPath();g.moveTo(nx1,ny1);g.lineTo(nx2,ny2);g.stroke();g.shadowBlur=0;
   // combustível: arco curto por dentro, à esquerda (verde; amarelo e vermelho quando acaba)
   const f0=Math.PI*.82,f1=Math.PI*1.18,fr=R*.6;
   g.strokeStyle='rgba(255,255,255,.12)';g.lineWidth=4;g.beginPath();g.arc(cx,cy,fr,f0,f1);g.stroke();
   g.strokeStyle=level<.15?'#ff4d42':level<.35?'#f2d34a':'#5fe08a';g.beginPath();g.arc(cx,cy,fr,f1-(f1-f0)*level,f1);g.stroke();
   // marcha
   g.fillStyle=gear==='R'?'#ff7a70':'#f4f7fa';g.font=`300 ${Math.round(R*.34)}px "Segoe UI",system-ui`;
   g.fillText(gear,cx,cy-R*.36);
   // indicadores
   const ind=[['MOTOR',v.engineOn,'#5fe08a'],['FARÓIS',v.headlights,'#8fd3ff'],['COMB',level<.15,'#ff4d42']];
   g.font=`600 ${Math.max(8,Math.round(R*.085))}px "Segoe UI",system-ui`;
   const iw=R*.42;ind.forEach(([t,on,c],i)=>{g.fillStyle=on?c:'rgba(230,236,242,.38)';g.fillText(t,cx+(i-1)*iw,cy-R*.02);});
   g.fillStyle='rgba(230,236,242,.3)';[-.5,.5].forEach(o=>g.fillText('·',cx+o*iw,cy-R*.02));
   // velocidade
   g.fillStyle='#f6f9fb';g.font=`300 ${Math.round(R*.42)}px "Segoe UI",system-ui`;
   g.fillText(String(speed),cx,cy+R*.33);
   g.fillStyle='rgba(230,236,242,.7)';g.font=`500 ${Math.round(R*.11)}px "Segoe UI",system-ui`;
   g.fillText('km/h',cx,cy+R*.6);
   // comandos (bem discretos, embaixo do mostrador)
   g.fillStyle='rgba(225,232,238,.55)';g.font='10px system-ui';g.shadowColor='#000';g.shadowBlur=4;
   g.fillText('F sair · X motor · L faróis · H buzina',cx,cy+R+22);
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
     if(v.exitAt)return v.exitAt(pos);
     const p=window.cityVehicleBridge.player;p.x=pos.x;p.y=pos.y;
     v.driver=false;v.braking=false;v.car.speed=0;v.car.steer=0;
     return 'Você saiu do veículo';
   };
   v.drawHUD=(g,w,h)=>draw(g,w,h,v);
   try{lastQuality=localStorage.getItem(qualityKey)||'balanced';}catch(_){lastQuality='balanced';}
   return true;
 }
 return {install,setQuality,get quality(){return lastQuality||'high'}};
})();
window.CityDriving=CityDriving;