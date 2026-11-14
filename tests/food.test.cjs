// Sistema de comida: catálogo, mochila, compra no balcão, mercado, fogão de casa e delivery (app Rango).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function boot({ funds } = {}) {
  const kv = new Map();
  const notes = [], sounds = [];
  const ctx = {
    localStorage: { getItem: k => kv.get(k) ?? null, setItem: (k, v) => kv.set(k, v) },
    Event: class { constructor(t) { this.type = t; } }, console,
    addEventListener() {}, dispatchEvent() {}, performance: { now: () => 0 },
  };
  ctx.window = ctx;
  ctx.cityVehicles = { driver: false };
  ctx.CityUI = { notify: t => notes.push(t), refreshPhone() {} };
  ctx.CityAudio = { fx: id => { sounds.push(id); return {}; } };
  ctx.CityHome = { key: () => 'casa-1', owned: () => true };
  // mapa mínimo: bairros p/ os restaurantes do app e o Mercado Municipal
  ctx.OW = { geo: { neighborhoods: [{ x: 100, y: 100, name: 'Centro' }, { x: 400, y: 100, name: 'Praia' }, { x: 100, y: 400, name: 'Morro' }], anchors: { towns: [] } },
    cw: { roads: [], landmarks: [{ kind: 'market', name: 'Mercado Municipal', x: 600, y: 600, r: 40 }] } };
  vm.createContext(ctx);
  for (const f of ['js/food-core.js', 'js/weapons.js', 'js/city-life.js', 'js/city-home-kitchen.js', 'js/city-food.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  const st = { player: { x: 0, y: 0, floor: 0 }, hp: 1, food: .3, water: .5, clock: 720 };
  ctx.CityLife.init(st);
  ctx.__game = { player: st.player };
  if (funds !== undefined) { const cur = ctx.CityLife.funds; if (funds < cur) ctx.CityLife.debit(cur - funds, 'ajuste'); else ctx.CityLife.credit(funds - cur, 'ajuste'); }
  return { ctx, st, K: ctx.CityFoodCore, life: ctx.CityLife, kitchen: ctx.CityHomeKitchen, food: ctx.CityFood, notes, sounds };
}
const run = (food, seconds) => { for (let t = 0; t < seconds; t += .5) food.tick(.5); };

test('catálogo: pelo menos 10 comidas (pizza, donut, coxinha, brigadeiro, sushi…) e tudo coerente', () => {
  const { K, life } = boot();
  const foods = Object.keys(K.FOODS);
  assert.ok(foods.length >= 10, foods.length + ' comidas');
  for (const id of ['pizza', 'donut', 'coxinha', 'brigadeiro', 'sushi']) assert.ok(K.FOODS[id], id);
  for (const [id, f] of Object.entries(K.FOODS)) { assert.ok(f.price > 0, id + ' tem preço'); assert.ok((f.effects.food || 0) + (f.effects.water || 0) > 0, id + ' mata fome ou sede'); }
  assert.ok(K.RECIPES.length >= 6, 'pratos para fazer em casa');
  for (const r of K.RECIPES) {
    for (const k of Object.keys(r.ingredients)) assert.ok(K.INGREDIENTS[k], r.id + ' usa ingrediente que existe: ' + k);
    assert.ok(life.items[r.makes.item], r.id + ' rende item que a mochila conhece');
  }
  for (const type of Object.keys(K.SHOPS)) {
    const menu = K.menuOf(type, life.items);
    assert.equal(menu.length, K.SHOPS[type].menu.length, type + ': todo item do cardápio existe');
    assert.ok(menu.every(m => m.price > 0), type + ': preços');
  }
  // todo ingrediente é vendido no mercado
  const market = K.menuOf('mercado', life.items).map(m => m.item);
  for (const k of Object.keys(K.INGREDIENTS)) assert.ok(market.includes(k), 'mercado vende ' + k);
});

test('mochila: comer pizza mata a fome; ingrediente cru não dá para comer', () => {
  const { life, st } = boot();
  assert.ok(life.addItem('pizza', 2));
  const before = st.food, r = life.use('pizza');
  assert.ok(r.ok); assert.ok(st.food > before, 'fome subiu'); assert.equal(life.inventory.pizza, 1);
  assert.match(life.history[0].text, /Comeu Fatia de pizza/);
  life.addItem('rice', 1);
  const raw = life.use('rice');
  assert.equal(raw.ok, false); assert.match(raw.text, /ingrediente/); assert.equal(life.inventory.rice, 1, 'não gastou');
});

test('balcão: comer na hora, levar combo (pizza grande = 8 fatias) e recusar sem dinheiro', () => {
  const { food, life, st, K } = boot({ funds: 100 });
  food._setOpen('pizzaria');
  const menu = K.menuOf('pizzaria', life.items), big = menu.find(m => m.qty === 8), slice = menu.find(m => m.item === 'pizza' && m.qty === 1);
  const f0 = st.food, eat = food.buyAtCounter(slice.key, true);
  assert.ok(eat.ok); assert.ok(st.food > f0); assert.equal(life.funds, 100 - slice.price); assert.equal(life.inventory.pizza || 0, 0, 'comeu, não guardou');
  const take = food.buyAtCounter(big.key, false);
  assert.ok(take.ok); assert.equal(life.inventory.pizza, 8);
  const poor = food.buyAtCounter(big.key, false);
  assert.equal(poor.ok, false, 'sem dinheiro'); assert.equal(life.inventory.pizza, 8);
});

test('mercado → fogão: compra os ingredientes, faz feijoada (4 porções na mochila) e come', () => {
  const { food, life, kitchen, st, K } = boot({ funds: 500 });
  food._setOpen('mercado');
  const menu = K.menuOf('mercado', life.items), buy = (item, n = 1) => { for (let i = 0; i < n; i++) assert.ok(food.buyAtCounter(menu.find(m => m.item === item).key, false).ok, 'comprou ' + item); };
  assert.equal(kitchen.canPrepare({}, 'feijoada'), false, 'sem ingredientes ainda');
  buy('beans', 2); buy('sausage'); buy('beef'); buy('rice');
  assert.ok(kitchen.canPrepare({}, 'feijoada'));
  const r = kitchen.cook({}, 'feijoada');
  assert.ok(r.ok, r.text); assert.equal(life.inventory.feijoada, 4);
  for (const k of ['beans', 'sausage', 'beef', 'rice']) assert.equal(life.inventory[k], 0, k + ' gasto');
  const again = kitchen.cook({}, 'feijoada');
  assert.equal(again.ok, false); assert.equal(life.inventory.feijoada, 4, 'não cozinhou sem ingredientes');
  const f0 = st.food; assert.ok(life.use('feijoada').ok); assert.ok(st.food > f0);
});

test('fogão usa primeiro a despensa da casa e completa com a mochila', () => {
  const { life, kitchen } = boot({ funds: 500 });
  const pantry = kitchen.pantry({});   // despensa inicial: 2 tomates, 1 macarrão…
  life.addItem('beef', 1); life.addItem('onion', 1);
  const tomatoes = pantry.stock.tomato, pasta = pantry.stock.pasta;
  const r = kitchen.cook({}, 'macarronada');
  assert.ok(r.ok, r.text);
  assert.equal(pantry.stock.tomato, tomatoes - 2); assert.equal(pantry.stock.pasta, pasta - 1);
  assert.equal(life.inventory.beef, 0); assert.equal(life.inventory.onion, 0);
  assert.equal(life.inventory.macarronada, 3);
  // receitas antigas continuam iguais (porção na geladeira)
  assert.ok(kitchen.recipes.find(x => x.id === 'omelette' && !x.toBag));
});

test('delivery (núcleo): etapas, taxa por distância, entregador andando até a porta e pedido deixado na porta', () => {
  const { K } = boot();
  assert.equal(K.deliveryFee(300, 50), 5); assert.ok(K.deliveryFee(1500, 50) > 5); assert.equal(K.deliveryFee(1500, 130), 0, 'frete grátis acima de R$ 120');
  const o = K.createOrder({ id: 'T1', from: { x: 0, y: 0 }, to: { x: 900, y: 0 }, lines: [{ item: 'pizza', qty: 8 }], subtotal: 40, fee: 6, now: 0, prep: 30 });
  assert.equal(o.status, 'confirmed'); assert.equal(o.total, 46);
  let last = -1, t = 0;
  const seen = [];
  for (; t < 400; t += 1) { const ev = K.advance(o, t); if (ev) seen.push(ev); const c = K.courierPos(o, t); if (o.status === 'on_the_way') { assert.ok(c.x >= last - 1e-6, 'só avança'); last = c.x; } }
  assert.deepEqual(seen, ['preparing', 'on_the_way', 'arrived', 'left'], 'chega, toca a campainha e deixa na porta');
  assert.ok(o.leftAt - o.arrivedAt >= K.HANDOFF, 'fica uns segundos na porta antes de deixar');
  assert.equal(K.packageKind(o), 'box', 'pizza vai em caixa');
  assert.equal(K.packageKind({ lines: [{ item: 'coxinha' }] }), 'bag', 'salgado vai em sacola');
  assert.equal(K.pickup(o, t, { x: 950, y: 0 }), false, 'longe da caixa não pega');
  assert.ok(K.pickup(o, t, { x: 900.5, y: 1 }), 'perto pega'); assert.equal(o.status, 'collected');
});

test('app Rango: carrinho, pedido mínimo, pagar, campainha, caixa na porta e pegar com F', () => {
  const { food, life, K, st, notes, sounds, ctx } = boot({ funds: 300 });
  // a casa onde o jogador está: porta para o sul em (120, 150)
  ctx.houses = [{ x0: 110, y0: 130, x1: 130, y1: 150, doorPt: [120, 150], frontSide: 'S' }];
  st.player.x = 120; st.player.y = 140;
  food.appAction('shop', 'doceria');
  const sweets = K.menuOf('doceria', life.items), one = sweets.find(m => m.item === 'brigadeiro' && m.qty === 1);
  food.appAction('plus', one.key);
  assert.equal(food.appAction('order').ok, false, 'abaixo do pedido mínimo');
  food.appAction('shop', 'pizzaria');
  const big = K.menuOf('pizzaria', life.items).find(m => m.qty === 8);
  food.appAction('plus', big.key);
  const funds0 = life.funds, r = food.appAction('order');
  assert.ok(r.ok, r.text);
  const o = food.orders[0];
  assert.equal(life.funds, funds0 - o.total, 'pagou subtotal + entrega');
  assert.equal(food.ui.tab, 'orders');
  run(food, 30);
  assert.equal(o.status, 'preparing');
  assert.equal(food.couriers().length, 0, 'entregador ainda no restaurante');
  run(food, 300);
  assert.equal(o.status, 'left', 'deixou na porta');
  assert.ok(sounds.includes('doorbell'), 'tocou a campainha');
  assert.ok(sounds.includes('box_drop'), 'som da caixa no chão');
  assert.ok(notes.some(n => /Ding-dong/.test(n)), 'avisou que chegou');
  assert.ok(notes.some(n => /está na porta/.test(n)), 'avisou que está na porta');
  const pk = food.packages();
  assert.equal(pk.length, 1); assert.equal(pk[0].kind, 'box');
  assert.ok(Math.abs(pk[0].x - 120) < .01 && Math.abs(pk[0].y - 150.9) < .01, 'caixa do lado de fora da porta');
  assert.equal(life.inventory.pizza || 0, 0, 'ainda não pegou');
  assert.equal(food.interact(st.player), false, 'de dentro da casa não alcança a caixa');
  st.player.y = 151.5;
  assert.match(food.prompt(st.player), /Pegar pedido/);
  assert.match(String(food.interact(st.player)), /pegou o pedido/);
  assert.equal(life.inventory.pizza, 8, 'pizza na mochila');
  assert.equal(food.packages().length, 0, 'caixa sumiu da porta');
  assert.equal(food.orders.length, 0); assert.equal(food.history[0].status, 'collected');
});

test('app Rango: entrega em casa com o jogador longe — a sacola espera na porta; cancelar estorna', () => {
  const { food, life, K, st, ctx } = boot({ funds: 300 });
  st.player.x = 400; st.player.y = 110;
  food.appAction('shop', 'lanchonete');
  const cox = K.menuOf('lanchonete', life.items).find(m => m.item === 'coxinha');
  food.appAction('plus', cox.key); food.appAction('plus', cox.key);
  assert.ok(food.appAction('order').ok);
  const o = food.orders[0];
  st.player.x = 2000;   // saiu andando
  run(food, 600);
  assert.equal(o.status, 'left'); assert.equal(food.packages()[0].kind, 'bag', 'coxinha vai em sacola');
  run(food, 600);
  assert.equal(o.status, 'left', 'continua esperando na porta'); assert.equal(life.inventory.coxinha || 0, 0);
  st.player.x = 400; st.player.y = 110.5;
  assert.ok(food.pickUp(st.player)); assert.equal(life.inventory.coxinha, 2, 'pegou na porta');
  // cancelar logo depois de pedir devolve o dinheiro
  food.appAction('shop', 'padaria'); food.appAction('plus', K.menuOf('padaria', life.items)[1].key);
  const before = life.funds; assert.ok(food.appAction('order').ok);
  const id = food.orders[0].id; assert.ok(food.appAction('cancel', id).ok);
  assert.equal(life.funds, before, 'estornado');
});

test('base do delivery por pessoas: pedido de morador, entregador assume, retira e entrega', () => {
  const { food } = boot();
  const H = { x0: 300, y0: 300, x1: 310, y1: 310, doorPt: [305, 311], bName: 'Casa da Ana' };
  const o = food.delivery.npcOrder(H, () => .1);
  assert.ok(o && o.customer); assert.equal(o.courier, null);
  run(food, 10);
  assert.ok(food.delivery.open().some(x => x.id === o.id), 'na fila de entregas');
  assert.ok(food.delivery.claim(o.id, { id: 'player', name: 'Você' }));
  assert.equal(food.delivery.claim(o.id, { id: 'outro' }), false, 'só um entregador por pedido');
  run(food, 300);
  assert.notEqual(o.status, 'delivered', 'com entregador de verdade não chega sozinho');
  assert.ok(food.delivery.pickup(o.id)); assert.ok(food.delivery.drop(o.id));
  assert.equal(o.status, 'delivered');
});
