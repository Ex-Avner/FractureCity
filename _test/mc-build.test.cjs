// 0.79: Minecraft-style building (hotbar, inventory, shop, Creative in solo),
// the server wallet online, and PvP in the online city.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const T={timeout:240000};
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-mc-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
const watch=page=>{page.on('pageerror',e=>errors.push(e.message));return page};
const toasts=page=>page.evaluate(()=>{window.__t=[];const t=window.toast;window.toast=function(m){__t.push(String(m));return t.apply(this,arguments)}});
try{
 // ── Solo ──
 const p=watch(await (await browser.newContext({viewport:{width:1280,height:720}})).newPage());
 await p.goto(base+'/city/',T);await p.waitForFunction(()=>window.OwnBlock&&window.FCInv&&FCInv.catalog,null,T);
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.dayTime=13*60;Player.position.set(160,1+Player.height,52);Player.yaw=0;Player.pitch=-.6});await toasts(p);await p.waitForTimeout(3000);
 await p.keyboard.press('KeyB');await p.waitForFunction(()=>State.ui.construct&&!document.getElementById('fc-hotbar').hidden,null,T);
 await p.evaluate(()=>{State.ui.locked=true;if(State.ui.freeBuild)shToggleFreeBuild()});
 assert.equal(await p.evaluate(()=>document.querySelectorAll('#fc-hotbar .hb-slots button').length),8);
 assert.equal(await p.evaluate(()=>!!document.getElementById('build-dock')),false,'the dock is gone');
 await p.keyboard.press('Digit3');assert.equal(await p.evaluate(()=>FCInv.sel),2);
 await p.mouse.move(640,360);await p.evaluate(()=>{const e=new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true});State.renderer.domElement.dispatchEvent(e)});assert.equal(await p.evaluate(()=>FCInv.sel),3,'the wheel picks the next slot');
 console.log('PASS B shows an 8-slot hotbar; 1–8 and the wheel pick slots; no dock, the mouse stays with the view');
 // Furniture: a new solo city starts with one sofa.
 await p.keyboard.press('Digit7');assert.equal(await p.evaluate(()=>CityArt.stamp?.sku),'f:0');
 const o0=await p.evaluate(()=>CityArt.objects.length);
 await p.evaluate(()=>{updateBlockTarget();window.placeBlock()});
 assert.ok(await p.evaluate(()=>CityArt.objects.length)>o0,'sofa placed');assert.match(await p.evaluate(()=>CityArt.objects.at(-1).group),/^f0-/);assert.equal(await p.evaluate(()=>FCInv.count('f:0')),0);
 await p.evaluate(()=>{updateBlockTarget();window.placeBlock()});assert.match(await p.evaluate(()=>__t.at(-1)),/hold 0/,'none left says so');
 await p.waitForFunction(()=>{const c=CityArt.objects.at(-1).p,dx=c[0]-Player.position.x,dy=c[1]-Player.position.y,dz=c[2]-Player.position.z;Player.yaw=Math.atan2(-dx,-dz);Player.pitch=Math.atan2(dy,Math.hypot(dx,dz));return !!CityArt.pick()},null,{timeout:90000});
 const up=await p.evaluate(()=>{window.shBeginMine();shStopMine();return{n:CityArt.objects.length,count:FCInv.count('f:0')}});
 assert.equal(up.n,o0);assert.equal(up.count,1);
 console.log('PASS furniture from the hotbar places, is used up, and left-click picks it back up');
 // Shop and room kit.
 await p.evaluate(()=>{State.hud.credits=500;Player.yaw=0;Player.pitch=-.6});
 await p.keyboard.press('KeyI');await p.waitForSelector('#fc-inv:not([hidden])',T);
 await p.locator('#fc-inv [data-tab=shop]').click(T);await p.locator('#fc-inv [data-buy="b:120"][data-q="16"]').click(T);
 assert.equal(await p.evaluate(()=>FCInv.count('b:120')),16);assert.equal(await p.evaluate(()=>State.hud.credits),484);
 await p.locator('#fc-inv [data-tab=kit]').click(T);await p.locator('#fc-inv [data-item="k:wall:120"]').click(T);await p.locator('#fc-inv [data-hslot="3"]').click(T);
 assert.equal(await p.evaluate(()=>FCInv.slots[3]),'k:wall:120');
 await p.locator('#fc-inv [data-tab=bag]').click(T);await p.locator('#fc-inv [data-item="b:120"]').hover();await p.keyboard.press('Digit6');
 assert.equal(await p.evaluate(()=>FCInv.slots[5]),'b:120','hover and press a number to put it in that slot');
 await p.screenshot({path:root+'/_test/out/mc-inventory.png',...T});
 await p.keyboard.press('KeyI');await p.waitForFunction(()=>!FCInv.open,null,T);
 await p.evaluate(()=>{State.ui.locked=true});await p.keyboard.press('Digit4');
 await p.evaluate(()=>{updateBlockTarget();window.placeBlock()});assert.equal(await p.evaluate(()=>FCInv.count('b:120')),7,'a 3 × 3 wall uses nine finish blocks');
 await p.keyboard.press('Control+KeyZ');assert.equal(await p.evaluate(()=>FCInv.count('b:120')),16,'undo gives them back');
 await p.screenshot({path:root+'/_test/out/mc-hotbar.png',...T});
 console.log('PASS the shop sells finishes; room-kit pieces go in the hotbar, use finish blocks, and undo returns them');
 await p.evaluate(()=>shToggleFreeBuild());assert.equal(await p.evaluate(()=>State.ui.freeBuild),true);
 await p.keyboard.press('Digit7');const c0=await p.evaluate(()=>FCInv.count('f:0'));await p.evaluate(()=>{updateBlockTarget();window.placeBlock()});assert.equal(await p.evaluate(()=>FCInv.count('f:0')),c0,'Creative places without using items');
 console.log('PASS Creative in a solo city places for free');
 await p.context().close();
 // ── Online: the server wallet ──
 const ctx=await browser.newContext({viewport:{width:1280,height:720}});
 const post=async(c,a,d)=>{const r=await c.request.post(base+'/api/'+a,{data:d});const j=await r.json();if(r.status()!==200)throw Error(a+' '+r.status()+' '+JSON.stringify(j));return j};
 await post(ctx,'account/register',{username:'mc_online',password:'test city password 1234',displayName:'Builder'});const code=(await post(ctx,'join',{public:true})).code;
 const o=watch(await ctx.newPage());await o.goto(base+'/city/?online='+code,T);
 await o.waitForFunction(()=>window.FCCityOnline?.ready&&FCCityOnline.connected&&window.FCCityBuild?.ready&&FCInv.server,null,{timeout:400000}).catch(async e=>{console.log('online state',JSON.stringify(await o.evaluate(()=>({status:document.getElementById('city-online-status')?.textContent,note:document.getElementById('city-online-note')?.textContent,ready:window.FCCityOnline?.ready,conn:window.FCCityOnline?.connected,build:window.FCCityBuild?.ready,server:!!FCInv.server})).catch(x=>String(x))));throw e});
 await o.evaluate(()=>{HD.locked=true;HD.setTier('perf',true)});await toasts(o);
 assert.equal(await o.evaluate(()=>FCInv.server.balance),300);
 await o.evaluate(()=>shToggleFreeBuild());assert.equal(await o.evaluate(()=>State.ui.freeBuild),false,'no Creative online');
 await o.evaluate(()=>{toggleConstructMode();State.ui.locked=true;Player.pitch=-.6});await o.keyboard.press('KeyI');await o.waitForSelector('#fc-inv:not([hidden])',T);
 await o.locator('#fc-inv [data-tab=shop]').click(T);await o.locator('#fc-inv [data-buy="f:0"]').first().click(T);
 await o.waitForFunction(()=>FCInv.server.items['f:0']===1,null,T);assert.equal(await o.evaluate(()=>FCInv.server.balance),240);
 await o.keyboard.press('KeyI');await o.waitForFunction(()=>!FCInv.open,null,T);
 await o.evaluate(()=>{State.ui.locked=true;const k=FCInv.slots.indexOf('f:0');FCInv.select(k<0?0:k);if(k<0){FCInv.slots[0]='f:0';FCInv.select(0)}updateBlockTarget();window.placeBlock()});
 await o.waitForFunction(async()=>!FCCityBuild.dirty&&(await (await fetch('/api/wallet')).json()).items['f:0']===undefined,null,{timeout:120000,polling:1000});
 console.log('PASS online: the server wallet starts at 300, sells a sofa, and charges it when placed; Creative is refused');
 // ── PvP: a second resident joins through the API and keeps a live stream ──
 const reg=await fetch(base+'/api/account/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:'mc_rival',password:'test city password 1234'})}),cookie=reg.headers.get('set-cookie').split(';')[0];
 const jb=await (await fetch(base+'/api/join',{method:'POST',headers:{'Content-Type':'application/json',cookie,Origin:base},body:JSON.stringify({public:true})})).json();
 const stream=await fetch(base+'/api/events',{headers:{Authorization:'Bearer '+jb.token,cookie}});assert.equal(stream.status,200,'rival stream open');const reader=stream.body.getReader();(async()=>{try{while(!(await reader.read()).done);}catch(e){}})();
 const room=app.rooms.get(code),me=[...room.players.values()].find(q=>q.name==='Builder'),rival=room.players.get(jb.id);
 const spot=await o.evaluate(()=>{for(const [x,z] of [[120,30],[100,100],[60,20],[130,60],[20,120],[96,12]]){const y=shSurfaceY(x+.5,z+.5,40),y2=shSurfaceY(x+4.5,z+.5,40);if(y!==y2)continue;const a=new THREE.Vector3(x+.5,y+1.6,z+.5),d=new THREE.Vector3(1,0,0);const v=raycastVoxel(a,d,5);if(!v)return{x:x+.5,y,z:z+.5}}return null});
 assert.ok(spot,'found an open street outside Common Ground');
 Object.assign(rival,{x:spot.x+4,y:spot.y,z:spot.z,protectUntil:0,hp:100});Object.assign(me,{x:spot.x,y:spot.y,z:spot.z,poseAt:Date.now(),protectUntil:0});
 await o.evaluate(s=>{if(State.ui.construct)toggleConstructMode();Player.position.set(s.x,s.y+Player.height,s.z);Player.yaw=-Math.PI/2;Player.pitch=0;Player.velocity.set(0,0,0);switchWeapon('pistol');Player.ammo.pistol=10},spot);
 await o.waitForFunction(id=>FCCityOnline.room.players.some(p=>p.id===id&&p.connected),jb.id,T);await o.waitForTimeout(1500);
 await o.evaluate(()=>{Player.attackCooldown=0;Player.hp=Math.max(Player.hp,50);tryAttack()});
 for(let i=0;i<40&&rival.hp===100;i++)await new Promise(r=>setTimeout(r,250));
 assert.ok(rival.hp<100,'a shot outside Common Ground hits the other resident on the server ('+rival.hp+')');
 // The rival shoots back.
 const shot=await (await fetch(base+'/api/city-shoot',{method:'POST',headers:{'Content-Type':'application/json',cookie,Origin:base,Authorization:'Bearer '+jb.token},body:JSON.stringify({target:me.id,weapon:'pistol',ox:rival.x,oy:rival.y+1.6,oz:rival.z,dx:-1,dy:0,dz:0,pellets:1})})).json();
 assert.equal(shot.hit,true,'the rival hits back');
 await o.waitForFunction(()=>!document.querySelector('#city-pvp .pv-hp').hidden,null,T);
 await o.screenshot({path:root+'/_test/out/mc-pvp.png',...T});
 console.log('PASS city PvP: your shot hits the other resident on the server, theirs shows your PvP health');
 reader.cancel().catch(()=>{});await ctx.close();
 // ── Phone: the hotbar sits at the top and taps pick a slot ──
 const m=watch(await (await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage());
 await m.goto(base+'/city/',T);await m.waitForFunction(()=>window.OwnBlock&&window.FCInv,null,T);
 await m.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();toggleConstructMode()});await m.waitForSelector('#fc-hotbar:not([hidden])',T);
 const r=await m.evaluate(()=>{const b=document.getElementById('fc-hotbar').getBoundingClientRect();return{top:b.top,right:b.right,w:innerWidth}});assert.ok(r.top<30&&r.right<=r.w,'hotbar at the top, on screen');
 await m.locator('#fc-hotbar [data-slot="4"]').tap(T);assert.equal(await m.evaluate(()=>FCInv.sel),4);
 await m.locator('#fc-hotbar [data-inv]').tap(T);await m.waitForSelector('#fc-inv:not([hidden])',T);
 await m.screenshot({path:root+'/_test/out/mc-phone-inventory.png',...T});
 console.log('PASS phones: the hotbar is at the top, taps pick slots and open the inventory');
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
