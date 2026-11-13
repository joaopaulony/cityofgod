// World-to-screen mapping for existing 3D television/monitor screen surfaces.
// The positions are the real local vertices authored in props-3d.mjs, not
// inferred from the Canvas camera or furniture bounding boxes.
export const MEDIA_SCREEN_FACES=Object.freeze({
 tv:Object.freeze({tl:[-.5,1.18,-.053],tr:[.5,1.18,-.053],
  bl:[-.5,.62,-.053],br:[.5,.62,-.053]}),
 screen:Object.freeze({tl:[-.57,.67,.007],tr:[.57,.67,.007],
  bl:[-.57,.03,.007],br:[.57,.03,.007]})
});

export function projectMediaFace(THREE,kind,instanceMatrix,camera,viewport){
 const face=MEDIA_SCREEN_FACES[kind];
 if(!face||!instanceMatrix||!camera||!viewport?.width||!viewport?.height)return null;
 camera.updateMatrixWorld();
 const center=new THREE.Vector3(0,(face.tl[1]+face.bl[1])*.5,face.tl[2]).applyMatrix4(instanceMatrix);
 // Both models are authored with the glass facing local +Z.
 const front=new THREE.Vector3(0,0,1).transformDirection(instanceMatrix);
 const viewToward=new THREE.Vector3().subVectors(camera.position,center).normalize();
 const facing=front.dot(viewToward);
 if(facing<=.045)return null; // Back of the cabinet or extreme side angle.
 const coords={};
 for(const key of ['tl','tr','bl','br']){
  const world=new THREE.Vector3(...face[key]).applyMatrix4(instanceMatrix);
  const ndc=world.project(camera);
  if(!Number.isFinite(ndc.x)||!Number.isFinite(ndc.y)||ndc.z>1||ndc.z< -1)return null;
  coords[key]={x:viewport.left+(ndc.x+1)*.5*viewport.width,
    y:viewport.top+(1-ndc.y)*.5*viewport.height};
 }
 const width=Math.hypot(coords.tr.x-coords.tl.x,coords.tr.y-coords.tl.y);
 const height=Math.hypot(coords.bl.x-coords.tl.x,coords.bl.y-coords.tl.y);
 const area=Math.abs((coords.tr.x-coords.tl.x)*(coords.bl.y-coords.tl.y)-
                     (coords.tr.y-coords.tl.y)*(coords.bl.x-coords.tl.x));
 if(area<100||width<7||height<7)return null;
 // Reject fully off-screen surfaces; a partly visible screen remains aligned.
 if(Object.values(coords).every(p=>p.x<viewport.left-70)||
    Object.values(coords).every(p=>p.x>viewport.left+viewport.width+70)||
    Object.values(coords).every(p=>p.y<viewport.top-70)||
    Object.values(coords).every(p=>p.y>viewport.top+viewport.height+70))return null;
 return {...coords,facing,width,height,area};
}
