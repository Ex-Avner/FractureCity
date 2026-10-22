# Fracture City 0.76.0 · HD texture pack

## Added
- HD texture pack (texture-pack.js): sixteen photo-scanned CC0 materials from
  ambientCG on the city's streets and buildings and on the Makers' Mile
  building kit: asphalt, pavement slabs, cast and roof concrete, brick,
  brushed steel, rust, roof tile, ceramic tile, marble, plaster, terrazzo,
  wood boards, fluted metal, copper and felt.
- The scans supply fine detail and surface relief only. The game's own block
  colours stay, so district palettes, sodium-noir nights and the daily hues
  still read. Relief is a real normal map that bends the light on every block
  face and on Makers' Mile's architecture.
- 1K pack (about 9 MB) on by default on desktop; 2K pack (about 37 MB)
  optional. Display panel (F): TEXTURE PACK  OFF / 1K / 2K, remembered per
  browser. Phones and the Performance tier keep the existing look.
- One WebGL2 texture array holds every layer, so the pack is one texture
  bind; layers upload one at a time straight from the images.
- _build/build-texture-pack.py turns ambientCG zips into the pack: luminance
  times ambient occlusion, high-passed so stains do not repeat, plus the
  OpenGL normal map, in one JPEG per layer.
- Low-contrast scans (smooth concrete, brushed metal, marble, plaster, tile)
  carry a per-layer gain in the manifest so every surface reads. The final
  detail multiplier is clamped to 0.45 to 1.55 so no face washes out or goes
  black.

## Mapping
- Asphalt and lane paint: Asphalt031. Sidewalk: PavingStones128. Concrete,
  poured and weathered concrete: Concrete042A. Roofs: Concrete031. Metal,
  deco trim, steel door: Metal055A. Brick, red and whitewashed brick:
  Bricks109A. Rust: Metal022. Roof tile: RoofingTiles014A. Mall tile, blue,
  bottle-green, cobalt, cream subway and checkerboard tile: Tiles107. Marble:
  Marble012. Plasters: Plaster003. Terrazzo: Terrazzo013. Stair treads,
  lacquer, walnut, pale oak, charred timber, oak door: WoodFloor043. Fluted
  brass and brushed steel: CorrugatedSteel005. Copper panels: Metal047B.
  Acoustic velvet: Fabric030.

## Not covered
- Glass, windows, light tiles, neon, the Seam, the garden, props and
  furniture, characters. The futuristic facade panels (future-city.js) keep
  their own texture and sit over some walls.
- Needs WebGL2. Older browsers keep the current look.

## Licence
- ambientCG materials are CC0 1.0 (public domain). See textures/manifest.json
  for the source of each layer.

## Tests
- _test/texture-pack.test.cjs: manifest and files, 1K default on desktop,
  shader injection in voxels and dressed meshes, panel switching 1K → 2K →
  OFF, Performance tier off, phones off, no shader errors.
