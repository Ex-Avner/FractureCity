/* Social hub: the feed, profiles and people, in one panel (O, or Tools ·
   "Social"). Also the shared look for every social surface: the gallery
   board dock and its compose form, the online panel, the account panel and
   the news reader all take the same punk design tokens from here.

   Feed: newest first, everyone or the people you follow. Posts are text with
   an optional title, photo, song or painted mural; a post can also be pinned
   to a gallery board in Common Ground (two each, as before). Hearts and
   replies on everything.
   Profiles: your wardrobe look rendered as a portrait, name, tagline, bio,
   counts, your posts, and the NPCs you have out in this city. Follow or mute.
   People: search residents; whoever is in this city with you is listed first.

   Server: GET /api/social/feed|profile/<username or id:…>|item/<id>|people,
   POST /api/social/post, post-reply, post-appreciate, post-remove, profile. */
(function(){'use strict';
if (typeof State === 'undefined') return;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const say = (m, k = 'info') => typeof toast === 'function' && toast(m, k);
const me = () => window.FCAccounts?.user || null;
async function api(route, data){
 const res = await fetch('/api/' + route, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(15000) });
 const out = await res.json().catch(() => ({}));
 if (!res.ok) throw Object.assign(Error(out.error || 'The social server did not answer.'), { status: res.status });
 return out;
}
function ago(t){ const s = Math.max(1, (Date.now() - t) / 1000); return s < 60 ? 'now' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : s < 604800 ? Math.floor(s / 86400) + 'd' : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

// ─── Shared design tokens and skins ─────────────────────────────────────────
const tokens = document.createElement('style'); tokens.id = 'fc-ui-tokens';
tokens.textContent = `
:root{--fc-ink:#0c0a10;--fc-panel:#141019;--fc-raise:#1d1824;--fc-line:#ffffff24;--fc-text:#f2eee8;--fc-dim:#a79fb2;--fc-pink:#ff2e88;--fc-cyan:#00e5ff;--fc-yellow:#ffe500;--fc-green:#39ff14;--fc-head:Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif;--fc-body:system-ui,-apple-system,'Segoe UI',sans-serif}
.fc-btn,.social-dock button,.social-compose button,#city-online button,#account-panel button{font:600 13px var(--fc-body)!important;color:var(--fc-text)!important;background:var(--fc-raise)!important;border:1px solid var(--fc-line)!important;border-radius:4px!important;padding:8px 11px!important;min-height:36px;cursor:pointer}
.fc-btn:hover,.social-dock button:hover,.social-compose button:hover,#city-online button:hover,#account-panel button:hover{border-color:var(--fc-cyan)!important}
.fc-btn.hot,.social-compose button[type=submit],#account-panel button.gold{background:var(--fc-pink)!important;color:var(--fc-ink)!important;border-color:var(--fc-pink)!important;font-weight:800!important}
.social-dock{background:var(--fc-panel)!important;border:2px solid var(--fc-pink)!important;border-radius:6px!important;box-shadow:5px 5px 0 var(--fc-cyan);color:var(--fc-text)!important;font:13px/1.4 var(--fc-body)!important;padding:12px 14px!important}
.social-dock b{font:22px/1.1 var(--fc-head);letter-spacing:.02em;text-transform:uppercase}
.social-dock small{color:var(--fc-dim)!important;margin:2px 0 6px}
.social-compose{background:var(--fc-panel)!important;border:2px solid var(--fc-cyan)!important;border-radius:6px!important;box-shadow:6px 6px 0 var(--fc-pink);color:var(--fc-text)!important;font:14px/1.5 var(--fc-body)!important}
.social-compose>b{display:block;font:24px/1.1 var(--fc-head);text-transform:uppercase;margin-bottom:6px}
.social-compose input:not([type=checkbox]),.social-compose textarea,.social-compose select,#city-online input,#account-panel input,#account-panel textarea{background:#0f0c14!important;color:var(--fc-text)!important;border:1px solid var(--fc-line)!important;border-radius:4px!important}
#city-online{background:var(--fc-panel)!important;border:2px solid var(--fc-cyan)!important;border-radius:6px!important;box-shadow:4px 4px 0 var(--fc-pink);color:var(--fc-text)!important;font:13px/1.45 var(--fc-body)!important}
#city-online summary{font:700 12px var(--fc-body);letter-spacing:.08em;text-transform:uppercase;color:var(--fc-cyan)}
#city-online-log p b,#city-online-log .who{color:var(--fc-yellow);cursor:pointer}
#account-panel{background:radial-gradient(ellipse at top,#2a1830,var(--fc-ink) 65%)!important}
#account-panel article{background:var(--fc-panel)!important;border:2px solid var(--fc-pink)!important;border-radius:6px!important;box-shadow:8px 8px 0 var(--fc-cyan);color:var(--fc-text)}
#account-panel h1{font:40px/1 var(--fc-head)!important;text-transform:uppercase}
#account-panel .eyebrow{color:var(--fc-pink);letter-spacing:.14em;font-size:11px}
`;
document.head.append(tokens);

// ─── Portraits: a resident's wardrobe look, rendered once and cached ───────
const portraits = new Map(); let renderer = null, queue = Promise.resolve();
function lookFor(card){ const base = window.FCWardrobe ? { ...FCWardrobe.DEFAULT_LOOK } : {}; if (card?.look) return { ...base, ...card.look }; if (card?.color) base.coat = card.color; return base; }
function portrait(card, full = false){
 const look = lookFor(card), key = JSON.stringify(look) + full;
 if (portraits.has(key)) return portraits.get(key);
 const p = queue = queue.then(() => new Promise(res => setTimeout(() => {
  try {
   if (typeof THREE === 'undefined' || typeof shBuildFigure !== 'function') return res('');
   const W = full ? 360 : 160, H = full ? 480 : 160;
   if (!renderer){ renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; }
   renderer.setSize(W, H, false);
   const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xf2f0ff, 0x3a2f45, 1.4)); const k = new THREE.DirectionalLight(0xffe2d0, 2.8); k.position.set(-2.5, 4, 4); scene.add(k); const fill = new THREE.DirectionalLight(0x9fdcff, 1.2); fill.position.set(3, 1.5, 4); scene.add(fill); const rim = new THREE.DirectionalLight(0xff2e88, 1.5); rim.position.set(3, 2.5, -3); scene.add(rim);
   const c = shBuildFigure({ ...look, prop: 'none', auraChance: 0 }, 'portrait'); c.plate.visible = false; c.group.rotation.y = .35; scene.add(c.group);
   if (typeof shAnimateCharacter === 'function') shAnimateCharacter(c, 0, false, 0);
   const tall = c.studio?.height || 1.8, cam = new THREE.PerspectiveCamera(full ? 28 : 24, W / H, .05, 20);
   if (full){ cam.position.set(0, tall * .56, 4.1); cam.lookAt(0, tall * .52, 0); } else { cam.position.set(0, tall - .08, 1.15); cam.lookAt(0, tall - .14, 0); }
   renderer.render(scene, cam);
   const url = renderer.domElement.toDataURL('image/png');
   if (window.FCResident) FCResident.dispose(c);
   res(url);
  } catch (e){ res(''); }
 }, 0)));
 portraits.set(key, p); return p;
}
function face(card, cls = 'sx-face'){ const id = 'pf' + Math.random().toString(36).slice(2); portrait(card).then(url => { const el = document.getElementById(id); if (el && url) el.style.backgroundImage = `url(${url})`; }); return `<span id="${id}" class="${cls}" style="--c:${esc(card?.color || '#527b93')}"></span>`; }

// ─── Panel ──────────────────────────────────────────────────────────────────
const UI = { open: false, tab: 'feed', scope: 'all', items: [], before: null, more: false, view: null, busy: false, msg: '', people: [], q: '' };
const el = document.createElement('section'); el.id = 'fc-social'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Social'); document.body.append(el);
for (const t of ['pointerdown', 'mousedown', 'wheel', 'keydown', 'keyup']) el.addEventListener(t, e => { if (t !== 'keydown' || e.code !== 'Escape') e.stopPropagation(); });
let wasPaused = false;
function open(tab, arg){
 if (!UI.open){ UI.open = true; wasPaused = State.ui.paused; State.ui.paused = true; State.ui.inShiftPanel = true; document.exitPointerLock?.(); document.body.style.cursor = 'auto'; State.keys?.clear?.(); el.hidden = false; }
 UI.msg = '';
 if (tab === 'profile') return showProfile(arg || (me() ? me().username : null));
 if (tab === 'item') return showItem(arg);
 UI.view = null; UI.tab = tab || UI.tab || 'feed';
 if (UI.tab === 'feed') loadFeed(true); else if (UI.tab === 'people') loadPeople(); else draw();
}
function close(){ if (!UI.open) return; UI.open = false; el.hidden = true; el.innerHTML = ''; State.ui.inShiftPanel = false; State.ui.paused = wasPaused; if (!State.ui.paused) document.body.style.cursor = 'none'; }
window.addEventListener('keydown', e => {
 if (UI.open && e.code === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); if (UI.view) { UI.view = null; draw(); } else close(); return; }
 if (e.code === 'KeyO' && !e.repeat && !UI.open && !State.ui.paused && !State.ui.inDialogue && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.ctrlKey && !e.metaKey){ e.preventDefault(); open('feed'); }
}, true);

async function loadFeed(reset){
 if (!me()){ draw(); return; }
 if (reset){ UI.items = []; UI.before = null; }
 UI.busy = true; draw();
 try { const out = await api('social/feed?scope=' + UI.scope + (UI.before ? '&before=' + UI.before : '')); UI.items = reset ? out.items : UI.items.concat(out.items); UI.before = out.before; UI.more = out.more; }
 catch (e){ UI.msg = e.message; }
 UI.busy = false; draw();
}
async function loadPeople(){ if (!me()){ draw(); return; } UI.busy = true; draw(); try { UI.people = (await api('social/people?q=' + encodeURIComponent(UI.q))).people; } catch (e){ UI.msg = e.message; } UI.busy = false; draw(); }
async function showProfile(ref){
 if (!me()){ UI.view = null; draw(); return; }
 UI.busy = true; UI.view = { kind: 'profile', ref, data: null }; draw();
 try { UI.view.data = await api('social/profile/' + encodeURIComponent(ref)); } catch (e){ UI.view = null; UI.msg = e.message; }
 UI.busy = false; draw();
}
async function showItem(id){
 UI.busy = true; UI.view = { kind: 'item', id, data: null }; draw();
 try { UI.view.data = (await api('social/item/' + encodeURIComponent(id))).item; } catch (e){ UI.view = null; UI.msg = e.message; }
 UI.busy = false; draw();
}

// ─── Rendering ──────────────────────────────────────────────────────────────
function mural(px){ const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); px.forEach((col, i) => { g.fillStyle = col; g.fillRect(i % 16, Math.floor(i / 16), 1, 1); }); return c.toDataURL(); }
function itemCard(it, full){
 const a = it.artist || {}, mine = a.id === me()?.id;
 return `<article class="sx-card ${it.kind === 'board' ? 'board' : ''}" data-item="${esc(it.id)}">
  <header>${face(a)}<div><button class="sx-name" data-profile="${esc(a.username)}">${esc(a.name)}</button><small>@${esc(a.username)} · ${ago(it.at)}${it.kind === 'board' ? ` · <i>ON BOARD ${it.slot + 1} IN COMMON GROUND</i>` : ''}</small></div></header>
  ${it.title ? `<h3>${esc(it.title)}</h3>` : ''}<p>${esc(it.text)}</p>
  ${it.photo ? `<img class="sx-photo" loading="lazy" alt="${esc(it.title || 'Photo')}" src="/api/media/${encodeURIComponent(it.photo)}">` : ''}
  ${it.pixels ? `<img class="sx-mural" alt="Painted mural" src="${mural(it.pixels)}">` : ''}
  ${it.audio ? `<audio controls preload="none" src="/api/media/${encodeURIComponent(it.audio)}"></audio>` : ''}
  <footer><button class="sx-act ${it.appreciated ? 'on' : ''}" data-heart="${esc(it.id)}" data-kind="${it.kind}" aria-label="Appreciate">♥ ${it.appreciations}</button>${full ? '' : `<button class="sx-act" data-open="${esc(it.id)}">↩ ${it.replyCount} ${it.replyCount === 1 ? 'reply' : 'replies'}</button>`}${mine ? `<button class="sx-act sx-x" data-remove="${esc(it.id)}" data-kind="${it.kind}">Remove</button>` : ''}</footer>
  ${full ? `<section class="sx-replies">${(it.replies || []).map(r => `<div class="sx-reply"><button class="sx-name" data-profile="${esc(r.artist.username)}">${esc(r.artist.name)}</button><span>${esc(r.text)}</span>${r.artist.id === me()?.id || mine ? `<button class="sx-act sx-x" data-unreply="${esc(r.id)}">×</button>` : ''}</div>`).join('') || '<p class="sx-dim">No replies yet. Say something.</p>'}
   <form class="sx-replyform"><input name="text" maxlength="${it.kind === 'board' ? 140 : 280}" placeholder="Reply to ${esc(a.name)}" required><button class="fc-btn hot">Reply</button></form></section>` : ''}
 </article>`;
}
function composer(){
 return `<form class="sx-compose"><div class="sx-compose-top">${face(me() ? { ...me(), look: UI.myLook } : null)}<div><input name="title" maxlength="60" placeholder="Title (optional)"><textarea name="text" maxlength="500" rows="3" placeholder="What is happening in the city?" required></textarea></div></div>
  <div class="sx-compose-tools"><label class="fc-btn">📷 Photo<input type="file" name="photo" accept="image/*" hidden></label><label class="fc-btn">♪ Song<input type="file" name="audio" accept=".mp3,.wav,audio/mpeg,audio/wav" hidden></label>${window.CityArt?.getSelection?.().some(o => o.kind === 'mural') ? '<label class="sx-check"><input type="checkbox" name="mural"> Attach the mural I selected</label>' : ''}<label class="sx-check"><input type="checkbox" name="pin"> Also pin it to a gallery board</label><span class="sx-files"></span><button class="fc-btn hot" ${UI.busy ? 'disabled' : ''}>Post</button></div></form>`;
}
function signIn(){ return `<div class="sx-empty"><h3>Sign in to join the conversation.</h3><p>The feed, profiles and replies are shared with real residents on this server.</p><button class="fc-btn hot" data-signin>Sign in or create a resident</button></div>`; }
function profileView(d){
 const p = d.profile, cast = (window.FCNpcs?.list || []).filter(n => n.owner === p.id || (p.mine && n.mine));
 const pid = 'pp' + Math.random().toString(36).slice(2); portrait(p, true).then(url => { const e = document.getElementById(pid); if (e && url) e.style.backgroundImage = `url(${url})`; });
 return `<div class="sx-profile"><div class="sx-portrait" id="${pid}"></div><div class="sx-who">
  <small>@${esc(p.username)} · resident since ${new Date(p.joined).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</small><h2>${esc(p.name)}</h2>${p.tagline ? `<p class="sx-tag">${esc(p.tagline)}</p>` : ''}<p>${esc(p.bio || (p.mine ? 'Write a bio so people know who they are talking to.' : 'No bio yet.'))}</p>
  <ul class="sx-counts"><li><b>${p.counts.posts}</b>posts</li><li><b>${p.counts.followers}</b>followers</li><li><b>${p.counts.following}</b>following</li><li><b>${p.counts.appreciations}</b>hearts</li><li><b>${p.reputation}</b>rep</li></ul>
  <div class="sx-row">${p.mine ? `<button class="fc-btn hot" data-edit>Edit profile</button><button class="fc-btn" data-wardrobe>Change my look</button><button class="fc-btn" data-account>Account settings</button>` : `<button class="fc-btn ${p.following ? '' : 'hot'}" data-follow="${esc(p.id)}" data-on="${p.following ? '' : '1'}">${p.following ? 'Following' : 'Follow'}</button><button class="fc-btn" data-mute="${esc(p.id)}">Mute</button>`}</div>
  ${UI.editing && p.mine ? `<form class="sx-edit"><label>Display name<input name="displayName" maxlength="24" required value="${esc(p.name)}"></label><label>Tagline<input name="tagline" maxlength="80" value="${esc(p.tagline)}" placeholder="One line about you"></label><label>Bio<textarea name="bio" maxlength="280" rows="3">${esc(p.bio)}</textarea></label><label>Colour<input name="color" type="color" value="${esc(p.color || '#527b93')}"></label><div class="sx-row"><button class="fc-btn hot">Save</button><button type="button" class="fc-btn" data-uselook>Use my current look</button><button type="button" class="fc-btn" data-canceledit>Cancel</button></div></form>` : ''}
  ${cast.length ? `<h4>Their cast in this city</h4><div class="sx-cast">${cast.map(n => `<span><b>${esc(n.story?.name || '?')}</b><small>${esc(window.FCNpcBrain?.ROLES[n.role]?.label || n.role)}</small></span>`).join('')}</div>` : ''}
 </div></div><h4 class="sx-section">${p.mine ? 'Your posts' : 'Posts'}</h4>${d.items.length ? d.items.map(i => itemCard(i)).join('') : '<p class="sx-dim">Nothing posted yet.</p>'}`;
}
function peopleView(){
 const here = (window.FCCityOnline?.room?.players || []).filter(p => p.accountId !== me()?.id);
 return `<form class="sx-search"><input name="q" value="${esc(UI.q)}" placeholder="Search residents by name"><button class="fc-btn">Search</button></form>
  ${here.length ? `<h4 class="sx-section">In this city now</h4><div class="sx-people">${here.map(p => `<button class="sx-person" data-profile="id:${esc(p.accountId)}">${face({ color: p.color, look: window.FCCityOnline?.looks?.[p.id] })}<b>${esc(p.name)}</b><small>${p.connected ? 'online' : 'away'}</small></button>`).join('')}</div>` : ''}
  <h4 class="sx-section">${UI.q ? 'Results' : 'Residents'}</h4><div class="sx-people">${UI.people.map(p => `<button class="sx-person" data-profile="${esc(p.username)}">${face(p)}<b>${esc(p.name)}</b><small>@${esc(p.username)}${p.following ? ' · following' : ''}</small>${p.tagline ? `<i>${esc(p.tagline)}</i>` : ''}</button>`).join('') || '<p class="sx-dim">Nobody by that name.</p>'}</div>`;
}
function draw(){
 if (!UI.open) return;
 const user = me();
 let body;
 if (!user) body = signIn();
 else if (UI.view?.kind === 'profile') body = UI.view.data ? profileView(UI.view.data) : '<p class="sx-dim">Opening profile…</p>';
 else if (UI.view?.kind === 'item') body = UI.view.data ? itemCard(UI.view.data, true) : '<p class="sx-dim">Opening…</p>';
 else if (UI.tab === 'people') body = peopleView();
 else body = composer() + `<div class="sx-scope"><button class="${UI.scope === 'all' ? 'on' : ''}" data-scope="all">Everyone</button><button class="${UI.scope === 'following' ? 'on' : ''}" data-scope="following">Following</button></div>` + (UI.items.length ? UI.items.map(i => itemCard(i)).join('') : UI.busy ? '<p class="sx-dim">Loading the feed…</p>' : `<div class="sx-empty"><h3>${UI.scope === 'following' ? 'Nobody you follow has posted.' : 'The feed is quiet.'}</h3><p>${UI.scope === 'following' ? 'Follow people from their profiles, or switch to Everyone.' : 'Be the first. Post something above.'}</p></div>`) + (UI.more ? '<button class="fc-btn sx-more" data-more>Older posts</button>' : '');
 const scroll = el.querySelector('.sx-body')?.scrollTop || 0, keepScroll = !UI.view && UI.tab === 'feed';
 el.innerHTML = `<div class="sx-frame"><header class="sx-head"><div><small>COMMON GROUND / SOCIAL</small><h2>${UI.view?.kind === 'profile' ? 'Profile' : UI.view?.kind === 'item' ? 'Thread' : UI.tab === 'people' ? 'People' : 'The Feed'}</h2></div>
  <nav>${UI.view ? '<button class="fc-btn" data-back>← Back</button>' : ''}<button class="${!UI.view && UI.tab === 'feed' ? 'on' : ''}" data-tab="feed">Feed</button><button class="${!UI.view && UI.tab === 'people' ? 'on' : ''}" data-tab="people">People</button>${user ? `<button class="${UI.view?.kind === 'profile' && UI.view.data?.profile.mine ? 'on' : ''}" data-profile="${esc(user.username)}">You</button>` : ''}<button class="sx-close" data-close aria-label="Close">✕</button></nav></header>
  ${UI.msg ? `<p class="sx-msg">${esc(UI.msg)}</p>` : ''}<div class="sx-body">${body}</div></div>`;
 if (keepScroll) el.querySelector('.sx-body').scrollTop = scroll;
}

// ─── Actions ────────────────────────────────────────────────────────────────
function find(id){ return UI.items.find(i => i.id === id) || (UI.view?.data?.items || []).find(i => i.id === id) || (UI.view?.data?.id === id ? UI.view.data : null); }
function replace(it){ const swap = arr => arr && arr.forEach((x, i) => { if (x.id === it.id) arr[i] = { ...x, ...it, replies: x.replies && !it.replies ? x.replies : it.replies }; }); swap(UI.items); swap(UI.view?.data?.items); if (UI.view?.kind === 'item') UI.view.data = { ...UI.view.data, ...it }; }
async function act(fn){ try { UI.msg = ''; await fn(); } catch (e){ UI.msg = e.message; } draw(); }
el.addEventListener('click', e => {
 const b = e.target.closest('button,label.fc-btn'); if (!b || b.tagName === 'LABEL') return;
 const d = b.dataset;
 if (d.close !== undefined) return close();
 if (d.back !== undefined){ UI.view = null; UI.editing = false; return draw(); }
 if (d.tab){ UI.view = null; UI.editing = false; return open(d.tab); }
 if (d.signin !== undefined){ close(); return window.FCAccounts?.login(); }
 if (d.scope){ UI.scope = d.scope; return loadFeed(true); }
 if (d.more !== undefined) return loadFeed(false);
 if (d.profile){ UI.editing = false; return showProfile(d.profile); }
 if (d.open) return showItem(d.open);
 if (d.heart) return act(async () => { const it = find(d.heart); const on = !it?.appreciated; const out = d.kind === 'board' ? await api('social/appreciate', { work: d.heart, enabled: on }) : await api('social/post-appreciate', { post: d.heart, enabled: on }); if (out.item) replace(out.item); else { const w = out.works?.find(w => w.id === d.heart); if (w) replace({ id: w.id, appreciated: w.appreciated, appreciations: w.appreciations }); } });
 if (d.remove) return act(async () => { if (!confirmRemove(b)) return; if (d.kind === 'board') await api('social/remove', { work: d.remove }); else await api('social/post-remove', { post: d.remove }); UI.items = UI.items.filter(i => i.id !== d.remove); if (UI.view?.data?.items) UI.view.data.items = UI.view.data.items.filter(i => i.id !== d.remove); if (UI.view?.kind === 'item') UI.view = null; window.CitySocial?.refresh?.(); });
 if (d.unreply) return act(async () => { const it = UI.view.data; const out = it.kind === 'board' ? await api('social/remove-reply', { work: it.id, reply: d.unreply }) : await api('social/post-remove-reply', { post: it.id, reply: d.unreply }); if (out.item) UI.view.data = out.item; else await showItem(it.id); });
 if (d.follow) return act(async () => { await api('social/follow', { target: d.follow, enabled: !!d.on }); await showProfile(UI.view.ref); });
 if (d.mute) return act(async () => { if (!confirmRemove(b, 'Mute? Tap again')) return; await api('social/block', { target: d.mute, enabled: true }); UI.view = null; UI.msg = 'Muted. You will not see each other’s posts.'; window.CitySocial?.refresh?.(); await loadFeed(true); });
 if (d.edit !== undefined){ UI.editing = true; return draw(); }
 if (d.canceledit !== undefined){ UI.editing = false; return draw(); }
 if (d.uselook !== undefined) return act(async () => { const out = await api('social/profile', { look: window.FCWardrobe?.current || Shift.avatar }); UI.view.data.profile = out.profile; UI.myLook = out.profile.look; UI.msg = 'Portrait updated from your current look.'; });
 if (d.wardrobe !== undefined){ close(); return window.FCWardrobeUI?.open(); }
 if (d.account !== undefined){ close(); return window.FCAccounts?.profile(); }
});
//  Two-step confirm without a dialog: the first tap arms the button.
function confirmRemove(b, label = 'Sure? Tap again'){ if (b.dataset.armed) return true; b.dataset.armed = '1'; b.textContent = label; setTimeout(() => { if (b.isConnected){ delete b.dataset.armed; } }, 3000); return false; }
el.addEventListener('change', e => { if (e.target.type === 'file'){ const f = el.querySelector('.sx-files'); const names = [...el.querySelectorAll('.sx-compose input[type=file]')].map(i => i.files[0]?.name).filter(Boolean); if (f) f.textContent = names.join(' · '); } });
el.addEventListener('submit', e => {
 e.preventDefault(); const f = e.target, v = Object.fromEntries(new FormData(f));
 if (f.classList.contains('sx-search')){ UI.q = v.q || ''; return loadPeople(); }
 if (f.classList.contains('sx-replyform')) return act(async () => { const it = UI.view.data; const out = it.kind === 'board' ? await api('social/reply', { work: it.id, text: v.text }) : await api('social/post-reply', { post: it.id, text: v.text }); if (out.item) UI.view.data = out.item; else await showItem(it.id); });
 if (f.classList.contains('sx-edit')) return act(async () => { const acc = await api('account/profile', { displayName: v.displayName, bio: v.bio, color: v.color }); const out = await api('social/profile', { tagline: v.tagline }); UI.view.data.profile = { ...out.profile, name: acc.account.displayName, bio: acc.account.bio, color: acc.account.color }; UI.editing = false; UI.msg = 'Profile saved.'; });
 if (f.classList.contains('sx-compose')) return post(f, v);
});
async function post(f, v){
 if (UI.busy) return; UI.busy = true; UI.msg = 'Posting…'; draw();
 try {
  const photoFile = f.querySelector('input[name=photo]')?.files[0], audioFile = f.querySelector('input[name=audio]')?.files[0];
  const photo = photoFile ? await FCMediaUpload.upload(photoFile, 'photo') : null, audio = audioFile ? await FCMediaUpload.upload(audioFile, 'audio') : null;
  const pixels = v.mural ? [...(window.CityArt?.getSelection?.().find(o => o.kind === 'mural')?.pixels || [])] : null;
  const body = { title: v.title || '', text: v.text, photo, audio, pixels: pixels && pixels.length === 256 ? pixels : null };
  if (v.pin){
   //  A board needs a title; take the first free one of the eight.
   const snap = await api('social'), used = new Set(snap.works.map(w => w.slot)), slot = [0, 1, 2, 3, 4, 5, 6, 7].find(s => !used.has(s));
   if (slot === undefined) throw Error('All eight gallery boards are taken. Post without pinning, or remove one of yours from a board.');
   await api('social/publish', { ...body, slot, title: body.title || String(v.text).slice(0, 40) });
   window.CitySocial?.refresh?.(); UI.msg = 'Posted and pinned to board ' + (slot + 1) + ' in Common Ground.';
  } else { await api('social/post', body); UI.msg = 'Posted.'; }
  UI.busy = false; await loadFeed(true); UI.msg = UI.msg === 'Posting…' ? 'Posted.' : UI.msg; draw();
 } catch (e){ UI.busy = false; UI.msg = e.message; draw(); }
}
//  Keep my portrait in step with the wardrobe.
//  When you change your look in the wardrobe, your profile portrait follows
//  (only changes made on this device after it loaded, so another device's look is not overwritten).
let lookSig = null;
setInterval(() => {
 if (!me() || !window.FCWardrobe?.current) return;
 UI.myLook = FCWardrobe.current; const sig = JSON.stringify(FCWardrobe.current);
 if (lookSig === null){ lookSig = sig; return; }
 if (sig !== lookSig){ lookSig = sig; api('social/profile', { look: FCWardrobe.current }).catch(() => {}); }
}, 3000);

// ─── Hooks into the other social surfaces ──────────────────────────────────
//  Board dock: open the artist's profile or the thread from a work.
const dockObserver = new MutationObserver(() => {
 const dock = document.querySelector('.social-dock'); if (!dock || dock.hidden || dock.querySelector('[data-hub]')) return;
 const S = window.CitySocial, work = S && S.nearest >= 0 ? S.effective().find(w => w.slot === S.nearest) : null;
 if (!work || work.local || !work.artist?.username) return;
 const row = document.createElement('div'); row.innerHTML = `<button data-hub="profile">${esc(work.artist.name)}’s profile</button><button data-hub="item">Open the thread</button>`;
 row.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); if (b.dataset.hub === 'profile') open('profile', work.artist.username); else open('item', work.id); });
 dock.append(row);
});
const watchDock = () => { const d = document.querySelector('.social-dock'); if (d) dockObserver.observe(d, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] }); else setTimeout(watchDock, 1000); }; watchDock();
//  Online panel: Profile opens your social profile; names in chat open theirs.
function hookOnline(){
 const btn = document.getElementById('city-online-profile');
 if (!btn){ setTimeout(hookOnline, 1500); return; }
 btn.onclick = () => open('profile');
 const log = document.getElementById('city-online-log');
 log?.addEventListener('click', e => { const row = e.target.closest('p'); if (!row) return; const name = row.textContent.split(':')[0]; const p = window.FCCityOnline?.room?.players.find(q => q.name === name); if (p) open('profile', 'id:' + p.accountId); });
 const add = document.createElement('button'); add.id = 'city-online-social'; add.textContent = 'Feed · O'; add.onclick = () => open('feed'); btn.after(' ', add);
}
hookOnline();

// ─── Styles ─────────────────────────────────────────────────────────────────
const css = document.createElement('style');
css.textContent = `
#fc-social{position:fixed;inset:3vh max(12px,calc(50vw - 430px));z-index:110001;display:flex;color:var(--fc-text);font:14px/1.45 var(--fc-body)}
#fc-social[hidden]{display:none}
#fc-social:before{content:'';position:fixed;inset:0;background:#000b;z-index:-1}
#fc-social .sx-frame{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--fc-ink);border:2px solid var(--fc-pink);border-radius:6px;box-shadow:8px 8px 0 var(--fc-cyan);overflow:hidden}
#fc-social .sx-head{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;padding:14px 16px 10px;border-bottom:1px dashed var(--fc-line);flex-wrap:wrap}
#fc-social .sx-head small{color:var(--fc-pink);letter-spacing:.14em;font-size:10px}
#fc-social h2{margin:2px 0 0;font:34px/1 var(--fc-head);text-transform:uppercase;letter-spacing:.02em}
#fc-social nav{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#fc-social nav>button.sx-close{margin-left:6px;width:38px;padding:0!important}
#fc-social nav>button{font:600 13px var(--fc-body);color:var(--fc-text);background:var(--fc-raise);border:1px solid var(--fc-line);border-radius:4px;padding:8px 12px;min-height:36px;cursor:pointer}
#fc-social nav>button.on{background:var(--fc-cyan);color:var(--fc-ink);border-color:var(--fc-cyan)}
#fc-social .sx-body{flex:1;overflow:auto;padding:12px 16px 24px;min-height:0}
#fc-social .sx-msg{margin:0;padding:8px 16px;background:#ffe50014;color:var(--fc-yellow);border-bottom:1px solid #ffe50033}
#fc-social .sx-dim{color:var(--fc-dim)}
#fc-social h4.sx-section,#fc-social h4{margin:16px 0 8px;color:var(--fc-yellow);font-size:11px;letter-spacing:.14em;text-transform:uppercase}
#fc-social .sx-face{flex:none;display:inline-block;width:44px;height:44px;border-radius:50%;background:var(--c) center/cover no-repeat;border:2px solid var(--fc-ink);box-shadow:0 0 0 2px var(--c)}
#fc-social .sx-compose{background:var(--fc-panel);border:1px solid var(--fc-line);border-radius:6px;padding:12px;margin-bottom:10px}
#fc-social .sx-compose-top{display:flex;gap:10px}#fc-social .sx-compose-top>div{flex:1;min-width:0}
#fc-social input:not([type=checkbox]):not([type=color]),#fc-social textarea{box-sizing:border-box;width:100%;font:inherit;color:var(--fc-text);background:#0f0c14;border:1px solid var(--fc-line);border-radius:4px;padding:8px;margin:0 0 6px}
#fc-social textarea{resize:vertical}
#fc-social .sx-compose-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#fc-social .sx-compose-tools .hot{margin-left:auto}
#fc-social .sx-check{font-size:12px;color:var(--fc-dim);display:flex;gap:5px;align-items:center}
#fc-social .sx-files{font-size:12px;color:var(--fc-cyan)}
#fc-social .sx-scope{display:flex;gap:4px;margin:6px 0 10px}
#fc-social .sx-scope button{font:600 12px var(--fc-body);color:var(--fc-dim);background:none;border:0;border-bottom:2px solid transparent;padding:6px 8px;cursor:pointer}
#fc-social .sx-scope button.on{color:var(--fc-text);border-color:var(--fc-pink)}
#fc-social .sx-card{background:var(--fc-panel);border:1px solid var(--fc-line);border-left:4px solid var(--fc-cyan);border-radius:6px;padding:12px 14px;margin:0 0 10px}
#fc-social .sx-card.board{border-left-color:var(--fc-yellow)}
#fc-social .sx-card header{display:flex;gap:10px;align-items:center}
#fc-social .sx-card header small{display:block;color:var(--fc-dim);font-size:12px}#fc-social .sx-card header i{font-style:normal;color:var(--fc-yellow)}
#fc-social .sx-name{background:none;border:0;padding:0;color:var(--fc-text);font:700 14px var(--fc-body);cursor:pointer}
#fc-social .sx-name:hover{color:var(--fc-cyan);text-decoration:underline}
#fc-social .sx-card h3{margin:10px 0 2px;font:22px/1.1 var(--fc-head);text-transform:uppercase}
#fc-social .sx-card p{margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere}
#fc-social .sx-photo{display:block;max-width:100%;max-height:420px;border-radius:4px;margin:8px 0}
#fc-social .sx-mural{display:block;width:160px;height:160px;image-rendering:pixelated;border:1px solid var(--fc-line);margin:8px 0}
#fc-social audio{width:100%;margin:6px 0}
#fc-social .sx-card footer{display:flex;gap:6px;margin-top:8px}
#fc-social .sx-act{font:600 12px var(--fc-body);color:var(--fc-dim);background:none;border:1px solid var(--fc-line);border-radius:20px;padding:5px 11px;cursor:pointer;min-height:32px}
#fc-social .sx-act.on{color:var(--fc-pink);border-color:var(--fc-pink)}
#fc-social .sx-x{margin-left:auto}#fc-social .sx-reply .sx-x{margin-left:0;padding:1px 8px;min-height:0}
#fc-social .sx-replies{margin-top:12px;border-top:1px dashed var(--fc-line);padding-top:8px}
#fc-social .sx-reply{display:flex;gap:8px;align-items:baseline;padding:6px 0;border-bottom:1px solid #ffffff0d}
#fc-social .sx-reply span{flex:1;overflow-wrap:anywhere}
#fc-social .sx-replyform{display:flex;gap:6px;margin-top:10px}#fc-social .sx-replyform input{margin:0}
#fc-social .sx-more{display:block;margin:10px auto}
#fc-social .sx-empty{text-align:center;padding:30px 10px;color:var(--fc-dim)}#fc-social .sx-empty h3{color:var(--fc-text);font:26px var(--fc-head);text-transform:uppercase}
#fc-social .sx-profile{display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:start}
#fc-social .sx-portrait{aspect-ratio:3/4;border-radius:6px;background:radial-gradient(circle at 50% 75%,#2a1830,var(--fc-panel)) center/cover no-repeat;border:2px solid var(--fc-cyan);box-shadow:4px 4px 0 var(--fc-pink)}
#fc-social .sx-who h2{font-size:40px}#fc-social .sx-who small{color:var(--fc-dim)}
#fc-social .sx-tag{color:var(--fc-cyan);font-weight:600}
#fc-social .sx-counts{display:flex;flex-wrap:wrap;gap:14px;list-style:none;padding:0;margin:10px 0}
#fc-social .sx-counts li{font-size:11px;color:var(--fc-dim);text-transform:uppercase;letter-spacing:.08em}#fc-social .sx-counts b{display:block;font:24px var(--fc-head);color:var(--fc-text)}
#fc-social .sx-row{display:flex;gap:6px;flex-wrap:wrap}
#fc-social .sx-edit{margin-top:12px;background:var(--fc-panel);border:1px solid var(--fc-line);border-radius:6px;padding:12px}
#fc-social .sx-edit label{display:block;font-size:11px;color:var(--fc-cyan);letter-spacing:.06em;margin-bottom:4px}
#fc-social .sx-cast{display:flex;flex-wrap:wrap;gap:6px}#fc-social .sx-cast span{background:var(--fc-panel);border:1px solid var(--fc-line);border-radius:4px;padding:5px 9px}#fc-social .sx-cast small{display:block;color:var(--fc-dim);font-size:11px}
#fc-social .sx-search{display:flex;gap:6px}#fc-social .sx-search input{margin:0}
#fc-social .sx-people{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
#fc-social .sx-person{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;background:var(--fc-panel);border:1px solid var(--fc-line);border-radius:6px;padding:12px 8px;color:var(--fc-text);font:inherit;cursor:pointer}
#fc-social .sx-person:hover{border-color:var(--fc-cyan)}#fc-social .sx-person .sx-face{width:64px;height:64px}#fc-social .sx-person small{color:var(--fc-dim)}#fc-social .sx-person i{font-size:12px;color:var(--fc-cyan);font-style:normal}
@media (max-width:640px){#fc-social{inset:4px}#fc-social .sx-frame{box-shadow:none}#fc-social h2{font-size:26px}#fc-social .sx-profile{grid-template-columns:1fr}#fc-social .sx-portrait{max-width:220px;margin:auto;width:100%}#fc-social .sx-people{grid-template-columns:1fr 1fr}#fc-social nav>button{padding:8px 9px}}`;
document.head.append(css);

window.FCSocialHub = { open, close, get state(){ return UI; }, portrait };
})();
