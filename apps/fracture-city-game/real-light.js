/* Real light (0.89): one look for the whole city.

   The city was lit by four systems that each painted over the last: a sky
   table, a lighting rig, a "sodium noir" pass that tinted every day bile green
   or bruise violet and laid a coloured CSS film over the screen, and a distant
   skyline built twice, once dark and unfogged, once fogged flat to the sky
   colour, with the fogged ring standing IN FRONT of the dark one. Up close the
   city was textured voxel brick; on the horizon it was cardboard.

   This file is the last word on how the frame looks:

   1. Air. Fog thickens toward the ground and thins with height, so a street
      fades into haze at its far end while a rooftop view stays crisp, the way
      real air behaves. Patched into three's own fog chunks, so every material
      in the game gets it at once, including the voxel shader.
   2. A skyline that belongs to the city. One camera-following ring of towers
      in three depth layers with setbacks, crowns and masts, a downtown that
      peaks in one direction, faced with the same window rhythm as the near
      buildings and lit by the same sun. Fog fades each layer into the sky.
      At night a share of its windows light up.
   3. Light with a direction. By day the sun does more of the work and the flat
      fill does less, so shapes turn and shadows read. Nights stay sodium.
   4. A grade in the composite, not a CSS film: warm highlights, cool shadows,
      gentle saturation roll-off, soft vignette and fine grain. It ships with
      the bloom pass (every tier except Performance).
   5. Trees. Smooth single-sphere crowns become clustered, faceted canopies
      with a lit top and a shaded underside.

   Everything here layers onto the existing systems after they run, and
   FCRealLight.set(false) returns the old look. */
(function(){'use strict';
if (typeof THREE === 'undefined') return;

const RL = window.FCRealLight = {
 enabled: true, zones: [], fogPatched: false, skyline: null, towers: 0, trees: 0,
 haze: { falloff: 0.05, amount: 0.55 },
};
try { if (localStorage.getItem('fc-real-light') === 'off') RL.enabled = false; } catch (e){}

// ─── 1. Air: height fog in three's own chunks ──────────────────────────────
//  This runs right after three loads, before any material compiles, so every
//  program in the game is built with it. The haze term integrates an
//  exponential density along the view ray: thick at street level, thin at
//  altitude. cameraPosition is a built-in uniform in every three shader, and
//  the world-space ray comes from the view matrix's rotation, so no new
//  uniforms are needed anywhere. RL_HAZE is read from the fog density itself,
//  so the existing time-of-day and weather control both terms together.
(function patchFog(){
 const C = THREE.ShaderChunk;
 if (!C || !C.fog_fragment || C.fog_fragment.indexOf('vFogRay') >= 0) return;
 C.fog_pars_vertex = `#ifdef USE_FOG
 varying float vFogDepth;
 varying vec3 vFogRay;
#endif`;
 C.fog_vertex = `#ifdef USE_FOG
 vFogDepth = - mvPosition.z;
 vFogRay = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;
#endif`;
 C.fog_pars_fragment = `#ifdef USE_FOG
 uniform vec3 fogColor;
 varying float vFogDepth;
 varying vec3 vFogRay;
 #ifdef FOG_EXP2
  uniform float fogDensity;
 #else
  uniform float fogNear;
  uniform float fogFar;
 #endif
#endif`;
 C.fog_fragment = `#ifdef USE_FOG
 #ifdef FOG_EXP2
  float rlDist = length( vFogRay );
  float rlD = fogDensity * rlDist * 0.75;
  float rlBase = 1.0 - exp( - rlD * rlD );
  float rlB = ${RL.haze.falloff.toFixed(4)};
  float rlRy = vFogRay.y * rlB;
  float rlH = abs( rlRy ) > 0.0001 ? ( 1.0 - exp( - rlRy ) ) / rlRy : 1.0;
  float rlHaze = 1.0 - exp( - fogDensity * ${RL.haze.amount.toFixed(3)} * rlDist * exp( - rlB * max( cameraPosition.y - 1.0, 0.0 ) ) * rlH );
  float fogFactor = 1.0 - ( 1.0 - rlBase ) * ( 1.0 - rlHaze );
 #else
  float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
 #endif
 gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
 RL.fogPatched = true;
})();

// Everything below needs the game's own globals, which exist once every
// script on the page has run.
function ready(fn){ if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }

ready(function(){
if (typeof State === 'undefined') return;
const TMP = new THREE.Color(), TMP2 = new THREE.Color();
const ramp = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
const dayOf = h => Math.min(ramp(h, 4.6, 7.4), 1 - ramp(h, 17.4, 20.2));
const hourNow = () => ((State.dayTime || 0) / 60) % 24;

// ─── 2. The skyline ────────────────────────────────────────────────────────
//  A small deterministic RNG so the skyline is the same every visit.
function rng(seed){ let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

//  Facade atlas. Left 7/8: a grid of windows (frame, glass, mullions). Right
//  1/8: plain wall, used for roofs and blank faces. The emissive atlas lights a
//  share of those same windows, warm and cool, for night.
function facadeTextures(){
 const S = 512, cols = 14, rows = 16, cw = (S * 7 / 8) / cols, ch = S / rows;
 const day = document.createElement('canvas'), lit = document.createElement('canvas');
 day.width = day.height = lit.width = lit.height = S;
 const g = day.getContext('2d'), e = lit.getContext('2d'), r = rng(8191);
 g.fillStyle = '#8c939a'; g.fillRect(0, 0, S, S);
 e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
 for (let y = 0; y < rows; y++){
  //  Every fourth floor is a plant or service band: no windows, darker.
  const band = y % 5 === 4;
  for (let x = 0; x < cols; x++){
   const X = x * cw, Y = y * ch;
   if (band){ g.fillStyle = '#7a8189'; g.fillRect(X, Y, cw + 1, ch + 1); continue; }
   const shade = 38 + Math.floor(r() * 26);
   g.fillStyle = `rgb(${shade},${shade + 6},${shade + 14})`;
   g.fillRect(X + cw * 0.14, Y + ch * 0.22, cw * 0.72, ch * 0.62);
   //  A sky reflection on the upper glass.
   g.fillStyle = 'rgba(170,190,210,.18)'; g.fillRect(X + cw * 0.14, Y + ch * 0.22, cw * 0.72, ch * 0.2);
   if (r() < 0.34){
    const warm = r() < 0.72;
    const a = 0.55 + r() * 0.45;
    e.fillStyle = warm ? `rgba(255,${190 + Math.floor(r() * 40)},${110 + Math.floor(r() * 50)},${a})` : `rgba(${150 + Math.floor(r() * 40)},${200 + Math.floor(r() * 30)},255,${a})`;
    e.fillRect(X + cw * 0.14, Y + ch * 0.22, cw * 0.72, ch * 0.62);
   }
  }
 }
 //  The plain strip.
 g.fillStyle = '#80878e'; g.fillRect(S * 7 / 8, 0, S / 8, S);
 const make = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; return t; };
 return { map: make(day), emit: make(lit) };
}

//  Geometry: boxes with UVs in metres, so every face shows windows at the same
//  floor height and bay width whatever the tower's size. Faces are wound
//  outward and carry their own normals for the sun to light.
function towerGeometry(){
 const pos = [], nrm = [], uv = [], col = [], idx = [];
 const R = rng(4242);
 const BAY = 3.2, FLOOR = 3.4;      // metres per window cell
 const U_CELL = (7 / 8) / 14, V_CELL = 1 / 16;
 function quad(p0, p1, p2, p3, n, uw, vh, blank, tint, uOff, vOff){
  const b = pos.length / 3;
  for (const p of [p0, p1, p2, p3]){ pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]); col.push(tint, tint, tint); }
  if (blank){ uv.push(0.93, 0.1, 0.99, 0.1, 0.99, 0.9, 0.93, 0.9); }
  else {
   //  Width wraps over whole bays inside the window part of the atlas: the
   //  shader cannot clamp a repeat to 7/8, so UVs are kept inside one tile
   //  and the face gets as many bays as fit (rounded), spread over its width.
   const bays = Math.max(1, Math.min(14, Math.round(uw / BAY))), floors = Math.max(1, Math.round(vh / FLOOR));
   const u0 = Math.min(uOff, 14 - bays) * U_CELL, v0 = vOff * V_CELL;
   const u1 = u0 + bays * U_CELL, v1 = v0 + floors * V_CELL;
   uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
  }
  idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
 }
 //  A box centred at (x, z) on the ground ring, yawed to face the city.
 function box(cx, y0, cz, w, h, d, yaw, tint, blankSides){
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (lx, y, lz) => [cx + lx * c - lz * s, y, cz + lx * s + lz * c];
  const N = (lx, lz) => [lx * c - lz * s, 0, lx * s + lz * c];
  const hw = w / 2, hd = d / 2, y1 = y0 + h;
  const uo = Math.floor(R() * 4), vo = Math.floor(R() * 4);
  //  +z (faces the city once yawed), -z, +x, -x
  quad(P(-hw, y0, hd), P(hw, y0, hd), P(hw, y1, hd), P(-hw, y1, hd), N(0, 1), w, h, false, tint, uo, vo);
  quad(P(hw, y0, -hd), P(-hw, y0, -hd), P(-hw, y1, -hd), P(hw, y1, -hd), N(0, -1), w, h, blankSides, tint, uo, vo);
  quad(P(hw, y0, hd), P(hw, y0, -hd), P(hw, y1, -hd), P(hw, y1, hd), N(1, 0), d, h, blankSides, tint * 0.97, uo, vo);
  quad(P(-hw, y0, -hd), P(-hw, y0, hd), P(-hw, y1, hd), P(-hw, y1, -hd), N(-1, 0), d, h, blankSides, tint * 0.97, uo, vo);
  quad(P(-hw, y1, hd), P(hw, y1, hd), P(hw, y1, -hd), P(-hw, y1, -hd), [0, 1, 0], w, d, true, tint * 0.85, 0, 0);
 }
 //  Three rings. The near ring stands just past the streaming radius at the
 //  highest tier, the far ring fades almost into the sky.
 const rings = [
  { r: 300, n: 64, hMin: 26, hMax: 92,  tint: 0.92 },
  { r: 370, n: 78, hMin: 34, hMax: 128, tint: 1.00 },
  { r: 450, n: 92, hMin: 40, hMax: 165, tint: 1.06 },
 ];
 let towers = 0;
 for (const ring of rings){
  for (let i = 0; i < ring.n; i++){
   const a = (i + R() * 0.7) / ring.n * Math.PI * 2;
   //  Downtown: the skyline rises toward one quarter of the compass and
   //  falls to low mid-rise on the far side, like a real city seen from its
   //  edge. A second, smaller cluster sits opposite.
   const peak = Math.pow(Math.max(0, Math.cos(a - 0.9)), 3), sub = Math.pow(Math.max(0, Math.cos(a - 3.9)), 6) * 0.45;
   const k = Math.min(1, 0.18 + peak * 0.85 + sub + R() * 0.25);
   const h = ring.hMin + (ring.hMax - ring.hMin) * k * (0.55 + R() * 0.45);
   const w = 9 + R() * 16, d = 9 + R() * 12;
   const r = ring.r + (R() - 0.5) * 34;
   const x = Math.cos(a) * r, z = Math.sin(a) * r;
   const yaw = -a - Math.PI / 2;   // +z face toward the centre
   const tint = ring.tint * (0.82 + R() * 0.3);
   box(x, -2, z, w, h + 2, d, yaw, tint, false);
   //  Setbacks and crowns on the taller ones.
   if (h > 55 && R() < 0.75){
    const h2 = h * (0.18 + R() * 0.3);
    box(x, h, z, w * (0.55 + R() * 0.25), h2, d * (0.55 + R() * 0.25), yaw, tint * 1.02, false);
    if (R() < 0.5) box(x, h + h2, z, w * 0.3, 3 + R() * 6, d * 0.3, yaw, tint * 0.9, true);
   } else if (R() < 0.6){
    box(x + (R() - 0.5) * w * 0.4, h, z + (R() - 0.5) * d * 0.4, 3 + R() * 4, 2 + R() * 3, 3 + R() * 4, yaw, tint * 0.8, true);
   }
   if (h > 100 && R() < 0.6) box(x, h, z, 0.6, 14 + R() * 18, 0.6, yaw, 0.7, true);
   towers++;
  }
 }
 const geo = new THREE.BufferGeometry();
 geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
 geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
 geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
 geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
 geo.setIndex(idx);
 geo.computeBoundingSphere();
 RL.towers = towers;
 return geo;
}

let skyMat = null;
function buildSkyline(){
 if (RL.skyline && RL.skyline.parent === State.scene) return;
 if (!State.scene) return;
 if (!skyMat){
  const tex = facadeTextures();
  skyMat = new THREE.MeshLambertMaterial({ color: 0x3f4955, map: tex.map, emissive: 0xffffff, emissiveMap: tex.emit, emissiveIntensity: 0, vertexColors: true, fog: true });
  //  The fog is the colour of the horizon, which at dusk is the brightest
  //  thing in the sky. Full fog would turn the skyline into pale cards against
  //  it; a real skyline at dusk is a silhouette. So the towers take a share of
  //  the fog, enough to step back in depth, not enough to vanish.
  skyMat.userData.fogShare = { value: 0.62 };
  skyMat.onBeforeCompile = sh => {
   sh.uniforms.uFogShare = skyMat.userData.fogShare;
   sh.fragmentShader = 'uniform float uFogShare;\n' + sh.fragmentShader;
   sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace('mix( gl_FragColor.rgb, fogColor, fogFactor )', 'mix( gl_FragColor.rgb, fogColor, fogFactor * uFogShare )'));
  };
  skyMat.customProgramCacheKey = () => 'rl-skyline';
  RL.skyMat = skyMat;
 }
 const mesh = new THREE.Mesh(towerGeometry(), skyMat);
 mesh.name = 'real-skyline'; mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false;
 mesh.userData._hdTag = 1; mesh.renderOrder = -1;
 State.scene.add(mesh);
 RL.skyline = mesh;
}
function oldHorizon(visible){
 for (const g of [State.skyline, State.farSkyline]) if (g) for (const c of g.children) c.visible = visible;
}

// ─── 3. The look table: the one place light, fog and exposure are set ──────
//  Until 0.90 six passes wrote these numbers every frame, each scaling or
//  overwriting the last: the base rig, the sky's daylight pass, the visual
//  cohesion palette, the HD fog multiplier, the sodium grade and this file.
//  Half the writes were dead (the HD fog multiplier was overwritten by the sky
//  pass a few lines later; the sky's exposure easing by the palette pass), and
//  no single file could tell you what the noon sun actually was. Now this
//  function sets every value absolutely, from the clock, the weather cover,
//  the day's weather hue, the tier and the player's brightness setting. The
//  older passes no longer touch lights, fog or exposure.
const C = {
 sunHigh: 0xfff1de, sunLow: 0xffb27a, moon: 0x8ea6d8,
 hemiDay: 0xa9c6ea, groundDay: 0x6b6258, hemiNight: 0xcf9a5e, groundNight: 0x24525c,
 ambDay: 0xc8d2dc, ambNight: 0x2c6a74,
 rimDay: 0x9fb8d8, rimNight: 0x4f8fa8,
 neonA: 0xffa040, neonB: 0x6fd6e0,
};
const LT = new THREE.Color(), LT2 = new THREE.Color(), V3 = new THREE.Vector3();
function look(hour){
 if (!State.sunLight || !State.hemi) return;
 const day = dayOf(hour), night = 1 - day;
 const cover = (typeof SKY !== 'undefined' && SKY.cover != null) ? SKY.cover : 0.4, clear = 1 - cover * 0.45;
 const E = (typeof LOOK !== 'undefined' ? LOOK.exposure : 1);
 const G = window.Grit, hue = G && G.enabled ? G.hue : null;
 const sd = (typeof SKY !== 'undefined' && SKY.sunDir) ? SKY.sunDir : { x: 0.3, y: 0.8, z: 0.2 };
 const md = (typeof SKY !== 'undefined' && SKY.moonDir) ? SKY.moonDir : { x: -0.3, y: 0.6, z: -0.2 };
 //  Sun by day, moon by night: the key light comes from whichever is up, so
 //  nothing is ever lit from under the street.
 const up = sd.y > -0.02, dir = up ? sd : md;
 State.sunLight.position.set(dir.x * 120, Math.max(0.08, dir.y) * 120, dir.z * 120);
 const elev = Math.max(0, Math.min(1, sd.y * 2.2));
 State.sunLight.intensity = (0.16 + 2.0 * day * clear) * E;
 if (up) LT.setHex(C.sunLow).lerp(LT2.setHex(C.sunHigh), elev); else LT.setHex(C.moon);
 if (hue && up) LT.lerp(LT2.set(hue.sun), 0.3 * day);
 State.sunLight.color.copy(LT);
 //  Sky fill: blue overhead by day; at night sodium from above, teal below.
 State.hemi.intensity = ((0.35 + 1.05 * clear) * day + 1.3 * night) * E;
 LT.setHex(C.hemiDay); if (hue) LT.lerp(LT2.set(hue.hemi), 0.3);
 State.hemi.color.copy(LT).lerp(LT2.setHex(C.hemiNight), night);
 LT.setHex(C.groundDay); if (hue) LT.lerp(LT2.set(hue.ground), 0.3);
 State.hemi.groundColor.copy(LT).lerp(LT2.setHex(C.groundNight), night);
 if (State.ambient){
  State.ambient.intensity = (0.37 * day + 0.47 * night) * E;
  State.ambient.color.setHex(C.ambDay).lerp(LT2.setHex(C.ambNight), night);
 }
 if (State.rimLight){ State.rimLight.intensity = 0.30 + 0.34 * night; State.rimLight.color.setHex(C.rimDay).lerp(LT2.setHex(C.rimNight), night); }
 if (State.neonFillA){ State.neonFillA.intensity = 0.22 * night * E; State.neonFillA.color.setHex(C.neonA); }
 if (State.neonFillB){ State.neonFillB.intensity = 0.12 * night * E; State.neonFillB.color.setHex(C.neonB); }
 //  Fog is the horizon's colour, leaning toward the day's weather, and thins
 //  on tiers that see further (normalised so HIGH is the tuned reference).
 const fog = State.scene && State.scene.fog;
 if (fog){
  if (typeof SKY !== 'undefined' && SKY.horizon) fog.color.copy(SKY.horizon);
  if (hue) fog.color.lerp(LT2.set(hue.sky[0]), 0.35 * day);
  const tier = window.HD && HD.T ? HD.T.fog / 0.74 : 1;
  fog.density = (0.0026 + 0.0026 * night) * (1 + cover * 0.55) * tier;
 }
 //  Zones: an authored place (the Lantern Hall) can claim the air and the
 //  light while the player is inside it. They run last, inside this table,
 //  so nothing downstream overwrites them.
 for (const z of RL.zones){ try { z({ fog, sun: State.sunLight, hemi: State.hemi, ambient: State.ambient, day, night }); } catch (e){} }
 if (State.renderer){
  //  First Night's quiet minute dims the whole city for one beat.
  const quiet = (typeof Campaign !== 'undefined' && Campaign._quietExposure != null) ? 0.72 : 1;
  State.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  State.renderer.toneMappingExposure = 1.22 * E * quiet;
 }
 RL.last = { hour, day, cover, sun: State.sunLight.intensity, hemi: State.hemi.intensity, fog: fog ? fog.density : 0, exposure: State.renderer ? State.renderer.toneMappingExposure : 0 };
}
RL.look = look;

// ─── 4. The grade ──────────────────────────────────────────────────────────
const GRADE_FRAG = `
 varying vec2 vUvq;
 uniform sampler2D tScene;
 uniform sampler2D tBloom;
 uniform float uStrength;
 uniform float uExposure;
 uniform float uVignette;
 uniform float uTime;
 uniform float uGrain;
 uniform float uGrade;
 uniform vec3 uShadowTint;
 uniform vec3 uHighTint;
 uniform vec2 uRes;
 vec3 hdRRTFit(vec3 v){
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
 }
 vec3 hdACES(vec3 color){
  mat3 IN = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  mat3 OUT = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  color *= uExposure / 0.6;
  color = IN * color; color = hdRRTFit(color); color = OUT * color;
  return clamp(color, 0.0, 1.0);
 }
 vec3 hdToSRGB(vec3 c){
  return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
 }
 float rlHash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
 void main(){
  vec3 base = texture2D(tScene, vUvq).rgb;
  vec3 glow = texture2D(tBloom, vUvq).rgb;
  vec3 col = hdToSRGB(hdACES(base + glow * uStrength));
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  //  Split tone: shadows lean cool, highlights lean warm. Weighted so the
  //  midtones, where skin and brick live, are left nearly alone.
  float sh = 1.0 - smoothstep(0.0, 0.45, L), hi = smoothstep(0.55, 1.0, L);
  vec3 graded = col + (uShadowTint * sh + uHighTint * hi) * uGrade;
  //  Saturation rolls off in the brightest and darkest tones, which is what
  //  film and good sensors do and what flat digital colour does not.
  float g2 = dot(graded, vec3(0.2126, 0.7152, 0.0722));
  float sat = 1.0 - 0.22 * uGrade * (hi + sh * 0.6);
  graded = mix(vec3(g2), graded, sat);
  //  A gentle S around the middle for depth.
  graded = mix(graded, graded * graded * (3.0 - 2.0 * graded), 0.18 * uGrade);
  col = mix(col, graded, step(0.001, uGrade));
  //  Vignette: elliptical, soft, stronger in the corners than at the sides.
  vec2 d = (vUvq - 0.5) * vec2(1.0, 0.82);
  float v = 1.0 - uVignette * smoothstep(0.12, 0.62, dot(d, d) * 2.2);
  col *= v;
  //  Fine grain, strongest in the mids, frozen to the pixel grid so it never
  //  swims as a pattern.
  float n = rlHash(floor(vUvq * uRes) + floor(uTime * 24.0) * 17.0) - 0.5;
  col += n * uGrain * (0.35 + 0.65 * (1.0 - abs(L - 0.5) * 2.0));
  gl_FragColor = vec4(col, 1.0);
 }`;
let gradeInstalled = false;
function installGrade(){
 const H = window.HD;
 if (gradeInstalled || !H || !H.Bloom || !H.bloomInit) return;
 H.bloomInit();
 const m = H.Bloom.comp; if (!m) return;
 Object.assign(m.uniforms, {
  uTime: { value: 0 }, uGrain: { value: 0.028 }, uGrade: { value: 1 },
  uShadowTint: { value: new THREE.Vector3(-0.012, 0.004, 0.03) },
  uHighTint: { value: new THREE.Vector3(0.03, 0.012, -0.022) },
  uRes: { value: new THREE.Vector2(1920, 1080) },
 });
 m.fragmentShader = GRADE_FRAG; m.needsUpdate = true;
 //  Grain moves every rendered frame, including while the game is paused
 //  under the Soundstage, where a frozen grain would read as a dirty lens.
 const quad = H.Bloom.quad, prev = quad.onBeforeRender;
 quad.onBeforeRender = function(){ m.uniforms.uTime.value = performance.now() / 1000; return prev && prev.apply(this, arguments); };
 gradeInstalled = true; RL.grade = m;
}
function gradeFrame(hour){
 if (!gradeInstalled) return;
 const u = RL.grade.uniforms, day = dayOf(hour), night = 1 - day;
 u.uGrade.value = RL.enabled ? 1 : 0;
 u.uGrain.value = RL.enabled ? 0.022 + 0.014 * night : 0;
 u.uVignette.value = RL.enabled ? 0.38 + 0.12 * night : 0.32;
 //  Night: shadows go teal, highlights sodium. Day: a softer version.
 u.uShadowTint.value.set(-0.014 - 0.01 * night, 0.004 + 0.012 * night, 0.028 + 0.012 * night);
 u.uHighTint.value.set(0.028 + 0.02 * night, 0.012 + 0.004 * night, -0.022 - 0.014 * night);
 window.FCWorldStudio?.applyGrade(u);
 const B = window.HD && HD.Bloom; if (B && B.w) u.uRes.value.set(B.w, B.h);
}
//  Performance tier has no composite pass: a CSS vignette stands in.
const css = document.createElement('style');
css.textContent = '#rl-vignette{position:fixed;inset:0;z-index:2;pointer-events:none;background:radial-gradient(ellipse 75% 80% at 50% 48%,transparent 55%,rgba(6,8,14,.42) 100%);opacity:0;transition:opacity .6s}body.rl-css-vig #rl-vignette{opacity:1}body.in-intro #rl-vignette{opacity:0!important}'
 //  World prompts wear the same dark glass as the rest of the HUD.
 + '#common-invite,#common-later{background:#111b24e8!important;border:1px solid #60707b!important;border-radius:20px!important;color:#e9eef0!important;backdrop-filter:blur(6px)}';
document.head.append(css);
const vig = document.createElement('div'); vig.id = 'rl-vignette'; document.body.append(vig);

// ─── 5. Trees ──────────────────────────────────────────────────────────────
//  A crown is five to seven faceted lobes, merged, coloured lighter on top
//  where the sky reaches it and darker underneath, with a little hue drift so
//  no two trees are one colour. It keeps the original mesh's position, scale
//  and material settings; only the geometry and colouring change.
const CANOPY = new Map();
function canopyGeometry(seed, radius){
 const key = seed % 6 + ':' + radius.toFixed(2);
 if (CANOPY.has(key)) return CANOPY.get(key);
 const R = rng(seed * 977 + 11), parts = [], n = 5 + Math.floor(R() * 3);
 for (let i = 0; i < n; i++){
  const a = i / n * Math.PI * 2 + R(), rr = radius * (0.35 + R() * 0.3);
  const g = new THREE.IcosahedronGeometry(radius * (0.48 + R() * 0.24), 0);
  g.translate(Math.cos(a) * rr, (R() - 0.35) * radius * 0.5, Math.sin(a) * rr);
  parts.push(g);
 }
 const top = new THREE.IcosahedronGeometry(radius * 0.62, 0); top.translate(0, radius * 0.38, 0); parts.push(top);
 let count = 0; for (const g of parts) count += g.toNonIndexed().attributes.position.count;
 const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
 let o = 0;
 for (const g0 of parts){
  const g = g0.toNonIndexed(), p = g.attributes.position;
  const hueJit = (R() - 0.5) * 0.12;
  for (let i = 0; i < p.count; i++){
   const y = p.getY(i);
   const t = Math.max(0, Math.min(1, (y + radius * 0.6) / (radius * 1.5)));
   const v = 0.62 + t * 0.55;
   pos[o] = p.getX(i); pos[o + 1] = y; pos[o + 2] = p.getZ(i);
   col[o] = v * (1 + hueJit); col[o + 1] = v; col[o + 2] = v * (0.92 - hueJit * 0.5);
   o += 3;
  }
  g.dispose(); g0.dispose();
 }
 const geo = new THREE.BufferGeometry();
 geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
 geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
 geo.computeVertexNormals(); geo.computeBoundingSphere();
 CANOPY.set(key, geo);
 return geo;
}
const LEAF_MATS = new Map(), HSL = {};
function leafMaterial(m){
 let out = LEAF_MATS.get(m.uuid);
 if (!out){
  out = m.clone(); out.vertexColors = true; out.flatShading = true;
  //  A canopy is a darker, richer green than the single-ball crowns.
  out.color.getHSL(HSL); out.color.setHSL(HSL.h, Math.min(0.55, HSL.s * 1.25), HSL.l * 0.82);
  if (out.emissive) out.emissiveIntensity = (out.emissiveIntensity || 0) * 0.4;
  if ('roughness' in out) out.roughness = 0.92;
  out.needsUpdate = true; LEAF_MATS.set(m.uuid, out);
 }
 return out;
}
function isCrown(o){
 if (!o.isMesh || o.isInstancedMesh || o.userData.rlTree || o.userData.rlSkip) return false;
 const g = o.geometry; if (!g || (g.type !== 'IcosahedronGeometry' && g.type !== 'DodecahedronGeometry')) return false;
 const m = o.material; if (!m || Array.isArray(m) || !m.color || m.transparent) return false;
 m.color.getHSL(HSL);
 return HSL.h > 0.2 && HSL.h < 0.48 && HSL.s > 0.08 && HSL.l > 0.15 && HSL.l < 0.7;
}
function treeSweep(){
 if (!RL.enabled || !State.scene) return;
 State.scene.traverse(o => {
  if (!isCrown(o)) return;
  o.userData.rlTree = { geo: o.geometry, mat: o.material };
  const r = o.geometry.parameters?.radius || 1;
  const p = o.getWorldPosition(new THREE.Vector3());
  const seed = Math.abs(Math.floor(p.x * 31 + p.z * 17));
  o.geometry = canopyGeometry(seed, r);
  o.material = leafMaterial(o.material);
  o.castShadow = true; o.receiveShadow = true;
  RL.trees++;
 });
}
function treesRestore(){
 State.scene?.traverse(o => { const t = o.userData.rlTree; if (!t) return; o.geometry = t.geo; o.material = t.mat; delete o.userData.rlTree; });
 RL.trees = 0;
}

// ─── 6. Wear: surface detail for hand-built props ──────────────────────────
//  Props built from plain boxes (the first-person weapons and hands, the
//  arcade cabinets) had one flat colour per face. This adds object-space
//  mottling to the colour and the roughness, so a gun reads as worn steel and
//  a cabinet as lacquer with handling marks. Object space, so the pattern
//  sticks to the prop as it moves; no UVs needed, which matters because the
//  weapons are merged without them.
const WEAR_GLSL = `
 varying vec3 vWearP;
 float wHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
 float wNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
function wear(m, scale, amount){
 if (!m || m.userData.rlWear || !m.isMeshStandardMaterial) return;
 m.userData.rlWear = true;
 const prev = m.onBeforeCompile;
 m.onBeforeCompile = function(sh, r){
  if (prev) prev.call(this, sh, r);
  sh.vertexShader = 'varying vec3 vWearP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWearP = position;\n#ifdef USE_INSTANCING\n vWearP = (instanceMatrix * vec4(position, 1.0)).xyz;\n#endif');
  sh.fragmentShader = WEAR_GLSL + '\n' + sh.fragmentShader
   .replace('#include <color_fragment>', `#include <color_fragment>
 float wN = wNoise(vWearP * ${scale.toFixed(1)}) * 0.6 + wNoise(vWearP * ${(scale * 3.7).toFixed(1)}) * 0.4;
 diffuseColor.rgb *= 1.0 + (wN - 0.5) * ${(amount * 2).toFixed(3)};`)
   .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
 roughnessFactor = clamp(roughnessFactor + (wN - 0.5) * 0.3, 0.05, 1.0);`);
 };
 const key = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
 m.customProgramCacheKey = () => key() + '|rlwear' + scale + ':' + amount;
 m.needsUpdate = true;
}
RL.wear = wear;
function wearSweep(){
 if (!State.camera || !State.scene) return;
 //  The first-person kit: worn metal and skin, and less of the self-glow
 //  that made it read as a flat sticker against the street.
 for (const c of State.camera.children){
  if (c.name !== 'first-person-equipment') continue;
  c.traverse(o => { if (!o.isMesh) return; const m = o.material; if (!m || m.userData.rlWear) return;
   if (m.emissiveIntensity) m.emissiveIntensity *= 0.35;
   wear(m, 34, m.metalness > 0.3 ? 0.16 : 0.08); });
 }
 State.scene.traverse(o => {
  if (!o.isMesh || !o.parent || !/^campus-arcade-/.test(o.parent.name)) return;
  wear(o.material, 9, 0.12);
 });
 //  Common Ground's stone, paving and bronze: weathering at two scales, a
 //  metre-wide blotch and a hand-sized grain, so big plain slabs stop reading
 //  as untextured cards.
 State.scene.traverse(o => {
  if (!o.isMesh || !/^common-ground-(stone|paving|pavingAlt|atrium|bronze|dark|wood)$/.test(o.name)) return;
  const m = o.material; if (Array.isArray(m)) return;
  wear(m, 0.9, /bronze|dark/.test(o.name) ? 0.1 : 0.14);
 });
}

// ─── 7. One glass for the HUD's world prompts ──────────────────────────────
//  Eight features each drew their own "press E" pill in their own colours,
//  fonts and radii. They now share one dark glass, one type, one radius; each
//  keeps a thin accent rule on the left so you can still tell them apart.
const ui = document.createElement('style');
ui.textContent = `:root{--ui-glass:#0f1820e6;--ui-line:#5d6d78;--ui-ink:#eef2f3}
#cg-approach,#news-approach,#rw-approach,#seam-approach,#casting-prompt,#npc-talk-prompt,#city-art-open,#common-invite,#common-later{background:var(--ui-glass)!important;color:var(--ui-ink)!important;border:1px solid var(--ui-line)!important;border-radius:22px!important;font:600 14px/1.3 system-ui,sans-serif!important;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 6px 18px #0006!important}
#cg-approach{border-left:3px solid #e7bd78!important}#news-approach{border-left:3px solid #afd9c7!important}#rw-approach{border-left:3px solid #c9a85a!important}#seam-approach{border-left:3px solid #9ff3ff!important}
#casting-prompt{border-left:3px solid #00e5ff!important}#npc-talk-prompt{border-left:3px solid #ff2e88!important}#city-art-open{border-left:3px solid #9dbf96!important}
#npc-quest,#seam-hud{background:var(--ui-glass)!important;border-color:var(--ui-line)!important;color:var(--ui-ink)!important;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#npc-quest{border-left:3px solid #ffe500!important}`;
document.head.append(ui);

// ─── Wiring ────────────────────────────────────────────────────────────────
function frame(){
 const hour = hourNow(), day = dayOf(hour), night = 1 - day;
 look(hour);
 installGrade();
 if (RL.enabled){
  buildSkyline(); oldHorizon(false);
  //  Under the Soundstage the shot camera, not the player's, is the eye.
  const eye = (document.body.classList.contains('fc-soundstage') && window.FCSoundstage && FCSoundstage.camera) || State.camera;
  if (RL.skyline && eye){
   RL.skyline.visible = true;
   RL.skyline.position.set(eye.position.x, 0, eye.position.z);
   //  Windows light as the sky darkens; a few are on through the day.
   skyMat.emissiveIntensity = 0.06 + 1.1 * Math.pow(night, 1.4);
   //  The towers take the sky's colour a little, the way distant glass does.
   if (typeof SKY !== 'undefined' && SKY.horizon) skyMat.color.setHex(0x3f4955).lerp(TMP2.copy(SKY.horizon), 0.12 + 0.1 * day);
   skyMat.userData.fogShare.value = 0.7 - 0.32 * (4 * day * night) + 0.15 * night * night;
  }
 } else {
  if (RL.skyline) RL.skyline.visible = false;
  oldHorizon(true);
 }
 gradeFrame(hour);
 document.body.classList.toggle('rl-css-vig', RL.enabled && !!window.HD && !HD.bloomOn);
}
if (typeof updateDayNight === 'function'){
 const orig = window.updateDayNight;
 window.updateDayNight = function(){ const r = orig.apply(this, arguments); try { frame(); } catch (e){ if (!RL._w2){ RL._w2 = 1; console.warn('[real-light]', e); } } return r; };
}
setInterval(() => { try { treeSweep(); } catch (e){} try { wearSweep(); } catch (e){} }, 2000);

RL.set = function(on){
 RL.enabled = !!on;
 try { localStorage.setItem('fc-real-light', on ? 'on' : 'off'); } catch (e){}
 if (!on) treesRestore(); else treeSweep();
 try { shApplyLighting(hourNow()); } catch (e){}
 frame(); syncToggle();
};
RL.frame = frame; RL.treeSweep = treeSweep;

//  Display panel (F): one switch, next to the others.
function syncToggle(){ const t = document.getElementById('rl-tog'); if (!t) return; t.classList.toggle('on', RL.enabled); t.classList.toggle('off', !RL.enabled); t.querySelector('b').textContent = RL.enabled ? 'ON' : 'OFF'; }
setInterval(() => {
 const panel = document.getElementById('hd-panel'); if (!panel) return;
 let t = document.getElementById('rl-tog');
 if (!t){
  t = document.createElement('div'); t.className = 'tog'; t.id = 'rl-tog';
  t.innerHTML = '<span>REAL LIGHT</span><b></b>';
  t.addEventListener('click', e => { e.stopPropagation(); RL.set(!RL.enabled); });
  const note = panel.querySelector('.note'); panel.insertBefore(t, note || null);
 }
 syncToggle();
}, 1000);
});
})();
