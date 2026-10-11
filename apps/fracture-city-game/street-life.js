// =============================================================================
//  STREET LIFE · what people do, what goes wrong, and fairer drones
// -----------------------------------------------------------------------------
//  People
//    Chat in pairs, take calls, smoke, stop to look up, take photos, jog, busk
//    for a small crowd, argue (and sometimes brawl), and run from the Turned.
//
//  Crimes, about one a minute near you, one at a time
//    · a bag snatch: the thief runs; knock them down to get the bag back
//    · a mugging: a thug holds someone up; deal with the thug
//    · a brawl: two people fighting; walk up and it stops
//    · a pickpocket: someone bumps you and runs with your credits
//    · a car break-in: an alarm, a figure at the door
//    · a tagger: fresh paint on a wall, and the painter
//  Helping pays. Hitting a culprit is not reported to the Bureau.
//
//  Drones
//    None in the prologue or the outbreak story; the Bureau sends Wardens
//    instead. Everywhere else they glow, show a red aiming line for most of a
//    second before each shot (step aside and it misses), hit for half as much
//    and die faster.
// =============================================================================
(function(){
'use strict';
if (typeof NPC === 'undefined' || typeof Enemy === 'undefined') return;
const SL = window.StreetLife = { version: '0.38.0', crime: null, crimeT: 35, actT: 0, stats: { crimes: 0, solved: 0, acts: 0 } };
const safe = f => { try { return f(); } catch (e){ console.warn('[street-life]', e); } };
const pick = a => a[Math.floor(Math.random() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const INFECTED = new Set(['zombie', 'stalker', 'spitter', 'howler', 'husk']);

function body(n){
  const c = n.char;
  if (!c.fnb) c.fnb = { hp: 40, max: 40, st: 'ok', t: 0, flinch: 0, protect: false, kind: 'street',
    brawler: Math.random() < 0.14, punchT: 0, barkT: 0 };
  return c.fnb;
}
function bark(n, text, secs){ if (window.FN && FN.bark && n && n.char) FN.bark({ char: n.char, pos: n.position }, text, secs || 2.4); }
function storyBusy(){
  if (window.FN && FN.prologue) return true;
  if (typeof Dialogue !== 'undefined' && Dialogue.active) return true;
  const O = window.Outbreak;
  if (O && O.st && typeof Campaign !== 'undefined' && Campaign.active && !Campaign.finished){
    const ch = shChapter(); const reach = ch && ch.objectives.find(o => o.kind === 'reach');
    if (reach && Campaign.done[reach.id] && !Campaign.done['closed:' + ch.id]) return true;
  }
  return false;
}
function storyOn(){ return (window.FN && FN.prologue) || (typeof Campaign !== 'undefined' && Campaign.active && !Campaign.finished); }
function pay(n, why){ safe(() => grantCredits(n)); toast(`${why} · +${n} credits`, 'success'); SL.stats.solved++; }

// ─── Lines ──────────────────────────────────────────────────────────────────
const CHAT = [
  ['Did you hear what Ned said?', 'Which version?'],
  ['They moved the bus stop.', 'Where to?', 'Nobody knows. That is the new stop.'],
  ['How is your mother?', 'Temporary.'],
  ['I filed a complaint about the complaints office.', 'And?', 'They have filed it.'],
  ['Is it Tuesday?', 'Officially, yes. Personally, no.'],
  ['My neighbour is walking very slowly lately.', 'Do not let him in.'],
  ['I got a letter saying my letter was received.', 'Lucky.'],
];
const PHONE = ['No, I am outside. Outside the building. No, the other outside.', 'Tell them I said it was fine. Yes. I know it was not fine.',
  'Can you hear me? I can hear me.', 'I will be home by six. Which six, I cannot promise.', 'The Bureau put me on hold. I am still on hold. This is hold.'];
const LOOK = ['Was that sign always there?', 'The sky is doing the thing again.', 'Somebody is up on that roof.', 'I used to live up there.'];
const PHOTO = ['Hold still. The city is never in focus.', 'For the record. Not the official record.', 'Smile. No, the other way.'];
const BUSK = ['♪ Temporary, temporary, everything is temporary ♪', '♪ The six o’clock came and nobody went home ♪', '♪ I heard my name on the evening news, but it was not my name ♪'];
const ARGUE = [['That was my spot.', 'It is a public pavement.', 'Publicly, it is my spot.'], ['You owe me nine credits.', 'I owe the whole city nine credits.'],
  ['You took the last sheet.', 'There was no last sheet.', 'That is what the last sheet would say.']];
const JOG = ['On your left.', 'Do not stop me, I am training for leaving.', 'Personal best. Personally.'];
const FLEE_TURNED = ['It is one of them!', 'Do not let it touch you!', 'Run!', 'That was Mr Okafor!'];

// ─── Activities ─────────────────────────────────────────────────────────────
function start(n, kind, extra){
  n._act = Object.assign({ kind, t: 8 + Math.random() * 8, barkT: 0.4 + Math.random() * 1.5 }, extra || {});
  SL.stats.acts++;
}
function stop(n){ if (n && n._act){ const p = n._act.partner; n._act = null; if (p && p._act && p._act.partner === n) p._act = null; } }

const _update = NPC.prototype.update;
NPC.prototype.update = function(dt){
  const A = this._act, b = this.char && this.char.fnb;
  if (!A || this._mall || (b && b.st !== 'ok')){ if (A && b && b.st !== 'ok') stop(this); return _update.apply(this, arguments); }
  if (A.partner && !State.globalNPCs.includes(A.partner)){ stop(this); return _update.apply(this, arguments); }
  A.t -= dt; A.barkT -= dt;
  const c = this.char, now = performance.now() * 0.001;
  let moving = false;
  const face = (x, z) => { this.direction = Math.atan2(z - this.position.z, x - this.position.x); };
  switch (A.kind){
    case 'chat': case 'argue': case 'brawl': {
      const p = A.partner; face(p.position.x, p.position.z);
      if (A.kind === 'brawl'){
        A.punch = (A.punch || Math.random()) - dt;
        if (A.punch <= 0){ A.punch = 0.8 + Math.random() * 0.6; c.rightArm.rotation.x = -1.6;
          safe(() => shSfxSwing(this.position.x, this.position.z));
          safe(() => shBurst(p.position.x, (p.position.y || 0) + 1.4, p.position.z, { count: 3, color: 0x7a1420, size: 0.05, speed: 2, life: 0.3, grav: 10 })); }
        else c.rightArm.rotation.x *= 0.85;
      } else if (A.kind === 'argue') c.rightArm.rotation.x = -0.7 + Math.sin(now * 6) * 0.5;
      if (A.lines && A.barkT <= 0 && A.lead){
        const line = A.lines[A.i % A.lines.length]; const who = A.i % 2 ? p : this;
        bark(who, line, 2.6); A.i++; A.barkT = 2.8;
        if (A.i >= A.lines.length){ A.lines = null; if (A.kind === 'argue' && Math.random() < 0.35 && !SL.crime) beginBrawl(this, p); }
      }
      break;
    }
    case 'phone':
      c.rightArm.rotation.x = -2.4; c.rightArm.rotation.z = -0.3;
      if (A.barkT <= 0){ bark(this, pick(PHONE), 3); A.barkT = 7; }
      break;
    case 'smoke':
      c.rightArm.rotation.x = Math.sin(now * 0.8) > 0.6 ? -2.2 : -0.3;
      if (A.barkT <= 0){ A.barkT = 2.5; safe(() => shBurst(this.position.x, (this.position.y || 0) + 1.9, this.position.z, { count: 2, color: 0x9a9aa0, size: 0.09, speed: 0.6, life: 1.6, grav: -1 })); }
      break;
    case 'look':
      if (c.head) c.head.rotation.x = -0.45;
      if (A.barkT <= 0 && Math.random() < 0.5){ bark(this, pick(LOOK), 2.4); A.barkT = 99; }
      break;
    case 'photo':
      c.rightArm.rotation.x = c.leftArm.rotation.x = -1.5;
      if (A.barkT <= 0){ A.barkT = 3; safe(() => shBurst(this.position.x + Math.cos(this.direction) * 0.4, (this.position.y || 0) + 1.6, this.position.z + Math.sin(this.direction) * 0.4, { count: 6, color: 0xffffff, size: 0.12, speed: 3, life: 0.15 }));
        if (Math.random() < 0.4) bark(this, pick(PHOTO), 2.2); }
      break;
    case 'busk':
      c.rightArm.rotation.x = -1.0 + Math.sin(now * 7) * 0.4; c.leftArm.rotation.x = -1.2;
      if (A.barkT <= 0){ A.barkT = 4; bark(this, pick(BUSK), 3.4);
        if (Math.hypot(this.position.x - Player.position.x, this.position.z - Player.position.z) < 18){
          const base = [262, 294, 330, 392, 440][Math.floor(Math.random() * 5)];
          for (let i = 0; i < 3; i++) safe(() => shTone({ type: 'triangle', f0: base * [1, 1.25, 1.5][i], f1: base * [1, 1.25, 1.5][i], gain: 0.04, dur: 0.35, delay: i * 0.18 })); } }
      break;
    case 'watch':
      face(A.x, A.z);
      break;
    case 'cower':
      c.rightArm.rotation.x = c.leftArm.rotation.x = -2.6;
      break;
    case 'jog': {
      const step = (this.speed * 2.2 + 0.8) * dt;
      A.dir = A.dir == null ? this.direction : A.dir;
      moving = safe(() => shGroundMove(this, Math.cos(A.dir) * step, Math.sin(A.dir) * step, 0.38, 1.75));
      if (!moving) A.dir += Math.PI / 2 + Math.random();
      this.direction = A.dir;
      if (A.barkT <= 0){ A.barkT = 99; if (Math.random() < 0.5) bark(this, pick(JOG), 1.8); }
      break;
    }
  }
  shAnimateCharacter(c, dt * (A.kind === 'jog' ? 1.8 : 1), moving, now);
  if (A.kind === 'jog') safe(() => shSettle(this, 0.38, 1.75));
  c.baseY = this.position.y;
  this.group.position.x = this.position.x; this.group.position.z = this.position.z;
  this.group.rotation.y = -this.direction + Math.PI / 2;
  if (A.t <= 0 && !A.hold){ if (c.head) c.head.rotation.x = 0; c.rightArm.rotation.z = 0; stop(this); }
};

function idleNear(maxD){
  const out = [];
  for (const n of State.globalNPCs){
    if (!n.char || n._act || n._mall || (n.char.fnb && n.char.fnb.st !== 'ok') || n.char._culprit) continue;
    const d = Math.hypot(n.position.x - Player.position.x, n.position.z - Player.position.z);
    if (d < maxD && d > 3) out.push(n);
  }
  return out;
}
function directActivities(){
  const busy = State.globalNPCs.filter(n => n._act).length;
  if (busy >= 7) return;
  const pool = idleNear(40); if (!pool.length) return;
  const n = pick(pool), r = Math.random();
  const partner = pool.find(q => q !== n && Math.hypot(q.position.x - n.position.x, q.position.z - n.position.z) < 4.5);
  if (partner && r < 0.45){
    const argue = Math.random() < 0.3, lines = argue ? pick(ARGUE) : pick(CHAT);
    const t = 6 + lines.length * 3;
    start(n, argue ? 'argue' : 'chat', { partner, lines, i: 0, lead: true, t });
    start(partner, argue ? 'argue' : 'chat', { partner: n, t });
    return;
  }
  const kinds = ['phone', 'phone', 'smoke', 'look', 'photo', 'jog', 'jog', 'busk'];
  const kind = pick(kinds);
  if (kind === 'busk'){
    if (State.globalNPCs.some(q => q._act && q._act.kind === 'busk')) return;
    start(n, 'busk', { t: 30 });
    for (const q of pool.filter(q => q !== n && dist(q.position, n.position) < 9).slice(0, 3)) start(q, 'watch', { x: n.position.x, z: n.position.z, t: 14 + Math.random() * 10 });
    return;
  }
  start(n, kind);
}

// ─── Crimes ─────────────────────────────────────────────────────────────────
let marker = null;
function markOn(obj){
  if (!marker){
    marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: 0xff3a4a, depthTest: false, transparent: true, opacity: 0.9 }));
    marker.renderOrder = 950;
  }
  if (marker.parent !== State.scene) State.scene.add(marker);
  marker.visible = !!obj; marker.userData.obj = obj;
}
function tickMarker(){
  if (!marker || !marker.visible) return;
  const o = marker.userData.obj; const p = o && (o.position || (o.group && o.group.position));
  if (!p){ marker.visible = false; return; }
  marker.position.set(p.x, (p.y || 0) + 2.6 + Math.sin(performance.now() / 200) * 0.12, p.z);
  marker.rotation.y += 0.05;
}
function report(text){ toast('CRIME · ' + text, 'warn'); SL.stats.crimes++; }
function end(msg, ok){
  const C = SL.crime; if (!C) return;
  for (const n of C.culprits || []) if (n.char) n.char._culprit = false;
  if (C.victim && C.victim._act && C.victim._act.kind === 'cower') stop(C.victim);
  if (C.cleanup) safe(C.cleanup);
  markOn(null);
  if (msg) toast(msg, ok ? 'success' : 'info');
  SL.crime = null; SL.crimeT = 45 + Math.random() * 40;
}

function beginBrawl(a, b){
  start(a, 'brawl', { partner: b, t: 14, hold: true });
  start(b, 'brawl', { partner: a, t: 14, hold: true });
  for (const q of idleNear(30).filter(q => dist(q.position, a.position) < 10).slice(0, 4)) start(q, 'watch', { x: a.position.x, z: a.position.z, t: 12 });
  report('A fight has broken out. Walk over and it might stop.');
  SL.crime = { kind: 'brawl', culprits: [], a, b, t: 30 };
  markOn(a);
}
function crimeSnatch(){
  const pool = idleNear(35).filter(n => Math.hypot(n.position.x - Player.position.x, n.position.z - Player.position.z) > 10);
  const victim = pick(pool); if (!victim) return false;
  const thief = pool.find(q => q !== victim && dist(q.position, victim.position) < 18);
  if (!thief) return false;
  const tb = body(thief); thief.char._culprit = true;
  tb.st = 'flee'; tb.t = 30; tb.fx = victim.position.x; tb.fz = victim.position.z; tb.brawler = false;
  start(victim, 'cower', { t: 6 });
  bark(victim, pick(['My bag! Stop them!', 'Thief! That is my bag!', 'Someone stop that coat!']), 3);
  report('Bag snatch. The thief is running; knock them down.');
  SL.crime = { kind: 'snatch', culprits: [thief], thief, victim, t: 40 };
  markOn(thief);
  return true;
}
function crimeMugging(){
  const pool = idleNear(35).filter(n => Math.hypot(n.position.x - Player.position.x, n.position.z - Player.position.z) > 12);
  const victim = pick(pool); if (!victim || !ENEMY_TYPES.thug) return false;
  const a = Math.random() * Math.PI * 2;
  const s = shFindOpenSpot(victim.position.x + Math.cos(a) * 1.3, victim.position.z + Math.sin(a) * 1.3, 0.5, 1.9, 8); if (!s) return false;
  const e = new Enemy('thug', s.x, s.z, new RNG('mug:' + Math.random()));
  e.position.y = s.y; e.group.position.set(s.x, s.y, s.z);
  e._mug = { victim }; e.state = 'patrol';
  State.scene.add(e.group); State.enemies.push(e);
  start(victim, 'cower', { t: 40, hold: true });
  bark(victim, pick(['Take it, just take it.', 'I do not have anything. I have a library card.', 'Please. It was a gift.']), 3);
  report('Mugging in progress.');
  SL.crime = { kind: 'mug', culprits: [], thug: e, victim, t: 30,
    cleanup(){ if (e.state !== 'dead' && e.group.parent){ e.group.parent.remove(e.group); const i = State.enemies.indexOf(e); if (i >= 0) State.enemies.splice(i, 1); } } };
  markOn(e);
  return true;
}
function crimePickpocket(){
  const pool = idleNear(20); const n = pick(pool); if (!n) return false;
  const credits = State.hud.credits || 0; if (credits < 10) return false;
  SL.crime = { kind: 'pickpocket', culprits: [n], thief: n, phase: 'approach', t: 25, took: 0 };
  n.char._culprit = true;
  start(n, 'jog', { t: 25, hold: true, dir: null });
  return true;
}
function crimeCar(){
  const cars = [...State.chunkMap.values()].flatMap(c => c.parkedCars || []).filter(car => {
    const d = Math.hypot(car.position.x - Player.position.x, car.position.z - Player.position.z); return d > 10 && d < 35; });
  const car = pick(cars); if (!car) return false;
  const pool = idleNear(45).filter(n => dist(n.position, car.position) < 25);
  const n = pick(pool); if (!n) return false;
  const s = shFindOpenSpot(car.position.x + 1.6, car.position.z, 0.38, 1.75, 6); if (!s) return false;
  n.position.set(s.x, s.y, s.z); n.char._culprit = true;
  start(n, 'photo', { t: 30, hold: true });
  report('Car alarm. Someone is at the door of a parked car.');
  SL.crime = { kind: 'car', culprits: [n], thief: n, car, t: 25 };
  markOn(n);
  return true;
}
function crimeTag(){
  const pool = idleNear(30); const n = pick(pool); if (!n) return false;
  //  The nearest wall within reach of the painter.
  let wall = null;
  for (let r = 1; r <= 4 && !wall; r++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
    const x = Math.floor(n.position.x + dx * r), z = Math.floor(n.position.z + dz * r), y = Math.floor((n.position.y || 2) + 1);
    if (isSolid(getBlock(x, y, z)) && isSolid(getBlock(x, y + 1, z))){ wall = { x, y, z, dx, dz }; break; }
  }
  if (!wall) return false;
  const col = pick([0xff60d0, 0x80ffff, 0xffd47a, 0x7dffb3]);
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 }));
  tag.position.set(wall.x + 0.5 - wall.dx * 0.52, wall.y + 0.7, wall.z + 0.5 - wall.dz * 0.52);
  tag.rotation.y = wall.dx ? -Math.sign(wall.dx) * Math.PI / 2 : (wall.dz > 0 ? Math.PI : 0);
  State.scene.add(tag);
  setTimeout(() => { if (tag.parent) tag.parent.remove(tag); }, 240000);
  n.char._culprit = true;
  start(n, 'photo', { t: 20, hold: true });
  bark(n, pick(['Public art. Nobody voted.', 'It says TEMPORARY. In my handwriting.', 'This wall was asking for it.']), 2.6);
  report('Fresh paint on a wall nearby. The painter is still there.');
  SL.crime = { kind: 'tag', culprits: [n], thief: n, t: 25 };
  markOn(n);
  return true;
}
function startCrime(){
  const list = [crimeSnatch, crimeSnatch, crimeMugging, crimeMugging, crimePickpocket, crimeCar, crimeTag];
  for (let i = 0; i < 4; i++) if (pick(list)()) return true;
  return false;
}

function crimeTick(dt){
  const C = SL.crime;
  if (!C){
    if (storyBusy()) return;
    SL.crimeT -= dt;
    if (SL.crimeT <= 0){ SL.crimeT = 20; startCrime(); }
    return;
  }
  C.t -= dt;
  const P = Player.position;
  //  Hitting a culprit is not a crime the Bureau will hear about.
  if (window.FN && FN.pending) for (let i = FN.pending.length - 1; i >= 0; i--){ const v = FN.pending[i].victim; if (v && v._culprit) FN.pending.splice(i, 1); }
  const down = n => n && n.char && n.char.fnb && (n.char.fnb.st === 'down' || n.char.fnb.st === 'dead');
  switch (C.kind){
    case 'snatch': {
      if (down(C.thief)){ bark(C.victim, 'You got it back! Thank you, I mean it.', 3); pay(15 + Math.floor(Math.random() * 25), 'Bag returned'); return end(); }
      if (C.t <= 0 || !State.globalNPCs.includes(C.thief) || Math.hypot(C.thief.position.x - P.x, C.thief.position.z - P.z) > 70) return end('The thief got away.');
      break;
    }
    case 'mug': {
      const e = C.thug;
      if (e.state === 'dead' || e.hp <= 0){ bark(C.victim, 'Thank you. I owe you something. Here, have something.', 3); pay(25 + Math.floor(Math.random() * 30), 'Mugging stopped'); return end(); }
      if (C.t <= 0){ bark(C.victim, 'They took everything. Even the library card.', 3); return end('The mugger left with the wallet.'); }
      break;
    }
    case 'brawl': {
      const near = Math.min(dist(P, C.a.position), dist(P, C.b.position));
      if (near < 4){
        for (const n of [C.a, C.b]){ stop(n); const b = body(n); b.st = 'flee'; b.t = 6; b.fx = P.x; b.fz = P.z; }
        bark(C.a, 'Alright! Alright. We are done.', 2.4);
        pay(10, 'Fight broken up'); return end();
      }
      if (C.t <= 0 || !State.globalNPCs.includes(C.a) || !State.globalNPCs.includes(C.b)){ stop(C.a); stop(C.b); return end('The fight ended without you.'); }
      break;
    }
    case 'pickpocket': {
      const n = C.thief;
      if (!State.globalNPCs.includes(n)) return end();
      if (C.phase === 'approach'){
        const dx = P.x - n.position.x, dz = P.z - n.position.z, d = Math.hypot(dx, dz);
        if (n._act) n._act.dir = Math.atan2(dz, dx);
        if (d < 1.4){
          const took = Math.min(State.hud.credits, 5 + Math.floor(Math.random() * 16));
          State.hud.credits -= took; safe(() => grantCredits(0)); C.took = took;
          stop(n); const b = body(n); b.st = 'flee'; b.t = 30; b.fx = P.x; b.fz = P.z; b.brawler = false;
          toast(`Your pocket feels lighter. ${took} credits are running away.`, 'warn');
          report('Pickpocket. Knock them down to get it back.'); markOn(n); C.phase = 'run'; C.t = 35;
        } else if (C.t <= 0) return end();
      } else {
        if (down(n)){ pay(C.took + 10, 'Wallet recovered'); return end(); }
        if (C.t <= 0 || Math.hypot(n.position.x - P.x, n.position.z - P.z) > 70) return end('The pickpocket got away.');
      }
      break;
    }
    case 'car': {
      //  The alarm: two tones, alternating, while it lasts.
      C.beep = (C.beep || 0) - dt;
      if (C.beep <= 0 && Math.hypot(C.car.position.x - P.x, C.car.position.z - P.z) < 40){
        C.beep = 0.5; C.hi = !C.hi;
        safe(() => { const a = shSndAt(C.car.position.x, C.car.position.z, 14); shTone({ type: 'square', f0: C.hi ? 880 : 660, f1: C.hi ? 880 : 660, gain: 0.05 * a.gain, dur: 0.3, pan: a.pan }); });
      }
      const n = C.thief;
      if (down(n)){ pay(20, 'Car thief stopped'); return end(); }
      if (Math.hypot(n.position.x - P.x, n.position.z - P.z) < 9 && n._act){
        stop(n); const b = body(n); b.st = 'flee'; b.t = 20; b.fx = P.x; b.fz = P.z; b.brawler = false;
        bark(n, 'It is my car! It is somebody’s car!', 2);
      }
      if (C.t <= 0 || !State.globalNPCs.includes(n)) return end('The alarm stopped. Nobody knows why.');
      break;
    }
    case 'tag': {
      const n = C.thief;
      if (down(n)){ pay(8, 'Tagger stopped'); return end(); }
      if (Math.hypot(n.position.x - P.x, n.position.z - P.z) < 6 && n._act){
        stop(n); const b = body(n); b.st = 'flee'; b.t = 15; b.fx = P.x; b.fz = P.z; b.brawler = false;
        bark(n, 'Critics!', 1.6);
      }
      if (C.t <= 0 || !State.globalNPCs.includes(n)) return end();
      break;
    }
  }
}

//  A mugger holds still over the victim until you come close or hit them.
const _enemyUpdate = Enemy.prototype.update;
Enemy.prototype.update = function(dt){
  if (this._mug && !this._mugAggro){
    const v = this._mug.victim;
    if (this.hp < this.maxHp || Math.hypot(Player.position.x - this.position.x, Player.position.z - this.position.z) < 9 || !v){
      this._mugAggro = true; this.state = 'alert'; this.lastSeenPlayerPos = Player.position.clone();
      if (window.FN && FN.bark) FN.bark({ group: this.group }, pick(['Walk away. This is a private conversation.', 'You picked the wrong night.', 'Mind your own street.']), 2.4, true);
    } else {
      this.direction = Math.atan2(v.position.z - this.position.z, v.position.x - this.position.x);
      this.group.rotation.y = -this.direction + Math.PI / 2;
      this.attackTimer = 2;
      return;
    }
  }
  return _enemyUpdate.apply(this, arguments);
};

//  People run from the Turned.
function fleeTurned(){
  const turned = State.enemies.filter(e => INFECTED.has(e.type) && e.state !== 'dead' && e.hp > 0);
  if (!turned.length) return;
  for (const n of State.globalNPCs){
    if (!n.char || n._mall) continue;
    const b = body(n); if (b.st !== 'ok') continue;
    for (const e of turned){
      if (Math.hypot(e.position.x - n.position.x, e.position.z - n.position.z) < 9){
        stop(n); b.st = 'flee'; b.t = 8; b.fx = e.position.x; b.fz = e.position.z;
        if (Math.random() < 0.3) bark(n, pick(FLEE_TURNED), 1.6);
        break;
      }
    }
  }
}

// ─── Drones ─────────────────────────────────────────────────────────────────
if (ENEMY_TYPES.drone){
  Object.assign(ENEMY_TYPES.drone, { hp: 24, dmg: 4, attackCooldown: 1.6, attackRange: 14, detectRange: 20, speed: 4.2 });
}
const GLOW_TEX = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,120,90,.9)'); g.addColorStop(1, 'rgba(255,60,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
function dressDrone(e){
  if (e._slDressed || !e.group) return;
  e._slDressed = true;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffb070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(1.6, 1.6, 1); e.group.add(halo); e._halo = halo;
  const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]),
    new THREE.LineBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0, depthTest: false }));
  beam.frustumCulled = false; beam.renderOrder = 940;
  State.scene.add(beam); e._beam = beam;
}
const _attack = Enemy.prototype.doAttack;
Enemy.prototype.doAttack = function(){
  if (this.type !== 'drone' || this._slFire) return _attack.apply(this, arguments);
  if (this._charge > 0) return;
  //  Aim first. The shot lands where you were when the line went red.
  this._charge = 0.8; this._aim = new THREE.Vector3(Player.position.x, Player.position.y - Player.height * 0.4, Player.position.z);
};
const _droneUpdate = Enemy.prototype.update;
Enemy.prototype.update = function(dt){
  const r = _droneUpdate.apply(this, arguments);
  if (this.type !== 'drone') return r;
  dressDrone(this);
  const t = performance.now() * 0.001;
  if (this._halo) this._halo.material.opacity = this.state === 'dead' ? 0 : 0.65 + Math.sin(t * 6) * 0.2 + (this._charge > 0 ? 0.3 : 0);
  if (this._charge > 0 && this.state !== 'dead'){
    this._charge -= dt;
    const from = this.group.position, to = this._aim;
    const pos = this._beam.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z); pos.setXYZ(1, to.x, to.y, to.z); pos.needsUpdate = true;
    this._beam.material.opacity = 0.25 + (1 - this._charge / 0.8) * 0.7;
    if (this._charge <= 0){
      this._beam.material.opacity = 0;
      const p = Player.position;
      const hit = Math.hypot(p.x - to.x, p.z - to.z) < 1.3 && this.sees !== false;
      if (hit){ this._slFire = true; try { _attack.call(this); } finally { this._slFire = false; } }
      else safe(() => shTracer(from.clone(), to.clone(), 0xff3050));
    }
  } else if (this._beam) this._beam.material.opacity = 0;
  if (this.state === 'dead' && this._beam && this._beam.parent){ this._beam.parent.remove(this._beam); }
  return r;
};
//  No hostile drones in the story; the Bureau sends people.
const _pick = window.shPickEnemyType;
if (_pick) window.shPickEnemyType = function(roll){ const t = _pick.apply(this, arguments); return t === 'drone' && storyOn() ? 'thug' : t; };
function purgeStoryDrones(){
  if (!storyOn()) return;
  for (let i = State.enemies.length - 1; i >= 0; i--){
    const e = State.enemies[i];
    if (e.type !== 'drone') continue;
    const hunt = e.fnHunt;
    if (e.group && e.group.parent) e.group.parent.remove(e.group);
    if (e._beam && e._beam.parent) e._beam.parent.remove(e._beam);
    State.enemies.splice(i, 1);
    if (hunt && window.FN && FN.spawnAround && !FN.prologue) safe(() => FN.spawnAround('warden', 26, 42, true));
  }
}

// ─── Crowds ─────────────────────────────────────────────────────────────────
//  Chunks only spawn people as they are built, so a street you have stood on
//  for a while empties out. Keep a dozen or so within sight, arriving out of
//  view and leaving the same way.
function crowd(){
  if (window.FN && (FN.prologue || FN.prologueBlocksSpawns)) return;
  const P = Player.position;
  const hour = (State.dayTime || 0) / 60, night = hour < 6 || hour > 22;
  const target = night ? 7 : 13;
  let near = 0;
  for (let i = State.globalNPCs.length - 1; i >= 0; i--){
    const n = State.globalNPCs[i];
    const d = Math.hypot(n.position.x - P.x, n.position.z - P.z);
    if (n._crowd && d > 80 && !(n.char && n.char._culprit)){
      State.globalNPCs.splice(i, 1); if (n.group.parent) n.group.parent.remove(n.group); continue;
    }
    if (d < 45 && !n._mall) near++;
  }
  if (near >= target || State.globalNPCs.length >= 44) return;
  for (let tries = 0; tries < 6; tries++){
    const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 16;
    const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
    const cx = Math.floor(x / VOX_W), cz = Math.floor(z / VOX_W);
    const chunk = State.chunkMap.get(cx + ',' + cz);
    if (!chunk || chunk._wild || chunk._mall || chunk.landmark === 'apartment') continue;
    const s = shFindOpenSpot(x, z, 0.38, 1.75, 4); if (!s) continue;
    safe(() => {
      shSetSpawnContext(chunk.district, hour);
      const n = new NPC(s.x, s.z, new RNG('crowd:' + Math.random()));
      n.position.y = s.y; n.group.position.y = s.y; n.char.baseY = s.y;
      n.chunkKey = chunk.key; n._crowd = true;
      chunk.group.add(n.group); State.globalNPCs.push(n);
    });
    return;
  }
}

// ─── The frame ──────────────────────────────────────────────────────────────
let last = 0, slow = 0;
const _after = window.shAfterChunks;
window.shAfterChunks = function(){
  const r = _after.apply(this, arguments);
  const now = performance.now(), dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
  if (!State.citySeed) return r;
  safe(tickMarker);
  safe(() => crimeTick(dt));
  //  Real time, so a slow frame rate does not starve the street.
  if (now >= slow){
    slow = now + 400;
    safe(purgeStoryDrones);
    safe(fleeTurned);
    safe(crowd);
    if (!(window.FN && FN.prologue)){
      SL.actT -= 0.4;
      if (SL.actT <= 0){ SL.actT = 2.2; safe(directActivities); }
    }
  }
  return r;
};

SL.debug = { startCrime(kind){ const f = { snatch: crimeSnatch, mug: crimeMugging, pick: crimePickpocket, car: crimeCar, tag: crimeTag }[kind]; return f ? f() : startCrime(); }, end };
console.log('[street-life] ' + SL.version + ' ready');
})();
