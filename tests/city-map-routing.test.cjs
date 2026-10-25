const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');
function boot(){
  const ctx=vm.createContext({console,Math,Date,setTimeout,clearTimeout,performance:{now:()=>10000},
    document:{getElementById:()=>null,body:{classList:{toggle(){}}}},innerWidth:1500,innerHeight:900});
  ctx.window=ctx;ctx.globalThis=ctx;
  for(const f of ['js/worldgen/geo.js','js/city-districts.js','js/worldgen/roads.js','js/city-road-routing.js'])vm.runInContext(read(f),ctx,{filename:f});
  const model=ctx.COG.buildWorld(),pos={x:1550,y:1640};
  ctx.world={open:true,seed:model.seed,roads:model.roads,gasStations:[],spawn:[2100,900]};
  ctx.OW={geo:model.geo,cw:model};
  ctx.cityVehicleBridge={player:pos};ctx.CityUI={notify(){}};
  ctx.CitySim={data:{home:null}};ctx.CityRealty={owned:{}};
  vm.runInContext(read('js/city-gps.js'),ctx,{filename:'js/city-gps.js'});
  return {ctx,model,pos,gps:ctx.CityGPS};
}
test('road graph splits crossing streets; A* follows roads, not a straight shortcut',()=>{
  const ctx=vm.createContext({});ctx.window=ctx;vm.runInContext(read('js/city-road-routing.js'),ctx);
  const map=ctx.CityRoadRouting.build([
    {cls:'street',pts:[[0,0],[100,0]]},
    {cls:'street',pts:[[50,-50],[50,50]]},
  ]);
  const r=map.route({x:0,y:0},{x:50,y:50});
  assert.ok(r);
  assert.ok(Math.abs(r.length-100)<1e-5,JSON.stringify(r));
  assert.ok(r.points.some(([x,y])=>Math.abs(x-50)<.01&&Math.abs(y)<.01));
  assert.ok(r.length>Math.hypot(50,50));
});
test('Bellavista graph is connected from center to both towns',()=>{
  const {ctx,model}=boot(),net=ctx.CityRoadRouting.build(model.roads);
  assert.ok(net.nodeCount>300&&net.edgeCount>net.nodeCount);
  for(const to of model.geo.anchors.towns){
    const r=net.route(model.geo.anchors.downtown,to);
    assert.ok(r&&r.points.length>3,'no route for '+to.name);
    assert.ok(r.length>=Math.hypot(to.x-model.geo.anchors.downtown.x,to.y-model.geo.anchors.downtown.y)-1);
    for(const p of r.points)assert.ok(net.nearest(p[0],p[1]).d<2.4,'routing left the road');
  }
});
test('GPS snaps to existing roads, updates route, and clears only at arrival',()=>{
  const {gps,pos}=boot();
  assert.equal(gps.set({x:1780,y:1810,name:'Mercado'}),true);
  assert.ok(gps.route.points.length>4);
  assert.ok(gps.route.length>0);
  assert.ok(gps.target.snapped);
  gps.tick(pos);assert.ok(gps.target);
  pos.x=gps.route.to[0];pos.y=gps.route.to[1];
  gps.tick(pos);assert.equal(gps.target,null);
  assert.equal(gps.route,null);
});
test('GPS rejects unreachable requests instead of drawing diagonal fallback',()=>{
 const {gps}=boot();
 assert.equal(gps.set({x:-90000,y:-90000}),false);
 assert.equal(gps.route,null);
});
test('mouse-centered zoom preserves world coordinate under the pointer',()=>{
 const {ctx}=boot();
 ctx.hudC={width:1500,height:900};
 ctx.clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 vm.runInContext(read('js/worldmap.js'),ctx);
 const before=vm.runInContext(`wmap.scale=.65;wmap.ox=-450;wmap.oy=-350;
   [(600-wmap.ox)/wmap.scale,(390-wmap.oy)/wmap.scale]`,ctx);
 vm.runInContext('wmapZoomAt(600,390,1.17)',ctx);
 const after=vm.runInContext('[(600-wmap.ox)/wmap.scale,(390-wmap.oy)/wmap.scale]',ctx);
 assert.ok(Math.abs(before[0]-after[0])<.001);
 assert.ok(Math.abs(before[1]-after[1])<.001);
});
test('map overlay hides playing controls and files load in dependency order',()=>{
 const css=read('css/city-map.css'),html=read('index.html');
 assert.match(css,/body\.map-open #city-controls/);
 assert.match(css,/body\.map-open #view\{cursor:crosshair/);
 assert.match(css,/#city-map-ui\.active/);
 assert.ok(html.includes('css/city-map.css'));
 assert.ok(html.indexOf('js/city-road-routing.js')<html.indexOf('js/city-gps.js'));
 assert.match(read('js/game.js'),/if\(wmap\.open\)\{\s*if\(input\.hit\('m'\)/);
 assert.match(read('js/game.js'),/wmapDrag\(/);
});
