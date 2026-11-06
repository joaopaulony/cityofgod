// Carrega .gltf/.glb com o GLTFLoader do three.js dentro do Node (sem DOM): os packs da Quaternius não têm
// texturas, só buffers. Os .gltf (buffers em base64) passam antes pelo gltf-transform e viram .glb na memória,
// porque o FileLoader do three usa ProgressEvent, que o Node não tem.
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {NodeIO} from '@gltf-transform/core';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

export async function loadGLTF(file){
 let data=fs.readFileSync(file);
 if(!file.toLowerCase().endsWith('.glb')){const io=new NodeIO();data=Buffer.from(await io.writeBinary(await io.read(file)));}
 const body=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
 await MeshoptDecoder.ready;
 return new Promise((resolve,reject)=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(body,'',resolve,reject));
}
export {THREE};
