// A/B the HD pass: same seed, same camera, four frames.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');
const PORT = 8732;
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.png':'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => {
    if (err){ res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/apps/fracture-city-game/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(2200);

  await page.evaluate(() => {
    window.HD.locked = true;
    window.HD.tier = 'ultra';
    newGame('hd-compare');
  });
  await page.waitForTimeout(3000);

  // Park the camera somewhere with a street in front of it and hold it there.
  const place = await page.evaluate(() => {
    Player.position.set(6, 3.2, 6);
    Player.yaw = 0.9; Player.pitch = -0.05;
    for (let i = 0; i < 12; i++) updateChunks();
    State.camera.position.copy(Player.position);
    State.camera.rotation.y = Player.yaw;
    State.camera.rotation.x = Player.pitch;
    return { chunks: State.chunkMap.size };
  });

  async function shot(name, hour, cfg){
    await page.evaluate(([hour, cfg]) => {
      State.dayTime = hour * 60;
      Object.assign(window.HD.want, cfg);
      if (cfg.tier) window.HD.tier = cfg.tier;
      window.HD.apply(true);
      shApplyLighting(hour);
      State.renderer.render(State.scene, State.camera);
    }, [hour, cfg]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(__dirname, 'out', `cmp-${name}.png`) });
  }

  await shot('night-off', 21, { surfaces:false, bloom:false, shadows:false });
  await shot('night-on',  21, { surfaces:true,  bloom:true,  shadows:true });
  await shot('noon-off',  12, { surfaces:false, bloom:false, shadows:false });
  await shot('noon-on',   12, { surfaces:true,  bloom:true,  shadows:true });

  console.log('place:', JSON.stringify(place));
  console.log('errors:', errs.slice(0, 10));
  await browser.close();
  server.close();
})();
