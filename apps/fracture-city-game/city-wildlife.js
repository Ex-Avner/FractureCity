/* City wildlife: the strange animals that live in the cracks of Fracture City.

   Lamp moths circle the sodium street lamps at night. Many-winged pigeons
   peck on the pavement and burst off when you walk up. Sidewalk eels, striped
   like lane paint, arc out of the asphalt after dark and dive back in.

   All of it is decoration and costs no collision or saving. The same bodies
   are used by the Seam for the creatures you can tame there, so this file
   also owns how each species looks and moves (window.FCWildlife.make). */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined') return;

const TAU = Math.PI * 2;
const hour = () => (((State.dayTime || 0) / 60) % 24 + 24) % 24;
const night = () => { const h = hour(); return h >= 19.5 || h < 5.5; };
const scale = () => ({ perf: 0.4, low: 0.5, balanced: 0.75 })[window.HD?.tier] ?? 1;
const rnd = (a, b) => a + Math.random() * (b - a);

// ─── Shared looks ──────────────────────────────────────────────────────────
function canvasTex(w, h, paint){
 const c = document.createElement('canvas'); c.width = w; c.height = h;
 paint(c.getContext('2d'), w, h);
 const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
//  Newsprint: a masthead bar, headline blocks, column rules and grey type.
const WORDS = ['CORRECTION', 'RETRACTED', 'SOURCES SAY', 'UNCONFIRMED', 'ALLEGEDLY', 'DEVELOPING', 'NO COMMENT', 'EXCLUSIVE'];
const NEWS_TEX = canvasTex(256, 256, (g, w, h) => {
 g.fillStyle = '#e9e3d2'; g.fillRect(0, 0, w, h);
 g.fillStyle = '#1d1a18'; g.font = 'bold 30px Georgia, serif'; g.fillText('THE FRACTURE', 12, 34);
 g.fillRect(10, 42, w - 20, 3);
 for (let i = 0; i < 5; i++){
  const y = 62 + i * 40;
  g.font = 'bold 15px Georgia, serif'; g.fillStyle = '#1d1a18';
  g.fillText(WORDS[(i * 3) % WORDS.length], 12 + (i % 2) * 120, y);
  g.fillStyle = '#8a857a';
  for (let r = 0; r < 3; r++) g.fillRect(12 + (i % 2) * 120, y + 7 + r * 7, 104 - r * 9, 3);
 }
 g.fillStyle = '#b8b2a2'; g.fillRect(126, 50, 2, 196);
});
NEWS_TEX.wrapS = NEWS_TEX.wrapT = THREE.RepeatWrapping;
//  Moth wings: dusty cream with an eye that stares back.
const WING_TEX = canvasTex(64, 64, (g, w) => {
 const r = g.createRadialGradient(w * .55, w * .5, 2, w * .5, w * .5, w * .5);
 r.addColorStop(0, '#fff4d8'); r.addColorStop(.7, '#c9a878'); r.addColorStop(1, 'rgba(120,90,60,0)');
 g.fillStyle = r; g.beginPath(); g.ellipse(w / 2, w / 2, w * .48, w * .36, 0, 0, TAU); g.fill();
 g.fillStyle = '#2a1c14'; g.beginPath(); g.arc(w * .58, w * .48, 9, 0, TAU); g.fill();
 g.fillStyle = '#ffcf6a'; g.beginPath(); g.arc(w * .58, w * .48, 5, 0, TAU); g.fill();
 g.fillStyle = '#120a06'; g.beginPath(); g.arc(w * .59, w * .48, 2.4, 0, TAU); g.fill();
});

const GEO = { box: new THREE.BoxGeometry(1, 1, 1), plane: new THREE.PlaneGeometry(1, 1) };
const mats = new Map();
function mat(key, make){ let m = mats.get(key); if (!m){ m = make(); m.userData.shared = true; mats.set(key, m); } return m; }
const lam = c => mat('l' + c, () => new THREE.MeshLambertMaterial({ color: c }));
const glow = c => mat('g' + c, () => new THREE.MeshBasicMaterial({ color: c }));
function box(parent, w, h, d, m, x, y, z){
 const o = new THREE.Mesh(GEO.box, m); o.scale.set(w, h, d); o.position.set(x, y, z); parent.add(o); return o;
}
function plane(parent, w, h, m, x, y, z){
 const o = new THREE.Mesh(GEO.plane, m); o.scale.set(w, h, 1); o.position.set(x, y, z); parent.add(o); return o;
}

// ─── Species ───────────────────────────────────────────────────────────────
//  Each make() returns { group, tick(t, moving) }. Bodies face +z.
const SPECIES = {
 moth: { name: 'Lamp moth', fav: 'tuber', blurb: 'Drawn to sodium light. Eats only what grows under it.',
  make(s = 1){
   const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
   box(body, .07 * s, .07 * s, .26 * s, lam(0xd8c49a), 0, 0, 0);
   box(body, .08 * s, .08 * s, .07 * s, glow(0xffd27a), 0, .01 * s, .14 * s);
   const wm = mat('wing', () => new THREE.MeshBasicMaterial({ map: WING_TEX, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
   const wings = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.x = side * .03 * s; body.add(pivot);
    const p = plane(pivot, .34 * s, .3 * s, wm, side * .17 * s, 0, .02 * s); p.rotation.x = -Math.PI / 2;
    return { pivot, side };
   });
   return { group: g, tick(t, moving){ const f = moving ? 22 : 9; for (const w of wings) w.pivot.rotation.z = w.side * (0.25 + Math.sin(t * f) * 0.75); body.position.y = Math.sin(t * 3.1) * .03 * s; } };
  } },
 pigeon: { name: 'Many-winged pigeon', fav: 'wheat', blurb: 'Eight wings, no sense of direction. Loves headline wheat.',
  make(s = 1){
   const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
   const grey = lam(0x7d8088), dark = lam(0x4a4c55);
   box(body, .2 * s, .18 * s, .32 * s, grey, 0, .2 * s, 0);
   box(body, .16 * s, .1 * s, .14 * s, dark, 0, .19 * s, -.2 * s);
   const head = new THREE.Group(); head.position.set(0, .32 * s, .15 * s); body.add(head);
   box(head, .12 * s, .12 * s, .12 * s, grey, 0, 0, 0);
   box(head, .13 * s, .06 * s, .1 * s, glow(0x5fd0b0), 0, -.06 * s, -.02 * s);
   box(head, .04 * s, .03 * s, .07 * s, lam(0xe0a040), 0, -.01 * s, .08 * s);
   for (const x of [-1, 1]) box(head, .02 * s, .03 * s, .02 * s, glow(0xff4030), x * .061 * s, .02 * s, .03 * s);
   for (const x of [-1, 1]) box(body, .025 * s, .12 * s, .025 * s, lam(0xd06a50), x * .05 * s, .06 * s, .02 * s);
   //  Four wings a side, staggered down the back.
   const wings = [];
   for (let i = 0; i < 4; i++) for (const side of [-1, 1]){
    const pivot = new THREE.Group(); pivot.position.set(side * .1 * s, .27 * s, (.08 - i * .07) * s); body.add(pivot);
    box(pivot, .2 * s, .02 * s, .09 * s, i % 2 ? dark : grey, side * .1 * s, 0, 0);
    wings.push({ pivot, side, i });
   }
   return { group: g, head, tick(t, moving){
    for (const w of wings) w.pivot.rotation.z = w.side * (moving ? Math.sin(t * 26 + w.i * .9) * 1.0 : -0.15 + Math.sin(t * 2 + w.i) * .05);
    head.rotation.x = moving ? 0 : Math.max(0, Math.sin(t * 5.5)) * 0.8;
   } };
  } },
 eel: { name: 'Sidewalk eel', fav: 'melon', blurb: 'Lives in the asphalt and wears the lane paint. Hums for static melon.',
  make(s = 1){
   const g = new THREE.Group(), segs = [];
   for (let i = 0; i < 9; i++){
    const seg = new THREE.Group(); g.add(seg);
    const w = (.2 - i * .015) * s;
    box(seg, w, w * .8, .2 * s, lam(0x2b2636), 0, 0, 0);
    box(seg, w * .3, w * .82, .12 * s, glow(0xf2d36a), 0, .01 * s, 0);
    segs.push(seg);
   }
   for (const x of [-1, 1]) box(segs[0], .03 * s, .03 * s, .03 * s, glow(0x9ff6ff), x * .07 * s, .05 * s, .08 * s);
   return { group: g, segs, tick(t, moving){
    for (let i = 0; i < segs.length; i++){ segs[i].position.set(Math.sin(t * (moving ? 7 : 2.5) - i * .7) * .07 * s * (i / 3), 0, -i * .17 * s); }
   } };
  } },
 cat: { name: 'Rumour cat', fav: 'corn', blurb: 'Coat of old newsprint, two tails, repeats what it overhears. Wants echo corn.',
  make(s = 1){
   const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
   const coat = mat('coat', () => new THREE.MeshLambertMaterial({ map: NEWS_TEX }));
   box(body, .24 * s, .22 * s, .48 * s, coat, 0, .3 * s, 0);
   const head = new THREE.Group(); head.position.set(0, .44 * s, .28 * s); body.add(head);
   box(head, .22 * s, .2 * s, .18 * s, coat, 0, 0, 0);
   for (const x of [-1, 1]){ box(head, .06 * s, .09 * s, .04 * s, coat, x * .07 * s, .13 * s, -.02 * s); box(head, .04 * s, .03 * s, .02 * s, glow(0xffe08a), x * .055 * s, .02 * s, .095 * s); }
   const legs = [];
   for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) legs.push(box(body, .06 * s, .2 * s, .06 * s, lam(0x2a2622), x * .08 * s, .1 * s, z * .17 * s));
   const tails = [-1, 1].map(side => { const p = new THREE.Group(); p.position.set(side * .05 * s, .36 * s, -.24 * s); body.add(p); box(p, .04 * s, .04 * s, .3 * s, lam(0x2a2622), 0, .06 * s, -.13 * s); return { p, side }; });
   return { group: g, head, tick(t, moving){
    for (let i = 0; i < legs.length; i++) legs[i].position.y = .1 * s + (moving ? Math.max(0, Math.sin(t * 12 + i * Math.PI / 2)) * .05 * s : 0);
    for (const tl of tails) { tl.p.rotation.x = -0.7 + Math.sin(t * 2.3 + tl.side) * .3; tl.p.rotation.y = tl.side * (.3 + Math.sin(t * 1.7) * .2); }
   } };
  } },
};

function make(species, s){ const sp = SPECIES[species]; if (!sp) return null; const m = sp.make(s); m.species = species; m.group.userData.wildlife = species; return m; }
function dispose(group){ group.removeFromParent(); }

// ─── The ambient layer ─────────────────────────────────────────────────────
let root = null, scene = null;
const swarms = new Map();      // light uuid -> { light, moths: [] }
const flocks = [];             // { birds: [], scatter: 0, t }
let eel = null, eelWait = 12, flockWait = 2;
const V = new THREE.Vector3();

function ensureRoot(){
 if (!State.scene) return false;
 if (root && scene === State.scene && root.parent) return true;
 clearAll(); scene = State.scene; root = new THREE.Group(); root.name = 'city-wildlife'; scene.add(root); return true;
}
function clearAll(){
 for (const s of swarms.values()) for (const m of s.moths) dispose(m.group);
 swarms.clear();
 for (const f of flocks) for (const b of f.birds) dispose(b.group);
 flocks.length = 0;
 if (eel){ dispose(eel.group); eel = null; }
 if (root){ root.removeFromParent(); root = null; }
}
function feet(){ return Player.position.y - Player.height; }
function surfaceAt(x, z, from){ return typeof shSurfaceY === 'function' ? shSurfaceY(x, z, from) : 1; }
function clear(x, y, z){ return typeof shBodyBlocked !== 'function' || !shBodyBlocked(x, y, z, .25, .5); }

//  Moths: up to a handful of the nearest lit lamps get a swarm each.
function tickMoths(t, dt){
 const want = night() ? Math.round(5 * scale()) : 0, near = [];
 if (want){
  for (const c of State.chunkMap.values()) for (const l of c.lights || []){
   if (!l.isPointLight || !l.parent || l.visible === false) continue;
   l.getWorldPosition(V);
   const d = Math.hypot(V.x - Player.position.x, V.z - Player.position.z);
   if (d < 42 && V.y - feet() < 12) near.push({ l, d });
  }
  near.sort((a, b) => a.d - b.d);
 }
 const keep = new Set(near.slice(0, want).map(n => n.l.uuid));
 for (const [id, s] of swarms) if (!keep.has(id) || !s.light.parent){ for (const m of s.moths) dispose(m.group); swarms.delete(id); }
 for (const n of near.slice(0, want)){
  if (swarms.has(n.l.uuid)) continue;
  const moths = [];
  for (let i = 0; i < 3; i++){ const m = make('moth', rnd(.8, 1.2)); m.r = rnd(.5, 1.3); m.a = rnd(0, TAU); m.w = rnd(1.6, 3.2) * (Math.random() < .5 ? -1 : 1); m.h = rnd(-.5, .3); root.add(m.group); moths.push(m); }
  swarms.set(n.l.uuid, { light: n.l, moths });
 }
 for (const s of swarms.values()){
  s.light.getWorldPosition(V);
  for (const m of s.moths){
   m.a += m.w * dt;
   const jitter = Math.sin(t * 7 + m.r * 10) * .15;
   m.group.position.set(V.x + Math.cos(m.a) * (m.r + jitter), V.y + m.h + Math.sin(t * 4 + m.a) * .2, V.z + Math.sin(m.a) * (m.r + jitter));
   m.group.rotation.y = -m.a + (m.w > 0 ? 0 : Math.PI);
   m.tick(t, true);
  }
 }
}

//  Pigeons: a flock lands somewhere near you, pecks, and bursts off if you come close.
function spawnFlock(){
 for (let attempt = 0; attempt < 8; attempt++){
  const a = rnd(0, TAU), d = rnd(10, 22);
  const x = Player.position.x + Math.cos(a) * d, z = Player.position.z + Math.sin(a) * d;
  const y = surfaceAt(x, z, feet() + 4);
  if (Math.abs(y - feet()) > 2.5 || !clear(x, y, z)) continue;
  const birds = [], n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++){
   const bx = x + rnd(-1.4, 1.4), bz = z + rnd(-1.4, 1.4), by = surfaceAt(bx, bz, y + 1.5);
   if (Math.abs(by - y) > .6) continue;
   const b = make('pigeon', rnd(.9, 1.1)); b.group.position.set(bx, by, bz); b.group.rotation.y = rnd(0, TAU); b.v = null; b.hop = rnd(0, 3);
   root.add(b.group); birds.push(b);
  }
  if (birds.length){ flocks.push({ birds, scatter: 0 }); return true; }
 }
 return false;
}
function tickPigeons(t, dt){
 const want = Math.max(1, Math.round((night() ? 1 : 2) * scale()));
 flockWait -= dt;
 if (flocks.length < want && flockWait <= 0){ spawnFlock(); flockWait = rnd(10, 22); }
 for (let i = flocks.length - 1; i >= 0; i--){
  const f = flocks[i]; let far = true;
  for (const b of f.birds){
   const p = b.group.position, d = Math.hypot(p.x - Player.position.x, p.z - Player.position.z);
   if (d < 40) far = false;
   if (!f.scatter && d < 4.5) f.scatter = 0.001;
  }
  if (f.scatter){
   f.scatter += dt;
   for (const b of f.birds){
    const p = b.group.position;
    if (!b.v){ const away = Math.atan2(p.z - Player.position.z, p.x - Player.position.x) + rnd(-.6, .6); b.v = new THREE.Vector3(Math.cos(away) * rnd(5, 8), rnd(4, 6.5), Math.sin(away) * rnd(5, 8)); b.group.rotation.y = Math.atan2(b.v.x, b.v.z); }
    p.addScaledVector(b.v, dt); b.v.y += 1.5 * dt; b.tick(t, true);
   }
   if (f.scatter > 3.5) far = true;
  } else {
   for (const b of f.birds){
    b.hop -= dt;
    if (b.hop < 0){ b.hop = rnd(1.5, 4); b.group.rotation.y += rnd(-1.2, 1.2); const p = b.group.position, nx = p.x + Math.sin(b.group.rotation.y) * .3, nz = p.z + Math.cos(b.group.rotation.y) * .3, ny = surfaceAt(nx, nz, p.y + 1); if (Math.abs(ny - p.y) < .6) p.set(nx, ny, nz); }
    b.tick(t, false);
   }
  }
  if (far){ for (const b of f.birds) dispose(b.group); flocks.splice(i, 1); }
 }
}

//  Eels: after dark one occasionally arcs out of the road near you.
function tickEel(t, dt){
 if (eel){
  eel.t += dt / 1.5;
  const k = Math.min(1, eel.t), p = eel.from.clone().lerp(eel.to, k);
  p.y = eel.from.y - .3 + Math.sin(k * Math.PI) * 1.4;
  eel.group.position.copy(p);
  eel.group.rotation.x = -Math.cos(k * Math.PI) * 0.9;
  eel.tick(t, true);
  if (k >= 1){ if (typeof shBurst === 'function') shBurst(p.x, eel.to.y + .1, p.z, { count: 8, color: 0x3a3442, size: .07, speed: 3, life: .5, grav: 12 }); dispose(eel.group); eel = null; }
  return;
 }
 if (!night() || Player.mode === 'drive') return;
 eelWait -= dt;
 if (eelWait > 0) return;
 eelWait = rnd(22, 48) / Math.max(.4, scale());
 const a = rnd(0, TAU), d = rnd(6, 14);
 const x = Player.position.x + Math.cos(a) * d, z = Player.position.z + Math.sin(a) * d, y = surfaceAt(x, z, feet() + 3);
 if (Math.abs(y - feet()) > 2.5 || !clear(x, y, z)) return;
 const dir = rnd(0, TAU), tx = x + Math.cos(dir) * 3.6, tz = z + Math.sin(dir) * 3.6, ty = surfaceAt(tx, tz, y + 1.5);
 if (Math.abs(ty - y) > .3) return;
 const e = make('eel', 1.1); e.from = new THREE.Vector3(x, y, z); e.to = new THREE.Vector3(tx, ty, tz); e.t = 0;
 e.group.rotation.order = 'YXZ'; e.group.rotation.y = Math.atan2(tx - x, tz - z);
 root.add(e.group); eel = e;
 if (typeof shBurst === 'function') shBurst(x, y + .1, z, { count: 8, color: 0x3a3442, size: .07, speed: 3, life: .5, grav: 12 });
}

let last = performance.now();
function tick(now){
 requestAnimationFrame(tick);
 const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
 try {
  if (!State.scene || !State.chunkMap?.size || State.ui.inIntro || window.FN?.prologue){ if (root) root.visible = false; return; }
  if (!ensureRoot()) return;
  root.visible = true;
  if (State.ui.paused) return;
  const t = now / 1000;
  tickMoths(t, dt); tickPigeons(t, dt); tickEel(t, dt);
 } catch (e){ if (!tick._warned){ tick._warned = 1; console.warn('[wildlife]', e); } }
}
requestAnimationFrame(tick);

window.FCWildlife = {
 SPECIES, make, NEWS_TEX,
 get counts(){ let moths = 0; for (const s of swarms.values()) moths += s.moths.length; return { moths, pigeons: flocks.reduce((n, f) => n + f.birds.length, 0), eel: eel ? 1 : 0 }; },
 _spawnFlock: () => ensureRoot() && spawnFlock(),
 _eelNow(){ eelWait = 0; },
};
})();
