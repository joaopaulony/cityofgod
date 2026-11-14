// food-core.js — regras puras do sistema de comida (testadas em tests/food.test.cjs):
// · catálogo: comidas prontas (pizza, donut, coxinha, brigadeiro, sushi…), ingredientes e pratos feitos em casa;
// · receitas do fogão (consomem ingredientes da despensa e da mochila, rendem porções na mochila);
// · lojas: tipos de restaurante, conveniência e mercado com os cardápios e preços;
// · delivery: carrinho, taxa por distância, pedido com etapas (confirmado → preparando → a caminho → chegou →
//   entregue / deixado na porta), posição do entregador no trajeto e retirada quando o cliente está perto.
// Sem DOM e sem estado global: o jogo (city-food.js) guarda o estado e chama estas funções.
'use strict';
(function (root) {
  // ---------- comidas prontas (vendidas em restaurantes, padarias, conveniência e pelo app) ----------
  // effects: o quanto cada necessidade sobe (food = fome saciada, water = sede, energy = energia)
  const FOODS = {
    pizza:        { name: 'Fatia de pizza',        icon: '🍕', price: 12, effects: { food: .28, water: -.03 }, detail: 'Calabresa, mussarela e orégano' },
    donut:        { name: 'Donut',                 icon: '🍩', price: 9,  effects: { food: .16, energy: .06 }, detail: 'Cobertura de chocolate' },
    coxinha:      { name: 'Coxinha',               icon: '🍗', price: 8,  effects: { food: .22, water: -.02 }, detail: 'Frango com catupiry' },
    brigadeiro:   { name: 'Brigadeiro',            icon: '🍫', price: 4,  effects: { food: .07, energy: .07 }, detail: 'Docinho de chocolate' },
    sushi:        { name: 'Combo de sushi',        icon: '🍣', price: 42, effects: { food: .46, water: .03 }, detail: '12 peças: niguiri, uramaki e sashimi' },
    pastel:       { name: 'Pastel de feira',       icon: '🥟', price: 10, effects: { food: .25, water: -.03 }, detail: 'Carne ou queijo, bem sequinho' },
    paodequeijo:  { name: 'Pão de queijo',         icon: '🧀', price: 5,  effects: { food: .12 }, detail: 'Quentinho, saído do forno' },
    acai:         { name: 'Açaí na tigela',        icon: '🍇', price: 22, effects: { food: .30, water: .08, energy: .12 }, detail: '500 ml com granola e banana' },
    esfiha:       { name: 'Esfiha',                icon: '🫓', price: 7,  effects: { food: .18 }, detail: 'Carne temperada' },
    pratofeito:   { name: 'Prato feito',           icon: '🍛', price: 26, effects: { food: .62, water: -.02 }, detail: 'Arroz, feijão, bife, salada e fritas' },
    hamburguer:   { name: 'X-tudo',                icon: '🍔', price: 29, effects: { food: .55, water: -.05 }, detail: 'Hambúrguer artesanal com tudo' },
    suco:         { name: 'Suco natural',          icon: '🧃', price: 9,  effects: { water: .30, food: .04, energy: .04 }, detail: 'Laranja, maracujá ou acerola' }
  };
  // ---------- ingredientes (mercado e conveniência; o fogão de casa transforma em pratos) ----------
  // os 7 primeiros usam as mesmas chaves da despensa antiga da casa (city-home-kitchen.js)
  const INGREDIENTS = {
    eggs:      { name: 'Ovos (6)',          icon: '🥚', price: 9 },
    milk:      { name: 'Leite (1 L)',       icon: '🥛', price: 6 },
    pasta:     { name: 'Macarrão (500 g)',  icon: '🍝', price: 7 },
    tomato:    { name: 'Tomate',            icon: '🍅', price: 3 },
    greens:    { name: 'Alface',            icon: '🥬', price: 4 },
    bread:     { name: 'Pão francês',       icon: '🍞', price: 2 },
    cheese:    { name: 'Queijo (200 g)',    icon: '🧀', price: 11 },
    rice:      { name: 'Arroz (1 kg)',      icon: '🍚', price: 8 },
    beans:     { name: 'Feijão (1 kg)',     icon: '🫘', price: 9 },
    beef:      { name: 'Carne bovina',      icon: '🥩', price: 24 },
    chicken:   { name: 'Frango',            icon: '🍗', price: 16 },
    sausage:   { name: 'Linguiça',          icon: '🌭', price: 13 },
    potato:    { name: 'Batata',            icon: '🥔', price: 3 },
    onion:     { name: 'Cebola',            icon: '🧅', price: 2 },
    flour:     { name: 'Polvilho',          icon: '🌾', price: 8 },
    chocolate: { name: 'Chocolate em pó',   icon: '🍫', price: 9 },
    condensed: { name: 'Leite condensado',  icon: '🥫', price: 7 }
  };
  // ---------- pratos feitos em casa (saem do fogão para a mochila; dá para comer em qualquer lugar) ----------
  const DISHES = {
    arrozfeijao:  { name: 'Arroz, feijão e bife',   icon: '🍛', effects: { food: .58 }, detail: 'Feito em casa' },
    macarronada:  { name: 'Macarrão à bolonhesa',   icon: '🍝', effects: { food: .50, water: -.02 }, detail: 'Feito em casa' },
    frangobatata: { name: 'Frango assado com batata', icon: '🍗', effects: { food: .54 }, detail: 'Feito em casa' },
    feijoada:     { name: 'Feijoada',               icon: '🥘', effects: { food: .70, water: -.06, energy: -.04 }, detail: 'Feita em casa · pesada' },
    omeletequeijo:{ name: 'Omelete de queijo',      icon: '🍳', effects: { food: .32 }, detail: 'Feito em casa' },
    sopa:         { name: 'Sopa de legumes',        icon: '🍲', effects: { food: .34, water: .16 }, detail: 'Feita em casa · leve' }
  };
  // ---------- receitas do fogão ----------
  // makes: { item, qty } — vai para a mochila (pratos de DISHES ou docinhos/salgados de FOODS)
  const RECIPES = [
    { id: 'arrozfeijao',  name: 'Arroz, feijão e bife',  icon: '🍛', ingredients: { rice: 1, beans: 1, beef: 1, onion: 1 }, makes: { item: 'arrozfeijao', qty: 3 }, seconds: 6 },
    { id: 'macarronada',  name: 'Macarrão à bolonhesa',  icon: '🍝', ingredients: { pasta: 1, beef: 1, tomato: 2, onion: 1 }, makes: { item: 'macarronada', qty: 3 }, seconds: 5 },
    { id: 'frangobatata', name: 'Frango assado com batata', icon: '🍗', ingredients: { chicken: 1, potato: 2, onion: 1 }, makes: { item: 'frangobatata', qty: 2 }, seconds: 6 },
    { id: 'feijoada',     name: 'Feijoada',              icon: '🥘', ingredients: { beans: 2, sausage: 1, beef: 1, rice: 1 }, makes: { item: 'feijoada', qty: 4 }, seconds: 8 },
    { id: 'omeletequeijo',name: 'Omelete de queijo',     icon: '🍳', ingredients: { eggs: 1, cheese: 1, milk: 1 }, makes: { item: 'omeletequeijo', qty: 1 }, seconds: 3 },
    { id: 'sopa',         name: 'Sopa de legumes',       icon: '🍲', ingredients: { potato: 1, onion: 1, tomato: 1, greens: 1 }, makes: { item: 'sopa', qty: 2 }, seconds: 5 },
    { id: 'brigadeiros',  name: 'Brigadeiros (12)',      icon: '🍫', ingredients: { condensed: 1, chocolate: 1, milk: 1 }, makes: { item: 'brigadeiro', qty: 12 }, seconds: 5 },
    { id: 'paesdequeijo', name: 'Pães de queijo (10)',   icon: '🧀', ingredients: { flour: 1, cheese: 1, eggs: 1, milk: 1 }, makes: { item: 'paodequeijo', qty: 10 }, seconds: 6 }
  ];

  // ---------- lojas: tipos e cardápios ----------
  // menu: { item, qty?, price?, name? } — item da mochila; qty > 1 = combo (ex.: pizza grande = 8 fatias)
  const SHOPS = {
    pizzaria:    { name: 'Pizzaria Napoli',      icon: '🍕', kind: 'restaurant', prep: 50, menu: [{ item: 'pizza', qty: 8, price: 62, name: 'Pizza grande (8 fatias)' }, { item: 'pizza', qty: 4, price: 36, name: 'Pizza média (4 fatias)' }, { item: 'pizza' }, { item: 'soda' }, { item: 'suco' }] },
    sushi:       { name: 'Sushi Kaze',           icon: '🍣', kind: 'restaurant', prep: 60, menu: [{ item: 'sushi' }, { item: 'sushi', qty: 2, price: 78, name: 'Combo casal (24 peças)' }, { item: 'suco' }, { item: 'water' }] },
    lanchonete:  { name: 'Lanchonete do Zé',     icon: '🍔', kind: 'restaurant', prep: 35, menu: [{ item: 'hamburguer' }, { item: 'coxinha' }, { item: 'pastel' }, { item: 'esfiha' }, { item: 'suco' }, { item: 'soda' }] },
    padaria:     { name: 'Padaria Pão Quente',   icon: '🥐', kind: 'restaurant', prep: 20, menu: [{ item: 'paodequeijo' }, { item: 'paodequeijo', qty: 6, price: 26, name: 'Pão de queijo (6)' }, { item: 'coxinha' }, { item: 'donut' }, { item: 'brigadeiro' }, { item: 'coffee' }, { item: 'bread', price: 2 }, { item: 'milk' }] },
    restaurante: { name: 'Restaurante Sabor Caseiro', icon: '🍛', kind: 'restaurant', prep: 45, menu: [{ item: 'pratofeito' }, { item: 'pratofeito', qty: 2, price: 48, name: 'PF para dois' }, { item: 'suco' }, { item: 'soda' }] },
    acaiteria:   { name: 'Açaí da Praia',        icon: '🍇', kind: 'restaurant', prep: 20, menu: [{ item: 'acai' }, { item: 'suco' }, { item: 'brigadeiro' }] },
    doceria:     { name: 'Doceria Brigadeirão',  icon: '🧁', kind: 'restaurant', prep: 15, menu: [{ item: 'brigadeiro' }, { item: 'brigadeiro', qty: 10, price: 35, name: 'Caixa com 10 brigadeiros' }, { item: 'donut' }, { item: 'coffee' }] },
    conveniencia:{ name: 'Conveniência 24h',     icon: '🏪', kind: 'store', markup: 1.35, menu: [{ item: 'water' }, { item: 'soda' }, { item: 'snack' }, { item: 'sandwich' }, { item: 'coffee' }, { item: 'donut' }, { item: 'coxinha' }, { item: 'suco' }, { item: 'eggs' }, { item: 'milk' }, { item: 'bread' }, { item: 'pasta' }, { item: 'cheese' }, { item: 'chocolate' }, { item: 'condensed' }] },
    mercado:     { name: 'Mercado',              icon: '🛒', kind: 'store', markup: 1, menu: Object.keys(INGREDIENTS).map(item => ({ item })).concat([{ item: 'water' }, { item: 'soda' }, { item: 'snack' }, { item: 'suco' }]) }
  };
  // restaurantes que aparecem no app (os 7 tipos); as lojas físicas desses tipos espalhadas pela cidade são filiais
  const RESTAURANT_TYPES = ['pizzaria', 'sushi', 'lanchonete', 'padaria', 'restaurante', 'acaiteria', 'doceria'];
  // prédio de comércio da cidade → tipo de loja (sorteio fixo pela semente do prédio)
  const STREET_SHOP_MIX = ['pizzaria', 'lanchonete', 'padaria', 'conveniencia', 'mercado', 'restaurante', 'sushi', 'acaiteria', 'doceria', 'lanchonete', 'padaria', 'conveniencia'];
  const shopTypeForSeed = seed => STREET_SHOP_MIX[(((seed | 0) >>> 0) % 997) % STREET_SHOP_MIX.length];

  // todos os itens que a mochila conhece (comidas, ingredientes e pratos)
  function itemDefs() {
    const out = {};
    for (const [id, f] of Object.entries(FOODS)) out[id] = { ...f, kind: 'food' };
    for (const [id, f] of Object.entries(INGREDIENTS)) out[id] = { ...f, kind: 'ingredient', effects: {}, detail: 'Ingrediente · cozinhe no fogão de casa' };
    for (const [id, f] of Object.entries(DISHES)) out[id] = { ...f, kind: 'dish', price: 0 };
    return out;
  }
  // preço de um item do cardápio (combo com preço próprio; senão o preço do item × qty × margem da loja)
  function priceOf(shop, entry, defs) {
    if (Number.isFinite(entry.price)) return entry.price;
    const base = defs[entry.item]?.price; if (!Number.isFinite(base)) return null;
    return Math.round(base * (entry.qty || 1) * (shop.markup || 1));
  }
  function menuOf(type, defs) {
    const shop = SHOPS[type]; if (!shop) return [];
    return shop.menu.map((e, i) => {
      const d = defs[e.item]; if (!d) return null;
      return { key: type + '-' + i, item: e.item, qty: e.qty || 1, price: priceOf(shop, e, defs), name: e.name || d.name, icon: d.icon, detail: d.detail || '', kind: d.kind };
    }).filter(x => x && x.price > 0);
  }

  // ---------- cozinha ----------
  // stock: função (id) → quantidade disponível (despensa + mochila); devolve o que falta
  function missing(recipe, stock) {
    const out = {};
    for (const [k, n] of Object.entries(recipe.ingredients)) { const have = stock(k) || 0; if (have < n) out[k] = n - have; }
    return out;
  }
  const canCook = (recipe, stock) => !!recipe && Object.keys(missing(recipe, stock)).length === 0;
  // tira os ingredientes primeiro da despensa (está em casa) e depois da mochila; devolve o plano de consumo
  function consumePlan(recipe, pantry, bag) {
    const plan = { pantry: {}, bag: {} };
    for (const [k, n] of Object.entries(recipe.ingredients)) {
      const fromPantry = Math.min(n, pantry[k] || 0), fromBag = n - fromPantry;
      if ((bag[k] || 0) < fromBag) return null;
      if (fromPantry) plan.pantry[k] = fromPantry; if (fromBag) plan.bag[k] = fromBag;
    }
    return plan;
  }

  // ---------- carrinho e pedido ----------
  const MIN_ORDER = 15;
  // taxa de entrega (reais inteiros, como a carteira do jogo): R$ 5 até 600 m e + R$ 1 a cada 300 m; grátis acima de R$ 120
  function deliveryFee(distance, subtotal = 0) {
    if (subtotal >= 120) return 0;
    return 5 + Math.max(0, Math.ceil((distance - 600) / 300));
  }
  function cartTotal(cart, menu) {
    let subtotal = 0, items = 0;
    for (const [key, n] of Object.entries(cart || {})) { const m = menu.find(x => x.key === key); if (!m || !(n > 0)) continue; subtotal += m.price * n; items += n; }
    return { subtotal, items };
  }
  const STATUS = { confirmed: 'Pedido confirmado', preparing: 'Preparando', on_the_way: 'Saiu para entrega', arrived: 'Entregador na porta', delivered: 'Entregue', left: 'Na sua porta', collected: 'Retirado', cancelled: 'Cancelado' };
  const COURIER_SPEED = 9;          // m/s (moto na cidade)
  const NEAR = 30;                  // m: cliente perto o bastante para receber
  const HANDOFF = 3;                // s do entregador na porta: toca a campainha, avisa e deixa a caixa/sacola
  // route: pontos [x,y] do restaurante até o endereço (ou null = linha reta)
  function createOrder({ id, shopType, shopName, from, to, address, lines, subtotal, fee, now, prep, route = null }) {
    const pts = route && route.length > 1 ? route : [[from.x, from.y], [to.x, to.y]];
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return { id, shopType, shopName, from, to, address, lines, subtotal, fee, total: Math.round((subtotal + fee) * 100) / 100, status: 'confirmed',
      created: now, readyAt: now + 6 + (prep || 40), arriveAt: now + 6 + (prep || 40) + len / COURIER_SPEED, route: pts, length: len, courier: null };
  }
  // avança o pedido no tempo. Na chegada o entregador toca a campainha e, depois de HANDOFF s, deixa o pedido na
  // porta ('left'); quem pega é o cliente (pickup). Devolve o evento novo (ou null)
  function advance(o, now) {
    if (['delivered', 'collected', 'cancelled'].includes(o.status)) return null;
    if (o.status === 'confirmed' && now >= o.created + 6) { o.status = 'preparing'; return 'preparing'; }
    if (o.status === 'preparing' && now >= o.readyAt) { o.status = 'on_the_way'; return 'on_the_way'; }
    if (o.status === 'on_the_way' && now >= o.arriveAt) { o.status = 'arrived'; o.arrivedAt = now; return 'arrived'; }
    if (o.status === 'arrived' && now >= o.arrivedAt + HANDOFF) { o.status = 'left'; o.leftAt = now; return 'left'; }
    return null;
  }
  // o cliente pega o pedido deixado na porta (precisa estar perto da caixa/sacola)
  function pickup(o, now, player, reach = 2.2) {
    if (o.status !== 'left' || !player) return false;
    const d = o.door || o.to; if (Math.hypot(player.x - d.x, player.y - d.y) > reach) return false;
    o.status = 'collected'; o.doneAt = now; return true;
  }
  // embalagem: pizza e sushi em caixa, o resto em sacola de papel
  const packageKind = o => o.lines?.some(l => l.item === 'pizza' || l.item === 'sushi') ? 'box' : 'bag';
  // onde está o entregador agora (no restaurante até sair, no trajeto, na porta depois de chegar)
  function courierPos(o, now) {
    if (o.status === 'confirmed' || o.status === 'preparing') return { x: o.from.x, y: o.from.y, moving: false };
    if (o.status !== 'on_the_way') return { x: o.to.x, y: o.to.y, moving: false };
    let d = Math.max(0, Math.min(o.length, (now - o.readyAt) * COURIER_SPEED));
    for (let i = 1; i < o.route.length; i++) {
      const a = o.route[i - 1], b = o.route[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= L || i === o.route.length - 1) { const t = L ? Math.min(1, d / L) : 1; return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, a: Math.atan2(b[1] - a[1], b[0] - a[0]), moving: true }; }
      d -= L;
    }
    return { x: o.to.x, y: o.to.y, moving: false };
  }
  const eta = (o, now) => o.status === 'on_the_way' || o.status === 'preparing' || o.status === 'confirmed' ? Math.max(0, Math.round(o.arriveAt - now)) : 0;
  const delivered = o => o.status === 'delivered' || o.status === 'collected';

  const api = { FOODS, INGREDIENTS, DISHES, RECIPES, SHOPS, RESTAURANT_TYPES, STATUS, MIN_ORDER, NEAR, COURIER_SPEED,
    itemDefs, priceOf, menuOf, shopTypeForSeed, missing, canCook, consumePlan, deliveryFee, cartTotal, createOrder, advance, pickup, packageKind, courierPos, eta, delivered, HANDOFF };
  root.CityFoodCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
