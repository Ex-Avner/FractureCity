'use strict';
// Spawned NPCs in the shared city (the Casting Booth).
//
// The server owns them: who exists, their role, story, look, health, goals and
// fights. It has no city geometry, so it does not walk them through streets
// itself when anyone can see: the nearest connected resident's game moves
// each NPC toward the goal set here, with real collision, and reports where
// it got to (checked against the NPC's speed). With nobody within SIM_RANGE
// the server steps them in a straight line, since nobody is there to see it.
//
// Brains are shared with solo cities: apps/fracture-city-game/npc-brain.js.
const crypto=require('node:crypto');
const B=require('../apps/fracture-city-game/npc-brain.js');
const SIM_RANGE=60,THINK_EVERY=.25,ABSENT_MS=10*60000;
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const num=v=>Number.isFinite(v)?v:null;

function createSpawns({economy,looks,now=Date.now,hurtPlayer,chat}={}){
 const list=r=>r.npcs||(r.npcs=new Map());
 const bump=r=>{r.npcRev=(r.npcRev||0)+1};
 function ownedBy(r,accountId){return [...list(r).values()].filter(n=>n.owner===accountId).length}
 //  Spawn one NPC (three for a crew) at the resident's feet or a given point nearby.
 function add(r,p,b){
  if(!r.map.city||r.phase!=='live')fail(409,'Enter the shared city first.');
  const spec=B.cleanSpec(b,sku=>economy.owns(p.accountId,sku));if(spec.error)fail(spec.error.startsWith('Unlock')?402:400,spec.error);
  const count=B.ROLES[spec.role].crew||1;
  if(ownedBy(r,p.accountId)+count>B.LIMITS.perPlayer)fail(409,'You have '+ownedBy(r,p.accountId)+' NPCs out. The limit is '+B.LIMITS.perPlayer+'. Dismiss some at the booth.');
  if(list(r).size+count>B.LIMITS.perCity)fail(409,'This city already has '+list(r).size+' spawned NPCs (limit '+B.LIMITS.perCity+').');
  let x=num(b.x)??p.x,z=num(b.z)??p.z;const y=num(b.y)??(p.y||1);
  if(Math.hypot(x-p.x,z-p.z)>12){x=p.x;z=p.z}
  if(spec.role==='courier'){const to=[...r.players.values()].find(q=>q.name.toLowerCase()===spec.to.toLowerCase()&&q.id!==p.id);if(!to)fail(404,'Nobody called “'+spec.to+'” is in this city right now.');if(!spec.message)fail(400,'Write the message for the courier.');spec.task={to:to.accountId,toName:to.name,msg:spec.message}}
  const look=looks.clean(b.look,sku=>economy.owns(p.accountId,sku)),crewId=count>1?crypto.randomBytes(4).toString('hex'):null,made=[];
  for(let i=0;i<count;i++){
   const id=crypto.randomBytes(6).toString('hex');
   const story=i?B.reroll(B.reroll(spec.story,'name',spec.role,id),'nick',spec.role,id+'n'):spec.story;
   const n=B.init({id,role:spec.role,owner:p.accountId,ownerName:p.name,story,look:i?{...look,hairStyle:look.hairStyle,faceWidth:look.faceWidth*(1+.05*i),jaw:look.jaw}:look,task:spec.task||null,crew:crewId,leader:null,seen:now()},{x:x+i*.9,y,z:z+i*.6,yaw:p.yaw});
   if(crewId)n.leader=made[0]?.id||id;
   list(r).set(id,n);made.push(n);
  }
  bump(r);
  return made.map(n=>n.id);
 }
 function mine(r,p,id){const n=list(r).get(String(id||''));if(!n)fail(404,'That NPC is not here any more.');if(n.owner!==p.accountId)fail(403,'Only whoever spawned them can do that.');return n}
 function remove(r,p,id,{force=false}={}){const n=list(r).get(String(id||''));if(!n)return false;if(!force&&n.owner!==p.accountId)fail(403,'Only whoever spawned them can dismiss them.');for(const [k,q]of list(r))if(k===n.id||(n.crew&&q.crew===n.crew))list(r).delete(k);bump(r);return true}
 //  Owner orders: follow / stay / home (walk back to where they were spawned) / here (move home to your feet).
 function command(r,p,b){
  const n=mine(r,p,b.id),cmd=String(b.cmd||'');
  if(cmd==='stay')n.mode='stay';
  else if(cmd==='follow'){if(B.ROLES[n.role].group!=='help')fail(400,'Only followers and helpers follow.');n.mode='follow'}
  else if(cmd==='here'){if(B.ROLES[n.role].group==='trouble'&&B.inSafe(p.x,p.z))fail(409,'Trouble cannot be set up inside Common Ground.');n.home={x:p.x,y:p.y||1,z:p.z};n.mode='walk';n.gx=p.x;n.gz=p.z;n.speed=Math.max(2.5,B.ROLES[n.role].speed);n.t=30}
  else if(cmd==='story'){const s=B.cleanSpec({role:n.role,story:b.story,seed:n.id},()=>true);if(s.error)fail(400,s.error);n.story=s.story;bump(r)}
  else fail(400,'Unknown order.');
  return{ok:true};
 }
 //  Positions from the resident moving these NPCs with collision.
 function poses(r,p,items){
  if(!Array.isArray(items)||items.length>B.LIMITS.perCity)fail(400,'Invalid NPC poses.');
  const t=now();let n=0;p.npcSimAt=t;
  for(const it of items){
   const npc=list(r).get(String(it?.id||''));if(!npc||npc.sim!==p.id)continue;
   for(const k of ['x','y','z','yaw'])if(!Number.isFinite(it[k]))fail(400,'Invalid NPC pose.');
   const dt=Math.min(2,Math.max(.05,(t-(npc.poseAt||t-200))/1000)),lim=(Math.max(npc.speed||0,1.5)+1.5)*dt+1;
   if(npc.teleported||Math.hypot(it.x-npc.x,it.z-npc.z)<=lim){npc.x=it.x;npc.z=it.z;npc.y=Math.max(0,Math.min(160,it.y));npc.yaw=it.yaw;npc.moving=!!it.moving;npc.poseAt=t;npc.teleported=false;n++}
   if(it.stuck)npc.stuck=true;
  }
  return n;
 }
 //  Who is close enough to move each NPC: the nearest connected resident within SIM_RANGE.
 function assign(r){
  //  Only residents whose game is running NPCs right now (it reports, even with nothing to move).
  const t=now(),people=[...r.players.values()].filter(q=>q.stream&&q.hp>0&&t-(q.npcSimAt||0)<5000);
  for(const n of list(r).values()){
   let best=null,bd=SIM_RANGE;for(const q of people){const d=Math.hypot(q.x-n.x,q.z-n.z);if(d<bd-(q.id===n.sim?8:0)){bd=d;best=q}}
   //  A little stickiness so the job does not flip between two residents standing together.
   const cur=n.sim&&people.find(q=>q.id===n.sim);if(cur&&Math.hypot(cur.x-n.x,cur.z-n.z)<SIM_RANGE&&best&&Math.hypot(best.x-n.x,best.z-n.z)>Math.hypot(cur.x-n.x,cur.z-n.z)-8)best=cur;
   n.sim=best?.id||null;
  }
 }
 function world(r){
  const t=now(),players=[...r.players.values()].filter(q=>r.map.city).map(q=>({id:q.id,accountId:q.accountId,name:q.name,x:q.x,y:q.y||1,z:q.z,yaw:q.yaw,hp:q.hp,safe:B.inSafe(q.x,q.z),protected:q.protectUntil>t,ref:q}));
  return{now:t,players,npcs:[...list(r).values()],rand:Math.random,
   say:(n,text,secs)=>{n.say=String(text).slice(0,200);n.sayUntil=t+secs*1000;n.sayId=(n.sayId||0)+1},
   hurt:(pl,dmg,n)=>hurtPlayer?.(r,pl.ref,dmg,n),
   strike:(a,b,dmg)=>{if(B.strike(a,b,dmg))r.events.push({id:crypto.randomBytes(4).toString('hex'),type:'npc-down',npc:b.id,by:a.id});r.events=r.events.slice(-10)},
   reward:(pl,c,why,n)=>{const k='reward:'+pl.accountId;if(t-(r.rewardAt?.[k]||0)<30000)return;(r.rewardAt||(r.rewardAt={}))[k]=t;economy.credit(pl.accountId,c);chat?.(r,pl.name+' '+why+' (+'+c+' credits).')},
   gift:(pl,n)=>{const g=economy.give(pl.accountId,4);if(g)chat?.(r,(n.story?.name||'A crew hand')+' scrounged '+g.n+' × '+g.name+' for '+pl.name+'.')},
   chat:text=>chat?.(r,text)};
 }
 let acc=0;
 function tick(r,dt){
  if(!r.map.city||r.phase!=='live'||!list(r).size)return false;
  const t=now();
  //  Owners away for ten minutes take their NPCs with them.
  let gone=false;for(const n of [...list(r).values()]){if([...r.players.values()].some(q=>q.accountId===n.owner))n.seen=t;else if(t-n.seen>ABSENT_MS){list(r).delete(n.id);gone=true}}
  if(gone)bump(r);
  r.npcThink=(r.npcThink||0)+dt;
  if(r.npcThink>=THINK_EVERY){const w=world(r),step=r.npcThink;r.npcThink=0;assign(r);for(const n of list(r).values())B.think(n,w,step)}
  //  The server steps NPCs nobody is moving: no resident near, or the one assigned has gone quiet.
  for(const n of list(r).values())if(!n.sim||n.teleported||t-(n.poseAt||0)>1500)B.step(n,dt);
  return true;
 }
 //  Players shooting NPCs: trouble only, never inside Common Ground.
 function shoot(r,p,b,w,o,d){
  const n=list(r).get(String(b.npc||''));if(!n)return{hit:false,reason:'gone'};
  if(B.ROLES[n.role].group!=='trouble'||n.mode==='down')return{hit:false,reason:'not-a-target'};
  if(B.inSafe(n.x,n.z))return{hit:false,reason:'target-safe'};
  const ny=n.y||1,dist=rayBox(o,d,{x:n.x-.6,y:ny-.2,z:n.z-.6},{x:n.x+.6,y:ny+2.1,z:n.z+.6});
  if(!(dist<=w.range+1))return{hit:false,reason:'miss'};
  const dmg=w.dmg*Math.max(1,Math.min(w.pellets,Number.isSafeInteger(b.pellets)?b.pellets:1)),down=B.strike(p,n,dmg);
  if(down){const k='npcdown:'+p.accountId,t=now();if(t-(r.rewardAt?.[k]||0)>=20000){(r.rewardAt||(r.rewardAt={}))[k]=t;economy.credit(p.accountId,5)}chat?.(r,p.name+' knocked down '+(n.story?.name||'an NPC')+'.')}
  else if(n.mode!=='fight'&&n.role!=='pickpocket'){n.mode='fight';n.target=p.id;n.punches=0}
  return{hit:true,npc:n.id,dmg,hp:n.hp,down};
 }
 function state(r){return [...list(r).values()].map(n=>({i:n.id,o:n.owner,r:n.role,n:n.story?.name||'',x:+n.x.toFixed(2),y:+(n.y||1).toFixed(2),z:+n.z.toFixed(2),w:+(n.yaw||0).toFixed(2),gx:+n.gx.toFixed(2),gz:+n.gz.toFixed(2),v:n.speed||0,a:n.act,m:n.mode,h:n.hp,hm:n.maxHp,s:n.sayUntil>now()?n.say:'',si:n.sayId||0,sim:n.sim||null,c:n.crew||null,tp:n.teleported?1:0}))}
 function detail(r){const out={};for(const n of list(r).values())out[n.id]={role:n.role,owner:n.owner,ownerName:n.ownerName,story:n.story,look:n.look,crew:n.crew,task:n.task?{toName:n.task.toName,done:!!n.task.done}:null};return{rev:r.npcRev||0,npcs:out}}
 return{add,remove,command,poses,tick,shoot,state,detail,count:r=>list(r).size};
}
function rayBox(o,d,min,max){let t0=0,t1=Infinity;for(const k of ['x','y','z']){const inv=1/d[k];let a=(min[k]-o[k])*inv,b=(max[k]-o[k])*inv;if(a>b)[a,b]=[b,a];t0=Math.max(t0,a);t1=Math.min(t1,b);if(t0>t1)return Infinity}return t0}
module.exports={createSpawns};
