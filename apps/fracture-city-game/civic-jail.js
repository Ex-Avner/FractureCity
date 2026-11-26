/* The Custody House · 0.111

   A working jail and a breakout you play, not read.

   The building: grey concrete perimeter with razor wire and wall floodlights; Cell
   Block A (four barred cells, a patrolled corridor); a service duct behind the cells;
   the laundry; an open-air yard with a guard tower and a sweeping searchlight; the
   control room; the service passage; public intake on the east street. Ceilings sit
   on the walls. Furniture, bars, doors and the tower legs collide.

   The people: inmates in orange, guards in navy with caps, badges and batons, a
   laundry worker in grey.

   The breakout (stations and timing are server-checked through justice-rules.js):
     1. Pry the vent cover in your cell. Hold E, and only while the corridor guard
        is not looking in. Seen mid-pry means caught.
     2. Crawl the duct behind the cells (a real, narrow, dark passage) and push out
        the grate into the laundry.
     3. Pull on a guard uniform from the rack. In uniform, guards only notice you up
        close; before it, any guard who sees you outside your cell raises the alarm,
        and so does the searchlight.
     4. Lift the service key in the control room while the desk guard walks his yard
        round (the second half of every 36 s cycle).
     5. The service door opens with the key. Crawl out through the rainwater outlet.
   Caught: back to your cell. An opened vent stays open; the uniform is taken.

   Sentencing, persistence and online authority are unchanged from 0.97 (see
   CUSTODY-HOUSE.md). FCJustice.debug drives the guards for tests. */
(function(){'use strict';
if(!window.FCJusticeRules||typeof THREE==='undefined')return;
const R=FCJusticeRules,KEYS=new Set(['1,-2','2,-2','1,-1','2,-1']),SAVE='fc-justice-solo-v1',QUEUE='fc-justice-pending-v1';
const online=()=>new URLSearchParams(location.search).has('online'),live=()=>online()&&window.FCCityOnline?.connected;
let local=R.fresh(),pending=[],remote=null,offset=0,scope='',jailed=false,scene,root,resources=[],near,panel,oldFocus,paused,busy=false,hold=null,last=0,nextSync=0,arriving=false,error='',arrivalChecked=false,suspicion=0,caughtAt=0,frozen=null;
try{local=R.clean(JSON.parse(localStorage.getItem(SAVE))||R.fresh(),Date.now());}catch{}
try{pending=JSON.parse(localStorage.getItem(QUEUE))||[];if(!Array.isArray(pending))pending=[];}catch{}
const now=()=>Date.now()+offset;
function data(){return online()?(remote||R.fresh()):local;}
const active=()=>R.active(data(),now());
const stage=()=>active()?data().stage:-1;
function persist(){try{localStorage.setItem(SAVE,JSON.stringify(local));localStorage.setItem(QUEUE,JSON.stringify(pending));}catch{error='Browser storage is unavailable; solo progress cannot survive a reload.';}}
function ingest(s){if(!s)return;remote=s;offset=s.time-Date.now();if(s.position)teleport(s.position);}
function teleport(p){for(const k of KEYS)if(!State.chunkMap.has(k))shBuildChunk(k);Player.mode='walk';Player.position.set(p.x,p.y+Player.height,p.z);Player.velocity.set(0,0,0);State.keys?.clear?.();if(typeof shTouchReleaseAll==='function')shTouchReleaseAll();}
const tone=o=>{try{return typeof shTone==='function'?shTone(o):null}catch{return null}};
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
function admit(){if(arriving)return;arriving=true;close();for(const name of ['FCOmnism','FCCivic','FCCommonGroundGuide','FCWorldStudio'])window[name]?.close?.();State.ui.inDialogue=false;State.ui.paused=false;State.ui.construct=false;if(window.FN){FN.heat=0;FN.pending.length=0;}if(typeof Mining!=='undefined')Mining.held=false;window.FCWorldEdit?.setActive(false);window.Board?.dismount?.();teleport(R.anchor(data()));Player.yaw=Math.PI/2;Player.pitch=-.12;Player.hp=Player.hpMax||Player.maxHp||100;Player.invulnTime=3;if(typeof refreshHpHUD==='function')refreshHpHUD();jailed=true;suspicion=0;toast('CUSTODY · Three civilian killings in five minutes. Ten minutes in Cell 01, or find your own way out.','warn');arriving=false;}

// ─── Blocks (fixed ids) ────────────────────────────────────────────────────
const BK={};
[['concrete',200,'custody concrete',0x8b8f94,.12],['plinth',201,'custody plinth',0x3b4047,.1],['paint',202,'custody paint',0xc8ccc6,.06],['floor',203,'custody floor',0x6c7177,.08],['stripe',204,'safety yellow',0xd8b229,.05],['yard',205,'yard asphalt',0x41454b,.14],['duct',206,'duct steel',0x596068,.1],['cap',207,'wall cap',0x2b2f35,.08]]
 .forEach(([k,id,name,color,grain])=>{BK[k]=shDefBlock(id,{name,solid:true,emit:false,color,grain});if(typeof MATERIALS!=='undefined')MATERIALS[id]={label:name,cls:'stone',hardness:8,drop:id,yield:1,value:1,desc:'Custody House construction.'};});

// ─── Plan (world blocks). Floor at y 1, feet at y 2. ───────────────────────
//  x 28 | 29 duct | 30 wall | 31-34 cells | 35 bars | 36-39 corridor | 40 wall | 41-57 yard | 58 wall | 59-66 east wing | 67
const P={
 vent:{x:30,z:-40},grate:{x:30,z:-17},
 cells:[[-43,-39],[-37,-34],[-32,-29],[-27,-24]],dividers:[-38,-33,-28,-23],
 corridorGate:[-31,-29],laundryDoor:[-17,-15],controlDoor:[-27,-25],serviceDoor:[-12,-10],entrance:[-37,-34],
 outlet:{x:63,z:-5},desk:{x:61.5,z:-26},keys:{x:59.2,z:-23.5},rack:{x:37,z:-13.4}
};
function plan(x,z){ // returns [floorBlock, wallTop (exclusive y) or 0, wallBlock]
 const inYard=x>=41&&x<=57&&z>=-43&&z<=-6;
 if(x===28||x===67||z===-44||z===-5){
  if(x===67&&z>=P.entrance[0]&&z<=P.entrance[1])return [BK.floor,11,BK.concrete,'entrance'];
  return [BK.floor,11,BK.concrete,'perimeter'];
 }
 if(x===29)return [BK.duct,z<=-14?0:7,BK.paint,'duct'];
 if(x===30){if((z===P.vent.z||z===P.grate.z))return [BK.floor,7,BK.paint,'hatch'];return [BK.floor,7,BK.paint,'wall'];}
 if(x>=31&&x<=35&&P.dividers.includes(z))return [BK.floor,7,BK.paint,'wall'];
 if(x>=31&&x<=39&&z===-22)return [BK.floor,7,BK.paint,'wall'];
 if(x===40){const gap=(z>=P.laundryDoor[0]&&z<=P.laundryDoor[1])||(z>=P.corridorGate[0]&&z<=P.corridorGate[1]);if(gap)return [BK.floor,0,0,'door'];return [BK.floor,7,BK.paint,'wall'];}
 if(x===58){const gap=(z>=P.controlDoor[0]&&z<=P.controlDoor[1])||(z>=P.serviceDoor[0]&&z<=P.serviceDoor[1]);if(gap)return [BK.floor,0,0,'door'];return [BK.floor,7,BK.paint,'wall'];}
 if(x>=59&&x<=66&&(z===-31||z===-19))return [BK.floor,7,BK.paint,'wall'];
 if(inYard){const line=x===41||x===57||z===-43||z===-6;return [line?BK.stripe:BK.yard,0,0,'yard'];}
 return [BK.floor,0,0,'room'];
}
// Mesh furniture that collides. Each box can be switched on and off (vent, grate, doors).
const solids=[];
function solid(id,x,y,z,w,h,d,on=true){solids.push({id,on,minX:x-w/2,maxX:x+w/2,minY:y,maxY:y+h,minZ:z-d/2,maxZ:z+d/2});}
function inject(c){const ox=c.originX,oz=c.originZ;for(const s of solids)if(s.on&&s.maxX>ox&&s.minX<ox+VOX_W&&s.maxZ>oz&&s.minZ<oz+VOX_W)c.collisionAABBs.push({minX:s.minX,maxX:s.maxX,minY:s.minY,maxY:s.maxY,minZ:s.minZ,maxZ:s.maxZ,jail:true});}
function syncSolids(){for(const k of KEYS){const c=State.chunkMap.get(k);if(!c?.collisionAABBs)continue;const a=c.collisionAABBs;for(let i=a.length-1;i>=0;i--)if(a[i].jail)a.splice(i,1);inject(c);}}
function setSolid(id,on){let changed=false;for(const s of solids)if(s.id===id&&s.on!==on){s.on=on;changed=true;}if(changed)syncSolids();}
(function furniture(){
 for(const [z0,z1] of P.cells){const zc=(z0+z1+1)/2;solid('bars',35.08,2,zc,.16,5,z1-z0+1); // barred front
  solid('bunk',32.2,2,z0+1.1,1.9,1.9,.95);solid('toilet',33.9,2,z1+.4,.6,.5,.6);}
 solid('gate',40.5,2,(P.corridorGate[0]+P.corridorGate[1]+1)/2,.16,5,3);
 solid('vent',30.5,2,P.vent.z+.5,1,2,1);solid('grate',30.5,2,P.grate.z+.5,1,2,1);
 solid('serviceDoor',58.5,2,(P.serviceDoor[0]+P.serviceDoor[1]+1)/2,.2,3.2,3);
 for(const [x,z] of [[30.9,-20],[30.9,-11]])solid('washer',x+.55,2,z,1.1,1.3,1.4);
 solid('press',34.5,2,-8,3,1,1.2);solid('rack',P.rack.x,2,P.rack.z,2.6,2,.6);
 solid('desk',61.5,2,-27.3,3,1.05,1);solid('cabinet',P.keys.x,2,P.keys.z,.5,1.8,1.2);
 for(const [x,z] of [[54.8,-42.4],[56.6,-42.4],[54.8,-40.6],[56.6,-40.6]])solid('tower',x,2,z,.35,6,.35);
 solid('intake',62,2,-38.5,1.2,1.15,5);for(let z=-43;z<=-40;z++)solid('locker',66.2,2,z+.5,.6,2.2,.95);
 for(const [x,z] of [[45,-12],[52,-12]])solid('table',x,2,z,2.2,.8,1.2);solid('bench',49,2,-30,2.4,.5,.6);
})();

// ─── Voxels ─────────────────────────────────────────────────────────────────
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){if(!KEYS.has(this.key))return generate.apply(this,arguments);this._maker=true;this.__cityFitted=1;this._parked=true;this.landmark='custody-house';
 for(let lx=0;lx<VOX_W;lx++)for(let lz=0;lz<VOX_W;lz++){
  const x=this.originX+lx,z=this.originZ+lz;this.vSet(lx,0,lz,(lx===1||lz===1)?B_PAINT:B_ASPHALT);
  if(x>=68&&x<=71&&z>=-39&&z<=-32)this.vSet(lx,0,lz,BK.floor); // forecourt: nothing parks across the entrance
  if(x<28||x>=68||z< -44||z>=-4)continue;
  const [floor,top,wall,kind]=plan(x,z);this.vSet(lx,1,lz,floor);
  if(kind==='perimeter'){for(let y=2;y<top;y++)this.vSet(lx,y,lz,y<=2?BK.plinth:y===top-1?BK.cap:BK.concrete);}
  else if(kind==='duct'){if(top)for(let y=2;y<top;y++)this.vSet(lx,y,lz,wall);else for(let y=4;y<7;y++)this.vSet(lx,y,lz,BK.duct);} // the duct: two blocks of air under a steel lid
  else if(kind==='hatch'){for(let y=4;y<top;y++)this.vSet(lx,y,lz,wall);}
  else if(kind==='entrance'){for(let y=6;y<top;y++)this.vSet(lx,y,lz,y===top-1?BK.cap:BK.concrete);}
  else if(kind==='door'&&(x===40||x===58)){for(let y=5;y<7;y++)this.vSet(lx,y,lz,BK.paint);} // lintel: doors are 3 m, not open to the ceiling
  else if(top)for(let y=2;y<top;y++)this.vSet(lx,y,lz,y===2?BK.plinth:wall);
 }
 inject(this);
};

// ─── Meshes ────────────────────────────────────────────────────────────────
let parts=null,guards=[],inmates=[],worker=null,cones=[],spot=null,beam=null;
function dispose(){for(const a of [...guards,...inmates,worker].filter(Boolean))window.FCNpcs?.dispose?.(a);guards=[];inmates=[];worker=null;cones=[];root?.removeFromParent();for(const r of new Set(resources))r.dispose?.();resources=[];root=null;scene=null;parts=null;}
function look(kind,i){const W=window.FCWardrobe,base={...(W?.DEFAULT_LOOK||{}),makeup:'none',piercings:'none',extras:[],lips:'none'};
 const skins=['#8d5a3b','#c98d66','#e4b48f','#5e3a26','#b07a54','#f0c9a6'],hair=['#1a1410','#3b2a1f','#6b4b2a','#111111','#9a8f84'];
 if(kind==='guard')return {...base,skin:skins[(i*3+1)%6],hair:hair[i%5],hairStyle:'crop',headgear:'cap',top:'turtleneck',top2:'#1b2742',outfit:'tailored',coat:'#1e2b48',pants:'#18213a',bottoms:'cargo',boots:'combat',boots2:'#0d0e12',accent:'#d8b34a',extras:['gloves'],tattoos:'none',legwear:'none'};
 if(kind==='worker')return {...base,skin:skins[2],hair:'#2a2420',hairStyle:'bun',headgear:'none',top:'tee',top2:'#8a9197',outfit:'none',pants:'#8a9197',bottoms:'cargo',boots:'high-tops',boots2:'#dcdcdc',tattoos:'none'};
 return {...base,skin:skins[i%6],hair:hair[(i+2)%5],hairStyle:['buzz','crop','bald','dreads','undercut','buzz'][i%6],headgear:'none',top:'tee',top2:'#e2621f',outfit:'none',pants:'#e2621f',bottoms:'cargo',boots:'high-tops',boots2:'#f2f2f2',accent:'#f2f2f2',tattoos:['none','sleeve','bands','neck','none','blackwork'][i%6],legwear:'none'};}
function build(){if(root&&scene===State.scene){if(root.parent!==scene)scene.add(root);return;}dispose();scene=State.scene;root=new THREE.Group();root.name='custody-house';scene.add(root);
 const std=(color,r=.8,m=.1)=>{const x=new THREE.MeshStandardMaterial({color,roughness:r,metalness:m});resources.push(x);return x;};
 const glow=(color,i=1.3)=>{const x=new THREE.MeshStandardMaterial({color:0x111111,emissive:color,emissiveIntensity:i,roughness:.6});resources.push(x);return x;};
 const M={steel:std(0x6d767d,.45,.6),dark:std(0x24282e,.7,.3),bunk:std(0x5d666e,.5,.5),mattress:std(0x8b8f7a,.95,0),blanket:std(0x3e5a70,.95,0),porcelain:std(0xe8ebec,.3,0),wood:std(0x6e5240,.8,0),laundry:std(0xd9dcd8,.6,.1),navy:std(0x1e2b48,.9,0),orange:std(0xe2621f,.9,0),wire:std(0x9aa3a8,.4,.8),
  sign:std(0x1a1f26,.6,.2),panel:glow(0xe8f1ff,1.1),amber:glow(0xffb347,1.4),red:glow(0xff3b30,1.6),green:glow(0x4cd964,1.2),screen:glow(0x6fd3ff,.9),court:std(0xe9e6dc,.8,0),hoop:std(0xd9541e,.5,.4),glass:new THREE.MeshStandardMaterial({color:0x9fc7d8,roughness:.1,metalness:.2,transparent:true,opacity:.35})};resources.push(M.glass);
 const batches=new Map(),dummy=new THREE.Object3D();
 const box=(m,x,y,z,w,h,d,ry=0,rz=0,rx=0)=>{if(!batches.has(m))batches.set(m,[]);batches.get(m).push([x,y+h/2,z,w,h,d,ry,rz,rx]);}; // y is the underside
 const mesh=(g,m,x,y,z)=>{resources.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);root.add(o);return o;};
 function sign(text,sub,x,y,z,w,ry=0,col='#f2c94c'){const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d');g.fillStyle='#14181e';g.fillRect(0,0,1024,256);g.fillStyle=col;g.fillRect(0,0,1024,18);g.fillRect(0,238,1024,18);g.textAlign='center';g.fillStyle='#f4f4f0';let fs=96;g.font='800 '+fs+'px system-ui,sans-serif';while(g.measureText(text).width>960)g.font='800 '+(--fs)+'px system-ui,sans-serif';g.fillText(text,512,130);g.font='600 34px system-ui,sans-serif';g.fillStyle=col;if(sub)g.fillText(sub,512,200);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;resources.push(t);const m=new THREE.MeshBasicMaterial({map:t});resources.push(m);mesh(new THREE.PlaneGeometry(w,w/4),m,x,y,z).rotation.y=ry;}
 // Ceilings sit on the partition tops (y 7) and run into the perimeter walls.
 for(const [x0,x1,z0,z1] of [[29,41,-44,-22],[30,41,-22,-5],[58,67,-44,-5]]){box(M.dark,(x0+x1)/2,7,(z0+z1)/2,x1-x0,.25,z1-z0);}
 // Fluorescent panels under the ceilings, in rows.
 for(let z=-42;z<=-24;z+=3.5)box(M.panel,37.5,6.92,z,.5,.06,1.6);for(const z of [-40.5,-35.5,-30.5,-25.5])box(M.panel,33,6.92,z,1.2,.06,.4);
 for(let z=-20;z<=-7;z+=4)box(M.panel,35,6.92,z,2.4,.06,.5);for(let z=-42;z<=-7;z+=4)box(M.panel,62.5,6.92,z,2.4,.06,.5);
 // Razor wire along the perimeter top, floodlights on brackets.
 const torus=new THREE.TorusGeometry(.32,.025,4,10);resources.push(torus);const wire=[];
 for(let x=28.5;x<=67.5;x+=.55){wire.push([x,11.35,-43.6,Math.PI/2],[x,11.35,-4.4,Math.PI/2]);}for(let z=-43.5;z<=-4.5;z+=.55){wire.push([28.4,11.35,z,0],[67.6,11.35,z,0]);}
 const coils=new THREE.InstancedMesh(torus,M.wire,wire.length);wire.forEach(([x,y,z,r],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,r,0);dummy.scale.set(1,1,1);dummy.updateMatrix();coils.setMatrixAt(i,dummy.matrix);});root.add(coils);
 for(const [x,z,ry] of [[28,-24,Math.PI/2],[67,-15,-Math.PI/2],[48,-44,0],[48,-5,Math.PI],[67,-41,-Math.PI/2]]){const o=-Math.sin(ry)*.5,p=-Math.cos(ry)*.5;box(M.steel,x+o*.3,10.6,z+p*.3,.25,.15,.25);box(M.steel,x+o,10.3,z+p,.5,.35,.5,ry);box(M.amber,x+o*1.4,10.28,z+p*1.4,.32,.2,.08,ry);}
 // Public intake: canopy anchored into the wall, signage, stripes.
 box(M.dark,69,6,-35.5,4,.3,6);for(const z of [-38.2,-32.8])box(M.steel,70.8,1.2,z,.18,4.8,.18);
 sign('CUSTODY HOUSE','FRACTURE CITY · INTAKE · VISITS · RELEASE',68.06,8.6,-35.5,9,Math.PI/2);
 sign('PUBLIC INTAKE','',68.06,4.6,-40.5,3.4,Math.PI/2,'#6fd3ff');
 // Cell Block A: barred fronts, bunks, toilets, sinks, numbers.
 const barGeo=new THREE.BoxGeometry(1,1,1);
 for(const [n,[z0,z1]] of P.cells.entries()){const zc=(z0+z1+1)/2,span=z1-z0+1;
  for(let z=z0+.12;z<z1+1;z+=.22)box(M.steel,35.08,2,z,.06,5,.06);box(M.steel,35.08,2,zc,.12,.12,span);box(M.steel,35.08,4.2,zc,.12,.12,span);box(M.steel,35.08,6.85,zc,.14,.15,span);
  box(M.bunk,32.2,2.25,z0+1.1,1.9,.12,.95);box(M.mattress,32.2,2.37,z0+1.1,1.85,.16,.9);box(M.bunk,32.2,3.6,z0+1.1,1.9,.12,.95);box(M.mattress,32.2,3.72,z0+1.1,1.85,.16,.9);box(M.blanket,32.5,2.53,z0+1.1,1.2,.06,.88);
  for(const x of [31.3,33.1])box(M.bunk,x,2,z0+.65,.08,1.9,.08),box(M.bunk,x,2,z0+1.55,.08,1.9,.08);
  box(M.porcelain,33.9,2,z1+.4,.5,.45,.55);box(M.porcelain,34.2,2.9,z1+.4,.2,.25,.45);box(M.steel,31.2,2.9,z1+.3,.35,.3,.5);
  sign('A-0'+(n+1),'',35.2,6.5,zc,1.3,Math.PI/2,'#f2c94c');
 }
 // The corridor gate to the yard (locked), and a duty desk at the corridor end.
 for(let z=P.corridorGate[0];z<P.corridorGate[1]+1;z+=.22)box(M.steel,40.5,2,z+.1,.06,5,.06);box(M.steel,40.5,4.2,-29.5,.12,.12,3);
 box(M.red,39.97,5.6,-28.3,.06,.18,.18);
 sign('CELL BLOCK A','INMATES ONLY BEYOND THIS POINT',37.5,5.6,-22.03,4.4,Math.PI);
 // Vent cover (cell side of the wall) and laundry grate.
 const vent=new THREE.Group();vent.position.set(31.02,2.15,P.vent.z+.5);root.add(vent);
 for(let i=0;i<7;i++){const s=new THREE.Mesh(barGeo,M.steel);s.scale.set(.04,.06,.9);s.position.set(0,.18+i*.22,0);vent.add(s);}const vf=new THREE.Mesh(barGeo,M.dark);vf.scale.set(.03,1.7,.98);vf.position.y=.85;vent.add(vf);
 const grate=new THREE.Group();grate.position.set(31.02,2.15,P.grate.z+.5);root.add(grate);
 for(let i=0;i<5;i++){const s=new THREE.Mesh(barGeo,M.steel);s.scale.set(.05,1.7,.05);s.position.set(0,.85,-.4+i*.2);grate.add(s);}
 // Duct: a dim strip of light every few metres so it reads as a passage.
 for(let z=-42;z<=-15;z+=4)box(M.amber,29.5,3.95,z,.12,.04,.4);
 // Laundry: drums, press, carts, the uniform rack.
 for(const z of [-20,-11]){box(M.laundry,31.45,2,z,1.1,1.3,1.4);const d=mesh(new THREE.TorusGeometry(.34,.06,6,18),M.steel,32.02,2.65,z);d.rotation.y=Math.PI/2;box(M.dark,32.01,2.65,z,.02,.5,.5);}
 box(M.laundry,34.5,2,-8,3,1,1.2);for(let i=0;i<4;i++)box(i%2?M.orange:M.laundry,33.5+i*.7,3,-8,.55,.2,.8);
 box(M.steel,37,3.8,P.rack.z,2.6,.06,.06);for(const x of [35.75,38.25])box(M.steel,x,2,P.rack.z,.06,1.9,.06);
 const uniforms=[];for(let i=0;i<5;i++){const u=new THREE.Mesh(barGeo,M.navy);u.scale.set(.42,1.15,.16);u.position.set(35.95+i*.52,3.15,P.rack.z);root.add(u);uniforms.push(u);}
 sign('LAUNDRY','',35.5,5.8,-20.97,3.6,0,'#f2c94c');
 // Yard: court lines, hoop, benches, tables, the tower and its searchlight.
 for(const [x,z,w,d] of [[49,-36,.1,12],[43.6,-36,.1,12],[54.4,-36,.1,12],[49,-42,10.8,.1],[49,-30,10.8,.1]])box(M.court,x,2.005,z,w,.02,d);
 box(M.steel,49,2,-42.6,.2,3.5,.2);box(M.steel,49,5.4,-42.3,1.8,1.1,.08);box(M.hoop,49,5.5,-41.95,.6,.05,.6);
 box(M.wood,49,2.25,-30,2.4,.25,.6);for(const x of [48,50])box(M.steel,x,2,-30,.1,.25,.5);
 for(const [x,z] of [[45,-12],[52,-12]]){box(M.wood,x,2.7,z,2.2,.1,1.2);box(M.wood,x,2.4,z-1,2.2,.08,.35);box(M.wood,x,2.4,z+1,2.2,.08,.35);box(M.steel,x,2,z,.12,.7,.12);}
 for(const [x,z] of [[54.8,-42.4],[56.6,-42.4],[54.8,-40.6],[56.6,-40.6]])box(M.steel,x,2,z,.3,6,.3);box(M.dark,55.7,8,-41.5,3.2,1.2,3.2);box(M.glass,55.7,9.2,-41.5,3.3,1.2,3.3);box(M.dark,55.7,10.4,-41.5,3.6,.25,3.6);for(const [x,z] of [[54.1,-41.5],[57.3,-41.5]])box(M.steel,x,9.2,z,.08,1.2,.08);
 for(let y=2.5;y<8;y+=.5)box(M.steel,54.62,y,-40.25,.08,.05,.4); // ladder rungs on the leg
 sign('YARD','EXERCISE · 60 MIN',49,5.8,-5.03,4,Math.PI,'#4cd964');
 // Control room: desk, monitors, key cabinet, alarm light.
 box(M.dark,61.5,2,-27.3,3,1.05,1);for(let i=0;i<3;i++){box(M.dark,60.6+i*.9,3.05,-27.6,.8,.5,.06);box(M.screen,60.6+i*.9,3.1,-27.56,.7,.4,.02);}
 box(M.steel,P.keys.x,2,P.keys.z,.5,1.8,1.2);const key=new THREE.Mesh(barGeo,M.amber);key.scale.set(.06,.25,.12);key.position.set(P.keys.x+.28,3.2,P.keys.z);root.add(key);
 box(M.red,57.95,6.55,-24.3,.06,.25,.25);sign('CONTROL','STAFF ONLY',57.97,5.85,-26,2.6,-Math.PI/2,'#ff6b5e');
 // Service passage: pipes run wall to wall, the outlet grate in the south wall.
 for(const y of [5.4,5.8])box(M.steel,66.5,y,-12.5,.18,.18,13);for(const z of [-18,-13,-8])box(M.steel,66.5,5,z,.25,.9,.25);
 const doorPivot=new THREE.Group();doorPivot.position.set(58.5,2,P.serviceDoor[1]+1);root.add(doorPivot);const dp=new THREE.Mesh(barGeo,M.steel);dp.scale.set(.12,3.2,3);dp.position.set(0,1.6,-1.5);doorPivot.add(dp);
 const dw=new THREE.Mesh(barGeo,M.amber);dw.scale.set(.14,.18,.6);dw.position.set(-.05,2.4,-1.5);doorPivot.add(dw);
 sign('SERVICE','AUTHORIZED · KEY REQUIRED',57.97,5.85,-11,2.6,-Math.PI/2,'#f2c94c');
 for(let i=0;i<6;i++)box(M.steel,P.outlet.x-.25+i*.12,2.05,-5.03,.05,.9,.05);box(M.dark,P.outlet.x+.35,2,-5.06,1.2,1,.04);
 // Intake: desk with glass, lockers, phones.
 box(M.dark,62,2,-38.5,1.2,1.1,5);box(M.glass,61.4,3.1,-38.5,.04,1.7,5);for(let z=-43;z<=-40;z++){box(M.steel,66.2,2,z+.5,.6,2.2,.95);box(M.dark,65.89,3,z+.5,.02,.08,.3);}
 for(const z of [-35,-33.5]){box(M.dark,59.4,3,z,.2,.8,.3);box(M.steel,59.55,3.2,z,.08,.3,.1);}sign('RELEASE · PROPERTY','',63,5.9,-31.03,4,Math.PI,'#6fd3ff');
 // Searchlight: a beam from the tower and a bright disc on the yard floor.
 const discGeo=new THREE.CircleGeometry(1,40);discGeo.rotateX(-Math.PI/2);resources.push(discGeo);
 const discMat=new THREE.MeshBasicMaterial({color:0xfff3c4,transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});resources.push(discMat);
 spot=new THREE.Mesh(discGeo,discMat);spot.position.y=2.03;spot.renderOrder=3;root.add(spot);
 const beamGeo=new THREE.CylinderGeometry(.25,1,1,16,1,true);beamGeo.translate(0,-.5,0);resources.push(beamGeo);
 const beamMat=new THREE.MeshBasicMaterial({color:0xfff3c4,transparent:true,opacity:.11,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});resources.push(beamMat);
 beam=new THREE.Mesh(beamGeo,beamMat);beam.renderOrder=3;root.add(beam);
 // Flush the batches.
 for(const [m,list]of batches){const inst=new THREE.InstancedMesh(barGeo,m,list.length);list.forEach(([x,y,z,w,h,d,ry,rz,rx],i)=>{dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});root.add(inst);}
 resources.push(barGeo);
 // People.
 if(window.FCNpcs){
  const mk=(lk,name,seed)=>{const a=FCNpcs.body(lk,name,'wanderer',{},seed);a.char.plate.visible=false;root.add(a.group);return a;};
  const coneGeo=(r,ang)=>{const g=new THREE.CircleGeometry(r,24,-ang,ang*2);g.rotateX(-Math.PI/2);resources.push(g);return g;};
  for(const [i,name,range,ang] of [[0,'Officer Vale',9,.62],[1,'Officer Brandt',8,.6],[2,'Officer Okafor',11,.6]]){
   const a=mk(look('guard',i),name,'custody:guard:'+i);
   const baton=new THREE.Mesh(barGeo,M.dark);baton.scale.set(.05,.5,.05);baton.position.set(.28,.85,0);a.group.add(baton);const badge=new THREE.Mesh(barGeo,M.amber);badge.scale.set(.02,.07,.06);badge.position.set(.17,1.38,.08);a.group.add(badge);
   const cm=new THREE.MeshBasicMaterial({color:0xffd34d,transparent:true,opacity:.16,depthWrite:false,fog:false});resources.push(cm);const cone=new THREE.Mesh(coneGeo(range,ang),cm);cone.renderOrder=2;root.add(cone);
   a.guard={i,range,ang,x:0,z:0,face:0,cone,cm,walking:false};guards.push(a);cones.push(cone);
  }
  for(let i=0;i<6;i++)inmates.push(mk(look('inmate',i),'','custody:inmate:'+i));
  worker=mk(look('worker',0),'','custody:worker');
 }
 parts={vent,grate,uniforms,key,doorPivot};
 root.traverse(o=>{if(o.isMesh||o.isInstancedMesh){o.userData._hdTag=1;o.castShadow=false;o.receiveShadow=false;}});
}

// ─── The people move ────────────────────────────────────────────────────────
//  Vale's round follows the server's clock. Brandt walks the cell corridor and
//  looks into each cell. Okafor walks the yard. The tower sweeps its light.
const lerp=(a,b,t)=>a+(b-a)*Math.max(0,Math.min(1,t));
function cyclePhase(){if(frozen?.phase!=null)return frozen.phase;const s=data();return active()?((now()-s.started)%36000+36000)%36000/36000:(now()%36000)/36000;}
function valeAt(ph){ // desk until halfway, then out into the yard and back
 if(ph<.5)return {x:P.desk.x,z:P.desk.z,face:Math.PI*1.5,walk:false};
 if(ph<.58){const k=(ph-.5)/.08;return k<.5?{x:lerp(P.desk.x,58.5,k*2),z:-26,face:Math.PI*1.5,walk:true}:{x:lerp(58.5,51,(k-.5)*2),z:-26,face:Math.PI*1.5,walk:true};}
 if(ph<.9)return {x:51,z:-26,face:Math.PI*1.5+Math.sin((ph-.58)*40)*1.1,walk:false};
 if(ph<.98){const k=(ph-.9)/.08;return {x:lerp(51,P.desk.x,k),z:-26,face:Math.PI*.5,walk:true};}
 return {x:P.desk.x,z:P.desk.z,face:Math.PI*1.5,walk:false};
}
const CELLZ=[-40.5,-35,-30,-25];
function brandtAt(t){ // 28 s: down the corridor with four looks into the cells, then back
 const T=28,k=(t%T)/T,leg=k<.5?k*2:(1-k)*2,z=lerp(-42,-24.5,leg),dir=k<.5?1:-1;
 for(const cz of CELLZ){if(Math.abs(z-cz)<.9){const look=Math.abs(z-cz)<.55;return {x:37.2,z,face:look?Math.PI*1.5:(dir>0?0:Math.PI),walk:!look,looking:look};}}
 return {x:37.2,z,face:dir>0?0:Math.PI,walk:true};
}
function okaforAt(t){ // 44 s loop around the yard edge
 const pts=[[42.6,-39.5],[53.6,-39.5],[56,-31],[56,-8.5],[42.6,-8.5]],n=pts.length,T=46,k=(t%T)/T*n,i=Math.floor(k),f=k-i,a=pts[i],b=pts[(i+1)%n];
 return {x:lerp(a[0],b[0],f),z:lerp(a[1],b[1],f),face:Math.atan2(b[0]-a[0],b[1]-a[1]),walk:true};
}
function spotAt(t){return {x:49+Math.sin(t*.31)*6.5,z:-24+Math.sin(t*.62)*14,r:3.2};}
const DOWN=new THREE.Vector3(0,-1,0),BEAMDIR=new THREE.Vector3();
const SPOTS_INMATES=[[33.2,2,-35.2,'watch'],[33,2,-30.2,'watch'],[32.6,2,-25.6,'lean'],[45.5,2,-34,'talk'],[46.4,2,-33.2,'talk'],[52,2,-19,'watch']];
function animatePeople(t,dt){
 const ph=cyclePhase();
 guards.forEach(a=>{const g=a.guard;const st=g.i===0?valeAt(ph):g.i===1?brandtAt(frozen?.brandt??t):okaforAt(frozen?.okafor??t);
  g.x=st.x;g.z=st.z;g.face=st.face;g.walking=st.walk;g.looking=!!st.looking;a.group.position.set(st.x,2,st.z);a.char.group.rotation.y=st.face;
  try{shAnimateCharacter(a.char,dt,st.walk,t);}catch{}
  g.cone.visible=jailed&&active();g.cone.position.set(st.x,2.04,st.z);g.cone.rotation.y=st.face-Math.PI/2;});
 inmates.forEach((a,i)=>{const [x,y,z,act]=SPOTS_INMATES[i];a.group.position.set(x,y,z);a.char.group.rotation.y=i<3?Math.PI*.5:i<5?(i===3?Math.PI*.5:-Math.PI*.5):Math.PI;
  try{shAnimateCharacter(a.char,dt,false,t);FCNpcs.pose(a,act,t,dt,false);}catch{}});
 if(worker){worker.group.position.set(33.2,2,-12.4);worker.char.group.rotation.y=Math.PI;try{shAnimateCharacter(worker.char,dt,false,t);FCNpcs.pose(worker,'talk',t,dt,false);}catch{}}
 const sp=spotAt(frozen?.spot??t);spot.position.set(sp.x,2.03,sp.z);spot.scale.setScalar(sp.r);
 const tx=55.7,ty=9.6,tz=-41.5,dx=sp.x-tx,dy=2-ty,dz=sp.z-tz,L=Math.hypot(dx,dy,dz);beam.position.set(tx,ty,tz);beam.scale.set(sp.r*.95,L,sp.r*.95);beam.quaternion.setFromUnitVectors(DOWN,BEAMDIR.set(dx/L,dy/L,dz/L));
 spot.visible=beam.visible=true;
}

// ─── Being seen ─────────────────────────────────────────────────────────────
function eye(){return {x:Player.position.x,y:Player.position.y-.15,z:Player.position.z};}
function sees(g,p){const dx=p.x-g.x,dz=p.z-g.z,d=Math.hypot(dx,dz);if(d>g.range||d<.01)return 0;const ang=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(ang-g.face),Math.cos(ang-g.face));if(Math.abs(diff)>g.ang)return 0;
 if(typeof shLineOfSight==='function'&&!shLineOfSight(g.x,3.6,g.z,p.x,p.y,p.z))return 0;return 1-d/g.range*.5;}
function inYard(p){return p.x>40.6&&p.x<57.4&&p.z>-43.5&&p.z<-5.5;}
function exposure(){const st=stage(),p=eye(),f=Player.position.y-Player.height;if(st<0||f>4.6)return {rate:0};
 let rate=0,who='';
 for(const a of guards){const g=a.guard,s=sees(g,p);if(!s)continue;const d=Math.hypot(p.x-g.x,p.z-g.z);
  if(st===0){if(hold?.id==='vent'){rate=Math.max(rate,1.3*s);who=a.char?.name||'A guard';}}
  else if(st<3){rate=Math.max(rate,1.6*s);who='Officer';}
  else{if(d<3.2){rate=Math.max(rate,.7);who='Officer';}if(hold&&hold.id==='keys'){rate=Math.max(rate,1.4*s);}}
 }
 const sp=spotAt(frozen?.spot??performance.now()/1000);if(st>=1&&st<3&&inYard(p)&&Math.hypot(p.x-sp.x,p.z-sp.z)<sp.r)rate=Math.max(rate,2.2);
 return {rate,who};}
async function caught(){if(caughtAt&&performance.now()-caughtAt<4000)return;caughtAt=performance.now();hold=null;suspicion=0;
 tone({f0:880,f1:660,gain:.12,dur:.35,type:'square'});setTimeout(()=>tone({f0:880,f1:660,gain:.12,dur:.35,type:'square'}),420);
 flash.style.opacity='1';setTimeout(()=>{flash.style.opacity='0';},700);
 try{await act('caught','');}catch(e){teleport(R.CELL);}
 toast('CAUGHT · Marched back to A-01.'+(data().stage>=1?' The vent is still open.':''),'warn');}

// ─── Actions ────────────────────────────────────────────────────────────────
async function act(type,id){if(online()){if(!live())throw Error('Reconnect to continue. Your sentence timer still runs.');const s=await FCCityOnline.request('jail-action',{action:type,id});ingest(s);}else{const to=R.action(local,feet(),{action:type,id},Date.now());persist();if(to)teleport(to);}}
function feet(){return {x:Player.position.x,y:Player.position.y-Player.height,z:Player.position.z};}
let holdWhy='';
async function startHold(){holdWhy=hold?'holding':busy?'busy':!near?'far':near.hint?'hint':!active()?'inactive':'';if(holdWhy)return;const a=near.station,h={id:a.id,t0:performance.now(),need:a.seconds*1000+(online()?350:0),station:a,pending:true};hold=h;busy=true;tone({f0:240,f1:300,gain:.04,dur:.1});
 try{await act('begin',a.id);h.pending=false;error='';}catch(e){if(hold===h)hold=null;error=e.message;toast(error,'warn');}finally{busy=false;}} // the bar starts on the key press, not on the server reply
function stopHold(){if(!hold||hold.done)return;if(performance.now()-hold.t0>=hold.need&&!hold.pending)finishHold();else hold=null;} // letting go after the bar is full still counts
async function finishHold(){const h=hold;if(!h||h.done||h.pending)return;h.done=true;busy=true;try{await act('finish',h.id);tone({f0:420,f1:620,gain:.07,dur:.25});toast(h.station.text,'success');if(!active())release('escaped');}catch(e){error=e.message;toast(error,'warn');}finally{busy=false;hold=null;}}
function release(reason){close();teleport(R.EXIT);jailed=false;suspicion=0;hold=null;toast(reason==='escaped'?'Out through the rainwater outlet. Your equipment is yours again.':'Sentence served. You are free to leave. Your equipment is yours again.','success');}

// ─── HUD ────────────────────────────────────────────────────────────────────
const prompt=document.createElement('button');prompt.id='jail-approach';prompt.hidden=true;document.body.append(prompt);
const hud=document.createElement('button');hud.id='jail-status';hud.hidden=true;document.body.append(hud);hud.onclick=()=>open(true);
const meter=document.createElement('div');meter.id='jail-seen';meter.innerHTML='<span></span><b>SEEN</b>';meter.hidden=true;document.body.append(meter);
const flash=document.createElement('div');flash.id='jail-flash';document.body.append(flash);
const css=document.createElement('style');css.textContent=`
#jail-status{position:fixed;top:18px;left:18px;z-index:126000;max-width:340px;padding:12px 16px;border:1px solid #f2c94c;border-left:4px solid #e2621f;border-radius:12px;background:#14181eed;color:#f4f2ea;text-align:left;font:13px/1.5 system-ui;cursor:pointer}#jail-status strong,#jail-status span{display:block}#jail-status em{font-style:normal;color:#f2c94c}
#jail-approach{position:fixed;bottom:118px;left:50%;transform:translateX(-50%);z-index:126001;max-width:calc(100vw - 24px);padding:13px 22px;border:1px solid #f2c94c;border-radius:22px;background:#14181eed;color:#fff4d8;font:600 14px system-ui;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;background-image:linear-gradient(90deg,#e2621f88 var(--p,0%),transparent var(--p,0%))}#jail-approach.hint{border-color:#7f8b96;cursor:default}
#jail-status[hidden],#jail-approach[hidden],#jail-seen[hidden]{display:none}
#jail-seen{position:fixed;top:96px;left:50%;transform:translateX(-50%);z-index:126002;width:200px;height:20px;border:1px solid #ff6b5e;border-radius:10px;background:#14181ecc;overflow:hidden;pointer-events:none}#jail-seen span{position:absolute;inset:0;width:0;background:#ff3b30}#jail-seen b{position:relative;display:block;text-align:center;font:700 11px/20px system-ui;letter-spacing:.2em;color:#fff}
#jail-flash{position:fixed;inset:0;z-index:126003;pointer-events:none;background:radial-gradient(circle,#ff3b3000 30%,#ff3b30aa);opacity:0;transition:opacity .35s}
body.in-custody #hud-weapons,body.in-custody #fn-ability,body.in-custody #dispatch-goal,body.in-custody #maker-goal,body.in-custody #fc-story-goal,body.in-custody #cg-walk-guide,body.in-custody #campaign-hud,body.in-custody #oredor-alt{visibility:hidden!important}
.jail-panel{position:fixed;inset:8vh max(12px,calc((100vw - 720px)/2));z-index:150000;overflow:auto;padding:28px;background:#14181e;color:#eceae2;border:1px solid #f2c94c;border-radius:16px;box-shadow:0 0 0 100vmax #050b10b8;font:15px/1.6 system-ui}.jail-panel h1{font:800 30px/1.1 system-ui;letter-spacing:.04em;margin:.2em 0}.jail-panel small{color:#f2c94c;letter-spacing:.14em}.jail-panel button{min-height:44px;padding:10px 16px;background:#2a3038;border:1px solid #7f8b96;border-radius:10px;color:#fff4d8;font:600 14px system-ui;cursor:pointer}.jail-panel [data-close]{float:right}.jail-panel ol{padding-left:1.2em}.jail-panel li.done{color:#7f8b96;text-decoration:line-through}.jail-panel li.now{color:#f2c94c}
@media(max-width:600px){.jail-panel{inset:8px;padding:18px}#jail-status{top:65px;left:10px;width:calc(100vw - 130px);font-size:11px;padding:8px}#jail-approach{bottom:185px;font-size:13px}}
`;document.head.append(css);
// Hold to act: E on a keyboard, press-and-hold on the prompt for touch.
prompt.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(near&&!near.hint&&near.station)startHold();else if(near?.intake)open();});
for(const ev of ['pointerup','pointercancel','pointerleave'])prompt.addEventListener(ev,()=>stopHold());
addEventListener('keydown',e=>{if(panel){if(e.code==='Escape'){e.preventDefault();close();}e.stopImmediatePropagation();return;}
 if(e.code==='KeyE'&&!prompt.hidden&&near){e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;if(near.intake)open();else if(near.station)startHold();}},true);
addEventListener('keyup',e=>{if(e.code==='KeyE')stopHold();},true);
function blocked(){const u=State.ui;return u.paused||u.inIntro||u.inDialogue||u.inInventory||u.inArcade||u.inMiniGame||u.inShiftPanel||u.construct;}
function close(){if(!panel)return;panel.remove();panel=null;State.ui.paused=paused;State.keys?.clear?.();oldFocus?.focus?.();}
const timeText=()=>{const n=Math.max(0,Math.ceil((data().until-now())/1000));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
const HINTS=['Pry the vent cover in your cell. Not while the corridor guard looks in.','Crawl the duct behind the cells. Push out the grate at the far end.','Take a guard uniform from the laundry rack. Out there, only the uniform keeps you unseen.','Lift the service key in the control room while the desk guard is out on his round.','The service door is open. Crawl out through the rainwater outlet.'];
function open(plan=false){if(panel||blocked())return;oldFocus=document.activeElement;paused=State.ui.paused;State.ui.paused=true;State.keys?.clear?.();shTouchReleaseAll?.();document.exitPointerLock?.();panel=document.createElement('section');panel.className='jail-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');document.body.append(panel);for(const type of ['pointerdown','mousedown','click'])panel.addEventListener(type,e=>e.stopPropagation());
 const st=stage();panel.innerHTML='<button data-close>Close · Esc</button><small>FRACTURE CITY / CUSTODY HOUSE</small><h1>'+(st>=0?'Ten minutes, or a way out.':'Custody House')+'</h1>'+(st>=0?'<p><b>'+timeText()+'</b> left. The clock runs while you wait, read or are offline.</p><ol>'+R.stations.map((a,i)=>'<li class="'+(i<st?'done':i===st?'now':'')+'">'+(i<=st?HINTS[i]:'…')+'</li>').join('')+'</ol><p>Guards show a cone of sight on the floor. The bar at the top fills while one is noticing you. Get caught and you are back in A-01.</p>':'<p>Public intake, visits and release. Three civilian killings within five minutes means ten minutes inside.</p>');
 panel.querySelector('[data-close]').onclick=close;panel.querySelector('button')?.focus();}

// ─── Custody disarms you without touching your inventory ───────────────────
for(const name of ['tryAttack','shBeginMine','placeBlock'])if(typeof window[name]==='function'){const original=window[name];window[name]=function(){if(active())return;return original.apply(this,arguments);};}
const damage=window.damagePlayer;if(damage)window.damagePlayer=function(){if(active())return;return damage.apply(this,arguments);};

// ─── Each frame ─────────────────────────────────────────────────────────────
let lastT=0;
function physical(){const st=stage();if(!parts)return;const vent=st>=1,grate=st>=2,uni=st>=3,key=st>=4;
 parts.vent.rotation.z=vent?-1.35:0;parts.vent.position.x=vent?31.7:31.02;parts.vent.position.y=vent?2.05:2.15;
 parts.grate.rotation.z=grate?1.4:0;parts.grate.position.x=grate?31.8:31.02;
 parts.uniforms[2].visible=!uni;parts.key.visible=!key;parts.doorPivot.rotation.y=key?-1.45:0;
 setSolid('vent',!vent);setSolid('grate',!grate);setSolid('serviceDoor',!key);}
function tick(t){requestAnimationFrame(tick);const dt=Math.min(.1,Math.max(0,(t-(lastT||t))/1000));lastT=t;if(t-last<16)return;last=t;if(!State.scene||!State.citySeed||!State.chunkMap?.size||!(window.OwnBlock?.ready||(online()&&window.FCCityOnline?.ready)))return; // online, OwnBlock never reports ready
 const key=online()?'online:'+window.FCCityOnline?.self?.accountId:'solo';if(scope!==key){scope=key;remote=null;offset=0;jailed=false;arrivalChecked=false;nextSync=0;close();}
 if(scene&&scene!==State.scene){dispose();close();jailed=false;arrivalChecked=false;}
 const pos=feet(),visible=pos.x>-80&&pos.x<180&&pos.z>-155&&pos.z<110;
 if(visible||active())build();if(root)root.visible=visible||active();
 if(online()&&live()){const snap=FCCityOnline.self?.justice;if(snap)ingest(snap);if(t>nextSync){nextSync=t+3000;flush();}}
 else if(!online()){const u=local.until;R.clean(local,Date.now());if(u!==local.until)persist();}
 if(!arrivalChecked&&(!online()||remote)){arrivalChecked=true;if(!active()&&['served','escaped'].includes(data().reason)&&pos.x>=28&&pos.x<=68&&pos.z>=-44&&pos.z<=-4)teleport(R.EXIT);}
 if(active()){if(!jailed)admit();if(!R.allowed(data(),feet(),now()))teleport(R.anchor(data()));if(window.FCWorldEdit?.active)FCWorldEdit.setActive(false);State.ui.construct=false;}
 else if(jailed)release(data().reason);
 document.body.classList.toggle('in-custody',active());
 if(root?.visible){physical();if(!blocked())animatePeople(t/1000,dt);}
 const st=stage();
 // Being noticed.
 if(st>=0&&!blocked()&&!panel){const e=exposure();suspicion=e.rate?Math.min(1,suspicion+e.rate*dt):Math.max(0,suspicion-.55*dt);if(suspicion>=1&&!frozen?.noCatch)caught();}else suspicion=Math.max(0,suspicion-dt);
 meter.hidden=!(st>=0&&suspicion>.02);if(!meter.hidden)meter.firstChild.style.width=Math.round(suspicion*100)+'%';
 for(const a of guards){a.guard.cm.color.setHex(suspicion>.05?0xff4a3d:0xffd34d);a.guard.cm.opacity=suspicion>.05?.24:.15;}
 // The next thing to do, where it is.
 const s=data(),a=st>=0?R.stations[st]:null;near=null;
 if(a&&R.near(feet(),a.at,a.id==='duct'?1.6:2)){near={station:a,label:'Hold E · '+a.verb};if(a.id==='keys'&&!R.guardAway(s,now()))near={station:a,hint:true,label:'The desk guard is at his post · wait for his round'};}
 else if(st<0&&Math.hypot(pos.x-63.5,pos.z+38.5)<3)near={intake:true,label:'E · Custody House · visitor information'};
 if(hold){const p=Math.min(1,(performance.now()-hold.t0)/hold.need);prompt.style.setProperty('--p',Math.round(p*100)+'%');if(!near||near.station?.id!==hold.id)hold=null;else if(p>=1)finishHold();}else prompt.style.setProperty('--p','0%');
 prompt.hidden=!!panel||blocked()||!near;if(!prompt.hidden&&prompt.textContent!==near.label)prompt.textContent=near.label;prompt.classList.toggle('hint',!!near?.hint);
 hud.hidden=st<0||!!panel;if(!hud.hidden)hud.innerHTML='<strong>CUSTODY · '+timeText()+(st>=3?' · <em>IN UNIFORM</em>':'')+'</strong><span>'+HINTS[st]+'</span>';
}
requestAnimationFrame(tick);
window.FCJustice={civilianDeath,open,close,get active(){return active();},get state(){return data();},get root(){return root;},get panel(){return panel;},get error(){return error;},keys:KEYS,
 debug:{get guards(){return guards.map(a=>({...a.guard,cone:undefined,cm:undefined}));},get suspicion(){return suspicion;},get near(){return near;},get hold(){return hold;},get holdWhy(){return holdWhy;},get busy(){return busy;},solids,
  freeze(o){frozen=o;},start:startHold,stop:stopHold,spot:()=>spotAt(frozen?.spot??performance.now()/1000),exposure}};
})();
