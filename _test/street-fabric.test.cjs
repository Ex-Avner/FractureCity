// Street fabric, window panes and the phone sheet.  node _test/street-fabric.test.cjs
const {chromium,devices}=require('playwright'),{serve}=require('./lib/harness'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const site=await serve(path.resolve(__dirname,'..')),browser=await chromium.launch({channel:'chrome'});
 const boot=async p=>{await p.goto(site.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.OwnBlock);await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready&&State.chunkMap.size>10,null,{timeout:180000});};
 try{
  const p=await browser.newPage({viewport:{width:960,height:540}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await boot(p);
  const r=await p.evaluate(async()=>{
   HD.locked=true;HD.setTier('perf',true);Peace.on=true;State.ui.paused=false;Player.position.set(196,3.2,196);
   for(let x=6;x<=9;x++)for(let z=6;z<=9;z++)if(!State.chunkMap.has(x+','+z))shBuildChunk(x+','+z);
   await new Promise(r=>setTimeout(r,2500));
   const city=[...State.chunkMap.values()].filter(c=>c.fabric&&c.fabric.items.some(i=>i.kind==='signal'));
   const c=city[0],f=c.fabric,out={cityChunks:city.length,count:FCStreetFabric.count(),panes:FCWindowPanes.patched};
   out.meshes=Math.max(...city.map(c=>c.fabric.root.children.length));
   out.lights=city.some(c=>{let n=0;c.fabric.root.traverse(o=>{if(o.isLight)n++});return n>0});
   out.tris=Math.max(...city.map(c=>c.fabric.tris));
   // No block-wide paint stripe survives in a generated street.
   out.paint=0;for(const ch of city)for(let x=0;x<VOX_W;x++)for(let z=0;z<VOX_W;z++)if(ch.vGet(x,0,z)===B_PAINT)out.paint++;
   // Every solid item stands on a solid block with air above it, and nothing stands in a doorway hotspot.
   out.floating=0;out.inDoor=0;for(const ch of city)for(const it of ch.fabric.items){if(!it.on)continue;const k=it.cell;if(!isSolid(getBlock(k[0],k[1],k[2]))||getBlock(k[0],k[1]+1,k[2])!==B_AIR)out.floating++;
    if(it.collider&&typeof SH_HOTSPOTS!=='undefined'&&SH_HOTSPOTS.some(h=>h.x>it.collider.minX-1&&h.x<it.collider.maxX+1&&h.z>it.collider.minZ-1&&h.z<it.collider.maxZ+1))out.inDoor++}
   // Deterministic: the same chunk plans the same street twice.
   const sig=ch=>FCStreetFabric.plan(ch).map(i=>i.kind+i.cell.join(',')).join('|');out.same=sig(c)===sig(c);
   // The pavement keeps a walkable strip: no collider reaches more than 1.3 m in from the kerb, except the shelter.
   out.wide=0;for(const ch of city)for(const it of ch.fabric.items){if(!it.on||!it.collider||it.cell[1]!==1||it.kind==='shelter')continue;const a=it.collider,cheb=Math.max(Math.abs((a.minX+a.maxX)/2-ch.worldX),Math.abs((a.minZ+a.maxZ)/2-ch.worldZ)),thin=Math.min(a.maxX-a.minX,a.maxZ-a.minZ)/2;if(7-cheb+thin>1.3)out.wide++}
   // Mining the paving under a tree removes the tree and its collider.
   const tree=f.items.find(i=>i.kind==='tree'&&i.on);out.hadTree=!!tree;
   if(tree){const before=c.collisionAABBs.includes(tree.collider);setBlock(tree.cell[0],tree.cell[1],tree.cell[2],B_AIR,false);c.fabricDirty=true;FCStreetFabric.refresh(c,false);out.mined=before&&!tree.on&&!c.collisionAABBs.includes(tree.collider)}
   // Off switch.
   FCStreetFabric.set(false);out.hidden=city.every(c=>!c.fabric.root.visible);FCStreetFabric.set(true);
   return out;
  });
  assert.ok(r.cityChunks>=4,'city chunks with fabric');console.log('PASS street fabric built on',r.cityChunks,'city blocks:',JSON.stringify(r.count));
  for(const k of ['decal','tree','signal','car'])assert.ok(r.count[k]>0,k+' present');
  assert.ok(r.meshes<=3&&!r.lights,'three meshes, no lights');assert.ok(r.tris<7000,'triangle budget '+r.tris);console.log('PASS at most three meshes per block, no lights, peak',Math.round(r.tris),'triangles');
  assert.equal(r.paint,0);console.log('PASS block-wide lane stripe retired');
  assert.equal(r.floating,0);assert.equal(r.inDoor,0);console.log('PASS every object is supported and clear of doorways');
  assert.equal(r.wide,0);console.log('PASS pavement keeps its walking strip');
  assert.ok(r.same);console.log('PASS placement is deterministic');
  assert.ok(r.hadTree&&r.mined);console.log('PASS mining the support removes the object and its collider');
  assert.ok(r.hidden);assert.equal(r.panes,2);console.log('PASS off switch; window panes patched into both voxel materials');
  assert.deepEqual(errors,[]);await p.close();
  // Phone sheet, both orientations.
  for(const [name,viewport] of [['portrait',{width:390,height:844}],['landscape',{width:844,height:390}]]){
   const ctx=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:devices['iPhone 13'].userAgent});
   const q=await ctx.newPage(),errs=[];q.on('pageerror',e=>errs.push(e.message));await boot(q);
   await q.evaluate(()=>{HD.locked=true;HD.setTier('perf',true);Peace.on=true;State.ui.paused=false;try{localStorage.removeItem('fc-mob-recent')}catch(e){}});
   await q.waitForFunction(()=>document.querySelector('#mob-keys .fc-sheet'));
   const s=await q.evaluate(async()=>{
    Mobile.showKeys(true);await new Promise(r=>setTimeout(r,400));
    const keys=document.getElementById('mob-keys'),sheet=keys.querySelector('.fc-sheet'),b=sheet.getBoundingClientRect(),find=sheet.querySelector('.fc-find'),grid=keys.querySelector('.grid');
    const vis=e=>!e.hidden&&e.offsetWidth>0,rows=()=>[...grid.querySelectorAll('button')].filter(vis);
    const out={box:[b.left,b.top,b.right,b.bottom].map(Math.round),vw:innerWidth,vh:innerHeight,quick:[...sheet.querySelectorAll('.fc-quick button')].map(e=>e.getAttribute('aria-label')),all:rows().length,small:rows().filter(e=>e.offsetHeight<44).length,invite:rows().some(e=>/invitation/.test(e.textContent))&&!document.querySelector('#common-invite')};
    find.value='col';find.dispatchEvent(new Event('input'));out.found=rows().map(e=>e.textContent.trim());
    find.value='zzzz';find.dispatchEvent(new Event('input'));out.empty=sheet.classList.contains('empty');
    find.value='';find.dispatchEvent(new Event('input'));
    // Typing in Find must not reach the game.
    let leaked=0;const spy=()=>leaked++;window.addEventListener('keydown',spy);find.dispatchEvent(new KeyboardEvent('keydown',{key:'e',code:'KeyE',bubbles:true}));window.removeEventListener('keydown',spy);out.leaked=leaked;
    [...grid.querySelectorAll('button')].find(e=>/Casebook/.test(e.textContent)).click();await new Promise(r=>setTimeout(r,300));out.closed=!keys.classList.contains('on');
    Mobile.tap?.('Escape');await new Promise(r=>setTimeout(r,200));Mobile.showKeys(true);await new Promise(r=>setTimeout(r,300));out.recent=[...sheet.querySelectorAll('.fc-recent button')].map(e=>e.textContent);
    Mobile.showKeys(false);const ab=document.querySelector('.mob-cb.ability');out.ability=ab?ab.textContent:'';return out;
   });
   if(name==='portrait'){assert.ok(s.box[1]>s.vh*.12&&s.box[3]>=s.vh-1,'bottom sheet leaves the street visible');}
   else{assert.ok(s.box[0]>s.vw*.4&&s.box[2]>=s.vw-1,'side panel leaves the street visible');}
   assert.equal(s.quick.length,4);assert.equal(s.small,0);assert.ok(!s.invite);assert.ok(s.found.length>=1&&s.found.every(t=>/col/i.test(t)),'filter: '+s.found);assert.ok(s.empty);assert.equal(s.leaked,0);assert.ok(s.closed);assert.deepEqual(s.recent,['Casebook']);assert.ok(!/^Q/.test(s.ability)||s.ability==='Q');
   assert.deepEqual(errs,[]);console.log('PASS phone sheet',name+':',s.all,'rows, 4 tiles, filter, recent, 44 px targets, no key leak');await ctx.close();
  }
 }finally{await browser.close();site.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
