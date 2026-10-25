#!/usr/bin/env python3
"""Convert the *user-owned* CC3 FBX ZIPs into compact GLB rigs for City of God.

Run inside Blender 4.x, not normal Python:
  blender -b --python tools/convert_cc3_bodies.py -- \
    --female-zip "/path/Blender female.zip" --male-zip "/path/Blender Male.zip" \
    --out "/path/cityofgod/assets/characters/cc3"

This tool never uploads any data. Do not publicly publish the GLBs before
confirming the original model's license permits distributing them in a game.
Movement/reload/combat animations are applied at runtime by js/cc3-rig.mjs.
"""
import argparse
import json
import math
import os
import pathlib
import sys
import tempfile
import zipfile

def arguments():
    params = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--female-zip",required=True)
    parser.add_argument("--male-zip",required=True)
    parser.add_argument("--out",required=True)
    parser.add_argument("--max-texture",type=int,default=1024)
    parser.add_argument("--max-head-texture",type=int,default=2048)
    return parser.parse_args(params)

def safe_extract(z,folder):
    total=0
    for entry in z.infolist():
        p=pathlib.PurePosixPath(entry.filename)
        if p.is_absolute() or ".." in p.parts:
            raise RuntimeError("Unsafe archive member: "+entry.filename)
        total+=entry.file_size
        if total>1500000000:
            raise RuntimeError("ZIP exceeds 1.5 GB unpacked")
    z.extractall(folder)

def reset(bpy):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users==0:bpy.data.meshes.remove(block)

def key_of_image(img):
    return img.name.lower()+" "+img.filepath.lower()

def optimize_image(img,opts):
    # FBX often references 4096 BMP AO/roughness textures; reduce VRAM.
    if img.source not in ('FILE','GENERATED','TILED'):return
    try:
        if not img.has_data and img.source=='FILE':
            img.reload()
        w,h=img.size
        if not w or not h: return
        allowed=opts.max_head_texture if any(x in key_of_image(img) for x in ['head','face','eye']) else opts.max_texture
        if max(w,h)>allowed:
            scale=allowed/max(w,h)
            img.scale(max(1,round(w*scale)),max(1,round(h*scale)))
        # glTF packs images into GLB; use portable PNG instead of uncompressed BMP.
        img.file_format='PNG'
        try:
            img.pack()
        except Exception as error:
            print("[WARN] texture pack",img.name,error)
    except Exception as error:
        print("[WARN] texture",img.name,error)

def choose_armature(bpy):
    rigs=[x for x in bpy.data.objects if x.type=='ARMATURE']
    rigs.sort(key=lambda o:sum(b.name.startswith('CC_Base_') for b in o.data.bones),reverse=True)
    if not rigs or sum(b.name.startswith('CC_Base_') for b in rigs[0].data.bones)<30:
        raise RuntimeError("CC3 armature with CC_Base_ bones was not found")
    return rigs[0]

def has_skin(obj,rig):
    return obj.type=='MESH' and (
        any(m.type=='ARMATURE' and m.object==rig for m in obj.modifiers) or
        (obj.parent==rig and bool(obj.vertex_groups)))

def optimized_body(bpy,sex,fbx,output,opts):
    reset(bpy)
    bpy.ops.import_scene.fbx(filepath=str(fbx),use_anim=False,use_image_search=True,
                             ignore_leaf_bones=True,automatic_bone_orientation=False)
    bpy.context.view_layer.update()
    rig=choose_armature(bpy)
    keep={rig}
    meshes=[]
    for o in list(bpy.data.objects):
        if has_skin(o,rig):
            keep.add(o);meshes.append(o)
    if not meshes:
        raise RuntimeError("No skinned CC_Base meshes found after FBX import")
    for o in list(bpy.data.objects):
        if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
    # Remove the hundreds of blend shapes (facial microposes) in these exports.
    # Those raw shape keys dominate FBX size and aren't used by our skeletal animation.
    for o in meshes:
        if o.data.shape_keys:
            bpy.ops.object.select_all(action='DESELECT')
            o.select_set(True)
            bpy.context.view_layer.objects.active=o
            try:bpy.ops.object.shape_key_remove(all=True)
            except Exception as error:print("[WARN] shape keys",o.name,error)
    # Keep deformation intact; no arbitrary decimation of skinned vertices.
    # Dense meshes are reported so the user can reduce them manually if needed.
    for img in bpy.data.images:optimize_image(img,opts)
    polygons=sum(len(o.data.polygons) for o in meshes)
    tris=sum(sum(max(1,len(p.vertices)-2) for p in o.data.polygons) for o in meshes)
    if tris>100000:print("[WARN] "+sex+" has "+str(tris)+" triangles; consider simplifying further")
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep:o.select_set(True)
    bpy.context.view_layer.objects.active=rig
    filename=sex+'.glb';target=output/filename
    options=dict(filepath=str(target),export_format='GLB',use_selection=True,
                 export_animations=False,export_yup=True,export_apply=False,
                 export_image_format='AUTO',export_normals=True,export_texcoords=True)
    bpy.ops.export_scene.gltf(**options)
    bones={b.name for b in rig.data.bones}
    required={'CC_Base_Hip','CC_Base_Spine01','CC_Base_Spine02','CC_Base_Head',
              'CC_Base_L_Upperarm','CC_Base_R_Upperarm','CC_Base_L_Calf','CC_Base_R_Calf'}
    missing=required-bones
    if missing:raise RuntimeError("Missing bones: "+", ".join(sorted(missing)))
    size=target.stat().st_size
    print(f"[OK] {sex}: {len(meshes)} skinned meshes; {tris} tris; {len(bones)} bones; {size/1048576:.1f} MiB")
    if size>25000000:
        print("[WARN] Web character model >25 MB. Compress textures further before production.")
    return {"sex":sex,"file":filename,"bytes":size,"triangles":tris,"bones":len(bones),
            "source":"CC3 licensed user export","rig":"CC_Base","animationDriver":"procedural-ik"}

def main():
    import bpy
    args=arguments()
    output=pathlib.Path(args.out).resolve()
    output.mkdir(parents=True,exist_ok=True)
    models=[]
    # Separate scenes prevent duplicate armatures, unused images and mixing genders.
    for sex,path in [('female',args.female_zip),('male',args.male_zip)]:
        with tempfile.TemporaryDirectory(prefix='cog-cc3-'+sex+'-') as temp:
            archive=pathlib.Path(path).resolve()
            with zipfile.ZipFile(archive) as z:safe_extract(z,pathlib.Path(temp))
            fbx=pathlib.Path(temp)/'Blender'/'blender.Fbx'
            if not fbx.exists():raise FileNotFoundError(fbx)
            models.append(optimized_body(bpy,sex,fbx,output,args))
    manifest={"provider":"cc3","status":"converted-locally","sourceLicenseVerified":False,
              "models":models}
    with (output/'manifest.json').open('w',encoding='utf8') as f:json.dump(manifest,f,indent=2)
    print("\nExport complete. Verify the asset license before any public deployment.")
    print("Preview locally with ?characters=cc3; default live characters remain unchanged.")
    print("GLB output:",output)

if __name__=='__main__':
    main()
