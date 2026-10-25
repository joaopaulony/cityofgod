import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const DEFAULT_LOOK=Object.freeze({version:1,name:'Alex',skin:'#d79873',hair:'#29202a',eyes:'#568f94',shirt:'#862d46',pants:'#252d42',style:'long',shape:.35,face:1,eyeSize:1});
export function normalizeLook(value={}){
 if(!value||typeof value!=='object')value={};
 const out={...DEFAULT_LOOK};
 for(const k of ['skin','hair','eyes','shirt','pants'])if(/^#[\da-f]{6}$/i.test(value[k]||''))out[k]=value[k];
 if(['long','bob','braids','short'].includes(value.style))out.style=value.style;
 for(const [k,min,max] of [['shape',0,1],['face',.85,1.15],['eyeSize',.85,1.15]])out[k]=Math.max(min,Math.min(max,Number.isFinite(+value[k])?+value[k]:out[k]));
 out.name=String(value.name||out.name).trim().slice(0,24)||'Alex';return out;
}
export function npcLook(i){return normalizeLook({name:'Morador '+(i+1),skin:['#edbd96','#c58a60','#805039','#a66b49'][i%4],hair:['#241c1b','#613d29','#b98b4c'][i%3],shirt:['#245f69','#913c48','#d1a34e','#536b91'][i%4],pants:['#26364e','#433c3d'][i%2],style:['short','bob','braids','long'][i%4],shape:(i%3)/2});}

// Original parametric surface geometry. Only the existing animation skeleton
// is reused; no David/Megan body, face, clothing or texture is rendered.
export function buildCartoon(root,appearance){
 const look=normalizeLook(appearance),old=root.getObjectByName('CityCartoon');
 if(old){old.children[0]?.skeleton?.dispose();old.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});old.removeFromParent();}
 root.updateMatrixWorld(true);
 const bones=[];root.traverse(o=>{if(o.isBone)bones.push(o);else if(o.isMesh)o.visible=false;});
 const byName=new Map();for(const b of bones)if(!byName.has(b.name))byName.set(b.name,b);
 const bone=n=>byName.get('mixamorig'+n);
 const pos=n=>{const b=bone(n);if(!b)throw Error('Cartoon: missing bone '+n);return b.getWorldPosition(new T.Vector3());};
 const index=n=>bones.indexOf(bone(n));
 const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();
 const batch=new Map(),group=new T.Group();group.name='CityCartoon';root.add(group);
 const colors={skin:look.skin,hair:look.hair,eyes:look.eyes,shirt:look.shirt,pants:look.pants,white:'#fff7ed',black:'#171b25',lip:'#aa5359',sole:'#e4d9cc'};
 function add(g,mat,bind,blend){
  const count=g.attributes.position.count,ids=[],weights=[],v=new T.Vector3();
  for(let i=0;i<count;i++){
   v.fromBufferAttribute(g.attributes.position,i);let w=0;
   if(blend){const [a,b]=blend.points,d=b.clone().sub(a);w=T.MathUtils.clamp(v.clone().sub(a).dot(d)/d.lengthSq(),0,1)*blend.weight;}
   ids.push(index(bind),blend?index(blend.to):0,0,0);weights.push(1-w,w,0,0);
  }
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  if(!batch.has(mat))batch.set(mat,[]);batch.get(mat).push(g);
 }
 function ell(center,scale,mat,bind,segments=20){const g=new T.SphereGeometry(1,segments,14);g.scale(...scale);g.translate(...center);add(g,mat,bind);}
 function tube(points,radius,mat,bind){const c=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));add(new T.TubeGeometry(c,18,radius,6,false),mat,bind);}
 function limb(a,b,r1,r2,mat){const start=pos(a),end=pos(b),d=end.clone().sub(start),g=new T.CylinderGeometry(r2,r1,d.length()+.035,16,8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize()));g.translate(...start.clone().add(end).multiplyScalar(.5));add(g,mat,a,{to:b,points:[start,end],weight:.35});ell(start.toArray(),[r1,r1,r1],mat,a,16);}
 const hips=pos('Hips'),chest=pos('Spine2'),neck=pos('Neck'),head=pos('Head');
 // Lathed waist/chest silhouette, continuous surface with smooth skin weights.
 const bottom=hips.y-.10,top=neck.y-.025,span=top-bottom,shape=look.shape;
 const profile=[[0,.13+shape*.035],[.12,.17+shape*.025],[.40,.14-shape*.025],[.65,.19-shape*.01],[.82,.205-shape*.025],[1,.067]];
 const torso=new T.LatheGeometry(profile.map(([h,r])=>new T.Vector2(r,bottom+span*h)),28);torso.scale(1,1,.66);torso.translate(0,0,chest.z);
 add(torso,'shirt','Hips',{to:'Spine2',points:[hips,chest],weight:1});
 ell([hips.x,hips.y-.04,hips.z],[.165+shape*.02,.10,.106],'pants','Hips');
 limb('Neck','Head',.061,.068,'skin');
 for(const side of ['Left','Right']){
  limb(side+'Arm',side+'ForeArm',.065,.045,'skin');limb(side+'ForeArm',side+'Hand',.046,.028,'skin');
  const hand=pos(side+'Hand');limb(side+'Hand',side+'HandMiddle1',.032,.027,'skin');
  // Separate rounded fingers follow the existing animated hand bones.
  for(const finger of ['Thumb','Index','Middle','Ring','Pinky'])if(bone(side+'Hand'+finger+'1')&&bone(side+'Hand'+finger+'2')){limb(side+'Hand'+finger+'1',side+'Hand'+finger+'2',.010,.009,'skin');if(bone(side+'Hand'+finger+'3'))limb(side+'Hand'+finger+'2',side+'Hand'+finger+'3',.009,.007,'skin');}
  limb(side+'UpLeg',side+'Leg',.088+shape*.01,.060,'pants');limb(side+'Leg',side+'Foot',.060,.042,'pants');
  const foot=pos(side+'Foot');ell([foot.x,.065,foot.z+.065],[.065,.060,.135],'black',side+'Foot');ell([foot.x,.025,foot.z+.065],[.068,.018,.137],'sole',side+'Foot');
 }
 const cx=head.x,cy=head.y+.12,cz=head.z+.015,fw=look.face;
 const face=(x,y,z)=>[cx+x,cy+y,cz+z];
 const faceGeo=new T.SphereGeometry(1,40,28),fp=faceGeo.attributes.position;
 for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i),z=fp.getZ(i);const jaw=y<-.15?1-(Math.abs(y)-.15)*.27:1;fp.setXYZ(i,cx+x*.177*fw*jaw,cy+y*.222,cz+z*.157+(z>0&&y<0?.012*Math.sin(-y*Math.PI):0));}faceGeo.computeVertexNormals();add(faceGeo,'skin','Head');
 for(const s of [-1,1]){
  ell(face(s*.174*fw,-.015,0),[.032,.053,.022],'skin','Head');
  ell(face(s*.077*fw,.015,.137),[.054*look.eyeSize,.039*look.eyeSize,.018],'white','Head');
  ell(face(s*.077*fw,.014,.153),[.027,.031,.009],'eyes','Head');
  ell(face(s*.077*fw,.014,.161),[.014,.021,.005],'black','Head');
  ell(face(s*.077*fw-.008,.025,.166),[.008,.009,.003],'white','Head',12);
  tube([face(s*.035,.083,.142),face(s*.073,.096,.147),face(s*.12,.079,.126)],.008,'hair','Head');
  tube([face(s*.027,.036,.156),face(s*.078,.057,.155),face(s*.128,.027,.144)],.004,'hair','Head');
 }
 ell(face(0,-.042,.158),[.022,.027,.022],'skin','Head');
 tube([face(-.047,-.100,.137),face(0,-.106,.151),face(.047,-.100,.137)],.006,'lip','Head');
 // Scalp stops above the face; curved locks provide silhouette and highlights.
 const cap=new T.SphereGeometry(1,28,14,0,Math.PI*2,0,1.30);cap.scale(.183*fw,.229,.167);cap.translate(cx,cy,cz);add(cap,'hair','Head');
 const long=look.style==='long'||look.style==='braids',braid=look.style==='braids';
 const count=braid?22:18;
 for(let i=0;i<count;i++){
  const t=.20+(Math.PI*2-.40)*i/(count-1),x=Math.sin(t)*.17*fw,z=Math.cos(t)*.155;
  // The central frontal opening leaves eyes, cheeks and lips exposed.
  if(z>.10&&Math.abs(x)<.12)continue;
  const len=long?.43:look.style==='short'?.06:.18;
  tube([face(x*.45,.20,z*.45),face(x,.10,z),face(x*1.12,-.07,z),face(x*1.16,-len*.55,z-.025),face(x*.98,-len,z-.04)],braid?.012:.024,'hair','Head');
 }
 for(let i=0;i<5;i++)tube([face(-.12+i*.022,.17,.10),face(-.04+i*.027,.19,.16),face(.10+i*.012,.09,.13)],.023,'hair','Head');
 for(const [mat,geometries] of batch){
  const g=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
  const material=new T.MeshStandardMaterial({color:colors[mat],roughness:mat==='eyes'?.22:mat==='hair'?.48:.78});
  const mesh=new T.SkinnedMesh(g,material);mesh.name='cartoon-'+mat;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);mesh.bind(skeleton,new T.Matrix4());
 }
 return {look,group,triangles:[...group.children].reduce((n,m)=>n+m.geometry.index.count/3,0)};
}
