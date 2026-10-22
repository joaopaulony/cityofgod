'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('no old car modules or vehicle references',()=>{
 for(const file of ['index.html','js/game.js','js/houses.js','js/hud.js']) assert.doesNotMatch(read(file),/vehicleSystem|vehicleHybrid|vehicleCreate|carDraw|vehicleNear|vehicleInteraction|carLightSpots/);
 for(const file of ['js/vehicle-art.js','js/vehicle-drive.js','js/vehicle-hybrid.js','assets/vehicles','assets/generated/car'])assert.equal(fs.existsSync(path.join(root,file)),false,file);
});
