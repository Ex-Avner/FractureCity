/* Weird city fauna: more things alive in the cracks of Fracture City.

   Neon jellies drift over the streets, brighter after dark.
   Antenna-crows perch on roofs and shout corrections at you.
   Trash crabs wear cups and cans and scuttle off sideways.
   Cable snakes, striped like extension leads, slither and spark.
   Pothole toads puff up and croak if you step too close.
   Gutter hounds trot in packs and tag along if you stand still.
   Rumour slugs leave glowing trails that fade.

   Decoration: no collision, no saving, nothing to shoot. Counts scale with
   the graphics tier. Joins city-wildlife.js (moths, pigeons, sidewalk eels). */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined') return;
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const hour = () => (((State.dayTime || 0) / 60) % 24 + 24) % 24, night = () => { const h = hour(); return h >= 19.5 || h < 5.5; };
const scale = () => ({ perf: 0.35, low: 0.55, balanced: 0.8 })[window.HD?.tier] ?? 1;
const feet = () => Player.position.y - Player.height;
const surface = (x, z, from) => typeof shSurfaceY === 'function' ? shSurfaceY(x, z, from) : 1;
const clear = (x, y, z, r = .3, h = .6) => typeof shBodyBlocked !== 'function' || !shBodyBlocked(x, y, z, r, h);
const dist2 = (p) => Math.hypot(p.x - Player.position.x, p.z - Player.position.z);

// ─── Materials and parts ─────────────────────────────────────────────────────
const MAT = {}, m = (c, kind = 'std') => MAT[c + ':' + kind] || (MAT[c + ':' + kind] = kind === 'glow' ? new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending }) : kind === 'flat' ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshStandardMaterial({ color: c, roughness: .82, metalness: .05 }));
const GEO = { ball: new THREE.SphereGeometry(1, 10, 7), dome: new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2), box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 8), cone: new THREE.ConeGeometry(1, 1, 6), plane: new THREE.PlaneGeometry(1, 1) };
function part(parent, geo, mat, x, y, z, sx, sy, sz){ const o = new THREE.Mesh(GEO[geo], mat); o.position.set(x, y, z); o.scale.set(sx, sy ?? sx, sz ?? sx); parent.add(o); return o; }
function label(text, color = '#1d1a18', bg = '#fbf6e9'){
 const cv = document.createElement('canvas'); cv.width = 256; cv.height = 72; const g = cv.getContext('2d');
 g.fillStyle = bg; g.strokeStyle = color; g.lineWidth = 4; g.beginPath(); g.roundRect ? g.roundRect(3, 3, 250, 50, 12) : g.rect(3, 3, 250, 50); g.fill(); g.stroke();
 g.beginPath(); g.moveTo(118, 53); g.lineTo(128, 70); g.lineTo(138, 53); g.fill();
 g.fillStyle = color; g.font = 'bold 26px Impact, sans-serif'; g.textAlign = 'center'; g.fillText(text, 128, 38);
 const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
 const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(1.3, .37, 1); s.renderOrder = 8; return s;
}
function dispose(o){ o.removeFromParent(); o.traverse(c => { if (c.isSprite){ c.material.map?.dispose(); c.material.dispose(); } if (c.userData.baked) c.geometry.dispose(); }); }
//  Draw calls are what cost here, so each creature's still parts are baked into
//  one mesh per kind of material (vertex colours); only moving parts stay apart.
const BAKED = {};
//  Baked meshes carry no texture coordinates, so the texture pack and weathering leave them alone.
function bakedMat(kind){ return BAKED[kind] || (BAKED[kind] = Object.assign(kind === 'glow' ? new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending }) : kind === 'flat' ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true }), { __texPack: true })); }
for (const k of ['std', 'flat', 'glow']) bakedMat(k).userData.fcWeathered = true;
function bake(container, keep = []){
 const by = {};
 for (const c of [...container.children]){
  if (!c.isMesh || keep.includes(c)) continue;
  const kind = c.material.blending === THREE.AdditiveBlending ? 'glow' : c.material.isMeshBasicMaterial ? 'flat' : 'std';
  c.updateMatrix(); const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone(); g.applyMatrix4(c.matrix);
  const col = c.material.color, n = g.attributes.position.count, cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){ cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.deleteAttribute('uv');
  (by[kind] || (by[kind] = [])).push(g); container.remove(c);
 }
 for (const [kind, list] of Object.entries(by)){
  let total = 0; for (const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3); let o = 0;
  for (const g of list){ pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, bakedMat(kind)); m.userData.baked = true; container.add(m);
 }
 return container;
}
function shout(c, text, secs = 1.8, y = .9){ if (c.say) dispose(c.say); c.say = label(text); c.say.position.y = y; c.group.add(c.say); c.sayT = secs; }

// ─── Species ─────────────────────────────────────────────────────────────────
const NEON = [0xff2e88, 0x00e5ff, 0xb388ff, 0x39ff14, 0xffe500];
const S = {
 jelly(){
  const g = new THREE.Group(), c = pick(NEON), bell = part(g, 'dome', m(c, 'glow'), 0, 0, 0, .55, .45), core = part(g, 'ball', m(0xffffff, 'glow'), 0, .1, 0, .16);
  //  Tentacles in two joints each, so they trail and curl.
  const tent = []; for (let i = 0; i < 3; i++){ const a = i / 3 * TAU, j = new THREE.Group(); j.position.set(Math.cos(a) * .25, -.02, Math.sin(a) * .25); g.add(j); part(j, 'cyl', m(c, 'glow'), 0, -.35, 0, .014, .7, .014); const k = new THREE.Group(); k.position.y = -.7; j.add(k); part(k, 'cyl', m(c, 'glow'), 0, -.3, 0, .009, .6, .009); j.k = k; tent.push(j); }
  part(g, 'dome', m(0xffffff, 'glow'), 0, .02, 0, .5, .08).rotation.x = Math.PI; bake(g, [bell, core]);
  return { group: g, bell, core, tent, phase: rnd(0, TAU), tick(t){ const k = 1 + Math.sin(t * 2.2 + this.phase) * .12; bell.scale.set(.55 * k, .45 / k, .55 * k); tent.forEach((x, i) => { x.rotation.z = Math.sin(t * 1.8 + i + this.phase) * .22; x.rotation.x = Math.cos(t * 1.5 + i) * .18; x.k.rotation.z = Math.sin(t * 2.4 + i * 1.3 + this.phase) * .45; }); core.material.opacity = night() ? .9 : .45; bell.material.opacity = night() ? .75 : .4; } };
 },
 crow(){
  const g = new THREE.Group(), black = m(0x15131a), body = part(g, 'ball', black, 0, .16, 0, .13, .12, .22), head = part(g, 'ball', black, 0, .27, .17, .08);
  part(g, 'cone', m(0xe2c044), 0, .26, .27, .025, .09, .025).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]){ const r = part(g, 'cyl', m(0xb8bcc8), s * .04, .38, .15, .006, .2, .006); r.rotation.z = -s * .45; part(g, 'ball', m(0xff2e88, 'flat'), s * .085, .47, .15, .02); }
  const wings = [-1, 1].map(s => { const w = part(g, 'box', black, s * .14, .18, 0, .2, .02, .16); w.position.x = s * .14; return w; });
  part(g, 'box', black, 0, .14, -.26, .09, .02, .14);
  for (const s of [-1, 1]) part(g, 'cyl', m(0x3a3d45), s * .05, .05, 0, .008, .1, .008);
  bake(g, [...wings, head]);
  return { group: g, head, wings, tick(t, flying){ wings.forEach((w, i) => w.rotation.z = flying ? Math.sin(t * 22) * (i ? -.9 : .9) : (i ? -.1 : .1)); head.rotation.y = flying ? 0 : Math.sin(t * 1.3) * .6; } };
 },
 crab(){
  const g = new THREE.Group(), shell = new THREE.Group(); g.add(shell);
  const can = Math.random() < .5, col = pick([0xb3122e, 0xe9e5dc, 0x1d3b6b, 0xe2c044, 0x2e5e3a]);
  if (can){ part(shell, 'cyl', m(col), 0, .17, 0, .08, .18, .08).rotation.z = Math.PI / 2; part(shell, 'cyl', m(0xb8bcc8), 0, .17, 0, .081, .03, .081).rotation.z = Math.PI / 2; }
  else { part(shell, 'cyl', m(0xe9e5dc), 0, .18, 0, .09, .2, .09); part(shell, 'cyl', m(col), 0, .29, 0, .095, .02, .095); part(shell, 'cyl', m(0xff2e88), .03, .38, 0, .008, .18, .008).rotation.z = -.2; }
  const body = part(g, 'ball', m(0xd96a2a), 0, .08, 0, .1, .05, .08);
  for (const s of [-1, 1]) part(g, 'ball', m(0x111111, 'flat'), s * .03, .13, .07, .015);
  const legs = [-1, 1].map(s => { const set = new THREE.Group(); set.position.set(s * .08, .07, 0); g.add(set); for (let i = 0; i < 3; i++){ const l = part(set, 'box', m(0xd96a2a), s * .05, -.03, -.05 + i * .05, .1, .012, .012); l.rotation.z = s * .5; } part(set, 'ball', m(0xd96a2a), s * .06, .02, .09, .03, .02, .04); return bake(set); });
  bake(shell); bake(g);
  return { group: g, legs, tick(t, moving){ legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(t * 24 + i * Math.PI) * .4 : 0); } };
 },
 snake(){
  const g = new THREE.Group(), segs = [], col = pick([0xe2c044, 0xff6a00, 0xe9e5dc]);
  for (let i = 0; i < 6; i++){ const s = part(g, 'ball', m(i % 2 ? 0x15131a : col), 0, .06, 0, .055 - i * .004); segs.push(s); }
  const head = new THREE.Group(); g.add(head); part(head, 'box', m(0x15131a), 0, .07, 0, .1, .07, .13); for (const s of [-1, 1]) part(head, 'box', m(0xb8bcc8), s * .025, .07, .1, .012, .02, .06); part(head, 'ball', m(0x39ff14, 'flat'), .03, .1, .04, .012); part(head, 'ball', m(0x39ff14, 'flat'), -.03, .1, .04, .012); bake(head);
  return { group: g, segs, head, trail: [], tick(){} };
 },
 toad(){
  const g = new THREE.Group(), body = part(g, 'ball', m(0x2b2a2e), 0, .14, 0, .2, .13, .22);
  part(g, 'box', m(0xe2c044), 0, .27, 0, .04, .005, .3);
  for (const s of [-1, 1]){ part(g, 'ball', m(0xe2c044, 'flat'), s * .09, .26, .13, .045); part(g, 'ball', m(0x111111, 'flat'), s * .1, .27, .17, .02); part(g, 'ball', m(0x2b2a2e), s * .16, .05, .1, .06, .04, .09); }
  const throat = part(g, 'ball', m(0xb3122e), 0, .1, .16, .06); bake(g, [body, throat]);
  return { group: g, body, throat, puff: 0, tick(t){ const p = this.puff; body.scale.set(.2 * (1 + p * .6), .13 * (1 + p * .8), .22 * (1 + p * .5)); throat.scale.setScalar(.06 * (1 + p * 1.6 + Math.max(0, Math.sin(t * 6)) * .2)); } };
 },
 hound(){
  const g = new THREE.Group(), coat = pick([0x7a4b2a, 0x3a3d45, 0xa8743a, 0x2a1d19]), patch = pick([0xe9e5dc, 0xb3122e, 0x1d3b6b, 0xff6a00]);
  part(g, 'ball', m(coat), 0, .44, 0, .15, .14, .33); part(g, 'ball', m(patch), .06, .5, .08, .1, .07, .16); part(g, 'ball', m(coat), 0, .5, .24, .13, .13, .13);
  const head = new THREE.Group(); head.position.set(0, .62, .38); g.add(head);
  part(head, 'ball', m(coat), 0, 0, 0, .11, .1, .11); part(head, 'ball', m(coat), 0, -.035, .1, .06, .055, .09); part(head, 'ball', m(0x111111, 'flat'), 0, -.02, .19, .025);
  for (const s of [-1, 1]){ const e = part(head, 'cone', m(s < 0 ? patch : coat), s * .07, .12, -.01, .045, .13, .03); e.rotation.z = -s * .25; part(head, 'ball', m(0xffe500, 'flat'), s * .045, .03, .085, .018); }
  const legs = [[-.08, .2], [.08, .2], [-.08, -.2], [.08, -.2]].map(([x, z]) => { const l = new THREE.Group(); l.position.set(x, .36, z); g.add(l); part(l, 'cyl', m(coat), 0, -.17, 0, .035, .34, .035); part(l, 'ball', m(0x2a1d19), 0, -.35, .02, .045, .025, .06); return l; });
  const tail = part(g, 'cyl', m(coat), 0, .58, -.36, .022, .26, .022); tail.rotation.x = -.8;
  part(g, 'cyl', m(0xb3122e), 0, .5, .3, .11, .03, .11).rotation.x = Math.PI / 2 - .3;
  bake(head); legs.forEach(l => bake(l)); bake(g, [tail]);
  return { group: g, head, legs, tail, tick(t, moving){ legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(t * 11 + (i === 0 || i === 3 ? 0 : Math.PI)) * .6 : 0); tail.rotation.y = Math.sin(t * (moving ? 14 : 5)) * .5; head.rotation.y = moving ? 0 : Math.sin(t * .8) * .5; } };
 },
 slug(){
  const g = new THREE.Group(), c = pick([0x39ff14, 0xb388ff, 0x00e5ff]), body = part(g, 'ball', m(c, 'glow'), 0, .05, 0, .06, .045, .2);
  for (const s of [-1, 1]){ const st = part(g, 'cyl', m(c, 'glow'), s * .025, .11, .15, .006, .08, .006); st.rotation.x = .5; part(g, 'ball', m(0xffffff, 'flat'), s * .03, .15, .17, .012); }
  bake(g, [body]);
  return { group: g, body, c, tick(t){ body.scale.z = .2 * (1 + Math.sin(t * 2) * .12); } };
 },
};

// ─── Populations ─────────────────────────────────────────────────────────────
const live = { jelly: [], crow: [], crab: [], snake: [], toad: [], hound: [], slug: [] };
const trails = [];
const WANT = () => { const k = scale(), n = night(); return { jelly: Math.round((n ? 8 : 4) * k), crow: Math.round(4 * k), crab: Math.round((n ? 6 : 3) * k), snake: Math.round(2 * k), toad: Math.round((n ? 4 : 2) * k), hound: n ? 0 : Math.round(3 * k), slug: Math.round((n ? 4 : 0) * k) }; };
const WAIT = { jelly: 0, crow: 0, crab: 0, snake: 0, toad: 0, hound: 0, slug: 0 };
let root = null, scene = null;
function ensure(){ if (!State.scene) return false; if (root && scene === State.scene && root.parent) return true; for (const k in live){ for (const c of live[k]) dispose(c.group); live[k].length = 0; } scene = State.scene; root = new THREE.Group(); root.name = 'city-fauna'; scene.add(root); return true; }
function groundSpot(rMin, rMax){
 for (let i = 0; i < 10; i++){ const a = rnd(0, TAU), d = rnd(rMin, rMax), x = Player.position.x + Math.cos(a) * d, z = Player.position.z + Math.sin(a) * d, y = surface(x, z, feet() + 3); if (y > 0 && Math.abs(y - feet()) < 2.6 && clear(x, y, z)) return { x, y, z }; }
 return null;
}
function add(kind, at){ const c = S[kind](); c.kind = kind; c.group.position.set(at.x, at.y, at.z); c.group.rotation.y = rnd(0, TAU); c.t = 0; c.vel = new THREE.Vector3(); c.state = 'idle'; c.wait = rnd(0, 3); root.add(c.group); live[kind].push(c); return c; }
function spawn(kind){
 if (kind === 'jelly'){ const s = groundSpot(10, 34); if (!s) return; const n = Math.ceil(rnd(1, 3)); for (let i = 0; i < n; i++){ const c = add('jelly', { x: s.x + rnd(-2, 2), y: s.y + rnd(4, 8), z: s.z + rnd(-2, 2) }); c.base = c.group.position.y; c.dir = rnd(0, TAU); } return; }
 if (kind === 'crow'){
  //  On a roof edge or a lamp near you: the highest surface nearby.
  for (let i = 0; i < 12; i++){ const a = rnd(0, TAU), d = rnd(8, 26), x = Player.position.x + Math.cos(a) * d, z = Player.position.z + Math.sin(a) * d, y = surface(x, z, feet() + 30); if (y - feet() > 3 && y - feet() < 26){ const c = add('crow', { x, y, z }); c.perch = { x, y, z }; c.state = 'perch'; c.wait = rnd(4, 9); return; } }
  //  No roof handy: the top of a street lamp.
  const V = new THREE.Vector3(), lamps = [];
  for (const ch of State.chunkMap.values()) for (const l of ch.lights || []){ if (!l.parent) continue; l.getWorldPosition(V); const d = Math.hypot(V.x - Player.position.x, V.z - Player.position.z); if (d > 6 && d < 30 && V.y - feet() > 2) lamps.push(V.clone()); }
  if (lamps.length){ const L = pick(lamps), c = add('crow', { x: L.x + rnd(-.2, .2), y: L.y + .25, z: L.z + rnd(-.2, .2) }); c.perch = { x: c.group.position.x, y: c.group.position.y, z: c.group.position.z }; c.state = 'perch'; c.wait = rnd(4, 9); }
  return;
 }
 if (kind === 'hound'){ const s = groundSpot(16, 30); if (!s) return; for (let i = 0; i < 3; i++){ const y = surface(s.x + i * .8, s.z, s.y + 1.5); add('hound', { x: s.x + i * .8, y: Math.abs(y - s.y) < 1 ? y : s.y, z: s.z + (i % 2) * .7 }); } return; }
 if (kind === 'crab'){ const s = groundSpot(6, 22); if (!s) return; for (let i = 0; i < 3; i++) add('crab', { x: s.x + rnd(-1, 1), y: s.y, z: s.z + rnd(-1, 1) }); return; }
 const s = groundSpot(6, 24); if (s) add(kind, s);
}
function walkTo(c, x, z, speed, dt){
 const p = c.group.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < .05) return true;
 const st = Math.min(d, speed * dt), nx = p.x + dx / d * st, nz = p.z + dz / d * st, ny = surface(nx, nz, p.y + 1);
 if (Math.abs(ny - p.y) > .6 || !clear(nx, ny, nz, .15, .3)){ c.wait = 0; c.goal = null; return true; }
 p.set(nx, ny, nz); c.group.rotation.y = Math.atan2(dx, dz); return d - st < .05;
}
function wander(c, dt, speed, radius, pauseMin = 1, pauseMax = 4){
 if (!c.goal){ c.wait -= dt; if (c.wait > 0) return false; const a = rnd(0, TAU), r = rnd(1, radius); c.goal = { x: c.group.position.x + Math.cos(a) * r, z: c.group.position.z + Math.sin(a) * r }; }
 if (walkTo(c, c.goal.x, c.goal.z, speed, dt)){ c.goal = null; c.wait = rnd(pauseMin, pauseMax); return false; }
 return true;
}
const CAWS = ['CORRECTION!', 'ALLEGEDLY!', 'DEVELOPING!', 'NO COMMENT!', 'SOURCES SAY!', 'CAW. RETRACT.', 'BREAKING!'];
function update(c, t, dt){
 const p = c.group.position, d = dist2(p);
 if (c.sayT !== undefined && (c.sayT -= dt) <= 0 && c.say){ dispose(c.say); c.say = null; }
 switch (c.kind){
  case 'jelly': {
   c.dir += Math.sin(t * .3 + c.phase) * dt * .4; const nx = p.x + Math.sin(c.dir) * dt * .5, nz = p.z + Math.cos(c.dir) * dt * .5, ny = c.base + Math.sin(t * .7 + c.phase) * .5;
   if (clear(nx, ny - .5, nz, .4, 1.2)) p.set(nx, ny, nz); else c.dir += Math.PI;
   if (d < 3 && p.y - feet() < 5) c.base += dt * 1.5;
   c.tick(t); break;
  }
  case 'crow': {
   if (c.state === 'perch'){ c.tick(t, false); if ((c.wait -= dt) <= 0){ c.wait = rnd(5, 12); if (d < 22 && Math.random() < .6) shout(c, pick(CAWS)); } if (d < 3.5 && Math.abs(p.y - feet()) < 2){ c.state = 'fly'; c.vel.set(rnd(-3, 3), 4, rnd(-3, 3)); shout(c, 'CAW!'); } if (Math.random() < dt / 25){ const s = groundSpot(3, 8); if (s){ c.state = 'swoop'; c.from = p.clone(); c.to = new THREE.Vector3(s.x, s.y, s.z); c.k = 0; } } }
   else if (c.state === 'swoop' || c.state === 'return'){ c.k += dt / 1.6; const k = Math.min(1, c.k); p.lerpVectors(c.from, c.to, k); p.y += Math.sin(k * Math.PI) * 2; c.group.rotation.y = Math.atan2(c.to.x - c.from.x, c.to.z - c.from.z); c.tick(t, true); if (k >= 1){ if (c.state === 'swoop'){ c.state = 'ground'; c.wait = rnd(3, 6); } else { c.state = 'perch'; } } }
   else if (c.state === 'ground'){ c.tick(t, false); c.group.rotation.x = Math.sin(t * 8) > .7 ? .5 : 0; if ((c.wait -= dt) <= 0 || d < 3){ c.group.rotation.x = 0; c.state = 'return'; c.from = p.clone(); c.to = new THREE.Vector3(c.perch.x, c.perch.y, c.perch.z); c.k = 0; if (d < 3) shout(c, pick(CAWS)); } }
   else { p.addScaledVector(c.vel, dt); c.vel.y += dt; c.tick(t, true); if (p.y - feet() > 30) c.gone = true; }
   break;
  }
  case 'crab': {
   if (c.state === 'flee'){ const away = Math.atan2(p.x - Player.position.x, p.z - Player.position.z); const moved = !walkTo(c, p.x + Math.sin(away) * 2, p.z + Math.cos(away) * 2, 3.2, dt); c.group.rotation.y = away + Math.PI / 2; c.tick(t, true); if ((c.fled += dt) > 2.4){ if (typeof shBurst === 'function') shBurst(p.x, p.y + .05, p.z, { count: 5, color: 0x3a3442, size: .05, speed: 2, life: .4, grav: 10 }); c.gone = true; } }
   else { const m = wander(c, dt, .9, 2.5, .5, 2.5); if (m) c.group.rotation.y += Math.PI / 2; c.tick(t, m); if (d < 3){ c.state = 'flee'; c.fled = 0; } }
   break;
  }
  case 'snake': {
   const m = wander(c, dt, .8, 6, 2, 6), seg = c.segs;
   c.trail.unshift(p.clone()); if (c.trail.length > 60) c.trail.length = 60;
   c.head.position.set(0, 0, 0); c.head.rotation.y = 0;
   const inv = new THREE.Matrix4().copy(c.group.matrixWorld).invert();
   seg.forEach((s, i) => { const q = c.trail[Math.min(c.trail.length - 1, (i + 1) * 7)]; if (q){ const l = q.clone().applyMatrix4(inv); s.position.set(l.x + (m ? Math.sin(t * 6 + i) * .04 : 0), .05, l.z); } });
   if (m && Math.random() < dt / 4 && typeof shBurst === 'function') shBurst(p.x, p.y + .1, p.z, { count: 4, color: 0xfff1a0, size: .03, speed: 2.5, life: .25, grav: 6 });
   break;
  }
  case 'toad': {
   c.puff += ((d < 2.8 ? 1 : 0) - c.puff) * Math.min(1, dt * 4);
   if (d < 2.8 && !c.croaked){ c.croaked = true; shout(c, pick(['BRRRAP.', 'RIBBIT, PAL.', 'MIND THE HOLE.'])); }
   if (d > 5) c.croaked = false;
   if (c.hop){ c.hop.k += dt / .45; const k = Math.min(1, c.hop.k); p.lerpVectors(c.hop.from, c.hop.to, k); p.y += Math.sin(k * Math.PI) * .45; if (k >= 1) c.hop = null; }
   else if ((c.wait -= dt) <= 0){ c.wait = rnd(2, 6); const a = d < 4 ? Math.atan2(p.x - Player.position.x, p.z - Player.position.z) : rnd(0, TAU), x = p.x + Math.sin(a) * 1.2, z = p.z + Math.cos(a) * 1.2, y = surface(x, z, p.y + 1); if (Math.abs(y - p.y) < .6 && clear(x, y, z, .15, .3)){ c.hop = { from: p.clone(), to: new THREE.Vector3(x, y, z), k: 0 }; c.group.rotation.y = a; } }
   c.tick(t); break;
  }
  case 'hound': {
   //  Stand still near a pack and it decides you are interesting for a while.
   const still = Math.hypot(Player.velocity?.x || 0, Player.velocity?.z || 0) < .3;
   c.interest = Math.max(0, (c.interest || 0) + (d < 7 && still ? dt : -dt * .2));
   if (c.interest > 2.5 && !c.adopted){ c.adopted = 45; shout(c, pick(['WOOF?', 'ARF.', 'YIP!']), 1.6, 1.0); }
   if (c.adopted){ c.adopted -= dt; if (c.adopted <= 0){ c.adopted = 0; c.interest = 0; } const i = live.hound.indexOf(c), a = Player.yaw + Math.PI + (i - 1) * .5; const tx = Player.position.x + Math.sin(a) * -2.2, tz = Player.position.z + Math.cos(a) * -2.2; const m = Math.hypot(tx - p.x, tz - p.z) > 1 && !walkTo(c, tx, tz, d > 6 ? 6 : 3.4, dt); c.tick(t, m || Math.hypot(tx - p.x, tz - p.z) > 1); if (d > 30){ p.set(tx, surface(tx, tz, feet() + 2), tz); } }
   else { const lead = live.hound[0]; let m; if (lead && lead !== c){ const lp = lead.group.position; m = Math.hypot(lp.x - p.x, lp.z - p.z) > 1.4 && !walkTo(c, lp.x - .8, lp.z - .8, 3.2, dt); } else m = wander(c, dt, 2.6, 10, 1, 3); c.tick(t, !!m); }
   if (Math.random() < dt / 30 && d < 20) shout(c, pick(['WOOF.', 'ARF!', 'GRR.']), 1.2, 1.0);
   break;
  }
  case 'slug': {
   const m = wander(c, dt, .18, 2, 1, 4); c.tick(t);
   if (m && (c.drip = (c.drip || 0) - dt) <= 0){ c.drip = .5; const tr = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ color: c.c, transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending })); tr.rotation.x = -Math.PI / 2; tr.scale.set(.08, .14, 1); tr.position.set(p.x, p.y + .015, p.z); root.add(tr); trails.push({ m: tr, life: 25 }); }
   break;
  }
 }
}
let last = performance.now(), check = 0;
function tick(now){
 requestAnimationFrame(tick);
 const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
 try {
  if (!State.scene || !State.chunkMap?.size || State.ui.inIntro || window.FN?.prologue){ if (root) root.visible = false; return; }
  if (!ensure()) return; root.visible = true;
  if (State.ui.paused) return;
  const t = now / 1000;
  if ((check -= dt) <= 0){
   check = 1.5; const want = WANT();
   for (const k in live){
    const n = k === 'hound' ? (live.hound.length ? 1 : 0) * 3 : live[k].length;
    if (n < want[k] && (WAIT[k] -= 1.5) <= 0 && Player.mode !== 'drive'){ spawn(k); WAIT[k] = rnd(3, 9); }
    for (const c of live[k]) if (dist2(c.group.position) > 70) c.gone = true;
    if (k === 'hound' && live.hound.some(c => c.gone)) live.hound.forEach(c => c.gone = true);
   }
  }
  for (const k in live){ const arr = live[k]; for (let i = arr.length - 1; i >= 0; i--){ const c = arr[i]; if (!c.gone) update(c, t, dt); if (c.gone){ dispose(c.group); arr.splice(i, 1); } } }
  for (let i = trails.length - 1; i >= 0; i--){ const tr = trails[i]; tr.life -= dt; tr.m.material.opacity = Math.min(.6, tr.life / 10); if (tr.life <= 0){ tr.m.removeFromParent(); tr.m.material.dispose(); trails.splice(i, 1); } }
 } catch (e){ if (!tick._w){ tick._w = 1; console.warn('[fauna]', e); } }
}
requestAnimationFrame(tick);
window.FCFauna = { species: Object.keys(S), make: k => S[k](), get counts(){ const o = {}; for (const k in live) o[k] = live[k].length; return o; }, spawn: k => ensure() && spawn(k), live };
})();
