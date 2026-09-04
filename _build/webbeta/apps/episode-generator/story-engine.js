/* =============================================================================
   FRACTURE CITY — EPISODE GENERATOR
   STORY ENGINE v2 — Causal Beat-Sheet Spine + Archetype Presets

   Loaded AFTER the inline app script. Overrides:
     globalThis.generateArc   (season construction)
     globalThis.makeScene     (scene construction)

   Fixes the three reasons episodes previously did not make sense:
     1. Elements were drawn independently at random. Now every element is
        derived from an archetype contract, so want/obstacle/climax cohere.
     2. Scenes had no memory. Now a StoryLedger records what is known,
        held, owed, lost and broken; each beat READS the ledger and WRITES
        to it, and prose references prior entries by name.
     3. Setting was re-rolled per scene. Now an episode holds a primary
        location, moves at most twice, narrates each move, and advances
        time monotonically with drifting weather.
   ========================================================================== */
(function(){
'use strict';

// -----------------------------------------------------------------------------
// HOST BINDINGS
// The inline app script declares its tables with `const` and `class`. Those are
// global *lexical* bindings — they are NOT properties of globalThis. A later
// classic script can still see them by bare identifier (shared global lexical
// scope), so we capture them here once and publish them for scene-builder.js.
// -----------------------------------------------------------------------------
const HOST = {
  RNG, STAGES, LOCATIONS, TIMES, WEATHER,
  MOTIFS, COMIC_MOTIFS,
  ARC_TITLE_PATTERNS, ARC_PREMISES, THROUGH_LINES, EP_TITLE_PATTERNS,
  VOICE_ARCHETYPES, makeSceneTitle,
  SHOT, SHOT_PARAMS, COLOR_GRADE, PARTICLE_TYPES,
  pickColorGrade, particlesForScene,
  VideoRenderer, ParticleField,
  ELEMENT_DURATIONS,
};
globalThis.HostRefs = HOST;

// =============================================================================
// 1. DRAMATIC BEAT SHEET
//    Nine beats. Each has a dramatic JOB — a specific change it must make to
//    the ledger. A scene that does not change the ledger is not a scene.
// =============================================================================
const BEATS = [
  { key:'ordinary-world',    label:'ORDINARY WORLD',    tension:0.22,
    job:'establish the protagonist inside their normal, and the lack under it' },
  { key:'inciting-incident', label:'INCITING INCIDENT', tension:0.38,
    job:'introduce the pressure that makes the want urgent and dated' },
  { key:'commitment',        label:'COMMITMENT',        tension:0.46,
    job:'the protagonist chooses, and pays a small entry cost to choose' },
  { key:'first-obstacle',    label:'FIRST OBSTACLE',    tension:0.55,
    job:'the first attempt fails in a way that teaches the shape of the problem' },
  { key:'midpoint-reversal', label:'MIDPOINT REVERSAL', tension:0.68,
    job:'a fact surfaces that reframes the want — the goal is not what it was' },
  { key:'escalation',        label:'ESCALATION',        tension:0.78,
    job:'pressure compounds; an ally turns, or the cost of the want doubles' },
  { key:'crisis',            label:'CRISIS',            tension:0.88,
    job:'the thing the protagonist was relying on is removed' },
  { key:'climax',            label:'CLIMAX',            tension:0.97,
    job:'the want is confronted directly and settled per the archetype' },
  { key:'resolution',        label:'RESOLUTION',        tension:0.36,
    job:'the new normal, measured against the ordinary world' },
];

// A tenth, optional, when scene count allows
const CODA_BEAT = { key:'coda', label:'CODA', tension:0.20,
  job:'one image that reports the cost without commenting on it' };

// Map an arbitrary scene count onto the beat sheet without breaking causality.
// Beats are never reordered and never dropped from the load-bearing middle.
function assignBeats(n){
  if (n <= 3) return [BEATS[0], BEATS[7], BEATS[8]];
  if (n === 4) return [BEATS[0], BEATS[1], BEATS[7], BEATS[8]];
  if (n === 5) return [BEATS[0], BEATS[1], BEATS[4], BEATS[7], BEATS[8]];
  if (n === 6) return [BEATS[0], BEATS[1], BEATS[3], BEATS[4], BEATS[7], BEATS[8]];
  if (n === 7) return [BEATS[0], BEATS[1], BEATS[2], BEATS[4], BEATS[6], BEATS[7], BEATS[8]];
  if (n === 8) return [BEATS[0], BEATS[1], BEATS[2], BEATS[3], BEATS[4], BEATS[6], BEATS[7], BEATS[8]];
  if (n === 9) return BEATS.slice();
  if (n === 10) return BEATS.slice(0,8).concat([CODA_BEAT, BEATS[8]]).slice(0,10);
  // 11+: duplicate escalation, which is the only beat that survives repetition
  const out = BEATS.slice();
  while (out.length < n){
    out.splice(6, 0, { ...BEATS[5], key:'escalation-'+out.length, label:'ESCALATION' });
  }
  return out.slice(0, n);
}

// =============================================================================
// 2. ARCHETYPE PRESETS — 28
//    Each is a CONTRACT. It decides what the protagonist can want, what can
//    stand in the way, how the climax must land, and what the resolution costs.
//    This is what stops the generator producing incompatible parts.
// =============================================================================

// Want classes — phrased so they can be completed with a concrete object
// Six phrasings minimum per class — a season can run to thirteen episodes, and
// three phrasings guarantees verbatim repeats by episode four.
const W = {
  retrieve:  ['get back the {obj} that was taken', 'recover the {obj} before it is sold on',
              'take back what was lent and never returned', 'find where the {obj} ended up, and who moved it',
              'buy back the {obj} at whatever it now costs', 'get the {obj} out of the house before it is inventoried'],
  deliver:   ['deliver the {obj} before the watch changes', 'get the {obj} into the right hands by morning',
              'carry the {obj} across the city without being seen', 'put the {obj} where it was always meant to go',
              'hand over the {obj} in person, not by messenger', 'see the {obj} across the water before the gate closes'],
  learn:     ['find out who came asking after them last week', 'get one honest answer from the only person who knows',
              'find out whether the rumour is true', 'learn what happened in the hour nobody accounts for',
              'put a name to the handwriting', 'find out which version of the night is the real one'],
  confess:   ['say the thing they could not say at the funeral', 'tell the truth in front of one person, just once',
              'make an apology that lets neither of them off', 'admit what they did with the {obj}',
              'say it before somebody else says it for them', 'stop letting a useful silence do the work'],
  escape:    ['leave a place without anyone knowing they left', 'find a way out before the gate is sealed',
              'get clear of the district before first bell', 'get out without taking anyone down with them',
              'disappear in a way that will not be searched', 'reach the water before the tide turns'],
  protect:   ['keep the child from learning what they will eventually have to learn', 'warn someone before the next bell',
              'stand between {antag} and the door', 'keep one name off the list',
              'get everyone out before the thing arrives', 'take the blame while it is still takeable'],
  hold:      ['hold the room until the relief comes', 'keep the door shut one more night',
              'stay through the winter', 'not give ground before the light does',
              'keep the lamp burning until somebody answers', 'outlast whatever is on the other side'],
  prove:     ['find a witness who will say it under oath', 'make the case in front of people who do not want to hear it',
              'be believed, once, about one thing', 'produce the {obj} in front of the right people',
              'get it written down where it cannot be revised', 'make the record say what happened'],
  belong:    ['be in the room when the verdict comes', 'be counted among them, properly, for once',
              'be alone but not anonymous', 'get their name said correctly by someone who matters',
              'be asked to stay rather than allowed to', 'sit down without first being told to'],
  ascend:    ['get the position that was promised', 'buy back what was sold when they could not afford to keep it',
              'be the one they send for', 'have the {obj} put in their name',
              'be introduced without an explanation attached', 'get the room to go quiet when they come in'],
  avenge:    ['make {antag} say it out loud, in front of witnesses', 'collect a debt that was never written down',
              'put the account straight', 'make sure the cost lands where it was earned',
              'take back exactly what was taken, and no more', 'be there when it finally comes due'],
  atone:     ['make the formal apology stick', 'leave one thing better than they found it',
              'discharge a promise made before they were old enough to mean it', 'return the {obj} without being asked',
              'do the unpaid part of the work nobody will see', 'be useful to the person they wronged'],
  survive:   ['get through the night with everyone still breathing', 'find water before the second day',
              'not be the one who has to tell her', 'ration what is left far enough to matter',
              'keep moving while there is still light', 'get everyone to the far side of the season'],
  release:   ['set down a thing that has been carried too long', 'burn the letter that was kept too long',
              'say goodbye to a place that does not yet know it', 'give the {obj} away in a manner that does not look like giving',
              'stop keeping the room exactly as it was', 'let the anniversary pass without marking it'],
};

// Obstacle classes — each is a FUNCTION of the antagonist, so they cohere
// `a` is the antagonist's name, or null when the protagonist is working alone.
// Every entry must read correctly in both cases.
const O = {
  person:    ({a}) => a ? `${a} wants the same thing and got there first`
                        : `somebody else wanted it too, and got there first`,
  authority: ({a}) => a ? `the rule ${a} enforces was written to prevent exactly this`
                        : `the rule that governs it was written to prevent exactly this`,
  clock:     ()    => `the window closes at the next bell and cannot be widened`,
  secret:    ({a}) => a ? `${a} knows something that would change the plan, and is not saying it`
                        : `someone knows the thing that would change the plan, and is not saying it`,
  // No name here — the logline already opens with it, and "Auron sets out to X,
  // and Auron has done this before" reads like a transcription error.
  self:      ()    => `they have tried this once before, it went badly, and the body remembers`,
  price:     ()    => `it can be had, but only by giving up something already loved`,
  distance:  ()    => `the place is reachable, but not by anyone who wants to come back`,
  crowd:     ()    => `too many people have an opinion and none of them will move`,
  loyalty:   ({a}) => a ? `doing it means going around ${a}, who has never deserved that`
                        : `doing it means going around people who have never deserved that`,
  evidence:  ()    => `everything true about it is unprovable, and everything provable is false`,
};

// Climax types must be reachable from the want. Resolution shapes must be
// reachable from the climax. The archetype fixes both.
const ARCHETYPES = [
  // ── QUEST FAMILY ─────────────────────────────────────────────────────────
  { key:'heros-journey', label:"Hero's Journey", family:'Quest',
    blurb:'An ordinary person is called out, refuses, goes anyway, and comes back changed.',
    want:'deliver', obstacles:['self','distance','person'], climax:'threshold-crossed',
    resolution:'transformed', motifAffinity:['key','light','name'], escalation:'steady',
    seasonShape:['call','refusal','crossing','trials','ordeal','reward','return'] },

  { key:'quest', label:'The Long Errand', family:'Quest',
    blurb:'A simple task turns out to have no simple version of itself.',
    want:'deliver', obstacles:['clock','distance','crowd'], climax:'confrontation',
    resolution:'cost-paid', motifAffinity:['letter','key','watch'], escalation:'steady' },

  { key:'voyage-return', label:'The Far Country', family:'Quest',
    blurb:'Somewhere strange, then home — and home is the part that has changed.',
    want:'learn', obstacles:['distance','secret','self'], climax:'revelation',
    resolution:'transformed', motifAffinity:['light','song','chair'], escalation:'late' },

  { key:'escape', label:'The Way Out', family:'Quest',
    blurb:'Every exit is watched. One of them is watched badly.',
    want:'escape', obstacles:['authority','clock','loyalty'], climax:'threshold-crossed',
    resolution:'cost-paid', motifAffinity:['key','coldhand','bell'], escalation:'sharp' },

  // ── RISE / FALL FAMILY ───────────────────────────────────────────────────
  { key:'rags-to-riches', label:'The Ascent', family:'Rise & Fall',
    blurb:'They get what they wanted, in the order they wanted it, and it is not the same.',
    want:'ascend', obstacles:['crowd','authority','price'], climax:'revelation',
    resolution:'granted', motifAffinity:['coin','chair','name'], escalation:'steady' },

  { key:'tragedy', label:'The Fall', family:'Rise & Fall',
    blurb:'The flaw that made them capable is the flaw that finishes them.',
    want:'ascend', obstacles:['self','price','loyalty'], climax:'quiet-giving-in',
    resolution:'denied', motifAffinity:['watch','coldhand','coin'], escalation:'sharp' },

  { key:'corruption', label:'The Slow Rot', family:'Rise & Fall',
    blurb:'No single decision was wrong. The sum of them is unrecognisable.',
    want:'ascend', obstacles:['price','loyalty','self'], climax:'quiet-giving-in',
    resolution:'transformed', motifAffinity:['coin','beeswax','watch'], escalation:'creeping' },

  { key:'rebirth', label:'The Thaw', family:'Rise & Fall',
    blurb:'Someone frozen is warmed against their stated preference.',
    want:'release', obstacles:['self','secret','person'], climax:'quiet-giving-in',
    resolution:'transformed', motifAffinity:['light','song','beeswax'], escalation:'late' },

  { key:'redemption', label:'The Long Amends', family:'Rise & Fall',
    blurb:'The debt is payable. The question is whether anyone will accept payment.',
    want:'atone', obstacles:['person','evidence','self'], climax:'confrontation',
    resolution:'cost-paid', motifAffinity:['letter','name','phrase'], escalation:'steady' },

  { key:'sacrifice', label:'The Price Paid', family:'Rise & Fall',
    blurb:'They can have it, or someone else can be spared. Not both.',
    want:'protect', obstacles:['price','clock','authority'], climax:'threshold-crossed',
    resolution:'cost-paid', motifAffinity:['coldhand','bell','light'], escalation:'sharp' },

  // ── CONFLICT FAMILY ──────────────────────────────────────────────────────
  { key:'overcoming-monster', label:'The Thing in the Dark', family:'Conflict',
    blurb:'Something is eating the district. It has an address.',
    want:'protect', obstacles:['person','self','crowd'], climax:'confrontation',
    resolution:'granted', motifAffinity:['coldhand','bell','watchbell'], escalation:'sharp' },

  { key:'revenge', label:'The Debt Collected', family:'Conflict',
    blurb:'They have waited long enough to be precise about it.',
    want:'avenge', obstacles:['evidence','loyalty','self'], climax:'confrontation',
    resolution:'denied', motifAffinity:['coin','coldhand','name'], escalation:'creeping' },

  { key:'siege', label:'Hold the Door', family:'Conflict',
    blurb:'Nobody has to win. Someone has to not leave.',
    want:'hold', obstacles:['clock','crowd','price'], climax:'confrontation',
    resolution:'cost-paid', motifAffinity:['bell','watchbell','chair'], escalation:'ramping' },

  { key:'survival', label:'What It Takes', family:'Conflict',
    blurb:'The story is arithmetic: what is left, divided by how long.',
    want:'survive', obstacles:['clock','price','crowd'], climax:'accident',
    resolution:'cost-paid', motifAffinity:['coldhand','watch','light'], escalation:'ramping' },

  { key:'betrayal', label:'The Turned Coat', family:'Conflict',
    blurb:'It was one of them. It was always going to be one of them.',
    want:'prove', obstacles:['loyalty','secret','evidence'], climax:'revelation',
    resolution:'denied', motifAffinity:['letter','name','coin'], escalation:'creeping' },

  { key:'rivalry', label:'The Other Claim', family:'Conflict',
    blurb:'Two people, one thing, and a shared history that makes it worse.',
    want:'retrieve', obstacles:['person','crowd','loyalty'], climax:'confrontation',
    resolution:'transformed', motifAffinity:['coin','chair','phrase'], escalation:'ramping' },

  // ── MYSTERY FAMILY ───────────────────────────────────────────────────────
  { key:'whodunit', label:'The Question of Who', family:'Mystery',
    blurb:'A closed list of people, one of whom is lying with real skill.',
    want:'learn', obstacles:['secret','evidence','crowd'], climax:'revelation',
    resolution:'granted', motifAffinity:['letter','watch','name'], escalation:'steady' },

  { key:'locked-room', label:'No Way In', family:'Mystery',
    blurb:'The impossible part is not what happened. It is where.',
    want:'learn', obstacles:['evidence','authority','self'], climax:'revelation',
    resolution:'granted', motifAffinity:['key','watchbell','chair'], escalation:'late' },

  { key:'conspiracy', label:'What the Records Say', family:'Mystery',
    blurb:'The paperwork is immaculate, which is the first thing wrong with it.',
    want:'prove', obstacles:['authority','evidence','distance'], climax:'revelation',
    resolution:'postponed', motifAffinity:['letter','watch','light'], escalation:'creeping' },

  { key:'prophecy', label:'What Was Foretold', family:'Mystery',
    blurb:'Trying not to fulfil it is the mechanism by which it is fulfilled.',
    want:'protect', obstacles:['self','clock','secret'], climax:'accident',
    resolution:'denied', motifAffinity:['bell','watchbell','name'], escalation:'ramping' },

  { key:'doppelganger', label:'The Other One', family:'Mystery',
    blurb:'Someone is going around being them, and doing it well.',
    want:'prove', obstacles:['evidence','crowd','self'], climax:'confrontation',
    resolution:'transformed', motifAffinity:['name','light','phrase'], escalation:'sharp' },

  { key:'mistaken-identity', label:'The Wrong Name', family:'Mystery',
    blurb:'The correction gets harder to make every hour it is not made.',
    want:'confess', obstacles:['crowd','clock','self'], climax:'revelation',
    resolution:'cost-paid', motifAffinity:['name','letter','phrase'], escalation:'ramping' },

  // ── CAPER FAMILY ─────────────────────────────────────────────────────────
  { key:'heist', label:'The Take', family:'Caper',
    blurb:'A plan, a crew, and the exact point where the plan stops being useful.',
    want:'retrieve', obstacles:['clock','authority','loyalty'], climax:'accident',
    resolution:'cost-paid', motifAffinity:['coin','key','watch'], escalation:'ramping' },

  { key:'comedy-of-errors', label:'The Tangle', family:'Caper',
    blurb:'Everyone is being reasonable on the basis of wrong information.',
    want:'deliver', obstacles:['crowd','clock','secret'], climax:'accident',
    resolution:'transformed', motifAffinity:['letter','name','song'], escalation:'ramping' },

  { key:'fish-out-of-water', label:'Wrong Place', family:'Caper',
    blurb:'Every rule here is unwritten and they are breaking all of them.',
    want:'belong', obstacles:['crowd','authority','self'], climax:'quiet-giving-in',
    resolution:'transformed', motifAffinity:['chair','phrase','light'], escalation:'steady' },

  // ── INTIMATE FAMILY ──────────────────────────────────────────────────────
  { key:'coming-of-age', label:'First Winter', family:'Intimate',
    blurb:'A door closes behind them that they did not hear close.',
    want:'belong', obstacles:['self','crowd','price'], climax:'threshold-crossed',
    resolution:'transformed', motifAffinity:['light','song','beeswax'], escalation:'late' },

  { key:'forbidden-love', label:'Against the Grain', family:'Intimate',
    blurb:'The feeling is not the problem. The address of the feeling is.',
    want:'confess', obstacles:['authority','loyalty','crowd'], climax:'threshold-refused',
    resolution:'postponed', motifAffinity:['letter','light','song'], escalation:'ramping' },

  { key:'reunion', label:'The Return of the Missing', family:'Intimate',
    blurb:'They came back. Nobody agrees on what that obliges anyone to do.',
    want:'confess', obstacles:['person','self','secret'], climax:'confrontation',
    resolution:'postponed', motifAffinity:['chair','name','beeswax'], escalation:'late' },

  { key:'mentor-student', label:'What Is Passed Down', family:'Intimate',
    blurb:'The lesson lands only after it is too late to be a lesson.',
    want:'atone', obstacles:['self','price','loyalty'], climax:'quiet-giving-in',
    resolution:'transformed', motifAffinity:['key','watch','song'], escalation:'steady' },

  { key:'bottle', label:'One Room, One Night', family:'Intimate',
    blurb:'Nobody leaves, nothing arrives, and everything still changes.',
    want:'confess', obstacles:['self','person','clock'], climax:'confrontation',
    resolution:'transformed', motifAffinity:['chair','phrase','beeswax'], escalation:'ramping' },
];

// Motif tag lookup — connect archetype affinity keys to the real MOTIFS array
const MOTIF_KEY_HINTS = {
  coin:'coin', letter:'letter', beeswax:'beeswax', bell:'bell', watchbell:'watch bell',
  key:'key', name:'name', light:'light', song:'song', phrase:'phrase',
  coldhand:'cold', watch:'watch', chair:'chair',
};

function motifsForArchetype(arch, pool){
  if (!arch || !arch.motifAffinity) return pool;
  const hints = arch.motifAffinity.map(k => MOTIF_KEY_HINTS[k] || k);
  const matched = pool.filter(m => hints.some(h => (m.tag||'').toLowerCase().includes(h)));
  return matched.length >= 2 ? matched : pool;
}

// =============================================================================
// 3. STORY LEDGER — the memory that makes scenes causal
// =============================================================================
class StoryLedger {
  constructor(){
    this.knows   = [];   // FACTS the protagonist has learned (revelations only)
    this.has     = [];   // objects/leverage in hand
    this.lost    = [];   // things removed
    this.owes    = [];   // obligations incurred
    this.broken  = [];   // relationships damaged
    this.witness = [];   // who saw what
    this.deadline= null; // the clock, kept out of `knows` so revelations stay revelations
    this.log     = [];   // chronological beat record
  }
  add(bucket, item){
    if (!item) return item;
    const arr = this[bucket];
    if (arr && !arr.includes(item)) arr.push(item);
    return item;
  }
  last(bucket){ const a = this[bucket]; return a && a.length ? a[a.length-1] : null; }
  first(bucket){ const a = this[bucket]; return a && a.length ? a[0] : null; }
  any(bucket){ return this[bucket] && this[bucket].length > 0; }
  record(beatKey, summary){ this.log.push({ beat: beatKey, summary }); return summary; }
  snapshot(){
    return {
      knows: this.knows.slice(), has: this.has.slice(), lost: this.lost.slice(),
      owes: this.owes.slice(), broken: this.broken.slice(), witness: this.witness.slice(),
      deadline: this.deadline,
    };
  }
}

// =============================================================================
// 4. CONCRETE NOUNS — the ledger needs real objects, not abstractions
// =============================================================================
const OBJECTS = [
  'the ledger page', 'the sealed letter', 'the ring of keys', 'the bent coin',
  'the coat with the mended lining', 'the signed writ', 'the last of the lamp oil',
  'the child\'s drawing', 'the receipt nobody was supposed to keep', 'the spare key',
  'the map with the wrong river on it', 'the bottle put by for a better night',
  'the promissory note', 'the name written on the inside of the lid',
  'the watch that stopped in a specific hour', 'the bundle of unopened letters',
  'the deed to the room above the shop', 'the tally stick', 'the sealed jar',
  'the record of the crossing', 'the loaf kept back from the count',
];

const FACTS = [
  'the person who sent them is already dead',
  'the debt was settled years ago and someone kept collecting',
  'the room was empty an hour before it was said to be occupied',
  'the name on the writ is not the name of the person who signed it',
  'the door was never locked',
  'two people have been telling the same lie without coordinating',
  'the bell was rung early on purpose',
  'the payment was made, and made to the wrong hand',
  'the letter was opened and resealed, badly',
  'there was a witness, and the witness has been paid to be elsewhere',
  'the version everyone tells has one detail that could not have happened',
  'the thing they came to retrieve was given away freely',
  'somebody else asked the same question last week and got an answer',
  'the record was rewritten, and rewritten in a familiar hand',
];

const COSTS = [
  'a favour that cannot be asked for twice',
  'the good opinion of someone whose good opinion mattered',
  'a night\'s sleep and the last of the coin',
  'a door in this district that will not open again',
  'the version of themselves that could still claim not to have known',
  'the last person who would have vouched for them',
  'a place at a table they had been welcome at for years',
];

const RELIED_ON = [
  'the one person who was going to vouch for them',
  'the route out through the yard',
  'the money that was supposed to be waiting',
  'the assumption that there was still time',
  'the door that has been unlocked every night for six years',
  'the belief that the other party wanted the same ending',
];

// =============================================================================
// 5. BEAT SCRIPTORS
//    Each returns script elements AND mutates the ledger. Prose references
//    ledger entries explicitly — that reference IS the cohesion.
// =============================================================================
function nm(c){ return (c && (c.name?.first || c.first)) || 'they'; }

function S(kind, fields){ return Object.assign({ kind }, fields); }

const BEAT_SCRIPTORS = {

  'ordinary-world'(rng, spine, scene, L){
    const p = nm(spine.protag), out = [];
    const habit = rng.pick([
      'doing the thing they do at this hour every day',
      'finishing work that nobody has asked about in a year',
      'waiting, in the specific way that looks like not waiting',
      'counting something that does not need counting again',
    ]);
    out.push(S('action', { text:
      `${p} is at ${scene.location}, ${habit}. It is ${scene.time.label}; ${scene.weather}.` }));
    out.push(S('motif', { text: spine.motif.setup, motif_tag: spine.motif.tag }));
    out.push(S('internal', { who:p, text:
      `What ${p} wants is to ${spine.want}. It has not been said aloud, not even alone, but it is the shape the day is built around.` }));
    if (spine.antag){
      out.push(S('action', { text:
        `${nm(spine.antag)} is here too, on other business, or on business that is made to look like other business.` }));
      out.push(S('dialogue', { speaker: nm(spine.antag), line: rng.pick([
        `You're here early.`, `Still at it, then.`, `I didn't expect you today.`,
        `Nobody told me you'd be down here.`,
      ])}));
      out.push(S('dialogue', { speaker: p, line: rng.pick([
        `I could say the same.`, `It keeps.`, `Somebody has to be.`, `Not for long.`,
      ])}));
    }
    L.record('ordinary-world', `${p} established at ${scene.location}, wanting to ${spine.want}`);
    L.add('has', rng.pick(OBJECTS));
    out.push(S('beat', { note: `hold — the normal, before it stops being normal` }));
    return out;
  },

  'inciting-incident'(rng, spine, scene, L){
    const p = nm(spine.protag), out = [];
    const deadline = rng.pick([
      'before the next watch changes', 'by first bell', 'before the gate is sealed for the season',
      'tonight, or not at all', 'before the record is filed in the morning',
    ]);
    const held = L.last('has');
    out.push(S('action', { text:
      `Word reaches ${scene.location}: it has to be ${deadline}.` }));
    out.push(S('internal', { who:p, text:
      `The want stops being a preference. ${p} has ${held ? `${held} and ` : ''}less time than the plan assumed.` }));
    if (spine.antag){
      out.push(S('dialogue', { speaker: nm(spine.antag), line: rng.pick([
        `You know what that means.`, `That's not my doing.`, `Don't look at me like that.`,
        `You've got until the bell. Same as everyone.`,
      ])}));
    }
    out.push(S('action', { text: `The obstacle is plain now: ${spine.obstacle}.` }));
    L.deadline = deadline;
    L.record('inciting-incident', `deadline set — ${deadline}`);
    return out;
  },

  'commitment'(rng, spine, scene, L){
    const p = nm(spine.protag), out = [];
    const cost = L.add('owes', rng.pick(COSTS));
    out.push(S('action', { text:
      `${p} makes the decision at ${scene.location}, and makes it the way decisions actually get made — by doing one small irreversible thing.` }));
    const held = L.last('has');
    if (held) out.push(S('action', { text: `${held.charAt(0).toUpperCase()+held.slice(1)} changes hands, or changes pockets.` }));
    out.push(S('internal', { who:p, text:
      `It costs ${cost}. ${p} pays it without discussing it, which is how they will later be able to say they never agreed to anything.` }));
    if (spine.antag){
      out.push(S('dialogue', { speaker: p, line: rng.pick([
        `I'll do it.`, `Then it's me.`, `Fine. Say it's done.`, `Give me until the bell.`,
      ])}));
      out.push(S('dialogue', { speaker: nm(spine.antag), line: rng.pick([
        `You've thought about this for four seconds.`,
        `And when it goes wrong?`,
        `That's not a small thing you just said.`,
      ])}));
    }
    L.record('commitment', `committed; owes ${cost}`);
    return out;
  },

  'first-obstacle'(rng, spine, scene, L){
    const p = nm(spine.protag), out = [];
    out.push(S('action', { text:
      `The first attempt happens at ${scene.location}, and it fails — not dramatically, but in the flat administrative way real attempts fail.` }));
    out.push(S('action', { text: `${spine.obstacle.charAt(0).toUpperCase()+spine.obstacle.slice(1)}.` }));
    const owed = L.last('owes');
    out.push(S('internal', { who:p, text:
      `${p} learns the shape of the problem, which is worse than learning its size.${owed ? ` And ${owed} is already spent.` : ''}` }));
    if (spine.antag){
      out.push(S('dialogue', { speaker: nm(spine.antag), line: rng.pick([
        `I did tell you.`, `It was never going to be that.`, `You went at it from the front. Of course it held.`,
      ])}));
      out.push(S('dialogue', { speaker: p, line: rng.pick([
        `Then I'll go at it from somewhere else.`, `Don't.`, `I heard you the first time.`,
      ])}));
    }
    L.record('first-obstacle', 'direct attempt failed — the front route is closed');
    out.push(S('beat', { note: 'the pause after a plan stops being a plan' }));
    return out;
  },

  'midpoint-reversal'(rng, spine, scene, L){
    const p = nm(spine.protag), out = [];
    const fact = L.add('knows', rng.pick(FACTS));
    out.push(S('action', { text:
      `At ${scene.location}, ${scene.time.label}, it surfaces: ${fact}.` }));
    out.push(S('motif', { text: spine.motif.callback, motif_tag: spine.motif.tag }));
    out.push(S('internal', { who:p, text:
      `Everything ${p} has done since the bell was built on the opposite of that. The want does not go away. It changes address.` }));
    if (spine.antag){
      out.push(S('dialogue', { speaker: p, line: rng.pick([
        `How long have you known?`, `Say it again. Slowly.`, `You let me go on.`,
      ])}));
      out.push(S('dialogue', { speaker: nm(spine.antag), line: rng.pick([
        `Long enough that saying it now doesn't help either of us.`,
        `I thought you'd worked it out.`,
        `I was going to tell you after.`,
      ])}));
      L.add('broken', `${p} and ${nm(spine.antag)} — the withheld fact`);
    }
    L.record('midpoint-reversal', `learned: ${fact}`);
    return out;
  },

  'escalation'(rng, spine, scene, L){
    const p = nm(spine.protag), out = [];
    const fact = L.last('knows');
    const newCost = L.add('owes', rng.pick(COSTS));
    out.push(S('action', { text:
      `Knowing ${fact ? fact : 'what they now know'} does not make ${scene.location} easier to be in. It makes it more expensive.` }));
    out.push(S('action', { text: `The price goes up: now it also costs ${newCost}.` }));
    const support = spine.supporting?.[0];
    if (support){
      out.push(S('action', { text: `${nm(support)} arrives, and does not take the side everyone assumed.` }));
      out.push(S('dialogue', { speaker: nm(support), line: rng.pick([
        `I'm not doing this part with you.`, `You should have asked me first.`,
        `There's a version of this where nobody has to be ruined.`,
      ])}));
      L.add('broken', `${p} and ${nm(support)}`);
    } else if (spine.antag){
      out.push(S('dialogue', { speaker: nm(spine.antag), line: rng.pick([
        `You're going to make me do something neither of us wants.`,
        `Stop. While it's still a thing that can be stopped.`,
      ])}));
    }
    out.push(S('internal', { who:p, text:
      `${p} does the arithmetic and does not like it, and continues, which is the part that will be hard to explain afterwards.` }));
    L.record('escalation', `cost raised to include ${newCost}`);
    return out;
  },

  'crisis'(rng, spine, scene, L){
    const p = nm(spine.protag), out = [];
    const removed = L.add('lost', rng.pick(RELIED_ON));
    out.push(S('action', { text:
      `${removed.charAt(0).toUpperCase()+removed.slice(1)} is gone. Not taken — just gone, in the ordinary way things go.` }));
    const held = L.last('has');
    if (held) { L.add('lost', held); out.push(S('action', { text: `${held.charAt(0).toUpperCase()+held.slice(1)} goes with it.` })); }
    out.push(S('internal', { who:p, text:
      `Everything ${p} was going to do next required that. There is no version of the plan that survives it, and the bell has not moved.` }));
    out.push(S('beat', { note: 'all is lost — hold on the empty place where the plan was' }));
    if (spine.antag){
      out.push(S('dialogue', { speaker: nm(spine.antag), line: rng.pick([
        `So that's that, then.`, `I'm sorry. I mean that, and it doesn't help.`,
        `Go home. There's nothing here now.`,
      ])}));
      out.push(S('dialogue', { speaker: p, line: rng.pick([
        `No.`, `Not yet.`, `There's one more thing.`,
      ])}));
    }
    L.record('crisis', `lost ${removed}`);
    return out;
  },

  'climax'(rng, spine, scene, L){
    const p = nm(spine.protag), a = spine.antag ? nm(spine.antag) : null, out = [];
    // Prefer the midpoint revelation. Fall back to the clock only if the beat
    // sheet was too short to contain a reversal.
    const fact = L.last('knows') || L.deadline || 'what they came to find out';
    const owed = L.last('owes');
    const lost = L.last('lost');

    out.push(S('action', { text:
      `${scene.location}, ${scene.time.label}. Everything ${p} has spent — ${owed || 'the favours'}, ${lost || 'the route out'} — arrives at one moment.` }));

    switch (spine.climaxType){
      case 'confrontation':
        out.push(S('action', { text: `${p} says it to ${a || 'the room'} directly, with nothing held in reserve.` }));
        if (a){
          out.push(S('dialogue', { speaker: p, line: rng.pick([
            `Say it in front of them. Say the whole of it.`,
            `I know about ${fact}. Say it or I will.`,
            `You've had every chance to be the one who tells it.`,
          ])}));
          out.push(S('dialogue', { speaker: a, line: rng.pick([
            `And then what? You think that fixes the shape of it?`,
            `All right. All right. Yes.`,
            `You don't get to make me small in a room I built.`,
          ])}));
        }
        break;
      case 'revelation':
        out.push(S('action', { text: `${p} lays it out — ${fact} — in the order it happened, which is the only order that convinces anyone.` }));
        out.push(S('dialogue', { speaker: p, line: `It was never the door. It was the hour.` }));
        if (a) out.push(S('dialogue', { speaker: a, line: rng.pick([
          `Who else knows.`, `That's a hell of a thing to be right about.`, `You've ruined a lot to say that.`,
        ])}));
        break;
      case 'threshold-crossed':
        out.push(S('action', { text: `${p} goes through — the door, the gate, the sentence — and does not stop to be sure.` }));
        out.push(S('internal', { who:p, text: `The far side is not better. It is only further on, which was the whole requirement.` }));
        break;
      case 'threshold-refused':
        out.push(S('action', { text: `${p} gets to the edge of it, and stops, and stays stopped.` }));
        out.push(S('internal', { who:p, text: `Not fear. Arithmetic. The cost was always going to be paid by someone who was not in the room.` }));
        if (a) out.push(S('dialogue', { speaker: a, line: `You were one step away.` }));
        break;
      case 'quiet-giving-in':
        out.push(S('action', { text: `${p} stops holding the thing they have been holding since before this started.` }));
        if (a) out.push(S('dialogue', { speaker: p, line: rng.pick([
          `All right.`, `Then keep it.`, `I'm too tired to be right about this.`,
        ])}));
        break;
      case 'quiet-refusal':
        out.push(S('action', { text: `${p} declines, without raising anything, and it costs more than shouting would have.` }));
        break;
      default: // accident
        out.push(S('action', { text: `It goes wrong in a way nobody planned and everybody, afterwards, describes as inevitable.` }));
        out.push(S('beat', { note: 'the half-second in which it is still preventable' }));
    }

    out.push(S('motif', { text: spine.motif.final, motif_tag: spine.motif.tag }));
    L.record('climax', `${spine.climaxType} — resolution ${spine.resolutionShape}`);
    L.add('witness', a ? `${a} was present` : 'no one was present');
    return out;
  },

  'resolution'(rng, spine, scene, L){
    const p = nm(spine.protag), out = [];
    const shape = spine.resolutionShape;
    const lost = L.last('lost'), owed = L.first('owes'), fact = L.last('knows');
    // The "got it" phrasing has to match what was actually wanted — an answer
    // is not held in the hands, and a room is not carried home.
    const gotIt = {
      learn:   `${p} has the answer. It is smaller than the space it occupied.`,
      prove:   `${p} was believed. It took everything, and it worked, and it is not satisfying.`,
      confess: `${p} said it. The room registered it; nothing in the world rearranged.`,
      hold:    `${p} held. The relief came, late, to a room that had stopped expecting it.`,
      escape:  `${p} is out. The district goes on behind them without adjusting.`,
      belong:  `${p} was counted. Nobody remarked on it, which was the entire point.`,
      survive: `Everyone who was going to be breathing at the end of this is breathing.`,
      protect: `The thing ${p} stood in front of did not get through. That is all that can be said for it.`,
      atone:   `The apology stuck. It did not undo anything, which ${p} had been told and had not believed.`,
      avenge:  `The account is straight. ${p} had expected the straightening to feel like something.`,
      release: `${p} set it down. The hands take a while to understand they are empty.`,
    }[spine.wantClass] || `${p} got it, and it weighs what it always weighed, which is less than expected.`;

    const lines = {
      granted:    gotIt,
      denied:     `${p} did not get it. What they have instead is the certainty that it was never available.`,
      transformed:`${p} got something. It is not the thing they set out for, and it is not a consolation either.`,
      postponed:  `Nothing settled. It has been moved to a date, and the date is real, which is new.`,
      'cost-paid':`${gotIt} It cost ${owed || 'more than the asking price'}, and the arithmetic is not in dispute.`,
    };
    out.push(S('action', { text: scene.returned
      ? `Back at ${scene.location} — ${scene.time.label}, ${scene.weather}. The same room as the first hour, arranged slightly differently.`
      : `${scene.location} — ${scene.time.label}, ${scene.weather}. Not where this started, which is its own kind of report.` }));
    out.push(S('action', { text: lines[shape] || lines.transformed }));
    if (lost) out.push(S('internal', { who:p, text: `${lost.charAt(0).toUpperCase()+lost.slice(1)} does not come back. That is the part that will take the longest.` }));
    if (fact) out.push(S('internal', { who:p, text: `And ${fact} — now known, unusably, permanently.` }));
    out.push(S('motif', { text: spine.motif.final, motif_tag: spine.motif.tag }));
    out.push(S('beat', { note: 'hold — the new normal, measured against the old one' }));
    L.record('resolution', shape);
    return out;
  },

  'coda'(rng, spine, scene, L){
    const p = nm(spine.protag), out = [];
    const lost = L.last('lost');
    out.push(S('action', { text: `Later. ${scene.location}, empty, ${scene.weather}.` }));
    out.push(S('beat', { note: 'no dialogue — one image, held' }));
    out.push(S('action', { text: lost
      ? `Where ${lost} used to be, there is the ordinary furniture of a place that has stopped noticing.`
      : `The room does what rooms do after people have finished having things out in them.` }));
    out.push(S('motif', { text: spine.motif.final, motif_tag: spine.motif.tag }));
    L.record('coda', 'cost reported without comment');
    return out;
  },
};

// Escalation curves shape the tension ramp
const CURVES = {
  steady:   t => t,
  sharp:    t => Math.pow(t, 0.7),
  late:     t => Math.pow(t, 1.6),
  creeping: t => 0.25 + t * 0.75,
  ramping:  t => t * t * 0.6 + t * 0.4,
};

// =============================================================================
// 6. SCENE CONSTRUCTION — continuity-aware
// =============================================================================
function makeScene2(rng, beat, spine, sceneIdx, totalScenes, tone, L, geo){
  const progress = totalScenes > 1 ? sceneIdx / (totalScenes - 1) : 0;

  // ── LOCATION CONTINUITY ────────────────────────────────────────────────
  // An episode holds a primary location. It may move at most twice, and only
  // at beats where a move is dramatically motivated.
  const MOVE_BEATS = { 'midpoint-reversal':1, 'climax':1 };
  const RETURN_BEATS = { 'resolution':1, 'coda':1 };
  let stage = geo.stage, location = geo.location;
  let returned = false;

  if (sceneIdx === 0){
    stage = geo.stage; location = geo.location;
  } else if (RETURN_BEATS[beat.key]){
    // Come home. A resolution is only legible against the ordinary world, so
    // it plays in the room the episode opened in.
    returned = true;
    if (geo.location !== geo.homeLocation){
      stage = geo.homeStage; location = geo.homeLocation;
      geo.stage = stage; geo.location = location;
      geo.justMoved = true;
    } else {
      geo.justMoved = false;
    }
  } else if (MOVE_BEATS[beat.key] && geo.moves < 2){
    stage = rng.pick(HOST.STAGES);
    location = rng.pick(HOST.LOCATIONS[stage]);
    geo.stage = stage; geo.location = location; geo.moves++;
    geo.justMoved = true;
  } else {
    geo.justMoved = false;
  }

  // ── TIME: monotonic ────────────────────────────────────────────────────
  const T = HOST.TIMES;
  const startIdx = geo.startTimeIdx;
  const span = Math.min(T.length - 1 - startIdx, Math.max(3, Math.round((T.length-1) * 0.7)));
  const timeIdx = Math.min(T.length - 1, startIdx + Math.round(progress * span));
  const time = T[Math.max(timeIdx, geo.lastTimeIdx)];
  geo.lastTimeIdx = Math.max(timeIdx, geo.lastTimeIdx);

  // ── WEATHER: persists, drifts once or twice ────────────────────────────
  if (sceneIdx === 0) geo.weather = geo.weather || rng.pick(HOST.WEATHER);
  else if (rng.bool(0.22)) geo.weather = rng.pick(HOST.WEATHER);
  const weather = geo.weather;

  // ── TENSION: archetype curve, not a lookup ─────────────────────────────
  const curve = CURVES[spine.escalation] || CURVES.steady;
  const tensionNum = Math.max(0.12, Math.min(0.99,
    beat.tension * 0.72 + curve(progress) * 0.28 + (rng.next() - 0.5) * 0.05));

  // ── CAST PRESENCE: driven by the beat's dramatic job ───────────────────
  const needsAntag = ['inciting-incident','midpoint-reversal','escalation','climax'].includes(beat.key);
  const solo = ['ordinary-world','coda'].includes(beat.key) && rng.bool(0.45);
  let presentCast = [spine.protag];
  if (spine.antag && needsAntag) presentCast.push(spine.antag);
  else if (spine.antag && !solo && rng.bool(0.55)) presentCast.push(spine.antag);
  if (spine.supporting?.length && beat.key === 'escalation') presentCast.push(spine.supporting[0]);

  const scene = {
    title: (HOST.makeSceneTitle ? HOST.makeSceneTitle(rng) : beat.label),
    role: beat.key,
    beat: beat.key,
    beat_label: beat.label,
    beat_job: beat.job,
    tone,
    stage, location, time, weather, tensionNum,
    moved: !!geo.justMoved, returned,
    seed: 'scene_' + Math.floor(rng.next() * 1e9).toString(36),
    cast: presentCast.map(c => ({
      first: c.name?.first || c.first,
      name:  c.name?.full  || c.name?.first || c.first,
      zone: c.zone, subtype: c.subtype, class: c.class, stamp: c.stamp,
      physical: c.physical, seed: c.seed, archetype: c.archetype,
    })),
  };

  // ── SCRIPT ─────────────────────────────────────────────────────────────
  const scriptor = BEAT_SCRIPTORS[beat.key.replace(/-\d+$/,'')] || BEAT_SCRIPTORS['escalation'];
  scene.script = scriptor(rng, spine, scene, L);

  // Narrate the move so the audience is not teleported
  if (geo.justMoved){
    scene.script.unshift(S('action', { text: returned
      ? `Back across the city, to ${location}, where this started. The walk is not shown; the arriving is.`
      : `They move — out of ${geo.prevLocation}, across to ${location}. The walk is not shown; the arriving is.` }));
    geo.justMoved = false;
  }
  geo.prevLocation = location;

  scene.ledger_after = L.snapshot();
  scene.beats = scene.script.map(s => ({
    label: s.kind.charAt(0).toUpperCase() + s.kind.slice(1),
    prose: s.text || s.line || s.note || '',
  }));
  return scene;
}

// =============================================================================
// 7. SEASON CONSTRUCTION — episodes now chain
// =============================================================================
function pickArchetype(rng, params, epIndex, arcArchetype){
  if (params.archetype && params.archetype !== 'auto' && params.archetype !== 'mixed'){
    return ARCHETYPES.find(a => a.key === params.archetype) || ARCHETYPES[0];
  }
  if (params.archetype === 'mixed'){
    // Mixed: keep the season's family, vary the archetype within it
    const fam = arcArchetype.family;
    const inFam = ARCHETYPES.filter(a => a.family === fam);
    return rng.pick(inFam.length ? inFam : ARCHETYPES);
  }
  return arcArchetype;
}

function fillWant(template, protag, antag, obj){
  // OBJECTS already carry their article ("the ring of keys"), so swallow any
  // article the template supplies — otherwise: "get back the the ring of keys".
  return template
    .replace(/\b(the|a|an)\s+\{obj\}/g, '{obj}')
    .replace('{obj}', obj || 'the thing')
    .replace('{antag}', antag ? nm(antag) : 'whoever is standing in the way')
    .replace('{protag}', nm(protag));
}

function buildSpine(rng, arch, featuredCast, epIndex, motif, throughLine, tone, seasonState){
  const protag = featuredCast[0];
  const antag  = featuredCast[1] || null;
  const supporting = featuredCast.slice(2);

  // Want: draw WITHOUT replacement across the season. A want-class only holds
  // three phrasings, so sampling repeats inside a six-episode run.
  const obj = seasonState.objects.length
    ? seasonState.objects.splice(rng.int(0, seasonState.objects.length - 1), 1)[0]
    : rng.pick(OBJECTS);
  const wantPool = W[arch.want] || W.deliver;
  if (!seasonState.wants[arch.want] || !seasonState.wants[arch.want].length){
    seasonState.wants[arch.want] = wantPool.slice();
  }
  const bag = seasonState.wants[arch.want];
  const template = bag.splice(rng.int(0, bag.length - 1), 1)[0];
  const want = fillWant(template, protag, antag, obj);

  // Obstacle: ROTATE by episode index rather than sampling. Random draws from a
  // 3-item list cluster badly — a six-episode season would repeat one obstacle
  // verbatim three or four times.
  let pool = arch.obstacles;
  if (!antag){
    // With a solo protagonist there is nobody for a person-shaped obstacle to
    // point at. Keep the archetype's own solo-safe classes, then top the pool
    // up — filtering alone can leave a single class, which then repeats weekly.
    pool = pool.filter(k => SOLO_SAFE_OBSTACLES.includes(k));
    for (const k of SOLO_SAFE_OBSTACLES){
      if (pool.length >= 3) break;
      if (!pool.includes(k)) pool.push(k);
    }
  }
  const obsKey = pool[epIndex % pool.length];
  const obstacle = O[obsKey]({ p: nm(protag), a: antag ? nm(antag) : null });

  // Late-season episodes inherit unfinished business from earlier ones
  const inherited = seasonState.openThreads.length && epIndex > 0
    ? seasonState.openThreads[seasonState.openThreads.length - 1] : null;

  return {
    protag, antag, supporting,
    archetype: arch.key, archetype_label: arch.label, family: arch.family,
    want, wantClass: arch.want, obstacle, obstacleClass: obsKey, object: obj,
    motif, climaxType: arch.climax, resolutionShape: resolutionForEpisode(arch, epIndex, seasonState.total, rng),
    escalation: arch.escalation, throughLine, tone, inherited,
  };
}

// Obstacle classes that read correctly with no antagonist on screen.
const SOLO_SAFE_OBSTACLES = ['clock','price','distance','crowd','evidence','self'];

// A season must not land the same ending every week. The archetype's canonical
// resolution is reserved for the finale; earlier episodes get shapes that leave
// the season's question open.
const INTERIM_SHAPES = {
  granted:     ['cost-paid','postponed','transformed','denied'],
  denied:      ['postponed','cost-paid','transformed','denied'],
  transformed: ['postponed','denied','cost-paid','granted'],
  postponed:   ['denied','cost-paid','transformed','granted'],
  'cost-paid': ['postponed','transformed','denied','granted'],
};

function resolutionForEpisode(arch, i, total, rng){
  if (!total || total < 2) return arch.resolution;
  if (i === total - 1) return arch.resolution;   // finale keeps the archetype's contract
  // Strip the archetype's own ending from the interim pool. It belongs to the
  // finale alone — otherwise episode five pre-empts the season's landing.
  const pool = (INTERIM_SHAPES[arch.resolution] || INTERIM_SHAPES.transformed)
    .filter(s => s !== arch.resolution);
  if (i === 0){
    // Pilot opens the door — but must not duplicate what episode two will land on.
    const second = pool[0];
    const opener = ['postponed','cost-paid'].filter(s => s !== second);
    return opener.length ? opener[rng.int(0, opener.length - 1)] : pool[1];
  }
  return pool[(i - 1) % pool.length];
}

function generateArc2(rng, params, cast){
  const tone = params.tone || 'literary';

  if (tone === 'comic' && HOST.VOICE_ARCHETYPES){
    const keys = Object.keys(HOST.VOICE_ARCHETYPES);
    cast.forEach((c,i) => { if (!c.archetype) c.archetype = keys[i % keys.length]; });
  }

  // Season archetype
  const seasonArch = (params.archetype && params.archetype !== 'auto' && params.archetype !== 'mixed')
    ? (ARCHETYPES.find(a => a.key === params.archetype) || rng.pick(ARCHETYPES))
    : rng.pick(ARCHETYPES);

  const arcTitle   = rng.pick(HOST.ARC_TITLE_PATTERNS)(rng);
  const throughLine= rng.pick(HOST.THROUGH_LINES)();
  const premise    = `${seasonArch.blurb} ${rng.pick(HOST.ARC_PREMISES)({ rng, cast, theme: params.theme })}`;

  const N = params.episodes;
  const motifSourceAll = tone === 'comic' ? (HOST.COMIC_MOTIFS || HOST.MOTIFS) : HOST.MOTIFS;
  const motifPool = motifsForArchetype(seasonArch, motifSourceAll).slice();
  const usedMotifs = new Set();

  const seasonState = {
    openThreads: [], seasonLedger: new StoryLedger(),
    total: N,                 // so resolution shapes can reserve the finale
    wants: {},                // per want-class bags, drawn without replacement
    objects: OBJECTS.slice(), // ditto for concrete objects
  };
  const episodes = [];

  for (let i = 0; i < N; i++){
    const epSeed = rng._seedStr + '::ep::' + i;
    const epRng  = new HOST.RNG(epSeed);
    const arch   = pickArchetype(epRng, params, i, seasonArch);

    // Rotate protagonist so different characters carry different episodes
    const rotated = cast.slice(i % cast.length).concat(cast.slice(0, i % cast.length));
    const featuredCount = Math.min(3, rotated.length, Math.max(2, epRng.int(2,3)));
    const featuredCast = rotated.slice(0, featuredCount);

    // Motif without replacement. The archetype-affinity pool is small, so when
    // it runs dry, top up from the full list minus everything already used —
    // otherwise a six-episode season repeats a motif it has already retired.
    if (!motifPool.length){
      const unused = motifSourceAll.filter(m => !usedMotifs.has(m.tag));
      motifPool.push(...(unused.length ? unused : motifSourceAll));
    }
    const motif = motifPool.splice(epRng.int(0, motifPool.length - 1), 1)[0];
    usedMotifs.add(motif.tag);

    const spine = buildSpine(epRng, arch, featuredCast, i, motif, throughLine, tone, seasonState);

    const numScenes = params.scenesPerEpisode || 6;
    const beats = assignBeats(numScenes);

    // Per-episode ledger, seeded with what the season already established
    const L = new StoryLedger();
    if (spine.inherited) L.add('knows', spine.inherited);

    // Geography state — this is what stops teleporting
    const stage0 = epRng.pick(HOST.STAGES);
    const geo = {
      stage: stage0,
      location: epRng.pick(HOST.LOCATIONS[stage0]),
      prevLocation: null,
      moves: 0,
      startTimeIdx: epRng.int(0, Math.max(0, Math.floor(HOST.TIMES.length * 0.35))),
      lastTimeIdx: 0,
      weather: null,
      justMoved: false,
    };
    geo.homeStage = geo.stage;
    geo.homeLocation = geo.location;
    geo.lastTimeIdx = geo.startTimeIdx;
    geo.prevLocation = geo.location;

    const scenes = [];
    for (let j = 0; j < numScenes; j++){
      const sRng = new HOST.RNG(epSeed + '::sc::' + j);
      scenes.push(makeScene2(sRng, beats[j], spine, j, numScenes, tone, L, geo));
    }

    // Carry one unresolved thread forward
    const carry = L.last('owes') || L.last('lost') || L.last('knows');
    if (carry) seasonState.openThreads.push(carry);

    const p = nm(spine.protag);
    const a = spine.antag ? nm(spine.antag) : (tone==='comic' ? 'the universe' : 'the night itself');
    const logline = `${p} sets out to ${spine.want}, and ${spine.obstacle}. ` +
      ({ granted:`They get it, and find out what it weighs.`,
         denied:`They do not get it, and find out it was never on offer.`,
         transformed:`What they end up holding is not what they went for.`,
         postponed:`Nothing settles; a date gets set, and the date is real.`,
         'cost-paid':`They get it, and the bill comes in the same night.` }[spine.resolutionShape]
         || `The want changes shape by the end of the night.`);

    episodes.push({
      number: `1.${(i+1).toString().padStart(2,'0')}`,
      position: BEATS[Math.min(i, BEATS.length-1)].key,
      position_label: arch.label.toUpperCase(),
      title: epRng.pick(HOST.EP_TITLE_PATTERNS)(epRng),
      logline, tone,
      archetype: arch.key,
      archetype_label: arch.label,
      archetype_family: arch.family,
      archetype_blurb: arch.blurb,
      spine: {
        protag: p, antag: spine.antag ? nm(spine.antag) : null,
        want: spine.want, obstacle: spine.obstacle, object: spine.object,
        motif: spine.motif.tag,
        climax_type: spine.climaxType,
        resolution_shape: spine.resolutionShape,
        archetype: arch.key,
        inherited_from_previous: spine.inherited || null,
      },
      beat_sheet: beats.map((b,ix) => ({ n: ix+1, key: b.key, label: b.label, job: b.job })),
      continuity: {
        primary_location: geo.location, stage: geo.stage,
        location_moves: geo.moves,
        ledger: L.snapshot(),
        beat_log: L.log.slice(),
      },
      featured_cast: featuredCast.map(c=>({
        first: c.name?.first || c.first, name: c.name?.full || c.name?.first,
        zone: c.zone, subtype: c.subtype, archetype: c.archetype,
      })),
      stakes_intensity: 0.35 + (i / Math.max(1, N-1)) * 0.55,
      scenes, seed: epSeed,
    });
  }

  return {
    title: arcTitle, premise, through_line: throughLine,
    theme: params.theme, tone, episode_count: N,
    archetype: seasonArch.key,
    archetype_label: seasonArch.label,
    archetype_family: seasonArch.family,
    season_threads: seasonState.openThreads,
    engine: 'story-engine-v2',
    cast: cast.map(c=>({
      first: c.name?.first || c.first, name: c.name?.full,
      zone: c.zone, subtype: c.subtype, class: c.class, stamp: c.stamp,
      physical: c.physical, seed: c.seed, archetype: c.archetype,
    })),
    episodes, seed: rng._seedStr, timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// 8. INSTALL
// =============================================================================
globalThis.StoryEngineV2 = {
  ARCHETYPES, BEATS, CODA_BEAT, StoryLedger, BEAT_SCRIPTORS,
  assignBeats, generateArc: generateArc2, makeScene: makeScene2,
  OBJECTS, FACTS, COSTS, RELIED_ON, WANT_CLASSES: W, OBSTACLE_CLASSES: O,
};

// Override the originals. EpiGen resolves these through the global scope at
// call time, so reassignment takes effect without touching the inline script.
globalThis.generateArc = generateArc2;

console.log('[story-engine] v2 installed —', ARCHETYPES.length, 'archetypes,', BEATS.length, 'beats');

})();
