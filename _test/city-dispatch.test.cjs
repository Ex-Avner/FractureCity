const assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const {createDispatch}=require('../server/city-dispatch.cjs'),C=require('../apps/fracture-city-game/city-dispatch-content.js');
const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE accounts(id TEXT PRIMARY KEY); INSERT INTO accounts VALUES('a'),('b'); CREATE TABLE wallets(account TEXT PRIMARY KEY, balance INTEGER)");
const economy={credit(id,n){db.prepare('INSERT INTO wallets VALUES(?,?) ON CONFLICT(account) DO UPDATE SET balance=balance+excluded.balance').run(id,n)},read(id){return {balance:db.prepare('SELECT balance FROM wallets WHERE account=?').get(id)?.balance||0}}};
let time=Date.parse('2026-11-06T12:00:00Z'),d=createDispatch(db,{now:()=>time,economy});
const room={map:{city:true},phase:'live'},p={accountId:'a',hp:100,x:0,y:1,z:0};
const fail=(fn,status)=>assert.throws(fn,e=>e.status===status);
const action=(q,action,step)=>d.action(p,{id:q.id,action,step},room);
const at=s=>{const a=C.places[s.place].at;Object.assign(p,{x:a[0],y:a[1],z:a[2]});};
assert.equal(d.snapshot('a').jobs.length,6);
assert.equal(new Set(d.snapshot('a').jobs.filter(q=>q.daily).map(q=>q.id)).size,3);
const q=C.stories[0];action(q,'track');fail(()=>action(q,'begin',0),409);at(q.steps[0]);fail(()=>action(q,'finish',0),409);
for(let i=0;i<q.steps.length;i++){
 at(q.steps[i]);action(q,'begin',i);fail(()=>action(q,'finish',i),409);time+=q.steps[i].seconds*1000;
 fail(()=>action(q,'finish',i+1),409);action(q,'finish',i);
}
assert.equal(economy.read('a').balance,q.reward);fail(()=>action(q,'finish',2),409);fail(()=>action(q,'track'),409);assert.equal(economy.read('a').balance,q.reward);
d=createDispatch(db,{now:()=>time,economy});assert.equal(d.snapshot('a').state.progress[q.id].done,true);assert.equal(d.snapshot('b').state.completed,0);
const daily=d.snapshot('a').jobs.find(q=>q.daily);action(daily,'track');at(daily.steps[0]);action(daily,'begin',0);time+=86400000;
assert.equal(d.snapshot('a').state.active,null);assert.equal(d.snapshot('a').state.progress[daily.id],undefined);fail(()=>action(daily,'finish',0),400);assert.equal(d.snapshot('a').state.progress[q.id].done,true);
const next=d.snapshot('a').jobs.find(q=>q.daily);action(next,'track');at(next.steps[0]);action(next,'begin',0);time+=121000;fail(()=>action(next,'finish',0),409);
p.hp=0;fail(()=>action(next,'begin',0),409);p.hp=100;
// A failure to pay must roll back both completion and reward.
const bad=createDispatch(db,{now:()=>time,economy:{...economy,credit(){throw Error('wallet unavailable')}}});
const q2=C.stories[1];bad.action(p,{id:q2.id,action:'track'},room);
for(let i=0;i<q2.steps.length;i++){at(q2.steps[i]);bad.action(p,{id:q2.id,action:'begin',step:i},room);time+=q2.steps[i].seconds*1000;if(i===q2.steps.length-1)assert.throws(()=>bad.action(p,{id:q2.id,action:'finish',step:i},room),/wallet unavailable/);else bad.action(p,{id:q2.id,action:'finish',step:i},room);}
assert.equal(d.snapshot('a').state.progress[q2.id].done,false);assert.equal(economy.read('a').balance,q.reward);
for(let i=0;i<14;i++)assert.equal(new Set(C.jobs(time+i*86400000).map(q=>q.id)).size,6);
db.prepare('DELETE FROM accounts WHERE id=?').run('a');assert.equal(db.prepare('SELECT count(*) AS n FROM city_dispatch').get().n,0);
db.close();console.log('PASS ordered objectives, proximity/time gates, exactly-once rewards, rollback, account separation, restart and UTC daily rotation');
