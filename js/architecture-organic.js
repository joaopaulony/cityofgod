// architecture-organic.js — gerador NOVO de plantas, ao lado do antigo (architecture-plan.js continua gerando tudo o que já existia).
// Em vez do corredor largo de frente a fundo com cômodos dos dois lados, a planta nasce do programa da casa:
//  · faixa social na frente (sala integrada à cozinha por um vão aberto, entrada pela sala, varanda opcional);
//  · corredor curto só para a parte íntima (quartos e banheiro), suíte quando cabe;
//  · área de serviço colada na cozinha, com porta para o quintal; depósito/escritório quando sobra lugar;
//  · formas em L (quintal lateral), varanda recuada e sobrado com escada encostada na parede e sacada na suíte.
// Também divide cada andar dos prédios residenciais em 2 (ou 4) apartamentos com porta própria (apartmentFloor).
// Mesma estrutura de planta do gerador antigo (levels/rooms/walls/furniture/audit): o resto do jogo não muda.
// O cômodo de entrada continua com id 'hall' (escada, entrada e luz geral dependem dele).
(function(root){
 'use strict';
 const ARCH=root.CityArchitecture||(typeof require==='function'?require('./architecture-plan.js'):null);
 const {rect,round,rng,makeWalls,auditPlan,inside,orientFurniture}=ARCH._kit;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

 // ---------- catálogo de modelos (medidas reais em metros: frente × fundo) ----------
 const LAYOUTS={
  estreita:{name:'Casa estreita',desc:'Sala na frente, cozinha, corredor lateral, 1 quarto · para lote estreito',w:6.4,d:12.5,floors:1,beds:1,narrow:true,cost:52000,icon:'🏠'},
  vila:{name:'Casa de vila',desc:'Varandinha, sala, cozinha, 2 quartos e corredor lateral · lote estreito e fundo',w:7.4,d:15,floors:1,beds:2,narrow:true,porch:1,cost:68000,icon:'🏡'},
  integrada:{name:'Térrea integrada',desc:'Sala e cozinha americana, 2 quartos, área de serviço',w:10,d:10.8,floors:1,beds:2,cost:74000,icon:'🏡'},
  varanda:{name:'Casa com varanda',desc:'Varanda na frente, suíte + 1 quarto, lavanderia e depósito',w:11,d:12,floors:1,beds:2,suite:true,porch:1.8,cost:96000,icon:'🏡'},
  emL:{name:'Casa em L',desc:'3 quartos (1 suíte) em L, quintal lateral nos fundos',w:12.5,d:12.5,floors:1,beds:3,suite:true,rearCut:true,cost:118000,icon:'🏘️'},
  ampla:{name:'Térrea ampla',desc:'3 quartos + escritório, suíte, varanda e depósito',w:14,d:13.5,floors:1,beds:3,suite:true,porch:2,office:true,cost:158000,icon:'🏰'},
  sobrado:{name:'Sobrado moderno',desc:'Embaixo sala e cozinha integradas, lavabo e quarto de hóspedes; em cima 2 quartos e suíte com sacada',w:9.5,d:12.5,floors:2,beds:3,porch:1.6,cost:172000,icon:'🏙️'}
 };

 // ---------- utilidades ----------
 const R2=v=>round(v);
 // mesmo formato de cômodo do gerador antigo
 const room=(id,use,x0,y0,x1,y1)=>rect(id,use,x0,y0,x1,y1);
 function mirrorX(W,rooms,links,level,masses,extra=[]){
  for(const r of rooms){const a=W-r.x1,b=W-r.x0;r.x0=R2(a);r.x1=R2(b);}
  for(const L of links){if(L.pos)L.pos=[W-L.pos[0],L.pos[1]];if(L.ext)L.ext=[-L.ext[0],L.ext[1]];}
  level.entry=[W-level.entry[0],level.entry[1]];
  for(const m of masses){const a=W-m.x1,b=W-m.x0;m.x0=R2(a);m.x1=R2(b);}
  for(const o of extra){const a=W-o.x1,b=W-o.x0;o.x0=R2(a);o.x1=R2(b);}
  if(level.stairSpec){level.stairSpec.x=W-level.stairSpec.x;}
 }
 // massas do telhado: faixas horizontais do contorno ocupado, juntando as que têm o mesmo vão em x (L, varanda recuada)
 function massesOf(rooms){
  const Y=[...new Set(rooms.flatMap(r=>[r.y0,r.y1]))].sort((a,b)=>a-b),bands=[];
  for(let i=0;i<Y.length-1;i++){const y=(Y[i]+Y[i+1])/2,cov=rooms.filter(r=>r.y0<y&&r.y1>y);if(!cov.length)continue;
   const x0=Math.min(...cov.map(r=>r.x0)),x1=Math.max(...cov.map(r=>r.x1)),prev=bands.at(-1);
   if(prev&&Math.abs(prev.x0-x0)<.01&&Math.abs(prev.x1-x1)<.01&&Math.abs(prev.y1-Y[i])<.01)prev.y1=Y[i+1];else bands.push({x0,y0:Y[i],x1,y1:Y[i+1]});}
  // a faixa principal (maior) fica primeiro: ela recebe o telhado mais alto
  return bands.sort((a,b)=>(b.x1-b.x0)*(b.y1-b.y0)-(a.x1-a.x0)*(a.y1-a.y0));
 }
 // divide um comprimento em pedaços com mínimos, distribuindo a sobra proporcionalmente
 function split(total,mins,weights){
  const need=mins.reduce((a,b)=>a+b,0),extra=Math.max(0,total-need),wsum=weights.reduce((a,b)=>a+b,0)||1;
  return mins.map((m,i)=>m+extra*weights[i]/wsum);
 }

 // ---------- casa térrea: social na frente, corredor curto, íntimo nos fundos, serviço ao lado da cozinha ----------
 function terrea(W,D,o,R){
  const rooms=[],links=[],p=o.porch?clamp(o.porch,1.4,2.2):0;
  const sd=clamp(D*.4,3.9,5.2),ys=R2(D-sd);                  // faixa social [ys,D]
  const cd=1.2,yc=R2(ys-cd);                                  // corredor [yc,ys]
  const kw=clamp(W*.36,2.8,4.4),xk=R2(W-kw);                  // cozinha [xk,W] na faixa social
  const sw=clamp(W*.22,2.1,2.9),xs=R2(W-sw);                  // coluna de serviço [xs,W] atrás da cozinha
  const ld=clamp(yc*.45+cd,2.5,3.6),yl=R2(Math.max(0,ys-ld));  // lavanderia [yl,ys]
  rooms.push(room('hall','living',0,ys,xk,D-p),room('kitchen','kitchen',xk,ys,W,D),room('corr','circulation',0,yc,xs,ys));
  const laundry=room('laundry','laundry',xs,yl<2.4&&!o.rearCut?0:yl,W,ys);rooms.push(laundry);
  if(!o.rearCut&&laundry.y0>0)rooms.push(room('storage','storage',xs,0,W,yl));
  // colunas íntimas [0,xs] × [0,yc]: banheiro no meio, quartos nas pontas (suíte na ponta externa)
  let beds=o.beds||2;const office=!!o.office;
  const minBed=2.7,minBath=1.9,minStudy=2.4;
  const fits=n=>minBath+n*minBed+(office?minStudy:0)<=xs+1e-6;
  while(beds>1&&!fits(beds))beds--;
  const suite=!!o.suite&&beds>=2&&yc>=5.2;
  const uses=[];for(let i=0;i<beds;i++)uses.push(i===0&&suite?'master':'bedroom');
  uses.splice(Math.min(1,uses.length),0,'bathroom');if(office)uses.push('study');
  const widths=split(xs,uses.map(u=>u==='bathroom'?minBath:u==='study'?minStudy:minBed),uses.map(u=>u==='bathroom'?.25:u==='master'?1.4:1));
  let x=0;
  uses.forEach((u,i)=>{
   const x1=i===uses.length-1?xs:R2(x+widths[i]),id=u==='master'?'master':u+(i+1);
   if(u==='master'){
    rooms.push(room('master','bedroom',x,2.2,x1,yc),room('ensuite','bathroom',x,0,x1,2.2));
    links.push({a:'master',b:'ensuite',pos:[x+.7,2.2]});
   }else if(u==='bathroom'&&yc-2.8>=1.7&&uses[i+1]==='bedroom'){
    rooms.push(room(id,'bathroom',x,R2(yc-2.8),x1,yc),room('closet','storage',x,0,x1,R2(yc-2.8)));
    links.push({a:'closet',b:'bedroom'+(i+2),pos:[x1,(yc-2.8)/2]});
   }else rooms.push(room(id,u==='bathroom'?'bathroom':u==='study'?'study':'bedroom',x,0,x1,yc));
   // porta perto da ponta da parede mais próxima da entrada do corredor (que fica do lado da cozinha)
   links.push({a:'corr',b:u==='master'?'master':id,pos:[x1-.6,yc]});
   x=x1;
  });
  links.push({a:'hall',b:'kitchen',kind:'passage',width:Math.min(2.6,(D-p-ys)-.7),pos:[xk,ys+(D-p-ys)*.55]});
  links.push({a:'hall',b:'corr',kind:'passage',width:1.05,pos:[Math.min(xk,xs)-.75,ys]});
  links.push({a:'kitchen',b:'laundry',pos:[W-.65,ys]});
  links.push({a:'laundry',ext:[1,0],pos:[W,(laundry.y0+ys)/2],style:'service'});
  if(rooms.some(r=>r.id==='storage'))links.push({a:'laundry',b:'storage',pos:[xs+.6,yl]});
  const level={rooms,links,entry:[R2(clamp(xk*.38,1.2,xk-1.2)),R2(D-p)],outdoor:[]};
  return {level,masses:massesOf(rooms)};
 }

 // ---------- casa estreita: sala na frente, cozinha, corredor lateral até os fundos ----------
 function estreita(W,D,o){
  const rooms=[],links=[],p=o.porch?clamp(o.porch,1,1.8):0,Df=D-p;
  const two=(o.beds||1)>1,sl=two?clamp(Df*.27,3.6,4):clamp(Df*.32,3.6,4.4),ys=R2(Df-sl),kd=two?clamp(Df*.21,2.8,3.1):clamp(Df*.25,2.8,3.4),yk=R2(ys-kd);
  const cw=1.2;
  rooms.push(room('hall','living',0,ys,W,Df),room('kitchen','kitchen',0,yk,W,ys),room('corr','circulation',0,0,cw,yk));
  const rest=yk,bath=two?1.9:2.1;let beds=Math.max(1,Math.min(o.beds||1,Math.floor((rest-bath)/2.65)));
  const dep=split(rest-bath,Array(beds).fill(2.65),Array(beds).fill(1));
  rooms.push(room('bathroom','bathroom',cw,R2(yk-bath),W,yk));links.push({a:'corr',b:'bathroom',pos:[cw,yk-bath+.6]});
  let y=R2(yk-bath);
  for(let i=0;i<beds;i++){const y0=i===beds-1?0:R2(y-dep[i]),id='bedroom'+(i+1);rooms.push(room(id,'bedroom',cw,y0,W,y));links.push({a:'corr',b:id,pos:[cw,y-.6]});y=y0;}
  links.push({a:'hall',b:'kitchen',kind:'passage',width:Math.min(2.4,W-1.2),pos:[W*.6,ys]});
  links.push({a:'kitchen',b:'corr',kind:'passage',width:.95,pos:[cw/2,yk]});
  links.push({a:'kitchen',ext:[1,0],pos:[W,(yk+ys)/2],style:'service'});
  const level={rooms,links,entry:[R2(W*.68),R2(Df)],outdoor:[]};
  return {level,masses:massesOf(rooms)};
 }

 // ---------- sobrado: escada encostada na parede da sala, patamar largo em cima, suíte com sacada ----------
 function sobrado(W,D,o,floor){
  const p=o.porch?clamp(o.porch,1.4,2.0):0,Dp=R2(D-p);
  const a=R2(clamp(Dp*.36,3.1,4.2)),kw=clamp(W*.38,3,4),xk=R2(W-kw);
  // escada: eixo y, encostada na parede esquerda da sala; sobe de frente p/ os fundos
  const stair={x:.6,y:R2(a+1.55),axis:'y',dir:1,side:1};
  if(floor===0){
   const rooms=[],links=[];
   rooms.push(room('hall','living',0,a,xk,Dp),room('kitchen','kitchen',xk,a,W,Dp));
   const lav=1.9,xb=R2(Math.max(2.9,xk-lav));
   rooms.push(room('guest','bedroom',0,0,xb,a),room('lavabo','bathroom',xb,0,xk,a),room('laundry','laundry',xk,0,W,a));
   links.push({a:'hall',b:'kitchen',kind:'passage',width:Math.min(2.4,Dp-a-.8),pos:[xk,a+(Dp-a)*.6]});
   links.push({a:'hall',b:'guest',pos:[xb-.6,a]},{a:'hall',b:'lavabo',pos:[xb+.55,a]});
   links.push({a:'kitchen',b:'laundry',pos:[W-.6,a]},{a:'laundry',ext:[0,-1],pos:[(xk+W)/2,0],style:'service'});
   const level={rooms,links,entry:[R2(clamp(xk*.62,2.6,xk-.9)),Dp],outdoor:[],stairSpec:stair};
   return {level,masses:[{x0:0,y0:0,x1:W,y1:Dp}]};
  }
  // andar de cima: patamar/corredor [0,hw] em toda a profundidade, cômodos empilhados do lado
  const hw=2.3,rooms=[room('hall','circulation',0,0,hw,Dp)],links=[];
  const ensuiteW=2.1,masterD=clamp(Dp*.36,3.4,4.4),yM=R2(Dp-masterD);
  const restUses=['bedroom','bathroom','bedroom'],mins=[2.8,1.9,2.8];
  if(yM<mins.reduce((s,v)=>s+v,0)){restUses.pop();mins.pop();}
  const dep=split(yM,mins,restUses.map(u=>u==='bathroom'?.2:1));
  let y=0;
  restUses.forEach((u,i)=>{const y1=i===restUses.length-1?yM:R2(y+dep[i]),id=u+(i+1);rooms.push(room(id,u,hw,y,W,y1));links.push({a:'hall',b:id,pos:[hw,y1-.6]});y=y1;});
  rooms.push(room('master','bedroom',hw,yM,R2(W-ensuiteW),Dp),room('ensuite','bathroom',R2(W-ensuiteW),yM,W,Dp));
  links.push({a:'hall',b:'master',pos:[hw,yM+.6]},{a:'master',b:'ensuite',pos:[W-ensuiteW,Dp-.6]});
  const outdoor=[];
  if(p>0){outdoor.push(room('balcony','balcony',hw+.2,Dp,R2(W-ensuiteW-.2),D));links.push({a:'master',ext:[0,1],pos:[(hw+W-ensuiteW)/2,Dp],style:'glazed',width:1.6});}
  const level={rooms,links,entry:[R2(hw/2),Dp],outdoor};
  return {level,masses:[{x0:0,y0:0,x1:W,y1:Dp}]};
 }

 // ---------- mobília: encostada nas paredes livres, nunca na frente de porta, vão ou escada ----------
 // espaço de uso na frente de cada peça (abrir porta/gaveta, sentar, ver TV); a cama ainda precisa de um lado livre
 const CLEAR={bed:.55,sofa:.75,tv:1.1,fridge:.9,stove:.8,sink:.7,counter:.7,wardrobe:.8,desk:.8,shelf:.6,toilet:.6,shower:.6,cabinet:.6,qf_bathroom_washingmachine:.7};
 const PAL={bed:['#92b1a6','#c9b8a6','#a9b9cf','#d8c3a5'],sofa:['#839b93','#8d7f73','#5f7a8a','#b38b6d'],wood:['#b9946e','#9a7048','#c9a77d','#7d5a3c']};
 function furnishLevel(level,seed){
  const R=rng(seed),pick=a=>a[(R()*a.length)|0];
  const portals=[];
  for(const w of level.walls){const len=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);
   for(const o of w.openings)if(o.kind!=='window'){const t=o.at/len;portals.push({x:w.a[0]+(w.b[0]-w.a[0])*t,y:w.a[1]+(w.b[1]-w.a[1])*t,rooms:w.rooms,width:o.width});}}
  if(level.floor===0&&level.entry)portals.push({x:level.entry[0],y:level.entry[1],rooms:['hall'],width:1.15});
  const stairs=[];
  for(const s of [level.stairSpec,level.stairAbove].filter(Boolean)){const hu=1.45,hv=.56;stairs.push(s.axis==='x'?[s.x-hu,s.y-hv,s.x+hu,s.y+hv]:[s.x-hv,s.y-hu,s.x+hv,s.y+hu]);}
  const all=[];
  for(const r of level.rooms){
   const items=[],zones=[],mine=portals.filter(p=>p.rooms.includes(r.id));
   const hit=(a,b,pad=0)=>a[0]<b[2]+pad&&a[2]>b[0]-pad&&a[1]<b[3]+pad&&a[3]>b[1]-pad;
   const rectOf=b=>[b.x-b.w/2,b.y-b.d/2,b.x+b.w/2,b.y+b.d/2];
   // área livre: dentro do cômodo e sem nenhum móvel em cima
   const clearOk=z=>inside(r,z[0],z[1],.02)&&inside(r,z[2],z[3],.02)&&!items.some(b=>hit(z,rectOf(b),-.01));
   const free=(x0,y0,x1,y1,loose=false)=>{
    if(!inside(r,x0,y0,.12)||!inside(r,x1,y1,.12))return false;
    for(const b of items)if(x0<b.x+b.w/2+.07&&x1>b.x-b.w/2-.07&&y0<b.y+b.d/2+.07&&y1>b.y-b.d/2-.07)return false;
    for(const z of zones)if(hit([x0,y0,x1,y1],z,-.01))return false;   // não ocupa o espaço de uso de outra peça
    for(const p of mine){const cx=clamp(p.x,x0,x1),cy=clamp(p.y,y0,y1);if(Math.hypot(cx-p.x,cy-p.y)<(loose?Math.max(.62,p.width/2+.12):Math.max(.9,p.width/2+.35)))return false;}
    for(const s of stairs)if(x0<s[2]+.35&&x1>s[0]-.35&&y0<s[3]+.35&&y1>s[1]-.35)return false;
    return true;};
   // lados da parede: rear (y0), front (y1), left (x0), right (x1); a ordem preferida põe a peça longe da porta principal
   const side=p=>Math.abs(p.y-r.y0)<.05?'rear':Math.abs(p.y-r.y1)<.05?'front':Math.abs(p.x-r.x0)<.05?'left':'right';
   const opposite={rear:'front',front:'rear',left:'right',right:'left'};
   const doorSides=mine.map(side),main=doorSides[0]||'front';
   const len=s=>s==='rear'||s==='front'?r.x1-r.x0:r.y1-r.y0;
   const order=pref=>{const base=['rear','front','left','right'].sort((a,b)=>(doorSides.filter(x=>x===a).length-doorSides.filter(x=>x===b).length)||(len(b)-len(a)));
    const first=pref==='far'?[opposite[main]]:pref?[pref]:[];return [...new Set([...first,...base])];};
   const add=(kind,x,y,w,d,h,extra={})=>{const b={room:r.id,kind,x:R2(x),y:R2(y),w:R2(w),d:R2(d),h,top:extra.top||pick(PAL.wood),side:extra.side||'#85684b',...extra};delete b.prefer;delete b.corner;delete b.loose;delete b.avoid;items.push(b);return b;};
   // peça contra a parede: along = paralelo à parede, depth = perpendicular
   function wall(kind,along,depth,h,opt={}){
    for(const s of order(opt.prefer)){if(s===opt.avoid)continue;
     const horiz=s==='rear'||s==='front',a0=horiz?r.x0:r.y0,a1=horiz?r.x1:r.y1,L=a1-a0;if(L<along+.3)continue;
     const c=opt.corner?[a0+.14+along/2,a1-.14-along/2]:[(a0+a1)/2];
     for(let k=0;k<=Math.ceil(L/.25);k++)c.push(a0+.14+along/2+k*.25);
     for(const u of c){if(u-along/2<a0+.12||u+along/2>a1-.12)continue;
      const off=.14+depth/2,v=s==='rear'?r.y0+off:s==='front'?r.y1-off:s==='left'?r.x0+off:r.x1-off;
      const [x,y,w,d]=horiz?[u,v,along,depth]:[v,u,depth,along];
      if(!free(x-w/2,y-d/2,x+w/2,y+d/2,!!opt.loose))continue;
      // espaço de uso na frente (e, na cama, um lado comprido livre para deitar/levantar)
      const c=CLEAR[kind]||0,n={rear:[0,1],front:[0,-1],left:[1,0],right:[-1,0]}[s],need=[];
      if(c){const zx=horiz?x:x+n[0]*(w/2+c/2),zy=horiz?y+n[1]*(d/2+c/2):y,zw=horiz?w:c,zd=horiz?c:d;need.push([zx-zw/2,zy-zd/2,zx+zw/2,zy+zd/2]);}
      if(need.length&&!opt.loose&&!need.every(clearOk))continue;
      if(kind==='bed'){
       const sides=horiz?[[x-w/2-.6,y-d/2,x-w/2,y+d/2],[x+w/2,y-d/2,x+w/2+.6,y+d/2]]:[[x-w/2,y-d/2-.6,x+w/2,y-d/2],[x-w/2,y+d/2,x+w/2,y+d/2+.6]];
       const side=sides.find(clearOk);if(!side)continue;need.push(side);
      }
      const b=add(kind,x,y,w,d,h,opt);zones.push(...need);return b;}
    }
    return null;
   }
   // peças obrigatórias: tenta do tamanho ideal ao menor que ainda serve
   function wallSizes(kind,sizes,depth,h,opt={}){for(const a of sizes){const b=wall(kind,a,depth,h,opt);if(b)return b;}
    for(const a of sizes){const b=wall(kind,a,depth,h,{...opt,prefer:null});if(b)return b;}
    for(const a of sizes){const b=wall(kind,a,depth,h,{...opt,prefer:null,corner:true,loose:true});if(b)return b;}
    if(opt.avoid!=null)return wallSizes(kind,sizes,depth,h,{...opt,avoid:null});return null;}
   function centre(kind,w,d,h,opt={}){
    const cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2;
    for(const [dx,dy] of [[0,0],[0,.5],[0,-.5],[.5,0],[-.5,0],[0,1],[0,-1],[1,0],[-1,0]]){const x=cx+dx,y=cy+dy;if(free(x-w/2,y-d/2,x+w/2,y+d/2))return add(kind,x,y,w,d,h,opt);}
    return null;
   }
   const W=r.x1-r.x0,Dd=r.y1-r.y0,area=W*Dd;
   switch(r.use){
    case'living':{const sofa=wallSizes('sofa',[2.2,1.8,1.5],.86,.6,{prefer:'far',top:pick(PAL.sofa)});
     if(sofa){const ss=sofaSide(sofa,r),n={rear:[0,1],front:[0,-1],left:[1,0],right:[-1,0]}[ss];
      wallSizes('tv',[1.1,.9],.42,.8,{prefer:opposite[ss],avoid:ss,top:'#30363b'});   // de frente p/ o sofá, nunca ao lado dele
      // mesa de centro na frente do sofá
      const tx=sofa.x+n[0]*1.05,ty=sofa.y+n[1]*1.05,[tw,td]=n[0]?[.6,1]:[1,.6];
      if(free(tx-tw/2,ty-td/2,tx+tw/2,ty+td/2))add('table',tx,ty,tw,td,.42,{top:pick(PAL.wood)});}
     if(area>14)wall('shelf',1.4,.42,1.8,{});
     wall('bigplant',.6,.6,1.6,{corner:true});break;}
    case'kitchen':{wallSizes('fridge',[.72,.62],.7,1.85,{prefer:'far',corner:true,top:'#ecebe6'});wallSizes('stove',[.75,.6],.62,.9,{prefer:'far',top:'#c6c4be'});
     wallSizes('sink',[.8,.6],.6,.9,{prefer:'far',top:'#e6e0d5'});wall('counter',Math.min(1.6,Math.max(W,Dd)-2.2),.62,.9,{prefer:'far'});
     if(area>=9.5){const t=centre('table',1.2,.8,.75,{top:pick(PAL.wood)});if(t){for(const [dx,dy] of [[-.85,0],[.85,0]]){const x=t.x+dx,y=t.y+dy;if(free(x-.22,y-.25,x+.22,y+.25))add('chair',x,y,.45,.5,.85,{top:pick(PAL.wood)});}}}
     break;}
    case'bedroom':{const big=area>=11;wallSizes('bed',big?[1.6,1.4,1.2,.95]:[1.2,.95],2.0,.55,{prefer:'far',top:pick(PAL.bed)});
     wall('wardrobe',big?1.43:1.1,.6,1.95,{});
     if(!big||area>14)wall('desk',1.1,.6,.75,{});wall('plant',.44,.44,.74,{corner:true});break;}
    case'bathroom':{wallSizes('shower',[.9,.8],.85,1.9,{corner:true,top:'#bad1d1'});wallSizes('toilet',[.45],.7,.55,{top:'#eeece6'});wallSizes('sink',[.6,.5],.45,.85,{top:'#eee9dd'});break;}
    case'laundry':{wall('qf_bathroom_washingmachine',.62,.62,.9,{corner:true});wall('sink',.65,.55,.9,{top:'#d9d6cf'});wall('cabinet',1,.46,1.6,{});break;}
    case'study':{wall('desk',1.25,.62,.75,{prefer:'far'});wall('shelf',1.4,.42,1.8,{});wall('chair',.45,.5,.85,{});break;}
    case'storage':{wall('shelf',Math.min(1.8,Math.max(W,Dd)-.6),.45,1.8,{});wall('shelf',1.2,.45,1.6,{});break;}
    case'circulation':{if(area>5)wall('bigplant',.55,.55,1.5,{corner:true});break;}
   }
   all.push(...items);
  }
  level.furniture.push(...all);
 }
 // lado da parede em que a peça encostou
 function sofaSide(b,r){const d={rear:b.y-b.d/2-r.y0,front:r.y1-(b.y+b.d/2),left:b.x-b.w/2-r.x0,right:r.x1-(b.x+b.w/2)};return Object.entries(d).sort((a,c)=>a[1]-c[1])[0][0];}

 // ---------- planta completa ----------
 function makePlan({width:W,depth:D,layout='integrada',kind='bungalow',seed=1,floors,height=3}){
  const spec=LAYOUTS[layout]||LAYOUTS.integrada,R=rng(seed),count=spec.floors||1;
  const plan={version:1,kind,seed,width:W,depth:D,floorHeight:height,family:'organic',organic:layout,palette:Math.floor(R()*6),levels:[]};
  const mirror=R()<.5;
  for(let f=0;f<count;f++){
   const made=spec.floors>1?sobrado(W,D,spec,f):spec.narrow||W<8?estreita(W,D,spec):terrea(W,D,spec,R);
   const level=Object.assign({floor:f,kind,z:f*height,walls:[],furniture:[],setback:0,wingRecess:0},made.level);
   if(mirror)mirrorX(W,level.rooms,level.links,level,made.masses,level.outdoor);
   level.masses=made.masses;
   plan.levels.push(level);
  }
  // a escada do térreo também reserva o lugar no andar de cima (o vão do piso)
  const s0=plan.levels[0].stairSpec;if(s0&&plan.levels[1])plan.levels[1].stairAbove=s0;
  plan.stairSpec=s0||null;plan.masses=plan.levels.at(-1).masses;
  plan.levels.forEach((level,i)=>{makeWalls(level,seed+i);furnishLevel(level,seed+i*71);orientFurniture(level);});
  plan.signature=JSON.stringify(plan.levels[0].rooms.map(r=>[r.use,r.x0,r.y0,r.x1,r.y1]));
  plan.audit=auditPlan(plan);
  return plan;
 }

 // ---------- prédio residencial: cada andar vira 2 (ou 4) apartamentos com porta própria no corredor ----------
 // bloco de um lado do corredor do prédio; inner = parede que encosta no corredor; living = ponta onde fica a sala
 function apartment(u,x0,x1,y0,y1,inner,livingEnd){
  const P='u'+u+'-',rooms=[],links=[],bw=x1-x0,bd=y1-y0,inR=inner==='right';
  const ld=clamp(bd*.42,3.6,5.6),cw=1.2;
  const front=livingEnd==='front',ly0=front?R2(y1-ld):y0,ly1=front?y1:R2(y0+ld),py0=front?y0:ly1,py1=front?ly0:y1;
  const lw=clamp(bw*.56,3.2,bw-2.3),xi=inR?x1:x0,xo=inR?x0:x1,s=inR?-1:1;   // s: do corredor para fora
  const X=(a,b)=>[Math.min(a,b),Math.max(a,b)];
  const [lx0,lx1]=X(xi,xi+s*lw),[kx0,kx1]=X(xi+s*lw,xo),[cx0,cx1]=X(xi,xi+s*cw),[ox0,ox1]=X(xi+s*cw,xo);
  rooms.push(room(P+'living','living',lx0,ly0,lx1,ly1),room(P+'kitchen','kitchen',kx0,ly0,kx1,ly1));
  links.push({a:'hall',b:P+'living',pos:[xi,front?ly0+.75:ly1-.75],unit:u},{a:P+'living',b:P+'kitchen',kind:'passage',width:Math.min(2.2,ld-.8),pos:[xi+s*lw,(ly0+ly1)/2]});
  const pd=py1-py0,edge=front?ly0:ly1;
  // prédio raso: banheiro e quarto lado a lado, os dois com porta direto da sala (sem corredor interno)
  if(pd<5.6){
   const [bx0,bx1]=X(xi,xi+s*2.1),[qx0,qx1]=X(xi+s*2.1,xo);
   rooms.push(room(P+'bathroom0','bathroom',bx0,py0,bx1,py1),room(P+'bedroom1','bedroom',qx0,py0,qx1,py1));
   links.push({a:P+'living',b:P+'bathroom0',pos:[xi+s*1.05,edge]},{a:P+'living',b:P+'bedroom1',pos:[xi+s*Math.min(lw-.6,2.8),edge]});
   return {rooms,links,unit:{id:u,rooms:rooms.map(r=>r.id),door:P+'living'}};
  }
  rooms.push(room(P+'corr','circulation',cx0,py0,cx1,py1));
  links.push({a:P+'living',b:P+'corr',kind:'passage',width:.95,pos:[xi+s*cw/2,edge]});
  // cômodos íntimos empilhados a partir da sala: banheiro, quartos
  const bath=2,beds=Math.max(1,Math.min(3,Math.floor((pd-bath)/3)));
  const seq=['bathroom',...Array(beds).fill('bedroom')],dep=split(pd,[bath,...Array(beds).fill(2.8)],[.15,...Array(beds).fill(1)]);
  let y=front?py1:py0;
  seq.forEach((use,i)=>{const d=i===seq.length-1?Math.abs((front?py0:py1)-y):dep[i],ya=front?R2(y-d):y,yb=front?y:R2(y+d),id=P+use+i;
   rooms.push(room(id,use,ox0,ya,ox1,yb));links.push({a:P+'corr',b:id,pos:[xi+s*cw,front?yb-.6:ya+.6]});y=front?ya:yb;});
  return {rooms,links,unit:{id:u,rooms:rooms.map(r=>r.id),door:P+'living'}};
 }
 function apartmentFloor({w,d,left,right,dl=d,dr=d}){
  const rooms=[],links=[],units=[];let u=0;
  // cada lado do corredor acompanha a fachada do térreo (alas recuadas continuam recuadas)
  const per=d>=19?2:1;   // prédio fundo: dois apartamentos de cada lado (frente e fundos), dos dois lados igual
  for(const [x0,x1,inner,d] of [[0,left,'right',dl],[right,w,'left',dr]]){
   if(x1-x0<5.4)continue;
   // a sala fica do lado do meio do prédio no apto dos fundos e na fachada no da frente: as duas salas encostam no corredor
   const cuts=per===2?[[0,R2(d/2)],[R2(d/2),d]]:[[0,d]];
   for(const [y0,y1] of cuts){const A=apartment(u,x0,x1,y0,y1,inner,'front');rooms.push(...A.rooms);links.push(...A.links);units.push(A.unit);u++;}
  }
  return {rooms,links,units};
 }

 // ---------- modelos de casa (TPL) para os bairros e para os terrenos ----------
 // gerados a partir do catálogo: a fachada, a escala e o encaixe no lote seguem o mesmo caminho das casas antigas
 function templates(){
  const out={};
  for(const [key,L] of Object.entries(LAYOUTS)){
   const w=Math.round(L.w),d=Math.round(L.d),two=L.floors>1,fh=2.85;
   out['O_'+key]={w,d,setback:2.8,yard:true,organic:key,noScale:true,
    def:{h:two?fh*2:fh,...(two?{storeys:2,floorHeight:fh}:{}),roofKind:two?'hip':'gable',ext:'#e9e1d0',int:'#d9cfbd',roof:'#7a3b2c',trim:'#f4f1ea',
     open:{S:{door:[Math.max(1,Math.floor(w*.4))],win:[]}},floors:[{x0:0,y0:0,x1:w,y1:d,kind:'wood'}]},furn:[]};
  }
  return out;
 }

 const api={LAYOUTS,makePlan,apartmentFloor,furnishLevel,templates,massesOf};
 root.CityOrganic=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
