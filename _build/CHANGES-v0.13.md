# Fracture City v0.13 — the Town Square

Real apps in the city, starting with the one you described months ago: a plaza
of neon boards carrying what people outside are actually saying.

165 tests. Everything before this is untouched.

---

## What it is

A landmark plaza east of the crossroads, at chunk `2,0`. Four boards on posts
around the ring, all facing inward so you can stand in the middle and see every
one of them. Walk up to a board, press **E**, and you get the posts. Open a
post and you get **the real conversation underneath it** — the replies as they
were written, by people who have no idea this city exists.

The framing, which matters as much as the plumbing: these boards were civic
infrastructure. Nobody switched them off when the broadcast ended, so they are
still receiving nine years later. The city did not build a social network. It
failed to decommission one.

---

## Where the posts come from

**Mastodon**, and it is the right answer rather than a consolation prize. Its
public timelines and public threads are readable with no account, no key, no
registered application and no quota — the protocol is built for other people's
clients. It is also the only major source that serves permissive CORS headers,
which is the only reason the boards work **in the web build as well as in the
shell**. Four default boards: the open timeline, `#ai`, `#gamedev`, `#cyberpunk`.

**RSS and Atom** are supported for any board you want to add — any blog, any
newsroom, any podcast, and usefully any **YouTube channel**, which publishes a
feed at `/feeds/videos.xml` with no API key at all.

**Reddit is deliberately off.** Its unauthenticated `.json` endpoints stopped
working in 2026; reading a subreddit now needs a registered OAuth application
and a client secret. The code path is written and tested — including the
client-credentials grant — but no reddit board ships by default, because a
board that 403s forever is worse than a board nobody was offered. Put an app id
and secret in the config and it turns on.

---

## Which boards exist is data, not code

`data/_shell/feeds.config.json` replaces the defaults entirely. Point a board at
any Mastodon instance, any hashtag, or any feed URL, give it a label and an
accent colour, and it appears in the plaza on the next launch. No rebuild. A
broken config falls back to the four defaults rather than an empty square.

---

## Two rules carried over from the newswire

**A post is never edited.** Not shortened to fit a board, not rewritten in the
city's voice. Real people wrote these. The fiction goes in the frame around the
board — never in what somebody said.

**An empty board says it is empty.** There is no seeded sample content anywhere,
so the square never quietly shows you fiction you might mistake for somebody's
actual opinion. A board that loses its host keeps what it had rather than going
dark; a board that never had anything says NO SIGNAL on its face and explains
why in the panel.

---

## Safety

Mastodon serves post bodies as HTML. That markup is stripped in exactly one
place — in the shell, before it ever reaches the game — and everything is
escaped again on the way into the DOM. A post that arrives as HTML and reaches a
DOM is somebody else's code running inside your game. The test suite fires a
`<script>` tag through the whole path and asserts it comes out as text.

---

## New files

```
shell/services/feeds.js      the boards service, beside newswire.js
shell/main.js                feeds:read / feeds:refresh / feeds:thread
shell/preload.js             window.fracture.feeds() / refreshFeeds() / thread()
```

`feeds.js` is fully injectable — every source goes through `ctx.get`, so the
whole service is tested against fixtures with no network at all.

---

## Verified

| suite | result |
|---|---|
| the feeds service, against fixtures | 21 / 21 |
| the Town Square, in the city | 14 / 14 |
| sound and feel | 16 / 16 |
| the bestiary | 12 / 12 |
| detail, loot and progression | 13 / 13 |
| the front door | 12 / 12 |
| siege | 24 / 24 |
| thought bubbles | 18 / 18 |
| newswire | 16 / 16 |
| campaign playthrough | 7 / 7 |
| web beta, served as a static site | 12 / 12 |

---

## What this opens up

The plumbing is now general. A board is `{ key, kind, label, accent }` plus
wherever it reads from, and `kind` is a lookup table with three entries. Adding
a source is one function. The obvious next ones:

- **Screens with video.** Public-domain footage from archive.org textured onto
  surfaces with `THREE.VideoTexture`, and a proper embedded player when you
  press E at a TV. YouTube's terms require their own player, visible and
  unobstructed, so it can be a panel but never a texture in the 3D world.
- **The web build's other sources.** A Netlify Function doing what the shell's
  main process does would let the public build carry the non-CORS boards too.
- **Posting.** Reading is the easy half. Writing to Mastodon from the wrist
  device needs an OAuth flow and a much larger trust surface, and is worth doing
  deliberately rather than as an afterthought.
