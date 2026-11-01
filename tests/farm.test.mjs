// Regras da fazenda (js/farm.mjs): culturas, animais, receitas e o preço justo da cooperativa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CROPS, ANIMALS, BUILDINGS, ITEMS, RECIPES, fairPrice, marketFactor} from '../js/farm.mjs';

test('toda cultura, produto animal e receita usa itens que existem e vendem com lucro', () => {
  for (const [id, c] of Object.entries(CROPS)) {
    assert.ok(ITEMS[id], 'item da cultura ' + id);
    assert.ok(c.days > 0 && c.yield > 0, id);
    assert.ok(ITEMS[id].price * c.yield > c.seed, 'colheita paga a semente: ' + id);
  }
  for (const [id, a] of Object.entries(ANIMALS)) { assert.ok(BUILDINGS[a.home], 'casa do ' + id); assert.ok(ITEMS[a.product], 'produto do ' + id); }
  for (const r of RECIPES) {
    const inV = Object.entries(r.in).reduce((s, [it, n]) => s + ITEMS[it].price * n, 0), outV = Object.entries(r.out).reduce((s, [it, n]) => s + ITEMS[it].price * n, 0);
    assert.ok(outV > inV, 'beneficiar vale a pena: ' + r.id);
  }
});

test('preço justo: qualidade ★★ +25%, ★★★ +50%, mercado do dia entre -10% e +10% e estável no mesmo dia', () => {
  for (let d = 0; d < 30; d++) for (const it of Object.keys(ITEMS)) { const m = marketFactor(it, d); assert.ok(m >= 0.9 && m <= 1.1); assert.equal(marketFactor(it, d), m); }
  const base = fairPrice('queijo', 0, 5);
  assert.equal(fairPrice('queijo', 1, 5), Math.round(ITEMS.queijo.price * 1.25 * marketFactor('queijo', 5)));
  assert.ok(fairPrice('queijo', 2, 5) > fairPrice('queijo', 1, 5) && fairPrice('queijo', 1, 5) > base);
});
