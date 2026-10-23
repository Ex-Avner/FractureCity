/* PvP in the online city.
   Every real shot (the game's own tryAttack, after its cooldown and ammo
   checks) is tested against the other residents you can see; a hit is sent
   to the server, which checks it against its own positions and keeps the
   health, downs and respawns. Common Ground and the building yard are safe.
   Shots from others draw as tracers; your own PvP health shows when hurt. */
(function(){'use strict';
const SAFE={x0:144,x1:216,z0:0,z1:72};
const live=()=>!!(window.FCCityOnline&&FCCityOnline.ready&&FCCityOnline.connected);
const me=()=>window.FCCityOnline?.self;
const token=()=>{try{return JSON.parse(sessionStorage.getItem('fc-district-session')||'{}').token||''}catch(e){return''}};
async function api(route,data){const res=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token()},body:JSON.stringify(data),signal:AbortSignal.timeout(6000)});const out=await res.json().catch(()=>({}));if(!res.ok)throw Object.assign(Error(out.error||'Shot not sent.'),{status:res.status});return out}
const inSafe=(x,z)=>x>=SAFE.x0&&x<=SAFE.x1&&z>=SAFE.z0&&z<=SAFE.z1;

// ─── Your shots ─────────────────────────────────────────────────────────────
const box=new THREE.Box3(),hitPoint=new THREE.Vector3();
function bodyHit(ray,p,range){box.min.set(p.x-.45,(p.y??1)-.05,p.z-.45);box.max.set(p.x+.45,(p.y??1)+1.95,p.z+.45);const h=ray.intersectBox(box,hitPoint);if(!h)return null;const d=h.distanceTo(ray.origin);return d<=range?d:null}
function clearPath(origin,dir,dist){const v=raycastVoxel(origin,dir,dist);return !v||Math.hypot(v.x+.5-origin.x,v.y+.5-origin.y,v.z+.5-origin.z)>dist}
function shotFired(){
 if(!live()||Player.mode==='drive')return;
 const self=me();if(!self||self.hp<=0)return;
 const key=Player.currentWeapon,w=(typeof shWeapon==='function'?shWeapon(key):WEAPONS[key])||{range:30,pellets:1};
 const forward=new THREE.Vector3(0,0,-1).applyEuler(State.camera.rotation).normalize(),origin=Player.position.clone();
 const peers=(FCCityOnline.room?.players||[]).filter(p=>p.id!==self.id&&p.hp>0&&p.connected);
 if(!peers.length)return;
 //  Shotguns: each pellet scatters as the game's own gun does; count the pellets that land.
 const pellets=w.pellets||1,hits=new Map();
 for(let i=0;i<pellets;i++){const dir=forward.clone();if(w.spread&&pellets>1){dir.x+=(Math.random()-.5)*w.spread*2;dir.y+=(Math.random()-.5)*w.spread*2;dir.z+=(Math.random()-.5)*w.spread*2;dir.normalize()}
  const ray=new THREE.Ray(origin,dir);let best=null,bd=Infinity;
  for(const p of peers){const d=bodyHit(ray,p,w.range||30);if(d!==null&&d<bd&&clearPath(origin,dir,d)){bd=d;best=p}}
  if(best)hits.set(best.id,(hits.get(best.id)||0)+1);
 }
 const target=[...hits.entries()].sort((a,b)=>b[1]-a[1])[0];
 const body={weapon:['baton','pistol','shotgun'].includes(key)?key:'other',ox:origin.x,oy:origin.y,oz:origin.z,dx:forward.x,dy:forward.y,dz:forward.z,target:target?target[0]:null,pellets:target?target[1]:0};
 if(!target)return;
 api('city-shoot',body).then(r=>{if(r.hit){marker(r.down);if(r.down){const v=peers.find(p=>p.id===target[0]);toast('You downed '+(v?.name||'a resident')+' · +25 credits','success')}}else if(r.reason==='safe')toast('Common Ground is a safe zone. No PvP here.','info');else if(r.reason==='target-safe')toast('They are in a safe zone.','info');else if(r.reason==='protected')toast('Just respawned: protected for a few seconds.','info')}).catch(()=>{});
}
const attack=window.tryAttack;
window.tryAttack=function(){const before=Player.attackCooldown;const r=attack.apply(this,arguments);if(before<=0&&Player.attackCooldown>0)shotFired();return r};

// ─── Feedback ───────────────────────────────────────────────────────────────
const ui=document.createElement('div');ui.id='city-pvp';ui.innerHTML='<div class="pv-marker"></div><div class="pv-hp" hidden><b>PVP</b><i><s></s></i><span></span></div><div class="pv-zone" hidden></div><div class="pv-down" hidden><b>DOWNED</b><span></span></div><div class="pv-hurt"></div>';document.body.append(ui);
const $=s=>ui.querySelector(s);
let markT=0;function marker(down){const m=$('.pv-marker');m.className='pv-marker on'+(down?' down':'');clearTimeout(markT);markT=setTimeout(()=>m.className='pv-marker',220)}
let lastHp=100,lastSafe=null,wasDown=false,pausedByUs=false,lastEvent=new Set(),zoneT=0;
const tracers=[];
function tracer(e){if(!State.scene)return;const from=new THREE.Vector3(e.x,e.y,e.z),to=from.clone().add(new THREE.Vector3(e.dx,e.dy,e.dz).multiplyScalar(Math.min(e.range||30,60)));const g=new THREE.BufferGeometry().setFromPoints([from,to]),l=new THREE.Line(g,new THREE.LineBasicMaterial({color:e.hit?0xff5a4d:0xffe08a,transparent:true,opacity:.85}));State.scene.add(l);tracers.push({l,t:performance.now()})}
function frame(now){requestAnimationFrame(frame);
 for(let i=tracers.length-1;i>=0;i--){const t=tracers[i];const k=(now-t.t)/180;if(k>=1){t.l.removeFromParent();t.l.geometry.dispose();t.l.material.dispose();tracers.splice(i,1)}else t.l.material.opacity=.85*(1-k)}
 if(!live()){ui.hidden=true;return}ui.hidden=false;
 const self=me(),room=FCCityOnline.room;if(!self||!room)return;
 for(const e of room.events||[])if(e.type==='city-shot'&&!lastEvent.has(e.id)){lastEvent.add(e.id);if(e.player!==self.id)tracer(e);if(lastEvent.size>60)lastEvent=new Set([...lastEvent].slice(-30))}
 const hp=self.hp??100;
 if(hp<lastHp&&hp>0){const h=$('.pv-hurt');h.classList.remove('on');void h.offsetWidth;h.classList.add('on')}
 lastHp=hp;
 const bar=$('.pv-hp');bar.hidden=hp>=100||hp<=0;if(!bar.hidden){bar.querySelector('s').style.width=hp+'%';bar.querySelector('span').textContent=Math.ceil(hp)+' / 100'}
 const down=hp<=0,d=$('.pv-down');d.hidden=!down;
 if(down){d.querySelector('span').textContent='Back in Common Ground in '+Math.max(0,Math.ceil(((self.respawnAt||0)-(room.time||Date.now()))/1000))+'s';if(!wasDown){pausedByUs=!State.ui.paused;State.ui.paused=true;State.keys?.clear?.();Player.velocity?.set(0,0,0)}}
 else if(wasDown){if(pausedByUs)State.ui.paused=false;pausedByUs=false;lastHp=100}
 wasDown=down;
 const safe=inSafe(Player.position.x,Player.position.z);
 if(safe!==lastSafe){if(lastSafe!==null){const z=$('.pv-zone');z.textContent=safe?'SAFE ZONE · Common Ground':'PVP ZONE · other residents can hit you';z.className='pv-zone on '+(safe?'safe':'open');z.hidden=false;clearTimeout(zoneT);zoneT=setTimeout(()=>{z.hidden=true},2600)}lastSafe=safe}
}
requestAnimationFrame(frame);
const css=document.createElement('style');css.textContent=`
#city-pvp[hidden]{display:none}
#city-pvp .pv-marker{position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;z-index:60;opacity:0;background:linear-gradient(45deg,transparent 45%,#fff 45%,#fff 55%,transparent 55%),linear-gradient(-45deg,transparent 45%,#fff 45%,#fff 55%,transparent 55%)}
#city-pvp .pv-marker.on{opacity:1}#city-pvp .pv-marker.down{filter:drop-shadow(0 0 4px #ff3b3b) hue-rotate(-40deg);transform:scale(1.4)}
#city-pvp .pv-hp{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:61;display:flex;align-items:center;gap:8px;padding:5px 10px;background:#0b151bd9;border:1px solid #6b2a30;border-radius:8px;font:600 11px system-ui;color:#ffd7d2}
#city-pvp .pv-hp i{display:block;width:140px;height:8px;background:#2a1517;border-radius:4px;overflow:hidden}#city-pvp .pv-hp s{display:block;height:100%;background:#ff5a4d}
#city-pvp .pv-zone{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:61;padding:8px 14px;border-radius:8px;font:700 12px system-ui;letter-spacing:.06em;background:#0b151be6}
#city-pvp .pv-zone.safe{color:#9ff0c9;border:1px solid #2f7a5c}#city-pvp .pv-zone.open{color:#ffb0a8;border:1px solid #8a2f36}
#city-pvp .pv-down{position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:radial-gradient(#3a0d12cc,#000d);color:#ffd7d2;font:600 14px system-ui}
#city-pvp .pv-down b{font:700 44px Georgia,serif;letter-spacing:.08em;color:#ff6b5e}
#city-pvp .pv-down[hidden]{display:none}
#city-pvp .pv-hurt{position:fixed;inset:0;pointer-events:none;z-index:59;box-shadow:inset 0 0 120px #ff1a1a;opacity:0}
#city-pvp .pv-hurt.on{animation:pvhurt .45s ease-out}
@keyframes pvhurt{from{opacity:.9}to{opacity:0}}
@media (pointer:coarse){#city-pvp .pv-hp{bottom:auto;top:96px}}`;
document.head.append(css);
window.FCCityPvp={safe:inSafe,SAFE};
})();
