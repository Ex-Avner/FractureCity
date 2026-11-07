# Ashbound and the mythic shelves

## Ashbound

Fictional underworld minions inspired by the requested Hades aesthetic: ash-black shrouds, skeletal ribs, broken bronze crowns, clawed hands and ember eyes. The game names them on their first encounter and explains their gaze mechanic.

They emerge from supported open ground in pairs, between 19:30 and 05:30 game time. One encounter holds at most two enemies. The first spawn attempt occurs after twenty seconds of eligible play; subsequent pairs have a hundred-second cooldown after the previous pair is gone. Failed placement retries after twelve seconds. Existing loaded terrain, body clearance and an open-sky test constrain placement. They do not spawn inside buildings or on elevated roofs.

A creature freezes when a visible head, torso, shoulder or foot sample lies within the camera view, including a small edge margin. Opaque world geometry blocks sight. Its position, emergence, limb animation and attack clocks stop; turning toward it cancels an attack wind-up. Each member of the pair is checked separately. First-person and the existing shoulder camera are supported. Looking away allows its 2.4-second emergence or slow pursuit to resume. An unseen enemy must be close, at a similar height, and have a clear lane before a 0.65-second attack wind-up can deal ten damage. Attacks have a 1.8-second cooldown.

They have 65 health and award twenty credits once when defeated. They use the existing weapon hitboxes and wallet earning path. Daylight, Peaceful mode, or entering the Church of Omnism, Common Ground or building yard removes the encounter. Pausing, dialogue, inventory, minigames and building suspend AI. Scene changes and distant encounters clean up their actors.

These are local encounters, like the existing client-side hostile population: each player has their own pair, gaze checks and combat. They are not server-synchronized NPCs. Their fictional nature is explicitly distinguished from the historical readings in the church.

Static model parts are merged and cached by articulated bone. There are no new shadow maps, dynamic lights, network requests or per-frame save writes. Visibility uses collision samples, not GPU occlusion queries; it is intentionally forgiving at screen edges.

## Church of Omnism

Two new reading stands sit on the inner north/south axis. Existing ten lecterns retain their positions. Walk up and press E or tap the reading prompt; both shelves also appear in the central Guide and library navigation.

- **Greek Mythic Poetry:** Hesiod’s complete *Theogony* and the complete *Homeric Hymn to Demeter*, translated by Hugh G. Evelyn-White (1914), Project Gutenberg ebook 348.
- **Norse Mythic Poetry:** the complete *Völuspá* (66 stanzas) and *Hávamál* (165 stanzas) from Henry Adams Bellows’s *Poetic Edda* translation (1923), Project Gutenberg ebook 73533. These are selected complete poems, not the entire Edda.

English texts ship with the game. No external request is needed while reading. Translator commentary and footnotes are omitted; original paragraph/line references and stanza text are retained. Reader pages contain twelve paragraphs or stanzas and do not claim to reproduce original chapter divisions. Edition, source and public-domain attribution appear in the Guide. `scriptures/mythic-sources.txt` records source URLs, HTML checksums and the source distribution license.

Rebuild the new shelves with `python3 _build/build-mythic-library.py RAW`, where RAW contains `greek.html` and `norse.html` downloaded from:

- https://www.gutenberg.org/files/348/348-h/348-h.htm
- https://www.gutenberg.org/files/73533/73533-h/73533-h.htm

The full scripture builder also calls this builder and checks both source files before clearing its output. The existing public-asset packaging includes the new readings and script automatically.

## Verification

The browser regression covers pair limits, frozen and resumed emergence, independently watched enemies, first/third-person observation, wall occlusion, frozen animation, attack cancellation, damage, duplicate kill rewards, daytime and Peaceful spawn rejection, sanctuary protection and cleanup at dawn. It also checks both shelves, all Norse stanza counts, reader navigation, Escape and phone-width layout.

Deploy the client assets to make this update available on the hosted game. A GitHub push does not itself deploy the Render service when its automatic deployment remains disabled.
