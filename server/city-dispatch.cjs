'use strict';
const content=require('../apps/fracture-city-game/city-dispatch-content.js');
function createDispatch(db,{now=Date.now,economy}){
 db.exec('CREATE TABLE IF NOT EXISTS city_dispatch (account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, payload TEXT NOT NULL)');
 const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
 function load(id){const row=db.prepare('SELECT payload FROM city_dispatch WHERE account_id=?').get(id);return row?JSON.parse(row.payload):{active:null,progress:{},completed:0};}
 function prune(s){const today=content.day(now());for(const id of Object.keys(s.progress))if(id.includes(':')&&!id.startsWith(today+':'))delete s.progress[id];if(s.active&&!content.jobs(now()).some(q=>q.id===s.active))s.active=null;return s;}
 function snapshot(id){return {time:now(),day:content.day(now()),jobs:content.jobs(now()),state:prune(load(id))};}
 function action(p,b,room){
  if(!room.map.city||room.phase!=='live'||p.hp<=0)fail(409,'Enter the city before taking a job.');
  const q=content.jobs(now()).find(q=>q.id===b.id);if(!q)fail(400,'That job has expired. Open today’s dispatch.');
  db.exec('BEGIN IMMEDIATE');
  try{
   const s=prune(load(p.accountId)),v=s.progress[q.id]||{step:0,done:false,started:null};
   if(b.action==='track'){if(v.done)fail(409,'This job is already complete.');s.active=q.id;}
   else if(b.action==='begin'||b.action==='finish'){
    if(s.active!==q.id||v.done||b.step!==v.step)fail(409,'Your objective changed. Refresh the dispatch.');
    const step=q.steps[v.step];if(!content.near(p,step))fail(409,'Walk to the resident’s marked location first.');
    if(b.action==='begin')v.started=now();
    else{if(v.started===null||now()-v.started<step.seconds*1000)fail(409,'Give the task a little more time.');if(now()-v.started>120000)fail(409,'Start the task again after being away.');v.started=null;v.step++;v.done=v.step===q.steps.length;if(v.done){economy.credit(p.accountId,q.reward);s.completed++;s.active=null;}}
   }else fail(400,'Unknown dispatch action.');
   s.progress[q.id]=v;db.prepare('INSERT INTO city_dispatch VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET payload=excluded.payload').run(p.accountId,JSON.stringify(s));db.exec('COMMIT');
   return {...snapshot(p.accountId),wallet:economy.read(p.accountId)};
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 return {snapshot,action};
}
module.exports={createDispatch};
