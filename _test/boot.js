//  Boot the real game file in a real browser, drive it, and ASSERT.
//
//  Exit code is a function of the checks below and nothing else. Every value it
//  prints, it also tests. Run `node selftest.js` to watch it fail on three
//  deliberately broken builds; a harness that has never failed is a decoration.
//
//    node boot.js [repoRoot]

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { Checks, watch, serve, LAUNCH_ARGS } = require('./lib/harness');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const c = new Checks('boot.js — ' + ROOT);
  const site = await serve(ROOT);
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const w = watch(page, site.origin);

  let sim = {}, start = {}, gl = 'none';
  try {
    const resp = await page.goto(site.origin + '/apps/fracture-city-game/index.html', { waitUntil: 'load' });
    c.ok('page served', resp && resp.status() === 200, resp ? resp.status() : 'no response');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, 'shot-menu.png') });

    gl = await page.evaluate(() => {
      try {
        const cv = document.createElement('canvas');
        return cv.getContext('webgl2') ? 'webgl2' : (cv.getContext('webgl') ? 'webgl1' : 'none');
      } catch (e){ return 'error: ' + e.message; }
    });

    //  Structured, not a log of strings. The old version pushed 'newGame threw'
    //  into an array that nothing ever read.
    start = await page.evaluate(() => {
      const r = { hasNewGame: typeof window.newGame === 'function', threw: null, hd: null };
      try {
        if (window.HD){ window.HD.locked = true; window.HD.tier = 'ultra'; r.hd = 'ultra'; }
        if (r.hasNewGame) window.newGame('harness-seed');
      } catch (e){ r.threw = e.message + '\n' + e.stack; }
      return r;
    });
    await page.waitForTimeout(3500);

    sim = await page.evaluate(() => {
      const o = { error: null };
      try {
        o.chunks = State.chunkMap.size;
        o.tier = window.HD ? window.HD.tier : null;
        o.surf = window.HD ? window.HD.surfMode : -1;
        o.shadows = !!(State.renderer && State.renderer.shadowMap.enabled);
        const hadBloom = window.HD ? window.HD.want.bloom : false;
        if (window.HD) window.HD.want.bloom = false;
        State.renderer.render(State.scene, State.camera);      // scene pass, not the composite
        o.calls = State.renderer.info.render.calls;
        o.tris = State.renderer.info.render.triangles;
        if (window.HD) window.HD.want.bloom = hadBloom;
        o.progs = State.renderer.info.programs ? State.renderer.info.programs.length : -1;

        for (let i = 0; i < 40; i++){ Player.position.x += 0.6; updateChunks(); }
        o.chunksAfter = State.chunkMap.size;

        let fits = 0, breakers = 0;
        for (const [, ch] of State.chunkMap)
          for (const f of (ch.fittings || [])){ fits++; if (f.id === 34) breakers++; }
        o.fittings = fits; o.breakers = breakers;

        const first = State.chunkMap.values().next().value;
        o.hasPower = !!window.CityPower;
        if (first && window.CityPower){
          const lit = () => [...first.vox].filter(v => v === 4 || v === 8 || v === 25 || v === 26).length;
          o.litBefore = lit();
          o.cutChanged = window.CityPower.set(first.cx, first.cz, false);
          o.litWhenCut = lit();
          o.restoredChanged = window.CityPower.set(first.cx, first.cz, true);
          o.litAfter = lit();
        }
      } catch (e){ o.error = e.message + '\n' + e.stack; }
      return o;
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, 'shot-city.png') });
  } catch (e){
    c.ok('harness ran to completion', false, e.message);
  }

  // ── the checks ────────────────────────────────────────────────────────────
  c.eq('webgl2 context', gl, 'webgl2');
  c.ok('newGame exists', start.hasNewGame, start.hasNewGame ? '' : 'window.newGame missing');
  c.absent('newGame did not throw', start.threw);
  c.absent('simulation did not throw', sim.error);

  c.gt('chunks at boot', sim.chunks, 0);
  c.gt('chunks after walking', sim.chunksAfter, 0);
  c.gt('shader programs compiled', sim.progs, 0);
  c.gt('draw calls (scene pass)', sim.calls, 0);
  c.gt('triangles (scene pass)', sim.tris, 0);
  c.gt('fittings placed', sim.fittings, 0);
  c.gt('breakers placed', sim.breakers, 0);

  c.ok('CityPower exposed', sim.hasPower, sim.hasPower ? '' : 'window.CityPower missing');
  c.gt('supply cut changed blocks', sim.cutChanged, 0);
  c.eq('nothing lit while cut', sim.litWhenCut, 0);
  c.eq('supply restored fully', sim.litAfter, sim.litBefore);
  c.eq('restore touched as many as the cut', sim.restoredChanged, sim.cutChanged);

  c.eq('local requests all 2xx', w.localBad.length, 0);
  c.eq('no unexpected foreign requests', w.foreign.length, 0);
  c.eq('no page errors', w.pageErrors.length, 0);
  c.eq('no unexpected console errors', w.consoleErrors.length, 0);

  for (const b of w.localBad.slice(0, 10))       console.log('  local request failed: ' + b);
  for (const f of w.foreign.slice(0, 10))        console.log('  foreign request: ' + f);
  for (const e of w.pageErrors.slice(0, 10))     console.log('  page error: ' + e.slice(0, 300));
  for (const e of w.consoleErrors.slice(0, 10))  console.log('  console error: ' + e.slice(0, 300));
  if (w.optionalOffline.length)
    console.log(`\n  (${w.optionalOffline.length} optional feed requests could not be reached; not counted)`);

  console.log('\nMEASURED: ' + JSON.stringify({
    tier: sim.tier, surf: sim.surf, shadows: sim.shadows, progs: sim.progs,
    calls: sim.calls, tris: sim.tris, chunks: sim.chunks, chunksAfter: sim.chunksAfter,
    fittings: sim.fittings, breakers: sim.breakers,
    litBefore: sim.litBefore, cutChanged: sim.cutChanged, litWhenCut: sim.litWhenCut, litAfter: sim.litAfter,
  }));

  const failed = c.report();
  await browser.close();
  site.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('harness crashed:', e); process.exit(2); });
