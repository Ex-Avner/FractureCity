require('fs').mkdirSync(require('path').join(__dirname,'out'),{recursive:true});
//  The Outbreak, played start to finish in a real browser.
//
//  Prologue from the front menu, then all five chapters: reach each station,
//  defend the repair, put down exactly twenty of the Turned per chapter, see
//  the counter reach zero and the ending. Also checks the repair pauses with
//  the Turned at the station or the player away, that a reload rebuilds the
//  remaining Turned, that ambient infected are not counted, and that a save
//  from the old campaign is moved onto the new story.
//
//    node outbreak.test.js [repoRoot]

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { Checks, watch, serve, LAUNCH_ARGS } = require('./lib/harness');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const EXE = process.env.PW_CHROMIUM || undefined;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const c = new Checks('outbreak.test.js — ' + ROOT);
  const site = await serve(ROOT);
  const browser = await chromium.launch(Object.assign({ channel:'chrome', args: LAUNCH_ARGS }, EXE ? { executablePath: EXE } : {}));
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const w = watch(page, site.origin);
  const shot = n => page.screenshot({ path: path.join(OUT, 'ob-' + n + '.png') }).catch(() => {});

  try {
    await page.goto(site.origin + '/apps/fracture-city-game/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const reg = await page.evaluate(() => ({
      ob: !!window.Outbreak, chapters: CAMPAIGN.map(ch => ch.id), total: Outbreak.total,
      quarry: JSON.stringify(CAMPAIGN).toLowerCase().includes('quarry'),
      cls: CLASSES.quarry && CLASSES.quarry.name, pick: WEAPONS && FN && JSON.stringify(Object.keys(FN)).length > 0,
    }));
    c.ok('outbreak.js loaded', reg.ob);
    c.eq('five chapters', reg.chapters.join(','), 'ob-clock,ob-voice,ob-memory,ob-form,ob-six');
    c.eq('one hundred Turned in all', reg.total, 100);
    c.ok('no quarry in the campaign', !reg.quarry);
    c.eq('Quarry Hand renamed', reg.cls, 'UTILITY HAND');

    // ── Prologue ──────────────────────────────────────────────────────────
    await page.evaluate(() => { if (window.HD){ HD.locked = true; HD.tier = 'perf'; } shFrontAct('new-campaign'); });
    const lines = [];
    let foughtTurned = false;
    for (let i = 0; i < 900; i++){
      const s = await page.evaluate(() => {
        const o = { step: FN.prologue ? FN.prologue.step : null, campaign: Campaign.active };
        if (FN.scene){ o.line = FN.scene.lines[FN.scene.index].text; FN.scene.advance(); return o; }
        const card = document.getElementById('fn-card');
        if (card && card.classList.contains('on')){
          const rec = card.querySelector('.fn-cls.rec'), opt = card.querySelector('.fn-opt');
          (rec || opt).click(); o.card = true; return o;
        }
        if (Dialogue.active){ Dialogue.queue.length = 0; Dialogue.chars = 1e9; shEndDialogue(); o.d = true; return o; }
        const P = FN.prologue; if (!P) return o;
        let t = P.target; if (typeof t === 'function') t = t(); if (Array.isArray(t)) t = { x: t[0], z: t[1] };
        if (t){ const s2 = shFindOpenSpot(t.x + 1.2, t.z + 1.2, 0.4, 1.8, 14); if (s2) Player.position.set(s2.x, s2.y + Player.height, s2.z); }
        if (FN._nearPickup) document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'r' }));
        if (P.step === 'break' && FN.state.loadout[1] === 'crowbar'){
          const foe = P.foes.find(e => e.state !== 'dead' && e.hp > 0);
          if (foe){
            o.foe = foe.type;
            Player.position.set(foe.position.x + 1.4, foe.position.y + Player.height, foe.position.z);
            const dx = foe.position.x - Player.position.x, dz = foe.position.z - Player.position.z;
            Player.yaw = Math.atan2(-dx, -dz); Player.pitch = -0.25;
            State.camera.position.copy(Player.position); State.camera.rotation.set(Player.pitch, Player.yaw, 0, 'YXZ');
            Player.attackCooldown = 0; Player.hp = Player.hpMax; tryAttack();
          }
        }
        return o;
      });
      if (s.line) lines.push(s.line);
      if (s.foe === 'zombie') foughtTurned = true;
      if (s.campaign && !s.step && lines.length > 20) break;
      await page.waitForTimeout(s.card || s.d ? 120 : 50);
    }
    c.ok('prologue ends in the campaign', await page.evaluate(() => Campaign.active && Campaign.chapter === 0 && !FN.prologue));
    c.ok('the prologue fight is against the Turned', foughtTurned);
    c.ok('Ned throws the error', lines.some(l => l.includes('Error 0x1758')));
    c.ok('prologue keeps the chemist joke', lines.some(l => l.includes('enjoy it responsibly')));
    c.ok('no quarry in the prologue', !lines.join(' ').toLowerCase().includes('quarry'));
    c.ok('no em dashes in the prologue', !lines.join(' ').includes('—'));
    await shot('after-prologue');

    // Make the repairs quick; the logic is the same.
    await page.evaluate(() => { for (const ch of Outbreak.chapters) ch.station.secs = 6; Outbreak.chapters[3].station.secs = 120; Outbreak.timeScale = 15; });

    // ── Five chapters ────────────────────────────────────────────────────
    const seen = { counts: [], pausedNear: false, pausedAway: false, cards: 0, hud: false, realKill: false, quips: 0,
      chapters: [], kills: {}, ending: null, ambientCounted: null, reload: null, lines: [] };
    let lastQuip = '';
    for (let i = 0; i < (process.env.OBITER ? +process.env.OBITER : 6000); i++){
      const s = await page.evaluate((i) => {
        const o = {};
        const done = document.getElementById('chapter-done');
        if (done && done.classList.contains('show')){
          o.cardText = done.textContent;
          const cch = shChapter(); if (cch && !Campaign.finished){ const k = cch.objectives.find(x => x.kind === 'kill'); o.ch = cch.id; o.kills = Campaign.progress[k.id] || 0; }
          if (Campaign.finished){ const last = CAMPAIGN[CAMPAIGN.length - 1]; o.ch = last.id; o.kills = Campaign.progress['c5-kill'] || 0; }
          document.getElementById('chapter-next').click(); o.card = true; return o;
        }
        if (Dialogue.active){
          o.line = Dialogue.line && Dialogue.line.text;
          if (Dialogue.queue.length){ o.line = [o.line].concat(Dialogue.queue.map(l => l.text)).join(' | '); }
          Dialogue.queue.length = 0; Dialogue.chars = 1e9; shEndDialogue(); o.d = true; return o;
        }
        if (typeof Narr !== 'undefined' && Narr.active){ shNarrPush(); shNarrPush(); o.d = true; return o; }
        if (!Campaign.active) return o;
        const ch = shChapter(); o.ch = ch.id; o.remaining = Outbreak.remaining();
        const hud = document.getElementById('ob-hud'); o.hud = hud && hud.classList.contains('on') && hud.textContent.includes('THE TURNED');
        const ned = document.getElementById('ob-ned'); o.quip = ned && ned.classList.contains('on') ? ned.textContent : '';
        const reach = ch.objectives.find(x => x.kind === 'reach');
        const kill = ch.objectives.find(x => x.kind === 'kill');
        o.kills = Campaign.progress[kill.id] || 0;
        Player.hp = Player.hpMax;
        if (!Campaign.done[reach.id]){
          const s2 = shFindOpenSpot(reach.x, reach.z, 0.4, 1.8, 14);
          if (s2) Player.position.set(s2.x, s2.y + Player.height, s2.z);
          o.walk = true; return o;
        }
        const st = Outbreak.st; if (!st) return o;
        o.why = st.why; o.progress = st.progress; o.alive = Outbreak.alive.size; o.spawned = st.spawned;
        const task=window.FCPolish&&FCPolish.activeTask();
        if(task&&task.point){
          if(i%3===0)for(const e of [...Outbreak.alive])if(e.position.distanceTo(Player.position)<7)e.takeDamage(9999,false);
          Player.position.set(task.point.x,task.point.y+Player.height,task.point.z);Player.velocity.set(0,0,0);
          if(!FCPolish.holding&&!FCPolish.modal)document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',key:'e',bubbles:true}));
          if(FCPolish.modal)document.querySelector('[data-choice="'+task.correct+'"]').click();
          o.field=task.name;return o;
        }
        //  Stand a few metres from the station, the way a player would.
        const spot = shFindOpenSpot(st.x + 3, st.z + 3, 0.4, 1.8, 14);
        if (spot && Math.hypot(Player.position.x - spot.x, Player.position.z - spot.z) > 2) Player.position.set(spot.x, spot.y + Player.height, spot.z);
        const near = [...Outbreak.alive].filter(e => e.hp > 0).sort((a, b) =>
          Math.hypot(a.position.x - Player.position.x, a.position.z - Player.position.z) - Math.hypot(b.position.x - Player.position.x, b.position.z - Player.position.z))[0];
        if (near){
          //  Let them arrive at the station sometimes, so the pause shows.
          if (i % 9 === 0){ near.position.set(st.x + 1, near.position.y, st.z + 1); near.group.position.copy(near.position); }
          else if (ch.id === 'ob-clock' && o.kills < 3){
            Player.position.set(near.position.x + 1.3, near.position.y + Player.height, near.position.z);
            const dx = near.position.x - Player.position.x, dz = near.position.z - Player.position.z;
            Player.yaw = Math.atan2(-dx, -dz); Player.pitch = -0.25;
            State.camera.position.copy(Player.position); State.camera.rotation.set(Player.pitch, Player.yaw, 0, 'YXZ');
            Player.attackCooldown = 0; tryAttack(); o.swung = true;
          } else if (i % 3 === 0) near.takeDamage(9999, false);
        }
        return o;
      }, i);
      if (s.card){ seen.cards++; if (s.cardText && s.cardText.includes('night is over')) seen.ending = s.cardText; }
      if (s.line) seen.lines.push(s.line);
      if (s.ch && seen.chapters.at(-1) !== s.ch) seen.chapters.push(s.ch);
      if (s.ch) seen.kills[s.ch] = Math.max(seen.kills[s.ch] || 0, s.kills);
      if (s.remaining != null && seen.counts.at(-1) !== s.remaining) seen.counts.push(s.remaining);
      if (s.hud) seen.hud = true;
      if (s.why && s.why.includes('Turned at the station')) seen.pausedNear = true;
      if (s.swung && s.kills > 0) seen.realKill = true;
      if (s.quip && s.quip !== lastQuip){ seen.quips++; lastQuip = s.quip; }
      if (s.ch === 'ob-voice' && s.kills === 6 && !seen.reload){
        //  A reload mid-defence: alive Turned are gone, the station rebuilds.
        seen.reload = await page.evaluate(() => {
          const before = { kills: Campaign.progress['c2-kill'], remaining: Outbreak.remaining() };
          for (const e of [...Outbreak.alive]){
            if (e.group.parent) e.group.parent.remove(e.group);
            const k = State.enemies.indexOf(e); if (k >= 0) State.enemies.splice(k, 1);
          }
          Outbreak.alive.clear(); Outbreak.chapterId = null;
          return before;
        });
        //  Frames are slow headless; wait for the rebuild to settle.
        let after = null;
        for (let k = 0; k < 40; k++){
          await page.waitForTimeout(500);
          after = await page.evaluate(() => ({ spawned: Outbreak.st && Outbreak.st.spawned, alive: Outbreak.alive.size, remaining: Outbreak.remaining(),
            kills: Campaign.progress['c2-kill'], rebuilt: Outbreak.chapterId === 'ob-voice' }));
          if (after.rebuilt && after.alive > 0) break;
        }
        seen.reload.after = after;
      }
      if (s.ch === 'ob-memory' && seen.ambientCounted === null){
        seen.ambientCounted = await page.evaluate(() => {
          const before = Outbreak.remaining();
          const e = new Enemy('stalker', Player.position.x + 30, Player.position.z, new RNG('ambient'));
          State.scene.add(e.group); State.enemies.push(e);
          return { before, e: true };
        });
        for (let k = 0; k < 40; k++){ await page.waitForTimeout(500); if (await page.evaluate(() => !State.enemies.some(e => e.type === 'stalker' && !e.obStory))) break; }
        Object.assign(seen.ambientCounted, await page.evaluate(() => ({
          after: Outbreak.remaining(), purged: !State.enemies.some(e => e.type === 'stalker' && !e.obStory) })));
      }
      if (s.ch === 'ob-form' && !s.field && !seen.awayChecked){
        const away = await page.evaluate(() => {
          if (!Outbreak.st || Outbreak.st.progress >= 1 || !Campaign.done['c4-reach']) return null;
          for (const e of [...Outbreak.alive]) e.takeDamage(9999, false);
          Player.position.set(Outbreak.st.x + 40, Player.position.y, Outbreak.st.z + 40);
          return true;
        });
        if (away){
          seen.awayChecked = true;
          let why = '';
          for (let k = 0; k < 40 && !why.includes('will not work alone'); k++){
            await page.waitForTimeout(500);
            why = await page.evaluate(() => Outbreak.st.why + ' @' + Math.round(Math.hypot(Player.position.x - Outbreak.st.x, Player.position.z - Outbreak.st.z)));
          }
          seen.pausedAway = why.includes('will not work alone');
          seen.awayWhy = why;
          await page.evaluate(() => { Outbreak.chapters[3].station.secs = 6; });
          await shot('station-away');
        }
      }
      if (s.ch === 'ob-clock' && s.kills >= 4 && !seen.shot){
        seen.shot = true;
        for (let k = 0; k < 40 && !seen.pausedNear; k++){
          const why = await page.evaluate(() => {
            const st = Outbreak.st, e = [...Outbreak.alive].find(z => z.hp > 0);
            if (!st || !e || st.progress >= 1) return 'none';
            e.position.set(st.x + 1, e.position.y, st.z + 1); e.group.position.copy(e.position); e.attackTimer = 99;
            return st.why;
          });
          if (why === 'none') break;
          if (why.includes('Turned at the station')) seen.pausedNear = true;
          else await page.waitForTimeout(400);
        }
        await shot('station-defence');
      }
      if (process.env.OBDEBUG && i % 60 === 0) console.log(i, JSON.stringify(s));
      if (seen.ending) break;
      await page.waitForTimeout(s.card || s.d ? 140 : 70);
    }
    await shot('ending');
    const end = await page.evaluate(() => ({ finished: Campaign.finished, remaining: Outbreak.remaining(), note: (shCampaignMenuNote(), document.getElementById('campaign-menu-note') || {}).textContent }));
    c.eq('all five chapters played in order', seen.chapters.join(','), 'ob-clock,ob-voice,ob-memory,ob-form,ob-six');
    c.ok('exactly twenty Turned per chapter', Object.values(seen.kills).every(k => k === 20), JSON.stringify(seen.kills));
    c.ok('the counter only goes down', seen.counts.every((n, i) => i === 0 || n < seen.counts[i - 1]), seen.counts.slice(0, 8).join(',') + '…');
    c.eq('the counter starts at one hundred', seen.counts[0], 100);
    c.eq('the counter reaches zero', end.remaining, 0);
    c.ok('a real swing counts a kill', seen.realKill);
    c.ok('Turned HUD shows during the campaign', seen.hud);
    c.ok('the repair pauses with the Turned at the station', seen.pausedNear);
    c.ok('the repair pauses when you walk away', seen.pausedAway, seen.awayWhy);
    c.gt('Ned comments during the defence', seen.quips, 2);
    c.ok('the ending screen shows', !!seen.ending && seen.ending.includes('Six O’Clock'), (seen.ending || '').slice(0, 80));
    c.ok('the campaign is finished', end.finished);
    c.ok('a reload respawns only what is left', seen.reload && seen.reload.after.spawned - seen.reload.after.kills === seen.reload.after.alive && seen.reload.after.spawned <= 20 && seen.reload.after.remaining === seen.reload.remaining, JSON.stringify(seen.reload));
    c.ok('ambient infected are not counted and are cleared', seen.ambientCounted && seen.ambientCounted.before === seen.ambientCounted.after && seen.ambientCounted.purged, JSON.stringify(seen.ambientCounted));
    const all = seen.lines.join(' ');
    const obText = await page.evaluate(() => JSON.stringify(Outbreak.chapters));
    c.ok('no quarry anywhere in the story', !all.toLowerCase().includes('quarry'));
    c.ok('no em dashes in the story', !all.includes('—'));
    c.ok('Ned keeps the best jokes', ['The Bureau has asked for a form', 'paperwork is appalling', 'difference, and you signed it'].every(j => all.includes(j) || obText.includes(j)));

    // ── An old save is moved onto the new story ───────────────────────────
    const mig = await page.evaluate(async () => {
      const nx = document.getElementById('chapter-next'); if (nx && document.getElementById('chapter-done').classList.contains('show')) nx.click();
      Campaign.active = true; Campaign.finished = false; Campaign.chapter = 9; Campaign.done = { 'closed:quarry': true }; Campaign.progress = {};
      for (let k = 0; k < 60 && !Campaign.done['story:outbreak']; k++) await new Promise(r => setTimeout(r, 500));
      return { chapter: Campaign.chapter, flag: !!Campaign.done['story:outbreak'], id: shChapter() && shChapter().id };
    });
    c.ok('an old campaign save restarts at Chapter One', mig.chapter === 0 && mig.flag && mig.id === 'ob-clock', JSON.stringify(mig));
    await page.evaluate(() => { while (Dialogue.active){ Dialogue.queue.length = 0; shEndDialogue(); } shCampaignStop(); });

    c.ok('no page errors', w.pageErrors.length === 0, w.pageErrors.slice(0, 3).join(' | '));
    const bad = w.consoleErrors ? w.consoleErrors.filter(e => !/net::|Failed to load resource|feeds?|mastodon|algolia|firebaseio|bsky|wikipedia/i.test(e)) : [];
    c.ok('no unexpected console errors', bad.length === 0, bad.slice(0, 2).join(' | '));
  } catch (e){
    c.ok('outbreak run completed', false, e.stack || e.message);
  }
  await browser.close();
  site.close();
  process.exit(c.report() ? 1 : 0);
})();
