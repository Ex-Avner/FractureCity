// 0.91 The Church of Omnism: a domed hall west of Common Ground with ten
// lecterns, one per scripture, and the Guide at the centre. The texts are
// complete and real: checked here by famous verses in their own scripts.
const root=require('node:path').resolve(__dirname,'..'),{chromium,devices}=require(root+'/_test/node_modules/playwright'),{serve,LAUNCH_ARGS}=require('./lib/harness'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const T={timeout:240000};
(async()=>{
 // ── The library on disk ────────────────────────────────────────────────
 const S=path.join(root,'apps/fracture-city-game/scriptures'),idx=JSON.parse(fs.readFileSync(path.join(S,'index.json'),'utf8')),W=id=>idx.works.find(w=>w.id===id);
 const v=(w,e,b,c,n)=>JSON.parse(fs.readFileSync(path.join(S,w,e,b+'.json'),'utf8')).c[c][n];
 assert.equal(idx.works.length,10);
 const tan=W('tanakh'),bib=W('bible'),qur=W('quran');
 assert.equal(tan.books.length,39);assert.equal(tan.books[0].g,'Torah');assert.ok(v('tanakh','he',0,0,0).startsWith('בְּרֵאשִׁ'),'Genesis 1:1 in Hebrew');
 assert.equal(v('tanakh','en',0,0,0),'IN THE beginning God created the heaven and the earth.');
 const psalms=tan.books.findIndex(b=>b.n==='Psalms');assert.equal(v('tanakh','en',psalms,22,0),'A Psalm of David. The LORD is my shepherd; I shall not want.');
 for(const e of ['0','4',String(psalms)]){const t=fs.readFileSync(path.join(S,'tanakh/en',e+'.json'),'utf8');assert.ok(!/HaShem|G-d|L-rd/.test(t),'JPS divine names restored in book '+e)}
 const john=bib.books.findIndex(b=>b.n==='John');assert.equal(bib.books.length,73);
 assert.ok(v('bible','kjv',john,2,15).startsWith('For God so loved the world'));assert.ok(v('bible','la',john,0,0).startsWith('In principio erat Verbum'));assert.ok(v('bible','grc',john,0,0).startsWith('εν αρχη ην ο λογος'));
 assert.ok(bib.books.find(b=>b.n==='Tobit').in.includes('drc')&&!bib.books.find(b=>b.n==='Tobit').in.includes('kjv'),'deuterocanon in the Douay-Rheims, not the KJV');
 assert.equal(qur.books.length,114);assert.equal(qur.books.reduce((s,b)=>s+b.v[0],0),6236);
 const basmala=v('quran','ar',0,0,0);assert.ok(basmala.startsWith('بِسْمِ')&&basmala.split(' ').length===4,'Al-Fatihah 1:1 in Arabic');assert.equal(v('quran','en',0,0,0),'In the name of Allah, the Beneficent, the Merciful');
 assert.equal(W('gita').books.reduce((s,b)=>s+b.v[0],0),700);assert.ok(v('gita','sa',0,0,0).includes('धर्मक्षेत्रे कुरुक्षेत्रे'));
 assert.ok(v('tao','zh',0,0,0).startsWith('道可道，非常道'));assert.ok(v('tao','en',0,0,0).startsWith('The Tao that can be trodden'));
 assert.ok(v('dhammapada','en',0,0,0).startsWith('All that we are is the result of what we have thought'));
 assert.ok(v('mormon','en',0,0,0).startsWith('I, Nephi, having been born of goodly parents'));
 assert.ok(v('bahai','en',0,1,0).startsWith('O SON OF SPIRIT! My first counsel is this'));
 for(const w of idx.works)for(const e of w.editions){assert.ok(e.source&&e.license,'every edition names its source and licence: '+w.id+' '+e.id);for(let i=0;i<w.books.length;i++){const b=w.books[i];if(b.in&&!b.in.includes(e.id))continue;assert.ok(fs.existsSync(path.join(S,w.id,e.id,i+'.json')),'file for '+w.id+'/'+e.id+'/'+i)}}
 console.log('PASS the library holds ten complete scriptures, in Hebrew, Greek, Latin, Arabic, Sanskrit and Chinese as well as English');
 // ── The church in the city ─────────────────────────────────────────────
 const site=await serve(root),browser=await chromium.launch({channel:'chrome',args:LAUNCH_ARGS}),errors=[];
 try{
  const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>errors.push(e.message));
  await p.goto(site.origin+'/apps/fracture-city-game/index.html',{waitUntil:'load'});await p.waitForFunction(()=>window.FCOmnism&&window.OwnBlock,null,T);
  await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.ui.paused=false;try{localStorage.removeItem('fc-omnism-pos')}catch(e){}Player.position.set(FCOmnism.C.x+20,2+Player.height,FCOmnism.C.z)});
  await p.waitForFunction(()=>OwnBlock.ready&&['3,0','4,0','3,1','4,1'].every(k=>State.chunkMap.has(k))&&FCOmnism.root,null,T);await p.waitForTimeout(1500);
  const hall=await p.evaluate(()=>{const {C,R}=FCOmnism;return{wall:getBlock(Math.floor(C.x-R+.2),5,Math.floor(C.z)),door:getBlock(Math.floor(C.x+R-.5),3,Math.floor(C.z)),floor:getBlock(Math.floor(C.x),1,Math.floor(C.z)),dome:!!FCOmnism.root.children.length,inScene:FCOmnism.root.parent===State.scene,lecterns:[...State.chunkMap.values()].reduce((n,c)=>n+c.collisionAABBs.filter(a=>a.omnism).length,0)}});
  assert.ok(hall.wall===170||hall.wall===171,'limestone wall with its lit window: '+hall.wall);assert.equal(hall.door,0,'east door open');assert.ok(hall.floor===173||hall.floor===172,'temple floor');assert.ok(hall.dome&&hall.inScene,'dome and lecterns built');assert.equal(hall.lecterns,11,'ten lecterns and the table are solid');
  console.log('PASS an octagonal limestone hall with an east door, ten solid lecterns and a centre table');
  // Walk in through the door to the Qur'an's lectern; the prompt names it; E opens it.
  const walked=await p.evaluate(()=>{State.ui.paused=true;const s=FCOmnism.STATIONS.find(s=>s.id==='quran');Player.position.set(FCOmnism.C.x+18,2+Player.height,FCOmnism.C.z);Player.onGround=true;Player.velocity.set(0,0,0);
   const go=(tx,tz,n)=>{for(let i=0;i<n;i++){const dx=tx-Player.position.x,dz=tz-Player.position.z,d=Math.hypot(dx,dz);if(d<.15)break;Player.velocity.x=dx/d*3;Player.velocity.z=dz/d*3;Player.velocity.y-=22/60;updateWalkPhysics(1/60)}};
   go(FCOmnism.C.x+4,FCOmnism.C.z,900);const inside=Player.position.x<FCOmnism.C.x+6;go(s.fx,s.fz,900);return{inside,at:Math.hypot(Player.position.x-s.fx,Player.position.z-s.fz),feet:Player.position.y-Player.height}});
  assert.ok(walked.inside,'walks in through the door: '+JSON.stringify(walked));assert.ok(walked.at<.5&&Math.abs(walked.feet-2)<.05,'reaches the lectern on the temple floor: '+JSON.stringify(walked));
  await p.evaluate(()=>State.ui.paused=false);await p.waitForFunction(()=>!document.getElementById('om-approach').hidden,null,T);
  assert.equal(await p.locator('#om-approach').innerText(),"E · Read the Qur'an");
  await p.keyboard.press('KeyE');await p.waitForSelector('.om-panel .om-v',T);
  const q=await p.evaluate(()=>({paused:State.ui.paused,title:document.querySelector('.om-head h3').textContent,first:document.querySelector('.om-v').textContent}));
  assert.ok(q.paused&&q.title.startsWith("The Qur'an")&&q.first.includes('In the name of Allah'),'opens the Qur\'an: '+JSON.stringify(q));
  await p.selectOption('[data-sel=par]','ar');await p.waitForFunction(()=>document.querySelector('.om-v.two [lang=ar][dir=rtl]'),null,T);
  assert.equal(await p.evaluate(()=>document.querySelector('.om-v.two [lang=ar]').textContent.replace(/^\d+/,'')),basmala);
  console.log("PASS walk in, the lectern prompt names its book, E opens the Qur'an, Arabic sits beside the English right to left");
  // Books and chapters turn; the Guide's contents jump straight to a book.
  await p.selectOption('[data-sel=book]',{value:'111'});await p.waitForFunction(()=>/Al-Ikhlas/.test(document.querySelector('.om-head h3 small').textContent),null,T);
  await p.locator('[data-act=guide]').click();await p.waitForSelector('.om-toc',T);
  await p.locator('.om-toc a',{hasText:/^Psalms$/}).first().click();await p.waitForFunction(()=>/Psalms/.test(document.querySelector('.om-head h3 small')?.textContent||''),null,T);
  await p.selectOption('[data-sel=ch]',{value:'22'});await p.selectOption('[data-sel=par]','he');await p.waitForFunction(()=>[...document.querySelectorAll('.om-v.two')].some(n=>n.textContent.includes('The LORD is my shepherd')&&n.querySelector('[lang=he]')),null,T);
  await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>document.querySelector('.om-text h4')?.textContent==='Chapter 24',null,T);
  await p.screenshot({path:root+'/_test/out/omnism-reader.png'});
  console.log('PASS the Guide lists every book; Psalm 23 opens in English beside the Hebrew; arrows turn the chapter');
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>!!document.querySelector('.om-panel')||State.ui.paused),false,'Escape closes and resumes');
  const remembered=await p.evaluate(()=>JSON.parse(localStorage.getItem('fc-omnism-pos')));assert.equal(remembered.work,'tanakh');assert.equal(remembered.ch,23);
  // The centre table opens the Guide.
  await p.evaluate(()=>{Player.position.set(FCOmnism.C.x+2.6,2+Player.height,FCOmnism.C.z);Player.velocity.set(0,0,0)});await p.waitForFunction(()=>FCOmnism.near?.kind==='guide'&&!document.getElementById('om-approach').hidden,null,T);
  await p.keyboard.press('KeyE');await p.waitForSelector('.om-guide h1',T);await p.screenshot({path:root+'/_test/out/omnism-guide.png'});await p.keyboard.press('Escape');
  console.log('PASS the centre table opens the Guide, and the library remembers where you stopped');
  // Phone: the reader fills the screen and the close button is reachable.
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent}),q2=await ctx.newPage();q2.on('pageerror',e=>errors.push(e.message));
  await q2.goto(site.origin+'/apps/fracture-city-game/index.html');await q2.waitForFunction(()=>window.FCOmnism,null,T);
  await q2.evaluate(()=>FCOmnism.open({kind:'work',id:'bible'}));await q2.waitForSelector('.om-panel .om-v',T);
  const fit=await q2.evaluate(()=>{const r=document.querySelector('.om-panel').getBoundingClientRect(),c=document.querySelector('.om-close').getBoundingClientRect(),t=document.querySelector('.om-text').getBoundingClientRect();return{w:r.width,close:c.right<=innerWidth&&c.top>=0,text:t.width}});
  assert.ok(fit.w<=390&&fit.close&&fit.text>300,'phone layout: '+JSON.stringify(fit));await q2.screenshot({path:root+'/_test/out/omnism-phone.png'});
  console.log('PASS the reader fits a phone');
  assert.deepEqual(errors,[]);console.log('PASS no browser errors');
 }finally{await browser.close();site.close?.()}
})().catch(e=>{console.error(e);process.exitCode=1});
