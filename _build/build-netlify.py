#!/usr/bin/env python3
"""Build a complete static arcade, soundtrack and game for Netlify Drop."""
from pathlib import Path
import json,shutil,zipfile,importlib.util,re
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'_build/netlify-mobile';VERSION='0.78.1'
slugs=['chainfire','fracture-city-game','wrong-floor','palm-drive','coherence-game','still-human','still-human-wild','sun-fall','light-bearer','the-visitor','works','character-forge','backroom','toilet-heads','fractured-mirror','breaking-ned','oh-no-ned','bad-weather']
if OUT.exists():shutil.rmtree(OUT)
OUT.mkdir(parents=True)
shutil.copytree(ROOT/'shared',OUT/'shared')
for slug in slugs:
 target=OUT/'apps'/slug
 shutil.copytree(ROOT/'apps'/slug,target,ignore=shutil.ignore_patterns('*.bak','*backup*','__pycache__','*.py','*.md'))
 p=target/'index.html';html=p.read_text()
 html=html.replace('<head>','<head>\n<script>window.FC_FULL_WEB=true;window.FC_WEB_EDITION=true;window.FC_RADIO_URL="../../media/music/playlist.json";</script>',1)
 if slug=='the-visitor':html=html.replace('<head>','<head>\n<script src="web-art.js"></script>',1)
 # Local renderer dependencies are shipped, so no CDN fallback is needed.
 html=re.sub(r"document\.write\([^\n]*https://cdnjs[^\n]*",'/* Renderer is included locally. */',html)
 if slug=='fracture-city-game':
  cast=json.loads((ROOT/'_build/sample-cast.json').read_text());html=html.replace('<head>','<head>\n<script>window.FC_CAST='+json.dumps(cast)+';</script>',1)
 p.write_text(html)
music=ROOT/'media/music/Final Collection';target=OUT/'media/music';target.mkdir(parents=True)
tracks=[]
for i,p in enumerate(sorted(music.glob('*.mp3'))):
 filename=f'{i+1:02}.mp3';shutil.copy2(p,target/filename);tracks.append({'title':p.stem,'file':filename})
assert len(tracks)==13,'Expected the 13 final tracks'
(target/'playlist.json').write_text(json.dumps({'tracks':tracks},indent=2))
spec=importlib.util.spec_from_file_location('beta',ROOT/'_build/build-beta.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
(OUT/'_headers').write_text(module.build_headers('','').replace('max-age=31536000, immutable','max-age=86400')+'\n/media/music/*\n  Cache-Control: public, max-age=86400\n')
# No SPA wildcard: a missing script must remain a real 404, never game HTML.
(OUT/'_redirects').write_text('/play /apps/fracture-city-game/index.html 302\n')
(OUT/'404.html').write_text('<!doctype html><title>Not found</title><h1>This street is closed.</h1><a href="/">Return to the arcade</a>')
(OUT/'index.html').write_text((ROOT/'_build/netlify-home.html').read_text())
(OUT/'DEPLOY.txt').write_text('''FRACTURE CITY WEB 0.78.1
1. Unzip this download.
2. Sign into Netlify and visit https://app.netlify.com/drop
3. Drop the folder containing index.html, apps, shared and media onto Netlify.
   You can also try dropping the ZIP directly. No build command is needed.
4. Open the HTTPS link on your phone. Landscape is recommended for action games.
5. To update an existing site, use that site's Deploys upload area, retaining its address.

Choose Begin story. Ned’s bulletin leads into the city’s first objective.
Walk east to discover Makers’ Mile in the same saved city. Follow its street
signs, approach Studio 01 and press E for your key, then B opens the workshop.
Studio ownership, artwork and story progress save with that city. Older
studio saves remain in Saved cities; no existing cities are deleted or merged.
The neighborhood board can take you back to Civic Core.

13 soundtrack tracks are included. Music begins after a tap. Songs load on demand.
Use Radio & menu in the city, or the music player on the home page.
All twelve arcade cabinet destinations are included, plus the main game.
Room workshop: press B in the city, choose Creative supplies, a finish and a piece.
Return to place. T rotates, right-click places, E opens your doorways.
On phones use the touch Build and Place controls, and catalogue Rotate button.
Fine art: B > Fine art & interiors opens the live 3D inspector.
Drag the city view to orbit; scroll to zoom. Switch Click view to PLACE to
stamp a shape. Use SELECT to edit it. Try the Midnight listening room.
Art saves locally per city; Export artwork creates a reusable blueprint file.
The Visitor web edition uses built-in illustrations, not an AI image service.
Saves live in each browser. Clearing browser data deletes them; another phone
or a different site address has separate saves. No server-side accounts here.
Common Ground gallery: walk to the displays beside the Makers’ Mile garden.
The static edition saves private drafts. Shared publishing and responses require
the Districts server; open /city/ on that server and sign in at a display.

Netlify hosts the game and music. It does not run the separate Districts server.
Choose Play Online on the website or game menu to open
https://fracture-city-online.onrender.com/ for accounts and 12-player Districts.
Music delivery uses your Netlify bandwidth/credits; check your account usage.
Mobile browser emulation is tested; physical iPhone/iPad testing remains needed.
''')
archive=ROOT/'_build'/f'fracture-city-netlify-mobile-v{VERSION}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in OUT.rglob('*'):
  if p.is_file():z.write(p,p.relative_to(OUT))
print(archive);print('Tracks:',len(tracks),'size MB:',round(archive.stat().st_size/1024**2,1))
