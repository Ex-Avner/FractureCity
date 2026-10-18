'use strict';
// Personal progress is separate from district ownership and never exposed to peers.
function createResidentLife(db,now=Date.now){
 db.exec('CREATE TABLE IF NOT EXISTS resident_life(account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,kind TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(account_id,kind))');
 const kinds=new Set(['seam','npcs','tour']);
 function fail(status,message){throw Object.assign(new Error(message),{status})}
 function validate(kind,data){
  if(!kinds.has(kind))fail(400,'Unknown progress type.');
  if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Invalid progress.');
  const raw=JSON.stringify(data);if(Buffer.byteLength(raw)>100000)fail(413,'Progress is too large.');
  function walk(v,depth=0){if(depth>12)fail(400,'Progress is too deeply nested.');if(typeof v==='number'&&(!Number.isFinite(v)||Math.abs(v)>1e15))fail(400,'Invalid progress number.');if(typeof v==='string'&&v.length>4000)fail(400,'Progress text is too long.');if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))fail(400,'Invalid progress key.');walk(x,depth+1)}}walk(data);
  if(kind==='seam'){
   if(data.v!==1||!Array.isArray(data.plots)||data.plots.length!==12||!Array.isArray(data.wards)||data.wards.length!==6||!Array.isArray(data.pets)||data.pets.length>4)fail(400,'Invalid farm layout.');
   const crops=new Set(['wheat','melon','corn','tuber']);
   for(const k of ['ink','fence','harvests','earned','kills','repelled'])if(!Number.isInteger(data[k])||data[k]<0||data[k]>1e9)fail(400,'Invalid farm totals.');
   if(data.credits!==undefined&&(!Number.isFinite(data.credits)||data.credits<0||data.credits>1e9))fail(400,'Invalid farm balance.');
   for(const k of ['trust','seen'])if(!data[k]||typeof data[k]!=='object'||Array.isArray(data[k]))fail(400,'Invalid farm notes.');
   if(!data.sold||typeof data.sold.day!=='string'||!data.sold.n||typeof data.sold.n!=='object')fail(400,'Invalid market history.');
   for(const p of data.plots){if(!p||typeof p.open!=='boolean')fail(400,'Invalid plot.');const c=p.crop;if(c&&(!crops.has(c.id)||!Number.isFinite(c.t0)||!Number.isFinite(c.dur)||c.dur<1000||c.dur>5400000||!Number.isInteger(c.yield)||c.yield<1||c.yield>20))fail(400,'Invalid crop.');}
   if(data.wards.some(n=>!Number.isInteger(n)||n<0||n>3))fail(400,'Invalid ward.');
   for(const bag of [data.crate,data.packets])for(const id of crops)if(!Number.isInteger(bag?.[id])||bag[id]<0||bag[id]>1e7)fail(400,'Invalid crop inventory.');
   for(const p of data.pets)if(!p||!['moth','pigeon','eel','cat'].includes(p.species)||!['guard','follow','rest'].includes(p.mode))fail(400,'Invalid companion.');
  }
  if(kind==='npcs'){
   if(Object.keys(data).length>300)fail(400,'Too many acquaintances.');
   for(const m of Object.values(data))if(!m||typeof m!=='object'||!Number.isFinite(m.met)||!Number.isFinite(m.rapport)||!Number.isFinite(m.step)||!Array.isArray(m.topics)||m.topics.length>30||m.topics.some(t=>typeof t!=='string'))fail(400,'Invalid acquaintance.');
  }
  if(kind==='tour'&&Object.values(data).some(x=>typeof x!=='boolean'))fail(400,'Invalid guide progress.');
  return raw;
 }
 function read(accountId){const docs={};for(const r of db.prepare('SELECT kind,revision,payload FROM resident_life WHERE account_id=?').all(accountId))docs[r.kind]={revision:r.revision,data:JSON.parse(r.payload)};return{time:now(),docs}}
 function save(accountId,b){const raw=validate(b.kind,b.data);if(!Number.isInteger(b.revision)||b.revision<0)fail(400,'Invalid save revision.');
  db.exec('BEGIN IMMEDIATE');try{const r=db.prepare('SELECT revision FROM resident_life WHERE account_id=? AND kind=?').get(accountId,b.kind);if((r?.revision||0)!==b.revision)fail(409,'This progress changed on another device. Your unsent copy is kept here. Reload to use the latest account save.');
   const revision=b.revision+1;db.prepare('INSERT INTO resident_life VALUES(?,?,?,?,?) ON CONFLICT(account_id,kind) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at').run(accountId,b.kind,revision,raw,now());db.exec('COMMIT');return{revision,time:now()};
  }catch(e){db.exec('ROLLBACK');throw e}
 }
 return{read,save};
}
module.exports={createResidentLife};
