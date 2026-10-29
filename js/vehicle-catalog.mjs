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
 {id:'wagon',name:'Perua',file:'wagon.glb',source:'passenger',length:4.75,front:'-Z'},
 // CIVIL_PACK_ASSETS_START — filled by npm run import:civil after verified GLBs exist.
 // CIVIL_PACK_ASSETS_END
]);
// Assets copyright Comrade1280, CC BY 4.0. These are pending until original GLBs are installed.
export const CIVIL_PACK_SOURCE='https://sketchfab.com/3d-models/generic-civil-service-vehicles-pack-8ff2a13f30914932a70c7950cfa58465';
export const CIVIL_PACK_AUTHOR='Comrade1280';
export const CIVIL_PACK_EXPECTED=Object.freeze([
 {id:'ambulance',name:'Ambulância',file:'civil-ambulance.glb',length:6.896,width:2.59,height:2.574,beacon:'red-blue',category:'emergency',sourceTriangles:9404},
 {id:'city-bus',name:'Ônibus urbano',file:'civil-city-bus.glb',length:9.951,width:2.535,height:2.516,beacon:'none',category:'transit',sourceTriangles:9062},
 {id:'fire-truck',name:'Caminhão de bombeiros',file:'civil-fire-truck.glb',length:8.354,width:2.59,height:2.933,beacon:'red',category:'emergency',sourceTriangles:12110},
 {id:'garbage-truck',name:'Caminhão de lixo',file:'civil-garbage-truck.glb',length:7.653,width:2.618,height:2.831,beacon:'amber',category:'utility',sourceTriangles:12747},
 {id:'police-sedan',name:'Viatura policial',file:'civil-police-sedan.glb',length:5.172,width:1.999,height:1.878,beacon:'red-blue',category:'emergency',sourceTriangles:8454},
 {id:'postal-van',name:'Van postal',file:'civil-postal-van.glb',length:5.343,width:2.186,height:1.978,beacon:'none',category:'utility',sourceTriangles:6031},
 {id:'school-bus',name:'Ônibus escolar',file:'civil-school-bus.glb',length:7.908,width:2.552,height:2.67,beacon:'amber',category:'transit',sourceTriangles:11472},
 {id:'service-truck',name:'Caminhão de serviços',file:'civil-service-truck.glb',length:5.274,width:2.234,height:2.194,beacon:'amber',category:'utility',sourceTriangles:8216},
 {id:'taxi',name:'Táxi',file:'civil-taxi.glb',length:5.085,width:1.999,height:1.504,beacon:'none',category:'taxi',sourceTriangles:7306},
 {id:'tow-truck',name:'Guincho',file:'civil-tow-truck.glb',length:6.941,width:2.376,height:2.394,beacon:'amber',category:'utility',sourceTriangles:7955},
].map(x=>Object.freeze({...x,source:'civil',front:'-Z'})));
export const getCivilVehicleById=id=>CIVIL_PACK_EXPECTED.find(x=>x.id===id)||null;
export const getVehicleById=id=>VEHICLE_MODELS.find(x=>x.id===id)||null;
