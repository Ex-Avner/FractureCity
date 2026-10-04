const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1280,height:800}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(require('node:url').pathToFileURL(require('node:path').resolve(__dirname,'../apps/palm-drive/index.html')).href);await p.evaluate(()=>{startRace(0,'quick');G.countdown=0;G.speed=MAX_SPEED*.8;G.paused=true;});const result=await p.evaluate(()=>{
const assert=(v,m)=>{if(!v)throw Error(m);};
G.paused=false;K.ArrowUp=true;K.ShiftLeft=true;
for(let i=0;i<360;i++){G.playerX=0;G.offroad=false;G.speed=MAX_SPEED;G.pos=0;update(1/60);}
assert(G.nitro<.1&&G.boostLocked,'nitro must deplete '+G.nitro+' '+G.boostLocked);
K.ShiftLeft=false;G.playerX=0;G.offroad=false;G.speed=MAX_SPEED*.8;
const r=rivals[0];r.lap=G.lap;r.z=G.pos+SEG_LEN*5;r.offset=0;r.speed=G.speed;const n=G.nitro;update(1/60);
assert(G.drafting&&G.nitro>n,'draft recharge');
G.drift=0;G.driftCharge=.8;G.driftBoost=0;G.offroad=false;update(1/60);const reward=G.driftBoost;update(1/60);assert(G.driftBoost<reward,'drift should pay once');
startRace(1,'quick');assert(G.nitro===1&&G.driftCharge===0&&G.driftBoost===0,'race reset');
for(let t=0;t<4;t++){startRace(t,'quick');G.countdown=0;for(let i=0;i<600;i++){G.playerX=0;update(1/60);}assert(rivals.every(r=>Number.isFinite(r.z)&&Number.isFinite(r.offset)&&r.offset>=-.92&&r.offset<=.92),'finite AI');render();}
G.paused=true;return {checks:8,tiers:Object.keys(PalmRivals.TIERS)};
});console.log(JSON.stringify({result,errors}));await b.close();if(errors.length)process.exitCode=1;})().catch(e=>{console.error(e);process.exit(1)});
