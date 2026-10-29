# Fracture City 0.88.0 · Soundstage

A timeline for filming scenes with characters, anywhere in the city. Open it
from Tools (Soundstage · film a scene) or press F9; Esc closes. The game
pauses and the stage takes the camera.

## Cast and blocking
- + You adds a character in your own look; + Actor adds one with a crowd
  look (New look rerolls it). Each is placed where the crosshair points
  and faces the camera; Move mark to crosshair re-blocks them.
- Each actor has four lanes:
  - Move: walk or run from where they are to the crosshair, eased in and
    out, turning to face the way they go; optional facing at the end.
  - Action: 26 gestures and poses, blended in and out: talk with hands,
    point, wave, shrug, arms crossed, hands on hips, facepalm, nod, shake
    head, look around, on the phone, smoke, cheer, clap, punch, kick,
    fight stance, startled, cry, think, dance, lean, sit on a seat, sit on
    the ground, kneel, lie on back.
  - Look: head (and a little torso) turns to another actor, the camera or
    a point.
  - Line: load your recorded audio (or drop the file on the lane); it
    plays in sync and the mouth follows its loudness. Without audio the
    mouth moves for the clip's length.
- Walk and run cycles come from the distance covered, so feet match the
  ground. Blinks and breathing run under everything.

## Camera
- Fly a free camera: drag to look, WASD, Q/E down and up, Shift faster,
  wheel for the lens.
- ◆ Key camera (K) stores the view at the playhead. Keys glide into the
  next one (ease, linear or hold) unless marked Cut. Lens and a handheld
  amount per key. View: shot (V) looks through the keyed camera.
- Frame guides: 2.39:1, 1.85:1, 1:1, 9:16.

## Timeline and takes
- Clips sit at the playhead and can be dragged and resized (snapped to
  1/24 s). Space plays, Home goes to the start, arrows step a frame
  (Shift: a second), Delete removes.
- Every frame is worked out from the playhead alone, so scrubbing and
  replays land exactly. Loop for rehearsal.
- Clean play (H) hides every panel and plays from the start for capture
  with OBS.
- Crowd hidden by default (city crowd, shopkeepers, NPCs, other players);
  time-of-day slider for the scene.

## Saving
- Scenes save on this device as you work; Open scene… switches between
  them. Audio is kept in the browser's database.
- Export writes a .fcscene.json with the audio inside; Import brings it
  back on any device.

## Limits in this first version
- Real-time playback only (capture with OBS). Facial expressions,
  hand-held props, seats and set dressing are not in yet; sit poses
  assume a seat about knee height.

## Tests
- New: _test/soundstage.test.cjs.
