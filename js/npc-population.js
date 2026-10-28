// Seeded, deterministic inhabitants. Classic script because game.js uses classic globals.
// Visuals are generated from the two shared rigged Reborn bodies by the WebGL module.
(function(root){
 'use strict';
 const FIRST=['Caio','Julia','Mateus','Bruna','Renato','Carolina','Diego','Isabela','Pedro','Marina','Rafael','Beatriz','André','Larissa','Vitor','Luana','Henrique','Camila','Thiago','Aline','Davi','Yasmin','Samuel','Valentina','Enzo','Gabriela','Igor','Paula','Nicolas','Fernanda'];
 const LAST=['Almeida','Pereira','Lima','Santos','Costa','Nogueira','Ramos','Fernandes','Gomes','Ribeiro','Moreira','Barbosa','Oliveira','Carvalho','Martins','Rocha','Vieira','Monteiro'];
 const SKINS=['#f1c9a3','#e7ad7f','#d99768','#c48356','#a96848','#8d5339','#623b30','#472b24'];
 const HAIR=['#171315','#37241a','#754a2d','#b18b60','#2c272e','#775c50','#ba8e6a'];
 const TOPS=['#f1e8dc','#2c3a46','#ad514b','#37676e','#c89b5a','#666c73','#2f4937','#917b9e','#d16f44','#232327','#356c99','#9e5c6b'];
 const BOTTOMS=['#2a3542','#415369','#25272e','#6d574a','#37413a','#181c27','#646968','#455879'];
 const SHOES=['#e8e5de','#b5ada2','#303439','#6f443b','#bca07a'];
 const ROLES=['pedestre','trabalhador','estudante','compras','entregas','passeio','esporte'];
 const HEADS=['none','none','none','cap','beanie','glasses'];
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 function hash(x){let s=String(x),h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0;}
 function random(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
 function makeResidentSpec(index,seed='cityofgod-v1'){
  const n=Math.max(0,Math.floor(index));const rng=random(hash(seed+'|'+n));
  const choice=a=>a[Math.floor(rng()*a.length)];
  const sex=rng()<.5?'female':'male';
  const style=choice(ROLES),headwear=choice(HEADS);
  // Name/sex are fictional demographic descriptors, not inferred from skin tone.
  return Object.freeze({
   id:'resident-'+n,seed:hash(seed+'|'+n),name:choice(FIRST)+' '+choice(LAST),sex,age:18+Math.floor(rng()*53),
   role:style,height:+(.89+rng()*.22).toFixed(3),build:+(.86+rng()*.29).toFixed(3),
   skin:choice(SKINS),hair:choice(HAIR),top:choice(TOPS),bottom:choice(BOTTOMS),
   shoes:choice(SHOES),headwear,accent:choice(TOPS),walkSpeed:+(1.05+rng()*.55).toFixed(3),
   energy:+(.3+rng()*.65).toFixed(3),animationOffset:+(rng()*10).toFixed(3),
  });
 }
 function createResidents({count=12,seed='cityofgod-v1',houses=[],fallback=[20,20],makeActor,pal}){
  if(typeof makeActor!=='function')throw Error('Population requires makeActor()');
  const limit=clamp(Math.floor(Number(count)||0),0,24),result=[];
  const sites=houses.filter(h=>Array.isArray(h?.front)&&h.front.every(Number.isFinite)&&Array.isArray(h.doorN));
  for(let i=0;i<limit;i++){
   const spec=makeResidentSpec(i,seed),rng=random(spec.seed+177);
   const h=sites.length?sites[Math.floor(rng()*sites.length)]:null;
   const base=h?h.front:fallback;
   const normal=h?h.doorN:[1,0];
   const cx=base[0]+normal[0]*1.5,cy=base[1]+normal[1]*1.5;
   const r=2.8+rng()*2.4;
   const x=cx+(rng()-.5)*r,y=cy+(rng()-.5)*r;
   const home=[cx-r/2,cy-r/2,r,r];
   const actor=makeActor({x,y,face:rng()*Math.PI*2,armed:false,name:spec.name,pal,home,goal:null,timer:rng()*4});
   actor.population=spec;
   result.push(actor);
  }
  return result;
 }
 root.CityPopulation=Object.freeze({makeResidentSpec,createResidents,hash,palettes:{skin:SKINS,top:TOPS,bottom:BOTTOMS}});
})(typeof window!=='undefined'?window:globalThis);
