/* Runs inside the app's realm so lexical globals (RNG, STAGES…) resolve. */
let FAIL = 0;
function check(name, cond, detail){
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) FAIL++;
}

const cast = ['Meran','Coll','Isbet','Rue'].map((n,i) => ({
  seed:'s'+i, name:{ first:n, full:n+' Vale' }, zone:i+1,
  subtype:'a', class:'b', stamp:'V', physical:{},
}));

console.log('════ ARCHETYPE COVERAGE ════');
check('at least 24 archetypes', StoryEngineV2.ARCHETYPES.length >= 24,
  StoryEngineV2.ARCHETYPES.length + ' presets');
const keys = StoryEngineV2.ARCHETYPES.map(a => a.key);
check('archetype keys unique', new Set(keys).size === keys.length);
const badContract = StoryEngineV2.ARCHETYPES.filter(a =>
  !StoryEngineV2.WANT_CLASSES[a.want] ||
  !a.obstacles.every(o => StoryEngineV2.OBSTACLE_CLASSES[o]) ||
  !a.climax || !a.resolution);
check('every archetype has a valid contract', badContract.length === 0,
  badContract.map(a=>a.key).join(','));
console.log('  families: ' + [...new Set(StoryEngineV2.ARCHETYPES.map(a=>a.family))].join(', '));

console.log('\n════ EVERY ARCHETYPE GENERATES ════');
let genFail = [];
for (const a of StoryEngineV2.ARCHETYPES){
  try {
    const arc = generateArc(new RNG('t::'+a.key),
      { episodes:3, theme:'auto', scenesPerEpisode:9, tone:'literary', archetype:a.key }, cast);
    const empty = arc.episodes.some(e => e.scenes.some(s => !s.script.length));
    const undef = JSON.stringify(arc).includes('undefined');
    if (empty || undef) genFail.push(a.key + (empty?' [empty scene]':'') + (undef?' [undefined in output]':''));
  } catch(e){ genFail.push(a.key + ' [threw: ' + e.message + ']'); }
}
check('all 30 archetypes generate clean arcs', genFail.length === 0, genFail.join(' | '));

console.log('\n════ SCENE-COUNT SWEEP (4–13 scenes) ════');
let sweepFail = [];
for (let n = 4; n <= 13; n++){
  try {
    const arc = generateArc(new RNG('n'+n), { episodes:3, theme:'auto',
      scenesPerEpisode:n, tone:'literary', archetype:'heist' }, cast);
    arc.episodes.forEach(ep => {
      if (ep.scenes.length !== n) sweepFail.push(n+' scenes → got '+ep.scenes.length);
      const times = ep.scenes.map(s => TIMES.indexOf(s.time));
      for (let i=1;i<times.length;i++) if (times[i] < times[i-1]) sweepFail.push(n+': time went backwards');
      if (ep.continuity.location_moves > 2) sweepFail.push(n+': too many location moves');
    });
  } catch(e){ sweepFail.push(n + ' threw: ' + e.message); }
}
check('scene counts 4–13: monotonic time, ≤2 moves', sweepFail.length === 0,
  [...new Set(sweepFail)].join(' | '));

console.log('\n════ COMIC TONE ════');
try {
  const c = generateArc(new RNG('comic'), { episodes:3, theme:'auto',
    scenesPerEpisode:7, tone:'comic', archetype:'comedy-of-errors' }, cast);
  check('comic arc generates', c.episodes.length === 3);
  check('comic cast gets voice archetypes', c.cast.every(x => !!x.archetype));
} catch(e){ check('comic arc generates', false, e.message); }

console.log('\n════ MIXED / AUTO MODES ════');
['auto','mixed'].forEach(m => {
  try {
    const a = generateArc(new RNG('m::'+m), { episodes:5, theme:'auto',
      scenesPerEpisode:9, tone:'literary', archetype:m }, cast);
    check(m + ' mode generates', a.episodes.length === 5,
      'archetypes: ' + [...new Set(a.episodes.map(e=>e.archetype))].join(','));
  } catch(e){ check(m + ' mode generates', false, e.message); }
});

console.log('\n════ CAUSALITY ════');
const arc = generateArc(new RNG('verify-001'),
  { episodes:4, theme:'auto', scenesPerEpisode:9, tone:'literary', archetype:'whodunit' }, cast);
const ep = arc.episodes[0];
const L = ep.continuity.ledger;
check('ledger holds a real revelation', L.knows.length >= 1, L.knows.join('; '));
check('deadline kept out of the revelation bucket', !!L.deadline && !L.knows.includes(L.deadline), String(L.deadline));
check('ledger recorded a cost', L.owes.length >= 1, L.owes.join('; '));
check('crisis removed something', L.lost.length >= 1, L.lost.join('; '));
check('beat log covers every scene', ep.continuity.beat_log.length === ep.scenes.length,
  ep.continuity.beat_log.length + '/' + ep.scenes.length);
check('later episodes inherit a thread',
  arc.episodes.slice(1).some(e => !!e.spine.inherited_from_previous),
  String(arc.episodes[1].spine.inherited_from_previous));
const climax = ep.scenes.find(s => s.beat === 'climax');
const firstFact = L.knows[0];
check('climax references an earlier ledger fact',
  climax.script.some(e => (e.text||e.line||'').includes(firstFact.slice(0, 24))),
  firstFact);
const res = ep.scenes.find(s => s.beat === 'resolution');
check('resolution references what was lost',
  L.lost.some(x => res.script.some(e => (e.text||'').toLowerCase().includes(x.slice(0,18).toLowerCase()))));
check('resolution returns to the opening location',
  res.location === ep.scenes[0].location,
  ep.scenes[0].location + ' -> ' + res.location);
check('climax cites the midpoint revelation, not the clock',
  climax.script.some(e => (e.text||e.line||'').includes(L.knows[L.knows.length-1].slice(0,24))),
  L.knows[L.knows.length-1]);
check('tension rises to the climax',
  climax.tensionNum > ep.scenes[0].tensionNum,
  ep.scenes[0].tensionNum.toFixed(2) + ' → ' + climax.tensionNum.toFixed(2));

console.log('\n════ SOLO CAST + SEASON VARIETY (the on-screen regressions) ════');
const solo = [{ seed:'solo', name:{ first:'Mahir', full:'Mahir Vey' }, zone:2,
                subtype:'a', class:'b', stamp:'V', physical:{} }];
let soloBad = [], varietyBad = [];
for (const a of StoryEngineV2.ARCHETYPES){
  const s1 = generateArc(new RNG('solo::'+a.key),
    { episodes:6, theme:'auto', scenesPerEpisode:6, tone:'literary', archetype:a.key }, solo);

  // 1. no dangling antagonist phrasing when nobody else is on screen
  s1.episodes.forEach(e => {
    if (/\bnull\b|the district, who has never deserved/.test(e.spine.obstacle))
      soloBad.push(a.key+': "'+e.spine.obstacle+'"');
  });
  // 2. obstacles must not repeat more than twice in six episodes
  const obs = s1.episodes.map(e => e.spine.obstacle);
  const maxObs = Math.max(...obs.map(o => obs.filter(x => x === o).length));
  if (maxObs > 2) varietyBad.push(a.key+': obstacle repeats '+maxObs+'x');
  // 3. wants must all be distinct
  const wants = s1.episodes.map(e => e.spine.want);
  if (new Set(wants).size !== wants.length) varietyBad.push(a.key+': duplicate want');
  // 4. season must not land the same resolution every week
  const shapes = s1.episodes.map(e => e.spine.resolution_shape);
  if (new Set(shapes).size < 3) varietyBad.push(a.key+': only '+new Set(shapes).size+' resolution shape(s)');
  // 5. the finale still honours the archetype contract
  if (shapes[shapes.length-1] !== a.resolution) varietyBad.push(a.key+': finale broke contract');
  // 6. no two consecutive episodes may land the same ending
  for (let i=1;i<shapes.length;i++)
    if (shapes[i] === shapes[i-1]) varietyBad.push(a.key+': back-to-back '+shapes[i]+' at ep'+(i+1));
  // 7. motifs must be unique across the season (they are the recurring image)
  const motifs = s1.episodes.map(e => e.spine.motif);
  if (new Set(motifs).size !== motifs.length)
    varietyBad.push(a.key+': duplicate motif ('+motifs.length+' eps, '+new Set(motifs).size+' unique)');
  // 8. the logline must not say the protagonist's name twice
  s1.episodes.forEach(e => {
    const n = e.spine.protag;
    const hits = (e.logline.match(new RegExp('\\b'+n+'\\b','g')) || []).length;
    if (hits > 1) varietyBad.push(a.key+': logline repeats "'+n+'" '+hits+'x');
  });
}
check('solo cast produces grammatical obstacles', soloBad.length === 0, [...new Set(soloBad)].slice(0,4).join(' | '));
check('seasons vary obstacle, want and ending', varietyBad.length === 0, [...new Set(varietyBad)].slice(0,6).join(' | '));

console.log('\n════ PROSE HYGIENE (all 30 archetypes x 3 eps) ════');
const bad = [];
const PATTERNS = [
  [/\bthe the\b/i, 'doubled article'],
  [/\ba a\b/i, 'doubled article'],
  [/\bundefined\b/, 'undefined leaked'],
  [/\[object Object\]/, 'object stringified'],
  [/\{obj\}|\{antag\}|\{protag\}/, 'unfilled placeholder'],
  [/\s,|\s\./, 'floating punctuation'],
  [/,\s*,|\.\s*\./, 'doubled punctuation'],
];
for (const a of StoryEngineV2.ARCHETYPES){
  const arc2 = generateArc(new RNG('prose::'+a.key),
    { episodes:3, theme:'auto', scenesPerEpisode:9, tone:'literary', archetype:a.key }, cast);
  arc2.episodes.forEach(e => e.scenes.forEach(sc => sc.script.forEach(el => {
    const t = el.text || el.line || el.note || '';
    PATTERNS.forEach(([re, name]) => { if (re.test(t)) bad.push(a.key+': '+name+' -> "'+t.slice(0,80)+'"'); });
  })));
}
check('no malformed prose across 90 episodes', bad.length === 0, [...new Set(bad)].slice(0,6).join('\n         '));

console.log('\n════ SAMPLE OUTPUT ════');
console.log('SEASON: ' + arc.title + '   [' + arc.archetype_label + ' · ' + arc.archetype_family + ']');
console.log('PREMISE: ' + arc.premise);
console.log('THROUGH-LINE: ' + arc.through_line);
console.log('\n' + ep.number + ' — ' + ep.title + '   [' + ep.archetype_label + ']');
console.log('LOGLINE:  ' + ep.logline);
console.log('WANT:     ' + ep.spine.want);
console.log('OBSTACLE: ' + ep.spine.obstacle);
console.log('SETTING:  ' + ep.continuity.primary_location + '  (' + ep.continuity.location_moves + ' move[s])');
console.log('TIME:     ' + ep.scenes.map(s => s.time.label).join(' → '));
console.log('TENSION:  ' + ep.scenes.map(s => s.tensionNum.toFixed(2)).join('  '));
console.log('\nBEAT LOG:');
ep.continuity.beat_log.forEach(b => console.log('  ' + b.beat.padEnd(20) + b.summary));

console.log('\n── SCENE 5 / ' + climax.beat_label + ' ──');
console.log(climax.location + ' · ' + climax.time.label + ' · ' + climax.weather);
climax.script.forEach(e =>
  console.log('  [' + e.kind.padEnd(9) + '] ' + (e.speaker ? e.speaker + ': ' : '') +
    (e.text || e.line || e.note || '')));

console.log('\n── RESOLUTION ──');
res.script.forEach(e =>
  console.log('  [' + e.kind.padEnd(9) + '] ' + (e.speaker ? e.speaker + ': ' : '') +
    (e.text || e.line || e.note || '')));

console.log('\n════ ' + (FAIL === 0 ? 'ALL CHECKS PASSED' : FAIL + ' CHECK(S) FAILED') + ' ════');
