const {chromium,devices}=require('playwright'),{serve}=require('./lib/harness'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const site=await serve(path.resolve(__dirname,'..')),browser=await chromium.launch({channel:'chrome'});try{
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:devices['iPhone 13'].userAgent});const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(site.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.OwnBlock&&window.FCPhoneSheet?.show);await p.evaluate(()=>{HD.locked=true;HD.setTier('perf',true);OwnBlock.start()});await p.waitForFunction(()=>OwnBlock.ready&&!document.getElementById('fc-load-status'),null,{timeout:90000});
await p.waitForTimeout(1200);
const isVisible=async id=>p.evaluate(id=>{const e=document.querySelector(id);if(!e||e.hidden)return false;const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.getBoundingClientRect().width>0},id);
for(const id of ['#minimap','#maker-goal','#campaign-hud','#arrival-caption','#narr','#fs-sub'])assert.equal(await isVisible(id),false,id+' hidden during play');
await p.screenshot({path:path.join(__dirname,'out/mobile-quiet-play.png')});
// New feature prompts must be hidden but remain actionable through the single Use control.
await p.evaluate(()=>{FCArrival.frozen=true;const e=document.getElementById('arrival-action');e.hidden=false;e.textContent='E · Pick up the power cell';e.onclick=()=>window.quietActionUsed=true;FCPhoneHUD.layout();Mobile.update()});
assert.equal(await isVisible('#arrival-action'),false);assert.equal(await isVisible('.tc-use'),true);await p.locator('.tc-use').tap();assert.equal(await p.evaluate(()=>window.quietActionUsed),true);
await p.locator('#tc-top [data-act=keys]').tap();await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>Mobile.state().keys),true);assert.equal(await p.locator('#mob-keys .grid button:visible').count(),0);assert.equal(await p.locator('#mob-keys .fc-categories button:visible').count(),6);
await p.screenshot({path:path.join(__dirname,'out/mobile-quiet-menu.png')});
await p.getByRole('button',{name:'Journal',exact:true}).tap();await p.getByRole('button',{name:'Subtitles: Off',exact:true}).tap();assert.equal(await p.evaluate(()=>FCPhoneHUD.subtitles),true);await p.getByRole('button',{name:'Subtitles: On',exact:true}).tap();
await p.getByRole('button',{name:'Back',exact:true}).tap();await p.getByRole('button',{name:'Settings',exact:true}).tap();assert.ok(await p.getByRole('button',{name:'Display',exact:true}).isVisible());
await p.getByRole('button',{name:'Close',exact:true}).tap();assert.equal(await p.evaluate(()=>Mobile.state().keys),false);
// A new subtitle is retained in Journal even with subtitles off.
await p.evaluate(()=>{const e=document.getElementById('arrival-caption');e.textContent='Mara: The garden is ready.';e.hidden=false;FCPhoneHUD.layout()});assert.ok(await p.evaluate(()=>FCPhoneHUD.journal().some(x=>x.text.includes('garden is ready'))));
// Injured health remains visible.
await p.evaluate(()=>{Player.hp=Player.hpMax-10;Mobile.update()});assert.equal(await isVisible('#hud-hp'),true);
// The drawer releases held movement, and all controls fit after rotation.
await p.evaluate(()=>{State.keys.add('w');Mobile.showKeys(true)});assert.equal(await p.evaluate(()=>State.keys.size),0);
await p.setViewportSize({width:844,height:390});await p.waitForTimeout(350);await p.screenshot({path:path.join(__dirname,'out/mobile-quiet-landscape.png')});
const off=await p.evaluate(()=>[...document.querySelectorAll('#mob-keys button')].filter(e=>e.offsetWidth).filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1}).map(e=>e.textContent));assert.deepEqual(off,[]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await p.getByRole('button',{name:'Close',exact:true}).tap();await p.waitForTimeout(300);await p.screenshot({path:path.join(__dirname,'out/mobile-quiet-landscape-play.png')});
// A held contextual action still sends down/up and never gets stuck.
await p.evaluate(()=>{document.getElementById('arrival-action').hidden=true;let field=document.getElementById('fc-field');if(!field){field=document.createElement('button');field.id='fc-field';document.body.append(field)}field.hidden=false;field.style.display='block';field.textContent='Hold E · Repair';window.holdEvents=[];document.addEventListener('keydown',e=>{if(e.code==='KeyE')holdEvents.push('down')});document.addEventListener('keyup',e=>{if(e.code==='KeyE')holdEvents.push('up')});FN._nearPickup=null;for(const selectors of FCPhoneHUD.ORDER)for(const sel of selectors){const el=document.querySelector(sel);if(el&&el!==field)el.hidden=true;}FCPhoneHUD.layout();Mobile.update();const use=document.querySelector('.tc-use');use.dispatchEvent(new PointerEvent('pointerdown',{pointerId:91,pointerType:'touch',bubbles:true}));use.dispatchEvent(new PointerEvent('pointerup',{pointerId:91,pointerType:'touch',bubbles:true}));});assert.deepEqual(await p.evaluate(()=>holdEvents),['down','up']);
await p.evaluate(()=>document.getElementById('fc-field').hidden=true);

assert.deepEqual(errors,[]);console.log('PASS quiet play, single working action, grouped menu, journal/subtitle toggle, injured health, movement release, portrait and landscape.');await ctx.close();
// Desktop remains unaffected by mobile-only rules.
const d=await browser.newPage();await d.goto(site.origin+'/apps/fracture-city-game/index.html');await d.waitForFunction(()=>window.FCPhoneHUD);assert.equal(await d.evaluate(()=>document.body.classList.contains('touch')),false);await d.close();
}finally{await browser.close();site.close()}})().catch(e=>{console.error(e);process.exitCode=1});
