// Shared maps and physical UV scale prevent stretched plaster on taller walls.
const caches=new WeakMap();
export function architecturalTexture(THREE,name,kind){
 let cache=caches.get(THREE);if(!cache){cache=new Map();caches.set(THREE,cache);}
 const key=name+'-'+kind;if(cache.has(key))return cache.get(key);
 const t=new THREE.TextureLoader().load(`assets/textures/architecture/${key}.webp`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(kind==='color')t.colorSpace=THREE.SRGBColorSpace;cache.set(key,t);return t;
}
export function propertyMaterials(THREE,wrap=m=>m){
 const map=(name,kind)=>architecturalTexture(THREE,name,kind);
 const make=(name,roughness)=>wrap(new THREE.MeshStandardMaterial({vertexColors:true,map:map(name,'color'),normalMap:map(name,'normal'),normalScale:new THREE.Vector2(.65,.65),roughnessMap:map(name,'roughness'),roughness,side:THREE.DoubleSide}));
 const standard=opts=>wrap(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,...opts}));
 return {wall:make('plaster',1),stone:make('stone',1),concrete:make('concrete',1),roof:make('roof',1),wood:make('wood',1),tile:make('tile',1),trim:standard(),metal:standard({roughness:.4,metalness:.55}),glass:standard({color:0xb8d3d9,roughness:.18,metalness:.22,side:THREE.DoubleSide})};
}
export function metricUVs(THREE,g){
 const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
  uv[i*2]=(ax>ay&&ax>az?p.getZ(i):p.getX(i))*.5;
  uv[i*2+1]=(ay>ax&&ay>az?p.getZ(i):p.getY(i))*.5;
 }
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}
