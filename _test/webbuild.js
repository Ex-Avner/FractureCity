//  The built web deploy, not the source tree.
//
//  Section 64 of the game exists because a change that was correct on the
//  desktop was silently broken on the hosted build, and no test on the desktop
//  tree could have caught it. This runs `_build/build-beta.py`, serves the
//  output the way a deploy would including its `_headers`, and boots it.
//
//  It is the test that catches an extracted module that the build forgot to
//  copy, which is the specific regression the mesher patch can introduce.
//
//    node webbuild.js [repoRoot]

const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Checks, watch, serve, LAUNCH_ARGS } = require('./lib/harness');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');
const DIST = path.join(ROOT, '_build', 'webbeta-dist');

(async () => {
  const c = new Checks('webbuild.js — the deployed build');

  try {
    execFileSync('python3', [path.join(ROOT, '_build', 'build-beta.py')], { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
    c.ok('build-beta.py ran', true);
  } catch (e){
    c.ok('build-beta.py ran', false, (e.stderr || e.stdout || e.message || '').toString().slice(-300));
  }

  c.ok('dist exists', fs.existsSync(path.join(DIST, 'index.html')));
  c.ok('_headers written', fs.existsSync(path.join(DIST, '_headers')));

  //  Every local script the page asks for must be in the dist. This is the
  //  check that a sibling module the build does not know about will fail.
  const html = fs.existsSync(path.join(DIST, 'index.html')) ? fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') : '';
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  const missing = srcs.filter(s => !fs.existsSync(path.join(DIST, s)));
  c.eq('every local <script src> is in the dist', missing.length, 0, missing.join(', '));
  if (missing.length) console.log('  missing from dist: ' + missing.join(', '));

  //  One version, three consumers. build-beta.py reads SH_VERSION out of the
  //  game file (line 159), section 62's release gate stamps every heading from
  //  the same constant, and the zip is named from it. fracture.app.json is read
  //  only by the launcher grid, which is why it can drift without anyone
  //  noticing — and did. SH_VERSION is authoritative; this check fails when
  //  anything disagrees with it.
  //  A missing file here is a failed check, not a crashed run. The harness
  //  reporting nothing at all is the failure mode this whole rewrite was for.
  try {
    const gameSrc = fs.readFileSync(path.join(ROOT, 'apps', 'fracture-city-game', 'index.html'), 'utf8');
    const shVersion = (gameSrc.match(/SH_VERSION\s*=\s*'([^']+)'/) || [])[1];
    c.ok('SH_VERSION found', !!shVersion, shVersion || 'not found');
    const mPath = path.join(ROOT, 'apps', 'fracture-city-game', 'fracture.app.json');
    if (!fs.existsSync(mPath)) c.ok('manifest present', false, mPath);
    else {
      const manifest = JSON.parse(fs.readFileSync(mPath, 'utf8'));
      c.eq('manifest version matches SH_VERSION', manifest.version, shVersion);
    }
    const zip = path.join(ROOT, '_build', `fracture-city-beta-v${shVersion}.zip`);
    c.ok('zip is named for SH_VERSION', fs.existsSync(zip), path.basename(zip));
  } catch (e){
    c.ok('version consistency checked', false, e.message);
  }

  const site = await serve(DIST, { headersFile: path.join(DIST, '_headers') });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const w = watch(page, site.origin);

  const resp = await page.goto(site.origin + '/index.html', { waitUntil: 'load' });
  c.ok('deployed page served', resp && resp.status() === 200, resp ? resp.status() : 'none');

  //  The CSP the deploy actually sends, exercised by a real browser rather than
  //  read out of a file.
  const csp = resp ? (resp.headers()['content-security-policy'] || '') : '';
  c.ok('CSP header present', !!csp, csp.slice(0, 90) + (csp.length > 90 ? '…' : ''));
  c.ok("CSP has default-src 'self'", /default-src[^;]*'self'/.test(csp));
  c.ok('CSP forbids object embeds', /object-src[^;]*'none'/.test(csp));
  c.ok('CSP restricts framing', /frame-ancestors/.test(csp));

  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => ({
    standalone: window.FC_STANDALONE === true,
    hasMesher: typeof window.FCMesh === 'object' && typeof (window.FCMesh || {}).greedy === 'function',
    hasGame: typeof window.newGame === 'function',
    hasPower: !!window.CityPower,
  }));
  c.ok('build marked standalone', state.standalone, String(state.standalone));
  c.ok('game code present', state.hasGame);
  c.ok('power system present', state.hasPower);

  c.eq('no local request failures in the deploy', w.localBad.length, 0);
  c.eq('no page errors in the deploy', w.pageErrors.length, 0);
  for (const b of w.localBad.slice(0, 10)) console.log('  local request failed: ' + b);
  for (const e of w.pageErrors.slice(0, 5)) console.log('  page error: ' + e.slice(0, 200));

  console.log('\n  mesher module present in deploy: ' + state.hasMesher);

  const failed = c.report();
  await browser.close();
  site.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('webbuild crashed:', e); process.exit(2); });
