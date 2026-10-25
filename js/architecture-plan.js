// Shared architectural source: rooms -> footprint, walls, openings and furnishing.
// No Three/DOM dependency: the collision and rendering layers consume this plan.
(function(root){
 'use strict';
 const round=n=>Math.round(n*1000)/1000;
 const rect=(id,use,x0,y0,x1,y1)=>({id,use,x0:round(x0),y0:round(y0),x1:round(x1),y1:round(y1)});
 const inside=(r,x,y,pad=0)=>x>=r.x0+pad&&x<=r.x1-pad&&y>=r.y0+pad&&y<=r.y1-pad;
 const residential=k=>['house','bungalow','poor','mansion','rural','condo','projects'].includes(k);
 function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
 function makePlan({width:W,depth:D,kind='house',seed=1,floors=1,height=3}){
  if(W<6||D<6)throw Error('Property envelope too small');
  const random=rng(seed),family=Math.floor(random()*4),palette=Math.floor(random()*6);
  const plan={version:1,kind,seed,width:W,depth:D,floorHeight:height,family:['courtyard','offset-wing','garden-wing','cross-gable'][family],palette,levels:[]};
  const isHome=residential(kind),count=Math.max(1,Math.min(12,floors));
  const coreX=W*(.47+random()*.06),rearFraction=.40+random()*.06;
  for(let floor=0;floor<count;floor++){
   const setback=count>3&&floor>1?Math.min(Math.min(W,D)*.13,.65+Math.floor((floor-2)/3)*.6):0;
   const w=W-setback*2,d=D-setback*2,ox=setback,oy=setback;
   const civic=['hospital','police','military','cityhall','school'].includes(kind);
   const publicFloor=civic||floor===0&&['office','condo','projects','deco','shop','airport','warehouse'].includes(kind);
   const hallW=publicFloor?(kind==='airport'?3.6:kind==='warehouse'?2.8:2.5):count>1?2.15:1.35;
   const left=round(coreX-hallW/2-ox),right=round(left+hallW),rear=round(Math.max(2.8,d*rearFraction));
   const inset=round(Math.min(1.8,d*.18)),wingRecess=count>3&&floor>=Math.ceil(count*.6)?Math.min(1.4,d*.1):0;
   const leftEnd=Math.max(rear+2.8,d-(family===2?inset:0)-(family%2===0?wingRecess:0)),rightEnd=Math.max(rear+2.8,d-(family===1||family===3?inset:0)-(family%2?wingRecess:0)),entry=d-(floor>0?1.65:family===0?inset:inset*.55);
   let uses;
   if(isHome&&!(floor===0&&['condo','projects'].includes(kind)))uses=floor===0||['condo','projects'].includes(kind)?['bedroom','bathroom','living','kitchen']:['bedroom','bathroom','bedroom','study'];
   else if(kind==='warehouse')uses=['office','bathroom','warehouse','loading'];
   else if(kind==='hospital')uses=floor?['ward','bathroom','clinic','office']:['clinic','bathroom','reception','ward'];
   else if(kind==='police')uses=floor?['office','bathroom','briefing','office']:['holding','bathroom','reception','office'];
   else if(kind==='military')uses=floor?['barracks','bathroom','barracks','briefing']:['armory','bathroom','reception','briefing'];
   else if(kind==='cityhall')uses=floor?['council','bathroom','office','meeting']:['office','bathroom','reception','council'];
   else if(kind==='school')uses=floor?['classroom','bathroom','classroom','library']:['classroom','bathroom','reception','library'];
   else if(kind==='airport')uses=['office','bathroom','terminal','service'];
   else if(kind==='office')uses=['meeting','bathroom',floor?'office':'reception','office'];
   else if(kind==='deco')uses=floor?['bedroom','bathroom','living','kitchen']:['storage','bathroom','reception','dining'];
   else if(['condo','projects'].includes(kind))uses=['laundry','bathroom','reception','lounge'];
   else uses=floor>0?['bedroom','bathroom','living','kitchen']:palette%3===0?['storage','bathroom','dining','kitchen']:palette%3===1?['storage','bathroom','sales','checkout']:['staff','bathroom','salon','reception'];
   const rooms=[rect('rear-left',uses[0],0,0,left,rear),rect('rear-right',uses[1],right,0,w,rear),rect('front-left',uses[2],0,rear,left,leftEnd),rect('front-right',uses[3],right,rear,w,rightEnd),rect('hall','circulation',left,0,right,entry)];
   if(kind==='mansion'&&w>=14){const bath=rooms[1];const split=round(rear*.57);bath.y1=split;rooms.push(rect('laundry','laundry',right,split,w,rear));}
   if(civic){for(const room of rooms.slice()){if(room.id==='hall'||room.y1-room.y0<8)continue;
    const mid=round((room.y0+room.y1)/2),front=room.id.startsWith('front');
    rooms.push({...room,id:room.id+'-annex',y0:front?room.y0:mid,y1:front?mid:room.y1});
    if(front)room.y0=mid;else room.y1=mid;
   }}
   for(const r of rooms){r.x0=round(r.x0+ox);r.x1=round(r.x1+ox);r.y0=round(r.y0+oy);r.y1=round(r.y1+oy);}
   const level={floor,kind,wingRecess,z:floor*height,rooms,walls:[],furniture:[],entry:[ox+(left+right)/2,oy+entry],setback,
    outdoor:floor>0?[rect('balcony','balcony',ox+left,oy+entry,ox+right,oy+d)]:[]};
   if(kind==='mansion'&&floor>0)level.outdoor.push({...rect('rear-balcony','balcony',1.3,-2.7,W-1.3,0),rear:true});
   makeWalls(level,seed+floor);furnish(level,seed+floor*71);
   plan.levels.push(level);
  }
  plan.signature=JSON.stringify(plan.levels[0].rooms.map(r=>[r.use,r.x0,r.y0,r.x1,r.y1]));
  plan.audit=auditPlan(plan);return plan;
 }
 function makeWalls(level,seed){
  const rooms=level.rooms,seen=new Set();
  const X=[...new Set(rooms.flatMap(r=>[r.x0,r.x1]))].sort((a,b)=>a-b),Y=[...new Set(rooms.flatMap(r=>[r.y0,r.y1]))].sort((a,b)=>a-b);
  const at=(x,y)=>rooms.find(r=>inside(r,x,y,.00001));
  const add=(a,b,left,right,n)=>{
   if(!left&&!right||left===right)return;
   const key=[...a,...b].map(round).join(',');if(seen.has(key))return;seen.add(key);
   const ext=!left||!right,owner=left||right,len=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const wall={a,b,ext,normal:ext?(left?n:n.map(v=>-v)):n,rooms:[left?.id,right?.id].filter(Boolean),openings:[]};
   if(!ext&&[left.id,right.id].includes('hall')&&len>=1.12)wall.openings.push({kind:'door',style:[left.use,right.use].includes('holding')?'bars':undefined,at:len/2,width:1.02,height:2.16});
   if(ext&&owner.id==='hall'&&n[1]!==0&&Math.abs((a[1]+b[1])/2-level.entry[1])<.01)wall.openings.push({kind:'door',style:level.floor?'glazed':undefined,at:len/2,width:Math.min(1.15,len-.16),height:2.25});
   else if(ext&&owner.id==='hall'&&wall.normal[1]<-.5&&level.outdoor.some(r=>r.rear))wall.openings.push({kind:'door',style:'glazed',at:len/2,width:1.15,height:2.25});
   else if(ext&&owner.use!=='circulation'&&len>=1.8){
    const privacy=owner.use==='bathroom',count=Math.max(1,Math.floor(len/(privacy?3.7:2.6)));
    const office=level.kind==='office';
    for(let i=0;i<count;i++)wall.openings.push({kind:'window',at:len*(i+1)/(count+1),width:privacy?.65:Math.min(office?1.75:1.35,len/(count+1)-.35),sill:privacy?1.6:office?.65:.85,height:privacy?.55:office?1.65:1.35});
   }
   if(ext&&owner.use==='loading'&&level.floor===0&&wall.normal[1]>.5&&len>4)wall.openings=[{kind:'door',style:'roller',at:len/2,width:Math.min(3.4,len-1),height:3.6}];
   level.walls.push(wall);
  };
  // Atomic boundaries are merged when the two neighbouring rooms match.
  const raw=[];
  for(const x of X)for(let j=0;j<Y.length-1;j++){const y=(Y[j]+Y[j+1])/2;raw.push([[x,Y[j]],[x,Y[j+1]],at(x-.001,y),at(x+.001,y),[1,0]]);}
  for(const y of Y)for(let i=0;i<X.length-1;i++){const x=(X[i]+X[i+1])/2;raw.push([[X[i],y],[X[i+1],y],at(x,y-.001),at(x,y+.001),[0,1]]);}
  const merged=[];
  for(const item of raw){const prev=merged.at(-1);if(prev&&prev[2]===item[2]&&prev[3]===item[3]&&prev[4][0]===item[4][0]&&prev[0][0]===item[0][0]&&prev[1][0]===item[0][0]&&prev[1][1]===item[0][1])prev[1]=item[1];else if(prev&&prev[2]===item[2]&&prev[3]===item[3]&&prev[4][1]===item[4][1]&&prev[0][1]===item[0][1]&&prev[1][0]===item[0][0]&&prev[1][1]===item[0][1])prev[1]=item[1];else merged.push(item);}
  for(const a of merged)add(...a);
 }
 function furnish(level,seed){
  const random=rng(seed);
  for(const r of level.rooms){
   if(r.use==='circulation')continue;
   const W=r.x1-r.x0,D=r.y1-r.y0,cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2;
   const portals=level.walls.filter(w=>w.rooms.includes(r.id)).flatMap(w=>w.openings.filter(o=>o.kind==='door').map(o=>{const L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),x=w.a[0]+(w.b[0]-w.a[0])*o.at/L,y=w.a[1]+(w.b[1]-w.a[1])*o.at/L;return{x,y};}));
   const items=[];
   const put=(kind,w,d,h,preferred,extra={})=>{
    const candidates=[preferred,[r.x0+.25+w/2,r.y0+.25+d/2],[r.x1-.25-w/2,r.y0+.25+d/2],[r.x0+.25+w/2,r.y1-.25-d/2],[r.x1-.25-w/2,r.y1-.25-d/2],[cx,cy]];
    function* positions(){yield* candidates;for(let y=r.y0+.2+d/2;y<r.y1-.18-d/2;y+=.25)for(let x=r.x0+.2+w/2;x<r.x1-.18-w/2;x+=.25)yield[x,y];}
    for(const [x,y] of positions()){
     if(!inside(r,x-w/2,y-d/2,.16)||!inside(r,x+w/2,y+d/2,.16))continue;
     if(!extra.overlay&&items.some(b=>!b.overlay&&Math.abs(x-b.x)<(w+b.w)/2+.08&&Math.abs(y-b.y)<(d+b.d)/2+.08))continue;
     if(!extra.overlay&&portals.some(p=>Math.abs(p.x-x)<w/2+.67&&Math.abs(p.y-y)<d/2+.67))continue;
     const b={room:r.id,kind,x:round(x),y:round(y),w,d,h,top:extra.top||['#c9a77d','#b9946e','#d7c5a8'][Math.floor(random()*3)],side:'#85684b',...extra};items.push(b);return b;
    }return null;
   };
   const bed=()=>{put('bed',Math.min(1.6,W-1.1),2.05,.55,[cx,r.y0+1.3],{top:'#92b1a6'});put('wardrobe',1.05,.52,1.95,[r.x0+.8,r.y1-.55]);};
   const kitchen=()=>{put('fridge',.65,.65,1.85,[r.x0+.6,r.y0+.6],{top:'#ecebe6'});put('stove',.7,.62,.9,[r.x0+1.38,r.y0+.6],{top:'#c6c4be'});put('sink',.72,.62,.9,[r.x1-.65,r.y0+.6],{top:'#e6e0d5'});if(D>3.7)put('counter',1.5,.65,.9,[cx,r.y1-.6]);};
   const lounge=()=>{put('sofa',Math.min(2.3,W-1.2),.85,.6,[cx,r.y1-.75],{top:'#839b93'});put('tv',1.1,.36,.8,[cx,r.y0+.4],{top:'#30363b'});if(D>3.8)put('table',1.05,.65,.42,[cx,cy]);};
   switch(r.use){
    case'ward':case'barracks':for(let y=r.y0+1.5;y<r.y1-1;y+=3.2)for(const x of [r.x0+1.2,r.x1-1.2]){put(r.use==='ward'?'hospitalbed':'bed',1.15,2.05,.9,[x,y],{top:r.use==='ward'?'#e1eee9':'#657361'});put('cabinet',.5,.55,.75,[x+.85,y-.6],{top:'#bfcac8'});}break;
    case'clinic':put('hospitalbed',1.15,2.05,.9,[cx,cy],{top:'#d3e6e1'});put('sink',.8,.6,.9,[r.x0+.7,r.y0+.7]);put('desk',1.6,.7,.8,[cx,r.y0+.7]);put('shelf',2,.5,1.8,[r.x1-1.4,r.y1-.5]);break;
    case'classroom':for(let y=r.y0+2.2;y<r.y1-1;y+=2)for(let x=r.x0+1;x<r.x1-1;x+=2.2){put('studentdesk',1.2,.65,.75,[x,y]);put('chair',.45,.5,.8,[x,y+.7]);}put('tv',Math.min(3,W-1),.15,1.8,[cx,r.y0+.3],{top:'#284b43'});break;
    case'library':case'armory':for(let y=r.y0+1;y<r.y1-1;y+=2.4)put('shelf',Math.min(W-2,4),.6,2,[cx,y],{top:r.use==='armory'?'#596562':'#a68b64'});break;
    case'council':case'briefing':put('table',Math.min(5,W-2),2,.8,[cx,cy]);for(let x=cx-2;x<=cx+2;x+=1)for(const y of [cy-1.5,cy+1.5])put('chair',.55,.55,.9,[x,y]);put('desk',2,.8,.9,[cx,r.y0+.8]);break;
    case'holding':put('bed',.85,2,.5,[r.x0+1,r.y0+1.4],{top:'#687b83'});put('toilet',.55,.7,.55,[r.x1-.7,r.y0+.7]);put('bench',2,.5,.45,[cx,r.y1-.6]);break;
    case'bedroom':bed();break;
    case'bathroom':put('toilet',.55,.72,.55,[r.x0+.6,r.y0+.65],{top:'#eeece6'});put('sink',.65,.52,.85,[r.x1-.6,r.y0+.55],{top:'#eee9dd'});put('shower',.88,.88,1.9,[r.x1-.7,r.y1-.7],{top:'#bad1d1'});break;
    case'kitchen':kitchen();break;
    case'living':case'lounge':lounge();break;
    case'dining':put('table',1.5,1.05,.75,[cx,cy]);put('counter',1.8,.65,.9,[cx,r.y0+.6]);break;
    case'office':case'study':case'staff':put('desk',1.25,.65,.75,[cx,r.y0+.6]);put('shelf',1.4,.45,1.9,[r.x0+.95,r.y1-.55]);break;
    case'meeting':put('table',Math.min(2.2,W-1.3),1.1,.75,[cx,cy]);put('tv',1.2,.3,1,[cx,r.y0+.4]);break;
    case'reception':case'service':case'checkout':put('counter',Math.min(2.5,W-1),.7,1.05,[cx,cy]);put('sofa',1.8,.8,.6,[cx,r.y0+.7],{top:'#a2b6b8'});break;
    case'sales':case'storage':case'warehouse':case'loading':put('shelf',Math.min(2.1,W-1.2),.6,1.8,[cx,r.y0+.65]);if(D>3.4)put('shelf',Math.min(2.1,W-1.2),.6,1.6,[cx,r.y1-.65]);break;
    case'laundry':put('cabinet',1.1,.65,.92,[cx,r.y0+.65]);put('sink',.65,.6,.9,[r.x1-.6,r.y1-.6]);break;
    case'salon':put('mirror',1.2,.15,1.7,[cx,r.y0+.3]);put('sofa',1.6,.8,.6,[cx,r.y1-.7]);break;
    case'terminal':for(let i=0;i<3;i++)put('sofa',2,.85,.6,[cx,r.y0+1.1+i*2.1]);break;
   }
   level.furniture.push(...items);
  }
 }
 function auditPlan(plan){
  const problems=[],required=new Set(['bedroom','bathroom','living','kitchen']);
  for(const level of plan.levels){
   const reachable=new Set(['hall']);let changes=true;
   while(changes){changes=false;for(const w of level.walls)if(!w.ext&&w.openings.some(o=>o.kind==='door')&&w.rooms.some(id=>reachable.has(id)))for(const id of w.rooms)if(!reachable.has(id)){reachable.add(id);changes=true;}}
   for(const r of level.rooms){if(!reachable.has(r.id))problems.push(`floor ${level.floor}: inaccessible ${r.id}`);if((r.x1-r.x0)*(r.y1-r.y0)<2.5)problems.push('room too small');}
   for(const b of level.furniture){const r=level.rooms.find(r=>r.id===b.room);if(!inside(r,b.x-b.w/2,b.y-b.d/2,.1)||!inside(r,b.x+b.w/2,b.y+b.d/2,.1))problems.push('furniture outside room');}
  }
  if(residential(plan.kind)&&!['condo','projects'].includes(plan.kind))for(const type of required)if(!plan.levels[0].rooms.some(r=>r.use===type))problems.push('missing '+type);
  const entry=plan.levels[0].walls.some(w=>w.ext&&w.openings.some(o=>o.kind==='door'));
  if(!entry)problems.push('missing entrance');
  const needed={bedroom:['bed'],bathroom:['toilet','sink','shower'],living:['sofa','tv'],kitchen:['fridge','sink','stove']};
  for(const level of plan.levels)for(const room of level.rooms)for(const kind of needed[room.use]||[])if(!level.furniture.some(f=>f.room===room.id&&f.kind===kind))problems.push(`floor ${level.floor}: ${room.use} missing ${kind}`);
  return{passed:!problems.length,problems};
 }
 const api={makePlan,auditPlan,inside,residential};root.CityArchitecture=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
