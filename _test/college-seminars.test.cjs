// Free College seminars.  node _test/college-seminars.test.cjs
const {chromium}=require('playwright'),{serve}=require('./lib/harness'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const site=await serve(path.resolve(__dirname,'..')),browser=await chromium.launch({channel:'chrome'});
 try{const p=await browser.newPage({viewport:{width:900,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(site.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.OwnBlock&&window.FCSeminars);await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready,null,{timeout:180000});
  const r=await p.evaluate(async()=>{const S=FCSeminars;S.reset();State.ui.paused=false;const out={n:S.seminars.length,shape:S.seminars.every(s=>s.sections.length===3&&s.questions.length===4&&s.questions.every(q=>q.options.length===4&&q.answer>=0&&q.answer<4&&q.why)),dash:/[–—]/.test(JSON.stringify(S.seminars)),ids:S.seminars.map(s=>s.id)};
   S.open();out.cards=document.querySelectorAll('#fc-seminars .card').length;out.paused=State.ui.paused;
   let leaked=0;const spy=()=>leaked++;window.addEventListener('keydown',spy);document.querySelector('#fc-seminars .box').dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true}));window.removeEventListener('keydown',spy);out.leaked=leaked;
   document.querySelector('#fc-seminars .card[data-id=logic]').click();const form=document.querySelector('#fc-seminars form');
   // Wrong answers first: no pass recorded.
   S.seminars[2].questions.forEach((q,i)=>{form.querySelector(`input[name=q${i}][value="${(q.answer+1)%4}"]`).checked=true});form.requestSubmit();out.failSaved=!!S.state.done.logic;out.failText=document.querySelector('#fc-seminars .result').textContent;
   S.seminars[2].questions.forEach((q,i)=>{form.querySelector(`input[name=q${i}][value="${q.answer}"]`).checked=true});form.requestSubmit();out.pass=S.state.done.logic&&S.state.done.logic.score;out.stored=JSON.parse(localStorage.getItem('fc-seminars-v1')).done.logic.score;
   document.querySelector('#fc-seminars').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));out.closed=!document.getElementById('fc-seminars');out.resumed=State.ui.paused===false;
   S.open('triaxial');out.note=!!document.querySelector('#fc-seminars .fine');S.close();S.reset();return out});
  assert.equal(r.n,4);assert.ok(r.shape);assert.ok(!r.dash);assert.deepEqual(r.ids,['reading','writing','logic','triaxial']);console.log('PASS four seminars, three readings and four questions each, no dashes');
  assert.equal(r.cards,4);assert.ok(r.paused);assert.equal(r.leaked,0);console.log('PASS catalogue opens, pauses the game and keeps its keys to itself');
  assert.ok(!r.failSaved&&/0 of 4/.test(r.failText));assert.equal(r.pass,4);assert.equal(r.stored,4);console.log('PASS a failed attempt records nothing; a pass is saved on the device');
  assert.ok(r.closed&&r.resumed&&r.note);assert.deepEqual(errors,[]);console.log('PASS Escape closes and restores play; framework seminar carries its authorship note; no errors');
 }finally{await browser.close();site.close();}})().catch(e=>{console.error(e);process.exitCode=1});
