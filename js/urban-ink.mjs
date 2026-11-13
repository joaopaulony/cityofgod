// urban-ink.mjs — identidade visual "CITY OF GOD — URBAN INK": cartoon 3D limpo, com traço fino e delicado.
//
// Um sistema só, central, sem trocar materiais nem assets:
//  1) Toon em faixas: os shaders de iluminação do Three (lambert/phong/standard/physical/toon) ganham, uma vez,
//     um trecho que quantiza a luz difusa em faixas (passos iguais em escala logarítmica: funciona de dia, no fim de
//     tarde e à noite) e suaviza o brilho especular num highlight chapado. Tudo por um uniform COMPARTILHADO por
//     referência (inkParams): ligar/desligar e mudar a intensidade nunca recompila shader nem duplica material.
//  2) Traço em um único passe de tela cheia: a cena é desenhada numa render target de 8 bits já em cor de tela
//     (tratada como saída final, então o Three usa exatamente os MESMOS programas de shader do estilo original:
//     nada a mais para compilar, metade da memória de uma render target de ponto flutuante) e o passe acha silhuetas
//     pela profundidade (câmera ortográfica = metros). Nada de malha duplicada, instancing/batching intactos.
//     Linha fina (~1 px), tingida pela cor de baixo (não preto chapado) e que some aos poucos quando a câmera afasta.
//     Folhagem: só a silhueta da copa, nunca folha por folha. Pessoas: sem traço e sem toon (marca no alpha).
//  3) Cor: saturação/contraste no mesmo passe.
// Desligado, o renderizador volta ao caminho original (renderer.render direto na tela) e os shaders ficam idênticos
// (todos os termos do Urban Ink multiplicam por zero).

// presets de qualidade/desempenho
//  performance: sem suavização de serrilhado na render target, só silhuetas
//  balanced:    suavização 4×, silhuetas + copas + vincos principais
//  quality:     como balanced, mais as diagonais e as bordas de material (tábuas, azulejos)
export const INK_QUALITY = {
  performance: { msaa: 0, foliage: false, crease: false, color: false, fine: false, ao: 0 },
  balanced: { msaa: 4, foliage: true, crease: true, color: false, fine: false, ao: 1 },
  quality: { msaa: 4, foliage: true, crease: true, color: true, fine: true, ao: 1 },
};
export const INK_DEFAULTS = Object.freeze({
  ink: true, inkOutline: 0.75, inkThickness: 0.2, inkToon: 0.6, inkSaturation: 0.75, inkContrast: 0.5, inkQuality: 'balanced',
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
    thicknessPx: 0.8 + v.inkThickness * 1.2,       // 0,8–2 px de tela (vezes a densidade de pixels); padrão ~1 px
    toon: v.inkToon,
    saturation: -0.2 + v.inkSaturation * 1.0,      // vibração −0,20…+0,80: aviva mais as cores apagadas, pouco as já fortes
    contrast: v.inkContrast * 0.5,                 // curva em S 0…0,5 (sem esmagar sombras nem estourar brancos)
    quality: v.inkQuality,
  };
}

// ---------------------------------------------------------------- shaders
// Valores compartilhados por TODOS os materiais iluminados (objeto simples: o Three copia por referência ao clonar
// uniforms; um Vector4 seria clonado por material).
//  inkParams: x = força do toon (0 desliga), y = faixas por stop de luz, z = viés de mip da textura (menos microdetalhe),
//             w = highlight especular estilizado
//  inkMark:   x = marca de classe no alpha da render target (0 = não marca) · y = quanto é dia (0 noite, 1 dia)
export const INK = { params: { x: 0, y: 1.9, z: 0, w: 0 }, mark: { x: 0, y: 0, z: 0, w: 0 } };
// marcas no alpha (8 bits): sólido 1 · folhagem (alphaTest) 0,85 · pessoa 0,5. Misturas da borda suavizada de uma
// pessoa com o vazio ficam abaixo de 0,5 e nunca parecem folhagem nem sólido.
export const INK_CLASS = { foliage: 0.85, human: 0.5, solid: 1 };

const INK_DECL = 'uniform vec4 inkParams;\nuniform vec4 inkMark;\n';
const INK_LIGHT = `
	// luz em escala log (calculada sempre: derivada fora de condição — o compilador do Windows/ANGLE trava com fwidth
	// dentro de if e cada material demorava a compilar)
	vec3 inkAlb = max( material.diffuseColor, vec3( 0.035 ) );
	vec3 inkIrr = ( reflectedLight.directDiffuse + reflectedLight.indirectDiffuse ) / inkAlb;
	float inkL = max( dot( inkIrr, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-4 );
	float inkX = log2( inkL ) * inkParams.y;
	float inkW = clamp( fwidth( inkX ) * 0.8, 0.12, 0.3 );   // passagem macia entre as faixas
	if ( inkParams.x > 0.0 ) {
		float inkF = floor( inkX ), inkR = fract( inkX );
		float inkQ = exp2( ( inkF + smoothstep( 0.5 - inkW, 0.5 + inkW, inkR ) ) / inkParams.y );
		float inkS = mix( 1.0, inkQ / inkL, inkParams.x );
		reflectedLight.directDiffuse *= inkS; reflectedLight.indirectDiffuse *= inkS;
		float inkSp = max( reflectedLight.directSpecular.r, max( reflectedLight.directSpecular.g, reflectedLight.directSpecular.b ) );
		vec3 inkSpC = reflectedLight.directSpecular / max( inkSp, 1e-4 );
		reflectedLight.directSpecular = mix( reflectedLight.directSpecular, inkSpC * smoothstep( 0.18, 0.45, inkSp ) * 0.6, inkParams.w );
		reflectedLight.indirectSpecular *= 1.0 - 0.45 * inkParams.w;
	}
	if ( inkParams.w > 0.0 ) {
		// luz pintada: a luz do sol puxa p/ o quente e a luz do céu (sombra) p/ o frio, como em ilustração
		reflectedLight.directDiffuse *= mix( vec3( 1.0 ), vec3( 1.05, 1.0, 0.93 ), inkParams.w );
		reflectedLight.indirectDiffuse *= mix( vec3( 1.0 ), vec3( 0.93, 0.98, 1.08 ), inkParams.w );
		// contorno do céu: bordas viradas p/ cima e de lado ganham um fio de luz fria (volume, separa do fundo)
		vec3 inkN = normalize( normal );
		vec3 inkUp = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
		float inkRim = pow( 1.0 - clamp( abs( dot( inkN, geometryViewDir ) ), 0.0, 1.0 ), 3.0 ) * smoothstep( -0.2, 0.6, dot( inkN, inkUp ) );
		float inkDay = mix( 0.12, 1.0, inkMark.y );
		reflectedLight.indirectDiffuse += material.diffuseColor * vec3( 0.62, 0.72, 0.95 ) * inkRim * 0.55 * inkDay * inkParams.w;
		#ifdef STANDARD
		// reflexo estilizado do céu e do chão em superfícies lisas (lataria, vidro, piso encerado): horizonte claro,
		// céu azulado em cima, chão escuro embaixo — sem mapa de ambiente
		vec3 inkRf = reflect( - geometryViewDir, inkN );
		float inkRy = dot( inkRf, inkUp );
		vec3 inkEnv = mix( vec3( 0.2, 0.2, 0.19 ), mix( vec3( 1.0, 0.92, 0.8 ), vec3( 0.58, 0.72, 0.95 ), smoothstep( 0.08, 0.65, inkRy ) ), smoothstep( -0.12, 0.06, inkRy ) );
		float inkGloss = pow( 1.0 - material.roughness, 2.2 );
		float inkFres = 0.25 + 0.75 * pow( 1.0 - clamp( dot( inkN, geometryViewDir ), 0.0, 1.0 ), 4.0 );
		reflectedLight.indirectSpecular += inkEnv * material.specularColorBlended * inkGloss * inkFres * inkDay * 0.9 * inkParams.w;
		#endif
	}
`;
const INK_MARK = `
	#ifdef OPAQUE
	if ( inkMark.x != 0.0 ) {
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

// ---------------------------------------------------------------- passe do traço
const POST_VS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }
`;
// A render target já está em cor de tela (sRGB, tone mapping aplicado): aqui só traço e acerto de cor.
const POST_FS = `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uThick, uOutline, uRange, uPx, uSat, uCon, uFoliage, uCrease, uFine, uColorEdge, uAO, uDay;
uniform mat4 uInvVP;   // câmera: tela -> mundo (reconstrói a posição de cada pixel pela profundidade)
uniform vec3 uInk;
uniform vec4 uSee;    // vegetação vazada (vegetation-3d.mjs): uv.xy do alvo, raio em pixels e profundidade do alvo
uniform vec4 uTune;   // limiares: vinco (início, fim), borda de material (início, fim)
varying vec2 vUv;
// classes: 0 vazio (nada opaco gravou profundidade: chão 2D, sombras, fumaça, oclusores invisíveis) · 1 folhagem ·
// 2 pessoa ou borda suavizada ambígua · 3 sólido (transparente sobre sólido mantém alpha 1: a + 1·(1−a) = 1)
float cls( float a, float d ) {
	if ( d > 0.99999 || a < 0.08 ) return 0.0;
	return a > 0.97 ? 3.0 : ( a > 0.74 && a < 0.93 ) ? 1.0 : 2.0;
}
float clsAt( vec2 uv ) { return cls( texture2D( tColor, uv ).a, texture2D( tDepth, uv ).r ); }
float luma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
vec3 wpos( vec2 uv, float d ) { vec4 p = uInvVP * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 ); return p.xyz / p.w; }
// ponto do chão (altura 0) visto por este pixel — o chão é a tela 2D por baixo, sem profundidade própria
vec3 groundAt( vec2 uv ) { vec3 a = wpos( uv, 0.0 ), b = wpos( uv, 1.0 ); float t = a.y / max( a.y - b.y, 1e-4 ); return mix( a, b, clamp( t, 0.0, 1.0 ) ); }
float hash12( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * 0.1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
// um vizinho: laplaciano (vinco), maior degrau, quanto um SÓLIDO está à frente, folhagem à frente e degrau de cor
void tap( vec2 o, float cC, float dC, float lC, inout float lapSum, inout float jump, inout float front, inout float leaf, inout float leafD, inout float tone ) {
	vec2 uv = vUv + o * uTexel;
	vec4 col = texture2D( tColor, uv );
	float d = texture2D( tDepth, uv ).r, c = cls( col.a, d );
	if ( c == 1.0 && ( cC == 0.0 || ( d - dC ) * uRange < -0.3 ) ) { leaf = 1.0; leafD = min( leafD, d ); }
	if ( c == 1.0 || c == 2.0 ) d = dC;                    // pessoa e folhagem: nunca criam traço (nem folha a folha)
	else if ( c == 0.0 ) d = 1.0;
	float diff = ( d - dC ) * uRange;
	lapSum += diff; jump = max( jump, abs( diff ) );
	if ( c == 3.0 ) {
		front = max( front, -diff );
		if ( abs( diff ) < 0.05 ) tone = max( tone, luma( col.rgb ) - lC );   // vizinho mais claro no mesmo plano
	}
}
// sombra de contato (oclusão de ambiente em espaço de mundo): quanto a geometria em volta tampa o céu deste ponto.
// Escurece a base das paredes, cantos, embaixo de móveis e carros — e o chão 2D em volta de tudo que está nele.
float contact( vec3 P, vec3 N ) {
	float Rw = 0.6, occ = 0.0;
	float Rpx = clamp( Rw / max( uPx, 1e-4 ), 3.0, 42.0 ), rot = hash12( gl_FragCoord.xy ) * 6.2832;
	for ( int i = 0; i < 6; i ++ ) {
		float a = rot + float( i ) * 2.0944 + ( i > 2 ? 1.0472 : 0.0 ), r = Rpx * ( i > 2 ? 1.0 : 0.45 );
		vec2 uv = vUv + vec2( cos( a ), sin( a ) ) * r * uTexel;
		float d = texture2D( tDepth, uv ).r;
		vec3 v = wpos( uv, d ) - P; float L = length( v );
		// sem 'continue' (o compilador do Windows desenrola o laço muito mais rápido): vazio pesa zero
		occ += step( d, 0.99999 ) * max( 0.0, dot( N, v / max( L, 1e-4 ) ) - 0.12 ) * ( 1.0 - smoothstep( 0.2 * Rw, Rw * 1.4, L ) );
	}
	return clamp( occ / 6.0 * 1.9, 0.0, 1.0 );
}
void main() {
	vec4 col = texture2D( tColor, vUv );
	float dRaw = texture2D( tDepth, vUv ).r;
	float cC = cls( col.a, dRaw );
	float edge = 0.0, convex = 0.0;
	// quanto detalhe cabe na tela: de perto, traço inteiro; de longe só as silhuetas, mais leves
	float near = 1.0 - smoothstep( 0.014, 0.045, uPx );
	if ( ( cC == 0.0 || cC == 3.0 ) && uOutline > 0.0 ) {
		float dC = cC == 0.0 ? 1.0 : dRaw, lC = luma( col.rgb );
		float jump = 0.0, front = 0.0, leaf = 0.0, leafD = 1.0, tone = 0.0, s = uThick, l1 = 0.0, l2 = 0.0;
		tap( vec2( s, 0.0 ), cC, dC, lC, l1, jump, front, leaf, leafD, tone ); tap( vec2( -s, 0.0 ), cC, dC, lC, l1, jump, front, leaf, leafD, tone );
		tap( vec2( 0.0, s ), cC, dC, lC, l2, jump, front, leaf, leafD, tone ); tap( vec2( 0.0, -s ), cC, dC, lC, l2, jump, front, leaf, leafD, tone );
		float lap = max( abs( l1 ), abs( l2 ) ), lapS = l1 + l2;
		if ( uFine > 0.5 ) {
			float l3 = 0.0, l4 = 0.0, k = s * 0.7071;
			tap( vec2( k, k ), cC, dC, lC, l3, jump, front, leaf, leafD, tone ); tap( vec2( -k, -k ), cC, dC, lC, l3, jump, front, leaf, leafD, tone );
			tap( vec2( k, -k ), cC, dC, lC, l4, jump, front, leaf, leafD, tone ); tap( vec2( -k, k ), cC, dC, lC, l4, jump, front, leaf, leafD, tone );
			lap = max( lap, max( abs( l3 ), abs( l4 ) ) );
		}
		// silhueta de um lado só: o traço fica no pixel de TRÁS do degrau (fora do objeto), objetos finos preservados
		float sil = smoothstep( 0.05, 0.16, front ) * ( 0.6 + 0.4 * near );
		// vinco (quina de parede, beiral): segunda derivada da profundidade, só onde não há degrau; mais leve que a silhueta
		float flatK = 1.0 - smoothstep( 0.05, 0.14, jump );
		float creaseK = ( cC == 3.0 && uCrease > 0.5 ) ? smoothstep( uTune.x, uTune.y, lap / max( uPx * s, 1e-5 ) ) * flatK * near : 0.0;
		// quina p/ fora (beiral, aresta da parede, tampo): fio de luz como um chanfro pintado; p/ dentro: traço
		convex = lapS > 0.0 ? creaseK : 0.0;
		float crease = lapS > 0.0 ? 0.0 : creaseK * 0.55;
		// borda de material (tábua, azulejo, caixilho): bem suave, só de perto
		float material = ( cC == 3.0 && uColorEdge > 0.5 ) ? smoothstep( uTune.z, uTune.w, tone ) * flatK * 0.35 * near : 0.0;
		edge = max( max( crease, sil ), material );
		// copa: só a silhueta externa. Os furos entre os cartões de folhas têm o anel quase todo de folhas; o pontilhado
		// da vegetação vazada em volta do jogador mantém só uma fração delas, então o limiar acompanha essa fração
		if ( leaf > 0.0 && uFoliage > 0.5 ) {
			float cover = 0.0, R = s * 3.0;
			for ( int i = 0; i < 8; i ++ ) {
				float ang = float( i ) * 0.7854 + 0.39;
				cover += clsAt( vUv + vec2( cos( ang ), sin( ang ) ) * R * uTexel ) == 1.0 ? 1.0 : 0.0;
			}
			float q = length( ( vUv - uSee.xy ) / uTexel ) / max( uSee.z, 1.0 );
			float keep = ( uSee.z > 0.0 && q < 1.0 && leafD < uSee.w ) ? mix( 0.08, 1.0, smoothstep( 0.55, 1.0, q ) ) : 1.0;
			edge = max( edge, ( 1.0 - smoothstep( 4.5 * keep, 6.0 * keep, cover ) ) * smoothstep( 0.3, 0.55, keep ) * ( 0.5 + 0.3 * near ) );
		}
	}
	// cor: saturação e contraste na cor de tela
	vec3 c = col.rgb;
	// vibração: aviva as cores apagadas e poupa as que já são fortes (nada de verde neon nem amarelo gritando)
	float sat = max( c.r, max( c.g, c.b ) ) - min( c.r, min( c.g, c.b ) );
	c = clamp( mix( vec3( luma( c ) ), c, 1.0 + uSat * ( 1.0 - 0.65 * smoothstep( 0.2, 0.75, sat ) ) ), 0.0, 1.0 );
	// curva em S suave e tons de ilustração: sombra levemente fria, luz levemente quente
	c = mix( c, c * c * ( 3.0 - 2.0 * c ), uCon );
	float lum = luma( c );
	c += vec3( -0.012, 0.0, 0.03 ) * ( 1.0 - smoothstep( 0.0, 0.45, lum ) ) + vec3( 0.025, 0.012, -0.02 ) * smoothstep( 0.55, 1.0, lum );
	c = clamp( c, 0.0, 1.0 );
	// ombro suave nos brancos: piso claro e parede ao sol não estouram (interiores)
	c *= 1.0 - 0.13 * smoothstep( 0.72, 1.0, luma( c ) );
	float alpha = cC == 0.0 ? col.a : 1.0;   // vazio mantém o alpha original (sombra no chão, fumaça)
	// área vazada em volta do personagem: sem traço nem sombra de contato nos pontinhos do pontilhado
	float seeK = uSee.z > 0.0 ? smoothstep( 0.8, 1.05, length( ( vUv - uSee.xy ) / uTexel ) / uSee.z ) : 1.0;
	// volume: sombra de contato, quina iluminada e encardido na base das paredes
	if ( uAO > 0.0 && ( cC == 3.0 || cC == 0.0 ) ) {
		vec3 P, N = vec3( 0.0, 1.0, 0.0 );
		if ( cC == 3.0 ) {
			P = wpos( vUv, dRaw );
			vec3 dx = wpos( vUv + vec2( uTexel.x, 0.0 ), texture2D( tDepth, vUv + vec2( uTexel.x, 0.0 ) ).r ) - P;
			vec3 dy = wpos( vUv + vec2( 0.0, uTexel.y ), texture2D( tDepth, vUv + vec2( 0.0, uTexel.y ) ).r ) - P;
			N = normalize( cross( dx, dy ) ); vec3 toCam = normalize( wpos( vUv, 0.0 ) - wpos( vUv, 1.0 ) );
			if ( dot( N, toCam ) < 0.0 ) N = - N;
		} else P = groundAt( vUv );
		float occ = contact( P, N ) * uAO * seeK;
		if ( cC == 3.0 ) {
			c *= 1.0 - 0.42 * occ;
			// encardido: faixa de sujeira suave no pé das paredes (só superfícies em pé, perto do chão)
			float wall = 1.0 - smoothstep( 0.35, 0.6, abs( N.y ) );
			c *= 1.0 - 0.1 * wall * ( 1.0 - smoothstep( 0.02, 0.4, P.y ) ) * uAO;
			// quina p/ fora pega luz (mais forte de dia)
			c = mix( c, min( c * 1.18 + 0.05, vec3( 1.0 ) ), convex * 0.55 * mix( 0.35, 1.0, uDay ) );
		} else if ( occ > 0.0 ) {
			// chão 2D: a sombra de contato é desenhada por cima como uma película escura
			float k = 0.55 * occ;
			c = mix( c, vec3( 0.04, 0.05, 0.08 ), k / max( alpha + k * ( 1.0 - alpha ), 1e-3 ) );
			alpha = alpha + k * ( 1.0 - alpha );
		}
	}
	// halo das luzes à noite (janelas acesas, postes, faróis): brilho suave em volta do que é claro e quente
	if ( uDay < 0.6 && uAO > 0.0 ) {
		float glow = 0.0, Rg = clamp( 0.45 / max( uPx, 1e-4 ), 4.0, 22.0 ), rot = hash12( gl_FragCoord.yx ) * 6.2832;
		for ( int i = 0; i < 6; i ++ ) {
			float a = rot + float( i ) * 1.0472; vec2 uv = vUv + vec2( cos( a ), sin( a ) ) * Rg * ( i > 2 ? 1.0 : 0.5 ) * uTexel;
			vec3 t = texture2D( tColor, uv ).rgb; glow += max( luma( t ) - 0.72, 0.0 ) * ( t.r > t.b ? 1.0 : 0.6 );
		}
		glow = clamp( glow / 6.0 * 3.2, 0.0, 1.0 ) * ( 1.0 - uDay / 0.6 );
		vec3 g = vec3( 1.0, 0.78, 0.48 ) * glow * 0.55;
		c = 1.0 - ( 1.0 - c ) * ( 1.0 - g );   // tela: clareia sem estourar
		if ( cC == 0.0 && glow > 0.0 ) { float k = glow * 0.5; c = mix( c, vec3( 1.0, 0.8, 0.5 ), k / max( alpha + k * ( 1.0 - alpha ), 1e-3 ) * 0.6 ); alpha = alpha + k * ( 1.0 - alpha ); }
	}
	// dentro da área vazada em volta do personagem: sem traço (senão cada pontinho do pontilhado ganha contorno)
	edge *= seeK;
	// traço tingido: escurece a cor de baixo em direção ao tom da tinta, em vez de pintar preto chapado
	vec3 inkC = mix( uInk, c * 0.32, 0.35 );
	edge *= uOutline;
	gl_FragColor = vec4( mix( c, inkC, edge ), max( alpha, edge ) );
}
`;

export function createUrbanInk(THREE, renderer, scene, camera, opts = {}) {
  installInkShaders(THREE);
  const state = { enabled: false, quality: 'balanced', humans: 0, passes: 0, ms: 0, width: 0, height: 0, samples: 0 };
  let params = inkParamsFrom(opts.settings || INK_DEFAULTS);
  let rt = null, rtKey = '';
  const post = new THREE.ShaderMaterial({
    vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false, transparent: false, toneMapped: false,
    uniforms: {
      tColor: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() },
      uThick: { value: 1 }, uOutline: { value: 1 }, uRange: { value: 1 }, uPx: { value: 0.02 },
      uSat: { value: 0.1 }, uCon: { value: 0.2 }, uFoliage: { value: 1 }, uCrease: { value: 1 }, uFine: { value: 0 }, uColorEdge: { value: 0 },
      uSee: { value: new THREE.Vector4(-1, -1, 0, 0) }, uAO: { value: 1 }, uDay: { value: 1 }, uInvVP: { value: new THREE.Matrix4() }, uTune: { value: new THREE.Vector4(0.6, 1.2, 0.1, 0.22) },
      uInk: { value: new THREE.Color() },
    },
  });
  // a cor da tinta é usada direto em cor de tela: #171A20 sem conversão de espaço de cor
  post.uniforms.uInk.value.setRGB(0x17 / 255, 0x1a / 255, 0x20 / 255, THREE.LinearSRGBColorSpace);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---- pessoas: sem toon e com marca própria (o passe do traço as ignora)
  const hooked = new WeakSet();
  const saved = { x: 0, z: 0, w: 0, m: 0 };
  function beforeHuman() {
    saved.x = INK.params.x; saved.z = INK.params.z; saved.w = INK.params.w; saved.m = INK.mark.x;
    INK.params.x = 0; INK.params.z = 0; INK.params.w = 0; if (INK.mark.x !== 0) INK.mark.x = INK_CLASS.human;
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

  const sizeV = new THREE.Vector2();
  function ensureTarget() {
    const size = renderer.getDrawingBufferSize(sizeV);
    const q = INK_QUALITY[params.quality] || INK_QUALITY.balanced;
    const samples = renderer.capabilities.isWebGL2 ? q.msaa : 0;
    const key = size.x + 'x' + size.y + ':' + samples;
    if (rt && rtKey === key) return;
    rt?.dispose(); rt?.depthTexture?.dispose();
    const depthTexture = new THREE.DepthTexture(size.x, size.y);
    depthTexture.type = THREE.UnsignedIntType;
    rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.UnsignedByteType, samples, depthTexture, depthBuffer: true });
    // render target tratada como saída final: tone mapping e sRGB aplicados pelos próprios materiais (mesmos programas
    // do caminho original) e armazenamento linear de 8 bits (sem reconversão)
    rt.isXRRenderTarget = true;
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    rt.texture.internalFormat = 'RGBA8';   // mesmo formato no buffer com MSAA e na textura (senão o resolve falha)
    rtKey = key; state.width = size.x; state.height = size.y; state.samples = samples;
  }

  // os valores compartilhados só valem durante o passe do mundo: fora dele (editor de personagem, miniaturas) zeram
  function arm(on) {
    INK.params.x = on ? params.toon : 0;
    INK.params.z = on ? 1.3 * params.toon : 0;   // mip ~1 nível acima: some o grão fotográfico, ficam cores e juntas
    INK.params.w = on ? params.toon : 0;
    INK.mark.x = on ? INK_CLASS.solid : 0;
  }
  function applyUniforms() {
    arm(false);
    const u = post.uniforms, q = INK_QUALITY[params.quality] || INK_QUALITY.balanced;
    u.uOutline.value = params.outline; u.uSat.value = params.saturation; u.uCon.value = params.contrast;
    u.uAO.value = q.ao; u.uFoliage.value = q.foliage ? 1 : 0; u.uCrease.value = q.crease ? 1 : 0; u.uFine.value = q.fine ? 1 : 0; u.uColorEdge.value = q.color ? 1 : 0;
    state.enabled = params.enabled; state.quality = params.quality;
  }
  applyUniforms();

  const seeV = new THREE.Vector3();
  return {
    state,
    get enabled() { return params.enabled; },
    setSettings(s) { params = inkParamsFrom(s); applyUniforms(); },
    // vegetação vazada em volta de quem a câmera segue (vegetation-3d.mjs): mesmo círculo e mesma profundidade
    // see: {x, y em px do buffer, z profundidade, r raio em px} — o mesmo vazado da vegetação (vegetation-3d.mjs)
    setSeeThrough(see) {
      const u = post.uniforms.uSee.value;
      if (!see || !(see.r > 0) || !rt) { u.set(-1, -1, 0, 0); return; }
      u.set(see.x / rt.width, see.y / rt.height, see.r, see.z);
    },
    params: () => ({ ...params }),
    uniforms: post.uniforms,   // p/ ajuste e depuração no console (cityVehicles.urbanInkPost)
    // desenha um quadro; devolve false quando desligado (o chamador usa o caminho original)
    render() {
      if (!params.enabled) return false;
      const t0 = performance.now();
      scanHumans(); ensureTarget();
      const u = post.uniforms, pr = renderer.getPixelRatio();
      u.uTexel.value.set(1 / rt.width, 1 / rt.height);
      u.uThick.value = params.thicknessPx * Math.max(1, pr);
      u.uRange.value = camera.far - camera.near;
      // metros por pixel da render target (câmera ortográfica)
      u.uPx.value = (camera.top - camera.bottom) / camera.zoom / rt.height;
      camera.updateMatrixWorld(); u.uInvVP.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
      u.uDay.value = INK.mark.y;
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
