# Main-city multiplayer · 0.56

Choose Fracture City · Makers’ Mile in the lobby, ready, then Open district.
The lobby hands off to /city/?online=ROOM using the existing account cookie.
The main game boots the actual Own the Block neighborhood with a shared seed.
Up to 12 residents share position, height, facing, presence, names, coat colors
and room chat. The character meshes and world renderer are the main game's.
Invites use the existing lobby. Player position is saved with the server account.
Local city saves use a separate room namespace so solo saves are not overwritten.
The 13 owned soundtrack tracks are included in server/public-music.

## Explicit limits

This is social free roam in the real world, not full simulation replication.
NPCs, zombies, quests, vehicles, building edits and custom characters remain
local. The initial shared-city avatar carries the account name and coat color;
it does not yet publish every customized appearance field. Shared gallery posts
still use the existing authenticated social service. Competitive PvP is disabled
in city rooms; existing arena maps retain authoritative combat. Position reports
are authenticated and bounded, but terrain collision runs on the client. Do not
use city presence as an authority for rewards, competitive combat or purchases.

Next: server-owned build operations and permissions, shared actor simulation,
terrain collision authority, and player combat in the same world.

## Deployment

Push this version, then Render > fracture-city-online > Manual Deploy > Deploy
latest commit. No new service, disk or paid plan is required. Existing Netlify
Play Online links keep working without a new upload. Existing arena lobbies stay
arena lobbies; create a new Makers’ Mile room after deploying. Saved accounts
and old district history remain intact.
