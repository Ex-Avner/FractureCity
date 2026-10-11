// =============================================================================
//  THE WILDS · nuke fields, the biowaste lake, and the outskirts
// -----------------------------------------------------------------------------
//  Two kinds of place the city does not talk about.
//
//    NUKE FIELD     scorched ground, craters with a hot core, dead trees, the
//                   ruins of the houses that were here, and now and then a
//                   cracked cooling tower. Radiation builds while you stay.
//    BIOWASTE LAKE  a lake of sludge filling a whole superblock, outfall pipes,
//                   barrels, a sunken car, an island with something on it.
//                   Standing in it burns.
//
//  Where: about one superblock in eight inside the city (never within three
//  chunks of the Civic Core), and everything past the city limit, where the
//  outskirts mix both with scrubland, wrecks and pylons.
//
//  Why go in: rare weapons and hot slag, the most valuable salvage in the game.
//
//  Existing districts are untouched. The wilds are decided by a separate roll
//  per superblock, so the rest of a saved city keeps its layout.
// =============================================================================
(function(){
'use strict';
if (typeof Chunk === 'undefined' || typeof DISTRICTS === 'undefined') return;

const W = window.Wilds = {
  version: '0.38.0',
  cityRadius: 9,      // chunks from the centre; beyond this is the outskirts
  safeRadius: 3,      // no wilds this close to the Civic Core
  inCityEvery: 8,     // one superblock in eight inside the city is wild
  rad: 0, tox: 0, here: null, seen: {},
};
const safe = f => { try { return f(); } catch (e){ console.warn('[wilds]', e); } };

// ─── Blocks ─────────────────────────────────────────────────────────────────
const B_ASH      = shDefBlock(60, { name: 'scorched earth', solid: true, emit: false, color: 0x2f2a25, grain: 0.24 });
const B_GLOW     = shDefBlock(61, { name: 'hot slag',       solid: true, emit: true,  color: 0x86ff5c, grain: 0.10 });
const B_SLUDGE   = shDefBlock(62, { name: 'biowaste',       solid: true, emit: false, color: 0x4a5220, grain: 0.20 });
const B_SCUM     = shDefBlock(63, { name: 'scum',           solid: true, emit: false, color: 0x8f9a5c, grain: 0.22 });
const B_DEADWOOD = shDefBlock(64, { name: 'dead wood',      solid: true, emit: false, color: 0x221c19, grain: 0.26 });
const B_HAZARD   = shDefBlock(65, { name: 'hazard sign',    solid: true, emit: true,  color: 0xd9ad22, grain: 0.04 });
const B_RUBBLE   = shDefBlock(66, { name: 'rubble',         solid: true, emit: false, color: 0x5b5651, grain: 0.32 });
const B_MUD      = shDefBlock(67, { name: 'shore mud',      solid: true, emit: false, color: 0x3b3323, grain: 0.20 });
const B_DRYGRASS = shDefBlock(68, { name: 'dead grass',     solid: true, emit: false, color: 0x6b6440, grain: 0.22 });
Object.assign(MATERIALS, {
  [B_ASH]:      { label: 'Scorched Earth', cls: 'organic', hardness: 0.8, drop: B_SOIL,  yield: 1, value: 1, desc: 'It was a garden. The fire took the garden and left the shape of the fence.' },
  [B_GLOW]:     { label: 'Hot Slag',       cls: 'signal',  hardness: 1.8, drop: B_GLOW,  yield: 1, value: 40, desc: 'Still warm after all these years. Worth more than anything else in the city, and it knows it.' },
  [B_SLUDGE]:   { label: 'Biowaste',       cls: 'organic', hardness: 0.4, drop: B_SLUDGE, yield: 1, value: 2, desc: 'Officially a reservoir. The paperwork has not been updated since it started bubbling.' },
  [B_SCUM]:     { label: 'Scum',           cls: 'organic', hardness: 0.3, drop: B_SOIL,  yield: 1, value: 1, desc: 'A crust that holds your weight exactly once.' },
  [B_DEADWOOD]: { label: 'Dead Wood',      cls: 'organic', hardness: 1.0, drop: B_TRUNK, yield: 1, value: 2, desc: 'Charcoal on the outside, charcoal on the inside.' },
  [B_HAZARD]:   { label: 'Hazard Sign',    cls: 'metal',   hardness: 1.2, drop: B_METAL, yield: 1, value: 4, desc: 'DANGER. The rest of the sign has been read too many times to survive.' },
  [B_RUBBLE]:   { label: 'Rubble',         cls: 'stone',   hardness: 1.4, drop: B_BRICK, yield: 1, value: 2, desc: 'Somebody’s front room, in pieces small enough to carry.' },
  [B_MUD]:      { label: 'Shore Mud',      cls: 'organic', hardness: 0.6, drop: B_SOIL,  yield: 1, value: 1, desc: 'Smells like a decision nobody wants credit for.' },
  [B_DRYGRASS]: { label: 'Dead Grass',     cls: 'organic', hardness: 0.6, drop: B_SOIL,  yield: 1, value: 1, desc: 'It stopped growing and kept standing.' },
});
W.blocks = { B_ASH, B_GLOW, B_SLUDGE, B_SCUM, B_DEADWOOD, B_HAZARD, B_RUBBLE, B_MUD, B_DRYGRASS };

// ─── Districts ──────────────────────────────────────────────────────────────
const wildBase = {
  minHeight: 0, maxHeight: 0, windowColors: [0x7dff6a], windowLitProb: 0, neonProb: 0, billboardProb: 0,
  treeProb: 0, trashProb: 0.3, graffitiProb: 0.1, ventProb: 0, cameraProb: 0, ventingSteamProb: 0, cableProb: 0, wild: true,
};
const NUKE = DISTRICTS.NUKE = Object.assign({}, wildBase, { name: 'NUKE FIELD', bgColor: 0x2b3424, accentColor: 0x86ff5c, biome: 'nuke' });
const LAKE = DISTRICTS.BIOWASTE = Object.assign({}, wildBase, { name: 'BIOWASTE LAKE', bgColor: 0x2a3320, accentColor: 0x9fb84a, biome: 'lake' });
const SCRUB = DISTRICTS.OUTSKIRTS = Object.assign({}, wildBase, { name: 'THE OUTSKIRTS', bgColor: 0x3a3428, accentColor: 0xd9ad22, biome: 'scrub' });
W.districts = { NUKE, LAKE, SCRUB };

function superOf(c){ return Math.floor((c + 1000) / 3); }
function sbHash(tag, sx, sz){ return hashStr(`${tag}:${State.citySeed || ''}:${sx}:${sz}`); }

const _district = window.districtForChunk;
window.districtForChunk = function(cx, cz){
  const r = Math.max(Math.abs(cx), Math.abs(cz));
  const sx = superOf(cx), sz = superOf(cz);
  if (r > W.cityRadius){
    const h = sbHash('out', sx, sz) % 10;
    return h < 4 ? NUKE : h < 7 ? LAKE : SCRUB;
  }
  const d = _district(cx, cz);
  if (r <= W.safeRadius) return d;
  //  Every chunk of a wild superblock must be outside the safe radius, or the
  //  superblock would be cut in half by it.
  const near = (a) => (a <= 0 && a + 2 >= 0) ? 0 : Math.min(Math.abs(a), Math.abs(a + 2));
  if (Math.max(near(sx * 3 - 1000), near(sz * 3 - 1000)) <= W.safeRadius) return d;
  if (d && d.biome === 'park') return d;
  const h = sbHash('wild', sx, sz) % (W.inCityEvery * 2);
  return h === 0 ? NUKE : h === 1 ? LAKE : d;
};

// ─── Noise ──────────────────────────────────────────────────────────────────
function h2(x, z, s){ let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z, scale, s){
  const fx = x / scale, fz = z / scale, x0 = Math.floor(fx), z0 = Math.floor(fz);
  const tx = fx - x0, tz = fz - z0, sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const a = h2(x0, z0, s), b = h2(x0 + 1, z0, s), c = h2(x0, z0 + 1, s), d = h2(x0 + 1, z0 + 1, s);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sz;
}
const SEED = () => hashStr('wild-noise:' + (State.citySeed || '')) & 0xffff;

// ─── Generation ─────────────────────────────────────────────────────────────
//  Ground top is y=2, level with the city's pavement, so you step off a kerb
//  onto it. Everything above that is what the place has instead of buildings.
const TOP = 2;

const _generate = Chunk.prototype.generate;
Chunk.prototype.generate = function(){
  const d = this.district;
  if (!d || !d.wild || (typeof SHIFT_LANDMARKS !== 'undefined' && SHIFT_LANDMARKS[this.key])) return _generate.apply(this, arguments);
  this._wild = d.biome;
  const rng = this.rng;
  safe(() => {
    if (d.biome === 'nuke') genNuke(this, rng);
    else if (d.biome === 'lake') genLake(this, rng);
    else genScrub(this, rng);
  });
};

//  A rolling floor: TOP plus a block or two of low mounds, scorched or dead.
function floor(chunk, mat, top2, speckle){
  const ox = chunk.originX, oz = chunk.originZ, s = SEED();
  chunk.stampBox(ox, 0, oz, ox + VOX_W, TOP, oz + VOX_W, B_SOIL);
  for (let x = 0; x < VOX_W; x++) for (let z = 0; z < VOX_W; z++){
    const wx = ox + x, wz = oz + z;
    const n = vnoise(wx, wz, 11, s), m = vnoise(wx, wz, 4, s + 7);
    const lift = n > 0.72 ? 1 : 0;
    const surf = m > 0.62 && top2 ? top2 : mat;
    chunk.vSet(x, TOP - 1, z, surf);
    if (lift) chunk.vSet(x, TOP, z, surf);
    if (speckle && h2(wx, wz, s + 31) < speckle) chunk.vSet(x, TOP - 1 + lift, z, B_GLOW);
  }
}
function colTop(chunk, wx, wz){
  const x = Math.floor(wx) - chunk.originX, z = Math.floor(wz) - chunk.originZ;
  for (let y = VOX_H - 1; y >= 0; y--) if (chunk.vGet(x, y, z) !== B_AIR) return y + 1;
  return 0;
}
function deadTree(chunk, x, z, rng){
  const y = colTop(chunk, x, z), h = 3 + rng.int(0, 4);
  chunk.stampBox(x, y, z, x + 1, y + h, z + 1, B_DEADWOOD);
  for (let i = 0; i < 2; i++){
    const by = y + 2 + rng.int(0, h - 2), dir = rng.int(0, 3), len = 1 + rng.int(0, 1);
    const dx = [1, -1, 0, 0][dir], dz = [0, 0, 1, -1][dir];
    for (let k = 1; k <= len; k++) chunk.stampBox(x + dx * k, by + (k > 1 ? 1 : 0), z + dz * k, x + dx * k + 1, by + 1 + (k > 1 ? 1 : 0), z + dz * k + 1, B_DEADWOOD);
  }
}
function sign(chunk, x, z, rng){
  const y = colTop(chunk, x, z);
  chunk.stampBox(x, y, z, x + 1, y + 2, z + 1, B_METAL);
  const along = rng.bool();
  chunk.stampBox(x - (along ? 1 : 0), y + 2, z - (along ? 0 : 1), x + (along ? 2 : 1), y + 3, z + (along ? 1 : 2), B_HAZARD);
}
function barrels(chunk, x, z, rng, leak){
  const n = 1 + rng.int(0, 3);
  for (let i = 0; i < n; i++){
    const bx = x + rng.int(-1, 1), bz = z + rng.int(-1, 1), y = colTop(chunk, bx, bz);
    if (y > TOP + 1) continue;
    chunk.stampBox(bx, y, bz, bx + 1, y + (rng.bool(0.3) ? 1 : 2), bz + 1, B_RUST);
    if (leak && rng.bool(0.5)) chunk.stampBox(bx + 1, TOP - 1, bz, bx + 2, TOP, bz + 1, leak);
  }
}
function ruin(chunk, cx, cz, rng, mat){
  //  Two walls of a house and the stub of a third, jagged at the top.
  const w = 5 + rng.int(0, 3), d = 4 + rng.int(0, 3), y = TOP;
  const wall = (x0, z0, x1, z1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    for (let t = 0; t <= n; t++){
      const x = x0 + Math.sign(x1 - x0) * t, z = z0 + Math.sign(z1 - z0) * t;
      const h = 1 + Math.floor(rng.next() * 4);
      if (rng.bool(0.15)) continue;
      chunk.stampBox(x, y, z, x + 1, y + h, z + 1, mat);
    }
  };
  wall(cx, cz, cx + w, cz);
  wall(cx, cz, cx, cz + d);
  wall(cx + w, cz, cx + w, cz + Math.floor(d / 2));
  for (let i = 0; i < 6; i++){ const rx = cx + rng.int(1, w - 1), rz = cz + rng.int(1, d - 1); chunk.stampBox(rx, y, rz, rx + 1, y + 1, rz + 1, B_RUBBLE); }
}
function pylon(chunk, x, z){
  const y = colTop(chunk, x, z), h = 18;
  for (const [dx, dz] of [[0, 0], [3, 0], [0, 3], [3, 3]]) chunk.stampBox(x + dx, y, z + dz, x + dx + 1, y + h, z + dz + 1, B_METAL);
  for (let k = 3; k < h; k += 4) chunk.stampBox(x, y + k, z, x + 4, y + k + 1, z + 4, B_METAL);
  chunk.stampBox(x - 3, y + h, z + 1, x + 7, y + h + 1, z + 3, B_METAL);
}
function wreck(chunk, x, z, rng){
  const y = colTop(chunk, x, z), along = rng.bool();
  const w = along ? 4 : 2, d = along ? 2 : 4;
  chunk.stampBox(x, y, z, x + w, y + 1, z + d, B_RUST);
  chunk.stampBox(x + (along ? 1 : 0), y + 1, z + (along ? 0 : 1), x + (along ? 3 : 2), y + 2, z + (along ? 2 : 3), B_RUST);
}

function genNuke(chunk, rng){
  floor(chunk, B_ASH, B_SOIL, 0.006);
  const ox = chunk.originX, oz = chunk.originZ;
  const towerHere = chunk.cx % 3 === 1 && chunk.cz % 3 === 1 && (sbHash('tower', superOf(chunk.cx), superOf(chunk.cz)) % 3 === 0);
  if (towerHere){ coolingTower(chunk, ox + 12, oz + 12, rng); chunk.wildFeature = 'tower'; }
  else if (rng.bool(0.65)){
    //  A crater: raised rim, sunken floor, a glowing core.
    const cx = ox + 6 + rng.int(0, 12), cz = oz + 6 + rng.int(0, 12), r = 4 + rng.int(0, 3);
    for (let x = cx - r - 1; x <= cx + r + 1; x++) for (let z = cz - r - 1; z <= cz + r + 1; z++){
      const d = Math.hypot(x - cx, z - cz);
      if (d > r + 1.2) continue;
      if (d > r - 0.6){ if (rng.bool(0.7)) chunk.stampBox(x, TOP, z, x + 1, TOP + 1, z + 1, rng.bool(0.6) ? B_RUBBLE : B_ASH); continue; }
      chunk.stampBox(x, TOP - 1, z, x + 1, VOX_H, z + 1, B_AIR);
      chunk.stampBox(x, 0, z, x + 1, TOP - 1, z + 1, d < r * 0.35 ? B_GLOW : B_ASH);
    }
    chunk.wildFeature = 'crater';
    chunk.wildLoot = { x: cx + r + 2, z: cz };
  } else {
    ruin(chunk, ox + 4 + rng.int(0, 8), oz + 4 + rng.int(0, 8), rng, rng.bool(0.6) ? B_BRICK : B_CONCRETE);
    chunk.wildFeature = 'ruin';
  }
  const trees = 2 + rng.int(0, 4);
  for (let i = 0; i < trees; i++) deadTree(chunk, ox + 1 + rng.int(0, 21), oz + 1 + rng.int(0, 21), rng);
  if (rng.bool(0.7)) sign(chunk, ox + 1 + rng.int(0, 21), oz + 1 + rng.int(0, 21), rng);
  if (rng.bool(0.5)) barrels(chunk, ox + 3 + rng.int(0, 17), oz + 3 + rng.int(0, 17), rng, B_GLOW);
}

function coolingTower(chunk, cx, cz, rng){
  //  A hyperboloid shell, cracked, with a way in at the bottom and the core
  //  still warm in the middle. It reaches into the next chunks; stampBox clips.
  const H = 34;
  for (let y = TOP; y < TOP + H; y++){
    const t = (y - TOP) / H, r = 10 - 4.2 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    for (let a = 0; a < 96; a++){
      const ang = a / 96 * Math.PI * 2;
      const x = Math.round(cx + Math.cos(ang) * r), z = Math.round(cz + Math.sin(ang) * r);
      const door = y < TOP + 4 && Math.abs(Math.cos(ang) - 1) < 0.12;
      const crack = h2(a, y, 5) < 0.06 + t * 0.12;
      if (door || crack) continue;
      chunk.stampBox(x, y, z, x + 1, y + 1, z + 1, B_CONCRETE);
    }
  }
  for (let x = cx - 3; x <= cx + 3; x++) for (let z = cz - 3; z <= cz + 3; z++){
    const d = Math.hypot(x - cx, z - cz); if (d > 3.2) continue;
    chunk.stampBox(x, TOP - 1, z, x + 1, TOP + (d < 1.5 ? 2 : 1), z + 1, d < 2 ? B_GLOW : B_RUBBLE);
  }
  chunk.wildLoot = { x: cx + 5, z: cz, rich: true };
}

function lakeShape(sx, sz){
  const r = new RNG('lake:' + (State.citySeed || '') + ':' + sx + ':' + sz);
  const cx = (sx * 3 - 1000 + 1.5) * VOX_W, cz = (sz * 3 - 1000 + 1.5) * VOX_W;
  return { cx: cx + r.range(-6, 6), cz: cz + r.range(-6, 6), rx: r.range(24, 31), rz: r.range(22, 31), rot: r.range(0, Math.PI), seed: Math.floor(r.next() * 9999),
    island: { a: r.range(0, Math.PI * 2), d: r.range(0.25, 0.45) } };
}
function lakeE(L, x, z){
  const dx = x - L.cx, dz = z - L.cz, c = Math.cos(L.rot), s = Math.sin(L.rot);
  const u = (dx * c + dz * s) / L.rx, v = (-dx * s + dz * c) / L.rz;
  return Math.hypot(u, v) + (vnoise(x, z, 9, L.seed) - 0.5) * 0.22;
}
function genLake(chunk, rng){
  floor(chunk, B_DRYGRASS, B_ASH, 0);
  const L = lakeShape(superOf(chunk.cx), superOf(chunk.cz));
  const ox = chunk.originX, oz = chunk.originZ;
  const ix = L.cx + Math.cos(L.island.a) * L.rx * L.island.d, iz = L.cz + Math.sin(L.island.a) * L.rz * L.island.d;
  let wet = 0;
  for (let x = 0; x < VOX_W; x++) for (let z = 0; z < VOX_W; z++){
    const wx = ox + x, wz = oz + z, e = lakeE(L, wx, wz);
    const onIsland = Math.hypot(wx - ix, wz - iz) < 3.4;
    if (e < 1 && !onIsland){
      wet++;
      chunk.stampBox(wx, 1, wz, wx + 1, VOX_H, wz + 1, B_AIR);
      chunk.vSet(x, 0, z, h2(wx, wz, L.seed) < 0.08 ? B_SCUM : B_SLUDGE);
    } else if (e < 1.12 || onIsland){
      chunk.stampBox(wx, TOP, wz, wx + 1, VOX_H, wz + 1, B_AIR);
      chunk.vSet(x, TOP - 1, z, B_MUD);
    }
  }
  chunk.wildFeature = wet > 400 ? 'open water' : wet ? 'shore' : 'flats';
  //  The island has a crate on it, and whatever the crate kept.
  if (Math.floor(ix) >= ox && Math.floor(ix) < ox + VOX_W && Math.floor(iz) >= oz && Math.floor(iz) < oz + VOX_W){
    chunk.stampBox(Math.floor(ix), TOP, Math.floor(iz), Math.floor(ix) + 1, TOP + 1, Math.floor(iz) + 1, B_CRATE);
    deadTree(chunk, Math.floor(ix) - 2, Math.floor(iz) + 1, rng);
    chunk.wildLoot = { x: ix + 1.2, z: iz, rich: true };
    chunk.wildFeature = 'island';
  }
  //  Outfall pipes, from dry land toward the middle, on chunks that hold shore.
  if (wet && wet < 420 && rng.bool(0.6)){
    const ang = Math.atan2(L.cz - (oz + 12), L.cx - (ox + 12));
    let x = ox + 12 - Math.cos(ang) * 8, z = oz + 12 - Math.sin(ang) * 8;
    for (let k = 0; k < 16; k++){
      x += Math.cos(ang); z += Math.sin(ang);
      chunk.stampBox(Math.floor(x), TOP, Math.floor(z), Math.floor(x) + 2, TOP + 2, Math.floor(z) + 2, B_METAL);
    }
    chunk.stampBox(Math.floor(x), 0, Math.floor(z), Math.floor(x) + 2, 1, Math.floor(z) + 2, B_GLOW);
  }
  if (wet > 200 && rng.bool(0.4)){
    //  A car that drove in and decided to stay.
    for (let tries = 0; tries < 10; tries++){
      const x = ox + 3 + rng.int(0, 16), z = oz + 3 + rng.int(0, 16);
      if (chunk.vGet(x - ox, 0, z - oz) !== B_SLUDGE) continue;
      chunk.stampBox(x, 0, z, x + 4, 2, z + 2, B_RUST); chunk.stampBox(x + 1, 2, z, x + 3, 3, z + 2, B_RUST);
      break;
    }
  }
  if (rng.bool(0.6)){
    for (let tries = 0; tries < 8; tries++){
      const x = ox + 2 + rng.int(0, 19), z = oz + 2 + rng.int(0, 19);
      if (chunk.vGet(x - ox, TOP - 1, z - oz) === B_AIR) continue;
      barrels(chunk, x, z, rng, B_SLUDGE); break;
    }
  }
  if (!wet && rng.bool(0.35)){ sign(chunk, ox + 4 + rng.int(0, 15), oz + 4 + rng.int(0, 15), rng); }
  for (let i = 0; i < 2; i++){
    const x = ox + 1 + rng.int(0, 21), z = oz + 1 + rng.int(0, 21);
    if (chunk.vGet(x - ox, TOP - 1, z - oz) === B_AIR) continue;
    if (rng.bool(0.5)) deadTree(chunk, x, z, rng);
  }
}

function genScrub(chunk, rng){
  floor(chunk, B_DRYGRASS, B_ASH, 0);
  const ox = chunk.originX, oz = chunk.originZ;
  //  The old road still runs through, in pieces.
  if (rng.bool(0.5)){
    const along = rng.bool(), at = 8 + rng.int(0, 6);
    for (let t = 0; t < VOX_W; t++){
      if (rng.bool(0.25)) continue;
      const x = along ? ox + t : ox + at, z = along ? oz + at : oz + t;
      chunk.stampBox(x, TOP - 1, z, x + (along ? 1 : 3), TOP, z + (along ? 3 : 1), B_ASPHALT);
    }
  }
  const roll = rng.next();
  if (roll < 0.25) pylon(chunk, ox + 8 + rng.int(0, 6), oz + 8 + rng.int(0, 6));
  else if (roll < 0.6) ruin(chunk, ox + 4 + rng.int(0, 10), oz + 4 + rng.int(0, 10), rng, B_BRICK);
  if (rng.bool(0.55)) wreck(chunk, ox + 3 + rng.int(0, 16), oz + 3 + rng.int(0, 16), rng);
  const trees = rng.int(0, 3);
  for (let i = 0; i < trees; i++) deadTree(chunk, ox + 1 + rng.int(0, 21), oz + 1 + rng.int(0, 21), rng);
  for (let i = 0; i < 4; i++){ const x = ox + rng.int(0, 22), z = oz + rng.int(0, 22); chunk.stampBox(x, TOP, z, x + 1, TOP + 1, z + 1, B_RUBBLE); }
  if (rng.bool(0.25)) chunk.wildLoot = { x: ox + 12, z: oz + 12 };
  chunk.wildFeature = 'scrub';
}

// ─── Loot ───────────────────────────────────────────────────────────────────
const COMMON = ['wrench', 'crowbar', 'nailgun', 'dbarrel', 'flare'];
const RARE = ['axe', 'rifle', 'riot', 'revolver'];
function seedLoot(chunk){
  if (chunk._wildLooted || !chunk._wild) return;
  chunk._wildLooted = true;
  const L = chunk.wildLoot; if (!L || !window.FN || !FN.dropWeapon) return;
  const rng = new RNG('loot:' + chunk.key + ':' + (State.citySeed || ''));
  if (!L.rich && !rng.bool(0.6)) return;
  const id = (L.rich || rng.bool(0.35)) ? rng.pick(RARE) : rng.pick(COMMON);
  const s = shFindOpenSpot(L.x, L.z, 0.4, 1.2, 10); if (!s) return;
  FN.dropWeapon(id, s.x, s.y + 0.15, s.z, { chunk, pid: 'wild:' + chunk.key, ammo: 12 });
}

// ─── Hazards ────────────────────────────────────────────────────────────────
const css = document.createElement('style');
css.textContent = `
#wild-hud{position:fixed;left:22px;bottom:200px;z-index:60;display:none;min-width:190px;padding:8px 12px;background:#141e29d9;
  border-left:3px solid #86ff5c;font:600 10px/1.5 'SF Mono',ui-monospace,monospace;letter-spacing:.16em;color:#e2ddd1;pointer-events:none}
#wild-hud.on{display:block}
#wild-hud .bar{height:5px;background:#ffffff22;margin-top:5px;border-radius:3px;overflow:hidden}
#wild-hud .bar i{display:block;height:100%;background:#86ff5c}
#wild-hud.tox{border-left-color:#c7d84a}#wild-hud.hot .bar i{background:#ff5268}
#wild-tint{position:fixed;inset:0;z-index:5;pointer-events:none;opacity:0;transition:opacity .6s;
  background:radial-gradient(ellipse at center,transparent 45%,rgba(110,190,60,.55))}
body.fn-prologue #wild-hud{display:none!important}
@media (max-width:700px){#wild-hud{bottom:230px;left:12px}}
`;
document.head.appendChild(css);
function ui(id){ let el = document.getElementById(id); if (!el){ el = document.createElement('div'); el.id = id; document.body.appendChild(el); } return el; }

const INTRO = {
  nuke: 'NUKE FIELD. Radiation builds while you stay. The craters hold the best salvage in the city.',
  lake: 'BIOWASTE LAKE. Do not stand in it. Something is on the island.',
  scrub: 'THE OUTSKIRTS. The city stopped here. The road did not.',
};

function feetBlock(){
  const x = Math.floor(Player.position.x), z = Math.floor(Player.position.z);
  const y = Math.floor(Player.position.y - Player.height - 0.05);
  return getBlock(x, y, z);
}
function glowNear(){
  const px = Math.floor(Player.position.x), py = Math.floor(Player.position.y - Player.height), pz = Math.floor(Player.position.z);
  let s = 0;
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) for (let y = -3; y <= 2; y++){
    if (getBlock(px + x, py + y, pz + z) === B_GLOW) s += 1 / (1 + x * x + y * y + z * z);
  }
  return s;
}

let hurtAcc = 0, sampleT = 0, glow = 0, clickT = 0;
function hazardTick(dt){
  if (!State.citySeed || !Player || !Player.position) return;
  const story = window.FN && FN.prologue;
  const d = districtAtPosition(Player.position.x, Player.position.z);
  const biome = d && d.wild ? d.biome : null;
  if (biome !== W.here){
    W.here = biome;
    if (biome && !W.seen[biome] && !story){ W.seen[biome] = true; toast(INTRO[biome], 'warn'); }
  }
  sampleT -= dt;
  if (sampleT <= 0){ sampleT = 0.25; glow = biome === 'nuke' || biome === 'scrub' ? glowNear() : 0; }
  const onSludge = feetBlock() === B_SLUDGE;
  const radRate = (biome === 'nuke' ? 1.6 : 0) + glow * 9;
  if (radRate > 0) W.rad = Math.min(100, W.rad + radRate * dt);
  else W.rad = Math.max(0, W.rad - 5 * dt);
  if (onSludge) W.tox = Math.min(100, W.tox + 40 * dt); else W.tox = Math.max(0, W.tox - 12 * dt);

  //  Radiation hurts past forty; sludge hurts while you stand in it.
  let dps = 0;
  if (W.rad > 40) dps += (W.rad - 40) / 10;
  if (onSludge) dps += 7;
  if (dps > 0 && !State.ui.paused && Player.hp > 0){
    hurtAcc += dps * dt;
    if (hurtAcc >= 3){ const n = Math.floor(hurtAcc); hurtAcc -= n; safe(() => damagePlayer(n)); }
  } else hurtAcc = 0;

  //  The counter clicks faster the worse it gets.
  if (radRate > 0.5 && !State.ui.paused){
    clickT -= dt;
    if (clickT <= 0){
      clickT = Math.max(0.03, 0.9 / (radRate + 0.4)) * (0.5 + Math.random());
      safe(() => shTone({ noise: true, filter: 'highpass', ff0: 3200, ff1: 2800, q: 1, gain: 0.05, dur: 0.012 }));
    }
  }
  const hud = ui('wild-hud');
  const showRad = W.rad > 0.5, showTox = W.tox > 0.5;
  if ((showRad || showTox) && !story){
    const tox = showTox && W.tox >= W.rad;
    const v = Math.round(tox ? W.tox : W.rad);
    hud.className = 'on' + (tox ? ' tox' : '') + (v > 40 ? ' hot' : '');
    hud.innerHTML = `${tox ? 'BIOWASTE' : 'RADIATION'} · ${v}${v > 40 ? ' · LEAVE' : ''}<div class="bar"><i style="width:${v}%"></i></div>`;
  } else hud.className = '';
  ui('wild-tint').style.opacity = story ? 0 : Math.min(0.85, Math.max(W.rad, W.tox) / 90).toFixed(2);
}

// ─── The frame ──────────────────────────────────────────────────────────────
let lootT = 0;
const _after = window.shAfterChunks;
window.shAfterChunks = function(){
  const r = _after.apply(this, arguments);
  const now = performance.now(), dt = Math.min(0.05, W._last ? (now - W._last) / 1000 : 0.016);
  W._last = now;
  safe(() => hazardTick(dt));
  lootT -= dt;
  if (lootT <= 0){
    lootT = 1;
    safe(() => { for (const c of State.chunkMap.values()) if (c._wild && !c._wildLooted) seedLoot(c); });
    safe(() => { for (const c of State.chunkMap.values()) if (c._wild && !c._wildEased && typeof shEaseGround === 'function'){ c._wildEased = true; shEaseGround(c); } });
  }
  return r;
};

//  Dying in the wilds clears the dose.
if (typeof respawnPlayer === 'function'){
  const _respawn = window.respawnPlayer;
  window.respawnPlayer = function(){ W.rad = 0; W.tox = 0; return _respawn.apply(this, arguments); };
}

W.debug = {
  find(biome, max = 30){
    for (let r = 0; r <= max; r++) for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++){
      if (Math.max(Math.abs(x), Math.abs(z)) !== r) continue;
      const d = districtForChunk(x, z);
      if (d && d.biome === biome) return { cx: x, cz: z, x: x * VOX_W + 12, z: z * VOX_W + 12 };
    }
    return null;
  },
};
console.log('[wilds] ' + W.version + ' ready');
})();
