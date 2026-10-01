//  Prove the harness can fail.
//
//  Copies the tree, breaks it three ways, and requires boot.js to exit non-zero
//  each time, then requires it to exit zero on the untouched copy. A harness
//  that has only ever been run against a working build is an opinion.
//
//    node selftest.js [repoRoot]

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Checks } = require('./lib/harness');

const ROOT = process.argv[2] || path.resolve(__dirname, '..');
const GAME = 'apps/fracture-city-game/index.html';

//  Each mutation is one string replacement, chosen to break exactly one thing.
const MUTATIONS = [
  {
    name: 'supply does nothing',
    why: 'the supply round-trip is the check most likely to be quietly wrong',
    from: 'const map = on ? POWER_ON_OF : POWER_OFF_OF;',
    to:   'const map = {}; // selftest: swap table emptied',
  },
  {
    name: 'newGame throws',
    why: 'a boot failure used to be pushed into an array nothing read',
    from: 'function newGame(seed){',
    to:   "function newGame(seed){ throw new Error('selftest: boot failure');",
  },
  {
    name: 'a local script 404s',
    why: 'this is the regression the mesher extraction can introduce',
    from: '<script src="../../shared/vendor/three.min.js"></script>',
    to:   '<script src="./selftest-missing-module.js"></script>\n<script src="../../shared/vendor/three.min.js"></script>',
  },
];

function copyTree(src, dst){
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })){
    if (['node_modules', '.git', '_build', 'Claude outputs', 'data', '_test'].includes(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyTree(s, d);
    else if (e.isFile()) fs.copyFileSync(s, d);
  }
}

function runBoot(root){
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'boot.js'), root],
                 { stdio: 'pipe', timeout: 240000 });
    return 0;
  } catch (e){ return e.status == null ? 99 : e.status; }
}

(async () => {
  const c = new Checks('selftest.js — does the harness actually fail?');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-selftest-'));
  const base = path.join(tmp, 'clean');
  console.log('copying the tree to ' + base + ' (no data/, nothing live is touched)');
  copyTree(ROOT, base);

  console.log('\n[1/4] clean copy, expecting exit 0');
  c.eq('clean tree passes', runBoot(base), 0);

  let n = 2;
  for (const m of MUTATIONS){
    const dir = path.join(tmp, 'broken-' + n);
    copyTree(ROOT, dir);
    const file = path.join(dir, GAME);
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes(m.from)){
      c.ok(`mutation "${m.name}" applied`, false, 'anchor not found: ' + m.from.slice(0, 60));
      n++;
      continue;
    }
    fs.writeFileSync(file, src.replace(m.from, m.to));
    console.log(`\n[${n}/4] ${m.name} — expecting a non-zero exit (${m.why})`);
    const code = runBoot(dir);
    c.ok(`harness rejects: ${m.name}`, code !== 0, 'exit ' + code);
    n++;
  }

  const failed = c.report();
  console.log('\nscratch tree left at ' + tmp);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('selftest crashed:', e); process.exit(2); });
