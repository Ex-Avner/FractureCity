const assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),R=require('../apps/fracture-city-game/justice-rules.js'),{createJustice}=require('../server/justice.cjs'),{createSpawns}=require('../server/spawns.cjs'),B=require('../apps/fracture-city-game/npc-brain.js');
let t=1000000,s=R.fresh();assert.equal(R.record(s,'a',t),false);assert.equal(R.record(s,'a',t+1),false);assert.equal(s.kills.length,1);R.record(s,'b',t+100);assert.equal(R.record(s,'c',t+300001),false);assert.equal(s.kills.length,2);assert.equal(R.record(s,'d',t+300002),true);assert.equal(s.until,t+900002);assert.equal(R.record(s,'e',t+300003),false);
s=R.fresh();R.record(s,'a',t);R.record(s,'b',t+100);assert.equal(R.record(s,'c',t+300000),true);assert.equal(R.active(s,s.until-1),true);R.clean(s,s.until);assert.equal(s.until,0);
const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON; CREATE TABLE accounts(id TEXT PRIMARY KEY);INSERT INTO accounts VALUES('a'),('b')");
let j=createJustice(db,{now:()=>t}),p={accountId:'a',x:80,y:1,z:80,seq:0,hp:100},room={map:{city:true},phase:'live'};
for(let i=0;i<3;i++)j.record(p,'shared:'+i);assert.equal(j.active('a'),true);assert.equal(j.active('b'),false);assert.deepEqual([p.x,p.y,p.z],[34,2,-35]);assert.equal(p.god,false);assert.throws(()=>j.pose(p,{x:165,y:1,z:24}),/sentence/);
j=createJustice(db,{now:()=>t});assert.equal(j.active('a'),true);p.x=165;p.z=24;j.enforce(p);assert.equal(p.x,34);
assert.throws(()=>j.action(p,{id:'outlet',action:'begin'}),/next lead/);
for(let i=0;i<R.stations.length;i++){const a=R.stations[i];Object.assign(p,a.at);if(a.id==='service'){t=j.snapshot('a').started+(Math.floor((t-j.snapshot('a').started)/36000)+1)*36000;assert.throws(()=>j.action(p,{id:a.id,action:'begin'}),/guard/);t+=18000;}
 j.action(p,{id:a.id,action:'begin'});assert.throws(()=>j.action(p,{id:a.id,action:'finish'}),/Start/);t+=a.seconds*1000;j.action(p,{id:a.id,action:'finish'});
}
assert.equal(j.active('a'),false);assert.equal(j.snapshot('a').reason,'escaped');assert.equal(p.x,70);
for(let i=3;i<6;i++)j.record(p,'shared:'+i);assert.equal(j.active('a'),true);t=j.snapshot('a').until;j.enforce(p);assert.equal(j.active('a'),false);assert.equal(p.x,70);assert.equal(j.snapshot('a').reason,'served');
assert.throws(()=>j.report(p,{id:'anything',kind:'street',x:70,y:1,z:-3},room),/Invalid/);assert.throws(()=>j.report(p,{id:'ambient:123456789',kind:'street',x:900,y:1,z:900},room),/vicinity/);
// Authoritative shared NPC death attribution: civilians count once; hostiles reward normally.
let deaths=0,rewards=0;const sp=createSpawns({economy:{credit(){rewards++}},now:()=>t,civilianDeath(){deaths++}}),r={map:{city:true},phase:'live',npcs:new Map(),players:new Map()},shooter={accountId:'b',id:'player',name:'Tester'};
for(const [id,role]of [['civil','vendor'],['enemy','brawler']]){const n=B.init({id,role,owner:'a',story:B.story(role,id),look:{}},{x:120,y:1,z:120,yaw:0});r.npcs.set(id,n);}
for(let i=0;i<10;i++)sp.shoot(r,shooter,{npc:'civil',pellets:1},{dmg:100,range:40,pellets:1},{x:120,y:2.5,z:124},{x:0,y:0,z:-1});assert.equal(deaths,1);assert.equal(rewards,0);
sp.shoot(r,shooter,{npc:'enemy',pellets:1},{dmg:100,range:40,pellets:1},{x:120,y:2.5,z:124},{x:0,y:0,z:-1});assert.equal(deaths,1);assert.equal(rewards,1);
db.close();console.log('PASS rolling boundary, duplicate deaths, account isolation, persistence, confinement, ordered timed escape, guard timing, deadline release, shared civilian attribution and hostile exclusion');
