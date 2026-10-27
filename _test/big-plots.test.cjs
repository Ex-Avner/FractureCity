// 0.84: the building yard is a 4 x 3 block of 20 x 20 plots. Your plot opens,
// you can build at its far corner, and the yard is part of the safe zone.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const T={timeout:240000};
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-plots-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:1366,height:820}});
 await ctx.request.post(base+'/api/account/register',{data:{username:'plot_ash',password:'plot test password 1',displayName:'Ash'}});
 await ctx.request.post(base+'/api/wallet/buy',{data:{sku:'b:120',qty:40}});
 const code=(await (await ctx.request.post(base+'/api/join',{data:{public:true}})).json()).code;
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 for(let i=0;;i++){await p.goto(base+'/city/?online='+code,T);if(await p.waitForFunction(()=>window.FCCityOnline?.ready&&FCCityOnline.connected&&FCStructures.ready&&FCStructures.mine,null,{timeout:240000}).then(()=>true,()=>false))break;if(i===2)throw Error('could not join');console.log('retrying the join')}
 await p.evaluate(()=>{HD.locked=true;HD.setTier('perf',true)});
 const plot=await p.evaluate(()=>FCStructures.mine.plot);
 assert.equal(plot.w,20);assert.equal(plot.d,20);assert.equal(plot.height,24);
 await p.evaluate(()=>FCStructures.visit());await p.waitForTimeout(3000);
 //  The pad covers the whole plot: workshop concrete at all four corners.
 const pad=await p.evaluate(pl=>[[0,0],[19,0],[0,19],[19,19]].map(([dx,dz])=>getBlock(pl.x+dx,0,pl.z+dz)),plot);
 assert.ok(pad.every(id=>id===133),'pad at every corner '+pad);
 //  Build at the far corner: a 3-block column, saved on the server.
 const room=app.rooms.get(code),me=[...room.players.values()][0];
 const out=await p.evaluate(async pl=>{const own=FCStructures.mine,cells=[...own.cells,...[1,2,3].map(y=>({x:pl.x+19,y,z:pl.z+19,id:120}))];const r=await fetch('/api/city-structures',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+JSON.parse(sessionStorage.getItem('fc-district-session')).token},body:JSON.stringify({revision:own.revision,cells,doors:own.doors})});return{status:r.status,body:await r.json()}},plot);
 assert.equal(out.status,200,JSON.stringify(out.body).slice(0,200));
 await p.evaluate(()=>FCStructures.refresh(1e9).catch(()=>{}));await p.waitForTimeout(2500);
 assert.equal(await p.evaluate(pl=>getBlock(pl.x+19,2,pl.z+19),plot),120,'the far corner builds');
 //  Outside the plot is refused.
 const bad=await p.evaluate(async pl=>{const own=FCStructures.mine;const r=await fetch('/api/city-structures',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+JSON.parse(sessionStorage.getItem('fc-district-session')).token},body:JSON.stringify({revision:own.revision,cells:[...own.cells,{x:pl.x+20,y:1,z:pl.z,id:120}],doors:own.doors})});return r.status},plot);
 assert.equal(bad,400);
 //  The yard is a safe zone now, end to end.
 assert.ok(await p.evaluate(()=>FCCityPvp.safe(285,118)&&FCCityPvp.safe(194,50)&&!FCCityPvp.safe(250,20)));
 //  A top-down look at the whole yard.
 await p.evaluate(async()=>{Player.position.set(240,3,84);for(let i=0;i<30;i++)await new Promise(r=>setTimeout(r,100));State.ui.paused=true;const cam=new THREE.OrthographicCamera(-54,54,40,-40,1,300);cam.position.set(240,150,84);cam.up.set(0,0,-1);cam.lookAt(240,0,84);const r=new THREE.WebGLRenderer();r.setSize(1366,1012);r.domElement.style='position:fixed;inset:0;z-index:999999';document.body.append(r.domElement);r.render(State.scene,cam)});
 await p.screenshot({path:root+'/_test/out/big-plots.png',...T});
 console.log('PASS plots are 20 x 20 x 24: the pad covers them, the far corner builds, outside is refused, the yard is safe');
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
