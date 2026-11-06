// camera-motion.js — câmera dinâmica sem enjoo.
//  · acompanha a direção: dirigindo, gira devagar até ficar atrás do carro (só andando p/ a frente, ganha força com a
//    velocidade); a pé, depois de meio segundo andando numa direção (menos voltando p/ a câmera), gira até ela ficar
//    p/ o alto da tela. Os controles a pé ficam TRAVADOS no ângulo de quando a tecla foi apertada (moveDir): senão,
//    segurando D, "direita" giraria junto com a câmera e o personagem andaria em círculo. Soltou e apertou de novo,
//    valem pela câmera nova. Nada de giro mirando, dentro de casa, em ré ou com menus.
//    Girar na mão (Q/E, botão do meio) pausa o acompanhamento por 4 s (e os controles seguem a câmera).
//  · zoom pela velocidade: o carro rápido afasta um pouco a câmera (até 14%), e volta suave.
//  · tremor: oscilação suave e amortecida (soma de senos de baixa frequência), só deslocamento — nunca gira a imagem.
//    Batidas (proporcional à velocidade, com um leve "soco" de zoom), tiros e dano. "Reduzir movimento" corta a 30%.
// Opções no menu (Interface): cameraFollow e cameraShake (front-state.js).
'use strict';

const CameraMotion = (() => {
  const TAU = Math.PI * 2;
  let hold = 0, moveT = 0, ctrl = null, held = false, lastAng = null, zoomMul = 1, appliedZoom = 1, punch = 0, ox = 0, oy = 0, t = 0, lastPX = null, lastPY = null;
  const kicks = [];   // tremores ativos: {a: força, d: duração, age, f: frequência, p1, p2}
  const opts = () => { const s = window.CityFront?.settings || {}; return { follow: s.cameraFollow !== false, shake: (s.cameraShake ?? 0.6) * (s.reducedMotion ? 0.3 : 1) }; };
  // ângulo da câmera que põe a direção `h` (radianos no mundo) apontando p/ o alto da tela
  const angFor = h => Math.atan2(-Math.cos(h), -Math.sin(h));
  const blocked = () => !!(window.CityFront?.blocked || window.cityCharacterEditorOpen || window.CityHomeUI?.active || window.CityJobs?.busy || window.CityUI?.phoneOpen || document.querySelector('dialog[open]'));

  function shake(strength = 0.3, duration = 0.35, withPunch = false) {
    const s = Math.max(0, Math.min(1, strength));
    if (s <= 0.01) return;
    kicks.push({ a: s, d: duration, age: 0, f: 7 + Math.random() * 3, p1: Math.random() * TAU, p2: Math.random() * TAU });
    if (kicks.length > 6) kicks.shift();
    if (withPunch) punch = Math.max(punch, s);
  }

  // antes de cam.update: desfaz o deslocamento/zoom do quadro anterior e ajusta o giro (cam.tang)
  function pre(dt) {
    cam.x -= ox; cam.y -= oy; cam.zoom /= appliedZoom; ox = oy = 0; appliedZoom = 1;
    if (!(dt > 0)) return;
    t += dt;
    const o = opts(), p = typeof player !== 'undefined' ? player : null, V = window.cityVehicles;
    // giro feito pelo jogador desde o último quadro → pausa o acompanhamento
    if (lastAng !== null && Math.abs(angDiff(lastAng, cam.tang)) > 1e-4) hold = 4;
    hold = Math.max(0, hold - dt);
    // trava dos controles a pé: nova ao apertar a tecla de andar; sem tecla, girando na mão ou sem o acompanhamento, segue a câmera
    const keys = typeof input !== 'undefined' && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some(k => input.down(k));
    if (!keys || !held || hold > 0 || !o.follow || V?.driver) ctrl = cam.ang;
    held = keys;
    let target = null, weight = 0, tau = 1, maxRate = 1;
    const indoors = typeof houses !== 'undefined' && houses.some(H => H.inside);
    if (o.follow && !hold && !indoors && !blocked() && p && !p.dead) {
      if (V?.driver && V.car) {
        const sp = V.car.speed || 0;
        if (sp > 2.5) { target = angFor(V.car.angle); weight = Math.min(1, (sp - 2.5) / 7.5); tau = 1.1; maxRate = 1.3; }
      } else if (lastPX !== null && !(p.aimV > 0.15) && !p.homeAction && !p.stairTravel) {
        const dx = p.x - lastPX, dy = p.y - lastPY, v = Math.hypot(dx, dy) / dt;
        moveT = held && v > 1.2 && v < 12 ? moveT + dt : 0;
        if (moveT > 0.5) {
          const h = Math.atan2(dy, dx), diff = Math.abs(angDiff(cam.tang, angFor(h)));
          if (diff < 1.75) { target = angFor(h); weight = Math.min(1, (v - 1.2) / 2.5) * Math.min(1, (moveT - 0.5) / 0.6); tau = 1.6; maxRate = 0.8; }
        }
      }
    }
    if (target !== null) {
      let step = angDiff(cam.tang, target) * (1 - Math.exp(-dt / tau)) * weight;
      step = Math.max(-maxRate * dt, Math.min(maxRate * dt, step));
      cam.tang += step;
    }
    lastAng = cam.tang;
    if (p) { lastPX = p.x; lastPY = p.y; }
    // zoom pela velocidade (só dirigindo)
    const sp = V?.driver ? Math.abs(V.car?.speed || 0) : 0, want = 1 - 0.14 * Math.min(1, Math.max(0, (sp - 8) / 27));
    zoomMul += (want - zoomMul) * (1 - Math.exp(-dt * 1.2));
  }

  // depois de cam.update: aplica tremor e zoom só neste quadro (pre() desfaz no próximo)
  function post(dt) {
    const o = opts();
    let sx = 0, sy = 0;
    for (let i = kicks.length - 1; i >= 0; i--) {
      const k = kicks[i]; k.age += dt || 0;
      const life = 1 - k.age / k.d; if (life <= 0) { kicks.splice(i, 1); continue; }
      const amp = k.a * life * life * 0.35 * o.shake;   // até 35 cm, caindo rápido
      sx += Math.sin(t * k.f * TAU + k.p1) * amp; sy += Math.sin(t * k.f * 0.83 * TAU + k.p2) * amp * 0.8;
    }
    punch = Math.max(0, punch - (dt || 0) * 3.5);
    const z = zoomMul * (1 + 0.045 * punch * punch * o.shake);
    ox = sx; oy = sy; appliedZoom = z;
    cam.x += ox; cam.y += oy; cam.zoom *= appliedZoom;
  }
  // ---------- seguir o jogador a pé ----------
  // O cam.update persegue o alvo com lerp de taxa 6/s: andando, a câmera ficava sempre atrás (v/6 — 0,7 m correndo) e o
  // jogador escorregava p/ a borda, sem ver p/ onde ia. Aqui o alvo ganha um deslocamento na direção do movimento:
  // compensa esse atraso e antecipa ~0,3 s (menos dentro de casa; nada mirando — a mira já desloca — nem dirigindo).
  // A velocidade é suavizada e o deslocamento entra/sai devagar: parar não dá tranco. Pulo grande (teleporte) zera tudo.
  const lead = { vx: 0, vy: 0, x: 0, y: 0, px: null, py: null };
  function followLead(px, py, dt, { aiming = false, indoors = false, driving = false } = {}) {
    if (!(dt > 0)) return [lead.x, lead.y];
    if (lead.px === null || Math.hypot(px - lead.px, py - lead.py) > 20) { Object.assign(lead, { px, py, vx: 0, vy: 0, x: 0, y: 0 }); return [0, 0]; }
    const vx = (px - lead.px) / dt, vy = (py - lead.py) / dt; lead.px = px; lead.py = py;
    const kv = 1 - Math.exp(-dt * 5); lead.vx += (vx - lead.vx) * kv; lead.vy += (vy - lead.vy) * kv;
    const on = opts().follow && !driving && !aiming, v = Math.hypot(lead.vx, lead.vy);
    let tx = 0, ty = 0;
    if (on && v > 0.3) {
      const ahead = 1 / 6 + (indoors ? 0.08 : 0.3), cap = indoors ? 1.2 : 3;
      tx = lead.vx * ahead; ty = lead.vy * ahead; const m = Math.hypot(tx, ty); if (m > cap) { tx *= cap / m; ty *= cap / m; }
    }
    const kl = 1 - Math.exp(-dt * 2.5); lead.x += (tx - lead.x) * kl; lead.y += (ty - lead.y) * kl;
    return [lead.x, lead.y];
  }
  // direção na tela (WASD) -> chão, com o ângulo travado enquanto a tecla de andar segue apertada
  function moveDir(dx, dy) {
    if (ctrl === null) ctrl = cam.ang;
    const c = Math.cos(ctrl), s = Math.sin(ctrl);
    return [c * dx + s * dy, -s * dx + c * dy];
  }
  return { pre, post, shake, moveDir, followLead, get state() { return { hold, zoomMul, kicks: kicks.length, punch, lead: [lead.x, lead.y] }; } };
})();
window.CameraMotion = CameraMotion;
