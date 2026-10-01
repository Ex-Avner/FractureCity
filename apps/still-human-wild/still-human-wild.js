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

//  The world is 576m across and does NOT all exist at once. Tiles are built
//  as the player approaches and thrown away behind them, because the whole
//  thing meshed at once is 400 draw calls and 460,800 triangles, and this has
//  to run inside an arcade cabinet in a one-file web page.
//
//  The heightfield itself IS fully resident: 481 x 481 floats twice over is
//  1.85MB, and having it everywhere is what lets the map, the minimap and the
//  settlement placer ask about ground they have never drawn.
const WORLD   = 576;            // world spans -288 .. 288 on both axes
const CELL    = 1.2;            // metres per heightfield cell
const GRID    = Math.round(WORLD / CELL);       // 480 cells
const TILE    = 24;             // cells per streamed tile — 28.8m square
const TILES   = GRID / TILE;    // 20 x 20 tiles, 400 in the whole world
const HALF    = WORLD / 2;

const LOAD_R    = 5;            // tiles: build out to ~144m
const UNLOAD_R  = 7;            // tiles: keep until ~202m, then let go
const BUILD_BUDGET = 3;         // tiles meshed per frame, so arriving is smooth

//  One coarse mesh of the entire world, a quarter of the resolution, sitting
//  1.5m low so the streamed tiles always win where they exist. It costs one
//  draw call and 28,800 triangles and it is the only reason there is a horizon
//  at all past the streaming radius.
const FAR_STEP = 4;             // heightfield cells per backdrop quad

const WATER_Y = 2.4;
const BASE_R  = 46;             // plateau radius, blended out to the plains
const TOWN_PLATEAU = 17;        // flat core under an outlying settlement
const TOWN_BLEND   = 44;        // and how far its apron reaches
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
//  v2. The old format keyed terrain edits by a flat index into a fixed-size
//  array, so changing the world size moved every edit somewhere else. Edits
//  are stored as (i, j, delta) now, which is the last time this has to break.
//  The v1 key is left alone on disk rather than overwritten.
const SAVE_KEY  = 'stillhuman-wild-v2';
//  Nothing in the build said which build it was, so a bug report could not
//  name one. It is on the title card and on window.SHW_WILD.
const SHW_VERSION = '0.4.1';

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

//  col is the flesh. It is deliberately drab — a corpse that comes out of the
//  ground the same purple as a nightclub reads as a plastic figurine, not as
//  something that used to be a person. All the colour in these things lives in
//  two places instead: the bruising, and the light coming out of them. spark is
//  the hit-and-death spray, which can be as loud as the rest of the arcade.
const MOBS = {
  husk:    { name:'Husk',     hp:34,  spd:2.3, dmg:9,  r:0.62, h:1.9,
             col:0x8b9377, bruise:0x5e3f5a, eye:0xff4f6d, spark:0x9a6fd8, tier:1 },
  stalker: { name:'Stalker',  hp:22,  spd:4.5, dmg:7,  r:0.48, h:1.6,
             col:0xa39177, bruise:0x7a3346, eye:0xffe14f, spark:0xd8496a, tier:1 },
  lumber:  { name:'Lumberer', hp:96,  spd:1.7, dmg:22, r:0.95, h:2.9,
             col:0x6f8083, bruise:0x39516b, eye:0xff9a3d, spark:0x4f8fc0, tier:2 },
  wisp:    { name:'Emberwisp',hp:30,  spd:2.9, dmg:11, r:0.55, h:1.4,
             col:0x9c8d72, bruise:0x7a4526, eye:0xfff3c0, spark:0xff9a3d, tier:2,
             flies:true, ranged:true },
  molder:  { name:'Molder',   hp:180, spd:1.5, dmg:31, r:1.25, h:3.6,
             col:0x69735a, bruise:0x4a2a3c, eye:0xff2f4f, spark:0xff2f4f, tier:3 },
  //  A ghost. Floats, never touches the ground, and is half there — the body
  //  is drawn see-through, so at night it reads as a shape the moonlight goes
  //  straight through. It fights like everything else; the difference is in
  //  the eye and in what it looks like coming at you.
  wraith:  { name:'Wraith',   hp:44,  spd:3.4, dmg:14, r:0.55, h:2.0,
             col:0xb8c4cc, bruise:0x5d6f88, eye:0x9ff0ff, spark:0xbfe9ff, tier:2,
             flies:true, ghost:true },
  //  A werewolf. Fast, low, and all shoulder — the one thing out there that
  //  closes the distance before you have finished deciding what to do.
  wolf:    { name:'Werewolf', hp:78,  spd:5.6, dmg:19, r:0.72, h:2.2,
             col:0x8b7458, bruise:0x5b3327, eye:0xffd23d, spark:0xffb23d, tier:3 },
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
  CLAY_TEX = markShared(t);
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

//  Anything removed from the scene has to give its GPU memory back. Mobs,
//  spit, loot and rebuilt settlements were all being detached and forgotten:
//  measured, forty husks killed and cleaned up left fifteen geometries behind,
//  and every one of them had brought a cloned 256x256 clay texture with it.
//  Shared assets are marked so the disposer steps over them.
function markShared(x){ if (x){ x.userData = x.userData || {}; x.userData.shared = true; } return x; }

function disposeTree(root){
  if (!root) return;
  root.traverse(o => {
    if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
    if (!o.material) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms){
      if (m.userData && m.userData.shared) continue;
      if (m.map && !(m.map.userData && m.map.userData.shared)) m.map.dispose();
      m.dispose();
    }
  });
}

function clayMat(opts){
  //  A cloned texture is a separate GPU upload. Anything that repeats needs
  //  its own; anything at repeat 1 can share the one atlas, which is every
  //  creature, every dropped weapon and every part of the player.
  const rep = (opts && opts.rep) || 1;
  let t;
  if (rep === 1){
    t = markShared(clayTexture());
  } else {
    t = clayTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(rep, rep);
  }
  const m = new THREE.MeshLambertMaterial(Object.assign({
    map: t, flatShading: true,
  }, opts && opts.mat ? opts.mat : {}));
  return withRim(m);
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
  //  The spine of ten. bossIdx is how many are down, so it doubles as the
  //  index of the next one; bossCalled stops one night calling two.
  bossIdx: 0, bossCalled: false, keystones: 0, won: false, wonOnDay: 0,
  hitStop: 0, shake: 0,
  torch: true,
  //  Kiln upgrade levels, tool levels, and what the crosshair is resting on.
  kiln: { ring: 0, brazier: 0, height: 0, bench: 0 },
  tools: { axe: 0, pick: 0 },
  focus: null,          // the node under the crosshair, if any
  gather: null,         // { node, t, dur } while the button is held
  benchOpen: false,
  mapOpen: false, mapSpan: 420, mapCx: 0, mapCz: 0,
  waypoint: null,
  quest: { i: 0, done: {} },
  contracts: {}, contractSeed: 1,
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
let tiles = new Map();  // "ti,tj" -> { ti, tj, mesh, geo }   only what is near
let tileQueue = [];     // tiles wanted but not yet meshed, nearest first
let lastTileKey = '';   // player's tile last frame, so the window only moves on change
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

//  ─── Settlements ──────────────────────────────────────────────────────────
//  The Kiln used to be welded to the origin: baseHeight flattened a plateau at
//  (0,0) and every protection, spawn and regen rule asked hypot(x, z) from
//  world centre. A world with towns in it needs a list and a nearest-of query
//  instead, and the terrain has to flatten under all of them.

const TOWN_NAMES = [
  'Ashfell', 'Low Harrow', 'Cinder Well', 'Marrowgate',
  'Still Water', 'Thorn Reach', 'Old Bellow', 'Grey Ember',
];

let settlements = [];

function planSettlements(){
  const rnd = mulberry(hashStr(SHW.seed) ^ 0x5e7715);
  settlements = [{
    id: 'kiln', name: 'The Kiln', kind: 'home', x: 0, z: 0,
    ring: KEEP_R_BASE, plateau: PLATEAU_R, blend: BASE_R,
    claimed: true, cleared: true,
  }];

  //  Six more on a jittered ring, far enough out that reaching one is a walk
  //  and not a stroll, and never so far that they touch the world's edge wall.
  const n = 6;
  const names = TOWN_NAMES.slice();
  for (let i = 0; i < n; i++){
    const a = (i / n) * 6.2832 + (rnd() - 0.5) * 0.75;
    const r = 118 + rnd() * 112;                     // 118m .. 230m out
    const kind = (i === 0 || i === 3) ? 'town' : 'ruin';
    const name = names.splice(Math.floor(rnd() * names.length), 1)[0] || ('Waypost ' + i);
    settlements.push({
      id: 's' + i, name, kind,
      x: Math.cos(a) * r, z: Math.sin(a) * r,
      ring: kind === 'town' ? 15 : 12,
      plateau: TOWN_PLATEAU, blend: TOWN_BLEND,
      //  A living town is safe from the start. A ruin is a dead kiln: its ring
      //  is unlit until you clear it, so it protects nobody.
      claimed: kind === 'town', cleared: kind === 'town',
      blight: kind === 'ruin' ? 6 : 0,
    });
  }
}

//  Nearest settlement of any kind, and nearest one that is actually lit.
function nearestSettlement(x, z, litOnly){
  let best = null, bd = Infinity;
  for (const s of settlements){
    if (litOnly && !s.claimed) continue;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < bd){ bd = d; best = s; }
  }
  return { s: best, d: bd };
}

//  "Am I on protected ground" — the question the sculpt tool, the build tool,
//  the spawner, the mob push-out and the regen all used to ask about origin.
function ringAt(s){
  if (!s) return 0;
  return s.kind === 'home' ? keepR() : s.ring;
}
//  Any settlement's ground, lit or not: a ruin's plateau is still a town site
//  and digging a pit in it before you relight it helps nobody.
function siteBlocked(x, z, margin){
  for (let i = 0; i < settlements.length; i++){
    const st = settlements[i];
    if (Math.hypot(x - st.x, z - st.z) < ringAt(st) + (margin || 0)) return st;
  }
  return null;
}

function protectedAt(x, z){
  const n = nearestSettlement(x, z, true);
  return n.s && n.d < ringAt(n.s) ? n : null;
}

// ─── The ground ─────────────────────────────────────────────────────────────

//  A value-noise fBm does not have the same mean on every seed, so a fixed
//  threshold on it produced worlds anywhere from 30% plains to 93% plains.
//  Sample the two mask fields once per world and take the thresholds as
//  PERCENTILES of what this particular seed actually produced. Same coverage
//  every time, whatever the noise felt like doing.
function calibrateMasks(){
  const n = SHW.noise;
  const ms = [], rs = [];
  for (let j = 0; j < 64; j++){
    for (let i = 0; i < 64; i++){
      const x = -HALF + (i + 0.5) / 64 * WORLD;
      const z = -HALF + (j + 0.5) / 64 * WORLD;
      ms.push(fbm(n, x * 0.0031 + 311, z * 0.0031 - 77, 3, 2.0, 0.5));
      rs.push(fbm(n, x * 0.0018 - 501, z * 0.0018 + 233, 2, 2.0, 0.5));
    }
  }
  ms.sort((a, b) => a - b); rs.sort((a, b) => a - b);
  const q = (A, p) => A[Math.floor(clamp(p, 0, 0.999) * A.length)];
  SHW.mt = q(ms, 0.50); SHW.mw = Math.max(0.05, q(ms, 0.68) - q(ms, 0.50));
  SHW.rt = q(rs, 0.30); SHW.rw = Math.max(0.05, q(rs, 0.72) - q(rs, 0.30));
}

function baseHeight(wx, wz){
  const n = SHW.noise;

  //  Broad plains. Lower frequency than the 192m world used, or nine times the
  //  area is nine times as many hills and none of them read as a landscape.
  let h = fbm(n, wx * 0.0042, wz * 0.0042, 4, 2.03, 0.5) * 9.0;
  h += fbm(n, wx * 0.019, wz * 0.019, 3, 2.0, 0.5) * 2.5;

  //  Mountains are REGIONS, not a ring around the player. A low-frequency
  //  massif field decides where a range is allowed to be, and ridged noise
  //  does the shape inside it. The old radial mask put every peak at a fixed
  //  distance from the origin, which at 576m meant the entire world was
  //  mountain and the scatter starved: 3,400 boulders and 416 trees.
  const massif = fbm(n, wx * 0.0031 + 311, wz * 0.0031 - 77, 3, 2.0, 0.5);
  const region = fbm(n, wx * 0.0018 - 501, wz * 0.0018 + 233, 2, 2.0, 0.5);
  const mMask = smooth((massif - SHW.mt) / SHW.mw) * smooth((region - SHW.rt) / SHW.rw);
  const ridge = 1 - Math.abs(fbm(n, wx * 0.0072 + 71, wz * 0.0072 - 40, 4, 2.11, 0.55) * 2 - 1);
  h += Math.pow(ridge, 2.4) * 38.0 * mMask;

  //  Thumbprints.
  h += fbm(n, wx * 0.14, wz * 0.14, 2, 2.0, 0.5) * 0.55;
  h += 3.0;

  //  The world has walls, and they are mountains rather than an invisible
  //  line. Nothing is generated out there and nothing needs to be.
  const edge = Math.max(Math.abs(wx), Math.abs(wz));
  h += smooth((edge - HALF * 0.92) / (HALF * 0.08)) * 32;

  //  A river running north to south with a wander in it, cut wider than the
  //  small world's because it now has to read from a ridge two hundred metres
  //  away.
  const wander = (fbm(n, wz * 0.0055 + 200, 0.5, 3, 2, 0.5) - 0.5) * 150;
  const dRiver = Math.abs(wx - (-60 + wander));
  const river = 1 - smooth(dRiver / 15);
  h = lerp(h, WATER_Y - 1.6, river * 0.9);

  //  Flat ground under every settlement, not just the one at the origin.
  for (let i = 0; i < settlements.length; i++){
    const st = settlements[i];
    const d = Math.hypot(wx - st.x, wz - st.z);
    if (d > st.blend) continue;
    //  A gentler curve as well as a longer one: pow < 1 pulls the apron flat
    //  near the town and lets it ease out rather than dropping away.
    const flat = Math.pow(1 - smooth((d - st.plateau) / (st.blend - st.plateau)), 0.85);
    h = lerp(h, st.kind === 'home' ? BASE_Y : st.y0, flat);
  }

  return h;
}

//  A settlement's floor height has to be decided BEFORE the plateau is cut,
//  or the flatten would be circular. Sample the raw land under it once.
function settleFloors(){
  for (const st of settlements){
    if (st.kind === 'home'){ st.y0 = BASE_Y; continue; }
    st.y0 = 0;
    const n = SHW.noise;
    let h = fbm(n, st.x * 0.0042, st.z * 0.0042, 4, 2.03, 0.5) * 9.0;
    h += fbm(n, st.x * 0.019, st.z * 0.019, 3, 2.0, 0.5) * 2.5;
    const massif = fbm(n, st.x * 0.0031 + 311, st.z * 0.0031 - 77, 3, 2.0, 0.5);
    const region = fbm(n, st.x * 0.0018 - 501, st.z * 0.0018 + 233, 2, 2.0, 0.5);
    const mMask = smooth((massif - SHW.mt) / SHW.mw) * smooth((region - SHW.rt) / SHW.rw);
    const ridge = 1 - Math.abs(fbm(n, st.x * 0.0072 + 71, st.z * 0.0072 - 40, 4, 2.11, 0.55) * 2 - 1);
    h += Math.pow(ridge, 2.4) * 38.0 * mMask;
    h += 3.0;
    //  Never underwater, never on a peak: a town you cannot walk out of is
    //  not a town.
    st.y0 = clamp(h, WATER_Y + 2.4, 19.5);
  }
}

function buildHeights(){
  //  Order matters: the settlements decide where the plateaus are, and their
  //  floor heights are sampled from the raw land before any flattening, or
  //  the flatten would be defined in terms of itself.
  calibrateMasks();
  if (!settlements.length) planSettlements();
  settleFloors();
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
  tiles = new Map();
  tileQueue = [];
  lastTileKey = '';
  makeFarMesh();
}

const tkey = (ti, tj) => ti + ',' + tj;
const tileOf = (w) => clamp(Math.floor((w + HALF) / CELL / TILE), 0, TILES - 1);

function addTile(ti, tj){
  const geo = buildTile(ti, tj);
  const mesh = new THREE.Mesh(geo, S.terrainMat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  S.world.add(mesh);
  tiles.set(tkey(ti, tj), { ti, tj, mesh, geo });
}

function dropTile(t){
  S.world.remove(t.mesh);
  t.geo.dispose();
  tiles.delete(tkey(t.ti, t.tj));
}

//  Called every frame. Cheap when the player has not crossed a tile edge,
//  which is almost always.
function updateStream(force){
  const pi = tileOf(Pl.pos.x), pj = tileOf(Pl.pos.z);
  const key = tkey(pi, pj);
  if (key !== lastTileKey || force){
    lastTileKey = key;

    //  Want: everything inside LOAD_R, nearest first so the ground under your
    //  feet is never the last thing to arrive.
    const want = [];
    for (let j = pj - LOAD_R; j <= pj + LOAD_R; j++){
      for (let i = pi - LOAD_R; i <= pi + LOAD_R; i++){
        if (i < 0 || j < 0 || i >= TILES || j >= TILES) continue;
        const d = Math.hypot(i - pi, j - pj);
        if (d > LOAD_R + 0.5) continue;
        if (!tiles.has(tkey(i, j))) want.push({ i, j, d });
      }
    }
    want.sort((a, b) => a.d - b.d);
    tileQueue = want;

    //  Let go of anything well behind, with hysteresis between the two radii
    //  so walking a boundary does not thrash.
    for (const t of [...tiles.values()]){
      if (Math.hypot(t.ti - pi, t.tj - pj) > UNLOAD_R) dropTile(t);
    }
    refreshPropWindow(pi, pj);
  }

  let budget = force ? 999 : BUILD_BUDGET;
  while (tileQueue.length && budget-- > 0){
    const t = tileQueue.shift();
    if (!tiles.has(tkey(t.i, t.j))) addTile(t.i, t.j);
  }
}

//  Sculpting edits the heightfield, so whatever tiles are live over that patch
//  have to be remeshed. Tiles not loaded will pick the change up when built.
//  A tree's height is sampled once, at generation. Lower the ground under one
//  and it hangs in the air: measured at 3.22m of daylight under a trunk after
//  a single dig. Every prop whose ground moved gets re-seated.
function resettleProps(wx, wz, r){
  const i0 = tileOf(wx - r - 4), i1 = tileOf(wx + r + 4);
  const j0 = tileOf(wz - r - 4), j1 = tileOf(wz + r + 4);
  let touched = false;
  for (let j = j0; j <= j1; j++){
    for (let i = i0; i <= i1; i++){
      const b = propBuckets.get(tkey(i, j));
      if (!b) continue;
      for (const list of [b.trees, b.rocks, b.banks, b.bushes]){
        for (const o of list){
          if (Math.hypot(o.x - wx, o.z - wz) > r + 3) continue;
          const y = groundY(o.x, o.z);
          if (Math.abs(y - o.y) < 0.001) continue;
          o.y = y;
          touched = true;
        }
      }
    }
  }
  if (touched) propsDirty = true;
}

function rebuildTilesAround(wx, wz, r){
  const i0 = tileOf(wx - r), i1 = tileOf(wx + r);
  const j0 = tileOf(wz - r), j1 = tileOf(wz + r);
  for (let j = j0; j <= j1; j++){
    for (let i = i0; i <= i1; i++){
      const t = tiles.get(tkey(i, j));
      if (!t) continue;
      t.geo.dispose();
      t.geo = buildTile(t.ti, t.tj);
      t.mesh.geometry = t.geo;
    }
  }
  resettleProps(wx, wz, r);
  farDirty = true;
}

// ─── The horizon ────────────────────────────────────────────────────────────
//  A quarter-resolution mesh of the whole world, one draw call, sunk 1.5m so
//  the real tiles always cover it where they exist. Rebuilt lazily after
//  sculpting, because nobody can see a 1.5m error at 200 metres.
let farDirty = false, farTimer = 0;

function buildFarGeometry(){
  const N = GRID / FAR_STEP;                 // 120 quads a side
  const pos = new Float32Array(N * N * 6 * 3);
  const col = new Float32Array(N * N * 6 * 3);
  const uv  = new Float32Array(N * N * 6 * 2);
  const rnd = mulberry(hashStr(SHW.seed) ^ 0xfa2);
  let p = 0, c = 0, u = 0;
  const S4 = CELL * FAR_STEP;
  for (let j = 0; j < N; j++){
    for (let i = 0; i < N; i++){
      const x0 = -HALF + i * S4, z0 = -HALF + j * S4;
      const x1 = x0 + S4, z1 = z0 + S4;
      const y00 = heightAtIdx(i * FAR_STEP, j * FAR_STEP) - 1.5;
      const y10 = heightAtIdx((i + 1) * FAR_STEP, j * FAR_STEP) - 1.5;
      const y01 = heightAtIdx(i * FAR_STEP, (j + 1) * FAR_STEP) - 1.5;
      const y11 = heightAtIdx((i + 1) * FAR_STEP, (j + 1) * FAR_STEP) - 1.5;
      const tri = [[x0,y00,z0, x0,y01,z1, x1,y10,z0],
                   [x1,y10,z0, x0,y01,z1, x1,y11,z1]];
      for (let t = 0; t < 2; t++){
        const v = tri[t];
        const cx = (v[0]+v[3]+v[6])/3, cy = (v[1]+v[4]+v[7])/3, cz = (v[2]+v[5]+v[8])/3;
        const sl = Math.max(Math.abs(v[1]-v[4]), Math.abs(v[4]-v[7])) / S4;
        const cc = biomeColor(cx, cz, cy + 1.5, sl, rnd());
        for (let k = 0; k < 3; k++){
          pos[p++] = v[k*3]; pos[p++] = v[k*3+1]; pos[p++] = v[k*3+2];
          col[c++] = cc.r; col[c++] = cc.g; col[c++] = cc.b;
          uv[u++] = v[k*3] * 0.05; uv[u++] = v[k*3+2] * 0.05;
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

function makeFarMesh(){
  const geo = buildFarGeometry();
  S.far = new THREE.Mesh(geo, S.terrainMat);
  //  The backdrop receives but never casts: it is a stand-in for ground that
  //  is not loaded, and its shadow would fight the real tiles' shadows.
  S.far.receiveShadow = true;
  S.far.frustumCulled = false;
  S.far.renderOrder = -1;
  S.world.add(S.far);
}

function tickFar(dt){
  if (!farDirty) return;
  farTimer += dt;
  if (farTimer < 2.5) return;
  farTimer = 0; farDirty = false;
  if (!S.far) return;
  S.far.geometry.dispose();
  S.far.geometry = buildFarGeometry();
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

  const TRY = 46000;          // nine times the area, same density
  for (let n = 0; n < TRY; n++){
    const wx = (rnd() - 0.5) * (WORLD - 8);
    const wz = (rnd() - 0.5) * (WORLD - 8);
    //  Per kind, not one radius for everything. Trees keep back so a
    //  settlement is never buried behind a treeline; boulders and clay come
    //  to the edge of the ring, because "where is the stone" was the first
    //  thing that went wrong with this world.
    const site = nearestSettlement(wx, wz, false);
    const pl = site.s ? site.s.plateau : 0;
    const clearFor = { tree: pl + 3, other: pl - 6 };
    const d = site.d;
    if (d < clearFor.other) continue;
    const y = groundY(wx, wz);
    if (y < WATER_Y + 0.6) continue;
    const sl = slopeAt(wx, wz);
    const m = moistAt(wx, wz);

    const waterline = y < WATER_Y + 3.0;
    if (sl < 0.34 && banks.length < 2300 &&
        ((waterline && rnd() < 0.55) || (y < 17 && rnd() < 0.08))){
      //  Clay banks. Earth used to come only from lowering terrain in a mode
      //  nobody had opened, so two of the six build materials had no visible
      //  source. They cluster at the river cut and sit thinly through the
      //  plains, which is where the player actually is.
      banks.push({ kind:'bank', x: wx, z: wz, y, s: 0.9 + rnd() * 0.8,
                   rot: rnd() * 6.283, alive: true });
    } else if (d > clearFor.tree && y < 16 && sl < 0.55 && m > 0.38 && rnd() < (m - 0.32) * 1.9){
      if (trees.length < 4400){
        const cold = y > 11.5;
        const roll = rnd();
        const leaf = cold ? PAL.leafA
                   : roll < 0.62 ? PAL.leafB
                   : roll < 0.82 ? PAL.leafC
                   : PAL.leafD;
        trees.push({ kind:'tree', x: wx, z: wz, y, s: 0.8 + rnd() * 0.75, leaf,
                     rot: rnd() * 6.283, alive: true });
      }
    } else if (sl > 0.35 || y > 17.5 || rnd() < 0.20){
      //  Boulders were slope-only, so the nearest one to the Kiln was thirty
      //  metres up a hill and stone looked like it did not exist. They are
      //  scattered through the flats now as well, just more thinly.
      if (rocks.length < 3400 && rnd() < 0.40){
        rocks.push({ kind:'rock', x: wx, z: wz, y, s: 0.6 + rnd() * 1.5,
                     rot: rnd() * 6.283, alive: true });
      }
    } else if (rnd() < 0.10 && bushPos.length < 3600){
      bushPos.push({ x: wx, z: wz, y, s: 0.5 + rnd() * 0.6, rot: rnd() * 6.283 });
    }
  }

  //  Props are DATA for the whole world and INSTANCES only for what is near.
  //  Nine times the area means roughly four thousand trees; drawing them all
  //  is 160,000 triangles that no frustum test can help with, because an
  //  InstancedMesh is one object as far as culling is concerned. So the arrays
  //  hold everything and the instance buffers hold a window, rewritten when
  //  the player crosses a tile edge.
  propBuckets = new Map();
  const bucket = (o) => {
    const k = tkey(tileOf(o.x), tileOf(o.z));
    let b = propBuckets.get(k);
    if (!b){ b = { trees: [], rocks: [], banks: [], bushes: [] }; propBuckets.set(k, b); }
    return b;
  };
  for (const t of trees) bucket(t).trees.push(t);
  for (const r of rocks) bucket(r).rocks.push(r);
  for (const b of banks) bucket(b).banks.push(b);
  for (const b of bushPos){ b.alive = true; bucket(b).bushes.push(b); }

  const trunkGeo = new THREE.CylinderGeometry(0.20, 0.30, 1, 5, 1);
  trunkGeo.translate(0, 0.5, 0);
  S.trunks = new THREE.InstancedMesh(trunkGeo,
    clayMat({ rep: 1, mat: { color: PAL.bark } }), PROP_CAP.trees);

  //  A tree used to be one blob on a stick. It is now three lumps: a broad
  //  skirt, the main mass, and a smaller crown set off to one side, each a
  //  different value of the same leaf colour. It costs two more draw calls for
  //  the entire forest — instancing does not care how many trees there are,
  //  only how many kinds of part — and it is the difference between a lollipop
  //  and something that grew.
  function canopyLayer(){
    const im = new THREE.InstancedMesh(whiteColors(new THREE.IcosahedronGeometry(1, 0)),
      clayMat({ rep: 1, mat: { vertexColors: true } }), PROP_CAP.trees);
    im.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(PROP_CAP.trees * 3), 3);
    return im;
  }
  S.canopy  = canopyLayer();
  S.canopyB = canopyLayer();
  S.canopyC = canopyLayer();

  //  Boughs: one fork crossing the trunk, so the silhouette has an elbow in it
  //  where the canopy meets the stem instead of a clean butt joint.
  const boughGeo = new THREE.CylinderGeometry(0.055, 0.10, 1, 4, 1);
  boughGeo.translate(0, 0.5, 0);
  S.boughs = new THREE.InstancedMesh(boughGeo,
    clayMat({ rep: 1, mat: { color: PAL.bark } }), PROP_CAP.trees);

  S.rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
    clayMat({ rep: 1, mat: { color: PAL.boulder } }), PROP_CAP.rocks);

  //  A moss cap sitting on the weather side of every boulder. Flattened, a
  //  shade under the boulder so it never floats off it, and tinted per stone
  //  so a field of them is not one colour.
  S.moss = new THREE.InstancedMesh(whiteColors(new THREE.DodecahedronGeometry(1, 0)),
    clayMat({ rep: 1, mat: { vertexColors: true } }), PROP_CAP.rocks);
  S.moss.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(PROP_CAP.rocks * 3), 3);

  S.banks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
    clayMat({ rep: 1, mat: { color: 0xb5733f } }), PROP_CAP.banks);

  S.bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0),
    clayMat({ rep: 1, mat: { color: PAL.bush } }), PROP_CAP.bushes);

  //  Ground cover. Three leaning blades merged into one tuft, instanced in a
  //  ring around the player and re-scattered when they cross a tile. It is the
  //  cheapest detail in the game per unit of effect: at ground level the plain
  //  stops being a painted surface and starts having something growing out of
  //  it. First thing dropped when the frame rate says so.
  {
    const blades = [];
    for (let i = 0; i < 3; i++){
      //  Open-ended: a blade is never seen from its own cap, and the caps
      //  were half the triangles in the entire meadow.
      const bg = new THREE.CylinderGeometry(0.012, 0.075, 1, 3, 1, true);
      bg.translate(0, 0.5, 0);
      const mtx = new THREE.Matrix4().compose(
        new THREE.Vector3((i - 1) * 0.06, 0, (i % 2 ? 0.05 : -0.05)),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler((i - 1) * 0.30, i * 2.1, (1 - i) * 0.26)),
        new THREE.Vector3(1, 0.8 + i * 0.22, 1));
      bg.applyMatrix4(mtx);
      blades.push({ g: bg, m: new THREE.Matrix4(), c: new THREE.Color(0xffffff) });
    }
    S.grass = new THREE.InstancedMesh(whiteColors(mergeParts(blades)),
      clayMat({ rep: 1, mat: { vertexColors: true } }), GRASS_CAP);
    S.grass.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(GRASS_CAP * 3), 3);
    S.grass.castShadow = false;      // a shadow per blade is not worth one frame
    S.grass.receiveShadow = true;
  }

  for (const m of [S.trunks, S.boughs, S.canopy, S.canopyB, S.canopyC,
                   S.rocks, S.moss, S.banks, S.bushes, S.grass]){
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = true; m.receiveShadow = true;
    S.world.add(m);
  }
  propsDirty = true;
}

const PROP_CAP = { trees: 2400, rocks: 1400, banks: 800, bushes: 1400 };
const GRASS_CAP = 3600;      // tufts in the ring around the player
const GRASS_R   = 22;        // metres out it reaches

//  Tile offsets inside the window, nearest first. If a dense forest overruns
//  the instance cap, what gets dropped has to be the far side of the window
//  and not whatever a row-major scan reached last.
const WINDOW_OFFSETS = (() => {
  const out = [];
  for (let j = -LOAD_R; j <= LOAD_R; j++){
    for (let i = -LOAD_R; i <= LOAD_R; i++){
      const d = Math.hypot(i, j);
      if (d <= LOAD_R + 0.5) out.push({ i, j, d });
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out;
})();
let propBuckets = new Map();
let propsDirty = false;

//  Fill the instance buffers from whatever is inside the streaming window.
const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion();
const _WHITE = new THREE.Color(0xffffff), _MOSS_ALT = new THREE.Color(0x6b8636);
const _LICHEN = new THREE.Color(0xa8ad96);
const _pv = new THREE.Vector3(), _ps = new THREE.Vector3();

function refreshPropWindow(pi, pj){
  if (!S.trunks) return;
  if (pi === undefined){ pi = tileOf(Pl.pos.x); pj = tileOf(Pl.pos.z); }
  propsDirty = false;

  let nt = 0, nr = 0, nb = 0, nu = 0;
  const cc = S.canopy.instanceColor;

  for (const off of WINDOW_OFFSETS){
    {
      const i = pi + off.i, j = pj + off.j;
      const b = propBuckets.get(tkey(i, j));
      if (!b) continue;

      for (const t of b.trees){
        if (!t.alive || nt >= PROP_CAP.trees) continue;
        const hgt = 2.6 * t.s;
        //  rot is the only per-tree number stored, so every asymmetry below is
        //  driven off it — same tree, same shape, every time it streams in.
        const wob = Math.sin(t.rot * 3.1), wob2 = Math.cos(t.rot * 2.3);
        _pq.setFromEuler(new THREE.Euler(0, t.rot, 0));
        _pv.set(t.x, t.y, t.z); _ps.set(t.s, hgt, t.s);
        _pm.compose(_pv, _pq, _ps); S.trunks.setMatrixAt(nt, _pm);

        //  One bough, leaning out of the trunk under the canopy.
        _pq.setFromEuler(new THREE.Euler(wob * 0.5, t.rot * 1.7, 0.75 * (wob2 < 0 ? -1 : 1)));
        _pv.set(t.x, t.y + hgt * 0.62, t.z);
        _ps.set(t.s, 0.95 * t.s, t.s);
        _pm.compose(_pv, _pq, _ps); S.boughs.setMatrixAt(nt, _pm);

        //  Main mass.
        _pv.set(t.x, t.y + hgt + 0.52 * t.s, t.z);
        _ps.set(1.30 * t.s, 1.12 * t.s, 1.30 * t.s);
        _pq.setFromEuler(new THREE.Euler(t.rot * 0.7, t.rot, t.rot * 0.4));
        _pm.compose(_pv, _pq, _ps); S.canopy.setMatrixAt(nt, _pm);
        _c.setHex(t.leaf); cc.setXYZ(nt, _c.r, _c.g, _c.b);

        //  Skirt: wider, flatter, sitting lower, and darker — this is what
        //  gives the canopy an underside instead of a horizon line.
        _pv.set(t.x + wob * 0.16 * t.s, t.y + hgt + 0.10 * t.s, t.z + wob2 * 0.16 * t.s);
        _ps.set(1.50 * t.s, 0.66 * t.s, 1.46 * t.s);
        _pq.setFromEuler(new THREE.Euler(t.rot * 0.3, -t.rot * 1.4, t.rot * 0.2));
        _pm.compose(_pv, _pq, _ps); S.canopyB.setMatrixAt(nt, _pm);
        _c.setHex(t.leaf).multiplyScalar(0.66);
        S.canopyB.instanceColor.setXYZ(nt, _c.r, _c.g, _c.b);

        //  Crown: small, high, off to one side, and lit — the light side of
        //  the tree, which is what stops it reading as a flat cut-out.
        _pv.set(t.x + wob2 * 0.42 * t.s, t.y + hgt + 1.26 * t.s, t.z - wob * 0.42 * t.s);
        _ps.set(0.86 * t.s, 0.82 * t.s, 0.86 * t.s);
        _pq.setFromEuler(new THREE.Euler(-t.rot * 0.5, t.rot * 2.2, t.rot * 0.6));
        _pm.compose(_pv, _pq, _ps); S.canopyC.setMatrixAt(nt, _pm);
        _c.setHex(t.leaf).lerp(_WHITE, 0.26);
        S.canopyC.instanceColor.setXYZ(nt, _c.r, _c.g, _c.b);
        nt++;
      }
      for (const r of b.rocks){
        if (!r.alive || nr >= PROP_CAP.rocks) continue;
        _pq.setFromEuler(new THREE.Euler(r.rot * 0.5, r.rot, r.rot * 0.3));
        _pv.set(r.x, r.y + r.s * 0.4, r.z);
        _ps.set(r.s, r.s * 0.78, r.s * 1.1);
        _pm.compose(_pv, _pq, _ps); S.rocks.setMatrixAt(nr, _pm);
        //  Moss, pressed onto the top and slid off-centre so it reads as
        //  having grown on one side rather than been painted on.
        const mw = Math.sin(r.rot * 2.7), mw2 = Math.cos(r.rot * 1.9);
        _pq.setFromEuler(new THREE.Euler(r.rot * 0.5 + 0.12, r.rot * 1.3, r.rot * 0.3));
        _pv.set(r.x + mw * r.s * 0.16, r.y + r.s * 0.66, r.z + mw2 * r.s * 0.16);
        _ps.set(r.s * 0.86, r.s * 0.30, r.s * 0.94);
        _pm.compose(_pv, _pq, _ps); S.moss.setMatrixAt(nr, _pm);
        //  Moss is a lowland thing. Above the scree line the same cap is
        //  tinted to pale lichen instead, so the snowfields do not sprout a
        //  green rash.
        const high = clamp((r.y - 30) / 14, 0, 1);
        _c.setHex(0x51702f).lerp(_MOSS_ALT, (mw + 1) * 0.5).lerp(_LICHEN, high);
        S.moss.instanceColor.setXYZ(nr, _c.r, _c.g, _c.b);
        nr++;
      }
      for (const k of b.banks){
        if (!k.alive || nb >= PROP_CAP.banks) continue;
        _pq.setFromEuler(new THREE.Euler(0.25, k.rot, 0.15));
        _pv.set(k.x, k.y + k.s * 0.18, k.z);
        _ps.set(k.s * 1.5, k.s * 0.5, k.s * 1.3);
        _pm.compose(_pv, _pq, _ps); S.banks.setMatrixAt(nb++, _pm);
      }
      for (const u of b.bushes){
        if (!u.alive || nu >= PROP_CAP.bushes) continue;
        _pq.setFromEuler(new THREE.Euler(u.rot * 0.4, u.rot, 0));
        _pv.set(u.x, u.y + u.s * 0.35, u.z);
        _ps.set(u.s * 1.1, u.s * 0.7, u.s * 1.1);
        _pm.compose(_pv, _pq, _ps); S.bushes.setMatrixAt(nu++, _pm);
      }
    }
  }

  S.trunks.count = nt; S.boughs.count = nt;
  S.canopy.count = nt; S.canopyB.count = nt; S.canopyC.count = nt;
  S.rocks.count = nr; S.moss.count = nr;
  S.banks.count = nb; S.bushes.count = nu;
  S.trunks.instanceMatrix.needsUpdate = true;
  S.boughs.instanceMatrix.needsUpdate = true;
  for (const cl of [S.canopy, S.canopyB, S.canopyC]){
    cl.instanceMatrix.needsUpdate = true;
    cl.instanceColor.needsUpdate = true;
  }
  S.moss.instanceMatrix.needsUpdate = true;
  S.moss.instanceColor.needsUpdate = true;
  S.rocks.instanceMatrix.needsUpdate = true;
  S.banks.instanceMatrix.needsUpdate = true;
  S.bushes.instanceMatrix.needsUpdate = true;
  scatterGrass();
}

//  Tufts are placed on a jittered lattice around the player rather than at
//  random, because random scatter clumps and leaves bald patches, and because a
//  lattice keyed to world position puts the same tuft in the same place every
//  time the ring is rebuilt — so walking back and forth does not make the
//  meadow crawl.
let grassAt = null;
function scatterGrass(){
  if (!S.grass) return;
  const px = Pl.pos.x, pz = Pl.pos.z;
  grassAt = { x: px, z: pz };
  const STEP = 0.72;
  const i0 = Math.floor((px - GRASS_R) / STEP), i1 = Math.ceil((px + GRASS_R) / STEP);
  const j0 = Math.floor((pz - GRASS_R) / STEP), j1 = Math.ceil((pz + GRASS_R) / STEP);
  const gc = S.grass.instanceColor;
  let n = 0;
  for (let j = j0; j <= j1 && n < GRASS_CAP; j++){
    for (let i = i0; i <= i1 && n < GRASS_CAP; i++){
      //  One hash per lattice point drives position, height, lean and tone.
      const h1 = ((Math.imul(i, 374761393) ^ Math.imul(j, 668265263)) >>> 0) / 4294967296;
      const h2 = ((Math.imul(i ^ 0x9e37, 2246822519) ^ Math.imul(j, 3266489917)) >>> 0) / 4294967296;
      if (h1 > 0.80) continue;                        // thinned, so it is not a lawn
      const x = i * STEP + (h1 - 0.5) * STEP * 0.9;
      const z = j * STEP + (h2 - 0.5) * STEP * 0.9;
      const dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz > GRASS_R * GRASS_R) continue;
      if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2) continue;
      const gy = groundY(x, z);
      if (gy < WATER_Y + 0.6 || gy > 15.5) continue;  // not on sand, rock or snow
      if (slopeAt(x, z) > 0.62) continue;             // not on a cliff face
      const s2 = 0.15 + h2 * 0.17;
      _pq.setFromEuler(new THREE.Euler((h2 - 0.5) * 0.34, h1 * 6.283, (h1 - 0.5) * 0.34));
      _pv.set(x, gy - 0.04, z);
      _ps.set(1.15 + h1 * 0.7, s2, 1.15 + h2 * 0.7);
      _pm.compose(_pv, _pq, _ps); S.grass.setMatrixAt(n, _pm);
      _c.setHex(PAL.grass[Math.floor(h1 * 3) % 3]).multiplyScalar(1.02 + h2 * 0.30);
      gc.setXYZ(n, _c.r, _c.g, _c.b);
      n++;
    }
  }
  S.grass.count = n;
  S.grass.instanceMatrix.needsUpdate = true;
  gc.needsUpdate = true;
}

function killTree(t){ t.alive = false; propsDirty = true; }
function killRock(r){ r.alive = false; propsDirty = true; }
function killBank(b){ b.alive = false; propsDirty = true; }
function killNode(n){
  n.alive = false;
  propsDirty = true;
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

  //  The home Kiln, same treatment.
  settlements[0].solids = [{ x: 0, y: BASE_Y + 4.4, z: 0, r: 6.4 }];

  shadowize(grp);
  S.world.add(grp);
  S.base = grp;
}

// ─── 11 · Player puppet ──────────────────────────────────────────────────────
//  Rounded human anatomy with shoulder, elbow, hip and knee pivots.
//  Keeps the existing player and equipment contracts; no save migration.

function makePlayer(){
  const g = new THREE.Group();
  g.name = 'resident-human';
  // Smooth normals on the resident, while retaining the world's clay texture.
  const material = color => clayMat({rep:1,mat:{color,flatShading:false}});
  const skin=material(0xc99270), cloth=material(0x3f6f8f), trousers=material(0x35424b);
  const leather=material(0x503a2e), hairMat=material(0x2b201d), dark=material(0x27262b);
  const linen=material(0xd5ccbb), eyeWhite=material(0xc9bfa9), iris=material(0x44382d);
  const metal=()=>material(0xbcbab1);
  // Radii, not box dimensions: every body part has an organic silhouette.
  const oval=(parent,name,rx,ry,rz,x,y,z,mat)=>{
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),mat);
    mesh.name=name;mesh.scale.set(rx,ry,rz);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  const pivot=(parent,name,x,y,z)=>{
    const part=new THREE.Group();part.name=name;part.position.set(x,y,z);parent.add(part);return part;
  };
  const tube=(parent,name,top,bottom,length,x,y,z,mat)=>{
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,length,20),mat);
    mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  // Jacket shaped from hips through waist, ribcage and sloping shoulders.
  const profile=[[-.35,.22],[-.29,.245],[-.16,.215],[.02,.26],[.19,.295],[.27,.27],[.33,.145],[.35,.115]];
  const torso=new THREE.Mesh(new THREE.LatheGeometry(profile.map(([y,r])=>new THREE.Vector2(r,y)),32),cloth);
  torso.name='tapered-jacket';torso.scale.z=.63;torso.position.y=1.34;g.add(torso);
  oval(g,'pelvis',.24,.145,.155,0,1.005,0,trousers);
  tube(g,'neck',.08,.095,.16,0,1.745,0,skin);
  // A seven-head adult proportion, with a narrower jaw and projecting face.
  const head=oval(g,'head',.145,.19,.151,0,1.938,0,skin);
  // Face attachments use a separate unscaled pivot; head rotation drives both.
  const face=pivot(g,'face',0,1.938,0);
  oval(face,'jaw',.111,.094,.117,0,-.111,.012,skin);
  oval(face,'chin',.069,.034,.045,0,-.160,.069,skin);
  for(const side of [-1,1]){
    oval(face,'ear',.032,.052,.026,side*.146,-.017,0,skin);
    oval(face,'cheek',.063,.058,.032,side*.068,-.040,.097,skin);
    oval(face,'eye-socket',.042,.025,.020,side*.058,.031,.133,skin);
    oval(face,'eye',.022,.009,.008,side*.058,.026,.147,eyeWhite);
    oval(face,'iris',.008,.008,.004,side*.058,.026,.154,iris);
    oval(face,'pupil',.004,.005,.002,side*.058,.026,.158,dark);
    const brow=oval(face,'brow',.037,.007,.009,side*.06,.060,.149,hairMat);
    brow.rotation.z=-side*.10;
  }
  oval(face,'nose-bridge',.019,.049,.027,0,-.005,.15,skin);
  oval(face,'nose-tip',.026,.02,.031,0,-.039,.17,skin);
  oval(face,'upper-lip',.040,.006,.010,0,-.094,.130,material(0x906452));
  oval(face,'lower-lip',.036,.007,.012,0,-.105,.130,material(0xb77e64));
  // Cropped hair cap, open below the hairline; no rectangular fringe.
  const hair=new THREE.Mesh(new THREE.SphereGeometry(1,28,18,0,Math.PI*2,0,1.10),hairMat);
  hair.name='hair-cap';hair.scale.set(.155,.20,.16);hair.position.set(0,.016,-.011);face.add(hair);
  const swept=oval(face,'swept-hair',.123,.035,.117,.025,.183,.005,hairMat);swept.rotation.z=-.16;

  const armL=pivot(g,'left-shoulder',-.322,1.635,0);
  const armR=pivot(g,'right-shoulder',.322,1.635,0);
  const elbows=[];
  for(const [arm,side] of [[armL,-1],[armR,1]]){
    oval(arm,'sleeve',.106,.207,.109,0,-.143,0,cloth);
    const elbow=pivot(arm,'elbow',0,-.335,0);elbows.push(elbow);
    oval(elbow,'elbow-joint',.073,.077,.075,0,0,0,skin);
    oval(elbow,'forearm',.068,.176,.072,0,-.153,.009,skin);
    tube(elbow,'wrist-wrap',.061,.054,.073,0,-.30,.011,linen);
    oval(elbow,'palm',.058,.083,.033,0,-.38,.016,skin);
    // Four softly separated fingers and a thumb; readable even at rest.
    for(let i=0;i<4;i++)oval(elbow,'finger',.012,.044-(Math.abs(i-1.5)*.006),.014,(i-1.5)*.025,-.450,.021,skin);
    const thumb=oval(elbow,'thumb',.020,.044,.022,-side*.061,-.38,.028,skin);thumb.rotation.z=side*.40;
  }
  const legL=pivot(g,'left-hip',-.139,1.00,0),legR=pivot(g,'right-hip',.139,1.00,0);
  const knees=[];
  for(const leg of [legL,legR]){
    oval(leg,'thigh',.12,.273,.12,0,-.205,0,trousers);
    const knee=pivot(leg,'knee',0,-.445,0);knees.push(knee);
    oval(knee,'kneecap',.092,.082,.100,0,-.007,.012,trousers);
    oval(knee,'calf',.087,.225,.09,0,-.19,-.012,trousers);
    tube(knee,'boot-shaft',.088,.068,.19,0,-.33,0,leather);
    oval(knee,'boot',.092,.077,.176,0,-.465,.066,leather);
    oval(knee,'sole',.096,.028,.18,0,-.503,.066,dark);
  }
  // Belt and short collar follow the curved body instead of boxing it in.
  const belt=tube(g,'belt',.232,.236,.064,0,1.045,0,leather);belt.scale.z=.67;
  oval(g,'buckle',.036,.024,.012,0,1.045,.165,material(0xb99c62));
  for(const side of [-1,1]){
    const collar=oval(g,'collar',.080,.023,.080,side*.067,1.683,.029,linen);collar.rotation.z=side*.22;
  }
  oval(g,'belt-pouch',.071,.105,.043,-.225,1.015,.105,leather);

  // Equipment keeps the existing slots, but follows the head and lower legs.
  const helm=new THREE.Mesh(new THREE.SphereGeometry(1,24,16,0,Math.PI*2,0,1.7),metal());
  helm.name='rounded-helmet';helm.scale.set(.177,.211,.177);helm.position.set(0,.018,0);helm.visible=false;face.add(helm);
  const plate=oval(g,'shaped-breastplate',.29,.28,.19,0,1.40,.01,metal());plate.visible=false;
  const greave=oval(knees[0],'left-greave',.098,.18,.054,0,-.24,.083,metal());greave.visible=false;
  const greave2=oval(knees[1],'right-greave',.098,.18,.054,0,-.24,.083,metal());greave2.visible=false;
  const weaponPivot=pivot(g,'weapon-pivot',.322,1.635,0);
  shadowize(g);
  Pl.group=g;
  Pl.parts={torso,head,face,hair,armL,armR,legL,legR,elbowL:elbows[0],elbowR:elbows[1],
    kneeL:knees[0],kneeR:knees[1],helm,plate,greave,greave2,weaponPivot,weapon:null};
  S.world.add(g);
  refreshWeaponMesh();
}

function refreshWeaponMesh(){
  const p = Pl.parts;
  if (p.weapon){ p.weaponPivot.remove(p.weapon); disposeTree(p.weapon); p.weapon = null; }
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
    im.castShadow = !m.light; im.receiveShadow = true;
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

//  Loot used to build a geometry, a material AND a live PointLight per drop.
//  Twenty pieces on the grass after a bad night is twenty point lights in the
//  shader on top of the hearth, the towns, the lanterns and the torch, and
//  twenty geometries the pickup never gave back.
const DROP_GEO = {};
const DROP_MAT = {};
function dropAssets(kind, rarity){
  if (!DROP_GEO.weapon){
    DROP_GEO.weapon = markShared(new THREE.OctahedronGeometry(0.34, 0));
    DROP_GEO.armour = markShared(new THREE.BoxGeometry(0.52, 0.52, 0.52));
  }
  const key = rarity;
  if (!DROP_MAT[key]){
    const r = RARITY.find(x => x.key === rarity) || RARITY[0];
    DROP_MAT[key] = markShared(new THREE.MeshBasicMaterial({ color: r.hex }));
  }
  return { geo: DROP_GEO[kind === 'weapon' ? 'weapon' : 'armour'], mat: DROP_MAT[key] };
}

//  Four halos, handed to whichever drops are nearest, the same way the
//  lanterns are lit.
function refreshDropLights(){
  if (!S.dropLights){
    S.dropLights = [];
    for (let i = 0; i < 4; i++){
      const l = new THREE.PointLight(0xffffff, 0, 7, 2);
      l.visible = false;
      S.world.add(l);
      S.dropLights.push(l);
    }
  }
  const near = drops.slice().sort((a, c) =>
    a.mesh.position.distanceToSquared(Pl.pos) - c.mesh.position.distanceToSquared(Pl.pos));
  S.dropLights.forEach((l, i) => {
    const d = near[i];
    if (!d || d.mesh.position.distanceTo(Pl.pos) > 26){ l.visible = false; return; }
    l.visible = true;
    l.color.setHex(d.hex);
    l.intensity = 1.4 + Math.sin(St.step * 5 + i) * 0.5;
    l.position.copy(d.mesh.position);
  });
}

function dropLoot(x, y, z, tier){
  const rnd = Math.random;
  //  Every single one of them leaves something. That is the deal the game
  //  makes with the player on the first night, and it never breaks it.
  const lift = (St.day - 1) * 0.09 + (tier - 1) * 0.5;
  const it = rollItem(rnd, lift);
  const rar = RARITY.find(r => r.key === it.rarity) || RARITY[0];
  const A = dropAssets(it.kind, it.rarity);
  const mesh = new THREE.Mesh(A.geo, A.mat);
  mesh.position.set(x, y + 0.9, z);
  S.world.add(mesh);
  drops.push({ it, mesh, hex: rar.hex, t: 0 });
  refreshDropLights();
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

// ─── 36 · THE DEAD — bodies instead of boxes ────────────────────────────────
//  What was here: a torso box, a head box, two eye dots, two arm boxes, two
//  leg boxes. Symmetrical, upright, evenly proportioned. It read as a robot,
//  or as nothing. None of the five types were distinguishable at ten metres.
//
//  What makes a shape read as undead, in rough order of how much it buys:
//
//    1 · posture. Upright is alive. Everything here leans, and leans WRONG:
//        spine pitched forward, head hung off the end of it, shoulders at
//        different heights.
//    2 · asymmetry. One arm longer, one leg stiff, a limp in the walk. A
//        mirror-symmetric walk cycle is the single loudest tell of a rig.
//    3 · gauntness with bulk in the wrong places. Ribs showing over a hollow
//        middle, and then a shoulder swollen out of proportion.
//    4 · the face. A dark recess with a light in it, and a jaw that hangs.
//    5 · rags. Things that hang off a silhouette and move a beat behind it.
//
//  All five types are built from the same armature with different numbers, so
//  a husk and a lumberer are recognisably the same kind of wrong.

const GEO_CACHE = new Map();
function boxGeo(w, h, d){
  const k = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3);
  let g = GEO_CACHE.get(k);
  if (!g){ g = markShared(new THREE.BoxGeometry(w, h, d)); GEO_CACHE.set(k, g); }
  return g;
}

//  A limb is a group pivoted at its top with the mesh hung below, so rotating
//  the group swings from the shoulder or the hip instead of the middle. The
//  old code baked the offset into the geometry, which is why every limb needed
//  its own copy of it.
function limb(w, h, d, mat, cast){
  const g = new THREE.Group();
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.y = -h / 2;
  m.castShadow = cast !== false; m.receiveShadow = true;
  g.add(m);
  g.userData.len = h;
  return g;
}

function slab(w, h, d, mat, x, y, z, rx, ry, rz){
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.rotation.set(rx || 0, ry || 0, rz || 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

//  Proportions per kind. One armature, five sets of numbers.
const BODY = {
  husk:    { scale:1.00, lean:0.40, neck:0.26, armL:1.32, armR:1.10, skull:0.86,
             chest:[0.50,0.72,0.27], hip:[0.42,0.26,0.26], ribs:5, rags:5,
             headTilt:0.15, jaw:0.20, shoulderSwell:1.30, gait:1.00, drag:0.55 },
  stalker: { scale:0.90, lean:1.05, neck:0.40, armL:1.52, armR:1.44, skull:0.80,
             chest:[0.42,0.56,0.32], hip:[0.36,0.22,0.26], ribs:6, rags:3,
             headTilt:-0.40, jaw:0.34, shoulderSwell:1.00, gait:1.90, drag:0.15 },
  lumber:  { scale:1.55, lean:0.26, neck:0.08, armL:1.62, armR:1.66, skull:0.70,
             chest:[0.80,0.84,0.50], hip:[0.60,0.32,0.42], ribs:4, rags:4,
             headTilt:0.22, jaw:0.12, shoulderSwell:1.90, gait:0.62, drag:0.80 },
  wisp:    { scale:0.92, lean:0.16, neck:0.40, armL:1.42, armR:1.34, skull:0.78,
             chest:[0.34,0.58,0.22], hip:[0.26,0.14,0.20], ribs:7, rags:10,
             headTilt:-0.18, jaw:0.40, shoulderSwell:0.80, gait:0.80, drag:0 },
  molder:  { scale:1.95, lean:0.34, neck:0.14, armL:1.74, armR:1.60, skull:0.78,
             chest:[0.88,0.94,0.54], hip:[0.66,0.36,0.44], ribs:5, rags:6,
             headTilt:0.13, jaw:0.30, shoulderSwell:2.00, gait:0.52, drag:0.70 },
  //  No legs, a long shroud instead, and almost no bone showing: the whole
  //  point of the thing is that there is not much of it.
  wraith:  { scale:1.05, lean:0.06, neck:0.44, armL:1.62, armR:1.50, skull:0.82,
             chest:[0.38,0.62,0.22], hip:[0.28,0.16,0.20], ribs:4, rags:12,
             headTilt:-0.10, jaw:0.44, shoulderSwell:0.70, gait:0.55, drag:0,
             legless:true },
  //  Pitched forward onto enormous arms, with a muzzle instead of a skull.
  wolf:    { scale:1.18, lean:1.15, neck:0.30, armL:1.50, armR:1.46, skull:0.92,
             chest:[0.66,0.70,0.50], hip:[0.50,0.30,0.36], ribs:4, rags:2,
             headTilt:-0.55, jaw:0.30, shoulderSwell:1.70, gait:2.10, drag:0.05,
             beast:true },
};

//  Each body was 49 draw calls: thirty-odd little boxes, each its own mesh and
//  its own material. Sixteen of them on screen cost 992 calls against 204 for
//  the entire rest of the world. So every part that never moves relative to
//  its bone is merged into that bone, with the colour baked per vertex and one
//  clay material for the whole body. Ten calls a corpse instead of forty-nine.

function partList(){
  const L = [];
  L.box = function(w, h, d, x, y, z, rx, ry, rz, hex){
    _me.set(rx || 0, ry || 0, rz || 0); _mq.setFromEuler(_me);
    _mm.compose(new THREE.Vector3(x || 0, y || 0, z || 0), _mq, new THREE.Vector3(1, 1, 1));
    L.push({ g: boxGeo(w, h, d), m: _mm.clone(), c: new THREE.Color(hex) });
    return L;
  };
  return L;
}

//  One bone: a group at the joint, with everything on it merged into a single
//  mesh. Rotating the group swings the whole limb from its top.
function bone(parts, mat, parent, x, y, z){
  const g = new THREE.Group();
  g.position.set(x || 0, y || 0, z || 0);
  const mesh = new THREE.Mesh(mergeParts(parts), mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);
  if (parent) parent.add(g);
  return g;
}

const BONE_HEX = 0xcfc4ae;

function makeMob(kind, x, z, over){
  //  `over` is how a boss is made: the same armature and the same code path,
  //  with its own numbers laid over the kind's. Copied rather than mutated,
  //  because MOBS[kind] is shared by every ordinary corpse on the field.
  const def = over ? Object.assign({}, MOBS[kind], over.def) : MOBS[kind];
  const B = over && over.B ? Object.assign({}, BODY[kind] || BODY.husk, over.B)
                           : (BODY[kind] || BODY.husk);
  const S0 = B.scale;
  //  Two things have no legs and trail a shroud where they should be: the
  //  emberwisp and the wraith. One flag, so the armature does not have to
  //  know which is which.
  const wisp = kind === 'wisp' || !!B.legless;
  const big = kind === 'lumber' || kind === 'molder';

  //  One clay material for the whole body, tinted per vertex. The hurt flash
  //  writes emissive to this and the body flashes as one thing.
  const skin = clayMat({ rep: 1, mat: { vertexColors: true } });
  //  A ghost is drawn half there. depthWrite stays on so the body does not
  //  turn into a pile of overlapping panes from the inside; the effect wanted
  //  is moonlight coming through a shape, not an x-ray.
  if (def.ghost){
    skin.transparent = true; skin.opacity = 0.46;
    skin.emissive = new THREE.Color(0x1a2a38);
  }
  const glow = new THREE.MeshBasicMaterial({ color: def.eye });
  //  The eyes can be as hot as they like — they are two specks under a brow.
  //  The chest seam is a hand-sized panel, and at full strength in daylight it
  //  stops reading as light coming out of a body and starts reading as pink
  //  paint. Its own material, banked toward the flesh, and lit back up at
  //  night by poseMob where it belongs.
  const emberBase = new THREE.Color(def.eye).lerp(new THREE.Color(def.col), 0.62);
  const ember = new THREE.MeshBasicMaterial({ color: emberBase.clone() });

  //  Six tones off one flesh colour. Everything that reads as "dead" on these
  //  bodies is a value relationship, not a hue: bone is the lightest thing on
  //  the model, the sockets and the open belly are the darkest, and the bruise
  //  is the only saturated note apart from the light inside them.
  const _f = new THREE.Color(def.col);
  const C_BODY   = def.col;
  const C_PALE   = _f.clone().lerp(new THREE.Color(0xe8e2cf), 0.28).getHex();
  const C_ROT    = _f.clone().lerp(new THREE.Color(0x2e2119), 0.50).getHex();
  const C_DEEP   = _f.clone().lerp(new THREE.Color(0x0d0b10), 0.80).getHex();
  const C_BRUISE = _f.clone().lerp(new THREE.Color(def.bruise || 0x5e3f5a), 0.72).getHex();
  const C_CLOTH  = new THREE.Color(0x4b4438).lerp(_f, 0.18)
                     .lerp(new THREE.Color(0x14121a), 0.30).getHex();

  //  A per-corpse scatter, seeded off where it stood up, so two husks in the
  //  same wave are not the same husk twice.
  const rnd = mulberry(hashStr(kind + x.toFixed(1) + z.toFixed(1)));
  const jit = (a) => (rnd() - 0.5) * 2 * a;

  const g = new THREE.Group();

  // ── hips: pelvis, a hip bone standing proud on one side, a torn waistband ──
  const hipP = partList();
  const hw = B.hip[0] * S0, hh = B.hip[1] * S0, hd2 = B.hip[2] * S0;
  hipP.box(hw, hh, hd2, 0, 0, 0, 0, 0, 0, C_CLOTH);
  hipP.box(hw * 1.04, hh * 0.30, hd2 * 1.04, 0, hh * 0.42, 0, 0, 0, 0, C_ROT);
  //  One iliac crest showing through the skin. Only one — symmetry is what
  //  makes a body read as manufactured.
  hipP.box(hw * 0.26, hh * 0.46, hd2 * 0.30,
           -hw * 0.40, hh * 0.30, hd2 * 0.18, 0, 0, -0.20, BONE_HEX);
  //  Tail. Four tapering segments curling up and away, added before the hip
  //  bone is merged so it rides the hips and sways with them.
  if (B.beast){
    for (let i = 0; i < 4; i++){
      hipP.box((0.13 - i * 0.022) * S0, (0.13 - i * 0.02) * S0, 0.30 * S0,
               0, hh * 0.34 + i * 0.06 * S0,
               -hd2 * 0.50 - (0.16 + i * 0.26) * S0,
               -0.40 + i * 0.26, 0, 0, i % 2 ? C_ROT : C_BODY);
    }
  }
  const hips = bone(hipP, skin, g, 0, def.h * 0.52 * (wisp ? 1.25 : 1), 0);

  // ── spine ────────────────────────────────────────────────────────────────
  //  Not a box. A wide, hunched upper chest over a wasted waist, so the
  //  silhouette narrows where a living one would not, with the cage standing
  //  over a hollow and the backbone showing through from behind.
  const sp = partList();
  const cw = B.chest[0] * S0, chh = B.chest[1] * S0, cd = B.chest[2] * S0;
  const waistW = cw * 0.66, waistH = chh * 0.34;

  //  Wasted waist first, so the cage sits on top of something thinner.
  sp.box(waistW, waistH, cd * 0.82, 0, waistH * 0.48, 0, 0, 0, 0, C_ROT);
  //  Upper chest, canted so one shoulder carries lower than the other.
  sp.box(cw, chh * 0.74, cd, 0, chh * 0.62, 0, 0, 0, 0.035, C_BODY);
  //  The hump: a corpse walks with its back rounded over. This is the single
  //  biggest posture cue at distance, more than the head or the arms.
  sp.box(cw * 0.86, chh * 0.42, cd * 0.50,
         0, chh * 0.82, -cd * 0.46, 0.22, 0, 0, C_ROT);
  //  Shoulder blades, one lifted.
  sp.box(cw * 0.30, chh * 0.34, 0.045 * S0, -cw * 0.26, chh * 0.70, -cd * 0.52, 0, 0, 0.14, C_PALE);
  sp.box(cw * 0.26, chh * 0.28, 0.04 * S0,   cw * 0.27, chh * 0.62, -cd * 0.52, 0, 0, -0.10, C_PALE);
  //  Backbone: knuckles of it up the spine, catching the rim light.
  for (let i = 0; i < 5; i++){
    sp.box(0.055 * S0, 0.05 * S0, 0.05 * S0, 0,
           chh * (0.34 + i * 0.15), -cd * 0.50 - 0.01 * S0, 0, 0, 0, BONE_HEX);
  }

  //  The hollow the ribs stand over — a dark plate recessed into the front, so
  //  the cage has a void behind it instead of sitting on solid chest.
  sp.box(cw * 0.74, chh * 0.40, 0.03, 0, chh * 0.44, cd * 0.5 - 0.008, 0, 0, 0, C_DEEP);
  //  The cage. Each rib narrows and drops as it goes down, and alternate ribs
  //  tilt the other way, which is what stops it reading as a ladder.
  for (let i = 0; i < B.ribs; i++){
    const t = i / Math.max(1, B.ribs - 1);
    const s2 = (i % 2 ? 1 : -1);
    sp.box(cw * (0.92 - t * 0.40), 0.052 * S0, 0.06 * S0,
           s2 * 0.02 * S0, chh * (0.86 - t * 0.44), cd * 0.5 + 0.016,
           0, 0, s2 * (0.07 + t * 0.05), BONE_HEX);
  }
  //  Sternum, and the collarbone ridge across the top of the chest.
  sp.box(0.05 * S0, chh * 0.34, 0.05 * S0, 0, chh * 0.72, cd * 0.5 + 0.02, 0, 0, 0, C_PALE);
  sp.box(cw * 0.88, 0.055 * S0, 0.07 * S0, 0, chh * 1.00, cd * 0.42, 0, 0, 0.06, BONE_HEX);

  //  A wound. Torn-open flesh, with the bruise spreading out around it.
  sp.box(cw * 0.30, chh * 0.24, 0.035, cw * 0.26, chh * 0.60, cd * 0.5 + 0.024,
         0, 0, 0.45, C_DEEP);
  sp.box(cw * 0.42, chh * 0.34, 0.03, cw * 0.24, chh * 0.58, cd * 0.5 + 0.012,
         0, 0, 0.45, C_BRUISE);
  //  Mottling: dead skin does not hold one tone. Three or four patches, each
  //  where the scatter put it, on the front, the flank and the back.
  for (let i = 0; i < 4; i++){
    const face = i % 2;
    const w2 = (0.12 + rnd() * 0.22) * cw, h2 = (0.10 + rnd() * 0.20) * chh;
    if (face === 0){
      sp.box(w2, h2, 0.02, jit(cw * 0.34), chh * (0.30 + rnd() * 0.70), cd * 0.5 + 0.006,
             0, 0, jit(0.5), i < 2 ? C_BRUISE : C_ROT);
    } else {
      sp.box(0.02, h2, w2, (rnd() < 0.5 ? -1 : 1) * cw * 0.5 - 0.004,
             chh * (0.30 + rnd() * 0.70), jit(cd * 0.28), 0, 0, jit(0.4), C_ROT);
    }
  }

  //  Shoulders: one swollen, one fallen away to the bone underneath.
  const shY = chh * 0.96, shX = cw * 0.52;
  sp.box(0.30 * S0 * B.shoulderSwell, 0.28 * S0 * B.shoulderSwell, 0.30 * S0 * B.shoulderSwell,
         -shX, shY, 0, 0, 0, 0, C_BODY);
  sp.box(0.24 * S0, 0.20 * S0, 0.25 * S0, shX, shY * 0.90, 0, 0, 0, 0, C_ROT);
  sp.box(0.11 * S0, 0.26 * S0, 0.11 * S0, -shX, shY + 0.13 * S0, 0, 0, 0, 0.35, BONE_HEX);
  sp.box(0.13 * S0, 0.10 * S0, 0.13 * S0, shX, shY * 0.90 + 0.11 * S0, 0, 0, 0, -0.2, C_PALE);

  const spine = bone(sp, skin, hips, 0, 0, 0);
  spine.rotation.x = B.lean;

  // ── head ─────────────────────────────────────────────────────────────────
  //  Everything here is in service of one thing: a brow that overhangs far
  //  enough to put the eyes in shadow, so the glow reads as coming out of a
  //  hole rather than being painted on the front of a box. The jaw is baked
  //  open rather than hinged — one more bone is one more draw call on every
  //  corpse, and a jaw that just hangs reads the same.
  const sk = B.skull;
  const skullW = 0.30 * S0 * sk, skullH = 0.30 * S0 * sk, skullD = 0.34 * S0 * sk;
  const hd = partList();
  //  Neck: a thin stalk with two vertebrae showing at the back.
  hd.box(0.115 * S0, B.neck * S0, 0.115 * S0, 0, -B.neck * S0 * 0.30, 0, 0, 0, 0, C_ROT);
  hd.box(0.06 * S0, 0.05 * S0, 0.05 * S0, 0, -B.neck * S0 * 0.16, -0.06 * S0, 0, 0, 0, BONE_HEX);
  hd.box(0.06 * S0, 0.05 * S0, 0.05 * S0, 0, -B.neck * S0 * 0.48, -0.055 * S0, 0, 0, 0, BONE_HEX);
  //  Cranium, narrower at the jaw than at the temples.
  hd.box(skullW, skullH * 0.78, skullD, 0, skullH * 0.62, 0, 0, 0, 0, C_BODY);
  hd.box(skullW * 0.84, skullH * 0.30, skullD * 0.88, 0, skullH * 0.26, skullD * 0.04, 0, 0, 0, C_ROT);
  //  Temple hollows, one each side, sunk into the skull.
  for (const sx2 of [-1, 1]){
    hd.box(0.03 * S0, skullH * 0.26, skullD * 0.34,
           sx2 * (skullW * 0.5 - 0.012), skullH * 0.66, skullD * 0.06, 0, 0, 0, C_DEEP);
  }
  //  The face is built front-to-back in three layers and the order matters,
  //  because the first pass had the brow a full 0.15 deep at z=0.46·skullD,
  //  which swallowed the eye lamps whole — at night the head was an empty box.
  //    · the socket, a dark plate just proud of the skull front
  //    · the eye lamps, a shade in front of that
  //    · the brow, further forward again and set higher, so it hangs over
  //      them without covering them
  const faceZ = skullD * 0.50;
  hd.box(skullW * 0.92, 0.16 * S0, 0.03 * S0, 0, skullH * 0.60, faceZ + 0.004, 0, 0, 0, C_DEEP);
  //  Brow: proud of the face by a real distance, and heavy. Sits above the
  //  lamps and juts past them, which is what casts the shadow across them.
  hd.box(skullW * 1.12, 0.080 * S0, 0.075 * S0,
         0, skullH * 0.84, faceZ + 0.022 * S0, -0.16, 0, 0, C_PALE);
  //  A second, smaller lip under the brow on one side only — a heavier
  //  overhang over one eye than the other, which is most of why these read
  //  as faces rather than as dials.
  hd.box(skullW * 0.46, 0.05 * S0, 0.055 * S0,
         -skullW * 0.26, skullH * 0.73, faceZ + 0.026 * S0, -0.3, 0, 0.10, C_BODY);
  //  Cheekbones under the sockets, and hollows under those.
  for (const sx2 of [-1, 1]){
    hd.box(0.08 * S0 * sk, 0.07 * S0, 0.07 * S0,
           sx2 * skullW * 0.34, skullH * 0.48, skullD * 0.46, 0, 0, sx2 * 0.2, C_PALE);
    hd.box(0.10 * S0 * sk, 0.09 * S0, 0.035 * S0,
           sx2 * skullW * 0.30, skullH * 0.36, skullD * 0.50, 0, 0, 0, C_ROT);
  }
  //  Nose gone, leaving the aperture.
  hd.box(0.06 * S0, 0.08 * S0, 0.04 * S0, 0, skullH * 0.46, skullD * 0.51, 0, 0, 0, C_DEEP);
  //  The jaw, hung open and swung a little off true.
  hd.box(skullW * 0.72, 0.13 * S0, skullD * 0.60,
         jit(0.012 * S0), skullH * 0.12, skullD * 0.26, B.jaw, jit(0.12), 0.06, C_ROT);
  hd.box(skullW * 0.56, 0.035 * S0, 0.03 * S0,
         0, skullH * 0.21, skullD * 0.54, B.jaw, 0, 0, BONE_HEX);
  //  Upper teeth, so the open mouth has something in it from above too.
  hd.box(skullW * 0.52, 0.03 * S0, 0.03 * S0,
         0, skullH * 0.32, skullD * 0.50, 0, 0, 0, BONE_HEX);
  //  The crown is broken open on one side, showing the bone under the scalp.
  hd.box(skullW * 0.44, 0.045 * S0, skullD * 0.40,
         skullW * 0.22, skullH * 0.98, -skullD * 0.10, 0.12, 0, 0.16, BONE_HEX);
  //  A werewolf is the same armature with the face pulled out into a muzzle.
  //  Everything below is additive, and it is deliberately big: the snout, the
  //  ears and the ruff are the whole silhouette at the distance you actually
  //  see one, which is briefly, while it is closing.
  if (B.beast){
    const mz = faceZ + skullD * 0.46;
    hd.box(skullW * 0.54, 0.17 * S0, skullD * 1.10, 0, skullH * 0.46, mz, -0.05, 0, 0, C_BODY);
    hd.box(skullW * 0.46, 0.11 * S0, skullD * 0.96, 0, skullH * 0.26, mz - skullD * 0.04,
           B.jaw + 0.22, 0, 0, C_ROT);
    hd.box(skullW * 0.30, 0.10 * S0, 0.10 * S0, 0, skullH * 0.52,
           mz + skullD * 0.52, 0, 0, 0, C_DEEP);
    for (const sx2 of [-1, 1]){
      //  Fangs, top and bottom, long enough to show with the mouth shut.
      hd.box(0.040 * S0, 0.13 * S0, 0.040 * S0, sx2 * skullW * 0.17, skullH * 0.36,
             mz + skullD * 0.16, 0.24, 0, 0, BONE_HEX);
      hd.box(0.034 * S0, 0.10 * S0, 0.034 * S0, sx2 * skullW * 0.17, skullH * 0.24,
             mz + skullD * 0.10, -0.24, 0, 0, BONE_HEX);
      //  Ears, upright, and the left one torn shorter than the right.
      hd.box(0.10 * S0, 0.28 * S0 * (sx2 < 0 ? 1 : 0.74), 0.055 * S0,
             sx2 * skullW * 0.44, skullH * 1.02, -skullD * 0.08, 0.10, 0, sx2 * 0.32, C_BODY);
      hd.box(0.055 * S0, 0.16 * S0 * (sx2 < 0 ? 1 : 0.74), 0.03 * S0,
             sx2 * skullW * 0.44, skullH * 1.00, -skullD * 0.05, 0.10, 0, sx2 * 0.32, C_ROT);
    }
    //  Ruff: a collar of fur at the base of the neck, which is what makes the
    //  head read as sitting low between the shoulders.
    for (let i = 0; i < 8; i++){
      const a2 = (i / 8) * 6.2832;
      hd.box(0.10 * S0, 0.26 * S0, 0.055 * S0,
             Math.cos(a2) * 0.17 * S0, -B.neck * S0 * 0.34, Math.sin(a2) * 0.17 * S0,
             0.34, a2, 0, i % 2 ? C_ROT : C_BODY);
    }
  }
  const neck = bone(hd, skin, spine, 0, chh * 1.02 + B.neck * S0 * 0.4, 0);
  neck.rotation.x = B.headTilt;

  //  Eyes: one small glowing mesh, both sockets in it, sunk back under the
  //  brow rather than sitting on the face.
  const eyeP = partList();
  for (const sx of [-1, 1]){
    //  Uneven: one lamp bigger and lower than the other. A matched pair reads
    //  as a robot's sensors; a mismatched pair reads as something wrong.
    const big2 = sx < 0 ? 1.18 : 0.84;
    eyeP.box(0.070 * S0 * big2, 0.058 * S0 * big2, 0.026 * S0,
             sx * skullW * 0.24, skullH * (sx < 0 ? 0.585 : 0.615),
             faceZ + 0.016 * S0, 0, 0, sx * 0.12, 0xffffff);
  }
  const eyes = new THREE.Mesh(mergeParts(eyeP), glow);
  eyes.castShadow = false; eyes.receiveShadow = false;
  neck.add(eyes);

  // ── arms ─────────────────────────────────────────────────────────────────
  //  One rigid bend baked in rather than an elbow joint: a stiff arm is what a
  //  corpse has. Fingers are worth their triangles — a hand that splays is the
  //  difference between a thing reaching for you and a plank swinging.
  function arm(len, thick, sx){
    const P = partList();
    const up = len * 0.52, fo = len * 0.48;
    P.box(thick, up, thick, 0, -up * 0.5, 0, 0, 0, 0, C_BODY);
    //  Bruising down the upper arm, and the elbow knob at the bend.
    P.box(thick * 1.02, up * 0.32, thick * 0.3,
          0, -up * (0.30 + rnd() * 0.3), thick * 0.5, 0, 0, jit(0.3), C_BRUISE);
    P.box(thick * 1.20, thick * 0.9, thick * 1.20, 0, -up, 0, 0, 0, 0, C_PALE);
    //  Forearm swung forward from the elbow, in geometry.
    const eb = -up, fy = -fo * 0.46, fz = fo * 0.40;
    P.box(thick * 0.82, fo, thick * 0.82, 0, eb + fy, fz * 0.5, -0.72, 0, 0, C_ROT);
    //  The ulna showing through where the flesh has gone off the forearm.
    P.box(thick * 0.26, fo * 0.68, thick * 0.26,
          thick * 0.30, eb + fy, fz * 0.5, -0.72, 0, 0, BONE_HEX);
    //  Hand: a flat palm with four fingers splayed off the end of it, and a
    //  thumb out to the side.
    const hx = 0, hy = eb + fy * 2 + 0.02, hz = fz * 1.05;
    P.box(thick * 1.45, thick * 0.70, thick * 1.30, hx, hy, hz, -0.72, 0, 0, C_ROT);
    for (let f = 0; f < 4; f++){
      const off = (f - 1.5) * thick * 0.36;
      const curl = -0.72 - 0.30 - rnd() * 0.45;
      const fl = thick * (1.5 + rnd() * 0.9);
      P.box(thick * 0.22, thick * 0.22, fl,
            hx + off, hy - thick * 0.30 - fl * 0.24, hz + fl * 0.40,
            curl, jit(0.1), 0, f % 2 ? C_PALE : C_ROT);
    }
    P.box(thick * 0.26, thick * 0.24, thick * 1.1,
          hx - sx * thick * 0.62, hy - thick * 0.1, hz + thick * 0.3, -0.5, sx * 0.5, 0, C_ROT);
    return bone(P, skin, spine, sx * (shX + 0.05 * S0), sx < 0 ? shY : shY * 0.90, 0);
  }
  const armL = arm(B.armL * S0, 0.135 * S0, -1);
  const armR = arm(B.armR * S0, 0.115 * S0, 1);

  // ── legs, one bone each, knee and foot baked in ──────────────────────────
  let legL = null, legR = null;
  function leg(sx){
    const P = partList();
    const th = def.h * 0.25, sh = def.h * 0.25;
    //  Thigh still has trouser on it; the shin does not.
    P.box(0.155 * S0, th, 0.165 * S0, 0, -th * 0.5, 0, 0, 0, 0, C_CLOTH);
    //  Torn hem where the cloth gives out above the knee.
    P.box(0.17 * S0, 0.06 * S0, 0.18 * S0, 0, -th * 0.94, 0, 0, jit(0.2), jit(0.12), C_ROT);
    P.box(0.13 * S0, 0.11 * S0, 0.13 * S0, 0, -th - 0.02, 0.01 * S0, 0, 0, 0, C_PALE);
    P.box(0.115 * S0, sh, 0.125 * S0, 0, -th - sh * 0.5, 0.03 * S0, 0.12, 0, 0, C_BODY);
    //  Shin bone down the front of it — the light catches this on every step.
    P.box(0.04 * S0, sh * 0.76, 0.03 * S0,
          0, -th - sh * 0.48, 0.03 * S0 + 0.065 * S0, 0.12, 0, 0, BONE_HEX);
    P.box(0.10 * S0, sh * 0.30, 0.02 * S0,
          sx * 0.03 * S0, -th - sh * (0.3 + rnd() * 0.4), 0.03 * S0 + 0.064 * S0,
          0.12, 0, jit(0.4), C_BRUISE);
    //  Foot, turned out at an angle no living ankle would hold.
    P.box(0.19 * S0, 0.085 * S0, 0.30 * S0,
          0, -th - sh - 0.02, 0.09 * S0, 0, sx * 0.16, 0, C_ROT);
    P.box(0.16 * S0, 0.05 * S0, 0.06 * S0,
          0, -th - sh - 0.04, 0.22 * S0, 0, sx * 0.16, 0, C_PALE);
    return bone(P, skin, hips, sx * B.hip[0] * S0 * 0.46, -B.hip[1] * S0 * 0.4, 0);
  }
  if (!wisp){ legL = leg(-1); legR = leg(1); }

  // ── rags: one merged cluster that sways as a whole ──
  const rp = partList();
  const nRags = B.rags || 5;
  for (let i = 0; i < nRags; i++){
    const a = (i / nRags) * 6.2832 + rnd() * 0.5;
    const len = (0.26 + rnd() * 0.50) * S0 * (wisp ? 2.2 : 1);
    rp.box(0.09 * S0 + rnd() * 0.10 * S0, len, 0.028,
           Math.cos(a) * B.hip[0] * S0 * 0.52, -len * 0.5 - B.hip[1] * S0 * 0.2,
           Math.sin(a) * B.hip[2] * S0 * 0.52,
           (rnd() - 0.5) * 0.4, a, (rnd() - 0.5) * 0.5,
           rnd() < 0.3 ? C_ROT : C_CLOTH);
  }
  const rags = bone(rp, skin, hips, 0, 0, 0);

  //  The crack the light comes out of.
  const seamP = partList();
  const seamW = big ? 0.22 * S0 : 0.045 * S0;
  seamP.box(seamW, chh * (big ? 0.46 : 0.34), 0.03,
            -cw * 0.24, chh * 0.50, cd * 0.5 + 0.03, 0, 0, 0.18, 0xffffff);
  const seam = new THREE.Mesh(mergeParts(seamP), ember);
  seam.castShadow = false; seam.receiveShadow = false;
  spine.add(seam);

  //  A ghost throws no shadow. It is the one thing in the game that the sun
  //  does not have an opinion about.
  if (def.ghost) g.traverse(o => { if (o.isMesh) o.castShadow = false; });

  const y = groundY(x, z);
  g.position.set(x, y, z);
  S.world.add(g);

  const hpMul = over ? 1 : 1 + (St.day - 1) * 0.17;
  const m = {
    kind, def, B, g, hips, spine, neck, rags, seam, eyes, ember, emberBase, glow,
    armL, armR, legL, legR,
    mats: [skin],
    hp: def.hp * hpMul, maxHp: def.hp * hpMul,
    x, z, y, vy: 0, yaw: 0, cd: 0, phase: Math.random() * 6.28,
    hurt: 0, dead: false, deadT: 0, stun: 0, bob: Math.random() * 6.28,
    twitch: 0,
  };
  mobs.push(m);
  return m;
}

//  The walk. Stepped to twelve frames a second like everything else, and
//  deliberately lopsided: one leg swings, the other drags.
function poseMob(m, dt){
  const B = m.B, def = m.def;
  const ph = St.step * (def.spd * 1.5 * B.gait) + m.phase;
  const sw = Math.sin(ph);
  const sw2 = Math.sin(ph * 2);

  //  A twitch now and then, because a body that only ever does the loop reads
  //  as a machine.
  m.twitch -= dt;
  if (m.twitch <= 0 && Math.random() < dt * 0.5) m.twitch = 0.34;
  const tw = m.twitch > 0 ? Math.sin(m.twitch * 60) * 0.16 : 0;

  m.spine.rotation.x = B.lean + sw2 * 0.05;
  m.spine.rotation.z = sw * 0.07 + tw * 0.4;
  m.neck.rotation.x = B.headTilt + sw2 * 0.10 + tw;
  m.neck.rotation.z = -sw * 0.12;

  //  Arms never in phase with each other.
  m.armL.rotation.x = -0.50 - sw * 0.40;
  m.armL.rotation.z = 0.16;
  m.armR.rotation.x = -0.14 + sw * 0.30;
  m.armR.rotation.z = -0.10;

  if (m.legL){
    m.legL.rotation.x = sw * 0.62;
    m.legR.rotation.x = -sw * 0.62 * (1 - B.drag);
    m.legL.rotation.z = 0.05; m.legR.rotation.z = -0.09;
    //  Weight drops on the good leg only, so the bob is uneven.
    m.hips.position.y = def.h * 0.52 + Math.max(0, sw) * 0.055 * B.scale - 0.03;
  }

  m.rags.rotation.x = Math.sin(ph * 1.3) * 0.16;
  m.rags.rotation.z = Math.sin(ph * 0.9) * 0.14;

  //  The flicker is in the colour, not the size. Scaling the lamp mesh also
  //  scales the offsets baked into its vertices, so a pulse down to 0.44 was
  //  quietly dragging both eyes back inside the skull — which is why the heads
  //  read as empty boxes after dark no matter how deep the sockets got.
  const pulse = 0.72 + Math.sin(St.step * 5 + m.phase) * 0.28;
  if (m.glow) m.glow.color.copy(_EYE_DIM.setHex(m.def.eye))
                          .multiplyScalar(0.45 + pulse * 0.55);
  //  The furnace inside comes up after dark and banks down in daylight, so the
  //  same body is a dull grey thing at noon and lit from within at midnight.
  if (m.ember){
    const heat = (St.night ? 1 : 0.18) *
                 (0.80 + Math.sin(St.step * 2.1 + m.phase) * 0.20);
    m.ember.color.copy(m.emberBase).lerp(_EMBER_HOT.setHex(m.def.eye), heat);
  }
}

//  Scratch, so the breath above allocates nothing per corpse per frame.
const _EMBER_HOT = new THREE.Color();
const _EYE_DIM = new THREE.Color();

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
    //  Every lit ring holds, not just the Kiln's. An unclaimed ruin holds
    //  nothing, which is the whole reason to go and relight it.
    const near = nearestSettlement(x, z, true);
    if (near.s){
      const bonus = near.s.kind === 'home' ? St.kiln.brazier * 5 : 0;
      if (near.d < ringAt(near.s) + 8 + bonus) continue;
    }
    if (nearLantern(x, z, 9)) continue;                 // lanterns hold too
    if (groundY(x, z) < WATER_Y + 0.3) continue;

    const r = Math.random();
    let kind = 'husk';
    if (St.day >= 2 && r < 0.26) kind = 'stalker';
    else if (St.day >= 3 && r < 0.40) kind = 'wraith';
    else if (St.day >= 3 && r < 0.52) kind = 'lumber';
    else if (St.day >= 4 && r < 0.64) kind = 'wisp';
    else if (St.day >= 5 && r < 0.76) kind = 'wolf';
    else if (St.day >= 6 && r < 0.83) kind = 'molder';
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
  //  The Lumber Priest's ward. Not immunity — a wall of numbers, so a player
  //  who does not spot the tell still gets there, slowly.
  if (m.boss && m.boss.trait === 'ward' && (m.ward || 0) > 0){
    dmg *= 0.16;
    burst(m.g.position.x, m.g.position.y + m.def.h * 0.7, m.g.position.z, 3, 0x9fe6ff, 5);
  }
  //  Two bodies, one life: whatever either takes comes off the same pool.
  if (m.twinOf && !m.twinOf.dead){
    m.twinOf.hp -= dmg * 0.5;
    m.hp -= dmg * 0.5;
    if (m.twinOf.hp <= 0 || m.hp <= 0){
      m.hp = 0; m.twinOf.hp = 0;
    }
  } else if (m.twin && !m.twin.dead){
    m.twin.hp -= dmg * 0.5;
    m.hp -= dmg * 0.5;
    if (m.twin.hp <= 0 || m.hp <= 0){ m.hp = 0; m.twin.hp = 0; }
  } else {
    m.hp -= dmg;
  }
  m.hurt = 0.16;
  //  A boss is not stun-locked by chip damage; that is what made the old big
  //  ones trivial to back into a corner and hold there.
  m.stun = m.boss ? 0.02 : 0.10;
  m.x += kx; m.z += kz;
  burst(m.g.position.x, m.g.position.y + m.def.h * 0.6, m.g.position.z,
        5, m.def.spark, 4.5);
  dmgNumber(m.g.position.x, m.g.position.y + m.def.h * 0.9, m.g.position.z, Math.round(dmg));
  if (m.hp <= 0) killMob(m);
}

function killMob(m){
  m.dead = true; m.deadT = 0.9;
  St.kills++;
  if (m.boss) bossDown(m);
  //  A blighted thing was holding a ruin. One fewer.
  if (m.ruin && m.ruin.blight > 0){
    m.ruin.blight--;
    if (m.ruin.blight === 0){
      toast(`${m.ruin.name} is clear. Light it at the mouth.`, '#7dffb3');
      banner(m.ruin.name, 'cleared');
    }
    St.dirty = true;
  }
  questEvent('kill');
  St.combo++; St.comboT = 3.2;
  St.xp += 12 * m.def.tier;
  burst(m.g.position.x, m.g.position.y + m.def.h * 0.5, m.g.position.z,
        16, m.def.spark, 8);
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
      if (m.deadT <= 0){ S.world.remove(m.g); disposeTree(m.g); mobs.splice(i, 1); }
      continue;
    }

    //  Daylight is lethal to them, unless they are what is holding a ruin:
    //  a blight you can only fight at night is a blight you cannot schedule.
    if (!St.night && !m.ruin){
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
      let mvx = dx / d, mvz = dz / d;
      const push = nearestSettlement(m.x, m.z, true);
      if (push.s && push.d < ringAt(push.s) + 1.5){
        const ox = m.x - push.s.x, oz = m.z - push.s.z, od = Math.hypot(ox, oz) || 1;
        mvx = ox / od; mvz = oz / od;
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

    //  Boss behaviour rides on top of the ordinary one, so a boss walks,
    //  swings and dies through exactly the same code as everything else.
    if (m.boss) tickBoss(m, dt, d);
    if (m.dash > 0){
      m.dash -= dt;
      m.x += (dx / d) * m.def.spd * 2.4 * dt;
      m.z += (dz / d) * m.def.spd * 2.4 * dt;
    }
    if (m.volley > 0){
      m.volleyT -= dt;
      if (m.volleyT <= 0){ m.volleyT = 0.30; m.volley--; spit(m); }
    }

    poseMob(m, dt);

    if (m.hurt > 0){
      m.hurt -= dt;
      const f = m.hurt > 0 ? 1 : 0;
      for (const mat of m.mats){
        mat.emissive = mat.emissive || new THREE.Color();
        mat.emissive.setRGB(f, f * 0.28, f * 0.28);
      }
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
        //  The long arm comes over the top, and the body follows it.
        m.armL.rotation.x = -2.5;
        m.spine.rotation.x = m.B.lean - 0.3;
      }
    }
  }
}

function spit(m){
  const geo = new THREE.IcosahedronGeometry(0.22, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: m.def.eye }));
  mesh.position.set(m.x, m.y + m.def.h * 0.8, m.z);
  mesh.castShadow = false;
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
      S.world.remove(p.mesh); disposeTree(p.mesh); projectiles.splice(i, 1);
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
  dawn:  { top:0xff9a5c, bot:0xffd9a0, fog:0xffc08a, sun:0xfff0c0, amb:0x6a5540, sunI:2.1, ambI:0.52 },
  day:   { top:0x3fa9f5, bot:0xbfe8ff, fog:0xbfe4ff, sun:0xfff6e0, amb:0x88a0c0, sunI:2.9, ambI:0.62 },
  dusk:  { top:0x7b3f9a, bot:0xff7a5c, fog:0xd07a7a, sun:0xffb06a, amb:0x5a4460, sunI:1.7, ambI:0.46 },
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
  initShadows();
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
  //  Day sight goes well past the 144m streaming radius on purpose: what you
  //  see out there is the coarse backdrop, and the point of a bigger world is
  //  being able to see somewhere before you walk to it.
  SHW.scene.fog.near = St.night ? 36 : 110;
  SHW.scene.fog.far  = St.night ? 150 : 420;
  SHW.renderer.setClearColor(new THREE.Color(m.bot));
  //  Rim colour tracks the sky, so a silhouette at dusk is edged in dusk.
  RIM.color.copy(new THREE.Color(m.top)).lerp(new THREE.Color(0xffffff), 0.35);
  RIM.strength = St.night ? 0.34 : 0.17;

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
  //  And every other lit kiln with it. The home hearth flickered and dimmed
  //  with the hour while the towns sat at a flat 2.6 with a fire that never
  //  moved, which reads as two different games in one valley.
  for (let i = 1; i < settlements.length; i++){
    const st = settlements[i];
    if (!st.claimed) continue;
    if (st.fire){
      st.fire.scale.setScalar(f * (St.night ? 1.2 : 0.95));
      st.fire.rotation.y = St.step * 2.0 + i;
    }
    if (st.light) st.light.intensity = (St.night ? 3.4 : 1.6) * f;
    if (st.bowls){
      for (const b of st.bowls){
        b.scale.setScalar(0.85 + Math.sin(St.step * 6 + b.position.x + i) * 0.2);
      }
    }
    if (st.ringMesh) st.ringMesh.material.opacity = St.night ? 0.58 : 0.24;
  }
  //  An unlit ruin's ring pulses red at night, so you can find one in the dark.
  for (const st of settlements){
    if (st.claimed || !st.ringMesh) continue;
    st.ringMesh.material.opacity = St.night
      ? 0.30 + Math.sin(St.step * 3) * 0.14 : 0.22;
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
    questEvent('night');
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
  tickBossCall(dt);
  updateBossBar();
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
  //  Any lit ring mends you. The Kiln mends fastest, because you paid to
  //  raise it.
  const safe = protectedAt(Pl.pos.x, Pl.pos.z);
  if (safe && St.hp < St.maxHp){
    const rate = safe.s.kind === 'home' ? benchRegen() : 7;
    St.hp = Math.min(St.maxHp, St.hp + dt * rate);
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
  if (p.face) p.face.rotation.copy(p.head.rotation);
  if (p.kneeL){
    p.kneeL.rotation.x = moving ? Math.max(0,-Math.sin(ph*5.2))*.65 : .03;
    p.kneeR.rotation.x = moving ? Math.max(0, Math.sin(ph*5.2))*.65 : .03;
    p.elbowL.rotation.x = -.13 - (moving ? Math.max(0,sw)*.18 : 0);
    p.elbowR.rotation.x = -.13;
  }
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
  for (let i = 0; i < settlements.length; i++){
    const st = settlements[i];
    if (!st.solids) continue;
    if (Math.abs(st.x - p.x) > 40 || Math.abs(st.z - p.z) > 40) continue;
    for (let k = 0; k < st.solids.length; k++){
      const b = st.solids[k];
      const dx = p.x - b.x, dy = p.y - b.y, dz = p.z - b.z;
      if (dx * dx + dz * dz < b.r * b.r && Math.abs(dy) < 3.2) return true;
    }
  }
  if (solidAt(p.x, p.y, p.z)) return true;
  return false;
}

function updateCamera(dt){
  const c = SHW.camera;
  //  Inspection camera: used to photograph a model without the player's head
  //  in front of it. Never engaged in normal play.
  if (SHW.freeCam){
    const f = SHW.freeCam;
    c.position.set(f.px, f.py, f.pz);
    c.lookAt(f.tx, f.ty, f.tz);
    return;
  }
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
  const blockSite = siteBlocked(x, z, 1);
  if (blockSite){
    toast(`${blockSite.name}'s ground will not move.`, '#ff5268');
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
      if (siteBlocked(wx, wz, 0)) continue;
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
  const nearSite = siteBlocked(t.x + 0.5, t.z + 0.5, -4);
  if (nearSite){
    toast(`Too close to ${nearSite.name} to build.`, '#ff5268');
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
      const ok = !siteBlocked(t.x + 0.5, t.z + 0.5, -4);
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
      const ok = !siteBlocked(a.hit.x, a.hit.z, 1);
      S.brushRing.position.set(a.hit.x, groundY(a.hit.x, a.hit.z) + 0.12, a.hit.z);
      S.brushRing.scale.setScalar(St.brush);
      S.brushRing.material.color.setHex(ok ? 0x7fdcff : 0xff3050);
      S.brushRing.visible = true;
    }
  }
}

// ─── 22 · Drops on the ground ────────────────────────────────────────────────

let lightsDirty = false, dropLightT = 0;
function tickDrops(dt){
  dropLightT += dt;
  if (lightsDirty || dropLightT > 0.25){ lightsDirty = false; dropLightT = 0; refreshDropLights(); }
  for (let i = drops.length - 1; i >= 0; i--){
    const d = drops[i];
    d.t += dt;
    const gy = groundY(d.mesh.position.x, d.mesh.position.z);
    d.mesh.position.y = gy + 0.95 + Math.sin(St.step * 3 + i) * 0.14;
    d.mesh.rotation.y = St.step * 1.6;
    d.mesh.rotation.x = Math.sin(St.step * 1.1) * 0.3;
    const dist = Math.hypot(d.mesh.position.x - Pl.pos.x, d.mesh.position.z - Pl.pos.z);
    if (dist < 2.0){
      pickUp(d.it);
      S.world.remove(d.mesh); disposeTree(d.mesh);
      drops.splice(i, 1); lightsDirty = true;
    } else if (d.t > 150){
      S.world.remove(d.mesh); disposeTree(d.mesh);
      drops.splice(i, 1); lightsDirty = true;
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
#shw-root.haspost #shw-grain{display:none;}
#shw-root.haspost #shw-vig{display:none;}
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

/* ── compass strip ── */
#shw-compass{position:absolute;left:50%;top:6px;transform:translateX(-50%);
  width:min(62%,660px);height:30px;pointer-events:none;
  border-bottom:1px solid rgba(255,255,255,.13);}
#shw-compass i{position:absolute;top:0;transform:translateX(-50%);text-align:center;
  font-style:normal;white-space:nowrap;}
#shw-compass i::after{content:'';display:block;width:1px;height:7px;margin:2px auto 0;
  background:currentColor;}
#shw-compass u{display:block;text-decoration:none;font-size:8.5px;letter-spacing:2px;
  text-transform:uppercase;text-shadow:0 1px 3px #000;}
#shw-compass em{display:block;font-size:7.5px;letter-spacing:1px;opacity:.6;font-style:normal;}
#shw-compass i.home{color:#ffb03d;}
#shw-compass i.lit{color:#7dffb3;}
#shw-compass i.dead{color:#ff6f84;}
#shw-compass i.way{color:#7fdcff;}

/* ── the work panel ── */
#shw-quest{position:absolute;left:18px;top:104px;width:246px;
  background:linear-gradient(150deg,rgba(10,6,20,.86),rgba(16,8,26,.7));
  border-left:2px solid #7fdcff;padding:9px 12px;}
#shw-quest p{font-size:8px;letter-spacing:3.6px;color:#7fdcff;text-transform:uppercase;
  margin-bottom:7px;}
#shw-quest ul{list-style:none;display:grid;gap:7px;}
#shw-quest li b{display:block;font-size:10.5px;letter-spacing:.4px;color:#e7e2ff;}
#shw-quest li span{display:block;margin-top:2px;font:11px/1.35 Georgia,serif;color:#9c93c6;}
#shw-quest li.main b{color:#ffd9a0;}
#shw-quest li.done b{color:#7dffb3;}

/* ── the map screen ── */
#shw-mapscreen{position:absolute;inset:0;display:none;pointer-events:auto;
  background:rgba(4,2,10,.93);}
#shw-mapscreen.show{display:grid;grid-template-columns:1fr 280px;}
#shw-mapwrap{display:grid;place-items:center;padding:18px;min-width:0;}
#shw-bigmap{border:1.5px solid rgba(255,176,61,.4);cursor:grab;max-width:100%;max-height:100%;}
#shw-bigmap:active{cursor:grabbing;}
#shw-mapside{border-left:1px solid rgba(255,255,255,.12);padding:18px 16px;
  overflow:auto;display:flex;flex-direction:column;gap:7px;}
#shw-mapside h3{font:700 13px/1 'SF Mono',monospace;letter-spacing:4px;text-transform:uppercase;
  color:#ffd9a0;margin-bottom:4px;}
#shw-mapside p{font-size:9px;letter-spacing:1.6px;color:#7a6f9c;text-transform:uppercase;
  margin-bottom:8px;}
.shw-site{display:grid;grid-template-columns:1fr auto;gap:2px 8px;text-align:left;
  padding:9px 11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.13);
  color:inherit;font-family:inherit;cursor:pointer;}
.shw-site:hover{border-color:#7fdcff;background:rgba(127,220,255,.1);}
.shw-site b{font-size:11px;letter-spacing:1px;color:#ffd9a0;}
.shw-site.dead b{color:#ff8fa0;}
.shw-site span{grid-column:1;font:11px/1.3 Georgia,serif;color:#9c93c6;}
.shw-site em{grid-row:1;font-style:normal;font-size:10px;color:#7fdcff;}
.shw-site.clear{text-align:center;display:block;color:#9c93c6;font-size:10px;letter-spacing:2px;
  text-transform:uppercase;}
@media (max-width:820px){
  #shw-mapscreen.show{grid-template-columns:1fr;grid-template-rows:1fr auto;}
  #shw-mapside{border-left:0;border-top:1px solid rgba(255,255,255,.12);max-height:38%;}
}

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

/*  The bar for one of the ten. Sits under the day plate, spans the middle of
    the screen, and turns cold blue while the Priest's ward is shut. */
#shw-bossbar{position:absolute;left:50%;top:86px;transform:translate(-50%,0);
  width:min(560px,62vw);opacity:0;transition:opacity .35s;pointer-events:none;
  text-align:center;}
#shw-bossbar.on{opacity:1;}
#shw-bossbar .nm{font:800 17px/1.2 Georgia,serif;letter-spacing:3px;color:#ffd9a0;
  text-shadow:0 2px 0 #3a0d14,0 0 18px rgba(255,60,80,.5);margin-bottom:5px;}
#shw-bossbar .nm i{font:10px/1 ui-monospace,Menlo,monospace;font-style:normal;
  letter-spacing:2px;color:#c3bcd8;margin-left:9px;opacity:.8;}
#shw-bossbar .tr{height:11px;background:#180c14;border:1px solid #4a2230;
  box-shadow:0 2px 0 rgba(0,0,0,.5);overflow:hidden;}
#shw-bossbar .tr b{display:block;height:100%;width:100%;
  background:linear-gradient(180deg,#ff6b5c,#c3172f);transition:width .18s;}
#shw-bossbar.warded .tr b{background:linear-gradient(180deg,#b9ecff,#3f93c8);}
#shw-bossbar.warded .nm{color:#b9ecff;text-shadow:0 2px 0 #10303f;}

/*  The ending. It does not take the world away, so it is a card and not a
    curtain: dismiss it and the ground you changed is still out there. */
#shw-win{position:absolute;inset:0;display:none;place-items:center;text-align:center;
  background:radial-gradient(ellipse at 50% 44%,rgba(60,22,12,.94),rgba(5,3,12,.97) 74%);
  z-index:40;pointer-events:auto;}
#shw-win.on{display:grid;}
#shw-win b{display:block;font:800 56px/1 Georgia,serif;letter-spacing:-2px;color:#ffd9a0;
  text-shadow:0 6px 0 #8a3a12,0 0 60px rgba(255,150,60,.5);margin-bottom:14px;}
#shw-win p{max-width:520px;margin:0 auto 10px;font:14px/1.8 Georgia,serif;color:#e6dcc6;}
#shw-win #shw-win-sub{font:10px/1 ui-monospace,Menlo,monospace;letter-spacing:4px;
  text-transform:uppercase;color:#c3bcd8;margin:16px 0 24px;}
#shw-win button{font:11px/1 ui-monospace,Menlo,monospace;letter-spacing:3px;
  text-transform:uppercase;color:#05030c;background:#ffc65a;border:0;
  padding:13px 26px;cursor:pointer;box-shadow:0 4px 0 #8a5a12;}
#shw-win button:hover{background:#ffd9a0;}
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
#shw-title .ver{margin-top:14px;font:600 9px/1 'SF Mono',monospace;letter-spacing:3px;
  color:#8a7f6a;}
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

      <div id="shw-compass"></div>
      <div id="shw-quest"></div>
      <div id="shw-toasts"></div>
      <div id="shw-bossbar"><div class="nm"><span></span><i></i></div><div class="tr"><b></b></div></div>
      <div id="shw-win"><div>
        <b>STILL HUMAN</b>
        <p>The tenth is down. The Kiln has finished lighting, and for the first
        time since you got here the ring reaches past where you can see.</p>
        <p>Nothing else is coming for the ground. The nights still come, and
        what walks in them is ordinary now. The country is yours to keep
        building in.</p>
        <div id="shw-win-sub"></div>
        <button id="shw-win-go">go back out</button>
      </div></div>
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
        <canvas id="shw-map" width="168" height="168"></canvas>
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

      <div id="shw-mapscreen">
        <div id="shw-mapwrap"><canvas id="shw-bigmap" width="600" height="600"></canvas></div>
        <div id="shw-mapside">
          <h3>The Valley</h3><p>click a name to set a marker · drag and scroll the map · M closes</p>
          <div id="shw-maplist"></div>
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
        <p>The arena had walls. This does not. Five hundred
           and seventy-six metres of plains, river and snow line, with seven kilns
           in it and four of them dead. Relight them and the safe ground is yours.</p>
        <div class="ver">v` + SHW_VERSION + `</div>
        <div class="btns">
          <button id="shw-new">New ground</button>
          <button id="shw-cont" class="ghost">Continue</button>
        </div>
        <div class="keys">
          <kbd>W A S D</kbd> move &nbsp; <kbd>Shift</kbd> run &nbsp; <kbd>Space</kbd> jump &nbsp; <kbd>Mouse</kbd> look<br>
          <kbd>1</kbd> fight &nbsp; <kbd>2</kbd> build &nbsp; <kbd>3</kbd> sculpt &nbsp; <kbd>Tab</kbd> kit &nbsp; <kbd>M</kbd> map &nbsp; <kbd>E</kbd> bench &nbsp; <kbd>F</kbd> torch<br>
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
  hud.bossbar = root.querySelector('#shw-bossbar');
  hud.bossName = root.querySelector('#shw-bossbar .nm span');
  hud.bossNo = root.querySelector('#shw-bossbar .nm i');
  hud.bossFill = root.querySelector('#shw-bossbar .tr b');
  hud.win = root.querySelector('#shw-win');
  const winGo = root.querySelector('#shw-win-go');
  if (winGo) winGo.addEventListener('click', (e) => { e.stopPropagation(); closeWin(); });
  hud.flash = root.querySelector('#shw-flash');
  hud.dead = root.querySelector('#shw-dead');
  hud.compass = root.querySelector('#shw-compass');
  hud.quest = root.querySelector('#shw-quest');
  hud.mapScreen = root.querySelector('#shw-mapscreen');
  hud.bigMap = root.querySelector('#shw-bigmap');
  hud.mapList = root.querySelector('#shw-maplist');
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


// ─── 33 · WORK — a spine to follow and a board to ignore it for ──────────────
//  There was no objective system of any kind in this file. A bigger world
//  without one is just further to walk before you are bored, so: a chain that
//  names the next thing and puts a marker on the map, and a contract board at
//  every lit settlement for when you would rather not advance it.

let spine = [];

function planQuests(){
  const towns = settlements.filter(s => s.kind === 'town');
  const ruins = settlements.filter(s => s.kind === 'ruin');
  const T = (i) => towns[i % towns.length];
  const R = (i) => ruins[i % ruins.length];

  spine = [
    { id:'night1', kind:'nights', n:1,
      title:'Live through the first night',
      hint:'Stay inside the ring when the light goes. Nothing crosses it.' },
    { id:'axe', kind:'tool', tool:'axe',
      title:'Make an axe at the bench',
      hint:'Hold on trees and boulders for timber and stone, then press E at the bench.' },
    { id:'reach0', kind:'reach', target:T(0).id, r:22,
      title:`Walk to ${T(0).name}`,
      hint:'Open the map with M. The compass along the top points at it.' },
    { id:'ruin0', kind:'claim', target:R(0).id,
      title:`Relight ${R(0).name}`,
      hint:'Something blighted holds it, and daylight will not shift them. Clear it, then relight it at the mouth.' },
    { id:'ring1', kind:'kiln', key:'ring', n:1,
      title:"Widen the Kiln's ring",
      hint:'At the Kiln bench. Stone and earth.' },
    { id:'reach1', kind:'reach', target:T(1).id, r:22,
      title:`Walk to ${T(1).name}`,
      hint:'Further out. Take a torch and something to swing.' },
    { id:'ruin1', kind:'claim', target:R(1).id,
      title:`Relight ${R(1).name}`,
      hint:'Two down.' },
    { id:'day6', kind:'day', n:6,
      title:'Reach the sixth day',
      hint:'The nights get worse. Build something that holds.' },
    { id:'all', kind:'claimAll',
      title:'Relight every kiln in the valley',
      hint:'Every ring lit, and the dark has nowhere left to sit.' },
  ];
}

function questStep(){
  if (!St.quest) return null;
  return spine[St.quest.i] || null;
}

function questTargetSite(q){
  if (!q || !q.target) return null;
  return settlements.find(s => s.id === q.target) || null;
}

//  Where the marker goes: a hand-placed waypoint always wins, because a player
//  who set one is answering the question themselves.
function questWaypoint(){
  if (St.waypoint) return St.waypoint;
  const q = questStep();
  const site = questTargetSite(q);
  if (site) return { x: site.x, z: site.z, name: site.name };
  if (q && (q.kind === 'claimAll')){
    const next = settlements.find(s => !s.claimed);
    if (next) return { x: next.x, z: next.z, name: next.name };
  }
  return null;
}

function questProgress(){
  const q = questStep();
  if (!q) return null;
  switch (q.kind){
    case 'nights':   return { have: St.nightsSurvived, need: q.n };
    case 'day':      return { have: St.day, need: q.n };
    case 'tool':     return { have: St.tools[q.tool] ? 1 : 0, need: 1 };
    case 'kiln':     return { have: St.kiln[q.key] || 0, need: q.n };
    case 'claimAll': return { have: settlements.filter(s => s.claimed).length,
                              need: settlements.length };
    case 'reach': {
      const s = questTargetSite(q);
      if (!s) return { have: 0, need: 1 };
      return { have: 0, need: 1, dist: Math.hypot(Pl.pos.x - s.x, Pl.pos.z - s.z) };
    }
    case 'claim': {
      const s = questTargetSite(q);
      if (!s) return { have: 0, need: 1 };
      return { have: s.claimed ? 1 : 0, need: 1, blight: s.blight };
    }
  }
  return null;
}

function questSatisfied(){
  const q = questStep();
  if (!q) return false;
  const p = questProgress();
  if (q.kind === 'reach') return p.dist !== undefined && p.dist < q.r;
  if (q.kind === 'claimAll') return p.have >= p.need;
  return p && p.have >= p.need;
}

const QUEST_REWARD = { ember: 10, timber: 30, stone: 30, earth: 30 };

function advanceQuest(){
  const q = questStep();
  if (!q) return;
  St.quest.done[q.id] = true;
  St.quest.i++;
  for (const k in QUEST_REWARD) St.res[k] += QUEST_REWARD[k];
  const next = questStep();
  banner(next ? 'Done' : 'The valley is lit', q.title);
  toast(next ? `Next: ${next.title}` : 'Every kiln in the valley is burning.', '#7dffb3');
  St.dirty = true;
  renderQuestHUD();
  drawMap();
}

//  Discrete events. Continuous ones are checked on the tick.
function questEvent(kind, arg){
  const q = questStep();
  if (q && ((kind === 'claim' && q.kind === 'claim' && q.target === arg) ||
            (kind === 'tool'  && q.kind === 'tool'  && q.tool === arg) ||
            (kind === 'kiln'  && q.kind === 'kiln'  && q.key === arg))){
    if (questSatisfied()) advanceQuest();
  }
  contractEvent(kind, arg);
}

let questTimer = 0;
function questTick(dt){
  questTimer += dt;
  if (questTimer < 0.4) return;
  questTimer = 0;
  if (questSatisfied()) advanceQuest();
  renderQuestHUD();
}

// ─── Contracts ──────────────────────────────────────────────────────────────

const CONTRACT_KINDS = [
  { kind:'gather', res:'timber', verb:'Cut' },
  { kind:'gather', res:'stone',  verb:'Quarry' },
  { kind:'gather', res:'earth',  verb:'Dig' },
  { kind:'hunt',   verb:'Put down' },
  { kind:'hold',   verb:'Hold' },
];

function rollContract(st, seed){
  const rnd = mulberry(hashStr(st.id + ':' + seed + SHW.seed));
  const spec = CONTRACT_KINDS[Math.floor(rnd() * CONTRACT_KINDS.length)];
  const scale = 1 + (St.day - 1) * 0.12;
  const c = {
    id: st.id + ':' + seed, site: st.id, kind: spec.kind, have: 0, taken: false,
  };
  if (spec.kind === 'gather'){
    c.res = spec.res;
    c.need = Math.round((28 + rnd() * 34) * scale);
    c.text = `${spec.verb} ${c.need} ${c.res}`;
  } else if (spec.kind === 'hunt'){
    c.need = Math.round((5 + rnd() * 7) * scale);
    c.text = `Put down ${c.need} after dark`;
  } else {
    c.need = 1;
    c.text = `Hold a night through without going down`;
  }
  const t = c.kind === 'gather' ? 1 : 1.5;
  c.reward = {
    ember: Math.round((6 + rnd() * 8) * t * scale),
    stone: Math.round((10 + rnd() * 20) * scale),
    timber: Math.round((10 + rnd() * 20) * scale),
  };
  return c;
}

function contractsFor(st){
  if (!St.contracts[st.id] || St.contracts[st.id].length < 3){
    St.contracts[st.id] = [0, 1, 2].map(i =>
      (St.contracts[st.id] && St.contracts[st.id][i]) || rollContract(st, St.contractSeed + i));
  }
  return St.contracts[st.id];
}

function takeContract(c){
  const active = Object.values(St.contracts).flat().filter(x => x.taken && !x.done).length;
  if (c.taken){ toast('Already taken.', '#9c93c6'); return; }
  if (active >= 3){ toast('Three at a time is the limit.', '#ff5268'); return; }
  c.taken = true; c.have = 0;
  toast(`Took: ${c.text}`, '#7fdcff');
  St.dirty = true;
  renderBench(); renderQuestHUD();
}

function turnInContract(c){
  if (!c.taken || c.have < c.need){ toast('Not finished.', '#ff5268'); return; }
  for (const k in c.reward) St.res[k] += c.reward[k];
  //  Half the time the board pays in kit rather than material.
  if (Math.random() < 0.5) dropLoot(Pl.pos.x + 1.1, Pl.pos.y, Pl.pos.z, 2);
  const site = settlements.find(s => s.id === c.site);
  const list = St.contracts[c.site];
  const i = list.indexOf(c);
  St.contractSeed++;
  list[i] = rollContract(site, St.contractSeed + i);
  toast(`Paid: ${costLine(c.reward)}`, '#7dffb3');
  St.dirty = true;
  renderBench(); renderQuestHUD();
}

function contractEvent(kind, arg){
  let touched = false;
  for (const list of Object.values(St.contracts)){
    for (const c of list){
      if (!c.taken || c.have >= c.need) continue;
      if (kind === 'gather' && c.kind === 'gather' && c.res === arg.res){
        c.have = Math.min(c.need, c.have + arg.n); touched = true;
      } else if (kind === 'kill' && c.kind === 'hunt' && St.night){
        c.have = Math.min(c.need, c.have + 1); touched = true;
      } else if (kind === 'night' && c.kind === 'hold'){
        c.have = 1; touched = true;
      }
      if (touched && c.have >= c.need) toast(`Finished: ${c.text}`, '#7dffb3');
    }
  }
  if (touched){ St.dirty = true; renderQuestHUD(); }
}

function activeContracts(){
  return Object.values(St.contracts).flat().filter(c => c.taken);
}

// ─── 24 · Minimap ────────────────────────────────────────────────────────────

let mapBase = null;
const MAP_N = 240;                 // baked world image, 2.4m per pixel
const MINI_SPAN = 190;             // metres the corner minimap shows

function bakeMap(){
  const N = MAP_N;
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
      const shade = clamp(0.5 + h / 46, 0.34, 1.3);
      img.data[k]   = clamp(col.r * 255 * shade, 0, 255);
      img.data[k+1] = clamp(col.g * 255 * shade, 0, 255);
      img.data[k+2] = clamp(col.b * 255 * shade, 0, 255);
      img.data[k+3] = 255;
      if (h < WATER_Y){ img.data[k] = 40; img.data[k+1] = 120; img.data[k+2] = 170; }
    }
  }
  g.putImageData(img, 0, 0);
  mapBase = c;
}

//  World metres -> baked image pixels.
const mapPx = (v) => (v + HALF) / WORLD * MAP_N;

//  Shared by the corner minimap and the full map screen. `span` is how many
//  metres across the view shows; `cx, cz` is what sits at the centre.
function paintMap(g, W, H, cx, cz, span, opts){
  opts = opts || {};
  const scale = W / span;
  const toX = (wx) => (wx - cx) * scale + W / 2;
  const toY = (wz) => (wz - cz) * scale + H / 2;

  g.save();
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#0a0713';
  g.fillRect(0, 0, W, H);

  if (mapBase){
    const srcSpan = span / WORLD * MAP_N;
    g.imageSmoothingEnabled = span > 320;
    const sx = mapPx(cx) - srcSpan / 2, sy = mapPx(cz) - srcSpan / 2;
    //  Clip to the baked image rather than letting drawImage stretch the edge
    //  pixels into a grey band wherever the window overhangs the world.
    const x0 = Math.max(0, sx), y0 = Math.max(0, sy);
    const x1 = Math.min(MAP_N, sx + srcSpan), y1 = Math.min(MAP_N, sy + srcSpan);
    if (x1 > x0 && y1 > y0){
      const k = W / srcSpan;
      g.drawImage(mapBase, x0, y0, x1 - x0, y1 - y0,
                  (x0 - sx) * k, (y0 - sy) * k, (x1 - x0) * k, (y1 - y0) * k);
    }
  }

  //  Player-placed blocks, so a house you built is findable.
  g.fillStyle = 'rgba(127,220,255,.9)';
  const bs = Math.max(1, scale * 0.9);
  for (const b of blocks.values()){
    const x = toX(b.x), y = toY(b.z);
    if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
    g.fillRect(x, y, bs, bs);
  }

  //  Settlements. A lit one is amber, a ruin is a hollow red ring, and both
  //  are labelled on the big map because names are how you plan a route.
  for (const st of settlements){
    const x = toX(st.x), y = toY(st.z);
    if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
    const R = ringAt(st) * scale;
    g.lineWidth = 1.5;
    if (st.claimed){
      g.strokeStyle = 'rgba(255,176,61,.55)';
      g.beginPath(); g.arc(x, y, R, 0, 6.2832); g.stroke();
      g.fillStyle = st.kind === 'home' ? '#ffb03d' : '#7dffb3';
    } else {
      g.strokeStyle = 'rgba(255,82,104,.6)';
      g.setLineDash([3, 3]);
      g.beginPath(); g.arc(x, y, R, 0, 6.2832); g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#ff5268';
    }
    const s2 = st.kind === 'home' ? 5 : 4;
    g.fillRect(x - s2 / 2, y - s2 / 2, s2, s2);
    if (opts.labels){
      g.font = '600 10px "SF Mono", Menlo, monospace';
      g.fillStyle = st.claimed ? '#ffd9a0' : '#ff8fa0';
      g.textAlign = 'center';
      g.fillText(st.name, x, y - 9);
      if (!st.claimed){
        g.fillStyle = 'rgba(255,143,160,.75)';
        g.font = '600 8px "SF Mono", Menlo, monospace';
        g.fillText('unlit', x, y + 15);
      }
    }
  }

  //  The live things, only on the corner map where they matter.
  if (opts.live){
    g.fillStyle = '#ff3050';
    for (const m of mobs){ if (!m.dead) g.fillRect(toX(m.x) - 2, toY(m.z) - 2, 4, 4); }
    g.fillStyle = '#c08bff';
    for (const d of drops) g.fillRect(toX(d.mesh.position.x) - 2, toY(d.mesh.position.z) - 2, 4, 4);
  }

  //  An active objective's marker, so the map answers "where now".
  const wp = questWaypoint();
  if (wp){
    const x = toX(wp.x), y = toY(wp.z);
    g.strokeStyle = '#7fdcff'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 7 + Math.sin(St.step * 4) * 2, 0, 6.2832); g.stroke();
  }

  //  You, and which way you are facing.
  const px = toX(cx === Pl.pos.x ? Pl.pos.x : Pl.pos.x);
  const py = toY(Pl.pos.z);
  if (px > -10 && py > -10 && px < W + 10 && py < H + 10){
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(px, py, 3, 0, 6.2832); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
    const yaw = Pl.group ? Pl.group.rotation.y : 0;
    g.beginPath(); g.moveTo(px, py);
    g.lineTo(px + Math.sin(yaw) * 9, py + Math.cos(yaw) * 9);
    g.stroke();
  }
  g.restore();
}

function drawMap(){
  if (!hud.mapCtx) return;
  paintMap(hud.mapCtx, hud.map.width, hud.map.height,
           Pl.pos.x, Pl.pos.z, MINI_SPAN, { live: true });
}


// ─── 34 · KNOWING WHERE YOU ARE ─────────────────────────────────────────────
//  At 192m you could see the Kiln from anywhere and wayfinding was a luxury.
//  At 576m it is the difference between a world and a field. A compass strip
//  along the top, a full map on M, and a marker that follows the objective.

function renderQuestHUD(){
  if (!hud.quest) return;
  const q = questStep();
  const p = questProgress();
  const rows = [];

  if (q){
    let sub = q.hint || '';
    if (p){
      if (q.kind === 'reach' && p.dist !== undefined) sub = `${Math.round(p.dist)}m away`;
      else if (q.kind === 'claim' && p.blight > 0) sub = `${p.blight} still holding it`;
      else if (p.need > 1) sub = `${Math.min(p.have, p.need)} of ${p.need}`;
    }
    rows.push(`<li class="main"><b>${q.title}</b><span>${sub}</span></li>`);
  } else {
    rows.push('<li class="main"><b>The valley is lit</b><span>Every kiln burning.</span></li>');
  }

  for (const c of activeContracts()){
    const done = c.have >= c.need;
    rows.push(`<li class="${done ? 'done' : ''}"><b>${c.text}</b>` +
              `<span>${done ? 'take it back to the board' : c.have + ' of ' + c.need}</span></li>`);
  }
  hud.quest.innerHTML = `<p>Work</p><ul>${rows.join('')}</ul>`;
}

//  Compass. Everything the player might want to steer at, projected onto a
//  strip by bearing relative to where the camera is looking.
const _cw = new THREE.Vector3();
function updateCompass(){
  if (!hud.compass) return;
  SHW.camera.getWorldDirection(_cw);
  const camYaw = Math.atan2(_cw.x, _cw.z);
  const FOV = 1.9;                       // radians of bearing the strip covers

  const marks = [];
  for (const st of settlements){
    marks.push({ x: st.x, z: st.z, label: st.name,
                 cls: st.claimed ? (st.kind === 'home' ? 'home' : 'lit') : 'dead' });
  }
  const wp = questWaypoint();
  if (wp) marks.push({ x: wp.x, z: wp.z, label: wp.name || 'marker', cls: 'way' });

  //  Everything in front of you at once turns the strip into a single
  //  unreadable word. Five nearest, and the marker always survives the cut.
  const vis = [];
  for (const m of marks){
    const dx = m.x - Pl.pos.x, dz = m.z - Pl.pos.z;
    const d = Math.hypot(dx, dz);
    let rel = Math.atan2(dx, dz) - camYaw;
    while (rel > Math.PI) rel -= 6.2832;
    while (rel < -Math.PI) rel += 6.2832;
    if (Math.abs(rel) > FOV / 2) continue;
    vis.push({ m, d, pct: (rel / FOV + 0.5) * 100 });
  }
  vis.sort((a, b) => (a.m.cls === 'way' ? -1 : b.m.cls === 'way' ? 1 : a.d - b.d));
  const keep = vis.slice(0, 5).sort((a, b) => a.pct - b.pct);

  //  And nudge any two that would still sit on top of each other.
  for (let i = 1; i < keep.length; i++){
    if (keep[i].pct - keep[i - 1].pct < 13) keep[i].pct = keep[i - 1].pct + 13;
  }

  let html = '';
  for (const k of keep){
    const name = k.m.label.length > 13 ? k.m.label.slice(0, 12) + '…' : k.m.label;
    html += `<i class="${k.m.cls}" style="left:${clamp(k.pct, 2, 98).toFixed(2)}%">` +
            `<u>${name}</u><em>${Math.round(k.d)}m</em></i>`;
  }
  hud.compass.innerHTML = html;
}

// ─── The map screen ─────────────────────────────────────────────────────────

function openMap(force){
  const want = force === undefined ? !St.mapOpen : !!force;
  St.mapOpen = want;
  hud.mapScreen.classList.toggle('show', want);
  hud.lock.classList.toggle('hide', want || locked || St.phase !== 'play');
  if (want){
    cancelGather();
    document.exitPointerLock();
    St.mapSpan = St.mapSpan || 420;
    //  Keep the frame inside the world. Opening the map next to the eastern
    //  ridge should not spend half the screen on the void beyond it.
    St.mapCx = mapClamp(Pl.pos.x); St.mapCz = mapClamp(Pl.pos.z);
    paintBigMap();
    renderMapList();
  }
}

function mapClamp(v){
  const half = Math.min(St.mapSpan, WORLD) / 2;
  if (St.mapSpan >= WORLD) return 0;
  return clamp(v, -HALF + half, HALF - half);
}

function paintBigMap(){
  const cv = hud.bigMap;
  const r = cv.parentElement.getBoundingClientRect();
  const size = Math.max(240, Math.min(r.width, r.height) - 8);
  if (cv.width !== Math.round(size)){ cv.width = cv.height = Math.round(size); }
  paintMap(cv.getContext('2d'), cv.width, cv.height,
           St.mapCx, St.mapCz, St.mapSpan, { labels: true });
}

function renderMapList(){
  const rows = settlements.map(st => {
    const d = Math.round(Math.hypot(Pl.pos.x - st.x, Pl.pos.z - st.z));
    const state = st.kind === 'home' ? 'home'
                : st.claimed ? 'lit'
                : st.blight > 0 ? `${st.blight} holding it` : 'cleared, unlit';
    return `<button class="shw-site ${st.claimed ? '' : 'dead'}" data-site="${st.id}">
      <b>${st.name}</b><span>${state}</span><em>${d}m</em></button>`;
  }).join('');
  hud.mapList.innerHTML = rows +
    `<button class="shw-site clear" data-site="">Clear the marker</button>`;
  hud.mapList.querySelectorAll('.shw-site').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.site;
      if (!id){ St.waypoint = null; toast('Marker cleared.', '#9c93c6'); }
      else {
        const st = settlements.find(s => s.id === id);
        St.waypoint = { x: st.x, z: st.z, name: st.name };
        St.mapCx = mapClamp(st.x); St.mapCz = mapClamp(st.z);
        toast(`Marker on ${st.name}.`, '#7fdcff');
      }
      paintBigMap(); renderMapList();
    };
  });
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
                           '[',']','escape','r','g','p','c','m','j','o']);

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
      //  The ending card is dismissible like anything else, and dismissing it
      //  puts you back in the world rather than out of the game.
      if (hud.win && hud.win.classList.contains('on')){ closeWin(); return; }
      if (St.mapOpen){ openMap(false); return; }
      if (St.benchOpen){ toggleBench(false); return; }
      if (St.invOpen){ toggleInv(); return; }
      if (locked){ document.exitPointerLock(); return; }
      leave();
      return;
    }
    if (St.phase !== 'play') return;

    keys.add(k);
    if (k === 'm'){ if (St.benchOpen) toggleBench(false); openMap(); return; }
    if (k === 'tab'){ if (St.benchOpen) toggleBench(false); if (St.mapOpen) openMap(false);
                      toggleInv(); return; }
    //  E is the bench everywhere except build mode, where it cycles material.
    if (k === 'e' && St.mode !== 'build'){
      if (St.benchOpen){ toggleBench(false); return; }
      const here = hereSettlement();
      if (here) toggleBench(true, here);
      else toast('Nothing here to work at.', '#9c93c6');
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
    if (k === 'o'){ cycleQuality(); }
    if (k === 'c'){
      if (St.benchOpen) toggleBench(false);
      else { const h = hereSettlement(); if (h) toggleBench(true, h); }
    }
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
      locked || St.phase !== 'play' || St.invOpen || St.benchOpen || St.mapOpen);
    if (!locked) keys.clear();
  });

  on(document, 'mousemove', ev => {
    if (!locked || St.phase !== 'play') return;
    Pl.yaw   -= ev.movementX * 0.0026;
    Pl.pitch -= ev.movementY * 0.0020;
    Pl.pitch = clamp(Pl.pitch, -0.95, 0.72);
  });

  //  The map pans by dragging and zooms on the wheel, because a 576m world
  //  read through a fixed frame is a picture, not a map.
  const bm = hud.bigMap;
  let drag = null;
  on(bm, 'mousedown', ev => { drag = { x: ev.clientX, y: ev.clientY,
                                       cx: St.mapCx, cz: St.mapCz }; ev.preventDefault(); });
  on(window, 'mousemove', ev => {
    if (!drag) return;
    const k = St.mapSpan / bm.width;
    St.mapCx = mapClamp(drag.cx - (ev.clientX - drag.x) * k);
    St.mapCz = mapClamp(drag.cz - (ev.clientY - drag.y) * k);
    paintBigMap();
  });
  on(window, 'mouseup', () => { drag = null; });
  on(bm, 'wheel', ev => {
    ev.preventDefault();
    St.mapSpan = clamp(St.mapSpan * (ev.deltaY > 0 ? 1.18 : 0.85), 90, WORLD);
    St.mapCx = mapClamp(St.mapCx); St.mapCz = mapClamp(St.mapCz);
    paintBigMap();
  }, { passive: false });

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
  //  Sparse, and keyed by cell coordinates rather than a flat index, so a
  //  save survives the world changing size.
  const out = [];
  for (let j = 0; j <= GRID; j++){
    for (let i = 0; i <= GRID; i++){
      const k = hIdx(i, j);
      if (Math.abs(HD[k]) > 0.001) out.push(i, j, Math.round(HD[k] * 100) / 100);
    }
  }
  return out;
}

function save(){
  const data = {
    v: 2, seed: SHW.seed, grid: GRID, world: WORLD,
    day: St.day, cycle: St.cycle,
    hp: St.hp, xp: St.xp, level: St.level,
    res: St.res, kills: St.kills, nights: St.nightsSurvived,
    bossIdx: St.bossIdx, keystones: St.keystones, won: St.won, wonOnDay: St.wonOnDay,
    kiln: St.kiln, tools: St.tools,
    sites: settlements.map(st => ({ id: st.id, claimed: st.claimed,
                                    cleared: st.cleared, blight: st.blight })),
    quest: St.quest, contracts: St.contracts, contractSeed: St.contractSeed,
    waypoint: St.waypoint,
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
  if (!d || d.v !== 2) return false;
  SHW.seed = d.seed || SHW.seed;
  SHW.noise = makeNoise(hashStr(SHW.seed));
  SHW.moist = makeNoise(hashStr(SHW.seed + '-m'));
  settlements = [];                 // replanned from the saved seed
  buildHeights();
  HD = new Float32Array((GRID + 1) * (GRID + 1));
  if (Array.isArray(d.edits)){
    for (let i = 0; i + 2 < d.edits.length; i += 3){
      const gi = d.edits[i], gj = d.edits[i + 1];
      if (gi <= GRID && gj <= GRID) HD[hIdx(gi, gj)] = d.edits[i + 2];
    }
  }
  //  Which kilns were lit, and what is still holding the rest.
  for (const rec of (d.sites || [])){
    const st = settlements.find(x => x.id === rec.id);
    if (!st) continue;
    st.claimed = !!rec.claimed; st.cleared = !!rec.cleared;
    st.blight = rec.blight != null ? rec.blight : st.blight;
  }
  planQuests();
  St.quest = d.quest || { i: 0, done: {} };
  St.contracts = d.contracts || {};
  St.contractSeed = d.contractSeed || 1;
  St.waypoint = d.waypoint || null;
  St.day = d.day || 1;
  St.cycle = d.cycle || 0;
  St.night = St.cycle >= DAY_LEN;
  St.xp = d.xp || 0; St.level = d.level || 1;
  St.kills = d.kills || 0; St.nightsSurvived = d.nights || 0;
  //  Additive, so a save written before the ten existed loads as "none down"
  //  rather than refusing to load at all.
  St.bossIdx = d.bossIdx || 0; St.keystones = d.keystones || 0;
  St.won = !!d.won; St.wonOnDay = d.wonOnDay || 0; St.bossCalled = false;
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
  makeSettlements();
  makeBlockMeshes();
  makeParticles();
  makeGhost();
  makeFocusRing();
  makePlayer();

  S.torch = new THREE.PointLight(0xffc07a, 3.4, 30, 1.6);
  S.torch.visible = false;
  S.world.add(S.torch);

  bakeMap();
  applyQuality(QUALITY.level);
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
  mobs = []; drops = []; projectiles = []; parts = [];
  tiles = new Map(); tileQueue = []; lastTileKey = ''; farDirty = false;
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
    settlements = [];
    buildHeights();
    planQuests();
    Object.assign(St, {
      day: 1, cycle: DAY_LEN * 0.26, night: false, hp: 100, maxHp: 100, stam: 100,
      xp: 0, level: 1, kills: 0, nightsSurvived: 0, combo: 0,
      inv: [], gear: { weapon: null, head: null, chest: null, legs: null },
      res: { earth: 40, timber: 24, stone: 18, ember: 4 },
      kiln: { ring: 0, brazier: 0, height: 0, bench: 0 },
      tools: { axe: 0, pick: 0 },
      quest: { i: 0, done: {} }, contracts: {}, contractSeed: 1, waypoint: null,
      dead: false,
      //  A new world starts the ten over. Forgetting this is how a fresh run
      //  would have opened on the Unmaker.
      bossIdx: 0, bossCalled: false, keystones: 0, won: false, wonOnDay: 0,
    });
    bossRef = null;
    if (hud.win) hud.win.classList.remove('on');
    if (hud.bossbar) hud.bossbar.classList.remove('on');
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
  if (!spine.length) planQuests();
  renderQuestHUD();
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
  //  Mesh the whole window up front, so the first frame is standing on ground
  //  rather than watching it arrive.
  updateStream(true);
  refreshPropWindow();
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

    if (!St.invOpen && !St.benchOpen && !St.mapOpen){
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
      updateStream(false);
      if (propsDirty) refreshPropWindow();
      //  Props re-window on a tile edge, twenty-four metres apart. The tuft
      //  ring is thirty metres across, so on that schedule the far edge would
      //  go bald before it was refilled — it follows the player instead.
      else if (S.grass && QUALITY.grass && (!grassAt ||
               (Pl.pos.x - grassAt.x) ** 2 + (Pl.pos.z - grassAt.z) ** 2 > 20))
        scatterGrass();
      tickFar(dt);
      tickRuins(dt);
      questTick(dt);
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

    updateCompass();
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
    updateStream(false);
    updateSky(dt);
    tickParticles(dt);
  }

  autoQuality(dt);
  renderFrame();
}

// ─── 29 · Mount / unmount ────────────────────────────────────────────────────

function sizeTo(){
  if (!SHW.renderer || !hud.root) return;
  const r = hud.root.getBoundingClientRect();
  const w = Math.max(320, r.width), h = Math.max(240, r.height);
  SHW.renderer.setSize(w, h, false);
  SHW.camera.aspect = w / h;
  SHW.camera.updateProjectionMatrix();
  resizePost();
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
  //  Tone mapping happens in the lens, not here.
  SHW.renderer.toneMapping = THREE.NoToneMapping;
  SHW.renderer.shadowMap.enabled = true;
  SHW.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  SHW.scene = new THREE.Scene();
  SHW.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 700);
  SHW.clock = new THREE.Clock();
  SHW.mounted = true;

  SHW.seed = 'wild-1';
  SHW.noise = makeNoise(hashStr(SHW.seed));
  SHW.moist = makeNoise(hashStr(SHW.seed + '-m'));

  const xl = hud.root.querySelector('#shw-exitlabel');
  if (xl && SHW.opts.exitLabel) xl.textContent = SHW.opts.exitLabel;

  try { initPost(); } catch (e){ console.warn('post off:', e); SHW.post = null; }
  applyQuality('high');

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
  updateStream(true);
  refreshPropWindow();
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
//  The host gets first refusal, and may decline by returning false — which is
//  what a cabinet page does when it cannot reach the city that framed it.
//  Unmounting first and asking afterwards left a blank frame in that case.
function leave(){
  const f = SHW.opts && SHW.opts.onExit;
  if (typeof f === 'function'){
    let handled = true;
    try { handled = f() !== false; } catch (e){ handled = false; }
    if (handled){ unmount(); return; }
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
    const here = St.benchOpen ? null : hereSettlement();
    if (here){
      hud.focus.classList.add('on');
      hud.focusName.textContent = here.name;
      hud.focusYield.textContent = !here.claimed
        ? (here.blight > 0 ? `${here.blight} holding it` : 'cleared · ready to light')
        : here.kind === 'home' ? 'tools · gear · the kiln · work' : 'tools · gear · work';
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
  questEvent('gather', { res: plan.spec.res, n: plan.yield });
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


// ─── 32 · SETTLEMENTS — six more kilns, four of them dead ────────────────────
//  A town is one solid mesh and one glowing mesh, merged at build time. Six
//  settlements of fifteen separate boxes each would be ninety draw calls
//  before a single tree, and the whole reason the world can be nine times
//  bigger is that the draw call budget is spent carefully.

function mergeParts(parts){
  let total = 0;
  const conv = [];
  for (const p of parts){
    const g = (p.g.index ? p.g.toNonIndexed() : p.g.clone());
    g.applyMatrix4(p.m);
    g.computeVertexNormals();
    total += g.attributes.position.count;
    conv.push({ g, c: p.c });
  }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3),
        col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0, o2 = 0;
  for (const { g, c } of conv){
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    const U = g.attributes.uv;
    for (let i = 0; i < g.attributes.position.count; i++){
      pos[o] = P[i*3]; pos[o+1] = P[i*3+1]; pos[o+2] = P[i*3+2];
      nor[o] = N[i*3]; nor[o+1] = N[i*3+1]; nor[o+2] = N[i*3+2];
      col[o] = c.r; col[o+1] = c.g; col[o+2] = c.b;
      uv[o2] = U ? U.array[i*2] : 0; uv[o2+1] = U ? U.array[i*2+1] : 0;
      o += 3; o2 += 2;
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal',   new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  out.setAttribute('uv',       new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

const _mm = new THREE.Matrix4(), _me = new THREE.Euler(), _mq = new THREE.Quaternion();
function partAt(g, x, y, z, ry, sx, sy, sz, hex, into){
  _me.set(0, ry || 0, 0); _mq.setFromEuler(_me);
  _mm.compose(new THREE.Vector3(x, y, z), _mq,
              new THREE.Vector3(sx || 1, sy || 1, sz || 1));
  into.push({ g, m: _mm.clone(), c: new THREE.Color(hex) });
}

function buildSettlementMeshes(st){
  //  Throw away whatever was there: relighting rebuilds the place.
  if (st.group){
    S.world.remove(st.group);
    disposeTree(st.group);
  }
  const grp = new THREE.Group();
  const solid = [], glow = [];
  const lit = st.claimed;
  const y0 = st.y0;
  //  Rough bounding blobs, kept so the third-person camera does not park
  //  itself inside a hut. Trees and boulders were handled; buildings were
  //  not, and a town is the one place you are guaranteed to be surrounded.
  st.solids = [{ x: st.x, y: y0 + 4.0, z: st.z, r: 4.6 }];

  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
  const CONE = new THREE.ConeGeometry(1, 1, 8);

  const wall  = lit ? 0xb5603c : 0x8d6a5c;
  const trim  = lit ? 0xe0e4ec : 0xa8a5ac;
  const roof  = lit ? 0x3f4a6b : 0x4a4f60;
  const thatch= lit ? 0xd9b455 : 0x8f8066;

  //  The town's own kiln: smaller than home's, same silhouette, so the shape
  //  reads as "one of these" from a ridge two hundred metres away.
  partAt(CYL,  st.x, y0 + 0.4, st.z, 0, 6.4, 0.9, 6.4, wall, solid);
  partAt(CYL,  st.x, y0 + 3.0, st.z, 0, 3.6, 5.0, 3.6, wall, solid);
  partAt(CYL,  st.x, y0 + 4.6, st.z, 0, 3.8, 0.4, 3.8, trim, solid);
  partAt(CONE, st.x, y0 + 7.2, st.z, 0, 4.4, 3.4, 4.4, roof, solid);
  partAt(CYL,  st.x, y0 + 9.4, st.z, 0, 0.5, 1.8, 0.5, trim, solid);
  //  The mouth, and the fire in it if it is lit.
  partAt(BOX,  st.x, y0 + 1.8, st.z + 3.4, 0, 2.0, 2.0, 0.6, roof, solid);
  if (lit){
    const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0),
      new THREE.MeshBasicMaterial({ color: 0xffc65a }));
    fire.position.set(st.x, y0 + 1.5, st.z + 3.0);
    grp.add(fire);
    st.fire = fire;
    const l = new THREE.PointLight(0xffa83d, 2.6, 34, 1.6);
    l.position.set(st.x, y0 + 2.4, st.z + 2.6);
    grp.add(l);
    st.light = l;
  } else {
    st.fire = null; st.light = null;
    //  A cold kiln leans. Rubble around the mouth, and a crack up the drum.
    partAt(BOX, st.x + 2.2, y0 + 0.4, st.z + 3.6, 0.6, 1.6, 0.8, 1.4, wall, solid);
    partAt(BOX, st.x - 2.6, y0 + 0.3, st.z + 2.8, 1.2, 1.2, 0.6, 1.8, wall, solid);
  }

  //  Huts around it. A town has more and they are whole; a ruin has fewer and
  //  they are open to the sky.
  const rnd = mulberry(hashStr(st.id + SHW.seed));
  const huts = st.kind === 'town' ? 6 : 3;
  for (let i = 0; i < huts; i++){
    const a = (i / huts) * 6.2832 + rnd() * 0.5;
    const r = 8.5 + rnd() * 3.5;
    const hx = st.x + Math.cos(a) * r, hz = st.z + Math.sin(a) * r;
    const w = 2.6 + rnd() * 1.4, dp = 2.4 + rnd() * 1.2, hh = 2.2 + rnd() * 0.8;
    partAt(BOX, hx, y0 + hh / 2, hz, -a, w, hh, dp, wall, solid);
    st.solids.push({ x: hx, y: y0 + hh / 2, z: hz, r: Math.max(w, dp) * 0.62 });
    if (lit){
      partAt(CONE, hx, y0 + hh + 0.8, hz, -a, w * 0.85, 1.6, dp * 0.85, thatch, solid);
      partAt(BOX, hx + Math.cos(a) * w * 0.5, y0 + 0.9, hz + Math.sin(a) * dp * 0.5,
             -a, 0.7, 1.5, 0.12, roof, solid);
    } else {
      //  Half a roof, fallen in.
      partAt(BOX, hx - 0.4, y0 + hh + 0.2, hz, -a + 0.4, w * 0.7, 0.25, dp * 0.6, thatch, solid);
    }
  }

  //  Braziers on the ring. Lit ones glow; a ruin's are cold stumps.
  st.bowls = [];
  const bn = 6;
  for (let i = 0; i < bn; i++){
    const a = (i / bn) * 6.2832;
    const bx = st.x + Math.cos(a) * (st.ring - 1.4);
    const bz = st.z + Math.sin(a) * (st.ring - 1.4);
    partAt(BOX, bx, y0 + 1.0, bz, 0, 0.5, 2.0, 0.5, trim, solid);
    if (lit){
      const bowl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.44, 0),
        new THREE.MeshBasicMaterial({ color: 0xffc65a }));
      bowl.position.set(bx, y0 + 2.2, bz);
      grp.add(bowl); st.bowls.push(bowl);
    }
  }

  //  The bench, which is what E talks to.
  partAt(BOX, st.x - 5.4, y0 + 0.5, st.z + 3.0, 0.5, 2.4, 1.0, 1.1, trim, solid);
  st.bench = new THREE.Vector3(st.x - 5.4, y0 + 0.5, st.z + 3.0);

  const g = mergeParts(solid);
  grp.add(new THREE.Mesh(g, clayMat({ rep: 2, mat: { vertexColors: true } })));

  //  The protected-ground ring, dashed and red while the place is dead.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(st.ring - 0.35, st.ring, 64),
    new THREE.MeshBasicMaterial({
      color: lit ? 0xffc65a : 0xff5268, transparent: true,
      opacity: lit ? 0.45 : 0.28, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(st.x, y0 + 0.08, st.z);
  grp.add(ring);
  st.ringMesh = ring;

  shadowize(grp);
  S.world.add(grp);
  st.group = grp;
}

function makeSettlements(){
  for (const st of settlements){
    if (st.kind === 'home') continue;     // the home Kiln has its own builder
    buildSettlementMeshes(st);
  }
}

//  Ruins hold a blight: monsters that do not burn at dawn, so a ruin can be
//  cleared in daylight rather than only being a night problem you cannot
//  schedule.
function spawnAtRuin(st){
  const a = Math.random() * 6.2832;
  const r = st.ring * 0.55 + Math.random() * st.ring * 0.5;
  const x = st.x + Math.cos(a) * r, z = st.z + Math.sin(a) * r;
  const roll = Math.random();
  const kind = roll < 0.42 ? 'husk' : roll < 0.72 ? 'stalker'
             : roll < 0.90 ? 'lumber' : 'molder';
  const m = makeMob(kind, x, z);
  m.ruin = st;
  //  Blighted things are marked, so the player can tell what is holding the
  //  ruin from what merely wandered in.
  //  Recoloured, not replaced: swapping the material orphaned the old one.
  m.seam.material.color.setHex(0x9d4bff);
  return m;
}

function tickRuins(dt){
  for (const st of settlements){
    if (st.claimed) continue;
    const d = Math.hypot(Pl.pos.x - st.x, Pl.pos.z - st.z);
    if (d > 75) continue;
    const alive = mobs.reduce((n, m) => n + (!m.dead && m.ruin === st ? 1 : 0), 0);
    st.spawnT = (st.spawnT || 0) - dt;
    if (st.blight > 0 && alive < 4 && st.spawnT <= 0){
      st.spawnT = 2.6;
      spawnAtRuin(st);
    }
  }
}

function relightCost(st){
  return { ember: 18, timber: 45, stone: 45 };
}

function tryRelight(st){
  if (st.claimed) return;
  if (st.blight > 0){
    toast(`${st.name} is still held. ${st.blight} left.`, '#ff5268');
    return;
  }
  const cost = relightCost(st);
  if (!canAfford(cost)){
    toast(`Relighting ${st.name} needs ${costLine(cost)}.`, '#ff5268');
    return;
  }
  spend(cost);
  st.claimed = true; st.cleared = true;
  buildSettlementMeshes(st);
  banner(st.name, 'lit');
  toast(`${st.name} is yours. Its ring holds now.`, '#7dffb3');
  St.shake = Math.max(St.shake, 0.4);
  burst(st.x, st.y0 + 2, st.z + 3, 26, 0xffc65a, 9);
  St.dirty = true;
  questEvent('claim', st.id);
  drawMap();
}

//  Standing at a settlement: which one, and what can be done here.
function hereSettlement(){
  for (const st of settlements){
    const b = st.kind === 'home' ? S.bench : st.bench;
    if (!b) continue;
    if (Math.hypot(Pl.pos.x - b.x, Pl.pos.z - b.z) < 4.6) return st;
  }
  //  At a dead kiln you stand at the mouth, not at a bench.
  for (const st of settlements){
    if (st.claimed) continue;
    if (Math.hypot(Pl.pos.x - st.x, Pl.pos.z - st.z) < st.ring * 0.9) return st;
  }
  return null;
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

function toggleBench(force, site){
  const want = force === undefined ? !St.benchOpen : !!force;
  if (want){
    const st = site || hereSettlement();
    if (!st){ toast('Stand at a bench.', '#9c93c6'); return; }
    St.benchSite = st;
  }
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
  questEvent('tool', which);
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
  questEvent('kiln', key);
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

  const site = St.benchSite || settlements[0];
  const head = hud.benchBody.parentElement.querySelector('#shw-benchhead h3');
  if (head) head.textContent = site.name;
  const sub = hud.benchBody.parentElement.querySelector('#shw-benchhead p');
  if (sub) sub.textContent = site.kind === 'home' ? 'the kiln'
          : site.claimed ? 'a lit settlement' : 'cold';

  //  A dead kiln has one thing to offer and it is not a shopping list.
  if (!site.claimed){
    const cost = relightCost(site);
    const held = site.blight > 0;
    hud.benchBody.innerHTML = `<section><h4>${site.name}</h4>
      <button class="shw-craft${held || !canAfford(cost) ? ' off' : ''}" data-do="relight">
        <b>Relight the kiln</b>
        <span>${held
          ? `Something blighted is still holding it. ${site.blight} left, and daylight will not shift them.`
          : 'Cleared. Feed it and the ring is yours: safe ground, a bench, and somewhere to wake up.'}</span>
        ${chip(cost)}</button>
      </section>`;
    hud.benchRes.textContent =
      `${Math.floor(res.earth)} earth · ${Math.floor(res.timber)} timber · ` +
      `${Math.floor(res.stone)} stone · ${Math.floor(res.ember)} ember`;
    hud.benchBody.querySelectorAll('.shw-craft').forEach(el => {
      el.onclick = () => { tryRelight(site); if (site.claimed) renderBench(); };
    });
    return;
  }

  //  Contracts, at any lit settlement including home.
  let work = '';
  for (const c of contractsFor(site)){
    const done = c.taken && c.have >= c.need;
    work += `<button class="shw-craft" data-do="${done ? 'turn' : 'take'}:${c.id}">
      <b>${c.text}</b>
      <span>${!c.taken ? 'Open. Take it and it tracks itself.'
              : done ? 'Finished. Take it back for the pay.'
              : `${c.have} of ${c.need} so far.`}</span>
      <em class="${done ? '' : 'no'}">${costLine(c.reward)}</em>
      ${c.taken && !done ? '<u>in hand</u>' : ''}</button>`;
  }

  //  The Ten, as a list you can actually read: what is down, what is next,
  //  and nothing at all about the ones you have not met.
  let ten = '';
  for (let i = 0; i < BOSSES.length; i++){
    const B = BOSSES[i];
    const down = i < St.bossIdx;
    const next = i === St.bossIdx;
    const name = (down || next) ? B.name : '· · · · ·';
    const note = down ? 'down'
               : next ? (St.day < 2 ? 'comes on the second night'
                                    : 'comes tonight, past the middle of it')
               : 'not yet';
    ten += `<button class="shw-craft${down ? '' : ' off'}"><b>${i + 1}. ${name}</b>
      <span>${down ? B.line : (next ? B.line : 'Kill the one before it.')}</span>
      <em class="${down ? '' : 'no'}">${note}</em></button>`;
  }
  const tenHead = St.won
    ? `The Ten · all down on night ${St.wonOnDay}`
    : `The Ten · ${St.bossIdx} of ${BOSSES.length}`;

  hud.benchBody.innerHTML =
    `<section><h4>Tools</h4>${tools}</section>` +
    `<section><h4>Gear</h4>${gear}
      <button class="shw-craft" data-do="scrap"><b>Scrap spares</b>
        <span>Everything not worn, melted down for ember.</span>
        <em>${St.inv.length} spare</em></button>
    </section>` +
    (site.kind === 'home'
      ? `<section><h4>The Kiln</h4>${kiln}</section>`
      : `<section><h4>Work</h4>${work}</section>`) +
    (site.kind === 'home' ? `<section><h4>Work</h4>${work}</section>` : '') +
    `<section><h4>${tenHead}</h4>${ten}</section>`;

  hud.benchRes.textContent =
    `${Math.floor(res.earth)} earth · ${Math.floor(res.timber)} timber · ` +
    `${Math.floor(res.stone)} stone · ${Math.floor(res.ember)} ember`;

  hud.benchBody.querySelectorAll('.shw-craft').forEach(el => {
    el.onclick = () => {
      const d = el.dataset.do;
      if (!d) return;
      if (d === 'scrap'){ scrapAll(); renderBench(); return; }
      const i = d.indexOf(':');
      const what = d.slice(0, i), arg = d.slice(i + 1);
      if (what === 'tool') craftTool(arg);
      else if (what === 'gear') upgradeGear(arg);
      else if (what === 'kiln') upgradeKiln(arg);
      else if (what === 'take' || what === 'turn'){
        const c = Object.values(St.contracts).flat().find(x => x.id === arg);
        if (c) (what === 'take' ? takeContract : turnInContract)(c);
      }
    };
  });
}


// ─── 35 · THE PICTURE — light, shadow, and a lens to look through it ─────────
//  Everything up to here was flat-shaded clay with no shadows, no specular, no
//  post. That reads as a toy: a shape lit evenly from nowhere has no weight and
//  no time of day. Three things fix it, none of which need an asset file.
//
//    · a sun that actually casts, on a tight box that follows the player
//    · a rim light injected into the clay shader, so every silhouette separates
//      from whatever is behind it
//    · and a lens: the scene renders into a buffer, the bright parts bloom, and
//      a filmic curve, a grade, a vignette and grain are applied in one pass
//
//  All of it scales off one quality flag, because this has to run in an arcade
//  cabinet inside a web page as well as on a real machine.

const QUALITY = { level: 'high', shadows: true, bloom: true, grass: true, shadowSize: 2048 };

function applyQuality(level){
  QUALITY.level = level;
  QUALITY.shadows = level === 'high';
  QUALITY.bloom   = level !== 'low';
  QUALITY.grass   = level === 'high';
  QUALITY.shadowSize = level === 'high' ? 2048 : 1024;

  if (SHW.renderer){
    SHW.renderer.shadowMap.enabled = QUALITY.shadows;
    SHW.renderer.shadowMap.needsUpdate = true;
  }
  if (S.sun) S.sun.castShadow = QUALITY.shadows;
  if (S.grass) S.grass.visible = QUALITY.grass;
  if (hud.root) hud.root.classList.toggle('lowfx', level === 'low');
  //  The film grain and vignette are done in the lens now; the old CSS layers
  //  would double them.
  if (hud.root) hud.root.classList.toggle('haspost', !!SHW.post);
}

//  Anything unlit (a fire, a ring on the ground, a marker) must not cast: a
//  flame throwing a shadow is the single most obvious tell that a renderer is
//  being naive.
function shadowize(root, castToo){
  if (!root) return root;
  root.traverse(o => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    const m = o.material;
    const unlit = m && (m.isMeshBasicMaterial || m.transparent && m.opacity < 0.9);
    o.castShadow = castToo !== false && !unlit;
    o.receiveShadow = !unlit;
  });
  return root;
}

function initShadows(){
  const r = SHW.renderer;
  r.shadowMap.enabled = QUALITY.shadows;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  if (!S.sun) return;
  S.sun.castShadow = QUALITY.shadows;
  const sh = S.sun.shadow;
  sh.mapSize.set(QUALITY.shadowSize, QUALITY.shadowSize);
  //  A tight box around the player rather than the whole 576m world: at 2048
  //  across 180m that is nine centimetres a texel, which is enough to see the
  //  shadow of a fence post.
  const d = 88;
  sh.camera.left = -d; sh.camera.right = d;
  sh.camera.top = d;   sh.camera.bottom = -d;
  sh.camera.near = 1;  sh.camera.far = 420;
  sh.bias = -0.0006;
  sh.normalBias = 0.55;
  sh.camera.updateProjectionMatrix();
}

//  Rim light, injected into the clay shader. One shared program for every clay
//  material, or each of the forty-odd would compile its own.
const RIM = { color: new THREE.Color(0x9ec4ff), power: 3.4, strength: 0.20 };
function withRim(mat){
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.rimColor = { value: RIM.color };
    sh.uniforms.rimPower = { value: RIM.power };
    sh.uniforms.rimStrength = { value: RIM.strength };
    mat.userData.sh = sh;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',
        '#include <common>\nuniform vec3 rimColor;uniform float rimPower;uniform float rimStrength;')
      .replace('#include <dithering_fragment>', `
        #include <dithering_fragment>
        {
          vec3 vd = normalize( vViewPosition );
          float rimF = pow( 1.0 - clamp( dot( normal, vd ), 0.0, 1.0 ), rimPower );
          gl_FragColor.rgb += rimColor * rimF * rimStrength;
        }`);
  };
  mat.customProgramCacheKey = () => 'clay-rim';
  return mat;
}


// ─── 37 · THE TEN — a named thing walks in, and one night it is the last ─────
//
//  The night wave was endless and therefore weightless: no matter how well a
//  night went, the next one was the same night. So there is now a spine of ten
//  named bosses through it. One walks in per night, starting on the second,
//  and only once the one before it is dead — so falling behind slows the story
//  down rather than stacking two of them on you.
//
//  Every one of them is the same armature and the same code path as an
//  ordinary corpse, with its own numbers laid over the top and one behaviour
//  that nothing else in the game does. That is deliberate: a boss built out of
//  a separate system is a boss that breaks every time the shared one changes.
//
//  Kill the tenth and the Kiln finishes lighting. The world stays afterwards —
//  the nights keep coming, the ten just stop.

const BOSSES = [
  { key:'warden', name:'THE MARROW WARDEN', title:'first of the ten',
    kind:'husk', scale:2.05, hp:360, dmg:24, spd:2.0, r:1.1,
    col:0x9aa07a, eye:0xff7a4f, spark:0xffa24f, trait:'summon',
    line:'It carries the others in it.' },

  { key:'gravelash', name:'GRAVELASH', title:'second of the ten',
    kind:'stalker', scale:1.70, hp:430, dmg:20, spd:5.2, r:0.9,
    col:0xbfa07c, eye:0xfff06b, spark:0xffe14f, trait:'lunge',
    line:'It was fast before. It is faster now.' },

  { key:'priest', name:'THE LUMBER PRIEST', title:'third of the ten',
    kind:'lumber', scale:1.95, hp:640, dmg:32, spd:1.9, r:1.3,
    col:0x7d9296, eye:0xffb84f, spark:0x6fd0ff, trait:'ward',
    line:'Something is holding the blows off it. Wait for the light to drop.' },

  { key:'choir', name:'THE EMBERCHOIR', title:'fourth of the ten',
    kind:'wisp', scale:1.75, hp:520, dmg:18, spd:3.4, r:0.9,
    col:0xc0a074, eye:0xffd76b, spark:0xff9a3d, trait:'volley',
    line:'It does not come to you. It does not have to.' },

  { key:'bell', name:'THE HOLLOW BELL', title:'fifth of the ten',
    kind:'wraith', scale:1.95, hp:700, dmg:26, spd:3.6, r:1.0,
    col:0xd2e0e8, eye:0x9ff0ff, spark:0xbfe9ff, trait:'blink',
    line:'It is not always where you last put your eyes.' },

  { key:'moonjaw', name:'MOONJAW', title:'sixth of the ten',
    kind:'wolf', scale:1.85, hp:820, dmg:34, spd:5.8, r:1.1,
    col:0xa98a63, eye:0xffe24f, spark:0xffb23d, trait:'howl',
    line:'It is calling the rest of them in.' },

  { key:'king', name:'THE MOLDER KING', title:'seventh of the ten',
    kind:'molder', scale:2.30, hp:1150, dmg:44, spd:1.5, r:1.8,
    col:0x7d876a, eye:0xff2f4f, spark:0xff2f4f, trait:'slam',
    line:'Do not be standing on the ground when it lands.' },

  { key:'choirmaster', name:'THE ASHEN CHOIRMASTER', title:'eighth of the ten',
    kind:'wisp', scale:2.10, hp:980, dmg:24, spd:3.8, r:1.0,
    col:0xb4a888, eye:0xfff3c0, spark:0xffd76b, trait:'swarm',
    line:'It is making more of them faster than you are killing them.' },

  { key:'twins', name:'THE PALE TWINS', title:'ninth of the ten',
    kind:'stalker', scale:1.95, hp:1240, dmg:30, spd:4.6, r:1.0,
    col:0xd8cbb0, eye:0xffffff, spark:0xffd0e4, trait:'twin',
    line:'Two bodies. One life between them. Hurting either hurts both.' },

  { key:'unmaker', name:'THE UNMAKER', title:'last of the ten',
    kind:'molder', scale:2.70, hp:2200, dmg:52, spd:1.9, r:2.1,
    col:0x4c4440, eye:0xff2f4f, spark:0xff2f4f, trait:'unmaker',
    line:'This is the one the Kiln was built against.' },
];

//  Minions a summoner calls, by boss.
const BOSS_MINIONS = {
  warden: ['husk', 'husk', 'stalker'],
  moonjaw: ['wolf', 'wolf'],
  swarm: ['wisp', 'wisp'],
  unmaker: ['molder', 'wraith', 'wolf'],
};

let bossRef = null;

function bossDef(i){ return BOSSES[i] || null; }

//  Where it comes in from: outside the ring the player is standing in, but
//  close enough that they know immediately.
function bossArrivalSpot(){
  for (let tries = 0; tries < 40; tries++){
    const a = Math.random() * 6.2832;
    const d = 20 + Math.random() * 10;
    const x = Pl.pos.x + Math.cos(a) * d;
    const z = Pl.pos.z + Math.sin(a) * d;
    if (Math.abs(x) > HALF - 8 || Math.abs(z) > HALF - 8) continue;
    if (groundY(x, z) < WATER_Y + 0.4) continue;
    return { x, z };
  }
  return { x: Pl.pos.x + 18, z: Pl.pos.z };
}

function spawnBoss(i, at){
  const B = bossDef(i);
  if (!B) return null;
  const spot = at || bossArrivalSpot();
  const base = MOBS[B.kind];
  const m = makeMob(B.kind, spot.x, spot.z, {
    def: { name: B.name, hp: B.hp, spd: B.spd, dmg: B.dmg, r: B.r,
           h: base.h * (B.scale / (BODY[B.kind] || BODY.husk).scale) * 0.62 + base.h * 0.38,
           col: B.col, eye: B.eye, spark: B.spark, tier: 4 },
    B: { scale: B.scale },
  });
  m.boss = B;
  m.bossIdx = i;
  m.bt = 3.0;                       // first special is never instant
  m.ward = 0;
  //  It does not burn at dawn. A boss you can out-wait is not a boss.
  m.ruin = m.ruin || {};
  return m;
}

//  Called every frame of every night.
function tickBossCall(dt){
  if (St.bossIdx >= BOSSES.length) return;
  if (!St.night){ St.bossCalled = false; return; }
  //  A third of the way into the night, so there is time to be caught out in
  //  the open and time to get back if you are not.
  if (St.cycle < DAY_LEN + (CYCLE - DAY_LEN) * 0.30) return;
  if (St.day < 2) return;
  if (St.bossCalled) return;
  if (bossRef && !bossRef.dead) return;

  St.bossCalled = true;
  const B = bossDef(St.bossIdx);
  bossRef = spawnBoss(St.bossIdx);
  if (!bossRef){ St.bossCalled = false; return; }

  //  The ninth is two bodies on one life. The twin is an ordinary spawn with a
  //  back-reference, so every existing damage path already works on it.
  if (B.trait === 'twin'){
    const t = spawnBoss(St.bossIdx, { x: bossRef.x + 4, z: bossRef.z + 2 });
    if (t){
      t.twinOf = bossRef; bossRef.twin = t;
      t.isTwinBody = true;                 // does not get its own health bar
    }
  }

  banner(B.name, B.title);
  toast(B.line, '#ff8a5c');
  St.shake = Math.max(St.shake, 0.8);
  flash(0.32);
  save();
}

//  One behaviour each. Kept small on purpose: a boss the player can read in
//  four seconds and beat in forty is better than one with a hidden rulebook.
function tickBoss(m, dt, distToPlayer){
  const B = m.boss;
  m.bt -= dt;

  if (B.trait === 'ward'){
    //  Four seconds open, three seconds shut, and it says which out loud by
    //  glowing. Damage is scaled where it is taken, in hurtMob.
    m.ward = (m.ward || 0) - dt;
    if (m.ward <= -4.0) m.ward = 3.0;
    const shut = m.ward > 0;
    if (m.ember) m.ember.color.setHex(shut ? 0x9fe6ff : B.eye);
    if (m.glow)  m.glow.color.setHex(shut ? 0x9fe6ff : B.eye);
  }

  if (m.bt > 0) return;

  switch (B.trait){
    case 'summon': {
      m.bt = 6.5;
      for (const k of BOSS_MINIONS.warden){
        const a = Math.random() * 6.2832;
        makeMob(k, m.x + Math.cos(a) * 4, m.z + Math.sin(a) * 4);
      }
      burst(m.x, m.y + 2, m.z, 18, B.spark, 7);
      toast('The Warden opens.', '#ffa24f');
      break;
    }
    case 'lunge': {
      m.bt = 3.4;
      m.dash = 0.55;                       // read in tickMobs as a speed burst
      burst(m.x, m.y + 1.4, m.z, 8, B.spark, 6);
      break;
    }
    case 'volley': {
      m.bt = 3.8;
      m.volley = 3;                        // three spits, spat in tickMobs
      m.volleyT = 0;
      break;
    }
    case 'blink': {
      m.bt = 4.6;
      burst(m.x, m.y + 1.6, m.z, 14, B.spark, 6);
      const a = Math.random() * 6.2832;
      m.x = Pl.pos.x + Math.cos(a) * 6.5;
      m.z = Pl.pos.z + Math.sin(a) * 6.5;
      m.y = groundY(m.x, m.z);
      burst(m.x, m.y + 1.6, m.z, 14, B.spark, 6);
      break;
    }
    case 'howl': {
      m.bt = 9.0;
      for (const k of BOSS_MINIONS.moonjaw){
        const a = Math.random() * 6.2832;
        makeMob(k, m.x + Math.cos(a) * 5, m.z + Math.sin(a) * 5);
      }
      m.dash = 0.8;
      St.shake = Math.max(St.shake, 0.5);
      toast('Moonjaw howls. Something answers.', '#ffe24f');
      break;
    }
    case 'slam': {
      m.bt = 4.2;
      if (distToPlayer < 14){
        bossSlam(m, 9.0, B.dmg * 0.8);
      }
      break;
    }
    case 'swarm': {
      m.bt = 3.2;
      for (const k of BOSS_MINIONS.swarm){
        const a = Math.random() * 6.2832;
        makeMob(k, m.x + Math.cos(a) * 5, m.z + Math.sin(a) * 5);
      }
      break;
    }
    case 'twin': {
      m.bt = 3.0;
      m.dash = 0.45;
      break;
    }
    case 'unmaker': {
      //  Everything, in a rotation, so the last fight is a recap of the nine.
      m.phaseN = ((m.phaseN || 0) + 1) % 4;
      m.bt = 4.0;
      if (m.phaseN === 0){
        bossSlam(m, 11.0, B.dmg * 0.7);
      } else if (m.phaseN === 1){
        for (const k of BOSS_MINIONS.unmaker){
          const a = Math.random() * 6.2832;
          makeMob(k, m.x + Math.cos(a) * 6, m.z + Math.sin(a) * 6);
        }
        burst(m.x, m.y + 3, m.z, 22, B.spark, 8);
      } else if (m.phaseN === 2){
        const a = Math.random() * 6.2832;
        burst(m.x, m.y + 2.4, m.z, 16, B.spark, 7);
        m.x = Pl.pos.x + Math.cos(a) * 7;
        m.z = Pl.pos.z + Math.sin(a) * 7;
        m.y = groundY(m.x, m.z);
        burst(m.x, m.y + 2.4, m.z, 16, B.spark, 7);
      } else {
        m.volley = 4; m.volleyT = 0;
      }
      break;
    }
    default: m.bt = 5;
  }
}

//  A ring of ground going up, and anything standing in it taking it.
function bossSlam(m, radius, dmg){
  St.shake = Math.max(St.shake, 0.75);
  for (let i = 0; i < 26; i++){
    const a = (i / 26) * 6.2832;
    burst(m.x + Math.cos(a) * radius * 0.8, m.y + 0.3, m.z + Math.sin(a) * radius * 0.8,
          2, m.boss.spark, 6);
  }
  const d = Math.hypot(Pl.pos.x - m.x, Pl.pos.z - m.z);
  if (d < radius){
    hurtPlayer(dmg);
    //  Thrown clear, which is the point: it makes space it can then close.
    const ox = (Pl.pos.x - m.x) / (d || 1), oz = (Pl.pos.z - m.z) / (d || 1);
    Pl.vel.x += ox * 14; Pl.vel.z += oz * 14; Pl.vel.y = Math.max(Pl.vel.y, 6);
  }
}

//  Ten keystones, one per boss, and the tenth finishes the Kiln.
function bossDown(m){
  const B = m.boss;
  //  The twin body is not its own kill. If it is the one that went down, the
  //  other half goes with it and THAT is the kill that counts — otherwise the
  //  pair could be left with one dead body and one standing on zero life.
  if (m.isTwinBody){
    const p = m.twinOf;
    if (p && !p.dead){ p.hp = 0; killMob(p); }
    return;
  }
  if (m.bossIdx !== St.bossIdx) return;    // already counted

  St.bossIdx++;
  St.keystones = (St.keystones || 0) + 1;
  St.bossCalled = false;
  bossRef = null;

  //  Kill the other half with it.
  if (m.twin && !m.twin.dead){ m.twin.hp = 0; killMob(m.twin); }

  St.xp += 260;
  St.res.ember += 14;
  for (let i = 0; i < 3; i++)
    dropLoot(m.g.position.x + (i - 1) * 1.4, m.g.position.y, m.g.position.z, 4);

  if (St.bossIdx >= BOSSES.length){
    winRun();
  } else {
    banner(B.name, 'down · ' + St.bossIdx + ' of ' + BOSSES.length);
    toast(`${St.bossIdx} of ${BOSSES.length}. The Kiln burns brighter.`, '#7dffb3');
  }
  recomputeStats();
  save();
}

//  The ending. Not a door closing: the ten stop coming, the Kiln finishes
//  lighting, and the world you spent all that time changing is still there.
function winRun(){
  St.won = true;
  St.wonOnDay = St.day;
  St.shake = Math.max(St.shake, 1.2);
  flash(0.9);
  //  Everything still standing goes with it.
  for (const m of mobs.slice()) if (!m.dead) killMob(m);
  if (hud.win){
    hud.win.querySelector('#shw-win-sub').textContent =
      'ten down · night ' + St.day + ' · ' + St.kills + ' put back in the ground';
    hud.win.classList.add('on');
  }
  save();
}

function closeWin(){ if (hud.win) hud.win.classList.remove('on'); }

//  The bar over the top of the screen while one of them is up.
function updateBossBar(){
  if (!hud.bossbar) return;
  let b = null;
  for (const m of mobs) if (m.boss && !m.dead && !m.isTwinBody){ b = m; break; }
  if (!b){ hud.bossbar.classList.remove('on'); return; }
  //  The ninth shares a life across two bodies, so show the pair.
  let hp = b.hp, max = b.maxHp;
  if (b.twin && !b.twin.dead){ hp += b.twin.hp; max += b.twin.maxHp; }
  hud.bossbar.classList.add('on');
  hud.bossName.textContent = b.boss.name;
  hud.bossNo.textContent = (b.bossIdx + 1) + ' / ' + BOSSES.length;
  hud.bossFill.style.width = Math.max(0, (hp / max) * 100) + '%';
  hud.bossbar.classList.toggle('warded', (b.ward || 0) > 0);
}

// ─── The lens ───────────────────────────────────────────────────────────────

const POST_VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }
`;

const BRIGHT_FRAG = `
  uniform sampler2D tScene; uniform float threshold; varying vec2 vUv;
  void main(){
    vec3 c = texture2D( tScene, vUv ).rgb;
    float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
    float k = max( 0.0, l - threshold ) / max( l, 0.0001 );
    gl_FragColor = vec4( c * k, 1.0 );
  }
`;

const BLUR_FRAG = `
  uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
  void main(){
    vec4 s = texture2D( tIn, vUv ) * 0.2270270270;
    s += texture2D( tIn, vUv + dir * 1.3846153846 ) * 0.3162162162;
    s += texture2D( tIn, vUv - dir * 1.3846153846 ) * 0.3162162162;
    s += texture2D( tIn, vUv + dir * 3.2307692308 ) * 0.0702702703;
    s += texture2D( tIn, vUv - dir * 3.2307692308 ) * 0.0702702703;
    gl_FragColor = s;
  }
`;

//  Composite, tone map, grade, vignette, grain, and a touch of lens colour at
//  the edges. This is the whole "artistic" pass in one shader.
const FINAL_FRAG = `
  uniform sampler2D tScene, tBloom;
  uniform float bloomAmt, exposure, time, grain, vignette, aberration, night;
  varying vec2 vUv;

  vec3 aces( vec3 x ){
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp( ( x * ( a * x + b ) ) / ( x * ( c * x + d ) + e ), 0.0, 1.0 );
  }
  float hash( vec2 p ){ return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }

  void main(){
    vec2 uv = vUv;
    vec2 off = ( uv - 0.5 );
    float r2 = dot( off, off );

    //  Chromatic aberration: the lens is not perfect, and the corners say so.
    float ab = aberration * r2;
    vec3 col;
    col.r = texture2D( tScene, uv - off * ab ).r;
    col.g = texture2D( tScene, uv ).g;
    col.b = texture2D( tScene, uv + off * ab ).b;

    col += texture2D( tBloom, uv ).rgb * bloomAmt;
    col *= exposure;
    col = aces( col );

    //  Grade: cool the shadows, warm the highlights, and lift a little at
    //  night so the dark reads as blue rather than as nothing.
    float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
    vec3 shadowTint = mix( vec3( 0.86, 0.92, 1.10 ), vec3( 0.80, 0.88, 1.22 ), night );
    vec3 highTint   = vec3( 1.06, 1.01, 0.94 );
    col *= mix( shadowTint, highTint, smoothstep( 0.12, 0.75, l ) );
    col += vec3( 0.010, 0.016, 0.036 ) * night;

    //  Slight saturation push, because clay wants colour.
    float g = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
    col = mix( vec3( g ), col, 1.14 );

    col = clamp( col, 0.0, 1.0 );

    //  A raw ShaderMaterial does not get three's colour-space conversion, so
    //  this encodes to sRGB itself. Without it the whole picture is linear
    //  values shown as if they were sRGB, which reads dark and muddy.
    col = mix( col * 12.92,
               1.055 * pow( max( col, vec3( 0.0031308 ) ), vec3( 1.0 / 2.4 ) ) - 0.055,
               step( vec3( 0.0031308 ), col ) );

    //  Vignette and grain belong AFTER the encode, in display space. Applied
    //  in linear they crush the shadows and the noise swamps everything dark,
    //  which is what the first pass did.
    col *= 1.0 - vignette * r2 * 1.45;
    float n = hash( uv * 1024.0 + floor( time * 12.0 ) * 37.0 ) - 0.5;
    col += n * grain;

    gl_FragColor = vec4( clamp( col, 0.0, 1.0 ), 1.0 );
  }
`;

function initPost(){
  const r = SHW.renderer;
  const half = THREE.HalfFloatType;
  const opts = { type: half, depthBuffer: true, stencilBuffer: false };
  const size = new THREE.Vector2();
  r.getDrawingBufferSize(size);

  const P = {};
  P.scene  = new THREE.WebGLRenderTarget(size.x, size.y, opts);
  P.bright = new THREE.WebGLRenderTarget(size.x >> 1, size.y >> 1, { type: half, depthBuffer: false });
  P.blurA  = new THREE.WebGLRenderTarget(size.x >> 1, size.y >> 1, { type: half, depthBuffer: false });
  P.blurB  = new THREE.WebGLRenderTarget(size.x >> 1, size.y >> 1, { type: half, depthBuffer: false });

  P.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  P.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  P.stage = new THREE.Scene();
  P.stage.add(P.quad);

  P.mBright = new THREE.ShaderMaterial({
    vertexShader: POST_VERT, fragmentShader: BRIGHT_FRAG,
    //  Only what is genuinely brighter than the scene should bloom: a low
    //  threshold turns the whole frame into haze, which is what it did.
    uniforms: { tScene: { value: null }, threshold: { value: 1.05 } },
  });
  P.mBlur = new THREE.ShaderMaterial({
    vertexShader: POST_VERT, fragmentShader: BLUR_FRAG,
    uniforms: { tIn: { value: null }, dir: { value: new THREE.Vector2() } },
  });
  P.mFinal = new THREE.ShaderMaterial({
    vertexShader: POST_VERT, fragmentShader: FINAL_FRAG,
    uniforms: {
      tScene: { value: null }, tBloom: { value: null },
      bloomAmt: { value: 0.40 }, exposure: { value: 1.45 },
      time: { value: 0 }, grain: { value: 0.026 },
      vignette: { value: 0.36 }, aberration: { value: 0.0030 },
      night: { value: 0 },
    },
  });

  //  Deliberately NOT on S: clearWorld() empties that object every time the
  //  world is rebuilt, which took the lens with it.
  SHW.post = P;
  //  The lens does the tone mapping, so the renderer must not do it twice.
  r.toneMapping = THREE.NoToneMapping;
  return P;
}

function resizePost(){
  const P = SHW.post;
  if (!P) return;
  const size = new THREE.Vector2();
  SHW.renderer.getDrawingBufferSize(size);
  P.scene.setSize(size.x, size.y);
  P.bright.setSize(size.x >> 1, size.y >> 1);
  P.blurA.setSize(size.x >> 1, size.y >> 1);
  P.blurB.setSize(size.x >> 1, size.y >> 1);
}

function blit(mat, target){
  const P = SHW.post;
  P.quad.material = mat;
  SHW.renderer.setRenderTarget(target || null);
  SHW.renderer.render(P.stage, P.cam);
}

function renderFrame(){
  const r = SHW.renderer, P = SHW.post;
  if (!P){ r.render(SHW.scene, SHW.camera); return; }

  //  The shadow box rides with the player, or the sun would be lighting the
  //  middle of the map while you stand at the edge of it.
  if (QUALITY.shadows && S.sun && S.sun.shadow){
    S.sun.target.position.set(Pl.pos.x, 0, Pl.pos.z);
    S.sun.target.updateMatrixWorld();
  }

  r.setRenderTarget(P.scene);
  r.clear();
  r.render(SHW.scene, SHW.camera);

  if (QUALITY.bloom){
    P.mBright.uniforms.tScene.value = P.scene.texture;
    blit(P.mBright, P.bright);
    const w = P.blurA.width, h = P.blurA.height;
    P.mBlur.uniforms.tIn.value = P.bright.texture;
    P.mBlur.uniforms.dir.value.set(1 / w, 0);
    blit(P.mBlur, P.blurA);
    P.mBlur.uniforms.tIn.value = P.blurA.texture;
    P.mBlur.uniforms.dir.value.set(0, 1 / h);
    blit(P.mBlur, P.blurB);
  }

  const u = P.mFinal.uniforms;
  u.tScene.value = P.scene.texture;
  u.tBloom.value = QUALITY.bloom ? P.blurB.texture : null;
  u.bloomAmt.value = QUALITY.bloom ? (St.night ? 0.70 : 0.34) : 0;
  u.time.value = St.t;
  u.night.value = St.night ? 1 : 0;
  u.exposure.value = St.night ? 1.62 : 1.45;
  blit(P.mFinal, null);
  r.setRenderTarget(null);
}

//  Shadows are decided once, from what the machine actually manages, and the
//  player can override it. Nobody should have to know what a shadow map is.
let fpsSamples = [], fpsDecided = false;
function autoQuality(dt){
  if (fpsDecided || St.phase !== 'play') return;
  fpsSamples.push(dt);
  if (fpsSamples.length < 90) return;
  fpsDecided = true;
  const sorted = fpsSamples.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median > 0.040){
    applyQuality('low');
    toast('Effects turned down to keep it smooth. O to change.', '#9c93c6');
  } else if (median > 0.024){
    applyQuality('medium');
  }
}

function cycleQuality(){
  const order = ['low', 'medium', 'high'];
  const i = order.indexOf(QUALITY.level);
  const next = order[(i + 1) % order.length];
  fpsDecided = true;
  applyQuality(next);
  toast('Effects: ' + next, '#7fdcff');
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
    sites: () => settlements, quest: () => (questStep()||{}).title || 'done',
    groundY: (x,z) => groundY(x,z), seed: () => SHW.seed,
    renderer: () => SHW.renderer, post: () => SHW.post, quality: () => QUALITY,
    tick: (dt) => { tickMobs(dt); tickDrops(dt); tickProjectiles(dt); updateBossBar(); },
    collect(){ for (const d of drops.slice()){ d.mesh.position.set(Pl.pos.x,Pl.pos.y,Pl.pos.z); } },
    lights(){ let n=0; S.world.traverse(o=>{ if(o.isLight && o.visible) n++; }); return n; },
    dropsN: () => drops.length,
    spawnKind(k,x,z){ return makeMob(k,x,z); },
    cam: () => Cam,
    sceneRoot: () => SHW.scene, camera: () => SHW.camera,
    look(tx, ty, tz, dist, height, ang){
      const a2 = ang === undefined ? 0 : ang;
      SHW.freeCam = { tx, ty, tz,
        px: tx + Math.sin(a2) * dist, py: ty + (height || 0.6), pz: tz + Math.cos(a2) * dist };
      if (Pl.group) Pl.group.visible = false;
    },
    freeCamOff(){ SHW.freeCam = null; if (Pl.group) Pl.group.visible = true; },
    holdNight(){ St.night = true; St.cycle = DAY_LEN + 20; },
    spawnOne(){ const a=Math.random()*6.283, r=14+Math.random()*8;
                return makeMob('husk', Pl.pos.x+Math.cos(a)*r, Pl.pos.z+Math.sin(a)*r); },
    dig(x, z, rad, amt){
      const ci=Math.round((x+HALF)/CELL), cj=Math.round((z+HALF)/CELL);
      const rc=Math.ceil(rad/CELL);
      for(let j=-rc;j<=rc;j++) for(let i=-rc;i<=rc;i++){
        const gi=ci+i, gj=cj+j; if(gi<0||gj<0||gi>GRID||gj>GRID) continue;
        const dd=Math.hypot(i*CELL,j*CELL); if(dd>rad) continue;
        HD[hIdx(gi,gj)] += amt*Math.pow(1-dd/rad,1.6);
      }
      rebuildTilesAround(x,z,rad+CELL*2);
    },
    hurt(m, n){ hurtMob(m, n, 0, 0); },
    relight(st){ tryRelight(st); },
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
    bosses: () => BOSSES,
    bossIdx: () => St.bossIdx,
    callBoss(i){ St.bossIdx = (i === undefined ? St.bossIdx : i);
                 St.bossCalled = false; St.day = Math.max(St.day, 2);
                 bossRef = null;
                 this.holdNight(); St.cycle = CYCLE - 2; tickBossCall(0.016);
                 return bossRef; },
    bossAlive(){ return mobs.filter(m => m.boss && !m.dead)
                            .map(m => ({ name:m.boss.name, hp:Math.round(m.hp),
                                         max:Math.round(m.maxHp), twin:!!m.isTwinBody })); },
    killBoss(){ for (const m of mobs.slice()) if (m.boss && !m.dead){ m.hp = 0; killMob(m); } },
    won: () => St.won,
    winCard(){ return hud.win && hud.win.classList.contains('on'); },
    closeWin(){ closeWin(); },
  },
};

})();
