# Police SUV and emergency sirens — City of God

## New police SUV
The user-supplied original is Lowpoly Generic SUV Police by mk2design, CC BY 4.0.
Source: https://sketchfab.com/3d-models/lowpoly-generic-suv-police-259fc16c23d548ba8d5802c563d8ebdc

Inspection: 4 independent original wheel node groups Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR; separate native red and blue beacon lens meshes, interior; no authored glTF animations, separate doors, hood or trunk.

The optimized GLB maintains real vehicle meshes and textures up to 2048px. Its original flat ground shadow was removed to avoid duplicating the game's real shadow system. Optimized GLB: 2,392,568 bytes, 9,040 actual triangles, five WebP textures.
SHA-256: b746fcdea8c73e03f6b927197b36c55ba536459d5e3e22e675469a4b305f8f7a

## Accurate siren lights
Red lens mesh: Body_Police_Glass_Red_0 (source centroid x=0.393, y=1.705, z=-0.271 m).
Blue lens mesh: Body_Police_Glass_Blue_0 (source centroid x=-0.397, y=1.705, z=-0.271 m).
In the normalized +X-forward vehicle coordinates, measured centers are near
red [-0.259, 1.740, -0.402] and blue [-0.259, 1.740, 0.407].
The code flashes the actual material of these original lens meshes. Native meshes keep their proper shape, independent per-car copies of their materials and no fake overlaid generic lightbars. Only the player's close vehicle emits two cheap non-shadowed local point lights.

Existing Comrade1280 service vehicles have optics merged into larger car meshes. Their light markers are aligned to the actual optical geometry found in the GLB; this is a calibrated overlay until real optics are separated. Original measured anchor pairs have been configured for the police sedan, ambulance, fire truck, tow truck, garbage truck, school bus and service truck. All seven require visual checks after the still-pending Comrade pack upload.

## Wheel animation and controls
The police SUV GLB has four original wheel groups with pivots; no generated replacement wheels are necessary. The front axle steers, all four wheels rotate according to meters travelled, forward/reverse, with approximately 0.379m wheel radius and 2.86m wheelbase. Body/doors/hood/trunk are NOT separated for animation; don't claim these are interactive yet.
L headlights, I high beams, J/K turn signals, U hazards, O emergency siren lights (police cars only when driver and native lightbar present).

## Activate via one GitHub upload
The available GitHub connector can edit source text but cannot transmit the attached binary directly. The new vehicle is registered as a PENDING second police model and is NOT offered as a private car.

1. Download cityofgod-police-suv-2k-webp.glb from this chat.
2. Rename it to police-suv-2k-webp.glb (do not convert or compress it again).
3. Upload to https://github.com/joaopaulony/cityofgod/upload/main/assets/vehicles/incoming as assets/vehicles/incoming/police-suv-2k-webp.glb and commit on main.
4. The install-police-suv GitHub Actions workflow verifies file SHA-256, triangles, four wheels, source/attribution, two native lenses, WebP, runs all regression tests and production build, and commits the active model to assets/vehicles/live/police-suv.glb.
5. Review four camera angles, parking, panel, wheels, color/materials, flashing lights, FPS and NPC/garage behavior before releasing to all players.

The older Comrade service vehicle pack also remains pending installation. Neither new model nor full visual QA can be claimed complete before successful asset upload and tests.
