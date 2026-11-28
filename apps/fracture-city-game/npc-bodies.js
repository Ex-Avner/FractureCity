/* NPC BODIES · 0.112

   Every person in the city has a body you bump into, and people do not stand
   inside each other.

   How: every live character in every system is animated through
   shAnimateCharacter each frame, so that call is the registry. Once per frame,
   just before the scene is drawn, one pass:
     - finds characters standing on a floor (drivers, people seated on benches
       or in vehicles, and preview models in other scenes are left alone);
     - pushes overlapping characters apart (0.3 m radius each), never into a
       wall, never more than 1 m from where their own system put them, and lets
       them drift back once clear;
     - nudges a character the player walks into.
   After walk physics the player is pushed out of any body (0.4 + 0.3 m), and
   only into space that is free.

   No system's own state is changed: the nudge is applied to the drawn position
   and recognised and removed again if the system does not rewrite it.

   FCBodies.set(false) turns it off. FCBodies.stats for tests. */
(function(){'use strict';
if(typeof THREE==='undefined'||typeof State==='undefined'||typeof shAnimateCharacter!=='function')return;
const B=window.FCBodies={version:'0.112.0',enabled:true,stats:{bodies:0,pairs:0,pushed:0,player:0}};
const R=.3,PR=.4,MAX=1,RETURN=.6;
const seen=new Map(); // char -> {frame, st}
let frame=0,lastPass=-1;
const anim=window.shAnimateCharacter;
window.shAnimateCharacter=function(c){if(c&&c.group)seen.set(c,frame);return anim.apply(this,arguments);};

const tmpV=new THREE.Vector3(),tmpQ=new THREE.Quaternion(),tmpS=new THREE.Vector3(),inv=new THREE.Quaternion();
function inScene(o){let q=o,n=0;while(q&&n++<12){if(q===State.scene)return true;if(!q.visible)return false;q=q.parent;}return false;}
const VEHICLE=/car|vehicle|bus|truck|tram|taxi|bike|board|seat|chair|bench|bed/i;
function excluded(c){if(c._bodyChecked!==undefined)return c._bodyChecked;let q=c.group.parent,n=0,x=false;while(q&&q!==State.scene&&n++<8){if(VEHICLE.test(q.name||'')||q.userData?.car||q.userData?.vehicle){x=true;break;}q=q.parent;}c._bodyChecked=x;return x;}
const bodies=[];
function pass(){
 const sc=State.scene;if(!sc||lastPass===frame)return;lastPass=frame;bodies.length=0;const t0=performance.now();try{passInner(sc);}finally{B.stats.ms=+(performance.now()-t0).toFixed(3);}}
function passInner(sc){
 if(!B.enabled){for(const [c] of seen)restore(c);return;}
 const p=Player.position,pf=p.y-Player.height,skip=B.stats.skip={stale:0,scene:0,ground:0,self:0};
 for(const [c,f] of seen){
  if(frame-f>30||!c.group.parent){skip.stale++;if(frame-f>600)seen.delete(c);continue;}
  const g=c.group;if(!inScene(g)||excluded(c)||c.dead||c.ragdoll){skip.scene++;restore(c);continue;}
  const st=c._body||(c._body={off:new THREE.Vector2(),applied:new THREE.Vector3(),written:new THREE.Vector3(),has:false});
  // Recover the position the character's own system wants.
  // Untouched since we drew it, or moved by a system that adds a step to the current position
  // (the nudge would otherwise be baked in and add up): remove the nudge. A system that sets an
  // absolute position has already discarded it.
  if(st.has){const toW=g.position.distanceToSquared(st.written);tmpV.copy(st.written).sub(st.applied);const toBase=g.position.distanceToSquared(tmpV);if(toW<1e-10||toW<toBase)g.position.sub(st.applied);}
  st.applied.set(0,0,0);st.has=false;
  g.getWorldPosition(tmpV);const x=tmpV.x,y=tmpV.y,z=tmpV.z;
  // Only people standing on a floor: not drivers, not the seated, not anyone mid-air.
  const ground=shSurfaceY(x,z,y+1);if(Math.abs(ground-y)>.32){skip.ground++;continue;}
  // The player's own body (third person) sits on the player.
  if(Math.hypot(x-p.x,z-p.z)<.05&&Math.abs(y-pf)<.3){skip.self++;continue;}
  bodies.push({c,g,st,x,y,z,ox:st.off.x,oz:st.off.y});
 }
 B.stats.bodies=bodies.length;B.stats.pairs=0;
 // Overlaps between people, on a 1 m grid.
 const key=(i,j)=>i*73856093^j*19349663;bodies.forEach((b,i)=>b.id=i);
 for(let iter=0;iter<3;iter++){const grid=new Map();
 for(const b of bodies){const k=key(Math.floor(b.x+b.ox),Math.floor(b.z+b.oz));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(b);}
 for(const a of bodies){const ax=a.x+a.ox,az=a.z+a.oz,i0=Math.floor(ax),j0=Math.floor(az);
  for(let i=i0-1;i<=i0+1;i++)for(let j=j0-1;j<=j0+1;j++){const cell=grid.get(key(i,j));if(!cell)continue;
   for(const b of cell){if(b===a||a.id>=b.id)continue;
    const bx=b.x+b.ox,bz=b.z+b.oz,dx=bx-ax,dz=bz-az,d=Math.hypot(dx,dz);if(d>=R*2||Math.abs(a.y-b.y)>1.2)continue;
    if(!iter)B.stats.pairs++;const n=d>1e-4?[dx/d,dz/d]:[Math.cos(a.id*2.4+b.id),Math.sin(a.id*2.4+b.id)],push=(R*2-d)/2;
    a.ox-=n[0]*push;a.oz-=n[1]*push;b.ox+=n[0]*push;b.oz+=n[1]*push;}}}}
 // Anticipate a walking player's path instead of waiting for body overlap.
 B.stats.yielding=0;
 if(Player.mode==='walk'&&Player.onGround){
  const vx=Player.velocity.x,vz=Player.velocity.z,speed=Math.hypot(vx,vz);
  if(speed>.7)for(const b of bodies){
   if(Math.abs(b.y-pf)>1.2)continue;
   const dx=b.x-p.x,dz=b.z-p.z,t=(dx*vx+dz*vz)/(speed*speed);
   if(t<0||t>.6||Math.hypot(dx,dz)>3.5)continue;
   const cross=(dx*(-vz)+dz*vx)/speed;
   if(Math.abs(cross)>.85)continue;
   const side=Math.abs(cross)>.08?Math.sign(cross):(b.id%2?1:-1),amount=Math.min(.65-Math.abs(cross),Math.min(.1,clock.dt)*1.8);
   if(amount<=0)continue;
   b.ox+=-vz/speed*side*amount;b.oz+=vx/speed*side*amount;B.stats.yielding++;
  }
 }
 // The player bumps people: they give a little.
 if(Player.mode==='walk')for(const b of bodies){const bx=b.x+b.ox,bz=b.z+b.oz,dx=bx-p.x,dz=bz-p.z,d=Math.hypot(dx,dz);if(d<PR+R&&Math.abs(b.y-pf)<1.4&&d>1e-4){const push=(PR+R-d)*.35;b.ox+=dx/d*push;b.oz+=dz/d*push;}}
 // Drift home, stay off walls, stay within a metre, then draw.
 const dt=Math.min(.1,clock.dt);B.stats.pushed=0;
 for(const b of bodies){
  let ox=b.ox,oz=b.oz;const L=Math.hypot(ox,oz);
  const moved=Math.abs(ox-b.st.off.x)+Math.abs(oz-b.st.off.y)>1e-4;
  if(!moved&&L>0){const k=Math.max(0,L-RETURN*dt)/L;ox*=k;oz*=k;} // nobody pushing: walk back
  const L2=Math.hypot(ox,oz);if(L2>MAX){ox*=MAX/L2;oz*=MAX/L2;}
  for(let t=0;t<3&&(ox||oz);t++){if(typeof blockedAt!=='function'||!blockedAt(b.x+ox,b.y+.05,b.z+oz,R*.8,1.6))break;ox*=.5;oz*=.5;if(t===2){ox=0;oz=0;}}
  if((ox||oz)&&Math.abs(shSurfaceY(b.x+ox,b.z+oz,b.y+1)-b.y)>.35){ox=0;oz=0;}
  b.st.off.set(ox,oz);b.ox=ox;b.oz=oz;
  if(Math.abs(ox)+Math.abs(oz)<1e-3){b.st.off.set(0,0);continue;}
  B.stats.pushed++;
  // World offset into the parent's local frame.
  const par=b.g.parent;par.getWorldQuaternion(tmpQ);par.getWorldScale(tmpS);inv.copy(tmpQ).invert();
  tmpV.set(ox,0,oz).applyQuaternion(inv);tmpV.x/=tmpS.x||1;tmpV.z/=tmpS.z||1;tmpV.y=0;
  b.g.position.add(tmpV);b.st.applied.copy(tmpV);b.st.written.copy(b.g.position);b.st.has=true;
 }
}
function restore(c){const st=c._body;if(st?.has){const toW=c.group.position.distanceToSquared(st.written);tmpV.copy(st.written).sub(st.applied);if(toW<1e-10||toW<c.group.position.distanceToSquared(tmpV))c.group.position.sub(st.applied);}if(st){st.has=false;st.applied.set(0,0,0);st.off.set(0,0);}}

// The player is pushed out of bodies after walking, and only into free space.
const physics=window.updateWalkPhysics;
if(typeof physics==='function')window.updateWalkPhysics=function(){const r=physics.apply(this,arguments);if(!B.enabled||Player.mode!=='walk')return r;
 const p=Player.position,pf=p.y-Player.height;let hit=0;
 for(let it=0;it<2;it++)for(const b of bodies){const bx=b.x+b.ox,bz=b.z+b.oz,dx=p.x-bx,dz=p.z-bz,d=Math.hypot(dx,dz),m=PR+R;
  if(d>=m||Math.abs(b.y-pf)>1.4)continue;const n=d>1e-4?[dx/d,dz/d]:[1,0],push=m-d,nx=p.x+n[0]*push,nz=p.z+n[1]*push;
  if(typeof blockedAt==='function'&&blockedAt(nx,pf+.02,nz,PR,Player.height))continue;
  p.x=nx;p.z=nz;const vn=Player.velocity.x*n[0]+Player.velocity.z*n[1];if(vn<0){Player.velocity.x-=vn*n[0];Player.velocity.z-=vn*n[1];}hit++;}
 B.stats.player=hit;return r;};

// One pass per frame, after every system has moved its people, before drawing.
const clock={last:0,dt:0};
function hook(){const sc=State.scene;if(!sc||sc._bodiesHooked)return;sc._bodiesHooked=true;const prev=sc.onBeforeRender;sc.onBeforeRender=function(){try{pass();}catch(e){if(!B.warned){B.warned=true;console.warn('[bodies]',e);}}return prev?.apply(this,arguments);};}
function tick(t){requestAnimationFrame(tick);clock.dt=Math.max(0,(t-(clock.last||t))/1000);clock.last=t;frame++;hook();}
requestAnimationFrame(tick);
B.refresh=()=>{lastPass=-1;pass();};
B.set=on=>{B.enabled=!!on;if(!on)for(const [c] of seen)restore(c);return B.enabled;};
B.bodies=()=>bodies.map(b=>({x:b.x+b.ox,y:b.y,z:b.z+b.oz,base:[b.x,b.z],name:b.c.name||b.c.handle||'',char:b.c}));
})();
