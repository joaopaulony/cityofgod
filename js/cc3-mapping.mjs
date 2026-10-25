// Character Creator 3+/4 rig adapter for City of God.
// Moves licensed optimized glTF bodies with the game's existing 3D joint animation.
// No raw FBX files or third-party textures are stored in the public repository.
export const CC3_BONE_LINKS=Object.freeze([
  ['CC_Base_Hip','pelvis','spine'],
  ['CC_Base_Pelvis','pelvis','spine'],
  ['CC_Base_Waist','pelvis','chest'],
  ['CC_Base_Spine01','spine','chest'],
  ['CC_Base_Spine02','chest','neck'],
  ['CC_Base_NeckTwist01','neck','headPivot'],
  ['CC_Base_Head','headPivot','headTop'],
  ['CC_Base_L_Clavicle','clavL','shL'],
  ['CC_Base_L_Upperarm','shL','elbL'],
  ['CC_Base_L_Forearm','elbL','handL'],
  ['CC_Base_L_Hand','handL','fingerL'],
  ['CC_Base_R_Clavicle','clavR','shR'],
  ['CC_Base_R_Upperarm','shR','elbR'],
  ['CC_Base_R_Forearm','elbR','handR'],
  ['CC_Base_R_Hand','handR','fingerR'],
  ['CC_Base_L_Thigh','hipL','kneeL'],
  ['CC_Base_L_Calf','kneeL','ankL'],
  ['CC_Base_L_Foot','ankL','toeL'],
  ['CC_Base_R_Thigh','hipR','kneeR'],
  ['CC_Base_R_Calf','kneeR','ankR'],
  ['CC_Base_R_Foot','ankR','toeR']
]);
export const CC3_REQUIRED=Object.freeze([
 'CC_Base_Hip','CC_Base_Spine01','CC_Base_Spine02','CC_Base_Head',
 'CC_Base_L_Upperarm','CC_Base_L_Forearm','CC_Base_R_Upperarm','CC_Base_R_Forearm',
 'CC_Base_L_Thigh','CC_Base_L_Calf','CC_Base_R_Thigh','CC_Base_R_Calf'
]);
// Bones in this family often come with secondary twist bones, which are intentionally
// not moved separately: they inherit their transforms to preserve skinning naturally.
export function inspectCC3Bones(names){
 const set=new Set(names);
 const missing=CC3_REQUIRED.filter(name=>!set.has(name));
 const available=CC3_BONE_LINKS.filter(row=>set.has(row[0])).length;
 return {ok:missing.length===0,missing,available,total:CC3_BONE_LINKS.length};
}
