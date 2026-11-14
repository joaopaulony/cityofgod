// delivery-3d.mjs — pedidos do Rango deixados na porta (city-food.js): caixa de pizza/sushi ou sacola de papel kraft
// com o logo do Rango, no chão em frente à porta. Some quando o jogador pega (F).
export function createDelivery3D(THREE, scene) {
  const group = new THREE.Group(); group.name = 'delivery-packages'; scene.add(group);
  const meshes = new Map(), state = { packages: 0 };
  // logo do Rango (canvas): círculo laranja com a moto
  function logoTexture(bg, fg) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#e8732a'; g.beginPath(); g.arc(64, 56, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 40px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('R', 64, 58);
    g.fillStyle = fg; g.font = 'bold 20px system-ui'; g.fillText('RANGO', 64, 108);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const kraft = new THREE.MeshStandardMaterial({ color: '#c49a62', roughness: .9 });
  const kraftLogo = new THREE.MeshStandardMaterial({ map: logoTexture('#c49a62', '#5a3a1a'), roughness: .9 });
  const pizzaLid = new THREE.MeshStandardMaterial({ map: logoTexture('#f4efe4', '#b8401e'), roughness: .85 });
  const white = new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: .85 });
  const handle = new THREE.MeshStandardMaterial({ color: '#8a6a40', roughness: .8 });
  function box() {
    // caixa de pizza: quadrada e baixa, tampa com o logo
    const g = new THREE.Group(), w = .44, h = .07;
    const mats = [white, white, pizzaLid, white, white, white];   // +x, -x, +y (tampa), -y, +z, -z
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mats); m.position.y = h / 2; m.castShadow = true; g.add(m);
    return g;
  }
  function bag() {
    // sacola de papel: corpo kraft com o logo na frente, dobra no topo e duas alças
    const g = new THREE.Group(), w = .32, d = .2, h = .36;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [kraft, kraft, kraft, kraft, kraftLogo, kraftLogo]); body.position.y = h / 2; body.castShadow = true; g.add(body);
    const fold = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, .03, d * 1.01), new THREE.MeshStandardMaterial({ color: '#b48a52', roughness: .9 })); fold.position.y = h - .015; g.add(fold);
    for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(.07, .008, 6, 16, Math.PI), handle); t.position.set(0, h, s * d * .3); g.add(t); }
    return g;
  }
  function update() {
    const list = window.CityFood?.packages?.() || [], seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      let m = meshes.get(p.id);
      if (!m) { m = p.kind === 'box' ? box() : bag(); m.userData.kind = p.kind; meshes.set(p.id, m); group.add(m); }
      m.position.set(p.x, 0, p.y); m.rotation.y = -p.a + Math.PI / 2;   // frente (logo) virada para a rua
    }
    for (const [id, m] of meshes) if (!seen.has(id)) { group.remove(m); m.traverse(o => o.geometry?.dispose?.()); meshes.delete(id); }
    state.packages = meshes.size;
  }
  return { update, state };
}
