// =============================================================================
//  Present Palm — Shell Main Process (hub identity; world stays "Fracture City")
//  Boots the launcher window, scans the apps registry, and brokers IPC
//  between renderer (launcher UI), installed apps (running in BrowserWindows),
//  and the on-disk data directory.
// =============================================================================

const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const Registry = require('./services/registry');
const { createPerson } = require('./services/person');
const { createNewswire } = require('./services/newswire');
const { createFeeds } = require('./services/feeds');
const Launcher = require('./services/launcher');
const Bus = require('./services/bus');

// ── Resolve the ecosystem root ───────────────────────────────────────────────
// In dev: shell/ is inside Fracture City/, root is the parent.
// In packaged build: extraResources lives under process.resourcesPath.
//  A packaged build bundles a COPY of apps/ and shared/, taken by
//  electron-builder at `npm run build` time (see extraResources in
//  package.json). That is correct for distributing the hub and wrong for the
//  machine the apps are AUTHORED on: you edit apps/fracture-city-game and the
//  installed app keeps showing whatever was in the folder the day it was
//  built, with nothing on screen to say so.
//
//  So a packaged build will use a live tree when it is pointed at one:
//
//      PRESENT_PALM_ROOT=/path/to/Fracture\ City   (env, wins)
//      ~/Library/Application Support/Present Palm/root.txt   (a path, one line)
//
//  and falls back to the bundled copy when neither is set — which is what a
//  person who installed the app from a .dmg should get.
let ROOT_SOURCE = 'dev';
function resolveRoot() {
  if (!app.isPackaged) return path.resolve(__dirname, '..');

  const candidates = [];
  if (process.env.PRESENT_PALM_ROOT) candidates.push(process.env.PRESENT_PALM_ROOT.trim());
  try {
    const pointer = path.join(app.getPath('userData'), 'root.txt');
    if (fs.existsSync(pointer)) {
      const p = fs.readFileSync(pointer, 'utf8').trim();
      if (p) candidates.push(p);
    }
  } catch (e) { /* no pointer, no problem */ }

  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, 'apps'))) { ROOT_SOURCE = 'live'; return c; }
    } catch (e) {}
  }
  ROOT_SOURCE = 'bundled';
  return process.resourcesPath;
}
const ROOT = resolveRoot();
const APPS_DIR   = path.join(ROOT, 'apps');
const DATA_DIR   = path.join(ROOT, 'data');
const SHARED_DIR = path.join(ROOT, 'shared');
const IDEAS_DIR  = path.join(ROOT, 'ideas');

// Ensure data dir exists in dev mode (packaged builds get it from extraResources).
for (const d of [DATA_DIR, IDEAS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ── Services ─────────────────────────────────────────────────────────────────
const registry = new Registry({ appsDir: APPS_DIR });
const launcher = new Launcher({ root: ROOT, registry });
const bus = new Bus();

// ── Windows ──────────────────────────────────────────────────────────────────
let launcherWin = null;

function createLauncher() {
  launcherWin = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#080614',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-launcher.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  launcherWin.once('ready-to-show', () => launcherWin.show());
  launcherWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open external links in default browser
  launcherWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  buildMenu();
  registry.scan();
  createLauncher();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLauncher();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Menu ─────────────────────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    // Edit menu — without this, Cmd+C/Cmd+V/Cmd+X/Cmd+A don't fire inside
    // any app launched from the shell. The Visitor's Horde-key paste box
    // and every other input field in every other Fracture City app
    // depend on these accelerators existing at the app menu level.
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Launcher',
          accelerator: 'CmdOrCtrl+L',
          click: () => { if (!launcherWin) createLauncher(); else launcherWin.focus(); }},
        { label: 'Rescan Apps',
          accelerator: 'CmdOrCtrl+R',
          click: () => { registry.scan(); if (launcherWin) launcherWin.webContents.send('registry:updated'); }},
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC handlers ─────────────────────────────────────────────────────────────
//  List another app's data keys. readFrom could already READ one, but nothing
//  could enumerate them — so the game had no way to find the twelve character
//  seeds Character Forge had written. Same guard as readFrom: a slug, and only
//  under DATA_DIR.
ipcMain.handle('data:listFrom', (e, otherSlug) => {
  try {
    if (!/^[a-z0-9-]+$/.test(String(otherSlug || ''))) return [];
    const dir = path.join(DATA_DIR, otherSlug);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.slice(0, -5));
  } catch (e){ return []; }
});

ipcMain.handle('registry:list', () => registry.list());

//  Where the apps are actually being read from. The hub shows this, because
//  "my edit is not showing up" should be answerable by looking at the window
//  rather than by reading the packaging config.
ipcMain.handle('shell:info', () => ({
  root: ROOT,
  source: ROOT_SOURCE,              // 'dev' | 'live' | 'bundled'
  packaged: app.isPackaged,
  version: app.getVersion(),
  apps: registry.list().length,
}));
ipcMain.handle('registry:rescan', () => { registry.scan(); return registry.list(); });

// ── Centralized provider config (shared across all apps) ─────────────────────
// Stored at data/_shell/providers.json. Apps read it via window.fracture.
// Shell Settings panel writes to it.
const PROVIDERS_PATH = path.join(DATA_DIR, '_shell', 'providers.json');
function readProviders() {
  try {
    if (!fs.existsSync(PROVIDERS_PATH)) return defaultProviders();
    return JSON.parse(fs.readFileSync(PROVIDERS_PATH, 'utf8'));
  } catch (e) {
    return defaultProviders();
  }
}
function writeProviders(p) {
  const dir = path.dirname(PROVIDERS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROVIDERS_PATH, JSON.stringify(p, null, 2));
}
function defaultProviders() {
  return {
    preferred: 'pollinations',
    aihorde:      { key: '',          model: 'stable_diffusion' },
    pollinations: { token: '',        model: 'turbo' },
    huggingface:  { token: '',        model: 'black-forest-labs/FLUX.1-schnell' },
    openai:       { key: '',          model: 'gpt-image-1' },
  };
}
// ─── Language models ─────────────────────────────────────────────────────────
//  The shell owns the connection to whatever model server is running on this
//  machine, for the reason set out at the top of services/llm.js: apps load
//  from file://, and a file:// origin is refused by every local model server
//  there is. The main process has no origin, so it makes the call and relays
//  the bytes. Loopback only — llm.js checks the hostname before it opens a
//  socket, so this cannot become a general outbound proxy for apps.
const { LLM } = require('./services/llm');
const llm = new LLM();

ipcMain.handle('llm:discover', (event, extra) => llm.discover(extra));
ipcMain.handle('llm:models', (event, baseUrl, api) =>
  llm.models(baseUrl, api).catch(e => ({ ok: false, error: e.code || 'ERR',
                                         message: e.message })));

//  Hosted providers. The allow-list of hosts lives in llm.js; nothing else
//  can be dialled, so this cannot become a general outbound proxy for apps.
ipcMain.handle('llm:providers', () => llm.providers());
ipcMain.handle('llm:hostedModels', (event, provider, apiKey) =>
  llm.hostedModels(provider, apiKey));

//  Streaming. The renderer gets one 'llm:event' per token on its own
//  webContents, tagged with the stream id it was handed when it started.
ipcMain.handle('llm:chat', (event, opts) => {
  const wc = event.sender;
  return llm.start(opts, (msg) => {
    if (!wc.isDestroyed()) wc.send('llm:event', msg);
  });
});
ipcMain.handle('llm:stop', (event, id) => llm.stop(id));

//  A window that closes mid-generation must not leave a socket pulling tokens
//  out of the model for the rest of the session.
app.on('browser-window-created', (e, win) => {
  win.on('closed', () => { try { llm.stopAll(); } catch (err) {} });
});


ipcMain.handle('providers:read', () => readProviders());
ipcMain.handle('providers:write', (event, p) => { writeProviders(p); return true; });

// ── The person using this install ────────────────────────────────────────────
//  data/_shell/person.json, following the same pattern providers.json above
//  established: written by the shell, read by every app, owned by none.
//
//  This is here because every other write in the system is namespaced to an app
//  by construction — data:save takes the slug from the launch argument — so no
//  app could store a record belonging to a *person* rather than to an app.
//  Essays, usernames and characters that persist are all the same feature
//  underneath: a thing with an owner. This is the owner.
const person = createPerson(DATA_DIR);

ipcMain.handle('person:read',    ()                => person.read());
ipcMain.handle('person:update',  (event, patch)    => person.update(patch));
ipcMain.handle('person:claim',   (event, type, ref) => person.claim(type, ref));
ipcMain.handle('person:release', (event, type, ref) => person.release(type, ref));
//  resolve() is how an app reads something it holds without copying it. The
//  cached_* files under data/ are what happens without this.
ipcMain.handle('person:resolve',    (event, ref)  => person.resolve(ref));
ipcMain.handle('person:resolveAll', (event, type) => person.resolveAll(type));

// ── The outside world ────────────────────────────────────────────────────────
//  data/_shell/newswire.json, on the same footing as providers.json and
//  person.json: written by the shell, read by every app, owned by none.
//
//  This is the only thing in the hub that reaches the network, and it lives
//  here for the same reason person.json does — because otherwise every app
//  would have to solve caching, timeouts and being offline all over again, and
//  because an app in a BrowserWindow has no business making arbitrary outbound
//  requests on the user's machine.
//
//  read() answers instantly from cache and never rejects. refresh() is the one
//  that touches the wire.
const newswire = createNewswire(DATA_DIR);

ipcMain.handle('newswire:read',    ()             => newswire.read());
ipcMain.handle('newswire:refresh', (event, force) => newswire.refresh(!!force));

//  Warm it once shortly after boot, off the critical path, so the first app to
//  ask has something to show. A failure here is not an error — it is a city
//  with no signal, which the crawl already knows how to say.
app.whenReady().then(() => {
  setTimeout(() => { newswire.refresh(false).catch(() => {}); }, 2500);
});

// ── The boards ───────────────────────────────────────────────────────────────
//  A second network service, deliberately separate from the wire. The wire is
//  a broadcast: one beat, headlines only, refreshed every forty-five minutes.
//  The square is a conversation: whole posts, whole threads, from people rather
//  than outlets, and it moves fast enough to want a shorter window.
//
//  Which boards exist is data, not code — data/_shell/feeds.config.json
//  replaces the defaults, so a board can be pointed at any Mastodon instance,
//  any hashtag or any RSS feed without a rebuild.
const feeds = createFeeds(DATA_DIR, {
  //  Reddit's client-credentials grant. Only ever called when a board carries
  //  credentials, which none do by default.
  redditToken: (id, secret) => new Promise((resolve, reject) => {
    const https = require('https');
    const body = 'grant_type=client_credentials';
    const req = https.request({
      host: 'www.reddit.com', path: '/api/v1/access_token', method: 'POST',
      headers: {
        'authorization': 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': Buffer.byteLength(body),
        'user-agent': 'PresentPalm-Feeds/1.0',
      },
    }, res => {
      let out = '';
      res.setEncoding('utf8');
      res.on('data', d => { out += d; });
      res.on('end', () => {
        try {
          const j = JSON.parse(out);
          if (j.access_token) resolve(j.access_token);
          else reject(new Error(j.error || 'no token'));
        } catch (e){ reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(9000, () => req.destroy(new Error('timeout')));
    req.end(body);
  }),
});

ipcMain.handle('feeds:read',    ()                  => feeds.read());
ipcMain.handle('feeds:refresh', (event, force)      => feeds.refresh(!!force));
ipcMain.handle('feeds:thread',  (event, board, id)  => feeds.thread(board, id));

app.whenReady().then(() => {
  setTimeout(() => { feeds.refresh(false).catch(() => {}); }, 4000);
});

// ── Cross-app data read (single-user / single-machine) ──────────────────
// Lets one app read another's stored data, e.g. Visitor reading
// the latest tot.profile.v1 produced by Coherence Assessment.
// Returns null if nothing matches. listKeys returns just filenames.
ipcMain.handle('data:listKeys', (event, otherSlug) => {
  try {
    const dir = path.join(DATA_DIR, otherSlug);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
  } catch (e) { return []; }
});
ipcMain.handle('data:readFrom', (event, otherSlug, key) => {
  try {
    const safeKey = String(key).replace(/[^a-zA-Z0-9._-]/g, '_');
    const p = path.join(DATA_DIR, otherSlug, `${safeKey}.json`);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { return null; }
});

ipcMain.handle('app:open', (event, slug, payload) => launcher.openApp(slug, payload));
ipcMain.handle('app:openExternal', (event, url) => shell.openExternal(url));
ipcMain.handle('app:revealInFinder', (event, slug) => {
  const meta = registry.get(slug);
  if (meta) shell.showItemInFolder(meta.dir);
});

// Data persistence — per-app scoped JSON files in data/<slug>/<key>.json
function dataPath(slug, key) {
  const safeKey = String(key).replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(DATA_DIR, slug, `${safeKey}.json`);
}

ipcMain.handle('data:save', (event, slug, key, value) => {
  const dir = path.join(DATA_DIR, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dataPath(slug, key), JSON.stringify(value, null, 2));
  return true;
});

ipcMain.handle('data:read', (event, slug, key) => {
  const p = dataPath(slug, key);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return null; }
});

ipcMain.handle('data:list', (event, slug) => {
  const dir = path.join(DATA_DIR, slug);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''));
});

ipcMain.handle('data:delete', (event, slug, key) => {
  const p = dataPath(slug, key);
  if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
  return false;
});

// Bus — pub/sub between running apps
ipcMain.handle('bus:emit', (event, slug, type, payload) => {
  bus.emit(slug, type, payload);
  return true;
});
ipcMain.on('bus:subscribe', (event, type) => {
  bus.subscribe(type, event.sender);
});
