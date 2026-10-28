#!/usr/bin/env python3
"""Extract only the six original, user-supplied Street Crown humans from HTML.

Usage: python3 tools/extract-street-crown.py "street-crown-v01 (1).html"
Writes assets/street-crown/*.glb; never imports the Street Crown car/sounds.
"""
from pathlib import Path
import argparse, base64, json, struct, hashlib

MODELS = ("hero", "partner", "ped_man", "ped_woman", "thug", "boss")
REQUIRED = {"Hips", "Spine", "Head", "LeftArm", "RightArm", "LeftHand", "RightHand"}
MAX_TRIANGLES = 4500
MAX_BYTES = 800_000

def inspect_glb(data):
    if len(data) < 28 or len(data) > MAX_BYTES or data[:4] != b"glTF":
        raise ValueError("Not a size-safe GLB")
    version, length = struct.unpack_from("<II", data, 4)
    if version != 2 or length != len(data): raise ValueError("Invalid glTF2 header")
    size, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A or size > len(data) - 20:
        raise ValueError("Invalid JSON chunk")
    obj = json.loads(data[20:20+size])
    if len(obj.get("skins", [])) != 1 or len(obj["skins"][0]["joints"]) != 24:
        raise ValueError("The six human source GLBs need 24 compatible bones")
    names = {obj["nodes"][i].get("name") for i in obj["skins"][0]["joints"]}
    if not REQUIRED <= names: raise ValueError("Missing key humanoid bone")
    triangles = 0
    for mesh in obj.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if not {"JOINTS_0", "WEIGHTS_0"} <= set(prim.get("attributes", {})):
                raise ValueError("Unskinned character geometry")
            indices = prim.get("indices")
            accessor = obj["accessors"][indices if indices is not None else prim["attributes"]["POSITION"]]
            triangles += accessor["count"]//3
    if not 0 < triangles <= MAX_TRIANGLES:
        raise ValueError(f"Triangle budget exceeded: {triangles}")
    return triangles, len(names)

def extract(path, output, overwrite=False):
    html=Path(path).read_text(encoding="utf-8")
    mark="window.__ASSETS__="
    start=html.find(mark)
    end=html.find(";window.__ORIENT__",start)
    if start<0 or end<0:raise ValueError("Street Crown embedded assets object not found")
    entries=json.loads(html[start+len(mark):end])
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    inventory=[]
    for name in MODELS:
        if name not in entries:raise ValueError("Missing original human "+name)
        raw=base64.b64decode(entries[name],validate=True)
        tris,bones=inspect_glb(raw)
        target=output/(name+".glb")
        if target.exists() and not overwrite:
            if target.read_bytes()!=raw:raise FileExistsError(f"Different file already exists: {target}")
        else:target.write_bytes(raw)
        inventory.append(dict(name=name,file=target.name,bytes=len(raw),triangles=tris,
                              source_bones=bones,sha256=hashlib.sha256(raw).hexdigest()))
    (output/"SOURCE.txt").write_text(
        "Source: Street Crown HTML supplied by the game author. Six characters only.\n"
        "Models remain bound to their original 24 joints; the City of God CAS adds "
        "52 procedural finger joints, but the original model's finger vertices "
        "are not yet rebound to those joints.\n",encoding="utf8"
    )
    print(json.dumps(inventory,ensure_ascii=False,indent=2))
    return inventory
if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("html",help="Path to original Street Crown HTML")
    ap.add_argument("--out",default="assets/street-crown")
    ap.add_argument("--overwrite",action="store_true")
    args=ap.parse_args()
    extract(args.html,args.out,args.overwrite)
