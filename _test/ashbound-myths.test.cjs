const {chromium}=require('playwright'),{createServer}=require('../server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-ashbound-')),app=createServer({dbPath:path.join(dir,'city.sqlite'),newsFetch:async()=>new Response('<rss/>')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'chrome'});const p=await browser.newPage({viewport:{width:1280,height:820}}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER',e.message)});
  await p.goto('http://127.0.0.1:'+app.server.address().port+'/city/');await p.waitForFunction(()=>window.OwnBlock&&window.FCAshbound);await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready&&State.chunkMap.size>10);
  const checks=await p.evaluate(()=>{
   HD.setTier('perf',true);State.ui.paused=false;Peace.on=false;State.dayTime=23*60;FCResident.setView(false);Player.position.set(125,1+Player.height,80);Player.yaw=0;
   for(let cx=3;cx<=6;cx++)for(let cz=2;cz<=4;cz++)if(!State.chunkMap.has(cx+','+cz))shBuildChunk(cx+','+cz);
   let spawned=false;for(let i=0;i<20&&!spawned;i++)spawned=FCAshbound.spawnPair();if(!spawned)throw Error('No valid ground for the pair');
   const [e,b]=FCAshbound.live,result={pair:FCAshbound.live.length,cap:FCAshbound.spawnPair()};
   // A small clear street patch keeps gaze/attack checks deterministic.
   for(let x=121;x<=130;x++)for(let z=74;z<=84;z++){setBlock(x,0,z,1);for(let y=1;y<7;y++)setBlock(x,y,z,0);}
   Player.position.set(125,1+Player.height,80);e.position.set(125,1,76);e.group.position.copy(e.position);b.position.set(126.5,1,76);b.group.position.copy(b.position);
   State.camera.position.copy(Player.position);State.camera.lookAt(125,2,76);State.camera.updateMatrixWorld(true);
   result.seen=FCAshbound.observed(e);const age=e.ashAge,pose=e.ashBody.position.y;for(let i=0;i<50;i++)e.update(.05);result.emergeFrozen=e.ashAge===age&&e.ashBody.position.y===pose;
   State.camera.lookAt(125,2,86);for(let i=0;i<30;i++)e.update(.05);result.emerging=e.ashAge>1&&e.ashBody.position.y>pose&&e.ashBody.position.y<0;
   for(let i=0;i<25;i++)e.update(.05);result.emerged=e.ashBody.position.y===0;
   const z=e.position.z;for(let i=0;i<5;i++)e.update(.05);result.moves=e.position.z>z;
   State.camera.lookAt(e.position.x,e.position.y+1.4,e.position.z);const frozen=e.position.clone(),rotation=e.ashArms[0].rotation.x;for(let i=0;i<20;i++)e.update(.05);result.frozen=e.position.equals(frozen)&&e.ashArms[0].rotation.x===rotation;
   b.position.set(125,1,84);b.group.position.copy(b.position);b.ashAge=3;b.ashBody.position.y=0;const bz=b.position.z;b.update(.05);result.independent=b.position.z<bz&&e.position.equals(frozen);
   FCResident.setView(true);Player.yaw=0;Player.pitch=0;result.thirdPerson=FCAshbound.observed(e);FCResident.setView(false);
   // A full-height wall occludes every tested body sample.
   e.position.set(125,1,75);e.group.position.copy(e.position);State.camera.lookAt(125,2,75);
   for(let x=122;x<=128;x++)for(let y=1;y<=6;y++)setBlock(x,y,77,1);
   result.wallHidden=!FCAshbound.observed(e);
   for(let x=122;x<=128;x++)for(let y=1;y<=6;y++)setBlock(x,y,77,0);
   e.position.set(125,1,78.5);e.group.position.copy(e.position);e.ashWind=.6;e.attackTimer=0;const hp=Player.hp;State.camera.lookAt(125,2,78.5);e.update(.05);result.lookCancels=e.ashWind===0&&Player.hp===hp;
   State.camera.lookAt(125,2,86);for(let i=0;i<14;i++)e.update(.05);result.attack=Player.hp===hp-10;
   const before=State.hud.credits;e.takeDamage(1000);e.takeDamage(1000);result.killOnce=State.hud.credits===before+20&&e.state==='dead';
   FCAshbound.clear();State.dayTime=12*60;result.dayBlocked=!FCAshbound.spawnPair();State.dayTime=23*60;Peace.on=true;result.peaceBlocked=!FCAshbound.spawnPair();Peace.on=false;Player.position.set(96,2+Player.height,24);result.churchSafe=!FCAshbound.spawnPair();
   result.sanctuaries=FCAshbound.sanctuary(167,24)&&FCAshbound.sanctuary(230,80);
   State.ui.paused=true;return result;
  });
  console.log(checks);assert.equal(checks.pair,2);assert.equal(checks.cap,false);for(const [k,v]of Object.entries(checks))if(!['pair','cap'].includes(k))assert.equal(v,true,k);
  const cleanup=await p.evaluate(async()=>{
   const spawn=()=>{FCAshbound.clear();Player.position.set(125,1+Player.height,80);State.ui.paused=false;Peace.on=false;State.dayTime=23*60;let ok=false;for(let i=0;i<20&&!ok;i++)ok=FCAshbound.spawnPair();return ok;};
   if(!spawn())throw Error('Cleanup test could not spawn');State.dayTime=12*60;await new Promise(r=>setTimeout(r,200));const dawn=FCAshbound.live.length===0;
   if(!spawn())throw Error('Cleanup test could not respawn');Player.position.set(96,2+Player.height,24);await new Promise(r=>setTimeout(r,200));const sanctuary=FCAshbound.live.length===0;
   State.ui.paused=true;return {dawn,sanctuary};
  });assert.deepEqual(cleanup,{dawn:true,sanctuary:true});
  // Render a pose for visual inspection without changing the real enemy mesh.
  await p.evaluate(()=>{Player.hp=100;const e=new Enemy('ashbound',125,76,new RNG('preview'));e.ashBody.position.y=0;e.ashBody.rotation.x=0;e.ashArms.forEach(a=>a.rotation.x=0);e.ashSeal.visible=false;e.group.position.set(125,1,76);State.scene.add(e.group);Player.position.set(125,1+Player.height,80);Player.yaw=0;Player.pitch=0;State.camera.position.copy(Player.position);State.camera.lookAt(125,2,76);});
  await p.waitForTimeout(300);await p.screenshot({path:path.join(__dirname,'out/ashbound-preview.png')});
  await p.evaluate(async()=>{Player.position.set(96,2+Player.height,24);await FCOmnism.loadIndex();FCOmnism.open({kind:'work',id:'greek-myths'});});
  await p.waitForFunction(()=>document.querySelector('.om-text')?.textContent.includes('Heliconian'));assert.equal(await p.evaluate(()=>FCOmnism.STATIONS.length),12);
  await p.screenshot({path:path.join(__dirname,'out/omnism-greek.png')});
  await p.locator('[data-work="norse-myths"]').first().click();await p.waitForFunction(()=>document.querySelector('.om-text')?.textContent.includes('Hearing I ask'));
  await p.locator('[data-book="1"]').click();await p.waitForFunction(()=>document.querySelector('.om-text')?.textContent.includes('Within the gates'));
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(__dirname,'out/omnism-norse-phone.png')});
  assert.ok(await p.locator('.om-panel').evaluate(e=>e.scrollWidth<=e.clientWidth));
  const texts=await p.evaluate(async()=>{const a=await FCOmnism.loadBook('norse-myths','en',0),b=await FCOmnism.loadBook('norse-myths','en',1);return [a.c.flat().length,b.c.flat().length]});assert.deepEqual(texts,[66,165]);
  await p.keyboard.press('Escape');assert.equal(await p.locator('.om-panel').count(),0);assert.deepEqual(errors,[]);
  console.log('PASS paired spawning, gaze freeze, emergence, occlusion, attacks, rewards, sanctuaries, Greek/Norse reading and phone fit');
 }finally{await browser?.close();await new Promise(r=>{app.server.once('close',r);app.close();});fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
