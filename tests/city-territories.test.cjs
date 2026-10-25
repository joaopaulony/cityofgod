// New regression coverage: deterministic crime-territories, street naming, garages and safe mural slots.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function city(seed=20261024){
 const context=vm.createContext({console,Math,Date,Uint8Array,Float32Array});
 for(const path of ['js/worldgen/geo.js','js/city-districts.js','js/worldgen/roads.js'])
   vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
 const COG=context.COG,geo=COG.buildGeo(seed),roads=COG.buildRoads(geo);
 return {COG,geo,roads};
}
test('four procedural low-income regions have unique stable gangs and five graffiti motifs each',()=>{
 const {COG,geo}=city();
 const gangs=geo.neighborhoods.filter(n=>n.gang);
 assert.equal(gangs.length,geo.anchors.favelas.length+geo.anchors.ghettos.length);
 assert.equal(gangs.length,4);
 assert.equal(gangs[0].gang.color,'#19bc79');
 assert.equal(gangs[1].gang.color,'#9862ec');
 assert.equal(new Set(gangs.map(x=>x.gang.id)).size,gangs.length);
 for(const n of gangs){
   assert.equal(n.gang.art.length,5);
   assert.ok(n.name.length>=5);
 }
 const again=city(COG.WORLD_SEED).geo;
 assert.deepEqual(JSON.parse(JSON.stringify(geo.neighborhoods.filter(n=>n.gang).map(n=>[n.name,n.gang.id,n.gang.color]))),
   JSON.parse(JSON.stringify(again.neighborhoods.filter(n=>n.gang).map(n=>[n.name,n.gang.id,n.gang.color]))));
});
test('gang only applies inside relevant zoned neighborhood, not outside / sea',()=>{
 const {COG,geo}=city(),D=COG.D;
 let points=0;
 for(let y=0;y<geo.H;y+=50)for(let x=0;x<geo.W;x+=50){
  const gang=geo.gangAt(x+1,y+1),district=geo.districtAt(x+1,y+1);
  if(gang){points++;assert.ok([D.FAVELA,D.GHETTO].includes(district));}
 }
 assert.ok(points>50);
 assert.equal(geo.gangAt(0,0),null);
});
test('streets are named deterministically and retain geometry',()=>{
 const a=city(),b=city();
 assert.ok(a.roads.length>30);
 assert.equal(a.roads.filter(r=>r.streetName).length,a.roads.length);
 assert.deepEqual(a.roads.map(x=>x.streetName),b.roads.map(x=>x.streetName));
 assert.ok(a.roads.some(x=>/Street|Road|Avenue|Boulevard|Calle|Freeway/.test(x.streetName)));
 for(const r of a.roads)assert.ok(r.pts.length>1);
});
test('garage opens only by owner action and never because player passes',()=>{
 const ctx=vm.createContext({
  window:{CityRealty:{isOwned:()=>false}},
  world:{garages:[]},houses:[],Math
 });
 vm.runInContext(fs.readFileSync('js/garages.js','utf8'),ctx);
 const gate={door:[10,10],seg:{doorAnim:{open:0,target:0,manual:true}},house:{}};
 ctx.world.garages.push(gate);
 const p={x:10,y:9};
 assert.equal(ctx.window.CityGarage.nearby(p),gate);
 assert.match(ctx.window.CityGarage.use(p),/trancado/);
 assert.equal(gate.seg.doorAnim.target,0);
 ctx.window.CityRealty.isOwned=()=>true;
 assert.match(ctx.window.CityGarage.use(p),/Abrindo/);
 assert.equal(gate.seg.doorAnim.target,1);
 assert.match(ctx.window.CityGarage.use(p),/Fechando/);
 assert.equal(gate.seg.doorAnim.target,0);
 assert.match(ctx.window.CityGarage.toggle(gate,{x:100,y:100}),/Aproxime/);
 assert.equal(gate.seg.doorAnim.target,0);
});
test('all private garages remain empty of procedural scenery cars',()=>{
 const source=fs.readFileSync('js/miami-city.js','utf8');
 assert.ok(!source.includes('garageCar(G,'));
 const houses=fs.readFileSync('js/houses.js','utf8');
 assert.ok(!houses.includes('a.target = residents.some(p => !(p.floor > 0)'));
});
test('wall art slots have clearance from every window and door',async()=>{
 const {freeWallSpans}=await import('../js/gang-graffiti.mjs');
 const wall={a:[0,0],b:[20,0],openings:[{at:3,width:1.6,kind:'door'},{at:12,width:2,kind:'window'}]};
 const spans=freeWallSpans(wall);
 assert.ok(spans.length>=2);
 for(const [l,r] of spans){
   assert.ok(r-l>=2.4);
   for(const opening of wall.openings){
     const lo=opening.at-opening.width/2,hi=opening.at+opening.width/2;
     assert.ok(r<=lo-.37 || l>=hi+.37,'graffiti intersects '+opening.kind);
   }
 }
 const nothing=freeWallSpans({a:[0,0],b:[4,0],openings:[{at:2,width:3}]});
 assert.equal(nothing.length,0);
});
test('HTML loads district metadata before road generation and new graffiti module is imported',()=>{
 const page=fs.readFileSync('index.html','utf8');
 assert.ok(page.indexOf('js/worldgen/geo.js')<page.indexOf('js/city-districts.js'));
 assert.ok(page.indexOf('js/city-districts.js')<page.indexOf('js/worldgen/roads.js'));
 const facade=fs.readFileSync('js/architecture-3d.mjs','utf8');
 assert.match(facade,/paintGangFacade\(THREE,H,A,exterior\)/);
});
