/* =============================================================================
 *  FRACTURE CITY // YOUR MEDIA                                          v0.37.0
 * -----------------------------------------------------------------------------
 *  Your music on Palm Radio, your art on the rooftop billboards and the
 *  skyline, your clips on the nearest screens.
 *
 *  Inside Present Palm the shell serves three folders (Fracture City/media/
 *  music, art, video) plus everything Palm Image Studio and Palm Video Studio
 *  have made, on the palm-media:// scheme. Outside the shell (the web beta),
 *  the Studio panel takes files you pick instead, for this session only.
 *
 *    H  Studio panel     U  play / pause radio     Y  next track
 * ========================================================================== */
(function(){
'use strict';
if (typeof State === 'undefined' || typeof THREE === 'undefined') return;

const shellMedia = window.fracture && window.fracture.media;
const PM = window.PalmMedia = {
  version: '0.40.0',
  inShell: !!shellMedia,
  music: [], images: [], videos: [],
  prefs: { radio: true, art: true, video: true, volume: 0.45, shuffle: true },
  order: [], pos: -1, audio: null, started: false,
  ads: [],            // billboards carrying art
  sky: [],            // skyline sprites carrying art
  tex: new Map(),     // url+shape -> Promise<{texture, color}>
  playingVideos: 0,
};
const safe = f => { try { return f(); } catch (e) { console.warn('[city-media]', e); } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ─── Preferences ────────────────────────────────────────────────────────────
async function loadPrefs(){
  try {
    const p = PM.inShell ? await window.fracture.read('media-prefs') : JSON.parse(localStorage.getItem('fc-media-prefs') || 'null');
    if (p && typeof p === 'object') Object.assign(PM.prefs, p);
  } catch (e) {}
}
function savePrefs(){
  try {
    if (PM.inShell) window.fracture.save('media-prefs', PM.prefs);
    else localStorage.setItem('fc-media-prefs', JSON.stringify(PM.prefs));
  } catch (e) {}
}

// ─── What there is ──────────────────────────────────────────────────────────
async function refresh(){
  if (!PM.inShell){
    if(window.FC_RADIO_URL && !PM.bundledLoaded){
      try { const response=await fetch(window.FC_RADIO_URL); if(!response.ok)throw Error('playlist');
        const list=await response.json(); const base=new URL(window.FC_RADIO_URL,location.href);
        PM.music=list.tracks.map(t=>({kind:'music',title:t.title,album:'Final Collection',url:new URL(t.file,base).href}));
        PM.bundledLoaded=true;reshuffle(false);renderPanel();
      }catch(e){console.warn('[radio] Could not load bundled soundtrack',e.message)}
    }return;
  }
  for (const kind of ['music', 'images', 'videos']){
    try {
      const r = await shellMedia.list(kind);
      const before = PM[kind].map(i => i.url).join('|');
      PM[kind] = (r && r.items) || [];
      if (kind === 'music' && PM[kind].map(i => i.url).join('|') !== before) reshuffle(true);
    } catch (e) { /* an old shell without the media service: stay empty */ }
  }
  renderPanel();
}
PM.refresh = refresh;

function reshuffle(keepCurrent){
  const cur = PM.order[PM.pos];
  PM.order = PM.music.map((_, i) => i);
  if (PM.prefs.shuffle) for (let i = PM.order.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [PM.order[i], PM.order[j]] = [PM.order[j], PM.order[i]]; }
  PM.pos = keepCurrent && cur != null ? Math.max(0, PM.order.indexOf(cur)) : -1;
}

// =============================================================================
//  PALM RADIO
// =============================================================================
function audio(){
  if (PM.audio) return PM.audio;
  const a = new Audio();
  a.crossOrigin = 'anonymous';
  a.preload = 'metadata';
  a.addEventListener('ended', () => next());
  a.addEventListener('playing',()=>{PM.failedTracks=0});
  a.addEventListener('error',()=>{PM.failedTracks=(PM.failedTracks||0)+1;if(PM.failedTracks<PM.music.length)setTimeout(()=>next(),400);else hint('Radio unavailable. Check your connection, then press Play.');});
  PM.audio = a;
  return a;
}
function current(){ return PM.music[PM.order[PM.pos]] || null; }
function playAt(pos){
  if (!PM.music.length) return;
  if (!PM.order.length) reshuffle(false);
  PM.pos = ((pos % PM.order.length) + PM.order.length) % PM.order.length;
  const t = current();
  const a = audio();
  a.src = t.url;
  a.volume = targetVolume();
  a.play().then(() => announce(t)).catch(() => {});
  PM.started = true;
  renderPanel();
}
function next(){ PM.prefs.radio=true;savePrefs();playAt(PM.pos + 1); }
function prev(){ PM.prefs.radio=true;savePrefs();playAt(PM.pos - 1); }
function toggle(){
  PM.failedTracks=0;
  if (!PM.music.length){ hint(PM.inShell ? 'No music yet. Press H, then Open music folder.' : 'No music yet. Press H to add some.'); return; }
  const a = audio();
  if (!PM.started || !a.src) { PM.prefs.radio = true; savePrefs(); playAt(PM.pos < 0 ? 0 : PM.pos); return; }
  if (a.paused){ PM.prefs.radio = true; a.play().catch(() => {}); announce(current()); }
  else { PM.prefs.radio = false; a.pause(); hint('Palm Radio paused.'); }
  savePrefs(); renderPanel();
}
PM.play = toggle; PM.next = next; PM.prev = prev;

//  Speech sits on top of the music rather than fighting it.
function targetVolume(){
  let v = PM.prefs.volume;
  const talking = (typeof Narr !== 'undefined' && Narr.active) || (typeof Dialogue !== 'undefined' && Dialogue.active);
  if (talking) v *= 0.35;
  if (State.ui && (State.ui.paused || State.ui.inIntro)) v *= 0.6;
  return Math.max(0, Math.min(1, v));
}

// =============================================================================
//  ART ON BILLBOARDS AND THE SKYLINE
// =============================================================================
function loadImage(url){
  return new Promise((ok, no) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => no(new Error('image failed: ' + url));
    img.src = url;
  });
}

//  Crop to the board's shape and cap the size, so a 4K still costs what a
//  billboard is worth and not what the file is.
function artTexture(url, aspect){
  const key = url + '@' + aspect.toFixed(1);
  if (PM.tex.has(key)) return PM.tex.get(key);
  const p = loadImage(url).then(img => {
    const W = 512, H = Math.max(64, Math.round(W / aspect));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    //  The board's glow takes the picture's average colour.
    const d = g.getImageData(0, 0, W, H).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 97){ r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    const texture = new THREE.CanvasTexture(c);
    if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace; else texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 4;
    return { texture, color: new THREE.Color(r / n / 255, gg / n / 255, b / n / 255) };
  });
  PM.tex.set(key, p);
  if (PM.tex.size > 48){ const first = PM.tex.keys().next().value; PM.tex.get(first).then(t => t.texture.dispose()).catch(() => {}); PM.tex.delete(first); }
  return p;
}

function inScene(o){ while (o){ if (o === State.scene) return true; o = o.parent; } return false; }

//  A rooftop board is a box; +z and -z are its faces. Sides keep their neon.
function dress(ad){
  if (!PM.images.length) return;
  const m = ad.mesh;
  const pick = PM.images[hash(`${m.position.x|0},${m.position.z|0}`) % PM.images.length];
  const aspect = Math.max(0.5, Math.min(4, m.scale.x / Math.max(0.1, m.scale.y)));
  const rec = { ad, original: m.material, url: pick.url, aspect, video: null };
  PM.ads.push(rec);
  const i = State.holoAds.indexOf(ad); if (i >= 0) State.holoAds.splice(i, 1);
  artTexture(pick.url, aspect).then(({ texture, color }) => {
    if (!PM.ads.includes(rec) || rec.video) return;
    rec.face = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const edge = rec.original;
    m.material = [edge, edge, edge, edge, rec.face, rec.face];
    if (ad.light) ad.light.color.copy(color);
    if (edge && edge.color) edge.color.copy(color).multiplyScalar(0.8);
  }).catch(() => {});
}
function undress(rec){
  stopVideo(rec);
  rec.ad.mesh.material = rec.original;
  if (rec.face) rec.face.dispose();
  if (inScene(rec.ad.mesh)) State.holoAds.push(rec.ad);
}

function dressSky(){
  const g = State.holoBillboards;
  if (!g || !PM.images.length || PM.sky.length) return;
  g.children.slice(0, 3).forEach((sp, i) => {
    const pick = PM.images[(hash('sky' + i) + i) % PM.images.length];
    const rec = { sp, map: sp.material.map, blending: sp.material.blending, opacity: sp.material.opacity };
    PM.sky.push(rec);
    artTexture(pick.url, 2).then(({ texture }) => {
      if (!PM.sky.includes(rec)) return;
      sp.material.map = texture; sp.material.blending = THREE.NormalBlending; sp.material.opacity = 0.92;
      sp.material.needsUpdate = true;
    }).catch(() => {});
  });
}
function undressSky(){
  for (const r of PM.sky){ r.sp.material.map = r.map; r.sp.material.blending = r.blending; r.sp.material.opacity = r.opacity; r.sp.material.needsUpdate = true; }
  PM.sky = [];
}

// ─── Video on the nearest boards ────────────────────────────────────────────
const MAX_VIDEOS = 2, VIDEO_RANGE = 70;
function startVideo(rec){
  if (!PM.videos.length || rec.video) return;
  const m = rec.ad.mesh;
  const pick = PM.videos[hash(`v${m.position.x|0},${m.position.z|0}`) % PM.videos.length];
  const v = document.createElement('video');
  v.crossOrigin = 'anonymous'; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
  v.src = pick.url;
  const texture = new THREE.VideoTexture(v);
  if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  rec.video = { v, texture, face, url: pick.url };
  m.material = [rec.original, rec.original, rec.original, rec.original, face, face];
  v.play().catch(() => {});
  PM.playingVideos++;
}
function stopVideo(rec){
  if (!rec.video) return;
  const { v, texture, face } = rec.video;
  v.pause(); v.removeAttribute('src'); v.load();
  texture.dispose(); face.dispose();
  rec.video = null;
  PM.playingVideos = Math.max(0, PM.playingVideos - 1);
  rec.ad.mesh.material = rec.face ? [rec.original, rec.original, rec.original, rec.original, rec.face, rec.face] : rec.original;
}

function tickBoards(){
  //  Boards from a city that is gone.
  for (let i = PM.ads.length - 1; i >= 0; i--){
    const rec = PM.ads[i];
    if (!inScene(rec.ad.mesh)){ stopVideo(rec); PM.ads.splice(i, 1); }
  }
  if (PM.prefs.art && PM.images.length){
    for (const ad of State.holoAds.slice()) if (ad && ad.mesh && !ad._pm){ ad._pm = true; dress(ad); }
    dressSky();
  }
  if (!PM.prefs.video || !PM.videos.length){ for (const r of PM.ads) stopVideo(r); return; }
  const px = Player.position.x, pz = Player.position.z;
  const near = PM.ads.map(r => {
    const p = new THREE.Vector3(); r.ad.mesh.getWorldPosition(p);
    return { r, d: Math.hypot(p.x - px, p.z - pz) };
  }).filter(o => o.d < VIDEO_RANGE).sort((a, b) => a.d - b.d).slice(0, MAX_VIDEOS).map(o => o.r);
  for (const r of PM.ads) if (r.video && !near.includes(r)) stopVideo(r);
  for (const r of near) if (!r.video) startVideo(r);
}

function setArt(on){
  PM.prefs.art = on; savePrefs();
  if (!on){ for (const r of PM.ads.slice()) undress(r); PM.ads = []; for (const ad of State.holoAds) ad._pm = false; undressSky(); }
  renderPanel();
}
function setVideo(on){ PM.prefs.video = on; savePrefs(); if (!on) for (const r of PM.ads) stopVideo(r); renderPanel(); }

// =============================================================================
//  THE STUDIO PANEL (H)
// =============================================================================
(function css(){
  const st = document.createElement('style');
  st.textContent = `
  #pm-now{position:fixed;right:20px;top:272px;z-index:58;pointer-events:none;max-width:280px;
    font:12px/1.5 Georgia,serif;color:#f1ead8;background:rgba(12,10,20,.82);border-left:3px solid #f4bb3d;
    padding:8px 12px;opacity:0;transition:opacity .4s}
  #pm-now.on{opacity:1} #pm-now b{font:10px 'Courier New',monospace;letter-spacing:3px;color:#f4bb3d;display:block}
  #pm-panel{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;
    background:rgba(6,5,10,.88);padding:24px 16px;overflow:auto}
  #pm-panel.on{display:flex}
  #pm-panel .in{width:min(880px,100%);background:#120e1a;border:1px solid #40334f;color:#efe8d8;font-family:Georgia,serif;padding:22px 24px}
  #pm-panel h1{font-weight:400;font-size:26px;margin:0 0 4px}
  #pm-panel .kick{font:11px 'Courier New',monospace;letter-spacing:4px;color:#f4bb3d;margin:0 0 6px}
  #pm-panel .div{color:#f4bb3d;letter-spacing:10px;font-size:12px;margin:8px 0 16px}
  #pm-panel section{border-top:1px solid #2e2540;padding:14px 0}
  #pm-panel h2{font:12px 'Courier New',monospace;letter-spacing:3px;color:#c8bed6;margin:0 0 10px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
  #pm-panel h2 span{color:#8a80a0}
  #pm-panel .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  #pm-panel button,#pm-panel label.btn{background:#1d1628;border:1px solid #40334f;color:#efe8d8;padding:8px 12px;font:13px Georgia,serif;cursor:pointer}
  #pm-panel button:hover,#pm-panel label.btn:hover{border-color:#f4bb3d}
  #pm-panel button.on{border-color:#f4bb3d;color:#f4bb3d}
  #pm-panel input[type=file]{display:none}
  #pm-panel input[type=range]{accent-color:#f4bb3d;width:140px}
  #pm-panel .now{font-size:15px;margin:0 0 10px} #pm-panel .now small{color:#a69cbb;display:block;font-size:12px}
  #pm-panel .tracks{max-height:150px;overflow:auto;margin-top:10px;border:1px solid #2e2540}
  #pm-panel .tracks button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #221b2e;background:none;padding:6px 10px;font-size:13px}
  #pm-panel .tracks button.cur{color:#f4bb3d}
  #pm-panel .thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px;margin-top:10px}
  #pm-panel .thumbs img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#1d1628}
  #pm-panel .note{color:#a69cbb;font-size:12px;line-height:1.6;margin:8px 0 0}
  #pm-panel .close{float:right}`;
  document.head.appendChild(st);
})();

function el(id){ let e = document.getElementById(id); if (!e){ e = document.createElement('div'); e.id = id; document.body.appendChild(e); } return e; }

let hintT = 0;
function announce(t){ if (!t) return; const e = el('pm-now'); e.innerHTML = `<b>♪ PALM RADIO</b>${esc(t.title)}${t.album ? ' · ' + esc(t.album) : ''}`; e.classList.add('on'); clearTimeout(hintT); hintT = setTimeout(() => e.classList.remove('on'), 6000); }
function hint(text){ const e = el('pm-now'); e.innerHTML = `<b>♪ PALM RADIO</b>${esc(text)}`; e.classList.add('on'); clearTimeout(hintT); hintT = setTimeout(() => e.classList.remove('on'), 4500); }

function openPanel(radioOnly=false){
  if(PM.panelOpen)return;
  PM.radioOnly=radioOnly;
  el('pm-panel').classList.toggle('radio-only',radioOnly);
  const p = el('pm-panel');
  p.classList.add('on');
  PM.panelOpen = true;
  PM._wasPaused = State.ui.paused;
  State.ui.paused = true;
  safe(() => document.exitPointerLock());
  document.body.style.cursor = 'auto';
  renderPanel();
  refresh();
}
function closePanel(){
  el('pm-panel').classList.remove('on');
  PM.panelOpen = false;
  State.ui.paused = !!PM._wasPaused;
  document.body.style.cursor = 'none';
}
PM.open = openPanel; PM.openRadio=()=>openPanel(true); PM.close = closePanel;

function folderButton(kind, label){
  return PM.inShell ? `<button data-folder="${kind}">${label}</button>`
    : `<label class="btn">${label}<input type="file" multiple data-add="${kind}" accept="${kind === 'music' ? 'audio/*' : kind === 'images' ? 'image/*' : 'video/*'}"></label>`;
}

function renderPanel(){
  if (!PM.panelOpen) return;
  const t = current();
  const playing = PM.audio && !PM.audio.paused;
  const tracks = PM.music.slice(0, 300).map((m, i) =>
    `<button data-track="${i}" class="${t === m ? 'cur' : ''}">${esc(m.title)}${m.album ? ' <small style="color:#8a80a0">· ' + esc(m.album) + '</small>' : ''}</button>`).join('');
  const thumbs = PM.images.slice(0, 24).map(i => `<img loading="lazy" alt="${esc(i.title)}" title="${esc(i.title)}" src="${esc(i.url)}">`).join('');
  const studio = PM.inShell ? `<button data-app="palm-image-studio">Open Image Studio</button>` : '';
  const vstudio = PM.inShell ? `<button data-app="palm-video-studio">Open Video Studio</button>` : '';
  el('pm-panel').innerHTML = `<div class="in">
    <button class="close" data-act="close">Close · H</button>
    <p class="kick">Present Palm · your media</p><h1>${PM.radioOnly ? 'Palm Radio' : 'Studio'}</h1><p class="div">◆ ◆ ◆</p>
    <section><h2>PALM RADIO <span>${PM.music.length} tracks</span></h2>
      <p class="now">${t ? esc(t.title) : 'Nothing playing'}<small>${t && t.album ? esc(t.album) : PM.music.length ? 'U plays and pauses · Y skips' : 'Add music to start the radio'}</small></p>
      <div class="row"><button data-act="prev">◀︎ Back</button><button data-act="play" class="${playing ? 'on' : ''}">${playing ? 'Pause' : 'Play'}</button><button data-act="next">Next ▶︎</button>
        <button data-act="shuffle" class="${PM.prefs.shuffle ? 'on' : ''}">Shuffle</button>
        <label style="font-size:12px;color:#a69cbb">Volume <input type="range" min="0" max="1" step="0.05" value="${PM.prefs.volume}" data-act="volume"></label>
        ${folderButton('music', PM.inShell ? 'Open music folder' : 'Add music')}</div>
      ${tracks ? `<div class="tracks">${tracks}</div>` : ''}
      <p class="note">${PM.inShell ? 'The bundled soundtrack is ready to play. Use Open music folder to add your own songs. New files appear when you reopen this panel.' : 'Files you add play for this session only. In Present Palm, a music folder keeps them.'}</p></section>
    <section><h2>ART ON THE CITY <span>${PM.images.length} images</span></h2>
      <div class="row"><button data-act="art" class="${PM.prefs.art ? 'on' : ''}">${PM.prefs.art ? 'On billboards' : 'Off'}</button>${folderButton('images', PM.inShell ? 'Open art folder' : 'Add images')}${studio}</div>
      ${thumbs ? `<div class="thumbs">${thumbs}</div>` : ''}
      <p class="note">${PM.inShell ? 'Rooftop billboards and the skyline show images from <b>Fracture City/media/art</b> and everything Palm Image Studio has made.' : 'Rooftop billboards and the skyline show the images you add.'}</p></section>
    <section><h2>CLIPS ON SCREENS <span>${PM.videos.length} clips</span></h2>
      <div class="row"><button data-act="video" class="${PM.prefs.video ? 'on' : ''}">${PM.prefs.video ? 'On nearest billboards' : 'Off'}</button>${folderButton('videos', PM.inShell ? 'Open video folder' : 'Add clips')}${vstudio}</div>
      <p class="note">The two billboards nearest you play clips, silently, on a loop. ${PM.inShell ? 'From <b>Fracture City/media/video</b> and Palm Video Studio.' : ''}</p></section>
  </div>`;
}

el('pm-panel').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'close') return closePanel();
  if (act === 'play') toggle();
  if (act === 'next') next();
  if (act === 'prev') prev();
  if (act === 'shuffle'){ PM.prefs.shuffle = !PM.prefs.shuffle; savePrefs(); reshuffle(true); renderPanel(); }
  if (act === 'art') setArt(!PM.prefs.art);
  if (act === 'video') setVideo(!PM.prefs.video);
  if (b.dataset.track != null){ if (!PM.order.length) reshuffle(false); playAt(Math.max(0, PM.order.indexOf(+b.dataset.track))); }
  if (b.dataset.folder) safe(() => shellMedia.openFolder(b.dataset.folder));
  if (b.dataset.app) safe(() => window.fracture.openApp(b.dataset.app));
});
el('pm-panel').addEventListener('input', e => {
  if (e.target.dataset.act === 'volume'){ PM.prefs.volume = +e.target.value; if (PM.audio) PM.audio.volume = targetVolume(); savePrefs(); }
});
//  The web beta has no folders. Picked files become object URLs for the session.
el('pm-panel').addEventListener('change', e => {
  const kind = e.target.dataset.add; if (!kind) return;
  for (const f of e.target.files){
    PM[kind].push({ kind, name: f.name, title: f.name.replace(/\.[^.]+$/, ''), album: null, source: 'picked', url: URL.createObjectURL(f), mtime: Date.now() });
  }
  if (kind === 'music') reshuffle(true);
  if (kind === 'images'){ for (const ad of State.holoAds) ad._pm = false; }
  renderPanel();
});

// ─── Keys ───────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (PM.panelOpen && (e.code === 'Escape' || e.code === 'KeyH')){ e.preventDefault(); e.stopImmediatePropagation(); closePanel(); return; }
  if (State.ui.inDialogue || State.ui.inShiftPanel || State.ui.inMiniGame || State.ui.inInventory || State.ui.inIntro) return;
  if (e.code === 'KeyH' && !State.ui.paused){ e.preventDefault(); openPanel(); }
  else if (e.code === 'KeyU' && !State.ui.paused) toggle();
  else if (e.code === 'KeyY' && !State.ui.paused){ if (PM.music.length) next(); }
}, true);

//  Browsers only start sound after a gesture. The first click into the city
//  is one, so the radio starts there if it was on last time.
document.addEventListener('pointerdown', () => {
  if (!PM.started && PM.prefs.radio && PM.music.length && !PM.panelOpen) playAt(0);
}, true);

// ─── The loops ──────────────────────────────────────────────────────────────
(function frame(){
  if (PM.audio && !PM.audio.paused){
    const v = targetVolume();
    PM.audio.volume += (v - PM.audio.volume) * 0.08;
  }
  requestAnimationFrame(frame);
})();
setInterval(() => safe(tickBoards), 1000);
setInterval(() => { if (!PM.panelOpen) refresh(); }, 60000);

loadPrefs().then(refresh).then(() => {
  if (PM.inShell && !PM.music.length && !PM.images.length){
    setTimeout(() => hint('Your music and art can live here. Press H.'), 8000);
  }
});
console.log('[city-media] ' + PM.version + (PM.inShell ? ' · shell folders' : ' · session files'));
})();
