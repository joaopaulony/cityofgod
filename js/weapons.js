// weapons.js — catálogo de armas e acessórios (modelos do "Ultimate Gun Pack", Quaternius, CC0; assets/weapons gerado
// por tools/import-weapons.mjs). Nomes genéricos (sem marcas), calibre, atributos de tiro, preço de referência p/ troca
// e quem pode portar cada arma:
//  - gangue: só pistolas, revólveres e submetralhadoras;
//  - polícia: pistola ou fuzil estilo AR (nada de AK — os AKs do pack nem foram importados);
//  - fuzis de precisão, escopetas e bullpups: só o jogador (loja/troca).
'use strict';
const CityWeapons = (() => {
  const DIR = 'assets/weapons/';
  // categoria → slot da roda, rótulo e atributos-base (rof = segundos entre tiros; spread = abertura extra)
  const CATS = Object.freeze({
    pistol:   { label: 'Pistola', slot: 'pistol', auto: false, rof: .22, spread: 1.15, range: 32 },
    revolver: { label: 'Revólver', slot: 'pistol', auto: false, rof: .42, spread: 1.0, range: 36 },
    smg:      { label: 'Submetralhadora', slot: 'smg', auto: true, rof: .075, spread: 1.35, range: 34 },
    rifle:    { label: 'Fuzil', slot: 'rifle', auto: true, rof: .11, spread: 1.0, range: 48 },
    shotgun:  { label: 'Escopeta', slot: 'shotgun', auto: false, rof: .85, spread: 2.2, range: 20, pellets: 8 },
    sniper:   { label: 'Precisão', slot: 'sniper', auto: false, rof: 1.25, spread: .35, range: 90 }
  });
  const CAL = Object.freeze({ '9mm': '9 mm', '.40': '.40', '.45': '.45', '.38': '.38', '.357': '.357', '5.56': '5,56 mm', '12': 'calibre 12', '.308': '.308' });
  const w = (id, name, cat, cal, mag, extra = {}) => [id, Object.freeze({ id, name, cat, cal, mag, ...CATS[cat], ...extra, icon: DIR + 'icons/' + id + '.webp', model: DIR + 'models/' + id + '.glb' })];
  const list = Object.fromEntries([
    w('pistol_1', 'Pistola Padrão', 'pistol', '9mm', 15, { price: 2400, damage: 26 }),
    w('pistol_2', 'Pistola Compacta', 'pistol', '9mm', 12, { price: 2100, damage: 24 }),
    w('pistol_3', 'Pistola Tática', 'pistol', '9mm', 17, { price: 3100, damage: 26 }),
    w('pistol_4', 'Pistola Policial', 'pistol', '9mm', 17, { price: 2800, damage: 26 }),
    w('pistol_5', 'Pistola .40', 'pistol', '.40', 14, { price: 3400, damage: 31, rof: .26 }),
    w('pistol_6', 'Pistola Pesada .45', 'pistol', '.45', 8, { price: 3800, damage: 36, rof: .3 }),
    w('revolver_1', 'Revólver .38 Curto', 'revolver', '.38', 5, { price: 1700, damage: 30 }),
    w('revolver_2', 'Revólver .38', 'revolver', '.38', 6, { price: 1900, damage: 31 }),
    w('revolver_3', 'Revólver .357', 'revolver', '.357', 6, { price: 2900, damage: 40 }),
    w('revolver_4', 'Revólver .357 Longo', 'revolver', '.357', 6, { price: 3300, damage: 42, spread: .85 }),
    w('revolver_5', 'Revólver Clássico', 'revolver', '.38', 6, { price: 2200, damage: 31 }),
    w('smg_1', 'Submetralhadora Compacta', 'smg', '9mm', 25, { price: 5200, damage: 21, rof: .065 }),
    w('smg_2', 'Submetralhadora Tática', 'smg', '9mm', 30, { price: 6100, damage: 22 }),
    w('smg_3', 'Submetralhadora com Coronha', 'smg', '9mm', 30, { price: 6400, damage: 22, spread: 1.15 }),
    w('smg_4', 'Submetralhadora de Bolso', 'smg', '9mm', 20, { price: 4600, damage: 20, rof: .06, spread: 1.5 }),
    w('smg_5', 'Submetralhadora Dobrável', 'smg', '9mm', 30, { price: 6000, damage: 22, spread: 1.2 }),
    w('rifle_ar_1', 'Fuzil AR Padrão', 'rifle', '5.56', 30, { price: 11500, damage: 34 }),
    w('rifle_ar_2', 'Carabina AR', 'rifle', '5.56', 30, { price: 10800, damage: 33 }),
    w('rifle_ar_3', 'Fuzil AR Curto', 'rifle', '5.56', 30, { price: 9600, damage: 31, spread: 1.15 }),
    w('rifle_ar_4', 'Carabina AR Compacta', 'rifle', '5.56', 30, { price: 10200, damage: 32, spread: 1.08 }),
    w('bullpup_1', 'Fuzil Bullpup', 'rifle', '5.56', 30, { price: 12800, damage: 33, police: false }),
    w('bullpup_2', 'Fuzil Bullpup Tático', 'rifle', '5.56', 30, { price: 13400, damage: 33, police: false }),
    w('bullpup_3', 'Fuzil Bullpup Compacto', 'rifle', '5.56', 30, { price: 12200, damage: 32, police: false }),
    w('shotgun_1', 'Escopeta de Bombeamento', 'shotgun', '12', 6, { price: 4200, damage: 14 }),
    w('shotgun_2', 'Escopeta Longa', 'shotgun', '12', 7, { price: 4500, damage: 14 }),
    w('shotgun_3', 'Escopeta Tática', 'shotgun', '12', 7, { price: 5200, damage: 14 }),
    w('shotgun_4', 'Escopeta Rural', 'shotgun', '12', 5, { price: 3600, damage: 14 }),
    w('shotgun_sawedoff', 'Escopeta Cano Serrado', 'shotgun', '12', 2, { price: 2600, damage: 16, spread: 3, range: 12 }),
    w('shotgun_shortstock', 'Escopeta Coronha Curta', 'shotgun', '12', 6, { price: 4800, damage: 14, spread: 2.5 }),
    w('sniper_1', 'Rifle de Precisão Verde', 'sniper', '.308', 5, { price: 16500, damage: 85 }),
    w('sniper_2', 'Rifle de Precisão Cinza', 'sniper', '.308', 5, { price: 16000, damage: 85 }),
    w('sniper_3', 'Rifle de Precisão Ártico', 'sniper', '.308', 5, { price: 19500, damage: 92 }),
    w('sniper_4', 'Rifle de Precisão Tático', 'sniper', '.308', 10, { price: 18200, damage: 80, rof: .8 }),
    w('sniper_5', 'Rifle de Precisão com Bipé', 'sniper', '.308', 5, { price: 21000, damage: 92, spread: .25 }),
    w('sniper_6', 'Rifle de Caça', 'sniper', '.308', 4, { price: 12500, damage: 80 })
  ]);
  // acessórios: onde encaixa (nó do modelo da arma) e em que categorias
  const a = (id, name, mount, cats, extra = {}) => [id, Object.freeze({ id, name, mount, cats, ...extra, icon: DIR + 'icons/' + id + '.webp', model: DIR + 'models/' + id + '.glb' })];
  const accessories = Object.fromEntries([
    a('suppressor_short', 'Silenciador Curto', 'muzzle', ['pistol', 'smg'], { price: 1200, detail: 'Abafa o disparo · alcance −10%', range: .9 }),
    a('suppressor', 'Silenciador', 'muzzle', ['pistol', 'smg', 'rifle'], { price: 1800, detail: 'Abafa o disparo · alcance −8%', range: .92 }),
    a('suppressor_long', 'Silenciador Longo', 'muzzle', ['rifle', 'sniper'], { price: 2400, detail: 'Abafa o disparo · mais estável', spread: .92 }),
    a('scope_short', 'Luneta Curta', 'rail', ['smg', 'rifle'], { price: 1500, detail: 'Mira +15% de precisão', spread: .85 }),
    a('scope_tactical', 'Luneta Tática', 'rail', ['rifle'], { price: 2600, detail: 'Mira +25% de precisão', spread: .75 }),
    a('scope_long', 'Luneta Longa', 'rail', ['rifle', 'sniper'], { price: 3200, detail: 'Alcance +20%', range: 1.2 }),
    a('flashlight', 'Lanterna Tática', 'under', ['pistol', 'smg', 'rifle', 'shotgun'], { price: 600, detail: 'Ilumina à noite' }),
    a('foregrip', 'Empunhadura Frontal', 'under', ['smg', 'rifle', 'shotgun'], { price: 900, detail: 'Recuo −15%', spread: .88 })
  ]);
  // quem pode portar o quê (NPCs); o jogador pode tudo
  const ROLE = Object.freeze({
    gang: id => ['pistol', 'revolver', 'smg'].includes(list[id]?.cat),
    police: id => list[id]?.cat === 'pistol' || (list[id]?.cat === 'rifle' && list[id].police !== false),
    service: () => false, worker: () => false, civil: () => false
  });
  const allowed = (role, id) => role === 'player' ? !!list[id] : !!ROLE[role]?.(id);
  // arma de um NPC: gangue fica mais em pistola (60%) que SMG; polícia em fuzil AR na ocorrência, pistola no resto
  function npcWeapon(role, { long = false, rand = Math.random } = {}) {
    const ids = Object.keys(list).filter(id => allowed(role, id));
    if (!ids.length) return null;
    let pool = ids;
    if (role === 'gang') pool = ids.filter(id => (rand() < .6) === (list[id].cat !== 'smg'));
    if (role === 'police') pool = ids.filter(id => (list[id].cat === 'rifle') === long);
    pool = pool.length ? pool : ids;
    return pool[Math.floor(rand() * pool.length)];
  }
  // atributos de uma arma com os acessórios montados
  function stats(id, mods = []) {
    const base = list[id]; if (!base) return null;
    const s = { ...base };
    for (const m of mods) { const x = accessories[m]; if (!x) continue; if (x.spread) s.spread *= x.spread; if (x.range) s.range *= x.range; }
    return s;
  }
  const fits = (accId, weaponId) => !!accessories[accId] && accessories[accId].cats.includes(list[weaponId]?.cat);
  return Object.freeze({ DIR, CATS, CAL, list, accessories, allowed, npcWeapon, stats, fits });
})();
window.CityWeapons = CityWeapons;
