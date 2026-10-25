export const STREET_MODELS=['sedan','suv','hatchback','compact','pickup','wagon'];
export const vehicleKey=b=>b.vehicleKey||(b.vehicleKey=`street:${Math.round(b.x*10)}:${Math.round(b.y*10)}`);
export function streetModel(b){
 if(b.modelId)return b.modelId;
 let h=Math.imul(Math.round(b.x*10)*73856093^Math.round(b.y*10)*19349663,2654435761);h=(h^(h>>>15))>>>0;
 return b.modelId=STREET_MODELS[h%STREET_MODELS.length];
}
export class VehicleFleet{
 constructor(){this.taken=new Set();this.saved=new Map();}
 claim(b){const key=vehicleKey(b);this.taken.add(key);this.saved.delete(key);b.fleetHidden=true;b.solid=false;return key;}
 hideOriginal(b){return !b.fleetSaved&&this.taken.has(vehicleKey(b));}
 park(key,data){const b={...data,top:data.col||'#c3c6c9',side:data.col||'#c3c6c9',kind:'parkedcar',vehicleKey:key,fleetSaved:true,solid:true,fleetHidden:false};this.saved.set(key,b);return b;}
 nearest(boxes,x,y,r=3.8){let best=null;for(const b of [...boxes,...this.saved.values()]){if(b.kind!=='parkedcar'||b.fleetHidden||this.hideOriginal(b))continue;const d=Math.hypot(b.x-x,b.y-y);if(d<r){r=d;best=b;}}return best;}
}
