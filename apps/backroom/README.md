# Backroom artist studio

Open from the Fracture City main menu, Radio & menu tray, the Backroom arcade cabinet, or the web collection home page. The same app appears as a Present Palm launcher.

## Make a space
Choose a building piece, then click/tap the floor. Select and drag to move. Use the inspector to rotate, resize, lift, color and label it. Empty-space dragging orbits the editor camera; the wheel or + / - buttons zoom. Undo/Redo retain 50 editing steps. A room supports 150 objects.

The ten construction pieces are wall, floor, stairs, window, stage, rail, plinth, bench, light column and doorway arch. The rail is a building prop; this first studio does not implement the main city's skateboard physics.

Import JPG, PNG or WebP photos as framed artwork. Import MP3, WAV, OGG or M4A music as listening stations. A file is limited to 20 MB, a project to 100 media records, and imported media to 80 MB per editing session. Image dimensions are limited on direct import. Titles, descriptions and artist credit are plain text. Music requires an explicit Play action. In Visit mode, approach artwork for its caption or a speaker for the music button; M also starts a nearby station.

## Make a game
Place one Start, ordered Checkpoints, and one Finish. Add bonus stars and hazards. Checkpoints are numbered by their order in the object list. Start and Finish must be at ground height. Set a time limit, then choose Playtest. WASD/arrows move; Space jumps. Touch arrows and Jump appear on touch devices. Hazards or timeout restart the run. Finish requires every checkpoint in order; stars award bonus points. Restart retries the course; Edit returns to construction without changing the design.

## Keep or share it
IndexedDB stores one current studio and its media per browser origin. Save writes a transaction containing the room and all current media. The editor autosaves after changes. Export produces a .fracture.json file containing the objects and embedded media. Open project validates and imports that file after confirmation. Export is the portable backup/share mechanism; there are no public uploads, follower accounts, guestbooks, multiplayer editing, arbitrary scripts, or online galleries in this version. Existing city saves are separate.

## Verification
Browser tests cover placement, properties, Undo/Redo, artwork and audio importing, playable audio after reload, exporting embedded assets and re-importing, actual keyboard movement through a course, bonus collection, hazard restart and malformed data rejection. Integration checks cover city-menu entry/return and touch movement/release. Tests use Chrome, including the web package's Content Security Policy. Physical iOS/Safari testing remains outstanding.
