// The Reading Garden at Common Ground: the garden itself, the gallery's new row,
// the line of the day, the reader, and the online library, in a real browser.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const csv='Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves\n2600,Text,2001-04-01,War and Peace,en,"Tolstoy, Leo, graf, 1828-1910",Napoleonic Wars -- Fiction,PG,Best Books Ever Listings\n1399,Text,1998-07-01,Anna Karenina,en,"Tolstoy, Leo, graf, 1828-1910",Love stories,PG,\n';
const chapter=n=>'CHAPTER '+n+'\n\n'+Array.from({length:5},(_,i)=>'Paragraph '+i+' of chapter '+n+' of a very long Russian novel, written out here at length so that it reads as prose, and then it ends.').join('\n\n');
const war='*** START OF THE PROJECT GUTENBERG EBOOK 2600 ***\n\n'+[1,2,3].map(chapter).join('\n\n\n\n')+'\n\n*** END OF THE PROJECT GUTENBERG EBOOK 2600 ***\nLicence.';
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-rw-')),fetched=[];
const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>'),classicsFetch:async url=>{fetched.push(url);if(url.endsWith('pg_catalog.csv'))return new Response(csv);if(/\/2600-0\.txt$/.test(url))return new Response(war);return new Response('',{status:404})}});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
try{const p=await (await browser.newContext({viewport:{width:1280,height:800}})).newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/\[reading-garden\]/.test(m.text()))errors.push(m.text())});
 await p.goto(base+'/city/');await p.waitForFunction(()=>window.OwnBlock&&window.FCReadingGarden&&window.CitySocial,null,{timeout:120000});
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.dayTime=13*60;Player.position.set(167,1+Player.height,32.5)});
 await p.waitForFunction(()=>State.chunkMap.get('6,1')?.landmark==='makers'&&State.chunkMap.get('7,1')?.landmark==='makers',null,{timeout:90000});
 // The garden is built from blocks: lawn, water, the wall, trees, benches.
 const g=await p.evaluate(()=>({wall:[160,166,173].map(x=>shSurfaceY(x+.5,37.5,12)),water:getBlock(160,0,32),rim:shSurfaceY(158.5,31.5,4),lawn:getBlock(151,0,33),tree:shSurfaceY(152.5,33.5,12),bench:shSurfaceY(160.5,35.5,4),W:B_WATER,G:B_GRASS,path:shSurfaceY(166.5,32.5,4),lane:[148,160,175].map(x=>shSurfaceY(x+.5,41.5,6))}));
 assert.deepEqual(g.wall,[7,7,7]);assert.equal(g.water,g.W);assert.equal(g.rim,2);assert.equal(g.lawn,g.G);assert.ok(g.tree>=7);assert.equal(g.bench,2);assert.equal(g.path,1);assert.deepEqual(g.lane,[1,1,1],'the gallery lane is clear');
 console.log('PASS the garden is solid: lawn, pools with rims, trees, benches, the wall; the path and gallery lane are clear');
 // The People's Gallery stands along the south edge now; visitors stand in the lane.
 await p.evaluate(()=>Player.position.set(148,1+Player.height,41));
 await p.waitForFunction(()=>CitySocial.nearest===0,null,{timeout:60000,polling:250});
 console.log('PASS gallery display 1 is reached from the gallery lane at z 41');
 // The line of the day comes from the shelf and is on the wall.
 const line=await p.evaluate(async()=>{const l=await FCReadingGarden.lineOfDay();const s=await FCReadingGarden.loadShelf();return {l,ids:s.shelves.flatMap(x=>x.books.map(b=>b.id))}});
 assert.ok(line.ids.length>=40,'starter shelf installed');assert.ok(line.ids.includes(line.l.id),'today’s line is from a shelf book');assert.ok(line.l.text.length>=120&&line.l.text.length<=360);
 await p.waitForFunction(()=>{let ok=false;FCReadingGarden.root?.traverse(o=>{if(o.material?.map&&o.parent?.position&&Math.abs(o.parent.position.x-FCReadingGarden.CX)<.01&&o.material.map.image?.width===1400)ok=true});return ok},null,{timeout:60000,polling:500});
 console.log('PASS the line of the day is a real passage from a shelf book, painted on the wall');
 // Walk up, press E, read.
 await p.evaluate(()=>{Player.position.set(167,1+Player.height,35.6);Player.yaw=Math.PI});
 await p.waitForFunction(()=>FCReadingGarden.near&&!document.getElementById('rw-approach').hidden,null,{timeout:60000,polling:250});
 await p.keyboard.press('KeyE');await p.waitForSelector('#rw-panel');assert.equal(await p.evaluate(()=>State.ui.paused),true);
 await p.waitForFunction(()=>/“/.test(document.querySelector('#rw-panel .quote')?.textContent||''),null,{timeout:60000});
 await p.locator('#rw-panel [data-tab="Novels"]').click();await p.locator('#rw-panel [data-open="1342"]').click();
 await p.waitForFunction(()=>/Pride and Prejudice/.test(document.querySelector('#rw-panel h3')?.textContent||''),null,{timeout:60000});
 const text=await p.locator('#rw-panel article').innerText();
 assert.match(text,/It is a truth universally acknowledged/);assert.doesNotMatch(text,/PROJECT GUTENBERG/i);assert.match(text,/gutenberg\.org\/ebooks\/1342/);
 await p.screenshot({path:root+'/_test/out/reading-wall-reader.png'});
 await p.locator('#rw-panel [data-step="1"]').first().click();assert.match(await p.locator('#rw-panel .kick').first().innerText(),/03 \//);
 await p.keyboard.press('ArrowLeft');assert.match(await p.locator('#rw-panel .kick').first().innerText(),/02 \//);
 console.log('PASS E opens the wall; a shelf book opens at chapter one with no licence text; chapters page forward and back');
 // The online library: search the catalogue, open a book fetched from a mirror.
 await p.locator('#rw-panel [data-tab="search"]').click();await p.locator('#rw-panel [data-search] input').fill('tolstoy war');await p.keyboard.press('Enter');
 await p.waitForSelector('#rw-panel [data-open="2600"]',{timeout:60000});
 await p.locator('#rw-panel [data-open="2600"]').click();
 await p.waitForFunction(()=>/War and Peace/.test(document.querySelector('#rw-panel h3')?.textContent||''),null,{timeout:60000});
 assert.match(await p.locator('#rw-panel article').innerText(),/Paragraph 0 of chapter 1/);assert.match(await p.locator('#rw-panel .sub').innerText(),/Leo Tolstoy/);
 assert.ok(fetched.some(u=>u.includes('gutenberg.pglaf.org/2/6/0/2600/2600-0.txt')),'fetched from the mirror');assert.ok(!fetched.some(u=>/\/1342/.test(u)),'shelf books are never fetched');
 console.log('PASS search finds Tolstoy in the full catalogue; War and Peace is fetched from a mirror and read');
 await p.keyboard.press('Escape');assert.equal(await p.locator('#rw-panel').count(),0);assert.equal(await p.evaluate(()=>State.ui.paused),false);
 console.log('PASS Escape closes the reader and play resumes');
 // A phone.
 const m=await (await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();m.on('pageerror',e=>errors.push(e.message));
 await m.goto(base+'/city/');await m.waitForFunction(()=>window.OwnBlock&&window.FCReadingGarden,null,{timeout:120000});
 await m.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();FCReadingGarden.open()});await m.waitForSelector('#rw-panel');
 const fit=await m.evaluate(()=>{const r=document.getElementById('rw-panel').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth});
 assert.equal(fit,true);await m.screenshot({path:root+'/_test/out/reading-wall-phone.png'});
 console.log('PASS the reader fits a phone screen');
 assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
