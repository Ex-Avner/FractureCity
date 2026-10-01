# 0.36.0 — The First Night

The opening film is replaced by a playable prologue. The city gets roles, real weapons, bodies that can be hit, and a Bureau that answers.

Story bible: `apps/fracture-city-game/FIRST-NIGHT.md`. Code: `apps/fracture-city-game/first-night.js`, loaded after `front-menu.js`. It hooks the existing systems by wrapping them. No section of `index.html` was rewritten.

◆

## The Minute (prologue)

- A new story now opens one year before the case, at the Civic Core, at 17:56.
- Five beats: reach the screen, the Fracture at 17:58, the looting of the Armoury, the Wardens' "temporary arrangement," and "Who were you that night?"
- Three choices along the way. Each points at one or two roles, and the class card highlights where they lead. It never locks a role out.
- It ends on "The eve of the anniversary · 18:00." The First Movement then begins as before, with an opening line from you that depends on your role.
- One gold marker and one objective line at a time. There is a "Skip the prologue" link.
- The timeline is now consistent. The Fracture happened one year before the anniversary movement, and the Tenth Movement's minute of silence is for the minute you played.
- A save made mid-prologue reopens at the class card, then starts the case.

## Roles

- Field Witness, Quarry Hand, Tow Driver, Bureau Clerk and Night Broadcaster. Each has its own stats, starting kit and a Q ability: Witness, Break, Hook, Stamp and Correction.
- Netrunner, Operative and Bruiser remain in code so old saves load with their old kit.
- Free roam and Daily Shift now use the same five-role card.

## Weapons

- There are thirteen weapons across the three existing slots.
- Melee: Bureau Baton, Box Cutter, Crowbar, Pipe Wrench, Quarry Pick, Fire Axe.
- Sidearm: Service Revolver, Compliance Pistol, Nail Gun, Flare Pistol.
- Long gun: Double Barrel, Riot Shotgun, Hunting Rifle.
- Weapons lie in the streets, in about one block in four. Placement is seeded per city, and a weapon you take stays taken. Forge and Flood Gate lean toward the rare ones.
- R takes a weapon. It replaces what is in that slot, and your old weapon is dropped at your feet.
- Wardens drop Bureau weapons.
- Recoil, sound, mods and the HUD all still work. The HUD names the weapon actually in each slot.

## Bodies and heat

- Everyone can be hit: street crowds, shop keepers and patrons, the three echoes, and staged scene casts.
- Hits cause a flinch, knockback, damage numbers and blood. People can be knocked down and killed. Bodies stay until their block unloads.
- Most people run. Some fight back.
- Story people (the echoes, the scene cast, and the people in the prologue) are knocked down, never killed.
- Witnesses report. A crime is pending for three seconds, and if anyone who saw it is still standing, the Bureau hears. Unprovoked gunfire near people counts as a crime.
- Bureau Attention shows as five diamonds. It sends Compliance Wardens, then drones, then heavies. It cools after 25 quiet seconds. Dying clears it, for a fine.
- At zero heat, Wardens walk the beat and ignore you.
- The Clerk, and anyone who gave the Wardens their real name in the prologue, gets one free warning.

## Street life

- People bark when you bump them, greet you, and look at you when you are close and still. Some lines depend on your role.
- Ned's street commentary holds off until the prologue ends.

## Verification

- `npm run first-night` is a new suite with 47 checks. It plays the prologue front door to First Movement, then covers pickups, hitting and killing a civilian, witness reports, heat, Wardens, all five abilities, all thirteen weapons, and save/restore of class, loadout and heat. All pass.
- The existing suites all pass: `boot` (21), `campaign` (15, 54 routes) and `web` (17). The hosted build ships `first-night.js`.
- **Not verified:** how any of this feels in play. Everything ran in a cloud sandbox on a software renderer at a few frames a second. Nobody has played it with a mouse.

## Known gaps

- Shop keepers and patrons flinch, go down and die, but do not run or fight back. The shop system owns their movement.
- Cars do not hit pedestrians.
- Campaign characters like Ned, Clara, Marcus and Daniel are portraits, not bodies in the world, so they cannot be hit.
- There is no reload. Ammo is a pool per slot, as before.
- The prologue's lines are placeholder craft. They are consistent with the campaign, but the author should rewrite them in his own voice.
