//  The wider world: wild biomes, shopping centres, district architecture,
//  street life and crime, and the drone changes.
//
//    node world.test.js [repoRoot]

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { Checks, watch, serve, LAUNCH_ARGS } = require('./lib/harness');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const EXE = process.env.PW_CHROMIUM || undefined;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const c = new Checks('world.test.js — ' + ROOT);
  const site = await serve(ROOT);
  const browser = await chromium.launch(Object.assign({ args: LAUNCH_ARGS }, EXE ? { executablePath: EXE } : {}));
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const w = watch(page, site.origin);
  const shot = n => page.screenshot({ path: path.join(OUT, 'world-' + n + '.png') }).catch(() => {});
  const poll = async (fn, arg, ms = 20000) => { const t = Date.now(); let v; while (Date.now() - t < ms){ v = await page.evaluate(fn, arg); if (v && v.ok) return v; await page.waitForTimeout(400); } return v; };

  try {
    await page.goto(site.origin + '/apps/fracture-city-game/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    c.ok('modules loaded', await page.evaluate(() => !!(window.Wilds && window.Malls && window.Architecture && window.StreetLife)));
    await page.evaluate(() => { if (window.HD){ HD.locked = true; HD.tier = 'perf'; } newGame('world-seed'); closeMenu && closeMenu(); State.hud.credits = 100; grantCredits(0); });
    await page.waitForTimeout(3000);

    // ── Wilds ──────────────────────────────────────────────────────────────
    const layout = await page.evaluate(() => {
      const safe = [], ring = [], kinds = {};
      for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (districtForChunk(x, z).wild) safe.push(x + ',' + z);
      for (let x = -14; x <= 14; x++) for (let z = -14; z <= 14; z++){
        const d = districtForChunk(x, z);
        if (Math.max(Math.abs(x), Math.abs(z)) > Wilds.cityRadius && !d.wild) ring.push(x + ',' + z);
        if (d.wild) kinds[d.biome] = (kinds[d.biome] || 0) + 1;
      }
      return { safe, ring, kinds, nuke: Wilds.debug.find('nuke'), lake: Wilds.debug.find('lake') };
    });
    c.eq('no wilds near the Civic Core', layout.safe.length, 0);
    c.eq('everything past the city limit is wild', layout.ring.length, 0);
    c.ok('nuke fields, lakes and outskirts all exist', layout.kinds.nuke > 0 && layout.kinds.lake > 0 && layout.kinds.scrub > 0, JSON.stringify(layout.kinds));
    const gen = await page.evaluate(({ nuke, lake }) => {
      const count = (ch, ids) => { let n = 0; for (const v of ch.vox) if (ids.includes(v)) n++; return n; };
      const B = Wilds.blocks;
      const n = new Chunk(nuke.cx, nuke.cz, State.citySeed), l = new Chunk(lake.cx, lake.cz, State.citySeed);
      const lakeAll = [];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) lakeAll.push(new Chunk(lake.cx + dx, lake.cz + dz, State.citySeed));
      return { nukeWild: n._wild, ash: count(n, [B.B_ASH]), sludge: lakeAll.reduce((s, ch) => s + count(ch, [B.B_SLUDGE]), 0), windows: count(n, [B_WIN_LIT, B_WIN_DARK]) };
    }, layout);
    c.eq('nuke chunks generate as wild', gen.nukeWild, 'nuke');
    c.gt('nuke ground is scorched', gen.ash, 50);
    c.eq('no office windows in a nuke field', gen.windows, 0);
    c.gt('the lake holds biowaste', gen.sludge, 100);

    //  Radiation, then sludge.
    await page.evaluate(n => { Player.position.set(n.x, 30, n.z); Wilds.rad = 0; Player.hp = Player.hpMax; }, layout.nuke);
    const rad = await poll(() => ({ ok: Wilds.rad > 1.5, rad: Wilds.rad, hud: document.getElementById('wild-hud').textContent, d: districtAtPosition(Player.position.x, Player.position.z).name }), null, 25000);
    c.ok('radiation builds in a nuke field', rad && rad.ok, JSON.stringify(rad));
    c.ok('the radiation meter shows', rad && /RADIATION/.test(rad.hud));
    await shot('nuke');
    const sludgeSpot = await page.evaluate(lake => {
      for (let dx = -20; dx <= 20; dx++) for (let dz = -20; dz <= 20; dz++){
        const x = lake.x + dx, z = lake.z + dz;
        if (getBlock(Math.floor(x), 0, Math.floor(z)) === Wilds.blocks.B_SLUDGE && getBlock(Math.floor(x), 1, Math.floor(z)) === B_AIR) return { x: Math.floor(x) + 0.5, z: Math.floor(z) + 0.5 };
      }
      return null;
    }, layout.lake);
    if (!sludgeSpot){
      await page.evaluate(l => Player.position.set(l.x, 30, l.z), layout.lake);
      await page.waitForTimeout(6000);
    }
    const spot = sludgeSpot || await page.evaluate(lake => {
      for (let dx = -24; dx <= 24; dx++) for (let dz = -24; dz <= 24; dz++){
        const x = lake.x + dx, z = lake.z + dz;
        if (getBlock(Math.floor(x), 0, Math.floor(z)) === Wilds.blocks.B_SLUDGE && getBlock(Math.floor(x), 1, Math.floor(z)) === B_AIR) return { x: Math.floor(x) + 0.5, z: Math.floor(z) + 0.5 };
      }
      return null;
    }, layout.lake);
    c.ok('found open biowaste', !!spot);
    if (spot){
      await page.evaluate(s => { Wilds.rad = 0; Wilds.tox = 0; Player.hp = Player.hpMax; window.__hold = setInterval(() => { Player.position.set(s.x, 1 + Player.height, s.z); if (Player.velocity) Player.velocity.set(0, 0, 0); }, 30); }, spot);
      const tox = await poll(() => ({ ok: Wilds.tox > 20 && Player.hp < Player.hpMax, tox: Wilds.tox, hp: Player.hp }), null, 25000);
      c.ok('standing in biowaste burns', tox && tox.ok, JSON.stringify(tox));
      await shot('lake');
      await page.evaluate(() => clearInterval(window.__hold));
    }
    const loot = await page.evaluate(() => FN.pickups.filter(p => p.id.startsWith('wild:')).length);
    c.gt('the wilds hold weapons', loot, 0);

    // ── Malls ──────────────────────────────────────────────────────────────
    const mall = await page.evaluate(() => { const m = Malls.debug.find(); return m && { name: m.name, g: m.geom, units: m.units, ax: m.ax, az: m.az }; });
    c.ok('a shopping centre exists', !!mall, mall && mall.name);
    if (mall){
      c.gt('it has shops', mall.units, 20);
      const g = mall.g;
      await page.evaluate(g => { Player.position.set(g.B0x + 21, 4, g.B0z - 5); if (Player.velocity) Player.velocity.set(0, 0, 0); }, g);
      const pop = await poll(() => ({ ok: State.globalNPCs.some(n => n._mall), people: State.globalNPCs.filter(n => n._mall).length }), null, 40000);
      c.ok('keepers, shoppers and a guard arrive', pop && pop.ok, JSON.stringify(pop));
      const inside = await page.evaluate(g => {
        const open = getBlock(g.B0x + 21, 3, g.B0z) === B_AIR && getBlock(g.B0x + 21, 4, g.B0z) === B_AIR;
        const climb = (x, y, z, dz, n) => { const e = { position: new THREE.Vector3(x, y, z) }; for (let i = 0; i < n; i++) shGroundMove(e, 0, dz, 0.3, 1.7); return e.position.y; };
        const up1 = climb(g.A0x + 2.5, 2, g.A0z + 0.5, 0.25, 80), up2 = climb(g.A1x - 2.5, 8, g.A1z + 2.5, -0.25, 90);
        const floors = State.globalNPCs.filter(n => n._mall).every(n => [2, 8, 14].some(f => Math.abs(n.position.y - f) < 1.2));
        return { open, up1, up2, floors };
      }, g);
      c.ok('the entrance is open', inside.open);
      c.eq('stairs reach the first floor', inside.up1, 8);
      c.ok('stairs reach the second floor', inside.up2 >= 14, inside.up2);
      c.ok('mall people stay on their floors', inside.floors);
      await page.evaluate(g => { Player.position.set(g.A0x + 9, 2 + Player.height, g.A0z + 3); Player.yaw = Math.PI; Player.pitch = 0.3; }, g);
      const named = await poll(() => ({ ok: /FLOOR/.test(document.getElementById('hud-district').textContent), t: document.getElementById('hud-district').textContent }), null, 15000);
      c.ok('the HUD names the mall and floor', named && named.ok, named && named.t);
      await shot('mall');
    }

    // ── Architecture ──────────────────────────────────────────────────────
    const arch = await page.evaluate(() => Architecture.counts);
    c.gt('several building styles in use', Object.keys(arch).length, 4);

    // ── Street life ────────────────────────────────────────────────────────
    await page.evaluate(() => { Player.position.set(8, 3.8, 6); if (Player.velocity) Player.velocity.set(0, 0, 0); });
    const crowd = await poll(() => ({ ok: State.globalNPCs.filter(n => !n._mall && Math.hypot(n.position.x - Player.position.x, n.position.z - Player.position.z) < 45).length >= 6,
      n: State.globalNPCs.filter(n => !n._mall && Math.hypot(n.position.x - Player.position.x, n.position.z - Player.position.z) < 45).length }), null, 60000);
    c.ok('the street fills with people', crowd && crowd.ok, JSON.stringify(crowd));
    const acts = await poll(() => ({ ok: StreetLife.stats.acts >= 3, acts: StreetLife.stats.acts }), null, 60000);
    c.ok('people do things', acts && acts.ok, JSON.stringify(acts));
    const solved = [];
    for (const kind of ['snatch', 'mug', 'car', 'tag', 'pick']){
      const started = await page.evaluate(k => { StreetLife.debug.end(); for (let i = 0; i < 4; i++) if (StreetLife.debug.startCrime(k)) return true; return false; }, kind);
      if (!started) continue;
      const before = await page.evaluate(() => StreetLife.stats.solved);
      for (let i = 0; i < 6; i++){
        await page.evaluate(() => {
          const C = StreetLife.crime; if (!C) return;
          if (C.kind === 'mug') C.thug.takeDamage(999, false);
          else if (C.kind === 'pickpocket' && C.phase === 'approach') C.thief.position.set(Player.position.x + 0.5, C.thief.position.y, Player.position.z);
          else if (C.thief && C.thief.char) FN.hurt({ char: C.thief.char, kind: 'street', owner: C.thief, pos: C.thief.position }, 39, false, Player.position.x, Player.position.z);
        });
        await page.waitForTimeout(1500);
        if (await page.evaluate(b => StreetLife.stats.solved > b, before)) { solved.push(kind); break; }
      }
    }
    c.gt('crimes can be stopped', solved.length, 2, solved.join(','));
    c.eq('stopping culprits draws no Bureau Attention', await page.evaluate(() => Math.round(FN.heat * 10) / 10), 0);

    // ── Drones ─────────────────────────────────────────────────────────────
    const def = await page.evaluate(() => ENEMY_TYPES.drone);
    c.ok('drones hit softer and slower', def.dmg <= 4 && def.attackCooldown >= 1.5, JSON.stringify({ dmg: def.dmg, cd: def.attackCooldown }));
    const dodge = await page.evaluate(async () => {
      const s = shFindOpenSpot(Player.position.x, Player.position.z, 0.4, 1.8, 14); Player.position.set(s.x, s.y + Player.height, s.z);
      const e = new Enemy('drone', s.x + 6, s.z, new RNG('dodge')); State.scene.add(e.group); State.enemies.push(e);
      e.sees = true; e.doAttack();
      const aimed = !!e._aim && e._charge > 0;
      Player.hp = Player.hpMax; Player.position.x += 4;
      const t = Date.now(); while (e._charge > 0 && Date.now() - t < 15000) await new Promise(r => setTimeout(r, 100));
      const missed = Player.hp === Player.hpMax;
      e.hp = 0; e.state = 'dead';
      return { aimed, missed, beam: !!e._beam, halo: !!e._halo };
    });
    c.ok('drones aim with a visible line first', dodge.aimed && dodge.beam && dodge.halo, JSON.stringify(dodge));
    c.ok('stepping aside makes them miss', dodge.missed);
    const story = await page.evaluate(async () => {
      Campaign.active = true; Campaign.finished = false;
      const e = new Enemy('drone', Player.position.x + 10, Player.position.z, new RNG('story')); State.scene.add(e.group); State.enemies.push(e);
      const t = Date.now(); while (State.enemies.includes(e) && Date.now() - t < 15000) await new Promise(r => setTimeout(r, 200));
      const gone = !State.enemies.includes(e);
      Campaign.active = false;
      return { gone, picked: window.shPickEnemyType ? (() => { Campaign.active = true; const r = [0.3, 0.4, 0.44].map(x => shPickEnemyType(x)); Campaign.active = false; return r; })() : [] };
    });
    c.ok('no drones during the story', story.gone && !story.picked.includes('drone'), JSON.stringify(story));

    c.ok('no page errors', w.pageErrors.length === 0, w.pageErrors.slice(0, 3).join(' | '));
    const bad = (w.consoleErrors || []).filter(e => !/net::|Failed to load resource|feeds?|mastodon|algolia|firebaseio|bsky|wikipedia/i.test(e));
    c.ok('no unexpected console errors', bad.length === 0, bad.slice(0, 2).join(' | '));
  } catch (e){
    c.ok('world run completed', false, e.stack || e.message);
  }
  await browser.close();
  site.close();
  process.exit(c.report() ? 1 : 0);
})();
