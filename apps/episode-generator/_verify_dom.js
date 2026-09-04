/* DOM smoke test for the Scene Builder — loads index.html in jsdom and drives
   the builder through a real interaction path. Run: node _verify_dom.js
   Safe to delete — not loaded by the app. */
const fs = require('fs'), path = require('path');
const { JSDOM } = require(process.env.JSDOM_PATH || '/tmp/node_modules/jsdom');

let FAIL = 0;
const check = (n, c, d) => { console.log((c?'  PASS  ':'  FAIL  ')+n+(d?'  — '+d:'')); if(!c) FAIL++; };

const dir = __dirname;
// Strip the <script src> tags — we inject those manually below so they load
// exactly once, in order, with no network/file resolution involved.
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
  .replace(/<script src="(story-engine|scene-builder)\.js"><\/script>/g, '');

process.on('unhandledRejection', e => {
  const m = String(e && (e.message || e.name || e));
  if (/not implemented|getContext|canvas/i.test(m)) return; // jsdom has no canvas
  console.log('  NOTE  unhandled rejection: ' + m);
});

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost/index.html',
  pretendToBeVisual: true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = () => null;
    w.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){} });
    w.AudioContext = function(){};
    w.speechSynthesis = { getVoices: () => [] };
  },
});

// jsdom's default resource loader needs the scripts injected manually
const w = dom.window;
['story-engine.js','scene-builder.js'].forEach(f => {
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(dir, f), 'utf8');
  w.document.body.appendChild(s);
});

setTimeout(async () => {
  console.log('════ MODULE LOAD ════');
  check('StoryEngineV2 present', !!w.StoryEngineV2);
  check('HostRefs published', !!w.HostRefs);
  check('HostRefs resolved the lexical globals',
    !!(w.HostRefs && w.HostRefs.RNG && w.HostRefs.STAGES && w.HostRefs.TIMES &&
       w.HostRefs.MOTIFS && w.HostRefs.VideoRenderer && w.HostRefs.SHOT));
  check('generateArc overridden by v2',
    typeof w.generateArc === 'function' && w.generateArc === w.StoryEngineV2.generateArc);
  check('SceneBuilder present', !!w.SceneBuilder);
  const EPI = dom.window.eval('EpiGen');
check('EpiGen exposes _state hook', typeof EPI?._state === 'function');
  check('EpiGen exposes _rerender hook', typeof EPI?._rerender === 'function');

  console.log('\n════ ARCHETYPE SELECTOR ════');
  const sel = w.document.getElementById('p-archetype');
  check('selector exists', !!sel);
  const opts = sel ? [...sel.querySelectorAll('option')] : [];
  check('selector populated with 24+ presets plus auto/mixed',
    opts.length >= 26, opts.length + ' options');
  check('grouped by family',
    sel && sel.querySelectorAll('optgroup').length >= 5,
    sel ? sel.querySelectorAll('optgroup').length + ' groups' : '');
  check('blurb rendered', (w.document.getElementById('p-archetype-blurb')?.textContent||'').length > 10);

  console.log('\n════ SCENE BUILDER UI ════');
  try {
    await w.SceneBuilder.open();
    check('overlay opens', w.document.getElementById('sb-overlay')?.classList.contains('on'));
    const ids = ['sb-stage','sb-location','sb-time','sb-weather','sb-tension','sb-cast-list',
                 'sb-script','sb-new-kind','sb-shot','sb-grade','sb-particles','sb-canvas',
                 'sb-beat','sb-archetype','sb-shelf'];
    const missing = ids.filter(i => !w.document.getElementById(i));
    check('all builder controls mounted', missing.length === 0, missing.join(','));

    const stage = w.document.getElementById('sb-stage');
    check('stage select populated', stage.options.length === w.HostRefs.STAGES.length);
    const loc = w.document.getElementById('sb-location');
    check('location select populated for default stage', loc.options.length > 0,
      loc.options.length + ' locations');
    check('beat select populated', w.document.getElementById('sb-beat').options.length >= 10);
    check('shot select has auto + shots', w.document.getElementById('sb-shot').options.length > 1);
    check('grade select has auto + grades', w.document.getElementById('sb-grade').options.length > 1);

    console.log('\n════ BUILDER INTERACTION ════');
    // Inject a fake library, since localStorage is empty in this harness
    const S = w.SceneBuilder._state();
    S.library = ['Meran','Coll'].map((n,i) => ({
      seed:'lib'+i, name:{ first:n, last:'Vale', full:n+' Vale' },
      zone:i+1, subtype:'a', class:'b', stamp:'V', physical:{},
    }));
    w.SceneBuilder.toggleCast('lib0');
    w.SceneBuilder.toggleCast('lib1');
    check('cast selection registers', S.selected.length === 2 && S.scene.cast.length === 2,
      S.scene.cast.map(c=>c.first).join(', '));

    w.SceneBuilder.setStage(w.HostRefs.STAGES[2]);
    check('stage change repoints location',
      w.HostRefs.LOCATIONS[w.HostRefs.STAGES[2]].includes(S.scene.location), S.scene.location);
    w.SceneBuilder.setTime('7');
    check('time setter binds a real TIMES entry', S.scene.time === w.HostRefs.TIMES[7], S.scene.time.label);
    w.SceneBuilder.setTension('82');
    check('tension setter normalises to 0–1', Math.abs(S.scene.tensionNum - 0.82) < 1e-9);

    // Manual element
    w.document.getElementById('sb-new-kind').value = 'dialogue';
    w.SceneBuilder.onKindChange();
    w.document.getElementById('sb-new-speaker').value = 'Meran';
    w.document.getElementById('sb-new-text').value = 'You were here before the bell.';
    w.SceneBuilder.addElement();
    check('manual dialogue element added',
      S.scene.script.length === 1 && S.scene.script[0].speaker === 'Meran' &&
      S.scene.script[0].line === 'You were here before the bell.');

    // Auto-draft
    w.document.getElementById('sb-beat').value = 'midpoint-reversal';
    w.document.getElementById('sb-archetype').value = 'heist';
    w.SceneBuilder.autoDraft();
    check('auto-draft appended a beat block', S.scene.script.length > 1,
      S.scene.script.length + ' elements total');
    check('auto-draft tagged the beat', S.scene.beat === 'midpoint-reversal', S.scene.beat_label);
    check('auto-draft built a spine', !!S.scene._spine?.want, S.scene._spine?.want);
    check('draft prose is non-empty',
      S.scene.script.slice(1).every(e => (e.text||e.line||e.note||'').length > 0));

    // Reorder + edit + remove
    const before = S.scene.script[0].kind;
    w.SceneBuilder.moveEl(0, 1);
    check('moveEl reorders', S.scene.script[1].kind === before);
    const n0 = S.scene.script.length;
    w.SceneBuilder.removeEl(0);
    check('removeEl deletes', S.scene.script.length === n0 - 1);

    console.log('\n════ OUTPUT PATHS ════');
    await w.SceneBuilder.saveToShelf();
    check('saveToShelf stores a scene', S.shelf.length === 1);
    check('shelf scene has beats[] for the renderer',
      Array.isArray(S.shelf[0].beats) && S.shelf[0].beats.length === S.scene.script.length);
    check('shelf row rendered',
      w.document.querySelectorAll('#sb-shelf .sb-shelf-row').length === 1);

    // Insert into an episode
    const st = EPI._state();
    st.library = S.library;
    st.selectedCast = new Set(['lib0','lib1']);
    w.document.getElementById('p-archetype').value = 'heist';
    EPI.generateArc();
    check('arc generated through the UI path', !!st.arc, st.arc?.archetype_label);
    check('arc used the selected archetype', st.arc?.archetype === 'heist');
    const epScenes = st.arc.episodes[0].scenes.length;
    w.SceneBuilder.insertIntoEpisode();
    check('insertIntoEpisode adds a scene',
      st.arc.episodes[0].scenes.length === epScenes + 1,
      epScenes + ' -> ' + st.arc.episodes[0].scenes.length);
    check('inserted scene is flagged custom',
      st.arc.episodes[0].scenes.some(s => s.custom === true));

    w.SceneBuilder.close();
    check('overlay closes', !w.document.getElementById('sb-overlay').classList.contains('on'));
  } catch(e){
    check('builder interaction completed without throwing', false, e.message + '\n' + e.stack);
  }

  console.log('\n════ ' + (FAIL === 0 ? 'ALL DOM CHECKS PASSED' : FAIL + ' CHECK(S) FAILED') + ' ════');
  process.exit(FAIL === 0 ? 0 : 1);
}, 400);
