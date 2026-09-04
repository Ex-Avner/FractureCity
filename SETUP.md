# Setup — the three accounts, and what is already done

Everything here that could be done without a password **is done**. What is left
is three sign-ups, because I will not create accounts or enter credentials on
your behalf. Each one is a few minutes and the commands are written out.

---

## 1. Version control — done, except the push

The repository exists and the whole project is committed:

```
308 files · 196,341 lines · 12 MB packed · clean tree
3b0c0c8  Present Palm at Fracture City 0.25.1
```

`node_modules` (501 MB) is ignored, along with `.DS_Store` and `_build/_to_delete/`.
Every beta zip back to v0.11 **is** committed — those are the only record of
versions whose source no longer exists anywhere.

**To get it off this disk**, make an empty private repo at
<https://github.com/new> — name it `fracture-city`, private, and do **not** let
GitHub add a README or a .gitignore. Then:

```bash
cd ~/"Fracture City"
git remote add origin https://github.com/YOUR-USERNAME/fracture-city.git
git branch -M main
git push -u origin main
```

It will ask for a password: GitHub wants a **personal access token**, not your
account password. Make one at <https://github.com/settings/tokens> → *Generate
new token (classic)* → tick `repo` → paste it as the password. macOS keychain
remembers it after the first push.

From then on, after any session with me:

```bash
git add -A && git commit -m "what changed" && git push
```

> One housekeeping note: this bridge cannot delete files, so git occasionally
> leaves a `.git/index.lock` behind when I work here. If a git command ever says
> *"Another git process seems to be running"*, run `rm -f .git/*.lock` from your
> own Terminal. It is not a broken repo.

---

## 2. PostHog — the eyes

Free tier: 1M events, 5K session replays, 100K exceptions a month, no card.

1. Sign up at <https://posthog.com/signup>, region **US** (matches the default
   host in the build).
2. Project settings → **Project API key**. It starts with `phc_`.
3. Turn on **Session replay** in the left sidebar → *Session replay* → enable.
4. Rebuild the beta with the key baked in:

```bash
cd ~/"Fracture City"
python3 _build/build-beta.py --key phc_YOUR_KEY_HERE
```

That writes `_build/webbeta-dist/` and `_build/fracture-city-beta-v0.26.0.zip`.
Without `--key` the build loads no analytics script and makes no off-origin
request at all — that is what ships in the zip right now, and there is a test
that keeps it that way.

**What you will actually look at**, in rough order of usefulness:

| | |
|---|---|
| `intro` | seconds spent, which line it reached, finished or skipped. Four versions of "the intro is broken" would each have been one row here. |
| `tap_target` | the id of the element under the finger. The mobile freeze was an invisible sheet eating taps; it names itself in this field. |
| `frame_health` | median, p95 **and worst** frame each minute, plus `updateChunks` peak. The median looked fine while single frames took 7.4 seconds. |
| `rage_tap` | three taps in one spot inside 600ms. This is "it froze" in data form. |
| session replay | watch the actual session. This is the one that changes how we work. |

Players can opt out with `fcTelemetry(false)` in the console, Do Not Track is
obeyed before anything loads, and all typed input is masked in replays. It is
documented in the beta README so testers can see it.

---

## 3. Cloudflare Pages — the host

Free, unlimited bandwidth, and it replaces the Netlify deploy that has been
sitting on v0.10 for weeks.

1. Sign up at <https://dash.cloudflare.com/sign-up>.
2. **Workers & Pages** → *Create* → **Pages** → *Upload assets*.
3. Project name `fracture-city`, then drag the **`_build/webbeta-dist` folder**
   onto the drop zone — the folder itself, not the zip.
4. Deploy. You get `fracture-city.pages.dev` immediately.

To update later: same page → *Create new deployment* → drag the folder again.
`_headers` and `_redirects` are already in there — a year of caching on the
vendored three.js, no caching on the HTML, and an SPA fallback.

When you buy the domain, it is *Custom domains* → add → Cloudflare walks you
through the DNS. If you register the domain **at** Cloudflare it is one click
and no DNS editing at all.

---

## 4. itch.io — where players actually are

Free, and the single best place to put a browser game in front of people.
<https://itch.io/game/new> → Kind of project: **HTML** → upload the same zip →
tick *"This file will be played in the browser"* → viewport 1280×720. It
unzips and serves it for you, so this is an alternative to step 3 rather than
an extra chore — though having both is fine and costs nothing.

---

## What I did not spend

Nothing yet, on purpose. The order I would buy things in:

1. **A cheap used Android phone, ~$100 once.** Three versions of touch controls
   have shipped without ever being held. Highest value item on the list.
2. **ElevenLabs Starter, $6/mo.** Ned's voice. The transmission is already
   written as spoken word — it is the one change that would make the opening
   feel finished.
3. **A domain, ~$12/yr.**
4. **Claude Max, $100/mo** — only if you are actually hitting Pro's limits. If
   you are not, that money does nothing.
5. **Steam Direct, $100 once** — after the beta has players, not before.
