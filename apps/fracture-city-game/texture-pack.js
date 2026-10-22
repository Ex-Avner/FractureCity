/* The HD texture pack.

   Sixteen photo-scanned CC0 materials from ambientCG (asphalt, paving,
   concrete, brick, steel, rust, roof tile, ceramic tile, marble, plaster,
   terrazzo, wood, fluted metal, copper, felt) at 1K or 2K, applied to the
   city's streets and buildings and to the Makers' Mile building kit.

   Only the scans' fine detail and surface relief are used: each texture is
   a luminance detail layer plus a normal map (see _build/build-texture-pack.py).
   The game's own block colours stay, so district palettes, the sodium-noir
   grade, night and the daily hues all still read. The relief is real lighting:
   the normal map bends the light on every face.

   All sixteen layers sit in one WebGL2 texture array and the voxel shader
   picks a layer by block id, so the pack costs one texture bind. It needs
   WebGL2. Phones and the Performance tier keep the existing look.

   Display panel (F): TEXTURE PACK  OFF / 1K / 2K. */
(function(){'use strict';
if (typeof THREE === 'undefined' || !THREE.DataArrayTexture) return;

const KEY = 'fc-texpack';
const base = () => new URL('textures/', location.href).href;
const touch = matchMedia('(pointer: coarse)').matches;
const P = { mode: 'off', ready: false, loading: false, loaded: 0, total: 0, error: '', manifest: null, size: 0, tex: null, info: null, patched: false };
try { P.want = localStorage.getItem(KEY); } catch (e){}
//  Default: 1K on desktop at Balanced or better, off on phones.
function defaultMode(){ return touch ? 'off' : '1k'; }

// ─── Uniforms shared by the patched voxel shader ───────────────────────────
const blank = new THREE.DataArrayTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, 1); blank.needsUpdate = true;
const infoData = new Uint8Array(256 * 4);
const infoTex = new THREE.DataTexture(infoData, 256, 1, THREE.RGBAFormat); infoTex.magFilter = infoTex.minFilter = THREE.NearestFilter; infoTex.needsUpdate = true;
const U = { uTexPack: { value: blank }, uTexInfo: { value: infoTex }, uTexOn: { value: 0 }, uTexStrength: { value: .9 }, uTexBump: { value: 1.0 } };

const GLSL_HEAD = `
uniform highp sampler2DArray uTexPack;
uniform sampler2D uTexInfo;
uniform float uTexOn, uTexStrength, uTexBump;
`;
//  Sampled once per fragment; .x detail, .yz normal, .w 1 when this block has a layer.
const GLSL_SAMPLE = `
vec4 fcTP = vec4(0.5, 0.5, 0.5, 0.0);
if (uTexOn > 0.5){
  int fcId = int(vSurfMat + 0.5);
  vec4 fcInfo = texelFetch(uTexInfo, ivec2(clamp(fcId, 0, 255), 0), 0);
  if (fcInfo.r > 0.0){
    float fcLayer = floor(fcInfo.r * 255.0 + 0.5) - 1.0;
    float fcRep = max(fcInfo.g * 255.0 / 16.0, 0.25);
    vec3 fcS = texture(uTexPack, vec3(vSurfUV / fcRep, fcLayer)).rgb;
    fcS.r = 0.5 + (fcS.r - 0.5) * (fcInfo.b > 0.0 ? fcInfo.b * 255.0 / 64.0 : 1.0);
    float fcNear = 1.0 - smoothstep(70.0, 160.0, distance(cameraPosition, vSurfW));
    fcTP = vec4(fcS.r, mix(vec2(0.5), fcS.gb, fcNear), 1.0);
  }
}
`;
//  Bends the shading normal by the map, using a tangent frame built from the
//  face's own world-space UV, so it works on every face of every block.
const GLSL_NORMAL = `
if (fcTP.w > 0.5){
  vec3 fcMapN = vec3((fcTP.yz * 2.0 - 1.0) * uTexBump, 1.0);
  vec3 fcQ0 = dFdx(-vViewPosition), fcQ1 = dFdy(-vViewPosition);
  vec2 fcSt0 = dFdx(vSurfUV), fcSt1 = dFdy(vSurfUV);
  vec3 fcN = normal;
  vec3 fcQ1p = cross(fcQ1, fcN), fcQ0p = cross(fcN, fcQ0);
  vec3 fcT = fcQ1p * fcSt0.x + fcQ0p * fcSt1.x, fcB = fcQ1p * fcSt0.y + fcQ0p * fcSt1.y;
  float fcDet = max(dot(fcT, fcT), dot(fcB, fcB));
  float fcSc = fcDet == 0.0 ? 0.0 : inversesqrt(fcDet);
  normal = normalize(fcT * (fcMapN.x * fcSc) + fcB * (fcMapN.y * fcSc) + fcN * fcMapN.z);
}
`;

function patch(mat){
 if (!mat || mat.__texPack) return;
 mat.__texPack = true;
 const inner = mat.onBeforeCompile, innerKey = mat.customProgramCacheKey;
 mat.onBeforeCompile = function(shader, renderer){
  if (inner) inner.call(this, shader, renderer);
  Object.assign(shader.uniforms, U);
  let fs = shader.fragmentShader;
  fs = fs.replace('#include <common>', '#include <common>\n' + GLSL_HEAD);
  //  The pack replaces the procedural material detail where it has a layer;
  //  block seams and corner grime stay, softened.
  fs = fs.replace(/diffuseColor\.rgb \*= hdSurface\(([^;]*)\);/, (m, args) => GLSL_SAMPLE + `diffuseColor.rgb *= mix(hdSurface(${args}), vec3(1.0), fcTP.w * 0.55);\ndiffuseColor.rgb *= mix(1.0, clamp(fcTP.x * 2.0, 0.45, 1.55), fcTP.w * uTexStrength);`);
  fs = fs.replace(/diffuseColor\.rgb \*= fcWeathered\(([^;]*)\);/, (m, args) => `diffuseColor.rgb *= mix(fcWeathered(${args}), vec3(1.0), fcTP.w);`);
  if (!/vec4 fcTP/.test(fs)){ console.warn('[texture-pack] voxel shader not recognised; pack disabled'); P.error = 'Shader changed'; shader.fragmentShader = shader.fragmentShader; return; }
  fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GLSL_NORMAL);
  shader.fragmentShader = fs;
 };
 mat.customProgramCacheKey = function(){ return (innerKey ? innerKey.call(this) : '') + '|texpack-1'; };
 mat.needsUpdate = true;
 P.patched = true;
}

//  Makers' Mile's architecture is meshes dressed by world-materials.js, not
//  voxels. Those get the same layers through their own world-space varyings.
function dressPatch(mat){
 if (!mat || mat.__texPack || !mat.onBeforeCompile || mat.isMeshBasicMaterial) return;
 mat.__texPack = true;
 const inner = mat.onBeforeCompile, innerKey = mat.customProgramCacheKey;
 mat.onBeforeCompile = function(shader, renderer){
  inner.call(this, shader, renderer);
  if (!State.renderer?.capabilities.isWebGL2) return;
  Object.assign(shader.uniforms, U);
  let fs = shader.fragmentShader;
  const re = /diffuseColor\.rgb\*=fcWeathered\(fcW,normalize\(fcN\),([0-9.]+)\);/;
  if (!re.test(fs)) return;
  fs = fs.replace('#include <common>', '#include <common>\n' + GLSL_HEAD);
  fs = fs.replace(re, (m, id) => `vec2 fcPlane = abs(fcN.y) > .5 ? fcW.xz : (abs(fcN.x) > .5 ? fcW.zy : fcW.xy);
vec4 fcTP = vec4(0.5, 0.5, 0.5, 0.0);
if (uTexOn > 0.5){
  vec4 fcInfo = texelFetch(uTexInfo, ivec2(${Math.round(Number(id))}, 0), 0);
  if (fcInfo.r > 0.0){
    float fcLayer = floor(fcInfo.r * 255.0 + 0.5) - 1.0, fcRep = max(fcInfo.g * 255.0 / 16.0, 0.25);
    vec3 fcS = texture(uTexPack, vec3(fcPlane / fcRep, fcLayer)).rgb;
    fcS.r = 0.5 + (fcS.r - 0.5) * (fcInfo.b > 0.0 ? fcInfo.b * 255.0 / 64.0 : 1.0);
    float fcNear = 1.0 - smoothstep(70.0, 160.0, distance(cameraPosition, fcW));
    fcTP = vec4(fcS.r, mix(vec2(0.5), fcS.gb, fcNear), 1.0);
  }
}
diffuseColor.rgb *= mix(fcWeathered(fcW,normalize(fcN),${id}), vec3(1.0), fcTP.w);
diffuseColor.rgb *= mix(1.0, clamp(fcTP.x * 2.0, 0.45, 1.55), fcTP.w * uTexStrength * 0.85);`);
  fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GLSL_NORMAL.replace(/vSurfUV/g, 'fcPlane'));
  shader.fragmentShader = fs;
 };
 mat.customProgramCacheKey = function(){ return (innerKey ? innerKey.call(this) : '') + '|texpack-1'; };
 mat.needsUpdate = true;
}
(function hookDress(){
 const W = window.FCWorldMaterials;
 if (!W || W.__texPackHooked) return;
 W.__texPackHooked = true;
 const dress = W.dress;
 W.dress = function(mat){ const r = dress.apply(this, arguments); try { dressPatch(mat); } catch (e){} return r; };
})();

// ─── Loading ───────────────────────────────────────────────────────────────
function loadImage(url){
 return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + url)); i.src = url; });
}
async function load(mode){
 const renderer = State.renderer;
 if (!renderer || !renderer.capabilities.isWebGL2){ P.error = 'Needs WebGL2'; return false; }
 if (!P.manifest){ const r = await fetch(base() + 'manifest.json'); if (!r.ok) throw new Error('No texture pack in this edition'); P.manifest = await r.json(); }
 const M = P.manifest, size = M.size[mode], n = M.layers.length;
 P.total = n; P.loaded = 0;
 const tex = new THREE.DataArrayTexture(null, size, size, n);
 tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
 tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
 tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
 tex.generateMipmaps = true; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
 tex.colorSpace = THREE.NoColorSpace ?? undefined;
 tex.needsUpdate = true;   // makes three allocate the full mip chain once
 renderer.initTexture(tex);
 const gl = renderer.getContext(), glTex = renderer.properties.get(tex).__webglTexture;
 if (!glTex) throw new Error('Texture array could not be created');
 //  Layer by layer straight from each decoded image: no full-size copy in memory.
 for (let i = 0; i < n; i++){
  const img = await loadImage(base() + mode + '/' + String(i).padStart(2, '0') + '.jpg');
  if (img.width !== size || img.height !== size) throw new Error('layer ' + i + ' is ' + img.width + 'px');
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, glTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, size, size, 1, gl.RGBA, gl.UNSIGNED_BYTE, img);
  P.loaded = i + 1; syncToggle();
  await new Promise(r => setTimeout(r, 0));
 }
 gl.bindTexture(gl.TEXTURE_2D_ARRAY, glTex); gl.generateMipmap(gl.TEXTURE_2D_ARRAY); gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
 renderer.resetState();
 //  Block id -> layer + repeat size.
 infoData.fill(0);
 for (const [id, layer] of Object.entries(M.blocks)){ const k = Number(id) * 4; infoData[k] = layer + 1; infoData[k + 1] = Math.round(M.layers[layer].blocksPerRepeat * 16); infoData[k + 2] = Math.min(255, Math.round((M.layers[layer].gain || 1) * 64)); }
 infoTex.needsUpdate = true;
 if (P.tex) P.tex.dispose();
 P.tex = tex; P.size = size; U.uTexPack.value = tex;
 return true;
}
async function setMode(mode){
 mode = ['off', '1k', '2k'].includes(mode) ? mode : 'off';
 try { localStorage.setItem(KEY, mode); } catch (e){}
 P.want = mode;
 //  A change asked for mid-load is applied when the load finishes.
 if (P.loading){ syncToggle(); return; }
 if (mode === 'off'){ U.uTexOn.value = 0; P.mode = 'off'; if (P.tex){ P.tex.dispose(); P.tex = null; U.uTexPack.value = blank; } syncToggle(); return; }
 P.loading = true; P.error = ''; syncToggle();
 try {
  if (P.mode !== mode || !P.tex) await load(mode);
  P.mode = mode; U.uTexOn.value = 1; P.ready = true;
 } catch (e){ P.error = String(e.message || e); U.uTexOn.value = 0; P.mode = 'off'; console.warn('[texture-pack]', e); }
 P.loading = false; syncToggle();
 if (P.want !== P.mode && !(P.want !== 'off' && P.error)) return setMode(P.want);
}

// ─── Switch, in the Display panel (F) ──────────────────────────────────────
function label(){
 if (P.loading) return 'LOADING ' + P.loaded + '/' + (P.total || 16);
 if (P.error) return 'UNAVAILABLE';
 return P.mode === 'off' ? 'OFF' : P.mode.toUpperCase();
}
function syncToggle(){
 const t = document.getElementById('texpack-tog'); if (!t) return;
 t.classList.toggle('on', P.mode !== 'off'); t.classList.toggle('off', P.mode === 'off');
 t.querySelector('b').textContent = label();
 t.title = P.error ? 'Texture pack: ' + P.error : 'Photo-scanned surface detail. 1K about 9 MB, 2K about 37 MB, loaded once.';
}
setInterval(() => {
 const panel = document.getElementById('hd-panel');
 if (!panel) return;
 let t = document.getElementById('texpack-tog');
 if (!t){
  t = document.createElement('div'); t.className = 'tog'; t.id = 'texpack-tog';
  t.innerHTML = '<span>TEXTURE PACK</span><b></b>';
  t.addEventListener('click', e => { e.stopPropagation(); const order = ['off', '1k', '2k']; setMode(order[(order.indexOf(P.want || P.mode) + 1) % 3]); });
  const note = panel.querySelector('.note'); panel.insertBefore(t, note || null);
 }
 syncToggle();
}, 1000);

// ─── Start once the city's own shader patch is in place ────────────────────
const wait = setInterval(() => {
 if (typeof M === 'undefined' || !M.voxOpaque || !M.voxOpaque.__hdPatched || !State.renderer) return;
 clearInterval(wait);
 if (!State.renderer.capabilities.isWebGL2){ P.error = 'Needs WebGL2'; return; }
 patch(M.voxOpaque);
 //  The Performance tier keeps the plain look whatever the setting says.
 const mode = P.want || defaultMode();
 if (mode !== 'off' && window.HD?.tier !== 'perf') setMode(mode); else { P.want = mode; syncToggle(); }
}, 400);
setInterval(() => { if (window.HD?.tier === 'perf' && U.uTexOn.value) U.uTexOn.value = 0; else if (window.HD?.tier !== 'perf' && P.mode !== 'off' && P.tex) U.uTexOn.value = 1; }, 1000);

window.FCTexturePack = { get state(){ return { mode: P.mode, want: P.want, ready: P.ready, loading: P.loading, loaded: P.loaded, total: P.total, error: P.error, size: P.size, patched: P.patched, on: U.uTexOn.value }; }, set: setMode, uniforms: U };
})();
