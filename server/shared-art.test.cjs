const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./server.cjs');
const shape=(id,x=155)=>({id,kind:'box',p:[x,2,25],s:[1,1,1],r:[0,0,0],color:'#44aa88',finish:'matte'});
test('shared art ownership, simultaneous authors, conflicts, restart durability',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-art-')),db=path.join(dir,'test.sqlite');let app,base;
 async function boot(){app=createServer({dbPath:db,timers:false});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port}
 async function close(){const done=new Promise(r=>app.server.on('close',r));app.close();await done}
 const people=[{},{}];async function call(i,action,data,method='POST'){const p=people[i],r=await fetch(base+'/api/'+action,{method,headers:{'Content-Type':'application/json',...(p.cookie?{Cookie:p.cookie}:{}),...(p.token?{Authorization:'Bearer '+p.token}:{})},...(method==='POST'?{body:JSON.stringify(data||{})}:{})});if(r.headers.get('set-cookie'))p.cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,data:await r.json()}}
 try{await boot();assert.equal((await call(0,'city-art',null,'GET')).status,401);let code;
 for(let i=0;i<2;i++){assert.equal((await call(i,'account/register',{username:'artist_'+i,password:'shared artwork test password'})).status,200);const r=await call(i,'join',i?{code}:{map:'city'});people[i].token=r.data.token;code=r.data.code;await call(i,'ready',{ready:true})}await call(0,'start');
 const a=shape('art-a'),b=shape('art-b',160);let res=await call(0,'city-art',{revision:0,objects:[a]});assert.equal(res.status,200);assert.equal(res.data.ownRevision,1);
 assert.equal((await call(1,'city-art',{revision:0,objects:[b]})).status,200);res=await call(0,'city-art',null,'GET');assert.equal(res.data.owners.flatMap(o=>o.objects).length,2);
 assert.equal((await call(1,'city-art',{revision:1,objects:[a,b]})).status,403);assert.equal((await call(0,'city-art',{revision:0,objects:[{...a,color:'#ff0000'}]})).status,409);
 assert.equal((await call(0,'city-art',{revision:0,objects:[a]})).status,200); // Lost response retry is idempotent.
 for(const bad of [{...a,p:[1,95,1]},{...a,color:['#abcdef']},{...a,s:[999,1,1]},{...a,kind:'script'},{...a,kind:'mural',pixels:[]},{...a,p:[null,1,1]}])assert.equal((await call(0,'city-art',{revision:1,objects:[bad]})).status,400);
 assert.equal((await call(0,'city-art',{revision:1,objects:[a,a]})).status,400);
 res=await call(0,'city-art',{revision:1,objects:[]});assert.equal(res.status,200);assert.equal(res.data.owners.flatMap(o=>o.objects).length,1);assert.equal(res.data.owners.flatMap(o=>o.objects)[0].id,'art-b');
 await close();await boot();for(let i=0;i<2;i++){const r=await call(i,'join',{code});assert.equal(r.status,200);people[i].token=r.data.token}res=await call(0,'city-art',null,'GET');assert.equal(res.data.owners.flatMap(o=>o.objects)[0].id,'art-b');assert.equal(res.data.ownRevision,2);assert.equal(res.data.revision,3);
 assert.equal((await call(0,'city-art',{revision:2,objects:[shape('new-after-restart')]})).status,200);
 const cross=await fetch(base+'/api/city-art',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json',Cookie:people[0].cookie,Authorization:'Bearer '+people[0].token},body:'{}'});assert.equal(cross.status,403);
 console.log('PASS two authors merge, foreign ownership, stale revision, idempotent retry, malformed objects, owner deletion, restart persistence, origin protection');
 }finally{if(app?.server.listening)await close();fs.rmSync(dir,{recursive:true,force:true})}
});
