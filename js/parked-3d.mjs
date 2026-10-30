// parked-3d.mjs — carros estacionados (caixas 'parkedcar' das vagas, pátios, postos e garagens) com os mesmos
// modelos GLB dos veículos dirigíveis. Cada modelo carrega uma vez; as instâncias perto da câmera são clones que
// compartilham malhas e materiais (só a pintura da carroceria ganha um material por cor). Enquanto um carro tem
// modelo 3D, o desenho 2D dele é pulado (b.r3d).
import {loadVehicleGLB} from './vehicle-asset-cache.mjs';
import {chooseVehicleLOD,classifyVehicleDetail,trianglesForGeometry} from './vehicle-lod.mjs';
import {VEHICLE_MODELS} from './vehicle-catalog.mjs';
import {getVehicleAssignment} from './vehicle-classification.mjs';
import {createVehicleLights} from './vehicle-lights.mjs';
import {createVehicleDeformation} from './vehicle-deformation.mjs';
import {smokeIntensityForIntegrity,hoodSmokeEmitters} from './vehicle-damage-effects.mjs';
import {streetModel} from './vehicle-fleet.mjs';

const PAINT = /paint|body|carpaint|car_paint|exterior|chassis|main/i;
// SUV vem de fábrica em grafite escuro (sem separar pintura de borracha na textura): fica com a cor original
const KEEP_FACTORY = new Set(['suv','police-suv']);
const preserveFactoryPaint=id=>KEEP_FACTORY.has(id)||getVehicleAssignment(id)?.ownership==='employer';

export function createParked3D(THREE, scene, bridge, damageFX=null) {
  const state={models:0,cars:0,failed:0,loading:0,queued:0,
    high:0,medium:0,low:0,visibleTriangles:0,paint:{}};
  const models=new Map(),live=new Map(),paintCache=new Map();
  const pending=new Set(),failed=new Set(),queued=new Set(),queue=[];
  let inflight=0,tick=0;

  function normalize(root, cfg) {
    // Não modificar materiais compartilhados com o modelo dirigível.
    const materialCopies=new Map(),copy=m=>{
      if(!m)return m;
      if(!materialCopies.has(m))materialCopies.set(m,m.clone());
      return materialCopies.get(m);
    };
    root.traverse(o=>{
      if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
    });
    // carro parado não anima: malhas com esqueleto viram malhas comuns na pose de repouso (clonáveis sem ossos)
    const skinned = []; root.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
    for (const sk of skinned) { const m = new THREE.Mesh(sk.geometry, sk.material); m.name = sk.name; m.position.copy(sk.position); m.quaternion.copy(sk.quaternion); m.scale.copy(sk.scale); sk.parent.add(m); sk.parent.remove(sk); }
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), dim = new THREE.Vector3(), c = new THREE.Vector3(); box.getSize(dim); box.getCenter(c);
    const pos = new THREE.Group(); pos.position.set(-c.x, -box.min.y, -c.z); pos.add(root);
    const sc = new THREE.Group(); sc.scale.setScalar(cfg.length / Math.max(dim.z, dim.x)); sc.add(pos);
    const al = new THREE.Group(); al.rotation.y = cfg.front === '+Z' ? Math.PI / 2 : -Math.PI / 2; al.add(sc);
    // material da pintura: pelo nome, senão o de maior área entre os não-escuros/não-transparentes
    let paint = null, best = 0;
    root.traverse(o => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
      // sem mapa de ambiente na cena: metal puro sairia preto; vira pintura acetinada
      for (const m of [].concat(o.material)) if (m && 'metalness' in m && !m.userData.parkFix) { m.userData.parkFix = 1; m.metalness = Math.min(m.metalness, 0.25); m.metalnessMap = null; m.roughness = Math.min(Math.max(m.roughness, 0.35), 0.6); m.needsUpdate = true; }
      for (const m of [].concat(o.material)) {
        if (!m || m.transparent || !m.color) continue;
        if (PAINT.test(m.name || '')) { paint = paint && PAINT.test(paint.name || '') ? paint : m; continue; }
        if (paint && PAINT.test(paint.name || '')) continue;
        o.geometry.computeBoundingBox(); const s = new THREE.Vector3(); o.geometry.boundingBox.getSize(s);
        const hsl = {}; m.color.getHSL(hsl); const area = (s.x * s.y + s.y * s.z + s.x * s.z) * (hsl.l > 0.12 ? 1 : 0.1);
        if (area > best) { best = area; paint = m; }
      }
    });
    const volume=Math.max(.00001,dim.x*dim.y*dim.z);
    root.traverse(o=>{
      if(!o.isMesh)return;
      const bb=new THREE.Box3().setFromObject(o),v=bb.getSize(new THREE.Vector3());
      let names=o.name||'';
      for(let p=o.parent;p&&p!==root;p=p.parent)names+=' '+(p.name||'');
      o.userData.vehicleDetail=classifyVehicleDetail(names,Math.max(0,v.x*v.y*v.z)/volume);
      o.userData.vehicleTriangles=trianglesForGeometry(o.geometry);
    });
    state.paint[cfg.id] = paint ? paint.name || '(sem nome)' : null;
    if (paint && paint.map && paint.map.image && !preserveFactoryPaint(cfg.id)) paint.map = neutralPaint(paint.map);
    return { tpl: al, paint, width:Math.min(dim.x,dim.z)*(cfg.length/Math.max(dim.z,dim.x)),height:dim.y*(cfg.length/Math.max(dim.z,dim.x)) };
  }
  // a textura da carroceria já vem com a cor de fábrica: os pixels saturados (a pintura) viram cinza claro e a
  // cor de cada carro entra pelo material; cromados, borrachas, faróis e frisos (pouco saturados) ficam como estão
  function neutralPaint(tex) {
    const im = tex.image, N = Math.min(1024, im.width || 1024), c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, N, N); const d = g.getImageData(0, 0, N, N), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const r = a[i], gg = a[i + 1], b = a[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); if (mx - mn < 24) continue; const v = Math.min(255, (0.3 * r + 0.59 * gg + 0.11 * b) * 1.5 + 30); a[i] = a[i + 1] = a[i + 2] = v; }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.anisotropy = 4; return t;
  }
  // Carrega no máximo dois GLBs novos simultaneamente; somente modelos próximos.
  function requestModel(id){
    if(models.has(id)||pending.has(id)||queued.has(id)||failed.has(id))return;
    const cfg=VEHICLE_MODELS.find(v=>v.id===id);if(!cfg)return;
    queued.add(id);queue.push(id);pump();
  }
  function pump(){
    while(inflight<2&&queue.length){
      const id=queue.shift(),cfg=VEHICLE_MODELS.find(v=>v.id===id);
      queued.delete(id);
      if(!cfg||models.has(id)||pending.has(id))continue;
      pending.add(id);inflight++;
      state.loading=inflight;state.queued=queue.length;
      loadVehicleGLB(cfg).then(g=>{
        models.set(id,normalize(g.scene.clone(true),cfg));state.models=models.size;
      }).catch(e=>{
        failed.add(id);state.failed=failed.size;
        // Fallback de carro antigo SOMENTE para os modelos cujo GLB falhou.
        for(const b of bridge.boxes)if(b.kind==='parkedcar'&&streetModel(b)===id)
          b.vehicleModelFailed=true;
        console.warn('Carro estacionado não carregou',id,e);
      }).finally(()=>{
        pending.delete(id);inflight--;
        state.loading=inflight;state.queued=queue.length;pump();
      });
    }
  }
  const h = b => { let k = Math.imul(Math.round(b.x * 10) * 73856093 ^ Math.round(b.y * 10) * 19349663, 2654435761); return (k ^ (k >>> 15)) >>> 0; };
  function make(b) {
    const id=streetModel(b),M=models.get(id);if(!M)return null;
    const obj = M.tpl.clone(true);
    if (M.paint && b.col && !preserveFactoryPaint(id)) {
      const key = id + b.col; let mat = paintCache.get(key);
      if (!mat) { mat = M.paint.clone(); mat.color = new THREE.Color().setStyle(b.junk ? '#7a6a58' : b.col, THREE.SRGBColorSpace); paintCache.set(key, mat); }
      obj.traverse(o => { if (o.isMesh) { if (Array.isArray(o.material)) o.material = o.material.map(m => m === M.paint ? mat : m); else if (o.material === M.paint) o.material = mat; } });
    }
    const cfg=VEHICLE_MODELS.find(v=>v.id===id);
    const damageView=b.damage?.integrity<.999?createVehicleDeformation(THREE,obj,cfg):null;
    damageView?.apply(b.damage);
    const g = new THREE.Group(); g.add(obj); g.position.set(b.x, 0, b.y); g.rotation.y = -b.rot;
    const pieces=[];obj.traverse(o=>{if(o.isMesh)pieces.push(o);});
    scene.add(g);b.r3d=true;
    // Only add meshes to parked cars with lights left switched on; never attach SpotLights.
    const lit=!!(b.headlights||b.hazardLights||b.emergencyLights);
    const lights=lit?createVehicleLights(THREE,g,cfg||{length:b.w||4.7},
     {width:cfg?.width||M.width||b.d||1.9,height:M.height||1.5,parked:true,root:obj}):null;
    return {group:g,obj,damageView,level:null,visibleTriangles:0,lights,pieces};
  }
  return {
    state,
    paintActive(root,b){const id=streetModel(b),M=models.get(id);if(!M?.paint||KEEP_FACTORY.has(id))return;
      const mat=M.paint.clone();if(b.col)mat.color.setStyle(b.junk?'#7a6a58':b.col,THREE.SRGBColorSpace);
      root.traverse(o=>{if(!o.isMesh)return;const replace=m=>m.name===M.paint.name?mat:m;o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);});
    },
    update() {
      if((tick=(tick+1)%12)!==0)return;
      const c=bridge.cam;
      const halfW=c.W/(2*Math.max(1,c.zoom)),halfH=c.H/(2*Math.max(1,c.zoom)*(c.tilt||.5));
      const R=Math.min(160,Math.max(95,Math.hypot(halfW,halfH)+22));
      const want=[];
      for(const b of bridge.boxes)if(b.kind==='parkedcar'&&!b.fleetHidden){
        const d=Math.hypot(b.x-c.x,b.y-c.y);
        if(d<R)want.push([d,b]);
      }
      want.sort((a,b)=>a[0]-b[0]);
      const selected=want.slice(0,64),keep=new Set(selected.map(x=>x[1]));
      for(const [b,entry] of live)if(!keep.has(b)){
        entry.lights?.dispose();entry.damageView?.dispose();scene.remove(entry.group);b.r3d=false;live.delete(b);
      }
      let high=0,medium=0,low=0,visibleTriangles=0,smokingCars=0;
      for(const [distance,b] of selected){
        let entry=live.get(b);
        if(!entry){
          const id=streetModel(b);
          if(!models.has(id)){requestModel(id);continue;}
          entry=make(b);if(!entry)continue;
          live.set(b,entry);
        }
        if(b.damage?.integrity<.999){
         if(!entry.damageView)entry.damageView=createVehicleDeformation(THREE,entry.obj,
          VEHICLE_MODELS.find(v=>v.id===streetModel(b)));
         entry.damageView.apply(b.damage);
         const intensity=smokeIntensityForIntegrity(b.damage.integrity);
         // Prioritize up to four nearby smoking cars to protect low-end GPUs.
         if(intensity>0&&distance<55&&smokingCars<4){
          smokingCars++;
          const outlets=hoodSmokeEmitters(b.x,b.y,b.rot||0,b.w||4.7);
          const height=Math.max(.85,(b.h||1.5)*.81);
          for(let i=0;i<outlets.length;i++)
           damageFX?.smoke('parked:'+String(b.vehicleKey||[b.x,b.y].join(','))+':'+i,
            outlets[i][0],outlets[i][1],intensity,.2,height);
         }
        }
        if(entry.lights)entry.lights.apply({headlights:!!b.headlights,highBeams:!!b.highBeams,
         signal:b.hazardLights?'hazard':'off',emergencyLights:!!b.emergencyLights},
         performance.now()/1000);
        const level=chooseVehicleLOD(distance);
        if(entry.level!==level){
          for(const part of entry.pieces){
            const detail=part.userData.vehicleDetail||0;
            part.visible=level==='high'||(level==='medium'?detail!==2:detail===0);
            part.castShadow=level==='high'&&part.visible;
          }
          entry.level=level;
          entry.visibleTriangles=entry.pieces.reduce((n,m)=>
            n+(m.visible?(m.userData.vehicleTriangles||0):0),0);
        }
        visibleTriangles+=entry.visibleTriangles;
        if(level==='high')high++;else if(level==='medium')medium++;else low++;
      }
      Object.assign(state,{cars:live.size,high,medium,low,visibleTriangles});
    },
  };
}
