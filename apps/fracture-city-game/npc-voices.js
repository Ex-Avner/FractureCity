/* NPC voices: conversations that go somewhere, people who remember you, and
   real headlines when someone has been reading their phone.

   Talking to a resident now opens a short conversation instead of a single
   line. You pick replies (click, tap, or 1 to 4). Each role has its own
   story told in three parts across visits, its own rumours, and its own take
   on Ned. They remember you: whether you have met, whether you told them your
   name, how you treated them, and how far into their story you got. Memory is
   kept on the account when signed in on the game server; offline memories stay in this browser.

   Real news. In the online city, couriers, broadcasters, clerks and vendors
   sometimes bring up a real headline from the Common Ground wire. The headline
   is quoted exactly, tagged REAL NEWS with its source and date, never
   paraphrased, and stories about death, violence, war, disasters, crime or
   politics are filtered out. Ask "Where's that from?" for the source and link.
   Offline, or when nothing passes the filter, they stick to their own lines.

   Writing rules, same as the original barks: sayable by a tired person on a
   wet street; never explains the premise; true first, funny second. */
(function(){'use strict';
if (typeof State === 'undefined' || typeof shTalkTo !== 'function') return;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ─── Who says what ─────────────────────────────────────────────────────────
//  story: told one part per visit. rumor: district talk. ned: their take on the
//  anchor. back/warm/cold: greetings for someone they have met. rude: how they
//  take being brushed off. bye: parting.
const V = {
 courier: {
  story: [
   'I used to drive for the same company. Then they sold the vans to a company that rents the vans back to them. Now I carry everything the vans used to.',
   'Tier 12 has a woman who orders one thing a day so somebody climbs the stairs. I worked that out in my second year. I still bring it up last, so I can sit for a minute.',
   'I keep a map of every door that opens before I knock. Short list. Yours would be on it, if you had a door.',
  ],
  rumor: [
   'The depot on the east side is shipping empty crates out and full ones in. Somebody is filling them in between, and nobody wants to sign for what.',
   'Two buildings on my route changed their numbers overnight. Same buildings. New numbers. The letters still arrive, which is the frightening part.',
   'There is a lift in the Ward that works. Everyone knows which one. Nobody says it out loud in case the Bureau hears.',
  ],
  ned: [
   'Ned reads the delivery delays like they are weather. In a way they are. Nobody causes them and everybody gets wet.',
   'I deliver to the tower. Every parcel for Ned is addressed to a person and signed for by a department.',
  ],
  back: ['Back again, {name}. I have six minutes, which is a lot of minutes for me.', '{name}. You walk this way a lot for someone with no deliveries.'],
  warm: ['{name}! Good. Walk with me to the corner, it counts as a break if I am talking.'],
  cold: ['You again. I remember. I remember everyone who costs me time.'],
  rude: 'Fine. I have nine drops and none of them are you.',
  bye: ['Go on. If you see a lift that works, keep it to yourself.', 'Right. Stairs are calling.'],
 },
 broadcaster: {
  story: [
   'I was third chair on the evening desk. Then second. Then the desk went to review, and review is where desks go to stop being desks.',
   'I still write a bulletin every morning. I read it to the corner. The corner has never once asked me to soften anything.',
   'The man who read the six o’clock taught me one thing: say it like it is already true and nobody checks. I wish he had taught me something else.',
  ],
  rumor: [
   'There is a second feed under the tower’s feed. Same anchor, different words, a quarter second later. Only the dogs hear it properly.',
   'Somebody keeps leaving corrections taped to the transmitter fence. Typed. Signed with initials nobody in the building has.',
   'The network has a word for every kind of silence. I have counted forty. I think the forty-first is the one they use on us.',
  ],
  ned: [
   'Ned does not lie. Ned arrives at the truth from a slightly different direction each night and parks badly.',
   'I respect Ned. He has never once been off the air, and we have all been off the air.',
  ],
  back: ['{name}, returning to the story. Viewers love a returning character.', 'Ah. {name}. You are in tonight’s bulletin, in a small way.'],
  warm: ['{name}! My one reliable audience. Stand there, the light is better.'],
  cold: ['You. I filed you under “uncooperative witness”. It is not a long file.'],
  rude: 'Noted for the record. The record is very long and nobody reads it.',
  bye: ['This has been the corner. Goodnight.', 'Stay tuned. Or don’t. It is a free city, technically.'],
 },
 clerk: {
  story: [
   'I came in for a temporary post covering a woman on leave. She never came back. Neither did my temporary.',
   'Every form has a box at the bottom marked “other”. I read every “other”. That is where people tell the truth.',
   'One day I am going to approve something. Just one thing, all the way through, no queries. I have not decided what. That is the only power I have.',
  ],
  rumor: [
   'Window Two has started stamping things in red. Nobody issued red ink. Nobody has asked where it came from.',
   'There is a file in the basement with no category. It gets thicker on Tuesdays.',
   'The Bureau has a list of people who are temporarily unavailable. It is not temporary and it is not short.',
  ],
  ned: [
   'Ned is filed under Infrastructure, not Personnel. Somebody decided that very early on and it has saved a great deal of paperwork.',
   'I processed Ned’s licence renewal. Every field was filled in correctly. That was the most frightening form I have ever seen.',
  ],
  back: ['{name}. I have you on file. Favourably, so far.', 'Back, {name}? Take a number. You are the only number.'],
  warm: ['{name}. I kept a pen for you. Do not tell the others about the pen.'],
  cold: ['You are on a list now. It is a small list. It is not a good one.'],
  rude: 'Very well. I will note the tone of the enquiry.',
  bye: ['Window Three closes at four. As ever.', 'Mind the queue on your way out. It is mostly ghosts.'],
 },
 busker: {
  story: [
   'I had a band. Four of us. Then three. Then a duo, which is two people disagreeing in tune. Now it is me and the ramp.',
   'There is a song I only play when the square is empty. I wrote it for somebody who used to stand where you are standing.',
   'I am saving for a real amplifier. I have been saving for nine years. The amplifier has become a sort of religion.',
  ],
  rumor: [
   'The square sounds different since they rebuilt it. Something under the mirror hums in B flat.',
   'Somebody left a full drum kit by the flood gate. No note. I have not touched it. It feels like a test.',
   'The pigeons near the tower walk in time. I have checked. Ninety-six beats a minute, every bird.',
  ],
  ned: [
   'Ned has perfect pitch and no rhythm. I have heard him say “good evening” in four keys.',
   'I sampled Ned once. The record label sent a letter. The letter was also in Ned’s voice.',
  ],
  back: ['{name}! My audience of one returns. Requests?', 'There you are, {name}. I saved you the good four bars.'],
  warm: ['{name}. Sit. This next one is long and you deserve it.'],
  cold: ['Oh. You. I will play something short.'],
  rude: 'Fair. Not everyone is a music person. Most people, in fact.',
  bye: ['Same time tomorrow. I am always here at the same time. It is the whole point.', 'Go well. Hum something.'],
 },
 vendor: {
  story: [
   'My father had this pitch. He said it was temporary too. He said it about everything, including my mother.',
   'I can tell what a district is going through from what it buys. This week it is salt and batteries. That is never a good week.',
   'I gave a kid credit once. He paid me back ten years later with interest and a hug. I do not give credit. I am waiting for the next hug.',
  ],
  rumor: [
   'The corner store raised its prices and then closed. Nobody saw it close. One morning it was a different shop.',
   'Somebody is buying all the umbrellas in the Mile. Not stealing. Buying. Paying full price. That is how I know something is wrong.',
   'The Bureau inspectors stopped coming. Either they gave up or they are watching from somewhere with a better view.',
  ],
  ned: [
   'Ned did a segment on my stall once. Said it was “a cornerstone of the community”. Business went down. People hate a cornerstone.',
   'Ned buys nothing. Ned has never been hungry. You can see it in how he reads the food prices.',
  ],
  back: ['{name}! The usual? You do not have a usual. Let us invent one.', '{name}. Back for the thing you did not buy last time?'],
  warm: ['{name}! For you, the good stuff, from under the counter. It is the same stuff. It is just under the counter.'],
  cold: ['Cash only, for you. I remember faces. I remember yours.'],
  rude: 'No problem. The awning is free. Standing under it is free. That is all you get free.',
  bye: ['Come back hungry.', 'Mind the puddle. It is deeper than it looks. Everything here is.'],
 },
 medic: {
  story: [
   'I trained at the hospital before it became a “health hub”. The hub has a lovely atrium. The atrium has never once stitched anybody.',
   'There is an old man on the third floor of the Ward I check every Thursday. He is fine. He knows he is fine. We both pretend otherwise, for the company.',
   'I keep a list of everyone I could not get to in time. It is shorter than it should be. I am proud of that and I hate being proud of that.',
  ],
  rumor: [
   'The pharmacy is out of the cheap painkillers and full of the expensive ones. That is a decision somebody made in a nice chair.',
   'Three people this week with the same cough and the same story about the depot. I have written it down. Writing it down is all I can do.',
   'Somebody has been leaving clean bandages at the bus shelters. Folded properly. Trained hands.',
  ],
  ned: [
   'Ned reports the hospital waiting times every night. He has never once had to wait. I think it bothers him, a little.',
   'If Ned ever falls over, I am the closest. I have thought about what I would do. I would do my job.',
  ],
  back: ['{name}. You look better than last time. Or the light is kinder.', 'Back, {name}? Nothing broken, I hope. Not on you, anyway.'],
  warm: ['{name}. Good to see you upright. Upright is my favourite thing about people.'],
  cold: ['Oh, it is you. I will still help you. I have to. It is the worst part of the job.'],
  rude: 'Fine. I will be here when you change your mind. People always change their mind around me.',
  bye: ['Drink some water. Nobody does.', 'Look after yourself. Somebody has to and it will not be the hub.'],
 },
 runner: {
  story: [
   'I started running to catch a bus. Missed it. Kept going. That was six years ago and I still have not caught that bus.',
   'There is a route through the city with no traffic lights at all. Fourteen kilometres. I am the only one who knows it and I am telling no one.',
   'I timed myself against the evening bulletin once. Ned finished first. I have been training ever since.',
  ],
  rumor: [
   'The long road out past the wilds is shorter coming back. I have measured it. Nobody believes me.',
   'Somebody is running at night with no lights, no shoes and no hurry. I only ever see them from behind.',
   'The Mile’s streets are all slightly downhill. Every direction. Work that out.',
  ],
  ned: [
   'Ned never moves and he is always ahead. That is the most annoying thing about him.',
   'I passed the tower at a dead sprint once and Ned said my name on air. Coincidence. Probably.',
  ],
  back: ['{name}! Keeping up?', 'Hey, {name}. Thirty seconds. Go.'],
  warm: ['{name}! Run with me to the lights. You will not, but the offer stands.'],
  cold: ['Oh. You. Ten seconds, then.'],
  rude: 'Fine. Faster without you anyway.',
  bye: ['Gone.', 'Keep moving. Standing still is how the city catches you.'],
 },
 drifter: {
  story: [
   'I had a flat on the eleventh floor. Then they found something in the walls and rehoused me. Temporarily. I keep a key to the old place. It still turns.',
   'Every street in this district used to have a different name. I know all of them. Nobody asks. If you ask, I will tell you three.',
   'I watch the same window every night on Ash Row. There is a light on and nobody ever moves. I think it is for me. I think somebody left it on for me.',
  ],
  rumor: [
   'The benches in the square are new and they are wrong. You cannot lie down on them. That was the brief.',
   'There are footprints in the wet concrete by the depot that go in and do not come out.',
   'Somebody comes round at three in the morning and counts us. Not the Bureau. Somebody with a nicer coat.',
  ],
  ned: [
   'Ned used to say goodnight to the whole city. Now he says it to the viewers. I noticed the change. I am not a viewer.',
   'Ned and me have been on this street the same number of years. One of us gets a salary.',
  ],
  back: ['{name}. You came back. People do not.', 'Evening, {name}. Or whatever it is.'],
  warm: ['{name}. Sit a minute. The step is dry on this end.'],
  cold: ['Oh. You. I remember. I remember better than people think.'],
  rude: 'Right. I have been told to move along by better.',
  bye: ['Mind how you go.', 'Same step tomorrow. I have nowhere better and neither, I think, do you.'],
 },
 suit: {
  story: [
   'I manage a team of nine. I have met four of them. The other five are in a time zone the company invented.',
   'My job is to turn problems into “workstreams”. Once a thing is a workstream, nobody has to solve it. That was the trick and I am very good at it.',
   'I was going to quit last year. I wrote the email. It is still in drafts. Sometimes I open it and read it like a letter from someone braver.',
  ],
  rumor: [
   'The Mile is getting “regenerated”. That is the word. Nobody in the meeting could say what it was being regenerated into.',
   'There is a floor in the tower that is not on the lift buttons. I have a meeting there on Thursday.',
   'Rents are going up three streets east. When rents go up you hear it as quiet. Listen. Quieter, yes?',
  ],
  ned: [
   'Ned is a strategic asset. I have a slide about Ned. It has one bullet point and the bullet point is a question mark.',
   'Ned’s ratings are flat, which in this economy is a triumph.',
  ],
  back: ['{name}, circling back. Love it.', '{name}. Let us take this offline. We are offline. Carry on.'],
  warm: ['{name}! Genuinely good to see you. I do not say genuinely about anything.'],
  cold: ['You. I flagged you to my manager. My manager is a form.'],
  rude: 'Understood. I will park that.',
  bye: ['Let us touch base.', 'I have a hard stop. Everything I have is a hard stop.'],
 },
 punk: {
  story: [
   'I painted the first stencil in the Mile. Little crow with a microphone. They have painted over it nineteen times. It is still there every morning.',
   'My mum works at the Bureau. Window Two. We do not talk about it. We talk about everything else at great length.',
   'I am in a band called Temporarily Unavailable. We have never played a gig. We are booked solid.',
  ],
  rumor: [
   'The cameras on Ash Row are off. Have been for a month. They are still pointed at things, out of habit.',
   'Somebody is painting doors on blank walls in the Ward. Good doors. One of them opened.',
   'The tower antenna flickers in Morse at four in the morning. It says the same word over and over. I am not telling you the word.',
  ],
  ned: [
   'Ned is a man reading a script written by a building. Respect to Ned. Death to the building.',
   'We did a Ned cover. Just him saying “good evening” over drums. It slaps. It is our only song.',
  ],
  back: ['{name}! Still alive. Nice.', 'Oi, {name}. You are becoming a regular. Gross. Love it.'],
  warm: ['{name}! Take a sticker. Everyone I like gets a sticker.'],
  cold: ['You. Yeah. I clocked you.'],
  rude: 'Whatever. Not everyone has taste.',
  bye: ['Stay loud.', 'Do not buy anything from the regeneration people.'],
 },
};
V.keeper = {
 story: [
  'This shop was meant to be a stopgap while I worked out what to do with my life. The shop worked it out for me.',
  'I know every regular by what they nearly buy. You are a nearly. Everybody starts as a nearly.',
  'The landlord wants to “refresh the frontage”. I have been here long enough to know that means me.',
 ],
 rumor: V.vendor.rumor, ned: V.vendor.ned,
 back: ['{name}! Back in. I knew you would be.', 'Welcome back, {name}. Nothing has changed. That is the selling point.'],
 warm: ['{name}! For you, I will open the good drawer.'],
 cold: ['Browsing again, are we.'],
 rude: 'Suit yourself. The door is where you left it.',
 bye: ['Come back soon.', 'Mind the step. It has been loose for years. It is part of the charm.'],
};
const NEWS_ROLES = new Set(['courier', 'broadcaster', 'clerk', 'vendor', 'keeper']);
const NEWS_LEAD = {
 courier: 'Read this on my phone between drops.',
 broadcaster: 'Something from outside the building, for once. Real wire, not ours.',
 clerk: 'I read the outside news on my lunch. It helps to know there is an outside.',
 vendor: 'Customer left this up on their phone. I read it twice.',
 keeper: 'Somebody was reading this out at the counter earlier.',
};
const NEWS_TAIL = {
 courier: 'Real news, that. Not ours. Strange to read something nobody here wrote.',
 broadcaster: 'Real wire. I read it exactly as it came in, which is more than the tower does.',
 clerk: 'That is the real world. I am told it continues past the depot.',
 vendor: 'Real, apparently. I like knowing things are happening somewhere.',
 keeper: 'That is the real news, not the tower kind.',
};

// ─── Real news ─────────────────────────────────────────────────────────────
//  Heavy topics are dropped, not reworded. A tired NPC is the wrong voice for
//  anybody's tragedy, and a filter that misses sometimes is why this is limited
//  to a few roles and a quarter of conversations.
const HEAVY = /\b(dead|deaths?|dies|died|dying|kill(s|ed|ing)?|murder\w*|shoot\w*|shot|gun\w*|bomb\w*|blast|explosi\w+|attack\w*|war|wars|warfare|troops|military|army|missile\w*|strike|strikes|airstrike\w*|terror\w*|hostage\w*|massacre\w*|genocide|violen\w+|victim\w*|injur\w+|wounded|casualt\w+|crash\w*|collapse\w*|disaster\w*|earthquake\w*|flood\w*|hurricane\w*|cyclone\w*|typhoon\w*|tornado\w*|wildfire\w*|fire|fires|tsunami\w*|famine|starv\w+|drought|refugee\w*|abuse\w*|assault\w*|rape\w*|traffick\w+|suicid\w+|overdose\w*|cancer|disease\w*|outbreak\w*|pandemic|epidemic|virus|arrest\w*|jail\w*|prison\w*|detain\w*|sentenc\w+|trial|court|police|crime\w*|criminal\w*|election\w*|vote\w*|voting|president\w*|minister\w*|government\w*|parliament\w*|congress|senate|regime\w*|protest\w*|sanction\w*|coup|dictator\w*|politic\w*|party|campaign\w*|censor\w*|persecut\w+|religio\w+|ethnic|racis\w+|funeral\w*|grief|mourn\w*|tragedy|tragic|crisis|emergency)\b/i;
let news = { items: [], at: 0, busy: false };
async function loadNews(){
 if (!location.pathname.startsWith('/city/') || news.busy || performance.now() - news.at < 600000 && news.at) return;
 news.busy = true;
 try {
  const r = await fetch('/api/news', { signal: AbortSignal.timeout(12000) });
  if (r.ok){ const d = await r.json(); news.items = (d.items || []).filter(okHeadline); }
 } catch (e){} finally { news.at = performance.now(); news.busy = false; }
}
function okHeadline(n){
 if (!n || typeof n.title !== 'string' || !n.title.trim() || HEAVY.test(n.title)) return false;
 if (!Number.isFinite(n.published) || Date.now() - n.published > 3 * 86400000) return false;
 try { if (new URL(n.url).protocol !== 'https:') return false; } catch (e){ return false; }
 return true;
}
Object.defineProperty(window, '__npcNewsForTest', { value: { okHeadline, set: items => { news.items = items.filter(okHeadline); news.at = performance.now(); } } });

// ─── Memory ────────────────────────────────────────────────────────────────
function memKey(){ return 'fc-npc-memory:' + (window.FCAccounts?.user?.username || 'local'); }
let MEM = null, memFor = null;
function memory(){
 const k = memKey();
 if (memFor !== k){ memFor = k; try { MEM = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e){ MEM = {}; } }
 if(window.FCResidentLife?.enabled && FCResidentLife.ready)MEM=FCResidentLife.get('npcs',MEM);
 return MEM;
}
function saveMemory(){
 try {
  const m = memory(), keys = Object.keys(m);
  //  Keep the 300 most recent acquaintances.
  if (keys.length > 300) keys.sort((a, b) => (m[a].last || 0) - (m[b].last || 0)).slice(0, keys.length - 300).forEach(k => delete m[k]);
  localStorage.setItem(memKey(), JSON.stringify(m));
  if(window.FCResidentLife?.enabled)FCResidentLife.put('npcs',m);
 } catch (e){}
}
function playerName(){ return window.FCAccounts?.user?.displayName || (typeof Shift !== 'undefined' && Shift.profile && (Shift.profile.name || Shift.profile.handle)) || 'stranger'; }

addEventListener('fc-life-ready',()=>{MEM=null;memFor=null;});
// ─── The conversation ──────────────────────────────────────────────────────
const css = document.createElement('style');
css.textContent = `#npc-talk{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:139000;width:min(760px,94vw);
 background:#14100c;color:#f1e6d2;border:1px solid #6b4a24;border-top:3px solid #ffa040;box-shadow:0 18px 60px #000a,0 0 0 100vmax #0004;font:15px/1.5 system-ui;padding:18px 20px 16px;max-height:calc(100vh - 24px);overflow-y:auto;overscroll-behavior:contain}
#npc-talk header{display:flex;gap:12px;align-items:center;margin-bottom:10px}
#npc-talk .face{width:38px;height:38px;border-radius:4px;flex:none;border:2px solid var(--acc,#ffa040);background:var(--coat,#444)}
#npc-talk .who b{display:block;font:600 15px system-ui;color:#ffd08a}
#npc-talk .who small{font:11px monospace;letter-spacing:.14em;color:#b49a78}
#npc-talk .rap{margin-left:auto;font:10px monospace;letter-spacing:.14em;color:#8c7a62}
#npc-talk .line{font:18px/1.6 Georgia,serif;margin:4px 0 14px;color:#f6ecdc}
#npc-talk .real{display:inline-block;font:10px monospace;letter-spacing:.16em;background:#ffa040;color:#14100c;padding:3px 7px;margin:0 0 8px}
#npc-talk blockquote{margin:6px 0 10px;padding:8px 12px;border-left:3px solid #ffa040;background:#1e1812;font:17px/1.5 Georgia,serif}
#npc-talk .opts{display:grid;gap:6px}
#npc-talk .opts button,#npc-talk .opts a{display:flex;gap:10px;align-items:center;text-align:left;font:14px system-ui;color:#f1e6d2;background:#1e1812;border:1px solid #4a3620;padding:9px 12px;cursor:pointer;min-height:42px;text-decoration:none}
#npc-talk .opts button:hover,#npc-talk .opts button:focus-visible,#npc-talk .opts a:hover{border-color:#ffa040;outline:none}
#npc-talk .opts b{font:600 12px monospace;color:#ffa040;min-width:16px}`;
document.head.append(css);
let panel = null, talk = null, priorPause = false, oldFocus = null;

function roleOf(person){
 if (person.kind === 'keeper' && person.shop) return 'keeper';
 const a = person.char?.archetype;
 return V[a] ? a : 'drifter';
}
function idOf(person){
 const c = person.char || {};
 return person.kind === 'keeper' && person.shop ? 'shop:' + (person.shop.name || '') + ':' + (c.handle || '') : (c.archetype || 'resident') + ':' + (c.handle || '');
}
function fill(s){ return String(s).replace(/\{name\}/g, playerName()); }
function pick(list, salt){ return list[Math.abs(hashS(salt)) % list.length]; }
function hashS(s){ let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }
function rapportWord(r){ return r >= 3 ? 'WARM' : r <= -1 ? 'COLD' : r >= 1 ? 'FRIENDLY' : 'NEUTRAL'; }

function start(person){
 if(window.FCResidentLife?.blocked){toast('Your account progress is loading. Try again shortly.','info');return;}
 const role = roleOf(person), v = V[role], m = memory(), id = idOf(person);
 const me = m[id] || (m[id] = { met: 0, rapport: 0, step: 0, knowsName: false, rude: 0, topics: [] });
 const first = me.met === 0;
 me.met++; me.last = Date.now();
 const c = person.char || {};
 let opening;
 if (first) opening = { text: firstLine(person, role) };
 else {
  const pool = me.rapport >= 3 ? v.warm : me.rapport <= -1 ? v.cold : v.back;
  let t = fill(pick(pool, id + me.met));
  if (!me.knowsName) t = t.replace(playerName(), 'friend');
  if (me.rude && me.rapport <= 0) t += ' You were short with me last time. I remember that sort of thing.';
  else if (me.topics.length) t += ' ' + recall(me.topics[me.topics.length - 1]);
  opening = { text: t };
 }
 talk = { person, role, v, me, id, name: c.handle || 'Resident', roleLabel: labelFor(person, role), turns: 0 };
 saveMemory();
 open(); show(opening);
}
function recall(topic){ return ({ story: 'Still thinking about what I told you, are you?', rumor: 'Heard any more about that business I mentioned?', ned: 'Still watching Ned, then?', news: 'Did you look up that story?' })[topic] || ''; }
function labelFor(person, role){
 if (V[role]?.label) return V[role].label;
 if (role === 'keeper') return (person.shop?.name || 'SHOP').toUpperCase();
 const d = typeof districtAtPosition === 'function' && person.pos ? districtAtPosition(person.pos.x, person.pos.z) : null;
 return ((d ? d.name : 'FRACTURE CITY') + ' · ' + (person.char?.archetype || role)).toUpperCase();
}
function firstLine(person, role){
 if (V[role]?.first) return V[role].first;
 //  A stranger opens with one of the original lines, so nothing written before is lost.
 try {
  if (role === 'keeper' && typeof KEEPER_BARKS !== 'undefined' && person.shop && KEEPER_BARKS[person.shop.type?.key]) return pick(KEEPER_BARKS[person.shop.type.key], idOf(person));
  if (typeof BARKS !== 'undefined' && BARKS[role]) return pick(BARKS[role], idOf(person) + Date.now());
 } catch (e){}
 return pick(V[role].story, idOf(person));
}

function options(){
 const t = talk, me = t.me, out = [];
 if (!me.knowsName) out.push({ label: 'I’m ' + playerName() + '.', act: 'name' });
 if (me.step < t.v.story.length) out.push({ label: me.step === 0 ? 'What’s your story?' : 'Go on, what happened next?', act: 'story' });
 out.push({ label: 'What’s going on around here?', act: 'rumor' });
 if (t.turns < 2) out.push({ label: 'What do you make of Ned?', act: 'ned' });
 //  Voices can bring their own replies (Casting Booth NPCs: orders, errands, snacks).
 const extra = typeof t.v.extra === 'function' ? t.v.extra(t) || [] : [];
 out.push(...extra);
 for (const drop of ['ned', 'name', 'rumor']){ if (out.length <= 5) break; const i = out.findIndex(o => o.act === drop); if (i >= 0) out.splice(i, 1); }
 out.push({ label: 'See you around.', act: 'bye' });
 out.push({ label: 'Not interested.', act: 'rude' });
 return out.slice(0, 8);
}
function react(act){
 const t = talk, me = t.me, v = t.v;
 t.turns++;
 if (typeof v.handle === 'function'){ const beat = v.handle(act, t); if (beat) return show(beat); }
 if (act === 'bye'){ me.rapport = Math.min(6, me.rapport + (t.turns > 2 ? 1 : 0)); saveMemory(); return show({ text: pick(v.bye, t.id + me.met), end: true }); }
 if (act === 'rude'){ me.rapport = Math.max(-3, me.rapport - 2); me.rude++; saveMemory(); return show({ text: v.rude, end: true }); }
 if (act === 'name'){ me.knowsName = true; me.rapport += 1; saveMemory(); return show({ text: fill('{name}. Right. I will remember that. I remember most things, it is a problem.') }); }
 if (act === 'story'){
  const text = v.story[me.step];
  me.step = Math.min(v.story.length, me.step + 1); me.rapport = Math.min(6, me.rapport + 1); remember('story'); saveMemory();
  return show({ text: me.step === v.story.length ? text + ' That is the whole of it. You are one of very few who have heard all of it.' : text });
 }
 if (act === 'ned'){ remember('ned'); saveMemory(); return show({ text: pick(v.ned, t.id + t.turns) }); }
 if (act === 'rumor'){
  //  A quarter of the time, for the roles that read the wire, a real headline.
  const n = NEWS_ROLES.has(t.role) && news.items.length && (hashS(t.id + me.met + t.turns) & 3) === 0 ? news.items[Math.abs(hashS(t.id + me.met)) % news.items.length] : null;
  if (n){ remember('news'); saveMemory(); t.news = n; return show({ news: n }); }
  remember('rumor'); saveMemory();
  const extra = typeof shContextBark === 'function' ? (() => { try { return shContextBark(t.person); } catch (e){ return []; } })() : [];
  const pool = v.rumor.concat(extra);
  return show({ text: pick(pool, t.id + me.met + t.turns) });
 }
 if (act === 'source' && t.news){
  const n = t.news, when = new Date(n.published).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return show({ text: `${n.source}, ${when}. It’s up on the Common Ground board by the square too.`, link: n });
 }
}
function remember(topic){ const tp = talk.me.topics; tp.push(topic); if (tp.length > 6) tp.shift(); }

function open(){
 if (panel) return;
 oldFocus = document.activeElement; priorPause = State.ui.paused; State.ui.paused = true; State.keys?.clear?.(); document.exitPointerLock?.();
 panel = document.createElement('section'); panel.id = 'npc-talk'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
 document.body.append(panel);
}
function close(){
 if (!panel) return;
 panel.remove(); panel = null; talk = null;
 State.ui.paused = priorPause; State.keys?.clear?.(); oldFocus?.focus?.();
}
function show(beat){
 if (!panel || !talk) return;
 const c = talk.person.char || {}, hex = (n, d) => '#' + ((n ?? d) >>> 0).toString(16).padStart(6, '0');
 panel.setAttribute('aria-label', 'Talking to ' + talk.name);
 panel.style.setProperty('--coat', hex(c.coatHex, 0x4a4f63)); panel.style.setProperty('--acc', hex(c.accent, 0xffa040));
 let body;
 if (beat.news){
  const n = beat.news, lead = NEWS_LEAD[talk.role], tail = NEWS_TAIL[talk.role];
  body = `<p class="line">${esc(lead)}</p><span class="real">REAL NEWS · ${esc(n.source)}</span><blockquote>“${esc(n.title)}”</blockquote><p class="line">${esc(tail)}</p>`;
 } else body = `<p class="line">${esc(fill(beat.text))}</p>`;
 const opts = beat.end ? [{ label: 'Leave', act: 'close' }]
  : beat.news ? [{ label: 'Where’s that from?', act: 'source' }, ...options().filter(o => o.act !== 'rumor')].slice(0, 6)
  : options();
 if (beat.link){ opts.unshift({ label: 'Open the story (' + new URL(beat.link.url).hostname + ')', act: 'link', href: beat.link.url }); }
 panel.innerHTML = `<header><span class="face"></span><span class="who"><b>${esc(talk.name)}</b><small>${esc(talk.roleLabel)}</small></span><span class="rap">${rapportWord(talk.me.rapport)}${talk.me.met > 1 ? ' · MET ' + talk.me.met + '×' : ''}</span></header>${body}
  <div class="opts">${opts.map((o, i) => o.href ? `<a href="${esc(o.href)}" target="_blank" rel="noopener noreferrer" data-i="${i}"><b>${i + 1}</b>${esc(o.label)}</a>` : `<button data-i="${i}"><b>${i + 1}</b>${esc(o.label)}</button>`).join('')}</div>`;
 panel._opts = opts;
 panel.querySelectorAll('[data-i]').forEach(el => el.addEventListener('click', e => { const o = opts[+el.dataset.i]; if (o.href) return; e.preventDefault(); choose(o); }));
 panel.querySelector('[data-i]')?.focus();
}
function choose(o){ if (!o) return; if (o.act === 'close') return close(); react(o.act); }
window.addEventListener('keydown', e => {
 if (!panel) return;
 if (e.code === 'Escape'){ close(); }
 else if (/^Digit[1-8]$/.test(e.code)){ const o = panel._opts?.[Number(e.code.slice(5)) - 1]; if (o){ if (o.href) window.open(o.href, '_blank', 'noopener'); else choose(o); } }
 else if (e.code === 'Tab'){ const n = [...panel.querySelectorAll('[data-i]')], i = n.indexOf(document.activeElement); e.preventDefault(); n[(i + (e.shiftKey ? -1 : 1) + n.length) % n.length]?.focus(); }
 else if (e.code === 'Enter' || e.code === 'Space'){ const el = document.activeElement; if (el && panel.contains(el) && el.tagName === 'BUTTON'){ e.preventDefault(); el.click(); } }
 e.stopImmediatePropagation();
}, true);

// ─── Hook ──────────────────────────────────────────────────────────────────
const orig = shTalkTo;
window.shTalkTo = function(person){
 try {
  //  Story characters and cast members keep their own written lines.
  if (!person || person.char?.cast || (window.FN && (FN.prologue || FN.scene)) || panel) return orig.apply(this, arguments);
  const c = person.char;
  if (c?.group && person.pos){ const dx = Player.position.x - person.pos.x, dz = Player.position.z - person.pos.z; c.group.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2; }
  loadNews();
  start(person);
 } catch (e){ console.warn('[npc-voices]', e); close(); return orig.apply(this, arguments); }
};
loadNews();
window.NPCVoices = { get open(){ return !!panel; }, get talk(){ return talk; }, memory, close, V, HEAVY, news: () => news.items };
})();
