/* Citizens keep one feet coordinate; generated signs require real structural support. */
(function(){'use strict';
const offsets=r=>[[0,0],[-r,-r],[r,-r],[-r,r],[r,r]],loaded=(x,z,r)=>offsets(r).every(([a,b])=>State.chunkMap.has(Math.floor((x+a)/VOX_W)+','+Math.floor((z+b)/VOX_W)));
const blocked=shBodyBlocked;
window.shBodyBlocked=function(x,y,z,r,h){if(!loaded(x,z,r)||blocked(x,y,z,r,h)||window.CityArt?.blocksBody?.(x,y,z,r,h))return true;for(const key of nearbyChunkKeys(x,z)){const c=State.chunkMap.get(key);for(const a of c?.collisionAABBs||[])if(x+r>a.minX+.001&&x-r<a.maxX-.001&&z+r>a.minZ+.001&&z-r<a.maxZ-.001&&y+h>(a.minY??0)+.01&&y<a.maxY-.01)return true}return false};
function support(x,z,r,from){if(!loaded(x,z,r))return null;let y=0;for(const [dx,dz]of offsets(r))y=Math.max(y,shSurfaceY(x+dx,z+dz,from));for(const key of nearbyChunkKeys(x,z))for(const a of State.chunkMap.get(key)?.collisionAABBs||[])if(x+r>a.minX&&x-r<a.maxX&&z+r>a.minZ&&z-r<a.maxZ&&a.maxY<=from+.05)y=Math.max(y,a.maxY);return y||null}
function settle(ent,r,h){if(ent instanceof NPC){r=.46;h=ent.char?.studio?.height||1.85}const p=ent.position;if(!loaded(p.x,p.z,r))return false;const y=support(p.x,p.z,r,p.y+.05);if(y!==null&&y<=p.y+1.05&&!shBodyBlocked(p.x,y,p.z,r,h)){p.y=y;ent._supportRetry=0;return true}for(let lift=1;lift<=1;lift++){const top=support(p.x,p.z,r,p.y+lift);if(top!==null&&top<=p.y+1.05&&!shBodyBlocked(p.x,top,p.z,r,h)){p.y=top;ent._supportRetry=0;return true}}if((ent._supportRetry||0)>performance.now())return false;ent._supportRetry=performance.now()+500;for(let ring=1;ring<=6;ring++)for(let n=0;n<12;n++){const angle=n*Math.PI/6,x=p.x+Math.cos(angle)*ring,z=p.z+Math.sin(angle)*ring,top=support(x,z,r,Math.max(3,p.y+1));if(top!==null&&Math.abs(top-p.y)<=1.05&&!shBodyBlocked(x,top,z,r,h)){p.set(x,top,z);ent._supportRetry=0;return true}}return false}
window.shSettle=settle;
const movement=shGroundMove;window.shGroundMove=function(ent,dx,dz,r,h){if(ent instanceof NPC){r=.46;h=ent.char?.studio?.height||1.85}if(!Number.isFinite(dx)||!Number.isFinite(dz))return false;const steps=Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.2)||1;if(steps>256)return false;let moved=false;for(let i=0;i<steps;i++){if(!loaded(ent.position.x+dx/steps,ent.position.z+dz/steps,r))break;moved=movement.call(this,ent,dx/steps,dz/steps,r,h)||moved}return moved};
// Shared lifecycle for street people, hostiles, shop residents, visitors and quest actors.
const Actors=window.FCActors={stats:{prepared:0,recovered:0,hidden:0},
 dimensions(char,r=.38){return{r,h:char?.studio?.height||1.85}},
 dead(ent,char){return ent.state==='dead'||char?.fnb?.st==='dead'},
 prepare(ent,char,options={}){
  this.stats.prepared++;const view=options.view||char?.group||ent.group;if(!view)return false;
  if(this.dead(ent,char)){view.visible=false;return false}
  const dim=this.dimensions(char,options.r??.38),before=ent.position.clone();
  if(!options.flying&&!settle(ent,dim.r,dim.h)){if(!ent._actorHidden)ent._actorVisible=view.visible;ent._actorHidden=true;view.visible=false;this.stats.hidden++;return false}
  if(ent._actorHidden){view.visible=ent._actorVisible!==false;ent._actorHidden=false}
  if(before.distanceToSquared(ent.position)>.01)this.stats.recovered++;
  ent._actorStart=ent.position.clone();if(char)char.baseY=options.local?0:ent.position.y;return true;
 },
 finish(ent,char,dt,options={}){
  const view=options.view||char?.group||ent.group;if(!view)return false;
  if(this.dead(ent,char)){view.visible=false;return false}
  const dim=this.dimensions(char,options.r??.38);
  if(!options.flying&&!settle(ent,dim.r,dim.h)){if(!ent._actorHidden)ent._actorVisible=view.visible;ent._actorHidden=true;view.visible=false;this.stats.hidden++;return false}
  const elapsed=Math.max(.001,Math.min(.1,dt||.016)),start=ent._actorStart||ent.position;
  if(char?.studio){const speed=Math.min(12,Math.hypot(ent.position.x-start.x,ent.position.z-start.z)/elapsed);char.studio.motionSpeed=speed;
   const yaw=char.group.rotation.y,last=char.studio.visualYaw??yaw,delta=Math.atan2(Math.sin(yaw-last),Math.cos(yaw-last));char.studio.visualYaw=last+delta*(1-Math.exp(-elapsed*10));char.group.rotation.y=char.studio.visualYaw;
  }
  if(!options.flying){view.position.copy(ent.position);if(char){char.baseY=options.local?0:ent.position.y;if(options.local)char.group.position.y=0;
   // Keep the boot sole above its supporting floor after gait articulation.
   if(char.studio?.knees&&!char.fnb?.st?.match(/down|dead/)){
    char.group.updateMatrixWorld(true);const floor=char.group.getWorldPosition(new THREE.Vector3()).y;
    const low=Math.min(...char.studio.knees.map(k=>k.localToWorld(new THREE.Vector3(0,-.46,.058)).y));
    char.group.position.y+=Math.min(.16,Math.max(0,floor-low));
   }
  }}return true;
 },
 run(ent,char,fn,dt,options={}){if(!this.prepare(ent,char,options))return;const r=fn.call(ent,dt);this.finish(ent,char,dt,options);return r},
 remove(ent,char){const g=char?.group||ent.group;if(g){g.visible=false;g.removeFromParent()}},
};
const update=NPC.prototype.update;NPC.prototype.update=function(dt){return Actors.run(this,this.char,update,dt,{r:.46})};
const enemyUpdate=Enemy.prototype.update;Enemy.prototype.update=function(dt){return Actors.run(this,this.visualChar,enemyUpdate,dt,{r:Math.max(.55,(this.visualChar?.group.scale.x||1)*.32),flying:this.flying})};
function validate(chunk){let kept=0,hidden=0;chunk.group.traverse(o=>{let valid=true;if(o.userData.fcSupport){valid=o.userData.fcSupport.points.every(([x,y,z])=>isSolid(getBlock(Math.floor(x),Math.floor(y),Math.floor(z))))}else if(o.userData.fcRoofRig){const rig=o.userData.fcRoofRig,heights=rig.feet.map(x=>shSurfaceY(o.position.x+x,o.position.z,VOX_H-1));valid=heights.every(y=>y>3)&&Math.max(...heights)-Math.min(...heights)<.05;if(valid)o.position.y=heights[0]}else return;o.visible=valid;const light=o.userData.fcSupport?.light||o.userData.fcRoofRig?.light;if(!valid&&light){light.visible=false;const i=chunk.lights.indexOf(light);if(i>=0)chunk.lights.splice(i,1)}if(valid)kept++;else hidden++});return{kept,hidden}}
let last=0;function tick(now){requestAnimationFrame(tick);if(now-last<1000||!State.scene)return;last=now;for(const c of State.chunkMap.values())validate(c)}requestAnimationFrame(tick);
window.FCPhysicalSupport={loaded,support,settle,validate};
})();
