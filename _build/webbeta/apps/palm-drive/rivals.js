/* =============================================================================
   PALM DRIVE — RIVAL EXPANSION v3
   Difficulty tiers + racecraft AI

   Loaded AFTER the inline game script. Overrides:
     globalThis.spawnRivals
     globalThis.updateRivals

   WHY THE OLD FIELD WAS UNLOSABLE
   NOTES.txt records that skill was cut from 0.85-1.00 down to 0.575-0.70
   because "the field beat the player by half a lap every race". That was true
   at the time — but the same notes record the real cause: rivals were spawned
   at trackLength-N, which read as almost a full lap AHEAD. That bug was fixed.
   The skill cut was a workaround for a bug that no longer exists, so it was
   left over-compensating: the field now runs ~60% pace and cannot threaten
   anyone. This file restores a real skill band and puts the tuning behind
   explicit difficulty tiers instead of a single hard-coded compromise.

   The rivals also could not RACE. They drove a fixed line at a fixed fraction
   of top speed and never reacted to the player. Now each has a temperament
   that changes what they do when you are near them.
   ========================================================================== */
(function(){
'use strict';

// Host bindings — the inline script declares these with const/let, so they are
// global lexical bindings and are NOT reachable via globalThis.
const HOST = {
  RIVALS, TRACKS, MAX_SPEED, SEG_LEN, G,
  get rivals(){ return rivals; },
  set rivals(v){ rivals = v; },
  get segments(){ return segments; },
  get trackLength(){ return trackLength; },
  // CAREER is `let` in the inline script — a global lexical binding, so it is
  // NOT reachable as globalThis.CAREER. Bridge it through a live getter or the
  // difficulty tier silently fails to persist.
  get CAREER(){ return CAREER; },
  saveCareer,
  findSegment, increase, interp, limit,
};
globalThis.PDHost = HOST;

// =============================================================================
// 1. DIFFICULTY TIERS
//    `pace` multiplies every rival's base skill. `aggression` scales how much
//    racecraft they use. `catchup` is the rubber band — deliberately weak, and
//    it only ever helps a rival who has fallen behind THE FIELD, never one who
//    is ahead of you. You cannot be hunted down by a car you lapped.
// =============================================================================
const TIERS = {
  rookie:   { key:'rookie',   label:'ROOKIE',   pace:0.88, aggression:0.35, catchup:0.30,
              blurb:'The field will wait for you. Learn the circuits here.' },
  pro:      { key:'pro',      label:'PRO',      pace:1.00, aggression:0.75, catchup:0.55,
              blurb:'They defend their line and they punish a scruffy lap.' },
  // 1.045 puts the quickest rival at ~0.90 — level with a near-ideal human lap.
  // Winning is possible, but only just, and only on circuits that suit you.
  fracture: { key:'fracture', label:'FRACTURE', pace:1.045, aggression:1.00, catchup:0.75,
              blurb:'Race clean or finish sixth. No allowances are made.' },
};
const DEFAULT_TIER = 'pro';

function tier(){
  const C = HOST.CAREER;
  const k = (C && C.tier) || DEFAULT_TIER;
  return TIERS[k] || TIERS[DEFAULT_TIER];
}

// =============================================================================
// 2. RIVAL TEMPERAMENTS
//    Base skills restored to a real band. At PRO these run 0.79-0.88 of top
//    speed, which is quick enough that an untidy lap loses places.
//
//    Each rival also gets a temperament that changes their behaviour when the
//    player is close, and a `bias` per track type so the running order is not
//    identical at every circuit.
// =============================================================================
const TEMPERAMENTS = {
  // Blocks. Moves to cover the inside line when you are right behind.
  blocker: {
    label:'defends the line',
    onDuel(r, ctx){
      if (ctx.playerBehind && ctx.gap < 1.4){
        r.targetOffset = HOST.limit(ctx.playerOffset, -0.75, 0.75);
        r.paceMod *= 1.02;               // small tow-defence lift
      }
    },
  },
  // Late-race. Slow early, materially faster in the final lap.
  closer: {
    label:'strong late',
    onLap(r, ctx){
      r.paceMod *= ctx.finalLap ? 1.085 : (ctx.firstLap ? 0.955 : 1.0);
    },
  },
  // Punishes mistakes. Lifts pace while you are off-road or slow.
  opportunist: {
    label:'punishes mistakes',
    onDuel(r, ctx){
      if (ctx.playerOffroad || ctx.playerSlow) r.paceMod *= 1.07;
    },
  },
  // Slipstreams. Gains when tucked in behind anyone.
  drafter: {
    label:'works the tow',
    onDuel(r, ctx){
      if (ctx.tow) r.paceMod *= 1.06;
    },
  },
  // Consistent. No tricks, never makes an error, never fades.
  metronome: {
    label:'never makes an error',
    onLap(r){ r.wobAmp = 0.012; },       // almost no pace drift
  },
  // Erratic. Genuinely fast but throws away time at random.
  wildcard: {
    label:'quick but erratic',
    onLap(r, ctx){
      r.wobAmp = 0.075;
      if (ctx.newLap && Math.random() < 0.30) r.mistakeT = 1.1 + Math.random();
    },
  },
};

// Base skill band + temperament + per-circuit bias.
// bias keys match TRACKS[].id, value is a multiplier on pace at that circuit.
// ⚠ THE FIELD MUST STRADDLE THE PLAYER'S RANGE, NOT SIT ABOVE IT.
// A competent human sustains roughly 0.62 (scruffy) to 0.90 (near-ideal) of
// top speed over a race. A narrow band — the first attempt used 0.812-0.880 —
// puts every rival above an average driver at once, so results cliff-edge from
// "win everything" to "last every time" with nothing in between. Spreading the
// six across 0.66-0.86 is what makes each finishing position mean something.
const PROFILE = {
  'VOSS':    { skill:0.860, temperament:'blocker',     bias:{ nightgate:1.03, meridian:0.99 },
               tag:'the one to beat' },
  'HALCYON': { skill:0.832, temperament:'drafter',     bias:{ meridian:1.05, nightgate:0.97 },
               tag:'quickest in a straight line' },
  'M. REY':  { skill:0.790, temperament:'closer',      bias:{ thecollapse:1.04 },
               tag:'never beaten on the last lap' },
  'ODA':     { skill:0.760, temperament:'opportunist', bias:{ nightgate:1.04 },
               tag:'waits for you to get it wrong' },
  'BRAKE':   { skill:0.700, temperament:'metronome',   bias:{ palmcoast:1.02 },
               tag:'the same lap, every lap' },
  'PALOMA':  { skill:0.660, temperament:'wildcard',    bias:{ thecollapse:1.06, meridian:0.96 },
               tag:'brilliant or nowhere' },
};

// Apply the profile onto the host's RIVALS array. It is a const, so we mutate
// the existing objects in place rather than reassigning.
HOST.RIVALS.forEach(r => {
  const p = PROFILE[r.name];
  if (!p) return;
  r.baseSkill   = p.skill;
  r.skill       = p.skill;
  r.temperament = p.temperament;
  r.bias        = p.bias || {};
  r.tag         = p.tag;
  r.tempLabel   = TEMPERAMENTS[p.temperament].label;
});

// =============================================================================
// 3. SPAWN
// =============================================================================
function spawnRivals2(def){
  const T = tier();
  const out = [];
  HOST.RIVALS.forEach((r, i) => {
    const bias = (r.bias && r.bias[def.id]) || 1;
    out.push({
      name:r.name, col:r.col,
      baseSkill: r.baseSkill,
      // Effective skill = base × tier pace × circuit bias
      skill: r.baseSkill * T.pace * bias,
      temperament: r.temperament,
      tempLabel: r.tempLabel,
      tag: r.tag,
      // Grid: positive offsets from the start line. (See NOTES.txt — negative
      // offsets read as a lap ahead and made the player permanently last.)
      z:(i+1)*HOST.SEG_LEN*1.6,
      lap:1,
      offset:(i%2?.42:-.42)+(i*.06-.15),
      targetOffset:0,
      speed:0, target:0,
      lapStart:0, best:0, finished:false, finishT:0, isRival:true,
      paceMod:1, wobAmp:0.04, mistakeT:0, wob:Math.random()*99,
      lastLapSeen:1,
    });
  });
  HOST.rivals = out;
  for (const r of HOST.rivals){
    r.z = HOST.increase(r.z, 0, HOST.trackLength);
    const s = HOST.findSegment(r.z);
    s.rivals = s.rivals || [];
  }
}

// =============================================================================
// 4. RACE AI
// =============================================================================
function updateRivals2(dt){
  const T = tier();
  const segs = HOST.segments;
  for (const s2 of segs) if (s2.rivals) s2.rivals.length = 0;

  const rl = HOST.rivals;
  const G = HOST.G;
  const playerProg = (G.lap - 1) * HOST.trackLength + G.pos;
  const playerSpeedPct = G.speed / HOST.MAX_SPEED;
  const finalLap = G.lap >= G.laps;

  // Field average progress, for the catch-up band
  let sum = 0, live = 0;
  for (const r of rl){ if (!r.finished){ sum += (r.lap-1)*HOST.trackLength + r.z; live++; } }
  const fieldAvg = live ? sum / live : 0;

  for (const r of rl){
    if (r.finished) continue;
    const seg   = HOST.findSegment(r.z);
    const ahead = HOST.findSegment(r.z + HOST.SEG_LEN * 8);
    const bend  = Math.abs(ahead.curve);
    const prog  = (r.lap - 1) * HOST.trackLength + r.z;

    // ── reset per-frame modifiers ────────────────────────────────────────
    r.paceMod = 1;
    r.targetOffset = null;

    // ── temperament: per-lap effects ─────────────────────────────────────
    const newLap = r.lap !== r.lastLapSeen;
    const temp = TEMPERAMENTS[r.temperament];
    if (temp && temp.onLap){
      temp.onLap(r, { finalLap, firstLap: r.lap === 1, newLap });
    }
    r.lastLapSeen = r.lap;

    // ── duelling: only when the player is genuinely near ─────────────────
    const dz  = playerProg - prog;                  // >0 player ahead
    const gap = Math.abs(dz) / HOST.SEG_LEN;
    if (gap < 6 && temp && temp.onDuel){
      // Is this rival tucked behind another car? (tow)
      let tow = false;
      for (const o of rl){
        if (o === r || o.finished) continue;
        const od = ((o.lap-1)*HOST.trackLength + o.z) - prog;
        if (od > 0 && od < HOST.SEG_LEN*5 && Math.abs(o.offset - r.offset) < 0.4) tow = true;
      }
      temp.onDuel(r, {
        gap,
        playerBehind: dz < 0,
        playerAhead:  dz > 0,
        playerOffset: G.playerX,
        playerOffroad: !!G.offroad,
        playerSlow: playerSpeedPct < 0.55,
        tow, finalLap,
      });
      // aggression scales how much of the temperament actually lands
      r.paceMod = 1 + (r.paceMod - 1) * T.aggression;
    }

    // ── catch-up: helps a rival adrift of the FIELD, never one ahead of you
    if (T.catchup > 0){
      const behindField = fieldAvg - prog;
      if (behindField > HOST.SEG_LEN * 10 && dz > 0){
        const amount = Math.min(0.10, (behindField / (HOST.trackLength * 0.5)) * 0.10);
        r.paceMod *= 1 + amount * T.catchup;
      }
    }

    // ── mistakes (wildcard temperament) ──────────────────────────────────
    if (r.mistakeT > 0){
      r.mistakeT -= dt;
      r.paceMod *= 0.80;
    }

    // ── pace ─────────────────────────────────────────────────────────────
    r.wob += dt * 0.35;
    const form = 1 + Math.sin(r.wob) * (r.wobAmp || 0.04);
    const targetSpd = HOST.MAX_SPEED * r.skill * r.paceMod * form
                      * (1 - Math.min(0.42, bend * 0.085));
    r.speed = HOST.interp(r.speed, targetSpd, 0.02);

    // ── line: racing line, unless the temperament asked for a defence ────
    const racingLine = HOST.limit(-ahead.curve * 0.16, -0.7, 0.7);
    const wanted = (r.targetOffset === null || r.targetOffset === undefined)
      ? racingLine : r.targetOffset;
    r.offset = HOST.interp(r.offset, wanted, 0.02 * r.skill);

    // don't stack on each other
    for (const o of rl){
      if (o === r || o.finished) continue;
      if (Math.abs(o.z - r.z) < HOST.SEG_LEN*2 && Math.abs(o.offset - r.offset) < 0.35)
        r.offset += (r.offset > o.offset ? 1 : -1) * 0.02;
    }
    // and don't plough through traffic
    for (const c of seg.cars)
      if (Math.abs(c.offset - r.offset) < 0.4){
        r.offset += (r.offset > c.offset ? 1 : -1) * 0.05;
        r.speed *= 0.995;
      }
    r.offset = HOST.limit(r.offset, -0.92, 0.92);

    const prev = r.z;
    r.z = HOST.increase(r.z, dt * r.speed, HOST.trackLength);
    if (r.z < prev){
      r.lap++;
      if (r.lap > G.laps){ r.finished = true; r.finishT = G.raceT; }
      // notify the announcer that a rival completed a lap
      if (globalThis.Ned) Ned.onRivalLap(r);
    }
    const ns = HOST.findSegment(r.z);
    (ns.rivals = ns.rivals || []).push(r);
  }
}

// =============================================================================
// 5. INSTALL
// =============================================================================
globalThis.PalmRivals = {
  TIERS, DEFAULT_TIER, PROFILE, TEMPERAMENTS,
  tier, spawnRivals: spawnRivals2, updateRivals: updateRivals2,
  setTier(k){
    if (!TIERS[k]) return false;
    const C = HOST.CAREER;
    if (C){ C.tier = k; try { HOST.saveCareer(); } catch(e){} }
    return true;
  },
};

globalThis.spawnRivals  = spawnRivals2;
globalThis.updateRivals = updateRivals2;

console.log('[palm-drive] rivals v3 —', Object.keys(TIERS).length, 'tiers, skill band',
  Math.min(...HOST.RIVALS.map(r=>r.baseSkill)).toFixed(3), '-',
  Math.max(...HOST.RIVALS.map(r=>r.baseSkill)).toFixed(3));

})();
