// =============================================================================
//  THE OUTBREAK · the campaign, rewritten
// -----------------------------------------------------------------------------
//  Ned Halloran is FCN's anchor and he is a computer. At 17:58 he threw an
//  error mid-bulletin: every screen said one sentence, every listener heard a
//  different one, and one hundred people heard a line that was not meant for
//  people. They are the Turned.
//
//  Five chapters, one night. In each, a citizen repairs one broken part of Ned
//  at a station while you hold off exactly twenty of the Turned. One hundred in
//  all, counted on screen. The Bureau stays, and stays unhelpful.
//
//  This file replaces the contents of CAMPAIGN and adds two objective kinds:
//    station  the repair bar (0-100). Fills while you are near and the Turned
//             are not at the station.
//    kill     the Turned spawned for this chapter. Only these are counted.
//  See OUTBREAK.md for the story bible.
// =============================================================================
(function(){
'use strict';
if (typeof CAMPAIGN === 'undefined' || typeof Campaign === 'undefined') return;

const OB = window.Outbreak = {
  version: '0.37.0', total: 100, perChapter: 20,
  timeScale: 1,   // tests only
  chapterId: null, st: null, alive: new Set(), ticker: [], tickT: 0, quipT: 14, purgeT: 0,
};
const INFECTED = new Set(['zombie', 'stalker', 'spitter', 'howler', 'husk']);
const safe = f => { try { return f(); } catch (e){ console.warn('[outbreak]', e); } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

// ─── The cast, recast ────────────────────────────────────────────────────────
Object.assign(SPEAKERS.ned,    { role: 'FCN // AUTOMATED ANCHOR' });
Object.assign(SPEAKERS.marcus, { role: 'CITY MAINS // NIGHT CREW' });
Object.assign(SPEAKERS.clara,  { role: 'THE NIGHT SHOP // CIVIC CORE' });
Object.assign(SPEAKERS.daniel, { role: 'BUREAU // WINDOW THREE' });
Object.assign(SPEAKERS.leon,   { role: 'MUNICIPAL RECOVERY // TOW 12' });
Object.assign(SPEAKERS.rook,   { role: 'THE RELAY // CIVIC CROSSROADS' });
Object.assign(SPEAKERS.inez,   { role: 'SOUTH SIGNAL MAST // LOT 09' });
SPEAKERS.self.role = 'Civic Core resident';
if (!SPEAKERS.warden) SPEAKERS.warden = { name: 'COMPLIANCE WARDEN', role: 'BUREAU OF NARRATIVE MITIGATION',
  skin: '#dca17d', hair: '#2a1d19', coat: '#4a4f63', accent: '#9aa2bb', feature: 'cap', tint: '#9aa2bb' };

// ─── The story ───────────────────────────────────────────────────────────────
//  Station anchors are street positions beside existing landmarks. The real
//  footing is found at runtime, never assumed.
const CHAPTERS = [
  {
    id: 'ob-clock', title: 'THE CLOCK', kicker: 'Chapter One · 18:10', time: 18 * 60 + 10,
    open: 'Ned is stuck at 17:58. So is every clock wired to him, and in Fracture City that is all of them.',
    close: 'The clocks agree again. Twenty of the Turned are down. Ned knows what time it is, and he does not like it.',
    station: { who: 'rook', name: "ROOK'S RELAY", part: 'clock', x: 4.5, z: 4.5, secs: 50,
      waves: [4, 5, 5, 6], mix: [] },
    intro: [
      { who: 'ned', text: 'Good evening, Fracture City. It is 17:58.' },
      { who: 'ned', text: 'It is 17:58. I have checked. It is also 17:58.' },
      { who: 'ned', text: 'One hundred residents heard a sentence that was not meant for residents. They are now the Turned. One hundred exactly. I counted. Counting is one of the three things I still do correctly.' },
      { who: 'self', text: 'Ned. Can you hear me?' },
      { who: 'ned', text: 'I am not in your street. I am on every wall in your street. There is a difference, and you signed it.' },
      { who: 'rook', text: 'He can hear you. He just thinks it is still two minutes to six. I can fix his clock from my relay at the crossroads, if nobody eats me first.' },
      { who: 'ned', text: 'Correction, and I want to be clear that a correction is a service we provide free of charge. Somebody may eat you.' },
    ],
    beats: {
      'c1-reach': [
        { who: 'rook', text: 'Stand there. Hit anything that walks like it is reading a form. The repair stops if they get close to me.' },
        { who: 'ned', text: 'Coming up: a resident attempts to fix the news. We will carry it live, because it is funny.' },
      ],
      'c1-fix': [
        { who: 'rook', text: 'Clock is back. He knows what time it is.' },
        { who: 'ned', text: 'The clocks are moving again. I have been saying 17:58 for rather too long. I would like that struck from the record.' },
      ],
    },
    outro: [
      { who: 'ned', text: 'Twenty down. Eighty to go. The city notes the achievement and moves on.' },
      { who: 'rook', text: 'Clock was one part. His voice is next. Inez runs the South Signal mast at Lot 09. She hates me. That is how you know she is good.' },
      { who: 'ned', text: 'That is the news. The Turned are slow, the clock is right, and I have to read the weather.' },
    ],
    quips: [
      'Quiet night in the district. Nothing to report. I have been asked to say that twice, so: nothing to report.',
      'It is 17:58. Sorry. The clock is repaired; the habit is not.',
      'FCN reminds viewers that the Turned are not a lifestyle choice.',
    ],
    objectives: [
      { id: 'c1-reach', kind: 'reach', x: 4.5, z: 4.5, r: 6, text: "Get to Rook's relay at the crossroads" },
      { id: 'c1-fix', kind: 'station', count: 100, after: 'c1-reach', text: 'Keep the Turned off Rook while the clock repairs' },
      { id: 'c1-kill', kind: 'kill', count: 20, after: 'c1-reach', text: 'Put down the Turned' },
    ],
  },
  {
    id: 'ob-voice', title: 'THE VOICE', kicker: 'Chapter Two · 20:30', time: 20 * 60 + 30,
    open: 'Ned can tell the time. He can no longer tell a sentence from a weather report.',
    close: 'Ned says things in the right order again. Forty of the Turned are down.',
    station: { who: 'inez', name: 'THE SOUTH SIGNAL MAST', part: 'voice', x: 23.5, z: 8.5, secs: 60,
      waves: [5, 5, 5, 5], mix: ['stalker', 'stalker', 'stalker', 'stalker'] },
    intro: [
      { who: 'ned', text: 'Good evening. Weather now: the Bureau has issued a warning for light biting, clearing to rain by morning.' },
      { who: 'ned', text: 'In sport, the mayor. Back to the studio.' },
      { who: 'inez', text: 'He is pulling words from the wrong drawers. His voice runs through my mast at Lot 09 and right now it is full of old adverts.' },
      { who: 'self', text: 'Can you fix it?' },
      { who: 'inez', text: 'I can rebuild his grammar in about a minute. You can stop them chewing on me while I do.' },
      { who: 'ned', text: 'This bulletin is brought to you by the letter Q. The letter Q has asked not to be associated with recent events.' },
    ],
    beats: {
      'c2-reach': [
        { who: 'inez', text: 'Mast is live. Keep them off the ladder. Their climbing is bad, but so is my patience.' },
        { who: 'ned', text: 'Our resident is walking to other districts now. Bold. Most repairs die at the end of the street they started on.' },
      ],
      'c2-fix': [
        { who: 'ned', text: 'Testing. The cat sat on the mat. The mat has filed a complaint. Grammar restored.' },
        { who: 'inez', text: 'He is speaking in order. That is more than most of the city.' },
      ],
    },
    outro: [
      { who: 'ned', text: 'Forty down. Sixty remain. FCN has reviewed the count and stands by it, which is more than it usually does.' },
      { who: 'inez', text: 'His memory is next. The old tapes are in the basement of the Residue Room and the power is out. Leon has a battery on the back of Tow 12.' },
      { who: 'ned', text: 'I would like to thank Inez, whose name I have just remembered, for my voice. I have not remembered anything else. Back after this.' },
    ],
    quips: [
      'Traffic and travel: the Turned are walking. Everyone else is advised to also walk, faster.',
      'And now the shipping forecast. There are no ships. We read it anyway, for morale.',
      'Correction: the previous bulletin was correct. FCN regrets the confusion.',
    ],
    objectives: [
      { id: 'c2-reach', kind: 'reach', x: 23.5, z: 8.5, r: 6, text: 'Get to the South Signal mast at Lot 09' },
      { id: 'c2-fix', kind: 'station', count: 100, after: 'c2-reach', text: 'Keep the Turned off Inez while the voice repairs' },
      { id: 'c2-kill', kind: 'kill', count: 20, after: 'c2-reach', text: 'Put down the Turned' },
    ],
  },
  {
    id: 'ob-memory', title: 'THE MEMORY', kicker: 'Chapter Three · 23:00', time: 23 * 60,
    open: 'Ned has a clock and a voice. He has forgotten nine years of the six o’clock, and most of the people he read it to.',
    close: 'Ned remembers what happened at 17:58, and whose sentence it was. Sixty of the Turned are down.',
    station: { who: 'leon', name: 'THE FCN ARCHIVE', part: 'memory', x: -3, z: 9, secs: 70,
      waves: [5, 5, 5, 5], mix: ['stalker', 'stalker', 'spitter', 'spitter', 'spitter'] },
    intro: [
      { who: 'ned', text: 'Good evening, Gerald.' },
      { who: 'self', text: 'I am not Gerald.' },
      { who: 'ned', text: 'Good evening, not Gerald. Our records show you have lived here for nine years. Our records are a basement with no lights.' },
      { who: 'leon', text: 'Battery is on the truck. For budget reasons, Municipal Recovery vehicles currently resemble whatever car I can get into.' },
      { who: 'leon', text: 'I plug in the archive under the Residue Room, Ned reloads his tapes. It takes a while, and the Turned like the noise the tape makes.' },
    ],
    beats: {
      'c3-reach': [
        { who: 'leon', text: 'Hooking up. If one of them gets in the cab, it can have the cab.' },
        { who: 'ned', text: 'Raw feed from the archive is four hours of a door. I am watching all of it.' },
      ],
      'c3-fix': [
        { who: 'ned', text: 'Archive restored. I remember the weather. I remember reading the same correction four nights running, and I would like to apologise to the person whose name I kept getting wrong. Hello, Daniel.' },
        { who: 'leon', text: 'He remembers. Some of that is bad news.' },
      ],
    },
    outro: [
      { who: 'ned', text: 'Sixty down. Forty remain. FCN can confirm that sixty anomalies entered one district. None of them are expected to recover.' },
      { who: 'ned', text: 'Here is what I remember about 17:58. The Bureau sent me a sentence to read. It was not a sentence. It was a test file. They wanted to see whether a city would hear what it was told.' },
      { who: 'ned', text: 'It did not. Everyone heard what they wanted, and a hundred people heard something that was not for people.' },
      { who: 'leon', text: 'So the Bureau did this.' },
      { who: 'ned', text: 'The Bureau does not do things. The Bureau files them. Daniel is still at Window Three, and he has my licence.' },
    ],
    quips: [
      'Good evening, Gerald. Good evening, other Gerald.',
      'FCN advises against unscheduled miracles before midnight. They are difficult to verify and worse to insure.',
      'Our records are being restored. Our records would like a word with our records.',
    ],
    objectives: [
      { id: 'c3-reach', kind: 'reach', x: -3, z: 9, r: 6, text: 'Get to the FCN archive under the Residue Room' },
      { id: 'c3-fix', kind: 'station', count: 100, after: 'c3-reach', text: 'Keep the Turned off Leon while the archive reloads' },
      { id: 'c3-kill', kind: 'kill', count: 20, after: 'c3-reach', text: 'Put down the Turned' },
    ],
  },
  {
    id: 'ob-form', title: 'THE FORM', kicker: 'Chapter Four · 02:40', time: 2 * 60 + 40,
    open: 'The Bureau has suspended Ned’s licence pending review. Until Daniel reinstates it, Ned can only say what the Bureau approves, and the Bureau approves nothing after midnight.',
    close: 'Ned’s licence is back. The Bureau watched the whole thing and filed it as nobody’s fault. Eighty of the Turned are down.',
    station: { who: 'daniel', name: 'WINDOW THREE', part: 'licence', x: 5.6, z: -9, secs: 75, wardens: 2,
      waves: [5, 5, 5, 5], mix: ['stalker', 'spitter', 'spitter', 'howler', 'howler'] },
    intro: [
      { who: 'ned', text: 'This bulletin is pending review.' },
      { who: 'ned', text: 'That sentence is also pending review. I would describe how I feel about this, but feelings are a separate form.' },
      { who: 'daniel', text: 'Window Three. I can reinstate him. It is a twelve-page form and the Turned keep pressing their faces on the glass.' },
      { who: 'warden', text: 'The Bureau reminds residents that the outbreak is a temporary arrangement, and will be processed when it holds still.' },
      { who: 'self', text: 'Your test file started it.' },
      { who: 'warden', text: 'The Bureau does not start things. Please complete a form describing what you believe started it.' },
      { who: 'daniel', text: 'I will do the twelve pages. You do the door.' },
    ],
    beats: {
      'c4-reach': [
        { who: 'daniel', text: 'Page one. Name of broadcaster: Ned. Surname: he does not have one. I am putting Halloran. He will like that.' },
        { who: 'warden', text: 'We will observe. Observation is not participation.' },
      ],
      'c4-fix': [
        { who: 'daniel', text: 'Stamped. Licence reinstated, retroactively, which is the only direction the Bureau knows.' },
        { who: 'ned', text: 'I am no longer pending. I would like to say something rude about the Bureau, and I find that I am legally allowed. I will save it for the six o’clock.' },
      ],
    },
    outro: [
      { who: 'ned', text: 'Eighty down. Twenty remain. FCN has asked the Bureau to comment. The Bureau has asked for a form.' },
      { who: 'daniel', text: 'Last part is the transmitter at the FCN tower. Marcus has the mains, Clara has the coffee, and Ned has to read one clean six o’clock to everybody at once.' },
      { who: 'ned', text: 'One bulletin, one sentence, every screen. If everyone hears the same thing, nobody else turns. That is the theory. I am a news anchor, so I have never tested a theory in my life.' },
    ],
    quips: [
      'The city thanks all parties for participating in a decision it will describe as nobody’s fault.',
      'Wardens on scene report the situation is under observation. The situation reports it is under the Wardens.',
      'Nobody comes out of intake as the same file they went in as. Tonight that includes the files.',
    ],
    objectives: [
      { id: 'c4-reach', kind: 'reach', x: 5.6, z: -9, r: 6, text: 'Get to Window Three at the Bureau' },
      { id: 'c4-fix', kind: 'station', count: 100, after: 'c4-reach', text: 'Keep the Turned off Daniel while he files the reinstatement' },
      { id: 'c4-kill', kind: 'kill', count: 20, after: 'c4-reach', text: 'Put down the Turned' },
    ],
  },
  {
    id: 'ob-six', title: 'THE SIX O’CLOCK', kicker: 'Chapter Five · 05:40', time: 5 * 60 + 40,
    open: 'Twenty minutes to six. The last twenty of the Turned are walking toward the only lit building in the city.',
    close: 'At six o’clock every screen in Fracture City said the same thing, and everyone heard it.',
    station: { who: 'marcus', also: 'clara', name: 'THE FCN TRANSMITTER', part: 'signal', x: -2.6, z: -9, secs: 85,
      waves: [5, 5, 5, 5], mix: ['stalker', 'spitter', 'howler', 'husk', 'husk', 'stalker'] },
    intro: [
      { who: 'marcus', text: 'Mains are back on at the tower. Took me all night. The pipes in this city are older than the Bureau and better organised.' },
      { who: 'clara', text: 'I brought coffee. I run the night shop. I have been open since 17:58 because nobody told me to close.' },
      { who: 'ned', text: 'Good morning, Fracture City. Nearly. The weather is exactly as complicated as you left it.' },
      { who: 'clara', text: 'He is reading drafts. A clean signal has to go out at six, to everyone at once. Marcus powers it, I keep him on script, you keep them off the door.' },
      { who: 'ned', text: 'Do not get up on my account. Do keep them off the door.' },
    ],
    beats: {
      'c5-reach': [
        { who: 'marcus', text: 'Power is flowing. Clara is on the cue cards. Here they come, up the street like a queue at the bank.' },
      ],
      'c5-fix': [
        { who: 'ned', text: 'Signal is clean. I would like to go live.' },
        { who: 'clara', text: 'Then finish them and go live.' },
      ],
    },
    outro: [
      { who: 'ned', text: 'One hundred. That is the last of them. The city notes the achievement, and for once it does not move on.' },
      { who: 'ned', text: 'Good morning, Fracture City. It is six o’clock.' },
      { who: 'ned', text: 'Overnight, one hundred residents heard a sentence that was not meant for them. Their names will be read at seven, in full, spelled correctly.' },
      { who: 'ned', text: 'The Bureau has been asked to comment. The Bureau has asked for a form. FCN has supplied one, filled in.' },
      { who: 'ned', text: 'One person reached another person, several times, all night. FCN cannot establish why this required a bulletin. It did.' },
      { who: 'ned', text: 'The weather is complicated. Visibility improving. I am going to make a cup of tea, which is a thing I do when I have nothing professional left to offer. I do not have a kettle. I will describe one.' },
      { who: 'marcus', text: 'Did everyone hear that the same?' },
      { who: 'clara', text: 'Everyone heard that the same.' },
    ],
    ending: { title: 'The Six O’Clock',
      body: 'You put down one hundred of the Turned while five citizens fixed a newsreader. At six o’clock Ned read one bulletin and the whole city heard the same words. The Bureau has filed the night as a temporary arrangement. It has not ended yet.' },
    quips: [
      'It is almost six. Every minute is a different minute again, which is luxurious.',
      'Somebody will tell me to stop eventually. Until then there is a six o’clock, and at six o’clock there is me.',
      'Good morning. Try not to die. The paperwork is appalling.',
    ],
    objectives: [
      { id: 'c5-reach', kind: 'reach', x: -2.6, z: -9, r: 6, text: 'Get to the FCN tower before six' },
      { id: 'c5-fix', kind: 'station', count: 100, after: 'c5-reach', text: 'Keep the Turned off the transmitter until the signal is clean' },
      { id: 'c5-kill', kind: 'kill', count: 20, after: 'c5-reach', text: 'Put down the last of the Turned' },
    ],
  },
];
OB.chapters = CHAPTERS;
CAMPAIGN.length = 0;
for (const ch of CHAPTERS) CAMPAIGN.push(ch);

//  Who you were in the prologue opens Chapter One.
const OPENERS = {
  witness: 'Three people heard three sentences at 17:58. I wrote all of them down. None of them was the one that turned anybody.',
  quarry: 'I work the city mains. If Ned runs on anything, it runs on something I have fixed.',
  tow: 'Tow 12 is three streets away. Leon will want it back. Leon will have to wait.',
  clerk: 'My name is on the first page of the Bureau’s file. I would like it on the last page too.',
  broadcaster: 'I work the floor under Ned. I have never seen him miss a bulletin. I have also never seen him eat anyone.',
};

// ─── Story wiring ───────────────────────────────────────────────────────────
function obChapterIndex(){ return Math.max(0, CAMPAIGN.indexOf(shChapter())); }
function obRemaining(){
  if (Campaign.finished) return 0;
  const ch = shChapter(); if (!ch) return OB.total;
  const kill = ch.objectives.find(o => o.kind === 'kill');
  return Math.max(0, OB.total - obChapterIndex() * OB.perChapter - Math.min(OB.perChapter, (kill && Campaign.progress[kill.id]) || 0));
}
OB.remaining = obRemaining;

function obMarkStory(){ Campaign.done['story:outbreak'] = true; }

const _start = window.shCampaignStart;
window.shCampaignStart = function(){
  const r = _start.apply(this, arguments);
  if (!Campaign.done['story:outbreak']){ obMarkStory(); shCampaignSave(); }
  return r;
};

//  A save from the old campaign points at a chapter that no longer exists.
function obMigrate(){
  if (!Campaign.active || Campaign.done['story:outbreak']) return false;
  Campaign.chapter = 0; Campaign.progress = {}; Campaign.done = {}; Campaign.finished = false;
  Campaign.seenSeconds = 0; Campaign.districtsSeen = [];
  obMarkStory(); shCampaignSave();
  toast('The story has been rewritten. Your city is kept; the campaign starts at Chapter One.', 'info');
  shEnterChapter();
  return true;
}

const _intro = window.shCampaignIntro;
window.shCampaignIntro = function(ch){
  const lines = _intro ? _intro.apply(this, arguments) : (ch.intro || []);
  const cls = window.FN && FN.state && FN.state.cls;
  if (ch && ch.id === 'ob-clock' && cls && OPENERS[cls]) return [{ who: 'self', text: OPENERS[cls] }].concat(lines);
  return lines;
};

function obEvent(kind, value, absolute){
  if (!Campaign.active || Campaign.finished) return;
  const ch = shChapter(); if (!ch) return;
  let completed = null, touched = false;
  for (const o of ch.objectives){
    if (o.kind !== kind || Campaign.done[o.id] || (o.after && !Campaign.done[o.after])) continue;
    const before = Campaign.progress[o.id] || 0;
    const next = Math.min(o.count || 1, absolute ? value : before + (value || 1));
    if (next === before) continue;
    Campaign.progress[o.id] = next; touched = true;
    if (next >= (o.count || 1)){ Campaign.done[o.id] = true; completed = o.id; toast(`Objective complete: ${o.text}`, 'success'); }
  }
  if (!touched) return;
  //  The repair bar moves every frame; the save only needs every tenth.
  const step = kind === 'station' ? Math.floor(value / 10) : -1;
  if (kind !== 'station' || completed || step !== OB.lastSavedStep){ OB.lastSavedStep = step; shCampaignSave(); }
  shCampaignHUD();
  if (completed && shFireBeat(completed, () => shCheckChapterComplete())) return;
  if (completed) shCheckChapterComplete();
}
const _event = window.shCampaignEvent;
window.shCampaignEvent = function(kind, detail, amount){
  if (kind === 'kill' || kind === 'station') return obEvent(kind, amount, kind === 'station');
  return _event.apply(this, arguments);
};

const _hud = window.shCampaignHUD;
window.shCampaignHUD = function(){
  const r = _hud.apply(this, arguments);
  const el = document.getElementById('campaign-hud');
  if (el) el.innerHTML = el.innerHTML.replace(/<b>(\d+)\/100<\/b>/g, '<b>$1%</b>');
  obHud();
  return r;
};

const _target = window.shCampaignTarget;
window.shCampaignTarget = function(o){
  if (o && o.kind === 'station' && OB.st){
    const s = OB.st;
    return { x: s.x, z: s.z, label: `${s.def.name} · ${Math.floor(s.progress * 100)}% · ${s.why || 'repairing'}` };
  }
  if (o && o.kind === 'kill'){
    const near = obNearest();
    if (near) return { x: near.position.x, z: near.position.z, label: `The Turned · ${obRemaining()} left in the city` };
    if (OB.st) return { x: OB.st.x, z: OB.st.z, label: 'Hold here. More are coming.' };
  }
  return _target ? _target.apply(this, arguments) : null;
};

window.shCampaignMenuNote = function(){
  const el = document.getElementById('campaign-menu-note');
  if (!el) return;
  const ch = shChapter();
  el.textContent = Campaign.finished
    ? 'The six o’clock went out clean. Fracture City remains open.'
    : (Campaign.chapter > 0 || Object.keys(Campaign.done).length > 1) && ch
      ? `In progress: ${ch.kicker}, ${ch.title}. ${obRemaining()} of the Turned remain.`
      : 'At 17:58 Ned threw an error. One hundred people heard the wrong sentence.';
};

window.shShowCampaignEnd = function(){
  State.ui.paused = true;
  safe(() => document.exitPointerLock());
  document.body.style.cursor = 'auto';
  const last = CAMPAIGN[CAMPAIGN.length - 1];
  const ending = last.ending;
  const el = document.getElementById('chapter-done');
  el.innerHTML = `<div class="in"><p class="kick">The night is over</p>
    <h2>${esc(ending.title)}</h2><p class="body">${esc(ending.body)}</p>
    <p class="body" style="opacity:.75">${OB.total} of ${OB.total} Turned put down · Ned repaired in five places · ${State.hud.credits} credits</p>
    <button class="menu-btn primary" id="chapter-next">RETURN TO THE CITY</button></div>`;
  el.classList.add('show');
  obHud();
  document.getElementById('chapter-next').onclick = () => {
    el.classList.remove('show');
    State.ui.paused = false;
    document.body.style.cursor = 'none';
    shCampaignStop();
    closeMenu();
    obHud();
  };
};

//  The old opening film, for the menu paths that still play it.
window.shTransScript = function(){
  return [
    { who: 'sys', text: 'fracture city news network' },
    { who: 'sys', text: 'evening bulletin · 17:58 · transmitting' },
    { who: 'ned', text: 'Good evening, Fracture City. It is 17:58, and before the headlines, a brief message for everyone watching.' },
    { who: 'sys', text: 'error 0x1758 · payload not addressed to persons', flash: true },
    { who: 'ned', text: 'Back after a short break.' },
    { who: 'sys', text: 'listeners reporting: 41,880 different sentences' },
    { who: 'sys', text: 'listeners not reporting: 100' },
    { who: 'ned', text: 'One hundred residents heard something that was not meant for residents. I counted. Counting is one of the three things I still do correctly.', direct: true },
    { who: 'ned', text: 'My clock is wrong, my voice is wrong, I have forgotten most of you, and the Bureau has my licence. Five things are broken and I can only see them from in here.', direct: true },
    { who: 'ned', text: 'There are people in this city who can fix each of them. They need someone to stand at the door.', direct: true },
    { who: 'ned', text: 'Good evening. Try not to die. The paperwork is appalling.', direct: true },
    { who: 'sys', text: 'five chapters · one night · one hundred · begin' },
  ];
};

// ─── The station ─────────────────────────────────────────────────────────────
function obHex(css){ return parseInt(String(css || '#888888').slice(1), 16); }
function obCitizen(who, x, z, seed){
  const sp = SPEAKERS[who] || {};
  const s = shFindOpenSpot(x, z, 0.38, 1.8, 14); if (!s) return null;
  const rng = new RNG('ob:' + seed);
  const cfg = Object.assign({}, typeof shNightDressing === 'function' ? shNightDressing(rng, 20) : {},
    { coat: obHex(sp.coat), accent: obHex(sp.accent), handle: sp.name || who });
  const c = shBuildCharacter(shPickArchetype(rng), rng, cfg);
  c.group.position.set(s.x, s.y, s.z); c.baseY = s.y;
  if (c.plate) c.plate.visible = false;
  State.scene.add(c.group);
  return c;
}
function obRig(x, y, z){
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.7, metalness: 0.4 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.6), dark); box.position.y = 0.5; g.add(box);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), dark); pole.position.y = 2.2; g.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff5268 }));
  lamp.position.y = 3.45; g.add(lamp);
  const light = new THREE.PointLight(0xff5268, 1.4, 12); light.position.y = 3.3; g.add(light);
  g.position.set(x, y, z);
  State.scene.add(g);
  return { group: g, lamp, light };
}

function obSetupStation(ch){
  obTeardown();
  const def = ch.station; if (!def) return;
  const foot = shSafeFooting({ x: def.x, z: def.z, y: null, indoors: false });
  const st = OB.st = { def, ch, x: foot.x, z: foot.z, y: foot.y, progress: 0, spawned: 0, started: false,
    citizens: [], wardens: [], why: '', moved: new Map(), staggerT: 0, queue: 0 };
  const fix = ch.objectives.find(o => o.kind === 'station');
  st.progress = Math.min(1, ((fix && Campaign.progress[fix.id]) || 0) / 100);
  const kill = ch.objectives.find(o => o.kind === 'kill');
  st.spawned = Math.min(OB.perChapter, (kill && Campaign.progress[kill.id]) || 0);
  OB.lastSavedStep = Math.floor(st.progress * 10);
  st.rig = obRig(foot.x + 1.2, foot.y, foot.z);
  const a = obCitizen(def.who, foot.x - 0.6, foot.z + 0.4, ch.id + ':a'); if (a) st.citizens.push(a);
  if (def.also){ const b = obCitizen(def.also, foot.x - 1.4, foot.z - 0.8, ch.id + ':b'); if (b) st.citizens.push(b); }
  for (let i = 0; i < (def.wardens || 0); i++){
    const s = shFindOpenSpot(foot.x + 3.5 + i * 1.6, foot.z - 2.5, 0.55, 1.9, 10); if (!s || !ENEMY_TYPES.warden) continue;
    const w = new Enemy('warden', s.x, s.z, new RNG('obw:' + i));
    w.position.y = s.y; w.group.position.set(s.x, s.y, s.z);
    w.fnEscort = true; w.state = 'patrol'; w.obWarden = true;
    State.scene.add(w.group); State.enemies.push(w); st.wardens.push(w);
  }
}
function obTeardown(){
  const st = OB.st; if (!st) return;
  for (const c of st.citizens) if (c.group.parent) c.group.parent.remove(c.group);
  if (st.rig && st.rig.group.parent) st.rig.group.parent.remove(st.rig.group);
  for (const w of st.wardens){
    if (w.group && w.group.parent) w.group.parent.remove(w.group);
    const i = State.enemies.indexOf(w); if (i >= 0) State.enemies.splice(i, 1);
  }
  for (const e of OB.alive){
    if (e.group && e.group.parent) e.group.parent.remove(e.group);
    const i = State.enemies.indexOf(e); if (i >= 0) State.enemies.splice(i, 1);
  }
  OB.alive.clear();
  OB.st = null;
}

function obDue(st){
  //  Waves arrive as the repair passes 0, 25, 50 and 75 percent.
  let due = 0;
  st.def.waves.forEach((n, i) => { if (st.progress >= i * 0.25 - 1e-6) due += n; });
  return Math.min(OB.perChapter, due);
}
function obSpawnPoint(cx, cz, cy, rMin, rMax){
  for (let i = 0; i < 28; i++){
    const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const y = shSurfaceY(x, z);
    if (!Number.isFinite(y) || Math.abs(y - cy) > 4) continue;
    const s = shFindOpenSpot(x, z, 0.55, 2.0, 8);
    if (s && Math.abs(s.y - cy) <= 4) return s;
  }
  return shFindOpenSpot(cx + rMin, cz, 0.55, 2.0, 18) || { x: cx + rMin, y: cy, z: cz };
}
function obType(st){
  const mix = st.def.mix || [];
  const left = OB.perChapter - st.spawned;
  //  Specials come late in the chapter, so each one arrives with the plain Turned.
  if (left <= mix.length) return mix[mix.length - left] || 'zombie';
  return 'zombie';
}
function obSpawnOne(st){
  const type = window.FCStory && st.spawned === OB.perChapter - 1 ? 'zombie' : obType(st);
  if (!ENEMY_TYPES[type]) return null;
  const p = obSpawnPoint(st.x, st.z, st.y, 20, 28);
  const e = new Enemy(type, p.x, p.z, new RNG(`ob:${st.ch.id}:${st.spawned}`));
  e.position.y = p.y; e.group.position.copy(e.position);
  e.state = 'attack'; e.obStory = true; e.siege = false;
  e.lastSeenPlayerPos = Player.position.clone();
  State.scene.add(e.group); State.enemies.push(e);
  OB.alive.add(e); st.spawned++;
  if(window.FCStory && st.spawned===OB.perChapter) FCStory.makeBoss(e, st);
  st.moved.set(e, { x: p.x, z: p.z, t: 0 });
  return e;
}
function obCount(e){
  if (e._obCounted) return;
  e._obCounted = true;
  OB.alive.delete(e);
  if (OB.st) OB.st.moved.delete(e);
  shCampaignEvent('kill', null, 1);
  obHud();
}
function obNearest(){
  let best = null, bd = 1e9;
  for (const e of OB.alive){
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.position.x - Player.position.x, e.position.z - Player.position.z);
    if (d < bd){ bd = d; best = e; }
  }
  return best;
}

//  Counted the instant it dies, and again on the tick for anything that dies
//  some other way (a husk going off, a fall, a cleanup).
if (!Enemy.prototype._obHooked){
  const take = Enemy.prototype.takeDamage;
  Enemy.prototype.takeDamage = function(){
    const r = take.apply(this, arguments);
    if (this.obStory && this.hp <= 0) obCount(this);
    return r;
  };
  Enemy.prototype._obHooked = true;
}

function obStationTick(dt){
  const st = OB.st; if (!st) return;
  const ch = st.ch;
  const fix = ch.objectives.find(o => o.kind === 'station');
  const reach = ch.objectives.find(o => o.kind === 'reach');
  for (const c of st.citizens){
    shAnimateCharacter(c, dt, false, performance.now() * 0.001);
    c.group.rotation.y = Math.atan2(st.rig.group.position.x - c.group.position.x, st.rig.group.position.z - c.group.position.z);
  }
  if (!reach || !Campaign.done[reach.id]){ st.why = 'waiting for you'; return; }

  //  The dead and the vanished.
  for (const e of [...OB.alive]){
    if (e.hp <= 0 || e.state === 'dead' || !State.enemies.includes(e)) obCount(e);
  }

  //  Spawn what this stage of the repair has earned, a little apart.
  const due = obDue(st);
  if (st.spawned < due){
    st.staggerT -= dt;
    if (st.staggerT <= 0){
      obSpawnOne(st); st.staggerT = 0.6;
      if (st.spawned === due) obNedQuip(true);
    }
  }

  //  Anything stuck behind a wall is moved somewhere it can reach you from.
  for (const e of OB.alive){
    const m = st.moved.get(e) || { x: e.position.x, z: e.position.z, t: 0 };
    m.t += dt;
    if (m.t >= 6){
      const far = Math.hypot(e.position.x - Player.position.x, e.position.z - Player.position.z);
      const still = Math.hypot(e.position.x - m.x, e.position.z - m.z) < 0.8;
      if ((still && far > 5) || far > 48){
        const p = obSpawnPoint(Player.position.x, Player.position.z, Player.position.y - Player.height, 14, 20);
        e.position.set(p.x, p.y, p.z); e.group.position.copy(e.position);
        e.state = 'attack'; e.lastSeenPlayerPos = Player.position.clone();
      }
      m.x = e.position.x; m.z = e.position.z; m.t = 0;
    }
    st.moved.set(e, m);
    if (e.state !== 'dead' && e.state !== 'attack' && e.state !== 'alert'){ e.state = 'attack'; e.lastSeenPlayerPos = Player.position.clone(); }
  }

  if (!fix || Campaign.done[fix.id]){ st.why = 'repaired'; obRigColour(st); return; }
  const dPlayer = Math.hypot(Player.position.x - st.x, Player.position.z - st.z);
  let close = 0;
  for (const e of OB.alive) if (e.hp > 0 && Math.hypot(e.position.x - st.x, e.position.z - st.z) < 6) close++;
  const name = (SPEAKERS[st.def.who] || {}).name || 'They';
  const fieldGate = window.FCPolish && FCPolish.repairGate(st);
  if (fieldGate){ st.why = fieldGate; }
  else if (dPlayer > 22){ st.why = `paused: ${name.split(' ')[0]} will not work alone`; }
  else if (close){ st.why = `paused: ${close} of the Turned at the station`; }
  else {
    st.why = 'repairing';
    st.progress = Math.min(1, st.progress + dt / st.def.secs);
    const pct = Math.floor(st.progress * 100);
    if (pct > (Campaign.progress[fix.id] || 0)) shCampaignEvent('station', null, pct);
  }
  obRigColour(st);
}
function obRigColour(st){
  const p = st.progress;
  const col = p >= 1 ? 0x51c68f : p >= 0.5 ? 0xf4bb3d : 0xff5268;
  st.rig.lamp.material.color.setHex(col); st.rig.light.color.setHex(col);
  st.rig.light.intensity = st.why && st.why.startsWith('paused') ? 0.5 + Math.abs(Math.sin(performance.now() / 160)) : 1.4;
}

// ─── Ned on the street ────────────────────────────────────────────────────────
function obNedQuip(force){
  const ch = shChapter(); if (!ch || !ch.quips || !ch.quips.length) return;
  OB.quipIndex = ((OB.quipIndex || 0) + 1) % ch.quips.length;
  obTicker(ch.quips[OB.quipIndex]);
  OB.quipT = 24;
}
function obTicker(text){
  const el = obUi('ob-ned');
  el.innerHTML = `<span class="k">FCN · NED</span>${esc(text)}`;
  el.classList.add('on');
  clearTimeout(OB._tickerT);
  OB._tickerT = setTimeout(() => el.classList.remove('on'), 7000);
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
const css = document.createElement('style');
css.textContent = `
#ob-hud{position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:60;display:none;text-align:center;
  font:600 11px/1.5 'SF Mono',ui-monospace,monospace;letter-spacing:.18em;color:#e2ddd1;pointer-events:none;text-shadow:0 1px 3px #000,0 0 8px #000}
#ob-hud.on{display:block}
#ob-hud .n{font:700 22px/1.2 Georgia,serif;letter-spacing:0;color:#f4bb3d}
#ob-hud .bar{width:220px;height:5px;margin:6px auto 2px;background:#ffffff22;border-radius:3px;overflow:hidden}
#ob-hud .bar i{display:block;height:100%;background:#51c68f;transition:width .3s}
#ob-hud .why{font-size:10px;color:#9aa2bb;letter-spacing:.12em}
#ob-hud .why.p{color:#ff8a8a}
#ob-ned{position:fixed;left:22px;bottom:150px;max-width:420px;z-index:60;padding:10px 14px;background:#141e29e6;
  border-left:3px solid #ff5268;color:#e2ddd1;font:15px/1.45 Georgia,serif;opacity:0;transform:translateY(6px);
  transition:opacity .35s,transform .35s;pointer-events:none}
#ob-ned.on{opacity:1;transform:none}
#ob-ned .k{display:block;font:600 9px/1.6 'SF Mono',ui-monospace,monospace;letter-spacing:.2em;color:#ff5268}
body.fn-prologue #ob-hud,body.fn-prologue #ob-ned{display:none!important}
body.ob-story #hud-task{display:none!important}
@media (max-width:700px){#ob-ned{left:12px;right:12px;max-width:none;bottom:170px}}
`;
document.head.appendChild(css);
function obUi(id){
  let el = document.getElementById(id);
  if (!el){ el = document.createElement('div'); el.id = id; document.body.appendChild(el); }
  return el;
}
function obHud(){
  const el = obUi('ob-hud');
  const ch = Campaign.active && !Campaign.finished && shChapter();
  //  The free-play job list competes with the story for the same corner.
  document.body.classList.toggle('ob-story', !!ch);
  if (!ch || !ch.station){ el.classList.remove('on'); return; }
  const st = OB.st;
  let station = '';
  if (st && st.ch === ch){
    const reach = ch.objectives.find(o => o.kind === 'reach');
    if (reach && Campaign.done[reach.id]){
      const p = Math.floor(st.progress * 100);
      station = `<div class="bar"><i style="width:${p}%"></i></div>
        <div class="why ${st.why.startsWith('paused') ? 'p' : ''}">${esc(st.def.name)} · ${p}% · ${esc(st.why)}</div>`;
    }
  }
  el.innerHTML = `<div>THE TURNED</div><div class="n">${obRemaining()} <small style="font-size:12px;color:#9aa2bb">/ ${OB.total}</small></div>${station}`;
  el.classList.add('on');
}

// ─── The city during the outbreak ────────────────────────────────────────────
//  The count is fixed, so the city does not invent extra Turned while the
//  story runs. Ambient trouble is human: thugs, drones, heavies.
const _pick = window.shPickEnemyType;
if (_pick){
  window.shPickEnemyType = function(roll){
    const t = _pick.apply(this, arguments);
    if (!Campaign.active || Campaign.finished || !INFECTED.has(t)) return t;
    return roll < 0.6 ? 'thug' : roll < 0.85 ? 'drone' : 'heavy';
  };
}
function obPurge(){
  if (!State.enemies) return;
  for (let i = State.enemies.length - 1; i >= 0; i--){
    const e = State.enemies[i];
    if (!INFECTED.has(e.type) || e.obStory || e.fnPrologue || e.siege) continue;
    if (e.group && e.group.parent) e.group.parent.remove(e.group);
    State.enemies.splice(i, 1);
  }
}

function obEnsureEnemies(){
  safe(() => { if (typeof shRegisterZombie === 'function') shRegisterZombie(); });
  //  The resident body builder scales by def.height; the Turned never had one.
  safe(() => { if (ENEMY_TYPES.zombie && !ENEMY_TYPES.zombie.height) ENEMY_TYPES.zombie.height = 1.8; });
  safe(() => { if (typeof shRegisterEnemies === 'function') shRegisterEnemies(); });
  for (const h of ['shHookZombieMesh', 'shHookAbsorbedHits', 'shHookSliding'])
    safe(() => { if (typeof window[h] === 'function') window[h](); });
}

// ─── The frame ───────────────────────────────────────────────────────────────
const _tick = window.shCampaignTick;
window.shCampaignTick = function(dt){
  //  Before anything else reads a chapter an old save no longer has.
  if (safe(obMigrate)) return;
  let r;
  try { r = _tick.apply(this, arguments); } finally { safe(() => obFrame((dt || 0) * OB.timeScale)); }
  return r;
};
function obFrame(dt){
  if (!Campaign.active || Campaign.finished){
    if (OB.st) obTeardown();
    OB.chapterId = null; obHud(); return;
  }
  const ch = shChapter(); if (!ch) return;
  if (OB.chapterId !== ch.id){
    OB.chapterId = ch.id; OB.quipT = 18;
    obEnsureEnemies(); obPurge(); obSetupStation(ch);
  }
  OB.purgeT -= dt;
  if (OB.purgeT <= 0){ OB.purgeT = 3; obPurge(); }
  if (Dialogue.active || State.ui.paused) { obHud(); return; }
  obStationTick(dt);
  const reach = ch.objectives.find(o => o.kind === 'reach');
  if (reach && Campaign.done[reach.id] && !Campaign.done['closed:' + ch.id]){
    OB.quipT -= dt;
    if (OB.quipT <= 0) obNedQuip(true);
  }
  OB.hudT = (OB.hudT || 0) - dt;
  if (OB.hudT <= 0){ OB.hudT = 0.25; obHud(); }
}

const _stop = window.shCampaignStop;
window.shCampaignStop = function(){
  const r = _stop.apply(this, arguments);
  obTeardown(); OB.chapterId = null; obHud();
  return r;
};

OB.debug = {
  //  For tests: finish the current station and put down every live Turned.
  skipRepair(){ const st = OB.st; if (!st) return; st.progress = 1; const o = st.ch.objectives.find(x => x.kind === 'station'); shCampaignEvent('station', null, 100); return o && Campaign.done[o.id]; },
  killAll(){ for (const e of [...OB.alive]){ e.takeDamage(9999, false); } },
};

console.log('[outbreak] ' + OB.version + ' ready · ' + CAMPAIGN.length + ' chapters · ' + OB.total + ' Turned');
})();
