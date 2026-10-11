# Your collection — v0.48

Open B → Fine art & interiors → Your collection. Select the parts you made, enter a design name, and choose Keep selected pieces. The collection is shared by saved cities in this browser or Present Palm app; it is not cloud sync. Export a collection backup to transfer devices, and import it to append designs without replacing existing entries.

Place copies stages the entire design for the next click or tap on a city floor or wall in the editor's live viewport. Turn design rotates the complete arrangement 90 degrees. The contact offset uses the rotated geometry bounds so the whole design touches the surface. Copies receive fresh identifiers and a new group, remain editable, and undo as one action. Finish placing returns to selection. Fine artwork remains decorative; structural walls, doors and stairs provide collision.

Align bottoms and centre X/Z move each selected group as one item. Even gaps keeps the outer bounds and spaces three or more pieces/groups by their edges; arrangements without room for non-overlapping gaps are rejected. Every successful operation participates in the existing undo/redo and city persistence.

The collection supports 32 designs, 400 parts per design, 6,000 total parts and a 2 MB data limit. JSON imports use the existing art validation before making any changes. Collection writes are serialized and the displayed saved collection updates only after a successful persistence result. Rejected promises and explicit false failure results are surfaced; failed writes retain the previous collection. Artwork saves also recognize explicit false results and remain pending for retry.

In Makers' Mile, the Atelier shows the next commission and its current counts from actual objects in Studio 01. Saved designs alone do not earn commissions; placed work does. These are completion requirements, not an assessment of artistic merit.

Verification: `_test/art-collection.test.cjs` covers UI save/placement, rotated floor and wall bounds, full page reload, cross-city reuse, copy independence, grouping/spacing, invalid imports, concurrent writes, failed writes and mobile touch interaction. `_test/city-art.test.cjs` checks existing authoring controls and image export.
