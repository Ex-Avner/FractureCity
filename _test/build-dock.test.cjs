// Cursor build mode and the build dock: the cursor is free while building, every
// tool aims where the mouse points, the dock is clickable, one undo per tool,
// Esc steps back, and phones tap to place.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const SPOT=[160,52];
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-bd-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
const T={timeout:240000};
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:720}}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/city/',{timeout:180000});await p.waitForFunction(()=>window.OwnBlock&&window.FCBuildDock,null,{timeout:120000});
 await p.evaluate(async([x,z])=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.dayTime=13*60;Player.position.set(x,1+Player.height,z);Player.yaw=0;Player.pitch=-.35},SPOT);
 await p.waitForTimeout(5000);
 await p.keyboard.press('KeyB');await p.waitForFunction(()=>FCBuildDock.cursor&&!document.getElementById('build-dock').hidden,null,{timeout:30000});
 const enter=await p.evaluate(()=>({locked:State.ui.locked,pointer:!!document.pointerLockElement,overlay:document.getElementById('lock-instruction').classList.contains('show'),cross:getComputedStyle(document.getElementById('crosshair')).display,cls:document.body.classList.contains('fc-build-cursor')}));
 assert.deepEqual(enter,{locked:true,pointer:false,overlay:false,cross:'none',cls:true});
 console.log('PASS B enters build with a free cursor, no lock overlay, no crosshair, and the dock up');
 // Looking: a plain move leaves the view alone; a right-drag turns it.
 const y0=await p.evaluate(()=>Player.yaw);await p.mouse.move(300,300);await p.mouse.move(900,500,{steps:4});await p.waitForTimeout(300);
 assert.equal(await p.evaluate(()=>Player.yaw),y0,'moving the cursor does not turn the view');
 await p.mouse.move(640,360);await p.mouse.down({button:'right'});await p.mouse.move(560,360,{steps:5});await p.mouse.up({button:'right'});await p.waitForTimeout(300);
 const y1=await p.evaluate(()=>Player.yaw);assert.ok(y1-y0>.15,'right-drag turns the view');
 await p.evaluate(y=>{Player.yaw=y},y0);
 console.log('PASS the cursor moves freely; right-drag looks around');
 // Blocks: the dock is clickable and right-click places where the mouse points.
 await p.locator('#build-dock [data-mode=blocks]').click(T);await p.locator('#build-dock [data-slot="1"]').click(T);
 await p.evaluate(()=>{if(!State.ui.freeBuild)shToggleFreeBuild()});
 const at=async(x,y)=>{await p.mouse.move(x,y);await p.waitForFunction(([x,y])=>FC_AIM.ndc&&Math.abs(FC_AIM.ndc.x-(x/innerWidth*2-1))<.01&&Math.abs(FC_AIM.ndc.y-(1-y/innerHeight*2))<.01,[x,y],{timeout:60000});return p.evaluate(()=>{updateBlockTarget();return targetBlock&&{x:targetBlock.x+targetBlock.nx,y:targetBlock.y+targetBlock.ny,z:targetBlock.z+targetBlock.nz}})};
 const a=await at(420,540),b=await at(860,540);assert.ok(a&&b);assert.notDeepEqual(a,b,'the target follows the mouse');
 await p.mouse.click(420,540,{button:'right'});await p.waitForTimeout(700);
 const held=await p.evaluate(()=>HOTBAR[heldSlot]);assert.equal(held,await p.evaluate(()=>HOTBAR[1]));
 assert.equal(await p.evaluate(t=>getBlock(t.x,t.y,t.z),a),held,'placed the chosen block under the cursor');
 assert.equal(await p.evaluate(t=>getBlock(t.x,t.y,t.z),b),0,'nothing placed elsewhere');
 await p.keyboard.press('Control+KeyZ');await p.waitForTimeout(400);assert.equal(await p.evaluate(t=>getBlock(t.x,t.y,t.z),a),0,'Ctrl+Z undoes the block');
 await p.keyboard.press('Control+KeyY');await p.waitForTimeout(400);assert.equal(await p.evaluate(t=>getBlock(t.x,t.y,t.z),a),held,'Ctrl+Y redoes it');
 await p.locator('#build-dock [data-t=undo]').click(T);await p.waitForTimeout(300);assert.equal(await p.evaluate(t=>getBlock(t.x,t.y,t.z),a),0,'the dock Undo works too');
 await p.locator('#build-dock [data-t=supplies]').click(T);assert.equal(await p.evaluate(()=>State.ui.freeBuild),false);
 await p.locator('#build-dock [data-t=redo]').click(T);await p.waitForTimeout(300);assert.equal(await p.evaluate(t=>getBlock(t.x,t.y,t.z),a),0,'no block undo with inventory supplies');
 await p.locator('#build-dock [data-t=supplies]').click(T);
 console.log('PASS Blocks: slots click, right-click places under the cursor, Ctrl+Z / Ctrl+Y and the dock undo; inventory supplies cannot be minted');
 // Room kit.
 await p.locator('#build-dock [data-mode=kit]').click(T);const piece0=await p.evaluate(()=>CityBuild.describe().piece);
 await p.locator('#build-dock [data-k=piece-next]').click(T);assert.notEqual(await p.evaluate(()=>CityBuild.describe().piece),piece0);
 await p.locator('#build-dock [data-k=piece-prev]').click(T);assert.equal(await p.evaluate(()=>CityBuild.describe().piece),piece0);
 const h0=await p.evaluate(()=>CityBuild.history.length);await p.mouse.move(640,560);await p.waitForTimeout(900);await p.mouse.click(640,560,{button:'right'});await p.waitForTimeout(900);
 assert.equal(await p.evaluate(()=>CityBuild.history.length),h0+1,'room piece placed under the cursor');
 await p.keyboard.press('Control+KeyZ');await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>CityBuild.history.length),h0,'Ctrl+Z undoes the room piece');
 console.log('PASS Room kit: pieces step from the dock, right-click places, Ctrl+Z undoes');
 // Furniture.
 await p.locator('#build-dock [data-mode=art]').click(T);await p.waitForSelector('#furniture-menu',T);
 await p.locator('#furniture-menu [data-item]').first().click(T);await p.waitForFunction(()=>!!CityArt.stamp&&!document.getElementById('build-dock').hidden,null,T);
 const o0=await p.evaluate(()=>CityArt.objects.length);await p.mouse.move(640,520);await p.waitForTimeout(900);await p.mouse.click(640,520,{button:'right'});await p.waitForTimeout(900);
 assert.ok(await p.evaluate(()=>CityArt.objects.length)>o0,'furniture placed under the cursor');
 await p.screenshot({path:root+'/_test/out/build-dock-furniture.png',...T});
 await p.keyboard.press('Escape');await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>!!CityArt.stamp),false,'Esc stops placing');assert.equal(await p.evaluate(()=>State.ui.construct),true,'and stays in build');
 await p.locator('#build-dock [data-t=undo]').click(T);await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>CityArt.objects.length),o0,'dock Undo removes the furniture');
 console.log('PASS Furniture: catalogue from the dock, right-click places, Esc stops placing, Undo removes it');
 // Atelier: grouped toolbar, and closing returns to the dock.
 await p.locator('#build-dock [data-mode=atelier]').click(T);await p.waitForFunction(()=>CityArt.panelOpen,null,T);
 assert.equal(await p.locator('#city-art-menu nav.art-groups > div').count(),4,'Atelier tools in four labelled groups');
 await p.waitForFunction(()=>document.getElementById('build-dock').hidden,null,{timeout:10000});
 await p.screenshot({path:root+'/_test/out/build-dock-atelier.png',...T});
 await p.locator('#city-art-menu [data-action=close]').click(T);await p.waitForFunction(()=>!CityArt.panelOpen&&!document.getElementById('build-dock').hidden,null,T);
 console.log('PASS Atelier opens with grouped tools; closing it returns to the dock');
 await p.locator('#build-dock [data-mode=blocks]').click(T);await p.waitForTimeout(400);
 await p.screenshot({path:root+'/_test/out/build-dock-blocks.png',...T});
 await p.mouse.move(640,400);await p.keyboard.press('Escape');await p.waitForFunction(()=>!State.ui.construct,null,{timeout:30000});
 assert.deepEqual(await p.evaluate(()=>({cursor:FCBuildDock.cursor,cls:document.body.classList.contains('fc-build-cursor'),dock:document.getElementById('build-dock').hidden,aim:FC_AIM.ndc})),{cursor:false,cls:false,dock:true,aim:null});
 console.log('PASS Esc leaves build mode and hands the mouse back to the view');
 await ctx.close();
 // Phone: the dock sits at the top and a tap on the world places.
 const m=await (await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();m.on('pageerror',e=>errors.push(e.message));
 await m.goto(base+'/city/',{timeout:180000});await m.waitForFunction(()=>window.OwnBlock&&window.FCBuildDock,null,{timeout:120000});
 await m.evaluate(async([x,z])=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.dayTime=13*60;Player.position.set(x,1+Player.height,z);Player.yaw=0;Player.pitch=-.45;toggleConstructMode()},SPOT);
 await m.waitForSelector('#build-dock:not([hidden])',T);await m.locator('#build-dock [data-mode=blocks]').tap(T);
 await m.evaluate(()=>{if(!State.ui.freeBuild)shToggleFreeBuild()});await m.waitForTimeout(1200);
 const box=await m.evaluate(()=>{const r=document.getElementById('build-dock').getBoundingClientRect();return{top:r.top,bottom:r.bottom,right:r.right,w:innerWidth}});assert.ok(box.top<20&&box.right<=box.w,'dock at the top, inside the screen');
 const tgt=await m.evaluate(()=>{FC_AIM.ndc=new THREE.Vector2(0,-.35);updateBlockTarget();const t=targetBlock;FC_AIM.ndc=null;return t&&{x:t.x+t.nx,y:t.y+t.ny,z:t.z+t.nz}});
 await m.touchscreen.tap(195,422+.35*422);await m.waitForTimeout(1200);
 assert.ok(tgt&&await m.evaluate(t=>getBlock(t.x,t.y,t.z),tgt)>0,'a tap places at the tapped spot');
 await m.screenshot({path:root+'/_test/out/build-dock-phone.png',...T});
 console.log('PASS phones: dock at the top, a tap on the world places a block there');
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
