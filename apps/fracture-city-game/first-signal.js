/* First Signal: an adventure the world performs instead of explaining.

   An incident you witness: the lights stutter across Common Ground, a courier
   staggers in and falls, people turn and run to her. Someone you follow: a
   mechanic kneels, lifts a pulsing key out of the courier's bag and leads you
   east. Something you do with your hands: plug a torn relay line back in,
   climb a fallen mast for its power cell, carry the cell under a gate she is
   holding. A place that answers: the Listening Station wakes around you and
   opens a door it did not have. A change everybody can see: the lamp you carry
   home lights the East Arcade, which was dead, and people use it afterwards.

   No step needs a panel. Prompts are verbs that appear beside the thing they
   act on. The optional records live under Tools.

   Everything here is local to one browser and one world seed, like the Outer
   Expanse journal. Other online residents do not see your actors. */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined' || typeof Chunk === 'undefined' || !window.FCNpcs || !window.FCNpcBrain || !window.FCExpanse) return;

// ─── Canon. Names and lines are yours to change; nothing else depends on them.
const CANON = {
 mechanic: 'Ives', courier: 'Tamsin', station: 'The Listening Station', arcade: 'The East Arcade',
 delay: 14,        // seconds on the hall floor before the incident
 lines: {
  bystanders: ['Hey! She is hurt!', 'That is a salt courier.', 'The east lamps just died.', 'Give her room!'],
  kneel: 'Easy. I have you.',
  call: 'This key is still calling its station. That station ran our east lamps. Come with me.',
  wait: ['This way!', 'Keep up!', 'It is pulling east.', 'Over here!'],
  relay: 'Her cart tore the line. Plug it back in.',
  relayDone: 'There. The mast still holds a cell. Climb.',
  cell: 'Bring it. I will hold the gate.',
  gate: 'Go! Go!',
  wake1: 'Oh.',
  wake2: 'It was not broken. It was waiting.',
  lamp: 'Home. Before it changes its mind.',
  niche: 'Here. Hand it over.',
  lights: 'Lights.',
  done: 'The East Arcade is open. Tea is on the house.',
  courierDone: 'You brought it back.',
  crowd: ['They are on!', 'The arcade is back.', 'Look at that.', 'About time.'],
  tea: ['On the house. You turned the lights on.', 'Mind the cup. It is hotter than it looks.', 'Salt tea. You get used to it.'],
  market: ['Lamps, wicks, small repairs.', 'Everything works. Ask before you test it.', 'Two for one, while the light holds.'],
  tale: [
   'The Listening Station was built to hear a tide. The tide was late. They kept listening.',
   'Its keepers lit a lamp so the boats could find the shore. There were no boats. They trimmed the wick anyway.',
   'Couriers still carry the keys. Nobody remembers who pays them.',
   'When the east lamps failed, a key woke up and started calling home.',
   'Somebody followed it. That part is new. I am still working on the ending.',
   'The lamp burns salt. Do not ask me how. Ask the tea.'],
 },
 records: [
  ['The courier’s tag', 'Stamped brass, worn smooth: SALT ROUTE 7. HOLDER CARRIES ONE KEY. DO NOT DELAY HOLDER.'],
  ['Relay plate', 'Riveted to the pylon: LINE 7 · STATION TO EAST ARCADE. IF DARK, FOLLOW THE LINE. Somebody did.'],
  ['Cell housing stencil', 'ONE CELL. ONE STATION. RETURN CELL TO MAST AFTER USE. Underneath, scratched by hand: no.'],
  [null, 'The rings were lying in the salt. The stones were lying in the salt. Then they were not. The door was the last thing it remembered.'],
  ['The tide lamp', 'Warm glass, no wick, no switch. It brightens when you walk toward the city and dims when you stop.'],
  [null, 'Dark since the line was cut. Lit by a lamp carried in from the flats. The tea stall claims it never closed.'],
 ],
};
CANON.records[3][0] = CANON.station; CANON.records[5][0] = CANON.arcade;

// ─── Places. The hall, the Seam road and the Saltwake starter region are the
//     same for every world seed, so these are fixed. Do not reorder: stage
//     numbers and these coordinates are the save format.
const TAU = Math.PI * 2, GY = 2, HY = 1;
const SITE = { x: 326, z: 22, court: 18, wall: 17.2 };
const P = {
 plug: [296.5, 14.6], socket: [290.6, 27.1], reel: [302.4, 26.7], pylonA: [290.6, 27.7], pylonB: [302.4, 27.7],
 relayPost: [293.6, 23.4], mastPost: [299, 14.8], gatePost: [307.4, 19.9], gate: [308.8, 22], watchPost: [316.5, 19], doorPost: [321, 19.2],
 cart: [294.4, 16.8], housing: [305.7, 11], plinth: [319.6, 25.6], lamp: [SITE.x, SITE.z],
 niche: [217.9, 32.5], installPost: [216.6, 32.5], stallA: [217.9, 27.5], stallB: [217.9, 37.5], arcade: [216, 32.5],
};
const OUT = [[212.5, 18], [217.5, 9.5], [218.4, -1.2], [221.5, -4.6], [236.5, -1.5], [240.5, 2.5], [262, 2.5], [285.5, 2.5], [285.5, 22.5], P.relayPost];
const BACK = [[306.5, 22], [289.5, 22.5], [285.5, 22.5], [285.5, 2.5], [262, 2.5], [240.5, 2.5], [236.5, -1.5], [221.5, -4.6], [218.4, -1.2], [217.5, 9.5], [213, 19.5], P.installPost];
const MAST = { x0: 292, z0: 9.4, z1: 12.6, run: 2.2, steps: 6 };
const ST = { IDLE: 0, INCIDENT: 1, FOLLOW: 2, RELAY: 3, CELL: 4, GATE: 5, WAKE: 6, LAMP: 7, HOME: 8, INSTALL: 9, DONE: 10 };

const B = window.FCNpcBrain;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const feet = () => Player.position.y - Player.height;
const d2 = (x, z, a) => Math.hypot(x - a[0], z - a[1]);
const pd = a => d2(Player.position.x, Player.position.z, a);
const loaded = (x, z) => State.chunkMap.has(Math.floor(x / VOX_W) + ',' + Math.floor(z / VOX_W));
const tone = o => { try { return typeof shTone === 'function' ? shTone(o) : null; } catch { return null; } };
const burst = (x, y, z, o) => { try { if (typeof shBurst === 'function') shBurst(x, y, z, o); } catch {} };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const tierScale = () => ({ perf: .6, low: .8 })[window.HD?.tier] ?? 1;

// ─── Saved progress ─────────────────────────────────────────────────────────
let S = { stage: 0, rec: [], sat: null }, scope = null, prefs = { subs: true, voice: true };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('fc-signal-prefs')) || {}); } catch {}
function savePrefs(){ try { localStorage.setItem('fc-signal-prefs', JSON.stringify(prefs)); } catch {} }
function load(){
 S = { stage: 0, rec: [], sat: null };
 try {
  const raw = JSON.parse(localStorage.getItem('fc-signal-v1:' + scope));
  if (raw && Number.isInteger(raw.stage) && raw.stage >= 0 && raw.stage <= ST.DONE){
   S.stage = raw.stage;
   if (Array.isArray(raw.rec)) S.rec = raw.rec.filter(n => Number.isInteger(n) && n >= 0 && n < CANON.records.length);
   if (Array.isArray(raw.sat) && raw.sat.length === 2 && raw.sat.every(Number.isFinite)) S.sat = raw.sat;
  }
 } catch {}
 // Moments that were mid-performance resume from the last thing that held.
 S.stage = ({ [ST.INCIDENT]: ST.IDLE, [ST.GATE]: ST.CELL, [ST.WAKE]: ST.LAMP, [ST.INSTALL]: ST.HOME })[S.stage] ?? S.stage;
 carry = S.stage === ST.HOME ? 'lamp' : null;
}
let saveWarned = false;
function save(){ try { localStorage.setItem('fc-signal-v1:' + scope, JSON.stringify(S)); return true; } catch { if (!saveWarned){ saveWarned = true; toast('First Signal progress could not be saved on this device.', 'warn'); } return false; } }
function record(n){ if (!S.rec.includes(n)) S.rec.push(n); }
function setStage(n){ S.stage = n; save(); }

// ─── Ground, routes and walking ─────────────────────────────────────────────
const NR = .3, NH = 1.7;
//  Where a body would stand at (x, z) coming from height y, or null. The highest
//  ground under the footprint counts, so a kerb touched by the leading edge
//  lifts the whole body instead of reading as a wall.
const CORNERS = [[-NR, -NR], [NR, -NR], [-NR, NR], [NR, NR]];
function stand(x, z, y){
 let s = shSurfaceY(x, z, y + 1.3); for (const [ox, oz] of CORNERS){ const c = shSurfaceY(x + ox, z + oz, y + 1.3); if (c > s) s = c; }
 if (s < 1 || Math.abs(s - y) > 1.05) return null; return blockedAt(x, s + .01, z, NR, NH) ? null : s;
}
function walkable(a, b){
 const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .45)); let y = a.y;
 for (let i = 1; i <= n; i++){ const t = i / n; y = stand(lerp(a.x, b.x, t), lerp(a.z, b.z, t), y); if (y == null) return false; }
 return true;
}
//  A* on the one-metre grid, against live collision, so player builds count.
function route(from, to, cap = 9000){
 const sx = Math.floor(from.x), sz = Math.floor(from.z), ex = Math.floor(to.x), ez = Math.floor(to.z);
 const x0 = Math.min(sx, ex) - 26, x1 = Math.max(sx, ex) + 26, z0 = Math.min(sz, ez) - 26, z1 = Math.max(sz, ez) + 26;
 const key = (x, z) => x * 4096 + z, heap = [], g = new Map(), ys = new Map(), par = new Map(), done = new Set();
 const push = n => { heap.push(n); let i = heap.length - 1; while (i > 0){ const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
 const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let i = 0; for (;;){ const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
 const sy = stand(sx + .5, sz + .5, from.y) ?? from.y, sk = key(sx, sz);
 g.set(sk, 0); ys.set(sk, sy); push([0, sx, sz]);
 for (let runs = 0; heap.length && runs < cap; runs++){
  const [, x, z] = pop(), k = key(x, z); if (done.has(k)) continue; done.add(k);
  if (Math.abs(x - ex) + Math.abs(z - ez) <= 1){
   const pts = [{ x: to.x, y: ys.get(k), z: to.z }]; let q = k;
   while (q !== undefined){ const qz = ((q % 4096) + 4096 + 2048) % 4096 - 2048, qx = (q - qz) / 4096; pts.push({ x: qx + .5, y: ys.get(q), z: qz + .5 }); q = par.get(q); }
   pts.reverse(); pts[0] = { x: from.x, y: sy, z: from.z };
   const out = [pts[0]]; for (let i = 0; i < pts.length - 1;){ let j = Math.min(pts.length - 1, i + 14); while (j > i + 1 && !walkable(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
   out.shift(); return out;
  }
  const y = ys.get(k), open = {};
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]){
   const nx = x + dx, nz = z + dz; if (nx < x0 || nx > x1 || nz < z0 || nz > z1) continue;
   const nk = key(nx, nz); if (done.has(nk)) continue;
   const s = stand(nx + .5, nz + .5, y); if (dx && !dz) open[dx] = s != null; if (dz && !dx) open['z' + dz] = s != null;
   if (s == null || (dx && dz && !(open[dx] && open['z' + dz]))) continue;
   const c = g.get(k) + (dx && dz ? 1.42 : 1);
   if (c < (g.get(nk) ?? Infinity)){ g.set(nk, c); ys.set(nk, s); par.set(nk, k); push([c + Math.hypot(nx - ex, nz - ez), nx, nz]); }
  }
 }
 return null;
}
function spotNear(x, z, r0, r1, y, test){
 for (let i = 0; i < 28; i++){ const a = rnd(0, TAU), r = rnd(r0, r1), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, s = stand(px, pz, y); if (s != null && (!test || test(px, s, pz))) return { x: px, y: s, z: pz }; }
 return null;
}

// ─── Collision the meshes need. Chunks take a copy when they generate; doors
//     and gates switch theirs on and off while the chunks are loaded.
const solids = [];
function solid(id, x, y, z, w, h, d, on = true){ solids.push({ id, on, minX: x - w / 2, maxX: x + w / 2, minY: y, maxY: y + h, minZ: z - d / 2, maxZ: z + d / 2 }); }
function inject(c){ const ox = c.originX, oz = c.originZ; for (const s of solids) if (s.on && s.maxX > ox - 1 && s.minX < ox + VOX_W + 1 && s.maxZ > oz - 1 && s.minZ < oz + VOX_W + 1) c.collisionAABBs.push({ minX: s.minX, maxX: s.maxX, minY: s.minY, maxY: s.maxY, minZ: s.minZ, maxZ: s.maxZ, fcSignal: s.id }); }
function syncSolids(){ for (const c of State.chunkMap.values()){ const a = c.collisionAABBs; if (!a) continue; for (let i = a.length - 1; i >= 0; i--) if (a[i].fcSignal) a.splice(i, 1); inject(c); } }
function setSolid(id, on){ let changed = false; for (const s of solids) if (s.id === id && s.on !== on){ s.on = on; changed = true; } if (changed) syncSolids(); }

(function blueprint(){
 // East Arcade, against the hall's east wall.
 for (const z of [P.stallA[1], P.stallB[1]]) solid('stall', 217.9, HY, z, .8, 1, 2.4);
 solid('niche', 217.95, HY, P.niche[1], .9, 1, 1);
 solid('screen', 218.9, HY, P.niche[1], .4, 3.6, 4);
 solid('bench', 214.3, HY, 41, .5, .46, 3);
 // Relay pylons, the cart, the fallen mast.
 for (const p of [P.pylonA, P.pylonB]) solid('pylon', p[0], GY, p[1], .7, 6, .7);
 solid('cart', P.cart[0], GY, P.cart[1], 1.5, .8, 1);
 for (let i = 0; i < MAST.steps; i++){ const last = i === MAST.steps - 1, x = MAST.x0 + i * MAST.run; solid('mast', x + (last ? 1.7 : MAST.run / 2), GY, 11, last ? 3.4 : MAST.run, i + 1, MAST.z1 - MAST.z0); }
 solid('housing', 305.9, GY + MAST.steps, 11, .8, .9, .9);
 // Station: ring wall with a gate to the west, the drum, plinth and pedestal.
 for (let k = 0; k < 60; k++){ const a = k / 60 * TAU; if (Math.abs(a - Math.PI) < .115) continue; solid('wall', SITE.x + Math.cos(a) * SITE.wall, GY, SITE.z + Math.sin(a) * SITE.wall, 1.3, 2.6 + (hashStr('fs-wall' + k) % 100) / 45, 1.3); }
 for (const z of [19.75, 24.25]) solid('gatepost', P.gate[0], GY, z, 1, 4.2, 1);
 solid('gate', P.gate[0], GY, 22, .6, 3.2, 3.5);
 solid('plinth', P.plinth[0], GY, P.plinth[1], .9, 1, .9);
 for (let k = 0; k < 8; k++){ const a = k * Math.PI / 4, cx = SITE.x + Math.cos(a) * 3.3, cz = SITE.z + Math.sin(a) * 3.3; for (const t of [-.95, 0, .95]) solid(k === 4 ? 'door' : 'drum', cx - Math.sin(a) * t, GY, cz + Math.cos(a) * t, .95, 3.6, .95); }
 solid('roof', SITE.x, GY + 3.6, SITE.z, 7, .4, 7);
 solid('pedestal', SITE.x, GY, SITE.z, .7, .9, .7);
})();

// ─── Terrain: a flat apron and court in the Saltwake's north-west flats ─────
const generate = Chunk.prototype.generate;
Chunk.prototype.generate = function(){
 const out = generate.apply(this, arguments);
 try { terrain(this); inject(this); } catch (e){ console.warn('[first-signal] terrain', e); }
 return out;
};
function terrain(c){
 const ox = c.originX, oz = c.originZ;
 if (ox + VOX_W <= 286 || ox >= 350 || oz + VOX_W <= 0 || oz >= 46) return;
 const r = FCExpanse.region(c.cx, c.cz); if (!r || r.def.id !== 'saltwake') return;
 for (let lx = 0; lx < VOX_W; lx++) for (let lz = 0; lz < VOX_W; lz++){
  const x = ox + lx, z = oz + lz, d = Math.hypot(x + .5 - SITE.x, z + .5 - SITE.z);
  const apron = x >= 288 && x < 309 && z >= 4 && z < 31, court = d < SITE.court + .5;
  if (apron || court){
   let top = r.def.ground;
   if (court) top = d < 3.9 ? 184 : (Math.abs(d - 9) < .6 || Math.abs(d - 14) < .6) ? 181 : top;
   else if (z >= 20 && z < 25) top = x % 4 === 0 && (z === 20 || z === 24) ? 184 : 181;
   c.vSet(lx, 0, lz, B_SOIL); c.vSet(lx, 1, lz, top);
   for (let y = 2; y < VOX_H; y++) c.vSet(lx, y, lz, 0);
  } else if (d < SITE.court + 6 || (x >= 286 && x < 312 && z >= 1 && z < 34)){
   // No needles leaning over the site; the natural ground stays.
   for (let y = FCExpanse.height(x, z, r); y < VOX_H; y++) c.vSet(lx, y, lz, 0);
  }
 }
}

// ─── Materials and batched boxes ────────────────────────────────────────────
let M = null, unitBox = null;
function materials(){
 if (M) return M;
 const std = (color, rough = .85, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
 const glow = color => new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: .5, emissive: color, emissiveIntensity: 0 });
 const add = (color, opacity = 0) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
 unitBox = new THREE.BoxGeometry(1, 1, 1);
 M = { stone: std(0xcbbf9e), dark: std(0x2a2e3e, .7), bronze: std(0x8a6a3a, .45, .55), steel: std(0x4d5861, .6, .4), rust: std(0x6e4a35, .9), wood: std(0x6b4a3a), canvas: std(0x3a3d42, .95), parcel: std(0xe2c044, .8), bird: new THREE.MeshBasicMaterial({ color: 0x1b1c20, side: THREE.DoubleSide }),
  amber: glow(0xf0c060), violet: glow(0xb59bea), inlay: glow(0xb59bea), bulbs: glow(0xffd28a), goods: std(0xe9e5dc, .6), awning: std(0x3a3d42, .95),
  beam: add(0xc9b3ff), pool: add(0xffc878), halo: add(0xf0c060), mote: add(0xffd98a, .9) };
 return M;
}
function batcher(root){
 const lists = new Map(), o = new THREE.Object3D();
 const put = (mat, it) => { if (!lists.has(mat)) lists.set(mat, []); lists.get(mat).push(it); };
 return {
  // Bottom-anchored box: y is the underside.
  box(mat, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0){ put(mat, { p: [x, y + h / 2, z], s: [w, h, d], e: [rx, ry, rz] }); },
  beam(mat, a, b, w, d = w){ const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), v = bv.clone().sub(av); put(mat, { p: av.add(bv).multiplyScalar(.5).toArray(), s: [w, v.length(), d], q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()) }); },
  flush(){ for (const [mat, list] of lists){ const im = new THREE.InstancedMesh(unitBox, mat, list.length); list.forEach((it, i) => { o.position.fromArray(it.p); o.scale.fromArray(it.s); if (it.q) o.quaternion.copy(it.q); else o.rotation.set(...it.e); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.instanceMatrix.needsUpdate = true; root.add(im); } },
 };
}
function mesh(root, geo, mat, x, y, z){ const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); root.add(m); return m; }
function glowBox(root, color, x, y, z, w, h, d){ const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: .5, emissive: color, emissiveIntensity: 0 }); const m = mesh(root, unitBox, mat, x, y, z); m.scale.set(w, h, d); return m; }
function signTexture(title, sub, alive){
 const c = document.createElement('canvas'); c.width = 1024; c.height = 220; const g = c.getContext('2d');
 g.fillStyle = alive ? '#1c2a2b' : '#1b1c1f'; g.fillRect(0, 0, 1024, 220); g.strokeStyle = alive ? '#e9c27a' : '#4a4b4f'; g.lineWidth = 6; g.strokeRect(10, 10, 1004, 200);
 g.textAlign = 'center'; g.fillStyle = alive ? '#f6e3b4' : '#5d5e62'; g.font = '700 84px Georgia, serif'; g.fillText(title, 512, 112);
 g.font = '600 34px system-ui, sans-serif'; g.fillStyle = alive ? '#e9c27a' : '#4f5054'; g.fillText(sub, 512, 172);
 const t = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ─── The station, the mast and the relay ────────────────────────────────────
let site = null;
function buildSite(){
 const m = materials(), root = new THREE.Group(); root.name = 'first-signal-site'; State.scene.add(root);
 const b = batcher(root), s = { root, rings: [], frags: [], markers: [], ribs: 0 };
 const SX = SITE.x, SZ = SITE.z;
 // Ring wall: broken heights, one gate to the west.
 for (let k = 0; k < 60; k++){ const a = k / 60 * TAU; if (Math.abs(a - Math.PI) < .115) continue; const h = 2.6 + (hashStr('fs-wall' + k) % 100) / 45; b.box(k % 5 ? m.stone : m.dark, SX + Math.cos(a) * SITE.wall, GY, SZ + Math.sin(a) * SITE.wall, .9, h, 1.86, -a); }
 for (const z of [19.75, 24.25]){ b.box(m.dark, P.gate[0], GY, z, 1, 4.2, 1); b.box(m.bronze, P.gate[0], GY + 4.2, z, 1.16, .18, 1.16); }
 b.box(m.dark, P.gate[0], GY + 3.6, 20.9, .8, .5, 1.6, 0, .12);                 // what is left of the lintel
 b.box(m.steel, P.gate[0] - .62, GY + 1.2, 20.05, .16, 1.9, .16); b.box(m.bronze, P.gate[0] - .62, GY + 3.0, 20.05, .5, .5, .12); // chain and wheel
 s.gate = new THREE.Group(); s.gate.position.set(P.gate[0], GY, 22); root.add(s.gate);
 { const slab = new THREE.Mesh(unitBox, m.steel); slab.scale.set(.34, 3.2, 3.4); slab.position.y = 1.6; s.gate.add(slab); for (const y of [.5, 1.6, 2.7]){ const rib = new THREE.Mesh(unitBox, m.rust); rib.scale.set(.42, .16, 3.4); rib.position.y = y; s.gate.add(rib); } }
 // Six dome ribs, three of them broken short.
 [1, .5, 1, .36, .7, 1].forEach((keep, i) => { const a = (i + .5) / 6 * TAU; let prev = null; for (let j = 0; j <= 6; j++){ const u = j / 6; if (u > keep + .01) break; const r = SITE.wall - 12.4 * Math.sin(u * Math.PI / 2), y = GY + 3 + 13 * Math.sin(u * Math.PI / 2) * (1 - .25 * u), pt = [SX + Math.cos(a) * r, y, SZ + Math.sin(a) * r]; if (prev) b.beam(m.dark, prev, pt, .5, .7); prev = pt; } });
 // The drum. Its west face is the door; it has no seam until the station wakes.
 for (let k = 0; k < 8; k++){ if (k === 4) continue; const a = k * Math.PI / 4; b.box(m.stone, SX + Math.cos(a) * 3.3, GY, SZ + Math.sin(a) * 3.3, .5, 3.6, 2.76, -a); }
 b.box(m.dark, SX, GY + 3.6, SZ, 6.4, .4, 6.4); b.box(m.dark, SX, GY + 3.6, SZ, 6.4, .4, 6.4, Math.PI / 4); b.box(m.bronze, SX, GY + 4, SZ, 2.2, .5, 2.2, Math.PI / 4);
 s.door = new THREE.Mesh(unitBox, m.stone); s.door.scale.set(.5, 3.6, 2.76); s.door.position.set(SX - 3.3, GY + 1.8, SZ); root.add(s.door);
 s.seam = glowBox(root, 0xb59bea, SX - 3.57, GY + 1.5, SZ, .04, 3, 2.3);
 b.box(m.dark, SX, GY, SZ, .7, .9, .7); b.box(m.bronze, SX, GY + .9, SZ, .5, .06, .5);
 // Plinth with an empty seat for a cell.
 b.box(m.dark, P.plinth[0], GY, P.plinth[1], .9, 1, .9); b.box(m.bronze, P.plinth[0], GY + 1, P.plinth[1], .6, .08, .6);
 s.plinthLight = glowBox(root, 0xf0c060, P.plinth[0] - .46, GY + .6, P.plinth[1], .04, .3, .3);
 // Floor inlay: eight lines from the drum to the wall.
 for (let k = 0; k < 8; k++){ const a = (k + .5) * Math.PI / 4, r = 10.2; b.box(m.inlay, SX + Math.cos(a) * r, GY + .01, SZ + Math.sin(a) * r, 12.4, .04, .18, -a); }
 // Three rings lying where they fell, and the lens they used to carry.
 const dead = [[[SX + 5.2, GY + 2.5, SZ - 4.6], [1.15, .3, 0]], [[SX + 4, GY + .2, SZ + 8.5], [Math.PI / 2, 0, 0]], [[SX - 6.5, GY + 1.3, SZ + 9.5], [.55, 1.2, .2]]];
 [4.4, 5.5, 6.6].forEach((r, i) => { const ring = mesh(root, new THREE.TorusGeometry(r, .17, 6, 56), m.bronze, 0, 0, 0); ring.userData = { dp: new THREE.Vector3(...dead[i][0]), dq: new THREE.Quaternion().setFromEuler(new THREE.Euler(...dead[i][1])), spin: 0 }; s.rings.push(ring); });
 s.center = new THREE.Vector3(SX, GY + 10, SZ);
 s.lens = mesh(root, new THREE.OctahedronGeometry(1.1, 0), m.violet, SX, GY + 10, SZ);
 s.beam = mesh(root, new THREE.CylinderGeometry(.35, .6, 130, 10, 1, true), m.beam, SX, GY + 75, SZ);
 // Eleven stones that remember being an arch.
 const DX = SX - 3.95, slots = [];
 for (const side of [-1, 1]) for (const y of [.5, 1.5]) slots.push([[DX, GY + y, SZ + side * 1.5], 0]);
 for (let i = 0; i < 7; i++){ const a = (i + .5) / 7 * Math.PI; slots.push([[DX, GY + 2 + Math.sin(a) * 1.5, SZ + Math.cos(a) * 1.5], a - Math.PI / 2]); }
 slots.forEach(([p, tilt], i) => {
  const h = hashStr('fs-frag' + i), a = Math.PI * ((h & 1 ? .56 : 1.14) + ((h >> 1) % 30) / 100), r = 6 + (h >> 8) % 9, f = mesh(root, unitBox, i % 3 ? m.stone : m.dark, 0, 0, 0);
  f.scale.set(.7, i < 4 ? 1 : .72, i < 4 ? .7 : .78);
  f.userData = { dp: new THREE.Vector3(SX + Math.cos(a) * r, GY + .22, SZ + Math.sin(a) * r), dq: new THREE.Quaternion().setFromEuler(new THREE.Euler((h % 7) * .4, (h % 11) * .5, (h % 5) * .5)), ap: new THREE.Vector3(...p), aq: new THREE.Quaternion().setFromEuler(new THREE.Euler(-tilt, 0, 0)) };
  s.frags.push(f);
 });
 // The tide lamp on its pedestal, and the copy you carry.
 s.lamp = lampMesh(); s.lamp.position.set(SX, GY + 1.3, SZ); root.add(s.lamp);
 // Causeway markers: dead until the line is whole.
 for (const x of [290, 294, 298, 302, 306]) for (const z of [19.4, 25.6]){ b.box(m.steel, x, GY, z, .16, 1.25, .16); s.markers.push(glowBox(root, 0xf0c060, x, GY + 1.4, z, .3, .3, .3)); }
 // Relay pylons, the reel, the socket.
 for (const p of [P.pylonA, P.pylonB]){ b.box(m.steel, p[0], GY, p[1], .55, 6, .55); b.box(m.steel, p[0], GY + 5, p[1], 2.4, .14, .14); b.box(m.steel, p[0], GY + 5.8, p[1], 1.6, .14, .14); b.box(m.rust, p[0], GY + .8, p[1] - .42, .6, .8, .3); }
 b.box(m.rust, P.reel[0], GY, P.reel[1] - .3, .9, .9, .5); b.box(m.dark, P.reel[0], GY + .2, P.reel[1] - .3, 1.1, .5, .3);
 s.socket = glowBox(root, 0xd8503a, P.socket[0], GY + 1.2, P.socket[1] - .08, .22, .22, .06);
 s.plug = new THREE.Group(); { const body = new THREE.Mesh(unitBox, m.dark); body.scale.set(.2, .2, .34); s.plug.add(body); const tip = new THREE.Mesh(unitBox, m.amber.clone()); tip.material.emissiveIntensity = 1.4; tip.scale.set(.1, .1, .12); tip.position.z = .22; s.plug.add(tip); } root.add(s.plug);
 s.cable = new THREE.InstancedMesh(unitBox, m.dark, 18); s.cable.frustumCulled = false; root.add(s.cable);
 // The courier's cart, where the line was torn.
 b.box(m.rust, P.cart[0], GY + .1, P.cart[1], 1.4, .7, .9, .3, 0, .42); b.box(m.steel, P.cart[0] + 1.1, GY, P.cart[1] + .7, .1, .7, .7, .8, 0, 1.2);
 [[-.9, .9], [.2, 1.3], [1.4, -.6], [-.4, -1.1], [2.2, .5]].forEach(([dx, dz], i) => b.box(m.parcel, P.cart[0] + dx, GY, P.cart[1] + dz, .36, .3, .3, i * .9));
 // The fallen mast: rails, rungs you can stand on, struts, the dish, the housing.
 const top = MAST.x0 + (MAST.steps - 1) * MAST.run + 3.4;
 for (const z of [MAST.z0 + .15, MAST.z1 - .15]) b.beam(m.steel, [MAST.x0 - 1, GY + .2, z], [top + .3, GY + MAST.steps + .2, z], .28);
 for (let i = 0; i < MAST.steps; i++){ const last = i === MAST.steps - 1, x = MAST.x0 + i * MAST.run, len = last ? 3.4 : MAST.run, y = GY + i + 1; b.box(i % 2 ? m.rust : m.steel, x + len / 2, y - .12, 11, len - .06, .12, MAST.z1 - MAST.z0); for (const z of [MAST.z0 + .2, MAST.z1 - .2]){ b.box(m.steel, x + .2, GY, z, .14, i + .9, .14); b.beam(m.steel, [x + .2, GY, z], [x + len - .1, y - .15, z], .09); } }
 b.box(m.dark, 305.9, GY + MAST.steps, 11, .8, .9, .9); b.box(m.bronze, 305.42, GY + MAST.steps + .12, 11, .2, .08, .5);
 s.housingLight = glowBox(root, 0xd8503a, 305.47, GY + MAST.steps + .78, 11, .05, .14, .14);
 { const dish = mesh(root, new THREE.CylinderGeometry(1.7, 1.3, .16, 14), m.steel, top + .9, GY + MAST.steps + 1.3, 11.4); dish.rotation.set(.3, 0, 1.15); }
 s.cell = cellMesh(); root.add(s.cell);
 b.flush(); site = s; paintSite(0, 0, true);
}
function lampMesh(){
 const m = materials(), g = new THREE.Group(), core = new THREE.Mesh(new THREE.OctahedronGeometry(.2, 0), m.amber.clone()); core.material.emissiveIntensity = 1.8; g.add(core); g.userData.core = core;
 for (const y of [-.3, .3]){ const cap = new THREE.Mesh(unitBox, m.bronze); cap.scale.set(.34, .06, .34); cap.position.y = y; g.add(cap); }
 for (const [x, z] of [[-.15, -.15], [.15, -.15], [-.15, .15], [.15, .15]]){ const bar = new THREE.Mesh(unitBox, m.bronze); bar.scale.set(.03, .6, .03); bar.position.set(x, 0, z); g.add(bar); }
 const halo = new THREE.Mesh(new THREE.CircleGeometry(.9, 20), m.halo.clone()); halo.material.opacity = .28; g.add(halo); g.userData.halo = halo; return g;
}
function cellMesh(){
 const m = materials(), g = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .56, 10), m.amber.clone()); body.material.emissiveIntensity = .9; g.add(body); g.userData.core = body;
 for (const y of [-.32, .32]){ const cap = new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .09, 10), m.dark); cap.position.y = y; g.add(cap); } return g;
}
//  Wake values run 0→1. During the performance they come from its clock.
function wakeParts(){
 if (S.stage > ST.WAKE) return { inlay: 1, lift: [1, 1, 1], frag: i => 1, lens: 1, beam: 1, door: 1 };
 if (S.stage < ST.WAKE) return { inlay: 0, lift: [0, 0, 0], frag: i => 0, lens: 0, beam: 0, door: 0 };
 const w = wakeT; return { inlay: ease(w / 2), lift: [0, 1, 2].map(i => ease((w - 1.5 - i * .8) / 3.6)), frag: i => ease((w - 4 - i * .3) / 2.6), lens: ease((w - 6.5) / 2), beam: ease((w - 8.8) / 1.5), door: ease((w - 11.2) / 2.4) };
}
const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpO = new THREE.Object3D(), tmpE = new THREE.Euler();
function paintSite(dt, t, force){
 const s = site; if (!s) return; const m = M, w = wakeParts(), still = reduced.matches;
 const relay = S.stage > ST.RELAY, since = relay ? (relayT < 0 ? 99 : relayT) : -1;
 s.markers.forEach((mk, i) => mk.material.emissiveIntensity = relay ? 1.6 * ease((since - Math.floor(i / 2) * .32) / .4) : 0);
 s.socket.material.emissive.setHex(relay ? 0xf0c060 : 0xd8503a); s.socket.material.emissiveIntensity = relay ? 1.6 : (Math.sin(t * 6) > 0 ? 1.5 : .1);
 s.housingLight.material.emissive.setHex(relay ? 0xf0c060 : 0xd8503a); s.housingLight.material.emissiveIntensity = S.stage > ST.CELL ? .1 : relay ? 1 + Math.sin(t * 4) * .6 : .8;
 s.plinthLight.material.emissiveIntensity = S.stage >= ST.WAKE ? 1.6 : S.stage === ST.GATE ? 1 + Math.sin(t * 5) * .6 : relay ? .3 : 0;
 // Gate: closed, or hauled up and held.
 const up = S.stage > ST.GATE ? 1 : gateLift; s.gate.position.y = GY + up * 2.5 + (S.stage === ST.GATE && up > .5 && !still ? Math.sin(t * 17) * .015 : 0);
 // Inlay, rings, lens, beam.
 m.inlay.emissiveIntensity = w.inlay * (1.1 + (still ? 0 : Math.sin(t * 1.3) * .25));
 s.rings.forEach((ring, i) => {
  const u = w.lift[i], d = ring.userData; if (u > .98 && !still) d.spin += dt * [.5, -.36, .27][i];
  if (i === 0) tmpE.set(d.spin, 0, 0); else if (i === 1) tmpE.set(.4, d.spin, 0); else tmpE.set(Math.PI / 2 + .3 * Math.sin(d.spin), 0, d.spin); tmpQ.setFromEuler(tmpE);
  ring.position.lerpVectors(d.dp, s.center, u); ring.position.y += Math.sin(u * Math.PI) * 2.5; ring.quaternion.slerpQuaternions(d.dq, tmpQ, u);
 });
 m.violet.emissiveIntensity = w.lens * 2.2; s.lens.visible = w.lens > .01; s.lens.scale.setScalar(.01 + w.lens * 1.25); if (!still) s.lens.rotation.y += dt * .7;
 m.beam.opacity = w.beam * (.28 + (still ? 0 : Math.sin(t * 2.1) * .05)) + beamFlash * .3; s.beam.visible = m.beam.opacity > .005;
 // Stones lift, cross the court and settle into the arch.
 s.frags.forEach((f, i) => { const u = w.frag(i), d = f.userData; f.position.lerpVectors(d.dp, d.ap, u); f.position.y += Math.sin(u * Math.PI) * (3 + i % 3); f.quaternion.slerpQuaternions(d.dq, d.aq, u); });
 // The door: a seam of light, then the wall sinks.
 s.seam.material.emissiveIntensity = w.door < 1 ? clamp((w.frag(10) - .9) * 10) * 2 * (1 - w.door)  : 0; s.seam.visible = s.seam.material.emissiveIntensity > .01;
 s.door.position.y = GY + 1.8 - w.door * 3.75; s.door.visible = w.door < .99;
 // Lamp and cell: on their seats, or in your hands.
 s.lamp.visible = S.stage < ST.HOME; if (s.lamp.visible){ s.lamp.rotation.y = still ? 0 : t * .6; s.lamp.userData.halo.quaternion.copy(State.camera.quaternion); s.lamp.userData.core.material.emissiveIntensity = 1.2 + w.door * .8; }
 const cellHome = S.stage <= ST.CELL, cellSeat = S.stage >= ST.WAKE; s.cell.visible = cellHome || cellSeat;
 if (cellHome) s.cell.position.set(305.36, GY + MAST.steps + .48, 11); else if (cellSeat) s.cell.position.set(P.plinth[0], GY + 1.4, P.plinth[1]);
 s.cell.userData.core.material.emissiveIntensity = cellSeat ? 2 : relay ? .9 : .25;
 // Plug and cable.
 const end = relay ? [P.socket[0], GY + 1.2, P.socket[1] - .2] : carry === 'plug' ? hand() : [plugAt[0], GY + .12, plugAt[1]];
 s.plug.position.set(...end); s.plug.rotation.y = relay ? 0 : carry === 'plug' ? Player.yaw + Math.PI : .7;
 const a = [P.reel[0], GY + .6, P.reel[1] - .3], n = 18, len = Math.hypot(end[0] - a[0], end[2] - a[2]), sag = clamp((16 - len) / 10) * 1.2 + .25;
 let prev = a; for (let i = 1; i <= n; i++){ const u = i / n, p = [lerp(a[0], end[0], u), Math.max(GY + .05, lerp(a[1], end[1], u) - Math.sin(u * Math.PI) * sag), lerp(a[2], end[2], u)]; tmpO.position.set((p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2, (p[2] + prev[2]) / 2); tmpV.set(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]); tmpO.scale.set(.07, tmpV.length() + .02, .07); tmpO.quaternion.setFromUnitVectors(tmpO.up, tmpV.normalize()); tmpO.updateMatrix(); s.cable.setMatrixAt(i - 1, tmpO.matrix); prev = p; }
 s.cable.instanceMatrix.needsUpdate = true;
}

// ─── The East Arcade ────────────────────────────────────────────────────────
let arcade = null;
const LANTERNS = [25.2, 29.8, 35.2, 39.8];
function buildArcade(){
 const m = materials(), root = new THREE.Group(); root.name = 'first-signal-arcade'; State.scene.add(root);
 const b = batcher(root), a = { root, lanterns: [], pools: [], shutters: [], goods: new THREE.Group() }; root.add(a.goods);
 for (const z of LANTERNS){ b.box(m.dark, 218.3, HY, z, .2, 3.2, .2); b.box(m.dark, 217.85, HY + 3, z, 1.1, .12, .12); b.box(m.bronze, 217.45, HY + 2.7, z, .04, .3, .04); b.box(m.bronze, 217.45, HY + 2.64, z, .5, .06, .5); b.box(m.bronze, 217.45, HY + 2.14, z, .5, .06, .5); a.lanterns.push(glowBox(root, 0xffc878, 217.45, HY + 2.42, z, .38, .44, .38)); }
 // The lamp house: a cradle that has been empty for a while.
 const NZ = P.niche[1];
 b.box(m.dark, 218.9, HY, NZ, .4, 3.6, 4); b.box(m.bronze, 218.9, HY + 3.6, NZ, .5, .12, 4.1);          // screen wall closing the gap between the towers
 for (const z of [NZ - 1.05, NZ + 1.05]) b.box(m.dark, 218.2, HY, z, 1, 2.5, .2); b.box(m.bronze, 218.2, HY + 2.5, NZ, 1.2, .2, 2.5);
 b.box(m.stone, 217.95, HY, NZ, .9, 1, 1); b.box(m.bronze, 217.95, HY + 1, NZ, .6, .08, .6);
 a.lamp = lampMesh(); a.lamp.position.set(P.niche[0], HY + 1.5, P.niche[1]); root.add(a.lamp);
 a.signDead = signTexture('EAST ARCADE', 'NO POWER · LINE 7 DOWN', false); a.signLive = signTexture('THE EAST ARCADE', 'LIT BY THE LISTENING STATION', true);
 a.sign = mesh(root, new THREE.PlaneGeometry(2.6, .56), new THREE.MeshBasicMaterial({ map: a.signDead }), 217.55, HY + 3.05, NZ); a.sign.rotation.y = -Math.PI / 2;
 // Two stalls with their shutters down.
 for (const z of [P.stallA[1], P.stallB[1]]){
  b.box(m.wood, 217.9, HY, z, .8, 1, 2.4); b.box(m.bronze, 217.9, HY + 1, z, .86, .05, 2.46);
  for (const dz of [-1.2, 1.2]) for (const x of [217.52, 218.3]) b.box(m.dark, x, HY, z + dz, .1, 2.6, .1);
  const awn = mesh(root, unitBox, m.awning, 217.6, HY + 2.62, z); awn.scale.set(1.8, .08, 2.8); awn.rotation.z = .16;
  const sh = mesh(root, unitBox, m.steel, 217.5, HY + 1.8, z); sh.scale.set(.06, 1.55, 2.3); a.shutters.push(sh);
 }
 // Stall goods appear with the light: cups and a pot; lamps and small repairs.
 const put = (geo, mat, x, y, z) => { const g = new THREE.Mesh(geo, mat); g.position.set(x, y, z); a.goods.add(g); return g; };
 const cup = new THREE.CylinderGeometry(.05, .04, .1, 8), pot = new THREE.CylinderGeometry(.14, .17, .24, 10);
 for (let i = 0; i < 5; i++) put(cup, m.goods, 217.75, HY + 1.1, P.stallA[1] - .8 + i * .28); put(pot, m.bronze, 218, HY + 1.17, P.stallA[1] + .8);
 for (let i = 0; i < 4; i++){ const g = put(unitBox, i % 2 ? m.bulbs : m.bronze, 217.85, HY + 1.17, P.stallB[1] - .8 + i * .5); g.scale.set(.18, .24, .18); }
 // A string of bulbs from post to post, and a bench.
 { const pts = []; const stops = [LANTERNS[0], LANTERNS[1], NZ, LANTERNS[2], LANTERNS[3]]; for (let i = 0; i < stops.length - 1; i++) for (let j = 1; j <= 6; j++){ const u = j / 7; pts.push([217.75, HY + 3.12 - Math.sin(u * Math.PI) * .28, lerp(stops[i], stops[i + 1], u)]); }
   const im = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 6, 5), m.bulbs, pts.length); pts.forEach((p, i) => { tmpO.position.set(...p); tmpO.scale.setScalar(1); tmpO.quaternion.identity(); tmpO.updateMatrix(); im.setMatrixAt(i, tmpO.matrix); }); root.add(im); }
 b.box(m.wood, 214.3, HY + .34, 41, .5, .12, 3); for (const z of [39.7, 42.3]) b.box(m.dark, 214.3, HY, z, .4, .34, .12);
 for (const z of [...LANTERNS, NZ]){ const pool = mesh(root, new THREE.CircleGeometry(2.6, 24), m.pool.clone(), 216.6, HY + .03, z); pool.rotation.x = -Math.PI / 2; a.pools.push(pool); }
 b.flush(); arcade = a; paintArcade(0);
}
//  Lights come on outward from the lamp house, one post at a time.
function arcadeLit(){ return S.stage === ST.DONE ? 99 : S.stage === ST.INSTALL && fin ? fin.t - 3.4 : -1; }
function paintArcade(t){
 const a = arcade; if (!a) return; const lit = arcadeLit(), on = k => ease((lit - k * .38) / .5), flick = reduced.matches ? 0 : Math.sin(t * 9.1) * .04;
 a.lamp.visible = lit > -.9 || (S.stage === ST.INSTALL && fin && fin.t > 2.2); a.lamp.userData.core.material.emissiveIntensity = .4 + on(0) * 1.8; a.lamp.userData.halo.material.opacity = on(0) * .3; a.lamp.userData.halo.quaternion.copy(State.camera.quaternion); a.lamp.rotation.y = reduced.matches ? 0 : t * .5;
 const order = [2, 1, 3, 0]; a.lanterns.forEach((l, i) => l.material.emissiveIntensity = on(1 + order.indexOf(i)) * (1.7 + flick));
 M.bulbs.emissiveIntensity = on(3) * 1.5;
 a.pools.forEach((p, i) => p.material.opacity = on(i === 4 ? 0 : 1 + order.indexOf(i)) * .16);
 const open = on(4); a.shutters.forEach(s => { s.scale.y = lerp(1.55, .12, open); s.position.y = HY + lerp(1.8, 2.5, open); }); a.goods.visible = open > .6;
 const live = lit > 1.6; if (a.sign.material.map !== (live ? a.signLive : a.signDead)){ a.sign.material.map = live ? a.signLive : a.signDead; a.sign.material.needsUpdate = true; }
 M.awning.color.setHex(live ? 0x8c3b32 : 0x3a3d42);
}

// ─── Small moving things: the key, its motes, birds, the trail ──────────────
let key = null, motes = [], birds = [], trail = null, perches = [];
function buildKey(){ const m = materials(), g = new THREE.Group(), core = new THREE.Mesh(new THREE.OctahedronGeometry(.13, 0), m.amber.clone()); core.material.emissiveIntensity = 2; g.add(core); const halo = new THREE.Mesh(new THREE.CircleGeometry(.5, 18), m.halo.clone()); g.add(halo); g.userData = { core, halo, beat: 0 }; g.visible = false; State.scene.add(g); key = g; }
function hand(){ const y = Player.yaw, p = Player.position; return [p.x - Math.sin(y) * .75 + Math.cos(y) * .28, p.y - .52, p.z - Math.cos(y) * .75 - Math.sin(y) * .28]; }
function keyTarget(){
 switch (S.stage){
  case ST.FOLLOW: { const a = OUT[Math.min(OUT.length - 1, mech?.li ?? 0)]; return [a[0], 1.4, a[1]]; }
  case ST.RELAY: return carry === 'plug' ? [P.socket[0], GY + 1.2, P.socket[1]] : [plugAt[0], GY + .2, plugAt[1]];
  case ST.CELL: return [P.housing[0], GY + MAST.steps + .5, P.housing[1]];
  case ST.GATE: return [P.plinth[0], GY + 1.2, P.plinth[1]];
  case ST.LAMP: return [SITE.x, GY + 1.3, SITE.z];
  case ST.HOME: { const a = BACK[Math.min(BACK.length - 1, mech?.li ?? 0)]; return [a[0], 1.4, a[1]]; }
 }
 return null;
}
function keyTick(dt, t){
 if (!key) return; const holder = keyHolder; key.visible = !!holder || !!keyFree; if (!key.visible) return;
 if (holder){ const y = holder.char.group.rotation.y, p = holder.group.position; key.position.set(p.x + Math.sin(y) * .4, p.y + 1.22, p.z + Math.cos(y) * .4); } else key.position.set(...keyFree);
 const u = key.userData; u.beat += dt; const beat = u.beat % 1.6, pulse = Math.exp(-beat * 4);
 u.core.scale.setScalar(1 + pulse * .5); u.core.rotation.y += dt * 1.4; u.halo.quaternion.copy(State.camera.quaternion); u.halo.material.opacity = .12 + pulse * .4; u.halo.scale.setScalar(.8 + pulse * .9);
 if (beat < dt){
  const near = Math.hypot(key.position.x - Player.position.x, key.position.z - Player.position.z); if (near < 16) tone({ f0: 880, f1: 660, gain: .035 * (1 - near / 18), dur: .22 });
  const to = keyTarget(); if (to && near < 45 && motes.length < 10){ const mm = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 5), M.mote.clone()); State.scene.add(mm); const from = key.position.clone(), dir = new THREE.Vector3(...to).sub(from), far = dir.length(); dir.normalize(); motes.push({ mesh: mm, from, to: from.clone().addScaledVector(dir, Math.min(far, 14)), t: 0, life: clamp(Math.min(far, 14) / 9, .5, 1.6) }); }
 }
}
function motesTick(dt){ for (let i = motes.length - 1; i >= 0; i--){ const m = motes[i]; m.t += dt / m.life; if (m.t >= 1){ m.mesh.removeFromParent(); m.mesh.material.dispose(); m.mesh.geometry.dispose(); motes.splice(i, 1); continue; } m.mesh.position.lerpVectors(m.from, m.to, m.t); m.mesh.position.y += Math.sin(m.t * Math.PI) * .9; m.mesh.material.opacity = Math.sin(m.t * Math.PI) * .95; } }
//  Birds sit on the road until something runs through them.
const ROOSTS = [[239, -.5], [271, 2.6], [288.5, 14]];
let birdGeo = null;
function birdMesh(){ birdGeo ||= (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, .28, .04, -.1, .05, 0, .16, 0, 0, 0, -.28, .04, -.1, -.05, 0, .16], 3)); return g; })(); return new THREE.Mesh(birdGeo, materials().bird); }
function birdsTick(dt, t){
 const want = S.stage === ST.FOLLOW;
 ROOSTS.forEach((r, i) => {
  let p = perches[i];
  if (want && !p && !flushed[i] && loaded(r[0], r[1]) && pd(r) < 70){ const y = shSurfaceY(r[0], r[1], 6); p = perches[i] = { list: [] }; for (let n = 0; n < Math.round(8 * tierScale()); n++){ const b = birdMesh(); b.position.set(r[0] + rnd(-1.6, 1.6), y + .05, r[1] + rnd(-1.6, 1.6)); b.rotation.y = rnd(0, TAU); b.scale.setScalar(.8); State.scene.add(b); p.list.push(b); } }
  if (!p) return;
  const scare = pd(r) < 9 || (mech && d2(mech.ent.position.x, mech.ent.position.z, r) < 5);
  if (scare || !want){ flushed[i] = true; for (const b of p.list){ const a = rnd(-.9, .9); birds.push({ mesh: b, v: new THREE.Vector3(Math.cos(a) * rnd(4, 7), rnd(3, 5.5), Math.sin(a) * rnd(4, 7)), t: 0, ph: rnd(0, 6) }); } perches[i] = null; if (scare){ tone({ noise: true, filter: 'bandpass', ff0: 2400, ff1: 900, gain: .05, dur: .5 }); } }
  else for (const b of p.list) b.rotation.x = Math.max(0, Math.sin(t * 5 + b.position.x * 7)) * .5;   // pecking
 });
 for (let i = birds.length - 1; i >= 0; i--){ const b = birds[i]; b.t += dt; if (b.t > 6){ b.mesh.removeFromParent(); birds.splice(i, 1); continue; } b.mesh.position.addScaledVector(b.v, dt); b.mesh.rotation.set(0, Math.atan2(b.v.x, b.v.z), Math.sin(b.t * 22 + b.ph) * .7); b.mesh.scale.setScalar(.8 + b.t * .1); }
}
//  Dropped parcels and a line of small lights that run east, from the hall to
//  the torn relay. Both go once the line is whole.
const DROPS = [[219.6, -4.9], [231.8, -3.3], [247, 3.5], [263.2, 1.5], [279, 3.4], [285.9, 12.5]];
const WISPS = [[217.6, 5], [220.5, -4.4], [229, -4], [238, 0], [246, 2.5], [254, 2.5], [262, 2.5], [270, 2.5], [278, 2.5], [285.5, 4], [285.5, 12], [285.5, 20]];
function trailTick(t){
 const want = S.stage === ST.FOLLOW || S.stage === ST.RELAY || (S.stage === ST.INCIDENT && inc?.phase === 'call');
 if (!want){ if (trail){ trail.root.removeFromParent(); trail = null; } return; }
 if (!trail){ trail = { root: new THREE.Group(), drops: [], wisps: [] }; State.scene.add(trail.root); }
 DROPS.forEach((p, i) => { if (trail.drops[i] || !loaded(p[0], p[1])) return; const y = shSurfaceY(p[0], p[1], 6), g = new THREE.Group(); g.position.set(p[0], y, p[1]); const box = new THREE.Mesh(unitBox, M.parcel); box.scale.set(.36, .3, .3); box.position.y = .15; box.rotation.y = i * 1.3; g.add(box); const scorch = new THREE.Mesh(new THREE.CircleGeometry(.7, 12), new THREE.MeshBasicMaterial({ color: 0x0c0c0e, transparent: true, opacity: .55, depthWrite: false })); scorch.rotation.x = -Math.PI / 2; scorch.position.y = .02; g.add(scorch); trail.root.add(g); trail.drops[i] = g; });
 WISPS.forEach((p, i) => { let w = trail.wisps[i]; if (!w){ if (!loaded(p[0], p[1])) return; w = trail.wisps[i] = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), M.mote.clone()); w.position.set(p[0], shSurfaceY(p[0], p[1], 6) + 1.5, p[1]); trail.root.add(w); } const run = reduced.matches ? .5 : ((t * 1.5 - i * .5) % 6 + 6) % 6; w.material.opacity = .12 + Math.exp(-run * 1.6) * .85; w.scale.setScalar(.8 + Math.exp(-run * 1.6) * 1.6); });
}

// ─── People ─────────────────────────────────────────────────────────────────
let actors = [], mech = null, courier = null, keyHolder = null, keyFree = null;
function look(scenes, seed){ const l = window.FCWardrobe ? FCWardrobe.crowdLook(null, new RNG('first-signal:' + seed), scenes) : {}; delete l.scene; return l; }
function actor(role, scenes, name, at, seed){
 const st = B.story(role, 'fs:' + seed); if (name) st.name = name;
 const e = FCNpcs.body(look(scenes, seed), st.name, role, st, 'fs-' + seed);
 e.name = st.name; e.ent = { position: new THREE.Vector3(at.x, at.y, at.z) }; e.group.position.copy(e.ent.position); e.act = 'idle'; e.speed = 0; e.path = null; e.talkUntil = 0; e.phase = Math.random() * 6;
 State.scene.add(e.group); actors.push(e); return e;
}
function drop(e){ if (!e) return; const i = actors.indexOf(e); if (i >= 0) actors.splice(i, 1); if (keyHolder === e) keyHolder = null; try { FCNpcs.dispose(e); } catch {} }
function face(e, x, z){ e.char.group.rotation.y = Math.atan2(x - e.ent.position.x, z - e.ent.position.z); }
function send(e, x, z, speed){ e.dest = { x, z, y: e.ent.position.y }; e.speed = speed; e.ghost = false; e.fails = 0; e.stuck = 0; e.path = route(e.ent.position, e.dest); if (!e.path){ e.ghost = true; e.path = [{ x, z }]; } }
function arrived(e){ return !e.path || !e.path.length; }
function go(e, dt){
 if (arrived(e)) return false;
 const p = e.ent.position, to = e.path[0], dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
 if (d < .22){ e.path.shift(); return !arrived(e); }
 const s = Math.min(d, e.speed * dt), nx = p.x + dx / d * s, nz = p.z + dz / d * s;
 let y = stand(nx, nz, p.y); if (y == null && e.ghost){ const g = shSurfaceY(nx, nz, p.y + 2.2); y = g >= 1 ? g : p.y; }
 if (y == null){ e.stuck += dt; if (e.stuck > .5){ e.stuck = 0; const r = ++e.fails < 4 && route(p, e.dest); if (r) e.path = r; else { e.ghost = true; e.path = [{ x: e.dest.x, z: e.dest.z }]; } } return false; }
 e.stuck = 0; p.set(nx, y, nz); e.char.group.rotation.y = Math.atan2(dx, dz); return true;
}
function say(e, text, opts = {}){
 if (!e || !text) return; try { FCNpcs.bubble(e, text); } catch {}
 const ms = opts.ms || Math.max(2200, 900 + text.length * 55); e.talkUntil = performance.now() + ms; e.bubbleUntil = clock + ms / 1000;
 if (opts.sub !== false) subtitle(e.name || '', opts.who || '', text, ms);
 if (opts.voice) speak(text, opts.pitch);
}
const CUSTOM = {
 kneel(c, s, L, R, el){ c.group.position.y = -.46; c.leftLeg.rotation.x = -1.45; s.knees[0].rotation.x = 1.5; c.rightLeg.rotation.x = .15; s.knees[1].rotation.x = 1.75; s.torso.rotation.x = .22; L.rotation.x = R.rotation.x = -1.05; el[0].rotation.x = el[1].rotation.x = -.5; c.head.rotation.x = .3; },
 sit(c, s, L, R, el){ c.group.position.y = -.74; c.leftLeg.rotation.x = -1.5; c.rightLeg.rotation.x = -1.32; s.knees[0].rotation.x = .12; s.knees[1].rotation.x = .5; s.torso.rotation.x = .12; L.rotation.x = -.6; L.rotation.z = -.3; el[0].rotation.x = -1.3; R.rotation.x = .35; c.head.rotation.x = .22; },   // on the floor, legs out, one arm across the ribs
 stagger(c, s, L, R, el, t){ s.torso.rotation.x = .32 + Math.sin(t * 5) * .06; L.rotation.x = -.9; L.rotation.z = -.5; el[0].rotation.x = -1.7; c.head.rotation.x = .3; s.torso.rotation.y = Math.sin(t * 2.4) * .2; },
 beckon(c, s, L, R, el, t){ R.rotation.x = 0; R.rotation.z = -2.45 + Math.sin(t * 8) * .35; el[1].rotation.x = -.35; L.rotation.x = -1.15; el[0].rotation.x = -.5; },
 hold(c, s, L, R, el, t, moving){ if (!moving){ R.rotation.x = -1.2; el[1].rotation.x = -.5; } },
 point(c, s, L, R, el){ R.rotation.x = -1.5; R.rotation.z = -.1; el[1].rotation.x = -.05; L.rotation.x = -1.15; el[0].rotation.x = -.5; },
 haul(c, s, L, R, el, t){ L.rotation.x = R.rotation.x = -2.7; L.rotation.z = .25; R.rotation.z = -.25; el[0].rotation.x = el[1].rotation.x = -.3; s.torso.rotation.x = -.16 + Math.sin(t * 15) * .02; s.knees.forEach(k => k.rotation.x = .35); c.group.position.y = -.05; c.head.rotation.x = -.3; },
 lookup(c, s, L, R, el){ c.head.rotation.x = -.55; c.head.rotation.y = 0; L.rotation.x = -.2; R.rotation.x = -.2; },
 install(c, s, L, R, el, t){ L.rotation.x = -1.7 + Math.sin(t * 9) * .12; R.rotation.x = -1.7 - Math.sin(t * 9) * .12; el[0].rotation.x = el[1].rotation.x = -.6; c.head.rotation.x = .12; },
 cheer(c, s, L, R, el, t, moving, e){ L.rotation.x = R.rotation.x = -1.2; L.rotation.z = -.35 + Math.sin(t * 18 + e.phase) * .12; R.rotation.z = .35 - Math.sin(t * 18 + e.phase) * .12; el[0].rotation.x = el[1].rotation.x = -.9; },
};
function animate(e, dt, t, moving){
 const c = e.char, s = c.studio, L = c.leftArm, R = c.rightArm, el = s.elbows;
 // Poses do not reset the joints they bend, so start from neutral each frame.
 L.rotation.z = R.rotation.z = 0; el[0].rotation.x = el[1].rotation.x = 0; s.knees.forEach(k => k.rotation.x = 0); s.torso.rotation.x = s.torso.rotation.y = 0; c.group.rotation.x = 0;
 s.motionSpeed = moving ? e.speed : 0; shAnimateCharacter(c, dt, moving, t);
 e.talking = e.talkUntil > performance.now(); c.talking = e.talking;
 if (CUSTOM[e.act]) CUSTOM[e.act](c, s, L, R, el, t, moving, e); else FCNpcs.pose(e, e.act, t, dt, moving);
 e.group.position.copy(e.ent.position);
 if (e.bubble){ if (e.bubbleUntil && clock > e.bubbleUntil){ try { FCNpcs.bubble(e, null); } catch {} e.bubbleUntil = 0; } else e.bubble.visible = Math.hypot(e.ent.position.x - Player.position.x, e.ent.position.z - Player.position.z) < 30; }
}
function ensureMech(at){
 if (mech) return mech;
 at = at || spotNear(Player.position.x, Player.position.z, 4, 9, feet()) || { x: Player.position.x + 2, y: feet(), z: Player.position.z };
 mech = actor('fixer', ['work'], CANON.mechanic, at, 'mechanic'); mech.li = 0; keyHolder = mech; return mech;
}
function standAt(e, p, speed = 4.6){ if (d2(e.ent.position.x, e.ent.position.z, p) < .9){ e.path = null; return true; } if (!e.dest || e.dest.x !== p[0] || e.dest.z !== p[1] || (arrived(e) && !e.ghost)){ if (loaded(p[0], p[1])) send(e, p[0], p[1], speed); } return false; }
//  She runs ahead, stops when you fall behind, and waves you on.
function lead(e, anchors, dt){
 const p = e.ent.position, pp = Player.position, gap = Math.hypot(p.x - pp.x, p.z - pp.z), end = anchors[anchors.length - 1];
 if (e.li >= anchors.length) return false;
 const mine = d2(p.x, p.z, end), yours = pd(end), ahead = yours < mine - 1;
 if (!ahead && gap > 15){ e.act = 'beckon'; face(e, pp.x, pp.z); if ((e.bark = (e.bark ?? 3) - dt) <= 0 && gap < 60){ e.bark = rnd(7, 11); say(e, pick(CANON.lines.wait), { voice: gap < 30 }); } return false; }
 if (ahead && gap > 34){
  // You outran her. She cuts a corner you did not see and is beside you.
  const s = spotNear(pp.x, pp.z, 4, 8, feet(), (x, y, z) => { const dx = x - pp.x, dz = z - pp.z; return dx * -Math.sin(Player.yaw) + dz * -Math.cos(Player.yaw) < 0; });
  if (s){ p.set(s.x, s.y, s.z); e.path = null; e.pathFor = -1; let best = e.li, bd = 1e9; anchors.forEach((a, i) => { const da = d2(a[0], a[1], end); if (i >= e.li && da < d2(p.x, p.z, end) + 2){ const dd = d2(p.x, p.z, a); if (dd < bd){ bd = dd; best = i; } } }); e.li = best; }
 }
 const a = anchors[e.li];
 if (arrived(e) || e.pathFor !== e.li){ if (!loaded(a[0], a[1])) return false; send(e, a[0], a[1], 4.4); e.pathFor = e.li; }
 e.speed = ahead ? 7 : gap < 6 ? 5.4 : 4.4; e.act = 'hold';
 const moving = go(e, dt);
 if (d2(p.x, p.z, a) < 1.3){ e.li++; e.path = null; }
 return moving;
}
function startIndex(anchors){ const end = anchors[anchors.length - 1], mine = pd(end); let best = anchors.length - 1, bd = 1e9; anchors.forEach((a, i) => { if (d2(a[0], a[1], end) < mine + 2){ const dd = pd(a); if (dd < bd){ bd = dd; best = i; } } }); return best; }

// ─── Words: subtitle strip, optional voice, the one prompt ──────────────────
const css = document.createElement('style'); css.textContent = `
#fs-sub{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:96;max-width:min(680px,88vw);padding:9px 16px;background:#0b1114d9;color:#f4ecd8;border-radius:6px;font:15px/1.45 Georgia,serif;text-align:center;pointer-events:none}
#fs-sub b{font:600 11px/1 system-ui;letter-spacing:.14em;color:#e9c27a;margin-right:9px;text-transform:uppercase}#fs-sub[hidden]{display:none}
#fs-prompt{position:fixed;left:50%;bottom:160px;transform:translateX(-50%);z-index:97;background:#142c29ed;color:#f0e5c7;border:1px solid #ad9b72;border-radius:8px;padding:12px 18px;font:600 13px/1.3 system-ui;cursor:pointer;min-height:44px;max-width:85vw}#fs-prompt[hidden]{display:none}
#fs-flicker{position:fixed;inset:0;z-index:40;background:#05070a;opacity:0;pointer-events:none}
#fs-panel{position:fixed;inset:6vh max(16px,calc((100vw - 700px)/2));z-index:260;overflow:auto;box-sizing:border-box;background:#e3dfd0;color:#263330;border:1px solid #b09b70;border-radius:16px;padding:26px;box-shadow:0 25px 100px #000b;font:15px/1.65 system-ui}
#fs-panel header{border-bottom:1px solid #b4b3a3;margin-bottom:18px}#fs-panel h2{font:30px/1.15 Georgia;margin:14px 0 20px}#fs-panel h3{font:21px Georgia;margin:4px 0}#fs-panel small{font:11px/1.4 system-ui;letter-spacing:.14em}
#fs-panel article{border-left:3px solid #7b8f80;padding:10px 18px;margin:14px 0;background:#f0ede3}#fs-panel article.locked{opacity:.5;border-left-color:#b4b3a3}#fs-panel article p{margin:4px 0}
#fs-panel button{border:1px solid #718172;border-radius:7px;padding:10px 14px;background:#273e37;color:#faf1d9;cursor:pointer;font:inherit;min-height:44px;margin:4px 6px 4px 0}#fs-panel [data-close]{float:right}#fs-panel footer{font-size:12px;border-top:1px solid #b4b3a3;padding-top:16px;margin-top:20px}
@media(max-width:600px){#fs-panel{inset:12px;padding:18px;font-size:14px}#fs-panel h2{font-size:24px;clear:both;padding-top:12px}#fs-sub{bottom:150px;font-size:13px}#fs-prompt{bottom:200px}}
`; document.head.append(css);
const subEl = document.createElement('div'); subEl.id = 'fs-sub'; subEl.hidden = true; subEl.setAttribute('aria-live', 'polite'); document.body.append(subEl);
const flickEl = document.createElement('div'); flickEl.id = 'fs-flicker'; flickEl.setAttribute('aria-hidden', 'true'); document.body.append(flickEl);
const promptEl = document.createElement('button'); promptEl.id = 'fs-prompt'; promptEl.hidden = true; document.body.append(promptEl);
let subUntil = 0;
function subtitle(name, who, text, ms){ if (!prefs.subs) return; subEl.innerHTML = ''; const b = document.createElement('b'); b.textContent = who || name; subEl.append(b, document.createTextNode(text)); subEl.hidden = false; subUntil = performance.now() + ms + 400; }
function speak(text, pitch = 1){
 if (!prefs.voice || !window.speechSynthesis || (typeof Snd !== 'undefined' && !Snd.on)) return;
 try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.04; u.pitch = pitch; u.volume = .85; speechSynthesis.speak(u); } catch {}
}

// ─── What your hands can do right now ───────────────────────────────────────
let carry = null, plugAt = [...P.plug], near = null, teaAt = -99, taleAt = 0, storyteller = null, vendor = null;
function interactions(){
 near = null; if (!active() || State.ui.paused) return;
 const p = Player.position, f = feet();
 switch (S.stage){
  case ST.RELAY:
   if (carry === 'plug'){ if (pd(P.socket) < 2.5) near = { label: 'Plug in the line', run: plugIn }; }
   else if (pd(plugAt) < 2.4 && f < GY + 2) near = { label: 'Pick up the line', run(){ carry = 'plug'; tone({ f0: 300, f1: 420, gain: .07, dur: .12 }); } };
   break;
  case ST.CELL: if (pd(P.housing) < 2.4 && f > GY + MAST.steps - 1.3) near = { label: 'Pull the power cell', run: pullCell }; break;
  case ST.GATE: if (carry === 'cell' && pd(P.plinth) < 2.4 && f < GY + 2) near = { label: 'Seat the cell', run: seatCell }; break;
  case ST.LAMP: if (pd(P.lamp) < 2.4 && f < GY + 2) near = { label: 'Lift the lamp', run: liftLamp }; break;
  case ST.HOME: if (carry === 'lamp' && pd(P.niche) < 3.4) near = { label: 'Hand over the lamp', run: beginInstall }; break;
  case ST.DONE:
   if (pd(P.stallA) < 2.5 && vendor) near = { label: 'Take a cup', run: tea };
   else if (storyteller && d2(p.x, p.z, [storyteller.ent.position.x, storyteller.ent.position.z]) < 3.4) near = { label: 'Sit and listen', run: listen };
   break;
 }
}
function plugIn(){
 carry = null; relayT = 0; record(1); setStage(ST.CELL); beamFlash = 1;
 tone({ f0: 180, f1: 520, gain: .12, dur: .5, type: 'sawtooth', filter: 'lowpass', ff0: 600, ff1: 2600 }); for (let i = 0; i < 5; i++) tone({ f0: 520 + i * 90, gain: .05, dur: .16, delay: .3 + i * .32 });
 burst(P.socket[0], GY + 1.2, P.socket[1], { count: 14, color: 0xf0c060, size: .07, speed: 2.4, life: .7 });
 if (mech) say(mech, CANON.lines.relayDone, { voice: true });
}
function pullCell(){ carry = 'cell'; record(2); setStage(ST.GATE); tone({ f0: 240, f1: 120, gain: .1, dur: .25, type: 'square', filter: 'lowpass', ff0: 900 }); tone({ f0: 660, gain: .06, dur: .4, delay: .2 }); if (mech) say(mech, CANON.lines.cell, { voice: true }); }
function seatCell(){ carry = null; wakeT = 0; wakeMark = 0; setStage(ST.WAKE); setSolid('gate', false); tone({ f0: 90, f1: 60, gain: .16, dur: .6, type: 'square', filter: 'lowpass', ff0: 500 }); }
function liftLamp(){ carry = 'lamp'; record(4); setStage(ST.HOME); if (mech){ mech.li = 0; mech.path = null; mech.pathFor = -1; say(mech, CANON.lines.lamp, { voice: true }); } tone({ f0: 520, f1: 780, gain: .08, dur: .6 }); }
function tea(){
 if (clock - teaAt < 20){ say(vendor, 'Finish that one first.', { ms: 2000 }); return; }
 teaAt = clock; if (Number.isFinite(Player.hpMax)) Player.hp = Player.hpMax; tone({ f0: 700, f1: 500, gain: .05, dur: .3 }); tone({ f0: 900, gain: .03, dur: .2, delay: .25 }); say(vendor, pick(CANON.lines.tea));
}
function listen(){ say(storyteller, CANON.lines.tale[taleAt++ % CANON.lines.tale.length], { voice: true, pitch: .9, ms: 6500 }); }
let carried = null;
function carryTick(t){
 const want = carry === 'cell' || carry === 'lamp' ? carry : null;
 if (carried && carried.kind !== want){ carried.mesh.removeFromParent(); carried = null; }
 if (want && !carried){ materials(); carried = { kind: want, mesh: want === 'cell' ? cellMesh() : lampMesh() }; State.scene.add(carried.mesh); }
 if (carried){ carried.mesh.position.set(...hand()); carried.mesh.rotation.y = t * .8; if (carried.mesh.userData.halo) carried.mesh.userData.halo.quaternion.copy(State.camera.quaternion); }
 if (carry === 'plug' && pd(P.reel) > 23){ carry = null; plugAt = [Player.position.x, Player.position.z]; tone({ f0: 200, f1: 90, gain: .08, dur: .2 }); }   // the line runs out
}
function useNear(){ if (!near || !active() || State.ui.paused) return; const n = near; near = null; promptEl.hidden = true; n.run(); }
promptEl.onclick = useNear;
window.addEventListener('keydown', e => {
 if (panel){ if (e.code === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); closeRecords(); } else if (e.key === 'Tab'){ const bs = [...panel.querySelectorAll('button')], i = bs.indexOf(document.activeElement); e.preventDefault(); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length]?.focus(); } return; }
 if (e.code === 'KeyE' && !e.repeat && near && active() && !State.ui.paused && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){ e.preventDefault(); e.stopImmediatePropagation(); useNear(); }
}, true);

// ─── The incident ───────────────────────────────────────────────────────────
let inc = null, idle = 0, flickUntil = 0;
function active(){ return !!State.citySeed && State.chunkMap.size > 0 && !!State.scene && !window.FN?.prologue && !window.FN?.scene && !State.ui.inIntro && !State.ui.inDialogue && !State.ui.inArcade && !State.ui.inMiniGame && !State.ui.inInventory && !State.ui.inCar && !window.FCJustice?.active && !panel; }
function onHallFloor(){ const p = Player.position; return p.x > 150 && p.x < 212 && p.z > 2 && p.z < 46 && feet() < 2.6 && Player.mode === 'walk' && !State.ui.construct && !!window.FCCommonGroundMega?.root; }
function beginIncident(){
 const p = Player.position, f = feet(), yaw = Player.yaw; let C = null, A = null;
 for (const [da, r] of [[0, 5.5], [.35, 5.5], [-.35, 5.5], [0, 4], [.7, 6], [-.7, 6], [0, 7.5]]){ const x = p.x - Math.sin(yaw + da) * r, z = p.z - Math.cos(yaw + da) * r, y = stand(x, z, f); if (y != null && walkable({ x: p.x, y: f, z: p.z }, { x, y, z })){ C = { x, y, z }; break; } }
 if (!C) return false;
 //  She should come at you across open floor: a straight, unobstructed line you can see down.
 const open = spread => { for (let i = 0; i < 14; i++){ const a = yaw + rnd(-spread, spread), r = rnd(13, 21), x = C.x - Math.sin(a) * r, z = C.z - Math.cos(a) * r, y = stand(x, z, C.y); if (y == null) continue; const q = { x, y, z }; if (walkable(q, C) && shLineOfSight(p.x, p.y, p.z, x, y + 1.4, z)) return q; } return null; };
 A = open(1.1) || open(Math.PI);
 for (let i = 0; i < 12 && !A; i++){ const a = rnd(0, TAU), r = rnd(12, 20), x = C.x - Math.sin(a) * r, z = C.z - Math.cos(a) * r, y = stand(x, z, C.y); if (y == null) continue; const path = route({ x, y, z }, C, 4000); if (path && path.length < 40) A = { x, y, z }; }
 if (!A) return false;
 inc = { t: 0, phase: 'flicker', C, A, by: [], f: 0 }; flickUntil = performance.now() + (reduced.matches ? 600 : 2800); S.stage = ST.INCIDENT; try { window.FCStreetEvents?.end?.(); } catch {}
 tone({ noise: true, filter: 'bandpass', ff0: 120, ff1: 90, q: 6, gain: .14, dur: 1.2 }); tone({ f0: 58, gain: .1, dur: 2.2, type: 'sawtooth', filter: 'lowpass', ff0: 300 });
 for (let i = 0; i < 6; i++) burst(p.x + rnd(-9, 9), f + rnd(4, 7), p.z + rnd(-9, 9), { count: 6, color: 0xffe2a0, size: .06, speed: 1.6, life: .8 });
 return true;
}
function incidentTick(dt){
 const I = inc, C = I.C; I.t += dt;
 if (I.phase === 'flicker' && I.t > 1.1){
  courier = actor('courier', ['skater', 'work'], CANON.courier, I.A, 'courier'); courier.act = 'stagger'; send(courier, C.x, C.z, 2.8); I.phase = 'stagger';
 }
 if (I.phase === 'stagger'){
  if (!I.by.length && I.t > 1.8){ const n = Math.max(2, Math.round(3 * tierScale())); for (let i = 0; i < n; i++){ const s = spotNear(C.x, C.z, 7, 12, C.y, (x, y, z) => !!route({ x, y, z }, C, 1500)); if (s){ const e = actor('wanderer', ['office', 'work', 'punk', 'goth', 'raver'], null, s, 'by' + i + ':' + scope); I.by.push(e); } } }
  for (const e of I.by) face(e, courier.ent.position.x, courier.ent.position.z);
  if ((I.sp = (I.sp ?? 0) - dt) <= 0){ I.sp = .3; const q = courier.ent.position; burst(q.x, q.y + 1, q.z, { count: 3, color: 0xf0c060, size: .05, speed: 1.2, life: .5 }); }
  if (arrived(courier) || I.t > 16){ courier.path = null; courier.act = 'down'; courier.ent.position.set(C.x, C.y, C.z); I.phase = 'fall'; I.f = 0; tone({ f0: 110, f1: 50, gain: .14, dur: .25 });
   I.by.forEach((e, i) => { const a = Player.yaw + Math.PI * .5 + i * 1.5, x = C.x + Math.sin(a) * 2.3, z = C.z + Math.cos(a) * 2.3; send(e, x, z, 4.6); e.sayAt = .5 + i * 1.3; e.line = CANON.lines.bystanders[i % CANON.lines.bystanders.length]; }); }
 } else if (I.phase === 'fall'){
  I.f += dt; for (const e of I.by){ if (arrived(e)) { face(e, C.x, C.z); e.act = 'watch'; } if (e.line && I.f > e.sayAt){ say(e, e.line, { ms: 2400, sub: e === I.by[0] }); e.line = null; } }
  if (I.f > 1.8){ const s = spotNear(C.x, C.z, 12, 18, C.y, (x, y, z) => !!route({ x, y, z }, C, 4000)) || spotNear(C.x, C.z, 5, 9, C.y); if (s){ ensureMech(s); keyHolder = null; const dx = s.x - C.x, dz = s.z - C.z, d = Math.hypot(dx, dz) || 1; send(mech, C.x + dx / d * 1.05, C.z + dz / d * 1.05, 5.8); mech.act = 'idle'; I.phase = 'mech'; I.f = 0; } }
 } else if (I.phase === 'mech'){
  I.f += dt; for (const e of I.by) if (arrived(e)){ face(e, C.x, C.z); e.act = 'watch'; }
  if (arrived(mech) || I.f > 9){ mech.path = null; face(mech, C.x, C.z); mech.act = 'kneel'; I.phase = 'kneel'; I.f = 0; say(mech, CANON.lines.kneel, { voice: true }); }
 } else if (I.phase === 'kneel'){
  I.f += dt;
  if (I.f > 1.7 && !I.rose){ I.rose = true; tone({ f0: 440, f1: 880, gain: .08, dur: .7 }); }
  if (I.rose){ const u = ease((I.f - 1.7) / 1.1), m = mech.ent.position; keyFree = [lerp(C.x, m.x, u * .6), C.y + .3 + u * .9, lerp(C.z, m.z, u * .6)]; }
  if (I.f > 3.3){ keyFree = null; keyHolder = mech; mech.act = 'hold'; face(mech, Player.position.x, Player.position.z); I.phase = 'call'; I.f = 0; say(mech, CANON.lines.call, { voice: true, ms: 6200 }); }
 } else if (I.phase === 'call'){
  I.f += dt; face(mech, Player.position.x, Player.position.z);
  if (I.f > 5.2){
   courier.act = 'sit'; S.sat = [+C.x.toFixed(2), +C.z.toFixed(2)]; record(0);
   I.by.forEach((e, i) => { if (i === 0){ e.act = 'kneel'; e.carer = true; } else if (i > 1){ const s = spotNear(C.x, C.z, 14, 20, C.y); if (s){ send(e, s.x, s.z, 1.3); e.leaving = true; } } });
   care = { courier, by: I.by.filter(e => !e.leaving) }; leavers = I.by.filter(e => e.leaving);
   mech.li = startIndex(OUT); mech.pathFor = -1; inc = null; setStage(ST.FOLLOW);
  }
 }
}
let care = null, leavers = [];
function careTick(){
 // The courier stays where she fell, with someone beside her, until you are back.
 const want = S.stage >= ST.FOLLOW && S.stage <= ST.LAMP && S.sat && pd(S.sat) < 75 && loaded(S.sat[0], S.sat[1]);
 if (!want){ if (care && !inc){ drop(care.courier); care.by.forEach(drop); if (courier === care.courier) courier = null; care = null; } return; }
 if (care || inc) return;
 const y = stand(S.sat[0], S.sat[1], HY) ?? shSurfaceY(S.sat[0], S.sat[1], 6); courier = actor('courier', ['skater', 'work'], CANON.courier, { x: S.sat[0], y, z: S.sat[1] }, 'courier'); courier.act = 'sit';
 const s = spotNear(S.sat[0], S.sat[1], 1.1, 1.6, y), by = []; if (s){ const e = actor('wanderer', ['office', 'work', 'punk', 'goth', 'raver'], null, s, 'by0:' + scope); e.act = 'kneel'; face(e, S.sat[0], S.sat[1]); by.push(e); }
 care = { courier, by };
}

// ─── The finale and the arcade afterwards ───────────────────────────────────
let fin = null, crowd = null;
const POSTS = { teller: [215, 34.6], tellTo: [212.6, 35.3], listeners: [[212.7, 33.8], [212.6, 35.6], [213.5, 36.9]], courier: [216.8, 34], mech: [216.8, 31], vendorA: [217.6, 25.8], vendorB: [217.6, 39.2], patron: [216.5, 27.7], strollA: [215.4, 24.5], strollB: [215.4, 41] };
function beginInstall(){
 carry = null; S.stage = ST.INSTALL; fin = { t: 0, marks: 0 }; ensureMech(); mech.act = 'idle';
 if (d2(mech.ent.position.x, mech.ent.position.z, P.installPost) > 2){ const y = stand(P.installPost[0], P.installPost[1], HY) ?? HY; if (d2(mech.ent.position.x, mech.ent.position.z, P.installPost) > 14) mech.ent.position.set(P.installPost[0] - 3, y, P.installPost[1] + 2); send(mech, P.installPost[0], P.installPost[1], 6); }
 say(mech, CANON.lines.niche, { ms: 1800 });
}
function crowdActor(role, scenes, name, post, act, seed, from){
 const y = stand(post[0], post[1], HY) ?? HY; let at = { x: post[0], y, z: post[1] };
 if (from){ const s = spotNear(post[0] - 9, post[1], 2, 7, HY, (x, yy, z) => !!route({ x, y: yy, z }, at, 2500)); if (s) at = s; }
 const e = actor(role, scenes, name, at, seed); e.post = post; e.home = act; e.act = from ? 'idle' : act; if (from) send(e, post[0], post[1], rnd(3, 4.4)); return e;
}
function buildCrowd(arriving){
 const n = tierScale(), c = { list: [], t: 0 };
 vendor = crowdActor('wanderer', ['work'], null, POSTS.vendorA, 'sell', 'vendorA', arriving); c.list.push(vendor);
 c.list.push(crowdActor('wanderer', ['work', 'skater'], null, POSTS.vendorB, 'sell', 'vendorB', arriving));
 storyteller = crowdActor('storyteller', ['office', 'goth'], null, POSTS.teller, 'tell', 'teller', arriving); c.list.push(storyteller);
 POSTS.listeners.slice(0, Math.max(1, Math.round(3 * n))).forEach((p, i) => { const e = crowdActor('wanderer', ['punk', 'office', 'work', 'raver', 'goth'], null, p, 'watch', 'listener' + i, arriving); e.clap = true; c.list.push(e); });
 if (n >= .8) c.list.push(crowdActor('wanderer', ['office', 'skater'], null, POSTS.patron, 'idle', 'patron', arriving));
 const cr = crowdActor('courier', ['skater', 'work'], CANON.courier, POSTS.courier, 'lean', 'courier', arriving); courier = cr; c.list.push(cr);
 if (n >= .8){ const st = crowdActor('wanderer', ['raver', 'punk', 'work'], null, POSTS.strollA, 'stroll', 'stroller', false); c.list.push(st); }
 if (!arriving){ mech = crowdActor('fixer', ['work'], CANON.mechanic, POSTS.mech, 'lean', 'mechanic', false); c.list.push(mech); }
 crowd = c;
}
function crowdTick(dt, t){
 const c = crowd; c.t += dt;
 for (const e of c.list){
  const p = e.ent.position;
  if (e.home === 'stroll'){ if (arrived(e) && (e.rest = (e.rest ?? 0) - dt) <= 0){ e.rest = rnd(3, 8); const to = (e.flip = !e.flip) ? POSTS.strollB : POSTS.strollA; send(e, to[0], to[1], 1.25); } e.act = 'idle'; continue; }
  if (!arrived(e)) continue;
  if (e.act !== 'cheer') e.act = e.home;
  if (e === storyteller || e.home === 'watch') face(e, e === storyteller ? POSTS.tellTo[0] : POSTS.teller[0], e === storyteller ? POSTS.tellTo[1] : POSTS.teller[1]);
  else if (e.home === 'sell' || e.home === 'lean') e.char.group.rotation.y = -Math.PI / 2;
  else if (e.post === POSTS.patron) face(e, P.stallA[0], P.stallA[1]);
 }
 if (S.stage === ST.DONE && (c.next = (c.next ?? 6) - dt) <= 0 && pd(P.arcade) < 26){ c.next = rnd(9, 16); const r = Math.random(); if (r < .45 && storyteller && arrived(storyteller)) say(storyteller, CANON.lines.tale[Math.floor(Math.random() * CANON.lines.tale.length)], { sub: false, ms: 5200 }); else { const v = c.list[r < .75 ? 0 : 1]; if (v && arrived(v)) say(v, pick(r < .75 ? CANON.lines.tea.slice(1) : CANON.lines.market), { sub: false }); } }
}
function installTick(dt, t){
 const F = fin; if (!arrived(mech) && F.t < 3){ F.hold = (F.hold || 0) + dt; if (F.hold < 5) return; mech.path = null; }
 F.t += dt; const mark = (n, at, fn) => { if (F.marks === n && F.t >= at){ F.marks++; fn(); } };
 if (F.t < 2.6){ face(mech, P.niche[0] + 2, P.niche[1]); mech.act = 'install'; keyHolder = null; if ((F.rt = (F.rt ?? 0) - dt) <= 0){ F.rt = .42; tone({ f0: 1400, f1: 900, gain: .04, dur: .05, type: 'square' }); burst(P.niche[0], HY + 1.5, P.niche[1], { count: 2, color: 0xffe2a0, size: .04, speed: .8, life: .4 }); } }
 mark(0, 2.6, () => { mech.act = 'idle'; face(mech, Player.position.x, Player.position.z); say(mech, CANON.lines.lights, { voice: true, ms: 1800 }); });
 mark(1, 3.4, () => { for (let i = 0; i < 6; i++) tone({ f0: [392, 494, 587, 659, 784, 988][i], gain: .07, dur: .9, delay: i * .38 }); tone({ f0: 98, gain: .08, dur: 3, type: 'sawtooth', filter: 'lowpass', ff0: 200, ff1: 900 }); });
 mark(2, 5.2, () => { buildCrowd(true); });
 mark(3, 7.4, () => { crowd.list.forEach((e, i) => { if (e.home !== 'stroll') e.act = 'cheer'; if (i < 4){ e.cheerAt = F.t + i * .7; e.cheerLine = CANON.lines.crowd[i % CANON.lines.crowd.length]; } }); tone({ noise: true, filter: 'bandpass', ff0: 1800, ff1: 2600, gain: .05, dur: 2.4 }); });
 if (crowd) for (const e of crowd.list) if (e.cheerLine && F.t >= e.cheerAt){ say(e, e.cheerLine, { sub: false }); e.cheerLine = null; }
 mark(4, 10.6, () => { crowd.list.forEach(e => { if (e.act === 'cheer') e.act = e.home; }); mech.post = POSTS.mech; mech.home = 'lean'; crowd.list.push(mech); send(mech, POSTS.mech[0], POSTS.mech[1], 2.2); keyHolder = null; record(5); setStage(ST.DONE); fin = null; if (courier) say(courier, CANON.lines.courierDone, { ms: 2600, sub: false }); say(mech, CANON.lines.done, { voice: true }); });
}

// ─── Stages ─────────────────────────────────────────────────────────────────
let clock = 0, wakeT = 0, wakeMark = 0, relayT = -1, beamFlash = 0, gateLift = 0, flushed = [], sceneRef = null;
function reset(){
 for (const e of [...actors]) drop(e); actors = []; mech = courier = storyteller = vendor = null; keyHolder = null; keyFree = null; care = null; leavers = []; inc = null; fin = null; crowd = null; idle = 0; carry = null; plugAt = [...P.plug]; relayT = -1; gateLift = 0; flushed = []; perches = [];
 for (const m of motes) m.mesh.removeFromParent(); motes = []; for (const b of birds) b.mesh.removeFromParent(); birds = [];
 for (const g of [site?.root, arcade?.root, trail?.root, key, carried?.mesh]) g?.removeFromParent(); site = arcade = trail = key = carried = null;
}
function world(){
 if (sceneRef === State.scene && scope === String(State.citySeed)) return;
 reset(); sceneRef = State.scene; scope = String(State.citySeed); load();
 for (const s of solids){ if (s.id === 'gate') s.on = S.stage < ST.WAKE; if (s.id === 'door') s.on = S.stage < ST.LAMP; } syncSolids();
}
function builds(){
 const p = Player.position, ds = Math.hypot(p.x - 310, p.z - 20), da = pd(P.arcade);
 if (!site && ds < 190) buildSite(); else if (site && ds > 250){ site.root.removeFromParent(); site = null; }
 if (!arcade && da < 170 && window.FCCommonGroundMega?.root) buildArcade(); else if (arcade && da > 230){ arcade.root.removeFromParent(); arcade = null; }
 if (!key) buildKey();
}
function mechTick(dt){
 // Where the mechanic is, by stage. She only exists while you are near her job.
 const st = S.stage; let moving = false;
 if (st < ST.FOLLOW || st === ST.INSTALL || st === ST.DONE) return;
 const post = { [ST.RELAY]: P.relayPost, [ST.CELL]: P.mastPost, [ST.GATE]: P.gatePost, [ST.WAKE]: P.watchPost, [ST.LAMP]: P.doorPost }[st];
 if (!mech){
  if (post){ if (pd(post) > 60 || !loaded(post[0], post[1])) return; const y = stand(post[0], post[1], GY) ?? GY; ensureMech({ x: post[0], y, z: post[1] }); }
  else { const anchors = st === ST.FOLLOW ? OUT : BACK; ensureMech(); mech.li = startIndex(anchors); mech.pathFor = -1; }
 }
 keyHolder = st === ST.INSTALL ? keyHolder : mech;
 if (post && pd(post) > 110){ drop(mech); mech = null; return; }
 if (post && d2(mech.ent.position.x, mech.ent.position.z, post) > 45 && loaded(post[0], post[1])){ const s = spotNear(post[0], post[1], 1, 4, GY); if (s){ mech.ent.position.set(s.x, s.y, s.z); mech.path = null; mech.dest = null; } }
 if (st === ST.FOLLOW){ moving = lead(mech, OUT, dt); if (mech.li >= OUT.length || pd(P.plug) < 9 || pd(P.relayPost) < 6){ setStage(ST.RELAY); say(mech, CANON.lines.relay, { voice: true }); } }
 else if (st === ST.HOME){ moving = lead(mech, BACK, dt); if (mech.li >= BACK.length){ mech.act = 'beckon'; face(mech, Player.position.x, Player.position.z); if (pd(P.niche) < 9 && !mech.asked){ mech.asked = true; say(mech, CANON.lines.niche); } } }
 else if (post){
  const there = standAt(mech, post, st === ST.GATE ? 6.4 : 4.6); moving = !there && go(mech, dt);
  if (there){
   if (st === ST.RELAY){ const to = carry === 'plug' ? P.socket : plugAt; face(mech, to[0], to[1]); mech.act = pd(post) < 14 ? 'point' : 'hold'; }
   else if (st === ST.CELL){ face(mech, P.housing[0], P.housing[1]); mech.act = 'point'; }
   else if (st === ST.GATE){ mech.char.group.rotation.y = Math.PI / 2; mech.act = 'haul'; if (!mech.grind){ mech.grind = true; tone({ noise: true, filter: 'lowpass', ff0: 300, ff1: 160, gain: .12, dur: 1.6 }); } gateLift = Math.min(1, gateLift + dt / 1.6); if (gateLift > .8) setSolid('gate', false); if (!mech.go && pd(P.gate) < 9){ mech.go = true; say(mech, CANON.lines.gate, { voice: true, ms: 1600 }); } }
   else if (st === ST.WAKE){ face(mech, SITE.x, SITE.z); mech.act = 'lookup'; }
   else if (st === ST.LAMP){ face(mech, SITE.x - 3, SITE.z); mech.act = 'point'; }
  } else mech.act = 'hold';
 }
 mech.driven = true; mech.moving = moving;
}
function wakeTick(dt){
 wakeT += dt; const mark = (n, at, fn) => { if (wakeMark === n && wakeT >= at){ wakeMark++; fn(); } };
 mark(0, .1, () => { tone({ f0: 55, f1: 110, gain: .12, dur: 5, type: 'sawtooth', filter: 'lowpass', ff0: 160, ff1: 900 }); });
 mark(1, 1.5, () => { for (let i = 0; i < 3; i++) tone({ f0: 196 * (i + 1) * .75, gain: .06, dur: 3.5, delay: i * .8 }); });
 mark(2, 4, () => { for (let i = 0; i < 11; i++) tone({ f0: 300 + i * 40, gain: .04, dur: .3, delay: i * .3 + 2.3, type: 'triangle' }); });
 mark(3, 6.2, () => { if (mech) say(mech, CANON.lines.wake1, { ms: 1500 }); tone({ f0: 440, f1: 880, gain: .08, dur: 2 }); });
 mark(4, 8.8, () => { tone({ f0: 130, f1: 1040, gain: .1, dur: 1.4, type: 'triangle' }); burst(SITE.x, GY + 10, SITE.z, { count: 24, color: 0xb59bea, size: .1, speed: 4, life: 1.2 }); });
 mark(5, 11.2, () => { tone({ noise: true, filter: 'lowpass', ff0: 220, ff1: 120, gain: .14, dur: 2.4 }); });
 mark(6, 13.3, () => { setSolid('door', false); });
 mark(7, 13.8, () => { record(3); setStage(ST.LAMP); tone({ f0: 660, gain: .06, dur: .9 }); if (mech) say(mech, CANON.lines.wake2, { voice: true }); });
}
function step(dt){
 clock += dt; const t = clock;
 world(); if (!State.scene || !State.citySeed) return;
 builds();
 const st = S.stage;
 if (st === ST.IDLE){ if (active() && onHallFloor() && !window.FCStreetEvents?.current){ idle += dt; if (idle > CANON.delay && !beginIncident()) idle = CANON.delay - 4; } }
 else if (st === ST.INCIDENT && inc) incidentTick(dt);
 else if (st === ST.WAKE) wakeTick(dt);
 else if (st === ST.INSTALL && fin) installTick(dt, t);
 if (st === ST.DONE){ const d = pd(P.arcade); if (!crowd && d < 55 && loaded(P.arcade[0], P.arcade[1]) && arcade) buildCrowd(false); else if (crowd && d > 75){ crowd.list.forEach(drop); crowd = null; storyteller = vendor = null; courier = mech = null; } }
 careTick();
 if (relayT >= 0) relayT += dt; beamFlash = Math.max(0, beamFlash - dt * .7); if (S.stage !== ST.GATE && S.stage < ST.WAKE) gateLift = 0;
 for (const e of actors) e.driven = false;
 mechTick(dt);
 if (crowd) crowdTick(dt, t);
 for (let i = leavers.length - 1; i >= 0; i--){ const e = leavers[i]; if (arrived(e) || pd([e.ent.position.x, e.ent.position.z]) > 40){ drop(e); leavers.splice(i, 1); } }
 for (const e of actors) animate(e, dt, t, e.driven ? e.moving : go(e, dt));
 keyTick(dt, t); motesTick(dt); birdsTick(dt, t); trailTick(t); carryTick(t);
 paintSite(dt, t); paintArcade(t);
 interactions();
}
let prev = performance.now();
function frame(now){
 requestAnimationFrame(frame);
 const dt = Math.min(.1, (now - prev) / 1000); prev = now;
 try {
  if (flickUntil){ const on = now < flickUntil; flickEl.style.opacity = !on ? 0 : reduced.matches ? .3 : (Math.sin(now * .045) > .1 || Math.sin(now * .013) > .6 ? .5 : .08); if (!on) flickUntil = 0; }
  if (!subEl.hidden && now > subUntil) subEl.hidden = true;
  if (State.scene && State.citySeed && !State.ui.paused && !window.FCFirstSignal.debug.frozen) step(dt);
  const show = !!near && active() && !State.ui.paused; promptEl.hidden = !show; if (show) promptEl.textContent = 'E / Tap · ' + near.label;
 } catch (e){ if (!frame.warned){ frame.warned = true; console.warn('[first-signal]', e); } }
}

// ─── Optional records, under Tools ──────────────────────────────────────────
let panel = null, oldPause = false, oldFocus = null;
function closeRecords(){ if (!panel) return; panel.remove(); panel = null; State.ui.paused = oldPause; State.keys?.clear?.(); oldFocus?.focus?.(); }
function openRecords(){
 if (panel || !State.citySeed) return; world();
 oldPause = State.ui.paused; oldFocus = document.activeElement; State.ui.paused = true; State.keys?.clear?.(); window.shTouchReleaseAll?.(); document.exitPointerLock?.();
 panel = document.createElement('section'); panel.id = 'fs-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'First Signal records'); document.body.append(panel);
 const paint = () => {
  const status = S.stage === ST.DONE ? 'The East Arcade is lit.' : S.stage >= ST.FOLLOW ? 'A key is calling east. ' + CANON.mechanic + ' is waiting for you.' : 'Nothing has happened yet. Spend a little time on the floor of Common Ground.';
  panel.innerHTML = '<header><small>FIRST SIGNAL / RECORDS</small><button data-close aria-label="Close records">Close ×</button><h2>What you carried back</h2></header><p>' + status + '</p>'
   + CANON.records.map(([title, text], i) => S.rec.includes(i) ? '<article><small>RECORD ' + (i + 1) + '</small><h3>' + title + '</h3><p>' + text + '</p></article>' : '<article class="locked"><small>RECORD ' + (i + 1) + '</small><p>Not found yet.</p></article>').join('')
   + '<p><button data-subs aria-pressed="' + prefs.subs + '">Subtitles: ' + (prefs.subs ? 'on' : 'off') + '</button><button data-voice aria-pressed="' + prefs.voice + '">Spoken lines: ' + (prefs.voice ? 'on' : 'off') + '</button>' + (S.stage === ST.DONE ? '<button data-again>Run it again</button>' : '') + '</p>'
   + '<footer>These records are optional. Progress saves on this device, separately for each world. Other residents online do not see your courier or your lamp.</footer>';
  panel.querySelector('[data-close]').onclick = closeRecords;
  panel.querySelector('[data-subs]').onclick = () => { prefs.subs = !prefs.subs; savePrefs(); paint(); panel.querySelector('[data-subs]').focus(); };
  panel.querySelector('[data-voice]').onclick = () => { prefs.voice = !prefs.voice; savePrefs(); if (!prefs.voice) window.speechSynthesis?.cancel(); paint(); panel.querySelector('[data-voice]').focus(); };
  const again = panel.querySelector('[data-again]'); if (again) again.onclick = () => { if (again.dataset.sure){ restart(); closeRecords(); } else { again.dataset.sure = '1'; again.textContent = 'The arcade goes dark again. Confirm?'; } };
 };
 paint(); panel.querySelector('[data-close]').focus();
}
function restart(){ const keep = S.rec; reset(); S = { stage: 0, rec: keep, sat: null }; save(); for (const s of solids){ if (s.id === 'gate' || s.id === 'door') s.on = true; } syncSolids(); }

window.FCFirstSignal = {
 stages: ST, places: P, site: SITE, canon: CANON, routes: { out: OUT, back: BACK }, posts: POSTS, openRecords, closeRecords, restart, route, stand,
 get stage(){ return S.stage; }, get state(){ return S; }, get near(){ return near; }, get carry(){ return carry; }, get panel(){ return panel; },
 get mechanic(){ return mech; }, get courier(){ return courier; }, get actors(){ return actors; }, get crowd(){ return crowd; }, get incident(){ return inc; },
 get built(){ return { site: !!site, arcade: !!arcade }; }, use: useNear,
 // Test and authoring hooks. `run` advances the adventure without waiting for frames.
 debug: {
  frozen: false,
  run(seconds, dt = .05){ for (let t = 0; t < seconds; t += dt) step(dt); },
  skipTo(stage){ world(); const keep = S.rec; reset(); S = { stage, rec: keep, sat: S.sat }; carry = stage === ST.HOME ? 'lamp' : stage === ST.GATE ? 'cell' : null; relayT = -1; save(); for (const s of solids){ if (s.id === 'gate') s.on = stage < ST.WAKE; if (s.id === 'door') s.on = stage < ST.LAMP; } syncSolids(); },
  hurry(){ idle = CANON.delay; },
  get wake(){ return { t: wakeT, parts: wakeParts() }; }, get gate(){ return gateLift; }, get solids(){ return solids; }, get siteParts(){ return site; }, get arcadeParts(){ return arcade; }, get lit(){ return arcadeLit(); },
 },
};
requestAnimationFrame(frame);
})();
