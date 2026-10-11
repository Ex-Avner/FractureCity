# Your media in Fracture City

Unversioned. Rides on top of 0.36.1.

## Palm Radio
- Drop music into `Fracture City/media/music` (mp3, m4a, wav, ogg, flac). Subfolders are albums.
- U plays or pauses. Y skips. H opens the Studio panel (tracks, shuffle, volume, folder buttons).
- Radio ducks under narration and dialogue.

## Art in the city
- Images in `media/art` plus everything Palm Image Studio makes go on rooftop billboards and the first three skyline signs.
- Clips in `media/video` plus everything Palm Video Studio makes play muted on the two nearest boards within 70 m.
- The Studio panel turns art and clips on or off. Off restores the original neon.

## Shell
- `shell/services/media.js` serves those folders on `palm-media://` with CORS and byte ranges, so file:// apps can draw them in WebGL and seek audio. Nothing outside the listed folders resolves.
- `window.fracture.media.list(kind)` and `.openFolder(kind)`.
- `media/` is gitignored. Restart Present Palm to load the shell change.

## Web beta
- No folders. The Studio panel takes picked files for the session.

## Tests
- `_test/city-media.test.js` (`npm run city-media`): 20 checks, web and shell paths.
