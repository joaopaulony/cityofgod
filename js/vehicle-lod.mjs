// LOD por componente da malha REAL. Não usa blocos, sprites ou outro carro.
export function chooseVehicleLOD(distance){
 return distance<32?'high':distance<65?'medium':'low';
}
export function classifyVehicleDetail(name='',relativeVolume=1){
 // 0: preservar em todos os níveis; 1: cortar só no distante; 2: cortar em médio/longe.
 if(/wheel|tyre|tire|pneu|roda|rim|glass|window|body|chassis|carpaint|main|shell|windshield/i.test(name))return 0;
 if(relativeVolume<0.00045)return 2;
 if(relativeVolume<0.003)return 1;
 return 0;
}
export function trianglesForGeometry(geometry){
 const n=geometry?.index?.count??geometry?.attributes?.position?.count??0;
 return Math.floor(n/3);
}
