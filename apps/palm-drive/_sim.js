/* Headless balance simulation for Palm Drive rival tiers.
   Run: node _sim.js       Safe to delete — not loaded by the game.

   Models a race as: rival pace = MAX * skill * tierPace * circuitBias, against
   a synthetic player driving at a given fraction of top speed. It reuses the
   REAL numbers from rivals.js by parsing them out, so the sim cannot drift
   away from the shipped values. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = __dirname;

let FAIL = 0;
const check = (n,c,d) => { console.log((c?'  PASS  ':'  FAIL  ')+n+(d?'  — '+d:'')); if(!c) FAIL++; };

// ── load the real rivals.js against a minimal host stub ────────────────────
const src = fs.readFileSync(path.join(dir,'rivals.js'),'utf8');
const RIVALS = [
  {name:'VOSS',col:'#f00',skill:0.70},{name:'HALCYON',col:'#0ff',skill:0.67},
  {name:'M. REY',col:'#ff0',skill:0.645},{name:'ODA',col:'#a0f',skill:0.62},
  {name:'BRAKE',col:'#3f9',skill:0.60},{name:'PALOMA',col:'#f83',skill:0.575},
];
const TRACKS = [
  {id:'palmcoast',name:'PALM COAST',laps:2},{id:'meridian',name:'MERIDIAN MILE',laps:2},
  {id:'nightgate',name:'NIGHT GATE',laps:3},{id:'thecollapse',name:'THE COLLAPSE',laps:3},
];
const SEG_LEN = 200, MAX_SPEED = SEG_LEN*60;
const ctx = {
  console, Math, Object, Array, JSON, Date,
  RIVALS, TRACKS, SEG_LEN, MAX_SPEED,
  G:{}, rivals:[], segments:[], trackLength:1000*SEG_LEN,
  findSegment:()=>({curve:0,cars:[],rivals:[]}),
  increase:(s,i,m)=>{let r=s+i;while(r>=m)r-=m;while(r<0)r+=m;return r;},
  interp:(a,b,p)=>a+(b-a)*p, limit:(v,a,b)=>Math.max(a,Math.min(v,b)),
  CAREER:{}, saveCareer(){},
};
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);
const PR = ctx.PalmRivals;

// ── the sim ────────────────────────────────────────────────────────────────
// Player pace expressed as a fraction of MAX_SPEED, sustained over the race.
// Reference points from NOTES.txt: an ideal flat-out lap is ~41s on PALM
// COAST; a competent human does ~55-65s. 41/55 = 0.745, 41/65 = 0.63.
const PLAYER = {
  bad:      0.62,   // scruffy — lots of time off-road
  average:  0.72,   // tidy but lifting for every bend
  good:     0.82,   // clean, uses the boost
  expert:   0.90,   // near-ideal lap
};

function race(tierKey, playerPace, trackIdx){
  ctx.CAREER.tier = tierKey;
  const T = PR.TIERS[tierKey];
  const def = TRACKS[trackIdx];
  // effective rival pace, including the wobble average (~1.0) and bend losses
  // which apply equally to everyone and therefore cancel for ordering.
  const field = RIVALS.map(r => {
    const p = PR.PROFILE[r.name];
    const bias = (p.bias && p.bias[def.id]) || 1;
    return { name:r.name, pace: p.skill * T.pace * bias };
  });
  // Temperament effects that persist over a full race, approximated:
  //   closer     +8.5% on the final lap  -> +~3% race average over 3 laps
  //   wildcard   30% chance of a 1.1s-ish mistake per lap -> -~3% average
  //   metronome  no drift (neutral)
  for (const f of field){
    const t = PR.PROFILE[f.name].temperament;
    if (t === 'closer')   f.pace *= 1.03;
    if (t === 'wildcard') f.pace *= 0.97;
  }
  const all = field.concat([{ name:'YOU', pace: playerPace }]);
  all.sort((a,b) => b.pace - a.pace);
  return all.findIndex(x => x.name === 'YOU') + 1;   // finishing position
}

function sweep(tierKey, paceKey){
  const p = PLAYER[paceKey];
  const places = TRACKS.map((_,i) => race(tierKey, p, i));
  return { places, avg: places.reduce((a,b)=>a+b,0)/places.length,
           wins: places.filter(x=>x===1).length };
}

console.log('════ SHIPPED VALUES ════');
console.log('  tiers: ' + Object.values(PR.TIERS).map(t=>`${t.label} x${t.pace}`).join('  '));
const band = RIVALS.map(r=>PR.PROFILE[r.name].skill);
console.log('  rival base skill band: ' + Math.min(...band).toFixed(3) + ' – ' + Math.max(...band).toFixed(3)
            + '   (was 0.575 – 0.700)');
console.log('  temperaments: ' + [...new Set(Object.values(PR.PROFILE).map(p=>p.temperament))].join(', '));

console.log('\n════ FINISHING POSITION BY TIER AND DRIVING QUALITY ════');
console.log('           ' + Object.keys(PLAYER).map(k=>k.padEnd(9)).join(''));
const grid = {};
for (const tk of Object.keys(PR.TIERS)){
  grid[tk] = {};
  const row = Object.keys(PLAYER).map(pk => {
    const s = sweep(tk, pk);
    grid[tk][pk] = s;
    return ('P'+s.avg.toFixed(1)).padEnd(9);
  });
  console.log('  ' + PR.TIERS[tk].label.padEnd(9) + row.join(''));
}

console.log('\n════ BALANCE ASSERTIONS ════');

// The whole complaint: losing must be possible.
check('PRO: a bad drive does NOT win',
  grid.pro.bad.wins === 0, 'avg P' + grid.pro.bad.avg.toFixed(1));
check('PRO: an average drive does NOT win',
  grid.pro.average.wins === 0, 'avg P' + grid.pro.average.avg.toFixed(1));
check('FRACTURE: even a good drive does NOT sweep',
  grid.fracture.good.wins < TRACKS.length, grid.fracture.good.wins + '/' + TRACKS.length + ' wins');
check('FRACTURE: a bad drive finishes last or near it',
  grid.fracture.bad.avg >= 6, 'avg P' + grid.fracture.bad.avg.toFixed(1));

// But it must still be winnable — a skill wall, not a brick wall.
check('PRO: an expert drive wins races',
  grid.pro.expert.wins > 0, grid.pro.expert.wins + '/' + TRACKS.length + ' wins');
check('FRACTURE: an expert drive can still win at least one',
  grid.fracture.expert.wins > 0, grid.fracture.expert.wins + '/' + TRACKS.length + ' wins');
check('ROOKIE: a good drive wins comfortably',
  grid.rookie.good.wins >= TRACKS.length - 1, grid.rookie.good.wins + '/' + TRACKS.length + ' wins');
check('ROOKIE: an average drive is competitive',
  grid.rookie.average.avg <= 4, 'avg P' + grid.rookie.average.avg.toFixed(1));

// Driving better must always be rewarded, at every tier.
let monotone = true, detail = '';
for (const tk of Object.keys(PR.TIERS)){
  const seq = ['bad','average','good','expert'].map(p => grid[tk][p].avg);
  for (let i=1;i<seq.length;i++) if (seq[i] > seq[i-1]){ monotone = false; detail = tk; }
}
check('better driving always improves finishing position', monotone, detail);

// Circuits must not all play the same.
const spread = TRACKS.map((_,i) => race('pro', PLAYER.good, i));
check('circuit bias produces different results per track',
  new Set(spread).size > 1, 'PRO/good by circuit: ' + spread.map(p=>'P'+p).join(' '));

console.log('\n════ PER-CIRCUIT DETAIL (PRO, good drive) ════');
TRACKS.forEach((t,i) => {
  ctx.CAREER.tier = 'pro';
  const T = PR.TIERS.pro;
  const order = RIVALS.map(r => {
    const p = PR.PROFILE[r.name];
    return { name:r.name, pace:p.skill*T.pace*((p.bias&&p.bias[t.id])||1) };
  }).concat([{name:'YOU',pace:PLAYER.good}]).sort((a,b)=>b.pace-a.pace);
  console.log('  ' + t.name.padEnd(15) + order.map(o=>o.name).join(' > '));
});

console.log('\n════ ' + (FAIL===0 ? 'BALANCE OK' : FAIL+' ASSERTION(S) FAILED') + ' ════');
process.exit(FAIL===0?0:1);
