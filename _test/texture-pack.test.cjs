// The HD texture pack: loads into one texture array, reaches the voxel shader and
// Makers' Mile's dressed meshes, switches from the Display panel, stays off on Performance.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-tex-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
try{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'apps/fracture-city-game/textures/manifest.json'),'utf8'));
 assert.ok(manifest.layers.length>=16);for(const res of ['1k','2k'])for(let i=0;i<manifest.layers.length;i++)assert.ok(fs.existsSync(path.join(root,'apps/fracture-city-game/textures',res,String(i).padStart(2,'0')+'.jpg')),res+' layer '+i);
 console.log('PASS manifest lists '+manifest.layers.length+' CC0 layers, each present at 1K and 2K');
 const p=await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/\[texture-pack\]|WebGLProgram|Shader Error/i.test(m.text()))errors.push(m.text().slice(0,300))});
 await p.goto(base+'/city/');await p.waitForFunction(()=>window.OwnBlock&&window.FCTexturePack,null,{timeout:120000});
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('high',true);await OwnBlock.start();State.dayTime=13*60;Player.position.set(108,2+Player.height,66)});
 await p.waitForFunction(()=>FCTexturePack.state.mode==='1k'||FCTexturePack.state.error,null,{timeout:180000,polling:500});
 const s=await p.evaluate(()=>FCTexturePack.state);assert.equal(s.error,'');assert.equal(s.mode,'1k');assert.equal(s.size,1024);assert.equal(s.on,1);
 console.log('PASS desktop starts on the 1K pack, all layers in one texture array');
 await p.waitForTimeout(4000);
 const shaders=await p.evaluate(()=>{const gl=State.renderer.getContext(),src=m=>{const pr=State.renderer.properties.get(m).currentProgram;return pr?gl.getShaderSource(gl.getAttachedShaders(pr.program)[1]):''};let dressed=null;State.scene.traverse(o=>{if(!dressed&&o.material?.__texPack&&o.material!==M.voxOpaque&&State.renderer.properties.get(o.material).currentProgram)dressed=o.material});return {vox:/vec4 fcTP/.test(src(M.voxOpaque))&&/uTexPack/.test(src(M.voxOpaque)),dressed:dressed?/fcPlane/.test(src(dressed)):null}});
 assert.equal(shaders.vox,true,'voxel shader samples the pack');assert.notEqual(shaders.dressed,false,'dressed meshes sample the pack');
 console.log('PASS the voxel shader'+(shaders.dressed?' and the dressed Makers’ Mile meshes':'')+' sample the pack');
 await p.evaluate(()=>{Player.yaw=0.6;Player.pitch=-0.05});await p.waitForTimeout(3000);await p.screenshot({timeout:150000,path:root+'/_test/out/texture-pack-1k.png'});
 // The Display panel switch cycles OFF → 1K → 2K → OFF.
 await p.keyboard.press('KeyF');await p.waitForSelector('#texpack-tog',{timeout:30000});
 assert.match(await p.locator('#texpack-tog').innerText(),/TEXTURE PACK\s*1K/);
 await p.locator('#texpack-tog').click({timeout:180000});await p.waitForFunction(()=>FCTexturePack.state.mode==='2k'||FCTexturePack.state.error,null,{timeout:480000,polling:500});
 assert.equal(await p.evaluate(()=>FCTexturePack.state.size),2048);
 await p.locator('#texpack-tog').click({timeout:180000});await p.waitForFunction(()=>FCTexturePack.state.mode==='off',null,{timeout:30000});assert.equal(await p.evaluate(()=>FCTexturePack.uniforms.uTexOn.value),0);
 assert.equal(await p.evaluate(()=>{try{return localStorage.getItem('fc-texpack')}catch(e){return null}}),'off');
 console.log('PASS the Display panel switches 1K → 2K → OFF and remembers the choice');
 await p.keyboard.press('Escape');
 await p.evaluate(()=>FCTexturePack.set('1k'));await p.waitForFunction(()=>FCTexturePack.state.mode==='1k',null,{timeout:180000,polling:500});
 await p.evaluate(()=>HD.setTier('perf',true));await p.waitForFunction(()=>FCTexturePack.uniforms.uTexOn.value===0,null,{timeout:10000,polling:250});
 console.log('PASS the Performance tier turns the pack off');
 // Phones default to off.
 await p.context().close();const m=await (await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true})).newPage();m.on('pageerror',e=>errors.push(e.message));
 await m.goto(base+'/city/',{timeout:180000});await m.waitForFunction(()=>window.OwnBlock&&window.FCTexturePack,null,{timeout:120000});await m.evaluate(async()=>{await OwnBlock.start()});
 await m.waitForFunction(()=>FCTexturePack.state.patched,null,{timeout:60000,polling:500});
 assert.equal(await m.evaluate(()=>FCTexturePack.state.mode),'off');
 console.log('PASS phones keep the plain look unless switched on');
 assert.deepEqual(errors,[]);console.log('PASS no shader or browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
