// Mount Oredor: the ascent from trailhead to summit, checked on the real voxels.
// Physics is stepped by hand (walk input + walk physics) so results do not depend
// on how fast this machine renders. Screenshots land in _test/out/oredor-*.png.
const {chromium}=require('playwright'),{serve,LAUNCH_ARGS}=require('./lib/harness'),path=require('path'),fs=require('fs'),assert=require('node:assert/strict');
const out=n=>path.join(__dirname,'out',n),SHOTS=!process.env.NO_SHOTS;
(async()=>{fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});const site=await serve(path.resolve(__dirname,'..')),browser=await chromium.launch({channel:'chrome',args:LAUNCH_ARGS});try{
 const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER',e.message)});p.on('console',m=>{if(/oredor/i.test(m.text()))console.log('CONSOLE',m.text())});
 await p.goto(site.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.FCOredor?.ascent&&window.OwnBlock,null,{timeout:120000});
 await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready&&State.chunkMap.size>10,null,{timeout:120000});
 await p.evaluate(()=>{Peace.on=false;HD.locked=true;HD.setTier('perf',true);FCResident?.setView?.(false);State.ui.paused=false;State.dayTime=13*60;FCOredor.ascent.debug.reset();});
 const A='FCOredor.ascent';
 const pass=m=>console.log('PASS',m);

 // 1 · The grid: built, nothing on the trail raised by the pit fill, cairns placed.
 const g=await p.evaluate(()=>{const G=FCOredor.ascent.debug.grid;return{ms:G.ms,raised:G.raised,cairns:G.cairns,claims:[FCOredor.claims(0,12),FCOredor.claims(-6,29),FCOredor.claims(6,12),FCOredor.claims(0,11)],expanse:FCExpanse.region(0,12*1)};});
 console.log('grid',JSON.stringify(g));assert.equal(g.raised,0,'pit fill left the trail alone');assert.deepEqual(g.claims,[true,true,false,false]);assert.equal(g.expanse,null,'Outer Expanse yields the zone');pass('grid '+g.ms+' ms, '+g.cairns+' cairns');

 // 2 · Every metre of trail is walkable on the built voxels: no rise over one block, headroom everywhere.
 const walk=await p.evaluate(()=>{const R=FCOredor.ascent.route,bad=[];let n=0;
  for(let i=0;i<R.length-1;i++){const a=R[i],b=R[i+1];if(a[3]==='rope')continue;const toRope=b[3]==='rope';const L=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(L/.5));let prev=null;
   for(let k=0;k<=steps-(toRope?2:0);k++){const t=k/steps,x=a[0]+(b[0]-a[0])*t+.5,z=a[1]+(b[1]-a[1])*t+.5;for(let cx=Math.floor((x-30)/24);cx<=Math.floor((x+30)/24);cx++)for(let cz=Math.floor((z-30)/24);cz<=Math.floor((z+30)/24);cz++)if(!State.chunkMap.has(cx+','+cz))shBuildChunk(cx+','+cz);
    let s=0;for(const [ox,oz] of [[0,0],[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]])s=Math.max(s,shSurfaceY(x+ox,z+oz,63));n++;if(prev!=null&&s-prev>1.01)bad.push([i,x.toFixed(1),z.toFixed(1),prev,s]);if(blockedAt(x,s+.02,z,.3,1.7))bad.push(['blocked',i,x.toFixed(1),z.toFixed(1),s]);prev=s;}}
  return{n,bad:bad.slice(0,12),count:bad.length};});
 console.log('trail',JSON.stringify(walk));assert.equal(walk.count,0,'trail walkable');pass('trail walkable, '+walk.n+' samples');

 // Helpers for hand-stepped movement.
 const place=(x,y,z,yaw)=>p.evaluate(([x,y,z,yaw])=>{for(let cx=Math.floor((x-60)/24);cx<=Math.floor((x+60)/24);cx++)for(let cz=Math.floor((z-60)/24);cz<=Math.floor((z+60)/24);cz++)if(!State.chunkMap.has(cx+','+cz))shBuildChunk(cx+','+cz);Player.mode='walk';Player.position.set(x,y+Player.height+.02,z);Player.velocity.set(0,0,0);Player.yaw=yaw;Player.onGround=true;State.keys.clear();},[x,y,z,yaw]);
 const step=(keys,frames)=>p.evaluate(([keys,frames])=>{State.ui.paused=true;State.keys.clear();for(const k of keys)State.keys.add(k);for(let i=0;i<frames;i++){updateWalkInput(1/60);updateWalkPhysics(1/60);}State.keys.clear();const f=Player.position.y-Player.height;return{x:+Player.position.x.toFixed(2),f:+f.toFixed(2),z:+Player.position.z.toFixed(2),g:Player.onGround,rope:!!FCOredor.ascent.debug.rope};},[keys,frames]);

 // 2b · Guidance: the beacon from the city, the chip, the lit trail, the painted peak never underfoot.
 const guide=await p.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));State.ui.paused=false;for(let cx=0;cx<=3;cx++)for(let cz=4;cz<=7;cz++)if(!State.chunkMap.has(cx+','+cz))shBuildChunk(cx+','+cz);Player.position.set(60,shSurfaceY(60,150,63)+Player.height,150);await w(900);
  const city={beacon:State.scene.getObjectByName('oredor-beacon').visible,chip:document.getElementById('oredor-alt').textContent,hidden:document.getElementById('oredor-alt').hidden};
  Player.position.set(-30.5,22+Player.height,404.5);await w(900);const slope=document.getElementById('oredor-alt').textContent;
  const G=FCOredor.ascent.debug.grid;let lit=0;for(let x=-144;x<144;x++)for(let z=288;z<720;z++)if(getBlock(x,G.SURF[G.gi(x,z)]-1,z)===195&&G.KIND[G.gi(x,z)]===1)lit++;
  Player.position.set(150,2+Player.height,900);await w(900);const footHidden=!FCOredor.mesh.visible;Player.position.set(165,2.7+Player.height,24);await w(600);const cityPeak=FCOredor.mesh.visible;
  return{city,slope,lit,footHidden,cityPeak};});
 console.log('guide',JSON.stringify(guide));assert.ok(guide.city.beacon&&!guide.city.hidden&&/TRAILHEAD/.test(guide.city.chip),'beacon and chip from the city');assert.ok(/CAMP I\b/.test(guide.slope),'chip points to Camp I '+guide.slope);assert.ok(guide.footHidden&&guide.cityPeak,'painted peak hides at its foot, shows from the city');pass('guidance: beacon, chip, painted peak');

 // 3 · The first rope: you cannot jump it, you climb it by hand.
 const R1=await p.evaluate(()=>FCOredor.ascent.ropes[0]);
 await place(R1.x+.5,R1.y0,R1.face-1.6,Math.PI);
 let r=await step([' '],40);assert.ok(r.f<R1.y0+2,'a jump does not clear the face '+JSON.stringify(r));
 r=await step(['w'],30);assert.ok(r.rope,'on the rope '+JSON.stringify(r));
 r=await step(['w'],260);assert.ok(r.f>=R1.y1-.05&&r.z>R1.face,'topped out '+JSON.stringify(r));pass('rope one climbed to '+r.f);
 // Double jump is off on the mountain.
 await place(R1.x+.5,R1.y1,R1.face+3,Math.PI);
 const dj=await p.evaluate(()=>{State.ui.paused=true;State.keys.clear();Player.onGround=true;updateWalkInput(1/60);State.keys.add(' ');updateWalkInput(1/60);State.keys.delete(' ');for(let i=0;i<14;i++){updateWalkInput(1/60);updateWalkPhysics(1/60);}const vy0=Player.velocity.y;State.keys.add(' ');updateWalkInput(1/60);const vy1=Player.velocity.y;State.keys.clear();return{vy0,vy1};});
 assert.ok(dj.vy1<=dj.vy0+.01,'no second jump on the mountain '+JSON.stringify(dj));pass('double jump off');

 // 4 · The second rope.
 const R2=await p.evaluate(()=>FCOredor.ascent.ropes[1]);
 await place(R2.x+.5,R2.y0,R2.face-1.6,Math.PI);r=await step(['w'],300);assert.ok(r.f>=R2.y1-.05&&r.z>R2.face,'rope two '+JSON.stringify(r));pass('rope two climbed');

 // 5 · Posted fears appear on the lower slopes and stay out when quelled.
 const F0=await p.evaluate(()=>FCOredor.ascent.fears[0]);
 await p.evaluate(([x,z])=>{State.ui.paused=false;const s=FCOredor.ascent.surfAt(x,z);Player.position.set(x+3,s+Player.height+3,z+3);},F0);
 await p.waitForFunction(()=>FCOredor.ascent.live.size>0,null,{timeout:20000});
 const fear=await p.evaluate(()=>{const e=[...FCOredor.ascent.live.values()][0];const y0=e.position.y;return{type:e.type,y:y0,ground:shSurfaceY(e.position.x,e.position.z,y0+1.3),inEnemies:State.enemies.includes(e)};});
 assert.equal(fear.type,'posted-fear');assert.ok(fear.inEnemies&&Math.abs(fear.y-fear.ground)<1.3,JSON.stringify(fear));
 if(SHOTS){await p.evaluate(()=>{const e=[...FCOredor.ascent.live.values()][0];State.ui.paused=true;State.camera.position.set(e.position.x+4,e.position.y+2.4,e.position.z+4);State.camera.lookAt(e.position.x,e.position.y+1.6,e.position.z);});await p.waitForTimeout(2500);await p.screenshot({path:out('oredor-fear.png')});await p.evaluate(()=>{State.ui.paused=false});}
 await p.evaluate(()=>{const e=[...FCOredor.ascent.live.values()][0];e.takeDamage(999);});
 await p.waitForTimeout(600);
 assert.deepEqual(await p.evaluate(()=>FCOredor.ascent.state.quelled),[0]);pass('fear spawned on its ground, quelled and recorded');

 // 6 · Camps record, the stake offers the highest one.
 await p.evaluate(()=>{State.ui.paused=false;FCOredor.ascent.debug.goto(1);});await p.waitForTimeout(800);
 assert.equal(await p.evaluate(()=>FCOredor.ascent.state.camp),1);
 await p.evaluate(()=>FCOredor.ascent.debug.goto(2));await p.waitForTimeout(800);assert.equal(await p.evaluate(()=>FCOredor.ascent.state.camp),2);
 await p.evaluate(()=>{Player.position.set(3,3+Player.height,318.5);});await p.waitForTimeout(500);
 const stake=await p.evaluate(()=>FCOredor.ascent.near);assert.equal(stake?.id,'clip',JSON.stringify(stake));
 await p.evaluate(()=>FCOredor.ascent.debug.use());await p.waitForTimeout(1500);
 const at=await p.evaluate(()=>Player.position.y-Player.height);assert.ok(Math.abs(at-46)<1.2,'clipped up to camp II '+at);pass('camps and the stake');

 // 7 · The ridge: wind pushes, the fixed line catches a fall.
 await p.evaluate(()=>{Player.position.set(10.5,55+Player.height,545);Player.velocity.set(0,0,0);});await p.waitForTimeout(500);
 assert.equal(await p.evaluate(()=>FCOredor.ascent.debug.onRidge),true);
 await p.evaluate(()=>{const s=shSurfaceY(18.5,545,60);Player.position.set(18.5,s+Player.height,545);Player.velocity.set(0,0,0);});await p.waitForTimeout(1600);
 const caught=await p.evaluate(()=>({f:Player.position.y-Player.height,x:Player.position.x,z:Player.position.z}));assert.ok(caught.f>54,'caught back onto the ridge '+JSON.stringify(caught));pass('ridge catch');

 // 8 · The summit: the shard, Sight, the way down.
 await p.evaluate(()=>{FCOredor.ascent.debug.goto(3);});await p.waitForTimeout(600);
 await p.evaluate(()=>{Player.position.set(8.5+1.2,61+Player.height,606.5);});await p.waitForTimeout(500);
 assert.equal((await p.evaluate(()=>FCOredor.ascent.near))?.id,'take');
 if(SHOTS){await p.evaluate(()=>{State.ui.paused=true;State.camera.position.set(12,63.4,600);State.camera.lookAt(8.5,63,606.5);});await p.waitForTimeout(2500);await p.screenshot({path:out('oredor-summit.png')});await p.evaluate(()=>{State.ui.paused=false});}
 let heard=false;await p.exposeFunction('__heard',()=>{heard=true});await p.evaluate(()=>window.addEventListener('fc-oredor-sight',()=>__heard()));
 await p.keyboard.press('KeyE');await p.waitForTimeout(6500);
 const sum=await p.evaluate(()=>({sight:FCOredor.sight,state:FCOredor.ascent.state,near:FCOredor.ascent.near?.id}));
 assert.equal(await p.evaluate(()=>{let v=[];State.scene.getObjectByName('oredor-props').traverse(o=>{if(o.isMesh&&/Ring|Octa/.test(o.geometry.type))v.push(o.visible)});return v.every(x=>x===false)}),true,'shard and halo gone');
 assert.ok(sum.sight&&sum.state.sight&&sum.state.camp===3&&heard,JSON.stringify(sum));assert.equal(sum.near,'descend');pass('Sight earned');
 const kept=await p.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('fc-oredor-v1:'));return JSON.parse(localStorage.getItem(k));});assert.equal(kept.sight,true);
 if(SHOTS){await p.evaluate(()=>{FCOredor.ascent.debug.goto(1);State.ui.paused=false});await p.waitForTimeout(1500);await p.evaluate(()=>{State.ui.paused=true;State.camera.position.set(-24,26.5,424);State.camera.lookAt(-25.5,25.5,419.5);});await p.waitForTimeout(2500);await p.screenshot({path:out('oredor-sight-busstop.png')});await p.evaluate(()=>{State.ui.paused=false});}
 await p.evaluate(()=>FCOredor.ascent.debug.goto(3));await p.waitForTimeout(400);await p.evaluate(()=>FCOredor.ascent.debug.use());await p.waitForTimeout(1500);
 assert.ok(await p.evaluate(()=>Math.abs(Player.position.y-Player.height-3)<1&&Player.position.z<320),'descended to the trailhead');pass('descent');

 // 9 · Views. Cameras placed by hand; the HUD is part of the picture.
 if(SHOTS){const views=[['oredor-approach.png',[0,4,262],[0,40,600],-1,13],['oredor-from-city.png',[165,4,24],[0,60,600],-1,13],['oredor-trail-lit.png',[-40,13,350],[0,12,330],-1,19.5],['oredor-basecamp.png',[6,6,296],[0,6,330],-1,13],['oredor-slopes.png',[50,22,370],[-20,14,400],-1,13],['oredor-rope.png',[38,33,440],[35.5,34,446],-1,13],['oredor-whiteout.png',[-20,47.8,495],[10,50,520],46.2,13],['oredor-above.png',[10,57.6,540],[8,58,600],55.5,13],['oredor-summit-down.png',[8,63.6,608],[-10,40,480],61,17.5],['oredor-night-slopes.png',[50,22,370],[-20,14,400],-1,22]];
  for(const [name,eye,look,fy,hour] of views){await p.evaluate(([eye,look,fy,hour])=>{State.dayTime=hour*60;Player.position.set(eye[0],(fy>0?fy:eye[1]-1.6)+Player.height,eye[2]);for(let cx=Math.floor((eye[0]-80)/24);cx<=Math.floor((eye[0]+80)/24);cx++)for(let cz=Math.floor((eye[2]-80)/24);cz<=Math.floor((eye[2]+80)/24);cz++)if(!State.chunkMap.has(cx+','+cz))shBuildChunk(cx+','+cz);State.ui.paused=false;},[eye,look,fy,hour]);await p.waitForTimeout(1200);
   await p.evaluate(([eye,look])=>{State.ui.paused=true;State.camera.up.set(0,1,0);State.camera.position.set(...eye);State.camera.lookAt(...look);},[eye,look]);await p.waitForTimeout(2600);await p.screenshot({path:out(name)});}
  await p.evaluate(()=>{State.ui.paused=false;State.dayTime=13*60});}
 assert.deepEqual(errors,[],'no page errors');pass('no page errors');
 console.log('\nMount Oredor: all checks passed');
}finally{await browser.close();site.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
