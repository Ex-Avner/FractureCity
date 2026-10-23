// Wallet, shop, hotbar, earning caps, build charges and city PvP.
const {createServer}=require('./server.cjs'),{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
async function boot(){const clock={t:1_800_000_000_000},dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-eco-')),app=createServer({dbPath:path.join(dir,'t.sqlite'),timers:false,now:()=>clock.t});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return{app,clock,base:'http://127.0.0.1:'+app.server.address().port,stop:()=>new Promise(r=>{app.server.once('close',r);app.close()})}}
function client(srv){let cookie,token,id;const call=async(route,data,method)=>{const res=await fetch(srv.base+'/api/'+route,{method:method||(data?'POST':'GET'),headers:{'Content-Type':'application/json',...(cookie?{cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});const c=res.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return{status:res.status,data:await res.json()}};
 return{call,async register(u){return call('account/register',{username:u,password:'economy test password 123'})},async join(d){const j=await call('join',d);token=j.data.token;id=j.data.id;return j},get id(){return id}}}

test('wallet: starting balance, shop, hotbar and earning limits',async()=>{const srv=await boot();try{
 const a=client(srv);await a.register('eco_a');
 let w=(await a.call('wallet')).data;assert.equal(w.balance,300);assert.deepEqual(w.items,{});
 w=(await a.call('wallet/buy',{sku:'b:120',qty:16})).data;assert.equal(w.balance,284);assert.equal(w.items['b:120'],16);
 assert.equal((await a.call('wallet/buy',{sku:'f:0',qty:5})).status,402,'cannot overspend');
 assert.equal((await a.call('wallet/buy',{sku:'f:999',qty:1})).status,400,'unknown item');
 assert.equal((await a.call('wallet/buy',{sku:'b:120',qty:0})).status,400);
 w=(await a.call('wallet/hotbar',{slots:['b:120','f:0','k:wall:121',null,null,null,null,null]})).data;assert.equal(w.hotbar[2],'k:wall:121');
 assert.equal((await a.call('wallet/hotbar',{slots:['x']})).status,400);
 let e=(await a.call('wallet/earn',{amount:40,reason:'job'})).data;assert.equal(e.granted,40);
 e=(await a.call('wallet/earn',{amount:40,reason:'job'})).data;assert.equal(e.granted,0,'claims too close together pay nothing');
 assert.equal((await a.call('wallet/earn',{amount:5000,reason:'job'})).status,400,'one claim is capped');
 for(let i=0;i<20;i++){srv.clock.t+=3000;await a.call('wallet/earn',{amount:250,reason:'job'})}
 w=(await a.call('wallet')).data;assert.equal(w.balance,284+3000,'daily claim limit');
 srv.clock.t+=86400000;e=(await a.call('wallet/earn',{amount:10,reason:'zombie'})).data;assert.equal(e.granted,10,'a new day resets the limit');
 console.log('PASS wallet');
}finally{await srv.stop()}});

test('building online spends and refunds items',async()=>{const srv=await boot();try{
 const a=client(srv);await a.register('eco_builder');const j=await a.join({map:'city'});srv.app.rooms.get(j.data.code).phase='live';
 const art=(await a.call('city-art')).data,sofa=g=>[{id:'p1'+g,kind:'box',p:[150,1.2,30],s:[1,1,1],r:[0,0,0],color:'#888888',finish:'matte',group:'f0-'+g},{id:'p2'+g,kind:'box',p:[151,1.2,30],s:[1,1,1],r:[0,0,0],color:'#888888',finish:'matte',group:'f0-'+g}];
 let r=await a.call('city-art',{revision:art.ownRevision,objects:sofa('aa')});assert.equal(r.status,402,'no sofa held');
 await a.call('wallet/buy',{sku:'f:0',qty:2});
 r=await a.call('city-art',{revision:art.ownRevision,objects:sofa('aa')});assert.equal(r.status,200);assert.equal(r.data.wallet.items['f:0'],1,'placing uses one sofa');
 r=await a.call('city-art',{revision:1,objects:[...sofa('aa'),{id:'free',kind:'sphere',p:[152,1.2,30],s:[.3,.3,.3],r:[0,0,0],color:'#aa0000',finish:'gloss'}]});assert.equal(r.data.wallet.items['f:0'],1,'Atelier shapes cost nothing');
 r=await a.call('city-art',{revision:2,objects:[]});assert.equal(r.data.wallet.items['f:0'],2,'picking it up returns it');
 const s=(await a.call('city-structures')).data,mine=s.owners.find(o=>o.author===s.viewer),{x,z}=mine.plot,cells=[0,1,2].map(i=>({x:x+i,y:1,z,id:121}));
 r=await a.call('city-structures',{revision:mine.revision,cells,doors:[]});assert.equal(r.status,402,'no blocks held');
 await a.call('wallet/buy',{sku:'b:121',qty:3});
 r=await a.call('city-structures',{revision:mine.revision,cells,doors:[]});assert.equal(r.status,200);assert.equal(r.data.wallet.items['b:121']||0,0);
 r=await a.call('city-structures',{revision:mine.revision+1,cells:cells.slice(0,1),doors:[]});assert.equal(r.data.wallet.items['b:121'],2,'removed blocks come back');
 console.log('PASS building spends and refunds');
}finally{await srv.stop()}});

test('city PvP: hits outside safe zones, downs, pays and respawns',async()=>{const srv=await boot();try{
 const a=client(srv),b=client(srv);await a.register('pvp_a');await b.register('pvp_b');const ja=await a.join({map:'city'});await b.join({code:ja.data.code});
 const room=srv.app.rooms.get(ja.data.code);room.phase='live';const pa=room.players.get(a.id),pb=room.players.get(b.id);
 const place=(p,x,z)=>Object.assign(p,{x,z,y:1,protectUntil:0});
 const shot=(from,to,extra={})=>({target:to.id,weapon:'pistol',ox:from.x,oy:2.6,oz:from.z,dx:to.x-from.x,dy:0,dz:to.z-from.z,...extra});
 const norm=s=>{const l=Math.hypot(s.dx,s.dy,s.dz);return{...s,dx:s.dx/l,dy:s.dy/l,dz:s.dz/l}};
 place(pa,100,100);place(pb,110,100);
 let r=(await a.call('city-shoot',norm(shot(pa,pb)))).data;assert.equal(r.hit,true);assert.equal(pb.hp,80);
 r=(await a.call('city-shoot',norm(shot(pa,pb)))).data;assert.equal(r.hit,false,'weapon cooldown');assert.equal(r.reason,'cooldown');
 srv.clock.t+=400;r=(await a.call('city-shoot',norm({...shot(pa,pb),dz:5}))).data;assert.equal(r.hit,false,'a ray that misses the body');
 srv.clock.t+=400;place(pb,170,30);r=(await a.call('city-shoot',norm(shot(pa,pb)))).data;assert.equal(r.reason,'target-safe','Common Ground is safe');
 place(pb,110,100);srv.clock.t+=400;r=(await a.call('city-shoot',norm({...shot(pa,pb),ox:60}))).data;assert.equal(r.reason,'origin','shots must start near the shooter');
 srv.clock.t+=400;r=(await a.call('city-shoot',norm(shot(pa,pb,{weapon:'pistol'})))).data;assert.equal(r.hit,true);
 for(let i=0;i<3;i++){srv.clock.t+=400;r=(await a.call('city-shoot',norm(shot(pa,pb)))).data}
 assert.equal(pb.hp,0);assert.equal(r.down,true);assert.equal(pa.kills,1);
 assert.equal((await a.call('wallet')).data.balance,325,'a PvP down pays 25');
 const seq=pb.seq;srv.clock.t+=4100;srv.app.tick();assert.equal(pb.hp,100);assert.ok(pb.seq>seq,'respawn moves the client');assert.ok(pb.x>=144&&pb.x<=216,'back in Common Ground');
 place(pa,170,30);srv.clock.t+=400;place(pb,110,100);r=(await a.call('city-shoot',norm(shot(pa,pb)))).data;assert.equal(r.reason,'safe','no shooting from the safe zone');
 console.log('PASS city PvP');
}finally{await srv.stop()}});
