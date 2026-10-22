// Five stand-alone arcade cabinets across Common Ground, served through the real
// city server (its app allowlist and content policy), plus "Clear my pieces here".
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const FONTS={'toilet-heads':['Lilita One','Nunito'],'fractured-mirror':['Syncopate','Chakra Petch'],'breaking-ned':['Anton','IBM Plex Mono'],'oh-no-ned':['Anton','Old Standard TT'],'bad-weather':['Bricolage Grotesque','JetBrains Mono']};
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-ca-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[],outside=[];
try{
 for(const slug of Object.keys(FONTS)){const html=fs.readFileSync(path.join(root,'apps',slug,'index.html'),'utf8');assert.doesNotMatch(html,/https?:\/\/(fonts\.g|cdnjs)/,slug+' has no outside fonts or scripts');const r=await fetch(base+'/apps/'+slug+'/index.html');assert.equal(r.status,200,slug+' is served')}
 console.log('PASS all five games are served by the city server with no outside dependencies');
 const p=await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/Content Security Policy|Refused to/i.test(m.text())&&!/hn\.algolia|hacker-news\.firebaseio/.test(m.text()))errors.push(m.text().slice(0,200))});
 p.on('request',r=>{if(!r.url().startsWith(base)&&!/^(data|blob):/.test(r.url()))outside.push(r.url())});
 await p.goto(base+'/city/');await p.waitForFunction(()=>window.OwnBlock&&window.FCCampusArcades,null,{timeout:120000});
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.dayTime=13*60});
 const roster=await p.evaluate(()=>JSON.stringify((SHIFT_WORLD.arcadeRoster||ARCADE_ROSTER).map(g=>g.slug)));
 for(const g of await p.evaluate(()=>FCCampusArcades.games.map(({slug,title,x,z,fx,fz,key,name})=>({slug,title,x,z,fx,fz,key,name})))){
  await p.evaluate(g=>{Player.position.set(g.x+g.fx*1.1,1+Player.height,g.z+g.fz*1.1);Player.yaw=Math.atan2(g.fx,g.fz);Player.pitch=-.05;Player.velocity.set(0,0,0)},g);
  await p.waitForFunction(g=>!!State.chunkMap.get(g.key)?.group?.getObjectByName(g.name),g,{timeout:120000,polling:500});
  const placed=await p.evaluate(g=>({one:State.chunkMap.get(g.key).group.children.filter(c=>c.name===g.name).length,solid:State.chunkMap.get(g.key).collisionAABBs.some(b=>b.minX<g.x&&b.maxX>g.x&&b.minZ<g.z&&b.maxZ>g.z),floor:shSurfaceY(g.x+g.fx*1.1,g.z+g.fz*1.1,6),clear:[0,.5,1].every(d=>shSurfaceY(g.x+g.fx*(1.1+d),g.z+g.fz*(1.1+d),6)<=1)}),g);
  assert.equal(placed.one,1,g.slug+' placed once');assert.ok(placed.solid,g.slug+' is solid');assert.equal(placed.floor,1,g.slug+' stands on open ground');assert.ok(placed.clear,g.slug+' has a clear approach');
  await p.waitForSelector('#campus-arcade-play:not([hidden])',{timeout:30000});assert.match(await p.locator('#campus-arcade-play').innerText(),/E · Play/);
  await p.waitForTimeout(1500);await p.screenshot({timeout:150000,path:root+'/_test/out/campus-arcade-'+g.slug+'.png'});
  await p.keyboard.press('KeyE');await p.waitForFunction(s=>State.ui.inArcade&&document.querySelector('#arcade-frame').src.includes('/apps/'+s+'/'),g.slug,{timeout:30000});
  const f=p.frame({url:new RegExp('/apps/'+g.slug+'/')})||(await (await p.$('#arcade-frame')).contentFrame());await f.waitForLoadState('load');
  const inside=await f.evaluate(async fams=>{await document.fonts.ready;await Promise.all(fams.map(n=>document.fonts.load('700 20px "'+n+'"').catch(()=>{})));return {fonts:fams.map(n=>[...document.fonts].some(ff=>ff.family.replace(/"/g,'')===n&&ff.status==='loaded')),body:document.body.childElementCount,matter:typeof Matter}},FONTS[g.slug]);
  assert.ok(inside.body>0,g.slug+' rendered');assert.deepEqual(inside.fonts,FONTS[g.slug].map(()=>true),g.slug+' fonts load locally');if(g.slug==='oh-no-ned')assert.equal(inside.matter,'object','matter.js loads locally');
  await p.waitForTimeout(1200);if(g.slug==='oh-no-ned'||g.slug==='toilet-heads')await p.screenshot({timeout:150000,path:root+'/_test/out/campus-arcade-'+g.slug+'-game.png'});
  await p.locator('#arcade-exit').click();await p.waitForFunction(()=>!State.ui.inArcade,null,{timeout:15000});
  assert.equal(await p.evaluate(()=>JSON.stringify((SHIFT_WORLD.arcadeRoster||ARCADE_ROSTER).map(g=>g.slug))),roster,'arcade building roster unchanged');
  assert.ok(await p.evaluate(g=>Math.hypot(Player.position.x-(g.x+g.fx*1.1),Player.position.z-(g.z+g.fz*1.1))<1,g),'returns to the cabinet');
  console.log('PASS '+g.title+': placed once, solid, clear approach, E opens it with its own fonts'+(g.slug==='oh-no-ned'?' and physics':'')+', exit returns');
 }
 await p.evaluate(()=>{const g=FCCampusArcades.games[3];shDestroyChunk(g.key);shBuildChunk(g.key)});
 assert.equal(await p.evaluate(()=>{const g=FCCampusArcades.games[3];return State.chunkMap.get(g.key).group.children.filter(c=>c.name===g.name).length}),1);
 console.log('PASS a chunk reload restores exactly one cabinet');
 // Clear my pieces here: Plot 01 is x 194-202, z 50-58.
 await p.waitForFunction(()=>CityArt.ready,null,{timeout:60000});
 const res=await p.evaluate(()=>{const piece=(x,z,group)=>({kind:'cylinder',p:[x,1.03,z],s:[2,.04,1.4],r:[0,0,0],color:'#a0524d',finish:'matte',...(group?{group}:{})});const base=CityArt.objects.length;
  CityArt.commit([...CityArt.objects,piece(196,52),piece(199,55),piece(201,57,'sofa'),piece(203.5,57,'sofa'),piece(210,52),piece(170,40)]);const added=CityArt.objects.length-base;
  Player.position.set(198,1+Player.height,54);const first=CityArt.clearHere(),afterFirst=CityArt.objects.length,second=CityArt.clearHere(),left=CityArt.objects.length;
  const kept=CityArt.objects.slice(-2).map(o=>o.p[0]);CityArt.undo();return {added,first,afterFirst,second,left,kept,undone:CityArt.objects.length-base}});
 assert.equal(res.added,6);assert.equal(res.first,false,'first tap only arms');assert.equal(res.afterFirst-res.left,4,'removes the three in Plot 01 and the rest of their group');assert.equal(res.second,true);assert.deepEqual(res.kept,[210,170],'pieces outside the plot stay');assert.equal(res.undone,6,'undo restores them');
 console.log('PASS Clear my pieces here arms on the first tap, clears Plot 01 with whole groups, leaves the rest, and undo restores');
 const m=await (await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();m.on('pageerror',e=>errors.push(e.message));
 for(const slug of Object.keys(FONTS)){await m.goto(base+'/apps/'+slug+'/index.html');await m.waitForTimeout(800);assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),slug+' fits a phone')}
 console.log('PASS each game fits a phone screen');
 assert.deepEqual(outside,[],'no requests leave the server');assert.deepEqual(errors,[]);console.log('PASS no outside requests, content-policy blocks or browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
