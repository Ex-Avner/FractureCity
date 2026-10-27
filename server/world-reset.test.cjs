// 0.84: the larger building yard and the one-time world reset.
const {createServer}=require('./server.cjs'),{plot}=require('./structure-store.cjs'),{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('plots are six times larger and tile a 4 x 3 yard',()=>{
 const p=[...Array(12).keys()].map(plot);assert.equal(p[0].w*p[0].d,400);assert.ok(p[0].w*p[0].d>=6*64);
 for(const a of p)for(const b of p)if(a!==b)assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.z+a.d<=b.z||b.z+b.d<=a.z,'plots overlap');
 assert.ok(p.every(q=>q.x>=192&&q.x+q.w<=288&&q.z>=48&&q.z+q.d<=120));
});
test('world reset clears building, refunds it, keeps everything else, runs once',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-reset-')),dbPath=path.join(dir,'t.sqlite');
 const boot=async()=>{const app=createServer({dbPath,timers:false});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return app};
 const stop=app=>new Promise(r=>{app.server.once('close',r);app.close()});
 let app=await boot();const base=()=>'http://127.0.0.1:'+app.server.address().port;
 let cookie,token;const call=async(route,data)=>{const res=await fetch(base()+'/api/'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});const c=res.headers.get('set-cookie');if(c)cookie=c.split(';')[0];const j=await res.json();if(j.token)token=j.token;return{status:res.status,data:j}};
 try{
  //  A fresh database is stamped at the current epoch (nothing to clear).
  assert.equal(app.worldReset.pending(),true);app.worldReset.run();assert.equal(app.worldReset.pending(),false);
  const reg=await call('account/register',{username:'reset_ash',password:'reset test password 1'});const acct=reg.data.account.id;
  const j=await call('join',{map:'city'});app.rooms.get(j.data.code).phase='live';
  //  Build: buy blocks and a sofa, place them, post to the feed.
  await call('wallet/buy',{sku:'b:120',qty:10});await call('wallet/buy',{sku:'f:0',qty:1});
  const own=(await call('city-structures')).data.owners.find(o=>o.author===acct),p=own.plot;
  const cells=[0,1,2].map(i=>({x:p.x+i,y:1,z:p.z,id:120}));
  assert.equal((await call('city-structures',{revision:own.revision,cells,doors:[]})).status,200);
  const art=(await call('city-art')).data;
  const sofa=[{id:'f0-a',kind:'box',p:[170,1,30],s:[1,1,1],r:[0,0,0],color:'#ff2e88',finish:'matte',group:'f0-a'}];
  const saved=await call('city-art',{revision:art.ownRevision||0,objects:sofa});
  await call('social/post',{text:'Still here after the reset.'});
  const before=(await call('wallet')).data.items;
  //  Pretend the old epoch, as on the live server, and run the reset.
  app.store.db.prepare("UPDATE world_meta SET value='1' WHERE key='epoch'").run();
  const out=app.worldReset.run();assert.equal(out.reset,true);assert.equal(out.structures,1);
  assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM city_structures').get().n,0);assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM city_art').get().n,0);
  const after=(await call('wallet')).data.items;assert.equal((after['b:120']||0)-(before['b:120']||0),3,'placed blocks come back');
  assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal((after['f:0']||0)-(before['f:0']||0),1,'placed furniture comes back');
  assert.equal((await call('social/feed')).data.items.length,1,'the feed is untouched');
  assert.equal(app.worldReset.run().reset,false,'runs once');
  await stop(app);app=await boot();assert.equal(app.worldReset.pending(),false,'stays done after a restart');
  console.log('PASS the reset clears plots and city art, refunds blocks and furniture, keeps accounts and posts, and runs once');
 }finally{await stop(app);fs.rmSync(dir,{recursive:true,force:true})}
});
