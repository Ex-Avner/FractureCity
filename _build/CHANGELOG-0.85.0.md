# Fracture City 0.85.0 · Phone HUD and a test sweep

## Phone HUD
- One layout for touch screens, portrait and landscape. Top left: the
  chips, then the online pill, then your current goal. Top right, one
  column: minimap, Tools, the inbox bell. Before, the online pill sat on
  top of Tools and the minimap, and the goal ran under the pill.
- Prompts no longer stack on top of each other. E prompts, talk, arcade,
  build and art buttons, Ned's open call and its Later button are placed
  one above the other, above the thumb controls in portrait and between
  them in landscape. Later sits beside the invite instead of over the E
  prompt. When there is no room the least urgent waits until the one
  below it goes. The same stacking applies on desktop.
- The chip row scrolls sideways when it is wider than the screen instead
  of running under the minimap.
- The opened online panel fits the screen and scrolls; in landscape its
  bottom used to fall off the screen.
- Toasts on phones sit in the free space: top centre in landscape, under
  the goal in portrait, instead of over the minimap and Tools.
- The top-left "Q · ability" label is hidden on touch; the Q button by
  the controls already shows it. Tools reads "Tools" on touch (no F2).

## Fixes
- The PvP health bar showed all the time, full at 100, even in safe
  zones, because its hidden flag was overridden by its own style. It now
  appears only when you have taken damage.
- Joining the city on a slow phone or network: the join now waits up to
  25 s and retries by itself up to five times ("Entering the city… (try
  2)") instead of stopping at "Could not enter city". A refusal (full,
  removed, signed out) still stops at once.
- A phone still building the city after joining tells the server it is
  there, and an open connection counts as present for up to three
  minutes. Before, a page busy for 45 s was dropped and saw "Session
  ended".
- After arriving, your art and building plot load with longer timeouts
  (30 s instead of 8 to 10) and are retried up to three times. On a slow
  phone a single timed-out load used to leave the plot unusable ("The
  user aborted a request") until a reload.
- When the server has let your session go (the phone slept, or the page
  was busy for minutes), the city rejoins once by itself instead of
  showing "Session ended". A second loss within two minutes, a removal,
  or a sign-in elsewhere still ends the session.
- Opening the art workshop dropped whatever you had selected about a
  tenth of a second later (the 0.81 hotbar reset it on entering build
  mode), so "Keep selected pieces" and other selection tools found
  nothing. Only changing the held item clears the selection now.
- Gallery boards (Common Ground walls): the board's buttons were rebuilt on
  every refresh, so a tap could land on a button that had just been
  replaced and do nothing. They are now rebuilt only when something on
  the board changed.
- Four things stood across Common Ground's walks: the Oh No Ned cabinet
  on the north-south walk at x 177 (moved 4 m east); on the
  garden-to-court walk at x 167, the Casting Booth's east wall (booth
  moved 1 m west) and the Bad Weather cabinet (moved 2 m west); and the
  Toilet Heads cabinet on the east approach at z 27 (moved 3 m south).
- The First Night prologue (the Minute) stays playable for saves made
  inside it; it is now started through FN.startMinute.

## Tests
- Old tests updated to the current game: eleven arcade cabinets, native
  phone width (no 980 layout), the 4,000-piece art limit, the bulletin
  front door, the account flow that returns to the lobby after saving
  the recovery key, and the Backroom in Tools.
- New: _test/phone-hud.test.cjs (portrait and landscape overlap and
  on-screen checks in the online city), server/still-here.test.cjs.

## Server
- POST /api/still-here (no-op presence ping). Idle sweep: 45 s without a
  request, or 3 minutes while the event stream is open.

## Still failing in the cloud test sandbox
- mobile.test.js drawer key checks, dispatch-browser side-quest count,
  common-ground-campus (timeout), netlify-mobile arcade timing, and the
  first-night heat checks. The sandbox renders in software on two cores,
  so most of these are timing; mobile drawer and dispatch side quests
  need a look next release.
