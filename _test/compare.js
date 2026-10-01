// Same seed, clock, camera and graphics for palette and beam comparisons.
// FC_COMPARE_PHASE=before|after npm run compare
const {chromium}=require('playwright');
const {serve}=require('./lib/harness');
const fs=require('fs'),path=require('path');
(async()=>{
 const site=await serve(process.argv[2]||path.resolve(__dirname,'..'));
 const browser=await chromium.launch({channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
 const phase=process.env.FC_COMPARE_PHASE||'before';const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(site.origin+'/apps/fracture-city-game/index.html');await page.waitForTimeout(2200);
 await page.evaluate(()=>{HD.locked=true;HD.tier='high';newGame('hd-compare')});await page.waitForTimeout(5000);
 await page.evaluate(()=>{Player.position.set(9,3.65,5);Player.yaw=Math.atan2(11.6,12.5);Player.pitch=0;for(let i=0;i<20;i++)updateChunks();State.ui.paused=true;shCampaignSilence();State.camera.position.copy(Player.position);State.camera.rotation.set(0,Player.yaw,0,'YXZ');});
 for(const hour of [18,23]){
 await page.evaluate(hour=>{State.dayTime=hour*60;updateDayNight(0);shApplyLighting(hour);shSkyFrame(0);},hour);
 await page.waitForTimeout(800);await page.screenshot({path:path.join(out,`civic-${phase}-${hour}00.png`)});
 }
 if(phase==='before')for(const category of Object.keys(await page.evaluate(()=>FCDEBUG.categories))){
 await page.evaluate(category=>{State.dayTime=18*60;updateDayNight(0);FCDEBUG.set(category,false);},category);
 await page.waitForTimeout(350);await page.screenshot({path:path.join(out,`beams-${category}-off.png`)});
 await page.evaluate(category=>FCDEBUG.set(category,true),category);
 }
 fs.writeFileSync(path.join(out,`civic-${phase}.json`),JSON.stringify({seed:'hd-compare',camera:[9,3.65,5],tier:'high',errors,counts:await page.evaluate(()=>FCDEBUG.counts()),rails:await page.evaluate(()=>[...State.chunkMap.values()].flatMap(c=>c.rails||[]))},null,2));
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Saved Civic Core '+phase+' at 18:00 and 23:00.');
 }finally{await browser.close();site.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
