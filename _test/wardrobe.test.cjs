// 0.80: the punk wardrobe. Every option builds, faces blink and talk, the
// crowd is a mix of scenes, the wardrobe screen saves, rare pieces need
// buying, other residents online wear their own looks, and phones fit.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const T={timeout:240000};
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-wd-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));return p};
try{
 const p=watch(await (await browser.newContext({viewport:{width:1366,height:800}})).newPage());
 await p.goto(base+'/city/',T);await p.waitForFunction(()=>window.OwnBlock&&window.FCWardrobeUI,null,T);
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.dayTime=13*60});
 const built=await p.evaluate(async()=>{const W=FCWardrobe,schema=await (await fetch('wardrobe.json')).json(),bad=[];let n=0,maxTris=0;
  const check=(look,label)=>{const c=shBuildFigure({...look,prop:'none',auraChance:0},'opt');shAnimateCharacter(c,.1,true,1);let ok=c.studio.knees.length===2&&c.studio.elbows.length===2&&c.studio.fingers.length===2&&!!c.studio.eyes&&!!c.studio.mouth,tris=0;c.group.traverse(o=>{if(o.geometry){tris+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))ok=false}});maxTris=Math.max(maxTris,tris);if(!ok)bad.push(label);FCResident.dispose(c);n++};
  for(const g of schema.groups)for(const s of g.slots){if(s.range){for(const v of s.range)check({...W.DEFAULT_LOOK,[s.key]:v},s.key+'='+v)}else for(const v of s.options)check({...W.DEFAULT_LOOK,[s.key]:s.multi?[v]:v},s.key+'='+v)}
  for(const pr of schema.presets)check({...W.DEFAULT_LOOK,...pr.look},pr.name);
  check({...W.DEFAULT_LOOK,hairStyle:'liberty',outfit:'studded',extras:schema.groups.find(g=>g.key==='extras').slots[0].options,makeup:'skull',boots:'platform',piercings:'loaded',tattoos:'sleeve',frame:'curvy',headgear:'crown'},'everything');
  return{n,bad,maxTris}});
 assert.deepEqual(built.bad,[]);assert.ok(built.n>90);assert.ok(built.maxTris<16000,'triangle budget '+built.maxTris);
 console.log('PASS every wardrobe option and preset builds an articulated figure ('+built.n+' builds, max '+built.maxTris+' triangles)');
 const live=await p.evaluate(()=>{const c=shBuildFigure({...FCWardrobe.DEFAULT_LOOK,prop:'none'},'live');let blink=false;for(let t=0;t<12;t+=.03){shAnimateCharacter(c,.03,false,t);if(c.studio.eyes.scale.y<.6)blink=true}c.talking=true;let talk=false;for(let t=13;t<14;t+=.03){shAnimateCharacter(c,.03,false,t);if(c.studio.mouth.scale.y>1.2)talk=true}FCResident.dispose(c);return{blink,talk}});
 assert.deepEqual(live,{blink:true,talk:true});console.log('PASS faces blink, and mouths move while talking');
 const crowd=await p.evaluate(()=>{const scenes=new Set(),combos=new Set();for(let i=0;i<40;i++){const c=shBuildCharacter(CHAR_ARCHETYPES[i%CHAR_ARCHETYPES.length],new RNG('crowd-'+i),{});scenes.add(c.look.scene);combos.add(c.look.hairStyle+'|'+c.look.outfit+'|'+c.look.hair);FCResident.dispose(c)}return{scenes:[...scenes],combos:combos.size}});
 assert.ok(crowd.scenes.length>=5,'scenes: '+crowd.scenes);assert.ok(crowd.combos>=30);
 console.log('PASS the crowd mixes scenes ('+crowd.scenes.join(', ')+') with '+crowd.combos+' distinct looks in 40 people');
 // The wardrobe screen.
 await p.evaluate(()=>{State.hud.credits=300;if(State.ui.freeBuild)shToggleFreeBuild();shOpenPanel('avatar')});await p.waitForSelector('#fc-wardrobe:not([hidden]) canvas',T);
 await p.locator('#fc-wardrobe [data-preset="0"]').click(T);
 await p.locator('#fc-wardrobe [data-group="hair"]').click(T);await p.locator('#fc-wardrobe [data-slot="hairStyle"][data-val="liberty"]').click(T);
 assert.equal(await p.locator('#fc-wardrobe [data-save]').isDisabled(),true,'a rare piece can be tried on but not worn unbought');
 await p.locator('#fc-wardrobe [data-buy="hairStyle"]').click(T);await p.waitForFunction(()=>!document.querySelector('#fc-wardrobe [data-save]').disabled,null,T);
 assert.equal(await p.evaluate(()=>State.hud.credits),150);
 await p.locator('#fc-wardrobe [data-group="colour"]').click(T);await p.locator('#fc-wardrobe [data-colour="hair"][data-val="#00e5ff"]').click(T);
 await p.screenshot({path:root+'/_test/out/wardrobe.png',...T});
 await p.locator('#fc-wardrobe [data-save]').click(T);await p.waitForFunction(()=>document.getElementById('fc-wardrobe').hidden,null,T);
 assert.deepEqual(await p.evaluate(()=>[Shift.avatar.hairStyle,Shift.avatar.hair,Shift.avatar.outfit,State.ui.inShiftPanel]),['liberty','#00e5ff','denim-vest',false]);
 await p.evaluate(()=>FCWardrobeUI.open());await p.waitForSelector('#fc-wardrobe:not([hidden])',T);await p.locator('#fc-wardrobe [data-preset="5"]').click(T);await p.keyboard.press('Escape');
 assert.equal(await p.evaluate(()=>Shift.avatar.outfit),'denim-vest','Esc leaves without changing anything');
 console.log('PASS the wardrobe: presets, cuts and colours, rare pieces bought once with credits, wear it saves, Esc cancels');
 await p.context().close();
 // Online: other residents wear their own looks.
 const ctx=await browser.newContext({viewport:{width:1280,height:720}});
 const post=async(a,d)=>{const r=await ctx.request.post(base+'/api/'+a,{data:d});const j=await r.json();if(r.status()!==200)throw Error(a+' '+r.status()+' '+JSON.stringify(j));return j};
 await post('account/register',{username:'wd_online',password:'test city password 1234',displayName:'Wearer'});const code=(await post('join',{public:true})).code;
 const reg=await fetch(base+'/api/account/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:'wd_rival',password:'test city password 1234'})}),cookie=reg.headers.get('set-cookie').split(';')[0];
 const jb=await (await fetch(base+'/api/join',{method:'POST',headers:{'Content-Type':'application/json',cookie,Origin:base},body:JSON.stringify({public:true})})).json();
 const stream=await fetch(base+'/api/events',{headers:{Authorization:'Bearer '+jb.token,cookie}});const reader=stream.body.getReader();(async()=>{try{while(!(await reader.read()).done);}catch(e){}})();
 await fetch(base+'/api/city-look',{method:'POST',headers:{'Content-Type':'application/json',cookie,Origin:base,Authorization:'Bearer '+jb.token},body:JSON.stringify({look:{hairStyle:'undercut',hair:'#39ff14',outfit:'hoodie',coat:'#ff6a00'}})});
 const o=watch(await ctx.newPage());
 //  The headless browser here is slow enough that a join request can time out; retry the page.
 for(let i=0;;i++){await o.goto(base+'/city/?online='+code,T);if(await o.waitForFunction(()=>window.FCCityOnline?.ready&&FCCityOnline.connected,null,{timeout:240000}).then(()=>true,()=>false))break;if(i===2)throw Error('could not join the online city');console.log('retrying the join')}
 const room=app.rooms.get(code),rival=room.players.get(jb.id),me=[...room.players.values()].find(q=>q.name==='Wearer');
 await o.evaluate(()=>{HD.locked=true;HD.setTier('perf',true)});
 Object.assign(rival,{x:me.x+3,z:me.z,y:me.y||1});
 await o.waitForFunction(id=>{const f=FCCityOnline.peers.get(id);return f&&f.char.look?.hairStyle==='undercut'&&f.char.look.hair==='#39ff14'},jb.id,{timeout:120000});
 assert.ok(me.look&&me.look.hairStyle,'your own look reaches the server on joining');
 await o.evaluate(id=>{const f=FCCityOnline.peers.get(id);Player.yaw=Math.atan2(-(f.group.position.x-Player.position.x),-(f.group.position.z-Player.position.z));Player.pitch=-.1},jb.id);await o.waitForTimeout(2500);
 await o.screenshot({path:root+'/_test/out/wardrobe-online.png',...T});
 console.log('PASS online: residents send their looks and see each other as they dressed');
 reader.cancel().catch(()=>{});await ctx.close();
 // Phone.
 const m=watch(await (await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage());
 await m.goto(base+'/city/',T);await m.waitForFunction(()=>window.OwnBlock&&window.FCWardrobeUI,null,T);await m.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();FCWardrobeUI.open()});
 await m.waitForSelector('#fc-wardrobe:not([hidden]) canvas',T);await m.waitForTimeout(1500);
 assert.ok(await m.evaluate(()=>{const r=document.getElementById('fc-wardrobe').getBoundingClientRect(),side=document.querySelector('#fc-wardrobe .wd-side');return r.right<=innerWidth&&side.scrollWidth<=side.clientWidth+1}),'the wardrobe fits a phone');
 await m.screenshot({path:root+'/_test/out/wardrobe-phone.png',...T});
 console.log('PASS the wardrobe fits a phone');
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
