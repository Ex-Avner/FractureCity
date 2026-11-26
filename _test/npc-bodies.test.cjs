// NPC bodies: people do not overlap, the player cannot walk through them, nobody drifts.
const {chromium}=require('playwright'),{serve,LAUNCH_ARGS}=require('./lib/harness'),path=require('path'),assert=require('node:assert/strict');
(async()=>{const site=await serve(path.resolve(__dirname,'..')),b=await chromium.launch({channel:'chrome',args:LAUNCH_ARGS});try{
 const p=await b.newPage({viewport:{width:1100,height:700}}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('ERR',e.message)});
 await p.goto(site.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.FCBodies&&window.OwnBlock,null,{timeout:120000});
 await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready&&State.chunkMap.size>10,null,{timeout:120000});
 await p.evaluate(()=>{HD.locked=true;HD.setTier('perf',true);Peace.on=true;State.dayTime=13*60;});
 await p.waitForTimeout(6000);
 const crowd=await p.evaluate(()=>{const s=FCBodies.stats,bs=FCBodies.bodies();let over=0;for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++)if(Math.hypot(bs[i].x-bs[j].x,bs[i].z-bs[j].z)<.55&&Math.abs(bs[i].y-bs[j].y)<1.2)over++;return{bodies:s.bodies,over,pushed:s.pushed};});
 console.log('crowd',JSON.stringify(crowd));assert.ok(crowd.bodies>=5,'people found');assert.equal(crowd.over,0,'nobody stands inside anybody');
 // Pile five people on one spot: they spread apart within a second, and not into walls.
 await p.evaluate(async()=>{for(let cx=0;cx<=4;cx++)for(let cz=4;cz<=8;cz++)if(!State.chunkMap.has(cx+','+cz))shBuildChunk(cx+','+cz);Player.mode='walk';Player.position.set(60,shSurfaceY(60,150,63)+Player.height,150);await new Promise(r=>setTimeout(r,1500));});
 const pile=await p.evaluate(async()=>{const bs=FCBodies.bodies();const p0=Player.position;const groups=[];
  for(const [c] of []){}
  // Build five fresh characters at one point, animated each frame like any system would.
  const rng=new RNG('pile');const chars=[];let x=0,z=0,y=0;search:for(let r=4;r<60;r+=2)for(let a=0;a<16;a++){const cx=p0.x+Math.cos(a)*r,cz=p0.z+Math.sin(a)*r,cy=shSurfaceY(cx,cz,p0.y+2);let ok=cy>0;for(let k=0;k<12&&ok;k++){const qx=cx+Math.cos(k*.52)*1.4,qz=cz+Math.sin(k*.52)*1.4;if(Math.abs(shSurfaceY(qx,qz,cy+1)-cy)>.1||blockedAt(qx,cy+.05,qz,.35,1.7))ok=false;}if(ok&&!blockedAt(cx,cy+.05,cz,.4,1.7)){x=cx;z=cz;y=cy;break search;}}
  if(!y)return{nospot:true};
  for(let i=0;i<5;i++){const c=shBuildCharacter(shPickArchetype(rng),rng,{});c.baseY=y;c.group.position.set(x,y,z);State.scene.add(c.group);chars.push(c);}
  window.__pile=chars;const t0=performance.now();await new Promise(r=>{const f=()=>{for(const c of chars){c.group.position.set(x,y,z);shAnimateCharacter(c,1/60,false,performance.now()/1000);}if(performance.now()-t0<1500)requestAnimationFrame(f);else r();};requestAnimationFrame(f);});
  const pos=FCBodies.bodies().filter(q=>chars.includes(q.char)).map(q=>[q.x,q.z]);if(pos.length!==5)return{spot:[x,y,z],p0:[p0.x,p0.y,p0.z],count:pos.length,near:FCBodies.bodies().filter(q=>Math.hypot(q.base[0]-x,q.base[1]-z)<3).map(q=>[q.base.map(v=>+(v-[x,z][0]).toFixed(3)),+(q.x-x).toFixed(2),+(q.z-z).toFixed(2)]),stats:FCBodies.stats};let min=9;for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)min=Math.min(min,Math.hypot(pos[i][0]-pos[j][0],pos[i][1]-pos[j][1]));
  const far=Math.max(...pos.map(q=>Math.hypot(q[0]-x,q[1]-z)));const walls=pos.filter(q=>blockedAt(q[0],y+.05,q[1],.2,1.6)).length;return{min:+min.toFixed(2),far:+far.toFixed(2),walls};});
 console.log('pile',JSON.stringify(pile));assert.ok(!pile.nospot,'found an open spot');assert.ok(pile.min>.5,'piled people spread apart');assert.ok(pile.far<=1.01,'within a metre of home');assert.equal(pile.walls,0,'not into walls');
 // Walk into one standing person: blocked.
 const bump=await p.evaluate(()=>{const c=__pile[0];for(const q of __pile.slice(1))q.group.removeFromParent();FCBodies.set(false);FCBodies.set(true);State.ui.paused=true;shAnimateCharacter(c,1/60,false,0);FCBodies.refresh();
  const v=c.group.getWorldPosition(new THREE.Vector3());Player.position.set(v.x-1.6,v.y+Player.height,v.z);Player.velocity.set(0,0,0);Player.yaw=-Math.PI/2;Player.onGround=true;Player.mode='walk';let min=9,inBodies=0;const x0=Player.position.x;
  for(let i=0;i<150;i++){shAnimateCharacter(c,1/60,false,i/60);FCBodies.refresh();if(FCBodies.bodies().some(q=>q.char===c))inBodies++;State.keys.clear();State.keys.add('w');updateWalkInput(1/60);updateWalkPhysics(1/60);const w=c.group.getWorldPosition(new THREE.Vector3());min=Math.min(min,Math.hypot(Player.position.x-w.x,Player.position.z-w.z));}State.keys.clear();State.ui.paused=false;
  const w=c.group.getWorldPosition(new THREE.Vector3());return{gap:+Math.hypot(Player.position.x-w.x,Player.position.z-w.z).toFixed(2),passed:Player.position.x>w.x,min:+min.toFixed(2),inBodies,moved:+(Player.position.x-x0).toFixed(2)};});
 console.log('bump',JSON.stringify(bump));assert.ok(bump.moved>.5,'the player walked');assert.ok(!bump.passed&&bump.min>.6,'cannot walk through a person');
 // Nobody drifts: a person no one touches stays where their system put them.
 const drift=await p.evaluate(async()=>{const c=__pile[0];Player.position.x-=6;const v0=c.group.getWorldPosition(new THREE.Vector3());await new Promise(r=>{let n=0;const f=()=>{shAnimateCharacter(c,1/60,false,n/60);if(++n<240)requestAnimationFrame(f);else r();};requestAnimationFrame(f);});const v1=c.group.getWorldPosition(new THREE.Vector3());c.group.removeFromParent();return +v0.distanceTo(v1).toFixed(3);});
 console.log('drift',drift);assert.ok(drift<1.01,'settles home, no runaway');
 // Cost of the pass with the city crowd.
 await p.waitForTimeout(1500);const ms=await p.evaluate(()=>FCBodies.stats.ms);
 console.log('pass ms',ms.toFixed(3));
 assert.deepEqual(errors,[]);console.log('PASS npc bodies: no overlaps, piles spread, bump blocks, no drift');
}finally{await b.close();site.close()}})().catch(e=>{console.error(e);process.exitCode=1});
