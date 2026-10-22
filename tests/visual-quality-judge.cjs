// Um "julgador" reproduzivel: so aprova geometria, visibilidade,
// iluminacao e variacao rural com evidencias mensuraveis no navegador.
// Nao confundir a nota automatica com avaliacao estetica humana.
'use strict';
const RULES=[
  ['Cercas com volume e sombra',7,m=>m.fencePainted>=440&&m.fenceColors>=9],
  ['Cerca apoiada no solo',7,m=>m.buriedPosts],
  ['Luz bloqueada por parede',8,m=>m.wallBlocksLight&&m.partitionBlocksLight&&
    m.facadeCovered&&m.roofCovered&&m.maskLocal&&m.coneExteriorOnly&&
    m.noBlackStripes],
  ['Luz de poste e feixe visiveis',8,m=>m.lampBeamPixels>=900&&m.lampCount>1&&m.unaffectedByPlayerRay],
  ['Interior nao exposto pelas paredes',8,m=>m.outsideRoofOpaque&&m.sightThroughWindow&&m.closedDoorBlocked&&m.featheredFocus],
  ['Interior acessivel ao entrar',7,m=>m.interiorVisibleWhenInside],
  ['Fazendas distantes de estradas',6,m=>m.ruralCount>=4&&m.ruralKinds>=2&&m.ruralFarFromRoad],
  ['Variedade de construcoes no mapa',3,m=>m.houseCount>=21&&m.urbanCount>=15],
  ['Cozinhas e banheiros detalhados',5,m=>m.fixtureKinds>=6&&m.roomsWithLights>=3],
  ['Portas e mobiliario interativos',4,m=>m.manualDoorWorks&&
    m.waterActionWorks&&m.lightSwitchWorks],
  ['Clarão noturno da arma',4,m=>m.muzzleLitPixels>160&&
    m.muzzleCenterBrighter],
  ['Oclusao corporal e circulo sem aro',4,m=>m.focusThreshold===.80&&
    m.focusOutlineRemoved&&m.partialCoverageRejected],
  ['Vida urbana e pouca sujeira',2,m=>m.urbanDebris>=25&&
    m.urbanDebris<=94&&m.urbanStyles>=6&&m.urbanCurbOnly&&
    m.urbanBins>=5&&m.urbanPixelDetail>=45],
  ['Chaminés encaixadas, alvenaria e fumaça volumétrica',6,m=>
    m.chimneys>=3&&m.smokingChimneys>=1&&m.smokeDrawn&&
    m.smokePixels>=650&&m.mortarDetail>=45&&m.chimneysEmbedded&&
    m.flatRoofCount>=1&&m.flatRoofsWithoutChimneys&&
    m.slopedChimneysOnly&&m.flatRenderHidden],
  ['Parabólicas e antenas de TV fixadas ao telhado',4,m=>
    m.dishCount>=2&&m.yagiCount>=2&&
    m.fixturesOnRoof&&m.fixturePixels>55],
  ['Modelos de carros com proporções e detalhes próprios',7,m=>
    m.carModels===9&&m.cars>=9&&m.carAngles>=288&&
    m.minCarPixels>900&&m.colorVariety>=12&&
    m.visibleSpecificBodies===9&&m.referenceProfiles===9&&
    m.uniquePaints===9&&m.uniqueCues===9&&
    m.referenceParts&&m.dimensionsVerified&&
    m.shapeComparisonPairs===36&&
    m.distinguishableSilhouettePairs>=16&&
    m.meanSilhouetteDifference>.085],
  ['Direção, colisões, luzes e entradas verificadas',2,m=>
    m.buildingBlocked&&m.entered&&m.moved&&m.wheelsRotate&&
    m.lightsWork&&m.beams&&m.exited&&m.distinctBodies],
  ['Rodas com cilindro, banda, aro e paralamas reais',5,m=>
    m.wheelTypeCount===9&&m.wheelWidthMin>=.28&&
    m.wheelFrontBackMin>3&&m.wheelRimPixelsMin>45&&
    m.wheelTreadPixelsMin>125&&m.wheelArchMaskedMin>8&&
    m.wheelGeometriesOK],
  ['Daytona roxo com proporções e aerofólio corrigidos',2,m=>
    m.aeroLowCab&&m.aeroTaperedNose&&m.aeroLongWheelbase&&
    m.aeroWingHeight],
  ['Render 2D sem erros',1,m=>m.renderOK]
];
function judge(metrics){
  const items=RULES.map(([name,weight,test])=>({name,weight,pass:!!test(metrics)}));
  return {score:items.reduce((sum,item)=>sum+(item.pass?item.weight:0),0),
    maximum:100,passed:items.every(x=>x.pass),items,metrics};
}
module.exports={judge,RULES};
