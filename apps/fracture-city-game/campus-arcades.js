/* Five stand-alone arcade cabinets spread across the Common Ground campus.
   Chunk-owned geometry and collision, like the Chainfire cabinet, so they
   survive streaming. They launch in the city's arcade frame and are not part
   of the arcade building's roster. */
(function(){'use strict';
//  x, z: cabinet centre. face: the way the screen looks (radians, 0 = +z).
const GAMES=[
 {slug:'toilet-heads',title:'TOILET HEADS HD',sub:'ENDLESS JUMPER',color:0x5fd3ff,x:200.5,z:26.5,face:-Math.PI/2,art:'bounce'},
 {slug:'fractured-mirror',title:'FRACTURED MIRROR',sub:'DRAW. REFLECT. LOOP.',color:0xb98cff,x:210.5,z:38.5,face:-Math.PI/2,art:'mirror'},
 {slug:'breaking-ned',title:'BREAKING NED',sub:'ONE-TAP FLYER',color:0xff5a4d,x:148.5,z:27.5,face:Math.PI/2,art:'news'},
 {slug:'oh-no-ned',title:'OH NO NED',sub:'SLINGSHOT PHYSICS',color:0x9be15d,x:176.5,z:50.5,face:Math.PI,art:'sling'},
 {slug:'bad-weather',title:'BAD WEATHER',sub:'BUILD. THEN BRACE.',color:0xffb347,x:166.5,z:56.5,face:Math.PI,art:'storm'},
];
const Y=1,REACH=2.3,hex=c=>'#'+c.toString(16).padStart(6,'0');
for(const g of GAMES){g.fx=Math.sin(g.face);g.fz=Math.cos(g.face);g.key=chunkCoordOf(g.x)+','+chunkCoordOf(g.z);g.name='campus-arcade-'+g.slug}

function screenArt(g){
 const cv=document.createElement('canvas');cv.width=512;cv.height=384;const c=cv.getContext('2d'),col=hex(g.color);
 const bg=c.createLinearGradient(0,0,0,384);bg.addColorStop(0,'#0d0b1f');bg.addColorStop(1,'#1b1433');c.fillStyle=bg;c.fillRect(0,0,512,384);
 c.strokeStyle=col;c.fillStyle=col;c.lineWidth=5;
 if(g.art==='bounce'){for(let i=0;i<6;i++){const x=70+i*75,y=300-(i%3)*55;c.fillRect(x-26,y,52,10);c.beginPath();c.arc(x,y-30-(i%2)*30,14,0,7);c.fill()}c.fillStyle='#ffd54a';for(let i=0;i<4;i++){c.beginPath();c.arc(110+i*100,120+(i%2)*30,8,0,7);c.fill()}}
 if(g.art==='mirror'){c.setLineDash([6,8]);c.beginPath();c.moveTo(256,70);c.lineTo(256,330);c.stroke();c.setLineDash([]);for(const s of [-1,1]){c.beginPath();for(let t=0;t<=6.3;t+=.1){const x=256+s*(70+45*Math.cos(t)),y=200+60*Math.sin(2*t);t?c.lineTo(x,y):c.moveTo(x,y)}c.stroke()}}
 if(g.art==='news'){c.fillRect(40,70,432,46);c.fillStyle='#0d0b1f';c.font='bold 34px sans-serif';c.textAlign='center';c.fillText('B R E A K I N G',256,105);c.fillStyle=col;for(let i=0;i<5;i++)c.fillRect(60+i*86,200+(i%2)*40,60,60);c.fillStyle='#ffe6a4';c.beginPath();c.arc(120,175,18,0,7);c.fill()}
 if(g.art==='sling'){c.beginPath();c.moveTo(90,320);c.lineTo(110,230);c.moveTo(130,320);c.lineTo(110,230);c.stroke();c.beginPath();c.arc(110,225,16,0,7);c.fill();for(let i=0;i<6;i++)c.strokeRect(300+(i%3)*50,330-Math.floor(i/3)*55-55,46,52);c.setLineDash([4,10]);c.beginPath();c.moveTo(125,215);c.quadraticCurveTo(230,90,320,200);c.stroke();c.setLineDash([])}
 if(g.art==='storm'){for(let i=0;i<5;i++){const x=70+i*86,h=40+(i*37)%70;c.fillRect(x,330-h,56,h);c.beginPath();c.moveTo(x-6,330-h);c.lineTo(x+28,300-h);c.lineTo(x+62,330-h);c.fill()}c.fillStyle='#d8dcf0';for(const [x,y] of [[150,110],[330,95]]){c.beginPath();c.arc(x,y,34,0,7);c.arc(x+40,y+8,28,0,7);c.arc(x-38,y+10,24,0,7);c.fill()}c.strokeStyle='#fff6a0';c.beginPath();c.moveTo(250,120);c.lineTo(225,175);c.lineTo(255,175);c.lineTo(228,235);c.stroke()}
 c.fillStyle='#f4f1ff';c.textAlign='center';c.font='bold '+(g.title.length>13?30:36)+'px sans-serif';c.fillText(g.title,256,48);c.font='18px sans-serif';c.fillText('FREE PLAY · PRESS E',256,362);
 const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;return tex;
}

function build(chunk,g){
 const root=new THREE.Group();root.name=g.name;root.position.set(g.x,Y,g.z);root.rotation.y=g.face;chunk.group.add(root);
 const dark=new THREE.MeshStandardMaterial({color:0x1d2633,roughness:.5,metalness:.4}),trim=new THREE.MeshStandardMaterial({color:g.color,roughness:.4,metalness:.45,emissive:g.color,emissiveIntensity:.08}),glow=new THREE.MeshBasicMaterial({color:g.color});
 const box=(w,h,d,x,y,z,m=dark)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);root.add(mesh);return mesh};
 box(1.45,.16,1.25,0,.08,0);box(1.2,1.15,.85,0,.72,0);box(1.22,1.05,.6,0,1.73,-.13);box(1.35,.3,.85,0,2.35,0);
 for(const x of [-.63,.63]){box(.07,2.35,.82,x,1.25,0,trim);box(.025,1.85,.025,x,1.3,.43,glow)}
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.07,.81),new THREE.MeshBasicMaterial({map:screenArt(g)}));screen.position.set(0,1.74,.185);root.add(screen);
 const sign=shSignPlane(g.title,'FREE PLAY · '+g.sub,'#f4f1ff',hex(g.color).replace(/^#(..)(..)(..)$/,(m,r,gg,b)=>'#'+[r,gg,b].map(v=>Math.round(parseInt(v,16)*.22).toString(16).padStart(2,'0')).join('')),1.22,.25);sign.position.set(0,2.35,.44);root.add(sign);
 const deck=box(1.28,.1,.6,0,1.18,.37,trim);deck.rotation.x=-.1;box(.04,.19,.04,-.3,1.31,.45,trim);
 const stick=new THREE.Mesh(new THREE.SphereGeometry(.07,12,8),glow);stick.position.set(-.3,1.43,.45);root.add(stick);
 for(const x of [.13,.32]){const b=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.04,16),glow);b.position.set(x,1.25,.5);root.add(b)}
 box(.3,.24,.04,0,.65,.45,trim);
 chunk.collisionAABBs.push({minX:g.x-.76,maxX:g.x+.76,minZ:g.z-.76,maxZ:g.z+.76,maxY:Y+2.55});
}

const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){const result=generate.apply(this,arguments);if(this.landmark==='makers')for(const g of GAMES)if(g.key===this.key)build(this,g);return result};

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
window.FCCampusArcades={games:GAMES,nearest,play};
})();
