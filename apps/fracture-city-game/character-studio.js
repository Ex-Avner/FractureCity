/* Resident studio: a shared articulated cast, live fitting room, and shoulder camera. */
(function(){
'use strict';
const defaults={jaw:.95,nose:1,shoulders:1,faceWidth:1,faceLength:1,eyes:'#69776d',outfit:'bomber',tattoos:'none',piercings:'none'};
Object.assign(SH_DEFAULT_AVATAR,defaults);
Object.keys(defaults).forEach(k=>{if(Shift.avatar[k]===undefined)Shift.avatar[k]=defaults[k]});
const cloth=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:.02});
const sphere=new THREE.SphereGeometry(1,12,8), cube=new THREE.BoxGeometry(1,1,1);
const dark=0x171d25;
let figureConfig=null;
const faceCache=new Map();
function loft(rows,segments=24,face=false){
 const p=[],ix=[];
 for(const [y,rx,rz,cz=0] of rows)for(let j=0;j<=segments;j++){
  const a=j/segments*Math.PI*2,x=Math.sin(a)*rx;let z=Math.cos(a)*rz+cz;
  if(face&&Math.cos(a)>0){
   const g=(cx,cy,sx,sy)=>Math.exp(-Math.pow((x-cx)/sx,2)-Math.pow((y-cy)/sy,2));
   z+=Math.pow(Math.cos(a),6)*(.025*g(0,.024,.019,.044)+.010*g(0,.002,.025,.015)+.005*g(0,-.042,.034,.019));
  }
  p.push(x,y,z);
 }
 for(let i=0;i<rows.length-1;i++)for(let j=0;j<segments;j++){let a=i*(segments+1)+j,b=a+segments+1;ix.push(a,a+1,b,b,a+1,b+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();
 const n=g.attributes.normal;for(let i=0;i<rows.length;i++){const a=i*(segments+1),b=a+segments;const x=(n.getX(a)+n.getX(b))*.5,y=(n.getY(a)+n.getY(b))*.5,z=(n.getZ(a)+n.getZ(b))*.5;n.setXYZ(a,x,y,z);n.setXYZ(b,x,y,z)}return g;
}
function shade(c,n){return new THREE.Color(c).multiplyScalar(n).getHex()}
// Each bone is one baked mesh, keeping a detailed crowd affordable.
function bake(bone,parts){
 const pos=[],norm=[],col=[],indices=[];
 for(const p of parts){
  const geo=p.geo.clone();const offset=pos.length/3;geo.scale(...p.s);geo.rotateZ(p.r||0);geo.translate(...p.p);
  const a=geo.attributes.position.array,n=geo.attributes.normal.array,c=new THREE.Color(p.c);
  const index=geo.index;if(index){for(const v of index.array)indices.push(v+offset)}else{for(let i=0;i<a.length/3;i++)indices.push(i+offset)}
  for(let i=0;i<a.length;i+=3){pos.push(a[i],a[i+1],a[i+2]);norm.push(n[i],n[i+1],n[i+2]);const lip=p.face&&Math.abs(a[i])<.027&&a[i+1]>-.029&&a[i+1]<-.01&&a[i+2]>.102;
   col.push(c.r*(lip?.84:1),c.g*(lip?.69:1),c.b*(lip?.72:1))}geo.dispose();
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 g.setIndex(indices);const m=new THREE.Mesh(g,cloth);m.castShadow=true;m.receiveShadow=true;m.userData.residentGeometry=true;bone.add(m);
}
function dispose(c){if(c)c.group.traverse(o=>{if(o.isMesh&&o.geometry&&!o.userData.sharedEquipment)o.geometry.dispose()})}
//  The figure itself is built by wardrobe.js (stylised punk cast). This file
//  keeps the fitting-room preview, the mirror and the shoulder camera.
const mirror=shRebuildMirror;
window.shRebuildMirror=function(){const old=SHIFT_WORLD.mirror;const result=mirror.apply(this,arguments);if(old&&old!==SHIFT_WORLD.mirror)dispose(old);return result};
const css=document.createElement('style');css.textContent=`#resident-preview{position:sticky;top:0;background:radial-gradient(ellipse at 50% 35%,#394455,#141c28 75%);border:1px solid #526071;border-radius:16px;overflow:hidden}#resident-preview canvas{width:100%;height:560px;display:block;touch-action:none;cursor:grab}#resident-preview p{font:10px/1.5 sans-serif;text-align:center;color:#c3ccd7;padding:8px}#resident-portrait{display:block;margin:auto;background:#293646;color:#fff;border:1px solid #647384;border-radius:20px;padding:8px 12px}.resident-extra{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}.resident-extra fieldset{grid-column:span 3}.resident-extra input{width:100%}#resident-view-toggle{position:fixed;right:18px;bottom:108px;z-index:35;border:1px solid #667484;border-radius:18px;background:#182332df;color:#ecedef;padding:9px 13px;font:11px sans-serif}@media(max-width:600px){#resident-preview canvas{height:270px}.resident-extra{grid-template-columns:1fr}.resident-extra fieldset{grid-column:1}}`;document.head.appendChild(css);
let preview=null,body=null,bodySignature='',lastTime=performance.now();
function clearPreview(){if(!preview)return;dispose(preview.char);preview.renderer.dispose();preview.renderer.forceContextLoss();preview=null}
function updatePreview(){
 const canvas=document.querySelector('#resident-preview canvas');
 if(!canvas){clearPreview();return}
 if(!preview||preview.canvas!==canvas){clearPreview();const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.05,20);scene.add(new THREE.HemisphereLight(0xe8efff,0x49505b,1.2));
 const key=new THREE.DirectionalLight(0xffe6d0,2.1);key.position.set(-3,5,4);scene.add(key);const fill=new THREE.DirectionalLight(0xa9c9ff,1.4);fill.position.set(3,3,-2);scene.add(fill);
 preview={canvas,renderer,scene,camera,yaw:.2,portrait:false,signature:''};let drag=null;
 canvas.onpointerdown=e=>{drag=e.clientX;canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(drag!==null){preview.yaw+=(e.clientX-drag)*.015;drag=e.clientX}};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
 document.getElementById('resident-portrait').onclick=()=>preview.portrait=!preview.portrait;
 }
 const p=preview,sig=JSON.stringify(Shift.avatar);if(p.signature!==sig){if(p.char){p.scene.remove(p.char.group);dispose(p.char)}p.char=shBuildFigure({...Shift.avatar,auraChance:0},'studio');p.char.plate.visible=false;p.scene.add(p.char.group);p.signature=sig;shAnimateCharacter(p.char,0,false,0)}
 const w=canvas.clientWidth||200,h=canvas.clientHeight||390;p.renderer.setSize(w,h,false);p.camera.aspect=w/h;p.camera.updateProjectionMatrix();
 const tall=p.char.studio.height;p.camera.position.set(0,p.portrait?tall-.12:1.05,p.portrait?1.02:3.8);p.camera.lookAt(0,p.portrait?tall-.14:tall*.51,0);p.char.group.rotation.y=p.yaw;p.renderer.render(p.scene,p.camera);
}
let third=false;try{third=localStorage.getItem('fc-third-person')==='true'}catch(e){}
function setView(value){third=!!value;try{localStorage.setItem('fc-third-person',String(third))}catch(e){}if(button)button.textContent=third?'V · Third person':'V · First person'}
let button;
function cameraFrame(){
 if(!State.scene||!State.camera||!Player.position)return;
 if(button)button.hidden=!!(State.ui.inIntro||State.ui.inShiftPanel||State.ui.inDialogue||State.ui.paused);
 if(!third||Player.mode==='drive'||State.ui.inIntro||(typeof Trans!=='undefined'&&Trans.active)){if(body)body.group.visible=false;return}
 const sig=JSON.stringify(Shift.avatar);
 if(!body||bodySignature!==sig||body.group.parent!==State.scene){if(body){body.group.removeFromParent?body.group.removeFromParent():body.group.parent&&body.group.parent.remove(body.group);dispose(body)}body=shBuildFigure({...Shift.avatar,prop:'none',auraChance:0},'resident');body.plate.visible=false;bodySignature=sig;State.scene.add(body.group)}
 const now=performance.now(),dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;
 body.group.position.copy(Player.position);body.baseY=Player.position.y-Player.height;body.group.position.y=body.baseY;body.group.rotation.y=Player.yaw+Math.PI;
 if(!State.ui.paused&&!State.ui.inDialogue&&!State.ui.inShiftPanel)shAnimateCharacter(body,dt,['w','a','s','d'].some(k=>State.keys.has(k)),now/1000);
 const cam=State.camera,origin=Player.position.clone(),dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(Player.pitch,Player.yaw,0,'YXZ'));
 // Collinear camera keeps the reticle and existing eye-origin combat rays aligned.
 const desired=origin.clone().addScaledVector(dir,-3.4),delta=desired.clone().sub(origin);let fraction=1;
 for(let t=.06;t<=1;t+=.025){const p=origin.clone().addScaledVector(delta,t);let hit=false;for(const x of [-.16,.16])for(const y of [-.16,.16])for(const z of [-.16,.16])if(isSolid(getBlock(Math.floor(p.x+x),Math.floor(p.y+y),Math.floor(p.z+z))))hit=true;if(hit){fraction=Math.max(0,t-.06);break}}
 cam.position.copy(origin).addScaledVector(delta,fraction);cam.rotation.set(Player.pitch,Player.yaw,0,'YXZ');body.group.visible=fraction*3.4>.8;
}
// Hook at render time, after all first-person movement and camera effects.
function installRender(){
 const renderer=State.renderer;if(!renderer||renderer.residentCamera)return;renderer.residentCamera=true;
 const render=renderer.render.bind(renderer);
 renderer.render=function(scene,camera){if(scene!==State.scene||camera!==State.camera)return render.apply(null,arguments);
 const position=camera.position.clone(),rotation=camera.rotation.clone();cameraFrame();
 try{return render.apply(null,arguments)}finally{camera.position.copy(position);camera.rotation.copy(rotation)}
 };
}
window.FCResident={setView,get thirdPerson(){return third},get body(){return body},cameraFrame,dispose};
document.addEventListener('keydown',e=>{if(e.code!=='KeyV'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||State.ui.paused||State.ui.inDialogue||State.ui.inShiftPanel||State.ui.inIntro)return;e.preventDefault();setView(!third)},true);
document.addEventListener('DOMContentLoaded',()=>{installRender();button=document.createElement('button');button.id='resident-view-toggle';button.onpointerdown=e=>e.stopPropagation();button.onclick=e=>{e.stopPropagation();setView(!third)};document.body.appendChild(button);setView(third);function frame(){updatePreview();requestAnimationFrame(frame)}requestAnimationFrame(frame)});
})();
