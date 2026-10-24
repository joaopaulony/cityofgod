// ambience-3d.mjs — ambientação na camada WebGL, lida de ENV (env.js):
// • luz do sol / do luar na direção do astro (as sombras giram e esticam com as horas), cor dourada no fim da
//   tarde, azulada no luar; céu (hemisfério) e rebatimento acompanham o dia; sombra mais suave com nuvens e luar
// • vento: folhas secas rodopiando e, na ventania, rajadas de poeira rente ao chão
// • neve: flocos caindo com o vento e neve pousando no alto de plantas, móveis de rua e casas 3D
export function createAmbience(THREE, scene, bridge, L) {
  const col = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
  const hex = h => new THREE.Color().setStyle(h, THREE.SRGBColorSpace);
  const SKY = { day: hex('#f8ead9'), gold: hex('#ffc694'), dusk: hex('#b48cc8'), night: hex('#8592bc') };
  const GND = { day: hex('#343c32'), night: hex('#161a26') };
  const tmp = new THREE.Color(), state = { leaves: 0, dust: 0, snow: 0, patched: 0 };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(1234);

  // ---------- folhas ao vento ----------
  const NL = 200, leafGeo = new THREE.PlaneGeometry(0.08, 0.045);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), NL);
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage); leaves.frustumCulled = false; leaves.castShadow = true; leaves.count = 0; scene.add(leaves);
  const LC = ['#8a6a35', '#a67c3d', '#6f7a34', '#9a5a2a', '#b89a52', '#5f6a2c'].map(hex);
  const lp = new Float32Array(NL * 3), lv = new Float32Array(NL * 3), lr = new Float32Array(NL * 3), ls = new Float32Array(NL * 3);
  for (let i = 0; i < NL; i++) { leaves.setColorAt(i, LC[i % LC.length]); lp[i * 3 + 2] = -1; for (let k = 0; k < 3; k++) { lr[i * 3 + k] = R() * 6.28; ls[i * 3 + k] = (R() - 0.5) * 9; } }
  // ---------- poeira da ventania (faixas compridas e claras rente ao chão) ----------
  const ND = 50, dust = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.18), new THREE.MeshBasicMaterial({ color: hex('#e2d6bd'), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), ND);
  dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dust.frustumCulled = false; dust.count = 0; dust.renderOrder = 2; scene.add(dust);
  const dp = new Float32Array(ND * 4);
  for (let i = 0; i < ND; i++) dp[i * 4 + 2] = -1;
  // ---------- flocos de neve ----------
  const NS = 2600, snowPos = new Float32Array(NS * 3), snowSeed = new Float32Array(NS);
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
  const flake = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const snowMat = new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, map: flake, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff });
  const snow = new THREE.Points(snowGeo, snowMat); snow.frustumCulled = false; snow.renderOrder = 3; snow.visible = false; scene.add(snow);
  let snowInit = false;

  // ---------- neve pousada: o alto dos objetos 3D clareia conforme ENV.snowCover ----------
  const snowU = { snowCover: { value: 0 }, snowUp: { value: new THREE.Vector3(0, 1, 0) } };
  function patch(m) {
    if (m.userData.snowP || m.isShadowMaterial || m.isMeshBasicMaterial || m.isPointsMaterial || m.colorWrite === false || m.transparent || !(m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshStandardMaterial)) return;
    m.userData.snowP = true;
    const kf = m.alphaTest > 0 ? '0.45' : '1.0';   // folhagem recortada (palmeiras): só um pouco de neve
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
    m.onBeforeCompile = (shader, r) => {
      prev && prev.call(m, shader, r);
      Object.assign(shader.uniforms, snowU);
      const inc = ['#include <lights_lambert_fragment>', '#include <lights_phong_fragment>', '#include <lights_physical_fragment>'].find(x => shader.fragmentShader.includes(x)); if (!inc) return;
      shader.fragmentShader = 'uniform float snowCover; uniform vec3 snowUp;\n' + shader.fragmentShader.replace(inc,
        '{ float snUp = dot( normalize( normal ), snowUp ); diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.93, 0.95, 0.98 ), snowCover * ' + kf + ' * smoothstep( 0.2, 0.7, snUp ) ); }\n' + inc);
    };
    m.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : '') + '|snow' + kf;
    m.needsUpdate = true; state.patched++;
  }
  let patchT = 0;

  const v3 = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), M = new THREE.Matrix4();
  let last = performance.now() / 1000;
  return {
    state,
    update(camera) {
      const E = globalThis.ENV; if (!E) return;
      const now = performance.now() / 1000, dt = Math.min(0.1, now - last); last = now;
      const c = bridge.cam, { hemi, sun, bounce } = L;
      // luz principal: sol ou luar, na direção do astro e centrada na vista
      const k = E.key; sun.color.copy(col(E.keyColor[0], E.keyColor[1], E.keyColor[2]));
      sun.intensity = 2.7 * E.keyI * (E.moonLit ? 1.5 : 1);
      sun.position.set(c.x + k[0] * 80, k[2] * 80, c.y + k[1] * 80); sun.target.position.set(c.x, 0, c.y); sun.target.updateMatrixWorld();
      sun.castShadow = E.keyI > 0.03;
      sun.shadow.radius = E.moonLit ? 7 : 1.8 + (1 - ss(13, 62, E.keyEl)) * 2.5 + E.cloud * 5;
      // céu e chão do hemisfério: dia, dourado, crepúsculo, noite
      tmp.copy(SKY.day).lerp(SKY.gold, E.golden * 0.8).lerp(SKY.dusk, E.twilight * 0.7).lerp(SKY.night, ss(0.5, 1, E.dark));
      hemi.color.copy(tmp); hemi.groundColor.copy(GND.day).lerp(GND.night, E.dark);
      hemi.intensity = 1.95 * (0.17 + 0.83 * E.day) * (1 - E.cloud * 0.12);
      bounce.intensity = 0.62 * (0.12 + 0.88 * E.day);
      // sombra no chão: mais fraca com nuvem, mais leve e azulada no luar
      if (L.ground) { L.ground.material.opacity = E.moonLit ? 0.3 : 0.5 * (1 - E.cloud * 0.5) * (0.75 + 0.25 * ss(13, 45, E.keyEl)) * Math.min(1, E.keyI * 1.6); L.ground.material.color.set(E.moonLit ? 0x0a1236 : 0x0c1428); }   // sombra azulada (luz do céu), como de verdade

      // caixa de partículas em volta da vista
      const hw = c.W / (2 * c.zoom) + 6, hh = c.H / (2 * c.zoom) / (c.tilt || 0.5) + 6, rad = Math.hypot(hw, hh);
      const wx = E.windDir[0], wy = E.windDir[1], wn = E.windNow;
      // folhas: aparecem com a brisa, muitas na ventania
      const nl = Math.round(NL * ss(0.22, 0.85, wn) * (1 - E.snow)); state.leaves = nl;
      for (let i = 0; i < nl; i++) {
        const o = i * 3;
        if (lp[o + 2] < -0.5 || Math.hypot(lp[o] - c.x, lp[o + 1] - c.y) > rad + 4) {   // nasce do lado de onde vem o vento
          const a = R() * 6.28, d = R() * rad; lp[o] = c.x + Math.cos(a) * d - wx * rad * 0.6; lp[o + 1] = c.y + Math.sin(a) * d - wy * rad * 0.6; lp[o + 2] = R() * 2.5; lv[o] = lv[o + 1] = lv[o + 2] = 0;
        }
        const sp = 1.5 + wn * 8 + Math.sin(now * 1.7 + i) * 1.2;
        lv[o] += (wx * sp - lv[o]) * dt * 1.5; lv[o + 1] += (wy * sp - lv[o + 1]) * dt * 1.5;
        lv[o + 2] += (-0.6 + (E.gust > 0.45 ? 1.4 : 0) + Math.sin(now * 2.3 + i * 1.7) * 0.6) * dt;
        lv[o + 2] = Math.max(-0.9, Math.min(1.2, lv[o + 2]));
        const ground = lp[o + 2] <= 0.01, slow = ground ? 0.25 : 1;
        lp[o] += lv[o] * dt * slow; lp[o + 1] += lv[o + 1] * dt * slow; lp[o + 2] = Math.max(0.01, lp[o + 2] + lv[o + 2] * dt);
        for (let kk = 0; kk < 3; kk++) lr[o + kk] += ls[o + kk] * dt * (ground ? 0.15 : 1);
        e.set(ground ? -Math.PI / 2 : lr[o], lr[o + 1], ground ? 0 : lr[o + 2]); q.setFromEuler(e); v3.set(lp[o], lp[o + 2], lp[o + 1]); s3.set(1, 1, 1);
        M.compose(v3, q, s3); leaves.setMatrixAt(i, M);
      }
      leaves.count = nl; leaves.instanceMatrix.needsUpdate = true; if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      // poeira: só na ventania, nas rajadas
      const dAlpha = ss(0.6, 1.1, wn) * (1 - E.snow) * E.day; dust.material.opacity = dAlpha * 0.22;
      const nd = dAlpha > 0.01 ? ND : 0; state.dust = nd;
      const ang = Math.atan2(wy, wx);
      for (let i = 0; i < nd; i++) {
        const o = i * 4;
        if (dp[o + 2] < 0 || Math.hypot(dp[o] - c.x, dp[o + 1] - c.y) > rad + 6) { const a = R() * 6.28, d = R() * rad; dp[o] = c.x + Math.cos(a) * d - wx * rad * 0.5; dp[o + 1] = c.y + Math.sin(a) * d - wy * rad * 0.5; dp[o + 2] = 0.05 + R() * 0.5; dp[o + 3] = 2 + R() * 4; }
        const sp = 8 + wn * 10; dp[o] += wx * sp * dt; dp[o + 1] += wy * sp * dt;
        e.set(-Math.PI / 2, 0, -ang); q.setFromEuler(e); v3.set(dp[o], dp[o + 2], dp[o + 1]); s3.set(dp[o + 3], 1, 1); M.compose(v3, q, s3); dust.setMatrixAt(i, M);
      }
      dust.count = nd; dust.instanceMatrix.needsUpdate = true;
      // neve caindo
      const sv = E.snow; snow.visible = sv > 0.02; snowMat.opacity = Math.min(1, sv * 1.1) * (0.55 + 0.45 * E.day + 0.25); state.snow = snow.visible ? NS : 0;
      if (snow.visible) {
        const top = 18;
        if (!snowInit) { snowInit = true; for (let i = 0; i < NS; i++) { snowPos[i * 3] = c.x + (R() - 0.5) * 2 * rad; snowPos[i * 3 + 1] = R() * top; snowPos[i * 3 + 2] = c.y + (R() - 0.5) * 2 * rad; snowSeed[i] = R() * 6.28; } }
        const drift = 0.6 + wn * 4;
        for (let i = 0; i < NS; i++) {
          const o = i * 3, sd = snowSeed[i];
          snowPos[o] += (wx * drift + Math.sin(now * 1.3 + sd) * 0.35) * dt; snowPos[o + 2] += (wy * drift + Math.cos(now * 1.1 + sd) * 0.35) * dt;
          snowPos[o + 1] -= (0.9 + (sd % 1) * 0.6) * dt;
          if (snowPos[o + 1] < 0 || Math.abs(snowPos[o] - c.x) > rad || Math.abs(snowPos[o + 2] - c.y) > rad) { snowPos[o] = c.x + (R() - 0.5) * 2 * rad; snowPos[o + 2] = c.y + (R() - 0.5) * 2 * rad; snowPos[o + 1] = top * (0.6 + R() * 0.4); }
        }
        snowGeo.attributes.position.needsUpdate = true;
      }
      // neve pousada nos objetos 3D (só começa a mexer nos materiais quando neva)
      snowU.snowCover.value = E.snowCover;
      if (E.snowCover > 0.005 || E.snow > 0.05) {
        if ((patchT -= dt) <= 0) { patchT = 1.5; scene.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material)) patch(o.material); }); }
        snowU.snowUp.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
      }
    },
  };
}
