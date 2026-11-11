// urban-ink.mjs — identidade visual "CITY OF GOD — URBAN INK": cartoon 3D com contorno preto.
//
// Um sistema só, central, sem trocar materiais nem assets:
//  1) Toon em faixas: os shaders de iluminação do Three (lambert/phong/standard/physical/toon) ganham, uma vez,
//     um trecho que quantiza a luz difusa em faixas (passos iguais em escala logarítmica: funciona de dia, no fim de
//     tarde e à noite) e recorta o brilho especular num highlight chapado. Tudo controlado por um uniform COMPARTILHADO
//     por referência (inkParams): ligar/desligar e mudar a intensidade nunca recompila shader nem duplica material.
//  2) Contorno em pós-processo: a cena é desenhada numa render target (cor + profundidade) e um único passe de tela
//     cheia acha silhuetas e vincos pela profundidade (ortográfica = metros). Nada de malha duplicada por objeto,
//     instancing/batching intactos. Folhagem (materiais com alphaTest) recebe só a silhueta da copa, nunca folha por
//     folha; pessoas (personagens humanos) não recebem contorno nem toon — o passe as reconhece por uma marca no alpha.
//  3) Cor: saturação/contraste e tone mapping no mesmo passe de tela cheia.
// Desligado, o renderizador volta ao caminho original (renderer.render direto na tela) e os shaders ficam idênticos
// (todos os termos do Urban Ink multiplicam por zero).

export const INK_STORAGE_KEY = 'cityofgod.front.settings.v1';
// presets de qualidade/desempenho do contorno
export const INK_QUALITY = {
  performance: { taps: 4, msaa: 0, scale: 1, foliage: false },
  balanced: { taps: 8, msaa: 4, scale: 1, foliage: true },
  quality: { taps: 8, msaa: 4, scale: 1, foliage: true, fine: true },
};
export const INK_DEFAULTS = Object.freeze({
  ink: true, inkOutline: 0.9, inkThickness: 0.5, inkToon: 0.85, inkSaturation: 0.55, inkContrast: 0.5, inkQuality: 'balanced',
});
const cap = (v, a, b, f) => (Number.isFinite(Number(v)) ? Math.max(a, Math.min(b, Number(v))) : f);
// valores salvos (0–1 nos controles deslizantes) → valores do Urban Ink
export function sanitizeInk(raw = {}) {
  return {
    ink: typeof raw.ink === 'boolean' ? raw.ink : INK_DEFAULTS.ink,
    inkOutline: cap(raw.inkOutline, 0, 1, INK_DEFAULTS.inkOutline),
    inkThickness: cap(raw.inkThickness, 0, 1, INK_DEFAULTS.inkThickness),
    inkToon: cap(raw.inkToon, 0, 1, INK_DEFAULTS.inkToon),
    inkSaturation: cap(raw.inkSaturation, 0, 1, INK_DEFAULTS.inkSaturation),
    inkContrast: cap(raw.inkContrast, 0, 1, INK_DEFAULTS.inkContrast),
    inkQuality: Object.hasOwn(INK_QUALITY, raw.inkQuality) ? raw.inkQuality : INK_DEFAULTS.inkQuality,
  };
}
// controles 0–1 → parâmetros físicos
export function inkParamsFrom(s) {
  const v = sanitizeInk(s);
  return {
    enabled: v.ink,
    outline: v.inkOutline,
    thicknessPx: 1 + v.inkThickness * 2,          // 1–3 px de tela (multiplicado pela densidade de pixels)
    toon: v.inkToon,
    saturation: 1 + v.inkSaturation * 0.4,         // 1,00–1,40
    contrast: 1 + v.inkContrast * 0.16,            // 1,00–1,16
    quality: v.inkQuality,
  };
}

// ---------------------------------------------------------------- shaders
// Valores compartilhados por TODOS os materiais iluminados (objeto simples: o Three copia por referência ao clonar
// uniforms; um Vector4 seria clonado por material).
//  inkParams: x = força do toon (0 desliga), y = faixas por stop de luz, z = viés de mip da textura (menos microdetalhe),
//             w = highlight especular estilizado
//  inkMark:   x = marca de classe no alpha da render target (≤0: não marca; 1 = sólido; 0,75 = pessoa; folhagem = 0,25)
export const INK = { params: { x: 0, y: 1.35, z: 0, w: 0 }, mark: { x: 0, y: 0, z: 0, w: 0 } };
export const INK_CLASS = { foliage: 0.4, human: 0.4, solid: 1 };

const INK_DECL = 'uniform vec4 inkParams;\nuniform vec4 inkMark;\n';
const INK_LIGHT = `
	if ( inkParams.x > 0.0 ) {
		vec3 inkAlb = max( material.diffuseColor, vec3( 0.035 ) );
		vec3 inkIrr = ( reflectedLight.directDiffuse + reflectedLight.indirectDiffuse ) / inkAlb;
		float inkL = max( dot( inkIrr, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-4 );
		float inkX = log2( inkL ) * inkParams.y;
		float inkF = floor( inkX ), inkR = fract( inkX );
		float inkW = clamp( fwidth( inkX ) * 0.6, 0.03, 0.22 );
		float inkQ = exp2( ( inkF + smoothstep( 0.5 - inkW, 0.5 + inkW, inkR ) ) / inkParams.y );
		float inkS = mix( 1.0, inkQ / inkL, inkParams.x );
		reflectedLight.directDiffuse *= inkS; reflectedLight.indirectDiffuse *= inkS;
		float inkSp = max( reflectedLight.directSpecular.r, max( reflectedLight.directSpecular.g, reflectedLight.directSpecular.b ) );
		vec3 inkSpC = reflectedLight.directSpecular / max( inkSp, 1e-4 );
		reflectedLight.directSpecular = mix( reflectedLight.directSpecular, inkSpC * smoothstep( 0.1, 0.16, inkSp ) * 0.55, inkParams.w );
		reflectedLight.indirectSpecular *= 1.0 - 0.45 * inkParams.w;
	}
`;
const INK_MARK = `
	#ifdef OPAQUE
	if ( inkMark.x > 0.0 ) {
		float inkA = inkMark.x;
		#ifdef USE_ALPHATEST
		if ( inkA > 0.9 ) inkA = ${INK_CLASS.foliage.toFixed(2)};
		#endif
		gl_FragColor.a = inkA;
	}
	#endif
`;
let installed = false;
export function installInkShaders(THREE) {
  if (installed) return INK;
  installed = true;
  // menos microdetalhe: a COR da textura vem de um mip mais grosso; o alpha (recorte das folhas) fica intacto
  const mapChunk = THREE.ShaderChunk.map_fragment.replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
    'vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n\tif ( inkParams.z > 0.0 ) sampledDiffuseColor.rgb = texture2D( map, vMapUv, inkParams.z ).rgb;');
  for (const id of ['lambert', 'phong', 'toon', 'standard', 'physical']) {
    const lib = THREE.ShaderLib[id];
    if (!lib || lib.userDataInk) continue;
    let f = lib.fragmentShader;
    if (!f.includes('#include <aomap_fragment>') || !f.includes('#include <dithering_fragment>')) continue;
    f = INK_DECL + f.replace('#include <map_fragment>', mapChunk)
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>' + INK_LIGHT)
      .replace(/#include <dithering_fragment>\s*}\s*$/, '#include <dithering_fragment>' + INK_MARK + '}\n');
    lib.fragmentShader = f;
    lib.uniforms.inkParams = { value: INK.params };
    lib.uniforms.inkMark = { value: INK.mark };
    lib.userDataInk = true;
  }
  return INK;
}

// ---------------------------------------------------------------- pós-processo
const POST_VS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }
`;
const POST_FS = `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uThick, uOutline, uRange, uPx, uSat, uCon, uFoliage, uFine;
uniform vec3 uInk;
varying vec2 vUv;
// classes: 0 vazio (nada opaco gravou profundidade: chão 2D, sombras, fumaça, oclusores invisíveis) ·
// 1 sem traço (pessoa, folhagem e as bordas suavizadas entre elas e o resto) · 3 sólido (alpha 1: transparente
// sobre sólido mantém 1, pois a + 1·(1−a) = 1)
float cls( float a, float d ) { return ( d > 0.99999 || a < 0.12 ) ? 0.0 : a > 0.97 ? 3.0 : 1.0; }
float clsAt( vec2 uv ) { return cls( texture2D( tColor, uv ).a, texture2D( tDepth, uv ).r ); }
// um vizinho: soma p/ o laplaciano (vinco), maior degrau absoluto e o quanto um SÓLIDO está à frente do centro
void tap( vec2 o, float cC, float dC, inout float lapSum, inout float jump, inout float front ) {
	vec2 uv = vUv + o * uTexel;
	float d = texture2D( tDepth, uv ).r, c = cls( texture2D( tColor, uv ).a, d );
	if ( c == 1.0 ) { d = dC; }                           // pessoa e folhagem: nunca criam traço (nem folha a folha)
	else if ( c == 0.0 ) d = 1.0;
	float diff = ( d - dC ) * uRange;
	lapSum += diff; jump = max( jump, abs( diff ) );
	if ( c == 3.0 ) front = max( front, -diff );
}
void main() {
	vec4 col = texture2D( tColor, vUv );
	float dRaw = texture2D( tDepth, vUv ).r;
	float cC = cls( col.a, dRaw );
	float edge = 0.0;
	// pessoas e copas não recebem traço; o resto (sólido ou chão 2D vazio) sim
	if ( ( cC == 0.0 || cC == 3.0 ) && uOutline > 0.0 ) {
		float dC = cC == 0.0 ? 1.0 : dRaw;
		float jump = 0.0, front = 0.0, s = uThick, l1 = 0.0, l2 = 0.0;
		tap( vec2( s, 0.0 ), cC, dC, l1, jump, front ); tap( vec2( -s, 0.0 ), cC, dC, l1, jump, front );
		tap( vec2( 0.0, s ), cC, dC, l2, jump, front ); tap( vec2( 0.0, -s ), cC, dC, l2, jump, front );
		float lap = max( abs( l1 ), abs( l2 ) );
		if ( uFine > 0.5 ) {
			float l3 = 0.0, l4 = 0.0, k = s * 0.7071;
			tap( vec2( k, k ), cC, dC, l3, jump, front ); tap( vec2( -k, -k ), cC, dC, l3, jump, front );
			tap( vec2( k, -k ), cC, dC, l4, jump, front ); tap( vec2( -k, k ), cC, dC, l4, jump, front );
			lap = max( lap, max( abs( l3 ), abs( l4 ) ) );
		}
		// silhueta de um lado só: o traço fica no pixel de TRÁS do degrau (fora do objeto) — objetos finos
		// (troncos, postes, grades) não somem dentro de duas linhas
		float sil = smoothstep( 0.05, 0.14, front );
		// vinco: segunda derivada da profundidade (zero em plano), relativa ao tamanho do pixel no mundo;
		// só onde não há degrau (o degrau já é silhueta)
		float crease = cC == 3.0 ? smoothstep( 0.45, 0.9, lap / max( uPx * s, 1e-5 ) ) * ( 1.0 - smoothstep( 0.05, 0.14, jump ) ) : 0.0;
		edge = max( crease, sil );
	}
	// cor: saturação na luz linear, tone mapping do renderizador, contraste na tela
	vec3 c = col.rgb;
	float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	c = max( mix( vec3( l ), c, uSat ), 0.0 );
	gl_FragColor = vec4( c, 1.0 );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	gl_FragColor.rgb = clamp( ( gl_FragColor.rgb - 0.5 ) * uCon + 0.5, 0.0, 1.0 );
	// vazio mantém o alpha original (sombra no chão, fumaça); o resto é opaco como no estilo original
	float alpha = cC == 0.0 ? min( col.a, 1.0 ) : 1.0;
	edge *= uOutline;
	gl_FragColor = vec4( mix( gl_FragColor.rgb, uInk, edge ), max( alpha, edge ) );
}
`;

export function createUrbanInk(THREE, renderer, scene, camera, opts = {}) {
  installInkShaders(THREE);
  const state = { enabled: false, quality: 'balanced', humans: 0, passes: 0, ms: 0, width: 0, height: 0 };
  let params = inkParamsFrom(opts.settings || INK_DEFAULTS);
  let rt = null, rtKey = '';
  const post = new THREE.ShaderMaterial({
    vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false, transparent: false,
    uniforms: {
      tColor: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() },
      uThick: { value: 1.5 }, uOutline: { value: 1 }, uRange: { value: 1 }, uPx: { value: 0.02 },
      uSat: { value: 1.2 }, uCon: { value: 1.08 }, uFoliage: { value: 1 }, uFine: { value: 0 },
      uInk: { value: new THREE.Color(0x171a20) },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---- pessoas: sem toon e com marca própria (o passe de contorno as ignora)
  const hooked = new WeakSet();
  const saved = { x: 0, z: 0, w: 0, m: 0 };
  function beforeHuman() {
    saved.x = INK.params.x; saved.z = INK.params.z; saved.w = INK.params.w; saved.m = INK.mark.x;
    INK.params.x = 0; INK.params.z = 0; INK.params.w = 0; if (INK.mark.x > 0) INK.mark.x = INK_CLASS.human;
  }
  function afterHuman() { INK.params.x = saved.x; INK.params.z = saved.z; INK.params.w = saved.w; INK.mark.x = saved.m; }
  function hookMesh(o) {
    if (!(o.isMesh || o.isSkinnedMesh || o.isSprite) || hooked.has(o)) return;
    hooked.add(o);
    const pb = o.onBeforeRender, pa = o.onAfterRender, base = THREE.Object3D.prototype;
    o.onBeforeRender = pb === base.onBeforeRender ? beforeHuman : function (...a) { pb.apply(this, a); beforeHuman(); };
    o.onAfterRender = pa === base.onAfterRender ? afterHuman : function (...a) { afterHuman(); pa.apply(this, a); };
  }
  let scanT = 0;
  const knownRoots = new WeakSet();
  function scanHumans() {
    let n = 0; const full = --scanT <= 0; if (full) scanT = 45;
    for (const o of scene.children) {
      if (!o.userData.inkHuman) continue; n++;
      if (full || !knownRoots.has(o)) { knownRoots.add(o); o.traverse(hookMesh); }
    }
    state.humans = n;
  }

  function ensureTarget() {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const q = INK_QUALITY[params.quality] || INK_QUALITY.balanced;
    const samples = renderer.capabilities.isWebGL2 ? q.msaa : 0;
    const key = size.x + 'x' + size.y + ':' + samples;
    if (rt && rtKey === key) return;
    rt?.dispose(); rt?.depthTexture?.dispose();
    const depthTexture = new THREE.DepthTexture(size.x, size.y);
    depthTexture.type = THREE.UnsignedIntType;
    rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples, depthTexture, depthBuffer: true });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    rtKey = key; state.width = size.x; state.height = size.y;
  }

  // os valores compartilhados só valem durante o passe do mundo: fora dele (editor de personagem, miniaturas) zeram
  function arm(on) {
    INK.params.x = on ? params.toon : 0;
    INK.params.z = on ? 0.9 * params.toon : 0;
    INK.params.w = on ? params.toon : 0;
    INK.mark.x = on ? INK_CLASS.solid : 0;
  }
  function applyUniforms() {
    const on = params.enabled;
    arm(false);
    const u = post.uniforms, q = INK_QUALITY[params.quality] || INK_QUALITY.balanced;
    u.uOutline.value = params.outline; u.uSat.value = params.saturation; u.uCon.value = params.contrast;
    u.uFoliage.value = q.foliage ? 1 : 0; u.uFine.value = q.fine || q.taps > 4 ? 1 : 0;
    state.enabled = on; state.quality = params.quality;
  }
  applyUniforms();

  return {
    state,
    get enabled() { return params.enabled; },
    setSettings(s) { params = inkParamsFrom(s); applyUniforms(); },
    params: () => ({ ...params }),
    // desenha um quadro; devolve false quando desligado (o chamador usa o caminho original)
    render() {
      if (!params.enabled) return false;
      const t0 = performance.now();
      scanHumans(); ensureTarget();
      const u = post.uniforms, pr = renderer.getPixelRatio();
      u.uTexel.value.set(1 / rt.width, 1 / rt.height);
      u.uThick.value = Math.max(1, params.thicknessPx * Math.max(1, pr));
      u.uRange.value = camera.far - camera.near;
      // metros por pixel da render target (câmera ortográfica)
      u.uPx.value = (camera.top - camera.bottom) / camera.zoom / rt.height;
      renderer.setRenderTarget(rt);
      arm(true);
      try { renderer.render(scene, camera); } finally { arm(false); renderer.setRenderTarget(null); }
      u.tColor.value = rt.texture; u.tDepth.value = rt.depthTexture;
      renderer.render(postScene, postCam);
      state.passes = 2; state.ms = performance.now() - t0;
      return true;
    },
    dispose() { rt?.dispose(); rt?.depthTexture?.dispose(); post.dispose(); quad.geometry.dispose(); },
  };
}
