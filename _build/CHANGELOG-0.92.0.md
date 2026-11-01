# Fracture City 0.92.0: The Backlot, and three things moved out of the way

## The Backlot: the Soundstage gets a face

The Soundstage shipped in 0.88 as a button at the bottom of the Tools tray and an F9 key, so nobody found it. It now has a building.

- **Soundstage 1.** A film-stage hangar on the two blocks south of the Church of Omnism (chunks 3..4 × 2), across the road from it. It has:
  - a sign over a wide north door;
  - an ON AIR lamp that lights while you film;
  - a white cyclorama along the back wall;
  - ceiling light panels and two work lights;
  - a camera on its tripod and a director's chair.
- **The prompt.** Walk to the camera and press E, or tap the prompt, to direct a scene. The hangar floor is a set you can block scenes on.
- **First visit.** A one-line note says what the lot is for.
- **Tools.** The Soundstage entry now leads the tray, with an accent and a clearer label: "Soundstage · direct and film a scene (F9)".
- **Lights.** The two work lights are always in the scene. Outside the area they fade to zero instead of hiding, so the scene's light count never changes. A changing count is what used to stall the Lantern Hall.
- **The roof.** It is a mesh, not blocks. Blocks under a block roof see no sky and render black.

## Hidden until ready

These three were marked Hide in *Fracture City: The Map of Fragments*:

- **City PvP is opt-in.**
  - It is off by default. Switch it on in Tools under "PvP with other players"; the choice is remembered.
  - The server only lets a hit land when both the shooter and the target have switched it on. Otherwise it answers `pvp-off` or `target-off`.
  - Shooting zombies and NPCs is unaffected.
- **The older Cast Studio is developer-only.** Its Tools button and F6 now appear only with the developer flag. Characters already made with it still appear in the city. The wardrobe and the casting booth are the player-facing tools.
- **The Backroom editor is developer-only.** Its arcade cabinet and its Tools button appear only with the developer flag.

## Developer flag

`dev-flag.js`:
- Add `?dev=1` to the address to turn it on; it is remembered.
- `?dev=0` turns it off.
- `FC_DEV.set(true)` in the console also works.

## Tests

- New: `_test/backlot.test.cjs`.
- Updated:
  - `server/economy.test.cjs`: PvP is opt-in on both sides.
  - `_test/backroom-integration.test.cjs`: turns the developer flag on.
