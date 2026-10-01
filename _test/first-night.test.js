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
    await page.evaluate(() => { if (window.HD){ HD.locked = true; HD.tier = 'low'; } shFrontAct('new-campaign'); });
    const seen = { steps: new Set(), choices: [], cards: 0, took: [], dialogue: 0 };
    let done = false;
    for (let i = 0; i < 900 && !done; i++){
      const s = await page.evaluate(() => {
        const o = { step: FN.prologue ? FN.prologue.step : null, campaign: Campaign.active, chapter: Campaign.chapter };
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
