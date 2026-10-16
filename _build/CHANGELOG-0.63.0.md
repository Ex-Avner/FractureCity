# Fracture City 0.63.0 · The Main Beta

## Added
- Main Beta: a permanent, code-free, always-open public city room. Lobby
  button "Play the Main Beta", live resident count, and /?main=1 links.
- Common Ground theory library: The Collapse of Meaning, all 32 chapters,
  readable in the square on desktop and phone. Remembers your chapter.
- Common Ground listening booth: the 13 original tracks, choose any track,
  plays on your own Palm Radio.
- Owner moderation in the Main Beta through OWNER_USERNAMES:
  /remove @username and /allow @username in chat.
- Idle release: Main Beta plots and gallery spaces free up after 30 days of
  inactivity, archived first, never deleted.
- Backup retention: newest 7 daily database copies kept.
- GET /api/main status; /health reports Main Beta residents.

## Changed
- MAX_ROOMS now reserves a slot for the Main Beta. render.yaml: 3.
- Gallery media cleanup keeps media referenced by archived exhibits.
- Social server package and Dockerfile include every server module
  (structure-store, gallery-media, news-feed, main-beta were missing from
  the Docker path).

## Not changed
- Accounts remain required. Private invite rooms behave as before.
- The Main Beta is peaceful; arena PvP is unchanged.
