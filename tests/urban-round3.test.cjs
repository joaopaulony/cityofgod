const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const street=require('../js/street-layout.js');

test('rotated buildings preserve exact footprint and road clearances',()=>{
 const corners=street.orientedCorners(10,10,26,20,Math.PI/4);
 assert.equal(corners.length,4);
 assert.equal(street.polygonContains(corners,18,15),true);
 assert.equal(street.polygonContains(corners,1,15),false);
 const rotation=street.orientPoint(18,10,18,15,Math.PI/2);
 assert.ok(Math.abs(rotation[0]-23)<1e-8);
 assert.ok(Math.abs(rotation[1]-15)<1e-8);
 assert.equal(street.clearPolygon(corners,()=>50,3.5,2),true);
 assert.equal(street.clearPolygon(corners,(x,y)=>Math.abs(y-15),3.5,2),false);
});
test('real Miami city geography plans at least eight varied sports courts',()=>{
 const COG=require('../js/worldgen/geo.js');
 COG.SECTOR=256;
 const geo=COG.buildGeo(COG.WORLD_SEED);
 const context={COG,D_:COG.D,OW:{geo},MIA:{},
   world:{districtFn:(x,y)=>geo.districtAt(x,y)},
   roadDist:()=>99,pondVal:(x,y)=>geo.isLand(x,y)?2:0,
   ROAD_W:3.5,SIDE:2,mulberry:COG.rng,CityStreetLayout:street};
 vm.createContext(context);
 vm.runInContext(read('js/miami-city.js'),context,{timeout:10000});
 vm.runInContext('miaPlanSports()',context,{timeout:20000});
 const plan=context.MIA.sportsPlan,report=context.MIA.sportsReport;
 assert.ok(plan.length>=8,'menos de oito quadras planejadas: '+plan.length);
 assert.equal(plan.length,report.planned);
 const types=new Set(plan.map(x=>x.sport));
 for(const sport of ['basketball','volleyball','tennis','soccer'])
   assert.ok(types.has(sport),'modalidade ausente: '+sport);
 assert.ok(report.poor>=1,'guetos sem quadras planejadas');
 assert.ok(report.noble>=1,'bairros nobres sem quadras planejadas');
 assert.ok(plan.every(x=>x.x>0&&x.y>0),'local inválido');
 const far=plan.every((a,i)=>plan.slice(0,i).every(b=>Math.hypot(a.x-b.x,a.y-b.y)>=115));
 assert.equal(far,true,'quadras aglomeradas em uma única quadra urbana');
});
test('car rooftop occlusion uses the real rotated roof in source and browser bundle',()=>{
 const moduleSrc=read('js/vehicle-webgl.mjs');
 const bundle=read('js/vehicle-webgl.bundle.js');
 const collision=read('js/vehicle-collision.mjs');
 assert.match(moduleSrc,/H\.corners\|\|/);
 assert.match(moduleSrc,/system\.driver\|\|!H\.inside/);
 assert.match(moduleSrc,/bridge\.visionBlocker/);
 assert.match(bundle,/\w+\.corners\|\|/);
 assert.match(bundle,/\w+\.visionBlocker/);
 assert.match(collision,/H\.corners\|\|/);
 assert.match(bundle,/\.corners\|\|/);
});
test('trunk-only WebGL vegetation and vehicle-centric vision lens',()=>{
 const v=read('js/vehicle-occlusion.mjs');
 const game=read('js/game.js');
 assert.doesNotMatch(v,/make\(sphere,p\.x,ht\+r\*\.26/);
 assert.match(v,/make\(cylinder,p\.x,ht\*\.48/);
 assert.match(game,/const target=v\?\.driver/);
 assert.match(game,/vehicle\.car\.x/);
 assert.match(game,/visionBlocker=/);
});
test('street-facing facades rotate structural walls and roof, not only doors',()=>{
 const hs=read('js/houses.js');
 const mi=read('js/miami-city.js');
 const roof=read('js/roofs.js');
 const light=read('js/vision-light.js');
 assert.match(hs,/function orientHouseToRoad/);
 assert.match(hs,/H\.corners=CityStreetLayout\.orientedCorners/);
 assert.match(hs,/seg\.x1,seg\.y1,seg\.x2,seg\.y2/);
 assert.match(mi,/orientHouseToRoad\(H,L\.theta\)/);
 assert.match(mi,/clearPolygon\(corners,roadDist/);
 assert.match(roof,/H\.toWorld\?H\.toWorld/);
 assert.match(light,/H\.corners\|\|/);
});
test('court validation and all four sport renderers stay integrated',()=>{
 const m=read('js/miami-city.js');
 const ow=read('js/openworld.js');
 for(const key of ['drawSportNet','drawSportGoal','miaPlanSports','miaReserveSports',
     'S.sports','sport===\'basketball\'','sport===\'tennis\'','sport===\'volleyball\'','sport===\'soccer\''])
  assert.ok(m.includes(key),'recurso ausente: '+key);
 assert.match(ow,/miaPlanSports\(\)/);
 assert.match(ow,/sportOverlap/);
});
