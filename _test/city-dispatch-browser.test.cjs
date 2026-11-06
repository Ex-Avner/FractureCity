const {chromium}=require('playwright'),{createServer}=require('../server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-dispatch-')),app=createServer({dbPath:path.join(dir,'city.sqlite'),newsFetch:async()=>new Response('<rss/>')});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'chrome'});const ctx=await browser.newContext({viewport:{width:1280,height:820}}),base='http://127.0.0.1:'+app.server.address().port;
  assert.equal((await ctx.request.get(base+'/api/city-dispatch')).status(),401);
  await ctx.request.post(base+'/api/account/register',{data:{username:'dispatch_test',password:'dispatch browser test password'}});
  const join=await (await ctx.request.post(base+'/api/join',{data:{public:true}})).json(),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER',e.message)});p.on('response',async r=>{if(r.url().includes('city-dispatch')&&r.status()>=400)console.log('DISPATCH',r.status(),await r.text());});
  await p.goto(base+'/city/?online='+join.code);await p.waitForFunction(()=>window.FCCityDispatch?.data&&FCCityOnline.connected,null,{timeout:60000});
  await p.evaluate(()=>{HD.setTier('perf',true);State.ui.paused=false;FCCityDispatch.open();});
  assert.equal(await p.locator('.dispatch-job').count(),6);await p.screenshot({path:path.join(__dirname,'out/dispatch-desktop.png')});
  await p.locator('[data-track="last-light"]').click();await p.waitForFunction(()=>FCCityDispatch.data.state.active==='last-light'&&!document.querySelector('#city-dispatch'));
  const balance=(await (await ctx.request.get(base+'/api/wallet')).json()).balance;
  for(let i=0;i<3;i++){
   await p.evaluate(async i=>{const q=FCCityDispatch.data.jobs.find(q=>q.id==='last-light'),a=FCDispatchJobs.places[q.steps[i].place].at;State.keys.clear();State.ui.paused=false;for(let n=0;n<30;n++){const dx=a[0]-Player.position.x,dz=a[2]-Player.position.z,d=Math.hypot(dx,dz);Player.position.x+=dx*Math.min(1,3/Math.max(d,.01));Player.position.z+=dz*Math.min(1,3/Math.max(d,.01));Player.position.y=a[1]+Player.height;Player.velocity.set(0,0,0);await new Promise(r=>setTimeout(r,220));if(d<.5)break;}},i);
   await p.waitForTimeout(1400);await p.waitForFunction(()=>!!FCCityDispatch.actor);
   await p.locator('#dispatch-goal').click();await p.waitForFunction(()=>FCCityDispatch.working,null,{timeout:6000}).catch(async e=>{console.log('FAILED START',i,await p.evaluate(()=>({p:{x:Player.position.x,y:Player.position.y-Player.height,z:Player.position.z},self:FCCityOnline.self,ui:State.ui,job:FCCityDispatch.data.state,hud:document.querySelector('#dispatch-goal').textContent,toasts:document.querySelector('#toast-stack')?.textContent})));throw e});
   await p.waitForFunction(i=>FCCityDispatch.data.state.progress['last-light'].step>i,i,{timeout:20000});
  }
  assert.equal((await (await ctx.request.get(base+'/api/wallet')).json()).balance,balance+90);
  await p.reload();await p.waitForFunction(()=>window.FCCityDispatch?.data,null,{timeout:60000});assert.equal(await p.evaluate(()=>FCCityDispatch.data.state.progress['last-light'].done),true);
  console.log('PASS real browser quest, NPC, timed interactions, wallet reward and reload');
  await p.evaluate(()=>{State.ui.paused=false;FCCityDispatch.open();});
  for(const [name,viewport]of [['portrait',{width:390,height:844}],['landscape',{width:844,height:390}]]){
   await p.setViewportSize(viewport);assert.ok(await p.locator('#city-dispatch').evaluate(e=>e.scrollWidth<=e.clientWidth));
   assert.ok(await p.locator('[data-close]').evaluate(e=>{const r=e.getBoundingClientRect();return r.right<=innerWidth&&r.height>=44;}));
   await p.screenshot({path:path.join(__dirname,'out/dispatch-'+name+'.png')});
  }
  await p.keyboard.press('Escape');assert.equal(await p.locator('#city-dispatch').count(),0);
  await p.evaluate(()=>{FCStreetEvents.end();Player.position.set(167,1+Player.height,12);});
  const event=await p.evaluate(()=>{for(let i=0;i<15;i++)if(FCStreetEvents.start('busker'))return FCStreetEvents.current;return null;});assert.ok(event,'event has accessible open ground');assert.ok(event.people<=7);
  await p.waitForTimeout(1500);assert.ok(await p.evaluate(()=>FCStreetEvents.current));await p.evaluate(()=>FCStreetEvents.end());assert.equal(await p.evaluate(()=>FCStreetEvents.current),null);
  assert.deepEqual(errors,[]);console.log('PASS portrait/landscape board, Escape, street performance and cleanup; no browser errors');
 }finally{await browser?.close();await new Promise(r=>{app.server.once('close',r);app.close();});fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
