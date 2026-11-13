// Escada de carreira (js/career-ladder.js): limite de 2 profissões, computador conta como uma, requisitos de
// formação, cargos com salário e atividades, imóveis por cargo e estado serializável (pronto p/ multijogador).
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/career-ladder.js');

test('toda profissão tem 5 cargos com título e algo liberado', () => {
  for (const [id, p] of Object.entries(L.PROFESSIONS)) {
    assert.equal(p.ranks.length, 5, id);
    for (const r of p.ranks) { assert.ok(r.title, id); assert.ok(r.unlocks.length, id + ' · ' + r.title); }
    assert.ok(p.title && p.icon && p.group, id);
  }
  assert.equal(L.RANK_XP.length, 5); assert.equal(L.RANK_PAY.length, 5);
  for (let i = 1; i < 5; i++) { assert.ok(L.RANK_XP[i] > L.RANK_XP[i - 1]); assert.ok(L.RANK_PAY[i] > L.RANK_PAY[i - 1]); }
});

test('policial e socorrista existem, com requisito de curso', () => {
  const s = L.fresh();
  assert.equal(L.requirement('svc:police', {}).ok, false);
  assert.equal(L.requirement('svc:police', { police: { day: 1 } }).ok, true);
  assert.equal(L.requirement('svc:paramedic', {}).ok, false);
  assert.equal(L.requirement('svc:paramedic', { medic: { day: 1 } }).ok, true, 'médico também pode ser socorrista');
  assert.equal(L.requirement('svc:paramedic', { paramedic: { day: 1 } }).ok, true);
  assert.equal(L.activate(s, 'svc:police', { degrees: {} }).ok, false);
});

test('no máximo 2 profissões; o computador conta como uma e trocar de carreira remota não ocupa outra vaga', () => {
  const s = L.fresh();
  assert.ok(L.activate(s, 'job:taxi').ok);
  assert.ok(L.activate(s, 'remote:programmer').ok);
  const third = L.activate(s, 'job:courier');
  assert.equal(third.ok, false); assert.equal(third.full, true);
  const swap = L.activate(s, 'remote:designer');
  assert.ok(swap.ok); assert.equal(swap.replaced, 'remote:programmer');
  assert.deepEqual(s.active, ['job:taxi', 'remote:designer']);
  assert.ok(L.leave(s, 'job:taxi').ok);
  assert.ok(L.activate(s, 'job:courier').ok);
  assert.equal(s.active.length, 2);
  assert.ok(L.activate(s, 'job:courier').already, 'reativar a mesma não muda nada');
});

test('experiência sobe de cargo, aumenta o salário e libera atividades', () => {
  const s = L.fresh();
  assert.equal(L.rankOf(s, 'svc:police'), 0); assert.equal(L.payMult(s, 'svc:police'), 1);
  const r = L.addXP(s, 'svc:police', 950);
  assert.equal(r.rankUp, true); assert.equal(r.rank, 2); assert.equal(r.title, 'Sargento');
  assert.ok(r.unlocks.includes('Atender ocorrências: abordagem e prisão'));
  assert.ok(L.hasUnlock(s, 'svc:police', 'Perseguições e flagrantes (bônus)'));
  assert.equal(L.payMult(s, 'svc:police'), L.RANK_PAY[2]);
  assert.equal(L.shiftSize(s, 'svc:police', 3), 5);
  const i = L.info(s, 'svc:police'); assert.ok(i.progress >= 0 && i.progress <= 1); assert.equal(i.nextXP, L.RANK_XP[3]);
});

test('imóveis liberados pelo cargo', () => {
  const s = L.fresh();
  assert.equal(L.canBuyProperty(s, 'security').ok, false);
  L.addXP(s, 'svc:police', L.RANK_XP[2]);
  assert.equal(L.canBuyProperty(s, 'security').ok, false, 'Sargento ainda não');
  L.addXP(s, 'svc:police', L.RANK_XP[3] - L.RANK_XP[2]);
  assert.equal(L.canBuyProperty(s, 'security').ok, true, 'Tenente compra');
  assert.equal(L.canBuyProperty(s, 'medclinic').ok, true, 'consultório: diploma basta (cargo 0)');
  assert.equal(L.canBuyProperty(s, 'taxicoop').ok, false);
});

test('estado é JSON simples e normalizado (multijogador)', () => {
  const s = L.fresh(); L.activate(s, 'job:taxi', { clock: 100 }); L.addXP(s, 'job:taxi', 320);
  const back = L.normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back, s);
  const bad = L.normalize({ active: ['job:taxi', 'nada', 'job:courier', 'job:garbage'], xp: { 'job:taxi': -5, x: 9 } });
  assert.deepEqual(bad.active, ['job:taxi', 'job:courier']); assert.deepEqual(bad.xp, {});
});

test('equipe no automática: só no último cargo, uma vez por dia de jogo', () => {
  const s = L.fresh();
  L.activate(s, 'job:courier', { degrees: {} });
  assert.deepEqual(L.teamPayout(s, 3), [], 'primeiro dia só marca');
  assert.deepEqual(L.teamPayout(s, 4), [], 'sem o cargo máximo não há equipe');
  L.addXP(s, 'job:courier', L.RANK_XP[4]);
  const r = L.teamPayout(s, 5);
  assert.equal(r.length, 1); assert.equal(r[0].id, 'job:courier'); assert.ok(r[0].pay > 180);
  assert.deepEqual(L.teamPayout(s, 5), [], 'mesmo dia não paga de novo');
  assert.equal(L.normalize(JSON.parse(JSON.stringify(s))).teamDay, 5);
});
