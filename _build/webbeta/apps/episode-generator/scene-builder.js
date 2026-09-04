/* =============================================================================
   FRACTURE CITY — EPISODE GENERATOR
   SCENE BUILDER — construct scenes from scratch, with live art generation

   Adds a full-screen builder overlay:
     · Setting    — stage / location / time / weather / tension
     · Cast       — pick from the character library, order = billing order
     · Shot & Art — shot type, colour grade, particles, motif insert
     · Script     — add / edit / reorder action, dialogue, interior, beat,
                    motif, narrator, reaction-hold, smash-cut
     · Preview    — renders the actual frame with the app's VideoRenderer
     · Output     — insert into the open episode, save to the scene shelf,
                    or export as a standalone scene.v1 JSON record

   Loaded after the inline app script and after story-engine.js.
   ========================================================================== */
(function(){
'use strict';

const G = globalThis;
// Host tables/classes declared with const/class in the inline script. They are
// global lexical bindings, not globalThis properties — story-engine.js captures
// them into HostRefs so both add-on scripts can reach them.
const H = G.HostRefs;
const $ = id => document.getElementById(id);

const STATE = {
  scene: null,
  library: [],
  selected: [],      // seeds, in billing order
  shelf: [],         // saved from-scratch scenes
  editingIdx: null,
  open: false,
};

// =============================================================================
// STYLES
// =============================================================================
const CSS = `
#sb-overlay{position:fixed;inset:0;z-index:9000;background:rgba(4,2,10,.94);
  backdrop-filter:blur(6px);display:none;overflow:auto;padding:0;}
#sb-overlay.on{display:block;}
.sb-wrap{max-width:1500px;margin:0 auto;padding:18px 22px 60px;}
.sb-head{display:flex;align-items:center;gap:14px;padding:14px 0 16px;
  border-bottom:1px solid var(--line);margin-bottom:18px;position:sticky;top:0;
  background:linear-gradient(180deg,rgba(4,2,10,.98) 70%,rgba(4,2,10,0));z-index:5;}
.sb-head h2{font-size:15px;letter-spacing:.22em;color:var(--teal);font-weight:600;}
.sb-head .sb-sub{font-size:10px;letter-spacing:.14em;color:var(--ink-fade);}
.sb-head .sb-spacer{flex:1;}
.sb-grid{display:grid;grid-template-columns:290px 1fr 400px;gap:18px;align-items:start;}
@media (max-width:1280px){.sb-grid{grid-template-columns:1fr 1fr;}}
@media (max-width:820px){.sb-grid{grid-template-columns:1fr;}}
.sb-panel{background:var(--panel);border:1px solid var(--line);border-radius:4px;
  padding:14px;margin-bottom:14px;}
.sb-panel h4{font-size:10px;letter-spacing:.20em;color:var(--magenta);
  margin-bottom:12px;padding-bottom:7px;border-bottom:1px solid var(--line);}
.sb-field{margin-bottom:10px;}
.sb-field label{display:block;font-size:9px;letter-spacing:.14em;
  color:var(--ink-fade);margin-bottom:4px;text-transform:uppercase;}
.sb-field select,.sb-field input[type=text],.sb-field textarea{
  width:100%;background:rgba(8,4,18,.85);border:1px solid var(--line);
  color:var(--ink);padding:6px 8px;border-radius:3px;font-size:11px;
  font-family:inherit;}
.sb-field textarea{min-height:52px;resize:vertical;line-height:1.45;}
.sb-field input[type=range]{width:100%;}
.sb-two{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.sb-btn{background:rgba(20,12,38,.8);border:1px solid var(--line);color:var(--ink-dim);
  padding:7px 13px;border-radius:3px;font-size:10px;letter-spacing:.13em;
  cursor:pointer;font-family:inherit;transition:.15s;}
.sb-btn:hover{color:var(--teal);border-color:var(--teal);}
.sb-btn.primary{border-color:var(--line-2);color:var(--ink);
  background:linear-gradient(180deg,rgba(160,64,255,.28),rgba(20,12,38,.8));}
.sb-btn.primary:hover{color:#fff;border-color:var(--magenta);}
.sb-btn.warn:hover{color:#ff6060;border-color:#ff6060;}
.sb-cast-list{max-height:230px;overflow:auto;}
.sb-cast-row{display:flex;align-items:center;gap:8px;padding:5px 6px;
  border:1px solid transparent;border-radius:3px;cursor:pointer;font-size:11px;}
.sb-cast-row:hover{background:rgba(120,200,255,.06);}
.sb-cast-row.on{border-color:var(--line-2);background:rgba(160,64,255,.14);}
.sb-cast-row .ord{width:16px;height:16px;border-radius:2px;font-size:9px;
  display:flex;align-items:center;justify-content:center;
  background:rgba(160,64,255,.4);color:#fff;flex:0 0 auto;}
.sb-cast-row .ord.off{background:rgba(120,200,255,.10);color:var(--ink-fade);}
.sb-script{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}
.sb-el{display:flex;gap:6px;align-items:flex-start;background:rgba(8,4,18,.6);
  border:1px solid var(--line);border-radius:3px;padding:6px;}
.sb-el.sel{border-color:var(--magenta);}
.sb-el .k{flex:0 0 88px;font-size:9px;letter-spacing:.1em;color:var(--teal);
  text-transform:uppercase;padding-top:3px;}
.sb-el .b{flex:1;min-width:0;font-size:11px;color:var(--ink-dim);line-height:1.5;
  word-break:break-word;}
.sb-el .b b{color:var(--ink);font-weight:600;}
.sb-el .acts{display:flex;flex-direction:column;gap:2px;flex:0 0 auto;}
.sb-el .acts button{background:rgba(20,12,38,.7);border:1px solid var(--line);
  color:var(--ink-fade);width:20px;height:16px;border-radius:2px;cursor:pointer;
  font-size:9px;line-height:1;padding:0;}
.sb-el .acts button:hover{color:var(--teal);border-color:var(--teal);}
.sb-empty{font-size:11px;color:var(--ink-fade);font-style:italic;padding:14px;
  text-align:center;border:1px dashed var(--line);border-radius:3px;}
#sb-canvas{width:100%;height:auto;display:block;border:1px solid var(--line);
  border-radius:3px;background:#04020a;}
.sb-shelf-row{display:flex;align-items:center;gap:8px;padding:6px;font-size:11px;
  border:1px solid var(--line);border-radius:3px;margin-bottom:5px;
  background:rgba(8,4,18,.5);}
.sb-shelf-row .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;color:var(--ink-dim);}
.sb-note{font-size:10px;color:var(--ink-fade);line-height:1.6;margin-top:8px;}
.sb-status{font-size:10px;letter-spacing:.1em;color:var(--teal);min-height:14px;}
.sb-tag{display:inline-block;font-size:9px;letter-spacing:.1em;padding:2px 6px;
  border:1px solid var(--line);border-radius:2px;color:var(--ink-fade);
  margin:0 4px 4px 0;}
`;

// =============================================================================
// SCRIPT ELEMENT KINDS
// =============================================================================
const KINDS = [
  { key:'action',        label:'Action',        field:'text', needsSpeaker:false,
    hint:'What physically happens, in the present tense.' },
  { key:'dialogue',      label:'Dialogue',      field:'line', needsSpeaker:true,
    hint:'A spoken line. Pick who says it.' },
  { key:'internal',      label:'Interior',      field:'text', needsSpeaker:true,
    hint:'Unspoken thought. Rendered as a close shot.' },
  { key:'beat',          label:'Beat',          field:'note', needsSpeaker:false,
    hint:'A held moment with no words. Direction only.' },
  { key:'motif',         label:'Motif Insert',  field:'text', needsSpeaker:false,
    hint:'Cutaway to the recurring object. Uses the motif art generator.' },
  { key:'narrator',      label:'Narrator',      field:'text', needsSpeaker:false,
    hint:'Deadpan lower-third caption.' },
  { key:'reaction-hold', label:'Reaction Hold', field:'text', needsSpeaker:true,
    hint:'Long hold on one face. Comic timing.' },
  { key:'smash-cut',     label:'Smash Cut',     field:'text', needsSpeaker:false,
    hint:'Hard cut to black and back. 250ms.' },
];

// =============================================================================
// BLANK SCENE
// =============================================================================
function blankScene(){
  const stage = H.STAGES[0];
  return {
    title: 'Untitled Scene',
    role: 'custom', beat: 'custom', beat_label: 'CUSTOM',
    tone: 'literary',
    stage,
    location: H.LOCATIONS[stage][0],
    time: H.TIMES[6],
    weather: H.WEATHER[0],
    tensionNum: 0.5,
    seed: 'sb_' + Math.random().toString(36).slice(2, 10),
    cast: [],
    script: [],
    _gradeOverride: 'auto',
    _shotOverride: 'auto',
    _particleOverride: 'auto',
    custom: true,
  };
}

// =============================================================================
// MARKUP
// =============================================================================
function buildOverlay(){
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'sb-overlay';
  el.innerHTML = `
  <div class="sb-wrap">
    <div class="sb-head">
      <h2>SCENE BUILDER</h2>
      <div class="sb-sub">construct from scratch · live art</div>
      <div class="sb-spacer"></div>
      <div class="sb-status" id="sb-status"></div>
      <button class="sb-btn" onclick="SceneBuilder.newScene()">NEW</button>
      <button class="sb-btn" onclick="SceneBuilder.close()">CLOSE ✕</button>
    </div>

    <div class="sb-grid">

      <!-- ── LEFT: SETTING + CAST ─────────────────────────────────── -->
      <div>
        <div class="sb-panel">
          <h4>SETTING</h4>
          <div class="sb-field">
            <label>Scene title</label>
            <input type="text" id="sb-title" oninput="SceneBuilder.set('title', this.value)">
          </div>
          <div class="sb-field">
            <label>Stage</label>
            <select id="sb-stage" onchange="SceneBuilder.setStage(this.value)"></select>
          </div>
          <div class="sb-field">
            <label>Location</label>
            <select id="sb-location" onchange="SceneBuilder.set('location', this.value)"></select>
          </div>
          <div class="sb-two">
            <div class="sb-field">
              <label>Time</label>
              <select id="sb-time" onchange="SceneBuilder.setTime(this.value)"></select>
            </div>
            <div class="sb-field">
              <label>Tone</label>
              <select id="sb-tone" onchange="SceneBuilder.set('tone', this.value)">
                <option value="literary">literary</option>
                <option value="comic">comic</option>
              </select>
            </div>
          </div>
          <div class="sb-field">
            <label>Weather</label>
            <select id="sb-weather" onchange="SceneBuilder.set('weather', this.value)"></select>
          </div>
          <div class="sb-field">
            <label>Tension — <span id="sb-tension-val">0.50</span></label>
            <input type="range" id="sb-tension" min="0" max="100" value="50"
              oninput="SceneBuilder.setTension(this.value)">
          </div>
        </div>

        <div class="sb-panel">
          <h4>CAST — click to add, click again to remove</h4>
          <div class="sb-cast-list" id="sb-cast-list"></div>
          <div class="sb-note">Order of selection is billing order. The first
            selected is treated as the scene's anchor for close shots.</div>
        </div>
      </div>

      <!-- ── MIDDLE: SCRIPT ───────────────────────────────────────── -->
      <div>
        <div class="sb-panel">
          <h4>SCRIPT</h4>
          <div class="sb-script" id="sb-script"></div>

          <div class="sb-field">
            <label>Add element</label>
            <div class="sb-two">
              <select id="sb-new-kind" onchange="SceneBuilder.onKindChange()"></select>
              <select id="sb-new-speaker"></select>
            </div>
          </div>
          <div class="sb-field">
            <label id="sb-new-hint">Text</label>
            <textarea id="sb-new-text" placeholder="Write the line…"></textarea>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="sb-btn primary" onclick="SceneBuilder.addElement()">+ ADD ELEMENT</button>
            <button class="sb-btn" onclick="SceneBuilder.commitEdit()" id="sb-save-edit"
              style="display:none;">SAVE EDIT</button>
            <button class="sb-btn" onclick="SceneBuilder.autoDraft()">AUTO-DRAFT FROM BEAT</button>
          </div>
          <div class="sb-note" id="sb-kind-hint"></div>
        </div>

        <div class="sb-panel">
          <h4>AUTO-DRAFT SETTINGS</h4>
          <div class="sb-two">
            <div class="sb-field">
              <label>Dramatic beat</label>
              <select id="sb-beat"></select>
            </div>
            <div class="sb-field">
              <label>Archetype context</label>
              <select id="sb-archetype"></select>
            </div>
          </div>
          <div class="sb-field">
            <label>Protagonist want (drives the draft)</label>
            <input type="text" id="sb-want" placeholder="e.g. deliver the letter before the watch changes">
          </div>
          <div class="sb-note">Auto-draft writes a causally-correct block of script
            for the chosen beat using the current cast, then you edit it by hand.</div>
        </div>
      </div>

      <!-- ── RIGHT: ART + OUTPUT ──────────────────────────────────── -->
      <div>
        <div class="sb-panel">
          <h4>ART GENERATOR</h4>
          <canvas id="sb-canvas" width="640" height="360"></canvas>
          <div class="sb-two" style="margin-top:10px;">
            <div class="sb-field">
              <label>Shot</label>
              <select id="sb-shot" onchange="SceneBuilder.set('_shotOverride', this.value)"></select>
            </div>
            <div class="sb-field">
              <label>Colour grade</label>
              <select id="sb-grade" onchange="SceneBuilder.set('_gradeOverride', this.value)"></select>
            </div>
          </div>
          <div class="sb-two">
            <div class="sb-field">
              <label>Particles</label>
              <select id="sb-particles" onchange="SceneBuilder.set('_particleOverride', this.value)"></select>
            </div>
            <div class="sb-field">
              <label>Preview element</label>
              <select id="sb-preview-el"></select>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="sb-btn primary" onclick="SceneBuilder.preview()">◉ RENDER FRAME</button>
            <button class="sb-btn" onclick="SceneBuilder.downloadFrame()">↓ PNG</button>
          </div>
        </div>

        <div class="sb-panel">
          <h4>OUTPUT</h4>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <button class="sb-btn primary" onclick="SceneBuilder.insertIntoEpisode()">INSERT INTO OPEN EPISODE</button>
            <button class="sb-btn" onclick="SceneBuilder.saveToShelf()">SAVE TO SHELF</button>
            <button class="sb-btn" onclick="SceneBuilder.exportScene()">EXPORT JSON</button>
          </div>
          <h4 style="margin-top:6px;">SCENE SHELF</h4>
          <div id="sb-shelf"></div>
        </div>
      </div>

    </div>
  </div>`;
  document.body.appendChild(el);
}

// =============================================================================
// POPULATE SELECTS
// =============================================================================
function fillSelects(){
  const opt = (v, l, sel) => `<option value="${String(v).replace(/"/g,'&quot;')}"${sel?' selected':''}>${l}</option>`;

  $('sb-stage').innerHTML   = H.STAGES.map(s => opt(s, s)).join('');
  $('sb-time').innerHTML    = H.TIMES.map((t,i) => opt(i, t.label)).join('');
  $('sb-weather').innerHTML = H.WEATHER.map(w => opt(w, w)).join('');
  $('sb-new-kind').innerHTML= KINDS.map(k => opt(k.key, k.label)).join('');

  const shots = H.SHOT ? Object.values(H.SHOT) : [];
  $('sb-shot').innerHTML = opt('auto','— auto (from element) —', true) +
    shots.map(s => opt(s, String(s).toUpperCase())).join('');

  const grades = H.COLOR_GRADE ? Object.keys(H.COLOR_GRADE) : [];
  $('sb-grade').innerHTML = opt('auto','— auto (from spine) —', true) +
    grades.map(g => opt(g, g)).join('');

  const parts = H.PARTICLE_TYPES ? Object.keys(H.PARTICLE_TYPES) : [];
  $('sb-particles').innerHTML = opt('auto','— auto (from weather) —', true) +
    opt('none','none') + parts.map(p => opt(p, p)).join('');

  const SE = G.StoryEngineV2;
  if (SE){
    $('sb-beat').innerHTML = SE.BEATS.concat([SE.CODA_BEAT])
      .map(b => opt(b.key, b.label)).join('');
    const byFam = {};
    SE.ARCHETYPES.forEach(a => { (byFam[a.family] = byFam[a.family] || []).push(a); });
    $('sb-archetype').innerHTML = Object.entries(byFam).map(([fam, list]) =>
      `<optgroup label="${fam}">${list.map(a => opt(a.key, a.label)).join('')}</optgroup>`).join('');
  }
  onKindChange();
}

function refreshLocationSelect(){
  const locs = H.LOCATIONS[STATE.scene.stage] || [];
  $('sb-location').innerHTML = locs.map(l =>
    `<option value="${l.replace(/"/g,'&quot;')}"${l===STATE.scene.location?' selected':''}>${l}</option>`).join('');
}

// =============================================================================
// CAST
// =============================================================================
async function loadLibrary(){
  // Prefer the controller's already-loaded library; fall back to reading storage.
  const E = host();
  try {
    const lib = E && E._state ? E._state().library : null;
    if (lib && lib.length){ STATE.library = lib.slice(); return; }
  } catch(e){ /* fall through */ }

  STATE.library = [];
  if (!G.fracture) return;
  try {
    // Same references index.html writes. Reading cached_ here while the page
    // wrote ref_ would have quietly emptied the cast list.
    if (G.CharRefs){ STATE.library = await G.CharRefs.values(); }
    else {
      const keys = await G.fracture.list();
      for (const k of keys.filter(k => k.startsWith('cached_character_'))){
        const d = await G.fracture.read(k);
        if (d && d.name) STATE.library.push(d);
      }
    }
  } catch(e){ console.warn('[scene-builder] library read failed', e); }
}

function renderCast(){
  const el = $('sb-cast-list');
  if (!STATE.library.length){
    el.innerHTML = `<div class="sb-empty">No characters in the library.<br>
      Generate some in Character Forge first.</div>`;
    return;
  }
  el.innerHTML = STATE.library.map(c => {
    const i = STATE.selected.indexOf(c.seed);
    const on = i >= 0;
    return `<div class="sb-cast-row ${on?'on':''}" onclick="SceneBuilder.toggleCast('${c.seed}')">
      <span class="ord ${on?'':'off'}">${on ? i+1 : '·'}</span>
      <span>${c.name.first} ${c.name.last || ''}</span>
      <span style="margin-left:auto;color:var(--ink-fade);font-size:9px;">Z${c.zone}</span>
    </div>`;
  }).join('');
  syncSpeakerSelect();
}

function syncSceneCast(){
  STATE.scene.cast = STATE.selected.map(seed => {
    const c = STATE.library.find(x => x.seed === seed);
    if (!c) return null;
    return {
      first: c.name.first, name: c.name.full || `${c.name.first} ${c.name.last||''}`.trim(),
      zone: c.zone, subtype: c.subtype, class: c.class, stamp: c.stamp,
      physical: c.physical, seed: c.seed, archetype: c.archetype,
    };
  }).filter(Boolean);
}

function syncSpeakerSelect(){
  const sel = $('sb-new-speaker');
  const names = STATE.scene.cast.map(c => c.first);
  sel.innerHTML = names.length
    ? names.map(n => `<option value="${n}">${n}</option>`).join('')
    : `<option value="">— add cast first —</option>`;
}

// =============================================================================
// SCRIPT EDITING
// =============================================================================
function renderScript(){
  const el = $('sb-script');
  const s = STATE.scene.script;
  if (!s.length){
    el.innerHTML = `<div class="sb-empty">No script yet. Add elements below,
      or use AUTO-DRAFT FROM BEAT to generate a causally-correct block and edit it.</div>`;
    syncPreviewElSelect();
    return;
  }
  el.innerHTML = s.map((e, i) => {
    const kind = KINDS.find(k => k.key === e.kind) || KINDS[0];
    const body = e.kind === 'dialogue'
      ? `<b>${e.speaker || '—'}:</b> ${esc(e.line || '')}`
      : e.kind === 'internal'
      ? `<b>${e.who || '—'}</b> — ${esc(e.text || '')}`
      : e.kind === 'motif'
      ? `${esc(e.text || '')} <span class="sb-tag">${esc(e.motif_tag || 'motif')}</span>`
      : esc(e.text || e.note || e.line || '');
    return `<div class="sb-el ${STATE.editingIdx===i?'sel':''}">
      <div class="k">${kind.label}</div>
      <div class="b">${body}</div>
      <div class="acts">
        <button onclick="SceneBuilder.moveEl(${i},-1)" title="up">▲</button>
        <button onclick="SceneBuilder.moveEl(${i},1)" title="down">▼</button>
        <button onclick="SceneBuilder.editEl(${i})" title="edit">✎</button>
        <button onclick="SceneBuilder.removeEl(${i})" title="remove">✕</button>
      </div>
    </div>`;
  }).join('');
  syncPreviewElSelect();
}

function esc(s){ return String(s).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }

function syncPreviewElSelect(){
  const sel = $('sb-preview-el');
  const s = STATE.scene.script;
  sel.innerHTML = s.length
    ? s.map((e,i) => `<option value="${i}">${i+1}. ${e.kind}</option>`).join('')
    : `<option value="-1">— no elements —</option>`;
}

function onKindChange(){
  const k = KINDS.find(x => x.key === $('sb-new-kind').value) || KINDS[0];
  $('sb-new-speaker').style.display = k.needsSpeaker ? '' : 'none';
  $('sb-new-hint').textContent = k.label + ' text';
  $('sb-kind-hint').textContent = k.hint;
}

function buildElement(kind, speaker, text){
  const k = KINDS.find(x => x.key === kind) || KINDS[0];
  const el = { kind };
  el[k.field] = text;
  if (kind === 'dialogue') el.speaker = speaker;
  if (kind === 'internal' || kind === 'reaction-hold') el.who = speaker;
  if (kind === 'motif'){
    const m = (H.MOTIFS || []).find(m => text.toLowerCase().includes(m.tag.slice(0,12).toLowerCase()));
    el.motif_tag = m ? m.tag : (H.MOTIFS?.[0]?.tag || 'a coin with a bent edge');
  }
  return el;
}

// =============================================================================
// AUTO-DRAFT — reuse the story engine's beat scriptors
// =============================================================================
function autoDraft(){
  const SE = G.StoryEngineV2;
  if (!SE) return status('Story engine not loaded.');
  syncSceneCast();
  if (!STATE.scene.cast.length) return status('Add at least one cast member first.');

  const beatKey = $('sb-beat').value;
  const archKey = $('sb-archetype').value;
  const arch = SE.ARCHETYPES.find(a => a.key === archKey) || SE.ARCHETYPES[0];
  const rng = new H.RNG(STATE.scene.seed + '::draft::' + Date.now());

  const want = $('sb-want').value.trim() ||
    (SE.WANT_CLASSES[arch.want] || SE.WANT_CLASSES.deliver)[0]
      .replace('{obj}', rng.pick(SE.OBJECTS))
      .replace('{antag}', STATE.scene.cast[1]?.first || 'whoever is in the way');

  const protag = STATE.scene.cast[0];
  const antag  = STATE.scene.cast[1] || null;
  const motif  = rng.pick(H.MOTIFS);
  const obstacle = SE.OBSTACLE_CLASSES[rng.pick(arch.obstacles)]({
    p: protag.first, a: antag ? antag.first : 'the district' });

  const spine = {
    protag, antag, supporting: STATE.scene.cast.slice(2),
    want, obstacle, motif,
    climaxType: arch.climax, resolutionShape: arch.resolution,
    escalation: arch.escalation, tone: STATE.scene.tone,
  };

  const L = new SE.StoryLedger();
  // Seed the ledger so mid/late beats have something concrete to reference
  L.add('has',   rng.pick(SE.OBJECTS));
  L.add('knows', rng.pick(SE.FACTS));
  L.add('owes',  rng.pick(SE.COSTS));
  if (['crisis','climax','resolution','coda'].includes(beatKey)) L.add('lost', rng.pick(SE.RELIED_ON));

  const scriptor = SE.BEAT_SCRIPTORS[beatKey] || SE.BEAT_SCRIPTORS['ordinary-world'];
  const block = scriptor(rng, spine, STATE.scene, L);

  STATE.scene.script = STATE.scene.script.concat(block);
  const beatDef = SE.BEATS.concat([SE.CODA_BEAT]).find(b => b.key === beatKey);
  STATE.scene.beat = beatKey;
  STATE.scene.beat_label = beatDef?.label || 'CUSTOM';
  STATE.scene.beat_job = beatDef?.job || '';
  STATE.scene.role = beatKey;
  STATE.scene._spine = {
    protag: protag.first, antag: antag?.first || null, want, obstacle,
    motif: motif.tag, climax_type: arch.climax, resolution_shape: arch.resolution,
    archetype: arch.key,
  };
  if (!$('sb-want').value.trim()) $('sb-want').value = want;

  renderScript();
  status(`Drafted ${block.length} elements for ${beatDef?.label || beatKey}.`);
}

// =============================================================================
// ART PREVIEW
// =============================================================================
async function preview(){
  syncSceneCast();
  const scene = STATE.scene;
  if (!scene.cast.length && !scene.script.length){
    return status('Nothing to render — add cast or script first.');
  }
  status('Rendering…');
  const canvas = $('sb-canvas');
  canvas.width = 1280; canvas.height = 720;

  const renderer = new H.VideoRenderer(canvas, {
    fps: 30, withAudio: false, allCharacters: scene.cast,
  });
  await renderer.setup();

  const idx = parseInt($('sb-preview-el').value, 10);
  const el = (idx >= 0 && scene.script[idx]) ? scene.script[idx] : (scene.script[0] || null);

  // Colour grade
  scene._gradeKey = (scene._gradeOverride && scene._gradeOverride !== 'auto')
    ? scene._gradeOverride
    : H.pickColorGrade(scene, scene._spine || {});

  // Particles
  let pTypes;
  if (scene._particleOverride === 'none') pTypes = [];
  else if (scene._particleOverride && scene._particleOverride !== 'auto') pTypes = [scene._particleOverride];
  else pTypes = H.particlesForScene(scene);
  renderer.particleFields = pTypes.map(t => new H.ParticleField(t, renderer.W, renderer.H));

  // Shot
  let shot;
  if (scene._shotOverride && scene._shotOverride !== 'auto') shot = scene._shotOverride;
  else if (el?.kind === 'dialogue' || el?.kind === 'internal' || el?.kind === 'reaction-hold') shot = H.SHOT.CLOSE;
  else if (el?.kind === 'motif') shot = H.SHOT.INSERT;
  else shot = H.SHOT.MEDIUM;

  const p = H.SHOT_PARAMS[shot] || H.SHOT_PARAMS[H.SHOT.MEDIUM];
  Object.assign(renderer.shotState, {
    charScale: p.charScale, charY: p.charY, envScale: p.envScale,
    envBlur: p.envBlur, envAlpha: p.envAlpha, panX: 0,
  });

  const now = performance.now();
  renderer.ctx.fillStyle = '#04020a';
  renderer.ctx.fillRect(0, 0, renderer.W, renderer.H);
  renderer.drawAtmosphere(scene, 0.5, now);
  renderer.drawCharacters(scene, 0.5, el, now, shot);
  renderer.drawSceneHeader(scene, 0.5);
  if (el) renderer.drawScriptElement(el, 0.5, scene, shot);
  renderer.applyVignette(0.5);
  if (shot === H.SHOT.CLOSE || shot === H.SHOT.INSERT){
    renderer.ctx.fillStyle = '#000';
    const barH = renderer.H * 0.04;
    renderer.ctx.fillRect(0, 0, renderer.W, barH);
    renderer.ctx.fillRect(0, renderer.H - barH, renderer.W, barH);
  }
  status(`Rendered — ${shot} · grade "${scene._gradeKey}" · ${pTypes.length} particle field(s).`);
}

function downloadFrame(){
  const canvas = $('sb-canvas');
  const a = document.createElement('a');
  a.download = (STATE.scene.title || 'scene').replace(/[^a-z0-9]+/gi,'_') + '.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
  status('Frame downloaded.');
}

// =============================================================================
// OUTPUT
// =============================================================================
function normalisedScene(){
  syncSceneCast();
  const s = STATE.scene;
  s.beats = s.script.map(e => ({
    label: e.kind.charAt(0).toUpperCase() + e.kind.slice(1),
    prose: e.text || e.line || e.note || '',
  }));
  return JSON.parse(JSON.stringify(s));
}

// EpiGen is declared with `const` in the inline script, so it is a global
// lexical binding — reachable by bare identifier, but NOT via globalThis.
function host(){
  try { return EpiGen; } catch(e){ return null; }
}

function insertIntoEpisode(){
  const E = host();
  if (!E || !E._state) return status('App controller unavailable.');
  const st = E._state();
  if (!st.arc) return status('No arc open. Generate an arc first, or save to shelf.');
  const ep = st.arc.episodes[st.selectedEpisodeIdx];
  if (!ep) return status('No episode selected.');
  const at = Math.min(st.selectedSceneIdx + 1, ep.scenes.length);
  ep.scenes.splice(at, 0, normalisedScene());
  try { E._rerender(); } catch(e){ /* director panel may be closed */ }
  status(`Inserted into ${ep.number} at position ${at + 1}.`);
}

async function saveToShelf(){
  const s = normalisedScene();
  STATE.shelf.push(s);
  if (G.fracture) await G.fracture.save('scene_shelf', STATE.shelf);
  renderShelf();
  status('Saved to shelf.');
}

function renderShelf(){
  const el = $('sb-shelf');
  if (!STATE.shelf.length){
    el.innerHTML = `<div class="sb-empty">Shelf is empty.</div>`;
    return;
  }
  el.innerHTML = STATE.shelf.map((s,i) => `
    <div class="sb-shelf-row">
      <span class="t">${esc(s.title)} — ${esc(s.location)}</span>
      <button class="sb-btn" onclick="SceneBuilder.loadFromShelf(${i})">LOAD</button>
      <button class="sb-btn warn" onclick="SceneBuilder.deleteFromShelf(${i})">✕</button>
    </div>`).join('');
}

function exportScene(){
  const s = normalisedScene();
  const record = {
    type: 'scene.custom.v1',
    app: 'episode-generator',
    created: new Date().toISOString(),
    scene: s,
  };
  const blob = new Blob([JSON.stringify(record, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (s.title || 'scene').replace(/[^a-z0-9]+/gi,'_') + '.json';
  a.click();
  status('Exported scene JSON.');
}

// =============================================================================
// SYNC + LIFECYCLE
// =============================================================================
function syncForm(){
  const s = STATE.scene;
  $('sb-title').value = s.title;
  $('sb-stage').value = s.stage;
  refreshLocationSelect();
  $('sb-location').value = s.location;
  $('sb-time').value = String(H.TIMES.indexOf(s.time));
  $('sb-weather').value = s.weather;
  $('sb-tone').value = s.tone;
  $('sb-tension').value = String(Math.round(s.tensionNum * 100));
  $('sb-tension-val').textContent = s.tensionNum.toFixed(2);
  $('sb-shot').value = s._shotOverride || 'auto';
  $('sb-grade').value = s._gradeOverride || 'auto';
  $('sb-particles').value = s._particleOverride || 'auto';
  renderCast();
  renderScript();
}

function status(msg){ const el = $('sb-status'); if (el) el.textContent = msg; }

let booted = false;
async function open(){
  if (!booted){
    buildOverlay();
    fillSelects();
    STATE.scene = blankScene();
    booted = true;
    if (G.fracture){
      const saved = await G.fracture.read('scene_shelf');
      if (Array.isArray(saved)) STATE.shelf = saved;
    }
  }
  await loadLibrary();
  syncForm();
  renderShelf();
  $('sb-overlay').classList.add('on');
  STATE.open = true;
  status('Ready.');
}

function close(){ $('sb-overlay').classList.remove('on'); STATE.open = false; }

// =============================================================================
// PUBLIC API
// =============================================================================
G.SceneBuilder = {
  open, close,

  newScene(){
    STATE.scene = blankScene();
    STATE.selected = [];
    STATE.editingIdx = null;
    $('sb-save-edit').style.display = 'none';
    syncForm();
    status('New blank scene.');
  },

  set(field, value){ STATE.scene[field] = value; },

  setStage(v){
    STATE.scene.stage = v;
    STATE.scene.location = (H.LOCATIONS[v] || [''])[0];
    refreshLocationSelect();
  },

  setTime(i){ STATE.scene.time = H.TIMES[parseInt(i,10)] || H.TIMES[0]; },

  setTension(v){
    STATE.scene.tensionNum = parseInt(v,10) / 100;
    $('sb-tension-val').textContent = STATE.scene.tensionNum.toFixed(2);
  },

  toggleCast(seed){
    const i = STATE.selected.indexOf(seed);
    if (i >= 0) STATE.selected.splice(i, 1);
    else STATE.selected.push(seed);
    syncSceneCast();
    renderCast();
  },

  onKindChange,

  addElement(){
    const kind = $('sb-new-kind').value;
    const speaker = $('sb-new-speaker').value;
    const text = $('sb-new-text').value.trim();
    if (!text) return status('Write some text first.');
    STATE.scene.script.push(buildElement(kind, speaker, text));
    $('sb-new-text').value = '';
    renderScript();
    status('Element added.');
  },

  editEl(i){
    const e = STATE.scene.script[i];
    if (!e) return;
    STATE.editingIdx = i;
    $('sb-new-kind').value = e.kind;
    onKindChange();
    if (e.speaker || e.who) $('sb-new-speaker').value = e.speaker || e.who;
    $('sb-new-text').value = e.text || e.line || e.note || '';
    $('sb-save-edit').style.display = '';
    renderScript();
    status('Editing element ' + (i+1) + '.');
  },

  commitEdit(){
    if (STATE.editingIdx === null) return;
    const kind = $('sb-new-kind').value;
    const speaker = $('sb-new-speaker').value;
    const text = $('sb-new-text').value.trim();
    STATE.scene.script[STATE.editingIdx] = buildElement(kind, speaker, text);
    STATE.editingIdx = null;
    $('sb-save-edit').style.display = 'none';
    $('sb-new-text').value = '';
    renderScript();
    status('Element updated.');
  },

  removeEl(i){ STATE.scene.script.splice(i,1); STATE.editingIdx = null; renderScript(); },

  moveEl(i, d){
    const j = i + d;
    const s = STATE.scene.script;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]];
    renderScript();
  },

  autoDraft,
  preview,
  downloadFrame,
  insertIntoEpisode,
  saveToShelf,
  exportScene,

  loadFromShelf(i){
    const s = STATE.shelf[i];
    if (!s) return;
    STATE.scene = JSON.parse(JSON.stringify(s));
    STATE.selected = (STATE.scene.cast || []).map(c => c.seed).filter(Boolean);
    syncForm();
    status('Loaded from shelf.');
  },

  async deleteFromShelf(i){
    STATE.shelf.splice(i,1);
    if (G.fracture) await G.fracture.save('scene_shelf', STATE.shelf);
    renderShelf();
  },

  _state: () => STATE,
};

console.log('[scene-builder] installed');

})();
