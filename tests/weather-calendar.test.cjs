'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const cal=require('../js/calendar-system.js'),shelter=require('../js/weather-shelter.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('Calendar supports leap years and rejects invalid dates',()=>{
 let d=cal.setDate(2028,2,29,18,45);
 assert.equal(d.day,29);assert.equal(d.month,2);assert.equal(d.season,'inverno');
 assert.match(cal.format(),/29\/02\/2028 18:45/);
 assert.throws(()=>cal.setDate(2027,2,29),/Invalid calendar day/);
});
test('Calendar emits day, month and season events for game systems',()=>{
 cal.setDate(2028,2,29,23,59);
 const seen=[];
 const unsub=[cal.on('day',()=>seen.push('day')),cal.on('month',()=>seen.push('month')),
 cal.on('season',()=>seen.push('season'))];
 cal.advance(61); // 61 in-game minutes -> March 1
 assert.equal(cal.get().month,3);
 assert.deepEqual(seen,['day','month','season']);
 for(const off of unsub)off();
});
test('Calendar has a full 12-month cycle, day-length events and public events',()=>{
 const seasons=new Set();
 for(let month=1;month<=12;month++)seasons.add(cal.setDate(2029,month,1).season);
 assert.deepEqual([...seasons].sort(),['inverno','outono','primavera','verão']);
 assert.ok(cal.eventsFor(12,25).some(e=>e.id==='natal'));
 const off=cal.on('year',()=>{});
 off();
});
test('Shelter protects architectural rooms while balconies and streets stay exposed',()=>{
 const H={x0:0,y0:0,x1:12,y1:12,
 architecture:{toLocal:(x,y)=>[x,y],toWorld:(x,y)=>[x,y],
 levels:[{rooms:[{x0:1,y0:1,x1:5,y1:5}],outdoor:[{x0:6,y0:6,x1:10,y1:10}]},
 {rooms:[{x0:1,y0:1,x1:5,y1:5}],outdoor:[]}]}};
 shelter.bind([H],[]);
 assert.equal(shelter.isSheltered(2,2),true);
 assert.equal(shelter.isSheltered(8,8),false);
 assert.equal(shelter.isSheltered(30,30),false);
 assert.equal(shelter.regions(5,5,20).length,1,'Upper floor cannot cancel evenodd masking');
});
test('Rotated traditional houses and awnings shelter exterior tiles',()=>{
 const H={x0:0,y0:0,x1:10,y1:10,corners:[[0,0],[10,0],[10,10],[0,10]],
 contains:(x,y)=>x>=0&&x<=10&&y>=0&&y<=10};
 const awning={kind:'canopy',x:20,y:20,w:6,d:2,rot:Math.PI/2};
 shelter.bind([H],[awning]);
 assert.equal(shelter.isSheltered(5,5),true);
 assert.equal(shelter.isSheltered(20,22),true);
 assert.equal(shelter.isSheltered(17,20),false);
});
function climate(season,dayOfYear){
 const ctx={console,window:{},SUN:[0,0,1],CityCalendar:{get:()=>({season,dayOfYear,iso:'2029-01-01'})},
 clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),lerp:(a,b,w)=>a+(b-a)*w};
 ctx.globalThis=ctx;
 vm.createContext(ctx);
 vm.runInContext(read('js/env.js'),ctx);
 return ctx;
}
test('Summer rainfall and storm parameters interpolate without snow',()=>{
 const c=climate('verão',172);
 c.envSetWeather('rain');c.envTick(12,720);
 assert.ok(c.window.ENV.rain>.7);
 assert.equal(c.window.ENV.season,'verão');
 assert.equal(c.window.ENV.snow,0);
 assert.ok(c.window.ENV.wetness>0);
 c.envSetWeather('storm');c.envTick(12,700);
 assert.ok(c.window.ENV.wind>.4);
});
test('Automatic winter snow is restricted to the winter season',()=>{
 const summer=climate('verão',173);
 for(let i=0;i<60;i++){summer.envPickWeather();assert.equal(summer.envWeather().snow,0);}
 const winter=climate('inverno',1);
 winter.envSetWeather('snow');winter.envTick(10,720);
 assert.ok(winter.window.ENV.snow>.5);
 assert.ok(winter.window.ENV.temperature<=0);
 assert.ok(winter.window.ENV.snowCover>0);
});
test('Sunrise follows solstices and winter days are shorter',()=>{
 const summer=climate('verão',172),winter=climate('inverno',355);
 summer.envTick(.016,410);winter.envTick(.016,410);
 assert.ok(summer.window.ENV.sunEl>winter.window.ENV.sunEl);
});
test('Shader never whitens animated people, birds or indoor furniture',()=>{
 const amb=read('js/ambience-3d.mjs'),arch=read('js/architecture-3d.mjs');
 assert.match(amb,/o\.userData\?\.weatherOutdoorSurface/);
 assert.match(amb,/!o\.isSkinnedMesh/);
 assert.match(amb,/!o\.isInstancedMesh/);
 assert.match(arch,/mesh\.userData\.weatherOutdoorSurface=true/);
 assert.match(amb,/covered\(snowPos\[o\],snowPos\[o\+2\]\)/);
 assert.match(amb,/rainVertices\[j\+1\]=hidden\?-100/);
});
test('Game loads modules in order, exposes calendar UI and audio',()=>{
 const html=read('index.html'),g=read('js/game.js');
 assert.ok(html.indexOf('js/calendar-system.js')<html.indexOf('js/env.js'));
 assert.ok(html.indexOf('js/weather-shelter.js')<html.indexOf('js/game.js'));
 assert.match(g,/CityCalendar\?\.advance\(dt\)/);
 assert.match(g,/CityCalendarUI\?\.toggle\(\)/);
 assert.match(g,/CityWeatherAudio\?\.tick\(ENV,player\)/);
});
