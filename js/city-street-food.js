// CityStreetFood — vendedores de cachorro-quente nos carrinhos da rua (caixas kind 'cart', miami-city.js). Perto do
// jogador, cada carrinho ganha um vendedor (NPC de verdade, atrás do balcão); com F abre o cardápio: come na hora
// (fome/sede sobem) ou leva bebida p/ a mochila. Poucos vendedores ao mesmo tempo p/ não pesar.
'use strict';
const CityStreetFood = (() => {
  const MENU = [
    { id: 'hotdog', name: 'Cachorro-quente', icon: '🌭', price: 12, eff: { food: .32 }, detail: 'Pão, salsicha e molho · fome +32%' },
    { id: 'hotdog-full', name: 'Completo', icon: '🌭', price: 18, eff: { food: .48, water: -.03 }, detail: 'Purê, milho, batata palha, vinagrete · fome +48%' },
    { id: 'hotdog-double', name: 'Duplo', icon: '🌭', price: 24, eff: { food: .62, water: -.05 }, detail: 'Duas salsichas e tudo que tem direito · fome +62%' },
    { id: 'soda', name: 'Refrigerante lata', icon: '🥤', price: 7, eff: { water: .22, food: .04 }, detail: 'Gelado · sede +22%', take: 'soda' },
    { id: 'water', name: 'Água mineral', icon: '💧', price: 4, eff: { water: .38 }, detail: 'Sede +38%', take: 'water' },
    { id: 'popcorn', name: 'Pipoca', icon: '🍿', price: 6, eff: { food: .14, water: -.04 }, detail: 'Saquinho · fome +14%' }
  ];
  const MAX_VENDORS = 3, NEAR = 45, FAR = 70, REACH = 2.4;
  const vendors = new Map();   // carrinho -> { npc, pending }
  let open = null, t = 0;
  const carts = () => (typeof boxes !== 'undefined' ? boxes : window.cityVehicleBridge?.boxes || []).filter(b => b.kind === 'cart');
  const P = () => window.__game?.player;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // lado do vendedor: atrás do carrinho (o −z do modelo, do lado oposto ao cardápio), virado p/ o balcão
  const spot = c => { const r = c.rot || 0, nx = Math.sin(r), ny = -Math.cos(r); return { x: c.x + nx * .95, y: c.y + ny * .95, face: Math.atan2(-ny, -nx) }; };
  function cartNear(p, r = REACH) { let best = null, bd = r; for (const c of carts()) { const d = dist(c, p); if (d < bd) { bd = d; best = c; } } return best; }

  // ---------- vendedores ----------
  function tick(dt) {
    t -= dt; if (t > 0) return; t = 1;
    const p = P(), ch = window.cityCharacters; if (!p || !ch?.spawnExtra) return;
    for (const [c, v] of vendors) if (!v.pending && (dist(c, p) > FAR || !carts().includes(c) || v.npc?.dead)) { if (v.npc && !v.npc.dead) ch.removeExtra(v.npc); vendors.delete(c); }
    if (vendors.size >= MAX_VENDORS) return;
    const c = carts().filter(c => !vendors.has(c) && dist(c, p) < NEAR).sort((a, b) => dist(a, p) - dist(b, p))[0]; if (!c) return;
    const s = spot(c), v = { npc: null, pending: true }; vendors.set(c, v);
    ch.spawnExtra(s.x, s.y, { face: s.face }).then(n => { v.pending = false; v.npc = n; if (n) { n.vendor = true; n.lookAt = s.face; } else vendors.delete(c); }).catch(() => vendors.delete(c));
  }
  const vendorOf = c => vendors.get(c)?.npc || null;

  // ---------- cardápio ----------
  function eatNow(item) {
    const st = CityLife.state; if (!st) return;
    for (const [k, a] of Object.entries(item.eff)) { if (st.needs && k in st.needs) st.needs[k] = Math.max(0, Math.min(1, st.needs[k] + a)); else if (k in st) st[k] = Math.max(0, Math.min(1, st[k] + a)); }
    CityLife.save(); window.dispatchEvent(new Event('city-life-change'));
  }
  function buy(id, take) {
    const it = MENU.find(m => m.id === id); if (!it) return;
    if (take && !CityLife.canAdd(it.take)) return say('Mochila cheia');
    if (!CityLife.debit(it.price, 'Lanche · ' + it.name)) return say('Dinheiro insuficiente');
    if (take) { CityLife.addItem(it.take); say(it.icon + ' ' + it.name + ' na mochila'); }
    else { eatNow(it); say(it.icon + ' ' + it.name + ' — delícia!'); const n = open && vendorOf(open); if (n) window.cityCharacters?.say?.(n, ['Bom apetite!', 'Volte sempre!', 'Capricha no molho!'][(Math.random() * 3) | 0], '🌭'); }
    window.CityAudio?.ui?.('confirm'); render();
  }
  const say = msg => window.CityUI?.notify?.(msg);
  function el() {
    let d = document.getElementById('city-kiosk-dialog');
    if (!d) { d = document.createElement('div'); d.id = 'city-kiosk-dialog'; d.hidden = true; document.body.appendChild(d);
      d.addEventListener('click', e => { const b = e.target.closest('[data-food]'); if (b) buy(b.dataset.food, b.dataset.take === '1'); if (e.target.closest('[data-kiosk-close]') || e.target === d) close(); }); }
    return d;
  }
  function render() {
    if (!open) return;
    const d = el(), st = CityLife.state, pct = k => Math.round((st?.needs?.[k] ?? st?.[k] ?? 0) * 100);
    d.innerHTML = '<div class="city-property-card" role="dialog" aria-label="Carrinho de lanches"><button data-kiosk-close class="city-property-close" aria-label="Fechar">✕</button>' +
      '<span class="city-property-eyebrow">CARRINHO DE CACHORRO-QUENTE</span><h2>🌭 Hot Dog do Bairro</h2>' +
      '<p>Fome ' + pct('food') + '% · Sede ' + pct('water') + '% · Carteira ' + CityLife.money(CityLife.funds) + '</p>' +
      MENU.map(m => '<div style="display:flex;gap:8px;align-items:center;margin:8px 0"><div style="flex:1"><strong>' + m.icon + ' ' + m.name + '</strong><br><small style="color:#9fb4c4">' + m.detail + '</small></div>' +
        '<button class="city-property-confirm" style="width:auto;margin:0;padding:9px 12px" data-food="' + m.id + '" ' + (CityLife.funds < m.price ? 'disabled' : '') + '>Comer ' + CityLife.money(m.price) + '</button>' +
        (m.take ? '<button class="city-property-secondary" style="width:auto;margin:0;padding:9px 10px" data-food="' + m.id + '" data-take="1" ' + (CityLife.funds < m.price ? 'disabled' : '') + '>Levar</button>' : '') + '</div>').join('') +
      '<button data-kiosk-close class="city-property-secondary">Voltar ao jogo</button></div>';
  }
  function show(c) { open = c; render(); const d = el(); d.hidden = false; document.body.classList.add('city-property-open'); }
  function close() { open = null; const d = document.getElementById('city-kiosk-dialog'); if (d) d.hidden = true; document.body.classList.remove('city-property-open'); }
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { e.preventDefault(); close(); } });

  // ---------- F e dica ----------
  function interact(p) { const c = cartNear(p); if (!c) return false; show(c); return vendorOf(c) ? 'O vendedor te atende' : 'Carrinho de lanches'; }
  function prompt(p) { const c = cartNear(p); return c ? 'F · Comprar lanche no carrinho' + (vendorOf(c) ? '' : ' (vendedor chegando)') : ''; }
  return { MENU, tick, interact, prompt, close, get open() { return !!open; }, get vendors() { return vendors.size; } };
})();
window.CityStreetFood = CityStreetFood;
