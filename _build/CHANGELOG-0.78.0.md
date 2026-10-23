# Fracture City 0.78.0 · Build mode overhaul

## The problem
Building needed the mouse captured, but every build control was an on-screen
button that needed a cursor, so the hotbar could never be clicked and every
other bar cost Esc, click, click again. Five tool modes changed what the mouse
did with nothing on screen saying which was active. Six entry points led to
the catalogue while the room panel and plain blocks were buried. Four undo
systems, none for plain blocks. G, T, [ ] and Z meant different things by
mode. Seven bars and pills stacked at the bottom of the screen in five styles.

## Cursor build mode (desktop)
- B frees the cursor. Every tool aims at what the mouse points at: blocks,
  room pieces, furniture and art selection all share one aim (fcAimDir).
- Right-click places. Hold left removes (or selects art). Right-drag or
  middle-drag looks around. WASD still moves. Moving the mouse alone never
  turns the view.
- Esc steps back one stage: stop placing, clear the selection, leave build.
  Leaving hands the mouse straight back to the view.
- No lock overlay, no crosshair, the held weapon is put away while building.

## The dock
- One dock replaces the hotbar, the room-kit bar, the launch pills and the
  furniture placing bar. Tabs: Blocks, Room kit, Furniture, Atelier. The
  active tab is coloured, so the mode is always visible.
- Blocks: nine clickable slots with swatches and counts.
- Room kit: piece and finish steppers, Turn, All pieces (opens the room
  panel directly).
- Furniture: Browse objects; while placing, Place here, Turn, Cancel; with a
  selection, Delete and Deselect.
- Atelier: opens the editor; the dock steps aside and returns on close.
- Always there: Undo, Redo, Supplies (unlimited or inventory), Done. One
  hint line says what the mouse does in the current mode.
- One undo: Ctrl+Z / Ctrl+Y and the dock buttons route to the active tool.
  Plain blocks now have undo (60 steps). With inventory supplies, block undo
  is refused so materials cannot be minted or lost.
- Supplies has one name everywhere.
- The Common Ground pills, ability pill, arcade prompts and weapon HUD hide
  while building.

## Panels
- The room panel, Atelier, furniture catalogue and the selection bar share
  the dock's colours, buttons and type.
- The Atelier's sixteen loose buttons are four labelled groups: View, Edit,
  Library, Save & share.

## Phones
- The dock sits at the top and scrolls sideways.
- Tap the world to place at that spot (or select art). Drag still looks; the
  PLACE and MINE buttons still aim at the centre.
- The back button closes the room panel, Atelier and catalogue.
- The goal banner and Tools pill hide while building.

## Tests
- New _test/build-dock.test.cjs: free cursor and no overlay; plain moves do
  not turn the view, right-drag does; dock slots click; right-click places
  under the cursor and nowhere else; Ctrl+Z, Ctrl+Y and dock undo for blocks;
  no block undo with inventory supplies; room kit steppers, placement and
  undo; furniture from the dock, placement, Esc, undo; grouped Atelier;
  Esc leaves; phone dock position and tap-to-place.
- city-build, furniture and ledger-touch tests now drive the dock instead of
  the retired bars.
