/* Sodium noir: a brighter, grittier city.

   Three things, all cheap enough for a phone:

   1. A different off-colour daylight every day. Bile green, bruise violet,
      rust, chemical teal, nicotine, ash rose, oxide. Online, everyone in the
      same city sees the same hue on the same calendar day; offline, the hue
      rolls over each time the clock passes midnight. Nights are always sodium:
      orange haze on the horizon, teal shadows overhead.
   2. Light that lands somewhere. Every street lamp gets a pool of sodium light
      on the ground and a wet sheen beside it. These are
      painted decals, not real lights, so they cost almost nothing.
   3. A grade on top: a soft-light tint in the day's hue plus a little extra
      contrast on the desktop tiers.

   It works by adjusting what the existing systems already produce (the sky
   table, the lighting rig, the street kit) after they run, so it changes
   nothing underneath and switches off cleanly from the Display panel (F). */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined') return;

// ─── The hues ──────────────────────────────────────────────────────────────
//  sky: horizon, low, high, zenith (same shape as SKY_BANDS). sun/hemi/ground
//  tint the lights. grade is the soft-light overlay colour.
//  0.89: the days used to be bile green, bruise violet, rust. They are now
//  the weathers a real city gets: the hue still changes daily and a whole
//  online room still shares it, but every one is a sky you could photograph.
const HUES = [
 {id:'clear',    name:'Clear',          sky:['#a9cfee','#5aa8e6','#2a76d2','#1148b4'], sun:'#fff2dc', hemi:'#bcd6f2', ground:'#6b6258', grade:'#9cc0e0'},
 {id:'haze',     name:'Summer Haze',    sky:['#dcd8c8','#aec2d2','#7299c2','#3e6aa4'], sun:'#ffe6c4', hemi:'#d2dce4', ground:'#6e6456', grade:'#d8cfb8'},
 {id:'overcast', name:'Overcast',       sky:['#bcc3c9','#a5adb6','#8c96a2','#6f7a88'], sun:'#e6ebf0', hemi:'#c4ccd4', ground:'#5e5c5a', grade:'#a8b0b8'},
 {id:'smog',     name:'Smog',           sky:['#d9c4a2','#b8b1a3','#8295a6','#4d6688'], sun:'#ffdcae', hemi:'#d8cbb6', ground:'#6c5e4c', grade:'#c8b08a'},
 {id:'marine',   name:'Marine Layer',   sky:['#c6d3db','#93b0c3','#5f89ab','#34608c'], sun:'#eef4f8', hemi:'#c2d4e0', ground:'#565a5c', grade:'#96b0c0'},
 {id:'golden',   name:'Golden',         sky:['#f0d8b4','#a0c2e0','#5190d0','#1e5cb0'], sun:'#ffe2b8', hemi:'#d6dcea', ground:'#74644e', grade:'#e8c890'},
 {id:'cold',     name:'Cold Front',     sky:['#d0e3f2','#82b8e8','#3f88d8','#1652b8'], sun:'#f4f8ff', hemi:'#c8dcf4', ground:'#585c64', grade:'#a8c8e8'},
];
//  Night: up-facing surfaces (streets, roofs, shoulders) take sodium orange from
//  above; walls and undersides fall to teal. That split is the sodium-noir look,
//  and it lights every street without a single extra light.
const NIGHT = {sky:['#767d78','#40575e','#203740','#0e1d2b'], hemi:'#d6b48a', ground:'#49666a', amb:'#526b76'};
const SODIUM = 0xe8be83;

const Grit = window.Grit = {
 enabled: true, hue: HUES[0], dayIndex: 0, wraps: 0, HUES,
 lampPools: 0,
};
try { const v = localStorage.getItem('fc-grit'); if (v === 'off') Grit.enabled = false; Grit.wraps = Number(localStorage.getItem('fc-grit-wraps')) || 0; } catch (e){}

function hash(s){ let h = 2166136261; for (const ch of String(s)){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function online(){ return !!(window.FCCityOnline && FCCityOnline.ready); }
//  The day this hue belongs to. Online: the UTC calendar date, so a whole room
//  agrees. Offline: today's date plus how many in-game midnights have passed.
function dayKey(){
 const d = new Date().toISOString().slice(0, 10);
 return online() ? 'utc:' + d : 'local:' + d + ':' + Grit.wraps;
}
function pickHue(){
 const key = dayKey();
 if (Grit._key === key) return;
 Grit._key = key;
 Grit.dayIndex = hash(key);
 Grit.hue = HUES[Grit.dayIndex % HUES.length];
 retintSky();
}

// ─── Sky ───────────────────────────────────────────────────────────────────
//  SKY_BANDS is the sky's own colour table. Keep the originals and blend.
let ORIGINAL = null;
const C1 = new THREE.Color(), C2 = new THREE.Color();
function mix(a, b, t){ return '#' + C1.set(a).lerp(C2.set(b), t).getHexString(); }
function retintSky(){
 if (typeof SKY_BANDS === 'undefined') return;
 if (!ORIGINAL) ORIGINAL = SKY_BANDS.map(b => b.c.slice());
 SKY_BANDS.forEach((b, i) => {
  const o = ORIGINAL[i];
  if (!Grit.enabled){ b.c = o.slice(); return; }
  const h = b.h;
  //  Full daylight 7.5 to 17.5, half at sunrise and sunset, sodium at night.
  const dayW = h >= 7.5 && h <= 17.5 ? 0.6 : (h >= 6.2 && h <= 18.8) ? 0.3 : 0;
  const nightW = h <= 4.0 || h >= 21.5 ? 0.7 : (h >= 20 || h <= 5) ? 0.45 : 0;
  b.c = o.map((col, k) => {
   let out = col;
   if (dayW) out = mix(out, Grit.hue.sky[k], dayW);
   if (nightW) out = mix(out, NIGHT.sky[k], nightW);
   return out;
  });
 });
}

// ─── Lights ────────────────────────────────────────────────────────────────
const TMP = new THREE.Color();
function dayFactor(hour){ return typeof shRamp === 'function' ? Math.min(shRamp(hour, 4.6, 7.4), 1 - shRamp(hour, 17.4, 20.2)) : 1; }
//  0.90: lights, fog and exposure are set by the look table in real-light.js,
//  which reads Grit.hue for the day's weather.

// ─── Lamp pools, haze and sheen ────────────────────────────────────────────
function canvasTex(w, h, paint){ const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
const POOL_TEX = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(w/2, w/2, 0, w/2, w/2, w/2); r.addColorStop(0, 'rgba(255,190,110,1)'); r.addColorStop(0.35, 'rgba(255,150,60,.55)'); r.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
const SHEEN_TEX = canvasTex(128, 64, (g, w, h) => { g.translate(w/2, h/2); g.scale(1, 0.42); const r = g.createRadialGradient(0, 0, 0, 0, 0, w/2); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(0.5, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.beginPath(); g.arc(0, 0, w/2, 0, Math.PI * 2); g.fill(); });
POOL_TEX.wrapS = POOL_TEX.wrapT = THREE.ClampToEdgeWrapping;
const MAT = {
 pool:  new THREE.MeshBasicMaterial({ map: POOL_TEX, color: SODIUM, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
 sheen: new THREE.MeshBasicMaterial({ map: SHEEN_TEX, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
};
const GEO = {
 sheen: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
};
//  A pool under every light a chunk owns: street lamps, plaza lamps, shop and
//  sign lights. Placed on whatever solid ground is directly below the light.
const POOL_MATS = new Map();
function poolMat(hex){
 //  Street-lamp whites go sodium; coloured lights keep their colour.
 const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl);
 const warm = hsl.h > 0.04 && hsl.h < 0.19 && hsl.l > 0.6;
 const key = hsl.s < 0.35 || warm ? 'sodium' : c.getHexString();
 let m = POOL_MATS.get(key);
 if (!m){ m = MAT.pool.clone(); m.color.set(key === 'sodium' ? SODIUM : c); m.userData.coloured = key !== 'sodium'; POOL_MATS.set(key, m); }
 return m;
}
const WP = new THREE.Vector3();
//  Pools live in the scene, not the chunk, so they go when their light goes.
const OWNERS = new Set();
function inScene(o){ for (let a = o; a; a = a.parent) if (a === State.scene) return true; return false; }
function sweepOwners(){
 for (const l of OWNERS){
  if (inScene(l)) continue;
  for (const m of l.userData.gritOwned || []){ m.parent?.remove(m); if (m.geometry !== GEO.sheen) m.geometry.dispose(); }
  l.userData.gritOwned = []; l.userData.gritPool = false; OWNERS.delete(l); Grit.lampPools = Math.max(0, Grit.lampPools - 1);
 }
}
function groundTop(x, z, from){
 for (let y = Math.min(48, Math.floor(from)); y >= 0; y--) if (isSolid(getBlock(Math.floor(x), y, Math.floor(z)))) return y + 1;
 return null;
}
function drapeGeometry(cx, cz, R, near){
 const pos = [], uv = [], idx = [];
 for (let bx = Math.floor(cx - R); bx <= Math.floor(cx + R); bx++){
  for (let bz = Math.floor(cz - R); bz <= Math.floor(cz + R); bz++){
   //  Skip columns wholly outside the circle.
   const nx = Math.max(bx, Math.min(cx, bx + 1)), nz = Math.max(bz, Math.min(cz, bz + 1));
   if (Math.hypot(nx - cx, nz - cz) > R) continue;
   const h = groundTop(bx + 0.5, bz + 0.5, near + 2);
   //  Only ground within a step of the lamp's own footing: not rooftops, not pits.
   if (h === null || Math.abs(h - near) > 1.01) continue;
   const y = h + 0.03, base = pos.length / 3;
   for (const [x, z] of [[bx, bz], [bx + 1, bz], [bx + 1, bz + 1], [bx, bz + 1]]){
    pos.push(x, y, z); uv.push((x - cx) / (2 * R) + 0.5, (z - cz) / (2 * R) + 0.5);
   }
   idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
 }
 //  A lone column (a lamp on a ledge) would read as a lit square, not a pool.
 if (idx.length < 6 * 6) return null;
 const g = new THREE.BufferGeometry();
 g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
 g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
 g.setIndex(idx);
 return g;
}
function dressLight(chunk, light){
 if (!light || light.userData.gritPool || !light.isPointLight || !inScene(light)) return;
 light.userData.gritPool = true;
 light.getWorldPosition(WP);
 if (typeof getBlock !== 'function' || typeof isSolid !== 'function') return;
 let top = null;
 for (let y = Math.min(40, Math.floor(WP.y)); y >= 0; y--) if (isSolid(getBlock(Math.floor(WP.x), y, Math.floor(WP.z)))){ top = y + 1; break; }
 if (top === null || WP.y - top > 9) return;
 //  The pool drapes over the blocks below it, one quad per column at that
 //  column's own height, so it lies on kerbs, steps and road alike instead of
 //  hanging flat at the height of whatever was directly under the lamp.
 const R = Math.max(2, Math.min(3.5, (light.distance || 8) * 0.38));
 const geo = drapeGeometry(WP.x, WP.z, R, top);
 if (!geo) return;
 const pool = new THREE.Mesh(geo, poolMat(light.color.getHex()));
 pool.renderOrder = 2; pool.userData.grit = true; pool.frustumCulled = false;
 //  Geometry is in world space; parent at the scene so it never inherits an offset.
 const parent = State.scene;
 parent.add(pool);
 (light.userData.gritOwned = light.userData.gritOwned || []).push(pool);
 OWNERS.add(light);
 //  Two puddles that catch the sky, offset so they read as wet patches.
 const s = Math.abs(hash(light.uuid));
 for (let i = 0; i < 2; i++){
  const a = (s % 628) / 100 + i * 2.4, r = 1.2 + ((s >> (i + 3)) % 16) / 10;
  const px = WP.x + Math.cos(a) * r, pz = WP.z + Math.sin(a) * r, h = groundTop(px, pz, top + 2);
  //  Only where the ground is level for the whole puddle; never on an edge.
  if (h === null || groundTop(px + 0.7, pz, h + 1) !== h || groundTop(px - 0.7, pz, h + 1) !== h || groundTop(px, pz + 0.7, h + 1) !== h || groundTop(px, pz - 0.7, h + 1) !== h) continue;
  const sh = new THREE.Mesh(GEO.sheen, MAT.sheen);
  sh.position.set(px, h + 0.04 + i * 0.002, pz);
  sh.rotation.y = a; sh.scale.set(1.2 + i * 0.5, 1, 0.7 + i * 0.25); sh.renderOrder = 2; sh.userData.grit = true;
  parent.add(sh); light.userData.gritOwned.push(sh);
 }
 Grit.lampPools++;
}
function dressChunk(chunk){
 if (!chunk || !chunk.lights) return;
 chunk.group?.updateMatrixWorld?.(true);
 for (const l of chunk.lights) dressLight(chunk, l);
}
//  Lights placed by authored districts (Makers' Mile, Common Ground) are not
//  in any chunk's list. Catch them near the player.
function dressNearby(){
 if (!State.scene || !window.Player) return;
 //  Never under something that moves: residents, cars, players.
 const movers = new Set();
 for (const n of State.globalNPCs || []) if (n.group) movers.add(n.group);
 for (const c of State.globalCars || []) if (c.group) movers.add(c.group);
 State.scene.traverse(o => {
  if (!o.isPointLight || o.userData.gritPool || !o.parent || (o.distance || 0) < 6) return;
  for (let a = o.parent; a; a = a.parent) if (movers.has(a)){ o.userData.gritPool = true; return; }
  o.getWorldPosition(WP);
  if (Math.hypot(WP.x - Player.position.x, WP.z - Player.position.z) < 70) dressLight(null, o);
 });
}

// ─── The overlay grade ─────────────────────────────────────────────────────
const overlay = document.createElement('div'); overlay.id = 'grit-grade';
const css = document.createElement('style');
css.textContent = `#grit-grade{position:fixed;inset:0;z-index:2;pointer-events:none;mix-blend-mode:soft-light;opacity:0;transition:opacity 1.2s}
body.grit-contrast canvas.grit-main{filter:contrast(1.08) saturate(0.98)}
body.in-intro #grit-grade{opacity:0!important}`;
document.head.append(css); document.body.append(overlay);

// ─── Every frame, after the lighting rig ───────────────────────────────────
let lastHour = null, lastPaint = '';
function frame(hour){
 const midnight = lastHour !== null && hour < lastHour - 12;
 lastHour = hour;
 if (midnight && !online()){ Grit.wraps++; try { localStorage.setItem('fc-grit-wraps', String(Grit.wraps)); } catch (e){} }
 pickHue();
 const day = dayFactor(hour), night = 1 - day;
 const on = Grit.enabled;
 const po = on ? 0.05 + 0.55 * night : 0;
 for (const m of POOL_MATS.values()) m.opacity = m.userData.coloured ? po * 0.6 : po;
 MAT.sheen.opacity = on ? 0.10 + 0.22 * night : 0;
 if (on && typeof SKY !== 'undefined' && SKY.horizon) MAT.sheen.color.copy(SKY.horizon).lerp(TMP.setHex(SODIUM), 0.35 * night).multiplyScalar(1.15);
 const paint = on ? Grit.hue.id + (night > 0.5 ? 'n' : 'd') : 'off';
 if (paint !== lastPaint){
  lastPaint = paint;
  overlay.style.background = !on ? 'none' : night > 0.5
   ? 'radial-gradient(ellipse at 50% 120%, rgba(255,140,50,.55), transparent 60%), linear-gradient(180deg, rgba(30,90,110,.55), rgba(20,40,60,.25))'
   : `radial-gradient(ellipse at 50% -20%, ${Grit.hue.grade}, transparent 75%), linear-gradient(180deg, ${Grit.hue.grade}aa, ${Grit.hue.grade}33 55%, rgba(30,24,20,.5))`;
 }
 //  0.89: the grade lives in the composite now (real-light.js); this film
 //  only returns if Real Light is switched off.
 const film = on && !(window.FCRealLight && FCRealLight.enabled);
 overlay.style.opacity = film ? String(0.46 + 0.18 * night) : '0';
 if (State.renderer && !State.renderer.domElement.classList.contains('grit-main')) State.renderer.domElement.classList.add('grit-main');
 document.body.classList.toggle('grit-contrast', on && !!window.HD && HD.tier !== 'perf');
}

if (typeof shApplyLighting === 'function'){
 const origLight = shApplyLighting;
 window.shApplyLighting = function(hour){
  const r = origLight.apply(this, arguments);
  try { frame(hour); } catch (e){ if (!Grit._warned){ Grit._warned = 1; console.warn('[grit]', e); } }
  return r;
 };
}
//  The sky system paints the dome and sets the fog after the lighting rig runs,
//  and overcast weather greys both. Lean them toward the day's hue last.
function tintSky(){
 if (!Grit.enabled) return;
 const hour = ((State.dayTime || 0) / 60) % 24, day = dayFactor(hour);
 if (day < 0.02) return;
 const w = 0.2 * day, target = TMP.set(Grit.hue.sky[1]);
 const col = State.sky?.geometry?.attributes?.color;
 if (col){ const a = col.array; for (let i = 0; i < a.length; i += 3){ a[i] += (target.r - a[i]) * w; a[i+1] += (target.g - a[i+1]) * w; a[i+2] += (target.b - a[i+2]) * w; } col.needsUpdate = true; }
}
if (typeof updateDayNight === 'function'){
 const origDay = updateDayNight;
 window.updateDayNight = function(dt){ const r = origDay.apply(this, arguments); try { tintSky(); } catch (e){} return r; };
}
//  Pools follow chunks as they stream in.
setInterval(() => { try { sweepOwners(); if (State.chunkMap) for (const [, c] of State.chunkMap) dressChunk(c); dressNearby(); } catch (e){} }, 1500);

// ─── Switch, in the Display panel (F) ──────────────────────────────────────
Grit.set = function(on){
 Grit.enabled = !!on;
 try { localStorage.setItem('fc-grit', on ? 'on' : 'off'); } catch (e){}
 Grit._key = null; pickHue(); retintSky(); lastPaint = '';
 syncToggle();
};
function syncToggle(){ const t = document.getElementById('grit-tog'); if (!t) return; t.classList.toggle('on', Grit.enabled); t.classList.toggle('off', !Grit.enabled); t.querySelector('b').textContent = Grit.enabled ? Grit.hue.name.toUpperCase() : 'OFF'; }
setInterval(() => {
 const panel = document.getElementById('hd-panel');
 if (!panel) return;
 let t = document.getElementById('grit-tog');
 if (!t){
  t = document.createElement('div'); t.className = 'tog'; t.id = 'grit-tog';
  t.innerHTML = '<span>SODIUM GRADE</span><b></b>';
  t.addEventListener('click', e => { e.stopPropagation(); Grit.set(!Grit.enabled); });
  const note = panel.querySelector('.note'); panel.insertBefore(t, note || null);
 }
 syncToggle();
}, 1000);

pickHue();
})();
