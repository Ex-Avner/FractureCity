/* The Reading Garden, at the centre of Common Ground.

   An open reading court between the arrival promenade and the People's Gallery:
   an illuminated atrium between the theory library and the listening booth, two
   reflecting pools, lawns, rounded trees, flowers, lanterns, and at its heart
   the Reading Wall, a freestanding bookcase with a different passage from
   the classics lit on it every day.

   The wall opens a reader: 49 classics bundled with the game (the starter
   shelf, classics/shelf.json, built by _build/build-classics.cjs from
   Project Gutenberg texts), and, online, the whole Gutenberg catalogue,
   searched and fetched by the server (server/classics.cjs).

   Solid things (lawn, hedges, trees, pools' rims, the wall, benches, the
   tree trunks) are voxels stamped into the Makers' Mile chunks, so they
   collide and sit in the city's own lighting. Everything that moves or
   glows is a mesh. */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined' || typeof Chunk === 'undefined') return;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TAU = Math.PI * 2;
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rand = seed => () => ((seed = Math.imul(seed ^ seed >>> 15, seed | 1) + 0x6D2B79F5 | 0) >>> 0) / 4294967296;
const hour = () => (((State.dayTime || 0) / 60) % 24 + 24) % 24;
const isNight = () => { const h = hour(); return h >= 19.5 || h < 5.5; };
const online = () => location.pathname.startsWith('/city/');
const dayKey = () => new Date().toISOString().slice(0, 10);

// ─── Layout (world blocks) ─────────────────────────────────────────────────
//  Common Ground's plaza runs x 145–191, z 28.5–45. The garden fills the
//  middle; the gallery lane stays open at z 39.5–42 and the People's Gallery
//  displays stand along the south edge at z 44 (social-city.js).
const CX = 167;
const WALL = { x0: 160, x1: 174, z: 37, top: 5 };            // voxel wall, front face at z 37
const POOLS = [{ x0: 158, x1: 164, z0: 31, z1: 35 }, { x0: 170, x1: 176, z0: 31, z1: 35 }];
const TREES = [[152, 33], [156, 37], [182, 33], [178, 37]];
const BENCHES = [[160, 35, 3], [172, 35, 3]];                  // x0, z, length
const READ_AT = { x: CX, z: 35.6 };
const inRect = (x, z, r) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;
const LAWN = { x0: 149, x1: 185, z0: 31, z1: 39 };
const PATH = (x, z) => x >= 165 && x < 169 && z >= 30 && z < 37;    // central walk
const COURT = (x, z) => x >= 158 && x < 176 && z >= 35 && z < 37;   // reading court
const FLOWERBEDS = [{ x0: 149, x1: 153, z0: 35, z1: 38 }, { x0: 181, x1: 185, z0: 35, z1: 38 }, { x0: 158, x1: 164, z0: 38, z1: 39 }, { x0: 170, x1: 176, z0: 38, z1: 39 }];
const near = (x, z, list, r) => list.some(([a, b]) => Math.abs(x + .5 - a) < r && Math.abs(z + .5 - b) < r);

const WOOD = 128, BRASS = 135, CHARRED = 130, STONE = 134;      // city-build catalogue ids
function stampGarden(chunk){
 const ox = chunk.originX, oz = chunk.originZ;
 const set = (x, y, z, id) => { if (x >= ox && x < ox + VOX_W && z >= oz && z < oz + VOX_W) chunk.vSet(x - ox, y, z - oz, id); };
 for (let x = LAWN.x0; x < LAWN.x1; x++) for (let z = LAWN.z0; z < LAWN.z1; z++){
  if (x < ox || x >= ox + VOX_W || z < oz || z >= oz + VOX_W) continue;
  if (PATH(x, z) || COURT(x, z)) continue;
  const pool = POOLS.find(p => inRect(x, z, p));
  if (pool){
   const rim = x === pool.x0 || x === pool.x1 - 1 || z === pool.z0 || z === pool.z1 - 1;
   set(x, 0, z, rim ? STONE : B_WATER); // Flush water edges keep the court open at walking height.
   continue;
  }
  const bed = FLOWERBEDS.find(b => inRect(x, z, b));
  set(x, 0, z, bed ? B_SOIL : B_GRASS);
  //  Low box hedges edge the lawns along the gallery lane, with gaps to walk through.
  if (z === LAWN.z1 - 1 && !bed && (x % 6 !== 0) && !(x >= 158 && x < 176)) set(x, 1, z, B_LEAF);
 }
 //  Trees: a trunk and a rounded voxel canopy.
 for (const [tx, tz] of TREES){
  for (let y = 1; y <= 4; y++) set(tx, y, tz, B_TRUNK);

 }
 //  The Reading Wall: walnut body, brass cornice and plinth.
 for (let x = WALL.x0; x < WALL.x1; x++){
  set(x, 1, WALL.z, BRASS);
  for (let y = 2; y < WALL.top - 1; y++) set(x, y, WALL.z, WOOD);
  set(x, WALL.top - 1, WALL.z, BRASS);
 }
 for (const z of [WALL.z]) for (const x of [WALL.x0 - 1, WALL.x1]) for (let y = 1; y < WALL.top; y++) set(x, y, z, STONE);
 //  Benches facing the wall.
 for (const [bx, bz, n] of BENCHES) for (let k = 0; k < n; k++) set(bx + k, 1, bz, CHARRED);
}
const generate = Chunk.prototype.generate;
Chunk.prototype.generate = function(){
 const r = generate.apply(this, arguments);
 if (this.landmark === 'makers' && (this.key === '6,1' || this.key === '7,1')) try { stampGarden(this); } catch (e){ console.warn('[reading-garden]', e); }
 return r;
};

// ─── The library ───────────────────────────────────────────────────────────
const lib = { shelf: null, shelfTried: false, books: new Map(), today: null };
const base = () => new URL('classics/', location.href).href;
function loadShelf(){
 if (lib.shelfP) return lib.shelfP;
 lib.shelfTried = true;
 lib.shelfP = (async () => { try { const r = await fetch(base() + 'shelf.json', { signal: AbortSignal.timeout(15000) }); if (r.ok) lib.shelf = await r.json(); } catch (e){} return lib.shelf; })();
 return lib.shelfP;
}
const shelfBooks = () => (lib.shelf?.shelves || []).flatMap(s => s.books);
const onShelf = id => shelfBooks().some(b => b.id === id);
async function loadBook(id){
 if (lib.books.has(id)) return lib.books.get(id);
 let book = null, err = '';
 try {
  if (onShelf(id)){ const r = await fetch(base() + id + '.json', { signal: AbortSignal.timeout(30000) }); if (r.ok) book = await r.json(); }
  if (!book && online()){ const r = await fetch('/api/classics/book/' + id, { signal: AbortSignal.timeout(60000) }); const j = await r.json().catch(() => ({})); if (r.ok) book = j; else err = j.error || 'That book could not be opened.'; }
  if (!book && !err) err = 'This book is in the online library. Play online to read it.';
 } catch (e){ err = 'That book could not be opened. Check your connection and try again.'; }
 if (book){ lib.books.set(id, book); if (lib.books.size > 6) lib.books.delete(lib.books.keys().next().value); }
 return book || { error: err };
}
//  Same rule as the server's passage(): one prose paragraph of a readable length.
function passage(book, seed){
 const pool = [];
 for (const c of book.chapters || []) for (const p of c.paras){
  if (p.length < 120 || p.length > 360 || p.includes('\n')) continue;
  if (/\bCHAPTER\b/.test(p) || /gutenberg|copyright|illustration/i.test(p) || /[\[\]{}|]/.test(p) || !/[.!?][”’"']?$/.test(p) || !/^[“"'‘A-Z]/.test(p)) continue;
  pool.push({ text: p, chapter: c.title });
 }
 return pool.length ? pool[(seed >>> 0) % pool.length] : null;
}
//  Only well-known opening lines, quoted exactly, for an edition without the shelf.
const FALLBACK = [
 { text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.', title: 'Pride and Prejudice', author: 'Jane Austen' },
 { text: 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness,', title: 'A Tale of Two Cities', author: 'Charles Dickens' },
];
async function lineOfDay(){
 const key = dayKey();
 if (lib.today?.key === key) return lib.today;
 await loadShelf();
 const books = shelfBooks(), seed = hash('reading-wall:' + key);
 let out = null;
 if (books.length){
  for (let k = 0; k < 4 && !out; k++){
   const pick = books[(seed + k * 7919) % books.length], b = await loadBook(pick.id);
   const p = !b.error && passage(b, seed);
   if (p) out = { key, text: p.text, chapter: p.chapter, title: b.title, author: b.author, id: pick.id };
  }
 }
 if (!out){ const f = FALLBACK[seed % FALLBACK.length]; out = { key, ...f }; }
 lib.today = out;
 return out;
}

// ─── Scene ─────────────────────────────────────────────────────────────────
let root = null, scene = null;
const view = { plaque: null, plaqueKey: '', spines: [], fireflies: null, pages: [], water: [], lanterns: [] };
function canvasTex(w, h, paint){ const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
const SPINE_COLORS = ['#5b1f24', '#20384a', '#2d4a2f', '#6b4a1e', '#3b2a4a', '#1f2a2e', '#7a2e1f', '#284f4f', '#4a3a28', '#5a2e48', '#23333f', '#6e5a2a'];
function spineTexture(titles, seed){
 return canvasTex(2048, 1024, (g, w, h) => {
  const R = rand(seed);
  g.fillStyle = '#2a1c14'; g.fillRect(0, 0, w, h);
  const rows = 4, rh = h / rows;
  let n = 0;
  for (let r = 0; r < rows; r++){
   const y0 = r * rh;
   g.fillStyle = '#1a110c'; g.fillRect(0, y0, w, rh);
   let x = 14;
   while (x < w - 30){
    const t = titles[n++ % titles.length] || '';
    const bw = 34 + Math.floor(R() * 30), bh = rh * (.72 + R() * .2);
    if (R() < .06){ x += 22; continue; }        // a gap
    if (R() < .05){                             // a book lying flat
     g.fillStyle = SPINE_COLORS[Math.floor(R() * SPINE_COLORS.length)]; g.fillRect(x, y0 + rh - 34, 150, 26); x += 158; continue;
    }
    g.fillStyle = SPINE_COLORS[Math.floor(R() * SPINE_COLORS.length)];
    g.fillRect(x, y0 + rh - 14 - bh, bw, bh);
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 3, y0 + rh - 14 - bh, 4, bh);
    g.fillStyle = '#c9a85a'; g.fillRect(x + 2, y0 + rh - 14 - bh + 14, bw - 4, 3); g.fillRect(x + 2, y0 + rh - 34, bw - 4, 3);
    g.save(); g.translate(x + bw / 2 + 6, y0 + rh - 44); g.rotate(-Math.PI / 2);
    g.fillStyle = '#e9d9a6'; g.font = '600 17px Georgia, serif';
    let s = t.toUpperCase(); while (s.length > 4 && g.measureText(s).width > bh - 70) s = s.slice(0, -2);
    g.fillText(s.length < t.length ? s.trim() + '…' : s, 0, 0); g.restore();
    x += bw + 2;
   }
   g.fillStyle = '#4a3020'; g.fillRect(0, y0 + rh - 14, w, 14);   // shelf board
   g.fillStyle = '#7a5434'; g.fillRect(0, y0 + rh - 14, w, 3);
  }
 });
}
function plaqueTexture(line){
 return canvasTex(1400, 760, (g, w, h) => {
  const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#f4ecd6'); grad.addColorStop(1, '#e6dbbd');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8a6a3a'; g.lineWidth = 10; g.strokeRect(20, 20, w - 40, h - 40);
  g.strokeStyle = '#b8955a'; g.lineWidth = 2; g.strokeRect(38, 38, w - 76, h - 76);
  g.fillStyle = '#7a5a2e'; g.font = '600 26px Georgia, serif'; g.textAlign = 'center';
  g.fillText('LINE OF THE DAY  ◆  ' + new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' }).toUpperCase(), w / 2, 92);
  g.fillStyle = '#2a1f16';
  let size = 46, lines = [];
  const wrap = sz => { g.font = 'italic ' + sz + 'px Georgia, serif'; const out = []; let cur = ''; for (const word of ('“' + line.text + '”').split(/\s+/)){ const t = cur ? cur + ' ' + word : word; if (g.measureText(t).width > w - 180 && cur){ out.push(cur); cur = word; } else cur = t; } if (cur) out.push(cur); return out; };
  do { lines = wrap(size); size -= 2; } while (lines.length * size * 1.32 > h - 300 && size > 22);
  size += 2; g.font = 'italic ' + size + 'px Georgia, serif';
  const y0 = 130 + Math.max(0, (h - 290 - lines.length * size * 1.32) / 2) + size;
  lines.forEach((l, i) => g.fillText(l, w / 2, y0 + i * size * 1.32));
  g.fillStyle = '#5a4026'; g.font = '600 30px Georgia, serif';
  g.fillText((line.title || '') + (line.author ? '  ·  ' + line.author : ''), w / 2, h - 96);
  g.font = '22px monospace'; g.fillStyle = '#8a6a3a'; g.fillText('WALK UP AND PRESS E TO READ IT', w / 2, h - 58);
 });
}
function titleTexture(){
 return canvasTex(1600, 220, (g, w, h) => {
  g.fillStyle = '#1b2a26'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c9a85a'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#f1e2b0'; g.textAlign = 'center'; g.font = '600 92px Georgia, serif'; g.fillText('THE READING WALL', w / 2, 118);
  g.fillStyle = '#b8d8c4'; g.font = '30px Georgia, serif';
  const n = shelfBooks().length;
  g.fillText((n ? n + ' CLASSICS ON THE SHELF' : 'THE CLASSICS') + (online() ? '  ◆  75,000 MORE IN THE ONLINE LIBRARY' : '  ◆  PUBLIC DOMAIN, FREE TO READ'), w / 2, 176);
 });
}
const GEO = { box: new THREE.BoxGeometry(1, 1, 1), plane: new THREE.PlaneGeometry(1, 1) };
const mats = {};
const mat = (k, f) => mats[k] || (mats[k] = f());
function box(parent, w, h, d, m, x, y, z){ const o = new THREE.Mesh(GEO.box, m); o.scale.set(w, h, d); o.position.set(x, y, z); parent.add(o); return o; }
function plane(parent, w, h, m, x, y, z, ry = 0){ const o = new THREE.Mesh(GEO.plane, m); o.scale.set(w, h, 1); o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o; }

function build(){
 if (!State.scene) return false;
 if (root && scene === State.scene && root.parent) return true;
 dispose(); scene = State.scene; root = new THREE.Group(); root.name = 'reading-garden'; scene.add(root);
 const titles = shelfBooks().map(b => b.title).concat((lib.shelf?.giants || []).map(b => b.title));
 const list = titles.length ? titles : ['Pride and Prejudice', 'Moby Dick', 'Frankenstein', 'Dracula', 'Walden', 'The Odyssey', 'Hamlet', 'Jane Eyre', 'Leaves of Grass', 'The Republic', 'Ulysses', 'Meditations'];
 //  Book spines on both faces of the wall. The plaque sits over the middle of the front.
 const front = new THREE.MeshLambertMaterial({ map: spineTexture(list, 7) }), back = new THREE.MeshLambertMaterial({ map: spineTexture(list.slice().reverse(), 11) });
 const W = WALL.x1 - WALL.x0, midY = 1.5 + (WALL.top - 2.5) / 2, H = WALL.top - 3;
 view.spines = [plane(root, W, H, front, (WALL.x0 + WALL.x1) / 2, midY, WALL.z - .02, Math.PI), plane(root, W, H, back, (WALL.x0 + WALL.x1) / 2, midY, WALL.z + 1.02, 0)];
 //  Shelf board edges catching the light, for depth.
 for (const z of [WALL.z - .06]) for (let k = 0; k <= 4; k++) box(root, W, .06, .12, mat('board', () => new THREE.MeshLambertMaterial({ color: 0x334854 })), (WALL.x0 + WALL.x1) / 2, midY - H / 2 + k * H / 4, z);
 //  The plaque with today's passage, in a brass frame, lit from below.
 const pl = new THREE.Group(); pl.position.set(CX, 2.9, WALL.z - .14); root.add(pl);
 box(pl, 5.6, 2.2, .1, mat('brass', () => new THREE.MeshLambertMaterial({ color: 0x779aab })), 0, 0, .03);
 view.plaque = plane(pl, 5.3, 2, new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0, -.03, Math.PI);
 box(pl, 5.7, .06, .3, mat('lampbar', () => new THREE.MeshBasicMaterial({ color: 0xffe2a8 })), 0, -1.2, -.25);
 //  The title band along the cornice.
 const tb = plane(root, 8, .85, new THREE.MeshBasicMaterial({ map: titleTexture() }), CX, WALL.top + .15, WALL.z - .08, Math.PI); tb.name = 'reading-wall-title';
 //  Reading lamps either side of the plaque.
 for (const s of [-1, 1]){
  const g = new THREE.Group(); g.position.set(CX + s * 4.3, 1, WALL.z - .7); root.add(g);
  box(g, .1, 2.4, .1, mat('iron', () => new THREE.MeshLambertMaterial({ color: 0x1c1d1f })), 0, 1.2, 0);
  box(g, .5, .12, .5, mat('iron', null), 0, .06, 0);
  box(g, .5, .22, .34, mat('shade', () => new THREE.MeshLambertMaterial({ color: 0x2f5a46 })), 0, 2.45, -.1);
  box(g, .36, .05, .22, mat('bulb', () => new THREE.MeshBasicMaterial({ color: 0xffd99a })), 0, 2.33, -.1);
  view.lanterns.push(g);
 }
 // Rounded tree crowns sit above the walking volume; trunks remain solid voxels.
 const crownMat=mat('crown',()=>new THREE.MeshStandardMaterial({color:0x578b7b,roughness:.9}));
 for(const [x,z]of TREES)for(const [dx,y,dz,r]of [[0,5.8,0,1.9],[-1,5.3,.4,1.3],[.9,6.1,-.3,1.2]]){
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(r,2),crownMat);crown.position.set(x+.5+dx,y,z+.5+dz);crown.scale.y=.7;root.add(crown);
 }
 //  Flowers: stems and heads in four colours, on the beds and along the lawn edges.
 const R = rand(4242), spots = [];
 for (const b of FLOWERBEDS) for (let k = 0; k < (b.x1 - b.x0) * (b.z1 - b.z0) * 5; k++) spots.push([b.x0 + .15 + R() * (b.x1 - b.x0 - .3), b.z0 + .15 + R() * (b.z1 - b.z0 - .3)]);
 for (let k = 0; k < 90; k++){ const x = LAWN.x0 + R() * (LAWN.x1 - LAWN.x0), z = LAWN.z0 + R() * (LAWN.z1 - LAWN.z0 - 1); if (PATH(Math.floor(x), Math.floor(z)) || COURT(Math.floor(x), Math.floor(z)) || POOLS.some(p => inRect(x, z, { x0: p.x0 - .5, x1: p.x1 + .5, z0: p.z0 - .5, z1: p.z1 + .5 })) || near(Math.floor(x), Math.floor(z), TREES, 1.2)) continue; spots.push([x, z]); }
 const stems = new THREE.InstancedMesh(GEO.box, mat('stem', () => new THREE.MeshLambertMaterial({ color: 0x4f7a3e })), spots.length);
 const COLORS = [0xe8b04a, 0xd85a6a, 0xf0ead8, 0x8a6ad8, 0xe07a3a];
 const heads = new THREE.InstancedMesh(GEO.box, mat('petal', () => new THREE.MeshLambertMaterial({ color: 0xffffff })), spots.length);
 const col = new THREE.Color(), o = new THREE.Object3D();
 spots.forEach(([x, z], i) => {
  const h = .25 + R() * .35;
  o.rotation.set(0, R() * 3, 0); o.position.set(x, 1 + h / 2, z); o.scale.set(.04, h, .04); o.updateMatrix(); stems.setMatrixAt(i, o.matrix);
  o.position.set(x, 1 + h + .05, z); o.scale.set(.16, .1, .16); o.updateMatrix(); heads.setMatrixAt(i, o.matrix);
  heads.setColorAt(i, col.setHex(COLORS[Math.floor(R() * COLORS.length)]));
 });
 root.add(stems, heads);
 //  Water over the pools: a moving sheen that picks up the sky's tint.
 for (const p of POOLS){
  const w = plane(root, p.x1 - p.x0 - 2, p.z1 - p.z0 - 2, new THREE.MeshLambertMaterial({ color: 0x388e9d, transparent: true, opacity: .78, emissive: 0x0c2630 }), (p.x0 + p.x1) / 2, 1.04, (p.z0 + p.z1) / 2);
  w.rotation.x = -Math.PI / 2; view.water.push(w);
 }
 //  Path lanterns along the central walk.
 for (const z of [31.5, 33.5]) for (const x of [164.75, 169.25]){
  const g = new THREE.Group(); g.position.set(x, 1, z); root.add(g);
  box(g, .08, .9, .08, mat('iron', null), 0, .45, 0);
  const l = box(g, .22, .26, .22, mat('lantern', () => new THREE.MeshBasicMaterial({color:0xb6eee2})), 0, 1, 0); view.lanterns.push(l);
 }
 //  Fireflies over the lawns at night, and loose pages drifting around the wall.
 const n = 70, pos = new Float32Array(n * 3), seeds = [];
 for (let i = 0; i < n; i++) seeds.push({ x: LAWN.x0 + R() * (LAWN.x1 - LAWN.x0), z: LAWN.z0 + R() * (LAWN.z1 - LAWN.z0), y: 1.4 + R() * 2.4, p: R() * TAU, s: .3 + R() * .6 });
 const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
 view.fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xd8ff8a, size: .11, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
 view.fireflies.userData.seeds = seeds; view.fireflies.frustumCulled = false; root.add(view.fireflies);
 const pageMat = mat('page', () => new THREE.MeshLambertMaterial({ map: canvasTex(64, 80, (g, w, h) => { g.fillStyle = '#efe6cf'; g.fillRect(0, 0, w, h); g.fillStyle = '#9a8e76'; for (let y = 10; y < h - 6; y += 6) g.fillRect(6, y, w - 12 - (y % 18 ? 0 : 14), 2); }), side: THREE.DoubleSide, transparent: true }));
 for (let i = 0; i < 9; i++){ const p = plane(root, .34, .44, pageMat, CX, 6, WALL.z); p.userData = { a: i / 9 * TAU, r: 4 + R() * 3, y: 4.5 + R() * 3, v: (.08 + R() * .12) * (R() < .5 ? -1 : 1), spin: R() * 3 }; view.pages.push(p); }
 view.plaqueKey = '';
 Promise.resolve().then(refreshPlaque);
 return true;
}
function dispose(){
 if (!root) return;
 root.removeFromParent();
 const shared = new Set(Object.values(mats));
 root.traverse(o => { if (o.geometry && o.geometry !== GEO.box && o.geometry !== GEO.plane) o.geometry.dispose(); if (o.material && !shared.has(o.material)){ o.material.map?.dispose(); o.material.dispose(); } });
 root = null; view.plaque = null; view.spines = []; view.fireflies = null; view.pages = []; view.water = []; view.lanterns = [];
}
async function refreshPlaque(){
 if (!view.plaque) return;
 const line = await lineOfDay();
 const key = line.key + line.text.slice(0, 20);
 if (!view.plaque || view.plaqueKey === key) return;
 view.plaqueKey = key;
 const t = plaqueTexture(line);
 view.plaque.material.map?.dispose(); view.plaque.material.map = t; view.plaque.material.needsUpdate = true;
}

// ─── The reader ────────────────────────────────────────────────────────────
const css = document.createElement('style');
css.textContent = `
#rw-approach{position:fixed;bottom:110px;left:50%;transform:translateX(-50%);z-index:125001;border:1px solid #c9a85a;border-radius:30px;padding:13px 22px;background:#1b2a26;color:#f1e2b0;font:14px Georgia,serif;cursor:pointer;max-width:calc(100vw - 32px)}
#rw-approach[hidden]{display:none}
body.rw-near #maker-interact,body.rw-near #cg-approach{display:none!important}
body.rw-reading #city-online,body.rw-reading #maker-goal,body.rw-reading .social-dock{visibility:hidden}
#rw-panel{position:fixed;inset:4vh max(10px,calc((100vw - 1120px)/2));z-index:140000;display:grid;grid-template-columns:270px 1fr;border-radius:20px;overflow:hidden;background:#f4ecd8;color:#2a1f16;border:1px solid #b8955a;box-shadow:0 0 0 100vmax #0a0806b0,0 24px 100px #0009;font:15px/1.5 system-ui}
#rw-panel *{box-sizing:border-box}
#rw-panel aside{background:#1b2a26;color:#f1e2b0;padding:22px 16px;display:flex;flex-direction:column;gap:6px;min-height:0;overflow:auto}
#rw-panel aside h2{font:600 30px/1.02 Georgia,serif;margin:0 0 4px}
#rw-panel aside small{font:11px/1.6 monospace;letter-spacing:.08em;color:#b8d8c4}
#rw-panel aside nav{display:flex;flex-direction:column;gap:3px;margin-top:8px}
#rw-panel button,#rw-panel select,#rw-panel input{font:inherit;min-height:40px;border-radius:18px;padding:7px 14px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer}
#rw-panel aside nav button{border:0;border-radius:10px;text-align:left;min-height:36px;padding:6px 10px;font-size:14px}
#rw-panel aside nav button[aria-current=true]{background:#f1e2b0;color:#1b2a26}
#rw-panel button:focus-visible,#rw-panel input:focus-visible,#rw-panel select:focus-visible{outline:2px solid #c9a85a;outline-offset:2px}
#rw-panel main{overflow:auto;overscroll-behavior:contain;padding:26px clamp(16px,5vw,64px);min-height:0}
#rw-panel .kick{font:11px monospace;letter-spacing:.2em;color:#7a5a2e}
#rw-panel h3{font:600 32px/1.1 Georgia,serif;margin:6px 0 4px}
#rw-panel .sub{font:italic 18px Georgia,serif;color:#5a4026;margin:0 0 6px}
#rw-panel .div{color:#b48a3c;letter-spacing:10px;margin:12px 0 20px}
#rw-panel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
#rw-panel .book{display:flex;flex-direction:column;align-items:flex-start;text-align:left;border-radius:12px;border:1px solid #c9b38a;background:#fbf6e8;padding:12px 14px;min-height:96px;color:#2a1f16}
#rw-panel .book b{font:600 17px/1.2 Georgia,serif}
#rw-panel .book span{font-size:13px;color:#6a5236;margin-top:4px}
#rw-panel .book i{font:11px monospace;color:#8a6a3a;margin-top:auto;padding-top:6px;font-style:normal}
#rw-panel article{max-width:700px;margin:0 auto}
#rw-panel article p.body{font:19px/1.75 Georgia,serif;margin:0 0 1.05em;white-space:pre-line}
#rw-panel article.small p.body{font-size:16px}#rw-panel article.large p.body{font-size:22px}
#rw-panel .tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 18px}
#rw-panel .tools select{max-width:min(420px,100%)}
#rw-panel footer{display:flex;justify-content:space-between;gap:10px;max-width:700px;margin:30px auto 10px}
#rw-panel .quote{font:italic 24px/1.5 Georgia,serif;border-left:3px solid #c9a85a;padding-left:18px;margin:18px 0}
#rw-panel .note{font-size:13px;color:#6a5236}
#rw-panel .search{display:flex;gap:8px;margin:12px 0 16px}#rw-panel .search input{flex:1;border-radius:12px;background:#fffdf6;border-color:#c9b38a;cursor:text}
#rw-panel a{color:#1b5a46}
@media(max-width:760px){#rw-panel{inset:6px;grid-template-columns:1fr;grid-template-rows:auto 1fr;border-radius:14px}#rw-panel aside{padding:10px 12px;flex-direction:row;flex-wrap:wrap;align-items:center}#rw-panel aside h2{font-size:20px;flex:1}#rw-panel aside small{display:none}#rw-panel aside nav{flex-direction:row;flex-wrap:wrap;margin:0;width:100%}#rw-panel aside nav button{min-height:32px;padding:3px 9px;font-size:12px}#rw-panel main{padding:16px}#rw-panel h3{font-size:24px}#rw-panel article p.body{font-size:17px}}`;
document.head.append(css);
const prompt = document.createElement('button'); prompt.id = 'rw-approach'; prompt.hidden = true; prompt.textContent = 'E · The Reading Wall'; prompt.onclick = () => open(); document.body.append(prompt);
let panel = null, priorPause = false, oldFocus = null, view2 = { tab: 'today', book: null, chapter: 0, size: 'normal', q: '', results: null, searching: false, msg: '' };
let nearWall = false;
function blocked(){ return State.ui.paused || State.ui.inArcade || State.ui.inDialogue || State.ui.inIntro || window.CityArt?.panelOpen || window.CityBuild?.panelOpen || window.FCAccounts?.visible || window.FCNewsHub?.isOpen || window.CitySocial?.writing || window.OwnBlock?.modal || window.FCCommonGround?.isOpen || window.NPCVoices?.open || window.FCSeam?.panel; }
function open(tab){
 if (panel) return;
 oldFocus = document.activeElement; priorPause = State.ui.paused; State.ui.paused = true; State.keys?.clear?.(); document.exitPointerLock?.();
 document.body.classList.add('rw-reading');
 if (tab) view2.tab = tab;
 panel = document.createElement('section'); panel.id = 'rw-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'The Reading Wall');
 document.body.append(panel); render(); panel.querySelector('[data-close]')?.focus();
 Promise.all([loadShelf(), lineOfDay()]).then(() => panel && render());
}
function close(){ if (!panel) return; panel.remove(); panel = null; document.body.classList.remove('rw-reading'); State.ui.paused = priorPause; State.keys?.clear?.(); oldFocus?.focus?.(); }
function bookCard(b){ return `<button class="book" data-open="${b.id}"><b>${esc(b.title)}</b><span>${esc(b.author || '')}</span><i>${b.online ? 'ONLINE LIBRARY' : b.words ? Math.round(b.words / 1000) + 'K WORDS · ' + b.chapters + ' PARTS' : '#' + b.id}</i></button>`; }
function mainHTML(){
 const v = view2;
 if (v.book){
  const b = v.book;
  if (b.loading) return `<article><p class="kick">THE READING WALL</p><h3>Opening the book…</h3><p class="note">Fetching it the first time can take a moment.</p></article>`;
  if (b.error) return `<article><p class="kick">THE READING WALL</p><h3>That book is out of reach.</h3><p class="note">${esc(b.error)}</p><button data-back>Back to the shelves</button></article>`;
  const ch = b.chapters[v.chapter] || b.chapters[0], n = b.chapters.length;
  return `<article class="${v.size}"><p class="kick">THE READING WALL · ${String(v.chapter + 1).padStart(2, '0')} / ${n}</p><h3>${esc(b.title)}</h3><p class="sub">${esc(b.author)}${b.translator ? ', translated by ' + esc(b.translator) : ''}</p>
  <div class="tools"><button data-back>← Shelves</button><select aria-label="Chapter" data-chapter>${b.chapters.map((c, i) => `<option value="${i}"${i === v.chapter ? ' selected' : ''}>${esc(c.title.slice(0, 70))}</option>`).join('')}</select><button data-size="small" aria-label="Smaller text">A−</button><button data-size="large" aria-label="Larger text">A+</button></div>
  <div class="div">◆ ◆ ◆</div><p class="kick">${esc(ch.title)}</p>${ch.paras.map(p => `<p class="body">${esc(p)}</p>`).join('')}
  <footer><button data-step="-1" ${v.chapter ? '' : 'disabled'}>← Previous</button><button data-step="1" ${v.chapter < n - 1 ? '' : 'disabled'}>Next →</button></footer>
  <p class="note">${esc(b.rights || 'Public domain in the USA.')} Text from <a href="${esc(b.source)}" target="_blank" rel="noopener noreferrer">${esc(String(b.source).replace(/^https?:\/\/(www\.)?/, ''))}</a>.</p></article>`;
 }
 if (v.tab === 'today'){
  const t = lib.today;
  return `<article><p class="kick">LINE OF THE DAY · ${esc(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase())}</p>${t ? `<p class="quote">“${esc(t.text)}”</p><p class="sub">${esc(t.title)}${t.author ? ', ' + esc(t.author) : ''}${t.chapter ? ' · ' + esc(t.chapter) : ''}</p>${t.id ? `<button data-open="${t.id}" data-chapter-title="${esc(t.chapter || '')}" style="margin-top:8px">Read it in the book</button>` : ''}` : '<h3>Finding today’s line…</h3>'}
  <div class="div">◆ ◆ ◆</div><p class="note">A new passage goes up on the wall every day, chosen from the shelf. Everyone in the city sees the same one.</p>
  ${lib.shelf ? '' : '<p class="note">This edition has no starter shelf installed. ' + (online() ? 'The online library still works: search above.' : '') + '</p>'}</article>`;
 }
 if (v.tab === 'search'){
  return `<p class="kick">THE ONLINE LIBRARY</p><h3>Every public-domain book in Project Gutenberg.</h3>
  ${online() ? `<form class="search" data-search><input name="q" value="${esc(v.q)}" placeholder="Title or author: Tolstoy, Persuasion, ghost stories…" aria-label="Search the library" autocomplete="off"><button>Search</button></form>` : '<p class="note">Searching the full library needs the online game.</p>'}
  ${v.searching ? '<p class="note">Searching…</p>' : ''}${v.msg ? `<p class="note">${esc(v.msg)}</p>` : ''}
  ${v.results ? (v.results.length ? `<div class="grid">${v.results.map(bookCard).join('')}</div>` : '<p class="note">Nothing found. Try an author’s surname, or fewer words.</p>') : ''}`;
 }
 if (v.tab === 'giants'){
  return `<p class="kick">THE GREAT BIG ONES · ONLINE</p><h3>Too heavy for the shelf.</h3><p class="note">${online() ? 'These are fetched from the online library when you open them.' : 'These need the online game.'}</p><div class="grid">${(lib.shelf?.giants || []).map(b => bookCard({ ...b, online: true })).join('')}</div>`;
 }
 const shelf = (lib.shelf?.shelves || []).find(s => s.name === v.tab);
 if (shelf) return `<p class="kick">ON THE SHELF</p><h3>${esc(shelf.name)}</h3><div class="div">◆ ◆ ◆</div><div class="grid">${shelf.books.map(bookCard).join('')}</div>`;
 return `<h3>The shelf is loading…</h3>`;
}
function render(){
 if (!panel) return;
 const scroll = panel.querySelector('main')?.scrollTop || 0, keep = view2.book && !view2._jump;
 const tabs = [['today', 'Line of the day'], ...(lib.shelf?.shelves || []).map(s => [s.name, s.name]), ...(lib.shelf?.giants?.length ? [['giants', 'The big ones · online']] : []), ['search', 'Search everything']];
 panel.innerHTML = `<aside><small>COMMON GROUND · THE READING GARDEN</small><h2>The Reading Wall.</h2><small>${shelfBooks().length ? shelfBooks().length + ' CLASSICS HERE' : 'THE CLASSICS'}${online() ? ' · 75,000 ONLINE' : ''}</small><nav>${tabs.map(([id, l]) => `<button data-tab="${esc(id)}" aria-current="${!view2.book && view2.tab === id}">${esc(l)}</button>`).join('')}</nav><span style="flex:1"></span><button data-close style="border-color:#f1e2b0">Back to the garden ×</button></aside><main>${mainHTML()}</main>`;
 if (keep) panel.querySelector('main').scrollTop = scroll; view2._jump = false;
 panel.querySelector('[data-close]').onclick = close;
 panel.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { view2.tab = b.dataset.tab; view2.book = null; view2._jump = true; render(); if (view2.tab === 'search') panel.querySelector('[data-search] input')?.focus(); });
 panel.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openBook(+b.dataset.open, b.dataset.chapterTitle));
 panel.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { view2.book = null; view2._jump = true; render(); });
 panel.querySelectorAll('[data-step]').forEach(b => b.onclick = () => go(view2.chapter + Number(b.dataset.step)));
 panel.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { const order = ['small', 'normal', 'large'], i = order.indexOf(view2.size) + (b.dataset.size === 'large' ? 1 : -1); view2.size = order[Math.max(0, Math.min(2, i))]; render(); });
 const sel = panel.querySelector('[data-chapter]'); if (sel) sel.onchange = () => go(+sel.value);
 const f = panel.querySelector('[data-search]'); if (f) f.onsubmit = e => { e.preventDefault(); search(new FormData(f).get('q')); };
}
function go(i){ const b = view2.book; if (!b?.chapters) return; view2.chapter = Math.max(0, Math.min(b.chapters.length - 1, i)); view2._jump = true; render(); panel.querySelector('main').scrollTop = 0; }
async function openBook(id, chapterTitle){
 view2.book = { loading: true }; view2.chapter = 0; view2._jump = true; render();
 const b = await loadBook(id);
 if (!panel) return;
 //  Start at the passage's chapter if there is one, else skip the title pages.
 let at = b.chapters ? b.chapters.findIndex(c => c.title === chapterTitle) : -1;
 if (at < 0) at = b.chapters && b.chapters.length > 1 && b.chapters[0].title === 'Opening' ? 1 : 0;
 view2.book = b; view2.chapter = at; view2._jump = true; render(); panel.querySelector('main').scrollTop = 0;
 panel.querySelector('[data-back]')?.focus();
}
async function search(q){
 q = String(q || '').trim(); view2.q = q; if (!q) return;
 view2.searching = true; view2.msg = ''; render();
 try {
  const r = await fetch('/api/classics/search?q=' + encodeURIComponent(q), { signal: AbortSignal.timeout(60000) }), j = await r.json();
  view2.results = r.ok ? j.results || [] : []; view2.msg = !r.ok ? j.error || 'Search failed.' : j.ready === false ? j.error || 'The library is waking up. Try again in a moment.' : j.total > 30 ? j.total.toLocaleString() + ' matches; the first 30 shown.' : '';
 } catch (e){ view2.results = []; view2.msg = 'The online library did not answer. Try again in a moment.'; }
 view2.searching = false; render(); panel?.querySelector('[data-search] input')?.focus();
}
window.addEventListener('keydown', e => {
 if (panel){
  if (e.code === 'Escape'){ close(); e.stopImmediatePropagation(); return; }
  if (e.target.matches?.('input')) { e.stopImmediatePropagation(); return; }
  if (view2.book?.chapters && (e.code === 'ArrowRight' || e.code === 'ArrowLeft') && !/SELECT/.test(e.target.tagName)) go(view2.chapter + (e.code === 'ArrowRight' ? 1 : -1));
  else if (e.code === 'Tab'){ const nodes = [...panel.querySelectorAll('button:not([disabled]),select,input,a[href]')], i = nodes.indexOf(document.activeElement); e.preventDefault(); nodes[(i + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length]?.focus(); }
  e.stopImmediatePropagation(); return;
 }
 if (e.code === 'KeyE' && !e.repeat && !prompt.hidden && nearWall){ e.preventDefault(); e.stopImmediatePropagation(); open(); }
}, true);

// ─── Every frame ───────────────────────────────────────────────────────────
let last = performance.now(), slow = 0;
function visible(){ return !!window.OwnBlock?.state?.enabled && !!window.OwnBlock?.ready && !State.ui.inIntro; }
function tick(now){
 requestAnimationFrame(tick);
 const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
 try {
  if (!State.scene || !visible()){ if (root) root.visible = false; prompt.hidden = true; nearWall = false; return; }
  const px = Player.position.x, pz = Player.position.z, d = Math.hypot(px - CX, pz - 36);
  if (d > 110){ if (root) root.visible = false; prompt.hidden = true; nearWall = false; return; }
  if (!lib.shelfTried){ loadShelf().then(() => { dispose(); }); }
  if (!build()) return;
  root.visible = true;
  if (now - slow > 5000){ slow = now; refreshPlaque(); }
  const t = now / 1000, night = isNight();
  for (const w of view.water){ w.material.emissive.setHex(night ? 0x16404a : 0x0c2630); w.position.y = 1.04 + Math.sin(t * 1.3 + w.position.x) * .01; }
  if (view.fireflies){
   view.fireflies.material.opacity = night ? .9 : 0;
   if (night){ const s = view.fireflies.userData.seeds, a = view.fireflies.geometry.attributes.position.array; for (let i = 0; i < s.length; i++){ const f = s[i]; a[i * 3] = f.x + Math.sin(t * f.s + f.p) * .8; a[i * 3 + 1] = f.y + Math.sin(t * f.s * 1.7 + f.p) * .3; a[i * 3 + 2] = f.z + Math.cos(t * f.s * .8 + f.p) * .8; } view.fireflies.geometry.attributes.position.needsUpdate = true; }
  }
  for (const p of view.pages){ const u = p.userData; u.a += u.v * dt; p.position.set(CX + Math.cos(u.a) * u.r, u.y + Math.sin(t * .7 + u.spin) * .4, WALL.z + .5 + Math.sin(u.a) * u.r * .55); p.rotation.set(Math.sin(t + u.spin) * .6, t * .5 + u.spin, Math.cos(t * .8 + u.spin) * .4); }
  //  In reach: standing in the reading court in front of the wall.
  const feet = Player.position.y - Player.height;
  nearWall = !panel && px > WALL.x0 - .5 && px < WALL.x1 + .5 && pz > WALL.z - 3.4 && pz < WALL.z && feet < 3;
  const show = nearWall && !blocked();
  prompt.hidden = !show;
  document.body.classList.toggle('rw-near', show);
 } catch (e){ if (!tick._w){ tick._w = 1; console.warn('[reading-garden]', e); } }
}
requestAnimationFrame(tick);

window.FCReadingGarden = {
 CX, WALL, POOLS, TREES, READ_AT, open, close, loadShelf, loadBook, lineOfDay, passage, search,
 get isOpen(){ return !!panel; }, get near(){ return nearWall; }, get shelf(){ return lib.shelf; }, get root(){ return root; }, get view(){ return view2; },
};
})();
