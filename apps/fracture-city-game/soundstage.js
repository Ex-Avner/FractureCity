/* =============================================================================
 *  SOUNDSTAGE · film scenes in the city (0.88)
 * -----------------------------------------------------------------------------
 *  A timeline for directing characters where they stand in the city:
 *    Cast       any wardrobe look: yours, a crowd preset, or rerolled
 *    Move       walk or run from mark to mark
 *    Action     a library of gestures and poses (point, shrug, sit, kneel,
 *               punch, phone, smoke, cheer, cry, dance …) blended in and out
 *    Look       head (and a little torso) turns to another actor, the camera
 *               or a point
 *    Line       your recorded audio; the mouth follows its loudness
 *    Camera     keyframes (position, target, lens) that glide or cut
 *  Playback is real time, for capture with OBS. Everything is evaluated from
 *  the playhead alone, so scrubbing, replaying and takes are exact.
 *  Scenes save on this device and export to a file (with the audio inside).
 *  Open from Tools, or press F9. Esc closes.
 * ========================================================================== */
(function(){'use strict';
const VERSION=1,STORE='fc-soundstage-v1';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const TRACKS=['move','act','look','line'],TRACK_NAMES={move:'Move',act:'Action',look:'Look',line:'Line'};

// ─── Actions ────────────────────────────────────────────────────────────────
//  Each returns the bones it drives for local time k (seconds into the clip).
//  la/ra: arms [x,y,z] (x<0 is forward and up, z lifts sideways: left arm
//  outward is negative z, right arm positive); le/re: elbow bend (negative
//  folds the forearm forward; lez/rez fold it inward across the body); ll/rl: thighs [x,z] (x<0 forward); lk/rk: knees
//  (positive folds back); head/torso [x,y,z]; drop: lower the whole body;
//  lie: tip the body back; fl/fr: curl the fingers.
const S=Math.sin,ab=Math.abs;
const ACTIONS={
 talk:{label:'Talk with hands',loop:true,f:k=>({ra:[-.5+.22*S(k*2.3),0,.12],re:-1.15+.3*S(k*3.1),la:[-.3+.18*S(k*1.7+1),0,-.1],le:-.85+.2*S(k*2.6),head:[.03*S(k*1.9),.12*S(k*1.1),.03*S(k*1.4)]})},
 point:{label:'Point',f:()=>({ra:[-1.5,0,.08],re:-.05,fr:0,head:[0,0,0]})},
 wave:{label:'Wave',loop:true,f:k=>({ra:[-.2,0,2.55],re:-.75+.42*S(k*9),head:[0,0,-.05]})},
 shrug:{label:'Shrug',f:k=>{const p=S(clamp(k/1.2,0,1)*Math.PI);return{la:[-.35,0,-.35-.15*p],ra:[-.35,0,.35+.15*p],le:-1.45,re:-1.45,head:[.08,0,.16*p]}}},
 crossed:{label:'Arms crossed',f:()=>({la:[-.6,0,.42],ra:[-.6,0,-.42],le:-2,re:-2,head:[-.04,0,0]})},
 hips:{label:'Hands on hips',f:()=>({la:[.12,0,-.72],ra:[.12,0,.72],le:-.15,re:-.15,lez:1.55,rez:1.55,torso:[-.03,0,0]})},
 facepalm:{label:'Facepalm',f:()=>({ra:[-1.85,0,.32],re:-2.35,head:[.38,0,.05],torso:[.06,0,0]})},
 nod:{label:'Nod',loop:true,f:k=>({head:[.28*ab(S(k*5.5)),0,0]})},
 shake:{label:'Shake head',loop:true,f:k=>({head:[.05,.45*S(k*8),0]})},
 lookaround:{label:'Look around',loop:true,f:k=>({head:[.04,.75*S(k*1.3),0],torso:[0,.16*S(k*1.3),0]})},
 phone:{label:'On the phone',f:k=>({ra:[-.42,0,.38],re:-2.55,fr:1.2,head:[.04,0,-.12+.04*S(k*1.4)]})},
 smoke:{label:'Smoke',loop:true,f:k=>{const c=(k%4)/4,up=c<.3?smooth(c/.12)*(1-smooth((c-.2)/.1)):0;return{ra:[-.3-.62*up,0,.2],re:-.7-1.65*up,fr:.6,head:[.04-.1*up,0,0]}}},
 cheer:{label:'Cheer',loop:true,f:k=>({la:[-.15,0,-2.75],ra:[-.15,0,2.75],le:-.25,re:-.25,drop:-.04*ab(S(k*6)),head:[-.15,0,0]})},
 clap:{label:'Clap',loop:true,f:k=>{const s=Math.max(0,S(k*12));return{la:[-1.1,0,.18+.28*s],ra:[-1.1,0,-.18-.28*s],le:-1.05,re:-1.05}}},
 punch:{label:'Punch',loop:true,f:k=>{const c=(k%.7)/.7,hit=c<.35?smooth(c/.35):1-smooth((c-.35)/.65);return{ra:[-1.0-.55*hit,0,.1],re:-2.2+2.1*hit,la:[-1.05,0,-.15],le:-2.05,torso:[0,-.25*hit,0],ll:[-.25,0],rl:[.25,0],lk:.25,rk:.3}}},
 kick:{label:'Kick',loop:true,f:k=>{const c=(k%1)/1,up=c<.4?smooth(c/.4):1-smooth((c-.4)/.6);return{rl:[-1.45*up,0],rk:.9-.75*up,la:[-.5,0,-.6],ra:[-.5,0,.6],le:-1.2,re:-1.2,torso:[-.12*up,0,0]}}},
 guard:{label:'Fight stance',f:k=>({la:[-1.05,0,-.15],ra:[-1.05,0,.15],le:-2.05,re:-2.05,ll:[-.28,0],rl:[.28,0],lk:.35,rk:.35,drop:-.05+.015*S(k*4),torso:[.05,0,0],fl:1.2,fr:1.2})},
 startle:{label:'Startled',fast:true,f:()=>({la:[-.7,0,-1.15],ra:[-.7,0,1.15],le:-1.25,re:-1.25,torso:[-.12,0,0],head:[-.18,0,0],drop:.02})},
 cry:{label:'Cry',loop:true,f:k=>({la:[-1.62,0,.32],ra:[-1.62,0,-.32],le:-2.3,re:-2.3,head:[.38,0,0],torso:[.08+.03*S(k*14),0,0]})},
 think:{label:'Think',f:k=>({ra:[-1.0,0,.22],re:-2.45,la:[-.5,0,.42],le:-1.65,head:[-.05+.03*S(k),.08,.12]})},
 dance:{label:'Dance',loop:true,f:k=>{const b=S(k*6.3);return{la:[-.4,0,-1.2-.8*b],ra:[-.4,0,1.2-.8*b],le:-.8,re:-.8,ll:[-.25*b,0],rl:[.25*b,0],lk:.3+.2*ab(b),rk:.3+.2*ab(b),drop:-.06*ab(b),torso:[0,.25*b,.06*b],head:[0,.2*b,.1*b]}}},
 lean:{label:'Lean, weight on one leg',f:()=>({rl:[-.15,0],rk:.4,la:[-.6,0,.42],ra:[-.6,0,-.42],le:-2,re:-2,torso:[-.06,0,.04]})},
 sit:{label:'Sit (on a seat)',f:()=>({ll:[-1.57,-.08],rl:[-1.57,.08],lk:1.57,rk:1.57,drop:-.43,la:[-.42,0,-.05],ra:[-.42,0,.05],le:-.85,re:-.85})},
 sitground:{label:'Sit on the ground',f:()=>({ll:[-1.45,-.12],rl:[-1.45,.12],lk:.35,rk:.35,drop:-.82,la:[.55,0,-.2],ra:[.55,0,.2],le:0,re:0,torso:[-.08,0,0]})},
 kneel:{label:'Kneel',f:()=>({ll:[-1.57,0],lk:1.57,rl:[0,0],rk:1.57,drop:-.43,la:[-.3,0,-.1],ra:[-.3,0,.1],le:-.6,re:-.6})},
 liedown:{label:'Lie on back',f:()=>({lie:1,drop:.12,la:[-.15,0,-.3],ra:[-.15,0,.3],le:-.3,re:-.3,head:[-.2,0,0]})},
};

// ─── State ──────────────────────────────────────────────────────────────────
const ST={open:false,scene:null,T:0,playing:false,sel:null,clean:false,view:'free',pps:70,actors:new Map(),audio:new Map(),hideCrowd:true,guide:'off'};
let saved={scenes:[]};try{const raw=JSON.parse(localStorage.getItem(STORE)||'null');if(raw&&Array.isArray(raw.scenes))saved=raw}catch(e){}
function blankScene(){const p=Player.position,yaw=Player.yaw;return{v:VERSION,id:uid(),name:'Scene '+(saved.scenes.length+1),actors:[],clips:[],cams:[],env:{dayTime:Math.round(State.dayTime||720),hideCrowd:true},origin:[p.x,p.y-Player.height,p.z],created:Date.now(),camStart:{pos:[p.x-Math.sin(yaw)*0,p.y,p.z],yaw,pitch:Player.pitch}}}
function persist(){try{const i=saved.scenes.findIndex(s=>s.id===ST.scene.id);if(i<0)saved.scenes.unshift(ST.scene);else saved.scenes[i]=ST.scene;localStorage.setItem(STORE,JSON.stringify(saved))}catch(e){toast('This scene is too big for browser storage. Export it to a file.','warn')}}
let saveTimer=0;function dirty(){clearTimeout(saveTimer);saveTimer=setTimeout(persist,400);ST.dur=duration()}

// ─── Audio: kept in IndexedDB, loudness envelope for the mouth ─────────────
let actx=null;const ctx=()=>actx||(actx=new (window.AudioContext||window.webkitAudioContext)());
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('fc-soundstage-audio',1);r.onupgradeneeded=()=>r.result.createObjectStore('audio');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function putAudio(id,bytes,name){try{const db=await idb();await new Promise((res,rej)=>{const t=db.transaction('audio','readwrite');t.objectStore('audio').put({bytes,name},id);t.oncomplete=res;t.onerror=()=>rej(t.error)})}catch(e){}}
async function getAudio(id){try{const db=await idb();return await new Promise(res=>{const r=db.transaction('audio').objectStore('audio').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null)})}catch(e){return null}}
async function decode(id,bytes,name){const buf=await ctx().decodeAudioData(bytes.slice(0));const rate=60,n=Math.ceil(buf.duration*rate),ch=buf.getChannelData(0),env=new Float32Array(n),step=Math.floor(buf.sampleRate/rate);let peak=1e-6;
 for(let i=0;i<n;i++){let s=0;const o=i*step;for(let j=0;j<step&&o+j<ch.length;j++)s+=ch[o+j]*ch[o+j];env[i]=Math.sqrt(s/step);peak=Math.max(peak,env[i])}for(let i=0;i<n;i++)env[i]=Math.min(1,env[i]/peak*1.25);
 const a={id,name,buf,env,rate,duration:buf.duration};ST.audio.set(id,a);return a}
async function loadAudioFor(scene){for(const c of scene.clips)if(c.track==='line'&&c.audio&&!ST.audio.has(c.audio)){const rec=await getAudio(c.audio);if(rec)await decode(c.audio,rec.bytes,rec.name).catch(()=>{})}}
async function importAudio(file){const bytes=await file.arrayBuffer(),id=uid();const a=await decode(id,bytes,file.name);await putAudio(id,bytes,file.name);return a}
function envAt(id,t){const a=ST.audio.get(id);if(!a||t<0||t>a.duration)return 0;const i=t*a.rate,f=Math.floor(i),w=i-f;return lerp(a.env[f]||0,a.env[f+1]||0,w)}
let sources=[];
function stopAudio(){for(const s of sources)try{s.stop()}catch(e){}sources=[]}
function startAudio(T){stopAudio();const c=ctx();if(c.state==='suspended')c.resume();const now=c.currentTime+.05;
 for(const clip of ST.scene.clips){if(clip.track!=='line'||!clip.audio)continue;const a=ST.audio.get(clip.audio);if(!a)continue;const off=T-clip.t;if(off>=a.duration)continue;const src=c.createBufferSource(),g=c.createGain();g.gain.value=clip.gain??1;src.buffer=a.buf;src.connect(g).connect(c.destination);src.start(now+Math.max(0,-off),Math.max(0,off));sources.push(src)}}

// ─── Actors ─────────────────────────────────────────────────────────────────
function lookFor(kind){const W=window.FCWardrobe;if(kind==='you')return W.normalize(Shift.avatar);const rng=new RNG('stage-'+uid());return W.crowdLook(CHAR_ARCHETYPES[Math.floor(Math.random()*CHAR_ARCHETYPES.length)],rng)}
function buildActor(a){
 const old=ST.actors.get(a.id);if(old){old.char.group.removeFromParent();window.FCResident?.dispose?.(old.char)}
 const c=shBuildFigure({...a.look,prop:'none',auraChance:0},'studio');c.plate.visible=false;c.group.rotation.order='YXZ';c.group.name='soundstage-actor';c.group.userData.actor=a.id;
 c.group.traverse(o=>{if(o.isMesh)o.userData.stageActor=a.id});
 const rest={ll:c.leftLeg.position.clone(),rl:c.rightLeg.position.clone()};
 State.scene.add(c.group);const rec={a,char:c,rest};ST.actors.set(a.id,rec);return rec}
function clearActors(){for(const r of ST.actors.values()){r.char.group.removeFromParent();window.FCResident?.dispose?.(r.char)}ST.actors.clear()}

//  Where an actor is at time T: walk the move clips in order from the mark.
function placeAt(a,T){
 const moves=ST.scene.clips.filter(c=>c.actor===a.id&&c.track==='move').sort((p,q)=>p.t-q.t);
 let x=a.mark[0],z=a.mark[2],yaw=a.yaw||0,dist=0,speed=0,run=false;
 for(const m of moves){const to=m.to,d=Math.hypot(to[0]-x,to[1]-z);if(T<=m.t)break;const dir=Math.atan2(to[0]-x,to[1]-z);
  if(T>=m.t+m.dur){dist+=d;x=to[0];z=to[1];yaw=m.face!=null?m.face:d>.01?dir:yaw;continue}
  //  Inside the move: ease in and out, turn toward the way it walks.
  const k=(T-m.t)/m.dur,e=easeMove(k),de=(easeMove(Math.min(1,k+.01))-e)/.01;
  dist+=d*e;x=lerp(x,to[0],e);z=lerp(z,to[1],e);speed=d/m.dur*de;run=!!m.run;
  const turn=smooth(clamp((T-m.t)/.35,0,1));yaw=lerpAngle(yaw,dir,turn);break}
 const y=shSurfaceY(x,z,(a.mark[1]||1)+3);return{x,y,z,yaw,dist,speed,run}}
const easeMove=k=>{const a=.18;if(k<a)return k*k/(2*a*(1-a));if(k>1-a)return 1-(1-k)*(1-k)/(2*a*(1-a));return (k-a/2)/(1-a)};
function lerpAngle(a,b,t){let d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;return a+d*t}

//  Pose one actor at time T. Everything is set from scratch, so a scrub lands exactly.
function pose(rec,T){
 const a=rec.a,c=rec.char,s=c.studio,at=placeAt(a,T);
 c.group.position.set(at.x,at.y,at.z);c.group.rotation.set(0,at.yaw,0);
 //  Neutral
 const P={la:[0,0,-.07],ra:[0,0,.07],le:-.12,re:-.12,lez:0,rez:0,ll:[0,-.015],rl:[0,.015],lk:0,rk:0,head:[0,0,0],torso:[0,0,0],drop:0,lie:0,fl:0,fr:0};
 const sp=a.seedPhase||0,breath=S(T*1.6+sp)*.012;P.drop=breath*.5;P.head=[.03*S(T*.8+sp),0,0];
 //  Walk or run cycle from distance travelled, so the feet match the ground.
 const moving=at.speed>.05,blend=clamp(at.speed/(at.run?3:1.3),0,1),ph=at.dist*(at.run?2.1:3.2),sw=at.run?.95:.62;
 if(moving){for(const [i,l] of [['ll','lk'],['rl','rk']].entries()){const p=ph+i*Math.PI;P[l[0]]=[S(p)*sw*blend,i?.015:-.015];P[l[1]]=Math.max(0,-S(p))*(at.run?1.35:.95)*blend}
  P.la=[-S(ph)*(at.run?.9:.5)*blend,0,-.07];P.ra=[S(ph)*(at.run?.9:.5)*blend,0,.07];P.le=-.14-(at.run?1.1:.3)*blend;P.re=P.le;P.torso=[(at.run?.12:0)*blend,S(ph)*.045*blend,S(ph)*.02*blend];P.drop=-ab(S(ph))*.025*blend}
 //  Actions, blended in and out
 for(const clip of ST.scene.clips){if(clip.actor!==a.id||clip.track!=='act')continue;const k=T-clip.t;if(k<0||k>clip.dur)continue;const A=ACTIONS[clip.action];if(!A)continue;
  const fade=A.fast?.1:.3,w=Math.min(smooth(k/fade),smooth((clip.dur-k)/fade));const q=A.f(k);
  for(const key of Object.keys(q)){const v=q[key];if(Array.isArray(v))P[key]=P[key].map((b,i)=>lerp(b,v[i],w));else P[key]=lerp(P[key],v,w)}}
 //  Look
 for(const clip of ST.scene.clips){if(clip.actor!==a.id||clip.track!=='look')continue;const k=T-clip.t;if(k<0||k>clip.dur)continue;const w=Math.min(smooth(k/.35),smooth((clip.dur-k)/.35));
  const tp=lookTarget(clip.target,T);if(!tp)continue;const head=new THREE.Vector3(at.x,at.y+1.65+P.drop,at.z),dx=tp.x-head.x,dz=tp.z-head.z,dy=tp.y-head.y;
  let yaw=lerpAngle(0,Math.atan2(dx,dz)-at.yaw,1);yaw=((yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;const pitch=-Math.atan2(dy,Math.hypot(dx,dz));
  const hy=clamp(yaw,-1.1,1.1),ty=clamp(yaw-hy,-.35,.35);P.head=[lerp(P.head[0],clamp(pitch,-.5,.5),w),lerp(P.head[1],hy,w),P.head[2]];P.torso=[P.torso[0],lerp(P.torso[1],ty,w),P.torso[2]]}
 //  Apply
 //  Apply. The figure's leftArm bone hangs on its own right side (it faces +z),
 //  so "ra" (the character's right) drives leftArm with the sideways axes mirrored.
 c.leftArm.rotation.set(P.ra[0],-P.ra[1],-P.ra[2]);c.rightArm.rotation.set(P.la[0],-P.la[1],-P.la[2]);s.elbows[0].rotation.x=P.re;s.elbows[1].rotation.x=P.le;s.elbows[0].rotation.z=P.rez;s.elbows[1].rotation.z=-P.lez;
 c.leftLeg.rotation.set(P.rl[0],0,-P.rl[1]);c.rightLeg.rotation.set(P.ll[0],0,-P.ll[1]);c.leftLeg.position.copy(rec.rest.ll);c.rightLeg.position.copy(rec.rest.rl);
 s.knees[0].rotation.x=P.rk;s.knees[1].rotation.x=P.lk;c.head.rotation.set(...P.head);if(s.torso)s.torso.rotation.set(...P.torso);
 if(s.fingers){s.fingers[0].rotation.x=P.fr;s.fingers[1].rotation.x=P.fl}
 c.group.position.y=at.y+P.drop;if(P.lie)c.group.rotation.x=-Math.PI/2*P.lie;
 window.FCWardrobe?.fitSkirt?.(c);
 //  Face: deterministic blinks; the mouth follows the line's loudness.
 const bt=(T+sp*3)%4.2;s.eyes&&(s.eyes.scale.y=bt<.13?Math.max(.1,ab(1-2*bt/.13)):1);
 let open=0;for(const clip of ST.scene.clips){if(clip.actor!==a.id||clip.track!=='line')continue;const k=T-clip.t;if(k<0||k>clip.dur)continue;open=Math.max(open,clip.audio?envAt(clip.audio,k):(.5+.5*S(k*14))*.7)}
 if(s.mouth)s.mouth.scale.y=1+open*2.6;
 return at}
function lookTarget(t,T){if(!t)return null;if(t==='camera'){const c=cam;return{x:c.position.x,y:c.position.y,z:c.position.z}}if(Array.isArray(t))return{x:t[0],y:t[1],z:t[2]};const r=ST.actors.get(t);if(!r)return null;const p=placeAt(r.a,T);return{x:p.x,y:p.y+1.6,z:p.z}}

// ─── Camera ─────────────────────────────────────────────────────────────────
const cam=new THREE.PerspectiveCamera(40,1,.05,1200);cam.rotation.order='YXZ';
const free={pos:new THREE.Vector3(),yaw:0,pitch:0,fov:40};
function camAt(T){const keys=[...ST.scene.cams].sort((p,q)=>p.t-q.t);if(!keys.length)return null;
 let i=keys.findIndex(k=>k.t>T);if(i===-1)i=keys.length;const k0=keys[Math.max(0,i-1)],k1=keys[i];
 if(T<keys[0].t||!k1||k1.cut||k0.ease==='hold')return{pos:k0.pos,yaw:k0.yaw,pitch:k0.pitch,fov:k0.fov,shake:k0.shake||0};
 const raw=(T-k0.t)/(k1.t-k0.t),e=k0.ease==='linear'?raw:smooth(raw);
 return{pos:k0.pos.map((v,j)=>lerp(v,k1.pos[j],e)),yaw:lerpAngle(k0.yaw,k1.yaw,e),pitch:lerp(k0.pitch,k1.pitch,e),fov:lerp(k0.fov,k1.fov,e),shake:lerp(k0.shake||0,k1.shake||0,e)}}
function applyCam(T){const v=W.innerWidth/W.innerHeight;cam.aspect=v;
 const shot=(ST.view==='shot'||ST.playing)&&camAt(T);
 if(shot){cam.position.set(...shot.pos);const sh=shot.shake?{x:(S(T*7.1)+S(T*3.3))*.004*shot.shake,y:(S(T*6.3+1)+S(T*2.9))*.004*shot.shake}:{x:0,y:0};cam.rotation.set(shot.pitch+sh.y,shot.yaw+sh.x,0);cam.fov=shot.fov}
 else{cam.position.copy(free.pos);cam.rotation.set(free.pitch,free.yaw,0);cam.fov=free.fov}
 cam.updateProjectionMatrix()}
const W=window;

// ─── Evaluate ───────────────────────────────────────────────────────────────
function duration(){let d=6;for(const c of ST.scene.clips)d=Math.max(d,c.t+c.dur);for(const k of ST.scene.cams)d=Math.max(d,k.t);return Math.ceil(d+2)}
function evaluate(T){ST.T=clamp(T,0,ST.dur||duration());for(const rec of ST.actors.values())pose(rec,ST.T);applyCam(ST.T)}

// ─── Open and close ─────────────────────────────────────────────────────────
let prior=null,hiddenNodes=[],raf=0,last=0;
function open(sceneId){
 if(ST.open)return;if(!State.chunkMap?.size){toast('Enter the city first, then open the Soundstage.','info');return}
 document.exitPointerLock?.();window.FCQuietUI?.close?.();
 prior={paused:State.ui.paused,cam:State.camera.visible,construct:State.ui.construct,dayTime:State.dayTime};if(State.ui.construct)toggleConstructMode();
 installRender();State.ui.paused=true;State.keys?.clear?.();ST.open=true;
 const sc=saved.scenes.find(s=>s.id===sceneId);ST.scene=sc?JSON.parse(JSON.stringify(sc)):blankScene();
 free.pos.copy(State.camera.position);free.yaw=Player.yaw;free.pitch=Player.pitch;free.fov=State.camera.fov||60;
 State.camera.visible=false;if(window.FCResident?.body)FCResident.body.group.visible=false;
 for(const n of document.body.children)if(n!==State.renderer.domElement&&n!==ui&&n.tagName!=='SCRIPT'&&n.tagName!=='STYLE'&&getComputedStyle(n).visibility!=='hidden'){hiddenNodes.push([n,n.style.visibility]);n.style.visibility='hidden'}
 document.body.classList.add('fc-soundstage');ui.hidden=false;
 loadScene();raf=requestAnimationFrame(loop)}
function close(){if(!ST.open)return;pause();persist();ST.open=false;cancelAnimationFrame(raf);clearActors();crowd(false);
 for(const [n,v] of hiddenNodes)n.style.visibility=v;hiddenNodes=[];document.body.classList.remove('fc-soundstage');ui.hidden=true;
 State.camera.visible=prior.cam;if(window.FCResident?.body)FCResident.body.group.visible=true;State.dayTime=prior.dayTime;try{updateDayNight(0)}catch(e){}State.ui.paused=prior.paused;prior=null}
async function loadScene(){clearActors();for(const a of ST.scene.actors)buildActor(a);ST.dur=duration();crowd(ST.scene.env.hideCrowd);
 State.dayTime=ST.scene.env.dayTime;try{updateDayNight(0)}catch(e){}
 if(ST.scene.cams.length===0&&ST.scene.camStart){/* the free camera starts where you stood */}
 ST.sel=null;ST.T=0;drawAll();await loadAudioFor(ST.scene);drawTimeline()}
//  Hide the city's crowd and creatures so a scene holds only its cast.
let crowdHidden=[];
function crowd(hide){for(const o of crowdHidden)o.visible=true;crowdHidden=[];if(!hide)return;
 const hideObj=o=>{if(o&&o.visible){o.visible=false;crowdHidden.push(o)}};
 for(const n of State.globalNPCs||[])hideObj(n.group);for(const f of State.shopFolk||[])hideObj(f.char?.group);
 for(const e of window.FCNpcs?.entries?.values?.()||[])hideObj(e.group);for(const e of State.enemies||[])hideObj(e.mesh||e.group);
 for(const p of window.FCCityOnline?.peers?.values?.()||[])hideObj(p.group)}

// ─── Loop and input ─────────────────────────────────────────────────────────
let playFrom=0,playStart=0;
function play(){if(ST.playing)return;if(ST.T>=ST.dur-.05)ST.T=0;ST.playing=true;playFrom=ST.T;playStart=performance.now();startAudio(ST.T);paintTransport()}
function pause(){if(!ST.playing)return;ST.playing=false;stopAudio();paintTransport();if(ST.clean)setClean(false)}
function seek(T){const was=ST.playing;if(was){stopAudio()}ST.T=clamp(T,0,ST.dur);if(was){playFrom=ST.T;playStart=performance.now();startAudio(ST.T)}evaluate(ST.T);movePlayhead()}
const held=new Set();let drag=null;
function loop(now){raf=requestAnimationFrame(loop);const dt=Math.min(.05,(now-(last||now))/1000);last=now;
 if(ST.playing){const T=playFrom+(now-playStart)/1000;if(T>=ST.dur){ST.T=ST.dur;pause();if(ST.loop){ST.T=0;play()}}else ST.T=T}
 else if(ST.view==='free')flyFree(dt);
 evaluate(ST.T);movePlayhead();
 //  Draw through our camera; the game's own wrapper passes a foreign camera straight through.
 }
function flyFree(dt){const sp=(held.has('ShiftLeft')||held.has('ShiftRight')?14:4)*dt,f=new THREE.Vector3(-Math.sin(free.yaw)*Math.cos(free.pitch),Math.sin(free.pitch),-Math.cos(free.yaw)*Math.cos(free.pitch)),r=new THREE.Vector3(Math.cos(free.yaw),0,-Math.sin(free.yaw));
 if(held.has('KeyW'))free.pos.addScaledVector(f,sp);if(held.has('KeyS'))free.pos.addScaledVector(f,-sp);if(held.has('KeyD'))free.pos.addScaledVector(r,sp);if(held.has('KeyA'))free.pos.addScaledVector(r,-sp);if(held.has('KeyE'))free.pos.y+=sp;if(held.has('KeyQ'))free.pos.y-=sp}
function installRender(){const r=State.renderer;if(!r||r.soundstage)return;r.soundstage=true;const render=r.render.bind(r);
 r.render=function(scene,camera){if(ST.open&&scene===State.scene&&camera===State.camera)return render(scene,cam);return render(scene,camera)}}
addEventListener('keydown',e=>{
 if(!ST.open){if(e.code==='F9'&&!e.repeat&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();open()}return}
 const typing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);if(typing&&e.code!=='Escape')return;
 e.stopImmediatePropagation();
 if(e.code==='Escape'){e.preventDefault();if(ST.clean){setClean(false);pause()}else close();return}
 if(e.code==='Space'){e.preventDefault();ST.playing?pause():play();return}
 if(e.code==='Home'){seek(0);return}
 if(e.code==='KeyH'){setClean(!ST.clean);return}
 if(e.code==='KeyK'&&!e.repeat){keyCamera();return}
 if(e.code==='KeyV'&&!e.repeat){ST.view=ST.view==='free'?'shot':'free';paintTransport();return}
 if((e.code==='Delete'||e.code==='Backspace')&&ST.sel){e.preventDefault();removeSel();return}
 if(e.code==='ArrowLeft'){seek(ST.T-(e.shiftKey?1:1/24));return}if(e.code==='ArrowRight'){seek(ST.T+(e.shiftKey?1:1/24));return}
 held.add(e.code)},true);
addEventListener('keyup',e=>{held.delete(e.code);if(ST.open)e.stopImmediatePropagation()},true);
//  Free camera look: drag on the picture. Click an actor to select it.
addEventListener('pointerdown',e=>{if(!ST.open||e.target!==State.renderer.domElement)return;drag={x:e.clientX,y:e.clientY,moved:false};e.stopImmediatePropagation()},true);
addEventListener('pointermove',e=>{if(!ST.open||!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;if(drag.moved&&ST.view==='free'){free.yaw-=dx*.004;free.pitch=clamp(free.pitch-dy*.004,-1.5,1.5);drag.x=e.clientX;drag.y=e.clientY}},true);
addEventListener('pointerup',e=>{if(!ST.open||!drag)return;if(!drag.moved)pickActor(e);drag=null},true);
addEventListener('wheel',e=>{if(!ST.open||e.target!==State.renderer.domElement)return;e.preventDefault();free.fov=clamp(free.fov+Math.sign(e.deltaY)*2,12,100)},{passive:false,capture:true});
function pickActor(e){const ray=new THREE.Raycaster(),m=new THREE.Vector2(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);applyCam(ST.T);ray.setFromCamera(m,cam);
 const meshes=[];for(const r of ST.actors.values())r.char.group.traverse(o=>{if(o.isMesh)meshes.push(o)});const hit=ray.intersectObjects(meshes,false)[0];
 if(hit){ST.sel={kind:'actor',id:hit.object.userData.stageActor};drawAll()}}
//  The ground point under the centre of the view (the crosshair).
function aimPoint(){applyCam(ST.T);const o=cam.position.clone(),d=new THREE.Vector3(0,0,-1).applyQuaternion(cam.quaternion);
 for(let s=.5;s<80;s+=.2){const p=o.clone().addScaledVector(d,s),g=shSurfaceY(p.x,p.z,p.y);if(p.y<=g)return[+p.x.toFixed(2),g,+p.z.toFixed(2)]}
 const p=o.clone().addScaledVector(d,6);return[+p.x.toFixed(2),shSurfaceY(p.x,p.z,p.y+2),+p.z.toFixed(2)]}

// ─── Editing ────────────────────────────────────────────────────────────────
function addActor(kind='crowd'){const look=lookFor(kind),p=aimPoint(),names=['Ash','Bo','Cass','Dee','Eli','Fen','Gus','Hex','Ivy','Jax','Kit','Lux'];
 const a={id:uid(),name:kind==='you'?'You':names[ST.scene.actors.length%names.length],look,mark:p,yaw:Math.atan2(cam.position.x-p[0],cam.position.z-p[2]),seedPhase:Math.random()*6};
 ST.scene.actors.push(a);buildActor(a);ST.sel={kind:'actor',id:a.id};dirty();drawAll();return a}
function addClip(actorId,track,opts={}){const a=ST.scene.actors.find(x=>x.id===actorId);if(!a)return null;
 const c={id:uid(),actor:actorId,track,t:+(opts.t??ST.T).toFixed(3),dur:opts.dur??(track==='move'?2:track==='line'?2:2.5)};
 if(track==='move'){const from=placeAt(a,c.t),to=opts.to||aimPoint();c.to=[to[0],to[2]];c.run=!!opts.run;const d=Math.hypot(c.to[0]-from.x,c.to[1]-from.z);c.dur=opts.dur??Math.max(.6,+(d/(c.run?3.6:1.35)).toFixed(2))}
 if(track==='act')c.action=opts.action||'talk';
 if(track==='look')c.target=opts.target||'camera';
 if(track==='line'){c.audio=opts.audio||null;c.name=opts.name||'Line';c.gain=1;if(opts.audio&&ST.audio.get(opts.audio))c.dur=+ST.audio.get(opts.audio).duration.toFixed(3)}
 ST.scene.clips.push(c);ST.sel={kind:'clip',id:c.id};dirty();drawAll();return c}
function keyCamera(opts={}){applyCam(ST.T);const k={id:uid(),t:+(opts.t??ST.T).toFixed(3),pos:opts.pos||[+cam.position.x.toFixed(3),+cam.position.y.toFixed(3),+cam.position.z.toFixed(3)],yaw:opts.yaw??cam.rotation.y,pitch:opts.pitch??cam.rotation.x,fov:opts.fov??cam.fov,cut:!!opts.cut,ease:opts.ease||'smooth',shake:opts.shake||0};
 const same=ST.scene.cams.find(x=>Math.abs(x.t-k.t)<.02);if(same)Object.assign(same,{...k,id:same.id});else ST.scene.cams.push(k);ST.sel={kind:'cam',id:same?.id||k.id};dirty();drawAll();return k}
function removeSel(){const s=ST.sel;if(!s)return;if(s.kind==='clip')ST.scene.clips=ST.scene.clips.filter(c=>c.id!==s.id);if(s.kind==='cam')ST.scene.cams=ST.scene.cams.filter(c=>c.id!==s.id);
 if(s.kind==='actor'){ST.scene.actors=ST.scene.actors.filter(a=>a.id!==s.id);ST.scene.clips=ST.scene.clips.filter(c=>c.actor!==s.id);const r=ST.actors.get(s.id);if(r){r.char.group.removeFromParent();ST.actors.delete(s.id)}}
 ST.sel=null;dirty();drawAll()}
const find=s=>s?.kind==='clip'?ST.scene.clips.find(c=>c.id===s.id):s?.kind==='cam'?ST.scene.cams.find(c=>c.id===s.id):s?.kind==='actor'?ST.scene.actors.find(a=>a.id===s.id):null;

// ─── Export and import ──────────────────────────────────────────────────────
async function exportScene(){const out=JSON.parse(JSON.stringify(ST.scene));out.audio={};
 for(const c of out.clips)if(c.audio&&!out.audio[c.audio]){const rec=await getAudio(c.audio);if(rec){let bin='';const b=new Uint8Array(rec.bytes);for(let i=0;i<b.length;i+=32768)bin+=String.fromCharCode.apply(null,b.subarray(i,i+32768));out.audio[c.audio]={name:rec.name,data:btoa(bin)}}}
 const url=URL.createObjectURL(new Blob([JSON.stringify(out)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=(ST.scene.name||'scene').replace(/[^\w-]+/g,'-')+'.fcscene.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
async function importScene(file){const raw=JSON.parse(await file.text());if(!raw||raw.v!==VERSION||!Array.isArray(raw.actors)||!Array.isArray(raw.clips)||!Array.isArray(raw.cams))throw Error('That is not a Soundstage scene.');
 for(const [id,a] of Object.entries(raw.audio||{})){const bin=atob(a.data),b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);await putAudio(id,b.buffer,a.name)}
 delete raw.audio;raw.id=uid();raw.name=(raw.name||'Imported')+' (imported)';raw.actors.forEach(a=>a.look=FCWardrobe.normalize(a.look));ST.scene=raw;persist();await loadScene()}

// ─── Interface ──────────────────────────────────────────────────────────────
const css=document.createElement('style');css.textContent=`
#soundstage{position:fixed;inset:0;z-index:200000;pointer-events:none;font:12px/1.4 system-ui,-apple-system,sans-serif;color:#e9ecf1}
#soundstage[hidden]{display:none}
#soundstage .panel{pointer-events:auto;background:#0f141bf2;border:1px solid #2c3846}
#ss-top{position:absolute;left:8px;right:8px;top:8px;display:flex;gap:6px;align-items:center;padding:6px 8px;border-radius:10px;flex-wrap:wrap}
#ss-top b{font-size:13px;letter-spacing:.06em;color:#3dffb0;margin-right:6px}
#soundstage button,#soundstage select,#soundstage input{font:inherit;color:inherit;background:#1d2733;border:1px solid #3a4858;border-radius:6px;padding:5px 9px}
#soundstage button:hover{border-color:#6b8299}#soundstage button.on{background:#1f5a47;border-color:#3dffb0}
#soundstage input[type=number]{width:72px}#soundstage input[type=text]{width:150px}
#ss-time{font:600 13px ui-monospace,Menlo,monospace;min-width:120px;text-align:center}
#ss-side{position:absolute;right:8px;top:58px;width:290px;bottom:236px;border-radius:10px;padding:10px;overflow:auto}
#ss-side h4{margin:4px 0 8px;font-size:11px;letter-spacing:.12em;color:#8fa3b6}
#ss-side label{display:block;margin:6px 0}#ss-side label span{display:block;color:#8fa3b6;font-size:11px;margin-bottom:2px}
#ss-side .row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
#ss-side .cast div{display:flex;justify-content:space-between;align-items:center;padding:5px 7px;border-radius:6px;cursor:pointer}
#ss-side .cast div.sel{background:#1f5a47}
#ss-tl{position:absolute;left:8px;right:8px;bottom:8px;height:220px;border-radius:10px;display:flex;flex-direction:column;overflow:hidden}
#ss-tl .bar{display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #2c3846;flex-wrap:wrap}
#ss-lanes{position:relative;flex:1;overflow:auto}
#ss-ruler{position:sticky;top:0;height:18px;background:#121922;z-index:2;margin-left:120px;border-bottom:1px solid #2c3846}
#ss-ruler i{position:absolute;top:0;height:18px;border-left:1px solid #3a4858;font:10px ui-monospace,monospace;color:#8fa3b6;padding-left:3px;font-style:normal}
.ss-lane{position:relative;height:24px;border-bottom:1px solid #1c2530;display:flex}
.ss-lane .nm{position:sticky;left:0;width:120px;flex:none;background:#121922;z-index:1;padding:4px 8px;color:#8fa3b6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-right:1px solid #2c3846}
.ss-lane .nm b{color:#e9ecf1;font-weight:600}
.ss-lane .tk{position:relative;flex:1}
.ss-clip{position:absolute;top:2px;height:19px;border-radius:5px;padding:2px 6px;font-size:11px;white-space:nowrap;overflow:hidden;cursor:grab;box-sizing:border-box;border:1px solid #0006}
.ss-clip.sel{outline:2px solid #fff}
.ss-clip .rs{position:absolute;right:0;top:0;bottom:0;width:6px;cursor:ew-resize}
.ss-clip.move{background:#2f6fd0}.ss-clip.act{background:#c0498a}.ss-clip.look{background:#7a5bd6}.ss-clip.line{background:#d08a2f;color:#111}
.ss-key{position:absolute;top:5px;width:12px;height:12px;margin-left:-6px;transform:rotate(45deg);background:#3dffb0;cursor:grab;border:1px solid #0008}
.ss-key.cut{background:#ffd54a}.ss-key.sel{outline:2px solid #fff}
#ss-head{position:absolute;top:0;bottom:0;width:2px;background:#ff3d8b;pointer-events:none;z-index:3}
#ss-cross{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border:1px solid #fff9;border-radius:50%;pointer-events:none}
#ss-guide{position:absolute;inset:0;pointer-events:none}
#ss-guide i{position:absolute;left:0;right:0;background:#000}
body.fc-soundstage.ss-clean #ss-top,body.fc-soundstage.ss-clean #ss-side,body.fc-soundstage.ss-clean #ss-tl,body.fc-soundstage.ss-clean #ss-cross{display:none}
#ss-help{color:#8fa3b6;font-size:11px}
`;document.head.append(css);
const ui=document.createElement('div');ui.id='soundstage';ui.hidden=true;ui.innerHTML=`
<div id="ss-guide"></div><div id="ss-cross"></div>
<div id="ss-top" class="panel"><b>SOUNDSTAGE</b>
 <input type="text" id="ss-name" aria-label="Scene name">
 <button data-a="play" title="Space">▶ Play</button><button data-a="start" title="Home">⏮</button><span id="ss-time">0.00 / 0.00</span>
 <button data-a="loop">Loop</button><button data-a="view" title="V">View: free</button><button data-a="clean" title="H">Clean play</button>
 <select id="ss-guide-sel" aria-label="Frame guide"><option value="off">No guide</option><option value="2.39">2.39:1</option><option value="1.85">1.85:1</option><option value="1">1:1</option><option value="0.5625">9:16</option></select>
 <label style="display:flex;gap:4px;align-items:center">Time <input type="range" id="ss-day" min="0" max="1439" step="15" style="width:110px"></label>
 <button data-a="crowd">Crowd hidden</button>
 <select id="ss-scenes" aria-label="Saved scenes"></select><button data-a="new">New</button><button data-a="export">Export</button><button data-a="import">Import</button><button data-a="close" title="Esc">Close</button>
 <input type="file" id="ss-import" accept=".json,application/json" hidden></div>
<div id="ss-side" class="panel"></div>
<div id="ss-tl" class="panel"><div class="bar">
 <button data-a="cast-you">+ You</button><button data-a="cast-crowd">+ Actor</button>
 <span style="width:12px"></span><button data-a="key" title="K">◆ Key camera</button>
 <span id="ss-help">Fly: drag + WASD, Q/E down/up, Shift fast, wheel lens · Space play · ←/→ frame · H clean · Del removes</span>
 <span style="flex:1"></span><button data-a="zoom-out">−</button><button data-a="zoom-in">+</button></div>
 <div id="ss-lanes"><div id="ss-ruler"></div><div id="ss-rows"></div><div id="ss-head"></div></div></div>`;
//  The render hook goes in when the stage first opens, so it wraps every other camera hook.
document.addEventListener('DOMContentLoaded',()=>{document.body.append(ui);addToTools()});
if(document.readyState!=='loading'){setTimeout(()=>{if(!ui.parentNode)document.body.append(ui);addToTools()},0)}
function addToTools(){const tray=document.querySelector('#fc-tools .tray');if(!tray||tray.querySelector('[data-act=soundstage]'))return;const b=document.createElement('button');b.dataset.act='soundstage';b.textContent='Soundstage · film a scene (F9)';b.onclick=e=>{e.stopPropagation();window.FCQuietUI?.close?.();setTimeout(()=>open(),0)};const row=document.createElement('div');row.className='row';row.append(b);tray.append(row)}
setInterval(()=>{if(!document.querySelector('#fc-tools [data-act=soundstage]'))addToTools()},2000);

ui.addEventListener('pointerdown',e=>e.stopPropagation());
ui.addEventListener('click',async e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
 if(a==='play')ST.playing?pause():play();if(a==='start')seek(0);if(a==='loop'){ST.loop=!ST.loop;paintTransport()}
 if(a==='view'){ST.view=ST.view==='free'?'shot':'free';paintTransport()}if(a==='clean'){setClean(true);seek(0);play()}
 if(a==='crowd'){ST.scene.env.hideCrowd=!ST.scene.env.hideCrowd;crowd(ST.scene.env.hideCrowd);dirty();paintTransport()}
 if(a==='new'){pause();persist();ST.scene=blankScene();await loadScene()}
 if(a==='export')exportScene();if(a==='import')$('#ss-import').click();if(a==='close')close();
 if(a==='cast-you')addActor('you');if(a==='cast-crowd')addActor('crowd');if(a==='key')keyCamera();
 if(a==='zoom-in'){ST.pps=Math.min(400,ST.pps*1.4);drawTimeline()}if(a==='zoom-out'){ST.pps=Math.max(15,ST.pps/1.4);drawTimeline()}
 if(a.startsWith('add-')){const [,track]=a.split('-');addClip(b.dataset.actor,track)}
 if(a==='reroll'){const act=find(ST.sel);act.look=lookFor('crowd');buildActor(act);dirty();evaluate(ST.T)}
 if(a==='mark'){const act=find(ST.sel);act.mark=aimPoint();act.yaw=Math.atan2(cam.position.x-act.mark[0],cam.position.z-act.mark[2]);dirty();evaluate(ST.T)}
 if(a==='to-view'){const c=find(ST.sel);const p=aimPoint();c.to=[p[0],p[2]];const a2=ST.scene.actors.find(x=>x.id===c.actor),from=placeAt(a2,c.t);c.dur=Math.max(.6,+(Math.hypot(c.to[0]-from.x,c.to[1]-from.z)/(c.run?3.6:1.35)).toFixed(2));dirty();drawAll()}
 if(a==='look-point'){const c=find(ST.sel);const p=aimPoint();c.target=[p[0],p[1]+1.5,p[2]];dirty();drawAll()}
 if(a==='cam-goto'){const k=find(ST.sel);seek(k.t);ST.view='shot';paintTransport()}
 if(a==='cam-update'){const k=find(ST.sel);ST.view='free';applyCam(ST.T);Object.assign(k,{pos:[cam.position.x,cam.position.y,cam.position.z],yaw:cam.rotation.y,pitch:cam.rotation.x,fov:cam.fov});dirty();drawAll()}
 if(a==='free-from-shot'){const s=camAt(ST.T);if(s){free.pos.set(...s.pos);free.yaw=s.yaw;free.pitch=s.pitch;free.fov=s.fov}ST.view='free';paintTransport()}
 if(a==='delete')removeSel();
 if(a==='audio-load'){$('#ss-audio').click()}
});
ui.addEventListener('change',async e=>{const t=e.target;
 if(t.id==='ss-name'){ST.scene.name=t.value;dirty();paintScenes()}
 if(t.id==='ss-scenes'&&t.value){pause();persist();const sc=saved.scenes.find(s=>s.id===t.value);if(sc){ST.scene=JSON.parse(JSON.stringify(sc));await loadScene()}}
 if(t.id==='ss-import'&&t.files[0]){try{await importScene(t.files[0])}catch(err){toast(err.message,'warn')}t.value=''}
 if(t.id==='ss-guide-sel'){ST.guide=t.value;paintGuide()}
 if(t.id==='ss-day'){ST.scene.env.dayTime=+t.value;State.dayTime=+t.value;try{updateDayNight(0)}catch(err){}dirty()}
 if(t.id==='ss-audio'&&t.files[0]){const c=find(ST.sel);try{const au=await importAudio(t.files[0]);c.audio=au.id;c.name=t.files[0].name.replace(/\.[^.]+$/,'');c.dur=+au.duration.toFixed(3);dirty();drawAll()}catch(err){toast('That audio file could not be read.','warn')}t.value=''}
 const f=t.dataset.f;if(f){const o=find(ST.sel);if(!o)return;let v=t.type==='checkbox'?t.checked:t.type==='number'||t.type==='range'?+t.value:t.value;
  if(f==='target'&&v==='point')return;if(f==='face')v=t.value===''?null:+t.value*Math.PI/180;if(f==='fovd')o.fov=v;else if(f==='t'||f==='dur')o[f]=Math.max(f==='dur'?.1:0,v);else o[f]=v;
  if(f==='run'&&o.track==='move'){const a2=ST.scene.actors.find(x=>x.id===o.actor),from=placeAt(a2,o.t);o.dur=Math.max(.6,+(Math.hypot(o.to[0]-from.x,o.to[1]-from.z)/(o.run?3.6:1.35)).toFixed(2))}
  if(f==='name'&&ST.sel.kind==='actor'){}dirty();drawAll()}});
//  Drop an audio file on a Line lane to put the line there.
ui.addEventListener('dragover',e=>{if(e.target.closest('.tk'))e.preventDefault()});
ui.addEventListener('drop',async e=>{const tk=e.target.closest('.tk');if(!tk||!e.dataTransfer.files[0])return;e.preventDefault();const lane=tk.closest('.ss-lane');if(lane.dataset.track!=='line')return;
 const r=tk.getBoundingClientRect(),t=Math.max(0,(e.clientX-r.left)/ST.pps);try{const au=await importAudio(e.dataTransfer.files[0]);addClip(lane.dataset.actor,'line',{t,audio:au.id,name:e.dataTransfer.files[0].name.replace(/\.[^.]+$/,'')})}catch(err){toast('That audio file could not be read.','warn')}});

function setClean(on){ST.clean=on;document.body.classList.toggle('ss-clean',on);paintGuide()}
function paintTransport(){const q=s=>ui.querySelector(s);q('[data-a=play]').textContent=ST.playing?'❚❚ Pause':'▶ Play';q('[data-a=loop]').classList.toggle('on',!!ST.loop);q('[data-a=view]').textContent='View: '+(ST.view==='free'?'free':'shot');q('[data-a=view]').classList.toggle('on',ST.view==='shot');q('[data-a=crowd]').textContent=ST.scene?.env.hideCrowd?'Crowd hidden':'Crowd shown'}
function paintGuide(){const g=$('#ss-guide');g.innerHTML='';if(ST.guide==='off')return;const ar=+ST.guide,v=innerWidth/innerHeight;
 if(ar>v){const h=innerWidth/ar,bar=(innerHeight-h)/2;g.innerHTML=`<i style="top:0;height:${bar}px"></i><i style="bottom:0;height:${bar}px"></i>`}
 else{const w=innerHeight*ar,bar=(innerWidth-w)/2;g.innerHTML=`<i style="left:0;right:auto;top:0;bottom:0;width:${bar}px"></i><i style="right:0;left:auto;top:0;bottom:0;width:${bar}px"></i>`}
 if(!ST.clean)g.querySelectorAll('i').forEach(i=>i.style.background='#000a')}
addEventListener('resize',()=>{if(ST.open)paintGuide()});
function paintScenes(){const s=$('#ss-scenes');s.innerHTML='<option value="">Open scene…</option>'+saved.scenes.map(x=>`<option value="${x.id}">${esc(x.name)}${x.id===ST.scene.id?' (open)':''}</option>`).join('')}
function drawAll(){if(!ST.open)return;$('#ss-name').value=ST.scene.name;$('#ss-day').value=ST.scene.env.dayTime;paintScenes();paintTransport();paintGuide();drawSide();drawTimeline();evaluate(ST.T)}
function fmt(t){return t.toFixed(2)}
function movePlayhead(){const h=$('#ss-head');if(h)h.style.left=(120+ST.T*ST.pps)+'px';const tm=$('#ss-time');if(tm)tm.textContent=fmt(ST.T)+' / '+fmt(ST.dur||0)}
function drawTimeline(){if(!ST.open)return;ST.dur=duration();const w=ST.dur*ST.pps;
 const ruler=$('#ss-ruler');ruler.style.width=w+'px';const step=ST.pps>140?.5:ST.pps>50?1:ST.pps>25?2:5;let r='';for(let t=0;t<=ST.dur;t+=step)r+=`<i style="left:${t*ST.pps}px">${t}s</i>`;ruler.innerHTML=r;
 const sel=ST.sel?.id;let html=`<div class="ss-lane" data-track="cam"><div class="nm"><b>Camera</b></div><div class="tk" style="min-width:${w}px">${ST.scene.cams.map(k=>`<div class="ss-key${k.cut?' cut':''}${k.id===sel?' sel':''}" data-cam="${k.id}" style="left:${k.t*ST.pps}px" title="${k.cut?'Cut':'Glide'} · ${fmt(k.t)}s"></div>`).join('')}</div></div>`;
 for(const a of ST.scene.actors)for(const tr of TRACKS){const clips=ST.scene.clips.filter(c=>c.actor===a.id&&c.track===tr);
  html+=`<div class="ss-lane" data-track="${tr}" data-actor="${a.id}"><div class="nm">${tr==='move'?'<b>'+esc(a.name)+'</b> ':''}${TRACK_NAMES[tr]}</div><div class="tk" style="min-width:${w}px">${clips.map(c=>`<div class="ss-clip ${tr}${c.id===sel?' sel':''}" data-clip="${c.id}" style="left:${c.t*ST.pps}px;width:${Math.max(8,c.dur*ST.pps)}px">${esc(clipLabel(c))}<span class="rs"></span></div>`).join('')}</div></div>`}
 if(!ST.scene.actors.length)html+=`<div style="padding:14px 130px;color:#8fa3b6">Add a cast member: + You or + Actor puts them where the crosshair points.</div>`;
 $('#ss-rows').innerHTML=html;movePlayhead()}
function clipLabel(c){if(c.track==='move')return(c.run?'Run':'Walk')+' '+fmt(c.dur)+'s';if(c.track==='act')return ACTIONS[c.action]?.label||c.action;if(c.track==='look'){const t=c.target;return 'Look at '+(t==='camera'?'camera':Array.isArray(t)?'point':ST.scene.actors.find(a=>a.id===t)?.name||'?')}return (c.audio?'♪ ':'')+(c.name||'Line')}
function drawSide(){const s=ST.sel,o=find(s),side=$('#ss-side');let h=`<h4>CAST</h4><div class="cast">${ST.scene.actors.map(a=>`<div data-cast="${a.id}" class="${s?.kind==='actor'&&s.id===a.id?'sel':''}"><span>${esc(a.name)}</span><span style="color:#8fa3b6">${(a.look.scene||a.look.outfit||'')}</span></div>`).join('')||'<p style="color:#8fa3b6">No one yet.</p>'}</div>`;
 if(s?.kind==='actor'&&o){h+=`<h4>${esc(o.name).toUpperCase()}</h4><label><span>Name</span><input type="text" data-f="name" value="${esc(o.name)}"></label><div class="row"><button data-a="mark">Move mark to crosshair</button><button data-a="reroll">New look</button></div>
  <div class="row">${TRACKS.map(t=>`<button data-a="add-${t}" data-actor="${o.id}">+ ${TRACK_NAMES[t]}</button>`).join('')}</div><p style="color:#8fa3b6">Clips go in at the playhead. Move walks to the crosshair. Drop an audio file on a Line lane to place a line.</p><div class="row"><button data-a="delete">Remove ${esc(o.name)}</button></div>`}
 if(s?.kind==='clip'&&o){const a=ST.scene.actors.find(x=>x.id===o.actor);h+=`<h4>${TRACK_NAMES[o.track].toUpperCase()} · ${esc(a?.name)}</h4><label><span>Start (s)</span><input type="number" step="0.05" data-f="t" value="${fmt(o.t)}"></label><label><span>Length (s)</span><input type="number" step="0.05" data-f="dur" value="${fmt(o.dur)}"></label>`;
  if(o.track==='move')h+=`<label><input type="checkbox" data-f="run" ${o.run?'checked':''}> Run</label><div class="row"><button data-a="to-view">Walk to crosshair</button></div><label><span>Face at the end (degrees, blank = keep walking direction)</span><input type="number" step="15" data-f="face" value="${o.face==null?'':Math.round(o.face*180/Math.PI)}"></label>`;
  if(o.track==='act')h+=`<label><span>Action</span><select data-f="action">${Object.entries(ACTIONS).map(([k,v])=>`<option value="${k}" ${k===o.action?'selected':''}>${v.label}</option>`).join('')}</select></label>`;
  if(o.track==='look')h+=`<label><span>Look at</span><select data-f="target"><option value="camera" ${o.target==='camera'?'selected':''}>The camera</option>${ST.scene.actors.filter(x=>x.id!==o.actor).map(x=>`<option value="${x.id}" ${o.target===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}${Array.isArray(o.target)?'<option value="point" selected>A point</option>':''}</select></label><div class="row"><button data-a="look-point">Look at crosshair</button></div>`;
  if(o.track==='line')h+=`<label><span>Line</span><input type="text" data-f="name" value="${esc(o.name)}"></label><div class="row"><button data-a="audio-load">${o.audio?'Replace audio…':'Load audio…'}</button></div><input type="file" id="ss-audio" accept="audio/*" hidden>${o.audio&&!ST.audio.get(o.audio)?'<p style="color:#ffb347">Audio not found on this device.</p>':''}<label><span>Volume</span><input type="range" min="0" max="1.5" step=".05" data-f="gain" value="${o.gain??1}"></label><p style="color:#8fa3b6">The mouth follows the loudness. Without audio it mouths for the clip's length.</p>`;
  h+=`<div class="row"><button data-a="delete">Delete clip</button></div>`}
 if(s?.kind==='cam'&&o)h+=`<h4>CAMERA KEY</h4><label><span>Time (s)</span><input type="number" step="0.05" data-f="t" value="${fmt(o.t)}"></label><label><span>Lens (vertical field of view, degrees)</span><input type="number" step="1" data-f="fovd" value="${Math.round(o.fov)}"></label><label><input type="checkbox" data-f="cut" ${o.cut?'checked':''}> Cut to this shot (no glide in)</label><label><span>Into the next key</span><select data-f="ease"><option value="smooth" ${o.ease==='smooth'?'selected':''}>Ease</option><option value="linear" ${o.ease==='linear'?'selected':''}>Linear</option><option value="hold" ${o.ease==='hold'?'selected':''}>Hold</option></select></label><label><span>Handheld</span><input type="range" min="0" max="3" step=".25" data-f="shake" value="${o.shake||0}"></label><div class="row"><button data-a="cam-goto">Look through</button><button data-a="cam-update">Set from free view</button><button data-a="free-from-shot">Free view from here</button></div><div class="row"><button data-a="delete">Delete key</button></div>`;
 if(!s)h+=`<h4>HOW IT WORKS</h4><p style="color:#8fa3b6;line-height:1.6">Fly the free camera to frame the set. <b>+ Actor</b> places someone at the crosshair. Select them to add Move, Action, Look and Line clips at the playhead. <b>◆ Key camera</b> stores the view at the playhead; keys glide unless marked Cut. <b>View: shot</b> looks through the keyed camera. <b>Clean play</b> hides all of this and plays from the start for capture.</p>`;
 side.innerHTML=h}
//  Timeline: click to seek, drag clips and keys, drag right edge to resize.
let tdrag=null;
ui.addEventListener('pointerdown',e=>{const lanes=e.target.closest('#ss-lanes');if(!lanes)return;const clip=e.target.closest('.ss-clip'),key=e.target.closest('.ss-key'),cast=e.target.closest('[data-cast]');
 if(clip){const c=ST.scene.clips.find(x=>x.id===clip.dataset.clip);ST.sel={kind:'clip',id:c.id};tdrag={kind:e.target.classList.contains('rs')?'size':'move',o:c,x:e.clientX,t:c.t,dur:c.dur};drawSide();drawTimeline();e.preventDefault();return}
 if(key){const k=ST.scene.cams.find(x=>x.id===key.dataset.cam);ST.sel={kind:'cam',id:k.id};tdrag={kind:'move',o:k,x:e.clientX,t:k.t};drawSide();drawTimeline();e.preventDefault();return}
 const tk=e.target.closest('.tk')||e.target.closest('#ss-ruler');if(tk){const r=tk.getBoundingClientRect();seek((e.clientX-r.left)/ST.pps);tdrag={kind:'scrub',el:tk}}});
ui.addEventListener('pointerdown',e=>{const c=e.target.closest('[data-cast]');if(c){ST.sel={kind:'actor',id:c.dataset.cast};drawSide();drawTimeline()}});
addEventListener('pointermove',e=>{if(!tdrag)return;if(tdrag.kind==='scrub'){const r=tdrag.el.getBoundingClientRect();seek((e.clientX-r.left)/ST.pps);return}
 const dt=(e.clientX-tdrag.x)/ST.pps,snap=v=>Math.round(v*24)/24;if(tdrag.kind==='move')tdrag.o.t=Math.max(0,snap(tdrag.t+dt));else tdrag.o.dur=Math.max(.1,snap(tdrag.dur+dt));drawTimeline();evaluate(ST.T)});
addEventListener('pointerup',()=>{if(tdrag&&tdrag.kind!=='scrub'){dirty();drawSide()}tdrag=null});

window.FCSoundstage={open,close,get state(){return ST},ACTIONS,addActor,addClip,keyCamera,seek,play,pause,evaluate,placeAt,camAt,exportScene,importScene,importAudio,decode,persist,get camera(){return cam},free,aimPoint,removeSel,setClean,crowd};
})();
