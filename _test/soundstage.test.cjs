// 0.88 Soundstage: direct characters in the city on a timeline. Moves, actions,
// looks, lines with recorded audio (mouth follows loudness), camera keys that
// glide or cut, exact scrubbing, save and reopen, export with audio, clean exit.
const root=require('node:path').resolve(__dirname,'..'),{chromium}=require(root+'/_test/node_modules/playwright'),{serve,LAUNCH_ARGS}=require('./lib/harness'),assert=require('node:assert/strict');
const T={timeout:240000};
(async()=>{const site=await serve(root),browser=await chromium.launch({channel:'chrome',args:LAUNCH_ARGS}),errors=[];
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(site.origin+'/apps/fracture-city-game/index.html',{waitUntil:'load'});await p.waitForFunction(()=>window.FCSoundstage&&window.OwnBlock,null,T);
 await p.evaluate(async()=>{HD.locked=true;HD.setTier('perf',true);await OwnBlock.start();State.ui.paused=false;Player.position.set(182,1+Player.height,52);Player.yaw=0});
 await p.waitForFunction(()=>OwnBlock.ready,null,T);await p.waitForTimeout(1500);
 assert.ok(await p.evaluate(()=>!!document.querySelector('#fc-tools [data-act=soundstage]')),'Tools has the Soundstage');
 const r=await p.evaluate(async()=>{const S=FCSoundstage,st=S.state,out={};
  S.open();out.paused=State.ui.paused;out.camHidden=!State.camera.visible;
  const a=S.addActor('crowd'),b=S.addActor('you');a.mark=[180,1,46];a.yaw=0;b.mark=[183,1,46];b.yaw=0;
  //  Move: walk from the mark to a point, eased, facing the way it walks.
  const mv=S.addClip(a.id,'move',{t:1,to:[180,1,42]});out.moveDur=mv.dur;
  S.evaluate(0.5);const p0=S.placeAt(a,0.5);S.evaluate(mv.t+mv.dur/2);const pm=S.placeAt(a,mv.t+mv.dur/2);S.evaluate(mv.t+mv.dur+.5);const pe=S.placeAt(a,mv.t+mv.dur+.5);
  out.move={start:[p0.x,p0.z],mid:pm.z,end:[pe.x,pe.z],walkingMid:pm.speed>.3,facing:Math.abs(Math.abs(pm.yaw)-Math.PI)<.2};
  //  Action: the arm leaves its rest pose while the clip runs, and returns after.
  const rec=st.actors?.get?.(b.id);const act=S.addClip(b.id,'act',{t:0,dur:3,action:'point'});
  S.evaluate(1.5);const c=[...document.querySelectorAll('x')].length;const bc=FCSoundstage.state.actors.get(b.id).char;out.armDuring=bc.leftArm.rotation.x;S.evaluate(4);out.armAfter=bc.leftArm.rotation.x;
  //  Look: b's head turns toward a.
  S.addClip(b.id,'look',{t:5,dur:2,target:a.id});S.evaluate(6);out.headYaw=bc.head.rotation.y;
  //  Line with real audio: a 0.6 s tone then silence; the mouth follows it.
  const sr=22050,n=Math.round(sr*1.4),buf=new ArrayBuffer(44+n*2),v=new DataView(buf),w=(o,s)=>[...s].forEach((ch,i)=>v.setUint8(o+i,ch.charCodeAt(0)));
  w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++)v.setInt16(44+i*2,i<sr*.6?Math.sin(i/sr*2*Math.PI*220)*20000:0,true);
  const au=await S.importAudio(new File([buf],'line.wav',{type:'audio/wav'}));const line=S.addClip(b.id,'line',{t:8,audio:au.id,name:'line'});out.lineDur=line.dur;
  S.evaluate(8.3);out.mouthTalk=bc.studio.mouth.scale.y;S.evaluate(9.2);out.mouthQuiet=bc.studio.mouth.scale.y;
  //  Camera: glide between two keys, then cut to a third.
  S.keyCamera({t:0,pos:[178,2,52],yaw:0,pitch:0,fov:40});S.keyCamera({t:4,pos:[186,2,52],yaw:0,pitch:0,fov:40});S.keyCamera({t:6,pos:[182,6,60],yaw:0,pitch:-.4,fov:30,cut:true});
  out.camMid=S.camAt(2).pos[0];out.camBeforeCut=S.camAt(5.9).pos[0];out.camAfterCut=S.camAt(6.01).pos[1];
  //  Scrubbing is exact: the same time gives the same pose.
  S.evaluate(1.7);const q1=JSON.stringify([bc.leftArm.rotation.toArray(),FCSoundstage.state.actors.get(a.id).char.group.position.toArray()]);S.evaluate(7);S.evaluate(1.7);const q2=JSON.stringify([bc.leftArm.rotation.toArray(),FCSoundstage.state.actors.get(a.id).char.group.position.toArray()]);out.exact=q1===q2;
  //  Save, close, reopen.
  const id=st.scene.id,clips=st.scene.clips.length;S.persist();S.close();out.restored=!State.ui.paused&&State.camera.visible&&!document.body.classList.contains('fc-soundstage');out.actorsGone=!State.scene.children.some(o=>o.name==='soundstage-actor');
  S.open(id);out.reopened=S.state.scene.clips.length===clips&&S.state.scene.actors.length===2;await new Promise(r=>setTimeout(r,300));out.audioBack=!!S.state.audio.get(au.id);
  return out});
 assert.ok(r.paused&&r.camHidden,'the stage pauses the game and takes the camera');
 assert.ok(Math.abs(r.move.start[1]-46)<.01&&r.move.mid<45.5&&r.move.mid>42.5&&Math.abs(r.move.end[1]-42)<.01,'walks from mark to point: '+JSON.stringify(r.move));
 assert.ok(r.move.walkingMid&&r.move.facing,'walking and facing the way it goes');console.log('PASS move clips walk mark to mark, eased and facing forward');
 assert.ok(r.armDuring<-1.2&&Math.abs(r.armAfter)<.2,'point raises the arm, then it rests: '+r.armDuring+' '+r.armAfter);console.log('PASS action clips blend in and out');
 assert.ok(Math.abs(r.headYaw)>.3,'looks toward the other actor: '+r.headYaw);console.log('PASS look clips turn the head');
 assert.ok(Math.abs(r.lineDur-1.4)<.05&&r.mouthTalk>1.8&&r.mouthQuiet<1.1,'mouth follows the line: '+JSON.stringify(r));console.log('PASS recorded lines move the mouth with their loudness');
 assert.ok(Math.abs(r.camMid-182)<.5&&Math.abs(r.camBeforeCut-186)<.01&&Math.abs(r.camAfterCut-6)<.01,'camera glides then cuts');console.log('PASS camera keys glide and cut');
 assert.ok(r.exact,'scrubbing is exact');console.log('PASS scrubbing lands on the same frame');
 assert.ok(r.restored&&r.actorsGone,'closing restores the game');assert.ok(r.reopened&&r.audioBack,'the scene and its audio come back');console.log('PASS scenes save, close cleanly and reopen with their audio');
 await p.screenshot({path:root+'/_test/out/soundstage.png'});
 //  Clean play hides every panel; the picture stays.
 const clean=await p.evaluate(async()=>{FCSoundstage.setClean(true);await new Promise(r=>setTimeout(r,200));const vis=id=>getComputedStyle(document.getElementById(id)).display!=='none';return{top:vis('ss-top'),tl:vis('ss-tl'),canvas:getComputedStyle(State.renderer.domElement).visibility!=='hidden'}});
 assert.ok(!clean.top&&!clean.tl&&clean.canvas,'clean frame');await p.screenshot({path:root+'/_test/out/soundstage-clean.png'});console.log('PASS clean play hides the interface');
 await p.evaluate(()=>{FCSoundstage.setClean(false);FCSoundstage.close()});
 assert.deepEqual(errors,[]);console.log('PASS no browser errors');
}finally{await browser.close();site.close?.()}})().catch(e=>{console.error(e);process.exitCode=1});
