/* NPC brains for the Casting Booth: roles, backstories, voices and behaviour.

   One file, two hosts. The game server requires it to run the shared city's
   spawned NPCs; the browser loads it to run them in solo cities and to show
   the same stories. Nothing here touches the DOM, THREE or the network.

   A brain decides; it does not walk. think() sets a goal (gx, gz), a speed,
   an act (what the body is doing) and sometimes a line to say. Whoever moves
   the body (the server in a straight line, or a nearby player's game with
   real collision) steps it toward the goal. */
(function(root, make){
 if (typeof module === 'object' && module.exports) module.exports = make();
 else root.FCNpcBrain = make();
})(typeof self !== 'undefined' ? self : this, function(){
'use strict';

// ─── Roles ───────────────────────────────────────────────────────────────────
//  group: life | help | trouble | talk. price: one-time unlock in credits (0 = free).
//  scenes: wardrobe scenes the booth's Randomise draws from. crew: spawns that many.
const ROLES = {
 wanderer:   { group:'life', label:'Wanderer', speed:1.3, price:0, scenes:['punk','goth','skater','work','office'], blurb:'Drifts around the blocks near where you leave them. Stops to look at things.' },
 busker:     { group:'life', label:'Busker', speed:1.2, price:0, scenes:['punk','goth','skater'], blurb:'Plays for whoever passes. Draws a small crowd of lines.' },
 preacher:   { group:'life', label:'Street preacher', speed:1.1, price:0, scenes:['office','goth'], blurb:'Preaches the gospel of something to a bus shelter.' },
 vendor:     { group:'life', label:'Vendor', speed:1.1, price:0, scenes:['work','skater'], blurb:'Sells from a cart. Talk to them for a free street snack (heals) once a minute.' },
 tagger:     { group:'life', label:'Graffiti artist', speed:1.4, price:0, scenes:['punk','skater','raver'], blurb:'Paints tags on walls nearby, moves on, paints again.' },
 skater:     { group:'life', label:'Skater', speed:4.2, price:0, scenes:['skater','punk'], blurb:'Rolls laps around the area on a board.' },
 dancer:     { group:'life', label:'Dancer', speed:1.3, price:0, scenes:['raver','punk','goth'], blurb:'Dances wherever there is room. There is always room.' },
 protester:  { group:'life', label:'Protester', speed:1.2, price:0, scenes:['punk','work','goth'], blurb:'Marches a short beat with a sign that says what they want.' },
 bodyguard:  { group:'help', label:'Bodyguard', speed:1.5, price:150, scenes:['punk','work'], blurb:'Follows you and fights brawlers, pickpockets and zombies near you.' },
 companion:  { group:'help', label:'Companion', speed:1.5, price:0, scenes:['punk','goth','skater','raver','work','office'], blurb:'Follows you around and has opinions about where you go.' },
 builder:    { group:'help', label:'Crew hand', speed:1.5, price:120, scenes:['work'], blurb:'Follows you and scrounges building blocks for you every few minutes.' },
 courier:    { group:'help', label:'Courier', speed:3.2, price:0, scenes:['skater','work'], blurb:'Runs a message to another resident, says it to their face, comes back.' },
 pickpocket: { group:'trouble', label:'Pickpocket', speed:1.5, price:0, scenes:['punk','skater','goth'], blurb:'Bumps into residents and bolts. Takes nothing real: whoever catches them gets 15 credits.' },
 brawler:    { group:'trouble', label:'Brawler', speed:1.6, price:0, scenes:['punk','work'], blurb:'Picks fights outside Common Ground. Small punches; can be knocked down.' },
 crew:       { group:'trouble', label:'Rival crew', speed:1.6, price:200, scenes:['punk','goth','raver'], crew:3, blurb:'Three in matching colours patrol together and start trouble. Counts as three.' },
 carrier:    { group:'trouble', label:'Zombie carrier', speed:1.0, price:100, scenes:['work','office','goth'], blurb:'Coughs. Near anyone with zombie mode on, the occasional zombie follows them out.' },
 gossip:     { group:'talk', label:'Gossip', speed:1.3, price:0, scenes:['office','goth','raver'], blurb:'Goes from NPC to NPC collecting rumours, then tells you.' },
 storyteller:{ group:'talk', label:'Storyteller', speed:1.0, price:0, scenes:['goth','office','punk'], blurb:'Sits still and tells their whole story, in parts, if you come back.' },
 fixer:      { group:'talk', label:'Fixer', speed:1.1, price:0, scenes:['office','punk'], blurb:'Hands out errands: find someone, go somewhere, watch a spot. Pays credits.' },
};
const GROUPS = [['life','City life'], ['help','Followers and helpers'], ['trouble','Trouble'], ['talk','Talkers']];
const LIMITS = { perPlayer: 12, perCity: 40, solo: 24, name: 24, field: 160, bio: 700, message: 120 };
//  Common Ground and the building yard: no trouble there, and the booth stands inside.
const SAFE = { x0: 144, x1: 216, z0: 0, z1: 72 };
const inSafe = (x, z) => x >= SAFE.x0 && x <= SAFE.x1 && z >= SAFE.z0 && z <= SAFE.z1;
const BOOTH = { x: 164, z: 45, door: { x: 164, z: 49.6 } };

// ─── Small helpers ───────────────────────────────────────────────────────────
function hash(s){ let h = 2166136261; for (const ch of String(s)){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed){ let a = hash(seed) || 1; return { next(){ a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } }; }
const pick = (r, a) => a[Math.floor(r.next() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clampText = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

// ─── Backstories ─────────────────────────────────────────────────────────────
//  House rules: sayable by a tired person on a wet street; never explains the
//  premise; true first, funny second.
const FIRST = ['Vex','Juno','Dax','Marlo','Ines','Rook','Tamsin','Ozzie','Pilar','Kit','Soren','Nadia','Bram','Lux','Coco','Ike','Wren','Zola','Fitz','Mags','Teo','Ruby','Hux','Odile','Sid','Bea','Cass','Dimi','Fern','Gus','Noor','Yuki','Femi','Lotte','Rafa','Ash','Petra','Milo','Saoirse','Benji','Tova','Quinn','Ezra','Dolores','Kofi','Ivy','Remy','Hal'];
const LAST = ['Kowalski','Okafor','Reyes','Lindqvist','Tran','Duarte','Moss','Vale','Szabo','Nakamura','Petrov','Quist','Fairweather','Halloran','Ibarra','Castellanos','Achebe','Morrow','Delacroix','Brennan','Osei','Varga','Holm','Pike','Sato','Mendes','Rourke','Novak','Abara','Lund'];
const NICK = {
 wanderer:['Corners','Long Way','Lamppost'], busker:['Three Chords','Encore','Spare Change'], preacher:['the Deacon','Pulpit','Amen'], vendor:['Cart','Two-for-One','Hot Plate'],
 tagger:['Paint','Drip','Overpass'], skater:['Kickflip','Grind','Bearings'], dancer:['Loop','Floorboards','Bassline'], protester:['Placard','Megaphone','Petition'],
 bodyguard:['Shoulders','Brick','Wall'], companion:['Shadow','Plus One','Tag-Along'], builder:['Spanner','Mortar','Level'], courier:['Express','Relay','Doorstep'],
 pickpocket:['Fingers','Light Touch','Sorry'], brawler:['Knuckles','Round Two','Ringside'], crew:['Static','Rust','Neon'], carrier:['Cough','Sniffles','Patient Zero'],
 gossip:['Grapevine','Earful','Did You Hear'], storyteller:['Once','Chapter','Long Story'], fixer:['the Fixer','Errand','Ledger'],
};
const ORIGIN = [
 'grew up above a laundromat in the Tiers, where the dryers never stopped',
 'came in on the last night bus before they cancelled the line',
 'was born in the old transit depot, which is a gym now',
 'moved here for a job that was automated before the first shift',
 'arrived with one suitcase and a borrowed coat that still has not gone back',
 'grew up in the Seam when it was farmland on paper and car parks in fact',
 'is from three districts over and will tell you within a minute',
 'was raised by a grandmother who ran an unlicensed radio station from the bathtub',
 'came here to be a musician and became a tenant',
 'left a quieter town because the quiet was the problem',
 'was a child actor in one advert for a bank that collapsed',
 'grew up on a houseboat on a canal that has since been paved',
 'spent their teens in the arcade on Fourth before it became a phone shop',
 'was found, as a baby, in a box marked FRAGILE, and has opinions about that',
 'grew up six floors above the big screen and learned to read from the ticker',
];
const JOB = [
 'fixes phone screens out of a shoebox', 'used to write captions for a news channel that no longer exists', 'delivers groceries to people who never come down',
 'sells umbrellas when it rains and is a philosopher otherwise', 'does night security for an empty building', 'paints signs for shops that change names monthly',
 'tests apps that pay in points', 'drives a forklift in a warehouse that stores other warehouses', 'teaches guitar to kids whose parents think it is maths',
 'works the counter at the noodle place that never closes', 'ghostwrites apologies for local businesses', 'repairs bikes and, if you let them, opinions',
 'reads meters for a utility that will not say which utility', 'restrings tennis rackets nobody plays with', 'walks dogs for people who work from home and still cannot',
 'is between jobs, and has been between them a while',
];
const WANT = [
 'wants to open a venue with a stage that does not wobble', 'wants their name on one thing here that does not get painted over', 'wants to sleep eight hours once, as an experiment',
 'wants to find whoever keeps leaving oranges on their step', 'wants to win back a bet made years ago about the weather', 'wants the anchor on the big screen to admit one mistake on air',
 'wants to save enough to leave and is not sure they will', 'wants a dog the landlord cannot see', 'wants to be the reason someone stays',
 'wants to know who owns the empty tower on Ninth', 'wants to hear their song in a shop, once, by accident', 'wants a key to the roof of the library',
 'wants everyone on the block to learn each other’s names', 'wants a quiet hour on a bench nobody is selling',
];
const WOUND = [
 'lost a band to a contract they never read', 'got evicted on their birthday, which they find funny some days', 'was in the crowd the night the stage came down',
 'has a sibling who left and only sends postcards with no return address', 'trusted a landlord once', 'was fired by an email that spelled their name wrong',
 'lost the shop when the rent tripled', 'spent a winter sleeping in the library and still knows every chair', 'watched the mural they spent a summer on get buffed in an afternoon',
 'missed the one call that would have changed everything', 'had a friend who went viral and stopped being a friend', 'lent money to the wrong cousin',
];
const QUIRK = [
 'counts streetlights out loud', 'never sits with their back to a door', 'keeps a pencil behind each ear in case one is lost',
 'names every pigeon and suspects one is lying', 'only drinks coffee that has already gone cold', 'hums the news jingle without noticing',
 'collects bottle caps that look like faces', 'salutes the big screen, mostly ironically', 'tells the time by the sirens',
 'writes the date on their hand every morning', 'apologises to furniture they bump into', 'carries a spare umbrella for strangers',
];
const SECRET = [
 'still has a key to the shut-down radio station', 'is the one tying ribbons on the pigeons', 'has never seen the sea, despite the tattoo',
 'once met Ned off camera and he was kind, which ruined everything', 'pays a stranger’s rent anonymously', 'writes the unsigned letters in the Common Ground box',
 'knows where the sewer eels sleep', 'cannot read music, despite everything', 'is why the vending machine on Fourth is free on Tuesdays',
 'kept a lottery ticket that might have won and has never checked', 'used to work for the people they now protest', 'feeds the neon jellies when nobody is looking',
];
const CATCH = [
 'Loud is a kind of honest.', 'Rent is a ghost story.', 'Everything here is temporary except the puddles.', 'Nobody is coming. So we came.',
 'If it fits in a pocket, it fits in a life.', 'Keep your boots on and your door open.', 'The city remembers. It just does not call back.',
 'Make it ugly, make it ours.', 'Three chords and the truth, minus a chord.', 'Stay weird, stay fed.', 'No gods, no landlords, no fixed hours.',
];
const TEMPER = ['warm', 'prickly', 'odd'];

function story(role, seed){
 const r = rng('story:' + role + ':' + seed), first = pick(r, FIRST), last = pick(r, LAST), nick = pick(r, NICK[role] || NICK.wanderer);
 const s = { name: first + ' ' + last, nick, origin: pick(r, ORIGIN), job: pick(r, JOB), want: pick(r, WANT), wound: pick(r, WOUND), quirk: pick(r, QUIRK), secret: pick(r, SECRET), catch: pick(r, CATCH), temper: pick(r, TEMPER) };
 if (role === 'protester') s.sign = pick(r, ['RENT IS THEFT-ADJACENT', 'LET THE PIGEONS VOTE', 'MORE BENCHES', 'NED, CORRECT YOURSELF', 'FREE THE ARCADE', 'OPEN THE ROOF', 'LIGHTS ON FOR NIGHT SHIFT', 'PAY THE MURALISTS']);
 s.bio = bio(s);
 return s;
}
function reroll(s, field, role, seed){
 const r = rng('reroll:' + field + ':' + seed), pools = { origin: ORIGIN, job: JOB, want: WANT, wound: WOUND, quirk: QUIRK, secret: SECRET, catch: CATCH, temper: TEMPER, nick: NICK[role] || NICK.wanderer };
 const out = { ...s };
 if (field === 'name') out.name = pick(r, FIRST) + ' ' + pick(r, LAST);
 else if (pools[field]) out[field] = pick(r, pools[field]);
 out.bio = bio(out);
 return out;
}
function bio(s){
 const first = String(s.name || 'They').split(' ')[0];
 return clampText(`${first} ${s.origin}. These days ${first} ${s.job}. ${cap(s.want ? first + ' ' + s.want : '')}. ${cap(first + ' ' + s.wound)}, and ${s.quirk}.`, LIMITS.bio);
}

// ─── Voices ──────────────────────────────────────────────────────────────────
//  The shape npc-voices.js expects: story (three parts), rumor, ned, back, warm,
//  cold, bye, rude. Built from the backstory, so editing the story changes how
//  they talk.
const NED = {
 warm: ['Ned reads the news like he is worried about us. I choose to believe that.', 'I like Ned. Do not tell anyone. It ruins the look.'],
 prickly: ['Ned has corrected himself four hundred times this year. Not once about anything that mattered.', 'If Ned walked down this street he would read it a weather warning.'],
 odd: ['I think Ned is three people in a rota. Look at the ears.', 'Ned blinked twice on the eleven o’clock. I took it as a message. I am still decoding it.'],
};
function voice(npc){
 const s = npc.story || {}, first = String(s.name || 'I').split(' ')[0], t = s.temper || 'warm';
 //  Third person to first: "counts streetlights" becomes "count streetlights".
 const verb = w => ({ is: 'am', has: 'have', does: 'do', was: 'was' })[w] || (/(ss|sh|ch|x)es$/.test(w) ? w.slice(0, -2) : /ies$/.test(w) ? w.slice(0, -3) + 'y' : /[^su]s$/.test(w) ? w.slice(0, -1) : w);
 const own = x => String(x || '').replace(/\btheir\b/g, 'my').replace(/\bthey\b/g, 'I').replace(/\bthem\b/g, 'me')
  .replace(/^((?:only|never|still|always) )?(\w+)/, (m, adv, w) => (adv || '') + verb(w)).replace(/\band (still )?(\w+)/g, (m, st, w) => 'and ' + (st || '') + verb(w));
 return {
  story: [
   `I ${own(s.origin)}. Now I ${own(s.job)}. That is the short version and the long one.`,
   `I ${own(s.wound)}. I do not say that to everyone. I ${own(s.want).replace(/^wants/, 'want')}.`,
   `Here is one for you: I ${own(s.secret)}. Keep it. Also I ${own(s.quirk)}, but everyone knows that.`,
  ],
  rumor: [],
  ned: NED[t] || NED.warm,
  back: [`You again, {name}. ${s.catch || ''}`.trim(), `{name}. I was hoping it was you. Or someone. You will do.`],
  warm: [`{name}! Sit down. Well, stand, there is nowhere to sit. ${s.catch || ''}`.trim()],
  cold: ['Oh. It is you.', 'I remember you. That is not a compliment.'],
  bye: ['Go on, then.', 'Mind the puddles.', s.catch || 'See you.'],
  rude: t === 'prickly' ? 'Same to you, with interest.' : t === 'odd' ? 'I will add that to the file.' : 'Fair enough. Long day for everyone.',
 };
}

// ─── Lines they say out loud (bubbles) ──────────────────────────────────────
const BARKS = {
 wanderer: ['Have you seen this corner at night? Different corner.', 'I walk until something happens. Something usually happens.', 'Every block here has one good window. I am collecting them.', 'Left, left, left. Same place, better mood.'],
 busker: ['This one is about my landlord. It is in a minor key.', 'Requests! I know two, and one of them is this.', 'Coins, compliments, or just stand there. All accepted.', 'Somebody clap. Anybody. Thank you, pigeon.', 'This next song used to have a bridge. They knocked it down.'],
 preacher: ['Repent! Or at least read the small print!', 'The meek shall inherit the parking!', 'Blessed are the tenants, for they shall get the deposit back! Eventually!', 'I have seen the end times. They are mostly adverts.', 'Brothers! Sisters! Others! Hydrate!'],
 vendor: ['Hot! Mostly hot! Ask me about the middle!', 'Two for one, or one for two, depends on my mood!', 'Fresh today! Fresh-ish yesterday!', 'Snacks for the walk home and for the walk after that!'],
 tagger: ['Hold this. No, the other end.', 'Walls are just paper that cannot say no.', 'Lookout, lookout. Kidding. Probably.', 'This one is for the kid who got buffed.'],
 skater: ['Watch this. Do not watch the landing.', 'Kerbs are a lifestyle.', 'Bearing check! All bearings present!', 'Grind, push, apologise, repeat.'],
 dancer: ['Feel that? That is the bass from three streets away.', 'Dance like the camera is broken.', 'One more song. I said that an hour ago.', 'The floor is the only boss I listen to.'],
 protester: ['What do we want? Benches! When do we want them? Sitting down!', 'Hey hey, ho ho, this rent has got to go!', 'Honk if you agree! Or if you are a goose!', 'Sign the petition! There is no petition! Make one!'],
 bodyguard: ['On you.', 'I have got your back. Literally, I am behind you.', 'Nobody touches the client.', 'Clear. Mostly clear. Keep walking.'],
 companion: ['Where are we going? Never mind. Better if it is a surprise.', 'I like this street. I like you on it.', 'You walk fast. I respect it.', 'If we get lost, I am blaming the map. There is no map.'],
 builder: ['Found some blocks. Do not ask where.', 'That wall wants to be taller. I can tell.', 'Measure twice, place once, undo three times.', 'I brought you supplies. You are welcome, boss.'],
 courier: ['Message in motion!', 'Got it, got it, going!', 'Coming through! Sentimental cargo!', 'Delivered. Mostly in the right tone.'],
 pickpocket: ['Sorry! Sorry! So sorry!', 'Oops. Lovely jacket.', 'Excuse me, pardon, coming through.', 'Nice wallet! Joking! Mostly!'],
 brawler: ['You looking at me? Everyone is looking at me.', 'Round two. I lost round one.', 'Hold my coat. I do not have a coat.', 'Put them up! No, the hands.'],
 crew: ['This is our street. Today.', 'Crew rolls together or not at all.', 'Matching jackets, matching grudges.', 'You have the wrong colours on, friend.'],
 carrier: ['I am fine. It is just a cough. A green one.', '*cough* Stand back. Further.', 'Does anyone else feel bitey?', 'I think the noodles were off.'],
 gossip: ['Have you heard? You have not. Come here.', 'I am not saying anything. Ask me again.', 'I know three things about everyone. Two are true.'],
 storyteller: ['Ask me about the flood. Or the other flood.', 'Sit. This one takes a while.', 'I have a story for every lamppost. Pick one.'],
 fixer: ['Got work, if you have got legs.', 'Errands. Credits. No questions, a few answers.', 'You look reliable. That is a compliment and a test.'],
};
const RUMOR_BY_ROLE = {
 wanderer: 'walking the same four blocks like they lost something', busker: 'playing the same three chords near {place}', preacher: 'preaching to a bus shelter, and the bus shelter is coming round',
 vendor: 'selling snacks they swear are the same as last week', tagger: 'painting by {place} when they think nobody is looking', skater: 'wearing out a kerb near {place}',
 dancer: 'dancing outside {place} until the lights went off', protester: 'marching by {place} with a new sign', bodyguard: 'shadowing {owner} like a coat with opinions',
 companion: 'following {owner} everywhere, even the boring places', builder: 'stealing bricks for {owner}, allegedly', courier: 'running messages for {owner}, and reading them',
 pickpocket: 'bumping into people on purpose near {place}', brawler: 'starting fights by {place}, and losing most of them', crew: 'out with their crew claiming {place}',
 carrier: 'coughing near {place}. Green. I am just saying', gossip: 'knowing things they should not', storyteller: 'telling the flood story again', fixer: 'handing out errands that pay too well',
};
const PLACES = ['the overpass', 'the noodle place', 'the depot', 'Common Ground', 'the big screen', 'the arcade', 'the laundromat', 'the bus shelter on Fourth', 'the skate yard', 'the old radio station'];
function rumorAbout(other, salt){
 const r = rng('rumor:' + other.id + ':' + salt), s = other.story || {}, first = String(s.name || 'Somebody').split(' ')[0];
 const what = (RUMOR_BY_ROLE[other.role] || RUMOR_BY_ROLE.wanderer).replace('{place}', pick(r, PLACES)).replace('{owner}', other.ownerName || 'some resident');
 return pick(r, [`${first} has been ${what}.`, `You know ${first}? They have been ${what}. You did not hear it from me.`, `Word is ${first} ${s.secret || 'is not who they say'}. Probably nothing.`]);
}

// ─── Quests (fixers) ────────────────────────────────────────────────────────
const SPOTS = [
 { name: 'the People’s Gallery', x: 186, z: 16 }, { name: 'the skate yard', x: 204, z: 12 }, { name: 'the garden fountain', x: 166, z: 36 },
 { name: 'the Toilet Heads cabinet', x: 199, z: 26.5 }, { name: 'the north crossing', x: 168, z: -6 }, { name: 'the south steps', x: 176, z: 66 },
 { name: 'the east kerb', x: 220, z: 36 }, { name: 'the west kerb', x: 140, z: 40 },
];
function quest(fixer, others, salt){
 const r = rng('quest:' + fixer.id + ':' + salt), kind = others.length && r.next() < .45 ? 'find' : r.next() < .5 ? 'visit' : 'watch';
 if (kind === 'find'){ const o = pick(r, others), first = String(o.story?.name || 'them').split(' ')[0]; return { kind, target: o.id, name: o.story?.name || 'them', text: `Find ${o.story?.name || 'them'} and tell them the ${pick(r, ['blue van', 'third key', 'pigeon', 'roof'])} is sorted. ${first} will know.`, reward: 30 }; }
 const spot = pick(r, SPOTS);
 if (kind === 'visit') return { kind, x: spot.x, z: spot.z, name: spot.name, text: `Go to ${spot.name}. Look around. Come back and tell me if it is still there.`, reward: 25 };
 return { kind, x: spot.x, z: spot.z, name: spot.name, secs: 20, text: `Stand by ${spot.name} for twenty seconds and watch who goes by. Do not be obvious.`, reward: 35 };
}

// ─── Spawning and cleaning ───────────────────────────────────────────────────
//  Server side and solo both: everything a player sends is cleaned here.
function cleanSpec(spec, owns){
 const role = ROLES[spec?.role] ? spec.role : null;
 if (!role) return { error: 'Pick a role.' };
 if (ROLES[role].price && !owns('n:' + role)) return { error: 'Unlock the ' + ROLES[role].label + ' role first (' + ROLES[role].price + ' credits).' };
 const raw = spec.story && typeof spec.story === 'object' ? spec.story : {}, base = story(role, spec.seed || 'x'), s = {};
 for (const k of ['origin','job','want','wound','quirk','secret','catch']) s[k] = clampText(raw[k], LIMITS.field) || base[k];
 s.name = clampText(raw.name, LIMITS.name) || base.name;
 s.nick = clampText(raw.nick, LIMITS.name) || base.nick;
 s.temper = TEMPER.includes(raw.temper) ? raw.temper : base.temper;
 s.sign = clampText(raw.sign, 28).toUpperCase() || base.sign || '';
 s.bio = clampText(raw.bio, LIMITS.bio) || bio(s);
 const message = clampText(spec.message, LIMITS.message);
 return { role, story: s, message, to: clampText(spec.to, 40) };
}

// ─── Brains ──────────────────────────────────────────────────────────────────
//  npc: { id, role, owner, ownerName, story, home{x,y,z}, x,y,z, yaw, gx, gz, speed,
//         mode, act, t, say, sayUntil, hp, crew, leader, task }
//  world: { now, players[], npcs[], rand(), say(npc, text, secs), hurt(player, dmg, npc),
//           reward(player, credits, why, npc), gift(player, npc), chat(text) }
const HP = { brawler: 60, crew: 60, pickpocket: 30, bodyguard: 120 };
function init(npc, at){
 npc.home = { x: at.x, y: at.y ?? 1, z: at.z };
 npc.x = at.x; npc.y = at.y ?? 1; npc.z = at.z; npc.yaw = at.yaw || 0;
 npc.gx = npc.x; npc.gz = npc.z; npc.speed = 0;
 npc.mode = ROLES[npc.role].group === 'trouble' && inSafe(npc.x, npc.z) ? 'leave' : 'idle';
 npc.act = 'idle'; npc.t = 1; npc.hp = HP[npc.role] || 80; npc.maxHp = npc.hp; npc.barkAt = 0; npc.cool = {};
 return npc;
}
function owner(npc, world){ return world.players.find(p => p.accountId === npc.owner && p.hp > 0) || null; }
function near(list, at, r, test){ let best = null, bd = r; for (const q of list){ if (!test(q)) continue; const d = dist(q, at); if (d < bd){ bd = d; best = q; } } return best; }
function goTo(npc, x, z, speed){ npc.gx = x; npc.gz = z; npc.speed = speed ?? ROLES[npc.role].speed; }
function stop(npc){ npc.gx = npc.x; npc.gz = npc.z; npc.speed = 0; }
function arrived(npc, r = .7){ return Math.hypot(npc.gx - npc.x, npc.gz - npc.z) < r; }
function wanderPoint(npc, world, radius){
 const trouble = ROLES[npc.role].group === 'trouble';
 for (let i = 0; i < 8; i++){
  const a = world.rand() * Math.PI * 2, d = 3 + world.rand() * radius, x = npc.home.x + Math.cos(a) * d, z = npc.home.z + Math.sin(a) * d;
  if (trouble && inSafe(x, z)) continue;
  return { x, z };
 }
 return { x: npc.home.x, z: npc.home.z };
}
//  The nearest point outside Common Ground, plus a few metres.
function exitPoints(x, z){
 return [{ x: SAFE.x0 - 6, z }, { x: SAFE.x1 + 6, z }, { x, z: SAFE.z0 - 6 }, { x, z: SAFE.z1 + 6 }].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
}
function exitPoint(x, z){ return exitPoints(x, z)[0]; }
function bark(npc, world, force){
 if (!force && world.now < npc.barkAt) return;
 if (!world.players.some(p => dist(p, npc) < 18)) return;
 const pool = BARKS[npc.role] || BARKS.wanderer, r = world.rand();
 let text = pool[Math.floor(r * pool.length)];
 if (npc.role === 'gossip' || (npc.role === 'storyteller' && r < .3)){ const others = world.npcs.filter(o => o !== npc); if (others.length) text = rumorAbout(others[Math.floor(world.rand() * others.length)], Math.floor(world.now / 20000)); }
 if (npc.story?.catch && r > .85) text = npc.story.catch;
 world.say(npc, text, 4.5);
 npc.barkAt = world.now + 9000 + world.rand() * 12000;
}
function face(npc, at){ npc.yaw = Math.atan2(at.x - npc.x, at.z - npc.z); }
//  Follow behind the owner's shoulder.
function follow(npc, o, gap = 2.3){
 const d = dist(npc, o), side = (hash(npc.id) & 1) ? 1 : -1, back = o.yaw ?? 0;
 const tx = o.x + Math.sin(back) * gap + Math.cos(back) * side * 1.1, tz = o.z + Math.cos(back) * gap - Math.sin(back) * side * 1.1;
 if (d > 30) return 'teleport';
 if (d > gap + .9) goTo(npc, tx, tz, d > 8 ? 4.6 : ROLES[npc.role].speed * (d > 4 ? 2.2 : 1));
 else { stop(npc); npc.act = 'idle'; }
 return null;
}

function think(npc, world, dt){
 const R = ROLES[npc.role]; if (!R) return;
 npc.t -= dt;
 for (const k in npc.cool) if ((npc.cool[k] -= dt) <= 0) delete npc.cool[k];
 const o = owner(npc, world);
 //  Down: lie there, then get up at home.
 if (npc.mode === 'down'){ npc.act = 'down'; stop(npc); if (npc.t <= 0){ npc.mode = 'idle'; npc.hp = npc.maxHp; npc.x = npc.home.x; npc.z = npc.home.z; npc.y = npc.home.y; npc.teleported = true; } return; }
 //  Trouble walks out of Common Ground before it does anything.
 if (npc.mode === 'leave'){
  npc.act = 'walk';
  if (!inSafe(npc.x, npc.z)){ npc.home = { x: npc.x, y: npc.y, z: npc.z }; npc.mode = 'idle'; npc.t = 1; npc.exit = 0; npc.leaveT = 0; return; }
  //  Nearest way out first; if walls are in the way, the next one; after half a minute, just be outside.
  if (npc.stuck){ npc.stuck = false; npc.exit = (npc.exit || 0) + 1; }
  npc.leaveT = (npc.leaveT || 0) + dt;
  const exits = exitPoints(npc.x, npc.z), e = exits[(npc.exit || 0) % exits.length];
  if (npc.leaveT > 30){ npc.x = e.x; npc.z = e.z; npc.teleported = true; npc.leaveT = 0; stop(npc); return; }
  goTo(npc, e.x, e.z, R.speed * 1.4); return;
 }
 if (npc.stuck){ npc.stuck = false; if (npc.mode === 'walk' || npc.mode === 'flee'){ const w = wanderPoint(npc, world, 10); goTo(npc, w.x, w.z); } }
 switch (R.group){
  case 'help': return helper(npc, world, o, dt);
  case 'trouble': return trouble(npc, world, o, dt);
  default: return citizen(npc, world, dt);
 }
}

const STATION_ACT = { busker: 'busk', preacher: 'preach', vendor: 'sell', dancer: 'dance', storyteller: 'tell', fixer: 'lean' };
function citizen(npc, world, dt){
 const role = npc.role;
 if (STATION_ACT[role]){
  //  Stay near home, doing the thing; shuffle a little now and then.
  if (npc.mode === 'walk'){ npc.act = 'walk'; if (arrived(npc) || npc.t <= 0){ stop(npc); npc.mode = 'idle'; npc.t = 15 + world.rand() * 20; } }
  else { stop(npc); npc.act = STATION_ACT[role]; if (npc.t <= 0){ const a = world.rand() * Math.PI * 2, r = world.rand() * 1.6; goTo(npc, npc.home.x + Math.cos(a) * r, npc.home.z + Math.sin(a) * r); npc.mode = 'walk'; npc.t = 6; } const p = near(world.players, npc, 9, () => true); if (p && role !== 'dancer') face(npc, p); }
  bark(npc, world); return;
 }
 if (role === 'gossip'){
  if (npc.mode === 'visit'){
   const other = world.npcs.find(q => q.id === npc.target);
   if (!other || npc.t <= 0){ npc.mode = 'idle'; npc.t = 2; return; }
   if (dist(npc, other) > 1.6){ goTo(npc, other.x + Math.sin(npc.yaw || 0) * .1, other.z + 1.2); npc.act = 'walk'; }
   else { stop(npc); face(npc, other); npc.act = 'talk'; if (!npc.heard){ npc.heard = true; world.say(npc, rumorAbout(other, Math.floor(world.now / 60000)), 5); } }
   return;
  }
  if (npc.t <= 0){
   const others = world.npcs.filter(q => q !== npc && dist(q, npc) < 30 && q.mode !== 'down');
   if (others.length){ const q = others[Math.floor(world.rand() * others.length)]; npc.target = q.id; npc.mode = 'visit'; npc.heard = false; npc.t = 22; return; }
  }
 }
 if (role === 'protester'){
  //  March a beat between home and ten metres along, sign up.
  npc.act = 'protest';
  if (arrived(npc) || npc.speed === 0){ npc.leg = !npc.leg; const a = (hash(npc.id) % 628) / 100; goTo(npc, npc.home.x + (npc.leg ? Math.cos(a) * 10 : 0), npc.home.z + (npc.leg ? Math.sin(a) * 10 : 0)); }
  bark(npc, world); return;
 }
 //  Wanderer, skater, tagger, gossip between visits: walk somewhere, stop, look.
 if (npc.mode === 'walk'){
  npc.act = role === 'skater' ? 'skate' : 'walk';
  if (arrived(npc) || npc.t <= 0){ stop(npc); npc.mode = 'idle'; npc.t = role === 'tagger' ? 9 : role === 'skater' ? .8 : 2 + world.rand() * 5; npc.act = role === 'tagger' ? 'spray' : 'idle'; }
 } else {
  npc.act = role === 'tagger' ? 'spray' : role === 'skater' ? 'skate' : 'idle';
  if (npc.t <= 0){ const w = wanderPoint(npc, world, role === 'skater' ? 20 : role === 'tagger' ? 8 : 12); goTo(npc, w.x, w.z); npc.mode = 'walk'; npc.t = 25; }
 }
 bark(npc, world);
}

function helper(npc, world, o, dt){
 const role = npc.role;
 if (role === 'courier' && npc.task && !npc.task.done){
  const to = world.players.find(p => p.accountId === npc.task.to || p.name === npc.task.toName);
  if (!to){ world.say(npc, `Could not find ${npc.task.toName || 'them'}. Bringing it back.`, 5); npc.task.done = true; return; }
  if (dist(npc, to) > 2){ goTo(npc, to.x, to.z, 3.6); npc.act = 'walk'; if (dist(npc, to) > 60 && world.now > (npc.task.jumpAt || 0)){ npc.task.jumpAt = world.now + 4000; } return; }
  stop(npc); face(npc, to); npc.act = 'talk';
  world.say(npc, `From ${npc.ownerName}: “${npc.task.msg}”`, 9);
  world.chat?.(`${npc.story?.name || 'A courier'} to ${to.name}, from ${npc.ownerName}: ${npc.task.msg}`);
  npc.task.done = true; npc.t = 3; return;
 }
 if (!o){ stop(npc); npc.act = 'idle'; bark(npc, world); return; }
 if (npc.mode === 'stay'){ stop(npc); npc.act = 'idle'; face(npc, o); bark(npc, world); return; }
 if (role === 'bodyguard'){
  //  Anything troublesome near the client gets dealt with.
  const foe = near(world.npcs, o, 8, q => ROLES[q.role]?.group === 'trouble' && q.mode !== 'down' && q.owner !== npc.owner);
  if (foe){
   npc.mode = 'fight';
   if (dist(npc, foe) > 1.3){ goTo(npc, foe.x, foe.z, 3.8); npc.act = 'walk'; }
   else { stop(npc); face(npc, foe); npc.act = 'punch'; if (!npc.cool.punch){ npc.cool.punch = .9; world.strike?.(npc, foe, 18); } }
   return;
  }
  npc.mode = 'follow';
 }
 if (role === 'builder' && dist(npc, o) < 10 && !npc.cool.gift){ npc.cool.gift = 180; world.gift?.(o, npc); world.say(npc, BARKS.builder[3], 4); }
 const r = follow(npc, o, role === 'companion' ? 2.6 : 2.2);
 if (r === 'teleport'){ npc.x = o.x + Math.sin(o.yaw || 0) * 2; npc.z = o.z + Math.cos(o.yaw || 0) * 2; npc.y = o.y ?? npc.y; npc.teleported = true; stop(npc); }
 else if (npc.speed > 0) npc.act = 'walk';
 bark(npc, world);
}

function trouble(npc, world, o, dt){
 const role = npc.role, R = ROLES[role];
 const mark = p => p.accountId !== npc.owner && p.hp > 0 && !p.safe && !p.protected && !inSafe(p.x, p.z) && !npc.cool['p' + p.id];
 if (npc.mode === 'stunned'){ stop(npc); npc.act = 'down'; if (npc.t <= 0){ npc.mode = 'idle'; npc.t = 2; } return; }
 if (role === 'pickpocket'){
  if (npc.mode === 'flee'){
   npc.act = 'run';
   const victim = world.players.find(p => p.id === npc.target);
   if (victim && dist(victim, npc) < 1.5){ world.say(npc, pick(rng(npc.id + world.now), ['Fine! Fine! Take it!', 'You are fast for a mark!', 'Alright, alright, here!']), 4); world.reward?.(victim, 15, 'caught ' + (npc.story?.name || 'a pickpocket'), npc); npc.cool['p' + victim.id] = 60; npc.mode = 'stunned'; npc.t = 4; return; }
   if (arrived(npc, 1) || npc.t <= 0 || !victim){ npc.mode = 'idle'; npc.t = 3; if (victim) npc.cool['p' + victim.id] = 40; }
   return;
  }
  const p = near(world.players, npc, 1.5, mark);
  if (p){
   const a = Math.atan2(npc.x - p.x, npc.z - p.z) + (world.rand() - .5), x = npc.x + Math.sin(a) * 16, z = npc.z + Math.cos(a) * 16;
   const safe = inSafe(x, z) ? exitPoint(x, z) : { x, z };
   goTo(npc, safe.x, safe.z, 4.6); npc.mode = 'flee'; npc.target = p.id; npc.t = 12;
   world.say(npc, pick(rng(npc.id + world.now), BARKS.pickpocket), 3); return;
  }
 }
 if (role === 'brawler' || role === 'crew'){
  if (npc.mode === 'fight'){
   const p = world.players.find(q => q.id === npc.target);
   if (!p || !mark(p) || dist(p, npc) > 5 || npc.punches >= 4){ if (p) npc.cool['p' + p.id] = 25; npc.mode = 'idle'; npc.t = 3; npc.punches = 0; return; }
   if (dist(p, npc) > 1.3){ goTo(npc, p.x, p.z, 3.2); npc.act = 'walk'; }
   else { stop(npc); face(npc, p); npc.act = 'punch'; if (!npc.cool.punch){ npc.cool.punch = 1.1; npc.punches = (npc.punches || 0) + 1; world.hurt?.(p, 6, npc); } }
   return;
  }
  const p = near(world.players, npc, role === 'crew' ? 4 : 2.2, mark);
  if (p){ npc.mode = 'fight'; npc.target = p.id; npc.punches = 0; world.say(npc, pick(rng(npc.id + world.now), BARKS[role]), 3); return; }
  //  Crew members keep to their leader.
  if (role === 'crew' && npc.leader && npc.leader !== npc.id){
   const lead = world.npcs.find(q => q.id === npc.leader && q.mode !== 'down');
   if (lead){ const i = (hash(npc.id) % 3) - 1, tx = lead.x - Math.sin(lead.yaw || 0) * 1.6 + Math.cos(lead.yaw || 0) * i * 1.3, tz = lead.z - Math.cos(lead.yaw || 0) * 1.6 - Math.sin(lead.yaw || 0) * i * 1.3;
    if (Math.hypot(tx - npc.x, tz - npc.z) > .8){ goTo(npc, tx, tz, R.speed * 1.4); npc.act = 'walk'; } else { stop(npc); npc.act = 'idle'; npc.yaw = lead.yaw; } bark(npc, world); return; }
  }
 }
 if (role === 'carrier'){ npc.act = npc.speed > 0 ? 'shamble' : 'cough'; }
 //  Otherwise roam the streets outside Common Ground.
 if (npc.mode === 'walk'){ if (role !== 'carrier') npc.act = 'walk'; if (arrived(npc) || npc.t <= 0){ stop(npc); npc.mode = 'idle'; npc.t = 2 + world.rand() * 4; } }
 else if (npc.t <= 0){ const w = wanderPoint(npc, world, 14); goTo(npc, w.x, w.z); npc.mode = 'walk'; npc.t = 25; }
 else if (role !== 'carrier') npc.act = 'idle';
 bark(npc, world);
}

//  Straight-line stepping toward the goal (the server, when nobody nearby is
//  moving this NPC with real collision; also the fallback in solo).
function step(npc, dt){
 const dx = npc.gx - npc.x, dz = npc.gz - npc.z, d = Math.hypot(dx, dz);
 npc.moving = d > .08 && npc.speed > 0;
 if (!npc.moving) return;
 const s = Math.min(d, npc.speed * dt);
 npc.x += dx / d * s; npc.z += dz / d * s; npc.yaw = Math.atan2(dx, dz);
}
//  A blow between NPCs: bodyguards versus trouble.
function strike(from, to, dmg){
 to.hp = Math.max(0, to.hp - dmg);
 if (!to.hp){ to.mode = 'down'; to.t = 8; to.speed = 0; return true; }
 return false;
}

return { ROLES, GROUPS, LIMITS, SAFE, BOOTH, inSafe, exitPoint, story, reroll, bio, voice, rumorAbout, quest, cleanSpec, init, think, step, strike, BARKS, hash, rng };
});
