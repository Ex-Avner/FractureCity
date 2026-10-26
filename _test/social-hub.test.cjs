// 0.82: the social hub. Feed, posting, hearts, threads, profiles with
// portraits, people search, the shared design tokens, and phones.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const T={timeout:240000};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-hub-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
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
