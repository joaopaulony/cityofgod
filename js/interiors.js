// interiors.js — detalhes domesticos e interacao 100% Canvas 2D.
// Instanciado nas coordenadas locais de cada construcao; funciona com a rotacao
// do lote e separacao dos dois pisos, sem assets de terceiros.
'use strict';
const INTERIOR_FEATURES={
 A:[['stove',1.1,1.0,.7,.52,.94],['sink',2.5,.85,.72,.6,.86],
    ['cabinet',.6,2,.42,1.15,1.72],['toilet',7.1,6.35,.55,.75,.52],
    ['shower',8.65,6.4,.85,.8,1.86],['mirror',7.45,7.48,.9,.12,1.53],
    ['rug',2.8,5.7,1.6,1.05,.025]],
 B:[['stove',6.7,1.5,.75,.58,.86],['sink',5.5,1.3,.7,.55,.85],
    ['cabinet',6.8,2.8,.52,.85,1.55],['toilet',5.7,6.2,.55,.8,.48],
    ['shower',6.75,6.55,.77,.73,1.82],['rug',3.5,5.9,1.5,1.1,.025]],
 C:[['stove',8.2,1.75,.78,.7,.86],['sink',10.5,1.1,.7,.57,.86],
    ['cabinet',11.2,4.7,.46,1.25,1.6],['rug',2.8,3.5,1.5,1.2,.025]],
 D:[['stove',8.4,1.6,.68,.6,.89],['sink',6.2,1.1,.7,.55,.87],
    ['cabinet',9.3,5.0,.45,1.35,1.58],['rug',2.6,3.9,1.6,1.1,.025]],
 FARM:[['stove',6.45,1.75,.72,.63,.87],['sink',8.3,1,.69,.54,.87],
    ['cabinet',6,3.1,.5,.9,1.6],['toilet',7.2,7.25,.51,.61,.5],
    ['rug',2.55,4.7,1.35,.95,.025]],
 COTTAGE:[['stove',6.35,1.1,.7,.65,.87],['sink',5,1.05,.68,.55,.86],
    ['cabinet',7.5,2.55,.48,.9,1.58],['toilet',5.65,7.1,.54,.65,.48],
    ['rug',2,3.8,1.25,.95,.025]]
};
const UPPER_FEATURES={
 C:[['shower',8.1,7.75,.90,.9,1.90],
    ['mirror',9.9,9.45,.85,.10,1.58],
    ['cabinet',1.4,3.85,.52,1.15,1.6],
    ['rug',3.5,2.8,1.3,.9,.025]],
 D:[['shower',6.2,7.7,.76,.85,1.82],
    ['mirror',7.7,9.3,.78,.10,1.60],
    ['cabinet',1.2,3.85,.48,.85,1.58],
    ['rug',3.4,2.9,1.1,.8,.025]]
};
const FEATURE_PALETTE={
 stove:['#bbb6aa','#67635d'],sink:['#ddd9ce','#8d8072'],
 cabinet:['#a1825f','#66452f'],toilet:['#eeeae2','#b1b3b0'],
 shower:['#b9bec1','#8fabae'],mirror:['#aabfca','#5d737c'],
 rug:['#8c7665','#695546']
};
const INTERIOR_LABELS={
 door:'porta',switch:'interruptor',fridge:'geladeira',stove:'fogao',
 sink:'pia',cabinet:'armario',bed:'cama',sofa:'sofa',
 wardrobe:'guarda-roupa',tv:'televisao',shower:'chuveiro',
 toilet:'vaso sanitario',mirror:'espelho',table:'mesa',
 desk:'escrivaninha',shelf:'estante'
};
function decorateHouse(H,T,L,k){
  H.interactables=[];H.indoorLights=[];
  H.lightOn=(H.seed%5)!==0;H.tvOn=false;
  const angle=k*Math.PI/2;
  // Preserva o acabamento de cada modelo; detalhes finos nao sao colisores,
  // evitando bloquear corredores ou o patamar das escadas.
  const place=(kind,x,y,w,d,height,floor=0)=>{
    const pos=L(x,y),colors=FEATURE_PALETTE[kind]||['#ad9479','#7c654c'],
      z=floor===1?H.floorHeight:0;
    const b=addBox({kind,x:pos[0],y:pos[1],w,d,h:height,z,rot:angle,
      top:colors[0],side:colors[1],house:H,floor,solid:false});
    H.interactables.push(b);
    if(floor===1&&H.upper)H.upper.furniture.push(b);
    return b;
  };
  for(const f of INTERIOR_FEATURES[H.templateKey]||[])
    place(...f,0);
  for(const f of UPPER_FEATURES[H.templateKey]||[])
    place(...f,1);
  // Inclui os moveis originais; alguns sao fontes de interacao e nao so enfeites.
  for(const b of boxes)if(b.house===H&&!b.exteriorFixture&&
    b.kind!=='rug'&&b.kind!=='mirror')
      if(!H.interactables.includes(b))H.interactables.push(b);
  const lampPositions=[
    [T.w*.24,T.d*.25,0],[T.w*.72,T.d*.72,0]
  ];
  if(T.upper)lampPositions.push([T.w*.25,T.d*.25,1],[T.w*.74,T.d*.68,1]);
  for(const [x,y,floor] of lampPositions){
    const p=L(x,y);
    H.indoorLights.push({x:p[0],y:p[1],floor,
      z:floor?H.floorHeight+.15:2.2,r:floor?2.85:3.2});
  }
  const entry=L(T.def.open.S.door[0]+.5,T.d-.65);
  H.switches=[{x:entry[0],y:entry[1],floor:0,kind:'switch',house:H}];
  if(H.stair)H.switches.push({x:H.stair.top[0],y:H.stair.top[1],
    floor:1,kind:'switch',house:H});
}
function findHouseInteraction(p){
  if(p.stairTravel)return null;
  const floor=p.floor||0;
  const H=houses.find(h=>h.contains?h.contains(p.x,p.y,floor):p.x>h.x0&&p.x<h.x1&&p.y>h.y0&&p.y<h.y1)||houses.find(h=>h.architecture?.levels[floor]?.segments.some(s=>(s.door||s.window)&&Math.hypot((s.x1+s.x2)/2-p.x,(s.y1+s.y2)/2-p.y)<1.3));
  if(!H)return null;
  let selected=null,best=Infinity;
  const consider=(obj,kind,range=1.28)=>{
    const d=Math.hypot(obj.x-p.x,obj.y-p.y);
    if(d<=range&&d<best){best=d;selected={obj,kind,house:H};}
  };
  if(H.architecture)for(const s of H.architecture.levels[floor]?.segments||[])if(s.door||s.window)consider({x:(s.x1+s.x2)/2,y:(s.y1+s.y2)/2,seg:s},s.door?'door':'window',1.28);
  for(const s of H.segs){
    if(s.ext||!s.door||floor!==0)continue;
    const m={x:(s.x1+s.x2)/2,y:(s.y1+s.y2)/2};
    consider(Object.assign(m,{seg:s}),'door',1.12);
  }
  if(floor===1&&H.upper)for(const s of H.upper.walls){
    if(!s.door)continue;
    consider({x:(s.x1+s.x2)/2,y:(s.y1+s.y2)/2,seg:s},
      'door',1.12);
  }
  // prédios Miami (miami-city.js) não passam por decorateHouse: sem móveis interativos
  for(const b of H.interactables||[]){
    if((b.floor||0)!==floor||!INTERIOR_LABELS[b.kind]||b.kind==='mirror')continue;
    consider(b,b.kind,1.30);
  }
  for(const sw of H.switches||[])if(sw.floor===floor)
    consider(sw,'switch',1.12);
  return selected;
}
function interactionPrompt(p){
  const o=findHouseInteraction(p);
  if(o&&(o.kind==='door'||o.kind==='window')){const a=o.obj.seg[o.kind==='door'?'doorAnim':'windowAnim'];return 'F · '+(a?.target>.5?'Fechar ':'Abrir ')+(o.kind==='door'?'porta':'janela');}
  return o?'F  ·  '+(INTERIOR_LABELS[o.kind]||o.kind):'';
}
function useHouseInteraction(p,st,time){
  const found=findHouseInteraction(p);
  if(!found)return false;
  const {obj,kind,house:H}=found;
  if(window.CityBuildings?.managed(H)){
    const seg=obj.seg,unitId=seg?.unitId;
    if(unitId&&!window.CityBuildings.canOpenDoor(H,seg)){
      st._interactionMessage='Unidade privada · consulte a portaria';return true;
    }
    if(!seg&&kind!=='switch'&&!window.CityBuildings.canSeeFurniture(H,obj,p)){
      st._interactionMessage='Área privada · acesso negado';return true;
    }
  }
  // Portas fechadas de residências privadas não podem ser abertas por transeuntes.
  if(typeof CityRealty!=='undefined'&&CityRealty.residential(H)&&!CityRealty.isOwned(H)){
    st._interactionMessage='Imóvel privado · acesso restrito';
    return true;
  }
  let message='';
  if(kind==='door'||kind==='window'){
    const key=kind==='door'?'doorAnim':'windowAnim';
    const a=obj.seg[key]||(obj.seg[key]={open:0,target:0});a.manual=true;
    a.target=a.target>.5?0:1;
    message=(kind==='door'?'Porta':'Janela')+(a.target?' aberta':' fechada');
  }else if(kind==='switch'){
    H.lightOn=!H.lightOn;
    message=H.lightOn?'Luzes acesas':'Luzes apagadas';
  }else if(kind==='tv'){
    H.tvOn=!H.tvOn;
    message=H.tvOn?'Televisao ligada':'Televisao desligada';
  }else if(kind==='cabinet'||kind==='wardrobe'){
    obj.open=!obj.open;
    message=obj.open?'Armario aberto':'Armario fechado';
  }else if(kind==='fridge'){
    if((obj.lastUse||0)>time)return true;
    obj.lastUse=time+10;
    st.food=Math.min(1,(st.food||0)+.09);
    message='Um lanche da geladeira  +alimento';
  }else if(kind==='sink'){
    st.water=Math.min(1,(st.water||0)+.12);
    message='Agua fresca  +hidratacao';
  }else if(kind==='bed'||kind==='sofa'){
    st.hp=Math.min(1,(st.hp||0)+.06);
    message='Descansando · vida, energia e fôlego recuperados';
  }else if(kind==='stove'){
    message='Fogao pronto para preparar uma refeicao';
  }else if(kind==='shower'){
    message='Banho tomado · higiene recuperada';
  }else if(kind==='toilet'){
    message='Banheiro utilizado · alívio recuperado';
  }else if(kind==='shelf'||kind==='desk'||kind==='table'){
    message='Voce examinou a '+(INTERIOR_LABELS[kind]||kind);
  }
  if (typeof window !== 'undefined') window.CityLife?.interior(kind);
  st._interactionMessage=message;
  return true;
}
