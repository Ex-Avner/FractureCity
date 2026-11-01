// 0.92: the Soundstage gets a building (the Backlot); PvP becomes opt-in;
// the older Cast Studio and the Backroom editor sit behind a developer flag.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{serve,LAUNCH_ARGS}=require('./lib/harness'),assert=require('node:assert/strict');
const T={timeout:240000};
(async()=>{const site=await serve(root),browser=await chromium.launch({channel:'chrome',args:LAUNCH_ARGS}),errors=[];
try{
 const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(site.origin+'/apps/fracture-city-game/index.html',{waitUntil:'load'});await p.waitForFunction(()=>window.FCBacklot&&window.FCSoundstage&&window.OwnBlock,null,T);
 // ── Hidden by default ──────────────────────────────────────────────────
 const hidden=await p.evaluate(()=>({dev:FC_DEV.on,roster:ARCADE_ROSTER.some(a=>a.slug==='backroom'),tray:[...document.querySelectorAll('#fc-tools .tray button')].map(b=>b.textContent)}));
 assert.equal(hidden.dev,false);assert.equal(hidden.roster,false,'no Backroom cabinet for players');
 assert.ok(!hidden.tray.some(t=>/Backroom|Create characters/.test(t)),'no Backroom or Cast Studio in Tools: '+hidden.tray.join(' | '));
 await p.keyboard.press('F6');assert.equal(await p.evaluate(()=>FCCast.modal),false,'F6 does nothing without the flag');
 console.log('PASS the Backroom editor and the older Cast Studio are out of a new player\'s way');
 // ── The Backlot ────────────────────────────────────────────────────────
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.ui.paused=false;Player.position.set(103,2+Player.height,44)});
 await p.waitForFunction(()=>OwnBlock.ready&&State.chunkMap.has('4,2')&&FCBacklot.root,null,T);await p.waitForTimeout(1500);
 const lot=await p.evaluate(()=>{const H=FCBacklot.HALL;return{wall:getBlock(H.x0,4,60),door:getBlock(103,3,H.z0),floor:getBlock(103,1,60),solid:[...State.chunkMap.values()].reduce((n,c)=>n+c.collisionAABBs.filter(a=>a.backlot).length,0),inScene:FCBacklot.root.parent===State.scene}});
 assert.equal(lot.wall,174);assert.equal(lot.door,0,'door open');assert.equal(lot.floor,175);assert.equal(lot.solid,2,'camera and chair are solid');assert.ok(lot.inScene);
 //  Walk in through the door to the camera.
 const walked=await p.evaluate(()=>{State.ui.paused=true;Player.onGround=true;Player.velocity.set(0,0,0);const go=(tx,tz,n)=>{for(let i=0;i<n;i++){const dx=tx-Player.position.x,dz=tz-Player.position.z,d=Math.hypot(dx,dz);if(d<.15)break;Player.velocity.x=dx/d*3;Player.velocity.z=dz/d*3;Player.velocity.y-=22/60;updateWalkPhysics(1/60)}};go(103,57.4,900);return{z:Player.position.z,feet:Player.position.y-Player.height}});
 assert.ok(walked.z>56.5&&Math.abs(walked.feet-2)<.05,'walks onto the stage floor: '+JSON.stringify(walked));
 await p.evaluate(()=>State.ui.paused=false);await p.waitForFunction(()=>!document.getElementById('backlot-approach').hidden,null,T);
 assert.equal(await p.locator('#backlot-approach').innerText(),'E · Soundstage: film a scene here');
 const toolsFirst=await p.evaluate(()=>{const tray=document.querySelector('#fc-tools .tray');return tray.firstElementChild.querySelector('[data-act=soundstage]')?.textContent||''});
 assert.ok(/direct and film a scene/.test(toolsFirst),'Soundstage leads the Tools tray: '+toolsFirst);
 await p.keyboard.press('KeyE');await p.waitForFunction(()=>FCSoundstage.state.open,null,T);
 const air=await p.waitForFunction(()=>FCBacklot.onAir,null,{timeout:60000}).then(()=>true,()=>false);assert.ok(air,'ON AIR lights while filming');
 await p.evaluate(()=>FCSoundstage.close());assert.equal(await p.evaluate(()=>FCSoundstage.state.open||State.ui.paused),false);
 console.log('PASS the Backlot: walk into Soundstage 1, the camera prompt opens the Soundstage, ON AIR lights, Tools leads with it');
 // ── PvP opt-in ─────────────────────────────────────────────────────────
 const pvp=await p.evaluate(()=>{const before=FCPvp.on;FCPvp.set(true);const on=FCPvp.on&&localStorage.getItem('fc-pvp')==='on';FCPvp.set(false);return{before,on,after:FCPvp.on}});
 assert.deepEqual(pvp,{before:false,on:true,after:false},'PvP starts off and the switch remembers');
 console.log('PASS PvP is off until you switch it on');
 // ── Developer flag brings the tools back ───────────────────────────────
 const d=await browser.newPage();d.on('pageerror',e=>errors.push(e.message));
 await d.goto(site.origin+'/apps/fracture-city-game/index.html?dev=1');await d.waitForFunction(()=>window.FC_DEV&&window.FCCast,null,T);
 const dev=await d.evaluate(()=>({on:FC_DEV.on,roster:ARCADE_ROSTER.some(a=>a.slug==='backroom'),tray:[...document.querySelectorAll('#fc-tools .tray button')].map(b=>b.textContent).join(' | ')}));
 assert.ok(dev.on&&dev.roster&&/Backroom/.test(dev.tray)&&/Create characters/.test(dev.tray),'?dev=1 restores the builder tools: '+JSON.stringify(dev));
 await d.evaluate(()=>FC_DEV.set(false));
 console.log('PASS ?dev=1 brings the builder tools back');
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();site.close?.()}})().catch(e=>{console.error(e);process.exitCode=1});
