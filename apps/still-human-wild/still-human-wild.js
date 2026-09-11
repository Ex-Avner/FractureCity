// =============================================================================
//  66 · STILL HUMAN // WILD — the spin-off cabinet
// -----------------------------------------------------------------------------
//  The arcade's second cabinet is no longer a locked door. STILL HUMAN was a
//  round-survival game: one arena, waves, nowhere to go. WILD takes the same
//  premise outdoors and gives it ground you can move.
//
//  Plains, ridges, a snow line, a river cut. One Kiln at the middle of it that
//  nothing can break. Day is yours: quarry, fell, raise floors, sculpt the
//  hill into something you meant. Night is theirs, and everything that comes
//  out of it leaves a weapon or a piece of plate on the grass.
//
//  It renders in the cabinet's own canvas on the page's existing three.js
//  build, so the file stays one file. The city sim is already paused behind
//  the overlay; while this is mounted the city stops drawing too, and the
//  cabinet owns the keyboard.
//
//  Look: stop-motion clay. Flat-shaded facets, per-triangle tint drift,
//  thumbprint dents in the ground, a 12fps step on every animated thing, and
//  a fingerprint grain over the lot of it. Nothing here is smooth on purpose.
// =============================================================================

(function(){
'use strict';

if (typeof THREE === 'undefined') return;

// ─── 1 · Tuning ──────────────────────────────────────────────────────────────

const WORLD   = 192;            // world spans -96 .. 96 on both axes
const CELL    = 1.2;            // metres per heightfield cell
const GRID    = Math.round(WORLD / CELL);       // 128 cells
const TILE    = 16;             // cells per rebuildable tile
const TILES   = GRID / TILE;    // 8 x 8 tiles
const HALF    = WORLD / 2;

const WATER_Y = 2.4;
const BASE_R  = 34;             // plateau radius, blended out to the plains
//  Protected ground: no digging, no removing, no spawning. It GROWS when the
//  Kiln is upgraded, so it is a function, not a constant. The terrain plateau
//  underneath is baked once at the widest radius the ring can ever reach, so
//  widening the ring never means regenerating the ground.
const KEEP_R_BASE = 13;
const KEEP_R_STEP = 3;
const KEEP_R_MAX_LVL = 3;
const PLATEAU_R = KEEP_R_BASE + KEEP_R_STEP * KEEP_R_MAX_LVL;   // 22
const BASE_Y  = 7.0;

const DAY_LEN   = 168;          // seconds of daylight
const NIGHT_LEN = 96;           // seconds of night
const CYCLE     = DAY_LEN + NIGHT_LEN;

const STEP_FPS = 12;            // stop-motion step for every animation

const MAX_MOBS  = 16;
const MAX_BLOCKS = 900;
const SAVE_KEY  = 'stillhuman-wild-v1';

// ─── 2 · Palette ─────────────────────────────────────────────────────────────
//  Saturated, poster-bright. Clay that somebody actually pressed pigment into.

const PAL = {
  sand:    [0xe8c98d, 0xdcb877],
  grass:   [0x6fc63f, 0x86d64c, 0x5bb036],
  meadow:  [0xa8e04f, 0xc3ea63],
  forest:  [0x3b8f42, 0x2f7a38, 0x47a04c],
  rock:    [0x8f8578, 0x7c7366, 0xa0968a],
  scree:   [0xb0a08c],
  snow:    [0xf4f8ff, 0xe3ecfb],
  water:   0x2fa8c9,
  bark:    0x7a4b2e,
  leafA:   0x2f9b46,
  leafB:   0x59c15a,
  leafC:   0xd84f6a,   // the red canopies, for colour punch
  leafD:   0xf2a63c,
  boulder: 0x8a8175,
  bush:    0x4fae52,
};

const RARITY = [
  { key:'common',  name:'Rough',   mult:1.00, col:'#c8c2b4', hex:0xc8c2b4, w:46 },
  { key:'sturdy',  name:'Sturdy',  mult:1.28, col:'#7dffb3', hex:0x7dffb3, w:27 },
  { key:'fine',    name:'Fine',    mult:1.62, col:'#5fc9ff', hex:0x5fc9ff, w:16 },
  { key:'rare',    name:'Glazed',  mult:2.10, col:'#c08bff', hex:0xc08bff, w:8  },
  { key:'molded',  name:'Kilnborn',mult:2.85, col:'#ffb03d', hex:0xffb03d, w:3  },
];

const WEAPONS = [
  { key:'club',  name:'Cudgel',  dmg:13, spd:0.52, reach:2.5, arc:1.25, col:0x8a5a34 },
  { key:'blade', name:'Shard',   dmg:16, spd:0.42, reach:2.7, arc:1.05, col:0xd8e4f0 },
  { key:'maul',  name:'Maul',    dmg:29, spd:0.86, reach:2.9, arc:1.55, col:0x9aa2bb },
  { key:'spear', name:'Lance',   dmg:19, spd:0.58, reach:3.9, arc:0.62, col:0xc9a06a },
  { key:'flail', name:'Censer',  dmg:22, spd:0.68, reach:3.0, arc:1.85, col:0xffb03d },
];

const ARMOURS = [
  { key:'head',  name:'Helm',    base:6  },
  { key:'chest', name:'Plate',   base:11 },
  { key:'legs',  name:'Greaves', base:8  },
];

const MATS = [
  { key:'clay',    name:'Clay Brick', col:0xc8683f, res:'earth',  cost:1, solid:true },
  { key:'thatch',  name:'Thatch',     col:0xd9b455, res:'timber', cost:1, solid:true },
  { key:'timber',  name:'Timber',     col:0x8a5a34, res:'timber', cost:1, solid:true },
  { key:'stone',   name:'Cut Stone',  col:0x8f8578, res:'stone',  cost:1, solid:true },
  { key:'glass',   name:'Kiln Glass', col:0x7fdcff, res:'stone',  cost:2, solid:true, glass:true },
  { key:'lantern', name:'Lantern',    col:0xffc65a, res:'ember',  cost:1, solid:true, light:true },
];

const MOBS = {
  husk:    { name:'Husk',     hp:34,  spd:2.3, dmg:9,  r:0.62, h:1.9, col:0x7b5ea8, eye:0xff4f6d, tier:1 },
  stalker: { name:'Stalker',  hp:22,  spd:4.5, dmg:7,  r:0.48, h:1.6, col:0xd8496a, eye:0xffe14f, tier:1 },
  lumber:  { name:'Lumberer', hp:96,  spd:1.7, dmg:22, r:0.95, h:2.9, col:0x3f6f8f, eye:0xff9a3d, tier:2 },
  wisp:    { name:'Emberwisp',hp:30,  spd:2.9, dmg:11, r:0.55, h:1.4, col:0xff9a3d, eye:0xfff3c0, tier:2, flies:true, ranged:true },
  molder:  { name:'Molder',   hp:180, spd:1.5, dmg:31, r:1.25, h:3.6, col:0x2f2a44, eye:0xff2f4f, tier:3 },
};

// ─── 3 · Seeded noise ────────────────────────────────────────────────────────

function mulberry(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashStr(s){
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

//  Value noise with a permutation table. Cheap, and the fBm of it reads as
//  hand-pressed hills rather than mathematics.
function makeNoise(seed){
  const rnd = mulberry(seed);
  const P = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) P[i] = rnd();
  const at = (x, y) => P[((x * 374761393 ^ y * 668265263) >>> 0) & 1023];
  const sm = t => t * t * (3 - 2 * t);
  return function(x, y){
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = sm(xf), v = sm(yf);
    const a = at(xi, yi),     b = at(xi + 1, yi);
    const c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
}

function fbm(n, x, y, oct, lac, gain){
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++){
    sum  += n(x * freq, y * freq) * amp;
    norm += amp;
    amp  *= gain; freq *= lac;
  }
  return sum / norm;
}

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

// ─── 4 · Clay surface texture ────────────────────────────────────────────────
//  A fingerprint-and-thumbprint grain, generated once. Multiplied over every
//  material so nothing in the world reads as plastic.

let CLAY_TEX = null;
function clayTexture(){
  if (CLAY_TEX) return CLAY_TEX;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);

  const rnd = mulberry(99173);

  //  Broad thumb pressure: soft light and dark lobes.
  for (let i = 0; i < 90; i++){
    const x = rnd() * S, y = rnd() * S, r = 14 + rnd() * 46;
    const dark = rnd() > 0.5;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + rnd() * 0.07;
    grd.addColorStop(0, dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }

  //  Fingerprint ridges: concentric arcs, broken.
  g.lineWidth = 1.1;
  for (let f = 0; f < 6; f++){
    const cx = rnd() * S, cy = rnd() * S;
    const rot = rnd() * 6.2832;
    for (let r = 3; r < 40; r += 2.6){
      g.strokeStyle = `rgba(0,0,0,${0.035 + rnd() * 0.03})`;
      g.beginPath();
      const a0 = rot + rnd() * 1.2, a1 = a0 + 2.0 + rnd() * 2.6;
      g.arc(cx, cy, r, a0, a1);
      g.stroke();
    }
  }

  //  Fine speckle: grog in the clay body.
  const img = g.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4){
    const n = (rnd() - 0.5) * 15;
    d[i] = clamp(d[i] + n, 0, 255);
    d[i+1] = clamp(d[i+1] + n, 0, 255);
    d[i+2] = clamp(d[i+2] + n, 0, 255);
  }
  g.putImageData(img, 0, 0);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  CLAY_TEX = t;
  return t;
}

//  An InstancedMesh that tints per instance needs `vertexColors` on the
//  material, and a material with `vertexColors` needs a colour attribute on
//  the geometry or every vertex reads as black. This gives it a white one.
function whiteColors(geo){
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

function clayMat(opts){
  const t = clayTexture().clone();
  t.needsUpdate = true;
  t.repeat.set(opts && opts.rep ? opts.rep : 1, opts && opts.rep ? opts.rep : 1);
  const m = new THREE.MeshLambertMaterial(Object.assign({
    map: t, flatShading: true,
  }, opts && opts.mat ? opts.mat : {}));
  return m;
}

// ─── 5 · The game object ─────────────────────────────────────────────────────

const SHW = {
  mounted: false,
  host: null, canvas: null,
  renderer: null, scene: null, camera: null,
  clock: null, raf: 0,
  seed: 'wild-1', opts: {},
  noise: null, moist: null,
};

const G = {};       // shared geometries
const S = {};       // scene objects

const St = {        // live game state
  phase: 'title',   // title | play | dead
  t: 0,             // wall time
  step: 0,          // stepped time for stop-motion
  cycle: 0,         // seconds into the current day/night cycle
  day: 1,
  night: false,
  lastNight: false,
  hp: 100, maxHp: 100,
  stam: 100, maxStam: 100,
  xp: 0, level: 1,
  res: { earth: 40, timber: 24, stone: 18, ember: 4 },
  inv: [],
  gear: { weapon: null, head: null, chest: null, legs: null },
  mode: 'fight',    // fight | build | sculpt
  matIdx: 0,
  brush: 3,
  combo: 0, comboT: 0,
  kills: 0, nightsSurvived: 0,
  hitStop: 0, shake: 0,
  torch: true,
  //  Kiln upgrade levels, tool levels, and what the crosshair is resting on.
  kiln: { ring: 0, brazier: 0, height: 0, bench: 0 },
  tools: { axe: 0, pick: 0 },
  focus: null,          // the node under the crosshair, if any
  gather: null,         // { node, t, dur } while the button is held
  benchOpen: false,
  sculptReach: 14,
  buildReach: 9,
  invOpen: false,
  dead: false, respawnT: 0,
  msg: '', msgT: 0,
};

const Pl = {
  pos: new THREE.Vector3(0, 0, 0),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: -0.04,
  onGround: false,
  swing: 0, swingDir: 1,
  walkPhase: 0,
  hurtT: 0,
  group: null,
  parts: {},
};

const Cam = { dist: 6.4, height: 1.55, side: 0.95, shakeX: 0, shakeY: 0 };

// terrain data
let H = null;           // Float32Array (GRID+1)^2 base heights
let HD = null;          // Float32Array deltas from sculpting
let tiles = [];         // {mesh, geo, i, j, dirty}
let mobs = [];
let drops = [];
let blocks = new Map(); // "x,y,z" -> {mat, x, y, z}
let blockMeshes = [];
let trees = [];
let rocks = [];
let banks = [];
let projectiles = [];

// ─── 6 · Heightfield ─────────────────────────────────────────────────────────

const hIdx = (i, j) => j * (GRID + 1) + i;

function baseHeight(wx, wz){
  const n = SHW.noise;
  const s = 0.010;
  //  Continent shape: broad rolling plains.
  let h = fbm(n, wx * s, wz * s, 4, 2.03, 0.5) * 13.0;
  //  Ridges: an absolute-valued octave makes mountain spines rather than blobs.
  const r = 1 - Math.abs(fbm(n, wx * 0.0062 + 71, wz * 0.0062 - 40, 3, 2.11, 0.55) * 2 - 1);
  const ridgeMask = smooth((Math.hypot(wx, wz) - 56) / 40);
  h += Math.pow(r, 2.6) * 32.0 * ridgeMask;
  //  Fine lumps: the thumbprints.
  h += fbm(n, wx * 0.14, wz * 0.14, 2, 2.0, 0.5) * 0.55;
  h += 4.5;

  //  River cut, a soft valley running north-south with a wander in it.
  const wander = (fbm(n, wz * 0.012 + 200, 0.5, 3, 2, 0.5) - 0.5) * 44;
  const dRiver = Math.abs(wx - (-34 + wander));
  const river = 1 - smooth(dRiver / 11);
  h = lerp(h, WATER_Y - 1.4, river * 0.88);

  //  The plateau the Kiln stands on.
  const d = Math.hypot(wx, wz);
  //  Squared falloff: dead flat out to the ring, then a long easy apron into
//  whatever the land was doing. A short blend makes a quarry pit.
  const flat = Math.pow(1 - smooth((d - PLATEAU_R) / (BASE_R - PLATEAU_R)), 0.7);
  h = lerp(h, BASE_Y, flat);

  return h;
}

function buildHeights(){
  H  = new Float32Array((GRID + 1) * (GRID + 1));
  if (!HD) HD = new Float32Array((GRID + 1) * (GRID + 1));
  for (let j = 0; j <= GRID; j++){
    const wz = -HALF + j * CELL;
    for (let i = 0; i <= GRID; i++){
      H[hIdx(i, j)] = baseHeight(-HALF + i * CELL, wz);
    }
  }
}

function heightAtIdx(i, j){
  i = clamp(i, 0, GRID); j = clamp(j, 0, GRID);
  const k = hIdx(i, j);
  return H[k] + HD[k];
}

//  Bilinear sample in world space. Everything that walks uses this.
function groundY(wx, wz){
  const fx = clamp((wx + HALF) / CELL, 0, GRID - 0.0001);
  const fz = clamp((wz + HALF) / CELL, 0, GRID - 0.0001);
  const i = Math.floor(fx), j = Math.floor(fz);
  const tx = fx - i, tz = fz - j;
  const a = heightAtIdx(i, j),     b = heightAtIdx(i + 1, j);
  const c = heightAtIdx(i, j + 1), d = heightAtIdx(i + 1, j + 1);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

function slopeAt(wx, wz){
  const e = CELL;
  const dx = groundY(wx + e, wz) - groundY(wx - e, wz);
  const dz = groundY(wx, wz + e) - groundY(wx, wz - e);
  return Math.hypot(dx, dz) / (2 * e);
}

function moistAt(wx, wz){
  return fbm(SHW.moist, wx * 0.016 + 13, wz * 0.016 - 9, 3, 2.0, 0.5);
}

//  Biome colour for one triangle centre. Returns [r,g,b] floats.
const _c = new THREE.Color();
function biomeColor(wx, wz, h, slope, jitter){
  let hex;
  const m = moistAt(wx, wz);
  if (h < WATER_Y + 0.5)        hex = PAL.sand[jitter < 0.5 ? 0 : 1];
  else if (h > 23.0)            hex = PAL.snow[jitter < 0.6 ? 0 : 1];
  else if (h > 18.0)            hex = jitter < 0.42 ? PAL.snow[1] : PAL.scree;
  else if (slope > 0.72)        hex = PAL.rock[Math.floor(jitter * 3) % 3];
  else if (h > 14.0)            hex = PAL.rock[Math.floor(jitter * 3) % 3];
  else if (m > 0.58 && h < 12)  hex = PAL.forest[Math.floor(jitter * 3) % 3];
  else if (m < 0.36)            hex = PAL.meadow[jitter < 0.5 ? 0 : 1];
  else                          hex = PAL.grass[Math.floor(jitter * 3) % 3];

  _c.setHex(hex);
  //  Per-triangle tint drift. Hand-mixed clay is never the same twice.
  const d = (jitter - 0.5) * 0.14;
  _c.r = clamp(_c.r + d, 0, 1);
  _c.g = clamp(_c.g + d * 0.8, 0, 1);
  _c.b = clamp(_c.b + d * 0.6, 0, 1);
  //  Snow line brightening near the peaks.
  if (h > 25) _c.lerp(new THREE.Color(0xffffff), 0.26);
  return _c;
}

// ─── 7 · Terrain tiles ───────────────────────────────────────────────────────

function buildTile(ti, tj){
  const i0 = ti * TILE, j0 = tj * TILE;
  const quads = TILE * TILE;
  const verts = quads * 6;
  const pos = new Float32Array(verts * 3);
  const col = new Float32Array(verts * 3);
  const uv  = new Float32Array(verts * 2);
  const rnd = mulberry(hashStr(SHW.seed) ^ (ti * 733 + tj * 977));

  let p = 0, cptr = 0, uptr = 0;
  for (let j = 0; j < TILE; j++){
    for (let i = 0; i < TILE; i++){
      const gi = i0 + i, gj = j0 + j;
      const x0 = -HALF + gi * CELL, z0 = -HALF + gj * CELL;
      const x1 = x0 + CELL, z1 = z0 + CELL;
      const y00 = heightAtIdx(gi, gj),     y10 = heightAtIdx(gi + 1, gj);
      const y01 = heightAtIdx(gi, gj + 1), y11 = heightAtIdx(gi + 1, gj + 1);

      //  Split the quad on its shorter diagonal so ridges stay sharp.
      const flip = Math.abs(y00 - y11) > Math.abs(y10 - y01);
      const tri = flip
        ? [[x0,y00,z0, x1,y10,z0, x1,y11,z1], [x0,y00,z0, x1,y11,z1, x0,y01,z1]]
        : [[x0,y00,z0, x1,y10,z0, x0,y01,z1], [x1,y10,z0, x1,y11,z1, x0,y01,z1]];

      for (let t = 0; t < 2; t++){
        const v = tri[t];
        const cx = (v[0] + v[3] + v[6]) / 3;
        const cy = (v[1] + v[4] + v[7]) / 3;
        const cz = (v[2] + v[5] + v[8]) / 3;
        const jit = rnd();
        const sl = Math.max(Math.abs(v[1] - v[4]), Math.abs(v[4] - v[7])) / CELL;
        const c = biomeColor(cx, cz, cy, sl, jit);
        //  Emitted 0,2,1: counter-clockwise seen from above, so the generated
        //  face normals point at the sky. Wound the other way the sun lights
        //  the underside of the world and every hill reads black.
        for (const k of [0, 2, 1]){
          pos[p++] = v[k*3]; pos[p++] = v[k*3+1]; pos[p++] = v[k*3+2];
          col[cptr++] = c.r; col[cptr++] = c.g; col[cptr++] = c.b;
          uv[uptr++] = v[k*3] * 0.12; uv[uptr++] = v[k*3+2] * 0.12;
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function makeTerrain(){
  const mat = clayMat({ rep: 1, mat: { vertexColors: true } });
  mat.map.repeat.set(1, 1);
  S.terrainMat = mat;
  tiles = [];
  for (let tj = 0; tj < TILES; tj++){
    for (let ti = 0; ti < TILES; ti++){
      const geo = buildTile(ti, tj);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = true;
      S.world.add(mesh);
      tiles.push({ ti, tj, mesh, geo });
    }
  }
}

function rebuildTilesAround(wx, wz, r){
  const i0 = clamp(Math.floor((wx - r + HALF) / CELL / TILE), 0, TILES - 1);
  const i1 = clamp(Math.floor((wx + r + HALF) / CELL / TILE), 0, TILES - 1);
  const j0 = clamp(Math.floor((wz - r + HALF) / CELL / TILE), 0, TILES - 1);
  const j1 = clamp(Math.floor((wz + r + HALF) / CELL / TILE), 0, TILES - 1);
  for (const t of tiles){
    if (t.ti < i0 || t.ti > i1 || t.tj < j0 || t.tj > j1) continue;
    t.geo.dispose();
    t.geo = buildTile(t.ti, t.tj);
    t.mesh.geometry = t.geo;
  }
}

// ─── 8 · Water ───────────────────────────────────────────────────────────────

function makeWater(){
  const g = new THREE.PlaneGeometry(WORLD + 40, WORLD + 40, 24, 24);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshLambertMaterial({
    color: PAL.water, transparent: true, opacity: 0.82, flatShading: true,
    map: clayTexture().clone(),
  });
  m.map.needsUpdate = true;
  const mesh = new THREE.Mesh(g, m);
  mesh.position.y = WATER_Y;
  S.world.add(mesh);
  S.water = mesh;
  S.waterBase = g.attributes.position.array.slice();
}

// ─── 9 · Flora and stone ─────────────────────────────────────────────────────

//  What a harvestable node is worth, and how long it takes. `tool` is the
//  crafted tool that speeds it up; a node with no tool is dug by hand.
const NODE = {
  tree: { name:'Tree',      res:'timber', yield:6, time:1.30, tool:'axe',  hex:0x8ad84c },
  rock: { name:'Boulder',   res:'stone',  yield:7, time:1.70, tool:'pick', hex:0xb0a08c },
  bank: { name:'Clay Bank', res:'earth',  yield:9, time:1.00, tool:null,   hex:0xd98a48 },
};

function scatterProps(){
  const rnd = mulberry(hashStr(SHW.seed) ^ 0x51ab3);
  trees = []; rocks = []; banks = [];
  const bushPos = [];

  const TRY = 5400;
  for (let n = 0; n < TRY; n++){
    const wx = (rnd() - 0.5) * (WORLD - 8);
    const wz = (rnd() - 0.5) * (WORLD - 8);
    const d = Math.hypot(wx, wz);
    //  Per kind, not one radius for everything. Trees keep back so the Kiln
    //  is never buried behind a treeline; boulders and clay come to the edge
    //  of the ring, because "where is the stone" was the first thing that
    //  went wrong with this world.
    const clearFor = { tree: PLATEAU_R + 3, other: PLATEAU_R - 6 };
    if (d < clearFor.other) continue;
    const y = groundY(wx, wz);
    if (y < WATER_Y + 0.6) continue;
    const sl = slopeAt(wx, wz);
    const m = moistAt(wx, wz);

    const waterline = y < WATER_Y + 3.0;
    if (sl < 0.34 && banks.length < 260 &&
        ((waterline && rnd() < 0.55) || (y < 12.5 && rnd() < 0.08))){
      //  Clay banks. Earth used to come only from lowering terrain in a mode
      //  nobody had opened, so two of the six build materials had no visible
      //  source. They cluster at the river cut and sit thinly through the
      //  plains, which is where the player actually is.
      banks.push({ kind:'bank', x: wx, z: wz, y, s: 0.9 + rnd() * 0.8,
                   rot: rnd() * 6.283, alive: true });
    } else if (d > clearFor.tree && y < 15 && sl < 0.55 && m > 0.40 && rnd() < (m - 0.34) * 1.9){
      if (trees.length < 480){
        const cold = y > 11.5;
        const roll = rnd();
        const leaf = cold ? PAL.leafA
                   : roll < 0.62 ? PAL.leafB
                   : roll < 0.82 ? PAL.leafC
                   : PAL.leafD;
        trees.push({ kind:'tree', x: wx, z: wz, y, s: 0.8 + rnd() * 0.75, leaf,
                     rot: rnd() * 6.283, alive: true });
      }
    } else if (sl > 0.35 || y > 16 || rnd() < 0.20){
      //  Boulders were slope-only, so the nearest one to the Kiln was thirty
      //  metres up a hill and stone looked like it did not exist. They are
      //  scattered through the flats now as well, just more thinly.
      if (rocks.length < 380 && rnd() < 0.40){
        rocks.push({ kind:'rock', x: wx, z: wz, y, s: 0.6 + rnd() * 1.5,
                     rot: rnd() * 6.283, alive: true });
      }
    } else if (rnd() < 0.10 && bushPos.length < 420){
      bushPos.push({ x: wx, z: wz, y, s: 0.5 + rnd() * 0.6, rot: rnd() * 6.283 });
    }
  }

  //  Trunks
  const trunkGeo = new THREE.CylinderGeometry(0.20, 0.30, 1, 5, 1);
  trunkGeo.translate(0, 0.5, 0);
  S.trunks = new THREE.InstancedMesh(trunkGeo,
    clayMat({ rep: 1, mat: { color: PAL.bark } }), Math.max(1, trees.length));
  S.trunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  //  Canopies: two stacked facets so a tree reads as pinched clay, not a ball.
  const canGeo = whiteColors(new THREE.IcosahedronGeometry(1, 0));
  S.canopy = new THREE.InstancedMesh(canGeo,
    clayMat({ rep: 1, mat: { vertexColors: true } }), Math.max(1, trees.length));
  S.canopy.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  S.canopy.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(Math.max(1, trees.length) * 3), 3);

  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(),
        vp = new THREE.Vector3(), vs = new THREE.Vector3();
  trees.forEach((t, i) => {
    const hgt = 2.6 * t.s;
    q.setFromEuler(new THREE.Euler(0, t.rot, 0));
    vp.set(t.x, t.y, t.z); vs.set(t.s, hgt, t.s);
    mx.compose(vp, q, vs); S.trunks.setMatrixAt(i, mx);
    vp.set(t.x, t.y + hgt + 0.55 * t.s, t.z);
    vs.set(1.35 * t.s, 1.15 * t.s, 1.35 * t.s);
    q.setFromEuler(new THREE.Euler(t.rot * 0.7, t.rot, t.rot * 0.4));
    mx.compose(vp, q, vs); S.canopy.setMatrixAt(i, mx);
    _c.setHex(t.leaf);
    S.canopy.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
    t.i = i;
  });
  S.trunks.instanceMatrix.needsUpdate = true;
  S.canopy.instanceMatrix.needsUpdate = true;
  S.canopy.instanceColor.needsUpdate = true;
  S.world.add(S.trunks); S.world.add(S.canopy);

  //  Boulders
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  S.rocks = new THREE.InstancedMesh(rockGeo,
    clayMat({ rep: 1, mat: { color: PAL.boulder } }), Math.max(1, rocks.length));
  S.rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rocks.forEach((r, i) => {
    q.setFromEuler(new THREE.Euler(r.rot * 0.5, r.rot, r.rot * 0.3));
    vp.set(r.x, r.y + r.s * 0.4, r.z);
    vs.set(r.s, r.s * 0.78, r.s * 1.1);
    mx.compose(vp, q, vs); S.rocks.setMatrixAt(i, mx);
    r.i = i;
  });
  S.rocks.instanceMatrix.needsUpdate = true;
  S.world.add(S.rocks);

  //  Clay banks: low wet mounds, half sunk, the colour of wedged clay.
  const bankGeo = new THREE.DodecahedronGeometry(1, 0);
  S.banks = new THREE.InstancedMesh(bankGeo,
    clayMat({ rep: 1, mat: { color: 0xb5733f } }), Math.max(1, banks.length));
  S.banks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  banks.forEach((bk, i) => {
    q.setFromEuler(new THREE.Euler(0.25, bk.rot, 0.15));
    vp.set(bk.x, bk.y + bk.s * 0.18, bk.z);
    vs.set(bk.s * 1.5, bk.s * 0.5, bk.s * 1.3);
    mx.compose(vp, q, vs); S.banks.setMatrixAt(i, mx);
    bk.i = i;
  });
  S.banks.instanceMatrix.needsUpdate = true;
  S.world.add(S.banks);

  //  Bushes: pure decoration, never removed, so no bookkeeping.
  const bushGeo = new THREE.IcosahedronGeometry(1, 0);
  const bm = new THREE.InstancedMesh(bushGeo,
    clayMat({ rep: 1, mat: { color: PAL.bush } }), Math.max(1, bushPos.length));
  bushPos.forEach((b, i) => {
    q.setFromEuler(new THREE.Euler(b.rot * 0.4, b.rot, 0));
    vp.set(b.x, b.y + b.s * 0.35, b.z);
    vs.set(b.s * 1.1, b.s * 0.7, b.s * 1.1);
    mx.compose(vp, q, vs); bm.setMatrixAt(i, mx);
  });
  bm.instanceMatrix.needsUpdate = true;
  S.world.add(bm);
  S.bushes = bm;
}

const _zero = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
function killTree(t){
  t.alive = false;
  const m = new THREE.Matrix4().makeTranslation(t.x, t.y - 40, t.z);
  S.trunks.setMatrixAt(t.i, m); S.canopy.setMatrixAt(t.i, m);
  S.trunks.instanceMatrix.needsUpdate = true;
  S.canopy.instanceMatrix.needsUpdate = true;
}
function killRock(r){
  r.alive = false;
  const m = new THREE.Matrix4().makeTranslation(r.x, r.y - 40, r.z);
  S.rocks.setMatrixAt(r.i, m);
  S.rocks.instanceMatrix.needsUpdate = true;
}
function killBank(b){
  b.alive = false;
  const m = new THREE.Matrix4().makeTranslation(b.x, b.y - 40, b.z);
  S.banks.setMatrixAt(b.i, m);
  S.banks.instanceMatrix.needsUpdate = true;
}
function killNode(n){
  if (n.kind === 'tree') killTree(n);
  else if (n.kind === 'rock') killRock(n);
  else killBank(n);
}

// ─── 10 · The Kiln ───────────────────────────────────────────────────────────
//  Indestructible by construction: it is not made of blocks, and the sculpt
//  and remove tools refuse to work inside keepR(). The ring on the ground says
//  where that is, so nobody has to discover the rule by being refused.

function makeBase(){
  const grp = new THREE.Group();
  const wallMat = clayMat({ rep: 3, mat: { color: 0xb5603c } });
  const trimMat = clayMat({ rep: 2, mat: { color: 0xe0e4ec } });
  const roofMat = clayMat({ rep: 2, mat: { color: 0x3f4a6b } });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffc65a });

  const box = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + BASE_Y, z);
    grp.add(m); return m;
  };

  //  Footing and the drum of the kiln itself.
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10.4, 1.2, 12), wallMat);
  foot.position.set(0, BASE_Y + 0.4, 0); grp.add(foot);

  //  Everything above the footing lives in its own group so "raise the kiln"
  //  can scale a tower rather than a number in a menu.
  const grow = new THREE.Group();
  grow.position.y = BASE_Y;
  grp.add(grow);
  S.kilnGrow = grow;

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 6.2, 7.0, 10), wallMat);
  drum.position.set(0, 4.4, 0); grow.add(drum);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.5, 10), trimMat);
  band.position.set(0, 5.6, 0); grow.add(band);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(6.4, 4.2, 10), roofMat);
  cap.position.set(0, 9.9, 0); grow.add(cap);

  const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 2.4, 6), trimMat);
  flue.position.set(0, 12.4, 0); grow.add(flue);

  //  Four buttresses, so the silhouette is not a birthday cake.
  for (let i = 0; i < 4; i++){
    const a = i * Math.PI / 2 + Math.PI / 4;
    const bx = Math.cos(a) * 6.4, bz = Math.sin(a) * 6.4;
    const b = box(1.6, 6.2, 1.6, bx, 3.9, bz, wallMat);
    b.rotation.y = a;
    const t = box(1.9, 0.5, 1.9, bx, 7.2, bz, trimMat);
    t.rotation.y = a;
  }

  //  Mouth of the kiln: the fire everybody runs back to.
  box(3.0, 2.6, 0.8, 0, 2.4, 5.6, roofMat);
  const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 0), glowMat);
  fire.position.set(0, BASE_Y + 2.0, 5.1);
  grp.add(fire);
  S.fire = fire;

  const hearth = new THREE.PointLight(0xffa83d, 3.2, 46, 1.6);
  hearth.position.set(0, BASE_Y + 3.0, 4.4);
  grp.add(hearth);
  S.hearth = hearth;

  //  Braziers at the compass points, marking the safe ring at night.
  S.braziers = []; S.brazierPosts = [];
  for (let i = 0; i < 8; i++){
    const a = i * Math.PI / 4;
    const bx = Math.cos(a) * (KEEP_R_BASE - 1.4), bz = Math.sin(a) * (KEEP_R_BASE - 1.4);
    S.brazierPosts.push(box(0.55, 2.2, 0.55, bx, 1.1, bz, trimMat));
    const bowl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 0), glowMat);
    bowl.position.set(bx, BASE_Y + 2.45, bz);
    grp.add(bowl);
    S.braziers.push(bowl);
  }

  //  Protected-ground ring, drawn just above the plateau.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(KEEP_R_BASE - 0.35, KEEP_R_BASE, 72),
    new THREE.MeshBasicMaterial({ color: 0xffc65a, transparent: true, opacity: 0.45,
                                  side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = BASE_Y + 0.06;
  grp.add(ring);
  S.ring = ring;

  //  Workbench: stand near it to repair, and to bank the night.
  const bench = box(2.6, 1.0, 1.2, -6.0, 1.5, 3.6, trimMat);
  bench.rotation.y = 0.5;
  S.bench = new THREE.Vector3(-6.0, BASE_Y + 1.5, 3.6);

  S.world.add(grp);
  S.base = grp;
}

// ─── 11 · Player puppet ──────────────────────────────────────────────────────
//  Blocky limbs on visible joints. Stop-motion armature, not a skinned mesh.

function makePlayer(){
  const g = new THREE.Group();
  const skin = clayMat({ rep: 1, mat: { color: 0xe0a074 } });
  const cloth = clayMat({ rep: 1, mat: { color: 0x3f6f8f } });
  const boot = clayMat({ rep: 1, mat: { color: 0x4a3526 } });
  const B = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  const torso = B(0.72, 0.92, 0.44, cloth); torso.position.y = 1.22; g.add(torso);
  const head = B(0.52, 0.50, 0.50, skin);   head.position.y = 1.95; g.add(head);
  const hair = B(0.56, 0.16, 0.54, clayMat({ rep:1, mat:{ color:0x2a1d19 } }));
  hair.position.y = 2.22; g.add(hair);

  const armL = B(0.20, 0.80, 0.22, skin);
  armL.geometry.translate(0, -0.40, 0); armL.position.set(-0.47, 1.62, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.47; g.add(armR);

  const legL = B(0.26, 0.80, 0.28, boot);
  legL.geometry.translate(0, -0.40, 0); legL.position.set(-0.19, 0.80, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.19; g.add(legR);

  //  Gear plates, shown only when worn.
  const helm = B(0.60, 0.30, 0.58, clayMat({ rep:1, mat:{ color:0xc8c2b4 } }));
  helm.position.y = 2.08; helm.visible = false; g.add(helm);
  const plate = B(0.82, 0.70, 0.54, clayMat({ rep:1, mat:{ color:0xc8c2b4 } }));
  plate.position.y = 1.30; plate.visible = false; g.add(plate);
  const greave = B(0.34, 0.46, 0.36, clayMat({ rep:1, mat:{ color:0xc8c2b4 } }));
  greave.position.set(-0.19, 0.56, 0); greave.visible = false; g.add(greave);
  const greave2 = greave.clone(); greave2.position.x = 0.19; g.add(greave2);

  //  Weapon in the right hand, swapped by shape when the gear changes.
  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.47, 1.62, 0);
  g.add(weaponPivot);

  Pl.group = g;
  Pl.parts = { torso, head, hair, armL, armR, legL, legR,
               helm, plate, greave, greave2, weaponPivot, weapon: null };
  S.world.add(g);
  refreshWeaponMesh();
}

function refreshWeaponMesh(){
  const p = Pl.parts;
  if (p.weapon){ p.weaponPivot.remove(p.weapon); p.weapon = null; }
  const w = St.gear.weapon;
  if (!w) return;
  const def = WEAPONS.find(x => x.key === w.type) || WEAPONS[0];
  const rar = RARITY.find(r => r.key === w.rarity) || RARITY[0];
  const grp = new THREE.Group();
  const haftMat = clayMat({ rep: 1, mat: { color: 0x6b4a30 } });
  const headMat = clayMat({ rep: 1, mat: { color: def.col } });
  const gemMat = new THREE.MeshBasicMaterial({ color: rar.hex });

  const haftLen = def.key === 'spear' ? 2.4 : 1.15;
  const haft = new THREE.Mesh(new THREE.BoxGeometry(0.10, haftLen, 0.10), haftMat);
  haft.position.y = -haftLen / 2 + 0.1;
  grp.add(haft);

  let hd;
  if (def.key === 'maul')       hd = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.40), headMat);
  else if (def.key === 'blade') hd = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.10, 0.30), headMat);
  else if (def.key === 'spear') hd = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 4), headMat);
  else if (def.key === 'flail') hd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), headMat);
  else                          hd = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.50, 0.34), headMat);
  hd.position.y = -haftLen + (def.key === 'blade' ? -0.35 : 0.0);
  if (def.key === 'blade') hd.position.y = -0.62;
  grp.add(hd);

  const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), gemMat);
  gem.position.y = 0.06;
  grp.add(gem);

  grp.rotation.x = -0.5;
  p.weaponPivot.add(grp);
  p.weapon = grp;
}

// ─── 12 · Blocks the player places ───────────────────────────────────────────

function makeBlockMeshes(){
  const geo = new THREE.BoxGeometry(1, 1, 1);
  blockMeshes = MATS.map(m => {
    const mat = clayMat({ rep: 1, mat: {
      color: m.col,
      transparent: !!m.glass, opacity: m.glass ? 0.55 : 1,
    }});
    if (m.light){ mat.emissive = new THREE.Color(0xff9a2d); mat.emissiveIntensity = 1; }
    const im = new THREE.InstancedMesh(geo, mat, MAX_BLOCKS);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.count = 0;
    im.frustumCulled = false;
    S.world.add(im);
    return im;
  });
}

function refreshBlocks(){
  const per = MATS.map(() => []);
  for (const b of blocks.values()) per[b.mat].push(b);
  const mx = new THREE.Matrix4();
  per.forEach((list, i) => {
    const im = blockMeshes[i];
    const n = Math.min(list.length, MAX_BLOCKS);
    for (let k = 0; k < n; k++){
      const b = list[k];
      mx.makeTranslation(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      im.setMatrixAt(k, mx);
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
  });
  refreshBlockLights();
}

//  Lanterns are the only blocks that light, and only the six nearest get a
//  real light, because a hundred point lights is a slideshow.
function refreshBlockLights(){
  if (!S.blockLights){
    S.blockLights = [];
    for (let i = 0; i < 6; i++){
      const l = new THREE.PointLight(0xffb74d, 0, 16, 1.8);
      l.visible = false;
      S.world.add(l);
      S.blockLights.push(l);
    }
  }
  const lit = [];
  for (const b of blocks.values()){
    if (MATS[b.mat].light) lit.push(b);
  }
  lit.sort((a, c) =>
    (a.x - Pl.pos.x) ** 2 + (a.z - Pl.pos.z) ** 2 -
    ((c.x - Pl.pos.x) ** 2 + (c.z - Pl.pos.z) ** 2));
  S.blockLights.forEach((l, i) => {
    const b = lit[i];
    if (!b){ l.visible = false; return; }
    l.visible = true;
    l.intensity = 2.4;
    l.position.set(b.x + 0.5, b.y + 1.0, b.z + 0.5);
  });
  S.litBlocks = lit;
}

const bkey = (x, y, z) => x + ',' + y + ',' + z;

function blockAt(x, y, z){ return blocks.get(bkey(x, y, z)); }

function solidAt(wx, wy, wz){
  const b = blockAt(Math.floor(wx), Math.floor(wy), Math.floor(wz));
  return !!b;
}

// ─── 13 · Loot ───────────────────────────────────────────────────────────────

const PREFIX = ['Baked','Kilnworked','Thumbed','Slipcast','Fired','Pressed','Glaze-run',
                'Grogged','Wedged','Burnished','Cracked','Scored'];

function rollRarity(rnd, lift){
  const w = RARITY.map((r, i) => r.w * (1 + lift * i * 0.55));
  const tot = w.reduce((a, b) => a + b, 0);
  let r = rnd() * tot;
  for (let i = 0; i < w.length; i++){ r -= w[i]; if (r <= 0) return RARITY[i]; }
  return RARITY[0];
}

let itemSeq = 1;
function rollItem(rnd, lift, forceKind){
  const rar = rollRarity(rnd, lift);
  const kind = forceKind || (rnd() < 0.52 ? 'weapon' : 'armour');
  const pre = pick(rnd, PREFIX);
  if (kind === 'weapon'){
    const def = pick(rnd, WEAPONS);
    const roll = 0.88 + rnd() * 0.3;
    return {
      id: itemSeq++, kind: 'weapon', type: def.key, rarity: rar.key,
      name: `${rar.name} ${pre} ${def.name}`,
      dmg: Math.round(def.dmg * rar.mult * roll * (1 + lift * 0.16)),
      spd: def.spd * (1 - (rar.mult - 1) * 0.08),
      reach: def.reach, arc: def.arc, col: def.col,
    };
  }
  const def = pick(rnd, ARMOURS);
  const roll = 0.88 + rnd() * 0.3;
  return {
    id: itemSeq++, kind: 'armour', slot: def.key, rarity: rar.key,
    name: `${rar.name} ${pre} ${def.name}`,
    armour: Math.round(def.base * rar.mult * roll * (1 + lift * 0.18)),
  };
}

function itemScore(it){
  if (!it) return -1;
  return it.kind === 'weapon' ? it.dmg / it.spd : it.armour;
}

function equipSlotOf(it){ return it.kind === 'weapon' ? 'weapon' : it.slot; }

function equip(it){
  const slot = equipSlotOf(it);
  const old = St.gear[slot];
  St.gear[slot] = it;
  const i = St.inv.indexOf(it);
  if (i >= 0) St.inv.splice(i, 1);
  if (old) St.inv.push(old);
  if (slot === 'weapon') refreshWeaponMesh();
  refreshGearPlates();
  recomputeStats();
}

function refreshGearPlates(){
  const p = Pl.parts;
  const paint = (mesh, it) => {
    if (!mesh) return;
    mesh.visible = !!it;
    if (it){
      const rar = RARITY.find(r => r.key === it.rarity) || RARITY[0];
      mesh.material.color.setHex(rar.hex).multiplyScalar(0.9);
    }
  };
  paint(p.helm, St.gear.head);
  paint(p.plate, St.gear.chest);
  paint(p.greave, St.gear.legs);
  paint(p.greave2, St.gear.legs);
}

function recomputeStats(){
  const a = ['head','chest','legs'].reduce((s, k) =>
    s + (St.gear[k] ? St.gear[k].armour : 0), 0);
  St.armour = a;
  St.maxHp = 100 + a * 1.6 + (St.level - 1) * 12;
  St.hp = Math.min(St.hp, St.maxHp);
}

function dropLoot(x, y, z, tier){
  const rnd = Math.random;
  //  Every single one of them leaves something. That is the deal the game
  //  makes with the player on the first night, and it never breaks it.
  const lift = (St.day - 1) * 0.09 + (tier - 1) * 0.5;
  const it = rollItem(rnd, lift);
  const rar = RARITY.find(r => r.key === it.rarity) || RARITY[0];
  const geo = it.kind === 'weapon'
    ? new THREE.OctahedronGeometry(0.34, 0)
    : new THREE.BoxGeometry(0.52, 0.52, 0.52);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: rar.hex }));
  mesh.position.set(x, y + 0.9, z);
  S.world.add(mesh);
  const halo = new THREE.PointLight(rar.hex, 1.6, 6, 2);
  halo.position.copy(mesh.position);
  S.world.add(halo);
  drops.push({ it, mesh, halo, t: 0 });
  return it;
}

// ─── 14 · Particles ──────────────────────────────────────────────────────────

const PMAX = 260;
let parts = [];
function makeParticles(){
  const geo = whiteColors(new THREE.BoxGeometry(0.16, 0.16, 0.16));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  S.parts = new THREE.InstancedMesh(geo, mat, PMAX);
  S.parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  S.parts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PMAX * 3), 3);
  S.parts.count = 0;
  S.parts.frustumCulled = false;
  S.world.add(S.parts);
  parts = [];
}

function burst(x, y, z, n, hex, power){
  for (let i = 0; i < n && parts.length < PMAX; i++){
    parts.push({
      p: new THREE.Vector3(x, y, z),
      v: new THREE.Vector3((Math.random() - 0.5) * power,
                           Math.random() * power * 0.9 + 1.2,
                           (Math.random() - 0.5) * power),
      life: 0.55 + Math.random() * 0.7,
      s: 0.6 + Math.random() * 1.1,
      hex,
    });
  }
}

function tickParticles(dt){
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), vs = new THREE.Vector3();
  for (let i = parts.length - 1; i >= 0; i--){
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0){ parts.splice(i, 1); continue; }
    p.v.y -= 22 * dt;
    p.p.addScaledVector(p.v, dt);
    const gy = groundY(p.p.x, p.p.z);
    if (p.p.y < gy + 0.08){ p.p.y = gy + 0.08; p.v.y *= -0.34; p.v.x *= 0.7; p.v.z *= 0.7; }
  }
  const n = Math.min(parts.length, PMAX);
  for (let i = 0; i < n; i++){
    const p = parts[i];
    q.setFromEuler(new THREE.Euler(p.p.x * 2, p.p.y * 2, p.p.z * 2));
    vs.setScalar(p.s * clamp(p.life, 0.1, 1));
    mx.compose(p.p, q, vs);
    S.parts.setMatrixAt(i, mx);
    _c.setHex(p.hex);
    S.parts.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
  }
  S.parts.count = n;
  S.parts.instanceMatrix.needsUpdate = true;
  S.parts.instanceColor.needsUpdate = true;
}

// ─── 15 · Monsters ───────────────────────────────────────────────────────────

function makeMob(kind, x, z){
  const def = MOBS[kind];
  const g = new THREE.Group();
  const body = clayMat({ rep: 1, mat: { color: def.col } });
  const eye = new THREE.MeshBasicMaterial({ color: def.eye });
  const B = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  const scale = def.h / 1.9;
  const torso = B(def.r * 1.9, def.h * 0.5, def.r * 1.3, body);
  torso.position.y = def.h * 0.58; g.add(torso);
  const head = B(def.r * 1.25, def.r * 1.1, def.r * 1.2, body);
  head.position.y = def.h * 0.95; g.add(head);

  const e1 = B(def.r * 0.26, def.r * 0.20, 0.06, eye);
  e1.position.set(-def.r * 0.3, def.h * 0.97, def.r * 0.62); g.add(e1);
  const e2 = e1.clone(); e2.position.x = def.r * 0.3; g.add(e2);

  const armL = B(def.r * 0.5, def.h * 0.46, def.r * 0.5, body);
  armL.geometry.translate(0, -def.h * 0.23, 0);
  armL.position.set(-def.r * 1.15, def.h * 0.78, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = def.r * 1.15; g.add(armR);

  let legL = null, legR = null;
  if (!def.flies){
    legL = B(def.r * 0.6, def.h * 0.40, def.r * 0.62, body);
    legL.geometry.translate(0, -def.h * 0.20, 0);
    legL.position.set(-def.r * 0.5, def.h * 0.40, 0); g.add(legL);
    legR = legL.clone(); legR.position.x = def.r * 0.5; g.add(legR);
  }

  //  A cracked-glaze seam that glows: reads at distance in the dark.
  const seam = new THREE.Mesh(new THREE.BoxGeometry(def.r * 0.22, def.h * 0.42, 0.05),
                              new THREE.MeshBasicMaterial({ color: def.eye }));
  seam.position.set(0, def.h * 0.58, def.r * 0.68);
  g.add(seam);

  const y = groundY(x, z);
  g.position.set(x, y, z);
  S.world.add(g);

  const hpMul = 1 + (St.day - 1) * 0.17;
  const m = {
    kind, def, g, torso, head, armL, armR, legL, legR, seam,
    hp: def.hp * hpMul, maxHp: def.hp * hpMul,
    x, z, y, vy: 0, yaw: 0, cd: 0, phase: Math.random() * 6.28,
    hurt: 0, dead: false, deadT: 0, stun: 0, bob: Math.random() * 6.28,
  };
  mobs.push(m);
  return m;
}

function spawnWave(){
  const want = Math.min(MAX_MOBS, 3 + Math.floor(St.day * 1.25));
  const alive = mobs.filter(m => !m.dead).length;
  let toSpawn = Math.min(want - alive, 3);
  let guard = 0;
  while (toSpawn > 0 && guard++ < 40){
    const a = Math.random() * 6.2832;
    const d = 26 + Math.random() * 26;
    const x = Pl.pos.x + Math.cos(a) * d;
    const z = Pl.pos.z + Math.sin(a) * d;
    if (Math.abs(x) > HALF - 6 || Math.abs(z) > HALF - 6) continue;
    if (Math.hypot(x, z) < keepR() + 8 + St.kiln.brazier * 5) continue;  // the ring holds
    if (nearLantern(x, z, 9)) continue;                 // lanterns hold too
    if (groundY(x, z) < WATER_Y + 0.3) continue;

    const r = Math.random();
    let kind = 'husk';
    if (St.day >= 2 && r < 0.30) kind = 'stalker';
    else if (St.day >= 3 && r < 0.46) kind = 'lumber';
    else if (St.day >= 4 && r < 0.62) kind = 'wisp';
    else if (St.day >= 6 && r < 0.70) kind = 'molder';
    else if (r < 0.30) kind = 'stalker';
    makeMob(kind, x, z);
    toSpawn--;
  }
}

function nearLantern(x, z, r){
  if (!S.litBlocks) return false;
  for (const b of S.litBlocks){
    if ((b.x - x) ** 2 + (b.z - z) ** 2 < r * r) return true;
  }
  return false;
}

function hurtMob(m, dmg, kx, kz){
  if (m.dead) return;
  m.hp -= dmg;
  m.hurt = 0.16;
  m.stun = 0.10;
  m.x += kx; m.z += kz;
  burst(m.g.position.x, m.g.position.y + m.def.h * 0.6, m.g.position.z,
        5, m.def.col, 4.5);
  dmgNumber(m.g.position.x, m.g.position.y + m.def.h * 0.9, m.g.position.z, Math.round(dmg));
  if (m.hp <= 0) killMob(m);
}

function killMob(m){
  m.dead = true; m.deadT = 0.9;
  St.kills++;
  St.combo++; St.comboT = 3.2;
  St.xp += 12 * m.def.tier;
  burst(m.g.position.x, m.g.position.y + m.def.h * 0.5, m.g.position.z,
        16, m.def.col, 8);
  burst(m.g.position.x, m.g.position.y + m.def.h * 0.5, m.g.position.z,
        6, m.def.eye, 9);
  St.res.ember += m.def.tier;
  const it = dropLoot(m.g.position.x, m.g.position.y, m.g.position.z, m.def.tier);
  toast(`${m.def.name} down · ${it.name}`, RARITY.find(r => r.key === it.rarity).col);
  St.shake = Math.max(St.shake, 0.22 * m.def.tier);
  while (St.xp >= St.level * 90){
    St.xp -= St.level * 90;
    St.level++;
    recomputeStats();
    St.hp = St.maxHp;
    toast(`Level ${St.level}`, '#ffb03d');
  }
}

function tickMobs(dt){
  const px = Pl.pos.x, pz = Pl.pos.z;
  for (let i = mobs.length - 1; i >= 0; i--){
    const m = mobs[i];
    if (m.dead){
      m.deadT -= dt;
      m.g.rotation.z = lerp(m.g.rotation.z, Math.PI / 2, dt * 6);
      m.g.position.y -= dt * 1.2;
      m.g.scale.setScalar(Math.max(0.01, m.deadT / 0.9));
      if (m.deadT <= 0){ S.world.remove(m.g); mobs.splice(i, 1); }
      continue;
    }

    //  Daylight is lethal to them. They do not merely stop spawning.
    if (!St.night){
      m.hp -= dt * 34;
      m.hurt = 0.1;
      if (Math.random() < dt * 6) burst(m.g.position.x, m.g.position.y + 1, m.g.position.z, 1, 0xffd47a, 3);
      if (m.hp <= 0){ killMob(m); continue; }
    }

    const dx = px - m.x, dz = pz - m.z;
    const d = Math.hypot(dx, dz) || 1;
    m.yaw = Math.atan2(dx, dz);

    if (m.stun > 0){ m.stun -= dt; }
    else {
      //  The ring pushes them out, so the base is always a real refuge.
      const dc = Math.hypot(m.x, m.z);
      let mvx = dx / d, mvz = dz / d;
      if (dc < keepR() + 1.5){
        mvx = m.x / (dc || 1); mvz = m.z / (dc || 1);
      }
      const speed = m.def.spd * (St.night ? 1 : 1.5);
      if (d > (m.def.ranged ? 11 : m.def.r + 1.2)){
        m.x += mvx * speed * dt;
        m.z += mvz * speed * dt;
      }
    }

    const gy = groundY(m.x, m.z);
    if (m.def.flies){
      m.y = lerp(m.y, gy + 2.2 + Math.sin(SHW.clockT * 1.4 + m.bob) * 0.5, dt * 3);
    } else {
      m.y = lerp(m.y, gy, dt * 14);
    }
    m.g.position.set(m.x, m.y, m.z);
    m.g.rotation.y = m.yaw;

    //  Stop-motion walk: pose snaps on the 12fps step, never between.
    const ph = St.step * (m.def.spd * 1.6) + m.phase;
    const sw = Math.sin(ph) * 0.8;
    if (m.legL){ m.legL.rotation.x = sw; m.legR.rotation.x = -sw; }
    m.armL.rotation.x = -sw * 0.8;
    m.armR.rotation.x = sw * 0.8;
    m.g.position.y += Math.abs(Math.sin(ph * 2)) * 0.06;

    if (m.hurt > 0){
      m.hurt -= dt;
      const f = m.hurt > 0 ? 1 : 0;
      m.torso.material.emissive = m.torso.material.emissive || new THREE.Color();
      m.torso.material.emissive.setRGB(f, f * 0.3, f * 0.3);
    }

    //  Attack
    m.cd -= dt;
    if (m.cd <= 0 && !St.dead){
      if (m.def.ranged && d < 18 && d > 4){
        m.cd = 2.2;
        spit(m);
      } else if (d < m.def.r + 1.6){
        m.cd = 1.35;
        hurtPlayer(m.def.dmg * (1 + (St.day - 1) * 0.10));
        m.armR.rotation.x = -2.2;
      }
    }
  }
}

function spit(m){
  const geo = new THREE.IcosahedronGeometry(0.22, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: m.def.eye }));
  mesh.position.set(m.x, m.y + m.def.h * 0.8, m.z);
  S.world.add(mesh);
  const dir = new THREE.Vector3(Pl.pos.x - m.x, (Pl.pos.y + 1.2) - (m.y + m.def.h * 0.8), Pl.pos.z - m.z).normalize();
  projectiles.push({ mesh, dir, spd: 16, life: 2.4, dmg: m.def.dmg * 0.8 });
}

function tickProjectiles(dt){
  for (let i = projectiles.length - 1; i >= 0; i--){
    const p = projectiles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.dir, p.spd * dt);
    const hit = p.mesh.position.distanceTo(new THREE.Vector3(Pl.pos.x, Pl.pos.y + 1.1, Pl.pos.z)) < 1.0;
    const gy = groundY(p.mesh.position.x, p.mesh.position.z);
    if (hit) hurtPlayer(p.dmg);
    if (hit || p.life <= 0 || p.mesh.position.y < gy){
      burst(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 4, 0xff9a3d, 4);
      S.world.remove(p.mesh); projectiles.splice(i, 1);
    }
  }
}

// ─── 16 · Player damage ──────────────────────────────────────────────────────

function hurtPlayer(raw){
  if (St.dead || Pl.hurtT > 0.35) return;
  const reduce = St.armour / (St.armour + 55);
  const dmg = raw * (1 - reduce);
  St.hp -= dmg;
  Pl.hurtT = 0.55;
  St.combo = 0;
  St.shake = Math.max(St.shake, 0.35);
  flash(0.55);
  burst(Pl.pos.x, Pl.pos.y + 1.2, Pl.pos.z, 6, 0xff3050, 5);
  if (St.hp <= 0){
    St.hp = 0; St.dead = true; St.respawnT = 2.6;
    hud.dead.classList.add('show');
  }
}

// ─── 17 · Sky, sun, and the clock everything obeys ───────────────────────────

const SKY = {
  dawn:  { top:0xff9a5c, bot:0xffd9a0, fog:0xffc08a, sun:0xfff0c0, amb:0x6a5540, sunI:1.5, ambI:0.75 },
  day:   { top:0x3fa9f5, bot:0xbfe8ff, fog:0xbfe4ff, sun:0xfff6e0, amb:0x88a0c0, sunI:2.2, ambI:0.95 },
  dusk:  { top:0x7b3f9a, bot:0xff7a5c, fog:0xd07a7a, sun:0xffb06a, amb:0x5a4460, sunI:1.2, ambI:0.62 },
  night: { top:0x0a1130, bot:0x1d2c56, fog:0x141d3c, sun:0x9dc0ff, amb:0x41588a, sunI:0.62, ambI:0.60 },
};

function makeSky(){
  const geo = new THREE.SphereGeometry(420, 20, 14);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(SKY.day.top) },
      bot: { value: new THREE.Color(SKY.day.bot) },
      stars: { value: 0 },
    },
    vertexShader: `
      varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 bot; uniform float stars;
      varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(floor(p*64.0), vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){
        float t = clamp(vP.y/420.0*0.5+0.5, 0.0, 1.0);
        vec3 c = mix(bot, top, pow(t, 0.8));
        // Banded sky: posterised, like a painted cyclorama behind the set.
        c = floor(c * 14.0) / 14.0;
        float s = h(normalize(vP));
        if (s > 0.9975) c += vec3(stars) * (s - 0.9975) * 420.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  S.sky = new THREE.Mesh(geo, mat);
  S.sky.frustumCulled = false;
  SHW.scene.add(S.sky);

  S.sun = new THREE.DirectionalLight(0xffffff, 2.2);
  S.sun.position.set(60, 90, 30);
  SHW.scene.add(S.sun);
  SHW.scene.add(S.sun.target);

  S.amb = new THREE.HemisphereLight(0x9fbcd8, 0x5e8a3e, 1.3);
  SHW.scene.add(S.amb);

  //  A visible disc, because a stop-motion sky needs a prop sun in it.
  S.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(14, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff3c0, fog: false }));
  SHW.scene.add(S.sunDisc);
  S.moonDisc = new THREE.Mesh(new THREE.CircleGeometry(10, 16),
    new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false }));
  SHW.scene.add(S.moonDisc);

  SHW.scene.fog = new THREE.Fog(0xbfe4ff, 60, 190);
}

function lerpSky(a, b, t){
  const o = {};
  for (const k of ['top','bot','fog','sun','amb']){
    o[k] = new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t);
  }
  o.sunI = lerp(a.sunI, b.sunI, t);
  o.ambI = lerp(a.ambI, b.ambI, t);
  return o;
}

function updateSky(dt){
  //  0 .. 1 across the whole cycle. Day occupies the first DAY_LEN.
  const c = St.cycle / CYCLE;
  const dayFrac = DAY_LEN / CYCLE;
  let m;
  if (c < 0.06)                m = lerpSky(SKY.dawn, SKY.day, c / 0.06);
  else if (c < dayFrac - 0.09) m = SKY.day;
  else if (c < dayFrac)        m = lerpSky(SKY.day, SKY.dusk, (c - (dayFrac - 0.09)) / 0.09);
  else if (c < dayFrac + 0.07) m = lerpSky(SKY.dusk, SKY.night, (c - dayFrac) / 0.07);
  else if (c < 0.94)           m = SKY.night;
  else                         m = lerpSky(SKY.night, SKY.dawn, (c - 0.94) / 0.06);

  S.sky.material.uniforms.top.value.copy(new THREE.Color(m.top));
  S.sky.material.uniforms.bot.value.copy(new THREE.Color(m.bot));
  S.sky.material.uniforms.stars.value = St.night ? 1 : 0;
  S.sun.color.copy(new THREE.Color(m.sun));
  S.sun.intensity = m.sunI;
  S.amb.color.copy(new THREE.Color(m.amb));
  S.amb.intensity = m.ambI;
  SHW.scene.fog.color.copy(new THREE.Color(m.fog));
  SHW.scene.fog.near = St.night ? 34 : 62;
  SHW.scene.fog.far  = St.night ? 128 : 200;
  SHW.renderer.setClearColor(new THREE.Color(m.bot));

  //  Sun arc. Noon overhead, and the low angles do the work on the clay.
  const ang = (St.cycle / DAY_LEN) * Math.PI;
  const sx = Math.cos(Math.PI - ang) * 170;
  const sy = Math.sin(ang) * 150;
  S.sun.position.set(Pl.pos.x + sx, Math.max(14, sy), Pl.pos.z + 60);
  S.sun.target.position.set(Pl.pos.x, 0, Pl.pos.z);
  S.sunDisc.position.set(Pl.pos.x + sx * 1.9, sy * 1.9 + 10, Pl.pos.z + 180);
  S.sunDisc.lookAt(SHW.camera.position);
  S.sunDisc.visible = !St.night;
  S.moonDisc.position.set(Pl.pos.x - sx * 1.9, Math.abs(sy) * 1.4 + 40, Pl.pos.z - 180);
  S.moonDisc.lookAt(SHW.camera.position);
  S.moonDisc.visible = St.night;

  //  Hearth and braziers breathe on the step, and harder at night.
  const f = 0.8 + Math.sin(St.step * 7.0) * 0.16 + Math.sin(St.step * 11.3) * 0.09;
  if (S.hearth) S.hearth.intensity = (St.night ? 4.6 : 2.2) * f;
  if (S.fire){
    S.fire.scale.setScalar(f * (St.night ? 1.25 : 1.0));
    S.fire.rotation.y = St.step * 2.2;
  }
  for (const b of (S.braziers || [])){
    b.scale.setScalar(0.85 + Math.sin(St.step * 6 + b.position.x) * 0.2);
    b.visible = true;
  }
  if (S.ring) S.ring.material.opacity = St.night ? 0.62 : 0.22;

  //  Torch the player carries, so night is navigable without being bright.
  if (S.torch){
    S.torch.visible = St.torch && St.night;
    S.torch.position.set(Pl.pos.x, Pl.pos.y + 2.0, Pl.pos.z);
    S.torch.intensity = (3.4 + Math.sin(St.step * 9) * 0.5);
  }
}

function advanceClock(dt){
  St.cycle += dt;
  if (St.cycle >= CYCLE){
    St.cycle -= CYCLE;
    St.day++;
    St.nightsSurvived++;
    toast(`Day ${St.day}. You kept it.`, '#7dffb3');
    St.hp = Math.min(St.maxHp, St.hp + 30);
    save();
  }
  const wasNight = St.night;
  St.night = St.cycle >= DAY_LEN;
  if (St.night && !wasNight){
    toast('Night ' + St.day + '. Something is coming out of the trees.', '#ff5268');
    hud.root.classList.add('night');
    St.spawnT = 0;
  }
  if (!St.night && wasNight){
    hud.root.classList.remove('night');
    toast('Dawn. What is still out there is burning.', '#ffd47a');
  }
  if (St.night){
    St.spawnT = (St.spawnT || 0) - dt;
    if (St.spawnT <= 0){
      St.spawnT = Math.max(2.2, 7 - St.day * 0.35);
      spawnWave();
    }
  }
}

// ─── 18 · Camera and movement ────────────────────────────────────────────────

function updatePlayer(dt){
  if (St.dead){
    St.respawnT -= dt;
    if (St.respawnT <= 0) respawn();
    return;
  }

  const k = keys;
  let fx = 0, fz = 0;
  if (k.has('w')) fz += 1;
  if (k.has('s')) fz -= 1;
  if (k.has('a')) fx -= 1;
  if (k.has('d')) fx += 1;
  const mag = Math.hypot(fx, fz);
  const sprint = k.has('shift') && St.stam > 1 && mag > 0;

  //  Camera-relative movement, which is what over-the-shoulder demands.
  const cy = Pl.yaw;
  const sinY = Math.sin(cy), cosY = Math.cos(cy);
  let wx = 0, wz = 0;
  if (mag > 0){
    const nx = fx / mag, nz = fz / mag;
    wx = (-sinY * nz + cosY * nx);
    wz = (-cosY * nz - sinY * nx);
  }

  const base = 6.2;
  const speed = base * (sprint ? 1.85 : 1) * (St.mode === 'fight' ? 1 : 0.9);
  const accel = Pl.onGround ? 42 : 12;
  Pl.vel.x = lerp(Pl.vel.x, wx * speed, clamp(accel * dt, 0, 1));
  Pl.vel.z = lerp(Pl.vel.z, wz * speed, clamp(accel * dt, 0, 1));

  if (sprint) St.stam = Math.max(0, St.stam - dt * 19);
  else St.stam = Math.min(St.maxStam, St.stam + dt * 13);

  //  Gravity and jump.
  Pl.vel.y -= 26 * dt;
  if (k.has(' ') && Pl.onGround){ Pl.vel.y = 9.4; Pl.onGround = false; }

  let nx = Pl.pos.x + Pl.vel.x * dt;
  let nz = Pl.pos.z + Pl.vel.z * dt;
  nx = clamp(nx, -HALF + 2, HALF - 2);
  nz = clamp(nz, -HALF + 2, HALF - 2);

  //  Blocks are solid. Step up one, and refuse the rest.
  const feet = Pl.pos.y;
  const tryMove = (ax, az) => {
    const bx = Math.floor(ax), bz = Math.floor(az);
    for (let yy = Math.floor(feet); yy <= Math.floor(feet + 1.7); yy++){
      if (blockAt(bx, yy, bz)){
        //  Step assist: a single block is a stair, not a wall.
        if (yy === Math.floor(feet) && !blockAt(bx, yy + 1, bz) && !blockAt(bx, yy + 2, bz)){
          Pl.pos.y = yy + 1.02;
          return true;
        }
        return false;
      }
    }
    return true;
  };
  if (tryMove(nx, Pl.pos.z)) Pl.pos.x = nx; else Pl.vel.x = 0;
  if (tryMove(Pl.pos.x, nz)) Pl.pos.z = nz; else Pl.vel.z = 0;

  Pl.pos.y += Pl.vel.y * dt;

  //  Ground: terrain, or the top of a stack of blocks under the feet.
  let gy = groundY(Pl.pos.x, Pl.pos.z);
  const bx = Math.floor(Pl.pos.x), bz = Math.floor(Pl.pos.z);
  for (let yy = Math.floor(gy); yy < Math.floor(gy) + 22; yy++){
    if (blockAt(bx, yy, bz)) gy = Math.max(gy, yy + 1);
  }
  if (Pl.pos.y <= gy){
    Pl.pos.y = gy; Pl.vel.y = 0;
    if (!Pl.onGround && St.fallV < -18) hurtPlayer(Math.abs(St.fallV) - 16);
    Pl.onGround = true;
  } else {
    Pl.onGround = false;
  }
  St.fallV = Pl.vel.y;

  //  Drowning is not a mechanic here; water just slows you and pushes up.
  if (Pl.pos.y < WATER_Y - 0.4){
    Pl.vel.y += 34 * dt;
    Pl.vel.x *= 0.92; Pl.vel.z *= 0.92;
    St.stam = Math.max(0, St.stam - dt * 4);
  }

  if (Pl.hurtT > 0) Pl.hurtT -= dt;

  //  Regeneration near the Kiln: the reason to come home.
  const dBase = Math.hypot(Pl.pos.x, Pl.pos.z);
  if (dBase < keepR() && St.hp < St.maxHp){
    St.hp = Math.min(St.maxHp, St.hp + dt * benchRegen());
  }

  //  Puppet pose, snapped to the stop-motion step.
  Pl.group.position.set(Pl.pos.x, Pl.pos.y, Pl.pos.z);
  const moving = Math.hypot(Pl.vel.x, Pl.vel.z) > 0.6;
  if (moving) Pl.group.rotation.y = Math.atan2(Pl.vel.x, Pl.vel.z);
  else Pl.group.rotation.y = lerp(Pl.group.rotation.y, Pl.yaw + Math.PI, dt * 6);

  const sp = Math.hypot(Pl.vel.x, Pl.vel.z);
  Pl.walkPhase += dt * sp * 1.5;
  const ph = Math.floor(Pl.walkPhase * STEP_FPS) / STEP_FPS;
  const sw = moving ? Math.sin(ph * 5.2) * 0.95 : 0;
  const p = Pl.parts;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw * 0.85;
  p.torso.rotation.z = moving ? Math.sin(ph * 10.4) * 0.05 : 0;
  p.head.rotation.x = clamp(-Pl.pitch * 0.4, -0.5, 0.5);
  p.group = Pl.group;

  //  Swing arc for the right arm and whatever it is holding.
  if (Pl.swing > 0){
    Pl.swing -= dt;
    const w = St.gear.weapon;
    const dur = w ? (WEAPONS.find(x => x.key === w.type) || WEAPONS[0]).spd : 0.5;
    const t = 1 - clamp(Pl.swing / dur, 0, 1);
    const a = Math.sin(t * Math.PI) * 2.5;
    p.armR.rotation.x = -a;
    p.weaponPivot.rotation.x = -a;
    p.weaponPivot.rotation.z = Math.sin(t * Math.PI) * 0.7 * Pl.swingDir;
  } else {
    p.armR.rotation.x = lerp(p.armR.rotation.x, sw * 0.85, dt * 10);
    p.weaponPivot.rotation.x = lerp(p.weaponPivot.rotation.x, sw * 0.85, dt * 10);
    p.weaponPivot.rotation.z = lerp(p.weaponPivot.rotation.z, 0, dt * 10);
  }

  //  Hit flash on the puppet itself.
  const hf = Pl.hurtT > 0 ? clamp(Pl.hurtT / 0.55, 0, 1) : 0;
  p.torso.material.emissive = p.torso.material.emissive || new THREE.Color();
  p.torso.material.emissive.setRGB(hf, 0, 0);
}

function respawn(){
  St.dead = false;
  St.hp = St.maxHp * 0.6;
  Pl.pos.set(0, groundY(0, 6) + 1, 6);
  Pl.vel.set(0, 0, 0);
  St.combo = 0;
  //  A death costs the cycle, not the run. You wake at the Kiln at dawn.
  St.cycle = 2;
  St.night = false;
  hud.root.classList.remove('night');
  hud.dead.classList.remove('show');
  toast('The Kiln relit you. Dawn again.', '#7dffb3');
  save();
}

//  Camera occlusion. A stop-motion set is full of things taller than the
//  puppet, and a third-person camera that walks into a tree trunk shows the
//  player the inside of a tree. Trees near the player are collected once a
//  frame, then the camera is marched out from the head and stopped at the
//  first thing it would end up inside of.
const _nearTrees = [];
const _nearRocks = [];
function refreshNearTrees(){
  _nearTrees.length = 0;
  _nearRocks.length = 0;
  const R = 15;
  for (const t of trees){
    if (!t.alive) continue;
    if (Math.abs(t.x - Pl.pos.x) > R || Math.abs(t.z - Pl.pos.z) > R) continue;
    _nearTrees.push(t);
  }
  for (const r of rocks){
    if (!r.alive) continue;
    if (Math.abs(r.x - Pl.pos.x) > R || Math.abs(r.z - Pl.pos.z) > R) continue;
    _nearRocks.push(r);
  }
}

function camBlocked(p){
  for (let i = 0; i < _nearTrees.length; i++){
    const t = _nearTrees[i];
    const dx = p.x - t.x, dz = p.z - t.z;
    const flat = dx * dx + dz * dz;
    const h = 2.6 * t.s;
    if (flat < 0.36 && p.y > t.y - 0.2 && p.y < t.y + h + 0.3) return true;
    const dy = p.y - (t.y + h + 0.55 * t.s);
    const r = 1.55 * t.s;
    if (flat + dy * dy < r * r) return true;
  }
  for (let i = 0; i < _nearRocks.length; i++){
    const r = _nearRocks[i];
    const dx = p.x - r.x, dy = p.y - (r.y + r.s * 0.4), dz = p.z - r.z;
    const rr = r.s * 1.15;
    if (dx * dx + dy * dy + dz * dz < rr * rr) return true;
  }
  if (solidAt(p.x, p.y, p.z)) return true;
  return false;
}

function updateCamera(dt){
  const c = SHW.camera;
  const tgt = new THREE.Vector3(Pl.pos.x, Pl.pos.y + 1.55, Pl.pos.z);

  //  Over the shoulder: behind, up, and offset to the right.
  const sinY = Math.sin(Pl.yaw), cosY = Math.cos(Pl.yaw);
  const back = new THREE.Vector3(sinY, 0, cosY);
  const right = new THREE.Vector3(cosY, 0, -sinY);
  const dist = Cam.dist * (St.mode === 'fight' ? 1 : 1.18);
  const want = tgt.clone()
    .addScaledVector(back, dist * Math.cos(Pl.pitch))
    .addScaledVector(right, Cam.side)
    .add(new THREE.Vector3(0, Cam.height - Math.sin(Pl.pitch) * dist, 0));

  //  Never let the ground eat the camera.
  const gy = groundY(want.x, want.z) + 1.0;
  if (want.y < gy) want.y = gy;

  //  March out from the head and stop short of anything solid.
  refreshNearTrees();
  const ray = want.clone().sub(tgt);
  const len = ray.length();
  if (len > 0.2){
    ray.multiplyScalar(1 / len);
    const probe = new THREE.Vector3();
    let reach = len;
    for (let d = 1.0; d <= len; d += 0.45){
      probe.copy(tgt).addScaledVector(ray, d);
      const pg = groundY(probe.x, probe.z) + 0.6;
      if (probe.y < pg || camBlocked(probe)){ reach = Math.max(1.4, d - 0.45); break; }
    }
    if (reach < len) want.copy(tgt).addScaledVector(ray, reach);
  }

  //  Snap in fast when something is in the way, ease out slowly when it clears,
  //  so a tree edge does not make the camera pump.
  const closing = want.distanceTo(tgt) < c.position.distanceTo(tgt);
  c.position.lerp(want, clamp(dt * (closing ? 26 : 9), 0, 1));

  //  Arcade shake, stepped so it reads as a shaken camera rig.
  if (St.shake > 0){
    St.shake = Math.max(0, St.shake - dt * 1.5);
    const s = St.shake;
    c.position.x += (Math.random() - 0.5) * s;
    c.position.y += (Math.random() - 0.5) * s;
  }
  c.lookAt(tgt.x, tgt.y + Math.sin(Pl.pitch) * 2.6 + 0.25, tgt.z);
  if (Pl.group) Pl.group.visible = c.position.distanceTo(tgt) > 1.9;
}

// ─── 19 · Fighting, felling, quarrying ───────────────────────────────────────

function attack(){
  if (St.dead || Pl.swing > 0) return;
  const w = St.gear.weapon;
  const def = w ? (WEAPONS.find(x => x.key === w.type) || WEAPONS[0])
                : { dmg: 8, spd: 0.46, reach: 2.2, arc: 1.2 };
  const dmg = w ? w.dmg : 8;
  Pl.swing = def.spd;
  Pl.swingDir *= -1;
  if (St.stam > 6) St.stam -= 5;

  //  Aimed by the CAMERA, not by the puppet. The puppet turns to face movement
  //  the instant you touch a key, so a body-aimed arc points wherever you last
  //  walked rather than where you are looking. That is the whole reason
  //  strafing past something and swinging felt like it did nothing.
  SHW.camera.getWorldDirection(_fwd);
  const fl = Math.hypot(_fwd.x, _fwd.z) || 1;
  const fx = _fwd.x / fl, fz = _fwd.z / fl;
  Pl.group.rotation.y = Math.atan2(fx, fz);
  let landed = 0;

  for (const m of mobs){
    if (m.dead) continue;
    const dx = m.x - Pl.pos.x, dz = m.z - Pl.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > def.reach + m.def.r) continue;
    //  Anything close enough to be standing on you is in the arc by
    //  definition. The old test divided by a distance near zero and quietly
    //  refused exactly when the player was closest.
    if (d > 1.1){
      const dot = (dx * fx + dz * fz) / d;
      if (dot < Math.cos(def.arc)) continue;
    }
    const crit = Math.random() < 0.14 + St.combo * 0.012;
    const mult = (1 + St.combo * 0.035) * (crit ? 2.1 : 1);
    hurtMob(m, dmg * mult, fx * 0.55, fz * 0.55);
    landed++;
  }

  //  Trees and boulders used to be swung at here. They are held on now — see
  //  section 30 — so a swing is a swing and nothing else.

  if (landed){
    St.hitStop = 0.055;
    St.shake = Math.max(St.shake, 0.14);
  }
}

// ─── 20 · Sculpting the ground ───────────────────────────────────────────────
//  A brush over the heightfield. Raising costs earth, lowering yields it, and
//  the Kiln's ground refuses both.

function aimPoint(maxDist){
  //  March along the camera ray until it is under the terrain.
  const c = SHW.camera;
  const dir = new THREE.Vector3();
  c.getWorldDirection(dir);
  const p = c.position.clone();
  let last = p.clone();
  for (let d = 0; d < maxDist; d += 0.4){
    p.addScaledVector(dir, 0.4);
    if (Math.abs(p.x) > HALF || Math.abs(p.z) > HALF) break;
    if (p.y <= groundY(p.x, p.z)) return { hit: p.clone(), prev: last.clone(), dir };
    if (solidAt(p.x, p.y, p.z)) return { hit: p.clone(), prev: last.clone(), dir, block: true };
    last.copy(p);
  }
  return { hit: null, prev: last.clone(), dir };
}

function sculpt(sign){
  const a = aimPoint(St.sculptReach + 8);
  if (!a.hit) return;
  const { x, z } = a.hit;
  if (Math.hypot(x, z) < keepR() + 1){
    toast('The Kiln ground will not move.', '#ff5268');
    return;
  }
  const r = St.brush;
  const ci = Math.round((x + HALF) / CELL);
  const cj = Math.round((z + HALF) / CELL);
  const rc = Math.ceil(r / CELL);
  let moved = 0;
  for (let j = -rc; j <= rc; j++){
    for (let i = -rc; i <= rc; i++){
      const gi = ci + i, gj = cj + j;
      if (gi < 0 || gi > GRID || gj < 0 || gj > GRID) continue;
      const wx = -HALF + gi * CELL, wz = -HALF + gj * CELL;
      if (Math.hypot(wx, wz) < keepR()) continue;
      const d = Math.hypot(i * CELL, j * CELL);
      if (d > r) continue;
      const fall = Math.pow(1 - d / r, 1.6);
      const amt = sign * fall * 1.25;
      HD[hIdx(gi, gj)] += amt;
      moved += Math.abs(amt);
    }
  }
  if (!moved) return;
  if (sign > 0){
    const cost = Math.ceil(moved * 0.5);
    if (St.res.earth < cost){ toast('Not enough earth.', '#ff5268'); return; }
    St.res.earth -= cost;
  } else {
    St.res.earth += Math.ceil(moved * 0.5);
  }
  rebuildTilesAround(x, z, r + CELL * 2);
  burst(x, groundY(x, z) + 0.4, z, 7, 0xb5813f, 5);
  St.shake = Math.max(St.shake, 0.06);
  St.dirty = true;
}

// ─── 21 · Building ───────────────────────────────────────────────────────────

function buildTarget(){
  const a = aimPoint(St.buildReach);
  if (!a.hit) return null;
  const p = a.prev;
  return { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z), hit: a.hit };
}

function placeBlock(){
  const t = buildTarget();
  if (!t) return;
  if (Math.hypot(t.x + 0.5, t.z + 0.5) < keepR() - 4){
    toast('Too close to the Kiln to build.', '#ff5268');
    return;
  }
  if (blocks.size >= MAX_BLOCKS){ toast('Build limit reached.', '#ff5268'); return; }
  if (blockAt(t.x, t.y, t.z)) return;
  //  Do not entomb the player.
  const px = Math.floor(Pl.pos.x), pz = Math.floor(Pl.pos.z);
  if (t.x === px && t.z === pz && t.y >= Math.floor(Pl.pos.y) && t.y <= Math.floor(Pl.pos.y + 1.8)) return;

  const m = MATS[St.matIdx];
  if (St.res[m.res] < m.cost){ toast(`Need ${m.cost} ${m.res}.`, '#ff5268'); return; }
  St.res[m.res] -= m.cost;
  blocks.set(bkey(t.x, t.y, t.z), { mat: St.matIdx, x: t.x, y: t.y, z: t.z });
  refreshBlocks();
  burst(t.x + 0.5, t.y + 0.5, t.z + 0.5, 4, m.col, 3.5);
  St.dirty = true;
}

function removeBlock(){
  const a = aimPoint(St.buildReach);
  if (!a.hit) return;
  const p = a.hit;
  const key = bkey(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
  const b = blocks.get(key);
  if (!b){
    //  Nothing there: probably aimed at terrain, which sculpt handles.
    return;
  }
  const m = MATS[b.mat];
  St.res[m.res] += m.cost;
  blocks.delete(key);
  refreshBlocks();
  burst(b.x + 0.5, b.y + 0.5, b.z + 0.5, 6, m.col, 5);
  St.dirty = true;
}

function makeGhost(){
  const geo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false });
  S.ghost = new THREE.Mesh(geo, mat);
  S.ghost.visible = false;
  S.world.add(S.ghost);

  const eg = new THREE.EdgesGeometry(geo);
  S.ghostEdge = new THREE.LineSegments(eg,
    new THREE.LineBasicMaterial({ color: 0xffffff }));
  S.ghostEdge.visible = false;
  S.world.add(S.ghostEdge);

  //  Sculpt brush footprint.
  S.brushRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.0, 40),
    new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.7,
                                  side: THREE.DoubleSide, depthWrite: false }));
  S.brushRing.rotation.x = -Math.PI / 2;
  S.brushRing.visible = false;
  S.world.add(S.brushRing);
}

function updateGhost(){
  const buildMode = St.mode === 'build';
  const sculptMode = St.mode === 'sculpt';
  S.ghost.visible = S.ghostEdge.visible = false;
  S.brushRing.visible = false;

  if (buildMode){
    const t = buildTarget();
    if (t){
      const ok = Math.hypot(t.x + 0.5, t.z + 0.5) >= keepR() - 4;
      S.ghost.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
      S.ghostEdge.position.copy(S.ghost.position);
      _c.setHex(ok ? MATS[St.matIdx].col : 0xff3050);
      S.ghost.material.color.copy(_c);
      S.ghostEdge.material.color.copy(_c);
      S.ghost.visible = S.ghostEdge.visible = true;
    }
  } else if (sculptMode){
    const a = aimPoint(St.sculptReach + 8);
    if (a.hit){
      const ok = Math.hypot(a.hit.x, a.hit.z) >= keepR() + 1;
      S.brushRing.position.set(a.hit.x, groundY(a.hit.x, a.hit.z) + 0.12, a.hit.z);
      S.brushRing.scale.setScalar(St.brush);
      S.brushRing.material.color.setHex(ok ? 0x7fdcff : 0xff3050);
      S.brushRing.visible = true;
    }
  }
}

// ─── 22 · Drops on the ground ────────────────────────────────────────────────

function tickDrops(dt){
  for (let i = drops.length - 1; i >= 0; i--){
    const d = drops[i];
    d.t += dt;
    const gy = groundY(d.mesh.position.x, d.mesh.position.z);
    d.mesh.position.y = gy + 0.95 + Math.sin(St.step * 3 + i) * 0.14;
    d.mesh.rotation.y = St.step * 1.6;
    d.mesh.rotation.x = Math.sin(St.step * 1.1) * 0.3;
    d.halo.position.copy(d.mesh.position);
    d.halo.intensity = 1.4 + Math.sin(St.step * 5 + i) * 0.5;

    const dist = Math.hypot(d.mesh.position.x - Pl.pos.x, d.mesh.position.z - Pl.pos.z);
    if (dist < 2.0){
      pickUp(d.it);
      S.world.remove(d.mesh); S.world.remove(d.halo);
      drops.splice(i, 1);
    } else if (d.t > 150){
      S.world.remove(d.mesh); S.world.remove(d.halo);
      drops.splice(i, 1);
    }
  }
}

function pickUp(it){
  const slot = equipSlotOf(it);
  const cur = St.gear[slot];
  const rar = RARITY.find(r => r.key === it.rarity) || RARITY[0];
  //  Auto-equip a strict upgrade. Arcade pace: no menu between you and better.
  if (itemScore(it) > itemScore(cur)){
    if (cur) St.inv.push(cur);
    St.gear[slot] = it;
    if (slot === 'weapon') refreshWeaponMesh();
    refreshGearPlates();
    recomputeStats();
    toast(`Equipped ${it.name}`, rar.col);
  } else {
    St.inv.push(it);
    if (St.inv.length > 40) St.inv.shift();
    toast(`Stowed ${it.name}`, rar.col);
  }
  St.dirty = true;
}

//  Scrapping at the bench turns spare gear into ember for lanterns.
function scrapAll(){
  if (!St.inv.length){ toast('Nothing spare to scrap.', '#9c93c6'); return; }
  let e = 0;
  for (const it of St.inv){
    const r = RARITY.findIndex(x => x.key === it.rarity);
    e += 1 + r;
  }
  St.inv.length = 0;
  St.res.ember += e;
  toast(`Scrapped for ${e} ember.`, '#ffb03d');
  renderInv();
  St.dirty = true;
}

// ─── 23 · HUD ────────────────────────────────────────────────────────────────

const CSS = `
#shw-root{position:absolute;inset:0;overflow:hidden;background:#05030c;
  font-family:'SF Mono','Menlo',monospace;color:#f5f0e4;user-select:none;}
#shw-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair;}
#shw-ui{position:absolute;inset:0;pointer-events:none;}
#shw-root *{box-sizing:border-box;}

/* Grain + vignette: the film the puppets were shot on */
#shw-grain{position:absolute;inset:0;pointer-events:none;opacity:.06;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  animation:shw-grain .45s steps(3) infinite;}
@keyframes shw-grain{0%{transform:translate(0,0)}33%{transform:translate(-2%,2%)}66%{transform:translate(2%,-1%)}100%{transform:translate(0,0)}}
#shw-vig{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at 50% 48%,transparent 56%,rgba(10,4,20,.46) 100%);}
#shw-flash{position:absolute;inset:0;pointer-events:none;background:#ff2f4f;opacity:0;
  transition:opacity .14s;}
#shw-root.night #shw-vig{background:radial-gradient(ellipse at 50% 46%,transparent 34%,rgba(2,2,14,.78) 100%);}

/* ── top bar ── */
#shw-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:flex-start;
  gap:14px;padding:14px 18px;}
.shw-plate{background:linear-gradient(150deg,rgba(14,7,24,.9),rgba(30,12,18,.78));
  border:1.5px solid rgba(255,176,61,.35);padding:8px 14px;
  clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px);}
.shw-plate .k{font-size:8px;letter-spacing:3.4px;color:#c09a6a;text-transform:uppercase;}
.shw-plate .v{font-size:16px;letter-spacing:2px;color:#ffd9a0;font-weight:700;margin-top:2px;}

#shw-clock{display:flex;align-items:center;gap:10px;}
#shw-dial{width:46px;height:46px;border-radius:50%;border:2px solid rgba(255,176,61,.5);
  position:relative;background:conic-gradient(#ffd47a 0turn,#ffd47a var(--day,.64turn),#1b2a55 var(--day,.64turn),#1b2a55 1turn);}
#shw-dial i{position:absolute;left:50%;top:50%;width:2px;height:18px;background:#fff;
  transform-origin:50% 100%;margin:-18px 0 0 -1px;
  transform:rotate(var(--hand,0deg));box-shadow:0 0 6px #fff;}

#shw-phase{font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#ffd47a;}
#shw-root.night #shw-phase{color:#ff7088;animation:shw-pulse 1.3s ease-in-out infinite;}
@keyframes shw-pulse{0%,100%{opacity:1}50%{opacity:.5}}

#shw-res{margin-left:auto;display:flex;gap:8px;}
.shw-res{background:rgba(10,6,20,.82);border:1px solid rgba(255,255,255,.14);
  padding:6px 11px;display:flex;align-items:center;gap:7px;}
.shw-res b{width:11px;height:11px;display:inline-block;border:1px solid rgba(0,0,0,.4);}
.shw-res span{font-size:12px;letter-spacing:1px;color:#f5f0e4;font-weight:700;}
.shw-res em{font-size:7.5px;letter-spacing:2px;color:#9c93c6;font-style:normal;text-transform:uppercase;}

/* ── bottom left: vitals ── */
#shw-vitals{position:absolute;left:18px;bottom:18px;width:290px;}
.shw-bar{position:relative;height:17px;background:rgba(6,3,14,.9);
  border:1.5px solid rgba(0,0,0,.6);margin-bottom:5px;overflow:hidden;
  clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);}
.shw-bar i{display:block;height:100%;transition:width .12s;}
.shw-bar u{position:absolute;inset:0;text-decoration:none;display:flex;align-items:center;
  justify-content:center;font-size:9px;letter-spacing:3px;color:#fff;text-shadow:0 1px 2px #000;}
#shw-hp i{background:linear-gradient(90deg,#ff3050,#ff7a8c);}
#shw-st i{background:linear-gradient(90deg,#3fb0ff,#8fe4ff);}
#shw-xp{height:7px;}
#shw-xp i{background:linear-gradient(90deg,#ffb03d,#ffe9a0);}

#shw-gear{display:flex;gap:5px;margin-top:9px;flex-wrap:wrap;}
.shw-gs{flex:1 1 60px;background:rgba(10,6,20,.84);border:1px solid rgba(255,255,255,.12);
  padding:5px 7px;min-width:0;}
.shw-gs .s{font-size:7px;letter-spacing:2px;color:#7a6f9c;text-transform:uppercase;}
.shw-gs .n{font-size:9px;letter-spacing:.5px;margin-top:2px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;}
.shw-gs .d{font-size:10px;font-weight:700;color:#ffd47a;}

/* ── bottom centre: mode + hotbar ── */
#shw-modebar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);
  display:flex;flex-direction:column;align-items:center;gap:7px;}
#shw-modes{display:flex;gap:5px;}
.shw-mode{padding:6px 15px;background:rgba(10,6,20,.84);border:1px solid rgba(255,255,255,.14);
  font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#9c93c6;}
.shw-mode.on{border-color:#ffb03d;color:#ffd9a0;background:rgba(70,36,10,.82);
  box-shadow:0 0 16px rgba(255,176,61,.35);}
.shw-mode kbd{font-family:inherit;font-size:7.5px;opacity:.6;margin-left:5px;}
#shw-hot{display:flex;gap:4px;pointer-events:auto;}
.shw-slot{width:62px;padding:6px 5px;text-align:center;background:rgba(10,6,20,.86);
  border:1px solid rgba(255,255,255,.13);}
.shw-slot.on{border-color:#7fdcff;box-shadow:0 0 14px rgba(127,220,255,.4);}
.shw-slot b{display:block;width:100%;height:12px;border:1px solid rgba(0,0,0,.5);margin-bottom:4px;}
.shw-slot span{font-size:7px;letter-spacing:1px;color:#c3bcd8;display:block;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.shw-slot em{font-size:7px;color:#ffd47a;font-style:normal;}
#shw-brush{font-size:9px;letter-spacing:3px;color:#7fdcff;text-transform:uppercase;}

/* ── right: night board + minimap ── */
#shw-right{position:absolute;right:18px;bottom:18px;display:flex;flex-direction:column;
  align-items:flex-end;gap:9px;}
#shw-map{width:168px;height:168px;border:1.5px solid rgba(255,176,61,.4);
  background:rgba(6,3,14,.85);image-rendering:pixelated;}
#shw-stats{display:flex;gap:7px;}
#shw-stats div{background:rgba(10,6,20,.84);border:1px solid rgba(255,255,255,.13);
  padding:5px 10px;text-align:center;}
#shw-stats .k{font-size:7px;letter-spacing:2px;color:#7a6f9c;text-transform:uppercase;}
#shw-stats .v{font-size:14px;font-weight:700;color:#ffd47a;}

/* ── combo ── */
#shw-combo{position:absolute;right:26px;top:50%;transform:translateY(-50%);text-align:right;
  opacity:0;transition:opacity .2s;}
#shw-combo.on{opacity:1;}
#shw-combo b{display:block;font-size:52px;line-height:.9;font-weight:800;color:#ffb03d;
  text-shadow:0 0 24px rgba(255,176,61,.7),0 3px 0 #6b3000;}
#shw-combo span{font-size:9px;letter-spacing:5px;color:#ffd9a0;text-transform:uppercase;}

/* ── crosshair ── */
#shw-cross{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;}
#shw-cross::before,#shw-cross::after{content:'';position:absolute;background:rgba(255,255,255,.85);
  box-shadow:0 0 6px rgba(0,0,0,.9);}
#shw-cross::before{left:50%;top:0;width:1.5px;height:100%;margin-left:-.75px;}
#shw-cross::after{top:50%;left:0;height:1.5px;width:100%;margin-top:-.75px;}

/* ── what the crosshair is resting on, and the hold ring ── */
#shw-focus{position:absolute;left:50%;top:calc(50% + 104px);transform:translateX(-50%);
  text-align:center;opacity:0;transition:opacity .12s;white-space:nowrap;
  padding:7px 18px;background:linear-gradient(180deg,rgba(6,3,14,.82),rgba(6,3,14,.62));
  border:1px solid rgba(255,255,255,.16);
  clip-path:polygon(9px 0,100% 0,calc(100% - 9px) 100%,0 100%);}
#shw-focus.on{opacity:1;}
#shw-focus b{display:block;font-size:11px;letter-spacing:3.4px;text-transform:uppercase;
  color:#fff;text-shadow:0 1px 4px #000,0 0 10px rgba(0,0,0,.8);}
#shw-focus i{font-style:normal;font-size:11px;letter-spacing:1.5px;color:#ffd47a;
  text-shadow:0 1px 3px #000;}
#shw-focus u{display:block;text-decoration:none;font-size:9px;letter-spacing:2.4px;
  color:#b9b0d8;margin-top:3px;text-transform:uppercase;text-shadow:0 1px 3px #000;}
#shw-ring{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;
  border-radius:50%;opacity:0;transition:opacity .1s;
  background:conic-gradient(var(--c,#ffd47a) 0 var(--p,0deg),rgba(255,255,255,.12) var(--p,0deg) 360deg);
  -webkit-mask:radial-gradient(circle,transparent 0 21px,#000 22px);
  mask:radial-gradient(circle,transparent 0 21px,#000 22px);}
#shw-ring.on{opacity:1;}

/* ── the bench ── */
#shw-bench{position:absolute;inset:0;display:none;place-items:center;
  background:rgba(4,2,10,.9);pointer-events:auto;}
#shw-bench.show{display:grid;}
#shw-benchcard{width:min(1020px,94%);max-height:88%;display:flex;flex-direction:column;
  background:linear-gradient(160deg,#1a1020,#0a0512);border:1.5px solid rgba(255,176,61,.45);}
#shw-benchhead{display:flex;align-items:baseline;gap:14px;padding:16px 22px;
  border-bottom:1px solid rgba(255,255,255,.12);flex-wrap:wrap;}
#shw-benchhead h3{font:700 14px/1 'SF Mono',monospace;letter-spacing:5px;text-transform:uppercase;
  color:#ffd9a0;}
#shw-benchhead p{font-size:9px;letter-spacing:2px;color:#7a6f9c;text-transform:uppercase;}
#shw-benchres{margin-left:auto;font-size:10px;letter-spacing:1.6px;color:#ffd47a;}
#shw-benchbody{overflow:auto;padding:16px 22px 22px;display:grid;
  grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;align-items:start;}
#shw-benchbody section{min-width:0;}
#shw-benchbody h4{font:700 9px/1 'SF Mono',monospace;letter-spacing:4px;text-transform:uppercase;
  color:#7fdcff;margin-bottom:9px;padding-bottom:7px;border-bottom:1px solid rgba(127,220,255,.2);}
.shw-craft{display:block;width:100%;text-align:left;margin-bottom:7px;padding:10px 12px;
  background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.14);color:inherit;
  font-family:inherit;cursor:pointer;transition:background .12s,border-color .12s;}
.shw-craft:hover:not(.off){background:rgba(255,176,61,.14);border-color:rgba(255,176,61,.6);}
.shw-craft.off{opacity:.42;cursor:not-allowed;}
.shw-craft b{display:block;font-size:11px;letter-spacing:1.4px;color:#f5f0e4;text-transform:capitalize;}
.shw-craft span{display:block;margin-top:4px;font:11.5px/1.45 Georgia,serif;color:#a79ecb;}
.shw-craft em{display:inline-block;margin-top:6px;font-style:normal;font-size:9px;
  letter-spacing:1.6px;color:#7dffb3;text-transform:uppercase;}
.shw-craft em.no{color:#ff7088;}
.shw-craft u{display:block;margin-top:5px;text-decoration:none;font-size:8.5px;
  letter-spacing:2px;color:#ff9a3d;text-transform:uppercase;}
#shw-benchfoot{padding:11px 22px;border-top:1px solid rgba(255,255,255,.12);
  font-size:9px;letter-spacing:2px;color:#7a6f9c;text-transform:uppercase;}

/* ── toasts + damage ── */
#shw-toasts{position:absolute;left:50%;top:86px;transform:translateX(-50%);
  display:flex;flex-direction:column;align-items:center;gap:5px;}
.shw-toast{background:rgba(6,3,14,.9);border-left:3px solid currentColor;padding:6px 14px;
  font-size:11px;letter-spacing:1.2px;animation:shw-tin .2s ease-out;}
@keyframes shw-tin{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.shw-dmg{position:absolute;font-size:17px;font-weight:800;color:#ffd47a;
  text-shadow:0 2px 0 #7a3000,0 0 10px rgba(255,176,61,.6);
  transition:transform .75s ease-out,opacity .75s ease-out;pointer-events:none;}

/* ── banner ── */
#shw-banner{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);
  text-align:center;opacity:0;transition:opacity .35s;}
#shw-banner.on{opacity:1;}
#shw-banner b{display:block;font:800 44px/1 Georgia,serif;letter-spacing:-1px;
  text-shadow:0 4px 0 rgba(0,0,0,.5);}
#shw-banner span{font-size:10px;letter-spacing:6px;text-transform:uppercase;color:#c3bcd8;}

/* ── inventory ── */
#shw-inv{position:absolute;inset:0;display:none;place-items:center;
  background:rgba(4,2,10,.9);pointer-events:auto;}
#shw-inv.show{display:grid;}
#shw-invcard{width:min(860px,92%);max-height:84%;display:flex;flex-direction:column;
  background:linear-gradient(160deg,#150c22,#0a0512);border:1.5px solid rgba(255,176,61,.4);}
#shw-invhead{display:flex;align-items:baseline;gap:14px;padding:16px 20px;
  border-bottom:1px solid rgba(255,255,255,.12);}
#shw-invhead h3{font:700 14px/1 'SF Mono',monospace;letter-spacing:5px;text-transform:uppercase;}
#shw-invhead p{font-size:9px;letter-spacing:2px;color:#7a6f9c;text-transform:uppercase;}
#shw-invhead button{margin-left:auto;pointer-events:auto;background:transparent;
  border:1px solid rgba(255,176,61,.5);color:#ffd47a;padding:6px 13px;cursor:pointer;
  font:700 9px/1 'SF Mono',monospace;letter-spacing:2px;text-transform:uppercase;}
#shw-invhead button:hover{background:rgba(255,176,61,.18);}
#shw-invlist{overflow:auto;padding:14px 20px 20px;display:grid;
  grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;}
.shw-item{border:1px solid rgba(255,255,255,.14);padding:9px 11px;cursor:pointer;
  background:rgba(255,255,255,.03);pointer-events:auto;}
.shw-item:hover{background:rgba(255,255,255,.09);}
.shw-item .n{font-size:10px;letter-spacing:.6px;}
.shw-item .m{font-size:9px;color:#9c93c6;margin-top:4px;letter-spacing:1px;}
.shw-item.eq{border-color:#ffb03d;}
#shw-invfoot{padding:11px 20px;border-top:1px solid rgba(255,255,255,.12);
  font-size:9px;letter-spacing:2px;color:#7a6f9c;text-transform:uppercase;}

/* ── title + death ── */
#shw-title{position:absolute;inset:0;display:grid;place-items:center;pointer-events:auto;
  background:radial-gradient(ellipse at 50% 42%,rgba(43,19,48,.34),rgba(5,3,12,.86) 74%);
  text-align:center;}
#shw-title.hide{display:none;}
#shw-title .in{max-width:660px;padding:30px;}
#shw-title h1{font:800 clamp(38px,7vw,74px)/.9 Georgia,serif;letter-spacing:-2px;
  color:#ffd9a0;text-shadow:0 5px 0 #8a3a12,0 0 40px rgba(255,140,60,.45);}
#shw-title h1 em{display:block;font-style:normal;font-size:.42em;letter-spacing:14px;
  color:#ff8a3d;margin-top:10px;text-shadow:none;}
#shw-title p{margin-top:18px;font:15px/1.6 Georgia,serif;color:#c3bcd8;}
#shw-title .btns{margin-top:26px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
#shw-title button{pointer-events:auto;background:#ff8a3d;border:0;color:#2a1004;
  padding:13px 26px;font:700 11px/1 'SF Mono',monospace;letter-spacing:3px;
  text-transform:uppercase;cursor:pointer;transition:transform .12s,box-shadow .12s;}
#shw-title button:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 #7fdcff;}
#shw-title button.ghost{background:transparent;color:#c3bcd8;border:1px solid rgba(255,255,255,.3);}
#shw-title .keys{margin-top:26px;font-size:10px;letter-spacing:1.5px;color:#7a6f9c;line-height:1.9;}
#shw-title .keys kbd{background:rgba(255,255,255,.1);padding:1px 6px;border-radius:2px;
  font-family:inherit;color:#e7e2ff;}

#shw-dead{position:absolute;inset:0;display:none;place-items:center;text-align:center;
  background:rgba(40,4,10,.78);}
#shw-dead.show{display:grid;}
#shw-dead b{font:800 56px/1 Georgia,serif;color:#ff5268;text-shadow:0 4px 0 #4a0010;}
#shw-dead span{display:block;margin-top:12px;font-size:11px;letter-spacing:5px;
  text-transform:uppercase;color:#ffb0c0;}

#shw-lock{position:absolute;inset:0;display:grid;place-items:center;pointer-events:auto;
  background:rgba(4,2,10,.55);cursor:pointer;}
#shw-lock.hide{display:none;}
#shw-lock span{font-size:11px;letter-spacing:5px;text-transform:uppercase;color:#ffd9a0;
  background:rgba(6,3,14,.8);padding:12px 22px;border:1px solid rgba(255,176,61,.4);}

@media (max-width:760px){
  #shw-map{width:110px;height:110px;}
  #shw-vitals{width:190px;}
  .shw-slot{width:48px;}
}
`;

const hud = {};

function buildHUD(host){
  const style = document.createElement('style');
  style.id = 'shw-style';
  style.textContent = CSS;
  if (!document.getElementById('shw-style')) document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'shw-root';
  root.innerHTML = `
    <canvas id="shw-canvas"></canvas>
    <div id="shw-ui">
      <div id="shw-vig"></div>
      <div id="shw-grain"></div>
      <div id="shw-flash"></div>
      <div id="shw-cross"></div>
      <div id="shw-ring"></div>
      <div id="shw-focus"><b></b><i></i><u></u></div>

      <div id="shw-top">
        <div class="shw-plate" id="shw-clock">
          <div id="shw-dial"><i></i></div>
          <div>
            <div class="k">Day</div>
            <div class="v" id="shw-day">1</div>
            <div id="shw-phase">Daylight</div>
          </div>
        </div>
        <div id="shw-res"></div>
      </div>

      <div id="shw-toasts"></div>
      <div id="shw-banner"><b></b><span></span></div>
      <div id="shw-combo"><b>0</b><span>chain</span></div>

      <div id="shw-vitals">
        <div class="shw-bar" id="shw-hp"><i style="width:100%"></i><u></u></div>
        <div class="shw-bar" id="shw-st"><i style="width:100%"></i><u></u></div>
        <div class="shw-bar" id="shw-xp"><i style="width:0%"></i></div>
        <div id="shw-gear"></div>
      </div>

      <div id="shw-modebar">
        <div id="shw-brush"></div>
        <div id="shw-hot"></div>
        <div id="shw-modes">
          <div class="shw-mode on" data-mode="fight">Fight<kbd>1</kbd></div>
          <div class="shw-mode" data-mode="build">Build<kbd>2</kbd></div>
          <div class="shw-mode" data-mode="sculpt">Sculpt<kbd>3</kbd></div>
        </div>
      </div>

      <div id="shw-right">
        <canvas id="shw-map" width="84" height="84"></canvas>
        <div id="shw-stats">
          <div><div class="k">Kills</div><div class="v" id="shw-kills">0</div></div>
          <div><div class="k">Nights</div><div class="v" id="shw-nights">0</div></div>
          <div><div class="k">Blocks</div><div class="v" id="shw-blocks">0</div></div>
        </div>
      </div>

      <div id="shw-bench">
        <div id="shw-benchcard">
          <div id="shw-benchhead">
            <h3>The Bench</h3><p>at the kiln</p>
            <div id="shw-benchres"></div>
          </div>
          <div id="shw-benchbody"></div>
          <div id="shw-benchfoot">E or Esc closes · tools make gathering faster · ember comes off the things you kill</div>
        </div>
      </div>

      <div id="shw-dead"><div><b>PUT OUT</b><span>the kiln is relighting you</span></div></div>

      <div id="shw-inv">
        <div id="shw-invcard">
          <div id="shw-invhead">
            <h3>Kit</h3><p>click to wear</p>
            <button id="shw-scrap">Scrap spares</button>
          </div>
          <div id="shw-invlist"></div>
          <div id="shw-invfoot">Tab closes · spares scrap into ember for lanterns</div>
        </div>
      </div>
    </div>

    <div id="shw-lock" class="hide"><span>click to take the controls</span></div>

    <div id="shw-title">
      <div class="in">
        <h1>STILL HUMAN<em>WILD</em></h1>
        <p>The arena had walls. This does not. One Kiln at the centre of a hundred
           and ninety metres of plains, ridge and snow line, and nothing that comes
           out at night leaves without giving you something.</p>
        <div class="btns">
          <button id="shw-new">New ground</button>
          <button id="shw-cont" class="ghost">Continue</button>
        </div>
        <div class="keys">
          <kbd>W A S D</kbd> move &nbsp; <kbd>Shift</kbd> run &nbsp; <kbd>Space</kbd> jump &nbsp; <kbd>Mouse</kbd> look<br>
          <kbd>1</kbd> fight &nbsp; <kbd>2</kbd> build &nbsp; <kbd>3</kbd> sculpt &nbsp; <kbd>Tab</kbd> kit &nbsp; <kbd>E</kbd> bench &nbsp; <kbd>F</kbd> torch<br>
          <b style="color:#ffd9a0">look at a tree, boulder or clay bank and HOLD <kbd>LMB</kbd> to take it</b><br>
          fight: <kbd>LMB</kbd> swing &nbsp; build: <kbd>LMB</kbd> place <kbd>RMB</kbd> take &nbsp; sculpt: <kbd>LMB</kbd> raise <kbd>RMB</kbd> lower<br>
          <kbd>Q</kbd><kbd>E</kbd> pick material &nbsp; <kbd>[</kbd><kbd>]</kbd> brush &nbsp; <kbd>Esc</kbd> <span id="shw-exitlabel">back to the title</span>
        </div>
      </div>
    </div>
  `;
  host.appendChild(root);

  hud.root = root;
  hud.canvas = root.querySelector('#shw-canvas');
  hud.day = root.querySelector('#shw-day');
  hud.phase = root.querySelector('#shw-phase');
  hud.dial = root.querySelector('#shw-dial');
  hud.res = root.querySelector('#shw-res');
  hud.hp = root.querySelector('#shw-hp i');
  hud.hpT = root.querySelector('#shw-hp u');
  hud.st = root.querySelector('#shw-st i');
  hud.stT = root.querySelector('#shw-st u');
  hud.xp = root.querySelector('#shw-xp i');
  hud.gear = root.querySelector('#shw-gear');
  hud.hot = root.querySelector('#shw-hot');
  hud.brush = root.querySelector('#shw-brush');
  hud.modes = [].slice.call(root.querySelectorAll('.shw-mode'));
  hud.map = root.querySelector('#shw-map');
  hud.mapCtx = hud.map.getContext('2d');
  hud.kills = root.querySelector('#shw-kills');
  hud.nights = root.querySelector('#shw-nights');
  hud.blocks = root.querySelector('#shw-blocks');
  hud.combo = root.querySelector('#shw-combo');
  hud.comboN = root.querySelector('#shw-combo b');
  hud.toasts = root.querySelector('#shw-toasts');
  hud.banner = root.querySelector('#shw-banner');
  hud.flash = root.querySelector('#shw-flash');
  hud.dead = root.querySelector('#shw-dead');
  hud.focus = root.querySelector('#shw-focus');
  hud.focusName = root.querySelector('#shw-focus b');
  hud.focusYield = root.querySelector('#shw-focus i');
  hud.focusHint = root.querySelector('#shw-focus u');
  hud.ring = root.querySelector('#shw-ring');
  hud.bench = root.querySelector('#shw-bench');
  hud.benchBody = root.querySelector('#shw-benchbody');
  hud.benchRes = root.querySelector('#shw-benchres');
  hud.inv = root.querySelector('#shw-inv');
  hud.invList = root.querySelector('#shw-invlist');
  hud.title = root.querySelector('#shw-title');
  hud.lock = root.querySelector('#shw-lock');
  hud.ui = root.querySelector('#shw-ui');

  //  Resource chips
  const resDef = [
    ['earth','Earth','#b5813f'], ['timber','Timber','#d9b455'],
    ['stone','Stone','#b0a08c'], ['ember','Ember','#ffb03d'],
  ];
  hud.resEls = {};
  for (const [k, label, col] of resDef){
    const d = document.createElement('div');
    d.className = 'shw-res';
    d.innerHTML = `<b style="background:${col}"></b><span>0</span><em>${label}</em>`;
    hud.res.appendChild(d);
    hud.resEls[k] = d.querySelector('span');
  }

  //  Hotbar
  hud.slots = MATS.map((m, i) => {
    const d = document.createElement('div');
    d.className = 'shw-slot' + (i === 0 ? ' on' : '');
    d.innerHTML = `<b style="background:#${m.col.toString(16).padStart(6,'0')}"></b>
                   <span>${m.name}</span><em>${m.cost} ${m.res}</em>`;
    d.onclick = () => { St.matIdx = i; refreshHot(); };
    hud.hot.appendChild(d);
    return d;
  });

  //  Gear slots
  hud.gearEls = {};
  for (const k of ['weapon','head','chest','legs']){
    const d = document.createElement('div');
    d.className = 'shw-gs';
    d.innerHTML = `<div class="s">${k}</div><div class="n">—</div><div class="d"></div>`;
    hud.gear.appendChild(d);
    hud.gearEls[k] = { n: d.querySelector('.n'), d: d.querySelector('.d') };
  }

  hud.modes.forEach(el => {
    el.onclick = () => setMode(el.dataset.mode);
    el.style.pointerEvents = 'auto';
  });
  root.querySelector('#shw-scrap').onclick = scrapAll;

  return root;
}

function refreshHot(){
  hud.slots.forEach((s, i) => s.classList.toggle('on', i === St.matIdx));
}

function setMode(m){
  St.mode = m;
  hud.modes.forEach(el => el.classList.toggle('on', el.dataset.mode === m));
  hud.hot.style.display = m === 'build' ? 'flex' : 'none';
  hud.brush.style.display = m === 'sculpt' ? 'block' : 'none';
}

function toast(msg, col){
  const d = document.createElement('div');
  d.className = 'shw-toast';
  d.style.color = col || '#ffd47a';
  d.textContent = msg;
  hud.toasts.appendChild(d);
  setTimeout(() => { d.style.transition = 'opacity .3s'; d.style.opacity = '0'; }, 2100);
  setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 2500);
  while (hud.toasts.children.length > 5) hud.toasts.removeChild(hud.toasts.firstChild);
}

function banner(big, small){
  hud.banner.querySelector('b').textContent = big;
  hud.banner.querySelector('span').textContent = small;
  hud.banner.classList.add('on');
  clearTimeout(banner._t);
  banner._t = setTimeout(() => hud.banner.classList.remove('on'), 2200);
}

function flash(a){
  hud.flash.style.opacity = String(a);
  setTimeout(() => { hud.flash.style.opacity = '0'; }, 90);
}

const _v = new THREE.Vector3();
function dmgNumber(x, y, z, n){
  _v.set(x, y, z).project(SHW.camera);
  if (_v.z > 1) return;
  const r = hud.root.getBoundingClientRect();
  const px = (_v.x * 0.5 + 0.5) * r.width;
  const py = (-_v.y * 0.5 + 0.5) * r.height;
  const el = document.createElement('div');
  el.className = 'shw-dmg';
  el.textContent = n;
  el.style.left = px + 'px';
  el.style.top = py + 'px';
  hud.ui.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = `translate(${(Math.random()-0.5)*50}px,-60px)`;
    el.style.opacity = '0';
  });
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 800);
}

function renderInv(){
  const list = hud.invList;
  list.innerHTML = '';
  const rows = [];
  for (const k of ['weapon','head','chest','legs']){
    if (St.gear[k]) rows.push({ it: St.gear[k], eq: true });
  }
  for (const it of St.inv) rows.push({ it, eq: false });
  if (!rows.length){
    list.innerHTML = '<div style="color:#7a6f9c;font-size:11px;letter-spacing:1px">Nothing yet. Kill something after dark.</div>';
    return;
  }
  for (const row of rows){
    const it = row.it;
    const rar = RARITY.find(r => r.key === it.rarity) || RARITY[0];
    const d = document.createElement('div');
    d.className = 'shw-item' + (row.eq ? ' eq' : '');
    d.innerHTML = `<div class="n" style="color:${rar.col}">${it.name}</div>
      <div class="m">${it.kind === 'weapon'
        ? `${it.dmg} damage · ${(1/it.spd).toFixed(1)}/s · ${it.reach.toFixed(1)}m reach`
        : `${it.armour} plate · ${it.slot}`}${row.eq ? ' · worn' : ''}</div>`;
    if (!row.eq) d.onclick = () => { equip(it); renderInv(); };
    list.appendChild(d);
  }
}

function updateHUD(){
  hud.day.textContent = St.day;
  hud.phase.textContent = St.night ? 'Night' : 'Daylight';
  const frac = St.cycle / CYCLE;
  hud.dial.style.setProperty('--day', (DAY_LEN / CYCLE) + 'turn');
  hud.dial.style.setProperty('--hand', (frac * 360) + 'deg');

  for (const k in hud.resEls) hud.resEls[k].textContent = Math.floor(St.res[k]);

  const hpf = clamp(St.hp / St.maxHp, 0, 1);
  hud.hp.style.width = (hpf * 100) + '%';
  hud.hpT.textContent = Math.ceil(St.hp) + ' / ' + Math.ceil(St.maxHp);
  hud.st.style.width = clamp(St.stam / St.maxStam, 0, 1) * 100 + '%';
  hud.stT.textContent = 'STAMINA';
  hud.xp.style.width = clamp(St.xp / (St.level * 90), 0, 1) * 100 + '%';

  for (const k of ['weapon','head','chest','legs']){
    const it = St.gear[k], el = hud.gearEls[k];
    if (!it){ el.n.textContent = '—'; el.n.style.color = '#5c5478'; el.d.textContent = ''; continue; }
    const rar = RARITY.find(r => r.key === it.rarity) || RARITY[0];
    el.n.textContent = it.name;
    el.n.style.color = rar.col;
    el.d.textContent = it.kind === 'weapon' ? it.dmg + ' dmg' : it.armour + ' plate';
  }

  hud.kills.textContent = St.kills;
  hud.nights.textContent = St.nightsSurvived;
  hud.blocks.textContent = blocks.size;
  hud.brush.textContent = 'brush ' + St.brush.toFixed(1) + 'm  ·  [ ]';

  if (St.combo > 1){
    hud.combo.classList.add('on');
    hud.comboN.textContent = 'x' + St.combo;
  } else hud.combo.classList.remove('on');
}

// ─── 24 · Minimap ────────────────────────────────────────────────────────────

let mapBase = null;
function bakeMap(){
  const N = 84;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  for (let j = 0; j < N; j++){
    for (let i = 0; i < N; i++){
      const wx = -HALF + (i / (N - 1)) * WORLD;
      const wz = -HALF + (j / (N - 1)) * WORLD;
      const h = groundY(wx, wz);
      const sl = slopeAt(wx, wz);
      const col = biomeColor(wx, wz, h, sl, 0.5);
      const k = (j * N + i) * 4;
      const shade = clamp(0.55 + h / 34, 0.4, 1.25);
      img.data[k]   = clamp(col.r * 255 * shade, 0, 255);
      img.data[k+1] = clamp(col.g * 255 * shade, 0, 255);
      img.data[k+2] = clamp(col.b * 255 * shade, 0, 255);
      img.data[k+3] = 255;
      if (h < WATER_Y){
        img.data[k] = 40; img.data[k+1] = 120; img.data[k+2] = 170;
      }
    }
  }
  g.putImageData(img, 0, 0);
  mapBase = c;
}

function drawMap(){
  if (!mapBase) return;
  const g = hud.mapCtx, N = 84;
  g.clearRect(0, 0, N, N);
  g.drawImage(mapBase, 0, 0);
  const px = v => clamp((v + HALF) / WORLD * N, 0, N);

  //  The Kiln
  g.fillStyle = '#ffb03d';
  g.fillRect(px(0) - 2, px(0) - 2, 4, 4);
  g.strokeStyle = 'rgba(255,176,61,.5)';
  g.beginPath(); g.arc(px(0), px(0), keepR() / WORLD * N, 0, 6.2832); g.stroke();

  //  Placed blocks
  g.fillStyle = '#7fdcff';
  for (const b of blocks.values()) g.fillRect(px(b.x), px(b.z), 1, 1);

  //  Monsters
  g.fillStyle = '#ff3050';
  for (const m of mobs){ if (!m.dead) g.fillRect(px(m.x) - 1, px(m.z) - 1, 2, 2); }

  //  Loot
  g.fillStyle = '#c08bff';
  for (const d of drops) g.fillRect(px(d.mesh.position.x) - 1, px(d.mesh.position.z) - 1, 2, 2);

  //  The player, with a facing wedge
  const x = px(Pl.pos.x), y = px(Pl.pos.z);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(x, y, 2.2, 0, 6.2832); g.fill();
  g.strokeStyle = '#ffffff';
  g.beginPath(); g.moveTo(x, y);
  g.lineTo(x + Math.sin(Pl.group.rotation.y) * 7, y + Math.cos(Pl.group.rotation.y) * 7);
  g.stroke();
}

// ─── 25 · Input ──────────────────────────────────────────────────────────────
//  Every listener is capture-phase and stops propagation while the cabinet is
//  mounted, so the city behind the overlay never sees a keystroke meant for
//  this game. That is also the reason the city's own T-to-speak bar cannot
//  open on top of the cabinet.

const keys = new Set();
let locked = false;
let listeners = [];

function on(target, type, fn, opts){
  target.addEventListener(type, fn, opts);
  listeners.push([target, type, fn, opts]);
}

function offAll(){
  for (const [t, ty, fn, o] of listeners) t.removeEventListener(ty, fn, o);
  listeners = [];
}

const GAME_KEYS = new Set(['w','a','s','d',' ','shift','q','e','f','tab','1','2','3','4','5','6',
                           '[',']','escape','r','g','p','c']);

function bindInput(){
  const cv = hud.canvas;

  on(document, 'keydown', ev => {
    if (!SHW.mounted) return;
    const k = ev.key.toLowerCase();
    //  Everything is swallowed. The city is one z-index behind this canvas and
    //  it must not hear a single key meant for the cabinet, or T opens its
    //  street-chat bar on top of the game.
    ev.stopPropagation();
    if (GAME_KEYS.has(k)) ev.preventDefault();
    if (ev.repeat) return;

    if (k === 'escape'){
      ev.stopPropagation();
      if (St.benchOpen){ toggleBench(false); return; }
      if (St.invOpen){ toggleInv(); return; }
      if (locked){ document.exitPointerLock(); return; }
      leave();
      return;
    }
    if (St.phase !== 'play') return;

    keys.add(k);
    if (k === 'tab'){ if (St.benchOpen) toggleBench(false); toggleInv(); return; }
    //  E is the bench everywhere except build mode, where it cycles material.
    if (k === 'e' && St.mode !== 'build'){
      if (St.benchOpen || nearBench()) toggleBench();
      return;
    }
    if (k === '1') setMode('fight');
    if (k === '2') setMode('build');
    if (k === '3') setMode('sculpt');
    if (k === 'f'){ St.torch = !St.torch; toast(St.torch ? 'Torch lit' : 'Torch out', '#ffd47a'); }
    if (k === 'q' && St.mode === 'build'){ St.matIdx = (St.matIdx + MATS.length - 1) % MATS.length; refreshHot(); }
    if (k === 'e' && St.mode === 'build'){ St.matIdx = (St.matIdx + 1) % MATS.length; refreshHot(); }
    if (k === '[') { St.brush = clamp(St.brush - 0.5, 1, 9); }
    if (k === ']') { St.brush = clamp(St.brush + 0.5, 1, 9); }
    if (k === 'g'){ rest(); }
    if (k === 'c'){ if (St.benchOpen || nearBench()) toggleBench(); }
    if (k === 'p'){ save(); toast('Saved.', '#7dffb3'); }
  }, true);

  on(document, 'keyup', ev => {
    if (!SHW.mounted) return;
    const k = ev.key.toLowerCase();
    ev.stopPropagation();
    keys.delete(k);
  }, true);

  on(window, 'blur', () => keys.clear());

  on(cv, 'mousedown', ev => {
    if (St.phase !== 'play') return;
    if (!locked){ cv.requestPointerLock(); return; }
    ev.preventDefault();
    if (St.mode === 'fight'){
      //  Hold on a node to take it; otherwise the button is a swing.
      if (ev.button === 0){ if (!beginGather()) attack(); }
    }
    else if (St.mode === 'build'){
      if (ev.button === 0) placeBlock(); else if (ev.button === 2) removeBlock();
    } else if (St.mode === 'sculpt'){
      St.sculpting = ev.button === 0 ? 1 : ev.button === 2 ? -1 : 0;
    }
  });
  on(cv, 'mouseup', () => { St.sculpting = 0; cancelGather(); });
  on(window, 'blur', () => cancelGather());
  on(cv, 'contextmenu', ev => ev.preventDefault());

  on(cv, 'wheel', ev => {
    if (St.phase !== 'play') return;
    ev.preventDefault();
    if (St.mode === 'build'){
      St.buildReach = clamp(St.buildReach + (ev.deltaY < 0 ? 1 : -1), 3, 16);
    } else if (St.mode === 'sculpt'){
      St.brush = clamp(St.brush + (ev.deltaY < 0 ? 0.5 : -0.5), 1, 9);
    } else {
      Cam.dist = clamp(Cam.dist + (ev.deltaY < 0 ? -0.5 : 0.5), 2.6, 11);
    }
  }, { passive: false });

  on(document, 'pointerlockchange', () => {
    locked = document.pointerLockElement === cv;
    hud.lock.classList.toggle('hide',
      locked || St.phase !== 'play' || St.invOpen || St.benchOpen);
    if (!locked) keys.clear();
  });

  on(document, 'mousemove', ev => {
    if (!locked || St.phase !== 'play') return;
    Pl.yaw   -= ev.movementX * 0.0026;
    Pl.pitch -= ev.movementY * 0.0020;
    Pl.pitch = clamp(Pl.pitch, -0.95, 0.72);
  });

  hud.lock.onclick = () => cv.requestPointerLock();
  hud.root.querySelector('#shw-new').onclick  = () => start(true);
  hud.root.querySelector('#shw-cont').onclick = () => start(false);
}

function toggleInv(){
  St.invOpen = !St.invOpen;
  hud.inv.classList.toggle('show', St.invOpen);
  hud.lock.classList.toggle('hide', St.invOpen || locked || St.phase !== 'play');
  if (St.invOpen){ renderInv(); document.exitPointerLock(); }
}

//  Rest at the bench: skip to dawn, but only if nothing is standing near you.
function rest(){
  if (Math.hypot(Pl.pos.x - S.bench.x, Pl.pos.z - S.bench.z) > 4){
    toast('Stand at the bench to rest.', '#9c93c6'); return;
  }
  const close = mobs.some(m => !m.dead &&
    Math.hypot(m.x - Pl.pos.x, m.z - Pl.pos.z) < 26);
  if (close){ toast('Not while they are this close.', '#ff5268'); return; }
  if (!St.night){ toast('Rest is for after dark.', '#9c93c6'); return; }
  St.cycle = CYCLE - 1;
  St.hp = St.maxHp;
  banner('Morning', 'you slept through it');
  save();
}

// ─── 26 · Save and load ──────────────────────────────────────────────────────

function store(){
  //  Present Palm gives every app a namespaced store; standalone falls back to
  //  plain localStorage under the same key so a save survives either way.
  if (window.fracture && typeof window.fracture.save === 'function') return window.fracture;
  return {
    save(k, v){ try { localStorage.setItem('shw::' + k, JSON.stringify(v)); } catch (e){} return Promise.resolve(true); },
    read(k){ try { const r = localStorage.getItem('shw::' + k); return Promise.resolve(r == null ? null : JSON.parse(r)); } catch (e){ return Promise.resolve(null); } },
  };
}

function packEdits(){
  //  Sparse: only cells the player actually moved.
  const out = [];
  for (let i = 0; i < HD.length; i++){
    if (Math.abs(HD[i]) > 0.001) out.push(i, Math.round(HD[i] * 100) / 100);
  }
  return out;
}

function save(){
  const data = {
    v: 1, seed: SHW.seed,
    day: St.day, cycle: St.cycle,
    hp: St.hp, xp: St.xp, level: St.level,
    res: St.res, kills: St.kills, nights: St.nightsSurvived,
    kiln: St.kiln, tools: St.tools,
    pos: [Pl.pos.x, Pl.pos.y, Pl.pos.z], yaw: Pl.yaw,
    gear: St.gear, inv: St.inv.slice(0, 40),
    blocks: [...blocks.values()].map(b => [b.x, b.y, b.z, b.mat]),
    edits: packEdits(),
    fell: { trees: trees.map((t, i) => t.alive ? -1 : i).filter(x => x >= 0),
            rocks: rocks.map((r, i) => r.alive ? -1 : i).filter(x => x >= 0),
            banks: banks.map((b, i) => b.alive ? -1 : i).filter(x => x >= 0) },
    at: Date.now(),
  };
  try { store().save(SAVE_KEY, data); } catch (e){}
  St.dirty = false;
}

function loadSave(){
  return store().read(SAVE_KEY).catch(() => null);
}

function applySave(d){
  if (!d || d.v !== 1) return false;
  SHW.seed = d.seed || SHW.seed;
  SHW.noise = makeNoise(hashStr(SHW.seed));
  SHW.moist = makeNoise(hashStr(SHW.seed + '-m'));
  buildHeights();
  HD = new Float32Array((GRID + 1) * (GRID + 1));
  if (Array.isArray(d.edits)){
    for (let i = 0; i < d.edits.length; i += 2) HD[d.edits[i]] = d.edits[i + 1];
  }
  St.day = d.day || 1;
  St.cycle = d.cycle || 0;
  St.night = St.cycle >= DAY_LEN;
  St.xp = d.xp || 0; St.level = d.level || 1;
  St.kills = d.kills || 0; St.nightsSurvived = d.nights || 0;
  if (d.res) Object.assign(St.res, d.res);
  St.kiln = Object.assign({ ring:0, brazier:0, height:0, bench:0 }, d.kiln || {});
  St.tools = Object.assign({ axe:0, pick:0 }, d.tools || {});
  if (d.gear) St.gear = Object.assign({ weapon:null, head:null, chest:null, legs:null }, d.gear);
  St.inv = Array.isArray(d.inv) ? d.inv : [];
  blocks = new Map();
  for (const b of (d.blocks || [])){
    blocks.set(bkey(b[0], b[1], b[2]), { x:b[0], y:b[1], z:b[2], mat:b[3] });
  }
  St.savedPos = d.pos; St.savedYaw = d.yaw;
  St.savedFell = d.fell;
  St.hp = d.hp || 100;
  return true;
}

// ─── 27 · World build ────────────────────────────────────────────────────────

function buildWorld(){
  S.world = new THREE.Group();
  SHW.scene.add(S.world);
  makeSky();
  makeTerrain();
  makeWater();
  scatterProps();
  makeBase();
  makeBlockMeshes();
  makeParticles();
  makeGhost();
  makeFocusRing();
  makePlayer();

  S.torch = new THREE.PointLight(0xffc07a, 3.4, 30, 1.6);
  S.torch.visible = false;
  S.world.add(S.torch);

  bakeMap();
}

function clearWorld(){
  if (!S.world) return;
  SHW.scene.remove(S.world);
  S.world.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material){
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms){ if (m.map && m.map.dispose) m.map.dispose(); m.dispose(); }
    }
  });
  if (S.sky){ SHW.scene.remove(S.sky); S.sky.geometry.dispose(); S.sky.material.dispose(); }
  if (S.sun) SHW.scene.remove(S.sun);
  if (S.amb) SHW.scene.remove(S.amb);
  if (S.sunDisc) SHW.scene.remove(S.sunDisc);
  if (S.moonDisc) SHW.scene.remove(S.moonDisc);
  for (const k in S) delete S[k];
  mobs = []; drops = []; projectiles = []; parts = []; tiles = [];
  banks = []; St.focus = null; St.gather = null;
}

function start(fresh){
  hud.title.classList.add('hide');
  St.phase = 'play';

  if (fresh){
    SHW.seed = 'wild-' + Math.random().toString(36).slice(2, 8);
    SHW.noise = makeNoise(hashStr(SHW.seed));
    SHW.moist = makeNoise(hashStr(SHW.seed + '-m'));
    HD = null;
    buildHeights();
    Object.assign(St, {
      day: 1, cycle: DAY_LEN * 0.26, night: false, hp: 100, maxHp: 100, stam: 100,
      xp: 0, level: 1, kills: 0, nightsSurvived: 0, combo: 0,
      inv: [], gear: { weapon: null, head: null, chest: null, legs: null },
      res: { earth: 40, timber: 24, stone: 18, ember: 4 },
      kiln: { ring: 0, brazier: 0, height: 0, bench: 0 },
      tools: { axe: 0, pick: 0 },
      dead: false,
    });
    blocks = new Map();
    St.savedPos = null; St.savedFell = null;
    //  A starting weapon, so the first day is not bare hands.
    const w = rollItem(mulberry(hashStr(SHW.seed) ^ 7), 0, 'weapon');
    w.rarity = 'common'; w.name = 'Rough Thumbed Cudgel';
    St.gear.weapon = w;
  }

  clearWorld();
  buildWorld();

  if (St.savedFell){
    for (const i of (St.savedFell.trees || [])) if (trees[i]) killTree(trees[i]);
    for (const i of (St.savedFell.rocks || [])) if (rocks[i]) killRock(rocks[i]);
    for (const i of (St.savedFell.banks || [])) if (banks[i]) killBank(banks[i]);
  }
  refreshBlocks();
  refreshWeaponMesh();
  refreshGearPlates();
  recomputeStats();
  refreshHot();
  applyKiln();
  setMode('fight');

  if (St.savedPos){
    Pl.pos.set(St.savedPos[0], St.savedPos[1], St.savedPos[2]);
    Pl.yaw = St.savedYaw || 0;
  } else {
    //  Out on the plateau lip with the Kiln in front of you, so the first
    //  frame is the establishing shot and not the inside of a wall.
    Pl.pos.set(0, groundY(0, 24) + 1, 24);
    Pl.yaw = 0;
  }
  Pl.vel.set(0, 0, 0);
  hud.root.classList.toggle('night', St.night);
  hud.dead.classList.remove('show');
  hud.lock.classList.remove('hide');

  banner(fresh ? 'Day One' : 'Day ' + St.day,
         fresh ? 'the kiln is lit' : 'still standing');
  updateHUD();
  drawMap();
}

// ─── 28 · Loop ───────────────────────────────────────────────────────────────

let mapAccum = 0, hudAccum = 0, saveAccum = 0;

function frame(){
  if (!SHW.mounted) return;
  SHW.raf = requestAnimationFrame(frame);

  let dt = Math.min(0.05, SHW.clock.getDelta());
  SHW.clockT = (SHW.clockT || 0) + dt;
  St.t += dt;
  St.step = Math.floor(St.t * STEP_FPS) / STEP_FPS;

  if (St.phase === 'play'){
    //  Hit-stop: the whole picture stops for one beat on a landed swing. It is
    //  the cheapest thing in the file and it does most of the work.
    if (St.hitStop > 0){ St.hitStop -= dt; dt = 0; }

    if (!St.invOpen && !St.benchOpen){
      advanceClock(dt);
      updatePlayer(dt);
      tickMobs(dt);
      tickProjectiles(dt);
      tickDrops(dt);
      tickParticles(dt);
      if (St.mode === 'sculpt' && St.sculpting && locked){
        St.sculptCd = (St.sculptCd || 0) - dt;
        if (St.sculptCd <= 0){ St.sculptCd = 0.09; sculpt(St.sculpting); }
      }
      if (St.comboT > 0){ St.comboT -= dt; if (St.comboT <= 0) St.combo = 0; }
      updateFocus(dt);
      tickGather(dt);
      updateGhost();
    }
    updateCamera(dt);
    updateSky(dt);

    //  Water slosh, on the step, so it reads as animated by hand.
    if (S.water){
      const a = S.water.geometry.attributes.position;
      const b = S.waterBase;
      for (let i = 0; i < a.count; i++){
        const x = b[i * 3], z = b[i * 3 + 2];
        a.array[i * 3 + 1] = Math.sin(x * 0.08 + St.step * 1.6) * 0.22 +
                             Math.cos(z * 0.07 - St.step * 1.1) * 0.18;
      }
      a.needsUpdate = true;
      S.water.position.x = Pl.pos.x; S.water.position.z = Pl.pos.z;
    }

    if (S.sky) S.sky.position.set(SHW.camera.position.x, 0, SHW.camera.position.z);
    if (S.blockLights){
      refreshBlockLights._t = (refreshBlockLights._t || 0) + dt;
      if (refreshBlockLights._t > 0.6){ refreshBlockLights._t = 0; refreshBlockLights(); }
    }

    hudAccum += dt;
    if (hudAccum > 0.1){ hudAccum = 0; updateHUD(); }
    mapAccum += dt;
    if (mapAccum > 0.28){ mapAccum = 0; drawMap(); }
    saveAccum += dt;
    if (saveAccum > 22){ saveAccum = 0; if (St.dirty) save(); }
  } else {
    //  Title card. The camera drifts around the Kiln, because a still frame
    //  behind a title looks like a crash.
    St.cycle = (St.cycle + dt * 3) % CYCLE;
    St.night = St.cycle >= DAY_LEN;
    const a = St.t * 0.09;
    SHW.camera.position.set(Math.cos(a) * 34, BASE_Y + 15 + Math.sin(a * 0.7) * 4, Math.sin(a) * 34);
    SHW.camera.lookAt(0, BASE_Y + 6, 0);
    if (S.sky) S.sky.position.set(SHW.camera.position.x, 0, SHW.camera.position.z);
    updateSky(dt);
    tickParticles(dt);
  }

  SHW.renderer.render(SHW.scene, SHW.camera);
}

// ─── 29 · Mount / unmount ────────────────────────────────────────────────────

function sizeTo(){
  if (!SHW.renderer || !hud.root) return;
  const r = hud.root.getBoundingClientRect();
  const w = Math.max(320, r.width), h = Math.max(240, r.height);
  SHW.renderer.setSize(w, h, false);
  SHW.camera.aspect = w / h;
  SHW.camera.updateProjectionMatrix();
}

async function mount(host, opts){
  if (SHW.mounted) return;
  SHW.opts = opts || {};
  SHW.host = host;
  host.innerHTML = '';
  buildHUD(host);

  SHW.renderer = new THREE.WebGLRenderer({
    canvas: hud.canvas, antialias: true, powerPreference: 'high-performance' });
  SHW.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  SHW.renderer.outputColorSpace = THREE.SRGBColorSpace;
  SHW.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  SHW.renderer.toneMappingExposure = 1.24;

  SHW.scene = new THREE.Scene();
  SHW.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 700);
  SHW.clock = new THREE.Clock();
  SHW.mounted = true;

  SHW.seed = 'wild-1';
  SHW.noise = makeNoise(hashStr(SHW.seed));
  SHW.moist = makeNoise(hashStr(SHW.seed + '-m'));

  const xl = hud.root.querySelector('#shw-exitlabel');
  if (xl && SHW.opts.exitLabel) xl.textContent = SHW.opts.exitLabel;

  bindInput();
  setMode('fight');
  on(window, 'resize', sizeTo);
  sizeTo();

  //  Title card first, and Continue only lights up if there is one.
  const d = await loadSave();
  const cont = hud.root.querySelector('#shw-cont');
  if (d && applySave(d)){
    cont.textContent = `Continue · day ${d.day}`;
    cont.disabled = false;
  } else {
    cont.style.display = 'none';
    SHW.noise = makeNoise(hashStr(SHW.seed));
    SHW.moist = makeNoise(hashStr(SHW.seed + '-m'));
    buildHeights();
  }

  //  A quiet world behind the title card, so the cabinet is never a black box.
  clearWorld();
  buildWorld();
  refreshBlocks();
  applyKiln();
  Pl.pos.set(0, groundY(0, 16) + 1, 16);
  Pl.yaw = Math.PI;
  SHW.camera.position.set(14, BASE_Y + 12, 26);
  SHW.camera.lookAt(0, BASE_Y + 5, 0);
  St.phase = 'title';
  hud.lock.classList.add('hide');
  updateHUD();
  drawMap();

  SHW.clock.start();
  SHW.raf = requestAnimationFrame(frame);
}

function unmount(){
  if (!SHW.mounted) return;
  SHW.opts = {};
  if (St.phase === 'play'){ try { save(); } catch (e){} }
  SHW.mounted = false;
  cancelAnimationFrame(SHW.raf);
  offAll();
  keys.clear();
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e){}
  clearWorld();
  try { SHW.renderer.dispose(); } catch (e){}
  SHW.renderer = null; SHW.scene = null; SHW.camera = null;
  if (SHW.host) SHW.host.innerHTML = '';
  SHW.host = null;
  for (const k in hud) delete hud[k];
}

//  Returning to the title without tearing the world down: the seed, the
//  edits and the blocks are already in memory, so Continue picks the same
//  ground back up rather than regenerating it.
function backToTitle(){
  if (St.phase === 'title') return;
  try { save(); } catch (e){}
  St.savedPos = [Pl.pos.x, Pl.pos.y, Pl.pos.z];
  St.savedYaw = Pl.yaw;
  St.savedFell = {
    trees: trees.map((t, i) => t.alive ? -1 : i).filter(x => x >= 0),
    rocks: rocks.map((r, i) => r.alive ? -1 : i).filter(x => x >= 0),
    banks: banks.map((b, i) => b.alive ? -1 : i).filter(x => x >= 0),
  };
  St.phase = 'title';
  St.invOpen = false;
  keys.clear();
  if (hud.inv) hud.inv.classList.remove('show');
  if (hud.dead) hud.dead.classList.remove('show');
  if (hud.lock) hud.lock.classList.add('hide');
  if (hud.title) hud.title.classList.remove('hide');
  try { document.exitPointerLock(); } catch (e){}
  const cont = hud.root && hud.root.querySelector('#shw-cont');
  if (cont){ cont.style.display = ''; cont.textContent = 'Continue · day ' + St.day; }
}

//  Esc means "give me back the thing that opened this". Inside the city that
//  is the cabinet; as its own Present Palm app there is nothing behind the
//  game, so it is the title card.
function leave(){
  const f = SHW.opts && SHW.opts.onExit;
  if (typeof f === 'function'){
    unmount();
    try { f(); } catch (e){}
    return;
  }
  backToTitle();
}


// ─── 30 · HARVESTING — the loop that was there and could not be seen ─────────
//  The mechanics worked from the first build: swing at a tree, get timber.
//  Nothing in the game ever said so. There was no highlight, no prompt, no
//  progress, and the swing was aimed by the PUPPET rather than the camera, so
//  the moment you moved the arc pointed somewhere you were not looking. Add
//  that trees have no player collision, so walking up to one until you bumped
//  it put you at distance zero, where the facing test collapsed and silently
//  refused, and the result is a resource economy that reads as broken.
//
//  So: hold the button. Look at a thing, hold, a ring fills, the thing yields
//  in one piece. Gathering is no longer the combat button doing double duty
//  without telling anybody.

const GATHER_R = 4.8;          // how far the crosshair reaches for a node
const GATHER_CONE = 0.62;      // radians of slop, generous on purpose

function keepR(){
  return KEEP_R_BASE + (St.kiln ? St.kiln.ring : 0) * KEEP_R_STEP;
}

//  Time and yield for a node, given what the player is carrying.
function nodePlan(n){
  const spec = NODE[n.kind];
  const lvl = spec.tool ? (St.tools[spec.tool] || 0) : 0;
  //  Bare-handed on something that wants a tool is deliberately slow, so the
  //  first crafted axe is felt rather than read about.
  const penalty = (spec.tool && lvl === 0) ? 1.75 : 1;
  return {
    spec,
    dur: spec.time * penalty / (1 + lvl * 0.42),
    yield: Math.round(spec.yield + lvl * 2.5),
    lvl,
  };
}

//  The node under the crosshair. Angular rather than a strict ray: a stop-
//  motion world is full of lumps and a hairline ray makes the player fight
//  the geometry instead of the game.
const _fwd = new THREE.Vector3();
function focusNode(){
  if (!SHW.camera) return null;
  SHW.camera.getWorldDirection(_fwd);
  const fx = _fwd.x, fz = _fwd.z;
  const fl = Math.hypot(fx, fz) || 1;
  const px = Pl.pos.x, pz = Pl.pos.z;

  let best = null, bestScore = Infinity;
  const consider = (n) => {
    if (!n.alive) return;
    const dx = n.x - px, dz = n.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > GATHER_R) return;
    //  Standing inside it counts as looking at it. This is the case the old
    //  code refused, and it is the case players hit first.
    let ang = 0;
    if (d > 0.9){
      const dot = (dx * fx + dz * fz) / (d * fl);
      ang = Math.acos(clamp(dot, -1, 1));
      if (ang > GATHER_CONE) return;
    }
    const score = ang * 3 + d * 0.35;
    if (score < bestScore){ bestScore = score; best = n; }
  };
  for (const t of trees) consider(t);
  for (const r of rocks) consider(r);
  for (const b of banks) consider(b);
  return best;
}

function makeFocusRing(){
  const g = new THREE.RingGeometry(0.82, 1.0, 36);
  g.rotateX(-Math.PI / 2);
  S.focusRing = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.9,
    side: THREE.DoubleSide, depthWrite: false,
  }));
  S.focusRing.renderOrder = 3;
  S.focusRing.visible = false;
  S.world.add(S.focusRing);
}

function updateFocus(dt){
  //  Gathering locks the focus, so drifting the mouse a hair mid-swing does
  //  not silently cancel the thing you are halfway through.
  const n = St.gather ? St.gather.node : (St.mode === 'fight' ? focusNode() : null);
  St.focus = n;

  const ring = S.focusRing;
  if (!ring) return;
  if (!n){
    ring.visible = false;
    hud.ring.classList.remove('on');
    //  Nothing under the crosshair, but the bench is the other thing the
    //  player has to be told about exactly once, at the moment it is usable.
    if (nearBench() && !St.benchOpen){
      hud.focus.classList.add('on');
      hud.focusName.textContent = 'The Bench';
      hud.focusYield.textContent = 'tools · gear · the kiln';
      hud.focusHint.textContent = 'press E';
    } else {
      hud.focus.classList.remove('on');
    }
    return;
  }

  const plan = nodePlan(n);
  const r = n.kind === 'tree' ? 1.25 * n.s : n.kind === 'rock' ? 1.35 * n.s : 1.7 * n.s;
  ring.position.set(n.x, groundY(n.x, n.z) + 0.14, n.z);
  ring.scale.setScalar(r);
  ring.material.color.setHex(plan.spec.hex);
  ring.material.opacity = 0.55 + Math.sin(St.step * 6) * 0.22;
  ring.visible = true;

  hud.focus.classList.add('on');
  hud.focusName.textContent = plan.spec.name;
  hud.focusYield.textContent = '+' + plan.yield + ' ' + plan.spec.res;
  hud.focusHint.textContent = St.gather ? 'hold…'
    : plan.spec.tool && plan.lvl === 0 ? 'hold to work it by hand'
    : 'hold to take it';

  if (St.gather){
    hud.ring.classList.add('on');
    const f = clamp(St.gather.t / St.gather.dur, 0, 1);
    hud.ring.style.setProperty('--p', (f * 360) + 'deg');
    hud.ring.style.setProperty('--c', '#' + plan.spec.hex.toString(16).padStart(6, '0'));
  } else {
    hud.ring.classList.remove('on');
  }
}

function beginGather(){
  const n = St.focus;
  if (!n || !n.alive) return false;
  const plan = nodePlan(n);
  St.gather = { node: n, t: 0, dur: plan.dur, plan };
  return true;
}

function cancelGather(){
  const g = St.gather;
  St.gather = null;
  if (hud.ring) hud.ring.classList.remove('on');
  //  Clicking once is what everybody tries first. Tell them the rule, once,
  //  at the exact moment it did not work.
  if (g && g.t > 0.1 && g.t < g.dur && !cancelGather._said){
    cancelGather._said = true;
    toast('Hold the button down to take it.', '#ffd47a');
  }
}

function tickGather(dt){
  const g = St.gather;
  if (!g) return;
  if (!g.node.alive){ cancelGather(); return; }
  //  Walk away and you lose it. Anything else and you would be able to gather
  //  a boulder from the far side of a hill.
  if (Math.hypot(g.node.x - Pl.pos.x, g.node.z - Pl.pos.z) > GATHER_R + 1.2){
    cancelGather(); return;
  }
  g.t += dt;
  St.stam = Math.max(0, St.stam - dt * 5);

  //  Chips fly the whole way through, so the hold has weight.
  if (Math.random() < dt * 14){
    const y = groundY(g.node.x, g.node.z);
    burst(g.node.x, y + 0.9, g.node.z, 1, g.plan.spec.hex, 3.5);
  }
  //  The puppet works at it on the stop-motion step.
  Pl.parts.armR.rotation.x = -0.9 - Math.sin(St.step * 14) * 0.7;
  Pl.parts.weaponPivot.rotation.x = Pl.parts.armR.rotation.x;

  if (g.t < g.dur) return;

  const n = g.node, plan = g.plan;
  const y = groundY(n.x, n.z);
  St.res[plan.spec.res] += plan.yield;
  killNode(n);
  burst(n.x, y + 1.2, n.z, 16, plan.spec.hex, 7);
  if (n.kind === 'tree') burst(n.x, y + 2.4, n.z, 10, n.leaf, 6);
  dmgNumber(n.x, y + 1.6, n.z, '+' + plan.yield);
  toast(`+${plan.yield} ${plan.spec.res}`,
        '#' + plan.spec.hex.toString(16).padStart(6, '0'));
  St.shake = Math.max(St.shake, 0.14);
  St.dirty = true;
  cancelGather();
}

// ─── 31 · THE BENCH — where resources finally mean something ────────────────
//  Timber and stone bought blocks and nothing else, which made the whole
//  economy a wall-building budget. The bench turns them into tools that make
//  gathering faster, plate and edges that make the night survivable, and a
//  bigger Kiln.

const TOOL_TIERS = [
  { lvl:1, name:'Hand Axe',   cost:{ timber:12, stone:8 } },
  { lvl:2, name:'Felling Axe',cost:{ timber:30, stone:22, ember:4 } },
  { lvl:3, name:'Kiln Axe',   cost:{ timber:60, stone:48, ember:14 } },
];
const PICK_TIERS = [
  { lvl:1, name:'Hand Pick',  cost:{ timber:8,  stone:14 } },
  { lvl:2, name:'Stone Pick', cost:{ timber:20, stone:36, ember:4 } },
  { lvl:3, name:'Kiln Pick',  cost:{ timber:44, stone:70, ember:14 } },
];

const KILN_UPGRADES = {
  ring: { name:'Widen the ring', max: KEEP_R_MAX_LVL,
          blurb: lvl => `Protected ground ${KEEP_R_BASE + lvl * KEEP_R_STEP}m → ${KEEP_R_BASE + (lvl+1) * KEEP_R_STEP}m`,
          cost: lvl => ({ stone: 40 + lvl * 45, earth: 30 + lvl * 40 }) },
  brazier:{ name:'Feed the braziers', max: 3,
          blurb: lvl => `Nothing spawns within ${keepR() + 8 + lvl * 5}m, and the ring burns brighter`,
          cost: lvl => ({ ember: 8 + lvl * 10, timber: 20 + lvl * 20 }) },
  height:{ name:'Raise the kiln', max: 3,
          blurb: lvl => `The kiln stands taller, and mends you ${(9 + (lvl+1) * 6)}hp a second inside the ring`,
          cost: lvl => ({ timber: 45 + lvl * 40, stone: 35 + lvl * 35 }) },
  bench: { name:'Bench tier', max: 2,
          blurb: lvl => `Unlocks tier ${lvl + 2} tools and gear work`,
          cost: lvl => ({ timber: 30 + lvl * 45, stone: 30 + lvl * 45, ember: 6 + lvl * 12 }) },
};

function nearBench(){
  return S.bench && Math.hypot(Pl.pos.x - S.bench.x, Pl.pos.z - S.bench.z) < 4.2;
}

function canAfford(cost){
  for (const k in cost) if (St.res[k] < cost[k]) return false;
  return true;
}
function spend(cost){
  for (const k in cost) St.res[k] -= cost[k];
  St.dirty = true;
}
function costLine(cost){
  return Object.keys(cost).map(k => `${cost[k]} ${k}`).join(' · ');
}

function toggleBench(force){
  const want = force === undefined ? !St.benchOpen : !!force;
  if (want && !nearBench()){ toast('Stand at the bench.', '#9c93c6'); return; }
  St.benchOpen = want;
  hud.bench.classList.toggle('show', want);
  hud.lock.classList.toggle('hide', want || locked || St.phase !== 'play');
  if (want){ cancelGather(); renderBench(); document.exitPointerLock(); }
}

function craftTool(which){
  const tiers = which === 'axe' ? TOOL_TIERS : PICK_TIERS;
  const lvl = St.tools[which] || 0;
  const next = tiers[lvl];
  if (!next){ toast('Already the best there is.', '#9c93c6'); return; }
  if (next.lvl > St.kiln.bench + 1){ toast('The bench is not good enough yet.', '#ff5268'); return; }
  if (!canAfford(next.cost)){ toast('Not enough for that.', '#ff5268'); return; }
  spend(next.cost);
  St.tools[which] = next.lvl;
  toast(`Made a ${next.name}.`, '#7dffb3');
  renderBench(); updateHUD();
}

//  Gear work: push one worn piece up a rarity step. Ember is the currency,
//  which is what makes killing things at night worth doing after you already
//  have a weapon you like.
function upgradeGear(slot){
  const it = St.gear[slot];
  if (!it){ toast('Nothing in that slot.', '#9c93c6'); return; }
  const i = RARITY.findIndex(r => r.key === it.rarity);
  const cap = 2 + St.kiln.bench;                     // bench tier gates the ceiling
  if (i >= RARITY.length - 1){ toast('Cannot be bettered.', '#9c93c6'); return; }
  if (i >= cap){ toast('The bench cannot work it that far.', '#ff5268'); return; }
  const cost = { ember: 6 + i * 8, stone: 10 + i * 12, timber: 6 + i * 10 };
  if (!canAfford(cost)){ toast('Not enough for that.', '#ff5268'); return; }
  spend(cost);
  const from = RARITY[i], to = RARITY[i + 1];
  const k = to.mult / from.mult;
  it.rarity = to.key;
  it.name = it.name.replace(from.name, to.name);
  if (it.name.indexOf(to.name) !== 0) it.name = to.name + ' ' + it.name;
  if (it.kind === 'weapon') it.dmg = Math.round(it.dmg * k);
  else it.armour = Math.round(it.armour * k);
  if (slot === 'weapon') refreshWeaponMesh();
  refreshGearPlates(); recomputeStats();
  toast(`${it.name}`, to.col);
  renderBench(); updateHUD();
}

function upgradeKiln(key){
  const def = KILN_UPGRADES[key];
  const lvl = St.kiln[key] || 0;
  if (lvl >= def.max){ toast('Already at the top.', '#9c93c6'); return; }
  const cost = def.cost(lvl);
  if (!canAfford(cost)){ toast('Not enough for that.', '#ff5268'); return; }
  spend(cost);
  St.kiln[key] = lvl + 1;
  applyKiln();
  banner(def.name, 'the kiln takes it');
  St.shake = Math.max(St.shake, 0.3);
  renderBench(); updateHUD(); drawMap();
}

//  Every upgrade has to actually change the world, or it is a number going up
//  in a menu. The ring moves, the braziers move and brighten, the kiln grows.
function applyKiln(){
  const R = keepR();
  if (S.ring){
    S.ring.scale.setScalar(R / KEEP_R_BASE);
  }
  if (S.braziers){
    S.braziers.forEach((b, i) => {
      const a = i * Math.PI / 4;
      b.position.x = Math.cos(a) * (R - 1.4);
      b.position.z = Math.sin(a) * (R - 1.4);
    });
  }
  if (S.brazierPosts){
    S.brazierPosts.forEach((pst, i) => {
      const a = i * Math.PI / 4;
      pst.position.x = Math.cos(a) * (R - 1.4);
      pst.position.z = Math.sin(a) * (R - 1.4);
    });
  }
  if (S.kilnGrow){
    const g = 1 + St.kiln.height * 0.13;
    S.kilnGrow.scale.set(1 + St.kiln.height * 0.05, g, 1 + St.kiln.height * 0.05);
  }
  if (S.hearth) S.hearth.distance = 46 + St.kiln.brazier * 14;
}

function benchRegen(){ return 9 + St.kiln.height * 6; }

function renderBench(){
  const res = St.res;
  const chip = (cost) => {
    const ok = canAfford(cost);
    return `<em class="${ok ? '' : 'no'}">${costLine(cost)}</em>`;
  };
  const row = (title, blurb, cost, action, dis, extra) => `
    <button class="shw-craft${dis ? ' off' : ''}" data-do="${action}">
      <b>${title}</b><span>${blurb}</span>${cost ? chip(cost) : ''}
      ${extra ? `<u>${extra}</u>` : ''}
    </button>`;

  let tools = '';
  for (const [which, tiers, label] of [['axe', TOOL_TIERS, 'Axe'], ['pick', PICK_TIERS, 'Pick']]){
    const lvl = St.tools[which] || 0;
    const next = tiers[lvl];
    const cur = lvl ? tiers[lvl - 1].name : 'bare hands';
    if (!next){
      tools += row(label, `${cur} · nothing better exists`, null, '', true);
    } else {
      const gated = next.lvl > St.kiln.bench + 1;
      tools += row(next.name,
        `${cur} → ${next.name}. ${which === 'axe' ? 'Trees' : 'Boulders'} come up faster and give more.`,
        next.cost, 'tool:' + which, gated || !canAfford(next.cost),
        gated ? 'needs a better bench' : '');
    }
  }

  let gear = '';
  for (const slot of ['weapon','head','chest','legs']){
    const it = St.gear[slot];
    if (!it){ gear += row(slot, 'empty', null, '', true); continue; }
    const i = RARITY.findIndex(r => r.key === it.rarity);
    const cap = 2 + St.kiln.bench;
    if (i >= RARITY.length - 1){ gear += row(it.name, 'cannot be bettered', null, '', true); continue; }
    if (i >= cap){ gear += row(it.name, `${RARITY[i].name} → ${RARITY[i+1].name}`, null, '', true, 'needs a better bench'); continue; }
    const cost = { ember: 6 + i * 8, stone: 10 + i * 12, timber: 6 + i * 10 };
    gear += row(it.name, `${RARITY[i].name} → ${RARITY[i+1].name}`, cost, 'gear:' + slot, !canAfford(cost));
  }

  let kiln = '';
  for (const key of ['ring','brazier','height','bench']){
    const def = KILN_UPGRADES[key];
    const lvl = St.kiln[key] || 0;
    if (lvl >= def.max){ kiln += row(def.name, `level ${lvl} · at the top`, null, '', true); continue; }
    const cost = def.cost(lvl);
    kiln += row(def.name, `level ${lvl} → ${lvl + 1}. ${def.blurb(lvl)}`, cost,
                'kiln:' + key, !canAfford(cost));
  }

  hud.benchBody.innerHTML = `
    <section><h4>Tools</h4>${tools}</section>
    <section><h4>Gear</h4>${gear}
      <button class="shw-craft" data-do="scrap"><b>Scrap spares</b>
        <span>Everything not worn, melted down for ember.</span>
        <em>${St.inv.length} spare</em></button>
    </section>
    <section><h4>The Kiln</h4>${kiln}</section>`;

  hud.benchRes.textContent =
    `${Math.floor(res.earth)} earth · ${Math.floor(res.timber)} timber · ` +
    `${Math.floor(res.stone)} stone · ${Math.floor(res.ember)} ember`;

  hud.benchBody.querySelectorAll('.shw-craft').forEach(el => {
    el.onclick = () => {
      const d = el.dataset.do;
      if (!d) return;
      if (d === 'scrap'){ scrapAll(); renderBench(); return; }
      const [what, arg] = d.split(':');
      if (what === 'tool') craftTool(arg);
      else if (what === 'gear') upgradeGear(arg);
      else if (what === 'kiln') upgradeKiln(arg);
    };
  });
}

window.SHW_WILD = {
  mount, unmount,
  get mounted(){ return SHW.mounted; },
  //  Tuning handle. Lets the cycle, a wave, or a drop be driven straight from
  //  the console while balancing, instead of standing outside for three
  //  minutes waiting for dark.
  dev: {
    state: St, player: Pl, mobs: () => mobs, scene: () => S,
    setTime(sec){ St.cycle = clamp(sec, 0, CYCLE - 0.1); St.night = St.cycle >= DAY_LEN;
                  if (hud.root) hud.root.classList.toggle('night', St.night); },
    night(){ this.setTime(DAY_LEN + 4); },
    day(){ this.setTime(DAY_LEN * 0.26); },
    wave(){ spawnWave(); },
    trees: () => trees, rocks: () => rocks, banks: () => banks,
    bench(){ Pl.pos.set(S.bench.x, groundY(S.bench.x, S.bench.z) + 0.2, S.bench.z); },
    focus(){ return St.focus; },
    //  Drives one full hold without waiting on wall clock, for tests.
    hold(){ if (!beginGather()) return null;
            let guard = 0;
            while (St.gather && guard++ < 400) tickGather(0.05);
            return guard; },
    stock(n){ for (const k in St.res) St.res[k] += (n || 500); },
    swing(){ attack(); },
    at(x, z){ Pl.pos.set(x, groundY(x, z) + 0.2, z); Pl.vel.set(0,0,0); },
    face(x, z){
      Pl.yaw = Math.atan2(-(x - Pl.pos.x), -(z - Pl.pos.z));
      Pl.group.rotation.y = Pl.yaw + Math.PI;
      //  The camera eases into place over several frames; a test that reads
      //  the focus on the next tick would be measuring the lerp, not the game.
      for (let i = 0; i < 40; i++) updateCamera(0.1);
      updateFocus(0.016);
    },
    give(tier){ return dropLoot(Pl.pos.x + 1.1, Pl.pos.y, Pl.pos.z, tier || 3); },
  },
};

})();
