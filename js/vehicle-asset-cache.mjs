// Cache compartilhado: carro dirigível e estacionados usam a MESMA descarga de GLB.
// Só solicita um modelo quando ele é realmente necessário.
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const loader=new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const requests=new Map();
const counters={downloads:0,failures:0};
export function loadVehicleGLB(config){
 if(!config?.id||!config.file) return Promise.reject(Error('Invalid vehicle configuration'));
 if(requests.has(config.id))return requests.get(config.id);
 const request=Promise.resolve(MeshoptDecoder.ready)
  .then(()=>{counters.downloads++;return loader.loadAsync('assets/vehicles/live/'+config.file);})
  .catch(err=>{counters.failures++;requests.delete(config.id);throw err;});
 requests.set(config.id,request);
 return request;
}
export function vehicleAssetCacheStats(){
 return {requestedModels:requests.size,downloads:counters.downloads,failures:counters.failures};
}
