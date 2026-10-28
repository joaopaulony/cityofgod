#!/usr/bin/env python3
"""Release gate: no human bodies, faces, hair or textures may ship with CAS."""
from pathlib import Path
import json,struct
root=Path(__file__).resolve().parents[1]
assets=root/'assets/characters'
expected={
 'ana.rig.glb','lucas.rig.glb','player.rig.glb',
 'mixamo/david.rig.glb','mixamo/megan.rig.glb',
 'reborn/male.rig.glb','reborn/female.rig.glb','reborn/walk.rig.glb',
 'reborn/run.rig.glb','reborn/jump.rig.glb',
 'tomb/male.rig.glb','tomb/female.rig.glb'
}
rigs=assets/'rigs'
found={str(p.relative_to(rigs)) for p in rigs.rglob('*.glb')}
assert found==expected, f'Inconsistent archive: missing {expected-found}, extras {found-expected}'
for file in rigs.rglob('*.glb'):
 data=file.read_bytes()
 assert data[:4]==b'glTF',file
 assert len(data)==struct.unpack_from('<I',data,8)[0],file
 length=struct.unpack_from('<I',data,12)[0]
 doc=json.loads(data[20:20+length])
 assert not set(doc)&{'meshes','materials','textures','images','samplers'},file
 assert doc.get('skins') and doc.get('nodes'),file
 assert not any('mesh' in n for n in doc['nodes']),file
 assert doc.get('animations') or '/tomb/' in str(file),file
# Any non-rigged human mesh, atlas texture, or encoded archive is a failure.
for file in assets.rglob('*'):
 if not file.is_file() or rigs in file.parents:continue
 assert file.name in {'LICENSE.txt','CREDITS.txt','manifest.json'},f'Human visual survived: {file}'
 if file.name=='manifest.json':
  doc=json.loads(file.read_text(encoding='utf8'))
  assert not doc.get('models') and not doc.get('styles'),f'Old human catalog {file}'
assert not (root/'third_party/cityofgod_cas_corpo_feminino_21_cabelos.zip').exists()
assert not (root/'js/npc-population.js').exists()
print(f'Human reset PASS: {len(found)} animation/rig-only archives, zero body meshes, zero human textures')
