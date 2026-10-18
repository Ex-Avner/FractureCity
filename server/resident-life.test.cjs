const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createServer}=require('./server.cjs');
test('personal progress: authentication, isolation, conflict protection, validation and restart',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-life-')),dbPath=path.join(dir,'test.sqlite');let app,base;
 async function boot(){app=createServer({dbPath,timers:false});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port}
 async function stop(){await new Promise(r=>{app.server.once('close',r);app.close()})}
 async function req(route,cookie,data){const r=await fetch(base+'/api/'+route,{headers:{...(cookie?{cookie}:{}),'content-type':'application/json'},...(data?{method:'POST',body:JSON.stringify(data)}:{})});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 await boot();try{
 assert.equal((await req('resident-life')).status,401);
 const a=await req('account/register',null,{username:'life_one',password:'test password long 123'}),b=await req('account/register',null,{username:'life_two',password:'test password long 123'});
 assert.equal(a.status,200);assert.equal(b.status,200);
 const save={kind:'tour',revision:0,data:{met:true,listened:false,hidden:false},accountId:b.data.account.id};
 assert.equal((await req('resident-life',a.cookie,save)).data.revision,1);
 assert.deepEqual((await req('resident-life',b.cookie)).data.docs,{});
 assert.equal((await req('resident-life',a.cookie,save)).status,409);
 assert.equal((await req('resident-life',a.cookie,{kind:'seam',revision:0,data:{v:1}})).status,400);
 assert.equal((await req('resident-life',a.cookie,{kind:'tour',revision:1,data:{met:'yes'}})).status,400);
 assert.equal((await req('resident-life',a.cookie,{kind:'secrets',revision:0,data:{}})).status,400);
 const before=(await req('resident-life',a.cookie)).data;assert.equal(before.docs.tour.data.met,true);assert.ok(before.time>Date.now()-10000);
 await stop();await boot();const after=(await req('resident-life',a.cookie)).data;assert.deepEqual(after.docs,before.docs);
 assert.equal((await req('resident-life',a.cookie,{...save,revision:1,data:{met:true,listened:true}})).data.revision,2);
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true})}
});
