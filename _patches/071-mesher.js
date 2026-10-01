// =============================================================================
//  FCMesh — the greedy voxel mesher, lifted out of index.html unchanged
// -----------------------------------------------------------------------------
//  This is the first file extracted from the single-file build, chosen because
//  it is the easiest one to prove innocent: the algorithm had exactly two free
//  names in the whole body, `isSolid` and `B_AIR`, and exactly one call site.
//  Both are now parameters. Nothing else about it has changed, deliberately —
//  `_test/mesher-golden.js` records a digest of its output before the move and
//  the same digest has to come back after it.
//
//  No imports, no globals read, no THREE, no DOM. It can be loaded before
//  anything else, and it is the piece that can move to a Web Worker later
//  without being rewritten, which is what the comment above it in index.html
//  has claimed since it was written.
// =============================================================================

(function (root) {
  'use strict';

  //  Merges coplanar runs of identical blocks into single quads. A flat 16x40
  //  tower wall collapses from 640 quads to ~1. Returns plain quad records so
  //  the caller owns all THREE.js concerns.
  //
  //    dx, dy, dz  volume dimensions in cells
  //    getAt       (x, y, z) -> block id; out of range should answer air
  //    isSolid     (id) -> bool; drives both collision and face culling
  //    airId       the id that means nothing is here
  function greedy(dx, dy, dz, getAt, isSolid, airId) {
    const AIR = airId;
    const dims = [dx, dy, dz];
    const quads = [];
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3, v = (d + 2) % 3;
      const x = [0, 0, 0], q = [0, 0, 0];
      q[d] = 1;
      const mask = new Int32Array(dims[u] * dims[v]);
      for (x[d] = -1; x[d] < dims[d];) {
        // Build the mask for this slice: +id = face pointing +d, -id = pointing -d
        let n = 0;
        for (x[v] = 0; x[v] < dims[v]; x[v]++) {
          for (x[u] = 0; x[u] < dims[u]; x[u]++, n++) {
            const a = x[d] >= 0 ? getAt(x[0], x[1], x[2]) : AIR;
            const b = x[d] < dims[d] - 1 ? getAt(x[0] + q[0], x[1] + q[1], x[2] + q[2]) : AIR;
            const sa = isSolid(a), sb = isSolid(b);
            mask[n] = sa === sb ? 0 : (sa ? a : -b);
          }
        }
        x[d]++;
        // Greedy-merge rectangles out of the mask
        n = 0;
        for (let j = 0; j < dims[v]; j++) {
          for (let i = 0; i < dims[u];) {
            const c = mask[n];
            if (c === 0) { i++; n++; continue; }
            let w = 1;
            while (i + w < dims[u] && mask[n + w] === c) w++;
            let h = 1, stop = false;
            while (j + h < dims[v]) {
              for (let k = 0; k < w; k++) {
                if (mask[n + k + h * dims[u]] !== c) { stop = true; break; }
              }
              if (stop) break;
              h++;
            }
            x[u] = i; x[v] = j;
            const du = [0, 0, 0], dv = [0, 0, 0];
            du[u] = w; dv[v] = h;
            quads.push({ p: [x[0], x[1], x[2]], du, dv, d, back: c < 0, id: Math.abs(c) });
            for (let l = 0; l < h; l++)
              for (let k = 0; k < w; k++) mask[n + k + l * dims[u]] = 0;
            i += w; n += w;
          }
        }
      }
    }
    return quads;
  }

  root.FCMesh = { greedy: greedy, version: 1 };

})(typeof window !== 'undefined' ? window : globalThis);
