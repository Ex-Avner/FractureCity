/* Semantic equivalence and live-world invalidation for the collision hot path.
   Timing is reported for context; correctness never depends on machine speed. */
const {chromium}=require('playwright'),{serve}=require('./lib/harness'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const site=await serve(path.resolve(__dirname,'..')),browser=await chromium.launch({channel:'chrome'});try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(site.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.FCPhysicalSupport&&window.FCSeam&&window.OwnBlock);
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.ui.paused=true;});await p.waitForTimeout(1500);
 const result=await p.evaluate(()=>{
  State.ui.paused=true;
  const offsets=r=>[[0,0],[-r,-r],[r,-r],[-r,r],[r,r]];
  const oldLoaded=(x,z,r)=>offsets(r).every(([a,b])=>State.chunkMap.has(Math.floor((x+a)/VOX_W)+','+Math.floor((z+b)/VOX_W)));
  function oldSupport(x,z,r,from){if(!oldLoaded(x,z,r))return null;let y=0;for(const [dx,dz]of offsets(r))y=Math.max(y,shSurfaceY(x+dx,z+dz,from));for(const key of nearbyChunkKeys(x,z))for(const a of State.chunkMap.get(key)?.collisionAABBs||[])if(x+r>a.minX&&x-r<a.maxX&&z+r>a.minZ&&z-r<a.maxZ&&a.maxY<=from+.05)y=Math.max(y,a.maxY);return y||null;}
  const failures=[];let seed=521,count=0;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let i=0;i<4000;i++){
   const x=130+rand()*110,z=-30+rand()*130,r=[.28,.46,.55,1.2,28][i%5],from=[1.05,2.7,7.1,30][i%4];
   if(oldLoaded(x,z,r)!==FCPhysicalSupport.loaded(x,z,r))failures.push({kind:'loaded',x,z,r});
   if(oldSupport(x,z,r,from)!==FCPhysicalSupport.support(x,z,r,from))failures.push({kind:'support',x,z,r,from});count++;
  }
  // A one-voxel footprint should read that column only once, not five times.
  const surface=window.shSurfaceY;let reads=0;window.shSurfaceY=function(){reads++;return surface.apply(this,arguments)};
  FCPhysicalSupport.support(167.5,24.5,.46,1.05);const optimizedReads=reads;reads=0;oldSupport(167.5,24.5,.46,1.05);const legacyReads=reads;window.shSurfaceY=surface;
  const c=State.chunkMap.get('6,1'),previous=c.collisionAABBs,box={minX:167,maxX:168,minZ:24,maxZ:25,minY:1,maxY:2};
  // Fill the coordinate cache first, then replace, move and remove geometry.
  FCPhysicalSupport.support(167.5,24.5,.46,3);c.collisionAABBs=[box];
  const inserted=shBodyBlocked(167.5,1,24.5,.46,1.85),raised=FCPhysicalSupport.support(167.5,24.5,.46,3)===2;
  box.minX=180;box.maxX=181;const moved=!shBodyBlocked(167.5,1,24.5,.46,1.85);
  c.collisionAABBs=[];const removed=FCPhysicalSupport.support(167.5,24.5,.46,3)===1;
  c.collisionAABBs=previous;State.chunkMap.delete('6,1');const unloaded=!FCPhysicalSupport.loaded(167.5,24.5,.46)&&FCPhysicalSupport.support(167.5,24.5,.46,3)===null;State.chunkMap.set('6,1',c);
  const voxel=getBlock(167,1,24);setBlock(167,1,24,135,false);const edited=FCPhysicalSupport.support(167.5,24.5,.46,3)===2;setBlock(167,1,24,voxel,false);
  const timings={};for(const [name,fn]of [['legacy',oldSupport],['optimized',FCPhysicalSupport.support]]){for(let i=0;i<1000;i++)fn(167.5,24.5,.46,1.05);const rows=[];for(let j=0;j<5;j++){const t=performance.now();for(let i=0;i<10000;i++)fn(167.5,24.5,.46,1.05);rows.push(performance.now()-t);}timings[name]=rows.sort((a,b)=>a-b)[2];}
  return {count,failures,optimizedReads,legacyReads,inserted,raised,moved,removed,unloaded,edited,timings};
 });
 assert.deepEqual(result.failures,[]);assert.equal(result.optimizedReads,1);assert.equal(result.legacyReads,5);
 for(const key of ['inserted','raised','moved','removed','unloaded','edited'])assert.equal(result[key],true,key);
 console.log('PASS: 4,000 footprint queries match legacy semantics; edits, collider movement and unloaded chunks take effect immediately.',result);
 const dates=await p.evaluate(()=>{
  const key=Grit._key,hue=Grit.hue;try{
   Grit._key='2026-11-01';Grit.hue={id:'clear',name:'Clear'};const first=FCSeam.almanac();
   let t=performance.now();for(let i=0;i<5000;i++)FCSeam.almanac();const sameDayMs=performance.now()-t;
   Grit.hue={id:'cold',name:'Cold'};const weather=FCSeam.almanac();Grit._key='2026-11-02';const next=FCSeam.almanac();
   const expected=day=>new Date(day+'T12:00:00Z').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
   return {sameDayMs,firstDay:first.day,firstLabel:first.label===expected('2026-11-01'),firstEvent:first.crop,liveWeather:weather.quiet,nextDay:next.day,nextLabel:next.label===expected('2026-11-02')};
  }finally{Grit._key=key;Grit.hue=hue;}
 });
 assert.equal(dates.firstDay,'2026-11-01');assert.equal(dates.firstLabel,true);assert.equal(dates.firstEvent,'wheat');assert.equal(dates.liveWeather,true);assert.equal(dates.nextDay,'2026-11-02');assert.equal(dates.nextLabel,true);assert.deepEqual(errors,[]);console.log('PASS: cached almanac follows day rollover and same-day weather changes.',dates);
 }finally{await browser.close();site.close();}})().catch(e=>{console.error(e);process.exitCode=1});
