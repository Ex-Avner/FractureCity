# Setup — wiring GitHub and Cloudflare together

You already have both accounts. That changes the plan for the better: **don't
drag folders.** Connect Cloudflare Pages to the GitHub repo and every push
deploys itself.

---

## 0. Unjam git first — 5 seconds

This bridge cannot delete files, so git occasionally leaves a lock behind when
I work here. Two are sitting there now and they block every git write:

```bash
cd ~/"Fracture City"
rm -f .git/*.lock
```

If a git command ever says *"Another git process seems to be running"*, that is
this and only this. It is not a damaged repository.

---

## 1. Push — ~5 minutes

The repository is real and current: **5 commits, 15 MB packed, clean tree, up to
0.26.2.** It has no remote, which means it is still one disk failure away from
gone.

Make an empty **private** repo at <https://github.com/new> named
`fracture-city`. No README, no .gitignore, no licence — an empty one, or the
first push conflicts.

```bash
cd ~/"Fracture City"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/fracture-city.git
git push -u origin main
```

It will ask for a password and it does not mean your password. GitHub wants a
**personal access token**: <https://github.com/settings/tokens> → *Generate new
token (classic)* → tick `repo` → paste it where it asks for the password. The
macOS keychain remembers it after the first push.

After any session with me:

```bash
git add -A && git commit -m "what changed" && git push
```

---

## 2. Connect Cloudflare Pages to the repo — ~5 minutes, once

dash.cloudflare.com → **Workers & Pages** → *Create* → **Pages** → **Connect to
Git** → pick `fracture-city`.

Then set exactly these:

| field | value |
|---|---|
| Framework preset | **None** |
| Build command | `python3 _build/build-beta.py` |
| Build output directory | `_build/webbeta-dist` |
| Root directory | *(leave empty)* |

That is the whole configuration. Cloudflare's build image ships Python 3.11 and
`build-beta.py` uses nothing but the standard library, so there is no
`requirements.txt`, no install step and no lockfile. `.python-version` is in the
repo pinning 3.11.5 so a future default cannot move under you.

**From then on: `git push` is the deploy.** The build script flattens the
three.js path, injects the analytics config, strips the CDN fallback and writes
the CSP — all the things that were previously three manual edits I carried
between sessions.

> The `_build/webbeta-dist` folder is gitignored on purpose. It is derived, and
> Cloudflare regenerates it on their machine from the source you pushed. You are
> deploying the *source of truth*, not a copy of it.

If you ever want a deploy without a push — a quick test from the phone, say —
*Upload assets* still works and the folder is built on your Mac right now.

---

## 3. PostHog, as a secret rather than a file — ~5 minutes

Do this after the site is live, so the first session you watch is a real one.

Free tier: 1M events, 5K session replays, 100K exceptions a month, no card.
Sign up (region **US**, matching the default host), then Project settings →
**Project API key** (`phc_…`), and turn on **Session replay** in the sidebar.

Then in Cloudflare: your Pages project → **Settings → Variables and Secrets** →
add an encrypted variable:

```
FC_POSTHOG_KEY = phc_your_key_here
```

Redeploy. `build-beta.py` reads it from the environment, bakes it into that
build, and extends the CSP to allow PostHog — **and the key never enters git.**
Local builds stay silent unless you pass `--key` yourself.

What you will actually look at, in order of usefulness:

| | |
|---|---|
| `intro` | seconds spent, which line it reached, finished or skipped |
| `tap_target` | the id of the element under the finger |
| `frame_health` | median, p95 **and worst** frame each minute |
| `rage_tap` | three taps in one spot inside 600ms |
| session replay | watch the actual session — the one that changes how we work |

Players opt out with `fcTelemetry(false)`; Do Not Track is obeyed before
anything loads; typed input is masked. It is documented in the beta README so
testers can read it rather than discover it.

---

## 4. itch.io — optional, and where players actually are

<https://itch.io/game/new> → Kind of project **HTML** → upload
`_build/fracture-city-beta-v0.26.2.zip` → tick *"This file will be played in the
browser"* → viewport 1280×720. Free, and it has an audience Cloudflare does not.
Both can run at once; the zip and the Pages deploy are the same build.

---

## What I still would not spend money on yet

1. **A cheap used Android phone, ~$100 once.** Four versions of touch controls
   have shipped without one ever being held. The last bug — the menu running 79
   pixels off the bottom of the screen — would have taken four seconds to see.
2. **ElevenLabs Starter, $6/mo.** Ned's voice. The transmission is already
   written as spoken word.
3. **A domain, ~$12/yr.** Register it at Cloudflare and the Pages custom domain
   is one click with no DNS editing.
4. **Claude Max, $100/mo** — only if you are actually hitting Pro's limits.
5. **Steam Direct, $100 once** — after the beta has players.
