/* The Church of Omnism: one house for every path.

   West of Common Ground, on the city blocks between the crossroads and the
   Lantern Hall (chunks 3..4 × 0..1). An octagonal stone hall under a bronze
   dome: ten lecterns stand around the walls, one for each scripture in the
   library, and the round table in the middle holds the Guide, the table of
   contents to all of them.

   The texts are real and complete, in their original languages where the
   source allows and in public-domain translations: the Tanakh in Hebrew and
   the 1917 JPS English; the Bible in the King James, Douay-Rheims, Latin
   Vulgate and the Greek New Testament; the Qur'an in Arabic and Pickthall's
   English; the Bhagavad Gita in Sanskrit and Arnold's English; the
   Upanishads, the Dhammapada, the Tao Te Ching in Chinese and English, the
   Analects, the Book of Mormon and two works of Bahá'u'lláh. They ship with
   the game (scriptures/, built by _build/build-scriptures.py) and load one
   book at a time as you read.

   Walk up to a lectern and press E (or tap the prompt) to read that book;
   press E at the centre table for the Guide. */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined' || typeof Chunk === 'undefined') return;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TAU = Math.PI * 2;

// ─── Plan (world blocks) ───────────────────────────────────────────────────
const KEYS = new Set(['3,0', '4,0', '3,1', '4,1']);
const BOUNDS = { x0: 72, x1: 120, z0: 0, z1: 48 };
const IN = { x0: 77, x1: 115, z0: 5, z1: 43 };       // inside the road ring
const C = { x: 96, z: 24 };                           // centre of the hall
const R = 14.5;                                        // octagon outer radius (blocks)
const FLOOR = 2;                                       // walking surface (top of y=1)
const WALL_TOP = 13;                                   // last wall course
const DOOR = { z0: 22, z1: 26, h: 6 };                 // east door, faces Common Ground
const oct = (x, z) => { const dx = Math.abs(x + .5 - C.x), dz = Math.abs(z + .5 - C.z); return Math.max(dx, dz, (dx + dz) / Math.SQRT2); };
const inside = (x, z) => x >= IN.x0 && x < IN.x1 && z >= IN.z0 && z < IN.z1;

const B_OM_STONE = shDefBlock(170, { name: 'temple limestone', solid: true, emit: false, color: 0xc9bc9f, grain: 0.10 });
const B_OM_GLASS = shDefBlock(171, { name: 'lantern glass', solid: true, emit: true, color: 0xffcf86, grain: 0.03 });
const B_OM_DARK = shDefBlock(172, { name: 'temple bronze', solid: true, emit: false, color: 0x4a3e2e, grain: 0.06 });
const B_OM_FLOOR = shDefBlock(173, { name: 'temple floor', solid: true, emit: false, color: 0x8c8270, grain: 0.07 });
if (typeof MATERIALS !== 'undefined'){
 MATERIALS[B_OM_STONE] = { label: 'Temple Limestone', cls: 'stone', hardness: 2.2, drop: B_OM_STONE, yield: 1, value: 4, desc: 'Pale stone from the Church of Omnism. It takes every colour of light that falls on it.' };
 MATERIALS[B_OM_GLASS] = { label: 'Lantern Glass', cls: 'signal', hardness: 1.2, drop: B_OM_GLASS, yield: 1, value: 8, desc: 'Amber glass, lit from within.' };
 MATERIALS[B_OM_DARK] = { label: 'Temple Bronze', cls: 'metal', hardness: 3, drop: B_OM_DARK, yield: 1, value: 6, desc: 'Dark bronze banding.' };
 MATERIALS[B_OM_FLOOR] = { label: 'Temple Floor', cls: 'stone', hardness: 2, drop: B_OM_FLOOR, yield: 1, value: 3, desc: 'Worn smooth by every kind of footstep.' };
}

// ─── The ten stations (one per work), around the walls ─────────────────────
//  Indexed by the library's work ids; the angle puts the door (east, +x) in
//  the gap between the first and last.
const ORDER = ['tanakh', 'bible', 'quran', 'bahai', 'mormon', 'gita', 'upanishads', 'dhammapada', 'tao', 'analects'];
const RING = 10.4;
const STATIONS = ORDER.map((id, i) => {
 const a = (i + 0.5) / ORDER.length * (TAU - 0.9) + 0.45;       // leave ~50° clear at the door
 const x = C.x + Math.cos(a) * RING, z = C.z + Math.sin(a) * RING;
 return { id, a, x, z, fx: C.x + Math.cos(a) * (RING - 1.6), fz: C.z + Math.sin(a) * (RING - 1.6) };
});
const TABLE = { x: C.x, z: C.z, r: 1.9 };

// ─── Voxels ────────────────────────────────────────────────────────────────
const generate = Chunk.prototype.generate;
Chunk.prototype.generate = function(){
 if (!KEYS.has(this.key)) return generate.apply(this, arguments);
 this._maker = true; this.__cityFitted = 1; this.landmark = 'omnism'; this._parked = true;
 const ox = this.originX, oz = this.originZ;
 for (let lx = 0; lx < VOX_W; lx++) for (let lz = 0; lz < VOX_W; lz++){
  const x = ox + lx, z = oz + lz;
  if (!inside(x, z)){ this.vSet(lx, 0, lz, (lz === 1 || lx === 1) ? B_PAINT : B_ASPHALT); continue; }
  this.vSet(lx, 0, lz, B_CONCRETE);
  const d = oct(x, z);
  //  The forecourt: pale paving with a bronze inlay ring around the hall.
  if (d > R){ this.vSet(lx, 1, lz, (d > R + 1.5 && d < R + 2.2) ? B_OM_DARK : B_OM_STONE); continue; }
  this.vSet(lx, 1, lz, (Math.floor(d) % 4 === 0 && d < R - 2) ? B_OM_DARK : B_OM_FLOOR);
  //  The walls: a one-block octagonal shell.
  if (d > R - 1){
   const door = x >= C.x + R - 2 && z >= DOOR.z0 && z < DOOR.z1;
   const face = Math.atan2(z + .5 - C.z, x + .5 - C.x), k = Math.round(face / (TAU / 8)), centre = Math.abs(face - k * TAU / 8) < 0.13;
   for (let y = FLOOR; y <= WALL_TOP; y++){
    let id = B_OM_STONE;
    if (door && y < FLOOR + DOOR.h) id = B_AIR;
    else if (door && y === FLOOR + DOOR.h) id = B_OM_DARK;
    else if (centre && !door && y >= FLOOR + 2 && y <= WALL_TOP - 3) id = B_OM_GLASS;   // a tall lit window in each face
    else if (y === WALL_TOP || y === FLOOR + 1 && !door) id = B_OM_DARK;               // base and cornice bands
    this.vSet(lx, y, lz, id);
   }
  }
 }
 //  Lecterns and the table are solid props.
 for (const s of STATIONS) if (chunkCoordOf(s.x) === this.cx && chunkCoordOf(s.z) === this.cz)
  this.collisionAABBs.push({ minX: s.x - .45, maxX: s.x + .45, minZ: s.z - .45, maxZ: s.z + .45, minY: FLOOR, maxY: FLOOR + 1.15, omnism: true });
 if (chunkCoordOf(TABLE.x) === this.cx && chunkCoordOf(TABLE.z) === this.cz)
  this.collisionAABBs.push({ minX: TABLE.x - 1.3, maxX: TABLE.x + 1.3, minZ: TABLE.z - 1.3, maxZ: TABLE.z + 1.3, minY: FLOOR, maxY: FLOOR + 1, omnism: true });
};

// ─── The library index ─────────────────────────────────────────────────────
const LIB = { index: null, loading: null, books: new Map(), error: '' };
const base = () => new URL('scriptures/', location.href).href;
function loadIndex(){
 if (LIB.index) return Promise.resolve(LIB.index);
 if (!LIB.loading) LIB.loading = fetch(base() + 'index.json', { signal: AbortSignal.timeout(20000) }).then(r => { if (!r.ok) throw Error(r.status); return r.json(); })
  .then(j => (LIB.index = j)).catch(e => { LIB.error = 'The library index could not be opened.'; LIB.loading = null; throw e; });
 return LIB.loading;
}
function loadBook(work, ed, i){
 const key = work + '/' + ed + '/' + i;
 if (!LIB.books.has(key)) LIB.books.set(key, fetch(base() + key + '.json', { signal: AbortSignal.timeout(30000) }).then(r => { if (!r.ok) throw Error(r.status); return r.json(); }).catch(e => { LIB.books.delete(key); throw e; }));
 return LIB.books.get(key);
}
const work = id => LIB.index?.works.find(w => w.id === id);

// ─── Meshes ────────────────────────────────────────────────────────────────
let root = null, scene = null;
const resources = [];
function canvasTex(w, h, paint){ const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; resources.push(t); return t; }
const MARKS = { tanakh: ['✡', 'TANAKH', 'JUDAISM'], bible: ['✝', 'HOLY BIBLE', 'CHRISTIANITY'], quran: ['☪', "QUR'AN", 'ISLAM'], gita: ['ॐ', 'BHAGAVAD GITA', 'HINDUISM'], upanishads: ['ॐ', 'UPANISHADS', 'HINDUISM'], dhammapada: ['☸', 'DHAMMAPADA', 'BUDDHISM'], tao: ['☯', 'TAO TE CHING', 'TAOISM'], analects: ['儒', 'ANALECTS', 'CONFUCIANISM'], mormon: ['✦', 'BOOK OF MORMON', 'LATTER-DAY SAINTS'], bahai: ['✶', "BAHÁ'U'LLÁH", "BAHÁ'Í FAITH"] };
const COVERS = { tanakh: 0x23405e, bible: 0x5a1e22, quran: 0x1f4a35, gita: 0x7a3d17, upanishads: 0x6a4a1c, dhammapada: 0x7a5a12, tao: 0x2a2a2e, analects: 0x3a2a4e, mormon: 0x2e3b4a, bahai: 0x4a2a3e };
function build(){
 if (root && scene === State.scene){ if (root.parent !== scene) scene.add(root); return; }
 if (root) dispose();
 scene = State.scene; root = new THREE.Group(); root.name = 'omnism-church'; scene.add(root);
 const M = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: .7, metalness: 0, ...o }); resources.push(m); return m; };
 const dome0 = M(0xcfc3a8, { roughness: .9, side: THREE.DoubleSide });
 const stone = M(0xcfc3a8, { roughness: .9 }), bronze = M(0x9c7a4a, { roughness: .42, metalness: .6, emissive: 0x2a1c08, emissiveIntensity: .25 }), dark = M(0x2c251c, { roughness: .6, metalness: .3 });
 const glow = new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), page = M(0xf1e7cf, { roughness: .95, emissive: 0xf1e7cf, emissiveIntensity: .18 });
 resources.push(glow);
 const add = (g, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.y = ry; root.add(o); resources.push(g); return o; };
 //  The dome: a bronze-ribbed stone shell on a drum, with a lit oculus.
 const top = WALL_TOP + 1;
 const drum = add(new THREE.CylinderGeometry(R - .6, R - .2, 1.2, 8, 1, true), stone, C.x, top + .6, C.z); drum.rotation.y = TAU / 16; drum.material = dome0;
 const dome = add(new THREE.SphereGeometry(R - .8, 32, 12, 0, TAU, .16, Math.PI / 2 - .16), stone, C.x, top + 1.2, C.z); dome.scale.y = .78;
 dome.material = stone.clone(); dome.material.side = THREE.DoubleSide; resources.push(dome.material);
 for (let i = 0; i < 16; i++){
  const rib = add(new THREE.TorusGeometry(R - .7, .14, 6, 24, Math.PI / 2 - .16), bronze, C.x, top + 1.2, C.z);
  rib.rotation.y = i / 16 * TAU; rib.scale.set(1, .78, 1);
 }
 const ring = add(new THREE.TorusGeometry((R - .8) * Math.sin(.16), .22, 8, 40), glow, C.x, top + 1.2 + (R - .8) * .78 * Math.cos(.16) - .05, C.z); ring.rotation.x = Math.PI / 2;
 //  A finial: eight thin rays, one star for every path.
 const fin = new THREE.Group(); fin.position.set(C.x, top + 1.2 + (R - .8) * .78 + .6, C.z); root.add(fin);
 for (let i = 0; i < 8; i++){ const g = new THREE.BoxGeometry(.08, 2.2, .08); resources.push(g); const r = new THREE.Mesh(g, bronze); r.rotation.z = i / 8 * Math.PI; fin.add(r); }
 //  Inside: a hanging lantern ring under the oculus, and light pools on the floor.
 const halo = add(new THREE.TorusGeometry(4.2, .07, 6, 64), glow, C.x, FLOOR + 7.5, C.z); halo.rotation.x = Math.PI / 2;
 for (let i = 0; i < 10; i++){ const a = i / 10 * TAU; add(new THREE.CylinderGeometry(.012, .012, 6, 4), dark, C.x + Math.cos(a) * 4.2, FLOOR + 10.5, C.z + Math.sin(a) * 4.2); add(new THREE.SphereGeometry(.16, 10, 8), glow, C.x + Math.cos(a) * 4.2, FLOOR + 7.3, C.z + Math.sin(a) * 4.2); }
 const pool = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,214,150,.42)'); r.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
 const poolMat = new THREE.MeshBasicMaterial({ map: pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); resources.push(poolMat);
 const p0 = add(new THREE.PlaneGeometry(12, 12), poolMat, C.x, FLOOR + .03, C.z); p0.rotation.x = -Math.PI / 2;
 //  The centre table and the Guide.
 add(new THREE.CylinderGeometry(TABLE.r, TABLE.r * .92, .12, 32), bronze, C.x, FLOOR + .92, C.z);
 add(new THREE.CylinderGeometry(.5, .8, .86, 16), dark, C.x, FLOOR + .43, C.z);
 const guideTex = canvasTex(512, 320, (g, w, h) => {
  g.fillStyle = '#f2e8d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9b48a'; g.fillRect(w / 2 - 2, 0, 4, h);
  g.fillStyle = '#5a4630'; g.textAlign = 'center'; g.font = '600 30px Georgia'; g.fillText('THE GUIDE', w / 4, 70); g.font = '18px Georgia';
  ['Tanakh', 'Holy Bible', "Qur'an", 'Bhagavad Gita', 'Upanishads', 'Dhammapada', 'Tao Te Ching', 'Analects', 'Book of Mormon', "Bahá'u'lláh"].forEach((t, i) => { g.textAlign = 'left'; g.fillText((i + 1) + '  ' + t, i < 5 ? 40 : w / 2 + 30, 120 + (i % 5) * 34); });
  g.textAlign = 'center'; g.font = 'italic 18px Georgia'; g.fillText('Contents', w * .75, 70);
 });
 const gb = add(new THREE.PlaneGeometry(1.5, .94), M(0xffffff, { map: guideTex, roughness: .95, emissive: 0xffffff, emissiveMap: guideTex, emissiveIntensity: .35 }), C.x, FLOOR + .99, C.z);
 gb.rotation.x = -Math.PI / 2; gb.rotation.z = Math.PI / 2;
 //  The lecterns: a stand, a sloped desk, the open book in its tradition's
 //  cover, and a plaque on the wall behind with its mark.
 for (const s of STATIONS){
  const [mark, title, trad] = MARKS[s.id] || ['✶', s.id.toUpperCase(), ''];
  const g = new THREE.Group(); g.position.set(s.x, FLOOR, s.z); g.rotation.y = Math.atan2(-Math.cos(s.a), -Math.sin(s.a)); root.add(g);
  const part = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); resources.push(geo); return o; };
  part(new THREE.BoxGeometry(.7, .08, .6), dark, 0, .04, 0);
  part(new THREE.BoxGeometry(.16, .95, .16), bronze, 0, .5, 0);
  part(new THREE.BoxGeometry(.78, .06, .56), dark, 0, 1.02, .05, -.32);
  const cov = M(COVERS[s.id] || 0x333333, { roughness: .6 });
  part(new THREE.BoxGeometry(.74, .03, .5), cov, 0, 1.07, .06, -.32);
  part(new THREE.BoxGeometry(.33, .02, .46), page, -.18, 1.095, .06, -.32).rotation.z = .05;
  part(new THREE.BoxGeometry(.33, .02, .46), page, .18, 1.095, .06, -.32).rotation.z = -.05;
  //  Plaque on the wall behind (the wall is outward from the lectern).
  const tex = canvasTex(384, 448, (c, w, h) => {
   c.fillStyle = '#1d1a16'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b8935a'; c.lineWidth = 6; c.strokeRect(12, 12, w - 24, h - 24);
   c.fillStyle = '#ffd9a0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '180px Georgia, "Noto Serif", serif'; c.fillText(mark, w / 2, 170);
   c.fillStyle = '#efe3c8'; c.font = '600 34px Georgia'; let fs = 34; while (c.measureText(title).width > w - 50 && fs > 18){ fs -= 2; c.font = `600 ${fs}px Georgia`; } c.fillText(title, w / 2, 330);
   c.fillStyle = '#b8a07a'; c.font = '20px Georgia'; c.fillText(trad, w / 2, 378);
  });
  const pm = new THREE.MeshBasicMaterial({ map: tex }); resources.push(pm);
  const ca = Math.abs(Math.cos(s.a)), sa = Math.abs(Math.sin(s.a)), wr = (R - 1.04) / Math.max(ca, sa, (ca + sa) / Math.SQRT2);
  const wx = C.x + Math.cos(s.a) * wr, wz = C.z + Math.sin(s.a) * wr;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.34), pm); resources.push(plaque.geometry);
  plaque.position.set(wx, FLOOR + 2.6, wz); plaque.lookAt(C.x, FLOOR + 2.6, C.z); root.add(plaque);
  const lamp = add(new THREE.BoxGeometry(1.2, .05, .12), glow, wx - Math.cos(s.a) * .1, FLOOR + 1.8, wz - Math.sin(s.a) * .1); lamp.lookAt(C.x, FLOOR + 1.8, C.z);
 }
 //  Over the door, outside: the name.
 const sign = canvasTex(1024, 220, (g, w, h) => {
  g.fillStyle = '#211c16'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b8935a'; g.lineWidth = 5; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#f2e3c0'; g.textAlign = 'center'; g.font = '600 74px Georgia'; g.fillText('THE CHURCH OF OMNISM', w / 2, 105);
  g.fillStyle = '#c9a868'; g.font = '30px Georgia'; g.fillText('✡  ✝  ☪  ✶  ✦  ॐ  ☸  ☯  儒     EVERY PATH · ONE LIBRARY', w / 2, 168);
 });
 const sm = new THREE.MeshBasicMaterial({ map: sign }); resources.push(sm);
 const sp = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.93), sm); resources.push(sp.geometry);
 sp.position.set(C.x + R + .56, FLOOR + DOOR.h + 2.4, C.z); sp.rotation.y = Math.PI / 2; root.add(sp);
 //  Steps up from the street on the east side, and two lanterns at the door.
 for (const dz of [-2.8, 2.8]){ add(new THREE.CylinderGeometry(.09, .12, 3, 8), dark, C.x + R + .6, FLOOR + 1.5, C.z + dz); add(new THREE.BoxGeometry(.42, .55, .42), glow, C.x + R + .6, FLOOR + 3.2, C.z + dz); }
 root.traverse(o => { if (o.isMesh){ o.userData._hdTag = 1; o.castShadow = false; o.receiveShadow = false; } });
 dome.castShadow = true;
}
function dispose(){ root?.removeFromParent(); for (const r of new Set(resources)) r.dispose?.(); resources.length = 0; root = null; scene = null; }

// ─── Interior air ──────────────────────────────────────────────────────────
//  Inside, the dome keeps most of the sun out and the air is warm and still.
let inBlend = 0;
const warm = new THREE.Color(0x3a2f24);
if (window.FCRealLight) FCRealLight.zones.push(c => {
 if (!inBlend) return;
 if (c.fog && 'density' in c.fog){ c.fog.density = THREE.MathUtils.lerp(c.fog.density, .004, inBlend); c.fog.color.lerp(warm, inBlend * .8); }
 if (c.sun) c.sun.intensity *= 1 - .65 * inBlend;
});

// ─── Proximity and the prompt ──────────────────────────────────────────────
const prompt = document.createElement('button'); prompt.id = 'om-approach'; prompt.hidden = true; document.body.append(prompt);
prompt.onclick = () => near && open(near);
let near = null, panel = null, priorPause = false, oldFocus = null;
function blocked(){ return State.ui.paused || State.ui.inArcade || State.ui.inDialogue || State.ui.inIntro || window.CityArt?.panelOpen || window.CityBuild?.panelOpen || window.FCAccounts?.visible || window.FCNewsHub?.isOpen || window.CitySocial?.writing || window.OwnBlock?.modal; }
const TITLES = { tanakh: 'the Tanakh', bible: 'the Holy Bible', quran: "the Qur'an", gita: 'the Bhagavad Gita', upanishads: 'the Upanishads', dhammapada: 'the Dhammapada', tao: 'the Tao Te Ching', analects: 'the Analects', mormon: 'the Book of Mormon', bahai: "Bahá'u'lláh" };
function tick(){
 requestAnimationFrame(tick);
 try {
  if (!State.scene || typeof Player === 'undefined') return;
  const p = Player.position, far = Math.abs(p.x - C.x) > 140 || Math.abs(p.z - C.z) > 140;
  if (!far) build();
  if (root) root.visible = !far;
  const d = oct(p.x - .5, p.z - .5);
  inBlend = Math.max(0, Math.min(1, (R - .5 - d) / 2.5));
  near = null;
  const feet = p.y - Player.height;
  if (!far && d < R && Math.abs(feet - FLOOR) < 1.6){
   if (Math.hypot(p.x - TABLE.x, p.z - TABLE.z) < TABLE.r + 1.4) near = { kind: 'guide' };
   else for (const s of STATIONS) if (Math.hypot(p.x - s.fx, p.z - s.fz) < 1.5){ near = { kind: 'work', id: s.id }; break; }
  }
  const show = !!near && !panel && !blocked();
  const label = !near ? '' : near.kind === 'guide' ? 'E · The Guide: table of contents' : 'E · Read ' + TITLES[near.id];
  if (show && prompt.textContent !== label) prompt.textContent = label;
  prompt.hidden = !show;
 } catch (e){ if (!tick.warned){ tick.warned = 1; console.warn('[omnism]', e); } window.FCOmnism && (FCOmnism.error = String(e && e.stack || e)); }
}
requestAnimationFrame(tick);

// ─── The reader ────────────────────────────────────────────────────────────
const css = document.createElement('style');
css.textContent = `
#om-approach{position:fixed;bottom:110px;left:50%;transform:translateX(-50%);z-index:125001;background:#0f1820e6;color:#eef2f3;border:1px solid #5d6d78;border-left:3px solid #d8b070;border-radius:22px;padding:13px 22px;font:600 14px/1.3 system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(6px);max-width:calc(100vw - 32px)}
#om-approach[hidden]{display:none}
body.om-reading #city-online,body.om-reading .social-dock,body.om-reading #maker-goal{visibility:hidden}
.om-panel{position:fixed;inset:4vh max(10px,calc((100vw - 1180px)/2));z-index:140000;display:grid;grid-template-columns:290px 1fr;border-radius:20px;overflow:hidden;background:#f4ecdb;color:#2a241c;box-shadow:0 0 0 100vmax #07060bb0,0 24px 100px #000a;font:15px/1.55 system-ui,sans-serif}
.om-panel *{box-sizing:border-box}
.om-panel button,.om-panel select{font:inherit;cursor:pointer;border-radius:16px;min-height:36px;padding:6px 12px;border:1px solid #b9a37c;background:#fffaf0;color:#2a241c}
.om-panel button:hover,.om-panel button:focus-visible{border-color:#7a5a2a;outline:none;background:#fff3dc}
.om-panel aside{background:#1e1a15;color:#efe4cc;padding:18px 14px;display:flex;flex-direction:column;gap:10px;min-height:0}
.om-panel aside h2{margin:0;font:600 24px/1.1 Georgia,serif;color:#f6e7c4}
.om-panel aside small{color:#b9a47e;letter-spacing:.08em;font-size:11px}
.om-panel aside nav{overflow:auto;display:flex;flex-direction:column;gap:2px;min-height:0;flex:1}
.om-panel aside nav button{display:flex;gap:10px;align-items:center;text-align:left;border:0;background:transparent;color:inherit;border-radius:10px;padding:7px 9px;min-height:34px}
.om-panel aside nav button:hover,.om-panel aside nav button:focus-visible{background:#ffffff14}
.om-panel aside nav button.on{background:#d8b0702b;color:#ffe6b8}
.om-panel aside nav b{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#ffffff12;color:#ffd9a0;font:16px/1 Georgia,serif;flex:none}
.om-panel aside nav span{display:flex;flex-direction:column;line-height:1.2}.om-panel aside nav em{font-style:normal;color:#a8957a;font-size:11px}
.om-panel aside .om-close{margin-top:auto;background:transparent;color:#efe4cc;border-color:#6d5d45}
.om-main{display:flex;flex-direction:column;min-height:0;min-width:0}
.om-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:14px 20px;border-bottom:1px solid #d9c8a6;background:#efe4cc}
.om-head h3{margin:0 auto 0 0;font:600 22px/1.15 Georgia,serif;min-width:0}
.om-head h3 small{display:block;font:13px system-ui;color:#7a6a50}
.om-head label{display:flex;gap:6px;align-items:center;font-size:12px;color:#6d5d45}
.om-body{overflow:auto;padding:22px 28px 60px;min-height:0;flex:1}
.om-books{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px}
.om-books h4{flex-basis:100%;margin:14px 0 2px;font:600 12px system-ui;letter-spacing:.08em;color:#7a6a50;text-transform:uppercase}
.om-books button{font-size:13px;min-height:32px;padding:4px 11px}
.om-books button.on{background:#2a241c;color:#f6e7c4;border-color:#2a241c}
.om-text{max-width:860px;margin:0 auto}
.om-text h4{font:600 20px Georgia,serif;margin:6px 0 14px;text-align:center;color:#5a4630}
.om-v{display:grid;gap:4px 26px;margin:0 0 10px;font:18px/1.62 Georgia,'Times New Roman',serif}
.om-v sup{font:600 11px system-ui;color:#a0855a;margin-right:6px;vertical-align:.45em}
.om-v.two{grid-template-columns:1fr 1fr}
.om-cols{display:grid;grid-template-columns:1fr 1fr;gap:26px}
.om-cols>div>p{margin:0 0 12px;font:18px/1.62 Georgia,serif}
.om-stanza{white-space:pre-line}
[dir=rtl]{text-align:right}
:lang(he){font-family:'SBL Hebrew','Ezra SIL','Taamey Frank CLM','Times New Roman','Arial Hebrew',serif;font-size:22px;line-height:1.8}
:lang(ar){font-family:'Amiri','Scheherazade New','Noto Naskh Arabic','Geeza Pro','Traditional Arabic',serif;font-size:24px;line-height:2}
:lang(sa){font-family:'Noto Serif Devanagari','Kohinoor Devanagari','Devanagari MT','Mangal',serif;font-size:20px;white-space:pre-line}
:lang(sa-Latn){font-style:italic;white-space:pre-line}
:lang(zh-Hant){font-family:'Songti TC','PMingLiU','Noto Serif CJK TC',serif;font-size:21px;letter-spacing:.05em}
:lang(grc){font-family:'Gentium Plus','GFS Didot','Palatino Linotype',Georgia,serif}
.om-nav{display:flex;justify-content:space-between;gap:10px;max-width:860px;margin:26px auto 0}
.om-guide{max-width:940px;margin:0 auto}
.om-guide h1{font:600 34px/1.1 Georgia,serif;margin:4px 0 8px}
.om-guide .lede{font:18px/1.6 Georgia,serif;color:#4a3d2c;max-width:760px}
.om-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin:18px 0 26px}
.om-card{text-align:left;display:flex;flex-direction:column;gap:6px;border-radius:14px;padding:14px;background:#fffaf0;border:1px solid #d9c8a6;min-height:0}
.om-card strong{font:600 18px Georgia,serif;display:flex;gap:10px;align-items:center}.om-card strong b{color:#a0743a;font-size:22px}
.om-card em{font-style:normal;font-size:12px;color:#7a6a50;letter-spacing:.06em;text-transform:uppercase}
.om-card p{margin:0;font-size:13.5px;color:#4a3d2c}
.om-toc{columns:2 300px;column-gap:28px}
.om-toc section{break-inside:avoid;margin:0 0 18px}
.om-toc h3{font:600 17px Georgia,serif;margin:0 0 4px}.om-toc h5{margin:8px 0 2px;font:600 11px system-ui;letter-spacing:.08em;color:#7a6a50;text-transform:uppercase}
.om-toc a{color:#5a3e18;cursor:pointer;text-decoration:none;border-bottom:1px dotted #b9a37c;font-size:13.5px;line-height:1.9}
.om-toc a:hover{color:#000}
.om-src{font-size:12.5px;color:#6d5d45;border-top:1px solid #d9c8a6;margin-top:24px;padding-top:12px}
.om-src li{margin:3px 0}
.om-empty{color:#7a6a50;font-style:italic;text-align:center;padding:30px}
@media (max-width:760px){.om-panel{inset:0;border-radius:0;grid-template-columns:1fr;grid-template-rows:auto 1fr}.om-panel aside{padding:10px;max-height:34vh}.om-panel aside nav{flex-direction:row;flex-wrap:wrap}.om-panel aside nav span em{display:none}.om-panel aside .om-close{position:absolute;top:8px;right:8px;margin:0}.om-body{padding:14px 14px 40px}.om-v.two,.om-cols{grid-template-columns:1fr}.om-v{font-size:17px}}
`;
document.head.append(css);

const POS_KEY = 'fc-omnism-pos';
let view = { mode: 'guide', work: 'tanakh', book: 0, ch: 0, ed: null, par: '' };
try { Object.assign(view, JSON.parse(localStorage.getItem(POS_KEY) || '{}')); } catch (e){}
function save(){ try { localStorage.setItem(POS_KEY, JSON.stringify(view)); } catch (e){} }

function open(target){
 if (panel) return;
 oldFocus = document.activeElement; priorPause = State.ui.paused; State.ui.paused = true; State.keys?.clear?.(); document.exitPointerLock?.();
 document.body.classList.add('om-reading');
 panel = document.createElement('div'); panel.className = 'om-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'The library of the Church of Omnism');
 document.body.append(panel);
 if (target?.kind === 'work'){ if (view.work !== target.id){ view.work = target.id; view.book = 0; view.ch = 0; view.ed = null; view.par = ''; } view.mode = 'read'; }
 else if (target?.kind === 'guide') view.mode = 'guide';
 panel.innerHTML = '<div class="om-empty" style="grid-column:1/-1">Opening the library…</div>';
 loadIndex().then(() => render()).catch(() => { if (panel) panel.innerHTML = '<div class="om-empty" style="grid-column:1/-1">' + esc(LIB.error) + ' <button data-act="close">Close</button></div>'; });
 panel.addEventListener('click', onClick);
 panel.addEventListener('change', onChange);
}
function close(){
 if (!panel) return;
 panel.remove(); panel = null; document.body.classList.remove('om-reading');
 State.ui.paused = priorPause; State.keys?.clear?.(); oldFocus?.focus?.(); save();
}
function aside(){
 const W = LIB.index.works;
 return `<aside><small>THE CHURCH OF OMNISM</small><h2>The Library</h2>
 <nav aria-label="Scriptures"><button data-act="guide" class="${view.mode === 'guide' ? 'on' : ''}"><b>☰</b><span>The Guide<em>Table of contents</em></span></button>
 ${W.map(w => `<button data-work="${esc(w.id)}" class="${view.mode === 'read' && view.work === w.id ? 'on' : ''}"><b>${esc(w.mark)}</b><span>${esc(w.title)}<em>${esc(w.tradition)}</em></span></button>`).join('')}</nav>
 <button class="om-close" data-act="close" aria-label="Close the library">Close · Esc</button></aside>`;
}
function guideHTML(){
 const I = LIB.index;
 const cards = I.works.map(w => `<button class="om-card" data-work="${esc(w.id)}"><em>${esc(w.tradition)}</em><strong><b>${esc(w.mark)}</b>${esc(w.title)}</strong><p>${esc(w.blurb)}</p><em>${w.editions.map(e => esc(e.short)).join(' · ')}</em></button>`).join('');
 const toc = I.works.map(w => {
  const groups = []; w.books.forEach((b, i) => { let g = groups[groups.length - 1]; if (!g || g.name !== b.g){ g = { name: b.g, items: [] }; groups.push(g); } g.items.push([b, i]); });
  return `<section><h3>${esc(w.mark)} ${esc(w.title)}</h3>${groups.map(g => `${groups.length > 1 || g.name !== w.title ? `<h5>${esc(g.name)}</h5>` : ''}${g.items.map(([b, i]) => `<a data-go="${esc(w.id)}:${i}">${esc(b.n)}</a>`).join(' · ')}`).join('')}</section>`;
 }).join('');
 const src = I.works.flatMap(w => w.editions.map(e => `<li><b>${esc(w.title)}, ${esc(e.label)}.</b> ${esc(e.source)}. ${esc(e.license)}.</li>`)).join('');
 return `<div class="om-guide">
 <small style="letter-spacing:.1em;color:#7a6a50">THE GUIDE</small>
 <h1>Every path, one library.</h1>
 <p class="lede">Omnism holds that every religion carries some part of the truth, and that no single one carries all of it. This hall keeps the scriptures of the world's traditions side by side, complete, in their own languages where the texts allow and in public-domain translations. Choose a book below, or walk to its lectern. Nothing here asks you to believe anything; it asks you to read.</p>
 <div class="om-cards">${cards}</div>
 <h2 style="font:600 24px Georgia,serif;margin:0 0 10px">Contents</h2>
 <div class="om-toc">${toc}</div>
 <div class="om-src"><b>How to read.</b> Pick a book and chapter at the top of the page. Where a work has more than one edition, choose the main text and, if you like, a parallel text beside it: Hebrew with English, Arabic with English, Sanskrit with English, Latin or Greek with the King James. Arrow keys turn chapters. The library remembers where you stopped.
 <br><br><b>Not yet on the shelves.</b> ${esc(I.missing.join('; '))}. Their complete texts in a public-domain edition could not be sourced for this release.
 <br><br><b>Sources and licences.</b><ul>${src}</ul></div></div>`;
}
function edOf(w, id){ return w.editions.find(e => e.id === id); }
function edsFor(w, b){ return w.editions.filter(e => !b.in || b.in.includes(e.id)); }
function chapters(w, b){ return b.parts ? b.parts : b.v.map((_, i) => w.unit + ' ' + (i + 1)); }
function readHTML(){
 const w = work(view.work) || LIB.index.works[0]; view.work = w.id;
 const b = w.books[Math.min(view.book, w.books.length - 1)]; view.book = w.books.indexOf(b);
 const eds = edsFor(w, b);
 if (!view.ed || !eds.some(e => e.id === view.ed)) view.ed = (eds.find(e => e.lang === 'en') || eds[0]).id;
 if (view.par && (view.par === view.ed || !eds.some(e => e.id === view.par))) view.par = '';
 const chs = chapters(w, b); view.ch = Math.max(0, Math.min(view.ch, chs.length - 1));
 const groups = []; w.books.forEach((x, i) => { let g = groups[groups.length - 1]; if (!g || g.name !== x.g){ g = { name: x.g, items: [] }; groups.push(g); } g.items.push([x, i]); });
 const many = w.books.length > 12;
 const bookSel = many ? `<label>Book<select data-sel="book" aria-label="Book">${groups.map(g => `<optgroup label="${esc(g.name)}">${g.items.map(([x, i]) => `<option value="${i}" ${i === view.book ? 'selected' : ''}>${esc(x.n)}${x.alt ? ' · ' + esc(x.alt) : ''}</option>`).join('')}</optgroup>`).join('')}</select></label>` : '';
 const books = w.books.length > 1 && !many ? `<div class="om-books">${groups.map(g => `${groups.length > 1 ? `<h4>${esc(g.name)}</h4>` : ''}${g.items.map(([x, i]) => `<button data-book="${i}" class="${i === view.book ? 'on' : ''}" title="${esc(x.alt || '')}">${esc(x.n)}</button>`).join('')}`).join('')}</div>` : '';
 return `<div class="om-head"><h3>${esc(w.title)}<small>${esc(b.n)}${b.alt ? ' · ' + esc(b.alt) : ''}</small></h3>
  ${bookSel}
  ${chs.length > 1 ? `<label>${esc(w.unit)}<select data-sel="ch" aria-label="${esc(w.unit)}">${chs.map((c, i) => `<option value="${i}" ${i === view.ch ? 'selected' : ''}>${esc(b.parts ? c : String(i + 1))}</option>`).join('')}</select></label>` : ''}
  <label>Text<select data-sel="ed" aria-label="Edition">${eds.map(e => `<option value="${esc(e.id)}" ${e.id === view.ed ? 'selected' : ''}>${esc(e.label)}</option>`).join('')}</select></label>
  ${eds.length > 1 ? `<label>Beside it<select data-sel="par" aria-label="Parallel edition"><option value="">None</option>${eds.filter(e => e.id !== view.ed).map(e => `<option value="${esc(e.id)}" ${e.id === view.par ? 'selected' : ''}>${esc(e.label)}</option>`).join('')}</select></label>` : ''}
 </div>
 <div class="om-body" tabindex="-1">${books}<div class="om-text" data-text><div class="om-empty">Turning to the page…</div></div>
 <div class="om-nav"><button data-act="prev">← Previous</button><button data-act="next">Next →</button></div></div>`;
}
let renderToken = 0;
async function fillText(){
 const token = ++renderToken, w = work(view.work), b = w.books[view.book], box = panel?.querySelector('[data-text]');
 if (!box) return;
 const A = edOf(w, view.ed), P = view.par ? edOf(w, view.par) : null;
 try {
  const [a, p] = await Promise.all([loadBook(w.id, A.id, view.book), P ? loadBook(w.id, P.id, view.book) : null]);
  if (token !== renderToken || !panel) return;
  const va = a.c[view.ch] || [], vp = p ? (p.c[view.ch] || []) : null, start = b.start || 1;
  //  Arnold's Gita is a verse translation by stanza, not by sloka: no numbers.
  const num = (e, n) => e.stanzas ? '' : `<sup>${n}</sup>`;
  const vtag = (e, t, n) => t ? `<div lang="${esc(e.lang)}" dir="${esc(e.dir)}" class="${e.stanzas ? 'om-stanza' : ''}">${num(e, n)}${esc(t)}</div>` : '<div></div>';
  const head = b.parts ? b.parts[view.ch] : b.v.length > 1 ? `${w.unit} ${view.ch + 1}` : b.n + (b.alt ? ' · ' + b.alt : '');
  let body = '';
  if (!vp){
   body = va.map((t, i) => t ? `<div class="om-v">${vtag(A, t, start + i)}</div>` : '').join('');
  } else if (w.aligned){
   const n = Math.max(va.length, vp.length);
   for (let i = 0; i < n; i++) if (va[i] || vp[i]) body += `<div class="om-v two">${vtag(A, va[i], start + i)}${vtag(P, vp[i], start + i)}</div>`;
  } else {
   const col = (e, vs) => `<div>${vs.map((t, i) => t ? `<p lang="${esc(e.lang)}" dir="${esc(e.dir)}" class="${e.stanzas ? 'om-stanza' : ''}">${e.stanzas ? '' : `<sup style="font:600 11px system-ui;color:#a0855a;margin-right:6px">${start + i}</sup>`}${esc(t)}</p>` : '').join('')}</div>`;
   body = `<div class="om-cols">${col(A, va)}${col(P, vp)}</div>`;
  }
  box.innerHTML = (head ? `<h4>${esc(head)}</h4>` : '') + (body || '<div class="om-empty">This edition has no text here.</div>');
  save();
 } catch (e){
  if (token === renderToken && box) box.innerHTML = '<div class="om-empty">This page could not be opened. Check your connection and try again.</div>';
 }
}
function render(){
 if (!panel || !LIB.index) return;
 const keep = panel.querySelector('.om-body')?.scrollTop;
 panel.innerHTML = aside() + `<div class="om-main">${view.mode === 'guide' ? `<div class="om-body" tabindex="-1">${guideHTML()}</div>` : readHTML()}</div>`;
 if (view.mode === 'read') fillText();
 const focus = panel.querySelector('.om-body'); focus?.focus({ preventScroll: true });
 void keep; save();
}
function step(dir){
 const w = work(view.work), b = w.books[view.book], n = chapters(w, b).length;
 let ch = view.ch + dir, bk = view.book;
 if (ch < 0){ if (bk === 0) return; bk--; ch = chapters(w, w.books[bk]).length - 1; }
 else if (ch >= n){ if (bk >= w.books.length - 1) return; bk++; ch = 0; }
 view.book = bk; view.ch = ch; render();
}
function onClick(e){
 const t = e.target.closest('button,a'); if (!t) return;
 if (t.dataset.act === 'close') return close();
 if (t.dataset.act === 'guide'){ view.mode = 'guide'; return render(); }
 if (t.dataset.act === 'prev') return step(-1);
 if (t.dataset.act === 'next') return step(1);
 if (t.dataset.work){ if (view.work !== t.dataset.work){ view.work = t.dataset.work; view.book = 0; view.ch = 0; view.ed = null; view.par = ''; } view.mode = 'read'; return render(); }
 if (t.dataset.book != null){ view.book = +t.dataset.book; view.ch = 0; return render(); }
 if (t.dataset.go){ const [wid, bi] = t.dataset.go.split(':'); if (view.work !== wid){ view.ed = null; view.par = ''; } view.work = wid; view.book = +bi; view.ch = 0; view.mode = 'read'; return render(); }
}
function onChange(e){
 const s = e.target.dataset.sel; if (!s) return;
 if (s === 'ch') view.ch = +e.target.value;
 if (s === 'book'){ view.book = +e.target.value; view.ch = 0; }
 if (s === 'ed') view.ed = e.target.value;
 if (s === 'par') view.par = e.target.value;
 render();
}
window.addEventListener('keydown', e => {
 if (panel){
  if (e.code === 'Escape') close();
  else if (view.mode === 'read' && !/SELECT|INPUT/.test(e.target.tagName) && (e.code === 'ArrowRight' || e.code === 'ArrowLeft')) step(e.code === 'ArrowRight' ? 1 : -1);
  else if (e.code === 'Tab'){ const nodes = [...panel.querySelectorAll('button,select,a')], i = nodes.indexOf(document.activeElement); e.preventDefault(); nodes[(i + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length]?.focus(); }
  e.stopImmediatePropagation(); return;
 }
 if (e.code === 'KeyE' && !e.repeat && !prompt.hidden && near){ e.preventDefault(); e.stopImmediatePropagation(); open(near); }
}, true);

window.FCOmnism = { C, R, FLOOR, STATIONS, TABLE, KEYS, open, close, loadIndex, loadBook, get view(){ return view; }, set view(v){ Object.assign(view, v); }, render, step, get near(){ return near; }, get panel(){ return panel; }, get root(){ return root; }, get inside(){ return inBlend; }, lib: LIB };
})();
