// Before/after frames for the street realism pass and the phone HUD.  node _test/reality-shots.cjs <tag> [desktop|phone]
const {chromium,devices}=require('playwright'),{serve}=require('./lib/harness'),path=require('path');
const tag=process.argv[2]||'now',only=process.argv[3]||'';
(async()=>{
 const site=await serve(path.resolve(__dirname,'..')),browser=await chromium.launch({channel:'chrome'});
 const out=n=>path.join(__dirname,'out',`real-${tag}-${n}.png`);
 const boot=async p=>{await p.goto(site.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.OwnBlock);await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready&&State.chunkMap.size>10,null,{timeout:120000});};
 const place=async(p,eye,yaw,hour,tier)=>{await p.evaluate(({eye,yaw,hour,tier})=>{HD.locked=true;HD.setTier(tier,true);Peace.on=true;FCResident.setView(false);State.ui.paused=false;State.dayTime=hour*60;Player.position.set(...eye);Player.yaw=yaw;Player.pitch=0;const cx=Math.floor(eye[0]/24),cz=Math.floor(eye[2]/24);for(let x=cx-2;x<=cx+2;x++)for(let z=cz-2;z<=cz+2;z++)if(!State.chunkMap.has(x+','+z))shBuildChunk(x+','+z);},{eye,yaw,hour,tier});await p.waitForTimeout(3500);};
 try{
  if(only!=='phone'){
   const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await boot(p);
   const views=[['street-day',[192,3.2,150],Math.PI,14],['corner-day',[196,3.2,196],Math.PI*.75,10],['street-dusk',[240,3.2,150],0,18.6],['street-night',[192,3.2,150],Math.PI,22],['roof-day',[200,26,200],Math.PI*.75,15]];
   for(const [n,eye,yaw,hour] of views){await place(p,eye,yaw,hour,'balanced');if(n==='roof-day')await p.evaluate(()=>{Player.pitch=-.5});await p.waitForTimeout(400);await p.screenshot({path:out(n)});}
   console.log('desktop errors',errors,await p.evaluate(()=>districtAtPosition(192,150).name));
  }
  if(only!=='desktop')for(const [n,viewport] of [['portrait',{width:390,height:844}],['landscape',{width:844,height:390}]]){
   const ctx=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:devices['iPhone 13'].userAgent});
   const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await boot(p);
   await place(p,[192,3.2,150],Math.PI,14,'perf');await p.screenshot({path:out('phone-'+n)});
   const menu=await p.$('#tc-top .tc-chip');if(menu){await menu.tap({timeout:120000});await p.waitForTimeout(700);await p.screenshot({path:out('phone-'+n+'-menu')});}
   console.log(n,'errors',errors);await ctx.close();
  }
 }finally{await browser.close();site.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
