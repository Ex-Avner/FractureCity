/* The Seam: farmland in the crack.

   When the news broke reality, the city split open east of Makers' Mile. The
   ground heaved up, a fissure of dead-channel light opened through it, and
   slabs of street hang over the crack where they came loose. Things grow
   there that should not: headline wheat, static melons, echo corn, sodium
   tubers.

   The loop, Clash-of-Clans shaped:
     plant (real-time growth, offline too) → harvest → sell at the Ledger,
     at prices moved by the real news wire → unlock plots, build lamp-wards,
     raise the Retraction fence → defend the crops from Misprints at night.
   Every day's sky hue (sodium-noir.js) is also the Seam's almanac: one crop
   grows fast, one creature migrates, or the market or the raids change.
   The creatures in the Seam can be tamed by feeding them the crop they love,
   then set to guard the farm or follow you around the city.

   Signed-in server players save farm state to their account; anonymous/offline play stays on this device. Growth
   runs on the real clock, so it continues while you are away. */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined' || typeof Chunk === 'undefined') return;

const TAU = Math.PI * 2;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let SKEW = 0;
const now = () => (window.FCResidentLife?.now() ?? Date.now()) + (window.FCResidentLife?.enabled ? 0 : SKEW);
const hour = () => (((State.dayTime || 0) / 60) % 24 + 24) % 24;
const isNight = () => { const h = hour(); return h >= 20 || h < 5; };
const fmt = ms => { ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + ':' + String(s).padStart(2, '0'); };
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ─── Layout (world blocks). Fixed: plot and ward indices are a save format. ──
//  Chunks 10..11 × 0..1. A five-block road ring keeps the neighbours' streets
//  whole; inside it the ground is heaved up one block, which also keeps cars out.
const BOUNDS = { x0: 240, x1: 288, z0: 0, z1: 48 };
const IN = { x0: 245, x1: 283, z0: 5, z1: 43 };
const KEYS = new Set(['10,0', '11,0', '10,1', '11,1']);
const FISSURE = [[252, 6], [258, 13], [263, 11], [270, 24], [266, 30], [276, 35], [281, 40]];
const BEDS = [[249, 17], [249, 32], [255, 24], [256, 31], [249, 39], [262, 24], [256, 38], [263, 36], [271, 12], [270, 39], [275, 20], [276, 27]];
const WARDS = [[251.5, 35.5], [257.5, 27.5], [264.5, 39.5], [269.5, 17.5], [252.5, 18.5], [272.5, 24.5]];
const LEDGER = { x0: 245, x1: 251, z0: 21, z1: 28, counter: { x: 244.2, z: 24.5 } };
const GROUND = 2, BED_TOP = 3;

function segDist(x, z, a, b){ const dx = b[0] - a[0], dz = b[1] - a[1]; let t = ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz); t = clamp(t, 0, 1); return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); }
function fissureDist(x, z){ let d = Infinity; for (let i = 1; i < FISSURE.length; i++) d = Math.min(d, segDist(x, z, FISSURE[i - 1], FISSURE[i])); return d; }
function fissureWidth(x, z){ return 1.05 + ((hash(Math.floor(x / 3) + ':' + Math.floor(z / 3)) % 100) / 100) * 0.55; }
const inInterior = (x, z) => x >= IN.x0 && x < IN.x1 && z >= IN.z0 && z < IN.z1;
const inSeamXZ = (x, z) => x >= BOUNDS.x0 && x < BOUNDS.x1 && z >= BOUNDS.z0 && z < BOUNDS.z1;
const isFissure = (x, z) => x >= IN.x0 + 1 && x < IN.x1 - 1 && z >= IN.z0 + 1 && z < IN.z1 - 1 && fissureDist(x + .5, z + .5) < fissureWidth(x, z);
const bedAt = (x, z) => BEDS.findIndex(([cx, cz]) => x >= cx - 3 && x < cx + 3 && z >= cz - 3 && z < cz + 3);
const inLedger = (x, z) => x >= LEDGER.x0 && x < LEDGER.x1 && z >= LEDGER.z0 && z < LEDGER.z1;
//  Fissure cells for spawning, sparks and the eel.
const FISSURE_CELLS = [];
for (let x = IN.x0; x < IN.x1; x++) for (let z = IN.z0; z < IN.z1; z++) if (isFissure(x, z)) FISSURE_CELLS.push([x + .5, z + .5]);

// ─── Blocks ────────────────────────────────────────────────────────────────
const B_SEAMGLOW = shDefBlock(150, { name: 'seam light', solid: true, emit: true, color: 0xa8f6ff, grain: 0.02 });
const B_HEAVE = shDefBlock(151, { name: 'heaved ground', solid: true, emit: false, color: 0x585063, grain: 0.22 });
const B_SEAMSOIL = shDefBlock(152, { name: 'seam soil', solid: true, emit: false, color: 0x5c3a4a, grain: 0.26 });
const B_SLAB = shDefBlock(153, { name: 'broken street', solid: true, emit: false, color: 0x2e2a36, grain: 0.12 });
if (typeof MATERIALS !== 'undefined'){
 MATERIALS[B_SEAMGLOW] = { label: 'Seam Light', cls: 'signal', hardness: 3.6, drop: B_SEAMGLOW, yield: 1, value: 12, desc: 'Whatever is under the city, glowing through the crack. It hums at the pitch of a dead channel.' };
 MATERIALS[B_HEAVE] = { label: 'Heaved Ground', cls: 'stone', hardness: 1.6, drop: B_HEAVE, yield: 1, value: 2, desc: 'Road, kerb and topsoil, pushed up together when the crack opened.' };
 MATERIALS[B_SEAMSOIL] = { label: 'Seam Soil', cls: 'organic', hardness: 0.8, drop: B_SEAMSOIL, yield: 1, value: 3, desc: 'Dark, warm, faintly ticking. Grows anything you can describe.' };
 MATERIALS[B_SLAB] = { label: 'Broken Street', cls: 'stone', hardness: 1.8, drop: B_ASPHALT, yield: 1, value: 2, desc: 'A piece of the road that came up with the rest of it.' };
}

const generate = Chunk.prototype.generate;
Chunk.prototype.generate = function(){
 if (!KEYS.has(this.key)) return generate.apply(this, arguments);
 this._maker = true; this.__cityFitted = 1; this.landmark = 'seam';
 const ox = this.originX, oz = this.originZ;
 for (let lx = 0; lx < VOX_W; lx++) for (let lz = 0; lz < VOX_W; lz++){
  const x = ox + lx, z = oz + lz;
  if (!inInterior(x, z)){
   //  The road ring, lane paint where the city would have put it.
   this.vSet(lx, 0, lz, (lz === 1 || lx === 1) ? B_PAINT : B_ASPHALT);
   continue;
  }
  if (inLedger(x, z)){ this.vSet(lx, 0, lz, B_HEAVE); this.vSet(lx, 1, lz, B_HEAVE); continue; }
  const bed = bedAt(x, z);
  if (bed >= 0){
   const [cx, cz] = BEDS[bed], edge = x === cx - 3 || x === cx + 2 || z === cz - 3 || z === cz + 2;
   this.vSet(lx, 0, lz, B_HEAVE); this.vSet(lx, 1, lz, B_SEAMSOIL); this.vSet(lx, 2, lz, edge ? B_TRUNK : B_SEAMSOIL);
   continue;
  }
  //  The crack: a dark floor with a thin seam of light down its middle.
  if (isFissure(x, z)){ this.vSet(lx, 0, lz, fissureDist(x + .5, z + .5) < .62 ? B_SEAMGLOW : B_SLAB); continue; }
  this.vSet(lx, 0, lz, B_HEAVE); this.vSet(lx, 1, lz, B_HEAVE);
  //  Jagged plates of road tipped up along the crack.
  const d = fissureDist(x + .5, z + .5), w = fissureWidth(x, z), h = hash(x + ',' + z) % 100;
  if (d < w + 1.7 && h < 52 && !nearWard(x, z)){
   //  Now and then a chip of seam light caught in the broken road.
   this.vSet(lx, 2, lz, h < 7 ? B_SEAMGLOW : B_SLAB);
   if (d < w + .9 && h < 18 && h >= 7) this.vSet(lx, 3, lz, B_SLAB);
  }
 }
 //  The Ledger: a timber shed with a lit band and a counter window on the road side.
 if (this.cx === 10 && this.cz === 0 || this.cx === 10 && this.cz === 1){
  for (let x = LEDGER.x0; x < LEDGER.x1; x++) for (let z = LEDGER.z0; z < LEDGER.z1; z++){
   if (chunkCoordOf(z) !== this.cz) continue;
   const lx = x - ox, lz = z - oz, wall = x === LEDGER.x0 || x === LEDGER.x1 - 1 || z === LEDGER.z0 || z === LEDGER.z1 - 1;
   for (let y = 2; y <= 5; y++){
    let id = wall ? B_TRUNK : B_AIR;
    if (wall && x === LEDGER.x0 && z >= 23 && z <= 25 && (y === 3 || y === 4)) id = B_AIR;          // counter window
    if (wall && x === LEDGER.x0 && z >= 23 && z <= 25 && y === 2) id = B_BRICK;                       // counter
    if (wall && y === 5 && (x === LEDGER.x0 || z === LEDGER.z0 || z === LEDGER.z1 - 1)) id = B_FASCIA; // lit band
    if (wall && x === LEDGER.x1 - 1 && z === 24 && (y === 2 || y === 3)) id = B_AIR;                    // back door to the farm
    this.vSet(lx, y, lz, id);
   }
   this.vSet(lx, 6, lz, B_ROOF);
  }
 }
};
function nearWard(x, z){ return WARDS.some(([wx, wz]) => Math.abs(x + .5 - wx) < 1.6 && Math.abs(z + .5 - wz) < 1.6); }

// ─── Crops, upgrades, almanac ──────────────────────────────────────────────
const CROPS = {
 wheat: { name: 'Headline wheat', seed: 6, mins: 4, yield: 3, price: 5, color: '#e3c66a', blurb: 'Sprouts from yesterday’s newsprint. Quick, cheap, always wanted.' },
 melon: { name: 'Static melon', seed: 14, mins: 12, yield: 2, price: 22, color: '#bfe8ef', blurb: 'Hums at the pitch of a dead channel. Eels love it.' },
 corn: { name: 'Echo corn', seed: 24, mins: 30, yield: 2, price: 40, color: '#7ff0e0', blurb: 'Every cob repeats the last thing someone said near it.' },
 tuber: { name: 'Sodium tuber', seed: 40, mins: 90, yield: 2, price: 85, color: '#ffa64a', needsWard: true, blurb: 'Only ripens under a lamp-ward. Worth the wait.' },
};
const CROP_IDS = Object.keys(CROPS);
const PLOT_COST = [0, 0, 0, 0, 40, 70, 110, 160, 220, 300, 400, 520];
const RANKS = [
 { name: 'Squatter', harvests: 0, plots: 4, wards: 2, wardLvl: 1, fence: 1 },
 { name: 'Grower', harvests: 8, plots: 6, wards: 3, wardLvl: 1, fence: 1 },
 { name: 'Allotment holder', harvests: 25, plots: 8, wards: 4, wardLvl: 2, fence: 2 },
 { name: 'Seam farmer', harvests: 60, plots: 10, wards: 5, wardLvl: 2, fence: 2 },
 { name: 'Keeper of the Crack', harvests: 120, plots: 12, wards: 6, wardLvl: 3, fence: 3 },
];
const WARD_COST = [null, { c: 60, ink: 3 }, { c: 140, ink: 10 }, { c: 280, ink: 25 }];
const FENCE_COST = [null, { c: 80, ink: 5 }, { c: 180, ink: 15 }, { c: 360, ink: 35 }];
const WARD_RADIUS = l => l ? 5.5 + l * 1.5 : 0;
const EVENTS = {
 bile: { title: 'Wheat Rush', crop: 'wheat', migrant: 'pigeon', text: 'Headline wheat grows twice as fast and gives an extra bundle. Many-winged pigeons are migrating through.' },
 bruise: { title: 'Misprint Moon', raid: 2, ink: 2, text: 'Raids are heavier tonight, and every Misprint drops double ink.' },
 rust: { title: 'Rust Market', market: 1.25, text: 'Every crop sells for a quarter more at the Ledger.' },
 chemical: { title: 'Static Bloom', crop: 'melon', migrant: 'eel', text: 'Static melons grow twice as fast. Sidewalk eels are surfacing in the fissure.' },
 nicotine: { title: 'Echo Season', crop: 'corn', migrant: 'cat', text: 'Echo corn grows twice as fast. Rumour cats are prowling the beds.' },
 ashrose: { title: 'Tuber Night', crop: 'tuber', migrant: 'moth', text: 'Sodium tubers grow twice as fast. Lamp moths are swarming the wards.' },
 oxide: { title: 'Quiet Haze', quiet: true, text: 'No Misprints come tonight. Everything grows a quarter faster and your defences count half again while you are away.' },
};
function almanac(){
 const hue = window.Grit?.hue || { id: 'oxide', name: 'Oxide Haze' };
 const day = window.Grit?._key || new Date(now()).toISOString().slice(0, 10);
 const label = new Date((String(day).match(/\d{4}-\d{2}-\d{2}/) || [new Date(now()).toISOString().slice(0, 10)])[0] + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
 return { day, label, hue, ...(EVENTS[hue.id] || EVENTS.oxide) };
}
//  Things overheard, for echo corn and the rumour cats.
const ECHOES = [
 'and that is why the weather has a press secretary now.',
 'I am not saying the river is lying. I am saying it has a publicist.',
 'they renamed the bridge again. It still goes to the same place.',
 'my landlord says the crack is a feature.',
 'nobody voted for the fog, but here it is.',
 'the Bureau issued a correction to the moon.',
 'if you hold a melon to your ear you can hear the six o’clock news from 1994.',
 'Ned says the Seam is just the city showing its working.',
 'the pigeons have unionised. Eight wings, one voice.',
 'I read the headline. I did not read the article. I have opinions.',
 'they say the slabs up there still have parking restrictions.',
 'my cousin sold a sodium tuber and bought a sofa. The sofa was also a tuber.',
 'the lamps are listening. That is why they hum.',
 'a Misprint ate my tomatoes and left a retraction.',
 'the Ledger has no owner. It just keeps accounts.',
 'every crack in this city is a story somebody did not want printed.',
];

// ─── Real news moves the market ───────────────────────────────────────────
const TOPICS = {
 wheat: /\b(food|grain|wheat|bread|farm\w*|harvest\w*|crop\w*|prices?|econom\w*|inflation|market\w*)\b/i,
 melon: /\b(tech\w*|AI|signal\w*|phone\w*|data|internet|online|radio|satellite\w*|space|software|robot\w*)\b/i,
 corn: /\b(said|says|speech|interview\w*|vot\w+|election\w*|debate\w*|rumou?r\w*|report\w*|claims?)\b/i,
 tuber: /\b(energy|power|electric\w*|light\w*|night|dark\w*|solar|grid|lamps?|nuclear|battery|batteries)\b/i,
};
const wire = { items: [], at: 0, busy: false };
async function loadWire(){
 const fromNpc = window.NPCVoices?.news?.() || [];
 if (fromNpc.length){ wire.items = fromNpc; return; }
 if (!location.pathname.startsWith('/city/') || wire.busy || wire.at && performance.now() - wire.at < (wire.items.length ? 600000 : 20000)) return;
 wire.busy = true;
 try {
  const r = await fetch('/api/news', { signal: AbortSignal.timeout(12000) });
  if (r.ok){ const d = await r.json(), ok = window.__npcNewsForTest?.okHeadline; wire.items = (d.items || []).filter(n => ok ? ok(n) : n && typeof n.title === 'string'); }
 } catch (e){} finally { wire.at = performance.now(); wire.busy = false; }
}
function market(){
 const a = almanac(), out = {};
 for (const id of CROP_IDS){
  const hits = wire.items.filter(n => TOPICS[id].test(n.title));
  const drift = 0.9 + (hash(a.day + id) % 21) / 100;
  const sold = S && S.sold.day === a.day ? (S.sold.n[id] || 0) : 0;
  const mult = (1 + 0.12 * Math.min(4, hits.length)) * drift * (a.market || 1);
  out[id] = { base: CROPS[id].price, mult, sold, unit: Math.max(1, Math.round(CROPS[id].price * mult * Math.max(0.6, 1 - 0.03 * sold))), hits: hits.length, top: hits[0] || null };
 }
 return out;
}

// ─── State ─────────────────────────────────────────────────────────────────
const fresh = () => ({
 v: 1, welcomed: false,
 plots: BEDS.map((_, i) => ({ open: i < 4, crop: null })),
 wards: WARDS.map(() => 0), fence: 0, ink: 0,
 crate: { wheat: 0, melon: 0, corn: 0, tuber: 0 }, packets: { wheat: 3, melon: 1, corn: 0, tuber: 0 },
 pets: [], trust: {}, harvests: 0, earned: 0, kills: 0, repelled: 0,
 lastSim: 0, report: null, sold: { day: '', n: {} }, seen: {},
});
let S = null, sKey = '';
const storeKey = () => 'fc-seam:' + (window.FCAccounts?.user?.username || 'local');
function load(){
 const k = storeKey();
 if (S && k === sKey) return S;
 sKey = k;
 try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(k) || 'null') || {}); } catch (e){ S = fresh(); }
 if (!Array.isArray(S.plots) || S.plots.length !== BEDS.length) S.plots = fresh().plots;
 if (!Array.isArray(S.wards) || S.wards.length !== WARDS.length) S.wards = fresh().wards;
 for (const id of CROP_IDS){ S.crate[id] |= 0; S.packets[id] |= 0; }
 if(window.FCResidentLife?.enabled && FCResidentLife.ready){
  try{if(!localStorage.getItem('fc-seam-before-cloud:'+k))localStorage.setItem('fc-seam-before-cloud:'+k,JSON.stringify(S))}catch{}
  // First migration retains elapsed crop growth even if this device clock differs.
  const delta=now()-Date.now();
  for(const p of S.plots)if(p.crop)p.crop.t0+=delta;
  if(S.lastSim)S.lastSim+=delta;
  S.credits ??= State.hud?.credits || 0;
  S=FCResidentLife.get('seam',S);
 }
 simulateAway();
 dirty = true;
 return S;
}
let saveT = 0;
function save(){ if (!S) return; try { localStorage.setItem(sKey, JSON.stringify(S)); } catch (e){} if(window.FCResidentLife?.enabled)FCResidentLife.put('seam',S); }
function rank(){ let r = 0; for (let i = 0; i < RANKS.length; i++) if (S.harvests >= RANKS[i].harvests) r = i; return r; }
function credits(){ return window.FCResidentLife?.enabled ? (S.credits || 0) : State.hud?.credits || 0; }
function spend(c){ if (credits() < c) return false; if(window.FCResidentLife?.enabled){S.credits=credits()-c;return true;} State.hud.credits -= c; try { grantCredits(0); } catch (e){} return true; }
function earn(c){ if(window.FCResidentLife?.enabled){S.credits=credits()+c;return;} try { grantCredits(c); } catch (e){ State.hud.credits += c; } }
function progress(crop){ return crop ? clamp((now() - crop.t0) / crop.dur, 0, 1) : 0; }
function wardFor(bed){ const [bx, bz] = BEDS[bed]; return WARDS.some(([wx, wz], i) => S.wards[i] > 0 && Math.hypot(bx - wx, bz - wz) <= WARD_RADIUS(S.wards[i]) + .01); }
function guards(){ return S.pets.filter(p => p.mode === 'guard'); }

//  Raids that happened while you were somewhere else. One chance every ninety
//  minutes away, six at most. Defence: wards, fence, pets on guard.
function simulateAway(){
 const t = now();
 if (!S.lastSim){ S.lastSim = t; return null; }
 const hours = (t - S.lastSim) / 3.6e6;
 if (hours < 1.5) return null;
 const a = almanac(), n = Math.min(6, Math.floor(hours / 1.5));
 S.lastSim = t;
 const rep = { at: t, hours: Math.round(hours * 10) / 10, raids: 0, repelled: 0, hits: [], ink: 0 };
 for (let i = 0; i < n; i++){
  const growing = S.plots.map((p, j) => p.crop && progress(p.crop) < 1 ? j : -1).filter(j => j >= 0);
  const ripe = S.plots.map((p, j) => p.crop ? j : -1).filter(j => j >= 0);
  if (!ripe.length) break;
  rep.raids++;
  const strength = 1.5 + ripe.length * 0.45 + Math.random() * 2 + (a.raid || 0);
  let defence = S.wards.reduce((s, l) => s + l * 1.4, 0) + S.fence * 1.5 + guards().length * 1.2;
  if (a.quiet) defence *= 1.5;
  if (defence >= strength * rnd(0.6, 1.3)){ rep.repelled++; rep.ink++; S.ink++; S.repelled++; continue; }
  const pool = growing.length ? growing : ripe, j = pool[Math.floor(Math.random() * pool.length)], c = S.plots[j].crop;
  c.t0 = Math.min(t, c.t0 + c.dur * 0.5);
  rep.hits.push(CROPS[c.id].name);
 }
 if (rep.raids){ S.report = rep; S.reportUnseen = true; }
 return rep;
}

// ─── Actions ───────────────────────────────────────────────────────────────
function plant(i, id){
 if(window.FCResidentLife?.blocked)return 'Account progress is loading or needs recovery.';
 const p = S.plots[i], c = CROPS[id], a = almanac();
 if (!p || !p.open || p.crop || !c) return 'That plot is not ready.';
 if (c.needsWard && !wardFor(i)) return 'Sodium tubers only grow under a lamp-ward. Build one beside this plot first.';
 const free = S.packets[id] > 0;
 if (!free && !spend(c.seed)) return 'You need ' + c.seed + 'c for ' + c.name.toLowerCase() + ' seed.';
 if (free) S.packets[id]--;
 let dur = c.mins * 60000, yld = c.yield;
 if (a.crop === id){ dur *= 0.5; yld += 1; }
 if (a.quiet) dur *= 0.8;
 p.crop = { id, t0: now(), dur, yield: yld, bonus: a.crop === id };
 dirty = true; save();
 return null;
}
function harvest(i){
 if(window.FCResidentLife?.blocked)return null;
 const p = S.plots[i];
 if (!p?.crop || progress(p.crop) < 1) return null;
 const c = p.crop, n = c.yield;
 S.crate[c.id] += n; S.harvests++; p.crop = null; dirty = true; save();
 const echo = c.id === 'corn' ? ECHOES[Math.floor(Math.random() * ECHOES.length)] : null;
 return { id: c.id, n, echo };
}
function sell(id, count){
 if(window.FCResidentLife?.blocked)return 0;
 const have = S.crate[id] | 0; count = Math.min(have, count == null ? have : count);
 if (count <= 0) return 0;
 const a = almanac();
 if (S.sold.day !== a.day) S.sold = { day: a.day, n: {} };
 let total = 0;
 for (let k = 0; k < count; k++){ total += market()[id].unit; S.sold.n[id] = (S.sold.n[id] || 0) + 1; }
 S.crate[id] -= count; S.earned += total; earn(total); save();
 return total;
}
function unlockPlot(i){
 if(window.FCResidentLife?.blocked)return 'Account save unavailable.';
 const r = RANKS[rank()], open = S.plots.filter(p => p.open).length, p = S.plots[i];
 if (!p || p.open) return 'Already open.';
 if (open >= r.plots) return 'Reach ' + (RANKS[rank() + 1]?.name || 'the next rank') + ' to clear more ground.';
 if (!spend(PLOT_COST[i])) return 'Clearing this plot costs ' + PLOT_COST[i] + 'c.';
 p.open = true; dirty = true; save(); return null;
}
function buildWard(i){
 if(window.FCResidentLife?.blocked)return 'Account save unavailable.';
 const r = RANKS[rank()], lvl = S.wards[i], next = lvl + 1, cost = WARD_COST[next];
 if (!cost) return 'That ward is at full strength.';
 if (!lvl && S.wards.filter(Boolean).length >= r.wards) return 'Your rank allows ' + r.wards + ' wards.';
 if (next > r.wardLvl) return 'Reach ' + (RANKS.find(x => x.wardLvl >= next)?.name || 'a higher rank') + ' to raise a ward to level ' + next + '.';
 if (S.ink < cost.ink) return 'You need ' + cost.ink + ' ink. Misprints drop it.';
 if (!spend(cost.c)) return 'You need ' + cost.c + 'c.';
 S.ink -= cost.ink; S.wards[i] = next; dirty = true; save(); return null;
}
function raiseFence(){
 if(window.FCResidentLife?.blocked)return 'Account save unavailable.';
 const next = S.fence + 1, cost = FENCE_COST[next], r = RANKS[rank()];
 if (!cost) return 'The fence is as high as it goes.';
 if (next > r.fence) return 'Reach ' + (RANKS.find(x => x.fence >= next)?.name || 'a higher rank') + ' first.';
 if (S.ink < cost.ink) return 'You need ' + cost.ink + ' ink.';
 if (!spend(cost.c)) return 'You need ' + cost.c + 'c.';
 S.ink -= cost.ink; S.fence = next; dirty = true; save(); return null;
}

// ─── Scene dressing ────────────────────────────────────────────────────────
let root = null, scene = null, dirty = true;
const GEO = { box: new THREE.BoxGeometry(1, 1, 1), plane: new THREE.PlaneGeometry(1, 1), octa: new THREE.OctahedronGeometry(.32) };
const sharedGeo = g => g === GEO.box || g === GEO.plane || g === GEO.octa;
const MATS = new Map();
function m(key, make){ let x = MATS.get(key); if (!x){ x = make(); MATS.set(key, x); } return x; }
const lam = c => m('l' + c, () => new THREE.MeshLambertMaterial({ color: c }));
const glow = c => m('g' + c, () => new THREE.MeshBasicMaterial({ color: c }));
function box(parent, w, h, d, mat, x, y, z){ const o = new THREE.Mesh(GEO.box, mat); o.scale.set(w, h, d); o.position.set(x, y, z); parent.add(o); return o; }
function canvasTex(w, h, paint){ const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
//  The static on the melons is one canvas, repainted a few times a second.
const STATIC = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return { c, g: c.getContext('2d'), t }; })();
function paintStatic(){ const g = STATIC.g, d = g.createImageData(32, 32); for (let i = 0; i < d.data.length; i += 4){ const v = 120 + Math.random() * 135; d.data[i] = v * .85; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); STATIC.t.needsUpdate = true; }
paintStatic();
const TAPE = canvasTex(256, 32, (g, w, h) => { g.fillStyle = '#e8e2cf'; g.fillRect(0, 0, w, h); g.fillStyle = '#b3241e'; g.font = 'bold 20px monospace'; g.fillText('RETRACTED · RETRACTED ·', 6, 23); });
TAPE.wrapS = THREE.RepeatWrapping;
const SLAB_TEX = canvasTex(128, 128, (g, w) => { g.fillStyle = '#2e2a36'; g.fillRect(0, 0, w, w); for (let i = 0; i < 400; i++){ g.fillStyle = `rgba(255,255,255,${Math.random() * .05})`; g.fillRect(Math.random() * w, Math.random() * w, 2, 2); } g.fillStyle = '#e6d06a'; for (let y = 6; y < w; y += 34) g.fillRect(w / 2 - 4, y, 8, 20); });

function signBoard(title, sub, w, h){ return typeof shSignPlane === 'function' ? shSignPlane(title, sub, '#a8f6ff', '#141320', w, h) : new THREE.Mesh(GEO.plane, glow(0x141320)); }

const view = { beds: [], wards: [], slabs: [], sparks: null, fence: null, lights: [], zaps: [] };
function build(){
 if (!State.scene) return false;
 if (root && scene === State.scene && root.parent) return true;
 dispose(); scene = State.scene; root = new THREE.Group(); root.name = 'the-seam'; scene.add(root);
 //  Entrance sign on the kerb, facing arrivals from Makers' Mile.
 const gate = new THREE.Group(); gate.position.set(244.6, 1, 15.5); root.add(gate);
 for (const z of [-1.7, 1.7]) box(gate, .16, 3.4, .16, lam(0x24222c), 0, 1.7, z);
 const board = signBoard('THE SEAM', 'FARMLAND IN THE CRACK · LEDGER →', 3.6, 1.0); board.position.set(-.1, 3.1, 0); board.rotation.y = -Math.PI / 2; gate.add(board);
 //  Wayfinding at Common Ground, for anyone arriving in the Main Beta.
 const way = new THREE.Group(); way.position.set(177.5, 0, 30.5); root.add(way); view.way = way;
 box(way, .12, 2.6, .12, lam(0x24222c), 0, 1.3, 0);
 const wb = signBoard('THE SEAM  →', 'FARMLAND IN THE CRACK · 70 M EAST', 2.6, .72); wb.position.set(-.08, 2.3, 0); wb.rotation.y = -Math.PI / 2; way.add(wb);
 //  The Ledger's name over its counter.
 const lsign = signBoard('THE LEDGER', 'SEEDS · MARKET · WARDS · CREATURES', 3.2, .8); lsign.position.set(LEDGER.x0 - .06, 4.7, 24.5); lsign.rotation.y = -Math.PI / 2; root.add(lsign);
 //  Slabs of street hanging over the crack.
 const slabMat = new THREE.MeshLambertMaterial({ map: SLAB_TEX });
 for (const [x, y, z, w, d, ry, extra] of [[258, 9, 12, 5, 4, .4, 'lamp'], [266, 13, 22, 6, 4.5, -.7, 'car'], [272, 8.5, 33, 4, 3.5, 1.1, ''], [262, 16, 28, 3.5, 3, .2, ''], [278, 11, 39, 4.5, 3, -.3, 'lamp']]){
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rnd(-.25, .25), ry, rnd(-.25, .25)); root.add(g);
  const s = new THREE.Mesh(GEO.box, slabMat); s.scale.set(w, .7, d); g.add(s);
  box(g, w * .96, .5, d * .96, lam(0x3b3641), 0, -.55, 0);
  if (extra === 'lamp'){ box(g, .12, 3, .12, lam(0x24222c), w * .35, 1.85, 0); box(g, .7, .14, .3, glow(0xffb057), w * .35 - .25, 3.3, 0); }
  if (extra === 'car'){ const car = new THREE.Group(); car.position.set(0, .35, 0); car.rotation.z = Math.PI; g.add(car); box(car, 1.8, .6, 3.6, lam(0xc9a43a), 0, -.3, 0); box(car, 1.5, .5, 1.8, lam(0x1c1a22), 0, -.85, -.2); for (const [wx, wz] of [[-.8, 1.1], [.8, 1.1], [-.8, -1.1], [.8, -1.1]]) box(car, .3, .6, .6, lam(0x111111), wx, .05, wz); }
  view.slabs.push({ g, y, phase: rnd(0, TAU), ry });
 }
 //  Sparks rising out of the fissure.
 const n = 140, pos = new Float32Array(n * 3), seed = [];
 for (let i = 0; i < n; i++){ const [x, z] = FISSURE_CELLS[(i * 7) % FISSURE_CELLS.length]; seed.push({ x: x + rnd(-.5, .5), z: z + rnd(-.5, .5), v: rnd(.5, 1.6), h: rnd(0, 7) }); }
 const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
 view.sparks = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbff8ff, size: .12, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending }));
 view.sparks.userData.seed = seed; view.sparks.frustumCulled = false; root.add(view.sparks);
 //  Beds and ward slots are rebuilt from the save as it changes.
 for (let i = 0; i < BEDS.length; i++){ const g = new THREE.Group(); g.position.set(BEDS[i][0], BED_TOP, BEDS[i][1]); root.add(g); view.beds.push({ g, key: '' }); }
 for (let i = 0; i < WARDS.length; i++){ const g = new THREE.Group(); g.position.set(WARDS[i][0], GROUND, WARDS[i][1]); root.add(g); view.wards.push({ g, key: '', head: null, ring: null }); }
 view.fence = new THREE.Group(); root.add(view.fence);
 dirty = true;
 return true;
}
function dispose(){
 if (!root) return;
 root.removeFromParent();
 const shared = new Set(MATS.values());
 root.traverse(o => { if (o.geometry && !sharedGeo(o.geometry)) o.geometry.dispose(); if (o.material && !shared.has(o.material) && !o.material.userData?.shared){ o.material.dispose?.(); } });
 root = null; view.beds = []; view.wards = []; view.slabs = []; view.sparks = null; view.lights = []; view.fence = null; view.zaps = []; view.way = null;
}

function clearGroup(g){ for (const c of [...g.children]){ g.remove(c); c.traverse(o => { if (o.geometry && !sharedGeo(o.geometry)) o.geometry.dispose(); }); } }
//  One crop body, at growth p (0..1).
function cropMesh(id, p, ripe){
 const g = new THREE.Group(), s = 0.3 + p * 0.7;
 if (id === 'wheat'){
  for (let k = 0; k < 5; k++){
   const a = k / 5 * TAU, r = .14, x = Math.cos(a) * r, z = Math.sin(a) * r, h = .9 * s;
   box(g, .04, h, .04, lam(ripe ? 0xc7a24a : 0x6d8a3a), x, h / 2, z);
   const paper = new THREE.Mesh(GEO.plane, m('paper', () => new THREE.MeshLambertMaterial({ map: window.FCWildlife?.NEWS_TEX || null, side: THREE.DoubleSide })));
   paper.scale.set(.2 * s, .26 * s, 1); paper.position.set(x, h + .1 * s, z); paper.rotation.set(rnd(-.4, .4), a, rnd(-.3, .3)); g.add(paper);
  }
 } else if (id === 'melon'){
  for (let k = 0; k < 3; k++) box(g, .4 * s, .05, .2 * s, lam(0x3f6a4a), Math.cos(k * 2.1) * .25, .03, Math.sin(k * 2.1) * .25);
  const mel = new THREE.Mesh(GEO.box, m('static', () => new THREE.MeshBasicMaterial({ map: STATIC.t }))); const r = .2 + .32 * p;
  mel.scale.set(r, r * .85, r * 1.1); mel.position.y = r * .42; g.add(mel);
  if (ripe) box(g, r * 1.04, .04, r * 1.14, glow(0x2a6f7a), 0, r * .85, 0);
 } else if (id === 'corn'){
  const h = 1.7 * s; box(g, .07, h, .07, lam(0x4f7d45), 0, h / 2, 0);
  for (let k = 0; k < 3; k++){ const leaf = box(g, .5 * s, .03, .12, lam(0x5f9150), .2 * s * (k % 2 ? -1 : 1), h * (.3 + k * .22), 0); leaf.rotation.z = (k % 2 ? 1 : -1) * .4; }
  if (p > .4) for (const side of [-1, 1]) box(g, .1, .32 * s, .1, ripe ? glow(0x7ff0e0) : lam(0x9fc7a2), side * .09, h * .62, .04);
 } else if (id === 'tuber'){
  for (let k = 0; k < 4; k++){ const leaf = box(g, .1, .45 * s, .3 * s, lam(0x3b5a3a), Math.cos(k * 1.6) * .12, .22 * s, Math.sin(k * 1.6) * .12); leaf.rotation.y = k * 1.6; leaf.rotation.z = .3; }
  if (p > .5) box(g, .3 * p, .18, .26 * p, ripe ? glow(0xffa64a) : lam(0x8a5a32), 0, .05, 0);
 }
 return g;
}
function refreshBeds(){
 for (let i = 0; i < view.beds.length; i++){
  const v = view.beds[i], p = S.plots[i], c = p.crop, pr = c ? progress(c) : 0, ripe = pr >= 1;
  const key = (p.open ? 'o' : 'x') + (c ? c.id + Math.floor(pr * 6) + (ripe ? 'r' : '') : '');
  if (key === v.key) continue;
  v.key = key; clearGroup(v.g);
  if (!p.open){
   //  Locked ground: rubble and a stake with a price tag.
   for (let k = 0; k < 4; k++) box(v.g, rnd(.4, .9), rnd(.2, .5), rnd(.4, .9), lam(0x2e2a36), rnd(-1.4, 1.4), .15, rnd(-1.4, 1.4)).rotation.y = rnd(0, 3);
   box(v.g, .08, 1.1, .08, lam(0x6a4a32), 0, .55, 0);
   continue;
  }
  if (!c) continue;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]){ const plantG = cropMesh(c.id, pr, ripe); plantG.scale.setScalar(1.6); plantG.position.set(x, 0, z); plantG.rotation.y = (x + z) * .7; v.g.add(plantG); }
  //  Ripe: a diamond of seam light turning over the bed, visible across the farm.
  if (ripe){ const d = new THREE.Mesh(GEO.octa, glow(0x9ff3ff)); d.position.y = 2.4; d.userData.marker = true; v.g.add(d); v.marker = d; } else v.marker = null;
 }
}
function refreshWards(){
 for (let i = 0; i < view.wards.length; i++){
  const v = view.wards[i], lvl = S.wards[i], key = 'w' + lvl;
  if (key === v.key) continue;
  v.key = key; clearGroup(v.g); v.head = null;
  if (!lvl){
   const ring = new THREE.Mesh(new THREE.RingGeometry(.5, .62, 24), m('slot', () => new THREE.MeshBasicMaterial({ color: 0x9ff3ff, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false })));
   ring.rotation.x = -Math.PI / 2; ring.position.y = .03; v.g.add(ring); v.ring = ring;
   continue;
  }
  const col = [0, 0xffa64a, 0xbff8ff, 0xff7ad9][lvl];
  box(v.g, .7, .25, .7, lam(0x24222c), 0, .12, 0);
  box(v.g, .16, 2.6 + lvl * .3, .16, lam(0x3a3844), 0, 1.3 + lvl * .15, 0);
  for (let k = 0; k < lvl; k++) box(v.g, .36, .06, .36, glow(col), 0, 1.4 + k * .35, 0);
  v.head = box(v.g, .5, .5, .5, glow(col), 0, 2.85 + lvl * .3, 0);
 }
}
function refreshFence(){
 const g = view.fence; if (!g || g.userData.lvl === S.fence) return;
 g.userData.lvl = S.fence; clearGroup(g);
 if (!S.fence) return;
 const tape = m('tape', () => new THREE.MeshBasicMaterial({ map: TAPE, side: THREE.DoubleSide, transparent: true }));
 const line = (x0, z0, x1, z1) => {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3)), ang = Math.atan2(x1 - x0, z1 - z0);
  for (let k = 0; k <= n; k++){ const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; box(g, .1, 1.3, .1, lam(0x6a4a32), x, GROUND + .65, z); }
  for (let r = 0; r < S.fence; r++){ const t = new THREE.Mesh(GEO.plane, tape); t.scale.set(len, .18, 1); t.position.set((x0 + x1) / 2, GROUND + .45 + r * .35, (z0 + z1) / 2); t.rotation.y = ang + Math.PI / 2; g.add(t); }
 };
 const a = IN.x0 + .4, b = IN.x1 - .4, c = IN.z0 + .4, d = IN.z1 - .4;
 line(a, c, b, c); line(b, c, b, d); line(b, d, a, d); line(a, d, a, LEDGER.z1 + .5); line(a, LEDGER.z0 - .5, a, c);
}

// ─── Misprints ─────────────────────────────────────────────────────────────
if (typeof ENEMY_TYPES !== 'undefined') ENEMY_TYPES.misprint = { name: 'MISPRINT', hp: 26, dmg: 6, speed: 2.5, height: .8, detectRange: 0, attackRange: 1.4, attackCooldown: 1.2, rewardCredits: [4, 9], flying: false, colors: {} };
if (typeof HITBOX !== 'undefined') HITBOX.misprint = { r: .6, from: 0, to: .85 };
const makeMesh = Enemy.prototype.makeMesh;
Enemy.prototype.makeMesh = function(rng){
 if (this.type !== 'misprint') return makeMesh.apply(this, arguments);
 const g = new THREE.Group(), body = new THREE.Group(); body.position.y = .42; g.add(body);
 const paper = m('mpaper', () => new THREE.MeshLambertMaterial({ map: window.FCWildlife?.NEWS_TEX || null, side: THREE.DoubleSide }));
 //  A crumpled front page: several sheets at odd angles.
 for (let k = 0; k < 4; k++){ const s = new THREE.Mesh(GEO.plane, paper); s.scale.set(.8 - k * .1, .6 - k * .06, 1); s.rotation.set(rnd(-.9, .9), k * .8, rnd(-.6, .6)); body.add(s); }
 const eye = new THREE.Mesh(GEO.plane, m('stamp', () => new THREE.MeshBasicMaterial({ map: canvasTex(128, 48, (c, w, h) => { c.fillStyle = '#d32a20'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffe9e0'; c.font = 'bold 26px monospace'; c.fillText('CORRECTION', 6, 33); }), side: THREE.DoubleSide })));
 eye.scale.set(.5, .19, 1); eye.position.set(0, .22, .3); body.add(eye);
 this.legs = [];
 for (let k = 0; k < 6; k++){ const side = k % 2 ? 1 : -1, z = (Math.floor(k / 2) - 1) * .2; const leg = new THREE.Group(); leg.position.set(side * .18, .38, z); g.add(leg); box(leg, .04, .45, .04, lam(0x111015), side * .14, -.18, 0).rotation.z = side * .7; this.legs.push(leg); }
 this.body = body;
 return g;
};
const raid = { next: 0, live: new Set(), warned: false, dusk: false, wave: 0 };
function spawnMisprint(){
 const cells = FISSURE_CELLS.filter(([x, z]) => Math.hypot(x - Player.position.x, z - Player.position.z) > 7);
 const [x, z] = (cells.length ? cells : FISSURE_CELLS)[Math.floor(Math.random() * (cells.length || FISSURE_CELLS.length))];
 const e = new Enemy('misprint', x, z, new RNG('mp:' + Math.random()));
 e.position.y = 1; e.group.position.copy(e.position);
 e.mp = 'seek'; e.eat = 0; e.update = misprintUpdate; e.seam = true;
 State.scene.add(e.group); State.enemies.push(e); raid.live.add(e);
 if (typeof shBurst === 'function') shBurst(x, 1.2, z, { count: 10, color: 0xbff8ff, size: .08, speed: 4, life: .6, grav: 6 });
 return e;
}
function nearestBed(x, z){
 let best = -1, bd = Infinity;
 for (let i = 0; i < BEDS.length; i++){ if (!S.plots[i].crop) continue; const d = Math.hypot(BEDS[i][0] - x, BEDS[i][1] - z); if (d < bd){ bd = d; best = i; } }
 return best;
}
function nearestCrack(x, z){ let best = FISSURE_CELLS[0], bd = Infinity; for (const c of FISSURE_CELLS){ const d = Math.hypot(c[0] - x, c[1] - z); if (d < bd){ bd = d; best = c; } } return best; }
function misprintUpdate(dt){
 if (this.state === 'dead') return;
 const t = performance.now() / 1000;
 if (this.hitFlash > 0) this.hitFlash -= dt;
 if (this.hp < this.maxHp && this.mp !== 'flee') this.mp = 'fight';
 let tx = null, tz = null, speed = this.def.speed * (1 - .15 * S.fence);
 for (const p of petBodies) if (p.pet.species === 'eel' && p.pet.mode === 'guard' && Math.hypot(p.group.position.x - this.position.x, p.group.position.z - this.position.z) < 5) speed *= .6;
 if (this.mp === 'seek'){
  this.bed = nearestBed(this.position.x, this.position.z);
  if (this.bed < 0) this.mp = 'flee';
  else { tx = BEDS[this.bed][0]; tz = BEDS[this.bed][1]; if (Math.hypot(tx - this.position.x, tz - this.position.z) < 1.7){ this.mp = 'eat'; this.eat = 3.5; } }
 }
 if (this.mp === 'eat'){
  this.eat -= dt;
  if (this.body) this.body.rotation.y += dt * 9;
  if (this.eat <= 0){
   const c = S.plots[this.bed]?.crop;
   if (c){ c.t0 = Math.min(now(), c.t0 + c.dur * .35); dirty = true; save(); toast('A Misprint chewed through your ' + CROPS[c.id].name.toLowerCase() + '. It’s set back.', 'fail'); }
   this.mp = 'flee';
  }
 }
 if (this.mp === 'fight'){
  tx = Player.position.x; tz = Player.position.z;
  const d = Math.hypot(tx - this.position.x, tz - this.position.z);
  this.attackTimer -= dt;
  if (d < this.def.attackRange && this.attackTimer <= 0 && !(typeof Peace !== 'undefined' && Peace.on)){ this.attackTimer = this.def.attackCooldown; try { damagePlayer(this.def.dmg); } catch (e){} }
  if (d < 1.1){ tx = null; }
  if (d > 30) this.mp = 'flee';
 }
 if (this.mp === 'flee'){
  const c = this.crack || (this.crack = nearestCrack(this.position.x, this.position.z));
  tx = c[0]; tz = c[1];
  if (Math.hypot(tx - this.position.x, tz - this.position.z) < .8){ this.state = 'dead'; this.deadTimer = 0; this.group.visible = false; raid.live.delete(this); return; }
 }
 if (tx !== null){
  const dx = tx - this.position.x, dz = tz - this.position.z, d = Math.hypot(dx, dz) || 1, step = Math.min(d, speed * dt);
  const nx = this.position.x + dx / d * step, nz = this.position.z + dz / d * step;
  const ny = typeof shSurfaceY === 'function' ? shSurfaceY(nx, nz, this.position.y + 1.4) : this.position.y;
  //  Climb a step; anything taller, sidle along it, and after a while just scramble over.
  if (ny - this.position.y <= 1.2 || this.stuck > 2){ this.position.x = nx; this.position.z = nz; this.position.y = ny; this.stuck = 0; }
  else { this.stuck = (this.stuck || 0) + dt; const sx = this.position.x - dz / d * step, sz = this.position.z + dx / d * step, sy = typeof shSurfaceY === 'function' ? shSurfaceY(sx, sz, this.position.y + 1.4) : this.position.y; if (sy - this.position.y <= 1.2){ this.position.x = sx; this.position.z = sz; this.position.y = sy; } }
  this.direction = Math.atan2(dx, dz);
  this.group.rotation.y = this.direction;
 }
 for (let k = 0; k < (this.legs || []).length; k++) this.legs[k].rotation.x = Math.sin(t * 16 + k * 1.3) * .6;
 if (this.body) this.body.position.y = .42 + Math.abs(Math.sin(t * 12)) * .06;
 this.group.position.copy(this.position);
 if (Math.hypot(Player.position.x - this.position.x, Player.position.z - this.position.z) > 90){ this.state = 'dead'; this.deadTimer = 0; this.group.visible = false; raid.live.delete(this); }
}
//  Ink on a kill, on top of the usual credits.
const take = Enemy.prototype.takeDamage;
Enemy.prototype.takeDamage = function(){
 const alive = this.state !== 'dead', r = take.apply(this, arguments);
 if (alive && this.state === 'dead' && this.type === 'misprint' && S){
  raid.live.delete(this);
  const ink = (1 + (Math.random() < .5 ? 1 : 0)) * (almanac().ink || 1);
  S.ink += ink; S.kills++; save();
  toast('+' + ink + ' ink', 'success');
 }
 return r;
};
function zap(from, to, col){
 const pts = [];
 for (let k = 0; k <= 8; k++){ const p = from.clone().lerp(to, k / 8); if (k && k < 8) p.add(new THREE.Vector3(rnd(-.3, .3), rnd(-.3, .3), rnd(-.3, .3))); pts.push(p); }
 const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true }));
 root.add(line); view.zaps.push({ line, t: .18 });
}
const wardTimers = WARDS.map(() => 0);
const W1 = new THREE.Vector3(), W2 = new THREE.Vector3();
function tickDefence(dt){
 const mothBoost = S.pets.some(p => p.species === 'moth' && p.mode === 'guard') ? 1.5 : 0;
 for (let i = 0; i < WARDS.length; i++){
  const lvl = S.wards[i]; if (!lvl) continue;
  wardTimers[i] -= dt; if (wardTimers[i] > 0) continue;
  const [wx, wz] = WARDS[i], R = WARD_RADIUS(lvl) + mothBoost;
  let target = null, bd = R;
  for (const e of raid.live){ if (e.state === 'dead') continue; const d = Math.hypot(e.position.x - wx, e.position.z - wz); if (d < bd){ bd = d; target = e; } }
  if (!target) continue;
  wardTimers[i] = 1.6 - .2 * lvl;
  W1.set(wx, GROUND + 2.85 + lvl * .3, wz); W2.set(target.position.x, target.position.y + .5, target.position.z);
  zap(W1, W2, [0, 0xffa64a, 0xbff8ff, 0xff7ad9][lvl]);
  target.takeDamage(10 + 6 * lvl, false);
 }
 //  Pigeons on guard peck whatever is closest.
 for (const p of petBodies){
  if (p.pet.mode !== 'guard' || p.pet.species !== 'pigeon') continue;
  p.peck = (p.peck || 0) - dt; if (p.peck > 0) continue;
  for (const e of raid.live){ if (e.state === 'dead') continue; if (Math.hypot(e.position.x - p.group.position.x, e.position.z - p.group.position.z) < 2){ e.takeDamage(4, false); p.peck = .6; break; } }
 }
 for (let i = view.zaps.length - 1; i >= 0; i--){ const z = view.zaps[i]; z.t -= dt; z.line.material.opacity = Math.max(0, z.t / .18); if (z.t <= 0){ z.line.removeFromParent(); z.line.geometry.dispose(); z.line.material.dispose(); view.zaps.splice(i, 1); } }
}
function tickRaids(dt, here){
 const a = almanac(), peaceful = typeof Peace !== 'undefined' && Peace.on;
 const planted = S.plots.filter(p => p.crop).length;
 const h = hour();
 if (here && !raid.dusk && h >= 19 && h < 20 && planted && !a.quiet){ raid.dusk = true; toast('Dusk in the Seam. Misprints crawl out of the crack at night.', 'info'); }
 if (h >= 5 && h < 19) raid.dusk = false;
 if (!here || !isNight() || peaceful || a.quiet || !planted || Player.hp <= 0){ raid.next = Math.max(raid.next, 20); return; }
 raid.next -= dt;
 const catWarn = S.pets.some(p => p.species === 'cat' && p.mode === 'guard');
 if (catWarn && !raid.warned && raid.next < 10 && raid.next > 0 && raid.live.size === 0){ raid.warned = true; const cat = S.pets.find(p => p.species === 'cat' && p.mode === 'guard'); toast(cat.name + ' the rumour cat: “something’s coming up the crack.”', 'info'); }
 if (raid.next <= 0 && raid.live.size === 0){
  const n = clamp(2 + Math.floor(planted / 3) + (a.raid || 0) - (catWarn ? 1 : 0), 1, 7);
  for (let k = 0; k < n; k++) spawnMisprint();
  raid.wave++; raid.warned = false;
  raid.next = rnd(70, 100);
  toast(n + ' Misprints are crawling out of the crack.', 'fail');
 }
}

// ─── Creatures: wild in the Seam, then yours ──────────────────────────────
const NAMES = {
 moth: ['Filament', 'Wick', 'Lux', 'Sconce', 'Tungsten', 'Dimmer'],
 pigeon: ['Octavia', 'Wingnut', 'Gregory Eight-Wings', 'Flap Jack', 'Mx. Feathers', 'Coo Coo'],
 eel: ['Median', 'Speedbump', 'Chicane', 'Gutter', 'Asphalta', 'Lane'],
 cat: ['Hearsay', 'Byline', 'Scoop', 'Off-the-Record', 'Gossip', 'Anonymous'],
};
const wild = [];        // { id, species, body, x, z, t, home }
let wildWait = 4;
const petBodies = [];   // { pet, group, body }
function speciesInfo(sp){ return window.FCWildlife?.SPECIES?.[sp]; }
function makeBody(sp, s){ return window.FCWildlife?.make(sp, s) || null; }
function groundAt(x, z, from){ return typeof shSurfaceY === 'function' ? shSurfaceY(x, z, from) : GROUND; }
function randomGround(){
 for (let k = 0; k < 30; k++){ const x = rnd(IN.x0 + 1, IN.x1 - 1), z = rnd(IN.z0 + 1, IN.z1 - 1); if (isFissure(Math.floor(x), Math.floor(z)) || inLedger(Math.floor(x), Math.floor(z))) continue; return [x, z]; }
 return [258, 20];
}
function spawnWild(){
 const a = almanac(), owned = new Set(S.pets.map(p => p.species));
 const pool = ['moth', 'pigeon', 'eel', 'cat'].filter(sp => !owned.has(sp) || S.pets.length < 4);
 if (!pool.length || S.pets.length >= 4) return;
 const sp = a.migrant && Math.random() < .7 ? a.migrant : pool[Math.floor(Math.random() * pool.length)];
 const body = makeBody(sp, 1.6); if (!body) return;
 const [x, z] = sp === 'eel' ? FISSURE_CELLS[Math.floor(Math.random() * FISSURE_CELLS.length)] : randomGround();
 const w = { id: sp + ':' + Math.floor(now() / 1000) + ':' + Math.floor(Math.random() * 1e4), species: sp, body, x, z, tx: x, tz: z, wait: 0 };
 root.add(body.group); wild.push(w);
}
function tickWild(dt, t, near){
 const a = almanac(), want = near ? (a.migrant ? 3 : 1) : 0;
 while (wild.length > want){ const w = wild.pop(); w.body.group.removeFromParent(); }
 wildWait -= dt;
 if (wild.length < want && wildWait <= 0){ spawnWild(); wildWait = rnd(20, 45); }
 for (const w of wild){
  w.wait -= dt;
  if (w.wait <= 0){
   w.wait = rnd(2, 6);
   if (w.species === 'eel'){ const c = FISSURE_CELLS[Math.floor(Math.random() * FISSURE_CELLS.length)]; if (Math.hypot(c[0] - w.x, c[1] - w.z) < 8){ w.tx = c[0]; w.tz = c[1]; } }
   else { w.tx = clamp(w.x + rnd(-4, 4), IN.x0 + 1, IN.x1 - 1); w.tz = clamp(w.z + rnd(-4, 4), IN.z0 + 1, IN.z1 - 1); }
  }
  moveBody(w, w.tx, w.tz, dt, 1.2, t);
 }
}
//  Walks a body toward a point over the voxel ground. Moths fly at head height.
function moveBody(o, tx, tz, dt, speed, t){
 const dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz), moving = d > .15;
 if (moving){
  const step = Math.min(d, speed * dt), nx = o.x + dx / d * step, nz = o.z + dz / d * step;
  const gy = groundAt(nx, nz, (o.y ?? GROUND) + 1.6);
  if (o.body.species === 'moth' || gy - (o.y ?? gy) <= 1.2){ o.x = nx; o.z = nz; }
  o.body.group.rotation.y = Math.atan2(dx, dz);
 }
 const gy = groundAt(o.x, o.z, (o.y ?? GROUND) + 1.6);
 o.y = gy;
 o.body.group.position.set(o.x, gy + (o.body.species === 'moth' ? 1.3 + Math.sin(t * 2 + o.x) * .25 : 0), o.z);
 o.body.tick(t, moving);
 return d;
}
function feed(w){
 if(window.FCResidentLife?.blocked)return 'Account save unavailable.';
 const sp = speciesInfo(w.species), fav = sp.fav, a = almanac();
 if (S.pets.length >= 4) return 'You already keep four creatures. That is the most the Seam allows.';
 if (!S.crate[fav]) return 'The ' + sp.name.toLowerCase() + ' wants ' + CROPS[fav].name.toLowerCase() + '. Grow some here.';
 S.crate[fav]--;
 const need = a.migrant === w.species ? 2 : 3;
 S.trust[w.id] = (S.trust[w.id] || 0) + 1;
 if (typeof shBurst === 'function') shBurst(w.x, (w.y || GROUND) + .8, w.z, { count: 10, color: 0xff7ad9, size: .07, speed: 2.5, life: .8, grav: -1 });
 if (S.trust[w.id] < need){ save(); return 'The ' + sp.name.toLowerCase() + ' eats from your hand. Trust ' + S.trust[w.id] + ' of ' + need + '.'; }
 delete S.trust[w.id];
 const taken = new Set(S.pets.map(p => p.name)), names = NAMES[w.species].filter(n => !taken.has(n));
 const pet = { id: w.id, species: w.species, name: names[Math.floor(Math.random() * names.length)] || sp.name, mode: 'guard', since: now() };
 S.pets.push(pet);
 const i = wild.indexOf(w); if (i >= 0){ wild.splice(i, 1); w.body.group.removeFromParent(); }
 save();
 return 'TAMED · ' + pet.name + ' the ' + sp.name.toLowerCase() + ' is yours. It will guard the Seam. Change that at the Ledger.';
}
//  Owned pets: guards wander the beds, followers trail you anywhere in the city.
function syncPets(){
 const want = new Map(S.pets.map(p => [p.id, p]));
 for (let i = petBodies.length - 1; i >= 0; i--){ const b = petBodies[i]; const p = want.get(b.pet.id); if (!p || p.species !== b.pet.species){ b.body.group.removeFromParent(); petBodies.splice(i, 1); } else b.pet = p; }
 for (const p of S.pets){
  if (petBodies.some(b => b.pet.id === p.id)) continue;
  const body = makeBody(p.species, 1.25); if (!body) continue;
  const [x, z] = randomGround();
  const b = { pet: p, body, group: body.group, x, z, tx: x, tz: z, wait: 0 };
  root.add(body.group); petBodies.push(b);
 }
}
let chatter = 30;
function tickPets(dt, t, near){
 syncPets();
 const feet = Player.position.y - Player.height;
 let followers = 0;
 for (const b of petBodies){
  const p = b.pet;
  if (p.mode === 'follow' && followers < 2){
   const k = followers++, ang = (Player.yaw || 0) + Math.PI + (k ? .7 : -.7);
   const tx = Player.position.x + Math.sin(ang) * 1.6, tz = Player.position.z + Math.cos(ang) * 1.6;
   const d = Math.hypot(tx - b.x, tz - b.z);
   if (d > 25 || Math.abs((b.y ?? feet) - feet) > 4){ b.x = tx; b.z = tz; b.y = undefined; }
   moveBody(b, tx, tz, dt, d > 4 ? 8 : 3.2, t);
   b.group.visible = true;
   continue;
  }
  b.group.visible = near;
  if (!near) continue;
  if (p.mode === 'rest'){ moveBody(b, LEDGER.x1 + .8, 22 + petBodies.indexOf(b) * 1.2, dt, 1.5, t); continue; }
  //  Guard: patrol between planted beds; pigeons go after Misprints.
  let target = null;
  if (p.species === 'pigeon') for (const e of raid.live) if (e.state !== 'dead'){ target = e; break; }
  if (target){ moveBody(b, target.position.x, target.position.z, dt, 4, t); continue; }
  b.wait -= dt;
  if (b.wait <= 0){
   b.wait = rnd(3, 7);
   if (p.species === 'eel'){ const c = FISSURE_CELLS[Math.floor(Math.random() * FISSURE_CELLS.length)]; b.tx = c[0]; b.tz = c[1]; }
   else { const bed = BEDS[Math.floor(Math.random() * BEDS.length)]; b.tx = bed[0] + rnd(-3.5, 3.5); b.tz = bed[1] + rnd(-3.5, 3.5); }
  }
  moveBody(b, b.tx, b.tz, dt, 1.4, t);
 }
 //  A following rumour cat repeats things it heard.
 chatter -= dt;
 const cat = S.pets.find(p => p.species === 'cat' && p.mode === 'follow');
 if (cat && chatter <= 0 && !State.ui.paused){
  chatter = rnd(45, 80);
  const news = wire.items.length && Math.random() < .35 ? wire.items[Math.floor(Math.random() * wire.items.length)] : null;
  toast(news ? cat.name + ' repeats something from the wire (REAL NEWS, ' + (news.source || 'source') + '): “' + news.title + '”' : cat.name + ' the rumour cat: “…' + ECHOES[Math.floor(Math.random() * ECHOES.length)] + '”', 'info');
 }
}

// ─── Interface ─────────────────────────────────────────────────────────────
const css = document.createElement('style');
css.textContent = `
#seam-approach{position:fixed;bottom:110px;left:50%;transform:translateX(-50%);z-index:125001;border:1px solid #9ff3ff;border-radius:30px;padding:13px 22px;background:#141320;color:#eef7f6;font:14px system-ui;cursor:pointer;max-width:calc(100vw - 32px)}
#seam-approach[hidden]{display:none}
body.seam-near #maker-interact,body.seam-near #cg-approach{display:none!important}
#seam-hud{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:64;display:flex;gap:12px;align-items:center;padding:7px 14px;border-radius:20px;background:#141320dd;border:1px solid #9ff3ff66;color:#e8f4f2;font:12px/1.3 system-ui;pointer-events:none;white-space:nowrap;max-width:calc(100vw - 24px);overflow:hidden}
#seam-hud[hidden]{display:none}
#seam-hud b{font:600 12px Georgia,serif;letter-spacing:.06em;color:#9ff3ff}
#seam-hud .raid{color:#ff8f7a}
.seam-panel{position:fixed;z-index:140000;font:15px/1.5 system-ui;color:#eee6d4;background:#15131b;border:1px solid #3c3548;box-shadow:0 0 0 100vmax #07060b99,0 24px 100px #0009}
.seam-panel *{box-sizing:border-box}
.seam-panel button{font:inherit;cursor:pointer;min-height:40px;border-radius:20px;padding:7px 14px;border:1px solid #6b6178;background:transparent;color:inherit}
.seam-panel button:hover:not([disabled]),.seam-panel button:focus-visible{border-color:#9ff3ff;outline:none}
.seam-panel button[disabled]{opacity:.45;cursor:default}
.seam-panel button.go{background:#9ff3ff;color:#121018;border-color:#9ff3ff}
.seam-panel h2{font:600 28px/1.05 Georgia,serif;margin:0}
.seam-panel h3{font:600 19px Georgia,serif;margin:18px 0 8px}
.seam-panel small,.seam-panel .k{font:11px/1.6 monospace;letter-spacing:.08em;color:#a59cb3}
.seam-panel .div{color:#9ff3ff;letter-spacing:10px;margin:10px 0}
.seam-panel .row{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid #2e2838}
.seam-panel .row p{margin:2px 0 0;color:#b9b0c4;font-size:13px}
.seam-panel .bar{height:6px;border-radius:3px;background:#2e2838;overflow:hidden;margin-top:6px}.seam-panel .bar i{display:block;height:100%;background:#9ff3ff}
.seam-panel .real{display:inline-block;font:10px monospace;letter-spacing:.12em;color:#121018;background:#e7bd78;padding:1px 6px;border-radius:3px}
.seam-panel blockquote{margin:6px 0;font:italic 15px/1.4 Georgia,serif;color:#e8dcc0}
.seam-panel a{color:#9ff3ff}
.seam-panel .msg{min-height:22px;color:#e7bd78;font-size:13px}
#seam-plot{left:50%;bottom:24px;transform:translateX(-50%);width:min(560px,calc(100vw - 24px));border-radius:20px;padding:18px 20px}
#seam-plot .seeds{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px}
#seam-plot .seeds button{border-radius:14px;text-align:left;padding:10px 12px;display:flex;flex-direction:column;align-items:flex-start}
#seam-plot .seeds b{font:600 15px Georgia,serif}
#seam-ledger{inset:5vh max(12px,calc((100vw - 1000px)/2));border-radius:22px;display:grid;grid-template-columns:230px 1fr;overflow:hidden}
#seam-ledger aside{background:#9ff3ff;color:#121018;padding:24px 18px;display:flex;flex-direction:column;gap:8px;min-height:0}
#seam-ledger aside small{color:#2b3a3c}
#seam-ledger aside nav{display:flex;flex-direction:column;gap:4px;margin-top:8px}
#seam-ledger aside nav button{border:0;border-radius:12px;text-align:left;min-height:38px}
#seam-ledger aside nav button[aria-current=true]{background:#121018;color:#9ff3ff}
#seam-ledger main{overflow:auto;overscroll-behavior:contain;padding:26px clamp(16px,4vw,48px);min-height:0}
#seam-ledger .stats{display:flex;gap:18px;flex-wrap:wrap;margin:8px 0 4px;font:12px monospace;color:#a59cb3}
#seam-ledger .stats b{color:#eee6d4;font:600 16px Georgia,serif;display:block}
@media(max-width:700px){#seam-ledger{inset:8px;grid-template-columns:1fr;grid-template-rows:auto 1fr;border-radius:16px}#seam-ledger aside{padding:12px 14px}#seam-ledger aside nav{flex-direction:row;flex-wrap:wrap}#seam-ledger aside nav button{min-height:34px;padding:4px 10px}#seam-ledger aside>small{display:none}#seam-ledger h2{font-size:22px}#seam-plot .seeds{grid-template-columns:1fr}#seam-hud{font-size:11px;gap:8px;top:6px}}
@media(max-height:500px){#seam-hud{top:46px;font-size:11px;gap:8px;padding:5px 12px}}`;
document.head.append(css);
const prompt = document.createElement('button'); prompt.id = 'seam-approach'; prompt.hidden = true; prompt.onclick = () => act(); document.body.append(prompt);
const hud = document.createElement('div'); hud.id = 'seam-hud'; hud.hidden = true; hud.setAttribute('aria-live', 'polite'); document.body.append(hud);
let panel = null, kind = null, tab = 'market', plotI = -1, priorPause = false, oldFocus = null, msg = '', near = null;

function blocked(){ return State.ui.paused || State.ui.inArcade || State.ui.inDialogue || State.ui.inIntro || window.CityArt?.panelOpen || window.CityBuild?.panelOpen || window.FCAccounts?.visible || window.FCNewsHub?.isOpen || window.CitySocial?.writing || window.OwnBlock?.modal || window.FCCommonGround?.isOpen || window.NPCVoices?.open; }
function openPanel(k, arg){
 if (panel) closePanel();
 kind = k; msg = '';
 if (k === 'plot') plotI = arg; else if (arg) tab = arg;
 oldFocus = document.activeElement; priorPause = State.ui.paused; State.ui.paused = true; State.keys?.clear?.(); document.exitPointerLock?.();
 panel = document.createElement('section'); panel.className = 'seam-panel'; panel.id = k === 'plot' ? 'seam-plot' : 'seam-ledger';
 panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', k === 'plot' ? 'Seam plot' : 'The Ledger');
 document.body.append(panel); render();
 (panel.querySelector('button.go:not([disabled])') || panel.querySelector('button:not([disabled])'))?.focus();
 if (k === 'ledger'){ loadWire().then(() => kind === 'ledger' && tab === 'market' && render()); if (S.reportUnseen){ S.reportUnseen = false; save(); } }
}
function closePanel(){ if (!panel) return; panel.remove(); panel = null; kind = null; State.ui.paused = priorPause; State.keys?.clear?.(); oldFocus?.focus?.(); }
function render(){
 if (!panel) return;
 const focus = document.activeElement?.dataset ? { ...document.activeElement.dataset } : null;
 panel.innerHTML = kind === 'plot' ? plotHTML() : ledgerHTML();
 panel.querySelectorAll('[data-close]').forEach(b => b.onclick = closePanel);
 panel.querySelectorAll('[data-plant]').forEach(b => b.onclick = () => { msg = plant(plotI, b.dataset.plant) || 'Planted. ' + CROPS[b.dataset.plant].name + ' is in the ground.'; render(); });
 panel.querySelectorAll('[data-harvest]').forEach(b => b.onclick = () => doHarvest(plotI));
 panel.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; msg = ''; render(); });
 panel.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const id = b.dataset.sell, n = b.dataset.n === 'all' ? null : 1, got = sell(id, n); msg = got ? 'Sold for ' + got + 'c.' : 'Nothing to sell.'; render(); });
 panel.querySelectorAll('[data-unlock]').forEach(b => b.onclick = () => { msg = unlockPlot(+b.dataset.unlock) || 'Ground cleared. Plot ' + (+b.dataset.unlock + 1) + ' is open.'; render(); });
 panel.querySelectorAll('[data-ward]').forEach(b => b.onclick = () => { msg = buildWard(+b.dataset.ward) || 'The lamp-ward hums to life.'; render(); });
 panel.querySelectorAll('[data-fence]').forEach(b => b.onclick = () => { msg = raiseFence() || 'The Retraction fence goes up another line.'; render(); });
 panel.querySelectorAll('[data-pet]').forEach(b => b.onclick = () => { const p = S.pets.find(x => x.id === b.dataset.pet); if (p){ p.mode = b.dataset.mode; save(); msg = p.name + (p.mode === 'follow' ? ' will follow you.' : p.mode === 'guard' ? ' is guarding the Seam.' : ' is resting by the Ledger.'); } render(); });
 if (focus){ const k = Object.keys(focus)[0]; if (k){ const again = panel.querySelector(`[data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${CSS.escape(focus[k])}"]`); again?.focus(); } }
}
function doHarvest(i){
 const r = harvest(i);
 if (!r){ msg = 'Not ripe yet.'; render(); return; }
 msg = 'Harvested ' + r.n + ' × ' + CROPS[r.id].name.toLowerCase() + '. Sell it at the Ledger.' + (r.echo ? ' The cobs whisper: “…' + r.echo + '”' : '');
 if (typeof shBurst === 'function') shBurst(BEDS[i][0], BED_TOP + .6, BEDS[i][1], { count: 16, color: parseInt(CROPS[r.id].color.slice(1), 16), size: .08, speed: 3.5, life: .7, grav: 8 });
 if (kind === 'plot') render(); else toast(msg, 'success');
}
function plotHTML(){
 const p = S.plots[plotI], c = p.crop, a = almanac();
 const head = `<div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><div><small>THE SEAM · PLOT ${String(plotI + 1).padStart(2, '0')}</small><h2>${c ? esc(CROPS[c.id].name) : 'Empty bed'}</h2></div><button data-close aria-label="Close">×</button></div>`;
 if (c){
  const pr = progress(c), ripe = pr >= 1;
  return head + `<p>${ripe ? 'Ripe. ' + c.yield + ' to pick.' : 'Ready in ' + fmt(c.t0 + c.dur - now()) + '.'}${c.bonus ? ' <small>' + esc(a.title.toUpperCase()) + ' BONUS</small>' : ''}</p><div class="bar"><i style="width:${Math.round(pr * 100)}%"></i></div><p class="msg">${esc(msg)}</p>${ripe ? '<button class="go" data-harvest>Harvest  (E)</button>' : ''}`;
 }
 const seeds = CROP_IDS.map((id, k) => {
  const cr = CROPS[id], free = S.packets[id] > 0, needs = cr.needsWard && !wardFor(plotI), fav = a.crop === id;
  const cost = free ? 'free packet ×' + S.packets[id] : cr.seed + 'c';
  const mins = cr.mins * (fav ? .5 : 1) * (a.quiet ? .8 : 1);
  return `<button data-plant="${id}" ${needs || (!free && credits() < cr.seed) ? 'disabled' : ''}><b>${k + 1} · ${esc(cr.name)}</b><span class="k">${cost} · ${mins >= 60 ? (mins / 60).toFixed(1).replace('.0', '') + ' h' : mins + ' min'} · ${cr.yield + (fav ? 1 : 0)} to pick${fav ? ' · TODAY' : ''}</span><span style="font-size:12px;color:#b9b0c4">${needs ? 'Needs a lamp-ward beside this bed.' : esc(cr.blurb)}</span></button>`;
 }).join('');
 return head + `<p style="margin:4px 0 0;color:#b9b0c4">Choose what to grow. You have ${credits()}c.</p><div class="seeds">${seeds}</div><p class="msg">${esc(msg)}</p>`;
}
function ledgerHTML(){
 const r = rank(), R = RANKS[r], nx = RANKS[r + 1], a = almanac();
 const tabs = [['market', 'Market'], ['build', 'Build'], ['creatures', 'Creatures'], ['almanac', 'Almanac'], ['report', 'While you were away']];
 const side = `<aside><small>THE SEAM</small><h2>The Ledger.</h2><small>${esc(R.name.toUpperCase())}${nx ? ' · ' + (nx.harvests - S.harvests) + ' HARVESTS TO ' + esc(nx.name.toUpperCase()) : ''}</small><nav>${tabs.map(([id, l]) => `<button data-tab="${id}" aria-current="${tab === id}">${l}</button>`).join('')}</nav><span style="flex:1"></span><button data-close style="border-color:#121018">Back to the Seam ×</button></aside>`;
 const stats = `<div class="stats"><span><b>${credits()}c</b>${window.FCResidentLife?.enabled ? 'farm credits' : 'credits'}</span><span><b>${S.ink}</b>ink</span><span><b>${S.harvests}</b>harvests</span><span><b>${S.kills}</b>Misprints</span></div><p class="msg" role="status">${esc(msg)}</p>`;
 let body = '';
 if (tab === 'market'){
  const mk = market(), top = CROP_IDS.map(id => mk[id].top).find(Boolean);
  body = `<small>MARKET · ${esc(a.label.toUpperCase())}</small><h3>Prices move with the real news.</h3><p style="color:#b9b0c4;margin:0">Each crop tracks a kind of story on the wire. More of those stories today, higher the price. Each sale today nudges that crop’s price down.${a.market ? ' <b>' + esc(a.title) + ':</b> everything sells for more.' : ''}</p>` +
   CROP_IDS.map(id => { const x = mk[id], have = S.crate[id]; return `<div class="row"><div><b style="font:600 16px Georgia,serif">${esc(CROPS[id].name)}</b> <span class="k">× ${have}</span><p>${x.unit}c each${x.hits ? ' · ' + x.hits + ' matching stor' + (x.hits === 1 ? 'y' : 'ies') + ' today' : ''}${x.sold ? ' · ' + x.sold + ' sold today' : ''}</p></div><div style="display:flex;gap:6px"><button data-sell="${id}" data-n="1" ${have ? '' : 'disabled'}>Sell 1</button><button class="go" data-sell="${id}" data-n="all" ${have ? '' : 'disabled'}>Sell all</button></div></div>`; }).join('') +
   (top ? `<h3>What moved the market</h3><span class="real">REAL NEWS</span> <small>${esc(top.source || 'Wire')}</small><blockquote>“${esc(top.title)}”</blockquote><a href="${esc(top.url)}" target="_blank" rel="noopener noreferrer">Read it at the source</a>` : `<p class="k" style="margin-top:14px">${location.pathname.startsWith('/city/') ? 'The wire is quiet. Prices follow the Seam’s own weather today.' : 'Offline: prices follow the Seam’s own weather. Online, real headlines move them.'}</p>`);
 } else if (tab === 'build'){
  const open = S.plots.filter(p => p.open).length, built = S.wards.filter(Boolean).length;
  body = `<small>BUILD</small><h3>Ground · ${open} of ${R.plots} plots your rank allows</h3>` +
   S.plots.map((p, i) => p.open ? '' : `<div class="row"><div><b>Plot ${String(i + 1).padStart(2, '0')}</b><p>Clear the rubble and plant here.</p></div><button data-unlock="${i}" ${open >= R.plots || credits() < PLOT_COST[i] ? 'disabled' : ''}>${PLOT_COST[i]}c</button></div>`).join('').replace(/^$/, '<p class="k">Every plot is open.</p>') +
   `<h3>Lamp-wards · ${built} of ${R.wards}</h3><p style="color:#b9b0c4;margin:0">Wards zap Misprints in range and let sodium tubers grow. Higher levels reach further and hit harder.</p>` +
   WARDS.map((_, i) => { const l = S.wards[i], c = WARD_COST[l + 1]; return `<div class="row"><div><b>Ward ${i + 1}</b> <span class="k">${l ? 'LEVEL ' + l + ' · ' + WARD_RADIUS(l) + ' M' : 'EMPTY SLOT'}</span><p>${c ? 'Next: ' + c.c + 'c + ' + c.ink + ' ink' : 'Full strength.'}</p></div>${c ? `<button data-ward="${i}">${l ? 'Upgrade' : 'Build'}</button>` : ''}</div>`; }).join('') +
   `<h3>Retraction fence · level ${S.fence}</h3><p style="color:#b9b0c4;margin:0">Slows every Misprint inside the Seam and counts toward defence while you are away.</p>` +
   (FENCE_COST[S.fence + 1] ? `<div class="row"><div><b>Raise to level ${S.fence + 1}</b><p>${FENCE_COST[S.fence + 1].c}c + ${FENCE_COST[S.fence + 1].ink} ink</p></div><button data-fence>Raise</button></div>` : '<p class="k">The fence is as high as it goes.</p>');
 } else if (tab === 'creatures'){
  const species = window.FCWildlife?.SPECIES || {};
  body = `<small>CREATURES · ${S.pets.length} OF 4</small><h3>Tame them with the crop they love.</h3><p style="color:#b9b0c4;margin:0">Wild creatures wander into the Seam. Walk up and press E to feed them. Three feeds and they are yours, two on their migration day.</p>` +
   Object.entries(species).map(([id, sp]) => `<div class="row"><div><b>${esc(sp.name)}</b> <span class="k">LOVES ${esc(CROPS[sp.fav].name.toUpperCase())}${a.migrant === id ? ' · MIGRATING TODAY' : ''}</span><p>${esc(sp.blurb)} On guard: ${{ moth: 'wards reach further', pigeon: 'pecks Misprints', eel: 'slows Misprints near the crack', cat: 'warns of raids, one fewer Misprint per wave' }[id]}.</p></div></div>`).join('') +
   (S.pets.length ? '<h3>Yours</h3>' + S.pets.map(p => `<div class="row"><div><b>${esc(p.name)}</b> <span class="k">${esc((species[p.species]?.name || p.species).toUpperCase())} · ${p.mode.toUpperCase()}</span></div><div style="display:flex;gap:6px;flex-wrap:wrap">${['guard', 'follow', 'rest'].map(md => `<button data-pet="${esc(p.id)}" data-mode="${md}" ${p.mode === md ? 'class="go"' : ''}>${md[0].toUpperCase() + md.slice(1)}</button>`).join('')}</div></div>`).join('') : '');
 } else if (tab === 'almanac'){
  body = `<small>ALMANAC · ${esc(a.label.toUpperCase())}</small><h3>${esc(a.hue.name)}: ${esc(a.title)}</h3><p>${esc(a.text)}</p><div class="div">◆ ◆ ◆</div><p style="color:#b9b0c4">The sky’s hue changes every day, and the Seam changes with it. Come back tomorrow for a different crop, creature or market.</p><h3>How the Seam works</h3><p style="color:#b9b0c4">Plant in a bed, come back when it is ripe, even after closing the game. Sell at the Market. Misprints crawl out of the crack at night while you are here: shoot them, and build wards to do it for you. Raids also happen while you are away, every ninety minutes or so. Wards, the fence and creatures on guard decide how those go.</p>`;
 } else {
  const rep = S.report;
  body = `<small>WHILE YOU WERE AWAY</small>` + (rep ? `<h3>${rep.raids} raid${rep.raids === 1 ? '' : 's'} in ${rep.hours} hours</h3><p>${rep.repelled} repelled${rep.ink ? ', +' + rep.ink + ' ink collected by the wards' : ''}.${rep.hits.length ? ' The Misprints set back: ' + esc(rep.hits.join(', ').toLowerCase()) + '.' : ' Nothing was lost.'}</p>` : '<h3>Nothing to report yet.</h3><p style="color:#b9b0c4">Raids are checked when you come back after an hour and a half or more.</p>');
 }
 return side + `<main>${stats}${body}</main>`;
}

// ─── What is in reach ──────────────────────────────────────────────────────
function findNear(){
 const px = Player.position.x, pz = Player.position.z, feet = Player.position.y - Player.height;
 if (!inSeamXZ(px, pz) || feet > 7) return null;
 for (const w of wild) if (Math.hypot(w.x - px, w.z - pz) < 2.4){ const sp = speciesInfo(w.species); return { type: 'wild', w, label: S.crate[sp.fav] ? 'E · Feed the ' + sp.name.toLowerCase() + ' ' + CROPS[sp.fav].name.toLowerCase() + ' (' + S.crate[sp.fav] + ')' : 'E · The ' + sp.name.toLowerCase() + ' wants ' + CROPS[sp.fav].name.toLowerCase() }; }
 if (Math.hypot(px - LEDGER.counter.x, pz - LEDGER.counter.z) < 2.6) return { type: 'ledger', label: 'E · The Ledger: market, build, creatures' };
 for (let i = 0; i < BEDS.length; i++){
  const [bx, bz] = BEDS[i];
  if (Math.abs(px - bx) > 3.6 || Math.abs(pz - bz) > 3.6) continue;
  const p = S.plots[i];
  if (!p.open) return { type: 'locked', i, label: 'E · Plot ' + (i + 1) + ' · clear it at the Ledger (' + PLOT_COST[i] + 'c)' };
  if (p.crop && progress(p.crop) >= 1) return { type: 'harvest', i, label: 'E · Harvest ' + CROPS[p.crop.id].name.toLowerCase() };
  return { type: 'plot', i, label: p.crop ? 'E · ' + CROPS[p.crop.id].name + ' · ' + fmt(p.crop.t0 + p.crop.dur - now()) : 'E · Plant in plot ' + (i + 1) };
 }
 for (let i = 0; i < WARDS.length; i++) if (!S.wards[i] && Math.hypot(px - WARDS[i][0], pz - WARDS[i][1]) < 1.6) return { type: 'slot', i, label: 'E · Lamp-ward slot · build it at the Ledger' };
 return null;
}
function act(){
 if(window.FCResidentLife?.blocked)return undefined;
 if (!near || panel) return;
 if (near.type === 'wild'){ toast(feed(near.w), 'info'); return; }
 if (near.type === 'ledger') return openPanel('ledger');
 if (near.type === 'harvest') return doHarvest(near.i);
 if (near.type === 'plot') return openPanel('plot', near.i);
 if (near.type === 'locked' || near.type === 'slot') return openPanel('ledger', 'build');
}
window.addEventListener('keydown', e => {
 if (panel){
  if (e.code === 'Escape'){ closePanel(); }
  else if (kind === 'plot' && /^Digit[1-4]$/.test(e.code) && !S.plots[plotI].crop){ panel.querySelector(`[data-plant="${CROP_IDS[+e.code.slice(5) - 1]}"]`)?.click(); }
  else if (kind === 'plot' && (e.code === 'KeyE' || e.code === 'Enter') && !e.repeat && panel.querySelector('[data-harvest]')){ e.preventDefault(); doHarvest(plotI); }
  else if (e.code === 'Tab'){ const nodes = [...panel.querySelectorAll('button:not([disabled]),a[href]')], i = nodes.indexOf(document.activeElement); e.preventDefault(); nodes[(i + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length]?.focus(); }
  else if (e.code === 'Enter' || e.code === 'Space'){ return; }
  e.stopImmediatePropagation(); return;
 }
 if (e.code === 'KeyE' && !e.repeat && !prompt.hidden && near){ e.preventDefault(); e.stopImmediatePropagation(); act(); }
}, true);

// ─── Every frame ───────────────────────────────────────────────────────────
let last = performance.now(), slow = 0, staticT = 0, ripeNote = 0, wasHere = false;
function hudText(){
 const a = almanac(), ripe = S.plots.filter(p => p.crop && progress(p.crop) >= 1).length, growing = S.plots.filter(p => p.crop && progress(p.crop) < 1).length;
 const raidTxt = raid.live.size ? `<span class="raid">${raid.live.size} Misprint${raid.live.size === 1 ? '' : 's'} in the beds</span>` : isNight() && !a.quiet && growing + ripe ? `<span class="raid">raid in ${fmt(raid.next * 1000)}</span>` : a.quiet ? 'no raids today' : 'raids at night';
 return `<b>THE SEAM</b><span>${esc(a.title)}</span><span>${ripe} ripe · ${growing} growing</span><span>${S.ink} ink</span>${raidTxt}`;
}
function tick(nowMs){
 requestAnimationFrame(tick);
 const dt = Math.min(.05, Math.max(0, (nowMs - last) / 1000)); last = nowMs;
 try {
  if (!State.scene || !State.chunkMap?.size || State.ui.inIntro || window.FN?.prologue){ if (root) root.visible = false; prompt.hidden = true; hud.hidden = true; return; }
  if(window.FCResidentLife?.blocked){prompt.hidden=true;hud.hidden=true;return;}
  load();
  const px = Player.position.x, pz = Player.position.z;
  const dist = Math.hypot(px - clamp(px, BOUNDS.x0, BOUNDS.x1), pz - clamp(pz, BOUNDS.z0, BOUNDS.z1));
  const nearSeam = dist < 70, here = inSeamXZ(px, pz);
  //  Nothing is added to the scene until it could be seen: near the Seam, near
  //  the wayfinding sign, or with a creature following you.
  if (!root && dist > 120 && Math.hypot(px - 177.5, pz - 30.5) > 90 && !S.pets.some(p => p.mode === 'follow')){
   prompt.hidden = true; hud.hidden = true;
   slow -= dt;
   if (slow <= 0){ slow = 2; const ripe = S.plots.filter(p => p.crop && progress(p.crop) >= 1).length; if (ripe && performance.now() - ripeNote > 600000 && !State.ui.paused){ ripeNote = performance.now(); toast('Your Seam: ' + ripe + ' bed' + (ripe === 1 ? ' is' : 's are') + ' ripe.', 'info'); } }
   return;
  }
  if (!build()) return;
  root.visible = true;
  for (const o of root.children) if (o !== view.way) o.visible = nearSeam || petBodies.some(b => b.group === o && b.pet.mode === 'follow');
  if (view.way) view.way.visible = !!window.OwnBlock?.state?.enabled && Math.hypot(px - 177.5, pz - 30.5) < 90;
  if (view.way && view.way.visible && !view.way.userData.placed){ view.way.userData.placed = true; view.way.position.y = groundAt(177.5, 30.5, 12); }
  if (here && !wasHere){
   if (!S.welcomed){ S.welcomed = true; save(); toast('THE SEAM · Farmland in the crack. Plant in a bed, sell at the Ledger by the road, defend the crops at night. You have free seed packets to start.', 'success'); }
   else if (S.reportUnseen && S.report){ toast('While you were away: ' + S.report.raids + ' raid' + (S.report.raids === 1 ? '' : 's') + ', ' + S.report.repelled + ' repelled. Details at the Ledger.', 'info'); }
   const a = almanac(); if (S.seen.day !== a.day){ S.seen.day = a.day; save(); setTimeout(() => toast('ALMANAC · ' + a.hue.name + ': ' + a.title + '. ' + a.text, 'info'), 1200); }
  }
  wasHere = here;
  slow -= dt;
  if (slow <= 0){
   slow = .5;
   if (now() - S.lastSim > 1.5 * 3.6e6 && simulateAway() && S.report && here) toast('Raids while you were away: ' + S.report.repelled + ' of ' + S.report.raids + ' repelled.', 'info');
   if (dirty || nearSeam){ refreshBeds(); refreshWards(); refreshFence(); dirty = false; }
   //  A nudge, once in a while, when something ripens and you are elsewhere.
   const ripe = S.plots.filter(p => p.crop && progress(p.crop) >= 1).length;
   if (!nearSeam && ripe && performance.now() - ripeNote > 600000 && !State.ui.paused){ ripeNote = performance.now(); toast('Your Seam: ' + ripe + ' bed' + (ripe === 1 ? ' is' : 's are') + ' ripe.', 'info'); }
   if (here) loadWire();
   if (panel && kind === 'plot') { const c = S.plots[plotI]?.crop; if (c) render(); }
   saveT += .5; if (saveT > 10){ saveT = 0; save(); }
  }
  const t = nowMs / 1000;
  if (nearSeam){
   staticT -= dt; if (staticT <= 0){ staticT = .12; paintStatic(); }
   for (const s of view.slabs){ s.g.position.y = s.y + Math.sin(t * .4 + s.phase) * .35; s.g.rotation.y = s.ry + Math.sin(t * .13 + s.phase) * .08; }
   if (view.sparks){ const seed = view.sparks.userData.seed, arr = view.sparks.geometry.attributes.position.array; for (let i = 0; i < seed.length; i++){ const s = seed[i]; s.h = (s.h + s.v * dt) % 7; arr[i * 3] = s.x + Math.sin(t + i) * .2; arr[i * 3 + 1] = 1 + s.h; arr[i * 3 + 2] = s.z; } view.sparks.geometry.attributes.position.needsUpdate = true; }
   for (const v of view.wards) if (v.head) v.head.rotation.y += dt * 1.5;
   for (const v of view.beds) if (v.marker){ v.marker.rotation.y += dt * 2; v.marker.position.y = 2.4 + Math.sin(t * 2) * .15; }
   for (const v of view.wards) if (v.ring) v.ring.material.opacity = .25 + Math.sin(t * 2.5) * .12;
  }
  if (!State.ui.paused){
   tickRaids(dt, here);
   tickDefence(dt);
   tickWild(dt, t, nearSeam);
   tickPets(dt, t, nearSeam);
  }
  near = panel ? null : findNear();
  const show = !!near && !blocked();
  if (show && prompt.textContent !== near.label) prompt.textContent = near.label;
  prompt.hidden = !show;
  document.body.classList.toggle('seam-near', show);
  hud.hidden = !here || !!panel || State.ui.paused;
  if (!hud.hidden){ const h = hudText(); if (hud._h !== h){ hud._h = h; hud.innerHTML = h; } }
 } catch (e){ if (!tick._warned){ tick._warned = 1; console.warn('[seam]', e); } }
}
requestAnimationFrame(tick);
addEventListener('pagehide', save);
addEventListener('fc-life-ready',()=>{S=null;sKey='';dirty=true;});

window.FCSeam = {
 BOUNDS, BEDS, WARDS, LEDGER, CROPS, RANKS, EVENTS, FISSURE_CELLS,
 get state(){ return load(); }, get near(){ return near; }, get panel(){ return kind; }, get raid(){ return raid; }, get wild(){ return wild; }, get pets(){ return petBodies; }, get wire(){ return wire; }, get root(){ return root; },
 now, skew(ms){ SKEW += ms; dirty = true; }, almanac, market, progress, rank: () => rank(),
 plant: (i, id) => plant(i, id), harvest: i => harvest(i), sell, unlockPlot, buildWard, raiseFence, feed, simulateAway,
 spawnMisprint: () => { load(); build(); return spawnMisprint(); }, spawnWild: () => { load(); build(); spawnWild(); return wild[wild.length - 1]; },
 open: (t) => openPanel('ledger', t), openPlot: i => openPanel('plot', i), close: closePanel, act, save, reset(){ S = fresh(); save(); dirty = true; },
};
})();
