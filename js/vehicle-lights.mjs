// +X: frente do GLB normalizado; Y: altura; +/-Z: lados.
export const SIGNAL_MODES=Object.freeze(['off','left','right','hazard']);
export function computeVehicleLightState(f={},time=0,beacon='none'){
 const t=Number.isFinite(time)?Math.max(0,time):0,s=SIGNAL_MODES.includes(f.signal)?f.signal:'off';
 const blink=Math.floor(t*3)%2===0,flash=Math.floor(t*6)%2===0,roof=!!f.emergencyLights&&beacon!=='none';
 return {lowBeam:!!f.headlights,highBeam:!!f.headlights&&!!f.highBeams,
  tail:!!f.headlights,brake:!!f.braking,reverse:!!f.reversing,
  left:blink&&(s==='left'||s==='hazard'),right:blink&&(s==='right'||s==='hazard'),
  beaconLeft:roof&&flash,beaconRight:roof&&!flash,beaconMode:beacon};
}
export function vehicleLightPositions(cfg={},width=1.9,height=1.5){
 const len=Math.max(2,cfg.length||4.6),w=Math.max(1.1,Math.min(3.5,width)),h=Math.max(.9,Math.min(4.5,height));
 const x=len*.478,z=w*.375,y=Math.min(h*.57,1.25),ry=Math.min(h*.53,1.2);
 return {frontLeft:[x,y,-z],frontRight:[x,y,z],rearLeft:[-x,ry,-z],rearRight:[-x,ry,z],
  roofLeft:[0,h+.055,-w*.18],roofRight:[0,h+.055,w*.18]};
}
export function createVehicleLights(THREE,body,cfg={},opts={}){
 const group=new THREE.Group();group.name='vehicle-light-fixtures';body.add(group);
 const pos=vehicleLightPositions(cfg,opts.width,opts.height),geo=new THREE.BoxGeometry(.052,.12,.19),
  barGeo=new THREE.BoxGeometry(.22,.075,.26),lamps={},materials=[];
 function lamp(name,p,g=geo){
  const mat=new THREE.MeshBasicMaterial({color:0x151515,toneMapped:false});
  const m=new THREE.Mesh(g,mat);m.name='lamp-'+name;m.position.set(...p);m.castShadow=false;
  group.add(m);materials.push(mat);lamps[name]=m;
 }
 for(const side of ['Left','Right']){
  for(const end of ['front','rear']){
   const p=pos[end+side];lamp(end+'Main'+side,p);
   lamp(end+'Turn'+side,[p[0]+(end==='front'?.01:-.01),p[1]-.15,p[2]]);
  }
  const p=pos['rear'+side];lamp('rearReverse'+side,[p[0]-.01,p[1]-.15,p[2]]);
 }
 const beacon=['red-blue','red','amber'].includes(cfg.beacon)?cfg.beacon:'none';
 if(beacon!=='none'){lamp('beaconLeft',pos.roofLeft,barGeo);lamp('beaconRight',pos.roofRight,barGeo);}
 const spots=[];
 if(!opts.parked)for(const side of ['Left','Right']){
  const p=pos['front'+side],s=new THREE.SpotLight(0xfff6df,0,22,Math.PI/7,.55,1.4);
  s.position.set(...p);s.target.position.set(p[0]+11,Math.max(.04,p[1]-.63),p[2]*1.3);
  group.add(s,s.target);spots.push(s);
 }
 function set(name,on,off,lit){
  const m=lamps[name];if(!m)return;
  const color=on?lit:off;
  if(m.userData.last!==color){m.material.color.setHex(color);m.userData.last=color;}
 }
 let state=null;
 return {lamps,beacon,group,
  apply(flags={},seconds=0){
   state=computeVehicleLightState(flags,seconds,beacon);
   for(const side of ['Left','Right']){
    set('frontMain'+side,state.lowBeam,0x343536,state.highBeam?0xfaffff:0xffeed0);
    set('rearMain'+side,state.brake||state.tail,0x491414,state.brake?0xff2020:0x9b2222);
    set('rearReverse'+side,state.reverse,0x323332,0xe9f5ff);
    set('frontTurn'+side,state[side.toLowerCase()],0x4c3413,0xffb021);
    set('rearTurn'+side,state[side.toLowerCase()],0x4c3413,0xffa619);
   }
   if(beacon!=='none'){
    set('beaconLeft',state.beaconLeft,beacon==='amber'?0x573611:0x531a1a,beacon==='amber'?0xffa621:0xff2424);
    set('beaconRight',state.beaconRight,beacon==='amber'?0x573611:beacon==='red-blue'?0x122947:0x531a1a,
     beacon==='red-blue'?0x247dff:beacon==='amber'?0xffa621:0xff2828);
   }
   for(const spot of spots){spot.intensity=state.lowBeam?(state.highBeam?18:9):0;
    spot.distance=state.highBeam?34:21;spot.angle=state.highBeam?Math.PI/9:Math.PI/7;}
   return state;
  },
  get state(){return state;},
  dispose(){body.remove(group);geo.dispose();barGeo.dispose();for(const m of materials)m.dispose();}
 };
}
