// modular-characters.mjs — personagens modulares da Quaternius (Ultimate Modular Men/Women, CC0).
// Cada sexo tem um GLB (assets/characters/modular/{male,female}.glb, feito por tools/import-quaternius.mjs) com UM
// esqueleto (nomes Mixamo) e todas as peças: cabeça (rosto + cabelo/chapéu), tronco, pernas, pés e acessório.
// Um "visual" (look) escolhe uma peça por encaixe e as cores: pele, cabelo, roupa de cima/baixo e calçado
// ('' = cor original da peça). Sem engine: só dados + funções puras (testáveis no Node) e a montagem da cena.
export const MODULAR_DIR='assets/characters/modular/';
export const SLOTS=Object.freeze(['head','body','legs','feet','acc']);
export const SLOT_LABEL=Object.freeze({head:'Cabeça e cabelo',body:'Parte de cima',legs:'Parte de baixo',feet:'Calçados',acc:'Acessório'});

// nomes das peças (id do personagem de origem) — rótulos do CAS
export const PART_LABEL=Object.freeze({
 male:{adventurer:'Aventureiro',beach:'Praia',casual_2:'Casual',casual_hoodie:'Moletom',farmer:'Fazendeiro',king:'Rei',punk:'Punk',space_suit:'Traje espacial',suit:'Terno',swat:'Tático',worker:'Operário',backpack:'Mochila'},
 female:{adventurer:'Aventureira',casual:'Casual',formal:'Social',medieval:'Medieval',punk:'Punk',scifi:'Futurista',soldier:'Militar',suit:'Executiva',witch:'Bruxa',worker:'Operária'}
});
// o que cada cabeça traz (o cabelo vem junto com o rosto)
export const HEAD_HINT=Object.freeze({
 male:{adventurer:'cabelo comprido e barba',beach:'cabelo comprido',casual_2:'cabelo curto',casual_hoodie:'cabelo bagunçado',farmer:'chapéu de palha',king:'coroa e barba branca',punk:'moicano',space_suit:'capacete espacial',suit:'cabelo penteado',swat:'capacete tático',worker:'capacete e bigode'},
 female:{adventurer:'cabelo preso',casual:'cabelo chanel',formal:'coque ruivo',medieval:'touca',punk:'moicano',scifi:'cabelo longo preto',soldier:'rabo de cavalo',suit:'cabelo chanel',witch:'chapéu de bruxa',worker:'capacete'}
});
// peças que não combinam com a rua de uma cidade atual: ficam só no CAS (o jogador pode usar), fora dos NPCs
export const FANTASY=Object.freeze({male:new Set(['king','space_suit']),female:new Set(['medieval','witch','scifi'])});

export const SKIN_TONES=Object.freeze(['#f3d5bd','#e6bc98','#d2a47c','#b98059','#94603f','#6e4430','#4a2d20']);
export const HAIR_COLORS=Object.freeze(['#1c1716','#3a2619','#5c3b22','#8a5a32','#b8874f','#dcc28c','#8f8f8f','#e9e4dc','#8e2b22','#5b2d6e']);
export const CLOTH_COLORS=Object.freeze(['#1f2329','#3a3f47','#e8e4dc','#2e4a6b','#4a6a8a','#6b2c2c','#a23b2f','#2f5d3a','#6b6b3a','#c2a36b','#8a5a8a','#d98a2b']);
const COLOR=/^#[0-9a-f]{6}$/i,ID=/^[a-z0-9_]{1,40}$/;

// papel de cada material da peça (pelo nome do material no pack)
export function materialRole(slot,part,name,sex){
 if(/^skin/i.test(name))return 'skin';
 if(/^(eye|eyes)$/i.test(name)||(sex==='female'&&slot==='head'&&name==='Brown'))return 'eyes';
 if(slot==='head'){
  if(/^(hair|hair_|eyebrows|moustache)/i.test(name))return 'hair';
  // cabelos com material "de cor": ruivo (social), moicanos (punk)
  if((sex==='female'&&part==='formal'&&name==='Red')||(sex==='female'&&part==='punk'&&name==='Pink')||(sex==='male'&&part==='punk'&&name==='Red'))return 'hair';
  return 'hat';
 }
 if(/metal|gold|visor|earring/i.test(name))return 'metal';
 return 'cloth';
}
// cor principal da peça = o material de roupa com mais triângulos (é o que o jogador tinge)
export function primaryCloth(partMeta,sex){
 const c=(partMeta?.materials||[]).filter(m=>materialRole(partMeta.slot,partMeta.id,m.name,sex)==='cloth').sort((a,b)=>b.triangles-a.triangles)[0];
 return c?c.name:null;
}

// normaliza um visual contra o manifesto (peças existentes do sexo)
export function normalizeLook(input={},manifest=null){
 const sex=input.sex==='female'?'female':'male',parts=manifest?.[sex]?.parts||null;
 const has=(slot,id)=>!parts||parts.some(p=>p.slot===slot&&p.id===id);
 const first=slot=>parts?.find(p=>p.slot===slot)?.id||'';
 const def=DEFAULT_PARTS[sex];
 const look={sex};
 for(const slot of ['head','body','legs','feet']){
  const v=String(input[slot]||'');look[slot]=ID.test(v)&&has(slot,v)?v:(has(slot,def[slot])?def[slot]:first(slot));
 }
 look.acc=ID.test(String(input.acc||''))&&has('acc',input.acc)?input.acc:'';
 look.skin=COLOR.test(input.skin||'')?input.skin.toLowerCase():SKIN_TONES[2];
 for(const k of ['hair','top','bottom','shoes'])look[k]=COLOR.test(input[k]||'')?input[k].toLowerCase():'';
 return look;
}
export const DEFAULT_PARTS=Object.freeze({male:{head:'casual_hoodie',body:'casual_hoodie',legs:'casual_hoodie',feet:'casual_hoodie'},female:{head:'casual',body:'casual',legs:'casual',feet:'casual'}});
export const lookKey=l=>[l.sex,l.head,l.body,l.legs,l.feet,l.acc||'-',l.skin,l.hair||'-',l.top||'-',l.bottom||'-',l.shoes||'-'].join('|');

// visual aleatório (determinístico pela semente) p/ moradores: mistura peças de personagens diferentes
export function randomLook(sex,seed,manifest,{street=true,pool=null}={}){
 let s=hash(String(seed))||1;const rnd=()=>((s=Math.imul(s^s>>>15,2246822507)^Math.imul(s^s>>>13,3266489909)),((s>>>0)%10007)/10007);
 const pick=a=>a[Math.floor(rnd()*a.length)%a.length];
 const ids=slot=>(manifest?.[sex]?.parts||[]).filter(p=>p.slot===slot&&(!street||!FANTASY[sex].has(p.id))&&(!pool?.[slot]||pool[slot].includes(p.id))).map(p=>p.id);
 const look={sex};
 for(const slot of ['head','body','legs','feet']){const a=ids(slot);look[slot]=a.length?pick(a):DEFAULT_PARTS[sex][slot];}
 look.acc='';look.skin=pick(SKIN_TONES);look.hair=rnd()<.7?pick(HAIR_COLORS.slice(0,7)):'';
 look.top=rnd()<.6?pick(CLOTH_COLORS):'';look.bottom=rnd()<.5?pick(CLOTH_COLORS.slice(0,6)):'';look.shoes=rnd()<.3?pick(CLOTH_COLORS.slice(0,3)):'';
 return look;
}
export function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

// ---------- montagem da cena (three.js) ----------
// base: gltf.scene do sexo; cloneSkeleton: SkeletonUtils.clone; THREE: o módulo three
export function buildLookScene(THREE,cloneSkeleton,base,look,manifest){
 const root=cloneSkeleton(base),want=new Set(SLOTS.map(s=>s+'-'+(look[s]||'')));
 const drop=[];root.traverse(o=>{if(o.userData?.slot&&!want.has(o.name))drop.push(o);});
 for(const o of drop)o.parent.remove(o);
 const meta=manifest?.[look.sex]?.parts||[],partOf=(slot,id)=>meta.find(p=>p.slot===slot&&p.id===id);
 const tint={skin:look.skin,hair:look.hair},cloth={body:look.top,legs:look.bottom,feet:look.shoes};
 let triangles=0;
 root.traverse(o=>{
  if(!o.isMesh)return;
  o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;
  const holder=o.userData?.slot?o:o.parent,slot=holder?.userData?.slot,part=holder?.userData?.part;if(!slot)return;
  triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;
  const primary=cloth[slot]?primaryCloth(partOf(slot,part),look.sex):null;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  o.material=mats.map(m=>{
   const role=materialRole(slot,part,m.name,look.sex);let color=null;
   if(role==='skin')color=tint.skin;
   else if(role==='hair')color=tint.hair;
   else if(role==='cloth'&&primary&&m.name===primary)color=cloth[slot];
   if(!color)return m;
   const c=m.clone();c.color.set(color);if(/darker/i.test(m.name))c.color.multiplyScalar(.86);c.userData.casRole=role;return c;
  });
  if(o.material.length===1)o.material=o.material[0];
 });
 root.userData.look=look;root.userData.triangles=triangles|0;
 return root;
}
