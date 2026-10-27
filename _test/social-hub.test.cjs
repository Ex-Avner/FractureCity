// 0.82: the social hub. Feed, posting, hearts, threads, profiles with
// portraits, people search, the shared design tokens, and phones.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const T={timeout:240000};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-hub-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),owners:['hub_ash'],newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));return p};
try{
 //  Bo, outside the browser: a post with a photo, and a look.
 const reg=await fetch(base+'/api/account/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:'hub_bo',password:'hub test password 123',displayName:'Bo Static'})}),cookie=reg.headers.get('set-cookie').split(';')[0];
 const bo=(route,data)=>fetch(base+'/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',cookie,Origin:base},body:data?JSON.stringify(data):undefined}).then(r=>r.json());
 const photo=await bo('media',{mime:'image/png',name:'p.png',data:png.toString('base64')});
 await bo('social/profile',{tagline:'Drums, mostly.',look:{hairStyle:'mohawk',hair:'#39ff14',outfit:'leather'}});
 await bo('social/post',{title:'Gig tonight',text:'Basement under the laundromat. Bring earplugs.',photo:photo.id});
 //  Ash, in the browser.
 const ctx=await browser.newContext({viewport:{width:1366,height:820}});
 assert.equal((await ctx.request.post(base+'/api/account/register',{data:{username:'hub_ash',password:'hub test password 123',displayName:'Ash Vale'}})).status(),200);
 const p=watch(await ctx.newPage());
 await p.goto(base+'/city/',T);await p.waitForFunction(()=>window.OwnBlock&&window.FCSocialHub&&window.FCAccounts?.user,null,T);
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.ui.paused=false});
 assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--fc-pink').trim()),'#ff2e88','shared design tokens');
 await p.keyboard.press('o');await p.waitForSelector('#fc-social:not([hidden]) .sx-card',T);
 assert.match(await p.locator('#fc-social .sx-card').first().textContent(),/Gig tonight/);
 assert.equal(await p.locator('#fc-social .sx-card img.sx-photo').count(),1,'photos show in the feed');
 //  Post from the composer.
 await p.locator('#fc-social .sx-compose textarea').fill('First night in the city. Who is playing?');await p.locator('#fc-social .sx-compose button.hot').click(T);
 await p.waitForFunction(()=>document.querySelector('#fc-social .sx-card')?.textContent.includes('First night in the city'),null,T);
 //  Heart Bo's post, open the thread, reply.
 const boCard=p.locator('#fc-social .sx-card',{hasText:'Gig tonight'});
 await boCard.locator('[data-heart]').click(T);await p.waitForFunction(()=>[...document.querySelectorAll('#fc-social .sx-card')].find(c=>c.textContent.includes('Gig tonight'))?.querySelector('[data-heart]').classList.contains('on'),null,T);
 await p.locator('#fc-social .sx-card',{hasText:'Gig tonight'}).locator('[data-open]').click(T);await p.waitForSelector('#fc-social .sx-replyform',T);
 await p.locator('#fc-social .sx-replyform input').fill('I will be there.');await p.locator('#fc-social .sx-replyform button').click(T);
 await p.waitForFunction(()=>document.querySelector('#fc-social .sx-replies')?.textContent.includes('I will be there.'),null,T);
 await p.screenshot({path:root+'/_test/out/social-thread.png',...T});
 console.log('PASS the feed: Bo’s photo post shows, Ash posts from the composer, hearts it and replies in the thread');
 //  Bo's profile: portrait, tagline, counts, follow.
 await p.locator('#fc-social .sx-card .sx-name',{hasText:'Bo Static'}).first().click(T);await p.waitForSelector('#fc-social .sx-profile',T);
 assert.match(await p.locator('#fc-social .sx-who').textContent(),/Drums, mostly\./);
 await p.locator('#fc-social [data-follow]').click(T);await p.waitForFunction(()=>document.querySelector('#fc-social [data-follow]')?.textContent==='Following',null,T);
 await p.waitForFunction(()=>/url\(/.test(document.querySelector('#fc-social .sx-portrait')?.style.backgroundImage||''),null,T);
 await p.screenshot({path:root+'/_test/out/social-profile.png',...T});
 assert.equal(await p.evaluate(()=>document.querySelector('#fc-social .sx-counts li:nth-child(2) b').textContent),'1','one follower now');
 console.log('PASS profiles: portrait from their look, tagline, counts, follow');
 //  Following feed shows Bo and Ash only.
 await p.locator('#fc-social [data-tab="feed"]').click(T);await p.locator('#fc-social [data-scope="following"]').click(T);
 await p.waitForFunction(()=>document.querySelectorAll('#fc-social .sx-card').length===2,null,T);
 //  Your own profile: edit name, tagline and bio.
 await p.locator('#fc-social nav [data-profile="hub_ash"]').click(T);await p.waitForSelector('#fc-social [data-edit]',T);await p.locator('#fc-social [data-edit]').click(T);
 await p.locator('#fc-social .sx-edit input[name=tagline]').fill('New in town.');await p.locator('#fc-social .sx-edit textarea[name=bio]').fill('I paint signs.');await p.locator('#fc-social .sx-edit button.hot').click(T);
 await p.waitForFunction(()=>document.querySelector('#fc-social .sx-who')?.textContent.includes('New in town.'),null,T);
 const saved=await bo('social/profile/hub_ash');assert.equal(saved.profile.tagline,'New in town.');assert.equal(saved.profile.bio,'I paint signs.');
 console.log('PASS your profile: edit tagline and bio, others see it');
 //  People search.
 await p.locator('#fc-social [data-tab="people"]').click(T);await p.locator('#fc-social .sx-search input').fill('bo');await p.locator('#fc-social .sx-search button').click(T);
 await p.waitForFunction(()=>[...document.querySelectorAll('#fc-social .sx-person')].some(b=>b.textContent.includes('Bo Static')),null,T);
 await p.keyboard.press('Escape');await p.waitForFunction(()=>document.getElementById('fc-social').hidden,null,T);
 assert.equal(await p.evaluate(()=>State.ui.inShiftPanel),false);
 console.log('PASS people search; Esc backs out and closes');
 //  Gallery board dock links into the hub.
 await bo('social/publish',{slot:0,title:'Board piece',text:'On the wall.'});
 await p.evaluate(async()=>{State.ui.paused=false;await CitySocial.refresh();Player.position.set(148,1+Player.height,63.5);Player.yaw=0});
 await p.waitForFunction(()=>CitySocial.nearest===0&&document.querySelector('.social-dock [data-hub="profile"]'),null,T);
 await p.locator('.social-dock [data-hub="profile"]').click(T);await p.waitForSelector('#fc-social .sx-profile',T);
 assert.match(await p.locator('#fc-social .sx-who h2').textContent(),/Bo Static/);
 await p.keyboard.press('Escape');await p.keyboard.press('Escape');
 await p.evaluate(()=>{State.ui.paused=false;Player.position.set(153,1+Player.height,63.5)});await p.waitForFunction(()=>CitySocial.nearest===1&&!document.querySelector('.social-dock').hidden,null,T);await p.screenshot({path:root+'/_test/out/social-dock.png',...T});
 await p.evaluate(()=>CitySocial.compose('publish'));await p.waitForSelector('.social-compose',T);await p.screenshot({path:root+'/_test/out/social-compose.png',...T});await p.keyboard.press('Escape');
 console.log('PASS the gallery board links to the artist’s profile');
 //  0.83: the inbox. Bo replies to Ash's post and mentions Ash; the bell lights and the inbox lists them.
 const ashPost=(await bo('social/profile/hub_ash')).items.find(i=>/First night/.test(i.text));
 await bo('social/post-reply',{post:ashPost.id,text:'Welcome, @hub_ash!'});
 await p.evaluate(()=>FCSocialHub.pollNotes());await p.waitForFunction(()=>!document.getElementById('fc-bell').hidden,null,T);
 assert.match(await p.locator('#fc-bell').textContent(),/2/,'a reply and a mention');
 await p.locator('#fc-bell').click(T);await p.waitForSelector('#fc-social .sx-note.new',T);
 await p.screenshot({path:root+'/_test/out/social-inbox.png',...T});
 await p.locator('#fc-social .sx-note.new').first().click(T);await p.waitForSelector('#fc-social .sx-replyform',T);
 assert.equal(await p.evaluate(()=>FCSocialHub.state.notes.unread),1);
 console.log('PASS the inbox: replies and mentions light the bell, open the thread, and mark read');
 //  Reporting and owner moderation (Ash owns this server in the test).
 const spam=(await bo('social/post',{text:'Buy credits cheap, DM me'})).item;
 const reg2=await fetch(base+'/api/account/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:'hub_cy',password:'hub test password 123',displayName:'Cy'})}),cy=reg2.headers.get('set-cookie').split(';')[0];
 await fetch(base+'/api/social/post-report',{method:'POST',headers:{'Content-Type':'application/json',cookie:cy,Origin:base},body:JSON.stringify({post:spam.id,reason:'Spam'})});
 await p.locator('#fc-social [data-tab="mod"]').click(T);await p.waitForSelector('#fc-social .sx-modcard',T);
 assert.match(await p.locator('#fc-social .sx-modcard').textContent(),/Buy credits cheap/);
 await p.screenshot({path:root+'/_test/out/social-mod.png',...T});
 await p.locator('#fc-social .sx-modcard [data-days="1"]').click(T);await p.waitForFunction(()=>document.querySelector('#fc-social')?.textContent.includes('Suspended'),null,T);
 const mr=p.locator('#fc-social .sx-modcard [data-modremove]');await mr.click(T);await mr.click(T);await p.waitForFunction(()=>!document.querySelector('#fc-social .sx-modcard'),null,{timeout:20000}).catch(async e=>{console.log('DBG',await p.evaluate(()=>JSON.stringify({msg:FCSocialHub.state.msg,mod:FCSocialHub.state.mod,html:document.querySelector('#fc-social .sx-modcard')?.outerHTML.slice(0,600)})));throw e});
 assert.equal((await bo('social/item/'+spam.id)).error!==undefined,true,'taken down');
 assert.match(String((await bo('social/post',{text:'let me back'})).error),/suspended/);
 //  Reporting from a card, as a resident.
 await p.locator('#fc-social [data-tab="feed"]').click(T);await p.waitForSelector('#fc-social .sx-card [data-reportmenu]',T);await p.locator('#fc-social .sx-card [data-reportmenu]').first().click(T);await p.locator('#fc-social .sx-report [data-reason="Other"]').click(T);
 await p.waitForFunction(()=>document.querySelector('#fc-social .sx-msg')?.textContent.startsWith('Reported'),null,T);
 await p.keyboard.press('Escape');
 console.log('PASS reports reach the owner’s Mod tab: take down, suspend; residents report from any card');
 await p.context().close();
 //  Phone.
 const mctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mctx.request.post(base+'/api/account/login',{data:{username:'hub_ash',password:'hub test password 123'}});
 const m=watch(await mctx.newPage());await m.goto(base+'/city/',T);await m.waitForFunction(()=>window.OwnBlock&&window.FCSocialHub&&window.FCAccounts?.user,null,T);
 await m.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();FCSocialHub.open('profile','hub_bo')});await m.waitForSelector('#fc-social .sx-profile',T);await m.waitForTimeout(1500);
 assert.ok(await m.evaluate(()=>{const b=document.querySelector('#fc-social .sx-body');return document.getElementById('fc-social').getBoundingClientRect().right<=innerWidth+1&&b.scrollWidth<=b.clientWidth+1}),'the hub fits a phone');
 await m.screenshot({path:root+'/_test/out/social-phone.png',...T});
 console.log('PASS the hub fits a phone');
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
