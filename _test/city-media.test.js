//  Your media in the city: Palm Radio, art on billboards and the skyline,
//  clips on the nearest boards. Runs twice, once as the web beta (files picked
//  in the Studio panel) and once inside a stand-in for the Present Palm shell
//  (folders listed by window.fracture.media).
//
//    node city-media.test.js [repoRoot]
//  Needs ffmpeg on PATH to make its test files.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { Checks, watch, serve, LAUNCH_ARGS } = require('./lib/harness');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const FIX = path.join(OUT, 'media-fixtures');
const EXE = process.env.PW_CHROMIUM || undefined;

function fixtures(){
  fs.mkdirSync(FIX, { recursive: true });
  const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
  if (!fs.existsSync(path.join(FIX, 'tone.wav'))) ff(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=8', path.join(FIX, 'tone.wav')]);
  if (!fs.existsSync(path.join(FIX, 'art.png'))) ff(['-f', 'lavfi', '-i', 'testsrc=size=640x360', '-frames:v', '1', path.join(FIX, 'art.png')]);
  if (!fs.existsSync(path.join(FIX, 'clip.mp4'))) ff(['-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=24', '-t', '2', '-pix_fmt', 'yuv420p', path.join(FIX, 'clip.mp4')]);
}

async function boot(page, site){
  await page.goto(site.origin + '/apps/fracture-city-game/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { if (window.HD){ HD.locked = true; HD.tier = 'low'; } newGame('media-seed'); closeMenu && closeMenu(); });
  await page.waitForTimeout(2500);
}

//  Make sure there is a holo billboard within video range of the player.
const NEAR_BOARD = () => {
  if (!State.holoAds.length){
    const g = new THREE.Group(); State.scene.add(g);
    const m = makeBoxMesh(6, 3, 0.25, makeNeonMat(0xff60d0)); g.add(m);
    State.holoAds.push({ mesh: m, light: null, phase: 0 });
  }
  const ad = State.holoAds[0];
  const p = new THREE.Vector3(); ad.mesh.getWorldPosition(p);
  Player.position.set(p.x + 10, Player.position.y, p.z + 10);
  return State.holoAds.length;
};

(async () => {
  const c = new Checks('city-media.test.js - ' + ROOT);
  try { fixtures(); } catch (e) { c.ok('ffmpeg available for fixtures', false, e.message); process.exit(c.report() ? 1 : 0); }
  const site = await serve(ROOT);
  const browser = await chromium.launch(Object.assign({ args: LAUNCH_ARGS.concat(['--autoplay-policy=no-user-gesture-required']) }, EXE ? { executablePath: EXE } : {}));

  // ── The web beta: files picked in the panel ───────────────────────────────
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const w = watch(page, site.origin);
    await boot(page, site);
    c.ok('module loaded (web)', await page.evaluate(() => !!window.PalmMedia && !PalmMedia.inShell));
    await page.evaluate(() => PalmMedia.open());
    c.ok('Studio panel opens', await page.evaluate(() => document.getElementById('pm-panel').classList.contains('on')));
    await page.setInputFiles('input[data-add=music]', path.join(FIX, 'tone.wav'));
    await page.setInputFiles('input[data-add=images]', path.join(FIX, 'art.png'));
    await page.setInputFiles('input[data-add=videos]', path.join(FIX, 'clip.mp4'));
    const counts = await page.evaluate(() => [PalmMedia.music.length, PalmMedia.images.length, PalmMedia.videos.length]);
    c.eq('picked files listed', counts.join(','), '1,1,1');
    await page.screenshot({ path: path.join(OUT, 'media-panel.png') });
    await page.evaluate(() => PalmMedia.close());
    await page.evaluate(() => PalmMedia.play());
    await page.waitForTimeout(1500);
    const radio = await page.evaluate(() => ({ paused: PalmMedia.audio.paused, t: PalmMedia.audio.currentTime }));
    c.ok('Palm Radio plays', !radio.paused && radio.t > 0, JSON.stringify(radio));
    c.ok('now-playing card shows', await page.evaluate(() => document.getElementById('pm-now').textContent.includes('tone')));
    await page.evaluate(() => PalmMedia.play());
    c.ok('U pauses', await page.evaluate(() => PalmMedia.audio.paused));

    await page.evaluate(NEAR_BOARD);
    await page.waitForFunction(() => PalmMedia.ads.some(r => Array.isArray(r.ad.mesh.material)), null, { timeout: 30000 });
    const art = await page.evaluate(() => {
      const r = PalmMedia.ads[0], mats = r.ad.mesh.material;
      return { ads: PalmMedia.ads.length, face: !!(mats[4] && mats[4].map), stillCycling: State.holoAds.includes(r.ad), sky: PalmMedia.sky.length };
    });
    c.ok('art is on a billboard face', art.face, JSON.stringify(art));
    c.ok('art boards leave the colour cycle', !art.stillCycling);
    c.gt('skyline carries art', art.sky, 0);
    await page.waitForFunction(() => PalmMedia.playingVideos > 0, null, { timeout: 20000 }).catch(() => {});
    c.gt('nearest board plays a clip', await page.evaluate(() => PalmMedia.playingVideos), 0);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, 'media-city.png') });

    await page.evaluate(() => { PalmMedia.open(); document.querySelector('#pm-panel [data-act=art]').click(); });
    const off = await page.evaluate(() => ({ ads: PalmMedia.ads.length, sky: PalmMedia.sky.length, videos: PalmMedia.playingVideos,
      restored: State.holoAds.every(a => !Array.isArray(a.mesh.material)) }));
    c.ok('turning art off restores the boards', off.ads === 0 && off.sky === 0 && off.videos === 0 && off.restored, JSON.stringify(off));
    await page.keyboard.press('Escape');
    c.ok('Escape closes the panel, not the game', await page.evaluate(() => !PalmMedia.panelOpen && !document.getElementById('menu-overlay').classList.contains('show')));
    c.ok('no page errors (web)', w.pageErrors.length === 0, w.pageErrors.slice(0, 2).join(' | '));
    await page.close();
  } catch (e) { c.ok('web run completed', false, e.message); }

  // ── Inside the shell: folders listed by window.fracture.media ─────────────
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const w = watch(page, site.origin);
    const base = site.origin + '/_test/out/media-fixtures/';
    await page.addInitScript((base) => {
      const store = {};
      const items = {
        music: [{ kind: 'music', folder: 0, name: 'tone.wav', title: 'Tone', album: 'Fixtures', source: 'folder', url: base + 'tone.wav', mtime: 1 }],
        images: [{ kind: 'images', folder: 1, name: 'art.png', title: 'A test card', album: null, source: 'image-studio', url: base + 'art.png', mtime: 1 }],
        videos: [{ kind: 'videos', folder: 1, name: 'clip.mp4', title: 'Clip', album: null, source: 'video-studio', url: base + 'clip.mp4', mtime: 1 }],
      };
      window.__opened = [];
      const api = {
        shell: true, appSlug: 'fracture-city-game', received: null,
        save: async (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); return true; },
        read: async (k) => store[k] ?? null, list: async () => Object.keys(store), delete: async (k) => { delete store[k]; return true; },
        media: { list: async (kind) => ({ kind, items: items[kind] || [] }), openFolder: async (kind) => { window.__opened.push(kind); return true; } },
        openApp: async (slug) => { window.__opened.push(slug); return { ok: true }; },
      };
      //  Anything else the game asks the shell for answers "nothing", the way an
      //  older shell would.
      window.fracture = new Proxy(api, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' ? async () => null : undefined)) });
    }, base);
    await boot(page, site);
    await page.waitForTimeout(800);
    const s = await page.evaluate(() => ({ inShell: PalmMedia.inShell, n: [PalmMedia.music.length, PalmMedia.images.length, PalmMedia.videos.length].join(',') }));
    c.ok('module uses the shell folders', s.inShell, JSON.stringify(s));
    c.eq('shell folders listed', s.n, '1,1,1');
    await page.evaluate(() => PalmMedia.open());
    await page.click('#pm-panel [data-folder=music]');
    await page.click('#pm-panel [data-app=palm-image-studio]');
    c.eq('folder and studio buttons reach the shell', await page.evaluate(() => window.__opened.join(',')), 'music,palm-image-studio');
    await page.evaluate(() => { document.querySelector('#pm-panel [data-act=shuffle]').click(); PalmMedia.close(); });
    c.ok('preferences saved through the shell', await page.evaluate(async () => (await window.fracture.read('media-prefs')).shuffle === false));
    await page.evaluate(() => PalmMedia.play());
    await page.waitForTimeout(1200);
    c.ok('radio plays from a shell folder', await page.evaluate(() => !PalmMedia.audio.paused));
    await page.evaluate(NEAR_BOARD);
    await page.waitForFunction(() => PalmMedia.ads.some(r => Array.isArray(r.ad.mesh.material)), null, { timeout: 30000 }).catch(() => {});
    c.ok('Image Studio art reaches a billboard', await page.evaluate(() => PalmMedia.ads.some(r => Array.isArray(r.ad.mesh.material))));
    c.ok('no page errors (shell)', w.pageErrors.length === 0, w.pageErrors.slice(0, 2).join(' | '));
    await page.close();
  } catch (e) { c.ok('shell run completed', false, e.message); }

  await browser.close();
  site.close();
  process.exit(c.report() ? 1 : 0);
})();
