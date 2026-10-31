// city-life.js — necessidades, inventário, dinheiro e equipamento (MVP local).
'use strict';
const CityLife = (() => {
  const SAVE_KEY = 'cityofgod.life.v1';
  const items = Object.freeze({
    water:   { name: 'Água mineral', icon: '💧', price: 8, effects: { water: .38 }, detail: 'Hidratação +38%' },
    soda:    { name: 'Refrigerante', icon: '🥤', price: 12, effects: { water: .22, food: .06 }, detail: 'Sede +22% · fome +6%' },
    sandwich:{ name: 'Sanduíche', icon: '🥪', price: 18, effects: { food: .35 }, detail: 'Saciedade +35%' },
    burger:  { name: 'Hambúrguer', icon: '🍔', price: 28, effects: { food: .53, water: -.04 }, detail: 'Fome +53%' },
    snack:   { name: 'Salgadinho', icon: '🍟', price: 10, effects: { food: .18, water: -.06 }, detail: 'Fome +18%' },
    coffee:  { name: 'Café', icon: '☕', price: 9, effects: { energy: .22, water: -.04 }, detail: 'Energia +22%' },
    firstaid:{ name: 'Kit de primeiros socorros', icon: '🩹', price: 55, effects: { hp: .34 }, detail: 'Vida +34%' },
    soap:    { name: 'Kit de higiene', icon: '🧼', price: 16, effects: { hygiene: .42 }, detail: 'Higiene +42%' }
  });
  const starting = { water: 3, soda: 1, sandwich: 2, burger: 1, snack: 2, coffee: 1, firstaid: 1, soap: 1 };
  const defaults = { energy: .86, hygiene: .88, bladder: .12, stamina: 1 };
  // Armas (js/weapons.js): cada uma é uma peça única (uid) com acessórios e munição no pente — pronta p/ troca entre
  // jogadores. A munição de reserva fica por calibre; acessórios soltos ficam em mods.
  const W = () => window.CityWeapons;
  const uid = () => 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const startingWeapons = () => [{ uid: uid(), id: 'rifle_ar_2', mods: [], mag: 30 }, { uid: uid(), id: 'pistol_1', mods: [], mag: 15 }];
  let st = null, funds = 250, inventory = { ...starting }, history = [], equipped = 'rifle', autosave = 0;
  let weapons = startingWeapons(), ammo = { '5.56': 90, '9mm': 45 }, mods = { suppressor_short: 1, flashlight: 1 }, lastBySlot = {};
  const cap = n => Math.max(0, Math.min(1, Number.isFinite(Number(n)) ? Number(n) : 0));
  const money = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  function signal() { window.dispatchEvent(new Event('city-life-change')); }
  function save() {
    if (!st) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, hp: st.hp, food: st.food, water: st.water,
        needs: st.needs, funds, inventory, history, equipped, weapons, ammo, mods, lastBySlot
      }));
    } catch (_) { /* armazenamento privado ou sem espaço: jogo continua */ }
  }
  function init(state) {
    st = state;
    st.needs = { ...defaults };
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (raw && raw.v === 1) {
        for (const k of ['hp','food','water']) if (Number.isFinite(raw[k])) st[k] = cap(raw[k]);
        for (const k of Object.keys(defaults)) if (Number.isFinite(raw.needs?.[k])) st.needs[k] = cap(raw.needs[k]);
        if (Number.isFinite(raw.funds)) funds = Math.max(0, Math.min(1000000, Math.floor(raw.funds)));
        for (const k of Object.keys(items)) if (Number.isInteger(raw.inventory?.[k]))
          inventory[k] = Math.max(0, Math.min(999, raw.inventory[k]));
        if (Array.isArray(raw.history)) history = raw.history.filter(x => typeof x?.text === 'string').slice(0, 30);
        if (Array.isArray(raw.weapons)) weapons = raw.weapons.filter(validWeapon).slice(0, 60);
        if (raw.ammo && typeof raw.ammo === 'object') for (const [c, n] of Object.entries(raw.ammo)) if (W()?.CAL[c] && Number.isInteger(n)) ammo[c] = Math.max(0, Math.min(9999, n));
        if (raw.mods && typeof raw.mods === 'object') for (const [m, n] of Object.entries(raw.mods)) if (W()?.accessories[m] && Number.isInteger(n)) mods[m] = Math.max(0, Math.min(99, n));
        if (raw.lastBySlot && typeof raw.lastBySlot === 'object') lastBySlot = { ...raw.lastBySlot };
        if (typeof raw.equipped === 'string') equipped = raw.equipped;
      }
    } catch (_) { /* arquivo corrompido: mantém kit inicial */ }
    equip(equipped, false);
    window.addEventListener('pagehide', save);
    return api;
  }
  function addHistory(text, delta = 0) {
    history.unshift({ text, delta, time: st ? Math.floor(st.clock) % 1440 : 0 });
    history.length = Math.min(history.length, 30);
  }
  function validWeapon(x) {
    return x && typeof x.uid === 'string' && x.uid.length < 40 && !!W()?.list[x.id] && Array.isArray(x.mods) &&
      x.mods.every(m => W().fits(m, x.id)) && Number.isInteger(x.mag) && x.mag >= 0 && x.mag <= W().list[x.id].mag;
  }
  const weaponByUid = u => weapons.find(x => x.uid === u);
  // devolve a munição do pente e da reserva da arma em mãos p/ o inventário
  function syncAmmo() {
    const p = st?.player, cur = weaponByUid(equipped);
    if (!p || !cur || !p.weapon) return;
    cur.mag = Math.max(0, Math.min(W().list[cur.id].mag, p.ammo | 0));
    ammo[W().list[cur.id].cal] = Math.max(0, p.reserve | 0);
  }
  // id: 'unarmed', o uid de uma arma, ou um slot da roda ('pistol', 'smg', 'rifle', 'shotgun', 'sniper'; 'rifle' também
  // é o valor dos saves antigos)
  function equip(id, notify = true) {
    if (!st) return false;
    if (id !== 'unarmed' && !weaponByUid(id)) {
      const slot = id, mine = weapons.filter(x => W()?.list[x.id]?.slot === slot);
      if (!mine.length) return false;
      id = (mine.find(x => x.uid === lastBySlot[slot]) || mine[0]).uid;
    }
    syncAmmo();
    equipped = id;
    const p = st.player, cur = weaponByUid(id);
    p.armed = !!cur;
    p.weapon = cur ? W().stats(cur.id, cur.mods) : null;
    p.weaponId = cur ? cur.id : null; p.weaponMods = cur ? [...cur.mods] : [];
    if (cur) { p.ammo = cur.mag; p.reserve = ammo[p.weapon.cal] || 0; lastBySlot[p.weapon.slot] = cur.uid; }
    p.wantShot = false;
    p.aiming = false;
    p.aimHold = 0;
    p.reloadT = -1; p.magState = 'in';
    if (typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('city-weapon-change', { detail: { id: p.weaponId, mods: p.weaponMods } }));
    if (notify) { addHistory(cur ? p.weapon.name + ' equipada' : 'Mãos livres'); save(); signal(); }
    return true;
  }
  // acessórios: montar/desmontar (o acessório solto volta p/ mods; um por encaixe)
  function attach(u, accId) {
    const x = weaponByUid(u), acc = W()?.accessories[accId];
    if (!x || !acc || !(mods[accId] > 0) || !W().fits(accId, x.id)) return { ok: false, text: 'Acessório não serve nesta arma' };
    const old = x.mods.find(m => W().accessories[m].mount === acc.mount);
    if (old) { x.mods = x.mods.filter(m => m !== old); mods[old] = (mods[old] || 0) + 1; }
    x.mods.push(accId); mods[accId]--;
    if (equipped === u) equip(u, false);
    save(); signal(); return { ok: true, text: acc.name + ' montado' };
  }
  function detach(u, accId) {
    const x = weaponByUid(u); if (!x || !x.mods.includes(accId)) return { ok: false, text: 'Nada para remover' };
    x.mods = x.mods.filter(m => m !== accId); mods[accId] = (mods[accId] || 0) + 1;
    if (equipped === u) equip(u, false);
    save(); signal(); return { ok: true, text: W().accessories[accId].name + ' removido' };
  }
  // troca (futura, entre jogadores): sai do inventário um objeto validável; entra com uid novo
  function tradeOut(u) {
    const x = weaponByUid(u); if (!x) return null;
    if (equipped === u) equip('unarmed', false);
    weapons = weapons.filter(y => y !== x); addHistory('Entregou ' + W().list[x.id].name); save(); signal();
    return { id: x.id, mods: [...x.mods], mag: x.mag };
  }
  function tradeIn(obj) {
    const x = { uid: uid(), id: obj?.id, mods: Array.isArray(obj?.mods) ? [...obj.mods] : [], mag: obj?.mag | 0 };
    if (!validWeapon(x) || weapons.length >= 60) return false;
    weapons.push(x); addHistory('Recebeu ' + W().list[x.id].name); save(); signal(); return x.uid;
  }
  const AMMO_PRICE = Object.freeze({ '9mm': 2, '.40': 3, '.45': 3, '.38': 2, '.357': 3, '5.56': 4, '12': 5, '.308': 8 });
  function buyAmmo(cal, qty) {
    const price = AMMO_PRICE[cal];
    if (!price || !Number.isInteger(qty) || qty < 1) return { ok: false, text: 'Munição indisponível' };
    const total = price * qty; if (funds < total) return { ok: false, text: 'Saldo insuficiente' };
    funds -= total; ammo[cal] = Math.min(9999, (ammo[cal] || 0) + qty);
    if (st?.player?.weapon?.cal === cal) st.player.reserve = ammo[cal];
    addHistory('Comprou ' + qty + ' × ' + W().CAL[cal], -total); save(); signal();
    return { ok: true, text: qty + ' munições ' + W().CAL[cal] + ' na mochila' };
  }
  function use(id) {
    const it = items[id];
    if (!st || !it || !inventory[id]) return { ok: false, text: 'Item indisponível no inventário' };
    inventory[id]--;
    for (const [k, amount] of Object.entries(it.effects)) {
      if (k in st.needs) st.needs[k] = cap(st.needs[k] + amount);
      else if (k in st) st[k] = cap(st[k] + amount);
    }
    addHistory('Usou ' + it.name);
    save(); signal();
    return { ok: true, text: it.icon + ' ' + it.name + ' utilizado' };
  }
  function buy(id) {
    const it = items[id];
    if (!it) return { ok: false, text: 'Produto não encontrado' };
    if (funds < it.price) return { ok: false, text: 'Saldo insuficiente' };
    if ((inventory[id] || 0) >= 999) return { ok: false, text: 'Inventário cheio' };
    funds -= it.price; inventory[id] = (inventory[id] || 0) + 1;
    addHistory('Comprou ' + it.name, -it.price);
    save(); signal();
    return { ok: true, text: it.icon + ' ' + it.name + ' adicionado à mochila' };
  }
  // Transações atômicas para os apps da cidade; reutilizam o histórico da carteira.
  function debit(amount,reason='Pagamento') {
    if(!Number.isFinite(amount)||amount<0||funds<amount)return false;
    funds-=Math.round(amount);addHistory(reason,-Math.round(amount));save();signal();return true;
  }
  function credit(amount,reason='Recebimento') {
    if(!Number.isFinite(amount)||amount<=0)return false;
    funds=Math.min(1000000,funds+Math.round(amount));
    addHistory(reason,Math.round(amount));save();signal();return true;
  }
  function canAdd(id){return !!items[id]&&(inventory[id]||0)<999;}
  function addItem(id,qty=1){
    if(!canAdd(id)||!Number.isInteger(qty)||qty<1||inventory[id]+qty>999)return false;
    inventory[id]+=qty;save();signal();return true;
  }
  function interior(kind) {
    if (!st) return;
    if (kind === 'toilet') st.needs.bladder = Math.max(0, st.needs.bladder - .85);
    if (kind === 'shower') st.needs.hygiene = cap(st.needs.hygiene + .65);
    if (kind === 'bed' || kind === 'sofa') { st.needs.energy = cap(st.needs.energy + .18); st.needs.stamina = cap(st.needs.stamina + .30); }
    if (['toilet','shower','bed','sofa','fridge','sink'].includes(kind)) { save(); signal(); }
  }
  function tick(dt, player) {
    if (!st || dt <= 0) return;
    const n = st.needs, running = !!player.running && !window.cityVehicles?.driver;
    st.food = cap(st.food - dt * (running ? .00045 : .00020));
    st.water = cap(st.water - dt * (running ? .00068 : .00034));
    n.energy = cap(n.energy - dt * (running ? .00038 : .00016));
    n.hygiene = cap(n.hygiene - dt * (running ? .00025 : .00010));
    n.bladder = cap(n.bladder + dt * (st.water > .5 ? .00031 : .00021));
    n.stamina = cap(n.stamina + dt * (running ? -.067 : (st.water < .1 || st.food < .1 ? .035 : .11)));
    if (st.food < .06 || st.water < .06 || n.energy < .04 || n.bladder > .96) st.hp = cap(st.hp - dt * .00034);
    else if (st.food > .55 && st.water > .55 && n.energy > .5) st.hp = cap(st.hp + dt * .000042);
    syncAmmo();
    autosave += dt;
    if (autosave > 10) { autosave = 0; save(); }
  }
  const api = {
    items, init, tick, save, use, buy, equip, interior, money, debit, credit, canAdd, addItem, attach, detach, tradeOut, tradeIn, buyAmmo, AMMO_PRICE,
    get weapons() { return weapons; },
    get ammo() { return ammo; },
    get mods() { return mods; },
    get inventory() { return inventory; },
    get funds() { return funds; },
    get history() { return history; },
    get equipped() { return equipped; },
    get state() { return st; }
  };
  return api;
})();
window.CityLife = CityLife;
