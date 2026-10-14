/* Three salvage weapons with different jobs, shared by keyboard and touch attack. */
(function(){'use strict';
const ids=['parkingmeter','arcwelder','megaphone'];
function visible(a,b){return FCZombieCombat.sight(a.x,a.y,a.z,b.x,b.y,b.z)}
const center=e=>new THREE.Vector3(e.position.x,e.position.y+1.2,e.position.z);
function impact(e,w,from,scale=1){const before=e.hp;e.takeDamage(w.dmg*scale,false);if(e.hp===before)return;
 if(e.hp>0){e._fcStun=w===FN.weapons.arcwelder?1.05:.38;e._fcWind=null;const dx=e.position.x-from.x,dz=e.position.z-from.z,d=Math.hypot(dx,dz)||1;const push=w===FN.weapons.megaphone?2.4:w===FN.weapons.parkingmeter?1.2:.15;shGroundMove(e,dx/d*push,dz/d*push,.55,e.visualChar?.studio.height||1.85);e.group.position.copy(e.position);e._zcRepath=0}
 const p=center(e);shBurst(p.x,p.y,p.z,{count:9,color:w.color,size:.055,speed:3,life:.3});
}
const attack=tryAttack;window.tryAttack=function(){const slot={baton:1,pistol:2,shotgun:3}[Player.currentWeapon],id=FN.state.loadout[slot];if(!ids.includes(id))return attack.apply(this,arguments);
 if(Player.attackCooldown>0||Player.hp<=0||Player.mode!=='walk'||State.ui.paused||State.ui.inMiniGame||State.ui.inDialogue||State.ui.inArcade||State.ui.inIntro||State.ui.inShiftPanel||State.ui.inInventory||State.ui.construct)return;
 const w=FN.weapons[id],origin=Player.position.clone(),forward=new THREE.Vector3(0,0,-1).applyEuler(State.camera.rotation).normalize();
 if(w.type==='ranged'){if(Player.ammo[Player.currentWeapon]<=0){toast('Out of charge. Defeat six Turned to resupply.','info');return}Player.ammo[Player.currentWeapon]--;refreshAmmoHUD()}
 Player.attackCooldown=w.cooldown;FCPolish.shotAt=performance.now();FCPolish.shotWeight=1;flashWeapon(w);shEmitNoise(origin.x,origin.z,30,'shot');
 const enemies=State.enemies.filter(e=>!e._fnProxy&&e.hp>0&&e.state!=='dead');
 if(id==='arcwelder'){
  let first=null,nearest=w.range;for(const e of enemies){const hit=shRayCapsule(origin,forward,e);if(hit&&hit.t<nearest&&visible(origin,center(e))){first=e;nearest=hit.t}}
  if(first){const hit=new Set();let e=first,from=origin;for(let i=0;i<4&&e;i++){const end=center(e);shTracer(from,end,w.color);impact(e,w,from,1-i*.15);hit.add(e);from=end;let next=null,dist=4.5;for(const o of enemies){const p=center(o),d=p.distanceTo(from);if(!hit.has(o)&&o.hp>0&&d<dist&&visible(from,p)){next=o;dist=d}}e=next}}
  else {const end=origin.clone().addScaledVector(forward,w.range);if(visible(origin,end))shTracer(origin,end,w.color)}
 }else{
  const cutoff=id==='megaphone'?.80:.35;for(const e of enemies){const p=center(e),v=p.clone().sub(origin),d=v.length();if(d<=w.range&&v.normalize().dot(forward)>cutoff&&visible(origin,p))impact(e,w,origin)}
  if(id==='megaphone')for(let i=-2;i<=2;i++){const dir=forward.clone().applyAxisAngle(new THREE.Vector3(0,1,0),i*.13),end=origin.clone().addScaledVector(dir,w.range);if(visible(origin,end))shTracer(origin,end,w.color)}
 }
 shTone({type:id==='megaphone'?'sawtooth':'triangle',f0:id==='arcwelder'?780:180,f1:65,gain:.13,dur:.18});
};
let combo=0,lastKill=0,best=0;
shHookZombieCount();
const hit=Enemy.prototype.takeDamage;Enemy.prototype.takeDamage=function(){const alive=this.hp>0,r=hit.apply(this,arguments);if(alive&&this.hp<=0&&this.siege&&Siege.active){const now=performance.now();combo=now-lastKill<4500?combo+1:1;lastKill=now;best=Math.max(best,combo);
 if(Siege.kills>0&&Siege.kills%6===0){Player.hp=Math.min(Player.maxHp||100,Player.hp+8);for(const [key,slot,n]of[['pistol',2,8],['shotgun',3,4]]){const w=FN.weapons[FN.state.loadout[slot]];if(w?.ammoMax)Player.ammo[key]=Math.min(w.ammoMax,Player.ammo[key]+n)}refreshAmmoHUD();toast('SALVAGE SURGE · +8 health · ammo restored','success')}}return r};
const start=shSiegeStart;window.shSiegeStart=function(){if(Siege.active)return;combo=0;lastKill=0;best=0;const r=start.apply(this,arguments);
 // A fresh kit is offered on the street; starting a mode never replaces a chosen loadout.
 ids.forEach((id,i)=>{const a=Player.yaw+Math.PI/2+(i-1)*.5,x=Player.position.x+Math.cos(a)*2,z=Player.position.z+Math.sin(a)*2,y=FCPhysicalSupport.support(x,z,.2,Player.position.y);if(y!==null&&!shBodyBlocked(x,y,z,.2,.5))FN.dropWeapon(id,x,y+.2,z,{ttl:120,pid:'siege-kit:'+id+':'+Date.now()})});
 toast('SALVAGE KIT nearby · R to collect · 1 / 2 / 3 to equip · six kills restore ammo','info');return r};
const hud=shSiegeHUD;window.shSiegeHUD=function(){hud();const bar=document.getElementById('siege-bar');if(!bar)return;let el=document.getElementById('siege-rhythm');if(!el){el=document.createElement('span');el.id='siege-rhythm';el.style.cssText='font-size:10px;color:#a9d7cd';bar.appendChild(el)}el.textContent=' · WAVE '+(1+Math.floor(Siege.kills/12))+' · '+(performance.now()-lastKill<4500?combo:0)+' CHAIN · '+(6-Siege.kills%6)+' TO RESUPPLY'};
window.FCScrapWeapons={ids,get best(){return best}};
})();
