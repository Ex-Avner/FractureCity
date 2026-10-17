# Fracture City 0.64.1

## Fixed
- Sodium light pools no longer float a block above the street. A pool used to be one flat 7.5 m square at the height of whatever was directly under the lamp, so a lamp on the kerb hung its light in the air over the road and read as an orange square. Each pool is now draped over the blocks beneath it, one patch per column at that column's own height, so it lies on road, kerb and steps alike and fades out as a circle.
- Pools skip rooftops and pits more than a block from the lamp's footing, and a lamp on a lone ledge gets no pool rather than a lit square.
- Wet-sky puddles only sit on level ground, never across an edge.
- Pools and puddles are removed when their lamp's chunk unloads.

## Changed
- Night sodium on up-facing surfaces is slightly less saturated (hemisphere blend 0.85 to 0.7), so paving reads warm instead of solid orange. Night stays as bright.
