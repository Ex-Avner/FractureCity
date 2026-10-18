# 0.66.0 · Weathered city, resident saves, first walk

## World finish
- Shared deterministic 1024px material atlas: asphalt aggregate and tar repairs, concrete pitting, brick courses, scratched metal. World-space projection keeps scale consistent across chunk remeshes.
- Large mineral stains, damp wall bases and oxidation supplement existing material shaders. Common Ground's instanced architecture now uses the same weathered finish with less emissive fill.
- Existing HD surface setting controls the pass; performance mode bypasses it. No new world geometry or external texture requests.

## Account progress
- `server/resident-life.cjs`, authenticated GET/POST `/api/resident-life`, SQLite `resident_life` keyed by account and kind (`seam`, `npcs`, `tour`). Included in normal database backups.
- Signed-in `/city/` players restore farms, companions, farm balances, NPC relationships and guide milestones across browsers. Anonymous/static/offline play remains local.
- Existing username-scoped local saves import only when that account has no corresponding cloud document. Original farm migration copy retained locally. Farm credits now have an account-specific balance; this is not synchronization of the campaign wallet.
- Server time plus monotonic elapsed time drives signed-in growth. Revision checks reject stale-device writes. Failed uploads remain in an account-keyed local queue and retry. Recovery exports the unsent copy, retains a local archive, then reloads the newer account save.
- Important limit: these are validated personal save documents, not server-executed economy actions. A modified client can still submit fabricated progress. Do not connect this balance to competitive trading/rewards without authoritative action endpoints.
- Farm beds and companions are still personal views, not shared simulation. Campaign saves, Cast Studio and local studio progression remain outside this account save.

## First walk
- One existing street objective: meet Moss, listen at Common Ground, plant in the Seam, then publish an exhibit or build a wall on an online plot.
- A short optional first conversation replaces Moss's large board on the first guided visit. No automatic modal. Tools can hide or resume the guide; progress saves on the account.
- The objective stays visible along the route to the Seam. Touch guide controls scale for the game's existing 980px mobile layout.

## Verification
- Server resident-life tests: authorization, account isolation, schema rejection, stale revisions, persistence after restart.
- Main Beta regression tests: public/private admission, 12-player limit, operator moderation, archive release, proxy rate limiting.
- Browser resident-life test: existing farm migration, independent second device, NPC/pet/balance restore, wall-clock edits, mobile guide dismissal, stale-tab conflict, material shader compilation.
- Existing offline Seam browser regression: farming, market, wards, raids, taming, wildlife, reload.

No commit, push, production deployment, or live player-data migration performed by this change.
