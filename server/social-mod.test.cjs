// 0.83: notifications, reporting posts, owner moderation, suspensions and the word filter.
const {createServer}=require('./server.cjs'),{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const f=require('./wordfilter.cjs');
test('word filter',()=>{
 for(const bad of ['n1gg3r','N I G G E R','kill yourself','f a g g o t','you retard','kys'])assert.ok(f.offending(bad),bad);
 for(const ok of ['Nigeria','Niger river','raccoon','Scunthorpe','this is fucking loud','retardant','spicy','chinkapin oak','Dyke Road','cocoon'])assert.equal(f.offending(ok),null,ok);
});
test('notes, reports, moderation, suspensions',async()=>{
 const clock={t:1_800_000_000_000},dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-mod-')),app=createServer({dbPath:path.join(dir,'t.sqlite'),timers:false,now:()=>clock.t,owners:['mod_owner']});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const client=()=>{let cookie,token;return{async call(route,data){const res=await fetch(base+'/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});const c=res.headers.get('set-cookie');if(c)cookie=c.split(';')[0];const j=await res.json();if(j.token)token=j.token;return{status:res.status,data:j}}}};
 try{
  const o=client(),a=client(),b=client();
  await o.call('account/register',{username:'mod_owner',displayName:'Owner',password:'mod test password 123'});const ra=await a.call('account/register',{username:'mod_ash',displayName:'Ash',password:'mod test password 123'});const rb=await b.call('account/register',{username:'mod_bo',displayName:'Bo',password:'mod test password 123'});
  assert.equal((await a.call('account/register',{username:'kys_now',password:'mod test password 123'})).status,400,'usernames are filtered');
  //  The filter on posts, replies, profiles.
  assert.equal((await a.call('social/post',{text:'you are a n1gg3r'})).status,400);
  assert.equal((await a.call('social/profile',{tagline:'kill yourself'})).status,400);
  assert.equal((await a.call('account/profile',{displayName:'retard',bio:'',color:'#123456'})).status,400);
  assert.equal((await a.call('social/post',{text:'This show was fucking loud. @mod_bo you missed it.'})).status,200,'swearing is fine');
  const post=(await a.call('social/feed')).data.items[0];
  //  Notes: mention, reply, heart (once), follow.
  await b.call('social/post-reply',{post:post.id,text:'Next time!'});await b.call('social/post-appreciate',{post:post.id,enabled:true});await b.call('social/post-appreciate',{post:post.id,enabled:false});await b.call('social/post-appreciate',{post:post.id,enabled:true});
  await b.call('social/follow',{target:ra.data.account.id,enabled:true});
  let n=(await a.call('social/notes')).data;assert.deepEqual(n.notes.map(x=>x.kind).sort(),['follow','heart','reply']);assert.equal(n.unread,3);assert.equal(n.owner,false);
  n=(await b.call('social/notes')).data;assert.deepEqual(n.notes.map(x=>x.kind),['mention']);
  n=(await a.call('social/notes-read',{all:true})).data;assert.equal(n.unread,0);
  //  Reports reach the owner; only the owner moderates.
  assert.equal((await b.call('social/post-report',{post:post.id,reason:'Spam'})).status,200);
  assert.equal((await a.call('social/mod')).status,403);
  let m=(await o.call('social/mod')).data;assert.equal(m.reports.length,1);assert.equal(m.reports[0].item.author.username,'mod_ash');assert.equal((await o.call('social/notes')).data.owner,true);
  m=(await o.call('social/mod-remove',{item:post.id})).data;assert.equal(m.reports.length,0);assert.equal((await b.call('social/item/'+post.id)).status,404);
  assert.ok((await a.call('social/notes')).data.notes.some(x=>x.kind==='removed'));
  //  Suspension: no posting, replying or chat until it ends; then back.
  await o.call('social/mod-ban',{target:ra.data.account.id,days:1,reason:'Spam'});
  assert.equal((await a.call('social/post',{text:'hello again'})).status,403);
  const j=await a.call('join',{map:'city'});app.rooms.get(j.data.code).phase='live';assert.equal((await a.call('chat',{text:'hi'})).status,403);
  clock.t+=86400000+1000;assert.equal((await a.call('social/post',{text:'hello again'})).status,200);
  await o.call('social/mod-ban',{target:ra.data.account.id,days:-1,reason:'Again'});assert.equal((await a.call('social/post',{text:'x'})).status,403);await o.call('social/mod-unban',{target:ra.data.account.id});assert.equal((await a.call('social/post',{text:'x'})).status,200);
  assert.equal((await a.call('chat',{text:'k y s'})).status,200,'spaced short words are not stretched into matches');
  assert.equal((await a.call('chat',{text:'kys'})).status,400,'chat is filtered');
  console.log('PASS notes, reports, owner moderation, suspensions and the word filter');
 }finally{await new Promise(r=>{app.server.once('close',r);app.close()})}
});
