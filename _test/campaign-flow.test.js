// Runs the real campaign definitions and progression functions, with rendering
// and input mocked. This verifies story reachability, not collision or visual QA.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'apps/fracture-city-game/index.html'),'utf8');
const guide=fs.readFileSync(path.join(ROOT,'apps/fracture-city-game/campaign-guide.js'),'utf8');
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function harness(){
 const timers=[],els=new Map(),storage=new Map(),pending=[];
 function el(id){if(!els.has(id))els.set(id,{innerHTML:'',textContent:'',hidden:false,classList:{add(){},remove(){},contains(){return false}},style:{setProperty(){}},appendChild(){},querySelector(){return el('sub')},onclick:null});return els.get(id);}
 const ctx=vm.createContext({console,Math,Number,Promise,JSON,Map,Set,performance:{now:()=>0},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},
  document:{getElementById:el,exitPointerLock(){},body:{style:{},classList:{remove(){}},appendChild(){}},addEventListener(){},createElement:()=>el('created')},
  $:el,State:{ui:{},dayTime:0,hud:{},chunkMap:new Map(),enemies:[]},Player:{position:{x:0,y:2,z:0},height:2,yaw:0},Shift:{profile:{displayName:'Witness'},holdSaved:null},Dialogue:{active:false},
  fracture:{save:async(k,v)=>storage.set(k,JSON.parse(JSON.stringify(v))),read:async k=>storage.get(k)},
  refreshHpHUD(){},toast(){},closeMenu(){},openMenu(){},shEsc:x=>String(x),shPlaceInBed:()=>true,shSetWallScreen(){},districtAtPosition:()=>null,shClosePanel(){},
  shSay:(lines,cb)=>{if(cb)pending.push(cb)},SH_HOTSPOTS:[],SPEAKERS:{},
 });ctx.window=ctx;
 vm.runInContext(guide,ctx);
 vm.runInContext(between('const LOAN_DECISIONS = [','function shPanelLoanCase(){'),ctx);
 vm.runInContext(between('const CAMPAIGN = [','//  31 · THE FRONT DOOR').replace(/\/\/ ={10,}\s*$/,''),ctx);
 vm.runInContext(between('Campaign.choices = Campaign.choices || {};','//  46 · THE FILM, AGAIN'),ctx);
 vm.runInContext(`shCampaignGuideTick=()=>{}; shCampaignCheckpointSoon=()=>{}; shCampaignCheckpoint=()=>{};
 shCampaignHUD=()=>{}; shShowChapterCard=()=>{}; shQuietMinute=()=>{};
 shShowChapterComplete=(ch)=>{window.complete=ch.id};shShowCampaignEnd=()=>{window.ending=shChoiceMade('ending')};
 window.api={Campaign,CAMPAIGN,ACT_TWO,shChoiceMade};`,ctx);
 ctx.flush=()=>{let n=0;while(timers.length||pending.length){if(++n>150)throw Error('callback cycle');if(timers.length)timers.shift()();else pending.shift()();}};
 return ctx;
}
let count=0;function test(name,fn){fn();count++;console.log('PASS',name);}
test('dialogue advancement has one declaration; HUD uses a different name',()=>{
 assert.equal((source.match(/function shNextLine\(/g)||[]).length,1);assert(source.includes('function shObjectiveLine('));
});
test('all chapter and objective IDs are unique and prerequisites resolve',()=>{
 const h=harness(),chapters=h.api.CAMPAIGN,ids=new Set();assert.equal(chapters.length,12);
 for(const ch of chapters){const earlier=new Set();for(const o of ch.objectives){assert(!ids.has(o.id),o.id);ids.add(o.id);if(o.after)assert(earlier.has(o.after),o.id);earlier.add(o.id);}}
});
test('out-of-order events cannot satisfy a locked objective',()=>{
 const h=harness();h.api.Campaign.active=true;h.shCampaignEvent('witness');assert(!h.api.Campaign.done.witness);
});
test('case files are distinct, validated evidence',()=>{
 const h=harness(),c=h.api.Campaign;c.active=true;c.chapter=7;
 h.shCampaignEvent('evidence','not-a-file');assert(!c.progress['m8-read']);
 h.shCampaignEvent('evidence','q1902');h.shCampaignEvent('evidence','q1902');assert.equal(c.progress['m8-read'],1);
 h.shCampaignEvent('hack',{});assert.equal(c.progress['m8-read'],1);
});
test('height objective cannot complete from the ground',()=>{
 const h=harness(),c=h.api.Campaign;c.active=true;c.chapter=9;h.Player.position={x:0,y:2,z:0};h.shCampaignTick(.1);assert(!c.done['m10-high']);
 h.Player.position={x:0,y:22,z:0};h.shCampaignTick(.1);assert(c.done['m10-high']);
});
test('the minute waits for arrival and takes sixty simulation seconds',()=>{
 const h=harness(),c=h.api.Campaign;c.active=true;c.chapter=9;h.Player.position={x:100,y:22,z:100};
 h.shCampaignTick(120);assert(!c.progress['quiet-seconds']);
 h.Player.position={x:0,y:22,z:0};h.shCampaignTick(30);assert(!c.done['m10-hold']);h.shCampaignTick(30);assert(c.done['m10-hold']);
});
test('leaving the roof pauses the minute without deleting elapsed time',()=>{
 const h=harness(),c=h.api.Campaign;c.active=true;c.chapter=9;
 h.Player.position={x:0,y:22,z:0};h.shCampaignTick(20);
 h.Player.position={x:0,y:2,z:0};h.shCampaignTick(60);
 assert.equal(c.progress['quiet-seconds'],20);assert(!c.done['m10-hold']);
 h.Player.position={x:0,y:22,z:0};h.shCampaignTick(40);assert(c.done['m10-hold']);
});
test('wrong choice type cannot finish a chapter',()=>{
 const h=harness(),c=h.api.Campaign;c.active=true;c.chapter=8;c.done['m9-tower']=c.done['m9-archive']=true;c.choices.pattern='pattern-file';h.shCampaignEvent('choose','pattern');assert(!c.done['m9-tape']);
});
test('an interrupted choice reopens instead of deadlocking',()=>{
 const h=harness(),c=h.api.Campaign;c.active=true;c.chapter=7;c.done['m8-read']=true;c.done['chose:seventeen']=true;
 h.shCampaignResume();h.flush();assert(h.$('chapter-done').innerHTML.includes('Seventeen cases, or one'));
});
test('completed chapter saved before Continue can resume its completion card',()=>{
 const h=harness(),c=h.api.Campaign;c.active=true;c.chapter=1;c.done.stone=c.done.site=c.done['closed:quarry']=true;
 h.shCampaignResume();h.flush();assert.equal(h.complete,'quarry');
});
test('54 complete routes reach their selected ending through all 12 chapters',()=>{
 for(const loan of ['deny','override','carry'])for(const pattern of ['pattern-file','pattern-split','pattern-hold'])for(const tape of ['tape-play','tape-keep'])for(const ending of ['end-broadcast','end-file','end-walk']){
  const h=harness(),c=h.api.Campaign;const answers={pattern,tape,ending};let choices=0;
  h.shChoice=(key,prompt,options,then)=>{assert(options.some(o=>o.id===answers[key]));choices++;c.choices[key]=answers[key];h.shCampaignEvent('choose',key);then(answers[key]);};
  h.shCampaignStart(true);h.flush();c.caseDecision=loan;
  for(let index=0;index<12;index++){
   assert.equal(c.chapter,index);const ch=h.api.CAMPAIGN[index];
   for(const o of ch.objectives){
    if(h.shObjDone(o))continue;
    if(o.kind==='reach'){h.Player.position={x:o.x,y:(o.y||0)+2,z:o.z};h.shCampaignTick(.1);}
    else if(o.kind==='evidence'){for(const id of ['q1902','q1931','q1956'])h.shCampaignEvent('evidence',id);}
    else if(o.kind==='choose'){h.shCheckChapterComplete();}
    else if(o.id==='m10-hold'){h.shCampaignTick(60);}
    else h.shCampaignEvent(o.kind,o.target||null,o.count||1);
    h.flush();assert(h.shObjDone(o),ch.id+' / '+o.id);
   }
   h.shCheckChapterComplete();h.flush();assert.equal(h.complete,ch.id);h.shAdvanceChapter();h.flush();
  }
  assert.equal(choices,3);assert(c.finished);assert.equal(h.ending,ending);
 }
});
// Parsing all inline scripts catches malformed templates introduced by edits.
test('all inline scripts and campaign guide parse',()=>{
 new vm.Script(guide);for(const m of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
test('the intro loop does not schedule a second frame',()=>{
 assert(!source.includes('if (State.ui.inIntro){ requestAnimationFrame(tick)'));
});
test('narration preserves both completion callbacks',()=>{
 const h=harness();const start=source.indexOf('const Narr = {');const end=source.indexOf('// ─── Wiring',start);
 vm.runInContext(source.slice(start,end),h);
 vm.runInContext(`SPEAKERS.ned={name:'Ned',role:'FCN',tint:'#fff'};
 shNarrBuild=()=>{Narr.el=$('narr')}; window.completedSpeech=[];
 shNarrate([{who:'ned',text:'First'}],()=>completedSpeech.push('first'));
 shNarrate([{who:'ned',text:'Second'}],()=>completedSpeech.push('second'));
 shNarrNext(); shNarrNext();`,h);
 assert.deepEqual(Array.from(h.completedSpeech),['first','second']);
});
(async()=>{
 const h=harness();
 vm.runInContext(between('function shCampaignStarted(){','function shChapterName(){'),h);
 vm.runInContext(between('const Slots = {','//  A brand new world'),h);
 Object.assign(h,{Inventory:new Map([[3,12]]),HOTBAR:[3],EDITS:new Map(),Peace:{on:false},saveEdits(){},loadEdits:async()=>{},newGame(){},shUpdateHUD(){}});
 h.Player.position.set=function(x,y,z){this.x=x;this.y=y;this.z=z};
 h.State.citySeed='campaign-test-city';
 vm.runInContext(`Slots.ready=true; Campaign.active=true; Campaign.chapter=8;
 Campaign.choices={pattern:'pattern-file',tape:'tape-play'};
 Campaign.done={'m9-tower':true}; Shift.holdSaved={anomalyIndex:3,decisions:[{mode:'hold'}]};`,h);
 await h.shSlotSave('test-a','First');
 vm.runInContext(`Campaign.choices={pattern:'pattern-hold'}; Shift.holdSaved=null;`,h);
 await h.shSlotSave('test-b','Second');
 await h.shSlotRestore('test-a');
 assert.equal(h.api.Campaign.choices.tape,'tape-play');assert.equal(h.Shift.holdSaved.anomalyIndex,3);
 await h.shSlotRestore('test-b');
 assert.equal(h.api.Campaign.choices.pattern,'pattern-hold');assert.equal(h.api.Campaign.choices.tape,undefined);assert.equal(h.Shift.holdSaved,null);
 count++;console.log('PASS real save/restore isolates choices and partial HOLD between slots');
 console.log(`\n${count} campaign checks passed, including 54 complete story routes. Browser/rendering checks remain separate.`);
})().catch(e=>{console.error(e);process.exitCode=1});
