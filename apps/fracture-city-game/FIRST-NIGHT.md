# The First Night

Story bible for v0.36.1. Code lives in `first-night.js`. This file is the reference for anyone extending the prologue, classes, weapons or heat.

◆

## The premise, in one line

At 17:58, one year before the case, every screen in Fracture City said the same sentence, and every person heard a different one. That minute is called the Fracture. The city has not agreed on anything since.

## Timeline

| When | What |
|---|---|
| Nine years before | Ned Halloran's six o'clock bulletin begins. It never misses an evening. |
| One year before the case, 17:56 | The prologue. You are on the street at the Civic Core, two minutes before the evening bulletin. |
| 17:58 | The Fracture. Ned's pre-roll plays on every screen. Each listener hears a different sentence. The only line everyone hears the same: "Back after a short break." |
| 17:59 to 18:30 | The first night. Looting, the Turned in the side streets, the Bureau's first Compliance Wardens declare a "temporary arrangement." |
| The eve of the anniversary, 18:00 | The First Movement. You wake in Residence 14. Ned is on your wall. The campaign runs from here, unchanged. |
| The anniversary, 17:58 | The Tenth Movement. The city keeps sixty seconds of silence for the minute you lived through in the prologue. |

The thesis the whole game already carries: everyone here was told it was temporary. The prologue is the moment they were told.

## The prologue: THE MINUTE

Five beats, on foot, about eight minutes. Every beat has one gold marker and one objective line.

1. **17:56 · The Civic Core.** Card, then control. Objective: reach the FCN screen at the crossroads. Ned's pre-roll murmurs from the tower.
2. **17:58 · The Fracture.** The screen flares, the sky shifts, the city holds its breath. Three strangers near you repeat what they heard, and none of it matches. Choice one: *the first second*.
3. **17:59 · The Break.** A looting crew hits the armoury's shutters. A keeper is on the ground. There is a weapon in the street. Objective: take it (R), deal with the crew. Hitting a bystander teaches heat. Choice two: *the keeper*.
4. **18:04 · The Arrangement.** Two Compliance Wardens arrive to file the night. Choice three: *your name*. It sets your standing with the Bureau.
5. **18:06 · Who you were.** Ned's last shared line. The class card, with the role your three choices point to already highlighted. You can pick any of the five. Then: "The eve of the anniversary · 18:00" and the First Movement begins.

### The three choices

Each option points at one or two classes. The class card highlights the leader. It never locks you out.

| Choice | Options (class affinity) |
|---|---|
| The first second | Hold on to the nearest stranger (Witness, Broadcaster) · Write down exactly what you heard (Clerk, Witness) · Put your back to a wall and your hands up (Quarry Hand) · Run for the tow yard, there are vehicles (Tow Driver) |
| The keeper | Pull the keeper out and take the blows (Quarry Hand, Tow Driver) · Get everyone's account before it changes (Witness) · Broadcast it: say what is happening, loudly, to everyone (Broadcaster) · Log it for the Bureau and step back (Clerk) |
| Your name | Give it, spelled correctly (Clerk; Bureau standing +) · Give a wrong one (Broadcaster; Bureau standing -) · Ask them what "temporary" means (Witness) · Say nothing and walk (Tow Driver, Quarry Hand; Bureau standing -) |

## The five roles

Built from the people already in the campaign. The old Netrunner, Operative and Bruiser remain in code for old saves only.

| Class | Whose world | HP | Speed | Starting kit | Q ability |
|---|---|---|---|---|---|
| **Field Witness** | Yours, the campaign's canonical role | 100 | 6.6 / 11.2 | Box Cutter, Service Revolver | **Witness.** For eight seconds every person and threat within 45 m shows through walls. Your heat cools twice as fast. |
| **Quarry Hand** | Marcus Vale, Quarry 4 | 175 | 5.6 / 9.4 | Quarry Pick, Nail Gun | **Break.** Slam the ground: heavy damage and knockback to everything within 4.5 m. |
| **Tow Driver** | Leon, Tow 12 | 115 | 6.9 / 11.6 | Crowbar, Flare Pistol, Double Barrel | **Hook.** Drag the nearest threat within 18 m to your feet, staggered. |
| **Bureau Clerk** | Daniel, Window Three | 80 | 7.2 / 12.4 | Bureau Baton, Compliance Pistol | **Stamp.** A stop order: every threat within 25 m freezes for five seconds. Wardens give you one extra warning. |
| **Night Broadcaster** | FCN, Ned's people | 85 | 7.8 / 13.2 | Box Cutter, Service Revolver, Hunting Rifle | **Correction.** A broadcast burst: calms civilians within 30 m, drops one level of heat, and staggers threats within 15 m. |

## Weapons

Three slots, same keys as before (1 melee, 2 sidearm, 3 long). A slot holds one weapon at a time. Walk near a weapon in the street and press **R** to take it. It replaces what is in that slot, and the old one drops where you stand.

| Slot | Weapon | Character |
|---|---|---|
| 1 | Bureau Baton | Standard issue. Quick, forgiving. |
| 1 | Box Cutter | Fastest swing, lowest damage. |
| 1 | Crowbar | The honest middle. |
| 1 | Pipe Wrench | Slow, heavy. |
| 1 | Quarry Pick | Slowest, longest, hits like stone. |
| 1 | Fire Axe | Rare. Two hits for most people. |
| 2 | Service Revolver | Six shots of real stopping power. |
| 2 | Compliance Pistol | Bureau sidearm. Fast, accurate, light. |
| 2 | Nail Gun | Site tool. Fires as fast as you click, short range. |
| 2 | Flare Pistol | One heavy, slow shot. |
| 3 | Double Barrel | Brutal up close. |
| 3 | Riot Shotgun | Bureau issue. Faster pump, wider spread. |
| 3 | Hunting Rifle | Slow, precise, long reach. |

Weapons are found: about one block in four has something lying in it (a bin, a doorway, a dropped bag). Wardens drop Bureau weapons. Rare weapons (Fire Axe, Hunting Rifle) turn up mostly in the Stone and Unfinished districts.

## Everyone can be hit

Every person on the street, in a shop, and at the crossroads takes damage, flinches, gets knocked back, and can go down.

- **Civilians** have 40 HP. Most run. Some fight back (dockers, drifters, keepers). A body stays where it falls for a minute.
- **Story people** (the three echoes, anyone in a staged scene) are never killed. They are knocked down, get up after a few seconds, and the Bureau notices.
- **Witnesses report.** A crime is only pending for three seconds. If anyone who saw it is still standing, the Bureau hears about it. If nobody did, it did not happen, which is the city's whole problem in one mechanic.

## Bureau Attention (heat)

Five diamonds at the top of the screen.

| Level | Response |
|---|---|
| ◆ | One Warden comes to take a statement. |
| ◆◆ | Two or three Wardens, armed. |
| ◆◆◆ | Four Wardens and a Sec Drone. |
| ◆◆◆◆ | Heavies join. |
| ◆◆◆◆◆ | Everything the Bureau has. |

What raises it: hitting a civilian (small), putting one down (large), hitting a story person, killing a Warden, firing a gun near people. What lowers it: 25 seconds with no Warden in sight, then one diamond every 18 seconds. The Witness cools twice as fast. Dying clears it and costs a fine.

At zero heat, Wardens walk the streets on patrol and ignore you.


## 0.36.1 scene contract

The five dramatic beats now use ten ordered scene/action steps in `FN_BEATS`.
Each step publishes its location and objective before it enters, and exits only
when its explicit condition holds. Scene speech uses `FN.scene`, separate from
`Narr` and `Dialogue`; N or the visible Continue button acknowledges one complete
line. World simulation pauses during scene speech and choices. Ambient head
barks remain non-blocking; other narration and tutorial toasts are discarded
while the prologue owns the screen, including the year-later transition card.

The first bulletin is a 17:58 pre-roll, two minutes before the scheduled six
 o'clock news. Ned does not return live; the wall in the case plays a recording.
Choice IDs, affinities, standing changes and saved class IDs remain compatible.
