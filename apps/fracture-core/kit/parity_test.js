// Does the browser tokeniser produce the same terms as the trainer did?
// If not, the index is being queried in a language it was not built in, and
// every result is quietly a little wrong. Run: node parity_test.js
const fs = require('fs');
globalThis.atob = (b) => Buffer.from(b, 'base64').toString('binary');
globalThis.window = globalThis;
require('./build/apps/fracture-core/engine/retrieval.js');
const model = JSON.parse(fs.readFileSync('data/fracture-index.json', 'utf8'));
const R = new globalThis.FractureRetrieval(model);
const expect = JSON.parse(fs.readFileSync('/tmp/py_terms.json', 'utf8'));
let bad = 0, checked = 0, firstBad = null;
for (const [i, want] of expect.entries()) {
  const got = R.terms(model.passages[i].t);
  checked++;
  if (got.length !== want.length || got.some((t, j) => t !== want[j])) {
    bad++;
    if (!firstBad) firstBad = { i, want: want.slice(0, 14), got: got.slice(0, 14) };
  }
}
console.log(`parity: ${checked - bad}/${checked} passages tokenise identically`);
if (firstBad) { console.log('first mismatch', JSON.stringify(firstBad, null, 1)); process.exit(1); }
console.log('index stats', JSON.stringify(R.stats().eval));
