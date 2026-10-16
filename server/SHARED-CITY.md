# Main-city multiplayer · 0.62

Choose Fracture City · Makers’ Mile in the lobby, ready, then Open district.
The lobby hands off to /city/?online=ROOM using the existing account cookie.
The main game boots the actual Own the Block neighborhood with a shared seed.
Up to 12 residents share position, height, facing, presence, names, coat colors
and room chat. Furniture, sculptures, signs and painted murals from the art
workshop are now server-persisted and synchronized between residents. The character meshes and world renderer are the main game's.
Invites use the existing lobby. Player position is saved with the server account.
Local city saves use a separate room namespace so solo saves are not overwritten.
The 13 owned soundtrack tracks are included in server/public-music.

## Explicit limits

This is social free roam in the real world, not full simulation replication.
NPCs, zombies, quests, vehicles and
custom characters remain local. The initial shared-city avatar carries the account name and coat color;
it does not yet publish every customized appearance field. Shared gallery posts
still use the existing authenticated social service. Competitive PvP is disabled
in city rooms; existing arena maps retain authoritative combat. Position reports
are authenticated and bounded, but terrain collision runs on the client. Do not
use city presence as an authority for rewards, competitive combat or purchases.

Next: shared actor simulation,
terrain collision authority, and player combat in the same world.

## Deployment

Push this version, then Render > fracture-city-online > Manual Deploy > Deploy
latest commit. No new service, disk or paid plan is required. Existing Netlify
Play Online links keep working without a new upload. Existing arena lobbies stay
arena lobbies; create a new Makers’ Mile room after deploying. Saved accounts
and old district history remain intact.

## Shared artwork

Use B > Fine art & interiors. The normal editor, presets, imports, move,
duplicate, paint, delete and undo operations now publish to the current room.
There is no separate publishing panel. A resident can change only their own
pieces; copies receive new IDs. The room supports 1,200 pieces total, up to 300
per resident, and 24 signs/murals total. These limits apply to the art workshop's
shapes and furnishings. Structural room-workshop blocks use the separate owned
online plots described below; ordinary city terrain cannot be edited online.

SQLite stores each author's payload with a revision. Writes replace only that
author's collection in a transaction; other authors are preserved. Stale
revisions reject updates rather than overwrite work. Ownership is bound to the
account and room session, never a supplied author ID. Server validation covers
IDs, transforms, materials, geometry, mural pixels, payload and object limits.
The room stream carries only the artwork revision; clients fetch the collection
when it changes rather than sending all artwork every simulation tick.

Failed writes retain an in-memory draft, expose Download art draft, warn before
closing the page, and retry after connection recovery. A conflict keeps the draft
for export and requires reload to use the current server version. Local art from
older versions is not silently published; import its exported blueprint to add
it to the shared room. Artwork stays with the room code, not every city globally.

Validation: server/shared-art.test.cjs exercises ownership, independent authors,
conflicts, idempotent retries, invalid data, deletion and full-server restart.
_test/shared-art.test.cjs uses two real Chrome clients in Makers’ Mile to check
creation, edits, undo, failed saves, reconnect, reload and arcade access.


## Real photos and music in Common Ground (0.60)

Join an online city, walk to a gallery display on Makers’ Mile’s promenade,
press E and choose Publish here. Add a title and story, optionally choose a
photo and an MP3/WAV, then publish. Other signed-in residents can see the
photo, listen beside the display and respond to the work. The gallery is
shared across this server’s cities, with eight spaces and two per artist.

Photos are resized to at most 1600 pixels and converted to PNG before upload.
Audio uploads accept MP3/WAV up to 12 MB. Audio starts only after Listen,
fades with distance, and stops beyond 12 metres. This is individual listening,
not synchronized performance playback. Tools → Online first-visit guide
tracks arriving at the gallery, publishing, and claiming Studio 01.

Files and gallery references live in the persistent SQLite database and
are included in its backups. No external bucket or additional account is needed.
Default quotas are 64 MB per account and 128 MB for the server; MEDIA_QUOTA_MB
changes the server quota. Monitor the persistent disk and backup growth before
raising this limit. Unpublished uploads expire after 24 hours at the next upload.
Removing an exhibit deletes its media if no other exhibit references it.
Only the owner can publish their uploaded files. Unpublished files are private;
published files require a signed-in account and respect artist blocking.

Local Netlify downloads continue to support private text/mural drafts.
Real shared uploads require the running Render server’s /city/ page.
The media test restarts an isolated database; the browser test uses two actual
city clients, uploads files through the form, renders/plays them for a second
resident, and re-enters after a full server restart. No live player data is used.


## Persistent building plots (0.61)

Inside an online city, open the Online panel and choose My building plot.
This is server-authorized travel to a fixed paved site east of Makers’ Mile.
Press B, choose a wall, floor, staircase or door, then return to place it.
Each city has twelve permanent, account-owned 8×8 plots, sixteen blocks high.
Each plot holds up to 1,000 blocks and fifty doorways. New visitors can still
join and use the gallery after every plot has an owner. Plots are not recycled
when a player disconnects.

All workshop structures inside those plots use server-validated ownership and
revisions. Accepted blocks become real collision voxels for everyone. Undo
and redo synchronize; stale changes are rejected. Nearby visitors can open
and close doors, but cannot alter someone else’s building. Building or closing
a door onto a server-known resident position is rejected. Player movement
remains client-simulated and bounded; this is not yet server-authoritative city PvP.

Ordinary city terrain is protected in online sessions; demolition and building
outside the shared plots are not synchronized and are disabled through the
recorded block-edit path. Fine-art sculptures, furniture, photos, music and
gallery responses retain their existing shared systems. Offline story cities
keep their ordinary local construction tools. Structural blocks, plot ownership
and door states are stored in the existing persistent SQLite database.

The two-browser regression verifies collision, undo/redo, visitor door use,
chunk unloading/reloading, and recovery after a complete server restart.


## Common Ground / v0.62

Makers’ Mile now has a sheltered news pavilion at (184, 26), a landscaped
resident gallery along z=36, garden seating, modern wayfinding and a consistent
jade/stone/bronze architectural palette. The peaceful square holsters the
first-person weapon and hides combat HUD; inventory and combat elsewhere are
unchanged. The existing private mural showcase is on the garden wall.

Approach the news pavilion and press E or tap the prompt. The wire shows real
publisher headlines with dates, bylines and original article links. The Residents
filter shows existing shared posts, photographs and engagement counts, and gives
walking directions to the actual exhibit. Publishing, responses, follows,
appreciations, muting, reporting and music listening remain at the physical work.
The gallery still has eight shared exhibits and existing per-author limits.

GET /api/news reads fixed public RSS sources: Global Voices (CC BY 3.0,
https://globalvoices.org/about/) and NASA (https://www.nasa.gov/rss-feeds/).
Only headline metadata is retained; no full articles, third-party images, cookies,
or visitor identifiers are sent upstream. Original sources and attribution are
shown in the reader. This curated feed is not comprehensive news coverage.
Ned’s fiction is separate from these publisher reports.

The server coalesces concurrent refreshes, polls each source at most once per
ten minutes, applies an eight-second timeout and 1 MiB size limit, refuses
redirects and non-allowlisted article hosts, and stores last-good results in
SQLite. Failed sources retain their cached headlines with a stale indicator.
There are no synthetic fallback news items. Static/offline downloads explain
that live headlines require the online city. No API key or extra paid service
is needed. Deploy the latest Render commit for the news endpoint and city assets;
upload the matching Netlify package to update its offline game appearance.

Checks: news metadata sanitization/URL filtering, cache coalescing, outage and
restart retention; source-linked desktop and phone-width reader; physical gallery
publishing and resident directions; two-player photo/music rendering, responses
and restart persistence. Live feed retrieval verified with both publishers.
