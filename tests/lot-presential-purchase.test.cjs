const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const realty=fs.readFileSync('js/city-realty.js','utf8');
const sim=fs.readFileSync('js/city-sim.js','utf8');
const app=fs.readFileSync('js/city-apps.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');
const signs=fs.readFileSync('js/landmarks-3d.mjs','utf8');

test('property dialog resolves the selected parcel by its exact ID',()=>{
 assert.match(realty,/selectedLot\.id/);
 assert.match(realty,/data-lot-buy/);
 assert.match(realty,/lotPanel\(selectedLot\)/);
 assert.match(realty,/L\.q\.map\(q=>project/);
});
test('player can consult nearby land in person with F or a sign click',()=>{
 assert.match(realty,/const nearbyLot=/);
 assert.match(realty,/function onInteract\(p\)/);
 assert.match(realty,/function clickLot\(/);
 assert.match(game,/CityRealty\?\.clickLot/);
 assert.match(game,/CityRealty\?\.drawLotSelection/);
});
test('phone shows coordinates and routes to the sale sign instead of ambiguous purchase buttons',()=>{
 assert.match(app,/GPS até esta placa/);
 assert.match(app,/type==='lot-route'/);
 assert.match(app,/window\.CityGPS\?\.set/);
 assert.doesNotMatch(app,/btn\('sim:lot:'\+l\.key,'Comprar'/);
});
test('payment validates proximity, money, previous ownership and exact lot record',()=>{
 assert.match(sim,/function findSaleLot\(ref\)/);
 assert.match(sim,/source\.id===ref\|\|lotKey\(l\)===ref|l\.id===ref\|\|lotKey\(l\)===ref/);
 assert.match(sim,/Math\.hypot\(source\.sign\[0\]-p\.x,source\.sign\[1\]-p\.y\)>4\.5/);
 assert.match(sim,/state\.ownedLots\.some\(l=>l\.id===source\.id\|\|l\.key===key\)/);
 assert.match(sim,/transact\(lot\.price/);
 assert.match(sim,/state\.ownedLots\.push\(lot\)/);
});
test('physical signs update to owned state and show usable land coordinates',()=>{
 assert.match(signs,/SEU TERRENO/);
 assert.match(signs,/ownedLand\(b\)/);
 assert.match(signs,/LOTE X/);
 assert.match(signs,/R\$ /);
 assert.match(signs,/CLIQU(E|E OU F)/);
});
