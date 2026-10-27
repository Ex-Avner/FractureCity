# Fracture City 0.84.0 · Big plots and a fresh map

## Building plots, six times bigger
- Each of the twelve plots is now 20 x 20 blocks (was 8 x 8) and 24
  blocks high (was 16). Each plot holds up to 6,000 blocks and 150 doors.
- The building yard grew from 2 x 2 city blocks to 4 x 3 (x 192-288,
  z 48-120), one plot per block with a paved walkway round each pad. It
  joins Common Ground on its south-east corner.
- The whole yard is a safe zone (no PvP, no trouble NPCs), like Common
  Ground.

## The map is cleared
- On its first start, 0.84 clears every resident's plot building and city
  art (furniture, sculptures, signs, murals) in every city, including the
  test builds nobody could remove. Old structures would not fit the new
  plots anyway.
- Nothing paid for is lost: placed workshop blocks and furniture go back
  into each resident's inventory.
- Accounts, wallets, wardrobe looks, the feed, gallery boards, profiles and
  notifications are kept.
- Before clearing, the server writes a full copy of the database to the
  backups folder (before-world-reset-2-<time>.sqlite). The reset runs once;
  later restarts skip it.
- Plot ownership resets too: everyone claims a plot again when they enter.
