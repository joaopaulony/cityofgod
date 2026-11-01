// Activate deterministic civic parking bays ONLY when the licensed GLB exists
// in the live catalog. Stations without a compatible model stay empty.
import {getVehicleAssignment} from './vehicle-classification.mjs';

// Buildings and their parking bays already exist in js/civic.js.
// Never spawn a fire truck at a police station or invent a nonexistent firehouse.
export const CIVIC_FLEET_POLICY=Object.freeze({
 police:Object.freeze({department:'police',models:Object.freeze(['police-suv','police-sedan']),count:3}),
 hospital:Object.freeze({department:'health',models:Object.freeze(['ambulance']),count:1}),
 cityhall:Object.freeze({department:'roadside',models:Object.freeze(['service-truck']),count:1}),
 school:Object.freeze({department:'transport',models:Object.freeze(['school-bus']),count:1})
 // military, firehouse, tow depot and sanitation yard: no matching civic buildings yet.
});
function hash(str){
 let n=2166136261;
 for(let i=0;i<str.length;i++)n=Math.imul(n^str.charCodeAt(i),16777619);
 return n>>>0;
}
export function preferredCivicModel(siteKind,siteId,bayIndex,available){
 const policy=CIVIC_FLEET_POLICY[siteKind];
 if(!policy||bayIndex<0||bayIndex>=policy.count)return null;
 const candidates=policy.models.filter(id=>available.has(id)&&
   getVehicleAssignment(id)?.department===policy.department);
 if(!candidates.length)return null;
 // Stable across sector unload/load and independent of frame timing.
 return candidates[(hash(siteId)+bayIndex)%candidates.length];
}
export function syncCivicFleetParking(boxes,activeModels,fleet){
 const available=new Set(activeModels.map(m=>m.id)),byId=new Map(activeModels.map(m=>[m.id,m]));
 let activated=0,hidden=0;
 for(const b of boxes){
  if(!b.civicFleetBay)continue;
  const key=b.vehicleKey;
  if(fleet?.taken.has(key)){
   if(!b.fleetHidden){b.fleetHidden=true;b.solid=false;hidden++;}
   continue;
  }
  const id=preferredCivicModel(b.civicKind,b.civicSiteId,b.civicBayIndex,available);
  if(!id){
   if(!b.fleetHidden){b.fleetHidden=true;b.solid=false;hidden++;}
   continue;
  }
  if(b.modelId===id&&!b.fleetHidden)continue;
  const model=byId.get(id);
  b.modelId=id;b.fleetHidden=false;b.solid=true;
  b.w=model.length||b.w;b.d=model.width||b.d;
  b.h=model.height||b.h;b.col=b.col||'#f0f0f0';
  b.top=b.col;b.side=b.col;
  b.fuel=b.fuel??.75;b.junk=false;b.hazardLights=false;b.emergencyLights=false;
  activated++;
 }
 return {activated,hidden};
}
