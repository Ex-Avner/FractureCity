# The Outbreak

Story bible for 0.37.1. Code: `outbreak.js` (campaign, stations, counter) and `first-night.js` (prologue). This replaces the old twelve-movement case. The weapons, heat and class systems in `FIRST-NIGHT.md` are unchanged.

◆

## The premise

Ned Halloran is FCN's anchor, and he is a computer. He has read the six o'clock for nine years without missing one. At 17:58 tonight he threw an error mid-bulletin. Every screen said one sentence, every listener heard a different one, and one hundred people heard a line that was not meant for people. They are the Turned.

Ned is broken in five places. Five citizens can each fix one of them, at one spot in the city, if somebody keeps the Turned off them. That is you.

The Bureau of Narrative Mitigation sent the sentence. It was a test file: could a city be made to hear what it was told? It could not. The Bureau calls the outbreak a temporary arrangement and asks for forms throughout.

## Ned's voice

Dry, precise, professionally calm about things that are not calm. He reports on his own malfunction as news. Each chapter's fault shows in how he talks, and the fix shows in the next chapter's intro.

## Structure

One night. A prologue, then five chapters. Exactly twenty of the Turned per chapter, one hundred in all. The counter under the clock only goes down.

| Chapter | Time | Ned's fault | Citizen | Station |
|---|---|---|---|---|
| Prologue: The Six O'Clock | 17:56 | The error | The armoury keeper | Civic Core crossroads |
| 1 · The Clock | 18:10 | Stuck at 17:58 | Rook | The relay at the crossroads |
| 2 · The Voice | 20:30 | Words from the wrong drawers | Inez | South Signal mast, Lot 09 |
| 3 · The Memory | 23:00 | Forgets everyone ("Good evening, Gerald") | Leon | FCN archive under the Residue Room |
| 4 · The Form | 02:40 | Licence suspended, everything "pending review" | Daniel, with two Wardens observing | Window Three, the Bureau |
| 5 · The Six O'Clock | 05:40 | Needs one clean signal to everyone at once | Marcus and Clara | FCN transmitter |

The reveal lands at the end of Chapter Three: the Bureau's test file caused the error. Chapter Four puts you at the Bureau to fix what it broke. Chapter Five ends with the first bulletin since 17:58 that everybody hears the same.

## How a chapter plays

1. Intro dialogue. Ned's current fault, the citizen, where to go.
2. Reach the station (gold marker).
3. Complete the chapter’s field work and defend the repair. The bar fills while you are within 22 m and none of the Turned are within 6 m of the station. Either condition pauses it, and the HUD says which.
4. The Turned arrive in four waves as the repair passes 0, 25, 50 and 75 percent: 20 in all. Specials (stalker, spitter, howler, husk) come later in the night and late in each chapter.
5. The chapter closes when the repair is done and all twenty are down.

## Rules that keep the count honest

- Only the Turned spawned by a station count. They are flagged `obStory`.
- While the story runs, the city spawns no ambient infected. Ambient trouble is human (thugs, drones, heavies). Any ambient infected already loaded are cleared.
- Anything stuck behind a wall for six seconds is moved to open ground near you.
- A save keeps the repair percentage and the kills. On load, the station respawns only the Turned not yet put down.
- A save from the old campaign restarts at Chapter One with the city kept.

## The cast

| Who | Tonight |
|---|---|
| Ned Halloran | FCN's automated anchor. Broken in five places. |
| Rook | Runs the relay at the crossroads. Says things can be fixed. |
| Inez | South Signal mast. Hates Rook, which is how you know she is good. |
| Leon | Tow 12. Brings the battery. |
| Daniel | Window Three. Files the reinstatement while the Turned press on the glass. |
| Marcus Vale | City mains, night crew. Powers the tower. (No longer a quarry worker.) |
| Clara Vale | Runs the night shop. Open since 17:58 because nobody told her to close. |
| Compliance Wardens | The Bureau. Observe, file, never help. |

## Classes

Unchanged except the Quarry Hand is now the **Utility Hand** (Marcus's world, city mains). The Quarry Pick is now the **Sledgehammer**. The internal key stays `quarry` so old saves load.

## Ned's kept jokes

From the old script, kept or lightly adapted: the clock above the chemist; "I am on your wall. There is a difference, and you signed it"; corrections as a free service; raw feed is four hours of a door; "The Bureau has asked for a form"; nobody comes out of intake as the same file; Municipal Recovery vehicles resemble whatever car you can get into; unscheduled miracles are worse to insure; one person reached another person; "nobody's fault"; the cup of tea; "Try not to die. The paperwork is appalling"; "at six o'clock there is me"; "Quiet night in the district. Nothing to report."

## Archived source

The old campaign's text is still in `index.html` (`LEGACY_CAMPAIGN`, the original `CAMPAIGN` literal, the Window Three and Vale panels). `outbreak.js` replaces the chapter list at load; `campaign-polish.js` replaces the field journal and legacy story-person panels. Removing it is a separate cleanup.


## Field work and readable progress (0.37.1)

| Chapter | Player action |
|---|---|
| Clock | Hold E at both street breakers. |
| Voice | Tune the mast to 89.7. Wrong selections allow a retry. |
| Memory | Carry the battery to the archive socket; carrying limits sprint speed. |
| Form | Recover the records and select the original BNM 17:58 test file. |
| Six O’Clock | Reroute three feeds at 25%, 50% and 75% repair progress. |

A gold target and a contextual instruction identify the current action. J opens the five-chapter field journal. Chapter completion cards explain what was restored. Checkpoint confirmation appears only after saving succeeds. Field progress uses the existing campaign save; old completed stations remain completed.

## Movement and equipment

V switches first/third person. Characters bend knees and elbows, shift their torso while moving, and crouch/balance on the skateboard. The deck is 0.84 m long and 0.236 m wide and follows the player in world space. Weapons have modeled grips, barrels and distinguishing parts, with hand attachments and first-person sway/recoil. Umbrellas attach to the hand and stay upright. Melee enemy attacks have a visible wind-up; stepping away avoids the committed hit and landing a hit interrupts it.

## Zombie combat refresh — 0.54

Infected use a single grounded pursuit controller with bounded, cached obstacle routes. Siege and story infected keep hunting around corners; attacks still require a clear lane and have interruptible wind-ups. The zombie definition now includes an explicit body height. Phones face their owner's head and remain anchored to the left palm; the right arm stays free to attack. Stride follows real displacement.

Shift+Z starts the optional horde mode. Four infected arrive initially, with a living cap rising from 10 to 28. Pick up the nearby salvage weapons using R (or the mobile Take control): Parking Enforcer cleaves at close range, Comment Section chains a stunning arc through up to four visible targets, and Public Nuisance pushes a cone of enemies away. Weapon selection uses the existing 1/2/3 and touch slots. Ordinary pickups also include these weapons. Every six siege kills restore eight health and some equipped ammunition. The compact mode display tracks waves, short kill chains and the next resupply. Stopping removes all siege variants.

New procedural details include cracked phone feeds, stitched patches, torn hems, hardware and varied clothing palettes. This remains the game's procedural character style, not photorealistic scanned art.
