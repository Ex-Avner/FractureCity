/* Real-browser acceptance for the optional Common Ground directory. This uses
 * the shipped collision field and updateWalkPhysics, not a pathfinding mock. */
const {chromium}=require('playwright');
const {serve}=require('./lib/harness');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const site=await serve(root),browser=await chromium.launch({channel:'chrome'}),errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:960}}),p=await context.newPage();
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(site.origin+'/apps/fracture-city-game/index.html');
  await p.waitForFunction(()=>window.OwnBlock&&window.FCCommonGroundMega);
  assert.equal(await p.evaluate(()=>!!window.FCCommonGroundGuide),true,'guide must be included in the actual game entrypoint');
  await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.dayTime=780;Player.pitch=.08;State.ui.paused=false;closeMenu()});
  await p.waitForFunction(()=>OwnBlock.ready&&FCCommonGroundMega.root);
  await p.waitForTimeout(1600);
  await p.evaluate(()=>{Player.position.set(167,Player.height+1,24);Player.velocity.set(0,0,0);FCCommonGroundGuide.update()});
  assert.equal(await p.locator('#cg-directory').count(),0,'arrival must not force a modal');
  assert.equal(await p.locator('#cg-directory-launch').isVisible(),true);
  assert.equal(await p.evaluate(()=>FCCommonGroundGuide.selection),null);
  assert.equal(await p.evaluate(()=>blockedAt(167,1,24,Player.radius,Player.height)),false);
  console.log('PASS fresh arrival is clear, playable, and offers an optional directory.');

  await p.locator('#cg-directory-launch').focus();
  await p.keyboard.press('l');
  await p.locator('#cg-directory').waitFor();
  assert.equal(await p.evaluate(()=>State.ui.paused),true);
  assert.equal(await p.locator('#cg-directory').getAttribute('aria-modal'),'true');
  assert.equal(await p.locator('#cg-directory [data-destination]').count(),6);
  assert.equal(await p.evaluate(()=>document.activeElement?.dataset.destination),'read');
  const buttons=await p.locator('#cg-directory button').count();
  for(let i=0;i<buttons+2;i++){
   await p.keyboard.press('Tab');
   assert.equal(await p.evaluate(()=>!!document.activeElement?.closest('#cg-directory')),true,'Tab stays inside directory');
  }
  await p.keyboard.press('Shift+Tab');
  assert.equal(await p.evaluate(()=>!!document.activeElement?.closest('#cg-directory')),true);
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('#cg-directory').count(),0);
  assert.equal(await p.evaluate(()=>State.ui.paused),false);
  assert.equal(await p.evaluate(()=>document.activeElement?.id),'cg-directory-launch');
  const paused=await p.evaluate(()=>{State.ui.paused=true;const opened=FCCommonGroundGuide.open(),kept=State.ui.paused;State.ui.paused=false;return{opened,kept}});
  assert.deepEqual(paused,{opened:false,kept:true});
  console.log('PASS keyboard opening, focus trap, Escape, focus return and pause preservation.');

  // Clicks inside the directory must never reach the game's document handlers.
  await p.evaluate(()=>{window.guideClickLeaks=0;document.addEventListener('click',()=>window.guideClickLeaks++)});
  await p.locator('#cg-directory-launch').click();
  await p.locator('[data-destination="read"]').click();
  assert.equal(await p.evaluate(()=>window.guideClickLeaks),0);
  assert.equal(await p.evaluate(()=>FCCommonGroundGuide.selection),'read');
  await p.waitForTimeout(200);
  const markers=await p.evaluate(()=>{
   const next=FCCommonGroundGuide.goal().p,marker=State.scene.children.find(o=>o.children?.some(c=>c.geometry?.type==='TorusGeometry'&&c.geometry.parameters.radius===1.15));
   shMapBuild();const circles=[],arc=MAP.ctx.arc;MAP.ctx.arc=function(x,y,r,...rest){if(r===3.2)circles.push([x,y]);return arc.call(this,x,y,r,...rest)};
   try{shMapDraw()}finally{MAP.ctx.arc=arc}
   return{world:marker?.position.toArray(),expected:[next[0],next[1]+.08,next[2]],map:circles,expectedMap:[MAP.size/2+(next[0]-Player.position.x)*MAP.size/MAP.span,MAP.size/2+(next[2]-Player.position.z)*MAP.size/MAP.span]};
  });
  assert.deepEqual(markers.world,markers.expected,'world marker points to the actual next turn');
  assert.ok(markers.map.some(p=>Math.hypot(p[0]-markers.expectedMap[0],p[1]-markers.expectedMap[1])<.001),'minimap points to the same walking turn');
  assert.equal(await p.evaluate(()=>State.ui.paused),false);
  await p.waitForFunction(()=>!document.getElementById('cg-walk-guide').hidden);
  assert.match(await p.locator('#cg-walk-guide').innerText(),/Reading garden/);
  await p.locator('#cg-walk-guide button').click();
  assert.equal(await p.evaluate(()=>FCCommonGroundGuide.selection),null);
  console.log('PASS mouse selection starts directions, isolates game clicks and can be cancelled.');

  const walks=await p.evaluate(()=>{
   const guide=FCCommonGroundGuide,results=[];
   function traverse(id,start){
    State.ui.paused=false;guide.cancel();Player.position.set(start[0],start[1]+Player.height,start[2]);Player.velocity.set(0,0,0);Player.onGround=true;guide.update();
    if(!guide.select(id))return{id,error:'No route from '+start.join(',')};
    const points=guide.path,destination=guide.destinations.find(d=>d.id===id),visited=[];
    State.ui.paused=true;
    for(const target of points.slice(1)){
     let still=0,steps=0,last=[Player.position.x,Player.position.z];
     const limit=Math.ceil(Math.hypot(target[0]-Player.position.x,target[2]-Player.position.z)*60/2.25)+220;
     while(Math.hypot(target[0]-Player.position.x,target[2]-Player.position.z)>.09&&steps++<limit){
      const dx=target[0]-Player.position.x,dz=target[2]-Player.position.z,d=Math.hypot(dx,dz),v=Math.min(2.25,d*60);
      Player.velocity.x=dx/d*v;Player.velocity.z=dz/d*v;Player.velocity.y-=22/60;updateWalkPhysics(1/60);
      still=Math.hypot(Player.position.x-last[0],Player.position.z-last[1])<.0001?still+1:0;last=[Player.position.x,Player.position.z];
      if(still>60)return{id,error:'Blocked during real walking',target,position:Player.position.toArray(),points};
     }
     if(steps>=limit)return{id,error:'Route waypoint timed out',target,position:Player.position.toArray(),points};
     visited.push([Player.position.x,Player.position.y-Player.height,Player.position.z]);
    }
    for(let i=0;i<60;i++){Player.velocity.x=0;Player.velocity.z=0;Player.velocity.y-=22/60;updateWalkPhysics(1/60)}
    State.ui.paused=false;guide.update();
    return{id,start,points,visited,end:[Player.position.x,Player.position.y-Player.height,Player.position.z],expected:destination.at,status:guide.status};
   }
   for(const d of guide.destinations)results.push(traverse(d.id,[167,1,24]));
   // The gallery route must also work when leaving the Reading Wall, and
   // leaving the overlook must actually descend the whole stair.
   results.push(traverse('gallery',[167,1,35.6]));
   results.push(traverse('read',[143,7,52]));
   guide.cancel();Player.position.set(167,Player.height+1,24);Player.velocity.set(0,0,0);State.ui.paused=false;guide.update();return results;
  });
  for(const walk of walks){
   assert.ok(!walk.error,JSON.stringify(walk));
   assert.ok(Math.hypot(walk.end[0]-walk.expected[0],walk.end[2]-walk.expected[2])<.2,JSON.stringify(walk));
   assert.ok(Math.abs(walk.end[1]-walk.expected[1])<.04,JSON.stringify(walk));
   assert.equal(walk.status,'arrived',JSON.stringify(walk));
  }
  const gallery=walks.find(w=>w.id==='gallery');
  assert.ok(gallery.points.length>2,'gallery must route around the Reading Wall, not through it');
  const overlook=walks.find(w=>w.id==='overlook');
  assert.ok(overlook.points.filter(p=>p[1]>1&&p[1]<7).length>=8,'overlook route includes explicit stair waypoints');
  console.log('PASS actual walking physics reaches all six destinations, routes around the wall and climbs/descends the overlook.',walks.map(w=>({id:w.id,from:w.start,end:w.end,waypoints:w.points.length})));

  // Follow the changing live waypoint, including its early-turn advancement.
  // Traversing a frozen route alone cannot catch corner cutting in the HUD.
  const liveWalks=await p.evaluate(()=>{
   const results=[];
   for(const [id,start] of [['gallery',[167,1,24]],['overlook',[167,1,24]],['read',[143,7,52]]]){
    FCCommonGroundGuide.cancel();State.ui.paused=false;Player.position.set(start[0],start[1]+Player.height,start[2]);Player.velocity.set(0,0,0);Player.onGround=true;FCCommonGroundGuide.update();
    const ok=FCCommonGroundGuide.select(id);let still=0,frames=0,prior=Player.position.clone();const base=performance.now();
    while(ok&&FCCommonGroundGuide.status!=='arrived'&&frames++<3600){
     const g=FCCommonGroundGuide.goal();if(!g)break;const dx=g.p[0]-Player.position.x,dz=g.p[2]-Player.position.z,d=Math.hypot(dx,dz),v=Math.min(2.25,d*60);
     Player.velocity.x=d?dx/d*v:0;Player.velocity.z=d?dz/d*v:0;Player.velocity.y-=22/60;updateWalkPhysics(1/60);FCCommonGroundGuide.update(base+frames*1000/60);
     still=Player.position.distanceTo(prior)<.0001?still+1:0;prior.copy(Player.position);if(still>90)break;
    }
    results.push({id,ok,frames,status:FCCommonGroundGuide.status,position:Player.position.toArray(),goal:FCCommonGroundGuide.goal()});
   }
   FCCommonGroundGuide.cancel();Player.position.set(167,Player.height+1,24);Player.velocity.set(0,0,0);return results;
  });
  for(const row of liveWalks)assert.equal(row.status,'arrived',JSON.stringify(row));
  console.log('PASS live turn-by-turn updates reach the gallery and overlook and return downstairs without cutting corners.');

  await p.evaluate(()=>{State.ui.paused=false;FCCommonGroundGuide.select('read');FCReadingGarden.open();FCCommonGroundGuide.update()});
  assert.equal(await p.locator('#cg-directory-launch').isVisible(),false);
  assert.equal(await p.locator('#cg-walk-guide').isVisible(),false);
  await p.keyboard.press('l');
  assert.equal(await p.locator('#cg-directory').count(),0);
  assert.equal(await p.evaluate(()=>FCReadingGarden.isOpen),true);
  await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(()=>State.ui.paused),false);
  await p.evaluate(()=>{FCCommonGroundGuide.cancel();FCCommonGroundGuide.update()});
  console.log('PASS reading panels suppress the directory and guidance without stealing keyboard focus.');

  await p.locator('#cg-directory-launch').click();
  const closedRoute=await p.evaluate(()=>{
   const chunk=State.chunkMap.get('6,1'),barrier={minX:165,maxX:169,minZ:22,maxZ:26,minY:1,maxY:5};chunk.collisionAABBs.push(barrier);
   try {return{route:FCCommonGroundGuide.route('read'),selected:FCCommonGroundGuide.select('read'),open:FCCommonGroundGuide.isOpen,selection:FCCommonGroundGuide.selection,status:document.querySelector('#cg-directory [role=status]')?.textContent}}
   finally{chunk.collisionAABBs.splice(chunk.collisionAABBs.indexOf(barrier),1)}
  });
  assert.equal(closedRoute.route,null);assert.equal(closedRoute.selected,false);assert.equal(closedRoute.open,true);assert.equal(closedRoute.selection,null);assert.match(closedRoute.status,/clear walking route/);
  await p.keyboard.press('Escape');
  const changedRoute=await p.evaluate(()=>{
   FCCommonGroundGuide.select('read');const chunk=State.chunkMap.get('6,1'),barrier={minX:165,maxX:169,minZ:22,maxZ:26,minY:1,maxY:5};chunk.collisionAABBs.push(barrier);
   try {FCCommonGroundGuide.update(performance.now()+3000);return{status:FCCommonGroundGuide.status,goal:FCCommonGroundGuide.goal(),message:document.querySelector('#cg-walk-guide small').textContent}}
   finally{chunk.collisionAABBs.splice(chunk.collisionAABBs.indexOf(barrier),1);FCCommonGroundGuide.cancel()}
  });
  assert.equal(changedRoute.status,'blocked');assert.equal(changedRoute.goal,null);assert.match(changedRoute.message,/path changed/);
  const upperObstruction=await p.evaluate(()=>{
   Player.position.set(144.2,7+Player.height,52);Player.velocity.set(0,0,0);State.ui.paused=false;FCCommonGroundGuide.update();FCCommonGroundGuide.select('read');
   const chunk=State.chunkMap.get('5,2'),barrier={minX:140,maxX:146,minZ:49,maxZ:51,minY:7,maxY:10};chunk.collisionAABBs.push(barrier);
   try{FCCommonGroundGuide.update(performance.now()+3000);return{status:FCCommonGroundGuide.status,goal:FCCommonGroundGuide.goal()}}
   finally{chunk.collisionAABBs.splice(chunk.collisionAABBs.indexOf(barrier),1);FCCommonGroundGuide.cancel();Player.position.set(167,Player.height+1,24);FCCommonGroundGuide.update()}
  });
  assert.equal(upperObstruction.status,'blocked');assert.equal(upperObstruction.goal,null);
  console.log('PASS blocked ground and upper-deck routes fail gracefully without directing through a wall.');

  const regeneration=await p.evaluate(()=>{
   shDestroyChunk('6,1');shBuildChunk('6,1');FCCommonGroundGuide.update();shDestroyChunk('6,1');shBuildChunk('6,1');FCCommonGroundGuide.update();
   FCCommonGroundGuide.select('read');const original=State.scene;State.scene=new THREE.Scene();FCCommonGroundGuide.update();const selection=FCCommonGroundGuide.selection;State.scene=original;FCCommonGroundGuide.update();
   return{launch:document.querySelectorAll('#cg-directory-launch').length,hud:document.querySelectorAll('#cg-walk-guide').length,selection,route:FCCommonGroundGuide.route('gallery')};
  });
  assert.equal(regeneration.launch,1);assert.equal(regeneration.hud,1);assert.equal(regeneration.selection,null);assert.ok(regeneration.route?.length>2);
  console.log('PASS chunk regeneration preserves routes without duplicate UI; scene changes clear stale navigation.');

  await p.setViewportSize({width:390,height:844});
  await p.evaluate(()=>{State.ui.paused=false;Player.position.set(167,Player.height+1,24);FCCommonGroundGuide.update()});
  await p.locator('#cg-directory-launch').click();
  const mobile=await p.evaluate(()=>{const card=document.querySelector('.cg-directory-card'),r=card.getBoundingClientRect(),buttons=[...card.querySelectorAll('button')];return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,scrollable:card.scrollHeight>card.clientHeight,buttonHeights:buttons.filter(b=>b.dataset.destination).map(b=>b.getBoundingClientRect().height),horizontalOverflow:card.scrollWidth>card.clientWidth}});
  assert.ok(mobile.left>=0&&mobile.right<=mobile.width&&mobile.top>=0&&mobile.bottom<=mobile.height,JSON.stringify(mobile));assert.equal(mobile.horizontalOverflow,false);assert.ok(mobile.buttonHeights.every(h=>h>=44));
  await p.locator('[data-destination="theory"]').click();
  await p.waitForFunction(()=>!document.getElementById('cg-walk-guide').hidden);
  const hudFit=await p.locator('#cg-walk-guide').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight});assert.equal(hudFit,true);
  fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});await p.screenshot({path:path.join(__dirname,'out/common-ground-guide-mobile.png')});
  console.log('PASS 390px directory scrolls, controls remain touch-sized and walking HUD fits.');

  // Legacy news and tour navigation must point to the actual relocated boards.
  const news=fs.readFileSync(path.join(root,'apps/fracture-city-game/news-hub.js'),'utf8'),tour=fs.readFileSync(path.join(root,'apps/fracture-city-game/online-tour.js'),'utf8');
  assert.doesNotMatch(news,/p:\[148\+slot\*5,1,33\]/);
  assert.doesNotMatch(tour,/p=\[148\+slot\*5,1,41\]/);
  assert.match(news,/148\+slot\*5,1,62/);assert.match(tour,/148\+slot\*5,1,62/);
  console.log('PASS legacy news/tour gallery coordinates match the relocated z65 boards (source regression).');
  assert.deepEqual(errors,[]);console.log('PASS no browser exceptions.');
 } finally {await browser.close();site.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
