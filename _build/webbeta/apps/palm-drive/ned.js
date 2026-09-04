/* =============================================================================
   PALM DRIVE — NEWSMAN NED, ANNOUNCER
   plus the CAMPAIGN with a dynamic nemesis arc

   Loaded AFTER rivals.js.

   VOICE (canon — see apps/works/data/book.json, ch.21 "THE MONK WHO DID NOT
   BROADCAST"). Ned covers Fracture City with a microphone and a practiced
   calm. He addresses the audience as "citizens". He nods to the lens. He
   narrates what can be confirmed and avoids what cannot, and when the facts
   run out he says so on air rather than filling the gap.

     "Good afternoon, citizens. We appear to be witnessing... something."
     "Authorities report no known affiliations. No demands have been issued."
     "Despite extensive coverage, we are unable to confirm what the monk
      wanted. Or if he wanted anything at all."

   So he does NOT hype. He reports a motor race in the register of a civic
   bulletin, is scrupulous about what is unverified, and treats the whole
   sport as an ongoing public event of unclear purpose. The comedy is in the
   epistemics, never in exclamation marks.
   ========================================================================== */
(function(){
'use strict';

const H = globalThis.PDHost;
const $ = id => document.getElementById(id);
const R = () => globalThis.PalmRivals;

// =============================================================================
// 1. LINE BANKS
// =============================================================================
const pick = a => a[Math.floor(Math.random() * a.length)];

const LINES = {

  // ── opening the broadcast ────────────────────────────────────────────────
  preRace: [
    ({t}) => `Good afternoon, citizens. We are at ${t}, where six drivers have agreed to go round it faster than each other.`,
    ({t}) => `Good afternoon, citizens. Conditions at ${t} are within normal parameters. The purpose of the event remains as previously stated.`,
    ({t}) => `We are live from ${t}. No demands have been issued. The race will proceed regardless.`,
    ({t}) => `Good afternoon, citizens. ${t} has been prepared to the usual standard, which is to say it has been swept.`,
  ],
  preRaceNemesis: [
    ({n,t}) => `Good afternoon, citizens. ${n} is here, at ${t}, as ${n} has been at every circuit so far. We are unable to confirm whether this is deliberate.`,
    ({n}) => `${n} has arrived and said nothing to our microphone. We are choosing not to characterise that.`,
    ({n}) => `Sources close to ${n} decline to comment. We should note that ${n} has no sources close to them.`,
  ],
  green: [
    () => `The lights are out. Whatever this is, it has begun.`,
    () => `We are racing. Citizens are advised that this will take some minutes.`,
    () => `Green flag. The field is away, in an order that will not last.`,
  ],

  // ── live events ──────────────────────────────────────────────────────────
  overtakeMade: [
    ({r,p}) => `You are past ${r}. That is P${p}, pending confirmation.`,
    ({r}) => `${r} has been passed. ${r} did not appear to consent.`,
    ({p}) => `Position gained. P${p}. We will report it as it stands.`,
  ],
  overtakenBy: [
    ({r,p}) => `${r} is through. You are P${p}. No fault has been assigned.`,
    ({r}) => `That was ${r}, going the other way past you. We saw it. It is on the record.`,
    ({p}) => `A place lost. P${p}. The reasons are not yet established.`,
  ],
  offroad: [
    () => `You have left the circuit. The circuit continues without you.`,
    () => `That is grass. Citizens will recall that grass is slower.`,
    () => `We are unable to confirm what that manoeuvre was intended to achieve.`,
  ],
  bigOffroad: [
    () => `You are some distance from the road. We will hold on this.`,
    () => `Authorities report no barriers damaged. That is the extent of the good news.`,
  ],
  lapRecord: [
    ({l}) => `A new circuit record. ${l}. It has been logged.`,
    ({l}) => `${l} — faster than anything previously recorded here. We have checked twice.`,
  ],
  goodLap: [
    ({l}) => `${l}. A tidy lap, by the available measure.`,
    ({l}) => `Lap complete in ${l}. No incidents to report.`,
  ],
  finalLap: [
    () => `Final lap. After this there will be a result, and then opinions about it.`,
    () => `Last time round, citizens. What happens now is what gets written down.`,
  ],
  finalLapClose: [
    ({r}) => `Final lap, and ${r} is within reach. We are not permitted to speculate.`,
    ({r}) => `Last lap. ${r} is right there. We will simply describe what occurs.`,
  ],
  leading: [
    () => `You are leading. We have no further information at this time.`,
    () => `P1. We are told this is the preferred position.`,
  ],
  lastPlace: [
    () => `You are last. This is confirmed, unfortunately.`,
    () => `P7. The field is ahead of you, collectively.`,
  ],
  rivalMistake: [
    ({r}) => `${r} has made an error. We will not be replaying it unnecessarily.`,
    ({r}) => `Something has gone wrong for ${r}. The cause is not yet established.`,
  ],
  duel: [
    ({r}) => `${r} is defending. That is permitted.`,
    ({r}) => `You and ${r} are now, functionally, the same story.`,
  ],

  // ── results ──────────────────────────────────────────────────────────────
  win: [
    () => `You have won. Citizens may draw their own conclusions.`,
    () => `First place. We are able to confirm this one.`,
    () => `A win, and no correction will follow.`,
  ],
  podium: [
    ({p}) => `P${p}. A podium. The trophy is real, whatever else is not.`,
    ({p}) => `You finish P${p}. That will be recorded accurately.`,
  ],
  midfield: [
    ({p}) => `P${p}. We are unable to confirm what that was meant to be.`,
    ({p}) => `You finish P${p}. The result stands; the meaning is contested.`,
  ],
  poor: [
    ({p}) => `P${p}. Despite extensive coverage, we cannot say what went wrong. Or if anything did.`,
    ({p}) => `P${p}. This may be the first race in Fracture City that generated no message.`,
  ],
  signOff: [
    () => `That is the race. The camera cuts here.`,
    () => `We will be back when they do this again, which they will.`,
    () => `This has been the broadcast. Nothing has been concluded.`,
  ],
};

// =============================================================================
// 2. CAMPAIGN — Ned narrates a season, and a nemesis emerges from real results
// =============================================================================
const CAMPAIGN = {

  // Called once when a season starts
  open(){
    return [
      `Good afternoon, citizens.`,
      `Four circuits have been reserved. Six drivers have entered. A seventh has also entered, which is you.`,
      `We have been asked to explain the purpose of the season. We have not been given one. The season will proceed.`,
    ];
  },

  // Before each round
  brief(round, trackName, st){
    const total = st.rounds;
    const n = st.nemesis;
    const lead = st.leaderName;
    const gap = st.gapToLeader;

    if (round === 0){
      return [
        `Round one of ${total}. ${trackName}.`,
        `No standings exist yet. For a short time, nobody is behind.`,
      ];
    }
    if (round === total - 1){
      const out = [`Final round. ${trackName}.`];
      if (st.youLead) out.push(`You lead the championship. Holding it requires only that nothing happens, and something usually happens.`);
      else if (gap != null && gap <= 6) out.push(`${lead} leads by ${gap}. That is a gap that can close in one afternoon.`);
      else out.push(`${lead} leads by ${gap}. We are obliged to report that this is a considerable margin.`);
      if (n) out.push(`${n} has been the recurring feature of your season. This is the last opportunity to change what that means.`);
      return out;
    }
    const out = [`Round ${round+1} of ${total}. ${trackName}.`];
    if (st.youLead) out.push(`You lead. Citizens have begun to form expectations, which we do not endorse.`);
    else if (lead) out.push(`${lead} leads on ${st.leaderPoints}. You are on ${st.yourPoints}.`);
    if (n) out.push(`${n} finished ahead of you last time. We make no claim as to whether that will continue.`);
    return out;
  },

  // After each round
  debrief(place, st){
    const n = st.nemesis;
    const out = [];
    if (place === 1) out.push(`You won. The standings have been updated accordingly.`);
    else if (place <= 3) out.push(`P${place}. Points awarded. No protest has been lodged.`);
    else out.push(`P${place}. The points reflect the finish, and the finish reflects the race.`);

    if (n && st.nemesisBeatYou) out.push(`${n} finished ahead of you again. We continue to report this without characterising it.`);
    else if (n && !st.nemesisBeatYou) out.push(`You finished ahead of ${n}. This is the first time we have been able to say that.`);

    if (st.youLead) out.push(`You now lead the championship.`);
    else if (st.leaderName) out.push(`${st.leaderName} leads on ${st.leaderPoints}.`);
    return out;
  },

  // End of season
  close(won, st){
    if (won) return [
      `You are champion of Fracture City.`,
      `We are told a ceremony has been arranged. We are unable to confirm who arranged it.`,
      st.nemesis ? `${st.nemesis} has left the circuit without speaking to anyone.` : `The field has dispersed.`,
      `This has been the season. No correction follows.`,
    ];
    return [
      `${st.leaderName} takes the championship.`,
      `You finish the season in P${st.yourRank}.`,
      st.nemesis ? `${st.nemesis} was ahead of you more often than not. We report that as a fact and not as a verdict.` : `The results are recorded as they occurred.`,
      `Despite extensive coverage, we are unable to say what this season was for. The camera cuts here.`,
    ];
  },
};

// =============================================================================
// 3. UI — lower third, and a story card for campaign beats
// =============================================================================
const CSS = `
#ned-lower{position:absolute;left:0;right:0;bottom:64px;display:flex;justify-content:center;
  pointer-events:none;z-index:40;opacity:0;transition:opacity .25s;}
#ned-lower.on{opacity:1;}
#ned-lower .box{max-width:74%;background:linear-gradient(90deg,rgba(8,10,24,.94),rgba(14,18,40,.88));
  border-left:3px solid #ff3d95;padding:9px 16px 10px;border-radius:2px;
  box-shadow:0 6px 26px rgba(0,0,0,.55);}
#ned-lower .who{font:600 9px/1 ui-monospace,Menlo,monospace;letter-spacing:.22em;
  color:#ff8ac2;margin-bottom:5px;}
#ned-lower .txt{font:400 15px/1.45 Georgia,'Times New Roman',serif;color:#e9f2ff;}
#ned-story{position:absolute;inset:0;display:none;align-items:center;justify-content:center;
  background:rgba(4,6,16,.93);z-index:60;}
#ned-story.on{display:flex;}
#ned-story .card{max-width:640px;padding:34px 38px;text-align:left;}
#ned-story .slug{font:600 10px/1 ui-monospace,Menlo,monospace;letter-spacing:.28em;
  color:#ff8ac2;margin-bottom:20px;}
#ned-story p{font:400 17px/1.6 Georgia,'Times New Roman',serif;color:#e9f2ff;
  margin:0 0 13px;opacity:0;animation:nedin .5s forwards;}
@keyframes nedin{to{opacity:1;}}
#ned-story .go{margin-top:22px;}
#ned-story button{background:rgba(255,61,149,.14);border:1px solid #ff3d95;color:#ffd8ea;
  font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.2em;padding:11px 20px;
  border-radius:2px;cursor:pointer;}
#ned-story button:hover{background:rgba(255,61,149,.28);color:#fff;}
#ned-tier{position:absolute;top:12px;right:14px;z-index:45;font:600 10px/1 ui-monospace,Menlo,monospace;
  letter-spacing:.18em;color:#8fa6c8;}
`;

let lowerT = 0, lastSpoken = '', muted = false;

function mountUI(){
  const st = document.createElement('style'); st.textContent = CSS;
  document.head.appendChild(st);
  const wrap = $('wrap') || document.body;

  const lower = document.createElement('div');
  lower.id = 'ned-lower';
  lower.innerHTML = `<div class="box"><div class="who">NEWSMAN NED · LIVE</div><div class="txt" id="ned-txt"></div></div>`;
  wrap.appendChild(lower);

  const story = document.createElement('div');
  story.id = 'ned-story';
  story.innerHTML = `<div class="card"><div class="slug" id="ned-slug">FRACTURE CITY BROADCAST</div>
    <div id="ned-story-body"></div>
    <div class="go"><button id="ned-continue">C O N T I N U E</button></div></div>`;
  wrap.appendChild(story);

  const tierTag = document.createElement('div');
  tierTag.id = 'ned-tier';
  wrap.appendChild(tierTag);
}

function say(text){
  if (!text || text === lastSpoken) return;
  lastSpoken = text;
  const el = $('ned-txt'); if (!el) return;
  el.textContent = text;
  $('ned-lower').classList.add('on');
  lowerT = 4.2;
  if (!muted && globalThis.speechSynthesis){
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.98; u.pitch = 0.92;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch(e){}
  }
}

function tickUI(dt){
  if (lowerT > 0){
    lowerT -= dt;
    if (lowerT <= 0) $('ned-lower')?.classList.remove('on');
  }
}

let storyResolve = null;
function showStory(lines, slug){
  return new Promise(res => {
    storyResolve = res;
    $('ned-slug').textContent = slug || 'FRACTURE CITY BROADCAST';
    const body = $('ned-story-body');
    body.innerHTML = lines.map((l,i) =>
      `<p style="animation-delay:${i*0.32}s">${l}</p>`).join('');
    $('ned-story').classList.add('on');
    if (!muted && globalThis.speechSynthesis){
      try { speechSynthesis.cancel();
        lines.forEach(l => { const u = new SpeechSynthesisUtterance(l); u.rate=0.98; u.pitch=0.92; speechSynthesis.speak(u); });
      } catch(e){}
    }
  });
}
function closeStory(){
  $('ned-story').classList.remove('on');
  if (globalThis.speechSynthesis) try { speechSynthesis.cancel(); } catch(e){}
  const r = storyResolve; storyResolve = null;
  if (r) r();
}

// =============================================================================
// 4. LIVE COMMENTARY — driven from the game loop
// =============================================================================
const S = {
  lastPlace: 7, offT: 0, saidFinalLap: false, saidGreen: false,
  cooldown: 0, lastLap: 1, seenRecord: false,
};

function resetRace(){
  S.lastPlace = 7; S.offT = 0; S.saidFinalLap = false; S.saidGreen = false;
  S.cooldown = 0; S.lastLap = 1; S.seenRecord = false;
  lastSpoken = '';
}

function nearestRivalName(){
  const G = H.G, rl = H.rivals;
  if (!rl || !rl.length) return null;
  const pp = (G.lap-1)*H.trackLength + G.pos;
  let best = null, bd = Infinity;
  for (const r of rl){
    if (r.finished) continue;
    const d = Math.abs(((r.lap-1)*H.trackLength + r.z) - pp);
    if (d < bd){ bd = d; best = r; }
  }
  return bd < H.SEG_LEN * 12 ? best.name : null;
}

function tick(dt){
  tickUI(dt);
  const G = H.G;
  if (!G.running || G.paused || G.finished) return;
  if (S.cooldown > 0) S.cooldown -= dt;

  // green flag
  if (!S.saidGreen && (G.countdown === undefined || G.countdown <= 0)){
    S.saidGreen = true; say(pick(LINES.green)()); S.cooldown = 3;
    return;
  }
  if (S.cooldown > 0) return;

  // position changes
  const place = G.place || 7;
  if (place !== S.lastPlace){
    const rn = nearestRivalName();
    if (place < S.lastPlace){
      say(pick(LINES.overtakeMade)({ r: rn || 'the car ahead', p: place }));
    } else {
      say(pick(LINES.overtakenBy)({ r: rn || 'a rival', p: place }));
    }
    S.lastPlace = place; S.cooldown = 4.5;
    return;
  }

  // off-road
  if (G.offroad){
    S.offT += dt;
    if (S.offT > 2.4){ say(pick(LINES.bigOffroad)()); S.offT = -6; S.cooldown = 5; return; }
    if (S.offT > 0.7 && S.offT < 0.75){ say(pick(LINES.offroad)()); S.cooldown = 4; return; }
  } else if (S.offT > 0) S.offT = 0;

  // final lap
  if (!S.saidFinalLap && G.lap >= G.laps && G.laps > 1){
    S.saidFinalLap = true;
    const rn = nearestRivalName();
    say(rn ? pick(LINES.finalLapClose)({ r: rn }) : pick(LINES.finalLap)());
    S.cooldown = 5;
    return;
  }

  // lap completed
  if (G.lap !== S.lastLap){
    S.lastLap = G.lap;
    const lastLapT = G.lastLap;
    if (lastLapT){
      const tid = H.TRACKS[G.track] && H.TRACKS[G.track].id;
      const rec = H.CAREER && H.CAREER.bestLap && H.CAREER.bestLap[tid];
      const fmt = globalThis.fmtLap ? fmtLap(lastLapT) : lastLapT.toFixed(2) + 's';
      if (!S.seenRecord && rec && lastLapT <= rec){
        S.seenRecord = true; say(pick(LINES.lapRecord)({ l: fmt }));
      } else {
        say(pick(LINES.goodLap)({ l: fmt }));
      }
      S.cooldown = 5;
    }
    return;
  }
}

function onRivalLap(){ /* hook kept for rivals.js; deliberately quiet */ }

// =============================================================================
// 5. CAMPAIGN STATE
// =============================================================================
function champState(){
  const C = H.CAREER;
  const c = C && C.champ;
  if (!c) return null;
  const rows = Object.entries(c.points)
    .map(([name, pts]) => ({ name, pts }))
    .sort((a,b) => b.pts - a.pts);
  const you = rows.findIndex(r => r.name === 'YOU');
  const leader = rows[0];
  return {
    rounds: H.TRACKS.length,
    round: c.round,
    nemesis: c.nemesis || null,
    nemesisBeatYou: !!c.nemesisBeatYou,
    leaderName: leader ? (leader.name === 'YOU' ? 'You' : leader.name) : null,
    leaderPoints: leader ? leader.pts : 0,
    yourPoints: rows[you] ? rows[you].pts : 0,
    yourRank: you + 1,
    youLead: you === 0,
    gapToLeader: leader ? leader.pts - (rows[you] ? rows[you].pts : 0) : null,
  };
}

// After a champ race, work out who the nemesis is from ACTUAL results.
function updateNemesis(place){
  const C = H.CAREER, c = C && C.champ;
  if (!c) return;
  const order = (H.G.finishOrder || []).map(e => (e === 'YOU' || e.name === undefined) ? 'YOU' : e.name);
  // whoever finished immediately ahead of you this round
  const idx = order.indexOf('YOU');
  const ahead = idx > 0 ? order[idx-1] : null;

  c.beatenBy = c.beatenBy || {};
  if (ahead && ahead !== 'YOU'){
    c.beatenBy[ahead] = (c.beatenBy[ahead] || 0) + 1;
  }
  // nemesis = whoever has finished ahead of you most often
  let top = null, n = 0;
  for (const [k,v] of Object.entries(c.beatenBy)) if (v > n){ n = v; top = k; }
  c.nemesis = top;
  c.nemesisBeatYou = !!(top && ahead === top) || !!(place > 1 && top && order.indexOf(top) < idx);
  try { H.saveCareer(); } catch(e){}
}

// =============================================================================
// 6. HOOKS INTO THE GAME
// =============================================================================
function install(){
  mountUI();

  // tier readout
  const refreshTier = () => {
    const el = $('ned-tier');
    if (el && R()) el.textContent = R().tier().label;
  };
  refreshTier();

  // ── wrap update() to drive live commentary ────────────────────────────
  const _update = globalThis.update;
  if (typeof _update === 'function'){
    globalThis.update = function(dt){
      _update.call(this, dt);
      try { tick(dt); } catch(e){ console.warn('[ned] tick', e); }
    };
  }

  // ── wrap startRace for the pre-race bulletin ──────────────────────────
  const _startRace = globalThis.startRace;
  if (typeof _startRace === 'function'){
    globalThis.startRace = function(trackIdx, mode){
      _startRace.call(this, trackIdx, mode);
      resetRace();
      refreshTier();
      const t = H.TRACKS[trackIdx] ? H.TRACKS[trackIdx].name : 'the circuit';
      const st = champState();
      const n = st && st.nemesis;
      setTimeout(() => {
        say(n && mode === 'champ' && Math.random() < 0.6
          ? pick(LINES.preRaceNemesis)({ n, t })
          : pick(LINES.preRace)({ t }));
      }, 400);
    };
  }

  // ── wrap showResults for the sign-off ─────────────────────────────────
  const _showResults = globalThis.showResults;
  if (typeof _showResults === 'function'){
    globalThis.showResults = function(){
      const place = H.G.place || 7;
      if (H.G.mode === 'champ') { try { updateNemesis(place); } catch(e){ console.warn('[ned]', e); } }
      _showResults.call(this);
      const bank = place === 1 ? LINES.win
                 : place <= 3 ? LINES.podium
                 : place <= 5 ? LINES.midfield
                 : LINES.poor;
      say(pick(bank)({ p: place }));
    };
  }

  // ── campaign beats ────────────────────────────────────────────────────
  const _startChampionship = globalThis.startChampionship;
  if (typeof _startChampionship === 'function'){
    globalThis.startChampionship = async function(){
      const C = H.CAREER;
      // set up state first so the brief can read it
      C.champ = { round:0, points:{ YOU:0 }, results:[], beatenBy:{}, nemesis:null };
      for (const r of H.RIVALS) C.champ.points[r.name] = 0;
      try { H.saveCareer(); } catch(e){}

      await showStory(CAMPAIGN.open(), 'SEASON OPENING · FRACTURE CITY BROADCAST');
      const st = champState();
      await showStory(CAMPAIGN.brief(0, H.TRACKS[0].name, st), 'ROUND 1 BRIEFING');
      startRace(0, 'champ');
    };
  }

  const _nextChampRound = globalThis.nextChampRound;
  if (typeof _nextChampRound === 'function'){
    globalThis.nextChampRound = async function(){
      const c = H.CAREER.champ;
      const st = champState();
      const round = c.round;
      if (round < H.TRACKS.length){
        await showStory(CAMPAIGN.brief(round, H.TRACKS[round].name, st), `ROUND ${round+1} BRIEFING`);
      }
      _nextChampRound.call(this);
    };
  }

  const _showStandings = globalThis.showStandings;
  if (typeof _showStandings === 'function'){
    globalThis.showStandings = async function(final){
      const st = champState();
      if (final && st){
        await showStory(CAMPAIGN.close(st.youLead, st), 'SEASON CLOSE · FRACTURE CITY BROADCAST');
      } else if (st){
        await showStory(CAMPAIGN.debrief(H.G.place || 7, st), 'ROUND DEBRIEF');
      }
      _showStandings.call(this, final);
    };
  }

  $('ned-continue').addEventListener('click', closeStory);
  addEventListener('keydown', e => {
    if (e.code === 'Enter' && $('ned-story').classList.contains('on')) closeStory();
    if (e.code === 'KeyM'){ muted = !muted;
      if (muted && globalThis.speechSynthesis) try { speechSynthesis.cancel(); } catch(err){}
      say(muted ? 'Commentary muted.' : 'Commentary restored.');
    }
  });

  console.log('[palm-drive] Newsman Ned installed');
}

globalThis.Ned = {
  LINES, CAMPAIGN, say, showStory, closeStory, tick, resetRace,
  onRivalLap, champState, updateNemesis, install,
  isMuted: () => muted, setMuted: v => { muted = v; },
};

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', install);
else install();

})();
