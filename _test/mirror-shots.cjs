// Frames of the Mirror Hour.  node _test/mirror-shots.cjs [desktop|phone]
const {chromium,devices}=require('playwright'),{serve}=require('./lib/harness'),path=require('path'),only=process.argv[2]||'';
(async()=>{const site=await serve(path.resolve(__dirname,'..')),browser=await chromium.launch({channel:'chrome'});
 const run=async(ctxOpt,tier,views,tag)=>{const ctx=await browser.newContext(ctxOpt),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'||/shader|WebGL|GLSL/i.test(m.text()))errors.push(m.text().slice(0,300))});
  await p.goto(site.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.OwnBlock);await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready&&State.chunkMap.size>10,null,{timeout:180000});
  for(const [name,eye,rise,ring] of views){
   await p.evaluate(({eye,tier})=>{HD.locked=true;HD.setTier(tier,true);Peace.on=true;FCResident.setView(false);State.ui.paused=false;State.dayTime=23*60;Player.position.set(...eye);const cx=Math.floor(eye[0]/24),cz=Math.floor(eye[2]/24);for(let x=cx-3;x<=cx+2;x++)for(let z=cz-3;z<=cz+2;z++)if(!State.chunkMap.has(x+','+z))shBuildChunk(x+','+z);FCMirrorHour.summon(3600);FCMirrorHour.amount=1;},{eye,tier});
   await p.waitForTimeout(7000);
   await p.evaluate(({eye,rise,ring})=>{State.dayTime=23*60;if(ring){FCMirrorHour.ring(0);const e=document.getElementById('mirror-line');FCMirrorHour.say(e.firstChild.textContent,e.querySelector('small').textContent,120000)}State.ui.paused=true;Player.position.set(...eye);State.camera.position.copy(Player.position);State.camera.lookAt(eye[0]-150,eye[1]+rise,eye[2]-215);},{eye,rise,ring});
   await p.waitForTimeout(3500);await p.screenshot({path:path.join(__dirname,'out',`mirror-${tag}-${name}.png`)});await p.evaluate(()=>{State.ui.paused=false});}
  console.log(tag,JSON.stringify(await p.evaluate(()=>{const e=document.getElementById('mirror-line'),r=e.getBoundingClientRect(),c=getComputedStyle(e);return{cls:e.className,op:c.opacity,disp:c.display,vis:c.visibility,rect:[r.x,r.y,r.width,r.height].map(Math.round),txt:e.textContent.slice(0,30),top:document.elementFromPoint(640,560)?.id}})),'threads',await p.evaluate(()=>FCMirrorHour.threads),'errors',errors.slice(0,4));await ctx.close();};
 try{
  if(only!=='phone')await run({viewport:{width:1280,height:720}},'balanced',[['roof',[204,34,210],75,false],['street',[196,3.4,164],95,true]],'desktop');
  if(only!=='desktop')await run({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:devices['iPhone 13'].userAgent},'perf',[['portrait',[196,3.4,164],120,true]],'phone');
 }finally{await browser.close();site.close();}})().catch(e=>{console.error(e);process.exitCode=1});
