// 0.85: the online city HUD on a phone, portrait and landscape. Chips, the
// online pill, the goal, the minimap, Tools, the bell, the thumb controls and
// every prompt on screen at once must not sit on top of each other, and all of
// them stay on screen, including the opened online panel.
const root=require('node:path').resolve(__dirname,'..'),{chromium,devices}=require(root+'/_test/node_modules/playwright'),{createServer}=require(root+'/server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const T={timeout:240000};
const KEY=['tc-top','city-online','maker-goal','minimap','fc-tools','fc-bell','tc-stick','tc-acts','maker-interact','common-invite','common-later','npc-talk-prompt','casting-prompt','cg-approach','campus-arcade-play','chainfire-play','#city-pvp .pv-hp'];
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-phone-'));const app=createServer({dbPath:path.join(dir,'t.sqlite'),newsFetch:async()=>new Response('<rss></rss>')});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({channel:'chrome'}),errors=[];
try{
 for(const [name,viewport] of [['portrait',{width:390,height:844}],['landscape',{width:844,height:390}]]){
  const ctx=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:devices['iPhone 13'].userAgent});
  await ctx.request.post(base+'/api/account/register',{data:{username:'phone_'+name,password:'phone hud password 1',displayName:'Phone '+name}});
  const code=(await (await ctx.request.post(base+'/api/join',{data:{public:true}})).json()).code;
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  for(let i=0;;i++){await p.goto(base+'/city/?online='+code,T);if(await p.waitForFunction(()=>window.FCCityOnline?.ready&&FCCityOnline.connected,null,{timeout:240000}).then(()=>true,()=>false))break;if(i===2)throw Error('could not join');console.log('retrying the join')}
  await p.evaluate(()=>{HD.locked=true;HD.setTier('perf',true)});
  const check=async(label,{panel=false}={})=>{await p.waitForTimeout(1200);const out=await p.evaluate(KEY=>{const vis=e=>{if(!e||e.hidden)return false;const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return false;const r=e.getBoundingClientRect();return r.width>2&&r.height>2};
    const boxes=KEY.map(id=>document.querySelector(id.includes(' ')?id:'#'+id)).filter(vis).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,l:r.left,t:r.top,r:r.right,b:r.bottom}});
    const hits=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],c=boxes[j];if(a.l<c.r-1&&c.l<a.r-1&&a.t<c.b-1&&c.t<a.b-1)hits.push(a.id+' x '+c.id)}
    return{ids:boxes.map(b=>b.id),hits,off:boxes.filter(b=>b.l<-1||b.t<-1||b.r>innerWidth+1||b.b>innerHeight+1).map(b=>b.id)}},KEY);
   await p.screenshot({path:root+'/_test/out/phone-hud-'+name+'-'+label+'.png',...T});
   //  An open online panel is a sheet: it may cover the map and Tools, nothing may cover it, and it fits.
   const hits=panel?out.hits.filter(h=>!/city-online/.test(h)||/tc-top/.test(h)):out.hits;
   assert.deepEqual(hits,[],name+' '+label+' overlaps: '+out.hits.join(', '));assert.deepEqual(out.off,[],name+' '+label+' off screen');
   return out};
  //  Common Ground arrival: Ned's invite, its Later button and the goal are up together.
  await p.evaluate(()=>{Player.position.set(167,1+Player.height,30);Player.yaw=0});
  const a=await check('arrival');assert.ok(a.ids.includes('minimap')&&a.ids.includes('fc-tools')&&a.ids.includes('city-online'),JSON.stringify(a.ids));
  //  The PvP bar only shows once you are hurt.
  assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('#city-pvp .pv-hp')).display),'none','no PvP bar at full health');
  //  Hurt, at the Oh No Ned cabinet: the PvP bar, its play prompt and the invite stack.
  const room=app.rooms.get(code),me=[...room.players.values()].find(q=>q.name==='Phone '+name);
  await p.evaluate(()=>{Player.position.set(180.5,1+Player.height,48.6);Player.yaw=0});me.hp=60;
  await p.waitForFunction(()=>!document.querySelector('#city-pvp .pv-hp').hidden,null,T);
  const b=await check('prompts');assert.ok(b.ids.includes('pv-hp'),JSON.stringify(b.ids));me.hp=100;
  //  The opened online panel stays on screen.
  await p.locator('#city-online summary').tap();await check('panel',{panel:true});
  const fits=await p.evaluate(()=>{const r=document.getElementById('city-online').getBoundingClientRect();return r.bottom<=innerHeight+1&&r.right<=innerWidth+1});assert.ok(fits,'online panel fits');
  await p.locator('#city-online summary').tap();
  console.log('PASS '+name+': '+b.ids.join(', ')+' sit apart and on screen');
  await ctx.close()}
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
