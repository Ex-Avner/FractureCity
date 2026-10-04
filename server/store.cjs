'use strict';
const {DatabaseSync,backup}=require('node:sqlite');
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),{promisify}=require('node:util');
const derive=promisify(crypto.scrypt),hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex'),random=()=>crypto.randomBytes(32).toString('base64url');
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const clean=(s,n)=>String(s||'').replace(/[\x00-\x1f\x7f<>]/g,'').trim().slice(0,n);
let hashing=0;
async function passwordHash(password,salt=crypto.randomBytes(16).toString('hex')){
 if(typeof password!=='string'||password.length<12||password.length>128)fail(400,'Use a password between 12 and 128 characters.');
 if(hashing>=2)fail(503,'Sign-in is busy. Please try again in a moment.');
 hashing++;try{const value=await derive(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024});return salt+':'+value.toString('hex')}finally{hashing--}
}
async function verify(password,encoded){if(typeof password!=='string'||password.length<12||password.length>128)return false;const salt=(encoded||'0'.repeat(32)+':'+'0'.repeat(128)).split(':')[0],got=await passwordHash(password,salt);return crypto.timingSafeEqual(Buffer.from(got.split(':')[1],'hex'),Buffer.from((encoded||'0'.repeat(32)+':'+'0'.repeat(128)).split(':')[1],'hex'))}
function createStore(filename,now=Date.now){
 if(filename!==':memory:'){fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700})}
 const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 db.exec(`CREATE TABLE IF NOT EXISTS schema_version(version INTEGER NOT NULL); INSERT INTO schema_version SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM schema_version);
 CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password TEXT NOT NULL,recovery_hash TEXT NOT NULL,display_name TEXT NOT NULL,bio TEXT NOT NULL DEFAULT '',color TEXT NOT NULL DEFAULT '#527b93',kills INTEGER NOT NULL DEFAULT 0,deaths INTEGER NOT NULL DEFAULT 0,reputation INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS districts(code TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id),payload TEXT NOT NULL,updated_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS visits(account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,code TEXT NOT NULL REFERENCES districts(code) ON DELETE CASCADE,payload TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(account_id,code));
 CREATE TABLE IF NOT EXISTS rewards(account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,quest_id TEXT NOT NULL,choices TEXT NOT NULL,earned_at INTEGER NOT NULL,PRIMARY KEY(account_id,quest_id));`);
 if(db.prepare('SELECT version FROM schema_version').get().version!==1)throw Error('Unsupported account database version.');
 if(filename!==':memory:')fs.chmodSync(filename,0o600);
 const q=(sql,...params)=>db.prepare(sql).get(...params),run=(sql,...params)=>db.prepare(sql).run(...params),all=(sql,...params)=>db.prepare(sql).all(...params);
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v}catch(e){db.exec('ROLLBACK');throw e}}
 function profile(id){const a=q('SELECT id,username,display_name AS displayName,bio,color,kills,deaths,reputation,created_at AS createdAt FROM accounts WHERE id=?',id);if(!a)return null;a.contracts=all('SELECT quest_id AS id,choices,earned_at AS earnedAt FROM rewards WHERE account_id=? ORDER BY earned_at',id).map(r=>({...r,choices:JSON.parse(r.choices)}));return a}
 function issue(id){const token=random();run('DELETE FROM sessions WHERE expires_at < ?',now());run('INSERT INTO sessions VALUES(?,?,?)',hash(token),id,now()+30*86400000);return token}
 async function register(b){const username=String(b.username||'').toLowerCase();if(!/^[a-z0-9_]{3,24}$/.test(username))fail(400,'Username must be 3–24 letters, numbers or underscores.');if(q('SELECT id FROM accounts WHERE username=?',username))fail(409,'That username is unavailable.');const password=await passwordHash(b.password),recovery=random(),id=crypto.randomUUID();try{run('INSERT INTO accounts(id,username,password,recovery_hash,display_name,created_at) VALUES(?,?,?,?,?,?)',id,username,password,hash(recovery),clean(b.displayName,24)||username,now())}catch(e){if(String(e.code).includes('SQLITE')||String(e.message).includes('UNIQUE'))fail(409,'That username is unavailable.');throw e}return{account:profile(id),token:issue(id),recovery}}
 async function login(b){const a=q('SELECT * FROM accounts WHERE username=?',String(b.username||'').toLowerCase());if(!await verify(b.password,a?.password))fail(401,'Username or password was not recognized.');if(q('SELECT password FROM accounts WHERE id=?',a.id)?.password!==a.password)fail(401,'Password changed. Please sign in again.');return{account:profile(a.id),token:issue(a.id)}}
 function account(token){const s=q('SELECT account_id FROM sessions WHERE token_hash=? AND expires_at>?',hash(token||''),now());return s?profile(s.account_id):null}
 function update(id,b){if(typeof b.displayName!=='string'||!clean(b.displayName,24))fail(400,'Enter a display name.');if(!/^#[0-9a-f]{6}$/i.test(b.color))fail(400,'Choose a valid color.');run('UPDATE accounts SET display_name=?,bio=?,color=? WHERE id=?',clean(b.displayName,24),clean(b.bio,280),b.color,id);return profile(id)}
 async function change(id,b){const a=q('SELECT * FROM accounts WHERE id=?',id);if(!await verify(b.currentPassword,a.password))fail(401,'Current password was not recognized.');const password=await passwordHash(b.newPassword),recovery=random();transaction(()=>{if(q('SELECT password FROM accounts WHERE id=?',id)?.password!==a.password)fail(401,'Password changed. Please sign in again.');run('UPDATE accounts SET password=?,recovery_hash=? WHERE id=?',password,hash(recovery),id);run('DELETE FROM sessions WHERE account_id=?',id)});return{account:profile(id),token:issue(id),recovery}}
 async function recover(b){const a=q('SELECT * FROM accounts WHERE username=?',String(b.username||'').toLowerCase());if(!a||hash(b.recovery||'')!==a.recovery_hash)fail(401,'Username or recovery key was not recognized.');const password=await passwordHash(b.newPassword),recovery=random();transaction(()=>{const current=q('SELECT recovery_hash FROM accounts WHERE id=?',a.id);if(current.recovery_hash!==a.recovery_hash)fail(401,'This recovery key has already been used.');run('UPDATE accounts SET password=?,recovery_hash=? WHERE id=?',password,hash(recovery),a.id);run('DELETE FROM sessions WHERE account_id=?',a.id)});return{account:profile(a.id),token:issue(a.id),recovery}}
 function saveRoom(r){run('INSERT INTO districts(code,owner_id,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(code) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',r.code,r.ownerId,JSON.stringify({map:r.map.id,phase:r.phase,quests:r.quests,banned:[...(r.banned||[])],chat:r.chat.slice(-30)}),now())}
 function savePlayer(r,p){const payload={x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch,hp:p.hp,ammo:p.ammo,kills:p.kills,deaths:p.deaths,score:p.score,respawnAt:p.respawnAt};run('INSERT INTO visits VALUES(?,?,?,?) ON CONFLICT(account_id,code) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',p.accountId,r.code,JSON.stringify(payload),now())}
 function checkpoint(r){transaction(()=>{saveRoom(r);for(const p of r.players.values())savePlayer(r,p)})}
 function kill(r,p,v){transaction(()=>{run('UPDATE accounts SET kills=kills+1,reputation=reputation+25 WHERE id=?',p.accountId);run('UPDATE accounts SET deaths=deaths+1 WHERE id=?',v.accountId);saveRoom(r);savePlayer(r,p);savePlayer(r,v)})}
 function reward(r,quest){transaction(()=>{saveRoom(r);for(const p of r.players.values()){const result=run('INSERT OR IGNORE INTO rewards VALUES(?,?,?,?)',p.accountId,quest.id,JSON.stringify(r.quests[quest.id].choices),now());if(result.changes){run('UPDATE accounts SET reputation=reputation+? WHERE id=?',quest.reward,p.accountId);p.score+=quest.reward}savePlayer(r,p)}})}
 return{db,filename,profile,register,login,account,update,change,recover,checkpoint,kill,reward,
 logout:token=>run('DELETE FROM sessions WHERE token_hash=?',hash(token||'')),
 logoutAll:id=>run('DELETE FROM sessions WHERE account_id=?',id),
 room:code=>{const r=q('SELECT * FROM districts WHERE code=?',code);return r?{...JSON.parse(r.payload),code:r.code,ownerId:r.owner_id}:null},
 visit:(id,code)=>{const v=q('SELECT payload FROM visits WHERE account_id=? AND code=?',id,code);return v?JSON.parse(v.payload):null},
 recent:id=>all('SELECT v.code,d.payload,v.updated_at AS updatedAt FROM visits v JOIN districts d USING(code) WHERE v.account_id=? ORDER BY v.updated_at DESC LIMIT 20',id).map(v=>({code:v.code,map:JSON.parse(v.payload).map,updatedAt:v.updatedAt})),
 leaders:()=>all('SELECT id,username,display_name AS displayName,bio,color,kills,deaths,reputation FROM accounts ORDER BY reputation DESC,created_at ASC LIMIT 25'),
 backup:async output=>{await backup(db,output);fs.chmodSync(output,0o600)},close:()=>db.close()};
}
module.exports={createStore};
