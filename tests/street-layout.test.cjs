const {test}=require('node:test');
const assert=require('node:assert/strict');
const layout=require('../js/street-layout.js');
const rw=3.5,side=2,rd=(_x,y)=>Math.abs(y);
test('road and sidewalk stay free of trees',()=>{
 assert.equal(layout.verge(0,0,.3,rd,rw,side),false);
 assert.equal(layout.verge(0,4.4,.3,rd,rw,side),false);
 assert.equal(layout.verge(0,6.5,.3,rd,rw,side),true);
});
test('fixtures must clear the roadway with their entire footprint',()=>{
 assert.equal(layout.edgeFixture(0,3.8,.4,rd,rw),false);
 assert.equal(layout.edgeFixture(0,4.5,.3,rd,rw),true);
});
test('judge catches street clutter and backwards facades',()=>{
 const result=layout.judge({
  lamps:[{x:0,y:2}],props:[{type:'tree',x:2,y:4.5}],
  boxes:[{kind:'bench',x:2,y:1,w:1.8,d:.6}],
  houses:[{doorPt:[2,8],doorN:[0,1],miaKind:'bungalow'}]
 },rd,rw,side);
 assert.ok(result.roadHazards>0);assert.ok(result.blockedSidewalks>0);
 assert.ok(result.wrongFacades>0);assert.equal(result.passed,false);
});
test('judge approves clear street and correct facade',()=>{
 const result=layout.judge({
  lamps:[{x:0,y:6.8}],props:[{type:'tree',x:3,y:7.2}],
  boxes:[{kind:'hydrant',x:1,y:5.1,w:.3,d:.3}],
  houses:[{doorPt:[2,8],doorN:[0,-1]}]
 },rd,rw,side);
 assert.equal(result.passed,true);
});
