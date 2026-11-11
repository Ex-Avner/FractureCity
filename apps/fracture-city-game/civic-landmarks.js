/* Civic Walk: grounded architecture, local creative play, no background requests. */
(function(){'use strict';
if(typeof THREE==='undefined'||typeof Chunk==='undefined')return;
const TAU=Math.PI*2,KEYS=new Set(['3,-2','4,-2','3,-1','4,-1']);
const sites=[
 {id:'sanctuary',name:'The House of Many Lights',x:102,z:20,sub:'CHURCH OF OMNISM',color:0xffcf8c},
 {id:'archive',name:'The Mnemonic Archive',x:86,z:-24,sub:'FREE COLLEGE / LEARN • PRACTICE • INVESTIGATE',color:0x81e0dc},
 {id:'salon',name:'The Resonance House',x:106,z:-24,sub:'MUSIC / CONVERSATION / COMPANY',color:0xe8a4be},
 {id:'walk',name:'The Civic Walk',x:112,z:19,sub:'THREE PLACES TO DISCOVER',color:0xffcf8c}
];
const props=[...[80,92].flatMap(x=>[-37,-33,-18,-14].map(z=>({x,z,w:1.3,d:2.7,h:3.6}))),...[80,92,100,112].flatMap(x=>(x<98?[-28]:[-32,-16]).map(z=>({x,z,w:1.2,d:3.1,h:.7}))),...sites.slice(0,3).map(s=>({x:s.x,z:s.z,w:1.5,d:1.5,h:1.2})),{x:102,z:28,w:1.5,d:1.5,h:1.2}];
const gen=Chunk.prototype.generate;
Chunk.prototype.generate=function(){
 if(!KEYS.has(this.key)){
  const r=gen.apply(this,arguments);
  if(window.FCOmnism?.KEYS.has(this.key))colliders(this,props.filter(p=>p.z>0));
  return r;
 }
 this._maker=true;this.__cityFitted=1;this._parked=true;this.landmark='civic-walk';
 for(let lx=0;lx<VOX_W;lx++)for(let lz=0;lz<VOX_W;lz++){
  const x=this.originX+lx,z=this.originZ+lz;
  this.vSet(lx,0,lz,(lx===1||lz===1)?B_PAINT:B_ASPHALT);
  if(x<77||x>=115||z< -43||z>=-5)continue;
  this.vSet(lx,1,lz,(x===95||x===96||z===-7)?172:170);
  for(const [a,b]of [[78,94],[98,114]]){
   if(x<a||x>=b||z< -41||z>=-9)continue;
   this.vSet(lx,1,lz,173);
   const wall=x===a||x===b-1||z===-41||z===-10;
   if(!wall)continue;
   const door=z===-10&&x>=a+5&&x<a+11;
   const slit=(x===a||x===b-1)&&(z+41)%7>=2&&(z+41)%7<=4;
   for(let y=2;y<10;y++)if(!(door&&y<8))this.vSet(lx,y,lz,slit&&y>=4&&y<8?171:y===9?172:170);
  }
 }
 colliders(this,props.filter(p=>p.z<0));
};
function colliders(c,list){for(const p of list)if(chunkCoordOf(p.x)===c.cx&&chunkCoordOf(p.z)===c.cz)c.collisionAABBs.push({minX:p.x-p.w/2,maxX:p.x+p.w/2,minZ:p.z-p.d/2,maxZ:p.z+p.d/2,minY:2,maxY:2+p.h,civic:true});}
let root,scene,resources=[],lamps=[],rings=[],panel,near,priorPause,oldFocus,audio,tones=[],seed,progress;
const fresh=()=>({light:0,rings:[0,0,0],solved:false,visited:[],prompt:0});
function state(){if(seed!==String(State.citySeed)){seed=String(State.citySeed);progress=fresh();try{const j=JSON.parse(localStorage.getItem('fc-civic-v1:'+seed)||'null');if(j){progress.light=[0,1,2,3].includes(j.light)?j.light:0;progress.rings=[0,1,2].map(i=>Number.isInteger(j.rings?.[i])?((j.rings[i]%4)+4)%4:0);progress.solved=j.solved===true;progress.visited=Array.isArray(j.visited)?j.visited.filter(x=>sites.some(s=>s.id===x)):[];progress.prompt=Number.isInteger(j.prompt)?Math.abs(j.prompt)%questions.length:0;}}catch{} }return progress;}
function save(){try{localStorage.setItem('fc-civic-v1:'+seed,JSON.stringify(progress));return true;}catch{return false;}}
function dispose(){root?.removeFromParent();for(const r of new Set(resources))r.dispose?.();resources=[];lamps=[];rings=[];root=null;scene=null;}
function build(){
 if(root&&scene===State.scene){if(root.parent!==scene)scene.add(root);return;}if(root)dispose();scene=State.scene;root=new THREE.Group();root.name='civic-landmarks';scene.add(root);
 const mat=(color,glow=false)=>{const m=glow?new THREE.MeshBasicMaterial({color}):new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.18});resources.push(m);return m;};
 const stone=mat(0xc4b99f),dark=mat(0x242e35),bronze=mat(0xb88c52),teal=mat(0x83d6d3,true),rose=mat(0xf0afc3,true),gold=mat(0xffd59b,true);
 const batches=new Map(),dummy=new THREE.Object3D();
 function box(m,x,y,z,w,h,d,rz=0,ry=0){if(!batches.has(m))batches.set(m,[]);batches.get(m).push([x,y,z,w,h,d,rz,ry]);}
 function mesh(g,m,x,y,z){resources.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);root.add(o);return o;}
 function ring(m,x,y,z,r,t=.08,rx=0,ry=0){const o=mesh(new THREE.TorusGeometry(r,t,6,48),m,x,y,z);o.rotation.set(rx,ry,0);return o;}
 function sign(title,subtitle,x,y,z,w,ry=0){const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d');g.fillStyle='#17232a';g.fillRect(0,0,1024,256);g.strokeStyle='#bda275';g.lineWidth=5;g.strokeRect(12,12,1000,232);g.textAlign='center';g.fillStyle='#ffebc6';let fs=64;g.font=fs+'px Georgia';while(g.measureText(title).width>950){g.font=(--fs)+'px Georgia';}g.fillText(title,512,113);g.font='25px system-ui';g.fillStyle='#a9cfce';g.fillText(subtitle,512,183);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;resources.push(t);const m=new THREE.MeshBasicMaterial({map:t});resources.push(m);mesh(new THREE.PlaneGeometry(w,w/4),m,x,y,z).rotation.y=ry;}
 // Church: a second order of slender stone ribs and a suspended constellation.
 for(let i=0;i<16;i++){
  const a=i/16*TAU,x=96+Math.cos(a)*12.8,z=24+Math.sin(a)*12.8;
  // Upper ribs do not obstruct the original twelve reading stations.
  box(bronze,x,10,z,.15,5,.15);box(stone,x,12.8,z,.55,.6,.55);
  const bx=96+Math.cos(a)*6.8,bz=24+Math.sin(a)*6.8;
  box(bronze,bx,12.5,bz,.025,7,.025);mesh(new THREE.OctahedronGeometry(.18),i%2?teal:gold,bx,9,bz);
 }
 ring(bronze,96,13.2,24,11.8,.14,Math.PI/2);
 ring(gold,96,10.4,24,6.8,.045,Math.PI/2);
 ring(bronze,96,16,24,8,.09,Math.PI/2);
 // A visible threshold, four clear metres through the east entrance.
 for(const z of [20,28]){box(stone,113,5,z,.6,6,.6);box(bronze,113,8.1,z,.9,.2,.9);}
 box(stone,113,8.6,24,1,1,9);box(gold,113.53,8.4,24,.04,.10,7.5);
 sign('THE CIVIC WALK','NORTH: ARCHIVE + RESONANCE HOUSE',114,4.1,19,3.3,Math.PI/2);
 for(const z of [20,28]){
  mesh(new THREE.CylinderGeometry(.75,.62,.25,12),bronze,102,3.1,z);mesh(new THREE.CylinderGeometry(.35,.6,1,8),dark,102,2.5,z);
  const m=mat(0xffcf8c,true),o=mesh(new THREE.OctahedronGeometry(.48),m,102,4,z);lamps.push(o);
  ring(bronze,102,4,z,.82,.035,0,Math.PI/2);
 }
 sign('HOUSE OF MANY LIGHTS','A PERSONAL REFLECTION / E TO BEGIN',102,5.3,19.8,3.5);
 // Archive: repeated limestone vaults, deep bronze reveals and a broken crown.
 for(const z of [-38,-31,-24,-17,-11]){
  const arch=mesh(new THREE.TorusGeometry(7.3,.3,6,24,Math.PI),stone,86,9.8,z);arch.scale.y=1.22;
  for(const x of [78.7,93.3])box(bronze,x,6,z,.17,8,.32);
 }
 for(const side of [-1,1])for(let i=0;i<4;i++)box(stone,86+side*(1.6+i*1.65),16.9-i*1.25,-25,2,.24,30,-side*.65);
 box(teal,86,17.8,-25,.2,.12,30);
 for(const z of [-37,-33,-18,-14])for(const x of [80,92]){
  box(dark,x,3.8,z,1.1,3.6,2.7);
  for(let j=0;j<8;j++)box(j%3?bronze:stone,x+(x<86?.58:-.58),2.4+j*.4,z,.08,.2,2.35);
 }
 // Archive's playable orrery; the rings visibly turn after each choice.
 mesh(new THREE.CylinderGeometry(.75,.75,1.2,12),dark,86,2.6,-24);
 for(let i=0;i<3;i++){const o=ring(i===1?gold:teal,86,5,-24,1.35+i*.5,.07,0,i*.5);rings.push(o);}
 mesh(new THREE.IcosahedronGeometry(.5,0),bronze,86,5,-24);
 for(let i=0;i<3;i++){const o=mesh(new THREE.OctahedronGeometry(.7-i*.12),stone,86+i*.9,20+i*1.3,-25);o.rotation.z=.5+i*.4;}
 sign('THE MNEMONIC ARCHIVE','FREE COLLEGE / START YOUR FIRST COURSE',86,10.7,-8.94,11);
 sign('ASK / READ / TEST','FREE COLLEGE / ALL WELCOME',86,5.4,-39.85,8);
 // Resonance House: a fan of suspended bronze sails above a rose-lit salon.
 for(let i=0;i<9;i++){
  const z=-39+i*3.5,peak=13+Math.sin(i/8*Math.PI)*4;
  for(const side of [-1,1])box(i%2?bronze:stone,106+side*3.7,peak-2,z,8.2,.25,2.7,-side*.48);
  box(rose,106,peak-.2,z,.18,.12,2.8);
 }
 for(const x of [99,113])for(const z of [-37,-30,-23,-16]){box(bronze,x,7,z,.18,10,.18);box(rose,x,4,z,.12,2,.12);}
 mesh(new THREE.CylinderGeometry(.75,.75,1.1,16),dark,106,2.55,-24);
 for(let i=0;i<5;i++)box(i%2?rose:gold,105.4+i*.3,3.15,-24,.23,.12,.8);
 for(let i=0;i<7;i++){const x=103+i;box(bronze,x,6.8,-37,.18,5+Math.sin(i)*1.4,.18);ring(rose,x,4.2,-37,.23,.035);}
 sign('THE RESONANCE HOUSE','ENTER / PLAY THE LIGHT / START A CONVERSATION',106,10.7,-8.94,11);
 sign('A ROOM FOR COMPANY','FIVE NOTES. NO WRONG ANSWERS.',106,4.2,-39.85,8);
 // Bench forms sit against walls; block collisions match their full footprint.
 for(const x of [80,92,100,112])for(const z of (x<98?[-28]:[-32,-16])){
  box(stone,x,2.3,z,1.1,.6,3);box(bronze,x,2.65,z,1.2,.1,3.1);
 }
 // Ground-level golden thread leads from church forecourt to both front doors.
 for(const z of [-6,-3,0,3])box(gold,113.7,2.025,z,.14,.03,1.1);
 for(const x of [86,106]){box(bronze,x,2.03,-6,3,.04,.3);sign(x===86?'ARCHIVE ↑':'RESONANCE ↑','OPEN TO EVERYONE',x,3.4,-6.6,3.8);}
 for(const [m,list]of batches){const g=new THREE.BoxGeometry(1,1,1);resources.push(g);const inst=new THREE.InstancedMesh(g,m,list.length);list.forEach(([x,y,z,w,h,d,rz,ry],i)=>{dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,ry,rz);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});inst.instanceMatrix.needsUpdate=true;root.add(inst);}
 root.traverse(o=>{if(o.isMesh){o.userData._hdTag=1;o.castShadow=false;o.receiveShadow=false;}});
}
const questions=['What would you preserve if the city forgot everything tomorrow?','Which place made you feel welcome before anyone spoke?','What is something you changed your mind about?','If this city could dream, what would it dream of?','What would you build here for a stranger?','What song belongs to a place you miss?'];
const notes=['C','D','E','G','A'],frequencies=[261.63,293.66,329.63,392,440];
function stopSound(){for(const t of tones){try{t.stop();}catch{}}tones=[];}
async function play(i){
 if(!panel||near?.id!=='salon')return;
 try{audio ||= new (window.AudioContext||window.webkitAudioContext)();await audio.resume();if(!panel||near?.id!=='salon')return;const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=frequencies[i];g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.12,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+1.3);o.connect(g);g.connect(audio.destination);o.start();o.stop(t+1.4);tones.push(o);o.onended=()=>{o.disconnect();g.disconnect();tones=tones.filter(a=>a!==o);};status('Played '+notes[i]+'. Sound is local to your device.');}catch{status('Audio is unavailable on this device. You can still use the conversation cards.');}
}
const prompt=document.createElement('button');prompt.id='civic-approach';prompt.hidden=true;document.body.append(prompt);prompt.onclick=()=>near&&open(near.id);
const css=document.createElement('style');css.textContent=`
#civic-approach{position:fixed;bottom:116px;left:50%;transform:translateX(-50%);z-index:125002;max-width:calc(100vw - 32px);padding:12px 20px;border:1px solid #c2a676;border-radius:24px;background:#14222bed;color:#ffe9c6;font:600 14px system-ui;cursor:pointer}#civic-approach[hidden]{display:none}
.civic-panel{position:fixed;inset:6vh max(12px,calc((100vw - 850px)/2));z-index:145000;overflow:auto;background:linear-gradient(145deg,#132a33,#15191f 70%);border:1px solid #a89371;border-radius:22px;color:#eee4d2;padding:clamp(18px,4vw,42px);box-shadow:0 0 0 100vmax #05090dbb;font:16px/1.65 system-ui}.civic-panel *{box-sizing:border-box}.civic-panel h1{font:clamp(30px,5vw,46px)/1.1 Georgia;margin:20px 0}.civic-panel h2{font:25px Georgia}.civic-panel small{color:#91cbca;letter-spacing:.12em}.civic-panel button{font:600 15px system-ui;min-height:46px;padding:12px 16px;border-radius:12px;background:#26383f;border:1px solid #70898d;color:#fff0d3;cursor:pointer}.civic-panel button:hover,.civic-panel button:focus-visible{background:#39565d;outline:2px solid #e3bf85}.civic-actions{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}.civic-card{padding:20px;background:#ffffff07;border:1px solid #ffffff20;border-radius:16px;margin:18px 0}.civic-panel blockquote{margin:0;font:24px/1.6 Georgia}.civic-close{float:right}.civic-panel [role=status]{min-height:28px;color:#f6d294}.civic-panel a{color:#a7e5df}@media(max-width:600px){.civic-panel{inset:8px;padding:20px;border-radius:14px;padding-bottom:max(24px,env(safe-area-inset-bottom))}#civic-approach{bottom:180px;font-size:13px}}
`;document.head.append(css);
function blocked(){return State.ui.paused||State.ui.inIntro||State.ui.inDialogue||State.ui.inInventory||State.ui.inArcade||State.ui.inMiniGame||State.ui.inShiftPanel||State.ui.construct||window.CityArt?.panelOpen||window.CityBuild?.panelOpen||window.OwnBlock?.modal||window.FCAccounts?.visible;}
function status(s){const el=panel?.querySelector('[role=status]');if(el)el.textContent=s;}
function open(id){
 if(panel||blocked())return;const s=sites.find(a=>a.id===id);if(!s)return;
 // Public calls also require physical proximity; no remote reward or teleport shortcut.
 if(Math.hypot(Player.position.x-s.x,Player.position.z-s.z)>3||Math.abs(Player.position.y-Player.height-2)>1.3)return;
 near=s;state();priorPause=State.ui.paused;oldFocus=document.activeElement;State.ui.paused=true;State.keys?.clear?.();window.Mobile?.releaseUse?.();if(typeof shTouchReleaseAll==='function')shTouchReleaseAll();document.exitPointerLock?.();prompt.hidden=true;
 panel=document.createElement('section');panel.className='civic-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',s.name);document.body.append(panel);
 if(id!=='walk'&&!progress.visited.includes(id)){progress.visited.push(id);save();}
 render();panel.addEventListener('click',click);panel.querySelector('button')?.focus();
}
function close(){if(!panel)return;panel.remove();panel=null;stopSound();State.ui.paused=priorPause;State.keys?.clear?.();oldFocus?.focus?.();}
function render(){
 if(!panel)return;const s=near,p=state();let content='';
 if(s.id==='sanctuary')content=`<p>Scriptures and mythic poetry surround a shared table. This new sanctuary offers a moment of reflection alongside the library, without pretending that different beliefs are the same.</p><div class="civic-card"><h2>Leave a light</h2><p>Choose an intention. The paired lanterns change color in the room. This is a fictional, personal activity, not a religious rite.</p><div class="civic-actions">${['Remember / amber','Welcome / teal','Begin again / rose'].map((n,i)=>`<button data-light="${i+1}" aria-pressed="${p.light===i+1}">${n}</button>`).join('')}</div></div><h2>Choose a reading journey</h2><p>Read the sources in their own voices. These starting points are invitations, not claims that the traditions teach identical things.</p><div class="civic-actions"><button data-work="greek-myths">Origins / Greek poetry</button><button data-work="norse-myths">Wisdom / Norse poetry</button><button data-work="tao">The way / Tao Te Ching</button><button data-work="dhammapada">Conduct / Dhammapada</button></div><h2>Explore the house</h2><p>At the center: the Guide and the complete library index. Around the walls: ten scripture stations. The north and south inner stands hold Greek and Norse mythic poetry.</p><div class="civic-actions"><button data-library>Open the library guide</button></div><p>Reflection: What can you learn from a tradition without claiming it as your own?</p>`;
 if(s.id==='archive')content=`<p>The Archive is now the first home of FractureCity Free College. Learn real reasoning skills, keep a notebook and investigate a case.</p><div class="civic-card"><small>THINKING 101 / FREE / SELF-PACED</small><h2>Critical Thinking and the Art of Asking Questions</h2><p>Six units. Worked examples. Practice with explanations. Unit tests, a final assessment, and a written investigation you can keep.</p><button data-college>Start or resume my course</button></div><p>No prerequisites. About 3–4 hours. Free, non-accredited pilot; open-book tests and a self-assessed project. You can also resume from Tools or the mobile menu.</p>`;
 if(s.id==='salon')content=`<p>A folded bronze roof gathers around an instrument with five notes. Bring another player here, make a little music, or use a question to start talking.</p><div class="civic-card"><h2>Play the light</h2><div class="civic-actions">${notes.map((n,i)=>`<button data-note="${i}" aria-label="Play ${n}">${n}</button>`).join('')}</div><p>Sound plays only on your device. No microphone, recording, or autoplay.</p></div><div class="civic-card"><small>A QUESTION FOR THE ROOM</small><blockquote>${questions[p.prompt]}</blockquote><div class="civic-actions"><button data-question>Another question</button></div></div><p>Use the city’s existing chat to share your answers with nearby company.</p>`;
 if(s.id==='walk')content=`<p>Three destinations, each with an open doorway and something to discover. Progress is personal to this browser and world.</p>${sites.slice(0,3).map((a,i)=>`<div class="civic-card"><small>0${i+1} / ${p.visited.includes(a.id)?'VISITED':'UNDISCOVERED'}</small><h2>${a.name}</h2><p>${['Enter the church to the west. The paired lanterns are just inside, right of the doorway.','Follow the street north across the junction. Take the left doorway beneath the ribbed roof.','Beside the archive: the right doorway under the folded bronze roof.'][i]}</p></div>`).join('')}`;
 panel.innerHTML=`<button class="civic-close" data-close aria-label="Close">Close · Esc</button><small>${s.sub}</small><h1>${s.name}</h1>${content}<p role="status" aria-live="polite"></p><small>THE CIVIC WALK / ${p.visited.length} OF 3 PLACES VISITED</small>`;
}
function click(e){const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-close'))return close();
 if(b.hasAttribute('data-college')){close();window.FCCollege?.open();return;}
 if(b.dataset.work){const id=b.dataset.work;close();FCOmnism.open({kind:'work',id});return;}
 if(b.hasAttribute('data-library')){close();FCOmnism.open({kind:'guide'});return;}
 let msg='';
 if(b.dataset.note!==undefined)return void play(+b.dataset.note);
 if(b.dataset.light!==undefined){progress.light=+b.dataset.light;msg='Your intention is lit. Step back to see the lanterns.';}
 if(b.dataset.ring!==undefined)progress.rings[+b.dataset.ring]=(progress.rings[+b.dataset.ring]+1)%4;
 if(b.hasAttribute('data-check')){const ok=progress.rings.join(',')==='1,2,3';if(ok)progress.solved=true;msg=ok?'Memory restored. The archive remembers.':'The memory is still scattered. Follow the inscription: Root, Tide, Star.';}
 if(b.hasAttribute('data-question'))progress.prompt=(progress.prompt+1)%questions.length;
 const focusKey=b.dataset.ring!==undefined?`[data-ring="${b.dataset.ring}"]`:b.dataset.light!==undefined?`[data-light="${b.dataset.light}"]`:b.hasAttribute('data-question')?'[data-question]':'[data-check]';
 const saved=save();render();panel.querySelector(focusKey)?.focus();status(saved?msg:'Your change is active, but browser storage is unavailable; it will not survive reloading.');
}
addEventListener('keydown',e=>{if(panel){if(e.code==='Escape'){e.preventDefault();close();}if(e.code==='Tab'){const a=[...panel.querySelectorAll('button,a')],i=a.indexOf(document.activeElement);e.preventDefault();a[(i+(e.shiftKey?-1:1)+a.length)%a.length]?.focus();}e.stopImmediatePropagation();return;}if(e.code==='KeyE'&&!e.repeat&&!prompt.hidden){e.preventDefault();e.stopImmediatePropagation();open(near.id);}},true);
let last=0;
function tick(now){requestAnimationFrame(tick);if(now-last<100)return;last=now;
 if(!State.scene||typeof Player==='undefined')return;
 if(scene&&scene!==State.scene){close();dispose();}
 if(panel&&seed!==String(State.citySeed))close();
 const p=Player.position,visible=p.x> -15&&p.x<210&&p.z> -140&&p.z<145;
 if(visible)build();if(root)root.visible=visible;
 const st=state();lamps.forEach(o=>o.material.color.setHex([0xffcf8c,0xffcf8c,0x83d6d3,0xf0afc3][st.light]));rings.forEach((o,i)=>{o.rotation.y=st.rings[i]*Math.PI/2+i*.24;o.rotation.z=i*.35;});
 if(panel)return;near=null;
 if(visible&&!blocked()&&Math.abs(p.y-Player.height-2)<1.3)near=sites.find(s=>Math.hypot(p.x-s.x,p.z-s.z)<2.8)||null;
 prompt.hidden=!near;if(near)prompt.textContent='E · '+near.name;
}
requestAnimationFrame(tick);
window.FCCivic={sites,keys:KEYS,open,close,get root(){return root;},get panel(){return panel;},get progress(){return state();},get near(){return near;},get audioVoices(){return tones.length;}};
})();
