const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const world = fs.readFileSync('js/miami-city.js','utf8');
const houses = fs.readFileSync('js/openworld.js','utf8');
const realty = fs.readFileSync('js/city-realty.js','utf8');
const lots = fs.readFileSync('js/city-lots.js','utf8');
const sim = fs.readFileSync('js/city-sim.js','utf8');

test('original sector home placement remains before supplementary suburban infill', () => {
 const legacy = world.indexOf('const cap = 54;');
 const fill = world.indexOf("'suburban-infill-houses-v1'");
 assert.ok(legacy > 0 && fill > legacy);
 assert.match(world,/!\['bungalow', 'town', 'poor'\]\.includes\(zone\)/);
 assert.match(world,/rd\.cls !== 'street'/);
 assert.match(world,/Math\.min\(22, Math\.max\(0, 88 - placed\)\)/);
});

test('legacy lot IDs remain compatible; new lots have deterministic coordinate IDs', () => {
 assert.match(world,/const lotId = infill \? `lot-\$\{S\.sx\}-\$\{S\.sy\}-infill-/);
 assert.match(world,/: `lot-\$\{S\.sx\}-\$\{S\.sy\}-\$\{made\}`/);
 assert.match(world,/const originalRng = rngCur/);
 assert.match(world,/finally \{ rngCur = originalRng; \}/);
 assert.match(world,/rects\.push\(bb\); world\.yards\.push\(bb\)/);
});

test('purchased empty land is protected even before CitySim initialization', () => {
 assert.match(world,/cityofgod\.sim\.v2/);
 assert.match(world,/previouslyOwned/);
 assert.match(world,/l\.id === lotId \|\| l\.key === ownerKey/);
 assert.match(lots,/window\.CityLots = CityLots/);
 assert.match(sim,/state\.ownedLots\.push\(lot\)/);
});

test('new residential homes remain purchasable through the existing property system', () => {
 assert.match(world,/H\.miaKind = z === 'poor' \? 'poor' : 'bungalow'/);
 assert.match(realty,/const residential=H=>/);
 assert.match(realty,/const price=H=>/);
 assert.match(realty,/data-property-buy/);
});

test('infill clearance reductions affect only marked compact candidates', () => {
 assert.match(houses,/c\.infill \? \.4 : T\.yard \? 3\.2 : 1/);
 assert.match(houses,/c\.infill \? \.3 : 2/);
 assert.match(world,/infill:true/);
 assert.match(world,/if \(!TPL\.INFILL\) TPL\.INFILL/);
});
