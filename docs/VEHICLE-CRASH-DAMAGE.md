# Vehicle crash damage, smoke and body crumple — City of God

New damage system for the browser 3D vehicle renderer (2026-10-29).

## Behavior
- Uses the existing oriented vehicle footprint and swept collision detector; no phantom spherical vehicle collisions.
- Impacts below 2.4 m/s cause no damage. Faster crashes remove integrity progressively according to speed, obstacle type and vehicle mass. A short cooldown prevents multiple hits from a bumper resting against a wall.
- Each impact damages a front, rear, left or right section based on crash direction; the last contact and speed are recorded. Actual body mesh vertex positions change in the impacted zone, up to roughly 24cm at the maximum, while tire, glass and lighting geometries are excluded.
- Body geometries are only cloned when damage occurs, never shared back to the original GLB in the cache. Parking and exiting preserves dent levels and damage; a checkpoint preserves the same values.
- Impact sparks/dust are emitted from a pooled Three.js sprite system. As integrity drops below 56%, smoke rises from the hood; worse damage increases the emission rate. The same pooled system supports damaged parked cars.
- Engine acceleration and top speed decrease as integrity falls. Below 8% the motor can no longer start.
- Dashboard shows remaining integrity and critical motor status; collision messages show impact speed in km/h.
- Admin F10 > Vehicles offers a test-only Repair button to restore integrity and original mesh.

## Known limits / next improvements
- This is single-player local durability; future multiplayer damage, anti-cheat and shared persistent vehicle records need a server-authoritative simulation.
- Body crumple relies on mesh name/type. GLBs with bodies merged into glass or unnamed meshes may show only some dents; wheel, glass and beacon meshes are deliberately not distorted.
- Damage is persistent in carried player cars and current local parking records. Unloaded procedural parked cars are recreated by the world generator; server/global-world persistence of NPC damage is future work.
- Not physically simulated fractured glass or detached body pieces: the car retains its original rig and doors. Smoldering smoke is illustrative, not a physically based fire simulation.
- Repairs are admin-only for QA initially; mechanics, towing fees, parts and repair shops will be tied to job systems later.

## Regression and QA
- Run node --test tests/vehicle-damage.test.mjs and node --test tests/*.test.* and npm run build:site.
- Validate in Chrome at low/high speed against wall, fence and parked car; see integrity + smoke + engine breakdown; exit/re-enter, save/reload; repair from Admin and check body mesh recovers; no extra shadows/SpotLights and old vehicles' steering remains intact.
