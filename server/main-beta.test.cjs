// The Main Beta: one permanent, code-free, peaceful city room beside private
// invite rooms. Exercises identity across restart, admission without ready-up,
// capacity, owner-only moderation, idle plot and gallery release with archives,
// and backup pruning.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./server.cjs'),{pruneBackups,mainCode}=require('./main-beta.cjs');
const DAY=86400000;

async function boot(dbPath,clock,extra={}){const app=createServer({dbPath,timers:false,now:()=>clock.t,maxRooms:3,owners:['beta_owner'],...extra});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return{app,base:'http://127.0.0.1:'+app.server.address().port}}
function client(srv,clock){let cookie,token;const c={async post(action,data={}){const r=await fetch(srv.base+'/api/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,data:await r.json()}},
 async get(action){const r=await fetch(srv.base+'/api/'+action,{headers:{...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})}});return{status:r.status,data:await r.json()}},
 async register(username){clock.t+=21000;const r=await c.post('account/register',{username,password:'main beta test password'});assert.equal(r.status,200,JSON.stringify(r.data));return r},
 async join(data){clock.t+=2100;const r=await c.post('join',data);if(r.status===200)token=r.data.token;return r},
 set server(s){srv=s}};return c}

test('Main Beta: stable, code-free, always open, beside private rooms',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-main-')),db=path.join(dir,'d.sqlite'),clock={t:1_800_000_000_000};let srv=await boot(db,clock);
 try{
  const owner=client(srv,clock),a=client(srv,clock),b=client(srv,clock);
  await owner.register('beta_owner');await a.register('visitor_a');await b.register('visitor_b');
  assert.equal((await fetch(srv.base+'/api/main').then(r=>r.json())).players,0);
  const ja=await a.join({public:true});assert.equal(ja.status,200,JSON.stringify(ja.data));
  const code=ja.data.code;assert.equal(code,mainCode());assert.match(code,/^[A-F0-9]{10}$/);
  assert.equal(ja.data.room.phase,'live');assert.equal(ja.data.room.public,true);assert.equal(ja.data.room.map,'city');assert.equal(ja.data.room.host,null);assert.equal(ja.data.owner,false);
  // city-online.js joins again by code after the redirect: same room, same resident, no duplicate.
  const again=await a.join({code});assert.equal(again.data.code,code);assert.equal(again.data.room.players.length,1);
  const jb=await b.join({public:true});assert.equal(jb.data.code,code);assert.equal(jb.data.room.players.length,2);
  assert.equal((await b.post('start')).status,409,'no ready-up or host start in the Main Beta');
  assert.equal((await fetch(srv.base+'/api/main').then(r=>r.json())).players,2);
  assert.equal((await fetch(srv.base+'/health').then(r=>r.json())).main,2);
  console.log('PASS public join without a code, live on arrival, no host, re-join by code is the same seat');
  // Ordinary visitors have no moderation power.
  const bid=jb.data.id;assert.equal((await a.post('kick',{id:bid})).status,403);
  assert.equal((await a.post('chat',{text:'/remove @visitor_b'})).status,403);
  assert.ok(!srv.app.state(srv.app.rooms.get(code)).chat.some(m=>m.text.includes('/remove')),'failed command is not broadcast');
  const jo=await owner.join({public:true});assert.equal(jo.data.owner,true);
  assert.equal((await owner.post('chat',{text:'/remove @visitor_b'})).status,200);
  assert.equal(srv.app.rooms.get(code).players.size,2);
  const banned=await b.join({public:true});assert.equal(banned.status,403);assert.match(banned.data.error,/server owner/);
  await owner.post('chat',{text:'/allow @visitor_b'});assert.equal((await b.join({public:true})).status,200);
  console.log('PASS only the configured owner can remove or allow residents; visitors cannot kick');
  // Private rooms still work beside it: MAX_ROOMS=3 is the Main Beta plus two private rooms.
  const p1=client(srv,clock),p2=client(srv,clock),p3=client(srv,clock);await p1.register('private_one');await p2.register('private_two');await p3.register('private_three');
  const r1=await p1.join({map:'city'}),r2=await p2.join({map:'civic'});assert.equal(r1.status,200);assert.equal(r2.status,200);assert.equal(r1.data.room.phase,'lobby');assert.notEqual(r1.data.code,code);
  const r3=await p3.join({map:'city'});assert.equal(r3.status,503);assert.match(r3.data.error,/Main Beta is always open/);
  const friend=client(srv,clock);await friend.register('private_friend');assert.equal((await friend.join({code:r1.data.code})).data.code,r1.data.code);
  // Leaving the Main Beta empty and coming back still finds a reserved slot.
  for(const c of [a,b,owner])await c.post('leave');assert.equal(srv.app.rooms.has(code),false);
  assert.equal((await a.join({public:true})).data.code,code);
  console.log('PASS private invite rooms keep working; the Main Beta keeps a reserved slot');
  // Restart: same code, same saved position, still live and public.
  const before=srv.app.rooms.get(code).players.get((await a.join({code})).data.id);before.x=160;before.z=27;srv.app.store.checkpoint(srv.app.rooms.get(code));
  srv.app.close();srv=await boot(db,clock);a.server=srv;
  const after=await a.join({public:true});assert.equal(after.data.code,code);assert.equal(after.data.room.phase,'live');assert.equal(after.data.room.public,true);
  const me=after.data.room.players.find(p=>p.id===after.data.id);assert.equal(me.x,160);assert.equal(me.z,27);
  console.log('PASS identity, phase and resident position survive a full restart');
 }finally{srv.app.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('Main Beta: 12 residents, then a clear full message and no second main room',async()=>{
 const clock={t:1_800_000_000_000},srv=await boot(':memory:',clock);
 try{const all=[];for(let i=0;i<13;i++){const c=client(srv,clock);await c.register('crowd_'+i);all.push(c)}
  for(let i=0;i<12;i++)assert.equal((await all[i].join({public:true})).status,200);
  const late=await all[12].join({public:true});assert.equal(late.status,409);assert.match(late.data.error,/Main Beta is full/);
  assert.equal([...srv.app.rooms.values()].filter(r=>r.public).length,1);assert.equal(srv.app.rooms.size,1);
  assert.equal((await fetch(srv.base+'/api/main').then(r=>r.json())).full,true);
  await all[0].post('leave');assert.equal((await all[12].join({public:true})).status,200);
  console.log('PASS thirteenth resident turned away with a clear message; a seat frees on leave');
 }finally{srv.app.close()}
});

test('Main Beta: idle plots and gallery spaces are released into archives, never deleted',async()=>{
 const clock={t:1_800_000_000_000},srv=await boot(':memory:',clock);
 try{const db=srv.app.store.db,code=mainCode(),owners=[];
  const boss=client(srv,clock);await boss.register('beta_owner');await boss.join({public:true});assert.equal((await boss.get('city-structures')).status,200);await boss.post('leave');
  for(let i=0;i<11;i++){const c=client(srv,clock);await c.register('builder_'+i);await c.join({public:true});const s=await c.get('city-structures');assert.equal(s.status,200);owners.push(c);if(i===0){const mine=s.data.owners.find(o=>o.author===s.data.viewer);const cells=[{x:mine.plot.x+1,y:1,z:mine.plot.z+1,id:120}];assert.equal((await c.post('city-structures',{revision:mine.revision,cells,doors:[]})).status,200)}await c.post('leave')}
  assert.equal(db.prepare('SELECT COUNT(*) n FROM city_structures WHERE room=?').get(code).n,12);
  const early=client(srv,clock);await early.register('newcomer_early');await early.join({public:true});
  const none=await early.get('city-structures');assert.ok(!none.data.owners.some(o=>o.author===none.data.viewer),'no plot while every owner is recent');await early.post('leave');
  // Gallery: four artists fill all eight spaces; one response on the first work.
  const png=Buffer.alloc(40);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12,'ascii');png.writeUInt32BE(4,16);png.writeUInt32BE(4,20);
  const up=await owners[0].post('media',{mime:'image/png',name:'p.png',data:png.toString('base64')});assert.equal(up.status,200,JSON.stringify(up.data));
  for(let i=0;i<8;i++){clock.t+=4000;const r=await owners[Math.floor(i/2)].post('social/publish',{slot:i,title:'Work '+i,text:'Story '+i,...(i===0?{photo:up.data.id}:{})});assert.equal(r.status,200,JSON.stringify(r.data))}
  const first=db.prepare('SELECT id FROM social_works WHERE slot=0').get().id;await owners[5].post('social/reply',{work:first,text:'Beautiful'});
  // Thirty-one days later, the owner's account is still exempt and everyone else is idle.
  clock.t+=31*DAY;
  const fresh=client(srv,clock);await fresh.register('newcomer_late');await fresh.join({public:true});
  const got=await fresh.get('city-structures');const mine=got.data.owners.find(o=>o.author===got.data.viewer);assert.ok(mine,'a newcomer gets a released plot');
  const arch=db.prepare('SELECT * FROM city_structures_archive').all();assert.equal(arch.length,1);assert.notEqual(db.prepare("SELECT username FROM accounts WHERE id=?").get(arch[0].author).username,'beta_owner');
  const builder0=db.prepare("SELECT id FROM accounts WHERE username='builder_0'").get().id;assert.equal(arch[0].author,builder0,'the longest-idle plot goes first');assert.equal(JSON.parse(arch[0].cells).length,1,'blocks are archived');
  assert.equal(srv.app.sweep(),undefined);assert.equal(db.prepare('SELECT COUNT(*) n FROM social_works').get().n,0);
  const ga=db.prepare('SELECT * FROM social_works_archive WHERE slot=0').get();assert.equal(JSON.parse(ga.replies)[0].body,'Beautiful');assert.equal(ga.photo,up.data.id);
  // A later upload's cleanup must not delete the archived exhibit's photo.
  clock.t+=2*DAY;assert.equal((await fresh.post('media',{mime:'image/png',name:'q.png',data:png.toString('base64')})).status,200);
  assert.ok(db.prepare('SELECT 1 FROM gallery_media WHERE id=?').get(up.data.id),'archived photo kept');
  console.log('PASS idle plot released to a newcomer with blocks archived; owner exempt; gallery archived with replies and media kept');
 }finally{srv.app.close()}
});

test('backups keep the newest seven daily copies only',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-bk-'));try{for(let d=1;d<=10;d++)fs.writeFileSync(path.join(dir,'districts-2026-10-'+String(d).padStart(2,'0')+'.sqlite'),'x');fs.writeFileSync(path.join(dir,'keep-me.txt'),'x');
  const gone=pruneBackups(dir,7);assert.deepEqual(gone.sort(),['districts-2026-10-01.sqlite','districts-2026-10-02.sqlite','districts-2026-10-03.sqlite']);assert.equal(fs.readdirSync(dir).length,8);assert.ok(fs.existsSync(path.join(dir,'keep-me.txt')));
  console.log('PASS backup retention removes only old daily database copies');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('rate limits are per player behind a trusted proxy, shared otherwise',async()=>{
 for(const trust of ['1','0']){const clock={t:1_800_000_000_000},srv=await boot(':memory:',clock,{trustProxy:trust});
  try{const hit=ip=>fetch(srv.base+'/api/account/logout',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'203.0.113.9, '+ip},body:'{}'}).then(r=>r.status);
   for(let i=0;i<30;i++)assert.equal(await hit('198.51.100.1'),401);
   const other=await hit('198.51.100.2');assert.equal(other,trust==='1'?401:429,'trust '+trust);
   assert.equal(await hit('198.51.100.1'),429);
  }finally{srv.app.close()}}
 console.log('PASS TRUST_PROXY=1 keys limits by the forwarded client address; off, the socket address');
});
