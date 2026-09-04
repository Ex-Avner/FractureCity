# Present Palm

The hub. A personal ecosystem of interconnected HTML5 applications around the
Triadic Coherence framework and the **Fracture City** world.

The folder on disk is still named `Fracture City/` because (a) the .app
launcher bundles hard-coded the path, and (b) "Fracture City" is the lore-world
the apps inhabit. **Present Palm** is the hub identity: the OS that boots the
apps, the brand on the launcher window.

Apps live as siblings inside `apps/`, share theme and data conventions via
`shared/`, persist user data in `data/<app-slug>/`, and are discovered &
launched by the Electron shell in `shell/`.

## Layout

```
Fracture City/
  shell/                    Electron shell — the launcher OS
    package.json
    main.js
    preload.js
    renderer/               launcher UI (HTML/CSS/JS)
    services/               registry, launcher, bus
    assets/                 shell icon, fonts
  apps/                     installed applications
    <slug>/
      fracture.app.json     manifest
      index.html            (or whatever the manifest's entry points at)
      ...
  shared/                   theme + helper libraries every app may use
    theme.css
    fracture-client.js
  data/                     user data, scoped per app slug
    <slug>/
  ideas/                    drafted app concepts (from the idea-generator)
  fracture.json             top-level registry / shell config
```

## How an app slots in

Every app folder under `apps/` ships a `fracture.app.json`:

```json
{
  "slug": "coherence-assessment",
  "name": "Coherence Assessment",
  "version": "1.0.0",
  "icon": "icon.png",
  "entry": "index.html",
  "runtime": "html5",
  "description": "Triadic orientation psychometric assessment.",
  "inputs":  [],
  "outputs": [{ "type": "tot.profile.v1" }],
  "tags": ["assessment","psychometric","tot","coherence"]
}
```

The shell scans `apps/`, reads manifests, and renders a launcher grid.

## window.fracture (inside the shell)

When an HTML5 app is loaded by the shell, a preload script exposes:

```js
window.fracture.shell          // true if inside shell, undefined otherwise
window.fracture.appSlug        // your app's slug
window.fracture.save(k, v)     // persist to data/<slug>/
window.fracture.read(k)        // read from data/<slug>/
window.fracture.list()         // list keys in data/<slug>/
window.fracture.listApps()     // installed apps registry
window.fracture.openApp(slug, payload)
window.fracture.received       // payload another app sent on open (if any)
```

Outside the shell (opened directly in a browser), apps still work — they
just fall back to localStorage. Same source file in both contexts.

## Running the shell

Requires Node.js. Once installed:

```
cd shell
npm install
npm start
```

To build a distributable `.app`:

```
cd shell
npm run build
```
