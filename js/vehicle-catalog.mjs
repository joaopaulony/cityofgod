// Catálogo auditável de modelos 3D GLB: malhas reais, sem capturas.
export const VEHICLE_MODELS=Object.freeze([
 {id:'silvia',name:'Nissan Silvia S13 (1992)',file:'nissan-silvia-s13.glb',source:'silvia',length:4.47,front:'+Z'},
 {id:'compact',name:'Compacto',file:'compact.glb',source:'passenger',length:3.7,front:'-Z'},
 {id:'coupe',name:'Cupê',file:'coupe.glb',source:'passenger',length:4.5,front:'-Z'},
 {id:'hatchback',name:'Hatchback',file:'hatchback.glb',source:'passenger',length:4.2,front:'-Z'},
 {id:'minivan',name:'Minivan',file:'minivan.glb',source:'passenger',length:4.9,front:'-Z'},
 {id:'offroad',name:'4x4 Off-road',file:'offroad.glb',source:'passenger',length:4.6,front:'-Z'},
 {id:'pickup',name:'Picape',file:'pickup.glb',source:'passenger',length:5.3,front:'-Z'},
 {id:'sedan',name:'Sedã',file:'sedan.glb',source:'passenger',length:4.7,front:'-Z'},
 {id:'sport',name:'Esportivo',file:'sport.glb',source:'passenger',length:4.4,front:'-Z'},
 {id:'suv',name:'SUV',file:'suv.glb',source:'passenger',length:4.7,front:'-Z'},
 {id:'wagon',name:'Perua',file:'wagon.glb',source:'passenger',length:4.75,front:'-Z'}
]);
export const CIVIL_PACK_EXPECTED=Object.freeze([
 {id:'ambulance',name:'Ambulância'},
 {id:'city-bus',name:'Ônibus urbano'},
 {id:'fire-truck',name:'Caminhão de bombeiros'},
 {id:'garbage-truck',name:'Caminhão de lixo'},
 {id:'police-sedan',name:'Viatura policial'},
 {id:'postal-van',name:'Van postal'},
 {id:'school-bus',name:'Ônibus escolar'},
 {id:'service-truck',name:'Caminhão de serviços'},
 {id:'taxi',name:'Táxi'},
 {id:'tow-truck',name:'Guincho'}
]);
export const getVehicleById=id=>VEHICLE_MODELS.find(x=>x.id===id)||null;
