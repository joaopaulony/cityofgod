#!/usr/bin/env python3
"""Strip human GLBs to BONE/ANIMATION data only; discard body/clothes/face/textures.

Keep all glTF node transforms, bones, skin joint maps, inverse bind matrices and
keyframe samplers. Repack only bufferViews referenced by those samplers and IBM.
No mesh, material, vertex buffer or texture data is copied to the output.
"""
import json,struct,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
PAIRS={
 'player.glb':'player.rig.glb',
 'ana.glb':'ana.rig.glb',
 'lucas.glb':'lucas.rig.glb',
 'mixamo/david.glb':'mixamo/david.rig.glb',
 'mixamo/megan.glb':'mixamo/megan.rig.glb',
 'tomb/male.glb':'tomb/male.rig.glb',
 'tomb/female.glb':'tomb/female.rig.glb',
 'reborn/male.glb':'reborn/male.rig.glb',
 'reborn/female.glb':'reborn/female.rig.glb',
 'reborn/walk.glb':'reborn/walk.rig.glb',
 'reborn/run.glb':'reborn/run.rig.glb',
 'reborn/jump.glb':'reborn/jump.rig.glb',
}
def load_glb(path):
 data=path.read_bytes()
 if data[:4]!=b'glTF' or struct.unpack_from('<I',data,8)[0]!=len(data):
  raise ValueError(f'Invalid GLB {path}')
 off=12;js=None;binpart=b''
 while off<len(data):
  size,tag=struct.unpack_from('<I4s',data,off);off+=8
  chunk=data[off:off+size];off+=size
  if tag==b'JSON':js=json.loads(chunk)
  elif tag==b'BIN\x00':binpart=chunk
 if js is None:raise ValueError(f'No JSON {path}')
 return js,binpart
def convert(src,dst):
 old,binary=load_glb(src)
 if not old.get('animations') and not old.get('skins'):
  raise ValueError(f'No bone/animation content at {src}')
 result={k:old[k] for k in ('asset','scene','scenes','nodes','skins','animations') if k in old}
 # Remove visual components from every node, leave hierarchy/bind pose.
 result['nodes']=[{k:v for k,v in node.items() if k not in ('mesh','skin','weights','camera','extensions','extras')}
                  for node in old['nodes']]
 if 'asset' not in result:result['asset']={'version':'2.0'}
 result['asset']=dict(result['asset'])
 result['asset']['generator']='City of God bone/animation-only reset'
 new_bytes=bytearray()
 new_views=[]
 new_accessors=[]
 views={}
 accessors={}
 def view(ref):
  if ref in views:return views[ref]
  srcview=old['bufferViews'][ref]
  if 'extensions' in srcview:raise ValueError('Compressed bufferViews not supported: '+str(srcview['extensions']))
  if srcview.get('buffer',0)!=0:raise ValueError('External buffer not supported')
  begin=srcview.get('byteOffset',0)
  end=begin+srcview['byteLength']
  if end>len(binary):raise ValueError('Bad bufferView range')
  while len(new_bytes)%4:new_bytes.append(0)
  off=len(new_bytes);new_bytes.extend(binary[begin:end])
  out={k:v for k,v in srcview.items() if k in ('byteLength','byteStride','name')}
  out.update(buffer=0,byteOffset=off)
  views[ref]=len(new_views);new_views.append(out)
  return views[ref]
 def accessor(ref):
  if ref in accessors:return accessors[ref]
  a=dict(old['accessors'][ref])
  if 'bufferView' in a:a['bufferView']=view(a['bufferView'])
  if 'sparse' in a:
   a['sparse']=dict(a['sparse'])
   for key in ('indices','values'):
    v=dict(a['sparse'][key])
    v['bufferView']=view(v['bufferView'])
    a['sparse'][key]=v
  if 'extensions' in a:raise ValueError('Unsupported accessor extension')
  accessors[ref]=len(new_accessors);new_accessors.append(a)
  return accessors[ref]
 for anim in result.get('animations',[]):
  for sampler in anim['samplers']:
   sampler['input']=accessor(sampler['input'])
   sampler['output']=accessor(sampler['output'])
 for skin in result.get('skins',[]):
  if 'inverseBindMatrices' in skin:
   skin['inverseBindMatrices']=accessor(skin['inverseBindMatrices'])
 while len(new_bytes)%4:new_bytes.append(0)
 result['accessors']=new_accessors
 result['bufferViews']=new_views
 result['buffers']=[{'byteLength':len(new_bytes)}]
 payload=json.dumps(result,separators=(',',':'),ensure_ascii=False).encode('utf8')
 while len(payload)%4:payload+=b' '
 glb=b'glTF'+struct.pack('<II',2,12+8+len(payload)+8+len(new_bytes))
 glb+=struct.pack('<I4s',len(payload),b'JSON')+payload
 glb+=struct.pack('<I4s',len(new_bytes),b'BIN\x00')+new_bytes
 dst.parent.mkdir(parents=True,exist_ok=True)
 dst.write_bytes(glb)
 check,checkbin=load_glb(dst)
 if any(k in check for k in ('meshes','materials','textures','images','samplers')):
  raise ValueError('Visual data leaked')
 if len(checkbin)!=len(new_bytes):raise ValueError('Invalid repack')
 if len(check.get('animations',[]))!=len(old.get('animations',[])):
  raise ValueError('Animation lost')
 print(f'RIG ONLY: {src.relative_to(ROOT)} {len(binary):,}b input -> {len(new_bytes):,}b keyframe/IBM data, {len(check.get("animations",[]))} clips, {len(check.get("skins",[]))} skeletons')
if __name__=='__main__':
 base=ROOT/'assets/characters'
 for source,dest in PAIRS.items():
  convert(base/source,base/'rigs'/dest)
