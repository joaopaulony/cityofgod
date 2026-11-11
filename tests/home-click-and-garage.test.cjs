const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('contextual home actions load after home UI and before game',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('js/city-home-ui.js')<html.indexOf('js/city-click-interactions.js'));
 assert.ok(html.indexOf('js/city-click-interactions.js')<html.indexOf('js/game.js'));
 const source=fs.readFileSync('js/city-click-interactions.js','utf8');
 assert.match(source,/pointerdown.*onPointer/);
 assert.match(source,/CityHomePlus\.activity/);
 assert.match(source,/drawScreens\(ctx,t\)/);
});
test('garage interaction rejects interior positions and nonowners',()=>{
 const source=fs.readFileSync('js/garages.js','utf8');
 assert.match(source,/function garageOutside/);
 assert.match(source,/v>=G\.y1\+0\.12/);
 assert.match(source,/if\(!garageOutside\(G,p\)\)/);
 assert.match(source,/CityRealty\?\.isOwned\(G\.house\)/);
});