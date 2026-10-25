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
  let st = null, funds = 250, inventory = { ...starting }, history = [], equipped = 'rifle', autosave = 0;
  const cap = n => Math.max(0, Math.min(1, Number.isFinite(Number(n)) ? Number(n) : 0));
  const money = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  function signal() { window.dispatchEvent(new Event('city-life-change')); }
  function save() {
    if (!st) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, hp: st.hp, food: st.food, water: st.water,
        needs: st.needs, funds, inventory, history, equipped
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
        if (raw.equipped === 'unarmed' || raw.equipped === 'rifle') equipped = raw.equipped;
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
  function equip(id, notify = true) {
    if (!['unarmed','rifle'].includes(id) || !st) return false;
    equipped = id;
    const p = st.player;
    p.armed = id === 'rifle';
    p.wantShot = false;
    p.aiming = false;
    p.aimHold = 0;
    if (id === 'unarmed') { p.reloadT = -1; p.magState = 'in'; }
    if (notify) { addHistory(id === 'rifle' ? 'Fuzil equipado' : 'Mãos livres'); save(); signal(); }
    return true;
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
    autosave += dt;
    if (autosave > 10) { autosave = 0; save(); }
  }
  const api = {
    items, init, tick, save, use, buy, equip, interior, money,
    get inventory() { return inventory; },
    get funds() { return funds; },
    get history() { return history; },
    get equipped() { return equipped; },
    get state() { return st; }
  };
  return api;
})();
window.CityLife = CityLife;
