//  Shell persistence, in an isolated data directory.
//
//  NOT YET RUN TO COMPLETION anywhere. Electron needs a display and a
//  platform-matched binary, and the machine that wrote this has neither. Run it
//  once on the Mac and record the result in BASELINE.md before anyone treats a
//  pass as evidence.
//
//  Why it cannot share the browser test: shell/main.js resolves
//    ROOT = path.resolve(__dirname, '..')   and   DATA_DIR = ROOT/data
//  when the app is not packaged, so an unpackaged run always writes to the
//  data/ folder beside its own shell/. The only isolation is a copy of the tree
//  whose data/ is somewhere else, which is what this builds. Copying data/ into
//  a scratch folder and running the real shell would still write to the real one.
//
//    node persist-shell.js [repoRoot]

const path = require('path');
const fs = require('fs');
const os = require('os');
const { Checks } = require('./lib/harness');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');
const KEY = 'harness-shell-probe';
const SLUG = 'fracture-city-game';
//  renderer/app.js line 78: `<div class="card" data-slug="${app.slug}">`
const TILE = `.card[data-slug="${SLUG}"]`;

function copyTree(src, dst, skip = []){
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })){
    if (skip.includes(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyTree(s, d, skip);
    else if (e.isFile()) fs.copyFileSync(s, d);
  }
}

(async () => {
  const c = new Checks('persist-shell.js — the Electron save bridge, isolated');
  const open = [];                       // every app launched, closed in finally
  const elecLog = [];                    // anything Electron printed

  try {
    let _electron;
    try { ({ _electron } = require('playwright')); }
    catch (e){ c.ok('playwright available', false, e.message); return; }

    const elecBin = path.join(ROOT, 'shell', 'node_modules', 'electron', 'dist',
      process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron'
      : process.platform === 'win32' ? 'electron.exe' : 'electron');
    if (!fs.existsSync(elecBin)){
      c.ok('electron binary present', false, elecBin + ' not found; npm install in shell/');
      return;
    }

    //  The isolated tree. node_modules is symlinked; half a gigabyte is not
    //  worth duplicating for one probe.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-shell-'));
    const tree = path.join(tmp, 'tree');
    copyTree(path.join(ROOT, 'shell'), path.join(tree, 'shell'), ['node_modules']);
    //  main.js requires electron, node builtins, and its own ./services. No
    //  third-party package at all, so the isolated tree needs exactly one
    //  entry in node_modules rather than a symlink to half a gigabyte. A
    //  symlinked node_modules was the first suspect for the SIGABRT.
    fs.mkdirSync(path.join(tree, 'shell', 'node_modules'), { recursive: true });
    fs.symlinkSync(path.join(ROOT, 'shell', 'node_modules', 'electron'),
                   path.join(tree, 'shell', 'node_modules', 'electron'), 'dir');
    copyTree(path.join(ROOT, 'apps'), path.join(tree, 'apps'), ['node_modules']);
    copyTree(path.join(ROOT, 'shared'), path.join(tree, 'shared'));
    fs.copyFileSync(path.join(ROOT, 'fracture.json'), path.join(tree, 'fracture.json'));
    fs.mkdirSync(path.join(tree, 'data'), { recursive: true });

    //  Chromium's own profile storage, isolated too. Isolating the app's
    //  saves and leaving the browser profile shared would still let one run
    //  see another's localStorage, service workers and cache.
    const userDataDir = path.join(tmp, 'chromium-profile');
    fs.mkdirSync(userDataDir, { recursive: true });

    const isolatedData = path.resolve(tree, 'data');
    const liveData = path.resolve(ROOT, 'data');
    if (isolatedData === liveData || isolatedData.startsWith(liveData + path.sep)){
      c.ok('data directory is isolated', false, 'refusing to run against the live data folder');
      return;
    }
    c.ok('data directory is isolated', true, isolatedData);

    //  Open the launcher, click the tile, and take the window the click
    //  produces. The listener is registered BEFORE the click, or the window can
    //  open in the gap and the wait times out on an event already delivered.
    //  No catch on the click: a selector that does not match is a real failure
    //  and must not be papered over by falling back to the launcher window,
    //  which would then be probed instead and would report the wrong thing.
    //  Preflight, because a SIGABRT before the first window tells you nothing
    //  about which half failed. This separates "the binary will not start at
    //  all" from "the binary starts and the app fails to load", and prints
    //  what Electron actually said instead of a signal name.
    const { spawnSync } = require('child_process');
    const env = Object.assign({}, process.env, { ELECTRON_ENABLE_LOGGING: '1' });

    const ver = spawnSync(elecBin, ['--version'], { encoding: 'utf8', timeout: 30000, env });
    c.ok('electron binary starts', ver.status === 0,
         ver.status === 0 ? (ver.stdout || '').trim()
                          : `status=${ver.status} signal=${ver.signal} ${(ver.stderr || '').trim().slice(0, 300)}`);
    if (ver.status !== 0) return;

    const dry = spawnSync(elecBin, [path.join(tree, 'shell'), '--user-data-dir=' + userDataDir],
                          { encoding: 'utf8', timeout: 20000, env });
    //  A timeout here means the PROCESS stayed up. It does not mean the app
    //  loaded: a process can sit there having failed to load anything. What
    //  establishes load is the window appearing and answering to the right
    //  appSlug, two checks further down. This one only separates "exits
    //  immediately" from "keeps running".
    const cameUp = dry.error && /ETIMEDOUT|timed out/i.test(String(dry.error.message || dry.error.code));
    c.ok('shell process stayed up', cameUp || dry.status === 0,
         cameUp ? 'stayed up until the timeout killed it'
                : `status=${dry.status} signal=${dry.signal}\n      stdout: ${(dry.stdout || '').trim().slice(0, 400)}\n      stderr: ${(dry.stderr || '').trim().slice(0, 600)}`);
    if (!cameUp && dry.status !== 0) return;

    async function session(){
      const app = await _electron.launch({
        executablePath: elecBin,
        args: [path.join(tree, 'shell'), '--user-data-dir=' + userDataDir],
        env,
      });
      //  Anything Electron prints while we drive it, kept for the report.
      try {
        const proc = app.process();
        if (proc && proc.stderr) proc.stderr.on('data', d => elecLog.push('stderr: ' + String(d).trim()));
        if (proc && proc.stdout) proc.stdout.on('data', d => elecLog.push('stdout: ' + String(d).trim()));
      } catch (e){}
      open.push(app);
      const launcher = await app.firstWindow();
      await launcher.waitForSelector(TILE, { timeout: 30000 });
      const [win] = await Promise.all([
        app.waitForEvent('window', { timeout: 30000 }),
        launcher.click(TILE),
      ]);
      await win.waitForLoadState('domcontentloaded');
      await win.waitForTimeout(2500);
      return { app, win };
    }

    const token = 'shell-probe-' + Date.now();

    let s = await session();
    //  Prove we are probing the game's own window and not some other surface.
    const who = await s.win.evaluate(() => ({
      shell: !!(window.fracture && window.fracture.shell),
      slug: window.fracture && window.fracture.appSlug,
    }));
    c.ok('window is inside the shell', who.shell, String(who.shell));
    c.eq('window belongs to the game', who.slug, SLUG);

    const wrote = await s.win.evaluate(async ([k, v]) => {
      await window.fracture.save(k, { token: v });
      const back = await window.fracture.read(k);
      return back && back.token;
    }, [KEY, token]);
    c.eq('wrote and read back through the bridge', wrote, token);
    await s.app.close();

    //  The write must have landed as a file, in the isolated tree only.
    const expected = path.join(isolatedData, SLUG, KEY + '.json');
    c.ok('write landed in the isolated data dir', fs.existsSync(expected), expected);
    c.ok('live data dir untouched by this test',
         !fs.existsSync(path.join(liveData, SLUG, KEY + '.json')));

    //  And survive a full restart of the shell.
    s = await session();
    const read = await s.win.evaluate(async (k) => {
      const v = await window.fracture.read(k);
      return v && v.token;
    }, KEY);
    c.eq('value survived a shell restart', read, token);

    console.log('\n  isolated tree:     ' + tree);
    console.log('  chromium profile:  ' + userDataDir);
  } catch (e){
    c.ok('ran to completion', false, e.message);
  } finally {
    for (const app of open){
      try { await app.close(); } catch (e){}
    }
    if (elecLog.length){
      console.log('\n  what Electron printed:');
      for (const line of elecLog.slice(0, 20)) console.log('    ' + line.slice(0, 300));
    }
    const failed = c.report();
    process.exit(failed ? 1 : 0);
  }
})();
