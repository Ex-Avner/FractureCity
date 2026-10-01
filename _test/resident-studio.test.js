const {chromium}=require('playwright');
const {serve,Checks}=require('./lib/harness');
const path=require('path'),fs=require('fs');
(async()=>{
 const root=process.argv[2]||path.resolve(__dirname,'..'),site=await serve(root),c=new Checks('Resident studio and third person');
 const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
 try{
  await page.goto(site.origin+'/apps/fracture-city-game/index.html');await page.waitForTimeout(1000);
  await page.evaluate(()=>{HD.locked=true;HD.tier='perf';newGame('resident-studio-check')});await page.waitForTimeout(2500);
  await page.evaluate(()=>{shCampaignSilence();State.ui.inIntro=false;Trans.active=false;shOpenPanel('avatar')});await page.waitForTimeout(700);
  c.eq('Live fitting-room canvas',await page.locator('#resident-preview canvas').count(),1);
  await page.locator('[data-resident-preset="Midnight"]').click();await page.waitForTimeout(300);
  await page.locator('[data-key="outfit"][data-val="tailored"]').click();
  await page.locator('[data-range="jaw"]').fill('1.12');await page.waitForTimeout(300);
  c.ok('Wardrobe and face edits reach avatar',await page.evaluate(()=>Shift.avatar.coat==='#24313d'&&Shift.avatar.outfit==='tailored'&&Shift.avatar.jaw===1.12));
  await page.locator('#resident-portrait').click();await page.waitForTimeout(200);
  await page.locator('#resident-preview').screenshot({path:path.join(out,'resident-face.png')});
  await page.locator('#resident-portrait').click();await page.screenshot({path:path.join(out,'resident-studio.png')});
  await page.locator('[data-act="save-resident"]').click();await page.waitForTimeout(600);
  c.ok('Resident save closes fitting room',await page.evaluate(()=>!State.ui.inShiftPanel));
  c.ok('Appearance saved to existing profile storage',await page.evaluate(async()=>{const a=await fracture.read('shift-avatar');return a&&a.outfit==='tailored'&&a.jaw===1.12}));
  await page.evaluate(()=>{State.ui.paused=false;State.ui.inDialogue=false;FCResident.setView(false)});
  await page.keyboard.press('v');await page.waitForTimeout(400);
  c.ok('V enables third person and renders player automatically',await page.evaluate(()=>FCResident.thirdPerson&&!!FCResident.body&&State.renderer.residentCamera));
  c.ok('New body uses current wardrobe',await page.evaluate(()=>FCResident.body.coatHex===shHexToInt(Shift.avatar.coat)));
  c.ok('View preference persists',await page.evaluate(()=>localStorage.getItem('fc-third-person')==='true'));
  const result=await page.evaluate(()=>{
   const saved={pos:Player.position.clone(),yaw:Player.yaw,pitch:Player.pitch,paused:State.ui.paused};State.ui.paused=true;
   Player.position.set(0,40,0);Player.yaw=0;Player.pitch=0;FCResident.cameraFrame();
   const clear=State.camera.position.distanceTo(Player.position),dir=new THREE.Vector3(0,0,-1).applyEuler(State.camera.rotation),align=dir.dot(Player.position.clone().sub(State.camera.position).normalize());
   const blocks=[];for(let x=-1;x<=1;x++)for(let y=39;y<=41;y++){blocks.push([x,y,2,getBlock(x,y,2)]);setBlock(x,y,2,1)}
   FCResident.cameraFrame();const wall=State.camera.position.distanceTo(Player.position);
   for(const [x,y,z,id] of blocks)setBlock(x,y,z,id);
   Player.position.copy(saved.pos);Player.yaw=saved.yaw;Player.pitch=saved.pitch;
   State.camera.position.copy(Player.position);State.camera.rotation.set(Player.pitch,Player.yaw,0,'YXZ');
   const before=State.camera.position.clone();State.renderer.render(State.scene,State.camera);const restored=before.distanceTo(State.camera.position)<1e-6;
   State.ui.paused=saved.paused;return{clear,wall,align,restored};
  });
  c.ok('Camera backs out in open space',result.clear>3.3,JSON.stringify(result));
  c.ok('Voxel wall pulls camera forward',result.wall>0&&result.wall<1.9);
  c.ok('Combat reticle stays on player aim ray',result.align>.9999);
  c.ok('Render restores eye camera for interaction code',result.restored);
  c.ok('Adult mesh and articulated joints remain finite at customization limits',await page.evaluate(()=>{
   for(const value of [.82,1.22]){const c=shBuildFigure({...Shift.avatar,heightScale:value,widthScale:value,jaw:value},'limits');shAnimateCharacter(c,.1,true,1);let ok=c.studio.knees.length===2&&c.studio.elbows.length===2;c.group.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)if(!Number.isFinite(n))ok=false});FCResident.dispose(c);if(!ok)return false}return true;
  }));
  await page.evaluate(()=>{State.ui.paused=true;shCampaignSilence();document.querySelectorAll('.toast').forEach(e=>e.remove());State.dayTime=1080;updateDayNight(0)});await page.waitForTimeout(500);
  await page.screenshot({path:path.join(out,'resident-third-person.png')});
  await page.evaluate(()=>{State.ui.paused=false});await page.keyboard.press('v');await page.waitForTimeout(150);
  c.ok('V returns to first person and hides player body',await page.evaluate(()=>!FCResident.thirdPerson&&!FCResident.body.group.visible));
  c.eq('No browser exceptions',errors.length,0);
 }finally{await browser.close();site.close()}
 process.exitCode=c.report()?1:0;
})().catch(e=>{console.error(e);process.exit(1)});
