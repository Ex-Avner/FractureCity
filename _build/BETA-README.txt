FRACTURE CITY — public beta build 0.26.1
========================================

DROP THIS FOLDER ON A HOST. THAT IS THE WHOLE INSTALL.

  Cloudflare Pages   drag the unzipped folder onto "Upload assets"
  Netlify            drag the unzipped folder onto the Sites page
  Any static host    upload the contents; index.html is the entry point

It must be served over http(s), not opened as a file:// path — browsers refuse
localStorage and some fetches on file://, and the game saves to localStorage.
Any of `npx serve`, `python3 -m http.server`, or a phone pointed at your laptop
will do for a local look.

WHAT IS IN HERE
---------------
  index.html                    the entire game, one file
  shared/vendor/three.min.js    three.js r158, vendored — no CDN, no network
  _headers / _redirects         caching + SPA fallback for Cloudflare/Netlify

There is no build step, no bundler and no dependency install. Two files and
two host config files.

NO SHELL REQUIRED
-----------------
The game normally runs inside the Present Palm shell, which supplies the save
layer. Out here it defines its own, backed by localStorage under the key
prefix `fracture::fracture-city-game::`. Saves, the world's edits, your
requisitions and which channels the town square is tuned to all persist per
browser, per device. Clearing site data starts a new city.

PHONES
------
Touch controls are built in and appear automatically on any touch device: a
stick bottom-left, drag anywhere to look, buttons bottom-right, and a row of
chips along the top for the board, build mode, items, map and menu. Landscape
is strongly preferred and the game will say so in portrait.

THE TOWN SQUARE NEEDS THE INTERNET (AND NOTHING ELSE DOES)
----------------------------------------------------------
The six public boards read live posts from Mastodon, Hacker News, Bluesky and
Wikipedia's recent-changes feed, straight from the browser, with no API keys
and no server of yours in the middle. All four are readable cross-origin by
design. If a board cannot reach its source it says NO SIGNAL and the game
carries on — it never invents a post.

This build ships its own Content-Security-Policy in `_headers`, generated from
that list — no remote script origin, no object embeds, no framing, and
`connect-src` limited to exactly these five hosts. If your host ignores
`_headers` and applies its own policy, these are the hosts to allow, or the
boards will simply stay empty:

  mastodon.social        the four Mastodon board channels
  hn.algolia.com         the Hacker News board
  public.api.bsky.app    the Bluesky boards
  en.wikipedia.org       the Wikipedia recent-changes board
  hacker-news.firebaseio.com   Ned's headline ticker (separate from the boards)

TELEMETRY, AND HOW TO TURN IT OFF
---------------------------------
This build can report anonymously on how it runs, because four separate faults
in this game were found only because somebody typed "it froze" and I spent an
afternoon guessing. It is built from `--key`; with no key the build loads no
analytics script and makes no off-origin request at all.

What it sends, when a key is set:

  boot            version, screen size, core count, GPU name, touch or not
  intro           seconds spent, which line it reached, finished or skipped
  frame_health    median / p95 / worst frame each minute, and the hitch count
  tap_target      the id of the element under your finger (this is the one
                  that would have caught the mobile freeze in a day)
  rage_tap        three taps in one spot inside 600ms
  game_start · chapter · shift_end · death · session_end
  js_error        uncaught exceptions, with the line they came from
  session replay  a reconstruction of the page, with all typed input masked

What it does not send: your name, your email, your IP beyond what any web
server sees, or anything you type. The only text a player enters in this game
is a display name, and input masking is on.

To turn it off, open the browser console and run:

    fcTelemetry(false)

It sticks in that browser until you run `fcTelemetry(true)`. If your browser
sends Do Not Track, none of this runs in the first place and there is nothing
to switch off.

REPORTING
---------
Useful bug reports say: what you were doing, the district name from the
bottom-left of the HUD, and whether you were on a phone. The seed is in the
save; the menu shows it.
