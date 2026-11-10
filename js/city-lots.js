// CityLots — construir a casa no terreno comprado (placa VENDE-SE): o jogador escolhe o modelo e se ela vem mobiliada.
// A obra fica salva por id do lote; quando o setor é gerado (miami-city.js → miaLotHouse) a casa nasce no lugar da
// cerca e da placa, já registrada como imóvel do jogador no CityRealty.
'use strict';
const CityLots = (() => {
  const KEY = 'cityofgod.lot-builds.v1', FURNISH = .2;
  const MODELS = {
    B: { name: 'Casa compacta', desc: 'Térrea, um ambiente amplo · ~108 m²', cost: 42000, icon: '🏠' },
    A: { name: 'Casa térrea', desc: 'Sala, cozinha e quarto · ~135 m²', cost: 68000, icon: '🏡' },
    D: { name: 'Sobrado', desc: 'Dois andares, quartos em cima · ~169 m²', cost: 110000, icon: '🏘️' },
    C: { name: 'Sobrado familiar', desc: 'Dois andares, quatro cômodos · ~203 m²', cost: 150000, icon: '🏰' }
  };
  // modelos do gerador novo (architecture-organic.js): plantas orgânicas em medidas reais; só aparecem liberados se
  // couberem no terreno (frente e fundo do lote). Os 4 modelos antigos continuam iguais.
  for (const [k, L] of Object.entries(window.CityOrganic?.LAYOUTS || {})) {
    const w = Math.round(L.w), d = Math.round(L.d);
    MODELS['O_' + k] = { name: L.name, desc: L.desc + ' · ' + w + ' × ' + d + ' m · ~' + Math.round(w * d * (L.floors || 1)) + ' m²', cost: L.cost, icon: L.icon, w, d, organic: true };
  }
  // frente × fundo do terreno (placa VENDE-SE); sem o registro do setor carregado, não dá p/ medir
  const lotSize = rec => rec?.q ? { w: Math.hypot(rec.q[1][0] - rec.q[0][0], rec.q[1][1] - rec.q[0][1]), d: Math.hypot(rec.q[3][0] - rec.q[0][0], rec.q[3][1] - rec.q[0][1]) } : null;
  // modelos clássicos: medida real no mapa = modelo × 1,3 (mesma escala do encaixe das casas antigas)
  for (const [k, M] of Object.entries(MODELS)) if (!M.organic && typeof TPL !== 'undefined' && TPL[k]) { M.w = Math.round(TPL[k].w * 1.3); M.d = Math.round(TPL[k].d * 1.3); }
  const fits = (M, size) => !size || !M.w || (M.w <= size.w + .5 && M.d + 1.5 <= size.d + .5);
  let builds = {}, furnish = true;
  try { const raw = JSON.parse(localStorage.getItem(KEY) || '{}'); if (raw && typeof raw === 'object' && !Array.isArray(raw)) builds = raw; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(builds)); } catch {} };
  const ok = text => ({ ok: true, text }), fail = text => ({ ok: false, text });
  const signKey = r => Math.round(r.sign[0]) + '-' + Math.round(r.sign[1]);
  const record = lot => (typeof world !== 'undefined' && world.lotsForSale || []).find(r => r.id === lot.id || signKey(r) === lot.key);
  const cost = tpl => Math.round(MODELS[tpl].cost * (furnish ? 1 + FURNISH : 1));
  const buildOf = id => builds[id] || null;
  const builtFor = lot => { const r = lot.id ? null : record(lot), id = lot.id || r?.id; return id ? buildOf(id) : Object.values(builds).find(b => b.key === lot.key) || null; };

  function build(key, tpl) {
    const lot = window.CitySim?.data?.ownedLots?.find(l => l.key === key), M = MODELS[tpl];
    if (!lot) return fail('Terreno não encontrado');
    if (!M) return fail('Modelo inválido');
    if (!fits(M, lotSize(record(lot)))) return fail(M.name + ' não cabe neste terreno — escolha um modelo menor');
    if (builtFor(lot)) return fail('Este terreno já tem casa');
    const rec = record(lot);
    if (!rec) return fail('Vá até o terreno (perto da placa) para iniciar a obra');
    const price = cost(tpl);
    if (!CityLife.debit(price, 'Construção · ' + M.name + (furnish ? ' mobiliada' : '') + ' · ' + lot.name)) return fail('Você precisa de ' + CityLife.money(price));
    lot.id = rec.id; builds[rec.id] = { tpl, furnished: furnish, key: lot.key, name: M.name + ' · ' + lot.name, price: price + (lot.price || 0), at: Date.now() };
    save(); window.CitySim.save?.();
    // o jogador não pode ficar preso dentro das paredes novas: vai p/ a calçada em frente à placa
    const P = window.__game?.player, [x0, y0, x1, y1] = rec.bb;
    if (P && P.x > x0 - 3 && P.x < x1 + 3 && P.y > y0 - 3 && P.y < y1 + 3) { P.x = rec.sign[0] + rec.front[0] * 2; P.y = rec.sign[1] + rec.front[1] * 2; }
    // gera o setor de novo: no lugar da cerca e da placa nasce a casa escolhida
    const [, sx, sy] = /^lot-(-?\d+)-(-?\d+)-/.exec(rec.id) || [], S = typeof OW !== 'undefined' && OW.sectors.get(sx + ',' + sy);
    if (S && S.state === 'done' && typeof owUnload === 'function') owUnload(S);
    window.dispatchEvent(new Event('city-sim-change'));
    return ok('🏗️ Obra concluída: ' + M.name + (furnish ? ' mobiliada' : ' sem móveis (decore com F7)') + '!');
  }
  // chamado pela geração do setor logo depois de a casa nascer no lote
  function claim(H, id) {
    const b = builds[id]; if (!b || !window.CityRealty?.claim) return;
    const first = !CityRealty.isOwned(H);
    CityRealty.claim(H, { name: b.name, price: b.price, bare: !b.furnished, lot: id });
    if (first && window.CitySim?.data) { CitySim.data.home = { name: b.name, x: H.front?.[0] ?? H.doorPt[0], y: H.front?.[1] ?? H.doorPt[1], price: b.price }; CitySim.save(); }
  }

  function renderLot(lot, { card, btn }) {
    const b = builtFor(lot), home = window.CitySim?.data?.home?.name, size = lotSize(record(lot));
    if (b) return card(b.name, (b.furnished ? 'Mobiliada' : 'Sem móveis — entre e use F7 para decorar') + ' · ' + Math.round(lot.area) + ' m² de terreno',
      btn('sim:home:' + lot.key, home === b.name ? 'Residência atual' : 'Mudar para cá', home === b.name), MODELS[b.tpl]?.icon || '🏡');
    return '<article class="city-panel"><h3>🏗️ ' + lot.name + ' · terreno vazio</h3><p class="city-help">Escolha o modelo da casa. A obra fica pronta na hora.' + (size ? ' Terreno: ' + Math.round(size.w) + ' × ' + Math.round(size.d) + ' m.' : '') + '</p>' +
      '<div class="city-row">' + btn('sim:lotfurn:1', (furnish ? '✅ ' : '') + 'Mobiliada (+' + FURNISH * 100 + '%)') + btn('sim:lotfurn:0', (!furnish ? '✅ ' : '') + 'Sem móveis') + '</div>' +
      '<p class="city-phone-label">Modelos clássicos</p>' + Object.entries(MODELS).filter(([, M]) => !M.organic).map(row).join('') +
      '<p class="city-phone-label">Plantas novas · sala integrada, corredor curto, suíte</p>' + Object.entries(MODELS).filter(([, M]) => M.organic).map(row).join('') + '</article>';
    function row([k, M]) {
      const ok = fits(M, size);
      return '<div class="city-row"><div><strong>' + M.icon + ' ' + M.name + '</strong><small> ' + M.desc + (ok ? '' : ' · <b>não cabe neste terreno</b>') + '</small></div>' +
        btn('sim:lotbuild:' + lot.key + ':' + k, CityLife.money(cost(k)), !ok || CityLife.funds < cost(k)) + '</div>';
    }
  }
  function setFurnish(v) { furnish = v === '1'; return ok(furnish ? 'A casa virá mobiliada' : 'A casa virá sem móveis'); }

  return { MODELS, build, claim, buildOf, builtFor, renderLot, setFurnish, get furnish() { return furnish; } };
})();
window.CityLots = CityLots;
