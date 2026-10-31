// hud-dock.js — dock de atalhos no canto inferior direito (estilo em css/hud-system.css): padroniza o conteúdo de cada
// botão (ícone · rótulo · tecla) e empilha só os visíveis, de baixo p/ cima, sem nenhum cobrir outro.
'use strict';
(() => {
  // ordem de baixo p/ cima; o celular fica dentro de #city-controls (que já é o primeiro degrau)
  const ITEMS = [
    { id: 'social-entry', icon: '♡', label: 'Vida social', key: 'Y' },
    { id: 'city-pets-entry', icon: '🐾', label: 'Pets', key: 'F8' },
    { id: 'city-cas-open', icon: '◈', label: 'Meu personagem', key: '' }
  ];
  const tidy = (el, { icon, label, key }) => {
    if (!el || el.dataset.hudDock) return;
    el.dataset.hudDock = '1';
    el.innerHTML = `<span class="hud-dock-icon" aria-hidden="true">${icon}</span><span class="hud-dock-label">${label}</span>${key ? `<kbd>${key}</kbd>` : ''}`;
  };
  function tidyPhone() {
    const b = document.querySelector('#city-controls button[data-action="phone"]');
    if (!b || b.dataset.hudDock) return;
    b.dataset.hudDock = '1';
    const icon = b.querySelector('b');
    b.textContent = ''; if (icon) b.append(icon);
    b.insertAdjacentHTML('beforeend', '<span class="hud-dock-label">Celular</span><kbd>P</kbd>');
  }
  const shown = el => el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
  // css/hud-system.css sempre por último no <head> (vale sobre os estilos antigos e os que os módulos injetam depois)
  function sheet() {
    let l = document.getElementById('hud-system-css');
    if (!l) { l = document.createElement('link'); l.id = 'hud-system-css'; l.rel = 'stylesheet'; l.href = 'css/hud-system.css'; }
    if (document.head.lastElementChild !== l) document.head.appendChild(l);
  }
  function layout() {
    sheet();
    tidyPhone();
    for (const it of ITEMS) tidy(document.getElementById(it.id), it);
    const css = getComputedStyle(document.documentElement), gap = parseFloat(css.getPropertyValue('--dock-gap')) || 8, edge = parseFloat(css.getPropertyValue('--dock-edge')) || 16;
    const base = document.getElementById('city-controls');
    let bottom = edge + (shown(base) ? base.getBoundingClientRect().height + gap : 0);
    for (const it of ITEMS) {
      const el = document.getElementById(it.id); if (!shown(el)) continue;
      const want = bottom + 'px'; if (el.style.bottom !== want) el.style.setProperty('bottom', want, 'important');
      bottom += el.getBoundingClientRect().height + gap;
    }
  }
  setInterval(layout, 400);
  addEventListener('resize', layout);
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', layout) : layout();
})();
