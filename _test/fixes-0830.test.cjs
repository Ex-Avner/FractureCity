// 0.83 fixes from play: protest signs read the right way up, other residents
// face the way they are looking, and PvP hits show on the health bar.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const T={timeout:240000};
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-083-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));return p};
try{
 //  Signs: every protester's placard is upright and faces where they face, marching or standing.
 const s=watch(await (await browser.newContext({viewport:{width:1280,height:720}})).newPage());
 await s.goto(base+'/city/',T);await s.waitForFunction(()=>window.OwnBlock&&window.FCNpcs,null,T);
 const sign=await s.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.ui.paused=false;Player.position.set(176,1+Player.height,56);Player.yaw=0;
  await FCNpcs.spawn({role:'protester',x:170,z:56,story:{...FCNpcBrain.story('protester','p'),sign:'MORE BENCHES'}});
  const out=[];for(let i=0;i<300&&!(out.length>10&&out.some(f=>f.moving));i++){await new Promise(r=>setTimeout(r,150));const e=[...FCNpcs.entries.values()].find(x=>x.sign);if(!e||!e.group.visible)continue;
   const board=e.sign.children.find(c=>c.geometry?.type==='PlaneGeometry');board.updateWorldMatrix(true,false);const up=new THREE.Vector3(0,1,0).applyQuaternion(board.getWorldQuaternion(new THREE.Quaternion())),fwd=new THREE.Vector3(0,0,1).applyQuaternion(board.getWorldQuaternion(new THREE.Quaternion())),face=new THREE.Vector3(0,0,1).applyQuaternion(e.char.group.getWorldQuaternion(new THREE.Quaternion()));
   out.push({up:up.y,align:fwd.dot(face),moving:!!e.moving})}
  return out});
 assert.ok(sign.length>10);for(const f of sign){assert.ok(f.up>.95,'upright '+JSON.stringify(f));assert.ok(f.align>.95,'faces forward '+JSON.stringify(f))}
 assert.ok(sign.some(f=>f.moving),'checked while marching');
 await s.evaluate(()=>{const e=[...FCNpcs.entries.values()].find(x=>x.sign);Player.position.set(e.group.position.x,e.group.position.y+Player.height,e.group.position.z+4);Player.yaw=0;Player.pitch=.12});await s.waitForTimeout(800);
 await s.screenshot({path:root+'/_test/out/fix083-sign.png',...T});
 console.log('PASS protest signs are upright and face forward, standing and marching');
 await s.context().close();
 //  Online: a rival looking at you faces you; your hits on the server show on your health bar.
 const ctx=await browser.newContext({viewport:{width:1280,height:720}});
 await ctx.request.post(base+'/api/account/register',{data:{username:'fix_ash',password:'fix test password 123',displayName:'Ash'}});
 const code=(await (await ctx.request.post(base+'/api/join',{data:{public:true}})).json()).code;
 const o=watch(await ctx.newPage());
 for(let i=0;;i++){await o.goto(base+'/city/?online='+code,T);if(await o.waitForFunction(()=>window.FCCityOnline?.ready&&FCCityOnline.connected,null,{timeout:240000}).then(()=>true,()=>false))break;if(i===2)throw Error('could not join');console.log('retrying the join')}
 const reg=await fetch(base+'/api/account/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:'fix_bo',password:'fix test password 123'})}),cookie=reg.headers.get('set-cookie').split(';')[0];
 const jb=await (await fetch(base+'/api/join',{method:'POST',headers:{'Content-Type':'application/json',cookie,Origin:base},body:JSON.stringify({public:true})})).json();
 const stream=await fetch(base+'/api/events',{headers:{Authorization:'Bearer '+jb.token,cookie}});const reader=stream.body.getReader();(async()=>{try{while(!(await reader.read()).done);}catch(e){}})();
 const room=app.rooms.get(code),me=[...room.players.values()].find(q=>q.name==='Ash'),rival=room.players.get(jb.id);
 await o.evaluate(()=>{HD.locked=true;HD.setTier('perf',true)});
 //  Bo stands 4 m north of Ash looking south (yaw π: the camera looks along +z), so Bo faces Ash.
 Object.assign(rival,{x:me.x,z:me.z-4,y:me.y||1,yaw:Math.PI});
 await o.waitForFunction(id=>!!FCCityOnline.peers.get(id),jb.id,T);await o.waitForTimeout(1500);
 const facing=await o.evaluate(id=>{const f=FCCityOnline.peers.get(id),q=f.char.group.getWorldQuaternion(new THREE.Quaternion()),fwd=new THREE.Vector3(0,0,1).applyQuaternion(q),to=new THREE.Vector3().subVectors(Player.position,f.group.position).setY(0).normalize();return fwd.dot(to)},jb.id);
 assert.ok(facing>.95,'the rival faces you: '+facing);
 await o.evaluate(id=>{const f=FCCityOnline.peers.get(id);Player.yaw=Math.atan2(-(f.group.position.x-Player.position.x),-(f.group.position.z-Player.position.z));Player.pitch=-.05},jb.id);await o.waitForTimeout(1200);
 await o.screenshot({path:root+'/_test/out/fix083-facing.png',...T});
 console.log('PASS other residents face the way they are looking');
 //  PvP: the server takes 30 off Ash; the HUD bar follows, without killing locally.
 const before=await o.evaluate(()=>Player.hp);
 me.hp=70;await new Promise(r=>setTimeout(r,3000));await o.waitForFunction(()=>FCCityOnline.self?.hp===70,null,T);await o.waitForTimeout(300);
 const after=await o.evaluate(()=>({hp:Player.hp,max:Player.hpMax,bar:document.getElementById('hp-text')?.textContent||document.querySelector('[id*=hp]')?.textContent}));
 assert.equal(Math.round(after.hp),Math.round(before-30*after.max/100),JSON.stringify(after));
 me.hp=1;await o.waitForFunction(()=>FCCityOnline.self?.hp===1,null,T);await o.waitForTimeout(300);assert.ok(await o.evaluate(()=>Player.hp>=1),'never dies locally from PvP');
 me.hp=0;me.respawnAt=Date.now()+8000;await o.waitForFunction(()=>FCCityOnline.self?.hp===0,null,T);me.hp=100;await o.waitForFunction(()=>FCCityOnline.self?.hp===100,null,T);await o.waitForTimeout(500);
 assert.equal(await o.evaluate(()=>Player.hp===Player.hpMax),true,'full again after the down');
 console.log('PASS PvP hits show on the health bar and a respawn refills it');
 reader.cancel().catch(()=>{});await ctx.close();
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
