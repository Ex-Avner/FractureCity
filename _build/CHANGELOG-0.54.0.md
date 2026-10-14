# 0.54.0 — The Turned: salvage combat

- Fix missing zombie body height and replace competing infected movement/pose layers with one controller.
- Cache bounded obstacle routes; preserve shared collision and floor support.
- Readable attack wind-ups, recovery and hit stun; attacks and new weapons check placed obstacles as well as voxel walls.
- Hand-sized, correctly oriented phones, articulated stride, clothing variety and close-up procedural details.
- Three modeled salvage weapons: parking-meter cleave, chain-stun arc welder, and megaphone knockback cone.
- Four initial pursuers, bounded horde population, kill-chain display and six-kill health/ammo resupply. Existing loadouts are retained; the starting weapons are optional pickups.
- Stop cleans up all siege enemy variants. Personal saves are unchanged.

Validation: zombie combat browser checks cover pursuit, routing, collision, dodging, damage, hand attachment, weapon effects, supplies and cleanup. Shared lifecycle and neighborhood foundation regressions pass.
