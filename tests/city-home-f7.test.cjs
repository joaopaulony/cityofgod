const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/city-home.js','utf8');
const ui=fs.readFileSync('js/city-home-ui.js','utf8');

function fixture(){
 const files=new Map();
 const localStorage={getItem:k=>files.get(k)||null,setItem:(k,v)=>files.set(k,v)};
 const H={seed:1,x0:0,y0:0,x1:12,y1:12,_architectureFurnished:true,interactables:[],
   architecture:{width:12,depth:12,toWorld:(x,y)=>[x,y],toLocal:(x,y)=>[x,y],
    levels:[{floor:0,z:0,rooms:[{id:'living',use:'living',x0:0,y0:0,x1:12,y1:12}],walls:[]}]},
   contains(x,y){return x>0&&y>0&&x<12&&y<12;}};
 const world={seed:17,open:false,segs:[],upperSegs:[],version:0};
 const boxes=[];
 const ctx=vm.createContext({window:{dispatchEvent(){}},world,boxes,houses:[H],localStorage,
   console,performance:{now:()=>1000},Event:class{},Math,Date});
 ctx.CityRealty={id:()=> 'home',isOwned:x=>x===H};
 ctx.CityLife={funds:100000,debit(v){this.funds-=v;return true},credit(v){this.funds+=v;return true},money:v=>String(v)};
 ctx.addBox=b=>{boxes.push(b);if(b.solid)world.segs.push({sourceBox:b});return b};
 vm.runInContext(fs.readFileSync('js/furniture-quaternius.js','utf8'),ctx);
 ctx.addBox({house:H,kind:'desk',x:4,y:4,z:0,w:1.3,d:.7,h:.76,rot:0,floor:0,solid:true,faceW:[0,1],along:1.3,depth:.7});
 ctx.addBox({house:H,kind:'qf_shelf_large',x:8,y:8,z:0,w:1.69,d:.378,h:2.219,rot:0,floor:0,solid:true});
 vm.runInContext(source,ctx);
 const C=ctx.window.CityHome;
 assert.equal(C.sync(H),true);
 return {C,H,ctx,boxes};
}
test('all standard and Quaternius furniture entries share validated editable dimensions',()=>{
 const {C}=fixture();
 for(const [id,d] of Object.entries(C.catalog)){
   assert.ok(d.w>0&&d.d>0&&d.h>0&&Number.isFinite(d.w*d.d),id);
 }
 assert.ok(Object.keys(C.catalog).length>=80);
});
test('rotating a desk moves its supported monitor/lamp with position, angle and facing',()=>{
 const {C,H}=fixture();
 const desk=C.placed(H).find(x=>x.kind==='desk');
 const child={id:'lamp',kind:'lampdesk',status:'placed',supportId:desk.id,
   x:4.2,y:4,z:.76,w:.2,d:.2,h:.4,rot:0,floor:0,solid:false,faceW:[0,1]};
 C.saved[C.key(H)].items.push(child);
 const changed=C.move(H,desk.id,{x:6,y:6,rot:Math.PI/2});
 assert.equal(changed.ok,true,changed.text);
 const moved=C.find(H,desk.id),lamp=C.find(H,'lamp');
 assert.ok(Math.abs(moved.x-6)<.01&&Math.abs(moved.y-6)<.01);
 assert.ok(Math.abs(lamp.x-6)<.01&&Math.abs(lamp.y-6.2)<.01,JSON.stringify(lamp));
 assert.ok(Math.abs(moved.faceW[0]+1)<.01,'facing should rotate with desk');
 assert.ok(Math.abs(lamp.faceW[0]+1)<.01,'lamp direction rotates together');
});
test('a large Quaternius shelf actually moves and changes its world display box',()=>{
 const {C,H,boxes}=fixture(),s=C.placed(H).find(x=>x.kind==='qf_shelf_large');
 const moved=C.move(H,s.id,{x:8.4,y:6.5,rot:Math.PI/4});
 assert.equal(moved.ok,true,moved.text);
 assert.ok(Math.abs(C.find(H,s.id).x-8.4)<.01);
 assert.ok(Math.abs(C.find(H,s.id).rot-Math.PI/4)<.001);
 assert.ok(boxes.some(b=>b.homeId===s.id&&Math.abs(b.x-8.4)<.01));
});
test('F7 pointer capture, 3D preview, full furniture silhouette and cancel work in the source',()=>{
 for(const term of [
   "view.addEventListener('pointerdown',onDown,true)",
   "view.addEventListener('pointermove',onMove,true)",
   "view.addEventListener('pointerup',onUp,true)",
   "view.addEventListener('pointercancel',onCancel,true)",
   "view.setPointerCapture?.(e.pointerId)",
   "const corners=boxCorners(b)",
   "proj(px,py,(b.z||0)+b.h)",
   "previewBox.x=draft.x;previewBox.y=draft.y",
   "previewChildren=items.filter(b=>b.supportId===draft.id)",
   "box.x=draft.x+dx*c-dy*s;box.y=draft.y+dx*s+dy*c",
   "for(const {box,before} of previewChildren)Object.assign(box,before)",
   "const clean=()=>{clearPreview()",
   "CityHome.move(H,draft.id,draft)"
 ])assert.ok(ui.includes(term),'F7 missing '+term);
});

test('every catalog furniture model can be bought, placed, translated, rotated and stored',()=>{
 const {C,H}=fixture();
 const entries=Object.entries(C.catalog);
 const failures=[];
 for(const [kind,d] of entries){
  const bought=C.buy(H,kind);
  if(!bought.ok){failures.push(kind+': buy '+bought.text);continue;}
  const item=C.inventory(H).at(-1);
  let placed=false;
  for(const [x,y] of [[4,9.3],[4,8],[5,10],[6,9.6],[2.8,9.5]]){
   const attempt=C.place(H,item.id,{x,y,rot:0,floor:0});
   if(attempt.ok){placed=true;break;}
  }
  if(!placed){failures.push(kind+': no valid placement');continue;}
  const old=C.find(H,item.id);
  let moved=false;
  for(const [dx,dy,rot] of [[.25,0,.08],[0,.25,.08],[-.25,0,.08],[0,-.25,.08]]){
   const next=C.move(H,item.id,{x:old.x+dx,y:old.y+dy,rot});
   if(next.ok){moved=true;break;}
  }
  if(!moved){failures.push(kind+': could not translate/rotate');continue;}
  const stored=C.store(H,item.id);
  if(!stored.ok)failures.push(kind+': '+stored.text);
 }
 assert.deepEqual(failures,[],failures.join('\n'));
 assert.ok(entries.length>=100,'expected classic and complete Quaternius catalog');
});
