// Gerador novo de plantas (architecture-organic.js) ao lado do antigo, e os prédios com 2+ apartamentos por andar.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const A=require('../js/architecture-plan.js');
const O=require('../js/architecture-organic.js');

const doors=(level,kinds=['door','passage'])=>level.walls.flatMap(w=>{const L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);
 return w.openings.filter(o=>kinds.includes(o.kind)).map(o=>({...o,wall:w,x:w.a[0]+(w.b[0]-w.a[0])*o.at/L,y:w.a[1]+(w.b[1]-w.a[1])*o.at/L}));});
const sizes=k=>{const L=O.LAYOUTS[k],w=Math.round(L.w),d=Math.round(L.d);return [[w,d],[w+1,d],[w+2,d+1],[w+3,d+2]];};

test('o gerador antigo continua igual (mesma planta para a mesma entrada)',()=>{
 const p=A.makePlan({width:12,depth:10,kind:'bungalow',seed:5,floors:1,height:2.85});
 assert.ok(p.audit.passed);assert.notEqual(p.family,'organic');
 assert.ok(p.levels[0].rooms.some(r=>r.id==='hall'&&r.use==='circulation'),'antigo: corredor central');
});

test('seis modelos novos: plantas válidas em vários tamanhos e sementes, sem corredor de frente a fundo',()=>{
 assert.ok(Object.keys(O.LAYOUTS).length>=6);
 for(const k of Object.keys(O.LAYOUTS))for(const [W,D] of sizes(k))for(const seed of [1,2,3,5,8,13,21]){
  const p=O.makePlan({width:W,depth:D,layout:k,seed,height:2.85});
  assert.ok(p.audit.passed,k+' '+W+'x'+D+' #'+seed+': '+p.audit.problems.join(', '));
  assert.equal(p.family,'organic');
  const L0=p.levels[0],hall=L0.rooms.find(r=>r.id==='hall');
  assert.equal(hall.use,'living','entra-se pela sala: '+k);
  // entrada na fachada da sala
  assert.ok(doors(L0,['door']).some(d=>d.wall.ext&&d.wall.rooms[0]==='hall'&&d.wall.normal[1]>.5),'porta da rua na sala: '+k);
  // a cozinha abre para a sala por um vão (cozinha americana)
  const kit=L0.rooms.find(r=>r.use==='kitchen');
  assert.ok(doors(L0,['passage']).some(d=>d.wall.rooms.includes('hall')&&d.wall.rooms.includes(kit.id)),'cozinha integrada: '+k);
  // nenhum corredor atravessa a casa de frente a fundo
  for(const level of p.levels)for(const c of level.rooms.filter(r=>r.use==='circulation'))assert.ok(c.y1-c.y0<D-.5||c.x1-c.x0<2.5,'corredor de frente a fundo: '+k);
  // cômodos dentro do lote e sem sobreposição
  for(const level of p.levels){const R=level.rooms;
   for(const r of R)assert.ok(r.x0>=-1e-6&&r.y0>=-1e-6&&r.x1<=W+1e-6&&r.y1<=D+1e-6,'fora do lote: '+k+' '+r.id);
   for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){const a=R[i],b=R[j];assert.ok(!(a.x0<b.x1-1e-6&&a.x1>b.x0+1e-6&&a.y0<b.y1-1e-6&&a.y1>b.y0+1e-6),'sobreposição '+a.id+'/'+b.id);}}
 }
});

test('móveis nunca na frente de porta ou vão, e quartos/banheiros completos',()=>{
 for(const k of Object.keys(O.LAYOUTS))for(const seed of [1,4,9]){
  const [W,D]=sizes(k)[0],p=O.makePlan({width:W,depth:D,layout:k,seed});
  for(const level of p.levels){
   const ds=doors(level);
   for(const f of level.furniture){
    for(const d of ds.filter(d=>d.wall.rooms.includes(f.room))){
     const cx=Math.max(f.x-f.w/2,Math.min(d.x,f.x+f.w/2)),cy=Math.max(f.y-f.d/2,Math.min(d.y,f.y+f.d/2));
     assert.ok(Math.hypot(cx-d.x,cy-d.y)>=.6,k+': '+f.kind+' bloqueia '+d.kind+' de '+f.room);
    }
   }
   for(const r of level.rooms.filter(r=>r.use==='bedroom'))assert.ok(level.furniture.some(f=>f.room===r.id&&f.kind==='bed'),k+': quarto sem cama');
  }
 }
});

test('modelos variados: suíte, forma em L, varanda e sobrado com escada que cabe nos dois andares',()=>{
 const L=O.makePlan({width:13,depth:13,layout:'emL',seed:3});
 const area=L.levels[0].rooms.reduce((s,r)=>s+(r.x1-r.x0)*(r.y1-r.y0),0);
 assert.ok(area<13*13-3,'casa em L deixa o canto do quintal livre');assert.ok(L.masses.length>=2,'telhado em duas massas');
 const v=O.makePlan({width:11,depth:12,layout:'varanda',seed:2});
 assert.ok(v.levels[0].rooms.find(r=>r.id==='hall').y1<12-1.3,'varanda recuada na frente');
 assert.ok(v.levels[0].rooms.some(r=>r.id==='ensuite'),'suíte');
 for(const seed of [1,2,3,4,5,6]){
  const s=O.makePlan({width:10,depth:13,layout:'sobrado',seed});assert.equal(s.levels.length,2);
  const st=s.stairSpec;assert.ok(st);
  const box=[st.x-.5,st.y-1.4,st.x+.5,st.y+1.4];
  for(const level of s.levels){
   assert.ok(level.rooms.some(r=>r.id==='hall'&&A.inside(r,box[0],box[1],.04)&&A.inside(r,box[2],box[3],.04)),'escada dentro do hall no andar '+level.floor);
   for(const d of doors(level))assert.ok(!(d.x>box[0]-.9&&d.x<box[2]+.9&&d.y>box[1]-.9&&d.y<box[3]+.9),'porta encostada na escada');
  }
  assert.ok(s.levels[1].outdoor.length===1&&s.levels[1].rooms.some(r=>r.id==='ensuite'),'sacada e suíte em cima');
 }
});

test('prédio residencial: 2 apartamentos por andar (4 no prédio fundo; andar recuado do alto fica com 2 maiores), porta própria e cômodos isolados',()=>{
 for(const kind of ['condo','projects','deco'])for(const [W,D,want] of [[20,14,2],[24,10,2],[22,16,2],[20,20,4],[24,22,4]])for(const seed of [1,7]){
  const p=A.makePlan({width:W,depth:D,kind,seed,floors:4,height:3});
  assert.ok(p.audit.passed,kind+' '+W+'x'+D+': '+p.audit.problems.join(', '));
  assert.equal(p.levels[0].units,undefined,'térreo é portaria');
  for(const level of p.levels.slice(1)){
   assert.equal(level.units.length,D-2*level.setback>=19?want:2,kind+' '+W+'x'+D+' andar '+level.floor);
   const ds=doors(level);
   for(const u of level.units){
    // uma só porta do apartamento para o corredor do prédio, marcada com o número da unidade
    const entry=ds.filter(d=>d.wall.rooms.includes('hall')&&d.wall.rooms.some(id=>u.rooms.includes(id)));
    assert.equal(entry.length,1,'uma porta de entrada por apartamento');assert.equal(entry[0].unit,u.id);
    // nenhuma passagem entre apartamentos diferentes
    for(const d of ds){const us=d.wall.rooms.map(id=>level.units.find(x=>x.rooms.includes(id))?.id).filter(x=>x!=null);assert.ok(new Set(us).size<=1,'porta entre apartamentos');}
    for(const use of ['living','kitchen','bathroom','bedroom'])assert.ok(level.rooms.some(r=>u.rooms.includes(r.id)&&r.use===use),'apto sem '+use);
   }
  }
 }
});

test('modelos de casa para o mapa e o menu do terreno: medidas reais, sem ampliar',()=>{
 const T=O.templates();
 for(const [k,L] of Object.entries(O.LAYOUTS)){const t=T['O_'+k];assert.ok(t&&t.noScale&&t.organic===k);assert.equal(t.w,Math.round(L.w));assert.equal(!!t.def.storeys,L.floors>1);}
});
