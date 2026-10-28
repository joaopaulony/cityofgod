import {petBreed,petColor,validPetRow} from './pet-catalog.mjs';
const KEY='cityofgod.house-pets.v1',MAX=24,PER_HOME=6;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const local=(H,p)=>H.architecture?.toLocal?.(p.x,p.y)||[p.x-H.x0,p.y-H.y0];
const inside=(H,p)=>H&&(H.contains?H.contains(p.x,p.y,p.floor||0):p.x>H.x0&&p.x<H.x1&&p.y>H.y0&&p.y<H.y1);

// Bounded local A* for reaching a nearby owner breadcrumb outdoors. Every edge
// is swept against the live collider, including vehicles, walls and water.
export function outdoorPetRoute(start,goal,free,radius=.16){
 const clear=(a,b)=>{const n=Math.max(1,Math.ceil(distance(a,b)/.15));for(let i=1;i<=n;i++)if(!free(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,radius))return false;return true;};
 if(clear(start,goal))return [{x:goal.x,y:goal.y,floor:goal.floor||0}];
 if(distance(start,goal)>24)return null;
 const step=.5,margin=3.5,x0=Math.min(start.x,goal.x)-margin,y0=Math.min(start.y,goal.y)-margin;
 const nx=Math.ceil((Math.abs(start.x-goal.x)+margin*2)/step)+1,ny=Math.ceil((Math.abs(start.y-goal.y)+margin*2)/step)+1;
 if(nx*ny>4096)return null;
 const at=id=>({x:x0+(id%nx)*step,y:y0+Math.floor(id/nx)*step,floor:goal.floor||0});
 const index=(x,y)=>y*nx+x,valid=new Map();
 const pass=id=>{if(!valid.has(id)){const p=at(id);valid.set(id,free(p.x,p.y,radius));}return valid.get(id);};
 const nearest=p=>{
  const x=Math.round((p.x-x0)/step),y=Math.round((p.y-y0)/step);let best=null,bestD=Infinity;
  for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-2;xx<=x+2;xx++)if(xx>=0&&yy>=0&&xx<nx&&yy<ny){const id=index(xx,yy),q=at(id),d=distance(p,q);if(d<bestD&&pass(id)&&clear(p,q)){best=id;bestD=d;}}
  return best;
 };
 const first=nearest(start),last=nearest(goal);if(first===null||last===null)return null;
 const cost=new Map([[first,0]]),parent=new Map(),open=new Set([first]),closed=new Set();
 for(let tries=0;open.size&&tries<4096;tries++){
  let current=null,score=Infinity;for(const id of open){const s=cost.get(id)+distance(at(id),at(last));if(s<score){score=s;current=id;}}
  if(current===last){const points=[{x:goal.x,y:goal.y,floor:goal.floor||0}];let id=last;while(id!==undefined){points.push(at(id));id=parent.get(id);}return points.reverse();}
  open.delete(current);closed.add(current);const x=current%nx,y=Math.floor(current/nx),p=at(current);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=nx||yy>=ny)continue;
   const id=index(xx,yy);if(closed.has(id)||!pass(id)||!clear(p,at(id)))continue;
   const next=cost.get(current)+Math.hypot(dx,dy)*step;
   if(next<(cost.get(id)??Infinity)){cost.set(id,next);parent.set(id,current);open.add(id);}
  }
 }
 return null;
}

export function createPetController(services){
 const rows=[],pets=[],trail=[];let clock=0,sequence=0,syncTimer=0,lastStair=null,saveWarning=false;
 const notify=text=>services.notify?.(text),player=services.player;
 try{
  const saved=JSON.parse(services.storage?.getItem(KEY)||'null');
  if(saved?.version===1&&Array.isArray(saved.pets)){
    const retired=new Set(['yorkshire','rottweiler','pomeranian','fluffycat','slimcat','siamese']);
    const archived=saved.pets.filter(p=>retired.has(p?.breed));
    // Never destroy owners' old saves, even though these six generated animals
    // have been retired from the visible game catalog.
    if(archived.length&&!services.storage?.getItem('cityofgod.house-pets.retired-backup.v1')){
      try{services.storage?.setItem('cityofgod.house-pets.retired-backup.v1',
        JSON.stringify({version:1,pets:archived}));}catch{}
    }
  }
  if(saved?.version===1&&Array.isArray(saved.pets))for(const r of saved.pets.slice(0,MAX))if(validPetRow(r)&&!rows.some(p=>p.id===r.id)&&rows.filter(p=>p.home===r.home).length<PER_HOME)
   rows.push({id:r.id,breed:r.breed,color:r.color,name:r.name,home:r.home,floor:Number.isInteger(r.floor)&&r.floor>=0&&r.floor<20?r.floor:0});
 }catch{}
 function save(){try{services.storage?.setItem(KEY,JSON.stringify({version:1,pets:rows}));return true;}catch{if(!saveWarning){notify('Não foi possível salvar os pets neste navegador');saveWarning=true;}return false;}}
 const ownedHomes=()=>services.houses().filter(H=>services.owned(H));
 const homeFor=row=>ownedHomes().find(H=>services.key(H)===row.home);
 function homeAt(p){return ownedHomes().find(H=>inside(H,p))||null;}
 function free(x,y,r=.16,floor=0){
  const p=services.collide(x,y,r,floor);if(!p||Math.hypot(p[0]-x,p[1]-y)>.025)return false;
  return floor>0||!services.water||services.water(x,y);
 }
 function safeSpot(H,floor=0,near=player){
  const g=services.nav?.grid(H,floor);if(!g)return null;
  const candidates=[];
  for(let id=0;id<g.valid.length;id++)if(g.valid[id]){
   const x=g.x0+(id%g.nx)*g.step,y=g.y0+Math.floor(id/g.nx)*g.step;
   const q=H.architecture?.toWorld?.(x,y)||[x+H.x0,y+H.y0],p={x:q[0],y:q[1],floor};
   if(distance(p,player)>.6&&free(p.x,p.y,.20,floor)&&!pets.some(a=>a.floor===floor&&distance(a,p)<.55))candidates.push(p);
  }
  candidates.sort((a,b)=>distance(a,near)-distance(b,near));
  return candidates.slice(0,32).find(p=>services.nav.route(H,p,near,floor))||null;
 }
 function spawn(row,H){
  const floor=H.architecture?.levels?.[row.floor]?row.floor:0;
  const spot=safeSpot(H,floor,inside(H,player)?player:{x:(H.x0+H.x1)/2,y:(H.y0+H.y1)/2});if(!spot)return null;
  const pet={...row,...spot,floorZ:floor*(H.floorHeight||3),face:Math.random()*Math.PI*2,speed:0,phase:0,clock:0,
   mode:'home',action:'idle',path:[],step:0,cursor:sequence,radius:petBreed(row.breed)?.radius??(row.breed==='rottweiler'?.19:.12),
   timer:1+Math.random()*3,replan:0,stuck:0,homeHouse:H,homeLoaded:true,journey:[{...spot}],returnTrail:[],status:'Em casa',visible:true};
  pets.push(pet);return pet;
 }
 function sync(){
  for(const r of rows){const H=homeFor(r);if(H&&!pets.some(p=>p.id===r.id))spawn(r,H);}
  for(const p of pets){
   const loaded=homeFor(p);p.homeLoaded=!!loaded;
   if(loaded)p.homeHouse=loaded;else if(p.homeHouse&&!services.owned(p.homeHouse))p.homeHouse=null;
   p.visible=!!p.homeHouse&&(!!loaded||distance(p,player)<65);
  }
 }
 function adopt(breedId,colorId,name){
  const H=homeAt(player),breed=petBreed(breedId);
  if(!H)return {ok:false,text:'Entre na sua casa para receber um pet'};
  if(!breed||!breed.colors.some(c=>c.id===colorId))return {ok:false,text:'Escolha uma raça e uma cor válidas'};
  if(rows.length>=MAX||rows.filter(r=>r.home===services.key(H)).length>=PER_HOME)return {ok:false,text:'Esta família já tem seis pets'};
  const row={id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),
   home:services.key(H),breed:breed.id,color:petColor(breed,colorId).id,name:String(name||breed.names[0]).trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,24)||breed.names[0],floor:player.floor||0};
  if(!spawn(row,H))return {ok:false,text:'Libere um espaço no chão para receber o pet'};
  rows.push(row);save();return {ok:true,text:row.name+' chegou à família!'};
 }
 function closestTrail(p){
  let best=null,d=Infinity;
  for(const point of trail)if(point.floor===p.floor){const n=distance(p,point);if(n<d){best=point;d=n;}}
  return d<5?best:null;
 }
 function command(id,kind){
  const targets=pets.filter(p=>(id==='all'||p.id===id)&&p.homeHouse);
  if(!targets.length)return {ok:false,text:'Nenhum pet disponível nesta região'};
  if(!['follow','wait','home'].includes(kind))return {ok:false,text:'Comando inválido'};
  for(const pet of targets){
   pet.mode=kind;pet.path=[];pet.step=0;pet.replan=0;pet.stuck=0;pet.timer=0;
   pet.action=kind==='wait'?'sit':'idle';pet.status=kind==='follow'?'Seguindo você':kind==='wait'?'Esperando aqui':'Voltando para casa';
   if(kind==='home')pet.returnTrail=pet.journey.slice().reverse();
   const nearest=closestTrail(pet);pet.cursor=nearest?.seq??sequence;
  }
  return {ok:true,text:kind==='follow'?'Vamos passear! Os pets vêm pelo caminho livre.':kind==='wait'?'Os pets vão esperar aqui.':'Os pets vão voltar para casa.'};
 }
 function doors(pet){
  const H=pet.homeHouse;if(!H)return;
  for(const s of H.architecture?.openingSegments||H.segs||[])if(s.doorAnim&&!s.doorAnim.manual&&(s.floor||0)===pet.floor&&
    Math.hypot(pet.x-(s.x1+s.x2)/2,pet.y-(s.y1+s.y2)/2)<1.25)s.doorAnim.target=1;
 }
 function insideRoute(H,p,target){
  const route=services.nav?.route(H,p,target,p.floor);
  if(!route)return null;
  const points=route.points.map(q=>({...q,floor:p.floor})),last=points.at(-1);
  if(last&&distance(last,target)>.015){
   const n=Math.max(1,Math.ceil(distance(last,target)/.10));
   for(let i=1;i<=n;i++)if(!free(last.x+(target.x-last.x)*i/n,last.y+(target.y-last.y)*i/n,.20,p.floor))return null;
   points.push({x:target.x,y:target.y,floor:p.floor});
  }
  return points;
 }
 function plan(pet,target){
  const H=homeAt(pet),there=homeAt(target),home=pet.homeHouse;
  if(H&&H===there){
   if(pet.floor===(target.floor||0))return insideRoute(H,pet,target);
   const stair=H.architecture?.levels?.[pet.floor]?.stair;
   if(!stair)return null;
   const point=(target.floor||0)>pet.floor?stair.bottom:stair.top;
   const path=insideRoute(H,pet,{x:point[0],y:point[1]});
   return path&&[...path,{x:point[0],y:point[1],floor:pet.floor,stair:true}];
  }
  if(H){
   if(pet.floor>0){
    const stair=H.architecture?.levels?.[pet.floor]?.stair;if(!stair)return null;
    const p=stair.top,path=insideRoute(H,pet,{x:p[0],y:p[1]});return path&&[...path,{x:p[0],y:p[1],floor:pet.floor,stair:true}];
   }
   if(!H.doorPt||!H.doorN)return null;
   const [x,y]=H.doorPt,[nx,ny]=H.doorN,goal={x:x-nx*.75,y:y-ny*.75};
   const path=insideRoute(H,pet,goal);
   return path&&[...path,{...goal,floor:0},{x,y,floor:0},{x:x+nx,y:y+ny,floor:0}];
  }
  if(there){
   if(!there.doorPt||!there.doorN)return null;
   const [x,y]=there.doorPt,[nx,ny]=there.doorN;
   const outside={x:x+nx,y:y+ny,floor:0};
   const path=outdoorPetRoute(pet,outside,(x,y,r)=>free(x,y,r,0),pet.radius);
   return path&&[...path,{x,y,floor:0},{x:x-nx*.75,y:y-ny*.75,floor:0}];
  }
  if((target.floor||0)!==pet.floor||!home)return null;
  return outdoorPetRoute(pet,target,(x,y,r)=>free(x,y,r,pet.floor),pet.radius);
 }
 function walk(pet,dt,speed){
  const goal=pet.path[pet.step];if(!goal)return false;
  if(goal.stair&&distance(pet,goal)<.7){
   if(services.stairs?.(pet,0,true)){pet.path=[];pet.step=0;return true;}
   pet.status='Aguardando a escada';return false;
  }
  const d=distance(pet,goal);if(d<.10){pet.step++;return true;}
  const angle=Math.atan2(goal.y-pet.y,goal.x-pet.x),amount=Math.min(d,speed*dt);
  let x=pet.x+Math.cos(angle)*amount,y=pet.y+Math.sin(angle)*amount;
  for(const other of [...pets,player])if(other!==pet&&(other===player||other.visible)&&(other.floor||0)===pet.floor&&distance({x,y},other)<(pet.radius+(other.radius||.28))*.85){
   x=pet.x+Math.cos(angle)*amount*.45-Math.sin(angle)*amount*.45;
   y=pet.y+Math.sin(angle)*amount*.45+Math.cos(angle)*amount*.45;break;
  }
  const old={x:pet.x,y:pet.y};let moved=0;
  const count=Math.max(1,Math.ceil(amount/.09));
  for(let i=1;i<=count;i++){
   const nx=old.x+(x-old.x)*i/count,ny=old.y+(y-old.y)*i/count;
   const q=services.move(pet.x,pet.y,nx,ny,pet.radius,pet.floor);
   if(!q||!q.every(Number.isFinite)||Math.hypot(q[0]-pet.x,q[1]-pet.y)>amount/count*1.5+.015)break;
   moved+=Math.hypot(q[0]-pet.x,q[1]-pet.y);pet.x=q[0];pet.y=q[1];
  }
  pet.speed=moved/Math.max(.001,dt);pet.phase+=moved/(petBreed(pet.breed).species==='cat'?.34:.45)*Math.PI*2;
  pet.face+=Math.atan2(Math.sin(angle-pet.face),Math.cos(angle-pet.face))*(1-Math.exp(-dt*9));
  pet.action=pet.speed>1.5?'run':pet.speed>.04?'walk':'idle';pet.look=0;
  if(pet.mode==='follow'&&(!pet.journey.length||distance(pet,pet.journey.at(-1))>.30||pet.floor!==pet.journey.at(-1).floor)){
   pet.journey.push({x:pet.x,y:pet.y,floor:pet.floor});if(pet.journey.length>1800)pet.journey.splice(1,1);
  }
  pet.stuck=moved<.002?pet.stuck+dt:0;
  if(pet.stuck>1.8){pet.path=[];pet.step=0;pet.replan=1.5;pet.stuck=0;pet.status='Caminho bloqueado · aguardando passagem';}
  return moved>0;
 }
 function roam(pet,dt){
  const H=pet.homeHouse;if(!H||!inside(H,pet)){pet.mode='home';pet.status='Voltando para casa';return;}
  if(pet.path[pet.step]){walk(pet,dt,.48+(pet.breed==='rottweiler'?.25:0));return;}
  pet.timer-=dt;if(pet.timer>0)return;
  const activities=['idle','sniff','sit','sleep'];pet.action=activities[Math.floor(Math.random()*activities.length)];pet.timer=2+Math.random()*5;
  if(Math.random()<.42)return;
  const g=services.nav?.grid(H,pet.floor);if(!g)return;
  for(let n=0;n<16;n++){
   const id=Math.floor(Math.random()*g.valid.length);if(!g.valid[id])continue;
   const x=g.x0+(id%g.nx)*g.step,y=g.y0+Math.floor(id/g.nx)*g.step;
   const q=H.architecture?.toWorld?.(x,y)||[x+H.x0,y+H.y0],target={x:q[0],y:q[1],floor:pet.floor};
   if(distance(pet,target)<.7||distance(pet,target)>4)continue;
   const route=insideRoute(H,pet,target);if(route){pet.path=route;pet.step=0;pet.action='walk';break;}
  }
 }
 function recordTrail(){
  const tr=player.stairTravel;
  if(tr){
   if(tr!==lastStair){trail.push({x:tr.fromX,y:tr.fromY,floor:player.floor||0,floorZ:tr.start,stair:true,seq:++sequence});lastStair=tr;}
   return;
  }
  lastStair=null;const last=trail.at(-1);
  if(last&&distance(last,player)>12)trail.length=0;
  if(!last||last.stair||distance(last,player)>.22||last.floor!==(player.floor||0))trail.push({x:player.x,y:player.y,floor:player.floor||0,floorZ:player.floorZ||0,seq:++sequence});
  if(trail.length>720)trail.splice(0,trail.length-720);
 }
 function tick(delta){
  const dt=clamp(delta,0,.08);clock+=dt;syncTimer-=dt;
  if(syncTimer<=0){sync();syncTimer=1;}
  // A car trip breaks the walking trail. Pets wait where the owner boarded.
  if(!services.driving?.())recordTrail();
  for(const [index,pet] of pets.entries()){
   pet.clock+=dt;pet.speed=0;pet.replan=Math.max(0,pet.replan-dt);
   if(!pet.homeHouse){pet.visible=false;continue;}
   if(!pet.homeLoaded&&pet.mode!=='follow'&&distance(pet,player)>85)continue;
   if(pet.stairTravel){services.stairs?.(pet,dt,false);pet.action='walk';pet.speed=.6;pet.phase+=dt*8;continue;}
   doors(pet);
   if(pet.mode==='wait'){pet.action='sit';continue;}
   if(pet.mode==='follow'){
    if(services.driving?.()){pet.path=[];pet.action='sit';pet.status='Esperando você sair do veículo';continue;}
    let next=trail.find(p=>p.seq>=pet.cursor);
    if(!next){pet.cursor=trail.at(-1)?.seq||sequence;next=trail.at(-1);}
    if(!next)continue;
    if(distance(pet,next)<(next.seq===trail.at(-1)?.seq?1.0+(index%3)*.16:.20)&&pet.floor===next.floor){
     if(next.stair){if(services.stairs?.(pet,0,true)){pet.path=[];pet.cursor=next.seq+1;}else pet.status='Aguardando a escada';continue;}
     if(next.seq<trail.at(-1).seq){pet.cursor=next.seq+1;pet.path=[];pet.replan=0;continue;}
     pet.path=[];pet.action='idle';pet.status='Ao seu lado';
     const look=Math.atan2(player.y-pet.y,player.x-pet.x)-pet.face;pet.look=Math.atan2(Math.sin(look),Math.cos(look));continue;
    }
    if(!pet.path[pet.step]&&pet.replan<=0){
     const target=distance(pet,next)>24&&!homeAt(pet)?closestTrail(pet):next;
     if(target){pet.path=plan(pet,target)||[];pet.step=0;if(target!==next)pet.cursor=target.seq;}
     pet.replan=.55;
     if(!pet.path.length)pet.status='Aguardando um caminho livre até você';
    }
    walk(pet,dt,distance(pet,player)>4?2.4:1.2);continue;
   }
   if(pet.mode==='home'&&!inside(pet.homeHouse,pet)){
    while(pet.returnTrail.length&&pet.returnTrail[0].floor===pet.floor&&distance(pet,pet.returnTrail[0])<.24)pet.returnTrail.shift();
    if(pet.returnTrail.length){
     const target=pet.returnTrail[0];
     if(!pet.path[pet.step]&&pet.replan<=0){pet.path=plan(pet,target)||[];pet.step=0;pet.replan=.5;}
     walk(pet,dt,1.2);continue;
    }
    const H=pet.homeHouse,goal=safeSpot(H,0,{x:(H.x0+H.x1)/2,y:(H.y0+H.y1)/2});
    if(goal&&!pet.path[pet.step]&&pet.replan<=0){pet.path=plan(pet,goal)||[];pet.step=0;pet.replan=1;}
    walk(pet,dt,1.2);continue;
   }
   pet.status='Em casa';
   if(pet.returnTrail.length){pet.returnTrail=[];pet.journey=[{x:pet.x,y:pet.y,floor:pet.floor}];}
   roam(pet,dt);
  }
 }
 sync();recordTrail();
 return {adopt,command,tick,save,rows,pets,trail,get home(){return homeAt(player);},get count(){return rows.length;},
  get status(){return pets.map(p=>({id:p.id,name:p.name,mode:p.mode,action:p.action,status:p.status,x:p.x,y:p.y,floor:p.floor}));}};
}
