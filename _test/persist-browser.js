//  Browser persistence, across a real browser restart.
//
//  Outside the Electron shell every app falls back to a localStorage shim
//  defined at the top of its own file. That is a different storage path from
//  the shell's data/ directory and it has to be tested separately. Copying
//  data/ proves nothing about it, because a browser never reads data/.
//
//  This test uses a persistent browser profile in a temp directory, writes
//  through window.fracture.save, closes the browser completely, reopens with
//  the same profile, and reads back. It never touches data/ and never runs the
//  shell.
//
//    node persist-browser.js [repoRoot]

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Checks, serve, LAUNCH_ARGS } = require('./lib/harness');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');
const KEY = 'harness-probe';

(async () => {
  const c = new Checks('persist-browser.js — localStorage across a browser restart');
  const site = await serve(ROOT);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-profile-'));
  const url = site.origin + '/apps/fracture-city-game/index.html';
  const token = 'probe-' + Date.now();

  async function open(){
    const ctx = await chromium.launchPersistentContext(profile, { args: LAUNCH_ARGS, viewport: { width: 900, height: 600 } });
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    return { ctx, page };
  }

  //  Session one: write.
  let s = await open();
  const wrote = await s.page.evaluate(async ([k, v]) => {
    if (!window.fracture || typeof window.fracture.save !== 'function') return { ok: false, why: 'no fracture.save' };
    if (window.fracture.shell) return { ok: false, why: 'running inside the shell; wrong test' };
    await window.fracture.save(k, { token: v, at: Date.now() });
    const back = await window.fracture.read(k);
    return { ok: !!(back && back.token === v), why: JSON.stringify(back) };
  }, [KEY, token]);
  c.ok('wrote and read back in session one', wrote.ok, wrote.why);
  await s.ctx.close();

  //  Session two: same profile, new browser process.
  s = await open();
  const read = await s.page.evaluate(async (k) => {
    const v = await window.fracture.read(k);
    return { token: v && v.token, keys: (await window.fracture.list()).length };
  }, KEY);
  c.eq('value survived the restart', read.token, token);
  c.ok('key list is non-empty', read.keys > 0, String(read.keys));

  //  And prove the profile is what carried it: a fresh profile must not see it.
  await s.ctx.close();
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-profile-fresh-'));
  const ctx2 = await chromium.launchPersistentContext(fresh, { args: LAUNCH_ARGS, viewport: { width: 900, height: 600 } });
  const p2 = ctx2.pages()[0] || await ctx2.newPage();
  await p2.goto(url, { waitUntil: 'load' });
  await p2.waitForTimeout(1500);
  const clean = await p2.evaluate(async (k) => await window.fracture.read(k), KEY);
  c.ok('a fresh profile does not see it', clean == null, JSON.stringify(clean));
  await ctx2.close();

  const failed = c.report();
  console.log('\n  profile: ' + profile + '\n  data/ was never opened by this test.');
  site.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('persist-browser crashed:', e); process.exit(2); });
