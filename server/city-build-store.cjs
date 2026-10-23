'use strict';
const KINDS=new Set(['box','sphere','cylinder','cone','ring','wedge','sign','mural']);
const FINISHES=new Set(['matte','metal','gloss','glow','glass']);
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
function validate(objects){
 if(!Array.isArray(objects)||objects.length>1000)fail(400,'Each resident can publish up to 1,000 art pieces per city.');
 const seen=new Set();return objects.map(o=>{
 if(!o||typeof o.id!=='string'||! /^[a-z0-9_-]{1,80}$/i.test(o.id)||seen.has(o.id))fail(400,'Invalid or repeated piece identifier.');seen.add(o.id);
 if(!KINDS.has(o.kind)||!FINISHES.has(o.finish)||(typeof o.color!=='string'||!/^#[a-f\d]{6}$/i.test(o.color)))fail(400,'Invalid shape, finish or color.');
 for(const k of ['p','s','r'])if(!Array.isArray(o[k])||o[k].length!==3||!o[k].every(Number.isFinite))fail(400,'Invalid piece transform.');
 if(Math.abs(o.p[0])>2048||Math.abs(o.p[2])>2048||o.p[1]<0||o.p[1]>94||o.s.some(v=>v<.025||v>20)||o.r.some(v=>Math.abs(v)>36000))fail(400,'Piece is outside supported bounds.');
 const v={id:o.id,kind:o.kind,p:o.p.map(n=>+n.toFixed(5)),s:o.s.map(n=>+n.toFixed(5)),r:o.r.map(n=>+n.toFixed(5)),color:o.color,finish:o.finish};
 if(o.group!==undefined){if(typeof o.group!=='string'||! /^[a-z0-9_-]{1,80}$/i.test(o.group))fail(400,'Invalid piece group.');v.group=o.group}
 if(o.kind==='sign'){if(typeof o.text!=='string'||o.text.length>100)fail(400,'Signs can contain up to 100 characters.');v.text=o.text.replace(/[\x00-\x1f\x7f]/g,' ')||'YOUR CITY'}
 if(o.kind==='mural'){if(!Array.isArray(o.pixels)||o.pixels.length!==256||!o.pixels.every(c=>typeof c==='string'&&/^#[a-f\d]{6}$/i.test(c)))fail(400,'Invalid painted mural.');v.pixels=[...o.pixels]}
 return v;
 });
}
function createCityBuildStore(db){
 db.exec(`CREATE TABLE IF NOT EXISTS city_art_versions(room TEXT PRIMARY KEY REFERENCES districts(code),revision INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS city_art(room TEXT NOT NULL REFERENCES districts(code),author TEXT NOT NULL REFERENCES accounts(id),revision INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(room,author));`);
 const rows=code=>db.prepare('SELECT author,revision,payload FROM city_art WHERE room=? ORDER BY author').all(code);
 const revision=code=>db.prepare('SELECT revision FROM city_art_versions WHERE room=?').get(code)?.revision||0;
 function snapshot(code,viewer){const owners=rows(code);return{revision:revision(code),ownRevision:owners.find(o=>o.author===viewer)?.revision||0,owners:owners.map(o=>({id:o.author,objects:JSON.parse(o.payload)}))}}
 function save(code,author,expected,objects,onChange){
 if(!Number.isSafeInteger(expected)||expected<0)fail(400,'Invalid artwork revision.');
 const normalized=validate(objects),payload=JSON.stringify(normalized);db.exec('BEGIN IMMEDIATE');
 try{const current=rows(code),own=current.find(o=>o.author===author);
 if(own?.payload===payload){db.exec('COMMIT');return snapshot(code,author)}
 if((own?.revision||0)!==expected)fail(409,'Your artwork changed in another session. Download your draft before reloading the city.');
 const others=current.filter(o=>o.author!==author).flatMap(o=>JSON.parse(o.payload)),ids=new Set(others.map(o=>o.id));
 if(normalized.some(o=>ids.has(o.id)))fail(403,'Another resident owns that piece.');
 const all=others.concat(normalized);if(all.length>4000)fail(409,'This city has reached its 4,000-piece limit.');
 if(all.filter(o=>['mural','sign'].includes(o.kind)).length>24)fail(409,'This city has room for 24 signs and murals.');
 onChange?.(own?JSON.parse(own.payload):[],normalized);
 db.prepare('INSERT INTO city_art VALUES(?,?,?,?) ON CONFLICT(room,author) DO UPDATE SET revision=excluded.revision,payload=excluded.payload').run(code,author,expected+1,payload);
 db.prepare('INSERT INTO city_art_versions VALUES(?,1) ON CONFLICT(room) DO UPDATE SET revision=revision+1').run(code);
 db.exec('COMMIT');return snapshot(code,author);
 }catch(e){db.exec('ROLLBACK');throw e}
 }
 return{revision,snapshot,save};
}
module.exports={createCityBuildStore,validate};
