// Exercise the shipping stream planner and automatic graphics policy against
// world mutations and sustained load without depending on the host GPU speed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../apps/fracture-city-game/index.html'),'utf8');
function section(a,b){const start=html.indexOf(a);assert.ok(start>=0,a);const end=html.indexOf(b,start);assert.ok(end>start,b);return html.slice(start,end)}
let now=0,builds=[],drops=[];
const ctx={performance:{now:()=>now},HD:{T:{view:1}},UNLOAD_RADIUS:2,CHUNK_SIZE:16,Player:{position:{x:0,z:0}},State:{chunkMap:new Map()},Stream:{queue:[],prime:0,msQuiet:0,msBudget:0,unloadPerFrame:2,peakMs:0},shStreamQuiet:()=>false};ctx.window=ctx;
ctx.shBuildChunk=k=>{if(ctx.State.chunkMap.has(k))return;const[cx,cz]=k.split(',').map(Number);ctx.State.chunkMap.set(k,{cx,cz});builds.push(k)};
ctx.shDestroyChunk=k=>{ctx.State.chunkMap.delete(k);drops.push(k)};
vm.createContext(ctx);vm.runInContext(section('const _hdStreamChunks = window.updateChunks;','//  Fog was tuned'),ctx);
ctx.updateChunks();assert.equal(builds[0],'0,0');assert.equal(builds.length,2);assert.equal(builds[1].split(',').reduce((n,v)=>n+Math.abs(+v),0),1);
for(let i=0;i<8;i++)ctx.updateChunks();assert.equal(ctx.State.chunkMap.size,9);assert.equal(ctx.Stream.queue.length,0);
const count=builds.length;for(let i=0;i<120;i++){now+=1;ctx.updateChunks()}assert.equal(builds.length,count);
ctx.State.chunkMap.delete('1,1');ctx.updateChunks();assert.ok(ctx.State.chunkMap.has('1,1'),'outside removal is repaired immediately');
ctx.State.chunkMap.delete('-1,-1');ctx.State.chunkMap.set('50,50',{cx:50,cz:50});now+=501;ctx.updateChunks();assert.ok(ctx.State.chunkMap.has('-1,-1'),'same-size mutation is audited');assert.ok(!ctx.State.chunkMap.has('50,50'));
ctx.Player.position.x=160;ctx.updateChunks();assert.ok(ctx.State.chunkMap.has('10,0'),'teleport always has ground');assert.ok(ctx.Stream.queue.every(k=>Math.abs(+k.split(',')[0]-10)<=1),'old queued neighbourhood discarded');assert.ok(drops.length<=3,'unloads are budgeted');
ctx.updateChunks(true);assert.equal(ctx.State.chunkMap.size,9);assert.ok([...ctx.State.chunkMap.values()].every(c=>Math.abs(c.cx-10)<=1));
ctx.HD.T.view=2;ctx.updateChunks(true);assert.equal(ctx.State.chunkMap.size,25,'tier expansion populates new ring');ctx.HD.T.view=1;ctx.updateChunks(true);assert.equal(ctx.Stream.queue.length,0);
ctx.State.chunkMap=new Map();ctx.updateChunks();assert.ok(ctx.State.chunkMap.has('10,0'),'new world invalidates prior plan');
console.log('PASS budgeted streaming: nearest first, idle reuse, edits, same-size mutation, teleport, force, tiers, world reset');
let applies=0;const hd={HD:{tier:'balanced',locked:false,_acc:0,_n:0,_hot:0,_warm:2},HD_ORDER:['perf','balanced','high','ultra'],navigator:{deviceMemory:8,hardwareConcurrency:12},hdPanelStats(){},hdApply(){applies++;hd.HD._warm=2;hd.HD._acc=hd.HD._n=0},toast(){},shStreamQuiet:()=>false,Stream:{queue:new Array(20)}};
vm.createContext(hd);vm.runInContext(section('function hdGuessTier(){','// =============================================================================')+section('function hdWatchdog(dt){','HD.setTier = hdSetTier;'),hd);
assert.equal(hd.hdGuessTier(),'balanced');hd.navigator.deviceMemory=2;assert.equal(hd.hdGuessTier(),'perf');
for(let i=0;i<130;i++)hd.hdWatchdog(.04);assert.equal(hd.HD.tier,'perf');assert.equal(applies,1,'sustained streaming load can adapt');
hd.HD.tier='ultra';hd.HD.locked=true;hd.HD._warm=0;for(let i=0;i<200;i++)hd.hdWatchdog(.05);assert.equal(hd.HD.tier,'ultra','manual preference retained');
hd.HD.tier='balanced';hd.HD.locked=false;hd.HD._hot=0;for(let i=0;i<600;i++)hd.hdWatchdog(1/60);assert.equal(hd.HD.tier,'balanced','healthy frame rate stays stable');
console.log('PASS automatic graphics: safe default, low memory, sustained lag response, manual lock, stable healthy rate');
