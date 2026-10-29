// 0.86: online, placing a block in your plot uses the blocks the inventory
// shows (the server's count). It used to check the solo save's mined blocks
// and said "No … in hand" while the inventory held plenty.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const T={timeout:240000};
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-blocks-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:800}});
 await ctx.request.post(base+'/api/account/register',{data:{username:'block_ash',password:'block test password 1',displayName:'Ash'}});
 await ctx.request.post(base+'/api/wallet/buy',{data:{sku:'b:120',qty:3}});
 const code=(await (await ctx.request.post(base+'/api/join',{data:{public:true}})).json()).code;
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 for(let i=0;;i++){await p.goto(base+'/city/?online='+code,T);if(await p.waitForFunction(()=>window.FCCityOnline?.ready&&FCCityOnline.connected&&FCStructures.ready&&FCStructures.mine,null,{timeout:240000}).then(()=>true,()=>false))break;if(i===2)throw Error('could not join');console.log('retrying the join')}
 await p.evaluate(()=>{HD.locked=true;HD.setTier('perf',true)});
 await p.evaluate(()=>FCStructures.visit());await p.waitForTimeout(2500);
 await p.waitForFunction(()=>FCInv.count('b:120')===3,null,T);
 //  Hold the bought blocks, aim at the plot pad, place three: all three land; a fourth is refused with the inventory's count.
 const toasts=[];await p.exposeFunction('noteToast',t=>toasts.push(t));
 await p.evaluate(()=>{const t=window.toast;window.toast=(m,k)=>{noteToast(String(m));return t(m,k)};if(!State.ui.construct)toggleConstructMode();FCInv.slots[0]='b:120';FCInv.select(0)});
 const plot=await p.evaluate(()=>FCStructures.mine.plot);
 for(let i=0;i<4;i++){
  await p.waitForFunction(()=>!FCStructures.busy,null,T);
  await p.evaluate(([pl,i])=>{Player.position.set(pl.x+10,Player.height+1,pl.z+16);targetBlock={x:pl.x+4+i*2,y:0,z:pl.z+4,nx:0,ny:1,nz:0};placeBlock()},[plot,i]);
  await p.waitForTimeout(400);
 }
 await p.waitForFunction(()=>!FCStructures.busy,null,T);await p.waitForTimeout(1500);
 const placed=await p.evaluate(pl=>[0,1,2,3].map(i=>getBlock(pl.x+4+i*2,1,pl.z+4)),plot);
 assert.deepEqual(placed.slice(0,3),[120,120,120],'three bought blocks place: '+placed);assert.equal(placed[3],0,'the fourth is refused');
 assert.ok(!toasts.some(t=>/in hand/.test(t)),'no solo "in hand" message: '+toasts.join(' | '));assert.ok(toasts.some(t=>/hold no/.test(t)),'out of blocks says so: '+toasts.join(' | '));
 assert.equal(await p.evaluate(()=>FCInv.count('b:120')),0,'inventory shows none left');
 console.log('PASS online blocks place from the inventory count, and running out says so');
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
