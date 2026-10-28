// 0.85: a resident whose phone is still building the city after joining is not
// swept as idle. Without a word for 45 s they leave; /api/still-here keeps them,
// and so does an open event stream (a busy page still holds it), up to 3 minutes.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createServer}=require('./server.cjs');
test('still-here keeps a loading resident in the city; silence still drops them',async()=>{
 let time=10000;const app=createServer({dbPath:':memory:',timers:false,now:()=>time});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const client=()=>{let token,cookie;return async function post(action,data={}){const r=await fetch(base+'/api/'+action,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const out={status:r.status,data:await r.json()};if(action==='join'&&r.ok)token=out.data.token;return out}};
 try{
  const a=client(),b=client();
  await a('account/register',{username:'loading_ash',password:'still here password 1'});
  await b('account/register',{username:'quiet_bo',password:'still here password 1'});
  const ja=await a('join',{public:true}),jb=await b('join',{public:true});
  assert.equal(ja.status,200);assert.equal(jb.status,200);
  const room=app.rooms.get(ja.data.code);assert.equal(room.players.size,2);
  for(let i=0;i<6;i++){time+=10000;assert.equal((await a('still-here')).status,200);app.tick()}
  assert.ok(room.players.has(ja.data.id),'the loading resident stays');
  assert.ok(!room.players.has(jb.data.id),'a silent resident is still swept after 45 s');
  assert.equal((await b('still-here')).status,401);
 }finally{await new Promise(r=>{app.server.once('close',r);app.close()})}
});
test('an open event stream counts as present for three minutes',async()=>{
 let time=10000;const app=createServer({dbPath:':memory:',timers:false,now:()=>time});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const reg=await fetch(base+'/api/account/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:'busy_page',password:'still here password 1'})}),cookie=reg.headers.get('set-cookie').split(';')[0];
  const j=await (await fetch(base+'/api/join',{method:'POST',headers:{'Content-Type':'application/json',cookie,Origin:base},body:JSON.stringify({public:true})})).json();
  const ctl=new AbortController(),stream=await fetch(base+'/api/events',{headers:{Authorization:'Bearer '+j.token,cookie},signal:ctl.signal});const reader=stream.body.getReader();(async()=>{try{while(!(await reader.read()).done);}catch(e){}})();
  await new Promise(r=>setTimeout(r,100));const room=app.rooms.get(j.code);
  time+=90000;app.tick();assert.ok(room.players.has(j.id),'a busy page holding its stream stays past 45 s');
  time+=100000;app.tick();assert.ok(!room.players.has(j.id),'but not past three minutes');
  ctl.abort();
 }finally{await new Promise(r=>{app.server.once('close',r);app.close()})}
});
