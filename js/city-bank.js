// CityBank — o app NexoBank: conta corrente (a carteira do CityLife), poupança que rende por dia de jogo,
// empréstimo com parcelas diárias debitadas sozinhas, PIX para os contatos e pagamento das contas da casa.
'use strict';
const CityBank = (() => {
  const KEY = 'cityofgod.bank.v1', RATE = .004, LOAN_FEE = .18, LOAN_DAYS = 10, LATE_FEE = .05;
  let s = { savings: 0, loan: null, score: 600, lastDay: null, log: [] };
  try { const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw && Number.isFinite(raw.savings)) s = { ...s, ...raw, log: Array.isArray(raw.log) ? raw.log.slice(0, 40) : [] }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  const day = () => Math.floor((window.__game?.st?.clock || 0) / 1440);
  const money = n => window.CityLife ? CityLife.money(n) : 'R$ ' + Math.round(n);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ok = text => ({ ok: true, text }), fail = text => ({ ok: false, text });
  const note = (text, delta) => { s.log.unshift({ text, delta, day: day() }); s.log.length = Math.min(s.log.length, 40); };
  const changed = () => { save(); window.dispatchEvent(new Event('city-life-change')); };
  // limite de crédito: cresce com o score (pagar em dia sobe, atrasar desce) e com o que está guardado na poupança
  const limit = () => Math.max(0, Math.floor(((s.score - 400) * 12 + s.savings * .5) / 50) * 50);

  // um "dia" do banco passa junto com o relógio do jogo: rende a poupança e cobra a parcela do empréstimo
  function tick() {
    if (!window.__game?.st || !window.CityLife) return;
    if (!s.migrated) migrate();
    const d = day();
    if (s.lastDay === null || d < s.lastDay) { s.lastDay = d; save(); return; }
    if (d === s.lastDay) return;
    for (let n = Math.min(d - s.lastDay, 7); n > 0; n--) {
      if (s.savings > 0) { const j = Math.max(1, Math.round(s.savings * RATE)); s.savings += j; note('Rendimento da poupança', j); }
      if (s.loan) {
        const due = Math.min(s.loan.installment, s.loan.left);
        if (CityLife.debit(due, 'NexoBank · parcela do empréstimo')) {
          s.loan.left -= due; s.loan.paid++; s.score = Math.min(900, s.score + 6); note('Parcela paga', -due);
        } else {
          const fee = Math.round(due * LATE_FEE); s.loan.left += fee; s.loan.late++; s.score = Math.max(300, s.score - 25);
          note('Parcela atrasada · multa', -fee); window.CityUI?.notify('💳 NexoBank: parcela atrasada, multa de ' + money(fee));
        }
        if (s.loan.left <= 0) { s.loan = null; s.score = Math.min(900, s.score + 20); note('Empréstimo quitado', 0); window.CityUI?.notify('💳 Empréstimo quitado!'); }
      }
    }
    s.lastDay = d; changed();
  }
  setInterval(tick, 1000);
  // a versão antiga do app guardava um saldo à parte (cityofgod.nova-bank.v1): ele volta para a conta e a reserva vira poupança
  function migrate() {
    s.migrated = true;
    try {
      const old = JSON.parse(localStorage.getItem('cityofgod.nova-bank.v1') || 'null');
      if (old && (old.balance > 0 || old.savings > 0)) {
        if (old.balance > 0) CityLife.credit(Math.round(old.balance), 'NexoBank · saldo migrado da conta antiga');
        if (old.savings > 0) { s.savings += Math.round(old.savings); note('Reserva antiga migrada', Math.round(old.savings)); }
        localStorage.setItem('cityofgod.nova-bank.v1', JSON.stringify({ ...old, balance: 0, savings: 0 }));
      }
    } catch {}
    save();
  }

  const amountOf = arg => {
    const v = arg === 'x' ? Number(String(document.getElementById('city-bank-amt')?.value || '').replace(',', '.')) : Number(arg);
    return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
  };
  function deposit(a) {
    if (!a) return fail('Digite um valor');
    if (!CityLife.debit(a, 'NexoBank · guardou na poupança')) return fail('Saldo insuficiente na conta');
    s.savings += a; note('Depósito na poupança', a); changed(); return ok('🐷 ' + money(a) + ' guardados na poupança');
  }
  function withdraw(a) {
    if (!a) return fail('Digite um valor');
    if (a > s.savings) return fail('A poupança tem só ' + money(s.savings));
    if (!CityLife.credit(a, 'NexoBank · resgate da poupança')) return fail('Não foi possível resgatar');
    s.savings -= a; note('Resgate da poupança', -a); changed(); return ok(money(a) + ' voltaram para a conta');
  }
  function borrow(a) {
    if (s.loan) return fail('Quite o empréstimo atual antes de pedir outro');
    if (!a) return fail('Digite um valor');
    if (a > limit()) return fail('Seu limite agora é ' + money(limit()));
    const total = Math.round(a * (1 + LOAN_FEE));
    if (!CityLife.credit(a, 'NexoBank · empréstimo liberado')) return fail('Não foi possível liberar');
    s.loan = { amount: a, total, left: total, installment: Math.ceil(total / LOAN_DAYS), paid: 0, late: 0 };
    note('Empréstimo de ' + money(a), a); changed();
    return ok('💳 ' + money(a) + ' na conta · ' + LOAN_DAYS + ' parcelas de ' + money(s.loan.installment));
  }
  function payoff() {
    if (!s.loan) return fail('Nenhum empréstimo em aberto');
    // quitar adiantado dá desconto de metade dos juros que ainda faltavam
    const juros = s.loan.total - s.loan.amount, falta = Math.round(s.loan.left - juros * (s.loan.left / s.loan.total) * .5);
    if (!CityLife.debit(falta, 'NexoBank · quitação antecipada')) return fail('Você precisa de ' + money(falta) + ' na conta');
    s.loan = null; s.score = Math.min(900, s.score + 25); note('Quitação antecipada', -falta); changed(); return ok('Empréstimo quitado com desconto');
  }
  function pix(id, a) {
    const social = window.cityCharacters?.social, who = social?.people.get(id);
    if (!who) return fail('Contato não encontrado');
    if (!a) return fail('Digite um valor');
    if (!CityLife.debit(a, 'PIX para ' + who.name)) return fail('Saldo insuficiente');
    try { const r = social.relation('player', id); r.friend = Math.min(100, r.friend + Math.min(12, a / 25)); r.trust = Math.min(100, r.trust + Math.min(6, a / 50)); social.save?.(); } catch {}
    note('PIX para ' + who.name, -a); changed(); return ok('⚡ PIX de ' + money(a) + ' enviado para ' + who.name.split(' ')[0]);
  }
  function bills() {
    const r = window.CitySim?.payBills?.() || fail('Sem contas');
    if (r.ok) { s.score = Math.min(900, s.score + 4); save(); }
    return r;
  }

  function action(op, a, b) {
    if (!window.CityLife) return fail('Banco indisponível');
    if (op === 'dep') return deposit(amountOf(a));
    if (op === 'saq') return withdraw(amountOf(a));
    if (op === 'emp') return borrow(amountOf(a));
    if (op === 'quitar') return payoff();
    if (op === 'pix') return pix(a, amountOf(b));
    if (op === 'contas') return bills();
    return fail('Operação inválida');
  }

  function renderApp({ banner, card, btn }) {
    const conta = CityLife.funds, total = conta + s.savings - (s.loan?.left || 0), lim = limit();
    const contatos = window.cityCharacters?.social?.contacts?.() || [], contas = window.CitySim?.data?.bills || 0;
    const mov = [...s.log.slice(0, 8).map(t => [t.text + ' · dia ' + (t.day + 1), t.delta])];
    return banner('<strong>NexoBank</strong><small>Conta, poupança, crédito e PIX · score ' + s.score + '</small>') +
      '<div class="city-panel"><small>Conta corrente</small><div class="city-balance">' + money(conta) + '</div>' +
      '<div class="city-row"><span>🐷 Poupança (+' + (RATE * 100).toFixed(1) + '% ao dia)</span><strong>' + money(s.savings) + '</strong></div>' +
      (s.loan ? '<div class="city-row"><span>💳 Empréstimo em aberto</span><strong>−' + money(s.loan.left) + '</strong></div>' : '') +
      '<div class="city-row"><span>Patrimônio líquido</span><strong>' + money(total) + '</strong></div></div>' +
      '<div class="city-panel"><label class="city-help" for="city-bank-amt">Valor da operação (R$)</label>' +
      '<input id="city-bank-amt" type="number" min="1" step="10" value="100" inputmode="numeric" style="width:100%;box-sizing:border-box;padding:8px;border-radius:10px;border:1px solid #8884;margin:4px 0 8px;font:inherit">' +
      '<div class="city-row">' + btn('bank:dep:x', 'Guardar', conta < 1) + btn('bank:saq:x', 'Resgatar', s.savings < 1) + '</div></div>' +
      card('Empréstimo pessoal', s.loan
        ? 'Faltam ' + money(s.loan.left) + ' · parcela diária de ' + money(s.loan.installment) + ' (' + s.loan.paid + ' pagas' + (s.loan.late ? ', ' + s.loan.late + ' atrasadas' : '') + ')'
        : 'Limite de ' + money(lim) + ' · ' + Math.round(LOAN_FEE * 100) + '% de juros em ' + LOAN_DAYS + ' parcelas diárias, debitadas da conta. Atrasar dá multa e baixa o score.',
        s.loan ? btn('bank:quitar', 'Quitar agora (desconto)') : btn('bank:emp:x', 'Pedir o valor digitado', lim < 50), '💳') +
      card('Contas da casa', contas ? 'Luz, água e IPTU pendentes: ' + money(contas) : 'Nenhuma conta pendente', btn('bank:contas', 'Pagar contas', !contas || conta < contas), '🧾') +
      '<div class="city-phone-label">PIX para contatos (usa o valor digitado)</div>' +
      (contatos.length ? contatos.slice(0, 12).map(c => '<div class="city-panel city-row"><div><strong>' + esc(c.name) + '</strong><small> ' + esc(c.number || c.handle || '') + '</small></div>' + btn('bank:pix:' + c.id + ':x', '⚡ PIX', conta < 1) + '</div>').join('')
        : '<p class="city-help">Troque telefone com alguém na cidade para poder mandar PIX.</p>') +
      '<div class="city-phone-label">Extrato do banco</div>' +
      (mov.length ? mov.map(([t, d]) => '<div class="city-log"><span>' + esc(t) + '</span><b>' + (d ? money(d) : '—') + '</b></div>').join('') : '<p class="city-help">Sem movimentações ainda.</p>');
  }

  return { action, renderApp, tick, limit, get savings() { return s.savings; }, get loan() { return s.loan && { ...s.loan }; }, get score() { return s.score; } };
})();
window.CityBank = CityBank;
