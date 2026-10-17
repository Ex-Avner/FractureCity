// NPC conversations, memory and real-news lines, in a real browser.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-npc-')),now=Date.now(),day=new Date(now-3600000).toUTCString();
const feed=host=>`<rss><channel><item><title>Astronomers find a cloud shaped exactly like a teapot</title><link>https://${host}/a</link><pubDate>${day}</pubDate></item><item><title>Hundreds killed as storm hits coast</title><link>https://${host}/b</link><pubDate>${day}</pubDate></item></channel></rss>`;
const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async url=>new Response(feed(new URL(url).hostname))});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
try{const ctx=await browser.newContext({viewport:{width:1280,height:800}});await ctx.request.post(base+'/api/account/register',{data:{username:'npc_tester',password:'npc voices test 123',displayName:'Tess'}});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/city/');await p.waitForFunction(()=>window.OwnBlock&&window.NPCVoices&&FCAccounts.user,null,{timeout:120000});
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start()});
 await p.waitForFunction(()=>NPCVoices.news().length>0,null,{timeout:60000});
 const titles=await p.evaluate(()=>NPCVoices.news().map(n=>n.title));
 assert.ok(titles.every(t=>/teapot/.test(t)),'heavy headline filtered: '+titles.join(' | '));
 console.log('PASS real headlines load from the wire; the "killed" story is filtered out');
 const person=(arch,handle)=>p.evaluate(([arch,handle])=>{const n=State.globalNPCs[0]||{char:{group:new THREE.Group(),handle:'@x',archetype:'drifter'},position:Player.position.clone()};window.__p={char:{...n.char,archetype:arch,handle,group:n.char.group},pos:n.position,kind:'street'};shTalkTo(window.__p);return !!document.getElementById('npc-talk')},[arch,handle]);
 const opts=()=>p.$$eval('#npc-talk [data-i]',els=>els.map(e=>e.textContent));
 const choose=async re=>{const o=await opts();const i=o.findIndex(t=>re.test(t));assert.ok(i>=0,'option '+re+' in '+o.join(' / '));await p.locator('#npc-talk [data-i="'+i+'"]').click()};
 // First meeting: introduce yourself, hear part of their story, leave.
 assert.ok(await person('busker','@testbusker'));assert.equal(await p.evaluate(()=>State.ui.paused),true);
 await choose(/I’m Tess/);assert.match(await p.locator('#npc-talk .line').innerText(),/Tess/);
 await choose(/story/);await choose(/See you around/);await choose(/Leave/);
 assert.equal(await p.locator('#npc-talk').count(),0);assert.equal(await p.evaluate(()=>State.ui.paused),false);
 console.log('PASS conversation with replies: name, story, goodbye; play resumes');
 // Second meeting: they know your name, the count, and the story continues.
 await person('busker','@testbusker');const head=await p.locator('#npc-talk header').innerText(),line=await p.locator('#npc-talk .line').innerText();
 assert.match(line,/Tess/);assert.match(head,/MET 2×/);assert.ok((await opts()).some(t=>/what happened next/.test(t)));
 await p.keyboard.press('Escape');console.log('PASS they remember your name, how often you met, and where the story left off');
 // Rudeness is remembered.
 await person('clerk','@testclerk');await choose(/Not interested/);await choose(/Leave/);
 await person('clerk','@testclerk');assert.match(await p.locator('#npc-talk .line').innerText(),/short with me/);assert.match(await p.locator('#npc-talk header').innerText(),/COLD/);await p.keyboard.press('Escape');
 console.log('PASS being rude is remembered and cools the greeting');
 // Memory survives a reload, per account.
 await p.reload();await p.waitForFunction(()=>window.NPCVoices&&FCAccounts.user,null,{timeout:120000});
 assert.equal(await p.evaluate(()=>NPCVoices.memory()['busker:@testbusker'].knowsName),true);
 console.log('PASS memory survives a reload');
 // Real news: quoted exactly, labeled, sourced, linked.
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start()});await p.waitForFunction(()=>NPCVoices.news().length>0,null,{timeout:60000});
 let got=null;for(let i=0;i<40&&!got;i++){await person('courier','@courier'+i);await choose(/going on around here/);if(await p.locator('#npc-talk .real').count())got=i;else await p.keyboard.press('Escape')}
 assert.ok(got!==null,'a courier eventually quotes the wire');
 assert.match(await p.locator('#npc-talk .real').innerText(),/REAL NEWS/);assert.match(await p.locator('#npc-talk blockquote').innerText(),/^“Astronomers find a cloud shaped exactly like a teapot”$/);
 await p.screenshot({path:root+'/_test/out/npc-real-news.png'});
 await choose(/Where’s that from/);const link=await p.locator('#npc-talk a[href]').getAttribute('href');assert.match(link,/^https:\/\/[a-z.]+\/a$/);
 await p.keyboard.press('Escape');console.log('PASS a courier quotes a real headline verbatim, tagged REAL NEWS, with source and link');
 // Roles that do not read the wire never quote it.
 for(let i=0;i<12;i++){await person('punk','@punk'+i);await choose(/going on around here/);assert.equal(await p.locator('#npc-talk .real').count(),0);await p.keyboard.press('Escape')}
 console.log('PASS other roles keep to their own rumours');
 assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
