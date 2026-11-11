'use strict';
const P=require('../apps/fracture-city-game/college-progress.js');
function createCollege(db,{now=Date.now}={}){
 db.exec('CREATE TABLE IF NOT EXISTS college_progress(account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,payload TEXT NOT NULL)');
 function read(id){const r=db.prepare('SELECT payload FROM college_progress WHERE account_id=?').get(id);return r?JSON.parse(r.payload):P.fresh();}
 function write(id,b){db.exec('BEGIN IMMEDIATE');try{const s=P.apply(read(id),b,now());db.prepare('INSERT INTO college_progress VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET payload=excluded.payload').run(id,JSON.stringify(s));db.exec('COMMIT');return s;}catch(e){db.exec('ROLLBACK');throw e;}}
 return {read,write};
}
module.exports={createCollege};
