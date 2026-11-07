/* Ashbound: paired, local night encounters. Gaze owns every movement/attack clock. */
(function(){'use strict';
const TYPE='ashbound',HEIGHT=2.15,RADIUS=.48;
ENEMY_TYPES[TYPE]={name:'ASHBOUND',hp:65,dmg:10,speed:2.6,height:HEIGHT,detectRange:40,attackRange:1.9,attackCooldown:1.8,rewardCredits:[18,25],flying:false,colors:{}};
HITBOX[TYPE]={r:.6,from:0,to:HEIGHT};
const live=new Set(),point=new THREE.Vector3(),projected=new THREE.Vector3(),eye=new THREE.Vector3();
const mat={ash:new THREE.MeshLambertMaterial({color:0x29252c}),bone:new THREE.MeshLambertMaterial({color:0x9b927e}),bronze:new THREE.MeshLambertMaterial({color:0x806342}),ember:new THREE.MeshBasicMaterial({color:0xe9a452}),dark:new THREE.MeshLambertMaterial({color:0x100e17})};
const geo={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,8,6),cone:new THREE.ConeGeometry(1,1,6),ring:new THREE.TorusGeometry(.55,.035,4,12)};
function part(g,shape,m,x,y,z,sx,sy,sz){const o=new THREE.Mesh(geo[shape],mat[m]);o.position.set(x,y,z);o.scale.set(sx,sy,sz);g.add(o);return o;}
// Cache merged static parts once; articulated bones remain independent.
const merged=new Map(),surfaceMat=new THREE.MeshLambertMaterial({vertexColors:true}),glowMat=new THREE.MeshBasicMaterial({vertexColors:true});
surfaceMat.__texPack=glowMat.__texPack=true;
function bake(group,key){
 const meshes=group.children.filter(o=>o.isMesh),sets=[meshes.filter(o=>o.material!==mat.ember),meshes.filter(o=>o.material===mat.ember)];
 sets.forEach((parts,i)=>{if(!parts.length)return;const id=key+i;let g=merged.get(id);
  if(!g){const positions=[],normals=[],colors=[];for(const o of parts){o.updateMatrix();const piece=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();piece.applyMatrix4(o.matrix);positions.push(...piece.attributes.position.array);normals.push(...piece.attributes.normal.array);const c=o.material.color;for(let j=0;j<piece.attributes.position.count;j++)colors.push(c.r,c.g,c.b);piece.dispose();}
   g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingSphere();merged.set(id,g);
  }parts.forEach(o=>group.remove(o));group.add(new THREE.Mesh(g,i?glowMat:surfaceMat));
 });
}
function mesh(e){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);e.ashBody=body;
 // A narrow basalt torso, exposed ribs, long forearms, and a broken bronze crown.
 part(body,'cone','ash',0,.83,0,.4,1.35,.3);
 part(body,'box','dark',0,1.22,0,.5,.65,.27);
 for(let i=0;i<4;i++){const rib=part(body,'box','bone',0,1.05+i*.12,.16,.43-i*.03,.035,.055);rib.rotation.z=(i%2?1:-1)*.08;}
 const head=new THREE.Group();head.position.y=1.78;body.add(head);e.ashHead=head;
 part(head,'sphere','bone',0,0,0,.19,.25,.17);part(head,'box','dark',0,-.11,.15,.14,.055,.04);
 for(const x of [-.085,.085]){part(head,'box','dark',x,.04,.15,.105,.09,.06);part(head,'box','ember',x,.035,.186,.038,.018,.015);part(head,'box','ash',x,.12,.15,.12,.045,.07).rotation.z=x<0?-.22:.22;}
 part(head,'cone','dark',0,-.035,.18,.035,.08,.02);for(const x of [-.05,0,.05])part(head,'box','bone',x,-.095,.177,.025,.035,.015);
 for(const side of [-1,1]){part(body,'cone','bronze',side*.32,1.57,0,.22,.15,.26).rotation.z=side*.3;part(body,'box','bronze',side*.2,1.35,.19,.035,.32,.035).rotation.z=side*.3;}
 part(body,'sphere','bronze',0,.85,.19,.11,.13,.04);part(body,'box','ember',0,.85,.235,.025,.065,.01);
 for(let i=0;i<5;i++){const a=i/5*Math.PI*2;part(head,'cone','bronze',Math.sin(a)*.18,.29,Math.cos(a)*.14,.045,.22+(i%2)*.12,.045);}
 e.ashArms=[];e.ashLegs=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.34,1.48,0);body.add(arm);e.ashArms.push(arm);
  part(arm,'box','ash',0,-.29,0,.16,.62,.17);part(arm,'box','bone',0,-.73,.05,.09,.36,.11);
  for(let i=0;i<3;i++)part(arm,'cone','bronze',(i-1)*.045,-.98,.1,.018,.2,.018).rotation.x=Math.PI;
  const leg=new THREE.Group();leg.position.set(side*.16,.58,0);body.add(leg);e.ashLegs.push(leg);part(leg,'box','ash',0,-.25,0,.14,.5,.15);part(leg,'box','bone',0,-.53,.1,.14,.08,.27);
 }
 const seal=new THREE.Mesh(geo.ring,mat.ember);seal.rotation.x=Math.PI/2;seal.position.y=.025;root.add(seal);e.ashSeal=seal;
 body.position.y=-1.45;e.ashArms.forEach((a,i)=>{a.rotation.x=-1.7;a.rotation.z=(i?1:-1)*.5;});
 bake(body,'body');bake(head,'head');e.ashArms.forEach(a=>bake(a,'arm'));e.ashLegs.forEach(a=>bake(a,'leg'));root.name='Ashbound';return root;
}
const make=Enemy.prototype.makeMesh;Enemy.prototype.makeMesh=function(rng){return this.type===TYPE?mesh(this):make.apply(this,arguments);};
const hour=()=>((State.dayTime/60)%24+24)%24;
const night=()=>hour()>=19.5||hour()<5.5;
function sanctuary(x,z){return (x>=24&&x<=72&&z>=-48&&z<=0)||(x>=72&&x<=120&&z>=-48&&z<=48)||(x>=137&&x<=216&&z>=0&&z<=73)||(x>=192&&x<=288&&z>=48&&z<=120);}
function playable(){const u=State.ui;return !!State.scene&&State.chunkMap.size>0&&night()&&!Peace.on&&Player.hp>0&&!u.paused&&!u.inIntro&&!u.inDialogue&&!u.inInventory&&!u.inArcade&&!u.inMiniGame&&!u.inShiftPanel&&!u.construct&&!window.FN?.prologue&&!window.FN?.scene&&Player.mode==='walk';}
function clearSight(a,b){
 if(!shLineOfSight(a.x,a.y,a.z,b.x,b.y,b.z))return false;
 const d=a.distanceTo(b),n=Math.ceil(d/.35);
 for(let i=1;i<n;i++){const k=i/n;if(shBodyBlocked(a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k,a.z+(b.z-a.z)*k,.025,.04))return false;}
 return true;
}
const gazeCamera=new THREE.PerspectiveCamera(),back=new THREE.Vector3();
function observed(e){
 if(!State.camera)return false;const camera=gazeCamera;camera.copy(State.camera,false);
 if(window.FCResident?.thirdPerson){
  camera.rotation.set(Player.pitch,Player.yaw,0,'YXZ');back.set(0,0,3.4).applyEuler(camera.rotation);let fraction=1;
  for(let t=.06;t<=1;t+=.025){point.copy(Player.position).addScaledVector(back,t);let hit=false;for(const x of [-.16,.16])for(const y of [-.16,.16])for(const z of [-.16,.16])if(isSolid(getBlock(Math.floor(point.x+x),Math.floor(point.y+y),Math.floor(point.z+z))))hit=true;if(hit){fraction=Math.max(0,t-.06);break;}}
  camera.position.copy(Player.position).addScaledVector(back,fraction);
 }
 camera.updateMatrixWorld(true);camera.getWorldPosition(eye);
 const offset=e.ashBody.position.y;
 // Test head, chest, both shoulders and feet, not just the centre of the body.
 for(const [dx,h]of [[0,1.95],[0,1.2],[-.46,1.45],[.46,1.45],[0,.25]]){
  point.set(e.position.x+dx,e.position.y+offset+h,e.position.z);if(point.y<e.position.y+.05)continue;
  projected.copy(point).project(camera);
  if(projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<=1.04&&Math.abs(projected.y)<=1.04&&clearSight(eye,point))return true;
 }
 return false;
}
const update=Enemy.prototype.update;
Enemy.prototype.update=function(dt){
 if(this.type!==TYPE)return update.apply(this,arguments);
 if(this.state==='dead'||!playable()||sanctuary(Player.position.x,Player.position.z))return;
 dt=Math.max(0,Math.min(.05,dt||0));this.ashFrozen=observed(this);
 if(this.ashFrozen){this.ashWind=0;return;}
 this.ashAge=(this.ashAge||0)+dt;
 const rise=Math.min(1,this.ashAge/2.4);this.ashBody.position.y=-1.45*(1-rise);this.ashBody.rotation.x=(1-rise)*-.45;
 this.ashArms.forEach((a,i)=>{a.rotation.x=-1.7*(1-rise)+Math.sin(this.ashAge*6+i*Math.PI)*.22*rise;a.rotation.z=(i?1:-1)*.15;});
 this.ashLegs.forEach((a,i)=>a.rotation.x=Math.sin(this.ashAge*6+i*Math.PI)*.28*rise);
 this.ashSeal.visible=rise<1;
 if(rise<1)return;
 const dx=Player.position.x-this.position.x,dz=Player.position.z-this.position.z,d=Math.hypot(dx,dz);
 this.group.rotation.y=Math.atan2(dx,dz);
 this.attackTimer=Math.max(0,(this.attackTimer||0)-dt);
 if(d>this.def.attackRange){
  this.ashWind=0;const step=Math.min(d,this.def.speed*dt),x=this.position.x+dx/d*step,z=this.position.z+dz/d*step;
  if(!sanctuary(x,z))shGroundMove(this,dx/d*step,dz/d*step,RADIUS,HEIGHT);
 }else if(Math.abs(Player.position.y-Player.height-this.position.y)<1.4&&this.attackTimer<=0){
  point.set(this.position.x,this.position.y+1.35,this.position.z);eye.copy(Player.position);
  if(clearSight(point,eye)){this.ashWind=(this.ashWind||0)+dt;if(this.ashWind>=.65){damagePlayer(this.def.dmg);this.attackTimer=this.def.attackCooldown;this.ashWind=0;}}else this.ashWind=0;
 }
 this.group.position.copy(this.position);
};
const take=Enemy.prototype.takeDamage;Enemy.prototype.takeDamage=function(amount,headshot){
 if(this.type!==TYPE)return take.apply(this,arguments);if(this.state==='dead'||!Number.isFinite(amount)||amount<=0)return;
 this.hp-=amount;spawnDamageNumber(this.position.x,this.position.y+1.8,this.position.z,Math.round(amount),!!headshot);
 if(this.hp<=0){this.state='dead';this.deadTimer=0;this.group.visible=false;grantCredits(20);Player.kills++;toast('Ashbound returned to ash · +20 credits','success');}
};
function removeAll(){for(const e of live){e.group.removeFromParent();const i=State.enemies.indexOf(e);if(i>=0)State.enemies.splice(i,1);}live.clear();}
function site(x,z){
 if(sanctuary(x,z))return null;const y=FCPhysicalSupport.support(x,z,RADIUS,3.5);
 if(y===null||y>3||shBodyBlocked(x,y,z,RADIUS,HEIGHT))return null;
 // Ground only, with open sky: never emerge through an upstairs room or a roof.
 for(let h=y+HEIGHT;h<VOX_H;h+=1)if(isSolid(getBlock(Math.floor(x),Math.floor(h),Math.floor(z))))return null;
 return {x,y,z};
}
function spawnPair(){
 if(!playable()||sanctuary(Player.position.x,Player.position.z)||live.size)return false;
 let a,b;
 for(let i=0;i<16;i++){const angle=Player.yaw+Math.PI+(Math.random()-.5)*2,d=14+Math.random()*8,x=Player.position.x-Math.sin(angle)*d,z=Player.position.z-Math.cos(angle)*d;a=site(x,z);b=site(x+Math.cos(angle)*2.5,z-Math.sin(angle)*2.5);if(a&&b&&Math.abs(a.y-b.y)<.6)break;a=b=null;}
 if(!a||!b)return false;
 for(const p of [a,b]){const e=new Enemy(TYPE,p.x,p.z,new RNG('ashbound:'+Math.random()));e.position.set(p.x,p.y,p.z);e.group.position.copy(e.position);e.ashAge=0;e.ashWind=0;e.ashFrozen=false;State.scene.add(e.group);State.enemies.push(e);live.add(e);}
 if(!introduced){introduced=true;toast('ASHBOUND · They rise in pairs after dark. Keep them in sight to stop them.','warn');}
 return true;
}
let world=null,seed='',wait=20,last=performance.now(),introduced=false;
function frame(t){requestAnimationFrame(frame);const dt=Math.min(.1,(t-last)/1000);last=t;
 if(world!==State.scene||seed!==State.citySeed){removeAll();world=State.scene;seed=State.citySeed;wait=20;introduced=false;}
 if(!night()||Peace.on||sanctuary(Player.position.x,Player.position.z)){if(live.size)removeAll();wait=Math.max(wait,15);return;}
 for(const e of [...live])if(e.state==='dead'||!State.enemies.includes(e)||e.group.parent!==State.scene||e.position.distanceTo(Player.position)>65){e.group.removeFromParent();const i=State.enemies.indexOf(e);if(i>=0)State.enemies.splice(i,1);live.delete(e);}
 if(!playable()||live.size)return;wait-=dt;if(wait<=0){wait=spawnPair()?100:12;}
}
window.FCAshbound={TYPE,night,sanctuary,observed,spawnPair,clear:removeAll,get live(){return [...live]}};
requestAnimationFrame(frame);
})();
