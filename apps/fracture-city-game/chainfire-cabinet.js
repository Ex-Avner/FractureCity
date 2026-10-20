/* Dedicated Common Ground cabinet; chunk-owned geometry and collision survive streaming. */
(function(){'use strict';
const X=187,Z=30,Y=1,game=ARCADE_ROSTER.find(g=>g.slug==='chainfire');
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){const result=generate.apply(this,arguments);if(this.key!=='7,1'||this.landmark!=='makers')return result;
 const g=new THREE.Group();g.name='common-ground-chainfire';g.position.set(X,Y,Z);g.rotation.y=Math.PI;this.group.add(g);
 const dark=new THREE.MeshStandardMaterial({color:0x202b38,roughness:.5,metalness:.4}),trim=new THREE.MeshStandardMaterial({color:0xe1ac4b,roughness:.4,metalness:.5}),glow=new THREE.MeshBasicMaterial({color:0x7ee9ed});
 const box=(w,h,d,x,y,z,m=dark)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);g.add(mesh);return mesh};
 box(1.45,.16,1.25,0,.08,0);box(1.2,1.15,.85,0,.72,0);box(1.22,1.05,.6,0,1.73,-.13);box(1.35,.3,.85,0,2.35,0);
 for(const x of [-.63,.63]){box(.07,2.35,.82,x,1.25,0,trim);box(.025,1.85,.025,x,1.3,.43,glow)}
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=384;const c=canvas.getContext('2d');c.fillStyle='#0d0b1f';c.fillRect(0,0,512,384);
 for(let i=0;i<15;i++){const x=65+(i*73)%390,y=80+(i*47)%210;c.strokeStyle=i%2?'#ff6b5e':'#4fe0ff';c.lineWidth=4;c.beginPath();c.arc(x,y,12+i%4*5,0,Math.PI*2);c.stroke()}
 c.fillStyle='#ffc94a';c.beginPath();c.arc(256,195,35,0,Math.PI*2);c.fill();c.fillStyle='#f4f1ff';c.textAlign='center';c.font='bold 34px sans-serif';c.fillText('CHAINFIRE',256,48);c.font='18px sans-serif';c.fillText('PULL BACK. LET CHAOS GO.',256,348);
 const tex=new THREE.CanvasTexture(canvas);tex.encoding=THREE.sRGBEncoding;const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.07,.81),new THREE.MeshBasicMaterial({map:tex}));screen.position.set(0,1.74,.185);g.add(screen);
 const sign=shSignPlane('CHAINFIRE','FREE PLAY · DRAG & RELEASE','#ffe6a4','#162936',1.22,.25);sign.position.set(0,2.35,.44);g.add(sign);
 const deck=box(1.28,.1,.6,0,1.18,.37,trim);deck.rotation.x=-.1;box(.04,.19,.04,-.3,1.31,.45,trim);const stick=new THREE.Mesh(new THREE.SphereGeometry(.07,12,8),glow);stick.position.set(-.3,1.43,.45);g.add(stick);
 for(const x of [.13,.32]){const b=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.04,16),glow);b.position.set(x,1.25,.5);g.add(b)}box(.3,.24,.04,0,.65,.45,trim);box(.14,.025,.025,0,.68,.48);
 this.collisionAABBs.push({minX:X-.74,maxX:X+.74,minZ:Z-.72,maxZ:Z+.65,maxY:Y+2.55});return result;
};
function near(){return !!State.chunkMap.get('7,1')?.group?.getObjectByName('common-ground-chainfire')&&Math.hypot(Player.position.x-X,Player.position.z-(Z-1.1))<2.3&&Math.abs(Player.position.y-Player.height-Y)<1.4&&!State.ui.paused&&!State.ui.inArcade&&!State.ui.inDialogue&&!State.ui.construct}
function play(){if(!near())return false;if(SHIFT_WORLD.arcadeRoster&&!SHIFT_WORLD.arcadeRoster.some(g=>g.slug==='chainfire'))SHIFT_WORLD.arcadeRoster.push(game);State.keys.clear();shStopMine();shPlayCabinet('chainfire');return true}
window.addEventListener('keydown',e=>{if(e.code==='KeyE'&&!e.repeat&&near()){e.preventDefault();e.stopImmediatePropagation();play()}},true);
const interact=handleInteract;window.handleInteract=function(){return play()||interact.apply(this,arguments)};
const prompt=document.createElement('button');prompt.id='chainfire-play';prompt.hidden=true;prompt.textContent='E · Play Chainfire';prompt.onclick=play;document.body.append(prompt);const style=document.createElement('style');style.textContent='body.in-arcade #toast-stack{visibility:hidden}#chainfire-play{position:fixed;bottom:112px;left:50%;transform:translateX(-50%);z-index:100;background:#172936;color:#ffe6a4;border:1px solid #c99c51;border-radius:10px;padding:14px 20px;font:600 14px system-ui;min-height:48px;cursor:pointer}#chainfire-play[hidden]{display:none}';document.head.append(style);
let last=0;function tick(t){requestAnimationFrame(tick);if(t-last<150)return;last=t;prompt.hidden=!near()}requestAnimationFrame(tick);
window.ChainfireCabinet={x:X,y:Y,z:Z,near,play};
})();
