// career-ladder.js — escada de carreira de TODAS as profissões do jogo, num lugar só (sem DOM: testável no Node).
//
//  · Profissões: empregos de turno (jobs.mjs), profissões da universidade com negócio próprio (careers.mjs), carreiras
//    remotas do computador (CityDesk) e os serviços públicos novos — Policial (delegacia) e Socorrista do SAMU (ambulância).
//  · Limite: no máximo 2 profissões ativas ao mesmo tempo, contando a do computador (CityDesk). Estudar não ocupa vaga;
//    exercer ocupa (bater o ponto, abrir o negócio, aceitar contrato remoto). Para trocar, deixe uma das duas.
//  · Cargos: cada profissão tem 5 cargos. A experiência (XP) vem do trabalho feito (turnos, atendimentos, contratos,
//    ocorrências). Cada cargo aumenta o salário (multiplicador) e libera atividades novas e, em alguns, um imóvel.
//  · Pronto p/ multijogador: o estado é um objeto simples, serializável, com ids estáveis ('job:taxi', 'uni:medic'...);
//    as regras não dependem de quem está jogando (jogador local, outro jogador ou NPC com a mesma ficha).
(function (root) {
  'use strict';
  const MAX_ACTIVE = 2;
  // XP total p/ chegar a cada cargo (índice 0..4) e o multiplicador de salário de cada um
  const RANK_XP = [0, 300, 900, 2200, 4500];
  const RANK_PAY = [1, 1.15, 1.35, 1.6, 1.95];

  // grupo · requisito · cargos (título + o que libera) · imóvel que a profissão permite comprar e a partir de qual cargo
  const R = (title, unlocks) => ({ title, unlocks });
  const PROFESSIONS = {
    // ---------- empregos de turno (sem faculdade) ----------
    'job:courier': { group: 'job', title: 'Entregador', icon: '📦', place: 'Central Logística City',
      ranks: [R('Entregador estagiário', ['5 entregas por turno']), R('Entregador', ['6 entregas por turno', 'Bônus de rapidez maior']),
        R('Entregador sênior', ['7 entregas por turno', 'Encomendas frágeis (pagam o dobro)']), R('Líder de rota', ['Rota expressa noturna']),
        R('Supervisor de logística', ['Equipe de entregadores no automático'])],
      property: { kind: 'courieragency', name: 'Agência de Entregas', minRank: 4, price: 85000 } },
    'job:taxi': { group: 'job', title: 'Taxista', icon: '🚕', place: 'Central Logística City',
      ranks: [R('Motorista iniciante', ['4 corridas por turno']), R('Taxista', ['5 corridas por turno']), R('Taxista executivo', ['Corridas VIP (tarifa maior)']),
        R('Taxista do aeroporto', ['Corridas longas para o aeroporto']), R('Dono de frota', ['Motoristas no automático'])],
      property: { kind: 'taxicoop', name: 'Cooperativa de Táxi', minRank: 4, price: 120000 } },
    'job:garbage': { group: 'job', title: 'Gari', icon: '🗑️', place: 'Central Logística City',
      ranks: [R('Gari', ['6 coletas por turno']), R('Gari experiente', ['7 coletas por turno']), R('Motorista da coleta', ['Coleta de entulho (paga mais)']),
        R('Encarregado de rota', ['Rota do centro']), R('Fiscal de limpeza urbana', ['Equipe de coleta no automático'])] },
    'job:mechanic': { group: 'job', title: 'Mecânico de oficina', icon: '🔧', place: 'Oficina City Motors',
      ranks: [R('Aprendiz de mecânico', ['4 carros por turno']), R('Mecânico', ['5 carros por turno']), R('Mecânico especialista', ['Motores e câmbio (pagam mais)']),
        R('Chefe de oficina', ['Carros importados']), R('Gerente de oficina', ['Equipe no automático'])] },
    'job:barista': { group: 'job', title: 'Atendente', icon: '☕', place: 'Lanchonete do Hospital City of God',
      ranks: [R('Atendente', ['6 clientes por turno']), R('Atendente experiente', ['7 clientes por turno', 'Gorjetas maiores']), R('Barista', ['Cafés especiais']),
        R('Supervisor de loja', ['Caixa e estoque']), R('Gerente da lanchonete', ['Equipe no automático'])] },

    // ---------- serviços públicos (curso na Universidade, carreira por patentes) ----------
    'svc:police': { group: 'service', title: 'Policial', icon: '👮', place: 'Delegacia de City of God', degree: ['police'],
      ranks: [R('Soldado', ['Ronda de viatura com pontos de patrulha']), R('Cabo', ['Atender ocorrências: abordagem e prisão']),
        R('Sargento', ['Perseguições e flagrantes (bônus)']), R('Tenente', ['Interrogatório na delegacia', 'Empresa de Segurança Privada']),
        R('Capitão', ['Comando: equipes de patrulha no automático'])],
      property: { kind: 'security', name: 'Empresa de Segurança Privada', minRank: 3, price: 160000 } },
    'svc:paramedic': { group: 'service', title: 'Socorrista do SAMU', icon: '🚑', place: 'Hospital City of God', degree: ['paramedic', 'medic'],
      ranks: [R('Socorrista', ['Chamados de ambulância: triagem e transporte']), R('Técnico de emergência', ['Reanimação (RCP) e imobilização']),
        R('Enfermeiro(a) de resgate', ['Chamados graves (pagam mais)']), R('Médico(a) de resgate', ['Atendimento avançado (requer Medicina)', 'Base de Ambulâncias Particular']),
        R('Coordenador(a) do SAMU', ['Equipes de ambulância no automático'])],
      property: { kind: 'ambulancebase', name: 'Base de Ambulâncias Particular', minRank: 3, price: 190000 } },

    // ---------- profissões da universidade com negócio próprio (careers.mjs) ----------
    'uni:medic': { group: 'university', title: 'Médico(a)', icon: '🩺', degree: ['medic'],
      ranks: [R('Médico(a) residente', ['Consultório: consultas simples']), R('Clínico geral', ['Exames e receitas']), R('Especialista', ['Casos complexos (pagam mais)']),
        R('Chefe de clínica', ['Segundo médico NPC atende junto']), R('Diretor(a) médico(a)', ['Clínica no automático rende mais'])],
      property: { kind: 'medclinic', name: 'Consultório Médico', minRank: 0, price: 210000 } },
    'uni:vet': { group: 'university', title: 'Veterinário(a)', icon: '🐾', degree: ['vet'],
      ranks: [R('Veterinário(a) recém-formado(a)', ['Consultas e vacinas']), R('Veterinário(a) clínico(a)', ['Exames']), R('Cirurgião(ã) veterinário(a)', ['Cirurgias (pagam mais)']),
        R('Chefe da clínica', ['Auxiliar NPC']), R('Diretor(a) veterinário(a)', ['Clínica no automático rende mais'])],
      property: { kind: 'vetclinic', name: 'Clínica Veterinária', minRank: 0, price: 150000 } },
    'uni:lawyer': { group: 'university', title: 'Advogado(a)', icon: '⚖️', degree: ['lawyer'],
      ranks: [R('Advogado(a) júnior', ['Consultas jurídicas']), R('Advogado(a) pleno', ['Contratos']), R('Advogado(a) sênior', ['Causas trabalhistas (pagam mais)']),
        R('Sócio(a)', ['Estagiário NPC']), R('Sócio(a)-fundador(a)', ['Escritório no automático rende mais'])],
      property: { kind: 'lawoffice', name: 'Escritório de Advocacia', minRank: 0, price: 95000 } },
    'uni:mechanic': { group: 'university', title: 'Mecânico(a) formado(a)', icon: '🔩', degree: ['mechanic'],
      ranks: [R('Mecânico(a) autônomo(a)', ['Oficina própria: consertos']), R('Mecânico(a) certificado(a)', ['Injeção eletrônica']), R('Especialista', ['Retífica de motor (paga mais)']),
        R('Dono(a) de oficina', ['Ajudante NPC']), R('Rede de oficinas', ['Oficina no automático rende mais'])],
      property: { kind: 'autoshop', name: 'Oficina Mecânica', minRank: 0, price: 120000 } },
    'uni:chef': { group: 'university', title: 'Chef de cozinha', icon: '👨‍🍳', degree: ['chef'],
      ranks: [R('Cozinheiro(a)', ['Pratos do dia']), R('Sous-chef', ['Cardápio completo']), R('Chef', ['Pratos de autor (pagam mais)']),
        R('Chef executivo(a)', ['Garçom NPC']), R('Chef proprietário(a)', ['Restaurante no automático rende mais'])],
      property: { kind: 'restaurant', name: 'Restaurante', minRank: 0, price: 140000 } },
    'uni:barber': { group: 'university', title: 'Barbeiro(a)', icon: '💈', degree: ['barber'],
      ranks: [R('Barbeiro(a) iniciante', ['Cortes simples']), R('Barbeiro(a)', ['Barba e toalha quente']), R('Mestre barbeiro(a)', ['Desenhos e navalhado (pagam mais)']),
        R('Dono(a) de barbearia', ['Barbeiro NPC']), R('Rede de barbearias', ['Barbearia no automático rende mais'])],
      property: { kind: 'barbershop', name: 'Barbearia', minRank: 0, price: 48000 } },

    // ---------- carreiras do computador (CityDesk: uma só conta como profissão) ----------
    'remote:programmer': { group: 'remote', title: 'Programador(a) freelancer', icon: '💻', remote: true,
      ranks: [R('Estagiário(a) freelancer', ['Correções simples']), R('Desenvolvedor(a) júnior', ['Sites e APIs']), R('Desenvolvedor(a) pleno', ['Projetos maiores']),
        R('Desenvolvedor(a) sênior', ['Clientes premium']), R('Arquiteto(a) digital', ['Equipe remota no automático'])] },
    'remote:support': { group: 'remote', title: 'Suporte técnico remoto', icon: '🛠️', remote: true,
      ranks: [R('HelpDesk N1', ['Chamados simples']), R('Técnico(a) júnior', ['Redes']), R('Analista N2', ['Servidores']), R('Especialista de infra', ['Contratos mensais']), R('Consultor(a) de TI', ['Equipe no automático'])] },
    'remote:designer': { group: 'remote', title: 'Designer gráfico', icon: '🎨', remote: true,
      ranks: [R('Criador(a) iniciante', ['Logos simples']), R('Designer freelancer', ['Identidade visual']), R('Diretor(a) de marca', ['Campanhas']), R('Estúdio criativo', ['Clientes premium']), R('Diretor(a) de arte', ['Equipe no automático'])] },
    'remote:streamer': { group: 'remote', title: 'Streamer', icon: '🎙️', remote: true,
      ranks: [R('Canal de quarto', ['Lives curtas']), R('Criador(a) local', ['Patrocínio pequeno']), R('Parceiro(a)', ['Lives longas']), R('Referência da cidade', ['Eventos ao vivo']), R('Estrela urbana', ['Agência de talentos'])] },
  };

  // ---------- estado ----------
  // {active:[ids], xp:{id:n}, joined:{id:clock}}
  const fresh = () => ({ active: [], xp: {}, joined: {}, teamDay: -1 });
  function normalize(raw) {
    const s = fresh();
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.active)) s.active = raw.active.filter(id => PROFESSIONS[id]).slice(0, MAX_ACTIVE);
      if (raw.xp && typeof raw.xp === 'object') for (const [k, v] of Object.entries(raw.xp)) if (PROFESSIONS[k] && Number.isFinite(v) && v >= 0) s.xp[k] = Math.floor(v);
      if (raw.joined && typeof raw.joined === 'object') for (const [k, v] of Object.entries(raw.joined)) if (PROFESSIONS[k] && Number.isFinite(v)) s.joined[k] = v;
      if (Number.isFinite(raw.teamDay)) s.teamDay = Math.floor(raw.teamDay);
    }
    return s;
  }
  const rankOf = (state, id) => { const x = state.xp[id] || 0; let r = 0; for (let i = 0; i < RANK_XP.length; i++) if (x >= RANK_XP[i]) r = i; return r; };
  function info(state, id) {
    const p = PROFESSIONS[id]; if (!p) return null;
    const rank = rankOf(state, id), xp = state.xp[id] || 0, next = RANK_XP[rank + 1];
    return { id, title: p.title, icon: p.icon, group: p.group, rank, rankTitle: p.ranks[rank].title, xp, nextXP: next ?? null,
      progress: next ? (xp - RANK_XP[rank]) / (next - RANK_XP[rank]) : 1, payMult: RANK_PAY[rank], active: state.active.includes(id),
      unlocked: p.ranks.slice(0, rank + 1).flatMap(r => r.unlocks), nextUnlocks: p.ranks[rank + 1]?.unlocks || [], property: p.property || null,
      propertyOpen: !!p.property && rank >= p.property.minRank };
  }
  // degrees: diplomas que o jogador tem (ids de curso: medic, police...)
  function requirement(id, degrees = {}) {
    const p = PROFESSIONS[id]; if (!p) return { ok: false, text: 'Profissão desconhecida.' };
    if (p.degree && !p.degree.some(d => degrees[d])) return { ok: false, text: 'Requer formação: ' + p.degree.map(d => COURSE_NAMES[d] || d).join(' ou ') + '.' };
    return { ok: true };
  }
  const COURSE_NAMES = { medic: 'Medicina', vet: 'Medicina Veterinária', lawyer: 'Direito', mechanic: 'Mecânica Automotiva', chef: 'Gastronomia', barber: 'Estética e Barbearia', police: 'Academia de Polícia', paramedic: 'Técnico em Emergência (SAMU)' };
  // o computador conta como UMA profissão, qualquer que seja a carreira remota
  const slotOf = id => (PROFESSIONS[id]?.remote ? 'remote' : id);
  // entra na profissão (ocupa vaga). Já ativa: ok. Sem vaga: diz quais ocupam.
  function activate(state, id, { degrees = {}, clock = 0 } = {}) {
    const req = requirement(id, degrees); if (!req.ok) return req;
    if (state.active.includes(id)) return { ok: true, already: true, text: PROFESSIONS[id].title + ' já é uma das suas profissões.' };
    // trocar de carreira remota não ocupa outra vaga: substitui a do computador
    const sameSlot = state.active.find(a => slotOf(a) === slotOf(id));
    if (sameSlot) { state.active[state.active.indexOf(sameSlot)] = id; state.joined[id] = state.joined[id] ?? clock; return { ok: true, replaced: sameSlot, text: 'No computador agora: ' + PROFESSIONS[id].title + '.' }; }
    if (state.active.length >= MAX_ACTIVE) return { ok: false, full: true, text: 'Você já exerce 2 profissões (' + state.active.map(a => PROFESSIONS[a].title).join(' e ') + '). Deixe uma delas para começar ' + PROFESSIONS[id].title + '.' };
    state.active.push(id); state.joined[id] = state.joined[id] ?? clock;
    return { ok: true, text: 'Nova profissão: ' + PROFESSIONS[id].title + ' (' + PROFESSIONS[id].ranks[rankOf(state, id)].title + ').' };
  }
  function leave(state, id) {
    const i = state.active.indexOf(id); if (i < 0) return { ok: false, text: 'Você não exerce essa profissão.' };
    state.active.splice(i, 1); return { ok: true, text: 'Você deixou de exercer ' + PROFESSIONS[id].title + '. A experiência fica guardada.' };
  }
  // XP do trabalho feito; devolve se subiu de cargo e o que liberou
  function addXP(state, id, amount) {
    if (!PROFESSIONS[id] || !(amount > 0)) return { rankUp: false, rank: rankOf(state, id) };
    const before = rankOf(state, id); state.xp[id] = (state.xp[id] || 0) + Math.round(amount); const after = rankOf(state, id);
    return { rankUp: after > before, rank: after, title: PROFESSIONS[id].ranks[after].title, unlocks: after > before ? PROFESSIONS[id].ranks.slice(before + 1, after + 1).flatMap(r => r.unlocks) : [] };
  }
  const payMult = (state, id) => RANK_PAY[rankOf(state, id)];
  // liberou algo cujo texto contém `text` (ex.: 'VIP', 'no automático')
  const hasUnlock = (state, id, text) => !!info(state, id)?.unlocked.some(u => u.includes(text));
  // quantas tarefas por turno nos empregos (cresce com o cargo, como descrito nas listas)
  const shiftSize = (state, id, base) => base + Math.min(2, rankOf(state, id));
  // imóvel que a profissão libera: pode comprar?
  function canBuyProperty(state, kind) {
    for (const [id, p] of Object.entries(PROFESSIONS)) if (p.property?.kind === kind) {
      if (rankOf(state, id) < p.property.minRank) return { ok: false, text: p.property.name + ' libera no cargo ' + p.ranks[p.property.minRank].title + ' de ' + p.title + '.' };
      return { ok: true, id };
    }
    return { ok: true };
  }

  // equipe no automático (último cargo dos empregos, serviço público e computador): rende uma vez por dia de jogo,
  // mesmo sem o jogador bater o ponto. Os negócios próprios já têm o modo automático deles (careers.mjs).
  const TEAM_BASE = { job: 180, service: 260, remote: 220 };
  function teamPayout(state, day) {
    if (!Number.isFinite(day) || day <= state.teamDay) return [];
    const first = state.teamDay < 0; state.teamDay = day;
    if (first) return [];   // primeiro dia visto: só marca (não paga dias anteriores)
    const out = [];
    for (const id of state.active) {
      const p = PROFESSIONS[id]; if (!TEAM_BASE[p.group] || !hasUnlock(state, id, 'no automático')) continue;
      out.push({ id, title: p.title, pay: Math.round(TEAM_BASE[p.group] * payMult(state, id)), xp: 20 });
    }
    return out;
  }

  const api = { MAX_ACTIVE, teamPayout, RANK_XP, RANK_PAY, PROFESSIONS, COURSE_NAMES, fresh, normalize, rankOf, info, requirement, activate, leave, addXP, payMult, hasUnlock, shiftSize, canBuyProperty, slotOf };
  root.CityCareerLadder = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // ---------- no navegador: estado salvo e avisos (CityCareer) ----------
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const KEY = 'cityofgod.career-ladder.v1';
  let state = fresh();
  try { state = normalize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { /* estado novo */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sem armazenamento */ } };
  const clock = () => window.__game?.st?.clock || 0;
  const degrees = () => window.CityCareers?.state?.degrees || {};
  const notify = (t, ok = true) => { window.CityUI?.notify?.(t); window.CityAudio?.ui?.(ok ? 'confirm' : 'back'); };
  const store = {
    get state() { return state; },
    info: id => info(state, id),
    list: () => Object.keys(PROFESSIONS).map(id => info(state, id)),
    active: () => state.active.map(id => info(state, id)),
    requirement: id => requirement(id, degrees()),
    activate(id, { quiet = false } = {}) { const r = activate(state, id, { degrees: degrees(), clock: clock() }); if (r.ok) save(); if (!quiet && !r.already) notify(r.text, r.ok); return r; },
    leave(id) { const r = leave(state, id); if (r.ok) save(); return r; },
    // trabalho feito: XP e aviso de promoção com o que liberou
    addXP(id, amount) {
      const r = addXP(state, id, amount); save();
      if (r.rankUp) { notify('⭐ Promoção! Agora você é ' + r.title + ' (' + PROFESSIONS[id].title + ').' + (r.unlocks.length ? ' Liberado: ' + r.unlocks.join(' · ') + '.' : '')); window.CityAdventures?.signal?.('promotion'); }
      return r;
    },
    payMult: id => payMult(state, id),
    rank: id => rankOf(state, id),
    hasUnlock: (id, text) => hasUnlock(state, id, text),
    shiftSize: (id, base) => shiftSize(state, id, base),
    canBuyProperty: kind => canBuyProperty(state, kind),
    // chamado a cada quadro (jobs.mjs): fecha o dia das equipes no automático
    tickTeams() {
      const before = state.teamDay, list = teamPayout(state, Math.floor(clock() / 1440));
      if (state.teamDay !== before) save(); if (!list.length) return;
      for (const t of list) { window.CityLife?.credit?.(t.pay, 'Equipe no automático · ' + t.title); this.addXP(t.id, t.xp); }
      notify('👥 Suas equipes trabalharam hoje: ' + list.map(t => t.title + ' +R$ ' + t.pay).join(' · '));
    },
    // ferramentas de teste / administração
    _set(raw) { state = normalize(raw); save(); return state; },
  };
  window.CityCareer = store;
})(typeof window !== 'undefined' ? window : globalThis);
