'use strict';
// The Main Beta: one permanent, code-free city room that anyone with an account
// can walk into, alongside the existing private invite rooms.
//
// This module owns the policy, not the transport. server.cjs asks it:
//   · which code is the Main Beta (stable across restarts and deploys)
//   · who the server owner is (OWNER_USERNAMES, never "whoever came first")
//   · when an idle resident's building plot or gallery space may be released
//   · which old backups to delete so the disk cannot fill
//
// Released work is ARCHIVED, never deleted: the plot's blocks and doors, and the
// gallery exhibit with its replies, are copied to *_archive tables first, and
// their uploaded photo/audio stays in the database.
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const DAY=86400000;

// A valid 10-character uppercase hex code, like every other room, so every
// existing validator (city-online.js, the lobby, ?room= links) accepts it.
function mainCode(env=process.env){
 const set=String(env.MAIN_ROOM_CODE||'').trim().toUpperCase();
 if(set){if(!/^[A-F0-9]{10}$/.test(set))throw Error('MAIN_ROOM_CODE must be 10 hexadecimal characters.');return set}
 return crypto.createHash('sha256').update('fracture-city-main-beta').digest('hex').slice(0,10).toUpperCase();
}
function ownerNames(env=process.env){return String(env.OWNER_USERNAMES||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)}

function createMainBeta(db,opts={}){
 const now=opts.now||Date.now,code=opts.code||mainCode(),owners=new Set((opts.owners||ownerNames()).map(s=>s.toLowerCase()));
 const idleDays=Number(opts.idleDays??process.env.IDLE_RELEASE_DAYS??30),idleMs=idleDays*DAY;
 const one=(s,...p)=>db.prepare(s).get(...p),all=(s,...p)=>db.prepare(s).all(...p),run=(s,...p)=>db.prepare(s).run(...p);
 db.exec(`CREATE TABLE IF NOT EXISTS account_activity(account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,seen_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS city_structures_archive(id INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT NOT NULL,author TEXT NOT NULL,slot INTEGER NOT NULL,cells TEXT NOT NULL,doors TEXT NOT NULL,archived_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS social_works_archive(id TEXT PRIMARY KEY,slot INTEGER NOT NULL,author TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,pixels TEXT,photo TEXT,audio TEXT,created INTEGER NOT NULL,replies TEXT NOT NULL,appreciations INTEGER NOT NULL,archived_at INTEGER NOT NULL);`);
 const touched=new Map();
 // At most one write per account per hour: this runs on authenticated requests.
 function touch(accountId){const t=now();if(!accountId||t-(touched.get(accountId)||0)<3600000)return;touched.set(accountId,t);run('INSERT INTO account_activity VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET seen_at=excluded.seen_at',accountId,t)}
 // The most recent sign of life: any authenticated use, any room visit, or account creation.
 function lastSeen(accountId){const a=one('SELECT seen_at FROM account_activity WHERE account_id=?',accountId)?.seen_at||0,v=one('SELECT MAX(updated_at) AS t FROM visits WHERE account_id=?',accountId)?.t||0,c=one('SELECT created_at FROM accounts WHERE id=?',accountId)?.created_at||0;return Math.max(a,v,c)}
 function isOwner(accountId){if(!owners.size)return false;const u=one('SELECT username FROM accounts WHERE id=?',accountId)?.username;return !!u&&owners.has(u)}
 function idle(accountId,present){return !present.has(accountId)&&!isOwner(accountId)&&now()-lastSeen(accountId)>=idleMs}

 // Main Beta only: free the longest-idle plot so a newcomer can build.
 function releasePlot(room,present=new Set()){
  if(room!==code)return false;
  const rows=all('SELECT * FROM city_structures WHERE room=?',room).filter(r=>idle(r.author,present)).sort((a,b)=>lastSeen(a.author)-lastSeen(b.author));
  const r=rows[0];if(!r)return false;
  db.exec('BEGIN IMMEDIATE');try{
   run('INSERT INTO city_structures_archive(room,author,slot,cells,doors,archived_at) VALUES(?,?,?,?,?,?)',r.room,r.author,r.slot,r.cells,r.doors,now());
   run('DELETE FROM city_structures WHERE room=? AND author=?',r.room,r.author);
   run('INSERT INTO city_structure_versions VALUES(?,1) ON CONFLICT(room) DO UPDATE SET revision=revision+1',r.room);
   db.exec('COMMIT');return true}catch(e){db.exec('ROLLBACK');throw e}
 }
 // Only when all eight server-wide gallery spaces are taken.
 function releaseGallery(present=new Set()){
  const works=all('SELECT * FROM social_works ORDER BY slot');if(works.length<8)return 0;
  let freed=0;
  for(const w of works){if(!idle(w.author,present))continue;
   db.exec('BEGIN IMMEDIATE');try{
    const replies=all('SELECT author,body,created FROM social_replies WHERE work=? ORDER BY created',w.id),hearts=one('SELECT COUNT(*) AS n FROM social_hearts WHERE work=?',w.id).n;
    run('INSERT OR REPLACE INTO social_works_archive VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',w.id,w.slot,w.author,w.title,w.body,w.pixels??null,w.photo??null,w.audio??null,w.created,JSON.stringify(replies),hearts,now());
    run('DELETE FROM social_works WHERE id=?',w.id);
    db.exec('COMMIT');freed++}catch(e){db.exec('ROLLBACK');throw e}}
  return freed;
 }
 return{code,touch,lastSeen,isOwner,releasePlot,releaseGallery,idleDays};
}

// Keep the newest `keep` daily backups. Only files this server wrote are touched.
function pruneBackups(dir,keep=7){
 if(!dir||!fs.existsSync(dir))return [];
 const files=fs.readdirSync(dir).filter(f=>/^districts-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort().reverse(),gone=files.slice(Math.max(1,keep));
 for(const f of gone)fs.rmSync(path.join(dir,f),{force:true});
 return gone;
}
module.exports={createMainBeta,mainCode,ownerNames,pruneBackups};
