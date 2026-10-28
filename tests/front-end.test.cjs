const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const S=require('../js/front-state.js');
function store(values={}){const map=new Map(Object.entries(values));return {get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
test('front settings validate actual ranges and corrupted saves cannot enable continue',()=>{
 const settings=S.settings({quality:'ultra!',brightness:100,music:-10,master:'invalid',effects:.4,reducedMotion:true});
 assert.equal(settings.quality,'balanced');assert.equal(settings.brightness,1.3);assert.equal(settings.music,0);assert.equal(settings.master,.75);assert.equal(settings.effects,.4);
 assert.equal(S.hasProgress(store({[S.SAVE]:'broken','cityofgod.life.v1':'null'})),false);
 assert.equal(S.hasProgress(store({'cityofgod.life.v1':JSON.stringify({v:1,funds:0})})),true);
 assert.equal(S.checkpoint({version:1,mode:'local',seed:123,x:10,y:5,floor:0,clock:1050}).x,10);
 assert.equal(S.checkpoint({version:1,mode:'local',seed:123,x:Infinity,y:5,floor:0,clock:1050}),null);
 assert.equal(S.checkpoint({version:1,mode:'online',seed:123,x:10,y:5,floor:0,clock:1050}),null);
});
test('new game backs up progress before replacing it and preserves settings and other apps',()=>{
 const storage=store({[S.SETTINGS]:'settings','cityofgod.life.v1':'life','cityofgod.house-pets.v1':'pets','another.app':'keep'});
 assert.equal(S.backupAndReset(storage),2);
 assert.equal(storage.getItem(S.SETTINGS),'settings');assert.equal(storage.getItem('another.app'),'keep');assert.equal(storage.getItem('cityofgod.life.v1'),null);
 assert.deepEqual(S.read(storage,S.BACKUP).rows,{'cityofgod.life.v1':'life','cityofgod.house-pets.v1':'pets'});
 const blocked=store({'cityofgod.life.v1':'do not lose'});blocked.setItem=()=>{throw Error('quota');};
 assert.throws(()=>S.backupAndReset(blocked));assert.equal(blocked.getItem('cityofgod.life.v1'),'do not lose');
});
test('position checkpoints preserve the driven vehicle and remain compatible with old saves',()=>{
 const raw={version:1,mode:'open',seed:20261024,x:100,y:500,floor:0,clock:1050};
 assert.equal(S.checkpoint(raw).vehicle,undefined);
 const vehicle={key:'street:12:34',modelId:'sedan',angle:1.4,fuel:.42,engineOn:true,headlights:false,col:'#123456'};
 assert.deepEqual(S.checkpoint({...raw,vehicle}).vehicle,vehicle);
 assert.equal(S.checkpoint({...raw,vehicle:{...vehicle,fuel:5}}).vehicle.fuel,1);
 assert.equal(S.checkpoint({...raw,vehicle:{...vehicle,angle:NaN}}).vehicle,undefined);
});
test('runtime scripts stay inert until start and art is independent from real controls',()=>{
 const html=fs.readFileSync('index.html','utf8'),front=fs.readFileSync('js/front-end.js','utf8'),game=fs.readFileSync('js/game.js','utf8');
 assert.ok(html.indexOf('<template id="city-runtime">')<html.indexOf('src="js/game.js"'));
 assert.ok(html.indexOf('</template>')>html.indexOf('src="js/vehicle-webgl.bundle.js"'));
 assert.match(front,/Multiplayer <small>EM BREVE/);assert.match(front,/Ainda não há servidores, salas ou conexão online/);
 assert.match(game,/CityFront\?\.blocked/);assert.match(game,/CityFront\?\.attachGame/);
 const manifest=JSON.parse(fs.readFileSync('assets/menu/v1/manifest.json','utf8'));
 for(const art of manifest.assets)assert.ok(fs.statSync('assets/menu/v1/'+art.file).size>0);
});
