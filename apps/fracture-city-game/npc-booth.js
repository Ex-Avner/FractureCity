/* The Casting Booth: a neon kiosk on the Common Ground plaza where residents
   make NPCs and put them in the city.

   Walk up to the counter and press E. Pick a role (what they do), a look
   (the wardrobe, dressing someone else) and a backstory (rolled, then yours
   to rewrite), and spawn them at the booth or where you stand. "Your cast"
   lists everyone you have out: recall, park, move or dismiss them.

   Geometry belongs to the Common Ground chunk, like the campus arcades. */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined' || !window.FCNpcBrain) return;
const B = window.FCNpcBrain, BOOTH = { x: 164, z: 45, w: 7, d: 5, h: 3.7, y: 1 };
const KEY = chunkCoordOf(BOOTH.x) + ',' + chunkCoordOf(BOOTH.z), NAME = 'casting-booth';
const COUNTER = { x: 161.9, z: 47.2 };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const online = () => !!(window.FCCityOnline && FCCityOnline.ready);
const say = (m, k = 'info') => typeof toast === 'function' && toast(m, k);

// ─── Role unlocks ───────────────────────────────────────────────────────────
//  Online they are wallet items (n:<role>) the server checks; solo they are kept
//  with your local save; Creative unlocks every role.
let soloRoles = new Set(); (async () => { try { const d = await window.fracture?.read('fc-npc-roles'); if (Array.isArray(d)) soloRoles = new Set(d); } catch (e){} })();
window.FCNpcUnlocks = {
 owns(sku){ const role = sku.slice(2); if (!B.ROLES[role]?.price) return true; if (!online() && State.ui.freeBuild) return true; return online() ? (window.FCInv?.server?.items?.[sku] || 0) > 0 : soloRoles.has(sku); },
 async buy(role){
  const sku = 'n:' + role, price = B.ROLES[role].price;
  if (online()){
   const res = await fetch('/api/wallet/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku, qty: 1 }) }), out = await res.json();
   if (!res.ok) throw Error(out.error || 'Could not unlock that.'); window.FCInv?.ingestWallet?.(out); return;
  }
  if (State.hud.credits < price) throw Error(`Not enough credits: ${price} needed, ${State.hud.credits} held.`);
  grantCredits(-price); soloRoles.add(sku); try { window.fracture?.save('fc-npc-roles', [...soloRoles]); } catch (e){}
 },
};

// ─── The kiosk ───────────────────────────────────────────────────────────────
function canvasTex(w, h, paint){ const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
const SIGN = canvasTex(1024, 256, (g, w, h) => {
 g.fillStyle = '#0c0a10'; g.fillRect(0, 0, w, h);
 g.shadowColor = '#ff2e88'; g.shadowBlur = 28; g.fillStyle = '#ff6ab0'; g.font = 'bold 120px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('CASTING BOOTH', w / 2, 140);
 g.shadowColor = '#00e5ff'; g.fillStyle = '#7ff4ff'; g.font = 'bold 46px system-ui, sans-serif'; g.fillText('MAKE SOMEBODY · LET THEM LOOSE', w / 2, 214);
});
const MURAL = canvasTex(1024, 512, (g, w, h) => {
 g.fillStyle = '#17121c'; g.fillRect(0, 0, w, h);
 const cols = ['#ff2e88', '#00e5ff', '#ffe500', '#39ff14', '#ff6a00', '#b388ff'];
 for (let i = 0; i < 40; i++){ g.strokeStyle = cols[i % 6]; g.globalAlpha = .55; g.lineWidth = 6 + (i % 5) * 4; g.beginPath(); const x = (i * 97) % w, y = (i * 53) % h; g.moveTo(x, y); g.bezierCurveTo(x + 120, y - 90, x + 200, y + 140, x + 300, y + 20); g.stroke(); }
 g.globalAlpha = 1;
 //  Silhouettes of a crowd of characters, in poses.
 for (let i = 0; i < 9; i++){ const x = 60 + i * 112, y = 470; g.fillStyle = '#0c0a10'; g.beginPath(); g.arc(x, y - 250, 34, 0, 7); g.fill(); g.fillRect(x - 38, y - 214, 76, 140); g.fillRect(x - 34, y - 80, 26, 80); g.fillRect(x + 8, y - 80, 26, 80);
  g.fillStyle = cols[i % 6]; if (i % 3 === 0){ g.beginPath(); g.moveTo(x - 12, y - 284); g.lineTo(x, y - 330); g.lineTo(x + 12, y - 284); g.fill(); } if (i % 3 === 1) g.fillRect(x + 36, y - 300, 10, 120); if (i % 3 === 2){ g.fillRect(x - 70, y - 270, 40, 60); } }
 g.fillStyle = '#f2eee8'; g.font = 'bold 64px Impact, sans-serif'; g.textAlign = 'left'; g.fillText('WHO DO YOU NEED?', 40, 86);
});
//  Flyposters for the outside walls.
const POSTER = canvasTex(512, 512, (g, w, h) => {
 const cols = ['#ff2e88', '#00e5ff', '#ffe500', '#39ff14', '#e9e5dc', '#ff6a00'], words = [['NOW', 'CASTING'], ['BUSKERS', 'WANTED'], ['BRING', 'YOUR', 'CREW'], ['TALK', 'TO', 'STRANGERS'], ['NO', 'EXPERIENCE'], ['WHO', 'ARE', 'YOU?']];
 g.fillStyle = '#1d1824'; g.fillRect(0, 0, w, h);
 for (let i = 0; i < 6; i++){ const x = (i % 3) * 170 + 8, y = Math.floor(i / 3) * 256 + 10; g.save(); g.translate(x + 80, y + 118); g.rotate((i % 2 ? 1 : -1) * .06); g.fillStyle = cols[i]; g.fillRect(-78, -112, 156, 228); g.fillStyle = '#0c0a10'; g.font = 'bold 34px Impact, sans-serif'; g.textAlign = 'center'; words[i].forEach((t, j) => g.fillText(t, 0, -50 + j * 40)); g.fillRect(-60, 80, 120, 6); g.restore(); }
});
const FLOOR = canvasTex(256, 256, (g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++){ g.fillStyle = (x + y) % 2 ? '#e9e5dc' : '#0b0b0f'; g.fillRect(x * 32, y * 32, 32, 32); } });
FLOOR.wrapS = FLOOR.wrapT = THREE.RepeatWrapping; FLOOR.repeat.set(3.5, 2.5);

function build(chunk){
 const root = new THREE.Group(); root.name = NAME; root.position.set(BOOTH.x, BOOTH.y, BOOTH.z); chunk.group.add(root); chunk.castingBooth = root;
 const dark = new THREE.MeshStandardMaterial({ color: 0x2a2333, roughness: .7, metalness: .2 }), chrome = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, roughness: .25, metalness: .9 });
 const pink = new THREE.MeshBasicMaterial({ color: 0xff2e88 }), cyan = new THREE.MeshBasicMaterial({ color: 0x00e5ff }), yellow = new THREE.MeshBasicMaterial({ color: 0xffe500 });
 const box = (w, h, d, x, y, z, m = dark) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); root.add(mesh); return mesh; };
 const W = BOOTH.w / 2, D = BOOTH.d / 2, H = BOOTH.h;
 //  Floor, back wall with a mural and a mirror, side walls, roof with an overhang.
 const floor = new THREE.Mesh(new THREE.BoxGeometry(BOOTH.w, .12, BOOTH.d), new THREE.MeshStandardMaterial({ map: FLOOR, roughness: .45 })); floor.position.set(0, .06, 0); root.add(floor);
 box(BOOTH.w, H, .25, 0, H / 2, -D + .12);
 const mural = new THREE.Mesh(new THREE.PlaneGeometry(BOOTH.w - .6, 2.6), new THREE.MeshBasicMaterial({ map: MURAL })); mural.position.set(0, 1.85, -D + .26); root.add(mural);
 for (const sx of [-1, 1]){
  box(.25, H, BOOTH.d, sx * (W - .12), H / 2, 0);
  //  Neon tubes along the front edges and up the corners.
  box(.05, H - .2, .05, sx * (W - .02), H / 2, D - .02, sx < 0 ? pink : cyan);
  box(.05, .05, BOOTH.d - .3, sx * (W - .27), .3, 0, sx < 0 ? pink : cyan);
  //  Studs on the walls.
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(BOOTH.d - .4, H - .6), new THREE.MeshStandardMaterial({ map: POSTER, roughness: .9 })); poster.position.set(sx * (W + .01), H / 2 - .05, 0); poster.rotation.y = sx * Math.PI / 2; root.add(poster);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++){ const s = new THREE.Mesh(new THREE.ConeGeometry(.05, .12, 4), chrome); s.rotation.z = -sx * Math.PI / 2; s.position.set(sx * (W + .02), .35 + j * 1.45, -D + .5 + i * .8); if (j === 1) continue; root.add(s); }
 }
 box(BOOTH.w + .9, .28, BOOTH.d + 1.2, 0, H + .14, .35);
 box(BOOTH.w + .9, .06, .06, 0, H, D + .93, yellow);
 const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: SIGN, transparent: true })); sign.position.set(0, H + .9, D + .5); root.add(sign);
 box(5.8, 1.55, .12, 0, H + .9, D + .42);
 //  Counter with a terminal on the left.
 const cx = COUNTER.x - BOOTH.x, cz = COUNTER.z - BOOTH.z - .55;
 box(2.4, 1.05, .6, cx, .53, cz); box(2.5, .07, .7, cx, 1.08, cz, chrome); box(2.4, .04, .02, cx, .9, cz + .31, pink);
 box(.6, .42, .05, cx - .3, 1.36, cz - .1); const scr = new THREE.Mesh(new THREE.PlaneGeometry(.52, .34), cyan); scr.position.set(cx - .3, 1.36, cz - .07); root.add(scr);
 //  The pedestal, where the next person you make is shown.
 const ped = new THREE.Mesh(new THREE.CylinderGeometry(.85, .95, .3, 24), chrome); ped.position.set(1.2, .27, -.3); root.add(ped);
 const ring = new THREE.Mesh(new THREE.TorusGeometry(.9, .03, 6, 32), pink); ring.rotation.x = Math.PI / 2; ring.position.set(1.2, .43, -.3); root.add(ring);
 //  Spotlight cones.
 for (const x of [-1.6, 1.2]){ const cone = new THREE.Mesh(new THREE.ConeGeometry(.9, 3, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: .08, depthWrite: false, side: THREE.DoubleSide })); cone.position.set(x, H - 1.5, -.3); root.add(cone); }
 const lamp = new THREE.PointLight(0xff6ab0, 1.4, 9, 2); lamp.position.set(0, H - .4, .4); root.add(lamp); chunk.lights?.push(lamp);
 //  Collision: back wall, side walls, counter, pedestal.
 const add = (x0, x1, z0, z1, top) => chunk.collisionAABBs.push({ minX: BOOTH.x + x0, maxX: BOOTH.x + x1, minZ: BOOTH.z + z0, maxZ: BOOTH.z + z1, maxY: BOOTH.y + top });
 add(-W, W, -D, -D + .25, H); add(-W, -W + .25, -D, D, H); add(W - .25, W, -D, D, H);
 add(cx - 1.25, cx + 1.25, cz - .35, cz + .35, 1.12); add(1.2 - .9, 1.2 + .9, -.3 - .9, -.3 + .9, .45);
}
const generate = Chunk.prototype.generate;
Chunk.prototype.generate = function(){ const r = generate.apply(this, arguments); if (this.landmark === 'makers' && this.key === KEY) try { build(this); } catch (e){ console.warn('[booth]', e); } return r; };

//  The figure on the pedestal (and two regulars by the wall) are real NPC bodies.
let display = null, displaySig = '', regulars = [];
//  Cheap: the chunk keeps a reference (searching its whole group every frame was not).
function boothHere(){ const c = State.chunkMap?.get(KEY); return !!(c && c.castingBooth && c.castingBooth.parent === c.group); }
function updateDisplay(t, dt){
 const here = boothHere() && Math.hypot(Player.position.x - BOOTH.x, Player.position.z - BOOTH.z) < 38;
 if (!here){ if (display){ FCNpcs.dispose(display); display = null; displaySig = ''; } for (const r of regulars) FCNpcs.dispose(r); regulars = []; return; }
 const sig = JSON.stringify([draft.look, draft.role, draft.story.sign]);
 if (sig !== displaySig && window.FCNpcs){ if (display) FCNpcs.dispose(display); display = FCNpcs.body(draft.look, draft.story.name, draft.role, draft.story, 'booth'); display.group.position.set(BOOTH.x + 1.2, BOOTH.y + .42, BOOTH.z - .3); State.scene.add(display.group); displaySig = sig; }
 if (!regulars.length && window.FCNpcs && window.FCWardrobe){
  [['busker', -2.6, -1.6, .6], ['protester', -1.0, -1.7, .2]].forEach(([role, x, z, yaw], i) => { const r = FCNpcs.body(FCWardrobe.crowdLook(null, new RNG('booth-reg' + i)), '', role, B.story(role, 'booth' + i), 'booth-reg' + i); r.group.position.set(BOOTH.x + x, BOOTH.y + .12, BOOTH.z + z); r.char.group.rotation.y = yaw; r.act = role === 'busker' ? 'busk' : 'protest'; State.scene.add(r.group); regulars.push(r); });
 }
 if (display){ display.char.group.rotation.y += dt * .6; shAnimateCharacter(display.char, dt, false, t); FCNpcs.pose(display, actOf(draft.role), t, dt, false); }
 for (const r of regulars){ shAnimateCharacter(r.char, dt, false, t); FCNpcs.pose(r, r.act, t, dt, false); }
}
const actOf = role => ({ busker: 'busk', preacher: 'preach', vendor: 'sell', dancer: 'dance', tagger: 'spray', skater: 'skate', protester: 'protest', storyteller: 'tell', fixer: 'lean', gossip: 'talk', brawler: 'punch', crew: 'punch', carrier: 'cough', bodyguard: 'lean' })[role] || 'idle';

// ─── The draft ───────────────────────────────────────────────────────────────
//  A look from the scenes that suit the role (a busker from punk, goth or skater).
function lookFor(role, seed){ if (!window.FCWardrobe) return {}; let l = FCWardrobe.crowdLook(null, new RNG('booth-look:' + seed), B.ROLES[role].scenes); delete l.scene; if (window.FCWardrobeUI?.affordable) l = FCWardrobeUI.affordable(l); return l; }
let draft = fresh('busker');
function fresh(role){ const seed = Math.random().toString(36).slice(2); return { role, seed, story: B.story(role, seed), look: lookFor(role, seed), to: '', message: '' }; }

// ─── Panel ───────────────────────────────────────────────────────────────────
const UI = { open: false, tab: 'role', preview: null, busy: false, msg: '' };
const el = document.createElement('section'); el.id = 'fc-casting'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Casting Booth'); document.body.append(el);
for (const t of ['pointerdown', 'mousedown', 'wheel', 'keydown', 'keyup']) el.addEventListener(t, e => { if (t !== 'keydown' || e.code !== 'Escape') e.stopPropagation(); });
let wasPaused = false;
function open(){ if (UI.open) return; UI.open = true; wasPaused = State.ui.paused; State.ui.paused = true; State.ui.inShiftPanel = true; document.exitPointerLock?.(); document.body.style.cursor = 'auto'; State.keys?.clear?.(); el.hidden = false; draw(); }
function close(){ if (!UI.open) return; UI.open = false; el.hidden = true; clearPreview(); State.ui.inShiftPanel = false; State.ui.paused = wasPaused; if (!State.ui.paused) document.body.style.cursor = 'none'; }
function hide(){ el.hidden = true; clearPreview(); }
function show(){ el.hidden = false; State.ui.paused = true; State.ui.inShiftPanel = true; draw(); }
window.addEventListener('keydown', e => { if (UI.open && !el.hidden && e.code === 'Escape'){ if (document.getElementById('fc-wardrobe')?.hidden === false) return; e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);

const FIELDS = [['name', 'Name'], ['nick', 'Street name'], ['origin', 'Where they come from'], ['job', 'What they do now'], ['want', 'What they want'], ['wound', 'What happened to them'], ['quirk', 'A habit'], ['secret', 'A secret'], ['catch', 'Catchphrase']];
function owned(role){ return window.FCNpcUnlocks.owns('n:' + role); }
function balance(){ return online() ? (window.FCInv?.server?.balance ?? 0) : State.hud.credits; }
function cast(){ return window.FCNpcs ? FCNpcs.mine() : []; }
function draw(){
 if (!UI.open || el.hidden) return;
 const R = B.ROLES[draft.role], mine = cast(), limit = online() ? B.LIMITS.perPlayer : B.LIMITS.solo;
 let body = '';
 if (UI.tab === 'role') body = B.GROUPS.map(([g, label]) => `<div class="cb-group"><h4>${esc(label)}</h4><div class="cb-roles">${Object.entries(B.ROLES).filter(([, r]) => r.group === g).map(([k, r]) => `<button data-role="${k}" class="${k === draft.role ? 'on' : ''} ${r.price && !owned(k) ? 'locked' : ''}"><b>${esc(r.label)}</b><span>${esc(r.blurb)}</span>${r.price ? (owned(k) ? '<i>unlocked</i>' : `<i>¢ ${r.price} to unlock</i>`) : ''}</button>`).join('')}</div></div>`).join('');
 if (UI.tab === 'look') body = `<div class="cb-look"><p>${esc(draft.story.name)} dresses like this. Rare wardrobe pieces need owning, for NPCs too.</p><div class="cb-row"><button data-look="role">Randomise for a ${esc(R.label.toLowerCase())}</button><button data-look="any">Randomise anything</button><button data-look="mine">Copy my look</button></div><button class="cb-big" data-look="wardrobe">Open the wardrobe for ${esc(draft.story.name.split(' ')[0])}</button></div>`;
 if (UI.tab === 'story') body = `<div class="cb-story">${FIELDS.map(([k, label]) => `<label><span>${esc(label)}</span><div><input data-field="${k}" maxlength="${k === 'name' || k === 'nick' ? 24 : 160}" value="${esc(draft.story[k])}"><button data-reroll="${k}" title="Roll another">🎲</button></div></label>`).join('')}
  <label><span>Temper</span><div><select data-field="temper">${['warm', 'prickly', 'odd'].map(t => `<option ${draft.story.temper === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div></label>
  ${draft.role === 'protester' ? `<label><span>Their sign</span><div><input data-field="sign" maxlength="28" value="${esc(draft.story.sign || '')}"><button data-reroll="sign" title="Roll another">🎲</button></div></label>` : ''}
  <label class="cb-bio"><span>Bio <button data-rebio>Rewrite from the fields</button></span><textarea data-field="bio" maxlength="700" rows="4">${esc(draft.story.bio)}</textarea></label>
  <button class="cb-big" data-reroll="all">Roll a whole new person</button><p class="cb-note">They tell you this in their own words when you talk to them, in three parts across visits. Other residents can read what you write here.</p></div>`;
 if (UI.tab === 'cast') body = mine.length ? `<ul class="cb-cast">${mine.map(v => { const RR = B.ROLES[v.role]; const d = Math.round(Math.hypot((v.x ?? 0) - Player.position.x, (v.z ?? 0) - Player.position.z)); return `<li><div><b>${esc(v.story?.name || '?')}</b><small>${esc(RR.label)} · ${d} m away${v.mode === 'down' ? ' · down' : v.mode === 'stay' ? ' · waiting' : ''}</small></div><div>${RR.group === 'help' ? (v.mode === 'stay' ? `<button data-order="follow" data-id="${v.id}">Follow</button>` : `<button data-order="stay" data-id="${v.id}">Wait</button>`) : ''}<button data-order="here" data-id="${v.id}">Move here</button><button data-dismiss="${v.id}" class="cb-x">Dismiss</button></div></li>`; }).join('')}</ul>` : '<p class="cb-empty">Nobody yet. Make someone.</p>';
 const locked = R.price && !owned(draft.role);
 const courier = draft.role === 'courier' ? `<div class="cb-courier"><label>To <select data-to>${(online() ? (FCCityOnline.room?.players || []).filter(p => p.id !== FCCityOnline.self?.id) : []).map(p => `<option ${p.name === draft.to ? 'selected' : ''}>${esc(p.name)}</option>`).join('') || '<option value="">Nobody else is here</option>'}</select></label><label>Message <input data-message maxlength="120" value="${esc(draft.message)}" placeholder="What should they say?"></label></div>` : '';
 el.innerHTML = `<div class="cb-stage"><canvas aria-label="The person you are making"></canvas><div class="cb-card"><b>${esc(draft.story.name)}</b><small>“${esc(draft.story.nick)}” · ${esc(R.label)}</small><p>${esc(draft.story.bio)}</p></div></div>
 <div class="cb-side"><header><div><small>COMMON GROUND / CASTING BOOTH</small><h2>Who do you need?</h2></div><div class="cb-wallet"><b>¢ ${balance()}</b><small>${mine.length}/${limit} out</small></div></header>
 <nav>${[['role', '1 · Role'], ['look', '2 · Look'], ['story', '3 · Story'], ['cast', 'Your cast (' + mine.length + ')']].map(([k, l]) => `<button data-tab="${k}" class="${UI.tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav>
 <div class="cb-body">${body}</div>
 <footer>${courier}${UI.msg ? `<p class="cb-msg">${esc(UI.msg)}</p>` : ''}<div class="cb-actions"><button data-close>Close · Esc</button>${locked ? `<button data-unlock class="cb-go">Unlock ${esc(R.label)} · ¢ ${R.price}</button>` : `<button data-spawn="booth" class="cb-go2" ${UI.busy ? 'disabled' : ''}>Spawn at the booth</button><button data-spawn="here" class="cb-go" ${UI.busy ? 'disabled' : ''}>Spawn ${B.ROLES[draft.role].crew ? 'the crew' : 'them'} here</button>`}</div></footer></div>`;
 mountPreview();
}
el.addEventListener('click', async e => {
 const b = e.target.closest('button'); if (!b) return;
 if (b.dataset.tab){ UI.tab = b.dataset.tab; UI.msg = ''; draw(); return; }
 if (b.dataset.role){ const role = b.dataset.role; const keep = draft.story; draft.role = role; draft.story = { ...B.story(role, draft.seed), name: keep.name }; draft.story.bio = B.bio(draft.story); draft.look = lookFor(role, draft.seed); UI.msg = ''; draw(); return; }
 if (b.dataset.look === 'role'){ draft.look = lookFor(draft.role, Math.random()); draw(); return; }
 if (b.dataset.look === 'any'){ const l = FCWardrobe.crowdLook(null, new RNG('any' + Math.random())); delete l.scene; draft.look = FCWardrobeUI.affordable ? FCWardrobeUI.affordable(l) : l; draw(); return; }
 if (b.dataset.look === 'mine'){ draft.look = FCWardrobe.normalize(Shift.avatar); draw(); return; }
 if (b.dataset.look === 'wardrobe'){ hide(); FCWardrobeUI.open({ look: draft.look, title: 'Dress ' + draft.story.name.split(' ')[0] + '.', save: 'Dress them', onSave: look => { draft.look = look; show(); }, onCancel: () => show() }); return; }
 if (b.dataset.reroll === 'all'){ const r = draft.role; draft = { ...fresh(r), to: draft.to, message: draft.message }; draw(); return; }
 if (b.dataset.reroll){ draft.story = B.reroll(draft.story, b.dataset.reroll === 'sign' ? 'sign' : b.dataset.reroll, draft.role, Math.random()); if (b.dataset.reroll === 'sign') draft.story.sign = B.story('protester', Math.random()).sign; draw(); return; }
 if (b.dataset.rebio !== undefined){ draft.story.bio = B.bio(draft.story); draw(); return; }
 if (b.dataset.close !== undefined){ close(); return; }
 if (b.dataset.unlock !== undefined){ try { await FCNpcUnlocks.buy(draft.role); UI.msg = B.ROLES[draft.role].label + ' unlocked.'; } catch (err){ UI.msg = err.message; } draw(); return; }
 if (b.dataset.spawn){ spawn(b.dataset.spawn); return; }
 if (b.dataset.order){ try { await FCNpcs.order(b.dataset.id, b.dataset.order); UI.msg = 'Done.'; } catch (err){ UI.msg = err.message; } setTimeout(draw, 300); return; }
 if (b.dataset.dismiss){ try { await FCNpcs.dismiss(b.dataset.dismiss); UI.msg = 'Dismissed.'; } catch (err){ UI.msg = err.message; } setTimeout(draw, 300); return; }
});
el.addEventListener('input', e => {
 const t = e.target;
 if (t.dataset.field){ draft.story[t.dataset.field] = t.value; const card = el.querySelector('.cb-card'); if (card) card.innerHTML = `<b>${esc(draft.story.name)}</b><small>“${esc(draft.story.nick)}” · ${esc(B.ROLES[draft.role].label)}</small><p>${esc(draft.story.bio)}</p>`; }
 if (t.dataset.message !== undefined) draft.message = t.value;
});
el.addEventListener('change', e => { if (e.target.dataset.to !== undefined) draft.to = e.target.value; if (e.target.dataset.field === 'temper') draft.story.temper = e.target.value; });
async function spawn(where){
 if (UI.busy) return; UI.busy = true; UI.msg = '';
 if (draft.role === 'courier' && !draft.to){ const first = el.querySelector('[data-to]')?.value; draft.to = first || ''; }
 const at = where === 'booth' ? { x: B.BOOTH.door.x + (Math.random() - .5) * 2, z: B.BOOTH.door.z + Math.random(), y: BOOTH.y } : { x: Player.position.x, z: Player.position.z, y: Player.position.y - Player.height };
 try {
  await FCNpcs.spawn({ role: draft.role, story: draft.story, look: draft.look, seed: draft.seed, to: draft.to, message: draft.message, ...at });
  const name = draft.story.name.split(' ')[0];
  UI.msg = B.ROLES[draft.role].group === 'trouble' && B.inSafe(at.x, at.z) ? `${name} is out. Trouble walks out of Common Ground before starting any.` : `${name} is out in the city.`;
  say(UI.msg, 'success');
  draft = { ...fresh(draft.role), to: draft.to, message: '' };
 } catch (err){ UI.msg = err.message; }
 UI.busy = false; draw();
}

// ─── Preview: the draft, doing what their role does ─────────────────────────
function clearPreview(){ const p = UI.preview; if (!p) return; cancelAnimationFrame(p.raf); if (p.e) FCNpcs.dispose(p.e); p.renderer.dispose(); p.renderer.forceContextLoss(); UI.preview = null; }
function mountPreview(){
 const canvas = el.querySelector('canvas'); if (!canvas || !window.FCNpcs) return;
 clearPreview();
 const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
 const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xf2f0ff, 0x3a2f45, 1.3)); const key = new THREE.DirectionalLight(0xffe2d0, 2.3); key.position.set(-2.5, 4, 4); scene.add(key); const rim = new THREE.DirectionalLight(0xff2e88, 1.6); rim.position.set(3, 2.5, -3); scene.add(rim);
 const camera = new THREE.PerspectiveCamera(30, 1, .05, 30), e = FCNpcs.body(draft.look, draft.story.name, draft.role, draft.story, 'preview'); scene.add(e.group);
 const p = UI.preview = { canvas, renderer, scene, camera, e, raf: 0, yaw: .4 };
 let drag = null; canvas.onpointerdown = ev => { drag = ev.clientX; canvas.setPointerCapture(ev.pointerId); }; canvas.onpointermove = ev => { if (drag !== null){ p.yaw += (ev.clientX - drag) * .012; drag = ev.clientX; } }; canvas.onpointerup = canvas.onpointercancel = () => drag = null;
 let prev = performance.now();
 const loop = t => { if (UI.preview !== p) return; p.raf = requestAnimationFrame(loop); const dt = Math.min(.05, (t - prev) / 1000); prev = t; const w = canvas.clientWidth || 300, h = canvas.clientHeight || 500; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  const wide = ['vendor', 'busker'].includes(draft.role); camera.position.set(0, 1.2, wide ? 6.4 : 5.2); camera.lookAt(0, 1.0, wide ? .4 : 0);
  e.char.group.rotation.y = p.yaw; shAnimateCharacter(e.char, dt, false, t / 1000); FCNpcs.pose(e, actOf(draft.role), t / 1000, dt, false); renderer.render(scene, camera); };
 p.raf = requestAnimationFrame(loop);
}

// ─── Walking up to the counter ──────────────────────────────────────────────
function near(){ if (UI.open || State.ui.paused || State.ui.inDialogue || !boothHere()) return false; return Math.hypot(Player.position.x - COUNTER.x, Player.position.z - (COUNTER.z + .3)) < 2.4 && Math.abs(Player.position.y - Player.height - BOOTH.y) < 1.5; }
window.addEventListener('keydown', e => { if (e.code === 'KeyE' && !e.repeat && near()){ e.preventDefault(); e.stopImmediatePropagation(); open(); } }, true);
const interact = window.handleInteract; window.handleInteract = function(){ if (near()){ open(); return true; } return interact.apply(this, arguments); };
const prompt = document.createElement('button'); prompt.id = 'casting-prompt'; prompt.hidden = true; prompt.textContent = 'E · Casting Booth'; prompt.onclick = () => open(); document.body.append(prompt);
let last = performance.now(), redraw = 0;
function tick(now){
 requestAnimationFrame(tick);
 const dt = Math.min(.1, (now - last) / 1000); last = now;
 try {
  prompt.hidden = !near();
  if (State.scene && !State.ui.inIntro) updateDisplay(now / 1000, dt);
  if (UI.open && !el.hidden && UI.tab === 'cast' && (redraw += dt) > 2 && !el.contains(document.activeElement)){ redraw = 0; draw(); }
 } catch (e){ if (!tick._w){ tick._w = 1; console.warn('[booth]', e); } }
}
requestAnimationFrame(tick);

const css = document.createElement('style');
css.textContent = `
#casting-prompt{position:fixed;bottom:112px;left:50%;transform:translateX(-50%);z-index:100;background:#1a1220;color:#7ff4ff;border:1px solid #00e5ff;border-radius:10px;padding:14px 20px;font:600 14px system-ui;min-height:48px;cursor:pointer}#casting-prompt[hidden]{display:none}
#fc-casting{position:fixed;inset:3vh max(12px,calc(50vw - 660px));z-index:110001;display:grid;grid-template-columns:minmax(240px,.8fr) 1.2fr;grid-template-rows:minmax(0,1fr);background:#0c0a10fa;color:#f2eee8;border:2px solid #00e5ff;border-radius:6px;box-shadow:8px 8px 0 #ff2e88,0 0 0 100vmax #000a;font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
#fc-casting[hidden]{display:none}
#fc-casting .cb-stage{position:relative;min-width:0;min-height:0;overflow:hidden;border-right:2px solid #00e5ff55;background:radial-gradient(circle at 50% 70%,#2a1830,#0c0a10 70%)}
#fc-casting canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
#fc-casting .cb-card{position:absolute;left:10px;right:10px;bottom:10px;padding:9px 11px;background:#0c0a10d9;border:1px solid #ff2e8866;border-radius:5px}
#fc-casting .cb-card b{display:block;font:700 18px Georgia,serif}#fc-casting .cb-card small{color:#7ff4ff}#fc-casting .cb-card p{margin:5px 0 0;color:#cfc8d8;font-size:12px;max-height:5.6em;overflow:auto}
#fc-casting .cb-side{display:flex;flex-direction:column;min-width:0;min-height:0}
#fc-casting header{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;padding:14px 16px 8px;border-bottom:1px dashed #ffffff22}
#fc-casting header small{color:#ff6ab0;letter-spacing:.14em;font-size:10px}#fc-casting h2{margin:2px 0 0;font:700 30px Impact,Haettenschweiler,sans-serif;letter-spacing:.02em;text-transform:uppercase}
#fc-casting .cb-wallet{text-align:right}#fc-casting .cb-wallet b{display:block;color:#ffe500;font-size:16px}#fc-casting .cb-wallet small{color:#aaa}
#fc-casting nav{display:flex;gap:4px;padding:8px 12px;overflow-x:auto}
#fc-casting button{font:inherit;color:inherit;background:#1d1824;border:1px solid #ffffff2a;border-radius:4px;padding:7px 10px;cursor:pointer;min-height:36px}
#fc-casting button:hover{border-color:#00e5ff}#fc-casting nav button.on{background:#00e5ff;color:#0c0a10;font-weight:700}
#fc-casting .cb-body{flex:1;overflow:auto;padding:4px 14px 12px;min-height:0}
#fc-casting h4{margin:10px 0 6px;color:#ffe500;font-size:11px;letter-spacing:.14em;text-transform:uppercase}
#fc-casting .cb-roles{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px}
#fc-casting .cb-roles button{text-align:left;display:flex;flex-direction:column;gap:3px;padding:8px 9px}
#fc-casting .cb-roles b{font-size:14px}#fc-casting .cb-roles span{font-size:11px;color:#bdb5c8}#fc-casting .cb-roles i{font-style:normal;font-size:11px;color:#ffe500}
#fc-casting .cb-roles button.on{border-color:#ff2e88;background:#2a1430;box-shadow:inset 0 0 0 1px #ff2e88}#fc-casting .cb-roles button.locked{opacity:.75;border-style:dashed}
#fc-casting .cb-row{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}#fc-casting .cb-big{width:100%;margin-top:8px;padding:12px;font-weight:700;border-color:#ff2e88}
#fc-casting .cb-story label{display:block;margin:7px 0}#fc-casting .cb-story label>span{display:flex;justify-content:space-between;align-items:center;color:#7ff4ff;font-size:11px;letter-spacing:.06em;margin-bottom:3px}
#fc-casting .cb-story label>div{display:flex;gap:4px}#fc-casting input,#fc-casting select,#fc-casting textarea{flex:1;min-width:0;font:inherit;color:#f2eee8;background:#15111a;border:1px solid #ffffff2a;border-radius:4px;padding:7px 8px}
#fc-casting textarea{width:100%;box-sizing:border-box;resize:vertical}#fc-casting .cb-note{color:#9a92a6;font-size:11px}
#fc-casting .cb-cast{list-style:none;margin:8px 0;padding:0}#fc-casting .cb-cast li{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px dashed #ffffff1a;flex-wrap:wrap}
#fc-casting .cb-cast b{display:block}#fc-casting .cb-cast small{color:#9a92a6}#fc-casting .cb-cast li>div:last-child{display:flex;gap:4px;flex-wrap:wrap}#fc-casting .cb-x{border-color:#b3122e88}
#fc-casting .cb-empty{color:#9a92a6;padding:30px 0;text-align:center}
#fc-casting footer{padding:10px 14px;border-top:1px dashed #ffffff22}
#fc-casting .cb-courier{display:grid;grid-template-columns:1fr 2fr;gap:6px;margin-bottom:8px}#fc-casting .cb-courier label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:#7ff4ff}
#fc-casting .cb-msg{margin:0 0 8px;color:#ffe500}
#fc-casting .cb-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}
#fc-casting .cb-go{background:#ff2e88;color:#0c0a10;font-weight:800;border-color:#ff2e88}#fc-casting .cb-go2{border-color:#00e5ff;color:#7ff4ff}
#fc-casting button:disabled{opacity:.5;cursor:default}
@media (max-width:760px){#fc-casting{inset:4px;grid-template-columns:minmax(0,1fr);grid-template-rows:30vh minmax(0,1fr);box-shadow:none}#fc-casting .cb-stage{border-right:0;border-bottom:2px solid #00e5ff55}#fc-casting h2{font-size:22px}#fc-casting .cb-card p{display:none}#fc-casting .cb-roles{grid-template-columns:1fr 1fr}#fc-casting .cb-courier{grid-template-columns:1fr}}`;
document.head.append(css);

window.FCCastingBooth = { open, close, get draft(){ return draft; }, set draft(d){ draft = d; }, BOOTH, COUNTER, near, fresh };
})();
