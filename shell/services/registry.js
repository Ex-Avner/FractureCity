// =============================================================================
//  Registry — scans apps/ for fracture.app.json manifests
// =============================================================================

const fs = require('fs');
const path = require('path');

const REQUIRED_FIELDS = ['slug', 'name', 'entry', 'runtime'];
const SUPPORTED_RUNTIMES = ['html5', 'external'];

class Registry {
  constructor({ appsDir }) {
    this.appsDir = appsDir;
    this.apps = new Map();
  }

  scan() {
    this.apps.clear();
    if (!fs.existsSync(this.appsDir)) return;
    const entries = fs.readdirSync(this.appsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(this.appsDir, entry.name);
      const manifestPath = path.join(dir, 'fracture.app.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const valid = this.validate(manifest, entry.name);
        if (!valid.ok) {
          console.warn(`[registry] skipping ${entry.name}: ${valid.error}`);
          continue;
        }
        this.apps.set(manifest.slug, {
          ...manifest,
          dir,
          entryPath: path.join(dir, manifest.entry),
          iconPath: manifest.icon ? path.join(dir, manifest.icon) : null,
          installed: true,
        });
      } catch (e) {
        console.warn(`[registry] failed to parse ${manifestPath}:`, e.message);
      }
    }
    console.log(`[registry] scanned ${this.apps.size} apps`);
  }

  validate(manifest, folderName) {
    for (const field of REQUIRED_FIELDS) {
      if (!manifest[field]) return { ok: false, error: `missing field "${field}"` };
    }
    if (!SUPPORTED_RUNTIMES.includes(manifest.runtime)) {
      return { ok: false, error: `unsupported runtime "${manifest.runtime}"` };
    }
    if (manifest.slug !== folderName) {
      console.warn(`[registry] slug "${manifest.slug}" differs from folder "${folderName}"`);
    }
    return { ok: true };
  }

  list() {
    return Array.from(this.apps.values()).map(a => ({
      slug: a.slug,
      name: a.name,
      version: a.version || '0.0.0',
      description: a.description || '',
      icon: a.iconPath,
      runtime: a.runtime,
      tags: a.tags || [],
      inputs: a.inputs || [],
      outputs: a.outputs || [],
    }));
  }

  get(slug) { return this.apps.get(slug); }
}

module.exports = Registry;
