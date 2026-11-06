const {chromium}=require('playwright'),{createServer}=require('../server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-dispatch-solo-')),app=createServer({dbPath:path.join(dir,'city.sqlite'),newsFetch:async()=>new Response('<rss/>')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'chrome'});const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+app.server.address().port+'/city/');await p.waitForFunction(()=>window.OwnBlock&&window.FCCityDispatch);await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>FCCityDispatch.data&&State.chunkMap.size>10);
  await p.evaluate(()=>{HD.setTier('perf',true);State.ui.paused=false;});
  await p.locator('.tc-chip[data-act=keys]').tap();await p.waitForFunction(()=>Mobile.state().keys);
  await p.locator('#mob-keys .grid button').filter({hasText:'City Dispatch · quests & dailies'}).tap();await p.waitForSelector('#city-dispatch');
  assert.ok(await p.locator('#city-dispatch').evaluate(e=>e.scrollWidth<=innerWidth));
  await p.locator('#city-dispatch [data-close]').tap();assert.equal(await p.evaluate(()=>State.ui.paused),false);
  const id=await p.evaluate(()=>FCCityDispatch.data.jobs.find(q=>q.daily&&q.steps.length===1).id);
  await p.evaluate(id=>FCCityDispatch.track(id),id);
  await p.evaluate(id=>{const q=FCCityDispatch.data.jobs.find(q=>q.id===id),a=FCDispatchJobs.places[q.steps[0].place].at;Player.position.set(a[0],a[1]+Player.height,a[2]);},id);
  await p.waitForTimeout(1000);await p.locator('#dispatch-goal').tap();await p.waitForFunction(()=>FCCityDispatch.working);
  await p.evaluate(()=>State.ui.inInventory=true);await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>FCCityDispatch.working),false,'inventory cancels the interaction');await p.evaluate(()=>State.ui.inInventory=false);await p.waitForTimeout(200);await p.locator('#dispatch-goal').tap();await p.waitForFunction(()=>FCCityDispatch.working);
  await p.waitForFunction(id=>FCCityDispatch.data.state.progress[id].done,id,{timeout:20000});
  const slot=await p.evaluate(async()=>{await shSlotSave(Slots.activeId);return Slots.activeId});await p.reload();await p.waitForFunction(()=>window.OwnBlock&&window.FCCityDispatch);await p.evaluate(id=>shSlotRestore(id),slot);
  await p.waitForFunction(id=>FCCityDispatch.data?.state.progress[id]?.done,id);
  await p.evaluate(()=>{State.ui.paused=false;FCCommonGroundGuide.open();});await p.locator('[data-dispatch]').tap();await p.waitForSelector('#city-dispatch');
  await p.screenshot({path:path.join(__dirname,'out/dispatch-phone-touch.png')});assert.deepEqual(errors,[]);
  console.log('PASS real phone menu, touch interaction, solo reward/save/reload, and directory dispatch entry; no browser errors');
 }finally{await browser?.close();await new Promise(r=>{app.server.once('close',r);app.close();});fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
