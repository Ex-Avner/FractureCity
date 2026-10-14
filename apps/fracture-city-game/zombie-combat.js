/* Infected have one movement/attack owner. All displacement uses city collision. */
(function(){'use strict';
shRegisterZombie();
const infected=FCInfectedArt.infected;
let budget=2;
requestAnimationFrame(function resetRouteBudget(){budget=2;requestAnimationFrame(resetRouteBudget)});
function sight(x,y,z,tx,ty,tz){if(!shLineOfSight(x,y,z,tx,ty,tz))return false;const n=Math.max(1,Math.ceil(Math.hypot(tx-x,ty-y,tz-z)/.25));for(let i=1;i<n;i++){const t=i/n;if(shBodyBlocked(x+(tx-x)*t,y+(ty-y)*t,z+(tz-z)*t,.025,.05))return false}return true}

function clear(e,a,b){const d=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(d/.4));let y=a.y;for(let i=1;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n,top=FCPhysicalSupport.support(x,z,.55,y+1);if(top===null||Math.abs(top-y)>1.01||shBodyBlocked(x,top,z,.55,e.visualChar?.studio.height||1.85))return false;y=top}return true}
function route(e,target){
 const start=e.position.clone();if(clear(e,start,target))return[{x:target.x,y:start.y,z:target.z}];
 const open=[{x:0,z:0,y:start.y,g:0,f:0}],seen=new Map(),closed=new Set();seen.set('0,0',open[0]);let end=null,steps=0;
 while(open.length&&steps++<1200){let at=0;for(let i=1;i<open.length;i++)if(open[i].f<open[at].f)at=i;const n=open.splice(at,1)[0],key=n.x+','+n.z;if(closed.has(key))continue;closed.add(key);
  const wx=start.x+n.x,wz=start.z+n.z;if(Math.hypot(wx-target.x,wz-target.z)<1.25){end=n;break}
  for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=n.x+dx,z=n.z+dz,k=x+','+z;if(closed.has(k)||Math.abs(x)>48||Math.abs(z)>48)continue;const old=seen.get(k),g=n.g+1;if(old&&old.g<=g)continue;const p={x:start.x+x,z:start.z+z,y:n.y};if(!clear(e,{x:wx,z:wz,y:n.y},p))continue;p.y=FCPhysicalSupport.support(p.x,p.z,.55,n.y+1);const next={x,z,y:p.y,g,f:g+Math.hypot(p.x-target.x,p.z-target.z),parent:n};seen.set(k,next);open.push(next)}
 }
 if(!end)return[];const path=[];while(end.parent){path.push({x:start.x+end.x,y:end.y,z:start.z+end.z});end=end.parent}return path.reverse();
}
function move(e,dt,speed,target){
 e._zcRepath=(e._zcRepath||0)-dt;
 if(e._zcRepath<=0&&budget>0){budget--;e._zcPath=route(e,target);e._zcRepath=.85+((e.studioSeed||0)%3)*.1;e._zcTarget={x:target.x,z:target.z}}
 const path=e._zcPath||[];while(path.length&&Math.hypot(path[0].x-e.position.x,path[0].z-e.position.z)<.22)path.shift();
 const p=path[0]||target,dx=p.x-e.position.x,dz=p.z-e.position.z,d=Math.hypot(dx,dz);if(d<.05)return;
 const step=Math.min(d,speed*dt);shGroundMove(e,dx/d*step,dz/d*step,.55,e.visualChar?.studio.height||1.85);e.direction=Math.atan2(dz,dx);
}
const update=Enemy.prototype.update;
Enemy.prototype.update=function(dt){if(!infected.has(this.type))return update.apply(this,arguments);if(this.hp<=0||this.state==='dead'){this._fcWind=null;return}
 dt=Math.min(.1,Math.max(0,dt||0));if(!FCActors.prepare(this,this.visualChar,{r:.55}))return;
 this.fnFrozen=Math.max(0,(this.fnFrozen||0)-dt);this._fcStun=Math.max(this.fnFrozen,(this._fcStun||0)-dt,0);if(this._fcStun>0)this._fcWind=null;this._zcRecovery=Math.max(0,(this._zcRecovery||0)-dt);
 const dx=Player.position.x-this.position.x,dz=Player.position.z-this.position.z,d=Math.hypot(dx,dz),hunting=!Peace.on&&Player.hp>0&&(this.siege||this.obStory||d<this.def.detectRange);
 if(hunting){this.lastSeenPlayerPos=Player.position.clone();this.state=d<=this.def.attackRange?'attack':'alert';
  if(!this._fcWind&&!this._fcStun&&!this._zcRecovery){
   const speed=this.fcBoss?this.def.speed:this.type==='stalker'?4.5:this.type==='husk'?2.25:this.type==='zombie'?3.15:this.def.speed;
   // Ranged infected close until they have a clear lane; melee never attacks through walls.
   const los=d<=this.def.attackRange&&sight(this.position.x,this.position.y+1.3,this.position.z,Player.position.x,Player.position.y-.2,Player.position.z);
   if(!los||d>this.def.attackRange*.8)move(this,dt,speed,Player.position);
   this.attackTimer=Math.max(0,(this.attackTimer||0)-dt);
   if(los&&this.attackTimer<=0){this.direction=Math.atan2(dz,dx);this.attackTimer=this.def.attackCooldown;this.doAttack()}
  }
 }else{this.state='patrol';this._fcWind=null;this._zcPath=[];this._zcRepath=0;}
 const w=this._fcWind;if(w){w.left-=dt;if(w.left<=0){this._fcWind=null;this._zcRecovery=.30;const dist=Math.hypot(Player.position.x-this.position.x,Player.position.z-this.position.z),miss=Math.hypot(Player.position.x-w.x,Player.position.z-w.z);if(hunting&&!this._fcStun&&dist<=this.def.attackRange+.2&&miss<(this.def.attackRange>6?1.2:1.8)&&sight(this.position.x,this.position.y+1.3,this.position.z,Player.position.x,Player.position.y-.2,Player.position.z)){this._fcRelease=true;try{this.doAttack()}finally{this._fcRelease=false}}}}
 if(this.type==='howler'&&hunting){this.rallyT=(this.rallyT||0)-dt;if(this.rallyT<=0){this.rallyT=7;shRally(this,20)}}
 this.group.rotation.y=-this.direction+Math.PI/2;
 FCActors.finish(this,this.visualChar,dt,{r:.55});FCInfectedArt.pose(this,dt);
 if(hunting&&this.fcBoss&&window.FCStory?.tickBoss)FCStory.tickBoss.call(this,dt);
 this.hitFlash=Math.max(0,(this.hitFlash||0)-dt);this.group.traverse(o=>{if(o.material?.emissive)o.material.emissive.setRGB(this.hitFlash*2,0,0)});
};
// Replace the old distant rooftop/fallback spawns with supported street approaches.
window.shSiegeSpawnPoint=function(){const px=Player.position.x,pz=Player.position.z,ground=Player.position.y-Player.height,forward=new THREE.Vector3(-Math.sin(Player.yaw),0,-Math.cos(Player.yaw));let best=null,score=-Infinity;
 for(let i=0;i<48;i++){const a=i*Math.PI*2/48+Math.random()*.12,r=17+Math.random()*12,x=px+Math.cos(a)*r,z=pz+Math.sin(a)*r,y=FCPhysicalSupport.support(x,z,.55,ground+1);if(y===null||Math.abs(y-ground)>1.01||shBodyBlocked(x,y,z,.55,2.5))continue;const s=-(x-px)/r*forward.x-(z-pz)/r*forward.z;if(s>score){score=s;best={x,y,z}}}return best};
window.shSiegeSpawnOne=function(){const p=shSiegeSpawnPoint();if(!p||Siege.ours.size>=shSiegeCap())return null;
 const e=new Enemy('zombie',p.x,p.z,new RNG('horde:'+Siege.spawned+':'+State.citySeed));e.position.set(p.x,p.y,p.z);e.group.position.copy(e.position);e.siege=true;e.state='alert';e.attackTimer=.6;State.scene.add(e.group);State.enemies.push(e);Siege.ours.add(e);Siege.spawned++;return e};
// Never teleport engaged enemies. Their cached paths handle nearby walls.
window.shSiegeTick=function(dt){if(!Siege.active)return;Siege.since+=dt;for(const e of [...Siege.ours])if(e.hp<=0||!State.enemies.includes(e))Siege.ours.delete(e);Siege.spawnTimer-=dt;if(Siege.spawnTimer<=0&&Siege.ours.size<shSiegeCap()){Siege.spawnTimer=Math.max(.8,2-Siege.kills*.015);shSiegeSpawnOne()}shSiegeHUD()};
window.shSiegeCap=()=>Math.min(28,10+Math.floor(Siege.kills/4));
const stop=shSiegeStop;window.shSiegeStop=function(){if(!Siege.active)return;for(let i=State.enemies.length-1;i>=0;i--){const e=State.enemies[i];if(e.siege){e.group.removeFromParent();State.enemies.splice(i,1)}}return stop.apply(this,arguments)};
window.FCZombieCombat={route,clear,move,sight};
})();
