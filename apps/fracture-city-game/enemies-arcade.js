/* Bring hostile bodies and physical arcade cabinets into the resident art system. */
(function(){
'use strict';
shHookZombieMesh();shHookEnemyMeshes();
const enemyMesh=Enemy.prototype.makeMesh;
const organic=new Set(['zombie','stalker','spitter','howler','husk','thug','heavy']);
function oval(parent,color,x,y,z,w,h,d){
 const geometry=new THREE.SphereGeometry(1,16,10);geometry.scale(w,h,d);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.8}));mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
}
Enemy.prototype.makeMesh=function(rng){
 if(!organic.has(this.type))return enemyMesh.apply(this,arguments);
 const type=this.type,def=this.def,col=def.colors||{},infected=!['thug','heavy'].includes(type),large=type==='husk'||type==='heavy';
 const arch=CHAR_ARCHETYPES.find(a=>a.key==='worker')||CHAR_ARCHETYPES[0];
 const c=shBuildCharacter(arch,rng,{skin:infected?rng.pick([0x9c9983,0x858c80,0xa89b87,0x7e8275]):rng.pick(SKIN_TONES),coat:col.coat||col.jacket||col.armor||0x39454a,pants:0x252a2b,hair:0x34352f,hairStyle:infected?rng.pick(['bald','crop','long']):'crop',headgear:'none',prop:'none',handle:def.name,build:large?'solid':'lean',heightScale:def.height/1.82,widthScale:large?1.22:type==='stalker'?.86:1,accent:0x807664});
 c.plate.visible=false;if(c.aura){c.group.remove(c.aura);c.aura=null}
 // Every hostile owns its flash material; damage must not recolour the street.
 const materials=new Map();c.group.traverse(o=>{if(o.isMesh){if(!materials.has(o.material))materials.set(o.material,o.material.clone());o.material=materials.get(o.material)}});
 this.visualChar=c;this.leftArm=c.leftArm;this.rightArm=c.rightArm;this.leftLeg=c.leftLeg;this.rightLeg=c.rightLeg;
 if(infected){
  c.head.rotation.z=rng.range(-.07,.07);
  // Discolouration is painted into the same anatomical face, not luminous cubes.
  c.head.traverse(o=>{if(!o.geometry||!o.geometry.attributes.color)return;const p=o.geometry.attributes.position,a=o.geometry.attributes.color;
   for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const socket=z>.08&&Math.abs(Math.abs(x)-.032)<.023&&Math.abs(y-.055)<.026;const mottled=z>.035&&Math.sin(x*137+y*93)*Math.cos(y*173-z*65)>.65;if(socket||mottled){a.setXYZ(i,a.getX(i)*.64,a.getY(i)*.66,a.getZ(i)*.68)}}a.needsUpdate=true;
  });
 }
 if(type==='zombie'){
  const left=rng.bool();this.armReach=left?c.leftArm:c.rightArm;this.armHang=left?c.rightArm:c.leftArm;this.legL=c.leftLeg;this.legR=c.rightLeg;this.walkPhase=rng.range(0,TAU);this.lurch=rng.range(.8,1.25);
  c.head.rotation.x=.13;
 }
 if(type==='stalker'){c.leftArm.scale.y=1.14;c.rightArm.scale.y=1.14;c.head.position.z=.04;c.head.rotation.x=.14}
 if(type==='spitter'){
  this.sac=new THREE.Group();this.sac.position.set(0,1.30,-.20);c.group.add(this.sac);oval(this.sac,0x6d7860,0,0,0,.155,.22,.15);oval(c.head,0x737662,0,-.074,.043,.046,.043,.045);
 }
 if(type==='howler'){
  this.horn=new THREE.Group();this.horn.position.set(0,1.53,.061);c.group.add(this.horn);oval(this.horn,0x7d7569,0,0,0,.066,.065,.059);c.head.rotation.x=-.16;
 }
 if(large){
  const plate=new THREE.Mesh(cityRoundGeometry(.35,.36,.08,.035),new THREE.MeshStandardMaterial({color:0x3a403c,roughness:.7}));plate.position.set(0,1.25,.13);c.group.add(plate);this.plate=plate;
  for(const side of [-1,1])oval(c.group,0x454b46,side*.23,1.435,0,.093,.07,.105);
 }
 if(type==='heavy'){oval(c.head,0x46515b,0,.135,-.008,.096,.064,.09)}
 if(type==='thug'||type==='heavy'){
  const weapon=new THREE.Mesh(new THREE.BoxGeometry(.065,.075,type==='heavy'?.52:.34),new THREE.MeshStandardMaterial({color:0x30383b,metalness:.65,roughness:.4}));weapon.position.set(0,-.31,.12);c.studio.elbows[1].add(weapon);
 }
 // Old AI colour pulses remain supported by an unobtrusive chest indicator.
 this.eye=oval(c.group,infected?0x665d47:0x888d8c,.08,1.35,.126,.009,.009,.006);
 if(type==='zombie'){this.armReach.rotation.x=-.78;this.armHang.rotation.x=-.12}c.group.userData.enemyArt=type;return c.group;
};
const update=Enemy.prototype.update;
Enemy.prototype.update=function(dt){
 const result=update.apply(this,arguments),c=this.visualChar;if(!c||this.state==='dead')return result;
 c.baseY=this.position.y;shAnimateCharacter(c,Math.min(dt||0,.1),this.state==='patrol'||this.state==='alert',performance.now()/1000);
 c.group.position.copy(this.position); // A visual gait must never change collision-ground height.
 if(this.type==='zombie'){this.armReach.rotation.x=-.78;this.armHang.rotation.x=-.12;c.head.rotation.x=.13}
 if(this.type==='stalker')c.head.rotation.x=.14;
 if(this.type==='howler')c.head.rotation.x=-.16;
 if(this.state==='attack'){c.rightArm.rotation.x=-.8;c.studio.elbows[1].rotation.x=-.5}
 return result;
};
// Cabinets belong to the chunk that owns them. A global flag cannot survive unloading.
const destroy=shDestroyChunk;
window.shDestroyChunk=function(key){const c=State.chunkMap.get(key);if(c&&c.landmark==='arcade'){SHIFT_WORLD.arcadeFitted=false;SH_ARCADE_HOTSPOTS.length=0;ARCADE.cabinets=[]}return destroy.apply(this,arguments)};
const matCache=new Map();
function mat(color,metal=false){const k=color+':'+metal;if(!matCache.has(k))matCache.set(k,new THREE.MeshStandardMaterial({color,roughness:metal?.42:.78,metalness:metal?.55:.04}));return matCache.get(k)}
function box(g,w,h,d,x,y,z,color,metal=false){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,metal));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m}
function sign(g,title,sub,color,w,h,x,y,z){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:shSignTexture(title,sub,color,'#10171d')}));m.position.set(x,y,z);g.add(m);return m}
const screenCache=new Map();
function screenArt(game){
 if(screenCache.has(game.slug))return screenCache.get(game.slug);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=384;const c=canvas.getContext('2d'),accent='#'+game.color.toString(16).padStart(6,'0');
 c.fillStyle='#080f19';c.fillRect(0,0,512,384);
 const gradient=c.createLinearGradient(0,0,0,300);gradient.addColorStop(0,'#172c48');gradient.addColorStop(1,'#050910');c.fillStyle=gradient;c.fillRect(0,0,512,300);
 if(game.slug==='palm-drive'){
  c.fillStyle='#b08875';c.beginPath();c.moveTo(0,140);c.lineTo(512,140);c.lineTo(512,180);c.lineTo(0,180);c.fill();
  c.fillStyle='#333949';c.beginPath();c.moveTo(225,140);c.lineTo(290,140);c.lineTo(480,310);c.lineTo(35,310);c.fill();
  c.strokeStyle='#e3c57f';c.lineWidth=4;for(let i=0;i<4;i++){let y=165+i*35;c.beginPath();c.moveTo(256,y);c.lineTo(256,y+18);c.stroke()}
  c.fillStyle=accent;c.fillRect(214,234,86,40);c.fillStyle='#c2d1d9';c.fillRect(225,222,64,24);c.fillStyle='#202730';c.fillRect(212,265,18,18);c.fillRect(285,265,18,18);
 }else{
  for(let i=0;i<12;i++){c.fillStyle=i%2?'#223744':'#31434e';c.fillRect(i*45,95+(i%3)*20,32,205)}
  c.fillStyle=accent;c.beginPath();c.arc(260,173,18,0,Math.PI*2);c.fill();c.fillRect(249,190,22,55);
  c.strokeStyle=accent;c.lineWidth=8;c.beginPath();c.moveTo(252,240);c.lineTo(231,274);c.moveTo(267,240);c.lineTo(286,274);c.stroke();
  if(game.slug==='light-bearer'){const glow=c.createRadialGradient(295,175,0,295,175,65);glow.addColorStop(0,'#f4dc88');glow.addColorStop(1,'transparent');c.fillStyle=glow;c.fillRect(220,100,150,150)}
 }
 c.textAlign='center';c.fillStyle='#ecede7';c.font='bold 27px sans-serif';c.fillText(game.title,256,45,475);c.font='15px sans-serif';c.fillStyle=accent;c.fillText(game.sub,256,70,475);
 c.fillStyle='#080d13';c.fillRect(0,308,512,76);c.fillStyle='#efdfad';c.font='bold 19px monospace';c.fillText('PRESS E TO PLAY',256,338);c.fillStyle='#9eacb5';c.font='12px monospace';c.fillText('PRESENT PALM  /  FREE PLAY',256,363);
 const tex=new THREE.CanvasTexture(canvas);tex.minFilter=THREE.LinearFilter;screenCache.set(game.slug,tex);
 if(window.FCArcadePreviews&&FCArcadePreviews[game.slug]){const image=new Image();image.onload=()=>{c.drawImage(image,0,0,512,384);c.fillStyle='#080d13';c.fillRect(0,354,512,30);c.fillStyle='#efdfad';c.font='bold 16px monospace';c.textAlign='center';c.fillText('PRESS E TO PLAY  /  FREE PLAY',256,375);tex.needsUpdate=true};image.src=FCArcadePreviews[game.slug]}
 return tex;
}
window.shFitArcade=function(chunk){
 if(!SHIFT_WORLD.arcade||!chunk||chunk.userDataArcade)return;
 const room=new THREE.Group();room.name='Present Palm arcade';room.userData.arcade=true;chunk.group.add(room);chunk.userDataArcade=room;SHIFT_WORLD.arcadeFitted=true;
 const y=SHIFT_WORLD.arcade.floor;
 box(room,11.8,.045,11.8,36,y+.026,-12,0x242b38);
 for(let z=-17;z<-7;z+=1.2)box(room,10,.006,.018,36,y+.052,z,0x53606b);
 for(const z of [-16.8,-7.2])box(room,10,.09,.16,36,6.7,z,0xc1b696);
 const light=new THREE.PointLight(0xdbe4ed,2.8,18);light.position.set(35,6.1,-12);room.add(light);chunk.lights.push(light);
 const warm=new THREE.PointLight(0xffd6a2,1.5,10);warm.position.set(30.8,5.3,-12);room.add(warm);chunk.lights.push(warm);
 const slots=[{x:32.4,z:-16.6,rot:0},{x:34.6,z:-16.6,rot:0},{x:36.8,z:-16.6,rot:0},{x:32.4,z:-7.4,rot:Math.PI},{x:34.6,z:-7.4,rot:Math.PI},{x:36.8,z:-7.4,rot:Math.PI},{x:40.6,z:-16,rot:-Math.PI/2},{x:40.6,z:-12.8,rot:-Math.PI/2},{x:40.6,z:-9.6,rot:-Math.PI/2}];
 SH_ARCADE_HOTSPOTS.length=0;ARCADE.cabinets=[];
 const roster=(SHIFT_WORLD.arcadeRoster||ARCADE_ROSTER).slice(0,slots.length);
 roster.forEach((game,i)=>{
  const s=slots[i],g=new THREE.Group();g.name=game.title;g.userData.cabinet=game.slug;g.position.set(s.x,y+.06,s.z);g.rotation.y=s.rot;room.add(g);
  const profile=new THREE.Shape();[[.45,0],[-.45,0],[-.59,.98],[-.59,1.13],[-.30,1.22],[-.34,1.90],[-.46,1.94],[-.46,2.2],[.45,2.2]].forEach(([x,y],i)=>i?profile.lineTo(x,y):profile.moveTo(x,y));profile.closePath();
  const geo=new THREE.ExtrudeGeometry(profile,{depth:1.06,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:2,steps:1});geo.rotateY(Math.PI/2);geo.translate(-.53,0,0);
  const hull=new THREE.Mesh(geo,mat(0x202833));hull.castShadow=true;g.add(hull);
  for(const x of [-.535,.535])box(g,.027,2.13,.78,x,1.1,-.02,game.color);
  box(g,.93,.67,.06,0,1.57,.343,0x080c10);const screen=new THREE.Mesh(new THREE.PlaneGeometry(.84,.61),new THREE.MeshBasicMaterial({map:screenArt(game)}));screen.position.set(0,1.57,.382);screen.rotation.x=-.06;g.add(screen);
  sign(g,game.title,'','#edf0e9',.96,.20,0,2.065,.481);
  const deck=box(g,1.06,.085,.43,0,1.10,.40,0x4c5863,true);deck.rotation.x=-.12;
  box(g,.036,.15,.036,-.29,1.21,.45,0xc0c7ca,true);oval(g,0x9b5145,-.29,1.30,.45,.055,.05,.055);
  for(let j=0;j<4;j++){const b=new THREE.Mesh(new THREE.CylinderGeometry(.034,.038,.023,16),mat(j%2?0xcbaf6d:0x92757b));b.position.set(.05+j*.10,1.17,.46-(j%2)*.09);g.add(b)}
  box(g,.30,.34,.035,0,.59,.501,0x3d454b,true);box(g,.095,.019,.018,0,.65,.524,0x070b0e);sign(g,'FREE PLAY','', '#d5d4c6',.24,.08,0,.51,.525);
  box(g,.8,.12,.032,0,.18,.486,0x0f151b);for(let j=0;j<6;j++)box(g,.003,.08,.008,-.3+j*.12,.18,.505,0x606971);
  const fx=Math.sin(s.rot),fz=Math.cos(s.rot);SH_ARCADE_HOTSPOTS.push({id:'cab:'+game.slug,x:s.x+fx*1.3,z:s.z+fz*1.3,r:1.05,label:game.title,verb:'PLAY'});ARCADE.cabinets.push(game);
  const side=Math.abs(fx)>.5;chunk.collisionAABBs.push({minX:s.x-(side?.65:.58),maxX:s.x+(side?.65:.58),minZ:s.z-(side?.58:.65),maxZ:s.z+(side?.58:.65),maxY:y+2.3});
 });
 box(room,1.0,1.02,.7,30.9,y+.51,-16.4,0x39444e);sign(room,'CHANGE','FREE PLAY','#e2c489',.9,.32,30.9,y+1.35,-15.99);
 const banner=sign(room,'THE ARCADE','PRESENT PALM  /  WALK UP TO A MACHINE','#ded8bb',7.5,1.05,41.35,6.7,-12);banner.rotation.y=-Math.PI/2;
 const entrance=sign(room,'THE ARCADE','NINE CABINETS  /  FREE PLAY','#e6d9aa',8,1.4,28.96,6.5,-12);entrance.rotation.y=-Math.PI/2;
};
})();
