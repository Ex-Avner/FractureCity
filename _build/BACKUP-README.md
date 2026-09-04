# Present Palm — full backup

A complete copy of the Present Palm ecosystem: the Electron shell, every app, the
shared assets, and your data. Everything needed to bring it back on a new machine.

Made **{{DATE}}**.

---

## What is in here

```
Fracture City/
├── shell/            the Present Palm desktop app (Electron)
│   ├── main.js       window management, the apps registry, and all IPC
│   ├── preload.js    window.fracture — the API every app is handed
│   ├── services/     registry · launcher · bus · person · newswire
│   ├── renderer/     the launcher UI
│   └── package.json  dependencies (node_modules is NOT in this archive)
├── apps/             fifteen apps, each a self-contained folder
│   └── <slug>/
│       ├── index.html          the whole app, usually one file
│       └── fracture.app.json   its manifest: name, version, inputs, outputs
├── data/             YOUR DATA — saves, essays, characters, scenes, identity
├── shared/           assets more than one app uses
├── ideas/            scratch
├── fracture.json     hub config
├── README.md         the project's own readme
└── SHIP_PLAN.md
```

`shell/node_modules` is deliberately excluded — it is around half a gigabyte of
Electron and it is reinstallable in one command. Everything else is here.

---

## Restoring it

```bash
# 1. put the folder wherever you like
cd "Fracture City/shell"

# 2. reinstall the dependencies that were left out
npm install

# 3. run it
npm start
```

The shell resolves the ecosystem root as its own parent directory, so as long as
`shell/` sits next to `apps/` and `data/` it will find everything. Apps are
discovered by scanning `apps/` for `fracture.app.json` — nothing is hardcoded, so
adding an app is dropping a folder in and restarting.

### Without Electron

Every app also runs as an ordinary web page. Serve the `apps/` folder over http
and open any app's `index.html` directly:

```bash
cd "Fracture City/apps" && python3 -m http.server 8080
```

Each app carries a localStorage stand-in for `window.fracture`, so saves, settings
and your person.v1 identity all work — they are just kept per-browser instead of in
`data/`. The two things you lose outside the shell are cross-app reads (one app
reading another's files) and the newswire's second source; Fracture City falls back
to fetching Hacker News directly from the page.

---

## Your data

`data/` is the part that is actually irreplaceable. It is plain JSON, one folder
per app, and it is readable and editable by hand.

| Path | What it is |
|---|---|
| `data/_shell/person.json` | who you are across the whole hub — id, username, display name, and what you hold |
| `data/_shell/newswire.json` | cached headlines; disposable |
| `data/_shell/providers.json` | **image-provider API keys, if you have ever set any** |
| `data/fracture-city-game/` | campaign progress, world edits per seed, your avatar, free-build |
| `data/still-human/` | best run and last run |
| `data/essays/` | your essays |
| `data/character-library/`, `data/scene-composer/`, … | cast, scenes, profiles |

**Before you upload this archive anywhere:** if `data/_shell/providers.json`
exists it contains API keys in plain text. There is none in this backup, but the
Settings panel writes one the moment you enter a key, so check before sharing a
future copy. Everything else in `data/` is personal but not secret.

To back up only your data in future, `data/` on its own is enough — the apps and
the shell are rebuildable, your essays and saves are not.

---

## How the pieces fit

**The shell owns three things and no app owns any of them.** `providers.json`
holds image-generation keys so no app has to ask twice. `person.json` holds *you* —
every other file on disk is namespaced to an app by construction, so this is the
only place a record can belong to a person rather than to a program. `newswire.json`
holds real AI and technology headlines, fetched by the shell's main process because
it is the one thing in the hub that touches the network.

**Apps talk through `window.fracture`.** `save`/`read`/`list`/`delete` for their
own data; `readFrom`/`listFrom` to read another app's; `emit`/`subscribe` for a
message bus; `me`/`updateMe`/`claim`/`release`/`resolve` for identity and
ownership. `resolve` is the one worth knowing: it reads a thing you hold *live*
rather than copying it, because a copy is correct until someone edits the original
and then silently wrong forever.

**Fracture City is the hub inside the hub.** Its arcade reads the live app registry
and gives every installed app a cabinet, so an app added tomorrow appears in the
city without anyone editing the city.

---

## Building Fracture City from source

Fracture City is generated, not hand-edited. `index.html` is produced by a script
that takes the pristine v0.2 file and applies a list of labelled edits, then
concatenates the module files:

```
splice.py            116 labelled edits + the module list
shift-*.js           the modules, in order — these are the source of truth
shift-*.css
shift-dom-*.html
```

Every rebuild starts from the original, so an edit that no longer matches fails
loudly instead of silently doing nothing. If you have that build directory, keep it
with this archive; if you do not, `apps/fracture-city-game/index.html` is the
finished article and stands alone.

---

## Known state

- Sound: essentially none anywhere yet.
- Mobile: not supported — keyboard and mouse only.
- Fracture City is heavy on a modest laptop; the other games are light.
- Saves are per-machine. Nothing syncs, nothing phones home.
