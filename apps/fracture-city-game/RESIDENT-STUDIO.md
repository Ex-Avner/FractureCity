# Resident studio and third person

Open the pause menu's Resident editor to change your character. The fitting room renders the same model used by the player, residents, shopkeepers and first-night cast. Drag the preview to turn it; use **Face / full body** to inspect details. **Save resident** uses the existing profile and avatar persistence path.

Customization includes five face/frame controls (face width, face length, jaw, nose and shoulders), four eye colours, existing skin/hair/clothing colour palettes, seven hair styles, headwear, carried items, height and build. Four jacket cuts and four coordinated wardrobe palettes add less saturated starting points. Existing avatar choices remain compatible.

Press **V** while playing, or click the view button, to switch between first and third person. The preference is saved on this device. The camera retracts in front of voxel walls and hides the player when it gets too close. A collinear camera preserves the existing combat aim ray. The renderer restores the eye camera after drawing so interaction and shot effects keep their existing origin. Driving and authored intro cinematics retain their own cameras.

## Implementation

`character-studio.js` wraps the shared character builder, figure builder, animation, resident panel and mirror. It preserves archetype/role metadata, handles and nameplates. Each articulated bone uses a single indexed mesh and a shared material. Elbows and knees animate independently; editor renderers and replaced character geometry are disposed when no longer needed. The index only loads the two new sibling scripts.

The face uses a modeled anatomical mesh; clothes, hair and accessories are procedural. This is a more natural, customizable game character foundation, not a photorealistic scanned-character pipeline. Fabric textures, facial animation and a larger authored wardrobe remain future art work.

## Asset provenance

The anatomical head is derived from MakeHuman's hm08 base mesh, explicitly released under CC0. Only the head/upper neck from the `body` group is included; the game does not load or distribute the full body asset.

- Source: https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj
- Asset licensing: https://static.makehumancommunity.org/about/license.html
- License text: `assets/MAKEHUMAN-LICENSE.md`
- Downloaded source SHA-256: `8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c`
- Derived asset: `resident-head.js`, 4,260 vertices and 8,468 triangles before hair/accessories.
- Reproduction: `python3 _test/extract-resident-head.py /path/to/base.obj apps/fracture-city-game/resident-head.js`

The model's original copyright holders are listed in the source: Data Collection AB, Joel Palmius and Jonas Hauquier. Their CC0 dedication permits this adaptation.

## Verification

Run `node _test/resident-studio.test.js` from the repository root. It checks the live editor, palette and face edits, persisted save, keyboard view switching, automatic player rendering, matching wardrobe, saved view preference, real voxel-wall camera clearance, aim alignment, restored interaction camera, customization limits, return to first person and browser exceptions. Screenshots are written to `_test/out/resident-*.png`.

Also run the required `_test/` scripts: `npm run boot`, `npm run campaign`, `npm run first-night`, `npm run web`.
