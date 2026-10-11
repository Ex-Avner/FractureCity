# Fracture City 0.53.0

## Shared character and neighborhood foundation

Street residents, shop residents, enemies, quest actors and studio visitors now use shared grounding and lifecycle checks. Walking animation follows actual displacement, turns blend smoothly, and boot clearance reduces feet clipping into floors. Existing wall collision, dead-body removal and supported-sign placement fixes are retained.

The studio has a saved Open Gallery / Listening Room choice. Physical neighborhood signs carry that choice through Makers’ Mile and the news district. Visitors leave observations based on the room’s materials and displayed work. The opening choices have clearer consequences and leave a corresponding notice at FCN.

Distant skyline geometry is batched. A controlled same-seed Chrome comparison measured 17–22% fewer draw calls across walking, skating, interiors, building and combat. Frame times remained around 33 ms; this is not a measured frame-rate increase. Batching also increases submitted triangles because culling is less granular.

## Accumulated source updates

This release also records the previously uncommitted creator tools, interior construction, art collection, in-world social gallery, mobile controls, character styling, outbreak and story expansions, backroom app, and social-server support. Generated deployment archives and device-local profiles, drafts and saves are excluded from this source commit.

## Validation

Passed browser checks for character lifecycle, neighborhood placement, creator studio save/restore and visitor movement, opening routes, campaign progression, shared social artwork, private mobile drafts, skyline batching and physical choice notices. These targeted checks do not establish that every quest or outbreak encounter is bug-free. Release archives are built separately from source.
