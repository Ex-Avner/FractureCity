// 0.78.1: zombies reachable on phones, the build dock above the online panel,
// and shared-art refusals that the player can see.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-781-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];const T={timeout:240000};
const hitFree=(page,sel)=>page.evaluate(sel=>[...document.querySelectorAll(sel)].filter(e=>e.offsetWidth).map(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{label:e.textContent.trim(),free:!!h&&(h===e||e.contains(h))}}),sel);
try{
 // Server: the art limits are 1,000 per resident and 4,000 per city.
 const src=fs.readFileSync(root+'/server/city-build-store.cjs','utf8');assert.match(src,/objects\.length>1000\)/);assert.match(src,/all\.length>4000\)/);
 console.log('PASS art limits are 1,000 per resident and 4,000 per city');
 // Phone, solo: every chip is tappable and ZOMBIES toggles the siege.
 const m=await (await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();m.on('pageerror',e=>errors.push(e.message));
 await m.goto(base+'/city/',T);await m.waitForFunction(()=>window.OwnBlock&&window.FCBuildDock,null,T);
 await m.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.dayTime=13*60});await m.waitForTimeout(4000);
 const chips=await hitFree(m,'#tc-top .tc-chip');assert.ok(chips.some(c=>c.label==='ZOMBIES'),'ZOMBIES chip');assert.deepEqual(chips.filter(c=>!c.free).map(c=>c.label),[],'no chip is covered');
 await m.locator('.tc-chip[data-act=siege]').tap(T);await m.waitForFunction(()=>Siege.active,null,{timeout:30000});
 await m.screenshot({path:root+'/_test/out/fix-0781-zombies-phone.png',...T});
 await m.locator('.tc-chip[data-act=siege]').tap(T);await m.waitForFunction(()=>!Siege.active,null,{timeout:30000});
 console.log('PASS phones: every chip is tappable and ZOMBIES starts and stops the siege');
 await m.context().close();
 // Phone, online: the dock is above the online panel, and a refusal shows a toast.
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const post=async(a,d)=>{const r=await ctx.request.post(base+'/api/'+a,{data:d});const j=await r.json();if(r.status()!==200)throw Error(a+' '+r.status()+' '+JSON.stringify(j));return j};
 await post('account/register',{username:'fix_tester',password:'test city password 1234',displayName:'Fix'});const code=(await post('join',{public:true})).code;
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/city/?online='+code,T);await p.waitForFunction(()=>window.FCCityOnline?.ready&&FCCityOnline.connected&&window.FCCityBuild?.ready,null,{timeout:300000});
 await p.evaluate(()=>{HD.locked=true;HD.setTier('perf',true);window.__toasts=[];const t=window.toast;window.toast=function(m,k){__toasts.push(String(m));return t.apply(this,arguments)};toggleConstructMode()});
 await p.waitForSelector('#fc-hotbar:not([hidden])',T);await p.waitForTimeout(1500);
 assert.deepEqual((await hitFree(p,'#fc-hotbar button')).filter(b=>!b.free).map(b=>b.label),[],'no hotbar button is covered');
 await p.screenshot({path:root+'/_test/out/fix-0781-dock-online-phone.png',...T});
 const refused=await p.evaluate(()=>{const piece=i=>({id:'cap'+i,kind:'box',p:[150+i%20,1.5,30+Math.floor(i/20)],s:[.3,.3,.3],r:[0,0,0],color:'#888888',finish:'matte'});const list=[...CityArt.objects,...Array.from({length:1001},(_,i)=>piece(i))];const ok=CityArt.online.allow(list);return{ok,toasts:__toasts.slice()}});
 assert.equal(refused.ok,false);assert.ok(refused.toasts.some(t=>/1,000 pieces/.test(t)),'the limit shows as a toast');
 console.log('PASS online phone: dock buttons are above the online panel; a refused placement says why on screen');
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
