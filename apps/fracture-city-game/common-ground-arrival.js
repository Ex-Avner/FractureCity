/* Garden arrival: a local, physical introduction. No automatic menus or network saves. */
(function(){'use strict';
const HOME=[167,20],CELL=[167.6,15],SOCKET=[172.2,12];
let scene=null,seed=null,root=null,actors=[],worker,cart,cell,heldCell,ring,jets,petals=[],resources=[],stage='waiting',clock=0,elapsed=0,power=0,near=null,completed=false,last=performance.now(),warning=false;
// Colliders cover the solid stem and socket, leaving the bridge walk around them.
const solids=[{minX:176.2,maxX:176.8,minY:1,maxY:4,minZ:11.7,maxZ:12.3,arrival:true},{minX:172,maxX:172.4,minY:1,maxY:2.1,minZ:11.7,maxZ:12.3,arrival:true}];
const generate=Chunk.prototype.generate;Chunk.prototype.generate=function(){const result=generate.apply(this,arguments);for(const b of solids)if(b.maxX>this.originX&&b.minX<this.originX+24&&b.maxZ>this.originZ&&b.minZ<this.originZ+24)this.collisionAABBs.push({...b});return result;};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const prompt=document.createElement('button');prompt.id='arrival-action';prompt.hidden=true;prompt.style.cssText='position:fixed;bottom:24%;left:50%;transform:translateX(-50%);z-index:90;padding:12px 20px;border:1px solid #d4bb7f;border-radius:24px;background:#173b38ef;color:#fff0cd;font:600 15px system-ui;min-height:48px;max-width:85vw';prompt.onclick=()=>use();document.body.append(prompt);
const caption=document.createElement('div');caption.id='arrival-caption';caption.style.cssText='position:fixed;top:16%;left:50%;transform:translateX(-50%);max-width:85vw;text-align:center;color:#fff0d4;background:#16302be8;padding:9px 16px;border-radius:18px;font:15px system-ui;pointer-events:none;z-index:90';caption.hidden=true;document.body.append(caption);let captionUntil=0;
function say(text,e=worker){caption.textContent=text;caption.hidden=false;captionUntil=clock+5;if(e&&!dead(e)){FCNpcs.bubble(e,text);e.until=clock+5;}}
function tone(f,g=.05,d=.4){try{shTone({f0:f,f1:f*1.5,gain:g,dur:d,type:'sine'});}catch{}}
function dist(x,z){return Math.hypot(Player.position.x-x,Player.position.z-z);}
function dead(e){return e?.char.fnb?.st==='dead'||e?.ent.state==='dead';}
function mat(color,glow=0){const m=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:glow,metalness:.45,roughness:.46});resources.push(m);return m;}
function mesh(geo,m,x,y,z,parent=root){resources.push(geo);const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);parent.add(o);return o;}
function box(m,x,y,z,w,h,d,parent=root){return mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);}
function actor(name,x,z,lookSeed){const story=FCNpcBrain.story('wanderer','arrival:'+name);story.name=name;const look=window.FCWardrobe?FCWardrobe.crowdLook(null,new RNG('arrival:'+lookSeed),['work']):{};if(window.FCWardrobe?.SIGNATURES)Object.assign(look,FCWardrobe.SIGNATURES[lookSeed==='mara'?'botanical':lookSeed==='sol'?'courier':'archive']);const e=FCNpcs.body(look,name,'wanderer',story,lookSeed);e.ent={position:new THREE.Vector3(x,1,z),streetEvent:true};e.group.position.copy(e.ent.position);e.path=[];e.wait=0;root.add(e.group);actors.push(e);return e;}
function send(e,points){if(e)e.path=points.map(p=>[...p]);}
function move(e,dt,speed=1.7){if(dead(e)){e.group.visible=false;return false;}if(!FCActors.prepare(e.ent,e.char,{local:true,view:e.group,r:.3}))return false;const to=e.path[0];let moving=false;if(to){const p=e.ent.position,dx=to[0]-p.x,dz=to[1]-p.z,d=Math.hypot(dx,dz);if(d<.25)e.path.shift();else{const step=Math.min(d,speed*dt);moving=shGroundMove(e.ent,dx/d*step,dz/d*step,.3,1.8);e.char.group.rotation.y=Math.atan2(dx,dz);}}
 shAnimateCharacter(e.char,dt,moving,clock);FCNpcs.pose(e,moving?'run':e.act||'watch',clock,dt,moving);FCActors.finish(e.ent,e.char,dt,{local:true,view:e.group,r:.3});if(e.bubble)e.bubble.visible=clock<(e.until||0);return moving;}
function save(){try{localStorage.setItem('fc-arrival-v1:'+seed,'done');}catch{if(!warning){warning=true;say('Garden restored. This browser could not remember your visit.');}}}
function dispose(){actors.forEach(e=>FCNpcs.dispose(e));actors=[];root?.traverse(o=>{if(o.isInstancedMesh)o.dispose?.();});root?.removeFromParent();resources.forEach(r=>r.dispose());resources=[];petals=[];root=null;worker=null;near=null;prompt.hidden=caption.hidden=true;}
function build(){root=new THREE.Group();root.name='common-ground-arrival';scene.add(root);const bronze=mat(0xc5a469),stone=mat(0x354c48),mint=mat(0x76e8cc,.35),cream=mat(0xf2dba9,.2);
 // Folded bronze petals and a kinetic crown grow from the existing reflecting rill.
 mesh(new THREE.CylinderGeometry(1.65,1.9,.22,24),stone,176.5,1.14,12);
 mesh(new THREE.CylinderGeometry(.28,.5,2.8,12),bronze,176.5,2.6,12);
 ring=mesh(new THREE.TorusGeometry(1.75,.055,6,48),mint,176.5,4.1,12);ring.rotation.x=Math.PI/2;
 for(let i=0;i<8;i++){const a=i*Math.PI/4,p=mesh(new THREE.ConeGeometry(.44,2.6,4),bronze,176.5+Math.cos(a)*.9,2.6,12+Math.sin(a)*.9);p.rotation.z=Math.cos(a)*.4;p.rotation.x=Math.sin(a)*.4;petals.push(p);}
 const water=mat(0x91dbce,.5),g=new THREE.SphereGeometry(.065,5,4);resources.push(g);jets=new THREE.InstancedMesh(g,water,32);jets.frustumCulled=false;root.add(jets);
 for(const x of [174,179])for(const z of [6,9,15,18])box(mint,x,1.15,z,.1,.12,.8);
 const socket=box(bronze,...[SOCKET[0],1.5,SOCKET[1]],.4,1,.6);socket.name='arrival-power-socket';box(mint,SOCKET[0],2.05,SOCKET[1],.3,.08,.4);
 cart=new THREE.Group();root.add(cart);box(stone,0,0,0,1.1,.5,.75,cart);box(bronze,0,.3,0,.8,.15,.6,cart);for(const x of [-.65,.65])for(const z of [-.45,.45]){const r=mesh(new THREE.TorusGeometry(.22,.04,5,12),bronze,x,.1,z,cart);r.rotation.x=Math.PI/2;}
 cell=mesh(new THREE.OctahedronGeometry(.23),mint,CELL[0],1.4,CELL[1]);heldCell=mesh(new THREE.OctahedronGeometry(.17),mint,0,0,0);heldCell.visible=false;
 worker=actor('Mara · garden maintenance',166,11,'mara');actor('Sol',170,20,'sol');actor('Ren',167,6,'ren');
 if(completed){stage='done';power=1;cart.visible=cell.visible=false;send(worker,[[167,12],[171,12]]);}else{stage='waiting';cart.position.set(167,4.8,24);cell.visible=false;}
 elapsed=0;
}
function busy(){return !completed&&stage!=='deferred'&&!!State.citySeed&&dist(167,16)<38;}
function blocked(){const u=State.ui;return u.paused||u.inIntro||u.inDialogue||u.inInventory||u.inArcade||u.inMiniGame||u.construct||window.FCJustice?.active||window.FN?.prologue||window.FN?.scene||Player.mode!=='walk';}
function transition(next){stage=next;elapsed=0;}
function use(){if(blocked()||!near)return false;if(near==='cell'&&stage==='pickup'){cell.visible=false;heldCell.visible=true;transition('follow');send(worker,[[167,12],[170.8,12]]);say('Mara: Bring that cell. The garden is just over here.');tone(440);return true;}
 if(near==='socket'&&stage==='follow'){heldCell.visible=false;transition('waking');worker.act='sell';say('Mara: There. Listen.');tone(196,.08,2);return true;}return false;}
document.addEventListener('keydown',e=>{if(e.code!=='KeyE'||e.repeat||e.target.isContentEditable||e.target.closest?.('input,textarea,select,[role=dialog]'))return;if(use()){e.preventDefault();e.stopImmediatePropagation();}},true);
const pose=new THREE.Object3D(),offset=new THREE.Vector3(.35,-.3,-.65);
function step(dt){if(!State.scene||!State.citySeed||!window.OwnBlock?.ready)return;
 if(scene!==State.scene||seed!==String(State.citySeed)){dispose();scene=State.scene;seed=String(State.citySeed);completed=false;try{completed=localStorage.getItem('fc-arrival-v1:'+seed)==='done';}catch{}stage='waiting';clock=0;}
 if(dist(167,16)>75){if(root)root.visible=false;near=null;prompt.hidden=caption.hidden=true;return;}
 if(!State.chunkMap.has('6,0')||!State.chunkMap.has('7,0'))return;
 // Existing journeys retain priority; never reset a returning player's quest.
 if(!completed&&window.FCFirstSignal?.stage>0&&stage==='waiting'){stage='deferred';return;}
 if(stage==='deferred')return;
 if(!root)build();root.visible=true;
 if(blocked()){near=null;prompt.hidden=caption.hidden=true;return;}
 clock+=dt;elapsed+=dt;
 if(stage==='waiting'&&dist(...HOME)<13&&Player.position.y-Player.height<3&&elapsed>2){transition('crash');window.FCStreetEvents?.end();say('Mara: Watch the delivery!');send(worker,[[166,16]]);}
 if(stage==='crash'){const t=Math.min(1,elapsed/2.6);cart.position.set(167+1.6*t,4.8-3.5*t,24-8.8*t);cart.rotation.z=t*.45;cart.rotation.y=t*.5;if(t===1){transition('pickup');cell.visible=true;say('Mara: The power cell! Can you grab it?');tone(85,.09,.5);send(actors[1],[[168.5,19],[168.5,17.5]]);send(actors[2],[[167,12],[166,14]]);}}
 if(stage==='follow'&&dist(worker.ent.position.x,worker.ent.position.z)>7)worker.act='sell';else worker.act=stage==='pickup'?'sell':'watch';
 for(const e of actors){if(e===worker&&stage==='follow'&&dist(e.ent.position.x,e.ent.position.z)>7){const keep=e.path;e.path=[];move(e,dt);e.path=keep;}else move(e,dt);}
 if(stage==='waking'){power=Math.min(1,elapsed/7);if(elapsed>7){completed=true;transition('done');save();say('Mara: You brought it back. Welcome to Common Ground.');tone(660,.06,2);send(actors[1],[[168.5,12],[171,12]]);send(actors[2],[[167,9],[170,10]]);}}
 if(stage==='done'){
  // The recovered delivery leaves, then returns on a quiet scheduled route.
  // It never resets the incident or scatters another quest item.
  if(elapsed<5){}else if(elapsed<10){cart.visible=true;const u=(elapsed-5)/5;cart.position.set(168.6+u*8,1.3+u*5,15.2-u*12);cart.rotation.z*=Math.max(0,1-dt*3);}
  else{const delivery=(elapsed-10)%60;cart.visible=delivery<10;if(cart.visible){cart.position.set(167+Math.sin(delivery*.3)*1.5,3.2,23-delivery*1.7);cart.rotation.set(0,Math.PI,0);worker.act='sell';}}
  // Residents make short trips between the public walk and the garden crossing.
  // Routes remain collision checked; no arbitrary crowd spawning or teleporting.
  for(const e of actors)if(!dead(e)&&!e.path.length){e.wait+=dt;if(e.wait>9){e.wait=0;e.trip=!e.trip;send(e,e.trip?[[167,12],[167,e===actors[2]?6:19]]:[[167,12],[e===worker?171:169,12]]);}}
 }
 if(stage==='pickup'){cell.rotation.y+=dt;cell.position.y=1.4+(reduced.matches?0:Math.sin(clock*3)*.08);}
 if(heldCell.visible){heldCell.position.copy(offset).applyQuaternion(State.camera.quaternion).add(State.camera.position);heldCell.rotation.y=clock;}
 ring.material.emissiveIntensity=.08+power*1.5;ring.rotation.z=reduced.matches?0:clock*.1*power;
 petals.forEach((p,i)=>{const a=i*Math.PI/4;p.rotation.z=Math.cos(a)*(.4+power*.6);p.rotation.x=Math.sin(a)*(.4+power*.6);});
 jets.visible=power>.01;for(let i=0;i<32;i++){const a=i*Math.PI/4,t=reduced.matches?.5:(clock*.55+i/32)%1;pose.position.set(176.5+Math.cos(a)*t*1.5,1.35+Math.sin(t*Math.PI)*2.8*power,12+Math.sin(a)*t*1.5);pose.scale.setScalar(power);pose.updateMatrix();jets.setMatrixAt(i,pose.matrix);}jets.instanceMatrix.needsUpdate=true;
 near=stage==='pickup'&&dist(...CELL)<2.2?'cell':stage==='follow'&&dist(...SOCKET)<2.5?'socket':null;
 prompt.hidden=!near;prompt.textContent=near==='cell'?'E / Tap · Pick up power cell':'E / Tap · Restore the garden';if(clock>captionUntil)caption.hidden=true;
}
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,(now-last)/1000);last=now;if(!API.frozen)step(dt);}
const API=window.FCArrival={get busy(){return busy();},get stage(){return stage;},get power(){return power;},get root(){return root;},get worker(){return worker;},get near(){return near;},get combatants(){return root?.visible?actors.filter(e=>!dead(e)).map(e=>({char:e.char,kind:'street',owner:e.ent,pos:e.ent.position})):[];},use,frozen:false,debug:{step,run(seconds){for(let t=0;t<seconds;t+=.05)step(.05);},get actors(){return actors;}}};requestAnimationFrame(frame);
})();
