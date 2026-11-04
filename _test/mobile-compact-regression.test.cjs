// A phone session exercised through real pointer input. A small set of controls
// must leave the world visible while the menu retains less frequent actions.
const root=require('node:path').resolve(__dirname,'..');
const {chromium,devices}=require(root+'/_test/node_modules/playwright');
const {createServer}=require(root+'/server/server.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const WAIT={timeout:240000};
const HUD=['#tc-top','#minimap','#maker-goal','#fc-story-goal','#city-online','#fc-tools','#fc-bell','#tc-stick','#tc-acts button','#fc-hotbar','#build-hud','#narr','.mob-cb.on','#maker-interact','#interact-prompt','#npc-talk-prompt','#casting-prompt','#cg-approach','#news-approach','#chainfire-play','#campus-arcade-play','#cg-directory-launch','#cg-walk-guide','#common-invite','#common-later','#city-pvp .pv-hp'];
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-mobile-compact-'));
 const app=createServer({dbPath:path.join(dir,'city.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;
 const browser=await chromium.launch({channel:'chrome'}),errors=[];
 try{
  for(const [name,viewport] of [['portrait',{width:390,height:844}],['landscape',{width:844,height:390}]].filter(([n])=>!process.env.ORIENTATION||n===process.env.ORIENTATION)){
   const ctx=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:devices['iPhone 13'].userAgent});
   await ctx.request.post(base+'/api/account/register',{data:{username:'compact_'+name,password:'phone compact test password',displayName:'Compact '+name}});
   const code=(await (await ctx.request.post(base+'/api/join',{data:{public:true}})).json()).code;
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/city/?online='+code,WAIT);
   await page.waitForFunction(()=>window.FCCityOnline?.ready&&FCCityOnline.connected&&window.Mobile,null,WAIT);
   await page.evaluate(()=>{HD.locked=true;HD.setTier('perf',true);Player.position.set(167,1+Player.height,30);Player.yaw=0});
   await page.waitForTimeout(4000);
   const inspect=()=>page.evaluate(selectors=>{
    const visible=e=>{if(!e||e.hidden)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity!==0&&r.width>2&&r.height>2};
    const boxes=[...new Set(selectors.flatMap(s=>[...document.querySelectorAll(s)]))].filter(visible).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,l:r.left,r:r.right,t:r.top,b:r.bottom}});
    const overlap=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(a.l<b.r-1&&b.l<a.r-1&&a.t<b.b-1&&b.t<a.b-1)overlap.push(a.id+' / '+b.id)}
    return {boxes,overlap,off:boxes.filter(r=>r.l<0||r.t<0||r.r>innerWidth+1||r.b>innerHeight+1),chips:[...document.querySelectorAll('#tc-top button')].filter(visible).map(e=>({act:e.dataset.act,w:e.offsetWidth,h:e.offsetHeight})),actions:[...document.querySelectorAll('#tc-acts button')].filter(visible).map(e=>e.dataset.act)};
   },HUD);
   const fit=await inspect();
   await page.screenshot({path:root+'/_test/out/mobile-compact-'+name+'.png'});
   assert.deepEqual(fit.overlap,[],name+' overlapping HUD: '+JSON.stringify(fit));
   assert.deepEqual(fit.off,[],name+' HUD leaves screen');
   assert.deepEqual(fit.chips.map(c=>c.act).sort(),['keys','map'],name+' only navigation and menu stay on screen');
   assert.ok(fit.chips.every(c=>c.w>=44&&c.h>=44),name+' menu/map targets need at least 44px');
   assert.ok(fit.actions.length<=2&&!fit.actions.includes('fire')&&!fit.actions.includes('alt'),name+' idle city has no shooting/build buttons: '+fit.actions);
   await page.evaluate(()=>FCPvp.set(true));
   await page.waitForFunction(()=>document.body.classList.contains('mob-combat'));
   assert.ok(await page.locator('.tc-fire').isVisible(),name+' opting into PvP exposes Fire');
   await page.evaluate(()=>FCPvp.set(false));
   await page.waitForFunction(()=>!document.body.classList.contains('mob-combat'));
   const yaw=await page.evaluate(()=>Player.yaw);
   await page.locator('.tc-chip[data-act=keys]').tap();
   await page.waitForFunction(()=>Mobile.state().keys);
   await page.waitForTimeout(600);
   assert.ok(await page.evaluate(()=>Mobile.state().keys),name+' touch menu survives its trailing click');
   assert.equal(await page.evaluate(()=>Player.yaw),yaw,name+' menu tap does not turn camera');
   const menuLabels=await page.locator('#mob-keys .grid button span').allTextContents();
   for(const label of ['Inventory','Build mode','Casebook','Camera view'])assert.ok(menuLabels.includes(label),name+' menu retains '+label);
   await page.screenshot({path:root+'/_test/out/mobile-compact-'+name+'-menu.png'});
   await page.locator('#mob-back').tap();await page.waitForFunction(()=>!Mobile.state().keys);
   // A mouse on a hybrid device must also open the menu exactly once.
   await page.locator('.tc-chip[data-act=keys]').click();await page.waitForTimeout(500);
   assert.ok(await page.evaluate(()=>Mobile.state().keys),name+' mouse menu survives click');
   await page.locator('#mob-back').click();await page.waitForFunction(()=>!Mobile.state().keys);
   const drawer=async(label)=>{await page.locator('.tc-chip[data-act=keys]').tap();await page.waitForFunction(()=>Mobile.state().keys);await page.locator('#mob-keys .grid button').filter({has:page.locator('span',{hasText:new RegExp('^'+label+'$')})}).tap();};
   for(const label of ['Online & friends','Tools & radio']){
    await drawer(label);
    const selector=label==='Online & friends'?'#city-online details':'#fc-tools';
    await page.waitForFunction(s=>document.querySelector(s)?.open,selector);
    const sheet=await page.locator(selector).evaluate(e=>{const outer=e.closest('#city-online')||e,r=outer.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+20);return{fits:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,covered:!outer.contains(target),box:r.toJSON(),hit:target?.outerHTML.slice(0,150)};});
    await page.screenshot({path:root+'/_test/out/mobile-compact-'+name+'-'+label.split(' ')[0]+'.png'});
    assert.ok(sheet.fits&&!sheet.covered,name+' '+label+' sheet is visible and reachable: '+JSON.stringify(sheet));
    await page.locator('#mob-back').tap();await page.waitForFunction(s=>!document.querySelector(s)?.open,selector);
   }
   await drawer('Explore Common Ground');await page.waitForFunction(()=>FCCommonGroundGuide.isOpen);
   await page.locator('#cg-directory [data-destination=gallery]').tap();
   await page.waitForFunction(()=>FCCommonGroundGuide.selection==='gallery');
   await page.waitForTimeout(500);
   const guiding=await inspect();assert.deepEqual(guiding.overlap,[],name+' directions overlap '+JSON.stringify(guiding));
   await page.locator('#cg-walk-guide button').tap();await page.waitForFunction(()=>!FCCommonGroundGuide.selection);
   await drawer('Inventory');await page.waitForFunction(()=>State.ui.inInventory);
   await page.locator('#fc-inv header [data-close]').tap();await page.waitForFunction(()=>!State.ui.inInventory);
   await drawer('Build mode');await page.waitForFunction(()=>State.ui.construct);
   await page.waitForTimeout(500);
   assert.ok(await page.locator('.tc-alt').isVisible(),name+' Place appears in build mode');
   assert.ok(await page.locator('.tc-fire').isVisible(),name+' Mine appears in build mode');
   await page.screenshot({path:root+'/_test/out/mobile-compact-'+name+'-build.png'});
   const building=await inspect();
   assert.deepEqual(building.overlap,[],name+' build HUD overlaps: '+JSON.stringify(building));
   assert.deepEqual(building.off,[],name+' build HUD leaves screen');
   await drawer('Build mode');await page.waitForFunction(()=>!State.ui.construct);
   await page.evaluate(()=>{Player.position.set(167,1+Player.height,35.6);Player.yaw=Math.PI;});
   await page.waitForFunction(()=>FCPhoneHUD.context()?.element.id==='rw-approach'&&document.querySelector('.tc-use').offsetWidth>0);
   await page.locator('.tc-use').tap();await page.waitForFunction(()=>FCReadingGarden.isOpen);
   await page.locator('#rw-panel [data-close]').tap();await page.waitForFunction(()=>!FCReadingGarden.isOpen);
   await page.evaluate(()=>{Player.position.set(167,1+Player.height,30);Player.yaw=0;});
   const cdp=await ctx.newCDPSession(page);
   const point=async(selector)=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}});
   await page.waitForFunction(()=>{const e=document.getElementById('tc-stick'),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&(hit===e||e.contains(hit));});
   const stick=await point('#tc-stick');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...stick,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:stick.x,y:stick.y-38,id:1}]});
   await page.waitForFunction(()=>State.keys.has('w'));
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(()=>!State.keys.has('w'));
   const start=await page.evaluate(()=>({yaw:Player.yaw,x:innerWidth*.55,y:innerHeight*.47,hit:document.elementFromPoint(innerWidth*.55,innerHeight*.47)?.id,hitHTML:document.elementFromPoint(innerWidth*.55,innerHeight*.47)?.outerHTML.slice(0,300)}));
   await page.screenshot({path:root+'/_test/out/mobile-compact-'+name+'-look.png'});
   assert.ok(start.hit==='tc-look'||start.hitHTML.includes('data-touch-look="1"'),name+' central world is available for look drag: '+JSON.stringify(start));
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+45,y:start.y,id:2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.notEqual(await page.evaluate(()=>Player.yaw),start.yaw,name+' drag turns the camera');
   console.log('PASS '+name+': uncluttered HUD, accessible menu, inventory/build, mouse/touch, stick and camera');
   await ctx.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS no browser errors');
 }finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
