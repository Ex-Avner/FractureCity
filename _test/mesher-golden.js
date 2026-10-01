//  Golden master for the voxel mesher, plus the two invariants it is supposed
//  to satisfy. Recorded BEFORE the extraction, against the inline
//  implementation; the extraction must not move the digest.
//
//    node mesher-golden.js --record [repoRoot]    write mesher.golden.json
//    node mesher-golden.js          [repoRoot]    compare against it
//
//  What the digest covers: greedyQuads, isSolid, and the solid flags in the
//  BLOCKS registry. A deliberate change to any of those is a behaviour change
//  and is supposed to move the digest. Re-record in its own commit when so.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { Checks, serve, LAUNCH_ARGS } = require('./lib/harness');

const RECORD = process.argv.includes('--record');
const ROOT = process.argv.filter(a => a !== '--record')[2] || path.resolve(__dirname, '..');
const GOLDEN = path.join(__dirname, 'mesher.golden.json');

//  The sampler is synthetic on purpose. Worldgen changes constantly; the mesher
//  should not. A fixed pseudo-random field exercises merging, the six face
//  directions, interior cavities and the volume boundary, and depends on
//  nothing in the city.
const PROBE = `(() => {
  const out = { ok: false };
  try {
    if (typeof greedyQuads !== 'function') { out.why = 'greedyQuads missing'; return out; }
    const IDS = [0, 1, 2, 3, 7, 11, 0, 0];           // mostly air, five solids
    let s = 2463534242 >>> 0;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const D = 24, H = 16;
    const field = new Uint8Array(D * H * D);
    for (let y = 0; y < H; y++)
      for (let z = 0; z < D; z++)
        for (let x = 0; x < D; x++){
          const slab = y < 3 ? 1 : 0;                 // a floor, so faces meet the boundary
          const r = rnd();
          field[x + D * z + D * D * y] = slab ? 1 : IDS[(r * IDS.length) | 0];
        }
    const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= D || y >= H || z >= D)
      ? 0 : field[x + D * z + D * D * y];

    const run = () => greedyQuads(D, H, D, at);
    const q1 = run(), q2 = run();

    //  Canonical record, order included: the mesher's emission order is part of
    //  its behaviour because the geometry builder consumes it in that order.
    const canon = (qs) => qs.map(q =>
      q.p.join(',') + '|' + q.du.join(',') + '|' + q.dv.join(',') + '|' + q.d + '|' + (q.back ? 1 : 0) + '|' + q.id
    ).join(';');
    const fnv = (str, seed) => { let h = seed >>> 0;
      for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return h.toString(16).padStart(8, '0'); };
    const c1 = canon(q1), c2 = canon(q2);
    out.digest = fnv(c1, 2166136261) + fnv(c1, 84696351);
    out.deterministic = (c1 === c2);
    out.quads = q1.length;

    //  A totals check, and only that: summed quad area against the number of
    //  solid/air boundary faces counted directly, with the same
    //  out-of-range-is-air convention the mesher uses. It is a necessary
    //  condition, not a proof that every face is covered exactly once — an
    //  overlap and an omission of equal area would cancel and still pass.
    //  What actually pins the output is the digest.
    let area = 0;
    for (const q of q1){
      const w = q.du[0] + q.du[1] + q.du[2];
      const h = q.dv[0] + q.dv[1] + q.dv[2];
      area += Math.abs(w) * Math.abs(h);
    }
    let faces = 0;
    const solid = (x, y, z) => isSolid(at(x, y, z));
    for (let y = 0; y < H; y++)
      for (let z = 0; z < D; z++)
        for (let x = 0; x < D; x++){
          if (!solid(x, y, z)) continue;
          if (!solid(x+1,y,z)) faces++;
          if (!solid(x-1,y,z)) faces++;
          if (!solid(x,y+1,z)) faces++;
          if (!solid(x,y-1,z)) faces++;
          if (!solid(x,y,z+1)) faces++;
          if (!solid(x,y,z-1)) faces++;
        }
    out.area = area;
    out.faces = faces;
    out.ok = true;
  } catch (e){ out.why = e.message + '\\n' + e.stack; }
  return out;
})()`;

(async () => {
  const c = new Checks('mesher-golden.js — ' + (RECORD ? 'recording' : 'comparing'));
  const site = await serve(ROOT);
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage();
  await page.goto(site.origin + '/apps/fracture-city-game/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const r = await page.evaluate(PROBE);
  c.ok('probe ran', r.ok, r.why || '');
  if (r.ok){
    c.ok('mesher is deterministic', r.deterministic, r.deterministic ? '' : 'two runs differed');
    c.gt('quads emitted', r.quads, 0);
    c.eq('area total == boundary face total (necessary, not sufficient)', r.area, r.faces);

    if (RECORD){
      fs.writeFileSync(GOLDEN, JSON.stringify({
        recordedAt: new Date().toISOString(),
        note: 'covers greedyQuads, isSolid and the solid flags in BLOCKS',
        digest: r.digest, quads: r.quads, area: r.area, faces: r.faces,
      }, null, 2) + '\n');
      console.log('\nrecorded ' + GOLDEN + ': ' + r.digest);
    } else if (!fs.existsSync(GOLDEN)){
      c.ok('golden file exists', false, 'run with --record first');
    } else {
      const g = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
      c.eq('digest matches golden', r.digest, g.digest);
      c.eq('quad count matches golden', r.quads, g.quads);
    }
  }

  const failed = c.report();
  await browser.close();
  site.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('mesher-golden crashed:', e); process.exit(2); });
