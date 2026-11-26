const {chromium}=require('playwright'),{createServer}=require('../server/server.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fc-jail-')),app=createServer({dbPath:path.join(dir,'city.sqlite'),newsFetch:async()=>new Response('<rss/>')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({channel:'chrome'});const p=await browser.newPage({viewport:{width:1280,height:820}}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER',e.message)});await p.goto('http://127.0.0.1:'+app.server.address().port+'/city/');await p.waitForFunction(()=>window.OwnBlock&&window.FCJustice);await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready&&State.chunkMap.size>10);
 await p.evaluate(()=>{HD.setTier('perf',true);State.ui.paused=false;Peace.on=true;FCResident.setView(false);State.dayTime=10*60;Player.position.set(120,1+Player.height,80);for(let cx=4;cx<=5;cx++)for(let cz=2;cz<=3;cz++)if(!State.chunkMap.has(cx+','+cz))shBuildChunk(cx+','+cz);});
 // Real attack loop: non-protected civilian proxies transition to dead.
 const deaths=await p.evaluate(()=>{
  for(let x=116;x<=124;x++)for(let z=72;z<=82;z++){setBlock(x,0,z,1);for(let y=1;y<7;y++)setBlock(x,y,z,0);}
  State.enemies=[];State.globalNPCs=[];State.shopFolk=[];Player.damageMult=10;Player.currentWeapon='pistol';Player.ammo.pistol=100;Player.position.set(120,1+Player.height,80);State.camera.position.copy(Player.position);State.camera.lookAt(120,2,76);State.camera.updateMatrixWorld(true);
  const result=[];for(let i=0;i<3;i++){const n=new NPC(120,76,new RNG('justice-victim-'+i));n.position.set(120,1,76);n.group.position.copy(n.position);n.char.baseY=1;n.char.fnb={hp:40,max:40,st:'ok',t:0,flinch:0,protect:false,kind:'street',brawler:false,punchT:0,barkT:0};State.globalNPCs.push(n);State.scene.add(n.group);Player.attackCooldown=0;tryAttack();result.push(n.char.fnb.st);}
  return result;
 });assert.deepEqual(deaths,['dead','dead','dead']);await p.waitForFunction(()=>FCJustice.active&&Math.abs(Player.position.x-FCJusticeRules.CELL.x)<1);console.log('PASS actual civilian death hook and automatic intake');
 const safety=await p.evaluate(()=>{const ammo=Player.ammo.pistol;Player.attackCooldown=0;tryAttack();const blocked=Player.ammo.pistol===ammo;Player.position.set(160,5,24);return blocked;});assert.equal(safety,true);await p.waitForFunction(()=>Player.position.x<36,null,{timeout:3000});
 const layout=await p.evaluate(()=>{for(const k of FCJustice.keys)if(!State.chunkMap.has(k))shBuildChunk(k);const B=(x,z)=>shBodyBlocked(x,2,z,.3,1.7);return{floor:getBlock(33,1,-40)!==0,door:!B(67.5,-35.5),bars:B(35.1,-40.5),ventShut:B(30.5,-39.5),grateShut:B(30.5,-16.5),serviceShut:B(58.5,-11),duct:!B(29.5,-30),ductLid:getBlock(29,4,-30)!==0,gate:B(40.5,-29.5),laundryDoor:!B(40.5,-16),controlDoor:!B(58.5,-26),outletRoom:!B(63.5,-7.6),root:FCJustice.root.parent===State.scene};});console.log(layout);for(const [k,v]of Object.entries(layout))assert.equal(v,true,k);
 await p.evaluate(()=>{FCJustice.open(true);});await p.setViewportSize({width:390,height:844});assert.ok(await p.locator('.jail-panel').evaluate(e=>e.scrollWidth<=e.clientWidth));await p.screenshot({path:path.join(__dirname,'out/jail-phone.png')});await p.keyboard.press('Escape');await p.setViewportSize({width:1280,height:820});
 const until=await p.evaluate(()=>FCJustice.state.until);await p.reload();await p.waitForFunction(()=>window.OwnBlock&&window.FCJustice);await p.evaluate(()=>OwnBlock.start());await p.waitForFunction(()=>OwnBlock.ready&&FCJustice.active&&Player.position.x<36);assert.equal(await p.evaluate(()=>FCJustice.state.until),until);
 await p.evaluate(()=>{HD.setTier('perf',true);Peace.on=true;FCResident.setView(false);});
 // Walk on the real voxels with stepped physics. Returns where you ended up.
 const walk=pts=>p.evaluate(pts=>{State.ui.paused=true;const out=[];for(const [tx,tz] of pts){for(let i=0;i<1400;i++){const dx=tx-Player.position.x,dz=tz-Player.position.z;if(Math.hypot(dx,dz)<.2)break;Player.yaw=Math.atan2(-dx,-dz);State.keys.clear();State.keys.add('w');updateWalkInput(1/60);updateWalkPhysics(1/60);}State.keys.clear();out.push([+Player.position.x.toFixed(2),+Player.position.z.toFixed(2)]);}State.ui.paused=false;return out;},pts);
 const holdE=async(id,ms)=>{await p.evaluate(()=>{State.ui.paused=false;});await p.waitForFunction(id=>FCJustice.debug.near?.station?.id===id&&!FCJustice.debug.near.hint,id,{timeout:40000});await p.keyboard.down('e');await p.waitForTimeout(ms);await p.keyboard.up('e');};
 // Guards parked where they see nothing on the route, for the main run.
 await p.evaluate(()=>FCJustice.debug.freeze({phase:.1,brandt:14,okafor:4,spot:0,noCatch:false}));
 // The vent stops you until it is pried.
 let at=await walk([[31.5,-39.5],[29.5,-39.5]]);assert.ok(at[1][0]>30.9,'vent cover blocks the duct '+JSON.stringify(at));
 await walk([[32,-39.5]]);await holdE('vent',5600);await p.waitForFunction(()=>FCJustice.state.stage===1,null,{timeout:8000});
 at=await walk([[31.5,-39.5],[29.5,-39.5],[29.5,-17.5]]);assert.ok(Math.abs(at[2][1]+17.5)<.3&&at[2][0]<30,'crawled the duct '+JSON.stringify(at));
 await holdE('duct',2600);await p.waitForTimeout(300);await p.waitForFunction(()=>FCJustice.state.stage===2,null,{timeout:8000});
 // Caught: an inmate in the yard without a uniform, in front of Okafor.
 await p.evaluate(()=>FCJustice.debug.freeze({phase:.1,brandt:14,okafor:0,spot:0}));
 await walk([[31.8,-16.5],[39,-16],[42.5,-16],[44,-30],[47,-38.6]]);await p.waitForFunction(()=>FCJustice.state.stage===1&&Math.abs(Player.position.x-FCJusticeRules.CELL.x)<1,null,{timeout:8000});console.log('PASS caught in the yard without a uniform: back in A-01, vent still open');
 await p.evaluate(()=>FCJustice.debug.freeze({phase:.1,brandt:14,okafor:4,spot:0}));
 await walk([[31.5,-39.5],[29.5,-39.5],[29.5,-17.5]]);await holdE('duct',2600);await p.waitForFunction(()=>FCJustice.state.stage===2,null,{timeout:8000});
 await walk([[31.8,-16.5],[36.5,-15.2]]);await holdE('uniform',3600);await p.waitForFunction(()=>FCJustice.state.stage===3,null,{timeout:8000});
 // In uniform across the yard to control; the key only while Vale walks his round.
 await walk([[39,-16],[42.5,-16],[56,-26],[59.6,-26],[60.3,-23.8]]);
 await p.evaluate(()=>FCJustice.debug.freeze({phase:null,brandt:14,okafor:4,spot:0}));await p.waitForFunction(()=>!FCJusticeRules.guardAway(FCJustice.state,Date.now())&&FCJustice.debug.near?.station?.id==='keys',null,{timeout:40000});await p.waitForTimeout(250);
 assert.equal(await p.evaluate(()=>FCJustice.debug.near?.hint),true,'desk guard at his post blocks the key');
 await p.evaluate(()=>FCJustice.debug.freeze({phase:.7,brandt:14,okafor:4,spot:0}));
 await p.waitForFunction(()=>FCJusticeRules.guardAway(FCJustice.state,Date.now())&&((Date.now()-FCJustice.state.started)%36000)<31000,null,{timeout:40000});
 await holdE('keys',3600);await p.waitForFunction(()=>FCJustice.state.stage===4,null,{timeout:8000});
 assert.equal(await p.evaluate(()=>!shBodyBlocked(58.5,2,-11,.3,1.7)),true,'service door open');
 await walk([[59.6,-26],[56,-26],[56,-11],[60,-11],[63.5,-8]]);await holdE('outlet',5600);
 await p.waitForFunction(()=>!FCJustice.active,null,{timeout:8000});
 assert.equal(await p.evaluate(()=>FCJustice.state.reason),'escaped');assert.ok(await p.evaluate(()=>Player.position.x>=69));console.log('PASS breakout played on the voxels: pry, duct, grate, uniform, key on the round, service door, outlet');
 await p.evaluate(()=>{State.ui.paused=true;Player.position.set(74,24,4);Player.yaw=.748;Player.pitch=.32;State.camera.position.copy(Player.position);State.camera.lookAt(48,10,-24);});await p.waitForTimeout(250);await p.screenshot({path:path.join(__dirname,'out/jail-exterior.png')});
 // Offline clock expiration returns to the public exit; no second forced sentence.
 await p.evaluate(()=>{localStorage.setItem('fc-justice-solo-v1',JSON.stringify({...FCJusticeRules.fresh(),until:Date.now()-1,reason:'sentenced'}));});await p.reload();await p.waitForFunction(()=>window.FCJustice);assert.equal(await p.evaluate(()=>FCJustice.active),false);assert.deepEqual(errors,[]);console.log('PASS confinement, disarm, doors/floors, phone, reload, escape and expired offline sentence');
}finally{await browser?.close();await new Promise(r=>{app.server.once('close',r);app.close()});fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
