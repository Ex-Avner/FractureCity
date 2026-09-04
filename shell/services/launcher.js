// =============================================================================
//  Launcher — opens an installed app in a BrowserWindow (html5)
//  or spawns an external process (external runtime).
// =============================================================================

const { BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

class Launcher {
  constructor({ root, registry }) {
    this.root = root;
    this.registry = registry;
    this.windows = new Map();  // slug → BrowserWindow
  }

  openApp(slug, payload) {
    const meta = this.registry.get(slug);
    if (!meta) return { ok: false, error: `unknown slug: ${slug}` };

    if (meta.runtime === 'external') {
      return this.openExternal(meta);
    }
    return this.openHTML5(meta, payload);
  }

  openHTML5(meta, payload) {
    // If a window is already open for this app, focus it.
    if (this.windows.has(meta.slug)) {
      const existing = this.windows.get(meta.slug);
      if (!existing.isDestroyed()) {
        existing.focus();
        if (payload) existing.webContents.send('fracture:payload', payload);
        return { ok: true, focused: true };
      }
      this.windows.delete(meta.slug);
    }

    const win = new BrowserWindow({
      width: meta.window_width  || 1100,
      height: meta.window_height || 760,
      minWidth: 600,
      minHeight: 400,
      backgroundColor: '#080614',
      title: meta.name,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        additionalArguments: [
          `--fracture-slug=${meta.slug}`,
          `--fracture-payload=${encodeURIComponent(JSON.stringify(payload || null))}`,
        ],
      },
    });

    win.once('ready-to-show', () => win.show());
    win.loadFile(meta.entryPath);
    win.on('closed', () => this.windows.delete(meta.slug));
    this.windows.set(meta.slug, win);
    return { ok: true, opened: true };
  }

  openExternal(meta) {
    // For runtime: "external" — meta.entry may point to a .app, an executable,
    // or a script. We use macOS `open` for .app bundles, spawn otherwise.
    const target = meta.entryPath;
    if (target.endsWith('.app')) {
      spawn('open', [target], { detached: true, stdio: 'ignore' }).unref();
    } else if (target.endsWith('.command') || target.endsWith('.sh')) {
      spawn('open', [target], { detached: true, stdio: 'ignore' }).unref();
    } else if (target.endsWith('.py')) {
      const cwd = meta.dir;
      const args = meta.entry_args || [];
      spawn('python3', [target, ...args], { detached: true, stdio: 'ignore', cwd }).unref();
    } else {
      // Last resort: let the OS decide
      shell.openPath(target);
    }
    return { ok: true, external: true };
  }
}

module.exports = Launcher;
