const {chromium}=require('playwright'),{serve}=require('./lib/harness'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const s=await serve(path.resolve(__dirname,'..')),b=await chromium.launch({channel:'chrome'});try{const p=await b.newPage({viewport:{width:1200,height:800}});await p.goto(s.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.FCCrownRun&&window.OwnBlock);await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready);const results=await p.evaluate(()=>{
 HD.setTier('perf',true);Peace.on=true;State.ui.paused=true;
 for(let x=5;x<=9;x++)for(let z=-1;z<=0;z++)if(!State.chunkMap.has(x+','+z))shBuildChunk(x+','+z);
 FCCrownRun.tick();Player.mode='walk';const nodes=FCCrownRun.nodes,fail=[];
 // Exercise the actual collision/landing routine using the weakest jump and
 // ordinary heavy-class walking speed. Search launch speed to account for the
 // curved route's varying distances, rather than teleporting between ledges.
 for(let i=0;i<nodes.length-1;i++){
 const a=nodes[i],b=nodes[i+1],dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz);let landed=false;
 for(const speed of [2,2.5,3,3.5,4,4.5,5,5.5]){
 Player.position.set(a.x,a.y+Player.height+.001,a.z);Player.velocity.set(dx/dist*speed,7.5,dz/dist*speed);Player.onGround=false;
 for(let frame=0;frame<120;frame++){Player.velocity.y-=22/120;const remaining=(b.x-Player.position.x)*dx+(b.z-Player.position.z)*dz;if(remaining<=0){Player.velocity.x=0;Player.velocity.z=0;}updateWalkPhysics(1/120);const feet=Player.position.y-Player.height;if(Player.onGround&&Math.abs(feet-b.y)<.02&&Math.abs(Player.position.x-b.x)<.95&&Math.abs(Player.position.z-b.z)<.95){landed=true;break;}if(feet<a.y-3)break;}
 if(landed)break;
 }if(!landed)fail.push(i);
 }
 return {count:nodes.length,fail,summit:nodes[FCCrownRun.summit].y};});console.log(results);assert.deepEqual(results.fail,[]);assert.ok(results.summit>98.9);
 const stateChecks=await p.evaluate(()=>{const api=FCCrownRun,ns=api.nodes;State.ui.paused=false;const stand=i=>{const n=ns[i];Player.position.set(n.x,n.y+Player.height,n.z);Player.velocity.set(0,0,0);Player.onGround=true;api.tick();};stand(0);const started=api.run?.index===0;stand(8);const noSkip=api.run?.index===0;stand(0);for(let i=1;i<=12;i++)stand(i);const checkpoint=api.run?.checkpoint===12;Player.position.y-=6;Player.onGround=false;api.tick();const recovered=api.run?.index===12&&api.run.falls===1&&Math.abs(Player.position.y-Player.height-ns[12].y)<.05;for(let i=13;i<ns.length;i++)stand(i);return {started,noSkip,checkpoint,recovered,finished:!api.run&&document.getElementById('crown-run-status').textContent.includes('complete')};});assert.ok(Object.values(stateChecks).every(Boolean),JSON.stringify(stateChecks));console.log('PASS progression, skipped-ledge rejection, checkpoint recovery and finish',stateChecks);
 await p.evaluate(()=>{State.ui.paused=false;Player.position.set(143,22,-43);Player.velocity.set(0,0,0);State.camera.position.copy(Player.position);State.camera.lookAt(165,48,-8);});await p.waitForTimeout(300);await p.screenshot({path:path.join(__dirname,'out/crown-run.png')});
}finally{await b.close();s.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
