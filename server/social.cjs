'use strict';
const crypto=require('node:crypto');
function createSocial(db,now=Date.now,media){
const run=(s,...p)=>db.prepare(s).run(...p),one=(s,...p)=>db.prepare(s).get(...p),all=(s,...p)=>db.prepare(s).all(...p),fail=(n,s)=>{throw Object.assign(Error(s),{status:n})},clean=(s,n)=>String(s||'').replace(/[\x00-\x1f\x7f<>]/g,'').trim().slice(0,n),id=()=>crypto.randomUUID();
db.exec(`CREATE TABLE IF NOT EXISTS social_works(id TEXT PRIMARY KEY,slot INTEGER UNIQUE NOT NULL,author TEXT NOT NULL REFERENCES accounts(id),title TEXT NOT NULL,body TEXT NOT NULL,pixels TEXT,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS social_replies(id TEXT PRIMARY KEY,work TEXT NOT NULL REFERENCES social_works(id) ON DELETE CASCADE,author TEXT NOT NULL REFERENCES accounts(id),body TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS social_hearts(work TEXT NOT NULL REFERENCES social_works(id) ON DELETE CASCADE,author TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(work,author));
CREATE TABLE IF NOT EXISTS social_follows(author TEXT NOT NULL REFERENCES accounts(id),target TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(author,target));
CREATE TABLE IF NOT EXISTS social_blocks(author TEXT NOT NULL REFERENCES accounts(id),target TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(author,target));
CREATE TABLE IF NOT EXISTS social_reports(id TEXT PRIMARY KEY,author TEXT NOT NULL REFERENCES accounts(id),work TEXT NOT NULL,reason TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(author,work));
CREATE INDEX IF NOT EXISTS social_reply_work ON social_replies(work,created);`);
for(const name of ['photo','audio'])if(!db.prepare('PRAGMA table_info(social_works)').all().some(c=>c.name===name))db.exec('ALTER TABLE social_works ADD COLUMN '+name+' TEXT');
// 0.82: the feed. Posts that are not on a gallery board (boards stay in
// social_works, so nothing already published moves), and a profile record
// with a tagline and the resident's wardrobe look.
db.exec(`CREATE TABLE IF NOT EXISTS social_posts(id TEXT PRIMARY KEY,author TEXT NOT NULL REFERENCES accounts(id),title TEXT NOT NULL,body TEXT NOT NULL,pixels TEXT,photo TEXT,audio TEXT,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS social_post_replies(id TEXT PRIMARY KEY,post TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,author TEXT NOT NULL REFERENCES accounts(id),body TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS social_post_hearts(post TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,author TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(post,author));
CREATE TABLE IF NOT EXISTS social_profiles(account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,tagline TEXT NOT NULL DEFAULT '',look TEXT,updated INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS social_posts_created ON social_posts(created);
CREATE INDEX IF NOT EXISTS social_posts_author ON social_posts(author,created);
CREATE INDEX IF NOT EXISTS social_post_reply_post ON social_post_replies(post,created);`);
const POSTS_PER_HOUR=12,POSTS_KEPT=200,PAGE=20;
const blocked=(a,b)=>!!one('SELECT 1 FROM social_blocks WHERE (author=? AND target=?) OR (author=? AND target=?)',a,b,b,a);
const person=id=>one('SELECT id,username,display_name AS name,bio,color FROM accounts WHERE id=?',id);
function snapshot(viewer){return{works:all('SELECT * FROM social_works ORDER BY slot').filter(w=>!blocked(viewer,w.author)).map(w=>({id:w.id,slot:w.slot,title:w.title,text:w.body,pixels:w.pixels?JSON.parse(w.pixels):null,photo:w.photo||null,audio:w.audio||null,at:w.created,artist:person(w.author),following:!!one('SELECT 1 FROM social_follows WHERE author=? AND target=?',viewer,w.author),appreciated:!!one('SELECT 1 FROM social_hearts WHERE author=? AND work=?',viewer,w.id),appreciations:one('SELECT COUNT(*) AS n FROM social_hearts WHERE work=?',w.id).n,replies:all('SELECT * FROM social_replies WHERE work=? ORDER BY created DESC,id DESC LIMIT 40',w.id).filter(r=>!blocked(viewer,r.author)).reverse().map(r=>({id:r.id,text:r.body,artist:person(r.author)}))})),blocked:all('SELECT target FROM social_blocks WHERE author=?',viewer).map(b=>person(b.target)),viewer}}
//  ── Feed, posts and profiles (0.82) ──
const extra=id=>one('SELECT tagline,look FROM social_profiles WHERE account_id=?',id);
const card=(viewer,id)=>{const p=person(id);if(!p)return null;const x=extra(id);return{...p,tagline:x?.tagline||'',look:x?.look?JSON.parse(x.look):null,following:viewer?!!one('SELECT 1 FROM social_follows WHERE author=? AND target=?',viewer,id):false}};
function postView(viewer,p,full){const replies=all('SELECT * FROM social_post_replies WHERE post=? ORDER BY created DESC,id DESC LIMIT 60',p.id).filter(r=>!blocked(viewer,r.author)).reverse();
 return{kind:'post',id:p.id,title:p.title,text:p.body,pixels:p.pixels?JSON.parse(p.pixels):null,photo:p.photo||null,audio:p.audio||null,at:p.created,artist:card(viewer,p.author),appreciated:!!one('SELECT 1 FROM social_post_hearts WHERE author=? AND post=?',viewer,p.id),appreciations:one('SELECT COUNT(*) AS n FROM social_post_hearts WHERE post=?',p.id).n,replyCount:replies.length,replies:full?replies.map(r=>({id:r.id,text:r.body,at:r.created,artist:person(r.author)})):undefined}}
function workView(viewer,w,full){const replies=all('SELECT * FROM social_replies WHERE work=? ORDER BY created DESC,id DESC LIMIT 40',w.id).filter(r=>!blocked(viewer,r.author)).reverse();
 return{kind:'board',id:w.id,slot:w.slot,title:w.title,text:w.body,pixels:w.pixels?JSON.parse(w.pixels):null,photo:w.photo||null,audio:w.audio||null,at:w.created,artist:card(viewer,w.author),appreciated:!!one('SELECT 1 FROM social_hearts WHERE author=? AND work=?',viewer,w.id),appreciations:one('SELECT COUNT(*) AS n FROM social_hearts WHERE work=?',w.id).n,replyCount:replies.length,replies:full?replies.map(r=>({id:r.id,text:r.body,at:r.created,artist:person(r.author)})):undefined}}
//  Newest first across board works and posts. scope 'following' keeps the
//  people you follow (and you); before pages back by time.
function feed(viewer,{scope='all',before=Infinity,author=null}={}){
 const t=before!=null&&before!==''&&Number.isFinite(+before)?+before:8.64e15,follow=new Set(all('SELECT target FROM social_follows WHERE author=?',viewer).map(r=>r.target));follow.add(viewer);
 const keep=a=>!blocked(viewer,a)&&(scope!=='following'||follow.has(a))&&(!author||a===author);
 const posts=all('SELECT * FROM social_posts WHERE created<? '+(author?'AND author=? ':'')+'ORDER BY created DESC LIMIT 200',...(author?[t,author]:[t])).filter(p=>keep(p.author)).map(p=>postView(viewer,p));
 const works=all('SELECT * FROM social_works WHERE created<? ORDER BY created DESC',t).filter(w=>keep(w.author)).map(w=>workView(viewer,w));
 const items=[...posts,...works].sort((a,b)=>b.at-a.at).slice(0,PAGE);
 return{items,more:items.length===PAGE,before:items.length?items[items.length-1].at:null,scope}}
function profile(viewer,ref){
 const row=String(ref||'').startsWith('id:')?one('SELECT id FROM accounts WHERE id=?',String(ref).slice(3)):one('SELECT id FROM accounts WHERE username=?',String(ref||'').toLowerCase());
 if(!row||blocked(viewer,row.id))fail(404,'No resident by that name.');const id=row.id,a=one('SELECT username,display_name,bio,color,reputation,created_at FROM accounts WHERE id=?',id);
 return{profile:{...card(viewer,id),reputation:a.reputation,joined:a.created_at,mine:id===viewer,muted:false,
  counts:{posts:one('SELECT COUNT(*) AS n FROM social_posts WHERE author=?',id).n+one('SELECT COUNT(*) AS n FROM social_works WHERE author=?',id).n,followers:one('SELECT COUNT(*) AS n FROM social_follows WHERE target=?',id).n,following:one('SELECT COUNT(*) AS n FROM social_follows WHERE author=?',id).n,appreciations:one('SELECT COUNT(*) AS n FROM social_post_hearts h JOIN social_posts p ON p.id=h.post WHERE p.author=?',id).n+one('SELECT COUNT(*) AS n FROM social_hearts h JOIN social_works w ON w.id=h.work WHERE w.author=?',id).n}},
  ...feed(viewer,{author:id})}}
function item(viewer,ref){const id=String(ref||'');const p=one('SELECT * FROM social_posts WHERE id=?',id);if(p&&!blocked(viewer,p.author))return{item:postView(viewer,p,true)};const w=one('SELECT * FROM social_works WHERE id=?',id);if(w&&!blocked(viewer,w.author))return{item:workView(viewer,w,true)};fail(404,'This post is unavailable.')}
function people(viewer,q){const like='%'+String(q||'').toLowerCase().replace(/[%_]/g,'')+'%';return{people:all("SELECT id FROM accounts WHERE lower(username) LIKE ? OR lower(display_name) LIKE ? ORDER BY reputation DESC,created_at DESC LIMIT 30",like,like).filter(r=>!blocked(viewer,r.id)).map(r=>card(viewer,r.id))}}
function action(who,kind,b){const uid=who.id;
 if(kind==='post'){const title=clean(b.title,60),body=clean(b.text,500);if(!body)fail(400,'Write something first.');if(b.pixels!=null&&(!Array.isArray(b.pixels)||b.pixels.length!==256||!b.pixels.every(c=>/^#[a-f\d]{6}$/i.test(c))))fail(400,'Choose a valid painted mural.');
  if(one('SELECT COUNT(*) AS n FROM social_posts WHERE author=? AND created>?',uid,now()-3600000).n>=POSTS_PER_HOUR)fail(429,'That is a lot of posting. Try again in a little while.');
  const photo=b.photo?media?.owned(b.photo,uid,'image'):null,audio=b.audio?media?.owned(b.audio,uid,'audio'):null;if((b.photo&&!photo)||(b.audio&&!audio))fail(400,'Media uploads are unavailable.');
  const pid=id();run('INSERT INTO social_posts VALUES(?,?,?,?,?,?,?,?)',pid,uid,title,body,b.pixels?JSON.stringify(b.pixels):null,photo||null,audio||null,now());
  //  Keep the newest POSTS_KEPT per resident.
  for(const old of all('SELECT id FROM social_posts WHERE author=? ORDER BY created DESC LIMIT -1 OFFSET ?',uid,POSTS_KEPT))run('DELETE FROM social_posts WHERE id=?',old.id);
  return{ok:true,...item(uid,pid)}}
 if(kind==='post-reply'||kind==='post-appreciate'||kind==='post-remove'||kind==='post-remove-reply'){
  const p=one('SELECT * FROM social_posts WHERE id=?',String(b.post||''));if(!p||blocked(uid,p.author))fail(404,'This post is unavailable.');
  if(kind==='post-reply'){const body=clean(b.text,280);if(!body)fail(400,'Write a reply.');if(one('SELECT COUNT(*) AS n FROM social_post_replies WHERE post=?',p.id).n>=200)fail(409,'This conversation is full.');run('INSERT INTO social_post_replies VALUES(?,?,?,?,?)',id(),p.id,uid,body,now())}
  else if(kind==='post-appreciate'){if(b.enabled===true)run('INSERT OR IGNORE INTO social_post_hearts VALUES(?,?)',p.id,uid);else if(b.enabled===false)run('DELETE FROM social_post_hearts WHERE post=? AND author=?',p.id,uid);else fail(400,'Choose on or off.')}
  else if(kind==='post-remove'){if(p.author!==uid)fail(403,'Only the author can remove this post.');run('DELETE FROM social_posts WHERE id=?',p.id);for(const m of [p.photo,p.audio].filter(Boolean))if(!one('SELECT 1 FROM social_works WHERE photo=? OR audio=?',m,m)&&!one('SELECT 1 FROM social_posts WHERE photo=? OR audio=?',m,m))run('DELETE FROM gallery_media WHERE id=? AND author=?',m,uid);return{ok:true,removed:p.id}}
  else{const r=one('SELECT * FROM social_post_replies WHERE id=? AND post=?',String(b.reply||''),p.id);if(!r||r.author!==uid&&p.author!==uid)fail(403,'Only the writer or the author can remove this reply.');run('DELETE FROM social_post_replies WHERE id=?',r.id)}
  return item(uid,p.id)}
 if(kind==='profile'){const tagline=clean(b.tagline,80);let look=null;if(b.look!==undefined&&b.look!==null){if(typeof b.look!=='object'||Array.isArray(b.look))fail(400,'Invalid look.');look=JSON.stringify(require('./looks.cjs').clean(b.look,sku=>!!one('SELECT 1 FROM wallet_items WHERE account_id=? AND sku=? AND count>0',uid,sku)))}
  const cur=extra(uid);run('INSERT INTO social_profiles VALUES(?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET tagline=excluded.tagline,look=COALESCE(excluded.look,social_profiles.look),updated=excluded.updated',uid,b.tagline===undefined?(cur?.tagline||''):tagline,look,now());return profile(uid,'id:'+uid)}
 if(kind==='publish'){if(!Number.isInteger(b.slot)||b.slot<0||b.slot>=8)fail(400,'Choose one of the eight gallery spaces.');const title=clean(b.title,60),body=clean(b.text,320);if(!title||!body)fail(400,'Give your work a title and a story.');if(b.pixels!=null&&(!Array.isArray(b.pixels)||b.pixels.length!==256||!b.pixels.every(c=>/^#[a-f\d]{6}$/i.test(c))))fail(400,'Choose a valid painted mural.');const existing=one('SELECT * FROM social_works WHERE slot=?',b.slot);if(existing&&existing.author!==uid)fail(409,'Another artist occupies this space. Choose an empty display.');if(!existing&&one('SELECT COUNT(*) AS n FROM social_works WHERE author=?',uid).n>=2)fail(409,'Each artist can occupy two displays. Remove an older work to make room.');if(existing)fail(409,'Remove your existing work before publishing a replacement.');const photo=b.photo?media?.owned(b.photo,uid,'image'):null,audio=b.audio?media?.owned(b.audio,uid,'audio'):null;if((b.photo&&!photo)||(b.audio&&!audio))fail(400,'Media uploads are unavailable.');run('INSERT INTO social_works(id,slot,author,title,body,pixels,created,photo,audio) VALUES(?,?,?,?,?,?,?,?,?)',id(),b.slot,uid,title,body,b.pixels?JSON.stringify(b.pixels):null,now(),photo||null,audio||null);return snapshot(uid)}
 if(kind==='follow'||kind==='block'){const target=person(b.target);if(!target||target.id===uid)fail(400,'Choose another artist.');const table=kind==='follow'?'social_follows':'social_blocks';if(kind==='follow'&&blocked(uid,target.id))fail(403,'This artist is unavailable.');if(b.enabled===true){run(`INSERT OR IGNORE INTO ${table} VALUES(?,?)`,uid,target.id);if(kind==='block')run('DELETE FROM social_follows WHERE (author=? AND target=?) OR (author=? AND target=?)',uid,target.id,target.id,uid)}else if(b.enabled===false)run(`DELETE FROM ${table} WHERE author=? AND target=?`,uid,target.id);else fail(400,'Choose on or off.');return snapshot(uid)}
 const work=one('SELECT * FROM social_works WHERE id=?',String(b.work||''));if(!work||blocked(uid,work.author))fail(404,'This work is unavailable.');
 if(kind==='reply'){const body=clean(b.text,140);if(!body)fail(400,'Write a response.');if(one('SELECT COUNT(*) AS n FROM social_replies WHERE work=?',work.id).n>=40)fail(409,'This conversation is full.');run('INSERT INTO social_replies VALUES(?,?,?,?,?)',id(),work.id,uid,body,now())}
 else if(kind==='appreciate'){if(b.enabled===true)run('INSERT OR IGNORE INTO social_hearts VALUES(?,?)',work.id,uid);else if(b.enabled===false)run('DELETE FROM social_hearts WHERE work=? AND author=?',work.id,uid);else fail(400,'Choose on or off.')}
 else if(kind==='remove'){if(work.author!==uid)fail(403,'Only the artist can remove this work.');run('DELETE FROM social_works WHERE id=?',work.id);for(const id of [work.photo,work.audio].filter(Boolean))if(!one('SELECT 1 FROM social_works WHERE photo=? OR audio=?',id,id))run('DELETE FROM gallery_media WHERE id=? AND author=?',id,uid)}
 else if(kind==='remove-reply'){const reply=one('SELECT * FROM social_replies WHERE id=? AND work=?',String(b.reply||''),work.id);if(!reply||reply.author!==uid&&work.author!==uid)fail(403,'Only the writer or exhibiting artist can remove this response.');run('DELETE FROM social_replies WHERE id=?',reply.id)}
 else if(kind==='report'){const reason=clean(b.reason,200);if(!reason)fail(400,'Describe the issue.');run('INSERT OR IGNORE INTO social_reports VALUES(?,?,?,?,?)',id(),uid,work.id,reason,now())}
 else fail(404,'Unknown social action.');return snapshot(uid)
}
return{snapshot,action,feed,profile,item,people};
}
module.exports={createSocial};
