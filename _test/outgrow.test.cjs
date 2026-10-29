// Outgrow (0.86 Common Ground cabinet): every hit grows both sides, the biter
// more; much bigger things eat; evolutions unlock powers; first to 100 wins.
const root=require('node:path').resolve(__dirname,'..'),{chromium,devices}=require(root+'/_test/node_modules/playwright'),{serve,LAUNCH_ARGS}=require('./lib/harness'),assert=require('node:assert/strict');
(async()=>{const site=await serve(root),browser=await chromium.launch({channel:'chrome',args:LAUNCH_ARGS}),errors=[];
try{
 const p=await browser.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(site.origin+'/apps/outgrow/index.html');await p.waitForFunction(()=>window.Outgrow);
 const r=await p.evaluate(async()=>{await document.fonts.ready;await Promise.all(['Anton','JetBrains Mono'].map(n=>document.fonts.load('700 20px "'+n+'"')));
  const O=Outgrow,out={fonts:['Anton','JetBrains Mono'].every(n=>[...document.fonts].some(f=>f.family.replace(/"/g,'')===n&&f.status==='loaded'))};
  O.newGame();const S=O.state,y=S.you,e=S.ents.find(c=>!c.you&&!c.mote);
  //  A hit grows both, the biter more.
  y.size=10;e.size=10;const y0=y.size,e0=e.size;O.land(y,e,1);out.both=y.size>y0&&e.size>e0;out.biterMore=(y.size-y0)>(e.size-e0);
  //  Getting bitten still grows you.
  const y1=y.size;O.land(e,y,1);out.bittenGrows=y.size>y1;
  //  Something under half your size gets eaten.
  const m=S.ents.find(c=>c.mote);y.size=12;m.size=2;O.land(y,m,1);out.ate=m.dead&&S.eaten===1;
  //  Evolving to 15 unlocks the dash.
  y.size=14.9;O.grow(y,.2);out.dash=y.stage===1;y.dashCd=0;y.stun=0;O.act('dash');out.dashed=y.dash>0;
  //  An enemy reaching 100 first ends it as a loss.
  e.size=99.9;O.grow(e,.5);out.loss=O.mode==='over'&&document.getElementById('oTitle').textContent==='OUTGROWN';
  //  You reaching 100 first is a win.
  O.newGame();O.grow(O.state.you,200);out.win=O.mode==='over'&&document.getElementById('oTitle').textContent==='FULL SIZE';
  //  A real minute of play runs without errors.
  O.newGame();for(let i=0;i<1800&&!O.state.over;i++)O.step(1/30);out.ran=O.state.t>20;return out});
 assert.ok(r.fonts,'fonts load locally');assert.ok(r.both&&r.biterMore,'a hit grows both, biter more');assert.ok(r.bittenGrows,'getting bitten grows you');
 assert.ok(r.ate,'eats much smaller things');assert.ok(r.dash&&r.dashed,'stage 1 unlocks dash');assert.ok(r.loss,'enemy at 100 is a loss');assert.ok(r.win,'you at 100 is a win');assert.ok(r.ran,'a minute of play runs');
 console.log('PASS rules: both grow, biter more, eat, evolve, first to 100 wins or loses');
 //  Phone: the touch pad and BITE button are on screen and work.
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,userAgent:devices['iPhone 13'].userAgent}),q=await ctx.newPage();q.on('pageerror',e=>errors.push(e.message));
 await q.goto(site.origin+'/apps/outgrow/index.html');await q.waitForFunction(()=>window.Outgrow);await q.locator('#play').tap();
 const box=await q.locator('#bBite').boundingBox();assert.ok(box&&box.x+box.width<=844&&box.y+box.height<=390,'bite button on screen');
 await q.locator('#bBite').tap();assert.ok(await q.evaluate(()=>Outgrow.state.you.bite>0||Outgrow.state.you.cd>0),'BITE bites');
 await q.screenshot({path:root+'/_test/out/outgrow-phone.png'});
 console.log('PASS phone controls');
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();site.close?.()}})().catch(e=>{console.error(e);process.exitCode=1});
