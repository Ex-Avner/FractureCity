/* =============================================================================
 *  FRACTURE CITY // THE FIRST NIGHT                                    v0.36.0
 * -----------------------------------------------------------------------------
 *  Loaded after the main game script and the front menu. Everything here hooks
 *  the existing systems by wrapping them, the same way every numbered section
 *  of index.html does, so the campaign, the saves and the sandbox keep working.
 *
 *    1. Roles        five lore classes, each with a Q ability
 *    2. Weapons      three slots, thirteen real weapons, found in the city (R)
 *    3. Bodies       every person can be hit, knocked down, and killed
 *    4. Heat         witnesses report; Bureau Attention brings Wardens
 *    5. The street   barks, panic, head-turns, patrols
 *    6. The Minute   the playable prologue that replaces the opening film
 *
 *  Story bible: FIRST-NIGHT.md, beside this file.
 * ========================================================================== */
(function(){
'use strict';
if (typeof State === 'undefined' || typeof Player === 'undefined') return;

const FN = window.FN = {
  version: '0.36.1',
  state: null,          // persisted, see fnFreshState
  heat: 0,              // 0..5, float
  coolT: 0,             // seconds since the Bureau last had reason to look
  pending: [],          // crimes waiting to be witnessed
  pickups: [],          // weapons lying in the world
  seeded: new Map(),    // chunk key -> chunk object that has been seeded
  markers: [],          // Witness ability sprites
  barks: [],            // floating speech
  abilityCd: 0,
  frozenUntil: 0,
  prologue: null,
  t: 0,
};

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const safe = (f) => { try { return f(); } catch (e){ console.warn('[first-night]', e); } };
const pick = a => a[Math.floor(Math.random() * a.length)];

// =============================================================================
//  1 · ROLES
// =============================================================================
const FN_CLASSES = {
  witness: {
    name: 'FIELD WITNESS', color: 0xf4bb3d, css: '#f4bb3d',
    who: 'Your world. The role the case was written for.',
    tagline: 'Hears everyone. Forgets nothing.',
    desc: 'Balanced and hard to rattle. Your heat cools twice as fast, because you are good at being believed.',
    hp: 100, walkSpeed: 6.6, sprintSpeed: 11.2, jumpPower: 8.6, damageMult: 1.0, hackBonus: 1.2,
    kit: { 1: 'cutter', 2: 'revolver', 3: null }, ammo: { pistol: 18, shotgun: 0 },
    ability: { key: 'witness', name: 'WITNESS', cd: 30,
      desc: 'For eight seconds, every person and threat within 45 m shows through walls.' },
  },
  quarry: {
    name: 'QUARRY HAND', color: 0xff8a3c, css: '#ff8a3c',
    who: 'Marcus Vale’s world. Quarry 4, eighteen years.',
    tagline: 'Carries more than anyone thinks.',
    desc: 'Slow and enormously tough. Every hit lands heavier. The Bureau finds you easy to see.',
    hp: 175, walkSpeed: 5.6, sprintSpeed: 9.4, jumpPower: 7.8, damageMult: 1.3, hackBonus: 0.8,
    kit: { 1: 'pick', 2: 'nailgun', 3: null }, ammo: { pistol: 60, shotgun: 0 },
    ability: { key: 'break', name: 'BREAK', cd: 20,
      desc: 'Slam the ground. Heavy damage and knockback to everything within 4.5 m.' },
  },
  tow: {
    name: 'TOW DRIVER', color: 0xffd47a, css: '#ffd47a',
    who: 'Leon’s world. Tow 12, municipal recovery.',
    tagline: 'Brings things back whether they like it or not.',
    desc: 'Sturdy, quick on foot, and the best armed at the start.',
    hp: 115, walkSpeed: 6.9, sprintSpeed: 11.6, jumpPower: 8.6, damageMult: 1.05, hackBonus: 1.0,
    kit: { 1: 'crowbar', 2: 'flare', 3: 'dbarrel' }, ammo: { pistol: 5, shotgun: 12 },
    ability: { key: 'hook', name: 'HOOK', cd: 16,
      desc: 'Drag the nearest threat within 18 m to your feet, staggered.' },
  },
  clerk: {
    name: 'BUREAU CLERK', color: 0x9aa2bb, css: '#b8c0d8',
    who: 'Daniel’s world. Window Three.',
    tagline: 'Knows which form stops a fight.',
    desc: 'Fragile and fast. Terminals pay you more. Wardens give you one extra warning before they draw.',
    hp: 80, walkSpeed: 7.2, sprintSpeed: 12.4, jumpPower: 9.0, damageMult: 0.95, hackBonus: 1.6,
    kit: { 1: 'baton', 2: 'compliance', 3: null }, ammo: { pistol: 45, shotgun: 0 },
    ability: { key: 'stamp', name: 'STAMP', cd: 35,
      desc: 'A stop order. Every threat within 25 m freezes for five seconds.' },
  },
  broadcaster: {
    name: 'NIGHT BROADCASTER', color: 0xff5268, css: '#ff5268',
    who: 'FCN’s world. Ned’s people.',
    tagline: 'Says it first, and loudest.',
    desc: 'The fastest on foot, with a long gun from the tower locker. People on the street recognise you.',
    hp: 85, walkSpeed: 7.8, sprintSpeed: 13.2, jumpPower: 9.5, damageMult: 1.0, hackBonus: 1.2,
    kit: { 1: 'cutter', 2: 'revolver', 3: 'rifle' }, ammo: { pistol: 12, shotgun: 6 },
    ability: { key: 'correction', name: 'CORRECTION', cd: 40,
      desc: 'A broadcast burst. Calms civilians within 30 m, drops one level of heat, staggers threats within 15 m.' },
  },
};
const FN_CLASS_ORDER = ['witness', 'quarry', 'tow', 'clerk', 'broadcaster'];

for (const k of FN_CLASS_ORDER){
  const c = FN_CLASSES[k];
  CLASSES[k] = {
    name: c.name, tagline: c.tagline, desc: c.desc, color: c.color,
    hp: c.hp, walkSpeed: c.walkSpeed, sprintSpeed: c.sprintSpeed, jumpPower: c.jumpPower,
    damageMult: c.damageMult, hackBonus: c.hackBonus,
    startLoadout: { baton: -1, pistol: c.ammo.pistol, shotgun: c.ammo.shotgun },
  };
}

// =============================================================================
//  2 · WEAPONS
// -----------------------------------------------------------------------------
//  The engine knows three weapon keys: baton (slot 1), pistol (2), shotgun (3).
//  Recoil, sound, mods, HUD and ammo are all keyed on those. So a slot keeps
//  its key and the weapon in it is written onto that key's WEAPONS entry.
// =============================================================================
const SLOT_KEY = { 1: 'baton', 2: 'pistol', 3: 'shotgun' };
const FN_WEAPONS = {
  fists:      { slot:1, name:'BARE HANDS',        short:'HANDS',      type:'melee',  dmg:12, range:1.9, cooldown:0.42, color:0xe7e2ff, rarity:0 },
  baton:      { slot:1, name:'BUREAU BATON',      short:'BATON',      type:'melee',  dmg:26, range:2.4, cooldown:0.34, color:0x9aa2bb, rarity:2 },
  cutter:     { slot:1, name:'BOX CUTTER',        short:'CUTTER',     type:'melee',  dmg:19, range:1.9, cooldown:0.20, color:0xd8d2b8, rarity:3 },
  crowbar:    { slot:1, name:'CROWBAR',           short:'CROWBAR',    type:'melee',  dmg:34, range:2.5, cooldown:0.46, color:0xb03050, rarity:4 },
  wrench:     { slot:1, name:'PIPE WRENCH',       short:'WRENCH',     type:'melee',  dmg:44, range:2.3, cooldown:0.70, color:0x6a3a2a, rarity:3 },
  pick:       { slot:1, name:'QUARRY PICK',       short:'PICK',       type:'melee',  dmg:58, range:2.7, cooldown:0.95, color:0xff8a3c, rarity:2 },
  axe:        { slot:1, name:'FIRE AXE',          short:'AXE',        type:'melee',  dmg:72, range:2.8, cooldown:1.10, color:0xd93c53, rarity:1 },
  revolver:   { slot:2, name:'SERVICE REVOLVER',  short:'REVOLVER',   type:'ranged', dmg:46, range:42, cooldown:0.62, spread:0.014, pellets:1, ammoMax:36, color:0xffd47a, rarity:3, ammo:6 },
  compliance: { slot:2, name:'COMPLIANCE PISTOL', short:'COMPLIANCE', type:'ranged', dmg:28, range:36, cooldown:0.30, spread:0.020, pellets:1, ammoMax:60, color:0x9aa2bb, rarity:3, ammo:15 },
  nailgun:    { slot:2, name:'NAIL GUN',          short:'NAILS',      type:'ranged', dmg:15, range:20, cooldown:0.12, spread:0.040, pellets:1, ammoMax:120, color:0x51c68f, rarity:3, ammo:40 },
  flare:      { slot:2, name:'FLARE PISTOL',      short:'FLARE',      type:'ranged', dmg:70, range:30, cooldown:1.40, spread:0.010, pellets:1, ammoMax:10, color:0xff5268, rarity:2, ammo:3 },
  dbarrel:    { slot:3, name:'DOUBLE BARREL',     short:'DBL BARREL', type:'ranged', dmg:17, range:14, cooldown:0.90, spread:0.140, pellets:7, ammoMax:30, color:0xc98f6b, rarity:2, ammo:6 },
  riot:       { slot:3, name:'RIOT SHOTGUN',      short:'RIOT',       type:'ranged', dmg:14, range:15, cooldown:0.70, spread:0.160, pellets:6, ammoMax:40, color:0x9aa2bb, rarity:2, ammo:8 },
  rifle:      { slot:3, name:'HUNTING RIFLE',     short:'RIFLE',      type:'ranged', dmg:95, range:75, cooldown:1.30, spread:0.003, pellets:1, ammoMax:24, color:0x2cb8c7, rarity:1, ammo:5 },
};
//  Where the rare ones turn up.
FN.weapons = FN_WEAPONS;
FN.classes = FN_CLASSES;
const DISTRICT_BIAS = { FORGE: ['wrench', 'pick', 'axe', 'nailgun'], FLOOD: ['crowbar', 'flare', 'rifle', 'dbarrel'] };

function fnFreshState(){
  return {
    cls: null, loadout: { 1: 'fists', 2: null, 3: null },
    heat: 0, standing: 0, warned: false,
    choices: {}, taken: [], prologueDone: false, crimes: 0, taughtHeat: false,
  };
}
FN.state = fnFreshState();

function fnWeaponOf(slot){ const id = FN.state.loadout[slot]; return id ? FN_WEAPONS[id] : null; }

//  Write the slot's weapon onto the engine's entry for that key.
function fnApplyLoadout(){
  for (const slot of [1, 2, 3]){
    const key = SLOT_KEY[slot];
    const w = fnWeaponOf(slot) || (slot === 1 ? FN_WEAPONS.fists : null);
    const base = WEAPONS[key];
    if (!base) continue;
    if (!w){ base.name = 'EMPTY'; base._fnEmpty = true; continue; }
    base._fnEmpty = false;
    base.name = w.name; base.type = w.type; base.dmg = w.dmg; base.range = w.range;
    base.cooldown = w.cooldown; base.color = w.color;
    if (w.type === 'ranged'){
      base.spread = w.spread; base.pellets = w.pellets; base.ammoMax = w.ammoMax;
    }
  }
  if (WEAPONS[Player.currentWeapon] && WEAPONS[Player.currentWeapon]._fnEmpty) Player.currentWeapon = 'baton';
  safe(() => refreshAmmoHUD());
}
FN.applyLoadout = fnApplyLoadout;

function fnSetKit(clsKey){
  const c = FN_CLASSES[clsKey];
  if (!c) return;
  FN.state.cls = clsKey;
  FN.state.loadout = { 1: c.kit[1], 2: c.kit[2], 3: c.kit[3] };
  Player.ammo.pistol = c.kit[2] ? c.ammo.pistol : 0;
  Player.ammo.shotgun = c.kit[3] ? c.ammo.shotgun : 0;
  Player.ammo.baton = -1;
  Player.currentWeapon = c.kit[2] ? 'pistol' : 'baton';
  fnApplyLoadout();
}

//  applyClass runs on every newGame, including restores. Lore classes get their
//  kit; the old three keep the engine's own loadout.
const _applyClass = applyClass;
window.applyClass = function(k){
  const r = _applyClass.apply(this, arguments);
  if (FN_CLASSES[k]) fnSetKit(k);
  else { FN.state.cls = null; FN.state.loadout = { 1: 'baton', 2: 'revolver', 3: 'riot' }; fnRestoreLegacyWeapons(); }
  return r;
};
const LEGACY = JSON.parse(JSON.stringify({ baton: WEAPONS.baton, pistol: WEAPONS.pistol, shotgun: WEAPONS.shotgun }));
function fnRestoreLegacyWeapons(){
  for (const k of ['baton', 'pistol', 'shotgun']){ Object.assign(WEAPONS[k], LEGACY[k]); WEAPONS[k]._fnEmpty = false; }
  safe(() => refreshAmmoHUD());
}

//  An empty slot cannot be drawn.
const _switchWeapon = switchWeapon;
window.switchWeapon = function(key){
  if (WEAPONS[key] && WEAPONS[key]._fnEmpty){ toast('Nothing in that slot. Weapons are lying around the city: R to take one.', 'info'); return; }
  return _switchWeapon.apply(this, arguments);
};

//  The HUD names what is actually in each slot.
const _refreshAmmo = refreshAmmoHUD;
window.refreshAmmoHUD = function(){
  const r = _refreshAmmo.apply(this, arguments);
  safe(() => {
    for (const slot of document.querySelectorAll('.weapon-slot')){
      const key = slot.dataset.weapon;
      const s = key === 'baton' ? 1 : key === 'pistol' ? 2 : 3;
      const w = FN.state.cls || FN.prologue ? (fnWeaponOf(s) || (s === 1 ? FN_WEAPONS.fists : null)) : null;
      const nm = slot.querySelector('.ws-name');
      if (nm && (FN.state.cls || FN.prologue)) nm.textContent = w ? w.short : 'EMPTY';
      slot.classList.toggle('fn-empty', !!(WEAPONS[key] && WEAPONS[key]._fnEmpty));
      if (WEAPONS[key] && WEAPONS[key]._fnEmpty){ const a = slot.querySelector('.ws-ammo'); if (a) a.textContent = ''; }
    }
  });
  return r;
};

// ─── Weapons in the world ───────────────────────────────────────────────────
const PICKUP_MATS = new Map();
function fnMat(hex, basic){
  const k = hex + (basic ? 'b' : 'l');
  if (!PICKUP_MATS.has(k)) PICKUP_MATS.set(k, basic
    ? new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.35, depthWrite: false })
    : new THREE.MeshLambertMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.35 }));
  return PICKUP_MATS.get(k);
}
function fnBox(g, w, h, d, hex, x, y, z, rz){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fnMat(hex));
  m.position.set(x, y, z); if (rz) m.rotation.z = rz; g.add(m); return m;
}
//  Small, readable silhouettes. A weapon should be recognisable at five metres.
function fnWeaponMesh(id){
  const w = FN_WEAPONS[id], g = new THREE.Group(), dark = 0x1b1d22, wood = 0x6b4326;
  const inner = new THREE.Group(); g.add(inner);
  switch (id){
    case 'baton':    fnBox(inner, .07, .75, .07, dark, 0, .38, 0); fnBox(inner, .12, .12, .12, w.color, 0, .02, 0); break;
    case 'cutter':   fnBox(inner, .08, .22, .04, w.color, 0, .11, 0); fnBox(inner, .05, .10, .02, 0xe5e5e5, 0, .27, 0); break;
    case 'crowbar':  fnBox(inner, .05, .9, .05, w.color, 0, .45, 0); fnBox(inner, .05, .05, .22, w.color, 0, .9, .09); break;
    case 'wrench':   fnBox(inner, .07, .7, .06, w.color, 0, .35, 0); fnBox(inner, .22, .14, .08, 0x40484a, 0, .74, 0); break;
    case 'pick':     fnBox(inner, .07, 1.0, .07, wood, 0, .5, 0); fnBox(inner, .7, .09, .09, w.color, 0, .98, 0); break;
    case 'axe':      fnBox(inner, .07, .95, .07, wood, 0, .47, 0); fnBox(inner, .28, .22, .05, w.color, .12, .86, 0); break;
    case 'revolver': fnBox(inner, .07, .20, .06, wood, 0, .1, 0); fnBox(inner, .07, .08, .34, w.color, 0, .22, .12); fnBox(inner, .1, .1, .1, dark, 0, .22, .02); break;
    case 'compliance': fnBox(inner, .06, .18, .06, dark, 0, .09, 0); fnBox(inner, .07, .08, .28, w.color, 0, .2, .1); break;
    case 'nailgun':  fnBox(inner, .08, .2, .08, dark, 0, .1, 0); fnBox(inner, .12, .14, .36, w.color, 0, .24, .12); break;
    case 'flare':    fnBox(inner, .07, .18, .07, dark, 0, .09, 0); fnBox(inner, .12, .12, .3, w.color, 0, .22, .1); break;
    case 'dbarrel':  fnBox(inner, .09, .12, .5, wood, 0, .1, -.2); fnBox(inner, .1, .08, .7, w.color, 0, .16, .35); break;
    case 'riot':     fnBox(inner, .09, .12, .45, dark, 0, .1, -.2); fnBox(inner, .09, .09, .75, w.color, 0, .17, .35); break;
    case 'rifle':    fnBox(inner, .08, .12, .55, wood, 0, .1, -.3); fnBox(inner, .05, .05, .9, w.color, 0, .17, .4); fnBox(inner, .06, .06, .2, dark, 0, .25, .1); break;
    default:         fnBox(inner, .1, .5, .1, w.color, 0, .25, 0);
  }
  inner.rotation.set(Math.PI / 2.4, 0, Math.PI / 5);
  inner.position.y = 0.18;
  inner.scale.setScalar(1.5);
  //  A soft ring on the ground so it reads as "can be picked up" at night.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.5, 20), fnMat(w.color, true));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
  g.userData.inner = inner;
  return g;
}

function fnDropWeapon(id, x, y, z, opts){
  if (!FN_WEAPONS[id] || id === 'fists') return null;
  const mesh = fnWeaponMesh(id);
  mesh.position.set(x, y, z);
  const parent = (opts && opts.chunk) ? opts.chunk.group : State.scene;
  parent.add(mesh);
  const p = { id: (opts && opts.pid) || ('drop:' + Math.random().toString(36).slice(2, 8)), wid: id,
              x, y, z, mesh, parent, chunkKey: opts && opts.chunk ? opts.chunk.key : null,
              ttl: opts && opts.ttl || 0, ammo: opts && opts.ammo != null ? opts.ammo : (FN_WEAPONS[id].ammo || 0) };
  FN.pickups.push(p);
  return p;
}
FN.dropWeapon = fnDropWeapon;

function fnRemovePickup(p){
  if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
  const i = FN.pickups.indexOf(p); if (i >= 0) FN.pickups.splice(i, 1);
}

//  Roughly one block in four has something in it. Seeded per city and chunk,
//  so the same city puts the same crowbar in the same doorway, and a weapon
//  you have taken stays taken.
function fnWeightedWeapon(rng, district){
  const bias = DISTRICT_BIAS[district];
  if (bias && rng.next() < 0.5) return bias[Math.floor(rng.next() * bias.length)];
  const pool = [];
  for (const [id, w] of Object.entries(FN_WEAPONS)) for (let i = 0; i < w.rarity; i++) pool.push(id);
  return pool[Math.floor(rng.next() * pool.length)];
}
function fnSeedChunks(){
  if (!State.citySeed) return;
  for (const [key, chunk] of State.chunkMap){
    if (FN.seeded.get(key) === chunk) continue;
    FN.seeded.set(key, chunk);
    const rng = new RNG('fnw:' + State.citySeed + ':' + key);
    if (rng.next() > 0.27) continue;
    const pid = 'w:' + key;
    if (FN.state.taken.includes(pid)) continue;
    if (Math.abs(chunk.worldX) < 30 && Math.abs(chunk.worldZ) < 30) continue;   // the Civic Core is authored
    const side = Math.floor(rng.next() * 4), off = CITY_BLOCK_SIZE / 2 + 1.6;
    const sx = chunk.worldX + (side === 0 ? off : side === 1 ? -off : (rng.next() - .5) * 8);
    const sz = chunk.worldZ + (side === 2 ? off : side === 3 ? -off : (rng.next() - .5) * 8);
    const spot = shFindOpenSpot(sx, sz, 0.3, 1.2, 8);
    if (!spot) continue;
    fnDropWeapon(fnWeightedWeapon(rng, chunk.district), spot.x, spot.y, spot.z, { chunk, pid });
  }
  //  Chunks that have gone take their pickups with them.
  for (const [key, chunk] of FN.seeded) if (State.chunkMap.get(key) !== chunk) FN.seeded.delete(key);
  for (let i = FN.pickups.length - 1; i >= 0; i--){
    const p = FN.pickups[i];
    if (p.chunkKey && !FN.seeded.has(p.chunkKey)) FN.pickups.splice(i, 1);
  }
}

function fnNearestPickup(){
  let best = null, bd = 1.9;
  const fx = Player.position.x, fz = Player.position.z, fy = Player.position.y - Player.height;
  for (const p of FN.pickups){
    if (Math.abs(p.y - fy) > 2.2) continue;
    const d = dist2(p.x, p.z, fx, fz);
    if (d < bd){ bd = d; best = p; }
  }
  return best;
}

function fnTakePickup(p){
  const w = FN_WEAPONS[p.wid];
  if (!w) return;
  const old = FN.state.loadout[w.slot];
  const key = SLOT_KEY[w.slot];
  const feet = Player.position.y - Player.height;
  if (old === p.wid && w.type !== 'ranged'){
    toast(`Already carrying a ${w.name.toLowerCase()}.`, 'info');
    return;
  }
  if (old === p.wid && w.type === 'ranged'){
    //  Same gun: take the rounds, leave nothing behind.
    Player.ammo[key] = Math.min(w.ammoMax, (Player.ammo[key] || 0) + Math.max(2, p.ammo));
    toast(`+${Math.max(2, p.ammo)} rounds for the ${w.name.toLowerCase()}.`, 'success');
  } else {
    if (old && old !== 'fists'){
      const back = { x: Player.position.x - Math.sin(Player.yaw) * 0.6, z: Player.position.z - Math.cos(Player.yaw) * 0.6 };
      fnDropWeapon(old, back.x, feet, back.z, { ttl: 180, ammo: w.slot > 1 ? Math.min(6, Player.ammo[key] || 0) : 0 });
    }
    FN.state.loadout[w.slot] = p.wid;
    if (w.type === 'ranged') Player.ammo[key] = Math.min(w.ammoMax, Math.max(p.ammo, 1) + (old === p.wid ? Player.ammo[key] : 0));
    Player.currentWeapon = key;
    fnApplyLoadout();
    const oldName = old && old !== 'fists' ? ` Dropped the ${FN_WEAPONS[old].name.toLowerCase()}.` : '';
    toast(`${w.name}.${oldName}`, 'success');
  }
  if (p.id.indexOf('w:') === 0) FN.state.taken.push(p.id);
  safe(() => shTone({ type: 'triangle', f0: 320, f1: 520, gain: 0.12, dur: 0.12 }));
  fnRemovePickup(p);
  if (FN.prologue) FN.prologue.onTake && FN.prologue.onTake(p.wid);
  fnSave();
}

function fnTickPickups(dt){
  const t = performance.now() * 0.001;
  for (let i = FN.pickups.length - 1; i >= 0; i--){
    const p = FN.pickups[i];
    if (p.ttl){ p.ttl -= dt; if (p.ttl <= 0){ fnRemovePickup(p); continue; } }
    const inner = p.mesh && p.mesh.userData.inner;
    if (inner && dist2(p.x, p.z, Player.position.x, Player.position.z) < 30){
      inner.rotation.y = t * 1.3 + p.x;
      inner.position.y = 0.2 + Math.sin(t * 2 + p.z) * 0.05;
    }
  }
  const near = fnNearestPickup();
  const el = fnUi('fn-take');
  if (near){
    const w = FN_WEAPONS[near.wid], old = FN.state.loadout[w.slot];
    const repl = old && old !== near.wid && old !== 'fists' ? ` <em>replaces ${esc(FN_WEAPONS[old].short.toLowerCase())}</em>` : '';
    el.innerHTML = `<b>R</b> TAKE ${esc(w.name)} <span>slot ${w.slot}</span>${repl}`;
    el.classList.add('on');
  } else el.classList.remove('on');
  FN._nearPickup = near;
}

// =============================================================================
//  3 · BODIES ; everyone on the street can be hit
// =============================================================================
const BRAWLER_ARCH = /drifter|punk|vendor|courier/i;
const PAIN = ["That is my working shoulder.", "Stop; I need that arm.", "I was only passing.", "Please leave me alone.", "The other elbow was already bad.", "Help me, please.", "I have done nothing to you."];
const PANIC = ["Inside, now!", "Take my hand.", "Leave the bag; come on.", "Bureau, this one is real!", "Mind the person on the ground.", "Stay with me.", "Not through that door; it sticks."];
const SAW = ["I saw you do it.", "I will give a statement.", "I know which coat.", "Someone help them; I will call.", "I am writing the time down."];
const FIGHT = ["You can stop now.", "I was having a tolerable evening.", "Last chance to reconsider.", "Put it down."];

//  Every person the player can reach, from every collection that holds one.
function fnPeople(){
  const out = [];
  for (const n of State.globalNPCs) if (n.char) out.push({ char: n.char, kind: 'street', owner: n, pos: n.position });
  for (const f of (State.shopFolk || [])) if (f.char) out.push({ char: f.char, kind: 'shop', owner: f, pos: f.char.group.position,
    keeper: !!(f.shop && f.shop.keeper === f) });
  safe(() => { if (typeof SHIFT_WORLD !== 'undefined' && SHIFT_WORLD.echoes)
    for (const e of SHIFT_WORLD.echoes) if (e.char) out.push({ char: e.char, kind: 'echo', owner: e, pos: e.char.group.position, protect: true }); });
  safe(() => { if (typeof Cast !== 'undefined' && Cast.staged && Cast.staged.members)
    for (const m of Cast.staged.members) if (m.char) out.push({ char: m.char, kind: 'cast', owner: m, pos: m.char.group.position, protect: true }); });
  if (FN.prologue) for (const x of FN.prologue.extras) if (x.char) out.push({ char: x.char, kind: 'extra', owner: x, pos: x.char.group.position, protect: true });
  return out;
}

function fnBody(p){
  const c = p.char;
  if (!c.fnb){
    const arch = (c.archetype && (c.archetype.key || c.archetype.name)) || '';
    c.fnb = { hp: 40, max: 40, st: 'ok', t: 0, flinch: 0, protect: !!p.protect, kind: p.kind,
              brawler: !p.protect && (p.keeper || BRAWLER_ARCH.test(arch) || Math.random() < 0.14),
              punchT: 0, barkT: 0 };
  }
  c.fnb.protect = c.fnb.protect || !!p.protect;
  return c.fnb;
}
function fnFeetY(p){ return (p.char.baseY != null ? p.char.baseY : p.pos.y); }

//  Lying down, on the back, facing where they were facing.
function fnPoseDown(c, yaw){
  const g = c.group;
  g.rotation.order = 'YXZ';
  if (yaw != null) g.rotation.y = yaw;
  g.rotation.x = -Math.PI / 2;
  g.position.y = (c.baseY || 0) + 0.26;
  if (c.plate) c.plate.visible = false;
}
function fnPoseUp(c){ c.group.rotation.order = 'YXZ'; c.group.rotation.x = 0; }

function fnHurt(p, amount, head, fromX, fromZ){
  const b = fnBody(p);
  if (b.st === 'dead') return;
  const x = p.pos.x, z = p.pos.z, y = fnFeetY(p);
  amount = Math.round(amount);
  b.hp -= amount;
  b.flinch = 0.22;
  safe(() => spawnDamageNumber(x, y + 2.0, z, amount, head));
  safe(() => shSfxHitFlesh(x, z, amount > 40));
  safe(() => shBurst(x, y + 1.3, z, { count: 7, color: 0x7a1420, size: 0.07, speed: 3, life: 0.4, grav: 12 }));
  if (typeof Feel !== 'undefined' && Feel.capturing) Feel.hits.push({ x, y: y + 1.3, z, head: !!head, dead: b.hp <= 0 && !b.protect });

  //  Knocked back along the blow. Only street people own their position.
  if (p.kind === 'street'){
    const dx = x - fromX, dz = z - fromZ, d = Math.hypot(dx, dz) || 1;
    const push = Math.min(0.9, 0.25 + amount / 90);
    safe(() => shGroundMove(p.owner, dx / d * push, dz / d * push, 0.38, 1.75));
  }

  const yaw = p.char.group.rotation.y;
  let sev;
  if (b.hp <= 0 && b.protect){
    b.hp = 1; b.st = 'down'; b.t = 7; fnPoseDown(p.char, yaw); sev = 1.0;
    fnBark(p, pick(['I need a minute.', 'Someone stay with me.', 'Please, no more.']), 2);
    safe(() => shHitmark('kill'));
  } else if (b.hp <= 0){
    b.st = 'dead'; b.t = 0; fnPoseDown(p.char, yaw); sev = 1.4;
    b.lx = x; b.lz = z;
    safe(() => shHitmark('kill'));
    FN.state.crimes++;
  } else {
    safe(() => shHitmark(head ? 'head' : null));
    sev = 0.6;
    if (b.hp < b.max * 0.35 && Math.random() < 0.5 && !b.protect){
      b.st = 'down'; b.t = 3.5; fnPoseDown(p.char, yaw); b.lx = x; b.lz = z;
    } else if (b.brawler && b.hp > b.max * 0.3 && p.kind === 'street'){
      if (b.st !== 'fight') fnBark(p, pick(FIGHT), 2.2);
      b.st = 'fight'; b.t = 12;
    } else if (p.kind === 'street'){
      b.st = 'flee'; b.t = 9; b.fx = fromX; b.fz = fromZ;
      fnBark(p, pick(PAIN), 1.8);
    } else fnBark(p, pick(PAIN), 1.8);
  }
  fnCrime(x, z, sev, p.char);
  fnPanic(x, z, 16, p.char);
  if (!FN.state.taughtHeat){
    FN.state.taughtHeat = true;
    toast('Anyone who sees that will report it. Bureau Attention is the diamonds at the top.', 'warn');
  }
}
FN.hurt = fnHurt;

//  Everyone nearby reacts. Brawlers close in; everyone else runs.
function fnPanic(x, z, r, except){
  for (const n of State.globalNPCs){
    if (!n.char || n.char === except) continue;
    const d = dist2(n.position.x, n.position.z, x, z);
    if (d > r) continue;
    const b = fnBody({ char: n.char, kind: 'street', pos: n.position });
    if (b.st === 'dead' || b.st === 'down' || b.st === 'fight') continue;
    if (b.brawler && d < 7 && Math.random() < 0.35){ b.st = 'fight'; b.t = 10; fnBark({ char: n.char, pos: n.position }, pick(FIGHT), 2); continue; }
    b.st = 'flee'; b.t = 6 + Math.random() * 5; b.fx = x; b.fz = z;
    if (Math.random() < 0.3) fnBark({ char: n.char, pos: n.position }, pick(PANIC), 1.6);
  }
}

//  Build a stand-in the engine's own shot loop can hit. It only has to satisfy
//  shRayCapsule (position, group.position.y, type) and takeDamage.
function fnProxies(){
  const out = [];
  const px = Player.position.x, pz = Player.position.z;
  for (const p of fnPeople()){
    const b = p.char.fnb;
    if (b && b.st === 'dead') continue;
    if (dist2(p.pos.x, p.pos.z, px, pz) > 80) continue;
    const feet = fnFeetY(p);
    const down = b && b.st === 'down';
    out.push({
      _fnProxy: true, type: 'civ', state: 'patrol', flying: false, hp: 1, def: { height: 1.8 },
      position: V3(p.pos.x, feet, p.pos.z),
      group: { position: { y: down ? feet - 1.35 : feet } },   // someone on the ground is hit low
      takeDamage(amount, head){
        //  A wall between you and them stops the shot.
        const ok = shLineOfSight(Player.position.x, Player.position.y - 0.1, Player.position.z, p.pos.x, feet + 1.2, p.pos.z);
        if (!ok) return;
        fnHurt(p, amount, head, Player.position.x, Player.position.z);
      },
    });
  }
  return out;
}
if (typeof HITBOX !== 'undefined'){
  HITBOX.civ = { r: 0.45, from: 0.1, to: 1.8 };
  HITBOX.warden = { r: 0.5, from: 0.1, to: 1.9 };
}

const _tryAttack = tryAttack;
window.tryAttack = function(){
  const proxies = (Player.mode === 'walk' && !State.ui.paused) ? fnProxies() : [];
  for (const p of proxies) State.enemies.push(p);
  const cd0 = Player.attackCooldown, key = Player.currentWeapon;
  let r;
  try { r = _tryAttack.apply(this, arguments); }
  finally {
    if (proxies.length){
      const set = new Set(proxies);
      for (let i = State.enemies.length - 1; i >= 0; i--) if (set.has(State.enemies[i])) State.enemies.splice(i, 1);
    }
  }
  if (Player.attackCooldown > cd0 && WEAPONS[key] && WEAPONS[key].type === 'ranged') fnGunshot();
  return r;
};

//  A shot in public. Unprovoked gunfire with people about is a crime; gunfire
//  in a fight is not, but everyone still runs.
function fnGunshot(){
  const px = Player.position.x, pz = Player.position.z;
  fnPanic(px, pz, 24, null);
  let threat = false;
  for (const e of State.enemies){
    if (e._fnProxy || e.state === 'dead' || (e.type === 'warden' && FN.level() === 0)) continue;
    if (dist2(e.position.x, e.position.z, px, pz) < 30){ threat = true; break; }
  }
  if (threat) return;
  for (const n of State.globalNPCs){
    if (n.char && !(n.char.fnb && n.char.fnb.st === 'dead') && dist2(n.position.x, n.position.z, px, pz) < 12){
      fnCrime(px, pz, 0.25, null); return;
    }
  }
}

// ─── Street people, driven while something has happened to them ────────────
const _npcUpdate = NPC.prototype.update;
NPC.prototype.update = function(dt){
  const b = this.char && this.char.fnb;
  if (!b || b.st === 'ok'){
    const r = _npcUpdate.call(this, dt);
    fnLookAtPlayer(this.char, this.position, this.direction);
    if (b && b.flinch > 0) fnFlinch(this.char, b, dt);
    return r;
  }
  const c = this.char;
  const px = Player.position.x, pz = Player.position.z;
  const now = performance.now() * 0.001;
  if (b.st === 'dead'){ fnPoseDown(c); this._fnSyncXZ(); return; }
  if (b.st === 'down'){
    b.t -= dt; fnPoseDown(c); this._fnSyncXZ();
    if (b.t <= 0){ fnPoseUp(c); b.hp = Math.max(b.hp, b.max * 0.5); b.st = b.protect ? 'ok' : 'flee'; b.t = 8; b.fx = px; b.fz = pz; }
    return;
  }
  fnPoseUp(c);
  let moved = false;
  if (b.st === 'flee'){
    const a = Math.atan2(this.position.z - b.fz, this.position.x - b.fx);
    if (!this._fnFleeA || Math.random() < 0.02) this._fnFleeA = a + (Math.random() - 0.5) * 0.6;
    const step = (this.speed * 2.4 + 1.6) * dt;
    moved = shGroundMove(this, Math.cos(this._fnFleeA) * step, Math.sin(this._fnFleeA) * step, 0.38, 1.75);
    if (!moved) this._fnFleeA += Math.PI / 2 + Math.random();
    this.direction = this._fnFleeA;
    b.t -= dt;
    if (b.t <= 0) b.st = 'ok';
  } else if (b.st === 'fight'){
    const dx = px - this.position.x, dz = pz - this.position.z, d = Math.hypot(dx, dz);
    this.direction = Math.atan2(dz, dx);
    if (d > 1.25){
      const step = (this.speed * 1.9 + 1.2) * dt;
      moved = shGroundMove(this, dx / d * step, dz / d * step, 0.38, 1.75);
    } else {
      b.punchT -= dt;
      if (b.punchT <= 0){
        b.punchT = 1.05;
        c.rightArm.rotation.x = -1.6;
        if (!State.ui.paused && Player.hp > 0 && typeof Peace !== 'undefined' && !Peace.on) damagePlayer(6 + Math.floor(Math.random() * 4));
        safe(() => shSfxSwing(this.position.x, this.position.z));
      }
    }
    b.t -= dt;
    if (b.t <= 0 || d > 26 || b.hp < b.max * 0.3){ b.st = 'flee'; b.t = 6; b.fx = px; b.fz = pz; }
  }
  safe(() => shSettle(this, 0.38, 1.75));
  shAnimateCharacter(c, dt * (b.st === 'flee' ? 1.8 : 1.2), moved, now);
  if (b.flinch > 0) fnFlinch(c, b, dt);
  c.baseY = this.position.y;
  this._fnSyncXZ();
  this.group.rotation.y = -this.direction + Math.PI / 2;
};
NPC.prototype._fnSyncXZ = function(){ this.group.position.x = this.position.x; this.group.position.z = this.position.z; };

function fnFlinch(c, b, dt){
  b.flinch -= dt;
  c.group.rotation.order = 'YXZ';
  c.group.rotation.x = Math.max(0, b.flinch) * 1.1;
}

//  People notice you. Close enough and still, they look at you.
function fnLookAtPlayer(c, pos, dir){
  if (!c || !c.head) return;
  const dx = Player.position.x - pos.x, dz = Player.position.z - pos.z, d = Math.hypot(dx, dz);
  if (d > 4.5 || d < 0.3) return;
  const face = -(dir || 0) + Math.PI / 2;
  let rel = Math.atan2(dx, dz) - face;
  while (rel > Math.PI) rel -= 2 * Math.PI;
  while (rel < -Math.PI) rel += 2 * Math.PI;
  if (Math.abs(rel) < 1.4) c.head.rotation.y = rel * 0.85;
}

//  Shop folk, echoes, the cast and prologue extras are posed by their own
//  systems every frame. Afterwards, put the fallen back on the floor.
function fnPoseOthers(dt){
  for (const p of fnPeople()){
    if (p.kind === 'street') continue;
    const b = p.char.fnb;
    if (!b || b.st === 'ok'){ if (b && b.flinch > 0) fnFlinch(p.char, b, dt); continue; }
    if (b.st === 'down' || b.st === 'dead'){
      if (b.lx != null){ p.char.group.position.x = b.lx; p.char.group.position.z = b.lz; }
      fnPoseDown(p.char);
      if (b.st === 'down'){
        b.t -= dt;
        if (b.t <= 0){ fnPoseUp(p.char); b.st = 'ok'; b.hp = b.max * 0.6; if (p.char.baseY != null) p.char.group.position.y = p.char.baseY; }
      }
    } else if (b.st === 'flee' || b.st === 'fight'){ b.t -= dt; if (b.t <= 0) b.st = 'ok'; }
  }
}

// =============================================================================
//  4 · HEAT ; witnesses, and the Bureau
// =============================================================================
FN.level = () => FN.heat <= 0.001 ? 0 : Math.min(5, Math.ceil(FN.heat - 0.001));

//  A crime is only pending. If someone who saw it is still standing in three
//  seconds, the Bureau hears. If nobody did, it did not happen.
function fnCrime(x, z, sev, victim){
  FN.pending.push({ x, z, sev, victim, t: 3 });
  FN.coolT = 0;
}
FN.crime = fnCrime;

function fnWitnesses(x, z, victim){
  let n = 0;
  for (const p of fnPeople()){
    if (p.char === victim) continue;
    const b = p.char.fnb;
    if (b && (b.st === 'dead' || b.st === 'down')) continue;
    if (dist2(p.pos.x, p.pos.z, x, z) < 22){ n++; if (n === 1 && Math.random() < 0.6) fnBark(p, pick(SAW), 2); }
  }
  for (const e of State.enemies) if (e.type === 'warden' && e.state !== 'dead' && dist2(e.position.x, e.position.z, x, z) < 30) n += 2;
  return n;
}

function fnAddHeat(v, why){
  const before = FN.level();
  //  One warning, for the Clerk and for anyone who gave the Bureau their name.
  if (before === 0 && !FN.state.warned && (FN.state.cls === 'clerk' || FN.state.standing > 0) && v < 1.2){
    FN.state.warned = true;
    toast('A Warden takes your details and lets it go. Once.', 'info');
    return;
  }
  FN.heat = clamp(FN.heat + v, 0, 5);
  FN.coolT = 0;
  const after = FN.level();
  if (after > before){
    safe(() => shTone({ type: 'square', f0: 660, f1: 440, gain: 0.08, dur: 0.18 }));
    safe(() => shTone({ type: 'square', f0: 660, f1: 440, gain: 0.08, dur: 0.18, delay: 0.22 }));
    toast(after === 1 ? 'Reported. A Warden is coming to take a statement.' :
          after === 2 ? 'The Bureau is sending armed Wardens.' :
          after === 3 ? 'Bureau Attention rising. Drones are up.' :
          after === 4 ? 'Heavies have been authorised.' : 'Everything the Bureau has.', 'warn');
  }
  fnHeatHud();
}
FN.addHeat = fnAddHeat;

function fnTickHeat(dt){
  for (let i = FN.pending.length - 1; i >= 0; i--){
    const c = FN.pending[i];
    c.t -= dt;
    if (c.t > 0) continue;
    FN.pending.splice(i, 1);
    if (fnWitnesses(c.x, c.z, c.victim) > 0) fnAddHeat(c.sev);
    else if (c.sev >= 1 && !FN._saidUnseen){ FN._saidUnseen = true; toast('Nobody saw. As far as the city is concerned, it did not happen.', 'info'); }
  }
  //  Seen by a hunting Warden, the clock stops.
  const px = Player.position.x, pz = Player.position.z;
  for (const e of State.enemies){
    if (e.type === 'warden' && e.fnHunt && e.state !== 'dead' && e.state !== 'patrol' && dist2(e.position.x, e.position.z, px, pz) < 32){ FN.coolT = 0; break; }
  }
  FN.coolT += dt;
  const quiet = FN.state.cls === 'witness' ? 12.5 : 25;
  if (FN.heat > 0 && FN.coolT > quiet){
    const lv = FN.level();
    FN.heat = Math.max(0, FN.heat - dt / 18 * (FN.state.cls === 'witness' ? 2 : 1));
    if (FN.level() < lv){
      fnHeatHud();
      if (FN.level() === 0){ toast('The Bureau has lost interest. For now.', 'success'); fnCallOff(); }
    }
  }
  FN.state.heat = FN.heat;
  fnSpawnWardens(dt);
}

// ─── Wardens ────────────────────────────────────────────────────────────────
ENEMY_TYPES.warden = {
  name: 'BUREAU WARDEN', hp: 75, dmg: 11, speed: 3.9, height: 1.85,
  detectRange: 24, attackRange: 2.3, attackCooldown: 1.0,
  rewardCredits: [10, 25], flying: false,
  colors: { jacket: 0x4a4f63, pants: 0x1c2030, weapon: 0x9aa2bb },
};

const _makeMesh = Enemy.prototype.makeMesh;
Enemy.prototype.makeMesh = function(rng){
  if (this.type !== 'warden') return _makeMesh.call(this, rng);
  //  A person in a uniform, built by the same character system as everyone
  //  else, so they read as the city's own people and not as monsters.
  const arch = CHAR_ARCHETYPES.find(a => /clerk|bureau|office/i.test(a.key || a.name || '')) || CHAR_ARCHETYPES[0];
  const c = shBuildCharacter(arch, rng, { coat: 0x4a4f63, accent: 0x9aa2bb, pants: 0x1c2030, headgear: 'cap', prop: 'none', handle: 'BUREAU' });
  //  Hit flash writes to emissive; the character system shares materials, so
  //  a Warden gets its own or every coat in the city would flash red.
  c.group.traverse(o => { if (o.material && !o.isSprite) o.material = o.material.clone(); });
  if (c.plate) c.plate.visible = false;
  this.leftArm = c.leftArm; this.rightArm = c.rightArm; this.leftLeg = c.leftLeg; this.rightLeg = c.rightLeg;
  this.fnChar = c;
  //  The badge, so you can tell a Warden at twenty metres.
  const badge = makeBoxMesh(0.16, 0.16, 0.05, makeNeonMat(0x9aa2bb));
  badge.position.set(0.14, 1.35, 0.24); c.group.add(badge);
  return c.group;
};

// Custom movement must publish the grounded position before any early return.
function fnGroundEnemy(e){
  if (e.flying || e.state === 'dead') return;
  shSettle(e, 0.55, e.def.height || 1.85);
  e.group.position.copy(e.position);
  if (e.fnChar) e.fnChar.baseY = e.position.y;
}

//  At zero heat a Warden walks the beat and does not come for you. Stamped
//  or hooked, it stands still.
const _enemyUpdate = Enemy.prototype.update;
Enemy.prototype.update = function(dt, player){
  if (this.fnFrozen && this.fnFrozen > 0){
    this.fnFrozen -= dt;
    fnGroundEnemy(this);
    if (this.state !== 'dead') this.attackTimer = Math.max(this.attackTimer || 0, 0.6);
    return;
  }
  if (this.type === 'warden' && FN.level() === 0 && this.state !== 'dead'){
    this.state = 'patrol'; this.attackTimer = 999; this.sees = false; this.investigate = null;
    this.patrolTimer = (this.patrolTimer || 0) - dt;
    if (this.patrolTimer <= 0){ this.direction = Math.random() * TAU; this.patrolTimer = 3 + Math.random() * 4; }
    const s = this.def.speed * 0.35 * dt;
    this.tryMove(Math.cos(this.direction) * s, Math.sin(this.direction) * s);
    fnGroundEnemy(this);
    this.group.rotation.y = -this.direction + Math.PI / 2;
    if (this.fnChar) shAnimateCharacter(this.fnChar, dt * 0.6, true, performance.now() * 0.001);
    return;
  }
  if (this.type === 'warden'){
    //  At two diamonds and up they draw.
    const armed = FN.level() >= 2;
    if (this._fnArmed !== armed){
      this._fnArmed = armed;
      this.def = Object.assign({}, ENEMY_TYPES.warden, armed
        ? { attackRange: 16, attackCooldown: 1.1, dmg: 9 } : {});
    }
    if (this.attackTimer > 50) this.attackTimer = 0.8;
  }
  return _enemyUpdate.call(this, dt, player);
};

const _enemyDie = Enemy.prototype.die;
Enemy.prototype.die = function(){
  const r = _enemyDie.apply(this, arguments);
  if (this.type === 'warden'){
    const lv = FN.level();
    fnCrime(this.position.x, this.position.z, lv === 0 ? 1.6 : 1.0, null);
    if (Math.random() < 0.65){
      const id = pick(['compliance', 'compliance', 'riot', 'baton']);
      fnDropWeapon(id, this.position.x + 0.4, this.position.y || 0, this.position.z, { ttl: 200 });
    }
  }
  return r;
};
//  Hitting a Warden who was not bothering you is assault.
const _enemyTake = Enemy.prototype.takeDamage;
Enemy.prototype.takeDamage = function(amount, head){
  if (this.type === 'warden' && FN.level() === 0 && this.state !== 'dead') fnAddHeat(1.2);
  return _enemyTake.apply(this, arguments);
};

function fnWardenCount(){
  let n = 0, patrol = 0;
  for (const e of State.enemies){
    if (e.state === 'dead') continue;
    if (e.fnHunt) n++; else if (e.type === 'warden') patrol++;
  }
  return { n, patrol };
}

function fnSpawnAround(type, minR, maxR, hunt){
  const px = Player.position.x, pz = Player.position.z;
  for (let i = 0; i < 6; i++){
    const a = Math.random() * TAU, r = minR + Math.random() * (maxR - minR);
    const def = ENEMY_TYPES[type];
    const spot = shFindOpenSpot(px + Math.cos(a) * r, pz + Math.sin(a) * r, 0.55, (def && def.height) || 1.8, 10);
    if (!spot) continue;
    const e = new Enemy(type, spot.x, spot.z, new RNG('fnw:' + type + ':' + Math.random()));
    e.position.y = spot.y; e.group.position.set(spot.x, spot.y, spot.z);
    if (hunt){ e.fnHunt = true; e.state = 'alert'; e.lastSeenPlayerPos = Player.position.clone(); }
    State.scene.add(e.group);
    State.enemies.push(e);
    return e;
  }
  return null;
}
FN.spawnAround = fnSpawnAround;

const WANT = [0, 1, 3, 4, 6, 8];
function fnSpawnWardens(dt){
  FN._spawnT = (FN._spawnT || 0) - dt;
  if (FN._spawnT > 0 || !State.citySeed || FN.prologueBlocksSpawns) return;
  FN._spawnT = 2.4;
  const lv = FN.level(), c = fnWardenCount();
  if (lv > 0 && c.n < WANT[lv]){
    const roll = Math.random();
    const type = lv >= 4 && roll < 0.3 ? 'heavy' : lv >= 3 && roll < 0.5 ? 'drone' : 'warden';
    const e = fnSpawnAround(type, 26, 42, true);
    if (e && type === 'warden') fnBarkEnemy(e, pick(['Bureau; please remain available for spelling.', 'One statement at a time, including yours.', 'Please put that down before the description changes.']));
  }
  //  On a quiet night, one or two on the beat.
  if (lv === 0 && c.patrol < 2 && Math.random() < 0.2){
    fnSpawnAround('warden', 34, 50, false);
  }
}

//  Heat gone: the hunt walks away.
function fnCallOff(){
  for (const e of State.enemies){
    if (e.fnHunt && e.state !== 'dead'){
      e.fnHunt = false;
      if (e.type !== 'warden'){ e.state = 'patrol'; e.fnLeave = true; }
    }
  }
}
function fnClearHunt(){
  for (let i = State.enemies.length - 1; i >= 0; i--){
    const e = State.enemies[i];
    if (e.fnHunt || e.fnLeave){ if (e.group && e.group.parent) e.group.parent.remove(e.group); State.enemies.splice(i, 1); }
  }
}

//  Dying clears your file, at a price.
const _respawn = respawnPlayer;
window.respawnPlayer = function(){
  const lv = FN.level();
  const r = _respawn.apply(this, arguments);
  if (lv > 0){
    const fine = Math.min(State.hud.credits || 0, 40 * lv);
    if (fine > 0) grantCredits(-fine);
    FN.heat = 0; FN.pending.length = 0; fnClearHunt(); fnHeatHud();
    toast(fine ? `The Bureau closed your file. Fine: ${fine}c.` : 'The Bureau closed your file.', 'info');
  }
  return r;
};

// =============================================================================
//  5 · THE SCREEN ; HUD, speech, cards
// =============================================================================
(function css(){
  const st = document.createElement('style');
  st.textContent = `
  #fn-heat{position:fixed;top:54px;left:50%;transform:translateX(-50%);z-index:58;pointer-events:none;
    font:600 11px/1 'Courier New',monospace;letter-spacing:3px;color:#9aa2bb;text-align:center;opacity:0;transition:opacity .3s}
  #fn-heat.on{opacity:1}
  #fn-heat .d{font-size:20px;letter-spacing:4px;display:block;margin-top:5px;color:#3a3f52}
  #fn-heat .d b{color:#ff5268;font-weight:400;text-shadow:0 0 10px rgba(255,82,104,.8)}
  #fn-heat.flash .d b{animation:fnpulse .5s ease 3}
  @keyframes fnpulse{50%{opacity:.25}}
  #fn-ability{position:fixed;left:20px;bottom:178px;z-index:58;pointer-events:none;font:12px 'Courier New',monospace;
    color:#e7e2ff;background:rgba(12,10,20,.72);border:1px solid #40334f;padding:8px 12px;letter-spacing:1px;display:none}
  #fn-ability.on{display:block} #fn-ability b{color:var(--fn-c,#f4bb3d)} #fn-ability.cd{opacity:.55}
  #fn-take{position:fixed;left:50%;top:71%;transform:translateX(-50%);z-index:58;pointer-events:none;
    font:13px 'Courier New',monospace;color:#f4f0e6;background:rgba(12,10,20,.82);border:1px solid #f4bb3d;
    padding:8px 14px;letter-spacing:1px;opacity:0;transition:opacity .15s}
  #fn-take.on{opacity:1} #fn-take b{color:#211727;background:#f4bb3d;padding:1px 6px;margin-right:8px}
  #fn-take span{opacity:.6;margin-left:6px} #fn-take em{display:block;font-style:normal;opacity:.6;font-size:11px;margin-top:4px}
  .weapon-slot.fn-empty{opacity:.35}
  #fn-obj{position:fixed;left:20px;top:108px;z-index:61;max-width:340px;font:13px/1.55 Georgia,serif;color:#f1ead8;
    background:rgba(12,10,20,.93);border-left:3px solid #f4bb3d;padding:12px 16px;display:none}
  #fn-obj.on{display:block} #fn-obj .k{font:10px 'Courier New',monospace;letter-spacing:3px;color:#f4bb3d;display:block;margin-bottom:4px}
  #fn-obj button{margin-top:8px;background:none;border:0;color:#a69cbb;font:11px 'Courier New',monospace;cursor:pointer;padding:0;pointer-events:auto;text-decoration:underline}
  .fn-bark{position:fixed;z-index:57;pointer-events:none;transform:translate(-50%,-100%);font:13px Georgia,serif;
    color:#fff;background:rgba(10,8,16,.8);padding:4px 9px;border-radius:3px;white-space:nowrap;transition:opacity .3s}
  .fn-bark.w{color:#cfd6ee;border-left:2px solid #9aa2bb}
  #fn-card{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;
    background:radial-gradient(ellipse at 50% 20%,rgba(30,22,44,.94),rgba(6,5,10,.97));overflow:auto;padding:28px 16px}
  #fn-card.on{display:flex}
  #fn-card .in{width:min(1040px,100%);font-family:Georgia,serif;color:#efe8d8}
  #fn-card .kick{font:11px 'Courier New',monospace;letter-spacing:4px;color:#f4bb3d;text-transform:uppercase;margin:0 0 10px}
  #fn-card h1{font-weight:400;font-size:clamp(26px,4vw,40px);margin:0 0 10px;letter-spacing:1px}
  #fn-card .body{color:#c8bfd6;line-height:1.7;max-width:640px;margin:0 0 22px}
  #fn-card .div{color:#f4bb3d;letter-spacing:10px;margin:0 0 18px;font-size:12px}
  .fn-opts{display:grid;gap:10px;max-width:640px}
  .fn-opt{text-align:left;background:rgba(26,20,38,.9);border:1px solid #40334f;color:#efe8d8;padding:14px 16px;cursor:pointer;font:15px Georgia,serif}
  .fn-opt:hover,.fn-opt:focus-visible{border-color:#f4bb3d;outline:none}
  .fn-opt small{display:block;color:#a69cbb;font-size:12px;margin-top:5px;font-family:'Courier New',monospace;letter-spacing:.5px}
  .fn-classes{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:10px}
  .fn-cls{display:flex;flex-direction:column;justify-content:flex-start;text-align:left;background:rgba(20,15,30,.92);border:1px solid #40334f;color:#efe8d8;padding:14px;cursor:pointer;font-family:Georgia,serif;position:relative}
  .fn-cls:hover,.fn-cls:focus-visible{border-color:var(--c);outline:none;transform:translateY(-2px)}
  .fn-cls.rec{border-color:var(--c);box-shadow:0 0 0 1px var(--c),0 0 24px rgba(244,187,61,.15)}
  .fn-cls .rec-tag{position:absolute;top:-9px;left:12px;background:var(--c);color:#150f1f;font:9px 'Courier New',monospace;letter-spacing:2px;padding:2px 6px}
  .fn-cls h3{font:700 13px 'Courier New',monospace;letter-spacing:3px;color:var(--c);margin:0 0 6px}
  .fn-cls .who{font-size:12px;color:#a69cbb;font-style:italic;margin:0 0 8px;line-height:1.5}
  .fn-cls p{font-size:13px;line-height:1.55;margin:0 0 10px}
  .fn-cls dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font:11px 'Courier New',monospace;margin:0 0 10px}
  .fn-cls dt{color:#8a80a0} .fn-cls dd{margin:0;color:#ffd47a}
  .fn-cls .ab{font-size:12px;border-top:1px solid #332943;padding-top:8px;color:#d8d0e6;line-height:1.5}
  .fn-cls .ab b{font:11px 'Courier New',monospace;letter-spacing:2px;color:var(--c)}
  #fn-flash{position:fixed;inset:0;z-index:8990;pointer-events:none;background:#fff;opacity:0;transition:opacity 1.6s ease}
  #fn-flash.on{opacity:.92;transition:opacity .05s}
  body.fn-prologue #hud-task{display:none}
  @media(max-width:620px){#fn-obj{left:10px;right:10px;max-width:none;top:10px}}
  `;
  document.head.appendChild(st);
})();

function fnUi(id){
  let el = document.getElementById(id);
  if (!el){ el = document.createElement('div'); el.id = id; document.body.appendChild(el); }
  return el;
}

function fnHeatHud(){
  const el = fnUi('fn-heat');
  const lv = FN.level();
  let d = '';
  for (let i = 1; i <= 5; i++) d += i <= lv ? '<b>◆</b>' : '◇';
  el.innerHTML = 'BUREAU ATTENTION<span class="d">' + d + '</span>';
  el.classList.toggle('on', lv > 0 || FN.pending.length > 0);
  if (lv !== FN._lastLv){ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); FN._lastLv = lv; }
}
FN.heatHud = fnHeatHud;

function fnAbilityHud(){
  const el = fnUi('fn-ability');
  const c = FN_CLASSES[FN.state.cls];
  if (!c || State.ui.inIntro){ el.classList.remove('on'); return; }
  el.classList.add('on');
  el.style.setProperty('--fn-c', c.css);
  const ready = FN.abilityCd <= 0;
  el.classList.toggle('cd', !ready);
  el.innerHTML = `<b>Q</b> · ${c.ability.name} ${ready ? '· READY' : '· ' + Math.ceil(FN.abilityCd) + 's'}`;
}

// ─── Speech above heads ─────────────────────────────────────────────────────
const _v = new THREE.Vector3();
function fnBark(p, text, secs, warden){
  if (!p || !p.char && !p.group) return;
  if (FN.barks.length > 5) return;
  const c = p.char;
  if (c && c.fnb){ if (c.fnb.barkT > FN.t) return; c.fnb.barkT = FN.t + 3.5; }
  const el = document.createElement('div');
  el.className = 'fn-bark' + (warden ? ' w' : '');
  el.textContent = text;
  document.body.appendChild(el);
  FN.barks.push({ el, obj: c ? c.group : p.group, life: secs || 2, max: secs || 2 });
}
FN.bark = fnBark;
function fnBarkEnemy(e, text){ fnBark({ group: e.group }, text, 2.4, true); }

function fnTickBarks(dt){
  const cam = State.camera; if (!cam) return;
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = FN.barks.length - 1; i >= 0; i--){
    const b = FN.barks[i];
    b.life -= dt;
    if (b.life <= 0 || !b.obj){ b.el.remove(); FN.barks.splice(i, 1); continue; }
    b.obj.getWorldPosition(_v); _v.y += 2.3;
    const far = _v.distanceTo(cam.position);
    _v.project(cam);
    const vis = _v.z < 1 && far < 30 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
    b.el.style.display = vis ? 'block' : 'none';
    b.el.style.left = ((_v.x + 1) / 2 * w) + 'px';
    b.el.style.top = ((1 - _v.y) / 2 * h) + 'px';
    b.el.style.opacity = Math.min(1, b.life / 0.4);
  }
}

// ─── Street life: people talk to you ────────────────────────────────────────
const GREET = {
 any:['The forecast has been postponed. Wear something uncertain.','My bus is due last Thursday.','The clock works; the appointment does not.','I live upstairs, according to the downstairs office.','That queue is for asking which queue.','They renewed the temporary notice. Better paper this time.','I have a forwarding address. It forwards to here.','The chemist is open until someone agrees it is closed.'],
 witness:['Put me down as present. I have receipts.','You taking statements? Mine has a correction to the correction.'],
 quarry:['Your coat has brought half the quarry home.','Good boots; the ground here takes an interest.'],
 tow:['Tow 12? My parking ticket has outlived the car.','Can you move a bus that officially already arrived?'],
 clerk:['Window Three sent me to Window Three. Different emphasis.','Is a photocopy of a stamp still legally damp?'],
 broadcaster:['If you hear Ned, tell him we kept the kettle.','Am I live? I would like a second attempt.'],
 bump:['I was occupying that.','Queue starts elsewhere.','Careful with the municipal elbows.','My shopping has no insurance.','Same pavement, separate plans.'],
};

function fnStreetLife(dt){
  FN._lifeT = (FN._lifeT || 0) - dt;
  if (FN._lifeT > 0) return;
  FN._lifeT = 0.35;
  const px = Player.position.x, pz = Player.position.z;
  for (const n of State.globalNPCs){
    const c = n.char; if (!c) continue;
    const b = c.fnb;
    if (b && b.st !== 'ok') continue;
    const d = dist2(n.position.x, n.position.z, px, pz);
    if (d < 0.95){
      fnBark({ char: fnEnsure(n), pos: n.position }, pick(GREET.bump), 1.6);
      if (!c._fnBumped){ c._fnBumped = true; n.direction = Math.atan2(n.position.z - pz, n.position.x - px); }
    } else if (d < 2.6 && !c._fnGreeted && Math.random() < 0.18){
      c._fnGreeted = true;
      const pool = (FN.state.cls && Math.random() < 0.4) ? GREET[FN.state.cls] : GREET.any;
      fnBark({ char: fnEnsure(n), pos: n.position }, pick(pool), 2.2);
    } else if (d > 6) c._fnBumped = false;
  }
}
function fnEnsure(n){ fnBody({ char: n.char, kind: 'street', pos: n.position }); return n.char; }

// ─── Full-screen cards: a choice, or the class ──────────────────────────────
function fnCardOpen(html){
  const el = fnUi('fn-card');
  el.innerHTML = '<div class="in">' + html + '</div>';
  el.classList.add('on');
  State.ui.paused = true;
  safe(() => document.exitPointerLock());
  document.body.style.cursor = 'auto';
  return el;
}
function fnCardClose(){
  const el = fnUi('fn-card');
  el.classList.remove('on');
  State.ui.paused = false;
  document.body.style.cursor = 'none';
}

//  A decision. Options carry the classes they point at.
function fnChoice(id, kick, title, body, options, then){
  const el = fnCardOpen(`<p class="kick">${esc(kick)}</p><h1>${esc(title)}</h1><p class="div">◆ ◆ ◆</p>
    <p class="body">${esc(body)}</p><div class="fn-opts">` +
    options.map((o, i) => `<button class="fn-opt" data-i="${i}">${esc(o.label)}<small>${esc(o.note)}</small></button>`).join('') + '</div>');
  let chosen=false;
  el.querySelectorAll('.fn-opt').forEach(btn => btn.onclick = () => {
    if(chosen)return;chosen=true;
    const o = options[+btn.dataset.i];
    FN.state.choices[id] = o.id;
    for (const k of (o.cls || [])) FN.state.aff = Object.assign(FN.state.aff || {}, { [k]: ((FN.state.aff || {})[k] || 0) + 1 });
    if (o.standing) FN.state.standing += o.standing;
    fnCardClose();
    fnSave();
    if (then) then(o.id);
  });
  { const b = el.querySelector('.fn-opt'); if (b) b.focus(); }
}
FN.choice = fnChoice;

function fnRecommended(){
  const aff = FN.state.aff || {};
  let best = 'witness', v = -1;
  for (const k of FN_CLASS_ORDER) if ((aff[k] || 0) > v){ v = aff[k] || 0; best = k; }
  return best;
}

//  The class card. Used at the end of the prologue and for free roam.
function fnClassCard(kick, title, body, then){
  const rec = fnRecommended();
  const cards = FN_CLASS_ORDER.map(k => {
    const c = FN_CLASSES[k];
    const kit = [1, 2, 3].map(s => c.kit[s] ? FN_WEAPONS[c.kit[s]].name.toLowerCase() : null).filter(Boolean).join(', ');
    return `<button class="fn-cls${k === rec ? ' rec' : ''}" data-k="${k}" style="--c:${c.css}">
      ${k === rec ? '<span class="rec-tag">WHO YOU WERE</span>' : ''}
      <h3>${esc(c.name)}</h3><p class="who">${esc(c.who)}</p><p>${esc(c.desc)}</p>
      <dl><dt>HEALTH</dt><dd>${c.hp}</dd><dt>SPEED</dt><dd>${c.walkSpeed} / ${c.sprintSpeed}</dd>
      <dt>DAMAGE</dt><dd>×${c.damageMult.toFixed(2)}</dd><dt>KIT</dt><dd>${esc(kit)}</dd></dl>
      <div class="ab"><b>Q · ${esc(c.ability.name)}</b><br>${esc(c.ability.desc)}</div></button>`;
  }).join('');
  const el = fnCardOpen(`<p class="kick">${esc(kick)}</p><h1>${esc(title)}</h1><p class="div">◆ ◆ ◆</p>
    <p class="body">${esc(body)}</p><div class="fn-classes">${cards}</div>`);
  let chosen=false;
  el.querySelectorAll('.fn-cls').forEach(btn => btn.onclick = () => {
    if(chosen)return;chosen=true;
    const k = btn.dataset.k;
    Player.classKey = k;
    applyClass(k);
    State.classChosen = true;
    fnCardClose();
    fnSave();
    if (then) then(k);
  });
  { const b = el.querySelector('.fn-cls.rec'); if (b) b.focus(); }
}
FN.classCard = fnClassCard;

//  Free roam and the daily shift still ask for a class; they now ask with
//  this card instead of the old three.
window.openClassSelect = function(cb){
  fnClassCard('Before the city', 'Who are you here?', 'Five roles, each from someone already in the story. Pick one; you can find other weapons on the street.', () => {
    if (cb) cb();
  });
};

// =============================================================================
//  ABILITIES (Q)
// =============================================================================
function fnThreats(r){
  const px = Player.position.x, pz = Player.position.z, out = [];
  for (const e of State.enemies){
    if (e._fnProxy || e.state === 'dead') continue;
    if (e.type === 'warden' && FN.level() === 0) continue;
    const d = dist2(e.position.x, e.position.z, px, pz);
    if (d <= r) out.push({ e, d });
  }
  return out.sort((a, b) => a.d - b.d);
}

const ABILITIES = {
  witness(){
    const px = Player.position.x, pz = Player.position.z;
    for (const p of fnPeople()) if (dist2(p.pos.x, p.pos.z, px, pz) < 45) fnMark(p.char.group, 0xf4bb3d, 2.3);
    for (const { e } of fnThreats(45)) fnMark(e.group, 0xff5268, e.flying ? 0.8 : 2.4);
    toast('Everyone within 45 m, for eight seconds.', 'info');
    return true;
  },
  break(){
    const px = Player.position.x, pz = Player.position.z;
    safe(() => shShake(0.7));
    safe(() => shBurst(px, Player.position.y - Player.height + 0.2, pz, { count: 26, color: 0x8b7d6b, size: 0.12, speed: 6, life: 0.6, grav: 14 }));
    safe(() => shTone({ noise: true, filter: 'lowpass', ff0: 400, ff1: 80, q: 1, gain: 0.35, dur: 0.5 }));
    for (const { e } of fnThreats(4.5)){
      e.takeDamage(60 * (Player.damageMult || 1), false);
      const a = Math.atan2(e.position.z - pz, e.position.x - px);
      if (e.state !== 'dead') for (let i = 0; i < 6; i++) e.tryMove(Math.cos(a) * 0.5, Math.sin(a) * 0.5);
      fnGroundEnemy(e);
      e.fnFrozen = 0.8;
    }
    for (const p of fnPeople()) if (dist2(p.pos.x, p.pos.z, px, pz) < 4.5) fnHurt(p, 30, false, px, pz);
    return true;
  },
  hook(){
    const t = fnThreats(18).filter(x => !x.e.flying)[0];
    if (!t){ toast('Nothing in reach to hook.', 'info'); return false; }
    const e = t.e, px = Player.position.x, pz = Player.position.z;
    const a = Math.atan2(e.position.z - pz, e.position.x - px);
    const tx = px + Math.cos(a) * 1.6, tz = pz + Math.sin(a) * 1.6;
    const steps = 30;
    for (let i = 0; i < steps; i++) e.tryMove((tx - e.position.x) / (steps - i), (tz - e.position.z) / (steps - i));
    fnGroundEnemy(e);
    e.fnFrozen = 1.6;
    safe(() => shTracer(Player.position.clone(), V3(e.position.x, e.position.y + 1.2, e.position.z), 0xffd47a));
    safe(() => shTone({ type: 'sawtooth', f0: 180, f1: 90, gain: 0.14, dur: 0.3 }));
    return true;
  },
  stamp(){
    const list = fnThreats(25);
    for (const { e } of list){ e.fnFrozen = 5; fnMark(e.group, 0x9aa2bb, e.flying ? 0.8 : 2.4, 5); }
    safe(() => shTone({ type: 'square', f0: 220, f1: 110, gain: 0.2, dur: 0.12 }));
    toast(list.length ? `Stop order filed. ${list.length} held for five seconds.` : 'Stop order filed. Nobody to hold.', 'info');
    return true;
  },
  correction(){
    const px = Player.position.x, pz = Player.position.z;
    for (const n of State.globalNPCs){
      const b = n.char && n.char.fnb;
      if (b && (b.st === 'flee' || b.st === 'fight') && dist2(n.position.x, n.position.z, px, pz) < 30) b.st = 'ok';
    }
    FN.pending.length = 0;
    if (FN.heat > 0){ FN.heat = Math.max(0, FN.heat - 1); fnHeatHud(); if (FN.level() === 0) fnCallOff(); }
    for (const { e } of fnThreats(15)){
      e.fnFrozen = 2.5;
      const a = Math.atan2(e.position.z - pz, e.position.x - px);
      for (let i = 0; i < 4; i++) e.tryMove(Math.cos(a) * 0.5, Math.sin(a) * 0.5);
      fnGroundEnemy(e);
    }
    safe(() => shTone({ type: 'sine', f0: 880, f1: 1760, gain: 0.14, dur: 0.5 }));
    toast('Correction broadcast. The street hears the same sentence, for once.', 'success');
    return true;
  },
};

function fnMark(obj, color, h, secs){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }));
  s.scale.set(0.35, 0.35, 1); s.position.y = h; s.renderOrder = 950;
  obj.add(s);
  FN.markers.push({ s, obj, life: secs || 8 });
}
function fnTickMarkers(dt){
  for (let i = FN.markers.length - 1; i >= 0; i--){
    const m = FN.markers[i];
    m.life -= dt;
    m.s.visible = true;   // the intro's sprite sweep would hide them otherwise
    if (m.life <= 0){ if (m.s.parent) m.s.parent.remove(m.s); FN.markers.splice(i, 1); }
  }
}

function fnUseAbility(){
  const c = FN_CLASSES[FN.state.cls];
  if (!c || FN.abilityCd > 0 || State.ui.paused || Player.hp <= 0 || Player.mode !== 'walk') return;
  if (ABILITIES[c.ability.key]()) FN.abilityCd = c.ability.cd;
}

// =============================================================================
//  KEYS
// =============================================================================
document.addEventListener('keydown', e => {
  if (e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (State.ui.paused || State.ui.inDialogue || State.ui.inShiftPanel || State.ui.inMiniGame || State.ui.inInventory || State.ui.inIntro) return;
  if (e.code === 'KeyQ'){ fnUseAbility(); }
  if (e.code === 'KeyR' && FN._nearPickup && Player.mode === 'walk'){ fnTakePickup(FN._nearPickup); }
});

// =============================================================================
//  SAVES ; the state rides inside the campaign record
// =============================================================================
function fnSave(){
  FN.state.heat = FN.heat;
  safe(() => { Campaign.choices['fn.state'] = JSON.stringify(Object.assign({}, FN.state, { ammo: Player.ammo })); });
}
FN.save = fnSave;
function fnLoadFrom(choices){
  const raw = choices && choices['fn.state'];
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    FN.state = Object.assign(fnFreshState(), s);
    FN.heat = s.heat || 0;
    if (s.ammo) Object.assign(Player.ammo, s.ammo);
    fnApplyLoadout();
    fnHeatHud();
    return true;
  } catch (e){ return false; }
}

const _slotSave = shSlotSave;
window.shSlotSave = function(){ fnSave(); return _slotSave.apply(this, arguments); };

const _slotRestore = shSlotRestore;
window.shSlotRestore = async function(){
  FN.pickups.forEach(p => p.mesh && p.mesh.parent && p.mesh.parent.remove(p.mesh));
  FN.pickups.length = 0; FN.seeded.clear(); FN.pending.length = 0;
  fnEndPrologueWorld();
  const r = await _slotRestore.apply(this, arguments);
  if (!fnLoadFrom(Campaign.choices)){
    //  A save from before 0.36: the old class keeps its old kit.
    FN.state = fnFreshState(); FN.heat = 0;
    if (FN_CLASSES[Player.classKey]) fnSetKit(Player.classKey); else FN.state.cls = null;
  }
  fnHeatHud();
  return r;
};

const _slotNew = shSlotNew;
window.shSlotNew = async function(mode){
  FN.state = fnFreshState(); FN.heat = 0; FN.pending.length = 0;
  FN.pickups.forEach(p => p.mesh && p.mesh.parent && p.mesh.parent.remove(p.mesh));
  FN.pickups.length = 0; FN.seeded.clear();
  const r = await _slotNew.apply(this, arguments);
  if (FN_CLASSES[Player.classKey] && mode !== 'campaign') fnSetKit(Player.classKey);
  fnHeatHud();
  return r;
};

//  shCampaignStart(true) clears the choices record. The first night is not
//  part of the case, so it is put back.
const _campStart = shCampaignStart;
window.shCampaignStart = function(){
  const r = _campStart.apply(this, arguments);
  fnSave();
  return r;
};

//  The first movement opens with a line that knows who you were.
const OPENERS = {
 witness:'I kept every account from that night. The folder agrees with itself only about the date.',
 quarry:'The keeper still uses the door I held shut. We have an understanding about hinges.',
 tow:'I spent that night finding people somewhere to sit. A year later, the seats have become addresses.',
 clerk:'My name is right on the first page. I try to think of that as a foundation.',
 broadcaster:'I gave the corner a statement that night. They are still sending amendments.',
};

const _campIntro = shCampaignIntro;
window.shCampaignIntro = function(ch){
  const lines = _campIntro.apply(this, arguments);
  if (ch && ch.id === 'evening' && FN.state.cls && OPENERS[FN.state.cls] && FN.state.prologueDone)
    return [{ who: 'self', text: OPENERS[FN.state.cls] }].concat(lines);
  return lines;
};

// =============================================================================
//  THE FRAME ; one tick, after the world has streamed
// =============================================================================
const _afterChunks = shAfterChunks;
window.shAfterChunks = function(){
  const r = _afterChunks.apply(this, arguments);
  const now = performance.now();
  const dt = Math.min(0.05, FN._last ? (now - FN._last) / 1000 : 0.016);
  FN._last = now;
  FN.t += dt;
  safe(() => fnFrame(dt));
  return r;
};
function fnFrame(dt){
  if (FN.abilityCd > 0) FN.abilityCd -= dt;
  FN._seedT = (FN._seedT || 0) - dt;
  if (FN._seedT <= 0){ FN._seedT = 0.6; fnSeedChunks(); }
  fnTickPickups(dt);
  fnTickHeat(dt);
  fnPoseOthers(dt);
  fnStreetLife(dt);
  fnTickMarkers(dt);
  fnAbilityHud();
  if (FN.prologue) FN.prologue.tick(dt);
}
//  Speech keeps its place on screen even while the sim holds for dialogue.
(function barkLoop(){
  let last = performance.now();
  const step = () => {
    const now = performance.now();
    safe(() => fnTickBarks(Math.min(0.1, (now - last) / 1000)));
    last = now;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
})();

// =============================================================================
//  6 · THE MINUTE ; the playable prologue
// -----------------------------------------------------------------------------
//  One year before the case, at the Civic Core. Five beats, one marker each.
//  It replaces the opening film for a new story; the film's code is untouched.
// =============================================================================
Object.assign(SPEAKERS, {
  stranger_a: { name: 'A WOMAN WITH SHOPPING', role: 'Crossroads witness', skin: '#e8b48c', hair: '#4d2f22', coat: '#2f6f8a', accent: '#f4bb3d', feature: 'none', tint: '#2cb8c7' },
  stranger_b: { name: 'A MAN IN A SUIT', role: 'Crossroads witness', skin: '#9b6248', hair: '#17130f', coat: '#2a2f3a', accent: '#9aa2bb', feature: 'none', tint: '#9aa2bb' },
  stranger_c: { name: 'A BOY ON A BIKE', role: 'Crossroads witness', skin: '#c98f6b', hair: '#6b4326', coat: '#ff8a3c', accent: '#ffd166', feature: 'cap', tint: '#ff8a3c' },
  keeper:     { name: 'THE ARMOURY KEEPER', role: 'Armoury shopkeeper', skin: '#b07a55', hair: '#d8d1c3', coat: '#454b52', accent: '#ffd47a', feature: 'specs', tint: '#ffd47a' },
  warden:     { name: 'COMPLIANCE WARDEN', role: 'BUREAU OF NARRATIVE MITIGATION', skin: '#dca17d', hair: '#2a1d19', coat: '#4a4f63', accent: '#9aa2bb', feature: 'cap', tint: '#9aa2bb' },
});

const P_SPOTS = {
  start: [9, 5], screen: [-2.6, -7.5], strangers: [[-0.5, -6], [-4.8, -6.4], [-2.2, -4.2]],
  crowbar: [-5.2, -2.4], revolver: [-7.8, 3.2], loot: [[-9.4, -1.2], [-10.6, 0.8], [-8.6, 1.4]],
  keeper: [-10.2, -4.2], armoury: [-11, -2.6], wardens: [[5.6, -8], [7.2, -7.6]],
};

function fnSpot(x, z, h){ return shFindOpenSpot(x, z, 0.38, h || 1.8, 14); }
function fnExtra(x, z, rngSeed, cfg){
  const s = fnSpot(x, z); if (!s) return null;
  const rng = new RNG('fnx:' + rngSeed);
  const c = shBuildCharacter(shPickArchetype(rng), rng, Object.assign({}, shNightDressing(rng, 18), cfg || {}));
  c.group.position.set(s.x, s.y, s.z); c.baseY = s.y;
  if (c.plate) c.plate.visible = false;
  State.scene.add(c.group);
  const x0 = { char: c, x: s.x, z: s.z };
  FN.prologue.extras.push(x0);
  fnBody({ char: c, kind: 'extra', pos: c.group.position, protect: true });
  return x0;
}
function fnSpawnAt(type, x, z){
  const def = ENEMY_TYPES[type];
  const s = shFindOpenSpot(x, z, 0.55, (def && def.height) || 1.8, 14); if (!s) return null;
  const e = new Enemy(type, s.x, s.z, new RNG('fnp:' + type + ':' + x + ':' + z));
  e.position.y = s.y; e.group.position.set(s.x, s.y, s.z);
  e.fnPrologue = true;
  State.scene.add(e.group); State.enemies.push(e);
  FN.prologue.foes.push(e);
  return e;
}

function fnObjective(kick, text){
  const el = fnUi('fn-obj');
  el.innerHTML = `<span class="k">${esc(kick)}</span>${esc(text)}<br><button type="button" id="fn-skip">Skip the prologue</button>`;
  el.classList.add('on');
  const b = document.getElementById('fn-skip');
  if (b) b.onclick = () => fnPrologueSkip();
}

let fnMarker = null;
function fnMarkerAt(x, z, y){
  if (!fnMarker){
    fnMarker = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.15, 6),
      new THREE.MeshBasicMaterial({ color: 0xf4bb3d, transparent: true, opacity: 0.85, depthTest: false }));
    fnMarker.rotation.z = Math.PI; fnMarker.renderOrder = 900;
  }
  if (fnMarker.parent !== State.scene) State.scene.add(fnMarker);
  if (x == null){ fnMarker.visible = false; return; }
  fnMarker.visible = dist2(x, z, Player.position.x, Player.position.z) > 2;
  fnMarker.position.set(x, (y || 1) + 3.2 + Math.sin(performance.now() / 350) * 0.2, z);
}

function fnFracture(){
  const f = fnUi('fn-flash');
  f.classList.add('on');
  setTimeout(() => f.classList.remove('on'), 90);
  safe(() => shShake(1));
  safe(() => shTone({ type: 'sine', f0: 55, f1: 38, gain: 0.3, dur: 3.2 }));
  safe(() => shTone({ type: 'sawtooth', f0: 1760, f1: 220, gain: 0.07, dur: 1.4 }));
  const cv = State.renderer && State.renderer.domElement;
  if (cv){
    cv.style.transition = 'filter 0s';
    cv.style.filter = 'hue-rotate(-38deg) saturate(1.7) contrast(1.25)';
    setTimeout(() => { cv.style.transition = 'filter 6s ease'; cv.style.filter = ''; }, 400);
  }
}

// Scene speech owns its own queue. Campaign silence cannot consume these lines.
// Ambient speech is discarded during the Minute, never deferred into the case.
for(const name of ['shNarrate','shSay','shNedSay','toast']){
  const original=window[name];
  if(original)window[name]=function(){if(FN.prologue)return false;return original.apply(this,arguments);};
}
const sceneStyle=document.createElement('style');
sceneStyle.textContent=`
 #fn-scene{display:none;position:fixed;inset:0;z-index:8500;background:rgba(10,18,26,.22);align-items:flex-end;justify-content:center;cursor:auto}
 #fn-scene.on{display:flex}#fn-scene .scene-box{width:min(780px,90vw);margin:0 0 9vh;padding:24px 28px;background:#141e29;border:1px solid #647586;border-left:4px solid #f4bb3d;color:#e2ddd1;box-shadow:0 16px 60px #0008}
 #fn-scene .where{font:12px/1.5 monospace;letter-spacing:.1em;color:#9aa2bb}
 #fn-scene .who{font:600 15px/1.6 sans-serif;margin:10px 0}#fn-scene .role{font-weight:400;color:#9aa2bb}
 #fn-scene .line{font:22px/1.5 Georgia,serif;margin:12px 0 20px}#fn-scene .next{font:14px/1.6 sans-serif;color:#e2ddd1}
 #fn-scene button{background:#f4bb3d;color:#141e29;padding:12px 18px;border:0;margin-top:16px;font:700 15px/1.4 sans-serif;cursor:pointer;animation:fn-read-pulse 1.7s ease-in-out infinite}
 #fn-scene button:focus-visible{outline:3px solid #e2ddd1;outline-offset:4px}
 @keyframes fn-read-pulse{50%{box-shadow:0 0 0 5px #f4bb3d30}}
 @media(prefers-reduced-motion:reduce){#fn-scene button{animation:none}}
 body.fn-prologue #narr,body.fn-prologue #toast-container,body.fn-prologue #lock-instruction{display:none!important}
`;
document.head.appendChild(sceneStyle);
function fnSay(lines,then){
  const P=FN.prologue;if(!P)return;
  const scene=FN.scene={lines:lines.slice(),index:0,owner:P,beat:P.index,then,closed:false};
  const el=fnUi('fn-scene');
  State.keys.clear();State.ui.paused=true;State.ui.inDialogue=true;
  safe(()=>document.exitPointerLock());document.body.style.cursor='auto';
  const render=()=>{
    const l=scene.lines[scene.index],s=SPEAKERS[l.who]||SPEAKERS.self;
    const role=l.who==='self'?'Civic Core resident':l.who==='ned'?'FCN evening anchor':s.role;
    el.innerHTML=`<div class="scene-box" role="dialog" aria-modal="true" aria-label="The Minute"><div class="where">${esc(P.where)}</div><div class="who">${esc(l.who==='self'?'YOU':s.name)} <span class="role">· ${esc(role)}</span></div><p class="line">${esc(l.text)}</p><div class="next">Next: ${esc(P.objective)}</div><button id="fn-scene-next">N / click to continue <small>(${scene.index+1}/${scene.lines.length})</small></button></div>`;
    el.classList.add('on');el.querySelector('button').onclick=advance;el.querySelector('button').focus();
  };
  function advance(){
    if(scene.closed||FN.scene!==scene||FN.prologue!==P||P.index!==scene.beat)return;
    if(++scene.index<scene.lines.length){render();return;}
    scene.closed=true;FN.scene=null;el.classList.remove('on');
    State.keys.clear();State.ui.paused=false;State.ui.inDialogue=false;
    document.body.style.cursor='none';if(then)then();
  }
  scene.advance=advance;render();
}
document.addEventListener('keydown',e=>{
  if(!FN.scene)return;
  // Capture before old narration and world handlers see the same input.
  e.stopImmediatePropagation();
  if(e.key==='Tab'){e.preventDefault();document.getElementById('fn-scene-next').focus();}
  if(e.code==='KeyN'||e.key==='n'||e.key==='N'){e.preventDefault();if(!e.repeat)FN.scene.advance();}
},true);
// The backdrop swallows attacks; the actual Continue button still gets clicks.
for(const type of ['mousedown','pointerdown','mouseup'])document.addEventListener(type,e=>{
  if(FN.scene && !(e.target.closest&&e.target.closest('#fn-scene-next'))){e.stopImmediatePropagation();e.preventDefault();}
},true);


function fnPrologueBegin(){
  closeMenu();
  shCampaignSilence();
  document.body.classList.add('fn-prologue');
  FN.prologue = {
    step: 'wait', clock: 17 * 60 + 56, extras: [], foes: [], escorts: [], t: 0, index: -1, entered: new Set(),
    target: null, onTake: null,
    tick: fnPrologueTick,
  };
  FN.prologueBlocksSpawns = true;
  FN.state.inPrologue = true;
  _applyClass('witness');                 // stats only; the kit comes at the end
  FN.state.cls = null;
  FN.state.loadout = { 1: 'fists', 2: null, 3: null };
  Player.ammo.pistol = 0; Player.ammo.shotgun = 0;
  Player.currentWeapon = 'baton';
  fnApplyLoadout();
  fnSave();
}
FN.beginPrologue = fnPrologueBegin;

function fnPrologueTick(dt){
  const P = FN.prologue;
  P.t += dt;
  State.dayTime = P.clock;
  if (P.clockRun) P.clock = Math.min(P.clockTo, P.clock + dt / 20);
  for (const x of P.extras){
    const b = x.char.fnb;
    if (b && b.st !== 'ok') continue;
    shAnimateCharacter(x.char, dt, false, performance.now() * 0.001);
    x.char.group.rotation.order = 'YXZ';
    x.char.group.rotation.y = Math.atan2(Player.position.x - x.char.group.position.x, Player.position.z - x.char.group.position.z);
  }
  //  Escorting Wardens walk to you and stop at a polite distance.
  for (const e of P.escorts){
    if (e.state === 'dead') continue;
    const dx = Player.position.x - e.position.x, dz = Player.position.z - e.position.z, d = Math.hypot(dx, dz);
    e.direction = Math.atan2(dz, dx);
    if (d > 3){ const s = e.def.speed * 0.6 * dt; e.tryMove(dx / d * s, dz / d * s); }
    fnGroundEnemy(e);
  }
  const t = P.target;
  if (t && typeof t === 'function'){ const p = t(); if (p) fnMarkerAt(p.x, p.z, p.y); else fnMarkerAt(null); }
  else if (t) fnMarkerAt(t[0], t[1], 1); else fnMarkerAt(null);
  if (P.check) P.check(dt);
}

//  The world has to exist under you before you can be put in it.
function fnPrologueWaitForGround(){
  const P = FN.prologue; if (!P) return;
  // Pause only after the crossroads is visible, not merely after its voxels
  // exist. A held scene cannot rely on later simulation frames to stream it.
  if(!P.primed && State.chunkMap.size){
    for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)shBuildChunk(x+','+z);
    for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){
      const c=State.chunkMap.get(x+','+z);if(c)c.rebuildDirtySections();
    }
    P.primed=true;
  }
  const s = fnSpot(P_SPOTS.start[0], P_SPOTS.start[1]);
  if (!s || !State.chunkMap.size){ P.check=fnPrologueWaitForGround; return; }
  P.check=null;
  Player.position.set(s.x, s.y + Player.height, s.z);
  Player.velocity.set(0, 0, 0);
  Player.yaw = Math.atan2(s.x - P_SPOTS.screen[0], s.z - P_SPOTS.screen[1]);
  Player.pitch = 0;
  State.camera.position.copy(Player.position);
  State.camera.rotation.set(Player.pitch,Player.yaw,0,'YXZ');
  fnBeat1();
}

function fnPrologueCard(kick, title, body, then){
  const el = fnCardOpen(`<p class="kick">${esc(kick)}</p><h1>${esc(title)}</h1><p class="div">◆ ◆ ◆</p>
    <p class="body">${esc(body)}</p><div class="fn-opts"><button class="fn-opt" id="fn-go">Continue<small>Click, or press Enter</small></button></div>`);
  let continued=false;
  const go = () => { if(continued)return;continued=true; document.removeEventListener('keydown', key); fnCardClose(); then && then(); };
  const key = e => { if (e.key === 'Enter'){ e.preventDefault(); go(); } };
  document.addEventListener('keydown', key);
  el.querySelector('#fn-go').onclick = go;
  { const b = el.querySelector('#fn-go'); if (b) b.focus(); }
}

// Ordered scene/action steps. Each step enters once and exits only on its
// condition; callbacks may mark completion but never jump to another beat.
function fnSequenceEnter(index){
  const P=FN.prologue,beat=FN_BEATS[index];
  if(!P||!beat||P.entered.has(beat.id))return;
  P.entered.add(beat.id);P.index=index;P.step=beat.step;P.ready=false;P.target=null;P.check=null;
  P.clock=beat.clock;P.clockRun=false;P.where=beat.where;P.objective=beat.objective;
  State.dayTime=P.clock;updateDayNight(0);
  const district=document.getElementById('hud-district');if(district)district.textContent=beat.id==='year'?'RESIDENCE 14':'CIVIC CORE';
  const clock=document.getElementById('hud-clock');if(clock)clock.textContent=String(Math.floor(P.clock/60)).padStart(2,'0')+':'+String(P.clock%60).padStart(2,'0');
  fnObjective(P.where,P.objective);
  const done=()=>{if(FN.prologue===P&&P.index===index)P.ready=true;};
  beat.enter(P,done);
  P.check=()=>{
    if(FN.prologue!==P||P.index!==index||FN.scene||State.ui.paused)return;
    if(beat.exit?beat.exit(P):P.ready){P.check=null;fnSequenceEnter(index+1);}
  };
}
function fnBeat1(){fnSequenceEnter(0);}
const FN_BEATS=[
 {id:'arrival',step:'walk',clock:1076,where:'17:56 · CIVIC CORE · ONE YEAR BEFORE THE CASE',
  objective:'Walk to the FCN screen beneath the tower. Follow the gold marker.',
  enter(P,done){
   fnPrologueCard('Civic Core · 17:56','The Minute','Two minutes before the bulletin, the city is keeping its usual appointment. Nobody has brought an overnight bag.',()=>fnSay([
    {who:'ned',text:'Good evening from FCN. Your six o’clock bulletin is almost ready.'},
    {who:'self',text:'Dad used to turn this up in the kitchen. I still reach for the volume.'},
    {who:'ned',text:'While we wait, the clock above the chemist is correct again. Please enjoy it responsibly.'},
   ],()=>{P.target=P_SPOTS.screen;done();}));
  },exit:P=>P.ready&&dist2(Player.position.x,Player.position.z,...P_SPOTS.screen)<4.2},
 {id:'fracture',step:'fracture',clock:1078,where:'17:58 · CIVIC CORE · FCN CROSSROADS',
  objective:'Listen to the three witnesses, then choose what you do first.',
  enter(P,done){
   const fx=-Math.sin(Player.yaw),fz=-Math.cos(Player.yaw);
   [-.9,0,.9].forEach((off,i)=>{const a=Math.atan2(fz,fx)+off,r=i===1?4.2:3.4;fnExtra(Player.position.x+Math.cos(a)*r,Player.position.z+Math.sin(a)*r,'stranger'+i,{coat:[0x586e79,0x2a2f3a,0x99775c][i]});});
   fnFracture();
   fnSay([
    {who:'ned',text:'It is 17:58. Before the headlines, a brief message for everyone watching.'},
    {who:'stranger_a',text:'He said the replacement bus has been replaced. I was on the first replacement.'},
    {who:'stranger_b',text:'He said my brother is waiting downstairs. We buried him in February.'},
    {who:'stranger_c',text:'He said this bicycle belongs to the council. They can start with the puncture.'},
    {who:'self',text:'One sentence on every screen. Three people beside me, and none of us heard the same thing.'},
    {who:'ned',text:'...back after a short break.'},
    {who:'stranger_a',text:'That bit was the same. I would like the bus bit checked.'},
   ],()=>fnChoice('first','17:58 · CIVIC CORE','Your first second','The carrier tone stays on; the people stay too. Choose what you can be useful for.',[
    {id:'hold',label:'Offer a hand, without a theory.',note:'The shopping can look after itself.',cls:['witness','broadcaster']},
    {id:'write',label:'Write it down before the corrections.',note:'For once, being early might help.',cls:['clerk','witness']},
    {id:'wall',label:'Trust the wall with your back.',note:'Its account has been consistent so far.',cls:['quarry']},
    {id:'run',label:'Find a vehicle with spare seats.',note:'A practical response to an impractical bulletin.',cls:['tow']},
   ],id=>fnSay([{who:'self',text:{
    hold:'She takes my hand. The bag splits and neither of us looks down.',
    write:'I put the time at the top. It is the last thing on the page I can verify.',
    wall:'The wall holds my weight. I decide that counts as agreement.',
    run:'The tow yard is three streets away. The shutters come down before the second.',
   }[id]}],done)));
  }},
 {id:'crowbar',step:'break',clock:1079,where:'17:59 · CIVIC CORE · ARMOURY GUTTER',
  objective:'Take the crowbar at the gold marker. Stand over it and press R.',
  enter(P,done){
   fnEndExtras();
   const k=fnExtra(...P_SPOTS.keeper,'keeper',{coat:0x454b52,headgear:'none'});
   if(k){P.keeperChar=k.char;const b=k.char.fnb;b.st='down';b.t=9999;b.lx=k.x;b.lz=k.z;fnPoseDown(k.char,0);}
   P_SPOTS.loot.forEach(([x,z])=>{const e=fnSpawnAt('thug',x,z);if(e){e.state='patrol';e.hp=e.maxHp=40;}});
   for(const [wid,spot] of [['crowbar',P_SPOTS.crowbar],['revolver',P_SPOTS.revolver]]){const s=fnSpot(...spot,1.2);if(s)fnDropWeapon(wid,s.x,s.y,s.z,{pid:'p:'+wid,ammo:12});}
   fnSay([
    {who:'keeper',text:'They say the bulletin made everything free. Somehow that includes my knees.'},
    {who:'self',text:'Can you stand?'},
    {who:'keeper',text:'Not yet. I would appreciate someone staying.'},
    {who:'keeper',text:'There is a crowbar in the gutter. Take it before someone applies the new price.'},
   ],()=>{P.target=()=>{const p=FN.pickups.find(q=>q.id==='p:crowbar');return p?{x:p.x,y:p.y,z:p.z}:null;};done();});
  },exit:P=>P.ready&&FN.state.loadout[1]==='crowbar'},
 {id:'looters',step:'break',clock:1079,where:'17:59 · CIVIC CORE · ARMOURY DOOR',
  objective:'Drive off the looters. Face them and click to swing; the revolver nearby is optional.',
  enter(P){P.target=P_SPOTS.armoury;for(const e of P.foes)if(e.state!=='dead'){e.state='alert';e.lastSeenPlayerPos=Player.position.clone();}},
  exit:P=>P.foes.filter(e=>e.state!=='dead'&&!e.fnLeave).length<=1},
 {id:'keeper-approach',step:'break',clock:1081,where:'18:01 · CIVIC CORE · ARMOURY DOOR',
  objective:'Go to the keeper at the gold marker.',
  enter(P){
   for(const e of P.foes)if(e.state!=='dead'){e.fnLeave=true;e.state='patrol';e.attackTimer=999;fnBarkEnemy(e,'Keep it. The warranty sounded complicated.');}
   const kb=P.keeperChar&&P.keeperChar.fnb;if(kb){kb.st='ok';kb.hp=kb.max;fnPoseUp(P.keeperChar);P.keeperChar.group.position.y=P.keeperChar.baseY;}
   P.target=P.keeperChar?()=>({x:P.keeperChar.group.position.x,z:P.keeperChar.group.position.z}):null;
  },exit:P=>!P.keeperChar||dist2(P.keeperChar.group.position.x,P.keeperChar.group.position.z,Player.position.x,Player.position.z)<3.2},
 {id:'keeper-choice',step:'break',clock:1082,where:'18:02 · CIVIC CORE · ARMOURY DOOR',
  objective:'Choose how to help the keeper and the people waiting outside.',
  enter(P,done){
   fnSay([
    {who:'keeper',text:'You stayed. I thought everyone had decided I was furniture.'},
    {who:'self',text:'The furniture had a harder time.'},
    {who:'keeper',text:'Twelve people saw it happen. So far I have been robbed, rescued and promoted.'},
   ],()=>fnChoice('keeper','18:02 · THE ARMOURY','What needs doing?','The keeper can stand now; the door cannot. The people outside are waiting for someone to begin.',[
    {id:'pull',label:'Be the replacement door.',note:'No qualifications, broad shoulders.',cls:['quarry','tow']},
    {id:'count',label:'Ask for all twelve accounts.',note:'Bring enough paper to be wrong twelve ways.',cls:['witness']},
    {id:'say',label:'Give the corner a public statement.',note:'Attendance includes a corrections department.',cls:['broadcaster']},
    {id:'log',label:'File a report while the shop still has an address.',note:'The Bureau will appreciate the order of events.',cls:['clerk'],standing:1},
   ],id=>fnSay([
    {who:'self',text:{pull:'The keeper sits behind me. For ten minutes my job is simply to be difficult to move.',count:'Four witnesses remember me arriving twice. I leave room in the margin for the other me.',say:'Everyone listens until I say what happened. Then the meeting becomes productive.',log:'The damage fits in three boxes. The keeper does not.'}[id]},
    {who:'keeper',text:'Keep the crowbar. I have changed the price back, but you qualify for a discount.'},
   ],done)));
  }},
 {id:'wardens-approach',step:'arrangement',clock:1084,where:'18:04 · CIVIC CORE · BUREAU CROSSING',
  objective:'Meet the Wardens at the gold marker. They have come to take names.',
  enter(P){
   P.escorts=[];for(const [x,z] of P_SPOTS.wardens){const e=fnSpawnAt('warden',x,z);if(e){e.fnEscort=true;e.state='patrol';P.escorts.push(e);}}
   P.target=()=>{const e=P.escorts.find(e=>e.state!=='dead');return e?{x:e.position.x,y:e.position.y,z:e.position.z}:null;};
  },exit:P=>!P.escorts.some(e=>e.state!=='dead')||P.escorts.some(e=>e.state!=='dead'&&dist2(e.position.x,e.position.z,Player.position.x,Player.position.z)<4.5)},
 {id:'name-choice',step:'arrangement',clock:1084,where:'18:04 · CIVIC CORE · BUREAU CROSSING',
  objective:'Choose what name, if any, goes into the Bureau file.',
  enter(P,done){
   if(!P.escorts.some(e=>e.state!=='dead')){FN.state.standing-=2;fnSay([{who:'self',text:'Two Wardens down. Someone will have to tell their families before they finish telling the file.'}],done);return;}
   fnSay([
    {who:'warden',text:'Bureau of Narrative Mitigation. A temporary arrangement has applied throughout the city since 17:58.'},
    {who:'self',text:'Can I go home?'},
    {who:'warden',text:'Within the district, certainly. Departures beyond it are waiting for a definition of arrival.'},
    {who:'self',text:'My family is beyond it.'},
    {who:'warden',text:'I understand. Please give your name slowly; the carbon paper is our last sheet.'},
   ],()=>fnChoice('name','18:04 · THE BUREAU','The first entry','The Warden has left a careful space for your name. Decide what belongs there.',[
    {id:'give',label:'Give your name, including the awkward letter.',note:'At least one part of this can be accurate.',cls:['clerk'],standing:1},
    {id:'false',label:'Use a name with fewer administrative needs.',note:'Someone imaginary can receive the circulars.',cls:['broadcaster'],standing:-1},
    {id:'ask',label:'Ask for the expiry date of temporary.',note:'Leave a generous space for the answer.',cls:['witness']},
    {id:'walk',label:'Offer the back of your coat.',note:'It contains no spelling errors.',cls:['tow','quarry'],standing:-1},
   ],id=>{
    if(id==='give'&&FN.heat>0){FN.heat=0;FN.pending.length=0;fnHeatHud();}
    const replies={give:[{who:'warden',text:'Thank you for the clarification. The other spelling is already three people.'}],false:[{who:'warden',text:'A very legible name. Please continue to answer to it until we have better stationery.'}],ask:[{who:'warden',text:'The end date will appear on the permanent notice. We have ordered a temporary frame.'},{who:'self',text:'I leave the space.'}],walk:[{who:'warden',text:'Blue-grey, approximately knee-length. Thank you; the description field is compulsory.'}]};
    for(const e of P.escorts)e.fnEscort=false;fnSay(replies[id],done);
   }));
  }},
 {id:'role',step:'end',clock:1086,where:'18:06 · CIVIC CORE · THE FIRST NIGHT',
  objective:'Choose who you were that night. The marked role reflects your decisions.',
  enter(P,done){fnSay([
   {who:'self',text:'The carrier tone keeps going. I wait for Ned to breathe.'},
   {who:'keeper',text:'You can wait inside. The door position has recently become available.'},
   {who:'self',text:'For now, people still need things done.'},
  ],()=>fnClassCard('Civic Core · 18:06','Who were you that night?','Your decisions suggest the marked role; you can choose any of the five. Your starting kit comes with it.',done));}},
 {id:'year',step:'end',clock:1080,where:'ONE YEAR LATER · RESIDENCE 14 · 18:00',
  objective:'Continue to the case at Residence 14.',
  enter(P){fnPrologueFinish();}},
];
FN.beats=FN_BEATS.map(b=>({id:b.id,step:b.step}));

function fnEndExtras(filter){
  const P = FN.prologue; if (!P) return;
  P.extras = P.extras.filter(x => {
    if (filter && !filter(x)) return true;
    if (x.char.group.parent) x.char.group.parent.remove(x.char.group);
    return false;
  });
}
function fnEndPrologueWorld(){
  const P = FN.prologue;
  if (P){
    fnEndExtras();
    for (const e of P.foes.concat(P.escorts || [])){
      if (e.group && e.group.parent) e.group.parent.remove(e.group);
      const i = State.enemies.indexOf(e); if (i >= 0) State.enemies.splice(i, 1);
    }
  }
  for (let i = FN.pickups.length - 1; i >= 0; i--) if (FN.pickups[i].id.indexOf('p:') === 0) fnRemovePickup(FN.pickups[i]);
  FN.prologue = null;
  FN.prologueBlocksSpawns = false;
  document.body.classList.remove('fn-prologue');
  fnMarkerAt(null);
  const o = document.getElementById('fn-obj'); if (o) o.classList.remove('on');
}

function fnPrologueFinish(){
  FN.state.prologueDone = true; FN.state.inPrologue = false;
  //  A year passes. Nobody's file is still warm.
  FN.heat = 0; FN.pending.length = 0; fnHeatHud();
  fnPrologueCard('One year later', 'The eve of the anniversary',
    'Ned never came back; nobody has left the city, and the temporary arrangement is still in force. Tomorrow marks a year since 17:58; tonight an old recording turns on your wall.',
    () => { fnEndPrologueWorld(); shCampaignStart(true); fnSave(); });
}

function fnPrologueSkip(){
  if (!FN.prologue) return;
  const step = FN.prologue.step;
  if (step === 'end') return;
  if (FN.scene || (Dialogue && Dialogue.active)) return;
  fnMarkerAt(null);
  const o = document.getElementById('fn-obj'); if (o) o.classList.remove('on');
  fnClassCard('Skipping the Minute', 'Who were you that night?',
    'At 17:58 every screen spoke together, and everyone heard it differently. Choose the work you did after that.',
    () => fnPrologueFinish());
}

// ─── The front door: a new story starts with the Minute ────────────────────
const _frontAct = shFrontAct;
window.shFrontAct = function(act){
  if (act === 'new-campaign'){
    const run = async () => {
      await shSlotNew('campaign');
      Campaign.active = false;
      const hud = document.getElementById('campaign-hud'); if (hud) hud.classList.remove('show');
      fnPrologueBegin();
      fnPrologueWaitForGround();
    };
    if (typeof fcLoad === 'function') fcLoad('Building the Civic Core…', run); else run();
    return;
  }
  return _frontAct.apply(this, arguments);
};

//  A save made during the Minute reopens at the class card, then the case.
const _restore2 = window.shSlotRestore;
window.shSlotRestore = async function(){
  const r = await _restore2.apply(this, arguments);
  if (r !== false && FN.state.inPrologue && !FN.state.prologueDone){
    fnClassCard('The Minute', 'Who were you that night?',
      'Your record of the first night ends here. Choose your role to continue to the case.',
      () => { FN.state.prologueDone = true; FN.state.inPrologue = false; if (!Campaign.active){ shCampaignStart(true); } fnSave(); });
  }
  return r;
};

// Escorting Wardens are driven by the prologue, not by their own AI.
const _enemyUpdate2 = Enemy.prototype.update;
Enemy.prototype.update = function(dt, player){
  if (this.fnEscort && this.hp < this.maxHp){
    //  Hit a Warden who came to talk and the talking is over.
    this.fnEscort = false; this.state = 'alert'; this.attackTimer = 0.6;
    if (FN.prologue) FN.prologue.escorts.forEach(w => { w.fnEscort = false; w.state = 'alert'; w.attackTimer = 0.8; });
  }
  if (this.fnEscort){
    this.state = 'patrol'; this.attackTimer = 999;
    fnGroundEnemy(this);
    this.group.rotation.y = -this.direction + Math.PI / 2;
    if (this.fnChar) shAnimateCharacter(this.fnChar, dt, true, performance.now() * 0.001);
    return;
  }
  if (this.fnLeave && FN.prologue){
    const a = Math.atan2(this.position.z - Player.position.z, this.position.x - Player.position.x);
    this.tryMove(Math.cos(a) * this.def.speed * dt, Math.sin(a) * this.def.speed * dt);
    this.direction = a;
    fnGroundEnemy(this);
    this.group.rotation.y = -this.direction + Math.PI / 2;
    return;
  }
  return _enemyUpdate2.call(this, dt, player);
};

//  Ned's street commentary waits until the Minute is over.
if (typeof shNedSay === 'function'){
  const _ned = shNedSay;
  window.shNedSay = function(){ if (FN.prologue) return; return _ned.apply(this, arguments); };
}

const _prologueHud=shUpdateHUD;
window.shUpdateHUD=function(){
  const r=_prologueHud.apply(this,arguments);
  if(FN.prologue){
    const district=document.getElementById('hud-district');if(district)district.textContent='CIVIC CORE';
    const clock=document.getElementById('hud-clock'),m=FN.prologue.clock;
    if(clock)clock.textContent=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  }
  return r;
};

fnHeatHud();
console.log('[first-night] ' + FN.version + ' ready');
})();
