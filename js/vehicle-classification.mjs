// Separation of private civilian cars and future profession vehicles.
// Department registration is NOT an authorization check; jobs need server validation.
const group=(id,title,icon)=>Object.freeze({id,title,icon});
export const FLEET_DEPARTMENTS=Object.freeze([
 group('civil','Veículos civis','🚗'),
 group('police','Polícia','🚓'),
 group('fire','Bombeiros','🚒'),
 group('health','Saúde e resgate','🚑'),
 group('transport','Transporte profissional','🚌'),
 group('roadside','Guincho e assistência','🚛'),
 group('municipal','Serviços municipais','🚚'),
 group('logistics','Correios e entregas','📦')
]);
export const CIVILIAN_VEHICLE_IDS=Object.freeze([
 'silvia','compact','coupe','hatchback','minivan','offroad',
 'pickup','sedan','sport','suv','wagon'
]);
// Job IDs describe future career roles, NOT current CitySim.JOBS entitlements.
export const PROFESSIONAL_VEHICLE_ROLES=Object.freeze({
 'police-sedan':Object.freeze({department:'police',jobId:'police_officer'}),
 'fire-truck':Object.freeze({department:'fire',jobId:'firefighter'}),
 'ambulance':Object.freeze({department:'health',jobId:'paramedic'}),
 'city-bus':Object.freeze({department:'transport',jobId:'city_bus_driver'}),
 'school-bus':Object.freeze({department:'transport',jobId:'school_bus_driver'}),
 'taxi':Object.freeze({department:'transport',jobId:'taxi_driver'}),
 'tow-truck':Object.freeze({department:'roadside',jobId:'tow_operator'}),
 'service-truck':Object.freeze({department:'roadside',jobId:'service_technician'}),
 'garbage-truck':Object.freeze({department:'municipal',jobId:'sanitation_worker'}),
 'postal-van':Object.freeze({department:'logistics',jobId:'postal_worker'})
});
const civilSet=new Set(CIVILIAN_VEHICLE_IDS);
export function getVehicleAssignment(id){
 if(typeof id!=='string')return null;
 if(civilSet.has(id))return {department:'civil',ownership:'private',jobId:null};
 const role=PROFESSIONAL_VEHICLE_ROLES[id];
 return role?{...role,ownership:'employer'}:null;
}
export function buildVehicleDirectory(activeModels=[],pendingModels=[]){
 const activeIds=new Set(activeModels.map(x=>x.id)),byId=new Map();
 for(const cfg of pendingModels)byId.set(cfg.id,cfg);
 for(const cfg of activeModels)byId.set(cfg.id,cfg);
 const groups=new Map(FLEET_DEPARTMENTS.map(g=>[g.id,[]])),unknown=[];
 for(const cfg of byId.values()){
  const rule=getVehicleAssignment(cfg.id);
  if(!rule||!groups.has(rule.department)){unknown.push(cfg.id);continue;}
  const ready=activeIds.has(cfg.id);
  groups.get(rule.department).push(Object.freeze({
   id:cfg.id,name:cfg.name,file:cfg.file,department:rule.department,
   ownership:rule.ownership,jobId:rule.jobId,ready,
   status:ready?'available':'awaiting-assets',
   forSale:rule.department==='civil'&&ready,
   professionEnabled:false // no fake job gating on local-only simulated jobs
  }));
 }
 return Object.freeze({
  groups:Object.freeze(FLEET_DEPARTMENTS.map(g=>Object.freeze({
   ...g,vehicles:Object.freeze(groups.get(g.id))
  }))),
  unknown:Object.freeze(unknown),
  total:byId.size,available:activeIds.size,
  civilian:groups.get('civil').length,
  professional:[...groups].filter(([key])=>key!=='civil')
   .reduce((n,[,models])=>n+models.length,0)
 });
}
