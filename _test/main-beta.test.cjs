// Main Beta in real browsers: the lobby button, the ?main=1 link, two residents
// in one code-free city, and the Common Ground theory library and listening
// booth on desktop and on a touch phone.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const OUT=path.join(root,'_test','out');
(async()=>{fs.mkdirSync(OUT,{recursive:true});const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-mainbeta-')),app=createServer({dbPath:path.join(dir,'t.sqlite'),owners:['beta_owner'],maxRooms:3,newsFetch:async()=>new Response('<rss><channel></channel></rss>')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
const watch=p=>p.on('pageerror',e=>errors.push(e.message));
//  Walk in short steps: the server rejects position jumps, as it should.
async function walk(p,x,z){for(let i=0;i<80;i++){const done=await p.evaluate(([x,z])=>{const dx=x-Player.position.x,dz=z-Player.position.z,d=Math.hypot(dx,dz);if(d<.3)return true;const s=Math.min(1.2,d)/d;Player.position.x+=dx*s;Player.position.z+=dz*s;Player.velocity.set(0,0,0);return false},[x,z]);if(done)return;await p.waitForTimeout(160)}throw Error('could not walk to '+x+','+z)}
try{
 // ── Resident one: the lobby button ─────────────────────────────────────
 const a=await browser.newContext({viewport:{width:1440,height:900}});await a.request.post(base+'/api/account/register',{data:{username:'beta_owner',password:'main beta browser test',displayName:'Owner'}});
 const p=await a.newPage();watch(p);await p.goto(base+'/');await p.locator('#main-beta').waitFor();
 await p.waitForFunction(()=>/Nobody is in yet/.test(document.getElementById('main-count').textContent),null,{polling:500,timeout:60000});
 await p.screenshot({path:OUT+'/main-beta-lobby.png'});
 await p.waitForFunction(()=>window.FCAccounts?.user,null,{polling:500,timeout:60000});await p.locator('#main-beta').click();
 await p.waitForURL(/\/city\/\?online=[A-F0-9]{10}$/,{timeout:30000,waitUntil:'commit'});await p.waitForFunction(()=>window.FCCityOnline?.ready,null,{polling:500,timeout:60000});
 await p.evaluate(()=>{HD.locked=true;HD.setTier('perf',true)});
 assert.equal(await p.evaluate(()=>FCCityOnline.room.public),true);
 await p.waitForFunction(()=>/Main Beta/.test(document.getElementById('city-online-status').textContent),null,{polling:500,timeout:60000});
 console.log('PASS lobby Main Beta button enters the live public city with no code or ready-up');
 // ── Resident two: the shareable link ───────────────────────────────────
 const b=await browser.newContext({viewport:{width:1280,height:800}});await b.request.post(base+'/api/account/register',{data:{username:'beta_visitor',password:'main beta browser test',displayName:'Visitor'}});
 const q=await b.newPage();watch(q);await q.goto(base+'/?main=1');await q.waitForURL(/\/city\/\?online=/,{timeout:30000,waitUntil:'commit'});await q.waitForFunction(()=>window.FCCityOnline?.ready,null,{polling:500,timeout:60000});await q.evaluate(()=>{HD.locked=true;HD.setTier('perf',true)});
 assert.equal(await q.evaluate(()=>FCCityOnline.room.code),await p.evaluate(()=>FCCityOnline.room.code));
 const info=async x=>x.evaluate(()=>JSON.stringify({players:FCCityOnline.room?.players.length,peers:FCCityOnline.peers.size,connected:FCCityOnline.connected,ready:FCCityOnline.ready}));
 await p.waitForFunction(()=>FCCityOnline.peers.size===1,null,{polling:500,timeout:60000}).catch(async e=>{throw Error('owner sees '+await info(p)+' visitor sees '+await info(q))});await q.waitForFunction(()=>FCCityOnline.peers.size===1,null,{polling:500,timeout:60000}).catch(async e=>{throw Error('visitor sees '+await info(q))});
 console.log('PASS /?main=1 link lands a second account in the same city; both see each other');
 await q.close();
 // ── A brand-new person: the link, sign up, save the key, straight in ───
 const n=await browser.newContext({viewport:{width:1280,height:800}}),np=await n.newPage();watch(np);await np.goto(base+'/?main=1');
 await np.locator('#account-register').click();await np.locator('[name=username]').fill('beta_newcomer');await np.locator('[name=displayName]').fill('Newcomer');await np.locator('[name=password]').fill('main beta browser test');await np.locator('#account-auth button').click();
 await np.locator('#saved-key').waitFor();await np.locator('#saved-key').click();await np.waitForURL(/\/city\/\?online=/,{timeout:60000,waitUntil:'commit'});
 await np.waitForFunction(()=>window.FCCityOnline?.ready&&FCCityOnline.room.public,null,{polling:500,timeout:90000});await np.close();await n.close();
 console.log('PASS a new person follows /?main=1, creates an account, saves the key and arrives without a code');
 // ── The theory library ─────────────────────────────────────────────────
 const lib=await p.evaluate(()=>FCCommonGround.kiosks.find(k=>k.id==='library').approach);await walk(p,lib.x,lib.z);
 await p.evaluate(()=>{Player.yaw=Math.PI;Player.pitch=.05});await p.waitForFunction(()=>FCCommonGround.near==='library'&&!document.getElementById('cg-approach').hidden,null,{polling:500,timeout:30000}).catch(async()=>{throw Error('near: '+await p.evaluate(()=>JSON.stringify({near:FCCommonGround.near,pos:[Player.position.x,Player.position.y-Player.height,Player.position.z],enabled:OwnBlock.state.enabled,ready:OwnBlock.ready,intro:State.ui.inIntro,paused:State.ui.paused,hidden:document.getElementById('cg-approach').hidden,root:!!FCCommonGround.root,modal:!!OwnBlock.modal,acct:FCAccounts.visible,news:FCNewsHub.isOpen,writing:CitySocial.writing})))});
 await p.screenshot({path:OUT+'/main-beta-kiosks.png'});
 await p.keyboard.press('e');await p.locator('#cg-library').waitFor();await p.waitForFunction(()=>FCCommonGround.book?.chapters.length>0,null,{polling:500,timeout:20000});
 assert.match(await p.locator('#cg-library aside h2').innerText(),/Collapse of Meaning/);
 assert.ok((await p.locator('#cg-library p.body').count())>5);assert.equal(await p.evaluate(()=>State.ui.paused),true);
 await p.screenshot({path:OUT+'/main-beta-library.png'});
 await p.locator('[data-step="1"]').click();assert.equal(await p.evaluate(()=>FCCommonGround.chapter),1);
 await p.keyboard.press('Escape');assert.equal(await p.locator('#cg-library').count(),0);assert.equal(await p.evaluate(()=>State.ui.paused),false);
 console.log('PASS theory library opens with E, reads chapters, Escape returns to the street');
 // ── The listening booth ────────────────────────────────────────────────
 const booth=await p.evaluate(()=>FCCommonGround.kiosks.find(k=>k.id==='booth').approach);await walk(p,booth.x,booth.z);
 await p.waitForFunction(()=>FCCommonGround.near==='booth'&&!document.getElementById('cg-approach').hidden,null,{polling:500,timeout:30000});
 await p.locator('#cg-approach').click();await p.locator('#cg-booth').waitFor();await p.waitForFunction(()=>document.querySelectorAll('#cg-booth [data-track]').length===13,null,{polling:500,timeout:20000});
 await p.locator('#cg-booth [data-track="2"]').click();
 const src=await p.evaluate(()=>({src:PalmMedia.audio?.src||'',cur:PalmMedia.order[PalmMedia.pos]}));assert.match(src.src,/\/media\/music\/03\.mp3$/);assert.equal(src.cur,2);
 await p.screenshot({path:OUT+'/main-beta-booth.png'});await p.locator('#cg-booth [data-close]').click();assert.equal(await p.evaluate(()=>State.ui.paused),false);
 console.log('PASS listening booth lists all 13 tracks and starts the chosen one on Palm Radio');
 // ── A touch phone ──────────────────────────────────────────────────────
 const reqlog=[];app.server.on('request',(req,res)=>{if(!/city-pose|\/api\/input|\.js|\.png|\.json|\.mp3/.test(req.url)||/join|leave|account/.test(req.url))res.on('finish',()=>reqlog.push(req.method+' '+req.url.slice(0,60)+' '+res.statusCode))});
 const m=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,storageState:await b.storageState()});
 await m.addInitScript(()=>Object.defineProperty(document,'exitPointerLock',{value:undefined,configurable:true}));
 await p.close();const t=await m.newPage();watch(t);await t.goto(base+'/?main=1');await t.waitForURL(/\/city\/\?online=/,{timeout:30000,waitUntil:'commit'});await t.waitForFunction(()=>window.FCCityOnline?.ready,null,{polling:500,timeout:90000}).catch(async e=>{console.log('REQS',reqlog.filter(x=>/api/.test(x)).join(' | '));throw e});await t.evaluate(()=>{HD.locked=true;HD.setTier('perf',true)});
 const lib2=await t.evaluate(()=>FCCommonGround.kiosks.find(k=>k.id==='library').approach);await walk(t,lib2.x,lib2.z);
 await t.waitForFunction(()=>!document.getElementById('cg-approach').hidden,null,{polling:500,timeout:30000}).catch(async()=>{await t.screenshot({path:OUT+'/phone-fail.png'});console.log('REQS',reqlog.filter(x=>/api/.test(x)).join(' | '));console.log('SERVER players',JSON.stringify([...app.rooms.values()].map(r=>[r.code,[...r.players.values()].map(p=>[p.name,!!p.stream,Date.now()-p.seen])])),'tokens',app.tokens.size);console.log('CLIENT',await t.evaluate(async()=>{const s=JSON.parse(sessionStorage.getItem('fc-district-session')||'null');const r=await fetch('/api/events',{headers:{Authorization:'Bearer '+(s&&s.token)}});const out=r.status;return JSON.stringify({s:!!s,status:out,self:!!FCCityOnline.self})}));throw Error('phone: '+await t.evaluate(()=>[...document.body.children].filter(e=>{const c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden'&&e.getBoundingClientRect().width>200&&+c.zIndex>50}).map(e=>e.id||e.className).join(','))+await t.evaluate(()=>JSON.stringify({near:FCCommonGround.near,pos:[Player.position.x,Player.position.y-Player.height,Player.position.z],enabled:OwnBlock.state.enabled,ready:OwnBlock.ready,intro:State.ui.inIntro,paused:State.ui.paused,arcade:State.ui.inArcade,dlg:State.ui.inDialogue,root:!!FCCommonGround.root,modal:!!OwnBlock.modal,acct:FCAccounts.visible,news:FCNewsHub.isOpen,writing:CitySocial.writing,art:CityArt.panelOpen,build:CityBuild.panelOpen})))});await t.locator('#cg-approach').tap();await t.locator('#cg-library').waitFor();await t.waitForFunction(()=>FCCommonGround.book,null,{polling:500,timeout:20000});
 assert.ok(await t.evaluate(()=>document.querySelector('#cg-library').getBoundingClientRect().right<=innerWidth+1));assert.ok(await t.evaluate(()=>{const r=document.querySelector('#cg-library').getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>=0}));
 await t.locator('#cg-library [data-ch="3"]').tap();assert.equal(await t.evaluate(()=>FCCommonGround.chapter),3);
 await t.screenshot({path:OUT+'/main-beta-library-phone.png'});await t.locator('#cg-library [data-close]').tap();assert.equal(await t.evaluate(()=>State.ui.paused),false);
 console.log('PASS landscape phone: tap the prompt, the reader fits the screen, chapter tap works, close returns to play');
 assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
