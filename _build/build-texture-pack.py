"""Builds Fracture City's HD texture pack from ambientCG CC0 material zips.

    python3 _build/build-texture-pack.py <folder of <Id>_<1K|2K>-JPG.zip>

Each material becomes one JPEG per resolution in
apps/fracture-city-game/textures/<1k|2k>/<layer>.jpg, with three channels:

    R  detail: the photo's luminance (times ambient occlusion), high-passed so
       large stains do not repeat visibly, centred on 128. The game multiplies
       its own block colour by it, so district palettes and the colour grade
       are kept.
    G  normal X (OpenGL convention)
    B  normal Y

Saved without chroma subsampling so the three channels stay independent.
"""
import io, json, os, sys, zipfile
import numpy as np
from PIL import Image, ImageFilter

#  layer: (ambientCG id, what it is, blocks per texture repeat)
LAYERS = [
    ('Asphalt031', 'asphalt', 4.0),
    ('PavingStones128', 'pavement slabs', 3.0),
    ('Concrete042A', 'cast concrete', 4.0),
    ('Concrete031', 'roof concrete', 4.0),
    ('Metal055A', 'brushed steel', 2.0),
    ('Bricks109A', 'brick', 3.0),
    ('Metal022', 'rusted steel', 3.0),
    ('RoofingTiles014A', 'roof tile', 3.0),
    ('Tiles107', 'ceramic tile', 2.0),
    ('Marble012', 'marble', 3.0),
    ('Plaster003', 'plaster', 3.0),
    ('Terrazzo013', 'terrazzo', 3.0),
    ('WoodFloor043', 'wood boards', 2.0),
    ('CorrugatedSteel005', 'fluted metal', 2.0),
    ('Metal047B', 'copper', 3.0),
    ('Fabric030', 'felt', 1.5),
]
#  block id -> layer. City streets and buildings, plus the build kit (120-143).
BLOCKS = {
    1: 0, 10: 0,                    # asphalt, lane paint
    2: 1,                           # sidewalk
    3: 2, 133: 2, 134: 2,           # concrete, poured / weathered concrete
    6: 3,                           # roof
    7: 4, 82: 4, 143: 4,            # metal, deco trim, steel door
    11: 5, 131: 5, 132: 5,          # brick, red brick, whitewashed brick
    12: 6,                          # rust
    83: 7,                          # roof tile
    70: 8, 86: 8, 123: 8, 124: 8, 125: 8, 126: 8,   # mall tile, blue tile, bottle-green, cream subway, cobalt, checkerboard
    71: 9,                          # marble
    120: 10, 121: 10, 122: 10,      # lime / midnight / rose plaster
    127: 11,                        # terrazzo
    74: 12, 84: 12, 128: 12, 129: 12, 130: 12, 142: 12,  # stair tread, lacquer, walnut, pale oak, charred timber, oak door
    135: 13, 136: 13,               # fluted brass, brushed steel
    137: 14,                        # copper panels
    138: 15,                        # acoustic velvet
}

def member(z, suffix):
    for n in z.namelist():
        if n.endswith(suffix):
            return Image.open(io.BytesIO(z.read(n)))
    return None

def wrap_blur(a, radius):
    #  Blur with wrap-around so the result still tiles.
    h, w = a.shape
    big = np.tile(a, (3, 3))
    img = Image.fromarray(np.clip(big, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img, dtype=np.float32)[h:2 * h, w:2 * w]

def build(src, res, out):
    size = 1024 if res == '1K' else 2048
    os.makedirs(out, exist_ok=True)
    stats = []
    for i, (aid, what, rep) in enumerate(LAYERS):
        z = zipfile.ZipFile(os.path.join(src, f'{aid}_{res}-JPG.zip'))
        color = member(z, '_Color.jpg'); normal = member(z, '_NormalGL.jpg'); ao = member(z, '_AmbientOcclusion.jpg')
        if color is None or normal is None:
            raise SystemExit(f'{aid} {res}: missing colour or normal map')
        lum = np.asarray(color.convert('L').resize((size, size), Image.LANCZOS), dtype=np.float32)
        if ao is not None:
            lum *= np.asarray(ao.convert('L').resize((size, size), Image.LANCZOS), dtype=np.float32) / 255.0
        low = wrap_blur(lum, size / 24) + 1.0
        hp = lum / low                                  # fine detail around 1.0
        flat = lum / (lum.mean() + 1.0)                 # keeps some of the broad variation
        detail = np.clip((0.75 * hp + 0.25 * flat) * 128.0, 0, 255)
        n = np.asarray(normal.convert('RGB').resize((size, size), Image.LANCZOS), dtype=np.uint8)
        rgb = np.dstack([detail.astype(np.uint8), n[..., 0], n[..., 1]])
        Image.fromarray(rgb, 'RGB').save(os.path.join(out, f'{i:02d}.jpg'), quality=92, subsampling=0)
        stats.append((aid, round(float(detail.mean()), 1), round(float(detail.std()), 1)))
    return stats

if __name__ == '__main__':
    src = sys.argv[1]
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'apps', 'fracture-city-game', 'textures')
    manifest = {'version': 1, 'source': 'ambientCG (CC0 1.0)', 'size': {'1k': 1024, '2k': 2048},
                'layers': [{'id': a, 'name': w, 'blocksPerRepeat': r, 'url': f'https://ambientcg.com/view?id={a}'} for a, w, r in LAYERS],
                'blocks': {str(k): v for k, v in BLOCKS.items()}}
    for res in ('1K', '2K'):
        stats = build(src, res, os.path.join(root, res.lower()))
        for s in stats:
            print(res, *s)
        if res == '1K':
            #  Low-contrast scans (smooth concrete, brushed metal) get a gain so
            #  every surface reads; the shader applies it around mid-grey.
            for layer, (_, _, sd) in zip(manifest['layers'], stats):
                layer['gain'] = round(min(2.5, max(1.0, 18.0 / max(sd, 1.0))), 2)
    with open(os.path.join(root, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
        f.write('\n')
    print('manifest written')
