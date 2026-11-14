// city-food.js — comida no jogo: lojas na rua (restaurantes, padarias, conveniências e mercados nos prédios de
// comércio, a conveniência do posto e o Mercado Municipal), cardápio com F, app de delivery "Rango" no celular
// (restaurantes, mercado, carrinho, endereço, pedido acompanhado), entregador de moto no minimapa e no mapa que
// chega até a porta, e a base do futuro sistema de entregadores (pedidos assumidos por um entregador).
// Regras puras em food-core.js; itens na mochila em city-life.js; fogão em city-home-kitchen.js.
'use strict';
const CityFood = (() => {
  const K = window.CityFoodCore, KEY = 'cityofgod.food.v1';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => window.CityLife ? CityLife.money(n) : 'R$ ' + n;
  const P = () => window.__game?.player || window.cityVehicleBridge?.player;
  const notify = t => window.CityUI?.notify?.(t);
  const defs = () => window.CityLife?.items || K.itemDefs();
  let S = { t: 0, orders: [], history: [], seq: 0 };
  try { const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw && Array.isArray(raw.orders)) S = { t: +raw.t || 0, orders: raw.orders.slice(0, 20), history: (raw.history || []).slice(0, 20), seq: raw.seq | 0 }; } catch (_) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };

  // ---------- lugares ----------
  const houseList = () => (typeof houses !== 'undefined' ? houses : []);
  const OWg = () => (typeof OW !== 'undefined' ? OW : null);
  // prédio de comércio → loja (fora os de profissão, públicos e os do jogador)
  const shopTypeOf = H => H && H.miaKind === 'shop' && !H.civic && !H.business && !(window.CityHome?.owned?.(H)) ? K.shopTypeForSeed(H.seed) : null;
  function streetShops() {
    const out = [];
    for (const H of houseList()) { const type = shopTypeOf(H); if (type) out.push({ type, H, x: H.doorPt?.[0] ?? (H.x0 + H.x1) / 2, y: H.doorPt?.[1] ?? (H.y0 + H.y1) / 2, name: K.SHOPS[type].name + (H.bName ? ' · ' + H.bName : '') }); }
    return out;
  }
  function gasShops() {
    return ((typeof world !== 'undefined' && world.gasStations) || []).filter(g => g.store).map(g => {
      const s = g.store, U = (u, v) => [g.ox + g.qx * u, g.oy + g.qy * v], a = U(s.u0, s.v0), b = U(s.u1, s.v1);
      return { type: 'conveniencia', x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, box: [Math.min(a[0], b[0]) - 3, Math.min(a[1], b[1]) - 3, Math.max(a[0], b[0]) + 3, Math.max(a[1], b[1]) + 3], name: 'Conveniência ' + (g.brand?.name || '24h') };
    });
  }
  function markets() { return (OWg()?.cw?.landmarks || []).filter(l => l.kind === 'market').map(l => ({ type: 'mercado', x: l.x, y: l.y, r: Math.max(12, (l.r || 30) * .7), name: l.name })); }
  // unidades que atendem o app: uma por marca, num bairro fixo (calçada da rua mais próxima)
  let brandCache = null;
  function brands() {
    if (brandCache) return brandCache;
    const geo = OWg()?.geo; if (!geo) return [];
    const areas = [...(geo.neighborhoods || []), ...(geo.anchors?.towns || [])].filter(a => Number.isFinite(a.x));
    if (!areas.length) return [];
    const net = window.CityRoadRouting && OWg().cw ? (brands.net || (brands.net = CityRoadRouting.build(OWg().cw.roads, 1))) : null;
    brandCache = [...K.RESTAURANT_TYPES, 'mercado'].map((type, i) => {
      let x, y;
      if (type === 'mercado' && markets()[0]) ({ x, y } = markets()[0]);
      else {
        // um bairro por marca (repete só se houver menos bairros que marcas, e aí em outro ponto do bairro)
        const a = areas[i % areas.length], k = Math.floor(i / areas.length), ang = i * 2.39996 + k * 1.3, r = 45 + k * 70;
        const near = net?.nearest(a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r); x = near?.x ?? a.x + Math.cos(ang) * r; y = near?.y ?? a.y + Math.sin(ang) * r;
      }
      return { type, x, y, name: K.SHOPS[type].name, area: geo.neighborhoodAt?.(x, y)?.name || areas.reduce((b, q) => Math.hypot(q.x - x, q.y - y) < Math.hypot(b.x - x, b.y - y) ? q : b, areas[0]).name || '' };
    });
    return brandCache;
  }
  // POIs do GPS/mapa (city-gps.js)
  function places() { return brands().map(b => ({ id: 'food:' + b.type, x: b.x, y: b.y, name: b.name, type: 'food' })); }

  // ---------- loja aberta com F ----------
  let open = null;   // { type, name }
  function shopNear(p) {
    if (!p || (p.floor || 0) > 0) return null;
    for (const s of gasShops()) if (p.x > s.box[0] && p.x < s.box[2] && p.y > s.box[1] && p.y < s.box[3]) return s;
    for (const s of markets()) if (Math.hypot(p.x - s.x, p.y - s.y) < s.r) return s;
    let best = null, bd = 3.2;
    for (const s of streetShops()) {
      const inside = s.H.contains ? s.H.contains(p.x, p.y, 0) : (p.x > s.H.x0 && p.x < s.H.x1 && p.y > s.H.y0 && p.y < s.H.y1);
      const d = inside ? 0 : Math.hypot(p.x - s.x, p.y - s.y); if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  function eatNow(item, n = 1) {
    const st = CityLife.state, it = defs()[item]; if (!st || !it) return;
    for (let k = 0; k < n; k++) for (const [key, a] of Object.entries(it.effects || {})) {
      if (st.needs && key in st.needs) st.needs[key] = Math.max(0, Math.min(1, st.needs[key] + a)); else if (key in st) st[key] = Math.max(0, Math.min(1, st[key] + a));
    }
    CityLife.save(); window.dispatchEvent(new Event('city-life-change')); window.CityAdventures?.signal?.('needs');
  }
  // compra no balcão: comer agora (1 unidade) ou levar (vai tudo para a mochila)
  function buyAtCounter(key, eat) {
    if (!open) return { ok: false, text: 'Loja fechada' };
    const m = K.menuOf(open.type, defs()).find(x => x.key === key); if (!m) return { ok: false, text: 'Produto indisponível' };
    if (!eat && !CityLife.canAdd(m.item, m.qty)) return { ok: false, text: 'Mochila cheia' };
    if (!CityLife.debit(m.price, open.name + ' · ' + m.name)) return { ok: false, text: 'Dinheiro insuficiente' };
    if (eat) { eatNow(m.item, 1); if (m.qty > 1) CityLife.addItem(m.item, m.qty - 1); return { ok: true, text: m.icon + ' ' + m.name + ' — bom apetite!' + (m.qty > 1 ? ' O resto foi para a mochila.' : '') }; }
    CityLife.addItem(m.item, m.qty); return { ok: true, text: m.icon + ' ' + m.name + ' na mochila' };
  }
  function dialog() {
    let d = document.getElementById('city-food-dialog');
    if (!d) {
      d = document.createElement('div'); d.id = 'city-food-dialog'; d.hidden = true; document.body.appendChild(d);
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-food-buy]');
        if (b) { const r = buyAtCounter(b.dataset.foodBuy, b.dataset.eat === '1'); notify(r.text); window.CityAudio?.ui?.(r.ok ? 'confirm' : 'back'); renderDialog(); return; }
        if (e.target.closest('[data-food-close]') || e.target === d) close();
      });
    }
    return d;
  }
  function renderDialog() {
    if (!open) return;
    const st = CityLife.state, pct = k => Math.round((st?.needs?.[k] ?? st?.[k] ?? 0) * 100), shop = K.SHOPS[open.type], menu = K.menuOf(open.type, defs());
    const row = m => {
      const edible = m.kind !== 'ingredient' && (defs()[m.item]?.effects && Object.keys(defs()[m.item].effects).length), poor = CityLife.funds < m.price, inBag = CityLife.inventory[m.item] || 0;
      return '<div class="food-row"><span class="food-ico">' + m.icon + '</span><div class="food-txt"><strong>' + esc(m.name) + '</strong><small>' + esc(m.detail) + (inBag ? ' · na mochila: ' + inBag : '') + '</small></div>' +
        '<b class="food-price">' + money(m.price) + '</b>' +
        (edible && open.kind !== 'store' ? '<button class="food-btn eat" data-food-buy="' + m.key + '" data-eat="1" ' + (poor ? 'disabled' : '') + '>Comer</button>' : '') +
        '<button class="food-btn" data-food-buy="' + m.key + '" ' + (poor ? 'disabled' : '') + '>' + (m.kind === 'ingredient' ? 'Comprar' : 'Levar') + '</button></div>';
    };
    const food = menu.filter(m => m.kind !== 'ingredient'), ing = menu.filter(m => m.kind === 'ingredient');
    dialog().innerHTML = '<div class="city-property-card food-card" role="dialog" aria-label="' + esc(open.name) + '"><button data-food-close class="city-property-close" aria-label="Fechar">✕</button>' +
      '<span class="city-property-eyebrow">' + (shop.kind === 'store' ? (open.type === 'mercado' ? 'MERCADO' : 'LOJA DE CONVENIÊNCIA') : 'CARDÁPIO') + '</span><h2>' + shop.icon + ' ' + esc(open.name) + '</h2>' +
      '<p class="food-status">Fome ' + pct('food') + '% · Sede ' + pct('water') + '% · Carteira <b>' + money(CityLife.funds) + '</b></p>' +
      '<div class="food-list">' + (food.length ? (ing.length ? '<div class="food-label">Comidas e bebidas</div>' : '') + food.map(row).join('') : '') +
      (ing.length ? '<div class="food-label">Ingredientes · para cozinhar em casa</div>' + ing.map(row).join('') : '') + '</div>' +
      '<p class="food-hint">Prefere receber em casa? Peça pelo app <b>Rango</b> no celular (P).</p>' +
      '<button data-food-close class="city-property-secondary">Voltar ao jogo</button></div>';
  }
  function show(s) { open = { type: s.type, name: s.name, kind: K.SHOPS[s.type].kind }; renderDialog(); dialog().hidden = false; document.body.classList.add('city-property-open'); window.CityAudio?.ui?.('confirm'); }
  function close() { open = null; const d = document.getElementById('city-food-dialog'); if (d) d.hidden = true; document.body.classList.remove('city-property-open'); }
  addEventListener('keydown', e => { if (e.key === 'Escape' && open) { e.preventDefault(); close(); } });
  function prompt(p) { const s = shopNear(p); return s ? 'F · ' + K.SHOPS[s.type].icon + ' ' + s.name + ' — ' + (K.SHOPS[s.type].kind === 'store' ? 'comprar' : 'ver cardápio') : ''; }
  function interact(p) { const s = shopNear(p); if (!s) return false; show(s); return s.name; }

  // ---------- delivery: app Rango ----------
  const ui = { tab: 'restaurants', shop: null, cart: {}, addr: 'here' };
  function homeAddress() { const h = window.CitySim?.data?.home; return h && Number.isFinite(h.x) ? { x: h.x, y: h.y, label: 'Casa · ' + h.name } : null; }
  function address() { const p = P(); if (ui.addr === 'home' && homeAddress()) return homeAddress(); return p ? { x: p.x, y: p.y, label: 'Minha localização' } : null; }
  function routeBetween(a, b) {
    const net = window.CityRoadRouting && OWg()?.cw ? (brands.net || (brands.net = CityRoadRouting.build(OWg().cw.roads, 1))) : null;
    const r = net?.route({ x: a.x, y: a.y }, { x: b.x, y: b.y });
    return r?.points?.length > 1 ? [[a.x, a.y], ...r.points, [b.x, b.y]] : null;
  }
  function placeOrder() {
    const b = brands().find(x => x.type === ui.shop), to = address();
    if (!b || !to) return { ok: false, text: 'Restaurante ou endereço indisponível' };
    const menu = K.menuOf(b.type, defs()), { subtotal, items } = K.cartTotal(ui.cart, menu);
    if (!items) return { ok: false, text: 'Carrinho vazio' };
    if (subtotal < K.MIN_ORDER) return { ok: false, text: 'Pedido mínimo de ' + money(K.MIN_ORDER) };
    const route = routeBetween(b, to), dist = route ? route.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - route[i][0], q[1] - route[i][1]), 0) : Math.hypot(b.x - to.x, b.y - to.y);
    const fee = K.deliveryFee(dist, subtotal), total = Math.round((subtotal + fee) * 100) / 100;
    if (!CityLife.debit(total, 'Rango · ' + b.name)) return { ok: false, text: 'Saldo insuficiente' };
    const lines = Object.entries(ui.cart).map(([key, n]) => { const m = menu.find(x => x.key === key); return m && n > 0 ? { key, item: m.item, qty: m.qty * n, name: m.name, n, icon: m.icon } : null; }).filter(Boolean);
    const o = K.createOrder({ id: 'R' + (1000 + (++S.seq)), shopType: b.type, shopName: b.name, from: { x: b.x, y: b.y }, to: { x: to.x, y: to.y }, address: to.label, lines, subtotal, fee, now: S.t, prep: K.SHOPS[b.type].prep || 30, route });
    o.courier = { name: COURIERS[S.seq % COURIERS.length], auto: true };
    S.orders.unshift(o); ui.cart = {}; ui.tab = 'orders'; save();
    return { ok: true, text: '🛵 Pedido ' + o.id + ' confirmado · chega em ~' + Math.max(1, Math.ceil(K.eta(o, S.t) / 60)) + ' min' };
  }
  const COURIERS = ['Rafa', 'Jéssica', 'Thiago', 'Duda', 'Marcão', 'Bia', 'Caio', 'Lú'];
  function cancel(id) {
    const o = S.orders.find(x => x.id === id); if (!o || o.status !== 'confirmed') return { ok: false, text: 'O restaurante já começou a preparar' };
    o.status = 'cancelled'; CityLife.credit(o.total, 'Estorno Rango · ' + o.id); save(); return { ok: true, text: 'Pedido cancelado e estornado' };
  }
  // entrega na mão: os itens vão para a mochila (o que não couber fica avisado)
  function handOver(o) {
    let lost = 0; for (const l of o.lines) if (!CityLife.addItem(l.item, l.qty)) lost += l.qty;
    window.CityAudio?.ui?.('confirm');
    return lost ? ' (' + lost + ' item(ns) não couberam na mochila)' : '';
  }
  // ---------- base do sistema de entregadores (para o delivery feito por pessoas) ----------
  // pedidos de moradores (NPC) esperando entregador; o jogador ou outro jogador assume, retira e entrega
  const delivery = {
    open: () => S.orders.filter(o => o.customer && !o.courier && ['preparing', 'on_the_way'].includes(o.status)),
    // cria o pedido de um morador para a casa H (não cobra do jogador)
    npcOrder(H, rnd = Math.random) {
      const b = brands()[(rnd() * brands().length) | 0]; if (!b || !H) return null;
      const menu = K.menuOf(b.type, defs()).filter(m => m.kind !== 'ingredient'), m = menu[(rnd() * menu.length) | 0]; if (!m) return null;
      const to = { x: H.doorPt?.[0] ?? (H.x0 + H.x1) / 2, y: H.doorPt?.[1] ?? (H.y0 + H.y1) / 2 };
      const o = K.createOrder({ id: 'N' + (1000 + (++S.seq)), shopType: b.type, shopName: b.name, from: { x: b.x, y: b.y }, to, address: H.bName || 'Residência', lines: [{ key: m.key, item: m.item, qty: m.qty, name: m.name, n: 1, icon: m.icon }], subtotal: m.price, fee: K.deliveryFee(Math.hypot(b.x - to.x, b.y - to.y), m.price), now: S.t, prep: K.SHOPS[b.type].prep });
      o.customer = { name: ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio'][(rnd() * 6) | 0] }; o.courier = null; S.orders.push(o); save(); return o;
    },
    claim(id, courier) { const o = S.orders.find(x => x.id === id); if (!o || o.courier) return false; o.courier = { ...courier, auto: false }; save(); return true; },
    pickup(id) { const o = S.orders.find(x => x.id === id); if (!o || o.courier?.auto !== false || o.status !== 'preparing' && o.status !== 'on_the_way') return false; o.status = 'on_the_way'; o.pickedUp = true; save(); return true; },
    drop(id) { const o = S.orders.find(x => x.id === id); if (!o || !o.pickedUp) return false; o.status = 'delivered'; o.doneAt = S.t; save(); return true; },
    get orders() { return S.orders; }
  };

  // ---------- tempo: pedidos andando, entregador na porta ----------
  let tickT = 0, courierNpc = null;
  function tick(dt) {
    if (!dt || window.CityFront?.blocked || (typeof wmap !== 'undefined' && wmap.open)) return;
    S.t += dt; tickT -= dt; if (tickT > 0) return; tickT = .5;
    const p = P(); let changed = false;
    for (const o of S.orders) {
      if (o.courier && o.courier.auto === false) continue;   // entregador de verdade: ele decide as etapas
      const ev = K.advance(o, S.t, o.customer ? null : p); if (!ev) continue; changed = true;
      if (o.customer) continue;
      if (ev === 'preparing') notify('👨‍🍳 ' + o.shopName + ' está preparando o pedido ' + o.id);
      if (ev === 'on_the_way') notify('🛵 ' + o.courier.name + ' saiu com o pedido ' + o.id + ' · ' + Math.max(1, Math.ceil(K.eta(o, S.t) / 60)) + ' min');
      if (ev === 'arrived') notify('🛵 ' + o.courier.name + ' chegou com o pedido ' + o.id + ' (' + o.address + ')' + (Math.hypot(p.x - o.to.x, p.y - o.to.y) > K.NEAR ? ' — vá até o endereço' : ''));
      if (ev === 'delivered') notify('🍽️ Pedido ' + o.id + ' entregue! Está na mochila' + handOver(o));
      if (ev === 'left') notify('📦 Ninguém atendeu: o pedido ' + o.id + ' foi deixado na porta de ' + o.address);
      if (ev === 'collected') notify('📦 Você pegou o pedido ' + o.id + ' na porta' + handOver(o));
    }
    // terminados vão para o histórico
    for (const o of S.orders.filter(o => !o.customer && ['delivered', 'collected', 'cancelled'].includes(o.status))) { S.history.unshift({ id: o.id, shop: o.shopName, total: o.total, status: o.status, lines: o.lines.map(l => l.icon + ' ' + l.n + '× ' + l.name).join(', ') }); S.orders.splice(S.orders.indexOf(o), 1); changed = true; }
    S.history.length = Math.min(S.history.length, 20);
    if (changed) { save(); window.CityUI?.refreshPhone?.(); }
    courierAtDoor(p);
  }
  // o entregador aparece de verdade na porta quando o pedido chega e o jogador está por perto
  function courierAtDoor(p) {
    const ch = window.cityCharacters, o = S.orders.find(o => !o.customer && o.status === 'arrived');
    if (courierNpc && (!o || courierNpc.order !== o.id)) { if (courierNpc.npc && !courierNpc.npc.dead) ch?.removeExtra?.(courierNpc.npc); courierNpc = null; }
    if (!o || courierNpc || !ch?.spawnExtra || !p || Math.hypot(p.x - o.to.x, p.y - o.to.y) > 70) return;
    courierNpc = { order: o.id, npc: null };
    const face = Math.atan2(p.y - o.to.y, p.x - o.to.x), slot = courierNpc;
    ch.spawnExtra(o.to.x + Math.cos(face) * 1.5, o.to.y + Math.sin(face) * 1.5, { face }).then(n => { if (slot !== courierNpc) { if (n) ch.removeExtra(n); return; } slot.npc = n; if (n) { n.vendor = true; ch.say?.(n, 'Pedido do Rango! ' + o.id, '🛵'); } }).catch(() => {});
  }
  // entregadores a caminho (minimapa e mapa)
  function couriers() { return S.orders.filter(o => !o.customer && ['on_the_way', 'arrived', 'left'].includes(o.status)).map(o => ({ ...K.courierPos(o, S.t), id: o.id, status: o.status, to: o.to })); }

  // ---------- telas do app ----------
  function renderApp({ card, banner, btn }) {
    const b = brands(), active = S.orders.filter(o => !o.customer);
    const tabs = '<div class="food-tabs">' + [['restaurants', '🍽️ Restaurantes'], ['market', '🛒 Mercado'], ['orders', '🛵 Pedidos' + (active.length ? ' (' + active.length + ')' : '')]].map(([k, l]) =>
      '<button class="city-action' + (ui.tab === k ? ' active' : '') + '" data-action="sim:food:tab:' + k + '">' + l + '</button>').join('') + '</div>';
    let body = '';
    if (ui.tab === 'orders') {
      body = active.length ? active.map(o => {
        const steps = ['confirmed', 'preparing', 'on_the_way', 'arrived'], k = Math.max(0, steps.indexOf(o.status)), eta = K.eta(o, S.t), d = P() ? Math.round(Math.hypot(P().x - o.to.x, P().y - o.to.y)) : 0;
        return card('Pedido ' + o.id + ' · ' + o.shopName, K.STATUS[o.status] + (eta ? ' · chega em ~' + Math.max(1, Math.ceil(eta / 60)) + ' min' : '') + ' · ' + o.address + (o.status === 'arrived' || o.status === 'left' ? ' · você está a ' + d + ' m' : '') +
          ' · ' + o.lines.map(l => l.icon + ' ' + l.n + '× ' + l.name).join(', ') + ' · total ' + money(o.total),
          '<div class="food-steps">' + ['Confirmado', 'Preparando', 'A caminho', 'Na porta'].map((s, i) => '<span class="' + (i <= k ? 'on' : '') + '">' + s + '</span>').join('') + '</div>' +
          (o.status === 'confirmed' ? btn('food:cancel:' + o.id, 'Cancelar') : '') + (['arrived', 'left'].includes(o.status) ? btn('food:route:' + o.id, 'Ir até o endereço (GPS)') : ''), '🛵');
      }).join('') : '<p class="city-help">Nenhum pedido em andamento.</p>';
      if (S.history.length) body += '<div class="city-phone-label">Últimos pedidos</div>' + S.history.slice(0, 6).map(h => '<div class="city-log"><span>' + esc(h.shop) + '<small> · ' + esc(h.lines) + '</small></span><b>' + money(h.total) + '</b></div>').join('');
    } else if (ui.shop) {
      const br = b.find(x => x.type === ui.shop), menu = K.menuOf(ui.shop, defs()), { subtotal, items } = K.cartTotal(ui.cart, menu), to = address();
      const dist = br && to ? Math.hypot(br.x - to.x, br.y - to.y) * 1.25 : 0, fee = K.deliveryFee(dist, subtotal);
      body = '<button class="city-action" data-action="sim:food:back">‹ Voltar</button>' + card(br?.name || '', (K.SHOPS[ui.shop].kind === 'store' ? 'Mercado com entrega' : 'Preparo ~' + Math.round((K.SHOPS[ui.shop].prep || 30) / 60 + .5) + ' min') + ' · ' + (br?.area || '') + ' · entrega ' + (fee ? money(fee) : 'grátis'), '', K.SHOPS[ui.shop].icon) +
        menu.map(m => '<div class="city-panel city-row food-app-row"><div><strong>' + m.icon + ' ' + esc(m.name) + '</strong><small>' + esc(m.detail) + '</small></div><b>' + money(m.price) + '</b>' +
          '<span class="food-qty">' + btn('food:minus:' + m.key, '−', !(ui.cart[m.key] > 0)) + '<b>' + (ui.cart[m.key] || 0) + '</b>' + btn('food:plus:' + m.key, '+') + '</span></div>').join('') +
        '<div class="city-panel"><div class="city-row"><span>Entregar em</span><span>' + btn('food:addr:here', (ui.addr === 'here' ? '● ' : '') + 'Onde estou') + btn('food:addr:home', (ui.addr === 'home' ? '● ' : '') + 'Minha casa', !homeAddress()) + '</span></div>' +
        '<div class="city-row"><span>Subtotal (' + items + ')</span><b>' + money(subtotal) + '</b></div><div class="city-row"><span>Entrega</span><b>' + (fee ? money(fee) : 'grátis') + '</b></div>' +
        '<div class="city-row"><span>Total</span><b>' + money(subtotal + fee) + '</b></div>' +
        btn('food:order', subtotal < K.MIN_ORDER ? 'Mínimo ' + money(K.MIN_ORDER) : 'Fazer pedido · ' + money(subtotal + fee), !items || subtotal < K.MIN_ORDER || CityLife.funds < subtotal + fee) + '</div>';
    } else {
      const list = ui.tab === 'market' ? b.filter(x => x.type === 'mercado') : b.filter(x => x.type !== 'mercado'), to = address();
      body = list.map(x => { const d = to ? Math.hypot(x.x - to.x, x.y - to.y) * 1.25 : 0, min = Math.max(5, Math.round(((K.SHOPS[x.type].prep || 30) + d / K.COURIER_SPEED + 6) / 60));
        return card(x.name, (x.area ? x.area + ' · ' : '') + min + '–' + (min + 8) + ' min · entrega ' + money(K.deliveryFee(d)) + ' · ' + K.menuOf(x.type, defs()).slice(0, 4).map(m => m.icon).join(' '), btn('food:shop:' + x.type, ui.tab === 'market' ? 'Fazer compras' : 'Ver cardápio'), K.SHOPS[x.type].icon); }).join('') ||
        '<p class="city-help">Os restaurantes aparecem no mundo aberto.</p>';
    }
    return banner('<strong>🛵 Rango</strong><small>Comida e mercado na sua porta · carteira ' + money(CityLife.funds) + '</small>') + tabs + body;
  }
  function appAction(id, arg) {
    if (id === 'tab') { ui.tab = arg; ui.shop = null; return { ok: true, text: '' }; }
    if (id === 'shop') { ui.shop = arg; ui.cart = {}; return { ok: true, text: '' }; }
    if (id === 'back') { ui.shop = null; return { ok: true, text: '' }; }
    if (id === 'plus') { ui.cart[arg] = Math.min(20, (ui.cart[arg] || 0) + 1); return { ok: true, text: '' }; }
    if (id === 'minus') { ui.cart[arg] = Math.max(0, (ui.cart[arg] || 0) - 1); return { ok: true, text: '' }; }
    if (id === 'addr') { ui.addr = arg === 'home' && homeAddress() ? 'home' : 'here'; return { ok: true, text: ui.addr === 'home' ? 'Entrega em casa' : 'Entrega onde você está' }; }
    if (id === 'order') return placeOrder();
    if (id === 'cancel') return cancel(arg);
    if (id === 'route') { const o = S.orders.find(x => x.id === arg); return o && window.CityGPS?.set?.({ id: 'order:' + o.id, x: o.to.x, y: o.to.y, name: 'Pedido ' + o.id }) ? { ok: true, text: 'Rota até o pedido traçada' } : { ok: false, text: 'Sem rota' }; }
    return { ok: false, text: 'Ação indisponível' };
  }

  return { tick, prompt, interact, close, renderApp, appAction, couriers, places, delivery, shopNear, buyAtCounter, placeOrder, eatNow,
    get open() { return !!open; }, get orders() { return S.orders; }, get history() { return S.history; }, get ui() { return ui; }, get state() { return S; },
    _brands: brands, _show: show, _setOpen: (type, name) => { open = type ? { type, name: name || K.SHOPS[type].name, kind: K.SHOPS[type].kind } : null; } };
})();
window.CityFood = CityFood;
