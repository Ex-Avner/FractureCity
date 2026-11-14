// The Mirror Hour.  node _test/mirror-hour.test.cjs
const {chromium}=require('playwright'),{serve}=require('./lib/harness'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const site=await serve(path.resolve(__dirname,'..')),browser=await chromium.launch({channel:'chrome'});
 try{const p=await browser.newPage({viewport:{width:640,height:360}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/THREE\.WebGLProgram|shader error|GLSL/i.test(m.text()))errors.push(m.text().slice(0,300))});
  await p.goto(site.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.OwnBlock);await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready&&State.chunkMap.size>10,null,{timeout:180000});
  const wait=ms=>p.waitForTimeout(ms);
  await p.evaluate(()=>{try{localStorage.removeItem('fc-mirror-hour')}catch(e){}FCMirrorHour.reset();HD.locked=true;HD.setTier('perf',true);Peace.on=true;State.ui.paused=false;State.dayTime=13*60;Player.position.set(196,3.4,164);for(let x=6;x<=9;x++)for(let z=5;z<=8;z++)if(!State.chunkMap.has(x+','+z))shBuildChunk(x+','+z);});
  await wait(5000);
  const day=await p.evaluate(()=>{const H=FCMirrorHour,k=H.root.children;return{inScene:H.root.parent===State.scene,amount:H.amount,vis:k.filter(o=>o.isMesh||o.isPoints).map(o=>o.visible),lights:k.filter(o=>o.isLight).length,lines:H.lines.length,dash:H.lines.some(l=>/[–—]/.test(l))}});
  assert.ok(day.inScene);assert.equal(day.amount,0);assert.deepEqual(day.vis,[true,false,false,false,false,false]);assert.equal(day.lights,0);console.log('PASS by day only the ghost mirror is drawn; no lights');
  assert.equal(day.lines,16);assert.ok(!day.dash);console.log('PASS sixteen lines, no dashes');
  await p.evaluate(()=>{FCMirrorHour.governor=false;FCMirrorHour.summon(3600);FCMirrorHour.amount=1});await wait(7000);
  const night=await p.evaluate(()=>{const H=FCMirrorHour,feet=H.feet();return{threads:H.threads,vis:H.root.children.filter(o=>o.isMesh||o.isPoints).map(o=>o.visible),onRoad:feet.every(f=>getBlock(f.x,0,f.z)===B_ASPHALT&&getBlock(f.x,1,f.z)===B_AIR&&f.x%24===0&&f.z%24===0),distinct:new Set(feet.map(f=>f.line)).size,q:H.perf().quality,bad:(State.renderer.info.programs||[]).filter(q=>q.diagnostics&&!q.diagnostics.runnable).length}});
  assert.ok(night.threads>=6&&night.threads<=64,'threads '+night.threads);assert.ok(night.vis.every(Boolean));assert.ok(night.onRoad);assert.ok(night.threads<=26);assert.equal(night.bad,0);console.log('PASS the hour is up:',night.threads,'threads, all on intersections,',night.distinct,'distinct lines in reach; every shader compiled');
  // Walking into a thread rings it.
  const rung=await p.evaluate(async()=>{const H=FCMirrorHour,f=H.feet()[0];Player.position.set(f.x+.5,2.6,f.z+.5);await new Promise(r=>setTimeout(r,4000));const el=document.getElementById('mirror-line');return{heard:[...H.heard],line:f.line,text:el.firstChild&&el.firstChild.textContent,expect:H.lines[f.line],stored:JSON.parse(localStorage.getItem('fc-mirror-hour')||'{}').heard||[]}});
  assert.deepEqual(rung.heard,[rung.line]);assert.equal(rung.text,rung.expect);assert.deepEqual(rung.stored,[rung.line]);console.log('PASS walking through a thread rings it, shows its line and saves it');
  // All sixteen: the mirror holds.
  const whole=await p.evaluate(async()=>{const H=FCMirrorHour;for(let i=0;i<16;i++)H.heard.add(i);H.heard.delete(H.feet()[1].line);H.ring(1);const now=H.whole;H.read(1000);const poem=document.querySelectorAll('#mirror-poem p').length,blank=document.querySelectorAll('#mirror-poem p.un').length;H.release();return{size:H.heard.size,now,poem,blank}});
  assert.equal(whole.size,16);assert.ok(whole.now);assert.equal(whole.poem,16);assert.equal(whole.blank,0);console.log('PASS the sixteenth line completes the poem and the mirror holds');
  await p.evaluate(()=>FCMirrorHour.reset());assert.deepEqual(errors,[]);console.log('PASS no browser or shader errors');
 }finally{await browser.close();site.close();}})().catch(e=>{console.error(e);process.exitCode=1});
