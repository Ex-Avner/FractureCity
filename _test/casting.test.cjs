// 0.81: the Casting Booth, spawned NPCs (solo and shared online), weird fauna
// and street events.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const T={timeout:240000},wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-cast-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/^\[(npcs|booth|fauna|street-events|npc-voices)\]/.test(m.text()))errors.push(m.text())});return p};
const settle=(p,n=25)=>p.evaluate(async n=>{for(let i=0;i<n;i++)await new Promise(r=>setTimeout(r,100))},n);
try{
 const p=watch(await (await browser.newContext({viewport:{width:1366,height:820}})).newPage());
 await p.goto(base+'/city/',T);await p.waitForFunction(()=>window.OwnBlock&&window.FCCastingBooth&&window.FCNpcs&&window.FCFauna&&window.FCStreetEvents,null,T);
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.dayTime=13*60;if(State.ui.freeBuild)shToggleFreeBuild();State.hud.credits=400;Player.position.set(161.9,1+Player.height,49.2);Player.yaw=0;Player.pitch=-.05});
 await settle(p,30);
 // ── The booth ──
 const booth=await p.evaluate(()=>({here:!!State.chunkMap.get(chunkCoordOf(164)+','+chunkCoordOf(45))?.group?.getObjectByName('casting-booth'),walls:State.chunkMap.get(chunkCoordOf(164)+','+chunkCoordOf(45)).collisionAABBs.filter(a=>a.minX>=160&&a.maxX<=168&&a.minZ>=42&&a.maxZ<=48).length,near:FCCastingBooth.near()}));
 assert.deepEqual(booth,{here:true,walls:5,near:true});
 const myHair=await p.evaluate(()=>Shift.avatar.hairStyle);
 await p.keyboard.press('e');await p.waitForSelector('#fc-casting:not([hidden]) canvas',T);
 await p.locator('#fc-casting [data-role="bodyguard"]').click(T);
 assert.equal(await p.locator('#fc-casting [data-unlock]').count(),1,'paid roles show an unlock');
 await p.locator('#fc-casting [data-unlock]').click(T);await p.waitForFunction(()=>!document.querySelector('#fc-casting [data-unlock]'),null,T);
 assert.equal(await p.evaluate(()=>State.hud.credits),250);
 await p.locator('#fc-casting [data-role="busker"]').click(T);
 await p.locator('#fc-casting [data-tab="story"]').click(T);
 await p.locator('#fc-casting [data-field="name"]').fill('Juno Static');await p.locator('#fc-casting [data-reroll="secret"]').click(T);
 await p.locator('#fc-casting [data-tab="look"]').click(T);await p.locator('#fc-casting [data-look="wardrobe"]').click(T);
 await p.waitForSelector('#fc-wardrobe:not([hidden])',T);assert.match(await p.locator('#fc-wardrobe h2').textContent(),/Juno/);
 await p.locator('#fc-wardrobe [data-group="hair"]').click(T);await p.locator('#fc-wardrobe [data-slot="hairStyle"][data-val="mohawk"]').click(T);await p.locator('#fc-wardrobe [data-save]').click(T);
 await p.waitForSelector('#fc-casting:not([hidden])',T);assert.equal(await p.evaluate(()=>FCCastingBooth.draft.look.hairStyle),'mohawk','the wardrobe dresses the NPC, not you');
 assert.equal(await p.evaluate(()=>Shift.avatar.hairStyle),myHair);
 await p.screenshot({path:root+'/_test/out/casting-booth.png',...T});
 await p.locator('#fc-casting [data-spawn="booth"]').click(T);await p.waitForFunction(()=>FCNpcs.list.some(n=>n.story.name==='Juno Static'),null,T);
 await p.locator('#fc-casting [data-tab="cast"]').click(T);assert.equal(await p.locator('#fc-casting .cb-cast li').count(),1);
 await p.keyboard.press('Escape');await p.waitForFunction(()=>document.getElementById('fc-casting').hidden,null,T);
 console.log('PASS the Casting Booth: kiosk and counter in Common Ground, roles, unlocks, story, wardrobe for the NPC, spawn, cast list');
 // ── Every role, in solo ──
 //  Creative unlocks every role in a solo city.
 const roles=await p.evaluate(async()=>{if(!State.ui.freeBuild)shToggleFreeBuild();const B=FCNpcBrain,bad=[];let i=0;
  for(const role of Object.keys(B.ROLES)){if(role==='courier')continue;try{await FCNpcs.spawn({role,story:B.story(role,role),look:FCWardrobe.crowdLook(null,new RNG(role),B.ROLES[role].scenes),x:150+(i%6)*2.5,z:58+Math.floor(i/6)*2.5})}catch(e){bad.push(role+': '+e.message)}i++}
  for(let k=0;k<600&&new Set(FCNpcs.list.map(n=>n.act)).size<6;k++)await new Promise(r=>setTimeout(r,100));
  for(const [id,e] of FCNpcs.entries){e.group.traverse(o=>{if(o.geometry)for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))bad.push('nan '+e.role)});const p=e.group.position;if(!Number.isFinite(p.x+p.y+p.z))bad.push('pos '+e.role)}
  return{bad,n:FCNpcs.list.length,acts:[...new Set(FCNpcs.list.map(n=>n.act))]}});
 assert.deepEqual(roles.bad,[]);assert.ok(roles.n>=20,'all roles out: '+roles.n);assert.ok(roles.acts.length>=6,'acts: '+roles.acts+' '+errors.join(' | ')+' paused='+(await p.evaluate(()=>State.ui.paused)));
 assert.match((await p.evaluate(()=>FCNpcs.spawn({role:'courier'}).then(()=>'ok',e=>e.message))),/online/);
 await p.evaluate(()=>{Player.position.set(160,1+Player.height,66);Player.yaw=0;Player.pitch=-.12});await settle(p,10);
 await p.screenshot({path:root+'/_test/out/casting-cast.png',...T});
 console.log('PASS every role spawns and acts in a solo city ('+roles.n+' NPCs; '+roles.acts.join(', ')+')');
 // ── Talking, errands ──
 const talk=await p.evaluate(async()=>{const f=FCNpcs.list.find(n=>n.role==='fixer');Player.position.set(f.x,f.y+Player.height,f.z+1.5);for(let k=0;k<6;k++)await new Promise(r=>setTimeout(r,100));const opened=FCNpcs.talk(FCNpcs.entries.get(f.id));await new Promise(r=>setTimeout(r,200));const labels=[...document.querySelectorAll('#npc-talk [data-i]')].map(b=>b.textContent);return{opened,labels}});
 assert.ok(talk.opened);assert.ok(talk.labels.some(l=>/work/.test(l)),'fixers offer work: '+talk.labels);
 await p.locator('#npc-talk button',{hasText:'Got any work?'}).click(T);
 const q=await p.evaluate(()=>FCNpcs.quest);assert.ok(q&&q.text&&q.reward>0);
 await p.keyboard.press('Escape');
 //  Finish it the quick way for each kind.
 await p.evaluate(async()=>{const q=FCNpcs.quest;if(q.kind==='find'){const t=FCNpcs.list.find(n=>n.id===q.target);Player.position.set(t.x,t.y+Player.height,t.z+1.4);for(let k=0;k<6;k++)await new Promise(r=>setTimeout(r,100));FCNpcs.talk(FCNpcs.entries.get(t.id));await new Promise(r=>setTimeout(r,200));[...document.querySelectorAll('#npc-talk [data-i]')].find(b=>/sorted/.test(b.textContent)).click();await new Promise(r=>setTimeout(r,100));NPCVoices.close()}else{Player.position.set(q.x,shSurfaceY(q.x,q.z,30)+Player.height,q.z);for(let k=0;k<(q.kind==='watch'?450:300);k++){await new Promise(r=>setTimeout(r,100));if(FCNpcs.quest.done)break}}});
 assert.ok(await p.evaluate(()=>FCNpcs.quest.done),'errand done '+await p.evaluate(()=>JSON.stringify([FCNpcs.quest,Player.position,State.ui.paused,NPCVoices.open])));
 const credits=await p.evaluate(async()=>{const before=State.hud.credits,f=FCNpcs.list.find(n=>n.id===FCNpcs.quest.fixer);Player.position.set(f.x,f.y+Player.height,f.z+1.5);for(let k=0;k<6;k++)await new Promise(r=>setTimeout(r,100));FCNpcs.talk(FCNpcs.entries.get(f.id));await new Promise(r=>setTimeout(r,200));[...document.querySelectorAll('#npc-talk [data-i]')].find(b=>/Pay up/.test(b.textContent)).click();await new Promise(r=>setTimeout(r,100));NPCVoices.close();return State.hud.credits-before});
 assert.ok(credits>0,'paid for the errand');
 console.log('PASS talking: backstory voices, fixer errands paid ('+q.kind+', +'+credits+')');
 // ── Trouble in solo ──
 //  Leaving Common Ground is covered by the server test (and slow here); this one starts just outside it.
 const fight=await p.evaluate(async()=>{const at=shFindOpenSpot(134,40,.3,1.7,20);const [id]=await FCNpcs.spawn({role:'brawler',x:at.x,y:at.y,z:at.z});const b=FCNpcs.list.find(n=>n.id===id);
  const out=!FCNpcBrain.inSafe(b.x,b.z)&&b.mode!=='leave';Player.hp=100;for(let k=0;k<900&&Player.hp>=100;k++){Player.position.set(b.x+.9,b.y+Player.height,b.z);Player.invulnTime=0;await new Promise(r=>setTimeout(r,100))}
  const hurt=Player.hp<100;FCNpcBrain.strike(null,b,200);return{out,hurt,down:b.mode==='down'}});
 assert.deepEqual(fight,{out:true,hurt:true,down:true});
 console.log('PASS trouble outside Common Ground picks a fight and can be knocked down');
 // ── Fauna and street events ──
 await p.evaluate(async()=>{Player.position.set(176,1+Player.height,46);Player.yaw=0;State.dayTime=22*60;for(const k of FCFauna.species){FCFauna.spawn(k);FCFauna.spawn(k)}for(let k=0;k<20;k++)await new Promise(r=>setTimeout(r,100))});
 const fauna=await p.evaluate(()=>{const bad=[];for(const k of FCFauna.species){const c=FCFauna.make(k);c.group.traverse(o=>{if(o.geometry)for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))bad.push(k)});}return{bad,counts:FCFauna.counts}});
 assert.deepEqual(fauna.bad,[]);assert.ok(Object.values(fauna.counts).filter(n=>n>0).length>=5,'fauna about: '+JSON.stringify(fauna.counts));
 const evs=await p.evaluate(async()=>{const ok=[];for(const k of FCStreetEvents.kinds){FCStreetEvents.end();for(let i=0;i<4&&!FCStreetEvents.start(k);i++){Player.yaw+=1.6;await new Promise(r=>setTimeout(r,50))}const c=FCStreetEvents.current;if(c&&c.kind===k&&c.people>=3)ok.push(k);await new Promise(r=>setTimeout(r,400))}return ok});
 assert.ok(evs.length>=5,'street events: '+evs);
 await p.evaluate(()=>{FCStreetEvents.end();FCStreetEvents.start('flashmob')});await settle(p,40);
 await p.screenshot({path:root+'/_test/out/casting-street.png',...T});
 console.log('PASS weird fauna ('+JSON.stringify(fauna.counts)+') and street events ('+evs.join(', ')+')');
 await p.context().close();
 // ── Online: one shared NPC ──
 //  One browser resident (two heavy pages starve each other in this headless
 //  browser) and one resident speaking the protocol directly, like the wardrobe test.
 const ctx=await browser.newContext({viewport:{width:1280,height:720}});
 assert.equal((await ctx.request.post(base+'/api/account/register',{data:{username:'cast_a',password:'casting test password 1',displayName:'Ash'}})).status(),200);
 const code=(await (await ctx.request.post(base+'/api/join',{data:{public:true}})).json()).code;
 const a=watch(await ctx.newPage());
 for(let i=0;;i++){await a.goto(base+'/city/?online='+code,T);if(await a.waitForFunction(()=>window.FCCityOnline?.ready&&FCCityOnline.connected,null,{timeout:240000}).then(()=>true,()=>false))break;if(i===2)throw Error('could not join the online city');console.log('retrying the join')}
 //  Bo joins after Ash is in (an idle resident is dropped after 45 s) and keeps reporting a pose.
 const reg=await fetch(base+'/api/account/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:'cast_b',password:'casting test password 1',displayName:'Bo'})}),cookie=reg.headers.get('set-cookie').split(';')[0];
 const jb=await (await fetch(base+'/api/join',{method:'POST',headers:{'Content-Type':'application/json',cookie,Origin:base},body:JSON.stringify({public:true})})).json();
 const bo=(route,data)=>fetch(base+'/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',cookie,Origin:base,Authorization:'Bearer '+jb.token},body:data?JSON.stringify(data):undefined}).then(async r=>({status:r.status,data:await r.json()}));
 const stream=await fetch(base+'/api/events',{headers:{Authorization:'Bearer '+jb.token,cookie}});const reader=stream.body.getReader();(async()=>{try{while(!(await reader.read()).done);}catch(e){}})();
 const keepAlive=setInterval(()=>bo('ready',{ready:true}).catch(()=>{}),5000);
 await a.evaluate(()=>{HD.locked=true;HD.setTier('perf',true)});
 assert.equal(await a.evaluate(()=>FCNpcs.spawn({role:'wanderer',story:{...FCNpcBrain.story('wanderer','w1'),name:'Rook Halloran'},look:{...FCWardrobe.DEFAULT_LOOK,hairStyle:'liberty',hair:'#39ff14'}}).then(()=>'ok',e=>e.message)),'ok');
 const room=app.rooms.get(code),npc=[...room.npcs.values()].find(n=>n.story.name==='Rook Halloran');
 assert.notEqual(npc.look.hairStyle,'liberty','rare pieces need owning online');assert.equal(npc.look.hair,'#39ff14');
 const seen=await bo('city-npcs');assert.equal(seen.data.npcs?.[npc.id]?.story.name,'Rook Halloran','the other resident gets the story and look');
 const me=[...room.players.values()].find(q=>q.name==='Ash'),them=room.players.get(jb.id);Object.assign(them,{x:me.x+30,z:me.z});
 let sim=null,sync=false;
 for(let i=0;i<40&&!(sim===me.id&&sync);i++){await wait(1000);sim=npc.sim;const at=await a.evaluate(id=>{const e=FCNpcs.entries.get(id);return e&&{x:e.group.position.x,z:e.group.position.z,v:e.group.visible}},npc.id);if(at&&at.v&&Math.hypot(at.x-npc.x,at.z-npc.z)<3)sync=true}
 assert.equal(sim,me.id,'the nearest resident moves it');assert.ok(sync,'the resident sees it where the server has it');
 assert.equal((await bo('npc-dismiss',{id:npc.id})).status,403,'only its owner dismisses it');
 await a.screenshot({path:root+'/_test/out/casting-online.png',...T});
 console.log('PASS online: the server owns the NPC, the nearest resident moves it, everyone gets its story and look, only its owner dismisses it');
 clearInterval(keepAlive);reader.cancel().catch(()=>{});await ctx.close();
 // ── Phone ──
 const m=watch(await (await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage());
 await m.goto(base+'/city/',T);await m.waitForFunction(()=>window.OwnBlock&&window.FCCastingBooth,null,T);await m.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();FCCastingBooth.open()});
 await m.waitForSelector('#fc-casting:not([hidden]) canvas',T);await m.waitForTimeout(1200);
 assert.ok(await m.evaluate(()=>{const r=document.getElementById('fc-casting').getBoundingClientRect(),side=document.querySelector('#fc-casting .cb-side');return r.right<=innerWidth+1&&side.scrollWidth<=side.clientWidth+1}),'the booth fits a phone');
 await m.screenshot({path:root+'/_test/out/casting-phone.png',...T});
 console.log('PASS the Casting Booth fits a phone');
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
