// Móveis "sabem" como se usam: costas na parede e frente para o cômodo, cadeira virada para a mesa, cama com um lado
// livre, geladeira/guarda-roupa/TV com espaço na frente. Vale para as plantas antigas (casas, prédios públicos,
// estabelecimentos) e para o gerador novo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const A=require('../js/architecture-plan.js');
const O=require('../js/architecture-organic.js');

const WALL_KINDS=new Set(['bed','sofa','tv','wardrobe','fridge','stove','sink','toilet','counter','shelf','desk','cabinet','medcabinet','sinkrow','locker','vending','bookshelf']);
const rectOf=b=>[b.x-b.w/2,b.y-b.d/2,b.x+b.w/2,b.y+b.d/2];
const overlap=(a,b)=>a[0]<b[2]-.01&&a[2]>b[0]+.01&&a[1]<b[3]-.01&&a[3]>b[1]+.01;
const free=(level,f,z)=>!level.furniture.some(o=>o!==f&&o.room===f.room&&!o.overlay&&overlap(rectOf(o),z));

function plans(){
 const out=[];
 for(const kind of ['bungalow','poor','mansion','hospital','police','school','cityhall','university','campuslib','vetclinic','medclinic','lawoffice','autoshop','restaurant','barbershop'])
  for(const seed of [1,2,3])out.push([kind,A.makePlan({width:kind==='university'?40:24,depth:kind==='university'?26:18,kind,seed,floors:kind==='university'?3:kind==='mansion'?2:1,height:3})]);
 for(const kind of ['condo','projects','deco'])for(const seed of [1,2])out.push([kind,A.makePlan({width:22,depth:16,kind,seed,floors:4,height:3})]);
 for(const k of Object.keys(O.LAYOUTS))for(const seed of [1,2,3,4])out.push([k,O.makePlan({width:Math.round(O.LAYOUTS[k].w),depth:Math.round(O.LAYOUTS[k].d),layout:k,seed})]);
 return out;
}

test('peça encostada na parede fica de costas para ela (frente para o cômodo) em todas as plantas',()=>{
 for(const [name,p] of plans())for(const level of p.levels)for(const f of level.furniture){
  if(!WALL_KINDS.has(f.kind)||f.turn!=null)continue;
  const r=level.rooms.find(r=>r.id===f.room);
  const g={rear:f.y-f.d/2-r.y0,front:r.y1-(f.y+f.d/2),left:f.x-f.w/2-r.x0,right:r.x1-(f.x+f.w/2)},near=Math.min(...Object.values(g));
  if(near>.45)continue;   // peça solta no meio do cômodo
  assert.ok(f.face,name+': '+f.kind+' sem frente definida');
  // a frente aponta para longe de uma parede encostada
  const back={'0,1':'rear','0,-1':'front','1,0':'left','-1,0':'right'}[f.face.join(',')];
  assert.ok(g[back]<=.45,name+': '+f.kind+' de frente para a parede');
  assert.ok(Math.abs(f.along*f.depth-f.w*f.d)<1e-6,'medidas paralela/perpendicular');
 }
});

test('cadeira vira para a mesa ou escrivaninha mais próxima',()=>{
 let n=0;
 for(const [name,p] of plans())for(const level of p.levels)for(const f of level.furniture){
  if(f.kind!=='chair'||f.turn!=null||!f.face)continue;
  const t=level.furniture.filter(o=>o.room===f.room&&/^(table|desk|studentdesk|execdesk|cafetable|counter)$/.test(o.kind)).sort((a,b)=>Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y))[0];
  if(!t)continue;n++;
  assert.ok((t.x-f.x)*f.face[0]+(t.y-f.y)*f.face[1]>0,name+': cadeira de costas para a mesa');
 }
 assert.ok(n>20,'há cadeiras testadas');
});

test('gerador novo: cama com um lado livre e geladeira, guarda-roupa e TV com espaço na frente',()=>{
 for(const k of Object.keys(O.LAYOUTS))for(const seed of [1,2,3,5,8]){
  const p=O.makePlan({width:Math.round(O.LAYOUTS[k].w),depth:Math.round(O.LAYOUTS[k].d),layout:k,seed});
  for(const level of p.levels)for(const f of level.furniture){
   if(!f.face)continue;
   const [nx,ny]=f.face,front=nx?[nx>0?f.x+f.w/2:f.x-f.w/2-.5,f.y-f.d/2,nx>0?f.x+f.w/2+.5:f.x-f.w/2,f.y+f.d/2]:[f.x-f.w/2,ny>0?f.y+f.d/2:f.y-f.d/2-.5,f.x+f.w/2,ny>0?f.y+f.d/2+.5:f.y-f.d/2];
   if(['fridge','wardrobe','tv','sofa','stove'].includes(f.kind))assert.ok(free(level,f,front),k+': '+f.kind+' com algo na frente');
   if(f.kind==='bed'){
    const sides=nx?[[f.x-f.w/2,f.y-f.d/2-.55,f.x+f.w/2,f.y-f.d/2],[f.x-f.w/2,f.y+f.d/2,f.x+f.w/2,f.y+f.d/2+.55]]:[[f.x-f.w/2-.55,f.y-f.d/2,f.x-f.w/2,f.y+f.d/2],[f.x+f.w/2,f.y-f.d/2,f.x+f.w/2+.55,f.y+f.d/2]];
    const r=level.rooms.find(r=>r.id===f.room);
    assert.ok(sides.some(z=>A.inside(r,z[0],z[1],0)&&A.inside(r,z[2],z[3],0)&&free(level,f,z)),k+' #'+seed+': cama sem lado livre');
   }
  }
 }
});
