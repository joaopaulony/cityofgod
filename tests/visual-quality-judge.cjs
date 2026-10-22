// Um "julgador" reproduzivel: so aprova geometria, visibilidade,
// iluminacao e variacao rural com evidencias mensuraveis no navegador.
// Nao confundir a nota automatica com avaliacao estetica humana.
'use strict';
const RULES=[
  ['Cercas com volume e sombra',16,m=>m.fencePainted>=440&&m.fenceColors>=9],
  ['Cerca apoiada no solo',8,m=>m.buriedPosts],
  ['Luz bloqueada por parede',18,m=>m.wallBlocksLight&&m.partitionBlocksLight],
  ['Luz de poste e feixe visiveis',12,m=>m.lampBeamPixels>=180&&m.lampCount>1],
  ['Interior nao exposto pelas paredes',16,m=>m.outsideRoofOpaque&&m.sightThroughWindow&&m.closedDoorBlocked],
  ['Interior acessivel ao entrar',8,m=>m.interiorVisibleWhenInside],
  ['Fazendas distantes de estradas',12,m=>m.ruralCount>=4&&m.ruralKinds>=2&&m.ruralFarFromRoad],
  ['Variedade de construcoes no mapa',6,m=>m.houseCount>=21&&m.urbanCount>=15],
  ['Render 2D sem erros',4,m=>m.renderOK]
];
function judge(metrics){
  const items=RULES.map(([name,weight,test])=>({name,weight,pass:!!test(metrics)}));
  return {score:items.reduce((sum,item)=>sum+(item.pass?item.weight:0),0),
    maximum:100,passed:items.every(x=>x.pass),items,metrics};
}
module.exports={judge,RULES};
