// =============================================================================
//  SHOPPING CENTRES · walk-in, three floors
// -----------------------------------------------------------------------------
//  A mall takes a 2x2 block of the city, streets included. Inside:
//
//    · a skylit atrium through all three floors, with glass railings
//    · two stair runs climbing the atrium (ground to first, first to second)
//    · a ring corridor on every floor, lit from the ceiling
//    · about twenty shop units with lit fascias, names, counters and stock
//    · a food court on the first floor and a cinema on the second
//    · shoppers who walk the corridors and stop at windows, keepers at their
//      counters, and a security guard who has opinions
//
//  Every chunk of the mall stamps the whole plan and keeps only its own
//  quarter, so the four quarters always agree. Signs and people arrive once
//  all four quarters are loaded.
// =============================================================================
(function(){
'use strict';
if (typeof Chunk === 'undefined') return;

const MALL = window.Malls = { version: '0.38.0', every: 6, populated: new Map() };
const safe = f => { try { return f(); } catch (e){ console.warn('[malls]', e); } };

// ─── Blocks ─────────────────────────────────────────────────────────────────
const B_TILE   = shDefBlock(70, { name: 'mall tile',    solid: true, emit: false, color: 0xcfc8bb, grain: 0.03 });
const B_MARBLE = shDefBlock(71, { name: 'marble',       solid: true, emit: false, color: 0xe6e1d6, grain: 0.05 });
const B_CEIL   = shDefBlock(72, { name: 'ceiling light', solid: true, emit: true,  color: 0xfff1d6, grain: 0.01 });
const B_RAIL   = shDefBlock(73, { name: 'glass rail',   solid: true, emit: false, color: 0x9fc4d4, grain: 0.02 });
const B_STEP   = shDefBlock(74, { name: 'stair tread',  solid: true, emit: false, color: 0x8a8f99, grain: 0.04 });
//  The wall screen block is defined inside another module's scope.
const blockNamed = (name, fallback) => { const i = BLOCKS.findIndex(b => b && b.name === name); return i > 0 ? i : fallback; };
const SCREEN = () => blockNamed('wall screen', B_NEON);
Object.assign(MATERIALS, {
  [B_TILE]:   { label: 'Mall Tile',     cls: 'stone', hardness: 1.6, drop: B_CONCRETE, yield: 1, value: 3, desc: 'Polished every night by a machine that has outlived the cleaning contract.' },
  [B_MARBLE]: { label: 'Marble Facing', cls: 'stone', hardness: 2.2, drop: B_CONCRETE, yield: 1, value: 6, desc: 'Real marble, a quarter of an inch deep. The rest is a promise.' },
  [B_CEIL]:   { label: 'Ceiling Panel', cls: 'signal', hardness: 0.6, drop: B_NEON, yield: 1, value: 6, desc: 'Daylight, as specified by a committee that had never been outside.' },
  [B_RAIL]:   { label: 'Glass Railing', cls: 'glass', hardness: 1.0, drop: B_GLASS, yield: 1, value: 4, desc: 'Fingerprints from every child who has ever been told not to lean on it.' },
  [B_STEP]:   { label: 'Stair Tread',   cls: 'metal', hardness: 2.0, drop: B_METAL, yield: 1, value: 4, desc: 'The escalator stopped in the spring. It is a staircase now, and proud of it.' },
});

// ─── Names ──────────────────────────────────────────────────────────────────
const MALL_NAMES = ['THE TEMPORARY ARCADE', 'GALLERIA NINE', 'MERIDIAN CENTRE', 'EVERMORE PLAZA', 'THE AMENDED MALL', 'HALLORAN COURT'];
const SHOPS = [
  { name: 'FORMS & CO.',         kind: 'paper', line: 'Everything here is pending. Including the sale.' },
  { name: 'SECOND OPINION OPTICS', kind: 'goods', line: 'Try these. Everything looks slightly more official.' },
  { name: 'HOLD MUSIC RECORDS',  kind: 'goods', line: 'Your call is important to us. Track four is the good one.' },
  { name: 'PENDING PHARMACY',    kind: 'goods', line: 'Your prescription is ready, subject to review.' },
  { name: "NED'S KETTLES",       kind: 'goods', line: 'Not affiliated with Ned. Ned does not have a kettle.' },
  { name: 'THE QUEUE STORE',     kind: 'paper', line: 'Take a number. The numbers are also for sale.' },
  { name: 'BUREAU SURPLUS',      kind: 'goods', line: 'Gently used stamps. Some still say APPROVED.' },
  { name: 'CORRECTION FLUID',    kind: 'paper', line: 'For mistakes. Bulk discount for institutions.' },
  { name: 'TEMPORARY SHOES',     kind: 'goods', line: 'Worn once, at a meeting about shoes.' },
  { name: 'LOT 09 HARDWARE',     kind: 'tools', line: 'Floors, two at a time. Ask about our unfinished range.' },
  { name: 'SILENCE BOOKSHOP',    kind: 'paper', line: 'Shh. That is the whole business model.' },
  { name: 'STATIC ELECTRONICS',  kind: 'tech',  line: 'Every screen in here says something different. That is a feature now.' },
  { name: 'NIGHT SHOP EXPRESS',  kind: 'food',  line: 'Open since 17:58. Nobody told us to close.' },
  { name: 'THE LAST SHEET',      kind: 'paper', line: 'Carbon paper. We have exactly one left and it is not for sale.' },
  { name: 'NOODLE PROCEDURE',    kind: 'food',  line: 'Noodles in three stages. The second stage is waiting.' },
  { name: 'FRACTURE FIT',        kind: 'goods', line: 'Gym membership, valid while the gym exists.' },
  { name: 'UNFINISHED ANIMAL',   kind: 'goods', line: 'Rook sells his stickers here. Rook does not know.' },
  { name: 'GOOD EVENING CAFE',   kind: 'food',  line: 'Coffee, every flavour of complicated.' },
  { name: 'SPARE KEYS & SONS',   kind: 'tools', line: 'Keys to doors that no longer exist. Very popular.' },
  { name: 'THE WAITING ROOM',    kind: 'food',  line: 'A restaurant. You wait. It is the dish.' },
  { name: 'PAWN & PARDON',       kind: 'tech',  line: 'We buy anything. We forgive most things.' },
  { name: 'SIGNAL & NOISE',      kind: 'tech',  line: 'Radios that pick up a different station for everyone.' },
];
const GUARD = ['Walking only. Running is a separate tenancy.', 'This floor closes at closing. I do not know when that is.',
  'No loitering. Browsing is fine. The difference is your face.', 'If you see something, see it quietly.',
  'The stairs are an escalator that has taken early retirement.'];
const SHOPPER = ['I came for one thing. I have forgotten which thing.', 'Everything is on sale, temporarily.', 'Is the food court on this floor or the other floor?',
  'They moved the shoe shop. It is still a shoe shop.', 'I just like the air conditioning.', 'The fountain used to work. It used to be a fountain.'];

// ─── Where ──────────────────────────────────────────────────────────────────
//  Anchored on even chunk pairs, one in about six, inside the city and
//  clear of the Civic Core and the wilds.
function anchorOf(c){ return c - (((c % 2) + 2) % 2); }
function mallAt(cx, cz){
  const ax = anchorOf(cx), az = anchorOf(cz);
  const key = ax + ',' + az;
  if (MALL.cache && MALL.cache.seed === State.citySeed && MALL.cache.map.has(key)) return MALL.cache.map.get(key);
  if (!MALL.cache || MALL.cache.seed !== State.citySeed) MALL.cache = { seed: State.citySeed, map: new Map() };
  let m = null;
  const r = Math.min(Math.max(Math.abs(ax), Math.abs(az)), Math.max(Math.abs(ax + 1), Math.abs(az + 1)));
  const limit = window.Wilds ? Wilds.cityRadius - 1 : 8;
  const hit = (x, z) => hashStr(`mall:${State.citySeed || ''}:${x}:${z}`) % MALL.every === 0;
  //  Never two side by side: the one to the west or north wins.
  if (r > 3 && Math.max(Math.abs(ax + 1), Math.abs(az + 1)) <= limit && hit(ax, az) && !hit(ax - 2, az) && !hit(ax, az - 2)){
    let ok = true;
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]){
      const d = districtForChunk(ax + dx, az + dz);
      if (!d || d.wild || d.biome === 'park' || (typeof SHIFT_LANDMARKS !== 'undefined' && SHIFT_LANDMARKS[(ax + dx) + ',' + (az + dz)])) ok = false;
    }
    if (ok){
      const rng = new RNG('mallplan:' + (State.citySeed || '') + ':' + key);
      m = { key, ax, az, X0: ax * VOX_W, Z0: az * VOX_W, name: rng.pick(MALL_NAMES), seed: Math.floor(rng.next() * 1e9), units: [] };
      plan(m, rng);
    }
  }
  MALL.cache.map.set(key, m);
  return m;
}
MALL.at = mallAt;

// ─── The plan ───────────────────────────────────────────────────────────────
//  Building B0..B1 (42 square). Each side has a 9-deep band of shops, a 4-wide
//  corridor and the 14-square atrium in the middle. Floors at 2, 8 and 14.
const FLOORS = [2, 8, 14], ROOF = 20;
function geom(m){
  const B0x = m.X0 + 3, B0z = m.Z0 + 3;
  return { B0x, B0z, B1x: B0x + 42, B1z: B0z + 42, A0x: B0x + 14, A0z: B0z + 14, A1x: B0x + 28, A1z: B0z + 28 };
}
function plan(m, rng){
  const g = geom(m), names = SHOPS.slice();
  for (let i = names.length - 1; i > 0; i--){ const j = Math.floor(rng.next() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  let n = 0;
  //  Three units per side between the corner blocks (along 10..32); the
  //  middle one is the entrance hall on the ground floor.
  const SLOTS = [[10, 7], [17, 8], [25, 7]];
  for (let f = 0; f < 3; f++){
    for (let side = 0; side < 4; side++){
      for (let u = 0; u < 3; u++){
        if (f === 0 && u === 1) continue;                         // entrance hall
        if (f === 1 && side === 2 && u === 1) continue;           // food court seating
        if (f === 2 && side === 0 && u === 2) continue;           // the cinema takes two
        const wide = f === 2 && side === 0 && u === 1;
        const shop = wide ? { name: 'CINEMA · NOW SHOWING: STATIC', kind: 'cinema', line: 'One film. Everyone sees a different ending.' } : names[n++ % names.length];
        m.units.push({ f, side, along0: SLOTS[u][0], w: wide ? 15 : SLOTS[u][1], shop });
      }
    }
  }
}
//  Side frames: 0 north (low z), 1 east (high x), 2 south (high z), 3 west.
//  `along` runs on x for north/south and on z for east/west; `depth` measures
//  inward from the outer wall.
function sideBox(g, side, along0, along1, depth0, depth1){
  switch (side){
    case 0: return [g.B0x + along0, g.B0z + depth0, g.B0x + along1, g.B0z + depth1];
    case 2: return [g.B0x + along0, g.B1z - depth1, g.B0x + along1, g.B1z - depth0];
    case 3: return [g.B0x + depth0, g.B0z + along0, g.B0x + depth1, g.B0z + along1];
    default: return [g.B1x - depth1, g.B0z + along0, g.B1x - depth0, g.B0z + along1];
  }
}

// ─── Stamping ───────────────────────────────────────────────────────────────
function box(chunk, x0, y0, z0, x1, y1, z1, id){ chunk.stampBox(x0, y0, z0, x1, y1, z1, id); }
function genMall(chunk, m){
  const g = geom(m), X0 = m.X0, Z0 = m.Z0;
  //  The lot: asphalt, then a marble plaza out to the edge of the 2x2.
  box(chunk, X0, 0, Z0, X0 + 48, 1, Z0 + 48, B_ASPHALT);
  box(chunk, X0, 1, Z0, X0 + 48, 2, Z0 + 48, B_SIDEWALK);
  box(chunk, g.B0x - 2, 1, g.B0z - 2, g.B1x + 2, 2, g.B1z + 2, B_MARBLE);

  //  Shell, floors and roof.
  box(chunk, g.B0x, 2, g.B0z, g.B1x, ROOF + 1, g.B1z, B_CONCRETE);
  box(chunk, g.B0x + 1, 2, g.B0z + 1, g.B1x - 1, ROOF, g.B1z - 1, B_AIR);
  box(chunk, g.B0x + 1, 1, g.B0z + 1, g.B1x - 1, 2, g.B1z - 1, B_TILE);
  for (const fy of FLOORS.slice(1)){
    box(chunk, g.B0x + 1, fy - 1, g.B0z + 1, g.B1x - 1, fy, g.B1z - 1, B_TILE);
  }
  box(chunk, g.B0x - 1, ROOF, g.B0z - 1, g.B1x + 1, ROOF + 1, g.B1z + 1, B_ROOF);

  //  Glass bands on the outside, one per floor.
  for (const fy of FLOORS){
    for (let y = fy + 1; y < fy + 4; y++){
      for (let t = 2; t < 40; t++){
        if ((t % 7) === 0) continue;
        box(chunk, g.B0x + t, y, g.B0z, g.B0x + t + 1, y + 1, g.B0z + 1, B_GLASS);
        box(chunk, g.B0x + t, y, g.B1z - 1, g.B0x + t + 1, y + 1, g.B1z, B_GLASS);
        box(chunk, g.B0x, y, g.B0z + t, g.B0x + 1, y + 1, g.B0z + t + 1, B_GLASS);
        box(chunk, g.B1x - 1, y, g.B0z + t, g.B1x, y + 1, g.B0z + t + 1, B_GLASS);
      }
    }
  }
  //  Four entrances, six wide and four high, each with a lit canopy.
  for (let side = 0; side < 4; side++){
    const [x0, z0, x1, z1] = sideBox(g, side, 18, 24, 0, 1);
    box(chunk, x0, 2, z0, x1, 6, z1, B_AIR);
    const [cx0, cz0, cx1, cz1] = sideBox(g, side, 17, 25, -2, 0);
    box(chunk, cx0, 6, cz0, cx1, 7, cz1, B_FASCIA);
  }

  //  The atrium: open through both upper floors, skylit, railed.
  box(chunk, g.A0x, 7, g.A0z, g.A1x, 14, g.A1z, B_AIR);
  box(chunk, g.A0x, 13, g.A0z, g.A1x, 14, g.A1z, B_AIR);
  box(chunk, g.A0x, ROOF, g.A0z, g.A1x, ROOF + 1, g.A1z, B_GLASS);
  for (const fy of [8, 14]){
    box(chunk, g.A0x - 1, fy, g.A0z - 1, g.A1x + 1, fy + 1, g.A0z, B_RAIL);
    box(chunk, g.A0x - 1, fy, g.A1z, g.A1x + 1, fy + 1, g.A1z + 1, B_RAIL);
    box(chunk, g.A0x - 1, fy, g.A0z, g.A0x, fy + 1, g.A1z, B_RAIL);
    box(chunk, g.A1x, fy, g.A0z, g.A1x + 1, fy + 1, g.A1z, B_RAIL);
  }
  //  A dry fountain in the middle of the ground floor.
  const fx = g.A0x + 7, fz = g.A0z + 7;
  box(chunk, fx - 3, 2, fz - 3, fx + 3, 3, fz + 3, B_MARBLE);
  box(chunk, fx - 2, 2, fz - 2, fx + 2, 3, fz + 2, B_AIR);
  box(chunk, fx - 2, 1, fz - 2, fx + 2, 2, fz + 2, B_WATER);
  box(chunk, fx, 2, fz, fx + 1, 5, fz + 1, B_MARBLE);

  //  Stairs. Up the west side of the atrium to the first floor's north
  //  corridor; up the east side, the other way, to the second floor's south.
  const sx0 = g.A0x + 1;
  for (let k = 1; k <= 6; k++){
    const z = g.A0z + 1 + (k - 1) * 2;
    box(chunk, sx0, 2, z, sx0 + 3, 2 + k, z + 2, B_STEP);
  }
  box(chunk, sx0, 2, g.A0z + 13, sx0 + 3, 8, g.A1z, B_STEP);      // landing into the corridor
  box(chunk, sx0, 8, g.A1z, sx0 + 3, 9, g.A1z + 1, B_AIR);          // gap in the rail
  const ex0 = g.A1x - 4;
  box(chunk, ex0, 8, g.A1z - 2, ex0 + 3, 9, g.A1z + 1, B_AIR);      // gap in the rail
  for (let k = 1; k <= 6; k++){
    const z = g.A1z - 2 - (k - 1) * 2;
    box(chunk, ex0, 2, z, ex0 + 3, 8 + k, z + 2, B_STEP);
  }
  box(chunk, ex0, 2, g.A0z, ex0 + 3, 14, g.A0z + 2, B_STEP);          // top landing
  box(chunk, ex0, 14, g.A0z - 1, ex0 + 3, 15, g.A0z, B_AIR);          // gap in the rail
  box(chunk, ex0, 8, g.A1z, ex0 + 3, 9, g.A1z + 1, B_TILE);           // first step from the corridor
  box(chunk, ex0, 7, g.A1z, ex0 + 3, 8, g.A1z + 1, B_TILE);

  //  Ceiling lights over the corridors, a row every four blocks.
  for (const fy of FLOORS){
    const cy = fy === 14 ? ROOF - 1 : fy + 5;
    for (let t = 11; t <= 31; t += 4){
      box(chunk, g.B0x + t, cy, g.B0z + 11, g.B0x + t + 1, cy + 1, g.B0z + 12, B_CEIL);
      box(chunk, g.B0x + t, cy, g.B1z - 12, g.B0x + t + 1, cy + 1, g.B1z - 11, B_CEIL);
      box(chunk, g.B0x + 11, cy, g.B0z + t, g.B0x + 12, cy + 1, g.B0z + t + 1, B_CEIL);
      box(chunk, g.B1x - 12, cy, g.B0z + t, g.B1x - 11, cy + 1, g.B0z + t + 1, B_CEIL);
    }
  }

  //  The four corners are back-of-house: service rooms nobody shops in.
  for (const [cxo, czo] of [[0, 0], [1, 0], [0, 1], [1, 1]]){
    const x0 = cxo ? g.B1x - 10 : g.B0x + 1, z0 = czo ? g.B1z - 10 : g.B0z + 1;
    for (const fy of FLOORS) box(chunk, x0, fy, z0, x0 + 9, fy + 5, z0 + 9, B_CONCRETE);
  }
  //  Shop units.
  for (const u of m.units){
    const fy = FLOORS[u.f];
    const a0 = u.along0, a1 = u.along0 + u.w;
    //  Party walls at either end, from the outer wall to the shop front.
    for (const a of [a0, a1 - 1]){
      const [x0, z0, x1, z1] = sideBox(g, u.side, a, a + 1, 1, 10);
      box(chunk, x0, fy, z0, x1, fy + 5, z1, B_CONCRETE);
    }
    //  The front: a glass wall with a three-wide door, a lit fascia above.
    const [fx0, fz0, fx1, fz1] = sideBox(g, u.side, a0, a1, 9, 10);
    box(chunk, fx0, fy, fz0, fx1, fy + 4, fz1, B_GLASS);
    const mid = a0 + Math.floor(u.w / 2) - 1;
    const [dx0, dz0, dx1, dz1] = sideBox(g, u.side, mid, mid + 3, 9, 10);
    box(chunk, dx0, fy, dz0, dx1, fy + 3, dz1, B_AIR);
    box(chunk, fx0, fy + 4, fz0, fx1, fy + 5, fz1, B_FASCIA);
    //  Inside: stock along the back, a till by the door.
    const kind = u.shop.kind;
    const back = kind === 'food' ? B_VENDOR : kind === 'tech' ? SCREEN() : kind === 'tools' ? B_CRATE : B_CABINET;
    const [bx0, bz0, bx1, bz1] = sideBox(g, u.side, a0 + 1, a1 - 1, 1, 2);
    if (kind === 'cinema'){
      box(chunk, bx0, fy + 1, bz0, bx1, fy + 4, bz1, SCREEN());
      for (let row = 0; row < 3; row++){
        const [rx0, rz0, rx1, rz1] = sideBox(g, u.side, a0 + 2, a1 - 2, 4 + row * 2, 5 + row * 2);
        box(chunk, rx0, fy, rz0, rx1, fy + 1, rz1, B_BENCH);
      }
      continue;
    }
    box(chunk, bx0, fy, bz0, bx1, fy + (kind === 'tools' ? 2 : 3), bz1, back);
    const [tx0, tz0, tx1, tz1] = sideBox(g, u.side, a0 + 1, a0 + 3, 6, 7);
    box(chunk, tx0, fy, tz0, tx1, fy + 1, tz1, B_TILL);
  }
  //  Food court tables in the first floor's south corridor and entrance hall.
  for (const a of [18, 22]) for (const dep of [3, 6]){
    const [x0, z0, x1, z1] = sideBox(g, 2, a, a + 2, dep, dep + 1);
    box(chunk, x0, 8, z0, x1, 9, z1, B_BENCH);
  }
}

// ─── Generation hook ────────────────────────────────────────────────────────
const _generate = Chunk.prototype.generate;
Chunk.prototype.generate = function(){
  const m = (typeof SHIFT_LANDMARKS !== 'undefined' && SHIFT_LANDMARKS[this.key]) ? null : safe(() => mallAt(this.cx, this.cz));
  if (!m) return _generate.apply(this, arguments);
  this._mall = m.key;
  safe(() => genMall(this, m));
};

// ─── Signs ──────────────────────────────────────────────────────────────────
const SIGN_TEX = new Map();
function signMesh(text, w, h, bg, fg){
  const key = text + '|' + bg + '|' + fg;
  let tex = SIGN_TEX.get(key);
  if (!tex){
    const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = Math.floor(c.height * 0.56);
    x.font = `700 ${size}px Georgia, serif`;
    while (x.measureText(text).width > c.width * 0.92 && size > 10){ size -= 2; x.font = `700 ${size}px Georgia, serif`; }
    x.fillText(text, c.width / 2, c.height / 2 + 2);
    tex = new THREE.CanvasTexture(c);
    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    SIGN_TEX.set(key, tex);
  }
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}
//  Faces the plane outward from a side: north faces -z, east +x, south +z, west -x.
const FACING = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];
function placeSign(group, mesh, side, x, y, z, inward){
  mesh.position.set(x, y, z);
  mesh.rotation.y = FACING[side] + (inward ? Math.PI : 0);
  group.add(mesh);
}

// ─── People ─────────────────────────────────────────────────────────────────
function populate(m, anchor){
  const g = geom(m), group = anchor.group;
  const P = MALL.populated;
  if (P.get(m.key) !== anchor){ P.set(m.key, anchor); m.people = null; signs(m, anchor); }
  //  People only while you are near enough to meet them.
  const d = Math.hypot(Player.position.x - (g.B0x + 21), Player.position.z - (g.B0z + 21));
  if (d > 110 && m.people){ unpeople(m); return; }
  if (d < 75 && !m.people) people(m, anchor);
}
function unpeople(m){
  for (const n of m.people || []){
    const i = State.globalNPCs.indexOf(n); if (i >= 0) State.globalNPCs.splice(i, 1);
    if (n.group.parent) n.group.parent.remove(n.group);
  }
  m.people = null;
}
function signs(m, anchor){
  const g = geom(m), group = anchor.group;
  //  The name over every entrance.
  for (let side = 0; side < 4; side++){
    const [x0, z0, x1, z1] = sideBox(g, side, 18, 24, -2.05, -2.05);
    const mesh = signMesh(m.name, 9, 1.4, '#141e29', '#f4bb3d');
    placeSign(group, mesh, side, (x0 + x1) / 2, 8.2, (z0 + z1) / 2, false);
  }
  //  A name over every shop, facing the corridor.
  for (const u of m.units){
    const fy = FLOORS[u.f];
    const [x0, z0, x1, z1] = sideBox(g, u.side, u.along0, u.along0 + u.w, 10.06, 10.06);
    const mesh = signMesh(u.shop.name, u.w - 0.6, 0.8, '#1d2a36', u.shop.kind === 'food' ? '#ffd47a' : '#e2ddd1');
    placeSign(group, mesh, u.side, (x0 + x1) / 2, fy + 4.5, (z0 + z1) / 2, true);
  }
}
const mallSpawnQueue=[];
function people(m, anchor){
  const g = geom(m), group = anchor.group;
  //  Keepers at the tills, shoppers in the corridors, one guard.
  const rng = new RNG('mallpeople:' + m.key + ':' + (State.citySeed || ''));
  const people = [];
  const spawnNow = (x, z, y, role, extra) => {
    const s = floorSpot(x, z, y);
    if (!s) return null;
    shSetSpawnContext(anchor.district, State.dayTime / 60);
    const n = new NPC(s.x, s.z, rng);
    n.position.y = s.y; n.group.position.y = s.y; n.char.baseY = s.y;
    n.chunkKey = anchor.key;
    n._mall = Object.assign({ role, m, floor: y, t: rng.range(1, 4), target: null, barkT: 0 }, extra || {});
    group.add(n.group);
    State.globalNPCs.push(n);
    people.push(n);
    return n;
  };
  const spawn=(...args)=>mallSpawnQueue.push(()=>{if(m.people===people&&State.chunkMap.get(anchor.key)===anchor)spawnNow(...args)});
  m.units.filter(u => u.shop.kind !== 'cinema').forEach((u, i) => {
    if (i % 4) return;
    const fy = FLOORS[u.f];
    const [x0, z0, x1, z1] = sideBox(g, u.side, u.along0 + 2, u.along0 + 3, 4, 5);
    spawn((x0 + x1) / 2, (z0 + z1) / 2, fy, 'keeper', { shop: u.shop, face: FACING[u.side] + Math.PI });
  });
  for (let i = 0; i < 6; i++){
    const f = i % 3, fy = FLOORS[f];
    const ring = corridorPoints(g, fy);
    const p = ring[Math.floor(rng.next() * ring.length)];
    spawn(p.x, p.z, fy, 'shopper');
  }
  const ring0 = corridorPoints(g, 2);
  spawn(ring0[3].x, ring0[3].z, 2, 'guard');
  m.people = people;
}
//  An open spot on a given floor, not on the roof above it.
function floorSpot(x, z, fy){
  for (let i = 0; i < 10; i++){
    const a = i * 2.4, r = i === 0 ? 0 : 0.6 + i * 0.4;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    const sy = shSurfaceY(px, pz, fy + 2.2);
    if (Math.abs(sy - fy) <= 1.05 && !shBodyBlocked(px, sy, pz, 0.38, 1.75)) return { x: px, y: sy, z: pz };
  }
  return null;
}
function corridorPoints(g, fy){
  //  The middle of the corridor ring, every three blocks.
  const pts = [], lo = 12, hi = 30;
  for (let t = lo; t <= hi; t += 3){
    pts.push({ x: g.B0x + t + 0.5, z: g.B0z + 11.5, y: fy }, { x: g.B0x + t + 0.5, z: g.B1z - 11.5, y: fy },
             { x: g.B0x + 11.5, z: g.B0z + t + 0.5, y: fy }, { x: g.B1x - 11.5, z: g.B0z + t + 0.5, y: fy });
  }
  return pts;
}

//  Mall people walk the voxel floor, not the street grid.
const _npcUpdate = NPC.prototype.update;
NPC.prototype.update = function(dt){
  const M0 = this._mall, b = this.char && this.char.fnb;
  if (!M0 || (b && b.st !== 'ok')) return _npcUpdate.apply(this, arguments);
  const pd = Math.hypot(this.position.x - Player.position.x, this.position.z - Player.position.z);
  let moved = false;
  M0.barkT -= dt;
  if (M0.role === 'keeper'){
    this.direction = -M0.face + Math.PI / 2;
    if (pd < 3.2 && M0.barkT <= 0 && window.FN && FN.bark){ M0.barkT = 14; FN.bark({ char: this.char, pos: this.position }, M0.shop.line, 3); }
  } else {
    M0.t -= dt;
    if (!M0.target || M0.t <= 0){
      const ring = corridorPoints(geom(M0.m), M0.floor);
      M0.target = ring[Math.floor(Math.random() * ring.length)];
      M0.t = 6 + Math.random() * 8; M0.pause = Math.random() < 0.4 ? 2 + Math.random() * 3 : 0;
    }
    if (M0.pause > 0) M0.pause -= dt;
    else {
      const dx = M0.target.x - this.position.x, dz = M0.target.z - this.position.z, d = Math.hypot(dx, dz);
      if (d > 0.6){
        const step = this.speed * (M0.role === 'guard' ? 0.8 : 0.9) * dt;
        moved = safe(() => shGroundMove(this, dx / d * step, dz / d * step, 0.38, 1.75));
        this.direction = Math.atan2(dz, dx);
        if (!moved) M0.t = 0;
      } else { M0.t = 0; M0.pause = 1 + Math.random() * 4; }
    }
    if (pd < 2.4 && M0.barkT <= 0 && window.FN && FN.bark){
      M0.barkT = 20;
      FN.bark({ char: this.char, pos: this.position }, M0.role === 'guard' ? GUARD[Math.floor(Math.random() * GUARD.length)] : SHOPPER[Math.floor(Math.random() * SHOPPER.length)], 2.6);
    }
  }
  if (pd < 40) shAnimateCharacter(this.char, dt, !!moved, performance.now() * 0.001);
  this.char.baseY = this.position.y;
  this.group.position.x = this.position.x; this.group.position.z = this.position.z;
  this.group.position.y = this.position.y;
  this.group.rotation.y = -this.direction + Math.PI / 2;
};

// ─── The frame ──────────────────────────────────────────────────────────────
let popAt = 0;
const _after = window.shAfterChunks;
window.shAfterChunks = function(){
  const r = _after.apply(this, arguments);
  // Build at most one detailed resident per frame, including their GPU uploads.
  if(mallSpawnQueue.length)mallSpawnQueue.shift()();
  const now = performance.now();
  if (now < popAt) return r;
  popAt = now + 800;
  safe(() => {
    for (const c of State.chunkMap.values()){
      if (!c._mall) continue;
      const m = mallAt(c.cx, c.cz); if (!m) continue;
      if (c.cx !== m.ax || c.cz !== m.az) continue;
      const all = [[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dz]) => State.chunkMap.has((m.ax + dx) + ',' + (m.az + dz)));
      if (all) populate(m, c);
    }
    for (const [k, c] of MALL.populated) if (State.chunkMap.get(c.key) !== c){ MALL.populated.delete(k); const m = MALL.cache && MALL.cache.map.get(k); if (m) m.people = null; }
  });
  return r;
};

//  Name the place while you are inside it. The HUD rewrites the district
//  label every frame, so this runs after it.
function insideMall(){
  const m = mallAt(Math.floor(Player.position.x / VOX_W), Math.floor(Player.position.z / VOX_W));
  if (!m) return null;
  const g = geom(m);
  const feet = Player.position.y - Player.height;
  return Player.position.x > g.B0x && Player.position.x < g.B1x && Player.position.z > g.B0z && Player.position.z < g.B1z && feet < ROOF ? m : null;
}
MALL.inside = insideMall;
const _hud = window.shUpdateHUD;
window.shUpdateHUD = function(){
  const r = _hud.apply(this, arguments);
  safe(() => {
    if (window.FN && FN.prologue) return;
    const m = insideMall(); if (!m) return;
    const feet = Player.position.y - Player.height;
    const f = feet >= 13.5 ? 'SECOND FLOOR' : feet >= 7.5 ? 'FIRST FLOOR' : 'GROUND FLOOR';
    const el = document.getElementById('hud-district'); if (el) el.textContent = `${m.name} · ${f}`;
    if (MALL._said !== m.key){ MALL._said = m.key; toast(`${m.name}. Three floors. The stairs are in the atrium.`, 'info'); }
  });
  return r;
};

MALL.debug = {
  find(max = 12){
    for (let r = 0; r <= max; r++) for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++){
      if (Math.max(Math.abs(x), Math.abs(z)) !== r) continue;
      const m = mallAt(x, z); if (m) return Object.assign({ geom: geom(m) }, m, { units: m.units.length });
    }
    return null;
  },
  geom,
};
console.log('[malls] ' + MALL.version + ' ready');
})();
