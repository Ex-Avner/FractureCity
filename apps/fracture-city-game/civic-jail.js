/* The Custody House: explorable architecture and a clock-based escape route. */
(function(){'use strict';
if(!window.FCJusticeRules||typeof THREE==='undefined')return;
const R=FCJusticeRules,KEYS=new Set(['1,-2','2,-2','1,-1','2,-1']),SAVE='fc-justice-solo-v1',QUEUE='fc-justice-pending-v1';
const online=()=>new URLSearchParams(location.search).has('online'),live=()=>online()&&window.FCCityOnline?.connected;
let local=R.fresh(),pending=[],remote=null,offset=0,scope='',jailed=false,scene,root,resources=[],actors=[],gate,near,panel,oldFocus,paused,busy=false,work=null,last=0,nextSync=0,arriving=false,error='',arrivalChecked=false;
try{local=R.clean(JSON.parse(localStorage.getItem(SAVE))||R.fresh(),Date.now());}catch{}
try{pending=JSON.parse(localStorage.getItem(QUEUE))||[];if(!Array.isArray(pending))pending=[];}catch{}
const now=()=>Date.now()+offset;
function data(){return online()?(remote||R.fresh()):local;}
const active=()=>R.active(data(),now());
function persist(){try{localStorage.setItem(SAVE,JSON.stringify(local));localStorage.setItem(QUEUE,JSON.stringify(pending));}catch{error='Browser storage is unavailable; solo progress cannot survive a reload.';}}
function ingest(s){if(!s)return;remote=s;offset=s.time-Date.now();if(s.position)teleport(s.position);}
function teleport(p){for(const k of KEYS)if(!State.chunkMap.has(k))shBuildChunk(k);Player.mode='walk';Player.position.set(p.x,p.y+Player.height,p.z);Player.velocity.set(0,0,0);State.keys?.clear?.();if(typeof shTouchReleaseAll==='function')shTouchReleaseAll();}
function civilianDeath(p){
 if(!p||!['street','shop','shared'].includes(p.kind)||active())return;
 const holder=p.char||p;holder.justiceId ||= 'ambient:'+crypto.randomUUID();
 if(online()){
  // Shared NPC deaths are recorded by spawns.cjs, never by a client claim.
  if(p.kind==='shared')return;
  const account=window.FCCityOnline?.self?.accountId;if(!account)return;
  if(!pending.some(q=>q.id===holder.justiceId))pending.push({id:holder.justiceId,kind:p.kind,x:p.pos.x,y:p.pos.y,z:p.pos.z,account});persist();flush();
 }else{
  const sent=R.record(local,holder.justiceId,Date.now());persist();if(sent)admit();else toast('Civilian killed · '+local.kills.length+'/3 in the last five minutes. Three means ten minutes in custody.','warn');
 }
}
async function flush(){if(busy||!live())return;const account=FCCityOnline.self?.accountId,q=pending.find(q=>q.account===account);if(!q)return;busy=true;try{const s=await FCCityOnline.request('civilian-death',q);pending=pending.filter(a=>a!==q);persist();ingest(s);if(s.sentenced)admit();else toast('Civilian killed · '+s.kills+'/3 in the last five minutes.','warn');error='';}catch(e){const msg='Incident report pending: '+e.message;if(error!==msg)toast(msg,'warn');error=msg;}finally{busy=false;}}
function admit(){if(arriving)return;arriving=true;close();for(const name of ['FCOmnism','FCCivic','FCCommonGroundGuide','FCWorldStudio'])window[name]?.close?.();State.ui.inDialogue=false;State.ui.paused=false;State.ui.construct=false;if(window.FN){FN.heat=0;FN.pending.length=0;}if(typeof Mining!=='undefined')Mining.held=false;window.FCWorldEdit?.setActive(false);window.Board?.dismount?.();teleport(R.anchor(data()));Player.hp=Player.hpMax||Player.maxHp||100;Player.invulnTime=3;if(typeof refreshHpHUD==='function')refreshHpHUD();jailed=true;toast('CUSTODY · Three civilian killings within five minutes. Serve ten real minutes, or investigate your cell to escape.','warn');arriving=false;}
// Physical plan. Public intake is on the east; detention and laundry are west.
const boxes=[];
function solid(x,y,z,w,h,d){boxes.push({minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2,jail:true});}
for(const z of [-39,-13]){solid(32,2.45,z,2.1,.9,3);solid(37.5,2.4,z,1,.8,1);}
solid(34,2.5,-25,3,1,1.4);solid(61,2.6,-37,1.5,1.2,5);solid(51,2.35,-27,5,.7,1.3);
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){if(!KEYS.has(this.key))return generate.apply(this,arguments);this._maker=true;this.__cityFitted=1;this._parked=true;this.landmark='custody-house';
 for(let lx=0;lx<VOX_W;lx++)for(let lz=0;lz<VOX_W;lz++){
  const x=this.originX+lx,z=this.originZ+lz;this.vSet(lx,0,lz,(lx===1||lz===1)?B_PAINT:B_ASPHALT);
  if(x<28||x>=68||z< -44||z>=-4)continue;
  this.vSet(lx,1,lz,(x===42||x===59||z===-19)?172:173);
  const perimeter=x===28||x===67||z===-44||z===-5;
  const door=x===67&&z>=-37&&z<-31;
  const partition=(x===40&&z>=-42&&z<-7&&!(z>=-27&&z<-23))||(z===-30&&x>=29&&x<40)||(z===-19&&x>=29&&x<40)||(z===-34&&x>=58&&x<67&&!(x>=62));
  if(perimeter||partition)for(let y=2;y<(perimeter?13:7);y++){
   if(door&&y<9)continue;
   const barred=x===40&&((z>=-38&&z<-33)||(z>=-16&&z<-11));
   const slit=perimeter&&((x+z+100)%6===0)&&y>=6&&y<=10;
   this.vSet(lx,y,lz,barred?172:slit?171:y===12?172:170);
  }
 }
 for(const b of boxes)if(b.minX<this.originX+VOX_W&&b.maxX>this.originX&&b.minZ<this.originZ+VOX_W&&b.maxZ>this.originZ)this.collisionAABBs.push({...b});
};
function dispose(){for(const a of actors)window.FCNpcs?.dispose(a);actors=[];root?.removeFromParent();for(const r of new Set(resources))r.dispose?.();resources=[];root=null;scene=null;}
function build(){if(root&&scene===State.scene){if(root.parent!==scene)scene.add(root);return;}dispose();scene=State.scene;root=new THREE.Group();root.name='custody-house';scene.add(root);
 const mat=(color,glow=false)=>{const m=glow?new THREE.MeshBasicMaterial({color}):new THREE.MeshStandardMaterial({color,roughness:.8,metalness:.12});resources.push(m);return m;};
 const limestone=mat(0xc6c0aa),basalt=mat(0x273942),steel=mat(0x678184),brass=mat(0xab8756),linen=mat(0xb7b0a0),wood=mat(0x725746),amber=mat(0xffdca4,true),jade=mat(0x80cbbb,true),leaf=mat(0x426c51);
 const batches=new Map(),dummy=new THREE.Object3D();
 function box(m,x,y,z,w,h,d,rz=0,ry=0){if(!batches.has(m))batches.set(m,[]);batches.get(m).push([x,y,z,w,h,d,rz,ry]);}
 function mesh(g,m,x,y,z){resources.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);root.add(o);return o;}
 function sign(text,sub,x,y,z,w,ry=0){const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d');g.fillStyle='#152831';g.fillRect(0,0,1024,256);g.strokeStyle='#b1a179';g.lineWidth=4;g.strokeRect(12,12,1000,232);g.textAlign='center';g.fillStyle='#f4e7c8';let fs=64;g.font=fs+'px Georgia';while(g.measureText(text).width>950)g.font=(--fs)+'px Georgia';g.fillText(text,512,108);g.font='26px system-ui';g.fillStyle='#a3d5ce';g.fillText(sub,512,183);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;resources.push(t);const m=new THREE.MeshBasicMaterial({map:t});resources.push(m);mesh(new THREE.PlaneGeometry(w,w/4),m,x,y,z).rotation.y=ry;}
 // Monumental limestone fins stand on a dark plinth around the whole block.
 for(let n=0;n<7;n++)for(const side of [-1,1]){
  box(basalt,48+side*20,2.6,-41+n*5.6,.8,1.2,1.3);box(limestone,48+side*20,9,-41+n*5.6,.7,12,1.1);
  box(brass,48+side*20.4,10,-41+n*5.6,.10,7,.15);
  box(limestone,31+n*5.6,9,side<0?-44.4:-4.6,1.1,12,.7);
 }
 // The east intake canopy is cantilevered from two deep stone piers.
 for(const z of [-39,-29]){box(basalt,68,7,z,1.4,10,1.4);box(amber,68.73,8,z,.05,6,.13);}
 box(limestone,69,12.4,-34,5,.7,12);box(brass,70.8,12,-34,.15,.12,11);
 sign('THE CUSTODY HOUSE','INTAKE · VISITS · RELEASE',68.05,10.3,-34,9,Math.PI/2);
 sign('03 / CIVIC JUSTICE','THREE CIVILIAN KILLS IN FIVE MINUTES = TEN MINUTES',69,4,-29,5,Math.PI/2);
 // Tall service lanterns: vertical reveals and offset copper caps.
 for(const [x,z]of [[62,-40],[32,-7]]){
  box(basalt,x,18,z,4,10,4);for(const dx of [-1.2,0,1.2]){box(brass,x+dx,18,z+2.04,.14,9,.09);box(jade,x+dx,18,z+2.1,.045,7,.04);}
  box(limestone,x,23.4,z,5,.6,5);box(brass,x+.5,24.3,z,4,.3,4,-.12);
 }
 // Roof ribbons over the cell and intake wings, leaving a planted central court open.
 for(const x of [34.5,63])for(let z=-41;z<-6;z+=5)box(limestone,x,14.3,z,10,.35,4.6,x<40?.15:-.15);
 for(const x of [42,58]){box(basalt,x,8,-26,.5,12,.5);box(brass,x,14.1,-26,.7,.2,24);}
 for(const z of [-38,-32,-26,-20,-12]){
  const arch=mesh(new THREE.TorusGeometry(8,.14,6,24,Math.PI),brass,50,13,z);arch.scale.y=.45;
  box(amber,50,16.6,z,.35,.09,1.6);
 }
 // Cell fittings: bolted bedframes, blankets, shelf, basin, toilet and privacy screen.
 for(const z of [-39,-13]){
  box(steel,32,2.3,z,2,.5,3);box(linen,32,2.65,z,1.9,.22,2.9);box(wood,32,2.79,z+.55,1.92,.08,1.4);box(limestone,32,2.82,z-.9,1.5,.2,.5);
  for(const x of [31.1,32.9])box(steel,x,3.2,z-1.5,.08,2.2,.08);
  box(limestone,37.5,2.7,z,1,.3,1);mesh(new THREE.CylinderGeometry(.38,.3,.5,12),limestone,37.5,2.3,z+1.7);
  box(steel,37.5,3.1,z-.32,.07,.55,.07);box(steel,37.5,3.35,z-.17,.07,.07,.36);
  box(wood,36,2.8,z,1.3,.14,.7);box(steel,36,2.9,z,.7,.035,.5);
  box(wood,29.6,3.8,z,1.2,.13,1.8);for(let i=0;i<5;i++)box(i%2?linen:brass,29.9,4.05,z-.6+i*.25,.5,.4,.18);
  box(amber,34,5.8,z,.8,.09,.25);
 }
 // Bars, cell numbers, duct bolts, chalk scratches.
 for(const z of [-38,-37.4,-36.8,-36.2,-35.6,-35,-34.4,-16,-15.4,-14.8,-14.2,-13.6,-13])box(steel,39.94,4,z,.13,4,.09);
 sign('CELL 01','READ THE BEDFRAME / START YOUR ESCAPE',39.9,6.5,-35.5,4.2,-Math.PI/2);
 sign('CELL 02','KEEP THE AISLE CLEAR',40.08,6.5,-13.5,4.2,Math.PI/2);
 for(let i=0;i<5;i++)box(linen,32.6,2.32,-39.8+i*.14,.04,.3,.025,.2);
 box(basalt,29.3,3.1,-34,.15,1.8,1.6);for(let i=0;i<7;i++)box(steel,29.42,2.4+i*.22,-34,.07,.08,1.4);
 // Laundry: washing drums, folded cloth, exposed valves, tiled splashback.
 for(const z of [-27,-23]){box(limestone,30.5,2.8,z,1.5,1.6,1.5);const o=mesh(new THREE.TorusGeometry(.45,.08,6,24),steel,31.27,2.8,z);o.rotation.y=Math.PI/2;}
 box(wood,34,2.5,-25,3,1,1.4);for(let i=0;i<3;i++)box(linen,33.3+i*.7,3.1,-25,.6,.2,.9);
 for(const z of [-28,-20]){box(steel,29.5,5,z,.12,.12,8);box(brass,29.5,4,z,.15,2,.15);}
 sign('LAUNDRY / SERVICE','FOLLOW THE BLUE FLOOR STRIPE',35,5.8,-29.95,7);
 // Reception, property lockers, visitor screen and phone handsets.
 box(wood,61,2.6,-37,1.5,1.2,5);box(basalt,61,3.25,-37,1.7,.12,5.2);
 for(let z=-41;z<=-37;z+=1){box(steel,65.9,3.5,z,.5,3,.85);box(brass,65.6,3.5,z,.03,.2,.1);}
 box(steel,58.2,4.5,-37,.13,5,5);for(let z=-39;z<-34;z+=.6)box(steel,58.2,4.5,z,.15,3,.035);
 for(const z of [-38,-36]){box(basalt,57.7,3.5,z,.16,.7,.3);box(steel,57.6,3,z,.03,.5,.03);}
 sign('PROPERTY & RELEASE','YOUR EQUIPMENT IS HELD UNTIL YOU LEAVE',62,5.8,-43.85,8);
 // Exercise court: benches, planting islands, drinking fountain and drain channels.
 box(wood,51,2.35,-27,5,.7,1.3);for(const x of [46,55]){box(basalt,x,2.5,-36,2.4,1,3);for(let i=0;i<5;i++)mesh(new THREE.IcosahedronGeometry(.6,0),leaf,x+(i%2)*.6-.3,3.3+i*.15,-36+(i%3)*.55-.5);}
 for(let z=-40;z<-8;z+=1)box(steel,58.8,2.025,z,.25,.04,.65);
 for(let z=-28;z<=-16;z+=2)box(jade,42,2.03,z,.18,.04,.9);
 for(let x=42;x<=63;x+=2)box(jade,x,2.03,-18,.9,.04,.18);
 sign('SERVICE ROSTER','WEST ROUND / 18 SECONDS ON, 18 SECONDS AWAY',43,4,-21.9,5.5);
 sign('RAINWATER MAINTENANCE','OUTLET / AUTHORIZED ACCESS',64,4.5,-5.9,5);
 // One individually posed gate, so the patrol cue is visible in the actual world.
 gate=mesh(new THREE.BoxGeometry(.14,3,2.6),steel,60,3.5,-16);
 for(let i=0;i<6;i++)box(steel,64,2.06,-7.5+i*.15,1.5,.09,.07);
 // Small robust wayfinding plaques are physical, not additional permanent HUD panels.
 sign('CUSTODY / PUBLIC INTAKE →','VISITORS ENTER FROM THE EAST STREET',48,5.8,-4.4,10);
 for(const [m,list]of batches){const g=new THREE.BoxGeometry(1,1,1);resources.push(g);const inst=new THREE.InstancedMesh(g,m,list.length);list.forEach(([x,y,z,w,h,d,rz,ry],i)=>{dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,ry,rz);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});root.add(inst);}
 if(window.FCNpcs&&window.FCWardrobe){for(const [i,name]of ['Officer Vale','Mira / laundry worker','Oren / inmate'].entries()){
  const a=FCNpcs.body({...FCWardrobe.DEFAULT_LOOK,coat:i===0?'#3d5963':i===1?'#b5a68a':'#a47950'},name,'wanderer',{},'custody:'+i);a.char.plate.visible=false;root.add(a.group);actors.push(a);
 }}
 root.traverse(o=>{if(o.isMesh){o.userData._hdTag=1;o.castShadow=false;o.receiveShadow=false;}});
}
const prompt=document.createElement('button');prompt.id='jail-approach';prompt.hidden=true;document.body.append(prompt);prompt.onclick=()=>open();
const hud=document.createElement('button');hud.id='jail-status';hud.hidden=true;document.body.append(hud);hud.onclick=()=>open(true);
const css=document.createElement('style');css.textContent=`
#jail-status{position:fixed;top:18px;left:18px;z-index:126000;max-width:330px;padding:12px 16px;border:1px solid #dfbc81;border-left:4px solid #dfbc81;border-radius:12px;background:#182b32ed;color:#f7e4bf;text-align:left;font:13px/1.5 system-ui;cursor:pointer}#jail-status strong,#jail-status span{display:block}#jail-approach{position:fixed;bottom:118px;left:50%;transform:translateX(-50%);z-index:126001;max-width:calc(100vw - 24px);padding:13px 20px;border:1px solid #ccb98f;border-radius:22px;background:#182b32ed;color:#fff0d0;font:600 14px system-ui;cursor:pointer}#jail-status[hidden],#jail-approach[hidden]{display:none}
body.in-custody #hud-weapons,body.in-custody #fn-ability,body.in-custody #dispatch-goal,body.in-custody #maker-goal,body.in-custody #fc-story-goal,body.in-custody #cg-walk-guide,body.in-custody #campaign-hud{visibility:hidden!important}
.jail-panel{position:fixed;inset:5vh max(12px,calc((100vw - 780px)/2));z-index:150000;overflow:auto;padding:30px;background:linear-gradient(140deg,#182e38,#171f26);color:#eee4ce;border:1px solid #bba985;border-radius:20px;box-shadow:0 0 0 100vmax #050b10b8;font:16px/1.65 system-ui}.jail-panel *{box-sizing:border-box}.jail-panel h1{font:36px/1.1 Georgia}.jail-panel h2{font:25px Georgia}.jail-panel small{color:#9dcccb;letter-spacing:.1em}.jail-panel button{min-height:46px;padding:12px 16px;background:#304950;border:1px solid #8da9aa;border-radius:10px;color:#fff0d0;font:600 15px system-ui;cursor:pointer}.jail-panel button:focus-visible{outline:3px solid #e7bd77}.jail-panel [data-close]{float:right}.jail-card{padding:20px;border:1px solid #688184;border-radius:12px;background:#ffffff05;margin:20px 0}.jail-panel blockquote{font:22px/1.6 Georgia;margin:12px 0}.jail-panel [role=status]{color:#e9c893;min-height:26px}
body.jail-reading #touch-layer{visibility:hidden!important}@media(max-width:600px){.jail-panel{inset:8px;padding:20px;border-radius:12px}.jail-panel h1{font-size:30px}#jail-status{top:65px;left:10px;width:calc(100vw - 130px);font-size:11px;padding:8px}#jail-approach{bottom:185px;font-size:13px}}
`;document.head.append(css);
function feet(){return {x:Player.position.x,y:Player.position.y-Player.height,z:Player.position.z};}
function blocked(){const u=State.ui;return u.paused||u.inIntro||u.inDialogue||u.inInventory||u.inArcade||u.inMiniGame||u.inShiftPanel||u.construct;}
function close(){if(!panel)return;panel.remove();panel=null;work=null;State.ui.paused=paused;State.keys?.clear?.();document.body.classList.remove('jail-reading');oldFocus?.focus?.();}
function open(plan=false){if(panel||blocked())return;oldFocus=document.activeElement;paused=State.ui.paused;State.ui.paused=true;State.keys?.clear?.();shTouchReleaseAll();document.exitPointerLock?.();document.body.classList.add('jail-reading');panel=document.createElement('section');panel.className='jail-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Custody House');document.body.append(panel);panel.dataset.plan=plan?'1':'';for(const type of ['pointerdown','mousedown','click'])panel.addEventListener(type,e=>e.stopPropagation());render();panel.querySelector('button')?.focus();}
const timeText=()=>{const n=Math.max(0,Math.ceil((data().until-now())/1000));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
function render(){if(!panel)return;const s=data(),a=R.stations[s.stage],here=active()&&a&&R.near(feet(),a.at);const guard=R.guardAway(s,now());
 panel.innerHTML=`<button data-close>Close · Esc</button><small>CIVIC JUSTICE / THE CUSTODY HOUSE</small><h1>${active()?'A way out.':'Inside the Custody House.'}</h1>${active()?`<p>Three civilian killings in a rolling five-minute window led to this sentence. <b data-timer>${timeText()}</b> remains. Time continues while you wait, read or are offline.</p><div class="jail-card"><small>ESCAPE PLAN / ${s.stage+1} OF 6</small><h2>${a.name}</h2><p>${['Look beneath the pillow: somebody scratched instructions into the bedframe.','The meal tray sits on the small table beside your bed.','Use the loose strip on the low vent in the west wall.','In the laundry room, follow the blue stripe to the service roster in the courtyard.','Cross the courtyard to the east service passage. Watch Officer Vale’s round.','Follow the service corridor south to the rainwater outlet.'][s.stage]}</p>${here?`<button data-begin ${busy?'disabled':''}>${a.verb} · ${a.seconds}s</button>`:'<p>Close this plan and walk to the marked object. Your next lead is '+Math.round(Math.hypot(feet().x-a.at.x,feet().z-a.at.z))+' metres away.</p>'}<p data-watch>${s.stage===4?(guard?'The guard is walking west. The passage is clear.':'The guard is watching the passage. Wait for the west round.'):''}</p></div><p>Officer Vale: “You can serve your time. The release desk opens automatically when your sentence ends.”</p><p>Mira, laundry worker: “I mend uniforms, not people. Keep your eyes on the pipes.”</p><p>Your equipment is locked during custody and becomes usable after release. Escaping clears this sentence; it does not earn credits.</p>`:'<p>A working detention block with intake, property lockers, visitor phones, fitted cells, laundry, a planted exercise court and a service wing.</p><div class="jail-card"><h2>How custody works</h2><p>Kill three civilians within any five-minute period and you are sent to Cell 01 for ten real minutes. You can wait out the sentence or investigate a six-step escape through the service spaces. Enemy creatures and hostile combat NPCs do not count.</p><p>Public entrance: the east street. Follow the signs to intake.</p></div>'}<p role="status" aria-live="polite"></p>`;
 panel.querySelector('[data-close]').onclick=close;const b=panel.querySelector('[data-begin]');if(b)b.onclick=begin;
}
async function action(type,id){if(online()){if(!live())throw Error('Reconnect to continue the escape. Your sentence timer still runs.');const s=await FCCityOnline.request('jail-action',{action:type,id});ingest(s);}else{const to=R.action(local,feet(),{action:type,id},Date.now());persist();if(to)teleport(to);}}
async function begin(){if(busy||work||!active())return;const a=R.stations[data().stage];busy=true;try{await action('begin',a.id);work={id:a.id,until:now()+a.seconds*1000,text:a.text};error='';render();}catch(e){error=e.message;const el=panel?.querySelector('[role=status]');if(el)el.textContent=error;}finally{busy=false;}}
async function finish(){if(!work||busy)return;const a=work;work=null;busy=true;try{await action('finish',a.id);render();panel?.querySelector('[role=status]')?.replaceChildren(document.createTextNode(a.text));if(!active())release('escaped');}catch(e){error=e.message;render();const el=panel?.querySelector('[role=status]');if(el)el.textContent=error;}finally{busy=false;}}
function release(reason){close();teleport(R.EXIT);jailed=false;toast(reason==='escaped'?'You escaped through the rainwater outlet. Your equipment is available again.':'Sentence served. You are free to leave. Your equipment is available again.','success');}
addEventListener('keydown',e=>{if(panel){if(e.code==='Escape'){e.preventDefault();close();}if(e.code==='Tab'){const a=[...panel.querySelectorAll('button')].filter(b=>!b.disabled),i=a.indexOf(document.activeElement);e.preventDefault();a[(i+(e.shiftKey?-1:1)+a.length)%a.length]?.focus();}e.stopImmediatePropagation();return;}if(e.code==='KeyE'&&!e.repeat&&!prompt.hidden){e.preventDefault();e.stopImmediatePropagation();open();}},true);
// Custody disarms actions without deleting inventory or blocking ordinary walking.
for(const name of ['tryAttack','shBeginMine','placeBlock'])if(typeof window[name]==='function'){const original=window[name];window[name]=function(){if(active())return;return original.apply(this,arguments);};}
const damage=window.damagePlayer;if(damage)window.damagePlayer=function(){if(active())return;return damage.apply(this,arguments);};
function tick(t){requestAnimationFrame(tick);if(t-last<100)return;last=t;if(!State.scene||!window.OwnBlock?.ready)return;
 const key=online()?'online:'+window.FCCityOnline?.self?.accountId:'solo';if(scope!==key){scope=key;remote=null;offset=0;jailed=false;arrivalChecked=false;nextSync=0;close();}
 if(scene&&scene!==State.scene){dispose();close();jailed=false;arrivalChecked=false;}
 const pos=feet(),visible=pos.x>-80&&pos.x<180&&pos.z>-155&&pos.z<110;
 if(visible||active())build();if(root)root.visible=visible||active();
 if(online()&&live()){
  const snap=FCCityOnline.self?.justice;if(snap)ingest(snap);
  if(t>nextSync){nextSync=t+3000;flush();}
 }else if(!online()){const u=local.until;R.clean(local,Date.now());if(u!==local.until)persist();}
 if(!arrivalChecked&&(!online()||remote)){arrivalChecked=true;if(!active()&&['served','escaped'].includes(data().reason)&&pos.x>=28&&pos.x<=68&&pos.z>=-44&&pos.z<=-4)teleport(R.EXIT);}
 if(active()){
  if(!jailed)admit();if(!R.allowed(data(),feet(),now()))teleport(R.anchor(data()));
  if(window.FCWorldEdit?.active)FCWorldEdit.setActive(false);State.ui.construct=false;
 }else if(jailed)release(data().reason);
 document.body.classList.toggle('in-custody',active());hud.hidden=!active()||!!panel;
 if(!hud.hidden)hud.innerHTML='<strong>CUSTODY · '+timeText()+'</strong><span>Escape lead: '+R.stations[data().stage].name+' · tap for plan</span>';
 const s=data(),a=R.stations[s.stage];near=active()&&a&&R.near(feet(),a.at)?a:null;
 const intake=!active()&&Math.hypot(pos.x-64,pos.z+36)<3;
 prompt.hidden=!!panel||blocked()||!(near||intake);if(!prompt.hidden)prompt.textContent='E · '+(near?near.name:'Custody House / visitor information');
 if(gate){const away=active()?R.guardAway(s,now()):(now()%36000>=18000);gate.rotation.y=away?Math.PI/2:0;gate.position.x=away?60.8:60;}
 const phase=active()?((now()-s.started)%36000)/36000:(now()%36000)/36000;
 actors.forEach((a,i)=>{const patrol=phase<.5?59:phase<.7?59-(phase-.5)/.2*14:phase<.85?45:45+(phase-.85)/.15*14;const walking=i===0&&phase>=.5&&(phase<.7||phase>=.85);const x=i===0?patrol:i===1?34:35,z=i===0?-18:i===1?-24:-13;a.group.position.set(x,2,z);if(i===0)a.char.group.rotation.y=phase>=.85?Math.PI/2:-Math.PI/2;if(!blocked()){shAnimateCharacter(a.char,.1,walking,t/1000);if(i===1)FCNpcs.pose(a,'work',t/1000,.1,false);}});
 if(panel){const timer=panel.querySelector('[data-timer]');if(timer)timer.textContent=timeText();const watch=panel.querySelector('[data-watch]');if(watch&&s.stage===4)watch.textContent=R.guardAway(s,now())?'The guard is walking west. The passage is clear.':'The guard is watching the passage. Wait for the west round.';
  const b=panel.querySelector('[data-begin]');if(b){b.disabled=busy||!!work;if(work)b.textContent='Working… '+Math.max(0,Math.ceil((work.until-now())/1000))+'s';}
  if(work&&!R.near(feet(),a.at)){work=null;error='You moved away. Begin again at the object.';render();}
  if(work&&now()>=work.until)finish();
 }
}
requestAnimationFrame(tick);
window.FCJustice={civilianDeath,open,close,get active(){return active();},get state(){return data();},get root(){return root;},get panel(){return panel;},get error(){return error;},keys:KEYS};
})();
