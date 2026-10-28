// Deterministic lightweight resident identities, independent of the 3D renderer.
// Appearance remains limited to approved bodies and independently named materials.
const FIRST=['Rafael','Camila','Bruno','Mariana','Diego','Larissa','André','Juliana','Caio','Bianca','Felipe','Renata','Lucas','Beatriz','Pedro','Viviane'];
const LAST=['Silva','Santos','Almeida','Costa','Oliveira','Mendes','Ribeiro','Martins'];
const TOP=['#e3dacd','#313b45','#783e38','#c2b9a8','#4e6066','#56634b','#b0a48f','#2b2b30'];
const BOTTOM=['#30475b','#32383b','#5b6268','#2f3443','#65594d'];
function rng(seed){let x=seed>>>0;return ()=>{x=(x+0x6d2b79f5)|0;let t=Math.imul(x^(x>>>15),1|x);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
export function createResidents(seed=20261028,count=10){
 const r=rng(seed),out=[];
 const limit=Math.min(16,Math.max(0,Math.floor(count)));
 for(let i=0;i<limit;i++){
  const sex=i%2?'female':'male',v=r();
  const name=FIRST[i%FIRST.length]+' '+LAST[Math.floor(r()*LAST.length)];
  out.push({
   id:'resident-'+seed+'-'+i,name,sex,
   age:21+Math.floor(r()*48),
   height:0.93+r()*0.12,
   build:0.93+r()*0.13,
   walkSpeed:0.9+r()*0.6,
   outfit:{top:TOP[(i+Math.floor(v*TOP.length))%TOP.length],bottom:BOTTOM[Math.floor(r()*BOTTOM.length)]},
   heading:r()*Math.PI*2,
   radius:5+r()*11,
   style:i%4===0?'work':i%4===1?'street':i%4===2?'casual':'sport'
  });
 }
 return out;
}
