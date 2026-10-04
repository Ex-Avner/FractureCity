const {_electron}=require('playwright');const fs=require('fs'),os=require('os'),path=require('path');
(async()=>{const profile=fs.mkdtempSync(path.join(os.tmpdir(),'palm-release-'));const executablePath=process.argv[2];if(!executablePath)throw Error('Pass the packaged app executable path');const app=await _electron.launch({executablePath,args:['--user-data-dir='+profile],env:{...process.env,PRESENT_PALM_ROOT:''}});try{
const root=await app.evaluate(({app})=>({packaged:app.isPackaged,data:app.getPath('userData')}));if(!root.packaged||fs.realpathSync(root.data)!==fs.realpathSync(profile))throw Error('Not isolated packaged app '+JSON.stringify(root));console.log('PACKAGED',root);
await app.evaluate(({session})=>session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(d,done)=>done({cancel:true})));
const hub=await app.firstWindow();await hub.waitForFunction(()=>!!window.shellAPI);const list=await hub.evaluate(()=>shellAPI.listApps());console.log('REGISTRY',list.length);
const targets=list.filter(x=>(x.tags.includes('game')||x.slug==='light-bearer')&&x.runtime==='html5');for(const m of targets){
 const errors=[];const waiting=app.waitForEvent('window');await hub.evaluate(slug=>shellAPI.openApp(slug),m.slug);const win=await waiting;win.on('pageerror',e=>errors.push(e.message));await win.waitForLoadState();await win.waitForTimeout(1500);
 if(m.slug==='fracture-city-game'){
 await win.waitForFunction(()=>window.PalmMedia?.music.length===13);
 await win.evaluate(()=>PalmMedia.openRadio());await win.locator('#pm-panel [data-act="play"]').click();await win.waitForFunction(()=>PalmMedia.audio&&!PalmMedia.audio.paused&&PalmMedia.audio.currentTime>0);
 for(let i=0;i<13;i++){await win.locator('#pm-panel [data-track="'+i+'"]').click();await win.waitForFunction(()=>PalmMedia.audio&&!PalmMedia.audio.paused&&PalmMedia.audio.currentTime>0);}
 const first=await win.evaluate(()=>PalmMedia.audio.src);await win.locator('#pm-panel [data-act="next"]').click();await win.waitForFunction(old=>PalmMedia.audio.src!==old&&PalmMedia.audio.currentTime>0,first);
 await win.screenshot({path:path.join(profile,'radio.png')});
 await win.evaluate(async()=>{await fracture.save('release-test',{ok:true});PalmMedia.close();});
 if(!fs.existsSync(path.join(profile,'data/fracture-city-game/release-test.json')))throw Error('save not in profile');console.log('RADIO all 13 tracks played, skip, save OK');
 await win.evaluate(()=>{newGame('release-hud');State.ui.inIntro=false;State.ui.paused=false;});await win.waitForTimeout(1200);
 await win.keyboard.press('F2');await win.waitForFunction(()=>FCQuietUI.menu.open&&State.ui.paused);
 await win.locator('#fc-tools [data-act="hud"]').click();if(await win.evaluate(()=>FCQuietUI.compact))throw Error('full HUD toggle');
 await win.locator('#fc-tools [data-act="hud"]').click();await win.locator('#fc-tools [data-act="radio"]').click();await win.waitForFunction(()=>PalmMedia.panelOpen);
 await win.locator('#pm-panel [data-act="close"]').click();await win.waitForFunction(()=>!State.ui.paused);
 await win.screenshot({path:path.join(profile,'hud.png')});
 console.log('COMPACT HUD toggle, radio handoff, unpause OK');
 }
 if(m.slug==='sun-fall')await win.locator('#startBtn').click();
 if(m.slug==='still-human')await win.locator('#startbtn').click();
 if(m.slug==='coherence-game'){await win.locator('#btn-enter').click();await win.locator('#btn-begin').click();}
 if(m.slug==='palm-drive')await win.evaluate(()=>startRace(0,'quick'));
 await win.waitForTimeout(600);
 console.log('GAME',m.slug,'errors',errors);if(errors.length)throw Error(m.slug+' '+errors.join(';'));await win.close();
}console.log('PASS packaged launcher and '+targets.length+' game windows');}finally{await app.close();}})().catch(e=>{console.error(e);process.exitCode=1});
