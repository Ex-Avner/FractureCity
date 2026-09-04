// =============================================================================
//  Fracture City — Shell Renderer
//  Boots the launcher UI: registry list, view switching, search.
// =============================================================================

const state = {
  apps: [],
  filter: '',
  view: 'apps',
};

function $(id){ return document.getElementById(id); }

// ── Brand mark — concentric fracture ring (distinct from app icon) ──────────
function paintBrandMark() {
  // A six-spoke radial mark — same color palette as the test app, but the form
  // is a "compass" not an octahedron. This is the OS, not an app inside it.
  const cx=21, cy=21, ro=18, ri=6;
  let svg = `<svg viewBox="0 0 42 42" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<defs>
    <radialGradient id="bm" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(160,64,255,.45)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="20" fill="url(#bm)"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${ro}" fill="none" stroke="rgba(180,140,255,.55)" stroke-width="1"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${ri}" fill="none" stroke="rgba(180,140,255,.6)" stroke-width="1"/>`;
  // 6 spokes — 3 colored (axes), 3 faded
  const colors = ['rgba(255,212,122,.95)','rgba(180,140,255,.4)','rgba(128,255,255,.95)',
                  'rgba(180,140,255,.4)','rgba(255,96,208,.95)','rgba(180,140,255,.4)'];
  for(let i=0;i<6;i++){
    const a = (i*60 - 90) * Math.PI/180;
    const x1 = cx + Math.cos(a)*ri;
    const y1 = cy + Math.sin(a)*ri;
    const x2 = cx + Math.cos(a)*ro;
    const y2 = cy + Math.sin(a)*ro;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[i]}" stroke-width="1.5" stroke-linecap="round"/>`;
  }
  // Center dot
  svg += `<circle cx="${cx}" cy="${cy}" r="2" fill="#fff"/>`;
  svg += `</svg>`;
  $('brand-mark').innerHTML = svg;
}

// ── Card icon — falls back to a glyph drawn from the app slug ───────────────
function defaultIconGlyph(slug, name) {
  const letters = (name || slug).split(/[\s-_]+/)
    .filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join('') || '?';
  return `<div class="placeholder-icon">${letters}</div>`;
}

function renderApps() {
  const grid = $('app-grid');
  const empty = $('empty-state');
  const filter = state.filter.trim().toLowerCase();
  const filtered = state.apps.filter(app => {
    if (!filter) return true;
    const hay = [app.name, app.slug, app.description, ...(app.tags||[])].join(' ').toLowerCase();
    return hay.includes(filter);
  });

  $('app-count').textContent = `${state.apps.length} INSTALLED${filter ? ' · ' + filtered.length + ' MATCH' : ''}`;
  $('ideas-app-count').textContent = state.apps.length;

  if (state.apps.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hide');
    return;
  }
  empty.classList.add('hide');

  grid.innerHTML = filtered.map(app => {
    const icon = app.icon
      ? `<img src="file://${app.icon}" alt="">`
      : defaultIconGlyph(app.slug, app.name);
    const tags = (app.tags||[]).slice(0,4).map(t => `<span class="card-tag">${t}</span>`).join('');
    return `<div class="card" data-slug="${app.slug}">
      <div class="card-runtime">${app.runtime.toUpperCase()}</div>
      <div class="card-icon">${icon}</div>
      <div class="card-name">${app.name}</div>
      <div class="card-version">v${app.version}</div>
      <div class="card-desc">${app.description || ''}</div>
      <div class="card-tags">${tags}</div>
    </div>`;
  }).join('');

  for (const card of grid.querySelectorAll('.card')) {
    card.addEventListener('click', () => {
      const slug = card.dataset.slug;
      setStatus(`Opening ${slug}…`);
      shellAPI.openApp(slug).then(res => {
        if (res && res.ok) setStatus(`${slug} launched.`);
        else setStatus(`Failed to open ${slug}: ${res && res.error || 'unknown error'}`);
      });
    });
  }
}


// ── YOU — the person.v1 record the shell owns ───────────────────────────────
//  Every other screen here reads app data. This one edits the single record
//  that is not an app's: data/_shell/person.json. Apps can read it and write
//  their own fields into it, but this is where a human changes it on purpose.
const YOU_COLOURS = [
  ['skin',   'Skin',   '#c98f6b'],
  ['coat',   'Coat',   '#ff5268'],
  ['hair',   'Hair',   '#2a1d19'],
  ['accent', 'Signal', '#f4bb3d'],
  ['pants',  'Trousers','#17202a'],
];

let youRecord = null;

async function loadYou(){
  try { youRecord = await shellAPI.me(); }
  catch (e){ youRecord = null; }
  if (!youRecord){
    $('you-name').textContent = 'No person record';
    $('you-meta').textContent = 'the shell did not answer';
    return;
  }
  const p = youRecord;
  $('you-username').value = p.username || '';
  $('you-display').value  = p.displayName || '';
  $('you-bio').value      = p.bio || '';
  renderYouHead();
  renderYouSwatches();
  renderYouHolds();
}

function renderYouHead(){
  const p = youRecord; if (!p) return;
  $('you-name').textContent   = p.displayName || p.username || 'unnamed';
  $('you-handle').textContent = '@' + (p.username || 'unresolved');
  const made = p.created ? new Date(p.created).toLocaleDateString(undefined,
    { year:'numeric', month:'short', day:'numeric' }) : '—';
  $('you-meta').textContent = `${p.id} · since ${made}`;

  // A small blocky figure from the same colours the games draw you with.
  const a = p.avatar || {};
  const c = k => a[k] || (YOU_COLOURS.find(x => x[0] === k) || [,,'#333'])[2];
  // Sized to sit inside the 62px plate with room top and bottom — at the
  // original proportions the legs ran off the bottom edge.
  $('you-face').innerHTML =
    `<i style="left:21px;top:8px;width:20px;height:8px;background:${c('hair')}"></i>` +
    `<i style="left:22px;top:14px;width:18px;height:13px;background:${c('skin')}"></i>` +
    `<i style="left:16px;top:28px;width:30px;height:17px;background:${c('coat')}"></i>` +
    `<i style="left:28px;top:33px;width:6px;height:3px;background:${c('accent')}"></i>` +
    `<i style="left:21px;top:45px;width:8px;height:10px;background:${c('pants')}"></i>` +
    `<i style="left:33px;top:45px;width:8px;height:10px;background:${c('pants')}"></i>`;
}

function renderYouSwatches(){
  const a = (youRecord && youRecord.avatar) || {};
  $('you-swatches').innerHTML = YOU_COLOURS.map(([key, label, dflt]) =>
    `<div class="you-sw"><label for="you-c-${key}">${label}</label>` +
    `<input type="color" id="you-c-${key}" data-ckey="${key}" value="${a[key] || dflt}"></div>`
  ).join('');
  for (const inp of $('you-swatches').querySelectorAll('input')){
    inp.addEventListener('input', () => {
      if (!youRecord) return;
      youRecord.avatar = { ...(youRecord.avatar || {}), [inp.dataset.ckey]: inp.value };
      renderYouHead();
    });
  }
}

//  Resolve each held reference live rather than trusting what was recorded.
//  A reference whose target is gone says so instead of showing a blank row.
async function renderYouHolds(){
  const holds = (youRecord && youRecord.holds) || {};
  const types = Object.keys(holds);
  const el = $('you-holds');
  if (!types.length){
    el.innerHTML = '<p class="you-empty">Nothing yet. Apps record what belongs to ' +
      'you as you make it — a character in the Forge, an essay, the residue you ' +
      'leave in Fracture City.</p>';
    return;
  }
  const rows = [];
  for (const type of types){
    const cur = holds[type];
    const refs = Array.isArray(cur) ? cur : [cur];
    for (const ref of refs){
      let value = null;
      try { value = await shellAPI.resolveRef(ref); } catch (e){}
      rows.push({ type, ref, value });
    }
  }
  el.innerHTML = rows.map(r => {
    const gone = !r.value;
    const label = gone ? 'missing at the source' : youHoldLabel(r.value, r.ref);
    return `<div class="you-hold${gone ? ' gone' : ''}">
      <span class="ht">${escapeHtml(r.type)}</span>
      <span class="hv">${escapeHtml(label)}</span>
      <span class="hr">${escapeHtml(r.ref)}</span>
    </div>`;
  }).join('');
}

//  Records here have no single shape — a character's name is an object, an
//  essay has a title, residue is an array. Pick whatever reads as a name.
function youHoldLabel(v, ref){
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`;
  if (v && typeof v === 'object'){
    if (typeof v.title === 'string' && v.title) return v.title;
    if (typeof v.name === 'string' && v.name) return v.name;
    if (v.name && typeof v.name === 'object' && v.name.full) return v.name.full;
    if (typeof v.displayName === 'string' && v.displayName) return v.displayName;
    if (typeof v.zone === 'string' && v.zone) return 'zone ' + v.zone;
  }
  return ref.split('/').pop();
}

function escapeHtml(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

async function saveYou(){
  const s = $('you-status');
  if (!youRecord){ if (s) s.textContent = 'no record to save'; return; }
  const patch = {
    username:    $('you-username').value,
    displayName: $('you-display').value.trim(),
    bio:         $('you-bio').value.trim(),
    avatar:      youRecord.avatar || null,
  };
  try {
    youRecord = await shellAPI.updateMe(patch);
    // The username is sanitised on the way in, so show what was actually kept
    // rather than what was typed.
    $('you-username').value = youRecord.username || '';
    renderYouHead();
    if (s){ s.textContent = '\u2713 saved · every app reads this'; s.style.color = '#80ffd0'; }
  } catch (e){
    if (s){ s.textContent = 'could not save: ' + e.message; s.style.color = '#ff7088'; }
  }
  setTimeout(() => { if (s) s.textContent = ''; }, 4000);
}

// ── View switching ──────────────────────────────────────────────────────────
function setView(view) {
  state.view = view;
  for (const v of ['apps','you','graph','ideas','settings','about']) {
    $('view-' + v).classList.toggle('hide', v !== view);
  }
  for (const btn of document.querySelectorAll('.nav-btn')) {
    btn.classList.toggle('active', btn.dataset.view === view);
  }
  if (view === 'graph')    renderGraph();
  if (view === 'you')      loadYou();
  if (view === 'settings') loadProvidersIntoSettings();
}

// ── Settings — central provider config ──────────────────────────────────────
async function loadProvidersIntoSettings() {
  let p = null;
  try { p = await shellAPI.readProviders(); } catch(e) {}
  if (!p) p = {
    preferred:'pollinations',
    aihorde:{key:'',model:'stable_diffusion'},
    pollinations:{token:'',model:'turbo'},
    huggingface:{token:'',model:'black-forest-labs/FLUX.1-schnell'},
    openai:{key:'',model:'gpt-image-1'},
  };
  $('set-preferred').value      = p.preferred || 'pollinations';
  $('set-aihorde-key').value    = (p.aihorde && p.aihorde.key)      || '';
  $('set-aihorde-model').value  = (p.aihorde && p.aihorde.model)    || 'stable_diffusion';
  $('set-poll-token').value     = (p.pollinations && p.pollinations.token) || '';
  $('set-poll-model').value     = (p.pollinations && p.pollinations.model) || 'turbo';
  $('set-hf-token').value       = (p.huggingface && p.huggingface.token) || '';
  $('set-hf-model').value       = (p.huggingface && p.huggingface.model) || 'black-forest-labs/FLUX.1-schnell';
  $('set-openai-key').value     = (p.openai && p.openai.key)      || '';
  $('set-openai-model').value   = (p.openai && p.openai.model)    || 'gpt-image-1';
}
async function saveProvidersFromSettings() {
  const p = {
    preferred: $('set-preferred').value,
    aihorde:      { key:   $('set-aihorde-key').value.trim(),  model: $('set-aihorde-model').value },
    pollinations: { token: $('set-poll-token').value.trim(),   model: $('set-poll-model').value },
    huggingface:  { token: $('set-hf-token').value.trim(),     model: $('set-hf-model').value.trim() },
    openai:       { key:   $('set-openai-key').value.trim(),   model: $('set-openai-model').value.trim() },
  };
  const s = $('set-status');
  try {
    await shellAPI.writeProviders(p);
    if (s){ s.textContent = '✓ saved · all apps will read this on next launch'; s.style.color = '#80ffd0'; }
  } catch(e){
    if (s){ s.textContent = '✗ save failed: ' + e.message; s.style.color = '#ff8080'; }
  }
  setTimeout(()=>{ if (s) s.textContent=''; }, 4000);
}

// ── Data Graph ──────────────────────────────────────────────────────────────
// Renders apps as nodes; draws curves between apps whose output type matches
// another app's input type. Color codes by role:
//   gold     = pure producer (outputs only)
//   magenta  = both (in + out)
//   teal     = pure consumer (inputs only)
//   grey     = standalone (neither)
function classifyApp(app) {
  const ins  = (app.inputs  || []).length;
  const outs = (app.outputs || []).length;
  if (ins === 0 && outs === 0) return 'island';
  if (ins  > 0 && outs > 0)    return 'both';
  if (outs > 0)                return 'producer';
  return 'consumer';
}
const ROLE_COLOR = {
  producer: '#ffd47a',
  both:     '#ff60d0',
  consumer: '#80ffff',
  island:   '#6a608a',
};

function computeGraph(apps) {
  const types = new Set();
  for (const a of apps) {
    for (const o of (a.outputs || [])) types.add(o.type);
    for (const i of (a.inputs  || [])) types.add(i.type);
  }
  const edges = [];
  for (const src of apps) {
    for (const o of (src.outputs || [])) {
      for (const dst of apps) {
        if (dst.slug === src.slug) continue;
        for (const i of (dst.inputs || [])) {
          if (i.type === o.type) {
            edges.push({ from: src.slug, to: dst.slug, type: o.type });
          }
        }
      }
    }
  }
  return { types: Array.from(types), edges };
}

function renderGraphStats(apps, graph) {
  const roleCounts = { producer:0, both:0, consumer:0, island:0 };
  for (const a of apps) roleCounts[classifyApp(a)]++;
  const orphanTypes = new Set();
  for (const a of apps) {
    for (const o of (a.outputs || [])) {
      const consumed = apps.some(b => (b.inputs || []).some(i => i.type === o.type));
      if (!consumed) orphanTypes.add(o.type);
    }
    for (const i of (a.inputs || [])) {
      const produced = apps.some(b => (b.outputs || []).some(o => o.type === i.type));
      if (!produced) orphanTypes.add(i.type);
    }
  }
  const el = $('graph-stats');
  el.innerHTML = `
    <div class="gs"><span class="gs-l">APPS</span><span class="gs-v">${apps.length}</span></div>
    <div class="gs"><span class="gs-l">DATA TYPES</span><span class="gs-v">${graph.types.length}</span></div>
    <div class="gs"><span class="gs-l">CONNECTIONS</span><span class="gs-v">${graph.edges.length}</span></div>
    <div class="gs"><span class="gs-l">PRODUCERS</span><span class="gs-v">${roleCounts.producer + roleCounts.both}</span></div>
    <div class="gs"><span class="gs-l">CONSUMERS</span><span class="gs-v">${roleCounts.consumer + roleCounts.both}</span></div>
    <div class="gs"><span class="gs-l">ORPHAN TYPES</span><span class="gs-v">${orphanTypes.size}</span></div>
  `;
}

function renderGraph() {
  const apps = state.apps;
  const svg = $('graph-canvas');
  const detail = $('graph-detail');

  if (apps.length === 0) {
    svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle"
        fill="#6a608a" font-family="Courier New" font-size="11" letter-spacing="3">
        NO APPS INSTALLED
      </text>`;
    detail.innerHTML = 'Install apps to populate the graph.';
    $('graph-stats').innerHTML = '';
    return;
  }

  const graph = computeGraph(apps);
  renderGraphStats(apps, graph);

  // Layout: producers on the left, consumers on the right, both in the middle,
  // islands underneath.
  const groups = { producer: [], both: [], consumer: [], island: [] };
  for (const a of apps) groups[classifyApp(a)].push(a);

  const W = svg.clientWidth || 800;
  const H = 340;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const colX = { producer: W * 0.15, both: W * 0.5, consumer: W * 0.85 };
  const islandY = H - 50;

  const pos = new Map();  // slug → {x, y, role, app}
  for (const role of ['producer', 'both', 'consumer']) {
    const arr = groups[role];
    arr.forEach((a, i) => {
      const x = colX[role];
      const y = arr.length === 1 ? H * 0.4 : 60 + (H * 0.55) * (i / Math.max(1, arr.length - 1));
      pos.set(a.slug, { x, y, role, app: a });
    });
  }
  groups.island.forEach((a, i) => {
    const ttl = groups.island.length;
    const x = (W / (ttl + 1)) * (i + 1);
    pos.set(a.slug, { x, y: islandY, role: 'island', app: a });
  });

  // Build SVG
  let s = '';
  // Defs — arrowhead + edge gradient
  s += `<defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,96,208,.8)"/>
    </marker>
    <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,212,122,.85)"/>
      <stop offset="100%" stop-color="rgba(128,255,255,.85)"/>
    </linearGradient>
  </defs>`;

  // Subtle column guides
  s += `<g stroke="rgba(120,80,200,.08)" stroke-width="1" stroke-dasharray="2 6">
    <line x1="${colX.producer}" y1="20" x2="${colX.producer}" y2="${H-80}"/>
    <line x1="${colX.both}"     y1="20" x2="${colX.both}"     y2="${H-80}"/>
    <line x1="${colX.consumer}" y1="20" x2="${colX.consumer}" y2="${H-80}"/>
  </g>`;
  s += `<g font-family="Courier New, monospace" font-size="9" letter-spacing="2"
        fill="rgba(180,140,255,.4)" text-anchor="middle">
    <text x="${colX.producer}" y="14">PRODUCES</text>
    <text x="${colX.both}"     y="14">BOTH</text>
    <text x="${colX.consumer}" y="14">CONSUMES</text>
  </g>`;

  // Edges
  for (const e of graph.edges) {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) continue;
    const midX = (a.x + b.x) / 2;
    const d = `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
    s += `<g class="g-edge" data-from="${e.from}" data-to="${e.to}" data-type="${e.type}">
      <path d="${d}" fill="none" stroke="url(#edgeGrad)" stroke-width="1.5"
            marker-end="url(#arrow)" opacity="0.7"/>
      <text font-family="SF Mono, monospace" font-size="9" fill="rgba(180,140,255,.7)" letter-spacing="1">
        <textPath href="#etxt-${graph.edges.indexOf(e)}" startOffset="50%" text-anchor="middle">${e.type}</textPath>
      </text>
      <path id="etxt-${graph.edges.indexOf(e)}" d="${d}" fill="none" stroke="none"/>
    </g>`;
  }

  // Nodes
  for (const [slug, p] of pos) {
    const r = 18;
    const color = ROLE_COLOR[p.role];
    const initials = (p.app.name || slug).split(/[\s-_]+/)
      .filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join('') || '?';
    s += `<g class="g-node" data-slug="${slug}" style="cursor:pointer;">
      <circle cx="${p.x}" cy="${p.y}" r="${r+4}" fill="${color}" opacity="0.12"/>
      <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="rgba(20,12,38,.95)"
              stroke="${color}" stroke-width="2"/>
      <text x="${p.x}" y="${p.y+3}" text-anchor="middle"
            font-family="Courier New, monospace" font-size="9" letter-spacing="1"
            fill="${color}">${initials}</text>
      <text x="${p.x}" y="${p.y + r + 14}" text-anchor="middle"
            font-family="Inter, sans-serif" font-size="10" fill="#9c93c6">${p.app.name}</text>
    </g>`;
  }

  svg.innerHTML = s;

  // Wire interactions
  for (const node of svg.querySelectorAll('.g-node')) {
    node.addEventListener('mouseenter', () => showNodeDetail(node.dataset.slug, graph));
    node.addEventListener('click', () => {
      const slug = node.dataset.slug;
      setStatus(`Opening ${slug}…`);
      shellAPI.openApp(slug);
    });
  }
  for (const edge of svg.querySelectorAll('.g-edge')) {
    edge.addEventListener('mouseenter', () => showEdgeDetail(edge.dataset, graph));
  }

  // Default detail
  if (graph.edges.length === 0) {
    detail.innerHTML = `${apps.length} app${apps.length===1?'':'s'} installed, but no input/output type matches yet.
      Hover a node to see what it produces or consumes. Drop another app declaring an
      <span class="tcode">inputs</span> entry that matches one of the existing
      <span class="tcode">outputs</span> to draw a connection.`;
  } else {
    detail.innerHTML = `Hover any node or edge for details.
      <strong>${graph.edges.length}</strong> active data flow${graph.edges.length===1?'':'s'}
      across <strong>${apps.length}</strong> installed apps.`;
  }
}

function showNodeDetail(slug, graph) {
  const app = state.apps.find(a => a.slug === slug);
  if (!app) return;
  const role = classifyApp(app);
  const ins = (app.inputs || []).map(i => `<span class="tcode">${i.type}</span>`).join(' · ') || '—';
  const outs = (app.outputs || []).map(o => `<span class="tcode">${o.type}</span>`).join(' · ') || '—';
  const flowsIn = graph.edges.filter(e => e.to === slug).length;
  const flowsOut = graph.edges.filter(e => e.from === slug).length;
  $('graph-detail').innerHTML = `
    <strong>${app.name}</strong> <span style="color:${ROLE_COLOR[role]}">· ${role.toUpperCase()}</span><br>
    ${app.description || ''}<br>
    <small>OUTPUTS: ${outs}</small><br>
    <small>INPUTS: ${ins}</small><br>
    <small>${flowsIn} incoming · ${flowsOut} outgoing connection${flowsOut===1?'':'s'}</small>
  `;
}

function showEdgeDetail(ds, graph) {
  const from = state.apps.find(a => a.slug === ds.from);
  const to   = state.apps.find(a => a.slug === ds.to);
  if (!from || !to) return;
  $('graph-detail').innerHTML = `
    <strong>${from.name}</strong> → <span class="tcode">${ds.type}</span> → <strong>${to.name}</strong><br>
    <small>Profiles produced by ${from.name} are consumed by ${to.name} via this data type.</small>
  `;
}

// ── Search ──────────────────────────────────────────────────────────────────
function setupSearch() {
  $('search-input').addEventListener('input', e => {
    state.filter = e.target.value;
    renderApps();
  });
}

// ── Status bar ──────────────────────────────────────────────────────────────
function setStatus(msg) {
  $('status').textContent = msg;
}

// ── Boot ────────────────────────────────────────────────────────────────────
async function boot() {
  paintBrandMark();
  setupSearch();

  for (const btn of document.querySelectorAll('.nav-btn')) {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  }

  $('rescan-btn').addEventListener('click', async () => {
    setStatus('Rescanning…');
    state.apps = await shellAPI.rescan();
    renderApps();
    setStatus(`Found ${state.apps.length} app${state.apps.length===1?'':'s'}.`);
  });

  // Settings save button
  const saveBtn = document.getElementById('set-save');
  if (saveBtn) saveBtn.addEventListener('click', saveProvidersFromSettings);

  const youSave = $('you-save');
  if (youSave) youSave.addEventListener('click', saveYou);

  shellAPI.onRegistryUpdated(async () => {
    state.apps = await shellAPI.listApps();
    renderApps();
  });

  state.apps = await shellAPI.listApps();
  renderApps();
  setStatus(`Ready. ${state.apps.length} app${state.apps.length===1?'':'s'} installed.`);
}

boot();
