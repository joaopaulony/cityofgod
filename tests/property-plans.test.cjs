const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makePlan,inside}=require('../js/architecture-plan.js');
const fixtures={house:[8,8,1],bungalow:[10,8,2],poor:[10,10,2],rural:[10,8,1],mansion:[18,14,2],shop:[12,10,2],office:[20,18,9],condo:[20,16,8],deco:[16,14,4],projects:[24,10,3],warehouse:[24,18,1],airport:[36,14,1]};
function circulation(level){
 const step=.24,radius=.29,rooms=level.rooms,solid=[];
 for(const w of level.walls){const length=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),P=t=>[w.a[0]+(w.b[0]-w.a[0])*t/length,w.a[1]+(w.b[1]-w.a[1])*t/length];let from=0;
  for(const o of w.openings.filter(o=>o.kind==='door')){solid.push([P(from),P(o.at-o.width/2)]);from=o.at+o.width/2;}solid.push([P(from),P(length)]);
 }
 const width=Math.max(...rooms.map(r=>r.x1))+1,depth=Math.max(...rooms.map(r=>r.y1))+1,N=Math.ceil(width/step),M=Math.ceil(depth/step),free=new Uint8Array(N*M);
 const dist=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;if(l<1e-10)return 99;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/l));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
 for(let j=0;j<M;j++)for(let i=0;i<N;i++){
  const x=(i+.5)*step,y=(j+.5)*step;if(!rooms.some(r=>inside(r,x,y)))continue;
  if(solid.some(([a,b])=>dist(x,y,a,b)<radius+.035))continue;
  if(level.furniture.some(b=>!b.overlay&&x>b.x-b.w/2-radius&&x<b.x+b.w/2+radius&&y>b.y-b.d/2-radius&&y<b.y+b.d/2+radius))continue;
  free[j*N+i]=1;
 }
 const hall=rooms.find(r=>r.id==='hall'),start=[];
 for(let j=0;j<M;j++)for(let i=0;i<N;i++)if(free[j*N+i]&&inside(hall,(i+.5)*step,(j+.5)*step))start.push(j*N+i);
 assert.ok(start.length,'no clear hallway');const seen=new Set([start[0]]),queue=[start[0]];
 for(let at=0;at<queue.length;at++){const p=queue[at],x=p%N,y=Math.floor(p/N);for(const n of [x>0?p-1:-1,x<N-1?p+1:-1,y>0?p-N:-1,y<M-1?p+N:-1])if(n>=0&&free[n]&&!seen.has(n)){seen.add(n);queue.push(n);}}
 const visited=new Set(queue.flatMap(p=>{const x=(p%N+.5)*step,y=(Math.floor(p/N)+.5)*step;return rooms.filter(r=>inside(r,x,y)).map(r=>r.id);}));
 return rooms.filter(r=>!visited.has(r.id)).map(r=>r.id);
}
for(const [kind,[width,depth,floors]] of Object.entries(fixtures))test(kind+': connected rooms, entrance, sanitary spaces and furniture clearance',()=>{
 for(let seed=1;seed<=8;seed++){
  const plan=makePlan({kind,width,depth,floors,seed});assert.equal(plan.audit.passed,true,JSON.stringify(plan.audit));
  for(const level of plan.levels){
   assert.deepEqual(circulation(level),[],kind+' seed '+seed+' floor '+level.floor+' inaccessible after furnishing');
   for(const a of level.furniture)for(const b of level.furniture)if(a!==b&&!a.overlay&&!b.overlay)assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2+.07||Math.abs(a.y-b.y)>=(a.d+b.d)/2+.07,'overlapping furniture');
   const bath=level.rooms.find(r=>r.use==='bathroom');assert.ok(bath,'missing bathroom');assert.ok(level.furniture.some(f=>f.room===bath.id&&f.kind==='toilet'),'missing toilet');
  }
 }
});
test('the same seed reproduces the property, while different seeds create distinct footprints',()=>{
 const build=seed=>makePlan({width:12,depth:10,kind:'house',seed,floors:2});assert.deepEqual(build(71),build(71));
 const plans=Array.from({length:80},(_,i)=>build(i+1));assert.equal(new Set(plans.map(p=>p.signature)).size,80);assert.equal(new Set(plans.map(p=>p.family)).size,4);
 for(const p of plans){const area=p.levels[0].rooms.reduce((n,r)=>n+(r.x1-r.x0)*(r.y1-r.y0),0);assert.ok(area<120-.5,'unarticulated rectangle');}
});
