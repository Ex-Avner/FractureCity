'use strict';
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),GAME=path.join(ROOT,'apps/fracture-city-game'),W=require(path.join(GAME,'dispatch-world.js')),C=require(path.join(GAME,'dispatch-content.js'));
const {createStore}=require('./store.cjs');
const {createSocial}=require('./social.cjs');
const {createMedia}=require('./gallery-media.cjs');
const {createCityBuildStore}=require('./city-build-store.cjs');
const clean=(s,n)=>String(s||'').replace(/[\x00-\x1f\x7f<>]/g,'').trim().slice(0,n),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),id=()=>crypto.randomBytes(16).toString('hex');
function createServer(opts={}){
const rooms=new Map(),tokens=new Map(),limits=new Map(),now=opts.now||Date.now;let tickTimer,tickCount=0;const store=createStore(opts.dbPath||process.env.DB_PATH||path.join(__dirname,'data','districts.sqlite'),now);
const media=createMedia(store.db,now),social=createSocial(store.db,now,media),cityBuild=createCityBuildStore(store.db);
function accountToken(req){return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('fc_account='))?.slice(11)||''}
function account(req){const a=store.account(accountToken(req));if(!a)fail(401,'Please sign in to your resident account.');return a}
function cookie(res,token){res.setHeader('Set-Cookie','fc_account='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+(token?2592000:0)+(process.env.NODE_ENV==='production'||opts.secureCookies?'; Secure':''))}
function json(res,value){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value))}
function revokePlayers(id){for(const r of [...rooms.values()])for(const p of [...r.players.values()])if(p.accountId===id)remove(r,p)}
function fail(code,message){throw Object.assign(Error(message),{status:code})}
function rate(key,max,period){let r=limits.get(key),t=now();if(!r||t-r.t>=period){r={t,n:0};limits.set(key,r)}if(++r.n>max)fail(429,'Please slow down and try again.')}
function state(r){return {code:r.code,artRevision:r.map.city?cityBuild.revision(r.code):0,map:r.map.id,phase:r.phase,host:r.host,time:now(),players:[...r.players.values()].map(p=>({id:p.id,accountId:p.accountId,name:p.name,color:p.color,x:p.x,y:p.y||0,z:p.z,yaw:p.yaw,pitch:p.pitch,hp:p.hp,ammo:p.ammo,reloading:p.reloadUntil>now(),ready:p.ready,connected:!!p.stream,kills:p.kills,deaths:p.deaths,score:p.score,moving:p.moving,sprint:p.sprint,safe:W.safe(p),protected:p.protectUntil>now(),respawnAt:p.respawnAt,emote:p.emoteUntil>now()?p.emote:null,seq:p.seq})),quests:r.quests,chat:r.chat,events:r.events.slice(-10)}}
function publish(r){const message='data: '+JSON.stringify(state(r))+'\n\n';for(const p of r.players.values())if(p.stream){if(p.stream.writableLength>131072){p.stream.destroy();p.stream=null}else p.stream.write(message)}}
function system(r,text){r.chat.push({id:id(),name:'Dispatch',text,at:now()});r.chat=r.chat.slice(-30)}
function spawn(p){p.x=(p.seat%4-1.5)*2;p.z=(Math.floor(p.seat/4)-1)*2;p.hp=100;p.ammo=6;p.respawnAt=0;p.protectUntil=now()+5000;p.input={x:0,z:0};p.reloadUntil=0}
function remove(r,p){store.checkpoint(r);p.stream?.end();r.players.delete(p.id);tokens.delete(p.tokenHash);if(r.host===p.id)r.host=r.players.keys().next().value||null;system(r,p.name+' left.');if(!r.players.size)rooms.delete(r.code);else publish(r)}
function tick(){const t=now();tickCount++;for(const r of rooms.values()){for(const p of [...r.players.values()]){if(t-p.seen>45000){remove(r,p);continue}if(r.phase!=='live')continue;if(p.hp<=0){if(t>=p.respawnAt)spawn(p);continue}if(p.reloadUntil&&t>=p.reloadUntil){p.ammo=6;p.reloadUntil=0}if(r.map.city){p.moving=t-(p.poseAt||0)<300&&!!p.moving;continue}if(t-p.inputAt<300)W.move(p,p.input,.05,r.map);else p.moving=false;if(W.safe(p))p.hp=Math.min(100,p.hp+.15)}if(tickCount%100===0)store.checkpoint(r);if(tickCount%2===0)publish(r)}for(const [k,v]of limits)if(t-v.t>120000)limits.delete(k)}
async function body(req,maxBytes=4096){let parts=[],size=0;for await(const c of req){size+=c.length;if(size>maxBytes)fail(413,'Message too large.');parts.push(c)}try{const v=JSON.parse(Buffer.concat(parts).toString()||'{}');if(!v||Array.isArray(v)||typeof v!=='object')fail(400,'Invalid message.');return v}catch{fail(400,'Invalid message.')}}
function auth(req){const a=account(req);const t=(req.headers.authorization||'').replace(/^Bearer /,'');const v=tokens.get(hash(t));if(!v||v.p.accountId!==a.id)fail(401,'Session expired. Join a lobby again.');return v}
function shoot(r,p){if(r.map.city)return;const t=now();if(r.phase!=='live'||p.hp<=0||W.safe(p)||p.protectUntil>t||p.reloadUntil||t-p.shotAt<350||p.ammo<=0)return;p.shotAt=t;p.ammo--;const o={x:p.x,y:1.55,z:p.z},d={x:-Math.sin(p.yaw)*Math.cos(p.pitch),y:Math.sin(p.pitch),z:-Math.cos(p.yaw)*Math.cos(p.pitch)};let hit=null,dist=W.wallDistance(r.map,o,d);for(const q of r.players.values()){if(q===p||q.hp<=0||W.safe(q)||q.protectUntil>t)continue;const a=W.rayBox(o,d,{x:q.x-.35,y:0,z:q.z-.35},{x:q.x+.35,y:1.85,z:q.z+.35});if(a<dist){dist=a;hit=q}}if(hit){hit.hp=Math.max(0,hit.hp-25);if(!hit.hp){hit.deaths++;hit.respawnAt=t+5000;p.kills++;p.score+=25;store.kill(r,p,hit);system(r,p.name+' downed '+hit.name+'.')}}r.events.push({id:id(),type:'shot',player:p.id,x:p.x,y:p.y||0,z:p.z,yaw:p.yaw,pitch:p.pitch,distance:dist,hit:hit?.id||null});r.events=r.events.slice(-10)}
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/health'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,rooms:rooms.size,players:tokens.size,capacity:12}))}
if(u.pathname.startsWith('/api/')){res.setHeader('Cache-Control','no-store');
const origin=req.headers.origin;if(origin&&!(opts.publicOrigin||process.env.PUBLIC_ORIGIN?[opts.publicOrigin||process.env.PUBLIC_ORIGIN]:['http://'+req.headers.host,'https://'+req.headers.host]).includes(origin))fail(403,'Use this server’s own game page.');
if(u.pathname==='/api/events'&&req.method==='GET'){const {r,p}=auth(req);p.stream?.end();res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'});p.stream=res;p.seen=now();req.on('close',()=>{if(p.stream===res){p.stream=null;p.seen=now()}});publish(r);return}
if(u.pathname==='/api/account/me'&&req.method==='GET'){const a=account(req);return json(res,{account:a,rooms:store.recent(a.id)})}
if(u.pathname==='/api/social'&&req.method==='GET'){const a=account(req);rate('social-read:'+a.id,60,60000);return json(res,social.snapshot(a.id))}
if(u.pathname==='/api/profiles'&&req.method==='GET'){account(req);return json(res,{profiles:store.leaders()})}
if(u.pathname==='/api/city-art'){
 const {r,p}=auth(req);if(!r.map.city||r.phase!=='live')fail(409,'Enter the shared city first.');
 if(req.method==='GET'){rate('art-read:'+p.accountId,120,60000);return json(res,cityBuild.snapshot(r.code,p.accountId))}
 if(req.method!=='POST')fail(405,'Use GET or POST.');
 if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Send JSON.');
 rate('art-write:'+p.accountId,60,60000);const b=await body(req,262144);
 const result=cityBuild.save(r.code,p.accountId,b.revision,b.objects);json(res,result);publish(r);return;
}
if(u.pathname==='/api/media'&&req.method==='POST'){const a=account(req);rate('media:'+a.id,12,60000);if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Send JSON.');return json(res,media.upload(a.id,await body(req,17000000)))}
if(u.pathname.startsWith('/api/media/')){const a=account(req),key=u.pathname.slice(11);if(req.method==='DELETE')return json(res,media.discard(key,a.id));if(!['GET','HEAD'].includes(req.method))fail(405,'Use GET, HEAD or DELETE.');const m=media.read(key,a.id),data=Buffer.from(m.data);res.setHeader('Content-Type',m.mime);res.setHeader('Accept-Ranges','bytes');res.setHeader('Cache-Control','private, no-store');let start=0,end=data.length-1;const range=req.headers.range;if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match)fail(416,'Unsupported range.');start=Number(match[1]);end=match[2]?Math.min(end,Number(match[2])):end;if(start>end||start>=data.length){res.setHeader('Content-Range','bytes */'+data.length);fail(416,'Range outside file.')}res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${data.length}`)}res.setHeader('Content-Length',end-start+1);return res.end(req.method==='HEAD'?undefined:data.subarray(start,end+1))}
if(req.method!=='POST')fail(405,'Use POST.');if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Send JSON.');const b=await body(req),ip=req.socket.remoteAddress||'local';
if(u.pathname.startsWith('/api/social/')){const a=account(req);rate('social-write:'+a.id,20,60000);return json(res,social.action(a,u.pathname.split('/').pop(),b))}
if(u.pathname.startsWith('/api/account/')){
 rate('account-ip:'+ip,30,600000);
 const action=u.pathname.split('/').pop();
 if(['register','login','recover'].includes(action)){
  rate('account-name:'+String(b.username||'').toLowerCase(),10,600000);
  const result=await store[action](b);if(action==='recover')revokePlayers(result.account.id);
  cookie(res,result.token);return json(res,{account:result.account,recovery:result.recovery,rooms:store.recent(result.account.id)});
 }
 const a=account(req);
 if(action==='profile'){const updated=store.update(a.id,b);for(const r of rooms.values())for(const p of r.players.values())if(p.accountId===a.id){p.name=updated.displayName;p.color=updated.color}return json(res,{account:updated})}
 if(action==='password'){const result=await store.change(a.id,b);revokePlayers(a.id);cookie(res,result.token);return json(res,{account:result.account,recovery:result.recovery})}
 if(action==='logout'||action==='logout-all'){if(action==='logout-all')store.logoutAll(a.id);else store.logout(accountToken(req));revokePlayers(a.id);cookie(res,'');return json(res,{ok:true})}
 if(action==='export')return json(res,{account:a,districts:store.recent(a.id),exportedAt:now()});
 fail(404,'Unknown account action.');
}
if(u.pathname==='/api/join'){
 const a=account(req);rate('join:'+ip,30,60000);let r;const code=clean(b.code,12).toUpperCase();
 if(code){r=rooms.get(code);if(!r){const saved=store.room(code);if(!saved)fail(404,'Lobby not found.');if(rooms.size>=Number(opts.maxRooms||process.env.MAX_ROOMS||4))fail(503,'All active district slots are occupied. Try again shortly.');r={...saved,map:W.maps.find(m=>m.id===saved.map),players:new Map(),host:null,banned:new Set(saved.banned||[]),events:[]};rooms.set(code,r)}}
 else{if(rooms.size>=Number(opts.maxRooms||process.env.MAX_ROOMS||4))fail(503,'Server is full.');rate('create:'+a.id,5,3600000);const map=W.maps.find(m=>m.id===b.map)||W.maps[0];r={code:crypto.randomBytes(5).toString('hex').toUpperCase(),ownerId:a.id,map,host:null,phase:'lobby',players:new Map(),banned:new Set(),quests:Object.fromEntries(map.quests.map(q=>[q,{step:0,done:false,choices:[]}])) ,chat:[],events:[]};rooms.set(r.code,r);store.checkpoint(r)}
 if(r.banned.has(a.id)){if(!r.players.size)rooms.delete(r.code);fail(403,'The host has removed this account from this district.');}
 const existing=[...r.players.values()].find(p=>p.accountId===a.id);if(!existing&&r.players.size>=12)fail(409,'This lobby already has 12 players.');
 for(const other of [...rooms.values()])if(other!==r)for(const p of [...other.players.values()])if(p.accountId===a.id)remove(other,p);
 const token=crypto.randomBytes(32).toString('base64url');let p=existing;
 if(p){p.stream?.end();tokens.delete(p.tokenHash);p.stream=null;p.seen=now()}
 else{const used=new Set([...r.players.values()].map(p=>p.seat));let seat=0;while(used.has(seat))seat++;p={id:id(),accountId:a.id,seat,name:a.displayName,color:a.color,ready:r.phase==='live',kills:0,deaths:0,score:0,seen:now(),inputAt:0,shotAt:0,yaw:0,pitch:0,seq:0};spawn(p);if(r.map.city){p.x=155+(seat%4)*1.2;p.z=24+Math.floor(seat/4)*1.2;p.y=1}const saved=store.visit(a.id,r.code);if(saved){Object.assign(p,saved);p.input={x:0,z:0};p.protectUntil=now()+5000;if(p.hp<=0)spawn(p)}r.players.set(p.id,p);r.host ||= p.id;system(r,p.name+' arrived.')}
 p.tokenHash=hash(token);tokens.set(p.tokenHash,{r,p});store.checkpoint(r);return json(res,{token,id:p.id,code:r.code,room:state(r)});
}
const {r,p}=auth(req);rate('player:'+p.id,80,1000);p.seen=now();
switch(u.pathname){
case '/api/city-pose':{
 if(!r.map.city||r.phase!=='live')fail(409,'Enter the shared city first.');
 if(!Number.isSafeInteger(b.seq)||b.seq<=p.seq)fail(409,'Outdated position.');
 for(const k of ['x','y','z','yaw','pitch'])if(!Number.isFinite(b[k]))fail(400,'Invalid position.');
 if(Math.abs(b.x)>2048||Math.abs(b.z)>2048||b.y<0||b.y>160)fail(400,'Outside city bounds.');
 const dt=Math.min(2,Math.max(0,(now()-(p.poseAt||now()))/1000));
 if(Math.hypot(b.x-p.x,b.z-p.z)>2+dt*55||Math.abs(b.y-(p.y||1))>3+dt*45)fail(409,'Movement too far.');
 p.moving=Math.hypot(b.x-p.x,b.z-p.z)>.025;p.x=b.x;p.y=b.y;p.z=b.z;p.yaw=b.yaw%(Math.PI*2);p.pitch=Math.max(-1.3,Math.min(1.3,b.pitch));p.seq=b.seq;p.poseAt=now();break;
}
case '/api/input':{if(r.map.city)break;if(!Number.isSafeInteger(b.seq)||b.seq<=p.seq)break;for(const k of ['x','z','yaw','pitch'])if(!Number.isFinite(b[k]))fail(400,'Invalid movement.');p.seq=b.seq;p.yaw=((b.yaw%(Math.PI*2))+Math.PI*2)%(Math.PI*2);p.pitch=Math.max(-1.3,Math.min(1.3,b.pitch));p.input={x:Math.max(-1,Math.min(1,b.x)),z:Math.max(-1,Math.min(1,b.z)),sprint:!!b.sprint};p.inputAt=now();break}
case '/api/ready':p.ready=!!b.ready;break;
case '/api/start':if(r.host!==p.id)fail(403,'Only the host can start.');if([...r.players.values()].some(q=>!q.ready))fail(409,'Every resident must be ready.');r.phase='live';system(r,r.map.city?'Makers’ Mile is open. Meet and explore the real city together. Building edits and NPCs are local; this city session is social free roam.':'The district is open. The central ring is protected. PvP is active outside it.');break;
case '/api/shoot':shoot(r,p);break;
case '/api/reload':if(p.hp>0&&!p.reloadUntil&&p.ammo<6)p.reloadUntil=now()+1600;break;
case '/api/chat':rate('chat:'+p.id,5,10000);if(clean(b.text,240))r.chat.push({id:id(),player:p.id,accountId:p.accountId,name:p.name,text:clean(b.text,240),at:now()});r.chat=r.chat.slice(-30);break;
case '/api/emote':if(!['Wave','Peace','Need help','Good game'].includes(b.emote))fail(400,'Unknown emote.');p.emote=b.emote;p.emoteUntil=now()+3500;break;
case '/api/quest':{if(r.phase!=='live'||p.hp<=0)fail(409,'Enter the district first.');const q=C.quests.find(q=>q.id===b.id),progress=r.quests[b.id];if(!q||!progress||progress.done)fail(409,'Contract unavailable.');const s=q.steps[progress.step];if(Math.hypot(p.x-s.at[0],p.z-s.at[1])>4)fail(409,'Move closer to the contract marker.');if(s.choices&&(!Number.isInteger(b.choice)||!s.choices[b.choice]))fail(400,'Choose a response.');if(s.choices)progress.choices.push(b.choice);progress.step++;progress.done=progress.step===q.steps.length;if(progress.done){store.reward(r,q);system(r,q.title+' completed. First-time completions earn '+q.reward+' permanent reputation.')}break}
case '/api/leave':remove(r,p);break;
case '/api/kick':{if(r.host!==p.id)fail(403,'Only the host can remove a player.');const target=r.players.get(b.id);if(target&&target!==p){r.banned.add(target.accountId);remove(r,target)}break}
default:fail(404,'Unknown action.')}
if(!['/api/input','/api/shoot','/api/city-pose'].includes(u.pathname))store.checkpoint(r);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true}));if(r.phase!=='live')publish(r);return;
}
if(!['GET','HEAD'].includes(req.method))fail(405,'Use GET.');
if(u.pathname.startsWith('/media/music/')){const name=u.pathname.slice('/media/music/'.length);if(!/^(?:playlist\.json|\d{2}\.mp3)$/.test(name))fail(404,'Not found.');const file=path.join(__dirname,'public-music',name);if(fs.existsSync(file)){res.setHeader('Content-Type',name.endsWith('.json')?'application/json':'audio/mpeg');res.setHeader('Cache-Control','public, max-age=86400');if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);return}}
if(u.pathname==='/city'){res.writeHead(302,{Location:'/city/'});return res.end()}
if(u.pathname.startsWith('/city/')||u.pathname.startsWith('/shared/')||u.pathname.startsWith('/media/music/')||u.pathname.startsWith('/apps/')){const rel=decodeURIComponent(u.pathname),base=rel.startsWith('/city/')?GAME:ROOT,part=rel.startsWith('/city/')?(rel.slice(6)||'index.html'):rel.slice(1);if(part.split('/').some(s=>s.startsWith('.')||s.startsWith('_'))||/backup/i.test(part)||! /\.(html|js|json|png|jpg|jpeg|webp|svg|mp3|woff2|css)$/.test(part))fail(404,'Not found.');if(rel.startsWith('/apps/')&&!/^apps\/(fracture-city-game|wrong-floor|palm-drive|coherence-game|still-human|still-human-wild|sun-fall|light-bearer|the-visitor|works|character-forge|backroom)\//.test(part))fail(404,'Not found.');const file=path.resolve(base,part);if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())fail(404,'Not found.');const types={html:'text/html; charset=utf-8',js:'text/javascript',json:'application/json',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml',mp3:'audio/mpeg',css:'text/css',woff2:'font/woff2'};res.setHeader('Content-Type',types[file.split('.').pop()]);res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");if(req.method==='HEAD')return res.end();if(file.endsWith('.html')){let html=fs.readFileSync(file,'utf8');const boot='<script>window.FC_FULL_WEB=true;window.FC_WEB_EDITION=true;window.FC_RADIO_URL="/media/music/playlist.json";</script>'+(rel.startsWith('/apps/the-visitor/')?'<script src="web-art.js"></script>':'');return res.end(html.replace('<head>','<head>'+boot))}fs.createReadStream(file).pipe(res);return}
const routes={'/':'multiplayer.html','/multiplayer.js':'multiplayer.js','/accounts.js':'accounts.js','/media-upload.js':'media-upload.js','/social-world.js':'social-world.js','/resident-head.js':'resident-head.js','/dispatch-content.js':'dispatch-content.js','/dispatch-world.js':'dispatch-world.js'};let file;if(u.pathname==='/three.min.js')file=path.join(ROOT,'shared/vendor/three.min.js');else if(routes[u.pathname])file=path.join(GAME,routes[u.pathname]);else fail(404,'Not found.');res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");if(req.method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>{res.statusCode=404;res.end('Not found')}).pipe(res);
}catch(e){if(!res.headersSent)res.writeHead(e.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.status?e.message:'Server error.'}))}});
if(opts.timers!==false)tickTimer=setInterval(tick,50);server.on('close',()=>clearInterval(tickTimer));return{server,rooms,tokens,tick,state,store,close:()=>{clearInterval(tickTimer);for(const r of rooms.values()){store.checkpoint(r);for(const p of r.players.values())p.stream?.end()}server.close(()=>store.close())}};
}
if(require.main===module){const app=createServer();app.server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('Fracture City district server listening on '+(process.env.PORT||8787)));for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{app.close();setTimeout(()=>process.exit(0),1000).unref()})}
module.exports={createServer};
