// Smoke tests for the actual client-side survival model and UI scripts.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function boot(saved) {
  const kv = new Map(saved ? [['cityofgod.life.v1', saved]] : []);
  const localStorage = { getItem: key => kv.get(key) ?? null, setItem: (key, value) => kv.set(key,value) };
  const window = { addEventListener() {}, dispatchEvent() {}, cityVehicles: { driver: false } };
  const context = vm.createContext({ window, localStorage, Event: class { constructor(name){ this.type=name; } } });
  vm.runInContext(fs.readFileSync('js/weapons.js','utf8'), context);
  vm.runInContext(fs.readFileSync('js/city-life.js','utf8'), context);
  const life = window.CityLife;
  const st = { player: { armed: true, ammo: 30, reserve: 90, magState:'in', reloadT:-1 }, hp:.9, food:.7, water:.6, clock:720 };
  life.init(st);
  return { life, st, kv };
}
test('initial survival state, wallet and supplies are finite', () => {
  const { life,st } = boot();
  assert.equal(life.funds, 250);
  assert.equal(life.inventory.water, 3);
  assert.equal(st.needs.stamina, 1);
  assert.equal(st.player.armed, true);
});
test('needs deplete when active and recover from consumables', () => {
  const { life,st }=boot();
  st.player.running=true;
  life.tick(45,st.player);
  assert.ok(st.food<.7 && st.water<.6);
  assert.ok(st.needs.stamina<1);
  const before=st.water;
  const r=life.use('water');
  assert.equal(r.ok,true);
  assert.ok(st.water>before);
  assert.equal(life.inventory.water,2);
});
test('purchase deducts cash and rejects insufficient balance without losing items', () => {
  const { life }=boot();
  assert.equal(life.buy('firstaid').ok,true);
  assert.equal(life.funds,195);
  assert.equal(life.inventory.firstaid,2);
  for(let i=0;i<12;i++)life.buy('firstaid');
  const prev=life.funds, qty=life.inventory.firstaid;
  assert.equal(life.buy('firstaid').ok,false);
  assert.equal(life.funds,prev);
  assert.equal(life.inventory.firstaid,qty);
});
test('toilet and shower change needs; weapon selection changes actor armed state', () => {
  const { life,st }=boot();
  st.needs.bladder=.99;st.needs.hygiene=.12;
  life.interior('toilet');life.interior('shower');
  assert.ok(st.needs.bladder<.15 && st.needs.hygiene>.7);
  assert.equal(life.equip('unarmed'),true);
  assert.equal(st.player.armed,false);
  assert.equal(life.equip('rifle'),true);
  assert.equal(st.player.armed,true);
  assert.equal(life.equip('shotgun'),false);
});
test('save/reload restores needs, balance, inventory and equipped weapon', () => {
  const {life,st,kv}=boot();
  life.use('sandwich');life.buy('soda');life.equip('unarmed');life.save();
  const saved=kv.get('cityofgod.life.v1');
  assert.ok(saved && saved.includes('"equipped":"unarmed"'));
  const loaded=boot(saved);
  assert.equal(loaded.life.inventory.sandwich,1);
  assert.equal(loaded.life.inventory.soda,2);
  assert.equal(loaded.life.funds,238);
  assert.equal(loaded.st.player.armed,false);
});
test('weapons: gangs only carry pistols/revolvers/SMGs, police AR or pistol, no AK in the game', () => {
  const { window } = { window: {} }; const context = vm.createContext({ window });
  vm.runInContext(fs.readFileSync('js/weapons.js','utf8'), context);
  const W = window.CityWeapons, ids = Object.keys(W.list);
  assert.ok(ids.length >= 30);
  assert.ok(!ids.some(id => /ak|assaultrifle_/i.test(id)), 'sem AK');
  for (const id of ids) {
    assert.equal(W.allowed('gang', id), ['pistol','revolver','smg'].includes(W.list[id].cat), id);
    if (W.allowed('police', id)) assert.ok(W.list[id].cat === 'pistol' || /^rifle_ar_/.test(id), id);
    assert.equal(W.allowed('civil', id), false);
    assert.ok(fs.existsSync(W.list[id].icon) && fs.existsSync(W.list[id].model), 'assets de ' + id);
  }
  for (let k = 0; k < 50; k++) { assert.ok(W.allowed('gang', W.npcWeapon('gang'))); assert.match(W.npcWeapon('police', { long: true }), /^rifle_ar_/); }
});
test('weapon inventory: equip by slot, accessories and trade round-trip keep a valid unique item', () => {
  const { life, st } = boot();
  assert.equal(life.equip('pistol'), true);
  assert.equal(st.player.weapon.cat, 'pistol');
  assert.equal(st.player.ammo, 15);
  const pistol = life.weapons.find(w => w.id === 'pistol_1');
  assert.equal(life.attach(pistol.uid, 'suppressor_short').ok, true);
  assert.equal(JSON.stringify(st.player.weaponMods), '["suppressor_short"]');
  assert.equal(life.attach(pistol.uid, 'scope_long').ok, false);   // não serve em pistola
  const out = life.tradeOut(pistol.uid);
  assert.equal(JSON.stringify(out), JSON.stringify({ id: 'pistol_1', mods: ['suppressor_short'], mag: 15 }));
  assert.equal(st.player.armed, false);
  assert.equal(life.tradeIn({ id: 'assaultrifle_1', mods: [], mag: 0 }), false);   // AK não existe
  const uid = life.tradeIn(out);
  assert.ok(uid && life.weapons.some(w => w.uid === uid && w.mods[0] === 'suppressor_short'));
});
test('client modules parse as JavaScript without DOM installation', () => {
  for(const filename of ['js/city-ui.js','js/city-life.js','js/hud.js','js/game.js','js/core.js','js/weapons.js']) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(filename,'utf8'),{filename}));
  }
});
