const {test}=require('node:test'),assert=require('node:assert/strict'),{createServer}=require('./server.cjs'),{createApprentice}=require('./apprentice.cjs'),M=require('../apps/fracture-city-game/apprentice-model.js');
test('authenticated room-shared apprenticeship, spatial checks, single teacher, saved recipe',async()=>{
 let time=10000;const app=createServer({dbPath:':memory:',timers:false,now:()=>time});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const a={},b={};async function post(client,action,data={}){const r=await fetch(base+'/api/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(client.cookie?{Cookie:client.cookie}:{}),...(client.token?{Authorization:'Bearer '+client.token}:{})},body:JSON.stringify(data)});if(r.headers.get('set-cookie'))client.cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,data:await r.json()}}
 try{assert.equal((await post(a,'apprentice',{})).status,401);await post(a,'account/register',{username:'teacher_one',password:'a sufficiently long test password'});const j=await post(a,'join',{map:'city'});a.token=j.data.token;const room=app.rooms.get(j.data.code),p=room.players.get(j.data.id);await post(a,'ready',{ready:true});await post(a,'start');
 await post(b,'account/register',{username:'teacher_two',password:'a sufficiently long test password'});const k=await post(b,'join',{code:room.code});b.token=k.data.token;const peer=room.players.get(k.data.id);
 async function act(op,station){Object.assign(p,M.stations[station],{y:2,seen:time});return post(a,'apprentice',{op,station,revision:app.state(room).apprentice.revision})}
 assert.equal((await post(a,'apprentice',{op:'teach',station:'teacher',revision:0})).status,409);assert.equal((await act('teach','teacher')).status,200);
 Object.assign(peer,M.stations.teacher,{y:2});assert.equal((await post(b,'apprentice',{op:'teach',station:'teacher',revision:app.state(room).apprentice.revision})).status,409);
 for(const[op,st]of [['take','intake'],['repair','tune']])assert.equal((await act(op,st)).status,200);time+=2100;assert.equal((await act('finish','tune')).status,200);assert.equal((await act('deliver','street')).status,200);
 for(let i=0;i<600;i++){time+=50;p.seen=peer.seen=time;app.tick()}assert.equal(app.state(room).apprentice.mode,'review');assert.equal((await act('approve','teacher')).status,200);
 const restored=createApprentice(app.store.db,()=>time).get(room.code);assert.deepEqual(restored.skill,['intake','tune','street']);assert.equal(restored.outputs.street,2);assert.equal(restored.owner,null);assert.equal(createApprentice(app.store.db).get('other-room').skill,null);
 }finally{app.close()}
});
