# The Seam · 0.65

Walk east from Common Ground (follow the sign "THE SEAM →"), about 70 m past
Makers' Mile. The Ledger is the lit shed on the road side.

- Beds: walk up, press E (or tap the prompt). 1 to 4 plants. E harvests.
- The Ledger (E at its counter): Market, Build, Creatures, Almanac, While you
  were away.
- Night: Misprints come out of the crack while you are in the Seam. Shoot
  them. Wards do it for you.
- Creatures: walk up to one and press E to feed it the crop it loves.
- State: localStorage key fc-seam:<username>. window.FCSeam exposes the API
  used by _test/the-seam.test.cjs.

Layout (world blocks): district x 240..288, z 0..48; beds, ward slots and the
fissure path are constants at the top of the-seam.js. Their order is a save
format. Do not reorder them.
