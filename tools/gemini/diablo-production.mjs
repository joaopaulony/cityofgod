/**
 * Production prompt catalog for the Diablo pilot.
 * Pure module: enumerating or exporting tasks makes NO Gemini requests.
 * Generated previews are not approved sprites until reviewed individually.
 */
export const DIABLO_DIRECTIONS=Object.freeze([
 'front-left','front','front-right','right',
 'rear-right','rear','rear-left','left'
]);
const VIEW=Object.freeze({
 'front-left':{
  label:'Front-left three-quarter',
  angle:'The nose/front bumper is nearest the lower-left of frame; show the FRONT bumper, windshield and LEFT side. Rear wing is BEHIND the cabin; no red tail lamps at the near/front end.',
  required:['rectangular pop-up headlight covers on FRONT hood','low black grille and amber bumper indicators at FRONT','front-left wheel','rear wing behind passenger cabin'],
  forbidden:['round red tail lamps at nose','rear engine grille on front bonnet']
 },
 front:{
  label:'Exact front',
  angle:'Look directly at the FRONT bumper along the vehicle longitudinal axis; approximately symmetric front fascia and rectangular pop-up headlight covers. Elevated 35-degree orthographic camera. Rear wing can peek behind roof.',
  required:['angular FRONT bumper and air intakes','two closed rectangular pop-up headlight panels','windshield wipers and FRONT windscreen','amber front indicators'],
  forbidden:['four round rear taillights','rear grille pretending to be front fascia','engine exhaust at front']
 },
 'front-right':{
  label:'Front-right three-quarter',
  angle:'The nose/front bumper is nearest the lower-right of frame; show FRONT bumper and RIGHT door. Rear wing behind cabin. This is the opposite side of front-left, not a new model.',
  required:['FRONT nose with closed pop-up headlight covers','front-right wheel','side intake behind RIGHT door','spoiler behind cabin'],
  forbidden:['round red tail lamps at front','spoiler mounted on hood']
 },
 right:{
  label:'Exact right profile',
  angle:'Elevated orthographic RIGHT side profile. FRONT points to the RIGHT of image and REAR points LEFT. Two side wheels lie in a coherent row; right door and right-side intake are visible.',
  required:['long wedge FRONT nose at image RIGHT','rear wing above image LEFT','two realistic, solid, aligned tires','one right door and rear side intake'],
  forbidden:['nose pointing left','front-facing grille dominating the image','rear taillights at right end']
 },
 'rear-right':{
  label:'Rear-right three-quarter',
  angle:'REAR bumper nearest the lower-right foreground, show RIGHT side and red/amber ROUND rear lamps near camera. Front wedge nose is away; spoiler sits at rear near foreground.',
  required:['four round taillight lenses at REAR','broad rear grille and rear engine cover vents','wing mounted at REAR','right-side rear wheel'],
  forbidden:['large front windscreen as main face','rectangular front headlight covers on near bumper','rear wing over front bonnet']
 },
 rear:{
  label:'Exact rear',
  angle:'Look DIRECTLY at REAR bumper along car axis, approximately symmetric. Four round red/amber rear lamps, broad black rear grille, low exhaust and raised rear wing. Camera remains elevated 35 degrees.',
  required:['four ROUND rear taillights with proper housings','rear black grille and dual exhaust area','rear engine vents and large wing','NO front bumper or windshield wipers'],
  forbidden:['rectangular pop-up front headlights','front bumper indicators as taillights','windshield filling front plane']
 },
 'rear-left':{
  label:'Rear-left three-quarter',
  angle:'REAR bumper nearest the lower-left foreground, show LEFT side and ROUND rear taillights. Front wedge nose away in background. Rear spoiler nearest camera.',
  required:['round red/amber rear lamps near lower-left','wing near rear bumper','engine vent deck','left door and rear wheel'],
  forbidden:['front bumper at near end','headlights rendered as taillights','giant front windshield at rear']
 },
 left:{
  label:'Exact left profile',
  angle:'Elevated orthographic LEFT side profile. FRONT points to the LEFT of the image, REAR points RIGHT. Two correctly aligned tires, left-side door and signature intake.',
  required:['low long nose on image LEFT','rear wing at image RIGHT','front and rear wheels fully opaque','one left door and rear vent'],
  forbidden:['nose points to right','four rear taillights on nose']
 }
});
const BASE=[
 'LOCKED IDENTITY: Exactly one clean, unmodified 1990s Lamborghini Diablo coupe, low purple wedge body, fixed wide rear wing, correct pop-up headlamp covers, four round REAR lamp lenses, consistent 5-hole dark gunmetal rims, thick black tires, side vents after the doors and ventilated rear engine cover.',
 'COLOR LOCK: all painted body panels have the SAME original hue family, sampled from the attached identity reference (target showroom purple approximately #704080). Only realistic lighting creates brightness differences. Glass stays blue-gray; tires charcoal; do not recolor these.',
 'EXACT ART STYLE: premium crisp ink-and-paint 2D isometric survival-game sprite, coherent 35-degree elevated ORTHOGRAPHIC camera, soft daylight from upper-left, polished showroom-clear paint, precise panel seams, realistic clean wheels and tread.',
 'NO dirt, rust, dust, grease, mud, scratched paint, damaged or dented panels, added stickers, extra cars, scenery, text, captions, logos, watermarks, ground plane, colored halo, checkerboard baked into pixels, green cast or fake transparent shadows.',
 'HARD REQUIREMENT: copy exact vehicle identity (wheelbase, bumper, wing height and shape, number of vents, wheel type) from the attached APPROVED identity master; only the requested pose or named movable component may change. Do not invent new wheel design.',
 'Fully opaque black tire sidewalls and rims where visible, with correct wheel-arch occlusion, no missing body or wheel pixels. Entire car inside canvas with margins. Perfectly transparent RGBA background preferred; if unavailable use a flat non-car-colored matte suitable for offline masking.',
 'This is ONE viewpoint and ONE vehicle; never produce a multi-view contact sheet.'
].join('\n');
const PARTS=Object.freeze({
 base:{
  group:'base',name:'Complete closed car',
  action:'Render the entire same car, with doors fully closed, front hood closed, rear engine cover closed and all lights OFF. Do not change geometry except the requested camera angle.',
  ref:'approved identity master',method:'single-image-with-reference',priority:'P0'
 },
 'lights-head':{
  group:'lighting',name:'Headlights illumination overlay',
  action:'Using the SAME approved base at the SAME camera pose, show ONLY the correctly placed front low-beam lamps illuminated. All body, wheel, mirror, window and bumper pixels must remain unchanged. Any hidden headlamp is NOT visible. Target for an image-difference overlay, not a new car.',
  ref:'approved base for same direction',method:'edit-existing-image',priority:'P1'
 },
 'lights-brake':{
  group:'lighting',name:'Brake-light illumination overlay',
  action:'Using the SAME approved base at the SAME pose, show ONLY the red rear brake lamps glowing. These are at the REAR, never at the front. No new panels, different car, changed wheels or extra taillights.',
  ref:'approved base for same direction',method:'edit-existing-image',priority:'P1'
 },
 'indicator-left':{
  group:'lighting',name:'Left indicator overlay',
  action:'Using the SAME approved base at the SAME camera pose, illuminate ONLY the PHYSICAL LEFT turn signal amber lamp: front-left indicator and rear-left indicator when visible in this viewpoint. Hidden lamps must remain hidden.',
  ref:'approved base for same direction',method:'edit-existing-image',priority:'P1'
 },
 'indicator-right':{
  group:'lighting',name:'Right indicator overlay',
  action:'Using the SAME approved base at the SAME camera pose, illuminate ONLY the PHYSICAL RIGHT turn signal amber lamp: front-right indicator and rear-right indicator when visible in this viewpoint. Hidden lamps must remain hidden.',
  ref:'approved base for same direction',method:'edit-existing-image',priority:'P1'
 },
 'door-left':{
  group:'moving',name:'Physical left scissor door',
  action:'Using the SAME approved base and pose, only LEFT driver-side Lamborghini-style scissor door changes. Pivot at its FRONT upper hinge. Lift and rotate upward realistically; preserve correct window frame geometry, door thickness and hinge attachment. Remove overlapping closed door pixels carefully while protecting adjacent paint and wheel. RIGHT door always closed.',
  ref:'approved base for same direction',method:'edit-and-manual-cutout',priority:'P2'
 },
 'door-right':{
  group:'moving',name:'Physical right scissor door',
  action:'Using the SAME approved base and pose, only RIGHT passenger scissor door changes. Pivot at its FRONT upper hinge. Raise as a single coherent rigid door with glass and frame intact. LEFT door remains closed. Keep body width, wheelbase and rear wing unchanged.',
  ref:'approved base for same direction',method:'edit-and-manual-cutout',priority:'P2'
 },
 hood:{
  group:'moving',name:'Front storage bonnet',
  action:'Using the SAME approved base and pose, raise ONLY the FRONT luggage-compartment hood, hinged at the correct FRONT-vehicle hinge line. Show appropriate shallow front compartment. FRONT is the side with rectangular pop-up headlight covers, NOT the rear round taillights. Do NOT replace hood with engine cover.',
  ref:'approved base for same direction',method:'edit-and-manual-cutout',priority:'P2'
 },
 'rear-cover':{
  group:'moving',name:'Rear engine cover',
  action:'Using the SAME approved base and pose, lift ONLY the ventilated REAR engine-bay cover, exposing a stylized realistic mid-mounted engine cavity. Keep broad rear wing fixed and four round rear lamps unmoved. The front bonnet must remain completely closed.',
  ref:'approved base for same direction',method:'edit-and-manual-cutout',priority:'P2'
 }
});
export const MASKS=Object.freeze({
 'paint-primary':{
  name:'Editable main paint mask',
  method:'offline-segmentation-not-paid',
  rule:'Create a precise per-view alpha mask for ONLY paintable purple metal. Exclude windows, rims, headlights, tire rubber, dark grille, side vents and shadow. Smooth edges without changing geometry.'
 },
 wheels:{
  name:'Wheel/tyre segmentation for rotation and repair',
  method:'offline-segmentation-not-paid',
  rule:'Per-view mask for wheel assemblies; retain opaque tire and dark rim centers. Map axle and center coordinates for spin effects. Never erase a wheel during segmentation.'
 },
 glass:{
  name:'Window exclusion mask',
  method:'offline-segmentation-not-paid',
  rule:'Protect windows from paint recoloring; glass stays gray-blue with preserved reflections.'
 },
 shadow:{
  name:'Deterministic transparent ground contact shadow',
  method:'canvas-generated-not-paid',
  rule:'Generate a soft black alpha ground shadow in Canvas 2D, NOT green. Align to actual wheel contact points. This shadow is NOT part of paint mask.'
 }
});
const movingFrames=['half','open'];
export const DIABLO_PROJECT=Object.freeze({
 id:'lamborghini_diablo',
 productionVersion:2,
 stage:'PREPRODUCTION_NOT_APPROVED',
 colorMaster:'#704080',
 masterReference:'assets/vehicles/diablo/directions/front-left.png',
 projectCanvas:[768,512],
 camera:'35-degree elevated fixed orthographic; world heading ↔ view lock',
 artifactPolicy:'No paid image calls without explicit confirm_spend; never merge AI image into runtime automatically',
 workflow:'base -> manual orientation/color/alpha QA -> lights -> hinged part edit -> masks and wheel rig -> browser animation QA'
});
function makeTask(id,kind,dir,part,frame,extra={}){
 return {id,kind,direction:dir,part,frame:frame||'closed',
  priority:extra.priority,method:extra.method,
  output:extra.output,reference:extra.reference||'assets/vehicles/diablo/directions/'+dir+'.png',
  status:'PENDING_ART_REVIEW', billable:false,
  dependencies:extra.dependencies||[],
  qa:['front/rear pose','hue match','same wheelbase','fully opaque tyres','no stray alpha holes','aligned ground contact','visual approval']
 };
}
export function catalog(){
 const tasks=[];
 for(const dir of DIABLO_DIRECTIONS){
  tasks.push(makeTask('base__'+dir,'base',dir,'base','closed',{
   priority:'P0',method:'single-image-with-reference',
   output:'assets/vehicles/diablo/v2/base/'+dir+'.png',
   reference:DIABLO_PROJECT.masterReference,dependencies:['approved-master']
  }));
  for(const type of ['lights-head','lights-brake','indicator-left','indicator-right']){
   tasks.push(makeTask(type+'__'+dir,'lighting',dir,type,'on',{
    priority:'P1',method:'edit-existing-image',
    output:'assets/vehicles/diablo/v2/lighting/'+type+'/'+dir+'.png',
    dependencies:['base__'+dir]
   }));
  }
  for(const type of ['door-left','door-right','hood','rear-cover']){
   for(const frame of movingFrames){
    tasks.push(makeTask(type+'__'+frame+'__'+dir,'moving',dir,type,frame,{
     priority:'P2',method:'edit-and-manual-cutout',
     output:'assets/vehicles/diablo/v2/moving/'+type+'/'+frame+'/'+dir+'.png',
     dependencies:['base__'+dir]
    }));
   }
  }
  for(const [part,cfg] of Object.entries(MASKS)){
   tasks.push(makeTask('mask-'+part+'__'+dir,'mask',dir,part,'mask',{
    priority:'P1',method:cfg.method,
    output:'assets/vehicles/diablo/v2/masks/'+part+'/'+dir+'.png',
    dependencies:['base__'+dir]
   }));
  }
 }
 return tasks;
}
export function taskById(id){
 const task=catalog().find(t=>t.id===id);
 if(!task)throw new Error('Diablo production task not found; export the catalog and choose its id');
 return task;
}
export function productionPrompt(task){
 const t=typeof task==='string'?taskById(task):task;
 if(!t||!DIABLO_DIRECTIONS.includes(t.direction))throw new Error('Invalid Diablo production task');
 const view=VIEW[t.direction];
 const spec=PARTS[t.part];
 const mask=MASKS[t.part];
 if(!spec&&!mask)throw new Error('Unknown Diablo component');
 const frameText=t.frame==='half'?'The named hinged part is HALF OPEN (about 45% travel), between the approved closed and fully open keyframes. Match its exact hinge, thickness and interior.':
  t.frame==='open'?'The named hinged part is FULLY OPEN, its hinge/contact points remain anchored and physically plausible.':
  '';
 return [
  'CITY OF GOD / STRICT LAMBORGHINI DIABLO PRODUCTION EDIT',
  'TASK ID: '+t.id,
  'PRODUCTION STAGE: '+t.kind+' / '+t.part+' / '+t.frame,
  BASE,
  'CAMERA LOCK: '+view.label+'. '+view.angle,
  'MUST SHOW: '+view.required.join('; ')+'.',
  'NEVER SHOW: '+view.forbidden.join('; ')+'.',
  'REQUESTED OPERATION: '+(spec?spec.action:mask.rule),
  frameText,
  'SOURCE ASSET: use attached approved image for the SAME car. If no valid source image exists, DO NOT INVENT A NEW CAR; stop production.',
  'OUTPUT CONTRACT: RGB body matches identity master; fully transparent non-car pixels; 768x512 RGBA after normalization with matching pivot (do not assume the generator already produces exact dimensions).',
  'CHECK MANUALLY: correct camera heading, front vs rear, same paint hue under stable light, same spoiler geometry, fully opaque visible tires and rims, no floating wheels, clean edge alpha and no dirty smudges.',
  'NO automated approval based only on high image-count, unique silhouette or raster count.',
  'This is one asset with one consistent perspective, never a new vehicle model.'
 ].filter(Boolean).join('\n\n');
}
export const counts=Object.freeze({
 base:DIABLO_DIRECTIONS.length,
 lighting:DIABLO_DIRECTIONS.length*4,
 moving:DIABLO_DIRECTIONS.length*4*movingFrames.length,
 masks:DIABLO_DIRECTIONS.length*Object.keys(MASKS).length,
 total:DIABLO_DIRECTIONS.length*(1+4+8+Object.keys(MASKS).length)
});
