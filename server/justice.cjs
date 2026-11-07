'use strict';
const R=require('../apps/fracture-city-game/justice-rules.js');
function createJustice(db,{now=Date.now}={}){
 db.exec('CREATE TABLE IF NOT EXISTS city_justice(account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,payload TEXT NOT NULL)');
 const cache=new Map(),fail=m=>{throw Object.assign(Error(m),{status:409})};
 function save(id,s){db.prepare('INSERT INTO city_justice VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET payload=excluded.payload').run(id,JSON.stringify(s));}
 function load(id){if(!cache.has(id)){const row=db.prepare('SELECT payload FROM city_justice WHERE account_id=?').get(id);cache.set(id,row?JSON.parse(row.payload):R.fresh());}const s=cache.get(id),until=s.until;R.clean(s,now());if(until!==s.until)save(id,s);return s;}
 function snapshot(id){const s=load(id);return {until:s.until,started:s.started,stage:s.stage,reason:s.reason,kills:s.kills.length,time:now()};}
 const active=id=>R.active(load(id),now());
 function move(p,to){Object.assign(p,to);p.seq=(p.seq||0)+1;p.poseAt=now();p.moving=false;p.input={x:0,z:0};}
 function enforce(p,arrival=false){const s=load(p.accountId);if(active(p.accountId)){if(!p.jailed||!R.allowed(s,p,now()))move(p,R.anchor(s));p.jailed=true;p.god=false;delete p.godReturn;p.pvp=false;p.hp=100;p.respawnAt=0;}else if(p.jailed||(arrival&&['served','escaped'].includes(s.reason)&&p.x>=28&&p.x<=68&&p.z>=-44&&p.z<=-4)){p.jailed=false;move(p,R.EXIT);p.protectUntil=now()+5000;}}
 function record(p,event){const s=load(p.accountId),sentenced=R.record(s,event,now());save(p.accountId,s);enforce(p);return {sentenced,...snapshot(p.accountId)};}
 function report(p,b,r){if(!r.map.city||r.phase!=='live'||p.hp<=0)fail('Enter the city first.');if(typeof b.id!=='string'||!/^ambient:[a-zA-Z0-9-]{8,100}$/.test(b.id))fail('Invalid civilian report.');if(!['street','shop'].includes(b.kind))fail('Invalid civilian type.');if(load(p.accountId).seen.some(e=>e.id===b.id)||active(p.accountId))return {sentenced:false,...snapshot(p.accountId)};if(![b.x,b.y,b.z].every(Number.isFinite)||Math.hypot(b.x-p.x,b.z-p.z)>85||Math.abs(b.y-(p.y||1))>60)fail('Civilian report is outside your vicinity.');return record(p,b.id);}
 function action(p,b){const s=load(p.accountId);let to;try{to=R.action(s,p,b,now());}catch(e){fail(e.message);}save(p.accountId,s);if(to)move(p,to);enforce(p);return snapshot(p.accountId);}
 function pose(p,b){const s=load(p.accountId);if(!R.allowed(s,b,now()))fail('You are serving a sentence. Follow the escape route or wait for release.');if(s.work&&!R.near(b,R.stations[s.stage].at)){s.work=null;save(p.accountId,s);}}
 return {active,snapshot,record,report,action,enforce,pose};
}
module.exports={createJustice};
