/* Casting Booth NPCs in the game: bodies, props, poses, bubbles, talk, errands.

   Online, the server owns every spawned NPC (server/spawns.cjs). This file
   draws them, and moves the ones the server has handed to this player (the
   nearest resident) with real collision, reporting where they got to.
   Solo, the same brains (npc-brain.js) run here and the NPCs are saved with
   the city.

   Also used by street-life.js for its one-off crowds: FCNpcs.body() and
   FCNpcs.pose() give any look the same body, props and acts. */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined' || !window.FCNpcBrain) return;
const B = window.FCNpcBrain, TAU = Math.PI * 2;
const online = () => !!(window.FCCityOnline && FCCityOnline.ready);
const live = () => online() && FCCityOnline.connected;
const token = () => { try { return JSON.parse(sessionStorage.getItem('fc-district-session') || '{}').token || ''; } catch (e){ return ''; } };
async function api(route, data){
 const res = await fetch('/api/' + route, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(8000) });
 const out = await res.json().catch(() => ({}));
 if (!res.ok) throw Object.assign(Error(out.error || 'The city did not answer.'), { status: res.status });
 return out;
}
const myAccount = () => online() ? FCCityOnline.self?.accountId : 'me';
const feet = () => Player.position.y - Player.height;
const say = (m, k = 'info') => typeof toast === 'function' && toast(m, k);
const hexInt = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? parseInt(v.slice(1), 16) : 0x777777;

// ─── Props ───────────────────────────────────────────────────────────────────
const M = {};
const mat = (c, glow) => M[c + (glow ? 'g' : '')] || (M[c + (glow ? 'g' : '')] = glow ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c }));
const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), ball: new THREE.SphereGeometry(1, 10, 8) };
function part(parent, geo, c, [x, y, z], [sx, sy, sz], glow){ const m = new THREE.Mesh(G[geo], mat(c, glow)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; }
function signTexture(text){
 const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const g = cv.getContext('2d');
 g.fillStyle = '#f2ead6'; g.fillRect(0, 0, 256, 160); g.strokeStyle = '#1d1a18'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 148);
 g.fillStyle = '#b3122e'; g.font = 'bold 30px Impact, sans-serif'; g.textAlign = 'center';
 const words = String(text || 'NO!').split(' '), lines = []; let cur = '';
 for (const w of words){ if ((cur + ' ' + w).trim().length > 12){ lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }
 lines.push(cur.trim());
 lines.slice(0, 3).forEach((l, i, a) => g.fillText(l, 128, 80 - (a.length - 1) * 17 + i * 34 + 10));
 const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
}
//  Props hang off the body (hands) or stand in the NPC's own group (carts, crates, boards).
function props(e, role, story){
 const c = e.char, hand = window.FCEquipment ? FCEquipment.handSocket(c, 1) : c.rightArm, left = window.FCEquipment ? FCEquipment.handSocket(c, 0) : c.leftArm;
 const accent = hexInt(c.look?.accent);
 if (role === 'busker'){
  const g = new THREE.Group(); g.position.set(.02, -.36, .16); g.rotation.set(0, 0, -.95); g.scale.setScalar(.78); c.studio.torso.add(g);
  part(g, 'ball', 0x8a4b22, [0, 0, 0], [.17, .2, .06]); part(g, 'ball', 0x8a4b22, [0, .17, 0], [.13, .13, .055]); part(g, 'cyl', 0x1b1b1b, [0, .02, .055], [.045, .01, .045]);
  part(g, 'box', 0x2a1d14, [0, .45, 0], [.045, .5, .03]); part(g, 'box', 0x111111, [0, .72, 0], [.07, .1, .035]);
  part(g, 'box', 0x3a2a1a, [0, .05, .07], [.012, .012, .01]);
  //  An open case on the ground for coins.
  const k = new THREE.Group(); k.position.set(.55, 0, .6); e.group.add(k); part(k, 'box', 0x241a14, [0, .04, 0], [.75, .06, .28]); part(k, 'box', 0x6b1d1d, [0, .075, 0], [.7, .01, .24]);
  for (let i = 0; i < 5; i++) part(k, 'cyl', 0xe2c044, [-.25 + i * .12, .085, (i % 2) * .06 - .03], [.025, .006, .025]);
 }
 if (role === 'vendor'){
  const k = new THREE.Group(); k.position.set(0, 0, .95); e.group.add(k);
  part(k, 'box', 0xd9d2c0, [0, .62, 0], [1.1, .5, .55]); part(k, 'box', accent || 0xb3122e, [0, .9, 0], [1.14, .06, .6]);
  for (const x of [-.45, .45]) part(k, 'cyl', 0x1b1b1b, [x, .14, .3], [.14, .05, .14]).rotation.x = Math.PI / 2;
  part(k, 'cyl', 0x777777, [-.5, 1.4, 0], [.015, 1, .015]);
  const top = part(k, 'ball', accent || 0xff6a00, [-.5, 1.92, 0], [.8, .18, .8]); top.material = mat(accent || 0xff6a00);
  for (let i = 0; i < 4; i++) part(k, 'ball', [0xe2c044, 0xb3122e, 0x7a4b2a, 0xe9e5dc][i], [-.33 + i * .22, .92, -.05], [.07, .05, .07]);
 }
 if (role === 'protester'){
  const s = new THREE.Group(); s.position.set(0, -.02, .02); hand.add(s);
  part(s, 'cyl', 0x7a5b3a, [0, .3, 0], [.014, .9, .014]);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(.62, .4), new THREE.MeshBasicMaterial({ map: signTexture(story?.sign), side: THREE.DoubleSide }));
  board.position.set(0, .85, 0); s.add(board); e.sign = s;
 }
 if (role === 'tagger'){ const can = new THREE.Group(); can.position.set(0, -.02, .03); hand.add(can); part(can, 'cyl', accent || 0x39ff14, [0, 0, 0], [.032, .1, .032]); part(can, 'cyl', 0xdddddd, [0, .065, 0], [.02, .03, .02]); e.nozzle = can; }
 if (role === 'skater'){ const b = new THREE.Group(); e.group.add(b); part(b, 'box', 0x1b1b1b, [0, .07, 0], [.22, .025, .82]); for (const z of [-.28, .28]) for (const x of [-.08, .08]) part(b, 'cyl', 0xe9e5dc, [x, .035, z], [.03, .02, .03]).rotation.z = Math.PI / 2; e.board = b; }
 if (role === 'preacher'){ const k = new THREE.Group(); k.position.set(0, 0, 0); e.group.add(k); part(k, 'box', 0x7a5b3a, [0, .15, 0], [.62, .3, .5]); part(k, 'box', 0x5b4a3a, [0, .305, 0], [.64, .02, .52]); e.crate = k; const book = new THREE.Group(); left.add(book); part(book, 'box', 0x1d1f26, [0, 0, .04], [.12, .16, .03]); }
 if (role === 'storyteller'){ const k = new THREE.Group(); k.position.set(0, 0, -.2); e.group.add(k); part(k, 'box', 0x5b4a3a, [0, .22, 0], [.5, .44, .4]); e.seat = k; }
 if (role === 'fixer'){ const p = new THREE.Group(); p.position.set(0, -.04, .04); left.add(p); part(p, 'box', 0x111111, [0, 0, 0], [.05, .1, .012]); part(p, 'box', 0x00e5ff, [0, 0, .007], [.042, .085, .002], true); }
 if (role === 'courier'){ const bag = new THREE.Group(); bag.position.set(.18, -.62, -.04); c.studio.torso.add(bag); part(bag, 'box', 0xe2c044, [0, 0, 0], [.08, .26, .3]); }
}

// ─── Bodies ──────────────────────────────────────────────────────────────────
function body(look, name, role, story, seed){
 const char = shBuildFigure({ ...(look || {}), handle: name || 'Resident', prop: 'none', auraChance: 0 }, 'npc-' + (seed || name));
 char.baseY = 0; char.plate.visible = false;
 const group = new THREE.Group(); group.add(char.group);
 const e = { char, group, role };
 try { props(e, role, story); } catch (err){ console.warn('[npcs] props', err); }
 return e;
}
function dispose(e){ e.group.removeFromParent(); if (e.bubble){ e.bubble.material.map.dispose(); e.bubble.material.dispose(); } if (window.FCResident) FCResident.dispose(e.char); }

//  What the body is doing, on top of walking and breathing.
function pose(e, act, t, dt, moving){
 const c = e.char, s = c.studio, L = c.leftArm, R = c.rightArm, el = s.elbows;
 c.group.rotation.x = 0; s.torso.rotation.x = 0; c.talking = !!e.talking;
 if (e.board) e.board.visible = act === 'skate';
 if (e.crate) e.crate.visible = act === 'preach';
 if (e.seat) e.seat.visible = act === 'tell' && !moving;
 if (moving && act !== 'skate' && act !== 'run' && act !== 'shamble' && act !== 'protest') return;
 const w = (a, b, k) => a + (b - a) * k;
 switch (act){
  case 'busk': L.rotation.x = -.95; L.rotation.z = .35; el[0].rotation.x = -.9; R.rotation.x = -.45 + Math.sin(t * 11) * .14; R.rotation.z = -.1; el[1].rotation.x = -1.25; c.head.rotation.x = .12 + Math.abs(Math.sin(t * 2.2)) * .1; break;
  case 'preach': c.group.position.y = .31; L.rotation.z = 2.3 + Math.sin(t * 2.1) * .35; R.rotation.z = -2.3 - Math.sin(t * 2.1 + 1) * .35; el[0].rotation.x = el[1].rotation.x = -.25; c.talking = true; break;
  case 'sell': { const wave = (t % 6) < 1.6; R.rotation.z = wave ? -2.5 + Math.sin(t * 9) * .3 : -.1; R.rotation.x = wave ? 0 : -.5; el[1].rotation.x = wave ? -.2 : -1; L.rotation.x = -.5; el[0].rotation.x = -1; c.talking = wave; break; }
  case 'dance': { const b = t * 7.5 + (e.phase || 0); c.group.position.y = Math.abs(Math.sin(b)) * .07; s.torso.rotation.y = Math.sin(b * .5) * .35; L.rotation.x = -1.5 + Math.sin(b) * .9; R.rotation.x = -1.5 - Math.sin(b) * .9; L.rotation.z = .4; R.rotation.z = -.4; el[0].rotation.x = el[1].rotation.x = -.6; s.knees.forEach((k, i) => k.rotation.x = .25 + Math.max(0, Math.sin(b + i * Math.PI)) * .4); s.torso.rotation.y += Math.sin(t * .7) * .4; break; }
  case 'spray': R.rotation.x = -1.45; R.rotation.z = -.15 + Math.sin(t * 3) * .12; el[1].rotation.x = -.15; L.rotation.x = -.3; if (e.nozzle && (e.sprayT = (e.sprayT || 0) - dt) <= 0){ e.sprayT = .12; const p = new THREE.Vector3(); e.nozzle.getWorldPosition(p); const f = c.group.getWorldDirection(new THREE.Vector3()); if (typeof shBurst === 'function') shBurst(p.x + f.x * .3, p.y + .08, p.z + f.z * .3, { count: 2, color: hexInt(c.look?.accent) || 0x39ff14, size: .05, speed: 1.2, life: .45, grav: 0 }); } break;
  case 'skate': c.group.position.y = .1; s.knees.forEach(k => k.rotation.x = .45); c.leftLeg.rotation.x = c.rightLeg.rotation.x = -.18; L.rotation.set(-.2, 0, .55); R.rotation.set(-.2, 0, -.55); s.torso.rotation.y = .5; c.head.rotation.y = -.45; break;
  case 'protest': R.rotation.x = -2.75; R.rotation.z = -.05 + Math.sin(t * 3) * .06; el[1].rotation.x = -.15; if (!moving){ L.rotation.x = -.4; el[0].rotation.x = -.8; } c.talking = (t % 5) < 2; break;
  case 'talk': case 'tell': c.talking = true; L.rotation.x = -.5 + Math.sin(t * 2.3) * .3; el[0].rotation.x = -1; R.rotation.x = -.35 + Math.sin(t * 1.7 + 1) * .25; el[1].rotation.x = -.9; if (act === 'tell'){ c.group.position.y = -.42; s.knees.forEach(k => k.rotation.x = 1.5); c.leftLeg.rotation.x = c.rightLeg.rotation.x = -1.5; } break;
  case 'lean': L.rotation.x = -.75; L.rotation.z = -.35; R.rotation.x = -.75; R.rotation.z = .35; el[0].rotation.x = el[1].rotation.x = -1.65; c.head.rotation.x = .08; break;
  case 'punch': { const k = (t * 1.6 + (e.phase || 0)) % 1, hit = k < .25 ? k / .25 : Math.max(0, 1 - (k - .25) / .4); R.rotation.x = w(-.6, -1.6, hit); el[1].rotation.x = w(-1.6, -.15, hit); L.rotation.x = -.9; el[0].rotation.x = -1.7; s.torso.rotation.y = -.3 * hit; break; }
  case 'run': break;
  case 'shamble': case 'cough': s.torso.rotation.x = .38; L.rotation.x = -.7; R.rotation.x = -.6; el[0].rotation.x = el[1].rotation.x = -.4; c.head.rotation.x = .25;
   if ((e.coughT = (e.coughT || 2) - dt) <= 0){ e.coughT = 2.5 + Math.random() * 3; const p = c.head.getWorldPosition(new THREE.Vector3()); if (typeof shBurst === 'function') shBurst(p.x, p.y, p.z, { count: 7, color: 0x9be15d, size: .09, speed: 1.1, life: 1.1, grav: -.4 }); }
   break;
  case 'down': c.group.rotation.x = -Math.PI / 2; c.group.position.y = .18; L.rotation.z = .9; R.rotation.z = -.9; break;
  case 'watch': c.head.rotation.x = -.05; if (e.clap && (t % 4) < 1.2){ L.rotation.x = R.rotation.x = -1.2; L.rotation.z = -.35 + Math.sin(t * 18) * .12; R.rotation.z = .35 - Math.sin(t * 18) * .12; el[0].rotation.x = el[1].rotation.x = -.9; } break;
  case 'drum': L.rotation.x = -.9 + Math.abs(Math.sin(t * 9)) * .3; R.rotation.x = -.9 + Math.abs(Math.sin(t * 9 + 1.6)) * .3; el[0].rotation.x = el[1].rotation.x = -1.1; break;
 }
}

// ─── Speech bubbles ─────────────────────────────────────────────────────────
function bubble(e, text){
 if (e.bubble){ e.bubble.removeFromParent(); e.bubble.material.map.dispose(); e.bubble.material.dispose(); e.bubble = null; }
 if (!text) return;
 const cv = document.createElement('canvas'), g = cv.getContext('2d'); cv.width = 512; g.font = '600 26px system-ui, sans-serif';
 const words = String(text).split(' '), lines = []; let cur = '';
 for (const w of words){ if (g.measureText(cur + ' ' + w).width > 440){ lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }
 lines.push(cur.trim()); const L = lines.slice(0, 5); cv.height = 40 + L.length * 34;
 g.font = '600 26px system-ui, sans-serif';
 g.fillStyle = '#fbf6e9'; g.strokeStyle = '#1d1a18'; g.lineWidth = 5;
 const h = cv.height - 18; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 504, h, 18) : g.rect(4, 4, 504, h); g.fill(); g.stroke();
 g.beginPath(); g.moveTo(236, h + 2); g.lineTo(256, cv.height - 2); g.lineTo(276, h + 2); g.fill();
 g.fillStyle = '#1d1a18'; g.textAlign = 'center'; L.forEach((l, i) => g.fillText(l, 256, 38 + i * 34));
 const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
 const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
 sp.scale.set(2.2, 2.2 * cv.height / 512, 1); sp.position.y = 2.55 + sp.scale.y / 2; sp.renderOrder = 9; e.group.add(sp); e.bubble = sp;
 e.talkUntil = performance.now() + Math.min(4000, 400 + text.length * 45);
}

// ─── State shared by both modes ─────────────────────────────────────────────
const E = new Map();              // id -> render entry
let detail = { rev: -1, npcs: {} }, fetching = false, solo = [], soloSeed = null, soloDirty = false;
function viewOf(s){
 //  Online snapshot rows to the brain's field names.
 const d = detail.npcs?.[s.i] || {};
 return { id: s.i, role: s.r, owner: s.o, ownerName: d.ownerName, story: d.story || { name: s.n }, look: d.look, x: s.x, y: s.y, z: s.z, yaw: s.w, gx: s.gx, gz: s.gz, speed: s.v, act: s.a, mode: s.m, hp: s.h, maxHp: s.hm, say: s.s, sayId: s.si, sim: s.sim, crew: s.c, tp: s.tp, task: d.task };
}
function current(){
 if (online()) return (FCCityOnline.room?.npcs || []).map(viewOf);
 return solo;
}
let fetchedAt = 0;
async function fetchDetail(){
 if (fetching || !live() || performance.now() - fetchedAt < 1000) return; fetching = true; fetchedAt = performance.now();
 try { const out = await api('city-npcs'); if (out && out.npcs && typeof out.npcs === 'object') detail = out; } catch (e){} finally { fetching = false; }
}

// ─── Moving NPCs with collision (online when assigned to us; always in solo) ─
const tmp = { position: new THREE.Vector3() };
function blockedByProps(x, y, z){
 const ch = State.chunkMap?.get?.(chunkCoordOf(x) + ',' + chunkCoordOf(z));
 for (const a of ch?.collisionAABBs || []) if (x > a.minX - .28 && x < a.maxX + .28 && z > a.minZ - .28 && z < a.maxZ + .28 && y < (a.maxY ?? 99) - .2) return true;
 return false;
}
function steer(e, v, dt){
 const p = e.ent.position, dx = v.gx - p.x, dz = v.gz - p.z, d = Math.hypot(dx, dz);
 e.moving = false;
 if (v.speed > 0 && d > .12){
  const s = Math.min(d, v.speed * dt), mx = dx / d * s, mz = dz / d * s, ox = p.x, oz = p.z, oy = p.y;
  let ok = typeof shGroundMove === 'function' ? shGroundMove(e.ent, mx, mz, .28, 1.7) : (p.x += mx, p.z += mz, true);
  if (ok && blockedByProps(p.x, p.y, p.z)){ p.set(ox, oy, oz); ok = false; }
  e.moving = ok; e.yaw = Math.atan2(dx, dz);
  e.stuckT = ok && Math.hypot(p.x - ox, p.z - oz) > s * .3 ? Math.max(0, (e.stuckT || 0) - dt) : (e.stuckT || 0) + dt;
  if (e.stuckT > 1.6){ e.stuck = true; e.stuckT = 0; }
 } else if (typeof shSurfaceY === 'function'){ const y = shSurfaceY(p.x, p.z, p.y + 1.2); if (y > 0 && Math.abs(y - p.y) < 1.5) p.y = y; }
}

// ─── Solo: the brains run here ──────────────────────────────────────────────
function soloWorld(){
 const t = performance.now();
 return { now: Date.now(), npcs: solo, rand: Math.random,
  players: Player && State.scene ? [{ id: 'me', accountId: 'me', name: window.FCAccounts?.user?.displayName || 'you', x: Player.position.x, y: feet(), z: Player.position.z, yaw: Player.yaw, hp: Player.hp > 0 ? Player.hp : 0, safe: B.inSafe(Player.position.x, Player.position.z), protected: false }] : [],
  say: (n, text, secs) => { n.say = String(text); n.sayUntil = Date.now() + secs * 1000; n.sayId = (n.sayId || 0) + 1; },
  hurt: (p, dmg) => { if (typeof damagePlayer === 'function') damagePlayer(dmg); },
  strike: (a, b, dmg) => { if (B.strike(a, b, dmg)) say((b.story?.name || 'They') + ' is down.', 'info'); },
  reward: (p, c, why) => { if (typeof grantCredits === 'function') grantCredits(c); say('You ' + why + ' · +' + c + ' credits', 'success'); },
  gift: (p, n) => { if (typeof grantCredits === 'function') grantCredits(12); say((n.story?.name || 'Your crew hand') + ' scrounged salvage worth 12 credits.', 'success'); },
  chat: text => say(text, 'info') };
}
function soloAdd(spec){
 const clean = B.cleanSpec(spec, sku => window.FCNpcUnlocks?.owns(sku));
 if (clean.error) throw Error(clean.error);
 if (clean.role === 'courier') throw Error('Couriers carry messages between residents in the online city.');
 const count = B.ROLES[clean.role].crew || 1;
 if (solo.length + count > B.LIMITS.solo) throw Error('This city has ' + solo.length + ' NPCs out (limit ' + B.LIMITS.solo + '). Dismiss some at the booth.');
 const crew = count > 1 ? Math.random().toString(16).slice(2, 10) : null, made = [];
 //  In a solo city, trouble is nobody's: it comes for you, which is the point of spawning it.
 const owner = B.ROLES[clean.role].group === 'trouble' ? 'npc' : 'me';
 for (let i = 0; i < count; i++){
  const id = Math.random().toString(16).slice(2, 14), story = i ? B.reroll(B.reroll(clean.story, 'name', clean.role, id), 'nick', clean.role, id + 'n') : clean.story;
  const at = { x: (spec.x ?? Player.position.x) + i * .9, y: spec.y ?? feet(), z: (spec.z ?? Player.position.z) + i * .6, yaw: Player.yaw };
  const n = B.init({ id, role: clean.role, owner, ownerName: 'you', story, look: window.FCWardrobe ? FCWardrobe.normalize(spec.look || {}) : spec.look, crew, leader: null, mine: true, seed: State.citySeed }, at);
  if (crew) n.leader = made[0]?.id || id;
  solo.push(n); made.push(n);
 }
 soloDirty = true; return made.map(n => n.id);
}
const keep = n => ({ seed: n.seed, id: n.id, role: n.role, owner: n.owner, story: n.story, look: n.look, home: n.home, x: n.x, y: n.y, z: n.z, yaw: n.yaw, crew: n.crew, leader: n.leader, mine: true });
async function soloLoad(){
 //  A new city starts empty, except for anyone spawned in it before its first frame.
 const seed = soloSeed = State.citySeed; solo = solo.filter(n => n.seed === seed);
 try {
  const d = await window.fracture?.read('fc-npcs-' + seed);
  if (seed !== soloSeed || !Array.isArray(d)) return;
  const loaded = d.filter(n => B.ROLES[n.role]).map(n => { const home = n.home; const o = B.init({ ...n }, { x: n.x, y: n.y, z: n.z, yaw: n.yaw }); if (home) o.home = home; return o; });
  //  Anyone spawned while the save was loading stays.
  solo = loaded.concat(solo.filter(n => !loaded.some(o => o.id === n.id)));
 } catch (e){}
}
setInterval(() => { if (!online() && soloDirty && soloSeed){ soloDirty = false; try { window.fracture?.save('fc-npcs-' + soloSeed, solo.map(keep)); } catch (e){} } }, 5000);

// ─── Errands from fixers ────────────────────────────────────────────────────
let quest = null; try { quest = JSON.parse(localStorage.getItem('fc-npc-quest') || 'null'); } catch (e){}
const saveQuest = () => { try { localStorage.setItem('fc-npc-quest', JSON.stringify(quest)); } catch (e){} drawQuest(); };
const chip = document.createElement('div'); chip.id = 'npc-quest'; chip.hidden = true; document.body.append(chip);
let beacon = null;
function drawQuest(){
 chip.hidden = !quest; if (quest) chip.innerHTML = `<b>ERRAND · ${esc(quest.fixerName)}</b><span>${esc(quest.done ? 'Done. Go back to ' + quest.fixerName.split(' ')[0] + ' to get paid.' : quest.text)}</span>`;
 if (beacon){ beacon.removeFromParent(); beacon = null; }
 if (quest && !quest.done && quest.x !== undefined && State.scene){
  beacon = new THREE.Group(); const y = typeof shSurfaceY === 'function' ? shSurfaceY(quest.x, quest.z, 30) : 1;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 14, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe500, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide }));
  col.position.y = 7; beacon.add(col); beacon.position.set(quest.x, y, quest.z); State.scene.add(beacon);
 }
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let questClock = performance.now();
function questTick(){
 //  Wall-clock time, so a slow frame rate does not stretch a watch errand.
 const now = performance.now(), dt = Math.min(3, (now - questClock) / 1000); questClock = now;
 if (!quest || quest.done || quest.x === undefined) return;
 const d = Math.hypot(Player.position.x - quest.x, Player.position.z - quest.z);
 if (quest.kind === 'visit' && d < 3){ quest.done = true; saveQuest(); say('Errand done. Go back to ' + quest.fixerName.split(' ')[0] + '.', 'success'); }
 if (quest.kind === 'watch'){ if (d < 4){ quest.held = (quest.held || 0) + dt; if (quest.held >= quest.secs){ quest.done = true; saveQuest(); say('Seen enough. Go back to ' + quest.fixerName.split(' ')[0] + '.', 'success'); } } else quest.held = 0; }
}

// ─── Talking ────────────────────────────────────────────────────────────────
const REACH = 2.3;
function nearest(){
 if (State.ui.paused || State.ui.inDialogue || State.ui.inArcade || window.NPCVoices?.open) return null;
 let best = null, bd = REACH;
 for (const [id, e] of E){ if (!e.group.visible || !e.v) continue; const p = e.group.position, d = Math.hypot(p.x - Player.position.x, p.z - Player.position.z); if (d < bd && Math.abs(p.y - feet()) < 1.6){ bd = d; best = e; } }
 return best;
}
function mine(v){ return v.mine || (online() && v.owner === myAccount()); }
async function order(id, cmd, extra){
 if (online()){ await api('npc-order', { id, cmd, ...extra }); return; }
 const n = solo.find(q => q.id === id); if (!n) return;
 if (cmd === 'stay') n.mode = 'stay';
 if (cmd === 'follow') n.mode = 'follow';
 if (cmd === 'here'){ if (B.ROLES[n.role].group === 'trouble' && B.inSafe(Player.position.x, Player.position.z)) throw Error('Trouble cannot be set up inside Common Ground.'); n.home = { x: Player.position.x, y: feet(), z: Player.position.z }; n.mode = 'walk'; n.gx = n.home.x; n.gz = n.home.z; n.speed = 2.5; n.t = 30; }
 if (cmd === 'story'){ const c = B.cleanSpec({ role: n.role, story: extra.story, seed: n.id }, () => true); n.story = c.story; }
 soloDirty = true;
}
async function dismiss(id){
 if (online()){ await api('npc-dismiss', { id }); return; }
 const n = solo.find(q => q.id === id); if (!n) return;
 solo = solo.filter(q => q !== n && !(n.crew && q.crew === n.crew)); soloDirty = true;
}
let snackAt = 0;
function voiceFor(e){
 const v = e.v, base = B.voice(v), R = B.ROLES[v.role], first = String(v.story?.name || 'They').split(' ')[0];
 const others = current().filter(o => o.id !== v.id);
 base.rumor = others.length ? others.slice(0, 6).map((o, i) => B.rumorAbout(o, i + Math.floor(Date.now() / 600000))) : ['Quiet round here. Too quiet. Spawn someone interesting.'];
 base.label = (v.story?.nick ? '“' + v.story.nick + '” · ' : '') + R.label.toUpperCase() + (v.ownerName && !mine(v) ? ' · CAST BY ' + String(v.ownerName).toUpperCase() : '');
 base.first = (BARKS_FIRST[v.role] || '') + ' ' + `I am ${v.story?.name || 'nobody'}. ${v.story?.catch || ''}`.trim();
 base.extra = t => {
  const out = [];
  if (quest && !quest.done && quest.kind === 'find' && quest.target === v.id) out.push({ label: 'Message from ' + quest.fixerName.split(' ')[0] + ': it is sorted.', act: 'q-deliver' });
  if (v.role === 'fixer'){ if (quest && quest.fixer === v.id && quest.done) out.push({ label: 'It is done. Pay up.', act: 'q-paid' }); else if (!quest) out.push({ label: 'Got any work?', act: 'q-ask' }); else if (quest.fixer === v.id) out.push({ label: 'Remind me what I am doing.', act: 'q-remind' }); }
  if (v.role === 'vendor') out.push({ label: 'Got a snack?', act: 'snack' });
  if (v.role === 'busker') out.push({ label: 'Play me something.', act: 'song' });
  if (mine(v)){
   if (R.group === 'help') out.push(v.mode === 'stay' ? { label: 'Follow me.', act: 'o-follow' } : { label: 'Wait here.', act: 'o-stay' });
   else out.push({ label: 'Set up here instead.', act: 'o-here' });
  }
  return out;
 };
 base.handle = (act, t) => {
  if (act === 'q-ask'){ const q = B.quest(v, current().filter(o => o.id !== v.id && B.ROLES[o.role].group !== 'trouble'), Date.now()); quest = { ...q, fixer: v.id, fixerName: v.story?.name || 'the fixer', done: false }; saveQuest(); return { text: q.text + ` Pays ${q.reward}.` }; }
  if (act === 'q-remind') return { text: quest.text };
  if (act === 'q-deliver'){ quest.done = true; saveQuest(); return { text: `Sorted? Good. Tell ${quest.fixerName.split(' ')[0]} I said so.` }; }
  if (act === 'q-paid'){ const r = quest.reward; quest = null; saveQuest(); if (typeof grantCredits === 'function') grantCredits(r); say('Errand paid · +' + r + ' credits', 'success'); return { text: `${r} credits. Count it in front of me, I like to watch.`, end: true }; }
  if (act === 'snack'){ if (performance.now() - snackAt < 60000) return { text: 'One per customer per minute. House rules. My house.' }; snackAt = performance.now(); Player.hp = Math.min(Player.maxHp || 100, (Player.hp || 0) + 25); if (typeof refreshHpHUD === 'function') refreshHpHUD(); return { text: pickOf(['Here. Do not ask what is in it. It is good for you, probably.', 'On the house. The house is a cart. Eat it walking.', 'Spicy. You will feel it in a minute. That is the feeling of health.']) }; }
  if (act === 'song') return { text: pickOf(['♪ My landlord is a ghost, and he haunts me for the rent ♪', '♪ The puddles on Fourth Street remember every step I made ♪', '♪ Ned said it would be sunny, Ned said a lot of things ♪', '♪ I sold my second guitar to pay to keep the first ♪']) };
  if (act === 'o-follow' || act === 'o-stay' || act === 'o-here'){ order(v.id, act.slice(2)).catch(err => say(err.message, 'warn')); return { text: { 'o-follow': 'Right behind you.', 'o-stay': 'I will be here. I am always somewhere.', 'o-here': 'Here? Fine. Good light.' }[act], end: true }; }
  return null;
 };
 return base;
}
const pickOf = a => a[Math.floor(Math.random() * a.length)];
const BARKS_FIRST = { vendor: 'Hungry? Everyone is.', busker: 'You stopped. Nobody stops.', fixer: 'You look like someone with time.', storyteller: 'Sit, sit. Or stand. Standing is fine.', gossip: 'Oh, you will want to hear this.', bodyguard: 'Keep moving.', pickpocket: 'Hi! Bye!', brawler: 'Problem?' };
function talk(e = nearest()){
 if (!e || !window.NPCVoices) return false;
 const key = 'npc:' + e.v.id; NPCVoices.V[key] = voiceFor(e);
 e.char.archetype = key; e.char.handle = e.v.story?.name || 'Resident';
 State.keys?.clear?.(); shTalkTo({ char: e.char, pos: e.group.position, kind: 'npc' });
 return true;
}
window.addEventListener('keydown', ev => { if (ev.code === 'KeyE' && !ev.repeat && nearest()){ ev.preventDefault(); ev.stopImmediatePropagation(); talk(); } }, true);
const interact = window.handleInteract; window.handleInteract = function(){ return talk() || interact.apply(this, arguments); };
const prompt = document.createElement('button'); prompt.id = 'npc-talk-prompt'; prompt.hidden = true; prompt.onclick = () => talk(); document.body.append(prompt);

// ─── Shooting trouble ───────────────────────────────────────────────────────
const box = new THREE.Box3(), hitP = new THREE.Vector3();
function shot(){
 if (Player.mode === 'drive') return;
 const key = Player.currentWeapon, w = (typeof shWeapon === 'function' ? shWeapon(key) : WEAPONS?.[key]) || { range: 30 };
 const dir = new THREE.Vector3(0, 0, -1).applyEuler(State.camera.rotation).normalize(), ray = new THREE.Ray(Player.position.clone(), dir);
 let best = null, bd = Infinity;
 for (const e of E.values()){
  const v = e.v; if (!v || !e.group.visible || B.ROLES[v.role]?.group !== 'trouble' || v.mode === 'down' || B.inSafe(e.group.position.x, e.group.position.z)) continue;
  const p = e.group.position; box.min.set(p.x - .45, p.y - .05, p.z - .45); box.max.set(p.x + .45, p.y + 1.95, p.z + .45);
  const h = ray.intersectBox(box, hitP); if (!h) continue; const d = h.distanceTo(ray.origin); if (d > (w.range || 30) || d >= bd) continue;
  if (typeof raycastVoxel === 'function'){ const vx = raycastVoxel(ray.origin, dir, d); if (vx && Math.hypot(vx.x + .5 - ray.origin.x, vx.y + .5 - ray.origin.y, vx.z + .5 - ray.origin.z) < d) continue; }
  bd = d; best = e;
 }
 if (!best) return;
 if (online()){ if (B.inSafe(Player.position.x, Player.position.z)) return; api('city-shoot', { weapon: ['baton', 'pistol', 'shotgun'].includes(key) ? key : 'other', ox: ray.origin.x, oy: ray.origin.y, oz: ray.origin.z, dx: dir.x, dy: dir.y, dz: dir.z, npc: best.v.id, pellets: 1 }).catch(() => {}); return; }
 const n = solo.find(q => q.id === best.v.id); if (n){ const down = B.strike(null, n, w.damage || 25); if (down){ say((n.story?.name || 'They') + ' is down.', 'success'); if (typeof grantCredits === 'function') grantCredits(5); } else if (n.mode !== 'fight' && n.role !== 'pickpocket'){ n.mode = 'fight'; n.target = 'me'; n.punches = 0; } }
}
const attack = window.tryAttack; window.tryAttack = function(){ const before = Player.attackCooldown; const r = attack.apply(this, arguments); if (before <= 0 && Player.attackCooldown > 0) try { shot(); } catch (e){} return r; };

// ─── Helpers that act on the local world ────────────────────────────────────
//  Bodyguards hit the zombies and thugs near you; carriers bring zombies along
//  when you have zombie mode on. Only on the game of whoever it concerns.
function localDuties(e, v, dt){
 if (v.role === 'bodyguard' && mine(v) && State.enemies?.length){
  e.guardT = (e.guardT || 0) - dt;
  const p = e.group.position; let foe = null, fd = 9;
  for (const en of State.enemies){ if (!en || en.state === 'dead' || en.hp <= 0 || !en.position) continue; const d = Math.hypot(en.position.x - p.x, en.position.z - p.z); if (d < fd && Math.hypot(en.position.x - Player.position.x, en.position.z - Player.position.z) < 12){ fd = d; foe = en; } }
  if (foe){ e.localAct = 'punch'; e.localGoal = foe.position; if (fd < 1.6 && e.guardT <= 0){ e.guardT = .85; try { foe.takeDamage(22, false); } catch (err){} } }
  else { e.localAct = null; e.localGoal = null; }
 }
 if (v.role === 'carrier' && typeof Siege !== 'undefined' && Siege.active && typeof Enemy === 'function'){
  e.carryT = (e.carryT ?? 20) - dt;
  const p = e.group.position;
  if (e.carryT <= 0 && Math.hypot(p.x - Player.position.x, p.z - Player.position.z) < 18 && !B.inSafe(p.x, p.z)){
   e.carryT = 30 + Math.random() * 20;
   const z = new Enemy('zombie', p.x + 1.2, p.z + 1.2, new RNG('carrier:' + v.id + ':' + Date.now()));
   z.position.y = typeof shSurfaceY === 'function' ? shSurfaceY(p.x + 1.2, p.z + 1.2, p.y + 2) : p.y; z.group.position.copy(z.position); z.state = 'alert';
   State.scene.add(z.group); State.enemies.push(z);
   bubble(e, 'Oh no. Not again.');
  }
 }
}

// ─── Frame ──────────────────────────────────────────────────────────────────
let last = performance.now(), thinkAcc = 0, poseAcc = 0, posting = false;
function frame(now){
 requestAnimationFrame(frame);
 const dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
 try {
  if (!State.scene || State.ui.inIntro || window.FN?.prologue){ for (const e of E.values()) e.group.visible = false; return; }
  //  Solo: load the city's NPCs, run their brains.
  if (!online()){
   if (State.citySeed && State.citySeed !== soloSeed) soloLoad();
   if (!State.ui.paused){
    thinkAcc += dt; if (thinkAcc >= .25){ const w = soloWorld(); for (const n of solo){ const e = E.get(n.id); if (e?.stuck){ n.stuck = true; e.stuck = false; } B.think(n, w, thinkAcc); } thinkAcc = 0; }
   }
  } else {
   const room = FCCityOnline.room; if (room && room.npcRev !== undefined && room.npcRev !== detail.rev) fetchDetail();
  }
  const list = current(), seen = new Set(), meId = online() ? FCCityOnline.self?.id : null, outPoses = [];
  for (const v of list){
   seen.add(v.id);
   let e = E.get(v.id);
   const sig = JSON.stringify([v.look || null, v.story?.name, v.role, v.story?.sign]);
   if (e && e.sig !== sig){ dispose(e); E.delete(v.id); e = null; }
   if (!e){
    e = body(v.look || (window.FCWardrobe ? FCWardrobe.crowdLook(null, new RNG('npc:' + v.id)) : {}), v.story?.name, v.role, v.story, v.id);
    e.sig = sig; e.phase = (B.hash(v.id) % 100) / 16; e.spin = (B.hash(v.id + 's') % 628) / 100;
    e.ent = { position: new THREE.Vector3(v.x, v.y ?? 1, v.z) }; e.group.position.copy(e.ent.position); e.yaw = v.yaw || 0;
    State.scene.add(e.group); E.set(v.id, e);
   }
   if (e.group.parent !== State.scene) State.scene.add(e.group);
   e.v = v;
   const p = e.ent.position, sim = !online() || (meId && v.sim === meId);
   const dPlayer = Math.hypot(p.x - Player.position.x, p.z - Player.position.z);
   if (sim){
    //  We move this one: snap when the brain teleports it, otherwise steer with collision.
    //  Snap to the server when it teleports the NPC, when we have just been given it, or when the
    //  server has moved it on without us (our reports went stale) and we have drifted apart.
    if (online() && (v.tp || p.distanceToSquared(new THREE.Vector3(v.x, p.y, v.z)) > 4 * 4 || !e.wasSim)) p.set(v.x, v.y ?? p.y, v.z);
    if (!online() && v.teleported){ p.set(v.x, v.y ?? p.y, v.z); v.teleported = false; }
    const goal = e.localGoal ? { gx: e.localGoal.x, gz: e.localGoal.z, speed: 3.8 } : v;
    if (!State.ui.paused) steer(e, goal, dt);
    if (!online()){ v.x = p.x; v.y = p.y; v.z = p.z; if (e.moving) v.yaw = e.yaw; v.moving = e.moving; }
    else outPoses.push({ id: v.id, x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), yaw: +(e.moving ? e.yaw : v.yaw).toFixed(3), moving: e.moving, stuck: !!e.stuck });
    if (online()) e.stuck = false;
   } else {
    //  Someone else moves it: glide toward the server's position.
    const to = new THREE.Vector3(v.x, v.y ?? p.y, v.z), far = p.distanceTo(to);
    if (far > 12 || v.tp) p.copy(to); else p.lerp(to, 1 - Math.exp(-dt * 8));
    if (typeof shSurfaceY === 'function'){ const y = shSurfaceY(p.x, p.z, p.y + 1.2); if (y > 0 && Math.abs(y - p.y) < 1.5) p.y = y; }
    e.moving = far > .05 && v.speed > 0; e.yaw = v.yaw;
   }
   e.wasSim = sim;
   e.group.position.copy(p);
   const visible = dPlayer < 90; e.group.visible = visible;
   if (!visible) continue;
   e.char.group.rotation.y += (((e.yaw - e.char.group.rotation.y) % TAU + TAU * 1.5) % TAU - Math.PI) * Math.min(1, dt * 10);
   //  Speech: a bubble per new line.
   const text = online() ? v.say : (v.sayUntil > Date.now() ? v.say : '');
   if ((v.sayId || 0) !== e.sayId || (!text && e.bubble)){ e.sayId = v.sayId || 0; bubble(e, text); }
   e.talking = e.talkUntil > now;
   localDuties(e, v, dt);
   const act = e.localAct || v.act || 'idle', moving = e.moving && act !== 'down';
   e.char.studio.motionSpeed = moving ? (v.speed || 1.3) : 0;
   shAnimateCharacter(e.char, dt, moving, now / 1000);
   pose(e, act, now / 1000, dt, moving);
   if (e.bubble) e.bubble.visible = dPlayer < 26;
  }
  for (const [id, e] of E) if (!seen.has(id)){ dispose(e); E.delete(id); }
  //  Report the ones we move.
  poseAcc += dt;
  //  With nothing to move, still check in every two seconds: the server only hands NPCs to games that are running.
  if (online() && live() && list.length && (outPoses.length ? poseAcc >= .2 : poseAcc >= 2) && !posting){ poseAcc = 0; posting = true; api('npc-poses', { poses: outPoses }).catch(() => {}).finally(() => { posting = false; }); }
  questTick();
  const n = nearest(); prompt.hidden = !n;
  if (n){ const label = 'E · Talk to ' + (n.v.story?.name || 'them').split(' ')[0]; if (prompt.textContent !== label) prompt.textContent = label; }
 } catch (err){ if (!frame._w){ frame._w = 1; console.warn('[npcs]', err); } }
}
requestAnimationFrame(frame);
drawQuest();

const css = document.createElement('style');
css.textContent = `#npc-talk-prompt{position:fixed;bottom:112px;left:50%;transform:translateX(-50%);z-index:100;background:#1a1220;color:#ffd7f0;border:1px solid #ff2e88;border-radius:10px;padding:14px 20px;font:600 14px system-ui;min-height:48px;cursor:pointer}#npc-talk-prompt[hidden]{display:none}
#npc-quest{position:fixed;left:12px;top:132px;z-index:60;max-width:300px;padding:8px 11px;background:#140f18e6;border:1px solid #ffe500;border-left:4px solid #ffe500;border-radius:7px;color:#f4ecd8;font:12px/1.45 system-ui;pointer-events:none}#npc-quest b{display:block;color:#ffe500;font-size:11px;letter-spacing:.08em}#npc-quest[hidden]{display:none}
@media (pointer:coarse){#npc-quest{top:auto;bottom:150px;left:8px;max-width:58vw}}`;
document.head.append(css);

window.FCNpcs = {
 body, pose, bubble, dispose,
 get list(){ return current(); },
 get entries(){ return E; },
 mine: () => current().filter(mine),
 async spawn(spec){ if (online()){ const out = await api('npc-spawn', spec); if (out.wallet) window.FCInv?.ingestWallet?.(out.wallet); return out.ids; } return soloAdd(spec); },
 dismiss, order, talk,
 get quest(){ return quest; },
 clearQuest(){ quest = null; saveQuest(); },
};
})();
