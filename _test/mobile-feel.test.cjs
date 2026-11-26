const {chromium,devices}=require('playwright'),{serve}=require('./lib/harness'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const s=await serve(path.resolve(__dirname,'..')),b=await chromium.launch({channel:'chrome'});try{
 const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:devices['iPhone 13'].userAgent}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(s.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.Mobile?.motion&&window.OwnBlock);await p.evaluate(()=>{HD.locked=true;HD.setTier('perf',true);OwnBlock.start()});await p.waitForFunction(()=>OwnBlock.ready&&!document.getElementById('fc-load-status'),null,{timeout:90000});
 const results=await p.evaluate(()=>{
 State.ui.paused=false;Board.on=false;Player.mode='walk';Player.yaw=0;Player.pitch=0;Player.onGround=true;State.keys.clear();shTouchReleaseAll();Mobile.setPreference('autoSprint',false);
 const stick=document.getElementById('tc-stick'),look=document.getElementById('tc-look'),jump=document.querySelector('.tc-jump');
 const event=(el,type,id,x=0,y=0)=>el.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
 const r=stick.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
 event(stick,'pointerdown',1,x+2,y+1);updateWalkInput(.016);const deadzone=Mobile.motion.strength===0&&!State.keys.has('w');event(stick,'pointerup',1);
 function sample(dx,dy){event(stick,'pointerdown',2,x+dx,y+dy);Player.velocity.set(0,0,0);Player.onGround=true;updateWalkInput(.05);const v=[Player.velocity.x,Player.velocity.z];event(stick,'pointerup',2);return v;}
 const slow=sample(0,-20),fast=sample(0,-42),steering=sample(18,-36);
 event(stick,'pointerdown',3,x,y-40);event(stick,'pointerdown',4,x,y+40);event(stick,'pointerup',4);const independent=Touch.moveId===3&&State.keys.has('w');event(stick,'lostpointercapture',3);const release=!State.keys.has('w')&&!Mobile.motion.active;
 Mobile.setPreference('sensitivity',.5);event(look,'pointerdown',5,200,200);event(look,'pointermove',5,220,210);const camera=[Player.yaw,Player.pitch];event(look,'lostpointercapture',5);const lookReleased=Touch.lookId===null;
 Player.onGround=true;Player.velocity.set(0,0,0);State.keys.clear();FCFlow.held=false;FCFlow.airUsed=false;FCFlow.buffer=0;FCFlow.coyote=0;
 const press=()=>{event(jump,'pointerdown',6);event(jump,'pointerup',6);updateWalkInput(.016)};
 press();const first=Player.velocity.y===getJumpPower();Player.velocity.y=-2;press();const second=Player.velocity.y===getJumpPower();Player.velocity.y=-2;press();const third=Player.velocity.y<0;
 event(stick,'pointerdown',7,x,y-40);event(jump,'pointerdown',8);Mobile.showKeys(true);const menuRelease=!Mobile.motion.active&&!State.keys.size&&!Touch.held.size&&Mobile.jumpPresses===0;Mobile.showKeys(false);
 return{deadzone,slow,fast,steering,independent,release,camera,lookReleased,first,second,third,menuRelease};
 });console.log(results);for(const k of ['deadzone','independent','release','lookReleased','first','second','third','menuRelease'])assert.ok(results[k],k);
 assert.ok(Math.abs(results.fast[1])>Math.abs(results.slow[1])*1.7);assert.ok(Math.abs(results.steering[0]/results.steering[1]+.5)<.04);assert.ok(Math.abs(results.camera[0]+.042)<.0001);assert.ok(Math.abs(results.camera[1]+.021)<.0001);
 await p.locator('#tc-top [data-act=keys]').tap();await p.getByRole('button',{name:'Settings',exact:true}).tap();await p.getByRole('button',{name:'Touch controls',exact:true}).tap();await p.getByRole('slider',{name:'Joystick size',exact:true}).fill('140');
 assert.equal(await p.evaluate(()=>Mobile.preferences.stickSize),140);await p.screenshot({path:path.join(__dirname,'out/mobile-touch-settings.png')});await p.getByRole('button',{name:'Close',exact:true}).tap();assert.equal(await p.locator('#tc-stick').evaluate(e=>Math.round(e.getBoundingClientRect().width)),140);
 await p.reload();await p.waitForFunction(()=>window.Mobile?.preferences);assert.equal(await p.evaluate(()=>Mobile.preferences.stickSize),140);assert.equal(await p.evaluate(()=>Mobile.preferences.sensitivity),.5);assert.deepEqual(errors,[]);
 console.log('PASS proportional speed and steering; dead zone; independent pointers; capture loss; sensitivity; sub-frame double jumps; menu release; settings and persistence.');
}finally{await b.close();s.close()}})().catch(e=>{console.error(e);process.exitCode=1});
