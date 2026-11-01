import {Vector2} from 'three';

// Pick rendered geometry, not a loose screen rectangle or the name/bubble sprites.
export function pickSocialActor(raycaster,actors,entries,camera,rect,x,y){
 if(!camera||rect.width<=0||rect.height<=0)return null;
 raycaster.setFromCamera(new Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);
 const candidates=actors.filter(n=>!n.leaving&&entries.get(n)?.root.visible);
 const roots=candidates.map(n=>entries.get(n).root);
 const hit=raycaster.intersectObjects(roots,true).find(h=>(h.object.isSkinnedMesh||h.object.isMesh)&&h.object.visible);
 if(!hit)return null;
 return candidates.find(n=>{let object=hit.object;const root=entries.get(n).root;while(object){if(object===root)return true;object=object.parent;}return false;})||null;
}
