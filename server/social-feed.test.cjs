// 0.82: the feed, posts, profiles and people search.
const {createServer}=require('./server.cjs'),{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
test('feed, posts, profiles',async()=>{
 const clock={t:1_800_000_000_000},dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-feed-'));let app,base;
 const boot=async()=>{app=createServer({dbPath:path.join(dir,'t.sqlite'),timers:false,now:()=>clock.t});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port};
 const stop=()=>new Promise(r=>{app.server.once('close',r);app.close()});
 const client=()=>{let cookie;return{async call(route,data){const res=await fetch(base+'/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});const c=res.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return{status:res.status,data:await res.json()}}}};
 await boot();
 try{
  const a=client(),b=client(),c=client();
  const ra=await a.call('account/register',{username:'feed_ash',displayName:'Ash',password:'feed test password 123'});await b.call('account/register',{username:'feed_bo',displayName:'Bo',password:'feed test password 123'});await c.call('account/register',{username:'feed_cy',displayName:'Cy',password:'feed test password 123'});
  assert.equal((await fetch(base+'/api/social/feed')).status,401,'signed in only');
  //  A board work and two feed posts.
  assert.equal((await a.call('social/publish',{slot:0,title:'On the board',text:'Pinned in Common Ground.'})).status,200);clock.t+=1000;
  const photo=await a.call('media',{mime:'image/png',name:'p.png',data:png.toString('base64')});
  let r=await a.call('social/post',{title:'First post',text:'Hello from the feed.',photo:photo.data.id});assert.equal(r.status,200);const p1=r.data.item;assert.equal(p1.kind,'post');assert.equal(p1.photo,photo.data.id);clock.t+=1000;
  r=await b.call('social/post',{text:'Bo checking in.'});assert.equal(r.status,200);clock.t+=1000;
  assert.equal((await b.call('social/post',{text:''})).status,400);
  //  Feed: newest first, both kinds.
  r=await c.call('social/feed');assert.deepEqual(r.data.items.map(i=>i.kind+':'+i.artist.username),['post:feed_bo','post:feed_ash','board:feed_ash']);
  assert.equal((await fetch(base+'/api/media/'+photo.data.id,{headers:{cookie:''}})).status,401);
  //  Following scope.
  await c.call('social/follow',{target:ra.data.account.id,enabled:true});r=await c.call('social/feed?scope=following');assert.deepEqual(r.data.items.map(i=>i.artist.username),['feed_ash','feed_ash']);
  //  Replies and hearts on a post.
  r=await c.call('social/post-reply',{post:p1.id,text:'Nice one.'});assert.equal(r.data.item.replies.length,1);r=await c.call('social/post-appreciate',{post:p1.id,enabled:true});assert.equal(r.data.item.appreciations,1);
  assert.equal((await b.call('social/post-remove',{post:p1.id})).status,403,'only the author removes');
  //  Profile: tagline, look (rare pieces need owning), counts.
  r=await a.call('social/profile',{tagline:'Paint, noise, more paint.',look:{hairStyle:'liberty',hair:'#ff2e88'}});assert.equal(r.status,200);assert.equal(r.data.profile.tagline,'Paint, noise, more paint.');assert.notEqual(r.data.profile.look.hairStyle,'liberty');assert.equal(r.data.profile.look.hair,'#ff2e88');
  r=await c.call('social/profile/feed_ash');assert.equal(r.data.profile.counts.posts,2);assert.equal(r.data.profile.counts.followers,1);assert.equal(r.data.profile.counts.appreciations,1);assert.equal(r.data.profile.following,true);assert.equal(r.data.items.length,2);
  r=await c.call('social/profile/id:'+ra.data.account.id);assert.equal(r.data.profile.username,'feed_ash');
  assert.equal((await c.call('social/profile/nobody_here')).status,404);
  r=await c.call('social/item/'+p1.id);assert.equal(r.data.item.replies[0].text,'Nice one.');
  r=await c.call('social/people?q=bo');assert.ok(r.data.people.some(p=>p.username==='feed_bo'));
  //  Muting hides the person everywhere.
  await c.call('social/block',{target:ra.data.account.id,enabled:true});assert.ok(!(await c.call('social/feed')).data.items.some(i=>i.artist.username==='feed_ash'));assert.equal((await c.call('social/profile/feed_ash')).status,404);assert.equal((await c.call('social/item/'+p1.id)).status,404);
  //  Posting rate limit.
  for(let i=0;i<11;i++)await b.call('social/post',{text:'spam '+i});assert.equal((await b.call('social/post',{text:'one more'})).status,429);
  //  Survives restart; removing a post frees its photo.
  await stop();await boot();
  r=await a.call('account/login',{username:'feed_ash',password:'feed test password 123'});
  assert.equal((await a.call('social/item/'+p1.id)).data.item.title,'First post');
  assert.equal((await a.call('social/post-remove',{post:p1.id})).status,200);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM gallery_media').get().n,0);
  console.log('PASS feed, posts, replies, hearts, profiles, people search, mute, rate limit, restart');
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true})}
});
