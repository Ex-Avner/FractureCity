'use strict';
const crypto=require('node:crypto');
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
function createMedia(db,now=Date.now){
 db.exec('CREATE TABLE IF NOT EXISTS gallery_media(id TEXT PRIMARY KEY,author TEXT NOT NULL REFERENCES accounts(id),mime TEXT NOT NULL,name TEXT NOT NULL,bytes INTEGER NOT NULL,data BLOB NOT NULL,created INTEGER NOT NULL)');
 function upload(author,b){
  if(typeof b.data!=='string'||b.data.length>16777216||/[^A-Za-z0-9+/=]/.test(b.data))fail(400,'Choose a valid photo or audio file.');
  const data=Buffer.from(b.data,'base64'),mime=b.mime;if(data.toString('base64')!==b.data)fail(400,'Invalid file encoding.');
  if(!data.length||data.length>12*1024*1024)fail(413,'Audio must be at most 12 MB.');
  if(mime==='image/png'){
   if(data.length<33||!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||data.toString('ascii',12,16)!=='IHDR')fail(400,'Invalid PNG photo.');
   const w=data.readUInt32BE(16),h=data.readUInt32BE(20);if(!w||!h||w>2048||h>2048||data.length>4*1024*1024)fail(413,'Photos must fit 2048 pixels and 4 MB.');
  }else if(mime==='audio/mpeg'){if(data.toString('ascii',0,3)!=='ID3'&&!(data[0]===255&&(data[1]&224)===224))fail(400,'Invalid MP3 file.');}
  else if(mime==='audio/wav'){if(data.length<44||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WAVE')fail(400,'Invalid WAV file.');}
  else fail(415,'Use a photo, MP3 or WAV.');
  db.prepare('DELETE FROM gallery_media WHERE created<? AND id NOT IN (SELECT photo FROM social_works WHERE photo IS NOT NULL UNION SELECT audio FROM social_works WHERE audio IS NOT NULL)').run(now()-86400000);
  if(db.prepare('SELECT COALESCE(SUM(bytes),0) n FROM gallery_media WHERE author=?').get(author).n+data.length>64*1024*1024)fail(413,'Your media storage is full (64 MB). Remove an older exhibit first.');
  if(db.prepare('SELECT COALESCE(SUM(bytes),0) n FROM gallery_media').get().n+data.length>Number(process.env.MEDIA_QUOTA_MB||128)*1024*1024)fail(507,'The gallery storage is full. Contact the server owner.');
  const id=crypto.randomUUID(),name=String(b.name||'Untitled').replace(/[\x00-\x1f\x7f<>]/g,'').slice(0,120);db.prepare('INSERT INTO gallery_media VALUES(?,?,?,?,?,?,?)').run(id,author,mime,name,data.length,data,now());return{id,mime,name,bytes:data.length};
 }
 function owned(id,author,type){const m=db.prepare('SELECT id,mime FROM gallery_media WHERE id=? AND author=?').get(String(id),author);if(!m||!m.mime.startsWith(type+'/'))fail(400,'Choose your own uploaded '+type+'.');return m.id}
 function read(id,viewer){const m=db.prepare('SELECT * FROM gallery_media WHERE id=?').get(id);if(!m)fail(404,'Media not found.');if(m.author!==viewer){if(!db.prepare('SELECT 1 FROM social_works WHERE photo=? OR audio=?').get(id,id))fail(404,'Media not published.');if(db.prepare('SELECT 1 FROM social_blocks WHERE (author=? AND target=?) OR (author=? AND target=?)').get(viewer,m.author,m.author,viewer))fail(404,'Media unavailable.')}return m}
 function discard(id,author){if(db.prepare('SELECT 1 FROM social_works WHERE photo=? OR audio=?').get(id,id))fail(409,'Remove the exhibit before deleting its media.');db.prepare('DELETE FROM gallery_media WHERE id=? AND author=?').run(id,author);return{ok:true}}
 return{upload,owned,read,discard};
}
module.exports={createMedia};
