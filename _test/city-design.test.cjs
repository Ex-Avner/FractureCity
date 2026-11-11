const {chromium}=require('playwright'),{serve}=require('./lib/harness'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const site=await serve(path.resolve(__dirname,'..')),browser=await chromium.launch({channel:'chrome'});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(site.origin+'/apps/fracture-city-game/index.html');await p.waitForFunction(()=>window.OwnBlock);await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready&&State.chunkMap.size>10);
  const integrity=await p.evaluate(()=>{
   const result=[];
   for(const d of [DISTRICTS.DOWNTOWN,DISTRICTS.RESIDENTIAL,DISTRICTS.FORGE,DISTRICTS.FLOOD,DISTRICTS.CHINATOWN]){
    const data=new Map(),key=(x,y,z)=>[x,y,z].join(','),c={originX:0,originZ:0,vGet:(x,y,z)=>data.get(key(x,y,z))||0,vSet:(x,y,z,id)=>data.set(key(x,y,z),id)};
    for(let x=2;x<14;x++)for(let z=2;z<14;z++)for(let y=2;y<31;y++)if(x===2||x===13||z===2||z===13)c.vSet(x,y,z,y%3===1&&x%3?B_WIN_LIT:B_CONCRETE);
    for(let x=6;x<10;x++)for(let y=2;y<8;y++)c.vSet(x,y,2,0);
    const before=new Map(data);Architecture.civicOrder(c,{x0:2,x1:14,z0:2,z1:14,top:31},d);
    let changed=0,safe=true;for(const [k,id]of data){const old=before.get(k),y=+k.split(',')[1];if(id!==old)changed++;if(isSolid(id)!==isSolid(old)||y<5&&id!==old||old===B_WIN_LIT&&id!==old)safe=false;}
    result.push({district:d.name,changed,safe});
   }
   return result;
  });for(const r of integrity){assert.ok(r.safe&&r.changed>0,r.district);console.log('PASS facade occupancy, windows and entrance preserved:',r.district);}
  await p.evaluate(()=>{HD.locked=true;HD.setTier('balanced',true);Peace.on=true;FCResident.setView(false);State.ui.paused=false;State.dayTime=15*60;Player.position.set(120,1+Player.height,49);for(let x=2;x<7;x++)for(let z=-2;z<5;z++)if(!State.chunkMap.has(x+','+z))shBuildChunk(x+','+z);});
  await p.waitForTimeout(2500);
  const skin=await p.evaluate(()=>{const skins=[...State.chunkMap.values()].filter(c=>c.futureSkin?.cells.length);return {bounded:skins.every(c=>c.futureSkin.cells.length<=192&&c.futureSkin.root.children.length<=4),upper:skins.some(c=>c.futureSkin.cells.filter(s=>!s.roof&&s.y>20).length>8),lights:skins.some(c=>{let lights=0;c.futureSkin.root.traverse(o=>{if(o.isLight)lights++});return lights>0;})};});assert.ok(skin.bounded&&skin.upper&&!skin.lights);console.log('PASS detail reaches upper floors within existing batch and light budgets');
  async function shot(name,eye,target,hour=15){
   await p.evaluate(({eye,target,hour})=>{State.ui.paused=true;State.dayTime=hour*60;Player.position.set(...eye);State.camera.position.copy(Player.position);State.camera.lookAt(...target);},{eye,target,hour});
   assert.equal(await p.evaluate(()=>isSolid(getBlock(Math.floor(Player.position.x),Math.floor(Player.position.y),Math.floor(Player.position.z)))),false,'Camera must be outside solid geometry');
   await p.waitForTimeout(500);await p.screenshot({path:path.join(__dirname,'out',name+'.png')});
  }
  await shot('city-design-boulevard',[120,4.7,49],[95,8,59]);
  // Civic houses and the new crown on the jail share this material family.
  await p.evaluate(()=>{State.ui.paused=false;Player.position.set(73,1+Player.height,-2);for(let x=1;x<=4;x++)for(let z=-2;z<=0;z++)if(!State.chunkMap.has(x+','+z))shBuildChunk(x+','+z);});await p.waitForTimeout(1800);
  await shot('city-design-civic',[73,16,-1],[72,9,-28]);
  await p.evaluate(()=>{State.ui.paused=false;State.dayTime=22*60;});await p.waitForTimeout(350);await shot('city-design-night',[73,6,-1],[85,9,-24],22);
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>HD.setTier('perf',true));await shot('city-design-phone',[73,4.7,-1],[86,8,-24]);
  assert.deepEqual(errors,[]);console.log('PASS desktop/day/night/phone render with no browser errors');
 }finally{await browser.close();site.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
