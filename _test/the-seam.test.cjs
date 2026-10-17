// The Seam: farming, the market, raids, defences, taming and city wildlife, in a real browser.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-seam-')),day=new Date(Date.now()-3600000).toUTCString();
const feed=host=>`<rss><channel><item><title>Grid operators expect record electricity demand this winter</title><link>https://${host}/a</link><pubDate>${day}</pubDate></item><item><title>Bakers say bread prices will hold steady</title><link>https://${host}/b</link><pubDate>${day}</pubDate></item></channel></rss>`;
const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async url=>new Response(feed(new URL(url).hostname))});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
try{const ctx=await browser.newContext({viewport:{width:1280,height:800}});await ctx.request.post(base+'/api/account/register',{data:{username:'seam_tester',password:'seam farm test 123',displayName:'Sam'}});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/\[seam\]|\[wildlife\]/.test(m.text()))errors.push(m.text())});
 await p.goto(base+'/city/');await p.waitForFunction(()=>window.OwnBlock&&window.FCSeam&&window.FCWildlife&&FCAccounts.user,null,{timeout:120000});
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();try{shSetPeaceful(false)}catch(e){}State.dayTime=13*60;Player.position.set(244,1+Player.height,24.5);updateChunks(true)});
 await p.waitForFunction(()=>['10,0','11,0','10,1','11,1'].every(k=>State.chunkMap.get(k)?.landmark==='seam'),null,{timeout:90000});
 // The ground: a road ring at street level, heaved ground inside, a glowing crack, raised beds.
 const ground=await p.evaluate(()=>({road:shSurfaceY(242.5,20.5,10),heave:shSurfaceY(258.5,20.5,10),bed:shSurfaceY(249.5,17.5,10),crack:FCSeam.FISSURE_CELLS.every(([x,z])=>shSurfaceY(x,z,10)===1),glow:FCSeam.FISSURE_CELLS.some(([x,z])=>getBlock(Math.floor(x),0,Math.floor(z))===150),ledger:shSurfaceY(248.5,24.5,12)}));
 assert.deepEqual([ground.road,ground.heave,ground.bed,ground.crack,ground.glow,ground.ledger],[1,2,3,true,true,7]);
 const sealed=await p.evaluate(()=>{for(let x=245;x<283;x++)for(const z of [5,42])if(shSurfaceY(x+.5,z+.5,10)<2)return [x,z];for(let z=5;z<43;z++)for(const x of [245,282])if(shSurfaceY(x+.5,z+.5,10)<2&&!(x===245&&z>=23&&z<=25))return [x,z];return null});
 assert.equal(sealed,null,'the crack never opens onto the road, so cars stay out');
 console.log('PASS the Seam generates: road ring, heaved ground, a sealed glowing crack, raised beds and the Ledger');
 // First steps: free packets, plant, grow on the real clock, harvest.
 const s1=await p.evaluate(()=>{FCSeam.reset();const S=FCSeam.state;State.hud.credits=500;grantCredits(0);const free=S.packets.wheat;const e=FCSeam.plant(0,'wheat');const bad=FCSeam.plant(4,'wheat');const tub=FCSeam.plant(1,'tuber');return {free,e,left:S.packets.wheat,bad,tub,credits:State.hud.credits,ripeNow:FCSeam.harvest(0)}});
 assert.equal(s1.free,3);assert.equal(s1.e,null);assert.equal(s1.left,2);assert.match(s1.bad,/not ready/);assert.match(s1.tub,/lamp-ward/);assert.equal(s1.credits,500);assert.equal(s1.ripeNow,null);
 const s2=await p.evaluate(()=>{const c=FCSeam.state.plots[0].crop;FCSeam.skew(c.dur+1000);return {p:FCSeam.progress(c),h:FCSeam.harvest(0),crate:FCSeam.state.crate.wheat,harvests:FCSeam.state.harvests}});
 assert.equal(s2.p,1);assert.ok(s2.h.n>=3);assert.equal(s2.crate,s2.h.n);assert.equal(s2.harvests,1);
 console.log('PASS plant from a free packet, grow on the real clock, harvest into the crate; tubers need a ward');
 // The market reads the real wire.
 await p.evaluate(()=>{Player.position.set(256,2+Player.height,20)});
 await p.waitForFunction(()=>FCSeam.wire.items.length>0,null,{timeout:90000});
 const mk=await p.evaluate(()=>{const m=FCSeam.market();return {tuber:m.tuber.hits,wheat:m.wheat.hits,top:m.tuber.top?.title,unit:m.wheat.unit,base:FCSeam.CROPS.wheat.price}});
 assert.ok(mk.tuber>=1,'energy headline moves the tuber price');assert.ok(mk.wheat>=1,'bread headline moves the wheat price');assert.match(mk.top,/electricity/);
 const sold=await p.evaluate(()=>{const before=State.hud.credits,u=FCSeam.market().wheat.unit,got=FCSeam.sell('wheat',1),after=FCSeam.market().wheat.unit;return {got,u,gain:State.hud.credits-before,after,left:FCSeam.state.crate.wheat}});
 assert.equal(sold.got,sold.u);assert.equal(sold.gain,sold.got);assert.ok(sold.after<=sold.u,'selling nudges the price down');
 await p.evaluate(()=>FCSeam.open('market'));await p.waitForSelector('#seam-ledger .real');
 assert.match(await p.locator('#seam-ledger').innerText(),/REAL NEWS[\s\S]*“(Grid operators expect record electricity demand this winter|Bakers say bread prices will hold steady)”/);
 await p.screenshot({path:root+'/_test/out/seam-ledger.png'});
 await p.keyboard.press('Escape');assert.equal(await p.locator('#seam-ledger').count(),0);
 console.log('PASS the Ledger market prices crops from real headlines, quoted and labeled, and selling pays credits');
 // Building: plots gated by rank, wards cost ink, the tuber then grows under the ward.
 const b=await p.evaluate(()=>{const S=FCSeam.state;const lock=FCSeam.unlockPlot(5);S.harvests=8;const ok=FCSeam.unlockPlot(4);const noInk=FCSeam.buildWard(4);S.ink=5;const ward=FCSeam.buildWard(4);const lvl2=FCSeam.buildWard(4);const tub=FCSeam.plant(0,'tuber');return {lock,ok,open:S.plots[4].open,noInk,ward,w:S.wards[4],lvl2,tub,ink:S.ink}});
 assert.match(b.lock,/Reach Grower/,'a Squatter keeps to four plots');assert.equal(b.ok,null);assert.equal(b.open,true);assert.match(b.noInk,/ink/);assert.equal(b.ward,null);assert.equal(b.w,1);assert.match(b.lvl2,/Reach/);assert.equal(b.tub,null);assert.equal(b.ink,2);
 console.log('PASS ranks gate plots and ward levels; wards cost credits and ink; sodium tubers grow under a ward');
 // Raids while away: wards and guards decide, and the report says what happened.
 const away=await p.evaluate(()=>{const S=FCSeam.state;S.plots[2].crop={id:'melon',t0:FCSeam.now(),dur:3.6e6,yield:2};S.lastSim=FCSeam.now()-9*3.6e6;const r=FCSeam.simulateAway();return {raids:r.raids,rep:r.repelled,hits:r.hits.length,report:!!S.report}});
 assert.equal(away.raids,6);assert.equal(away.rep+away.hits,6);assert.ok(away.report);
 console.log('PASS raids while you are away are simulated against your defences and reported');
 // Live raid: Misprints go for a crop, a ward zaps them, a kill drops ink.
 const live=await p.evaluate(()=>{State.dayTime=23*60;const S=FCSeam.state;S.wards[0]=1;const e=FCSeam.spawnMisprint();e.position.set(FCSeam.WARDS[0][0]+5,2,FCSeam.WARDS[0][1]);e.group.position.copy(e.position);const bed=FCSeam.BEDS[2];const d0=Math.hypot(e.position.x-bed[0],e.position.z-bed[1]);for(let i=0;i<40;i++)e.update(.05);const d1=Math.hypot(e.position.x-bed[0],e.position.z-bed[1]);const ink=S.ink,kills=S.kills;return {type:e.type,inEnemies:State.enemies.includes(e),mode:e.mp,d0,d1,ink,kills}});
 assert.equal(live.type,'misprint');assert.equal(live.inEnemies,true);assert.ok(live.d1<live.d0,'it heads for the nearest crop');
 await p.waitForFunction(()=>FCSeam.state.kills>0,null,{timeout:90000,polling:250});
 const after=await p.evaluate(()=>({ink:FCSeam.state.ink,kills:FCSeam.state.kills,live:FCSeam.raid.live.size}));
 assert.ok(after.ink>live.ink,'a dead Misprint drops ink');
 console.log('PASS a Misprint hunts the crops and a lamp-ward kills it for ink');
 const eat=await p.evaluate(()=>{const S=FCSeam.state,c=S.plots[2].crop;c.t0=FCSeam.now()-c.dur*.8;const t0=c.t0,keep=S.wards.slice();const e=FCSeam.spawnMisprint();e.position.set(FCSeam.BEDS[2][0],3,FCSeam.BEDS[2][1]);S.wards=S.wards.map(()=>0);for(let i=0;i<90;i++)e.update(.05);S.wards=keep;return {pushed:c.t0-t0,mode:e.mp}});
 assert.ok(eat.pushed>0,'eating sets the crop back');assert.equal(eat.mode,'flee');
 console.log('PASS a Misprint that reaches a bed eats into the crop and flees back to the crack');
 // Taming: feed a wild creature the crop it loves.
 const tame=await p.evaluate(()=>{State.dayTime=13*60;const S=FCSeam.state;const w=FCSeam.spawnWild();const fav=FCWildlife.SPECIES[w.species].fav;S.crate[fav]=0;const hungry=FCSeam.feed(w);S.crate[fav]=5;const out=[];for(let i=0;i<3&&S.pets.length===0;i++)out.push(FCSeam.feed(w));return {hungry,out,pets:S.pets.map(p=>[p.species,p.mode,p.name]),species:w.species}});
 assert.match(tame.hungry,/wants/);assert.equal(tame.pets.length,1);assert.equal(tame.pets[0][0],tame.species);assert.equal(tame.pets[0][1],'guard');assert.match(tame.out.at(-1),/TAMED/);
 const follow=await p.evaluate(async()=>{const pet=FCSeam.state.pets[0];pet.mode='follow';Player.position.set(180,2+Player.height,26);await new Promise(r=>setTimeout(r,6000));const b=FCSeam.pets.find(x=>x.pet.id===pet.id);return {vis:b.group.visible,d:Math.hypot(b.group.position.x-Player.position.x,b.group.position.z-Player.position.z)}});
 assert.equal(follow.vis,true);assert.ok(follow.d<6,'a following pet keeps up across the city: '+follow.d);
 console.log('PASS feeding tames a creature; it guards by default and can follow you through the city');
 // Interaction: walk up to a bed, press E, plant from the panel.
 await p.evaluate(()=>{const S=FCSeam.state;S.plots[3].crop=null;S.packets.melon=1;Player.position.set(FCSeam.BEDS[3][0]+3.2,2+Player.height,FCSeam.BEDS[3][1]);Player.yaw=Math.PI/2});
 await p.waitForFunction(()=>FCSeam.near?.type==='plot'&&!document.getElementById('seam-approach').hidden,null,{timeout:60000,polling:250});
 await p.keyboard.press('KeyE');await p.waitForSelector('#seam-plot');
 await p.screenshot({path:root+'/_test/out/seam-plot.png'});
 await p.keyboard.press('Digit2');await p.waitForFunction(()=>FCSeam.state.plots[3].crop?.id==='melon');
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>State.ui.paused),false);
 console.log('PASS walk up to a bed, press E, plant with a number key; play resumes');
 // Wildlife in the city.
 const wl=await p.evaluate(async()=>{State.dayTime=23*60;FCWildlife._spawnFlock();FCWildlife._eelNow();await new Promise(r=>setTimeout(r,4000));return FCWildlife.counts});
 assert.ok(wl.pigeons>0,'pigeons land near you');
 console.log('PASS city wildlife: many-winged pigeons land near you'+(wl.moths?', lamp moths swarm the lights':''));
 // Saved per account.
 await p.evaluate(()=>FCSeam.save());await p.reload();await p.waitForFunction(()=>window.FCSeam&&FCAccounts.user,null,{timeout:120000});
 const kept=await p.evaluate(()=>({pets:FCSeam.state.pets.length,ward:FCSeam.state.wards[4],melon:FCSeam.state.plots[3].crop?.id}));
 assert.deepEqual(kept,{pets:1,ward:1,melon:'melon'});
 console.log('PASS the farm, wards and pets survive a reload');
 assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
