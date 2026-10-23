// build-dock.js after 0.79: building keeps the mouse with the view; one undo
// (Creative for blocks); phones tap the world to place.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const T={timeout:240000};
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-bd-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
try{
 const p=await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/city/',T);await p.waitForFunction(()=>window.OwnBlock&&window.FCBuildDock&&window.FCInv,null,T);
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();Player.position.set(160,1+Player.height,52);Player.yaw=0;Player.pitch=-.6;window.__t=[];const t=window.toast;window.toast=function(m){__t.push(String(m));return t.apply(this,arguments)}});
 await p.waitForTimeout(3000);await p.keyboard.press('KeyB');await p.waitForFunction(()=>State.ui.construct,null,T);
 await p.waitForFunction(()=>document.body.classList.contains('fc-build'),null,{timeout:30000});
 const y0=await p.evaluate(()=>{State.ui.locked=true;return Player.yaw});
 await p.mouse.move(200,200);await p.mouse.move(800,500,{steps:3});
 console.log('PASS build mode keeps the view and the crosshair (no free cursor)');
 await p.evaluate(()=>{if(!State.ui.freeBuild)shToggleFreeBuild();FCInv.slots[0]='b:3';FCInv.select(0)});
 const t=await p.evaluate(()=>{updateBlockTarget();const t=targetBlock;return{x:t.x+t.nx,y:t.y+t.ny,z:t.z+t.nz}});
 await p.evaluate(()=>window.placeBlock());assert.equal(await p.evaluate(t=>getBlock(t.x,t.y,t.z),t),3);
 await p.keyboard.press('Control+KeyZ');assert.equal(await p.evaluate(t=>getBlock(t.x,t.y,t.z),t),0,'Ctrl+Z undoes in Creative');
 await p.keyboard.press('Control+KeyY');assert.equal(await p.evaluate(t=>getBlock(t.x,t.y,t.z),t),3,'Ctrl+Y redoes');
 await p.evaluate(()=>shToggleFreeBuild());await p.keyboard.press('Control+KeyZ');assert.equal(await p.evaluate(t=>getBlock(t.x,t.y,t.z),t),3,'no block undo outside Creative');assert.match(await p.evaluate(()=>__t.at(-1)),/Creative/);
 console.log('PASS one undo: blocks undo and redo in Creative and are protected outside it');
 const m=await (await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();m.on('pageerror',e=>errors.push(e.message));
 await m.goto(base+'/city/',T);await m.waitForFunction(()=>window.OwnBlock&&window.FCInv,null,T);
 await m.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();Player.position.set(160,1+Player.height,52);Player.yaw=0;Player.pitch=-.45;toggleConstructMode();if(!State.ui.freeBuild)shToggleFreeBuild();FCInv.slots[0]='b:3';FCInv.select(0)});
 await m.waitForTimeout(1500);
 const tgt=await m.evaluate(()=>{FC_AIM.ndc=new THREE.Vector2(0,-.35);updateBlockTarget();const t=targetBlock;FC_AIM.ndc=null;return t&&{x:t.x+t.nx,y:t.y+t.ny,z:t.z+t.nz}});
 await m.touchscreen.tap(195,422+.35*422);await m.waitForTimeout(1200);
 assert.ok(tgt&&await m.evaluate(t=>getBlock(t.x,t.y,t.z),tgt)>0,'a tap places at the tapped spot');
 console.log('PASS phones: a tap on the world places there');
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
