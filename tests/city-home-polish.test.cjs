const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/city-home.js','utf8');
function fixture({angle=0}={}){
 const store=new Map(),localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const c=Math.cos(angle),s=Math.sin(angle);
 const toWorld=(u,v)=>[30+u*c-v*s,15+u*s+v*c],
       toLocal=(x,y)=>[(x-30)*c+(y-15)*s,-(x-30)*s+(y-15)*c];
 const H={seed:5,x0:24,y0:15,x1:42,y1:30,_architectureFurnished:true,interactables:[],
  architecture:{width:12,depth:12,toWorld,toLocal,levels:[{z:0,rooms:[{id:'living',use:'living',x0:0,x1:12,y0:0,y1:12}],
    walls:[{a:[0,8],b:[0,12],openings:[{kind:'door',at:2,width:1.2}]}]}]},
  contains(x,y){const [u,v]=toLocal(x,y);return u>=0&&v>=0&&u<=12&&v<=12;}};
 const houses=[H],boxes=[],world={seed:101,open:false,segs:[],upperSegs:[],version:0};
 const ctx=vm.createContext({window:{dispatchEvent(){}},world,houses,boxes,localStorage,
    Event:class{constructor(name){this.name=name}},console,Math,Date,performance:{now:()=>1000}});
 ctx.CityRealty={id:()=> 'property',isOwned:h=>h===H};ctx.CityLife={
  funds:10000,debit(v){if(this.funds<v)return false;this.funds-=v;return true;},
  credit(v){this.funds+=v;return true;},money:v=>'R$ '+v};
 ctx.addBox=b=>{boxes.push(b);if(b.solid!==false)world.segs.push({sourceBox:b});return b;};
 const [x,y]=toWorld(5,5);
 ctx.addBox({house:H,kind:'sofa',x,y,w:2,d:1,h:.9,z:0,rot:angle,floor:0,solid:true,top:'#627d9b'});
 vm.runInContext(source,ctx,{filename:'js/city-home.js'});
 const core=ctx.window.CityHome;core.sync(H);
 return {core,H,ctx,boxes,toWorld,toLocal};
}
const clone=o=>JSON.parse(JSON.stringify(o));
test('sofa snaps within 3 cm of a real room wall, without crossing it',()=>{
 for(const angle of [0,Math.PI/2]){
  const {core,H,toWorld,toLocal}=fixture({angle}),original=core.placed(H)[0];
  const [x,y]=toWorld(1.1,2);
  const draft={...original,x,y,rot:angle};
  const result=core.snap(H,draft,original.id);
  assert.equal(result.snapped,true,'magnet did not engage');
  assert.equal(result.guides.includes('parede'),true);
  assert.equal(core.check(H,result.item,original.id).ok,true);
  const [lx]=toLocal(result.item.x,result.item.y);
  assert.ok(Math.abs(lx-1.025)<.015,'expected 2.5 cm clearance');
 }
});
test('two sofas snap side by side without clipping or excessive gaps',()=>{
 const {core,H,toWorld}=fixture();
 const sofa=core.placed(H)[0];const [x,y]=toWorld(7.2,5);
 const moving={...sofa,x,y,rot:0,id:'other'};
 const result=core.snap(H,moving,'other');
 assert.equal(result.snapped,true);
 assert.equal(result.guides.includes('móvel'),true);
 const gap=result.item.x-(sofa.x+sofa.w/2+moving.w/2);
 assert.ok(gap>=.011&&gap<=.04,'unwanted gap '+gap);
 assert.equal(core.check(H,result.item,'other').ok,true);
});
test('actual doorway width remains protected even with tighter walls',()=>{
 const {core,H,toWorld}=fixture();
 const source=core.placed(H)[0],row={...source,w:.5,d:.5,rot:0};
 const [dx,dy]=toWorld(.38,10);
 assert.equal(core.check(H,{...row,x:dx,y:dy},source.id).ok,false);
 const [ex,ey]=toWorld(.4,6);
 assert.equal(core.check(H,{...row,x:ex,y:ey},source.id).ok,true);
});
test('catalog color is charged once, survives storage, and is restored after stream reload',()=>{
 const {core,H,ctx,boxes,toWorld}=fixture();
 assert.equal(core.buy(H,'sofa','#ae8273').ok,true);
 assert.equal(ctx.CityLife.funds,8750);
 const purchased=core.inventory(H).at(-1);
 assert.equal(purchased.top,'#ae8273');
 const [x,y]=toWorld(9,8);
 assert.equal(core.place(H,purchased.id,{x,y,rot:0,floor:0}).ok,true);
 assert.equal(boxes.find(b=>b.homeId===purchased.id).top,'#ae8273');
 assert.equal(core.store(H,purchased.id).ok,true);
 assert.equal(core.find(H,purchased.id).top,'#ae8273');
 const before=ctx.CityLife.funds;
 assert.equal(core.buy(H,'sofa','bad<script>').ok,false);
 assert.equal(ctx.CityLife.funds,before);
 assert.equal(core.undo(H).ok,true); // reverse store, not a purchase
 const newH={...H,interactables:[]};
 ctx.houses[0]=newH;ctx.CityRealty.isOwned=h=>h===newH;
 boxes.length=0;ctx.world.segs.length=0;
 ctx.addBox({house:newH,kind:'sofa',x:35,y:20,w:2,d:1,h:.9,rot:0,floor:0,solid:true});
 assert.equal(core.sync(newH),true);
 assert.equal(core.find(newH,purchased.id).top,'#ae8273');
 assert.ok(boxes.some(b=>b.homeId===purchased.id&&b.top==='#ae8273'));
});
test('all City Home models produce color-sensitive 3D catalog thumbnails',()=>{
 const src=fs.readFileSync('js/props-3d.mjs','utf8');
 const ui=fs.readFileSync('js/city-home-ui.js','utf8');
 const vehicle=fs.readFileSync('js/vehicle-webgl.mjs','utf8');
 for(const kind of ['sofa','chair','bed','fridge','stove','table','wardrobe','desk','tv','mirror'])
  assert.match(src,new RegExp('M\\.'+kind+'\\s*=\\s*\\{[^\\n]*tinted\\s*:\\s*true'),'no paint '+kind);
 assert.match(src,/function thumbnail\(name,color\)/);
 assert.match(src,/photoRenderer\.render\(scene2,camera\)/);
 assert.match(src,/photoCache\.size>72/);
 assert.match(vehicle,/system\.furnitureThumbnail/);
 assert.match(ui,/window\.cityVehicles\?\.furnitureThumbnail/);
 assert.match(ui,/data-home-action="variant"/);
 assert.match(ui,/data-home-color/);
 assert.match(ui,/CityHome\.buy\(H,value,paintOf\(value\)\)/);
});
