#!/usr/bin/env python3
"""Package public game assets and the persistent server; never package live data."""
from pathlib import Path
import zipfile
ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/'_build/netlify-mobile'
VERSION='0.78.0'
SERVER=['common-challenge.cjs','server.cjs','store.cjs','social.cjs','gallery-media.cjs','social-admin.cjs','start.cjs','database.cjs','city-build-store.cjs','structure-store.cjs','news-feed.cjs','main-beta.cjs','resident-life.cjs','classics.cjs','classics-text.cjs','Dockerfile','dockerignore','fly.toml','README.md']
archive=ROOT/'_build'/f'fracture-city-social-server-v{VERSION}.zip'
readme='''FRACTURE CITY / COMMON GROUND

This package includes the desktop/mobile game, all mini games, 13 songs,
and the persistent accounts + shared gallery + multiplayer server.
It contains NO existing player accounts, private keys or saved databases.

LOCAL TRYOUT (Node 24 or newer required)
1. Unzip into a folder you can keep.
2. From that folder run: node server/start.cjs
3. Open http://127.0.0.1:8787/city/ for the main game.
4. Begin story, then explore east to Makers’ Mile and its gallery.
5. Sign in or create an account from a display to share work.
6. Open http://127.0.0.1:8787/ for the 12-player Districts lobby.
   Exhibits and responses are shared between both experiences.

This localhost address only works on your own computer. Inviting anyone
on the internet needs a deployed HTTPS server with persistent storage.
Follow server/README.md for the existing Fly deployment setup, backups
and moderation commands. No public deployment is included or claimed.
Do not upload this entire package to Netlify. Netlify cannot run this
Node account/social database. The separate Netlify ZIP supports local drafts.

CREATING WITHOUT CONSTANT MENUS
B -> Fine art & interiors, then Return to city.
Left-click / touch Mine selects artwork without pausing.
G moves it, ] rotates, J duplicates, Z undoes the last art operation.
Right-click / touch Place sets a moving design on a surface.
Details & materials opens the full editor whenever you want it.

Keep server/data and its backups private. Do not share a populated
installation folder; share this original clean download instead.
'''
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for top in ['apps','shared','media']:
  for p in sorted((WEB/top).rglob('*')):
   if p.is_file() and not any(part.startswith(('.', '_')) or 'backup' in part.lower() for part in p.relative_to(WEB).parts):
    z.write(p,p.relative_to(WEB).as_posix())
 for name in SERVER:z.write(ROOT/'server'/name,'server/'+name)
 z.writestr('START HERE.txt',readme)
print(archive)
print('Public assets and server code only; no database or existing user data.')
