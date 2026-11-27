/* Newsman Ned: a streamed, walk-in neon arcade beside Common Ground. */
(function(){'use strict';
//  x, z: cabinet centre. face: the way the screen looks (radians, 0 = +z).
//  0.85: three cabinets moved off the court's walks: Oh No Ned 4 m east (x 177 walk),
//  Bad Weather 2 m west (x 167 walk), Toilet Heads 3 m south (z 27 east approach).
const GAMES=[
 ['palm-drive','PALM DRIVE','NEON RACING',0xff60d0,'news'],
 ['breaking-ned','BREAKING NED','ONE-TAP FLIGHT',0xff6855,'news'],
 ['toilet-heads','TOILET HEADS HD','ENDLESS JUMPER',0x5fd3ff,'bounce'],
 ['oh-no-ned','OH NO NED','SLINGSHOT CHAOS',0xc6ef63,'sling'],
 ['chainfire','CHAINFIRE','CHAIN REACTIONS',0xffc94a,'storm'],
 ['outgrow','OUTGROW','GROW OR GET EATEN',0x3dffb0,'grow'],
 ['wrong-floor','WRONG FLOOR','ENDLESS ELEVATOR',0xd7ff62,'bounce'],
 ['bad-weather','BAD WEATHER','BUILD / SURVIVE',0xffb347,'storm'],
 ['still-human','STILL HUMAN','ROUND SURVIVAL',0x66ffcc,'grow'],
 ['coherence-game','COHERENCE','DARK PLATFORMER',0xffd47a,'mirror'],
 ['light-bearer','THE LIGHT BEARER','CHAPTER ONE',0xffeac0,'mirror'],
 ['fractured-mirror','FRACTURED MIRROR','DRAW / REFLECT',0xb98cff,'mirror']
].map(([slug,title,sub,color,art],i)=>({slug,title,sub,color,art,
 x:i<5?196:i<10?211:200+(i-10)*7,
 z:i<10?5+(i%5)*3.2:3.2,
 face:i<5?Math.PI/2:i<10?-Math.PI/2:0}));
const HALL={key:'8,0',x0:194,x1:213,z0:1,z1:22,floor:1,ceiling:9};
const Y=1,REACH=2.3,hex=c=>'#'+c.toString(16).padStart(6,'0');
for(const g of GAMES){g.fx=Math.sin(g.face);g.fz=Math.cos(g.face);g.key=chunkCoordOf(g.x)+','+chunkCoordOf(g.z);g.name='campus-arcade-'+g.slug}

function arcadeSign(title,sub,fg,bg,w,h){
 const cv=document.createElement('canvas');cv.width=1536;cv.height=Math.round(1536*h/w);const c=cv.getContext('2d');
 c.fillStyle=bg;c.fillRect(0,0,cv.width,cv.height);c.fillStyle=fg;c.textAlign='center';
 c.font='900 '+Math.round(cv.height*.47)+'px sans-serif';c.fillText(title,768,cv.height*.54,1450);
 c.font='600 '+Math.round(cv.height*.15)+'px sans-serif';c.fillText(sub,768,cv.height*.83,1400);
 const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;
 return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex}));
}
function screenArt(g){
 const cv=document.createElement('canvas');cv.width=512;cv.height=384;const c=cv.getContext('2d'),col=hex(g.color);
 const bg=c.createLinearGradient(0,0,0,384);bg.addColorStop(0,'#0d0b1f');bg.addColorStop(1,'#1b1433');c.fillStyle=bg;c.fillRect(0,0,512,384);
 c.strokeStyle=col;c.fillStyle=col;c.lineWidth=5;
 if(g.art==='bounce'){for(let i=0;i<6;i++){const x=70+i*75,y=300-(i%3)*55;c.fillRect(x-26,y,52,10);c.beginPath();c.arc(x,y-30-(i%2)*30,14,0,7);c.fill()}c.fillStyle='#ffd54a';for(let i=0;i<4;i++){c.beginPath();c.arc(110+i*100,120+(i%2)*30,8,0,7);c.fill()}}
 if(g.art==='mirror'){c.setLineDash([6,8]);c.beginPath();c.moveTo(256,70);c.lineTo(256,330);c.stroke();c.setLineDash([]);for(const s of [-1,1]){c.beginPath();for(let t=0;t<=6.3;t+=.1){const x=256+s*(70+45*Math.cos(t)),y=200+60*Math.sin(2*t);t?c.lineTo(x,y):c.moveTo(x,y)}c.stroke()}}
 if(g.art==='news'){c.fillRect(40,70,432,46);c.fillStyle='#0d0b1f';c.font='bold 34px sans-serif';c.textAlign='center';c.fillText('B R E A K I N G',256,105);c.fillStyle=col;for(let i=0;i<5;i++)c.fillRect(60+i*86,200+(i%2)*40,60,60);c.fillStyle='#ffe6a4';c.beginPath();c.arc(120,175,18,0,7);c.fill()}
 if(g.art==='sling'){c.beginPath();c.moveTo(90,320);c.lineTo(110,230);c.moveTo(130,320);c.lineTo(110,230);c.stroke();c.beginPath();c.arc(110,225,16,0,7);c.fill();for(let i=0;i<6;i++)c.strokeRect(300+(i%3)*50,330-Math.floor(i/3)*55-55,46,52);c.setLineDash([4,10]);c.beginPath();c.moveTo(125,215);c.quadraticCurveTo(230,90,320,200);c.stroke();c.setLineDash([])}
 if(g.art==='storm'){for(let i=0;i<5;i++){const x=70+i*86,h=40+(i*37)%70;c.fillRect(x,330-h,56,h);c.beginPath();c.moveTo(x-6,330-h);c.lineTo(x+28,300-h);c.lineTo(x+62,330-h);c.fill()}c.fillStyle='#d8dcf0';for(const [x,y] of [[150,110],[330,95]]){c.beginPath();c.arc(x,y,34,0,7);c.arc(x+40,y+8,28,0,7);c.arc(x-38,y+10,24,0,7);c.fill()}c.strokeStyle='#fff6a0';c.beginPath();c.moveTo(250,120);c.lineTo(225,175);c.lineTo(255,175);c.lineTo(228,235);c.stroke()}
 if(g.art==='grow'){const blob=(x,y,r,col)=>{c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,7);c.fill();c.fillStyle='#0d0b1f';c.beginPath();c.arc(x+r*.3,y-r*.2,r*.16,0,7);c.fill()};blob(150,230,34,'#3dffb0');blob(330,210,70,'#ff3d8b');for(let i=0;i<7;i++)blob(60+i*64,320,6+i*1.5,'#ffd54a');c.strokeStyle='#f4f1ff';c.setLineDash([6,8]);c.beginPath();c.arc(330,210,86,0,7);c.stroke();c.setLineDash([])}
 c.fillStyle='#f4f1ff';c.textAlign='center';c.font='bold '+(g.title.length>13?30:36)+'px sans-serif';c.fillText(g.title,256,48);c.font='18px sans-serif';c.fillText('FREE PLAY · PRESS E',256,362);
 const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;return tex;
}

// One chunk owns the hall, its fixtures and collisions. No per-cabinet lights,
// videos or animation loops: previews are static textures until a game opens.
function buildHall(chunk){
 const root=new THREE.Group();root.name='newsman-ned-arcade';chunk.group.add(root);
 const batches=new Map(),materials={
 stone:new THREE.MeshStandardMaterial({color:0x35304b,emissive:0x35304b,emissiveIntensity:.3,roughness:.7}),
 black:new THREE.MeshStandardMaterial({color:0x18283b,emissive:0x18283b,emissiveIntensity:.25,roughness:.35,metalness:.45}),
 brass:new THREE.MeshStandardMaterial({color:0xbf9369,roughness:.35,metalness:.65}),
 pink:new THREE.MeshBasicMaterial({color:0xff4ea6}),
 blue:new THREE.MeshBasicMaterial({color:0x5de8ec}),
 cream:new THREE.MeshBasicMaterial({color:0xffe5b4})};
 const box=(x,y,z,w,h,d,key='stone',solid=false)=>{
  if(!batches.has(key))batches.set(key,[]);batches.get(key).push([x,y,z,w,h,d]);
  if(solid)chunk.collisionAABBs.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:y-h/2,maxY:y+h/2});
 };
 const sign=(x,y,z,title,sub,w,h,face=0)=>{const m=arcadeSign(title,sub,'#fff2d6','#131525',w,h);m.position.set(x,y,z);m.rotation.y=face;root.add(m)};
 // Flush floor, a six-metre door and an unbroken circulation spine.
 box(203.5,1.018,11.5,19,.036,21,'black');
 box(194.25,5,11.5,.5,8,21,'stone',true);box(212.75,5,11.5,.5,8,21,'stone',true);
 box(203.5,5,1.25,19,8,.5,'stone',true);
 for(const x of [197,210])box(x,3.1,21.75,6,4.2,.5,'stone',true);
 box(203.5,7,21.75,19,4,.5,'stone',true);
 box(203.5,9.2,11.5,20,.4,22,'stone',true);
 // Ribbed entrance arch and warm brass reveals.
 for(const x of [200,207]){box(x,3.7,22,.18,5.4,.8,'brass');box(x+(x<203? .14:-.14),3.7,22.42,.055,5.4,.055,'pink')}
 box(203.5,6.35,22,7.2,.18,.8,'brass');box(203.5,6.23,22.42,7,.055,.055,'pink');
 sign(203.5,7.65,22.03,'NEWSMAN NED','A R C A D E   /   F R E E   P L A Y',16,1.8);
 sign(203.5,4.5,1.54,'ONE MORE TRY.','12 WORLDS / ZERO COINS',10,1.4);
 for(const x of [194.55,212.45]){box(x,1.14,11.5,.06,.1,20,'blue');box(x,8.45,11.5,.06,.12,20,'pink')}
 // Graphic terrazzo bands and an intentionally clear 5 m central aisle.
 for(let z=3;z<22;z+=1.4){box(203.5,1.043,z,5,.012,.035,'brass');for(const x of [198,209])box(x,1.044,z,.12,.014,.4,'pink')}
 for(const x of [200.2,206.8])box(x,1.045,12,.045,.015,19,'blue');
 // Folded, suspended ceiling fins: architectural rhythm without moving lights.
 for(let z=4;z<22;z+=2.8){box(203.5,8.55,z,17,.24,.5,'black');box(203.5,8.38,z,15,.06,.08,z%2<1?'blue':'pink');
  for(const x of [198.5,208.5])box(x,7.9,z,.06,1.2,.06,'brass');}
 // Back-wall broadcast sun: an oversized graphic sculpture, not a point light.
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.35,.085,8,64),materials.pink);ring.position.set(203.5,6.8,1.7);root.add(ring);
 for(let i=0;i<12;i++){const t=i*Math.PI/6;box(203.5+Math.cos(t)*1.7,6.8+Math.sin(t)*1.7,1.65,.13,.13,.09,'cream')}
 // Fluted exterior cheeks and side panels create depth even in daylight.
 for(const x of [197,210])for(let j=-2;j<=2;j++)box(x+j*.72,3,22.06,.1,3.3,.18,'brass');
 sign(197,3,22.19,'PLAY','WALK IN',4,1.25);sign(210,3,22.19,'NED’S','GOOD NEWS / BAD SCORES',4,1.25);
 for(const x of [194.56,212.44])for(let z=4;z<21;z+=3.2){
  box(x,4.9,z,.08,2.7,2.8,'black');
  for(let i=0;i<5;i++)box(x+(x<200?.06:-.06),4.1+i*.37,z-.8+i*.4,.04,.12,1.1,i%2?'pink':'blue');
 }
 const pose=new THREE.Object3D();
 for(const [key,rows]of batches){const m=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),materials[key],rows.length);rows.forEach((r,i)=>{pose.position.set(...r.slice(0,3));pose.scale.set(...r.slice(3));pose.updateMatrix();m.setMatrixAt(i,pose.matrix)});m.instanceMatrix.needsUpdate=true;root.add(m)}
 for(const g of GAMES)build(chunk,g);
}
function build(chunk,g){
 const root=new THREE.Group();root.name=g.name;root.position.set(g.x,Y,g.z);root.rotation.y=g.face;chunk.group.add(root);
 const dark=new THREE.MeshStandardMaterial({color:0x152031,emissive:0x152031,emissiveIntensity:.25,roughness:.32,metalness:.5}),trim=new THREE.MeshStandardMaterial({color:g.color,roughness:.4,metalness:.3}),glow=new THREE.MeshBasicMaterial({color:g.color});
 const parts=new Map();const box=(w,h,d,x,y,z,m=dark)=>{if(!parts.has(m))parts.set(m,[]);parts.get(m).push([x,y,z,w,h,d])};
 box(1.8,.18,1.5,0,.09,0);box(1.45,1.1,1.1,0,.7,-.08);box(1.65,1.4,.65,0,1.95,-.24);box(1.85,.36,.9,0,2.8,-.12);
 for(const x of [-.84,.84]){box(.12,2.65,1.2,x,1.42,-.08);box(.035,2.5,.035,x,1.48,.54,glow);box(.14,.1,1.32,x,.22,0,glow)}
 const tex=screenArt(g),screenMat=new THREE.MeshBasicMaterial({map:tex});
 const preview=window.FCArcadePreviews?.[g.slug];if(preview){const im=new Image();im.onload=()=>{const c=tex.image.getContext('2d');c.drawImage(im,0,0,512,384);tex.needsUpdate=true};im.src=preview;}
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.43,1.08),screenMat);screen.position.set(0,2,.095);root.add(screen);
 const sign=arcadeSign(g.title,g.sub,'#f4f1ff',hex(g.color),1.65,.29);sign.position.set(0,2.8,.34);root.add(sign);
 box(1.7,.12,.78,0,1.23,.32,trim);box(.04,.19,.04,-.4,1.38,.48,dark);
 const stick=new THREE.Mesh(new THREE.SphereGeometry(.085,8,6),glow);stick.position.set(-.4,1.5,.48);root.add(stick);
 for(const x of [.16,.34,.52]){const b=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.045,8),glow);b.position.set(x,1.32,.5);root.add(b)}
 for(let j=0;j<4;j++)box(.52,.025,.015,0,.74+j*.08,.48,trim);
 box(.36,.2,.04,0,.42,.49);box(.16,.025,.015,0,.46,.52,glow);
 const pose=new THREE.Object3D();for(const [mat,rows]of parts){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,rows.length);rows.forEach((r,i)=>{pose.position.set(...r.slice(0,3));pose.scale.set(...r.slice(3));pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix)});mesh.instanceMatrix.needsUpdate=true;root.add(mesh)}
 chunk.collisionAABBs.push({minX:g.x-.94,maxX:g.x+.94,minZ:g.z-.94,maxZ:g.z+.94,minY:Y,maxY:Y+3});
}
const district=window.districtAtPosition;window.districtAtPosition=function(x,z){return window.OwnBlock?.state.enabled&&chunkCoordOf(x)+','+chunkCoordOf(z)===HALL.key?{...DISTRICTS.RESIDENTIAL,name:'NEWSMAN NED ARCADE',wild:false,biome:null}:district(x,z)};
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){
 if(this.key!==HALL.key||!window.OwnBlock?.state.enabled)return generate.apply(this,arguments);
 // Reserve the formerly procedural east block before saved edits are applied.
 this._maker=true;this.__cityFitted=1;this.landmark='makers';
 this.stampBox(this.originX,0,this.originZ,this.originX+24,1,this.originZ+24,133);
 buildHall(this);
};
function free(){return !State.ui.paused&&!State.ui.inArcade&&!State.ui.inDialogue&&!State.ui.construct}
function nearest(){if(!free())return null;let best=null,bd=REACH;for(const g of GAMES){if(!State.chunkMap.get(g.key)?.group?.getObjectByName(g.name))continue;const d=Math.hypot(Player.position.x-(g.x+g.fx*1.1),Player.position.z-(g.z+g.fz*1.1));if(d<bd&&Math.abs(Player.position.y-Player.height-Y)<1.4){bd=d;best=g}}return best}
function play(g=nearest()){if(!g)return false;State.keys.clear();shStopMine();
 //  shPlayCabinet looks the game up in the active roster; lend it this one
 //  game for the call so the arcade building's roster is never changed.
 const had=Object.prototype.hasOwnProperty.call(SHIFT_WORLD,'arcadeRoster'),prev=SHIFT_WORLD.arcadeRoster;
 SHIFT_WORLD.arcadeRoster=[g];try{shPlayCabinet(g.slug)}finally{if(had)SHIFT_WORLD.arcadeRoster=prev;else delete SHIFT_WORLD.arcadeRoster}
 return true}
window.addEventListener('keydown',e=>{if(e.code==='KeyE'&&!e.repeat&&nearest()){e.preventDefault();e.stopImmediatePropagation();play()}},true);
const interact=handleInteract;window.handleInteract=function(){return play()||interact.apply(this,arguments)};
const prompt=document.createElement('button');prompt.id='campus-arcade-play';prompt.hidden=true;prompt.onclick=()=>play();document.body.append(prompt);
const style=document.createElement('style');style.textContent='#campus-arcade-play{position:fixed;bottom:112px;left:50%;transform:translateX(-50%);z-index:100;background:#172936;color:#ffe6a4;border:1px solid #c99c51;border-radius:10px;padding:14px 20px;font:600 14px system-ui;min-height:48px;cursor:pointer}#campus-arcade-play[hidden]{display:none}';document.head.append(style);
let last=0;function tick(t){requestAnimationFrame(tick);if(t-last<150)return;last=t;const g=nearest();prompt.hidden=!g;if(g){const label='E · Play '+g.title.replace(/\b(\w)(\w*)/g,(m,a,b)=>a+b.toLowerCase()).replace(/\bHd\b/,'HD');if(prompt.textContent!==label)prompt.textContent=label;prompt.style.borderColor=hex(g.color)}}requestAnimationFrame(tick);
window.FCCampusArcades={games:GAMES,nearest,play,hall:HALL};
})();
