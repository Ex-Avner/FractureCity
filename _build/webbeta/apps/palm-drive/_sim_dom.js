/* DOM smoke test — loads Palm Drive in jsdom and drives the announcer and
   campaign hooks. Run: node _sim_dom.js   Safe to delete. */
const fs = require('fs'), path = require('path');
const { JSDOM } = require(process.env.JSDOM_PATH || '/tmp/node_modules/jsdom');

let FAIL = 0;
const check = (n,c,d) => { console.log((c?'  PASS  ':'  FAIL  ')+n+(d?'  — '+d:'')); if(!c) FAIL++; };

const dir = __dirname;
const html = fs.readFileSync(path.join(dir,'index.html'),'utf8')
  .replace(/<script src="(rivals|ned)\.js"><\/script>/g,'');

process.on('unhandledRejection', e => {
  const m = String(e && (e.message||e.name||e));
  if (/not implemented|getContext|canvas/i.test(m)) return;
  console.log('  NOTE  unhandled rejection: ' + m);
});

// Minimal 2D context stub — the game draws on every frame.
function stubCtx(){
  const noop = () => {};
  const g = { addColorStop: noop };
  return new Proxy({}, { get(_, k){
    if (k === 'canvas') return { width:1280, height:720 };
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => g;
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'getImageData') return () => ({ data:new Uint8ClampedArray(4) });
    return noop;
  }, set(){ return true; } });
}

const dom = new JSDOM(html, {
  runScripts:'dangerously', url:'http://localhost/index.html', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = () => stubCtx();
    w.AudioContext = function(){ return { createOscillator:()=>({connect(){},start(){},stop(){},frequency:{}}),
      createGain:()=>({connect(){},gain:{}}), destination:{} }; };
    w.speechSynthesis = { speak(){}, cancel(){}, getVoices:()=>[] };
    w.SpeechSynthesisUtterance = function(t){ this.text = t; };
    // The game drives itself with rAF. In jsdom that never yields, so the
    // harness hangs. We step the simulation manually instead.
    w.requestAnimationFrame = () => 0;
    w.cancelAnimationFrame = () => {};
  },
});
const w = dom.window;
['rivals.js','ned.js'].forEach(f => {
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(dir,f),'utf8');
  w.document.body.appendChild(s);
});

setTimeout(async () => {
  console.log('════ MODULE LOAD ════');
  check('PDHost published', !!w.PDHost);
  check('PalmRivals present', !!w.PalmRivals);
  check('Ned present', !!w.Ned);
  check('spawnRivals overridden', w.spawnRivals === w.PalmRivals.spawnRivals);
  check('updateRivals overridden', w.updateRivals === w.PalmRivals.updateRivals);
  check('host lexicals resolved',
    !!(w.PDHost.RIVALS && w.PDHost.TRACKS && w.PDHost.MAX_SPEED && w.PDHost.G));

  console.log('\n════ DIFFICULTY UI ════');
  const btns = [...w.document.querySelectorAll('#tier-btns button')];
  check('three tier buttons rendered', btns.length === 3, btns.map(b=>b.textContent).join(' / '));
  check('blurb populated', (w.document.getElementById('tier-blurb').textContent||'').length > 10);
  btns.find(b => b.dataset.tier === 'fracture').onclick();
  check('clicking a tier persists it', w.PDHost.CAREER.tier === 'fracture', w.PDHost.CAREER.tier);
  check('tier readout updates',
    w.document.getElementById('ned-tier').textContent === 'FRACTURE');
  btns.find(b => b.dataset.tier === 'pro').onclick();

  console.log('\n════ RIVAL PROFILES APPLIED ════');
  const skills = w.PDHost.RIVALS.map(r => r.baseSkill);
  check('every rival got a base skill', skills.every(s => typeof s === 'number'), skills.join(', '));
  check('skill band widened past the old 0.575-0.70',
    Math.max(...skills) > 0.80 && Math.min(...skills) < 0.70,
    Math.min(...skills).toFixed(3)+' - '+Math.max(...skills).toFixed(3));
  check('every rival has a temperament',
    w.PDHost.RIVALS.every(r => !!r.temperament),
    w.PDHost.RIVALS.map(r=>r.name+':'+r.temperament).join(' '));

  console.log('\n════ RACE + LIVE COMMENTARY ════');
  w.startRace(0,'quick');
  check('race started', w.PDHost.G.running === true);
  check('rivals spawned', w.PDHost.rivals.length === 6, w.PDHost.rivals.length + ' cars');
  check('grid positions are positive (the old lap-down bug)',
    w.PDHost.rivals.every(r => r.z > 0 && r.z < w.PDHost.trackLength * 0.25),
    w.PDHost.rivals.map(r=>Math.round(r.z)).join(','));
  check('effective skill = base x tier x bias',
    Math.abs(w.PDHost.rivals[0].skill - w.PDHost.RIVALS[0].baseSkill * w.PalmRivals.TIERS.pro.pace) < 1e-6);

  // simulate a chunk of race time
  const G = w.PDHost.G;
  G.countdown = 0;
  let ticks = 0, errors = 0;
  for (let i=0;i<600;i++){
    try { w.updateRivals(1/60); ticks++; } catch(e){ errors++; if(errors===1) console.log('    '+e.message); }
  }
  check('600 AI frames ran without throwing', errors === 0, ticks + ' frames');
  check('rivals advanced down the track', w.PDHost.rivals.every(r => r.z > 0));
  check('rivals reached racing speed',
    w.PDHost.rivals.every(r => r.speed > w.PDHost.MAX_SPEED * 0.4),
    w.PDHost.rivals.map(r=>(r.speed/w.PDHost.MAX_SPEED).toFixed(2)).join(' '));
  check('offsets stayed on the road',
    w.PDHost.rivals.every(r => r.offset >= -0.93 && r.offset <= 0.93));

  // commentary
  w.Ned.resetRace();
  G.running = true; G.paused = false; G.finished = false; G.countdown = 0;
  G.place = 4; G.lap = 1; G.laps = 2; G.offroad = false; G.lastLap = 0;
  w.Ned.tick(0.016);
  G.place = 2;                       // gained two places
  w.Ned.tick(0.016);
  const lower = w.document.getElementById('ned-txt').textContent;
  check('overtake produced commentary', lower.length > 0, '"'+lower+'"');
  check('lower third became visible',
    w.document.getElementById('ned-lower').classList.contains('on'));

  console.log('\n════ NED LINE BANKS ════');
  const banks = Object.entries(w.Ned.LINES);
  let bad = [];
  for (const [name, arr] of banks){
    arr.forEach((fn,i) => {
      let out;
      try {
        out = fn({ t:'PALM COAST', r:'VOSS', p:3, n:'VOSS', l:'01:02.33' });
      } catch(e){ bad.push(name+'['+i+'] threw: '+e.message); return; }
      if (typeof out !== 'string' || !out.length) bad.push(name+'['+i+'] empty');
      if (/undefined|null|\[object/.test(out)) bad.push(name+'['+i+']: "'+out+'"');
      if (/!{2,}/.test(out)) bad.push(name+'['+i+'] over-excited for Ned');
    });
  }
  check('every line renders cleanly with no placeholder leaks', bad.length === 0,
    bad.slice(0,4).join(' | '));
  console.log('  ' + banks.length + ' banks, ' +
    banks.reduce((n,[,a])=>n+a.length,0) + ' lines total');

  console.log('\n════ CAMPAIGN ════');
  const CAM = w.Ned.CAMPAIGN;
  check('season opening writes lines', CAM.open().length >= 2);
  w.PDHost.CAREER.champ = { round:0, points:{YOU:0,VOSS:10,HALCYON:8,'M. REY':6,ODA:5,BRAKE:4,PALOMA:3},
                     results:[], beatenBy:{}, nemesis:null };
  let st = w.Ned.champState();
  check('champState reads the table', st && st.leaderName === 'VOSS', st && st.leaderName);
  check('round brief is authored', CAM.brief(1,'NIGHT GATE',st).length >= 2);
  check('final round brief differs from a mid-season one',
    CAM.brief(3,'THE COLLAPSE',st).join(' ') !== CAM.brief(1,'NIGHT GATE',st).join(' '));

  // nemesis emerges from real finishing order
  w.PDHost.G.finishOrder = [{name:'VOSS'},{name:'ODA'},'YOU',{name:'BRAKE'}];
  w.PDHost.G.place = 3;
  w.Ned.updateNemesis(3);
  check('nemesis derived from who finished ahead of you',
    w.PDHost.CAREER.champ.nemesis === 'ODA', String(w.PDHost.CAREER.champ.nemesis));
  w.Ned.updateNemesis(3);
  check('repeat offences accumulate', w.PDHost.CAREER.champ.beatenBy.ODA === 2,
    JSON.stringify(w.PDHost.CAREER.champ.beatenBy));

  st = w.Ned.champState();
  check('debrief mentions the nemesis',
    CAM.debrief(3, st).join(' ').includes('ODA'));
  const lost = CAM.close(false, st).join(' ');
  const won  = CAM.close(true,  st).join(' ');
  check('season close differs for win and loss', lost !== won);
  check('losing close names the champion', lost.includes('VOSS'), lost.slice(0,60)+'…');

  console.log('\n════ SAMPLE BROADCAST ════');
  console.log('  — opening —');
  CAM.open().forEach(l => console.log('    ' + l));
  console.log('  — final round brief —');
  CAM.brief(3,'THE COLLAPSE',st).forEach(l => console.log('    ' + l));
  console.log('  — season close (loss) —');
  CAM.close(false, st).forEach(l => console.log('    ' + l));

  console.log('\n════ ' + (FAIL===0?'ALL DOM CHECKS PASSED':FAIL+' CHECK(S) FAILED') + ' ════');
  process.exit(FAIL===0?0:1);
}, 500);

// hard stop so a hang is reported rather than silently eating the timeout
setTimeout(() => { console.log('  FAIL  harness timed out'); process.exit(1); }, 25000);
