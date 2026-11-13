// First Signal: the whole adventure, start to finish, without opening a panel.
// The adventure clock is stepped by hand (debug.run) so the result does not
// depend on how fast this machine renders.
const {chromium}=require('playwright'),{serve,LAUNCH_ARGS}=require('./lib/harness'),path=require('path'),fs=require('fs'),assert=require('node:assert/strict');
const out=n=>path.join(__dirname,'out',n);
(async()=>{fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});const site=await serve(path.resolve(__dirname,'..')),browser=await chromium.launch({channel:'chrome',args:LAUNCH_ARGS});try{
 const p=await browser.newPage({viewport:{width:1365,height:900}}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER',e.message)});p.on('console',m=>{if(/first-signal/.test(m.text()))console.log('CONSOLE',m.text())});
 const boot=async()=>{await p.goto(site.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.FCFirstSignal&&window.OwnBlock,null,{timeout:120000});await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready&&State.chunkMap.size>10,null,{timeout:120000});await p.evaluate(()=>{Peace.on=true;HD.locked=true;HD.setTier('perf',true);FCResident.setView(false);State.ui.paused=false;State.dayTime=13*60;FCFirstSignal.debug.frozen=true;});};
 // Put the player's feet at a point and make sure the ground around it exists.
 const stand=(x,y,z,yaw)=>p.evaluate(([x,y,z,yaw])=>{State.ui.paused=false;Player.position.set(x,y+Player.height,z);Player.velocity.set(0,0,0);if(yaw!=null)Player.yaw=yaw;for(let cx=Math.floor((x-50)/24);cx<=Math.floor((x+50)/24);cx++)for(let cz=Math.floor((z-50)/24);cz<=Math.floor((z+50)/24);cz++)if(!State.chunkMap.has(cx+','+cz))shBuildChunk(cx+','+cz);},[x,y,z,yaw]);
 const run=s=>p.evaluate(s=>FCFirstSignal.debug.run(s),s);
 const stage=()=>p.evaluate(()=>FCFirstSignal.stage);
 const label=()=>p.evaluate(()=>{FCFirstSignal.debug.run(.05);return FCFirstSignal.near?.label||null;});
 const shot=async(name,eye,at)=>{await p.evaluate(([eye,at])=>{State.ui.paused=true;State.camera.up.set(0,1,0);State.camera.position.set(...eye);State.camera.lookAt(...at);},[eye,at]);await p.waitForTimeout(2600);await p.screenshot({path:out(name)});await p.evaluate(()=>{State.ui.paused=false;});};
 await boot();const S=await p.evaluate(()=>FCFirstSignal.stages),P=await p.evaluate(()=>FCFirstSignal.places);
 assert.equal(await stage(),S.IDLE);

 // 1 · The incident is witnessed, not announced.
 await stand(167,1,24,Math.PI);await run(.2);
 assert.equal(await p.evaluate(()=>FCFirstSignal.built.arcade),true);
 assert.ok(await p.evaluate(()=>FCFirstSignal.debug.lit<0&&!FCFirstSignal.debug.arcadeParts.goods.visible),'the arcade starts dark and shuttered');
 await p.evaluate(()=>FCFirstSignal.debug.hurry());await run(.2);
 assert.equal(await stage(),S.INCIDENT);await run(5);
 const mid=await p.evaluate(()=>{const F=FCFirstSignal,c=F.courier;return{courier:!!c,act:c?.act,by:F.incident?.by.length,d:c?Math.hypot(c.ent.position.x-Player.position.x,c.ent.position.z-Player.position.z):null};});
 assert.ok(mid.courier&&mid.by>=2&&mid.d<30,JSON.stringify(mid));
 await shot('first-signal-incident.png',[167,3,22.5],[167,1.8,30]);
 await p.evaluate(()=>{for(let i=0;i<50&&FCFirstSignal.stage===FCFirstSignal.stages.INCIDENT;i++)FCFirstSignal.debug.run(1);});
 const after=await p.evaluate(()=>{const F=FCFirstSignal;return{stage:F.stage,courier:F.courier?.act,mech:!!F.mechanic,rec:F.state.rec,sat:F.state.sat,panel:!!document.querySelector('#fs-panel,#expanse-panel'),paused:State.ui.paused};});
 assert.deepEqual([after.stage,after.courier,after.mech,after.rec.includes(0),after.panel,after.paused],[S.FOLLOW,'sit',true,true,false,false],JSON.stringify(after));
 console.log('PASS incident: lights, courier falls, bystanders run in, mechanic takes the key; no panel opened');

 // 2 · She leads, and waits when you fall behind.
 // One synchronous walk in the page: keep the player just behind her, hang back now and then.
 const follow=(side,until)=>p.evaluate(([side,until])=>{const F=FCFirstSignal;let ghosted=false,waited=false,steps=0;
   const done=e=>until==='relay'?F.stage===F.stages.RELAY:e.li>=F.routes.back.length;
   for(;steps<320;steps++){const e=F.mechanic;if(!e)return{error:'no mechanic at step '+steps};if(done(e))break;ghosted=ghosted||!!e.ghost;if(e.act==='beckon')waited=true;
    if(steps%14<9){const q=e.ent.position;Player.position.set(q.x+side*2.5,q.y+Player.height,q.z+.4);Player.velocity.set(0,0,0);}
    const x=Player.position.x,z=Player.position.z;for(let cx=Math.floor((x-40)/24);cx<=Math.floor((x+40)/24);cx++)for(let cz=Math.floor((z-40)/24);cz<=Math.floor((z+40)/24);cz++)if(!State.chunkMap.has(cx+','+cz))shBuildChunk(cx+','+cz);
    F.debug.run(1);}
   return{ghosted,waited,steps,at:F.mechanic&&[F.mechanic.ent.position.x,F.mechanic.ent.position.z],li:F.mechanic?.li};},[side,until]);
 const outbound=await follow(-1,'relay');console.log('  outbound',JSON.stringify(outbound));
 assert.equal(await stage(),S.RELAY);assert.equal(outbound.ghosted,false,'she walked the whole way on real ground');assert.equal(outbound.waited,true,'she stopped and waved when the player fell behind');
 console.log('PASS follow: mechanic leads from the hall to the torn relay on foot, waits when you lag');

 // 3 · Reconnect the relay with your hands.
 await stand(300,2,22);await run(.3);assert.equal(await p.evaluate(()=>FCFirstSignal.built.site),true);
 await shot('first-signal-relay.png',[289,4.5,30],[303,3,16]);
 const ground=await p.evaluate(()=>{const F=FCFirstSignal,s=F.site;let flat=true;for(let a=0;a<6.28;a+=.3)for(const r of [5,10,15])if(shSurfaceY(s.x+Math.cos(a)*r,s.z+Math.sin(a)*r,20)!==2)flat=false;return{flat,gate:blockedAt(F.places.gate[0],2.01,22,.3,1.7),door:blockedAt(s.x-3.3,2.01,s.z,.3,1.7),housingLocked:true};});
 assert.ok(ground.flat&&ground.gate&&ground.door,JSON.stringify(ground));
 await stand(P.housing[0]-1.1,8,P.housing[1]);assert.equal(await label(),null,'the cell cannot be pulled before the line is whole');
 await stand(P.plug[0]+.8,2,P.plug[1]);assert.equal(await label(),'Pick up the line');await p.evaluate(()=>FCFirstSignal.use());assert.equal(await p.evaluate(()=>FCFirstSignal.carry),'plug');
 await stand(P.socket[0]+.6,2,P.socket[1]-1.4);assert.equal(await label(),'Plug in the line');await p.evaluate(()=>FCFirstSignal.use());
 assert.equal(await stage(),S.CELL);await run(3);
 assert.ok(await p.evaluate(()=>FCFirstSignal.debug.siteParts.markers.every(m=>m.material.emissiveIntensity>1)),'causeway markers light');
 console.log('PASS relay: carry the line, plug it in, the causeway lights');

 // 4 · Climb the fallen mast for the cell.
 const climb=await p.evaluate(()=>{const ok=[];for(let i=0;i<6;i++){const x=292+i*2.2+1.1,top=2+i+1;ok.push(!blockedAt(x,top+.01,11,.4,1.7)&&blockedAt(x,top-.4,11,.4,1.7));}return ok;});
 assert.ok(climb.every(Boolean),'six one-metre rungs, each one standable: '+climb);
 await stand(P.housing[0]-1.1,2,P.housing[1]+3);assert.equal(await label(),null,'the cell is out of reach from the ground');
 await stand(P.housing[0]-1.1,8,P.housing[1]);assert.equal(await label(),'Pull the power cell');
 await shot('first-signal-mast.png',[297,5,17],[304,7.5,11]);
 await stand(P.housing[0]-1.1,8,P.housing[1]);await p.evaluate(()=>FCFirstSignal.use());
 assert.deepEqual(await p.evaluate(()=>[FCFirstSignal.stage,FCFirstSignal.carry]),[S.GATE,'cell']);
 console.log('PASS mast: climb is physical, the cell is only reachable from the top');

 // 5 · She holds the gate; you carry the cell through.
 await stand(303,2,22);await p.evaluate(()=>{for(let i=0;i<30&&FCFirstSignal.debug.gate<.99;i++)FCFirstSignal.debug.run(1);});
 const gate=await p.evaluate(()=>{const F=FCFirstSignal;return{lift:F.debug.gate,act:F.mechanic?.act,open:!blockedAt(F.places.gate[0],2.01,22,.3,1.7)};});
 assert.deepEqual([gate.lift>=.99,gate.act,gate.open],[true,'haul',true],JSON.stringify(gate));
 await shot('first-signal-gate.png',[301.5,3.6,24.5],[309,3.4,21]);
 await stand(P.plinth[0]-1.2,2,P.plinth[1]);assert.equal(await label(),'Seat the cell');await p.evaluate(()=>FCFirstSignal.use());assert.equal(await stage(),S.WAKE);
 console.log('PASS gate: the mechanic hauls it open and holds while the cell goes through');

 // 6 · The station performs. Nothing is explained; the player keeps control.
 await run(7.5);const during=await p.evaluate(()=>{const w=FCFirstSignal.debug.wake.parts;return{rings:w.lift,frag0:w.frag(0),door:w.door,paused:State.ui.paused};});
 assert.ok(during.rings[0]>.9&&during.frag0>.9&&during.door===0&&!during.paused,JSON.stringify(during));
 await shot('first-signal-wake.png',[311.5,3.6,27],[325,8,21]);
 await run(7);const woke=await p.evaluate(()=>{const F=FCFirstSignal,s=F.debug.siteParts,site=F.site;return{stage:F.stage,ringY:s.rings.map(r=>+r.position.y.toFixed(1)),arch:s.frags.every(f=>Math.abs(f.position.x-(site.x-3.95))<.01),door:!blockedAt(site.x-3.3,2.01,site.z,.3,1.7),inside:!blockedAt(site.x-1.6,2.01,site.z,.3,1.7),beam:s.beam.visible,rec:F.state.rec.includes(3)};});
 assert.deepEqual([woke.stage,woke.ringY.every(y=>y===12),woke.arch,woke.door,woke.inside,woke.beam,woke.rec],[S.LAMP,true,true,true,true,true,true],JSON.stringify(woke));
 await shot('first-signal-door.png',[314,3.7,22.6],[324,3.6,22]);
 await stand(P.lamp[0]-1.5,2,P.lamp[1]);assert.equal(await label(),'Lift the lamp');await p.evaluate(()=>FCFirstSignal.use());
 assert.deepEqual(await p.evaluate(()=>[FCFirstSignal.stage,FCFirstSignal.carry]),[S.HOME,'lamp']);
 console.log('PASS station: rings rise, stones form the arch, the hidden door opens, the lamp can be lifted');

 // 7 · Bring it home. The ending happens in public and stays.
 const homeward=await follow(1,'home');console.log('  homeward',JSON.stringify(homeward));
 assert.equal(homeward.ghosted,false,'she walked home on real ground');
 await stand(P.niche[0]-2.4,1,P.niche[1]);assert.equal(await label(),'Hand over the lamp');await p.evaluate(()=>FCFirstSignal.use());assert.equal(await stage(),S.INSTALL);
 await run(6.5);await shot('first-signal-lights.png',[209.5,2.7,29.5],[218,2.6,33]);
 await p.evaluate(()=>{for(let i=0;i<20&&FCFirstSignal.stage!==FCFirstSignal.stages.DONE;i++)FCFirstSignal.debug.run(1);FCFirstSignal.debug.run(6);});
 const done=await p.evaluate(()=>{const F=FCFirstSignal,a=F.debug.arcadeParts;return{stage:F.stage,crowd:F.crowd?.list.length,lanterns:a.lanterns.every(l=>l.material.emissiveIntensity>1),goods:a.goods.visible,sign:a.sign.material.map===a.signLive,lamp:a.lamp.visible,rec:F.state.rec.length,carry:F.carry,panel:!!document.querySelector('#fs-panel')};});
 assert.deepEqual([done.stage,done.crowd>=5,done.lanterns,done.goods,done.sign,done.lamp,done.rec,done.carry,done.panel],[S.DONE,true,true,true,true,true,6,null,false],JSON.stringify(done));
 await shot('first-signal-arcade.png',[209.5,2.7,36],[218,2.4,31]);
 console.log('PASS ending: lamp installed, lanterns cascade, shutters lift, people gather; the whole adventure ran without a panel');

 // 8 · People use it afterwards, and so can you.
 await p.evaluate(()=>{Player.hp=Math.max(1,Player.hpMax-40);});await stand(P.stallA[0]-1.6,1,P.stallA[1]);assert.equal(await label(),'Take a cup');await p.evaluate(()=>FCFirstSignal.use());assert.equal(await p.evaluate(()=>Player.hp===Player.hpMax),true);
 const teller=await p.evaluate(()=>{const e=FCFirstSignal.crowd.list.find(e=>e.role==='storyteller');return[e.ent.position.x,e.ent.position.z];});
 await stand(teller[0]-2,1,teller[1]+.5);assert.equal(await label(),'Sit and listen');await p.evaluate(()=>FCFirstSignal.use());assert.match(await p.locator('#fs-sub').innerText(),/Listening Station/);
 console.log('PASS afterwards: tea at the stall, a story at the bench');

 // 9 · Optional records, focus, phone width, persistence, replay.
 await p.evaluate(()=>FCFirstSignal.openRecords());await p.waitForSelector('#fs-panel');assert.equal(await p.locator('#fs-panel article:not(.locked)').count(),6);assert.equal(await p.evaluate(()=>State.ui.paused),true);
 await p.setViewportSize({width:390,height:844});assert.ok(await p.locator('#fs-panel').evaluate(e=>e.scrollWidth<=e.clientWidth));await p.screenshot({path:out('first-signal-records-phone.png')});await p.setViewportSize({width:1365,height:900});
 await p.keyboard.press('Escape');assert.deepEqual(await p.evaluate(()=>[!!FCFirstSignal.panel,State.ui.paused]),[false,false]);
 const seed=await p.evaluate(()=>State.citySeed);await p.reload();await boot();
 assert.equal(await p.evaluate(seed=>{State.citySeed=seed;FCFirstSignal.debug.run(.1);return FCFirstSignal.stage;},seed),S.DONE);
 await stand(212,1,32);await run(1);assert.ok(await p.evaluate(()=>FCFirstSignal.crowd?.list.length>=5&&FCFirstSignal.debug.lit>1),'the arcade is still lit and busy after a reload');
 await p.evaluate(()=>FCFirstSignal.restart());await run(.2);
 assert.deepEqual(await p.evaluate(()=>{const F=FCFirstSignal;return[F.stage,F.debug.lit<0,blockedAt(F.places.gate[0],2.01,22,.3,1.7),F.state.rec.length];}),[S.IDLE,true,true,6]);
 assert.deepEqual(errors,[]);
 console.log('PASS records panel, phone layout, saved ending, replay; no browser errors');
 }finally{await browser.close();site.close();}})().catch(e=>{console.error(e);process.exitCode=1});
