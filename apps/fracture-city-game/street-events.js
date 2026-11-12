/* Street events: occasional set pieces on validated open public streets.

   A busker draws a crowd that claps. A parade marches through with signs
   and a drum. A flash mob appears, dances, freezes on cue and scatters. A
   pop-up market wheels in. Two people square up and a ring forms. A
   preacher climbs a crate and gathers listeners.

   One at a time, on your screen only (other residents get their own). The
   people are full residents with the Casting Booth's bodies and acts. They
   leave when the event ends or you walk away. */
(function(){'use strict';
if (typeof THREE === 'undefined' || typeof State === 'undefined' || !window.FCNpcBrain) return;
const B = window.FCNpcBrain, TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const feet = () => Player.position.y - Player.height;
const scale = () => ({ perf: .6, low: .75 })[window.HD?.tier] ?? 1;

const LINES = {
 busk: ['This one is called Rent Day.', 'Thank you! Thank you, pigeon!', 'Requests? No? Great, I only know this one.', 'Coins in the case, feelings in the chorus!'],
 crowd: ['Again!', 'Is this the one about the landlord?', 'He is actually good.', 'I am filming this. I will never watch it.', 'Woo!'],
 parade: ['MORE BENCHES! MORE BENCHES!', 'WHOSE STREETS? OUR STREETS!', 'HONK IF YOU ARE TIRED!', 'LIGHTS ON FOR NIGHT SHIFT!', 'PAY THE MURALISTS!'],
 signs: ['MORE BENCHES', 'WHOSE STREETS', 'LET THE PIGEONS VOTE', 'OPEN THE ROOF', 'PAY THE MURALISTS', 'RENT IS A GHOST STORY', 'FREE THE ARCADE'],
 mob: ['Five, six, seven, eight!', 'Nobody look at the camera!', 'FREEZE!', 'Scatter!'],
 market: ['Fresh! Ish!', 'Two for one!', 'Everything must go! Mostly the cart!', 'Samples! Do not ask of what!'],
 brawl: ['Say that again!', 'You spilled my noodles!', 'Hold me back! Nobody is holding me back!', 'Round two!'],
 ring: ['Fight! Fight! Actually, do not!', 'My money is on the short one.', 'Somebody call someone!', 'Ooh!'],
 preach: ['The meek shall inherit the parking!', 'Repent, or at least read the small print!', 'I have seen the end times! They are mostly adverts!', 'Brothers! Sisters! Others! Hydrate!'],
 listen: ['Amen?', 'He has a point about the parking.', 'Is this a cult?', 'Preach! Not like that.'],
};
function look(scenes, seed){ const l = window.FCWardrobe ? FCWardrobe.crowdLook(null, new RNG('event:' + seed), scenes) : {}; delete l.scene; return l; }

// ─── Placement: open, level ground in front of you ──────────────────────────
// Public streets only. A clear floor is not permission to occupy a cell,
// sanctuary, player plot, roof, wilderness landmark or authored interior.
function publicPoint(x,z,y){
 const c=State.chunkMap.get(Math.floor(x/VOX_W)+','+Math.floor(z/VOX_W));
 if(!c||c.landmark||c._wild||c._maker||c._parked||c.district?.wild||y<.5||y>3.1)return false;
 if(!isSolid(getBlock(Math.floor(x),Math.floor(y-.05),Math.floor(z)))||shBodyBlocked(x,y,z,.38,1.85))return false;
 for(let h=Math.ceil(y+1.85);h<VOX_H;h++)if(isSolid(getBlock(Math.floor(x),h,Math.floor(z))))return false;
 return true;
}
function permitted(){return !window.FCJustice?.active&&publicPoint(Player.position.x,Player.position.z,feet());}
function openRing(cx,cz,r){
 const y=shSurfaceY(cx,cz,feet()+3);
 if(Math.abs(y-feet())>1)return null;
 // Validate the whole occupied disk, including its centre and footprint margin.
 for(let dx=-r-.5;dx<=r+.5;dx+=.75)for(let dz=-r-.5;dz<=r+.5;dz+=.75){
  if(Math.hypot(dx,dz)>r+.55)continue;
  const yy=shSurfaceY(cx+dx,cz+dz,y+1.2);
  if(Math.abs(yy-y)>.3||!publicPoint(cx+dx,cz+dz,yy))return null;
 }
 return {x:cx,y,z:cz};
}
function clearRoute(x,z,ex,ez,y){const n=Math.ceil(Math.hypot(ex-x,ez-z)/.75);for(let i=0;i<=n;i++){const t=n?i/n:0,xx=x+(ex-x)*t,zz=z+(ez-z)*t,yy=shSurfaceY(xx,zz,y+1);if(Math.abs(yy-y)>.3||!publicPoint(xx,zz,yy))return false;}return true;}
//  Somewhere ahead you can see: open ground and a clear line from your eyes.
function spot(r){
 const fwd = Player.yaw, eye = Player.position;
 for (let i = 0; i < 24; i++){
  const a = fwd + rnd(-.8, .8), d = rnd(7, i < 12 ? 15 : 22), x = eye.x - Math.sin(a) * d, z = eye.z - Math.cos(a) * d, s = openRing(x, z, r);
  if (s && (typeof shLineOfSight !== 'function' || shLineOfSight(eye.x, eye.y, eye.z, s.x, s.y + 1.4, s.z))) return s;
 }
 return null;
}

// ─── Actors ─────────────────────────────────────────────────────────────────
let ev = null;
function actor(role, scenes, x, z, act){
 const y = shSurfaceY(x,z,feet()+3);if(!publicPoint(x,z,y))throw new Error('Event footprint is not public open ground');
 const seed = Math.random().toString(36).slice(2), st = B.story(role, seed);
 const e = FCNpcs.body(look(scenes, seed), st.name, role, st, 'ev' + seed);
 e.ent = { position: new THREE.Vector3(x, y, z), streetEvent:true }; e.group.position.copy(e.ent.position); e.act = act; e.phase = Math.random() * 6; e.speed = 0; e.goal = null;
 State.scene.add(e.group); ev.actors.push(e); return e;
}
function faceTo(e, x, z){ e.char.group.rotation.y = Math.atan2(x - e.group.position.x, z - e.group.position.z); }
function walk(e, x, z, speed){ e.goal = { x, z }; e.speed = speed; }
function step(e, dt){
 if (!e.goal) return false;
 const p = e.ent.position, dx = e.goal.x - p.x, dz = e.goal.z - p.z, d = Math.hypot(dx, dz);
 if (d < .2){ e.goal = null; return false; }
 const s = Math.min(d, e.speed * dt);
 if(!publicPoint(p.x+dx/d*s,p.z+dz/d*s,p.y)){e.goal=null;return false;}
 const ok = shGroundMove(e.ent, dx / d * s, dz / d * s, .28, 1.7);
 if (!ok){ e.blocked = (e.blocked || 0) + dt; if (e.blocked > 1.5){ e.goal = null; } }
 e.char.group.rotation.y = Math.atan2(dx, dz); e.group.position.copy(p); return ok;
}
function say(e, pool){ if(!e||e.char.fnb?.st==='dead')return;FCNpcs.bubble(e, pick(LINES[pool] || [pool])); e.talkUntil = performance.now() + 1800; }
function end(){ if (!ev) return; for (const e of ev.actors) FCNpcs.dispose(e); ev = null;wait=rnd(90,180); }

// ─── The events ─────────────────────────────────────────────────────────────
const EVENTS = {
 busker(at){
  const b = actor('busker', ['punk', 'goth', 'skater'], at.x, at.z, 'busk'); faceTo(b, Player.position.x, Player.position.z);
  const n = Math.round(rnd(4, 6) * scale());
  for (let i = 0; i < n; i++){ const a = Math.atan2(Player.position.x - at.x, Player.position.z - at.z) + (i - (n - 1) / 2) * .45, r = rnd(2.4, 3.4), c = actor('wanderer', ['punk', 'skater', 'office', 'work', 'raver'], at.x + Math.sin(a) * r, at.z + Math.cos(a) * r, 'watch'); c.clap = true; faceTo(c, at.x, at.z); }
  return { secs: 55, tick(t, dt){ if ((this.next = (this.next ?? 2) - dt) <= 0){ this.next = rnd(4, 7); Math.random() < .5 ? say(b, 'busk') : say(pick(ev.actors.slice(1)), 'crowd'); } } };
 },
 parade(at){
  //  A line marching across in front of you, start to finish 40 m.
  const dir = Player.yaw + Math.PI / 2 + (Math.random() < .5 ? 0 : Math.PI), sx = at.x - Math.sin(dir) * 20, sz = at.z - Math.cos(dir) * 20, ex = at.x + Math.sin(dir) * 22, ez = at.z + Math.cos(dir) * 22;
  const n = Math.round(rnd(6, 9) * scale()), people = [];
  for (let i = 0; i < n; i++){ const back = i * 1.3, side = (i % 2 ? .7 : -.7), x = sx - Math.sin(dir) * back + Math.cos(dir) * side, z = sz - Math.cos(dir) * back - Math.sin(dir) * side;
   const gx=ex-Math.sin(dir)*back+Math.cos(dir)*side,gz=ez-Math.cos(dir)*back-Math.sin(dir)*side;
   if(!clearRoute(x,z,gx,gz,at.y))continue;
   const drum = i === 1, e = actor(drum ? 'wanderer' : 'protester', ['punk', 'work', 'goth', 'raver'], x, z, drum ? 'drum' : 'protest');
   walk(e, ex - Math.sin(dir) * back + Math.cos(dir) * side, ez - Math.cos(dir) * back - Math.sin(dir) * side, 1.2); people.push(e); }
  if(people.length<3)throw new Error('No clear public parade route');
  return { secs: 50, tick(t, dt){ if ((this.next = (this.next ?? 1) - dt) <= 0){ this.next = rnd(2.5, 4); say(pick(people), 'parade'); } if (people.every(e => !e.goal)) this.left = Math.min(this.left, 3); } };
 },
 flashmob(at){
  const n = Math.round(rnd(6, 8) * scale()), ds = [];
  for (let i = 0; i < n; i++){ const a = i / n * TAU, r = i ? rnd(1.5, 3) : 0, e = actor('dancer', ['raver', 'punk', 'office', 'work', 'skater'], at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, 'idle'); e.spin = a; faceTo(e, Player.position.x, Player.position.z); ds.push(e); }
  return { secs: 34, tick(t, dt){ const k = this.age || 0;
   if (k < 3){ if (!this.cued){ this.cued = true; say(ds[0], 'Five, six, seven, eight!'); } }
   else if (k < 24){ for (const e of ds) e.act = 'dance'; if (!this.mid && k > 12){ this.mid = true; say(pick(ds), 'Nobody look at the camera!'); } }
   else if (k < 28){ for (const e of ds) e.act = 'freeze'; if (!this.froze){ this.froze = true; say(ds[0], 'FREEZE!'); } }
   else if (!this.gone){ this.gone = true; say(ds[0], 'Scatter!'); for (const e of ds){ e.act = 'run'; const a = rnd(0, TAU); walk(e, e.group.position.x + Math.cos(a) * 14, e.group.position.z + Math.sin(a) * 14, 3.6); } } } };
 },
 market(at){
  const f = Math.atan2(Player.position.x - at.x, Player.position.z - at.z);
  const vs = [-1, 1].map(s => { const e = actor('vendor', ['work', 'skater'], at.x + Math.cos(f) * s * 2.2, at.z - Math.sin(f) * s * 2.2, 'sell'); e.char.group.rotation.y = f; return e; });
  const shoppers = []; for (let i = 0; i < Math.round(3 * scale()); i++) shoppers.push(actor('wanderer', ['office', 'goth', 'punk', 'work'], at.x + rnd(-2, 2) + Math.sin(f) * 2.5, at.z + rnd(-2, 2) + Math.cos(f) * 2.5, 'idle'));
  return { secs: 60, tick(t, dt){ if ((this.next = (this.next ?? 1) - dt) <= 0){ this.next = rnd(3, 6); say(pick(vs), 'market'); const s = pick(shoppers); if (s && !s.goal){ const v = pick(vs); walk(s, v.group.position.x + Math.sin(f) * 1.6 + rnd(-.4, .4), v.group.position.z + Math.cos(f) * 1.6 + rnd(-.4, .4), 1.2); } } for (const s of shoppers) if (!s.goal) faceTo(s, at.x, at.z); } };
 },
 brawl(at){
  const a = actor('brawler', ['punk', 'work'], at.x - .7, at.z, 'punch'), b = actor('brawler', ['office', 'goth', 'skater'], at.x + .7, at.z, 'punch');
  faceTo(a, b.group.position.x, b.group.position.z); faceTo(b, a.group.position.x, a.group.position.z); b.phase = .5;
  const ring = []; for (let i = 0; i < Math.round(4 * scale()); i++){ const ang = i / 4 * TAU + .4, c = actor('wanderer', ['punk', 'office', 'work', 'raver'], at.x + Math.cos(ang) * 2.8, at.z + Math.sin(ang) * 2.8, 'watch'); faceTo(c, at.x, at.z); ring.push(c); }
  return { secs: 26, tick(t, dt){
   if ((this.next = (this.next ?? 1) - dt) <= 0){ this.next = rnd(2.5, 4); say(Math.random() < .5 ? pick([a, b]) : pick(ring), Math.random() < .5 ? 'brawl' : 'ring'); }
   //  Walk up and it stops.
   if (!this.over && Math.hypot(Player.position.x - at.x, Player.position.z - at.z) < 2.5){ this.over = true; this.left = Math.min(this.left, 6); say(a, 'Alright, alright. We are done.'); }
   if (this.left < 6 && !this.split){ this.split = true; for (const e of [a, b]){ e.act = 'idle'; walk(e, e.group.position.x + (e === a ? -10 : 10), e.group.position.z, 1.4); } }
  } };
 },
 rally(at){
  const p = actor('preacher', ['office', 'goth'], at.x, at.z, 'preach'); faceTo(p, Player.position.x, Player.position.z);
  const fl = []; for (let i = 0; i < Math.round(5 * scale()); i++){ const a = Math.atan2(Player.position.x - at.x, Player.position.z - at.z) + (i - 2) * .5, c = actor('wanderer', ['work', 'office', 'punk', 'goth'], at.x + Math.sin(a) * rnd(2.6, 3.6), at.z + Math.cos(a) * rnd(2.6, 3.6), 'watch'); faceTo(c, at.x, at.z); fl.push(c); }
  return { secs: 45, tick(t, dt){ if ((this.next = (this.next ?? 1) - dt) <= 0){ this.next = rnd(4, 6); Math.random() < .65 ? say(p, 'preach') : say(pick(fl), 'listen'); } } };
 },
};
const KINDS = Object.keys(EVENTS);
let wait = 45, lastKind = '', prevT = performance.now();
function start(kind){
 if (!window.FCNpcs || ev || !State.chunkMap.size || !permitted()) return false;
 kind = kind || pick(KINDS.filter(k => k !== lastKind && (k !== 'brawl' || !(Player.position.x>=140&&Player.position.x<=288&&Player.position.z>=0&&Player.position.z<=120))));
 if (!EVENTS[kind]) return false;
 const at = spot(kind === 'parade' ? 1.5 : 3.6); if (!at) return false;
 ev = { kind, actors: [], at, scene: State.scene, seed: State.citySeed };
 try { const logic = EVENTS[kind](at); Object.assign(ev, logic); ev.left = logic.secs; ev.age = 0; } catch (e){ console.warn('[street-events]', e); end(); return false; }
 lastKind = kind; return true;
}
function frame(now){
 requestAnimationFrame(frame);
 const dt = Math.min(.1, (now - prevT) / 1000); prevT = now;
 try {
  if (ev && (ev.scene !== State.scene || ev.seed !== State.citySeed)) end();
  if (!State.scene || !permitted() || State.ui.inIntro || window.FN?.prologue || window.FN?.scene){ end(); return; }
  if (State.ui.paused || State.ui.inDialogue || State.ui.inInventory || State.ui.inArcade || State.ui.inMiniGame) return;
  const t = now / 1000;
  if (!ev){ wait -= dt; if (wait <= 0 && Player.mode !== 'drive'){ wait = rnd(90, 180); if (!start()) wait = 30; } return; }
  ev.age += dt; ev.left -= dt;
  const far = Math.hypot(Player.position.x - ev.at.x, Player.position.z - ev.at.z) > 70;
  if (ev.left <= 0 || far){ end(); return; }
  if(!ev.alarmed&&ev.actors.some(e=>e.char.fnb&&e.char.fnb.hp<e.char.fnb.max)){
   ev.alarmed=true;ev.left=Math.min(ev.left,5);
   for(const e of ev.actors){e.act='run';const a=rnd(0,TAU);walk(e,e.ent.position.x+Math.cos(a)*9,e.ent.position.z+Math.sin(a)*9,3);}
  }
  if(!ev.alarmed)ev.tick?.call(ev, t, dt);
  for (const e of ev.actors){
   if(e.char.fnb?.st==='dead'){e.group.visible=false;continue;}
   if(e.char.fnb?.st==='down')continue;
   if(!publicPoint(e.ent.position.x,e.ent.position.z,e.ent.position.y)){end();return;}
   const moving = step(e, dt);
   e.talking = e.talkUntil > now; if (e.bubble) e.bubble.visible = Math.hypot(e.group.position.x - Player.position.x, e.group.position.z - Player.position.z) < 26;
   e.char.studio.motionSpeed = moving ? e.speed : 0;
   shAnimateCharacter(e.char, dt, moving, t);
   if (e.act === 'freeze'){ e.char.studio.torso.rotation.y = .4; e.char.leftArm.rotation.set(-2.4, 0, .3); e.char.rightArm.rotation.set(-.3, 0, -1.2); }
   else FCNpcs.pose(e, e.act === 'run' ? 'run' : e.act, t, dt, moving);
  }
 } catch (e){ if (!frame._w){ frame._w = 1; console.warn('[street-events]', e); } end(); }
}
requestAnimationFrame(frame);
window.FCStreetEvents = { kinds: KINDS, start, end, publicPoint, openRing, clearRoute, permitted, get combatants(){return ev?ev.actors.map(e=>({char:e.char,kind:'street',owner:e.ent,pos:e.ent.position})):[];}, get current(){ return ev ? { kind: ev.kind, people: ev.actors.length, left: ev.left, at: {...ev.at} } : null; } };
})();
