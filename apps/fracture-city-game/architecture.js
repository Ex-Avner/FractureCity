// =============================================================================
//  ARCHITECTURE · every district builds differently
// -----------------------------------------------------------------------------
//  The city used to be one tower repeated: a concrete box with a window grid.
//  This reshapes each building after it is raised, by district:
//
//    DOWNTOWN      glass curtain walls, art deco setbacks with gold trim, spires
//    RESIDENTIAL   brick, tenements with fire escapes and roof water towers,
//                  pitched tile roofs on the low ones
//    FORGE         sawtooth factory roofs with north-light glass, brick chimneys
//    FLOOD GATE    tiled lower floors, setbacks, watch masts
//    NIGHT MARKET  pagoda roofs in lacquer red, lantern strings under the eaves
//
//  Only the first floor and above are touched, so shop fronts and doorways at
//  street level keep working. Anything a building had on its roof is moved to
//  wherever the new roof is.
// =============================================================================
(function(){
'use strict';
if (typeof Chunk === 'undefined') return;
const ARCH = window.Architecture = { version: '0.38.0', counts: {} };
const safe = f => { try { return f(); } catch (e){ console.warn('[architecture]', e); } };

const B_CURTAIN  = shDefBlock(80, { name: 'curtain glass',  solid: true, emit: false, color: 0x2a3b52, grain: 0.03 });
const B_CURTAINL = shDefBlock(81, { name: 'lit curtain',    solid: true, emit: true,  color: 0xa9d6ff, grain: 0.02 });
const B_GOLD     = shDefBlock(82, { name: 'deco trim',      solid: true, emit: false, color: 0xc49a4a, grain: 0.06 });
const B_TILEROOF = shDefBlock(83, { name: 'roof tile',      solid: true, emit: false, color: 0x7a3a2c, grain: 0.14 });
const B_LACQUER  = shDefBlock(84, { name: 'lacquer',        solid: true, emit: false, color: 0x9c2a2a, grain: 0.05 });
const B_LANTERN  = shDefBlock(85, { name: 'lantern',        solid: true, emit: true,  color: 0xff8a4a, grain: 0.02 });
const B_BLUETILE = shDefBlock(86, { name: 'blue tile',      solid: true, emit: false, color: 0x3c6680, grain: 0.05 });
Object.assign(MATERIALS, {
  [B_CURTAIN]:  { label: 'Curtain Glass', cls: 'glass',  hardness: 1.0, drop: B_GLASS, yield: 1, value: 4, desc: 'Mirrored on the outside, so the tower only ever sees the city.' },
  [B_CURTAINL]: { label: 'Lit Curtain',   cls: 'signal', hardness: 1.0, drop: B_GLASS, yield: 1, value: 5, desc: 'Someone is working late. Someone is always working late.' },
  [B_GOLD]:     { label: 'Deco Trim',     cls: 'metal',  hardness: 2.4, drop: B_METAL, yield: 1, value: 9, desc: 'Brass, from when the city still expected to be looked at.' },
  [B_TILEROOF]: { label: 'Roof Tile',     cls: 'stone',  hardness: 1.2, drop: B_BRICK, yield: 1, value: 2, desc: 'Fired clay. One in four is the original.' },
  [B_LACQUER]:  { label: 'Lacquered Beam',cls: 'organic',hardness: 1.6, drop: B_TRUNK, yield: 1, value: 5, desc: 'Red, for luck. The luck has been very busy.' },
  [B_LANTERN]:  { label: 'Paper Lantern', cls: 'signal', hardness: 0.3, drop: B_NEON,  yield: 1, value: 4, desc: 'Lit every night by someone nobody has met.' },
  [B_BLUETILE]: { label: 'Blue Tile',     cls: 'stone',  hardness: 1.8, drop: B_CONCRETE, yield: 1, value: 3, desc: 'Waterproof, it said. The waterline says otherwise.' },
});
ARCH.blocks = { B_CURTAIN, B_CURTAINL, B_GOLD, B_TILEROOF, B_LACQUER, B_LANTERN, B_BLUETILE };

const STYLES = {
  DOWNTOWN:      [['curtain', 4], ['setback', 4], ['spire', 2], ['plain', 1]],
  RESIDENTIAL:   [['brick', 3], ['tenement', 4], ['gable', 3], ['plain', 1]],
  FORGE:         [['sawtooth', 5], ['chimney', 4], ['plain', 1]],
  'FLOOD GATE':  [['tile', 4], ['setback', 2], ['mast', 2], ['plain', 1]],
  'NIGHT MARKET':[['pagoda', 5], ['lantern', 3], ['plain', 1]],
};
function pickStyle(d, rng){
  const list = STYLES[d && d.name]; if (!list) return 'plain';
  const total = list.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [k, w] of list){ if ((r -= w) < 0) return k; }
  return 'plain';
}

const GROUND = 2;
const SHELL = new Set([B_CONCRETE, B_WIN_LIT, B_WIN_DARK]);

function frame(chunk, b){
  const top = Math.min(VOX_H - 2, GROUND + Math.round(b.h));
  const x0 = Math.round(b.cx - b.w / 2), x1 = Math.round(b.cx + b.w / 2);
  const z0 = Math.round(b.cz - b.d / 2), z1 = Math.round(b.cz + b.d / 2);
  return { top, x0, x1, z0, z1, ox: chunk.originX, oz: chunk.originZ };
}
const get = (c, x, y, z) => c.vGet(x - c.originX, y, z - c.originZ);
const set = (c, x, y, z, id) => c.vSet(x - c.originX, y, z - c.originZ, id);
function edge(F, x, z){ return x === F.x0 || x === F.x1 - 1 || z === F.z0 || z === F.z1 - 1; }
function forShell(chunk, F, y0, y1, fn){
  for (let y = y0; y < y1; y++) for (let x = F.x0; x < F.x1; x++) for (let z = F.z0; z < F.z1; z++){
    if (!edge(F, x, z)) continue;
    const id = get(chunk, x, y, z);
    if (SHELL.has(id)) fn(x, y, z, id);
  }
}
function colTop(chunk, x, z, from){
  for (let y = from; y >= 0; y--) if (get(chunk, x, y, z) !== B_AIR) return y + 1;
  return 0;
}

// ─── Styles ─────────────────────────────────────────────────────────────────
function curtain(chunk, F, rng){
  forShell(chunk, F, GROUND + 3, F.top, (x, y, z, id) => {
    const corner = (x === F.x0 || x === F.x1 - 1) && (z === F.z0 || z === F.z1 - 1);
    if (corner || (y - GROUND) % 4 === 0) set(chunk, x, y, z, B_METAL);
    else set(chunk, x, y, z, id === B_WIN_LIT || rng.bool(0.08) ? B_CURTAINL : B_CURTAIN);
  });
}
function setback(chunk, F, rng){
  const h = F.top - GROUND;
  if (h < 14) return curtainOrTrim(chunk, F, rng);
  const steps = [[F.top - Math.round(h * 0.35), 2], [F.top - Math.round(h * 0.15), 4]];
  //  The old parapet goes; the new roofline is wherever the steps leave it.
  for (let x = F.x0 - 1; x <= F.x1; x++) for (let z = F.z0 - 1; z <= F.z1; z++) if (get(chunk, x, F.top, z) === B_ROOF) set(chunk, x, F.top, z, B_AIR);
  for (const [yStart, inset] of steps){
    if (F.x1 - F.x0 - inset * 2 < 3 || F.z1 - F.z0 - inset * 2 < 3) break;
    for (let y = yStart; y < F.top; y++) for (let x = F.x0; x < F.x1; x++) for (let z = F.z0; z < F.z1; z++){
      const inside = x >= F.x0 + inset && x < F.x1 - inset && z >= F.z0 + inset && z < F.z1 - inset;
      if (!inside) set(chunk, x, y, z, B_AIR);
    }
    //  A gold band at each terrace edge.
    for (let x = F.x0; x < F.x1; x++) for (let z = F.z0; z < F.z1; z++){
      const t = colTop(chunk, x, z, F.top);
      if (t === yStart && get(chunk, x, yStart - 1, z) !== B_AIR) set(chunk, x, yStart - 1, z, B_GOLD);
    }
  }
  const last = steps[steps.length - 1][1];
  if (F.x1 - F.x0 - last * 2 >= 3 && F.z1 - F.z0 - last * 2 >= 3){
    for (let x = F.x0 + last; x < F.x1 - last; x++) for (let z = F.z0 + last; z < F.z1 - last; z++) set(chunk, x, F.top, z, B_ROOF);
    const cx = Math.floor((F.x0 + F.x1) / 2), cz = Math.floor((F.z0 + F.z1) / 2);
    for (let y = F.top + 1; y < Math.min(VOX_H - 1, F.top + 6); y++) set(chunk, cx, y, cz, B_GOLD);
  }
  forShell(chunk, F, GROUND + 3, F.top, (x, y, z, id) => { if ((y - GROUND) % 6 === 0) set(chunk, x, y, z, B_GOLD); });
}
function curtainOrTrim(chunk, F, rng){ curtain(chunk, F, rng); }
function spire(chunk, F, rng){
  curtain(chunk, F, rng);
  const cx = Math.floor((F.x0 + F.x1) / 2), cz = Math.floor((F.z0 + F.z1) / 2);
  const h = 6 + rng.int(0, 8);
  for (let y = F.top + 1; y < Math.min(VOX_H - 1, F.top + 1 + h); y++) set(chunk, cx, y, cz, B_METAL);
  set(chunk, cx, Math.min(VOX_H - 1, F.top + 1 + h), cz, B_NEON);
}
function brick(chunk, F){
  forShell(chunk, F, GROUND + 2, F.top, (x, y, z, id) => { if (id === B_CONCRETE) set(chunk, x, y, z, B_BRICK); });
  forShell(chunk, F, F.top - 1, F.top, (x, y, z) => set(chunk, x, y, z, B_CONCRETE));
}
function tenement(chunk, F, rng){
  brick(chunk, F);
  //  A fire escape down one face: a platform every floor, a ladder between.
  const side = rng.int(0, 3);
  const along = side % 2 === 0 ? [F.x0 + 1, F.x1 - 1] : [F.z0 + 1, F.z1 - 1];
  const a0 = along[0] + 1, a1 = Math.min(along[1] - 1, a0 + 4);
  const out = side === 0 ? F.z0 - 1 : side === 1 ? F.x1 : side === 2 ? F.z1 : F.x0 - 1;
  for (let y = GROUND + 4; y < F.top - 1; y += 3){
    for (let a = a0; a < a1; a++){
      if (side % 2 === 0) set(chunk, a, y, out, B_RUST); else set(chunk, out, y, a, B_RUST);
    }
    const ly = y + 1, la = ((y / 3) | 0) % 2 ? a0 : a1 - 1;
    for (let k = 0; k < 2; k++){ if (side % 2 === 0) set(chunk, la, ly + k, out, B_METAL); else set(chunk, out, ly + k, la, B_METAL); }
  }
  waterTower(chunk, F, rng);
}
function waterTower(chunk, F, rng){
  if (F.x1 - F.x0 < 6 || F.z1 - F.z0 < 6) return;
  const x = F.x0 + 1 + rng.int(0, Math.max(0, F.x1 - F.x0 - 6)), z = F.z0 + 1 + rng.int(0, Math.max(0, F.z1 - F.z0 - 6));
  const y = F.top + 1;
  if (y + 8 >= VOX_H) return;
  for (const [dx, dz] of [[0, 0], [3, 0], [0, 3], [3, 3]]) for (let k = 0; k < 3; k++) set(chunk, x + dx, y + k, z + dz, B_METAL);
  for (let k = 3; k < 7; k++) for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++) set(chunk, x + dx, y + k, z + dz, B_TRUNK);
  for (let dx = 1; dx < 3; dx++) for (let dz = 1; dz < 3; dz++) set(chunk, x + dx, y + 7, z + dz, B_TRUNK);
}
function gable(chunk, F){
  brick(chunk, F);
  if (F.top - GROUND > 14) return;
  const alongX = F.x1 - F.x0 >= F.z1 - F.z0;
  const span = alongX ? F.z1 - F.z0 + 2 : F.x1 - F.x0 + 2;
  for (let i = 0; i <= span / 2; i++){
    const y = F.top + 1 + i; if (y >= VOX_H - 1) break;
    for (let a = (alongX ? F.x0 : F.z0) - 1; a <= (alongX ? F.x1 : F.z1); a++){
      for (const s of [i, span - 1 - i]){
        const c = (alongX ? F.z0 : F.x0) - 1 + s;
        if (alongX) set(chunk, a, y, c, B_TILEROOF); else set(chunk, c, y, a, B_TILEROOF);
      }
    }
  }
}
function sawtooth(chunk, F){
  for (let x = F.x0; x < F.x1; x++){
    const phase = (x - F.x0) % 4;
    for (let z = F.z0; z < F.z1; z++){
      for (let k = 1; k <= phase; k++) set(chunk, x, F.top + k, z, phase === 3 && k > 0 ? B_GLASS : B_ROOF);
    }
  }
  forShell(chunk, F, GROUND + 2, F.top, (x, y, z, id) => { if (id === B_CONCRETE) set(chunk, x, y, z, B_BRICK); });
}
function chimney(chunk, F, rng){
  sawtooth(chunk, F);
  const n = 1 + rng.int(0, 1);
  for (let i = 0; i < n; i++){
    const x = i ? F.x1 - 3 : F.x0 + 1, z = rng.bool() ? F.z0 + 1 : F.z1 - 3;
    const h = 8 + rng.int(0, 6);
    for (let y = F.top + 1; y < Math.min(VOX_H - 1, F.top + 1 + h); y++) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) set(chunk, x + dx, y, z + dz, B_BRICK);
    const capY = Math.min(VOX_H - 1, F.top + 1 + h);
    for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) set(chunk, x + dx, capY, z + dz, B_LANTERN);
  }
}
function tile(chunk, F){
  forShell(chunk, F, GROUND + 2, Math.min(F.top, GROUND + 7), (x, y, z, id) => { if (id === B_CONCRETE) set(chunk, x, y, z, B_BLUETILE); });
  forShell(chunk, F, GROUND + 7, F.top, (x, y, z, id) => { if (id === B_CONCRETE && (y - GROUND) % 5 === 0) set(chunk, x, y, z, B_BLUETILE); });
}
function mast(chunk, F, rng){
  tile(chunk, F);
  const x = F.x1 - 2, z = F.z0 + 1, h = 8 + rng.int(0, 5);
  for (let y = F.top + 1; y < Math.min(VOX_H - 1, F.top + 1 + h); y++) set(chunk, x, y, z, B_METAL);
  for (let y = F.top + 4; y < Math.min(VOX_H - 1, F.top + h); y += 3){ set(chunk, x - 1, y, z, B_METAL); set(chunk, x + 1, y, z, B_METAL); }
}
function pagoda(chunk, F, rng){
  //  Lacquer at the corners, tiered roofs with lifted eaves, lanterns under.
  for (let y = GROUND + 2; y < F.top; y++) for (const [x, z] of [[F.x0, F.z0], [F.x1 - 1, F.z0], [F.x0, F.z1 - 1], [F.x1 - 1, F.z1 - 1]]) set(chunk, x, y, z, B_LACQUER);
  const tiers = F.top - GROUND > 10 ? 2 : 1;
  let x0 = F.x0 - 2, x1 = F.x1 + 1, z0 = F.z0 - 2, z1 = F.z1 + 1, y = F.top;
  for (let t = 0; t < tiers; t++){
    if (x1 - x0 < 3 || z1 - z0 < 3 || y + 2 >= VOX_H) break;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++){
      const rim = x === x0 || x === x1 || z === z0 || z === z1;
      const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
      set(chunk, x, y, z, rim ? B_LACQUER : B_TILEROOF);
      if (corner) set(chunk, x, y + 1, z, B_LACQUER);
      if (rim && !corner && (x + z) % 3 === 0 && t === 0) set(chunk, x, y - 1, z, B_LANTERN);
    }
    if (t + 1 < tiers){
      //  Posts up to the next tier.
      const px0 = x0 + 3, px1 = x1 - 3, pz0 = z0 + 3, pz1 = z1 - 3;
      for (const [px, pz] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1]]) for (let k = 1; k < 4; k++) set(chunk, px, y + k, pz, B_LACQUER);
      x0 = px0 - 1; x1 = px1 + 1; z0 = pz0 - 1; z1 = pz1 + 1; y += 4;
    }
  }
  const cx = Math.floor((F.x0 + F.x1) / 2), cz = Math.floor((F.z0 + F.z1) / 2);
  for (let k = 1; k <= 3 && y + k < VOX_H; k++) set(chunk, cx, y + k, cz, k === 3 ? B_GOLD : B_LACQUER);
}
function lantern(chunk, F){
  //  Strings of lanterns along two faces, a floor below the roof.
  const y = Math.max(GROUND + 4, F.top - 3);
  for (let x = F.x0; x < F.x1; x += 2){ set(chunk, x, y, F.z0 - 1, B_LANTERN); set(chunk, x, y, F.z1, B_LANTERN); }
  forShell(chunk, F, GROUND + 2, F.top, (x, yy, z, id) => { if (id === B_CONCRETE && (yy - GROUND) % 4 === 0) set(chunk, x, yy, z, B_LACQUER); });
}
const APPLY = { curtain, setback, spire, brick, tenement, gable, sawtooth, chimney, tile, mast, pagoda, lantern, plain(){} };

// ─── Hook ───────────────────────────────────────────────────────────────────
const _make = Chunk.prototype.makeBuilding;
Chunk.prototype.makeBuilding = function(b, district){
  const before = this.group.children.length;
  const r = _make.apply(this, arguments);
  if (this.landmark || this._wild || this._mall || (district && district.biome === 'park')) return r;
  safe(() => {
    const rng = new RNG('arch:' + this.key + ':' + Math.round(b.cx * 10) + ':' + Math.round(b.cz * 10));
    const style = pickStyle(district, rng);
    if (style === 'plain') return;
    const F = frame(this, b);
    const roofBefore = F.top + 1;
    APPLY[style](this, F, rng);
    ARCH.counts[style] = (ARCH.counts[style] || 0) + 1;
    //  Re-seat anything that was sitting on the old roof.
    for (let i = before; i < this.group.children.length; i++){
      const o = this.group.children[i];
      if (!o.position || o.position.y < roofBefore - 0.5) continue;
      const x = Math.floor(o.position.x), z = Math.floor(o.position.z);
      if (x < F.x0 - 1 || x > F.x1 || z < F.z0 - 1 || z > F.z1) continue;
      const surf = colTop(this, x, z, VOX_H - 1);
      if (surf > 0) o.position.y += surf - roofBefore;
    }
  });
  return r;
};

console.log('[architecture] ' + ARCH.version + ' ready');
})();
