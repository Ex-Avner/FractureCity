/* The Echo Room repair apprentice. Demonstrations become bounded shared routines. */
(function(){'use strict';
const M=window.FCApprenticeModel;if(!M)return;
let state=M.fresh(),seed=null,scene=null,root=null,npc=null,held=null,goods=[],streetLamps=[],stations={},resources=[],last=performance.now(),busy=false,near=null,scope=null,lastStamp=0;
const online=()=>location.pathname.startsWith('/city/');
const player=()=>({x:Player.position.x,y:Player.position.y-Player.height,z:Player.position.z,hp:Player.hp,accountId:online()?window.FCCityOnline?.self?.accountId:'local'});
const blocked=()=>!window.OwnBlock?.ready||State.ui.paused||State.ui.inArcade||State.ui.inDialogue||State.ui.inInventory||State.ui.construct||Player.mode!=='walk'||!!window.FCJustice?.active||(online()&&!window.FCCityOnline?.connected);
const button=document.createElement('button');button.id='apprentice-action';button.hidden=true;button.style.cssText='position:fixed;bottom:24%;left:50%;transform:translateX(-50%);z-index:90;padding:12px 20px;border:1px solid #e6bd78;border-radius:22px;background:#162f3e;color:#fff0d2;font:600 14px system-ui;min-height:48px';document.body.append(button);
function notice(text){if(typeof toast==='function')toast(text);}
function dispose(){root?.removeFromParent();if(npc)FCNpcs.dispose(npc);for(const r of resources)r.dispose?.();resources=[];goods=[];streetLamps=[];stations={};root=npc=held=null}
function build(){
 root=new THREE.Group();root.name='echo-room-apprentice';scene.add(root);
 const mat=(c,glow=0)=>{const m=new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:glow,roughness:.55});resources.push(m);return m};
 const metal=mat(0x233e49),wood=mat(0xa58256),warm=mat(0xffcb73,.7),cyan=mat(0x60e0d6,.7),dead=mat(0x534f51);
 function box(x,y,z,w,h,d,m,parent=root){const g=new THREE.BoxGeometry(w,h,d);resources.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o}
 function sign(x,y,z,title,sub,w=1.5,h=.32){const cv=document.createElement('canvas');cv.width=768;cv.height=Math.round(768*h/w);const c=cv.getContext('2d');c.fillStyle='#17313a';c.fillRect(0,0,768,cv.height);c.textAlign='center';c.fillStyle='#fff0cc';c.font='bold '+Math.floor(cv.height*.47)+'px sans-serif';c.fillText(title,384,cv.height*.52,720);c.fillStyle='#a6ccbf';c.font=Math.floor(cv.height*.2)+'px sans-serif';c.fillText(sub,384,cv.height*.84,720);const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;const g=new THREE.PlaneGeometry(w,h),m=new THREE.MeshBasicMaterial({map:t}),o=new THREE.Mesh(g,m);o.position.set(x,y,z);root.add(o);resources.push(t,g,m);box(x,y,z-.035,w+.08,h+.08,.06,metal);}
 sign(156,6.25,-5.78,'THE LEARNING WORKSHOP','SHOW OLLI / WATCH / APPROVE',7,.7);
 const names={intake:['BROKEN LAMPS','TAKE / REQUEST'],repair:['WARM LIGHT','REPAIR HERE'],tune:['COOL LIGHT','RETUNE HERE'],window:['WINDOW RACK','DELIVER HERE'],street:['STREET RACK','OR DELIVER HERE']};
 for(const [id,t]of Object.entries(M.stations)){if(['teacher','correct'].includes(id))continue;
  // Stations have reachable fronts and no collision over the central aisle.
  box(t.x,2.8,t.z,1.4,.18,.8,wood);for(const x of [-.55,.55])box(t.x+x,2.38,t.z,.1,.76,.55,metal);
  sign(t.x,3.55,t.z-.34,...names[id],1.4,.33);
  const light=box(t.x,3,t.z,.22,.24,.22,id==='tune'?cyan:warm);stations[id]=light;
 }
 for(const x of [155,158]){box(x,2.5,-10,.15,1,.15,metal);box(x,2.98,-10,.7,.12,.4,wood);box(x,3.1,-10,.12,.12,.12,x===155?cyan:warm);}
 sign(155,2.83,-9.76,'TEACH / APPROVE','OLLI',.8,.24);sign(158,2.83,-9.76,'RETEACH','TRY ANOTHER WAY',.8,.24);
 for(const id of ['intake','window','street'])for(let i=0;i<6;i++){
  const t=M.stations[id],lamp=new THREE.Group();lamp.position.set(t.x+(i%3-1)*.4,3+Math.floor(i/3)*.55,t.z);root.add(lamp);
  box(0,0,0,.22,.08,.22,metal,lamp);box(0,.18,0,.045,.35,.045,wood,lamp);const bulb=box(0,.38,0,.22,.16,.22,id==='intake'?dead:warm,lamp);goods.push({id,i,lamp,bulb,warm,cyan});
 }
 const story=FCNpcBrain.story('wanderer','echo-apprentice');story.name='Olli';const look={...FCWardrobe.DEFAULT_LOOK,...FCWardrobe.SIGNATURES.salvage};npc=FCNpcs.body(look,'Olli','wanderer',story,'echo-apprentice');root.add(npc.group);
 for(let i=0;i<6;i++){const x=146+i*8;box(x,3.4,26,.09,4.8,.09,metal);const bulb=box(x,5.8,26,1.2,.12,.6,dead);streetLamps.push({bulb,warm,dead});}
 held=box(0,0,0,.25,.3,.25,mat(0xffcb73,.4));held.visible=false;
}
function choices(){
 if(blocked()||busy||!root?.visible)return null;const p=player(),mine=state.owner===p.accountId;
 if(state.owner&&!mine)return null;
 const targets=[];const add=(station,op,label)=>{if(M.close(p,M.stations[station]))targets.push({station,op,label,d:Math.hypot(p.x-M.stations[station].x,p.z-M.stations[station].z)})};
 if(['idle','review'].includes(state.mode))add('teacher',state.mode==='review'?'approve':'teach',state.mode==='review'?'Approve Olli’s trial':state.skill?'Teach a new routine':'Teach Olli');
 if(state.mode==='recording'){
  if(!state.record.length)add('intake','take','Take broken lamp');
  if(state.carry==='broken')for(const id of ['repair','tune'])if(!state.repairAt||state.record[1]===id)add(id,state.repairAt?'finish':'repair',state.repairAt?'Finish repair':id==='tune'?'Retune lamp':'Repair lamp');
  if(['warm','cyan'].includes(state.carry))for(const id of ['window','street'])add(id,'deliver','Deliver lamp');
 }
 if(state.stock<3)add('intake','order','Request broken lamp');
 if(!['recording','trial'].includes(state.mode))for(const id of ['window','street'])if(state.outputs[id])add(id,'collect','Dispatch repaired lamp');
 if(mine&&['recording','trial'].includes(state.mode))add('teacher','cancel','Stop lesson');
 // The review offers a physical correction pad beside the teacher.
 if(mine&&state.mode==='review')add('correct','teach','Reteach Olli');
 return targets.sort((a,b)=>a.d-b.d)[0]||null;
}
async function use(){const c=choices();if(!c)return false;busy=true;try{
 const b={station:c.station,op:c.op,revision:state.revision};
 if(online()){state=await FCCityOnline.request('apprentice',b);}else{M.action(state,player(),b,Date.now());save();}
 if(c.op==='teach')notice('Olli is watching. Take a broken lamp, choose a workbench, then a delivery rack.');
 if(c.op==='deliver')notice('Your turn, Olli. Watch the fresh lamp.');
 if(c.op==='collect')notice('Lamp delivered to Common Ground’s lighting crew.');
 if(c.op==='approve')notice('Routine learned. Olli will work through the intake.');
 }catch(e){notice(e.message);}finally{busy=false}return true}
button.onclick=use;
window.addEventListener('keydown',e=>{if(e.code!=='KeyE'||e.repeat||e.target.closest?.('input,textarea,select,[contenteditable=true]')||!choices())return;e.preventDefault();e.stopImmediatePropagation();use()},true);
function save(){if(online()||!scope||state.stamp===lastStamp)return;try{localStorage.setItem(scope,JSON.stringify(M.durable(state)));lastStamp=state.stamp}catch{notice('Workshop progress could not save on this device.')}}
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,(now-last)/1000);last=now;
 if(!State.scene||!OwnBlock?.ready||!State.citySeed)return;
 if(seed!==State.citySeed||scene!==State.scene){dispose();seed=State.citySeed;scene=State.scene;scope='fc-apprentice-v1:'+seed;state=M.fresh();if(!online())try{state=M.restore(JSON.parse(localStorage.getItem(scope)||'null'))}catch{}lastStamp=0;}
 const loaded=State.chunkMap.has('6,-1');if(loaded&&!root)build();if(!root)return;
 root.visible=loaded&&Math.hypot(Player.position.x-156,Player.position.z+12)<90;
 if(online()){const s=FCCityOnline?.room?.apprentice;if(s&&!busy&&s.revision>=state.revision)state=s;}else if(!blocked()){M.step(state,dt,Date.now());save();}
 button.hidden=true;if(!root.visible)return;
 const n=state.npc,old=npc.group.position.clone();npc.group.position.set(n.x,2,n.z);const moving=old.distanceTo(npc.group.position)>.005;
 if(moving)npc.char.group.rotation.y=Math.atan2(n.x-old.x,n.z-old.z);
 shAnimateCharacter(npc.char,dt,moving,now/1000);FCNpcs.pose(npc,moving?'run':state.job&&n.stage===1?'sell':'watch',now/1000,dt,moving);
 held.visible=!!(state.carry||n.carry);if(state.carry){const o=new THREE.Vector3(.35,-.35,-.6).applyQuaternion(State.camera.quaternion);held.position.copy(State.camera.position).add(o)}else held.position.set(n.x+.35,3,n.z);
 const carried=state.carry||n.carry;held.material.color.setHex(carried==='broken'?0x534f51:carried==='cyan'?0x60e0d6:0xffcb73);held.material.emissive.copy(held.material.color);held.material.emissiveIntensity=carried==='broken'?0:.6;
 for(const g of goods){g.lamp.visible=g.i<(g.id==='intake'?state.stock:state.outputs[g.id]);if(g.id!=='intake')g.bulb.material=state.styles[g.id][g.i]==='cyan'?g.cyan:g.warm;}
 streetLamps.forEach((l,i)=>{l.bulb.material=state.dispatched>i?l.warm:l.dead;});
 const target=state.mode==='recording'?state.record.length===0?'intake':state.carry==='broken'?(state.record[1]||'repair'):'window':state.job?.[n.stage];
 for(const[id,l]of Object.entries(stations)){l.scale.setScalar(id===target?1.5:1);}
 near=choices();button.hidden=!near;if(near){const label='E · '+near.label;if(button.textContent!==label)button.textContent=label;}
}
const generate=Chunk.prototype.generate;Chunk.prototype.generate=function(){const r=generate.apply(this,arguments);if(this.key==='6,-1'&&this.landmark==='makers')for(const[id,p]of Object.entries(M.stations))if(!['teacher','correct'].includes(id))this.collisionAABBs.push({minX:p.x-.7,maxX:p.x+.7,minZ:p.z-.4,maxZ:p.z+.4,minY:2,maxY:2.9});return r;};
window.FCApprentice={use,choices,get state(){return state},get root(){return root}};requestAnimationFrame(frame);
})();
