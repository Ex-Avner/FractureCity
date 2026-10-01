//  The First Night, driven end to end in a real browser.
//
//  Plays the prologue from the front menu to the First Movement, then checks
//  the systems it introduced in free play: every class, every weapon, taking a
//  weapon from the street, hitting a civilian, witnesses, Bureau Attention,
//  Wardens, the Q abilities, and that the lot survives a save and restore.
//
//    node first-night.test.js [repoRoot]

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { Checks, watch, serve, LAUNCH_ARGS } = require('./lib/harness');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const EXE = process.env.PW_CHROMIUM || undefined;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const c = new Checks('first-night.test.js — ' + ROOT);
  const site = await serve(ROOT);
  const browser = await chromium.launch(Object.assign({ args: LAUNCH_ARGS }, EXE ? { executablePath: EXE } : {}));
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const w = watch(page, site.origin);
  const shot = n => page.screenshot({ path: path.join(OUT, 'fn-' + n + '.png') }).catch(() => {});

  try {
    await page.goto(site.origin + '/apps/fracture-city-game/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(2500);

    const reg = await page.evaluate(() => ({
      fn: !!window.FN, version: window.FN && FN.version,
      classes: ['witness', 'quarry', 'tow', 'clerk', 'broadcaster'].every(k => !!CLASSES[k]),
      legacy: ['netrunner', 'operative', 'bruiser'].every(k => !!CLASSES[k]),
      warden: !!ENEMY_TYPES.warden,
    }));
    c.ok('first-night.js loaded', reg.fn, reg.version);
    c.ok('five lore classes registered', reg.classes);
    c.ok('legacy classes kept for old saves', reg.legacy);
    c.ok('warden enemy type registered', reg.warden);

    // ── The prologue, from the front door ──────────────────────────────────
    await page.evaluate(() => { if (window.HD){ HD.locked = true; HD.tier = 'perf'; } shFrontAct('new-campaign'); });
    const seen = { steps: new Set(), choices: [], cards: 0, took: [], dialogue: 0, beats: [], lines: [], context: true, leaked: false, injections: 0 };
    let holdChecked=false;
    let done = false;
    for (let i = 0; i < 900 && !done; i++){
      const s = await page.evaluate(() => {
        const o = { step: FN.prologue ? FN.prologue.step : null, campaign: Campaign.active, chapter: Campaign.chapter };
        if(FN.prologue){
          o.beat=FN.prologue.index;
          shNarrate([{who:'ned',text:'BACKGROUND DISTRICT SENTINEL'}]);
          shSay([{who:'ned',text:'BACKGROUND SAY SENTINEL'}]);
          shNedSay('market');toast('BACKGROUND TOAST SENTINEL','info');
          o.injected=true;o.leaked=Narr.active||Narr.pending.length>0;
        }
        if(FN.scene){
          const el=document.getElementById('fn-scene');
          o.scene=true;o.line=FN.scene.lines[FN.scene.index].text;
          o.context=!!el.querySelector('.where').textContent&&!!el.querySelector('.role').textContent&&!!el.querySelector('.next').textContent;
          o.clockMatches=State.dayTime===FN.prologue.clock;
          o.cityReady=['-1,-1','0,-1','-1,0','0,0'].every(k=>State.chunkMap.get(k)?.secMesh.some(Boolean));
          o.cameraAboveGround=State.camera.position.y>shSurfaceY(Player.position.x,Player.position.z,Player.position.y)+.5;
          return o;
        }
        const card = document.getElementById('fn-card');
        if (card && card.classList.contains('on')){
          const rec = card.querySelector('.fn-cls.rec'), opt = card.querySelector('.fn-opt');
          o.card = rec ? 'class' : opt && opt.id === 'fn-go' ? 'go' : 'choice';
          (rec || opt).click();
          return o;
        }
        if (Dialogue.active){ Dialogue.queue.length = 0; Dialogue.chars = 1e9; shEndDialogue(); o.dialogue = true; return o; }
        if (typeof Narr !== 'undefined' && Narr.active){ shNarrPush(); shNarrPush(); o.dialogue = true; return o; }
        const P = FN.prologue;
        if (!P) return o;
        //  Walk to wherever the marker is.
        let t = P.target; if (typeof t === 'function') t = t(); if (Array.isArray(t)) t = { x: t[0], z: t[1] };
        if (t){
          const s2 = shFindOpenSpot(t.x + 1.2, t.z + 1.2, 0.4, 1.8, 14);
          if (s2){ Player.position.set(s2.x, s2.y + Player.height, s2.z); }
        }
        if (FN._nearPickup){ o.took = FN._nearPickup.wid; document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'r' })); }
        //  Fight: face each looter and swing until they go down.
        if (P.step === 'break' && FN.state.loadout[1] === 'crowbar'){
          const foe = P.foes.find(e => e.state !== 'dead' && !e.fnLeave);
          if (foe){
            Player.position.set(foe.position.x + 1.4, foe.position.y + Player.height, foe.position.z);
            const dx = foe.position.x - Player.position.x, dz = foe.position.z - Player.position.z;
            Player.yaw = Math.atan2(-dx, -dz); Player.pitch = -0.25;
            State.camera.position.copy(Player.position); State.camera.rotation.set(Player.pitch, Player.yaw, 0, 'YXZ');
            Player.attackCooldown = 0; Player.hp = Player.hpMax;
            tryAttack(); o.swing = foe.hp;
          }
        }
        return o;
      });
      if(s.injected)seen.injections++;
      seen.leaked ||= !!s.leaked;
      if(s.beat>=0 && seen.beats.at(-1)!==s.beat)seen.beats.push(s.beat);
      if(s.scene){
        seen.lines.push(s.line);seen.context &&= s.context;
        if(!holdChecked){
          c.ok('opening camera is above the street',s.cameraAboveGround);
          c.ok('Civic Core is rendered before the opening pause',s.cityReady);
          c.ok('opening clock matches the scene time',s.clockMatches);
          const held=await page.evaluate(()=>({line:FN.scene.index,clock:State.dayTime,actors:State.globalNPCs.map(n=>n.position.toArray())}));
          await page.evaluate(()=>shCampaignSilence());
          await page.waitForTimeout(700);
          const still=await page.evaluate(()=>({line:FN.scene.index,clock:State.dayTime,actors:State.globalNPCs.map(n=>n.position.toArray())}));
          c.eq('scene holds until acknowledged, even through campaign silence',JSON.stringify(still),JSON.stringify(held));
          await shot('blocking-dialogue');holdChecked=true;
        }
        if(seen.lines.length%2)await page.keyboard.press('n');
        else await page.locator('#fn-scene-next').click();
      }
      if (s.step) seen.steps.add(s.step);
      if (s.card){ seen.cards++; if (s.card === 'choice') seen.choices.push(s.step); }
      if (s.took) seen.took.push(s.took);
      if (s.dialogue) seen.dialogue++;
      if (s.campaign && !s.step && seen.cards > 3) done = true;
      await page.waitForTimeout(s.card || s.dialogue ? 150 : 60);
      if (i === 60) await shot('prologue-early');
    }
    await shot('after-prologue');
    const after = await page.evaluate(() => ({
      prologue: !!FN.prologue, done: FN.state.prologueDone, cls: FN.state.cls, choices: FN.state.choices,
      campaign: Campaign.active, chapter: Campaign.chapter, choicesSaved: typeof Campaign.choices['fn.state'] === 'string',
      loadout: FN.state.loadout, heat: FN.heat,
    }));
    c.ok('prologue walked every beat', ['walk', 'fracture', 'break', 'arrangement', 'end'].every(k => seen.steps.has(k)), [...seen.steps].join(' → '));
    c.eq('three prologue choices recorded', Object.keys(after.choices || {}).length, 3);
    c.ok('took the crowbar from the street', seen.took.includes('crowbar'), seen.took.join(','));
    c.ok('prologue finished', after.done && !after.prologue);
    c.ok('a lore class was chosen', !!after.cls, after.cls);
    c.ok('class kit applied', after.loadout && !!after.loadout[1] && after.loadout[1] !== 'fists', JSON.stringify(after.loadout));
    c.ok('the case began at the First Movement', after.campaign && after.chapter === 0);
    c.ok('first-night state survives the campaign reset', after.choicesSaved);
    c.eq('heat cleared after a year', after.heat, 0);

    c.gt('background narration injected throughout the prologue',seen.injections,20);
    c.ok('ambient narration never enters the scene queue',!seen.leaked);
    c.ok('every scene line names its location, speaker role and next action',seen.context&&seen.lines.length>20);
    c.ok('scene sequence visited in order exactly once',seen.beats.every((n,i)=>n===i)&&seen.beats.length===10,seen.beats.join(','));
    c.ok('all scene text was individually acknowledged',seen.lines.some(t=>t.includes('back after a short break'))&&seen.lines.some(t=>t.includes('carrier tone')));
    c.ok('no background line leaks into the case',await page.evaluate(()=>!JSON.stringify([Narr.line,Narr.queue,Narr.pending]).includes('SENTINEL')));
    const rails=await page.evaluate(()=>{
      const list=[...State.chunkMap.values()].filter(c=>!c._skatepark).flatMap(c=>c.rails||[]);
      return {count:list.length,bad:list.filter(r=>Math.abs(r.y1-r.y0)>Math.hypot(r.x1-r.x0,r.z1-r.z0)*.6).length};
    });
    c.gt('valid street rails retained',rails.count,0);
    c.eq('no wall-to-road rails generated',rails.bad,0);

    // A real Warden walks across a voxel kerb, including its rendered feet.
    const kerb = await page.evaluate(() => {
      const savedHeat = FN.heat; FN.heat = 0;
      const cells = [];
      for (let x = 40; x < 50; x++) for (let z = 40; z < 45; z++) for (let y = 0; y < 8; y++){
        cells.push([x,y,z,getBlock(x,y,z)]);
        setBlock(x,y,z, y < (x < 45 ? 1 : 2) ? B_CONCRETE : 0, false);
      }
      const e = new Enemy('warden',42,42,new RNG('kerb-regression'));
      e.position.set(42,1,42); e.group.position.copy(e.position);
      e.direction=0; e.patrolTimer=100;
      for(let i=0;i<100;i++) e.update(0.05,Player);
      const surface=shSurfaceY(e.position.x,e.position.z,e.position.y+2.2);
      const result={x:e.position.x,y:e.position.y,feet:e.group.position.y,surface,paths:{}};
      // The actual bypass branches must all publish their ground height.
      for(const mode of ['escort','frozen','heat']){
        e.position.set(47,1,42);e.group.position.y=1;e.fnChar.baseY=1;
        e.fnEscort=mode==='escort';e.fnFrozen=mode==='frozen'?2:0;
        FN.heat=mode==='heat'?2:0;e.state='patrol';e.update(.05,Player);
        result.paths[mode]=Math.abs(e.group.position.y-shSurfaceY(e.position.x,e.position.z,e.position.y+2.2))<.15;
      }
      e.fnEscort=false;e.fnFrozen=0;
      // Hook moves a real target from the road to a raised pad via the Q handler.
      const pp=Player.position.clone(),cls=Player.classKey,oldEnemies=State.enemies.slice();
      applyClass('tow');FN.heat=2;State.enemies.length=0;State.enemies.push(e);
      e.position.set(43,1,42);e.group.position.copy(e.position);
      Player.position.set(48,2+Player.height,42);FN.abilityCd=0;State.ui.paused=false;Player.mode='walk';
      document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',key:'q'}));
      result.paths.hook=e.position.x>45&&Math.abs(e.group.position.y-shSurfaceY(e.position.x,e.position.z,e.position.y+2.2))<.15;
      State.enemies.splice(0,State.enemies.length,...oldEnemies);Player.position.copy(pp);applyClass(cls);
      for(const [x,y,z,id] of cells) setBlock(x,y,z,id,false);
      FN.heat=savedHeat;
      return result;
    });
    c.ok('Warden actually crossed the kerb', kerb.x > 46 && kerb.surface === 2, JSON.stringify(kerb));
    c.ok('Warden feet follow the raised pavement', Math.abs(kerb.feet-kerb.surface)<0.15, JSON.stringify(kerb));
    for(const [mode,ok] of Object.entries(kerb.paths))c.ok('grounding: '+mode,ok);

    // ── Free play: hitting people, heat and Wardens ─────────────────────────
    const street = await page.evaluate(async () => {
      const o = {};
      shCampaignStop();
      State.ui.paused = false;
      Player.position.set(40, 30, 40); Player.velocity.set(0, 0, 0);
      for (let i = 0; i < 30; i++) updateChunks();
      await new Promise(r => setTimeout(r, 2500));
      //  Pickups seeded into the world.
      o.pickups = FN.pickups.length;
      //  Find a civilian and stand in front of them.
      const n = State.globalNPCs.find(n => n.char);
      o.hasNpc = !!n;
      if (!n) return o;
      n.speed = 0;
      const put = () => {
        Player.position.set(n.position.x + 1.5, n.position.y + Player.height, n.position.z);
        const dx = n.position.x - Player.position.x, dz = n.position.z - Player.position.z;
        Player.yaw = Math.atan2(-dx, -dz); Player.pitch = -0.2;
        State.camera.position.copy(Player.position); State.camera.rotation.set(Player.pitch, Player.yaw, 0, 'YXZ');
      };
      put();
      FN.state.warned = true;   // the prologue's goodwill would forgive the first report
      FN.state.loadout[1] = 'crowbar'; FN.applyLoadout(); Player.currentWeapon = 'baton';
      Player.attackCooldown = 0;
      const hp0 = n.char.fnb ? n.char.fnb.hp : 40;
      tryAttack();
      o.hit = !!n.char.fnb && n.char.fnb.hp < hp0;
      o.state = n.char.fnb && n.char.fnb.st;
      o.pending = FN.pending.length;
      //  Put them down.
      for (let i = 0; i < 6 && n.char.fnb.st !== 'dead'; i++){ put(); Player.attackCooldown = 0; if (n.char.fnb.st === 'down') n.char.fnb.st = 'ok'; tryAttack(); }
      o.dead = n.char.fnb.st;
      //  Keep a witness in range so the report lands.
      const wit = State.globalNPCs.find(m => m !== n && m.char);
      if (wit){ wit.position.set(n.position.x + 3, n.position.y, n.position.z); wit.speed = 0; if (wit.char.fnb) wit.char.fnb.st = 'ok'; }
      //  The sim runs on a capped clock, and a software renderer is slow, so
      //  wait on the condition rather than on the wall.
      const until = async (f, ms) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 250)); };
      await until(() => FN.level() > 0, 120000);
      o.level = FN.level();
      o.hud = document.getElementById('fn-heat').classList.contains('on');
      await until(() => State.enemies.some(e => e.fnHunt), 120000);
      o.wardens = State.enemies.filter(e => e.fnHunt).length;
      o.wardenTypes = [...new Set(State.enemies.filter(e => e.fnHunt).map(e => e.type))];
      return o;
    });
    c.gt('weapons seeded in the streets', street.pickups, 0);
    c.ok('a civilian was found', street.hasNpc);
    c.ok('a civilian can be hit', street.hit, street.state);
    c.ok('the crime is pending witnesses', street.pending > 0, street.pending);
    c.eq('a civilian can be killed', street.dead, 'dead');
    c.gt('witnessed crime raised Bureau Attention', street.level, 0);
    c.ok('heat HUD shows', street.hud);
    c.gt('Wardens dispatched', street.wardens, 0);
    await shot('heat');

    // ── Abilities, weapons, save and restore ───────────────────────────────
    const kit = await page.evaluate(async () => {
      const o = {};
      o.abilities = {};
      FN.heat = 0; FN.pending.length = 0;
      for (const k of ['witness', 'quarry', 'tow', 'clerk', 'broadcaster']){
        applyClass(k);
        if (k === 'tow') FN.spawnAround('thug', 5, 9, false);
        FN.abilityCd = 0; State.ui.paused = false; Player.mode = 'walk';
        let err = null;
        try { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q' })); } catch (e){ err = e.message; }
        o.abilities[k] = err || (FN.abilityCd > 0 ? 'used' : 'not used');
      }
      //  Every weapon writes onto its slot and fires without throwing.
      o.weapons = {};
      for (const id of Object.keys(FN.weapons)){
        const w = FN.weapons[id];
        FN.state.loadout[w.slot] = id; FN.applyLoadout();
        const key = { 1: 'baton', 2: 'pistol', 3: 'shotgun' }[w.slot];
        Player.ammo[key] = Math.max(Player.ammo[key] || 0, 5);
        Player.currentWeapon = key; Player.attackCooldown = 0;
        let err = null;
        try { tryAttack(); } catch (e){ err = e.message; }
        o.weapons[id] = err || (WEAPONS[key].name === w.name ? 'ok' : 'wrong name ' + WEAPONS[key].name);
      }
      //  Save, wreck, restore.
      applyClass('tow');
      FN.state.loadout[1] = 'axe'; FN.applyLoadout(); FN.heat = 2.5;
      const id = await shSlotSave(null, 'fn-test');
      FN.state.loadout[1] = 'fists'; FN.heat = 0;
      await shSlotRestore(id);
      await new Promise(r => setTimeout(r, 600));
      o.restored = { cls: FN.state.cls, melee: FN.state.loadout[1], heat: Math.round(FN.heat * 10) / 10, name: WEAPONS.baton.name };
      return o;
    }).catch(e => ({ error: e.message }));
    c.absent('abilities and weapons ran', kit.error);
    for (const [k, v] of Object.entries(kit.abilities || {})) c.eq('ability ' + k, v, 'used');
    for (const [k, v] of Object.entries(kit.weapons || {})) c.eq('weapon ' + k, v, 'ok');
    c.eq('restore: class', kit.restored && kit.restored.cls, 'tow');
    c.eq('restore: found weapon kept', kit.restored && kit.restored.melee, 'axe');
    c.eq('restore: weapon written to its slot', kit.restored && kit.restored.name, 'FIRE AXE');
    c.eq('restore: heat kept', kit.restored && kit.restored.heat, 2.5);

    // ── Runtime health ──────────────────────────────────────────────────────
    await page.waitForTimeout(1500);
    c.ok('no page errors', w.pageErrors.length === 0, w.pageErrors.slice(0, 3).join(' | '));
    c.ok('no unexpected console errors', w.consoleErrors.length === 0, w.consoleErrors.slice(0, 3).join(' | '));
  } catch (e){
    c.ok('harness ran', false, e.message);
  } finally {
    await browser.close();
    site.close();
  }
  process.exit(c.report() ? 1 : 0);
})();
