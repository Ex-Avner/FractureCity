/* MOUNT OREDOR · THE ASCENT

   The first mission. Technology made perspectives into facts: whatever is typed
   onto the common feed becomes real. The feed hangs over the valley. Oredor is
   the one place that rises above it, and its summit holds a fallen shard of the
   Mirror. Whoever carries it down sees the seams: every posted reality shows its
   author and its date.

   What you climb, bottom to top:
     Base camp        tents, a sign, a stake where the fixed lines start
     The Fear Slopes  switchbacks under the thick of the feed; posted fears walk here
     Camp I           The Ledger, and a bus stop somebody posted into existence
     The first rope   an eight metre face, climbed by hand (hold W against it)
     Camp II          The Cloud Line. The feed ends. Whiteout.
     The second rope  above the cloud deck
     The ridge        knife edge, wind from the side, a fixed line that catches you
     The summit       the shard. Take it: Sight.

   The world is 64 blocks tall, so the climb is 60 m of voxels made long, steep and
   walled in, then folded through a whiteout: the altitude readout jumps through
   the cloud the way the feed jumps through facts. The painted peak (mount-oredor.js)
   is the upper mountain while you are below the cloud and goes when you enter it.

   Ordinary voxels, ordinary collision, mining and edits. The zone takes six
   Outer Expanse regions on the +Z side (x -144..144, z 288..720) for every seed.
   Progress is per browser and per world seed, like First Signal. Double jump is
   off on the mountain. God mode still flies, but nothing counts while it is on.

   Guidance (0.110): a gold beam stands over the trailhead until the summit is
   taken; the chip at the top gives direction and distance to the trailhead, then
   to the next camp, rope or the summit; the trail is inlaid with lit blazes.

   FCOredor.ascent: state, places, sight, debug.  FCOredor.sight: true once earned.
   Event 'fc-oredor-sight' fires on the summit. */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined' || typeof Chunk === 'undefined' || !window.FCOredor || typeof shDefBlock !== 'function') return;
const O = window.FCOredor, VERSION = '0.110.0';

// ─── Canon: words and handles are yours to change; nothing depends on them ───
const CANON = {
 name: 'MOUNT OREDOR', sub: 'the one place above the feed',
 camps: ['TRAILHEAD', 'CAMP I · THE LEDGER', 'CAMP II · THE CLOUD LINE', 'SUMMIT'],
 sight: ['SIGHT', 'The seams show. Every posted thing now carries who posted it, and when.'],
 posts: [ // [text, handle, when]
  ['Road 9 is a river now. Bring a boat.', '@tide_mom', '02 MAR · 07:41'],
  ['My landlord is technically a wolf.', '@kev_unit4', '19 FEB · 23:10'],
  ['The sun sets twice on Thursdays.', '@almanac_guy', '11 JAN · 18:02'],
  ['Fracture City has always had a sea.', '@official_harbor', '30 DEC · 09:00'],
  ['School is cancelled forever. Source: me.', '@jj_09', '14 MAR · 06:55'],
  ['Everyone downstairs is a cardboard cutout.', '@night_nurse', '08 MAR · 03:14'],
  ['The bus is free if you believe in it.', '@route_77', '21 FEB · 12:30'],
  ['My ex was never born.', '@sadia.k', '27 JAN · 01:48'],
  ['The mayor is three raccoons in a coat.', '@truthfire', '05 MAR · 20:20'],
  ['Rain falls up near the Archive.', '@mira_draws', '16 FEB · 15:37'],
  ['Bread is a government program.', '@wheatwatch', '01 MAR · 11:11'],
  ['This mountain is not there.', '@flat_valley', '12 MAR · 22:04'],
 ],
 fears: [ // [text, handle, when, name]
  ['Something lives in the scree. It knows your name.', '@hiker_lou', '09 MAR · 04:02', 'IT KNOWS YOUR NAME'],
  ['If you climb, the mountain climbs you back.', '@dont_go_up', '13 MAR · 00:17', 'IT CLIMBS BACK'],
  ['There are people up there made of comments.', '@mod_team_b', '28 FEB · 02:39', 'MADE OF COMMENTS'],
  ['The higher you go, the less you exist.', '@feedwatch', '10 MAR · 05:51', 'LESS OF YOU'],
  ['Nobody who reached the top came back the same.', '@anon_4412', '14 MAR · 03:33', 'NOT THE SAME'],
 ],
 patches: [ // posted realities standing in the world: [id, handle, when, text]
  ['vending', '@kind_stranger', '03 MAR · 16:20', 'Free snacks for anyone who climbs.'],
  ['busstop', '@route_77', '12 MAR · 08:02', 'There should be a bus stop up here.'],
  ['door', '@marla_r', '07 MAR · 19:45', 'I left my front door on the mountain.'],
  ['lamp', '@city_works', '18 FEB · 10:00', 'Streetlights all the way to the top!'],
 ],
 lines: {
  rope: 'Hold W against the face · climb the fixed rope',
  catch: 'The fixed line holds. Back on the ridge.',
  take: 'E · Take the shard', descend: 'E · Descend by the fixed lines',
  clip: n => 'E · Clip in · up to ' + n, god: 'GOD MODE · the mountain does not count',
  quelled: 'The post goes dark. Nobody believes it any more.',
 },
};

// ─── Zone ─────────────────────────────────────────────────────────────────
const ZONE = { x0: -144, x1: 144, z0: 288, z1: 720 }, GW = ZONE.x1 - ZONE.x0, GD = ZONE.z1 - ZONE.z0;
const claims = (cx, cz) => cx >= -6 && cx <= 5 && cz >= 12 && cz <= 29;
const inZone = (x, z) => x >= ZONE.x0 && x < ZONE.x1 && z >= ZONE.z0 && z < ZONE.z1;
O.claims = claims; O.inZone = inZone;

// Route: [x, z, y, tag]. Rope legs are vertical faces, climbed by hand.
const ROUTE = [
 [0, 296, 2], [0, 312, 3, 'base'], [0, 330, 4], [-45, 352, 9], [40, 378, 16], [-30, 404, 22], [-30, 416, 24, 'camp1'],
 [35, 440, 30], [35, 445, 30, 'rope'], [35, 447, 38], [35, 452, 38], [-20, 478, 44], [-20, 490, 46, 'camp2'],
 [10, 520, 50], [10, 525, 50, 'rope'], [10, 527, 55], [10, 533, 55, 'ridge'], [8, 600, 61, 'ridge'], [8, 606, 61, 'summit'],
];
const CAMPS = [{ x: 0, z: 312, y: 3, r: 13 }, { x: -30, z: 416, y: 24, r: 6 }, { x: -20, z: 490, y: 46, r: 5.5 }, { x: 8, z: 606, y: 61, r: 3.4 }];
const ROPES = [{ x: 35, face: 446, y0: 30, y1: 38, box: [29, 41, 437, 455], wall: 42 }, { x: 10, face: 526, y0: 50, y1: 55, box: [5, 15, 518, 532], wall: 59 }];
const SUMMIT = { x: 8, z: 606, y: 61 }, RIDGE = { z0: 531, z1: 603 };
const FEARS = [[-38, 357], [31, 371], [4, 392], [-17, 420], [20, 433]];

// Altitude the climber reads. Below the cloud it is honest arithmetic on the voxels; through the
// whiteout it jumps, which is the point.
function alt(f){ const v = f <= 44 ? 1900 + (f - 3) * 82 : f <= 52 ? 5262 + (f - 44) / 8 * 2038 : 7300 + (f - 52) * 60; return Math.round(Math.max(1900, Math.min(7840, v)) / 10) * 10; }
const fmt = n => n.toLocaleString('en-US');

// ─── Blocks (fixed ids: they are a storage format) ───────────────────────
const BK = {};
[['granite', 190, 'oredor granite', 0x4b4a51, false, .16], ['scree', 191, 'oredor scree', 0x77736d, false, .2], ['firn', 192, 'firn', 0xe6ebf1, false, .05],
 ['ice', 193, 'blue ice', 0x9cc2d6, false, .05], ['silt', 194, 'feed silt', 0x6f6a7c, false, .18], ['blaze', 195, 'trail blaze', 0xf0bf62, true, .03], ['mirror', 196, 'mirror glass', 0xc4e6ff, true, .02]]
 .forEach(([k, id, name, color, emit, grain]) => {
  BK[k] = shDefBlock(id, { name, solid: true, emit, color, grain });
  if (typeof MATERIALS !== 'undefined') MATERIALS[id] = { label: name, cls: emit ? 'signal' : 'stone', hardness: k === 'granite' ? 6 : emit ? 3 : 2.4, drop: id, yield: 1, value: emit ? 8 : 2, desc: 'Carried down from Mount Oredor.' };
 });

// ─── Noise ───────────────────────────────────────────────────────────────
function hash(x, y){ const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y){ const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
 const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; }
const lerpT = (tab, z) => { if (z <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (z <= tab[i][0]){ const [z0, a] = tab[i - 1], [z1, b] = tab[i], t = (z - z0) / (z1 - z0); return a + (b - a) * t * t * (3 - 2 * t); } return tab[tab.length - 1][1]; };
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// The massif: a profile along Z (it rises toward the summit, then falls away behind it)
// shaped across X, broken by low-frequency shoulders and gullies.
const PROFILE = [[292, 2], [312, 3], [335, 7], [380, 17], [420, 26], [460, 37], [500, 47], [540, 54], [606, 60], [640, 50], [680, 26], [716, 2]];
const WIDTH = [[292, 118], [450, 106], [540, 72], [606, 46], [660, 80], [716, 110]];
function natural(x, z){
 const base = lerpT(PROFILE, z), w = lerpT(WIDTH, z), n = vnoise(x * .031 + 3, z * .031), n2 = vnoise(x * .09 + 11, z * .09 + 5);
 const lateral = 1 - smooth(w * .45, w, Math.abs(x - 4) + (n - .5) * 26);
 let h = 2 + (base - 2) * lateral * (.84 + .3 * n) + (n2 - .5) * 4 * lateral;
 const ang = Math.atan2(z - SUMMIT.z, x - SUMMIT.x), gully = Math.pow(Math.abs(Math.sin(ang * 7 + n * 4)), 8) * 7 * lateral;
 h -= gully;
 const edge = Math.min(1, Math.min(x - ZONE.x0, ZONE.x1 - 1 - x, z - ZONE.z0, ZONE.z1 - 1 - z) / 16);
 h = 2 + Math.max(0, h - 2) * Math.max(0, edge);
 // Terraces: two blocks is a wall. Scrambles break through where the noise allows.
 const s = vnoise(x * .055 + 31, z * .055 + 17) > .72 ? Math.round(h) : 2 + Math.floor((h - 2) / 3) * 3;
 return Math.max(2, Math.min(58, s));
}

// ─── The grid: surface height and kind for every column of the zone ───────
const K = { NAT: 0, TRAIL: 1, CAMP: 2, TALUS: 3, ROCK: 4 };
let SURF = null, KIND = null, GLOW = null, CAIRNS = null, GRID_MS = 0, GRID_RAISED = 0;
const gi = (x, z) => (z - ZONE.z0) * GW + (x - ZONE.x0);
function segments(){
 const out = [];
 for (let i = 0; i < ROUTE.length - 1; i++){ const a = ROUTE[i], b = ROUTE[i + 1]; out.push({ a, b, rope: a[3] === 'rope' ? ROPES.find(r => Math.abs(r.x - a[0]) < 1 && Math.abs(r.face - a[1]) < 3) : null, ridge: a[3] === 'ridge', len: Math.hypot(b[0] - a[0], b[1] - a[1]) }); }
 let run = 0; for (const s of out){ s.at = run; run += s.rope ? 0 : s.len; }
 return out;
}
const SEGS = segments();
function nearestSeg(x, z){ // distance, height and segment of the trail nearest to (x, z)
 let best = { d: Infinity, y: 0, s: null, t: 0 };
 for (const s of SEGS){ const [ax, az, ay] = s.a, [bx, bz, by] = s.b, vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L)), d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
  if (d < best.d){ const y = s.rope ? (z < s.rope.face ? s.rope.y0 : s.rope.y1) : Math.round(ay + (by - ay) * t); best = { d, y, s, t }; } }
 return best;
}
function buildGrid(){
 if (SURF) return; const t0 = performance.now();
 SURF = new Uint8Array(GW * GD); KIND = new Uint8Array(GW * GD); GLOW = new Uint8Array(GW * GD); CAIRNS = new Map();
 for (let z = ZONE.z0; z < ZONE.z1; z++) for (let x = ZONE.x0; x < ZONE.x1; x++){
  const cx = x + .5, cz = z + .5, i = gi(x, z), T = nearestSeg(cx, cz), half = T.s && T.s.ridge ? 1.15 : 1.65;
  let s = natural(x, z), k = K.NAT;
  if (T.d <= half){ s = T.y; k = K.TRAIL; if (T.d < .55 && T.s && !T.s.rope && (T.s.at + T.t * T.s.len) % 4 < 1) GLOW[i] = 1; }
  else if (T.s && T.s.ridge && T.d < 12){ s = Math.min(s, T.y - 5 - Math.floor((T.d - half) * .8)); }
  else if (T.d < half + 9){ const talus = T.y - Math.ceil(T.d - half); if (s < talus){ s = talus; k = K.TALUS; } }
  for (const [n, c] of CAMPS.entries()){ const d = Math.hypot(cx - c.x, cz - c.z);
   if (d < c.r){ s = c.y; k = n === 3 ? K.TRAIL : K.CAMP; }
   else if (n === 3 && d < 12 && k !== K.TRAIL) s = Math.min(s, c.y - 5 - Math.floor((d - c.r) * .7));
   else if (d < c.r + 6 && s < c.y - Math.ceil(d - c.r)){ s = c.y - Math.ceil(d - c.r); k = K.TALUS; } }
  for (const r of ROPES){ const [x0, x1, z0, z1] = r.box; if (x >= x0 && x <= x1 && z >= z0 && z <= z1 && k !== K.TRAIL){ s = Math.max(s, r.wall); k = K.ROCK; } }
  SURF[i] = Math.max(2, Math.min(61, s)); KIND[i] = k;
 }
 SURF[gi(SUMMIT.x, SUMMIT.z)] = 62; // the plinth the shard hangs over
 const before = SURF.slice(); fill();
 GRID_RAISED = 0; for (let i = 0; i < SURF.length; i++) if (KIND[i] === K.TRAIL && SURF[i] !== before[i]) GRID_RAISED++;
 // Cairns: a blazed stone every thirty metres of trail, just off its edge.
 let run = 0;
 for (const s of SEGS){ if (s.rope) continue; const [ax, az] = s.a, [bx, bz] = s.b, nx = -(bz - az) / (s.len || 1), nz = (bx - ax) / (s.len || 1);
  for (let d = 0; d < s.len; d += 1){ run += 1; if (run % 30) continue; const t = d / s.len, x = Math.floor(ax + (bx - ax) * t + nx * 2.4), z = Math.floor(az + (bz - az) * t + nz * 2.4);
   if (inZone(x, z) && KIND[gi(x, z)] !== K.TRAIL && !s.ridge) CAIRNS.set(x + ',' + z, SURF[gi(x, z)]); } }
 GRID_MS = Math.round(performance.now() - t0);
}
// Priority flood from the zone edge: every column gets a path to the apron that never climbs.
// Nobody can fall into a hole on this mountain they cannot walk out of.
function fill(){
 const N = GW * GD, done = new Uint8Array(N), heap = [], keyOf = i => SURF[i] * 1048576 + i;
 const push = i => { heap.push(keyOf(i)); let c = heap.length - 1; while (c > 0){ const p = (c - 1) >> 1; if (heap[p] <= heap[c]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
 const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let c = 0; for (;;){ const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l] < heap[m]) m = l; if (r < heap.length && heap[r] < heap[m]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top % 1048576; };
 for (let x = 0; x < GW; x++) for (const z of [0, GD - 1]){ const i = z * GW + x; if (!done[i]){ done[i] = 1; push(i); } }
 for (let z = 0; z < GD; z++) for (const x of [0, GW - 1]){ const i = z * GW + x; if (!done[i]){ done[i] = 1; push(i); } }
 while (heap.length){ const i = pop(), x = i % GW, z = (i - x) / GW, h = SURF[i];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= GW || nz >= GD) continue; const j = nz * GW + nx; if (done[j]) continue; done[j] = 1; if (SURF[j] < h) SURF[j] = h; push(j); } }
}
function surfAt(x, z){ x = Math.floor(x); z = Math.floor(z); if (!inZone(x, z)) return 2; buildGrid(); return SURF[gi(x, z)]; }

// ─── Terrain into chunks ─────────────────────────────────────────────────
const district = { ...(window.Wilds?.districts?.SCRUB || {}), name: CANON.name, biome: 'oredor', bgColor: 0x8d93a3, accentColor: 0xf0bf62, description: CANON.name + ' · Switchbacks, fixed ropes, a cloud line, and one summit above the feed.', expanse: true };
const prevDistrict = window.districtForChunk;
window.districtForChunk = function(cx, cz){ return claims(cx, cz) ? district : prevDistrict(cx, cz); };
const generate = Chunk.prototype.generate;
Chunk.prototype.generate = function(){
 if (!claims(this.cx, this.cz)) return generate.apply(this, arguments);
 this._wild = 'oredor'; this._oredor = true; this.__cityFitted = 1; this._parked = true; this._eased = true; this._wildEased = true; this._wildLooted = true;
 try { terrain(this); } catch (e){ console.warn('[oredor] terrain', e); }
};
function terrain(c){
 buildGrid();
 const ox = c.originX, oz = c.originZ;
 for (let lx = 0; lx < VOX_W; lx++) for (let lz = 0; lz < VOX_W; lz++){
  const x = ox + lx, z = oz + lz, i = gi(x, z), s = SURF[i], k = KIND[i];
  const nb = Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => inZone(x + dx, z + dz) ? SURF[gi(x + dx, z + dz)] : 2));
  const steep = nb - s >= 2 || s - Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => inZone(x + dx, z + dz) ? SURF[gi(x + dx, z + dz)] : 2)) >= 2;
  const snow = s >= 41 + Math.floor(hash(x * .7, z * .7) * 4), g = hash(x, z);
  let top = BK.granite;
  if (k === K.TRAIL) top = s >= 42 ? BK.firn : BK.scree;
  else if (k === K.CAMP) top = s >= 42 ? BK.firn : BK.scree;
  else if (snow) top = steep && g < .3 ? BK.ice : BK.firn;
  else if (s < 18) top = steep ? BK.granite : BK.silt;
  else top = steep ? BK.granite : BK.scree;
  if (GLOW[i] && k === K.TRAIL) top = BK.blaze;
  if (x === SUMMIT.x && z === SUMMIT.z) top = BK.mirror;
  for (let y = 0; y < s; y++){
   let id = y === s - 1 ? top : (y % 6 === 0 && y > 4 ? BK.scree : BK.granite);
   if (y === s - 2 && snow && k !== K.TRAIL) id = BK.firn;
   if (y === s - 2 && s >= 30 && steep && (x * 7 + z * 3 + y) % 11 === 0) id = BK.ice;
   c.vSet(lx, y, lz, id);
  }
  const cairn = CAIRNS.get(x + ',' + z);
  if (cairn != null){ c.vSet(lx, s, lz, BK.granite); c.vSet(lx, s + 1, lz, BK.blaze); }
 }
}

// ─── Saved progress ──────────────────────────────────────────────────────
//  camp: highest camp reached (0 trailhead … 3 summit). quelled: fears put out.
let S = { seen: false, camp: -1, sight: false, quelled: [] }, scope = null;
function load(){
 const next = String(State.citySeed || ''); if (scope === next) return; scope = next;
 S = { seen: false, camp: -1, sight: false, quelled: [] };
 try { const raw = JSON.parse(localStorage.getItem('fc-oredor-v1:' + scope));
  if (raw && typeof raw === 'object'){ S.seen = !!raw.seen; S.sight = !!raw.sight; if (Number.isInteger(raw.camp)) S.camp = Math.max(-1, Math.min(3, raw.camp)); if (Array.isArray(raw.quelled)) S.quelled = raw.quelled.filter(n => Number.isInteger(n) && n >= 0 && n < FEARS.length); } } catch {}
 O.sight = S.sight; applySight();
}
let saveWarned = false;
function save(){ try { localStorage.setItem('fc-oredor-v1:' + scope, JSON.stringify(S)); return true; } catch { if (!saveWarned){ saveWarned = true; toast('Mount Oredor progress could not be saved on this device.', 'warn'); } return false; } }

// ─── Small helpers ───────────────────────────────────────────────────────
const TAU = Math.PI * 2, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const feet = () => Player.position.y - Player.height;
const tone = o => { try { return typeof shTone === 'function' ? shTone(o) : null; } catch { return null; } };
const burst = (x, y, z, o) => { try { if (typeof shBurst === 'function') shBurst(x, y, z, o); } catch {} };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function active(){ return !window.FCArrival?.busy && !!State.citySeed && State.chunkMap.size > 0 && !!State.scene && !window.FN?.prologue && !window.FN?.scene && !State.ui.inIntro && !State.ui.inDialogue && !State.ui.inArcade && !State.ui.inMiniGame && !State.ui.inInventory && !State.ui.inCar && !window.FCJustice?.active; }
const god = () => !!window.FCWorldStudio?.god;
function canvasTex(w, h, draw){ const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace; return t; }
function wrap(g, text, x, y, maxW, lh, maxLines = 3){ const words = text.split(' '); let line = '', n = 0; for (const w of words){ const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line){ g.fillText(line, x, y + n * lh); line = w; if (++n >= maxLines) return; } else line = test; } if (line) g.fillText(line, x, y + n * lh); }
function ensure(x, z, r = 2){ const cx0 = Math.floor((x - r * 24) / 24), cz0 = Math.floor((z - r * 24) / 24); for (let cx = cx0; cx <= cx0 + r * 2; cx++) for (let cz = cz0; cz <= cz0 + r * 2; cz++){ const k = cx + ',' + cz; if (!State.chunkMap.has(k) && typeof shBuildChunk === 'function') shBuildChunk(k); } }

// ─── The feed: posts hanging over the approach and the lower slopes ──────
//  One instanced draw. Thick at the foot, thinning with height, gone above the cloud.
const COLS = 4, ROWS = 8, CELL_W = 256, CELL_H = 128;
const CELL = { post: i => i, fear: i => 12 + i, dead: i => 17 + i };
function atlas(sight){
 return canvasTex(COLS * CELL_W, ROWS * CELL_H, (g) => {
  const cells = [...CANON.posts.map(p => ({ p, kind: 'post' })), ...CANON.fears.map(p => ({ p, kind: 'fear' })), ...CANON.fears.map(p => ({ p, kind: 'dead' }))];
  cells.forEach(({ p, kind }, n) => {
   const x = (n % COLS) * CELL_W, y = Math.floor(n / COLS) * CELL_H, pad = 10;
   g.save(); g.translate(x, y);
   g.fillStyle = kind === 'fear' ? 'rgba(46,10,18,.9)' : kind === 'dead' ? 'rgba(20,20,24,.55)' : 'rgba(16,18,28,.84)';
   g.beginPath(); g.roundRect ? g.roundRect(pad, pad, CELL_W - pad * 2, CELL_H - pad * 2, 12) : g.rect(pad, pad, CELL_W - pad * 2, CELL_H - pad * 2); g.fill();
   g.strokeStyle = sight ? '#f0bf62' : kind === 'fear' ? '#ff4a5e' : 'rgba(190,200,230,.45)'; g.lineWidth = sight ? 3 : 2; g.stroke();
   g.fillStyle = kind === 'fear' ? '#ffd9de' : kind === 'dead' ? 'rgba(220,220,230,.45)' : '#eef1fb'; g.font = '600 19px system-ui, sans-serif'; g.textBaseline = 'top';
   wrap(g, p[0], pad + 12, pad + (sight ? 10 : 16), CELL_W - pad * 2 - 24, 23, sight ? 2 : 3);
   if (kind === 'dead'){ g.strokeStyle = 'rgba(255,90,100,.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(pad + 8, CELL_H / 2 + 4); g.lineTo(CELL_W - pad - 8, CELL_H / 2 - 6); g.stroke(); }
   if (sight){ g.fillStyle = '#f0bf62'; g.font = '700 15px system-ui, sans-serif'; g.fillText(p[1] + ' · ' + p[2], pad + 12, CELL_H - pad - 26); }
   g.restore();
  });
 });
}
let feed = null;
function buildFeed(){
 const rng = new RNG('oredor-feed'), list = [];
 const add = (x, y, z, cell, size = 1.6, a = 1) => list.push({ x, y, z, cell, size, a });
 for (let i = 0; i < 26; i++) add(rng.range(-72, 72), rng.range(15, 28), rng.range(226, 292), rng.int(0, 11), rng.range(1.5, 2.2), .9);
 for (let i = 0; i < 52; i++){ const x = rng.range(-92, 92), z = rng.range(296, 444), y = surfAt(x, z) + rng.range(3.5, 12); if (y < 40) add(x, y, z, rng.int(0, 11), rng.range(1.2, 1.9)); }
 for (let i = 0; i < 14; i++){ const x = rng.range(-70, 70), z = rng.range(444, 492), y = Math.min(43, surfAt(x, z) + rng.range(2, 7)); add(x, y, z, rng.int(0, 11), rng.range(1, 1.4), .7); }
 const fearAt = FEARS.map(([x, z], n) => { list.push({ x, y: surfAt(x, z) + 4.6, z, cell: S.quelled.includes(n) ? CELL.dead(n) : CELL.fear(n), size: 2.1, a: 1, fear: n }); return list.length - 1; });
 const geo = new THREE.InstancedBufferGeometry(); const plane = new THREE.PlaneGeometry(1, 1);
 geo.index = plane.index; geo.setAttribute('position', plane.attributes.position); geo.setAttribute('uv', plane.attributes.uv);
 const pos = new Float32Array(list.length * 3), dat = new Float32Array(list.length * 4);
 list.forEach((p, i) => { pos.set([p.x, p.y, p.z], i * 3); dat.set([p.cell, p.size, hash(p.x, p.z), p.a], i * 4); });
 geo.setAttribute('aAt', new THREE.InstancedBufferAttribute(pos, 3)); geo.setAttribute('aPost', new THREE.InstancedBufferAttribute(dat, 4)); geo.instanceCount = list.length;
 const tex = atlas(false), sightTex = atlas(true);
 const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  uniforms: { uMap: { value: tex }, uTime: { value: 0 }, uFade: { value: 1 } },
  vertexShader: `attribute vec3 aAt;attribute vec4 aPost;uniform float uTime,uFade;varying vec2 vUv;varying float vA;
  void main(){
   vec3 c=aAt;c.y+=sin(uTime*.55+aPost.z*6.2831)*.22;
   vec3 r=vec3(viewMatrix[0][0],0.,viewMatrix[2][0]);r=r/max(length(r),.0001);
   vec3 p=c+r*position.x*aPost.y*2.+vec3(0.,1.,0.)*position.y*aPost.y;
   float col=mod(aPost.x,4.),row=floor(aPost.x/4.+.001);
   vUv=vec2((col+uv.x)/4.,1.-(row+1.-uv.y)/8.);
   float d=distance(cameraPosition,c);
   vA=aPost.w*uFade*(1.-smoothstep(70.,115.,d))*(1.-smoothstep(36.,45.,c.y));
   gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
  fragmentShader: `uniform sampler2D uMap;varying vec2 vUv;varying float vA;void main(){vec4 t=texture2D(uMap,vUv);float a=clamp(t.a*vA,0.,1.);if(a<.02)discard;gl_FragColor=vec4(clamp(t.rgb,0.,1.),a);}` });
 const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.name = 'oredor-feed'; mesh.userData._hdTag = 1; mesh.renderOrder = 5;
 feed = { mesh, mat, geo, list, fearAt, tex, sightTex };
 return feed;
}
function setPostCell(i, cell){ if (!feed) return; const a = feed.geo.attributes.aPost; a.array[i * 4] = cell; a.needsUpdate = true; feed.list[i].cell = cell; }

// ─── Props: camps, ropes, the posted things standing in the snow ─────────
let root = null, props = null;
function materials(){
 const std = (color, rough = .85, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
 const glow = (color, i = 1.4) => new THREE.MeshStandardMaterial({ color: 0x111114, roughness: .5, emissive: color, emissiveIntensity: i });
 return { steel: std(0x59636c, .55, .4), wood: std(0x6b4a3a), rope: std(0xe8742a, .7), canvasA: std(0xd2652e, .9), canvasB: std(0x2f7c86, .9), canvasC: std(0xcfc6a6, .9),
  sign: std(0x1c2029, .6), stone: std(0x55545b, .9), stove: glow(0xffa040, 1.2), lamp: glow(0xffe0a8, 2.2), vend: glow(0x7ad7ff, .9), red: std(0x9a2a2a, .7), white: std(0xe9ecef, .7),
  card: [0xd64545, 0xe0b23a, 0x3a8fd6, 0x4fb06a, 0xe8e8ec].map(c => std(c, .9)), shard: new THREE.MeshStandardMaterial({ color: 0xdff1ff, roughness: .05, metalness: .2, emissive: 0x6aa8d8, emissiveIntensity: .9, transparent: true, opacity: .92 }) };
}
function batcher(group){
 const lists = new Map(), o = new THREE.Object3D(), box = new THREE.BoxGeometry(1, 1, 1);
 const put = (geo, mat, it) => { const k = geo.uuid + mat.uuid; if (!lists.has(k)) lists.set(k, { geo, mat, items: [] }); lists.get(k).items.push(it); };
 return {
  box(mat, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0){ put(box, mat, { p: [x, y + h / 2, z], s: [w, h, d], e: [rx, ry, rz] }); },
  geo(geo, mat, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0){ put(geo, mat, { p: [x, y, z], s: [sx, sy, sz], e: [rx, ry, rz] }); },
  flush(){ for (const { geo, mat, items } of lists.values()){ const im = new THREE.InstancedMesh(geo, mat, items.length); items.forEach((it, i) => { o.position.fromArray(it.p); o.scale.fromArray(it.s); o.rotation.set(...it.e); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.instanceMatrix.needsUpdate = true; im.castShadow = im.receiveShadow = false; im.userData._hdTag = 1; group.add(im); } },
 };
}
function signPlane(lines, w = 2.4, h = 1.2){
 const tex = canvasTex(512, 256, (g, W, H) => { g.fillStyle = '#1b1f28'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f0bf62'; g.lineWidth = 6; g.strokeRect(8, 8, W - 16, H - 16);
  g.fillStyle = '#f2efe6'; g.textAlign = 'center'; g.font = '700 44px system-ui, sans-serif'; g.fillText(lines[0], W / 2, 96); g.font = '600 32px system-ui, sans-serif'; g.fillStyle = '#f0bf62'; if (lines[1]) g.fillText(lines[1], W / 2, 160); if (lines[2]){ g.fillStyle = '#9aa3b5'; g.font = '500 24px system-ui, sans-serif'; g.fillText(lines[2], W / 2, 212); } });
 const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); m.userData._hdTag = 1; return m;
}
const PATCH_AT = { vending: [9.5, 3, 305.5, 1.1, 2, .8], busstop: [-25.5, 24, 419.5, 2.4, 2.8, 1.2], door: [-15.5, 46, 493, 1.3, 2.3, .5], lamp: [11.2, 58, 566, .6, 4.6, .6] };
function buildProps(){
 const M = materials(), group = new THREE.Group(); group.name = 'oredor-props'; const b = batcher(group);
 const prism = new THREE.CylinderGeometry(1, 1, 1, 3);
 const tent = (x, y, z, ry, mat, s = 1) => { b.geo(prism, mat, x, y + .62 * s, z, .9 * s, 2.6 * s, .9 * s, ry, 0, Math.PI / 2); b.box(M.wood, x, y, z, .06, .02, .06); };
 const sign = (x, y, z, ry, lines) => { b.box(M.wood, x - 1.1, y, z, .14, 2.3, .14, ry); b.box(M.wood, x + 1.1, y, z, .14, 2.3, .14, ry); const p = signPlane(lines); p.position.set(x, y + 1.7, z); p.rotation.y = ry; group.add(p); };
 // Trailhead and base camp.
 sign(0, 3, 300.5, Math.PI, ['MOUNT OREDOR', 'TRAILHEAD · ' + fmt(alt(3)) + ' M', 'the fixed lines start at the stake']);
 tent(-7, 3, 309, .4, M.canvasA); tent(-9.5, 3, 316, -.3, M.canvasB); tent(7.5, 3, 310, -.5, M.canvasC); tent(9, 3, 317, .2, M.canvasA);
 b.box(M.stone, -1.8, 3, 314, .9, .5, .9); b.box(M.stove, -1.8, 3.5, 314, .5, .18, .5);
 for (const x of [-12, 12]) b.box(M.wood, x, 3, 321, .14, 4.2, .14);
 for (let i = 0; i < 15; i++){ const t = i / 14, x = -12 + 24 * t, y = 3 + 4 - Math.sin(t * Math.PI) * 1.1; b.box(M.card[i % 5], x, y - .55, 321, .5, .5, .04, 0, 0, Math.sin(i) * .15); b.box(M.rope, x, y, 321, 1.72, .03, .03); }
 b.box(M.steel, 2.5, 3, 318, .12, 1.3, .12); b.geo(new THREE.TorusGeometry(.35, .07, 6, 14), M.rope, 2.5, 3.35, 318, 1, 1, 1, 0, Math.PI / 2);
 // Camp I.
 sign(-34.5, 24, 413, Math.PI / 2, ['CAMP I', 'THE LEDGER · ' + fmt(alt(24)) + ' M']);
 tent(-32, 24, 419, .9, M.canvasB, .9); tent(-28, 24, 412.5, -.2, M.canvasC, .9);
 // Camp II.
 sign(-24.5, 46, 488.5, Math.PI / 2, ['CAMP II', 'THE CLOUD LINE · ' + fmt(alt(46)) + ' M']);
 tent(-21.5, 46, 493.5, .5, M.canvasA, .85);
 // Fixed ropes, with pitons.
 for (const r of ROPES){ b.box(M.rope, r.x + .5, r.y0, r.face - .14, .07, r.y1 - r.y0 + .9, .07); for (let y = r.y0 + 1; y < r.y1; y += 2) b.box(M.steel, r.x + .5, y, r.face - .06, .2, .08, .12); b.box(M.steel, r.x + .5, r.y1, r.face + .3, .14, .7, .14); }
 // The ridge's fixed line: stakes along the east lip, a rope between them at hip height.
 for (let z = RIDGE.z0 + 2; z < RIDGE.z1; z += 7){ const T = nearestSeg(9, z), x = lerp(10, 8, (z - 533) / 67) + 1.05, y = T.y; b.box(M.steel, x, y, z, .06, 1.1, .06); b.box(M.rope, x, y + 1, z + 3.5, .04, .04, 7.04); }
 // Posted things.
 { const [x, y, z] = PATCH_AT.vending; b.box(M.red, x, y, z, 1.1, 2, .8); b.box(M.vend, x, y + .7, z - .41, .8, 1.1, .02); }
 { const [x, y, z] = PATCH_AT.busstop; b.box(M.steel, x + .9, y, z, .08, 2.7, .08); b.box(M.white, x + .9, y + 2.3, z, .55, .55, .04); b.box(M.wood, x - .2, y, z, 1.6, .45, .45); const p = signPlane(['BUS STOP', 'ROUTE 77 · EVERY 9 MIN'], .9, .45); p.position.set(x + .9, y + 2.55, z - .03); p.rotation.y = Math.PI; group.add(p); }
 { const [x, y, z] = PATCH_AT.door; b.box(M.wood, x - .55, y, z, .12, 2.25, .3); b.box(M.wood, x + .55, y, z, .12, 2.25, .3); b.box(M.wood, x, y + 2.18, z, 1.22, .12, .3); b.box(M.red, x, y, z, .98, 2.15, .08); b.box(M.steel, x + .32, y + 1, z - .06, .06, .06, .06); }
 { const [x, y, z] = PATCH_AT.lamp; b.box(M.steel, x, y, z, .14, 4.4, .14); b.box(M.steel, x - .45, y + 4.3, z, 1, .1, .14); b.box(M.lamp, x - .85, y + 4.05, z, .4, .22, .3); }
 b.flush();
 // The shard.
 const shard = new THREE.Mesh(new THREE.OctahedronGeometry(.42, 0), M.shard); shard.scale.set(.7, 2.1, .7); shard.position.set(SUMMIT.x + .5, SUMMIT.y + 2.7, SUMMIT.z + .5); shard.userData._hdTag = 1; group.add(shard);
 const halo = new THREE.Mesh(new THREE.RingGeometry(.9, 1.05, 40), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
 halo.position.copy(shard.position); halo.userData._hdTag = 1; group.add(halo);
 // Sight: seams around each posted thing, and a label saying who posted it and when.
 const seams = new THREE.Group(); seams.visible = false; group.add(seams);
 const seamMat = new THREE.LineBasicMaterial({ color: 0xf0bf62, transparent: true, opacity: .9, fog: false });
 const seamGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
 for (const [id, handle, when, text] of CANON.patches){ const [x, y, z, w, h, d] = PATCH_AT[id];
  const box = new THREE.LineSegments(seamGeo, seamMat); box.scale.set(w + .3, h + .3, d + .3); box.position.set(x, y + h / 2, z); seams.add(box);
  const tex = canvasTex(512, 128, (g, W, H) => { g.fillStyle = 'rgba(16,18,28,.86)'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f0bf62'; g.lineWidth = 3; g.strokeRect(2, 2, W - 4, H - 4); g.fillStyle = '#f0bf62'; g.font = '700 26px system-ui, sans-serif'; g.fillText('POSTED BY ' + handle + ' · ' + when, 16, 42); g.fillStyle = '#eef1fb'; g.font = '500 26px system-ui, sans-serif'; g.fillText(text, 16, 92); });
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })); label.scale.set(3.6, .9, 1); label.position.set(x, y + h + 1, z); seams.add(label); }
 group.traverse(o => { if (o.isMesh){ o.castShadow = false; o.receiveShadow = false; } });
 props = { group, shard, halo, seams, M };
 return group;
}

// ─── The cloud deck: below you once you are above it ─────────────────────
let cloud = null;
function buildCloud(){
 const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 }, uDay: { value: 1 }, uPart: { value: 0 }, uCenter: { value: new THREE.Vector2() } },
  vertexShader: `varying vec2 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader: `uniform float uTime,uDay,uPart;uniform vec2 uCenter;varying vec2 vW;
  float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  void main(){vec2 p=vW*.018+vec2(uTime*.01,uTime*.004);float c=n(p)*.62+n(p*2.7+3.)*.38;
   float r=distance(vW,uCenter);float edge=1.-smoothstep(150.,290.,r);
   float hole=smoothstep(10.,40.,r)*uPart+(1.-uPart);
   vec3 lit=mix(vec3(.12,.13,.18),vec3(.93,.95,.98),clamp(uDay,0.,1.));
   vec3 col=lit*(.82+.22*c);float a=clamp((.78+.25*c)*edge*mix(1.,hole,uPart),0.,.97);
   gl_FragColor=vec4(clamp(col,0.,1.2),a);}` });
 const m = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), mat); m.rotation.x = -Math.PI / 2; m.position.y = 45.4; m.frustumCulled = false; m.visible = false; m.name = 'oredor-cloud'; m.userData._hdTag = 1; m.renderOrder = 4;
 cloud = { mesh: m, mat }; return cloud;
}
// Wind on the ridge, seen as snow streaks.
let streaks = null;
function buildStreaks(){ const n = 70, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
 const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: .09, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
 m.frustumCulled = false; m.userData._hdTag = 1; streaks = { mesh: m, p, n, seed: Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]) }; return streaks; }

// ─── The beacon: a gold beam over the trailhead, seen from the whole city ─
//  Drawn no further than 320 m from the camera and scaled toward it, like the
//  painted peak, so it keeps its bearing and angular width at any distance.
const BEACON = { x: 0.5, y: 3, z: 303, h: 220, r: 2.4 };
let beacon = null;
function buildBeacon(){
 const geo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true); geo.translate(0, .5, 0);
 const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { uA: { value: 1 }, uTime: { value: 0 } },
  vertexShader: `varying vec3 vN;varying vec3 vV;varying float vY;void main(){vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);vY=position.y;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader: `uniform float uA,uTime;varying vec3 vN;varying vec3 vV;varying float vY;void main(){float f=clamp(abs(dot(normalize(vN),normalize(vV))),0.,1.);float core=f*f;float y=clamp(vY,0.,1.);float fade=(1.-smoothstep(.35,1.,y))*smoothstep(0.,.02,y);float pulse=.85+.15*sin(uTime*1.7-y*30.);gl_FragColor=vec4(vec3(1.,.78,.38)*core*fade*pulse*uA,1.);}` });
 const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 6; m.name = 'oredor-beacon'; m.userData._hdTag = 1;
 beacon = { mesh: m, mat }; return beacon;
}
const bv = new THREE.Vector3();

// ─── Air: the feed's haze, the whiteout, the clear air above ─────────────
let air = { blend: 0, f: 0 };
const haze = new THREE.Color(0x6f6a84), white = new THREE.Color(0xdfe4ea), high = new THREE.Color(0xb6c4d8);
if (window.FCRealLight) FCRealLight.zones.push(c => {
 const b = air.blend; if (!b || !c.fog || !('density' in c.fog)) return; const f = air.f;
 if (f < 38){ const k = b * (1 - smooth(20, 38, f)) * .45; c.fog.color.lerp(haze, k); c.fog.density = lerp(c.fog.density, Math.max(c.fog.density, .0065), k); }
 const w = b * smooth(39, 45.5, f) * (1 - smooth(49, 53, f));
 if (w > 0){ c.fog.color.lerp(white, w * .95); c.fog.density = lerp(c.fog.density, .055, w); }
 const a = b * smooth(51, 54, f);
 if (a > 0){ c.fog.color.lerp(high, a * .7); c.fog.density = lerp(c.fog.density, .0016, a); }
});

// ─── Posted fears: the first monsters ────────────────────────────────────
const FEAR_TYPE = 'posted-fear';
if (typeof ENEMY_TYPES !== 'undefined') ENEMY_TYPES[FEAR_TYPE] = { name: 'POSTED FEAR', hp: 64, dmg: 12, speed: 3.3, height: 2.3, detectRange: 17, attackRange: 2.1, attackCooldown: 1.35, rewardCredits: [10, 22], flying: false, colors: {} };
if (typeof HITBOX !== 'undefined') HITBOX[FEAR_TYPE] = { r: .5, from: 0, to: 2.3 };
const fearFaces = CANON.fears.map(f => canvasTex(256, 128, (g, W, H) => { g.fillStyle = '#2a0a12'; g.fillRect(0, 0, W, H); g.strokeStyle = '#ff4a5e'; g.lineWidth = 4; g.strokeRect(3, 3, W - 6, H - 6); g.fillStyle = '#ffd9de'; g.font = '700 21px system-ui, sans-serif'; g.textBaseline = 'top'; wrap(g, f[0], 12, 12, W - 24, 25, 4); }));
let fearMats = null;
const makeMesh = Enemy.prototype.makeMesh;
Enemy.prototype.makeMesh = function(rng){
 if (this.type !== FEAR_TYPE) return makeMesh.apply(this, arguments);
 fearMats ||= { body: new THREE.MeshLambertMaterial({ color: 0x141218 }), eye: new THREE.MeshBasicMaterial({ color: 0xff4a5e }), faces: fearFaces.map(t => new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })) };
 const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const bx = (w, h, d, x, y, z, m = fearMats.body) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
 body.add(bx(.46, 1.05, .3, 0, 1.45, 0));
 const face = new THREE.Mesh(new THREE.PlaneGeometry(1.15, .58), fearMats.faces[this.fearIndex ?? 0]); face.position.set(0, 2.18, .02); face.rotation.y = Math.PI / 2; body.add(face);
 body.add(bx(.06, .06, .06, .17, 1.82, .08, fearMats.eye), bx(.06, .06, .06, .17, 1.82, -.08, fearMats.eye));
 this.leftArm = bx(.1, 1.15, .1, 0, 1.25, .34); this.rightArm = bx(.1, 1.15, .1, 0, 1.25, -.34); body.add(this.leftArm, this.rightArm);
 this.leftLeg = bx(.12, .95, .12, 0, .47, .14); this.rightLeg = bx(.12, .95, .12, 0, .47, -.14); g.add(this.leftLeg, this.rightLeg);
 this.body = body; g.traverse(o => { if (o.isMesh){ o.castShadow = false; o.userData._hdTag = 1; } });
 return g;
};
const live = new Map(); // fear index -> enemy
function standAt(x, z, y){ const s = shSurfaceY(x, z, y + 1.3); if (s < 1 || s - y > 1.2 || y - s > 3.2) return null; if (typeof blockedAt === 'function' && blockedAt(x, s + .02, z, .32, 2.2)) return null; return s; }
function fearUpdate(dt){
 if (this.state === 'dead') return;
 const t = performance.now() / 1000, p = Player.position, dx = p.x - this.position.x, dz = p.z - this.position.z, dist = Math.hypot(dx, dz), dy = feet() - this.position.y;
 const calm = (typeof Peace !== 'undefined' && Peace.on) || god();
 if (this.hitFlash > 0){ this.hitFlash -= dt; this.group.traverse(o => { if (o.material?.emissive) o.material.emissive.setRGB(Math.max(0, this.hitFlash) * 3, 0, 0); }); }
 if (!calm && dist < this.def.detectRange && Math.abs(dy) < 7){ if (this.state === 'patrol'){ tone({ f0: 70, f1: 50, gain: .07, dur: .6, type: 'sawtooth', filter: 'lowpass', ff0: 400 }); } this.state = dist < this.def.attackRange && Math.abs(dy) < 2.2 ? 'attack' : 'alert'; }
 else if (this.state !== 'patrol' && (calm || dist > this.def.detectRange * 1.5)) this.state = 'patrol';
 let spd = 0;
 if (this.state === 'alert'){ this.direction = Math.atan2(dz, dx); spd = this.def.speed * (.55 + .7 * Math.max(0, Math.sin(t * 3.1 + this.seed * 9))); }
 else if (this.state === 'patrol'){ const hx = this.home.x - this.position.x, hz = this.home.z - this.position.z; this.patrolTimer -= dt; if (Math.hypot(hx, hz) > 5) this.direction = Math.atan2(hz, hx); else if (this.patrolTimer <= 0){ this.direction = Math.random() * TAU; this.patrolTimer = 2 + Math.random() * 3; } spd = this.def.speed * .3; }
 else { this.direction = Math.atan2(dz, dx); this.attackTimer -= dt; if (this.attackTimer <= 0){ this.attackTimer = this.def.attackCooldown; this.lunge = .35; if (!calm && dist < this.def.attackRange + .3){ if (typeof spawnDamageNumber === 'function') spawnDamageNumber(p.x, p.y + .5, p.z, this.def.dmg, false); window.damagePlayer?.(this.def.dmg); } } if (dist > this.def.attackRange * 1.1) this.state = 'alert'; }
 if (spd > 0){ const step = spd * Math.min(dt, .05), nx = this.position.x + Math.cos(this.direction) * step, nz = this.position.z + Math.sin(this.direction) * step, s = standAt(nx, nz, this.position.y);
  if (s != null){ this.position.x = nx; this.position.z = nz; this.ty = s; } else if (this.state === 'patrol') this.patrolTimer = 0; }
 this.position.y += ((this.ty ?? this.position.y) - this.position.y) * Math.min(1, dt * 10);
 this.lunge = Math.max(0, (this.lunge || 0) - dt);
 const ph = t * (spd > 1 ? 9 : 3);
 this.leftLeg.rotation.z = Math.sin(ph) * .45 * (spd > 0 ? 1 : .2); this.rightLeg.rotation.z = -this.leftLeg.rotation.z;
 this.leftArm.rotation.z = -.4 - this.lunge * 3 + Math.sin(ph * .5) * .15; this.rightArm.rotation.z = -.4 - this.lunge * 3 - Math.sin(ph * .5) * .15;
 this.body.rotation.z = Math.sin(t * 2.1 + this.seed * 5) * .08 - this.lunge * .6;
 this.group.position.set(this.position.x, this.position.y, this.position.z); this.group.rotation.y = -this.direction;
}
function spawnFear(n){
 const [px, pz] = FEARS[n]; let best = null, bd = Infinity;
 for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++){ const x = Math.floor(px) + dx, z = Math.floor(pz) + dz; if (!inZone(x, z) || KIND[gi(x, z)] !== K.TRAIL) continue; const d = Math.hypot(dx, dz); if (d < bd){ bd = d; best = [x + .5, z + .5]; } }
 if (!best) best = [px, pz];
 const e = new (class extends Enemy { makeMesh(rng){ this.fearIndex = n; return super.makeMesh(rng); } })(FEAR_TYPE, best[0], best[1], new RNG('oredor-fear:' + n + ':' + Math.random()));
 e.seed = hash(n, 7); e.home = { x: best[0], z: best[1] }; e.position.y = e.ty = surfAt(best[0], best[1]); e.group.position.copy(e.position); e.update = fearUpdate; e.oredor = n;
 const die = e.die; e.die = function(){ const was = this.state; die.call(this); if (was !== 'dead') quell(n, this); };
 State.scene.add(e.group); State.enemies.push(e); live.set(n, e);
 burst(best[0], e.position.y + 1.5, best[1], { count: 14, color: 0xff4a5e, size: .07, speed: 3, life: .7, grav: 2 });
 return e;
}
function quell(n, e){
 if (!S.quelled.includes(n)){ S.quelled.push(n); save(); }
 live.delete(n); setPostCell(feed.fearAt[n], CELL.dead(n));
 burst(e.position.x, e.position.y + 1.4, e.position.z, { count: 24, color: 0xeef1fb, size: .06, speed: 4, life: 1, grav: 1 });
 notice(CANON.lines.quelled);
}
function despawnFear(n){ const e = live.get(n); if (!e) return; e.group.removeFromParent(); const i = State.enemies.indexOf(e); if (i >= 0) State.enemies.splice(i, 1); live.delete(n); }

// ─── HUD: altitude chip, prompt, title card, fades ───────────────────────
const css = document.createElement('style');
css.textContent = `#oredor-alt{position:fixed;top:94px;left:50%;transform:translateX(-50%);z-index:125000;pointer-events:none;font:600 12px/1.2 system-ui,sans-serif;letter-spacing:.14em;color:#eef1f6;background:#0f1520b8;border:1px solid #5d6d7855;border-radius:14px;padding:7px 14px;white-space:nowrap}#oredor-alt b{color:#f0bf62;font-weight:700}#oredor-alt[hidden]{display:none}
#oredor-prompt{position:fixed;bottom:110px;left:50%;transform:translateX(-50%);z-index:125001;background:#0f1820e6;color:#eef2f3;border:1px solid #5d6d78;border-left:3px solid #f0bf62;border-radius:22px;padding:13px 22px;font:600 14px/1.3 system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(6px);max-width:calc(100vw - 32px)}#oredor-prompt[hidden]{display:none}#oredor-prompt.hint{cursor:default;border-left-color:#8fb3d9}
#oredor-card{position:fixed;inset:0;z-index:125002;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity 1.2s ease;text-align:center;color:#f4f6fb;text-shadow:0 2px 18px #000a}#oredor-card.on{opacity:1}#oredor-card h2{margin:0;font:700 clamp(34px,7vw,72px)/1 system-ui,sans-serif;letter-spacing:.32em;padding-left:.32em}#oredor-card p{margin:14px 0 0;font:500 clamp(13px,2vw,17px)/1.4 system-ui,sans-serif;letter-spacing:.08em;color:#f0bf62;max-width:min(620px,86vw)}
#oredor-fade{position:fixed;inset:0;z-index:125003;pointer-events:none;background:#000;opacity:0;transition:opacity .45s ease}#oredor-fade.white{background:#f4f8ff}`;
document.head.append(css);
const hud = document.createElement('div'); hud.id = 'oredor-alt'; hud.hidden = true;
const prompt = document.createElement('button'); prompt.id = 'oredor-prompt'; prompt.type = 'button'; prompt.hidden = true;
const card = document.createElement('div'); card.id = 'oredor-card'; card.innerHTML = '<h2></h2><p></p>';
const fade = document.createElement('div'); fade.id = 'oredor-fade';
document.body.append(hud, prompt, card, fade);
let cardTimer = 0;
function showCard(title, line, ms = 4200){ card.querySelector('h2').textContent = title; card.querySelector('p').textContent = line; card.classList.add('on'); clearTimeout(cardTimer); cardTimer = setTimeout(() => card.classList.remove('on'), ms); }
function notice(text){ try { toast(text, 'info'); } catch {} }
function fadeTo(color, cb){ fade.classList.toggle('white', color === 'white'); fade.style.opacity = '1'; setTimeout(() => { try { cb(); } finally { setTimeout(() => { fade.style.opacity = '0'; }, 250); } }, reduced.matches ? 60 : 480); }
function moveTo(x, y, z, yaw){ ensure(x, z, 2); Player.mode = 'walk'; Player.position.set(x, y + Player.height + .02, z); Player.velocity.set(0, 0, 0); if (yaw != null) Player.yaw = yaw; State.keys?.clear?.(); if (typeof shTouchReleaseAll === 'function') shTouchReleaseAll(); }

// ─── Actions near you ────────────────────────────────────────────────────
let near = null;
const STAKE = { x: 2.5, z: 318 };
const CAMP_SPOT = [[0, 3, 314, Math.PI], [-30, 24, 417, Math.PI], [-20, 46, 491, Math.PI], [8, 61, 604.5, 0]];
function useNear(){
 if (!near || !active()) return;
 if (near.id === 'take') takeShard();
 else if (near.id === 'descend') fadeTo('black', () => { moveTo(0.5, 3, 314.5, Math.PI); notice('Back at the trailhead. The lines stay fixed.'); });
 else if (near.id === 'clip'){ const c = near.camp, [x, y, z, yaw] = CAMP_SPOT[c]; fadeTo('black', () => { moveTo(x + .5, y, z + .5, yaw); notice(CANON.camps[c] + ' · ' + fmt(alt(y)) + ' m'); }); }
}
prompt.onclick = () => useNear();
window.addEventListener('keydown', e => { if (e.code === 'KeyE' && !e.repeat && near && !near.hint && active() && !State.ui.paused && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){ e.preventDefault(); e.stopImmediatePropagation(); useNear(); } }, true);

// ─── The summit ──────────────────────────────────────────────────────────
let seq = null;
function takeShard(){
 if (S.sight || god()) return;
 S.sight = true; S.camp = 3; save(); O.sight = true; seq = { t: 0, t0: performance.now() };
 tone({ f0: 220, f1: 880, gain: .12, dur: 2.4, type: 'sine' }); tone({ f0: 330, f1: 1320, gain: .06, dur: 2.8, type: 'triangle', delay: .3 });
 fade.classList.add('white'); fade.style.transition = 'opacity 1.4s ease'; fade.style.opacity = '.85';
 setTimeout(() => { fade.style.opacity = '0'; setTimeout(() => { fade.style.transition = ''; fade.classList.remove('white'); }, 1500); applySight(); showCard(CANON.sight[0], CANON.sight[1], 6500); }, reduced.matches ? 200 : 1300);
 try { window.dispatchEvent(new CustomEvent('fc-oredor-sight', { detail: { seed: scope } })); } catch {}
}
function applySight(){
 if (feed) feed.mat.uniforms.uMap.value = S.sight ? feed.sightTex : feed.tex;
 if (props){ props.seams.visible = S.sight; props.shard.visible = props.halo.visible = !S.sight || !!(seq && seq.t < 1.6); }
}

// ─── Movement on the mountain: no double jump, the ropes, the wind ──────
let rope = null, wind = { t: 0, next: 4, gust: 0, dir: 1 }, onRidge = false, lastSafe = null;
function ropeAt(){ const p = Player.position, f = feet();
 for (const r of ROPES) if (Math.abs(p.x - (r.x + .5)) < .95 && p.z > r.face - 1.25 && p.z < r.face + .15 && f > r.y0 - .3 && f < r.y1 + .05) return r; return null; }
const input = window.updateWalkInput;
window.updateWalkInput = function(dt){
 const zone = Player.mode === 'walk' && inZone(Player.position.x, Player.position.z) && !window.FCWorldStudio?.flying;
 if (zone && !Player.onGround && window.FCFlow) FCFlow.airUsed = true;
 const r = input.apply(this, arguments);
 if (!zone){ rope = null; return r; }
 rope = ropeAt();
 if (rope){
  const fwd = -Math.cos(Player.yaw), w = State.keys.has('w'), s = State.keys.has('s'), f = feet();
  if (w && fwd > .25){ Player.velocity.y = f > rope.y1 - .35 ? 4.2 : 2.7; Player.velocity.x *= .3; Player.velocity.z = Math.max(Player.velocity.z, .6); if (Math.random() < dt * 3) tone({ noise: true, filter: 'bandpass', ff0: 900, ff1: 700, gain: .025, dur: .08 }); }
  else if (s) Player.velocity.y = -2.2;
  else if (f > rope.y0 + .2) Player.velocity.y = 0;
 }
 if (onRidge && wind.gust > 0){ Player.velocity.x += wind.dir * wind.gust * .95; }
 return r;
};

// ─── Guidance: the next thing to reach, and which way it is ──────────────
const GOALS = [[6, 'CAMP I'], [8, 'THE ROPE'], [12, 'CAMP II'], [14, 'THE ROPE'], [16, 'THE RIDGE'], [18, 'THE SUMMIT']];
function nextGoal(p, f){
 const T = nearestSeg(p.x, p.z); let i = SEGS.indexOf(T.s); if (i < 0) i = 0;
 // Off the trail and below it: the trailhead is still the way in.
 if (T.d > 14 && f < T.y - 3) i = 0;
 const g = GOALS.find(([n]) => n > i + (T.t > .97 ? 1 : 0)) || GOALS[GOALS.length - 1], w = ROUTE[g[0]];
 return { label: g[1], x: w[0] + .5, z: w[1] + .5 };
}
function bearing(x, z){ const dx = x - Player.position.x, dz = z - Player.position.z, y = Player.yaw;
 return Math.atan2(dx * Math.cos(y) - dz * Math.sin(y), -dx * Math.sin(y) - dz * Math.cos(y)) * 180 / Math.PI; }

// ─── Each frame ──────────────────────────────────────────────────────────
let built = false, last = 0, inside = false;
function build(){
 if (built || !State.scene) return; built = true; buildGrid();
 root = new THREE.Group(); root.name = 'mount-oredor-ascent';
 root.add(buildFeed().mesh, buildProps(), buildCloud().mesh, buildStreaks().mesh, buildBeacon().mesh);
 State.scene.add(root); applySight();
}
function tick(now){
 requestAnimationFrame(tick);
 const dt = Math.min(.1, Math.max(0, (now - (last || now)) / 1000)); last = now;
 if (!State.scene || typeof Player === 'undefined' || !State.citySeed) return;
 load(); build(); if (root.parent !== State.scene) State.scene.add(root);
 const p = Player.position, f = feet(), t = now / 1000, zone = inZone(p.x, p.z), on = active() && !State.ui.paused;
 const depth = zone ? clamp(Math.min(p.z - ZONE.z0, p.x - ZONE.x0, ZONE.x1 - p.x, ZONE.z1 - p.z) / 18) : 0;
 air.blend = depth; air.f = f;
 const hour = (((State.dayTime || 0) / 60) % 24 + 24) % 24, day = clamp(Math.sin((hour - 6) / 12 * Math.PI) * 2.2 + .15);
 // Feed.
 const nearFeed = p.z > 200 && p.z < 520 && Math.abs(p.x) < 200;
 feed.mesh.visible = nearFeed; feed.mat.uniforms.uTime.value = t; feed.mat.uniforms.uFade.value = .55 + .45 * day;
 // The painted peak: the upper mountain below the cloud, gone inside it.
 O.mist = zone ? smooth(34, 45, f) * .98 : null; O.hold = zone && f > 44.5;
 // Cloud deck below you.
 cloud.mesh.visible = zone && f > 46.5; cloud.mesh.position.set(p.x, 45.4, p.z); cloud.mat.uniforms.uTime.value = t; cloud.mat.uniforms.uDay.value = day; cloud.mat.uniforms.uCenter.value.set(p.x, p.z);
 // Props only near the mountain.
 props.group.visible = p.z > 260 && Math.abs(p.x) < 220;
 props.shard.rotation.y = t * .6; props.shard.position.y = SUMMIT.y + 2.7 + Math.sin(t * 1.3) * .12; props.halo.lookAt(State.camera.position); props.halo.material.opacity = .35 + .15 * Math.sin(t * 2);
 { const cam = State.camera.position; bv.set(BEACON.x, BEACON.y, BEACON.z).sub(cam); const dist = bv.length(), k = Math.min(1, 320 / Math.max(dist, 1));
  beacon.mesh.position.copy(cam).addScaledVector(bv, k); beacon.mesh.scale.set(BEACON.r * k, BEACON.h * k, BEACON.r * k);
  const flat = Math.hypot(cam.x - BEACON.x, cam.z - BEACON.z); beacon.mat.uniforms.uA.value = (S.sight ? 0 : 1) * smooth(18, 60, flat); beacon.mat.uniforms.uTime.value = t; beacon.mesh.visible = beacon.mat.uniforms.uA.value > .01; }
 if (seq){ seq.t = (now - seq.t0) / 1000; const k = clamp(seq.t / 1.4); props.shard.position.lerp(new THREE.Vector3(p.x, p.y - .3, p.z), k * .5); props.shard.scale.setScalar(lerp(1, .05, k)).multiply(new THREE.Vector3(.7, 2.1, .7)); cloud.mat.uniforms.uPart.value = Math.sin(clamp(seq.t / 5) * Math.PI); if (seq.t > 5.2){ seq = null; cloud.mat.uniforms.uPart.value = 0; } applySight(); }
 // Fears: alive while you are on the slopes below them.
 for (let n = 0; n < FEARS.length; n++){
  const [x, z] = FEARS[n], d = Math.hypot(p.x - x, p.z - z), wanted = on && zone && !S.quelled.includes(n) && f < 34 && d < 26 && !live.has(n) && !god();
  if (wanted && Player.mode === 'walk') spawnFear(n);
  if (live.has(n) && (d > 70 || !zone || live.get(n).state === 'dead' && !S.quelled.includes(n))) despawnFear(n);
 }
 // Ridge and wind.
 onRidge = zone && p.z > RIDGE.z0 && p.z < RIDGE.z1 + 4 && f > 50;
 if (onRidge){ wind.t += dt; if (wind.gust <= 0 && wind.t > wind.next){ wind.t = 0; wind.next = 5 + Math.random() * 4; wind.gust = 1.15; wind.dir = Math.random() < .5 ? -1 : 1; tone({ noise: true, filter: 'bandpass', ff0: 500, ff1: 1400, q: 1.5, gain: .09, dur: 1.4 }); } if (wind.gust > 0) wind.gust -= dt * .85; }
 else { wind.gust = 0; }
 const sv = streaks.mesh.material; sv.opacity = onRidge ? clamp(wind.gust) * .8 : 0; streaks.mesh.visible = sv.opacity > .01;
 if (streaks.mesh.visible){ for (let i = 0; i < streaks.n; i++){ const s = streaks.seed[i], ph = (t * (1.6 + s[2]) + s[0]) % 1; streaks.p.set([p.x - wind.dir * 12 + wind.dir * ph * 24, f + s[1] * 3, p.z + (s[2] - .5) * 18], i * 3); } streaks.mesh.geometry.attributes.position.needsUpdate = true; }
 // The fixed line along the ridge catches a fall.
 if (zone && p.z > RIDGE.z0 && p.z < RIDGE.z1 + 6 && on){ const T = nearestSeg(p.x, p.z); if (T.d < 3 && Player.onGround && f > T.y - .6) lastSafe = [p.x, T.y, p.z]; if (T.s?.ridge || T.s?.b[3] === 'summit'){ if (f < T.y - 4.5 && lastSafe){ const [x, y, z] = lastSafe; lastSafe = null; fadeTo('black', () => { const back = nearestSeg(x, z - 3); moveTo(x, back.y, z - 3, 0); notice(CANON.lines.catch); }); } } }
 if (!on){ hud.hidden = true; prompt.hidden = true; near = null; inside = zone; return; }
 // Arrival, camps, the chip.
 if (zone && !inside && !S.seen){ S.seen = true; save(); showCard(CANON.name, CANON.sub, 4200); }
 inside = zone;
 let campHere = -1;
 for (let n = 0; n < CAMPS.length; n++){ const c = CAMPS[n]; if (Math.hypot(p.x - c.x, p.z - c.z) < c.r + 1.5 && Math.abs(f - c.y) < 1.6){ campHere = n; if (n > S.camp && n < 3 && !god()){ S.camp = n; save(); if (n > 0) notice(CANON.camps[n] + ' · ' + fmt(alt(c.y)) + ' m'); } } }
 const goal = S.sight ? null : zone ? nextGoal(p, f) : { label: 'TRAILHEAD', x: BEACON.x, z: BEACON.z };
 const pointer = goal ? ' · ' + goal.label + ' ' + fmt(Math.round(Math.hypot(goal.x - p.x, goal.z - p.z))) + ' m <i style="display:inline-block;font-style:normal;transform:rotate(' + Math.round(bearing(goal.x, goal.z)) + 'deg)">↑</i>' : '';
 hud.hidden = !zone && !goal;
 if (!hud.hidden) hud.innerHTML = zone ? 'MOUNT OREDOR · <b>' + fmt(alt(f)) + ' m</b>' + (campHere >= 0 ? ' · ' + CANON.camps[campHere] : '') + (god() ? ' · GOD MODE' : '') + pointer : 'FIRST MISSION · <b>MOUNT OREDOR</b>' + pointer;
 // What you can do here.
 near = null;
 if (zone && Player.mode === 'walk'){
  const sd = Math.hypot(p.x - (SUMMIT.x + .5), p.z - (SUMMIT.z + .5));
  if (god() && sd < 4) near = { id: 'god', label: CANON.lines.god, hint: true };
  else if (!S.sight && sd < 2.6 && f > 60.4) near = { id: 'take', label: CANON.lines.take };
  else if (S.sight && sd < 3.2 && f > 60.4 && !seq) near = { id: 'descend', label: CANON.lines.descend };
  else if (Math.hypot(p.x - STAKE.x, p.z - STAKE.z) < 2.2 && S.camp >= 1 && f < 4.5){ const c = Math.min(2, S.camp); near = { id: 'clip', camp: c, label: CANON.lines.clip(CANON.camps[c].replace(/ ·.*/, '')) }; }
  else if (rope || ROPES.some(r => Math.abs(p.x - (r.x + .5)) < 1.6 && p.z > r.face - 2.4 && p.z < r.face && Math.abs(f - r.y0) < .6)) near = { id: 'rope', label: CANON.lines.rope, hint: true };
 }
 prompt.hidden = !near; if (near && prompt.textContent !== near.label) prompt.textContent = near.label; prompt.classList.toggle('hint', !!near?.hint);
}
requestAnimationFrame(tick);

O.ascent = {
 version: VERSION, canon: CANON, zone: ZONE, route: ROUTE, camps: CAMPS, ropes: ROPES, summit: SUMMIT, fears: FEARS,
 get state(){ load(); return { ...S, quelled: [...S.quelled] }; }, get near(){ return near; }, get live(){ return live; }, get built(){ return built; },
 surfAt, alt, nearestSeg,
 debug: {
  get grid(){ buildGrid(); return { SURF, KIND, K, ms: GRID_MS, raised: GRID_RAISED, w: GW, d: GD, gi, cairns: CAIRNS.size }; },
  use: useNear, take: takeShard, reset(){ S = { seen: false, camp: -1, sight: false, quelled: [] }; save(); O.sight = false; for (const n of [...live.keys()]) despawnFear(n); if (feed) feed.fearAt.forEach((i, n) => setPostCell(i, CELL.fear(n))); applySight(); },
  goto(c){ const [x, y, z, yaw] = CAMP_SPOT[c]; moveTo(x + .5, y, z + .5, yaw); }, wind, get onRidge(){ return onRidge; }, get rope(){ return rope; }, air,
 },
};
})();
