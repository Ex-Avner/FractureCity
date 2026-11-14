/* Crown Run: physical, checkpointed traversal of the front Lantern Hall rib. */
(function(){'use strict';
const nodes=[];
// Sample the ellipse by BOTH rise and horizontal advance. A constant angle
// would create impossible gaps near the crown or excessive rises at the foot.
let t=0;
while(t<Math.PI){
 const i=nodes.length,phase=i*Math.PI/6;
 nodes.push({x:178.5-38.5*Math.cos(t)+4*Math.cos(phase),y:3+96*Math.sin(t),z:-12+4*Math.sin(phase)});
 const step=Math.min(.8/(96*Math.abs(Math.cos(t))+.001),.6/(38.5*Math.abs(Math.sin(t))+.001),.022);
 t=Math.min(Math.PI,t+step);if(t===Math.PI)break;
}
const phase=nodes.length*Math.PI/6;nodes.push({x:217+4*Math.cos(phase),y:3,z:-12+4*Math.sin(phase)});
const summit=nodes.reduce((a,n,i)=>n.y>nodes[a].y?i:a,0);
nodes.forEach((n,i)=>{n.checkpoint=i%12===0||i===summit||i===nodes.length-1;n.size=1.5;});
const boxes=nodes.map((n,i)=>({minX:n.x-.75,maxX:n.x+.75,minY:n.y-.28,maxY:n.y,minZ:n.z-.75,maxZ:n.z+.75,crownRun:true,id:i}));
// Broad steps at both ends make the course reachable from the city pavement.
for(const n of [nodes[0],nodes.at(-1)])for(let i=0;i<3;i++)boxes.push({minX:n.x-1,maxX:n.x+1,minY:0,maxY:1+i,minZ:n.z-3+i,maxZ:n.z-2+i,crownRun:true,id:-1});
const generate=Chunk.prototype.generate;
Chunk.prototype.generate=function(){const result=generate.apply(this,arguments);for(const b of boxes)if(b.maxX>this.originX&&b.minX<this.originX+24&&b.maxZ>this.originZ&&b.minZ<this.originZ+24){
 // Clear only authored footholds and their headroom. Saved voxel edits still
 // apply afterwards, preserving player-built worlds.
 this.stampBox(Math.floor(b.minX),Math.floor(b.maxY),Math.floor(b.minZ),Math.ceil(b.maxX),Math.ceil(b.maxY+3),Math.ceil(b.maxZ),B_AIR);
 this.collisionAABBs.push({...b});}return result;};
let root,scene,resources=[],pads,beacon,finish,run=null,last=0,cooldown=0,noticeUntil=0,completed=false;
const hud=document.createElement('div');hud.id='crown-run-status';hud.style.cssText='position:fixed;left:50%;top:18%;transform:translateX(-50%);pointer-events:none;background:#102b33dd;color:#ffe4ad;border:1px solid #ba9c60;border-radius:20px;padding:8px 16px;font:600 13px system-ui;text-align:center;max-width:80vw;z-index:30;display:none';document.body.append(hud);
function notice(text){hud.textContent=text;noticeUntil=performance.now()+4000;hud.style.display='block';}
function material(color,glow=0){const m=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:glow,roughness:.6,metalness:.35});resources.push(m);return m;}
function batch(rows,mat){const geo=new THREE.BoxGeometry(1,1,1);resources.push(geo);const mesh=new THREE.InstancedMesh(geo,mat,rows.length),o=new THREE.Object3D();rows.forEach((r,i)=>{o.position.set(...r.slice(0,3));o.scale.set(...r.slice(3));o.rotation.set(0,0,0);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});mesh.frustumCulled=false;root.add(mesh);return mesh;}
function sign(text,n){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle='#102b33';g.fillRect(0,0,512,128);g.strokeStyle='#cfb477';g.lineWidth=6;g.strokeRect(4,4,504,120);g.fillStyle='#ffe6b0';g.font='bold 35px sans-serif';g.textAlign='center';g.fillText(text,256,77);const tex=new THREE.CanvasTexture(c),mat=new THREE.SpriteMaterial({map:tex});resources.push(tex,mat);const sp=new THREE.Sprite(mat);sp.position.set(n.x,n.y+2.8,n.z);sp.scale.set(4,1,1);root.add(sp);}
function dispose(){root?.traverse(o=>{if(o.isInstancedMesh)o.dispose?.();});root?.removeFromParent();resources.forEach(r=>r.dispose());resources=[];root=null;run=null;completed=false;hud.style.display='none';}
function build(){root=new THREE.Group();root.name='common-ground-crown-run';scene.add(root);
 pads=batch(boxes.map(b=>[(b.minX+b.maxX)/2,(b.minY+b.maxY)/2,(b.minZ+b.maxZ)/2,b.maxX-b.minX,b.maxY-b.minY,b.maxZ-b.minZ]),material(0xbfb69c));
 const strips=[],supports=[];
 nodes.forEach((n,i)=>{strips.push([n.x,n.y+.015,n.z-.65,1.35,.03,.10]);if(n.checkpoint){supports.push([n.x,n.y-.5,(n.z-2)/2,.12,.16,Math.abs(n.z+2)]);if(i%48===0||i===summit||i===nodes.length-1)sign(i===0?'CROWN RUN  ↑':i===nodes.length-1?'FINISH  ◇':i===summit?'THE CROWN · 99 m':`${Math.round(n.y)} m  ↑`,n);}});
 // Structural outriggers connect each foothold to the actual elliptical rib.
 const beamGeo=new THREE.BoxGeometry(1,1,1);resources.push(beamGeo);const beams=new THREE.InstancedMesh(beamGeo,material(0x9b7d4c),nodes.length),pose=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
 nodes.forEach((n,i)=>{const yy=Math.min(98,Math.max(0,n.y-1)),side=i<=summit?-1:1;
 const a=new THREE.Vector3(n.x,n.y-.22,n.z),b=new THREE.Vector3(178.5+side*37*Math.sqrt(Math.max(0,1-(yy/98)**2)),n.y-.7,-3.4),delta=b.clone().sub(a);
 pose.position.copy(a).add(b).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(up,delta.clone().normalize());pose.scale.set(.10,delta.length(),.10);pose.updateMatrix();beams.setMatrixAt(i,pose.matrix);
 });beams.frustumCulled=false;root.add(beams);
 batch(strips,material(0x68d9c9,.75));batch(supports,material(0x9b7d4c));
 const geo=new THREE.TorusGeometry(.62,.055,6,24);resources.push(geo);beacon=new THREE.Mesh(geo,material(0x80ffdf,1.6));root.add(beacon);finish=new THREE.Mesh(geo,material(0xe6b75e,1.3));root.add(finish);const end=nodes.at(-1);finish.position.set(end.x,end.y+1.3,end.z);
 paint();}
function paint(){if(!pads)return;const c=new THREE.Color();nodes.forEach((n,i)=>{pads.setColorAt(i,c.setHex(completed||run&&i<=run.index?0x69b7a6:n.checkpoint?0xe4c181:0xbfb69c));});pads.instanceColor.needsUpdate=true;}
function reset(){const n=nodes[run.checkpoint];Player.position.set(n.x,n.y+Player.height+.02,n.z);Player.velocity.set(0,0,0);Player.onGround=true;run.index=run.checkpoint;run.falls++;paint();notice('Caught by the arch · try again');}
function tick(){if(!State.scene)return;if(scene!==State.scene){dispose();scene=State.scene;build();last=performance.now();}
 const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;const p=Player.position;root.visible=Math.abs(p.x-179)<180&&Math.abs(p.z+12)<180;
 if(State.ui.paused)return;
 if(run&&(Player.mode!=='walk'||window.FCWorldStudio?.flying||window.FCJustice?.active)){run=null;paint();notice('Run ended');cooldown=now+3000;}
 const feet=p.y-Player.height;
 const standing=i=>{const n=nodes[i];return Player.onGround&&Math.abs(feet-n.y)<.16&&Math.abs(p.x-n.x)<.94&&Math.abs(p.z-n.z)<.94;};
 if(!run&&now>cooldown&&Player.mode==='walk'&&!window.FCWorldStudio?.flying&&!window.FCJustice?.active&&standing(0)){completed=false;finish.scale.setScalar(1);run={index:0,checkpoint:0,elapsed:0,falls:0};paint();notice('Crown Run · follow the mint light');}
 if(run){run.elapsed+=dt;
  // Every ledge must be landed on. Flying or teleporting cannot skip the run.
  if(run.index+1<nodes.length&&standing(run.index+1)){run.index++;if(nodes[run.index].checkpoint){run.checkpoint=run.index;notice(run.index===summit?'Crown reached · follow the lights down':'Checkpoint lit');}paint();}
  const n=nodes[run.index];if(feet<n.y-4)reset();
  else if(Math.hypot(p.x-n.x,p.z-n.z)>16){run=null;paint();cooldown=now+3000;notice('Left the Crown Run');}
  if(run&&run.index===nodes.length-1){notice(`Crown Run complete · ${Math.round(run.elapsed)}s · ${run.falls} catches`);finish.scale.setScalar(2);completed=true;run=null;cooldown=now+8000;paint();}
 }
 const target=nodes[run?Math.min(run.index+1,nodes.length-1):0];beacon.position.set(target.x,target.y+.6,target.z);beacon.rotation.x=-Math.PI/2;
 if(now>noticeUntil)hud.style.display='none';
}
const day=window.updateDayNight;window.updateDayNight=function(){const result=day.apply(this,arguments);tick();return result;};
window.FCCrownRun={nodes,boxes,summit,tick,dispose,get run(){return run;},get root(){return root;}};
})();
